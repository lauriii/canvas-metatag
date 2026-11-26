<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas_metatag\ShareRenderer;
use Drupal\canvas_metatag\ShareStore;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\file\Entity\File;
use Drupal\media\Entity\Media;
use Drupal\media\MediaInterface;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\HttpKernelInterface;

/**
 * Fetches made share images in a kernel test, with a counted renderer.
 *
 * Canvas's RequestTrait reads every response's content, which a file
 * response does not have.
 */
trait ShareTestTrait {

  /**
   * Puts the counted renderer in the container. Call from register().
   */
  protected static function spyOnRenderer(ContainerBuilder $container): void {
    // Not while the module is uninstalled.
    if ($container->hasDefinition(ShareRenderer::class)) {
      $container->getDefinition(ShareRenderer::class)->setClass(ShareRendererSpy::class);
    }
    ShareRendererSpy::$drawn = [];
    ShareRendererSpy::$broken = FALSE;
    ShareRendererSpy::$unavailable = FALSE;
    ShareRendererSpy::$noWebp = FALSE;
  }

  /**
   * Requests an address as a new anonymous request, on a host.
   */
  protected function fetch(string $url, ?string $host = NULL): Response {
    // A request starts without the entities an earlier one loaded, and
    // without the access results it remembered.
    $this->container->get('entity.memory_cache')->deleteAll();
    $manager = $this->container->get('entity_type.manager');
    foreach (['canvas_page', 'node', 'media', 'file'] as $entity_type_id) {
      if ($manager->hasDefinition($entity_type_id)) {
        $manager->getAccessControlHandler($entity_type_id)->resetCache();
      }
    }
    $stack = $this->container->get(RequestStack::class);
    $previous = [];
    while ($stack->getCurrentRequest() !== NULL) {
      $previous[] = $stack->pop();
    }
    $request = Request::create($url);
    if ($host !== NULL) {
      $request->headers->set('Host', $host);
    }
    $kernel = $this->container->get(HttpKernelInterface::class);
    try {
      $response = $kernel->handle($request, HttpKernelInterface::MAIN_REQUEST, FALSE);
      $kernel->terminate($request, $response);
      return $response;
    }
    finally {
      while ($stack->getCurrentRequest() !== NULL) {
        $stack->pop();
      }
      foreach (array_reverse($previous) as $one) {
        $stack->push($one);
      }
    }
  }

  /**
   * The bytes of a file response.
   */
  protected static function bytes(Response $response): string {
    self::assertInstanceOf(BinaryFileResponse::class, $response);
    return (string) file_get_contents($response->getFile()->getPathname());
  }

  /**
   * The files stored below a path of the share folder, by name.
   *
   * @return list<string>
   *   File names, sorted.
   */
  protected static function stored(string $path): array {
    $dir = ShareStore::dir() . '/' . $path;
    $names = is_dir($dir) ? array_values(array_diff(scandir($dir), ['.', '..'])) : [];
    sort($names);
    return $names;
  }

  /**
   * Saves an image media item whose file is a real image of a size.
   */
  protected function createPhoto(string $name, int $width, int $height): MediaInterface {
    $uri = 'public://' . strtolower(strtr($name, ' ', '-')) . '.png';
    $image = imagecreatetruecolor($width, $height);
    imagefilledrectangle($image, 0, 0, $width, $height, (int) imagecolorallocate($image, 40, 120, 90));
    imagepng($image, $uri);
    $file = File::create(['uri' => $uri, 'status' => 1]);
    $file->save();
    $media = Media::create([
      'bundle' => 'image',
      'name' => $name,
      'status' => TRUE,
      'field_media_image' => ['target_id' => $file->id(), 'alt' => $name, 'width' => $width, 'height' => $height],
    ]);
    $media->save();
    return $media;
  }

}
