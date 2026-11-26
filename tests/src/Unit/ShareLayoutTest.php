<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\ShareCard;
use Drupal\canvas_metatag\ShareLayout;
use Drupal\canvas_metatag\ShareText;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;

// cspell:ignore Ruisleipä Leinikki Kesäkahvila אירוע אמצע האגם הקיץ קונצרט שלום
// cspell:ignore البحيرة الصيف ضفاف فعالية ليلة منتصف
// cspell:ignore Donaudampfschifffahrtsgesellschaftskapitänsmützensammlung
/**
 * How the card's texts are fitted into lines.
 *
 * Design D6 and reference.md "Page card". Font engines move glyph advances
 * by fractions of a pixel, so most cases assert invariants (every line inside
 * its measure, the line count, no "…" when nothing was dropped) and exact
 * lines only where the breaks have margin.
 */
#[CoversClass(ShareLayout::class)]
#[Group('canvas_metatag')]
#[RequiresFunction('imagettftext')]
final class ShareLayoutTest extends UnitTestCase {

  /**
   * The farm site's 247-character event title.
   */
  private const LONG = 'An unusually long evening programme of chamber music, songs and readings in which every work is introduced by the musicians themselves, followed by a conversation with the audience about how new music is commissioned, rehearsed and first performed';

  /**
   * Every title fits its step, and only a cut title has "…".
   */
  #[DataProvider('providerTitles')]
  public function testInvariants(string $title): void {
    $text = ShareText::clean($title);
    $fit = ShareLayout::fit($text, 'title', ShareLayout::TITLE);
    self::assertNotNull($fit);
    $step = current(array_filter(ShareLayout::TITLE, static fn (array $step): bool => (float) $step[0] === $fit['px'] && $step[2] >= count($fit['lines']) && (!isset($step[3]) || mb_strlen($text) <= $step[3])));
    self::assertNotFalse($step, 'The size is one of the steps.');
    $measure = $fit['clamped'] ? 1008 : max(array_column(array_filter(ShareLayout::TITLE, static fn (array $one): bool => (float) $one[0] === $fit['px']), 1));
    foreach ($fit['lines'] as $line) {
      self::assertLessThanOrEqual($measure + 0.5, ShareLayout::lineWidth($line, $fit['px'], $fit['space']), ShareLayout::text($line));
    }
    self::assertLessThanOrEqual(4, count($fit['lines']));
    $drawn = implode(' ', array_map([ShareLayout::class, 'text'], $fit['lines']));
    self::assertSame($fit['clamped'], str_contains($drawn, '…') && !str_contains($text, '…'));
    if (!$fit['clamped']) {
      // Nothing dropped: every word is drawn, in order.
      self::assertSame($text, $drawn);
    }
  }

  /**
   * Data provider for testInvariants(): the farm site's titles.
   */
  public static function providerTitles(): \Generator {
    foreach ([
      'Blog',
      'Services',
      'Untitled page',
      'Midsummer Night Concert',
      'Ruisleipä (Finnish rye bread)',
      'Senior Drupal developer',
      'New summer opening hours',
      'Why the summer box office opens at noon: shorter queues, clearer seat maps and tickets that still work on a phone offline',
      'حفل ليلة منتصف الصيف على ضفاف البحيرة',
      'קונצרט ליל אמצע הקיץ על שפת האגם',
      "Hello \u{200F}مرحبا\u{200F} 👋🏽 שלום — Leinikki 🧑‍💻",
      'Launch week 🚀 five new things for editors ✨',
      'Q&A night: Tom &#169; Jerry & friends',
      'Saturday market is back',
      self::LONG,
    ] as $title) {
      yield mb_substr($title, 0, 40) => [$title];
    }
  }

  /**
   * The 247-character event ends "followed…" on four lines at 52 px.
   */
  public function testLongTitle(): void {
    $fit = ShareLayout::fit(ShareText::clean(self::LONG), 'title', ShareLayout::TITLE);
    self::assertSame(52.0, $fit['px']);
    self::assertCount(4, $fit['lines']);
    self::assertTrue($fit['clamped']);
    self::assertStringEndsWith('followed…', ShareLayout::text(end($fit['lines'])));
  }

