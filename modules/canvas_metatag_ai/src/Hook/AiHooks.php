<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag_ai\Hook;

use Drupal\ai\AiProviderPluginManager;
use Drupal\ai\Entity\AiPromptInterface;
use Drupal\canvas_metatag_ai\Assistant;
use Drupal\Core\Access\AccessResult;
use Drupal\Core\Access\AccessResultInterface;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Extension\Requirement\RequirementSeverity;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\Core\StringTranslation\PluralTranslatableMarkup;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Core\Url;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Tells the SEO dialog and the status report whether suggestions work.
 *
 * Also keeps the prompts of our prompt types tied to this module.
 */
final class AiHooks {

  /**
   * The shipped label of each kind's default prompt, for one that is gone.
   */
  public const array LABELS = [
    'search' => 'SEO: search result text',
    'social' => 'SEO: social card text',
    'schema' => 'SEO: structured data',
  ];

  public function __construct(
    private readonly Assistant $assistant,
    private readonly AccountProxyInterface $currentUser,
    #[Autowire(service: 'ai.provider')]
    private readonly AiProviderPluginManager $aiProvider,
    private readonly ConfigFactoryInterface $configFactory,
  ) {}

  /**
   * Implements hook_canvas_metatag_capabilities_alter().
   *
   * People who may not ask for suggestions learn nothing about the provider.
   *
   * @param array<string, mixed> $capabilities
   *   The `capabilities` member of the dialog's state.
   */
  #[Hook('canvas_metatag_capabilities_alter')]
  public function capabilitiesAlter(array &$capabilities): void {
    if ($this->currentUser->hasPermission('use canvas metatag ai')) {
      $capabilities['ai'] = $this->assistant->status();
    }
  }

  /**
   * Implements hook_ENTITY_TYPE_presave() for ai_prompt.
   *
   * Every prompt of our types goes when the submodule is uninstalled, also
   * one added in the Prompt Library, which depends on nothing by itself. Left
   * behind, it would block a reinstall.
   */
  #[Hook('ai_prompt_presave')]
  public function promptPresave(AiPromptInterface $prompt): void {
    if (in_array($prompt->bundle(), array_map(static fn (string $kind): string => "canvas_metatag_$kind", Assistant::KINDS), TRUE)) {
      $dependencies = $prompt->get('dependencies') ?? [];
      $modules = $dependencies['enforced']['module'] ?? [];
      $dependencies['enforced']['module'] = array_values(array_unique([...$modules, 'canvas_metatag_ai']));
      $prompt->set('dependencies', $dependencies);
    }
  }

  /**
   * Implements hook_ENTITY_TYPE_access() for ai_prompt.
   *
   * The default prompts can be edited, not deleted: without one, every
   * suggestion is off. The route alter applies this to the delete form too.
   */
  #[Hook('ai_prompt_access')]
  public function promptAccess(AiPromptInterface $prompt, string $operation): AccessResultInterface {
    return $operation === 'delete' && in_array($prompt->id(), array_map(static fn (string $kind): string => "canvas_metatag_{$kind}__default", Assistant::KINDS), TRUE)
      ? AccessResult::forbidden('A default suggestion prompt cannot be deleted.')
      : AccessResult::neutral();
  }

