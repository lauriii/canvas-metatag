<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas_metatag\Controller\ApiController;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Config\Entity\ConfigEntityStorageInterface;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\node\NodeInterface;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\AutoSaveRequestTestTrait;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\ConfigTestTrait;
use Drupal\Tests\node\Traits\ContentTypeCreationTrait;
use Drupal\Tests\node\Traits\NodeCreationTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

// cspell:ignore خواهم
/**
 * Pins how type-level settings ride the content template's Canvas draft.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(ApiController::class)]
#[CoversClass(Resolver::class)]
#[Group('canvas_metatag')]
final class TemplateDraftTest extends CanvasKernelTestBase {

  use RequestTrait;
  use AutoSaveRequestTestTrait;
  use ConfigTestTrait;
  use ContentTypeCreationTrait;
  use GenerateComponentConfigTrait;
  use NodeCreationTrait;
  use UserCreationTrait;

  private const EDITOR = '0b6c7f0e-6c1f-4a53-9f0b-1c2f3d4e5a6b';
  private const OTHER = '9d2e4c1a-3b5f-4e7a-8c6d-0f1a2b3c4d5e';
  private const HEADING = '11111111-1111-4111-8111-111111111111';
  private const ID = 'node.article.full';
  private const KEY = 'content_template:node.article.full';
  private const VALUES = [
    'schema' => [
      'props' => [
        'author_name' => [
          'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
        ],
      ],
      'type' => 'BlogPosting',
    ],
    'title_end' => ['text' => 'Blog'],
  ];

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
   * The article the template is previewed with.
   */
  private NodeInterface $node;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('media');
    $this->installEntitySchema('node');
    $this->installEntitySchema('path_alias');
    $this->installConfig(['node', 'filter', 'canvas_metatag']);
    $this->createContentType(['type' => 'article', 'name' => 'Article']);
    FieldStorageConfig::create(['field_name' => 'field_byline', 'entity_type' => 'node', 'type' => 'string'])->save();
    FieldConfig::create([
      'field_name' => 'field_byline',
      'entity_type' => 'node',
      'bundle' => 'article',
      'label' => 'Byline',
    ])->save();
    $this->generateComponentConfig();
    $this->setUpCurrentUser(permissions: [
      ContentTemplate::ADMIN_PERMISSION,
      AutoSaveManager::PUBLISH_PERMISSION,
      'access content',
      'edit any article content',
      'edit canvas metatag',
    ]);
    $this->node = $this->createNode(['type' => 'article', 'title' => 'Hello', 'field_byline' => 'Ada Writer']);

    $heading = Component::load('sdc.canvas_test_sdc.heading');
    self::assertInstanceOf(Component::class, $heading);
    // Not enabled yet: this is a template that was never published.
    ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => 'article',
      'content_entity_type_view_mode' => 'full',
      'component_tree' => [
        [
          'uuid' => self::HEADING,
          'component_id' => 'sdc.canvas_test_sdc.heading',
          'component_version' => $heading->getActiveVersion(),
          'inputs' => ['text' => 'Hello', 'element' => 'h1'],
        ],
      ],
      'status' => FALSE,
    ])->save();
  }

  /**
   * Our write lands in the template draft and the editor's saves carry it.
   */
  public function testWriteThenEditorSaves(): void {
    $layout = $this->getLayout();
    self::assertSame([self::KEY], array_keys($layout['autoSaves']));

    // A field of the bundle may be linked here; one the menu does not offer
    // is refused.
    $response = $this->put([
      'title' => [
        'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_nope␞␟value', 'sourceType' => 'entity-field'],
      ],
    ], self::EDITOR);
    self::assertSame(Response::HTTP_UNPROCESSABLE_ENTITY, $response->getStatusCode());
    self::assertSame(['title'], array_keys(self::decodeResponse($response)['error']['fields']));
    self::assertNull($this->draft());

    $response = $this->put(array_reverse(self::VALUES, TRUE), self::EDITOR, $layout['autoSaves']);
    self::assertSame(Response::HTTP_OK, $response->getStatusCode());
    self::assertSame(['values' => self::VALUES], json_decode((string) $response->getContent(), TRUE));
    self::assertSame(self::VALUES, $this->draft()?->getThirdPartySetting('canvas_metatag', 'values'));
    self::assertSame(self::EDITOR, $this->autoSave()->getAutoSaveEntity($this->template(), TRUE)->clientId);
    // The stored template is never saved by us.
    self::assertSame([], $this->template()->getThirdPartySettings('canvas_metatag'));

    // The editor's whole-tree save, with the hash it had before our write.
    self::assertSame(Response::HTTP_OK, $this->request($this->layoutRequest('POST', [
      'layout' => $layout['layout'],
      'model' => $layout['model'],
    ], $layout['autoSaves'], self::EDITOR))->getStatusCode());
    self::assertSame(self::VALUES, $this->draft()?->getThirdPartySetting('canvas_metatag', 'values'));

    // The editor's single-component save.
    $model = $layout['model'][self::HEADING];
    $model['resolved']['text'] = 'Changed';
    $patch = [
      'componentInstanceUuid' => self::HEADING,
      'componentType' => 'sdc.canvas_test_sdc.heading@' . $this->template()->getComponentTree()->get(0)?->getComponentVersion(),
      'model' => $model,
    ];
    self::assertSame(Response::HTTP_OK, $this->request($this->layoutRequest('PATCH', $patch, $layout['autoSaves'], self::EDITOR))->getStatusCode());
    $draft = $this->draft();
    self::assertSame(self::VALUES, $draft?->getThirdPartySetting('canvas_metatag', 'values'));
    self::assertStringContainsString('Changed', (string) json_encode($draft->getComponentTree()->getValue()));

    // Another client is in conflict, as for any draft.
    $this->assertRequestAutoSaveConflict($this->layoutRequest('PATCH', $patch, $layout['autoSaves'], self::OTHER));
    $response = $this->put(['title' => ['text' => 'Mine']], self::OTHER, $layout['autoSaves']);
    self::assertSame(Response::HTTP_CONFLICT, $response->getStatusCode());
    self::assertSame('conflict', self::decodeResponse($response)['error']['code']);
    self::assertSame(self::VALUES, $this->draft()?->getThirdPartySetting('canvas_metatag', 'values'));

    // Clearing every override removes the setting from the draft; the layout
    // change keeps the draft alive.
    self::assertSame('{"values":{}}', $this->put([], self::EDITOR)->getContent());
    self::assertSame([], $this->draft()?->getThirdPartySettings('canvas_metatag'));
  }

  /**
   * Publish stores the setting with the template; the config stays valid.
   */
  public function testPublish(): void {
    // A joined emoji, a non-joiner and a direction mark: core's `label` and
    // `text` config types refuse these, and a Canvas publish is all or
    // nothing. Our keys are plain strings.
    $values = [
      'description' => ['text' => "می\u{200C}خواهم \u{200F}{field.field_byline}"],
      'robots' => ['max_snippet' => -1, 'noindex' => FALSE],
      'schema' => [
        'custom' => '{"@type":"Thing","name":"👨‍👩"}',
        'props' => [
          'author_name' => [
            'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
          ],
        ],
        'type' => 'BlogPosting',
      ],
      'social' => ['image' => ['fact' => 'image']],
      'title' => ['text' => "Team 👨\u{200D}👩"],
      'title_end' => ['text' => ''],
    ];
    self::assertSame(Response::HTTP_OK, $this->put($values, self::EDITOR)->getStatusCode());
    $response = $this->makePublishAllRequest();
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());

    self::assertNull($this->draft());
    $template = $this->template();
    // The config system stores the keys in schema order; ours is canonical.
    self::assertSame($values, $this->stored($template));
    // Publishing enables the template, which is also what makes a node owned.
    self::assertTrue($template->status());
    self::assertContains('canvas_metatag', $template->getDependencies()['module']);
    self::assertEntityIsValid($template);
    $raw = $this->config('canvas.content_template.' . self::ID)->getRawData();
    self::assertEquals(['values' => $values], $raw['third_party_settings']['canvas_metatag']);
    self::assertSame(-1, $raw['third_party_settings']['canvas_metatag']['values']['robots']['max_snippet']);

    // A change, then the stored value back: Canvas deletes the draft.
    self::assertSame(Response::HTTP_OK, $this->put(['title' => ['text' => 'Other']], self::EDITOR)->getStatusCode());
    self::assertNotNull($this->draft());
    self::assertSame(Response::HTTP_OK, $this->put(array_reverse($values, TRUE), self::EDITOR)->getStatusCode());
    self::assertNull($this->draft());

    // Export, lose the setting, import: it is back.
    $this->copyConfig($this->container->get('config.storage'), $this->container->get('config.storage.sync'));
    $template->unsetThirdPartySetting('canvas_metatag', 'values')->save();
    self::assertNotContains('canvas_metatag', $this->template()->getDependencies()['module'] ?? []);
    $this->configImporter()->import();
    self::assertSame($values, $this->stored($this->template()));
    self::assertEntityIsValid($this->template());
  }

  /**
   * Only the full template of a node type has SEO settings.
   */
  public function testOtherTemplates(): void {
    ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => 'article',
      'content_entity_type_view_mode' => 'teaser',
      'component_tree' => [],
      'status' => FALSE,
    ])->save();
    $teaser = ContentTemplate::load('node.article.teaser');
    self::assertInstanceOf(ContentTemplate::class, $teaser);
    $response = $this->put(self::VALUES, self::EDITOR, template: $teaser);
    self::assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    self::assertSame('not_found', self::decodeResponse($response)['error']['code']);
    self::assertTrue($this->autoSave()->getAutoSaveEntity($teaser, TRUE)->isEmpty());

    $response = $this->request(Request::create('/canvas-metatag/api/draft/content_template/' . self::ID, 'PUT', content: (string) json_encode([
      'values' => self::VALUES,
      'auto_saves' => [],
    ])));
    self::assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());
    self::assertNull($this->draft());
  }

  /**
   * The Canvas auto-save manager of the current container.
   */
  private function autoSave(): AutoSaveManager {
    return $this->container->get(AutoSaveManager::class);
  }

  /**
   * The stored template, without configuration overrides.
   */
  private function template(): ContentTemplate {
    $storage = $this->container->get('entity_type.manager')->getStorage(ContentTemplate::ENTITY_TYPE_ID);
    \assert($storage instanceof ConfigEntityStorageInterface);
    $template = $storage->loadOverrideFree(self::ID);
    \assert($template instanceof ContentTemplate);
    return $template;
  }

  /**
   * The setting of a stored template, read the way the resolver reads it.
   */
  private function stored(ContentTemplate $template): array {
    return Values::clean($template->getThirdPartySetting('canvas_metatag', 'values', []), 'template', NULL)[0];
  }

  /**
   * The template's draft entity, read from the store.
   */
  private function draft(): ?ContentTemplate {
    $entity = $this->autoSave()->getAutoSaveEntity($this->template(), TRUE)->entity;
    \assert($entity === NULL || $entity instanceof ContentTemplate);
    return $entity;
  }

  /**
   * Sends our draft write.
   *
   * @param array $values
   *   The whole values object.
   * @param string $client
   *   The client instance id.
   * @param array|null $auto_saves
   *   The editor's auto-save map; by default what the server holds right now.
   * @param \Drupal\canvas\Entity\ContentTemplate|null $template
   *   The template to write to; by default the article's full template.
   */
  private function put(array $values, string $client, ?array $auto_saves = NULL, ?ContentTemplate $template = NULL): Response {
    $template ??= $this->template();
    return $this->request(Request::create('/canvas-metatag/api/draft/content_template/' . $template->id(), 'PUT', content: (string) json_encode([
      'values' => (object) $values,
      'client_instance_id' => $client,
      'auto_saves' => $auto_saves ?? [AutoSaveManager::getAutoSaveKey($template) => $this->autoSave()->getClientAutoSaveData($template)],
    ])));
  }

  /**
   * The editor's template layout GET, with the article as the preview entity.
   */
  private function getLayout(): array {
    return self::decodeResponse($this->request(Request::create($this->layoutUrl())));
  }

  /**
   * An editor save of the template: a whole-tree POST or a component PATCH.
   */
  private function layoutRequest(string $method, array $body, array $auto_saves, string $client): Request {
    $request = Request::create($this->layoutUrl(), $method, content: (string) json_encode($body + [
      'autoSaves' => $auto_saves,
      'clientInstanceId' => $client,
    ]));
    $request->headers->set('Content-Type', 'application/json');
    return $request;
  }

  /**
   * The template layout route, with the article as the preview entity.
   */
  private function layoutUrl(): string {
    return '/canvas/api/v0/layout-content-template/' . self::ID . '/' . $this->node->id();
  }

}
