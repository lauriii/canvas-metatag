<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\Words;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Datetime\DateFormatterInterface;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresPhpExtension;

// cspell:ignore juin Juni kesäkuuta junho Hedy Garfunkel
/**
 * Fields read as words in text: dates, decimals, several items.
 *
 * Dynamic-values "Fields read as words in text" and "In text, a field gives
 * every item visitors may see". No configuration: the item's language, its
 * region, else the site's default country.
 */
#[CoversClass(Words::class)]
#[Group('canvas_metatag')]
#[RequiresPhpExtension('intl')]
final class WordsTest extends UnitTestCase {

  /**
   * Words on a site in a country and a timezone.
   */
  private function words(string $country = 'GB', string $zone = 'Europe/Helsinki', ?bool $intl = NULL): Words {
    $config = $this->getConfigFactoryStub([
      'system.date' => [
        'country' => ['default' => $country],
        'timezone' => ['default' => $zone],
      ],
    ]);
    $formatter = $this->createMock(DateFormatterInterface::class);
    $formatter->method('format')->willReturnCallback(static fn (int $timestamp, string $type, string $format, string $zone): string => (new \DateTimeImmutable("@$timestamp"))->setTimezone(new \DateTimeZone($zone))->format($format));
    return new Words($config, $formatter, $this->getStringTranslationStub(), $intl);
  }

  /**
   * A date in a title, in the item's language and the site's country.
   */
  #[DataProvider('providerDates')]
  public function testDates(string $country, string $langcode, string $expected): void {
    $cacheability = new CacheableMetadata();
    self::assertSame($expected, $this->words($country)->date('2026-06-20T19:00:00+03:00', $langcode, $cacheability));
    self::assertContains('config:system.date', $cacheability->getCacheTags());
  }

  /**
   * Data provider for testDates().
   */
  public static function providerDates(): \Generator {
    yield 'English in the United Kingdom' => ['GB', 'en', '20 June 2026'];
    yield 'English in the United States' => ['US', 'en', 'June 20, 2026'];
    yield 'French' => ['GB', 'fr', '20 juin 2026'];
    yield 'German' => ['GB', 'de', '20. Juni 2026'];
    yield 'Finnish' => ['GB', 'fi', '20. kesäkuuta 2026'];
    yield 'Japanese' => ['GB', 'ja', '2026年6月20日'];
    // The language's own region wins over the site's country.
    yield 'Brazilian Portuguese' => ['GB', 'pt-br', '20 de junho de 2026'];
  }

  /**
   * A date-only value never moves a day; a timestamp reads as a date.
   */
  public function testDateOnlyAndTimestamps(): void {
    $cacheability = new CacheableMetadata();
    $words = $this->words('GB', 'America/Los_Angeles');
    self::assertSame('1 July 2026', $words->date('2026-07-01', 'en', $cacheability));
    // 20 June 2026 00:30 in Helsinki is still 19 June in Los Angeles.
    self::assertSame('19 June 2026', $words->items(['1781904600'], 'timestamp', 0, 'en', FALSE, FALSE, $cacheability));
  }

  /**
   * A decimal to its scale in the locale's marks; an integer as stored.
   */
  public function testNumbers(): void {
    $cacheability = new CacheableMetadata();
    $words = $this->words();
    self::assertSame('1,234.50', $words->items(['1234.5'], 'decimal', 2, 'en', FALSE, FALSE, $cacheability));
    self::assertSame('1.234,50', $words->items(['1234.5'], 'decimal', 2, 'de', FALSE, FALSE, $cacheability));
    self::assertSame('1’234.50', $words->items(['1234.5'], 'decimal', 2, 'de-ch', FALSE, FALSE, $cacheability));
    self::assertSame('1.234,50', $words->items(['1234.5'], 'decimal', 2, 'pt-br', FALSE, FALSE, $cacheability));
    self::assertSame('2026', $words->items(['2026'], 'number', 0, 'en', FALSE, FALSE, $cacheability));
    // Stored digits, never a float: every digit of a long decimal, rounded
    // half up to the scale.
    self::assertSame('12345678901234567.89', $words->decimal('12345678901234567.885', 2, 'en', $cacheability));
    self::assertSame('12345678901234567,89', $words->decimal('12345678901234567.885', 2, 'de', $cacheability));
    self::assertSame('0.1234567890123456789', $words->decimal('0.1234567890123456789', 19, 'en', $cacheability));
    self::assertSame('-1.00', $words->decimal('-0.995', 2, 'en', $cacheability));
    self::assertSame('', $words->decimal('1e5', 2, 'en', $cacheability));
  }

