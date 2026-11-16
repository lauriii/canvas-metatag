<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Controller;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Controller\AutoSaveValidateTrait;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_metatag\Values;
use Drupal\Component\Utility\NestedArray;
use Drupal\Component\Uuid\Uuid;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Config\Entity\ConfigEntityStorageInterface;
use Drupal\Core\DependencyInjection\AutowireTrait;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityPublishedInterface;
use Drupal\Core\Entity\EntityRepositoryInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Extension\ModuleHandlerInterface;
use Drupal\Core\Language\LanguageInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Url;
use Drupal\media\Plugin\media\Source\Image;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * The JSON API of the SEO dialog.
 *
 * Every route is uncached and answers its own errors in one JSON shape.
 */
final class ApiController implements ContainerInjectionInterface {

  use AutowireTrait;
  // Canvas's own conflict rule; @internal, pinned by PageDraftTest. The trait
  // reads $this->autoSaveManager, so the property must have exactly that name.
  use AutoSaveValidateTrait;

  private const MAX_BODY = 131072;

  private const PAGE_SIZE = 24;

  public function __construct(
    private readonly AutoSaveManager $autoSaveManager,
    private readonly Resolver $resolver,
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly EntityRepositoryInterface $entityRepository,
    private readonly ConfigFactoryInterface $configFactory,
    private readonly LanguageManagerInterface $languageManager,
    private readonly ModuleHandlerInterface $moduleHandler,
    private readonly AccountInterface $currentUser,
    private readonly Sources $sources,
  ) {}

  /**
   * Everything the dialog needs to open: settings, facts, links and output.
   *
   * The context is a page, a content template with the node it is previewed
   * with (or without one, when its type has no content yet), or nothing.
   */
  public function state(Request $request): JsonResponse {
    $query = $request->query->all();
    $param = static fn (string $name): mixed => $query[$name] ?? NULL;
    $context = match (TRUE) {
      $param('entity_type') === 'canvas_page' && is_string($param('id')) && $param('preview') === NULL
        => $this->pageContext($param('id'), $param('langcode')),
      $param('entity_type') === 'content_template' && is_string($param('id')) && ($param('preview') === NULL || is_string($param('preview'))) && $param('langcode') === NULL
        => $this->templateContext($param('id'), $param('preview')),
      array_intersect_key($query, array_flip(['entity_type', 'id', 'preview', 'langcode'])) === []
        => [
          'target' => NULL,
          'can' => FALSE,
          'entity' => $this->anyPage(),
          'draft' => FALSE,
          'vocabulary' => [Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID],
        ],
      default => self::badRequest(),
    };
    if ($context instanceof JsonResponse) {
      return $context;
    }
    ['target' => $target, 'entity' => $entity, 'draft' => $draft, 'vocabulary' => [, $bundle]] = $context;

    // The edit copy is what is stored, not what a configuration override
    // makes of it; the resolver keeps reading with overrides.
    $config = $this->configFactory->getEditable('canvas_metatag.site');
    $identity = Values::cleanIdentity($config->get('identity') ?? [])[0];
    $capabilities = ['ai' => NULL];
    $this->moduleHandler->alter('canvas_metatag_capabilities', $capabilities);
    // The route is not cached, so nothing reads this.
    $cacheability = new CacheableMetadata();
    $media = $this->describeMedia([
      $identity['logo'],
      $identity['default_image'],
      $target['values']['social']['image']['media'] ?? '',
      $target['from_default']['social']['image']['media'] ?? '',
      ...array_column($target['values']['schema']['props'] ?? [], 'media'),
    ]);
    $template = ($target['scope'] ?? NULL) === 'template';
    $broken = $template ? $this->broken($target['values'], $bundle) : [];
    if ($target !== NULL) {
      // An empty map is an object in JSON.
      $target['values'] = (object) $target['values'];
      $target['from_default'] = (object) $target['from_default'];
    }

    return new JsonResponse([
      'langcode' => $entity !== NULL && $entity->getEntityTypeId() === Page::ENTITY_TYPE_ID
        ? $entity->language()->getId()
        : $this->languageManager->getDefaultLanguage()->getId(),
      'languages' => array_map(static fn (LanguageInterface $language): string => $language->getName(), $this->languageManager->getLanguages()),
      'origin' => $this->resolver->origin($cacheability),
      'can' => [
        'target' => $context['can'],
        'site' => $this->currentUser->hasPermission('administer canvas metatag'),
      ],
      'capabilities' => ['ai' => $capabilities['ai'] ?? NULL],
      'site' => [
        'identity' => $identity,
        'values' => (object) Values::clean($config->get('values') ?? [], 'site', NULL)[0],
      ],
      'target' => $target,
      'preview' => $entity === NULL ? NULL : [
        'entity_type' => $entity->getEntityTypeId(),
        'id' => (string) $entity->id(),
        'label' => (string) $entity->label(),
        'url' => $this->resolver->url($entity, $cacheability),
        // A page's draft carries the status it will get; what counts is
        // whether visitors can see it now.
        'published' => ($target['scope'] ?? NULL) === 'page'
          ? $target['published']
          : !$entity instanceof EntityPublishedInterface || $entity->isPublished(),
      ],
      'facts' => $this->resolver->facts($entity, $cacheability),
      'separator' => $this->resolver->separator($cacheability),
      // Only a template links fields; read with its preview node.
      'sources' => $template ? $this->resolver->sourceRows($entity, $bundle, $cacheability) : [],
      'broken' => (object) $broken,
      'media' => (object) $media,
      'resolved' => $entity === NULL ? NULL : array_diff_key($this->resolver->resolve($entity, $draft), ['cacheability' => TRUE]),
    ]);
  }

