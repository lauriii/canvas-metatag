<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag_ai\Controller;

use Drupal\ai\Exception\AiAccessDeniedException;
use Drupal\ai\Exception\AiBrokenOutputException;
use Drupal\ai\Exception\AiMissingFeatureException;
use Drupal\ai\Exception\AiOperationTypeMissingException;
use Drupal\ai\Exception\AiQuotaException;
use Drupal\ai\Exception\AiRateLimitException;
use Drupal\ai\Exception\AiSetupFailureException;
use Drupal\ai\Exception\AiUnsafePromptException;
use Drupal\canvas_metatag_ai\AiException;
use Drupal\canvas_metatag_ai\Assistant;
use Drupal\Component\Plugin\Exception\ExceptionInterface as PluginExceptionInterface;
use Drupal\Core\DependencyInjection\AutowireTrait;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Flood\FloodInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Returns AI suggestions for the SEO dialog.
 *
 * Suggestions only: this controller stores nothing. The editor applies a
 * suggestion in the dialog, where it is saved like anything typed.
 */
final class AiController implements ContainerInjectionInterface {

  use AutowireTrait;

  // Caps on one request. Every call is a paid, synchronous provider call.
  private const int MAX_BODY = 131072;
  private const int MAX_COUNT = 5;
  private const int MAX_HINT = 200;
  private const int MAX_CURRENT = 2000;
  private const int MAX_NAME = 255;
  private const int MAX_TEXT = 12000;

  // 30 calls per 5 minutes per user.
  private const string FLOOD_EVENT = 'canvas_metatag_ai.suggest';
  private const int FLOOD_LIMIT = 30;
  private const int FLOOD_WINDOW = 300;

  private const array FIELDS = ['title', 'description', 'social.title', 'social.description'];

  // Status and message per error code. The dialog switches on the code and
  // has its own wording. A provider's own message is never returned.
  private const array ERRORS = [
    'bad_request' => [400, 'The request is not valid.'],
    'ai_not_configured' => [422, "AI suggestions aren't set up on this site yet."],
    // What to do next depends on the request, so the dialog says it.
    'blocked' => [422, "The site's AI rules stopped this request."],
    'rate_limited' => [429, 'The AI service is busy. Try again in a minute.'],
    'quota_exceeded' => [503, "The site's AI allowance is used up. Ask a site administrator."],
    'invalid_response' => [502, "The AI answer couldn't be used. Try again."],
    'provider_error' => [502, "The AI service didn't answer. Try again."],
  ];

  public function __construct(
    private readonly Assistant $assistant,
    private readonly LanguageManagerInterface $languageManager,
    private readonly FloodInterface $flood,
    private readonly AccountProxyInterface $currentUser,
    #[Autowire(service: 'logger.channel.canvas_metatag_ai')]
    private readonly LoggerInterface $logger,
  ) {}

  /**
   * Suggests text variants, or a structured data type with its facts.
   */
  public function suggest(Request $request): JsonResponse {
    try {
      $input = $this->read($request->getContent());
    }
    catch (\InvalidArgumentException) {
      return self::error('bad_request');
    }

    $uid = (string) $this->currentUser->id();
    if (!$this->flood->isAllowed(self::FLOOD_EVENT, self::FLOOD_LIMIT, self::FLOOD_WINDOW, $uid)) {
      return self::error('rate_limited');
    }
    $this->flood->register(self::FLOOD_EVENT, self::FLOOD_WINDOW, $uid);

    try {
      if ($input['task'] === 'text') {
        return new JsonResponse([
          'suggestions' => $this->assistant->suggestText($input['fields'], $input['count'], $input['langcode'], $input['current'], $input['hint'], $input['page']),
        ]);
      }
      $proposal = $this->assistant->suggestSchema($input['langcode'], $input['page']);
      // A map with no members is still an object in JSON.
      $proposal['props'] = (object) $proposal['props'];
      return new JsonResponse($proposal);
    }
    catch (\Throwable $e) {
      $code = match (TRUE) {
        $e instanceof AiException => ['not_configured' => 'ai_not_configured', 'blocked' => 'blocked'][$e->reason] ?? 'invalid_response',
        $e instanceof AiSetupFailureException,
        $e instanceof AiOperationTypeMissingException,
        $e instanceof AiAccessDeniedException,
        $e instanceof AiMissingFeatureException,
        $e instanceof PluginExceptionInterface => 'ai_not_configured',
        $e instanceof AiUnsafePromptException => 'blocked',
        $e instanceof AiBrokenOutputException => 'invalid_response',
        $e instanceof AiRateLimitException => 'rate_limited',
        $e instanceof AiQuotaException => 'quota_exceeded',
        default => 'provider_error',
      };
      // One record per failure, also for those before the provider call,
      // which the AI module does not log. No message: a provider's message is
      // logged by the AI module on its own channel, and may quote the prompt.
      $this->logger->error('AI suggestion failed (@code). Task: @task. Prompt: @kind. Exception: @class.', [
        '@code' => $code,
        '@task' => $input['task'],
        '@kind' => $input['task'] === 'schema' ? 'schema' : Assistant::textKind($input['fields']),
        '@class' => $e::class,
      ]);
      return self::error($code);
    }
  }

