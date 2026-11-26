<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag\Controller;

use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\ShareRenderer;
use Drupal\canvas_metatag\ShareStore;
use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Cache\CacheBackendInterface;
use Drupal\Core\DependencyInjection\AutowireTrait;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\File\FileUrlGeneratorInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Routing\TrustedRedirectResponse;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\Utility\Error;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\Exception\FileNotFoundException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serves made share images: cards, photo versions, the site image and icons.
 *
 * The address is a hash of what is drawn. Each request rebuilds that input
 * from the entity and configuration, never from the request, and draws only
 * when the hash matches; an outdated address is sent to the current one.
 * Drawn once, stored, then served from disk with a year of caching. Only
 * what an anonymous visitor may view is drawn; everything else is 404.
 */
final class ShareController implements ContainerInjectionInterface {

  use AutowireTrait;

  /**
   * How long a failed render is remembered, in seconds.
   */
  private const FAILED = 300;

  /**
   * The longest a render takes, in seconds.
   *
   * A render started longer ago that has not finished ended its process (out
   * of memory, out of time): it failed.
   */
  private const DRAWING = 60;

  /**
   * How long shared caches keep a stored image, in seconds.
   *
   * A stored image carries no cache tags a purger could read, so a proxy
   * would keep the image of a page unpublished since for a day at most.
   */
  private const SHARED = 86400;

  public function __construct(
    private readonly Resolver $resolver,
    private readonly ShareRenderer $renderer,
    private readonly ShareStore $store,
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly LanguageManagerInterface $languageManager,
    #[Autowire(service: 'cache.default')]
    private readonly CacheBackendInterface $cache,
    private readonly LoggerChannelFactoryInterface $loggers,
    private readonly TimeInterface $time,
    private readonly FileUrlGeneratorInterface $fileUrlGenerator,
  ) {}

  /**
   * The image an owned entity shares in a language: its card or photo.
   *
   * A photo's share version lives under the entity that shares it, so it is
   * public exactly while the entity is, and goes with it (ShareHooks). One
   * that cannot be made (too large to decode in the memory left, a format
   * this GD cannot read) sends links to the original file for a while: the
   * head named the address before anything was drawn.
   */
  public function entity(string $langcode, string $entity_type, string $id, string $name): Response {
    if (!preg_match('/^[0-9a-f]{16}\.(png|jpg)$/', $name, $match)) {
      return self::missing();
    }
    $known = $this->languageManager->getLanguage($langcode) !== NULL && $this->entityTypeManager->hasDefinition($entity_type);
    $entity = $known ? $this->entityTypeManager->getStorage($entity_type)->load($id) : NULL;
    if (!$entity instanceof ContentEntityInterface || !$entity->hasTranslation($langcode)) {
      return self::missing();
    }
    $entity = $entity->getTranslation($langcode);
    if (!$this->resolver->owns($entity) || !$entity->access('view', new AnonymousUserSession())) {
      // Access lost without a save ShareHooks sees (an access module, a
      // grants rebuild, a template turned off): what was stored goes now.
      $this->store->forget($entity, $langcode);
      return self::missing();
    }
    // Configuration in the address's language, whatever the request's.
    return $this->resolver->inLanguage($langcode, function () use ($entity, $name, $match): Response {
      $cacheability = new CacheableMetadata();
      // What the entity shares now: a page that gained an image of its own
      // shares that instead of its card, and the other way round.
      $share = $this->resolver->share($entity, $cacheability) ?? [];
      $input = match ($match[1]) {
        'png' => $share['card'] ?? NULL,
        // The site's image has the site's address (site()).
        default => isset($share['file']) && !isset($share['site']) ? Resolver::photoInput($share['file'], $share['chosen']) : NULL,
      };
      if ($input === NULL || Resolver::hash($input) !== substr($name, 0, 16)) {
        $url = $this->resolver->shareUrl($entity, $cacheability);
        // It shares nothing now: nothing stored for it is shown again.
        if ($url === NULL) {
          $this->store->forget($entity, $entity->language()->getId());
        }
        return $this->moved($url);
      }
      $path = "{$entity->language()->getId()}/{$entity->getEntityTypeId()}/{$entity->id()}/$name";
      if (isset($share['card'])) {
        return $this->serve($path, 'image/png', fn (): ?string => $this->renderer->card($input), TRUE) ?? self::missing();
      }
      $uri = (string) $share['file']->getFileUri();
      return $this->serve(ShareStore::photoPath($path, (int) $share['file']->id()), 'image/jpeg', fn (): ?string => $this->renderer->photo($uri, $share['chosen']), FALSE)
        ?? $this->moved($this->fileUrlGenerator->generateAbsoluteString($uri));
    });
  }

