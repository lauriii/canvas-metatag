<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\canvas\PropExpressions\StructuredData\FieldPropExpression;
use Drupal\canvas\PropExpressions\StructuredData\Labeler;
use Drupal\canvas\PropExpressions\StructuredData\ReferencePropExpressionInterface;
use Drupal\canvas\PropExpressions\StructuredData\StructuredDataPropExpressionInterface as Expr;
use Drupal\canvas\PropSource\EntityFieldPropSource;
use Drupal\canvas\PropSource\PropSource;
use Drupal\canvas\ShapeMatcher\PropSourceSuggester;
use Drupal\canvas\TypedData\BetterEntityDataDefinition;
use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Cache\Cache;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Cache\CacheBackendInterface;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Config\Entity\ConfigEntityInterface;
use Drupal\Core\Access\AccessResultInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Entity\TypedData\EntityDataDefinition;
use Drupal\Core\Field\FieldDefinitionInterface;
use Drupal\Core\Http\Exception\CacheableAccessDeniedHttpException;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\language\ConfigurableLanguageManagerInterface;
use Drupal\Core\Session\AccountSwitcherInterface;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Core\Theme\Component\ComponentMetadata;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * The fields a template value can link to, as Canvas entity-field sources.
 *
 * The only class that may use Canvas's prop source, shape matching and
 * expression classes (BoundaryTest). Everything Canvas-shaped is decided here:
 * which sources a bundle offers, how a stored source is evaluated, and when it
 * is broken. Values and SchemaGraph never see Canvas's grammar.
 *
 * @internal
 */
final class Sources {

  /**
   * One optional prop per value shape, and the kind of value it gives.
   *
   * Canvas offers a field for a prop when the field can fill it; the module
   * asks once per shape it can emit.
   */
  private const SHAPES = [
    'text' => [['type' => 'string'], 'text'],
    'texts' => [['type' => 'array', 'items' => ['type' => 'string']], 'text'],
    'html' => [['type' => 'string', 'contentMediaType' => 'text/html', 'x-formatting-context' => 'block'], 'text'],
    'htmls' => [
      [
        'type' => 'array',
        'items' => ['type' => 'string', 'contentMediaType' => 'text/html', 'x-formatting-context' => 'block'],
      ],
      'text',
    ],
    'address' => [['type' => 'string', 'format' => 'uri-reference'], 'address'],
    'addresses' => [['type' => 'array', 'items' => ['type' => 'string', 'format' => 'uri-reference']], 'address'],
    'datetime' => [['type' => 'string', 'format' => 'date-time'], 'date'],
    'datetimes' => [['type' => 'array', 'items' => ['type' => 'string', 'format' => 'date-time']], 'date'],
    'date' => [['type' => 'string', 'format' => 'date'], 'date'],
    'number' => [['type' => 'number'], 'number'],
    'image' => [['type' => 'object', '$ref' => 'json-schema-definitions://canvas.module/image'], 'image'],
  ];

  /**
   * The image object Canvas offers, and the same object read through the file.
   *
   * Through the file entity, file access is checked and `src` is the stored
   * URI, which the module makes public itself.
   */
  private const IMAGE_FROM = '{src↠src_with_alternate_widths,alt↠alt,width↠width,height↠height}';
  private const IMAGE_TO = '{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}';

  /**
   * Fields offered only as a fact, or never.
   *
   * The owner and revision authors (visitors may not view accounts), the
   * dates and the title (facts).
   */
  private const LEFT_OUT = ['title', 'created', 'changed', 'uid', 'revision_uid', 'revision_user', 'canvas_metatag'];

  /**
   * Anonymous access to each host, while reading() runs.
   *
   * @var \WeakMap<\Drupal\Core\Entity\ContentEntityInterface, \Drupal\Core\Access\AccessResultInterface>|null
   */
  private ?\WeakMap $held = NULL;

  public function __construct(
    private readonly PropSourceSuggester $suggester,
    private readonly EntityFieldManagerInterface $entityFieldManager,
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly LanguageManagerInterface $languageManager,
    private readonly AccountSwitcherInterface $accountSwitcher,
    private readonly ConfigFactoryInterface $configFactory,
    #[Autowire(service: 'cache.default')]
    private readonly CacheBackendInterface $cache,
    // Typed as any backend: while updates run, every bin is an update
    // backend that keeps nothing.
    #[Autowire(service: 'cache.memory')]
    private readonly CacheBackendInterface $memory,
    private readonly TimeInterface $time,
    #[Autowire(param: 'app.root')]
    private readonly string $root,
    private readonly LoggerChannelFactoryInterface $loggers,
  ) {}

