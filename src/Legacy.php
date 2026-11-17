<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Component\Uuid\Uuid;

/**
 * Converts values stored in the brace form into values.
 *
 * Pure. Used only by canvas_metatag_post_update_values_as_parts(); it holds
 * the only remaining copy of the brace pattern, and goes with that update
 * after 1.0.
 *
 * @internal
 */
final class Legacy {

  /**
   * The brace form: `{name}` or `{field.NAME}`.
   */
  private const BRACES = '/\{([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)?)\}/';

  /**
   * Converts the values of one page, template or the site.
   *
   * Titles split at the last `{sep}`: the part before is the main part, the
   * part after the ending. A whole name becomes its fact, a whole
   * `{field.NAME}` what $field makes of it, a media UUID a media item; a
   * value made of several parts keeps its first part. A value equal to its
   * default, and an ending equal to the one below, are not kept. Values
   * already converted are left as they are.
   *
   * @param array $old
   *   The stored values.
   * @param string $scope
   *   One of 'page', 'template', 'site'.
   * @param callable(string, string): ?array $field
   *   The value a whole field gives as a value of a kind (text, address,
   *   date, number, image), or NULL when it cannot be linked.
   * @param array|null $below
   *   The converted ending of the layer below: the site's for a page or a
   *   template. NULL: the site name.
   *
   * @return array{0: array, 1: list<string>}
   *   The values, cleaned in read mode, and one log line per loss, naming
   *   the key and what was dropped, never a value of the content.
   */
  public static function convert(array $old, string $scope, callable $field, ?array $below = NULL): array {
    $log = [];
    $new = $old;
    // $default: what the place gives with nothing set; a first part equal to
    // it is not kept either.
    $piece = static function (mixed $value, string $kind, string $path, ?array $default = NULL) use ($field, &$log): ?array {
      if (!is_string($value)) {
        return is_array($value) ? $value : NULL;
      }
      [$converted, $dropped, $kept] = self::piece($value, $kind, $field);
      if ($dropped) {
        $what = !$kept ? 'removed' : ($converted === $default ? 'uses its default' : 'kept its first part');
        $log[] = sprintf('%s: %s; dropped %s.', $path, $what, implode(', ', $dropped));
      }
      return $converted;
    };

    if (is_string($old['title'] ?? NULL)) {
      unset($new['title']);
      $title = $old['title'];
      $at = strrpos($title, '{sep}');
      // The spaces around the separator were part of the pattern.
      $main = $piece($at === FALSE ? $title : rtrim(substr($title, 0, $at)), 'text', 'title');
      if ($main !== NULL && $main !== ['fact' => 'title']) {
        if ($scope === 'site') {
          $log[] = 'title: the site sets only the ending now; dropped the main part.';
        }
        else {
          $new['title'] = $main;
        }
      }
      $end = $at === FALSE ? NULL : $piece(ltrim(substr($title, $at + 5)), 'text', 'title_end');
      $end = $end ?? ['text' => ''];
      if ($end !== ($below ?? ['fact' => 'site'])) {
        $new['title_end'] = $end;
      }
    }
    foreach ([
      'description' => 'text',
      'social.title' => 'text',
      'social.description' => 'text',
      'social.image' => 'image',
    ] as $path => $kind) {
      [$group, $key] = array_pad(explode('.', $path), 2, NULL);
      $value = $key === NULL ? $old[$group] ?? NULL : $old[$group][$key] ?? NULL;
      if (!is_string($value)) {
        continue;
      }
      $default = [
        'description' => ['fact' => 'description'],
        'social.title' => ['fact' => 'title'],
        'social.image' => ['fact' => 'image'],
        // A page's description is its Description fact, which the social
        // description follows.
        'social.description' => $scope === 'page' ? ['fact' => 'description'] : NULL,
      ][$path];
      $value = $piece($value, $kind, $path, $default);
      $value = $value === $default ? NULL : $value;
      if ($key === NULL) {
        $new[$group] = $value;
      }
      else {
        $new[$group][$key] = $value;
      }
    }
    foreach (is_array($old['schema']['props'] ?? NULL) ? $old['schema']['props'] : [] as $key => $value) {
      $prop = self::prop((string) $key, $old['schema']['type'] ?? 'WebPage');
      $value = $prop === NULL ? NULL : $piece($value, Values::KINDS[$prop['kind']], "schema.props.$key", $prop['default'] ?? NULL);
      $new['schema']['props'][$key] = $value === ($prop['default'] ?? NULL) ? NULL : $value;
    }
    if (is_string($old['schema']['custom'] ?? NULL) && str_contains($old['schema']['custom'], '{field.')) {
      $log[] = 'schema.custom: names a field. A whole value is filled from its field; a name inside other text stays as written.';
    }

    // What the scope may not hold goes, and is said.
    $type = $old['schema']['type'] ?? 'WebPage';
    [$clean] = Values::clean($new, $scope, NULL, $type);
    // A page's details of another type stay, cleaned as that type cleans
    // them: a translation inherits its type from the default one, and a page
    // draft keeps the published type's details (ApiController::putPage()).
    // Reading cleans them again under the type that applies.
    $own = array_column(SchemaGraph::types()[$type]['props'] ?? [], 'key', 'key');
    foreach ($scope === 'page' ? $new['schema']['props'] ?? [] : [] as $key => $value) {
      $holder = $value === NULL || isset($own[$key]) ? NULL : self::holder((string) $key);
      $kept = $holder === NULL ? NULL : Values::clean(['schema' => ['props' => [$key => $value]]], 'page', NULL, $holder)[0]['schema']['props'][$key] ?? NULL;
      if ($kept !== NULL) {
        $clean['schema']['props'][$key] = $kept;
        // In canonical key order, as Values::clean() gives it.
        ksort($clean['schema']['props'], SORT_STRING);
        ksort($clean['schema'], SORT_STRING);
        ksort($clean, SORT_STRING);
      }
    }
    foreach (self::leaves($new) as $path => $value) {
      if ($value !== NULL && !self::has($clean, $path)) {
        $log[] = "$path: not available here; dropped.";
      }
    }
    return [$clean, $log];
  }

