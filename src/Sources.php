<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\ComponentSource\ComponentSourceWithSwitchCasesInterface;
use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\PageRegion;
use Drupal\canvas\PageVariantResolver;
use Drupal\canvas\Plugin\Field\FieldType\ComponentTreeItem;
use Drupal\canvas\Plugin\Field\FieldType\ComponentTreeItemList;
use Drupal\canvas\PropExpressions\StructuredData\FieldPropExpression;
use Drupal\canvas\PropExpressions\StructuredData\Labeler;
use Drupal\canvas\PropExpressions\StructuredData\ReferencePropExpressionInterface;
use Drupal\canvas\PropExpressions\StructuredData\StructuredDataPropExpressionInterface as Expr;
use Drupal\canvas\PropSource\EntityFieldPropSource;
use Drupal\canvas\PropSource\PropSource;
use Drupal\canvas\ShapeMatcher\PropSourceSuggester;
use Drupal\canvas\Storage\ComponentTreeLoader;
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
   * The segment of visitors in no other segment (Segment::DEFAULT_ID).
   *
   * Canvas renders, for every visitor, the personalization case whose
   * segments hold it (Personalization::isNegotiatedCase()).
   */
  private const DEFAULT_SEGMENT = 'default';

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
    private readonly ComponentTreeLoader $treeLoader,
    private readonly PageVariantResolver $pageVariants,
    private readonly AutoSaveManager $autoSaveManager,
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
   * The host fields a content template's own components link.
   *
   * What a page rendered with the template shows of its node: the template
   * replaces the entity view display. Inside an adapted input too. Only
   * instances every visitor gets (instances()): a field linked only in a
   * personalized case is not what an anonymous visitor sees.
   *
   * @return array<string, true>
   *   By field machine name.
   */
  public function linked(ContentTemplate $template): array {
    $fields = [];
    $walk = static function (mixed $input) use (&$walk, &$fields): void {
      if (!is_array($input)) {
        return;
      }
      if (($input['sourceType'] ?? NULL) === 'entity-field' && ($field = self::machineName($input)) !== NULL) {
        $fields[$field] = TRUE;
      }
      foreach ($input as $inner) {
        $walk($inner);
      }
    };
    $tree = [
      'list' => $template->getComponentTree(),
      'owner' => 'template',
      'host' => NULL,
      'item' => [],
    ];
    [$instances] = $this->instances([$tree]);
    foreach ($instances as $instance) {
      try {
        $walk($instance['item']->getInputs());
      }
      catch (\Throwable) {
        // An instance whose inputs cannot be read renders nothing of them.
      }
    }
    return $fields;
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
   * Reads a source for a host, by the account rule.
   *
   * @param string|array $source
   *   An entity-field expression, or a whole stored prop source.
   * @param \Drupal\Core\Entity\ContentEntityInterface|null $host
   *   What the source is evaluated on: NULL for a component of the page's
   *   chrome, which has no host.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the value depends on.
   * @param \Drupal\Core\Entity\ContentEntityInterface|null $page
   *   The entity whose page shows the value, when it is not the host: whether
   *   anonymous visitors may view it decides the account.
   * @param \Drupal\Core\Cache\CacheableMetadata|null $dropped
   *   Gets the cache contexts left out of $cacheability when a value given is
   *   read as an anonymous visitor.
   *
   * @return array{0: 'ok'|'hidden'|'broken', 1: mixed}
   *   The status and Canvas's value.
   */
  private function read(string|array $source, ?ContentEntityInterface $host, CacheableMetadata $cacheability, ?ContentEntityInterface $page = NULL, ?CacheableMetadata $dropped = NULL): array {
    $page ??= $host;
    \assert($page !== NULL);
    $anonymous = $this->anonymousAccess($page);
    $public = $anonymous->isAllowed();
    $cacheability
      ->addCacheTags([...$anonymous->getCacheTags(), 'config:user.role.anonymous'])
      ->setCacheMaxAge(Cache::mergeMaxAges($cacheability->getCacheMaxAge(), $anonymous->getCacheMaxAge()));
    $keep = static function (object $result, bool $shown = TRUE) use ($public, $cacheability, $dropped): void {
      $result = CacheableMetadata::createFromObject($result);
      if ($public) {
        // Tags and max-age only: what an anonymous visitor may see does not
        // vary by the user who asks.
        $cacheability->addCacheTags($result->getCacheTags())
          ->setCacheMaxAge(Cache::mergeMaxAges($cacheability->getCacheMaxAge(), $result->getCacheMaxAge()));
        if ($shown) {
          $dropped?->addCacheContexts($result->getCacheContexts());
        }
        return;
      }
      $cacheability->addCacheableDependency($result);
    };
    if ($public) {
      $this->accountSwitcher->switchTo(new AnonymousUserSession());
    }
    try {
      $result = PropSource::parse(is_string($source) ? ['sourceType' => 'entity-field', 'expression' => $source] : $source)->evaluate($host, FALSE);
      $keep($result);
      return ['ok', $result->value];
    }
    catch (CacheableAccessDeniedHttpException $denied) {
      $keep($denied, FALSE);
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
   * Whether anonymous visitors may view a page.
   *
   * Asked once per page while reading() runs; else each time: a page may be
   * published or unpublished between two reads in a long-running process.
   */
  private function anonymousAccess(ContentEntityInterface $page): AccessResultInterface {
    if ($this->held === NULL) {
      return $this->hostAccess($page);
    }
    return $this->held[$page] ??= $this->hostAccess($page);
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
   * The component trees that render on an entity's page, with their owners.
   *
   * What Canvas renders: a Canvas page's own tree, or a node's template tree
   * with the node's own slot content injected as ContentTemplate::build()
   * does it; then the page variant the entity resolves to, else the default
   * theme's legacy page regions (CanvasPageVariant).
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface $entity
   *   A Canvas page (or its draft), or a node shown through its template.
   * @param bool $draft
   *   Read the drafts of the template and the page's chrome, as previews do.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the trees depend on.
   *
   * @return list<array{list: \Drupal\canvas\Plugin\Field\FieldType\ComponentTreeItemList, owner: 'page'|'template'|'region', host: ?\Drupal\Core\Entity\ContentEntityInterface, item: list<string>, draft: string}>
   *   Each tree with its owner, the entity its fields are read from (none
   *   for the page's chrome), the instances the node placed in its own slot
   *   (`item`) and, for a template or a part of the chrome read from its
   *   draft, the label of what the draft is of (`draft`, else '').
   *
   * @throws \Throwable
   *   When Canvas could not build a tree: its own rendering fails the same
   *   way.
   */
  public function tree(ContentEntityInterface $entity, bool $draft, CacheableMetadata $cacheability): array {
    $trees = [];
    $template = NULL;
    if ($entity->getEntityTypeId() === 'canvas_page') {
      $trees[] = [
        'list' => $this->treeLoader->load($entity),
        'owner' => 'page',
        'host' => $entity,
        'item' => [],
        'draft' => '',
      ];
    }
    else {
      $template = ContentTemplate::loadForEntity($entity, 'full');
      $drafted = '';
      if ($template !== NULL && $draft) {
        $auto_save = $this->autoSaveManager->getAutoSaveEntity($template);
        $cacheability->addCacheableDependency($auto_save);
        if ($auto_save->entity instanceof ContentTemplate) {
          $template = $auto_save->entity;
          $drafted = (string) $template->label();
        }
        // A template is previewed as if it were published.
        if (!$template->status()) {
          $template = (clone $template)->setStatus(TRUE);
        }
      }
      // Canvas renders no disabled template, nor the chrome it would pick.
      if ($template !== NULL && !$template->status()) {
        $cacheability->addCacheableDependency($template);
        $template = NULL;
      }
      if ($template !== NULL) {
        $cacheability->addCacheableDependency($template);
        $list = $template->getComponentTree($entity);
        $own = [];
        if ($template->getExposedSlots() !== []) {
          $slot = $this->treeLoader->load($entity);
          $own = array_column($slot->getValue(), 'uuid');
          $list->injectSubTreeItemList($template->getExposedSlots(), $slot);
        }
        $trees[] = ['list' => $list, 'owner' => 'template', 'host' => $entity, 'item' => $own, 'draft' => $drafted];
      }
    }
    // The page's chrome: the variant that resolves, else the legacy regions.
    $cacheability->addCacheableDependency($this->configFactory->get('canvas.settings'));
    $variant = $this->pageVariants->resolve($entity, $template);
    if ($variant !== NULL) {
      $cacheability->addCacheableDependency($variant);
      $drafted = '';
      // A preview shows the variant's draft when it is valid
      // (PageVariantResolver::resolve()): a change to it rebuilds the head.
      if ($draft) {
        $cacheability->addCacheableDependency($this->autoSaveManager->getAutoSaveEntity($variant));
        $preview = $this->pageVariants->resolvePreviewVariant($variant);
        $drafted = $preview !== $variant ? (string) $variant->label() : '';
        $variant = $preview;
      }
      $trees[] = self::chrome($variant->getComponentTree(), $drafted);
      return $trees;
    }
    $cacheability->addCacheTags($this->entityTypeManager->getDefinition('page_region')->getListCacheTags())
      ->addCacheTags(['config:system.theme']);
    foreach (PageRegion::loadForTheme((string) $this->configFactory->get('system.theme')->get('default')) as $region) {
      $cacheability->addCacheableDependency($region);
      // A preview shows a region's draft when it is valid, as
      // CanvasPageVariant does.
      $drafted = '';
      if ($draft) {
        $auto_save = $this->autoSaveManager->getAutoSaveEntity($region);
        $cacheability->addCacheableDependency($auto_save);
        if ($auto_save->entity instanceof PageRegion && count($auto_save->entity->getTypedData()->validate()) === 0) {
          $region = $auto_save->entity;
          $drafted = (string) $region->label();
        }
      }
      $trees[] = self::chrome($region->getComponentTree(), $drafted);
    }
    return $trees;
  }

  /**
   * A tree of the page's chrome, as tree() gives it.
   */
  private static function chrome(ComponentTreeItemList $list, string $draft): array {
    return ['list' => $list, 'owner' => 'region', 'host' => NULL, 'item' => [], 'draft' => $draft];
  }

  /**
   * The component instances that render, from tree().
   *
   * @param list<array{list: \Drupal\canvas\Plugin\Field\FieldType\ComponentTreeItemList, owner: string, host: ?\Drupal\Core\Entity\ContentEntityInterface, item: list<string>}> $tree
   *   What tree() gave.
   *
   * @return array{0: list<array{uuid: string, component: string, label: string, owner: string, version: string, item: \Drupal\canvas\Plugin\Field\FieldType\ComponentTreeItem, host: ?\Drupal\Core\Entity\ContentEntityInterface}>, 1: list<array{uuid: string, component: string, label: string, owner: string, reason: string}>}
   *   The instances in tree order, each with its component, its owner (page,
   *   template, item or region) and the version it was placed with; and
   *   those skipped, with their owner: a personalization case Canvas does
   *   not render for visitors in no segment (`personalized`), an instance
   *   whose component or version cannot be loaded (`error`). What is inside
   *   a skipped instance, or under a parent that is not there, does not
   *   render and is left out with it.
   */
  public function instances(array $tree): array {
    $instances = $skipped = [];
    foreach ($tree as $part) {
      $rows = [];
      foreach ($part['list'] as $item) {
        \assert($item instanceof ComponentTreeItem);
        $row = [
          'uuid' => (string) $item->get('uuid')->getValue(),
          'component' => (string) $item->get('component_id')->getValue(),
          'label' => '',
          'owner' => in_array($item->get('uuid')->getValue(), $part['item'], TRUE) ? 'item' : $part['owner'],
        ];
        // One instance that cannot be read costs only itself.
        try {
          $component = Component::load($row['component']);
          if (!$component instanceof Component) {
            throw new \UnexpectedValueException('No such component.');
          }
          $row['label'] = (string) $component->label();
          $version = $item->getComponentVersion();
          // Throws when the version it was placed with is gone.
          $component->getSettings($version);
          // Personalized content: only the case Canvas renders for visitors
          // in no segment is what every visitor gets.
          $source = $component->getComponentSource();
          if ($source instanceof ComponentSourceWithSwitchCasesInterface && $source->isCase() && !in_array(self::DEFAULT_SEGMENT, (array) ($item->getInputs()['segments'] ?? []), TRUE)) {
            $skipped[] = $row + ['reason' => 'personalized'];
            continue;
          }
        }
        catch (\Throwable $e) {
          $this->loggers->get('canvas_metatag')->warning('The component instance @uuid (@component) could not be read: @message', [
            '@uuid' => $row['uuid'],
            '@component' => $row['component'],
            '@message' => $e->getMessage(),
          ]);
          $skipped[] = $row + ['reason' => 'error'];
          continue;
        }
        $rows[$row['uuid']] = $row + [
          'version' => $version,
          'item' => $item,
          'host' => $part['host'],
          'parent' => $item->getParentUuid(),
        ];
      }
      // Until nothing is left whose parent is not there.
      do {
        $count = count($rows);
        $rows = array_filter($rows, static fn (array $row): bool => $row['parent'] === NULL || isset($rows[$row['parent']]));
      } while (count($rows) !== $count);
      foreach ($rows as $row) {
        unset($row['parent']);
        $instances[] = $row;
      }
    }
    return [$instances, $skipped];
  }

  /**
   * The values of some props of one instance, read against its own version.
   *
   * Each value is read by the account rule (read()), as linked values are:
   * as an anonymous visitor when anonymous visitors may view the page. An
   * image is read through its file (the same rewrite as a linked image),
   * never as the rendered address with its width; formatted text as stored.
   *
   * @param array $instance
   *   One of instances().
   * @param array<string, string> $kinds
   *   Prop name => the kind of value wanted: text, html, number, date,
   *   address or image.
   * @param \Drupal\Core\Entity\ContentEntityInterface $page
   *   The entity whose page the instance renders on.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the values depend on.
   *
   * @return array{0: array<string, array{0: 'ok'|'empty'|'hidden'|'broken', 1: mixed}>, 1: list<array{uuid: string, component: string, label: string, owner: string, reason: string, prop?: string, version?: string}>}
   *   By prop, the status and the value (see evaluate(); an address as
   *   stored, an image {uri, alt, width, height}); and what was skipped,
   *   with the instance's owner: a prop the instance's version lacks
   *   (`prop-missing`, with the prop and the version), a value visitors may
   *   not see (`access`, with the prop), the whole instance when it cannot
   *   be read (`error`) or when a value would make the head vary by user or
   *   session, or expire (`cacheability`). A skipped value gives nothing and
   *   adds nothing to $cacheability.
   */
  public function props(array $instance, array $kinds, ContentEntityInterface $page, CacheableMetadata $cacheability): array {
    $part = array_intersect_key($instance, array_flip(['uuid', 'component', 'label', 'owner']));
    $own = new CacheableMetadata();
    // What reading as an anonymous visitor left out of $own (read()).
    $dropped = new CacheableMetadata();
    $values = $skipped = [];
    try {
      $component = Component::load($instance['component']);
      \assert($component instanceof Component);
      $definitions = $component->getSettings($instance['version'])['prop_field_definitions'] ?? [];
      $inputs = $instance['item']->getInputs() ?? [];
      foreach ($kinds as $prop => $kind) {
        if (!isset($definitions[$prop])) {
          $skipped[] = $part + ['reason' => 'prop-missing', 'prop' => $prop, 'version' => $instance['version']];
          continue;
        }
        $values[$prop] = $this->input($inputs[$prop] ?? NULL, $definitions[$prop], $kind, $instance['host'], $page, $own, $dropped);
        if ($values[$prop][0] === 'hidden') {
          $skipped[] = $part + ['reason' => 'access', 'prop' => $prop];
        }
      }
    }
    catch (\Throwable $e) {
      $this->loggers->get('canvas_metatag')->warning('The component instance @uuid (@component) could not be read: @message', [
        '@uuid' => $part['uuid'],
        '@component' => $part['component'],
        '@message' => $e->getMessage(),
      ]);
      return [[], [$part + ['reason' => 'error']]];
    }
    // A head anonymous visitors get never varies by user or session, and
    // never expires, because of a component: read as an anonymous visitor,
    // a value that would is left out. A page they may not view is read as
    // the user who asks (read()), and its head is that user's.
    $varies = array_filter($dropped->getCacheContexts(), static fn (string $context): bool => $context === 'user' || str_starts_with($context, 'session'));
    if (($varies || $own->getCacheMaxAge() !== Cache::PERMANENT) && $this->anonymousAccess($page)->isAllowed()) {
      return [[], [...$skipped, $part + ['reason' => 'cacheability']]];
    }
    $cacheability->addCacheableDependency($own);
    return [$values, $skipped];
  }

  /**
   * One stored input as a value of a kind.
   *
   * A static input is stored bare; its source is the version's definition
   * of the prop, as Canvas builds it.
   */
  private function input(mixed $input, array $definition, string $kind, ?ContentEntityInterface $host, ContentEntityInterface $page, CacheableMetadata $cacheability, CacheableMetadata $dropped): array {
    if ($input === NULL || $input === [] || $input === '') {
      return ['empty', NULL];
    }
    $source = is_array($input) && isset($input['sourceType']) ? $input : [
      'sourceType' => 'static:field_item:' . $definition['field_type'],
      'value' => $input,
      'expression' => $definition['expression'],
      'sourceTypeSettings' => array_filter([
        'storage' => $definition['field_storage_settings'] ?? NULL,
        'instance' => $definition['field_instance_settings'] ?? NULL,
        'cardinality' => $definition['cardinality'] ?? NULL,
      ], static fn (mixed $setting): bool => $setting !== NULL),
    ];
    if (($source['sourceTypeSettings'] ?? NULL) === []) {
      unset($source['sourceTypeSettings']);
    }
    $row = [];
    if (is_string($source['expression'] ?? NULL)) {
      if ($kind === 'image') {
        $source['expression'] = str_replace(self::IMAGE_FROM, self::IMAGE_TO, $source['expression']);
      }
      // Formatted text as stored, never as its filters render it.
      if (preg_match('/␟processed$/u', $source['expression'])) {
        $source['expression'] = (string) preg_replace('/␟processed$/u', '␟value', $source['expression']);
        $row['html'] = TRUE;
      }
    }
    [$status, $value] = $this->read($source, $host, $cacheability, $page, $dropped);
    if ($status !== 'ok') {
      return [$status, NULL];
    }
    $value = $this->normalize($value, $kind, $row);
    return [$value === NULL || $value === '' ? 'empty' : 'ok', $value];
  }

  /**
   * Where a component is used, in what is live.
   *
   * @return array{content: int, templates: int}
   *   How many Canvas pages and other content items, in their default
   *   revisions, and how many content templates place it. An item with
   *   several component tree fields counts once.
   */
  public function usage(string $componentId): array {
    $content = 0;
    foreach ($this->entityFieldManager->getFieldMapByFieldType('component_tree') as $entity_type_id => $fields) {
      $storage = $this->entityTypeManager->getStorage($entity_type_id);
      $ids = [];
      foreach (array_keys($fields) as $field) {
        $ids += $storage->getQuery()->accessCheck(FALSE)->condition("$field.component_id", $componentId)->execute();
      }
      $content += count($ids);
    }
    $templates = array_filter(
      ContentTemplate::loadMultiple(),
      static fn (ContentTemplate $template): bool => in_array($componentId, $template->getComponentTree()->getComponentIdList(), TRUE),
    );
    return ['content' => $content, 'templates' => count($templates)];
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
