<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

// cspell:ignore harakat alef keycap neighbours segs
/**
 * Text as the share images draw it: cleaned, covered, shaped and ordered.
 *
 * GD with FreeType draws glyph by glyph: it has no font fallback, no shaping
 * and no bidirectional ordering, it reads UTF-8 only up to three bytes, and
 * it decodes "&#N;" in any string. This class does what it lacks, with the
 * bundled fonts in fonts/ (fonts/build.sh). Which code points each font
 * draws is read from the coverage files the build writes; nothing parses a
 * font at runtime.
 *
 * A token is one word: ['text' => logical text, 'dir' => 'L', 'R' or 'N',
 * 'segs' => list of [face, text in visual order]], each segment drawn with
 * one face.
 *
 * @internal
 */
final class ShareText {

  /**
   * The faces: name => [font file without extension, scale].
   *
   * The scale matches a face's apparent size to the Latin title face.
   */
  public const FACES = [
    'title' => ['InterDisplay-SemiBold', 1.0],
    'ui' => ['Inter-SemiBold', 1.0],
    'body' => ['Inter-Regular', 1.0],
    'arabic' => ['NotoSansArabic-SemiBold', 0.94],
    'hebrew' => ['NotoSansHebrew-SemiBold', 0.98],
    'symbols' => ['NotoEmoji-SemiBold-BMP', 0.86],
  ];

  /**
   * The longest text, in characters, that is set.
   */
  public const MAX = 300;

  /**
   * Contextual forms: letter => [isolated, final, initial, medial].
   *
   * From the Arabic Presentation Forms blocks. A letter with two forms does
   * not join the next one.
   */
  private const FORMS = [
    0x0621 => [0xFE80],
    0x0622 => [0xFE81, 0xFE82],
    0x0623 => [0xFE83, 0xFE84],
    0x0624 => [0xFE85, 0xFE86],
    0x0625 => [0xFE87, 0xFE88],
    0x0626 => [0xFE89, 0xFE8A, 0xFE8B, 0xFE8C],
    0x0627 => [0xFE8D, 0xFE8E],
    0x0628 => [0xFE8F, 0xFE90, 0xFE91, 0xFE92],
    0x0629 => [0xFE93, 0xFE94],
    0x062A => [0xFE95, 0xFE96, 0xFE97, 0xFE98],
    0x062B => [0xFE99, 0xFE9A, 0xFE9B, 0xFE9C],
    0x062C => [0xFE9D, 0xFE9E, 0xFE9F, 0xFEA0],
    0x062D => [0xFEA1, 0xFEA2, 0xFEA3, 0xFEA4],
    0x062E => [0xFEA5, 0xFEA6, 0xFEA7, 0xFEA8],
    0x062F => [0xFEA9, 0xFEAA],
    0x0630 => [0xFEAB, 0xFEAC],
    0x0631 => [0xFEAD, 0xFEAE],
    0x0632 => [0xFEAF, 0xFEB0],
    0x0633 => [0xFEB1, 0xFEB2, 0xFEB3, 0xFEB4],
    0x0634 => [0xFEB5, 0xFEB6, 0xFEB7, 0xFEB8],
    0x0635 => [0xFEB9, 0xFEBA, 0xFEBB, 0xFEBC],
    0x0636 => [0xFEBD, 0xFEBE, 0xFEBF, 0xFEC0],
    0x0637 => [0xFEC1, 0xFEC2, 0xFEC3, 0xFEC4],
    0x0638 => [0xFEC5, 0xFEC6, 0xFEC7, 0xFEC8],
    0x0639 => [0xFEC9, 0xFECA, 0xFECB, 0xFECC],
    0x063A => [0xFECD, 0xFECE, 0xFECF, 0xFED0],
    0x0640 => [0x0640, 0x0640, 0x0640, 0x0640],
    0x0641 => [0xFED1, 0xFED2, 0xFED3, 0xFED4],
    0x0642 => [0xFED5, 0xFED6, 0xFED7, 0xFED8],
    0x0643 => [0xFED9, 0xFEDA, 0xFEDB, 0xFEDC],
    0x0644 => [0xFEDD, 0xFEDE, 0xFEDF, 0xFEE0],
    0x0645 => [0xFEE1, 0xFEE2, 0xFEE3, 0xFEE4],
    0x0646 => [0xFEE5, 0xFEE6, 0xFEE7, 0xFEE8],
    0x0647 => [0xFEE9, 0xFEEA, 0xFEEB, 0xFEEC],
    0x0648 => [0xFEED, 0xFEEE],
    0x0649 => [0xFEEF, 0xFEF0],
    0x064A => [0xFEF1, 0xFEF2, 0xFEF3, 0xFEF4],
    // The four common Persian letters.
    0x067E => [0xFB56, 0xFB57, 0xFB58, 0xFB59],
    0x0686 => [0xFB7A, 0xFB7B, 0xFB7C, 0xFB7D],
    0x0698 => [0xFB8A, 0xFB8B],
    0x06A9 => [0xFB8E, 0xFB8F, 0xFB90, 0xFB91],
    0x06AF => [0xFB92, 0xFB93, 0xFB94, 0xFB95],
    0x06CC => [0xFBFC, 0xFBFD, 0xFBFE, 0xFBFF],
  ];

