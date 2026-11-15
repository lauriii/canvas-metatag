<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag_ai\Kernel;

use Drupal\ai\Entity\AiPrompt;
use Drupal\ai\Event\PreGenerateResponseEvent;
use Drupal\canvas_metatag_ai\Hook\AiHooks;
use Drupal\Core\Extension\Requirement\RequirementSeverity;
use Drupal\Core\Url;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Tests the status report entry for suggestions.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(AiHooks::class)]
#[Group('canvas_metatag')]
final class RequirementsTest extends CanvasKernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...self::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_metatag',
    'key',
    'ai',
    'ai_test',
    'not_setup_provider',
    'canvas_metatag_ai',
    'canvas_metatag_ai_test',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('path_alias');
    $this->installConfig(['ai', 'canvas_metatag_ai']);
    $this->container->get('router.builder')->rebuild();
    $this->container->get('event_dispatcher')->addListener(PreGenerateResponseEvent::EVENT_NAME, function (): void {
      $this->fail('The status report called a provider.');
    });
  }

  /**
   * The entry names what is used, or why suggestions are off and where to go.
   */
  public function testEntry(): void {
    $this->assertEntry(RequirementSeverity::Warning, 'Off', 'No default AI provider is set for chat.', 'ai.settings_form');

    $this->setDefault('chat', 'not_setup_provider', 'test-model');
    $this->assertEntry(RequirementSeverity::Warning, 'Off', 'The default AI provider, Not Setup Provider, is not set up.', 'ai.admin_providers');
    // A provider module that is gone: the providers page cannot fix that.
    $this->setDefault('chat', 'gone', 'x');
    $this->assertEntry(RequirementSeverity::Warning, 'Off', 'The default AI provider, gone, is not installed.', 'ai.settings_form');

    $this->setDefault('chat', 'canvas_metatag_echo', 'echo-json');
    $this->assertEntry(RequirementSeverity::OK, 'On', 'Suggestions use Canvas Metatag Echo (model echo-json).', 'ai.settings_form');
    $this->setDefault('chat_with_structured_response', 'canvas_metatag_echo', 'echo-structured');
    $this->assertEntry(RequirementSeverity::OK, 'On', 'Suggestions use Canvas Metatag Echo (model echo-structured).', 'ai.settings_form');
  }

  /**
   * A prompt is named by its own label, with the way to add it back.
   */
  public function testPrompts(): void {
    $this->setDefault('chat', 'canvas_metatag_echo', 'echo-json');
    $library = 'entity.ai_prompt.collection';
    $link = '<a href="' . Url::fromRoute($library)->toString() . '">';

    // The Prompt Library keeps a default prompt from being deleted, but its
    // text can be emptied, and its label changed with it.
    $this->config('ai.ai_prompt.canvas_metatag_social__default')->set('prompt', ' ')->set('label', 'Link cards')->save();
    $this->assertEntry(RequirementSeverity::Warning, 'Off', "The suggestion prompt &quot;Link cards&quot; is empty. {$link}Write it in the Prompt Library</a>.", $library);
    $this->config('ai.ai_prompt.canvas_metatag_search__default')->set('prompt', "\n")->save();
    $this->assertEntry(RequirementSeverity::Warning, 'Off', "The suggestion prompts &quot;SEO: search result text&quot;, &quot;Link cards&quot; are empty. {$link}Write them in the Prompt Library</a>.", $library);

    // Configuration can remove one: only the machine name "default" is used.
    $this->config('ai.ai_prompt.canvas_metatag_search__default')->set('prompt', 'Write.')->save();
    $this->config('ai.ai_prompt.canvas_metatag_social__default')->set('prompt', 'Write.')->save();
    AiPrompt::load('canvas_metatag_schema__default')->delete();
    $this->assertEntry(RequirementSeverity::Warning, 'Off', "The suggestion prompt &quot;SEO: structured data&quot; is missing. {$link}Add it in the Prompt Library</a> to the prompt type whose name starts the same, with the machine name \"default\".", $library);
    $this->config('ai.ai_prompt.canvas_metatag_social__default')->set('prompt', "\n")->save();
    $this->assertEntry(RequirementSeverity::Warning, 'Off', "The suggestion prompts &quot;Link cards&quot;, &quot;SEO: structured data&quot; are missing or empty. {$link}Write them in the Prompt Library</a>. Add a missing one to the prompt type whose name starts the same, with the machine name \"default\".", $library);

    // Without its type, the Prompt Library cannot add the prompt back.
    $this->config('ai.ai_prompt_type.canvas_metatag_schema')->delete();
    $this->assertEntry(RequirementSeverity::Warning, 'Off', 'A suggestion prompt type is missing, so the Prompt Library cannot add its prompt.', 'system.modules_uninstall');
    $this->config('ai.ai_prompt.canvas_metatag_social__default')->delete();
    $this->config('ai.ai_prompt_type.canvas_metatag_social')->delete();
    $this->assertEntry(RequirementSeverity::Warning, 'Off', '2 suggestion prompt types are missing, so the Prompt Library cannot add their prompts.', 'system.modules_uninstall');
  }

  /**
   * Asserts the entry, and the link its description carries.
   */
  private function assertEntry(RequirementSeverity $severity, string $value, string $sentence, string $route): void {
    $requirements = $this->container->get('module_handler')->invoke('canvas_metatag_ai', 'runtime_requirements');
    $this->assertSame(['canvas_metatag_ai'], array_keys($requirements));
    $entry = $requirements['canvas_metatag_ai'];
    $this->assertSame('SEO suggestions (Canvas Metatag AI)', (string) $entry['title']);
    $this->assertSame($severity, $entry['severity']);
    $this->assertSame($value, (string) $entry['value']);
    $description = (string) $entry['description'];
    $this->assertStringStartsWith($sentence, $description);
    $this->assertStringContainsString('<a href="' . Url::fromRoute($route)->toString() . '">', $description);
  }

  /**
   * Sets the site's default provider and model for an operation type.
   */
  private function setDefault(string $operation, string $provider, string $model): void {
    $this->config('ai.settings')
      ->set("default_providers.$operation", ['provider_id' => $provider, 'model_id' => $model])
      ->save();
  }

}
