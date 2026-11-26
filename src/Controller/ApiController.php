<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Controller;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Controller\AutoSaveValidateTrait;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\RegistryStrings;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\ShareImage;
use Drupal\canvas_metatag\ShareRenderer;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_metatag\Values;
use Drupal\canvas_metatag\Vocabulary;
use Drupal\canvas_metatag\Words;
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
use Drupal\Core\File\FileUrlGeneratorInterface;
use Drupal\Core\KeyValueStore\KeyValueFactoryInterface;
use Drupal\Core\Language\LanguageInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\State\StateInterface;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Core\Url;
use Drupal\locale\StringStorageInterface;
use Drupal\media\Plugin\media\Source\Image;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * The JSON API of the SEO dialog.
 *
 * Every route is uncached and answers its own errors in one JSON shape.
 */
final class ApiController implements ContainerInjectionInterface {

  use AutowireTrait {
    create as private autowired;
  }
  // Canvas's own conflict rule; @internal, pinned by PageDraftTest. The trait
  // reads $this->autoSaveManager, so the property must have exactly that name.
  use AutoSaveValidateTrait;

  private const MAX_BODY = 131072;

  private const PAGE_SIZE = 24;

  /**
   * A short, typical title: Site › Sharing's samples away from a page.
   *
   * The colour's contrast is measured on it when the title the sample shows
   * can't be drawn. Mirrored in model.ts (SAMPLE_TITLE).
   */
  public const SAMPLE_TITLE = 'About us';

  /**
   * The places a site save names before it counts the rest.
   */
  private const NAMED = 25;

  /**
   * Registry and rules keys whose strings the dialog shows.
   */
  private const SHOWN = [
    'label',
    'name',
    'variants',
    'earn',
    'not_for',
    'for',
    'where',
    'need',
    'reason',
    'why',
    'short',
    'elsewhere',
  ];

  /**
   * Registry and rules keys that hold only strings the dialog shows.
   */
  private const ALL_SHOWN = ['option_labels', 'say', 'confirm', 'about', 'labels'];

