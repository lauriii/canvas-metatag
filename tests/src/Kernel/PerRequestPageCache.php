<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\page_cache\StackMiddleware\PageCache;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Core's page cache middleware, for a process that handles many requests.
 *
 * The middleware remembers the cache ID of the first request it sees, which
 * is right when one process serves one request. A kernel test sends many
 * through the same instance.
 *
 * @see \Drupal\Tests\canvas_metatag\Kernel\SeoFixtureTrait::allowPageCaches()
 */
final class PerRequestPageCache extends PageCache {

  /**
   * {@inheritdoc}
   */
  public function handle(Request $request, $type = self::MAIN_REQUEST, $catch = TRUE): Response {
    if ($type === self::MAIN_REQUEST) {
      // Unset, not emptied: the parent computes the ID while it is not set.
      // @phpstan-ignore unset.possiblyHookedProperty
      unset($this->cid);
    }
    return parent::handle($request, $type, $catch);
  }

}
