<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Controller\ApiController;
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

// cspell:ignore Tarifs tarifs
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
    $stored = ['robots' => ['noindex' => TRUE], 'social' => ['image' => $picked->uuid()]];
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
      'social' => ['image' => $picked->uuid()],
      'title' => 'Pricing plans {sep} {site}',
    ];
    $response = $this->request(Request::create("/canvas-metatag/api/draft/canvas_page/{$page->id()}", 'PUT', content: (string) json_encode([
      'values' => $values,
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
    self::assertSame([
      'langcode',
      'languages',
      'origin',
      'can',
      'capabilities',
      'site',
      'target',
      'preview',
      'tokens',
      'media',
      'resolved',
    ], array_keys($state));
    $draft = $auto_save->getAutoSaveEntityForPreview(Page::load($page->id()))->entity;
    self::assertInstanceOf(Page::class, $draft);
    $resolved = $this->resolver()->resolve($draft);
    $expected = [
      'langcode' => 'en',
      'languages' => ['en' => 'English', 'fr' => 'French'],
      'origin' => ['url' => 'http://localhost', 'source' => 'request'],
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
        'values' => ['robots' => ['max_image_preview' => 'large'], 'title' => '{title} {sep} {site}'],
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
      ],
      'preview' => [
        'entity_type' => 'canvas_page',
        'id' => (string) $page->id(),
        'label' => 'Draft title',
        'url' => 'http://localhost/pricing',
        'published' => TRUE,
      ],
      'tokens' => [
        'title' => ['label' => 'Page title', 'type' => 'text', 'value' => 'Draft title'],
        'description' => ['label' => 'Description', 'type' => 'text', 'value' => 'Plans and prices for Example.'],
        'site' => ['label' => 'Site name', 'type' => 'text', 'value' => 'Example'],
        'sep' => ['label' => 'Separator', 'type' => 'text', 'value' => '|'],
        'url' => ['label' => 'Page address', 'type' => 'url', 'value' => 'http://localhost/pricing'],
        'author' => ['label' => 'Author', 'type' => 'text', 'value' => 'Ada Writer'],
        'published' => ['label' => 'First published', 'type' => 'datetime', 'value' => self::PUBLISHED],
        'modified' => ['label' => 'Last updated', 'type' => 'datetime', 'value' => self::MODIFIED],
        'image' => ['label' => 'Page image', 'type' => 'image', 'value' => '', 'image' => $this->imageOf($hero)],
      ],
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
    self::assertSame(['withheld' => FALSE, 'missing_required' => [], 'missing_recommended' => []], $state['resolved']['schema']);
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
    self::assertSame('Pricing', $viewer['tokens']['title']['value']);
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
    $hero = $this->createImage('Article hero');
    $stored = ['social' => ['image' => '{field.field_hero}'], 'title' => '{title} {sep} Blog'];
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
    $values = ['schema' => ['type' => 'BlogPosting'], 'title' => '{field.field_byline}: {title}'];
    $template = ContentTemplate::load('node.article.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    $response = $this->request(Request::create('/canvas-metatag/api/draft/content_template/node.article.full', 'PUT', content: (string) json_encode([
      'values' => $values,
      'client_instance_id' => self::CLIENT,
      'auto_saves' => ['content_template:node.article.full' => $this->container->get(AutoSaveManager::class)->getClientAutoSaveData($template)],
    ])));
    self::assertSame('{"values":' . json_encode($values) . '}', $response->getContent());

    $state = self::decodeResponse($this->request(Request::create(self::STATE . $query)));
    self::assertSame([
      'langcode',
      'languages',
      'origin',
      'can',
      'capabilities',
      'site',
      'target',
      'preview',
      'tokens',
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
      'auto_save_key' => 'content_template:node.article.full',
      'translatable' => FALSE,
      'default_langcode' => NULL,
      'published' => TRUE,
      'has_draft' => TRUE,
      'values' => $values,
      'from_default' => [],
    ], $state['target']);
    self::assertSame([
      'entity_type' => 'node',
      'id' => (string) $node->id(),
      'label' => 'Hello',
      'url' => 'http://localhost/node/' . $node->id(),
      'published' => TRUE,
    ], $state['preview']);
    // The tokens every entity has, then one per supported field.
    self::assertSame(
      [
        'title',
        'description',
        'site',
        'sep',
        'url',
        'author',
        'published',
        'modified',
        'image',
        'field.field_byline',
        'field.field_hero',
      ],
      array_keys($state['tokens']),
    );
    self::assertSame(['label' => 'Byline', 'type' => 'text', 'value' => 'Grace Hopper'], $state['tokens']['field.field_byline']);
    self::assertSame(['label' => 'Hero image', 'type' => 'image', 'value' => '', 'image' => $this->imageOf($hero)], $state['tokens']['field.field_hero']);
    self::assertSame($this->imageOf($hero), $state['tokens']['image']['image']);
    self::assertSame('Grace Hopper: Hello', $state['resolved']['head']['title']);
    self::assertSame('article', self::meta($state['resolved']['head'])['og:type']);
    self::assertSame($this->imageOf($hero) + ['source' => 'entity'], $state['resolved']['image']);
    self::assertSame(['withheld' => FALSE, 'missing_required' => [], 'missing_recommended' => []], $state['resolved']['schema']);

    // Someone who may use Canvas but not update the template gets what is
    // stored.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $response = $this->request(Request::create(self::STATE . $query));
    self::assertStringNotContainsString('BlogPosting', (string) $response->getContent());
    $viewer = self::decodeResponse($response);
    self::assertSame(['target' => FALSE, 'site' => FALSE], $viewer['can']);
    self::assertSame(['has_draft' => FALSE, 'values' => $stored], array_intersect_key($viewer['target'], [
      'has_draft' => 1,
      'values' => 1,
    ]));
    self::assertSame('Hello | Blog', $viewer['resolved']['head']['title']);
    // An image bound to a field comes from the entity.
    self::assertSame('entity', $viewer['resolved']['image']['source']);

    // A stored value is edited as it is stored: a configuration override of
    // the template reaches the output only.
    $GLOBALS['config']['canvas.content_template.node.article.full']['third_party_settings']['canvas_metatag']['values']['title'] = 'Overridden';
    $this->container->get('config.factory')->clearStaticCache();
    $this->container->get('entity_type.manager')->getStorage(ContentTemplate::ENTITY_TYPE_ID)->resetCache();
    $overridden = self::decodeResponse($this->request(Request::create(self::STATE . $query)));
    self::assertSame($stored, $overridden['target']['values']);
    self::assertSame('Overridden', $overridden['resolved']['head']['title']);
    unset($GLOBALS['config']['canvas.content_template.node.article.full']);
    $this->container->get('config.factory')->clearStaticCache();
    $this->container->get('entity_type.manager')->getStorage(ContentTemplate::ENTITY_TYPE_ID)->resetCache();

    // An unpublished node to preview with is named as such.
    $draft_node = Node::create([
      'type' => 'article',
      'title' => 'Draft',
      'status' => FALSE,
      'uid' => $this->author->id(),
    ]);
    $draft_node->save();
    $this->setUpCurrentUser(permissions: [
      ...self::VISITOR,
      ContentTemplate::ADMIN_PERMISSION,
      'edit canvas metatag',
      'bypass node access',
    ]);
    $draft_query = '?entity_type=content_template&id=node.article.full&preview=' . $draft_node->id();
    $unpublished = self::decodeResponse($this->request(Request::create(self::STATE . $draft_query)))['preview'];
    self::assertSame(['Draft', FALSE], [$unpublished['label'], $unpublished['published']]);

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
    $stored = ['title' => '{title} {sep} News'];
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
    // The type's vocabulary, without values.
    self::assertSame(['label' => 'Byline', 'type' => 'text', 'value' => ''], $state['tokens']['field.field_byline']);
    self::assertSame([''], array_values(array_unique(array_column($state['tokens'], 'value'))));

    // The draft, for who may update the template.
    $template = ContentTemplate::load('node.article.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    $draft = ['title' => '{title} {sep} Updates'];
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
    self::assertSame([403, 'forbidden'], [$response->getStatusCode(), self::decodeResponse($response)['error']['code']]);
  }

  /**
   * The state with no context, saving site settings, and capabilities.
   */
  public function testSite(): void {
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'administer canvas metatag']);
    // No page at all: the vocabulary with empty values, and no output.
    $response = $this->request(Request::create(self::STATE));
    self::assertStringContainsString('"media":{}', (string) $response->getContent());
    $state = self::decodeResponse($response);
    self::assertSame([
      'langcode',
      'languages',
      'origin',
      'can',
      'capabilities',
      'site',
      'target',
      'preview',
      'tokens',
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
    self::assertSame(['title', 'description', 'site', 'sep', 'url', 'author', 'published', 'modified', 'image'], array_keys($state['tokens']));
    self::assertSame([''], array_values(array_unique(array_column($state['tokens'], 'value'))));
    self::assertSame(['label' => 'Page image', 'type' => 'image', 'value' => '', 'image' => NULL], $state['tokens']['image']);

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
    self::assertSame('Newer', $state['tokens']['title']['value']);
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
    self::assertSame(['robots' => ['max_image_preview' => 'large'], 'title' => '{title} {sep} {site}'], $state['site']['values']);
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
        'title' => '{title} {field.field_x}',
        'description' => 'Site-wide',
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
    $values = ['robots' => ['nofollow' => TRUE], 'title' => '{title} {sep} {site}'];
    // Sent in another order, with empties: the answer is canonical.
    $response = $this->putSite([
      'values' => ['title' => $values['title'], 'robots' => ['nofollow' => TRUE]],
      'identity' => array_reverse($identity, TRUE),
    ]);
    self::assertSame(200, $response->getStatusCode());
    self::assertSame((string) json_encode(['site' => ['identity' => $identity, 'values' => $values]]), $response->getContent());
    $raw = $this->config('canvas_metatag.site')->getRawData();
    self::assertSame($identity, $raw['identity']);
    self::assertEquals($values, $raw['values']);
    $state = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame(['identity' => $identity, 'values' => $values], $state['site']);
    self::assertSame([$logo->uuid()], array_keys($state['media']));
    unset($GLOBALS['config']['canvas_metatag.site']);
    $this->container->get('config.factory')->clearStaticCache();
    $state = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame('Older · Ada Writer', $state['resolved']['head']['title']);
    self::assertSame('nofollow', self::meta($state['resolved']['head'])['robots']);
    // Clearing everything leaves the identity defaults and no values.
    $response = $this->putSite(['identity' => [], 'values' => []]);
    self::assertStringContainsString('"values":{}', (string) $response->getContent());
    self::assertSame('|', self::decodeResponse($response)['site']['identity']['separator']);

    // A body that cannot be used, including one that is too large.
    $bad = [
      'not json' => '{"identity":',
      'not an object' => '"text"',
      'no identity' => '{"values":{}}',
      'no values' => '{"identity":{}}',
      'values a list' => '{"identity":{},"values":["a"]}',
      'identity a string' => '{"identity":"x","values":{}}',
      'too large' => (string) json_encode(['identity' => [], 'values' => [], 'padding' => str_repeat('a', 131072)]),
    ];
    foreach ($bad as $label => $content) {
      $response = $this->request(Request::create(self::SITE, 'PUT', content: $content));
      self::assertSame(400, $response->getStatusCode(), $label);
      self::assertSame(['error' => ['code' => 'bad_request', 'message' => 'The request could not be read.']], self::decodeResponse($response), $label);
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
    self::assertSame(['ai' => ['available' => FALSE, 'reason' => 'no_provider']], self::decodeResponse($this->request(Request::create(self::STATE)))['capabilities']);
  }

  /**
   * A site value sent back exactly as stored is kept, also when it fails.
   */
  public function testSiteKeepsStoredValue(): void {
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'administer canvas metatag']);
    // A configuration import stored a title with an unknown value.
    $title = '{field.field_x} {sep} {site}';
    $this->config('canvas_metatag.site')->set('values.title', $title)->save();
    $state = self::decodeResponse($this->request(Request::create(self::STATE)));
    self::assertSame($title, $state['site']['values']['title']);

    // Changing only the logo is accepted; the title stays as stored.
    $logo = $this->createImage('Logo');
    $identity = ['logo' => $logo->uuid()] + $state['site']['identity'];
    $response = $this->putSite(['identity' => $identity, 'values' => $state['site']['values']]);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    self::assertSame($title, self::decodeResponse($response)['site']['values']['title']);
    self::assertSame($logo->uuid(), $this->config('canvas_metatag.site')->get('identity.logo'));
    self::assertSame($title, $this->config('canvas_metatag.site')->get('values.title'));

    // Changing the title is validated as usual.
    $values = ['title' => '{field.field_x} {sep} Example'] + $state['site']['values'];
    $response = $this->putSite(['identity' => $identity, 'values' => $values]);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame(['title'], array_keys(self::decodeResponse($response)['error']['fields']));
    self::assertSame($title, $this->config('canvas_metatag.site')->get('values.title'));
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
    $special = $this->createImage('Pricing hero', ['alt' => 'Pricing table', 'width' => 640, 'height' => 480], ['created' => $created + 50]);

    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    $first = self::decodeResponse($this->request(Request::create(self::MEDIA)));
    self::assertSame(['items', 'more'], array_keys($first));
    self::assertTrue($first['more']);
    self::assertCount(24, $first['items']);
    // Newest first; no document, nothing unpublished.
    self::assertSame(['Pricing hero', 'Image 26', 'Image 25'], array_slice(array_column($first['items'], 'name'), 0, 3));
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
    self::assertSame(['items' => [], 'more' => FALSE], self::decodeResponse($this->request(Request::create(self::MEDIA . '?page=2'))));
    // Filtered by name.
    $found = self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=' . urlencode(' hero '))));
    self::assertSame(['Pricing hero'], array_column($found['items'], 'name'));
    self::assertFalse($found['more']);
    self::assertCount(11, self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=Image+1')))['items']);
    self::assertSame(['items' => [], 'more' => FALSE], self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=Unpublished'))));
    self::assertSame(['items' => [], 'more' => FALSE], self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=public'))));

    // Someone who may see unpublished media is not offered it either: an
    // unpublished image is never emitted, so picking it would do nothing.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag', 'administer media']);
    $listed = self::decodeResponse($this->request(Request::create(self::MEDIA)));
    self::assertSame('Pricing hero', $listed['items'][0]['name']);
    self::assertSame(['items' => [], 'more' => FALSE], self::decodeResponse($this->request(Request::create(self::MEDIA . '?q=Unpublished'))));
    // And someone who may not view media gets nothing.
    $this->setUpCurrentUser(permissions: ['access content', 'edit canvas metatag']);
    self::assertSame(['items' => [], 'more' => FALSE], self::decodeResponse($this->request(Request::create(self::MEDIA))));
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
    $values = ['schema' => ['props' => ['name' => 'Bureau', 'offers_price' => '49', 'offers_priceCurrency' => 'EUR']]];
    $path = "/canvas-metatag/api/draft/canvas_page/{$page->id()}";
    $response = $this->putDraft($path, $french, $values, ['langcode' => 'fr']);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    $state = self::decodeResponse($this->request(Request::create(self::STATE . '?entity_type=canvas_page&id=' . $page->id() . '&langcode=fr')));
    self::assertSame($values, $state['target']['values']);
    self::assertFalse($state['resolved']['schema']['withheld']);
    $graph = self::graph($state['resolved']['head']);
    self::assertSame(['Product', 'Bureau'], [$graph['primary']['@type'], $graph['primary']['name']]);
    // The default version names no type of its own here: WebPage.
    $english = Page::load($page->id());
    \assert($english instanceof Page);
    $response = $this->putDraft($path, $english, $values, ['langcode' => 'en']);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame(['schema.props.name', 'schema.props.offers_price', 'schema.props.offers_priceCurrency'], array_keys(self::decodeResponse($response)['error']['fields']));

    // A template value that names a field that no longer exists is carried
    // as it is: the other fields stay savable. Changing it is refused.
    $template = $this->createTemplate(TRUE, ['title' => '{title} {field.field_gone}']);
    $path = '/canvas-metatag/api/draft/content_template/' . $template->id();
    $response = $this->putDraft($path, $template, ['description' => 'New', 'title' => '{title} {field.field_gone}']);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    self::assertSame('{"values":{"description":"New","title":"{title} {field.field_gone}"}}', $response->getContent());
    $response = $this->putDraft($path, $template, ['description' => 'New', 'title' => '{title} {field.field_gone} x']);
    self::assertSame(422, $response->getStatusCode());
    self::assertSame(['title'], array_keys(self::decodeResponse($response)['error']['fields']));
    $response = $this->putDraft($path, $template, ['description' => 'New']);
    self::assertSame('{"values":{"description":"New"}}', $response->getContent());
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
   * Sends a site settings save.
   */
  private function putSite(array $body): Response {
    return $this->request(Request::create(self::SITE, 'PUT', content: (string) json_encode($body)));
  }

}