  /**
   * Locale storage, when the locale module is installed: it is optional.
   */
  private ?StringStorageInterface $localeStorage = NULL;

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
    private readonly Vocabulary $vocabulary,
    private readonly Words $words,
    #[Autowire(service: 'keyvalue')]
    private readonly KeyValueFactoryInterface $keyValue,
    private readonly ShareRenderer $shareRenderer,
    private readonly FileUrlGeneratorInterface $fileUrlGenerator,
    private readonly StateInterface $state,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    $controller = self::autowired($container);
    // Looked up, not autowired: a site without locale has no service to wire,
    // and older cores refuse a missing service even for a nullable argument.
    $controller->localeStorage = $container->has('locale.storage') ? $container->get('locale.storage') : NULL;
    return $controller;
  }

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
    $ui = $this->languageManager->getCurrentLanguage()->getId();
    // The strings the dialog shows, and which sentences have a translation:
    // built and read once for the registry and the rules.
    $strings = RegistryStrings::all();
    $translated = array_flip($this->translatedSentences($ui));
    $broken = $template ? $this->broken($target['values'], $bundle) : [];
    // The type an added @type list keeps, by node: the dialog checks it as
    // the server will.
    $schema = $target['values']['schema'] ?? [];
    $extend_types = Values::nodeTypes($schema['type'] ?? $target['from_default']['schema']['type'] ?? 'WebPage', $schema['props'] ?? [], $identity['kind']);
    if ($target !== NULL) {
      // An empty map is an object in JSON.
      $target['values'] = (object) $target['values'];
      $target['from_default'] = (object) $target['from_default'];
    }

    return new JsonResponse([
      'ui' => $ui,
      // The locale the dialog writes dates in: the one the server's words
      // use for the item (Words), so a date reads one way in the dialog.
      'date_locale' => str_replace('_', '-', $this->words->locale($entity?->language()->getId() ?? $this->languageManager->getDefaultLanguage()->getId())),
      'langcode' => $entity !== NULL && $entity->getEntityTypeId() === Page::ENTITY_TYPE_ID
        ? $entity->language()->getId()
        : $this->languageManager->getDefaultLanguage()->getId(),
      'languages' => array_map(static fn (LanguageInterface $language): string => $language->getName(), $this->languageManager->getLanguages()),
      'origin' => $this->resolver->origin($cacheability),
      // A frontend decides what to show where the head has nothing: the
      // dialog says so. The public base can't tell: the setting hides it.
      'headless' => $this->resolver->frontend() !== NULL,
      'can' => [
        'target' => $context['can'],
        'site' => $this->currentUser->hasPermission('administer canvas metatag'),
      ],
      'capabilities' => ['ai' => $capabilities['ai'] ?? NULL],
      'site' => [
        'identity' => $identity,
        'values' => (object) Values::clean($config->get('values') ?? [], 'site', NULL)[0],
        'currency' => Values::currency($config->get('currency'))[0],
        // The site's default country: the country a picker suggests first,
        // never a value of its own.
        'country' => in_array($country = (string) $this->configFactory->get('system.date')->get('country.default'), SchemaGraph::codes('country'), TRUE) ? $country : '',
        // The zone a typed date and time is stored in, unless the editor
        // chooses another (state only).
        'timezone' => (string) ($this->configFactory->get('system.date')->get('timezone.default') ?: 'UTC'),
      ],
      'share' => $this->sharing($identity),
      'registry' => self::shown(SchemaGraph::types(), $strings, $translated, $ui),
      'codes' => ['country' => SchemaGraph::codes('country')],
      // The ids the module emits, by name, with what each is anchored on:
      // hand-added items never take one, and a short id points at it.
      'module_ids' => SchemaGraph::MODULE_IDS,
      'extend_types' => $extend_types,
      // The schema.org vocabulary the site downloaded, read from
      // vocabulary() when the hand-added JSON-LD form needs it.
      'vocabulary' => ($installed = $this->vocabulary->installed()) === NULL ? NULL : ['release' => $installed['release']],
      // The path maps are data: their members are named like shown ones.
      'search_features' => self::shown(array_diff_key(SchemaGraph::searchFeatures(), ['props' => TRUE, 'site' => TRUE]), $strings, $translated, $ui) + SchemaGraph::searchFeatures(),
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
      // A type with no item yet still names the fields its Description and
      // Image would read.
      'facts' => $this->resolver->facts($entity, $cacheability, bundle: $template ? $bundle : NULL),
      'separator' => $this->resolver->separator($cacheability),
      // Only a template links fields; read with its preview node.
      'sources' => $template ? $this->resolver->sourceRows($entity, $bundle, $cacheability) : [],
      'broken' => (object) $broken,
      'media' => (object) $media,
      'resolved' => $entity === NULL ? NULL : $this->resolved($entity, $draft, $context['live'] ?? NULL),
    ]);
  }

  /**
   * The head the dialog shows, and the image it shares as the dialog sees it.
   *
   * `share`: what the module sends (a card, a share version cropped or
   * framed, or the original file), at the address the dialog previews it
   * from: the draft's image drawn in memory, never a public file; NULL when
   * no image is shared. On a published page with a draft, `share_changed`
   * says whether the draft shares another title or image than links already
   * shared show.
   */
  private function resolved(ContentEntityInterface $entity, bool $draft, ?ContentEntityInterface $live): array {
    $report = $this->resolver->report($entity, $draft);
    $share = $report['share'];
    $cacheability = new CacheableMetadata();
    $made = match (TRUE) {
      $share === NULL => NULL,
      isset($share['card']) => 'card',
      isset($share['file']) => ShareImage::treatment($report['image']['width'], $report['image']['height'], $share['chosen']) === 'cover' ? 'cover' : 'frame',
      default => 'original',
    };
    $result = array_diff_key($report, ['cacheability' => TRUE, 'share' => TRUE]);
    $result['share'] = $made === NULL ? NULL : [
      'made' => $made,
      'url' => $made === 'original' ? $share['original']['url'] : $this->resolver->previewUrl($entity, $share, $cacheability),
    ];
    if ($live !== NULL) {
      $shared = $this->resolver->resolve($live);
      $title = static fn (array $head): string => array_column($head['meta'], 'content', 'property')['og:title'] ?? '';
      $result['share_changed'] = $title($shared['head']) !== $title($report['head']) || self::shareKey($shared['share']) !== self::shareKey($share);
    }
    return $result;
  }

  /**
   * What tells one shared image from another: its input's hash, or its URL.
   */
  private static function shareKey(?array $share): ?string {
    return match (TRUE) {
      $share === NULL => NULL,
      isset($share['card']) => Resolver::hash($share['card']),
      isset($share['file']) => Resolver::hash(Resolver::photoInput($share['file'], $share['chosen'])),
      default => $share['original']['url'],
    };
  }

  /**
   * What Site › Sharing and the administrators' checks need to know.
   *
   * Why the site makes no share images ('fonts', 'files' or NULL); the
   * default theme's own logo; whether the logo cards are drawn with is an
   * SVG (they show its initial); the site image's alt text; whether there is
   * a front page to show as a sample; and, for
   * administrators, an address a headless frontend fetched the content API
   * at that visitors cannot reach (HeadlessContentController).
   */
  private function sharing(array $identity): array {
    $cacheability = new CacheableMetadata();
    $theme = (string) $this->configFactory->get('system.theme')->get('default');
    $theme_logo = $this->shareRenderer->themeLogo($theme);
    $logo = $identity['logo'] === '' ? NULL : $this->resolver->image($identity['logo'], $cacheability);
    $site = $identity['default_image'] === '' ? NULL : $this->resolver->image($identity['default_image'], $cacheability);
    return [
      'missing' => $this->shareRenderer->missing(),
      'theme_logo' => $theme_logo === NULL ? NULL : $this->fileUrlGenerator->generateString($theme_logo['path']),
      'svg' => $logo !== NULL
        ? $logo['mime'] === 'image/svg+xml'
        : $theme_logo !== NULL && str_ends_with(strtolower($theme_logo['path']), '.svg'),
      'site_alt' => $site['alt'] ?? '',
      // Whether Site › Sharing offers the front page as a sample.
      'home' => $this->frontPage() !== NULL,
      'host' => $this->currentUser->hasPermission('administer canvas metatag') ? $this->state->get('canvas_metatag.share_host') : NULL,
    ];
  }

  /**
   * A sample of what links show for Site › Sharing, from what is being edited.
   *
   * `sample` is `home` (what the front page shares: its own image, else what
   * a page without one shares) or `page` (a page without an image, titled
   * `title`); `name`, `logo`, `colour`, `share_fallback` and `default_image`
   * are the identity members as edited, checked as a save checks them ("Use
   * this image" before one is chosen shows none yet). Only administrators
   * edit them: for anyone else the stored ones are drawn, so no other image
   * is ever decoded here. Drawn in memory, never stored, never cached. The
   * answer carries the image (a data URL, or the address of an image the
   * site already serves), what it `shows` ('card', 'photo' or 'none': a link
   * without an image, as for a title the fonts cannot draw), the home page's
   * `description`, and what cards are drawn with: the colour, whether it was
   * picked from the logo, the text colour and the title's measured contrast.
   */
  public function shareSample(Request $request): JsonResponse {
    $query = $request->query->all();
    $sample = $query['sample'] ?? NULL;
    $title = $query['title'] ?? '';
    $members = array_flip(['name', 'logo', 'colour', 'share_fallback', 'default_image']);
    $editing = array_intersect_key($query, $members);
    if (!$this->currentUser->hasPermission('administer canvas metatag')) {
      $stored = $this->configFactory->get('canvas_metatag.site')->get('identity');
      $editing = array_intersect_key(is_array($stored) ? $stored : [], $members);
    }
    [$identity, $errors] = Values::cleanIdentity($editing);
    $fallback = $editing['share_fallback'] ?? $identity['share_fallback'];
    unset($errors['identity.share_fallback']);
    $valid = in_array($sample, ['home', 'page'], TRUE) && in_array($fallback, ['card', 'image', 'none'], TRUE);
    if (!$valid || !is_string($title) || mb_strlen($title) > 255 || $errors) {
      return self::badRequest();
    }
    if (!$this->shareRenderer->available()) {
      return new JsonResponse(['image' => NULL, 'shows' => 'card'], 200, ['Cache-Control' => 'no-store']);
    }
    $cacheability = new CacheableMetadata();
    $brand = $this->resolver->sampleBrand(array_intersect_key($identity, array_flip(['name', 'logo', 'colour']), $editing), $cacheability);
    $card = [
      'layout' => 'page',
      'title' => Values::plain($title, 255),
      'label' => '',
      'dir' => $this->languageManager->getDefaultLanguage()->getDirection() === LanguageInterface::DIRECTION_RTL ? 'R' : 'L',
    ];
    $image = NULL;
    $shows = NULL;
    $description = '';
    $front = $sample === 'home' ? $this->frontPage() : NULL;
    if ($front !== NULL) {
      $resolved = $this->resolver->resolve($front);
      $meta = array_column($resolved['head']['meta'], 'content', 'property');
      $description = $meta['og:description'] ?? '';
      // Its own image: the address the head sends.
      if (in_array($resolved['image']['source'] ?? '', ['override', 'entity', 'component'], TRUE)) {
        $image = $meta['og:image'] ?? NULL;
        $shows = 'photo';
      }
      // Else its card as the head draws it, or would were cards the choice.
      $card = $this->resolver->cardInput($front, $cacheability);
    }
    $drawn = $this->shareRenderer->sample(array_diff_key($card, $brand) + $brand);
    // A title the fonts cannot draw: the head sends no card for it but the
    // site's image, if any, and the colour is described from a short title.
    $undrawn = $drawn['png'] === NULL;
    if ($undrawn) {
      $drawn = ['png' => NULL] + $this->shareRenderer->sample(['title' => self::SAMPLE_TITLE] + array_diff_key($card, $brand) + $brand);
    }
    if ($shows === NULL) {
      $site = $fallback === 'image' || ($fallback === 'card' && $undrawn) ? $this->siteImageSample($identity['default_image']) : NULL;
      [$image, $shows] = match (TRUE) {
        $fallback === 'card' && !$undrawn => ['data:image/png;base64,' . base64_encode($drawn['png']), 'card'],
        $site !== NULL => [$site, 'photo'],
        default => [NULL, 'none'],
      };
    }
    return new JsonResponse([
      'image' => $image,
      'shows' => $shows,
      // The title and description the link shows beside it.
      'title' => (string) $card['title'],
      'description' => $description,
      // An SVG logo is never drawn: cards show its initial.
      'svg' => str_ends_with(strtolower($brand['logo']['uri'] ?? $brand['logo']['path'] ?? ''), '.svg'),
    ] + array_diff_key($drawn, ['png' => TRUE]), 200, ['Cache-Control' => 'no-store']);
  }

  /**
   * The site's image as pages without one share it: a data URL, an address.
   *
   * NULL when none is chosen, or none an anonymous visitor may see.
   */
  private function siteImageSample(string $uuid): ?string {
    $image = $uuid === '' ? NULL : $this->resolver->image($uuid, new CacheableMetadata());
    $media = $image === NULL ? [] : $this->entityTypeManager->getStorage('media')->loadByProperties(['uuid' => $uuid]);
    $fid = ($media = reset($media)) ? $media->getSource()->getSourceFieldValue($media) : NULL;
    $file = $fid === NULL ? NULL : $this->entityTypeManager->getStorage('file')->load($fid);
    if ($image === NULL || $file === NULL) {
      return NULL;
    }
    $treatment = in_array($image['mime'], ['image/jpeg', 'image/png', 'image/webp'], TRUE)
      ? ShareImage::treatment($image['width'], $image['height'], TRUE)
      : 'original';
    $bytes = in_array($treatment, ['cover', 'frame'], TRUE) ? $this->shareRenderer->photo((string) $file->getFileUri(), TRUE) : NULL;
    return match (TRUE) {
      $bytes !== NULL => 'data:image/jpeg;base64,' . base64_encode($bytes),
      $treatment === 'skip' => NULL,
      default => $image['url'],
    };
  }

  /**
   * The front page an anonymous visitor sees, when the module makes its head.
   */
  private function frontPage(): ?ContentEntityInterface {
    // The front page setting holds a system path or its alias.
    $front = (string) $this->configFactory->get('system.site')->get('page.front');
    $url = str_starts_with($front, '/') ? Url::fromUserInput($front) : NULL;
    $route = $url?->isRouted() ? $url->getRouteName() : '';
    if (!preg_match('/^entity\.(canvas_page|node)\.canonical$/', $route, $match)) {
      return NULL;
    }
    $entity = $this->entityTypeManager->getStorage($match[1])->load($url->getRouteParameters()[$match[1]] ?? 0);
    $entity = $entity instanceof ContentEntityInterface ? $this->entityRepository->getTranslationFromContext($entity) : NULL;
    return $entity instanceof ContentEntityInterface && $this->resolver->owns($entity) && $entity->access('view', new AnonymousUserSession()) ? $entity : NULL;
  }

  /**
   * The image the page or template preview shares, drawn from its draft.
   *
   * The same context and checks as state(): view access, and the draft only
   * with update access. Drawn in memory, never stored: a draft's values
   * never reach a public address. `v` hashes what is drawn, so the editor's
   * browser alone keeps the bytes for an hour (`private`), and a remount of
   * the link preview decodes no photo again. 404 when the page shares no
   * made image.
   */
  public function sharePreview(Request $request): Response {
    $query = $request->query->all();
    $context = match (TRUE) {
      ($query['entity_type'] ?? NULL) === 'canvas_page' && is_string($query['id'] ?? NULL) && !isset($query['preview'])
        => $this->pageContext($query['id'], $query['langcode'] ?? NULL),
      ($query['entity_type'] ?? NULL) === 'content_template' && is_string($query['id'] ?? NULL) && is_string($query['preview'] ?? NULL) && !isset($query['langcode'])
        => $this->templateContext($query['id'], $query['preview']),
      default => self::badRequest(),
    };
    if ($context instanceof JsonResponse) {
      return $context;
    }
    $share = $this->resolver->share($context['entity'], new CacheableMetadata(), $context['draft']);
    [$bytes, $type] = match (TRUE) {
      isset($share['card']) => [$this->shareRenderer->card($share['card']), 'image/png'],
      isset($share['file']) => [
        $this->shareRenderer->photo((string) $share['file']->getFileUri(), $share['chosen']),
        'image/jpeg',
      ],
      default => [NULL, ''],
    };
    return $bytes === NULL
      ? self::error(404, 'not_found', 'This page shares no image made by the site.')
      : new Response($bytes, 200, ['Content-Type' => $type, 'Cache-Control' => 'private, max-age=3600']);
  }

  /**
   * The schema.org vocabulary the site downloaded (Vocabulary).
   *
   * Cached by the browser for good: the dialog asks with the release in the
   * address. 404 when none is installed.
   */
  public function vocabulary(): Response {
    $installed = $this->vocabulary->installed();
    $data = $installed === NULL ? FALSE : file_get_contents($installed['uri']);
    if ($data === FALSE) {
      return self::error(404, 'not_found', 'No schema.org vocabulary is installed. Run drush canvas-metatag:vocabulary.');
    }
    return new Response($data, 200, [
      'Content-Type' => 'application/json',
      'Cache-Control' => 'private, max-age=31536000, immutable',
      'X-Content-Type-Options' => 'nosniff',
    ]);
  }

  /**
   * Saves the site identity, the site-wide defaults and the currency.
   *
   * Last save wins. With `dry_run` nothing is saved: the answer says where
   * the save would change structured data (effect()).
   */
  public function putSite(Request $request): JsonResponse {
    $body = self::body($request, ['identity', 'values']);
    if ($body === NULL || !is_bool($body['dry_run'] ?? FALSE)) {
      return self::badRequest();
    }
    [$identity, $identity_errors] = Values::cleanIdentity($body['identity']);
    [$values, $errors] = Values::clean($body['values'], 'site', static fn (): bool => FALSE, 'WebPage', $this->resolver->origin(new CacheableMetadata())['url'], $paths, ['identity' => $identity['kind']]);
    $config = $this->configFactory->getEditable('canvas_metatag.site');
    if ($errors) {
      $stored = $config->get('values');
      [$values, $errors] = self::carry($body['values'], $values, $errors, Values::clean(is_array($stored) ? $stored : [], 'site', NULL)[0], 'site');
    }
    $stored_currency = Values::currency($config->get('currency'))[0];
    [$currency, $currency_error] = Values::currency($body['currency'] ?? $stored_currency);
    if ($currency_error !== NULL) {
      $errors['currency'] = $currency_error;
    }
    if ($errors + $identity_errors) {
      return self::error(422, 'invalid', 'Some values need attention.', $errors + $identity_errors, $paths);
    }
    if ($body['dry_run'] ?? FALSE) {
      return new JsonResponse(['effect' => $currency === $stored_currency ? NULL : $this->effect()]);
    }
    $config->set('identity', $identity)->set('values', $values);
    // No currency is no key, as installed: a save of the same values leaves
    // the exported configuration as it was.
    ($currency === '' ? $config->clear('currency') : $config->set('currency', $currency))->save();
    $site = ['identity' => $identity, 'values' => (object) $values, 'currency' => $currency];
    return new JsonResponse(['site' => $site]);
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
    // A source stored in a value, as live or in the draft, that the type
    // can no longer read stays savable there, at any position: one deleted
    // field never locks the words around it. Any other source must fit
    // where it is sent, as a new one must: a long text linked whole to a
    // title is never a part of it.
    $stored = [];
    $draft = $this->autoSaveManager->getAutoSaveEntity($template, bypass_cache: TRUE)->entity;
    foreach (array_filter([$template, $draft]) as $current) {
      $values = Values::clean((array) $current->getThirdPartySetting('canvas_metatag', 'values', []), 'template', NULL)[0];
      foreach (self::sourcesByPath($values) as $path => $sources) {
        $stored[$path] = [...$stored[$path] ?? [], ...$sources];
      }
    }
    $accepts = fn (array $source, string $kind, string $path): bool => $this->sources->accepts($bundle, $source, $kind)
      || (in_array($source, $stored[$path] ?? [], TRUE) && $this->sources->problem($bundle, $source, 'words') !== NULL);
    return $this->putDraft($template, 'template', $accepts, $body);
  }

  /**
   * The sources each value holds, whole or as parts, by dotted path.
   *
   * @return array<string, list<array>>
   *   Path => sources.
   */
  private static function sourcesByPath(array $values): array {
    $found = [];
    $paths = ['title', 'title_end', 'description', 'social.title', 'social.description', 'social.image'];
    foreach (array_keys($values['schema']['props'] ?? []) as $key) {
      $paths[] = "schema.props.$key";
    }
    foreach ($paths as $path) {
      $value = NestedArray::getValue($values, explode('.', $path));
      if (!is_array($value)) {
        continue;
      }
      foreach ($value['parts'] ?? [$value] as $part) {
        if (isset($part['source'])) {
          $found[$path][] = $part['source'];
        }
      }
    }
    return $found;
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
   * @param callable(array, string, string): bool $accepts
   *   Whether a source may be stored for a value of a kind, at a path.
   * @param array<string, mixed> $body
   *   The request body, as draftBody() returned it.
   * @param string $type
   *   The structured-data type the values inherit.
   * @param array<string, string> $keep
   *   Structured-data details written besides the values and never echoed:
   *   those of a page translation's published type (putPage()).
   */
  private function putDraft(Page|ContentTemplate $entity, string $scope, callable $accepts, array $body, string $type = 'WebPage', array $keep = []): JsonResponse {
    [$clean, $errors] = Values::clean($body['values'], $scope, $accepts, $type, $this->resolver->origin(new CacheableMetadata())['url'], $paths);
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
      return self::error(422, 'invalid', 'Some values need attention.', $errors, $paths);
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
   * @return array<string, array{path: string, part?: int, field: string, reason: string}>
   *   By the dotted path of the link: a value's, or a part of a composition
   *   ("title.parts.2"). The value's path, the part's index, the machine name
   *   of the field it starts from, and why: `missing`, `kind` or `error`.
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
    $props = [];
    // As saving and the head read it: a job description is formatted text.
    foreach (SchemaGraph::types()[$values['schema']['type'] ?? 'WebPage']['props'] ?? [] as $prop) {
      $kinds["schema.props.{$prop['key']}"] = Values::kindOf($prop);
      $props["schema.props.{$prop['key']}"] = $prop;
    }
    $broken = [];
    foreach ($kinds as $path => $kind) {
      $value = NestedArray::getValue($values, explode('.', $path));
      $composed = is_array($value) && isset($value['parts']);
      // As saving reads them: a place that composes reads its fields as
      // words, and the parts of a title-like composition as one line.
      if (Values::composes($props[$path] ?? NULL, $path, 'template')) {
        $kind = $composed && Values::titleLike($path) ? 'line' : 'words';
      }
      $links = $composed ? $value['parts'] : [$value];
      foreach ($links as $at => $link) {
        $source = is_array($link) ? $link['source'] ?? NULL : NULL;
        $reason = is_array($source) ? $this->sources->problem($bundle, $source, $kind) : NULL;
        if ($reason !== NULL) {
          $part = isset($value['parts']) ? ['part' => $at] : [];
          $broken[$part ? "$path.parts.$at" : $path] = ['path' => $path] + $part + [
            'field' => (string) Sources::machineName($source),
            'reason' => $reason,
          ];
        }
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
    $carried = [];
    // Compared in canonical form: a value sent back with its keys in another
    // order, or its composition written another way, is the same value. Not
    // when cleaning it changed it: a title cut back to its stored length is
    // new text lost, not the stored value.
    [$canonical, $changed] = Values::clean($sent, $scope, NULL, $type);
    foreach (array_keys($errors) as $path) {
      $parents = explode('.', (string) $path);
      $kept = NestedArray::getValue($current, $parents, $exists);
      if ($exists && ($kept === NestedArray::getValue($sent, $parents) || (!isset($changed[$path]) && $kept === NestedArray::getValue($canonical, $parents)))) {
        NestedArray::setValue($clean, $parents, $kept);
        $carried[$path] = $errors[$path];
        unset($errors[$path]);
      }
    }
    $clean = Values::clean($clean, $scope, NULL, $type)[0];
    // A carried value the values as a whole still refuse (the 32 KB the
    // hand-added texts share) keeps its error: never dropped without a word.
    foreach ($carried as $path => $message) {
      NestedArray::getValue($clean, explode('.', (string) $path), $exists);
      if (!$exists) {
        $errors[$path] = $message;
      }
    }
    return [$clean, $errors];
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
    $type = $layers['from_default']['schema']['type'] ?? 'WebPage';
    // A translation's hand-added items are its own: the source's are offered
    // to copy while it has none.
    $source = NULL;
    if (!$entity->isDefaultTranslation() && !isset($layers['target']['schema']['custom'])) {
      $default = $entity->getUntranslated();
      $custom = Values::clean(Values::decode($default->get('canvas_metatag')->value), 'page', NULL)[0]['schema']['custom'] ?? NULL;
      $items = is_string($custom) ? json_decode($custom, TRUE) : NULL;
      $source = is_array($items) ? [
        'langcode' => $default->language()->getId(),
        'custom' => $custom,
        'count' => array_is_list($items) ? count($items) : 1,
      ] : NULL;
    }
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
        'refused' => self::refused(Values::decode($entity->get('canvas_metatag')->value), 'page', $type),
        'source' => $source,
      ],
      'can' => $update && $this->currentUser->hasPermission('edit canvas metatag'),
      'entity' => $entity,
      // The editor previews the page's chrome as a draft too.
      'draft' => $update,
      // What links already shared show, while a draft may change it.
      'live' => $entity !== $page && $stored && $page->isPublished() ? $page : NULL,
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
        // What Canvas's "Review changes" names its draft: the label it
        // stored with the auto-save entry, in the language of whoever wrote
        // it.
        'canvas_label' => $draft !== NULL
          // UPSTREAM(canvas): AutoSaveManager has no per-entry getter for
          // what getAllAutoSaveList() returns, which unserializes every draft
          // on the site; its store, public as AUTO_SAVE_STORE, is read for this
          // one entry (TemplateDraftTest pins it). ARCHITECTURE ask 8.
          ? (string) ($this->keyValue->get(AutoSaveManager::AUTO_SAVE_STORE)->get(AutoSaveManager::getAutoSaveKey($template))['label'] ?? $draft->label())
          : (string) $template->label(),
        'auto_save_key' => AutoSaveManager::getAutoSaveKey($template),
        'translatable' => FALSE,
        'default_langcode' => NULL,
        'published' => $template->status(),
        'has_draft' => $draft !== NULL,
        // In canonical key order, whatever order the config system stored.
        'values' => Values::clean(is_array($values) ? $values : [], 'template', NULL)[0],
        'from_default' => [],
        'refused' => self::refused($values, 'template'),
        'source' => NULL,
      ],
      'can' => $update && $this->currentUser->hasPermission('edit canvas metatag'),
      'entity' => $node,
      'draft' => $update,
      'vocabulary' => ['node', $template->getTargetBundle()],
    ];
  }

  /**
   * Stored hand-added JSON-LD that read mode leaves items of out.
   *
   * Stored before a rule: the dialog shows the text as written, with the
   * problem, so that the editor can fix it instead of losing it.
   *
   * @return array{text: string, message: string, item: int, path: string}|null
   *   The stored text and its first refusal, or NULL.
   */
  private static function refused(mixed $values, string $scope, string $type = 'WebPage'): ?array {
    $text = is_array($values) ? $values['schema']['custom'] ?? NULL : NULL;
    if (!is_string($text)) {
      return NULL;
    }
    [, $errors] = Values::clean(['schema' => ['custom' => $text]], $scope, NULL, $type, NULL, $paths);
    return isset($errors['schema.custom']) ? ['text' => $text, 'message' => $errors['schema.custom']] + $paths['schema.custom'] : NULL;
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
   * The published places whose structured data follows the site currency.
   *
   * Those that state a price and no currency of their own: pages, and
   * enabled content templates ("Every Product") whose currency is unset or
   * linked to a field, which follow it wherever that field is empty.
   *
   * @return array{count: int, places: list<string>}
   *   How many, and the names of the first NAMED.
   */
  private function effect(): array {
    $priced = static function (array $values): bool {
      $schema = Values::clean($values, 'template', NULL)[0]['schema'] ?? [];
      return in_array($schema['type'] ?? '', [
        'Product',
        'Service',
      ], TRUE) && isset($schema['props']['offers_price']) && !isset($schema['props']['offers_priceCurrency']['text']);
    };
    $count = 0;
    $places = [];
    $add = static function (string $name) use (&$count, &$places): void {
      $count++;
      if (count($places) < self::NAMED) {
        $places[] = $name;
      }
    };
    $node_types = $this->entityTypeManager->getStorage('node_type');
    foreach ($this->entityTypeManager->getStorage(ContentTemplate::ENTITY_TYPE_ID)->loadMultiple() as $template) {
      $type = $template instanceof ContentTemplate && $template->getTargetEntityTypeId() === 'node' && $template->getMode() === 'full' && $template->status()
        ? $node_types->load($template->getTargetBundle())
        : NULL;
      if ($type !== NULL && $priced((array) $template->getThirdPartySetting('canvas_metatag', 'values', []))) {
        // Plain text for the dialog: the label is not escaped.
        $add(strtr((string) new TranslatableMarkup('Every @type'), ['@type' => (string) $type->label()]));
      }
    }
    // Pages in small batches: only their values are read, none is kept.
    $pages = $this->entityTypeManager->getStorage(Page::ENTITY_TYPE_ID);
    $ids = $pages->getQuery()->accessCheck(TRUE)->condition('status', 1)->condition('canvas_metatag', '%offers_price%', 'LIKE')->sort('changed', 'DESC')->execute();
    foreach (array_chunk($ids, 50) as $chunk) {
      foreach ($pages->loadMultiple($chunk) as $page) {
        if ($priced(Values::decode($page->get('canvas_metatag')->value))) {
          $add((string) $page->label());
        }
      }
      $pages->resetCache($chunk);
    }
    return ['count' => $count, 'places' => $places];
  }

  /**
   * The registry or the rules, with what the dialog shows in its language.
   *
   * A type's sentences are NULL as a whole when one has no translation in
   * the language, as locale storage records it: the dialog then lists the
   * facts instead of mixing languages.
   *
   * @param array $data
   *   The registry or the rules.
   * @param array<string, \Drupal\Core\StringTranslation\TranslatableMarkup> $strings
   *   RegistryStrings::all().
   * @param array<string, int> $translated
   *   The sentences with a translation, as keys (translatedSentences()).
   * @param string $langcode
   *   The dialog's language.
   */
  private static function shown(array $data, array $strings, array $translated, string $langcode): array {
    $walk = static function (array $data, bool $shown) use (&$walk, $strings, $translated, $langcode): array {
      foreach ($data as $key => $value) {
        if (is_array($value)) {
          $data[$key] = $walk($value, $shown || in_array($key, self::ALL_SHOWN, TRUE));
          if ($key === 'say' && $langcode !== 'en' && array_diff_key(array_flip(array_merge(...$value)), $translated) !== []) {
            $data[$key] = NULL;
          }
        }
        elseif (($shown || in_array($key, self::SHOWN, TRUE)) && is_string($value) && isset($strings[$value])) {
          $data[$key] = (string) $strings[$value];
        }
      }
      return $data;
    };
    return $walk($data, FALSE);
  }

  /**
   * The registry sentences that have a translation in a language.
   *
   * One query of locale storage, not one per sentence.
   *
   * @return list<string>
   *   Their English source texts.
   */
  private function translatedSentences(string $langcode): array {
    if ($langcode === 'en' || $this->localeStorage === NULL) {
      return [];
    }
    $strings = $this->localeStorage->getTranslations([
      'language' => $langcode,
      'context' => 'canvas_metatag:schema',
      'translated' => TRUE,
    ]);
    return array_values(array_map(
      static fn (object $string): string => $string->source,
      array_filter($strings, static fn (object $string): bool => $string->isTranslation()),
    ));
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
  private static function error(int $status, string $code, string $message, array $fields = [], array $paths = []): JsonResponse {
    // Where in hand-added JSON-LD a refused text's problem is: {item, path}.
    $paths = array_intersect_key($paths, $fields);
    $error = ['code' => $code, 'message' => $message] + ($fields ? ['fields' => $fields] : []) + ($paths ? ['error_paths' => $paths] : []);
    return new JsonResponse(['error' => $error], $status);
  }

}
