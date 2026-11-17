<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag_ai\Kernel;

use Drupal\ai\Entity\AiGuardrail;
use Drupal\ai\Entity\AiGuardrailSet;
use Drupal\ai\Entity\AiPrompt;
use Drupal\ai\Event\PreGenerateResponseEvent;
use Drupal\ai\Exception\AiAccessDeniedException;
use Drupal\ai\Exception\AiBrokenOutputException;
use Drupal\ai\Exception\AiMissingFeatureException;
use Drupal\ai\Exception\AiOperationTypeMissingException;
use Drupal\ai\Exception\AiSetupFailureException;
use Drupal\ai\Exception\AiUnsafePromptException;
use Drupal\ai\OperationType\Chat\ChatInput;
use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag_ai\Controller\AiController;
use Drupal\Core\Access\CsrfRequestHeaderAccessCheck;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\PageTrait;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Psr\Log\AbstractLogger;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Tests the suggest route: access, caps, flood control and the error codes.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(AiController::class)]
#[Group('canvas_metatag')]
final class AiControllerTest extends CanvasKernelTestBase {

  use PageTrait;
  use RequestTrait;
  use UserCreationTrait;

  private const string PATH = '/canvas-metatag/api/ai/suggest';

  private const array PERMISSIONS = ['use canvas metatag ai', 'edit canvas metatag'];