  /**
   * Lam followed by an alef: alef => [isolated, final] ligature.
   */
  private const LAM_ALEF = [
    0x0622 => [0xFEF5, 0xFEF6],
    0x0623 => [0xFEF7, 0xFEF8],
    0x0625 => [0xFEF9, 0xFEFA],
    0x0627 => [0xFEFB, 0xFEFC],
  ];

  /**
   * The fonts folder.
   */
  public static function dir(): string {
    return dirname(__DIR__) . '/fonts';
  }

  /**
   * A face's font file.
   */
  public static function file(string $face): string {
    return self::dir() . '/' . self::FACES[$face][0] . '.ttf';
  }

  /**
   * Whether a face draws a code point, from its coverage file.
   */
  public static function covers(string $face, int $cp): bool {
    static $ranges = [];
    $list = $ranges[$face] ??= json_decode((string) file_get_contents(self::dir() . '/' . self::FACES[$face][0] . '.json'), TRUE, 4, JSON_THROW_ON_ERROR);
    [$low, $high] = [0, count($list) - 1];
    while ($low <= $high) {
      $mid = intdiv($low + $high, 2);
      if ($cp < $list[$mid][0]) {
        $high = $mid - 1;
      }
      elseif ($cp > $list[$mid][1]) {
        $low = $mid + 1;
      }
      else {
        return TRUE;
      }
    }
    return FALSE;
  }

  /**
   * The face that draws a code point, or NULL when no bundled font does.
   *
   * Arabic letters always come from the Arabic face, so a word is drawn in
   * one face; anything else from the primary face first.
   */
  public static function faceFor(int $cp, string $primary): ?string {
    if (self::isArabic($cp) && self::covers('arabic', $cp)) {
      return 'arabic';
    }
    foreach ([$primary, 'hebrew', 'arabic', 'symbols'] as $face) {
      if (self::covers($face, $cp)) {
        return $face;
      }
    }
    return NULL;
  }

