<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Controller\ApiController;
use Drupal\canvas_metatag\Hook\CanvasMetatagHooks;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Entity\RevisionableStorageInterface;
use Drupal\Core\Extension\ModuleInstallerInterface;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\AutoSaveRequestTestTrait;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

// cspell:ignore Tarifs Precios Escritorio
/**
 * Pins how the per-page field rides the page's Canvas draft.
 *
 * Every statement here is one the design depends on and Canvas could change:
 * the field is carried by editor saves, our write follows Canvas's own
 * conflict rule, and publish stores the value like any other field.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(ApiController::class)]
#[CoversClass(CanvasMetatagHooks::class)]
#[Group('canvas_metatag')]
final class PageDraftTest extends CanvasKernelTestBase {

  use RequestTrait;
  use AutoSaveRequestTestTrait;
  use ContentTranslationTestTrait;
  use GenerateComponentConfigTrait;
  use UserCreationTrait;

  private const EDITOR = '0b6c7f0e-6c1f-4a53-9f0b-1c2f3d4e5a6b';
  private const OTHER = '9d2e4c1a-3b5f-4e7a-8c6d-0f1a2b3c4d5e';
  private const VALUES = ['robots' => ['noindex' => TRUE], 'title' => 'Plans {sep} {site}'];
  private const ENCODED = '{"robots":{"noindex":true},"title":"Plans {sep} {site}"}';

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'language',
    'content_translation',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('path_alias');
    $this->installConfig(['language', 'canvas_metatag']);
    ConfigurableLanguage::createFromLangcode('fr')->save();
    $this->installEntitySchema(Page::ENTITY_TYPE_ID);
    $this->enableContentTranslation(Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID);
    $this->generateComponentConfig();
    $this->setUpCurrentUser(permissions: [
      Page::CREATE_PERMISSION,
      Page::EDIT_PERMISSION,
      AutoSaveManager::PUBLISH_PERMISSION,
      'edit canvas metatag',
    ]);
  }

  /**
   * An editor round trip with no change creates no draft.
   *
   * The field has no display options, so it never takes part in the page
   * form, with or without a stored value.
   */
  public function testUnchangedLayoutRoundTripCreatesNoDraft(): void {
    foreach ([NULL, self::ENCODED] as $stored) {
      $page = $this->createPage(['canvas_metatag' => $stored]);
      $layout = $this->getLayout($page);
      self::assertSame([], array_filter(array_keys($layout['entity_form_fields']), static fn (string $name): bool => str_contains($name, 'canvas_metatag')));
      self::assertSame(Response::HTTP_OK, $this->postLayout($page, $layout, self::EDITOR)->getStatusCode());
      self::assertNull($this->draft($page));
    }
  }

  /**
   * The same with contrib metatag installed and its widget hidden.
   *
   * Canvas gives its pages a field of the Metatag module, whose widget would
   * join the page form; the form alter takes it out.
   */
  public function testUnchangedLayoutRoundTripWithMetatag(): void {
    if (!$this->container->get('extension.list.module')->exists('metatag')) {
      self::markTestSkipped('The metatag module is not in the codebase.');
    }
    $this->container->get(ModuleInstallerInterface::class)->install(['metatag']);
    foreach ([NULL, self::ENCODED] as $stored) {
      $page = $this->createPage(['canvas_metatag' => $stored]);
      $layout = $this->getLayout($page);
      self::assertSame([], array_filter(array_keys($layout['entity_form_fields']), static fn (string $name): bool => str_starts_with($name, 'metatags')));
      self::assertSame(Response::HTTP_OK, $this->postLayout($page, $layout, self::EDITOR)->getStatusCode());
      self::assertNull($this->draft($page));
    }
    // A write of ours still lands, and the editor carries it.
    $page = $this->createPage();
    $layout = $this->getLayout($page);
    self::assertSame(Response::HTTP_OK, $this->put($page, ['title' => 'Other'], self::EDITOR)->getStatusCode());
    $layout['entity_form_fields']['title[0][value]'] = 'Renamed';
    self::assertSame(Response::HTTP_OK, $this->postLayout($page, $layout, self::EDITOR)->getStatusCode());
    $draft = $this->draft($page);
    self::assertSame('{"title":"Other"}', $draft?->get('canvas_metatag')->value);
    self::assertSame('Renamed', $draft->label());
  }

  /**
   * Our write under the editor's id; the editor's next save carries it.
   */
  public function testWriteThenEditorSave(): void {
    $page = $this->createPage();
    // What the editor holds: no draft yet, so a NULL hash.
    $layout = $this->getLayout($page);
    $key = AutoSaveManager::getAutoSaveKey($page);
    self::assertSame("canvas_page:{$page->id()}:en", $key);
    self::assertNull($layout['autoSaves'][$key]['hash']);

    // Sent in another order, to prove the response order is canonical.
    $response = $this->put($page, ['title' => 'Plans {sep} {site}', 'robots' => ['noindex' => TRUE]], self::EDITOR, $layout['autoSaves']);
    self::assertSame(Response::HTTP_OK, $response->getStatusCode());
    self::assertSame('{"values":' . self::ENCODED . '}', $response->getContent());

    $entry = $this->autoSave()->getAutoSaveEntity($page, TRUE);
    self::assertSame(self::EDITOR, $entry->clientId);
    self::assertSame(self::ENCODED, $this->draft($page)?->get('canvas_metatag')->value);
    // The stored entity is never saved by us.
    $stored = $this->stored($page);
    self::assertTrue($stored->get('canvas_metatag')->isEmpty());
    self::assertSame($page->getRevisionId(), $stored->getRevisionId());

    // The editor saves with the hash it had before our write: the matching
    // client id lets it through, and the field it never posts is kept.
    $layout['entity_form_fields']['title[0][value]'] = 'Pricing, renamed';
    self::assertSame(Response::HTTP_OK, $this->postLayout($page, $layout, self::EDITOR)->getStatusCode());
    $draft = $this->draft($page);
    self::assertSame('Pricing, renamed', $draft?->label());
    self::assertSame(self::ENCODED, $draft->get('canvas_metatag')->value);
  }

  /**
   * After a write under any other id the editor is in conflict.
   *
   * This is why there is no write path without the editor's id.
   */
  public function testWriteUnderAnotherIdConflictsTheEditor(): void {
    $page = $this->createPage();
    $layout = $this->getLayout($page);
    self::assertSame(Response::HTTP_OK, $this->put($page, self::VALUES, self::OTHER)->getStatusCode());
    $layout['entity_form_fields']['title[0][value]'] = 'Pricing, renamed';
    $this->assertRequestAutoSaveConflict($this->layoutRequest($page, $layout, self::EDITOR));
    self::assertSame('Pricing', $this->draft($page)?->label());
  }

  /**
   * Canvas's conflict rule applies to our write as to the editor's.
   */
  public function testConflictRule(): void {
    $page = $this->createPage();
    $key = AutoSaveManager::getAutoSaveKey($page);
    $stale = $this->getLayout($page)['autoSaves'];
    self::assertSame(Response::HTTP_OK, $this->put($page, self::VALUES, self::EDITOR)->getStatusCode());

    // Another client with the hash from before the draft existed.
    $response = $this->put($page, ['title' => 'Mine'], self::OTHER, $stale);
    self::assertSame(Response::HTTP_CONFLICT, $response->getStatusCode());
    self::assertSame('conflict', self::decodeResponse($response)['error']['code']);
    self::assertArrayNotHasKey('fields', self::decodeResponse($response)['error']);
    // Another client that sends no entry for this page at all.
    self::assertSame(Response::HTTP_CONFLICT, $this->put($page, ['title' => 'Mine'], self::OTHER, ['canvas_page:999:en' => $stale[$key]])->getStatusCode());
    // The same client is held to the starting point.
    $moved = [$key => ['autoSaveStartingPoint' => '0-0', 'hash' => NULL]];
    self::assertSame(Response::HTTP_CONFLICT, $this->put($page, ['title' => 'Mine'], self::EDITOR, $moved)->getStatusCode());
    $entry = $this->autoSave()->getAutoSaveEntity($page, TRUE);
    self::assertSame(self::EDITOR, $entry->clientId);
    self::assertSame(self::ENCODED, $this->draft($page)?->get('canvas_metatag')->value);

    // Another client that read the current draft (a reloaded editor) may
    // write. Canvas compares the entry by strict array identity, so it only
    // passes with its keys in the order the editor sends them: the controller
    // must hand the entry through as it came.
    $current = $this->getLayout($page)['autoSaves'];
    self::assertSame(['autoSaveStartingPoint', 'hash'], array_keys($current[$key]));
    self::assertIsString($current[$key]['hash']);
    self::assertSame(Response::HTTP_CONFLICT, $this->put($page, ['title' => 'Mine'], self::OTHER, [$key => array_reverse($current[$key], TRUE)])->getStatusCode());
    self::assertSame(Response::HTTP_OK, $this->put($page, ['title' => 'Mine'], self::OTHER, $current)->getStatusCode());
    $entry = $this->autoSave()->getAutoSaveEntity($page, TRUE);
    self::assertSame(self::OTHER, $entry->clientId);
    self::assertSame('{"title":"Mine"}', $this->draft($page)?->get('canvas_metatag')->value);
  }

  /**
   * Saving the stored page conflicts the open editor: why we never save.
   */
  public function testDirectSaveConflictsTheEditor(): void {
    $page = $this->createPage();
    $layout = $this->getLayout($page);
    $stored = $this->stored($page);
    $stored->set('canvas_metatag', self::ENCODED);
    $stored->setNewRevision(TRUE);
    $stored->save();
    $layout['entity_form_fields']['title[0][value]'] = 'Pricing, renamed';
    $this->assertRequestAutoSaveConflict($this->layoutRequest($page, $layout, self::EDITOR));
  }

  /**
   * Writing the stored value back deletes the draft: reset needs no code.
   */
  public function testWritingTheStoredValueBackDeletesTheDraft(): void {
    $page = $this->createPage();
    self::assertSame(Response::HTTP_OK, $this->put($page, self::VALUES, self::EDITOR)->getStatusCode());
    self::assertNotNull($this->draft($page));
    $response = $this->put($page, [], self::EDITOR);
    self::assertSame('{"values":{}}', $response->getContent());
    self::assertNull($this->draft($page));

    $page = $this->createPage(['canvas_metatag' => self::ENCODED]);
    self::assertSame(Response::HTTP_OK, $this->put($page, ['title' => 'Other'], self::EDITOR)->getStatusCode());
    self::assertNotNull($this->draft($page));
    // Key order does not matter: the encoding is canonical.
    self::assertSame(Response::HTTP_OK, $this->put($page, array_reverse(self::VALUES, TRUE), self::EDITOR)->getStatusCode());
    self::assertNull($this->draft($page));
    self::assertSame(self::ENCODED, $this->stored($page)->get('canvas_metatag')->value);
  }

  /**
   * Publish stores the value in a new revision, for any publisher.
   */
  public function testPublish(): void {
    $page = $this->createPage(['canvas_metatag' => '{"title":"Before"}']);
    $revision = $page->getRevisionId();
    self::assertSame(Response::HTTP_OK, $this->put($page, self::VALUES, self::EDITOR)->getStatusCode());

    // The field has no access restriction: a publisher who may not use the
    // SEO dialog can still publish a page whose SEO value changed.
    $this->setUpCurrentUser(permissions: [Page::EDIT_PERMISSION, AutoSaveManager::PUBLISH_PERMISSION]);
    $response = $this->makePublishAllRequest();
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());

    self::assertNull($this->draft($page));
    $stored = $this->stored($page);
    self::assertGreaterThan($revision, $stored->getRevisionId());
    self::assertSame(self::ENCODED, $stored->get('canvas_metatag')->value);
    $storage = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID);
    self::assertInstanceOf(RevisionableStorageInterface::class, $storage);
    $previous = $storage->loadRevision($revision);
    self::assertInstanceOf(Page::class, $previous);
    self::assertSame('{"title":"Before"}', $previous->get('canvas_metatag')->value);
  }

  /**
   * Each translation has its own value, draft and auto-save key.
   */
  public function testTranslations(): void {
    $page = $this->createPage(['canvas_metatag' => '{"canonical":"/pricing","robots":{"noindex":true},"title":"English"}']);
    self::assertTrue($page->getFieldDefinition('canvas_metatag')?->isTranslatable());

    // Core copies every translatable field into a new translation; ours
    // starts empty.
    $translation = $page->addTranslation('fr', ['title' => 'Tarifs'] + $page->toArray());
    self::assertTrue($translation->get('canvas_metatag')->isEmpty());
    self::assertFalse($page->get('canvas_metatag')->isEmpty());
    $translation->save();

    $page = $this->stored($page);
    $french = $page->getTranslation('fr');
    $response = $this->put($french, ['title' => 'Tarifs {sep} {site}'], self::EDITOR, langcode: 'fr');
    self::assertSame(Response::HTTP_OK, $response->getStatusCode());
    self::assertNull($this->draft($page));
    $draft = $this->draft($french);
    self::assertSame('fr', $draft?->language()->getId());
    self::assertSame('{"title":"Tarifs {sep} {site}"}', $draft->get('canvas_metatag')->value);
    self::assertStringContainsString('"title":"English"', (string) $draft->getTranslation('en')->get('canvas_metatag')->value);
    self::assertTrue($this->stored($page)->getTranslation('fr')->get('canvas_metatag')->isEmpty());

    // A translation that does not exist.
    $response = $this->put($page, self::VALUES, self::EDITOR, langcode: 'de');
    self::assertSame(Response::HTTP_NOT_FOUND, $response->getStatusCode());
    self::assertSame('not_found', self::decodeResponse($response)['error']['code']);
  }

  /**
   * A translation that exists only as a Canvas draft is edited like any other.
   *
   * Canvas keeps the draft of a translation that was never published under
   * that translation's key, and adds the translation when it is published.
   */
  public function testDraftOfAnUnpublishedTranslation(): void {
    ConfigurableLanguage::createFromLangcode('es')->save();
    $page = $this->createPage(['canvas_metatag' => '{"robots":{"noindex":true},"schema":{"type":"Product"}}']);
    // What the editor stores for a Spanish version drafted in Canvas.
    $spanish = (clone $this->stored($page))->addTranslation('es', ['title' => 'Precios']);
    \assert($spanish instanceof Page);
    $this->autoSave()->saveEntity($spanish, self::EDITOR);
    self::assertFalse($this->stored($page)->hasTranslation('es'));

    $query = '/canvas-metatag/api/state?entity_type=canvas_page&id=' . $page->id() . '&langcode=es';
    $state = self::decodeResponse($this->request(Request::create($query)));
    self::assertSame('es', $state['langcode']);
    self::assertSame([
      'label' => 'Precios',
      'auto_save_key' => "canvas_page:{$page->id()}:es",
      'default_langcode' => 'en',
      'published' => FALSE,
      'has_draft' => TRUE,
      'values' => [],
      'from_default' => ['robots' => ['noindex' => TRUE], 'schema' => ['type' => 'Product']],
    ], array_diff_key($state['target'], array_flip(['scope', 'entity_type', 'id', 'translatable'])));
    self::assertSame('Precios', $state['preview']['label']);

    // The details of the inherited Product type are the translation's own.
    $values = ['schema' => ['props' => ['name' => 'Escritorio']], 'title' => 'Precios {sep} {site}'];
    $response = $this->put($spanish, $values, self::EDITOR, langcode: 'es');
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    $draft = $this->draft($spanish);
    self::assertSame('Precios', $draft?->label());
    self::assertSame(Values::encode($values), $draft->get('canvas_metatag')->value);
    self::assertFalse($this->stored($page)->hasTranslation('es'));
    self::assertSame($values, self::decodeResponse($this->request(Request::create($query)))['target']['values']);

    // Without the draft there is nothing to edit in that language, and only
    // an editor learns that a draft exists.
    $this->setUpCurrentUser(permissions: ['edit canvas metatag', 'access content']);
    self::assertSame(Response::HTTP_NOT_FOUND, $this->request(Request::create($query))->getStatusCode());
    $this->setUpCurrentUser(permissions: [Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $this->autoSave()->delete($spanish);
    self::assertSame(Response::HTTP_NOT_FOUND, $this->put($spanish, $values, self::EDITOR, langcode: 'es')->getStatusCode());
    self::assertSame(Response::HTTP_NOT_FOUND, $this->request(Request::create($query))->getStatusCode());
  }

  /**
   * A duplicated page keeps its overrides, except the canonical.
   */
  public function testDuplicate(): void {
    $page = $this->createPage(['canvas_metatag' => '{"canonical":"/pricing","robots":{"noindex":true},"title":"English"}']);
    $page->addTranslation('fr', ['title' => 'Tarifs'] + $page->toArray())
      ->set('canvas_metatag', '{"canonical":"https://www.example.com/fr/tarifs"}')
      ->save();
    $copy = $this->stored($page)->createDuplicate();
    self::assertSame('{"robots":{"noindex":true},"title":"English"}', $copy->get('canvas_metatag')->value);
    self::assertTrue($copy->getTranslation('fr')->get('canvas_metatag')->isEmpty());
    self::assertStringContainsString('canonical', (string) $this->stored($page)->get('canvas_metatag')->value);
  }

  /**
   * What the route refuses, and that a refusal writes nothing.
   */
  public function testRefusals(): void {
    $page = $this->createPage();
    $key = AutoSaveManager::getAutoSaveKey($page);
    $body = [
      'values' => self::VALUES,
      'langcode' => 'en',
      'client_instance_id' => self::EDITOR,
      'auto_saves' => [$key => $this->autoSave()->getClientAutoSaveData($page)],
    ];
    $bad = [
      'no client id' => array_diff_key($body, ['client_instance_id' => TRUE]),
      'empty client id' => ['client_instance_id' => ''] + $body,
      'client id not a string' => ['client_instance_id' => 7] + $body,
      'no auto-saves' => array_diff_key($body, ['auto_saves' => TRUE]),
      'auto-saves entry not an object' => ['auto_saves' => [$key => 'x']] + $body,
      'no values' => array_diff_key($body, ['values' => TRUE]),
      'values a list' => ['values' => ['a', 'b']] + $body,
      'no langcode' => array_diff_key($body, ['langcode' => TRUE]),
      'not an object' => 'text',
      'too large' => ['padding' => str_repeat('a', 131072)] + $body,
    ];
    foreach ($bad as $label => $content) {
      $response = $this->request(Request::create("/canvas-metatag/api/draft/canvas_page/{$page->id()}", 'PUT', content: (string) json_encode($content)));
      self::assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode(), $label);
      self::assertSame(['code', 'message'], array_keys(self::decodeResponse($response)['error']), $label);
      self::assertSame('bad_request', self::decodeResponse($response)['error']['code'], $label);
    }
    $response = $this->request(Request::create("/canvas-metatag/api/draft/canvas_page/{$page->id()}", 'PUT', content: '{"values":'));
    self::assertSame(Response::HTTP_BAD_REQUEST, $response->getStatusCode());

    $response = $this->put($page, ['title' => '{nope}', 'canonical' => 'pricing', 'description' => 'x'], self::EDITOR);
    self::assertSame(Response::HTTP_UNPROCESSABLE_ENTITY, $response->getStatusCode());
    self::assertSame([
      'error' => [
        'code' => 'invalid',
        'message' => 'Some values need attention.',
        'fields' => [
          'title' => '"{nope}" is not a value SEO knows. Choose one from the list.',
          'canonical' => 'Enter a full address that starts with https://, or a path that starts with /.',
          'description' => 'This setting is not available here.',
        ],
      ],
    ], self::decodeResponse($response));
    self::assertNull($this->draft($page));

    // Editing the page is not enough: the dialog has its own permission.
    $this->setUpCurrentUser(permissions: [Page::EDIT_PERMISSION]);
    try {
      $this->put($page, self::VALUES, self::EDITOR);
      self::fail('Expected an access denial.');
    }
    catch (AccessDeniedHttpException) {
    }
    // And the permission is not enough without update access to the page.
    $this->setUpCurrentUser(permissions: ['edit canvas metatag']);
    try {
      $this->put($page, self::VALUES, self::EDITOR);
      self::fail('Expected an access denial.');
    }
    catch (AccessDeniedHttpException) {
    }
    self::assertNull($this->draft($page));
  }

  /**
   * Creates and saves a published page.
   */
  private function createPage(array $values = []): Page {
    $page = Page::create($values + [
      'title' => 'Pricing',
      'description' => 'Plans and prices.',
      'status' => TRUE,
      'components' => [],
    ]);
    $page->save();
    return $page;
  }

  /**
   * The Canvas auto-save manager of the current container.
   */
  private function autoSave(): AutoSaveManager {
    return $this->container->get(AutoSaveManager::class);
  }

  /**
   * The draft entity of a page translation, read from the store.
   */
  private function draft(Page $page): ?Page {
    $entity = $this->autoSave()->getAutoSaveEntity($page, TRUE)->entity;
    \assert($entity === NULL || $entity instanceof Page);
    return $entity;
  }

  /**
   * The page as it is stored.
   */
  private function stored(Page $page): Page {
    $stored = $this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID)->loadUnchanged($page->id());
    \assert($stored instanceof Page);
    return $stored;
  }

  /**
   * Sends our draft write.
   *
   * @param \Drupal\canvas\Entity\Page $page
   *   The page translation to write to.
   * @param array $values
   *   The whole values object.
   * @param string $client
   *   The client instance id.
   * @param array|null $auto_saves
   *   The editor's auto-save map; by default what the server holds right now.
   * @param string|null $langcode
   *   The langcode to send; by default the translation's own.
   */
  private function put(Page $page, array $values, string $client, ?array $auto_saves = NULL, ?string $langcode = NULL): Response {
    return $this->request(Request::create("/canvas-metatag/api/draft/canvas_page/{$page->id()}", 'PUT', content: (string) json_encode([
      'values' => (object) $values,
      'langcode' => $langcode ?? $page->language()->getId(),
      'client_instance_id' => $client,
      'auto_saves' => $auto_saves ?? [AutoSaveManager::getAutoSaveKey($page) => $this->autoSave()->getClientAutoSaveData($page)],
    ])));
  }

  /**
   * The editor's layout GET.
   */
  private function getLayout(Page $page): array {
    return self::decodeResponse($this->request(Request::create("/canvas/api/v0/layout/canvas_page/{$page->id()}")));
  }

  /**
   * The editor's layout POST, built from what a layout GET returned.
   */
  private function layoutRequest(Page $page, array $layout, string $client): Request {
    unset($layout['isNew'], $layout['isPublished'], $layout['html'], $layout['hasUnsavedStatusChange'], $layout['translations']);
    $request = Request::create("/canvas/api/v0/layout/canvas_page/{$page->id()}", 'POST', content: (string) json_encode(['clientInstanceId' => $client] + $layout));
    $request->headers->set('Content-Type', 'application/json');
    return $request;
  }

  /**
   * Sends the editor's layout POST.
   */
  private function postLayout(Page $page, array $layout, string $client): Response {
    return $this->request($this->layoutRequest($page, $layout, $client));
  }

}
