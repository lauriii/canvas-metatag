<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Component\Utility\Bytes;

// cspell:ignore colours
/**
 * A page's own image as its 1200 × 630 share version.
 *
 * Turned upright first. A wide photo is cropped around its centre; a square,
 * tall, panoramic or transparent image is shown whole on its own colours.
 * Encoded as a progressive JPEG under 300 KB without the source's metadata.
 * Core's image styles cannot do this: the toolkit may not be GD, the JPEG
 * quality is site-wide, and nothing applies the camera's orientation.
 *
 * @internal
 */
final class ShareImage {

  /**
   * The most pixels a source may have: a 24 megapixel camera's photo.
   */
  public const MAX_PIXELS = 24_000_000;

  /**
   * The largest share version, in bytes.
   */
  public const MAX_BYTES = 300 * 1024;

  /**
   * What happens to an image of an upright size.
   *
   * @param int $w
   *   The upright width.
   * @param int $h
   *   The upright height.
   * @param bool $chosen
   *   Chosen by an editor, not found.
   *
   * @return string
   *   'cover' (cropped around the centre, ratio 1.30–2.4 with at most 1.25×
   *   enlargement, 1× for a chosen one), 'frame' (shown whole), 'original'
   *   (a chosen image under 200 × 200: sent as it is) or 'skip' (a found
   *   image under 600 × 315, or over 24 megapixels).
   */
  public static function treatment(int $w, int $h, bool $chosen): string {
    if ($w < 1 || $h < 1 || $w * $h > self::MAX_PIXELS) {
      return 'skip';
    }
    if ($chosen ? $w < 200 || $h < 200 : $w < 600 || $h < 315) {
      return $chosen ? 'original' : 'skip';
    }
    $ratio = $w / $h;
    $scale = max(ShareCard::W / $w, ShareCard::H / $h);
    return $ratio >= 1.30 && $ratio <= 2.4 && $scale <= ($chosen ? 1.0 : 1.25) ? 'cover' : 'frame';
  }

  /**
   * The share version of an image file, or NULL when it is not made.
   *
   * NULL for a file that is not a JPEG, PNG or WebP image (a found SVG or
   * GIF is skipped), for one the treatment skips or sends as it is, and for
   * one GD cannot read.
   *
   * @param string $path
   *   A local file.
   * @param bool $chosen
   *   Chosen by an editor, not found.
   */
  public static function make(string $path, bool $chosen): ?\GdImage {
    $size = @getimagesize($path);
    if (!$size || !in_array($size[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], TRUE)) {
      return NULL;
    }
    $orientation = $size[2] === IMAGETYPE_JPEG ? self::orientation($path) : 1;
    [$w, $h] = $orientation >= 5 ? [$size[1], $size[0]] : [$size[0], $size[1]];
    $treatment = self::treatment($w, $h, $chosen);
    // Decoded whole, then copied once more to turn it upright or flatten its
    // transparency.
    $copies = $size[2] === IMAGETYPE_JPEG ? ($orientation >= 3 ? 2 : 1) : 2;
    if (!in_array($treatment, ['cover', 'frame'], TRUE) || !self::fits($w * $h, $copies, (int) filesize($path), self::free())) {
      return NULL;
    }
    $source = @imagecreatefromstring((string) file_get_contents($path));
    if (!$source) {
      return NULL;
    }
    imagepalettetotruecolor($source);
    imagealphablending($source, TRUE);
    imagesavealpha($source, TRUE);
    $source = self::orient($source, $orientation);
    $plain = NULL;
    if (ShareCard::hasAlpha($source)) {
      [$source, $plain] = self::flatten($source);
      $treatment = 'frame';
    }
    return $treatment === 'cover' ? self::cover($source) : self::frame($source, $chosen ? 1.0 : 1.25, $plain);
  }

  /**
   * Whether decoding an image fits in the memory left, with 16 MB to spare.
   *
   * Where GD is PHP's bundled one its pixels count toward the memory limit,
   * and running out ends the request: no error can be caught.
   *
   * @param int $pixels
   *   The image's pixels.
   * @param int $copies
   *   How many full-size copies are held at once.
   * @param int $bytes
   *   The file's size: it is read whole.
   * @param int|null $free
   *   The memory left in bytes, NULL for no limit.
   */
  public static function fits(int $pixels, int $copies, int $bytes, ?int $free): bool {
    return $free === NULL || $pixels * 4 * $copies + 2 * $bytes + 16 * 1024 * 1024 <= $free;
  }

  /**
   * The memory this request may still use, in bytes, NULL for no limit.
   */
  public static function free(): ?int {
    $limit = trim((string) ini_get('memory_limit'));
    return $limit === '' || $limit === '-1' ? NULL : (int) Bytes::toNumber($limit) - memory_get_usage();
  }

