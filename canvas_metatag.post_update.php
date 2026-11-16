<?php

/**
 * @file
 * Post update functions for Canvas Metatag.
 */

declare(strict_types=1);

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas_metatag\Legacy;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Cache\Cache;
use Drupal\Core\Config\Entity\ConfigEntityStorageInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\Sql\SqlContentEntityStorage;
use Drupal\media\Plugin\media\Source\Image;

/**
 * Converts values stored in the brace form into typed text and links.
 *
 * Site settings, every node template and its draft, every revision and
 * translation of a page (in the tables, so that a revert never brings the old
 * form back), and every page draft. Fifty page revisions at a time. A loss is
 * logged with the entity and key, never a value of the content.
 */
function canvas_metatag_post_update_values_as_parts(array &$sandbox): string {
  $log = static function (string $entity, array $lines) use (&$sandbox): void {
    foreach ($lines as $line) {
      \Drupal::logger('canvas_metatag')->warning('@entity: @line', ['@entity' => $entity, '@line' => $line]);
      $sandbox['logged'] = ($sandbox['logged'] ?? 0) + 1;
    }
  };
  $auto_save = \Drupal::service(AutoSaveManager::class);
  $pages = \Drupal::entityTypeManager()->getStorage('canvas_page');
  assert($pages instanceof SqlContentEntityStorage);
  $none = static fn (): ?array => NULL;

  if (!isset($sandbox['step'])) {
    // The site first: a page or template ending equal to the site's is not
    // kept.
    $config = \Drupal::configFactory()->getEditable('canvas_metatag.site');
    $values = $config->get('values');
    [$site, $lines] = Legacy::convert(is_array($values) ? $values : [], 'site', $none);
    $config->set('values', $site)->save();
    $log('canvas_metatag.site', $lines);

    // Templates and their drafts. Saving a template drops its draft, so both
    // are converted first (a failure then fails the update with nothing
    // lost, and it can run again), and the draft is written back under its
    // own client id after the save.
    $templates = \Drupal::entityTypeManager()->getStorage(ContentTemplate::ENTITY_TYPE_ID);
    assert($templates instanceof ConfigEntityStorageInterface);
    foreach ($templates->loadMultipleOverrideFree() as $template) {
      assert($template instanceof ContentTemplate);
      if ($template->getTargetEntityTypeId() !== 'node') {
        continue;
      }
      $field = _canvas_metatag_post_update_fields($template->getTargetBundle());
      $draft = $auto_save->getAutoSaveEntity($template, TRUE);
      $entity = $draft->entity instanceof ContentTemplate ? $draft->entity : NULL;
      // Its owner and time, before the save below deletes it.
      $kept = \Drupal::keyValue(AutoSaveManager::AUTO_SAVE_STORE)->get(AutoSaveManager::getAutoSaveKey($template));
      $values = $template->getThirdPartySetting('canvas_metatag', 'values');
      $saved = is_array($values) && $values;
      $stored = $saved ? Legacy::convert($values, 'template', $field, $site['title_end'] ?? NULL) : NULL;
      $values = $entity?->getThirdPartySetting('canvas_metatag', 'values');
      $drafted = $entity && ($saved || is_array($values)) ? Legacy::convert(is_array($values) ? $values : [], 'template', $field, $site['title_end'] ?? NULL) : NULL;
      if ($stored) {
        [$new, $lines] = $stored;
        $new ? $template->setThirdPartySetting('canvas_metatag', 'values', $new) : $template->unsetThirdPartySetting('canvas_metatag', 'values');
        $template->save();
        $log($template->id(), $lines);
      }
      if ($entity && $drafted) {
        [$new, $lines] = $drafted;
        $new ? $entity->setThirdPartySetting('canvas_metatag', 'values', $new) : $entity->unsetThirdPartySetting('canvas_metatag', 'values');
        _canvas_metatag_post_update_draft($entity, $draft->clientId, is_array($kept) ? $kept : NULL);
        $log($template->id() . ' (draft)', $lines);
      }
    }
    // Page drafts that are in step with their stored page stay so: the rows
    // are rewritten under them (see the end).
    $in_step = [];
    foreach ($auto_save->getAllAutoSaveList(FALSE, TRUE) as $key => $entry) {
      if ($entry['entity_type'] === 'canvas_page' && !isset($entry[AutoSaveManager::AUTO_SAVE_CONFLICT_KEY])) {
        $in_step[] = $key;
      }
    }
    $sandbox = ['step' => 'pages', 'last' => 0, 'site_end' => $site['title_end'] ?? NULL, 'in_step' => $in_step] + $sandbox;
  }

  if ($sandbox['step'] === 'pages') {
    $definition = \Drupal::service('entity_field.manager')->getFieldStorageDefinitions('canvas_page')['canvas_metatag'] ?? NULL;
    $column = $definition ? $pages->getTableMapping()->getFieldColumnName($definition, 'value') : NULL;
    $database = \Drupal::database();
    $revisions = $column ? $database->select($pages->getRevisionDataTable(), 'r')
      ->fields('r', ['revision_id'])
      ->isNotNull($column)
      ->condition('revision_id', $sandbox['last'], '>')
      ->orderBy('revision_id')
      ->distinct()
      ->range(0, 50)
      ->execute()
      ->fetchCol() : [];
    if ($revisions) {
      $rows = $database->select($pages->getRevisionDataTable(), 'r')
        ->fields('r', ['id', 'revision_id', 'langcode', $column])
        ->condition('revision_id', $revisions, 'IN')
        ->isNotNull($column)
        ->execute();
      foreach ($rows as $row) {
        $stored = $row->{$column};
        [$new, $lines] = Legacy::convert(Values::decode($stored), 'page', $none, $sandbox['site_end']);
        $encoded = Values::encode($new);
        if ($encoded !== $stored) {
          foreach ([$pages->getRevisionDataTable(), $pages->getDataTable()] as $table) {
            $database->update($table)
              ->fields([$column => $encoded])
              ->condition('revision_id', $row->revision_id)
              ->condition('langcode', $row->langcode)
              ->execute();
          }
        }
        $log("canvas_page $row->id ($row->langcode, revision $row->revision_id)", $lines);
      }
      $sandbox['last'] = max($revisions);
      $sandbox['#finished'] = 0.5;
      return (string) t('Converted SEO values of page revisions up to @id.', ['@id' => $sandbox['last']]);
    }
    $sandbox['step'] = 'drafts';
  }

  // Page drafts: their layout work is kept, under the same client id.
  $pages->resetCache();
  $translation = static function (array $entry) use ($pages): ?ContentEntityInterface {
    $page = $pages->load($entry['entity_id']);
    $langcode = (string) $entry['langcode'];
    try {
      // A draft of a translation that was never published has no stored one.
      return !$page instanceof ContentEntityInterface ? NULL : ($page->hasTranslation($langcode) ? $page->getTranslation($langcode) : (clone $page)->addTranslation($langcode));
    }
    catch (\InvalidArgumentException) {
      return NULL;
    }
  };
  foreach ($auto_save->getAllAutoSaveList(FALSE, FALSE) as $entry) {
    $page = $entry['entity_type'] === 'canvas_page' && !empty($entry['data']['canvas_metatag']) ? $translation($entry) : NULL;
    $draft = $page ? $auto_save->getAutoSaveEntity($page, TRUE) : NULL;
    if ($draft?->entity instanceof ContentEntityInterface) {
      $stored = $draft->entity->get('canvas_metatag')->value;
      [$new, $lines] = Legacy::convert(Values::decode($stored), 'page', $none, $sandbox['site_end']);
      if (Values::encode($new) !== $stored) {
        $draft->entity->set('canvas_metatag', Values::encode($new));
        _canvas_metatag_post_update_draft($draft->entity, $draft->clientId);
      }
      $log("canvas_page {$page->id()} ({$entry['langcode']}, draft)", $lines);
    }
  }
  // A draft that was in step with its page before the rows were rewritten is
  // in step with the rewritten page: never a conflict with an edit made
  // elsewhere, which Canvas would otherwise report.
  foreach ($auto_save->getAllAutoSaveList(FALSE, TRUE) as $key => $entry) {
    $page = in_array($key, $sandbox['in_step'] ?? [], TRUE) && isset($entry[AutoSaveManager::AUTO_SAVE_CONFLICT_KEY]) ? $translation($entry) : NULL;
    if ($page !== NULL) {
      $auto_save->resolveConflict($page, $entry[AutoSaveManager::AUTO_SAVE_CONFLICT_KEY]);
    }
  }
  Cache::invalidateTags(['canvas_page_list', 'rendered']);
  $sandbox['#finished'] = 1;
  return (string) t('SEO values are now typed text and links. @count changes that lost text are logged under canvas_metatag.', ['@count' => $sandbox['logged'] ?? 0]);
}

