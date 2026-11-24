<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\PageVariantResolver;
use Drupal\canvas\ShapeMatcher\PropSourceSuggester;
use Drupal\canvas\Storage\ComponentTreeLoader;
use Drupal\canvas_metatag\Sources;
use Drupal\Core\Entity\EntityDisplayRepositoryInterface;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Update\UpdateBackend;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\node\Entity\Node;
use Drupal\taxonomy\Entity\Term;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\user\Entity\Role;
use Drupal\user\Entity\User;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Pins the Canvas internals the module persists and evaluates.
 *
 * Canvas's entity-field prop source grammar is stored in template
 * configuration; its suggester gives the link menu, its evaluator the values.
 * The `phpunit (canvas dev)` CI job runs this group against Canvas's
 * development branch.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Sources::class)]
#[Group('canvas_metatag')]
#[Group('canvas_metatag_canvas_contract')]
final class SourcesTest extends CanvasKernelTestBase {

  use GenerateComponentConfigTrait;
  use SeoFixtureTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'text',
    'datetime',
    'link',
    'options',
    'taxonomy',
    // Refuses `view` on a field named field_no_view_access.
    'entity_test',
    'field_test',
    'canvas_metatag',
  ];

  /**
   * The expressions of the Article fields, as Canvas writes them.
   */
  private const ARTICLE = 'ℹ︎␜entity:node:article␝';

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->installEntitySchema('taxonomy_term');
    $this->createArticleFields();
    $this->generateComponentConfig();
  }

  /**
   * What the link menu offers, in the order of the form.
   */
  public function testVocabulary(): void {
    $sources = $this->container->get(Sources::class);
    $rows = $sources->vocabulary('article');
    $labels = array_column($rows, 'label');
    // The fields of the form first, by its weights; a reference's fields
    // follow it as a level. Facts are not fields: the title, the owner and
    // the dates are offered as facts only.
    foreach (['Title', 'Authored by › Name', 'Authored on', 'Changed'] as $fact) {
      self::assertNotContains($fact, $labels);
    }
    self::assertSame([], array_filter($labels, static fn (string $label): bool => str_contains($label, 'Revision') || str_contains($label, 'Authored by')));
    $order = array_values(array_unique(array_column($rows, 'field')));
    self::assertSame([
      'field_summary',
      'field_byline',
      'field_body',
      'field_writer',
      'field_tags',
      'field_hero',
      'field_when',
      'field_more',
      'field_price',
      'field_no_view_access',
    ], $order);

    $row = static fn (string $label): array => array_values(array_filter($rows, static fn (array $one): bool => $one['label'] === $label))[0] ?? [];
    // A formatted text with a summary is its text and its summary, read as
    // stored, never as filters render it.
    // Its markup too, for a job description.
    self::assertSame(['text', 'html'], $row('Body')['kinds']);
    self::assertTrue($row('Body')['html']);
    self::assertArrayHasKey(self::ARTICLE . 'field_body␞␟value', $rows);
    self::assertArrayHasKey(self::ARTICLE . 'field_body␞␟summary', $rows);
    self::assertSame('Body › Summary', $rows[self::ARTICLE . 'field_body␞␟summary']['label']);
    // A reference is a level: its path, without the entity type hop.
    self::assertSame(['Writer', 'Title'], $row('Writer › Title')['path']);
    self::assertTrue($row('Writer › Title')['hop']);
    self::assertSame('field_writer', $row('Writer › Title')['field']);
    // A reference's own name also gives what it references.
    self::assertSame(['text', 'ref'], $row('Writer › Title')['kinds']);
    self::assertArrayNotHasKey('many', $row('Writer › Title'));
    // Several tags: a list, of which a text takes the first and a list
    // property every one. A term is no page: no reference.
    self::assertSame(['text'], $row('Tags › Name')['kinds']);
    self::assertTrue($row('Tags › Name')['many']);
    self::assertArrayNotHasKey('many', $row('Summary'));
    // One long plain text gives its lines to a list; a short one does not.
    self::assertTrue($row('Summary')['lines']);
    self::assertArrayNotHasKey('lines', $row('Byline'));
    // A whole text field named for a value says so; a formatted text with a
    // summary, a part or a field through a reference never is.
    self::assertSame(['description'], $row('Summary')['named']);
    self::assertArrayNotHasKey('named', $row('Byline'));
    self::assertArrayNotHasKey('named', $row('Body'));
    self::assertArrayNotHasKey('named', $rows[self::ARTICLE . 'field_body␞␟summary']);
    self::assertArrayNotHasKey('named', $row('Writer › Title'));
    // Dates, addresses, numbers; a decimal keeps its digits.
    self::assertSame(['date'], $row('When')['kinds']);
    self::assertSame(['address'], $row('More')['kinds']);
    // Every row gives one kind: the dialog previews a row by its first kind
    // (Resolver::sourceRows()), so a row of two would preview in one place
    // what the head does not output. A Canvas match that gives two fails
    // here. Formatted text's markup and a reference's target come beside
    // its text, which is what it previews.
    self::assertSame([], array_keys(array_filter($rows, static fn (array $one): bool => count(array_diff($one['kinds'], [
      'html',
      'ref',
    ])) !== 1 || ($one['kinds'] !== array_diff($one['kinds'], ['html', 'ref']) && $one['kinds'][0] !== 'text'))));
    self::assertSame(['number'], $rows[self::ARTICLE . 'field_price␞␟value']['kinds']);
    // The decimal contract: the row is the module's own, read as digits.
    // The day Canvas matches a decimal itself, its row comes first, not
    // marked as the module's, and this fails: the module's decimal rows can
    // then go.
    self::assertTrue($rows[self::ARTICLE . 'field_price␞␟value']['decimal']);
    // An image object is read through its file, byte for byte.
    self::assertSame(['image'], $rows[self::ARTICLE . 'field_hero␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}']['kinds']);
    self::assertSame(['Hero', 'Image'], $rows[self::ARTICLE . 'field_hero␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}']['path']);
    // No file address is a page address.
    self::assertSame([], array_filter(array_keys($rows), static fn (string $expression): bool => in_array('address', $rows[$expression]['kinds'], TRUE) && str_contains($expression, 'entity:file')));
    // No computed address: it keeps what the first account to read it saw.
    // A link is offered once, through its address as stored.
    self::assertSame([], array_filter(array_keys($rows), static fn (string $expression): bool => str_ends_with($expression, '␞␟url')));
    self::assertSame(['More'], array_column(array_filter($rows, static fn (array $one): bool => $one['field'] === 'field_more' && in_array('address', $one['kinds'], TRUE)), 'label'));

    // Cached per bundle and language; a second call does not suggest again.
    $cid = 'canvas_metatag:sources:node:article:en';
    self::assertNotFalse($this->container->get('cache.default')->get($cid));
    self::assertSame($rows, $sources->vocabulary('article'));
    // A field added to the type clears it.
    $this->createField('field_extra', 'string', 'Extra');
    self::assertFalse($this->container->get('cache.default')->get($cid));
    // Canvas keeps its matches for the rest of the request.
    $this->container->get('cache.static')->deleteAll();
    self::assertContains('Extra', array_column($sources->vocabulary('article'), 'label'));
  }

  /**
   * When Canvas cannot suggest: links read as broken, an update stops.
   */
  public function testSuggesterFailure(): void {
    $c = $this->container;
    $display = $this->createMock(EntityDisplayRepositoryInterface::class);
    // Asked once, then the failure is kept; an update asks again.
    $display->expects(self::exactly(2))->method('getFormDisplay')->willThrowException(new \LogicException('A field Canvas knows of is gone.'));
    // Canvas's own suggester, its form display repository replaced.
    $real = $c->get(PropSourceSuggester::class);
    $arguments = [];
    foreach ((new \ReflectionClass($real))->getConstructor()->getParameters() as $parameter) {
      $arguments[] = $parameter->getName() === 'entityDisplayRepository' ? $display : (new \ReflectionProperty($real, $parameter->getName()))->getValue($real);
    }
    $suggester = new PropSourceSuggester(...$arguments);
    // The memory bin as drush updb builds it: an update backend, which keeps
    // nothing.
    $sources = new Sources(
      $suggester,
      $c->get('entity_field.manager'),
      $c->get('entity_type.manager'),
      $c->get('language_manager'),
      $c->get('account_switcher'),
      $c->get('config.factory'),
      $c->get('cache.default'),
      new UpdateBackend($c->get('cache.memory')),
      $c->get('datetime.time'),
      $c->getParameter('app.root'),
      $c->get('logger.factory'),
      $c->get(ComponentTreeLoader::class),
      $c->get(PageVariantResolver::class),
      $c->get(AutoSaveManager::class),
    );
    self::assertSame([], $sources->vocabulary('article'));
    self::assertSame([], $sources->vocabulary('article'));
    self::assertNull($sources->sourceFor('article', 'field_summary', 'text'));
    // A head built meanwhile uses defaults only until the next try.
    $node = Node::create(['type' => 'article', 'title' => 'Hello', 'status' => 1, 'field_summary' => 'Kept.']);
    $node->save();
    $cacheability = new CacheableMetadata();
    $summary = ['expression' => self::ARTICLE . 'field_summary␞␟value', 'sourceType' => 'entity-field'];
    self::assertSame(['broken', NULL], $sources->evaluate($summary, $node, 'text', $cacheability));
    self::assertGreaterThan(0, $cacheability->getCacheMaxAge());
    self::assertLessThanOrEqual(300, $cacheability->getCacheMaxAge());
    // An update converting links fails, so that it can run again.
    $this->expectExceptionMessage('A field Canvas knows of is gone.');
    $sources->sourceFor('article', 'field_summary', 'text', TRUE);
  }

  /**
   * A round trip and a value per field type, and every status.
   */
  public function testEvaluate(): void {
    $sources = $this->container->get(Sources::class);
    $writer = Node::create(['type' => 'person', 'title' => 'Ada', 'status' => 1]);
    $writer->save();
    $first = Term::create(['vid' => 'tags', 'name' => 'AI']);
    $first->save();
    $second = Term::create(['vid' => 'tags', 'name' => 'Writing']);
    $second->save();
    $hero = $this->createImage('Hero', ['alt' => 'A waving hand', 'width' => 800, 'height' => 400]);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'status' => 1,
      'uid' => $this->author->id(),
      'field_summary' => 'How teams turn output into stories.',
      'field_byline' => '{site}',
      'field_body' => [
        'value' => '<h2>Made to last</h2><p>Solid oak.</p>',
        'summary' => 'Short <b>and</b> sweet.',
        'format' => 'plain_text',
      ],
      'field_writer' => $writer->id(),
      'field_tags' => [$first->id(), $second->id()],
      'field_hero' => $hero->id(),
      'field_when' => '2026-07-01T16:00:00',
      'field_more' => ['uri' => 'internal:/pricing'],
      'field_price' => '49.90',
      'field_no_view_access' => 'Not for visitors',
    ]);
    $node->save();

    $evaluate = function (string $path, string $kind, ?CacheableMetadata $cacheability = NULL) use ($sources, &$node): array {
      $source = ['expression' => self::ARTICLE . $path, 'sourceType' => 'entity-field'];
      return $sources->evaluate($source, $node, $kind, $cacheability ?? new CacheableMetadata());
    };
    $cacheability = new CacheableMetadata();
    self::assertSame(['ok', 'How teams turn output into stories.'], $evaluate('field_summary␞␟value', 'text', $cacheability));
    // A value that looks like a name is literal text.
    self::assertSame(['ok', '{site}'], $evaluate('field_byline␞␟value', 'text'));
    self::assertSame(['ok', 'Made to last. Solid oak.'], $evaluate('field_body␞␟value', 'text'));
    self::assertSame(['ok', 'Short and sweet.'], $evaluate('field_body␞␟summary', 'text'));
    self::assertSame(['ok', 'Ada'], $evaluate('field_writer␞␟entity␜␜entity:node␝title␞␟value', 'text'));
    self::assertSame(['ok', 'AI'], $evaluate('field_tags␞␟entity␜␜entity:taxonomy_term␝name␞␟value', 'text'));
    self::assertSame(['ok', '2026-07-01T19:00:00+03:00'], $evaluate('field_when␞␟value', 'date'));
    // A decimal is its exact digits, without trailing zeros.
    self::assertSame(['ok', '49.9'], $evaluate('field_price␞␟value', 'number'));
    // A list property: every tag, in order; one formatted text, its items.
    $list = static fn (string $path, string $kind = 'text'): array => $sources->evaluate([
      'expression' => self::ARTICLE . $path,
      'sourceType' => 'entity-field',
    ], $node, $kind, new CacheableMetadata(), TRUE);
    self::assertSame(['ok', ['AI', 'Writing']], $list('field_tags␞␟entity␜␜entity:taxonomy_term␝name␞␟value'));
    // Its paragraphs, when it has no list items: a heading is no item.
    self::assertSame(['ok', ['Solid oak.']], $list('field_body␞␟value'));
    self::assertSame(['ok', ['{site}']], $list('field_byline␞␟value'));
    // One long plain text gives its lines.
    $node->set('field_summary', "Mix\n\nBake\r\n")->save();
    self::assertSame(['ok', ['Mix', 'Bake']], $list('field_summary␞␟value'));
    // Text that is not valid UTF-8 gives nothing, never an error.
    $node->set('field_summary', "Mix\xC3\x28\nBake")->save();
    self::assertSame(['empty', []], $list('field_summary␞␟value'));
    $node->set('field_summary', 'How teams turn output into stories.')->save();
    // In words, the form of a place that composes: a date and a decimal fit
    // and give their machine values with how to read them, every item of a
    // field of several values comes, an address and an image do not fit.
    self::assertSame(['ok', ['items' => ['2026-07-01T19:00:00+03:00'], 'as' => 'date', 'scale' => 0]], $evaluate('field_when␞␟value', 'words'));
    self::assertSame(['ok', ['items' => ['49.9'], 'as' => 'decimal', 'scale' => 2]], $evaluate('field_price␞␟value', 'words'));
    self::assertSame(['ok', ['items' => ['AI', 'Writing'], 'as' => 'text', 'scale' => 0]], $evaluate('field_tags␞␟entity␜␜entity:taxonomy_term␝name␞␟value', 'words'));
    self::assertSame(['ok', ['items' => ['<h2>Made to last</h2><p>Solid oak.</p>'], 'as' => 'html', 'scale' => 0]], $evaluate('field_body␞␟value', 'words'));
    self::assertSame(['broken', NULL], $evaluate('field_more␞␟uri', 'words'));
    self::assertSame(['broken', NULL], $evaluate('field_hero␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}', 'words'));
    $source = static fn (string $path): array => ['expression' => self::ARTICLE . $path, 'sourceType' => 'entity-field'];
    // A part of a title takes no formatted text; a description does.
    self::assertFalse($sources->accepts('article', $source('field_body␞␟value'), 'line'));
    self::assertTrue($sources->accepts('article', $source('field_body␞␟value'), 'words'));
    self::assertTrue($sources->accepts('article', $source('field_when␞␟value'), 'line'));
    self::assertSame($source('field_when␞␟value'), $sources->sourceFor('article', 'field_when', 'words'));
    // How Canvas offers a timestamp through a reference: Writer › Authored
    // on is a number that is a point in time, read as a date in words.
    $rows = $sources->vocabulary('article');
    $authored = self::ARTICLE . 'field_writer␞␟entity␜␜entity:node␝created␞␟value';
    // Canvas may stop offering the hop: the run then ends incomplete, named,
    // never green with the pin skipped.
    $hop = isset($rows[$authored]);
    if ($hop) {
      self::assertContains('number', $rows[$authored]['kinds']);
      self::assertTrue($rows[$authored]['timestamp'] ?? FALSE);
      [$status, $read] = $evaluate('field_writer␞␟entity␜␜entity:node␝created␞␟value', 'words');
      self::assertSame(['ok', 'timestamp'], [$status, $read['as']]);
    }
    // A job description is the stored markup.
    self::assertSame(['ok', '<h2>Made to last</h2><p>Solid oak.</p>'], $evaluate('field_body␞␟value', 'html'));
    // A reference gives what it references.
    [$status, $targets] = $evaluate('field_writer␞␟entity␜␜entity:node␝title␞␟value', 'ref');
    self::assertSame('ok', $status);
    self::assertSame([(int) $writer->id()], array_map(static fn (Node $target): int => (int) $target->id(), $targets));
    [$status, $link] = $evaluate('field_more␞␟uri', 'address');
    self::assertSame(['ok', 'internal:/pricing'], [$status, $link]);
    [$status, $image] = $evaluate('field_hero␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}', 'image');
    self::assertSame('ok', $status);
    self::assertSame(['uri' => 'public://hero.png', 'alt' => 'A waving hand', 'width' => 800, 'height' => 400], $image);

    // Read as an anonymous visitor: tags and max-age only, never a user
    // context, and the anonymous role's tag.
    self::assertSame([], array_filter($cacheability->getCacheContexts(), static fn (string $context): bool => str_starts_with($context, 'user')));
    self::assertContains('config:user.role.anonymous', $cacheability->getCacheTags());
    self::assertContains('node:' . $node->id(), $cacheability->getCacheTags());

    // Hidden: a field, or a referenced entity, visitors may not view.
    $hidden = new CacheableMetadata();
    self::assertSame(['hidden', NULL], $evaluate('field_no_view_access␞␟value', 'text', $hidden));
    self::assertSame([], array_filter($hidden->getCacheContexts(), static fn (string $context): bool => str_starts_with($context, 'user')));
    $writer->setUnpublished()->save();
    $this->forgetAccess();
    $node = $this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($node->id());
    \assert($node instanceof Node);
    self::assertSame('hidden', $evaluate('field_writer␞␟entity␜␜entity:node␝title␞␟value', 'text')[0]);
    // The field gives its target all the same: Resolver::target() checks
    // it, and never names it (RefTargetsTest).
    [$status, $targets] = $evaluate('field_writer␞␟entity␜␜entity:node␝title␞␟value', 'ref');
    $ids = array_map(static fn (Node $target): int => (int) $target->id(), $targets);
    self::assertSame(['ok', [(int) $writer->id()]], [$status, $ids]);

    // Broken: another kind, a field that is gone, another bundle, a
    // malformed string. Never an exception.
    self::assertSame(['broken', NULL], $evaluate('field_summary␞␟value', 'date'));
    self::assertSame('broken', $sources->evaluate([
      'expression' => 'ℹ︎␜entity:node:page␝field_summary␞␟value',
      'sourceType' => 'entity-field',
    ], $node, 'text', new CacheableMetadata())[0]);
    self::assertSame('broken', $sources->evaluate(['expression' => 'nonsense', 'sourceType' => 'entity-field'], $node, 'text', new CacheableMetadata())[0]);
    self::assertSame('broken', $sources->evaluate([
      'expression' => self::ARTICLE . 'field_summary␞␟value',
      'sourceType' => 'static',
    ], $node, 'text', new CacheableMetadata())[0]);
    FieldConfig::loadByName('node', 'article', 'field_summary')?->delete();
    $this->container->get('cache.static')->deleteAll();
    self::assertSame('broken', $evaluate('field_summary␞␟value', 'text')[0]);
    self::assertSame('missing', $sources->problem('article', [
      'expression' => self::ARTICLE . 'field_summary␞␟value',
      'sourceType' => 'entity-field',
    ], 'text'));

    // A node visitors cannot view yet is read with the current user's access.
    $node = $this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($node->id());
    \assert($node instanceof Node);
    $node->setUnpublished()->save();
    $this->forgetAccess();
    $editor = User::create(['name' => 'Editor', 'status' => 1]);
    $editor->save();
    Role::create(['id' => 'editor', 'label' => 'Editor'])->grantPermission('access content')->grantPermission('view own unpublished content')->grantPermission('bypass node access')->save();
    $editor->addRole('editor')->save();
    $this->container->get('current_user')->setAccount($editor);
    $own = new CacheableMetadata();
    self::assertSame(['ok', '{site}'], $evaluate('field_byline␞␟value', 'text', $own));
    // Such a head is only ever shown to users who may view it: it varies.
    self::assertContains('user.permissions', $own->getCacheContexts());
    if (!$hop) {
      self::markTestIncomplete('Canvas no longer offers Writer › Authored on (a timestamp through a reference): the pin of how a timestamp hop reads as a date in words did not run.');
    }
  }

  /**
   * A whole value in hand-added JSON-LD is read through the same sources.
   */
  public function testWholeValueFieldInCustomJsonLd(): void {
    $this->createField('field_day', 'datetime', 'Day', ['datetime_type' => 'date']);
    $writer = Node::create(['type' => 'person', 'title' => 'Ada', 'status' => 1]);
    $writer->save();
    $hero = $this->createImage('Hero', ['alt' => 'A waving hand', 'width' => 800, 'height' => 400]);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'status' => 1,
      'uid' => $this->author->id(),
      'field_byline' => 'Mia Virtanen',
      'field_body' => ['value' => '<h2>Made to last</h2><p>Solid oak.</p>', 'format' => 'plain_text'],
      'field_writer' => $writer->id(),
      'field_hero' => $hero->id(),
      'field_when' => '2026-07-10T06:30:00',
      'field_price' => '4.50',
      'field_no_view_access' => 'Not for visitors',
      'field_day' => '2026-07-10',
      'field_more' => ['uri' => 'internal:/about'],
      'field_summary' => 'javascript:alert(1)',
    ]);
    $node->save();
    $this->createTemplate(TRUE, [
      'schema' => [
        'custom' => (string) json_encode([
          '@type' => 'Event',
          '@id' => '#event',
          'name' => '{field.field_byline}',
          'alternateName' => 'By {field.field_byline}',
          'startDate' => '{field.field_when}',
          'description' => '{field.field_body}',
          'image' => '{field.field_hero}',
          'performer' => ['@type' => 'Person', 'name' => '{field.field_writer.title}'],
          'offers' => ['@type' => 'Offer', 'price' => '{field.field_price}', 'description' => '{field.field_price}'],
          'about' => '{field.field_no_view_access}',
          'endDate' => '{field.field_day}',
          'thumbnailUrl' => '{media.' . $hero->uuid() . '}',
          'url' => '{field.field_more}',
          'sameAs' => '{field.field_summary}',
        ]),
      ],
    ]);
    $resolved = $this->resolver()->resolve($node);
    $event = end($resolved['head']['script'][0]['textContent']['@graph']);
    self::assertSame('Mia Virtanen', $event['name']);
    // Inside other text a field name stays as written.
    self::assertSame('By {field.field_byline}', $event['alternateName']);
    // In the site's zone, with its offset.
    self::assertSame('2026-07-10T09:30:00+03:00', $event['startDate']);
    self::assertSame('Made to last. Solid oak.', $event['description']);
    self::assertMatchesRegularExpression('~^https?://\S+\.(png|jpe?g|gif|webp)$~', $event['image']);
    self::assertSame(['@type' => 'Person', 'name' => 'Ada'], $event['performer']);
    // A number where the name expects one; the same field as text elsewhere.
    self::assertSame(4.5, $event['offers']['price']);
    self::assertSame('4.5', $event['offers']['description']);
    // Hidden from visitors: left out, and said.
    self::assertArrayNotHasKey('about', $event);
    // A date-only field gives the date.
    self::assertSame('2026-07-10', $event['endDate']);
    // A library image by its media item: the published image's absolute
    // public address.
    self::assertSame($event['image'], $event['thumbnailUrl']);
    // A link field where an address is expected: its absolute address.
    self::assertMatchesRegularExpression('~^https?://[^/]+/about$~', $event['url']);
    // Text that is not an address where one is expected is left out.
    self::assertArrayNotHasKey('sameAs', $event);
    self::assertSame([
      ['path' => 'about', 'item' => 0, 'name' => 'field.field_no_view_access', 'status' => 'hidden'],
      ['path' => 'sameAs', 'item' => 0, 'name' => 'field.field_summary', 'status' => 'broken'],
    ], $resolved['schema']['empty']);
  }

  /**
   * Writes take only what the menu offers, of the value's kind.
   */
  public function testAccepts(): void {
    $sources = $this->container->get(Sources::class);
    $summary = ['expression' => self::ARTICLE . 'field_summary␞␟value', 'sourceType' => 'entity-field'];
    self::assertTrue($sources->accepts('article', $summary, 'text'));
    self::assertFalse($sources->accepts('article', $summary, 'image'));
    self::assertFalse($sources->accepts('article', [
      'expression' => self::ARTICLE . 'uid␞␟entity␜␜entity:user␝mail␞␟value',
      'sourceType' => 'entity-field',
    ], 'text'));
    self::assertFalse($sources->accepts('article', $summary + ['adapter' => 'x'], 'text'));
    self::assertSame('kind', $sources->problem('article', $summary, 'date'));
    self::assertSame('error', $sources->problem('article', [
      'expression' => self::ARTICLE . 'field_summary␞␟nope',
      'sourceType' => 'entity-field',
    ], 'text'));
    self::assertSame('field_summary', Sources::machineName($summary));
    self::assertNull(Sources::machineName(['expression' => 'nonsense']));

    // The source a whole field gave before: one that stays on the host, else
    // the referenced entity's label.
    self::assertSame($summary, $sources->sourceFor('article', 'field_summary', 'text'));
    self::assertSame(self::ARTICLE . 'field_writer␞␟entity␜␜entity:node␝title␞␟value', $sources->sourceFor('article', 'field_writer', 'text')['expression']);
    self::assertNull($sources->sourceFor('article', 'field_when', 'text'));
    // A field with its storage gone gives none.
    FieldStorageConfig::loadByName('node', 'field_byline')?->delete();
    $this->container->get('cache.static')->deleteAll();
    self::assertNull($sources->sourceFor('article', 'field_byline', 'text'));
  }

}
