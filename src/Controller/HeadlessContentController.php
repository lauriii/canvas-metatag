<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Controller;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas_headless\Controller\CanvasContentController;
use Drupal\canvas_headless\PreviewTokenInspector;
use Drupal\canvas_headless\Routing\CanvasContentRoute;
use Drupal\canvas_headless\StackMiddleware\CanvasContentApiRequest;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Cache\CacheableJsonResponse;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Routing\RouteMatchInterface;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\Core\State\StateInterface;
use Drupal\Core\Utility\Error;
use Symfony\Component\HttpFoundation\Request;

/**
 * The headless adapter: decorates the canvas_headless content controller.
 *
 * The decorated class is final, so this is a sibling with the same method. It
 * runs once per uncached build, and what it adds is stored with the response
 * by both page caches.
 */
final class HeadlessContentController {

  public function __construct(
    private readonly CanvasContentController $inner,
    private readonly Resolver $resolver,
    private readonly AutoSaveManager $autoSaveManager,
    private readonly AccountProxyInterface $currentUser,
    private readonly LoggerChannelFactoryInterface $loggerFactory,
    private readonly StateInterface $state,
  ) {}

  /**
   * Answers a content API request, with our head for an owned entity.
   */
  public function get(Request $request, RouteMatchInterface $route_match): CacheableJsonResponse {
    $response = $this->inner->get($request, $route_match);
    // UPSTREAM(canvas): a head alter hook in the headless head builder,
    // passing the rendered entity and the response cacheability, would
    // replace this class with a five-line hook.
    try {
      $content_route = CanvasContentRoute::resolve(
        $route_match->getRouteName(),
        $route_match->getRouteObject(),
        $route_match->getParameters()->all(),
      );
      // Decoded as objects, so that `{}` survives the round trip.
      $data = json_decode((string) $response->getContent());
      $ref = $data->route->entity ?? NULL;
      $entity = $content_route?->entity;
      // Fail closed to Canvas's own head. Entity preview, revision and
      // latest-version routes carry an unsaved or non-default entity (a new
      // node has no id at all) and are never ours.
      if (
        $response->getStatusCode() !== 200
        || $content_route === NULL
        || $content_route->isPreview
        || !isset($data->head, $ref->langcode)
        || $entity->isNew()
        || $entity->getEntityTypeId() !== $ref->entityType
        || (string) $entity->id() !== (string) $ref->id
      ) {
        return $response;
      }
      // The head is the full view's. A preview may ask for another view mode,
      // which Canvas then renders.
      $preview = PreviewTokenInspector::hasPreviewScope($this->currentUser->getAccount());
      $query = $preview ? $request->attributes->get(CanvasContentApiRequest::API_QUERY_PARAMETERS_KEY, []) : [];
      if (($query[CanvasContentApiRequest::PREVIEW_VIEW_MODE_QUERY] ?? $content_route->viewMode) !== 'full') {
        return $response;
      }
      // The inner controller has just recorded its own "use drafts" decision
      // on the route. The token check is repeated so that a published
      // response can never read a draft, whatever the option holds.
      $draft = $preview && $route_match->getRouteObject()?->getOption('_canvas_use_template_draft') === TRUE;
      if ($draft) {
        $auto_save = $this->autoSaveManager->getAutoSaveEntityForPreview($entity);
        if ($auto_save->entity instanceof ContentEntityInterface) {
          $entity = $auto_save->entity;
          $response->addCacheableDependency($auto_save);
        }
      }
      // The translation Canvas rendered.
      if ($entity->hasTranslation($ref->langcode)) {
        $entity = $entity->getTranslation($ref->langcode);
      }
      if (!$this->resolver->owns($entity, $draft)) {
        return $response;
      }
      $resolved = $this->resolver->resolve($entity, $draft);
      if (!$draft) {
        $this->noteHost($request);
      }
      // Owned: replaced wholesale. Nothing above this line changes the body.
      $data->head = $resolved['head'];
      $response->setData($data);
      $response->addCacheableDependency($resolved['cacheability']);
    }
    catch (\Throwable $e) {
      // This path leans on @internal Canvas APIs. A change there may cost the
      // SEO head, never the page.
      Error::logException($this->loggerFactory->get('canvas_metatag'), $e);
    }
    return $response;
  }

  /**
   * Remembers a host visitors can't reach that the frontend fetched us at.
   *
   * Made share images are addressed on the host the content API was asked
   * at. An internal one (`http://cms:8080`), or http on an https site,
   * gives the frontend's visitors images their apps can't fetch: Checks tell
   * administrators. Written only when it changes, and only on a site whose
   * trusted host patterns checked the host: elsewhere any visitor may send
   * any Host. A frontend that alternates hosts rewrites it on each uncached
   * response, which also clears the state cache: accepted, as both page
   * caches keep these responses; Checks name the last one.
   */
  private function noteHost(Request $request): void {
    if (Request::getTrustedHosts() === []) {
      return;
    }
    $host = $request->getHost();
    $public = $this->resolver->origin(new CacheableMetadata())['url'];
    // A development copy fetches itself however it likes.
    $unreachable = !Values::isDevelopmentHost($host)
      && (!Values::isPublicHost($host) || ($request->getScheme() === 'http' && str_starts_with($public, 'https:')));
    $address = $unreachable ? $request->getSchemeAndHttpHost() : NULL;
    if ($this->state->get('canvas_metatag.share_host') !== $address) {
      $this->state->set('canvas_metatag.share_host', $address);
    }
  }

}
