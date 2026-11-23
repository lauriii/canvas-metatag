<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas_headless\FrontendUrl;
use Drupal\Core\Access\AccessibleInterface;
use Drupal\Core\Cache\Cache;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\Display\EntityFormDisplayInterface;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityPublishedInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Entity\TranslatableInterface;
use Drupal\Core\Extension\ModuleHandlerInterface;
use Drupal\Core\Field\FieldDefinitionInterface;
use Drupal\Core\Field\FieldItemInterface;
use Drupal\Core\File\FileUrlGeneratorInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Language\LanguageInterface;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\Site\Settings;
use Drupal\Core\StreamWrapper\StreamWrapperManager;
use Drupal\Core\Url;
use Drupal\file\FileInterface;
use Drupal\media\MediaInterface;
use Drupal\media\Plugin\media\Source\Image;
use Drupal\path_alias\AliasManagerInterface;
use Drupal\user\EntityOwnerInterface;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Resolves the head of a Canvas page or a template-rendered node.
 *
 * The only producer of head output: both adapters and the dialog's state
 * route emit what resolve() returns.
 */
final class Resolver {

  /**
   * From this size an image makes a large card.
   *
   * The dialog's link preview uses the same rule (`smallCard()` in model.ts).
   */
  private const LARGE_CARD = ['width' => 600, 'height' => 157];

  /**
   * What the dialog calls the facts.
   */
  private const LABELS = [
    'title' => 'Title',
    'description' => 'Description',
    'site' => 'Site name',
    'url' => 'Page address',
    'author' => 'Author',
    'published' => 'First published',
    'modified' => 'Last updated',
    'image' => 'Image',
    'identity' => 'This site',
  ];

  /**
   * Results of resolve(), by entity object.
   *
   * Not by a string key: a stored page and its draft share id, langcode and
   * revision id. Each entry remembers its request and its draft flag.
   *
   * @var \WeakMap<\Drupal\Core\Entity\ContentEntityInterface, array{request: ?object, draft: bool, result: array}>
   */
  private \WeakMap $resolved;