  /**
   * The sources a node bundle offers, in the order of its form.
   *
   * @param string $bundle
   *   The node type.
   * @param bool $strict
   *   Fail when Canvas could not suggest, instead of giving no sources.
   * @param \Drupal\Core\Cache\CacheableMetadata|null $cacheability
   *   What uses the result: while Canvas cannot suggest, it may be kept only
   *   until the next try.
   *
   * @return array<string, array{label: string, path: list<string>, field: string, hop: bool, kinds: list<string>, html?: true, decimal?: true, shown?: string, names?: true, many?: true, lines?: true}>
   *   By expression. `path`: the labels of the hops, entity type hops left
   *   out. `hop`: the source follows a reference. `html`: the value is
   *   formatted text. `decimal`: the module's own row for a decimal field,
   *   read as its stored digits. `shown`: the
   *   expression whose value names a stored list key, and `storage` the
   *   cache tag of that list's field storage, which translates its labels.
   *   `names`: it is the referenced item's own name. `many`: a field of
   *   several values. `lines`: one long plain text, which gives its lines
   *   to a list. `timestamp`: a number that is a point in time. `scale`: a
   *   decimal's digits after the point. `named`: the values a whole plain
   *   or formatted text field is named for (Values::isNamedFor()):
   *   `description`, `title`.
   *
   * @throws \Throwable
   *   With $strict, when Canvas could not suggest: an update that converts
   *   links must fail, so that it can run again, rather than drop them.
   */
  public function vocabulary(string $bundle, bool $strict = FALSE, ?CacheableMetadata $cacheability = NULL): array {
    $langcode = $this->languageManager->getCurrentLanguage()->getId();
    $cid = "canvas_metatag:sources:node:$bundle:$langcode";
    $tags = [
      'entity_field_info',
      'config:media_type_list',
      'config:entity_form_display_list',
      "config:core.entity_form_display.node.$bundle.default",
    ];
    // Read once per request (a head reads it per linked value, the state per
    // row); the memory copy goes with the same tags.
    $cached = $this->memory->get($cid) ?: $this->cache->get($cid);
    // FALSE: Canvas could not suggest a moment ago.
    if ($cached !== FALSE && !($strict && $cached->data === FALSE)) {
      $this->memory->set($cid, $cached->data, (int) $cached->expire, $tags);
      return $this->rows($cached->data, (int) $cached->expire, $cacheability);
    }
    $expire = Cache::PERMANENT;
    try {
      $rows = $this->build($bundle);
    }
    catch (\Throwable $e) {
      if ($strict) {
        throw $e;
      }
      // Canvas could not suggest (a field it still knows of is gone): every
      // link reads as broken, never a failed page. Said once, and tried again
      // in five minutes or when a field changes.
      $this->loggers->get('canvas_metatag')->warning('The fields of @bundle could not be listed: @message', [
        '@bundle' => $bundle,
        '@message' => $e->getMessage(),
      ]);
      $rows = FALSE;
      $expire = $this->time->getRequestTime() + 300;
    }
    $this->cache->set($cid, $rows, $expire, $tags);
    $this->memory->set($cid, $rows, $expire, $tags);
    return $this->rows($rows, $expire, $cacheability);
  }

  /**
   * The values a whole plain or formatted text field is named for.
   *
   * Values::isNamedFor() on its label as stored, never as translated for the
   * interface: one field is named for a value in every language, so that the
   * head of each language and the menu of every editor agree.
   *
   * @return list<string>
   *   Of `description` and `title`.
   */
  public function namedFor(FieldDefinitionInterface $definition): array {
    if (!in_array($definition->getType(), Values::NAMED_TYPES, TRUE)) {
      return [];
    }
    $label = $definition instanceof ConfigEntityInterface
      ? (string) $this->configFactory->get($definition->getConfigDependencyName())->getOriginal('label', FALSE)
      : $definition->getLabel();
    $label = $label instanceof TranslatableMarkup ? $label->getUntranslatedString() : (string) $label;
    return array_values(array_filter(['description', 'title'], static fn (string $value): bool => Values::isNamedFor($value, $definition->getName(), $label)));
  }

  /**
   * The rows of a kept vocabulary; FALSE, Canvas could not suggest.
   *
   * What is built from no rows then is kept only until the next try.
   */
  private function rows(array|false $rows, int $expire, ?CacheableMetadata $cacheability): array {
    if ($rows === FALSE) {
      $left = $expire === Cache::PERMANENT ? 300 : max(1, $expire - $this->time->getRequestTime());
      $cacheability?->mergeCacheMaxAge($left);
    }
    return $rows ?: [];
  }

  /**
   * Whether a write may store this source for a value of this kind.
   */
  public function accepts(string $bundle, array $source, string $kind): bool {
    return self::wellShaped($source) && $this->problem($bundle, $source, $kind) === NULL;
  }

