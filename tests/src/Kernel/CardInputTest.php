<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;

// cspell:ignore Palvelut palvelut Esimerkki خدماتنا
/**
 * What a card draws, and its address.
 *
 * Share-images "Made images have their own address"; design D3.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Resolver::class)]
#[Group('canvas_metatag')]
#[RequiresFunction('imagettftext')]
final class CardInputTest extends CanvasKernelTestBase {

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
  }

  /**
   * What changes the hash, and what does not.
   */
  public function testHash(): void {
    $page = $this->createPage(['title' => 'Services']);
    $page->addTranslation('fi', ['title' => 'Palvelut', 'status' => TRUE, 'path' => ['alias' => '/palvelut']])->save();
    $this->container->get('language_manager')->getLanguageConfigOverride('fi', 'system.site')->set('name', 'Esimerkki')->save();

    $input = $this->input('en');
    self::assertSame([
      'layout' => 'page',
      'title' => 'Services',
      'label' => '',
      'dir' => 'L',
      'langcode' => 'en',
      'site_name' => 'Example',
      'logo' => NULL,
      'colour' => '',
      'version' => 1,
    ], $input);
    $en = Resolver::hash($input);
    self::assertMatchesRegularExpression('/^[0-9a-f]{16}$/', $en);
    // The Finnish page reads its configuration in Finnish, whatever the
    // interface language.
    $fi = Resolver::hash($this->input('fi'));
    self::assertSame('Esimerkki', $this->input('fi')['site_name']);
    self::assertNotSame($en, $fi);
    $manager = $this->container->get('language_manager');
    $manager->setConfigOverrideLanguage($manager->getLanguage('fi'));
    self::assertSame($en, Resolver::hash($this->input('en')));
    $manager->setConfigOverrideLanguage($manager->getLanguage('en'));
    self::assertSame($fi, Resolver::hash($this->input('fi')));

    // Not the host the request came in on.
    $this->container->get(RequestStack::class)->push(Request::create('http://evil.example/'));
    self::assertSame($en, Resolver::hash($this->input('en')));
    $this->container->get(RequestStack::class)->pop();

    // The route rebuilds the Finnish hash for /fi, and draws it.
    $response = $this->fetch("http://localhost/canvas-metatag/share/fi/canvas_page/{$page->id()}/$fi.png");
    self::assertSame(200, $response->getStatusCode());
    self::assertSame('Palvelut', end(ShareRendererSpy::$drawn)[1]['title']);

    // Each of these changes the hash.
    $seen = [$en];
    $changed = function () use (&$seen): void {
      $hash = Resolver::hash($this->input('en'));
      self::assertNotContains($hash, $seen);
      $seen[] = $hash;
    };
    $page = Page::load($page->id());
    $page->set('title', 'Our services')->save();
    $changed();
    $this->config('system.site')->set('name', 'Example Studio')->save();
    $changed();
    $logo = $this->createPhoto('Logo', 64, 64);
    $this->config('canvas_metatag.site')->set('identity.logo', $logo->uuid())->save();
    $changed();
    $file = $logo->get('field_media_image')->entity;
    self::assertSame(['uri' => 'public://logo.png', 'changed' => (int) $file->getChangedTime()], $this->input('en')['logo']);
    $this->config('canvas_metatag.site')->set('identity.colour', '#0f8a7e')->save();
    $changed();
    self::assertSame('#0F8A7E', $this->input('en')['colour']);
    $page = Page::load($page->id());
    $page->set('canvas_metatag', Values::encode(['schema' => ['type' => 'Event']]))->save();
    $changed();
    self::assertSame('Event', $this->input('en')['label']);
  }

  /**
   * A right-to-left language draws a mirrored card.
   *
   * Share-images "An Arabic page": the direction comes from the language.
   */
  public function testRightToLeft(): void {
    ConfigurableLanguage::createFromLangcode('ar')->save();
    self::assertSame('rtl', $this->container->get('language_manager')->getLanguage('ar')->getDirection());
    $page = $this->createPage(['title' => 'Services']);
    $page->addTranslation('ar', ['title' => 'خدماتنا', 'status' => TRUE])->save();
    $en = $this->input('en');
    $ar = $this->input('ar');
    self::assertSame(['L', 'R'], [$en['dir'], $ar['dir']]);
    self::assertSame('ar', $ar['langcode']);
    self::assertNotSame(Resolver::hash($en), Resolver::hash($ar));
  }

  /**
   * A logo set for every theme in Appearance › Settings is the theme's.
   *
   * Read as Drupal reads it, and a change to it gives the head a new card.
   */
  public function testGlobalThemeLogo(): void {
    // Public files on disk: a theme logo is read by its real path.
    $public = sys_get_temp_dir() . '/canvas-metatag-public-' . bin2hex(random_bytes(4));
    mkdir($public);
    $this->setSetting('file_public_path', $public);
    $this->container->get('theme_installer')->install(['stark']);
    $this->config('system.theme')->set('default', 'stark')->save();
    $this->createPage(['title' => 'Services']);
    self::assertNull($this->input('en')['logo']);

    $image = imagecreatetruecolor(64, 64);
    imagepng($image, 'public://global-logo.png');
    $this->config('system.theme.global')->set('logo.use_default', FALSE)->set('logo.path', 'public://global-logo.png')->save();
    self::assertSame(['path' => 'public://global-logo.png', 'changed' => filemtime('public://global-logo.png')], $this->input('en')['logo']);
    $resolved = $this->resolver()->resolve(Page::load(1));
    self::assertContains('config:system.theme.global', $resolved['cacheability']->getCacheTags());
    $this->container->get('file_system')->deleteRecursive($public);
  }

  /**
   * The card draws the social title as resolved, a composed one joined.
   *
   * Design D11a; tasks 4.5a.
   */
  public function testComposedTitle(): void {
    $this->generateComponentConfig();
    NodeType::create(['type' => 'venue', 'name' => 'Venue'])->save();
    FieldStorageConfig::create(['field_name' => 'field_city', 'entity_type' => 'node', 'type' => 'string'])->save();
    FieldConfig::create(['field_name' => 'field_city', 'entity_type' => 'node', 'bundle' => 'venue', 'label' => 'City'])->save();
    $this->createField('field_venue', 'entity_reference', 'Venue', ['target_type' => 'node'], [
      'handler' => 'default:node',
      'handler_settings' => ['target_bundles' => ['venue' => 'venue']],
    ]);
    $this->createTemplate(TRUE, [
      'social' => ['title' => ['parts' => [['fact' => 'title'], ['text' => ' in '], $this->linkTo('Venue › City')]]],
    ]);
    $author = $this->author->id();
    $venue = Node::create(['type' => 'venue', 'title' => 'Lakeside Hall', 'field_city' => 'Helsinki', 'uid' => $author]);
    $venue->save();
    $event = Node::create([
      'type' => 'article',
      'title' => 'Midsummer Night Concert',
      'field_venue' => $venue->id(),
      'uid' => $author,
    ]);
    $event->save();

    $input = $this->card($event);
    self::assertSame('Midsummer Night Concert in Helsinki', $input['title']);
    $before = Resolver::hash($input);
    $venue->set('field_city', 'Tampere')->save();
    $this->container->get('entity.memory_cache')->deleteAll();
    $input = $this->card(Node::load($event->id()));
    self::assertSame('Midsummer Night Concert in Tampere', $input['title']);
    self::assertNotSame($before, Resolver::hash($input));
  }

  /**
   * The card input of the page in a language, built afresh.
   */
  private function input(string $langcode): array {
    $this->container->get('entity.memory_cache')->deleteAll();
    return $this->card(Page::load(1)->getTranslation($langcode));
  }

  /**
   * The input of the card an entity shares.
   */
  private function card(ContentEntityInterface $entity): array {
    $card = $this->resolver()->share($entity, new CacheableMetadata())['card'] ?? NULL;
    self::assertIsArray($card);
    return $card;
  }

}
