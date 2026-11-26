<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

// cspell:ignore wordmark colours multicolour rasterised
/**
 * Draws the share card: a page's title on the site's colour, 1200 × 630.
 *
 * Plain GD with FreeType and the bundled fonts, so every host with GD and
 * FreeType draws the same pixels. The looks are the reference cards of the
 * strengthen-zero-config-defaults change; the measured rules are in its
 * reference.md. A card is never drawn with a glyph the fonts lack: the title
 * that cannot be drawn gives no card, and the chain goes on.
 *
 * Inputs are plain values; reading them from the site (CardInput) and
 * serving the bytes are not done here.
 *
 * @internal
 */
final class ShareCard {

  /**
   * The canvas width.
   */
  public const W = 1200;

  /**
   * The canvas height.
   */
  public const H = 630;

  /**
   * The contrast a title reaches on every point of the field.
   *
   * Titles are large-scale text, for which 4.5:1 is the enhanced level; the
   * margin keeps it when previews show the card at a third of its size.
   */
  public const TITLE_CONTRAST = 5.5;

  /**
   * The contrast small text reaches on every sampled pixel.
   */
  public const SMALL_CONTRAST = 4.5;

  /**
   * The largest side of a logo that is read, in pixels.
   */
  public const LOGO_MAX = 4096;

  /**
   * The largest side a logo is kept at once read, in pixels.
   *
   * The widest it is drawn: a 7:1 wordmark on the site card, 784 px.
   */
  public const LOGO_KEPT = 800;

  /**
   * The light above the centre of the field, at most.
   */
  private const GLOW = 0.06;

  /**
   * White text.
   */
  private const WHITE = [255, 255, 255];

  /**
   * Dark text.
   */
  private const INK = [17, 19, 24];

  /**
   * The neutral field, top left and bottom right, for no brand colour.
   */
  private const NEUTRAL = [[34, 37, 44], [14, 15, 19]];

  /**
   * Draws a page card.
   *
   * @param array $input
   *   - title: The og:title as emitted.
   *   - label: The small line above it, or ''.
   *   - site_name: The Site name.
   *   - logo: What readLogo() gave, or NULL.
   *   - colour: The stored colour ("#RRGGBB"), or ''.
   *   - dir: The page's direction, 'L' or 'R'.
   *
   * @return array{image: \GdImage|null, info: array}
   *   No image when the title is empty or cannot be drawn. The info holds
   *   the field, text colour, measured contrast, lines and title box.
   */
  public static function page(array $input): array {
    $theme = self::theme(self::brand($input));
    $info = self::themeInfo($theme);
    $title = ShareText::clean((string) ($input['title'] ?? ''));
    $fit = $title === '' ? NULL : ShareLayout::fit($title, 'title', ShareLayout::TITLE);
    if (!$fit) {
      return ['image' => NULL, 'info' => $info];
    }
    $dir = $input['dir'] ?? 'L';
    $para = ShareText::direction($title);
    $para = $para === 'N' ? $dir : $para;
    $image = self::field($theme);
    [$fg, $small, $info['contrast']] = self::ink($theme);
    [$info['mark'], $info['brand']] = self::brandRow($image, $input, $theme, 60);
    $label = ShareLayout::label(ShareText::clean((string) ($input['label'] ?? '')));
    $labelPx = $label['px'] ?? 26.0;
    $px = $fit['px'];
    $height = ShareLayout::leading($px) * $px;
    $cap = 0.727 * $px;
    $gap = 0.36 * $px + 12;
    $block = $cap + (count($fit['lines']) - 1) * $height + ($label ? 0.727 * $labelPx + $gap : 0);
    $y = 136 + (548 - 136 - $block) / 2;
    if ($label) {
      $baseline = $y + 0.727 * $labelPx;
      $color = self::color($image, $small($info['contrast']['small_opacity']));
      if ($label['cased']) {
        ShareLayout::drawTracked($image, 'ui', $labelPx, $label['text'], self::W / 2, $baseline, $color);
      }
      else {
        // In the page's direction, as the browser lays out the line in the
        // page's language: "Article · 25 نوفمبر 2026" reads from the right.
        ShareLayout::draw($image, $label['fit']['lines'][0], $labelPx, $label['fit']['space'], $dir, self::W / 2, $baseline, $color);
      }
      $y += 0.727 * $labelPx + $gap;
    }
    $baseline = $y + $cap;
    $widest = 0.0;
    foreach ($fit['lines'] as $line) {
      $widest = max($widest, ShareLayout::draw($image, $line, $px, $fit['space'], $para, self::W / 2, $baseline, self::color($image, $fg)));
      $baseline += $height;
    }
    $info += [
      'px' => $px,
      'lines' => array_map([ShareLayout::class, 'text'], $fit['lines']),
      'clamped' => $fit['clamped'],
      'label' => $label['text'] ?? NULL,
      // Its words left to right, as drawn.
      'label_order' => $label === NULL ? NULL : ($label['cased'] ? $label['text'] : ShareLayout::text(ShareText::visual($label['fit']['lines'][0], $dir))),
      // Cap top of the first line to the descenders of the last.
      'box' => [self::W / 2 - $widest / 2, $y, self::W / 2 + $widest / 2, $baseline - $height + 0.25 * $px],
    ];
    return ['image' => $image, 'info' => $info];
  }