  /**
   * Whether a row gives a value of a kind.
   *
   * `words`, the form of a place that composes: text, a date or a number,
   * read for people. `line`: the same without long text, for a part of a
   * title-like place.
   */
  private static function fits(array $row, string $kind): bool {
    return match ($kind) {
      'words' => (bool) array_intersect(['text', 'date', 'number'], $row['kinds']),
      'line' => !isset($row['html']) && (bool) array_intersect(['text', 'date', 'number'], $row['kinds']),
      default => in_array($kind, $row['kinds'], TRUE),
    };
  }

  /**
   * Why a stored source cannot be used for a value of this kind.
   *
   * @return 'missing'|'kind'|'error'|null
   *   `missing`: its field is gone; `kind`: it no longer gives this kind of
   *   value; `error`: anything else that keeps it from being read.
   */
  public function problem(string $bundle, array $source, string $kind): ?string {
    $row = $this->vocabulary($bundle)[$source['expression'] ?? ''] ?? NULL;
    if ($row !== NULL && ($source['sourceType'] ?? '') === 'entity-field') {
      return self::fits($row, $kind) ? NULL : 'kind';
    }
    $field = self::machineName($source);
    return $field === NULL || !isset($this->entityFieldManager->getFieldDefinitions('node', $bundle)[$field]) ? 'missing' : 'error';
  }

  /**
   * The machine name of the host field a source starts from, when readable.
   */
  public static function machineName(array $source): ?string {
    return is_string($source['expression'] ?? NULL) && preg_match('/^ℹ︎␜entity:[a-z0-9_]+(?::[a-z0-9_]+)?␝([a-z0-9_]+)␞/u', $source['expression'], $m) ? $m[1] : NULL;
  }

  /**
   * Whether a value is the shape of a stored source, whatever it points at.
   */
  public static function wellShaped(mixed $source): bool {
    return is_array($source)
      && count($source) === 2
      && ($source['sourceType'] ?? NULL) === 'entity-field'
      && is_string($source['expression'] ?? NULL)
      && $source['expression'] !== '';
  }

  /**
   * The source a field gave as a whole value before sources existed.
   *
   * @param string $bundle
   *   The node type.
   * @param string $field
   *   The field's machine name.
   * @param string $kind
   *   The kind of value it fills.
   * @param bool $strict
   *   See vocabulary().
   *
   * @return array{sourceType: string, expression: string}|null
   *   The first source of that field and kind, one that stays on the host
   *   first, else one that ends at the referenced entity's label; NULL when
   *   the field offers none. For `words`, among those of each standing,
   *   text before a date before a number.
   */
  public function sourceFor(string $bundle, string $field, string $kind, bool $strict = FALSE): ?array {
    $best = NULL;
    $rank = PHP_INT_MAX;
    foreach ($this->vocabulary($bundle, $strict) as $expression => $row) {
      if ($row['field'] !== $field || !self::fits($row, $kind)) {
        continue;
      }
      $this_rank = (!$row['hop'] ? 0 : (isset($row['names']) ? 1 : 2)) * 3 + match (TRUE) {
        $kind !== 'words' && $kind !== 'line', in_array('text', $row['kinds'], TRUE) => 0,
        in_array('date', $row['kinds'], TRUE) => 1,
        default => 2,
      };
      if ($this_rank < $rank) {
        [$best, $rank] = [$expression, $this_rank];
      }
    }
    return $best === NULL ? NULL : ['expression' => $best, 'sourceType' => 'entity-field'];
  }

