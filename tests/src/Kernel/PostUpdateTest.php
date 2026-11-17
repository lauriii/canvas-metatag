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
    // In the order of the config schema, as configuration stores it.
    self::assertSame([
      'title_end' => ['text' => 'Journal'],
      'description' => $summary,
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
    self::assertContains('node.article.full: social.title: uses its default; dropped typed text, {field.field_byline}.', $this->logged);
    self::assertContains('node.article.full: schema.custom: names a field, which custom JSON-LD no longer fills.', $this->logged);
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
    $this->logged = [];
    $sandbox = [];
    do {
      canvas_metatag_post_update_values_as_parts($sandbox);
    } while (($sandbox['#finished'] ?? 1) < 1);
    self::assertSame($before, [
      $this->config('canvas_metatag.site')->get('values'),
      ContentTemplate::load('node.article.full')?->getThirdPartySetting('canvas_metatag', 'values'),
    ]);
    self::assertSame(['node.article.full: schema.custom: names a field, which custom JSON-LD no longer fills.'], $this->logged);
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