  // Text that must reach the provider and nothing else.
  private const array PAGE = [
    'title' => 'Zebra crossing guide',
    'site' => 'Example',
    'text' => "Giraffe meadow opening\nVisit the penguin enclosure this spring.",
  ];

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...self::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'language',
    'canvas_metatag',
    'key',
    'ai',
    'ai_test',
    'canvas_metatag_ai',
    'canvas_metatag_ai_test',
  ];

  /**
   * Every provider call, as the AI module announced it.
   *
   * @var list<\Drupal\ai\Event\PreGenerateResponseEvent>
   */
  private array $calls = [];

  /**
   * Providers other than the test providers that a call was about to reach.
   *
   * @var list<string>
   */
  private array $foreign = [];

  /**
   * When set, what a subscriber of the AI module throws before the call.
   */
  private ?\Throwable $refusal = NULL;

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
    $this->installEntitySchema('user');
    $this->installPageEntitySchema();
    $this->installConfig(['language', 'ai', 'canvas_metatag', 'canvas_metatag_ai']);
    // User 1 is a superuser, so burn it.
    $this->createUser();
    $this->setUpCurrentUser(permissions: self::PERMISSIONS);

    $this->container->get('event_dispatcher')->addListener(PreGenerateResponseEvent::EVENT_NAME, function (PreGenerateResponseEvent $event): void {
      // Only the test providers may ever be called: never a paid one.
      if (!in_array($event->getProviderId(), ['canvas_metatag_echo', 'echoai'], TRUE)) {
        $this->foreign[] = $event->getProviderId();
        throw new \LogicException('Not a test provider.');
      }
      $this->calls[] = $event;
      if ($this->refusal) {
        throw $this->refusal;
      }
    });
    $this->container->get('logger.factory')->addLogger($this->log = new class() extends AbstractLogger {

      /**
       * Every record, as "channel: message" with its placeholders filled.
       *
       * @var list<string>
       */
      public array $records = [];

      /**
       * {@inheritdoc}
       */
      public function log($level, string|\Stringable $message, array $context = []): void {
        $placeholders = array_filter($context, static fn (mixed $value, string $key): bool => $key[0] === '@' && is_scalar($value), ARRAY_FILTER_USE_BOTH);
        $this->records[] = $context['channel'] . ': ' . strtr((string) $message, $placeholders);
      }

    });
  }

  /**
   * {@inheritdoc}
   */
  protected function tearDown(): void {
    $this->assertSame([], $this->foreign, 'Only test providers are called.');
    parent::tearDown();
  }

  /**
   * The route needs both permissions and the CSRF header token.
   */
  public function testAccess(): void {
    $this->useEcho();
    $route = $this->container->get('router.route_provider')->getRouteByName('canvas_metatag_ai.suggest');
    $this->assertSame(self::PATH, $route->getPath());
    $this->assertSame(['POST'], $route->getMethods());
    $this->assertSame('use canvas metatag ai,edit canvas metatag', $route->getRequirement('_permission'));
    $this->assertSame('TRUE', $route->getRequirement('_csrf_request_header_token'));
    $this->assertSame('TRUE', $route->getOption('no_cache'));

    $this->assertSame(200, $this->suggest(self::text())->getStatusCode());
    foreach (self::PERMISSIONS as $permission) {
      $this->setUpCurrentUser(permissions: [$permission]);
      $this->assertSame(403, $this->suggest(self::text())->getStatusCode());
    }
    $this->setUpCurrentUser(permissions: []);
    $this->assertSame(403, $this->suggest(self::text())->getStatusCode());
    $this->assertCount(1, $this->calls);

    // With a session cookie the header token is required, and checked.
    $this->setUpCurrentUser(permissions: self::PERMISSIONS);
    $session_name = $this->container->get('session_configuration')->getOptions(Request::create('/'))['name'];
    $session = [$session_name => 'session'];
    $this->assertSame(403, $this->suggest(self::text(), $session)->getStatusCode());
    $this->assertSame(403, $this->suggest(self::text(), $session, 'wrong')->getStatusCode());
    $token = $this->container->get('csrf_token')->get(CsrfRequestHeaderAccessCheck::TOKEN_KEY);
    $this->assertSame(200, $this->suggest(self::text(), $session, $token)->getStatusCode());
    $this->assertCount(2, $this->calls);
  }

  /**
   * Both tasks answer in the documented shape.
   */
  public function testResponses(): void {
    $this->useEcho();
    $response = $this->suggest(self::text(['fields' => ['social.title', 'social.description']]));
    $this->assertSame(200, $response->getStatusCode());
    $this->assertSame([
      'suggestions' => [
        'social.title' => [
          'Echo social.title 1: fish & chips <fresh>',
          'Echo social.title 2: fish & chips <fresh>',
          'Echo social.title 3: fish & chips <fresh>',
        ],
        'social.description' => [
          'Echo social.description 1: fish & chips <fresh>',
          'Echo social.description 2: fish & chips <fresh>',
          'Echo social.description 3: fish & chips <fresh>',
        ],
      ],
    ], self::decodeResponse($response));

    $response = $this->suggest(self::schema());
    $this->assertSame(200, $response->getStatusCode());
    $this->assertSame([
      'type' => 'Event',
      'props' => [
        'name' => 'Giraffe meadow opening',
        'location_name' => 'Garden Hall & Co <main> https://example.com/venue',
      ],
      // Dates are for people: the start date is never proposed.
      'unverified' => ['location_name'],
    ], self::decodeResponse($response));

    // A type without properties still answers with a JSON object.
    $response = $this->suggest(self::schema(['text' => '']));
    $this->assertSame('{"type":"WebPage","props":{},"unverified":[]}', $response->getContent());
  }

  /**
   * Counts are clamped and texts are cut before anything is sent.
   */
  public function testCaps(): void {
    $this->useEcho();
    $this->assertCount(5, self::decodeResponse($this->suggest(self::text(['count' => 99])))['suggestions']['title']);
    $this->assertCount(1, self::decodeResponse($this->suggest(self::text(['count' => 0])))['suggestions']['title']);
    $this->assertCount(1, self::decodeResponse($this->suggest(self::text(['count' => -3])))['suggestions']['title']);
    $this->assertStringContainsString('Return exactly 5 different variants', $this->calls[0]->getInput()->getSystemPrompt());
    $this->assertStringContainsString('Return exactly 1 different variants', $this->lastInput()->getSystemPrompt());

    // Caps count characters, not bytes.
    $this->suggest(self::text([
      'fields' => ['title', 'title', 'description'],
      'current' => [
        'title' => str_repeat('ä', 2001) . 'CUT',
        'description' => 'Kept',
        'social.title' => 'Not requested',
      ],
      'hint' => str_repeat('h', 200) . 'CUT',
      'page' => [
        'title' => str_repeat('t', 255) . 'CUT',
        'site' => str_repeat('s', 255) . 'CUT',
        'text' => str_repeat('ö', 12000) . 'CUT',
        'ending' => '| ' . str_repeat('e', 298),
      ],
    ]));
    $input = $this->lastInput();
    $this->assertSame(['title', 'description'], $input->getChatStructuredJsonSchema()['schema']['properties']['suggestions']['items']['properties']['field']['enum']);
    $this->assertSame(implode("\n", [
      'Site: ' . str_repeat('s', 255),
      'Page title: ' . str_repeat('t', 255),
      // The ending, cut at 255 characters.
      'Title ending: | ' . str_repeat('e', 253),
      'Current title: ' . str_repeat('ä', 2000),
      'Current description: Kept',
      '<editor_hint>' . str_repeat('h', 200) . '</editor_hint>',
      '<page_content>',
      str_repeat('ö', 12000),
      '</page_content>',
    ]), $input->getMessages()[0]->getText());

    // A body above 128 KB is refused before it is decoded.
    $this->assertError(400, 'bad_request', $this->suggest(self::text(['padding' => str_repeat('x', 131072)])));
    $this->assertCount(4, $this->calls);
  }

  /**
   * A request that is not understood is a 400 and reaches no provider.
   */
  public function testBadRequests(): void {
    $this->useEcho();
    $bad = [
      'not json' => '{"task":',
      'a list' => '[1, 2]',
      'a string' => '"text"',
      'unknown task' => self::text(['task' => 'rewrite']),
      'no task' => array_diff_key(self::text(), ['task' => 0]),
      'unknown language' => self::text(['langcode' => 'xx']),
      'a language the site only knows as a placeholder' => self::text(['langcode' => 'und']),
      'no language' => array_diff_key(self::text(), ['langcode' => 0]),
      'language of the wrong type' => self::text(['langcode' => ['en']]),
      'unknown field' => self::text(['fields' => ['title', 'canonical']]),
      'social and search fields mixed' => self::text(['fields' => ['title', 'social.title']]),
      'no fields' => self::text(['fields' => []]),
      'fields of the wrong type' => self::text(['fields' => 'title']),
      'a field of the wrong type' => self::text(['fields' => [['title']]]),
      'count of the wrong type' => self::text(['count' => '3']),
      'no count' => array_diff_key(self::text(), ['count' => 0]),
      'current of the wrong type' => self::text(['current' => 'Pricing']),
      'a current value of the wrong type' => self::text(['current' => ['title' => ['Pricing']]]),
      'hint of the wrong type' => self::text(['hint' => 3]),
      'no page' => array_diff_key(self::text(), ['page' => 0]),
      'page of the wrong type' => self::text(['page' => 'Pricing']),
      'page text of the wrong type' => self::text(['page' => ['text' => ['Plans']]]),
      'an ending of the wrong type' => self::text(['page' => ['ending' => 3]]),
      'schema task with an unknown language' => ['langcode' => 'xx'] + self::schema(),
    ];
    foreach ($bad as $case => $body) {
      $this->assertError(400, 'bad_request', $this->suggest($body), $case);
    }
    $this->assertSame([], $this->calls);

    // Optional members may be left out.
    $minimal = ['task' => 'text', 'langcode' => 'en', 'fields' => ['title'], 'count' => 1, 'page' => []];
    $this->assertSame(200, $this->suggest($minimal)->getStatusCode());
    // A caller that sends no ending is not told the title has none, nor
    // given the ending rule.
    $this->assertSame("Site: \nPage title: \n<page_content>\n\n</page_content>", $this->lastInput()->getMessages()[0]->getText());
    $this->assertStringNotContainsString('title ending given', $this->lastInput()->getSystemPrompt());
    // An empty ending is "no ending".
    $this->assertSame(200, $this->suggest(['page' => ['ending' => '']] + $minimal)->getStatusCode());
    $this->assertSame("Site: \nPage title: \nTitle ending: none, the title has no ending\n<page_content>\n\n</page_content>", $this->lastInput()->getMessages()[0]->getText());
  }

  /**
   * Thirty calls per five minutes per user; bad requests do not count.
   */
  public function testFloodLimit(): void {
    $this->useEcho();
    $this->assertError(400, 'bad_request', $this->suggest('{}'));
    for ($i = 0; $i < 30; $i++) {
      $this->assertSame(200, $this->suggest(self::text(['count' => 1]))->getStatusCode(), "Call $i");
    }
    $this->assertError(429, 'rate_limited', $this->suggest(self::text()));
    $this->assertError(429, 'rate_limited', $this->suggest(self::schema()));
    $this->assertCount(30, $this->calls);
    // Refused before the call: neither the bad request nor the flood limit is
    // logged.
    $this->assertSame([], array_filter($this->log->records, static fn (string $record): bool => str_starts_with($record, 'canvas_metatag_ai: ')));

    // The limit is per user.
    $this->setUpCurrentUser(permissions: self::PERMISSIONS);
    $this->assertSame(200, $this->suggest(self::text())->getStatusCode());
  }

  /**
   * Each failure has its status and code, and tells the client nothing else.
   */
  public function testErrorCodes(): void {
    // No default provider at all.
    $this->assertError(422, 'ai_not_configured', $this->suggest(self::text()));
    // A default that names a provider which is no longer installed.
    $this->setDefault('gone', 'echo-json');
    $this->assertError(422, 'ai_not_configured', $this->suggest(self::text()));
    // A prompt that is empty: suggestions of its kind are off.
    $this->useEcho();
    $this->config('ai.ai_prompt.canvas_metatag_search__default')->set('prompt', ' ')->save();
    $this->assertError(422, 'ai_not_configured', $this->suggest(self::text()));
    // The other kinds still work. Their one call is the only call so far.
    $this->assertSame(200, $this->suggest(self::text(['fields' => ['social.title']]))->getStatusCode());
    $this->assertCount(1, $this->calls);
    $this->config('ai.ai_prompt.canvas_metatag_search__default')->set('prompt', 'Write it in {language}.')->save();

    $this->useEcho();
    $marked = static fn (string $marker): array => self::text(['hint' => "Make it shorter $marker"]);
    $this->assertError(502, 'invalid_response', $this->suggest($marked('#garbage')));
    // Also from a default for structured chat, which claims structured output.
    $this->config('ai.settings')
      ->set('default_providers.chat_with_structured_response.provider_id', 'canvas_metatag_echo')
      ->set('default_providers.chat_with_structured_response.model_id', 'echo-structured')
      ->save();
    $this->assertError(502, 'invalid_response', $this->suggest($marked('#garbage')));
    $this->assertSame('echo-structured', end($this->calls)->getModelId());
    $this->config('ai.settings')->clear('default_providers.chat_with_structured_response')->save();
    $this->assertError(429, 'rate_limited', $this->suggest($marked('#rate-limit')));
    $this->assertError(503, 'quota_exceeded', $this->suggest($marked('#quota')));
    $this->assertError(503, 'quota_exceeded', $this->suggest(self::schema(['title' => '#quota'])));
    // A hijacked answer is cleaned, not refused.
    $this->assertSame(
      ['suggestions' => ['title' => ['Injected title {site} </script><script>alert(1)</script>']]],
      self::decodeResponse($this->suggest($marked('#inject'))),
    );

    // What the AI module's own subscribers throw before a call: a site policy
    // that blocks the prompt, and a provider that cannot be set up.
    $this->refusal = new AiUnsafePromptException('The prompt was flagged.');
    $this->assertError(422, 'blocked', $this->suggest(self::text()));
    $this->refusal = new AiSetupFailureException('Could not load the API key.');
    $this->assertError(422, 'ai_not_configured', $this->suggest(self::text()));
    // A provider that refuses the key or the model, or cannot chat.
    $this->refusal = new AiAccessDeniedException('Access denied to the model.');
    $this->assertError(422, 'ai_not_configured', $this->suggest(self::text()));
    $this->refusal = new AiMissingFeatureException('Chat is not supported.');
    $this->assertError(422, 'ai_not_configured', $this->suggest(self::text()));
    $this->refusal = new AiOperationTypeMissingException('The operation type is missing.');
    $this->assertError(422, 'ai_not_configured', $this->suggest(self::text()));
    // Broken output, as the AI module reports it.
    $this->refusal = new AiBrokenOutputException('The output was broken.');
    $this->assertError(502, 'invalid_response', $this->suggest(self::text()));
    $this->refusal = NULL;

    // A site guardrail that stops the request.
    AiGuardrail::create([
      'id' => 'policy',
      'label' => 'Policy',
      'description' => '',
      'guardrail' => 'regexp_guardrail',
      'guardrail_settings' => [
        'regexp_pattern' => '/#policy/',
        'scan_all_user_messages' => FALSE,
        'violation_message' => 'Stopped by the policy.',
      ],
    ])->save();
    AiGuardrailSet::create([
      'id' => 'policy',
      'label' => 'Policy',
      'description' => '',
      'stop_threshold' => 1.0,
      'pre_generate_guardrails' => ['plugin_id' => ['policy']],
      'post_generate_guardrails' => ['plugin_id' => []],
    ])->save();
    $this->config('ai.settings')->set('global_guardrails', ['policy'])->save();
    $response = $this->suggest($marked('#policy'));
    $this->assertError(422, 'blocked', $response);
    // Neutral: only the dialog knows whether the request had Refine text.
    $this->assertSame("The site's AI rules stopped this request.", self::decodeResponse($response)['error']['message']);
    $this->assertSame(200, $this->suggest($marked(''))->getStatusCode());

    // Anything else the provider throws.
    $this->setDefault('echoai', 'test_exception');
    $this->assertError(502, 'provider_error', $this->suggest(self::text()));
  }

  /**
   * A failure is logged with task, prompt kind and class, and no text.
   */
  public function testNothingOfThePromptIsLogged(): void {
    $this->useEcho();
    foreach (['#garbage', '#rate-limit', '#quota', '#inject', ''] as $marker) {
      $this->suggest(self::text(['hint' => "Mention the falcon $marker", 'current' => ['title' => 'Old otter title']]));
      $this->suggest(self::schema(['title' => "Zebra crossing guide $marker"]));
    }
    $this->suggest(self::text(['fields' => ['social.title'], 'hint' => '#rate-limit']));
    $this->setDefault('echoai', 'test_exception');
    $this->suggest(self::text());
    // A failure before any provider call: the default names a plugin that
    // cannot be created, which the AI module does not log.
    $this->setDefault('gone', 'echo-json');
    $this->suggest(self::text());

    $ours = array_values(array_filter($this->log->records, static fn (string $record): bool => str_starts_with($record, 'canvas_metatag_ai: ')));
    $this->assertSame([
      'canvas_metatag_ai: AI suggestion failed (invalid_response). Task: text. Prompt: search. Exception: Drupal\canvas_metatag_ai\AiException.',
      'canvas_metatag_ai: AI suggestion failed (invalid_response). Task: schema. Prompt: schema. Exception: Drupal\canvas_metatag_ai\AiException.',
      'canvas_metatag_ai: AI suggestion failed (rate_limited). Task: text. Prompt: search. Exception: Drupal\ai\Exception\AiRateLimitException.',
      'canvas_metatag_ai: AI suggestion failed (rate_limited). Task: schema. Prompt: schema. Exception: Drupal\ai\Exception\AiRateLimitException.',
      'canvas_metatag_ai: AI suggestion failed (quota_exceeded). Task: text. Prompt: search. Exception: Drupal\ai\Exception\AiQuotaException.',
      'canvas_metatag_ai: AI suggestion failed (quota_exceeded). Task: schema. Prompt: schema. Exception: Drupal\ai\Exception\AiQuotaException.',
      'canvas_metatag_ai: AI suggestion failed (rate_limited). Task: text. Prompt: social. Exception: Drupal\ai\Exception\AiRateLimitException.',
      'canvas_metatag_ai: AI suggestion failed (provider_error). Task: text. Prompt: search. Exception: Drupal\ai\Exception\AiResponseErrorException.',
      'canvas_metatag_ai: AI suggestion failed (ai_not_configured). Task: text. Prompt: search. Exception: Drupal\Component\Plugin\Exception\PluginNotFoundException.',
    ], $ours);

    // No channel received the page, the editor's words or a model's answer.
    $this->assertNotEmpty($this->log->records);
    $log = implode("\n", $this->log->records);
    $secrets = [
      // The request.
      'Zebra', 'Giraffe', 'penguin', 'falcon', 'otter',
      // The model's answers.
      'cannot help', 'Echo title', 'Injected', 'Garden',
      // The prompts.
      'page_content', 'You write the text', 'You classify',
    ];
    foreach ($secrets as $secret) {
      $this->assertStringNotContainsString($secret, $log);
    }
  }

  /**
   * Asking for suggestions changes no configuration, page or draft.
   */
  public function testNothingIsWritten(): void {
    $this->useEcho();
    $page = Page::create(['title' => 'Zebra crossing guide', 'description' => 'Old description', 'status' => TRUE]);
    $page->save();
    $stored = fn (): array => [
      $this->container->get('config.storage')->readMultiple($this->container->get('config.storage')->listAll()),
      $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID)->loadUnchanged($page->id())->toArray(),
      $this->container->get(AutoSaveManager::class)->getAllAutoSaveList(FALSE, FALSE),
    ];
    $before = $stored();

    $this->assertSame(200, $this->suggest(self::text(['fields' => ['title', 'description']]))->getStatusCode());
    $this->assertSame(200, $this->suggest(self::text(['fields' => ['social.title', 'social.description']]))->getStatusCode());
    $this->assertSame(200, $this->suggest(self::schema())->getStatusCode());
    $this->assertError(502, 'invalid_response', $this->suggest(self::text(['hint' => '#garbage'])));

    $this->assertEquals($before, $stored());
  }

  /**
   * The capabilities hook reports the provider, to people who may use it.
   */
  public function testCapabilitiesHook(): void {
    $ai = function (): array {
      $capabilities = ['ai' => NULL];
      $this->container->get('module_handler')->alter('canvas_metatag_capabilities', $capabilities);
      return $capabilities;
    };
    $this->assertSame(['ai' => ['available' => FALSE, 'reason' => 'no_provider']], $ai());
    $this->useEcho();
    $this->assertSame(['ai' => ['available' => TRUE, 'reason' => NULL]], $ai());
    $this->setUpCurrentUser(permissions: ['edit canvas metatag']);
    $this->assertSame(['ai' => NULL], $ai());
  }

  /**
   * The dialog's state says whether suggestions can be offered, and to whom.
   */
  public function testCapabilitiesInState(): void {
    $ai = fn (): mixed => self::decodeResponse($this->request(Request::create('/canvas-metatag/api/state')))['capabilities'];

    $this->assertSame(['ai' => ['available' => FALSE, 'reason' => 'no_provider']], $ai());
    $this->useEcho();
    $this->assertSame(['ai' => ['available' => TRUE, 'reason' => NULL]], $ai());

    // A deleted prompt turns suggestions off.
    AiPrompt::load('canvas_metatag_social__default')->delete();
    $this->assertSame(['ai' => ['available' => FALSE, 'reason' => 'no_prompt']], $ai());

    // Without the AI permission the dialog learns nothing about the provider.
    $this->setUpCurrentUser(permissions: ['edit canvas metatag']);
    $this->assertSame(['ai' => NULL], $ai());
    $this->assertSame([], $this->calls);
  }

  /**
   * The input of the latest provider call.
   */
  private function lastInput(): ChatInput {
    $call = end($this->calls);
    $this->assertInstanceOf(PreGenerateResponseEvent::class, $call);
    $input = $call->getInput();
    $this->assertInstanceOf(ChatInput::class, $input);
    return $input;
  }

  /**
   * A valid text request, with members replaced.
   *
   * @param array<string, mixed> $replace
   *   Members to replace or add.
   *
   * @return array<string, mixed>
   *   The request body.
   */
  private static function text(array $replace = []): array {
    return $replace + [
      'task' => 'text',
      'fields' => ['title'],
      'count' => 3,
      'langcode' => 'en',
      'current' => ['title' => 'Pricing'],
      'hint' => '',
      'page' => self::PAGE,
    ];
  }

  /**
   * A valid schema request, with members of the page replaced.
   *
   * @param array<string, string> $page
   *   Members of the page to replace.
   *
   * @return array<string, mixed>
   *   The request body.
   */
  private static function schema(array $page = []): array {
    return ['task' => 'schema', 'langcode' => 'en', 'page' => $page + self::PAGE];
  }

  /**
   * Posts to the suggest route as the current user.
   *
   * A denial by the route (permission, CSRF) is returned as a bare response
   * with its status code.
   *
   * @param array<string, mixed>|string $body
   *   The body, encoded as JSON unless it is a string.
   * @param array<string, string> $cookies
   *   Request cookies.
   * @param string|null $token
   *   The CSRF header token, if any.
   */
  private function suggest(array|string $body, array $cookies = [], ?string $token = NULL): Response {
    $content = is_string($body) ? $body : (string) json_encode($body);
    $request = Request::create(self::PATH, 'POST', cookies: $cookies, server: ['CONTENT_TYPE' => 'application/json'], content: $content);
    if ($token !== NULL) {
      $request->headers->set('X-CSRF-Token', $token);
    }
    try {
      return $this->request($request);
    }
    catch (HttpExceptionInterface $e) {
      return new Response('', $e->getStatusCode());
    }
  }

  /**
   * Asserts the error shape: a code and a message, and nothing else.
   */
  private function assertError(int $status, string $code, Response $response, string $case = ''): void {
    $this->assertSame($status, $response->getStatusCode(), $case);
    $body = self::decodeResponse($response);
    $this->assertSame(['error'], array_keys($body), $case);
    $this->assertSame(['code', 'message'], array_keys($body['error']), $case);
    $this->assertSame($code, $body['error']['code'], $case);
    $this->assertNotSame('', $body['error']['message'], $case);
    // Provider messages stay on the server.
    foreach (['Too Many Requests', 'quota', 'Simulated', 'flagged', 'API key', 'plugin'] as $provider_text) {
      $this->assertStringNotContainsString($provider_text, $body['error']['message'], $case);
    }
  }

  /**
   * Makes the test provider the site's default chat provider.
   */
  private function useEcho(): void {
    $this->setDefault('canvas_metatag_echo', 'echo-json');
  }

  /**
   * Sets the site's default chat provider and model.
   */
  private function setDefault(string $provider, string $model): void {
    $this->config('ai.settings')
      ->set('default_providers.chat', ['provider_id' => $provider, 'model_id' => $model])
      ->save();
  }

}
