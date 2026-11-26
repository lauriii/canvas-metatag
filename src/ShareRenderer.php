<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Core\Extension\ThemeHandlerInterface;
use Drupal\Core\Extension\ThemeSettingsProvider;
use Drupal\Core\File\FileSystemInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

// cspell:ignore mtime
/**
 * Turns the inputs of a made image into its bytes.
 *
 * The inputs are plain values (Resolver::share()'s card, iconInput(), a photo's
 * file); this reads only local files: logos from the public files or the
 * default theme's folder, photos from the public files. Not final: tests
 * count and break the drawing.
 *
 * @internal
 */
class ShareRenderer {

  /**
   * The version of the looks.
   *
   * Part of every hash, so a new look gets a new address.
   */
  public const VERSION = 1;

  public function __construct(
    private readonly FileSystemInterface $fileSystem,
    private readonly ThemeHandlerInterface $themeHandler,
    #[Autowire(param: 'app.root')]
    private readonly string $root,
    private readonly ThemeSettingsProvider $themeSettings,
  ) {}

  /**
   * Whether this site makes images: GD with FreeType, public files on disk.
   *
   * Without either, the head sends original files and no card.
   */
  public function available(): bool {
    return $this->missing() === NULL;
  }

  /**
   * Why this site makes no images, or NULL when it makes them.
   *
   * @return string|null
   *   'fonts' (no GD with FreeType) or 'files' (no public files on local
   *   disk).
   */
  public function missing(): ?string {
    return match (TRUE) {
      !function_exists('imagettftext') => 'fonts',
      $this->publicPath() === NULL => 'files',
      default => NULL,
    };
  }

  /**
   * Whether this GD reads images of a media type.
   *
   * A share version of a WebP image needs GD built with WebP; without it the
   * original file is sent.
   */
  public function reads(string $mime): bool {
    return $mime !== 'image/webp' || (bool) (imagetypes() & IMG_WEBP);
  }

  /**
   * A card as PNG bytes, or NULL when its text cannot be drawn.
   */
  public function card(array $input): ?string {
    $input['logo'] = $this->logo($input['logo'] ?? NULL);
    $made = ($input['layout'] ?? 'page') === 'site' ? ShareCard::site($input) : ShareCard::page($input);
    return $made['image'] === NULL ? NULL : ShareCard::png($made['image']);
  }

  /**
   * A card drawn for Site › Sharing, with what it was drawn with.
   *
   * @return array{png: ?string, colour: string, picked: bool, text: string, contrast: float}
   *   The PNG bytes (NULL when nothing can be drawn), the field's colour,
   *   whether it was picked from the logo, the text colour and the measured
   *   contrast of the title.
   */
  public function sample(array $input): array {
    $input['logo'] = $this->logo($input['logo'] ?? NULL);
    $made = $input['layout'] === 'site' ? ShareCard::site($input) : ShareCard::page($input);
    $info = $made['info'];
    return [
      'png' => $made['image'] === NULL ? NULL : ShareCard::png($made['image']),
      'colour' => $info['centre'] ?? $info['field'][0],
      'picked' => $input['colour'] === '' && isset($input['logo']['colour']),
      'text' => $info['text'],
      'contrast' => (float) ($info['contrast']['title'] ?? 0),
    ];
  }

  /**
   * The share version of a public image file as JPEG bytes, or NULL.
   */
  public function photo(string $uri, bool $chosen): ?string {
    $path = str_starts_with($uri, 'public://') ? $this->fileSystem->realpath($uri) : FALSE;
    $image = $path ? ShareImage::make($path, $chosen) : NULL;
    return $image === NULL ? NULL : ShareImage::jpeg($image);
  }

  /**
   * A site icon as PNG bytes, or NULL when there is nothing to draw.
   *
   * The 180 px touch icon is opaque; the others keep their transparency.
   */
  public function icon(array $input, int $size): ?string {
    $input['logo'] = $this->logo($input['logo'] ?? NULL);
    $image = ShareCard::icon($input, $size);
    return $image === NULL ? NULL : ShareCard::png($image, $size !== 180);
  }

  /**
   * The upright size of a public JPEG: sideways when its camera said so.
   *
   * Reads the file's EXIF header only.
   *
   * @return array{0: int, 1: int}
   *   Width and height.
   */
  public function upright(string $uri, int $width, int $height): array {
    $path = str_starts_with($uri, 'public://') ? $this->fileSystem->realpath($uri) : FALSE;
    return $path && ShareImage::orientation($path) >= 5 ? [$height, $width] : [$width, $height];
  }

  /**
   * Whether a theme shows core's default favicon.
   *
   * It does while it uses the default favicon and has no favicon.ico of its
   * own.
   */
  public function coreFavicon(string $theme): bool {
    return $this->themeHandler->themeExists($theme)
      && (bool) $this->themeSettings->getSetting('features.favicon', $theme)
      && str_ends_with((string) $this->themeSettings->getSetting('favicon.url', $theme), '/core/misc/favicon.ico');
  }

  /**
   * The default theme's own logo, as a card input, or NULL.
   *
   * Read as Drupal reads it: the theme's settings over the global ones
   * (Appearance › Settings). Never core's logo, a file outside the theme's
   * folder or the public files, or an address on another host. The
   * modification time is part of the input, so a replaced file gets a new
   * address.
   *
   * @param string $theme
   *   The default theme.
   *
   * @return array{path: string, changed: int}|null
   *   The logo as the theme names it.
   */
  public function themeLogo(string $theme): ?array {
    if (!$this->themeHandler->themeExists($theme)) {
      return NULL;
    }
    $extension = $this->themeHandler->getTheme($theme);
    $logo = ($this->themeSettings->getSetting('logo.use_default', $theme) ?? TRUE)
      ? $extension->getPath() . '/' . ($extension->info['logo'] ?? 'logo.svg')
      : (string) $this->themeSettings->getSetting('logo.path', $theme);
    $file = $this->themeFile($logo, $extension->getPath());
    if ($file === NULL || str_starts_with($file, $this->root . '/core/')) {
      return NULL;
    }
    return ['path' => $logo, 'changed' => (int) filemtime($file)];
  }

  /**
   * The logo's pixels and colour, read from where the input names it.
   *
   * @param array{uri?: string, path?: string}|null $logo
   *   The input's logo: a public file's URI or the theme's logo path.
   */
  private function logo(?array $logo): ?array {
    $public = $this->publicPath();
    $default = $this->themeHandler->getDefault();
    $theme = $this->themeHandler->themeExists($default) ? $this->themeHandler->getTheme($default)->getPath() : NULL;
    $file = match (TRUE) {
      $public === NULL => NULL,
      isset($logo['uri']) => str_starts_with($logo['uri'], 'public://') ? $this->fileSystem->realpath($logo['uri']) : NULL,
      isset($logo['path']) && $theme !== NULL => $this->themeFile($logo['path'], $theme),
      default => NULL,
    };
    $allowed = array_filter([$public, $theme === NULL ? NULL : $this->root . '/' . $theme]);
    return is_string($file) ? ShareCard::readLogo($file, $allowed) : NULL;
  }

  /**
   * The local file of a theme logo path, or NULL (ShareCard::themeLogo()).
   */
  private function themeFile(string $logo, string $themePath): ?string {
    return ShareCard::themeLogo($logo, $this->root, $themePath, (string) $this->publicPath());
  }

  /**
   * The public files folder on local disk, or NULL.
   */
  private function publicPath(): ?string {
    $path = $this->fileSystem->realpath('public://');
    return is_string($path) && is_dir($path) ? $path : NULL;
  }

}