  /**
   * Saves the site identity and the site-wide defaults. Last save wins.
   */
  public function putSite(Request $request): JsonResponse {
    $body = self::body($request, ['identity', 'values']);
    if ($body === NULL) {
      return self::badRequest();
    }
    [$identity, $identity_errors] = Values::cleanIdentity($body['identity']);
    [$values, $errors] = Values::clean($body['values'], 'site', static fn (): bool => FALSE);
    $config = $this->configFactory->getEditable('canvas_metatag.site');
    if ($errors) {
      $stored = $config->get('values');
      [$values, $errors] = self::carry($body['values'], $values, $errors, Values::clean(is_array($stored) ? $stored : [], 'site', NULL)[0], 'site');
    }
    if ($errors + $identity_errors) {
      return self::error(422, 'invalid', 'Some values need attention.', $errors + $identity_errors);
    }
    $config->set('identity', $identity)->set('values', $values)->save();
    return new JsonResponse(['site' => ['identity' => $identity, 'values' => (object) $values]]);
  }

  /**
   * Lists published image media the user may view, newest first.
   *
   * For the picker of the logo, the default image and the social image.
   * The `page` parameter counts from 0.
   */
  public function media(Request $request): JsonResponse {
    $query = $request->query->all();
    $name = is_string($query['q'] ?? NULL) ? trim($query['q']) : '';
    $page = is_string($query['page'] ?? NULL) && preg_match('/^\d{1,6}$/D', $query['page']) ? (int) $query['page'] : 0;
    $types = [];
    if ($this->entityTypeManager->hasDefinition('media')) {
      foreach ($this->entityTypeManager->getStorage('media_type')->loadMultiple() as $id => $type) {
        if ($type->getSource() instanceof Image) {
          $types[] = $id;
        }
      }
    }
    $ids = [];
    $items = [];
    if ($types) {
      $storage = $this->entityTypeManager->getStorage('media');
      $select = $storage->getQuery()
        ->accessCheck(TRUE)
        // An unpublished image can never be emitted, so it is not offered.
        ->condition('status', 1)
        ->condition('bundle', $types, 'IN')
        ->sort('created', 'DESC')
        ->sort('mid', 'DESC')
        // One more than a page, to know whether another one follows.
        ->range($page * self::PAGE_SIZE, self::PAGE_SIZE + 1);
      if ($name !== '') {
        $select->condition('name', $name, 'CONTAINS');
      }
      $ids = $select->execute();
      foreach ($storage->loadMultiple(array_slice($ids, 0, self::PAGE_SIZE)) as $media) {
        $image = $media->access('view') ? $this->resolver->describe($media) : NULL;
        if ($image !== NULL) {
          $items[] = ['uuid' => $media->uuid()]
            + self::pick($image, ['name', 'thumb', 'width', 'height', 'bytes', 'alt']);
        }
      }
    }
    // The query cannot check media access (core has no query access for
    // media). A page the user may view none of ends the list, so that the
    // picker never offers an endless run of empty pages.
    return new JsonResponse(['items' => $items, 'more' => $items !== [] && count($ids) > self::PAGE_SIZE]);
  }

