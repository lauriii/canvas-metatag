<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Hook;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas_headless\Controller\CanvasContentController;
use Drupal\canvas_metatag\Controller\HeadlessContentController;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Values;
use Drupal\canvas_metatag\Vocabulary;
use Drupal\Core\Access\AccessResult;
use Drupal\Core\Access\AccessResultInterface;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\DependencyInjection\ClassResolverInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Entity\EntityFormInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Extension\ModuleHandlerInterface;
use Drupal\Core\Extension\Requirement\RequirementSeverity;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Field\FieldDefinitionInterface;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Hook\Order\Order;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Render\Markup;
use Drupal\Core\Routing\RouteMatchInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Site\Settings;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Core\Utility\Error;
use Symfony\Component\DependencyInjection\Attribute\AutowireServiceClosure;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Hook implementations for Canvas Metatag.
 */
final class CanvasMetatagHooks {

  /**
   * The one encoding of JSON-LD that is printed into HTML.
   *
   * Hex escaping keeps any text from ending the script element or starting a
   * comment in it.
   */
  public const JSON_FLAGS = Values::OUTPUT_FLAGS;

  public function __construct(
    private readonly Resolver $resolver,
    private readonly RouteMatchInterface $routeMatch,
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly LoggerChannelFactoryInterface $loggerFactory,
    private readonly ModuleHandlerInterface $moduleHandler,
    private readonly ClassResolverInterface $classResolver,
    private readonly AutoSaveManager $autoSaveManager,
    private readonly RequestStack $requestStack,
    // Only the status report reads it: built when it does, never for a page.
    #[AutowireServiceClosure(Vocabulary::class)]
    private readonly \Closure $vocabulary,
    #[AutowireServiceClosure(ShareHooks::class)]
    private readonly \Closure $share,
  ) {}

  /**
   * Implements hook_entity_base_field_info().
   */
  #[Hook('entity_base_field_info')]
  public function entityBaseFieldInfo(EntityTypeInterface $entity_type): array {
    if ($entity_type->id() !== 'canvas_page') {
      return [];
    }
    // No display options: the editor never re-posts a field that is not in the
    // entity form, so a value we put into the draft is carried forward. No
    // default value: a draft written before install must not gain one. No
    // preSave() rewriting and no field access restriction: Canvas refuses to
    // publish a page whose changed field the publisher cannot edit.
    return [
      'canvas_metatag' => BaseFieldDefinition::create('string_long')
        ->setLabel(new TranslatableMarkup('SEO overrides'))
        ->setDescription(new TranslatableMarkup('Sparse JSON written by the SEO dialog.'))
        ->setRevisionable(TRUE)
        ->setTranslatable(TRUE),
    ];
  }

  /**
   * Implements hook_ENTITY_TYPE_translation_create() for canvas_page.
   *
   * Core copies every translatable field into a new translation. Without this
   * it would start with the source language's title and social text, its
   * noindex and its canonical.
   */
  #[Hook('canvas_page_translation_create')]
  public function translationCreate(ContentEntityInterface $translation): void {
    $translation->set('canvas_metatag', NULL);
  }

  /**
   * Implements hook_ENTITY_TYPE_presave() for canvas_page.
   *
   * Canvas publishes a translation that exists only as a draft by copying the
   * fields that differ from the stored default translation, so a value equal
   * to the default one's stays empty (translationCreate() empties it). Its
   * draft, which Canvas deletes only after this save, holds the value.
   *
   * UPSTREAM(canvas): compare a new translation against nothing (ask 7).
   * Then this finds nothing to restore and can be deleted.
   */
  #[Hook('canvas_page_presave')]
  public function pagePresave(ContentEntityInterface $page): void {
    $default = $page->getOriginal()?->getUntranslated()->get('canvas_metatag')->value;
    if ($default === NULL || $default === '') {
      return;
    }
    foreach (array_keys($page->getTranslationLanguages(FALSE)) as $langcode) {
      $translation = $page->getTranslation($langcode);
      if (!$translation->isNewTranslation() || !$translation->get('canvas_metatag')->isEmpty()) {
        continue;
      }
      $draft = $this->autoSaveManager->getAutoSaveEntity($translation, TRUE)->entity;
      if ($draft instanceof ContentEntityInterface && $draft->get('canvas_metatag')->value === $default) {
        $translation->set('canvas_metatag', $default);
      }
    }
  }

