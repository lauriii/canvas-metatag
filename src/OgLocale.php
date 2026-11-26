<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

/**
 * A page's language as og:locale: language_TERRITORY.
 *
 * From data/locales.json: the region in the langcode ("pt-br" is pt_BR),
 * else the site's default country when the file lists it for the language,
 * else the file's default territory for it. A language the file does not
 * list has none.
 *
 * @internal
 */
final class OgLocale {

  /**
   * The file's languages: langcode => territories, the default first.
   *
   * @var array<string, list<string>>|null
   */
  private static ?array $languages = NULL;

  /**
   * The og:locale of a langcode, or '' for none.
   *
   * @param string $langcode
   *   A Drupal langcode.
   * @param string $country
   *   The site's default country (ISO 3166-1 alpha-2), or ''.
   */
  public static function of(string $langcode, string $country): string {
    self::$languages ??= json_decode((string) file_get_contents(dirname(__DIR__) . '/data/locales.json'), TRUE, 8, JSON_THROW_ON_ERROR)['languages'];
    $subtags = explode('-', strtolower($langcode));
    $language = $subtags[0];
    $territories = self::$languages[strtolower($langcode)] ?? self::$languages[$language] ?? NULL;
    if ($territories === NULL || !preg_match('/^[a-z]{2,3}$/D', $language)) {
      return '';
    }
    $region = NULL;
    foreach (array_slice($subtags, 1) as $subtag) {
      if (preg_match('/^[a-z]{2}$/D', $subtag)) {
        $region = strtoupper($subtag);
      }
    }
    $country = strtoupper($country);
    $region ??= in_array($country, $territories, TRUE) ? $country : $territories[0];
    return "{$language}_$region";
  }

}