  /**
   * Evaluates a stored source for a host.
   *
   * When anonymous visitors may view the host, the source is read as an
   * anonymous visitor and only cache tags and max-age are kept: the head of a
   * published node never varies by user. Otherwise it is read with the
   * current user's access (a node being built previews its fields); such a
   * head is only ever shown to users who may view it.
   *
   * @param array $source
   *   The stored source.
   * @param \Drupal\Core\Entity\ContentEntityInterface $host
   *   The node.
   * @param string $kind
   *   The kind of value wanted.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the value depends on.
   * @param bool $list
   *   Every item in field order, instead of the first. One formatted text
   *   gives its own list items, else its paragraphs; one plain text its
   *   lines.
   * @param string|null $langcode
   *   The `words` form: the language a text list's labels are read in; NULL
   *   for the host's own (a referencing page passes its own).
   *
   * @return array{0: 'ok'|'empty'|'hidden'|'broken', 1: string|array|null}
   *   The status and the value: a string, for an image the array
   *   {uri, alt, width, height}, for formatted text (the html kind) the
   *   stored markup; with $list a list of those. Addresses are returned as
   *   stored; the resolver puts them on the public base. The ref kind gives
   *   the list of referenced entities (targets()). The `words` form gives
   *   `{items, as, scale}`: the machine value of every item visitors may
   *   see, in field order, and how to read them for people (`as`: date,
   *   timestamp, decimal, number, html or text; a text list gives its
   *   label in the host's language). Formatting is the Resolver's (Words).
   */
  public function evaluate(array $source, ContentEntityInterface $host, string $kind, CacheableMetadata $cacheability, bool $list = FALSE, ?string $langcode = NULL): array {
    $row = self::wellShaped($source) ? $this->vocabulary($host->bundle(), FALSE, $cacheability)[$source['expression']] ?? NULL : NULL;
    if ($row === NULL || !self::fits($row, $kind)) {
      return ['broken', NULL];
    }
    if ($kind === 'ref') {
      return $this->targets($row['field'], $host, $cacheability);
    }
    if ($kind === 'words' || $kind === 'line') {
      return $this->words($source['expression'], $row, $host, $cacheability, $langcode ?? $host->language()->getId());
    }
    [$status, $value] = $this->read($source['expression'], $host, $cacheability);
    if ($status !== 'ok') {
      return [$status, NULL];
    }
    if (!$list) {
      $value = $this->normalize($value, $kind, $row);
      return [$value === NULL || $value === '' ? 'empty' : 'ok', $value];
    }
    $items = array_values(array_filter(is_array($value) && array_is_list($value) ? $value : [$value], static fn (mixed $item): bool => $item !== NULL && $item !== '' && $item !== []));
    // Only one long text is split: a field of several values that holds one
    // gives it whole, as it would with two. Text that is not valid UTF-8
    // gives nothing.
    if ($kind === 'text' && count($items) === 1 && is_scalar($items[0]) && (isset($row['lines']) || (isset($row['html']) && !isset($row['many'])))) {
      $items = isset($row['html']) ? Values::items((string) $items[0]) : (preg_split('/\R+/u', trim((string) $items[0])) ?: []);
      $row = array_diff_key($row, ['html' => TRUE]);
    }
    $items = array_values(array_filter(array_map(fn (mixed $item): string|array|null => $this->normalize($item, $kind, $row, TRUE), $items), static fn (mixed $item): bool => $item !== NULL && $item !== ''));
    return [$items === [] ? 'empty' : 'ok', $items];
  }

  /**
   * Every item of a source visitors may see, as machine values to read.
   *
   * A field of several values on the host is read item by item, so that an
   * item visitors may not see (a referenced page that is unpublished) is
   * left out and the others are kept.
   *
   * @return array{0: 'ok'|'empty'|'hidden'|'broken', 1: array{items: list<string>, as: string, scale: int}|null}
   *   See evaluate().
   */
  private function words(string $expression, array $row, ContentEntityInterface $host, CacheableMetadata $cacheability, string $langcode): array {
    $as = match (TRUE) {
      in_array('date', $row['kinds'], TRUE) => 'date',
      isset($row['timestamp']) => 'timestamp',
      isset($row['decimal']) => 'decimal',
      in_array('number', $row['kinds'], TRUE) && !in_array('text', $row['kinds'], TRUE) => 'number',
      isset($row['html']) => 'html',
      default => 'text',
    };
    // A text list gives its label in the host's language (or a referencing
    // page's), from its field storage and that storage's translation. Not
    // Canvas's label: it is read in the language of the interface, which a
    // public head never varies by, and kept for the request.
    $labels = $this->labels($row, $langcode);
    $read = $labels === NULL ? ($row['shown'] ?? $expression) : $expression;
    if (isset($row['storage'])) {
      $cacheability->addCacheTags([$row['storage']]);
    }
    $expressions = [$read];
    // One read per item of a field of several values on the host, at most
    // 50: a delta in the expression.
    $marker = "␝{$row['field']}␞␟";
    if (isset($row['many']) && $host->hasField($row['field']) && str_contains($read, $marker)) {
      $count = min(50, $host->get($row['field'])->count());
      $expressions = [];
      for ($delta = 0; $delta < $count; $delta++) {
        $expressions[] = preg_replace('/' . preg_quote($marker, '/') . '/u', "␝{$row['field']}␞{$delta}␟", $read, 1);
      }
    }
    $items = [];
    $hidden = FALSE;
    foreach ($expressions as $one) {
      [$status, $value] = $this->read($one, $host, $cacheability);
      if ($status === 'broken') {
        return ['broken', NULL];
      }
      $hidden = $hidden || $status === 'hidden';
      foreach (is_array($value) && array_is_list($value) ? $value : [$value] as $item) {
        $item = is_scalar($item) || $item instanceof \Stringable ? (string) $item : NULL;
        if ($item === NULL || trim($item) === '') {
          continue;
        }
        $items[] = match (TRUE) {
          $labels !== NULL => $labels[$item] ?? $item,
          $as === 'date' => $this->date($item),
          $as === 'decimal' => (string) self::digits($item),
          default => $item,
        };
      }
    }
    $items = array_values(array_filter($items, static fn (string $item): bool => $item !== ''));
    if ($items === []) {
      return [$hidden ? 'hidden' : 'empty', NULL];
    }
    return ['ok', ['items' => $items, 'as' => $as, 'scale' => (int) ($row['scale'] ?? 0)]];
  }

