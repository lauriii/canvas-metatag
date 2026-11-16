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
    $layers = $this->site($cacheability) + ['target' => [], 'from_default' => []];

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
   *
   * @return array<string, array{label: string, kind: string, value: string, image?: ?array, via?: string}>
   *   Name => fact. The Image fact has an empty `value` and an `image`: the
   *   image array without `source`, or NULL. `via`: the label of the field
   *   a node's Description or Image fact is taken from.
   */
  public function facts(?ContentEntityInterface $entity, CacheableMetadata $cacheability): array {
    $facts = [];
    foreach (Values::FACTS as $name => $kind) {
      $facts[$name] = ['label' => self::LABELS[$name], 'kind' => $kind, 'value' => ''] + ($kind === 'image' ? ['image' => NULL] : []);
    }
    $identity = $this->site($cacheability)['identity'];
    // With their overrides: a translated site name varies by language.
    $cacheability->addCacheableDependency($this->configFactory->get('system.site'));
    $facts['site']['value'] = $identity['name'] !== '' ? $identity['name'] : (string) $this->configFactory->get('system.site')->get('name');
    if ($entity === NULL) {
      return $facts;
    }

    $langcode = $entity->language()->getId();
    $cacheability->addCacheableDependency($this->configFactory->get('system.date'));
    $facts['title']['value'] = (string) $entity->label();
    $facts['url']['value'] = $this->url($entity, $cacheability);
    $facts['author']['value'] = $this->label($entity instanceof EntityOwnerInterface ? $entity->getOwner() : NULL, $langcode, $cacheability);
    foreach (['published' => 'created', 'modified' => 'changed'] as $name => $field) {
      $facts[$name]['value'] = $entity->hasField($field) ? $this->date($entity->get($field)->value) : '';
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
   * @return list<array{source: array, label: string, path: list<string>, field: string, hop: bool, kinds: list<string>, status: string, value: string, image?: ?array, list?: true, shown?: string}>
   *   In the order of the form. `status`: ok, empty, hidden, or none without
   *   a node. A hidden entry has no value. `list`: a list field, whose value
   *   is a key and `shown` its label.
   */
  public function sourceRows(?ContentEntityInterface $node, string $bundle, CacheableMetadata $cacheability): array {
    $rows = [];
    foreach ($this->sources->vocabulary($bundle) as $expression => $row) {
      $source = ['expression' => $expression, 'sourceType' => 'entity-field'];
      // One kind per row; SourcesTest::testVocabulary pins it.
      $kind = $row['kinds'][0];
      [$status, $value] = $node === NULL ? ['none', NULL] : $this->link($source, $node, $kind, $cacheability);
      $out = ['source' => $source] + array_diff_key($row, ['html' => TRUE, 'scale' => TRUE, 'shown' => TRUE]) + [
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
      $rows[] = $out;
    }
    return $rows;
  }

  /**
   * What a template's stored source gives for a node.
   *
   * @return array{0: 'ok'|'empty'|'hidden'|'broken', 1: string|array|null}
   *   The status, and text or an image array. An address is absolute
   *   http(s) on the public base, or nothing; an image a public file.
   */
  public function link(array $source, ContentEntityInterface $node, string $kind, CacheableMetadata $cacheability): array {
    [$status, $value] = $this->sources->evaluate($source, $node, $kind, $cacheability);
    if ($status !== 'ok') {
      return [$status, NULL];
    }
    $value = match ($kind) {
      'address' => $this->address((string) $value, $node->language(), $cacheability),
      'image' => $this->uriImage($value, $cacheability),
      default => $value,
    };
    return [$value === NULL || $value === '' ? 'empty' : 'ok', $value];
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
   * @return array{head: array{title: string, meta: list<array<string, string>>, link: list<array<string, string>>, script: list<array{type: string, textContent: array}>}, image: ?array, schema: array{withheld: bool, missing_required: list<string>, missing_recommended: list<string>}, cacheability: \Drupal\Core\Cache\CacheableMetadata}
   *   The head in emission order, the effective social image, the report of
   *   the structured data and everything the result depends on.
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
    $identity = $layers['identity'];
    $effective = Values::cascade(array_replace_recursive($layers['from_default'], $layers['target']), $layers['site']);
    $facts = $this->facts($entity, $cacheability);

    // What a value gives for this entity, by kind; each value is read once.
    $memo = [];
    $value = function (array $value, string $kind) use ($entity, $facts, $cacheability, &$memo): string|array|null {
      $key = json_encode([$value, $kind]);
      if (!array_key_exists($key, $memo)) {
        $memo[$key] = match (array_key_first($value)) {
          'text' => $value['text'],
          'fact' => $kind === 'image' ? $facts[$value['fact']]['image'] ?? NULL : $facts[$value['fact']]['value'] ?? '',
          'media' => $this->image($value['media'], $cacheability),
          'source' => $entity->getEntityTypeId() === 'node' ? $this->link($value['source'], $entity, $kind, $cacheability)[1] : NULL,
          default => NULL,
        };
      }
      return $memo[$key];
    };
    $texts = Values::texts($effective, static fn (array $v): string => (string) (is_string($found = $value($v, 'text')) ? $found : ''), $identity['separator'], $layers['site']['title_end'] ?? NULL);
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

    $report = SchemaGraph::build([
      'home' => $origin['url'] . '/',
      'url' => $own,
      'langcode' => $entity->language()->isLocked() ? '' : $entity->language()->getId(),
      'title' => Values::plain($facts['title']['value'], 255),
      'description' => $texts['description'],
      'published' => $facts['published']['value'],
      'modified' => $facts['modified']['value'],
      'timezone' => $this->timezone(),
      'identity' => ['kind' => $identity['kind'], 'name' => $site_name, 'same_as' => $identity['same_as']],
      'logo' => $identity['logo'] === '' ? NULL : $this->image($identity['logo'], $cacheability),
      'image' => $image,
      'facts' => ['sep' => $identity['separator'], 'image' => $facts['image']['image']['url'] ?? '']
      + array_map(static fn (array $fact): string => $fact['value'], array_diff_key($facts, ['image' => TRUE])),
    ], $effective['schema'] ?? [], $value);
    $og_type = SchemaGraph::types()[$effective['schema']['type'] ?? 'WebPage']['og_type'] ?? 'website';
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

    $result = [
      'head' => [
        'title' => $texts['title'],
        // Rows with an empty value are omitted; a URL is absolute or dropped.
        'meta' => array_values(array_filter($meta, static fn (array $row): bool => $row['content'] !== '')),
        'link' => array_values(array_filter($link, static fn (array $row): bool => Values::isHttpUrl($row['href']))),
        'script' => [['type' => 'application/ld+json', 'textContent' => $report['graph']]],
      ],
      'image' => $image,
      'schema' => array_diff_key($report, ['graph' => TRUE]),
      'cacheability' => $cacheability,
    ];
    $this->resolved[$entity] = ['request' => $request, 'draft' => $draft, 'result' => $result];
    return $result;
  }

  /**
   * The site layer and the identity, read with configuration overrides.
   *
   * @return array{site: array, identity: array}
   *   Both cleaned in read mode.
   */
  private function site(CacheableMetadata $cacheability): array {
    $config = $this->configFactory->get('canvas_metatag.site');
    $cacheability->addCacheableDependency($config);
    $values = $config->get('values');
    $identity = $config->get('identity');
    return [
      'site' => Values::clean(is_array($values) ? $values : [], 'site', NULL)[0],
      'identity' => Values::cleanIdentity(is_array($identity) ? $identity : [])[0],
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