  /**
   * Implements hook_ENTITY_TYPE_duplicate() for canvas_page.
   *
   * A duplicated page must not point search engines back at its original.
   */
  #[Hook('canvas_page_duplicate')]
  public function duplicate(EntityInterface $duplicate, EntityInterface $entity): void {
    if (!$duplicate instanceof ContentEntityInterface) {
      return;
    }
    foreach (array_keys($duplicate->getTranslationLanguages()) as $langcode) {
      $translation = $duplicate->getTranslation($langcode);
      $values = Values::decode($translation->get('canvas_metatag')->value);
      if (isset($values['canonical'])) {
        unset($values['canonical']);
        $translation->set('canvas_metatag', Values::encode($values));
      }
    }
  }

  /**
   * Implements hook_page_attachments().
   *
   * The coupled adapter: the head of an owned route entity.
   */
  #[Hook('page_attachments')]
  public function pageAttachments(array &$attachments): void {
    $head = $this->head();
    if ($head === NULL) {
      if ($this->routeMatch->getRouteName() === 'entity.node.canonical') {
        // Enabling a content template later must invalidate this page.
        $attachments['#cache']['tags'] = [
          ...$attachments['#cache']['tags'] ?? [],
          ...$this->entityTypeManager->getDefinition(ContentTemplate::ENTITY_TYPE_ID)->getListCacheTags(),
        ];
      }
      return;
    }
    $resolved = $head['resolved'];
    // Tag and attribute names are ours and the values are plain text; the
    // render system escapes them. Links go to html_head, not html_head_link,
    // so that no Link headers are sent.
    // A key names one element: a row that repeats (og:locale:alternate, an
    // icon of another size) is told apart by its value.
    foreach ($resolved['head']['meta'] as $meta) {
      $key = $meta['name'] ?? $meta['property'];
      $attachments['#attached']['html_head'][] = [
        ['#tag' => 'meta', '#attributes' => $meta],
        'canvas_metatag:' . $key . ($key === 'og:locale:alternate' ? ':' . $meta['content'] : ''),
      ];
    }
    foreach ($resolved['head']['link'] as $link) {
      $attachments['#attached']['html_head'][] = [
        ['#tag' => 'link', '#attributes' => $link],
        'canvas_metatag:' . $link['rel'] . (isset($link['hreflang']) ? ':' . $link['hreflang'] : '') . (isset($link['sizes']) ? ':' . $link['sizes'] : ''),
      ];
    }
    if ($head['json_ld'] !== NULL) {
      $attachments['#attached']['html_head'][] = [
        [
          '#tag' => 'script',
          '#attributes' => ['type' => 'application/ld+json'],
          // The only markup this module declares safe: the encoder's output.
          '#value' => Markup::create($head['json_ld']),
        ],
        'canvas_metatag:jsonld',
      ];
    }
    CacheableMetadata::createFromRenderArray($attachments)
      ->addCacheableDependency($resolved['cacheability'])
      ->applyTo($attachments);
  }

  /**
   * Implements hook_page_attachments_alter().
   *
   * The hreflang links of content_translation point at the Drupal origin and
   * have no x-default; ours replace them. Where the head carries the site
   * icons, they replace core's default favicon.
   */
  #[Hook('page_attachments_alter')]
  public function pageAttachmentsAlter(array &$attachments): void {
    $head = isset($attachments['#attached']['html_head_link']) ? $this->head() : NULL;
    if ($head !== NULL) {
      $icons = in_array('icon', array_column($head['resolved']['head']['link'], 'rel'), TRUE);
      $attachments['#attached']['html_head_link'] = array_values(array_filter(
        $attachments['#attached']['html_head_link'],
        static fn (array $link): bool => !isset($link[0]['hreflang']) && !($icons && ($link[0]['rel'] ?? NULL) === 'icon'),
      ));
    }
  }