/**
 * How a whole `{field.NAME}` of a node type becomes a value.
 *
 * The type's first formatted text with a summary becomes the Description
 * fact; else the field's first source of that kind (Sources::sourceFor()).
 * An image field without one becomes the Image fact when it is the type's
 * first image field. Anything else gives NULL, which the converter logs.
 *
 * @return callable(string, string): ?array
 *   Field name and kind => value.
 */
function _canvas_metatag_post_update_fields(string $bundle): callable {
  $sources = \Drupal::service(Sources::class);
  $definitions = \Drupal::service('entity_field.manager')->getFieldDefinitions('node', $bundle);
  $display = \Drupal::entityTypeManager()->getStorage('entity_form_display')->load("node.$bundle.default");
  $order = [];
  foreach ($definitions as $name => $definition) {
    if (!$definition->getFieldStorageDefinition()->isBaseField()) {
      $weight = $display?->getComponent($name)['weight'] ?? NULL;
      $order[$name] = [$weight === NULL ? 1 : 0, (int) $weight, $name];
    }
  }
  asort($order);
  $first = ['text' => NULL, 'image' => NULL];
  foreach (array_keys($order) as $name) {
    $definition = $definitions[$name];
    $image = $definition->getType() === 'image' || ($definition->getType() === 'entity_reference' && $definition->getSetting('target_type') === 'media' && array_filter(
      \Drupal::entityTypeManager()->getStorage('media_type')->loadMultiple($definition->getSetting('handler_settings')['target_bundles'] ?? NULL ?: NULL),
      static fn ($type): bool => $type->getSource() instanceof Image,
    ));
    $first['text'] ??= $definition->getType() === 'text_with_summary' ? $name : NULL;
    $first['image'] ??= $image ? $name : NULL;
  }
  return static function (string $name, string $kind) use ($sources, $bundle, $first): ?array {
    if ($kind === 'text' && $name === $first['text']) {
      return ['fact' => 'description'];
    }
    $source = $sources->sourceFor($bundle, $name, $kind, TRUE);
    return match (TRUE) {
      $source !== NULL => ['source' => $source],
      $kind === 'image' && $name === $first['image'] => ['fact' => 'image'],
      default => NULL,
    };
  };
}

/**
 * Writes a converted draft back as its editor left it.
 *
 * Under the same client id, and with the owner and time of the editor's last
 * change: the update is not an edit.
 *
 * @param \Drupal\Core\Entity\EntityInterface $entity
 *   The converted draft.
 * @param string|null $client_id
 *   The client id it was stored under.
 * @param array|null $before
 *   Its store entry, when it was read before something deleted it (saving a
 *   template deletes its draft); else it is read here.
 */
function _canvas_metatag_post_update_draft(EntityInterface $entity, ?string $client_id, ?array $before = NULL): void {
  $store = \Drupal::keyValue(AutoSaveManager::AUTO_SAVE_STORE);
  $key = AutoSaveManager::getAutoSaveKey($entity);
  $before ??= $store->get($key);
  \Drupal::service(AutoSaveManager::class)->saveEntity($entity, $client_id);
  $after = $store->get($key);
  if (is_array($before) && is_array($after)) {
    $store->set($key, array_intersect_key($before, ['owner' => TRUE, 'updated' => TRUE]) + $after);
    Cache::invalidateTags([AutoSaveManager::CACHE_TAG]);
  }
}