  /**
   * The text a share image draws.
   *
   * Cut to 300 characters; controls, zero-width characters and direction
   * marks removed (the layout orders words itself). Every grapheme with a
   * character above U+FFFF, a joiner or a keycap is left out, with a
   * separator it leaves dangling: GD cannot read it. Basic-plane symbols
   * stay, drawn from the symbol face.
   */
  public static function clean(string $text): string {
    $text = (string) preg_replace('/[\x{00AD}\x{2060}]/u', '', mb_substr($text, 0, self::MAX));
    // A zero-width non-joiner stays: in Persian it is part of the word, and
    // it stops the letters around it joining.
    $text = (string) preg_replace('/[\x{0000}-\x{001F}\x{007F}-\x{009F}\x{200B}\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u', ' ', $text);
    $out = '';
    foreach (self::graphemes($text) as $grapheme) {
      $out .= preg_match('/[\x{10000}-\x{10FFFF}\x{200D}\x{20E3}]/u', $grapheme) ? ' ' : preg_replace('/[\x{FE0E}\x{FE0F}]/u', '', $grapheme);
    }
    $out = (string) preg_replace('/\s+/u', ' ', $out);
    $out = (string) preg_replace('/\s+([,.;:!?…)\]])/u', '$1', $out);
    $out = (string) preg_replace('/([(\[])\s+/u', '$1', $out);
    // Two separators in a row where an emoji stood: the first stays.
    $out = (string) preg_replace('/(\s[\-–—|·:])(\s[\-–—|·:])+(?=\s)/u', '$1', $out);
    return trim((string) preg_replace('/^[\s\-–—|·:,;]+|[\s\-–—|·:,;]+$/u', '', $out));
  }