  /**
   * Draws the site card: the identity, large.
   *
   * @param array $input
   *   - site_name, logo, colour, dir: As for page().
   *   - line: The slogan, or ''.
   *   - description: The description shared beside the card; the line is
   *     left out when it is the same.
   *
   * @return array{image: \GdImage|null, info: array}
   *   No image when neither a mark nor the Site name can be drawn.
   */
  public static function site(array $input): array {
    $theme = self::theme(self::brand($input));
    $info = self::themeInfo($theme);
    $logo = $input['logo']['image'] ?? NULL;
    $name = ShareText::clean((string) ($input['site_name'] ?? ''));
    $mark = self::mark($logo, 128, $theme, $name);
    if ($mark && $mark['wordmark']) {
      $mark = self::mark($logo, 112, $theme, $name);
    }
    $nameFit = $mark && $mark['wordmark'] || $name === '' ? NULL : ShareLayout::fit($name, 'title', ShareLayout::SITE_NAME);
    if (!$mark && !$nameFit) {
      return ['image' => NULL, 'info' => $info];
    }
    $line = ShareText::clean((string) ($input['line'] ?? ''));
    if ($line === ShareText::clean((string) ($input['description'] ?? ''))) {
      $line = '';
    }
    $lineFit = $line === '' ? NULL : ShareLayout::fit($line, 'body', ShareLayout::SITE_LINE);
    $image = self::field($theme);
    [$fg, $small, $info['contrast']] = self::ink($theme);
    $height = $mark['h'] ?? 0;
    if ($nameFit) {
      $height += ($mark ? 40 : 0) + 0.727 * $nameFit['px'] + (count($nameFit['lines']) - 1) * $nameFit['px'] * 1.1;
    }
    if ($lineFit) {
      $height += 46 + 0.727 * $lineFit['px'] + (count($lineFit['lines']) - 1) * $lineFit['px'] * 1.4;
    }
    $y = (self::H - $height) / 2;
    if ($mark) {
      imagecopy($image, $mark['image'], (int) round((self::W - $mark['w']) / 2), (int) round($y), 0, 0, $mark['w'], $mark['h']);
      $y += $mark['h'];
    }
    $dir = $input['dir'] ?? 'L';
    if ($nameFit) {
      $y += ($mark ? 40 : 0) + 0.727 * $nameFit['px'];
      $para = ShareText::direction($name);
      foreach ($nameFit['lines'] as $at => $one) {
        ShareLayout::draw($image, $one, $nameFit['px'], $nameFit['space'], $para === 'N' ? $dir : $para, self::W / 2, $y + $at * $nameFit['px'] * 1.1, self::color($image, $fg));
      }
      $y += (count($nameFit['lines']) - 1) * $nameFit['px'] * 1.1;
    }
    if ($lineFit) {
      $y += 46 + 0.727 * $lineFit['px'];
      $para = ShareText::direction($line);
      foreach ($lineFit['lines'] as $at => $one) {
        ShareLayout::draw($image, $one, $lineFit['px'], $lineFit['space'], $para === 'N' ? $dir : $para, self::W / 2, $y + $at * $lineFit['px'] * 1.4, self::color($image, $small(max($info['contrast']['small_opacity'], 0.82))));
      }
    }
    $info += [
      'mark' => $mark['kind'] ?? 'none',
      'px' => $nameFit['px'] ?? NULL,
      'line' => $lineFit ? array_map([ShareLayout::class, 'text'], $lineFit['lines']) : NULL,
    ];
    return ['image' => $image, 'info' => $info];
  }

  /**
   * A site icon from the logo.
   *
   * 32 and 192 keep a transparent logo transparent, trimmed and padded 6%;
   * the 180 px touch icon is opaque: the logo on the field colour, a
   * one-colour mark tinted, a multicolour one under 3:1 against the field on
   * white (the card's plate rule), 14% padding. An opaque logo fills the
   * square. No logo, or a wordmark at 32 px, where it would be an unreadable
   * strip: the card's monogram, or no icon when it can't be drawn (a
   * wordmark then stays).
   *
   * @param array $input
   *   As for page(); only site_name, logo and colour are read.
   * @param int $size
   *   The size: 32, 180 or 192.
   */
  public static function icon(array $input, int $size): ?\GdImage {
    $theme = self::theme(self::brand($input));
    $logo = $input['logo']['image'] ?? NULL;
    $scale = $size * 4;
    $image = self::canvas($scale, $scale);
    if ($logo) {
      $logo = self::trim($logo);
    }
    // The touch icon is opaque; so is any icon of a dark one-colour mark on
    // transparency, which would sink into a dark tab strip or home screen.
    $opaque = $size === 180 || ($logo && self::hasAlpha($logo) && self::singleColour($logo)
      && self::contrast(self::meanOpaque($logo) ?? self::WHITE, self::NEUTRAL[1]) < 3.0);
    $monogram = $logo && $size === 32 && imagesx($logo) / imagesy($logo) > 2.2 ? self::mark(NULL, $scale, $theme, (string) ($input['site_name'] ?? '')) : NULL;
    $logo = $monogram ? NULL : $logo;
    if ($logo && !self::hasAlpha($logo)) {
      $side = min(imagesx($logo), imagesy($logo));
      imagecopyresampled($image, $logo, 0, 0, intdiv(imagesx($logo) - $side, 2), intdiv(imagesy($logo) - $side, 2), $scale, $scale, $side, $side);
    }
    elseif ($logo) {
      if ($opaque) {
        $field = $theme['centre'] ?? self::mix($theme['top'], $theme['bottom'], 0.5);
        if (self::singleColour($logo)) {
          $logo = self::tint($logo, $theme['fg']);
        }
        elseif (self::contrast(self::pickColour($logo) ?? self::meanOpaque($logo) ?? $field, $field) < 3.0) {
          $field = self::WHITE;
        }
        imagefilledrectangle($image, 0, 0, $scale, $scale, self::color($image, $field));
      }
      $pad = (int) round($scale * ($opaque ? 0.14 : 0.06));
      $ratio = imagesx($logo) / imagesy($logo);
      $inner = $scale - 2 * $pad;
      [$w, $h] = $ratio >= 1 ? [$inner, $inner / $ratio] : [$inner * $ratio, $inner];
      imagecopyresampled($image, $logo, (int) (($scale - $w) / 2), (int) (($scale - $h) / 2), 0, 0, (int) $w, (int) $h, imagesx($logo), imagesy($logo));
    }
    else {
      $mark = $monogram ?? self::mark(NULL, $scale, $theme, (string) ($input['site_name'] ?? ''));
      if (!$mark) {
        return NULL;
      }
      if ($opaque) {
        imagefilledrectangle($image, 0, 0, $scale, $scale, self::color($image, $theme['tile']));
      }
      imagecopy($image, $mark['image'], 0, 0, 0, 0, $scale, $scale);
    }
    $out = self::canvas($size, $size);
    imagealphablending($out, FALSE);
    imagecopyresampled($out, $image, 0, 0, 0, 0, $size, $size, $scale, $scale);
    return $out;
  }

