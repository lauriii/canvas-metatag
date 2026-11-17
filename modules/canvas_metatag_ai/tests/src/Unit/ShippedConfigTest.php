<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag_ai\Unit;

use Drupal\canvas_metatag_ai\Hook\AiHooks;
use Drupal\Component\Serialization\Yaml;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests the prompts and the permission text the submodule ships.
 */
#[Group('canvas_metatag')]
final class ShippedConfigTest extends UnitTestCase {

  private const array VARIABLES = [
    'search' => ['language', 'count'],
    'social' => ['language', 'count'],
    'schema' => ['types', 'properties'],
  ];

  /**
   * Three prompt types with their variables, three default prompts.
   */
  public function testPrompts(): void {
    $dir = dirname(__DIR__, 3) . '/config/install';
    $files = array_map('basename', glob("$dir/*.yml") ?: []);
    $expected = [];
    foreach (array_keys(self::VARIABLES) as $kind) {
      $expected[] = "ai.ai_prompt.canvas_metatag_{$kind}__default.yml";
      $expected[] = "ai.ai_prompt_type.canvas_metatag_$kind.yml";
    }
    sort($expected);
    sort($files);
    $this->assertSame($expected, $files);

    foreach (self::VARIABLES as $kind => $variables) {
      $type = Yaml::decode((string) file_get_contents("$dir/ai.ai_prompt_type.canvas_metatag_$kind.yml"));
      $prompt = Yaml::decode((string) file_get_contents("$dir/ai.ai_prompt.canvas_metatag_{$kind}__default.yml"));

      $this->assertSame("canvas_metatag_$kind", $type['id']);
      $this->assertSame($variables, array_column($type['variables'], 'name'), $kind);
      $this->assertSame(array_fill(0, count($variables), TRUE), array_column($type['variables'], 'required'), $kind);
      $this->assertSame([], $type['tokens']);
      // Type and prompt read as one family in the Prompt Library, which other
      // modules share.
      $this->assertSame(AiHooks::LABELS[$kind] . ' (only the prompt named "default" is used)', $type['label']);

      // The id is the one the prompt library enforces: <type>__<name>.
      $this->assertSame("canvas_metatag_{$kind}__default", $prompt['id']);
      $this->assertSame("canvas_metatag_$kind", $prompt['type']);
      $this->assertSame(AiHooks::LABELS[$kind], $prompt['label']);
      foreach ($variables as $variable) {
        $this->assertStringContainsString('{' . $variable . '}', $prompt['prompt'], $kind);
      }
      // The fence and the answer shape are added in code, never shipped.
      $this->assertStringNotContainsString('<page_content>', $prompt['prompt']);
      $this->assertStringNotContainsString('Answer with JSON', $prompt['prompt']);
      // So is the title ending rule.
      $this->assertStringNotContainsString('counts toward its length', $prompt['prompt']);

      // Uninstalling the submodule removes them (PromptsTest uninstalls).
      foreach ([$type, $prompt] as $config) {
        $this->assertSame(['canvas_metatag_ai'], $config['dependencies']['enforced']['module']);
      }
    }
  }

  /**
   * The permission says what is sent and that it may be logged.
   */
  public function testPermission(): void {
    $permissions = Yaml::decode((string) file_get_contents(dirname(__DIR__, 3) . '/canvas_metatag_ai.permissions.yml'));
    $description = $permissions['use canvas metatag ai']['description'];
    $this->assertStringContainsString('Each request is a paid call', $description);
    $this->assertStringContainsString('including unpublished draft text, to the AI provider.', $description);
    $this->assertStringContainsString('Sites that log AI requests may store that text.', $description);
  }

}
