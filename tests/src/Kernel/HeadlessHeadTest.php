<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\JavaScriptComponent;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_headless\Controller\CanvasContentController;
use Drupal\canvas_headless\Grant\PreviewAssertionGrant;
use Drupal\canvas_headless\PreviewAssertionFactory;
use Drupal\canvas_headless\PreviewLanguageRedirectResponse;
use Drupal\canvas_headless\StackMiddleware\CanvasContentApiRequest;
use Drupal\canvas_metatag\Controller\HeadlessContentController;
use Drupal\canvas_metatag\Values;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\consumers\Entity\Consumer;
use Drupal\Core\Cache\Cache;
use Drupal\Core\Cache\CacheableJsonResponse;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Extension\Requirement\RequirementSeverity;
use Drupal\Core\Routing\RouteMatch;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\Session\PermissionCheckerInterface;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\node\Entity\Node;
use Drupal\simple_oauth\Authentication\TokenAuthUser;
use Drupal\simple_oauth\Entity\Oauth2Scope;
use Drupal\simple_oauth\Entity\Oauth2Token;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\user\UserInterface;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Psr\Log\AbstractLogger;
use Symfony\Bridge\PsrHttpMessage\HttpMessageFactoryInterface;
use Symfony\Component\HttpFoundation\ParameterBag;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Routing\Route;

