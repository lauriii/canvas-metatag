<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

/**
 * The JSON-LD type registry, literal validation, @graph assembly and verdicts.
 *
 * Static and pure. data/schema-types.json is the only description of a type,
 * data/search-features.json the only description of a search feature.
 */
final class SchemaGraph {

  private const DATE = '/^(\d{4})-(\d{2})-(\d{2})(T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(Z|[+-]\d{2}:\d{2})?)?$/D';

  /**
   * Every id the module emits, by name, with the address it is anchored on.
   *
   * `home` ids are the site's own items, reached from any page by their short
   * id ("#identity"); `url` ids are the page's. A hand-added item never takes
   * one (Values), and the module's component parts are "#c-…" on the page.
   */
  public const MODULE_IDS = [
    'identity' => 'home',
    'logo' => 'home',
    'website' => 'home',
    'return-policy' => 'home',
    'webpage' => 'url',
    'primaryimage' => 'url',
    'primary' => 'url',
    'group' => 'url',
    'breadcrumb' => 'url',
  ];

  /**
   * Ids of MODULE_IDS that hand-added items could take before the module.
   *
   * A hand-added item stored with one was output then: read mode and its
   * post-update rename it and keep its output (Values::renameReserved()).
   */
  public const LATER_IDS = ['breadcrumb'];

  /**
   * The prefix of the ids of the page's component parts.
   */
  public const COMPONENT_PREFIX = 'c-';

  /**
   * The node each added-details key adds to, by scope.
   */
  public const EXTEND = [
    'page' => ['#primary', '#webpage'],
    'template' => ['#primary', '#webpage'],
    'site' => ['#identity'],
  ];

  /**
   * The largest structured data the head carries, in bytes.
   */
  public const OUTPUT_MAX = 262144;

  /**
   * The longest text a whole-value field link fills, in characters.
   */
  public const FILL_MAX = 5000;

  /**
   * What a billing period is emitted as: its UN/CEFACT unit code.
   */
  private const BILLING = ['P1M' => 'MON', 'P1Y' => 'ANN'];

  /**
   * Where a job's work is, by the answer to "Where the work is".
   *
   * Remote work, also when it may be on site, is TELECOMMUTE; on site says
   * nothing more than the workplace does.
   */
  private const WORK = ['remote' => 'TELECOMMUTE', 'both' => 'TELECOMMUTE'];

  /**
   * The verdicts, in the order the dialog lists them.
   */
  private const ORDER = [
    'needs',
    'unanswered',
    'ready',
    'complete',
    'not_fit',
    'closed',
    'elsewhere',
    'not_here',
    'retired',
    'none',
  ];

  /**
   * Types a hand-added node may copy the site's identity's name with.
   *
   * By address any organization copies it, whatever its type: a restaurant
   * or a hotel with the site's address is the site (notOrganization()).
   */
  private const WHO = ['Organization', 'Person', 'LocalBusiness', 'Corporation', 'OnlineStore', 'Store', 'NGO'];

  /**
   * The attributes a property may have, each read in one place.
   */
  public const ATTRIBUTES = [
    'key', 'label', 'kind', 'default', 'level', 'options', 'option_labels', 'pattern', 'ai', 'emit',
    'list', 'max', 'codes', 'unit', 'units', 'item', 'join', 'pair', 'html', 'link_only', 'per_item', 'inline',
    'scopes', 'accept', 'as', 'site', 'page_default', 'when', 'under', 'range', 'format', 'suggest',
    'meter', 'group', 'part', 'short', 'compose',
  ];

  /**
   * Why a type or a property is not offered on a scope.
   *
   * `component`: only a component mapping could fill it, and none exists
   * yet. `policy`: it is never offered there.
   */
  public const SCOPE_REASONS = ['component', 'policy'];

  /**
   * How an enum is emitted.
   *
   * As a schema.org URL, its bare code, or the node's type; FALSE is never
   * (a gate that decides what is emitted).
   */
  public const EMIT = ['url', 'code', 'type'];

  /**
   * Minutes per unit of a duration.
   */
  public const UNITS = ['minute' => 1, 'hour' => 60];

  /**
   * The days of the opening hours grammar, in order.
   */
  public const DAYS = [
    'Mo' => 'Monday',
    'Tu' => 'Tuesday',
    'We' => 'Wednesday',
    'Th' => 'Thursday',
    'Fr' => 'Friday',
    'Sa' => 'Saturday',
    'Su' => 'Sunday',
  ];

  /**
   * What the registry's kinds of place also are.
   *
   * A reference accepts a target of an accepted type or of a type that is
   * one: a restaurant is a local business, a place and an organization; a
   * venue that is not a business is a place only.
   */
  public const ANCESTORS = [
    'LocalBusiness' => ['Place', 'Organization'],
    'EventVenue' => ['Place'],
  ];

  /**
   * The elements and the attribute a job description keeps.
   */
  private const HTML_KEEP = ['p', 'ul', 'ol', 'li', 'br', 'strong', 'em', 'a'];

  /**
   * The length a job description is cut at.
   */
  private const HTML_MAX = 20000;

  /**
   * The longest duration, in minutes: 30 days.
   *
   * Typed or linked, the dialog and the cleaner refuse more (controls.ts
   * durationValue()).
   */
  public const DURATION_MAX = 43200;

  /**
   * The registry with `extends` resolved and groups expanded.
   *
   * A variant takes its base's details, never its kind. A group entry
   * (`group`, `use`) becomes its reference, when it has one, and one property
   * per part of its shape, keyed by path ("location_address_postalCode");
   * the type then lists it under `groups` and each nested node's type under
   * `nested`.
   *
   * @return array<string, array>
   *   Type id => entry.
   */
  public static function types(): array {
    static $types;
    if ($types === NULL) {
      $data = self::data('schema-types');
      $shapes = $data['$shapes'] ?? [];
      unset($data['$shapes']);
      $types = $data;
      foreach ($types as $id => $type) {
        if (isset($type['extends'])) {
          unset($type['extends']);
          $types[$id] = $type + array_diff_key($data[$data[$id]['extends']], ['kind' => TRUE, 'variants' => TRUE]);
        }
      }
      foreach ($types as $id => $type) {
        $props = [];
        $groups = [];
        $nested = $type['nested'] ?? [];
        foreach ($type['props'] ?? [] as $entry) {
          if (!isset($entry['group'])) {
            $props[] = $entry;
            continue;
          }
          $key = $entry['group'];
          if (isset($entry['ref'])) {
            $props[] = array_filter([
              'key' => $key,
              'label' => $entry['ref']['label'],
              'kind' => 'ref',
              'list' => $entry['list'] ?? NULL,
              'max' => isset($entry['list']) ? 20 : NULL,
              'accept' => $entry['ref']['accept'],
              'as' => $entry['type'] ?? $shapes[$entry['use']]['type'],
              'site' => $entry['ref']['site'] ?? NULL,
              'page_default' => $entry['ref']['page_default'] ?? NULL,
              'inline' => $entry['ref']['inline'] ?? NULL,
              'per_item' => $entry['ref']['per_item'] ?? NULL,
              'when' => $entry['when'] ?? NULL,
              'group' => $key,
              'ai' => FALSE,
            ], static fn (mixed $value): bool => $value !== NULL);
          }
          self::expand($shapes, $entry['use'], $key, $key, $entry, $props, $groups, $nested);
        }
        $types[$id]['props'] = $props;
        if ($groups) {
          $types[$id]['groups'] = $groups;
        }
        if ($nested) {
          $types[$id]['nested'] = $nested;
        }
      }
    }
    return $types;
  }

  /**
   * Expands one use of a shape into properties and groups.
   *
   * @param array $shapes
   *   The registry's shapes.
   * @param string $use
   *   The shape's name.
   * @param string $prefix
   *   The key of the group's node: "location_address".
   * @param string $top
   *   The key of the top group: "location".
   * @param array $entry
   *   The type's group entry: its label, level, defaults and scopes.
   * @param array $props
   *   Collects the properties.
   * @param array $groups
   *   Collects the groups by key.
   * @param array $nested
   *   Collects the type of each nested node by key.
   */
  private static function expand(array $shapes, string $use, string $prefix, string $top, array $entry, array &$props, array &$groups, array &$nested): void {
    $shape = $shapes[$use];
    $own = $prefix === $top;
    $nested[$prefix] = $own ? $entry['type'] ?? $shape['type'] : $shape['type'];
    foreach ($shape['nested'] ?? [] as $path => $nested_type) {
      $nested["{$prefix}_$path"] = $nested_type;
    }
    $parts = [];
    foreach ($shape['parts'] as $part) {
      if (isset($part['use'])) {
        self::expand($shapes, $part['use'], "{$prefix}_{$part['key']}", $top, $entry, $props, $groups, $nested);
        $parts[] = "{$prefix}_{$part['key']}";
        continue;
      }
      $relative = substr("{$prefix}_{$part['key']}", strlen($top) + 1);
      // A part's gate is a part of the same node; the group's gate is a
      // detail of the type, and holds for each of its parts.
      if (isset($part['when'])) {
        $part['when'] = array_combine(array_map(static fn (string $gate): string => "{$prefix}_$gate", array_keys($part['when'])), $part['when']);
      }
      if (isset($entry['when'])) {
        $part['when'] = $entry['when'] + ($part['when'] ?? []);
      }
      // A group's name is called by the group's label outside it ("Venue"),
      // and by its own inside ("Name").
      if ($own && $part['key'] === 'name' && isset($entry['label'])) {
        $part = ['label' => $entry['label'], 'short' => $part['label']] + $part;
      }
      $props[] = ['key' => "{$prefix}_{$part['key']}"] + $part + array_filter([
        'default' => $entry['defaults'][$relative] ?? NULL,
        'scopes' => $entry['scopes'] ?? NULL,
        'group' => $top,
        'part' => $own ? NULL : $prefix,
      ], static fn (mixed $value): bool => $value !== NULL);
      $parts[] = "{$prefix}_{$part['key']}";
    }
    $groups[$prefix] = array_filter([
      'label' => $own ? $entry['label'] : NULL,
      'type' => $nested[$prefix],
      'shape' => $use,
      'parts' => $parts,
      'requires' => array_map(static fn (array $one): array => array_map(static fn (string $key): string => "{$prefix}_$key", $one), $shape['requires']),
      'needs' => $shape['needs'] ?? NULL,
      'level' => $own ? $entry['level'] ?? NULL : NULL,
      'list' => $own ? $entry['list'] ?? NULL : NULL,
      'parent' => $own ? NULL : $top,
    ], static fn (mixed $value): bool => $value !== NULL);
  }

  /**
   * One property of a type, by key.
   */
  public static function prop(string $type, string $key): ?array {
    return array_column(self::types()[$type]['props'] ?? [], NULL, 'key')[$key] ?? NULL;
  }

  /**
   * Whether a type, or one of its properties, is offered on a scope.
   *
   * @param string $type
   *   The type id.
   * @param string|null $key
   *   A property key; NULL for the type itself.
   * @param string $scope
   *   One of 'page' or 'template'.
   */
  public static function offered(string $type, ?string $key, string $scope): bool {
    $entry = self::types()[$type] ?? NULL;
    if ($entry === NULL || isset($entry['scopes'][$scope])) {
      return FALSE;
    }
    if ($key === NULL) {
      return TRUE;
    }
    $prop = self::prop($type, $key);
    return $prop !== NULL && !isset($prop['scopes'][$scope]);
  }

