<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Controller\ApiController;
use Drupal\canvas_metatag\ShareStore;
use Drupal\canvas_metatag\Values;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;

/**
 * The dialog's preview of the image a draft shares.
 *
 * Share-images "The editor previews the draft's image"; design D5.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(ApiController::class)]
#[Group('canvas_metatag')]
#[RequiresFunction('imagettftext')]
final class SharePreviewTest extends CanvasKernelTestBase {

  use RequestTrait;
  use SeoFixtureTrait;
  use ShareTestTrait;
  use UserCreationTrait;

  /**
   * What a visitor and every editor of the test may do.
   */
  private const VISITOR = ['access content', 'view media'];

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'node',
    'field',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
  }

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    self::spyOnRenderer($container);
  }

  /**
   * An editor sees the draft's card; it is drawn in memory only.
   */
  public function testDraft(): void {
    $page = $this->createPage(['title' => 'Pricing']);
    $draft = clone $page;
    $draft->set('title', 'Draft title');
    $this->container->get(AutoSaveManager::class)->saveEntity($draft, '0b6c7f0e-6c1f-4a53-9f0b-1c2f3d4e5a6b');
    $preview = "/canvas-metatag/api/share-preview?entity_type=canvas_page&id={$page->id()}&v=1";

    $this->setUpCurrentUser(permissions: [...self::VISITOR, Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $response = $this->request(Request::create($preview));
    self::assertSame(200, $response->getStatusCode());
    self::assertSame('image/png', $response->headers->get('Content-Type'));
    // `v` hashes what is drawn: the editor's browser alone keeps it.
    self::assertTrue($response->headers->hasCacheControlDirective('private'));
    self::assertSame('3600', $response->headers->getCacheControlDirective('max-age'));
    self::assertFalse($response->headers->hasCacheControlDirective('public'));
    self::assertSame([1200, 630], array_slice(getimagesizefromstring((string) $response->getContent()), 0, 2));
    self::assertSame('Draft title', end(ShareRendererSpy::$drawn)[1]['title']);
    self::assertDirectoryDoesNotExist(ShareStore::dir());

    // Without update access: what is published, never the draft.
    $this->setUpCurrentUser(['name' => 'reader'], [...self::VISITOR, 'edit canvas metatag']);
    self::assertSame(200, $this->request(Request::create($preview))->getStatusCode());
    self::assertSame('Pricing', end(ShareRendererSpy::$drawn)[1]['title']);
    self::assertDirectoryDoesNotExist(ShareStore::dir());
  }

  /**
   * Site › Sharing's sample, drawn from what is being edited, in memory.
   */
  public function testSample(): void {
    $logo = $this->createImage('Orange logo');
    $sample = static fn (array $query): Request => Request::create('/canvas-metatag/api/share-sample?' . http_build_query($query + [
      'sample' => 'page',
      'title' => 'About us',
      'name' => '',
      'logo' => '',
      'colour' => '',
      'share_fallback' => 'card',
      'default_image' => '',
    ]));
    $json = fn (array $query): array => json_decode((string) $this->request($sample($query))->getContent(), TRUE);
    $shows = fn (array $query): array => array_values(array_intersect_key($json($query), array_flip(['image', 'shows'])));
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag', 'administer canvas metatag']);
    $response = $this->request($sample([]));
    self::assertSame(200, $response->getStatusCode());
    self::assertTrue($response->headers->hasCacheControlDirective('no-store'));
    $drawn = json_decode((string) $response->getContent(), TRUE);
    self::assertStringStartsWith('data:image/png;base64,', $drawn['image']);
    self::assertSame([1200, 630], array_slice(getimagesizefromstring(base64_decode(substr($drawn['image'], 22))), 0, 2));
    // A fresh site: neutral, white text, measured.
    self::assertSame([FALSE, FALSE, '#FFFFFF'], [$drawn['svg'], $drawn['picked'], $drawn['text']]);
    self::assertGreaterThanOrEqual(5.5, $drawn['contrast']);
    $input = end(ShareRendererSpy::$drawn)[1];
    self::assertSame(['About us', 'Example'], [$input['title'], $input['site_name']]);
    // The title the link shows beside the image.
    self::assertSame('About us', $drawn['title']);

    // The colour, the name and the logo being edited.
    $edited = $sample(['colour' => '#FF6B00', 'name' => 'Studio', 'logo' => $logo->uuid()]);
    $drawn = json_decode((string) $this->request($edited)->getContent(), TRUE);
    self::assertSame('#FF6B00', end(ShareRendererSpy::$drawn)[1]['colour']);
    self::assertSame('Studio', end(ShareRendererSpy::$drawn)[1]['site_name']);
    self::assertStringEndsWith('orange-logo.png', end(ShareRendererSpy::$drawn)[1]['logo']['uri']);
    self::assertGreaterThanOrEqual(5.5, $drawn['contrast']);

    // A page without an image shares what "When a page has no image" says.
    self::assertSame('card', $drawn['shows']);
    self::assertSame([NULL, 'none'], $shows(['share_fallback' => 'none']));
    // "Use this image" before one is chosen: none yet, as the head sends.
    self::assertSame([NULL, 'none'], $shows(['share_fallback' => 'image']));
    // A title the fonts cannot draw: the head sends no card, so neither
    // does the sample. The colour is still described.
    $undrawn = $json(['title' => '湖畔の夏至コンサート']);
    self::assertSame([NULL, 'none', '湖畔の夏至コンサート'], [$undrawn['image'], $undrawn['shows'], $undrawn['title']]);
    self::assertGreaterThanOrEqual(5.5, $undrawn['contrast']);
    $site = $this->createPhoto('Site image', 2400, 1600);
    $chosen = $json(['share_fallback' => 'image', 'default_image' => $site->uuid()]);
    self::assertSame('photo', $chosen['shows']);
    self::assertSame([1200, 630], array_slice(getimagesizefromstring(base64_decode(substr($chosen['image'], 23))), 0, 2));
    // With a site image, an undrawable title shares it, as its head does.
    self::assertSame('photo', $json(['title' => '湖畔の夏至コンサート', 'default_image' => $site->uuid()])['shows']);
    // Cards are still described, for the Colour row.
    self::assertGreaterThanOrEqual(5.5, $chosen['contrast']);

    // The home page shares what the front page shares: never the site card
    // here. Without its own image, the card of its title.
    $home = $this->createPage(['title' => 'Welcome home', 'path' => ['alias' => '/home']]);
    $this->config('system.site')->set('page.front', '/home')->save();
    $card = $json(['sample' => 'home']);
    self::assertSame('card', $card['shows']);
    // With the description its head sends.
    self::assertSame(self::meta($this->resolver()->resolve(Page::load($home->id()))['head'])['og:description'] ?? '', $card['description']);
    $drawn = end(ShareRendererSpy::$drawn)[1];
    self::assertSame(['page', 'Welcome home'], [$drawn['layout'], $drawn['title']]);
    // A link without an image still shows the home page's title.
    $none = $json(['sample' => 'home', 'share_fallback' => 'none']);
    self::assertSame(['none', 'Welcome home'], [$none['shows'], $none['title']]);
    // Sampling cards while the site stores another choice: the card the
    // front page would share, its kind's line included.
    $this->config('canvas_metatag.site')->set('identity.share_fallback', 'none')->save();
    $home = Page::load($home->id());
    $home->set('canvas_metatag', Values::encode(['schema' => ['type' => 'Recipe']]))->save();
    self::assertSame('card', $json(['sample' => 'home'])['shows']);
    $drawn = end(ShareRendererSpy::$drawn)[1];
    self::assertSame(['Welcome home', 'Recipe'], [$drawn['title'], $drawn['label']]);
    $this->config('canvas_metatag.site')->set('identity.share_fallback', 'card')->save();
    // With its own image: the address its head sends.
    $home = Page::load($home->id());
    $home->set('image', $this->createPhoto('Hero', 1600, 900)->id())->save();
    $photo = $json(['sample' => 'home']);
    self::assertSame('photo', $photo['shows']);
    self::assertMatchesRegularExpression("#^http://localhost/canvas-metatag/share/en/canvas_page/{$home->id()}/[0-9a-f]{16}\\.jpg$#", $photo['image']);

    // Checked as a save checks them; nothing stored.
    $refused = [
      ['colour' => 'blue'],
      ['logo' => 'nope'],
      ['sample' => 'other'],
      ['title' => str_repeat('a', 256)],
      ['share_fallback' => 'all'],
      ['default_image' => 'nope'],
    ];
    foreach ($refused as $bad) {
      self::assertSame(400, $this->request($sample($bad))->getStatusCode(), json_encode($bad));
    }
    self::assertDirectoryDoesNotExist(ShareStore::dir());

    // Anyone else sees what is stored: no image of theirs is decoded.
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    $stored = $json(['share_fallback' => 'image', 'default_image' => $site->uuid(), 'name' => 'Studio']);
    self::assertSame('card', $stored['shows']);
    self::assertSame('Example', end(ShareRendererSpy::$drawn)[1]['site_name']);
  }

  /**
   * A page the user may not view is refused.
   */
  public function testAccess(): void {
    $page = $this->createPage(['title' => 'Pricing', 'status' => FALSE]);
    $preview = "/canvas-metatag/api/share-preview?entity_type=canvas_page&id={$page->id()}";
    $this->setUpCurrentUser(permissions: [...self::VISITOR, 'edit canvas metatag']);
    self::assertSame(403, $this->request(Request::create($preview))->getStatusCode());
    self::assertSame(400, $this->request(Request::create('/canvas-metatag/api/share-preview?entity_type=user&id=1'))->getStatusCode());
    self::assertSame([], ShareRendererSpy::$drawn);
  }

}
