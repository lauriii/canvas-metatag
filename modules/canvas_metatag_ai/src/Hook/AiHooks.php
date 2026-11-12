<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag_ai\Hook;

use Drupal\canvas_metatag_ai\Assistant;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Session\AccountProxyInterface;

/**
 * Tells the SEO dialog whether suggestions can be offered.
 */
final class AiHooks {

  public function __construct(
    private readonly Assistant $assistant,
    private readonly AccountProxyInterface $currentUser,
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

}