  /**
   * The graphemes of a text.
   *
   * @return list<string>
   *   In order.
   */
  public static function graphemes(string $text): array {
    return preg_split('/(\X)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [];
  }

  /**
   * The direction of a text's first strong letter: 'L', 'R' or 'N'.
   */
  public static function direction(string $text): string {
    foreach (mb_str_split($text) as $char) {
      if (preg_match('/\p{L}/u', $char)) {
        return self::isRtl(mb_ord($char)) ? 'R' : 'L';
      }
    }
    return 'N';
  }

  /**
   * An Arabic word in its presentation forms, in logical order.
   *
   * Harakat are dropped: without positioning they would not sit on their
   * letter.
   */
  public static function shapeArabic(string $word): string {
    $cps = array_values(array_filter(array_map('mb_ord', mb_str_split($word)), static fn (int $cp): bool => !($cp >= 0x064B && $cp <= 0x065F) && $cp !== 0x0670));
    $joinsNext = static fn (int $cp): bool => count(self::FORMS[$cp] ?? []) === 4;
    $out = [];
    for ($i = 0, $n = count($cps); $i < $n; $i++) {
      $cp = $cps[$i];
      if (!isset(self::FORMS[$cp])) {
        $out[] = $cp;
        continue;
      }
      $prev = $i > 0 && $joinsNext($cps[$i - 1]);
      if ($cp === 0x0644 && isset($cps[$i + 1], self::LAM_ALEF[$cps[$i + 1]])) {
        $out[] = self::LAM_ALEF[$cps[++$i]][$prev ? 1 : 0];
        continue;
      }
      $next = $i + 1 < $n && isset(self::FORMS[$cps[$i + 1]]);
      $form = match (TRUE) {
        $prev && $next && $joinsNext($cp) => 3,
        $prev => 1,
        $next && $joinsNext($cp) => 2,
        default => 0,
      };
      $out[] = self::FORMS[$cp][min($form, count(self::FORMS[$cp]) - 1)];
    }
    return implode('', array_map('mb_chr', $out));
  }

  /**
   * A text as tokens, or NULL when a bundled font cannot draw a character.
   *
   * Right-to-left words are reversed by grapheme with numbers kept and
   * brackets mirrored, so each token's segments are in visual order.
   *
   * @return list<array{text: string, dir: string, segs: list<array{0: string, 1: string}>}>|null
   *   One token per word.
   */
  public static function tokens(string $text, string $primary): ?array {
    $tokens = [];
    foreach (preg_split('/ /u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $word) {
      $dir = self::direction($word);
      $draw = preg_match('/[\x{0600}-\x{06FF}]/u', $word) ? self::shapeArabic($word) : $word;
      if ($dir === 'R') {
        $parts = preg_split('/(\d+(?:[.,]\d+)*|\X)/u', $draw, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [];
        $mirror = ['(' => ')', ')' => '(', '[' => ']', ']' => '['];
        $draw = implode('', array_map(static fn (string $part): string => strtr($part, $mirror), array_reverse($parts)));
      }
      $segs = [];
      foreach (mb_str_split($draw) as $char) {
        $face = self::faceFor(mb_ord($char), $primary);
        if ($face === NULL) {
          return NULL;
        }
        if ($segs && $segs[array_key_last($segs)][0] === $face) {
          $segs[array_key_last($segs)][1] .= $char;
        }
        else {
          $segs[] = [$face, $char];
        }
      }
      $tokens[] = ['text' => $word, 'dir' => $dir, 'segs' => $segs];
    }
    return $tokens;
  }

  /**
   * The visual order of one line of tokens.
   *
   * Unicode's bidirectional rule L2 reduced to words: a neutral word takes
   * its neighbours' direction when both agree, else the paragraph's; runs
   * against the paragraph's direction are reversed.
   *
   * @param list<array> $line
   *   Tokens in logical order.
   * @param string $para
   *   The paragraph direction: 'L' or 'R'.
   *
   * @return list<array>
   *   Tokens left to right.
   */
  public static function visual(array $line, string $para): array {
    $line = array_values($line);
    $dirs = array_column($line, 'dir');
    $strong = static function (int $from, int $step) use ($dirs, $para): string {
      for ($at = $from; isset($dirs[$at]); $at += $step) {
        if ($dirs[$at] !== 'N') {
          return $dirs[$at];
        }
      }
      return $para;
    };
    $resolved = $dirs;
    foreach ($dirs as $at => $dir) {
      if ($dir === 'N') {
        $before = $strong($at - 1, -1);
        $resolved[$at] = $before === $strong($at + 1, 1) ? $before : $para;
      }
    }
    $runs = [];
    foreach ($line as $at => $token) {
      if ($runs && $runs[array_key_last($runs)]['dir'] === $resolved[$at]) {
        $runs[array_key_last($runs)]['tokens'][] = $token;
      }
      else {
        $runs[] = ['dir' => $resolved[$at], 'tokens' => [$token]];
      }
    }
    if ($para === 'R') {
      $runs = array_reverse($runs);
    }
    $out = [];
    foreach ($runs as $run) {
      array_push($out, ...($run['dir'] === 'R' ? array_reverse($run['tokens']) : $run['tokens']));
    }
    return $out;
  }

  /**
   * The advance width of a text in a face, in pixels.
   */
  public static function width(string $face, float $px, string $text): float {
    static $widths = [];
    if ($text === '') {
      return 0.0;
    }
    return $widths["$face|$px|$text"] ??= (float) imagettfbbox(self::points($face, $px), 0, self::file($face), self::gd($text))[2];
  }

  /**
   * Draws a text in a face with its baseline at $y.
   */
  public static function draw(\GdImage $image, string $face, float $px, float $x, float $y, int $color, string $text): void {
    imagettftext($image, self::points($face, $px), 0, (int) round($x), (int) round($y), $color, self::file($face), self::gd($text));
  }

  /**
   * GD's size, in points, for a face drawn at a pixel size.
   */
  private static function points(string $face, float $px): float {
    return $px * 0.75 * self::FACES[$face][1];
  }

  /**
   * A text GD draws as typed: it decodes "&#N;" anywhere.
   */
  private static function gd(string $text): string {
    return str_replace('&', '&#38;', $text);
  }

  /**
   * Whether a code point is in a right-to-left block.
   */
  private static function isRtl(int $cp): bool {
    return ($cp >= 0x0590 && $cp <= 0x08FF) || ($cp >= 0xFB1D && $cp <= 0xFDFF) || ($cp >= 0xFE70 && $cp <= 0xFEFF);
  }

  /**
   * Whether a code point is Arabic.
   */
  private static function isArabic(int $cp): bool {
    return ($cp >= 0x0600 && $cp <= 0x06FF) || ($cp >= 0x0750 && $cp <= 0x077F) || ($cp >= 0xFB50 && $cp <= 0xFDFF) || ($cp >= 0xFE70 && $cp <= 0xFEFF);
  }

}