  /**
   * Writes the SEO overrides of a page translation into its Canvas draft.
   */
  public function putPage(Request $request, Page $canvas_page): JsonResponse {
    $body = self::draftBody($request);
    $langcode = $body['langcode'] ?? NULL;
    if ($body === NULL || !is_string($langcode)) {
      return self::badRequest();
    }
    $page = $this->translation($canvas_page, $langcode);
    if ($page === NULL) {
      return self::error(404, 'not_found', 'This page has no version in that language.');
    }
    if (!$page->access('update')) {
      return self::error(403, 'forbidden', 'You cannot edit this page.');
    }
    // A translation's structured-data details belong to the type it inherits,
    // as the dialog shows it: from the default translation's draft.
    $preview = $this->autoSaveManager->getAutoSaveEntityForPreview($page)->entity;
    $type = $this->resolver->layers($preview instanceof Page ? $preview : $page, FALSE, new CacheableMetadata())['from_default']['schema']['type'] ?? 'WebPage';
    // While that type is only a draft, the details of the published type,
    // which the dialog cannot show, are kept: taking the type change back
    // must lose none of them. Only for a translation that inherits the type,
    // before and after this write: one with a type of its own is not
    // affected by the default's type change.
    $published = $this->resolver->layers($page, FALSE, new CacheableMetadata())['from_default']['schema']['type'] ?? 'WebPage';
    $keep = [];
    if ($published !== $type && empty($body['values']['schema']['type'])) {
      $current = $this->autoSaveManager->getAutoSaveEntity($page, TRUE)->entity;
      $current = Values::decode(($current instanceof Page ? $current : $page)->get('canvas_metatag')->value);
      if (!isset($current['schema']['type'])) {
        $props = Values::clean($current, 'page', NULL, $published)[0]['schema']['props'] ?? [];
        $keep = array_diff_key($props, array_column(SchemaGraph::types()[$type]['props'] ?? [], 'key', 'key'));
      }
    }
    return $this->putDraft($page, 'page', static fn (): bool => FALSE, $body, $type, $keep);
  }

  /**
   * Writes the SEO defaults of a content type into its template's Canvas draft.
   */
  public function putTemplate(Request $request, ContentTemplate $content_template): JsonResponse {
    $body = self::draftBody($request);
    if ($body === NULL) {
      return self::badRequest();
    }
    // The route object may carry configuration overrides and was used for
    // access only; what is edited is what is stored.
    $storage = $this->entityTypeManager->getStorage('content_template');
    assert($storage instanceof ConfigEntityStorageInterface);
    $template = $storage->loadOverrideFree($content_template->id());
    if (!$template instanceof ContentTemplate || $template->getTargetEntityTypeId() !== 'node' || $template->getMode() !== 'full') {
      return self::error(404, 'not_found', 'SEO settings exist only for the full content template of a content type.');
    }
    $bundle = $template->getTargetBundle();
    return $this->putDraft($template, 'template', fn (array $source, string $kind): bool => $this->sources->accepts($bundle, $source, $kind), $body);
  }

