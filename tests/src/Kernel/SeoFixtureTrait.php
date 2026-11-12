<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Values;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\PageCache\ChainRequestPolicy;
use Drupal\Core\PageCache\RequestPolicy\NoSessionOpen;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\file\Entity\File;
use Drupal\media\Entity\Media;
use Drupal\media\MediaInterface;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\media\Traits\MediaTypeCreationTrait;
use Drupal\user\Entity\Role;
use Drupal\user\Entity\User;
use Drupal\user\UserInterface;
use Symfony\Component\DependencyInjection\Definition;
use Symfony\Component\DependencyInjection\Reference;

/**
 * The site the resolver, adapter and API tests share.
 *
 * An example site with a name, an author, image media, pages, and an Article
 * type whose `full` content template can be enabled.
 */
trait SeoFixtureTrait {

  use MediaTypeCreationTrait;

  /**
   * The published date of every fixture entity, and its ISO form in Helsinki.
   */
  protected const CREATED = '2026-03-02T07:00:00Z';
  protected const PUBLISHED = '2026-03-02T09:00:00+02:00';
  protected const CHANGED = '2026-03-04T09:30:00Z';
  protected const MODIFIED = '2026-03-04T11:30:00+02:00';

  /**
   * A valid one-pixel PNG; the dimensions a test needs are set on the field.
   */
  private const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  /**
   * The author of every fixture entity.
   */
  protected UserInterface $author;