  /**
   * A type and every type it is, by the registry's kinds of place.
   *
   * @return list<string>
   *   The type first.
   */
  public static function ancestors(string $type): array {
    $places = self::options(self::prop('LocalBusiness', 'placeKind') ?? []);
    $base = $type !== 'EventVenue' && in_array($type, $places, TRUE) ? 'LocalBusiness' : $type;
    return array_values(array_unique([$type, $base, ...self::ANCESTORS[$base] ?? []]));
  }

  /**
   * The search features rules file.
   *
   * @return array{reviewed: string, props: array<string, string>, site: array<string, string>, facts: array<string, array>, features: array<string, array>}
   *   As stored.
   */
  public static function searchFeatures(): array {
    static $rules = NULL;
    if ($rules === NULL) {
      $rules = self::data('search-features');
    }
    return $rules;
  }

  /**
   * The ISO 4217 codes a price may be in.
   *
   * @return array<string, true>
   *   Code => TRUE.
   */
  public static function currencies(): array {
    static $codes = NULL;
    if ($codes === NULL) {
      $codes = array_fill_keys(self::data('currencies'), TRUE);
    }
    return $codes;
  }

  /**
   * The codes of a code list, such as the ISO 3166-1 country codes.
   *
   * @return list<string>
   *   In order.
   */
  public static function codes(string $list): array {
    static $codes = [];
    return $codes[$list] ??= self::data("codes/$list");
  }

  /**
   * The choices of an enum: its options, or the codes of its list.
   *
   * @return list<string>
   *   In order.
   */
  public static function options(array $prop): array {
    return isset($prop['codes']) ? self::codes($prop['codes']) : $prop['options'] ?? [];
  }

  /**
   * Whether a literal passes the property's kind and attributes.
   *
   * The only implementation of that rule: the cleaner, the graph builder and
   * the AI submodule call it. On an enum list the literal is several codes
   * joined by commas; a duration is a whole number of its unit; opening
   * hours are a week in the hours grammar (hours()).
   */
  public static function validLiteral(string $type, string $key, string $value): bool {
    $prop = self::prop($type, $key);
    return $prop !== NULL && self::literal($prop, $value);
  }

  /**
   * ValidLiteral() for a property.
   */
  public static function literal(array $prop, string $value): bool {
    if (($prop['kind'] ?? '') === 'enum' && !empty($prop['list'])) {
      $codes = explode(',', $value);
      return count($codes) <= ($prop['max'] ?? 50) && count($codes) === count(array_unique($codes))
        && !array_diff($codes, self::options($prop));
    }
    $valid = match ($prop['kind']) {
      'text', 'ref' => TRUE,
      'url' => Values::isHttpUrl($value),
      'date' => preg_match(self::DATE, $value, $m) && checkdate((int) $m[2], (int) $m[3], (int) $m[1]),
      'number' => match (TRUE) {
        // A duration: a whole number of its unit, never zero.
        isset($prop['unit']) => preg_match('/^[1-9]\d{0,4}$/D', $value) && (int) $value * self::UNITS[$prop['unit']] <= self::DURATION_MAX,
        isset($prop['range']) => preg_match('/^-?\d+(\.\d+)?$/D', $value) && (float) $value >= $prop['range'][0] && (float) $value <= $prop['range'][1],
        default => (bool) preg_match('/^\d+(\.\d+)?$/D', $value),
      },
      'enum' => in_array($value, self::options($prop), TRUE),
      'currency' => isset(self::currencies()[$value]),
      'hours' => self::hours($value) !== NULL,
      // An image is a media item, a fact or a link, never text.
      default => FALSE,
    };
    return $valid && (!isset($prop['pattern']) || preg_match('~' . $prop['pattern'] . '~uD', $value));
  }

  /**
   * Whether a property can be typed: a literal, not a list of text.
   *
   * A text list comes from a field or a component; a linked-only property
   * from a field; a property each page has its own of (`per_item`: a
   * closing date, performers, a venue page) from a field on a template,
   * never one typed value for every page.
   *
   * @param array $prop
   *   The property.
   * @param string|null $scope
   *   'page' or 'template'; NULL for either.
   */
  public static function typable(array $prop, ?string $scope = NULL): bool {
    return empty($prop['link_only']) && !($prop['kind'] === 'text' && !empty($prop['list']))
      && !($scope === 'template' && !empty($prop['per_item']));
  }