  /**
   * Several items: every one, joined; at most two and more where title-like.
   */
  public function testSeveralItems(): void {
    $cacheability = new CacheableMetadata();
    $words = $this->words();
    $performers = ['Ada', 'Grace', 'Hedy'];
    self::assertSame('Ada, Grace, Hedy', $words->items($performers, 'text', 0, 'en', FALSE, FALSE, $cacheability));
    self::assertSame('Ada, Grace and 1 more', $words->items($performers, 'text', 0, 'en', TRUE, FALSE, $cacheability));
    self::assertSame('Ada, Grace and 2 more', $words->items([...$performers, 'Lin'], 'text', 0, 'en', TRUE, FALSE, $cacheability));
    self::assertSame('Ada, Grace', $words->items(['Ada', 'Grace'], 'text', 0, 'en', TRUE, FALSE, $cacheability));
    // The language's list separator.
    self::assertSame('Ada、Grace、Hedy', $words->items($performers, 'text', 0, 'ja', FALSE, FALSE, $cacheability));
    // Empty items are no items; formatted text is plain, its start unless
    // whole.
    self::assertSame('Ada', $words->items(['', ' ', 'Ada'], 'text', 0, 'en', FALSE, FALSE, $cacheability));
    self::assertSame('Doors open.', $words->items(['<p>Doors <b>open</b>.</p>'], 'html', 0, 'en', FALSE, TRUE, $cacheability));
    // An item that ends a sentence is followed by a space, never ".,".
    $bios = ['<p>Conducts new music.</p>', 'Plays the oud', 'Sings'];
    self::assertSame('Conducts new music. Plays the oud, Sings', $words->items($bios, 'html', 0, 'en', FALSE, TRUE, $cacheability));
    self::assertSame('新しい音楽。ウード', $words->items(['新しい音楽。', 'ウード'], 'text', 0, 'ja', FALSE, FALSE, $cacheability));
    // Names are plain text, never escaped as markup: the head escapes them
    // once.
    $names = ['Simon & Garfunkel', "O'Brien", '<b>X</b>'];
    self::assertSame("Simon & Garfunkel, O'Brien and 1 more", $words->items($names, 'text', 0, 'en', TRUE, FALSE, $cacheability));
    self::assertSame("Simon & Garfunkel, O'Brien, <b>X</b>", $words->items($names, 'text', 0, 'en', FALSE, FALSE, $cacheability));
  }

  /**
   * Without intl: a fixed date pattern, digits with a point, a comma.
   */
  public function testWithoutIntl(): void {
    $cacheability = new CacheableMetadata();
    $words = $this->words('US', 'America/Los_Angeles', FALSE);
    self::assertSame('1 July 2026', $words->date('2026-07-01', 'en', $cacheability));
    self::assertSame('19 June 2026', $words->items(['1781904600'], 'timestamp', 0, 'en', FALSE, FALSE, $cacheability));
    self::assertSame('1234.50', $words->items(['1234.5'], 'decimal', 2, 'de', FALSE, FALSE, $cacheability));
    self::assertSame('Ada, Grace, Hedy', $words->items(['Ada', 'Grace', 'Hedy'], 'text', 0, 'ja', FALSE, FALSE, $cacheability));
  }

  /**
   * The item's locale.
   */
  public function testLocale(): void {
    self::assertSame('en_GB', $this->words('GB')->locale('en'));
    self::assertSame('pt_BR', $this->words('GB')->locale('pt-br'));
    self::assertSame('zh_Hant_GB', $this->words('GB')->locale('zh-hant'));
    self::assertSame('en', $this->words('')->locale('en'));
  }

}