  /**
   * Installs the schemas and the configuration of the example site.
   *
   * The test class must enable the modules node, field, media and
   * canvas_metatag in addition to the Canvas minimum.
   */
  protected function setUpSite(): void {
    $this->installEntitySchema('user');
    $this->installEntitySchema('path_alias');
    $this->installEntitySchema('file');
    $this->installEntitySchema('media');
    $this->installEntitySchema('node');
    $this->installEntitySchema(Page::ENTITY_TYPE_ID);
    $this->installSchema('file', ['file_usage']);
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['user', 'node', 'filter', 'image', 'media', 'canvas_metatag']);
    $this->config('system.site')->set('name', 'Example')->save();
    $this->config('system.date')->set('timezone.default', 'Europe/Helsinki')->save();
    Role::load('anonymous')?->grantPermission('access content')->grantPermission('view media')->save();
    $this->createMediaType('image', ['id' => 'image', 'label' => 'Image']);
    NodeType::create(['type' => 'article', 'name' => 'Article'])->save();
    // Burn uid 1, which bypasses access checks.
    User::create(['name' => 'root', 'status' => 1])->save();
    $this->author = User::create(['name' => 'Ada Writer', 'status' => 1]);
    $this->author->save();
  }

  /**
   * Lets both page caches answer the GET requests of a kernel test.
   *
   * Their default request policies refuse every request made on the command
   * line, which is where kernel tests run. What is left is the rest of core's
   * page cache policy: no session open. Call from register(); the test may
   * send GET requests only, because unsafe methods are no longer refused.
   */
  protected static function allowPageCaches(ContainerBuilder $container): void {
    if ($container->hasDefinition('http_middleware.page_cache')) {
      $container->getDefinition('http_middleware.page_cache')->setClass(PerRequestPageCache::class);
    }
    if ($container->hasDefinition('page_cache_request_policy')) {
      $container->getDefinition('page_cache_request_policy')
        ->setClass(ChainRequestPolicy::class)
        ->setArguments([])
        ->addMethodCall('addPolicy', [new Definition(NoSessionOpen::class, [new Reference('session_configuration')])]);
    }
    if ($container->hasDefinition('dynamic_page_cache_request_policy')) {
      $container->getDefinition('dynamic_page_cache_request_policy')->setClass(ChainRequestPolicy::class);
    }
  }

  /**
   * The resolver of the current container.
   */
  protected function resolver(): Resolver {
    return $this->container->get(Resolver::class);
  }

  /**
   * Forgets remembered access results, as the start of a request does.
   *
   * Access handlers remember a result for the rest of the process, also
   * after the entity or the role it came from was saved.
   */
  protected function forgetAccess(): void {
    foreach (['media', 'file', 'taxonomy_term'] as $entity_type_id) {
      if ($this->container->get('entity_type.manager')->hasDefinition($entity_type_id)) {
        $this->container->get('entity_type.manager')->getAccessControlHandler($entity_type_id)->resetCache();
      }
    }
  }

  /**
   * Saves a published page with an alias, written and changed at fixed times.
   */
  protected function createPage(array $values = []): Page {
    $page = Page::create($values + [
      'title' => 'Pricing',
      'description' => 'Plans and prices for Example.',
      'status' => TRUE,
      'owner' => $this->author->id(),
      'created' => strtotime(self::CREATED),
      'changed' => strtotime(self::CHANGED),
      'path' => ['alias' => '/pricing'],
      'components' => [],
    ]);
    $page->save();
    return $page;
  }

  /**
   * Saves an image media item and its file.
   *
   * @param string $name
   *   The media name; the file is named after it.
   * @param array $item
   *   Values of the image field item: width, height, alt.
   * @param array $values
   *   Further media values, such as `status`.
   * @param string $scheme
   *   The stream wrapper of the file.
   */
  protected function createImage(string $name, array $item = [], array $values = [], string $scheme = 'public'): MediaInterface {
    $uri = $scheme . '://' . strtolower(strtr($name, ' ', '-')) . '.png';
    file_put_contents($uri, base64_decode(self::PIXEL));
    $file = File::create(['uri' => $uri, 'status' => 1]);
    $file->save();
    $media = Media::create($values + [
      'bundle' => 'image',
      'name' => $name,
      'status' => TRUE,
      'field_media_image' => $item + ['target_id' => $file->id(), 'alt' => '', 'width' => 1200, 'height' => 630],
    ]);
    $media->save();
    return $media;
  }

  /**
   * The image array the resolver gives for a fixture image.
   */
  protected function imageOf(MediaInterface $media): array {
    $item = $media->get('field_media_image')->first();
    $file = $item?->get('entity')->getValue();
    \assert($file instanceof File);
    $generator = $this->container->get('file_url_generator');
    $style = $this->container->get('entity_type.manager')->getStorage('image_style')->load('thumbnail');
    return [
      'url' => $generator->generateAbsoluteString($file->getFileUri()),
      'width' => (int) $item->get('width')->getValue(),
      'height' => (int) $item->get('height')->getValue(),
      'alt' => Values::plain((string) $item->get('alt')->getValue(), 1000),
      'bytes' => (int) $file->getSize(),
      'mime' => 'image/png',
      'name' => (string) $media->label(),
      'thumb' => $generator->transformRelative($style->buildUrl($file->getFileUri())),
    ];
  }

  /**
   * Adds a field to the Article type.
   */
  protected function createField(string $name, string $type, string $label, array $storage_settings = [], array $settings = [], int $cardinality = 1): void {
    FieldStorageConfig::create([
      'field_name' => $name,
      'entity_type' => 'node',
      'type' => $type,
      'settings' => $storage_settings,
      'cardinality' => $cardinality,
    ])->save();
    FieldConfig::create([
      'field_name' => $name,
      'entity_type' => 'node',
      'bundle' => 'article',
      'label' => $label,
      'settings' => $settings,
    ])->save();
  }

  /**
   * Saves the `full` content template of the Article type.
   *
   * Call generateComponentConfig() first.
   *
   * @param bool $enabled
   *   Whether the template renders articles, which is what makes them ours.
   * @param array $values
   *   The SEO defaults of the type.
   */
  protected function createTemplate(bool $enabled, array $values = []): ContentTemplate {
    $heading = Component::load('sdc.canvas_test_sdc.heading');
    \assert($heading instanceof Component);
    $template = ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => 'article',
      'content_entity_type_view_mode' => 'full',
      'component_tree' => [
        [
          'uuid' => '11111111-1111-4111-8111-111111111111',
          'component_id' => 'sdc.canvas_test_sdc.heading',
          'component_version' => $heading->getActiveVersion(),
          'inputs' => ['text' => 'Template heading', 'element' => 'h1'],
        ],
      ],
      'status' => $enabled,
      'third_party_settings' => $values ? ['canvas_metatag' => ['values' => $values]] : [],
    ]);
    $template->save();
    return $template;
  }

  /**
   * The `content` of the named rows of a head, by name or property.
   *
   * @return array<string, string>
   *   Meta name or property => content, in emission order.
   */
  protected static function meta(array $head): array {
    $rows = [];
    foreach ($head['meta'] as $row) {
      $rows[$row['name'] ?? $row['property']] = $row['content'];
    }
    return $rows;
  }

  /**
   * The nodes of a head's JSON-LD graph, by the fragment of their @id.
   *
   * @return array<string, array>
   *   Fragment (`identity`, `webpage`, `primary`, ...) => node.
   */
  protected static function graph(array $head): array {
    $nodes = [];
    foreach ($head['script'][0]['textContent']['@graph'] as $node) {
      $nodes[substr((string) strrchr($node['@id'] ?? '#', '#'), 1)] = $node;
    }
    return $nodes;
  }

}