  /**
   * A card or icon as PNG bytes.
   */
  public static function png(\GdImage $image, bool $alpha = FALSE): string {
    imagesavealpha($image, $alpha);
    ob_start();
    imagepng($image, NULL, 9, PNG_ALL_FILTERS);
    return (string) ob_get_clean();
  }

  /**
   * Reads a logo file: its pixels and its colour.
   *
   * An SVG is never rasterised: its colour is read from its source and the
   * card shows the monogram. A file outside the allowed folders, a logo over
   * 4096 pixels a side or too large to decode in the memory left, or a file
   * GD cannot read gives nothing. A larger logo is kept at 800 px on its
   * longer side: every card and icon is drawn from that.
   *
   * @param string $path
   *   A local file.
   * @param list<string> $allowed
   *   The folders a logo may come from: the public files and the default
   *   theme's folder.
   * @param int|false|null $free
   *   The memory left in bytes (ShareImage::fits()); FALSE for what this
   *   request has left.
   *
   * @return array{image: \GdImage|null, colour: array|null}
   *   The trimmed-ready pixels (NULL for an SVG) and the picked colour.
   */
  public static function readLogo(string $path, array $allowed, int|false|null $free = FALSE): array {
    $none = ['image' => NULL, 'colour' => NULL];
    $real = realpath($path);
    if ($real === FALSE || !is_file($real) || !self::inside($real, $allowed)) {
      return $none;
    }
    $head = (string) file_get_contents($real, FALSE, NULL, 0, 512);
    if (str_ends_with(strtolower($real), '.svg') || preg_match('/^\s*(<\?xml[^>]*>\s*)?(<!--.*?-->\s*)*<(svg|!DOCTYPE svg)/is', $head)) {
      return ['image' => NULL, 'colour' => self::svgColour((string) file_get_contents($real, FALSE, NULL, 0, 1048576))];
    }
    $size = @getimagesize($real);
    if (!$size || $size[0] < 1 || $size[1] < 1 || max($size[0], $size[1]) > self::LOGO_MAX
      || !ShareImage::fits($size[0] * $size[1], 1, (int) filesize($real), $free === FALSE ? ShareImage::free() : $free)) {
      return $none;
    }
    $image = @imagecreatefromstring((string) file_get_contents($real));
    if (!$image) {
      return $none;
    }
    imagepalettetotruecolor($image);
    [$w, $h] = [imagesx($image), imagesy($image)];
    if (max($w, $h) > self::LOGO_KEPT) {
      $scale = self::LOGO_KEPT / max($w, $h);
      $kept = self::canvas(max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)));
      imagealphablending($kept, FALSE);
      imagecopyresampled($kept, $image, 0, 0, 0, 0, imagesx($kept), imagesy($kept), $w, $h);
      $image = $kept;
    }
    imagealphablending($image, TRUE);
    imagesavealpha($image, TRUE);
    return ['image' => $image, 'colour' => self::pickColour($image)];
  }

  /**
   * The local file of the default theme's logo, or NULL.
   *
   * A public:// URI inside the public files, or a path from the Drupal root
   * whose real path lies inside the theme's folder or the public files (as
   * the Appearance form may store an uploaded logo). Never an address on
   * another host: the module fetches nothing.
   *
   * @param string $logo
   *   The theme's logo path, as its settings hold it.
   * @param string $root
   *   The Drupal root.
   * @param string $theme
   *   The theme's folder, from the Drupal root.
   * @param string $public
   *   The public files folder, real path.
   */
  public static function themeLogo(string $logo, string $root, string $theme, string $public): ?string {
    if (str_starts_with($logo, 'public://')) {
      $file = realpath($public . '/' . substr($logo, 9));
      return $file !== FALSE && self::inside($file, [$public]) ? $file : NULL;
    }
    if ($logo === '' || str_contains($logo, '://') || str_starts_with($logo, '//')) {
      return NULL;
    }
    $file = realpath($root . '/' . ltrim($logo, '/'));
    return $file !== FALSE && self::inside($file, array_filter([$root . '/' . $theme, $public])) ? $file : NULL;
  }

  /**
   * The brand colour picked from a logo, or NULL.
   *
   * The logo resampled to 48 × 48; opaque pixels with saturation of 0.25 or
   * more and lightness 0.10–0.92 binned into 24 hues weighted by saturation;
   * the heaviest bin's mean when it holds at least 5% of opaque pixels.
   *
   * @return array|null
   *   [r, g, b].
   */
  public static function pickColour(\GdImage $logo): ?array {
    $small = self::canvas(48, 48);
    imagealphablending($small, FALSE);
    imagecopyresampled($small, $logo, 0, 0, 0, 0, 48, 48, imagesx($logo), imagesy($logo));
    $bins = [];
    $opaque = 0;
    for ($y = 0; $y < 48; $y++) {
      for ($x = 0; $x < 48; $x++) {
        $c = imagecolorat($small, $x, $y);
        if ((($c >> 24) & 0x7F) > 64) {
          continue;
        }
        $rgb = [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
        [$h, $s, $l] = self::hsl($rgb);
        $opaque++;
        if ($s < 0.25 || $l < 0.10 || $l > 0.92) {
          continue;
        }
        $bin = (int) floor($h * 24) % 24;
        $bins[$bin]['weight'] = ($bins[$bin]['weight'] ?? 0) + $s;
        $bins[$bin]['pixels'][] = $rgb;
      }
    }
    if (!$bins) {
      return NULL;
    }
    uasort($bins, static fn (array $a, array $b): int => $b['weight'] <=> $a['weight']);
    $top = reset($bins);
    return count($top['pixels']) / $opaque < 0.05 ? NULL : self::mean($top['pixels']);
  }

  /**
   * The brand colour of an SVG logo: its heaviest saturated colour, or NULL.
   *
   * The `fill`, `stroke` and `stop-color` hex values in its source, as
   * attributes or styles, counted; the same saturation and lightness bounds
   * as a raster logo.
   *
   * @return array|null
   *   [r, g, b].
   */
  public static function svgColour(string $svg): ?array {
    preg_match_all('/(?:fill|stroke|stop-color)\s*[=:]\s*["\']?\s*#([0-9a-f]{6}|[0-9a-f]{3})\b/i', $svg, $matches);
    $counts = [];
    foreach ($matches[1] as $hex) {
      $hex = strtoupper(strlen($hex) === 3 ? preg_replace('/(.)/', '$1$1', $hex) : $hex);
      [, $s, $l] = self::hsl(self::rgb("#$hex"));
      if ($s >= 0.25 && $l >= 0.10 && $l <= 0.92) {
        $counts[$hex] = ($counts[$hex] ?? 0) + 1;
      }
    }
    if (!$counts) {
      return NULL;
    }
    // The most used; on a tie, the first in the source.
    $best = array_keys($counts, max($counts), TRUE)[0];
    return self::rgb("#$best");
  }

  /**
   * The field and text colours for a brand colour.
   *
   * White darkens the colour, dark ink lightens it, in 0.01 lightness steps,
   * until the title reaches 5.5:1 on the field's worst point; fewest steps
   * wins, ink paying five extra steps. Neither reachable, or no colour: the
   * neutral field.
   *
   * @return array
   *   top, bottom (the field's ends), fg (text), dark, centre (the moved
   *   colour or NULL), tile and tileInk (the monogram tile).
   */
  public static function theme(?array $brand): array {
    $neutral = [
      'top' => self::NEUTRAL[0],
      'bottom' => self::NEUTRAL[1],
      'fg' => self::WHITE,
      'dark' => TRUE,
      'centre' => NULL,
      'tile' => [244, 245, 247],
      'tileInk' => [24, 26, 32],
    ];
    if ($brand === NULL) {
      return $neutral;
    }
    [$h, $s, $l] = self::hsl($brand);
    $s = min($s, 0.85);
    $make = static fn (float $lightness): array => [
      self::rgbFromHsl($h, $s, min(1, $lightness + 0.03)),
      self::rgbFromHsl($h, $s, max(0, $lightness - 0.04)),
    ];
    $white = $ink = NULL;
    for ($k = 0; $k <= 80 && $l - $k / 100 >= 0.04; $k++) {
      if (self::contrast(self::WHITE, self::mix($make($l - $k / 100)[0], self::WHITE, self::GLOW)) >= self::TITLE_CONTRAST) {
        $white = $k;
        break;
      }
    }
    for ($k = 0; $k <= 80 && $l + $k / 100 <= 0.96; $k++) {
      if (self::contrast(self::INK, $make($l + $k / 100)[1]) >= self::TITLE_CONTRAST) {
        $ink = $k;
        break;
      }
    }
    if ($white === NULL && $ink === NULL) {
      return $neutral;
    }
    $useInk = $ink !== NULL && ($white === NULL || $ink + 5 < $white);
    $lightness = $useInk ? $l + $ink / 100 : $l - $white / 100;
    [$top, $bottom] = $make($lightness);
    $centre = self::rgbFromHsl($h, $s, $lightness);
    $theme = ['top' => $top, 'bottom' => $bottom, 'centre' => $centre, 'dark' => !$useInk];
    return $theme + ($useInk
      ? ['fg' => self::INK, 'tile' => self::INK, 'tileInk' => $top]
      : ['fg' => self::WHITE, 'tile' => self::WHITE, 'tileInk' => $centre]);
  }

  /**
   * The field: a diagonal gradient with a soft light above the centre.
   *
   * Painted at 150 × 79 and resampled, so there is no banding.
   */
  public static function field(array $theme): \GdImage {
    $grid = self::painted($theme);
    $small = imagecreatetruecolor(count($grid[0]), count($grid));
    foreach ($grid as $y => $row) {
      foreach ($row as $x => $c) {
        imagesetpixel($small, $x, $y, self::color($small, $c));
      }
    }
    $image = imagecreatetruecolor(self::W, self::H);
    imagecopyresampled($image, $small, 0, 0, 0, 0, self::W, self::H, imagesx($small), imagesy($small));
    imagealphablending($image, TRUE);
    return $image;
  }

  /**
   * The colours the field is painted from, by row and column.
   *
   * @return list<list<array{0: float, 1: float, 2: float}>>
   *   150 × 79 colours.
   */
  private static function painted(array $theme): array {
    [$sw, $sh] = [150, 79];
    $light = $theme['dark'] ? [255, 255, 255] : [255, 255, 245];
    $grid = [];
    for ($y = 0; $y < $sh; $y++) {
      for ($x = 0; $x < $sw; $x++) {
        $c = self::mix($theme['top'], $theme['bottom'], 0.35 * $x / $sw + 0.65 * $y / $sh);
        $d = hypot(($x - $sw * 0.5) / $sw, ($y + $sh * 0.15) / $sh * 0.9);
        $grid[$y][$x] = self::mix($c, $light, max(0, self::GLOW - 0.096 * $d));
      }
    }
    return $grid;
  }

  /**
   * The darkest and the lightest colour any pixel of the field can have.
   *
   * Channel by channel over the painted colours, one step wider for the
   * rounding of painting and resampling: a resampled pixel is a weighted
   * mean of painted ones, so every pixel of the field, its corners
   * included, lies between the two, and so does its luminance.
   *
   * @return array{0: array, 1: array}
   *   [darkest, lightest] as [r, g, b].
   */
  public static function fieldRange(array $theme): array {
    $low = [255, 255, 255];
    $high = [0, 0, 0];
    foreach (self::painted($theme) as $row) {
      foreach ($row as $c) {
        foreach ([0, 1, 2] as $i) {
          $low[$i] = min($low[$i], (int) round($c[$i]));
          $high[$i] = max($high[$i], (int) round($c[$i]));
        }
      }
    }
    return [
      array_map(static fn (int $v): int => max(0, $v - 1), $low),
      array_map(static fn (int $v): int => min(255, $v + 1), $high),
    ];
  }

  /**
   * The WCAG contrast ratio of two colours.
   */
  public static function contrast(array $a, array $b): float {
    [$x, $y] = [self::luminance($a), self::luminance($b)];
    return (max($x, $y) + 0.05) / (min($x, $y) + 0.05);
  }

  /**
   * A "#RRGGBB" colour as [r, g, b].
   */
  public static function rgb(string $hex): array {
    $hex = ltrim($hex, '#');
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
  }

  /**
   * A colour [r, g, b] as "#RRGGBB".
   */
  public static function hex(array $rgb): string {
    return sprintf('#%02X%02X%02X', ...array_map(static fn (float|int $v): int => max(0, min(255, (int) round($v))), $rgb));
  }

  /**
   * The hue, saturation and lightness, each 0–1, of [r, g, b].
   */
  public static function hsl(array $rgb): array {
    [$r, $g, $b] = array_map(static fn (float|int $v): float => $v / 255, $rgb);
    $max = max($r, $g, $b);
    $min = min($r, $g, $b);
    $l = ($max + $min) / 2;
    if ($max === $min) {
      return [0.0, 0.0, $l];
    }
    $d = $max - $min;
    $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);
    $h = match ($max) {
      $r => ($g - $b) / $d + ($g < $b ? 6 : 0),
      $g => ($b - $r) / $d + 2,
      default => ($r - $g) / $d + 4,
    };
    return [$h / 6, $s, $l];
  }

  /**
   * A colour between two others.
   */
  public static function mix(array $a, array $b, float $t): array {
    return [$a[0] + ($b[0] - $a[0]) * $t, $a[1] + ($b[1] - $a[1]) * $t, $a[2] + ($b[2] - $a[2]) * $t];
  }

  /**
   * A GD colour of [r, g, b] at an opacity.
   */
  public static function color(\GdImage $image, array $rgb, float $opacity = 1.0): int {
    return imagecolorallocatealpha($image, (int) round($rgb[0]), (int) round($rgb[1]), (int) round($rgb[2]), (int) round(127 * (1 - $opacity)));
  }

  /**
   * A transparent true colour canvas that blends what is drawn on it.
   */
  public static function canvas(int $w, int $h): \GdImage {
    $image = imagecreatetruecolor($w, $h);
    imagealphablending($image, FALSE);
    imagesavealpha($image, TRUE);
    imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
    imagealphablending($image, TRUE);
    return $image;
  }

  /**
   * Whether an image's edge has transparent pixels.
   */
  public static function hasAlpha(\GdImage $image): bool {
    foreach (self::edge($image) as [$x, $y]) {
      if (((imagecolorat($image, $x, $y) >> 24) & 0x7F) > 8) {
        return TRUE;
      }
    }
    return FALSE;
  }

  /**
   * The 256 points along an image's edge that are sampled.
   *
   * @return list<array{0: int, 1: int}>
   *   [x, y].
   */
  public static function edge(\GdImage $image): array {
    [$w, $h] = [imagesx($image), imagesy($image)];
    $points = [];
    for ($i = 0; $i < 64; $i++) {
      $x = (int) ($i * ($w - 1) / 63);
      $y = (int) ($i * ($h - 1) / 63);
      array_push($points, [$x, 0], [$x, $h - 1], [0, $y], [$w - 1, $y]);
    }
    return $points;
  }

  /**
   * The mean colour of an image's opaque pixels, or NULL.
   */
  public static function meanOpaque(\GdImage $image): ?array {
    $small = self::canvas(16, 16);
    imagealphablending($small, FALSE);
    imagecopyresampled($small, $image, 0, 0, 0, 0, 16, 16, imagesx($image), imagesy($image));
    $pixels = [];
    for ($y = 0; $y < 16; $y++) {
      for ($x = 0; $x < 16; $x++) {
        $c = imagecolorat($small, $x, $y);
        if ((($c >> 24) & 0x7F) <= 64) {
          $pixels[] = [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
        }
      }
    }
    return $pixels ? self::mean($pixels) : NULL;
  }

  /**
   * Anti-aliased rounded corners, as transparency.
   */
  public static function roundCorners(\GdImage $image, float $r): void {
    [$w, $h] = [imagesx($image), imagesy($image)];
    imagealphablending($image, FALSE);
    imagesavealpha($image, TRUE);
    $ri = (int) ceil($r);
    $corners = [
      [0, 0, $r, $r],
      [$w - $ri, 0, $w - $r, $r],
      [0, $h - $ri, $r, $h - $r],
      [$w - $ri, $h - $ri, $w - $r, $h - $r],
    ];
    foreach ($corners as [$x0, $y0, $cx, $cy]) {
      for ($y = $y0; $y < $y0 + $ri; $y++) {
        for ($x = $x0; $x < $x0 + $ri; $x++) {
          $outX = $x0 === 0 ? $x + 0.5 < $cx : $x + 0.5 > $cx;
          $outY = $y0 === 0 ? $y + 0.5 < $cy : $y + 0.5 > $cy;
          if (!$outX || !$outY || $x < 0 || $y < 0 || $x >= $w || $y >= $h) {
            continue;
          }
          $cover = max(0.0, min(1.0, $r - hypot($x + 0.5 - $cx, $y + 0.5 - $cy) + 0.5));
          $c = imagecolorat($image, $x, $y);
          $alpha = 127 - (int) round((127 - (($c >> 24) & 0x7F)) * $cover);
          imagesetpixel($image, $x, $y, ($c & 0xFFFFFF) | ($alpha << 24));
        }
      }
    }
    imagealphablending($image, TRUE);
  }

  /**
   * The logo trimmed to what it draws.
   *
   * A transparent logo keeps the box of pixels with GD alpha up to 120; a
   * logo on a plain light canvas the box of pixels further than RGB 24 from
   * its corner colour. A full-bleed opaque logo (an app tile) stays whole.
   */
  public static function trim(\GdImage $logo): \GdImage {
    [$w, $h] = [imagesx($logo), imagesy($logo)];
    $alpha = self::hasAlpha($logo);
    $c0 = imagecolorat($logo, 0, 0);
    $corner = [($c0 >> 16) & 255, ($c0 >> 8) & 255, $c0 & 255];
    if (!$alpha && self::hsl($corner)[2] < 0.9) {
      return $logo;
    }
    [$x0, $y0, $x1, $y1] = [$w, $h, -1, -1];
    $step = max(1, intdiv(max($w, $h), 400));
    for ($y = 0; $y < $h; $y += $step) {
      for ($x = 0; $x < $w; $x += $step) {
        $c = imagecolorat($logo, $x, $y);
        $drawn = $alpha
          ? (($c >> 24) & 0x7F) <= 120
          : sqrt(((($c >> 16) & 255) - $corner[0]) ** 2 + ((($c >> 8) & 255) - $corner[1]) ** 2 + (($c & 255) - $corner[2]) ** 2) > 24;
        if ($drawn) {
          [$x0, $y0, $x1, $y1] = [min($x0, $x), min($y0, $y), max($x1, $x), max($y1, $y)];
        }
      }
    }
    if ($x1 < 0) {
      return $logo;
    }
    [$x0, $y0] = [max(0, $x0 - $step), max(0, $y0 - $step)];
    [$x1, $y1] = [min($w - 1, $x1 + $step), min($h - 1, $y1 + $step)];
    $trimmed = self::canvas($x1 - $x0 + 1, $y1 - $y0 + 1);
    imagealphablending($trimmed, FALSE);
    imagecopy($trimmed, $logo, 0, 0, $x0, $y0, $x1 - $x0 + 1, $y1 - $y0 + 1);
    imagealphablending($trimmed, TRUE);
    return $trimmed;
  }

  /**
   * The logo as a mark $size px tall, or NULL.
   *
   * Measured on its trimmed box: opaque and not wide, an app-icon tile with
   * 22% corners and a hairline ring; transparent and one colour, tinted to
   * the text colour; transparent, multicolour and under 3:1 against the
   * field, on a white plate; over 2.2:1, a wordmark drawn alone. No logo:
   * the name's first letter on a tile, or nothing when it can't be drawn.
   *
   * @return array{image: \GdImage, w: int, h: int, wordmark: bool, kind: string}|null
   *   The mark and how it was made.
   */
  public static function mark(?\GdImage $logo, int $size, array $theme, string $siteName): ?array {
    if (!$logo) {
      return self::monogram($size, $theme, $siteName);
    }
    $logo = self::trim($logo);
    [$sw, $sh] = [imagesx($logo), imagesy($logo)];
    $ratio = $sw / $sh;
    $wordmark = $ratio > 2.2;
    $alpha = self::hasAlpha($logo);
    $kind = $alpha ? 'transparent' : 'tile';
    if ($alpha && self::singleColour($logo)) {
      $logo = self::tint($logo, $theme['fg']);
      $kind = 'tinted';
    }
    $colour = self::pickColour($logo) ?? self::meanOpaque($logo);
    $plate = $kind === 'transparent' && $colour !== NULL && self::contrast($colour, self::mix($theme['top'], $theme['bottom'], 0.5)) < 3.0;
    $kind = $plate ? 'plate' : $kind;
    $h = $wordmark ? (int) round($size * 0.82) : $size;
    $w = (int) round($wordmark ? min($h * $ratio, $size * 7) : $h * min(max($ratio, 0.6), 1.6));
    // A plated wordmark gets a pill padded 0.30 × its height; a plated mark
    // stays inside its square box with 16% padding.
    $pad = $plate ? (int) round($h * ($wordmark ? 0.30 : 0.16)) : 0;
    if ($plate && !$wordmark) {
      [$w, $h] = [$w - 2 * $pad, $h - 2 * $pad];
    }
    [$boxW, $boxH] = [$w + 2 * $pad, $h + 2 * $pad];
    $mark = self::canvas($boxW, $boxH);
    if ($plate) {
      imagefilledrectangle($mark, 0, 0, $boxW, $boxH, self::color($mark, self::WHITE));
    }
    if (!$wordmark && $alpha) {
      // A transparent mark keeps its own ratio inside the box.
      $r = min($w / $sw, $h / $sh);
      [$dw, $dh] = [(int) round($sw * $r), (int) round($sh * $r)];
      imagecopyresampled($mark, $logo, $pad + intdiv($w - $dw, 2), $pad + intdiv($h - $dh, 2), 0, 0, $dw, $dh, $sw, $sh);
    }
    else {
      imagecopyresampled($mark, $logo, $pad, $pad, 0, 0, $w, $h, $sw, $sh);
    }
    if ($plate || !$alpha) {
      self::roundCorners($mark, min($boxW, $boxH) * ($wordmark ? 0.5 : 0.22));
      if (!$alpha && !$wordmark) {
        self::ring($mark, min($boxW, $boxH) * 0.22, $theme['dark'] ? self::WHITE : [0, 0, 0], 0.26);
      }
    }
    return ['image' => $mark, 'w' => $boxW, 'h' => $boxH, 'wordmark' => $wordmark, 'kind' => $kind];
  }

  /**
   * The Site name's first letter on a tile, or NULL when it can't be drawn.
   */
  private static function monogram(int $size, array $theme, string $siteName): ?array {
    $letter = mb_strtoupper(ShareText::graphemes(ShareText::clean($siteName))[0] ?? '');
    $tokens = $letter === '' ? NULL : ShareText::tokens($letter, 'title');
    if (!$tokens) {
      return NULL;
    }
    $tile = imagecreatetruecolor($size, $size);
    imagefill($tile, 0, 0, self::color($tile, $theme['tile']));
    $px = $size * 0.5;
    $box = imagettfbbox($px * 0.75, 0, ShareText::file('title'), 'H');
    ShareLayout::draw($tile, $tokens, $px, 0, 'L', $size / 2, ($size + $box[1] - $box[7]) / 2, self::color($tile, $theme['tileInk']));
    self::roundCorners($tile, $size * 0.22);
    return ['image' => $tile, 'w' => $size, 'h' => $size, 'wordmark' => FALSE, 'kind' => 'monogram'];
  }

  /**
   * The logo and Site name centred at the top, mirrored right to left.
   *
   * @return array{0: string, 1: array{mark: ?int, name: ?int}}
   *   How the mark was drawn (a mark() kind, or 'none'), and where the mark
   *   and the name start, NULL for one not drawn.
   */
  private static function brandRow(\GdImage $image, array $input, array $theme, int $top): array {
    $logo = $input['logo']['image'] ?? NULL;
    $name = ShareText::clean((string) ($input['site_name'] ?? ''));
    $mark = self::mark($logo, 52, $theme, $name);
    if ($mark && $mark['wordmark']) {
      $mark = self::mark($logo, 50, $theme, $name);
      $x = (int) round((self::W - $mark['w']) / 2);
      imagecopy($image, $mark['image'], $x, (int) round($top + (52 - $mark['h']) / 2), 0, 0, $mark['w'], $mark['h']);
      return [$mark['kind'], ['mark' => $x, 'name' => NULL]];
    }
    $fit = $name === '' ? NULL : ShareLayout::brandName($name);
    $markW = $mark['w'] ?? 0;
    $nameW = $fit ? ShareLayout::lineWidth($fit['lines'][0], $fit['px'], $fit['space']) : 0;
    $total = $markW + ($fit && $mark ? 16 : 0) + $nameW;
    $x = (self::W - $total) / 2;
    $rtl = ($input['dir'] ?? 'L') === 'R';
    $at = ['mark' => $mark ? (int) round($rtl ? $x + $total - $markW : $x) : NULL, 'name' => NULL];
    if ($mark) {
      imagecopy($image, $mark['image'], $at['mark'], $top, 0, 0, $mark['w'], $mark['h']);
    }
    if ($fit) {
      $para = ShareText::direction($name);
      $at['name'] = (int) round($rtl || !$mark ? $x : $x + $markW + 16);
      ShareLayout::draw($image, $fit['lines'][0], $fit['px'], $fit['space'], $para === 'N' ? 'L' : $para, $at['name'], $top + ($mark['h'] ?? 52) / 2 + 0.727 * $fit['px'] / 2, self::color($image, $theme['fg']), 'left');
    }
    return [$mark['kind'] ?? 'none', $at];
  }

  /**
   * The text colour, the small text's colour and the measured contrast.
   *
   * Measured against the field's darkest and lightest possible colours
   * (fieldRange()), so the contrast holds on every pixel, corners included.
   * Small text is solid: the text colour at an opacity over the field's
   * colour nearest to it, which is the lowest contrast it has anywhere.
   *
   * @return array{0: array, 1: \Closure(float): array, 2: array{title: float, small: float, small_opacity: float}}
   *   [fg, the small text's colour at an opacity, contrast].
   */
  private static function ink(array $theme): array {
    $fg = $theme['fg'];
    $range = self::fieldRange($theme);
    $lowest = static fn (array $colour): float => min(self::contrast($colour, $range[0]), self::contrast($colour, $range[1]));
    // The field's colour nearest to the text: the darkest under dark ink.
    $nearest = $range[self::luminance($fg) > self::luminance($range[1]) ? 1 : 0];
    $small = static fn (float $opacity): array => self::mix($nearest, $fg, $opacity);
    $muted = 1.0;
    for ($opacity = 0.70; $opacity < 1.0; $opacity += 0.02) {
      if ($lowest($small($opacity)) >= self::SMALL_CONTRAST) {
        $muted = round($opacity, 2);
        break;
      }
    }
    return [$fg, $small, [
      'title' => round($lowest($fg), 2),
      'small' => round($lowest($small($muted)), 2),
      'small_opacity' => $muted,
    ],
    ];
  }

  /**
   * The colour facts of a theme, for tests and the status report.
   */
  private static function themeInfo(array $theme): array {
    return [
      'field' => [self::hex($theme['top']), self::hex($theme['bottom'])],
      'centre' => $theme['centre'] ? self::hex($theme['centre']) : NULL,
      'text' => self::hex($theme['fg']),
    ];
  }

  /**
   * The brand colour: the stored one, else the logo's, else NULL.
   */
  private static function brand(array $input): ?array {
    $stored = (string) ($input['colour'] ?? '');
    if (preg_match('/^#[0-9A-Fa-f]{6}$/D', $stored)) {
      return self::rgb($stored);
    }
    return $input['logo']['colour'] ?? NULL;
  }

  /**
   * Whether a real path lies inside one of some folders.
   */
  private static function inside(string $real, array $folders): bool {
    foreach ($folders as $folder) {
      $folder = realpath($folder);
      if ($folder !== FALSE && str_starts_with($real, rtrim($folder, '/') . '/')) {
        return TRUE;
      }
    }
    return FALSE;
  }

  /**
   * Whether 90% of the opaque pixels are within RGB 40 of their mean.
   */
  private static function singleColour(\GdImage $image): bool {
    $small = self::canvas(48, 48);
    imagealphablending($small, FALSE);
    imagecopyresampled($small, $image, 0, 0, 0, 0, 48, 48, imagesx($image), imagesy($image));
    $pixels = [];
    for ($y = 0; $y < 48; $y++) {
      for ($x = 0; $x < 48; $x++) {
        $c = imagecolorat($small, $x, $y);
        if ((($c >> 24) & 0x7F) <= 32) {
          $pixels[] = [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
        }
      }
    }
    if (!$pixels) {
      return FALSE;
    }
    $mean = self::mean($pixels);
    $near = count(array_filter($pixels, static fn (array $p): bool => sqrt(($p[0] - $mean[0]) ** 2 + ($p[1] - $mean[1]) ** 2 + ($p[2] - $mean[2]) ** 2) <= 40));
    return $near / count($pixels) >= 0.9;
  }

  /**
   * Every pixel in one colour, alpha kept.
   */
  private static function tint(\GdImage $image, array $rgb): \GdImage {
    [$w, $h] = [imagesx($image), imagesy($image)];
    $tinted = self::canvas($w, $h);
    imagealphablending($tinted, FALSE);
    imagecopy($tinted, $image, 0, 0, 0, 0, $w, $h);
    // Black, then the colour added: GD's filters keep each pixel's alpha.
    imagefilter($tinted, IMG_FILTER_BRIGHTNESS, -255);
    imagefilter($tinted, IMG_FILTER_COLORIZE, (int) $rgb[0], (int) $rgb[1], (int) $rgb[2], 0);
    imagealphablending($tinted, TRUE);
    return $tinted;
  }

  /**
   * A 1.5 px inner ring along a rounded square.
   *
   * A tile in the field's own colour keeps an edge.
   */
  private static function ring(\GdImage $image, float $r, array $rgb, float $opacity): void {
    [$w, $h] = [imagesx($image), imagesy($image)];
    imagealphablending($image, TRUE);
    for ($y = 0; $y < $h; $y++) {
      for ($x = 0; $x < $w; $x++) {
        [$px, $py] = [$x + 0.5, $y + 0.5];
        $qx = max(abs($px - $w / 2) - ($w / 2 - $r), 0);
        $qy = max(abs($py - $h / 2) - ($h / 2 - $r), 0);
        $dist = ($qx <= 0 && $qy <= 0) ? min($px, $py, $w - $px, $h - $py) : $r - hypot($qx, $qy);
        $cover = max(0.0, min(1.0, 1.5 - abs($dist - 0.75))) * $opacity;
        if ($cover > 0.01 && $dist >= 0) {
          imagesetpixel($image, $x, $y, self::color($image, $rgb, $cover));
        }
      }
    }
  }

  /**
   * The mean of some colours.
   */
  private static function mean(array $pixels): array {
    $sum = [0, 0, 0];
    foreach ($pixels as $p) {
      $sum = [$sum[0] + $p[0], $sum[1] + $p[1], $sum[2] + $p[2]];
    }
    return array_map(static fn (int|float $v): float => $v / count($pixels), $sum);
  }

  /**
   * The relative luminance of a colour.
   */
  private static function luminance(array $rgb): float {
    $f = static function (float $v): float {
      $v /= 255;
      return $v <= 0.03928 ? $v / 12.92 : (($v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * $f($rgb[0]) + 0.7152 * $f($rgb[1]) + 0.0722 * $f($rgb[2]);
  }

  /**
   * The colour [r, g, b] of a hue, saturation and lightness, each 0–1.
   */
  private static function rgbFromHsl(float $h, float $s, float $l): array {
    if ($s <= 0.0) {
      return [$l * 255, $l * 255, $l * 255];
    }
    $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
    $p = 2 * $l - $q;
    $t = static function (float $t) use ($p, $q): float {
      $t += $t < 0 ? 1 : ($t > 1 ? -1 : 0);
      return match (TRUE) {
        $t < 1 / 6 => $p + ($q - $p) * 6 * $t,
        $t < 1 / 2 => $q,
        $t < 2 / 3 => $p + ($q - $p) * (2 / 3 - $t) * 6,
        default => $p,
      };
    };
    return [$t($h + 1 / 3) * 255, $t($h) * 255, $t($h - 1 / 3) * 255];
  }

}
