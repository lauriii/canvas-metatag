<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas_metatag\ShareRenderer;

/**
 * The share renderer, counted and breakable.
 *
 * Static, so that it survives container rebuilds within a test.
 */
final class ShareRendererSpy extends ShareRenderer {

  /**
   * What was drawn: [kind, input or URI].
   *
   * @var list<array{0: string, 1: mixed}>
   */
  public static array $drawn = [];

  /**
   * Every draw throws while TRUE.
   */
  public static bool $broken = FALSE;

  /**
   * The site cannot make images while TRUE: no GD with FreeType.
   */
  public static bool $unavailable = FALSE;

  /**
   * This GD reads no WebP while TRUE.
   */
  public static bool $noWebp = FALSE;

  /**
   * {@inheritdoc}
   */
  public function missing(): ?string {
    return self::$unavailable ? 'fonts' : parent::missing();
  }

  /**
   * {@inheritdoc}
   */
  public function reads(string $mime): bool {
    return !(self::$noWebp && $mime === 'image/webp') && parent::reads($mime);
  }

  /**
   * {@inheritdoc}
   */
  public function card(array $input): ?string {
    return $this->draw('card', $input, fn (): ?string => parent::card($input));
  }

  /**
   * {@inheritdoc}
   */
  public function sample(array $input): array {
    self::$drawn[] = ['sample', $input];
    return parent::sample($input);
  }

  /**
   * {@inheritdoc}
   */
  public function photo(string $uri, bool $chosen): ?string {
    return $this->draw('photo', $uri, fn (): ?string => parent::photo($uri, $chosen));
  }

  /**
   * {@inheritdoc}
   */
  public function icon(array $input, int $size): ?string {
    return $this->draw('icon', $size, fn (): ?string => parent::icon($input, $size));
  }

  /**
   * Records a draw, then draws or throws.
   */
  private function draw(string $kind, mixed $input, \Closure $draw): ?string {
    self::$drawn[] = [$kind, $input];
    if (self::$broken) {
      throw new \RuntimeException('The renderer is broken.');
    }
    return $draw();
  }

}