  /**
   * A text list's labels by key, in a language; NULL when it has none.
   *
   * From its field storage, with that language's translation of it over it.
   * A list whose options come from a function has none here.
   */
  private function labels(array $row, string $langcode): ?array {
    if (!isset($row['storage'])) {
      return NULL;
    }
    $name = substr($row['storage'], strlen('config:'));
    $allowed = $this->configFactory->get($name)->getOriginal('settings.allowed_values', FALSE);
    if (!is_array($allowed) || $allowed === []) {
      return NULL;
    }
    $translated = $this->languageManager instanceof ConfigurableLanguageManagerInterface
      ? $this->languageManager->getLanguageConfigOverride($langcode, $name)->get('settings.allowed_values')
      : NULL;
    $labels = [];
    foreach ($allowed as $at => $option) {
      $label = $translated[$at]['label'] ?? $option['label'] ?? NULL;
      if (isset($option['value']) && is_scalar($label)) {
        $labels[(string) $option['value']] = (string) $label;
      }
    }
    return $labels;
  }

  /**
   * The entities a host's reference field holds.
   *
   * The field is read as an anonymous visitor whatever the host. Each
   * target's translation and access are Resolver::target()'s: a page a
   * visitor may not see is never named.
   *
   * @return array{0: 'ok'|'empty'|'hidden'|'broken', 1: list<\Drupal\Core\Entity\EntityInterface>|null}
   *   The status and the targets in field order.
   */
  public function targets(string $field, ContentEntityInterface $host, CacheableMetadata $cacheability): array {
    if (!$host->hasField($field)) {
      return ['broken', NULL];
    }
    $items = $host->get($field);
    $anonymous = new AnonymousUserSession();
    $access = $items->access('view', $anonymous, TRUE);
    $cacheability->addCacheableDependency($access);
    if (!$access->isAllowed()) {
      return ['hidden', NULL];
    }
    $targets = array_values(array_filter(array_map(static fn (object $item): mixed => $item->entity ?? NULL, iterator_to_array($items))));
    return [$targets === [] ? 'empty' : 'ok', $targets];
  }

  /**
   * The value a list source shows: the label of the stored key.
   */
  public function shown(array $source, ContentEntityInterface $host, CacheableMetadata $cacheability): ?string {
    $row = $this->vocabulary($host->bundle(), FALSE, $cacheability)[$source['expression'] ?? ''] ?? NULL;
    if (!isset($row['shown'])) {
      return NULL;
    }
    [$status, $value] = $this->read($row['shown'], $host, $cacheability);
    $value = $status === 'ok' ? $this->normalize($value, 'text', []) : NULL;
    return is_string($value) && $value !== '' ? $value : NULL;
  }