  /**
   * Validates, then writes into the draft under the editor's client id.
   *
   * Nothing slow may run between reading the draft and writing it: an editor
   * save landing in that window would be overwritten without an error.
   *
   * @param \Drupal\canvas\Entity\Page|\Drupal\canvas\Entity\ContentTemplate $entity
   *   The stored page translation, or the template loaded override-free. It
   *   is never saved.
   * @param string $scope
   *   Either 'page' or 'template'.
   * @param callable(array, string): bool $accepts
   *   Whether a source may be stored for a value of a kind.
   * @param array<string, mixed> $body
   *   The request body, as draftBody() returned it.
   * @param string $type
   *   The structured-data type the values inherit.
   * @param array<string, string> $keep
   *   Structured-data details written besides the values and never echoed:
   *   those of a page translation's published type (putPage()).
   */
  private function putDraft(Page|ContentTemplate $entity, string $scope, callable $accepts, array $body, string $type = 'WebPage', array $keep = []): JsonResponse {
    [$clean, $errors] = Values::clean($body['values'], $scope, $accepts, $type);
    // A refused value sent back exactly as the draft or the stored entity has
    // it is kept: an Undo back to the stored value while a draft exists.
    $draft = $errors ? $this->autoSaveManager->getAutoSaveEntity($entity, bypass_cache: TRUE)->entity : NULL;
    foreach ($errors ? array_filter([$draft, $entity]) : [] as $current) {
      $current = Values::clean(match (TRUE) {
        $current instanceof Page => Values::decode($current->get('canvas_metatag')->value),
        $current instanceof ContentTemplate => (array) $current->getThirdPartySetting('canvas_metatag', 'values', []),
        default => [],
      }, $scope, NULL, $type)[0];
      [$clean, $errors] = self::carry($body['values'], $clean, $errors, $current, $scope, $type);
    }
    if ($errors) {
      return self::error(422, 'invalid', 'Some values need attention.', $errors);
    }
    $key = AutoSaveManager::getAutoSaveKey($entity);
    try {
      // Exactly the rule Canvas applies to its own editor: with the same
      // client id only the starting point must match, with another one the
      // hash too. The entry is passed through as sent: Canvas compares it by
      // strict array identity.
      $this->validateAutoSaves([$entity], array_intersect_key($body['auto_saves'], [$key => TRUE]), $body['client_instance_id']);
    }
    catch (ConflictHttpException) {
      return self::error(409, 'conflict', 'The editor does not have the latest draft. Reload the editor.');
    }
    $draft = $this->autoSaveManager->getAutoSaveEntity($entity, bypass_cache: TRUE);
    // Never mutate the static-cached stored entity.
    $target = $draft->entity ?? clone $entity;
    if ($target instanceof Page) {
      $written = $clean;
      if ($keep) {
        $written['schema']['props'] = ($clean['schema']['props'] ?? []) + $keep;
      }
      $target->set('canvas_metatag', Values::encode($written));
    }
    elseif ($target instanceof ContentTemplate) {
      $clean
        ? $target->setThirdPartySetting('canvas_metatag', 'values', $clean)
        : $target->unsetThirdPartySetting('canvas_metatag', 'values');
    }
    $this->autoSaveManager->saveEntity($target, $body['client_instance_id']);
    return new JsonResponse(['values' => (object) $clean]);
  }

  /**
   * The template's links that cannot be read, by dotted path.
   *
   * @return array<string, array{field: string, reason: string}>
   *   The machine name of the field each starts from, and why: `missing`,
   *   `kind` or `error`.
   */
  private function broken(array $values, string $bundle): array {
    $kinds = [
      'title' => 'text',
      'title_end' => 'text',
      'description' => 'text',
      'social.title' => 'text',
      'social.description' => 'text',
      'social.image' => 'image',
    ];
    $props = array_column(SchemaGraph::types()[$values['schema']['type'] ?? 'WebPage']['props'] ?? [], 'kind', 'key');
    foreach ($props as $key => $kind) {
      $kinds["schema.props.$key"] = Values::KINDS[$kind];
    }
    $broken = [];
    foreach ($kinds as $path => $kind) {
      $source = NestedArray::getValue($values, [...explode('.', $path), 'source']);
      $reason = is_array($source) ? $this->sources->problem($bundle, $source, $kind) : NULL;
      if ($reason !== NULL) {
        $broken[$path] = ['field' => (string) Sources::machineName($source), 'reason' => $reason];
      }
    }
    return $broken;
  }

