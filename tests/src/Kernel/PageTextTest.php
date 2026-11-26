<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas\Entity\PageRegion;
use Drupal\canvas_metatag\PageContent;
use Drupal\canvas_metatag\PageText;
use Drupal\canvas_metatag\Plugin\QueueWorker\PageTextIndex;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_personalization\Entity\Segment;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * A Canvas page's own text as its description, and the index behind it.
 *
 * Dynamic-values "A Canvas page's own text"; design D11. PageContent reads
 * through Sources, the module's one component reader.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(PageText::class)]
#[CoversClass(PageContent::class)]
#[Group('canvas_metatag')]
final class PageTextTest extends CanvasKernelTestBase {

  use GenerateComponentConfigTrait;
  use SeoFixtureTrait;

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
    'language',
    'canvas_metatag',
  ];

  /**
   * Text of fifty characters or more, as the page shows it.
   */
  private const INTRO = 'Read practical notes on shaping AI-generated work into clear, trusted pages.';
  private const NEWSLETTER = 'Get one short letter a month with the best of what we learned this season.';
  private const OWN = 'Our own paragraph explains how this page differs from every other page here.';
  private const AGAIN = 'Welcome back: here is what changed on the site since your last visit to us.';

  /**
   * Instance UUIDs of the personalized page.
   */
  private const SWITCH = '99999999-0000-4000-8000-000000000001';
  private const OTHER_CASE = '99999999-0000-4000-8000-000000000002';
  private const DEFAULT_CASE = '99999999-0000-4000-8000-000000000003';

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->installConfig(['canvas_personalization']);
    Segment::create(['id' => 'halloween', 'label' => 'Halloween'])->save();
    $this->generateComponentConfig();
  }

  /**
   * The text after the heading describes the page.
   */
  public function testIntro(): void {
    $page = $this->createPage([
      'title' => 'Blog',
      'description' => '',
      'path' => ['alias' => '/blog'],
      'components' => self::components(
        ['heading', ['text' => 'Blog', 'element' => 'h1']],
        self::hero('Ideas', self::INTRO),
        self::hero('Footer', '© 2026 Example Ventures Inc., all rights reserved.'),
      ),
    ]);
    $head = $this->resolver()->resolve($page)['head'];
    self::assertSame(self::INTRO, self::meta($head)['description']);
    // A typed description wins.
    $page->set('description', 'Typed.')->save();
    self::assertSame('Typed.', self::meta($this->resolver()->resolve(Page::load($page->id()))['head'])['description']);

    // A copyright notice and text in a page region describe nothing.
    $this->container->get('theme_installer')->install(['stark']);
    $this->config('system.theme')->set('default', 'stark')->save();
    $hero = Component::load('sdc.canvas_test_sdc.my-hero');
    PageRegion::create([
      'theme' => 'stark',
      'region' => 'footer',
      'component_tree' => [
        [
          'uuid' => '10000000-0000-4000-8000-000000000001',
          'component_id' => 'sdc.canvas_test_sdc.my-hero',
          'component_version' => $hero->getActiveVersion(),
          'inputs' => self::hero('In the footer', self::INTRO)[1],
        ],
      ],
    ])->save();
    $page = $this->createPage([
      'title' => 'About',
      'description' => '',
      'path' => ['alias' => '/about'],
      'components' => self::components(
        ['heading', ['text' => 'About', 'element' => 'h1']],
        self::hero('Footer', 'Copyright 2026 Example Ventures Inc., all rights reserved.'),
      ),
    ]);
    self::assertArrayNotHasKey('description', self::meta($this->resolver()->resolve($page)['head']));
  }

  /**
   * Text another published page offers describes neither; the index moves.
   */
  public function testSharedText(): void {
    $newsletter = self::hero('Letters', self::NEWSLETTER);
    $one = $this->createPage([
      'title' => 'One',
      'description' => '',
      'path' => ['alias' => '/one'],
      'components' => self::components(['heading', ['text' => 'One', 'element' => 'h1']], $newsletter),
    ]);
    $description = fn (int $id): ?string => self::meta($this->resolver()->resolve(Page::load($id))['head'])['description'] ?? NULL;
    // Alone, it is the page's own.
    self::assertSame(self::NEWSLETTER, $description((int) $one->id()));
    $before = $this->resolver()->resolve(Page::load($one->id()))['cacheability']->getCacheTags();

    // An unrelated page is saved: the first page's head stays valid.
    $checksum = $this->container->get('cache_tags.invalidator.checksum');
    $valid = $checksum->getCurrentChecksum($before);
    $this->createPage([
      'title' => 'Unrelated',
      'path' => ['alias' => '/unrelated'],
      'components' => self::components(['heading', ['text' => 'Else', 'element' => 'h1']]),
    ]);
    self::assertSame($valid, $checksum->getCurrentChecksum($before));

    // A second published page offers it: it describes neither, and the
    // page with a paragraph of its own is described by that.
    $two = $this->createPage([
      'title' => 'Two',
      'description' => '',
      'path' => ['alias' => '/two'],
      'components' => self::components(
        ['heading', ['text' => 'Two', 'element' => 'h1']],
        $newsletter,
        self::hero('More', self::OWN),
      ),
    ]);
    self::assertNotSame($valid, $checksum->getCurrentChecksum($before));
    $this->container->get('entity.memory_cache')->deleteAll();
    self::assertNull($description((int) $one->id()));
    self::assertSame(self::OWN, $description((int) $two->id()));

    // Unpublished, the second page no longer offers it.
    $two->setUnpublished()->save();
    $this->container->get('entity.memory_cache')->deleteAll();
    self::assertSame(self::NEWSLETTER, $description((int) $one->id()));
    // Deleted, nor does it.
    $two->setPublished()->save();
    $this->container->get('entity.memory_cache')->deleteAll();
    self::assertNull($description((int) $one->id()));
    $two->delete();
    $this->container->get('entity.memory_cache')->deleteAll();
    self::assertSame(self::NEWSLETTER, $description((int) $one->id()));
  }

  /**
   * Pages saved before the module indexed them are indexed by the update.
   */
  public function testPostUpdate(): void {
    $newsletter = self::hero('Letters', self::NEWSLETTER);
    $pages = [];
    foreach (['one', 'two'] as $name) {
      $pages[$name] = $this->createPage([
        'title' => $name,
        'description' => '',
        'path' => ['alias' => "/$name"],
        'components' => self::components(['heading', ['text' => $name, 'element' => 'h1']], $newsletter, self::hero('More', self::OWN . " ($name)")),
      ]);
    }
    // A site from before the index.
    $this->container->get('keyvalue')->get(PageText::COLLECTION . 'en')->deleteAll();

    $this->container->get('module_handler')->loadInclude('canvas_metatag', 'php', 'canvas_metatag.post_update');
    $sandbox = [];
    $runs = 0;
    do {
      canvas_metatag_post_update_page_text($sandbox);
      $runs++;
    } while ($sandbox['#finished'] < 1 && $runs < 10);
    self::assertSame(1, $sandbox['#finished']);

    // The shared text describes neither page; their own paragraphs do.
    $this->container->get('entity.memory_cache')->deleteAll();
    foreach ($pages as $name => $page) {
      self::assertSame(self::OWN . " ($name)", self::meta($this->resolver()->resolve(Page::load($page->id()))['head'])['description'], $name);
    }
  }

  /**
   * Installing indexes the pages there are: up to 500 at once.
   */
  public function testInstall(): void {
    $newsletter = self::hero('Letters', self::NEWSLETTER);
    $pages = [];
    foreach (['one', 'two'] as $name) {
      $pages[$name] = $this->createPage([
        'title' => $name,
        'description' => '',
        'path' => ['alias' => "/$name"],
        'components' => self::components(['heading', ['text' => $name, 'element' => 'h1']], $newsletter, self::hero('More', self::OWN . " ($name)")),
      ]);
    }
    // Pages from before the module.
    $this->container->get('keyvalue')->get(PageText::COLLECTION . 'en')->deleteAll();

    $this->container->get('module_handler')->loadInclude('canvas_metatag', 'install');
    canvas_metatag_install(FALSE);
    self::assertSame(0, $this->container->get('queue')->get(PageTextIndex::QUEUE)->numberOfItems());
    $this->container->get('entity.memory_cache')->deleteAll();
    foreach ($pages as $name => $page) {
      self::assertSame(self::OWN . " ($name)", self::meta($this->resolver()->resolve(Page::load($page->id()))['head'])['description'], $name);
    }
  }

  /**
   * A deleted language takes its candidates with it.
   *
   * Uninstalling deletes the collections of the languages there are then.
   */
  public function testLanguageDeleted(): void {
    $this->installConfig(['language']);
    $language = ConfigurableLanguage::createFromLangcode('fi');
    $language->save();
    $this->container->get('keyvalue')->get(PageText::COLLECTION . 'fi')->set('text', [1]);
    $this->container->get('keyvalue')->get(PageText::COLLECTION . 'en')->set('text', [1]);
    $language->delete();
    self::assertSame([], $this->container->get('keyvalue')->get(PageText::COLLECTION . 'fi')->getAll());
    self::assertSame(['text' => [1]], $this->container->get('keyvalue')->get(PageText::COLLECTION . 'en')->getAll());
  }

  /**
   * A page is read once per request, and again once its tree changes.
   */
  public function testReadKept(): void {
    $page = $this->createPage([
      'title' => 'Blog',
      'components' => self::components(['heading', ['text' => 'First', 'element' => 'h1']]),
    ]);
    $content = $this->container->get(PageContent::class);
    self::assertSame('First', $content->read($page, new CacheableMetadata())['heading']);
    $page->set('components', self::components(['heading', ['text' => 'Second', 'element' => 'h1']]));
    self::assertSame('Second', $content->read($page, new CacheableMetadata())['heading']);
  }

  /**
   * Pages an install left are indexed on cron, each item queueing the next.
   */
  public function testQueue(): void {
    $newsletter = self::hero('Letters', self::NEWSLETTER);
    $pages = [];
    foreach (['one', 'two'] as $name) {
      $pages[$name] = $this->createPage([
        'title' => $name,
        'description' => '',
        'path' => ['alias' => "/$name"],
        'components' => self::components(['heading', ['text' => $name, 'element' => 'h1']], $newsletter, self::hero('More', self::OWN . " ($name)")),
      ]);
    }
    $this->container->get('keyvalue')->get(PageText::COLLECTION . 'en')->deleteAll();
    $queue = $this->container->get('queue')->get(PageTextIndex::QUEUE);
    $queue->createItem((int) $pages['two']->id());
    $queue->createItem((int) $pages['one']->id());
    $this->container->get('cron')->run();
    self::assertSame(0, $queue->numberOfItems());

    $this->container->get('entity.memory_cache')->deleteAll();
    foreach ($pages as $name => $page) {
      self::assertSame(self::OWN . " ($name)", self::meta($this->resolver()->resolve(Page::load($page->id()))['head'])['description'], $name);
    }
  }

  /**
   * Personalized content gives its default case; a block gives nothing.
   *
   * What visitors in no segment get, as link previews and crawlers do: the
   * heading (the Title fact of a placeholder-named page), the text and the
   * first component image. The case for returning visitors comes first, and
   * a breadcrumb block comes before everything.
   */
  public function testPersonalizedContent(): void {
    $welcome = $this->createImage('Welcome photo', ['width' => 2400, 'height' => 1600, 'alt' => 'The hall at night']);
    $again = $this->createImage('Returning photo', ['width' => 2400, 'height' => 1600, 'alt' => 'The hall by day']);
    $in = fn (string $case, int $at, string $component, array $inputs): array => self::placed(substr($case, 0, -3) . sprintf('%03d', $at), "sdc.canvas_test_sdc.$component", $inputs, $case, 'content');
    $page = $this->createPage([
      'title' => 'Untitled page',
      'description' => '',
      'path' => ['alias' => '/welcome'],
      'components' => [
        self::breadcrumb(),
        self::placed(self::SWITCH, 'p13n.switch', ['variants' => ['default', 'halloween']]),
        self::placed(self::OTHER_CASE, 'p13n.case', [
          'variant_id' => 'halloween',
          'segments' => ['halloween'],
        ], self::SWITCH, 'content'),
        $in(self::OTHER_CASE, 101, 'heading', ['text' => 'Welcome back', 'element' => 'h1']),
        $in(self::OTHER_CASE, 102, 'my-hero', self::hero('Again', self::AGAIN)[1]),
        $in(self::OTHER_CASE, 103, 'image', ['image' => ['target_id' => $again->id()]]),
        self::placed(self::DEFAULT_CASE, 'p13n.case', [
          'variant_id' => 'default',
          'segments' => [Segment::DEFAULT_ID],
        ], self::SWITCH, 'content'),
        $in(self::DEFAULT_CASE, 201, 'heading', ['text' => 'Welcome', 'element' => 'h1']),
        $in(self::DEFAULT_CASE, 202, 'my-hero', self::hero('Ideas', self::INTRO)[1]),
        $in(self::DEFAULT_CASE, 203, 'image', ['image' => ['target_id' => $welcome->id()]]),
      ],
    ]);

    $content = $this->container->get(PageContent::class)->read($page, new CacheableMetadata());
    self::assertSame('Welcome', $content['heading']);
    self::assertSame([self::INTRO], $content['texts']);
    self::assertSame([$welcome->get('field_media_image')->entity->getFileUri()], array_column($content['images'], 'uri'));

    $resolved = $this->resolver()->resolve($page);
    $meta = self::meta($resolved['head']);
    self::assertSame('Welcome', $meta['og:title']);
    self::assertSame(self::INTRO, $meta['description']);
    self::assertSame('component', $resolved['image']['source']);
    self::assertSame($this->imageOf($welcome)['url'], $resolved['image']['url']);
    self::assertSame('The hall at night', $meta['og:image:alt']);
  }

  /**
   * A template's fields are the ones every visitor gets.
   *
   * A field linked only in a personalized case is never what an anonymous
   * visitor sees, so it is not one the page shows (the description's rule).
   */
  public function testLinkedFields(): void {
    $heading = static fn (string $uuid, string $case, string $field): array => self::placed($uuid, 'sdc.canvas_test_sdc.heading', [
      'text' => [
        'sourceType' => 'entity-field',
        'expression' => "ℹ︎␜entity:node:article␝{$field}␞␟value",
      ],
      'element' => 'h2',
    ], $case, 'content');
    $template = ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => 'article',
      'content_entity_type_view_mode' => 'full',
      'component_tree' => [
        self::placed(self::SWITCH, 'p13n.switch', ['variants' => ['default', 'halloween']]),
        self::placed(self::OTHER_CASE, 'p13n.case', [
          'variant_id' => 'halloween',
          'segments' => ['halloween'],
        ], self::SWITCH, 'content'),
        $heading('99999999-0000-4000-8000-000000000101', self::OTHER_CASE, 'field_notes'),
        self::placed(self::DEFAULT_CASE, 'p13n.case', [
          'variant_id' => 'default',
          'segments' => [Segment::DEFAULT_ID],
        ], self::SWITCH, 'content'),
        $heading('99999999-0000-4000-8000-000000000201', self::DEFAULT_CASE, 'field_hours'),
      ],
    ]);
    self::assertSame(['field_hours' => TRUE], $this->container->get(Sources::class)->linked($template));
  }

  /**
   * A hero with a heading and a sub-heading, at the top of the page.
   */
  private static function hero(string $heading, string $text): array {
    return ['my-hero', ['heading' => $heading, 'subheading' => $text, 'cta1href' => 'https://example.com']];
  }

}
