<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

// cspell:ignore segs
/**
 * How a share card's texts are fitted into lines.
 *
 * A fit tries steps [px, measure, max lines, max characters] in order and
 * takes the first that holds the text, with balanced lines. Past the last
 * step the last line ends in "…" after a whole word. Lines are lists of
 * ShareText tokens in logical order; draw() orders and draws them.
 *
 * @internal
 */
final class ShareLayout {

  /**
   * The page card title's steps.
   *
   * A short title large; then two lines inside the centre square with 35 px
   * to spare; two wide lines; three square-safe lines; then wide lines.
   */
  public const TITLE = [
    [128, 560, 1, 12],
    [104, 560, 2], [96, 560, 2], [88, 560, 2],
    [88, 980, 2], [76, 580, 3], [76, 1000, 3], [66, 1008, 3], [58, 1008, 4], [52, 1008, 4],
  ];

  /**
   * The site card's Site name steps.
   */
  public const SITE_NAME = [[88, 600, 1], [76, 600, 1], [76, 600, 2], [64, 1000, 2], [56, 1000, 2]];

  /**
   * The site card line's steps.
   */
  public const SITE_LINE = [[34, 600, 2], [31, 600, 2], [28, 640, 2]];

  /**
   * The brand row's Site name steps, before it is cut at a word.
   */
  public const BRAND_NAME = [[30, 640, 1], [26, 640, 1]];

  /**
   * The widest small line, in pixels.
   */
  public const LABEL_MAX = 900;

  /**
   * The label's letter spacing, in ems.
   */
  public const TRACKING = 0.10;

  /**
   * Fits a text into the first step that holds it.
   *
   * @param string $text
   *   Cleaned text (ShareText::clean()).
   * @param string $face
   *   The primary face.
   * @param list<array> $steps
   *   Each [px, measure, max lines], with an optional fourth item: the most
   *   characters the step takes.
   *
   * @return array{px: float, lines: list<list<array>>, space: float, clamped: bool}|null
   *   NULL when the text is empty or a character cannot be drawn.
   */
  public static function fit(string $text, string $face, array $steps): ?array {
    $tokens = ShareText::tokens($text, $face);
    if (!$tokens) {
      return NULL;
    }
    $chars = mb_strlen($text);
    foreach ($steps as $step) {
      [$px, $max, $most] = $step;
      if (isset($step[3]) && $chars > $step[3]) {
        continue;
      }
      $space = self::space($face, $px);
      $use = $tokens;
      if (max(array_map(static fn (array $token): float => self::tokenWidth($token, $px), $tokens)) > $max) {
        // A word wider than the measure is split from the 66 px wide step
        // down, never at a larger size.
        if ($px > 66 || $max < 1000) {
          continue;
        }
        $use = self::split($tokens, $px, $max);
      }
      if (count(self::greedy($use, $px, $max, $space)) <= $most) {
        $lines = $use === $tokens ? self::balanced($use, $px, $max, $space) : self::greedy($use, $px, $max, $space);
        return ['px' => (float) $px, 'lines' => $lines, 'space' => $space, 'clamped' => FALSE];
      }
    }
    [$px, $max, $most] = end($steps);
    $space = self::space($face, $px);
    $all = self::greedy(self::split($tokens, $px, $max), $px, $max, $space);
    if (count($all) <= $most) {
      return ['px' => (float) $px, 'lines' => $all, 'space' => $space, 'clamped' => FALSE];
    }
    $lines = array_slice($all, 0, $most);
    $last = $lines[$most - 1];
    $ellipsis = static fn (array $line): array => [...array_slice($line, 0, -1), self::ellipsis(end($line), $face)];
    // "…" after the last whole word that fits, never after a short word.
    while (count($last) > 1 && (self::lineWidth($ellipsis($last), $px, $space) > $max || mb_strlen(end($last)['text']) <= 3 || (end($last)['glue'] ?? FALSE))) {
      array_pop($last);
    }
    $lines[$most - 1] = $ellipsis($last);
    return ['px' => (float) $px, 'lines' => $lines, 'space' => $space, 'clamped' => TRUE];
  }

  /**
   * The small line above the title, fitted.
   *
   * Cased scripts: capitals at 26 px with tracking, cut with "…" past
   * 900 px. Hebrew at 30 px and Arabic at 32 px, as typed.
   *
   * @return array{text: string, cased: bool, px: float, fit: array|null}|null
   *   NULL when the label is empty or cannot be drawn.
   */
  public static function label(string $label): ?array {
    if ($label === '') {
      return NULL;
    }
    $cased = !preg_match('/[\x{0590}-\x{08FF}]/u', $label);
    $text = $cased ? mb_strtoupper($label) : $label;
    if (!ShareText::tokens($text, 'ui')) {
      return NULL;
    }
    if ($cased) {
      while (self::tracked('ui', 26, $text) > self::LABEL_MAX && mb_strlen($text) > 8) {
        $text = rtrim(mb_substr($text, 0, -2), ' ·') . '…';
      }
      return ['text' => $text, 'cased' => TRUE, 'px' => 26.0, 'fit' => NULL];
    }
    $px = preg_match('/[\x{0600}-\x{08FF}]/u', $text) ? 32 : 30;
    $fit = self::fit($text, 'ui', [[$px, self::LABEL_MAX, 1]]);
    return $fit ? ['text' => $text, 'cased' => FALSE, 'px' => (float) $px, 'fit' => $fit] : NULL;
  }

