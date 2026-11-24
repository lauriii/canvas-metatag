<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas\Entity\PageRegion;
use Drupal\canvas\Entity\PageVariant;
use Drupal\canvas\Plugin\Canvas\ComponentSource\Marker;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_personalization\Entity\Segment;
use Drupal\Core\Cache\Cache;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Logger\RfcLoggerTrait;
use Drupal\Core\StreamWrapper\PrivateStream;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Psr\Log\LoggerInterface;

/**
 * Pins the Canvas internals the component reader relies on.
 *
 * Which component instances render on a page (ContentTemplate::build()'s
 * slot injection, the page variant), their versions, how their inputs are
 * evaluated, the image prop's shape and the personalization switch. The
 * `phpunit (canvas dev)` CI job runs this group against Canvas's development
 * branch.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Sources::class)]
#[Group('canvas_metatag')]
#[Group('canvas_metatag_canvas_contract')]
final class SourcesTreeTest extends CanvasKernelTestBase implements LoggerInterface {

  use GenerateComponentConfigTrait;
  use RfcLoggerTrait;
  use SeoFixtureTrait;
  use UserCreationTrait;

  private const HEADING = 'sdc.canvas_test_sdc.props-no-slots';

  /**
   * Instance UUIDs, one per role.
   */
  private const IN_SLOT = 'aaaaaaaa-0000-4000-8000-000000000001';
  private const BREADCRUMB = 'bbbbbbbb-0000-4000-8000-000000000001';
  private const ON_PAGE = 'dddddddd-0000-4000-8000-000000000001';
  private const OLD = 'eeeeeeee-0000-4000-8000-000000000001';
  private const NEW = 'eeeeeeee-0000-4000-8000-000000000002';
  private const LINKED = 'ffffffff-0000-4000-8000-000000000001';
  private const IMAGE = 'ffffffff-0000-4000-8000-000000000002';
  private const SWITCH = '99999999-0000-4000-8000-000000000001';
  private const DEFAULT_CASE = '99999999-0000-4000-8000-000000000002';
  private const WELCOME = '99999999-0000-4000-8000-000000000003';
  private const OTHER_CASE = '99999999-0000-4000-8000-000000000004';
  private const WELCOME_BACK = '99999999-0000-4000-8000-000000000005';
  private const BROKEN = '99999999-0000-4000-8000-000000000006';
  private const NO_VERSION = '77777777-0000-4000-8000-000000000001';
  private const IN_NO_VERSION = '77777777-0000-4000-8000-000000000002';
  private const NO_COMPONENT = '77777777-0000-4000-8000-000000000003';
  private const IN_NO_COMPONENT = '77777777-0000-4000-8000-000000000004';

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'canvas_personalization',
    // Canvas allows the personalization components only in development
    // mode, while their source is not a public API.
    'canvas_dev_mode',
    'node',
    'field',
    'options',
    'canvas_metatag',
    'canvas_metatag_count_test',
  ];

  /**
   * What was logged under canvas_metatag.
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
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    // Files visitors cannot get by their address.
    $container->register('stream_wrapper.private', PrivateStream::class)
      ->addTag('stream_wrapper', ['scheme' => 'private']);
  }

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $private = $this->siteDirectory . '/private';
    mkdir($private, 0775, TRUE);
    $this->setSetting('file_private_path', $private);
    $this->container->get('logger.factory')->addLogger($this);
    $this->setUpSite();
    $this->installConfig(['canvas_personalization']);
    // Canvas offers two variants for now: the default one and this one.
    Segment::create(['id' => 'halloween', 'label' => 'Halloween'])->save();
    $this->generateComponentConfig();
  }

  /**
   * The reader.
   */
  private function sources(): Sources {
    return $this->container->get(Sources::class);
  }

  /**
   * The instances that render on an entity's page, by UUID.
   *
   * @return array<string, array>
   *   UUID => instance, without the item and host objects.
   */
  private function read(ContentEntityInterface $entity, ?array &$skipped = NULL, ?CacheableMetadata $cacheability = NULL, bool $draft = FALSE): array {
    $tree = $this->sources()->tree($entity, $draft, $cacheability ?? new CacheableMetadata());
    [$instances, $skipped] = $this->sources()->instances($tree);
    $read = [];
    foreach ($instances as $instance) {
      $read[$instance['uuid']] = array_diff_key($instance, ['item' => TRUE, 'host' => TRUE, 'uuid' => TRUE]);
    }
    return $read;
  }

  /**
   * The values of one instance of an entity's page, the first by default.
   */
  private function props(ContentEntityInterface $entity, array $kinds, ?CacheableMetadata $cacheability = NULL, int $at = 0): array {
    [$instances] = $this->sources()->instances($this->sources()->tree($entity, FALSE, new CacheableMetadata()));
    return $this->container->get(Resolver::class)->parts($instances[$at], $kinds, $entity, $cacheability ?? new CacheableMetadata());
  }

  /**
   * The template, the item's own slot, a page's own tree and the chrome.
   */
  public function testTree(): void {
    $this->createSlotTemplate();
    $this->createChrome([self::breadcrumb(self::BREADCRUMB)]);
    $video = self::placed(self::IN_SLOT, self::HEADING, ['heading' => 'Watch'], self::SLOTTED, 'the_body');
    $one = Node::create(['type' => 'article', 'title' => 'One', 'status' => 1, 'field_canvas' => [$video]]);
    $one->save();
    $two = Node::create(['type' => 'article', 'title' => 'Two', 'status' => 1]);
    $two->save();

    $template = Component::load('sdc.canvas_test_sdc.props-slots');
    $read = $this->read($one);
    self::assertSame([
      'component' => 'sdc.canvas_test_sdc.props-slots',
      'label' => (string) $template->label(),
      'owner' => 'template',
      'version' => $template->getActiveVersion(),
    ], $read[self::SLOTTED]);
    // What the article placed in its own slot is its own.
    self::assertSame('item', $read[self::IN_SLOT]['owner']);
    self::assertSame('region', $read[self::BREADCRUMB]['owner']);
    self::assertArrayNotHasKey(self::IN_SLOT, $this->read($two));
    self::assertSame('template', $this->read($two)[self::SLOTTED]['owner']);
    // Canvas renders no disabled template: its components are read in its
    // preview only.
    $stored = ContentTemplate::load('node.article.full');
    $stored->setStatus(FALSE)->save();
    self::assertArrayNotHasKey(self::SLOTTED, $this->read($two));
    self::assertSame('template', $this->read($two, draft: TRUE)[self::SLOTTED]['owner']);
    $stored->setStatus(TRUE)->save();

    $page = $this->createPage(['components' => [self::placed(self::ON_PAGE, self::HEADING, ['heading' => 'Plans'])]]);
    $cacheability = new CacheableMetadata();
    $read = $this->read($page, $skipped, $cacheability);
    self::assertSame('page', $read[self::ON_PAGE]['owner']);
    self::assertSame('region', $read[self::BREADCRUMB]['owner']);
    self::assertSame([], $skipped);
    // Choosing another chrome rebuilds the head.
    self::assertContains('config:canvas.settings', $cacheability->getCacheTags());
    self::assertContains('config:canvas.page_variant.chrome', $cacheability->getCacheTags());

    // Without a page variant: the default theme's legacy regions.
    $this->config('canvas.settings')->set('default_page_variant', NULL)->save();
    self::assertSame([self::ON_PAGE], array_keys($this->read($page)));
  }

  /**
   * The page's chrome and the template: their drafts are read in previews.
   */
  public function testChrome(): void {
    $auto_save = $this->container->get(AutoSaveManager::class);
    $page = $this->createPage(['components' => [self::placed(self::ON_PAGE, self::HEADING, ['heading' => 'Plans'])]]);
    $labels = fn (ContentEntityInterface $entity): array => array_column($this->sources()->tree($entity, TRUE, new CacheableMetadata()), 'draft');

    // Without a page variant: the default theme's legacy regions.
    $this->config('system.theme')->set('default', 'stark')->save();
    PageRegion::create([
      'theme' => 'stark',
      'region' => 'sidebar_first',
      'component_tree' => [self::breadcrumb(self::BREADCRUMB)],
    ])->save();
    $cacheability = new CacheableMetadata();
    $read = $this->read($page, $skipped, $cacheability);
    self::assertSame([self::ON_PAGE, self::BREADCRUMB], array_keys($read));
    self::assertSame('region', $read[self::BREADCRUMB]['owner']);
    self::assertSame([], $skipped);
    // A region added, changed or removed rebuilds the head.
    self::assertSame([], array_diff($this->container->get('entity_type.manager')->getDefinition('page_region')->getListCacheTags(), $cacheability->getCacheTags()));
    self::assertContains('config:system.theme', $cacheability->getCacheTags());
    // A region's draft: read in previews only.
    $region = PageRegion::load('stark.sidebar_first');
    $region->setComponentTree([
      self::breadcrumb(self::BREADCRUMB),
      self::placed(self::NEW, self::HEADING, ['heading' => 'Region draft']),
    ]);
    $auto_save->saveEntity($region);
    self::assertArrayNotHasKey(self::NEW, $this->read($page));
    $cacheability = new CacheableMetadata();
    self::assertSame('region', $this->read($page, cacheability: $cacheability, draft: TRUE)[self::NEW]['owner']);
    self::assertSame([], array_diff($auto_save->getAutoSaveEntity($region)->getCacheTags(), $cacheability->getCacheTags()));
    self::assertSame(['', (string) $region->label()], $labels($page));

    // A page variant: its draft is read in previews only, and a change to
    // the draft rebuilds the preview.
    $this->createChrome();
    $variant = PageVariant::load('chrome');
    $variant->setComponentTree([
      self::placed(self::OLD, self::HEADING, ['heading' => 'Variant draft']),
      self::placed('cccccccc-0000-4000-8000-000000000001', Marker::PAGE_CONTENT_COMPONENT_ID),
    ]);
    $auto_save->saveEntity($variant);
    self::assertArrayNotHasKey(self::OLD, $this->read($page));
    $cacheability = new CacheableMetadata();
    self::assertSame('region', $this->read($page, cacheability: $cacheability, draft: TRUE)[self::OLD]['owner']);
    self::assertSame([], array_diff($auto_save->getAutoSaveEntity($variant)->getCacheTags(), $cacheability->getCacheTags()));
    self::assertSame(['', 'Chrome'], $labels($page));

    // The template's draft, in its preview only.
    $template = $this->createSlotTemplate();
    $article = Node::create(['type' => 'article', 'title' => 'One', 'status' => 1]);
    $article->save();
    $template->setComponentTree([
      self::placed(self::SLOTTED, 'sdc.canvas_test_sdc.props-slots', ['heading' => 'Template draft']),
      self::placed(self::LINKED, self::HEADING, ['heading' => 'Added in the draft']),
    ]);
    $auto_save->saveEntity($template);
    self::assertArrayNotHasKey(self::LINKED, $this->read($article));
    $cacheability = new CacheableMetadata();
    self::assertSame('template', $this->read($article, cacheability: $cacheability, draft: TRUE)[self::LINKED]['owner']);
    self::assertSame([], array_diff($auto_save->getAutoSaveEntity($template)->getCacheTags(), $cacheability->getCacheTags()));
    self::assertSame([(string) $template->label(), 'Chrome'], $labels($article));
  }

  /**
   * Each instance is read against the version it was placed with.
   */
  public function testVersions(): void {
    $active = Component::load(self::HEADING)->getActiveVersion();
    // Version 1 named the prop `price`; the active version renamed it.
    $this->addOlderVersion(self::HEADING, '0000000000000001', 'heading', 'price');
    $old = $this->createPage(['components' => [self::placed(self::OLD, self::HEADING, ['heading' => '€10 a month'])]]);
    $this->storeInstance($old, self::OLD, [
      'component_version' => '0000000000000001',
      'inputs' => '{"price":"€10 a month"}',
    ]);
    $old = Page::load($old->id());
    $new = $this->createPage([
      'title' => 'Plans',
      'path' => ['alias' => '/plans'],
      'components' => [self::placed(self::NEW, self::HEADING, ['heading' => '€12 a month'])],
    ]);

    [$values, $skipped] = $this->props($old, ['price' => 'text']);
    self::assertSame(['price' => ['ok', '€10 a month']], $values);
    self::assertSame([], $skipped);
    // Read without loading the older version: the component every page
    // renders with is left on its active version.
    self::assertSame($active, Component::load(self::HEADING)->getLoadedVersion());
    [$values, $skipped] = $this->props($new, ['price' => 'text', 'heading' => 'text']);
    self::assertSame(['heading' => ['ok', '€12 a month']], $values);
    self::assertSame([
      [
        'uuid' => self::NEW,
        'component' => self::HEADING,
        'label' => (string) Component::load(self::HEADING)->label(),
        'owner' => 'page',
        'reason' => 'prop-missing',
        'prop' => 'price',
        'version' => $active,
      ],
    ], $skipped);
  }

  /**
   * Values as visitors see them; images through their file.
   */
  public function testValues(): void {
    NodeType::create(['type' => 'person', 'name' => 'Person'])->save();
    $this->createField('field_writer', 'entity_reference', 'Writer', ['target_type' => 'node'], [
      'handler' => 'default:node',
      'handler_settings' => ['target_bundles' => ['person' => 'person']],
    ]);
    $writer = Node::create(['type' => 'person', 'title' => 'Ada', 'status' => 0]);
    $writer->save();
    $linked = ['heading' => $this->linkTo('Writer › Title')['source']];
    ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => 'article',
      'content_entity_type_view_mode' => 'full',
      'component_tree' => [self::placed(self::LINKED, self::HEADING, $linked)],
      'status' => TRUE,
    ])->save();
    $article = Node::create(['type' => 'article', 'title' => 'Story', 'status' => 1, 'field_writer' => $writer]);
    $article->save();

    // An unpublished writer gives nothing on a public article, even to an
    // editor who may see it.
    $this->setUpCurrentUser([], ['access content', 'bypass node access', 'view media']);
    [$values, $skipped] = $this->props($article, ['heading' => 'text']);
    self::assertSame(['heading' => ['hidden', NULL]], $values);
    $skipped = array_diff_key($skipped[0], ['component' => TRUE, 'label' => TRUE, 'owner' => TRUE]);
    self::assertSame(['uuid' => self::LINKED, 'reason' => 'access', 'prop' => 'heading'], $skipped);
    $writer->setPublished()->save();
    $this->forgetAccess();
    self::assertSame(['heading' => ['ok', 'Ada']], $this->props($article, ['heading' => 'text'])[0]);

    // An image: the file's own address on the public base, with its size.
    $hero = $this->createImage('Hero', ['alt' => 'A lamp', 'width' => 1600, 'height' => 900]);
    $page = $this->createPage([
      'components' => [self::placed(self::IMAGE, 'sdc.canvas_test_sdc.image', ['image' => ['target_id' => $hero->id()]])],
    ]);
    $cacheability = new CacheableMetadata();
    [$values, $skipped] = $this->props($page, ['image' => 'image'], $cacheability);
    self::assertSame([], $skipped);
    self::assertSame('ok', $values['image'][0]);
    $image = array_intersect_key($values['image'][1], array_flip(['url', 'width', 'height', 'alt']));
    self::assertSame(['url' => $this->imageOf($hero)['url'], 'width' => 1600, 'height' => 900, 'alt' => 'A lamp'], $image);
    self::assertStringNotContainsString('?', $image['url']);
    self::assertContains('media:' . $hero->id(), $cacheability->getCacheTags());
    // Visitors may not see it: no image.
    $hero->setUnpublished()->save();
    $this->forgetAccess();
    self::assertSame(['image' => ['hidden', NULL]], $this->props($page, ['image' => 'image'])[0]);
    // A file visitors cannot get by its address: no image either.
    $private = $this->createImage('Plan', ['alt' => 'Floor plan'], [], 'private');
    $plan = $this->createPage([
      'title' => 'Plan',
      'path' => ['alias' => '/plan'],
      'components' => [self::placed(self::IMAGE, 'sdc.canvas_test_sdc.image', ['image' => ['target_id' => $private->id()]])],
    ]);
    self::assertNotSame('ok', $this->props($plan, ['image' => 'image'])[0]['image'][0] ?? NULL);
  }

  /**
   * What cannot be read, or would vary by user, is left out and reported.
   */
  public function testGuards(): void {
    $default = ['variant_id' => 'default', 'segments' => [Segment::DEFAULT_ID]];
    $other = ['variant_id' => 'halloween', 'segments' => ['halloween']];
    $page = $this->createPage([
      'components' => [
        self::placed(self::SWITCH, 'p13n.switch', ['variants' => ['default', 'halloween']]),
        self::placed(self::DEFAULT_CASE, 'p13n.case', $default, self::SWITCH, 'content'),
        self::placed(self::WELCOME, self::HEADING, ['heading' => 'Welcome'], self::DEFAULT_CASE, 'content'),
        self::placed(self::OTHER_CASE, 'p13n.case', $other, self::SWITCH, 'content'),
        self::placed(self::WELCOME_BACK, self::HEADING, ['heading' => 'Welcome back'], self::OTHER_CASE, 'content'),
        self::placed(self::BROKEN, self::HEADING, ['heading' => 'Broken']),
      ],
    ]);
    // Required inputs it lost: Canvas renders it as broken.
    $this->storeInstance($page, self::BROKEN, ['inputs' => '{}']);
    $page = Page::load($page->id());
    $read = $this->read($page, $skipped);
    // Only the default case, and what is inside it.
    self::assertSame([self::SWITCH, self::DEFAULT_CASE, self::WELCOME, self::BROKEN], array_keys($read));
    self::assertSame([
      [
        'uuid' => self::OTHER_CASE,
        'component' => 'p13n.case',
        'label' => 'Personalization Case',
        'owner' => 'page',
        'reason' => 'personalized',
      ],
    ], $skipped);
    // One that throws while its values are read costs only itself.
    [$values, $skipped] = $this->props($page, ['heading' => 'text'], at: 3);
    self::assertSame([], $values);
    $skipped = array_intersect_key($skipped[0], ['uuid' => TRUE, 'reason' => TRUE]);
    self::assertSame(['uuid' => self::BROKEN, 'reason' => 'error'], $skipped);
    // Its error is in the site log.
    self::assertNotEmpty(preg_grep('/^The component instance ' . self::BROKEN . ' \(' . preg_quote(self::HEADING, '/') . '\) could not be read: /', $this->logged));
    // The case is the one whose segments hold the default one, as Canvas
    // renders it, whatever its variant is called.
    $inputs = static fn (string $variant, string $segment): array => [
      'inputs' => json_encode(['variant_id' => $variant, 'segments' => [$segment]]),
    ];
    $this->storeInstance($page, self::DEFAULT_CASE, $inputs('default', 'halloween'));
    $this->storeInstance($page, self::OTHER_CASE, $inputs('halloween', Segment::DEFAULT_ID));
    $read = $this->read(Page::load($page->id()), $skipped);
    self::assertSame([self::SWITCH, self::OTHER_CASE, self::WELCOME_BACK, self::BROKEN], array_keys($read));
    self::assertSame([self::DEFAULT_CASE], array_column($skipped, 'uuid'));

    // A page visitors may not view is read as its author: its head is the
    // author's, so the value is there, and varies by user.
    $this->createSlotTemplate();
    $author = $this->setUpCurrentUser([], ['access content', 'view own unpublished content']);
    $draft = Node::create(['type' => 'article', 'title' => 'Mine', 'status' => 0, 'uid' => $author->id()]);
    $draft->save();
    $cacheability = new CacheableMetadata();
    [$values, $skipped] = $this->props($draft, ['heading' => 'text'], $cacheability);
    self::assertSame(['heading' => ['ok', 'Mine']], $values);
    self::assertSame([], $skipped);
    self::assertContains('user', $cacheability->getCacheContexts());

    // On a public page, a value that expires is left out, and the head stays
    // cacheable for good.
    $public = Node::create(['type' => 'article', 'title' => 'Ours', 'status' => 1]);
    $public->save();
    $this->container->get('state')->set('canvas_metatag_count_test.expires', 'title');
    $this->forgetAccess();
    $cacheability = new CacheableMetadata();
    [$values, $skipped] = $this->props($public, ['heading' => 'text'], $cacheability);
    self::assertSame([], $values);
    $skipped = array_intersect_key($skipped[0], ['uuid' => TRUE, 'reason' => TRUE]);
    self::assertSame(['uuid' => self::SLOTTED, 'reason' => 'cacheability'], $skipped);
    self::assertSame(Cache::PERMANENT, $cacheability->getCacheMaxAge());
    self::assertNotContains('user', $cacheability->getCacheContexts());

    // So is a value that would vary by user: read as an anonymous visitor,
    // it would be the same for every visitor only by chance.
    $this->container->get('state')->delete('canvas_metatag_count_test.expires');
    $this->container->get('state')->set('canvas_metatag_count_test.varies', 'title');
    $this->forgetAccess();
    $cacheability = new CacheableMetadata();
    [$values, $skipped] = $this->props($public, ['heading' => 'text'], $cacheability);
    self::assertSame([], $values);
    $skipped = array_intersect_key($skipped[0], ['uuid' => TRUE, 'reason' => TRUE]);
    self::assertSame(['uuid' => self::SLOTTED, 'reason' => 'cacheability'], $skipped);
    self::assertNotContains('user', $cacheability->getCacheContexts());
    // Read without either, the value is there.
    $this->container->get('state')->delete('canvas_metatag_count_test.varies');
    $this->forgetAccess();
    self::assertSame(['heading' => ['ok', 'Ours']], $this->props($public, ['heading' => 'text'])[0]);
  }

  /**
   * A breadcrumb in a case visitors in no segment never get gives no trail.
   */
  public function testPersonalizedBreadcrumb(): void {
    $this->createPage(['title' => 'Shop', 'path' => ['alias' => '/shop']]);
    $this->createPage(['title' => 'Lamps', 'path' => ['alias' => '/shop/lamps']]);
    $switch = static fn (string $case): array => [
      self::placed(self::SWITCH, 'p13n.switch', ['variants' => ['default', 'halloween']]),
      self::placed(self::DEFAULT_CASE, 'p13n.case', ['variant_id' => 'default', 'segments' => [Segment::DEFAULT_ID]], self::SWITCH, 'content'),
      self::placed(self::OTHER_CASE, 'p13n.case', ['variant_id' => 'halloween', 'segments' => ['halloween']], self::SWITCH, 'content'),
      self::placed(self::BREADCRUMB, 'block.system_breadcrumb_block', ['label' => '', 'label_display' => '0'], $case, 'content'),
    ];
    $halloween = $this->createPage([
      'title' => 'Oak',
      'path' => ['alias' => '/shop/lamps/oak'],
      'components' => $switch(self::OTHER_CASE),
    ]);
    $default = $this->createPage([
      'title' => 'Brass',
      'path' => ['alias' => '/shop/lamps/brass'],
      'components' => $switch(self::DEFAULT_CASE),
    ]);
    $resolver = $this->container->get(Resolver::class);
    self::assertArrayNotHasKey('breadcrumb', self::graph($resolver->resolve($halloween)['head']));
    self::assertSame(['Home', 'Shop', 'Lamps'], array_column(self::graph($resolver->resolve($default)['head'])['breadcrumb']['itemListElement'], 'name'));
  }

  /**
   * An instance whose component or version is gone costs only itself.
   */
  public function testErrors(): void {
    $page = $this->createPage([
      'components' => [
        self::placed(self::ON_PAGE, self::HEADING, ['heading' => 'Plans']),
        self::placed(self::NO_VERSION, 'sdc.canvas_test_sdc.props-slots', ['heading' => 'Old']),
        self::placed(self::IN_NO_VERSION, self::HEADING, ['heading' => 'Inside old'], self::NO_VERSION, 'the_body'),
        self::placed(self::NO_COMPONENT, 'sdc.canvas_test_sdc.props-slots', ['heading' => 'Gone']),
        self::placed(self::IN_NO_COMPONENT, self::HEADING, ['heading' => 'Inside gone'], self::NO_COMPONENT, 'the_body'),
      ],
    ]);
    // A version that no longer exists, and a component that was deleted.
    $this->storeInstance($page, self::NO_VERSION, ['component_version' => 'deadbeefdeadbeef']);
    $this->storeInstance($page, self::NO_COMPONENT, ['component_id' => 'sdc.canvas_test_sdc.gone']);
    $read = $this->read(Page::load($page->id()), $skipped);
    // What is inside them does not render either.
    self::assertSame([self::ON_PAGE], array_keys($read));
    self::assertSame([
      [
        'uuid' => self::NO_VERSION,
        'component' => 'sdc.canvas_test_sdc.props-slots',
        'label' => (string) Component::load('sdc.canvas_test_sdc.props-slots')->label(),
        'owner' => 'page',
        'reason' => 'error',
      ],
      [
        'uuid' => self::NO_COMPONENT,
        'component' => 'sdc.canvas_test_sdc.gone',
        'label' => '',
        'owner' => 'page',
        'reason' => 'error',
      ],
    ], $skipped);
    // Each is in the site log.
    foreach ([self::NO_VERSION, self::NO_COMPONENT] as $uuid) {
      self::assertNotEmpty(preg_grep("/^The component instance $uuid \\(.+\\) could not be read: /", $this->logged), $uuid);
    }
  }

  /**
   * Where a component is used: default revisions and templates only.
   *
   * An item that places it in two component tree fields counts once.
   */
  public function testUsage(): void {
    self::assertSame(['content' => 0, 'templates' => 0], $this->sources()->usage(self::HEADING));
    $this->createPage(['components' => [self::placed(self::ON_PAGE, self::HEADING, ['heading' => 'Used'])]]);
    // A later revision that is not the default one is not live.
    $other = $this->createPage(['title' => 'Other', 'path' => ['alias' => '/other']]);
    $other->set('components', [self::placed(self::NEW, self::HEADING, ['heading' => 'Not yet'])]);
    $other->setNewRevision();
    $other->isDefaultRevision(FALSE);
    $other->save();
    $this->createSlotTemplate();
    self::assertSame(['content' => 1, 'templates' => 0], $this->sources()->usage(self::HEADING));
    // An article with the component in its own slot, and again in a second
    // component tree field.
    FieldStorageConfig::create(['field_name' => 'field_aside', 'entity_type' => 'node', 'type' => 'component_tree'])->save();
    FieldConfig::create([
      'field_name' => 'field_aside',
      'entity_type' => 'node',
      'bundle' => 'article',
      'label' => 'Aside',
    ])->save();
    Node::create([
      'type' => 'article',
      'title' => 'Twice',
      'field_canvas' => [self::placed(self::IN_SLOT, self::HEADING, ['heading' => 'One'], self::SLOTTED, 'the_body')],
      'field_aside' => [self::placed(self::LINKED, self::HEADING, ['heading' => 'Two'])],
    ])->save();
    self::assertSame(['content' => 2, 'templates' => 0], $this->sources()->usage(self::HEADING));
    self::assertSame(['content' => 0, 'templates' => 1], $this->sources()->usage('sdc.canvas_test_sdc.props-slots'));
  }

}
