<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas_headless\FrontendUrl;
use Drupal\Component\Utility\Html;
use Drupal\Component\Utility\Unicode;
use Drupal\Component\Uuid\Uuid;
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
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\Site\Settings;
use Drupal\Core\StreamWrapper\StreamWrapperManager;
use Drupal\Core\TypedData\OptionsProviderInterface;
use Drupal\Core\Url;
use Drupal\file\FileInterface;
use Drupal\link\LinkItemInterface;
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
   * The tokens every entity has: name => type.
   */
  private const TOKENS = [
    'title' => 'text',
    'description' => 'text',
    'site' => 'text',
    'sep' => 'text',
    'url' => 'url',
    'author' => 'text',
    'published' => 'datetime',
    'modified' => 'datetime',
    'image' => 'image',
  ];

  /**
   * From this size an image makes a large card.
   *
   * The dialog's link preview uses the same rule (`smallCard()` in model.ts).
   */
  private const LARGE_CARD = ['width' => 600, 'height' => 157];

  /**
   * What the dialog calls them.
   */
  private const LABELS = [
    'title' => 'Page title',
    'description' => 'Description',
    'site' => 'Site name',
    'sep' => 'Separator',
    'url' => 'Page address',
    'author' => 'Author',
    'published' => 'First published',
    'modified' => 'Last updated',
    'image' => 'Page image',
  ];

  /**
   * Field type => token type, for {field.NAME}.
   */
  private const FIELD_TYPES = [
    'string' => 'text',
    'string_long' => 'text',
    'email' => 'text',
    'telephone' => 'text',
    'list_string' => 'text',
    'text' => 'text',
    'text_long' => 'text',
    'text_with_summary' => 'text',
    'integer' => 'number',
    'decimal' => 'number',
    'float' => 'number',
    'datetime' => 'datetime',
    'daterange' => 'datetime',
    'timestamp' => 'datetime',
    'link' => 'url',
    'image' => 'image',
    'entity_reference' => 'text',
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
   * The account every access check runs for.
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
   * The token vocabulary of a bundle, for write-mode validation.
   *
   * A Canvas page has the tokens every entity has. Any other bundle adds one
   * {field.NAME} per configurable field of a supported type, in the order of
   * the bundle's form: fields not on the form follow, by name.
   *
   * @return array<string, string>
   *   Token name => type: text, number, datetime, url or image.
   */
  public function tokenTypes(string $entityTypeId, string $bundle): array {
    $types = self::TOKENS;
    if ($entityTypeId === 'canvas_page') {
      return $types;
    }
    $display = $this->entityTypeManager->getStorage('entity_form_display')->load("$entityTypeId.$bundle.default");
    $fields = [];
    foreach ($this->entityFieldManager->getFieldDefinitions($entityTypeId, $bundle) as $name => $definition) {
      $type = self::FIELD_TYPES[$definition->getType()] ?? NULL;
      if ($type !== NULL && !$definition->getFieldStorageDefinition()->isBaseField()) {
        $weight = $display instanceof EntityFormDisplayInterface ? $display->getComponent($name)['weight'] ?? NULL : NULL;
        $fields[$name] = [
          $weight === NULL ? 1 : 0,
          (int) $weight,
          $name,
          $this->referencesImageMedia($definition) ? 'image' : $type,
        ];
      }
    }
    // On the form by weight, then the rest; a tie by name.
    uasort($fields, static fn (array $a, array $b): int => array_slice($a, 0, 3) <=> array_slice($b, 0, 3));
    foreach ($fields as $name => $field) {
      $types["field.$name"] = $field[3];
    }
    return $types;
  }

  /**
   * The tokens of an entity with their values.
   *
   * Every value is what an anonymous visitor may see.
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface|null $entity
   *   The entity, or NULL for the vocabulary with empty values.
   * @param string $entityTypeId
   *   The entity type the vocabulary is for.
   * @param string $bundle
   *   Its bundle.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the values depend on.
   *
   * @return array<string, array{label: string, type: string, value: string, image?: ?array}>
   *   Token name => description. An image token has an empty `value` and an
   *   `image` member: the image array without `source`, or NULL.
   */
  public function tokens(?ContentEntityInterface $entity, string $entityTypeId, string $bundle, CacheableMetadata $cacheability): array {
    $definitions = $entityTypeId === 'canvas_page' ? [] : $this->entityFieldManager->getFieldDefinitions($entityTypeId, $bundle);
    $tokens = [];
    foreach ($this->tokenTypes($entityTypeId, $bundle) as $name => $type) {
      $tokens[$name] = [
        'label' => self::LABELS[$name] ?? (string) $definitions[substr($name, 6)]->getLabel(),
        'type' => $type,
        'value' => '',
      ] + ($type === 'image' ? ['image' => NULL] : []);
    }
    if ($entity === NULL) {
      return $tokens;
    }

    $langcode = $entity->language()->getId();
    $identity = $this->site($cacheability)['identity'];
    // With their overrides: a translated site name varies by language.
    $cacheability
      ->addCacheableDependency($this->configFactory->get('system.site'))
      ->addCacheableDependency($this->configFactory->get('system.date'));
    if ($entityTypeId !== 'canvas_page') {
      // A field added to the type, or a media type that changes its source,
      // changes the vocabulary; the form's order decides which field is first.
      // Creating a form display invalidates only the list tag.
      $display = $this->entityTypeManager->getStorage('entity_form_display')->load("$entityTypeId.$bundle.default");
      $cacheability->addCacheTags([
        'entity_field_info',
        'config:media_type_list',
        ...($display ? $display->getCacheTags() : $this->entityTypeManager->getDefinition('entity_form_display')->getListCacheTags()),
      ]);
    }
    $tokens['title']['value'] = (string) $entity->label();
    $tokens['site']['value'] = $identity['name'] !== '' ? $identity['name'] : (string) $this->configFactory->get('system.site')->get('name');
    $tokens['sep']['value'] = $identity['separator'];
    $tokens['url']['value'] = $this->url($entity, $cacheability);
    $tokens['author']['value'] = $this->label($entity instanceof EntityOwnerInterface ? $entity->getOwner() : NULL, $langcode, $cacheability);
    foreach (['published' => 'created', 'modified' => 'changed'] as $name => $field) {
      $tokens[$name]['value'] = $entity->hasField($field) ? $this->date($entity->get($field)->value) : '';
    }

    if ($entityTypeId === 'canvas_page') {
      $tokens['description']['value'] = (string) $entity->get('description')->value;
      $tokens['image']['image'] = $this->mediaImage($entity->get('image')->entity, $langcode, $cacheability);
      return $tokens;
    }

    $described = FALSE;
    foreach ($tokens as $name => $token) {
      if (!str_starts_with($name, 'field.')) {
        continue;
      }
      $items = $entity->get(substr($name, 6));
      // A field the visitor may not view resolves to empty. Only delta 0.
      $item = $this->allowed($items, 'view', $cacheability) ? $items->first() : NULL;
      $value = $item === NULL ? NULL : $this->fieldValue($item, $token['type'], $langcode, $cacheability);
      if ($token['type'] === 'image') {
        $tokens[$name]['image'] = is_array($value) ? $value : NULL;
        // {image} is the first image that resolves, in the form's order.
        $tokens['image']['image'] ??= $tokens[$name]['image'];
        continue;
      }
      $tokens[$name]['value'] = is_string($value) ? $value : '';
      // {description} is the first formatted text with a summary: the
      // summary, else the text cut at a word boundary.
      if (!$described && $items->getFieldDefinition()->getType() === 'text_with_summary') {
        $described = TRUE;
        $summary = self::text((string) $item?->get('summary')->getValue());
        $tokens['description']['value'] = $summary !== '' ? $summary : rtrim(Values::whole($tokens[$name]['value'], Unicode::truncate($tokens[$name]['value'], 160, TRUE)));
      }
    }
    return $tokens;
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

    $tokens = $this->tokens($entity, $entity->getEntityTypeId(), $entity->bundle(), $cacheability);
    $map = array_map(static fn (array $token): string => $token['value'], $tokens);
    $fill = static fn (string $template, bool $keep = FALSE): string => Values::fill($template, $map, $keep);
    $texts = Values::texts($effective, $map);
    $site_name = Values::plain($map['site'], 255);

    // The canonical may point elsewhere. The entity's own URL stays the
    // identity of its structured data.
    $origin = $this->origin($cacheability);
    $own = $map['url'];
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

    // A media UUID or an image token => the image, or NULL.
    $find = function (string $reference) use ($tokens, $cacheability): ?array {
      return preg_match(Values::TOKEN, $reference, $m) && $m[0] === $reference
        ? $tokens[$m[1]]['image'] ?? NULL
        : $this->image($reference, $cacheability);
    };
    $image = NULL;
    $chain = [
      [$effective['social']['image'] ?? '', NULL],
      ['{image}', 'entity'],
      [$identity['default_image'], 'site'],
    ];
    foreach ($chain as [$reference, $source]) {
      $image = $reference === '' ? NULL : $find($reference);
      if ($image !== NULL) {
        $image['source'] = $source ?? (Uuid::isValid($reference) ? 'override' : 'entity');
        break;
      }
    }

    $report = SchemaGraph::build([
      'home' => $origin['url'] . '/',
      'url' => $own,
      'langcode' => $entity->language()->isLocked() ? '' : $entity->language()->getId(),
      'title' => Values::plain($map['title'], 255),
      'description' => $texts['description'],
      'published' => $map['published'],
      'modified' => $map['modified'],
      'timezone' => $this->timezone(),
      'identity' => ['kind' => $identity['kind'], 'name' => $site_name, 'same_as' => $identity['same_as']],
      'logo' => $identity['logo'] === '' ? NULL : $this->image($identity['logo'], $cacheability),
      'image' => $image,
    ], $effective['schema'] ?? [], $fill, $find);
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
      ['property' => 'article:published_time', 'content' => $article ? $map['published'] : ''],
      ['property' => 'article:modified_time', 'content' => $article ? $map['modified'] : ''],
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
   * The value of one field item: text, or an image array, or NULL.
   */
  private function fieldValue(FieldItemInterface $item, string $type, string $langcode, CacheableMetadata $cacheability): string|array|null {
    $definition = $item->getFieldDefinition();
    $property = $definition->getFieldStorageDefinition()->getMainPropertyName();
    $value = $property === NULL ? NULL : $item->get($property)->getValue();
    $reference = $definition->getType() === 'entity_reference' ? $item->get('entity')->getValue() : NULL;
    return match ($definition->getType()) {
      'list_string' => (string) ($item instanceof OptionsProviderInterface ? $item->getPossibleOptions()[$value] ?? $value : $value),
      // HTML by definition, so tags go here and nowhere else.
      'text', 'text_long' => self::text((string) $value),
      'text_with_summary' => self::text((string) $item->get('summary')->getValue()) ?: self::text((string) $value),
      // Stored in UTC. A date-only field stays date-only.
      'datetime', 'daterange' => $definition->getSetting('datetime_type') === 'date'
        ? (string) $value
        : $this->date(strtotime($value . ' UTC') ?: NULL),
      'timestamp' => $this->date($value),
      // With the digits the field stores, whatever the database hands back.
      'decimal' => number_format((float) $value, (int) $definition->getSetting('scale'), '.', ''),
      'link' => $item instanceof LinkItemInterface ? $this->link($item, $cacheability) : '',
      // Named by its alt text, as a media item by its label; else the file.
      'image' => $this->usable($item, $cacheability) ? $this->fileImage($item, Values::plain((string) $item->get('alt')->getValue(), 255) ?: NULL) : NULL,
      'entity_reference' => $type === 'image'
        ? $this->mediaImage($reference, $langcode, $cacheability)
        : $this->label($reference, $langcode, $cacheability),
      default => (string) $value,
    };
  }

  /**
   * The absolute http(s) URL of a link field item, or ''.
   */
  private function link(LinkItemInterface $item, CacheableMetadata $cacheability): string {
    try {
      $url = $this->publicUrl($item->getUrl(), $cacheability);
    }
    catch (\InvalidArgumentException) {
      return '';
    }
    return Values::isHttpUrl($url) ? $url : '';
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
   *
   * The original file with its real dimensions: no image style. `name` and
   * `thumb` are for the dialog and are never emitted.
   */
  private function fileImage(FieldItemInterface $item, ?string $name = NULL): ?array {
    $file = $item->get('entity')->getValue();
    if (!$file instanceof FileInterface) {
      return NULL;
    }
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
      'width' => (int) $item->get('width')->getValue(),
      'height' => (int) $item->get('height')->getValue(),
      'alt' => Values::plain((string) $item->get('alt')->getValue(), 1000),
      'bytes' => (int) $file->getSize(),
      'mime' => (string) $file->getMimeType(),
      'name' => $name ?? (string) $file->getFilename(),
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
   * Formatted text as plain text.
   *
   * The content of elements that never display (script, style, template,
   * also nested templates) removed, then tags stripped, entities decoded
   * once, whitespace collapsed. A heading, list item, definition, table row
   * or caption ends a sentence, as does the text before a list or a heading:
   * a full stop follows it unless it ends in a stop, an ellipsis, a question
   * or exclamation mark, a colon, semicolon or comma, or their equivalents in
   * other scripts (closing quotes and brackets after it included). Such an
   * element with no text of its own still ends the text before it. An opening
   * tag may hold ">" in a quoted attribute. Should a markup pattern fail, the
   * text is kept as it was; text that is not valid UTF-8 gives an empty
   * string.
   */
  private static function text(string $html): string {
    if (!mb_check_encoding($html, 'UTF-8')) {
      return '';
    }
    // The end of a sentence. Entities never decode to a control character,
    // so only the text's own need removing.
    $end = "\x01";
    $html = str_replace($end, '', $html);
    $attributes = '(?:"[^"]*+"|\'[^\']*+\'|[^\'">]++)*+';
    $html = preg_replace('~<(script|style)\b' . $attributes . '>(?:[^<]++|<(?!/\1\s*>))*+(?:</\1\s*>|\z)~i', ' ', $html) ?? $html;
    $html = preg_replace('~<template\b' . $attributes . '>(?:[^<]++|(?R)|<(?!/?template\b))*+(?:</template\s*>|\z)~i', ' ', $html) ?? $html;
    $html = preg_replace('~</(?:h[1-6]|li|dd|tr|caption)\s*>|<(?:ul|ol|dl|h[1-6])(?=[\s\/>])~i', $end . '$0', $html) ?? $html;
    // A space keeps the words of neighboring blocks apart; inline markup
    // joins its words as written.
    $html = preg_replace('~<(?=/?(?:p|div|br|li|ul|ol|h[1-6]|td|th|tr|blockquote|pre|hr|dt|dd|section|article|figure|figcaption)[\s\/>])~i', ' <', $html) ?? $html;
    $text = Html::decodeEntities(strip_tags($html));
    // Nested ends are one end; after a sentence or clause mark, or with
    // nothing before it, an end adds nothing; else a full stop.
    $ends = '[.!?…:;,。！？、，．：；｡؟۔।॥،؛][\p{Pe}\p{Pf}"\'»]*';
    // Should this fail, no mark is left in the text.
    $text = preg_replace(['/\s*\x01(?:\s*\x01)*/u', "/(^|$ends)\x01/u", '/\x01/'], [$end, '$1', '.'], $text) ?? str_replace($end, ' ', $text);
    return trim((string) preg_replace('/\s+/u', ' ', $text));
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