  /**
   * The brand row's Site name: 30 px, else 26 px, else cut at a word.
   *
   * Never dropped while a character of it can be drawn.
   *
   * @return array|null
   *   A fit (see fit()), or NULL when the name cannot be drawn.
   */
  public static function brandName(string $name): ?array {
    $fit = self::fit($name, 'ui', self::BRAND_NAME);
    $words = preg_split('/ /u', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    while (!$fit && count($words) > 1 && ShareText::tokens($name, 'ui')) {
      array_pop($words);
      $fit = self::fit(rtrim(implode(' ', $words), ' ,;:.-–—') . '…', 'ui', [[26, 640, 1]]);
    }
    return $fit;
  }

  /**
   * The width of a letter-spaced text in one face.
   */
  public static function tracked(string $face, float $px, string $text): float {
    return array_sum(self::advances($face, $px, $text)) + self::TRACKING * $px * (mb_strlen($text) - 1);
  }

  /**
   * Draws a letter-spaced text centred on $cx.
   */
  public static function drawTracked(\GdImage $image, string $face, float $px, string $text, float $cx, float $baseline, int $color): void {
    $x = $cx - self::tracked($face, $px, $text) / 2;
    foreach (self::advances($face, $px, $text) as $at => $advance) {
      ShareText::draw($image, $face, $px, $x, $baseline, $color, mb_substr($text, $at, 1));
      $x += $advance + self::TRACKING * $px;
    }
  }

  /**
   * Draws one line in visual order, aligned on $x.
   *
   * @param \GdImage $image
   *   The image.
   * @param list<array> $line
   *   Tokens in logical order.
   * @param float $px
   *   The size.
   * @param float $space
   *   The word space.
   * @param string $para
   *   The paragraph direction.
   * @param float $x
   *   The centre, left or right edge.
   * @param float $baseline
   *   The baseline.
   * @param int $color
   *   A GD colour.
   * @param string $align
   *   The alignment: 'center', 'left' or 'right'.
   *
   * @return float
   *   The line's width.
   */
  public static function draw(\GdImage $image, array $line, float $px, float $space, string $para, float $x, float $baseline, int $color, string $align = 'center'): float {
    $width = self::lineWidth($line, $px, $space);
    $x -= match ($align) {
      'center' => $width / 2,
      'right' => $width,
      default => 0,
    };
    foreach (ShareText::visual($line, $para) as $at => $token) {
      $x += $at ? $space : 0;
      foreach ($token['segs'] as [$face, $text]) {
        ShareText::draw($image, $face, $px, $x, $baseline, $color, $text);
        $x += ShareText::width($face, $px, $text);
      }
    }
    return $width;
  }

  /**
   * A line's text, its words in logical order.
   */
  public static function text(array $line): string {
    return implode(' ', array_column($line, 'text'));
  }

  /**
   * The width of a line of tokens.
   */
  public static function lineWidth(array $line, float $px, float $space): float {
    $width = 0.0;
    foreach (array_values($line) as $at => $token) {
      $width += ($at ? $space : 0) + self::tokenWidth($token, $px);
    }
    return $width;
  }

  /**
   * The leading of a title size.
   */
  public static function leading(float $px): float {
    return $px >= 84 ? 1.06 : ($px >= 66 ? 1.10 : 1.14);
  }

  /**
   * The advance of each character of a text, kerning included.
   *
   * @return list<float>
   *   One per character.
   */
  private static function advances(string $face, float $px, string $text): array {
    $chars = mb_str_split($text);
    $advances = [];
    $before = 0.0;
    foreach ($chars as $at => $char) {
      $upto = ShareText::width($face, $px, implode('', array_slice($chars, 0, $at + 1)));
      $advances[] = $upto - $before;
      $before = $upto;
    }
    return $advances;
  }

  /**
   * The width of a token.
   */
  private static function tokenWidth(array $token, float $px): float {
    $width = 0.0;
    foreach ($token['segs'] as [$face, $text]) {
      $width += ShareText::width($face, $px, $text);
    }
    return $width;
  }

  /**
   * The word space of a face at a size.
   */
  private static function space(string $face, float $px): float {
    return max(ShareText::width($face, $px, 'a a') - ShareText::width($face, $px, 'aa'), 0.22 * $px);
  }

  /**
   * Lines filled one word at a time.
   *
   * @return list<list<array>>
   *   Lines of tokens.
   */
  private static function greedy(array $tokens, float $px, float $max, float $space): array {
    $lines = [[]];
    $width = 0.0;
    foreach ($tokens as $token) {
      $tokenWidth = self::tokenWidth($token, $px);
      $last = array_key_last($lines);
      if ($lines[$last] && $width + $space + $tokenWidth > $max) {
        $lines[] = [$token];
        $width = $tokenWidth;
        continue;
      }
      $width += ($lines[$last] ? $space : 0) + $tokenWidth;
      $lines[$last][] = $token;
    }
    return $lines;
  }

  /**
   * The greedy line count at the narrowest measure that keeps it.
   *
   * A two-line text breaks at a phrase boundary instead (before "(" or a
   * lone dash, after ":" ";" ",") when both lines fit and the shorter is
   * over 0.4 of the longer.
   *
   * @return list<list<array>>
   *   Lines of tokens.
   */
  private static function balanced(array $tokens, float $px, float $max, float $space): array {
    $count = count(self::greedy($tokens, $px, $max, $space));
    if ($count <= 1) {
      return self::greedy($tokens, $px, $max, $space);
    }
    [$low, $high] = [$max / $count * 0.8, $max];
    for ($i = 0; $i < 16; $i++) {
      $mid = ($low + $high) / 2;
      $try = self::greedy($tokens, $px, $mid, $space);
      $fits = count($try) <= $count && max(array_map(static fn (array $line): float => self::lineWidth($line, $px, $space), $try)) <= $mid + 0.5;
      if ($fits) {
        $high = $mid;
      }
      else {
        $low = $mid;
      }
    }
    if ($count === 2) {
      $best = NULL;
      $bestScore = 0.0;
      for ($at = 0; $at < count($tokens) - 1; $at++) {
        if (!preg_match('/[:;,]$/u', $tokens[$at]['text']) && !preg_match('/^[(\[]|^[—–-]$/u', $tokens[$at + 1]['text'])) {
          continue;
        }
        $try = [array_slice($tokens, 0, $at + 1), array_slice($tokens, $at + 1)];
        [$first, $second] = [self::lineWidth($try[0], $px, $space), self::lineWidth($try[1], $px, $space)];
        $score = min($first, $second) / max($first, $second);
        if (max($first, $second) <= $max && $score > 0.4 && $score > $bestScore) {
          [$best, $bestScore] = [$try, $score];
        }
      }
      if ($best) {
        return $best;
      }
    }
    return self::greedy($tokens, $px, $high, $space);
  }

  /**
   * Splits a word wider than the measure with hyphens.
   *
   * At least four letters on each side of a hyphen. A word drawn in more
   * than one face is left whole.
   *
   * @return list<array>
   *   Tokens; a piece that continues on the next line has 'glue'.
   */
  private static function split(array $tokens, float $px, float $max): array {
    $out = [];
    foreach ($tokens as $token) {
      if (self::tokenWidth($token, $px) <= $max || count($token['segs']) !== 1) {
        $out[] = $token;
        continue;
      }
      [$face, $text] = $token['segs'][0];
      $pieces = [];
      $piece = '';
      foreach (mb_str_split($text) as $char) {
        if ($piece !== '' && ShareText::width($face, $px, $piece . $char . '-') > $max) {
          $pieces[] = $piece;
          $piece = '';
        }
        $piece .= $char;
      }
      $pieces[] = $piece;
      $n = count($pieces);
      if ($n > 1 && mb_strlen($pieces[$n - 1]) < 4) {
        $need = 4 - mb_strlen($pieces[$n - 1]);
        $pieces[$n - 1] = mb_substr($pieces[$n - 2], -$need) . $pieces[$n - 1];
        $pieces[$n - 2] = mb_substr($pieces[$n - 2], 0, -$need);
      }
      foreach ($pieces as $at => $one) {
        $last = $at === $n - 1;
        $one = $last || $token['dir'] === 'R' ? $one : "$one-";
        $out[] = ['text' => $one, 'dir' => $token['dir'], 'segs' => [[$face, $one]], 'glue' => !$last];
      }
    }
    return $out;
  }

  /**
   * A token with "…" at its logical end, trailing punctuation dropped.
   *
   * The mark is drawn in the face of the letters it follows, else in the
   * primary face.
   */
  private static function ellipsis(array $token, string $face): array {
    $token['text'] = preg_replace('/[\s,;:.\-–—]+$/u', '', $token['text']) . '…';
    $rtl = $token['dir'] === 'R';
    $at = $rtl ? 0 : array_key_last($token['segs']);
    [$own, $text] = $token['segs'][$at];
    $text = $rtl ? preg_replace('/^[\s,;:.\-–—]+/u', '', $text) : preg_replace('/[\s,;:.\-–—]+$/u', '', $text);
    if (ShareText::covers($own, 0x2026)) {
      $token['segs'][$at][1] = $rtl ? "…{$text}" : "{$text}…";
    }
    else {
      $token['segs'][$at][1] = $text;
      $token['segs'] = $rtl ? [[$face, '…'], ...$token['segs']] : [...$token['segs'], [$face, '…']];
    }
    return $token;
  }

}
