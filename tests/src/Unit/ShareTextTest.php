<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\ShareText;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;

// cspell:ignore Leinikki harakat Kesä Kesäkahvila kahvila keycap segs
// cspell:ignore םולש שלום بَيْتٌ خواهم سلام ليلة
/**
 * Text as the share images draw it.
 *
 * Share-images "Text the fonts can't draw makes no card" and "Right-to-left
 * and long titles are set correctly"; design D7.
 */
#[CoversClass(ShareText::class)]
#[Group('canvas_metatag')]
final class ShareTextTest extends UnitTestCase {

  /**
   * Coverage comes from the build's files: Arabic forms yes, Japanese no.
   */
  public function testCovers(): void {
    self::assertTrue(ShareText::covers('arabic', 0xFEDF));
    self::assertFalse(ShareText::covers('title', 0xFEDF));
    self::assertSame('arabic', ShareText::faceFor(0xFEDF, 'title'));
    self::assertSame('title', ShareText::faceFor(ord('A'), 'title'));
    self::assertSame('hebrew', ShareText::faceFor(0x05E9, 'title'));
    self::assertSame('symbols', ShareText::faceFor(0x2728, 'title'));
    // 湖: no bundled font has it.
    foreach (array_keys(ShareText::FACES) as $face) {
      self::assertFalse(ShareText::covers($face, 0x6E56), $face);
    }
    self::assertNull(ShareText::faceFor(0x6E56, 'title'));
    self::assertNull(ShareText::tokens('湖畔の夏至コンサート', 'title'));
  }

  /**
   * What the image draws of a text.
   */
  #[DataProvider('providerClean')]
  public function testClean(string $text, string $expected): void {
    self::assertSame($expected, ShareText::clean($text));
  }

  /**
   * Data provider for testClean().
   */
  public static function providerClean(): \Generator {
    yield 'astral emoji out, basic-plane symbol kept' => [
      'Launch week 🚀 five new things for editors ✨',
      'Launch week five new things for editors ✨',
    ];
    yield 'direction marks, a skin-toned emoji and a joined emoji out' => [
      "Hello \u{200F}مرحبا\u{200F} 👋🏽 שלום — Leinikki 🧑‍💻",
      'Hello مرحبا שלום — Leinikki',
    ];
    yield 'a dangling separator' => ['Hi 👋 — 👋 there', 'Hi — there'];
    yield 'a leading emoji and its separator' => ['🎉 · Party night', 'Party night'];
    yield 'controls, zero-width space and whitespace' => [
      "Tab\there\u{200B}now\n  and\u{FEFF} then",
      'Tab here now and then',
    ];
    yield 'a soft hyphen and a word joiner vanish' => ["Kesä\u{00AD}kahvila\u{2060}", 'Kesäkahvila'];
    yield 'a keycap' => ['Top 1️⃣ pick', 'Top pick'];
    yield 'a variation selector on a symbol' => ["Sun \u{2600}\u{FE0F}", "Sun \u{2600}"];
    yield 'a zero-width non-joiner stays in a Persian word' => ["می\u{200C}خواهم", "می\u{200C}خواهم"];
    yield 'an ampersand as typed' => ['Q&A night: Tom &#169; Jerry & friends', 'Q&A night: Tom &#169; Jerry & friends'];
  }

  /**
   * Every input is cut to 300 characters before it is set.
   */
  public function testCut(): void {
    self::assertSame(300, mb_strlen(ShareText::clean(str_repeat('ä', 400))));
  }

  /**
   * An entity draws as typed: "&#169;" is six characters, never "©".
   */
  #[RequiresFunction('imagettftext')]
  public function testAmpersandDrawsAsTyped(): void {
    $text = '&#169;';
    $each = array_sum(array_map(static fn (string $char): float => ShareText::width('title', 88, $char), mb_str_split($text)));
    self::assertEqualsWithDelta($each, ShareText::width('title', 88, $text), 3.0);
    self::assertGreaterThan(3 * ShareText::width('title', 88, '©'), ShareText::width('title', 88, $text));
  }

  /**
   * Arabic letters take their contextual forms; harakat go.
   */
  #[DataProvider('providerArabic')]
  public function testArabicForms(string $word, array $expected): void {
    self::assertSame($expected, array_map('mb_ord', mb_str_split(ShareText::shapeArabic($word))));
  }

  /**
   * Data provider for testArabicForms().
   */
  public static function providerArabic(): \Generator {
    yield 'isolated' => ['ب', [0xFE8F]];
    yield 'initial, medial, final' => ['بيت', [0xFE91, 0xFEF4, 0xFE96]];
    yield 'a letter that does not join the next' => ['دب', [0xFEA9, 0xFE8F]];
    yield 'lam-alef alone' => ['لا', [0xFEFB]];
    yield 'lam-alef after a joining letter, then an isolated letter' => ['سلام', [0xFEB3, 0xFEFC, 0xFEE1]];
    yield 'harakat dropped' => ['بَيْتٌ', [0xFE91, 0xFEF4, 0xFE96]];
    yield 'a Persian letter' => ['پ', [0xFB56]];
  }

  /**
   * Words are ordered for display per line.
   *
   * @param string $text
   *   A line's text, logical order.
   * @param string $para
   *   The paragraph direction.
   * @param list<string> $words
   *   The words left to right.
   * @param list<string> $drawn
   *   What each word draws, left to right.
   */
  #[DataProvider('providerVisual')]
  public function testVisualOrder(string $text, string $para, array $words, array $drawn): void {
    $tokens = ShareText::visual(ShareText::tokens($text, 'title'), $para);
    self::assertSame($words, array_column($tokens, 'text'));
    self::assertSame($drawn, array_map(static fn (array $token): string => implode('', array_column($token['segs'], 1)), $tokens));
  }

  /**
   * Data provider for testVisualOrder().
   */
  public static function providerVisual(): \Generator {
    yield 'a right-to-left run inside a left-to-right line' => [
      'Hello مرحبا שלום — Leinikki', 'L',
      ['Hello', 'שלום', 'مرحبا', '—', 'Leinikki'],
      ['Hello', 'םולש', self::drawn('مرحبا'), '—', 'Leinikki'],
    ];
    yield 'a number in a right-to-left line keeps its digits' => [
      'שנת 2027', 'R',
      ['2027', 'שנת'],
      ['2027', 'תנש'],
    ];
    yield 'digits inside a right-to-left word, brackets mirrored' => [
      'ב-2027 (שלום)', 'R',
      ['(שלום)', 'ב-2027'],
      ['(םולש)', '2027-ב'],
    ];
    yield 'a left-to-right word inside a right-to-left line' => [
      'حفل Humanify ليلة', 'R',
      ['ليلة', 'Humanify', 'حفل'],
      [self::drawn('ليلة'), 'Humanify', self::drawn('حفل')],
    ];
  }

  /**
   * An Arabic word as drawn: shaped in logical order, then reversed.
   */
  private static function drawn(string $word): string {
    return implode('', array_reverse(mb_str_split(ShareText::shapeArabic($word))));
  }

  /**
   * The first strong letter decides a text's direction.
   */
  public function testDirection(): void {
    self::assertSame('R', ShareText::direction('2027 حفل'));
    self::assertSame('L', ShareText::direction('— Leinikki مرحبا'));
    self::assertSame('N', ShareText::direction('2027 — ✨'));
  }

}
