<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Component\Utility\Crypt;
use Drupal\Core\DestructableInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\File\FileSystemInterface;
use Drupal\Core\Language\LanguageInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Site\Settings;

/**
 * Where made images are stored: public files, in a folder no one can guess.
 *
 * The folder's name is derived from the site's hash salt, so a stored file
 * has no address anyone can work out from the route's: images are only ever
 * fetched through the route, which checks access and sends `noindex` on
 * cards, whatever web server serves the files path.
 *
 * No lock: a render is deterministic, so two requests that render at once
 * write the same bytes. Each writes a file of its own and renames it into
 * place, then deletes the older files of that folder: a folder holds the
 * image one entity shares in one language (its card or its photo's share
 * version), the site image's share version (`site`), or one icon size. A
 * photo's share version is stored with its file's id before its name
 * (photoPath()), so the versions of one file can be found; the address never
 * names it.
 *
 * @internal
 */
final class ShareStore implements DestructableInterface {

  /**
   * The module's folder in the public files.
   */
  public const ROOT = 'public://canvas-metatag';

  /**
   * The ids of the files whose share versions go at the end of the request.
   *
   * @var array<int, true>
   */
  private array $forgotten = [];

  public function __construct(
    private readonly FileSystemInterface $fileSystem,
    private readonly LanguageManagerInterface $languageManager,
  ) {}

  /**
   * The folder of every made image, at the route's own paths below it.
   */
  public static function dir(): string {
    return self::ROOT . '/share-' . substr(Crypt::hmacBase64('canvas_metatag_share', Settings::getHashSalt()), 0, 16);
  }

  /**
   * Where a photo's share version is stored, for its path below the route.
   */
  public static function photoPath(string $path, int $fid): string {
    return dirname($path) . "/$fid-" . basename($path);
  }

  /**
   * Stores the bytes at a path and deletes the other files of its folder.
   *
   * @param string $path
   *   The path below the share folder: the route's, photoPath() for a photo.
   * @param string $bytes
   *   The image.
   *
   * @throws \RuntimeException
   *   When the file cannot be written.
   */
  public function write(string $path, string $bytes): void {
    $uri = self::dir() . '/' . $path;
    $dir = dirname($uri);
    $temp = $uri . '.' . bin2hex(random_bytes(6)) . '.tmp';
    if (!$this->fileSystem->prepareDirectory($dir, FileSystemInterface::CREATE_DIRECTORY | FileSystemInterface::MODIFY_PERMISSIONS)
      || file_put_contents($temp, $bytes) !== strlen($bytes)
      || !$this->fileSystem->chmod($temp)
      || !rename($temp, $uri)) {
      @unlink($temp);
      throw new \RuntimeException("The share image $path could not be stored.");
    }
    // Another request's file in progress stays; one left by a request that
    // died while writing goes after a minute.
    foreach (scandir($dir) ?: [] as $name) {
      $other = "$dir/$name";
      if ($name !== basename($uri) && is_file($other) && (!str_ends_with($name, '.tmp') || filemtime($other) < time() - 60)) {
        @unlink($other);
      }
    }
  }

  /**
   * Deletes the stored share versions of a file, at the end of the request.
   *
   * When its image may no longer be shown (its media unpublished, its file
   * deleted): which entities shared it is not known. Collected, so that a
   * request that deletes many files looks through the folders once.
   */
  public function forgetPhotos(int $fid): void {
    $this->forgotten[$fid] = TRUE;
  }

  /**
   * {@inheritdoc}
   */
  public function destruct(): void {
    if (!$this->forgotten) {
      return;
    }
    $this->deleteMatching(fn (string $name): bool => preg_match('/^(\d+)-[0-9a-f]{16}\.jpg$/', $name, $match) && isset($this->forgotten[(int) $match[1]]));
    $this->forgotten = [];
  }

  /**
   * Deletes every stored card, when pages without an image share none.
   */
  public function forgetCards(): void {
    $this->deleteMatching(static fn (string $name): bool => (bool) preg_match('/^[0-9a-f]{16}\.png$/', $name));
  }

  /**
   * Deletes the stored images of entities whose names match.
   */
  private function deleteMatching(\Closure $matches): void {
    // Folders by language, entity type and id, and the site image's; read
    // through the stream. Icons are no entity's.
    $folders = is_dir(self::dir()) ? [self::dir()] : [];
    while (($folder = array_pop($folders)) !== NULL) {
      foreach (array_diff(scandir($folder) ?: [], ['.', '..', 'icon']) as $name) {
        if (is_dir("$folder/$name")) {
          $folders[] = "$folder/$name";
        }
        elseif ($matches($name)) {
          @unlink("$folder/$name");
        }
      }
    }
  }

  /**
   * Deletes the stored cards of an entity, in one language or in all.
   */
  public function forget(EntityInterface $entity, ?string $langcode = NULL): void {
    $langcodes = $langcode === NULL ? array_keys($this->languageManager->getLanguages(LanguageInterface::STATE_ALL)) : [$langcode];
    foreach ($langcodes as $one) {
      $this->delete("$one/{$entity->getEntityTypeId()}/{$entity->id()}");
    }
  }

  /**
   * Deletes a folder below the share folder, or all of it for ''.
   */
  public function delete(string $path): void {
    $uri = $path === '' ? self::dir() : self::dir() . '/' . $path;
    if (is_dir($uri)) {
      $this->fileSystem->deleteRecursive($uri);
    }
  }

}