  /**
   * The "…" never follows a word of three letters or fewer.
   */
  public function testEllipsisAfterWholeWord(): void {
    $title = str_repeat('Concerts and songs for all the town of ', 8);
    $fit = ShareLayout::fit(ShareText::clean($title), 'title', ShareLayout::TITLE);
    self::assertTrue($fit['clamped']);
    $words = explode(' ', ShareLayout::text(end($fit['lines'])));
    self::assertGreaterThan(3, mb_strlen(end($words)), end($words));
  }

  /**
   * Short titles take the largest step; two lines are balanced.
   */
  #[DataProvider('providerLines')]
  public function testLines(string $title, float $px, array $lines): void {
    $fit = ShareLayout::fit(ShareText::clean($title), 'title', ShareLayout::TITLE);
    self::assertSame($px, $fit['px']);
    self::assertSame($lines, array_map([ShareLayout::class, 'text'], $fit['lines']));
    self::assertFalse($fit['clamped']);
  }

  /**
   * Data provider for testLines(): breaks with margin.
   */
  public static function providerLines(): \Generator {
    yield 'one word at the largest step' => ['Blog', 128.0, ['Blog']];
    yield 'over 12 characters skips the largest step' => ['Untitled page', 104.0, ['Untitled', 'page']];
    yield 'balanced' => ['Midsummer Night Concert', 88.0, ['Midsummer', 'Night Concert']];
    yield 'a phrase break before "("' => ['Ruisleipä (Finnish rye bread)', 88.0, ['Ruisleipä', '(Finnish rye bread)']];
    yield 'a lone dash starts the second line' => [
      'Hello مرحبا שלום — Leinikki',
      88.0,
      ['Hello مرحبا שלום', '— Leinikki'],
    ];
    yield 'one wide line' => ['Saturday market is back', 88.0, ['Saturday market is back']];
  }

  /**
   * A word wider than the measure is split with a hyphen from 66 px down.
   */
  public function testHyphenSplit(): void {
    $fit = ShareLayout::fit('Donaudampfschifffahrtsgesellschaftskapitänsmützensammlung, the exhibition', 'title', ShareLayout::TITLE);
    self::assertSame(66.0, $fit['px']);
    self::assertFalse($fit['clamped']);
    $lines = array_map([ShareLayout::class, 'text'], $fit['lines']);
    self::assertStringEndsWith('-', $lines[0]);
    // Four letters at least on each side of the hyphen.
    self::assertGreaterThanOrEqual(4, mb_strlen(rtrim($lines[0], '-')));
    self::assertMatchesRegularExpression('/^\p{L}{4}/u', $lines[1]);
    self::assertStringNotContainsString('…', implode(' ', $lines));
  }

  /**
   * The small line: capitals with tracking, cut past 900 px; RTL as typed.
   */
  public function testLabel(): void {
    $label = ShareLayout::label('Event · June 19, 2027');
    self::assertSame(['EVENT · JUNE 19, 2027', TRUE, 26.0], [$label['text'], $label['cased'], $label['px']]);
    $long = ShareLayout::label(str_repeat('Conductor and artistic director ', 4));
    self::assertStringEndsWith('…', $long['text']);
    self::assertLessThanOrEqual(ShareLayout::LABEL_MAX, ShareLayout::tracked('ui', 26, $long['text']));
    $arabic = ShareLayout::label('فعالية');
    self::assertSame(['فعالية', FALSE, 32.0], [$arabic['text'], $arabic['cased'], $arabic['px']]);
    self::assertSame(30.0, ShareLayout::label('אירוע')['px']);
    self::assertNull(ShareLayout::label(''));
    self::assertNull(ShareLayout::label('イベント'));
  }

