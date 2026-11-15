<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag_ai\Kernel;

use Drupal\ai\Entity\AiPrompt;
use Drupal\ai\Entity\AiPromptType;
use Drupal\canvas_metatag_ai\Hook\AiHooks;
use Drupal\canvas_metatag_ai\Routing\RouteSubscriber;
use Drupal\Core\Url;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Tests the prompts the submodule installs, protects and removes.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(AiHooks::class)]
#[CoversClass(RouteSubscriber::class)]
#[Group('canvas_metatag')]
final class PromptsTest extends CanvasKernelTestBase {

  use UserCreationTrait;

  private const array SHIPPED = [
    'ai.ai_prompt.canvas_metatag_schema__default',
    'ai.ai_prompt.canvas_metatag_search__default',
    'ai.ai_prompt.canvas_metatag_social__default',
    'ai.ai_prompt_type.canvas_metatag_schema',
    'ai.ai_prompt_type.canvas_metatag_search',
    'ai.ai_prompt_type.canvas_metatag_social',
  ];

  /**
   * {@inheritdoc}
   *
   * The submodule itself is installed by each test, as a site would.
   */
  protected static $modules = [
    ...self::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_metatag',
    'key',
    'ai',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installSchema('user', ['users_data']);
    $this->installEntitySchema('path_alias');
    $this->container->get('module_installer')->install(['canvas_metatag_ai']);
  }

  /**
   * Install adds the types and prompts; uninstall removes every prompt.
   */
  public function testInstallAndUninstall(): void {
    $this->assertSame(self::SHIPPED, $this->ours());

    // A default prompt added back as the Prompt Library saves it (after a
    // configuration import removed it), and another prompt of our type.
    AiPrompt::load('canvas_metatag_social__default')->delete();
    $this->addPrompt('default', 'canvas_metatag_social');
    $this->addPrompt('other', 'canvas_metatag_search');
    foreach (['social__default', 'search__other'] as $id) {
      $this->assertSame(['canvas_metatag_ai'], $this->config("ai.ai_prompt.canvas_metatag_$id")->get('dependencies.enforced.module'));
    }
    // A prompt of another module's type is left alone.
    AiPromptType::create(['id' => 'elsewhere', 'label' => 'Elsewhere', 'variables' => [], 'tokens' => []])->save();
    $this->addPrompt('mine', 'elsewhere');
    $this->assertSame([], $this->config('ai.ai_prompt.elsewhere__mine')->get('dependencies'));

    $this->container->get('module_installer')->uninstall(['canvas_metatag_ai']);
    $this->assertSame([], $this->ours());
    $this->assertNotNull(AiPrompt::load('elsewhere__mine'));

    // Nothing is left to block a reinstall.
    $this->container->get('module_installer')->install(['canvas_metatag_ai']);
    $this->assertSame(self::SHIPPED, $this->ours());
  }

  /**
   * The default prompts can be edited but not deleted; other prompts can.
   */
  public function testDefaultPromptsCannotBeDeleted(): void {
    $this->createUser();
    $this->setUpCurrentUser(permissions: ['manage ai prompts']);
    $this->addPrompt('other', 'canvas_metatag_search');

    foreach (['search', 'social', 'schema'] as $kind) {
      $prompt = AiPrompt::load("canvas_metatag_{$kind}__default");
      $this->assertTrue($prompt->access('update'), $kind);
      $this->assertFalse($prompt->access('delete'), $kind);
      // Also by URL, where the AI module checks only its permission.
      $this->assertFalse(Url::fromRoute('entity.ai_prompt.delete_form', ['ai_prompt' => $prompt->id()])->access(), $kind);
      $this->assertTrue(Url::fromRoute('entity.ai_prompt.edit_form', ['ai_prompt' => $prompt->id()])->access(), $kind);
    }
    $this->assertTrue(AiPrompt::load('canvas_metatag_search__other')->access('delete'));
    $this->assertTrue(Url::fromRoute('entity.ai_prompt.delete_form', ['ai_prompt' => 'canvas_metatag_search__other'])->access());
  }

  /**
   * Saves a prompt as the Prompt Library would, with the type's variables.
   */
  private function addPrompt(string $id, string $type): void {
    AiPrompt::create([
      'id' => $id,
      'label' => $id,
      'type' => $type,
      'prompt' => 'Write in {language}, {count} times.',
    ])->save();
  }

  /**
   * The names of our prompt types and prompts in active configuration.
   *
   * @return list<string>
   *   Sorted config names.
   */
  private function ours(): array {
    $config = $this->container->get('config.factory');
    $names = array_merge($config->listAll('ai.ai_prompt.canvas_metatag_'), $config->listAll('ai.ai_prompt_type.canvas_metatag_'));
    sort($names);
    return $names;
  }

}