  /**
   * Checks the request body and cuts every text to its cap.
   *
   * @return array{task: 'text'|'schema', langcode: string, page: array{title: string, site: string, text: string}, fields?: list<string>, count?: int, current?: array<string, string>, hint?: string}
   *   The request, safe to hand to the assistant.
   *
   * @throws \InvalidArgumentException
   *   When the body is too large, is not a JSON object, names an unknown
   *   task, field or language, or mixes social and search fields.
   */
  private function read(string $content): array {
    $body = strlen($content) > self::MAX_BODY ? NULL : json_decode($content, TRUE);
    $page = is_array($body) ? $body['page'] ?? NULL : NULL;
    $task = $body['task'] ?? NULL;
    $langcode = $body['langcode'] ?? NULL;
    // The language must be one of the site's own. Its configured name, not
    // this string, is what reaches the prompt.
    if (!is_array($page) || !in_array($task, ['text', 'schema'], TRUE) || !is_string($langcode) || !isset($this->languageManager->getLanguages()[$langcode])) {
      throw new \InvalidArgumentException();
    }
    $input = [
      'task' => $task,
      'langcode' => $langcode,
      'page' => [
        'title' => self::cut($page['title'] ?? '', self::MAX_NAME),
        'site' => self::cut($page['site'] ?? '', self::MAX_NAME),
        'text' => self::cut($page['text'] ?? '', self::MAX_TEXT),
      ],
    ];
    if ($task === 'schema') {
      return $input;
    }

    $fields = $body['fields'] ?? NULL;
    $count = $body['count'] ?? NULL;
    $current = $body['current'] ?? [];
    if (!is_array($fields) || !$fields || array_filter($fields, static fn (mixed $field): bool => !in_array($field, self::FIELDS, TRUE)) || !is_int($count) || !is_array($current)) {
      throw new \InvalidArgumentException();
    }
    // Search and social text have a prompt each, and neither has the rules
    // for the other. The dialog never mixes them.
    if (count(array_unique(array_map(Assistant::isSocial(...), $fields))) > 1) {
      throw new \InvalidArgumentException();
    }
    $fields = array_values(array_unique($fields));
    return $input + [
      'fields' => $fields,
      'count' => max(1, min(self::MAX_COUNT, $count)),
      'current' => array_map(static fn (mixed $value): string => self::cut($value, self::MAX_CURRENT), array_intersect_key($current, array_flip($fields))),
      'hint' => self::cut($body['hint'] ?? '', self::MAX_HINT),
    ];
  }

  /**
   * A request string, cut to its cap in characters.
   *
   * @throws \InvalidArgumentException
   *   When the value is not a string.
   */
  private static function cut(mixed $value, int $max): string {
    return is_string($value) ? mb_substr($value, 0, $max) : throw new \InvalidArgumentException();
  }

  /**
   * An error in the shape every route of the SEO dialog uses.
   */
  private static function error(string $code): JsonResponse {
    [$status, $message] = self::ERRORS[$code];
    return new JsonResponse(['error' => ['code' => $code, 'message' => $message]], $status);
  }

}