  /**
   * A share version as JPEG bytes, at most 300 KB.
   *
   * Quality 82, then 72, 60 and 50 while too large: some messaging apps drop
   * larger images. Even pure noise is about 270 KB at 50.
   */
  public static function jpeg(\GdImage $image): string {
    imageinterlace($image, TRUE);
    foreach ([82, 72, 60, 50] as $quality) {
      ob_start();
      imagejpeg($image, NULL, $quality);
      $bytes = (string) ob_get_clean();
      if (strlen($bytes) <= self::MAX_BYTES) {
        break;
      }
    }
    return $bytes;
  }

  /**
   * The camera orientation stored in a JPEG, 1 when none or unreadable.
   */
  public static function orientation(string $path): int {
    if (!function_exists('exif_read_data')) {
      return 1;
    }
    $exif = @exif_read_data($path);
    $orientation = (int) ($exif['Orientation'] ?? 1);
    return $orientation >= 1 && $orientation <= 8 ? $orientation : 1;
  }

  /**
   * An image turned upright from its stored orientation.
   */
  private static function orient(\GdImage $image, int $orientation): \GdImage {
    $angle = match ($orientation) {
      3, 4 => 180,
      5, 6 => 270,
      7, 8 => 90,
      default => 0,
    };
    if ($angle) {
      $image = imagerotate($image, $angle, 0) ?: $image;
    }
    if (in_array($orientation, [2, 4, 5, 7], TRUE)) {
      imageflip($image, IMG_FLIP_HORIZONTAL);
    }
    return $image;
  }

  /**
   * A transparent image on the colour of its opaque edge.
   *
   * White when under a quarter of the edge is opaque; the neutral dark when
   * both the subject and that colour are light. Transparent pixels carry no
   * colour, whatever their stored RGB.
   *
   * @return array{0: \GdImage, 1: array}
   *   The flat image and its background.
   */
  private static function flatten(\GdImage $source): array {
    [$edge, , $opaque] = self::edgeStats($source);
    $background = $opaque < 0.25 ? [255, 255, 255] : $edge;
    $subject = ShareCard::meanOpaque($source);
    if ($subject !== NULL && ShareCard::hsl($subject)[2] > 0.85 && ShareCard::hsl($background)[2] > 0.85) {
      $background = [34, 37, 44];
    }
    $flat = imagecreatetruecolor(imagesx($source), imagesy($source));
    imagefill($flat, 0, 0, ShareCard::color($flat, $background));
    imagealphablending($flat, TRUE);
    imagecopy($flat, $source, 0, 0, 0, 0, imagesx($source), imagesy($source));
    return [$flat, $background];
  }

  /**
   * Cropped to 1200 × 630 around the centre.
   */
  private static function cover(\GdImage $source): \GdImage {
    [$sw, $sh] = [imagesx($source), imagesy($source)];
    $scale = max(ShareCard::W / $sw, ShareCard::H / $sh);
    [$cw, $ch] = [ShareCard::W / $scale, ShareCard::H / $scale];
    $out = imagecreatetruecolor(ShareCard::W, ShareCard::H);
    imagecopyresampled($out, $source, 0, 0, (int) round(($sw - $cw) / 2), (int) round(($sh - $ch) / 2), ShareCard::W, ShareCard::H, (int) round($cw), (int) round($ch));
    return $out;
  }

  /**
   * Shown whole, never cut into a band.
   *
   * Plain edges continue seamlessly; anything else sits inset with 16 px
   * corners and a soft shadow on a wash of a 3 × 2 sample of the image,
   * darkened 30%: colour and light only, so nothing in the picture ghosts.
   */
  private static function frame(\GdImage $source, float $maxScale, ?array $plain): \GdImage {
    [$sw, $sh] = [imagesx($source), imagesy($source)];
    [$edge, $spread] = $plain ? [$plain, 0.0] : self::edgeStats($source);
    $out = imagecreatetruecolor(ShareCard::W, ShareCard::H);
    if ($spread < 6) {
      imagefill($out, 0, 0, ShareCard::color($out, $edge));
      $h = ShareCard::H;
      $w = (int) round($sw * $h / $sh);
      if ($w > ShareCard::W) {
        [$w, $h] = [ShareCard::W, (int) round($sh * ShareCard::W / $sw)];
      }
      if ($w > $sw * $maxScale) {
        [$w, $h] = [(int) round($sw * $maxScale), (int) round($sh * $maxScale)];
      }
      imagecopyresampled($out, $source, intdiv(ShareCard::W - $w, 2), intdiv(ShareCard::H - $h, 2), 0, 0, $w, $h, $sw, $sh);
      return $out;
    }
    $tiny = imagecreatetruecolor(3, 2);
    imagecopyresampled($tiny, $source, 0, 0, 0, 0, 3, 2, $sw, $sh);
    $samples = [];
    for ($j = 0; $j < 2; $j++) {
      for ($i = 0; $i < 3; $i++) {
        $c = imagecolorat($tiny, $i, $j);
        $samples[$j][$i] = ShareCard::mix([($c >> 16) & 255, ($c >> 8) & 255, $c & 255], [0, 0, 0], 0.3);
      }
    }
    [$gw, $gh] = [150, 79];
    $wash = imagecreatetruecolor($gw, $gh);
    for ($y = 0; $y < $gh; $y++) {
      $v = $y / ($gh - 1);
      for ($x = 0; $x < $gw; $x++) {
        $u = $x / ($gw - 1) * 2;
        $i = min(1, (int) floor($u));
        $top = ShareCard::mix($samples[0][$i], $samples[0][$i + 1], $u - $i);
        $bottom = ShareCard::mix($samples[1][$i], $samples[1][$i + 1], $u - $i);
        imagesetpixel($wash, $x, $y, ShareCard::color($wash, ShareCard::mix($top, $bottom, $v)));
      }
    }
    imagecopyresampled($out, $wash, 0, 0, 0, 0, ShareCard::W, ShareCard::H, $gw, $gh);
    $h = ShareCard::H - 80;
    $w = (int) round($sw * $h / $sh);
    if ($w > ShareCard::W - 128) {
      [$w, $h] = [ShareCard::W - 128, (int) round($sh * (ShareCard::W - 128) / $sw)];
    }
    if ($w > $sw * $maxScale) {
      [$w, $h] = [(int) round($sw * $maxScale), (int) round($sh * $maxScale)];
    }
    [$x, $y] = [intdiv(ShareCard::W - $w, 2), intdiv(ShareCard::H - $h, 2)];
    self::shadow($out, $x, $y, $w, $h);
    $picture = imagecreatetruecolor($w, $h);
    imagecopyresampled($picture, $source, 0, 0, 0, 0, $w, $h, $sw, $sh);
    ShareCard::roundCorners($picture, 16);
    imagealphablending($out, TRUE);
    imagecopy($out, $picture, $x, $y, 0, 0, $w, $h);
    return $out;
  }