  /**
   * Carries forward each refused value that was sent back exactly as stored.
   *
   * Also when its vocabulary has changed since: read mode keeps it, and every
   * other field must stay savable.
   *
   * @param array $sent
   *   The values as sent.
   * @param array $clean
   *   What write mode kept of them.
   * @param array<string, string> $errors
   *   What write mode refused, by dotted path.
   * @param array $current
   *   The values in the draft or as stored, cleaned in read mode.
   * @param string $scope
   *   Either 'page', 'template' or 'site'.
   * @param string $type
   *   The structured-data type the values inherit.
   *
   * @return array{0: array, 1: array<string, string>}
   *   The clean values and the errors that remain.
   */
  private static function carry(array $sent, array $clean, array $errors, array $current, string $scope, string $type = 'WebPage'): array {
    foreach (array_keys($errors) as $path) {
      $parents = explode('.', (string) $path);
      $kept = NestedArray::getValue($current, $parents, $exists);
      if ($exists && $kept === NestedArray::getValue($sent, $parents)) {
        NestedArray::setValue($clean, $parents, $kept);
        unset($errors[$path]);
      }
    }
    return [Values::clean($clean, $scope, NULL, $type)[0], $errors];
  }

  /**
   * A page in one language: its stored translation, or a new one with a draft.
   *
   * Canvas keeps the draft of a translation that was never published under
   * that translation's key; it is added to the page when published.
   *
   * @return \Drupal\canvas\Entity\Page|null
   *   The translation, NULL when there is none in that language and no draft
   *   of one.
   */
  private function translation(Page $page, string $langcode): ?Page {
    if ($page->hasTranslation($langcode)) {
      return $page->getTranslation($langcode);
    }
    try {
      // On a copy: the stored page is statically cached.
      $candidate = (clone $page)->addTranslation($langcode);
    }
    catch (\InvalidArgumentException) {
      // Not a language of the site, or a page that cannot be translated.
      return NULL;
    }
    return $candidate instanceof Page && !$this->autoSaveManager->getAutoSaveEntity($candidate, TRUE)->isEmpty() ? $candidate : NULL;
  }

  /**
   * Decodes the body of a draft write.
   *
   * @return array<string, mixed>|null
   *   The body with `values` (a map), `client_instance_id` (a non-empty
   *   string) and `auto_saves` (a map of maps) checked and every other member
   *   untouched. NULL when it is too large, not a JSON object, or one of the
   *   three is missing or of the wrong type: there is no write path without
   *   the editor's client id.
   */
  private static function draftBody(Request $request): ?array {
    $body = self::body($request, ['values', 'auto_saves']);
    $valid = $body !== NULL
      && is_string($body['client_instance_id'] ?? NULL) && $body['client_instance_id'] !== ''
      && !array_filter($body['auto_saves'], static fn (mixed $entry): bool => !is_array($entry));
    return $valid ? $body : NULL;
  }

  /**
   * The request body, or NULL when it is too large or not a JSON object.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request.
   * @param list<string> $objects
   *   Members that must be JSON objects. Told from the raw JSON: decoded to
   *   arrays, an empty object and an empty list are alike.
   *
   * @return array<string, mixed>|null
   *   The decoded object.
   */
  private static function body(Request $request, array $objects = []): ?array {
    $content = $request->getContent();
    $raw = strlen($content) > self::MAX_BODY ? NULL : json_decode($content);
    if (!$raw instanceof \stdClass) {
      return NULL;
    }
    foreach ($objects as $member) {
      if (!($raw->{$member} ?? NULL) instanceof \stdClass) {
        return NULL;
      }
    }
    return json_decode($content, TRUE);
  }

