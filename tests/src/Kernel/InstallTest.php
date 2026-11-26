<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_headless\Controller\CanvasContentController;
use Drupal\canvas_metatag\Controller\HeadlessContentController;
use Drupal\canvas_metatag\PageText;
use Drupal\canvas_metatag\ShareStore;
use Drupal\Core\Extension\Exception\UnknownExtensionException;
use Drupal\Core\Extension\MissingDependencyException;
use Drupal\Core\Extension\ModuleExtensionList;
use Drupal\Core\Extension\ModuleInstallerInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\node\Traits\ContentTypeCreationTrait;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Tests installing, uninstalling and reinstalling the module.
 *
 * The module is not in the module list: every test installs it the way a
 * site does, through the module installer.
 */
#[RunTestsInSeparateProcesses]
#[Group('canvas_metatag')]
final class InstallTest extends CanvasKernelTestBase {

  use ContentTypeCreationTrait;
  use GenerateComponentConfigTrait;

  private const EDITOR = '0b6c7f0e-6c1f-4a53-9f0b-1c2f3d4e5a6b';
  private const HEADING = '11111111-1111-4111-8111-111111111111';
  private const VALUES = ['robots' => ['noindex' => TRUE], 'title_end' => ['text' => 'Blog']];
  private const ENCODED = '{"robots":{"noindex":true},"title_end":{"text":"Blog"}}';

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    // Uninstalling a module deletes its user data.
    $this->installSchema('user', ['users_data']);
    $this->installEntitySchema('media');
    $this->installEntitySchema('node');
    $this->installEntitySchema('path_alias');
    $this->installEntitySchema(Page::ENTITY_TYPE_ID);
    $this->installConfig(['node', 'filter']);
    $this->generateComponentConfig();
  }

  /**
   * Installing adds the field and the site settings and nothing else.
   */
  public function testInstall(): void {
    // A site with pages and pending drafts.
    $page = $this->createPage();
    $with_draft = $this->createPage();
    $draft = clone $with_draft;
    $draft->set('title', 'Draft title');
    $this->autoSave()->saveEntity($draft, self::EDITOR);
    $hash = $this->autoSave()->getAutoSaveEntity($with_draft, TRUE)->hash;

    // Core does not clear render caches when a module is installed; our hook
    // does, so that a page cached before install cannot keep core's canonical
    // next to ours.
    $rendered = $this->renderedInvalidations();
    $this->install(['syslog']);
    self::assertSame($rendered, $this->renderedInvalidations());
    $this->install(['canvas_metatag']);
    self::assertGreaterThan($rendered, $this->renderedInvalidations());
    self::assertSame([], $this->container->get('messenger')->all());

    // The field: installed by core, nothing left to update.
    $this->assertNoPendingPageUpdates();
    $schema = $this->container->get('database')->schema();
    self::assertTrue($schema->fieldExists('canvas_page_field_data', 'canvas_metatag'));
    self::assertTrue($schema->fieldExists('canvas_page_field_revision', 'canvas_metatag'));
    $definition = $this->container->get('entity_field.manager')->getBaseFieldDefinitions(Page::ENTITY_TYPE_ID)['canvas_metatag'];
    self::assertInstanceOf(BaseFieldDefinition::class, $definition);
    self::assertSame('string_long', $definition->getType());
    self::assertTrue($definition->isRevisionable());
    self::assertTrue($definition->isTranslatable());
    self::assertNull($definition->getDisplayOptions('form'));
    self::assertNull($definition->getDisplayOptions('view'));
    self::assertSame([], $definition->getDefaultValueLiteral());

    // Existing pages gain no value and no draft; an existing draft is intact.
    $storage = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID);
    $stored = $storage->loadUnchanged($page->id());
    self::assertInstanceOf(Page::class, $stored);
    self::assertTrue($stored->get('canvas_metatag')->isEmpty());
    $this->autoSave()->saveEntity(clone $stored, self::EDITOR);
    self::assertTrue($this->autoSave()->getAutoSaveEntity($stored, TRUE)->isEmpty());
    $entry = $this->autoSave()->getAutoSaveEntity($with_draft, TRUE);
    self::assertSame($hash, $entry->hash);
    self::assertInstanceOf(Page::class, $entry->entity);
    self::assertSame('Draft title', $entry->entity->label());
    self::assertTrue($entry->entity->get('canvas_metatag')->isEmpty());

    // The site settings are the shipped bottom layer and are valid.
    $site = $this->config('canvas_metatag.site')->getRawData();
    unset($site['_core']);
    self::assertSame([
      'langcode' => 'en',
      'identity' => [
        'kind' => 'organization',
        'name' => '',
        'separator' => '|',
        'logo' => '',
        'default_image' => '',
        'colour' => '',
        'share_fallback' => 'card',
        'same_as' => [],
      ],
      // No ending: every title ends with the site name.
      'values' => ['robots' => ['max_image_preview' => 'large']],
    ], $site);
    $typed = $this->container->get('config.typed')->createFromNameAndData('canvas_metatag.site', $this->config('canvas_metatag.site')->getRawData());
    self::assertCount(0, $typed->validate());

    $permissions = $this->container->get('user.permissions')->getPermissions();
    self::assertSame('canvas_metatag', $permissions['edit canvas metatag']['provider']);
    self::assertTrue($permissions['administer canvas metatag']['restrict access']);
    self::assertArrayNotHasKey('restrict access', array_filter($permissions['edit canvas metatag']));
  }

  /**
   * The headless decorator exists only next to the controller it decorates.
   */
  public function testContainerBuildsWithoutHeadless(): void {
    $this->install(['canvas_metatag']);
    $services = $this->container->getServiceIds();
    self::assertNotContains(HeadlessContentController::class, $services);
    self::assertNotContains(CanvasContentController::class, $services);
    $routes = $this->container->get('router.route_provider');
    self::assertSame('/canvas-metatag/api/draft/canvas_page/{canvas_page}', $routes->getRouteByName('canvas_metatag.api.page')->getPath());

    try {
      $this->install(['canvas_headless']);
    }
    catch (MissingDependencyException | UnknownExtensionException) {
      self::markTestIncomplete('canvas_headless or one of its dependencies is not in the codebase: the container was only built without it.');
    }
    self::assertInstanceOf(HeadlessContentController::class, $this->container->get(CanvasContentController::class));
  }

  /**
   * Uninstalling keeps drafts usable; reinstalling starts clean.
   */
  public function testUninstallAndReinstall(): void {
    $this->install(['canvas_metatag']);
    $this->createContentType(['type' => 'article']);
    $this->createContentType(['type' => 'event']);
    $this->createContentType(['type' => 'product']);
    $this->createContentType(['type' => 'person']);

    // A page with a stored value and a draft that carries another.
    $page = $this->createPage(['canvas_metatag' => self::ENCODED]);
    $draft = clone $page;
    $draft->set('canvas_metatag', '{"title":{"text":"Draft"}}');
    $this->autoSave()->saveEntity($draft, self::EDITOR);

    // Stored setting, and a draft with layout work and a changed setting.
    $both = $this->createTemplate('article', self::VALUES);
    $this->saveTemplateDraft($both, ['title_end' => ['text' => 'Draft']]);
    // No stored setting; a draft with layout work and a setting.
    $draft_only = $this->createTemplate('event');
    $this->saveTemplateDraft($draft_only, self::VALUES);
    // Stored setting, no draft.
    $stored_only = $this->createTemplate('product', self::VALUES);
    // Nothing of ours; a draft with layout work.
    $neither = $this->createTemplate('person');
    $this->saveTemplateDraft($neither);
    $untouched = $this->autoSave()->getAutoSaveEntity($neither, TRUE)->hash;
    self::assertContains('canvas_metatag', $both->getDependencies()['module']);

    // A stored share image and the page text index.
    mkdir(ShareStore::dir() . '/en/canvas_page/1', 0777, TRUE);
    file_put_contents(ShareStore::dir() . '/en/canvas_page/1/0123456789abcdef.png', 'png');
    $this->container->get('keyvalue')->get(PageText::COLLECTION . 'en')->set('text', [1]);

    $this->container->get(ModuleInstallerInterface::class)->uninstall(['canvas_metatag']);

    // Nothing stays reachable in the public files, and the index is gone.
    self::assertDirectoryDoesNotExist(ShareStore::ROOT);
    self::assertSame([], $this->container->get('keyvalue')->get(PageText::COLLECTION . 'en')->getAll());
    foreach ([$both, $draft_only, $stored_only, $neither] as $template) {
      $raw = $this->config('canvas.content_template.' . $template->id())->getRawData();
      self::assertArrayNotHasKey('canvas_metatag', $raw['third_party_settings'] ?? [], $template->id());
      self::assertNotContains('canvas_metatag', $raw['dependencies']['module'] ?? [], $template->id());
    }
    // Unpublished layout work survives, without a setting that a later
    // publish would store for a module that is gone.
    foreach ([$both, $draft_only, $neither] as $template) {
      $entry = $this->autoSave()->getAutoSaveEntity($template, TRUE);
      self::assertInstanceOf(ContentTemplate::class, $entry->entity, $template->id());
      self::assertSame(self::EDITOR, $entry->clientId, $template->id());
      self::assertSame([], $entry->entity->getThirdPartySettings('canvas_metatag'), $template->id());
      self::assertSame([self::HEADING], array_column($entry->entity->getComponentTree()->getValue(), 'uuid'), $template->id());
    }
    self::assertTrue($this->autoSave()->getAutoSaveEntity($stored_only, TRUE)->isEmpty());
    self::assertSame($untouched, $this->autoSave()->getAutoSaveEntity($neither, TRUE)->hash);

    // The column and the site settings are gone; the page and its draft,
    // which still carries the key, load.
    self::assertFalse($this->container->get('database')->schema()->fieldExists('canvas_page_field_data', 'canvas_metatag'));
    self::assertTrue($this->config('canvas_metatag.site')->isNew());
    $storage = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID);
    $stored = $storage->loadUnchanged($page->id());
    self::assertInstanceOf(Page::class, $stored);
    self::assertFalse($stored->hasField('canvas_metatag'));
    self::assertSame('Pricing', $this->autoSave()->getAutoSaveEntity($stored, TRUE)->entity?->label());

    $this->install(['canvas_metatag']);
    $this->assertNoPendingPageUpdates();
    $storage = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID);
    $stored = $storage->loadUnchanged($page->id());
    self::assertInstanceOf(Page::class, $stored);
    self::assertTrue($stored->get('canvas_metatag')->isEmpty());
    // The draft lost the value too: the next publish cannot bring it back.
    $draft = $this->autoSave()->getAutoSaveEntity($stored, TRUE)->entity;
    self::assertInstanceOf(Page::class, $draft);
    self::assertTrue($draft->get('canvas_metatag')->isEmpty());
    self::assertSame('|', $this->config('canvas_metatag.site')->get('identity.separator'));
  }

  /**
   * The message for the person who enables the module next to metatag.
   */
  public function testInstallMessageWithMetatag(): void {
    if (!$this->container->get(ModuleExtensionList::class)->exists('metatag')) {
      self::markTestSkipped('The metatag module is not in the codebase.');
    }
    $this->install(['metatag']);
    $this->install(['canvas_metatag']);
    self::assertSame(
      ['SEO now provides the head tags for Canvas pages and for content shown through a Canvas content template. Values from the Metatag module are no longer used there.'],
      array_map(strval(...), $this->container->get('messenger')->messagesByType('status')),
    );
    $this->assertNoPendingPageUpdates();
  }

  /**
   * Asserts that core has nothing left to update on the page entity type.
   *
   * The change list of a kernel test also names every entity type the test
   * never installed, so only the page's entry is looked at.
   */
  private function assertNoPendingPageUpdates(): void {
    $changes = $this->container->get('entity.definition_update_manager')->getChangeList();
    self::assertArrayNotHasKey(Page::ENTITY_TYPE_ID, $changes);
  }

  /**
   * Installs modules the way a site does.
   */
  private function install(array $modules): void {
    $this->container->get(ModuleInstallerInterface::class)->install($modules);
  }

  /**
   * The Canvas auto-save manager of the current container.
   */
  private function autoSave(): AutoSaveManager {
    return $this->container->get(AutoSaveManager::class);
  }

  /**
   * How often the `rendered` cache tag was invalidated.
   */
  private function renderedInvalidations(): int {
    $this->container->get('cache_tags.invalidator.checksum')->reset();
    return (int) $this->container->get('cache_tags.invalidator.checksum')->getCurrentChecksum(['rendered']);
  }

  /**
   * Creates and saves a published page.
   */
  private function createPage(array $values = []): Page {
    $page = Page::create($values + ['title' => 'Pricing', 'status' => TRUE, 'components' => []]);
    $page->save();
    return $page;
  }

  /**
   * Creates the enabled full template of a node type.
   */
  private function createTemplate(string $bundle, array $values = []): ContentTemplate {
    $template = ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => $bundle,
      'content_entity_type_view_mode' => 'full',
      'component_tree' => [],
      'status' => TRUE,
    ]);
    if ($values) {
      $template->setThirdPartySetting('canvas_metatag', 'values', $values);
    }
    $template->save();
    return $template;
  }

  /**
   * Auto-saves layout work on a template, optionally with a setting of ours.
   */
  private function saveTemplateDraft(ContentTemplate $template, array $values = []): void {
    $heading = Component::load('sdc.canvas_test_sdc.heading');
    self::assertInstanceOf(Component::class, $heading);
    $draft = ContentTemplate::create($template->toArray());
    $draft->enforceIsNew(FALSE);
    $draft->set('component_tree', [
      [
        'uuid' => self::HEADING,
        'component_id' => 'sdc.canvas_test_sdc.heading',
        'component_version' => $heading->getActiveVersion(),
        'inputs' => ['text' => 'Hello', 'element' => 'h1'],
      ],
    ]);
    if ($values) {
      $draft->setThirdPartySetting('canvas_metatag', 'values', $values);
    }
    $this->autoSave()->saveEntity($draft, self::EDITOR);
  }

}
