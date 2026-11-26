<?php

/**
 * @file
 * Post update functions for Canvas Metatag.
 */

declare(strict_types=1);

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas_metatag\Legacy;
use Drupal\canvas_metatag\PageText;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Cache\Cache;
use Drupal\Core\Cache\CacheableMetadata;
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
    // A {sep} inside a composed template value is the separator, typed.
    $separator = Values::cleanIdentity((array) $config->get('identity'))[0]['separator'];

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
      $stored = $saved ? Legacy::convert($values, 'template', $field, $site['title_end'] ?? NULL, $separator) : NULL;
      $values = $entity?->getThirdPartySetting('canvas_metatag', 'values');
      $drafted = $entity && ($saved || is_array($values)) ? Legacy::convert(is_array($values) ? $values : [], 'template', $field, $site['title_end'] ?? NULL, $separator) : NULL;
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
    // The first formatted text with a summary is the Description fact, also
    // as a part of a description; never in a title.
    if (($kind === 'text' || $kind === 'words') && $name === $first['text']) {
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

/**
 * Keeps the site as the organizer of the events a template describes.
 *
 * An event's organizer was the site unless a name was typed, on templates
 * too. The site is now the organizer by default only on a Canvas page, so a
 * template, and its draft, that describes an event and never set an
 * organizer now says that the site is: the head stays as it was.
 */
function canvas_metatag_post_update_event_organizer(): string {
  // The values with the site as the organizer, or NULL when they keep theirs.
  $count = _canvas_metatag_post_update_templates(static function (mixed $values): ?array {
    $props = is_array($values) && ($values['schema']['type'] ?? NULL) === 'Event' ? $values['schema']['props'] ?? [] : NULL;
    if (!is_array($props) || array_intersect_key($props, array_flip(['organizer', 'organizer_name', 'organizer_url']))) {
      return NULL;
    }
    $values['schema']['props'] = $props + ['organizer' => ['fact' => 'identity']];
    return $values;
  });
  return (string) \Drupal::translation()->formatPlural($count, 'One event template names the site as its organizer.', '@count event templates name the site as their organizer.');
}

/**
 * Stores an event venue's country as its code.
 *
 * The country was free text; it is now a code from a list, and anything else
 * is left out of the head. A country written as its code or its name, in
 * English or the site's language and in any case, becomes the code: on
 * templates and their drafts, every page revision and translation, and page
 * drafts. Anything else stays as written, and the dialog asks for the
 * country.
 */
function canvas_metatag_post_update_country_codes(): string {
  $key = 'location_address_addressCountry';
  $codes = [];
  foreach (\Drupal::service('country_manager')->getStandardList() as $code => $name) {
    foreach ([$code, $name->getUntranslatedString(), (string) $name] as $written) {
      $codes[mb_strtolower($written)] = $code;
    }
  }
  // The values with the country as its code, or NULL when nothing changes.
  $coded = static function (mixed $values) use ($key, $codes): ?array {
    $text = is_array($values) ? $values['schema']['props'][$key]['text'] ?? NULL : NULL;
    $code = is_string($text) ? $codes[mb_strtolower(trim($text))] ?? NULL : NULL;
    if ($code === NULL || $code === $text) {
      return NULL;
    }
    $values['schema']['props'][$key] = ['text' => $code];
    return $values;
  };
  $count = _canvas_metatag_post_update_templates($coded);

  $count += _canvas_metatag_post_update_pages($key, static fn (mixed $values): ?array => $coded($values));
  return (string) \Drupal::translation()->formatPlural($count, 'One venue country is stored as its code.', '@count venue countries are stored as their codes.');
}

/**
 * Changes the values of every page revision, translation and draft.
 *
 * Page drafts in step with their stored page stay so (as when values became
 * parts): their keys are read before the rows are rewritten.
 *
 * @param string $like
 *   Text the stored values hold when they may change.
 * @param callable(mixed, string): ?array $change
 *   Stored values and where they are ("page 3 (en)", "page 3 (en) draft")
 *   => the changed values, or NULL when they stay.
 *
 * @return int
 *   How many rows and drafts changed.
 */
function _canvas_metatag_post_update_pages(string $like, callable $change): int {
  $count = 0;
  $auto_save = \Drupal::service(AutoSaveManager::class);
  $in_step = [];
  foreach ($auto_save->getAllAutoSaveList(FALSE, TRUE) as $entry_key => $entry) {
    if ($entry['entity_type'] === 'canvas_page' && !isset($entry[AutoSaveManager::AUTO_SAVE_CONFLICT_KEY])) {
      $in_step[] = $entry_key;
    }
  }
  $pages = \Drupal::entityTypeManager()->getStorage('canvas_page');
  assert($pages instanceof SqlContentEntityStorage);
  $definition = \Drupal::service('entity_field.manager')->getFieldStorageDefinitions('canvas_page')['canvas_metatag'] ?? NULL;
  $column = $definition ? $pages->getTableMapping()->getFieldColumnName($definition, 'value') : NULL;
  $database = \Drupal::database();
  $rows = $column ? $database->select($pages->getRevisionDataTable(), 'r')
    ->fields('r', ['id', 'revision_id', 'langcode', $column])
    ->condition($column, '%' . $database->escapeLike($like) . '%', 'LIKE')
    ->execute() : [];
  foreach ($rows as $row) {
    $new = $change(Values::decode($row->{$column}), "page $row->id ($row->langcode)");
    if ($new !== NULL) {
      foreach ([$pages->getRevisionDataTable(), $pages->getDataTable()] as $table) {
        $database->update($table)
          ->fields([$column => Values::encode($new)])
          ->condition('revision_id', $row->revision_id)
          ->condition('langcode', $row->langcode)
          ->execute();
      }
      $count++;
    }
  }
  $pages->resetCache();
  foreach ($auto_save->getAllAutoSaveList(FALSE, TRUE) as $entry_key => $entry) {
    $page = $entry['entity_type'] === 'canvas_page' ? $pages->load($entry['entity_id']) : NULL;
    $langcode = (string) $entry['langcode'];
    $page = $page instanceof ContentEntityInterface && $page->hasTranslation($langcode) ? $page->getTranslation($langcode) : NULL;
    if ($page === NULL) {
      continue;
    }
    if (in_array($entry_key, $in_step, TRUE) && isset($entry[AutoSaveManager::AUTO_SAVE_CONFLICT_KEY])) {
      $auto_save->resolveConflict($page, $entry[AutoSaveManager::AUTO_SAVE_CONFLICT_KEY]);
    }
    $draft = $auto_save->getAutoSaveEntity($page, TRUE);
    $new = $draft->entity instanceof ContentEntityInterface ? $change(Values::decode($draft->entity->get('canvas_metatag')->value), "page {$page->id()} ($langcode) draft") : NULL;
    if ($new !== NULL) {
      $draft->entity->set('canvas_metatag', Values::encode($new));
      _canvas_metatag_post_update_draft($draft->entity, $draft->clientId);
      $count++;
    }
  }
  Cache::invalidateTags(['canvas_page_list', 'rendered']);
  return $count;
}

/**
 * Stores hand-added JSON-LD as written, and renames the module's ids in it.
 *
 * Hand-added JSON-LD was stored re-encoded with sorted keys; it is now
 * stored as written. Each stored text is written out once with two spaces,
 * in its stored key order (a text over 64 KB is listed and left as it is).
 * A top-level @id that is now the module's, or another item's, is renamed
 * "‹id›-2" with the references that reached it, and an item that was left
 * out stays out (Values::renameReserved()): no page's output changes. A
 * whole value "{field.…}" that starts to be filled is listed.
 */
function canvas_metatag_post_update_own_jsonld_as_written(): string {
  $listed = [];
  $change = _canvas_metatag_post_update_jsonld($listed);
  $count = _canvas_metatag_post_update_templates($change);
  $count += _canvas_metatag_post_update_pages('"custom"', $change);
  $message = (string) \Drupal::translation()->formatPlural($count, 'Hand-added JSON-LD is stored as written in one place.', 'Hand-added JSON-LD is stored as written in @count places.');
  return implode("\n", [$message, ...array_values(array_unique($listed))]);
}

/**
 * Renames hand-added "#breadcrumb" items: the breadcrumb trail now has it.
 *
 * Each keeps its output as "#breadcrumb-2", with the references that reached
 * it (Values::renameReserved()), as read mode already does. Text with
 * nothing to rename stays exactly as written.
 */
function canvas_metatag_post_update_reserve_breadcrumb(): string {
  $listed = [];
  $change = _canvas_metatag_post_update_jsonld($listed, TRUE);
  $count = _canvas_metatag_post_update_templates($change);
  // Every page with hand-added JSON-LD: the id may be written with escapes
  // ("#\u0062readcrumb"), and the decoded text decides.
  $count += _canvas_metatag_post_update_pages('"custom"', $change);
  $message = (string) \Drupal::translation()->formatPlural($count, 'Hand-added JSON-LD changed in one place.', 'Hand-added JSON-LD changed in @count places.');
  return implode("\n", [$message, ...array_values(array_unique($listed))]);
}

/**
 * What changes stored hand-added JSON-LD: written out, with ids renamed.
 *
 * @param list<string> $listed
 *   Collects what changed, and what was left as it is, for the update's
 *   message.
 * @param bool $renames_only
 *   Change only text that has an id to rename; other text, however it is
 *   written, stays as it is and is not listed.
 *
 * @return callable(mixed, string): ?array
 *   Stored values and where they are => the changed values, or NULL.
 */
function _canvas_metatag_post_update_jsonld(array &$listed, bool $renames_only = FALSE): callable {
  return static function (mixed $values, string $where) use (&$listed, $renames_only): ?array {
    $text = is_array($values) ? $values['schema']['custom'] ?? NULL : NULL;
    if (!is_string($text) || trim($text) === '') {
      return NULL;
    }
    if (strlen($text) > Values::CUSTOM_RAW_MAX) {
      // Read mode refuses it: it has no output to keep.
      if (!$renames_only) {
        $listed[] = "$where: over 64 KB as written, left as it is";
      }
      return NULL;
    }
    $data = json_decode($text, FALSE, 64);
    if (!is_array($data) && !$data instanceof \stdClass) {
      return NULL;
    }
    [$data, $renames] = Values::renameReserved($data);
    if ($renames_only && !$renames) {
      return NULL;
    }
    foreach ($renames as $rename) {
      $listed[] = "$where: {$rename['from']} is now {$rename['to']}" . ($rename['skip'] ? ', left out as before' : '');
      if ($rename['skip']) {
        $values['schema']['skip'][] = $rename['to'];
      }
    }
    try {
      // Minified when indenting would take it over 64 KB: read mode would
      // refuse it, and the page would lose its hand-added JSON-LD.
      $pretty = Values::written($data);
    }
    catch (\JsonException) {
      // A number stored before validation (1e400): read mode leaves out
      // the item it is in, as before.
      $listed[] = "$where: has a value that can't be written out, left as it is";
      return NULL;
    }
    if ($pretty === $text && !$renames) {
      return NULL;
    }
    $strings = $renames_only ? [] : json_decode($pretty, TRUE);
    array_walk_recursive($strings, static function (mixed $value) use (&$listed, $where): void {
      if (is_string($value) && preg_match('/^\{field\.[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?\}$/D', $value)) {
        $listed[] = "$where: $value is now filled from its field";
      }
    });
    $values['schema']['custom'] = $pretty;
    return $values;
  };
}

/**
 * Changes the values of every node template and of its draft.
 *
 * Saving a template deletes its draft: the draft is read first and written
 * back after, under its own client id.
 *
 * @param callable(mixed, string): ?array $change
 *   Stored values and where they are ("template node.article.full") => the
 *   changed values, or NULL when they stay.
 *
 * @return int
 *   How many templates and drafts changed.
 */
function _canvas_metatag_post_update_templates(callable $change): int {
  $auto_save = \Drupal::service(AutoSaveManager::class);
  $count = 0;
  $templates = \Drupal::entityTypeManager()->getStorage(ContentTemplate::ENTITY_TYPE_ID);
  assert($templates instanceof ConfigEntityStorageInterface);
  foreach ($templates->loadMultipleOverrideFree() as $template) {
    assert($template instanceof ContentTemplate);
    $draft = $auto_save->getAutoSaveEntity($template, TRUE);
    $entity = $draft->entity instanceof ContentTemplate ? $draft->entity : NULL;
    $kept = \Drupal::keyValue(AutoSaveManager::AUTO_SAVE_STORE)->get(AutoSaveManager::getAutoSaveKey($template));
    $stored = $change($template->getThirdPartySetting('canvas_metatag', 'values'), "template {$template->id()}");
    $drafted = $entity ? $change($entity->getThirdPartySetting('canvas_metatag', 'values'), "template {$template->id()} draft") : NULL;
    if ($stored !== NULL) {
      $template->setThirdPartySetting('canvas_metatag', 'values', $stored)->save();
      $count++;
    }
    if ($entity && ($stored !== NULL || $drafted !== NULL)) {
      if ($drafted !== NULL) {
        $entity->setThirdPartySetting('canvas_metatag', 'values', $drafted);
        $count++;
      }
      _canvas_metatag_post_update_draft($entity, $draft->clientId, is_array($kept) ? $kept : NULL);
    }
  }
  return $count;
}

/**
 * Indexes the texts Canvas pages offer as their description.
 *
 * A Canvas page without a description is described by its own text, unless
 * another published page offers the same text (PageText). Pages saved before
 * are indexed here; saves keep the index from now on.
 */
function canvas_metatag_post_update_page_text(array &$sandbox): string {
  $sandbox['next'] = \Drupal::service(PageText::class)->indexFrom($sandbox['next'] ?? 0);
  $sandbox['#finished'] = $sandbox['next'] === NULL ? 1 : 0.5;
  if ($sandbox['next'] === NULL) {
    Cache::invalidateTags(['rendered']);
  }
  return (string) t('Indexed the text of Canvas pages for their descriptions.');
}

/**
 * Keeps an upgraded site sharing its site image on pages without one.
 *
 * Pages without an image now share a card made from their title, unless the
 * site chose otherwise. A site with a default image keeps sharing it ("Use
 * this image"); a site without one gets the card.
 */
function canvas_metatag_post_update_share_fallback(): string {
  $config = \Drupal::configFactory()->getEditable('canvas_metatag.site');
  // Only an image visitors can still see: a stale one (deleted, unpublished,
  // not public) would leave pages sharing nothing.
  $uuid = (string) $config->get('identity.default_image');
  $image = $uuid !== '' && \Drupal::service(Resolver::class)->image($uuid, new CacheableMetadata()) !== NULL;
  $config
    ->set('identity.share_fallback', $image ? 'image' : 'card')
    ->set('identity.colour', (string) ($config->get('identity.colour') ?? ''))
    ->save();
  Cache::invalidateTags(['rendered']);
  return $image
    ? (string) t('Pages without an image keep sharing the site image.')
    : (string) t('Pages without an image now share a card made from their title.');
}