  /**
   * Builds the vocabulary of a bundle.
   */
  private function build(string $bundle): array {
    $props = [];
    foreach (self::SHAPES as $name => [$schema]) {
      $props[$name] = $schema + ['title' => $name];
    }
    $metadata = new ComponentMetadata([
      'id' => 'canvas_metatag:value',
      'path' => 'modules/contrib/canvas_metatag',
      'name' => 'SEO value',
      'props' => ['type' => 'object', 'properties' => $props],
    ], $this->root, FALSE);
    $host = EntityDataDefinition::createFromDataType("entity:node:$bundle");
    $definitions = $this->entityFieldManager->getFieldDefinitions('node', $bundle);
    $suggestions = $this->suggester->suggest('canvas_metatag:value', $metadata, $host);

    // Canvas orders the suggestions of each prop by the form; across props a
    // field keeps the place it first had.
    $rows = [];
    $order = array_flip(array_keys($definitions));
    foreach ($suggestions as $prop => $suggested) {
      $shape = self::SHAPES[substr($prop, strrpos($prop, '␟') + 3)] ?? NULL;
      foreach ($shape === NULL ? [] : $suggested['entity-field'] as $source) {
        assert($source instanceof EntityFieldPropSource);
        if (isset($source->toArray()['adapter'])) {
          continue;
        }
        $expression = (string) $source->expression;
        $field = $source->expression->getFieldName();
        $kind = $shape[1];
        if (!self::offered($expression, $field, $kind, $definitions)) {
          continue;
        }
        $stored = $expression;
        $shown = NULL;
        // Formatted text is read as stored, never as its filters render it:
        // a filter could render entities for the current user into a cached,
        // shared head.
        $html = str_ends_with($expression, '␞␟processed') || str_ends_with($expression, '␞␟summary_processed');
        if ($html) {
          $stored = (string) preg_replace('/␟(summary_)?processed$/u', '␟$1value', $expression);
          $stored = str_replace('␟summary_value', '␟summary', $stored);
        }
        // A text list gives its stored key; its label is what the dialog
        // shows.
        if (str_ends_with($expression, '␞␟label') && str_starts_with((string) $this->leafType($source->expression), 'list_')) {
          $stored = substr($expression, 0, -strlen('label')) . 'value';
          $shown = $expression;
        }
        if ($kind === 'image') {
          $stored = str_replace(self::IMAGE_FROM, self::IMAGE_TO, $expression);
        }
        // A timestamp offered as a number reads as a date in words.
        $leaf = $this->leaf($source->expression);
        $timestamp = $kind === 'number' && in_array($leaf?->getType(), ['timestamp', 'created', 'changed'], TRUE);
        if (isset($rows[$stored])) {
          $rows[$stored]['kinds'] = array_values(array_unique([...$rows[$stored]['kinds'], $kind]));
          $rows[$stored] += $timestamp ? ['timestamp' => TRUE] : [];
          continue;
        }
        $path = self::path($source, $host);
        if (str_ends_with($expression, '␞␟summary_processed')) {
          // Read as stored: the summary, not its processed form.
          $path[array_key_last($path)] = 'Summary';
        }
        $hop = $source->expression instanceof ReferencePropExpressionInterface;
        $rows[$stored] = [
          'label' => '',
          'path' => $path,
          'field' => $field,
          'hop' => $hop,
          'kinds' => [$kind],
          'weight' => [$order[$field] ?? PHP_INT_MAX, count($rows)],
        ] + ($html ? ['html' => TRUE] : []) + ($shown !== NULL ? ['shown' => $shown] : []) +
          ($timestamp ? ['timestamp' => TRUE] : []) +
          // A label in text is translated with its field storage.
          ($shown !== NULL && $leaf !== NULL ? ['storage' => "config:field.storage.{$leaf->getTargetEntityTypeId()}.{$leaf->getName()}"] : []) +
          // The referenced item's own name.
          ($hop && preg_match('/␝(?:title|name)␞␟value$/u', $stored) ? ['names' => TRUE] : []);
      }
    }

    // A decimal is never matched by Canvas (JSON numbers lose its digits).
    // The module reads it as its stored digits.
    foreach ($definitions as $name => $definition) {
      if ($definition->getType() === 'decimal' && !$definition->getFieldStorageDefinition()->isBaseField()) {
        $expression = (string) new FieldPropExpression(BetterEntityDataDefinition::create('node', $bundle), $name, NULL, 'value');
        $rows[$expression] ??= [
          'label' => '',
          'path' => [(string) $definition->getLabel()],
          'field' => $name,
          'hop' => FALSE,
          'kinds' => ['number'],
          'weight' => [$order[$name], count($rows)],
          'decimal' => TRUE,
          'scale' => (int) $definition->getFieldStorageDefinition()->getSetting('scale'),
        ];
      }
    }

    foreach ($rows as $expression => &$row) {
      // Formatted text also gives its markup, for a job description; a
      // reference to content, by its own name, also gives the page it is.
      if (isset($row['html'])) {
        $row['kinds'][] = 'html';
      }
      if (isset($row['names']) && preg_match('/␞␟entity␜␜entity:(?:node|canvas_page)[␝:]/u', $expression)) {
        $row['kinds'][] = 'ref';
      }
      // A field of several values gives each on a list; one long plain text
      // its lines.
      if (($definitions[$row['field']] ?? NULL)?->getFieldStorageDefinition()->getCardinality() !== 1) {
        $row['many'] = TRUE;
      }
      elseif (!$row['hop'] && ($definitions[$row['field']] ?? NULL)?->getType() === 'string_long') {
        $row['lines'] = TRUE;
      }
      // The values a whole text field is named for: the link menu lists it
      // first for them, by the rule the Description fact reads it by.
      $named = !$row['hop'] && count($row['path']) === 1 && isset($definitions[$row['field']]) ? $this->namedFor($definitions[$row['field']]) : [];
      if ($named !== []) {
        $row['named'] = $named;
      }
    }
    unset($row);

    // The form's order, as Canvas uses it: Canvas has ordered each prop's
    // suggestions by the form, and a field keeps its first place.
    $display = $this->entityTypeManager->getStorage('entity_form_display')->load("node.$bundle.default");
    $weights = [];
    foreach ($rows as $expression => $row) {
      $component = $display?->getComponent($row['field']);
      $weights[$expression] = [$component === NULL ? 1 : 0, (int) ($component['weight'] ?? 0), ...$row['weight']];
    }
    uksort($rows, static fn (string $a, string $b): int => $weights[$a] <=> $weights[$b]);
    foreach ($rows as &$row) {
      unset($row['weight']);
      $row['label'] = implode(' › ', $row['path']);
    }
    return $rows;
  }