  /**
   * Parses a week of opening hours.
   *
   * The grammar, shared with the dialog (tests/fixtures/hours.json): entries
   * joined by "; ", each either weekly days and times ("Mo-Fr 09:00-17:00",
   * "Sa 10:00-14:00,15:00-18:00") or a date and times or "closed"
   * ("2026-12-24 closed"). Open all day is 00:00-23:59. A day is in one
   * weekly entry at most, a date in one dated entry, and the times of a day
   * are in order and never overlap.
   *
   * @return array{weekly: array<string, list<array{0: string, 1: string}>>, dated: array<string, list<array{0: string, 1: string}>>}|null
   *   Times by day code and by date; an empty list is closed. NULL when the
   *   text is not a valid week.
   */
  public static function hours(string $text): ?array {
    $week = ['weekly' => [], 'dated' => []];
    $days = array_keys(self::DAYS);
    foreach (explode('; ', $text) as $entry) {
      if (!preg_match('/^(\d{4}-\d{2}-\d{2}|[A-Z][a-z](?:-[A-Z][a-z])?(?:,[A-Z][a-z](?:-[A-Z][a-z])?)*) (closed|\d\d:\d\d-\d\d:\d\d(?:,\d\d:\d\d-\d\d:\d\d)*)$/D', $entry, $m)) {
        return NULL;
      }
      $ranges = [];
      foreach ($m[2] === 'closed' ? [] : explode(',', $m[2]) as $range) {
        [$opens, $closes] = explode('-', $range);
        $last = end($ranges);
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $opens) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/D', $closes)
          || ($opens >= $closes) || ($last !== FALSE && $opens < $last[1])) {
          return NULL;
        }
        $ranges[] = [$opens, $closes];
      }
      if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/D', $m[1], $date)) {
        if (!checkdate((int) $date[2], (int) $date[3], (int) $date[1]) || isset($week['dated'][$m[1]])) {
          return NULL;
        }
        $week['dated'][$m[1]] = $ranges;
        continue;
      }
      // A weekly entry is open on its days: "closed" is said by leaving a day
      // out.
      if ($ranges === []) {
        return NULL;
      }
      foreach (explode(',', $m[1]) as $span) {
        [$from, $to] = explode('-', $span) + [1 => $span];
        $start = array_search($from, $days, TRUE);
        $end = array_search($to, $days, TRUE);
        if ($start === FALSE || $end === FALSE || $end < $start) {
          return NULL;
        }
        foreach (array_slice($days, $start, $end - $start + 1) as $day) {
          if (isset($week['weekly'][$day])) {
            return NULL;
          }
          $week['weekly'][$day] = $ranges;
        }
      }
    }
    return $week;
  }

  /**
   * A week as OpeningHoursSpecification nodes.
   *
   * Weekly days with the same times share one node per range; a dated entry
   * is its own node, with no days; a dated closure is 00:00-00:00. Dates
   * before $today are left out.
   *
   * @return list<array>
   *   The nodes.
   */
  public static function hoursNodes(array $week, string $today): array {
    $nodes = [];
    $same = [];
    foreach (array_keys(self::DAYS) as $day) {
      if (isset($week['weekly'][$day])) {
        $same[json_encode($week['weekly'][$day])][] = $day;
      }
    }
    foreach ($same as $times => $days) {
      foreach (json_decode($times, TRUE) as [$opens, $closes]) {
        $nodes[] = [
          '@type' => 'OpeningHoursSpecification',
          'dayOfWeek' => array_map(static fn (string $day): string => 'https://schema.org/' . self::DAYS[$day], $days),
          'opens' => $opens,
          'closes' => $closes,
        ];
      }
    }
    ksort($week['dated']);
    foreach ($week['dated'] as $date => $ranges) {
      if ($today !== '' && $date < $today) {
        continue;
      }
      foreach ($ranges ?: [['00:00', '00:00']] as [$opens, $closes]) {
        $nodes[] = [
          '@type' => 'OpeningHoursSpecification',
          'validFrom' => $date,
          'validThrough' => $date,
          'opens' => $opens,
          'closes' => $closes,
        ];
      }
    }
    return $nodes;
  }

  /**
   * A job description: formatted text with only basic markup kept.
   *
   * Keeps p, ul, ol, li, br, strong and em without attributes, and a with
   * its href only when that is an absolute http(s) URL. The content of
   * script, style and template elements is removed; every other tag is
   * removed and its text kept. Cut at 20,000 characters.
   */
  public static function filterHtml(string $html): string {
    if (!mb_check_encoding($html, 'UTF-8')) {
      return '';
    }
    $attributes = '(?:"[^"]*+"|\'[^\']*+\'|[^\'">]++)*+';
    // Comments first: one inside a tag's name never joins a script's.
    $html = preg_replace('~<!--.*?(?:-->|\z)~s', '', $html) ?? '';
    $html = preg_replace('~<(script|style|template)\b' . $attributes . '>.*?(?:</\1\s*>|\z)~is', '', $html) ?? '';
    $keep = implode('|', self::HTML_KEEP);
    $html = preg_replace_callback('~<(/?)([a-zA-Z][a-zA-Z0-9]*)(' . $attributes . ')>~', static function (array $m) use ($keep): string {
      $name = strtolower($m[2]);
      if (!preg_match("~^(?:$keep)$~", $name)) {
        return '';
      }
      if ($m[1] === '/' || $name !== 'a') {
        return "<$m[1]$name>";
      }
      // Attribute by attribute: "data-href", or "href" inside another
      // attribute's value, is never the link.
      preg_match_all('~([^\s"\'=/>]+)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'>]*)))?~', $m[3], $found, PREG_SET_ORDER);
      $href = '';
      foreach ($found as $one) {
        if (strtolower($one[1]) === 'href') {
          $href = html_entity_decode(($one[2] ?? '') . ($one[3] ?? '') . ($one[4] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
          break;
        }
      }
      return Values::isHttpUrl($href) ? '<a href="' . htmlspecialchars($href, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '">' : '<a>';
    }, $html) ?? '';
    $html = trim((string) preg_replace('/\s+/u', ' ', $html));
    $html = mb_strlen($html) > self::HTML_MAX ? Values::whole($html, mb_substr($html, 0, self::HTML_MAX)) : $html;
    // After the cut: a "<" that does not start one of the exact tags rebuilt
    // above is text, so an unclosed tag, or one the cut split, never opens.
    $tags = implode('|', array_diff(self::HTML_KEEP, ['a']));
    return preg_replace('~<(?!/?(?:' . $tags . ')>|/a>|a>|a href="[^"<>]*">)~', '&lt;', $html) ?? '';
  }

  /**
   * A duration in minutes as ISO 8601: PT1H30M.
   */
  public static function duration(int $minutes): string {
    $hours = intdiv($minutes, 60);
    $rest = $minutes % 60;
    return 'PT' . ($hours ? "{$hours}H" : '') . ($rest || !$hours ? "{$rest}M" : '');
  }

  /**
   * The registry property a feature path is set with, for a type.
   *
   * "offers.price" is the property `offers_price`; the rules file names the
   * paths that are set another way. A path into a group whose part is not a
   * property ("location.address") is the group.
   */
  public static function propOf(string $path, string $type): ?string {
    $key = self::searchFeatures()['props'][$path] ?? str_replace('.', '_', $path);
    $entry = self::types()[$type] ?? [];
    if (in_array($key, array_column($entry['props'] ?? [], 'key'), TRUE)) {
      return $key;
    }
    // The nearest group a path goes into: "baseSalary.value" is the pay.
    for ($at = $key; $at !== ''; $at = substr($at, 0, (int) strrpos($at, '_'))) {
      if (isset($entry['groups'][$at])) {
        return $at;
      }
      if (!str_contains($at, '_')) {
        break;
      }
    }
    return NULL;
  }

  /**
   * Assembles the @graph of one page.
   *
   * @param array $ctx
   *   The keys home, url, langcode, title, description, published, modified,
   *   timezone, currency (the site's, or ''), identity{kind, name, same_as[]},
   *   logo?{url, width, height}, image?{url, width, height, alt, source},
   *   breadcrumb? (the trail a breadcrumb on the page shows: {name, url},
   *   the last one's url possibly ''; none when no breadcrumb renders),
   *   facts (name => text, the fixed names custom JSON-LD strings may use),
   *   scope ('page', the default, or 'template') and today (Y-m-d, for the
   *   dates of opening hours that have passed; '' keeps them).
   *   `url` is the entity's own public URL, never a canonical override.
   * @param array $schema
   *   The effective `schema` value, cleaned.
   * @param callable(array, string, bool, int): mixed $value
   *   What a value gives for this entity, by kind: text, or for the image
   *   kind an image array; '' or NULL for nothing. A free-text detail of a
   *   template (Values::composes()) is asked in the form `words`, or `line`
   *   where it is title-like, and may be a composition: its joined text.
   *   With TRUE for a list property, the list of what it gives, in order
   *   (NULL for an item that cannot be used, such as a private image). For
   *   the ref kind always a list of targets: ['identity' => TRUE] for the
   *   publisher, NULL for a page visitors may not see, or {name, url?, type?,
   *   id?, address?};
   *   once the property's cap (the fourth argument) of targets is read,
   *   FALSE for each one left, counted as over the cap.
   *
   * @return array
   *   `graph`; `type`: the registry type used; `withheld`: NULL, or why
   *   the main node was left out ({missing: keys that gave nothing,
   *   dropped: keys that gave a value that does not fit, node: the node as
   *   it would have been}); `dropped`: the values that do not fit their kind
   *   ({key, value, kind}); `sources`: key => `set` (its own value),
   *   `default` or `site` (the site currency);
   *   `gates`: the values of the details that are never emitted;
   *   `unknown_type`: a stored type the registry does not have, or NULL;
   *   `nodes`: every node, emitted or left out ({id, type, origin: site, page,
   *   main or hand, item: the hand-added item's index, at: its index in
   *   @graph, left_out: withheld, skip, reserved or duplicate});
   *   `incomplete`: groups with values that were left out ({group, missing:
   *   the parts that would complete it}); `dropped_items`: list items left
   *   out ({key, count, reason: invalid, private, hidden, max});
   *   `refs_inline`: references that name their target instead of pointing
   *   at it, because it is not described as an accepted kind ({key, name,
   *   reason: kind}); `defaults`: references
   *   that are the publisher only by a Canvas page's default; `unpaired`: a
   *   property left out because its pair gives nothing; `pay_order`: pay
   *   left out because its From is above its To; `items`: the pages a list
   *   page lists ({url, type, complete}).
   */
  public static function build(array $ctx, array $schema, callable $value): array {
    $types = self::types();
    $stored_type = (string) ($schema['type'] ?? '');
    $scope = $ctx['scope'] ?? 'page';
    $type_id = isset($types[$stored_type]) && self::offered($stored_type, NULL, $scope) ? $stored_type : 'WebPage';
    $type = $types[$type_id];
    // Identity: these never change after the first release.
    $ids = [
      'identity' => $ctx['home'] . '#identity',
      'logo' => $ctx['home'] . '#logo',
      'website' => $ctx['home'] . '#website',
      'webpage' => $ctx['url'] . '#webpage',
      'primaryimage' => $ctx['url'] . '#primaryimage',
      'primary' => $ctx['url'] . '#primary',
      'breadcrumb' => $ctx['url'] . '#breadcrumb',
    ];
    $ref = static fn (string $name): array => ['@id' => $ids[$name]];
    $logo = $ctx['logo'] ?? NULL;
    // The page's own image: never the site's image, never a made one.
    $page_image = ($ctx['image']['source'] ?? '') === 'site' ? NULL : $ctx['image'] ?? NULL;
    // An image property that picks the site's image is written out, not
    // pointed at a #primaryimage node this page has no reason to emit.
    $ctx['image'] = $page_image;
    $trail = $ctx['breadcrumb'] ?? [];
    $report = [
      'withheld' => NULL,
      'dropped' => [],
      'sources' => [],
      'gates' => [],
      'type' => $type_id,
      'unknown_type' => $stored_type !== '' && !isset($types[$stored_type]) ? $stored_type : NULL,
      'nodes' => [],
      'incomplete' => [],
      'dropped_items' => [],
      'refs_inline' => [],
      'defaults' => [],
      'unpaired' => [],
      'pay_order' => FALSE,
      'items' => [],
      'judged' => NULL,
    ];
    $props = array_filter($type['props'] ?? [], static fn (array $prop): bool => self::offered($type_id, $prop['key'], $scope));
    $groups = $type['groups'] ?? [];
    $nested = $type['nested'] ?? [];

    // Every property's value, before it is placed: groups, pairs and gates
    // decide what is emitted.
    $found = [];
    $codes = [];
    foreach ($props as $prop) {
      $key = $prop['key'];
      $default = $prop['default'] ?? NULL;
      // A free-text detail of a template reads its fields as words, and may
      // be a composition.
      $path = "schema.props.$key";
      $kind = Values::composes($prop, $path, $scope) ? (Values::titleLike($path) ? 'line' : 'words') : Values::kindOf($prop);
      $list = !empty($prop['list']) || isset($prop['join']) || $prop['kind'] === 'ref';
      $max = $prop['max'] ?? ($list ? 100 : 1);
      // The Description fact is the page's own description, as search shows
      // it, not the raw text it may have been cut from. A link that gives
      // nothing gives the default; one that gives a value that does not
      // fit leaves the detail out.
      $resolve = static fn (?array $v): mixed => match (TRUE) {
        $v === NULL => NULL,
        $v === ['fact' => 'description'] => (string) ($ctx['description'] ?? ''),
        $v === ['fact' => 'identity'] => [['identity' => TRUE]],
        // A reference's targets past the cap are FALSE, never read.
        default => $value($v, $kind, $list, $max),
      };
      $stored = $schema['props'][$key] ?? NULL;
      $raw = $resolve($stored);
      $source = 'set';
      if ($raw === NULL || $raw === '' || $raw === []) {
        $group_set = isset($prop['group']) && array_filter(array_keys($schema['props'] ?? []), static fn (string $other): bool => $other === $prop['group'] || str_starts_with($other, $prop['group'] . '_'));
        [$raw, $source] = match (TRUE) {
          // An image chosen to share the page comes before the page's own.
          $default === ['fact' => 'image'] && ($page_image['source'] ?? '') === 'override' => [
            $list ? [$page_image] : $page_image,
            'default',
          ],
          // The site currency, for a price or pay: never an offer of
          // nothing. The registry lists an amount before its currency.
          $prop['kind'] === 'currency' && self::amountIn($key, $found, $props) => [
            (string) ($ctx['currency'] ?? ''),
            'site',
          ],
          // On a Canvas page an organizer or an author nobody set is the
          // publisher; the report says so.
          !empty($prop['page_default']) && $scope === 'page' && !$group_set => [[['identity' => TRUE]], 'publisher'],
          default => [$resolve($default), 'default'],
        };
      }
      $items = $list ? (is_array($raw) && array_is_list($raw) ? $raw : ($raw === NULL || $raw === '' ? [] : [$raw])) : [$raw];
      // Typed codes are one text: "FI,SE".
      if ($prop['kind'] === 'enum' && !empty($prop['list'])) {
        $items = array_merge([], ...array_map(static fn (mixed $item): array => is_string($item) ? explode(',', $item) : [$item], $items));
      }
      $emitted = [];
      $dropped = ['invalid' => 0, 'private' => 0, 'hidden' => 0, 'max' => 0];
      foreach ($items as $item) {
        if ($item === FALSE) {
          $dropped['max']++;
          continue;
        }
        if ($item === NULL && $list) {
          // An image in a private file; a page visitors may not see.
          $dropped[$prop['kind'] === 'ref' ? 'hidden' : 'private']++;
          continue;
        }
        $one = $prop['kind'] === 'ref' ? $item : self::value($type_id, $prop, $item, $ctx, $stored['unit'] ?? NULL);
        if ($one === NULL) {
          if (is_string($item) && trim($item) !== '') {
            $dropped['invalid']++;
            if (!$list) {
              $report['dropped'][] = ['key' => $key, 'value' => mb_substr($item, 0, 200), 'kind' => $prop['kind']];
            }
          }
          continue;
        }
        $emitted[] = $one;
      }
      // Lists of things that are the same when equal lose their repeats;
      // a list of text keeps them.
      if ($list && $prop['kind'] !== 'text') {
        $emitted = array_values(array_unique($emitted, SORT_REGULAR));
      }
      if (count($emitted) > $max) {
        $dropped['max'] += count($emitted) - $max;
        $emitted = array_slice($emitted, 0, $max);
      }
      foreach ($list ? array_filter($dropped) : [] as $reason => $count) {
        $report['dropped_items'][] = ['key' => $key, 'count' => $count, 'reason' => $reason];
      }
      if ($emitted === []) {
        continue;
      }
      if ($source === 'publisher') {
        $report['defaults'][] = $key;
        $source = 'default';
      }
      $report['sources'][$key] = $source;
      if ($prop['kind'] === 'enum' && empty($prop['list'])) {
        $codes[$key] = str_replace('https://schema.org/', '', (string) $emitted[0]);
      }
      $found[$key] = match (TRUE) {
        isset($prop['join']) => implode($prop['join'], $emitted),
        $prop['kind'] === 'ref' || !empty($prop['list']) => $emitted,
        default => $emitted[0],
      };
    }

    // A gated property counts only when its gate holds; a pair only whole.
    foreach ($props as $prop) {
      foreach ($prop['when'] ?? [] as $gate => $wanted) {
        if (!in_array($codes[$gate] ?? NULL, $wanted, TRUE)) {
          unset($found[$prop['key']], $report['sources'][$prop['key']]);
        }
      }
    }
    foreach ($props as $prop) {
      if (isset($prop['pair'], $found[$prop['key']]) && !isset($found[$prop['pair']])) {
        $report['unpaired'][] = $prop['key'];
        unset($found[$prop['key']], $report['sources'][$prop['key']]);
      }
    }

    $primary = NULL;
    $page_main = NULL;
    if (isset($type['primary_type'])) {
      $primary = ['@type' => $type['primary_type'], '@id' => $ids['primary'], 'mainEntityOfPage' => $ref('webpage')];
      // A fixed ref first; one with a condition when the values are known.
      $refs = array_map(static fn (string|array $to): array => is_string($to) ? [
        'to' => $to,
        'fixed' => TRUE,
      ] : $to, $type['refs'] ?? []);
      foreach (array_filter($refs, static fn (array $to): bool => isset($to['fixed'])) as $key => $to) {
        self::put($primary, $key, $ref($to['to']), $nested);
      }
    }
    $missing = $invalid = [];
    $placed = [];
    // Incomplete groups as they are: the verdicts name the part they miss.
    $partial = [];
    foreach ($props as $prop) {
      $key = $prop['key'];
      $group = $prop['group'] ?? NULL;
      if ($group !== NULL) {
        if (!isset($placed[$group])) {
          $placed[$group] = TRUE;
          $node = self::group($group, $groups, $nested, $props, $found, $ids, $report, $partial);
          // A required group nothing was set for withholds the main node;
          // one that has values is left out and reported incomplete, and
          // the node kept (decision 8: an event with only a street keeps
          // its Event).
          if ($node === NULL && !isset($partial[$group]) && ($groups[$group]['level'] ?? '') === 'required') {
            $missing[] = $group;
          }
          if ($node !== NULL && $primary !== NULL) {
            $primary[$group] = $node;
          }
        }
        continue;
      }
      if (!array_key_exists($key, $found)) {
        if (($prop['level'] ?? '') === 'required') {
          in_array($key, array_column($report['dropped'], 'key'), TRUE) ? $invalid[] = $key : $missing[] = $key;
        }
        continue;
      }
      $emitted = $found[$key];
      if ($prop['kind'] === 'ref') {
        $emitted = self::refs($prop, $emitted, $ids, $report);
        if (($prop['item'] ?? NULL) === 'ListItem') {
          // A list page's pages, as the page node's main entity.
          $page_main = $emitted ? ['@type' => 'ItemList', 'itemListElement' => $emitted] : NULL;
          continue;
        }
        if ($emitted === []) {
          continue;
        }
      }
      // A list of one is its item; a list of steps is steps only when there
      // are several.
      if (is_array($emitted) && array_is_list($emitted)) {
        if (isset($prop['item']) && $prop['kind'] !== 'ref' && ($prop['item'] !== 'HowToStep' || count($emitted) > 1)) {
          $emitted = array_map(static fn (string $one): array => $prop['item'] === 'Country'
            ? ['@type' => 'Country', 'name' => $one]
            : ['@type' => $prop['item'], 'text' => $one], $emitted);
        }
        $emitted = count($emitted) === 1 ? $emitted[0] : $emitted;
      }
      if (($prop['emit'] ?? TRUE) === FALSE) {
        // The clean value, as it was validated: " P1M" is "P1M".
        $report['gates'][$key] = $emitted;
        continue;
      }
      if (($prop['emit'] ?? '') === 'type') {
        if ($primary !== NULL) {
          $primary['@type'] = $emitted;
        }
        continue;
      }
      if ($primary !== NULL) {
        self::put($primary, $key, $emitted, $nested);
      }
    }
    if ($primary !== NULL) {
      foreach (array_diff_key($refs, array_filter($refs, static fn (array $to): bool => isset($to['fixed']))) as $key => $to) {
        $holds = !isset($to['unless']) || !isset($report['sources'][$to['unless']]);
        foreach ($to['if'] ?? [] as $gate => $wanted) {
          $holds = $holds && ($report['gates'][$gate] ?? NULL) === $wanted;
        }
        if ($holds) {
          self::put($primary, $key, $ref($to['to']), $nested);
        }
      }
      $work = self::WORK[$report['gates']['work'] ?? ''] ?? NULL;
      if ($work !== NULL) {
        $primary['jobLocationType'] = $work;
      }
      // A price billed every month or year says so beside the plain price.
      $billing = self::BILLING[$report['gates']['billing'] ?? ''] ?? NULL;
      if ($billing !== NULL && isset($primary['offers']['price'])) {
        $primary['offers']['priceSpecification'] = self::node([
          '@type' => 'UnitPriceSpecification',
          'price' => $primary['offers']['price'],
          'priceCurrency' => $primary['offers']['priceCurrency'] ?? NULL,
          'billingDuration' => $report['gates']['billing'],
          'unitCode' => $billing,
        ]);
      }
      $judged = $primary;
      uksort($partial, static fn (string $a, string $b): int => strlen($a) <=> strlen($b));
      foreach ($partial as $key => $node) {
        self::put($judged, $key, $node, $nested);
      }
      if ($missing || $invalid) {
        $report['withheld'] = ['missing' => $missing, 'dropped' => $invalid, 'node' => $judged];
        $report['nodes'][] = [
          'id' => $ids['primary'],
          'type' => $primary['@type'],
          'origin' => 'main',
          'left_out' => 'withheld',
        ];
        $primary = NULL;
      }
      elseif ($judged !== $primary) {
        $report['judged'] = $judged;
      }
    }

    $person = ($ctx['identity']['kind'] ?? '') === 'person';
    $graph = [
      'site' => self::node([
        '@type' => $person ? 'Person' : 'Organization',
        '@id' => $ids['identity'],
        'name' => $ctx['identity']['name'] ?? '',
        'url' => $ctx['home'],
        ($person ? 'image' : 'logo') => $logo ? $ref('logo') : NULL,
        'sameAs' => array_values($ctx['identity']['same_as'] ?? []),
      ]),
      'site:logo' => $logo ? self::imageNode($ids['logo'], $logo) : NULL,
      'site:website' => self::node([
        '@type' => 'WebSite',
        '@id' => $ids['website'],
        'url' => $ctx['home'],
        'name' => $ctx['identity']['name'] ?? '',
        'inLanguage' => $ctx['langcode'] ?? '',
        'publisher' => $ref('identity'),
      ]),
      'page' => self::node([
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
        'mainEntity' => $primary ? $ref('primary') : $page_main,
        'breadcrumb' => $trail ? $ref('breadcrumb') : NULL,
      ]),
      'page:image' => $page_image ? self::imageNode($ids['primaryimage'], $page_image) + self::node(['caption' => $page_image['alt'] ?? '']) : NULL,
      // The trail the page shows; the last crumb, the page itself, may have
      // no address.
      'page:breadcrumb' => $trail ? [
        '@type' => 'BreadcrumbList',
        '@id' => $ids['breadcrumb'],
        'itemListElement' => array_map(static fn (array $crumb, int $at): array => self::node([
          '@type' => 'ListItem',
          'position' => $at + 1,
          'name' => $crumb['name'],
          'item' => $crumb['url'] ?? '',
        ]), array_values($trail), array_keys(array_values($trail))),
      ] : NULL,
      'main' => $primary,
    ];
    // Every id the module emits, on its address: what a short id points at,
    // and what a hand-added item can never replace.
    $ours = [];
    foreach (self::MODULE_IDS as $name => $anchor) {
      $ours[($anchor === 'home' ? $ctx['home'] : $ctx['url']) . "#$name"] = TRUE;
    }
    $present = array_fill_keys(array_column(array_filter($graph), '@id'), TRUE);
    // What hand-added JSON-LD and added details did; members are left out
    // when nothing happened.
    $report += [
      'clashes' => [],
      'unmatched' => [],
      'added' => [],
      'type_added' => [],
      'empty' => [],
      'cut' => [],
      'main' => NULL,
      'over' => FALSE,
    ];
    $prepare = self::preparer($ctx, $ours, $present, $value, $report);

    // Added details: merged into the module's own nodes per leaf; a value the
    // module emits is kept, and the clash reported (decision 2).
    $own_graph = $graph;
    $own_judged = $report['judged'];
    $into = ['#primary' => 'main', '#webpage' => 'page', '#identity' => 'site'];
    $extended = [];
    foreach ($schema['extend'] ?? [] as $name => $text) {
      $added = json_decode((string) $text, TRUE);
      $origin = $into[$name] ?? NULL;
      if ($origin === NULL || !is_array($added) || array_is_list($added)) {
        continue;
      }
      if (!isset($graph[$origin])) {
        $report['unmatched'][] = ['node' => $name, 'path' => ''];
        continue;
      }
      $added = $prepare($added, FALSE, ['extend' => $name, 'path' => []]);
      $added = is_array($added) ? $added : [];
      self::merge($graph[$origin], $added, $name, [], $origin === 'main' ? $type_id : NULL, $report);
      if ($origin === 'main' && is_array($report['judged'])) {
        // The verdicts read the main node with its incomplete groups: the
        // details join it there too, reported once.
        $throwaway = $report;
        self::merge($report['judged'], $added, $name, [], $type_id, $throwaway);
      }
      $extended[$origin] = TRUE;
    }

    // A withheld node is listed first, and takes no place in @graph.
    foreach (array_keys(array_filter($graph)) as $at => $origin) {
      $report['nodes'][] = [
        'id' => $graph[$origin]['@id'],
        'type' => is_array($graph[$origin]['@type']) ? $graph[$origin]['@type'][0] : $graph[$origin]['@type'],
        'origin' => strtok($origin, ':'),
        'at' => $at,
      ] + (isset($extended[$origin]) ? ['extended' => TRUE] : []);
    }
    $graph = array_values(array_filter($graph));
    $own_graph = array_values(array_filter($own_graph));

    // Hand-added items can point at our nodes and never replace them. Values
    // refuses the module's ids and shared ones; what was stored before that
    // rule is renamed when read. ponytail: decoded as arrays, so an empty
    // object or one with only numeric keys is emitted as a list; the stored
    // text keeps them apart.
    $custom = json_decode($schema['custom'] ?? '', TRUE);
    $skip = array_fill_keys($schema['skip'] ?? [], TRUE);
    $taken = $ours;
    $hand = [];
    foreach (is_array($custom) ? (array_is_list($custom) ? $custom : [$custom]) : [] as $item => $node) {
      if (!is_array($node) || !isset($node['@type'])) {
        continue;
      }
      $written = is_string($node['@id'] ?? NULL) ? $node['@id'] : NULL;
      unset($node['@context']);
      $before = count($node);
      $node = $prepare($node, TRUE, ['item' => $item, 'path' => []]);
      $types = (array) ($node['@type'] ?? []);
      $entry = ['id' => $node['@id'] ?? NULL, 'type' => (string) ($types[0] ?? ''), 'origin' => 'hand', 'item' => $item];
      // An item emptied by its links is left out: only its type and id left.
      $left_out = match (TRUE) {
        $written !== NULL && isset($skip[$written]) => 'skip',
        isset($node['@id'], $ours[$node['@id']]) => 'reserved',
        isset($node['@id'], $taken[$node['@id']]) => 'duplicate',
        count($node) < $before && !array_diff_key($node, ['@type' => TRUE, '@id' => TRUE]) => 'empty',
        default => NULL,
      };
      if ($left_out !== NULL) {
        $hand[] = $entry + ['left_out' => $left_out];
        continue;
      }
      if (isset($node['@id'])) {
        $taken[$node['@id']] = TRUE;
      }
      $hand[] = $entry + ['at' => count($graph)];
      $graph[] = $node;
    }

    // A hand-added item as what a plain web page is mainly about.
    $main = $schema['main'] ?? NULL;
    if (is_string($main)) {
      $id = str_starts_with($main, '#') ? $ctx['url'] . $main : $main;
      $at = array_column($hand, 'at', 'id')[$id] ?? NULL;
      $page_at = array_search($ids['webpage'], array_column($graph, '@id'), TRUE);
      $report['main'] = [
        'id' => $id,
        'ignored' => match (TRUE) {
        $type_id !== 'WebPage' || isset($graph[$page_at]['mainEntity']) => 'kind',
        $at === NULL => 'absent',
        default => NULL,
        },
      ];
      if ($report['main']['ignored'] === NULL) {
        $graph[$page_at]['mainEntity'] = ['@id' => $id];
        $graph[$at]['mainEntityOfPage'] = $ref('webpage');
      }
    }

    // Bounded output: over 256 KB, what was added by hand is left out and
    // the module's own nodes stay.
    if (($hand || $report['added']) && strlen((string) json_encode($graph, (Values::OUTPUT_FLAGS & ~JSON_THROW_ON_ERROR) | JSON_PARTIAL_OUTPUT_ON_ERROR)) > self::OUTPUT_MAX) {
      $graph = $own_graph;
      $report['judged'] = $own_judged;
      $report['over'] = TRUE;
      $report['main'] = NULL;
      // What the details and items did is not output either.
      $report['added'] = $report['clashes'] = $report['type_added'] = $report['unmatched'] = $report['empty'] = $report['cut'] = [];
      $report['nodes'] = array_map(static fn (array $entry): array => array_diff_key($entry, ['extended' => TRUE]), $report['nodes']);
      $hand = array_map(static fn (array $entry): array => isset($entry['at']) ? array_diff_key($entry, ['at' => TRUE]) + ['left_out' => 'over'] : $entry, $hand);
    }
    array_push($report['nodes'], ...$hand);
    foreach (['empty', 'cut'] as $list) {
      $report[$list] = array_map(static fn (array $one): array => ['path' => implode('.', $one['path'])] + $one, $report[$list]);
    }
    foreach (['clashes', 'unmatched', 'added', 'type_added', 'empty', 'cut', 'main', 'over'] as $member) {
      if (!$report[$member]) {
        unset($report[$member]);
      }
    }

    return ['graph' => ['@context' => 'https://schema.org', '@graph' => $graph]] + $report;
  }

  /**
   * Whether a currency's node has an amount.
   *
   * "offers_priceCurrency" has one when "offers_price" gave a value.
   */
  private static function amountIn(string $key, array $found, array $props): bool {
    $node = substr($key, 0, (int) strrpos($key, '_'));
    foreach ($props as $prop) {
      if ($prop['kind'] === 'number' && str_starts_with($prop['key'], "{$node}_") && isset($found[$prop['key']])) {
        return TRUE;
      }
    }
    return FALSE;
  }

  /**
   * The node of a group, or NULL when it is incomplete or empty.
   *
   * A group whose reference gives the publisher or a page is that
   * reference. A reference that gives only a name (a page not described as
   * an accepted kind) is the group's name, and the group's other parts are
   * kept; so is a list group's one target. Otherwise its parts are placed
   * in its node, with each nested group that is complete; a group that has
   * values but misses what it requires is reported.
   */
  private static function group(string $key, array $groups, array $nested, array $props, array $found, array $ids, array &$report, array &$partial): ?array {
    $group = $groups[$key];
    $by_key = array_column($props, NULL, 'key');
    if (!isset($group['parent']) && isset($found[$key], $by_key[$key])) {
      $targets = self::refs($by_key[$key], $found[$key], $ids, $report);
      // One target, also of a list group (a workplace): named only, it is
      // the group's name beside the group's own parts.
      if (isset($targets[0]) && (empty($group['list']) || count($targets) === 1) && !isset($targets[0]['@id']) && isset($by_key["{$key}_name"])) {
        $found["{$key}_name"] ??= $targets[0]['name'];
        $targets = [];
      }
      if ($targets) {
        // The parts are not what is emitted: the reference is.
        $report['sources'] = array_diff_key($report['sources'], array_flip(array_filter(array_keys($report['sources']), static fn (string $one): bool => str_starts_with($one, "{$key}_"))));
        return empty($group['list']) ? $targets[0] : (count($targets) === 1 ? $targets[0] : $targets);
      }
    }
    $node = ['@type' => $group['type']];
    $done = [];
    $inner_nested = [];
    foreach ($nested as $path => $nested_type) {
      if (str_starts_with($path, "{$key}_")) {
        $inner_nested[substr($path, strlen($key) + 1)] = $nested_type;
      }
    }
    foreach ($group['parts'] as $part) {
      $name = substr($part, strlen($key) + 1);
      if (isset($groups[$part])) {
        $inner = self::group($part, $groups, $nested, $props, $found, $ids, $report, $partial);
        if ($inner !== NULL) {
          $node[$name] = $inner;
          $done[$part] = TRUE;
        }
        continue;
      }
      if (!array_key_exists($part, $found) || !isset($by_key[$part])) {
        continue;
      }
      $done[$part] = TRUE;
      if (($by_key[$part]['emit'] ?? TRUE) === FALSE) {
        continue;
      }
      $leaf = $found[$part];
      // Not on sale yet: no availability, only the date it goes on sale.
      if ($group['shape'] === 'tickets' && $name === 'availability' && $leaf === 'https://schema.org/NotYet') {
        continue;
      }
      // Coordinates and pay are numbers.
      if (in_array($group['shape'], ['geo', 'pay'], TRUE) && is_numeric($leaf)) {
        $leaf = 0 + $leaf;
      }
      self::put($node, $name, $leaf, $inner_nested);
    }
    // A group nothing was set for is not there; the site currency alone
    // sets nothing.
    $set = array_filter(array_keys($found), static fn (string $one): bool => str_starts_with($one, "{$key}_") && ($by_key[$one]['kind'] ?? '') !== 'currency');
    if ($set === []) {
      return NULL;
    }
    $missing = [];
    foreach ($group['requires'] as $entry) {
      if (!array_intersect($entry, array_keys($done))) {
        array_push($missing, ...array_values(array_filter($entry, static fn (string $one): bool => !isset($groups[$one]))));
        foreach (array_filter($entry, static fn (string $one): bool => isset($groups[$one])) as $inner) {
          // A nested group that is not there at all is missing as a whole.
          if (!in_array($inner, array_column($report['incomplete'], 'group'), TRUE)) {
            $missing[] = $inner;
          }
        }
      }
    }
    foreach ($group['needs'] ?? [] as $other) {
      if (!isset($found[$other])) {
        $missing[] = $other;
      }
    }
    if ($group['shape'] === 'pay' && $missing === []) {
      $value = $node['value'];
      $from = $value['minValue'] ?? NULL;
      $to = $value['maxValue'] ?? NULL;
      if ($to !== NULL && $to < $from) {
        $report['pay_order'] = TRUE;
        return NULL;
      }
      if ($to === NULL || $to == $from) {
        $node['value'] = ['@type' => 'QuantitativeValue', 'value' => $from, 'unitText' => $value['unitText']];
      }
    }
    if ($missing) {
      $report['incomplete'][] = ['group' => $key, 'missing' => $missing];
      $partial[$key] = $node;
      return NULL;
    }
    return $node;
  }

  /**
   * The emitted form of a reference's targets.
   *
   * The publisher is the identity's @id; a public page described as an
   * accepted kind is its main node's @id with its type, name, URL and any
   * inline address; anything else is named only.
   *
   * @return list<array>
   *   One node per target.
   */
  private static function refs(array $prop, array $targets, array $ids, array &$report): array {
    $out = [];
    $position = 0;
    foreach ($targets as $target) {
      // Someone else, by name.
      if (is_string($target)) {
        $target = ['name' => $target];
      }
      if (!is_array($target)) {
        continue;
      }
      if (!empty($target['identity'])) {
        $out[] = ['@id' => $ids['identity']];
        continue;
      }
      if (($prop['item'] ?? NULL) === 'ListItem') {
        // A list page lists pages; one visitors may not see is NULL and was
        // dropped before (`hidden`).
        if (!isset($target['url'])) {
          continue;
        }
        $report['items'][] = [
          'url' => $target['url'],
          'type' => $target['type'] ?? NULL,
          'complete' => !empty($target['complete']),
        ];
        $out[] = ['@type' => 'ListItem', 'position' => ++$position, 'url' => $target['url']];
        continue;
      }
      $name = Values::plain((string) ($target['name'] ?? ''), 255);
      $accepted = isset($target['type']) && array_intersect(self::ancestors($target['type']), $prop['accept'] ?? []);
      if ($accepted && isset($target['id'], $target['url']) && $name !== '') {
        $out[] = self::node([
          '@id' => $target['id'],
          '@type' => $target['type'],
          'name' => $name,
          'url' => $target['url'],
          'address' => isset($prop['inline']) ? $target['address'] ?? NULL : NULL,
        ]);
        continue;
      }
      if ($name === '') {
        continue;
      }
      if (isset($target['url']) || isset($target['type'])) {
        $report['refs_inline'][] = ['key' => $prop['key'], 'name' => $name, 'reason' => 'kind'];
      }
      $out[] = ['@type' => $prop['as'] ?? 'Thing', 'name' => $name];
    }
    return array_values(array_unique($out, SORT_REGULAR));
  }

  /**
   * The verdict of every search feature that applies to a graph.
   *
   * Follows {"@id"} references inside the graph, so hand-added items get
   * verdicts too; a review or a rating whose itemReviewed is a node's @id
   * counts as that node's.
   *
   * @param array $graph
   *   The built graph, `@context` and `@graph`.
   * @param array $ctx
   *   The keys home, url, front (whether the page is the front page), type (the
   *   registry type), scope ('page' or 'template': what also helps is only
   *   what that scope offers), gates (the report's), extra (nodes to judge
   *   as if they were in the graph: the withheld main node).
   *
   * @return list<array{feature: ?string, node: ?string, verdict: string, missing?: list<array>, helps?: list<array>, reason?: string}>
   *   One verdict per feature and node, ordered as the dialog lists them;
   *   `none` alone when no feature applies. A missing or helping fact is
   *   {path, prop?, site?, rule?}: the path, the detail that sets it on the
   *   main node, the site setting that sets it on a site node, and the index
   *   of the rule it fails.
   */
  public static function features(array $graph, array $ctx): array {
    $rules = self::searchFeatures();
    $nodes = [...$graph['@graph'] ?? [], ...$ctx['extra'] ?? []];
    // The main node with its incomplete groups, so that a verdict names the
    // part a group misses.
    $judged = $ctx['judged'] ?? NULL;
    if (is_array($judged)) {
      $nodes = array_map(static fn (array $node): array => ($node['@id'] ?? NULL) === $judged['@id'] ? $judged : $node, $nodes);
    }
    $index = self::index($nodes);
    // A review or a rating that names what it reviews counts as that item's
    // own: a hand-added review of a hand-added product "#p" is that
    // product's review. A main node that is withheld has no reference left
    // to it (custom()), so a review of it counts for nothing.
    $reviewed = [];
    foreach ($nodes as $top) {
      foreach (self::objects($top) as [$object]) {
        $about = $object['itemReviewed']['@id'] ?? NULL;
        $as = match (TRUE) {
          in_array('Review', (array) $object['@type'], TRUE) => 'review',
          in_array('AggregateRating', (array) $object['@type'], TRUE) => 'aggregateRating',
          default => NULL,
        };
        if ($as !== NULL && is_string($about) && isset($index[$about])) {
          $reviewed[$about][$as][] = array_diff_key($object, ['itemReviewed' => TRUE]);
        }
      }
    }
    $ours = array_map(static fn (string $name): string => $ctx['home'] . "#$name", [
      'identity' => 'identity',
      'website' => 'website',
    ]);
    $main = [$ctx['url'] . '#primary' => TRUE, $ctx['url'] . '#webpage' => TRUE];
    $verdicts = [];
    // The places in @graph of the hand-added items: what only they are judged
    // by (a review snippet, an image credit) is never asked of the module's
    // own nodes.
    $hand = array_flip($ctx['hand'] ?? []);
    foreach ($nodes as $at => $top) {
      foreach (self::objects($top) as [$object, $nested]) {
        $id = is_string($object['@id'] ?? NULL) ? $object['@id'] : NULL;
        // A reference to another page's main thing is judged on that page.
        if ($nested && $id !== NULL && !isset($index[$id]) && !str_starts_with($id, $ctx['url'] . '#')) {
          continue;
        }
        foreach ($id === NULL ? [] : $reviewed[$id] ?? [] as $as => $found) {
          $object[$as] ??= $found;
        }
        // A type added to the main thing does not change what it is.
        $types = $id === $ctx['url'] . '#primary' ? [((array) $object['@type'])[0]] : (array) $object['@type'];
        foreach ($rules['features'] as $name => $feature) {
          $only = match ($feature['only'] ?? NULL) {
            'hand' => !$nested && isset($hand[$at]),
            'page' => $id === $ctx['url'] . '#webpage',
            default => TRUE,
          };
          if (!$only || !array_intersect($types, $feature['on'])) {
            continue;
          }
          $verdict = ['feature' => $name, 'node' => $id ?? ($top['@id'] ?? NULL)];
          if (isset($feature['node'])) {
            // Judged on the site's own node, on the home page.
            if ($id !== $ours[$feature['node']]) {
              if (!$nested && !in_array($id, $ours, TRUE)) {
                $verdicts[] = $verdict + ['verdict' => 'not_here'];
              }
              continue;
            }
            if (empty($ctx['front'])) {
              continue;
            }
          }
          if ($feature['status'] === 'retired') {
            $verdicts[] = $verdict + ['verdict' => 'retired'];
            continue;
          }
          // A list feature is judged on the list; the things it lists are
          // shown only from there.
          if (isset($feature['list'])) {
            if (!in_array('ItemList', $types, TRUE)) {
              $verdicts[] = $verdict + ['verdict' => 'elsewhere'];
              continue;
            }
            $items = $ctx['items'] ?? [];
            $complete = count(array_filter($items, static fn (array $item): bool => $item['type'] === $feature['list']['of'] && $item['complete']));
            $verdicts[] = $verdict + [
              'verdict' => $complete >= $feature['list']['min'] ? 'ready' : 'needs',
              'count' => $complete,
              'of' => count($items),
            ] + ($complete >= $feature['list']['min'] ? [] : ['missing' => [['path' => 'itemListElement']]]);
            continue;
          }
          $is_main = isset($main[(string) $id]);
          $fact = static function (string $path, ?int $rule = NULL) use ($is_main, $id, $ours, $ctx, $rules): array {
            $path = explode('|', $path)[0];
            return array_filter([
              'path' => $path,
              'prop' => $is_main ? self::propOf($path, $ctx['type'] ?? 'WebPage') : NULL,
              'site' => in_array($id, $ours, TRUE) ? $rules['site'][$path] ?? NULL : NULL,
              'rule' => $rule,
            ], static fn (mixed $v): bool => $v !== NULL);
          };
          // A one-of entry is a list; "a|b" is either path.
          // A coded value the feature does not accept counts as missing.
          $accepts = $feature['accepts'] ?? [];
          $has = static fn (string|array $entry): bool => (bool) array_filter((array) $entry, static fn (string $one): bool => self::has($object, $one, $index, $accepts));
          $reason = NULL;
          foreach ($feature['not_for'] ?? [] as $not) {
            $seller = isset($not['seller']) ? self::at($object, $not['seller'], $index) : NULL;
            $fits = match (TRUE) {
              isset($not['exists']) => self::at($object, $not['exists'], $index) === [],
              isset($not['several']) => count(array_unique(array_map(
                // Only a written-out price counts; an object is not one.
                static fn (mixed $offer): string => is_scalar($price = self::at($offer, 'price', $index)[0] ?? self::at($offer, 'priceSpecification.price', $index)[0] ?? '') ? (string) $price : '',
                self::at($object, $not['several'], $index),
              ))) < 2,
              isset($not['subdirectory']) => in_array(parse_url($ctx['home'], PHP_URL_PATH) ?? '/', ['', '/'], TRUE),
              // A closing date that has passed, with no time zone of its
              // own: compared as the site's date.
              isset($not['past']) => ($ctx['today'] ?? '') === '' || !is_string($closes = self::at($object, $not['past'], $index)[0] ?? NULL) || substr($closes, 0, 10) >= $ctx['today'],
              $seller !== NULL => ($seller[0]['@id'] ?? NULL) === $ours['identity'],
              // A review or rating of the site's own organization.
              isset($not['ours']) => (self::at($object, $not['ours'], $index)[0]['@id'] ?? NULL) !== $ours['identity'],
              default => TRUE,
            };
            if (!$fits) {
              $reason = $not['id'];
              // The site is the seller only when the editor said so: until
              // then it is a question, not a misfit.
              if ($seller !== NULL && $is_main && ($ctx['gates']['sold_here'] ?? '') === '') {
                $reason = 'unanswered';
              }
              break;
            }
          }
          if ($reason === 'unanswered') {
            $verdicts[] = $verdict + ['verdict' => 'unanswered'];
            continue;
          }
          if ($reason === 'closed') {
            $verdicts[] = $verdict + [
              'verdict' => 'closed',
              'date' => substr((string) self::at($object, 'validThrough', $index)[0], 0, 10),
            ];
            continue;
          }
          if ($reason !== NULL) {
            $verdicts[] = $verdict + ['verdict' => 'not_fit', 'reason' => $reason];
            continue;
          }
          $missing = [];
          foreach ([...$feature['required'], ...$feature['complete'] ?? []] as $entry) {
            if (!$has($entry)) {
              $missing[] = $fact(self::asked($entry, $ctx, static fn (string $path): bool => self::at($object, explode('|', $path)[0], $index) !== []));
              continue;
            }
            // A value of another shape counts as missing, and says what it
            // must be: an organization, not only its name.
            $misfit = self::misfit($entry, $object, $index, $feature['expects'] ?? []);
            if ($misfit !== NULL) {
              $missing[] = $fact($misfit[0]) + ['expects' => $misfit[1]];
            }
          }
          // A group left out for a part it misses is not there: what the
          // feature requires of it names that part.
          if ($is_main) {
            $required = array_merge(...array_map(static fn (string|array $entry): array => explode('|', implode('|', (array) $entry)), $feature['required'] ?: [[]]));
            foreach ($ctx['incomplete'] ?? [] as $gap) {
              $at = str_replace('_', '.', $gap['group']);
              if (!array_filter($required, static fn (string $path): bool => $path === $at || str_starts_with($path, "$at."))) {
                continue;
              }
              foreach ($gap['missing'] as $key) {
                $path = str_replace('_', '.', $key);
                if (!in_array($path, array_column($missing, 'path'), TRUE)) {
                  $missing[] = $fact($path);
                }
              }
            }
          }
          // A part a group misses is asked for instead of the whole group.
          $missing = array_values(array_filter($missing, static fn (array $one): bool => !array_filter($missing, static fn (array $other): bool => str_starts_with($other['path'], $one['path'] . '.'))));
          foreach ($feature['rules'] ?? [] as $at => $rule) {
            // Needed only when another fact is there: remote work needs who
            // can apply from where.
            if (isset($rule['when'])) {
              if (self::has($object, $rule['when'], $index, $accepts) && !self::has($object, $rule['path'], $index, $accepts)) {
                $missing[] = $fact($rule['path'], $at);
              }
              continue;
            }
            // So many entries with a value or more: a trail of two named
            // items. Each entry counts once, however many values it has.
            if (isset($rule['min'])) {
              $last = strrpos($rule['path'], '.');
              $entries = $last === FALSE ? self::at($object, $rule['path'], $index) : array_filter(
                self::at($object, substr($rule['path'], 0, $last), $index),
                static fn (mixed $entry): bool => self::at($entry, substr($rule['path'], $last + 1), $index) !== [],
              );
              if (count($entries) < $rule['min']) {
                $missing[] = $fact($rule['path'], $at);
              }
              continue;
            }
            foreach (self::at($object, $rule['path'], $index) as $found) {
              $passes = match (TRUE) {
                isset($rule['gt']) => is_numeric($found) && $found > $rule['gt'],
                isset($rule['is']) => $found === $rule['is'],
                // A description that only repeats the title says nothing.
                isset($rule['differs']) => !is_string($found) || mb_strtolower(trim(strip_tags($found))) !== mb_strtolower(trim((string) (self::at($object, $rule['differs'], $index)[0] ?? ''))),
                default => TRUE,
              };
              if (!$passes) {
                $missing[] = $fact($rule['path'], $at);
                break;
              }
            }
          }
          // Only what the page's scope can fill helps: a recipe page has no
          // ingredients to add.
          $helps = array_values(array_filter(
            array_map($fact, array_filter($feature['recommended'] ?? [], static fn (string $entry): bool => !$has($entry))),
            static fn (array $one): bool => !isset($one['prop'], $ctx['scope']) || self::prop($ctx['type'] ?? 'WebPage', $one['prop']) === NULL || self::offered($ctx['type'] ?? 'WebPage', $one['prop'], $ctx['scope']),
          ));
          $verdicts[] = $verdict + array_filter([
            'verdict' => $missing ? 'needs' : (isset($feature['complete']) ? 'complete' : 'ready'),
            'missing' => $missing,
            'helps' => $helps,
          ]);
        }
      }
    }
    if ($verdicts === []) {
      return [['feature' => NULL, 'node' => NULL, 'verdict' => 'none']];
    }
    usort($verdicts, static fn (array $a, array $b): int => array_search($a['verdict'], self::ORDER, TRUE) <=> array_search($b['verdict'], self::ORDER, TRUE));
    return $verdicts;
  }

  /**
   * The fact to ask for when a required entry is missing.
   *
   * Of a one-of entry: the one written with a value the feature does not
   * accept; else the first whose detail an answer has not ruled out (once
   * "Where the work is" is on site, the workplace's address, not the
   * question again); else the first.
   *
   * @param string|array $entry
   *   A required entry: a path, or a list of paths one of which is enough.
   * @param array $ctx
   *   See features(): type and gates.
   * @param callable(string): bool $written
   *   Whether the node has a value at a path.
   */
  private static function asked(string|array $entry, array $ctx, callable $written): string {
    $type = $ctx['type'] ?? 'WebPage';
    foreach ((array) $entry as $one) {
      if ($written($one)) {
        return $one;
      }
    }
    foreach ((array) $entry as $one) {
      $key = self::propOf(explode('|', $one)[0], $type);
      $first = self::types()[$type]['groups'][$key ?? '']['parts'][0] ?? NULL;
      $prop = $key === NULL ? NULL : self::prop($type, $key) ?? ($first === NULL ? NULL : self::prop($type, $first));
      $holds = $prop !== NULL;
      foreach ($prop['when'] ?? [] as $gate => $values) {
        $holds = $holds && in_array($ctx['gates'][$gate] ?? NULL, $values, TRUE);
      }
      if ($holds) {
        return $one;
      }
    }
    return ((array) $entry)[0];
  }

  /**
   * The rules a merged graph's hand-added items are checked against.
   *
   * @param array $graph
   *   The built graph.
   * @param array $ctx
   *   The key home: the public base followed by "/".
   * @param list<array> $nodes
   *   The report's `nodes`.
   *
   * @return list<array{rule: string, item: int, node: ?string, value?: string}>
   *   second_identity: a node that copies the site's identity; dangling: a
   *   reference to an item of this site that is not in the graph;
   *   own_reviews: a review or rating of the site's own organization;
   *   relative: an address that is not a full address.
   */
  public static function rules(array $graph, array $ctx, array $nodes): array {
    $list = $graph['@graph'] ?? [];
    $index = self::index($list);
    $identity = $index[$ctx['home'] . '#identity'] ?? [];
    $same = static fn (mixed $url): string => is_string($url) ? rtrim($url, '/') : '';
    $ours = array_filter(array_map($same, [$identity['url'] ?? '', ...(array) ($identity['sameAs'] ?? [])]));
    // Whether a node is the site's identity, or an organization of any type
    // with its address or one of its profiles.
    $other = self::notOrganization(...);
    $is_us = static function (mixed $node) use ($identity, $ours, $same, $other): bool {
      if (!is_array($node)) {
        return FALSE;
      }
      if (($node['@id'] ?? NULL) === ($identity['@id'] ?? FALSE)) {
        return TRUE;
      }
      $urls = array_map($same, [$node['url'] ?? '', ...(array) ($node['sameAs'] ?? [])]);
      return !$other($node) && array_intersect(array_filter($urls), $ours) !== [];
    };
    $found = [];
    // Hand-added items, and the module's nodes details were added to (item
    // -1).
    foreach ($nodes as $entry) {
      if (!isset($entry['at']) || ($entry['origin'] !== 'hand' && empty($entry['extended']))) {
        continue;
      }
      $entry['item'] ??= -1;
      $node = $list[$entry['at']];
      $hit = static fn (string $rule, ?string $value = NULL): array => [
        'rule' => $rule,
        'item' => $entry['item'],
        'node' => $entry['id'],
      ] + ($value === NULL ? [] : ['value' => $value]);
      $name = is_string($node['name'] ?? NULL) ? mb_strtolower(trim($node['name'])) : NULL;
      if ($entry['origin'] === 'hand' && ((array_intersect((array) $node['@type'], self::WHO) && $name !== NULL && $name === mb_strtolower(trim((string) ($identity['name'] ?? ''))))
        || (!$other($node) && $same($node['url'] ?? NULL) !== '' && $same($node['url'] ?? NULL) === $same($identity['url'] ?? NULL)))) {
        $found[] = $hit('second_identity');
      }
      foreach (self::objects($node) as [$object]) {
        $subject = match (TRUE) {
          array_intersect((array) $object['@type'], ['Review', 'AggregateRating']) !== [] => self::follow($object['itemReviewed'] ?? NULL, $index),
          isset($object['review']) || (isset($object['aggregateRating']) && !in_array('EmployerAggregateRating', (array) ($object['aggregateRating']['@type'] ?? []), TRUE)) => $object,
          default => NULL,
        };
        if ($is_us($subject)) {
          $found[] = $hit('own_reviews');
          break;
        }
      }
      foreach (self::strings($node) as [$key, $value, $bare]) {
        // A bare reference to an item of this site that is not in the graph.
        if ($bare && str_starts_with($value, $ctx['home']) && !isset($index[$value])) {
          $found[] = $hit('dangling', $value);
        }
        elseif (in_array($key, ['url', 'image', 'sameAs'], TRUE) && !Values::isHttpUrl($value)) {
          $found[] = $hit('relative', $value);
        }
      }
    }
    return array_values(array_unique($found, SORT_REGULAR));
  }

  /**
   * Whether a node is known not to be an organization or a person.
   *
   * A page or the site, and every type the registry describes (a product,
   * an event, an article), may carry the site's address; any other type
   * with it, such as a restaurant, is taken for an organization.
   */
  private static function notOrganization(array $node): bool {
    foreach (array_filter((array) ($node['@type'] ?? []), 'is_string') as $type) {
      if ($type === 'WebSite' || str_ends_with($type, 'Page') || (isset(self::types()[$type]) && !in_array($type, self::WHO, TRUE))) {
        return TRUE;
      }
    }
    return FALSE;
  }

  /**
   * Resolves one value of a property; NULL when it is empty or not valid.
   *
   * @param string $type
   *   The type id.
   * @param array $prop
   *   The property.
   * @param string|array|null $resolved
   *   What its value gave: text, or an image array.
   * @param array $ctx
   *   See build().
   * @param string|null $unit
   *   The unit a linked duration's field counts in.
   */
  private static function value(string $type, array $prop, string|array|null $resolved, array $ctx, ?string $unit = NULL): string|array|null {
    if ($prop['kind'] === 'image') {
      if (!is_array($resolved) || !isset($resolved['url'])) {
        return NULL;
      }
      // The page's own image is referenced, not repeated.
      if (isset($ctx['image']['url']) && $ctx['image']['url'] === $resolved['url']) {
        return ['@id' => $ctx['url'] . '#primaryimage'];
      }
      // A dimension that was never measured (0) is left out, not claimed.
      return self::node([
        '@type' => 'ImageObject',
        'url' => $resolved['url'],
        'width' => $resolved['width'] ?: NULL,
        'height' => $resolved['height'] ?: NULL,
      ]);
    }
    if (!empty($prop['html'])) {
      $html = self::filterHtml(is_string($resolved) ? $resolved : '');
      return $html === '' ? NULL : $html;
    }
    $value = Values::plain(is_string($resolved) ? $resolved : '', 2000);
    if (isset($prop['unit']) && $value !== '') {
      // A linked duration counts in the unit its field was answered with;
      // 1.5 hours is 90 minutes.
      if (!is_numeric($value) || (float) $value <= 0) {
        return NULL;
      }
      $minutes = (int) round((float) $value * self::UNITS[$unit ?? $prop['unit']]);
      return $minutes > 0 && $minutes <= self::DURATION_MAX ? self::duration($minutes) : NULL;
    }
    // A country code in either case is the code: "fi" is "FI".
    if (isset($prop['codes'])) {
      $value = strtoupper(trim($value));
    }
    if ($value === '' || !self::literal(array_diff_key($prop, ['list' => TRUE]), $value)) {
      return NULL;
    }
    // A time is written with its seconds, typed or linked: 18:00:00.
    if ($prop['kind'] === 'date' && preg_match('/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?!:)(.*)$/D', $value, $time)) {
      $value = "$time[1]:00$time[2]";
    }
    return match ($prop['kind']) {
      'enum' => match ($prop['emit'] ?? 'url') {
        'url' => 'https://schema.org/' . $value,
        default => $value,
      },
      // A time without an offset is in the site's default timezone.
      'date' => preg_match(self::DATE, $value, $m) && ($m[4] ?? '') !== '' && ($m[5] ?? '') === ''
        ? $value . (new \DateTimeImmutable($value, new \DateTimeZone($ctx['timezone'] ?? 'UTC')))->format('P')
        : $value,
      'number' => isset($prop['format']) ? str_replace('{n}', $value, $prop['format']) : $value,
      'hours' => self::hoursNodes((array) self::hours($value), (string) ($ctx['today'] ?? '')) ?: NULL,
      default => $value,
    };
  }

  /**
   * Sets a value at a property key's path, creating the typed nodes on it.
   *
   * "offers_priceCurrency" is the path offers > priceCurrency; schema.org
   * names contain no underscore.
   */
  private static function put(array &$node, string $key, mixed $value, array $nested): void {
    $path = explode('_', $key);
    $leaf = array_pop($path);
    $at = &$node;
    $prefix = '';
    foreach ($path as $segment) {
      $prefix = ltrim("{$prefix}_$segment", '_');
      $at[$segment] ??= ['@type' => $nested[$prefix] ?? 'Thing'];
      $at = &$at[$segment];
    }
    $at[$leaf] = $value;
  }

  /**
   * Prepares hand-added JSON-LD, or added details, for one page.
   *
   * Strings are filled: the fixed names anywhere in a text; a whole-value
   * field link ("{field.field_score}") or media item ("{media.‹uuid›}") as
   * the whole value, else kept as written. A short id of the site's own
   * items ("#identity") points at it from any page; another "#name" is on
   * the page's address. A nested object with one of the module's ids is a
   * bare reference, or left out when that node is not in the graph. A value
   * a fill empties is left out, and so is an object it leaves with nothing
   * but its type, id and rating bounds, and an emptied list; each is
   * reported (`empty`: {item|extend, path, name, status}).
   *
   * @param array $ctx
   *   See build(): home, url, facts and `fill`, callable(string $name,
   *   string $expects): array{0: string, 1: mixed}, which reads a field link
   *   of the item being output as the shape the name expects (status ok,
   *   empty, hidden or broken). Text that starts with a refused scheme is
   *   broken.
   * @param array<string, true> $ours
   *   Every id the module emits.
   * @param array<string, true> $present
   *   The ids of the module's nodes in this graph.
   * @param callable $value
   *   See build(): reads a media item as an image.
   * @param array $report
   *   The report: `empty` and `cut` are added to.
   *
   * @return \Closure(mixed, bool, array, ?string=): mixed
   *   Takes a value, whether it is a top-level item, where it is ({item} or
   *   {extend} and `path`) and its key; gives the value to emit, or NULL.
   */
  private static function preparer(array $ctx, array $ours, array $present, callable $value, array &$report): \Closure {
    $facts = $ctx['facts'] ?? [];
    $fill = $ctx['fill'] ?? NULL;
    $bounds = ['@type' => TRUE, '@id' => TRUE, 'bestRating' => TRUE, 'worstRating' => TRUE];
    $prepare = static function (mixed $v, bool $top, array $where, ?string $key = NULL) use (&$prepare, &$report, $ctx, $ours, $present, $value, $facts, $fill, $bounds): mixed {
      if (is_string($v)) {
        if (preg_match('/^\{media\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}$/D', $v, $m)) {
          $image = $value(['media' => $m[1]], 'image');
          if (is_array($image) && isset($image['url'])) {
            return $image['url'];
          }
          $report['empty'][] = $where + ['name' => "media.$m[1]", 'status' => 'gone'];
          return NULL;
        }
        if (preg_match('/^\{field\.([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)?)\}$/D', $v, $m)) {
          [$status, $filled] = $fill === NULL ? ['broken', NULL] : $fill($m[1], self::expects($key ?? ''));
          // Filled text passes the rule typed text passes when it is saved.
          if ($status === 'ok' && is_string($filled) && Values::scheme($filled) !== NULL) {
            $status = 'broken';
          }
          if ($status === 'ok' && $filled !== NULL && $filled !== '') {
            if (is_string($filled) && mb_strlen($filled) > self::FILL_MAX) {
              $report['cut'][] = $where;
              $filled = self::cutAtWord($filled, self::FILL_MAX);
            }
            return $filled;
          }
          $report['empty'][] = $where + ['name' => "field.$m[1]", 'status' => $status === 'ok' ? 'empty' : $status];
          return NULL;
        }
        return Values::fillFacts($v, $facts);
      }
      if (!is_array($v)) {
        return $v;
      }
      if (is_string($v['@id'] ?? NULL) && str_starts_with($v['@id'], '#')) {
        $v['@id'] = ((self::MODULE_IDS[substr($v['@id'], 1)] ?? NULL) === 'home' ? $ctx['home'] : $ctx['url']) . $v['@id'];
      }
      if (!$top && isset($v['@id'], $ours[$v['@id']])) {
        if (isset($present[$v['@id']])) {
          return ['@id' => $v['@id']];
        }
        $report['empty'][] = $where + ['name' => $v['@id'], 'status' => 'absent'];
        return NULL;
      }
      $list = array_is_list($v);
      $result = [];
      foreach ($v as $k => $item) {
        if (!$list && str_starts_with((string) $k, '@')) {
          $result[$k] = $item;
          continue;
        }
        $child = $prepare($item, FALSE, ['path' => [...$where['path'], $k]] + $where, $list ? $key : (string) $k);
        if ($child !== NULL) {
          $result[$k] = $child;
        }
      }
      if ($list) {
        return $result === [] && $v !== [] ? NULL : array_values($result);
      }
      // An object a fill emptied: a rating with only its bounds left.
      if (!$top && count($result) < count($v) && !array_diff_key($result, $bounds)) {
        return NULL;
      }
      return $result;
    };
    return $prepare;
  }

  /**
   * Merges added details into one of the module's nodes, per leaf.
   *
   * Objects merge at any depth. A value the module emits is kept and the
   * clash reported; a list it emits takes only "‹list›[*]" (every item) and
   * "‹list›[name=‹name›]" (the item with that name). @type only grows.
   *
   * @param array $node
   *   The module's node.
   * @param array $added
   *   The prepared details.
   * @param string $name
   *   The node's short id: "#primary", "#webpage" or "#identity".
   * @param list<string> $path
   *   Where in the node.
   * @param string|null $type
   *   The registry type, for the main node: a clash names its detail.
   * @param array $report
   *   The report: `added`, `clashes`, `unmatched` and `type_added` grow
   *   (a type added inside the node names its path: "#primary offers").
   */
  public static function merge(array &$node, array $added, string $name, array $path, ?string $type, array &$report): void {
    $object = static fn (mixed $v): bool => is_array($v) && !array_is_list($v) && !(count($v) === 1 && isset($v['@id']));
    foreach ($added as $key => $value) {
      $key = (string) $key;
      $at = [...$path, $key];
      if ($key === '@type') {
        // An object of the module's may have no type of its own.
        $had = (array) ($node['@type'] ?? []);
        $types = array_values(array_unique([...$had, ...(array) $value]));
        if (count($types) > count($had)) {
          $node['@type'] = count($types) === 1 ? $types[0] : $types;
          $report['type_added'][] = $path ? $name . ' ' . implode('.', $path) : $name;
        }
        continue;
      }
      if (str_starts_with($key, '@')) {
        continue;
      }
      if (preg_match('/^(.+)\[(\*|name=(.+))\]$/sD', $key, $m)) {
        $list = $node[$m[1]] ?? NULL;
        $single = $object($list);
        $items = $single ? [$list] : (is_array($list) && array_is_list($list) ? $list : []);
        $hit = FALSE;
        foreach ($items as $i => $item) {
          if ($object($item) && $object($value) && ($m[2] === '*' || ($item['name'] ?? NULL) === $m[3])) {
            self::merge($items[$i], $value, $name, $at, NULL, $report);
            $hit = TRUE;
          }
        }
        if ($hit) {
          $node[$m[1]] = $single ? $items[0] : $items;
        }
        else {
          $report['unmatched'][] = ['node' => $name, 'path' => implode('.', $at)];
        }
        continue;
      }
      if (!array_key_exists($key, $node)) {
        $node[$key] = $value;
        $report['added'][] = ['node' => $name, 'path' => implode('.', $at)];
        continue;
      }
      if ($object($node[$key]) && $object($value)) {
        self::merge($node[$key], $value, $name, $at, $type, $report);
        continue;
      }
      if ($node[$key] !== $value) {
        $dotted = implode('.', $at);
        $prop = $type === NULL ? NULL : self::propOf($dotted, $type);
        $report['clashes'][] = ['node' => $name, 'path' => $dotted] + ($prop === NULL ? [] : ['prop' => $prop]);
      }
    }
  }

  /**
   * What the rules file says a name's value must look like, or ''.
   */
  public static function expects(string $name): string {
    $spec = self::searchFeatures()['expects'][$name] ?? '';
    return is_array($spec) ? (string) ($spec['is'] ?? '') : (string) $spec;
  }

  /**
   * The path of an entry whose values are all of another shape, and that shape.
   *
   * @param string|array $entry
   *   A required entry: a path, "a|b", or a list of either.
   * @param array $object
   *   The object judged.
   * @param array $index
   *   The graph's nodes by @id.
   * @param array $expects
   *   The feature's own `expects`, by path or name; the file's by name.
   *
   * @return array{0: string, 1: string|array}|null
   *   NULL when a value fits, or nothing is expected of it.
   */
  private static function misfit(string|array $entry, array $object, array $index, array $expects): ?array {
    $first = NULL;
    foreach ((array) $entry as $one) {
      foreach (explode('|', $one) as $path) {
        $values = self::at($object, $path, $index);
        if ($values === []) {
          continue;
        }
        $name = substr($path, (int) strrpos(".$path", '.'));
        $spec = $expects[$path] ?? $expects[$name] ?? self::searchFeatures()['expects'][$name] ?? '';
        if ($spec === '' || array_filter($values, static fn (mixed $value): bool => self::fits($value, $spec, $index))) {
          return NULL;
        }
        $first ??= [$path, $spec];
      }
    }
    return $first;
  }

  /**
   * Whether a value has the shape a spec of the rules file names.
   *
   * @param mixed $value
   *   The value, references followed.
   * @param string|array $spec
   *   "text", "number|text", "date|datetime", "url|item:ImageObject",
   *   "enum:InStock|OutOfStock", "item:Person|Organization", or {is,
   *   needs}: the names an item must carry.
   * @param array $index
   *   The graph's nodes by @id.
   */
  public static function fits(mixed $value, string|array $spec, array $index = []): bool {
    $is = is_array($spec) ? (string) ($spec['is'] ?? '') : $spec;
    $value = self::follow($value, $index);
    // "item:Person|Organization": a kind, then the names it lists.
    $kinds = [];
    foreach (explode('|', $is) as $token) {
      if (str_contains($token, ':')) {
        [$kind, $name] = explode(':', $token, 2);
        $kinds[] = [$kind, [$name]];
      }
      elseif ($kinds !== [] && ctype_upper($token[0] ?? '') && in_array(end($kinds)[0], ['item', 'enum'], TRUE)) {
        $kinds[array_key_last($kinds)][1][] = $token;
      }
      elseif ($token !== '') {
        $kinds[] = [$token, []];
      }
    }
    foreach ($kinds as [$kind, $names]) {
      $fits = match ($kind) {
        'text' => is_string($value),
        'number' => is_int($value) || is_float($value) || (is_string($value) && is_numeric($value)),
        'url' => is_string($value) && Values::isHttpUrl($value),
        'date', 'datetime' => is_string($value) && preg_match(self::DATE, $value, $m) && ($kind === 'date' || ($m[4] ?? '') !== '' || str_contains($is, 'date|')),
        'duration' => is_string($value) && preg_match('/^P(?=\d|T\d)/', $value),
        'bool' => is_bool($value),
        'enum' => is_string($value) && in_array(preg_replace('~^https?://schema\.org/~', '', $value), $names, TRUE),
        'item' => is_array($value) && !array_is_list($value) && self::isA((array) ($value['@type'] ?? []), $names)
          && !array_filter((array) (is_array($spec) ? $spec['needs'] ?? [] : []), static fn (string $need): bool => self::at($value, $need, $index) === []),
        default => TRUE,
      };
      if ($fits) {
        return TRUE;
      }
    }
    return $kinds === [];
  }

  /**
   * Whether one of some types is one of others, or a kind of one.
   *
   * By the rules file's `subtypes`; "Thing" is any type.
   */
  public static function isA(array $types, array $of): bool {
    $subtypes = self::searchFeatures()['subtypes'] ?? [];
    foreach ($of as $one) {
      if (in_array('*', $subtypes[$one] ?? [], TRUE) || array_intersect($types, [$one, ...$subtypes[$one] ?? []])) {
        return TRUE;
      }
    }
    return FALSE;
  }

  /**
   * A text cut at a word boundary to at most $max characters.
   */
  public static function cutAtWord(string $text, int $max): string {
    $cut = mb_substr($text, 0, $max + 1);
    if (mb_strlen($cut) <= $max) {
      return $cut;
    }
    $space = mb_strrpos(mb_substr($cut, 0, $max + 1), ' ');
    return rtrim(mb_substr($cut, 0, $space === FALSE || $space === 0 ? $max : $space));
  }

  /**
   * The values at a dotted path, following references inside the graph.
   *
   * A list on the way gives each of its items.
   *
   * @return list<mixed>
   *   The non-empty values found.
   */
  private static function at(mixed $node, string $path, array $index): array {
    $values = [$node];
    foreach (explode('.', $path) as $segment) {
      $next = [];
      foreach ($values as $value) {
        $value = self::follow($value, $index);
        foreach (is_array($value) && array_is_list($value) ? $value : [$value] as $item) {
          $item = self::follow($item, $index);
          if (is_array($item) && array_key_exists($segment, $item)) {
            $found = $item[$segment];
            array_push($next, ...(is_array($found) && array_is_list($found) ? $found : [$found]));
          }
        }
      }
      $values = $next;
    }
    $values = array_map(static fn (mixed $value): mixed => self::follow($value, $index), $values);
    return array_values(array_filter($values, static fn (mixed $value): bool => $value !== NULL && $value !== '' && $value !== []));
  }

  /**
   * Whether any of the "a|b" alternatives of an entry resolves.
   */
  private static function has(array $object, string $entry, array $index, array $accepts = []): bool {
    return (bool) array_filter(explode('|', $entry), static fn (string $path): bool => array_filter(
      self::at($object, $path, $index),
      static fn (mixed $value): bool => !isset($accepts[$path]) || in_array($value, $accepts[$path], TRUE),
    ) !== []);
  }

  /**
   * The node a bare reference points at, when it is in the graph.
   */
  private static function follow(mixed $value, array $index): mixed {
    return is_array($value) && count($value) === 1 && is_string($value['@id'] ?? NULL) && isset($index[$value['@id']])
      ? $index[$value['@id']]
      : $value;
  }

  /**
   * The nodes of a list by @id.
   */
  private static function index(array $nodes): array {
    $index = [];
    foreach ($nodes as $node) {
      if (is_string($node['@id'] ?? NULL)) {
        $index[$node['@id']] ??= $node;
      }
    }
    return $index;
  }

  /**
   * A node and every typed object inside it, not following references.
   *
   * @return \Generator<array{0: array, 1: bool}>
   *   The object, and whether it is nested.
   */
  private static function objects(array $node, bool $nested = FALSE): \Generator {
    if (is_string($node['@type'] ?? NULL) || (is_array($node['@type'] ?? NULL) && $node['@type'] !== [])) {
      yield [$node, $nested];
    }
    foreach ($node as $key => $value) {
      if (is_array($value) && !str_starts_with((string) $key, '@')) {
        yield from self::objects($value, TRUE);
      }
    }
  }

  /**
   * Every string inside a value, with its key.
   *
   * @return \Generator<array{0: int|string, 1: string, 2: bool}>
   *   The key, the string, and whether it is the @id of a bare reference.
   */
  private static function strings(array $value): \Generator {
    foreach ($value as $key => $item) {
      if (is_string($item)) {
        yield [$key, $item, $key === '@id' && count($value) === 1];
      }
      elseif (is_array($item)) {
        foreach (self::strings($item) as [$inner, $text, $bare]) {
          // A list of addresses keeps the key it is the value of.
          yield [is_int($inner) ? $key : $inner, $text, $bare];
        }
      }
    }
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

  /**
   * A data file of the module, decoded.
   */
  private static function data(string $name): array {
    return json_decode((string) file_get_contents(dirname(__DIR__) . "/data/$name.json"), TRUE, 32, JSON_THROW_ON_ERROR);
  }

}
