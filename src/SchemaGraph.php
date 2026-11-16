<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

/**
 * The JSON-LD type registry, literal validation and @graph assembly.
 *
 * Static and pure. data/schema-types.json is the only description of a type.
 */
final class SchemaGraph {

  private const DATE = '/^(\d{4})-(\d{2})-(\d{2})(T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(Z|[+-]\d{2}:\d{2})?)?$/D';

  /**
   * The registry with `extends` resolved.
   *
   * @return array<string, array>
   *   Type id => entry.
   */
  public static function types(): array {
    static $types;
    if ($types === NULL) {
      $types = json_decode((string) file_get_contents(dirname(__DIR__) . '/data/schema-types.json'), TRUE, 16, JSON_THROW_ON_ERROR);
      foreach ($types as $id => $type) {
        if (isset($type['extends'])) {
          unset($type['extends']);
          $types[$id] = $type + $types[$types[$id]['extends']];
        }
      }
    }
    return $types;
  }

  /**
   * Whether a literal passes the property's `kind`, `options` and `pattern`.
   *
   * The only implementation of that rule: the cleaner, the graph builder and
   * the AI submodule call it.
   */
  public static function validLiteral(string $type, string $key, string $value): bool {
    $prop = array_column(self::types()[$type]['props'] ?? [], NULL, 'key')[$key] ?? NULL;
    if ($prop === NULL) {
      return FALSE;
    }
    $valid = match ($prop['kind']) {
      'text' => TRUE,
      'url' => Values::isHttpUrl($value),
      'date' => preg_match(self::DATE, $value, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]),
      'number' => (bool) preg_match('/^\d+(\.\d+)?$/D', $value),
      'enum' => in_array($value, $prop['options'] ?? [], TRUE),
      // An image is a media item, a fact or a link, never text.
      default => FALSE,
    };
    return $valid && (!isset($prop['pattern']) || preg_match('~' . $prop['pattern'] . '~uD', $value));
  }

  /**
   * Assembles the @graph of one page.
   *
   * @param array $ctx
   *   The keys home, url, langcode, title, description, published, modified,
   *   timezone, identity{kind, name, same_as[]}, logo?{url, width, height}
   *   image?{url, width, height, alt} and facts (name => text, the fixed
   *   names custom JSON-LD strings may use). `url` is the entity's own public
   *   URL, never a canonical override.
   * @param array $schema
   *   The effective `schema` value, cleaned.
   * @param callable(array, string): (string|array|null) $value
   *   What a value gives for this entity, by kind: text, or for the image
   *   kind an image array; '' or NULL for nothing.
   *
   * @return array{graph: array{'@context': string, '@graph': list<array>}, withheld: bool, missing_required: list<string>, missing_recommended: list<string>}
   *   The graph and the report the Checks tab reads.
   */
  public static function build(array $ctx, array $schema, callable $value): array {
    $types = self::types();
    $type_id = isset($types[$schema['type'] ?? '']) ? $schema['type'] : 'WebPage';
    $type = $types[$type_id];
    // Identity: these never change after the first release.
    $ids = [
      'identity' => $ctx['home'] . '#identity',
      'logo' => $ctx['home'] . '#logo',
      'website' => $ctx['home'] . '#website',
      'webpage' => $ctx['url'] . '#webpage',
      'primaryimage' => $ctx['url'] . '#primaryimage',
      'primary' => $ctx['url'] . '#primary',
    ];
    $ref = static fn (string $name): array => ['@id' => $ids[$name]];
    $logo = $ctx['logo'] ?? NULL;
    $page_image = $ctx['image'] ?? NULL;

    // The primary node first: the page node points at it only when it ships.
    $missing = ['required' => [], 'recommended' => []];
    $primary = NULL;
    if (isset($type['primary_type'])) {
      $primary = ['@type' => $type['primary_type'], '@id' => $ids['primary'], 'mainEntityOfPage' => $ref('webpage')];
      foreach ($type['refs'] ?? [] as $property => $target) {
        $primary[$property] = $ref($target);
      }
      foreach ($type['props'] ?? [] as $prop) {
        $stored = $schema['props'][$prop['key']] ?? NULL;
        $default = $prop['default'] ?? NULL;
        // The Description fact is the page's own description, as search shows
        // it, not the raw text it may have been cut from. A link that gives
        // nothing gives the default; one that gives a value that does not
        // fit leaves the detail out.
        $resolve = static fn (?array $v): string|array|null => $v === NULL ? NULL : (
          $v === ['fact' => 'description'] ? (string) ($ctx['description'] ?? '') : $value($v, Values::KINDS[$prop['kind']])
        );
        $raw = $resolve($stored);
        if ($raw === NULL || $raw === '') {
          $raw = $resolve($default);
        }
        $found = self::value($type_id, $prop, $raw, $ctx);
        if ($found === NULL) {
          if (isset($prop['level'])) {
            $missing[$prop['level']][] = $prop['key'];
          }
          continue;
        }
        // "location_address_streetAddress" is the path location > address >
        // streetAddress; schema.org names contain no underscore.
        $path = explode('_', $prop['key']);
        $leaf = array_pop($path);
        $at = &$primary;
        $prefix = '';
        foreach ($path as $segment) {
          $prefix = ltrim("{$prefix}_$segment", '_');
          $at[$segment] ??= ['@type' => $type['nested'][$prefix] ?? 'Thing'];
          $at = &$at[$segment];
        }
        $at[$leaf] = $found;
        unset($at);
      }
    }
    $withheld = $primary !== NULL && $missing['required'] !== [];
    if ($withheld) {
      $primary = NULL;
    }

    $person = ($ctx['identity']['kind'] ?? '') === 'person';
    $graph = [
      self::node([
        '@type' => $person ? 'Person' : 'Organization',
        '@id' => $ids['identity'],
        'name' => $ctx['identity']['name'] ?? '',
        'url' => $ctx['home'],
        ($person ? 'image' : 'logo') => $logo ? $ref('logo') : NULL,
        'sameAs' => array_values($ctx['identity']['same_as'] ?? []),
      ]),
      $logo ? self::imageNode($ids['logo'], $logo) : NULL,
      self::node([
        '@type' => 'WebSite',
        '@id' => $ids['website'],
        'url' => $ctx['home'],
        'name' => $ctx['identity']['name'] ?? '',
        'inLanguage' => $ctx['langcode'] ?? '',
        'publisher' => $ref('identity'),
      ]),
      self::node([
        '@type' => $type['page_type'] ?? 'WebPage',
        '@id' => $ids['webpage'],
        'url' => $ctx['url'],
        'name' => $ctx['title'] ?? '',
        'description' => $ctx['description'] ?? '',
        'inLanguage' => $ctx['langcode'] ?? '',
        'isPartOf' => $ref('website'),
        'datePublished' => $ctx['published'] ?? '',
        'dateModified' => $ctx['modified'] ?? '',
        'primaryImageOfPage' => $page_image ? $ref('primaryimage') : NULL,
        'mainEntity' => $primary ? $ref('primary') : NULL,
      ]),
      $page_image ? self::imageNode($ids['primaryimage'], $page_image) + self::node(['caption' => $page_image['alt'] ?? '']) : NULL,
      $primary,
    ];
    $graph = array_values(array_filter($graph));

    // Custom nodes can point at our nodes and can never replace or extend
    // them. ponytail: decoded as arrays, so an empty object or one with only
    // numeric keys is emitted as a list; the stored text keeps them apart.
    $custom = json_decode($schema['custom'] ?? '', TRUE);
    $present = array_fill_keys(array_column($graph, '@id'), TRUE);
    $ours = $taken = array_fill_keys($ids, TRUE);
    foreach (is_array($custom) ? (array_is_list($custom) ? $custom : [$custom]) : [] as $node) {
      if (!is_array($node) || !is_string($node['@type'] ?? NULL)) {
        continue;
      }
      $node = self::custom($node, TRUE, $ctx['url'], $ours, $present, $ctx['facts'] ?? []);
      if (isset($node['@id'])) {
        if (isset($taken[$node['@id']])) {
          continue;
        }
        $taken[$node['@id']] = TRUE;
      }
      $graph[] = $node;
    }

    return [
      'graph' => ['@context' => 'https://schema.org', '@graph' => $graph],
      'withheld' => $withheld,
      'missing_required' => $missing['required'],
      'missing_recommended' => $missing['recommended'],
    ];
  }

  /**
   * Resolves one property; NULL when it is empty or not valid for its kind.
   */
  private static function value(string $type, array $prop, string|array|null $resolved, array $ctx): string|array|null {
    if ($prop['kind'] === 'image') {
      // A dimension that was never measured (0) is left out, not claimed.
      return is_array($resolved) ? self::node([
        '@type' => 'ImageObject',
        'url' => $resolved['url'],
        'width' => $resolved['width'] ?: NULL,
        'height' => $resolved['height'] ?: NULL,
      ]) : NULL;
    }
    $value = Values::plain(is_string($resolved) ? $resolved : '', 2000);
    if ($value === '' || !self::validLiteral($type, $prop['key'], $value)) {
      return NULL;
    }
    return match ($prop['kind']) {
      'enum' => 'https://schema.org/' . $value,
      // A time without an offset is in the site's default timezone.
      'date' => preg_match(self::DATE, $value, $m) && ($m[4] ?? '') !== '' && ($m[5] ?? '') === ''
        ? $value . (new \DateTimeImmutable($value, new \DateTimeZone($ctx['timezone'] ?? 'UTC')))->format('P')
        : $value,
      default => $value,
    };
  }

  /**
   * Prepares a custom node, or a value inside one.
   *
   * @param mixed $value
   *   The decoded value.
   * @param bool $top
   *   Whether this is a top-level node.
   * @param string $url
   *   The entity's own public URL, the base of "#local" ids.
   * @param array<string, true> $ours
   *   The ids of our own nodes.
   * @param array<string, true> $present
   *   The ids of our nodes that are in this graph.
   * @param array<string, string> $facts
   *   The fixed names and their values (Values::fillFacts()).
   *
   * @return mixed
   *   The value to emit; NULL for a reference to a node of ours that is not
   *   in this graph, which the caller leaves out.
   */
  private static function custom(mixed $value, bool $top, string $url, array $ours, array $present, array $facts): mixed {
    if (is_string($value)) {
      return Values::fillFacts($value, $facts);
    }
    if (!is_array($value)) {
      return $value;
    }
    if (isset($value['@id']) && is_string($value['@id']) && str_starts_with($value['@id'], '#')) {
      $value['@id'] = $url . $value['@id'];
    }
    if (!$top && isset($value['@id'], $ours[$value['@id']])) {
      return isset($present[$value['@id']]) ? ['@id' => $value['@id']] : NULL;
    }
    $result = [];
    foreach ($value as $key => $item) {
      $item = str_starts_with((string) $key, '@') ? $item : self::custom($item, FALSE, $url, $ours, $present, $facts);
      if ($item !== NULL) {
        $result[$key] = $item;
      }
    }
    return array_is_list($value) ? array_values($result) : $result;
  }

  /**
   * An ImageObject node with an @id.
   */
  private static function imageNode(string $id, array $image): array {
    return self::node([
      '@type' => 'ImageObject',
      '@id' => $id,
      'url' => $image['url'],
      'contentUrl' => $image['url'],
      'width' => $image['width'] ?: NULL,
      'height' => $image['height'] ?: NULL,
    ]);
  }

  /**
   * Drops the members that have no value.
   */
  private static function node(array $members): array {
    return array_filter($members, static fn (mixed $value): bool => $value !== NULL && $value !== '' && $value !== []);
  }

}