  /**
   * The share version of the site's image, stored once for the whole site.
   *
   * The site's image is no entity's: every page and language that shares it
   * links here, and visitors may see it wherever it is (Resolver::image()).
   */
  public function site(string $name): Response {
    if (!preg_match('/^[0-9a-f]{16}\.jpg$/', $name)) {
      return self::missing();
    }
    $cacheability = new CacheableMetadata();
    $share = $this->resolver->siteShare($cacheability);
    if (!isset($share['file'])) {
      // No site image now, or one sent as it is: what was stored goes.
      $this->store->delete('site');
      return $this->moved($share['original']['url'] ?? NULL);
    }
    if (Resolver::hash(Resolver::photoInput($share['file'], TRUE)) !== substr($name, 0, 16)) {
      return $this->moved($this->resolver->siteShareUrl($share['file'], $cacheability));
    }
    $uri = (string) $share['file']->getFileUri();
    return $this->serve(ShareStore::photoPath("site/$name", (int) $share['file']->id()), 'image/jpeg', fn (): ?string => $this->renderer->photo($uri, TRUE), FALSE)
      ?? $this->moved($this->fileUrlGenerator->generateAbsoluteString($uri));
  }

  /**
   * A site icon.
   */
  public function icon(string $size, string $name): Response {
    if (!preg_match('/^[0-9a-f]{16}\.png$/', $name)) {
      return self::missing();
    }
    $cacheability = new CacheableMetadata();
    $input = $this->resolver->iconInput($cacheability);
    if (Resolver::hash($input) !== substr($name, 0, 16)) {
      return $this->moved($this->resolver->iconUrl((int) $size, $cacheability));
    }
    return $this->serve("icon/$size/$name", 'image/png', fn (): ?string => $this->renderer->icon($input, (int) $size), FALSE) ?? self::missing();
  }

  /**
   * The stored image of a path, drawn and stored first when it is missing.
   *
   * A failure is logged and remembered for five minutes, and gives NULL:
   * a crawler never gets an error page, and is not drawn for again at once.
   * A request that finds another drawing the same image draws too: both
   * write the same bytes (design D4).
   *
   * @param string $path
   *   The path below the share route.
   * @param string $type
   *   The media type.
   * @param \Closure $render
   *   Draws the bytes: NULL when there is nothing to draw.
   * @param bool $card
   *   A card: kept out of search results.
   *
   * @return \Symfony\Component\HttpFoundation\Response|null
   *   The image, or NULL when there is none to serve.
   */
  private function serve(string $path, string $type, \Closure $render, bool $card): ?Response {
    $uri = ShareStore::dir() . '/' . $path;
    if (!is_file($uri)) {
      $marker = "canvas_metatag:share:$path";
      $now = $this->time->getRequestTime();
      // 'failed', or when a draw started: one that started too long ago
      // ended its process (out of memory, out of time) and failed too.
      $seen = $this->cache->get($marker)->data ?? NULL;
      if ($seen === 'failed' || (is_int($seen) && $seen < $now - self::DRAWING)) {
        return NULL;
      }
      $this->cache->set($marker, $now, $now + self::FAILED);
      try {
        $bytes = $render();
        if ($bytes === NULL) {
          $this->loggers->get('canvas_metatag')->notice('The share image @path could not be made: nothing could be drawn.', ['@path' => $path]);
        }
        else {
          $this->store->write($path, $bytes);
        }
      }
      catch (\Throwable $e) {
        Error::logException($this->loggers->get('canvas_metatag'), $e, 'The share image @path could not be made: %type: @message in %function (line %line of %file).', ['@path' => $path]);
        $bytes = NULL;
      }
      if ($bytes === NULL) {
        $this->cache->set($marker, 'failed', $now + self::FAILED);
        return NULL;
      }
      $this->cache->delete($marker);
    }
    $headers = [
      'Content-Type' => $type,
      'Cache-Control' => 'public, max-age=31536000, s-maxage=' . self::SHARED . ', immutable',
      'Expires' => gmdate('D, d M Y H:i:s \G\M\T', $this->time->getRequestTime() + 31536000),
    ];
    // Link previews read images whatever this says; search features ask for
    // real photos, not text images.
    if ($card) {
      $headers['X-Robots-Tag'] = 'noindex';
    }
    try {
      return new BinaryFileResponse($uri, 200, $headers, FALSE);
    }
    catch (FileNotFoundException) {
      // Replaced by another request's newer image since it was checked.
      return NULL;
    }
  }

  /**
   * A redirect to the current address, or 404 without one.
   *
   * Never cached (the route's no_cache option): an edit and its undo would
   * loop in a cache, and a photo that could not be made is tried again once
   * its failure is forgotten. Core's page cache would keep it for good.
   */
  private function moved(?string $url): Response {
    return $url === NULL ? self::missing() : new TrustedRedirectResponse($url, 302);
  }

  /**
   * An empty 404 that no cache keeps.
   *
   * Not HTML: core's active-link filter would rebuild the route's address
   * from parameters the route did not check case-sensitively.
   */
  private static function missing(): Response {
    return new Response('', 404, ['Cache-Control' => 'no-cache', 'Content-Type' => 'text/plain']);
  }

}
