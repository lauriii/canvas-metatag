<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\ShareLabel;
use Drupal\canvas_metatag\ShareLayout;
use Drupal\canvas_metatag\Words;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Datetime\DateFormatterInterface;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;
use PHPUnit\Framework\Attributes\RequiresPhpExtension;

// cspell:ignore kesäkuuta Kallio
/**
 * The share card's small line.
 *
 * Share-images "The card's small line names the kind of page"; design D8.
 */
#[CoversClass(ShareLabel::class)]
#[Group('canvas_metatag')]
#[RequiresPhpExtension('intl')]
final class ShareLabelTest extends UnitTestCase {

  /**
   * An event starting on 19 June 2027 at 19:00 in Helsinki.
   */
  private const START = '2027-06-19T19:00:00+03:00';

  /**
   * The line for a type and its values on a site in a country.
   */
  private function line(string $type, array $values, string $langcode = 'en', string $country = 'US', ?CacheableMetadata $cacheability = NULL): string {
    return ShareLabel::text($type, $values, $langcode, $this->words($country), $this->getStringTranslationStub(), $cacheability ?? new CacheableMetadata());
  }

  /**
   * Words on a site in a country, in Helsinki's timezone.
   */
  private function words(string $country): Words {
    $config = $this->getConfigFactoryStub([
      'system.date' => [
        'country' => ['default' => $country],
        'timezone' => ['default' => 'Europe/Helsinki'],
      ],
    ]);
    return new Words($config, $this->createMock(DateFormatterInterface::class), $this->getStringTranslationStub());
  }

  /**
   * The kinds the card names, with their dates.
   */
  #[DataProvider('providerLines')]
  public function testLines(string $type, array $values, string $expected): void {
    self::assertSame($expected, $this->line($type, $values));
  }

  /**
   * Data provider for testLines().
   */
  public static function providerLines(): \Generator {
    yield 'an event with its start date, no time' => [
      'Event',
      ['startDate' => self::START, 'name' => 'Midsummer Night Concert'],
      'Event · June 19, 2027',
    ];
    yield 'an event without a date' => ['Event', [], 'Event'];
    yield 'an article with its published date' => [
      'Article',
      ['datePublished' => '2026-05-04'],
      'Article · May 4, 2026',
    ];
    yield 'a blog post is in the article family' => [
      'BlogPosting',
      ['datePublished' => '2026-05-04'],
      'Article · May 4, 2026',
    ];
    yield 'a product' => ['Product', ['offers_price' => '99.95', 'offers_priceCurrency' => 'EUR'], 'Product'];
    yield 'a recipe' => ['Recipe', ['totalTime' => 'PT45M', 'recipeYield' => '8'], 'Recipe'];
    yield 'a job posting' => [
      'JobPosting',
      ['baseSalary_value' => '5200', 'title' => 'Senior Drupal developer'],
      'Job posting',
    ];
    yield 'a person with a mapped job title' => [
      'ProfilePage',
      ['name' => 'Mira Kallio', 'jobTitle' => 'Conductor'],
      'Conductor',
    ];
    yield 'a person without one' => ['ProfilePage', ['name' => 'Mira Kallio'], ''];
    yield 'a basic page' => ['WebPage', ['name' => 'About our team'], ''];
    yield 'an about page' => ['AboutPage', [], ''];
    yield 'a place' => ['LocalBusiness', ['address_addressLocality' => 'Helsinki'], ''];
    yield 'not a registry type' => ['Nothing', [], ''];
  }

  /**
   * The card draws the line in capitals.
   */
  #[RequiresFunction('imagettftext')]
  public function testCapitals(): void {
    self::assertSame('EVENT · JUNE 19, 2027', ShareLayout::label($this->line('Event', ['startDate' => self::START]))['text']);
  }

  /**
   * Finnish month names; the same date a composed title holds.
   */
  public function testLanguage(): void {
    $cacheability = new CacheableMetadata();
    self::assertSame('Event · 19. kesäkuuta 2027', $this->line('Event', ['startDate' => self::START], 'fi', 'FI', $cacheability));
    self::assertContains('config:system.date', $cacheability->getCacheTags());
    foreach (['en', 'fi', 'de', 'pt-br'] as $langcode) {
      $composed = $this->words('GB')->items([self::START], 'date', 0, $langcode, TRUE, FALSE, new CacheableMetadata());
      self::assertSame("Event · $composed", $this->line('Event', ['startDate' => self::START], $langcode, 'GB'), $langcode);
    }
  }

  /**
   * No kind shows a price, pay or duration.
   */
  public function testNoPricePayOrDuration(): void {
    $values = [
      'offers_price' => '99.95',
      'offers_priceCurrency' => 'EUR',
      'baseSalary_value' => '5200',
      'baseSalary_currency' => 'EUR',
      'totalTime' => 'PT45M',
      'prepTime' => 'PT15M',
      'cookTime' => 'PT30M',
      'duration' => 'PT2H',
    ];
    foreach (array_keys(SchemaGraph::types()) as $type) {
      $line = $this->line($type, $values);
      self::assertDoesNotMatchRegularExpression('/99|EUR|5200|PT|45|€/', $line, $type);
    }
  }

}
