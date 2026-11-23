<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Datetime\DateFormatterInterface;
use Drupal\Core\StringTranslation\TranslationInterface;

// cspell:ignore subtag subtags
/**
 * Field and fact values read as words for people, in a place that composes.
 *
 * The only place a value is formatted for people: a date in the long style of
 * the item's locale, a decimal with the locale's marks, several items joined
 * with the language's list separator. Sources gives machine values; the
 * dialog shows what this gives (Resolver::sourceRows()). No configuration:
 * the locale is the item's language with its region, else the site's
 * default country.
 *
 * @internal
 */
final class Words {

  /**
   * Whether PHP's intl extension is there; without it, the fallbacks.
   */
  private readonly bool $intl;

  public function __construct(
    private readonly ConfigFactoryInterface $configFactory,
    private readonly DateFormatterInterface $dateFormatter,
    private readonly TranslationInterface $translation,
    ?bool $intl = NULL,
  ) {
    $this->intl = $intl ?? extension_loaded('intl');
  }

  /**
   * The items of a field, read as one text.
   *
   * @param list<string> $items
   *   The machine values visitors may see, in field order (Sources).
   * @param string $as
   *   How to read them: date, timestamp, decimal, number, html or text.
   * @param int $scale
   *   A decimal's digits after the point.
   * @param string $langcode
   *   The item's language.
   * @param bool $line
   *   A title-like place: at most two items, then "and ‹n› more".
   * @param bool $whole
   *   Formatted text gives all its text (a part of a composition), not its
   *   start (a whole link).
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the words depend on.
   */
  public function items(array $items, string $as, int $scale, string $langcode, bool $line, bool $whole, CacheableMetadata $cacheability): string {
    $words = [];
    foreach ($items as $item) {
      $one = match ($as) {
        'date' => $this->date($item, $langcode, $cacheability),
        'timestamp' => is_numeric($item) ? $this->date('@' . (int) $item, $langcode, $cacheability) : '',
        'decimal' => $this->decimal($item, $scale, $langcode, $cacheability),
        'html' => $whole ? Values::fromHtml($item) : Values::excerpt(Values::fromHtml($item)),
        default => $item,
      };
      $one = Values::plain($one, PHP_INT_MAX);
      if ($one !== '') {
        $words[] = $one;
      }
    }
    return $this->join($words, $langcode, $line, $cacheability);
  }

  /**
   * Items joined with the language's list separator.
   *
   * In a title-like place at most two, then a translatable, plural-aware
   * "and ‹n› more".
   */
  public function join(array $items, string $langcode, bool $line, CacheableMetadata $cacheability): string {
    $cacheability->addCacheTags(['config:system.date']);
    $separator = $this->separator($this->locale($langcode));
    // An item that ends a sentence is followed by a space, never ".,"; in a
    // script without spaces, by nothing.
    $glue = static function (array $items) use ($separator): string {
      $text = '';
      foreach (array_values($items) as $at => $item) {
        $text .= match (TRUE) {
          $at === 0 => '',
          (bool) preg_match('/[。！？]["\'”’」』)\]]*$/u', $text) => '',
          (bool) preg_match('/[.!?…]["\'”’)\]]*$/u', $text) => ' ',
          default => $separator,
        } . $item;
      }
      return $text;
    };
    if (!$line || count($items) <= 2) {
      return $glue($items);
    }
    // The items are plain text, never escaped as markup: they go in after
    // the translation, in place of a mark no text holds.
    $mark = "\u{E000}";
    $more = (string) $this->translation->formatPlural(count($items) - 2, '@items and 1 more', '@items and @count more', [
      '@items' => $mark,
    ], ['langcode' => $langcode]);
    return strtr($more, [$mark => $glue(array_slice($items, 0, 2))]);
  }

  /**
   * A date for people: long style, no time, in the item's locale.
   *
   * @param string $value
   *   ISO 8601 with an offset (read in the site's timezone), a date alone
   *   (never moved a day), or "@" and a Unix timestamp.
   * @param string $langcode
   *   The item's language.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the date depends on: the site's country and timezone.
   */
  public function date(string $value, string $langcode, CacheableMetadata $cacheability): string {
    $cacheability->addCacheTags(['config:system.date']);
    $only = (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value);
    $zone = $only ? 'UTC' : $this->timezone();
    try {
      $date = new \DateTimeImmutable($value, new \DateTimeZone($zone));
    }
    catch (\Exception) {
      return '';
    }
    $date = $date->setTimezone(new \DateTimeZone($zone));
    if ($this->intl) {
      $formatter = new \IntlDateFormatter($this->locale($langcode), \IntlDateFormatter::LONG, \IntlDateFormatter::NONE, $zone, \IntlDateFormatter::GREGORIAN);
      $text = $formatter->format($date);
      if (is_string($text) && $text !== '') {
        return $text;
      }
    }
    return $this->dateFormatter->format($date->getTimestamp(), 'custom', 'j F Y', $zone, $langcode);
  }

