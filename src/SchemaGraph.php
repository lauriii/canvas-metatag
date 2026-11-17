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
   * What a billing period is emitted as: its UN/CEFACT unit code.
   */
  private const BILLING = ['P1M' => 'MON', 'P1Y' => 'ANN'];

  /**
   * The verdicts, in the order the dialog lists them.
   */
  private const ORDER = ['needs', 'unanswered', 'ready', 'complete', 'not_fit', 'not_here', 'retired', 'none'];

  /**
   * Types a hand-added node may copy the site's identity's name with.
   *
   * By address any organization copies it, whatever its type: a restaurant
   * or a hotel with the site's address is the site (notOrganization()).
   */
  private const WHO = ['Organization', 'Person', 'LocalBusiness', 'Corporation', 'OnlineStore', 'Store', 'NGO'];

  /**
   * The registry with `extends` resolved.
   *
   * A variant takes its base's details, never its kind.
   *
   * @return array<string, array>
   *   Type id => entry.
   */
  public static function types(): array {
    static $types;
    if ($types === NULL) {
      $types = self::data('schema-types');
      foreach ($types as $id => $type) {
        if (isset($type['extends'])) {
          unset($type['extends']);
          $types[$id] = $type + array_diff_key($types[$types[$id]['extends']], ['kind' => TRUE, 'variants' => TRUE]);
        }
      }
    }
    return $types;
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
      'currency' => isset(self::currencies()[$value]),
      // An image is a media item, a fact or a link, never text.
      default => FALSE,
    };
    return $valid && (!isset($prop['pattern']) || preg_match('~' . $prop['pattern'] . '~uD', $value));
  }

  /**
   * The registry property a feature path is set with, for a type.
   *
   * "offers.price" is the property `offers_price`; the rules file names the
   * paths that are set another way.
   */
  public static function propOf(string $path, string $type): ?string {
    $key = self::searchFeatures()['props'][$path] ?? str_replace('.', '_', $path);
    return in_array($key, array_column(self::types()[$type]['props'] ?? [], 'key'), TRUE) ? $key : NULL;
  }

  /**
   * Assembles the @graph of one page.
   *
   * @param array $ctx
   *   The keys home, url, langcode, title, description, published, modified,
   *   timezone, currency (the site's, or ''), identity{kind, name, same_as[]},
   *   logo?{url, width, height}, image?{url, width, height, alt, source} and
   *   facts (name => text, the fixed names custom JSON-LD strings may use).
   *   `url` is the entity's own public URL, never a canonical override.
   * @param array $schema
   *   The effective `schema` value, cleaned.
   * @param callable(array, string): (string|array|null) $value
   *   What a value gives for this entity, by kind: text, or for the image
   *   kind an image array; '' or NULL for nothing.
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
   *   @graph, left_out: withheld, skip, reserved or duplicate}).
   */
  public static function build(array $ctx, array $schema, callable $value): array {
    $types = self::types();
    $stored_type = (string) ($schema['type'] ?? '');
    $type_id = isset($types[$stored_type]) ? $stored_type : 'WebPage';
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
    $report = [
      'withheld' => NULL,
      'dropped' => [],
      'sources' => [],
      'gates' => [],
      'type' => $type_id,
      'unknown_type' => $stored_type !== '' && !isset($types[$stored_type]) ? $stored_type : NULL,
      'nodes' => [],
    ];

    // The primary node first: the page node points at it only when it ships.
    $primary = NULL;
    if (isset($type['primary_type'])) {
      $primary = ['@type' => $type['primary_type'], '@id' => $ids['primary'], 'mainEntityOfPage' => $ref('webpage')];
      // A fixed ref first; one with a condition when the values are known.
      $refs = array_map(static fn (string|array $to): array => is_string($to) ? [
        'to' => $to,
        'fixed' => TRUE,
      ] : $to, $type['refs'] ?? []);
      foreach (array_filter($refs, static fn (array $to): bool => isset($to['fixed'])) as $key => $to) {
        self::put($primary, $key, $ref($to['to']), $type['nested'] ?? []);
      }
      $missing = $invalid = [];
      foreach ($type['props'] ?? [] as $prop) {
        $key = $prop['key'];
        $default = $prop['default'] ?? NULL;
        // The Description fact is the page's own description, as search shows
        // it, not the raw text it may have been cut from. A link that gives
        // nothing gives the default; one that gives a value that does not
        // fit leaves the detail out.
        $resolve = static fn (?array $v): string|array|null => $v === NULL ? NULL : (
          $v === ['fact' => 'description'] ? (string) ($ctx['description'] ?? '') : $value($v, Values::KINDS[$prop['kind']])
        );
        $raw = $resolve($schema['props'][$key] ?? NULL);
        $source = 'set';
        if ($raw === NULL || $raw === '') {
          [$raw, $source] = match (TRUE) {
            // An image chosen to share the page comes before the page's own.
            $default === ['fact' => 'image'] && ($page_image['source'] ?? '') === 'override' => [
              $page_image,
              'default',
            ],
            // The site currency, for a price: never an offer of nothing. The
            // registry lists a price before its currency.
            $prop['kind'] === 'currency' && isset($primary['offers']['price']) => [
              (string) ($ctx['currency'] ?? ''),
              'site',
            ],
            default => [$resolve($default), 'default'],
          };
        }
        $found = self::value($type_id, $prop, $raw, $ctx);
        $dropped = $found === NULL && is_string($raw) && trim($raw) !== '';
        if ($dropped) {
          $report['dropped'][] = ['key' => $key, 'value' => mb_substr($raw, 0, 200), 'kind' => $prop['kind']];
        }
        if ($found === NULL && ($prop['level'] ?? '') === 'required') {
          $dropped ? $invalid[] = $key : $missing[] = $key;
        }
        if ($found === NULL) {
          continue;
        }
        $report['sources'][$key] = $source;
        if (($prop['emit'] ?? TRUE) === FALSE) {
          // The clean value, as it was validated: " P1M" is "P1M".
          $report['gates'][$key] = $found;
          continue;
        }
        self::put($primary, $key, $found, $type['nested'] ?? []);
      }
      foreach (array_diff_key($refs, array_filter($refs, static fn (array $to): bool => isset($to['fixed']))) as $key => $to) {
        $holds = !isset($to['unless']) || !isset($report['sources'][$to['unless']]);
        foreach ($to['if'] ?? [] as $gate => $wanted) {
          $holds = $holds && ($report['gates'][$gate] ?? NULL) === $wanted;
        }
        if ($holds) {
          self::put($primary, $key, $ref($to['to']), $type['nested'] ?? []);
        }
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
      if ($missing || $invalid) {
        $report['withheld'] = ['missing' => $missing, 'dropped' => $invalid, 'node' => $primary];
        $report['nodes'][] = [
          'id' => $ids['primary'],
          'type' => $type['primary_type'],
          'origin' => 'main',
          'left_out' => 'withheld',
        ];
        $primary = NULL;
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
        'mainEntity' => $primary ? $ref('primary') : NULL,
      ]),
      'page:image' => $page_image ? self::imageNode($ids['primaryimage'], $page_image) + self::node(['caption' => $page_image['alt'] ?? '']) : NULL,
      'main' => $primary,
    ];
    // A withheld node is listed first, and takes no place in @graph.
    foreach (array_keys(array_filter($graph)) as $at => $origin) {
      $report['nodes'][] = [
        'id' => $graph[$origin]['@id'],
        'type' => $graph[$origin]['@type'],
        'origin' => strtok($origin, ':'),
        'at' => $at,
      ];
    }
    $graph = array_values(array_filter($graph));

    // Custom nodes can point at our nodes and can never replace or extend
    // them. ponytail: decoded as arrays, so an empty object or one with only
    // numeric keys is emitted as a list; the stored text keeps them apart.
    $custom = json_decode($schema['custom'] ?? '', TRUE);
    $skip = array_fill_keys($schema['skip'] ?? [], TRUE);
    $present = array_fill_keys(array_column($graph, '@id'), TRUE);
    $ours = $taken = array_fill_keys($ids, TRUE);
    foreach (is_array($custom) ? (array_is_list($custom) ? $custom : [$custom]) : [] as $item => $node) {
      if (!is_array($node) || !is_string($node['@type'] ?? NULL)) {
        continue;
      }
      $written = is_string($node['@id'] ?? NULL) ? $node['@id'] : NULL;
      $node = self::custom($node, TRUE, $ctx['url'], $ours, $present, $ctx['facts'] ?? []);
      $entry = ['id' => $node['@id'] ?? NULL, 'type' => $node['@type'], 'origin' => 'hand', 'item' => $item];
      $left_out = match (TRUE) {
        $written !== NULL && isset($skip[$written]) => 'skip',
        isset($node['@id'], $ours[$node['@id']]) => 'reserved',
        isset($node['@id'], $taken[$node['@id']]) => 'duplicate',
        default => NULL,
      };
      if ($left_out !== NULL) {
        $report['nodes'][] = $entry + ['left_out' => $left_out];
        continue;
      }
      if (isset($node['@id'])) {
        $taken[$node['@id']] = TRUE;
      }
      $report['nodes'][] = $entry + ['at' => count($graph)];
      $graph[] = $node;
    }

    return ['graph' => ['@context' => 'https://schema.org', '@graph' => $graph]] + $report;
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
   *   registry type), gates (the report's), extra (nodes to judge as if they
   *   were in the graph: the withheld main node).
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
          $object['@type'] === 'Review' => 'review',
          $object['@type'] === 'AggregateRating' => 'aggregateRating',
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
    foreach ($nodes as $top) {
      foreach (self::objects($top) as [$object, $nested]) {
        $id = is_string($object['@id'] ?? NULL) ? $object['@id'] : NULL;
        foreach ($id === NULL ? [] : $reviewed[$id] ?? [] as $as => $found) {
          $object[$as] ??= $found;
        }
        foreach ($rules['features'] as $name => $feature) {
          if (!in_array($object['@type'], $feature['on'], TRUE)) {
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
          $has = static fn (string|array $entry): bool => (bool) array_filter((array) $entry, static fn (string $one): bool => self::has($object, $one, $index));
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
              $seller !== NULL => ($seller[0]['@id'] ?? NULL) === $ours['identity'],
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
          if ($reason !== NULL) {
            $verdicts[] = $verdict + ['verdict' => 'not_fit', 'reason' => $reason];
            continue;
          }
          $missing = [];
          foreach ([...$feature['required'], ...$feature['complete'] ?? []] as $entry) {
            if (!$has($entry)) {
              $missing[] = $fact(is_array($entry) ? $entry[0] : $entry);
            }
          }
          foreach ($feature['rules'] ?? [] as $at => $rule) {
            foreach (self::at($object, $rule['path'], $index) as $found) {
              $passes = match (TRUE) {
                isset($rule['gt']) => is_numeric($found) && $found > $rule['gt'],
                isset($rule['is']) => $found === $rule['is'],
                default => TRUE,
              };
              if (!$passes) {
                $missing[] = $fact($rule['path'], $at);
                break;
              }
            }
          }
          $helps = array_values(array_map($fact, array_filter($feature['recommended'] ?? [], static fn (string $entry): bool => !$has($entry))));
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
    foreach ($nodes as $entry) {
      if ($entry['origin'] !== 'hand' || !isset($entry['at'])) {
        continue;
      }
      $node = $list[$entry['at']];
      $hit = static fn (string $rule, ?string $value = NULL): array => [
        'rule' => $rule,
        'item' => $entry['item'],
        'node' => $entry['id'],
      ] + ($value === NULL ? [] : ['value' => $value]);
      $name = is_string($node['name'] ?? NULL) ? mb_strtolower(trim($node['name'])) : NULL;
      if ((array_intersect((array) $node['@type'], self::WHO) && $name !== NULL && $name === mb_strtolower(trim((string) ($identity['name'] ?? ''))))
        || (!$other($node) && $same($node['url'] ?? NULL) !== '' && $same($node['url'] ?? NULL) === $same($identity['url'] ?? NULL))) {
        $found[] = $hit('second_identity');
      }
      foreach (self::objects($node) as [$object]) {
        $subject = match (TRUE) {
          in_array($object['@type'], ['Review', 'AggregateRating'], TRUE) => self::follow($object['itemReviewed'] ?? NULL, $index),
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
      'enum' => ($prop['emit'] ?? TRUE) === FALSE ? $value : 'https://schema.org/' . $value,
      // A time without an offset is in the site's default timezone.
      'date' => preg_match(self::DATE, $value, $m) && ($m[4] ?? '') !== '' && ($m[5] ?? '') === ''
        ? $value . (new \DateTimeImmutable($value, new \DateTimeZone($ctx['timezone'] ?? 'UTC')))->format('P')
        : $value,
      default => $value,
    };
  }

  /**
   * Sets a value at a property key's path, creating the typed nodes on it.
   *
   * "location_address_streetAddress" is the path location > address >
   * streetAddress; schema.org names contain no underscore.
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
  private static function has(array $object, string $entry, array $index): bool {
    return (bool) array_filter(explode('|', $entry), static fn (string $path): bool => self::at($object, $path, $index) !== []);
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
    if (is_string($node['@type'] ?? NULL)) {
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
