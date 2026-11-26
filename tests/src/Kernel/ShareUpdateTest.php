<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\file\FileInterface;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use PHPUnit\Framework\Attributes\CoversFunction;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The update that stores what pages without an image share.
 *
 * Site-seo "Upgraded sites keep their site image".
 */
#[RunTestsInSeparateProcesses]
#[CoversFunction('canvas_metatag_post_update_share_fallback')]
#[Group('canvas_metatag')]
#[RequiresFunction('imagettftext')]
final class ShareUpdateTest extends CanvasKernelTestBase {

  use GenerateComponentConfigTrait;
  use RequestTrait;
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
    'page_cache',
    'dynamic_page_cache',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->installSchema('user', ['users_data']);
    $this->generateComponentConfig();
    require_once dirname(__DIR__, 3) . '/canvas_metatag.post_update.php';
  }

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    self::allowPageCaches($container);
    self::spyOnRenderer($container);
  }

  /**
   * A site with a default image keeps sharing it; a cached page is rebuilt.
   */
  public function testSiteImage(): void {
    $default = $this->createImage('Default image', ['alt' => 'The studio at night', 'width' => 1600, 'height' => 900]);
    $this->config('canvas_metatag.site')->set('identity.default_image', $default->uuid())->save();
    $this->createPage(['title' => 'Services', 'path' => ['alias' => '/services']]);
    // A site from before the choice: neither member stored. Its page was
    // cached with the share it had then, forced here to tell the rebuilt
    // page from the cached one.
    $this->config('canvas_metatag.site')->set('identity.share_fallback', 'card')->save();
    $cached = self::meta(self::readHead($this->get('/services')));
    self::assertSame('image/png', $cached['og:image:type']);
    $this->forgetChoice();
    self::assertSame('image/png', self::meta(self::readHead($this->get('/services')))['og:image:type'], 'Still cached.');

    self::assertSame('Pages without an image keep sharing the site image.', canvas_metatag_post_update_share_fallback());
    self::assertSame(['image', ''], [
      $this->config('canvas_metatag.site')->get('identity.share_fallback'),
      $this->config('canvas_metatag.site')->get('identity.colour'),
    ]);
    $meta = self::meta(self::readHead($this->get('/services')));
    // The site image's one address (share-images "No address names a file").
    $file = $default->get('field_media_image')->entity;
    \assert($file instanceof FileInterface);
    self::assertSame($this->resolver()->siteShareUrl($file, new CacheableMetadata()), $meta['og:image']);
    self::assertStringContainsString('/canvas-metatag/share/site/', $meta['og:image']);
    self::assertSame(['image/jpeg', '1200', '630', 'The studio at night'], [
      $meta['og:image:type'],
      $meta['og:image:width'],
      $meta['og:image:height'],
      $meta['og:image:alt'],
    ]);
  }

  /**
   * The sharing choices are the same in every language.
   *
   * Site-seo "The identity holds the sharing choices": neither is a
   * translatable type, so no language override of them is offered.
   */
  public function testNotTranslatable(): void {
    $identity = $this->container->get('config.typed')->get('canvas_metatag.site')->get('identity');
    foreach (['share_fallback', 'colour', 'default_image'] as $key) {
      self::assertEmpty($identity->get($key)->getDataDefinition()['translatable'] ?? NULL, $key);
    }
  }

  /**
   * A site without one gets the card.
   */
  public function testCard(): void {
    $this->createPage(['title' => 'Services', 'path' => ['alias' => '/services']]);
    $this->forgetChoice();
    self::assertSame('Pages without an image now share a card made from their title.', canvas_metatag_post_update_share_fallback());
    self::assertSame('card', $this->config('canvas_metatag.site')->get('identity.share_fallback'));
    $meta = self::meta(self::readHead($this->get('/services')));
    self::assertMatchesRegularExpression('#/canvas-metatag/share/en/canvas_page/\d+/[0-9a-f]{16}\.png$#', $meta['og:image']);
    self::assertSame(['image/png', 'Services, Example'], [$meta['og:image:type'], $meta['og:image:alt']]);
  }

  /**
   * A site whose default image visitors can no longer see gets the card.
   *
   * A stale image (deleted, unpublished, not public) would share nothing.
   */
  public function testStaleImage(): void {
    $default = $this->createImage('Default image', ['alt' => 'The studio at night', 'width' => 1600, 'height' => 900]);
    $this->config('canvas_metatag.site')->set('identity.default_image', $default->uuid())->save();
    $default->setUnpublished()->save();
    $this->createPage(['title' => 'Services', 'path' => ['alias' => '/services']]);
    $this->forgetChoice();
    self::assertSame('Pages without an image now share a card made from their title.', canvas_metatag_post_update_share_fallback());
    self::assertSame('card', $this->config('canvas_metatag.site')->get('identity.share_fallback'));
    self::assertSame('image/png', self::meta(self::readHead($this->get('/services')))['og:image:type']);

    // Deleted outright: the same.
    $default->setPublished()->save();
    $default->delete();
    $this->forgetChoice();
    canvas_metatag_post_update_share_fallback();
    self::assertSame('card', $this->config('canvas_metatag.site')->get('identity.share_fallback'));
  }

  /**
   * Requests a path as an anonymous visitor.
   */
  private function get(string $path): Response {
    $this->container->get('entity.memory_cache')->deleteAll();
    $response = $this->request(Request::create($path));
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), $path);
    return $response;
  }

  /**
   * Stores the identity as a site from before the choice has it.
   *
   * Written past the configuration API's events, as an old site's stored
   * data is: nothing is invalidated.
   */
  private function forgetChoice(): void {
    $identity = $this->config('canvas_metatag.site')->get('identity');
    unset($identity['share_fallback'], $identity['colour']);
    $data = $this->config('canvas_metatag.site')->set('identity', $identity)->getRawData();
    $this->container->get('config.storage')->write('canvas_metatag.site', $data);
    $this->container->get('config.factory')->reset('canvas_metatag.site');
  }

}