  /**
   * The state of a page: its translation, and its draft for who may edit it.
   *
   * @return array{target: array, can: bool, entity: \Drupal\Core\Entity\ContentEntityInterface, draft: bool, vocabulary: array{string, string}}|\Symfony\Component\HttpFoundation\JsonResponse
   *   The context, or the error.
   */
  private function pageContext(string $id, mixed $langcode): array|JsonResponse {
    $page = ctype_digit($id) ? $this->entityTypeManager->getStorage(Page::ENTITY_TYPE_ID)->load($id) : NULL;
    // The translation the editor named, else the negotiated one.
    $page = match (TRUE) {
      !$page instanceof Page => NULL,
      $langcode === NULL => $this->entityRepository->getTranslationFromContext($page),
      default => is_string($langcode) ? $this->translation($page, $langcode) : NULL,
    };
    if (!$page instanceof Page) {
      return self::error(404, 'not_found', 'This page, or its version in that language, does not exist.');
    }
    // Canvas serves draft data only behind `update`, and so do we. The
    // preview variant of the draft holds every translation's pending changes,
    // which is what a headless preview resolves.
    $update = $page->access('update');
    $stored = !$page->isNewTranslation();
    if (!$stored && !$update) {
      // A translation that exists only as a draft is draft data.
      return self::error(404, 'not_found', 'This page, or its version in that language, does not exist.');
    }
    if (!$page->access('view')) {
      return self::forbidden();
    }
    $draft = $update ? $this->autoSaveManager->getAutoSaveEntityForPreview($page)->entity : NULL;
    $entity = $draft instanceof Page ? $draft : $page;
    $layers = $this->resolver->layers($entity, FALSE, new CacheableMetadata());
    return [
      'target' => [
        'scope' => 'page',
        'entity_type' => Page::ENTITY_TYPE_ID,
        'id' => (string) $page->id(),
        'label' => (string) $entity->label(),
        'auto_save_key' => AutoSaveManager::getAutoSaveKey($page),
        'translatable' => (bool) $page->getFieldDefinition('canvas_metatag')?->isTranslatable(),
        'default_langcode' => $page->getUntranslated()->language()->getId(),
        'published' => $stored && $page->isPublished(),
        'has_draft' => $update && !$this->autoSaveManager->getAutoSaveEntity($page, TRUE)->isEmpty(),
        'values' => $layers['target'],
        'from_default' => $layers['from_default'],
      ],
      'can' => $update && $this->currentUser->hasPermission('edit canvas metatag'),
      'entity' => $entity,
      'draft' => FALSE,
      'vocabulary' => [Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID],
    ];
  }

  /**
   * The state of a content type's template, previewed with one of its nodes.
   *
   * Without a node (a type with no content yet), the values and the type's
   * vocabulary only: no preview, no output.
   *
   * @return array{target: array, can: bool, entity: ?\Drupal\Core\Entity\ContentEntityInterface, draft: bool, vocabulary: array{string, string}}|\Symfony\Component\HttpFoundation\JsonResponse
   *   The context, or the error.
   */
  private function templateContext(string $id, ?string $preview): array|JsonResponse {
    $storage = $this->entityTypeManager->getStorage(ContentTemplate::ENTITY_TYPE_ID);
    assert($storage instanceof ConfigEntityStorageInterface);
    $template = $storage->loadOverrideFree($id);
    if (!$template instanceof ContentTemplate || $template->getTargetEntityTypeId() !== 'node' || $template->getMode() !== 'full') {
      return self::error(404, 'not_found', 'SEO settings exist only for the full content template of a content type.');
    }
    $node = NULL;
    if ($preview !== NULL) {
      $node = ctype_digit($preview) ? $this->entityTypeManager->getStorage('node')->load($preview) : NULL;
      if (!$node instanceof ContentEntityInterface || $node->bundle() !== $template->getTargetBundle()) {
        return self::error(404, 'not_found', 'The content to preview with does not exist.');
      }
      $node = $this->entityRepository->getTranslationFromContext($node);
    }
    if (!$template->access('view') || ($node !== NULL && !$node->access('view'))) {
      return self::forbidden();
    }
    $update = $template->access('update');
    $draft = $update ? $this->autoSaveManager->getAutoSaveEntity($template, TRUE)->entity : NULL;
    $values = ($draft instanceof ContentTemplate ? $draft : $template)->getThirdPartySetting('canvas_metatag', 'values');
    return [
      'target' => [
        'scope' => 'template',
        'entity_type' => ContentTemplate::ENTITY_TYPE_ID,
        'id' => $template->id(),
        'label' => (string) $this->entityTypeManager->getStorage('node_type')->load($template->getTargetBundle())?->label(),
        'auto_save_key' => AutoSaveManager::getAutoSaveKey($template),
        'translatable' => FALSE,
        'default_langcode' => NULL,
        'published' => $template->status(),
        'has_draft' => $draft !== NULL,
        // In canonical key order, whatever order the config system stored.
        'values' => Values::clean(is_array($values) ? $values : [], 'template', NULL)[0],
        'from_default' => [],
      ],
      'can' => $update && $this->currentUser->hasPermission('edit canvas metatag'),
      'entity' => $node,
      'draft' => $update,
      'vocabulary' => ['node', $template->getTargetBundle()],
    ];
  }

