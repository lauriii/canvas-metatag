<?php

declare(strict_types=1);

namespace Drupal\canvas_metatag;

use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\StringTranslation\TranslationInterface;

/**
 * The share card's small line: what kind of page it is.
 *
 * Read from the type registry: an article (any of its variants) with its
 * published date, an event with its start date, a product, recipe or job
 * posting by name, a person's profile by their job title; nothing for any
 * other kind, so a page-like type has no line. Dates are written by Words,
 * as a composed title writes them: long, without a time, in the item's
 * locale. Never a price, pay or duration.
 *
 * @internal
 */
final class ShareLabel {

  /**
   * Kinds named on the card: registry type => the property holding its date.
   *
   * NULL: the name alone.
   */
  private const NAMED = [
    'Article' => 'datePublished',
    'Event' => 'startDate',
    'Product' => NULL,
    'Recipe' => NULL,
    'JobPosting' => NULL,
  ];

  /**
   * The small line for a page of a registry type, or ''.
   *
   * @param string $type
   *   The registry type id of the page's structured data.
   * @param array<string, string> $values
   *   The type's property values visitors may see, by registry key, as
   *   machine values (an ISO 8601 date, plain text).
   * @param string $langcode
   *   The page's language.
   * @param \Drupal\canvas_metatag\Words $words
   *   Reads a date for people.
   * @param \Drupal\Core\StringTranslation\TranslationInterface $translation
   *   Translates the registry's kind names.
   * @param \Drupal\Core\Cache\CacheableMetadata $cacheability
   *   Collects what the line depends on.
   */
  public static function text(string $type, array $values, string $langcode, Words $words, TranslationInterface $translation, CacheableMetadata $cacheability): string {
    $types = SchemaGraph::types();
    if (!isset($types[$type])) {
      return '';
    }
    if (($types[$type]['primary_type'] ?? '') === 'Person') {
      return Values::plain($values['jobTitle'] ?? '', ShareText::MAX);
    }
    $family = $types[$type]['variant_of'] ?? $type;
    if (!array_key_exists($family, self::NAMED)) {
      return '';
    }
    $options = ['context' => 'canvas_metatag:schema', 'langcode' => $langcode];
    $name = (string) $translation->translate($types[$family]['label'], [], $options);
    $date_key = self::NAMED[$family];
    $date = $date_key !== NULL && ($values[$date_key] ?? '') !== '' ? $words->date($values[$date_key], $langcode, $cacheability) : '';
    return $date === '' ? $name : "$name · $date";
  }

}