  /**
   * A soft shadow under a rounded box: 36 px blur, 10 px drop, 45%.
   *
   * Computed at quarter size as an alpha mask and scaled up.
   */
  private static function shadow(\GdImage $out, int $x, int $y, int $w, int $h): void {
    [$q, $r, $blur, $drop, $strength] = [4, 16, 36, 10, 0.45];
    [$mw, $mh] = [intdiv(ShareCard::W, $q), (int) ceil(ShareCard::H / $q)];
    $mask = ShareCard::canvas($mw, $mh);
    imagealphablending($mask, FALSE);
    [$cx, $cy] = [($x + $w / 2) / $q, ($y + $h / 2 + $drop) / $q];
    [$hw, $hh, $rr, $bb] = [$w / 2 / $q, $h / 2 / $q, $r / $q, $blur / $q];
    for ($py = 0; $py < $mh; $py++) {
      for ($px = 0; $px < $mw; $px++) {
        $qx = abs($px + 0.5 - $cx) - ($hw - $rr);
        $qy = abs($py + 0.5 - $cy) - ($hh - $rr);
        $d = hypot(max($qx, 0), max($qy, 0)) + min(max($qx, $qy), 0) - $rr;
        $t = max(0, min(1, ($d + $bb * 0.3) / $bb));
        $k = $strength * (1 - $t * $t * (3 - 2 * $t));
        imagesetpixel($mask, $px, $py, imagecolorallocatealpha($mask, 0, 0, 0, 127 - (int) round(127 * $k)));
      }
    }
    $full = ShareCard::canvas(ShareCard::W, ShareCard::H);
    imagealphablending($full, FALSE);
    imagecopyresampled($full, $mask, 0, 0, 0, 0, ShareCard::W, ShareCard::H, $mw, $mh);
    imagealphablending($out, TRUE);
    imagecopy($out, $full, 0, 0, 0, 0, ShareCard::W, ShareCard::H);
  }

  /**
   * The mean edge colour, its spread and the opaque share of the edge.
   *
   * @return array{0: array, 1: float, 2: float}
   *   [mean, spread, opaque share]; white and no spread when under a
   *   quarter of the edge is opaque.
   */
  private static function edgeStats(\GdImage $image): array {
    $pixels = [];
    foreach (ShareCard::edge($image) as [$x, $y]) {
      $c = imagecolorat($image, $x, $y);
      if ((($c >> 24) & 0x7F) <= 8) {
        $pixels[] = [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
      }
    }
    if (count($pixels) < 64) {
      return [[255, 255, 255], 0.0, count($pixels) / 256];
    }
    $mean = [0, 0, 0];
    foreach ($pixels as $p) {
      $mean = [$mean[0] + $p[0] / count($pixels), $mean[1] + $p[1] / count($pixels), $mean[2] + $p[2] / count($pixels)];
    }
    $variance = 0.0;
    foreach ($pixels as $p) {
      $variance += (($p[0] - $mean[0]) ** 2 + ($p[1] - $mean[1]) ** 2 + ($p[2] - $mean[2]) ** 2) / (3 * count($pixels));
    }
    return [$mean, sqrt($variance), count($pixels) / 256];
  }

}