  /**
   * A page to preview the site settings with when the editor shows none.
   *
   * The front page when it is a Canvas page, else the published page that
   * changed last.
   */
  private function anyPage(): ?ContentEntityInterface {
    $storage = $this->entityTypeManager->getStorage(Page::ENTITY_TYPE_ID);
    $ids = $storage->getQuery()->accessCheck(TRUE)->condition('status', 1)->sort('changed', 'DESC')->range(0, 1)->execute();
    // The front page setting holds a system path or its alias.
    $front = (string) $this->configFactory->get('system.site')->get('page.front');
    $front = str_starts_with($front, '/') ? Url::fromUserInput($front) : NULL;
    if ($front?->isRouted() && $front->getRouteName() === 'entity.canvas_page.canonical') {
      array_unshift($ids, $front->getRouteParameters()[Page::ENTITY_TYPE_ID]);
    }
    foreach ($storage->loadMultiple($ids) as $page) {
      $page = $this->entityRepository->getTranslationFromContext($page);
      if ($page instanceof Page && $page->isPublished() && $page->access('view')) {
        return $page;
      }
    }
    return NULL;
  }

  /**
   * Describes the image media behind UUIDs, for the user who asks.
   *
   * @param array<mixed> $references
   *   Stored values; anything that is not a media UUID is skipped.
   *
   * @return array<string, array{name: string, thumb: string, width: int, height: int, bytes: int}>
   *   By UUID. One that is not a viewable image media is absent.
   */
  private function describeMedia(array $references): array {
    $uuids = array_values(array_unique(array_filter($references, static fn (mixed $value): bool => is_string($value) && Uuid::isValid($value))));
    $described = [];
    if ($uuids && $this->entityTypeManager->hasDefinition('media')) {
      foreach ($this->entityTypeManager->getStorage('media')->loadByProperties(['uuid' => $uuids]) as $media) {
        $image = $media->access('view') ? $this->resolver->describe($media) : NULL;
        if ($image !== NULL) {
          $described[(string) $media->uuid()] = self::pick($image, ['name', 'thumb', 'width', 'height', 'bytes']);
        }
      }
    }
    return $described;
  }

  /**
   * The named members of an array, in the order named.
   */
  private static function pick(array $values, array $keys): array {
    return array_merge(array_flip($keys), array_intersect_key($values, array_flip($keys)));
  }

  /**
   * The answer when the user may not see what was asked for.
   */
  private static function forbidden(): JsonResponse {
    return self::error(403, 'forbidden', 'You do not have access to this.');
  }

  /**
   * The answer to a body that cannot be used.
   */
  private static function badRequest(): JsonResponse {
    return self::error(400, 'bad_request', 'The request could not be read.');
  }

  /**
   * The error shape of every response of ours that is not 2xx.
   */
  private static function error(int $status, string $code, string $message, array $fields = []): JsonResponse {
    $error = ['code' => $code, 'message' => $message] + ($fields ? ['fields' => $fields] : []);
    return new JsonResponse(['error' => $error], $status);
  }

}