  /**
   * Implements hook_entity_view_alter().
   *
   * Core's entity view controller adds a canonical link and a shortlink.
   */
  #[Hook('entity_view_alter')]
  public function entityViewAlter(array &$build, EntityInterface $entity): void {
    if (!isset($build['#attached']['html_head_link'])) {
      return;
    }
    $owned = $this->head()['entity'] ?? NULL;
    if ($owned !== NULL && $owned->getEntityTypeId() === $entity->getEntityTypeId() && $owned->id() === $entity->id()) {
      $build['#attached']['html_head_link'] = array_values(array_filter(
        $build['#attached']['html_head_link'],
        static fn (array $link): bool => !in_array($link[0]['rel'] ?? NULL, ['canonical', 'shortlink'], TRUE),
      ));
    }
  }

  /**
   * Implements hook_preprocess_HOOK() for html.
   *
   * The html_head attachment cannot set the title. Everything the title
   * depends on was bubbled by pageAttachments().
   */
  #[Hook('preprocess_html')]
  public function preprocessHtml(array &$variables): void {
    $head = $this->head();
    if ($head !== NULL) {
      $variables['head_title'] = ['title' => $head['resolved']['head']['title']];
    }
  }

  /**
   * Implements hook_metatags_alter().
   *
   * One hook silences every output path of the Metatag module for an entity
   * whose head is ours, including the headless head builder.
   */
  #[Hook('metatags_alter', order: Order::Last)]
  public function metatagsAlter(array &$metatags, array &$context): void {
    $entity = $context['entity'] ?? NULL;
    try {
      $owned = $entity instanceof EntityInterface && $this->resolver->owns($entity);
    }
    catch (\Throwable $e) {
      // Metatag stays the fallback when ownership cannot be decided.
      Error::logException($this->loggerFactory->get('canvas_metatag'), $e);
      return;
    }
    if ($owned) {
      // Every tag kept, with no value: an empty tag outputs nothing, and the
      // Metatag module's token replacement fails on an empty list.
      $metatags = array_fill_keys(array_keys($metatags), '');
    }
  }

  /**
   * Implements hook_form_FORM_ID_alter() for canvas_page_form.
   */
  #[Hook('form_canvas_page_form_alter')]
  public function formCanvasPageFormAlter(array &$form): void {
    // The Metatag widget's title input would edit a value that no longer
    // renders.
    if (isset($form['metatags'])) {
      $form['metatags']['#access'] = FALSE;
    }
    // Canvas's own search preview cannot know the title pattern.
    if (isset($form['seo_settings']['serp_preview'])) {
      $form['seo_settings']['serp_preview']['#access'] = FALSE;
    }
  }

  /**
   * Implements hook_form_BASE_FORM_ID_alter() for node_form.
   *
   * On a node whose head is ours the Metatag widget would edit values that
   * no longer render.
   */
  #[Hook('form_node_form_alter')]
  public function formNodeFormAlter(array &$form, FormStateInterface $form_state): void {
    $form_object = $form_state->getFormObject();
    if (!isset($form['metatags']) || !$form_object instanceof EntityFormInterface) {
      return;
    }
    try {
      $form['metatags']['#access'] = !$this->resolver->owns($form_object->getEntity());
    }
    catch (\Throwable $e) {
      Error::logException($this->loggerFactory->get('canvas_metatag'), $e);
    }
  }

  /**
   * Implements hook_entity_field_access().
   *
   * The stored overrides are the dialog's working data: schema details the
   * head withholds, media it does not show, the custom JSON-LD source. What
   * visitors get is the head. Edit access stays open: Canvas refuses to
   * publish a page whose changed field the publisher cannot edit.
   */
  #[Hook('entity_field_access')]
  public function entityFieldAccess(string $operation, FieldDefinitionInterface $field_definition, AccountInterface $account, ?FieldItemListInterface $items = NULL): AccessResultInterface {
    if ($operation !== 'view' || $field_definition->getName() !== 'canvas_metatag' || $field_definition->getTargetEntityTypeId() !== 'canvas_page') {
      return AccessResult::neutral();
    }
    return AccessResult::forbiddenIf(
      !$account->hasPermission('edit canvas metatag') && !$account->hasPermission('administer canvas metatag'),
    )->cachePerPermissions();
  }