  /**
   * The brand row's name: 30 px, else 26 px, else cut at a word, never gone.
   */
  public function testBrandName(): void {
    self::assertSame(30.0, ShareLayout::brandName('Humanify Studio')['px']);
    $fit = ShareLayout::brandName('The Northern Lakes Regional Chamber Music Society of Finland');
    self::assertSame(26.0, $fit['px']);
    self::assertSame('The Northern Lakes Regional Chamber Music…', ShareLayout::text($fit['lines'][0]));
    self::assertLessThanOrEqual(640, ShareLayout::lineWidth($fit['lines'][0], $fit['px'], $fit['space']));
    self::assertNull(ShareLayout::brandName('湖畔'));
  }

  /**
   * The committed reference cards still lay out as their layout.json says.
   *
   * The folder tests/fixtures/share-cards/ holds four cards the module drew
   * from the inputs of reference/cards/ c04, c12, c17 and c21, for review by
   * eye; only their layout is compared here. After a deliberate change, draw
   * them again by running this test with CANVAS_METATAG_SHARE_CARDS=write,
   * and look at each one.
   */
  public function testReferenceLayouts(): void {
    $dir = dirname(__DIR__, 2) . '/fixtures/share-cards';
    $write = getenv('CANVAS_METATAG_SHARE_CARDS') === 'write';
    $logo = ShareCard::readLogo("$dir/logo.png", [$dir]);
    $studio = ['site_name' => 'Humanify Studio', 'logo' => $logo, 'colour' => '', 'dir' => 'L'];
    $cases = [
      'c04-event-86' => ['title' => 'Midsummer Night Concert', 'label' => 'Event · June 19, 2027'] + $studio,
      'c12-rtl-arabic' => ['title' => 'حفل ليلة منتصف الصيف على ضفاف البحيرة', 'label' => 'فعالية', 'dir' => 'R'] + $studio,
      'c17-no-logo-announcement' => ['title' => 'New summer opening hours', 'site_name' => 'Humanify', 'logo' => NULL] + $studio,
      'c21-light-brand' => [
        'title' => 'New summer opening hours',
        'site_name' => 'Kesäkahvila',
        'logo' => NULL,
        'colour' => '#EDC020',
      ] + $studio,
    ];
    $actual = [];
    foreach ($cases as $name => $input) {
      $card = ShareCard::page($input);
      self::assertNotNull($card['image'], $name);
      $info = $card['info'];
      $actual[$name] = [
        'size' => [imagesx($card['image']), imagesy($card['image'])],
        'px' => $info['px'],
        'label' => $info['label'],
        'lines' => $info['lines'],
        'mark' => $info['mark'],
        'field' => $info['field'],
        'text' => $info['text'],
        'contrast' => $info['contrast'],
      ];
      if ($write) {
        file_put_contents("$dir/$name.png", ShareCard::png($card['image']));
      }
    }
    if ($write) {
      file_put_contents("$dir/layout.json", json_encode($actual, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION) . "\n");
    }
    $expected = json_decode((string) file_get_contents("$dir/layout.json"), TRUE, 8, JSON_THROW_ON_ERROR);
    self::assertSame(array_keys($expected), array_keys($actual));
    $bytes = 0;
    foreach ($expected as $name => $layout) {
      $size = getimagesize("$dir/$name.png");
      self::assertSame($layout['size'], [$size[0], $size[1]], $name);
      $bytes += filesize("$dir/$name.png");
      // Measured over resampled pixels, which GD builds may round apart.
      foreach (['field', 'contrast'] as $key) {
        foreach ($layout[$key] as $one => $value) {
          is_float($value)
            ? self::assertEqualsWithDelta($value, $actual[$name][$key][$one], 0.03, "$name $key $one")
            : self::assertEqualsWithDelta(ShareCard::rgb($value), ShareCard::rgb($actual[$name][$key][$one]), 2, "$name $key $one");
        }
        unset($layout[$key], $actual[$name][$key]);
      }
      self::assertSame($layout, $actual[$name], $name);
    }
    self::assertLessThan(200 * 1024, $bytes, 'The four cards together stay under 200 KB.');
  }

}
