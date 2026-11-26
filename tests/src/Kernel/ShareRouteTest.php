<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Controller\ShareController;
use Drupal\canvas_metatag\Hook\ShareHooks;
use Drupal\canvas_metatag\ShareStore;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\Site\Settings;
use Drupal\file\Entity\File;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\node\Entity\Node;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use Drupal\user\Entity\Role;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Psr\Log\AbstractLogger;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

// cspell:ignore Palvelut palvelut
/**
 * The route that serves made share images, and their storage.
 *
 * Share-images "Made images have their own address" and "Only public pages
 * have public images"; design D2–D4.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(ShareController::class)]
#[CoversClass(ShareStore::class)]
#[CoversClass(ShareHooks::class)]
#[Group('canvas_metatag')]
#[RequiresFunction('imagettftext')]
final class ShareRouteTest extends CanvasKernelTestBase {

  use ContentTranslationTestTrait;
  use GenerateComponentConfigTrait;
  use SeoFixtureTrait;
  use ShareTestTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'language',
    'content_translation',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->installConfig(['language']);
    ConfigurableLanguage::createFromLangcode('fi')->save();
    $this->enableContentTranslation(Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID);
    // The language path processor exists only on a multilingual site.
    $this->container->get('kernel')->rebuildContainer();
  }

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    self::spyOnRenderer($container);
    // Lets responses carry their caching headers on the command line.
    self::allowPageCaches($container);
  }

  /**
   * A card: its headers, drawn once, the same bytes on any host.
   */
  public function testCard(): void {
    $page = $this->createPage(['title' => 'Services']);
    $url = $this->shareUrl($page);
    self::assertMatchesRegularExpression('#^http://localhost/canvas-metatag/share/en/canvas_page/1/[0-9a-f]{16}\.png$#', $url);

    $response = $this->fetch($url);
    self::assertSame(200, $response->getStatusCode());
    self::assertSame('image/png', $response->headers->get('Content-Type'));
    self::assertSame('noindex', $response->headers->get('X-Robots-Tag'));
    self::assertTrue($response->headers->hasCacheControlDirective('public'));
    self::assertTrue($response->headers->hasCacheControlDirective('immutable'));
    self::assertSame('31536000', $response->headers->getCacheControlDirective('max-age'));
    // A proxy keeps it for a day: it carries no tags a purger could read.
    self::assertSame('86400', $response->headers->getCacheControlDirective('s-maxage'));
    $bytes = self::bytes($response);
    self::assertSame([1200, 630], array_slice(getimagesizefromstring($bytes), 0, 2));
    self::assertSame([basename($url)], self::stored('en/canvas_page/1'));
    self::assertCount(1, ShareRendererSpy::$drawn);
    // Only the route serves it: the files path that mirrors the route's has
    // nothing, and the stored folder's name comes from the hash salt, so no
    // web server serves a card without the route's noindex.
    self::assertFileDoesNotExist('public://canvas-metatag/share/en/canvas_page/1/' . basename($url));
    self::assertDirectoryDoesNotExist('public://canvas-metatag/share');
    $folder = ShareStore::dir();
    self::assertMatchesRegularExpression('#^public://canvas-metatag/share-[\w-]{16}$#', $folder);
    $salt = Settings::getHashSalt();
    $this->setSetting('hash_salt', 'another site');
    self::assertNotSame($folder, ShareStore::dir());
    $this->setSetting('hash_salt', $salt);

    // Served from disk the second time, and to a request with another host:
    // the same bytes, and nothing else stored.
    self::assertSame($bytes, self::bytes($this->fetch($url)));
    $evil = $this->fetch($url, 'evil.example');
    self::assertSame(200, $evil->getStatusCode());
    self::assertSame($bytes, self::bytes($evil));
    self::assertSame([basename($url)], self::stored('en/canvas_page/1'));
    self::assertCount(1, ShareRendererSpy::$drawn);
  }

  /**
   * An outdated address is sent to the current one, never cached.
   *
   * Core's page cache would keep a redirect for good (ShareRouteFunctionalTest
   * proves it is left out); browsers and proxies are told not to keep it.
   */
  public function testMoved(): void {
    $this->config('system.performance')->set('cache.page.max_age', 3600)->save();
    $page = $this->createPage(['title' => 'Services']);
    $old = $this->shareUrl($page);
    self::assertSame(200, $this->fetch($old)->getStatusCode());

    $page = Page::load($page->id());
    $page->set('title', 'Our services')->save();
    $new = $this->shareUrl($page);
    self::assertNotSame($old, $new);
    $moved = $this->fetch($old);
    self::assertSame(302, $moved->getStatusCode());
    self::assertSame($new, $moved->headers->get('Location'));
    self::assertTrue($moved->headers->hasCacheControlDirective('no-cache'));
    self::assertFalse($moved->headers->hasCacheControlDirective('public'));
    // The new card, of the new title, replaces the old file.
    self::assertSame(200, $this->fetch($new)->getStatusCode());
    [$kind, $input] = end(ShareRendererSpy::$drawn);
    self::assertSame(['card', 'Our services'], [$kind, $input['title']]);
    self::assertSame([basename($new)], self::stored('en/canvas_page/1'));

    // A page that gained a photo shares its share version instead.
    $hero = $this->createPhoto('Hero', 1600, 900);
    $page = Page::load($page->id());
    $page->set('image', $hero->id())->save();
    $photo = $this->shareUrl($page);
    self::assertMatchesRegularExpression('#^http://localhost/canvas-metatag/share/en/canvas_page/1/[0-9a-f]{16}\.jpg$#', $photo);
    $moved = $this->fetch($new);
    self::assertSame(302, $moved->getStatusCode());
    self::assertSame($photo, $moved->headers->get('Location'));
    $response = $this->fetch($photo);
    self::assertSame(200, $response->getStatusCode());
    self::assertSame('image/jpeg', $response->headers->get('Content-Type'));
    self::assertFalse($response->headers->has('X-Robots-Tag'));
    self::assertSame([1200, 630], array_slice(getimagesizefromstring(self::bytes($response)), 0, 2));
    // It replaces the card in the page's folder, stored by its file.
    $fid = (int) $hero->get('field_media_image')->target_id;
    self::assertSame(["$fid-" . basename($photo)], self::stored('en/canvas_page/1'));

    // A hash never computed is sent to the current one; nothing is drawn.
    $drawn = count(ShareRendererSpy::$drawn);
    $moved = $this->fetch('http://localhost/canvas-metatag/share/en/canvas_page/1/0000000000000000.jpg');
    self::assertSame(302, $moved->getStatusCode());
    self::assertSame($photo, $moved->headers->get('Location'));
    self::assertCount($drawn, ShareRendererSpy::$drawn);
  }

  /**
   * An outdated address of an entity that now shares no image is 404.
   *
   * Pages without an image share none: the stored cards go with the choice,
   * as they could still be fetched from the files path.
   */
  public function testMovedToNothing(): void {
    $page = $this->createPage(['title' => 'Services']);
    $card = $this->shareUrl($page);
    self::assertSame(200, $this->fetch($card)->getStatusCode());
    self::assertCount(1, self::stored('en/canvas_page/1'));
    $this->config('canvas_metatag.site')->set('identity.share_fallback', 'none')->save();
    self::assertSame([], self::stored('en/canvas_page/1'));
    self::assertNull($this->resolver()->shareUrl(Page::load($page->id()), new CacheableMetadata()));
    self::assertSame(404, $this->fetch($card)->getStatusCode());

    // A title the fonts can't draw, on a site without an image: no address
    // serves an image, and nothing is drawn.
    $this->config('canvas_metatag.site')->set('identity.share_fallback', 'card')->save();
    $page = $this->createPage(['title' => '湖畔の夏至コンサート', 'path' => ['alias' => '/kohan']]);
    self::assertNull($this->resolver()->shareUrl(Page::load($page->id()), new CacheableMetadata()));
    $drawn = count(ShareRendererSpy::$drawn);
    foreach (['png', 'jpg'] as $extension) {
      $forged = "http://localhost/canvas-metatag/share/en/canvas_page/{$page->id()}/0123456789abcdef.$extension";
      self::assertSame(404, $this->fetch($forged)->getStatusCode(), $extension);
    }
    self::assertCount($drawn, ShareRendererSpy::$drawn);
    self::assertSame([], self::stored("en/canvas_page/{$page->id()}"));

    // The site's image shared, then not public: its stored version goes, and
    // so it does when another media item takes its place in configuration.
    $default = $this->createPhoto('Default', 1600, 900);
    $this->config('canvas_metatag.site')
      ->set('identity.default_image', $default->uuid())
      ->set('identity.share_fallback', 'image')
      ->save();
    $page = $this->createPage(['title' => 'Plain', 'path' => ['alias' => '/plain']]);
    $photo = $this->shareUrl($page);
    self::assertSame(200, $this->fetch($photo)->getStatusCode());
    self::assertCount(1, self::stored('site'));
    $default->setUnpublished()->save();
    $this->container->get(ShareStore::class)->destruct();
    self::assertSame([], self::stored('site'));
    self::assertSame(404, $this->fetch($photo)->getStatusCode());
    $default->setPublished()->save();
    self::assertSame(200, $this->fetch($photo)->getStatusCode());
    self::assertCount(1, self::stored('site'));
    $this->config('canvas_metatag.site')->set('identity.default_image', '00000000-0000-4000-8000-000000000000')->save();
    self::assertFalse(is_dir(ShareStore::dir() . '/site'));
    self::assertSame(404, $this->fetch($photo)->getStatusCode());
  }

  /**
   * The site's image is stored once, whatever shares it.
   *
   * Every page and language without an image of its own links one address
   * of the site, hashed from the site image's file alone; an entity's own
   * address of it is sent there.
   */
  public function testSiteImage(): void {
    $default = $this->createPhoto('Default', 1600, 900);
    $this->config('canvas_metatag.site')
      ->set('identity.default_image', $default->uuid())
      ->set('identity.share_fallback', 'image')
      ->save();
    $page = $this->createPage(['title' => 'Services']);
    $page->addTranslation('fi', ['title' => 'Palvelut', 'status' => TRUE, 'path' => ['alias' => '/palvelut']])->save();
    $other = $this->createPage(['title' => 'About', 'path' => ['alias' => '/about']]);
    $page = Page::load($page->id());
    $urls = [
      $this->shareUrl($page),
      $this->shareUrl($page->getTranslation('fi')),
      $this->shareUrl($other),
    ];
    self::assertCount(1, array_unique($urls));
    self::assertMatchesRegularExpression('#^http://localhost/canvas-metatag/share/site/[0-9a-f]{16}\.jpg$#', $urls[0]);
    foreach ($urls as $url) {
      $response = $this->fetch($url);
      self::assertSame(200, $response->getStatusCode());
      self::assertSame('image/jpeg', $response->headers->get('Content-Type'));
      self::assertTrue($response->headers->hasCacheControlDirective('immutable'));
    }
    // Drawn once, stored once, by its file; never under a page.
    self::assertCount(1, ShareRendererSpy::$drawn);
    $fid = (int) $default->get('field_media_image')->target_id;
    self::assertSame(["$fid-" . basename($urls[0])], self::stored('site'));
    self::assertSame([], self::stored("en/canvas_page/{$page->id()}"));
    // A page's own address of it, as a head named before, is sent there.
    $moved = $this->fetch("http://localhost/canvas-metatag/share/en/canvas_page/{$page->id()}/" . basename($urls[0]));
    self::assertSame(302, $moved->getStatusCode());
    self::assertSame($urls[0], $moved->headers->get('Location'));
    // An outdated hash is sent to the current one.
    $moved = $this->fetch('http://localhost/canvas-metatag/share/site/0000000000000000.jpg');
    self::assertSame([302, $urls[0]], [$moved->getStatusCode(), $moved->headers->get('Location')]);

    // Another site image: a new address, and the old file goes with the
    // save.
    $new = $this->createPhoto('New default', 1600, 900);
    $this->config('canvas_metatag.site')->set('identity.default_image', $new->uuid())->save();
    self::assertSame([], self::stored('site'));
    $url = $this->shareUrl(Page::load($page->id()));
    self::assertNotSame($urls[0], $url);
    self::assertSame(302, $this->fetch($urls[0])->getStatusCode());
    self::assertSame(200, $this->fetch($url)->getStatusCode());
    self::assertCount(1, self::stored('site'));
  }

  /**
   * A photo is public only through a page visitors may view.
   *
   * There is no address of a file by its id: a file that no public page
   * shares has no share version.
   */
  public function testPhotoOfHiddenPage(): void {
    $hero = $this->createPhoto('Hero', 1600, 900);
    $page = $this->createPage(['title' => 'Services', 'image' => $hero->id()]);
    $photo = $this->shareUrl($page);
    self::assertSame(200, $this->fetch($photo)->getStatusCode());
    $fid = $hero->get('field_media_image')->target_id;
    self::assertSame(404, $this->statusOf("/canvas-metatag/share/image/$fid/" . basename($photo)));

    // Unpublished: its photo is 404 and its stored file gone.
    $page = Page::load($page->id());
    $page->setUnpublished()->save();
    self::assertSame([], self::stored('en/canvas_page/1'));
    self::assertSame(404, $this->fetch($photo)->getStatusCode());

    // Published again, then its media unpublished: the stored photo goes,
    // and the page shares its card.
    $page = Page::load($page->id());
    $page->setPublished()->save();
    self::assertSame(200, $this->fetch($photo)->getStatusCode());
    $hero->setUnpublished()->save();
    $this->container->get(ShareStore::class)->destruct();
    self::assertSame([], self::stored('en/canvas_page/1'));
    $moved = $this->fetch($photo);
    self::assertSame(302, $moved->getStatusCode());
    self::assertStringEndsWith('.png', $moved->headers->get('Location'));
  }

  /**
   * Addresses that are not ours, or not public, are 404.
   */
  public function testMissing(): void {
    $page = $this->createPage(['title' => 'Services']);
    $url = $this->shareUrl($page);
    $name = basename($url);
    // Refused by the route, before anything is loaded.
    foreach ([
      "/canvas-metatag/share/en/canvas_page/1/NOTAHASH.png",
      "/canvas-metatag/share/en/user/1/$name",
      "/canvas-metatag/share/en/canvas_page/one/$name",
      "/canvas-metatag/share/icon/64/$name",
      "/canvas-metatag/share/image/1/" . substr($name, 0, 16) . '.jpg',
    ] as $path) {
      self::assertSame(404, $this->statusOf($path), $path);
    }
    // Refused by the controller.
    $node = Node::create(['type' => 'article', 'title' => 'Not owned', 'status' => 1]);
    $node->save();
    foreach ([
      "/canvas-metatag/share/xx/canvas_page/1/$name",
      "/canvas-metatag/share/fi/canvas_page/1/$name",
      "/canvas-metatag/share/en/canvas_page/9/$name",
      "/canvas-metatag/share/en/node/{$node->id()}/$name",
      // The router matches without case; the controller does not.
      '/canvas-metatag/share/en/canvas_page/1/' . strtoupper(substr($name, 0, 16)) . '.png',
      '/canvas-metatag/share/en/canvas_page/1/' . substr($name, 0, 16) . '.PNG',
      '/canvas-metatag/share/EN/canvas_page/1/' . $name,
      '/canvas-metatag/share/icon/32/' . strtoupper(substr($name, 0, 16)) . '.png',
    ] as $path) {
      $response = $this->fetch("http://localhost$path");
      self::assertSame(404, $response->getStatusCode(), $path);
      self::assertStringStartsWith('text/plain', (string) $response->headers->get('Content-Type'), $path);
    }
    // A node is owned while its template is enabled.
    $this->generateComponentConfig();
    $template = $this->createTemplate(TRUE);
    $card = $this->shareUrl(Node::load($node->id()));
    self::assertSame(200, $this->fetch($card)->getStatusCode());
    self::assertCount(1, self::stored("en/node/{$node->id()}"));
    // No longer ours without any save of the node (as with an access module
    // or a grants rebuild): the 404 deletes what was stored.
    $template->disable()->save();
    self::assertCount(1, self::stored("en/node/{$node->id()}"));
    self::assertSame(404, $this->fetch($card)->getStatusCode());
    self::assertFalse(is_dir(ShareStore::dir() . "/en/node/{$node->id()}"));
    // An unpublished page is not drawn, and no cache keeps its 404.
    $page = Page::load($page->id());
    $page->setUnpublished()->save();
    $drawn = count(ShareRendererSpy::$drawn);
    $response = $this->fetch($url);
    self::assertSame(404, $response->getStatusCode());
    self::assertTrue($response->headers->hasCacheControlDirective('no-cache'));
    self::assertCount($drawn, ShareRendererSpy::$drawn);
  }

  /**
   * A failing render is 404, logged, and not tried again at once.
   */
  public function testFailure(): void {
    $this->container->get('logger.factory')->addLogger($log = new class() extends AbstractLogger {

      /**
       * The messages of the canvas_metatag channel.
       *
       * @var list<string>
       */
      public array $messages = [];

      /**
       * {@inheritdoc}
       */
      public function log($level, string|\Stringable $message, array $context = []): void {
        if (($context['channel'] ?? '') === 'canvas_metatag') {
          $this->messages[] = strtr((string) $message, array_map('strval', array_filter($context, 'is_scalar')));
        }
      }

    });
    $url = $this->shareUrl($this->createPage(['title' => 'Services']));
    ShareRendererSpy::$broken = TRUE;
    $response = $this->fetch($url);
    self::assertSame(404, $response->getStatusCode());
    self::assertTrue($response->headers->hasCacheControlDirective('no-cache'));
    self::assertCount(1, $log->messages);
    self::assertStringStartsWith('The share image en/canvas_page/1/', $log->messages[0]);
    self::assertStringContainsString('The renderer is broken.', $log->messages[0]);
    self::assertSame([], self::stored('en/canvas_page/1'));
    // Remembered for five minutes: not drawn again.
    self::assertSame(404, $this->fetch($url)->getStatusCode());
    self::assertCount(1, ShareRendererSpy::$drawn);
    self::assertCount(1, $log->messages);

    // Remembered before drawing: a draw that ends the process stays
    // remembered. A photo that gives nothing (too large to decode in the
    // memory left, a format this GD can't read) is logged too, and links
    // get the original file for a while: the head already named the
    // address.
    ShareRendererSpy::$broken = FALSE;
    $this->config('system.performance')->set('cache.page.max_age', 3600)->save();
    $hero = $this->createPhoto('Hero', 1600, 900);
    $page = $this->createPage(['title' => 'Hero', 'image' => $hero->id(), 'path' => ['alias' => '/hero']]);
    $photo = $this->shareUrl($page);
    $file = $hero->get('field_media_image')->entity;
    file_put_contents($file->getFileUri(), 'not an image');
    foreach ([1, 2] as $time) {
      $original = $this->fetch($photo);
      self::assertSame(302, $original->getStatusCode(), "Fetch $time");
      self::assertSame($this->container->get('file_url_generator')->generateAbsoluteString($file->getFileUri()), $original->headers->get('Location'));
      // Not cached: tried again once the failure is forgotten.
      self::assertTrue($original->headers->hasCacheControlDirective('no-cache'));
    }
    // Drawn once, logged once.
    self::assertCount(2, $log->messages);
    self::assertStringContainsString('nothing could be drawn', $log->messages[1]);
    self::assertSame(1, count(array_filter(ShareRendererSpy::$drawn, static fn (array $draw): bool => $draw[0] === 'photo')));
    $path = ShareStore::photoPath(substr(parse_url($photo, PHP_URL_PATH), strlen('/canvas-metatag/share/')), (int) $file->id());
    self::assertNotFalse($this->container->get('cache.default')->get("canvas_metatag:share:$path"));
  }

  /**
   * A request that finds another one drawing the same image draws too.
   *
   * Link previews fetch a freshly shared image from several clients at once:
   * each gets it (design D4: they write the same bytes). A draw that started
   * longer ago than a draw takes ended its process, and counts as failed.
   */
  public function testDrawing(): void {
    $url = $this->shareUrl($this->createPage(['title' => 'Services']));
    $path = substr((string) parse_url($url, PHP_URL_PATH), strlen('/canvas-metatag/share/'));
    $cache = $this->container->get('cache.default');
    $now = $this->container->get('datetime.time')->getRequestTime();

    // Started long ago, never finished: failed.
    $cache->set("canvas_metatag:share:$path", $now - 61, $now + 300);
    self::assertSame(404, $this->fetch($url)->getStatusCode());
    self::assertSame([], ShareRendererSpy::$drawn);

    // Another request is drawing it now: this one draws and stores it too.
    $cache->set("canvas_metatag:share:$path", $now, $now + 300);
    $response = $this->fetch($url);
    self::assertSame(200, $response->getStatusCode());
    self::assertSame([basename($url)], self::stored('en/canvas_page/1'));
    self::assertCount(1, ShareRendererSpy::$drawn);
    self::assertFalse($cache->get("canvas_metatag:share:$path"));
  }

  /**
   * Any language code core accepts has image addresses.
   *
   * A private-use code ("en-x-simple", in core's own list) once failed to
   * build its address, which cost the page its whole head.
   */
  public function testLanguageCodes(): void {
    $page = $this->createPage(['title' => 'Services']);
    foreach (['en-x-simple' => 'Help'] as $langcode => $title) {
      ConfigurableLanguage::createFromLangcode($langcode)->save();
      $page = Page::load($page->id());
      $page->addTranslation($langcode, ['title' => $title, 'status' => TRUE])->save();
      $translation = Page::load($page->id())->getTranslation($langcode);
      $meta = self::meta($this->resolver()->resolve($translation)['head']);
      self::assertStringContainsString("/canvas-metatag/share/$langcode/canvas_page/1/", $meta['og:image'], $langcode);
      $response = $this->fetch($meta['og:image']);
      self::assertSame(200, $response->getStatusCode(), $langcode);
      self::assertSame('image/png', $response->headers->get('Content-Type'));
      [, $input] = end(ShareRendererSpy::$drawn);
      self::assertSame($title, $input['title']);
    }
  }

  /**
   * Only the versions of a file that may no longer be shown are deleted.
   *
   * A file deleted or made temporary, or a media item unpublished or
   * deleted, takes its own versions; other pages keep theirs, and a file
   * that was never an image someone shared takes nothing.
   */
  public function testForgetPhotos(): void {
    $one = $this->createPhoto('One', 1600, 900);
    $two = $this->createPhoto('Two', 1600, 900);
    $first = $this->createPage(['title' => 'First', 'image' => $one->id(), 'path' => ['alias' => '/first']]);
    $second = $this->createPage(['title' => 'Second', 'image' => $two->id(), 'path' => ['alias' => '/second']]);
    $store = $this->container->get(ShareStore::class);
    $make = function () use ($first, $second): void {
      foreach ([$first, $second] as $page) {
        self::assertSame(200, $this->fetch($this->shareUrl(Page::load($page->id())))->getStatusCode());
        self::assertCount(1, self::stored("en/canvas_page/{$page->id()}"));
      }
    };
    $make();

    // A text file and a temporary image: nothing goes.
    $text = File::create(['uri' => 'public://notes.txt', 'status' => 1]);
    file_put_contents($text->getFileUri(), 'notes');
    $text->save();
    $text->delete();
    $temporary = File::create(['uri' => 'public://upload.png', 'status' => 0]);
    imagepng(imagecreatetruecolor(10, 10), $temporary->getFileUri());
    $temporary->save();
    $temporary->delete();
    $store->destruct();
    self::assertCount(1, self::stored("en/canvas_page/{$first->id()}"));
    self::assertCount(1, self::stored("en/canvas_page/{$second->id()}"));

    // The first page's media unpublished: only its version goes.
    $one->setUnpublished()->save();
    $store->destruct();
    self::assertSame([], self::stored("en/canvas_page/{$first->id()}"));
    self::assertCount(1, self::stored("en/canvas_page/{$second->id()}"));

    // The second page's file made temporary, then deleted by cron.
    $file = $two->get('field_media_image')->entity;
    $file->setTemporary();
    $file->save();
    $store->destruct();
    self::assertSame([], self::stored("en/canvas_page/{$second->id()}"));

    // A media item deleted, and a file deleted: only their versions go.
    $three = $this->createPhoto('Three', 1600, 900);
    $four = $this->createPhoto('Four', 1600, 900);
    $third = $this->createPage(['title' => 'Third', 'image' => $three->id(), 'path' => ['alias' => '/third']]);
    $fourth = $this->createPage(['title' => 'Fourth', 'image' => $four->id(), 'path' => ['alias' => '/fourth']]);
    foreach ([$third, $fourth] as $page) {
      self::assertSame(200, $this->fetch($this->shareUrl(Page::load($page->id())))->getStatusCode());
    }
    $three->delete();
    $store->destruct();
    self::assertSame([], self::stored("en/canvas_page/{$third->id()}"));
    self::assertCount(1, self::stored("en/canvas_page/{$fourth->id()}"));
    $four->get('field_media_image')->entity->delete();
    $store->destruct();
    self::assertSame([], self::stored("en/canvas_page/{$fourth->id()}"));
  }

  /**
   * A node whose template links its image to a field shares that image.
   *
   * Head-output "A linked image field": a 1200 × 630 share version under the
   * node's address, with the field image's alt text.
   */
  public function testLinkedImage(): void {
    $this->createField('field_hero', 'entity_reference', 'Hero', ['target_type' => 'media'], [
      'handler' => 'default:media',
      'handler_settings' => ['target_bundles' => ['image' => 'image']],
    ]);
    $hero = $this->createPhoto('A waving hand', 1600, 900);
    $node = Node::create(['type' => 'article', 'title' => 'Hello', 'status' => 1, 'field_hero' => $hero->id()]);
    $node->save();
    $link = $this->linkTo('Hero › Image', 'image');
    $this->generateComponentConfig();
    $this->createTemplate(TRUE, ['social' => ['image' => $link]]);
    $meta = self::meta($this->resolver()->resolve(Node::load($node->id()))['head']);
    self::assertMatchesRegularExpression("#^http://localhost/canvas-metatag/share/en/node/{$node->id()}/[0-9a-f]{16}\.jpg$#", $meta['og:image']);
    $rows = array_intersect_key($meta, array_flip(['og:image:width', 'og:image:height', 'og:image:alt']));
    self::assertSame(['og:image:width' => '1200', 'og:image:height' => '630', 'og:image:alt' => 'A waving hand'], $rows);
    $response = $this->fetch($meta['og:image']);
    self::assertSame(200, $response->getStatusCode());
    self::assertSame('image/jpeg', $response->headers->get('Content-Type'));
    self::assertSame([1200, 630, IMAGETYPE_JPEG], array_slice(getimagesizefromstring(self::bytes($response)), 0, 3));
  }

  /**
   * A stored card goes when visitors can no longer see what it shows.
   */
  public function testForget(): void {
    $page = $this->createPage(['title' => 'Services']);
    $page->addTranslation('fi', ['title' => 'Palvelut', 'status' => TRUE, 'path' => ['alias' => '/palvelut']])->save();
    $store = function () use ($page): array {
      $urls = [];
      foreach (['en', 'fi'] as $langcode) {
        $urls[$langcode] = $this->shareUrl(Page::load($page->id())->getTranslation($langcode));
        self::assertSame(200, $this->fetch($urls[$langcode])->getStatusCode());
        self::assertCount(1, self::stored("$langcode/canvas_page/1"));
      }
      return $urls;
    };
    $gone = function (string $langcode, string $url): void {
      self::assertFalse(is_dir(ShareStore::dir() . "/$langcode/canvas_page/1"), $langcode);
      self::assertSame(404, $this->fetch($url)->getStatusCode());
    };

    // A deleted translation.
    $urls = $store();
    $page = Page::load($page->id());
    $page->removeTranslation('fi');
    $page->save();
    $gone('fi', $urls['fi']);
    self::assertCount(1, self::stored('en/canvas_page/1'));

    // Unpublished.
    $page = Page::load($page->id());
    $page->addTranslation('fi', ['title' => 'Palvelut', 'status' => TRUE])->save();
    $urls = $store();
    $page = Page::load($page->id());
    $page->setUnpublished()->save();
    $gone('en', $urls['en']);

    // Anonymous visitors lose access.
    $page = Page::load($page->id());
    $page->setPublished()->save();
    $urls = $store();
    // A forward draft, unpublished: what visitors see is unchanged.
    $page = Page::load($page->id());
    $page->setNewRevision();
    $page->isDefaultRevision(FALSE);
    $page->setUnpublished()->save();
    self::assertCount(1, self::stored('en/canvas_page/1'));
    self::assertCount(1, self::stored('fi/canvas_page/1'));
    Role::load('anonymous')->revokePermission('access content')->save();
    $gone('en', $urls['en']);
    $gone('fi', $urls['fi']);
    Role::load('anonymous')->grantPermission('access content')->save();

    // Deleted.
    $urls = $store();
    Page::load($page->id())->delete();
    $gone('en', $urls['en']);
    $gone('fi', $urls['fi']);
  }

  /**
   * The site icons: three sizes, PNG.
   */
  public function testIcons(): void {
    foreach ([32 => TRUE, 192 => TRUE, 180 => FALSE] as $size => $alpha) {
      $url = $this->resolver()->iconUrl($size, new CacheableMetadata());
      self::assertMatchesRegularExpression("#^http://localhost/canvas-metatag/share/icon/$size/[0-9a-f]{16}\.png$#", $url);
      $response = $this->fetch($url);
      self::assertSame(200, $response->getStatusCode());
      self::assertSame('image/png', $response->headers->get('Content-Type'));
      self::assertFalse($response->headers->has('X-Robots-Tag'));
      $image = imagecreatefromstring(self::bytes($response));
      self::assertSame([$size, $size], [imagesx($image), imagesy($image)]);
      // The touch icon is opaque.
      self::assertSame($alpha, (imagecolorat($image, 0, 0) >> 24) > 0, (string) $size);
    }
    self::assertCount(1, self::stored('icon/180'));
    // What they are drawn from changed: the stored icons go.
    $this->config('system.site')->set('name', 'Renamed')->save();
    self::assertDirectoryDoesNotExist(ShareStore::dir() . '/icon');
    $moved = $this->fetch($url);
    self::assertSame(302, $moved->getStatusCode());
    self::assertSame($this->resolver()->iconUrl(180, new CacheableMetadata()), $moved->headers->get('Location'));
  }

  /**
   * The address an entity shares, built as a fresh request would.
   */
  private function shareUrl(Page|Node $entity): string {
    $this->container->get('entity.memory_cache')->deleteAll();
    $url = $this->resolver()->shareUrl($entity, new CacheableMetadata());
    self::assertNotNull($url);
    return $url;
  }

  /**
   * The status of a request; a route that does not match is 404.
   */
  private function statusOf(string $path): int {
    try {
      return $this->fetch("http://localhost$path")->getStatusCode();
    }
    catch (NotFoundHttpException) {
      return 404;
    }
  }

}
