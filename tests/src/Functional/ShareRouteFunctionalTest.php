<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Functional;

use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Controller\ShareController;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\ShareStore;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Tests\BrowserTestBase;
use Drupal\user\RoleInterface;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * A card address through the front controller and the web server.
 *
 * Many web servers hand missing image files to Drupal only under the
 * files path; the share route lies outside it, so the server must pass a
 * ".png" address to index.php. The stored file is not at the files path
 * that mirrors the route's.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(ShareController::class)]
#[Group('canvas_metatag')]
#[RequiresFunction('imagettftext')]
final class ShareRouteFunctionalTest extends BrowserTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['canvas', 'canvas_metatag', 'page_cache'];

  /**
   * {@inheritdoc}
   */
  protected $defaultTheme = 'stark';

  /**
   * A card address answers with the PNG it stores.
   */
  public function testCard(): void {
    user_role_grant_permissions(RoleInterface::ANONYMOUS_ID, ['access content']);
    $page = Page::create(['title' => 'Services', 'status' => TRUE, 'components' => []]);
    $page->save();
    $url = $this->container->get(Resolver::class)->shareUrl($page, new CacheableMetadata());
    $stored = ShareStore::dir() . "/en/canvas_page/{$page->id()}/" . basename((string) $url);
    self::assertFileDoesNotExist($stored);

    $this->drupalGet($url);
    $session = $this->assertSession();
    $session->statusCodeEquals(200);
    $session->responseHeaderEquals('Content-Type', 'image/png');
    $session->responseHeaderEquals('X-Robots-Tag', 'noindex');
    foreach (['public', 'max-age=31536000', 's-maxage=86400', 'immutable'] as $directive) {
      $session->responseHeaderContains('Cache-Control', $directive);
    }
    self::assertSame([1200, 630], array_slice((array) getimagesizefromstring($this->getSession()->getPage()->getContent()), 0, 2));
    self::assertFileExists($stored);
    self::assertSame(file_get_contents($stored), $this->getSession()->getPage()->getContent());

    // The web server has no file at the files path that mirrors the route's:
    // a card is served only by the route, with its noindex, on any server.
    $this->drupalGet($this->container->get('file_url_generator')->generateAbsoluteString("public://canvas-metatag/share/en/canvas_page/{$page->id()}/" . basename((string) $url)));
    $session->statusCodeEquals(404);
  }

  /**
   * An outdated address redirects, and no cache keeps the redirect.
   *
   * Core's page cache would keep it for good on a site whose page max-age is
   * 0 (the default): the response subscriber rewrites Expires to the past.
   */
  public function testMoved(): void {
    user_role_grant_permissions(RoleInterface::ANONYMOUS_ID, ['access content']);
    $page = Page::create(['title' => 'Services', 'status' => TRUE, 'components' => []]);
    $page->save();
    $old = (string) $this->container->get(Resolver::class)->shareUrl($page, new CacheableMetadata());
    $page->set('title', 'Our services')->save();
    // A fresh copy: the resolver remembers what it built for an entity.
    $this->container->get('entity_type.manager')->getStorage('canvas_page')->resetCache();
    $new = (string) $this->container->get(Resolver::class)->shareUrl(Page::load($page->id()), new CacheableMetadata());
    self::assertNotSame($old, $new);

    // Twice: the second would be a page cache hit.
    for ($i = 0; $i < 2; $i++) {
      $response = $this->getHttpClient()->request('GET', $old, ['allow_redirects' => FALSE]);
      self::assertSame(302, $response->getStatusCode());
      self::assertSame($new, $response->getHeaderLine('Location'));
      self::assertStringContainsString('no-cache', $response->getHeaderLine('Cache-Control'));
      self::assertStringNotContainsString('public', $response->getHeaderLine('Cache-Control'));
      self::assertNotSame('HIT', $response->getHeaderLine('X-Drupal-Cache'));
    }
    // Not in Drupal's page cache (its table appears with a first entry).
    $database = \Drupal::database();
    $cids = $database->schema()->tableExists('cache_page') ? $database->select('cache_page', 'c')->fields('c', ['cid'])->execute()->fetchCol() : [];
    self::assertSame([], array_values(array_filter($cids, static fn (string $cid): bool => str_contains($cid, '/canvas-metatag/share/'))), implode(', ', $cids));
  }

}
