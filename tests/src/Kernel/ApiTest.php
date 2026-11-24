<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas\Entity\PageVariant;
use Drupal\canvas\Plugin\Canvas\ComponentSource\Marker;
use Drupal\canvas_metatag\Controller\ApiController;
use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Access\CsrfRequestHeaderAccessCheck;
use Drupal\Core\Entity\EntityInterface;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\media\Entity\Media;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

// cspell:ignore Tarifs tarifs sivu sivuston Tuote jonka ihmiset ostavat
// cspell:ignore Kauppalistaus
/**
 * Tests the state, site and media routes and the access to all five.
 *
 * The two draft routes are tested in PageDraftTest and TemplateDraftTest.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(ApiController::class)]
#[Group('canvas_metatag')]
final class ApiTest extends CanvasKernelTestBase {

  use ContentTranslationTestTrait;
  use GenerateComponentConfigTrait;
  use RequestTrait;
  use SeoFixtureTrait;
  use UserCreationTrait;

  private const STATE = '/canvas-metatag/api/state';
  private const SITE = '/canvas-metatag/api/site';
  private const MEDIA = '/canvas-metatag/api/media';
  private const CLIENT = '0b6c7f0e-6c1f-4a53-9f0b-1c2f3d4e5a6b';

  /**
   * What a visitor and every editor of the tests may do.
   */
  private const VISITOR = ['access content', 'view media'];

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'datetime',
    // Refuses `view` on a field named field_no_view_access.
    'entity_test',
    'field_test',
    'language',
    'content_translation',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->installConfig(['language']);
    ConfigurableLanguage::createFromLangcode('fr')->save();
    $this->enableContentTranslation(Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID);
    // The language path processor exists only on a multilingual site.
    $this->container->get('kernel')->rebuildContainer();
    $this->generateComponentConfig();
  }

  /**
   * The state says whether a headless frontend decides what to show.
   */
  public function testHeadless(): void {
    $this->setUpCurrentUser([], ['edit canvas metatag', ...self::VISITOR]);
    $headless = fn (): bool => self::decodeResponse($this->request(Request::create(self::STATE)))['headless'];
    // Without the module.
    self::assertFalse($headless());

    $modules = ['serialization', 'consumers', 'simple_oauth', 'custom_elements', 'canvas_headless'];
    if (array_diff($modules, array_keys($this->container->get('extension.list.module')->getList()))) {
      self::markTestSkipped('canvas_headless or one of its dependencies is not in the codebase.');
    }
    $this->enableModules($modules);
    $this->installEntitySchema('consumer');
    $this->installEntitySchema('oauth2_token');
    $this->installConfig(['canvas_headless']);
    // Without a frontend, then with one.
    $this->config('canvas_headless.settings')->set('frontends', [])->save();
    self::assertFalse($headless());
    $frontend = ['url' => 'https://www.example.com', 'components' => []];
    $this->config('canvas_headless.settings')->set('frontends', [$frontend])->save();
    self::assertTrue($headless());
    // A public base set for the environment does not hide it.
    $this->setSetting('canvas_metatag_public_base', 'https://www.example.com');
    self::assertTrue($headless());
    // A frontend the head can't be built for is none, as for the head. Its
    // schema refuses it, so it is stored as an older release might have.
    $storage = $this->container->get('config.storage');
    $storage->write('canvas_headless.settings', ['frontends' => [['url' => 'not a url'] + $frontend]] + $storage->read('canvas_headless.settings'));
    $this->container->get('config.factory')->reset('canvas_headless.settings');
    self::assertFalse($headless());
  }

  /**
   * The requirements of the five routes, and that they are enforced.
   */
  public function testRoutes(): void {
    $either = 'edit canvas metatag+administer canvas metatag';
    $expected = [
      'canvas_metatag.api.state' => ['/canvas-metatag/api/state', ['GET'], ['_permission' => $either]],
      'canvas_metatag.api.page' => [
        '/canvas-metatag/api/draft/canvas_page/{canvas_page}',
        ['PUT'],
        [
          '_permission' => 'edit canvas metatag',
          '_entity_access' => 'canvas_page.update',
          '_csrf_request_header_token' => 'TRUE',
          'canvas_page' => '\d+',
        ],
      ],
      'canvas_metatag.api.template' => [
        '/canvas-metatag/api/draft/content_template/{content_template}',
        ['PUT'],
        [
          '_permission' => 'edit canvas metatag',
          '_entity_access' => 'content_template.update',
          '_csrf_request_header_token' => 'TRUE',
        ],
      ],
      'canvas_metatag.api.site' => [
        '/canvas-metatag/api/site',
        ['PUT'],
        ['_permission' => 'administer canvas metatag', '_csrf_request_header_token' => 'TRUE'],
      ],
      'canvas_metatag.api.media' => ['/canvas-metatag/api/media', ['GET'], ['_permission' => $either]],
    ];
    $provider = $this->container->get('router.route_provider');
    foreach ($expected as $name => [$path, $methods, $requirements]) {
      $route = $provider->getRouteByName($name);
      self::assertSame($path, $route->getPath(), $name);
      self::assertSame($methods, $route->getMethods(), $name);
      self::assertEquals($requirements, $route->getRequirements(), $name);
      // No response of ours is ever cached.
      self::assertSame('TRUE', $route->getOption('no_cache'), $name);
      // A browser session only: core checks the CSRF header for cookies.
      self::assertSame(['cookie'], $route->getOption('_auth'), $name);
    }
    self::assertSame(['entity:canvas_page'], array_column($provider->getRouteByName('canvas_metatag.api.page')->getOption('parameters'), 'type'));
    self::assertSame(['entity:content_template'], array_column($provider->getRouteByName('canvas_metatag.api.template')->getOption('parameters'), 'type'));

    // The read routes take either permission, the site route only the
    // administrative one, and nothing is open without one.
    $page = $this->createPage();
    $this->createTemplate(TRUE);
    $site = Request::create(self::SITE, 'PUT', content: '{"identity":{},"values":{}}');
    $allowed = [
      'edit canvas metatag' => [self::STATE => TRUE, self::MEDIA => TRUE, self::SITE => FALSE],
      'administer canvas metatag' => [self::STATE => TRUE, self::MEDIA => TRUE, self::SITE => TRUE],
      Page::EDIT_PERMISSION => [self::STATE => FALSE, self::MEDIA => FALSE, self::SITE => FALSE],
    ];
    foreach ($allowed as $permission => $paths) {
      $this->setUpCurrentUser(permissions: [...self::VISITOR, $permission]);
      foreach ($paths as $path => $open) {
        self::assertSame($open ? 200 : 403, $this->statusOf($path === self::SITE ? clone $site : Request::create($path)), "$permission: $path");
      }
    }
    // Both draft routes need the permission and update access together.
    $drafts = [
      "/canvas-metatag/api/draft/canvas_page/{$page->id()}" => Page::EDIT_PERMISSION,
      '/canvas-metatag/api/draft/content_template/node.article.full' => ContentTemplate::ADMIN_PERMISSION,
    ];
    foreach ($drafts as $path => $update) {
      $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag', 'administer canvas metatag']);
      self::assertSame(403, $this->statusOf(Request::create($path, 'PUT', content: '{}')), $path);
      $this->setUpCurrentUser(permissions: [...self::VISITOR, $update, 'administer canvas metatag']);
      self::assertSame(403, $this->statusOf(Request::create($path, 'PUT', content: '{}')), $path);
      // With both, the request reaches the controller, which refuses the
      // empty body in its own shape.
      $this->setUpCurrentUser(permissions: [...self::VISITOR, $update, 'edit canvas metatag']);
      self::assertSame(400, $this->statusOf(Request::create($path, 'PUT', content: '{}')), $path);
    }
    self::assertSame(404, $this->statusOf(Request::create('/canvas-metatag/api/draft/canvas_page/abc', 'PUT', content: '{}')));

    // A request with a session needs the header token on every unsafe
    // method; a read does not.
    $this->setUpCurrentUser(permissions: [
      ...self::VISITOR,
      Page::EDIT_PERMISSION,
      ContentTemplate::ADMIN_PERMISSION,
      'edit canvas metatag',
      'administer canvas metatag',
    ]);
    $session = [$this->container->get('session_configuration')->getOptions(Request::create('/'))['name'] => 'session'];
    $token = $this->container->get('csrf_token')->get(CsrfRequestHeaderAccessCheck::TOKEN_KEY);
    foreach ([...array_keys($drafts), self::SITE] as $path) {
      $request = Request::create($path, 'PUT', cookies: $session, content: '{}');
      self::assertSame(403, $this->statusOf(clone $request), $path);
      $request->headers->set('X-CSRF-Token', 'wrong');
      self::assertSame(403, $this->statusOf(clone $request), $path);
      $request->headers->set('X-CSRF-Token', $token);
      self::assertSame(400, $this->statusOf($request), $path);
    }
    self::assertSame(200, $this->statusOf(Request::create(self::STATE, cookies: $session)));
    self::assertSame(200, $this->statusOf(Request::create(self::MEDIA, cookies: $session)));
  }

  /**
   * The state of a page, for its editor and for someone who may only view.
   */
  public function testPageState(): void {
    $hero = $this->createImage('Pricing hero', ['alt' => 'Pricing table']);
    $picked = $this->createImage('Picked');
    $logo = $this->createImage('Logo', ['width' => 512, 'height' => 512]);
    $hidden = $this->createImage('Hidden', values: ['status' => FALSE]);
    $this->config('canvas_metatag.site')->set('identity.logo', $logo->uuid())->set('identity.default_image', $hidden->uuid())->save();
    $stored = ['robots' => ['noindex' => TRUE], 'social' => ['image' => ['media' => $picked->uuid()]]];
    $page = $this->createPage(['image' => $hero->id(), 'canvas_metatag' => Values::encode($stored)]);
    $query = '?entity_type=canvas_page&id=' . $page->id();

    // The editor: an edit of the title in Canvas and a write of ours are
    // both in the draft.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $auto_save = $this->container->get(AutoSaveManager::class);
    $draft = clone $page;
    $draft->set('title', 'Draft title');
    $auto_save->saveEntity($draft, self::CLIENT);
    $values = [
      'robots' => ['noindex' => TRUE],
      'social' => ['image' => ['media' => $picked->uuid()]],
      'title' => ['text' => 'Pricing plans'],
    ];
    $response = $this->request(Request::create("/canvas-metatag/api/draft/canvas_page/{$page->id()}", 'PUT', content: (string) json_encode([
      'values' => (object) $values,
      'langcode' => 'en',
      'client_instance_id' => self::CLIENT,
      'auto_saves' => ['canvas_page:' . $page->id() . ':en' => $auto_save->getClientAutoSaveData($page)],
    ])));
    // The answer to a draft write is the values and nothing else.
    self::assertSame('{"values":' . json_encode($values) . '}', $response->getContent());

    $response = $this->request(Request::create(self::STATE . $query));
    self::assertSame(200, $response->getStatusCode());
    self::assertSame('application/json', $response->headers->get('Content-Type'));
    self::assertStringContainsString('"from_default":{}', (string) $response->getContent());
    $state = self::decodeResponse($response);
    // Dates in the dialog follow the locale of the server's words.
    self::assertMatchesRegularExpression('/^en(-[A-Z]{2})?$/', $state['date_locale']);
    self::assertSame([
      'ui',
      'date_locale',
      'langcode',
      'languages',
      'origin',
      'headless',
      'can',
      'capabilities',
      'site',
      'registry',
      'codes',
      'module_ids',
      'extend_types',
      'vocabulary',
      'search_features',
      'target',
      'preview',
      'facts',
      'separator',
      'sources',
      'broken',
      'media',
      'resolved',
    ], array_keys($state));
    $draft = $auto_save->getAutoSaveEntityForPreview(Page::load($page->id()))->entity;
    self::assertInstanceOf(Page::class, $draft);
    $resolved = $this->resolver()->report($draft);
    $expected = [
      'ui' => 'en',
      'langcode' => 'en',
      'languages' => ['en' => 'English', 'fr' => 'French'],
      'origin' => ['url' => 'http://localhost', 'source' => 'request'],
      'headless' => FALSE,
      'can' => ['target' => TRUE, 'site' => FALSE],
      'capabilities' => ['ai' => NULL],
      'site' => [
        'identity' => [
          'kind' => 'organization',
          'name' => '',
          'separator' => '|',
          'logo' => $logo->uuid(),
          'default_image' => $hidden->uuid(),
          'same_as' => [],
        ],
        'values' => ['robots' => ['max_image_preview' => 'large']],
        'currency' => '',
        'country' => '',
        'timezone' => $this->config('system.date')->get('timezone.default') ?: 'UTC',
      ],
      'target' => [
        'scope' => 'page',
        'entity_type' => 'canvas_page',
        'id' => (string) $page->id(),
        'label' => 'Draft title',
        'auto_save_key' => 'canvas_page:' . $page->id() . ':en',
        'translatable' => TRUE,
        'default_langcode' => 'en',
        'published' => TRUE,
        'has_draft' => TRUE,
        'values' => $values,
        'from_default' => [],
        'refused' => NULL,
        'source' => NULL,
      ],
      'preview' => [
        'entity_type' => 'canvas_page',
        'id' => (string) $page->id(),
        'label' => 'Draft title',
        'url' => 'http://localhost/pricing',
        'published' => TRUE,
      ],
      'facts' => [
        'title' => ['label' => 'Title', 'kind' => 'text', 'value' => 'Draft title'],
        'description' => ['label' => 'Description', 'kind' => 'text', 'value' => 'Plans and prices for Example.'],
        'site' => ['label' => 'Site name', 'kind' => 'text', 'value' => 'Example'],
        'url' => ['label' => 'Page address', 'kind' => 'address', 'value' => 'http://localhost/pricing'],
        'author' => ['label' => 'Author', 'kind' => 'text', 'value' => 'Ada Writer'],
        'published' => [
          'label' => 'First published',
          'kind' => 'date',
          'value' => self::PUBLISHED,
          'text' => 'March 2, 2026',
        ],
        'modified' => [
          'label' => 'Last updated',
          'kind' => 'date',
          'value' => self::MODIFIED,
          'text' => 'March 4, 2026',
        ],
        'image' => ['label' => 'Image', 'kind' => 'image', 'value' => '', 'image' => $this->imageOf($hero)],
        'identity' => ['label' => 'This site', 'kind' => 'ref', 'value' => 'Example'],
      ],
      'separator' => '|',
      // A page links no field.
      'sources' => [],
      'broken' => [],
      // The site's default image is not one the user may view: absent.
      'media' => [
        $picked->uuid() => array_intersect_key($this->imageOf($picked), [
          'name' => 1,
          'thumb' => 1,
          'width' => 1,
          'height' => 1,
          'bytes' => 1,
        ]),
        $logo->uuid() => array_intersect_key($this->imageOf($logo), [
          'name' => 1,
          'thumb' => 1,
          'width' => 1,
          'height' => 1,
          'bytes' => 1,
        ]),
      ],
      'resolved' => json_decode((string) json_encode(array_diff_key($resolved, ['cacheability' => TRUE])), TRUE),
    ];
    foreach ($expected as $key => $value) {
      $key === 'media' ? self::assertEquals($value, $state[$key]) : self::assertSame($value, $state[$key], $key);
    }
    self::assertSame(['name', 'thumb', 'width', 'height', 'bytes'], array_keys($state['media'][$picked->uuid()]));
    // Core's medium (else thumbnail) style, which may also convert the format.
    self::assertMatchesRegularExpression('#/styles/(medium|thumbnail)/public/picked\.png(\.[a-z]+)?\?itok=#', $state['media'][$picked->uuid()]['thumb']);
    self::assertStringStartsWith('/', $state['media'][$picked->uuid()]['thumb']);
    // The output is that of the draft, in the documented shape.
    self::assertSame(['head', 'image', 'schema'], array_keys($state['resolved']));
    self::assertSame(['title', 'meta', 'link', 'script'], array_keys($state['resolved']['head']));
    self::assertSame('Pricing plans | Example', $state['resolved']['head']['title']);
    self::assertSame('noindex, max-image-preview:large', self::meta($state['resolved']['head'])['robots']);
    self::assertSame($this->imageOf($picked) + ['source' => 'override'], $state['resolved']['image']);
    // What only the dialog shows: a plain page has no search feature, and
    // no hand-added item to check.
    self::assertNull($state['resolved']['schema']['withheld']);
    self::assertSame([[
      'feature' => NULL,
      'node' => NULL,
      'verdict' => 'none',
    ],
    ], $state['resolved']['schema']['features']);
    self::assertSame([], $state['resolved']['schema']['rules']);
    self::assertSame([
      'Organization',
      'ImageObject',
      'WebSite',
      'WebPage',
      'ImageObject',
    ], array_column($state['resolved']['schema']['nodes'], 'type'));
    // The registry and the rules, in the dialog's language.
    self::assertSame('A product people buy', $state['registry']['Product']['kind']['label']);
    self::assertSame('Merchant listing', $state['search_features']['features']['merchant-listing']['label']);
    self::assertSame(SchemaGraph::searchFeatures()['reviewed'], $state['search_features']['reviewed']);
    self::assertSame('https://schema.org', $state['resolved']['head']['script'][0]['textContent']['@context']);

    // Someone who may view the page but not update it never receives a
    // draft value, a draft token or `has_draft: true`.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    $response = $this->request(Request::create(self::STATE . $query));
    $viewer = self::decodeResponse($response);
    self::assertStringNotContainsString('Draft title', (string) $response->getContent());
    self::assertStringNotContainsString('Pricing plans', (string) $response->getContent());
    self::assertSame(['target' => FALSE, 'site' => FALSE], $viewer['can']);
    self::assertSame(
      ['label' => 'Pricing', 'has_draft' => FALSE, 'values' => $stored],
      array_intersect_key($viewer['target'], ['label' => 1, 'has_draft' => 1, 'values' => 1]),
    );
    self::assertSame('Pricing', $viewer['facts']['title']['value']);
    self::assertSame('Pricing', $viewer['preview']['label']);
    self::assertSame('Pricing | Example', $viewer['resolved']['head']['title']);
    // Update access without the dialog's permission: the draft, read-only.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'administer canvas metatag']);
    $admin = self::decodeResponse($this->request(Request::create(self::STATE . $query)));
    self::assertSame(['target' => FALSE, 'site' => TRUE], $admin['can']);
    self::assertTrue($admin['target']['has_draft']);
    self::assertSame('Draft title', $admin['target']['label']);

    // A translation: named by the editor, else the negotiated one.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $translated = Page::load($page->id());
    $translated?->addTranslation('fr', ['title' => 'Tarifs', 'status' => TRUE, 'path' => ['alias' => '/tarifs']]);
    $translated?->save();
    $french = self::decodeResponse($this->request(Request::create(self::STATE . $query . '&langcode=fr')));
    self::assertSame('fr', $french['langcode']);
    self::assertSame(
      [
        'label' => 'Tarifs',
        'auto_save_key' => 'canvas_page:' . $page->id() . ':fr',
        'default_langcode' => 'en',
        'has_draft' => FALSE,
        'values' => [],
        'from_default' => $stored,
      ],
      array_intersect_key($french['target'], [
        'label' => 1,
        'auto_save_key' => 1,
        'default_langcode' => 1,
        'has_draft' => 1,
        'values' => 1,
        'from_default' => 1,
      ]),
    );
    self::assertSame('http://localhost/fr/tarifs', $french['preview']['url']);
    self::assertSame('Tarifs | Example', $french['resolved']['head']['title']);
    self::assertSame('en', self::decodeResponse($this->request(Request::create(self::STATE . $query)))['langcode']);
    self::assertSame('fr', self::decodeResponse($this->request(Request::create('/fr' . self::STATE . $query)))['langcode']);
    self::assertNull($french['target']['source']);

    // The source version's hand-added items are offered to copy while the
    // translation has none of its own. (The English draft is the source
    // while there is one: it goes first.)
    $auto_save->deleteAll();
    $items = '[{"@type": "Thing", "@id": "#a", "name": "A"}, {"@type": "Thing", "@id": "#b", "name": "B"}]';
    $english = Page::load($page->id());
    $english?->set('canvas_metatag', Values::encode(['schema' => ['custom' => $items]]))->save();
    $french = self::decodeResponse($this->request(Request::create(self::STATE . $query . '&langcode=fr')));
    self::assertSame(['langcode' => 'en', 'custom' => $items, 'count' => 2], $french['target']['source']);
    $english?->getTranslation('fr')->set('canvas_metatag', Values::encode(['schema' => ['custom' => '{"@type": "Thing", "name": "Oma"}']]))->save();
    $french = self::decodeResponse($this->request(Request::create(self::STATE . $query . '&langcode=fr')));
    self::assertNull($french['target']['source']);

    // Errors, each in the one shape.
    $unpublished = $this->createPage(['status' => FALSE]);
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    $errors = [
      $query . '&langcode=de' => [404, 'not_found'],
      '?entity_type=canvas_page&id=999' => [404, 'not_found'],
      '?entity_type=canvas_page&id=abc' => [404, 'not_found'],
      '?entity_type=canvas_page&id=' . $unpublished->id() => [403, 'forbidden'],
      '?entity_type=canvas_page' => [400, 'bad_request'],
      '?entity_type=canvas_page&id[]=1' => [400, 'bad_request'],
      $query . '&preview=1' => [400, 'bad_request'],
      '?entity_type=node&id=1' => [400, 'bad_request'],
      '?id=' . $page->id() => [400, 'bad_request'],
      '?langcode=en' => [400, 'bad_request'],
    ];
    foreach ($errors as $bad => [$status, $code]) {
      $response = $this->request(Request::create(self::STATE . $bad));
      self::assertSame($status, $response->getStatusCode(), $bad);
      $error = self::decodeResponse($response);
      self::assertSame(['error'], array_keys($error), $bad);
      self::assertSame(['code', 'message'], array_keys($error['error']), $bad);
      self::assertSame($code, $error['error']['code'], $bad);
      self::assertNotSame('', $error['error']['message'], $bad);
    }
  }

  /**
   * The state of a content template, previewed with one of its nodes.
   */
  public function testTemplateState(): void {
    $this->createField('field_byline', 'string', 'Byline');
    $this->createField('field_hero', 'entity_reference', 'Hero image', ['target_type' => 'media'], [
      'handler' => 'default:media',
      'handler_settings' => ['target_bundles' => ['image' => 'image']],
    ]);
    $this->createField('field_no_view_access', 'string', 'Notes');
    $hero = $this->createImage('Article hero');
    $stored = [
      'social' => ['image' => $this->linkTo('Hero image › Image', 'image')],
      'title_end' => ['text' => 'Blog'],
    ];
    $this->createTemplate(TRUE, $stored);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'uid' => $this->author->id(),
      'created' => strtotime(self::CREATED),
      'changed' => strtotime(self::CHANGED),
      'field_byline' => 'Grace Hopper',
      'field_hero' => $hero->id(),
    ]);
    $node->save();
    NodeType::create(['type' => 'note', 'name' => 'Note'])->save();
    $note = Node::create(['type' => 'note', 'title' => 'A note']);
    $note->save();
    $query = '?entity_type=content_template&id=node.article.full&preview=' . $node->id();

    // The template's editor writes a draft and sees it.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, ContentTemplate::ADMIN_PERMISSION, 'edit canvas metatag']);
    $values = ['schema' => ['type' => 'BlogPosting'], 'title' => $this->linkTo('Byline')];
    $template = ContentTemplate::load('node.article.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    $response = $this->request(Request::create('/canvas-metatag/api/draft/content_template/node.article.full', 'PUT', content: (string) json_encode([
      'values' => (object) $values,
      'client_instance_id' => self::CLIENT,
      'auto_saves' => ['content_template:node.article.full' => $this->container->get(AutoSaveManager::class)->getClientAutoSaveData($template)],
    ])));
    self::assertSame('{"values":' . json_encode($values) . '}', $response->getContent());

    $state = self::decodeResponse($this->request(Request::create(self::STATE . $query)));
    self::assertSame([
      'ui',
      'date_locale',
      'langcode',
      'languages',
      'origin',
      'headless',
      'can',
      'capabilities',
      'site',
      'registry',
      'codes',
      'module_ids',
      'extend_types',
      'vocabulary',
      'search_features',
      'target',
      'preview',
      'facts',
      'separator',
      'sources',
      'broken',
      'media',
      'resolved',
    ], array_keys($state));
    self::assertSame('en', $state['langcode']);
    self::assertSame(['target' => TRUE, 'site' => FALSE], $state['can']);
    self::assertSame([
      'scope' => 'template',
      'entity_type' => 'content_template',
      'id' => 'node.article.full',
      'label' => 'Article',
      'canvas_label' => 'Article content items — Full content view',
      'auto_save_key' => 'content_template:node.article.full',
      'translatable' => FALSE,
      'default_langcode' => NULL,
      'published' => TRUE,
      'has_draft' => TRUE,
      'values' => $values,
      'from_default' => [],
      'refused' => NULL,
      'source' => NULL,
    ], $state['target']);
    // A template's added type keeps the registry's: a blog post.
    self::assertSame([
      '#primary' => ['BlogPosting'],
      '#webpage' => ['WebPage'],
      '#identity' => ['Organization'],
    ], $state['extend_types']);
    self::assertSame([
      'entity_type' => 'node',
      'id' => (string) $node->id(),
      'label' => 'Hello',
      'url' => 'http://localhost/node/' . $node->id(),
      'published' => TRUE,
    ], $state['preview']);
    // The facts every entity has; the type's fields with the previewed
    // node's values.
    self::assertSame([
      'title',
      'description',
      'site',
      'url',
      'author',
      'published',
      'modified',
      'image',
      'identity',
    ], array_keys($state['facts']));
    self::assertSame($this->imageOf($hero), $state['facts']['image']['image']);
    $rows = array_column($state['sources'], NULL, 'label');
    self::assertSame(
      [
        'source' => $this->linkTo('Byline')['source'],
        'label' => 'Byline',
        'path' => ['Byline'],
        'field' => 'field_byline',
        'hop' => FALSE,
        'kinds' => ['text'],
        'status' => 'ok',
        'value' => 'Grace Hopper',
        // What a place that composes reads: the server's words.
        'text' => 'Grace Hopper',
      ],
      $rows['Byline'],
    );
    // A link reads the image through its file: it is named by the file.
    $linked = array_replace($this->imageOf($hero), ['name' => 'article-hero.png']);
    self::assertSame($linked, $rows['Hero image › Image']['image']);
    // A field visitors may not view is listed, with no value.
    self::assertSame(['hidden', ''], [$rows['Notes']['status'], $rows['Notes']['value']]);
    self::assertSame([], $state['broken']);
    self::assertSame('Grace Hopper | Example', $state['resolved']['head']['title']);
    self::assertSame('article', self::meta($state['resolved']['head'])['og:type']);
    self::assertSame($this->imageOf($hero) + ['source' => 'entity'], $state['resolved']['image']);
    // The report: the blog post ships, judged as an article.
    $schema = $state['resolved']['schema'];
    self::assertSame([
      NULL,
      [],
      'BlogPosting',
      NULL,
    ], [$schema['withheld'], $schema['dropped'], $schema['type'], $schema['unknown_type']]);
    self::assertSame(['article'], array_column($schema['features'], 'feature'));
    self::assertSame('main', array_column($schema['nodes'], 'origin', 'type')['BlogPosting']);
    self::assertSame([], $schema['rules']);

    // Someone who may use Canvas but not update the template gets what is
    // stored.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $response = $this->request(Request::create(self::STATE . $query));
    $viewer = self::decodeResponse($response);
    // The draft's type is nowhere but in the registry and the rules.
    self::assertStringNotContainsString('BlogPosting', (string) json_encode(array_diff_key($viewer, [
      'registry' => TRUE,
      'search_features' => TRUE,
    ])));
    self::assertSame(['target' => FALSE, 'site' => FALSE], $viewer['can']);
    self::assertSame(['has_draft' => FALSE, 'values' => $stored], array_intersect_key($viewer['target'], [
      'has_draft' => 1,
      'values' => 1,
    ]));
    self::assertSame('Hello | Blog', $viewer['resolved']['head']['title']);
    // An image linked to a field comes from the entity.
    self::assertSame('entity', $viewer['resolved']['image']['source']);

    // A stored value is edited as it is stored: a configuration override of
    // the template reaches the output only.
    $GLOBALS['config']['canvas.content_template.node.article.full']['third_party_settings']['canvas_metatag']['values']['title'] = ['text' => 'Overridden'];
    $this->container->get('config.factory')->clearStaticCache();
    $this->container->get('entity_type.manager')->getStorage(ContentTemplate::ENTITY_TYPE_ID)->resetCache();
    $overridden = self::decodeResponse($this->request(Request::create(self::STATE . $query)));
    self::assertSame($stored, $overridden['target']['values']);
    self::assertSame('Overridden | Blog', $overridden['resolved']['head']['title']);
    // The ending too: the dialog keeps the stored "Blog".
    $GLOBALS['config']['canvas.content_template.node.article.full']['third_party_settings']['canvas_metatag']['values']['title_end'] = ['text' => 'Override'];
    $this->container->get('config.factory')->clearStaticCache();
    $this->container->get('entity_type.manager')->getStorage(ContentTemplate::ENTITY_TYPE_ID)->resetCache();
    $overridden = self::decodeResponse($this->request(Request::create(self::STATE . $query)));
    self::assertSame(['text' => 'Blog'], $overridden['target']['values']['title_end']);
    self::assertSame('Overridden | Override', $overridden['resolved']['head']['title']);
    unset($GLOBALS['config']['canvas.content_template.node.article.full']);
    $this->container->get('config.factory')->clearStaticCache();
    $this->container->get('entity_type.manager')->getStorage(ContentTemplate::ENTITY_TYPE_ID)->resetCache();

    // An unpublished node to preview with is named as such.
    $draft_node = Node::create([
      'type' => 'article',
      'title' => 'Draft',
      'status' => FALSE,
      'uid' => $this->author->id(),
      'field_byline' => 'Byline being written',
      'field_no_view_access' => 'Secret notes',
    ]);
    $draft_node->save();
    $this->setUpCurrentUser(permissions: [
      ...self::VISITOR,
      ContentTemplate::ADMIN_PERMISSION,
      'edit canvas metatag',
      'bypass node access',
    ]);
    $draft_query = '?entity_type=content_template&id=node.article.full&preview=' . $draft_node->id();
    $response = $this->request(Request::create(self::STATE . $draft_query));
    $unpublished = self::decodeResponse($response);
    self::assertSame(['Draft', FALSE], [$unpublished['preview']['label'], $unpublished['preview']['published']]);
    // A node visitors cannot view yet is read with the editor's access, and
    // a field this editor may not view is not sent.
    self::assertSame('Byline being written', array_column($unpublished['sources'], 'value', 'label')['Byline']);
    self::assertStringNotContainsString('Secret notes', (string) $response->getContent());

    // A stored link to a field that is gone is listed as broken.
    $template = ContentTemplate::load('node.article.full');
    \assert($template instanceof ContentTemplate);
    $gone = ['source' => ['expression' => 'ℹ︎␜entity:node:article␝field_gone␞␟value', 'sourceType' => 'entity-field']];
    // A job description is formatted text: a plain text field cannot give
    // it, as saving and the head read it.
    $byline = [
      'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
    ];
    $this->container->get(AutoSaveManager::class)->saveEntity((clone $template)->setThirdPartySetting('canvas_metatag', 'values', [
      'description' => $gone,
      'schema' => ['type' => 'JobPosting', 'props' => ['description' => $byline]],
    ]), self::CLIENT);
    self::assertSame([
      'description' => [
        'path' => 'description',
        'field' => 'field_gone',
        'reason' => 'missing',
      ],
      'schema.props.description' => [
        'path' => 'schema.props.description',
        'field' => 'field_byline',
        'reason' => 'kind',
      ],
    ], self::decodeResponse($this->request(Request::create(self::STATE . $query)))['broken']);

    $errors = [
      $query . '&langcode=en' => [400, 'bad_request'],
      '?entity_type=content_template&id=node.article.full&langcode=en' => [400, 'bad_request'],
      '?entity_type=content_template&preview=' . $node->id() => [400, 'bad_request'],
      '?entity_type=content_template&id=node.article.full&preview[]=1' => [400, 'bad_request'],
      '?entity_type=content_template&id=node.article.full&preview=999' => [404, 'not_found'],
      '?entity_type=content_template&id=node.article.full&preview=' . $note->id() => [404, 'not_found'],
      '?entity_type=content_template&id=node.note.full&preview=' . $note->id() => [404, 'not_found'],
    ];
    foreach ($errors as $bad => [$status, $code]) {
      $response = $this->request(Request::create(self::STATE . $bad));
      self::assertSame($status, $response->getStatusCode(), $bad);
      self::assertSame($code, self::decodeResponse($response)['error']['code'], $bad);
    }
    // Without access to Canvas the template cannot be viewed at all.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    $response = $this->request(Request::create(self::STATE . $query));
    self::assertSame(403, $response->getStatusCode());
    self::assertSame('forbidden', self::decodeResponse($response)['error']['code']);
  }

  /**
   * The state of a template without a node to preview: values, no output.
   */
  public function testTemplateWithoutNodes(): void {
    $this->createField('field_byline', 'string', 'Byline');
    $this->createField('field_body', 'text_with_summary', 'Body');
    $this->createField('field_hero', 'image', 'Hero image');
    $stored = ['title_end' => ['text' => 'News']];
    $this->createTemplate(TRUE, $stored);
    ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => 'article',
      'content_entity_type_view_mode' => 'teaser',
      'component_tree' => [],
    ])->save();
    $query = '?entity_type=content_template&id=node.article.full';

    $this->setUpCurrentUser(permissions: [...self::VISITOR, ContentTemplate::ADMIN_PERMISSION, 'edit canvas metatag']);
    $response = $this->request(Request::create(self::STATE . $query));
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    $state = self::decodeResponse($response);
    self::assertSame(
      ['template', 'node.article.full', 'Article', $stored],
      [$state['target']['scope'], $state['target']['id'], $state['target']['label'], $state['target']['values']],
    );
    self::assertNull($state['preview']);
    self::assertNull($state['resolved']);
    // The type's fields and the facts, without values but the site name.
    $byline = array_values(array_filter($state['sources'], static fn (array $row): bool => $row['label'] === 'Byline'))[0];
    self::assertSame(['none', ''], [$byline['status'], $byline['value']]);
    self::assertSame(['', 'Example'], array_values(array_unique(array_column($state['facts'], 'value'))));
    // Description and Image still name the fields they come from: the link
    // menu offers them, and the Default box says "from Body".
    self::assertSame(['Body', 'Hero image'], [
      $state['facts']['description']['via'] ?? NULL,
      $state['facts']['image']['via'] ?? NULL,
    ]);

    // The draft, for who may update the template.
    $template = ContentTemplate::load('node.article.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    $draft = ['title_end' => ['text' => 'Updates']];
    $this->container->get(AutoSaveManager::class)->saveEntity((clone $template)->setThirdPartySetting('canvas_metatag', 'values', $draft), self::CLIENT);
    self::assertSame($draft, self::decodeResponse($this->request(Request::create(self::STATE . $query)))['target']['values']);

    // Any other template, or a type without a Full template (Canvas still
    // serves its route; the dialog then shows Site settings), is not found;
    // no Canvas access is forbidden.
    foreach (['node.article.teaser', 'node.page.full'] as $id) {
      $response = $this->request(Request::create(self::STATE . "?entity_type=content_template&id=$id"));
      $code = self::decodeResponse($response)['error']['code'];
      self::assertSame([404, 'not_found'], [$response->getStatusCode(), $code], $id);
    }
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    $response = $this->request(Request::create(self::STATE . $query));
    self::assertSame([
      403,
      'forbidden',
    ], [$response->getStatusCode(), self::decodeResponse($response)['error']['code']]);
  }

  /**
   * The state with no context, saving site settings, and capabilities.
   */
  public function testSite(): void {
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'administer canvas metatag']);
    // No page at all: the facts, empty but the site name, and no output.
    $response = $this->request(Request::create(self::STATE));
    self::assertStringContainsString('"media":{}', (string) $response->getContent());
    $state = self::decodeResponse($response);
    self::assertSame([
      'ui',
      'date_locale',
      'langcode',
      'languages',
      'origin',
      'headless',
      'can',
      'capabilities',
      'site',
      'registry',
      'codes',
      'module_ids',
      'extend_types',
      'vocabulary',
      'search_features',
      'target',
      'preview',
      'facts',
      'separator',
      'sources',
      'broken',
      'media',
      'resolved',
    ], array_keys($state));
    self::assertSame(['en', NULL, NULL, NULL], [
      $state['langcode'],
      $state['target'],
      $state['preview'],
      $state['resolved'],
    ]);
    self::assertSame(['target' => FALSE, 'site' => TRUE], $state['can']);
    self::assertSame([
      'title',
      'description',
      'site',
      'url',
      'author',
      'published',
      'modified',
      'image',
      'identity',
    ], array_keys($state['facts']));
    self::assertSame(['', 'Example'], array_values(array_unique(array_column($state['facts'], 'value'))));
    self::assertSame(['label' => 'Image', 'kind' => 'image', 'value' => '', 'image' => NULL], $state['facts']['image']);
    self::assertSame(['|', [], []], [$state['separator'], $state['sources'], $state['broken']]);

    // The page to preview with: the published page that changed last, or
    // the front page when it is a Canvas page.
    $older = $this->createPage(['title' => 'Older', 'path' => ['alias' => '/older']]);
    $newer = $this->createPage([
      'title' => 'Newer',
      'changed' => strtotime(self::CHANGED) + 60,
      'path' => ['alias' => '/newer'],
    ]);
    $this->createPage(['title' => 'Unpublished', 'status' => FALSE, 'changed' => strtotime(self::CHANGED) + 120]);
    $state = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame([
      'entity_type' => 'canvas_page',
      'id' => (string) $newer->id(),
      'label' => 'Newer',
      'url' => 'http://localhost/newer',
      'published' => TRUE,
    ], $state['preview']);
    self::assertNull($state['target']);
    self::assertSame('Newer', $state['facts']['title']['value']);
    self::assertSame('Newer | Example', $state['resolved']['head']['title']);
    foreach (['/page/' . $older->id(), '/older'] as $front) {
      $this->config('system.site')->set('page.front', $front)->save();
      $state = self::decodeResponse($this->request(Request::create(self::STATE)));
      self::assertSame(
        ['id' => (string) $older->id(), 'url' => 'http://localhost/'],
        array_intersect_key($state['preview'], ['id' => 1, 'url' => 1]),
        $front,
      );
    }

    // What the dialog edits is what is stored: a configuration override
    // shows in the output and not in the editable values.
    $GLOBALS['config']['canvas_metatag.site']['values']['robots']['noindex'] = TRUE;
    $GLOBALS['config']['canvas_metatag.site']['identity']['name'] = 'Staging';
    $this->container->get('config.factory')->clearStaticCache();
    $state = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame(['robots' => ['max_image_preview' => 'large']], $state['site']['values']);
    self::assertSame('', $state['site']['identity']['name']);
    self::assertSame('noindex, max-image-preview:large', self::meta($state['resolved']['head'])['robots']);
    self::assertSame('Older | Staging', $state['resolved']['head']['title']);

    // Refused as a whole, with one sentence per field.
    $logo = $this->createImage('Logo');
    $response = $this->putSite([
      'identity' => [
        'kind' => 'robot',
        'separator' => 'ab',
        'logo' => 'nope',
        'same_as' => ['https://social.example.com/example', 'example'],
      ],
      'values' => [
        'title' => ['text' => 'Every page'],
        'title_end' => [
          'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_x␞␟value', 'sourceType' => 'entity-field'],
        ],
        'description' => ['text' => 'Site-wide'],
        'robots' => ['max_snippet' => 2000],
      ],
    ]);
    self::assertSame(422, $response->getStatusCode());
    $error = self::decodeResponse($response)['error'];
    self::assertSame(['code', 'message', 'fields'], array_keys($error));
    self::assertSame(['invalid', 'Some values need attention.'], [$error['code'], $error['message']]);
    self::assertEqualsCanonicalizing(
      [
        'title',
        'title_end',
        'description',
        'robots.max_snippet',
        'identity.kind',
        'identity.separator',
        'identity.logo',
        'identity.same_as.1',
      ],
      array_keys($error['fields']),
    );
    self::assertSame('Line 2 is not a full address. Start with https://.', $error['fields']['identity.same_as.1']);
    self::assertSame('This setting is not available here.', $error['fields']['title_end']);
    self::assertSame('', $this->config('canvas_metatag.site')->getRawData()['identity']['name']);

    // Saved at once, and what is saved is what was sent: no override.
    $identity = [
      'kind' => 'person',
      'name' => 'Ada Writer',
      'separator' => '·',
      'logo' => $logo->uuid(),
      'default_image' => '',
      'same_as' => ['https://social.example.com/ada'],
    ];
    $values = ['robots' => ['nofollow' => TRUE], 'title_end' => ['text' => 'Example Co']];
    // Sent in another order, with empties: the answer is canonical.
    $response = $this->putSite([
      'values' => ['title_end' => $values['title_end'], 'robots' => ['nofollow' => TRUE]],
      'identity' => array_reverse($identity, TRUE),
    ]);
    self::assertSame(200, $response->getStatusCode());
    self::assertSame((string) json_encode([
      'site' => [
        'identity' => $identity,
        'values' => $values,
        'currency' => '',
      ],
    ]), $response->getContent());
    $raw = $this->config('canvas_metatag.site')->getRawData();
    self::assertSame($identity, $raw['identity']);
    self::assertEquals($values, $raw['values']);
    $state = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame([
      'identity' => $identity,
      'values' => $values,
      'currency' => '',
      'country' => '',
      'timezone' => 'Europe/Helsinki',
    ], $state['site']);
    // The site's default country is what a country picker suggests.
    $this->config('system.date')->set('country.default', 'FI')->save();
    self::assertSame('FI', self::decodeResponse($this->request(Request::create(self::STATE)))['site']['country']);

    // The site currency: a code, never a symbol; kept when a save leaves it
    // out.
    $response = $this->putSite(['identity' => $identity, 'values' => $values, 'currency' => '€']);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame(['currency' => 'Choose a currency code from the list, such as EUR.'], self::decodeResponse($response)['error']['fields']);
    self::assertSame(200, $this->putSite([
      'identity' => $identity,
      'values' => $values,
      'currency' => 'EUR',
    ])->getStatusCode());
    self::assertSame('EUR', $this->config('canvas_metatag.site')->get('currency'));
    self::assertSame('EUR', self::decodeResponse($this->putSite([
      'identity' => $identity,
      'values' => $values,
    ]))['site']['currency']);
    self::assertSame('EUR', self::decodeResponse($this->request(Request::create(self::STATE)))['site']['currency']);
    self::assertSame([$logo->uuid()], array_keys($state['media']));
    unset($GLOBALS['config']['canvas_metatag.site']);
    $this->container->get('config.factory')->clearStaticCache();
    $state = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame('Older · Example Co', $state['resolved']['head']['title']);
    self::assertSame('nofollow', self::meta($state['resolved']['head'])['robots']);
    // Clearing everything leaves the identity defaults and no values.
    $response = $this->putSite(['identity' => [], 'values' => []]);
    self::assertStringContainsString('"values":{}', (string) $response->getContent());
    self::assertSame('|', self::decodeResponse($response)['site']['identity']['separator']);

    // A body that cannot be used, including one that is too large.
    $bad = [
      'dry run not a flag' => '{"identity":{},"values":{},"dry_run":"yes"}',
      'not json' => '{"identity":',

      'not an object' => '"text"',
      'no identity' => '{"values":{}}',
      'no values' => '{"identity":{}}',
      'values a list' => '{"identity":{},"values":["a"]}',
      // Decoded to arrays, an empty list and an empty object are alike.
      'values an empty list' => '{"identity":{},"values":[]}',
      'identity an empty list' => '{"identity":[],"values":{}}',
      'identity a string' => '{"identity":"x","values":{}}',
      'too large' => (string) json_encode(['identity' => [], 'values' => [], 'padding' => str_repeat('a', 131072)]),
    ];
    foreach ($bad as $label => $content) {
      $response = $this->request(Request::create(self::SITE, 'PUT', content: $content));
      self::assertSame(400, $response->getStatusCode(), $label);
      self::assertSame([
        'error' => [
          'code' => 'bad_request',
          'message' => 'The request could not be read.',
        ],
      ], self::decodeResponse($response), $label);
    }
    self::assertSame('|', $this->config('canvas_metatag.site')->get('identity.separator'));

    // The capabilities member is filled through the alter hook, here by
    // the AI submodule, and only for who may use it.
    $modules = ['key', 'ai', 'canvas_metatag_ai'];
    if (array_diff($modules, array_keys($this->container->get('extension.list.module')->getList()))) {
      return;
    }
    $this->enableModules($modules);
    $this->installConfig(['ai']);
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    self::assertSame(['ai' => NULL], self::decodeResponse($this->request(Request::create(self::STATE)))['capabilities']);
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag', 'use canvas metatag ai']);
    self::assertSame([
      'ai' => [
        'available' => FALSE,
        'reason' => 'no_provider',
      ],
    ], self::decodeResponse($this->request(Request::create(self::STATE)))['capabilities']);
  }

  /**
   * A site value that is not one the site may hold is never used.
   */
  public function testSiteIgnoresStoredLinks(): void {
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'administer canvas metatag']);
    // A configuration import stored an ending linked to a field.
    $this->config('canvas_metatag.site')->set('values.title_end', [
      'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_x␞␟value', 'sourceType' => 'entity-field'],
    ])->save();
    $this->createPage();
    $state = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame(['robots' => ['max_image_preview' => 'large']], $state['site']['values']);
    self::assertSame('Pricing | Example', $state['resolved']['head']['title']);

    // Saving the identity writes the values the dialog shows.
    $logo = $this->createImage('Logo');
    $identity = ['logo' => $logo->uuid()] + $state['site']['identity'];
    $response = $this->putSite(['identity' => $identity, 'values' => $state['site']['values']]);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    self::assertSame($logo->uuid(), $this->config('canvas_metatag.site')->get('identity.logo'));
    self::assertNull($this->config('canvas_metatag.site')->get('values.title_end'));
  }

  /**
   * The picker's list: image media the user may view, newest first, paged.
   */
  public function testMedia(): void {
    $this->createMediaType('file', ['id' => 'document', 'label' => 'Document']);
    Media::create(['bundle' => 'document', 'name' => 'A document'])->save();
    $created = strtotime(self::CREATED);
    for ($i = 1; $i <= 26; $i++) {
      $this->createImage("Image $i", ['alt' => "Alt $i"], ['created' => $created + $i]);
    }
    $this->createImage('Unpublished', values: ['status' => FALSE, 'created' => $created + 100]);
    // A file that is not public is never emitted, so it is not offered.
    $this->createImage('Not public', values: ['created' => $created], scheme: 'temporary');
    $special = $this->createImage('Pricing hero', [
      'alt' => 'Pricing table',
      'width' => 640,
      'height' => 480,
    ], ['created' => $created + 50]);

    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    $first = self::decodeResponse($this->request(Request::create(self::MEDIA)));
    self::assertSame(['items', 'more'], array_keys($first));
    self::assertTrue($first['more']);
    self::assertCount(24, $first['items']);
    // Newest first; no document, nothing unpublished.
    self::assertSame([
      'Pricing hero',
      'Image 26',
      'Image 25',
    ], array_slice(array_column($first['items'], 'name'), 0, 3));
    self::assertSame([
      'uuid' => $special->uuid(),
      'name' => 'Pricing hero',
      'thumb' => $this->imageOf($special)['thumb'],
      'width' => 640,
      'height' => 480,
      'bytes' => $this->imageOf($special)['bytes'],
      'alt' => 'Pricing table',
    ], $first['items'][0]);
    // The first page is page 0.
    self::assertSame($first, self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=&page=0'))));
    self::assertSame($first, self::decodeResponse($this->request(Request::create(self::MEDIA . '?page=x'))));
    $second = self::decodeResponse($this->request(Request::create(self::MEDIA . '?page=1')));
    self::assertSame(['Image 3', 'Image 2', 'Image 1'], array_column($second['items'], 'name'));
    self::assertFalse($second['more']);
    self::assertSame([
      'items' => [],
      'more' => FALSE,
    ], self::decodeResponse($this->request(Request::create(self::MEDIA . '?page=2'))));
    // Filtered by name.
    $found = self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=' . urlencode(' hero '))));
    self::assertSame(['Pricing hero'], array_column($found['items'], 'name'));
    self::assertFalse($found['more']);
    self::assertCount(11, self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=Image+1')))['items']);
    self::assertSame([
      'items' => [],
      'more' => FALSE,
    ], self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=Unpublished'))));
    self::assertSame([
      'items' => [],
      'more' => FALSE,
    ], self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=public'))));

    // Someone who may see unpublished media is not offered it either: an
    // unpublished image is never emitted, so picking it would do nothing.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag', 'administer media']);
    $listed = self::decodeResponse($this->request(Request::create(self::MEDIA)));
    self::assertSame('Pricing hero', $listed['items'][0]['name']);
    self::assertSame([
      'items' => [],
      'more' => FALSE,
    ], self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=Unpublished'))));
    // And someone who may not view media gets nothing.
    $this->setUpCurrentUser(permissions: ['access content', 'edit canvas metatag']);
    self::assertSame([
      'items' => [],
      'more' => FALSE,
    ], self::decodeResponse($this->request(Request::create(self::MEDIA))));
  }

  /**
   * Writes follow what the dialog shows: inherited types and kept values.
   */
  public function testWritesFollowTheShownValues(): void {
    $this->setUpCurrentUser(permissions: [
      ...self::VISITOR,
      Page::EDIT_PERMISSION,
      ContentTemplate::ADMIN_PERMISSION,
      'edit canvas metatag',
    ]);

    // A translation inherits the type of the default version; the details
    // of that type are its own, stored without a type.
    $page = $this->createPage(['canvas_metatag' => Values::encode(['schema' => ['type' => 'Product']])]);
    $page->addTranslation('fr', ['title' => 'Tarifs', 'status' => TRUE, 'path' => ['alias' => '/tarifs']])->save();
    $french = Page::load($page->id())?->getTranslation('fr');
    \assert($french instanceof Page);
    $values = [
      'schema' => [
        'props' => [
          'name' => ['text' => 'Bureau'],
          'offers_price' => ['text' => '49'],
          'offers_priceCurrency' => ['text' => 'EUR'],
        ],
      ],
    ];
    $path = "/canvas-metatag/api/draft/canvas_page/{$page->id()}";
    $response = $this->putDraft($path, $french, $values, ['langcode' => 'fr']);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    $state = self::decodeResponse($this->request(Request::create(self::STATE . '?entity_type=canvas_page&id=' . $page->id() . '&langcode=fr')));
    self::assertSame($values, $state['target']['values']);
    self::assertNull($state['resolved']['schema']['withheld']);
    $graph = self::graph($state['resolved']['head']);
    self::assertSame(['Product', 'Bureau'], [$graph['primary']['@type'], $graph['primary']['name']]);
    // The default version names no type of its own here: WebPage.
    $english = Page::load($page->id());
    \assert($english instanceof Page);
    $response = $this->putDraft($path, $english, $values, ['langcode' => 'en']);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame([
      'schema.props.name',
      'schema.props.offers_price',
      'schema.props.offers_priceCurrency',
    ], array_keys(self::decodeResponse($response)['error']['fields']));

    // A page links no field, in any write.
    $response = $this->putDraft($path, $english, [
      'title_end' => [
        'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
      ],
      'canonical' => 'pricing',
    ], ['langcode' => 'en']);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame([
      'title_end' => 'This setting is not available here.',
      'canonical' => 'Enter a full address that starts with https://, or a path that starts with /.',
    ], self::decodeResponse($response)['error']['fields']);
    // A refused write makes no draft.
    self::assertTrue($this->container->get(AutoSaveManager::class)->getAutoSaveEntity($english, TRUE)->isEmpty());

    // A template value linked to a field that no longer exists is carried
    // as it is: the other fields stay savable. Linking another field the
    // menu does not offer is refused.
    $this->createField('field_byline', 'string', 'Byline');
    $this->createField('field_when', 'datetime', 'When', ['datetime_type' => 'datetime']);
    $gone = ['source' => ['expression' => 'ℹ︎␜entity:node:article␝field_gone␞␟value', 'sourceType' => 'entity-field']];
    $template = $this->createTemplate(TRUE, ['description' => $gone]);
    $path = '/canvas-metatag/api/draft/content_template/' . $template->id();
    $response = $this->putDraft($path, $template, ['description' => $gone, 'title' => ['text' => 'New']]);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    self::assertSame([
      'values' => [
        'description' => $gone,
        'title' => ['text' => 'New'],
      ],
    ], json_decode((string) $response->getContent(), TRUE));
    $refused = [
      // An expression the menu does not offer.
      [
        'source' => [
          'expression' => 'ℹ︎␜entity:node:article␝uid␞␟entity␜␜entity:user␝mail␞␟value',
          'sourceType' => 'entity-field',
        ],
      ],
      // A field that is gone, newly linked.
      ['source' => ['expression' => 'ℹ︎␜entity:node:article␝field_other_gone␞␟value', 'sourceType' => 'entity-field']],
    ];
    foreach ($refused as $source) {
      $response = $this->putDraft($path, $template, ['description' => $source]);
      self::assertSame(422, $response->getStatusCode());
      self::assertSame(['description' => 'Choose a field from the list.'], self::decodeResponse($response)['error']['fields']);
    }
    // A date reads as words in the description, which composes; never as
    // the title ending, which doesn't.
    $response = $this->putDraft($path, $template, ['title_end' => $this->linkTo('When', 'date')]);
    self::assertSame(['title_end' => 'Choose a field from the list.'], self::decodeResponse($response)['error']['fields']);
    self::assertSame(200, $this->putDraft($path, $template, ['description' => $this->linkTo('When', 'date')])->getStatusCode());
    // The lone date link gives the date in words, and is not broken.
    $this->config('system.date')->set('country.default', 'GB')->save();
    $dated = Node::create([
      'type' => 'article',
      'title' => 'Dated',
      'status' => 1,
      'field_when' => '2026-06-20T09:00:00',
    ]);
    $dated->save();
    $state = self::decodeResponse($this->request(Request::create(self::STATE . '?entity_type=content_template&id=' . $template->id() . '&preview=' . $dated->id())));
    self::assertSame('20 June 2026', self::meta($state['resolved']['head'])['description']);
    self::assertArrayNotHasKey('description', $state['broken']);
    $response = $this->putDraft($path, $template, ['description' => $this->linkTo('Byline')]);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    // Undo back to the stored link while the draft holds another: the value
    // the template has stored is carried too.
    $response = $this->putDraft($path, $template, ['description' => $gone]);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    self::assertSame(['values' => ['description' => $gone]], json_decode((string) $response->getContent(), TRUE));
    $response = $this->putDraft($path, $template, []);
    self::assertSame('{"values":{}}', $response->getContent());
  }

  /**
   * A refused hand-added text says where it is, beside its sentence.
   */
  public function testCustomJsonLdErrorPath(): void {
    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $page = $this->createPage();
    $path = "/canvas-metatag/api/draft/canvas_page/{$page->id()}";
    $response = $this->putDraft($path, $page, ['schema' => ['custom' => '{"@type": "Rating", "ratingValue": 1e400}']], ['langcode' => 'en']);
    self::assertSame(422, $response->getStatusCode());
    $error = self::decodeResponse($response)['error'];
    // Existing readers of the sentence are unchanged.
    self::assertSame(['schema.custom' => 'ratingValue: this number is too large to use.'], $error['fields']);
    self::assertSame(['schema.custom' => ['item' => 0, 'path' => '/ratingValue']], $error['error_paths']);

    // Added details: a type changed is refused at its node.
    $response = $this->putDraft($path, $page, ['schema' => ['extend' => ['#webpage' => '{"@type": "AboutPage"}']]], ['langcode' => 'en']);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame(['item' => 0, 'path' => '/@type'], self::decodeResponse($response)['error']['error_paths']['schema.extend.#webpage']);

    // The site's own id, written as its full address, is the site's.
    $state = self::decodeResponse($this->request(Request::create(self::STATE . '?entity_type=canvas_page&id=' . $page->id())));
    $home = $state['origin']['url'] . '/';
    $response = $this->putDraft($path, $page, ['schema' => ['custom' => '{"@type": "Organization", "@id": "' . $home . '#identity"}']], ['langcode' => 'en']);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame([
      'identity' => 'home',
      'logo' => 'home',
      'website' => 'home',
      'return-policy' => 'home',
      'webpage' => 'url',
      'primaryimage' => 'url',
      'primary' => 'url',
      'group' => 'url',
      'breadcrumb' => 'url',
    ], $state['module_ids']);

    // Stored as written, details added, a main thing: all travel in the
    // draft and reach the head.
    $custom = "[\n  {\n    \"@type\": \"Recipe\",\n    \"@id\": \"#x-recipe\",\n    \"name\": \"Rye bread\"\n  }\n]";
    $values = [
      'schema' => ['custom' => $custom, 'extend' => ['#webpage' => '{"keywords": "bread"}'], 'main' => '#x-recipe'],
    ];
    $response = $this->putDraft($path, $page, $values, ['langcode' => 'en']);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    $state = self::decodeResponse($this->request(Request::create(self::STATE . '?entity_type=canvas_page&id=' . $page->id())));
    self::assertSame($values, $state['target']['values']);
    $graph = self::graph($state['resolved']['head']);
    self::assertSame('bread', $graph['webpage']['keywords']);
    self::assertSame(['@id' => $graph['webpage']['url'] . '#x-recipe'], $graph['webpage']['mainEntity']);

    // The 32 KB the texts share: an unchanged stored text with new details
    // over the cap is refused at the details, never saved without them.
    $big = json_encode(['@type' => 'Recipe', '@id' => '#x-big', 'description' => str_repeat('a', 20000)]);
    $response = $this->putDraft($path, $page, ['schema' => ['custom' => $big]], ['langcode' => 'en']);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    $details = json_encode(['keywords' => str_repeat('b', 14000)]);
    $grown = ['schema' => ['custom' => $big, 'extend' => ['#webpage' => $details]]];
    $response = $this->putDraft($path, $page, $grown, ['langcode' => 'en']);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame(['schema.extend.#webpage' => '34 KB. Keep under 32 KB, including added details.'], self::decodeResponse($response)['error']['fields']);
    $state = self::decodeResponse($this->request(Request::create(self::STATE . '?entity_type=canvas_page&id=' . $page->id())));
    self::assertSame(['schema' => ['custom' => $big]], $state['target']['values']);
  }

  /**
   * A page with hand-added items opens on a host no visitor reaches.
   *
   * Its head ships no graph, so the rules have nothing to judge, and the
   * report says why the addresses are left out.
   */
  public function testUnaddressedPageWithHandAddedItems(): void {
    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $custom = '{"@type": "Recipe", "@id": "#x-recipe", "name": "Rye bread", "url": "rye"}';
    $values = ['schema' => ['custom' => $custom, 'extend' => ['#webpage' => '{"keywords": "bread"}']]];
    $page = $this->createPage(['canvas_metatag' => Values::encode($values)]);
    $query = self::STATE . '?entity_type=canvas_page&id=' . $page->id();
    $schema = fn (string $drupal): array => self::decodeResponse($this->request(Request::create($drupal . $query)))['resolved']['schema'];

    // Addressed, the hand-added item's relative address is a rule.
    self::assertSame('relative', $schema('https://cms.example.test')['rules'][0]['rule'] ?? NULL);

    $this->setSetting('canvas_metatag_public_base', 'http://localhost:3000');
    $response = $this->request(Request::create('https://cms.example.com' . $query));
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    $report = self::decodeResponse($response)['resolved']['schema'];
    self::assertTrue($report['unaddressed']);
    self::assertSame([], $report['rules']);
  }

  /**
   * Sends a draft write as the editor's client, with the current draft state.
   */
  private function putDraft(string $path, EntityInterface $entity, array $values, array $body = []): Response {
    $auto_save = $this->container->get(AutoSaveManager::class);
    return $this->request(Request::create($path, 'PUT', content: (string) json_encode($body + [
      'values' => (object) $values,
      'client_instance_id' => self::CLIENT,
      'auto_saves' => [AutoSaveManager::getAutoSaveKey($entity) => $auto_save->getClientAutoSaveData($entity)],
    ])));
  }

  /**
   * The status of a request; a denial at the route is a 403.
   */
  private function statusOf(Request $request): int {
    try {
      return $this->request($request)->getStatusCode();
    }
    catch (AccessDeniedHttpException) {
      return 403;
    }
    catch (NotFoundHttpException) {
      return 404;
    }
  }

  /**
   * An editor's report reads the page's chrome as a draft, and says so.
   */
  public function testChromeDraft(): void {
    $this->createChrome();
    $this->createPage(['title' => 'Shop', 'path' => ['alias' => '/shop']]);
    $page = $this->createPage(['title' => 'Lamps', 'path' => ['alias' => '/shop/lamps']]);
    // A breadcrumb placed in the variant's draft only.
    $variant = PageVariant::load('chrome');
    $variant->setComponentTree([
      self::breadcrumb(),
      self::placed('cccccccc-0000-4000-8000-000000000001', Marker::PAGE_CONTENT_COMPONENT_ID),
    ]);
    $this->container->get(AutoSaveManager::class)->saveEntity($variant);
    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $state = self::decodeResponse($this->request(Request::create(self::STATE . '?entity_type=canvas_page&id=' . $page->id())));
    self::assertSame(['Home', 'Shop'], array_column(self::graph($state['resolved']['head'])['breadcrumb']['itemListElement'], 'name'));
    self::assertSame(['Chrome'], $state['resolved']['schema']['chrome_drafts']);
    // The published page has none.
    $published = $this->resolver()->resolve(Page::load($page->id()));
    self::assertArrayNotHasKey('breadcrumb', self::graph($published['head']));
    self::assertSame([], $published['schema']['chrome_drafts']);
  }

  /**
   * A site save first says where it changes structured data.
   */
  public function testSiteSaveEffect(): void {
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'administer canvas metatag']);
    $priced = ['schema' => ['type' => 'Product', 'props' => ['offers_price' => ['text' => '89']]]];
    $this->createPage([
      'title' => 'Oak desk lamp',
      'canvas_metatag' => Values::encode($priced),
      'path' => ['alias' => '/lamp'],
    ]);
    $this->createPage([
      'title' => 'Membership',
      'canvas_metatag' => Values::encode(array_replace_recursive($priced, ['schema' => ['type' => 'Service']])),
      'path' => ['alias' => '/membership'],
    ]);
    // A currency of its own, a draft and a page without a price: unchanged.
    $this->createPage([
      'title' => 'Euro lamp',
      'canvas_metatag' => Values::encode(array_replace_recursive($priced, ['schema' => ['props' => ['offers_priceCurrency' => ['text' => 'USD']]]])),
      'path' => ['alias' => '/usd'],
    ]);
    $this->createPage([
      'title' => 'Draft lamp',
      'status' => FALSE,
      'canvas_metatag' => Values::encode($priced),
      'path' => ['alias' => '/draft'],
    ]);
    $this->createPage(['title' => 'About', 'path' => ['alias' => '/about']]);
    // A content type whose every item states a price, named in plain text.
    NodeType::create(['type' => 'product', 'name' => "Editor's pick & Q&A"])->save();
    ContentTemplate::create([
      'id' => 'node.product.full',
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => 'product',
      'content_entity_type_view_mode' => 'full',
      'component_tree' => [],
      'status' => TRUE,
    ])->setThirdPartySetting('canvas_metatag', 'values', $priced)->save();

    // A currency linked to a field follows the site's where the field is
    // empty; a typed one never does.
    $link = ['source' => ['expression' => 'ℹ︎␜entity:node:plan␝field_currency␞␟value', 'sourceType' => 'entity-field']];
    foreach (['plan' => $link, 'gift' => ['text' => 'USD']] as $bundle => $currency) {
      NodeType::create(['type' => $bundle, 'name' => ucfirst($bundle)])->save();
      ContentTemplate::create([
        'id' => "node.$bundle.full",
        'content_entity_type_id' => 'node',
        'content_entity_type_bundle' => $bundle,
        'content_entity_type_view_mode' => 'full',
        'component_tree' => [],
        'status' => TRUE,
      ])->setThirdPartySetting('canvas_metatag', 'values', array_replace_recursive($priced, ['schema' => ['props' => ['offers_priceCurrency' => $currency]]]))->save();
    }

    $site = ['identity' => [], 'values' => []];
    $effect = fn (array $body): mixed => self::decodeResponse($this->putSite($body + $site + ['dry_run' => TRUE]))['effect'];
    $first = $effect(['currency' => 'EUR']);
    self::assertSame(4, $first['count']);
    self::assertEqualsCanonicalizing(['Oak desk lamp', 'Membership', "Every Editor's pick & Q&A", 'Every Plan'], $first['places']);
    // Nothing is saved by a dry run.
    self::assertNull($this->config('canvas_metatag.site')->get('currency'));
    // A save that keeps the currency changes nothing elsewhere.
    self::assertNull($effect([]));
    $this->putSite($site + ['currency' => 'EUR']);
    self::assertNull($effect(['currency' => 'EUR']));
    self::assertSame(4, $effect(['currency' => ''])['count']);

    // Past 25 places, the rest are counted, not named.
    foreach (range(1, 24) as $n) {
      $this->createPage([
        'title' => "Lamp $n",
        'canvas_metatag' => Values::encode($priced),
        'path' => ['alias' => "/lamp-$n"],
      ]);
    }
    $many = $effect(['currency' => 'USD']);
    self::assertSame(28, $many['count']);
    self::assertCount(25, $many['places']);
  }

  /**
   * The registry in the dialog's language; a sentence only when translated.
   */
  public function testTranslatedRegistry(): void {
    $this->enableModules(['locale']);
    $this->installSchema('locale', ['locales_source', 'locales_target', 'locales_location', 'locale_file']);
    ConfigurableLanguage::createFromLangcode('fi')->save();
    $this->container->get('kernel')->rebuildContainer();
    $storage = $this->container->get('locale.storage');
    $translate = static function (string $source, string $translation) use ($storage): void {
      $string = $storage->createString(['source' => $source, 'context' => 'canvas_metatag:schema'])->save();
      $storage->createTranslation([
        'lid' => $string->getId(),
        'language' => 'fi',
        'translation' => $translation,
      ])->save();
    };
    $translate('A product people buy', 'Tuote, jonka ihmiset ostavat');
    $translate('Merchant listing', 'Kauppalistaus');
    $translate("A company's rating by the people who work there.", 'Yrityksen arvio sen työntekijöiltä.');
    $translate('{name}, a web page of {site}.', '{name}, sivuston {site} sivu.');
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);

    $finnish = self::decodeResponse($this->request(Request::create('/fi' . self::STATE)));
    self::assertSame('fi', $finnish['ui']);
    self::assertSame('Tuote, jonka ihmiset ostavat', $finnish['registry']['Product']['kind']['label']);
    self::assertSame('Kauppalistaus', $finnish['search_features']['features']['merchant-listing']['label']);
    // A line about a type, for the type search of hand-added items.
    self::assertSame('Yrityksen arvio sen työntekijöiltä.', $finnish['search_features']['about']['EmployerAggregateRating']);
    self::assertSame('item:Organization', $finnish['search_features']['features']['employer-rating']['expects']['itemReviewed']['is']);
    // Untranslated strings stay English; ids, keys and paths are never
    // translated.
    self::assertSame('Plans for a service', $finnish['registry']['Service']['kind']['label']);
    self::assertSame('Service', $finnish['search_features']['features']['merchant-listing']['not_for'][0]['suggest']);
    self::assertSame('Product', $finnish['registry']['Product']['primary_type']);
    // A type whose sentences are all translated keeps them; one with an
    // untranslated sentence gives none, so the dialog lists the facts.
    self::assertSame([['{name}, sivuston {site} sivu.']], $finnish['registry']['WebPage']['say']);
    self::assertNull($finnish['registry']['Product']['say']);

    $english = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame('en', $english['ui']);
    self::assertSame('{name}, a web page of {site}.', $english['registry']['WebPage']['say'][0][0]);
    self::assertCount(16, $english['registry']['Product']['say'][0]);
  }

  /**
   * Sends a site settings save.
   */
  private function putSite(array $body): Response {
    // Maps as JSON objects, as the dialog sends them, even when empty.
    foreach (['identity', 'values'] as $member) {
      if (isset($body[$member]) && is_array($body[$member])) {
        $body[$member] = (object) $body[$member];
      }
    }
    return $this->request(Request::create(self::SITE, 'PUT', content: (string) json_encode($body)));
  }

}