  /**
   * Implements hook_runtime_requirements().
   *
   * Says what suggestions use, or why they are off and where to fix it. Like
   * the dialog's status, it never calls the provider's service.
   */
  #[Hook('runtime_requirements')]
  public function runtimeRequirements(): array {
    $status = $this->assistant->status();
    $default = $this->assistant->provider();
    $settings = Url::fromRoute('ai.settings_form')->toString();
    $definition = $default ? $this->aiProvider->getDefinition($default['provider_id'], FALSE) : NULL;
    $description = match ($status['reason']) {
      NULL => new TranslatableMarkup('Suggestions use @provider (model @model). <a href=":url">Change it in the AI settings</a>.', [
        '@provider' => $definition['label'] ?? $default['provider_id'] ?? '',
        '@model' => $default['model_id'] ?? '',
        ':url' => $settings,
      ]),
      'no_provider' => new TranslatableMarkup('No default AI provider is set for chat. <a href=":url">Choose one in the AI settings</a>.', [
        ':url' => $settings,
      ]),
      // A provider module that was uninstalled: the providers page does not
      // list it, so another default is the fix.
      'not_usable' => $definition === NULL
        ? new TranslatableMarkup('The default AI provider, @provider, is not installed. <a href=":url">Choose another one in the AI settings</a>.', [
          '@provider' => $default['provider_id'] ?? '',
          ':url' => $settings,
        ])
        : new TranslatableMarkup('The default AI provider, @provider, is not set up. <a href=":url">Set it up on the AI providers page</a>.', [
          '@provider' => $definition['label'],
          ':url' => Url::fromRoute('ai.admin_providers')->toString(),
        ]),
      default => $this->promptsMissing(),
    };
    return [
      'canvas_metatag_ai' => [
        'title' => new TranslatableMarkup('SEO suggestions (Canvas Metatag AI)'),
        'value' => $status['available'] ? new TranslatableMarkup('On') : new TranslatableMarkup('Off'),
        'description' => $description,
        'severity' => $status['available'] ? RequirementSeverity::OK : RequirementSeverity::Warning,
      ],
    ];
  }

  /**
   * Names the prompts that are missing or empty, and how to add them back.
   *
   * Default prompts cannot be deleted in the Prompt Library, so a missing one
   * was removed through configuration, usually with its type. Without its
   * type, the Prompt Library cannot add it again: a reinstall can.
   */
  private function promptsMissing(): TranslatableMarkup {
    $missing = $this->assistant->missingPrompts();
    $types = array_filter($missing, fn (string $kind): bool => $this->configFactory->get("ai.ai_prompt_type.canvas_metatag_$kind")->isNew());
    if ($types) {
      return new PluralTranslatableMarkup(count($types), 'A suggestion prompt type is missing, so the Prompt Library cannot add its prompt. <a href=":url">Uninstall Canvas Metatag AI</a> and install it again.', '@count suggestion prompt types are missing, so the Prompt Library cannot add their prompts. <a href=":url">Uninstall Canvas Metatag AI</a> and install it again.', [
        ':url' => Url::fromRoute('system.modules_uninstall')->toString(),
      ]);
    }
    $labels = $gone = [];
    foreach ($missing as $kind) {
      $config = $this->configFactory->get("ai.ai_prompt.canvas_metatag_{$kind}__default");
      $gone[] = $config->isNew();
      // Its own label, as the Prompt Library lists it, or the shipped one.
      $labels[] = '"' . ($config->get('label') ?? self::LABELS[$kind]) . '"';
    }
    $arguments = [
      '@prompts' => implode(', ', $labels),
      ':url' => Url::fromRoute('entity.ai_prompt.collection')->toString(),
    ];
    // Only the prompt named "default" is used: one added under another
    // machine name changes nothing. Each type's label starts with its
    // prompt's shipped label.
    return in_array(TRUE, $gone, TRUE)
      ? new PluralTranslatableMarkup(count($missing), 'The suggestion prompt @prompts is missing. <a href=":url">Add it in the Prompt Library</a> to the prompt type whose name starts the same, with the machine name "default".', 'The suggestion prompts @prompts are missing or empty. <a href=":url">Write them in the Prompt Library</a>. Add a missing one to the prompt type whose name starts the same, with the machine name "default".', $arguments)
      : new PluralTranslatableMarkup(count($missing), 'The suggestion prompt @prompts is empty. <a href=":url">Write it in the Prompt Library</a>.', 'The suggestion prompts @prompts are empty. <a href=":url">Write them in the Prompt Library</a>.', $arguments);
  }

}