// cspell:ignore Tarifs tarifs
/**
 * Tests the head in the content API of canvas_headless.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(HeadlessContentController::class)]
#[Group('canvas_metatag')]
final class HeadlessHeadTest extends CanvasKernelTestBase {

  use ContentTranslationTestTrait;
  use GenerateComponentConfigTrait;
  use RequestTrait;
  use SeoFixtureTrait;
  use UserCreationTrait;

  private const FRONTEND = 'https://www.example.com';

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
    'serialization',
    'page_cache',
    'dynamic_page_cache',
    'canvas_metatag',
  ];

  /**
   * An editor whose preview token reads drafts.
   */
  private UserInterface $editor;

  /**
   * The consumer the preview tokens belong to.
   */
  private Consumer $consumer;

  /**
   * Collects what every logger channel receives.
   *
   * @var \Psr\Log\AbstractLogger&object{records: list<string>}
   */
  private AbstractLogger $log;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $modules = ['consumers', 'simple_oauth', 'custom_elements', 'canvas_headless'];
    if (array_diff($modules, array_keys($this->container->get('extension.list.module')->getList()))) {
      self::markTestSkipped('canvas_headless or one of its dependencies is not in the codebase.');
    }
    $this->enableModules($modules);
    $this->setUpSite();
    $this->installEntitySchema('consumer');
    $this->installEntitySchema('oauth2_token');
    $this->installConfig(['language', 'simple_oauth', 'canvas_headless']);
    ConfigurableLanguage::createFromLangcode('fr')->save();
    $this->enableContentTranslation(Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID);
    $this->config('canvas_headless.settings')->set('frontends', [['url' => self::FRONTEND, 'components' => []]])->save();
    // The language path processor exists only on a multilingual site.
    $this->container->get('kernel')->rebuildContainer();
    $this->generateComponentConfig();

    // A component of the frontend, without props: it renders as `{}`.
    JavaScriptComponent::create([
      'machineName' => 'canvas_headless_test',
      'name' => 'Canvas Headless test',
      'status' => TRUE,
      'type' => 'external',
      'props' => [],
      'required' => [],
      'slots' => [],
      'dataDependencies' => [],
    ])->save();
    $this->consumer = Consumer::create([
      'client_id' => PreviewAssertionFactory::CLIENT_ID,
      'label' => 'Canvas Headless preview',
      'confidential' => FALSE,
      'is_default' => FALSE,
      'third_party' => FALSE,
      'grant_types' => ['canvas_headless_preview_assertion'],
      'access_token_expiration' => 900,
    ]);
    $this->consumer->save();
    $this->editor = $this->createUser(['access content', 'view media']);
    $this->container->get('logger.factory')->addLogger($this->log = new class() extends AbstractLogger {

      /**
       * Every record, as "channel: message".
       *
       * @var list<string>
       */
      public array $records = [];

      /**
       * {@inheritdoc}
       */
      public function log($level, string|\Stringable $message, array $context = []): void {
        $this->records[] = $context['channel'] . ': ' . strtr((string) $message, array_filter($context, is_scalar(...)));
      }

    });
  }

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    self::allowPageCaches($container);
  }

  /**
   * A hand-added value stored before validation never costs the other tags.
   */
  public function testBadCustomValue(): void {
    $this->createPage([
      'canvas_metatag' => Values::encode([
        'robots' => ['noindex' => TRUE],
        'schema' => ['custom' => '[{"@type":"Thing","@id":"#ok","name":"Kept"},{"@type":"Rating","@id":"#r","ratingValue":1e400}]'],
      ]),
      'components' => [
        ['uuid' => '2c6e91ae-23ac-433d-9bb8-687144464b34', 'component_id' => 'js.canvas_headless_test', 'inputs' => []],
      ],
    ]);
    $head = self::decodeResponse($this->content('/pricing'))['head'];
    self::assertSame('Pricing | Example', $head['title']);
    self::assertSame('Plans and prices for Example.', self::meta($head)['description']);
    self::assertStringStartsWith('noindex', self::meta($head)['robots']);
    self::assertSame('canonical', $head['link'][0]['rel']);
    self::assertNotContains('Rating', array_column($head['script'][0]['textContent']['@graph'], '@type'));
    // Only the refused item is left out.
    self::assertContains('Kept', array_column($head['script'][0]['textContent']['@graph'], 'name'));
  }

  /**
   * A published page: our head on the frontend base, cached, invalidated.
   */
  public function testPublishedPage(): void {
    $hero = $this->createImage('Pricing hero', ['alt' => 'Pricing table']);
    $page = $this->createPage([
      'image' => $hero->id(),
      'canvas_metatag' => Values::encode(['canonical' => '/plans', 'schema' => ['type' => 'Article']]),
      'components' => [
        ['uuid' => '2c6e91ae-23ac-433d-9bb8-687144464b34', 'component_id' => 'js.canvas_headless_test', 'inputs' => []],
      ],
    ]);
    $page->addTranslation('fr', ['title' => 'Tarifs', 'status' => TRUE, 'path' => ['alias' => '/tarifs']]);
    $page->save();

    $response = $this->content('/pricing');
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    $data = self::decodeResponse($response);
    self::assertSame(['content', 'head', 'route', 'context'], array_keys($data));
    $head = $data['head'];
    // Exactly what the resolver says, and only the four keys of the API.
    $expected = $this->resolver()->resolve(Page::load($page->id()))['head'];
    self::assertSame(json_decode((string) json_encode($expected), TRUE), $head);
    self::assertSame(['title', 'meta', 'link', 'script'], array_keys($head));
    self::assertSame('Pricing | Example', $head['title']);
    self::assertSame('Plans and prices for Example.', self::meta($head)['description']);
    self::assertSame(self::PUBLISHED, self::meta($head)['article:published_time']);
    // The canonical, og:url, hreflang and every @id are on the frontend;
    // the image stays on the Drupal origin, where the files are.
    self::assertSame([
      ['rel' => 'canonical', 'href' => self::FRONTEND . '/plans'],
      ['rel' => 'alternate', 'hreflang' => 'en', 'href' => self::FRONTEND . '/pricing'],
      ['rel' => 'alternate', 'hreflang' => 'fr', 'href' => self::FRONTEND . '/fr/tarifs'],
      ['rel' => 'alternate', 'hreflang' => 'x-default', 'href' => self::FRONTEND . '/pricing'],
    ], $head['link']);
    self::assertSame(self::FRONTEND . '/plans', self::meta($head)['og:url']);
    self::assertSame($this->imageOf($hero)['url'], self::meta($head)['og:image']);
    self::assertStringStartsWith('http://localhost/', self::meta($head)['og:image']);
    // The script is the graph as an object, never a string of HTML.
    self::assertSame(['type', 'textContent'], array_keys($head['script'][0]));
    self::assertSame('https://schema.org', $head['script'][0]['textContent']['@context']);
    $ids = array_column($head['script'][0]['textContent']['@graph'], '@id');
    self::assertSame([
      self::FRONTEND . '/#identity',
      self::FRONTEND . '/#website',
      self::FRONTEND . '/pricing#webpage',
      self::FRONTEND . '/pricing#primaryimage',
      self::FRONTEND . '/pricing#primary',
    ], $ids);
    self::assertInstanceOf(CacheableJsonResponse::class, $response);
    foreach ([
      'config:canvas_metatag.site',
      'config:canvas_headless.settings',
      'config:user.role.anonymous',
      'media:' . $hero->id(),
    ] as $tag) {
      self::assertContains($tag, $response->getCacheableMetadata()->getCacheTags());
    }
    self::assertNotContains(AutoSaveManager::CACHE_TAG, $response->getCacheableMetadata()->getCacheTags());

    // The second request is served from the page cache with our head, and a
    // dependency of ours invalidates it.
    $cached = $this->content('/pricing');
    self::assertSame('HIT', $cached->headers->get('X-Drupal-Cache'));
    self::assertSame($response->getContent(), $cached->getContent());
    $this->config('canvas_metatag.site')->set('identity.name', 'Example Ltd')->save();
    $response = $this->content('/pricing');
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame('Pricing | Example Ltd', self::decodeResponse($response)['head']['title']);
    // The translation Canvas rendered.
    $french = self::decodeResponse($this->content('/fr/tarifs'))['head'];
    self::assertSame('Tarifs | Example Ltd', $french['title']);
    self::assertSame(self::FRONTEND . '/fr/tarifs', $french['link'][0]['href']);

    // The Drupal-origin copy of the page declares the frontend copy
    // canonical.
    $html = (string) $this->request(Request::create('/pricing'))->getContent();
    self::assertSame(1, substr_count($html, 'rel="canonical"'));
    self::assertStringContainsString('<link rel="canonical" href="' . self::FRONTEND . '/plans" />', $html);

    // A resolver that throws costs the head of ours, never the page: the
    // answer is Canvas's own, and the failure is logged. An invalid site
    // timezone, forced past validation, is what makes it throw here.
    $with = (string) $response->getContent();
    self::assertSame([], $this->errors());
    $GLOBALS['config']['system.date']['timezone']['default'] = 'Nowhere/Land';
    $this->container->get('config.factory')->clearStaticCache();
    Cache::invalidateTags(['canvas_page:' . $page->id()]);
    $response = $this->content('/pricing');
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    $without = (string) $response->getContent();
    self::assertSame(['title' => 'Pricing'], self::decodeResponse($response)['head']);
    self::assertCount(1, $this->errors());
    self::assertStringStartsWith('canvas_metatag: ', $this->errors()[0]);
    unset($GLOBALS['config']['system.date']);
    $this->container->get('config.factory')->clearStaticCache();

    // Everything but `head` is byte for byte what Canvas answers without
    // us, including the `{}` of a component without props.
    $before = static fn (string $json): string => (string) strstr($json, ',"head":', TRUE);
    $after = static fn (string $json): string => substr($json, (int) strrpos($json, ',"route":'));
    self::assertNotSame('', $before($without));
    self::assertSame($before($without), $before($with));
    self::assertSame($after($without), $after($with));
    // This Canvas version gives every component a `canvasUuid` prop, so a
    // component without props no longer renders as `{}`. The identity above
    // is what keeps an empty object an object: the adapter decodes the
    // response to objects, never to arrays.
    self::assertStringContainsString('"props":{"canvasUuid":"2c6e91ae-23ac-433d-9bb8-687144464b34"}', $before($with));
  }

  /**
   * Drafts are read for a preview token, and for nothing else.
   */
  public function testDrafts(): void {
    // A real preview request carries a bearer token, which keeps it out of
    // the page cache. Here the account is set directly, so that cache goes.
    $this->disableModules(['page_cache']);
    $auto_save = $this->container->get(AutoSaveManager::class);
    $page = $this->createPage();
    $draft = clone $page;
    $draft->set('title', 'Draft title')->set('canvas_metatag', '{"robots":{"noindex":true},"title":{"text":"Draft words"}}');
    $auto_save->saveEntity($draft);

    $this->createField('field_byline', 'string', 'Byline');
    $template = $this->createTemplate(TRUE, ['title_end' => ['text' => 'Blog']]);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'uid' => $this->author->id(),
      'field_byline' => 'Grace Hopper',
    ]);
    $node->save();
    $template_draft = clone $template;
    $template_draft->setThirdPartySetting('canvas_metatag', 'values', [
      'title' => [
        'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
      ],
    ]);
    $auto_save->saveEntity($template_draft);
    $node_path = '/node/' . $node->id();

    // An anonymous request and a token without the preview scope get what
    // is published.
    foreach ([new AnonymousUserSession(), $this->tokenAccount(FALSE)] as $account) {
      $this->setCurrentAccount($account);
      $head = self::decodeResponse($this->content('/pricing'))['head'];
      self::assertSame('Pricing | Example', $head['title']);
      self::assertSame('max-image-preview:large', self::meta($head)['robots']);
      self::assertSame('Hello | Blog', self::decodeResponse($this->content($node_path))['head']['title']);
    }

    // A preview token gets the page draft and the template draft.
    $this->setCurrentAccount($this->tokenAccount(TRUE));
    $response = $this->content('/pricing');
    $head = self::decodeResponse($response)['head'];
    self::assertSame('Draft words | Example', $head['title']);
    self::assertSame('noindex, max-image-preview:large', self::meta($head)['robots']);
    self::assertSame(['title', 'meta', 'link', 'script'], array_keys($head));
    self::assertSame(self::FRONTEND . '/pricing', $head['link'][0]['href']);
    self::assertInstanceOf(CacheableJsonResponse::class, $response);
    self::assertContains(AutoSaveManager::CACHE_TAG, $response->getCacheableMetadata()->getCacheTags());
    self::assertSame('Grace Hopper | Example', self::decodeResponse($this->content($node_path))['head']['title']);
    // The head is the full view's: a preview of another view mode keeps
    // Canvas's own.
    $view_mode = CanvasContentApiRequest::PREVIEW_VIEW_MODE_QUERY;
    self::assertSame('Grace Hopper | Example', self::decodeResponse($this->content($node_path, [$view_mode => 'full']))['head']['title']);
    self::assertSame(['title' => 'Hello'], self::decodeResponse($this->content($node_path, [$view_mode => 'teaser']))['head']);
    // Unless the frontend asks for the published state.
    $exclude = [CanvasContentApiRequest::EXCLUDE_AUTO_SAVE_QUERY => 'true'];
    self::assertSame('Pricing | Example', self::decodeResponse($this->content('/pricing', $exclude))['head']['title']);
    self::assertSame('Hello | Blog', self::decodeResponse($this->content($node_path, $exclude))['head']['title']);

    // A template that was never published renders only in a preview, and
    // only there is the head ours.
    $template->setStatus(FALSE)->save();
    $unpublished = clone $template;
    $unpublished->setThirdPartySetting('canvas_metatag', 'values', ['title_end' => ['text' => 'Never published']]);
    $auto_save->saveEntity($unpublished);
    self::assertSame('Hello | Never published', self::decodeResponse($this->content($node_path))['head']['title']);
    $this->setCurrentAccount(new AnonymousUserSession());
    self::assertSame(['title' => 'Hello'], self::decodeResponse($this->content($node_path))['head']);
    ContentTemplate::load('node.article.full')?->setStatus(TRUE)->save();

    // An anonymous request never reads a draft, even when the route option
    // that selects drafts is forced on.
    $this->container->get('event_dispatcher')->addListener(KernelEvents::CONTROLLER, static function (ControllerEvent $event): void {
      $route = $event->getRequest()->attributes->get('_route_object');
      if ($route instanceof Route) {
        $route->setOption('_canvas_use_template_draft', TRUE);
      }
    }, 1000);
    // Nothing may come from a cache of the requests above.
    Cache::invalidateTags(['canvas_page:' . $page->id(), 'node:' . $node->id()]);
    self::assertSame('Pricing | Example', self::decodeResponse($this->content('/pricing'))['head']['title']);
    self::assertSame('Hello | Blog', self::decodeResponse($this->content($node_path))['head']['title']);
    self::assertSame([], $this->errors());
  }

  /**
   * A composed title: the content API's is the coupled head's.
   */
  public function testComposedTitle(): void {
    $this->createField('field_byline', 'string', 'Byline');
    $byline = ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'];
    $this->createTemplate(TRUE, [
      'title' => [
        'parts' => [['fact' => 'title'], ['text' => ' by '], ['source' => $byline]],
      ],
    ]);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'uid' => $this->author->id(),
      'field_byline' => 'Grace & Ada',
      'status' => 1,
    ]);
    $node->save();
    $head = self::decodeResponse($this->content('/node/' . $node->id()))['head'];
    self::assertSame('Hello by Grace & Ada | Example', $head['title']);
    self::assertSame($this->resolver()->resolve(Node::load($node->id()))['head']['title'], $head['title']);
    // An item without the field leaves out the words that go with it.
    $node->set('field_byline', NULL)->save();
    self::assertSame('Hello | Example', self::decodeResponse($this->content('/node/' . $node->id()))['head']['title']);
  }

  /**
   * Everything that is not a canonical route of an owned entity is Canvas's.
   */
  public function testOtherRoutesAreUntouched(): void {
    $this->createTemplate(TRUE, ['title_end' => ['text' => 'Blog']]);
    $node = Node::create(['type' => 'article', 'title' => 'Hello', 'uid' => $this->author->id()]);
    $node->save();
    $page = $this->createPage();
    $other = $this->createPage(['title' => 'Other', 'path' => ['alias' => '/other']]);

    // A route without an entity, and an error.
    $login = self::decodeResponse($this->content('/user/login'));
    self::assertSame(['title' => 'Log in'], $login['head']);
    $response = $this->content('/no-such-page', status: 404);
    self::assertStringNotContainsString('og:site_name', (string) $response->getContent());

    // Entity preview, revision and latest-version routes carry an unsaved or
    // a non-default entity. Called the way the router calls the controller.
    $controller = $this->container->get(CanvasContentController::class);
    self::assertInstanceOf(HeadlessContentController::class, $controller);
    $request = Request::create('/canvas/content-api');
    $request->attributes->set(CanvasContentApiRequest::REQUESTED_URI_ATTRIBUTE, '/requested');
    $this->container->get(RequestStack::class)->push($request);
    $call = static function (RouteMatch $match) use ($controller, $request): array {
      return self::decodeResponse($controller->get($request, $match));
    };
    $match = static function (string $route_name, string $path, array $parameters): RouteMatch {
      $raw = array_map(static fn (mixed $value): string => $value instanceof EntityInterface ? (string) $value->id() : (string) $value, $parameters);
      return new RouteMatch($route_name, new Route($path), $parameters, $raw);
    };
    $unsaved = Node::create(['type' => 'article', 'title' => 'Not saved yet', 'uid' => $this->author->id()]);
    $unsaved->in_preview = TRUE;
    $routes = [
      'entity.node.preview' => [
        '/node/preview/{node_preview}/{view_mode_id}',
        ['node_preview' => $unsaved, 'view_mode_id' => 'full'],
        'Not saved yet',
      ],
      'entity.node.revision' => [
        '/node/{node}/revisions/{node_revision}/view',
        ['node' => $node, 'node_revision' => $node],
        'Hello',
      ],
      'entity.node.latest_version' => ['/node/{node}/latest', ['node' => $node], 'Hello'],
    ];
    foreach ($routes as $route_name => [$path, $parameters, $title]) {
      self::assertSame(['title' => $title], $call($match($route_name, $path, $parameters))['head'], $route_name);
    }
    // The same call on the canonical route is ours.
    self::assertSame('Hello | Blog', $call($match('entity.node.canonical', '/node/{node}', ['node' => $node]))['head']['title']);
    $canonical = $match('entity.canvas_page.canonical', '/page/{canvas_page}', ['canvas_page' => $page]);
    self::assertSame('Pricing | Example', $call($canonical)['head']['title']);

    // When the entity Canvas rendered is not the one the route names, the
    // head stays Canvas's. This route match names another page from its
    // second read on: the first read is the inner controller's.
    $changing = new class($canonical->getRouteName(), $canonical->getRouteObject(), ['canvas_page' => $page], ['canvas_page' => (string) $page->id()]) extends RouteMatch {

      /**
       * What every read after the first one answers with.
       *
       * @var array<string, mixed>
       */
      public array $later = [];

      /**
       * {@inheritdoc}
       */
      public function getParameters() {
        $parameters = parent::getParameters();
        $this->parameters = new ParameterBag($this->later);
        return $parameters;
      }

    };
    $changing->later = ['canvas_page' => $other];
    $data = $call($changing);
    self::assertSame(['title' => 'Pricing'], $data['head']);
    self::assertSame((string) $page->id(), $data['route']['entity']['id']);
    $this->container->get(RequestStack::class)->pop();
    self::assertSame([], $this->errors());

    // The status report is silent while canvas_headless resolves our
    // controller, and says so the moment it does not.
    $requirements = static fn (): array => \Drupal::moduleHandler()->invoke('canvas_metatag', 'runtime_requirements');
    self::assertArrayNotHasKey('canvas_metatag_headless', $requirements());
    $this->container->set(CanvasContentController::class, new \stdClass());
    self::assertSame(RequirementSeverity::Error, $requirements()['canvas_metatag_headless']['severity'] ?? NULL);
  }

  /**
   * What was logged as an error of ours or of PHP.
   *
   * @return list<string>
   *   The records, as "channel: message".
   */
  private function errors(): array {
    return array_values(array_filter($this->log->records, static fn (string $record): bool => (bool) preg_match('/^(canvas_metatag|php): /', $record)));
  }

  /**
   * Requests the content API for a path of the site.
   *
   * @param string $path
   *   The site-relative path the frontend routes.
   * @param array<string, string> $query
   *   Further query parameters of the content API.
   * @param int $status
   *   The expected status.
   */
  private function content(string $path, array $query = [], int $status = 200): Response {
    try {
      $response = $this->request(Request::create('/canvas/content-api?' . http_build_query(['requestUri' => $path] + $query)));
      // A preview on a multilingual site is first sent to its language.
      if ($response instanceof PreviewLanguageRedirectResponse) {
        $response = $this->request(Request::create($response->getTargetUrl()));
      }
    }
    catch (HttpExceptionInterface $e) {
      self::assertSame($status, $e->getStatusCode(), $path . ': ' . $e->getMessage());
      return new Response('', $e->getStatusCode());
    }
    self::assertSame($status, $response->getStatusCode(), $path);
    return $response;
  }

  /**
   * Creates a user-bound OAuth account, optionally with the preview scope.
   */
  private function tokenAccount(bool $preview): TokenAuthUser {
    // A token's permissions are those of its scopes. Without the preview
    // scope, the token of a frontend that reads published content.
    if (!$preview && Oauth2Scope::load('content') === NULL) {
      Oauth2Scope::create([
        'id' => 'content',
        'name' => 'content',
        'description' => 'Reads published content.',
        'grant_types' => ['client_credentials' => ['status' => TRUE, 'description' => '']],
        'umbrella' => FALSE,
        'granularity_id' => 'permission',
        'granularity_configuration' => ['permission' => 'access content'],
      ])->save();
    }
    $token = Oauth2Token::create([
      'bundle' => 'access_token',
      'auth_user_id' => $this->editor->id(),
      'client' => $this->consumer->id(),
      'scopes' => [['scope_id' => $preview ? PreviewAssertionGrant::SCOPE : 'content']],
      'value' => $this->randomMachineName(),
    ]);
    return new TokenAuthUser(
      $this->container->get(PermissionCheckerInterface::class),
      $token,
      $this->container->get(HttpMessageFactoryInterface::class),
      $this->container->get(RequestStack::class),
    );
  }

  /**
   * Sets the account that content rendering and access checks run for.
   */
  private function setCurrentAccount(AccountInterface $account): void {
    $this->container->get(AccountProxyInterface::class)->setAccount($account);
  }

}
