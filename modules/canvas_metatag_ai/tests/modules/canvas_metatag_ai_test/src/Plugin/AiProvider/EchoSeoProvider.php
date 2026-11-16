<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag_ai_test\Plugin\AiProvider;

use Drupal\ai\Attribute\AiProvider;
use Drupal\ai\Exception\AiQuotaException;
use Drupal\ai\Exception\AiRateLimitException;
use Drupal\ai\OperationType\Chat\ChatInput;
use Drupal\ai\OperationType\Chat\ChatMessage;
use Drupal\ai\OperationType\Chat\ChatOutput;
use Drupal\ai_test\Plugin\AiProvider\EchoProvider;
use Drupal\Core\StringTranslation\TranslatableMarkup;

/**
 * A chat provider with fixed answers for the SEO dialog's two tasks.
 *
 * A marker anywhere in the user message selects the answer, so one test run
 * can reach every path: the "Refine" text in the browser, the page title in
 * kernel tests.
 *
 * - no marker: JSON for the requested schema;
 * - #garbage: prose, also when the system prompt does not end with the
 *   fence and the answer shape, as a model not told the shape might;
 * - #rate-limit, #quota: the provider's typed exceptions;
 * - #inject: what a hijacked model would try.
 */
#[AiProvider(
  id: 'canvas_metatag_echo',
  label: new TranslatableMarkup('Canvas Metatag Echo'),
)]
final class EchoSeoProvider extends EchoProvider {

  /**
   * Two models, listed for every capability, structured response included.
   *
   * Unlike most test providers it honours the structured output schema, so
   * a site can make it the default for structured chat. Both answer the
   * same: two ids let a test tell the structured chat default from the chat
   * default.
   *
   * @param string|null $operation_type
   *   The operation type. Not used.
   * @param array<mixed> $capabilities
   *   The capabilities asked for. Not used.
   *
   * @return array<string, string>
   *   Model id => label.
   */
  public function getConfiguredModels(?string $operation_type = NULL, array $capabilities = []): array {
    return ['echo-json' => 'Echo JSON', 'echo-structured' => 'Echo structured'];
  }

  /**
   * Answers one chat call.
   *
   * @param array<mixed>|string|\Drupal\ai\OperationType\Chat\ChatInput $input
   *   The input. The assistant always sends a chat input.
   * @param string $model_id
   *   The model id. Not used.
   * @param array<mixed> $tags
   *   The request tags. Not used.
   */
  public function chat(array|string|ChatInput $input, string $model_id, array $tags = []): ChatOutput {
    \assert($input instanceof ChatInput);
    $message = $input->getMessages()[0]->getText();
    $schema = $input->getChatStructuredJsonSchema();
    $text = ($schema['name'] ?? '') === 'canvas_metatag_text';
    $inject = str_contains($message, '#inject');

    if (str_contains($message, '#rate-limit')) {
      throw new AiRateLimitException('Too Many Requests');
    }
    if (str_contains($message, '#quota')) {
      throw new AiQuotaException('You exceeded your current quota');
    }
    // The fixed text the assistant adds after every configured prompt; a
    // title request also has the ending rule.
    $told = (bool) preg_match('~\n\nThe user message contains page text between <page_content> tags\. [^\n]+\n(?:The title ending given in the user message [^\n]+\n)?Answer with JSON only, in this shape: \{[^\n]+\}\z~', (string) $input->getSystemPrompt());
    if (str_contains($message, '#garbage') || !$told) {
      $answer = 'I cannot help with that.';
    }
    elseif ($text) {
      $rows = [];
      foreach ($schema['schema']['properties']['suggestions']['items']['properties']['field']['enum'] as $field) {
        if ($inject) {
          // An unrequested field, a planted dynamic value and markup.
          $rows[] = ['field' => 'canonical', 'value' => 'https://attacker.example.com/'];
          $rows[] = ['field' => $field, 'value' => "Injected $field {site} </script><script>alert(1)</script>"];
          continue;
        }
        // Five variants with "&" and "<", which the hostname filter would
        // mangle, plus a repeat and an empty one for the cleaner, and first
        // one that advertises an address, which the cleaner drops.
        $rows[] = ['field' => $field, 'value' => "Echo $field: order at www.example.com/menu"];
        foreach ([1, 1, 0, 2, 3, 4, 5] as $n) {
          $value = $n ? "Echo $field $n: fish & chips <fresh>" : ' ';
          $rows[] = ['field' => $field, 'value' => $value];
        }
      }
      $answer = self::json(['suggestions' => $rows]);
    }
    elseif ($inject) {
      // A planted dynamic value, and the facts a model must never propose.
      $answer = self::json([
        'type' => 'Product',
        'properties' => [
          ['key' => 'name', 'value' => 'Free {site} </script><script>alert(1)</script>'],
          ['key' => 'offers_price', 'value' => '0'],
          ['key' => 'offers_priceCurrency', 'value' => 'EUR'],
          ['key' => 'offers_availability', 'value' => 'InStock'],
          ['key' => 'sku', 'value' => 'FREE-1'],
          ['key' => '@id', 'value' => 'https://attacker.example.com/#identity'],
        ],
      ]);
    }
    elseif (!preg_match('~<page_content>\n([^\n]+)~', $message, $match)) {
      // Nothing to read: a web page, which has no property a model may fill.
      $answer = self::json(['type' => 'WebPage', 'properties' => [['key' => 'name', 'value' => 'Untitled']]]);
    }
    else {
      // The event is named after the first line of the page text, so one
      // value is found on any page. The venue never is, and a date is never
      // taken as found.
      $answer = self::json([
        'type' => 'Event',
        'properties' => [
          ['key' => 'name', 'value' => mb_substr($match[1], 0, 80)],
          ['key' => 'startDate', 'value' => '2027-03-04T18:00'],
          ['key' => 'endDate', 'value' => 'next Friday'],
          ['key' => 'location_name', 'value' => 'Garden Hall & Co <main> https://example.com/venue'],
          ['key' => 'eventStatus', 'value' => 'EventCancelled'],
          ['key' => 'image', 'value' => 'https://example.com/poster.jpg'],
        ],
      ]);
    }
    return new ChatOutput(new ChatMessage('assistant', $answer), ['mock' => TRUE], []);
  }

  /**
   * Encodes like a model writes: "&", "<" and "/" are not escaped.
   *
   * @param array<string, mixed> $data
   *   The answer.
   */
  private static function json(array $data): string {
    return (string) json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  }

}