  /**
   * Whether a suggestion is offered, by the module's exclusions.
   */
  private static function offered(string $expression, string $field, string $kind, array $definitions): bool {
    if (in_array($field, self::LEFT_OUT, TRUE) || ($definitions[$field] ?? NULL)?->getType() === 'comment') {
      return FALSE;
    }
    // Paths through an account: visitors may not view accounts.
    if (preg_match('/␝(?:uid|revision_uid|revision_user)␞/u', $expression)) {
      return FALSE;
    }
    // Canvas's computed addresses (a reference's URL, a link's resolved URL)
    // keep the value and access of the first account that read them: never
    // offered. A link is read through its `uri`.
    if (str_ends_with($expression, '␞␟url')) {
      return FALSE;
    }
    return match ($kind) {
      // A file's own address is not a page address; an image is offered as
      // an image.
      'address' => !str_contains($expression, 'entity:file') && !str_ends_with($expression, 'src_with_alternate_widths'),
      // Only an image whose size is its own.
      'image' => str_ends_with($expression, self::IMAGE_FROM),
      default => TRUE,
    };
  }

  /**
   * The labels along a source, without the entity type hops.
   *
   * @return list<string>
   *   "Writer", "Name" for a writer's name.
   */
  private static function path(EntityFieldPropSource $source, EntityDataDefinition $host): array {
    try {
      $label = (string) Labeler::flatten(Labeler::label($source->expression, $host), [
        Expr::PREFIX_ENTITY_LEVEL => "\x1E",
        Expr::PREFIX_FIELD_LEVEL => "\x1F",
        Expr::PREFIX_FIELD_ITEM_LEVEL => "\x1F",
        Expr::PREFIX_PROPERTY_LEVEL => "\x1F",
      ]);
    }
    catch (\Throwable) {
      // Canvas's flat label, entity type hops included.
      $label = str_replace(' → ', "\x1F", (string) $source->label($host));
    }
    $label = (string) preg_replace('/\x1E[^\x1F]*/', '', $label);
    return array_values(array_filter(array_map('trim', explode("\x1F", $label)), 'strlen'));
  }

  /**
   * The field type a source ends at.
   */
  private function leafType(Expr $expression): ?string {
    return $this->leaf($expression)?->getType();
  }

  /**
   * The definition of the field a source ends at.
   */
  private function leaf(Expr $expression): ?FieldDefinitionInterface {
    while ($expression instanceof ReferencePropExpressionInterface) {
      $expression = $expression->getTargetExpression();
    }
    if (!method_exists($expression, 'getHostEntityDataDefinition') || !method_exists($expression, 'getFieldName')) {
      return NULL;
    }
    $definition = $expression->getHostEntityDataDefinition();
    $bundles = $definition->getBundles() ?? [];
    $fields = $this->entityFieldManager->getFieldDefinitions((string) $definition->getEntityTypeId(), (string) (reset($bundles) ?: $definition->getEntityTypeId()));
    return $fields[$expression->getFieldName()] ?? NULL;
  }

  /**
   * Reads an expression for a host, by the account rule.
   *
   * @return array{0: 'ok'|'hidden'|'broken', 1: mixed}
   *   The status and Canvas's value.
   */
  private function read(string $expression, ContentEntityInterface $host, CacheableMetadata $cacheability): array {
    // Asked once per host while reading() runs; else each time: a host may
    // be published or unpublished between two reads in a long-running
    // process.
    if ($this->held !== NULL) {
      $anonymous = $this->held[$host] ?? NULL;
      $anonymous ??= $this->held[$host] = $this->hostAccess($host);
    }
    else {
      $anonymous = $this->hostAccess($host);
    }
    $public = $anonymous->isAllowed();
    $cacheability
      ->addCacheTags([...$anonymous->getCacheTags(), 'config:user.role.anonymous'])
      ->setCacheMaxAge(Cache::mergeMaxAges($cacheability->getCacheMaxAge(), $anonymous->getCacheMaxAge()));
    $keep = static function (object $result) use ($public, $cacheability): void {
      $result = CacheableMetadata::createFromObject($result);
      if ($public) {
        // Tags and max-age only: what an anonymous visitor may see does not
        // vary by the user who asks.
        $cacheability->addCacheTags($result->getCacheTags())
          ->setCacheMaxAge(Cache::mergeMaxAges($cacheability->getCacheMaxAge(), $result->getCacheMaxAge()));
        return;
      }
      $cacheability->addCacheableDependency($result);
    };
    if ($public) {
      $this->accountSwitcher->switchTo(new AnonymousUserSession());
    }
    try {
      $result = PropSource::parse(['sourceType' => 'entity-field', 'expression' => $expression])->evaluate($host, FALSE);
      $keep($result);
      return ['ok', $result->value];
    }
    catch (CacheableAccessDeniedHttpException $denied) {
      $keep($denied);
      return ['hidden', NULL];
    }
    catch (\Throwable) {
      // An unknown field, a wrong bundle, a delta or a locked language, a
      // malformed string: never a failed page.
      return ['broken', NULL];
    }
    finally {
      if ($public) {
        $this->accountSwitcher->switchBack();
      }
    }
  }