  /**
   * Implements hook_runtime_requirements().
   *
   * Which schema.org release the hand-added JSON-LD form reads. The headless
   * head is ours only while the controller canvas_headless
   * resolves is our decorator, and nothing else would tell that it stopped
   * being: the controller resolver makes this same call. Whether visitors
   * can use the public base (publicAddresses()), and whether the site makes
   * share images (ShareHooks::requirements()).
   */
  #[Hook('runtime_requirements')]
  public function runtimeRequirements(): array {
    // The schema.org vocabulary of the hand-added JSON-LD form: optional.
    $installed = ($this->vocabulary)()->installed();
    $requirements = [
      'canvas_metatag_vocabulary' => [
        'title' => new TranslatableMarkup('Schema.org vocabulary for SEO'),
        'value' => $installed === NULL ? new TranslatableMarkup('Not downloaded') : new TranslatableMarkup('Release @release', ['@release' => $installed['release']]),
        'description' => match (TRUE) {
          $installed === NULL => new TranslatableMarkup('The form of "Add your own JSON-LD" offers the types search features read. To offer every schema.org type, run drush canvas-metatag:vocabulary.'),
          version_compare($installed['release'], Vocabulary::RELEASE, '<') => new TranslatableMarkup('The module is tested with release @pinned. Run drush canvas-metatag:vocabulary to update.', ['@pinned' => Vocabulary::RELEASE]),
          default => new TranslatableMarkup("Schema.org's definitions are CC BY-SA 3.0."),
        },
        'severity' => RequirementSeverity::Info,
      ],
    ];
    if ($this->moduleHandler->moduleExists('canvas_headless')) {
      try {
        $ours = $this->classResolver->getInstanceFromDefinition(CanvasContentController::class) instanceof HeadlessContentController;
      }
      catch (\Throwable) {
        $ours = FALSE;
      }
      if (!$ours) {
        $requirements['canvas_metatag_headless'] = [
          'title' => new TranslatableMarkup('SEO for headless content'),
          'value' => new TranslatableMarkup('Not in use'),
          'description' => new TranslatableMarkup('The content API no longer runs through the SEO module, so headless responses carry neither its head tags nor those of the Metatag module. Update the SEO module for this Canvas version.'),
          'severity' => RequirementSeverity::Error,
        ];
      }
    }
    $requirements += ($this->share)()->requirements();
    $addresses = $this->publicAddresses();
    if ($addresses !== NULL) {
      $requirements['canvas_metatag_public_base'] = ['title' => new TranslatableMarkup('SEO public addresses')] + $addresses;
    }
    return $requirements;
  }

