<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas\ShapeMatcher\PropSourceSuggester;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Entity\EntityDisplayRepositoryInterface;
use Drupal\Core\Logger\RfcLoggerTrait;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\Update\UpdateBackend;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\node\Entity\Node;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Psr\Log\LoggerInterface;

/**
 * Tests the update that converts values stored in the brace form.
 */
#[RunTestsInSeparateProcesses]
#[CoversFunction('canvas_metatag_post_update_values_as_parts')]
#[CoversFunction('canvas_metatag_post_update_event_organizer')]
#[CoversFunction('canvas_metatag_post_update_country_codes')]
#[CoversFunction('canvas_metatag_post_update_own_jsonld_as_written')]
#[CoversFunction('canvas_metatag_post_update_reserve_breadcrumb')]
#[Group('canvas_metatag')]
#[Group('canvas_metatag_canvas_contract')]
final class PostUpdateTest extends CanvasKernelTestBase implements LoggerInterface {

  use ContentTranslationTestTrait;
  use GenerateComponentConfigTrait;
  use RfcLoggerTrait;
  use SeoFixtureTrait;
  use UserCreationTrait;

  private const CLIENT = '0b6c7f0e-6c1f-4a53-9f0b-1c2f3d4e5a6b';

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'text',
    'language',
    'content_translation',
    'canvas_metatag',
  ];

  /**
   * What the update logged under canvas_metatag.
   *
   * @var list<string>
   */
  private array $logged = [];

  /**
   * {@inheritdoc}
   */
  public function log($level, string|\Stringable $message, array $context = []): void {
    if (($context['channel'] ?? '') === 'canvas_metatag') {
      $this->logged[] = strtr((string) $message, array_map('strval', array_filter($context, 'is_scalar')));
    }
  }

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->installConfig(['language']);
    ConfigurableLanguage::createFromLangcode('fr')->save();
    $this->enableContentTranslation(Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID);
    $this->generateComponentConfig();
    $this->createField('field_summary', 'string_long', 'Summary');
    $this->createField('field_byline', 'string', 'Byline');
    $this->createField('field_body', 'text_with_summary', 'Body');
    $this->container->get('logger.factory')->addLogger($this);
  }

  /**
   * Every stored value is converted; a loss is logged without its value.
   *
   * Site settings, a template and its draft, page revisions and translations,
   * and a page draft.
   */
  public function testValuesAsParts(): void {
    $auto_save = $this->container->get(AutoSaveManager::class);
    // The installed site pattern. Old values are written to the config
    // storage as they were stored: the schema no longer describes them.
    $config = $this->container->get('config.storage');
    $site = $config->read('canvas_metatag.site');
    $site['values'] = [
      'title' => '{title} {sep} {site}',
      'robots' => ['max_image_preview' => 'large'],
    ];
    $config->write('canvas_metatag.site', $site);
    $this->container->get('config.factory')->reset('canvas_metatag.site');

    // A template with a stored setting and an editor's draft with layout
    // work.
    $owner = $this->setUpCurrentUser();
    $store = $this->container->get('keyvalue')->get(AutoSaveManager::AUTO_SAVE_STORE);
    $template = $this->createTemplate(TRUE, []);
    $raw = $config->read('canvas.content_template.' . $template->id());
    $raw['third_party_settings']['canvas_metatag']['values'] = [
      'title' => '{title} {sep} Journal',
      'description' => '{field.field_summary}',
      'social' => ['title' => '{title} by {field.field_byline}'],
      'schema' => [
        'type' => 'Article',
        'props' => ['author_name' => '{field.field_byline}', 'headline' => '{title}'],
        'custom' => '{"@type":"Thing","name":"{field.field_byline}"}',
      ],
    ];
    $config->write('canvas.content_template.' . $template->id(), $raw);
    $this->container->get('config.factory')->reset('canvas.content_template.' . $template->id());
    $this->container->get('entity_type.manager')->getStorage('content_template')->resetCache([$template->id()]);
    $template = ContentTemplate::load($template->id());
    \assert($template instanceof ContentTemplate);
    $draft = clone $template;
    $tree = $draft->get('component_tree');
    // A loaded template keys its tree by component uuid.
    $tree[array_key_first($tree)]['inputs']['text'] = 'Draft heading';
    $draft->set('component_tree', $tree);
    $draft->setThirdPartySetting('canvas_metatag', 'values', [
      'title' => '{title} {sep} Drafts',
      'description' => '{field.field_body}',
    ]);
    $auto_save->saveEntity($draft, self::CLIENT);
    $template_key = AutoSaveManager::getAutoSaveKey($draft);
    $store->set($template_key, ['updated' => 1600000000] + $store->get($template_key));

    // A page: two revisions, each in two languages, and a draft.
    $page = $this->createPage(['canvas_metatag' => '{"title":"Pricing plans for every team {sep} {site}","robots":{"noindex":true}}']);
    // A new translation starts empty (the module's translation hook): the
    // old value is set on it afterwards.
    $page->addTranslation('fr', ['title' => 'Tarifs', 'status' => TRUE])
      ->set('canvas_metatag', '{"title":"Tarifs {sep} {site}","social":{"title":"{site}: tarifs"}}')
      ->save();
    $first = (int) $page->getRevisionId();
    $page = Page::load($page->id());
    \assert($page instanceof Page);
    $page->setNewRevision();
    $page->set('canvas_metatag', '{"title":"Never published: {title}","schema":{"type":"Article"}}');
    // A translation names no type: its details are those of the type it
    // inherits, Article.
    $page->getTranslation('fr')->set('canvas_metatag', '{"title":"{title}","schema":{"props":{"author_name":"Ada Writer","headline":"{title}"}}}');
    $page->save();
    // The draft of an editor, in step with the stored page.
    $page_draft = clone Page::load($page->id());
    $page_draft->set('title', 'Draft title')->set('canvas_metatag', '{"title":"Draft words {sep} {site}"}');
    $auto_save->saveEntity($page_draft, self::CLIENT);
    $key = AutoSaveManager::getAutoSaveKey($page_draft);
    $store->set($key, ['updated' => 1700000000] + $store->get($key));
    // Updates run without a user.
    $this->container->get('current_user')->setAccount(new AnonymousUserSession());

    // The update, as drush updb runs it: every cache bin, the memory bin too,
    // is an update backend that keeps nothing; in passes, until it is done.
    foreach (['cache.default', 'cache.memory'] as $bin) {
      $this->container->set($bin, new UpdateBackend($this->container->get($bin)));
    }
    $this->container->set(Sources::class, NULL);
    \Drupal::moduleHandler()->loadInclude('canvas_metatag', 'php', 'canvas_metatag.post_update');
    $sandbox = [];
    $passes = 0;
    do {
      $message = canvas_metatag_post_update_values_as_parts($sandbox);
      $passes++;
    } while (($sandbox['#finished'] ?? 1) < 1 && $passes < 10);
    self::assertSame(1, $sandbox['#finished']);
    self::assertStringContainsString('typed text and links', $message);

    // The installed pattern is no ending at all.
    self::assertSame(['robots' => ['max_image_preview' => 'large']], $this->config('canvas_metatag.site')->get('values'));
    $summary = [
      'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_summary␞␟value', 'sourceType' => 'entity-field'],
    ];
    $byline = [
      'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
    ];
    $stored = ContentTemplate::load('node.article.full');
    \assert($stored instanceof ContentTemplate);
    // In the order of the config schema, as configuration stores it. A
    // template's composite is converted whole where the place composes.
    self::assertSame([
      'title_end' => ['text' => 'Journal'],
      'description' => $summary,
      'social' => ['title' => ['parts' => [['fact' => 'title'], ['text' => ' by '], $byline]]],
      'schema' => [
        'type' => 'Article',
        'props' => ['author_name' => $byline],
        'custom' => '{"@type":"Thing","name":"{field.field_byline}"}',
      ],
    ], $stored->getThirdPartySetting('canvas_metatag', 'values'));
    self::assertEntityIsValid($stored);
    // The draft keeps its layout work and its client id; the first formatted
    // text with a summary is the Description fact.
    $entry = $auto_save->getAutoSaveEntity($stored, TRUE);
    self::assertSame(self::CLIENT, $entry->clientId);
    \assert($entry->entity instanceof ContentTemplate);
    self::assertSame('Draft heading', array_values($entry->entity->get('component_tree'))[0]['inputs']['text']);
    self::assertSame(['title_end' => ['text' => 'Drafts']], $entry->entity->getThirdPartySetting('canvas_metatag', 'values'));
    // Still the editor's, from when they left it, although saving the
    // template deleted it on the way.
    $listed = $auto_save->getAllAutoSaveList(FALSE, TRUE)[$template_key];
    self::assertSame([(int) $owner->id(), 1600000000], [$listed['owner'], $listed['updated']]);

    // Pages: every revision and translation, so a revert never brings the
    // old form back; and the draft.
    $storage = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID);
    $old = $storage->loadRevision($first);
    \assert($old instanceof Page);
    self::assertSame(['robots' => ['noindex' => TRUE], 'title' => ['text' => 'Pricing plans for every team']], Values::decode($old->get('canvas_metatag')->value));
    self::assertSame(['title' => ['text' => 'Tarifs']], Values::decode($old->getTranslation('fr')->get('canvas_metatag')->value));
    $current = $storage->loadUnchanged($page->id());
    \assert($current instanceof Page);
    self::assertSame([
      'schema' => ['type' => 'Article'],
      'title' => ['text' => 'Never published:'],
      'title_end' => ['text' => ''],
    ], Values::decode($current->get('canvas_metatag')->value));
    // The translation keeps the details of the type it inherits.
    self::assertSame([
      'schema' => ['props' => ['author_name' => ['text' => 'Ada Writer']]],
      'title_end' => ['text' => ''],
    ], Values::decode($current->getTranslation('fr')->get('canvas_metatag')->value));
    $draft = $auto_save->getAutoSaveEntity($current, TRUE);
    self::assertSame(self::CLIENT, $draft->clientId);
    \assert($draft->entity instanceof Page);
    self::assertSame('Draft title', $draft->entity->label());
    self::assertSame('{"title":{"text":"Draft words"}}', $draft->entity->get('canvas_metatag')->value);
    // Still the editor's draft, from when they left it, and in step with the
    // stored page: no conflict with an edit made elsewhere.
    $entry = $auto_save->getAllAutoSaveList(FALSE, TRUE)[$key];
    self::assertSame([(int) $owner->id(), 1700000000], [$entry['owner'], $entry['updated']]);
    self::assertArrayNotHasKey(AutoSaveManager::AUTO_SAVE_CONFLICT_KEY, $entry);
    self::assertNull($auto_save->getUnresolvedConflictForEntity($current));
    // A revert to the old revision publishes the converted value.
    $reverted = $storage->createRevision($old);
    $reverted->save();
    self::assertSame('Pricing plans for every team | Example', $this->resolver()->resolve($storage->loadUnchanged($page->id()))['head']['title']);

    // What lost text is logged, by entity and key, never with the value.
    self::assertEmpty(preg_grep('/^node\.article\.full: social\.title/', $this->logged));
    self::assertContains('node.article.full: schema.custom: names a field. A whole value is filled from its field; a name inside other text stays as written.', $this->logged);
    self::assertContains("canvas_page {$page->id()} (en, revision {$page->getRevisionId()}): title: kept its first part; dropped {title}.", $this->logged);
    self::assertContains("canvas_page {$page->id()} (fr, revision $first): social.title: kept its first part; dropped typed text.", $this->logged);
    foreach ($this->logged as $line) {
      self::assertStringNotContainsString('Never published', $line);
      self::assertStringNotContainsString('tarifs', $line);
    }

    // Run again: nothing changes, and only the custom JSON-LD that still
    // names a field is said again.
    $before = [
      $this->config('canvas_metatag.site')->get('values'),
      ContentTemplate::load('node.article.full')?->getThirdPartySetting('canvas_metatag', 'values'),
    ];
    // Byte for byte, as configuration export writes them: single links,
    // typed text, "No ending" and a composition alike.
    $exported = static fn (): string => serialize([
      $config->read('canvas_metatag.site'),
      $config->read('canvas.content_template.node.article.full'),
    ]);
    $raw = $exported();
    $this->logged = [];
    $sandbox = [];
    do {
      canvas_metatag_post_update_values_as_parts($sandbox);
    } while (($sandbox['#finished'] ?? 1) < 1);
    self::assertSame($before, [
      $this->config('canvas_metatag.site')->get('values'),
      ContentTemplate::load('node.article.full')?->getThirdPartySetting('canvas_metatag', 'values'),
    ]);
    self::assertSame(['node.article.full: schema.custom: names a field. A whole value is filled from its field; a name inside other text stays as written.'], $this->logged);
    self::assertSame($raw, $exported());
  }

  /**
   * An event template that never set its organizer keeps the site.
   *
   * The site was every event's organizer unless a name was typed; it now is
   * by default only on a Canvas page. A typed organizer is kept.
   */
  public function testEventOrganizer(): void {
    $auto_save = $this->container->get(AutoSaveManager::class);
    $this->setUpCurrentUser();
    $event = [
      'schema' => [
        'type' => 'Event',
        'props' => ['startDate' => ['text' => '2027-06-19'], 'location_name' => ['text' => 'Riverside Hall']],
      ],
    ];
    $template = $this->createTemplate(TRUE, $event);
    // The draft names someone else: it keeps them.
    $draft = clone $template;
    $draft->setThirdPartySetting('canvas_metatag', 'values', [
      'schema' => ['type' => 'Event', 'props' => ['organizer_name' => ['text' => 'Example Hall Ltd']]],
    ]);
    $auto_save->saveEntity($draft, self::CLIENT);

    \Drupal::moduleHandler()->loadInclude('canvas_metatag', 'php', 'canvas_metatag.post_update');
    self::assertStringStartsWith('One event template', canvas_metatag_post_update_event_organizer());
    $stored = ContentTemplate::load($template->id());
    \assert($stored instanceof ContentTemplate);
    self::assertSame(['fact' => 'identity'], $stored->getThirdPartySetting('canvas_metatag', 'values')['schema']['props']['organizer']);
    // The draft is still the editor's, with its own organizer.
    $entry = $auto_save->getAutoSaveEntity($stored, TRUE);
    self::assertSame(self::CLIENT, $entry->clientId);
    \assert($entry->entity instanceof ContentTemplate);
    self::assertSame(['organizer_name' => ['text' => 'Example Hall Ltd']], $entry->entity->getThirdPartySetting('canvas_metatag', 'values')['schema']['props']);
    // The head still names the site as the organizer.
    $node = Node::create(['type' => 'article', 'title' => 'Midsummer', 'status' => 1]);
    $node->save();
    $head = $this->resolver()->resolve($node)['head'];
    $graph = array_column($head['script'][0]['textContent']['@graph'], NULL, '@type');
    self::assertSame(['@id' => 'http://localhost/#identity'], $graph['Event']['organizer'] ?? NULL);
    // Run again: nothing to change.
    self::assertStringStartsWith('0 event templates', canvas_metatag_post_update_event_organizer());
  }

  /**
   * A venue's country written as a name or a code is stored as its code.
   *
   * On a template and its draft, a page's revisions, and a page draft that
   * stays in step with its page; a country no list knows stays as written.
   */
  public function testCountryCodes(): void {
    $auto_save = $this->container->get(AutoSaveManager::class);
    $this->setUpCurrentUser();
    $event = static fn (string $country): array => [
      'schema' => [
        'type' => 'Event',
        'props' => [
          'startDate' => ['text' => '2027-06-19'],
          'location_address_streetAddress' => ['text' => 'Hämeenkatu 1'],
          'location_address_addressCountry' => ['text' => $country],
        ],
      ],
    ];
    $template = $this->createTemplate(TRUE, $event('Finland'));
    $draft = clone $template;
    $draft->setThirdPartySetting('canvas_metatag', 'values', $event(' sweden '));
    $auto_save->saveEntity($draft, self::CLIENT);
    $page = $this->createPage(['canvas_metatag' => Values::encode($event('fi'))]);
    $other = $this->createPage([
      'canvas_metatag' => Values::encode($event('Atlantis')),
      'path' => ['alias' => '/atlantis'],
    ]);
    $page_draft = clone Page::load($page->id());
    $page_draft->set('canvas_metatag', Values::encode($event('Estonia')));
    $auto_save->saveEntity($page_draft, self::CLIENT);

    \Drupal::moduleHandler()->loadInclude('canvas_metatag', 'php', 'canvas_metatag.post_update');
    self::assertSame('4 venue countries are stored as their codes.', canvas_metatag_post_update_country_codes());
    $country = static fn (mixed $values): ?string => $values['schema']['props']['location_address_addressCountry']['text'] ?? NULL;
    $stored = ContentTemplate::load($template->id());
    \assert($stored instanceof ContentTemplate);
    self::assertSame('FI', $country($stored->getThirdPartySetting('canvas_metatag', 'values')));
    $entry = $auto_save->getAutoSaveEntity($stored, TRUE);
    self::assertSame(self::CLIENT, $entry->clientId);
    \assert($entry->entity instanceof ContentTemplate);
    self::assertSame('SE', $country($entry->entity->getThirdPartySetting('canvas_metatag', 'values')));
    $pages = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID);
    $pages->resetCache();
    self::assertSame('FI', $country(Values::decode($pages->load($page->id())->get('canvas_metatag')->value)));
    self::assertSame('Atlantis', $country(Values::decode($pages->load($other->id())->get('canvas_metatag')->value)));
    $entry = $auto_save->getAutoSaveEntity($pages->load($page->id()), TRUE);
    self::assertSame(self::CLIENT, $entry->clientId);
    self::assertSame('EE', $country(Values::decode($entry->entity->get('canvas_metatag')->value)));
    // The draft was in step with its page, and still is.
    self::assertArrayNotHasKey(AutoSaveManager::AUTO_SAVE_CONFLICT_KEY, $auto_save->getAllAutoSaveList(FALSE, TRUE)[AutoSaveManager::getAutoSaveKey($page)]);
    // Run again: nothing to change.
    self::assertSame('0 venue countries are stored as their codes.', canvas_metatag_post_update_country_codes());
  }

  /**
   * Hand-added JSON-LD is stored as written; ids that are now reserved move.
   *
   * No page's output changes: what read mode renames before the update is
   * what the update stores.
   */
  public function testOwnJsonLdAsWritten(): void {
    $this->setUpCurrentUser();
    $legacy = '[{"@id":"#identity","@type":"Organization","name":"Acme Logistics"},'
      . '{"@id":"#rating","@type":"EmployerAggregateRating","itemReviewed":{"@id":"#identity"},"ratingCount":318,"ratingValue":4.2},'
      . '{"@id":"#webpage","@type":"Thing","name":"Dropped before"}]';
    $template = $this->createTemplate(TRUE, ['schema' => ['custom' => '{"@type":"Person","author":"{field.field_byline}","name":"A"}']]);
    $suite = $this->createPage([
      'canvas_metatag' => Values::encode(['schema' => ['custom' => '[{"@id":"#c-suite","@type":"Thing","name":"Suite"},{"@type":"Review","itemReviewed":{"@id":"#c-suite"}}]']]),
      'path' => ['alias' => '/suite'],
    ]);
    $node = Node::create(['type' => 'article', 'title' => 'Hello', 'field_byline' => 'Mia Virtanen', 'status' => TRUE]);
    $node->save();
    $page = $this->createPage(['canvas_metatag' => Values::encode(['schema' => ['custom' => $legacy]])]);
    $big = $this->createPage([
      'canvas_metatag' => Values::encode(['schema' => ['custom' => '{"@type":"Thing","name":"' . str_repeat('x', Values::CUSTOM_RAW_MAX) . '"}']]),
      'path' => ['alias' => '/big'],
    ]);
    // About 30 KB minified, over 64 KB once indented: stays minified.
    $dense = json_encode(['@type' => 'Thing', 'name' => 'Dense', 'a' => [[array_fill(0, 15000, 1)]]]);
    $packed = $this->createPage([
      'canvas_metatag' => Values::encode(['schema' => ['custom' => $dense]]),
      'path' => ['alias' => '/dense'],
    ]);
    // A number stored before validation: listed, left as it is.
    $huge = $this->createPage([
      'canvas_metatag' => Values::encode(['schema' => ['custom' => '{"@type":"Rating","ratingValue":1e400}']]),
      'path' => ['alias' => '/huge'],
    ]);
    $pages = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID);
    $graph = fn (mixed $entity): array => $this->resolver()->resolve($entity)['head']['script'][0]['textContent'];
    $before = [
      $graph(Page::load($page->id())),
      $graph(Node::load($node->id())),
      $graph(Page::load($packed->id())),
      $graph(Page::load($suite->id())),
    ];

    \Drupal::moduleHandler()->loadInclude('canvas_metatag', 'php', 'canvas_metatag.post_update');
    $output = canvas_metatag_post_update_own_jsonld_as_written();
    $pages->resetCache();
    $this->container->get('entity_type.manager')->getStorage('node')->resetCache();
    $after = [
      $graph($pages->load($page->id())),
      $graph(Node::load($node->id())),
      $graph($pages->load($packed->id())),
      $graph($pages->load($suite->id())),
    ];
    self::assertSame($before, $after);
    $suite_items = json_decode(Values::decode($pages->load($suite->id())->get('canvas_metatag')->value)['schema']['custom'], TRUE);
    self::assertSame(['@id' => '#item-c-suite'], $suite_items[1]['itemReviewed']);
    self::assertSame($dense, Values::decode($pages->load($packed->id())->get('canvas_metatag')->value)['schema']['custom']);
    self::assertStringContainsString('1e400', Values::decode($pages->load($huge->id())->get('canvas_metatag')->value)['schema']['custom']);

    $stored = Values::decode($pages->load($page->id())->get('canvas_metatag')->value)['schema'];
    $items = json_decode($stored['custom'], TRUE);
    self::assertSame(['#identity-2', '#rating', '#webpage-2'], array_column($items, '@id'));
    self::assertSame(['@id' => '#identity-2'], $items[1]['itemReviewed']);
    self::assertSame(['#webpage-2'], $stored['skip']);
    self::assertStringStartsWith("[\n  {\n    \"@id\": \"#identity-2\"", $stored['custom']);
    $template = ContentTemplate::load($template->id());
    \assert($template instanceof ContentTemplate);
    self::assertSame("{\n  \"@type\": \"Person\",\n  \"author\": \"{field.field_byline}\",\n  \"name\": \"A\"\n}", $template->getThirdPartySetting('canvas_metatag', 'values')['schema']['custom']);
    // Over 64 KB as written: listed, and left as it is.
    self::assertStringContainsString('"name":"xxx', Values::decode($pages->load($big->id())->get('canvas_metatag')->value)['schema']['custom']);
    self::assertSame(implode("\n", [
      'Hand-added JSON-LD is stored as written in 3 places.',
      'template node.article.full: {field.field_byline} is now filled from its field',
      "page {$suite->id()} (en): #c-suite is now #item-c-suite",
      "page {$page->id()} (en): #identity is now #identity-2",
      "page {$page->id()} (en): #webpage is now #webpage-2, left out as before",
      "page {$big->id()} (en): over 64 KB as written, left as it is",
      "page {$huge->id()} (en): has a value that can't be written out, left as it is",
    ]), $output);
    // Run again: nothing to change.
    self::assertSame(implode("\n", [
      'Hand-added JSON-LD is stored as written in 0 places.',
      "page {$big->id()} (en): over 64 KB as written, left as it is",
      "page {$huge->id()} (en): has a value that can't be written out, left as it is",
    ]), canvas_metatag_post_update_own_jsonld_as_written());
  }

  /**
   * A hand-added "#breadcrumb" keeps its output under a new name.
   *
   * Text with nothing to rename, a template's, its draft's or a page
   * draft's, stays exactly as the editor wrote it.
   */
  public function testReserveBreadcrumb(): void {
    $auto_save = $this->container->get(AutoSaveManager::class);
    $this->setUpCurrentUser();
    $mine = '[{"@id":"#breadcrumb","@type":"BreadcrumbList","name":"Mine"},{"@id":"#about","@type":"Thing","subjectOf":{"@id":"#breadcrumb"}}]';
    $page = $this->createPage(['canvas_metatag' => Values::encode(['schema' => ['custom' => $mine]])]);
    $other = $this->createPage(['path' => ['alias' => '/other']]);
    $pages = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID);
    $compact = static fn (string $name): array => ['schema' => ['custom' => '{"@type":"Person","author":"{field.field_byline}","name":"' . $name . '"}']];
    $template = $this->createTemplate(TRUE, $compact('Template'));
    $template_draft = clone $template;
    $template_draft->setThirdPartySetting('canvas_metatag', 'values', $compact('Template draft'));
    $auto_save->saveEntity($template_draft, self::CLIENT);
    $page_draft = clone $pages->load($other->id());
    $page_draft->set('canvas_metatag', Values::encode($compact('Page draft')));
    $auto_save->saveEntity($page_draft, self::CLIENT);
    $unchanged = function () use ($auto_save, $pages, $template, $other, $compact): void {
      $stored = ContentTemplate::load($template->id());
      \assert($stored instanceof ContentTemplate);
      self::assertSame($compact('Template'), $stored->getThirdPartySetting('canvas_metatag', 'values'));
      $entity = $auto_save->getAutoSaveEntity($stored, TRUE)->entity;
      \assert($entity instanceof ContentTemplate);
      self::assertSame($compact('Template draft'), $entity->getThirdPartySetting('canvas_metatag', 'values'));
      $pages->resetCache();
      self::assertSame($compact('Page draft'), Values::decode($auto_save->getAutoSaveEntity($pages->load($other->id()), TRUE)->entity->get('canvas_metatag')->value));
    };
    $graph = fn (): array => $this->resolver()->resolve($pages->load($page->id()))['head']['script'][0]['textContent'];
    $before = $graph();
    self::assertContains('Mine', array_column($before['@graph'], 'name'));

    \Drupal::moduleHandler()->loadInclude('canvas_metatag', 'php', 'canvas_metatag.post_update');
    self::assertSame(implode("\n", [
      'Hand-added JSON-LD changed in one place.',
      "page {$page->id()} (en): #breadcrumb is now #breadcrumb-2",
    ]), canvas_metatag_post_update_reserve_breadcrumb());
    $pages->resetCache();
    self::assertSame($before, $graph());
    $items = json_decode(Values::decode($pages->load($page->id())->get('canvas_metatag')->value)['schema']['custom'], TRUE);
    self::assertSame('#breadcrumb-2', $items[0]['@id']);
    self::assertSame(['@id' => '#breadcrumb-2'], $items[1]['subjectOf']);
    self::assertNull($pages->load($other->id())->get('canvas_metatag')->value);
    $unchanged();
    // Run again: nothing to change.
    self::assertSame('Hand-added JSON-LD changed in 0 places.', canvas_metatag_post_update_reserve_breadcrumb());
    $unchanged();
  }

  /**
   * A conversion that fails leaves the template and its draft in place.
   *
   * Saving a template deletes its draft, so nothing is saved before both are
   * converted: the update fails, and it can run again with nothing lost.
   */
  public function testFailureKeepsTheDraft(): void {
    $auto_save = $this->container->get(AutoSaveManager::class);
    $config = $this->container->get('config.storage');
    $this->setUpCurrentUser();
    $template = $this->createTemplate(TRUE, []);
    // The stored values need no source: the first formatted text with a
    // summary is the Description fact.
    $raw = $config->read('canvas.content_template.' . $template->id());
    $raw['third_party_settings']['canvas_metatag']['values'] = ['description' => '{field.field_body}'];
    $config->write('canvas.content_template.' . $template->id(), $raw);
    $this->container->get('config.factory')->reset('canvas.content_template.' . $template->id());
    $this->container->get('entity_type.manager')->getStorage('content_template')->resetCache([$template->id()]);
    $template = ContentTemplate::load($template->id());
    \assert($template instanceof ContentTemplate);
    // Only the draft names a field that needs Canvas's suggestions.
    $draft = clone $template;
    $draft->setThirdPartySetting('canvas_metatag', 'values', ['description' => '{field.field_summary}']);
    $auto_save->saveEntity($draft, self::CLIENT);
    $store = $this->container->get('keyvalue')->get(AutoSaveManager::AUTO_SAVE_STORE);
    $key = AutoSaveManager::getAutoSaveKey($draft);
    $before = $store->get($key);
    self::assertIsArray($before);

    // Canvas cannot suggest sources for the bundle.
    $display = $this->createMock(EntityDisplayRepositoryInterface::class);
    $display->method('getFormDisplay')->willThrowException(new \LogicException('A field Canvas knows of is gone.'));
    $this->container->set('entity_display.repository', $display);
    foreach (['cache.default', 'cache.memory'] as $bin) {
      $this->container->set($bin, new UpdateBackend($this->container->get($bin)));
    }
    $this->container->set(PropSourceSuggester::class, NULL);
    $this->container->set(Sources::class, NULL);
    \Drupal::moduleHandler()->loadInclude('canvas_metatag', 'php', 'canvas_metatag.post_update');
    $sandbox = [];
    try {
      canvas_metatag_post_update_values_as_parts($sandbox);
      self::fail('The update did not fail.');
    }
    catch (\LogicException $e) {
      self::assertSame('A field Canvas knows of is gone.', $e->getMessage());
    }
    // Neither the template nor its draft changed.
    self::assertSame($before, $store->get($key));
    $this->container->get('entity_type.manager')->getStorage('content_template')->resetCache([$template->id()]);
    self::assertSame(['description' => '{field.field_body}'], ContentTemplate::load($template->id())?->getThirdPartySetting('canvas_metatag', 'values'));
  }

}