  /**
   * Runs a function that reads sources, asking access to each host once.
   *
   * A head reads every field of a composition, in several places: whether
   * anonymous visitors may view the host is asked once for all of them.
   *
   * @param callable(): T $read
   *   What reads.
   *
   * @return T
   *   What it returns.
   *
   * @template T
   */
  public function reading(callable $read): mixed {
    $outer = $this->held === NULL;
    $this->held ??= new \WeakMap();
    try {
      return $read();
    }
    finally {
      if ($outer) {
        $this->held = NULL;
      }
    }
  }

  /**
   * Whether anonymous visitors may view the host.
   */
  private function hostAccess(ContentEntityInterface $host): AccessResultInterface {
    // A Canvas draft shares its entity's UUID, and so the access cache entry.
    $this->entityTypeManager->getAccessControlHandler($host->getEntityTypeId())->resetCache();
    return $host->access('view', new AnonymousUserSession(), TRUE);
  }

  /**
   * Canvas's value as a value of the module's kind.
   *
   * @param mixed $value
   *   What Canvas gave.
   * @param string $kind
   *   The kind of value wanted.
   * @param array $row
   *   The source's row.
   * @param bool $whole
   *   An item of a list: formatted text gives all its text, not its start.
   */
  private function normalize(mixed $value, string $kind, array $row, bool $whole = FALSE): string|array|null {
    // A list gives its first item that is not empty.
    while (is_array($value) && array_is_list($value)) {
      $value = array_values(array_filter($value, static fn (mixed $item): bool => $item !== NULL && $item !== '' && $item !== []))[0] ?? NULL;
    }
    if ($kind === 'image') {
      return is_array($value) && is_string($value['src'] ?? NULL) ? [
        'uri' => $value['src'],
        'alt' => is_string($value['alt'] ?? NULL) ? $value['alt'] : '',
        'width' => (int) ($value['width'] ?? 0),
        'height' => (int) ($value['height'] ?? 0),
      ] : NULL;
    }
    if (!is_scalar($value) && !$value instanceof \Stringable) {
      return NULL;
    }
    $value = is_bool($value) ? ($value ? '1' : '0') : (string) $value;
    return match ($kind) {
      // Formatted text gives its start, as the Description fact does; an
      // item of a list all its text; a job description its markup.
      'text' => isset($row['html']) ? ($whole ? Values::fromHtml($value) : Values::excerpt(Values::fromHtml($value))) : $value,
      'html' => $value,
      'date' => $this->date($value),
      'number' => isset($row['decimal']) ? self::digits($value) : $value,
      default => $value,
    };
  }

  /**
   * A stored decimal as its exact digits, never through a float.
   *
   * Trailing zeros go: a database may give "89.990000" or "89.99" for the
   * same stored price, which is 89.99.
   */
  private static function digits(string $value): ?string {
    if (!preg_match('/^(-?\d+)(?:\.(\d*))?$/D', $value, $match)) {
      return is_numeric($value) ? $value : NULL;
    }
    $fraction = rtrim($match[2] ?? '', '0');
    return $fraction === '' ? $match[1] : "$match[1].$fraction";
  }

  /**
   * A stored date as ISO 8601 in the site's timezone; a date-only stays one.
   */
  private function date(string $value): string {
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value)) {
      return $value;
    }
    $time = is_numeric($value) ? (int) $value : strtotime(str_ends_with($value, 'Z') || preg_match('/[+-]\d\d:\d\d$/', $value) ? $value : $value . ' UTC');
    if ($time === FALSE) {
      return '';
    }
    $zone = (string) ($this->configFactory->get('system.date')->get('timezone.default') ?: 'UTC');
    return (new \DateTimeImmutable('@' . $time))->setTimezone(new \DateTimeZone($zone))->format('c');
  }

}
