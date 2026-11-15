<?php

/**
 * @file
 * Hooks provided by the Canvas Metatag module.
 */

declare(strict_types=1);

/**
 * @addtogroup hooks
 * @{
 */

/**
 * Alters the optional capabilities the SEO dialog is told about.
 *
 * The result is the `capabilities` member of the dialog's state. Its only
 * member is `ai`: NULL when suggestions are not offered to the current user,
 * else a map with `available` (bool) and `reason` (NULL, 'no_provider',
 * 'not_usable' or 'no_prompt').
 *
 * @param array<string, mixed> $capabilities
 *   The capabilities; `ai` is NULL when this hook is invoked.
 */
function hook_canvas_metatag_capabilities_alter(array &$capabilities): void {
  if (\Drupal::currentUser()->hasPermission('use canvas metatag ai')) {
    $capabilities['ai'] = ['available' => TRUE, 'reason' => NULL];
  }
}

/**
 * @} End of "addtogroup hooks".
 */
