<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\ShareText;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;

// cspell:ignore cmap licences subtables
/**
 * The bundled fonts the share cards are drawn with.
 *
 * Design D14: only the faces in use, one OFL licence per family with its own
 * notice, about 1 MB in all; fonts/build.sh made them and their coverage
 * files.
 */
#[CoversClass(ShareText::class)]
#[Group('canvas_metatag')]
final class FontsTest extends UnitTestCase {

  /**
   * The families, each with a licence file.
   */
  private const FAMILIES = ['Inter', 'NotoSansArabic', 'NotoSansHebrew', 'NotoEmoji'];

  /**
   * Each face's font file loads in GD and draws.
   */
  #[RequiresFunction('imagettftext')]
  public function testFacesLoad(): void {
    foreach (array_keys(ShareText::FACES) as $face) {
      $box = imagettfbbox(20, 0, ShareText::file($face), $face === 'symbols' ? '★' : 'Hx');
      self::assertIsArray($box, $face);
      self::assertGreaterThan(0, $box[2] - $box[0], $face);
    }
  }

  /**
   * Every font belongs to a family with an OFL licence file and its notice.
   */
  public function testLicences(): void {
    $fonts = glob(ShareText::dir() . '/*.ttf');
    self::assertCount(count(ShareText::FACES), $fonts);
    foreach ($fonts as $font) {
      $family = preg_replace('/^(InterDisplay|Inter)$/', 'Inter', explode('-', basename($font))[0]);
      self::assertContains($family, self::FAMILIES, basename($font));
    }
    foreach (self::FAMILIES as $family) {
      $licence = (string) file_get_contents(ShareText::dir() . "/$family-OFL.txt");
      // The family's own copyright notice comes first.
      self::assertMatchesRegularExpression('/^Copyright (\(c\) )?\d{4} \S.+$/m', strtok($licence, "\n"), $family);
      self::assertStringContainsString('SIL OPEN FONT LICENSE Version 1.1', $licence);
    }
  }

  /**
   * The fonts stay under 1.5 MB together.
   */
  public function testSize(): void {
    $total = array_sum(array_map('filesize', glob(ShareText::dir() . '/*.ttf')));
    self::assertLessThan(1.5 * 1024 * 1024, $total);
  }

  /**
   * The coverage files are what the fonts draw.
   *
   * Reads each font's character map (the platform 3 subtables, Unicode BMP
   * and full repertoire, formats 4 and 12) and compares the ranges with the
   * committed file. A test-only reader: nothing parses a font at runtime.
   */
  public function testCoverageIsCurrent(): void {
    foreach (ShareText::FACES as [$name]) {
      $committed = json_decode((string) file_get_contents(ShareText::dir() . "/$name.json"), TRUE);
      self::assertSame(self::ranges(self::cmap(ShareText::dir() . "/$name.ttf")), $committed, "$name.json is out of date: run fonts/build.sh.");
    }
  }

  /**
   * The code points a TrueType font maps to a glyph.
   *
   * @return list<int>
   *   Sorted.
   */
  private static function cmap(string $file): array {
    $data = (string) file_get_contents($file);
    $u16 = static fn (int $at): int => unpack('n', $data, $at)[1];
    $u32 = static fn (int $at): int => unpack('N', $data, $at)[1];
    $cmap = NULL;
    for ($i = 0, $n = $u16(4); $i < $n; $i++) {
      if (substr($data, 12 + 16 * $i, 4) === 'cmap') {
        $cmap = $u32(12 + 16 * $i + 8);
      }
    }
    $best = NULL;
    for ($i = 0, $n = $u16($cmap + 2); $i < $n; $i++) {
      $record = $cmap + 4 + 8 * $i;
      [$platform, $encoding, $at] = [$u16($record), $u16($record + 2), $cmap + $u32($record + 4)];
      $format = $u16($at);
      if ($format === 12 && $platform === 3 && $encoding === 10) {
        $best = [12, $at];
        break;
      }
      if ($format === 4 && $platform === 3 && $encoding === 1) {
        $best = [4, $at];
      }
    }
    [$format, $at] = $best;
    $points = [];
    if ($format === 12) {
      for ($g = 0, $n = $u32($at + 12); $g < $n; $g++) {
        $group = $at + 16 + 12 * $g;
        $glyph = $u32($group + 8);
        for ($cp = $u32($group), $end = $u32($group + 4); $cp <= $end; $cp++, $glyph++) {
          if ($glyph) {
            $points[] = $cp;
          }
        }
      }
      return $points;
    }
    $segments = $u16($at + 6) / 2;
    $ends = $at + 14;
    $starts = $ends + 2 * $segments + 2;
    $deltas = $starts + 2 * $segments;
    $offsets = $deltas + 2 * $segments;
    for ($s = 0; $s < $segments; $s++) {
      [$end, $start] = [$u16($ends + 2 * $s), $u16($starts + 2 * $s)];
      [$delta, $offset] = [$u16($deltas + 2 * $s), $u16($offsets + 2 * $s)];
      for ($cp = $start; $cp <= $end && $cp !== 0xFFFF; $cp++) {
        $glyph = $offset === 0 ? ($cp + $delta) & 0xFFFF : $u16($offsets + 2 * $s + $offset + 2 * ($cp - $start));
        if ($offset !== 0 && $glyph) {
          $glyph = ($glyph + $delta) & 0xFFFF;
        }
        if ($glyph) {
          $points[] = $cp;
        }
      }
    }
    sort($points);
    return $points;
  }

  /**
   * Sorted code points as merged [first, last] ranges.
   */
  private static function ranges(array $points): array {
    $ranges = [];
    foreach ($points as $cp) {
      if ($ranges && $ranges[array_key_last($ranges)][1] === $cp - 1) {
        $ranges[array_key_last($ranges)][1] = $cp;
      }
      else {
        $ranges[] = [$cp, $cp];
      }
    }
    return $ranges;
  }

}