  /**
   * Converts one stored text.
   *
   * @return array{0: ?array, 1: list<string>, 2: bool}
   *   The value, what was dropped, and whether a first part was kept.
   */
  private static function piece(string $text, string $kind, callable $field): array {
    if ($kind === 'image' && Uuid::isValid($text)) {
      return [['media' => $text], [], FALSE];
    }
    // Typed text without a name is kept exactly as typed.
    if (!preg_match(self::BRACES, $text)) {
      return [$kind === 'image' || trim($text) === '' ? NULL : ['text' => $text], [], FALSE];
    }
    $parts = [];
    foreach (preg_split(self::BRACES, $text, -1, PREG_SPLIT_DELIM_CAPTURE) as $index => $part) {
      // Odd parts are names.
      if ($index % 2 === 1) {
        $parts[] = ['name' => $part];
      }
      elseif (trim($part) !== '') {
        $parts[] = ['text' => trim($part)];
      }
    }
    $first = array_shift($parts);
    $value = NULL;
    $dropped = array_map(self::describe(...), $parts);
    if (isset($first['text'])) {
      $value = $kind === 'image' ? NULL : ['text' => $first['text']];
    }
    elseif (str_starts_with($first['name'], 'field.')) {
      $value = $field(substr($first['name'], 6), $kind);
    }
    elseif ((Values::FACTS[$first['name']] ?? NULL) === $kind) {
      $value = ['fact' => $first['name']];
    }
    if ($value === NULL) {
      array_unshift($dropped, self::describe($first));
    }
    return [$value, $dropped, $value !== NULL && $parts !== []];
  }

  /**
   * A dropped part in a log line: a name as written, typed text as such.
   */
  private static function describe(array $part): string {
    return isset($part['name']) ? '{' . $part['name'] . '}' : 'typed text';
  }

  /**
   * The registry entry of a property, in its type or else in any type.
   */
  private static function prop(string $key, string $type): ?array {
    $types = SchemaGraph::types();
    foreach ([$types[$type] ?? [], ...array_values($types)] as $entry) {
      foreach ($entry['props'] ?? [] as $prop) {
        if ($prop['key'] === $key) {
          return $prop;
        }
      }
    }
    return NULL;
  }

  /**
   * The first type that has a property.
   */
  private static function holder(string $key): ?string {
    foreach (SchemaGraph::types() as $type => $entry) {
      if (in_array($key, array_column($entry['props'] ?? [], 'key'), TRUE)) {
        return (string) $type;
      }
    }
    return NULL;
  }

  /**
   * The values as dotted path => value, down to each value map.
   */
  private static function leaves(array $values, string $prefix = ''): array {
    $leaves = [];
    foreach ($values as $key => $value) {
      $path = $prefix . $key;
      if (is_array($value) && !self::isValue($value) && !in_array($key, ['robots'], TRUE)) {
        $leaves += self::leaves($value, "$path.");
      }
      else {
        $leaves[$path] = $value;
      }
    }
    return $leaves;
  }

  /**
   * Whether an array is one value map.
   */
  private static function isValue(array $value): bool {
    return count($value) === 1 && in_array(array_key_first($value), ['text', 'fact', 'media', 'source'], TRUE);
  }

  /**
   * Whether the values hold something at a dotted path.
   */
  private static function has(array $values, string $path): bool {
    foreach (explode('.', $path) as $key) {
      if (!is_array($values) || !array_key_exists($key, $values)) {
        return FALSE;
      }
      $values = $values[$key];
    }
    return TRUE;
  }

}