  /**
   * The account every access check of a fact runs for.
   */
  private readonly AnonymousUserSession $anonymous;

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly ConfigFactoryInterface $configFactory,
    private readonly ModuleHandlerInterface $moduleHandler,
    private readonly RequestStack $requestStack,
    private readonly AutoSaveManager $autoSaveManager,
    private readonly EntityFieldManagerInterface $entityFieldManager,
    private readonly FileUrlGeneratorInterface $fileUrlGenerator,
    private readonly AliasManagerInterface $aliasManager,
    private readonly Sources $sources,
    private readonly LoggerChannelFactoryInterface $loggers,
    private readonly Words $words,
  ) {
    $this->resolved = new \WeakMap();
    $this->anonymous = new AnonymousUserSession();
  }

  /**
   * Whether this module provides the head of the entity.
   *
   * A Canvas page always; a node when its `full` content template is enabled.
   * With $draft an existing template counts even while it is disabled, which
   * is how Canvas itself previews a template that was never published.
   */
  public function owns(EntityInterface $entity, bool $draft = FALSE): bool {
    if ($entity->getEntityTypeId() === 'canvas_page') {
      return TRUE;
    }
    if ($entity->getEntityTypeId() !== 'node' || !$entity instanceof ContentEntityInterface) {
      return FALSE;
    }
    $template = ContentTemplate::loadForEntity($entity, 'full');
    return $template !== NULL && ($draft || $template->status());
  }

  /**
   * The layers of an entity, cleaned in read mode.
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface $entity
   *   A Canvas page (the stored one or its draft) or a node.
   * @param bool $draft
   *   Read the content template's Canvas draft where one exists.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the layers depend on.
   *
   * @return array{site: array, identity: array, target: array, from_default: array}
   *   `from_default` is non-empty only for a page translation that is not the
   *   default one: the three language-neutral settings of the default one.
   */
  public function layers(ContentEntityInterface $entity, bool $draft, CacheableMetadata $cacheability): array {
    $layers = array_diff_key($this->site($cacheability), ['currency' => TRUE]) + ['target' => [], 'from_default' => []];

    if ($entity->getEntityTypeId() === 'canvas_page') {
      $read = static fn (ContentEntityInterface $page, string $type = 'WebPage'): array => Values::clean(Values::decode($page->get('canvas_metatag')->value), 'page', NULL, $type)[0];
      if ($entity->isDefaultTranslation()) {
        $layers['target'] = $read($entity);
        return $layers;
      }
      $default = $entity->getUntranslated();
      if ($default->language()->getId() === $entity->language()->getId()) {
        // The draft of a translation that was never published holds that
        // translation only. Its default is the stored one.
        $default = $this->entityTypeManager->getStorage('canvas_page')->load($entity->id());
        $default = $default instanceof ContentEntityInterface ? $default->getUntranslated() : $entity;
        $cacheability->addCacheableDependency($default);
      }
      $default = $default === $entity ? [] : $read($default);
      $layers['from_default'] = array_filter([
        'robots' => $default['robots'] ?? [],
        'schema' => array_intersect_key($default['schema'] ?? [], ['type' => TRUE]),
        'social' => array_intersect_key($default['social'] ?? [], ['image' => TRUE]),
      ]);
      // The details of the type the translation inherits are its own.
      $layers['target'] = $read($entity, $layers['from_default']['schema']['type'] ?? 'WebPage');
      return $layers;
    }

    $template = ContentTemplate::loadForEntity($entity, 'full');
    if ($template === NULL) {
      $cacheability->addCacheTags($this->entityTypeManager->getDefinition(ContentTemplate::ENTITY_TYPE_ID)->getListCacheTags());
      return $layers;
    }
    $cacheability->addCacheableDependency($template);
    if ($draft) {
      $auto_save = $this->autoSaveManager->getAutoSaveEntity($template);
      $cacheability->addCacheableDependency($auto_save);
      $template = $auto_save->entity instanceof ContentTemplate ? $auto_save->entity : $template;
    }
    $values = $template->getThirdPartySetting('canvas_metatag', 'values');
    $layers['target'] = Values::clean(is_array($values) ? $values : [], 'template', NULL)[0];
    return $layers;
  }

  /**
   * The facts of an entity, with their values.
   *
   * Every value is what an anonymous visitor may see.
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface|null $entity
   *   The entity, or NULL for the facts with empty values.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the values depend on.
   * @param string|null $langcode
   *   The language its words are read in: a referencing page's, for a page
   *   it names (target()); NULL for the entity's own.
   *
   * @return array<string, array{label: string, kind: string, value: string, text?: string, image?: ?array, via?: string}>
   *   Name => fact. The Image fact has an empty `value` and an `image`: the
   *   image array without `source`, or NULL. `via`: the label of the field
   *   a node's Description or Image fact is taken from. `text`: a date fact
   *   in words, as a place that composes reads it (Words).
   */
  public function facts(?ContentEntityInterface $entity, CacheableMetadata $cacheability, ?string $langcode = NULL): array {
    $facts = [];
    foreach (Values::FACTS as $name => $kind) {
      $facts[$name] = ['label' => self::LABELS[$name], 'kind' => $kind, 'value' => ''] + ($kind === 'image' ? ['image' => NULL] : []);
    }
    $identity = $this->site($cacheability)['identity'];
    // With their overrides: a translated site name varies by language.
    $cacheability->addCacheableDependency($this->configFactory->get('system.site'));
    $facts['site']['value'] = $identity['name'] !== '' ? $identity['name'] : (string) $this->configFactory->get('system.site')->get('name');
    // The publisher: a reference to the site's own identity, by its name.
    $facts['identity']['value'] = $facts['site']['value'];
    if ($entity === NULL) {
      return $facts;
    }

    $langcode ??= $entity->language()->getId();
    $cacheability->addCacheableDependency($this->configFactory->get('system.date'));
    $facts['title']['value'] = (string) $entity->label();
    $facts['url']['value'] = $this->url($entity, $cacheability);
    $facts['author']['value'] = $this->label($entity instanceof EntityOwnerInterface ? $entity->getOwner() : NULL, $langcode, $cacheability);
    foreach (['published' => 'created', 'modified' => 'changed'] as $name => $field) {
      $facts[$name]['value'] = $entity->hasField($field) ? $this->date($entity->get($field)->value) : '';
      $facts[$name]['text'] = $facts[$name]['value'] === '' ? '' : $this->words->date($facts[$name]['value'], $langcode, $cacheability);
    }

    if ($entity->getEntityTypeId() === 'canvas_page') {
      $facts['description']['value'] = (string) $entity->get('description')->value;
      $facts['image']['image'] = $this->mediaImage($entity->get('image')->entity, $langcode, $cacheability);
      return $facts;
    }

    // The first formatted text with a summary, and the first image that
    // resolves, in the order of the form.
    foreach ($this->formFields($entity->getEntityTypeId(), $entity->bundle(), $cacheability) as $name => $definition) {
      $type = $definition->getType();
      $image = $type === 'image' || $this->referencesImageMedia($definition);
      if (($type !== 'text_with_summary' || isset($facts['description']['via'])) && (!$image || $facts['image']['image'] !== NULL)) {
        continue;
      }
      $items = $entity->get($name);
      // A field the visitor may not view gives nothing. Only delta 0.
      $item = $this->allowed($items, 'view', $cacheability) ? $items->first() : NULL;
      if ($image) {
        $facts['image']['via'] ??= (string) $definition->getLabel();
        $found = match (TRUE) {
          $item === NULL => NULL,
          $type === 'image' => $this->usable($item, $cacheability) ? $this->fileImage($item, Values::plain((string) $item->get('alt')->getValue(), 255) ?: NULL) : NULL,
          default => $this->mediaImage($item->get('entity')->getValue(), $langcode, $cacheability),
        };
        if ($found !== NULL) {
          $facts['image'] = ['image' => $found, 'via' => (string) $definition->getLabel()] + $facts['image'];
        }
        continue;
      }
      $facts['description']['via'] = (string) $definition->getLabel();
      // The summary, else the text cut at a word boundary.
      $summary = Values::fromHtml((string) $item?->get('summary')->getValue());
      $text = Values::fromHtml((string) $item?->get('value')->getValue());
      $facts['description']['value'] = $summary !== '' ? $summary : Values::excerpt($text);
    }
    return $facts;
  }

  /**
   * The separator between the title's parts.
   */
  public function separator(CacheableMetadata $cacheability): string {
    return $this->site($cacheability)['identity']['separator'];
  }

  /**
   * The sources a template may link to, with the previewed node's values.
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface|null $node
   *   The node the template is previewed with, if any.
   * @param string $bundle
   *   The template's bundle.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the values depend on.
   *
   * @return list<array{source: array, label: string, path: list<string>, field: string, hop: bool, kinds: list<string>, status: string, value: string, image?: ?array, list?: true, shown?: string, text?: string, line?: string, long?: true, part?: string}>
   *   In the order of the form. `status`: ok, empty, hidden, or none without
   *   a node. A hidden entry has no value. `list`: a list field, whose value
   *   is a key and `shown` its label. `text`: what the row gives a place
   *   that composes, the server's words for the item (a date in the item's
   *   language, every item visitors may see, joined); `line`: the same in a
   *   title-like place, when it differs (at most two items). `long`: long
   *   text, which a title-like composition does not take; `part`: enough of
   *   its start in words for a description to cut it.
   */
  public function sourceRows(?ContentEntityInterface $node, string $bundle, CacheableMetadata $cacheability): array {
    // Whether visitors may view the node is asked once for every row.
    return $this->sources->reading(fn (): array => $this->rowsFor($node, $bundle, $cacheability));
  }

  /**
   * The rows of sourceRows(), read while host access is held.
   */
  private function rowsFor(?ContentEntityInterface $node, string $bundle, CacheableMetadata $cacheability): array {
    $rows = [];
    foreach ($this->sources->vocabulary($bundle) as $expression => $row) {
      $source = ['expression' => $expression, 'sourceType' => 'entity-field'];
      // A row previews its first kind: formatted text's markup and a
      // reference's target come beside its text (SourcesTest::testVocabulary).
      $kind = $row['kinds'][0];
      [$status, $value] = $node === NULL ? ['none', NULL] : $this->link($source, $node, $kind, $cacheability);
      // Sources' own metadata stays here: the dialog never reads it.
      $internal = array_fill_keys(['html', 'decimal', 'shown', 'storage', 'scale', 'timestamp'], TRUE);
      $out = ['source' => $source] + array_diff_key($row, $internal) + [
        'status' => $status,
        'value' => is_string($value) ? $value : '',
      ];
      if ($kind === 'image') {
        $out['image'] = is_array($value) ? $value : NULL;
      }
      if (isset($row['shown'])) {
        $out['list'] = TRUE;
      }
      if (isset($row['shown']) && $status === 'ok' && $node !== NULL) {
        $out['shown'] = (string) $this->sources->shown($source, $node, $cacheability);
      }
      // How many items a field of several values has for the item.
      if (isset($row['many']) && $node !== NULL && $status === 'ok') {
        $out['count'] = count((array) $this->link($source, $node, $kind, $cacheability, TRUE)[1]);
      }
      // What a place that composes reads, in the server's words: the dialog
      // never formats a value.
      if (array_intersect(['text', 'date', 'number'], $row['kinds'])) {
        if (isset($row['html'])) {
          $out['long'] = TRUE;
        }
        // One read, put in words for each form.
        [$found, $value] = $node === NULL ? ['none', NULL] : $this->sources->evaluate($source, $node, 'words', $cacheability);
        if ($node !== NULL) {
          $words = fn (bool $line, bool $whole): string => $found === 'ok'
            ? $this->words->items($value['items'], $value['as'], $value['scale'], $node->language()->getId(), $line, $whole, $cacheability)
            : '';
          $out['text'] = $words(FALSE, FALSE);
          // At most two items in a title-like place: only several differ.
          $line = isset($row['many']) ? $words(TRUE, FALSE) : $out['text'];
          if ($line !== $out['text']) {
            $out['line'] = $line;
          }
          // As a part of a description it gets the room the rest leaves, at
          // most Values::LONG_ROOM: enough of its start to cut it there.
          if (isset($row['html'])) {
            $out['part'] = mb_substr($words(FALSE, TRUE), 0, 2 * Values::LONG_ROOM);
          }
        }
      }
      $rows[] = $out;
    }
    return $rows;
  }

  /**
   * What a source gives in words for a node.
   *
   * @param array $source
   *   The stored source.
   * @param \Drupal\Core\Entity\ContentEntityInterface $node
   *   The node.
   * @param bool $line
   *   A title-like place: at most two items, then "and ‹n› more".
   * @param bool $whole
   *   A part of a composition: formatted text gives all its text.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the words depend on.
   * @param string|null $langcode
   *   The language to read in; NULL for the node's own.
   *
   * @return array{0: 'ok'|'empty'|'hidden'|'broken', 1: string, 2: string}
   *   The status, the words ('' for none), and how they were read (`html`:
   *   long text).
   */
  private function wordsOf(array $source, ContentEntityInterface $node, bool $line, bool $whole, CacheableMetadata $cacheability, ?string $langcode = NULL): array {
    [$status, $value] = $this->sources->evaluate($source, $node, 'words', $cacheability, langcode: $langcode);
    if ($status !== 'ok') {
      return [$status, '', ''];
    }
    $text = $this->words->items($value['items'], $value['as'], $value['scale'], $langcode ?? $node->language()->getId(), $line, $whole, $cacheability);
    return [$text === '' ? 'empty' : 'ok', $text, $value['as']];
  }

  /**
   * What a value of any shape gives for an entity, in a form.
   *
   * The one reader of the head, of a referenced page's details (target())
   * and of a composition's parts. A source is read once per entity, field
   * and form.
   *
   * @param array $value
   *   A clean value.
   * @param \Drupal\Core\Entity\ContentEntityInterface $entity
   *   The entity whose fields and facts are read.
   * @param array $facts
   *   That entity's facts (facts()).
   * @param string $kind
   *   The kind of value wanted, or the form of a place that composes:
   *   `words`, or `line` for a title-like place.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the value depends on.
   * @param array $memo
   *   What was read, by entity, field and form.
   * @param bool $list
   *   Every item (link()).
   * @param int $max
   *   For the ref kind, the cap (link()).
   * @param bool $part
   *   A part of a composition: long text gives all of it, to be cut to the
   *   room the rest leaves.
   * @param string|null $langcode
   *   The language words are read in; NULL for the entity's own.
   *
   * @return mixed
   *   What link() gives for the kind; in words a string ('' for nothing),
   *   and for a composition its segments (Values::compose()).
   */
  private function read(array $value, ContentEntityInterface $entity, array $facts, string $kind, CacheableMetadata $cacheability, array &$memo, bool $list = FALSE, int $max = PHP_INT_MAX, bool $part = FALSE, ?string $langcode = NULL): mixed {
    $words = $kind === 'words' || $kind === 'line';
    if (isset($value['parts'])) {
      $form = $kind === 'line' ? 'line' : 'words';
      $read = function (array $one) use ($entity, $facts, $form, $cacheability, &$memo, $langcode): string {
        $found = $this->read($one, $entity, $facts, $form, $cacheability, $memo, part: TRUE, langcode: $langcode);
        return is_string($found) ? $found : '';
      };
      // Long text: the Description fact, or formatted text (read by now).
      $long = function (array $one) use ($entity, $form, &$memo): bool {
        return isset($one['fact'])
          ? $one['fact'] === 'description'
          : ($memo[$this->memoKey($one['source'] ?? [], $entity, $form, TRUE)][2] ?? '') === 'html';
      };
      return Values::compose($value['parts'], $read, $long, $form === 'line' ? 0 : Values::LONG_ROOM);
    }
    return match (array_key_first($value)) {
      'text' => $value['text'],
      'fact' => match (TRUE) {
        $kind === 'image' => $facts[$value['fact']]['image'] ?? NULL,
        $words => Values::plain((string) ($facts[$value['fact']]['text'] ?? $facts[$value['fact']]['value'] ?? ''), PHP_INT_MAX),
        default => $facts[$value['fact']]['value'] ?? '',
      },
      'media' => $this->image($value['media'], $cacheability),
      'source' => $entity->getEntityTypeId() !== 'node' ? NULL : ($words
        // A long text part of a description gets the room the rest leaves:
        // read whole. Elsewhere, its start, as a whole link gives it.
        ? ($memo[$this->memoKey($value['source'], $entity, $kind, $part)] ??= $this->wordsOf($value['source'], $entity, $kind === 'line', $part && $kind === 'words', $cacheability, $langcode))[1]
        : ($memo[$this->memoKey($value['source'], $entity, $kind, $part, $list, $max)] ??= $this->link($value['source'], $entity, $kind, $cacheability, $list, $max))[1]),
      default => NULL,
    };
  }

  /**
   * The memo key of a source read for an entity in a form.
   */
  private function memoKey(array $source, ContentEntityInterface $entity, string $kind, bool $part, bool $list = FALSE, int $max = PHP_INT_MAX): string {
    return implode("\x1F", [
      $entity->getEntityTypeId(),
      $entity->id(),
      $entity->language()->getId(),
      $source['expression'] ?? '',
      $kind,
      (int) $part,
      (int) $list,
      $max,
    ]);
  }

  /**
   * What a template's stored source gives for a node.
   *
   * @param array $source
   *   The stored source.
   * @param \Drupal\Core\Entity\ContentEntityInterface $node
   *   The node.
   * @param string $kind
   *   The kind of value wanted.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the value depends on.
   * @param bool $list
   *   Every item, in field order (Sources::evaluate()).
   * @param int $max
   *   For the ref kind: how many targets a visitor may see are read; the
   *   rest are FALSE, counted and never read (their pages, templates and
   *   cache tags).
   *
   * @return array{0: 'ok'|'empty'|'hidden'|'broken', 1: mixed}
   *   The status, and text or an image array; with $list a list of them,
   *   NULL for an item a visitor may not see. An address is absolute
   *   http(s) on the public base, or nothing; an image a public file. The
   *   ref kind gives the targets (target()), always a list.
   */
  public function link(array $source, ContentEntityInterface $node, string $kind, CacheableMetadata $cacheability, bool $list = FALSE, int $max = PHP_INT_MAX): array {
    [$status, $value] = $this->sources->evaluate($source, $node, $kind, $cacheability, $list);
    if ($status !== 'ok') {
      return [$status, NULL];
    }
    if ($kind === 'ref') {
      $seen = [];
      $targets = [];
      foreach ($value as $item) {
        $target = count($seen) < $max ? $this->target($item, $node->language()->getId(), $cacheability) : FALSE;
        if (is_array($target)) {
          $seen[$target['url']] = TRUE;
        }
        $targets[] = $target;
      }
      return [$targets === [] ? 'empty' : 'ok', $targets];
    }
    $one = fn (mixed $item): mixed => match ($kind) {
      'address' => $this->address((string) $item, $node->language(), $cacheability),
      'image' => $this->uriImage($item, $cacheability),
      default => $item,
    };
    $value = $list ? array_map($one, $value) : $one($value);
    return [$value === NULL || $value === '' || $value === [] ? 'empty' : 'ok', $value];
  }

  /**
   * What a reference says of its target.
   *
   * The page's name and address, and what it is described as.
   * Reads the target's own SEO values and fields, never its rendered page,
   * and never another reference: one hop. A target a visitor may not see,
   * in the host's language, is NULL: a published page whose translation is
   * not is never named by that translation.
   *
   * @return array{name: string, url: string, type?: string, id?: string, address?: array, complete?: bool}|null
   *   `type`: the schema.org type of its main thing; `id`: that node's @id;
   *   `address`: its PostalAddress, when complete; `complete`: a course with
   *   a summary.
   */
  public function target(mixed $entity, string $langcode, CacheableMetadata $cacheability): ?array {
    if (!$entity instanceof ContentEntityInterface) {
      return NULL;
    }
    $entity = self::translated($entity, $langcode);
    $cacheability->addCacheableDependency($entity);
    if (!$this->allowed($entity, 'view', $cacheability)) {
      return NULL;
    }
    $url = $this->url($entity, $cacheability);
    $target = ['name' => (string) $entity->label(), 'url' => $url];
    if (!$this->owns($entity)) {
      // Named only, until a template describes its bundle: making or
      // enabling one rebuilds every head that names it.
      $template = $entity->getEntityTypeId() === 'node' ? ContentTemplate::loadForEntity($entity, 'full') : NULL;
      $template !== NULL
        ? $cacheability->addCacheableDependency($template)
        : $cacheability->addCacheTags($this->entityTypeManager->getDefinition(ContentTemplate::ENTITY_TYPE_ID)->getListCacheTags());
      return $target;
    }
    $layers = $this->layers($entity, FALSE, $cacheability);
    $schema = array_replace_recursive($layers['from_default'], $layers['target'])['schema'] ?? [];
    $type_id = $schema['type'] ?? 'WebPage';
    $type = SchemaGraph::types()[$type_id] ?? NULL;
    if (!isset($type['primary_type'])) {
      return $target;
    }
    // The page's own details, read by the reader of its own head, with its
    // own facts: a venue's composed name reads the venue's title.
    $facts = NULL;
    $memo = [];
    $scope = $entity->getEntityTypeId() === 'node' ? 'template' : 'page';
    // In the referencing page's language: a French event reads its venue's
    // dates and list labels in French, whether or not the venue has a
    // translation.
    $text = function (string $key) use ($schema, $type_id, $entity, $scope, $langcode, $cacheability, &$facts, &$memo): string {
      $prop = SchemaGraph::prop($type_id, $key);
      $value = $schema['props'][$key] ?? $prop['default'] ?? NULL;
      if ($value === NULL) {
        return '';
      }
      $path = "schema.props.$key";
      $form = Values::composes($prop, $path, $scope) ? (Values::titleLike($path) ? 'line' : 'words') : 'text';
      // The page's facts only for a value that reads one: they depend on its
      // author, media and files.
      if (isset($value['fact']) || array_filter($value['parts'] ?? [], static fn (array $part): bool => isset($part['fact']))) {
        $facts ??= $this->facts($entity, $cacheability, $langcode);
      }
      $found = $this->read($value, $entity, $facts ?? [], $form, $cacheability, $memo, langcode: $langcode);
      $found = is_array($found) ? implode('', $found) : $found;
      return is_string($found) ? Values::plain($found, 255) : '';
    };
    // A kind of place linked to a field is used only when it is one of the
    // listed kinds: the target's own page validates it the same way.
    $kind = $type_id === 'LocalBusiness' ? $text('placeKind') : '';
    $target['type'] = $type_id === 'LocalBusiness'
      ? (SchemaGraph::validLiteral('LocalBusiness', 'placeKind', $kind) ? $kind : 'LocalBusiness')
      : $type['primary_type'];
    $target['id'] = $url . '#primary';
    if (isset($type['groups']['address'])) {
      $parts = [];
      foreach ($type['groups']['address']['parts'] as $key) {
        $parts[substr($key, strlen('address_'))] = $text($key);
      }
      if (($parts['streetAddress'] !== '' || $parts['addressLocality'] !== '') && in_array($parts['addressCountry'], SchemaGraph::codes('country'), TRUE)) {
        $target['address'] = ['@type' => 'PostalAddress'] + array_filter($parts, 'strlen');
      }
    }
    if ($type_id === 'Course') {
      $target['complete'] = $text('description') !== '' || ($facts ??= $this->facts($entity, $cacheability, $langcode))['description']['value'] !== '';
    }
    return $target;
  }

  /**
   * Resolves a media UUID to an image an anonymous visitor may see.
   *
   * @return array{url: string, width: int, height: int, alt: string, bytes: int, mime: string, name: string, thumb: string}|null
   *   The image, or NULL when the media or its file is missing, not viewable
   *   by an anonymous visitor, or not in the public file system.
   */
  public function image(string $uuid, CacheableMetadata $cacheability): ?array {
    if (!$this->entityTypeManager->hasDefinition('media')) {
      return NULL;
    }
    $media = $this->entityTypeManager->getStorage('media')->loadByProperties(['uuid' => $uuid]);
    // ponytail: the media's default translation; a translated alt text needs
    // the page language passed down to here.
    return $this->mediaImage(reset($media) ?: NULL, NULL, $cacheability);
  }

  /**
   * Describes the image of a media item, without any access check.
   *
   * For the dialog's picker, which lists what the current user may view.
   *
   * @return array{url: string, width: int, height: int, alt: string, bytes: int, mime: string, name: string, thumb: string}|null
   *   The image, or NULL when the media has no image file or its file is not
   *   public: such a file is never emitted, so it is never offered.
   */
  public function describe(MediaInterface $media): ?array {
    $item = self::sourceItem($media);
    $file = $item?->get('entity')->getValue();
    return $file instanceof FileInterface && StreamWrapperManager::getScheme((string) $file->getFileUri()) === 'public'
      ? $this->fileImage($item, (string) $media->label())
      : NULL;
  }

  /**
   * The public base: where visitors reach the site.
   *
   * @return array{url: string, source: string}
   *   The base URL without a trailing slash, and `settings` (the site's
   *   `canvas_metatag_public_base` setting), `frontend` (the first configured
   *   headless frontend) or `request` (this request's host).
   */
  public function origin(CacheableMetadata $cacheability): array {
    // The setting is per environment, so a preview frontend's address that
    // travels with configuration never becomes the public one where it is
    // set. Changing it takes a cache rebuild, as any setting does.
    $base = Settings::get('canvas_metatag_public_base');
    if (is_string($base) && Values::isHttpUrl($base) && !preg_match('/[?#]/', $base)) {
      return ['url' => rtrim($base, '/'), 'source' => 'settings'];
    }
    // Always: installing canvas_headless or configuring a frontend later must
    // invalidate what was built on the request host.
    $cacheability->addCacheTags(['config:canvas_headless.settings']);
    if ($this->moduleHandler->moduleExists('canvas_headless')) {
      // The first frontend is the one the editor previews against.
      $url = $this->configFactory->get('canvas_headless.settings')->get('frontends.0.url');
      $frontend = is_string($url) ? FrontendUrl::fromConfig($url) : NULL;
      if ($frontend !== NULL) {
        return ['url' => $frontend->baseUrl, 'source' => 'frontend'];
      }
    }
    $cacheability->addCacheContexts(['url.site']);
    $request = $this->requestStack->getCurrentRequest();
    return ['url' => $request->getSchemeAndHttpHost() . $request->getBasePath(), 'source' => 'request'];
  }

  /**
   * The entity's own public URL.
   *
   * The public base plus the canonical path with its language prefix and
   * alias; the front page is the base path itself. The same function gives
   * the canonical, og:url, every hreflang target and every @id.
   */
  public function url(ContentEntityInterface $entity, CacheableMetadata $cacheability): string {
    $cacheability->addCacheTags(['config:system.site']);
    $url = $entity->toUrl('canonical');
    // The front page setting holds a system path or its alias.
    $front = (string) $this->configFactory->get('system.site')->get('page.front');
    if ($front !== '' && '/' . $url->getInternalPath() === $this->aliasManager->getPathByAlias($front, $entity->language()->getId())) {
      $url = Url::fromRoute('<front>', [], ['language' => $entity->language()]);
    }
    return $this->publicUrl($url, $cacheability);
  }

  /**
   * Resolves the head of an owned entity.
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface $entity
   *   The translation to resolve. For a page draft the caller hands in the
   *   draft entity.
   * @param bool $draft
   *   Read the content template's Canvas draft for the type layer.
   *
   * @return array{head: array{title: string, meta: list<array<string, string>>, link: list<array<string, string>>, script: list<array{type: string, textContent: array}>}, image: ?array, schema: array, cacheability: \Drupal\Core\Cache\CacheableMetadata}
   *   The head in emission order, the effective social image, what building
   *   the structured data reported (SchemaGraph::build(), without the graph)
   *   and everything the result depends on. Nothing only the dialog shows is
   *   computed here: see report().
   */
  public function resolve(ContentEntityInterface $entity, bool $draft = FALSE): array {
    // Kept for the rest of the request: the coupled adapter asks twice.
    $request = $this->requestStack->getCurrentRequest();
    $kept = $this->resolved[$entity] ?? NULL;
    if ($kept !== NULL && $kept['request'] === $request && $kept['draft'] === $draft) {
      return $kept['result'];
    }

    $cacheability = (new CacheableMetadata())
      ->addCacheableDependency($entity)
      ->addCacheContexts(['languages:language_content']);
    $layers = $this->layers($entity, $draft, $cacheability);
    $effective = Values::cascade(array_replace_recursive($layers['from_default'], $layers['target']), $layers['site']);
    $facts = $this->facts($entity, $cacheability);

    // What a value gives for this entity, by kind or form; each field is read
    // once per form, and anonymous access to the entity is asked once.
    return $this->sources->reading(fn (): array => $this->head($entity, $draft, $request, $cacheability, $layers, $effective, $facts));
  }

  /**
   * Builds the head of resolve(), with the layers and facts it read.
   */
  private function head(ContentEntityInterface $entity, bool $draft, ?object $request, CacheableMetadata $cacheability, array $layers, array $effective, array $facts): array {
    $identity = $layers['identity'];
    $memo = [];
    $value = function (array $value, string $kind, bool $list = FALSE, int $max = PHP_INT_MAX) use ($entity, &$facts, $cacheability, &$memo): mixed {
      return $this->read($value, $entity, $facts, $kind, $cacheability, $memo, $list, $max);
    };
    $texts = Values::texts($effective, static function (array $v, string $form) use ($value): string|array {
      $found = $value($v, $form);
      return is_array($found) ? $found : (is_string($found) ? $found : '');
    }, $identity['separator'], $layers['site']['title_end'] ?? NULL);
    $site_name = Values::plain($facts['site']['value'], 255);

    // The canonical may point elsewhere. The entity's own URL stays the
    // identity of its structured data.
    $origin = $this->origin($cacheability);
    $own = $facts['url']['value'];
    $canonical = $effective['canonical'] ?? '';
    $canonical = match (TRUE) {
      $canonical === '' => $own,
      str_starts_with($canonical, '/') => $origin['url'] . $canonical,
      default => $canonical,
    };

    // Fixed names in a fixed order; free text never reaches this tag.
    $robots = $effective['robots'] ?? [];
    $directives = array_values(array_filter(
      ['noindex', 'nofollow', 'nosnippet'],
      static fn (string $name): bool => ($robots[$name] ?? FALSE) === TRUE,
    ));
    if (($robots['max_snippet'] ?? -1) >= 0 && ($robots['nosnippet'] ?? FALSE) !== TRUE) {
      $directives[] = 'max-snippet:' . $robots['max_snippet'];
    }
    if (isset($robots['max_image_preview'])) {
      $directives[] = 'max-image-preview:' . $robots['max_image_preview'];
    }

    // The social image (a media item: an override; the Image fact or a
    // linked field: the entity's), the Image fact, the site default.
    $image = NULL;
    $chain = [
      [$effective['social']['image'] ?? NULL, isset($effective['social']['image']['media']) ? 'override' : 'entity'],
      [['fact' => 'image'], 'entity'],
      [$identity['default_image'] === '' ? NULL : ['media' => $identity['default_image']], 'site'],
    ];
    foreach ($chain as [$reference, $source]) {
      $image = $reference === NULL ? NULL : $value($reference, 'image');
      if (is_array($image)) {
        $image['source'] = $source;
        break;
      }
    }

    // Dated opening hours that have passed are left out: a head that has
    // them is kept until the day ends.
    $today = new \DateTimeImmutable('now', new \DateTimeZone($this->timezone()));
    if (preg_match('/\b\d{4}-\d{2}-\d{2} /', json_encode($effective['schema']['props']['openingHoursSpecification'] ?? []))) {
      $cacheability->mergeCacheMaxAge(max(60, $today->modify('tomorrow')->getTimestamp() - $today->getTimestamp()));
    }
    $report = SchemaGraph::build([
      'scope' => $entity->getEntityTypeId() === 'canvas_page' ? 'page' : 'template',
      'today' => $today->format('Y-m-d'),
      'home' => $origin['url'] . '/',
      'url' => $own,
      'langcode' => $entity->language()->isLocked() ? '' : $entity->language()->getId(),
      'title' => Values::plain($facts['title']['value'], 255),
      'description' => $texts['description'],
      'published' => $facts['published']['value'],
      'modified' => $facts['modified']['value'],
      'timezone' => $this->timezone(),
      'currency' => $this->site($cacheability)['currency'],
      'identity' => ['kind' => $identity['kind'], 'name' => $site_name, 'same_as' => $identity['same_as']],
      'logo' => $identity['logo'] === '' ? NULL : $this->image($identity['logo'], $cacheability),
      'image' => $image,
      'facts' => ['sep' => $identity['separator'], 'image' => $facts['image']['image']['url'] ?? '']
      + array_map(static fn (array $fact): string => $fact['value'], array_diff_key($facts, ['image' => TRUE])),
      'fill' => $entity->getEntityTypeId() === 'node' ? fn (string $name, string $expects): array => $this->fill($name, $expects, $entity, $cacheability) : NULL,
    ], ['extend' => ($effective['schema']['extend'] ?? []) + ($layers['site']['schema']['extend'] ?? [])] + ($effective['schema'] ?? []), function (array $v, string $kind, bool $list = FALSE, int $max = PHP_INT_MAX) use ($value, $entity, $facts, $texts, $cacheability, &$memo): mixed {
      if (!isset($v['parts'])) {
        return $value($v, $kind, $list, $max);
      }
      // A Description part reads the head's description, as a whole
      // Description link does.
      $own = $facts;
      $own['description']['value'] = $texts['description'];
      return implode('', (array) $this->read($v, $entity, $own, $kind, $cacheability, $memo));
    });
    $og_type = SchemaGraph::types()[$effective['schema']['type'] ?? 'WebPage']['og_type'] ?? 'website';
    // Where the front page's identity and website nodes are judged, and the
    // addresses report() judges them with.
    // The front page in the entity's language, with its prefix.
    $report['front'] = $own === $this->publicUrl(Url::fromRoute('<front>', [], ['language' => $entity->language()]), $cacheability);
    $report['home'] = $origin['url'] . '/';
    $report['today'] = $today->format('Y-m-d');
    $report['url'] = $own;
    $article = $og_type === 'article';

    $meta = [
      ['name' => 'description', 'content' => $texts['description']],
      ['name' => 'robots', 'content' => implode(', ', $directives)],
      ['property' => 'og:type', 'content' => $og_type],
      ['property' => 'og:site_name', 'content' => $site_name],
      ['property' => 'og:title', 'content' => $texts['social_title']],
      ['property' => 'og:description', 'content' => $texts['social_description']],
      ['property' => 'og:url', 'content' => Values::isHttpUrl($canonical) ? $canonical : ''],
      ['property' => 'og:image', 'content' => $image['url'] ?? ''],
      ['property' => 'og:image:width', 'content' => (string) (($image['width'] ?? 0) ?: '')],
      ['property' => 'og:image:height', 'content' => (string) (($image['height'] ?? 0) ?: '')],
      ['property' => 'og:image:alt', 'content' => $image['alt'] ?? ''],
      ['property' => 'article:published_time', 'content' => $article ? $facts['published']['value'] : ''],
      ['property' => 'article:modified_time', 'content' => $article ? $facts['modified']['value'] : ''],
      // A literal protocol token. Nothing else of that family is emitted;
      // consumers fall back to the Open Graph values.
      [
        'name' => 'twitter:card',
        'content' => $image !== NULL && $image['width'] >= self::LARGE_CARD['width'] && $image['height'] >= self::LARGE_CARD['height'] ? 'summary_large_image' : 'summary',
      ],
    ];

    $link = [['rel' => 'canonical', 'href' => $canonical]];
    $alternates = [];
    foreach (array_keys($entity->getTranslationLanguages()) as $langcode) {
      $translation = $entity->getTranslation($langcode);
      if (!$translation instanceof EntityPublishedInterface || $translation->isPublished()) {
        $alternates[$langcode] = $this->url($translation, $cacheability);
      }
    }
    if (count($alternates) > 1) {
      $default = $entity->getUntranslated()->language()->getId();
      foreach ($alternates + (isset($alternates[$default]) ? ['x-default' => $alternates[$default]] : []) as $hreflang => $href) {
        $link[] = ['rel' => 'alternate', 'hreflang' => (string) $hreflang, 'href' => $href];
      }
    }

    $script = self::script($report['graph'], $error);
    if ($error !== NULL) {
      $report['unencodable'] = TRUE;
      $this->loggers->get('canvas_metatag')->error('The structured data of @type @id was left out: @message', [
        '@type' => $entity->getEntityTypeId(),
        '@id' => $entity->id(),
        '@message' => $error,
      ]);
    }

    $result = [
      'head' => [
        'title' => $texts['title'],
        // Rows with an empty value are omitted; a URL is absolute or dropped.
        'meta' => array_values(array_filter($meta, static fn (array $row): bool => $row['content'] !== '')),
        'link' => array_values(array_filter($link, static fn (array $row): bool => Values::isHttpUrl($row['href']))),
        'script' => $script,
      ],
      'image' => $image,
      'schema' => array_diff_key($report, ['graph' => TRUE]),
      'cacheability' => $cacheability,
    ];
    $this->resolved[$entity] = ['request' => $request, 'draft' => $draft, 'result' => $result];
    return $result;
  }

  /**
   * The head's JSON-LD script, or none when it cannot be written out.
   *
   * Structured data that cannot be encoded (a number that is not finite)
   * leaves the head without its script, never without its other tags.
   *
   * @param array $graph
   *   The graph.
   * @param string|null $error
   *   Set to why it cannot be written out, or NULL.
   *
   * @return list<array{type: string, textContent: array}>
   *   One script, or none.
   */
  public static function script(array $graph, ?string &$error = NULL): array {
    $error = NULL;
    try {
      json_encode($graph, Values::OUTPUT_FLAGS);
      return [['type' => 'application/ld+json', 'textContent' => $graph]];
    }
    catch (\JsonException $e) {
      $error = $e->getMessage();
      return [];
    }
  }

  /**
   * The structured data a head carries: an empty graph when it was left out.
   *
   * @param array $head
   *   The head resolve() built.
   *
   * @return array
   *   The graph, with its @context.
   */
  public static function graphOf(array $head): array {
    return $head['script'][0]['textContent'] ?? ['@context' => 'https://schema.org', '@graph' => []];
  }

  /**
   * A whole-value field link in hand-added JSON-LD, read for a node.
   *
   * "field_score" is the field's own value; "field_venue.title" one value of
   * what it references (one hop). Read through the same sources as every
   * other link: a date and time in the site's zone with its offset, a
   * date-only field as YYYY-MM-DD, an image as its public address,
   * formatted text as plain text. A field of several values gives its first.
   * Where an address is expected, only an absolute http(s) one is given.
   *
   * @param string $name
   *   The name inside "{field.…}".
   * @param string $expects
   *   What the name expects (SchemaGraph::expects()): a number field gives a
   *   number where one is expected, and a link field its absolute address.
   * @param \Drupal\Core\Entity\ContentEntityInterface $node
   *   The item being output.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the value depends on.
   *
   * @return array{0: string, 1: mixed}
   *   The status (ok, empty, hidden, broken) and the value.
   */
  private function fill(string $name, string $expects, ContentEntityInterface $node, CacheableMetadata $cacheability): array {
    [$field, $next] = array_pad(explode('.', $name, 2), 2, NULL);
    $number = $expects === 'number' || str_starts_with($expects, 'number|');
    $url = $expects === 'url';
    // The field's row that gives the richest kind: a number where one is
    // expected, a date, an image (an image field reached through its media
    // item), formatted text, else text; one on the field itself first.
    $best = NULL;
    foreach ($this->sources->vocabulary($node->bundle(), FALSE, $cacheability) as $expression => $row) {
      if ($row['field'] !== $field || ($next !== NULL && (!$row['hop'] || !str_contains($expression, "\u{241D}$next\u{241E}")))) {
        continue;
      }
      $kinds = $row['kinds'];
      $kind = match (TRUE) {
        $url && in_array('address', $kinds, TRUE) => 'address',
        $number && in_array('number', $kinds, TRUE) => 'number',
        in_array('date', $kinds, TRUE) => 'date',
        in_array('image', $kinds, TRUE) => 'image',
        isset($row['html']) && in_array('html', $kinds, TRUE) => 'html',
        // A number field read as text keeps its digits.
        in_array('text', $kinds, TRUE) => 'text',
        default => $kinds[0] ?? 'text',
      };
      // A number where none is expected comes last: it is a width or a
      // count, read as its digits.
      $order = ['address' => 0, 'number' => $number ? 0 : 5, 'date' => 1, 'image' => 2, 'html' => 3, 'text' => 4];
      $rank = ($order[$kind] ?? 6) * 2 + ($row['hop'] && $next === NULL ? 1 : 0);
      if ($best === NULL || $rank < $best[0]) {
        $best = [$rank, $expression, $kind];
      }
    }
    if ($best !== NULL) {
      [, $expression, $kind] = $best;
      [$status, $value] = $this->link(['sourceType' => 'entity-field', 'expression' => $expression], $node, $kind, $cacheability);
      $value = match (TRUE) {
        $status !== 'ok' => NULL,
        $kind === 'image' => is_array($value) ? $value['url'] ?? NULL : NULL,
        $kind === 'html' => Values::fromHtml((string) $value),
        $kind === 'number' && $number && is_numeric($value) => str_contains((string) $value, '.') ? (float) $value : (int) $value,
        default => $value,
      };
      // Text where an address is expected: an absolute one, or broken.
      if ($url && $kind !== 'address' && is_string($value) && $value !== '' && !Values::isHttpUrl($value)) {
        return ['broken', NULL];
      }
      return [$status === 'ok' && ($value === NULL || $value === '') ? 'empty' : $status, $value];
    }
    return ['broken', NULL];
  }

  /**
   * What only the dialog shows: the head, with verdicts and graph rules.
   *
   * Never called while a visitor's head is built (DeliveryPathTest): the
   * search features and the rules run for the dialog's state alone.
   *
   * @return array
   *   resolve()'s result, its `schema` with `features`
   *   (SchemaGraph::features()) and `rules` (SchemaGraph::rules()).
   */
  public function report(ContentEntityInterface $entity, bool $draft = FALSE): array {
    $result = $this->resolve($entity, $draft);
    $graph = self::graphOf($result['head']);
    $schema = $result['schema'];
    $home = $schema['home'];
    $result['schema']['features'] = SchemaGraph::features($graph, [
      'home' => $home,
      'url' => $schema['url'],
      'front' => $schema['front'],
      'type' => $schema['type'],
      'scope' => $entity->getEntityTypeId() === 'canvas_page' ? 'page' : 'template',
      'gates' => $schema['gates'],
      // A withheld main node is judged as it would ship, so the dialog says
      // what it needs.
      'extra' => isset($schema['withheld']['node']) ? [$schema['withheld']['node']] : [],
      'judged' => $schema['judged'],
      'incomplete' => $schema['incomplete'],
      'items' => $schema['items'],
      'today' => $schema['today'],
      'hand' => array_column(array_filter($schema['nodes'], static fn (array $node): bool => $node['origin'] === 'hand' && isset($node['at'])), 'at'),
    ]);
    $result['schema']['rules'] = SchemaGraph::rules($graph, ['home' => $home], $schema['nodes']);
    return $result;
  }

  /**
   * The site layer, the identity and the currency, read with overrides.
   *
   * @return array{site: array, identity: array, currency: string}
   *   Cleaned in read mode.
   */
  private function site(CacheableMetadata $cacheability): array {
    $config = $this->configFactory->get('canvas_metatag.site');
    $cacheability->addCacheableDependency($config);
    $values = $config->get('values');
    $identity = $config->get('identity');
    return [
      'site' => Values::clean(is_array($values) ? $values : [], 'site', NULL)[0],
      'identity' => Values::cleanIdentity(is_array($identity) ? $identity : [])[0],
      'currency' => Values::currency($config->get('currency'))[0],
    ];
  }

  /**
   * The configurable fields of a bundle in the order of its form.
   *
   * Fields not on the form follow, by machine name. The head depends on the
   * fields and on that order, also when they change without a save of the
   * node or the template.
   *
   * @return array<string, \Drupal\Core\Field\FieldDefinitionInterface>
   *   By machine name.
   */
  private function formFields(string $entityTypeId, string $bundle, CacheableMetadata $cacheability): array {
    $display = $this->entityTypeManager->getStorage('entity_form_display')->load("$entityTypeId.$bundle.default");
    // Creating a form display invalidates only the list tag.
    $cacheability->addCacheTags([
      'entity_field_info',
      'config:media_type_list',
      ...($display ? $display->getCacheTags() : $this->entityTypeManager->getDefinition('entity_form_display')->getListCacheTags()),
    ]);
    $fields = [];
    foreach ($this->entityFieldManager->getFieldDefinitions($entityTypeId, $bundle) as $name => $definition) {
      if (!$definition->getFieldStorageDefinition()->isBaseField()) {
        $weight = $display instanceof EntityFormDisplayInterface ? $display->getComponent($name)['weight'] ?? NULL : NULL;
        $fields[$name] = [$weight === NULL ? 1 : 0, (int) $weight, $name, $definition];
      }
    }
    // On the form by weight, then the rest; a tie by name.
    uasort($fields, static fn (array $a, array $b): int => array_slice($a, 0, 3) <=> array_slice($b, 0, 3));
    return array_map(static fn (array $field): FieldDefinitionInterface => $field[3], $fields);
  }

  /**
   * Puts a Drupal URL on the public base.
   *
   * @return string
   *   The absolute URL, or '' when the URL leads nowhere.
   */
  private function publicUrl(Url $url, CacheableMetadata $cacheability): string {
    // The metadata of the generated URL is collected so that it does not
    // leak into a render context, and dropped: the language is passed
    // explicitly, so the result does not vary by the negotiated one.
    $path = $url->setAbsolute(FALSE)->toString(TRUE)->getGeneratedUrl();
    if (!str_starts_with($path, '/')) {
      // An external URL, or one a language domain made absolute.
      // ponytail: with language domains and a headless frontend the URL stays
      // on the Drupal domain; nothing maps a language to a frontend host.
      return $path;
    }
    $base = (string) $this->requestStack->getCurrentRequest()?->getBasePath();
    return $this->origin($cacheability)['url'] . substr($path, strlen($base));
  }

  /**
   * A linked address as an absolute http(s) URL on the public base, or ''.
   *
   * A link field stores an external address, or `internal:`, `entity:` or
   * `route:` for one of the site; a computed URL may be a path.
   */
  private function address(string $value, LanguageInterface $language, CacheableMetadata $cacheability): string {
    // In the node's language, as url() builds the node's own address.
    $options = ['language' => $language];
    try {
      $url = match (TRUE) {
        (bool) preg_match('/^(?:internal|entity|route):/', $value) => $this->publicUrl(Url::fromUri($value, $options), $cacheability),
        str_starts_with($value, '/') && !str_starts_with($value, '//') => $this->publicUrl(Url::fromUserInput($value, $options), $cacheability),
        default => $value,
      };
    }
    catch (\InvalidArgumentException) {
      return '';
    }
    return Values::isHttpUrl($url) ? $url : '';
  }

  /**
   * A linked image read through its file, as the image array, or NULL.
   *
   * Canvas has checked access to the file on the way. Only a public file is
   * ever emitted.
   */
  private function uriImage(mixed $value, CacheableMetadata $cacheability): ?array {
    $uri = is_array($value) ? (string) ($value['uri'] ?? '') : '';
    if (StreamWrapperManager::getScheme($uri) !== 'public') {
      return NULL;
    }
    $files = $this->entityTypeManager->getStorage('file')->loadByProperties(['uri' => $uri]);
    $file = reset($files);
    if (!$file instanceof FileInterface) {
      return NULL;
    }
    // Image URLs are built on the request host, also on a headless site.
    $cacheability->addCacheableDependency($file)->addCacheContexts(['url.site']);
    $alt = Values::plain((string) $value['alt'], 1000);
    return $this->fileArray($file, (int) $value['width'], (int) $value['height'], $alt, Values::plain($alt, 255) ?: (string) $file->getFilename());
  }

  /**
   * The label of a referenced entity, for a visitor who may see its label.
   */
  private function label(mixed $entity, string $langcode, CacheableMetadata $cacheability): string {
    if (!$entity instanceof EntityInterface) {
      return '';
    }
    $cacheability->addCacheableDependency($entity);
    // Only the label is used, so `view label` decides: with `view` an author
    // would be empty wherever visitors may not open user profiles.
    return $this->allowed($entity, 'view label', $cacheability) ? (string) self::translated($entity, $langcode)->label() : '';
  }

  /**
   * The image of a media item an anonymous visitor may see.
   */
  private function mediaImage(mixed $media, ?string $langcode, CacheableMetadata $cacheability): ?array {
    if (!$media instanceof MediaInterface) {
      return NULL;
    }
    $cacheability->addCacheableDependency($media);
    $media = self::translated($media, $langcode);
    $item = $media instanceof MediaInterface && $this->allowed($media, 'view', $cacheability) ? self::sourceItem($media) : NULL;
    return $item !== NULL && $this->usable($item, $cacheability) ? $this->fileImage($item, (string) $media->label()) : NULL;
  }

  /**
   * The source field item of a media item whose source is an image.
   */
  private static function sourceItem(MediaInterface $media): ?FieldItemInterface {
    $source = $media->getSource();
    $field = $source instanceof Image ? $source->getConfiguration()['source_field'] ?? '' : '';
    $item = $media->hasField($field) ? $media->get($field)->first() : NULL;
    return $item instanceof FieldItemInterface ? $item : NULL;
  }

  /**
   * Whether the file of an image item may be emitted.
   *
   * It must be viewable by an anonymous visitor and public.
   * ponytail: only the `public` scheme counts; a remote wrapper that serves
   * public files is treated as missing.
   */
  private function usable(FieldItemInterface $item, CacheableMetadata $cacheability): bool {
    $file = $item->get('entity')->getValue();
    if (!$file instanceof FileInterface) {
      return FALSE;
    }
    // Image URLs are built on the request host, also on a headless site.
    $cacheability->addCacheableDependency($file)->addCacheContexts(['url.site']);
    return StreamWrapperManager::getScheme((string) $file->getFileUri()) === 'public' && $this->allowed($file, 'view', $cacheability);
  }

  /**
   * The image array of an image field item, without any access check.
   */
  private function fileImage(FieldItemInterface $item, ?string $name = NULL): ?array {
    $file = $item->get('entity')->getValue();
    return $file instanceof FileInterface
      ? $this->fileArray($file, (int) $item->get('width')->getValue(), (int) $item->get('height')->getValue(), Values::plain((string) $item->get('alt')->getValue(), 1000), $name ?? (string) $file->getFilename())
      : NULL;
  }

  /**
   * The image array of a file.
   *
   * The original file with its real dimensions: no image style. `name` and
   * `thumb` are for the dialog and are never emitted.
   */
  private function fileArray(FileInterface $file, int $width, int $height, string $alt, string $name): ?array {
    $uri = (string) $file->getFileUri();
    $url = $this->fileUrlGenerator->generateAbsoluteString($uri);
    // Every emitted URL is absolute http(s), or there is no image.
    if (!Values::isHttpUrl($url)) {
      return NULL;
    }
    // Big enough for a picker tile at twice the pixel density; core's
    // thumbnail where there is no medium.
    $styles = $this->entityTypeManager->getStorage('image_style')->loadMultiple(['medium', 'thumbnail']);
    $style = $styles['medium'] ?? $styles['thumbnail'] ?? NULL;
    return [
      'url' => $url,
      'width' => $width,
      'height' => $height,
      'alt' => $alt,
      'bytes' => (int) $file->getSize(),
      'mime' => (string) $file->getMimeType(),
      'name' => $name,
      'thumb' => $style !== NULL && $style->supportsUri($uri)
        ? $this->fileUrlGenerator->transformRelative($style->buildUrl($uri))
        : $this->fileUrlGenerator->generateString($uri),
    ];
  }

  /**
   * Whether an anonymous visitor may do this.
   */
  private function allowed(AccessibleInterface $object, string $operation, CacheableMetadata $cacheability): bool {
    $access = $object->access($operation, $this->anonymous, TRUE);
    // Tags and max-age only. The check always runs for the anonymous
    // account, so its result does not vary by the current user.
    $result = CacheableMetadata::createFromObject($access);
    $cacheability
      ->addCacheTags([...$result->getCacheTags(), 'config:user.role.anonymous'])
      ->setCacheMaxAge(Cache::mergeMaxAges($cacheability->getCacheMaxAge(), $result->getCacheMaxAge()));
    return $access->isAllowed();
  }

  /**
   * A timestamp as ISO 8601 with the offset of the site's default timezone.
   */
  private function date(mixed $timestamp): string {
    return is_numeric($timestamp)
      ? (new \DateTimeImmutable('@' . (int) $timestamp))->setTimezone(new \DateTimeZone($this->timezone()))->format('c')
      : '';
  }

  /**
   * The site's default timezone.
   */
  private function timezone(): string {
    return (string) ($this->configFactory->get('system.date')->get('timezone.default') ?: 'UTC');
  }

  /**
   * The entity in a language, when it has that translation.
   */
  private static function translated(EntityInterface $entity, ?string $langcode): EntityInterface {
    return $langcode !== NULL && $entity instanceof TranslatableInterface && $entity->hasTranslation($langcode)
      ? $entity->getTranslation($langcode)
      : $entity;
  }

  /**
   * Whether the field references media of a type whose source is an image.
   */
  private function referencesImageMedia(FieldDefinitionInterface $definition): bool {
    if ($definition->getType() !== 'entity_reference' || $definition->getSetting('target_type') !== 'media') {
      return FALSE;
    }
    $bundles = $definition->getSetting('handler_settings')['target_bundles'] ?? NULL;
    foreach ($this->entityTypeManager->getStorage('media_type')->loadMultiple($bundles ?: NULL) as $media_type) {
      if ($media_type->getSource() instanceof Image) {
        return TRUE;
      }
    }
    return FALSE;
  }

}