  /**
   * A decimal's digits for people: to its scale, in the locale's marks.
   */
  public function decimal(string $digits, int $scale, string $langcode, CacheableMetadata $cacheability): string {
    if (!preg_match('/^(-?)(\d+)(?:\.(\d*))?$/D', trim($digits), $match)) {
      return '';
    }
    $cacheability->addCacheTags(['config:system.date']);
    // Rounded half up to the scale from the stored digits, never through a
    // float: a large or long decimal keeps every digit.
    [, $sign, $whole, $fraction] = $match + [3 => ''];
    $fraction = str_pad($fraction, $scale + 1, '0');
    $kept = $whole . substr($fraction, 0, $scale);
    if ($fraction[$scale] >= '5') {
      $kept = self::increment($kept);
    }
    $whole = ltrim(substr($kept, 0, strlen($kept) - $scale), '0') ?: '0';
    $fraction = substr($kept, strlen($kept) - $scale);
    $sign = $sign === '-' && trim($kept, '0') !== '' ? '-' : '';
    if (!$this->intl) {
      return $sign . $whole . ($scale > 0 ? ".$fraction" : '');
    }
    $formatter = new \NumberFormatter($this->locale($langcode), \NumberFormatter::DECIMAL);
    $formatter->setAttribute(\NumberFormatter::MIN_FRACTION_DIGITS, $scale);
    $formatter->setAttribute(\NumberFormatter::MAX_FRACTION_DIGITS, $scale);
    // Within a float's 15 exact digits, the locale's own rules (grouping,
    // its minimum); past them, the digits with its decimal mark.
    if (strlen(ltrim($whole . $fraction, '0')) <= 15) {
      $text = $formatter->format((float) ($sign . $whole . '.' . $fraction));
      if (is_string($text)) {
        return $text;
      }
    }
    return $sign . $whole . ($scale > 0 ? $formatter->getSymbol(\NumberFormatter::DECIMAL_SEPARATOR_SYMBOL) . $fraction : '');
  }

  /**
   * A string of digits plus one.
   */
  private static function increment(string $digits): string {
    for ($at = strlen($digits) - 1; $at >= 0; $at--) {
      if ($digits[$at] !== '9') {
        $digits[$at] = (string) ((int) $digits[$at] + 1);
        return $digits;
      }
      $digits[$at] = '0';
    }
    return '1' . $digits;
  }

  /**
   * The item's locale: its language with its own region, else the country.
   *
   * "pt-br" is pt_BR; "en" on a site in the United Kingdom en_GB; a script
   * subtag stays ("zh-hant" is zh_Hant). Without a country, the language.
   */
  public function locale(string $langcode): string {
    $subtags = explode('-', strtolower($langcode));
    $language = array_shift($subtags);
    $locale = $language;
    $region = NULL;
    foreach ($subtags as $subtag) {
      if (strlen($subtag) === 4) {
        $locale .= '_' . ucfirst($subtag);
      }
      elseif (preg_match('/^([a-z]{2}|\d{3})$/D', $subtag)) {
        $region = strtoupper($subtag);
      }
    }
    $region ??= strtoupper((string) $this->configFactory->get('system.date')->get('country.default')) ?: NULL;
    return $region === NULL ? $locale : "{$locale}_$region";
  }

  /**
   * The middle separator of a locale's standard list pattern.
   *
   * From ICU's locale data: ", " in English, "、" in Japanese. Without it,
   * ", ".
   */
  private function separator(string $locale): string {
    if ($this->intl) {
      $language = explode('_', $locale)[0];
      foreach (array_unique([$locale, $language, 'root']) as $name) {
        $bundle = \ResourceBundle::create($name, NULL);
        $pattern = $bundle?->get('listPattern')?->get('standard')?->get('middle');
        if (is_string($pattern) && preg_match('/^\{0\}(.*)\{1\}$/uD', $pattern, $match)) {
          return $match[1];
        }
      }
    }
    return ', ';
  }

  /**
   * The site's default timezone.
   */
  private function timezone(): string {
    return (string) ($this->configFactory->get('system.date')->get('timezone.default') ?: 'UTC');
  }

}
