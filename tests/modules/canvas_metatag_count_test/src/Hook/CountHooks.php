<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag_count_test\Hook;

use Drupal\Core\Access\AccessResult;
use Drupal\Core\Access\AccessResultInterface;
use Drupal\Core\Field\FieldDefinitionInterface;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Session\AccountInterface;
use Drupal\node\NodeInterface;

/**
 * Counts anonymous view access checks, by node and by field.
 *
 * In the state "canvas_metatag_count_test": `node` => id => count, `field`
 * => machine name => count. Grants nothing, denies nothing.
 */
final class CountHooks {

  /**
   * Implements hook_node_access().
   */
  #[Hook('node_access')]
  public function nodeAccess(NodeInterface $node, string $operation, AccountInterface $account): AccessResultInterface {
    if ($operation === 'view' && $account->isAnonymous()) {
      $this->count('node', (string) $node->id());
    }
    return AccessResult::neutral();
  }

  /**
   * Implements hook_entity_field_access().
   */
  #[Hook('entity_field_access')]
  public function fieldAccess(string $operation, FieldDefinitionInterface $field_definition, AccountInterface $account, ?FieldItemListInterface $items = NULL): AccessResultInterface {
    if ($operation === 'view' && $account->isAnonymous()) {
      $this->count('field', $field_definition->getName());
    }
    return AccessResult::neutral();
  }

  /**
   * Adds one to a count.
   */
  private function count(string $group, string $key): void {
    $state = \Drupal::state();
    $counts = $state->get('canvas_metatag_count_test', []);
    $counts[$group][$key] = ($counts[$group][$key] ?? 0) + 1;
    $state->set('canvas_metatag_count_test', $counts);
  }

}