  /**
   * The status of the public base, when visitors cannot use it.
   *
   * A setting that is not an absolute address, or a base from the setting or
   * a frontend that is plain http or on a host no visitor reaches, is an
   * error, a warning while Drupal's own host is a
   * development host, and fine when the base is a development host too: a
   * local frontend is the normal local setup. A base from the request that
   * is plain http on a public host is a warning on a production-like host.
   *
   * @return array{value: string, description: \Drupal\Core\StringTranslation\TranslatableMarkup, severity: \Drupal\Core\Extension\Requirement\RequirementSeverity}|null
   *   The row without its title, or NULL for none.
   */
  private function publicAddresses(): ?array {
    $base = $this->resolver->origin(new CacheableMetadata());
    $host = (string) parse_url($base['url'], PHP_URL_HOST);
    $plain = strtolower((string) parse_url($base['url'], PHP_URL_SCHEME)) === 'http';
    $public = Values::isPublicHost($host);
    $development = Values::isDevelopmentHost((string) $this->requestStack->getCurrentRequest()?->getHost());
    $args = ['@address' => $base['url']];
    // A setting that is not an absolute address is ignored: said first, as
    // it is the fix the other rows would name. An empty string is how an
    // environment leaves it unset.
    $setting = Settings::get('canvas_metatag_public_base');
    if ($setting !== NULL && $setting !== '' && $base['source'] !== 'settings') {
      return [
        'value' => $base['url'],
        'description' => new TranslatableMarkup('canvas_metatag_public_base in settings.php is "@setting", which is not an absolute http or https address without a query or fragment, so pages use @address. Set it to the public https address for this environment, such as https://www.example.com.', $args + ['@setting' => is_scalar($setting) ? (string) $setting : get_debug_type($setting)]),
        'severity' => $development ? RequirementSeverity::Warning : RequirementSeverity::Error,
      ];
    }
    if ($base['source'] === 'request') {
      if (!$plain || !$public || $development) {
        return NULL;
      }
      $description = new TranslatableMarkup("Pages say their address is @address. If visitors use https, set Drupal's reverse proxy settings.", $args);
      return ['value' => $base['url'], 'description' => $description, 'severity' => RequirementSeverity::Warning];
    }
    if ($development && Values::isDevelopmentHost($host)) {
      return NULL;
    }
    if (!$public) {
      $description = $development
        ? new TranslatableMarkup('Pages tell visitors and search engines to use @address, which is not public. Set canvas_metatag_public_base in settings.php to the public address for this environment.', $args)
        : new TranslatableMarkup('Pages carry no address, because @address is not public. Set canvas_metatag_public_base in settings.php to the public address for this environment.', $args);
    }
    elseif ($plain) {
      $description = new TranslatableMarkup('Pages tell visitors and search engines to use @address, which is not https. Set canvas_metatag_public_base in settings.php to the public address for this environment.', $args);
    }
    else {
      return NULL;
    }
    return [
      'value' => $base['url'],
      'description' => $description,
      'severity' => $development ? RequirementSeverity::Warning : RequirementSeverity::Error,
    ];
  }

  /**
   * Implements hook_canvas_extension_info_alter().
   *
   * Static files are cached for a year, and index.html carries the hashes of
   * the built assets, so its own hash is the version of the extension.
   */
  #[Hook('canvas_extension_info_alter')]
  public function canvasExtensionInfoAlter(array &$definitions): void {
    $hash = hash_file('xxh64', dirname(__DIR__, 2) . '/extension/index.html');
    if (isset($definitions['canvas_metatag']['url']) && $hash !== FALSE) {
      $definitions['canvas_metatag']['url'] .= '?v=' . substr($hash, 0, 8);
    }
  }

  /**
   * The head of the current route, when it is ours.
   *
   * Only canonical routes; the route entity is already the negotiated
   * translation. Editor preview routes are left alone. A failure costs the
   * page its SEO head, never the page: it is logged, and the route keeps
   * core's head and the Metatag module's.
   *
   * @return array{entity: \Drupal\Core\Entity\ContentEntityInterface, resolved: array, json_ld: string}|null
   *   The entity, what the resolver made of it and the encoded JSON-LD.
   */
  private function head(): ?array {
    $entity = match ($this->routeMatch->getRouteName()) {
      'entity.canvas_page.canonical' => $this->routeMatch->getParameter('canvas_page'),
      'entity.node.canonical' => $this->routeMatch->getParameter('node'),
      default => NULL,
    };
    if (!$entity instanceof ContentEntityInterface) {
      return NULL;
    }
    try {
      if (!$this->resolver->owns($entity)) {
        return NULL;
      }
      // The resolver keeps its result for the request; each hook asks again.
      $resolved = $this->resolver->resolve($entity);
      return [
        'entity' => $entity,
        'resolved' => $resolved,
        // Left out by the resolver when it cannot be written out.
        'json_ld' => isset($resolved['head']['script'][0]) ? json_encode($resolved['head']['script'][0]['textContent'], self::JSON_FLAGS) : NULL,
      ];
    }
    catch (\Throwable $e) {
      Error::logException($this->loggerFactory->get('canvas_metatag'), $e);
      return NULL;
    }
  }

}
