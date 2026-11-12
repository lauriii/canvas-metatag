<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Hook\CanvasMetatagHooks;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Extension\ModuleInstallerInterface;
use Drupal\metatag\Entity\MetatagDefaults;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;

/**
 * Tests that the Metatag module is silent where the head is ours.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(CanvasMetatagHooks::class)]
#[Group('canvas_metatag')]
final class MetatagCoexistenceTest extends CanvasKernelTestBase {

  use GenerateComponentConfigTrait;
  use RequestTrait;
  use SeoFixtureTrait;
  use UserCreationTrait;

  private const FROM_METATAG = 'From the Metatag module';

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    if (!$this->container->get('extension.list.module')->exists('metatag')) {
      self::markTestSkipped('The metatag module is not in the codebase.');
    }
    $this->setUpSite();
    $this->generateComponentConfig();
    // Installed, not merely enabled: Canvas gives its pages a field of the
    // Metatag module, and the module ships the defaults it renders.
    $this->container->get(ModuleInstallerInterface::class)->install(['metatag']);
    // The node defaults have a description of their own, which wins over the
    // global one on nodes.
    foreach (['global', 'node'] as $id) {
      $defaults = MetatagDefaults::load($id);
      self::assertInstanceOf(MetatagDefaults::class, $defaults);
      $defaults->set('tags', ['description' => self::FROM_METATAG] + $defaults->get('tags'))->save();
    }
  }

  /**
   * Each tag once on what is ours; Metatag's output on what is not.
   */
  public function testCoexistence(): void {
    // The page carries values of the Metatag module, as a page edited before
    // this module was installed does.
    $page = $this->createPage([
      'metatags' => (string) json_encode([
        'title' => 'Metatag title',
        'description' => self::FROM_METATAG,
        'canonical_url' => 'https://metatag.example.com/x',
      ]),
    ]);
    $this->createTemplate(TRUE);
    $article = Node::create(['type' => 'article', 'title' => 'Hello']);
    $article->save();
    NodeType::create(['type' => 'note', 'name' => 'Note'])->save();
    $note = Node::create(['type' => 'note', 'title' => 'A note']);
    $note->save();

    foreach (['/pricing' => 'Pricing | Example', '/node/' . $article->id() => 'Hello | Example'] as $path => $title) {
      $html = $this->html($path);
      self::assertSame(1, substr_count($html, '<title>'), $path);
      self::assertStringContainsString("<title>$title</title>", $html, $path);
      self::assertSame(1, substr_count($html, 'rel="canonical"'), $path);
      self::assertStringContainsString('<link rel="canonical" href="http://localhost' . $path . '"', $html, $path);
      self::assertSame(1, substr_count($html, 'name="robots"'), $path);
      self::assertSame(1, substr_count($html, 'property="og:title"'), $path);
      self::assertSame(1, substr_count($html, 'application/ld+json'), $path);
      self::assertLessThanOrEqual(1, substr_count($html, 'name="description"'), $path);
      // Nothing of the Metatag module: not its values, not its own tags.
      self::assertStringNotContainsString(self::FROM_METATAG, $html, $path);
      self::assertStringNotContainsString('metatag.example.com', $html, $path);
      self::assertStringNotContainsString('rel="shortlink"', $html, $path);
      self::assertStringNotContainsString('name="title"', $html, $path);
    }
    self::assertStringContainsString('<meta name="description" content="Plans and prices for Example." />', $this->html('/pricing'));

    // A node we do not own keeps what the Metatag module gives it.
    $html = $this->html('/node/' . $note->id());
    self::assertStringContainsString('<meta name="description" content="' . self::FROM_METATAG . '" />', $html);
    self::assertStringNotContainsString('application/ld+json', $html);
    self::assertStringNotContainsString('property="og:title"', $html);

    // Its computed field and its tokens are empty for what is ours.
    $token = $this->container->get('token');
    $replace = static fn (ContentEntityInterface $entity): string => (string) $token->replace('[metatag:description]', [], [
      'entity' => $entity,
      'clear' => TRUE,
    ]);
    foreach ([Page::load($page->id()), Node::load($article->id())] as $owned) {
      self::assertInstanceOf(ContentEntityInterface::class, $owned);
      self::assertSame([], $owned->get('metatag')->getValue(), $owned->getEntityTypeId());
      self::assertSame('', $replace($owned), $owned->getEntityTypeId());
    }
    $note = Node::load($note->id());
    self::assertInstanceOf(ContentEntityInterface::class, $note);
    self::assertNotSame([], $note->get('metatag')->getValue());
    self::assertSame(self::FROM_METATAG, $replace($note));

    // The Page data form: no input of the Metatag module, whose title would
    // edit a value that no longer renders, and no built-in search preview.
    // Canvas's own description and image inputs stay.
    $this->setUpCurrentUser(permissions: ['access content', 'view media', Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $form = $this->container->get('entity.form_builder')->getForm(Page::load($page->id()));
    self::assertFalse($form['metatags']['#access']);
    self::assertFalse($form['metatags']['widget'][0]['basic']['title']['#access']);
    self::assertFalse($form['seo_settings']['serp_preview']['#access']);
    self::assertNotFalse($form['seo_settings']['description']['#access'] ?? TRUE);
    self::assertNotFalse($form['seo_settings']['image']['#access'] ?? TRUE);
    $layout = self::decodeResponse($this->request(Request::create('/canvas/api/v0/layout/canvas_page/' . $page->id())));
    $names = array_keys($layout['entity_form_fields']);
    self::assertSame([], array_values(array_filter($names, static fn (string $name): bool => str_starts_with($name, 'metatags'))));
    self::assertContains('description[0][value]', $names);
  }

  /**
   * The HTML an anonymous visitor gets for a path.
   *
   * The Metatag module keeps the tags of the page in a static variable, which
   * lives as long as the request in production and as long as the test here.
   */
  private function html(string $path): string {
    drupal_static_reset();
    return (string) $this->request(Request::create($path))->getContent();
  }

}
