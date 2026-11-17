<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Hook\CanvasMetatagHooks;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Cache\Cache;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\Extension\ModuleInstallerInterface;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use Drupal\user\Entity\Role;
use Drupal\views\Entity\View;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Psr\Log\AbstractLogger;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

// cspell:ignore Tarifs tarifs rels
/**
 * Tests the head of the HTML an anonymous visitor gets, with both page caches.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(CanvasMetatagHooks::class)]
#[CoversClass(Resolver::class)]
#[Group('canvas_metatag')]
final class CoupledHeadTest extends CanvasKernelTestBase {

  use ContentTranslationTestTrait;
  use GenerateComponentConfigTrait;
  use RequestTrait;
  use SeoFixtureTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'language',
    'content_translation',
    'page_cache',
    'dynamic_page_cache',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->installSchema('user', ['users_data']);
    $this->installConfig(['language', 'views']);
    ConfigurableLanguage::createFromLangcode('fr')->save();
    $this->enableContentTranslation(Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID);
    // The language path processor exists only on a multilingual site.
    $this->container->get('kernel')->rebuildContainer();
    $this->generateComponentConfig();
  }

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    self::allowPageCaches($container);
  }

  /**
   * A Canvas page: one of each tag, every row, cached and invalidated.
   */
  public function testPage(): void {
    $hero = $this->createImage('Pricing hero', ['alt' => 'Pricing "table"']);
    $hostile = 'Plans </script><script>alert(1)</script> & <b>prices</b>';
    $page = $this->createPage([
      'title' => 'I <3 "Canvas" & more',
      'description' => $hostile,
      'image' => $hero->id(),
      'canvas_metatag' => Values::encode(['schema' => ['type' => 'Article']]),
    ]);
    $page->addTranslation('fr', ['title' => 'Tarifs', 'status' => TRUE, 'path' => ['alias' => '/tarifs']]);
    $page->save();

    $response = $this->get('/pricing');
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    $head = self::readHead($response);
    $expected = $this->resolver()->resolve(Page::load($page->id()))['head'];
    // Exactly one of each, and what the resolver says.
    self::assertSame(['I <3 "Canvas" & more | Example'], $head['titles']);
    self::assertSame($expected['title'], $head['titles'][0]);
    self::assertSame($expected['meta'], $head['meta']);
    self::assertSame($expected['link'], $head['links']);
    self::assertSame([$expected['script'][0]['textContent']], $head['json_ld']);
    // Every row of the head, in order.
    self::assertSame([
      'description',
      'robots',
      'og:type',
      'og:site_name',
      'og:title',
      'og:description',
      'og:url',
      'og:image',
      'og:image:width',
      'og:image:height',
      'og:image:alt',
      'article:published_time',
      'article:modified_time',
      'twitter:card',
    ], array_keys(self::meta($head)));
    self::assertSame($hostile, self::meta($head)['description']);
    self::assertSame('Pricing "table"', self::meta($head)['og:image:alt']);
    self::assertSame('max-image-preview:large', self::meta($head)['robots']);
    self::assertSame($hostile, self::graph(['script' => $expected['script']])['webpage']['description']);
    // One canonical, no shortlink, and only our hreflang links: those of
    // content_translation are gone, and no Link header was sent.
    self::assertSame([
      ['rel' => 'canonical', 'href' => 'http://localhost/pricing'],
      ['rel' => 'alternate', 'hreflang' => 'en', 'href' => 'http://localhost/pricing'],
      ['rel' => 'alternate', 'hreflang' => 'fr', 'href' => 'http://localhost/fr/tarifs'],
      ['rel' => 'alternate', 'hreflang' => 'x-default', 'href' => 'http://localhost/pricing'],
    ], $head['links']);
    self::assertFalse($response->headers->has('Link'));
    // The script cannot be left from inside: one script, and no markup of
    // the description became an element.
    self::assertSame(0, $head['injected']);

    // The second request is served from the page cache, byte for byte.
    $cached = $this->get('/pricing');
    self::assertSame('HIT', $cached->headers->get('X-Drupal-Cache'));
    self::assertSame($response->getContent(), $cached->getContent());

    // The translation has its own head and the same alternates.
    $head = self::readHead($this->get('/fr/tarifs'));
    self::assertSame(['Tarifs | Example'], $head['titles']);
    self::assertSame('http://localhost/fr/tarifs', $head['links'][0]['href']);
    self::assertSame(['canonical', 'alternate', 'alternate', 'alternate'], array_column($head['links'], 'rel'));

    // Everything the head depends on invalidates the cached page.
    $changes = [
      'site settings' => function (): void {
        $this->config('canvas_metatag.site')->set('values.title_end', ['text' => 'Shop'])->save();
      },
      'the page' => static function () use ($page): void {
        Page::load($page->id())?->set('title', 'Prices')->save();
      },
      'the image media' => static function () use ($hero): void {
        $item = $hero->get('field_media_image')->first()?->getValue();
        $hero->set('field_media_image', ['alt' => 'New alt'] + $item)->save();
      },
      'the site name' => function (): void {
        $this->config('system.site')->set('name', 'Example Ltd')->save();
      },
      'the anonymous role' => function (): void {
        Role::load('anonymous')?->revokePermission('view media')->save();
        $this->forgetAccess();
      },
    ];
    $seen = [];
    foreach ($changes as $label => $change) {
      self::assertSame('HIT', $this->get('/pricing')->headers->get('X-Drupal-Cache'), $label);
      $change();
      $response = $this->get('/pricing');
      self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'), $label);
      $head = self::readHead($response);
      $seen[$label] = [$head['titles'][0], self::meta($head)['og:site_name'], self::meta($head)['og:image:alt'] ?? NULL];
    }
    self::assertSame([
      'site settings' => ['I <3 "Canvas" & more | Shop', 'Example', 'Pricing "table"'],
      'the page' => ['Prices | Shop', 'Example', 'Pricing "table"'],
      'the image media' => ['Prices | Shop', 'Example', 'New alt'],
      'the site name' => ['Prices | Shop', 'Example Ltd', 'New alt'],
      // Visitors may no longer see media: no image.
      'the anonymous role' => ['Prices | Shop', 'Example Ltd', NULL],
    ], $seen);
    self::assertArrayNotHasKey('og:image', self::meta($head));

    // A resolver that throws costs the page its SEO head, never the page:
    // the head is core's, and the failure is logged. An invalid site
    // timezone, forced past validation, is what makes it throw here.
    $this->container->get('logger.factory')->addLogger($log = new class() extends AbstractLogger {

      /**
       * The channel of every record.
       *
       * @var list<string>
       */
      public array $channels = [];

      /**
       * {@inheritdoc}
       */
      public function log($level, string|\Stringable $message, array $context = []): void {
        $this->channels[] = (string) ($context['channel'] ?? '');
      }

    });
    $GLOBALS['config']['system.date']['timezone']['default'] = 'Nowhere/Land';
    $this->container->get('config.factory')->clearStaticCache();
    Cache::invalidateTags(['canvas_page:' . $page->id()]);
    $head = self::readHead($this->get('/pricing'));
    self::assertSame([], $head['meta']);
    self::assertSame([], $head['json_ld']);
    self::assertSame(['Prices | Example Ltd'], $head['titles']);
    self::assertContains('canvas_metatag', $log->channels);
    unset($GLOBALS['config']['system.date']);
    $this->container->get('config.factory')->clearStaticCache();
  }

  /**
   * A template-rendered node is ours; other routes are left as they were.
   */
  public function testNodeAndOtherRoutes(): void {
    $this->createField('field_summary', 'string_long', 'Summary');
    $this->createField('field_byline', 'string', 'Byline');
    $this->createField('field_hero', 'entity_reference', 'Hero image', ['target_type' => 'media'], [
      'handler' => 'default:media',
      'handler_settings' => ['target_bundles' => ['image' => 'image']],
    ]);
    $hero = $this->createImage('Article hero', ['alt' => 'A waving hand']);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'uid' => $this->author->id(),
      'created' => strtotime(self::CREATED),
      'changed' => strtotime(self::CHANGED),
      'field_summary' => 'A first post.',
      'field_byline' => 'Grace Hopper',
      'field_hero' => $hero->id(),
    ]);
    $node->save();
    $path = '/node/' . $node->id();
    // A template that is not enabled does not render the article: the head
    // is core's, with its canonical and shortlink.
    $template = $this->createTemplate(FALSE, [
      'description' => [
        'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_summary␞␟value', 'sourceType' => 'entity-field'],
      ],
      'schema' => [
        'props' => [
          'author_name' => [
            'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
          ],
        ],
        'type' => 'BlogPosting',
      ],
      'social' => [
        'image' => [
          'source' => [
            'expression' => 'ℹ︎␜entity:node:article␝field_hero␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}',
            'sourceType' => 'entity-field',
          ],
        ],
      ],
      'title_end' => ['text' => 'Blog'],
    ]);
    $head = self::readHead($this->get($path));
    self::assertSame(['Hello | Example'], $head['titles']);
    self::assertSame(['canonical', 'shortlink'], self::coreLinks($head));
    self::assertSame([], $head['meta']);
    self::assertSame([], $head['json_ld']);

    // Enabling the template invalidates that page, and the head is ours:
    // every value comes from the article's own fields.
    $template->setStatus(TRUE)->save();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    $head = self::readHead($response);
    $expected = $this->resolver()->resolve(Node::load($node->id()))['head'];
    $url = 'http://localhost' . $path;
    self::assertSame(['Hello | Blog'], $head['titles']);
    self::assertSame($expected['meta'], $head['meta']);
    self::assertSame([
      'description' => 'A first post.',
      'robots' => 'max-image-preview:large',
      'og:type' => 'article',
      'og:site_name' => 'Example',
      'og:title' => 'Hello',
      'og:description' => 'A first post.',
      'og:url' => $url,
      'og:image' => $this->imageOf($hero)['url'],
      'og:image:width' => '1200',
      'og:image:height' => '630',
      'og:image:alt' => 'A waving hand',
      'article:published_time' => self::PUBLISHED,
      'article:modified_time' => self::MODIFIED,
      'twitter:card' => 'summary_large_image',
    ], self::meta($head));
    self::assertSame([['rel' => 'canonical', 'href' => $url]], $head['links']);
    self::assertSame([$expected['script'][0]['textContent']], $head['json_ld']);
    $graph = self::graph(['script' => [['textContent' => $head['json_ld'][0]]]]);
    self::assertSame(['identity', 'website', 'webpage', 'primaryimage', 'primary'], array_keys($graph));
    self::assertSame('BlogPosting', $graph['primary']['@type']);
    self::assertSame('Grace Hopper', $graph['primary']['author']['name']);
    self::assertSame('Hello', $graph['primary']['headline']);
    // The page's own image, referenced by its @id.
    self::assertSame(['@id' => $graph['primaryimage']['@id']], $graph['primary']['image']);
    self::assertSame($this->imageOf($hero)['url'], $graph['primaryimage']['url']);
    self::assertStringContainsString('Template heading', (string) $response->getContent());
    $cached = $this->get($path);
    self::assertSame('HIT', $cached->headers->get('X-Drupal-Cache'));
    self::assertSame($response->getContent(), $cached->getContent());

    // Saving the template and saving the node invalidate.
    $template = ContentTemplate::load('node.article.full');
    $template?->setThirdPartySetting('canvas_metatag', 'values', [
      'title' => [
        'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
      ],
    ])->save();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame(['Grace Hopper | Example'], self::readHead($response)['titles']);
    Node::load($node->id())?->set('field_byline', 'Ada Lovelace')->save();
    self::assertSame(['Ada Lovelace | Example'], self::readHead($this->get($path))['titles']);

    // The form's order decides which image is the page image: moving a
    // field on the form invalidates the page.
    $this->createField('field_photo', 'entity_reference', 'Photo', ['target_type' => 'media'], [
      'handler' => 'default:media',
      'handler_settings' => ['target_bundles' => ['image' => 'image']],
    ]);
    $photo = $this->createImage('Article photo', ['alt' => 'A portrait']);
    // Loaded again: the cached article predates the field.
    $this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($node->id())
      ?->set('field_photo', $photo->id())->save();
    self::assertSame($this->imageOf($hero)['url'], self::meta(self::readHead($this->get($path)))['og:image']);
    self::assertSame('HIT', $this->get($path)->headers->get('X-Drupal-Cache'));
    $this->container->get('entity_display.repository')->getFormDisplay('node', 'article')
      ->setComponent('field_photo', ['weight' => 1])
      ->setComponent('field_hero', ['weight' => 2])
      ->save();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame($this->imageOf($photo)['url'], self::meta(self::readHead($response))['og:image']);
    // Moving the field on the existing form invalidates it again.
    self::assertSame('HIT', $this->get($path)->headers->get('X-Drupal-Cache'));
    $this->container->get('entity_display.repository')->getFormDisplay('node', 'article')
      ->setComponent('field_photo', ['weight' => 3])
      ->save();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame($this->imageOf($hero)['url'], self::meta(self::readHead($response))['og:image']);

    // A node without a template and a Views route that lists the article:
    // what they answer with the module is what they answer without it.
    // Without the author line, whose "Member for" changes while the test
    // runs.
    NodeType::create(['type' => 'note', 'name' => 'Note', 'display_submitted' => FALSE])->save();
    $note = Node::create(['type' => 'note', 'title' => 'A note', 'uid' => $this->author->id()]);
    $note->save();
    View::create([
      'id' => 'listing',
      'label' => 'Listing',
      'base_table' => 'node_field_data',
      'base_field' => 'nid',
      'display' => [
        'default' => [
          'id' => 'default',
          'display_plugin' => 'default',
          'display_title' => 'Default',
          'position' => 0,
          'display_options' => [
            'title' => 'Listing',
            'access' => ['type' => 'none', 'options' => []],
            'row' => ['type' => 'entity:node', 'options' => ['view_mode' => 'full']],
          ],
        ],
        'page_1' => [
          'id' => 'page_1',
          'display_plugin' => 'page',
          'display_title' => 'Page',
          'position' => 1,
          'display_options' => ['path' => 'listing'],
        ],
      ],
    ])->save();
    $this->container->get('router.builder')->rebuild();
    $paths = ['/node/' . $note->id(), '/listing'];
    $with = [];
    foreach ($paths as $other) {
      $response = $this->get($other);
      $with[$other] = self::stable($response);
      $head = self::readHead($response);
      self::assertSame([], $head['meta'], $other);
      self::assertSame([], $head['json_ld'], $other);
      self::assertCount(1, $head['titles'], $other);
    }
    self::assertStringContainsString('Template heading', $with['/listing']);
    self::assertSame(['canonical', 'shortlink'], self::coreLinks(self::readHead($this->get($paths[0]))));

    $this->container->get(ModuleInstallerInterface::class)->uninstall(['canvas_metatag']);
    foreach ($paths as $other) {
      $response = $this->get($other);
      self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'), $other);
      self::assertSame($with[$other], self::stable($response), $other);
    }
    // And the head of the article is core's again.
    $head = self::readHead($this->get($path));
    self::assertSame(['canonical', 'shortlink'], self::coreLinks($head));
    self::assertSame(['Hello | Example'], $head['titles']);
    self::assertSame([], $head['meta']);
  }

  /**
   * A hostile job description reaches the head as filtered HTML.
   *
   * One script element, which decodes to the graph: markup in the field
   * never ends the element or adds another.
   */
  public function testHostileJobDescription(): void {
    $this->createField('field_job', 'text_long', 'Job description');
    $hostile = '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">apply</a><ul><li>Design</li></ul></script><script>alert(2)</script>';
    $node = Node::create([
      'type' => 'article',
      'title' => 'Designer',
      'uid' => $this->author->id(),
      'field_job' => ['value' => $hostile, 'format' => 'plain_text'],
    ]);
    $node->save();
    $this->createTemplate(TRUE, [
      'schema' => [
        'type' => 'JobPosting',
        'props' => [
          'description' => [
            'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_job␞␟value', 'sourceType' => 'entity-field'],
          ],
          'hiringOrganization' => ['fact' => 'identity'],
          'work' => ['text' => 'remote'],
        ],
      ],
    ]);
    $response = $this->get('/node/' . $node->id());
    $content = (string) $response->getContent();
    self::assertSame(1, substr_count($content, '<script type="application/ld+json">'));
    self::assertStringNotContainsString('alert(', $content);
    $head = self::readHead($response);
    self::assertCount(1, $head['json_ld']);
    $graph = self::graph(['script' => [['textContent' => $head['json_ld'][0]]]]);
    self::assertSame('JobPosting', $graph['primary']['@type']);
    self::assertSame('<p>Hi</p><a>apply</a><ul><li>Design</li></ul>', $graph['primary']['description']);
  }

  /**
   * A hand-added value stored before validation never costs the other tags.
   *
   * A number that cannot be written out ("1e400") was storable before; read
   * mode now leaves that JSON-LD out, and the head keeps everything else.
   */
  public function testRobotsSurviveBadCustomValue(): void {
    $page = $this->createPage([
      'canvas_metatag' => Values::encode([
        'robots' => ['noindex' => TRUE],
        'schema' => ['custom' => '[{"@type":"Thing","@id":"#ok","name":"Kept"},{"@type":"Rating","@id":"#r","ratingValue":1e400}]'],
      ]),
    ]);
    $head = self::readHead($this->get('/pricing'));
    self::assertSame(['Pricing | Example'], $head['titles']);
    self::assertSame('Plans and prices for Example.', self::meta($head)['description']);
    self::assertSame('noindex, max-image-preview:large', self::meta($head)['robots']);
    self::assertSame('canonical', $head['links'][0]['rel']);
    self::assertCount(1, $head['json_ld']);
    self::assertNotContains('Rating', array_column($head['json_ld'][0]['@graph'], '@type'));
    // Only the refused item is left out.
    self::assertContains('Kept', array_column($head['json_ld'][0]['@graph'], 'name'));
    self::assertNotNull(Page::load($page->id()));
  }

  /**
   * The canonical and shortlink relations of a parsed head, sorted.
   *
   * @return list<string>
   *   The `rel` values; core's own head has one of each.
   */
  private static function coreLinks(array $head): array {
    $rels = array_values(array_diff(array_column($head['links'], 'rel'), ['alternate']));
    sort($rels);
    return $rels;
  }

  /**
   * The HTML of a response without what differs on every render.
   *
   * Views gives each rendered view a random DOM id.
   */
  private static function stable(Response $response): string {
    return (string) preg_replace('/js-view-dom-id-[0-9a-f]+/', 'js-view-dom-id-', (string) $response->getContent());
  }

  /**
   * Requests a path as an anonymous visitor.
   */
  private function get(string $path): Response {
    // A request starts without the entities an earlier one loaded, and so
    // without the referenced entities they hold.
    $this->container->get('entity.memory_cache')->deleteAll();
    $response = $this->request(Request::create($path));
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), $path);
    return $response;
  }

}
