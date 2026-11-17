<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\Vocabulary;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests trimming a schema.org release to what the form needs.
 */
#[CoversClass(Vocabulary::class)]
#[Group('canvas_metatag')]
final class VocabularyTest extends UnitTestCase {

  /**
   * The fixture release, trimmed.
   */
  public static function trimmed(): array {
    $release = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/tests/fixtures/vocabulary/release.jsonld'), TRUE, 64, JSON_THROW_ON_ERROR);
    return Vocabulary::build($release, [
      'source' => 'https://schema.org/version/30.1/schemaorg-current-https.jsonld',
      'release' => '30.1',
    ]);
  }

  /**
   * Types, details and codes; never datatypes, enumerations or retired terms.
   */
  public function testBuild(): void {
    $vocabulary = self::trimmed();
    // What it is, and whose it is.
    self::assertSame('30.1', $vocabulary['release']);
    self::assertSame('https://schema.org/version/30.1/schemaorg-current-https.jsonld', $vocabulary['source']);
    self::assertStringStartsWith('CC BY-SA 3.0', $vocabulary['licence']);
    self::assertStringContainsString('schema.org', $vocabulary['attribution']);

    self::assertSame([
      'AggregateRating',
      'EmployerAggregateRating',
      'EndorsementRating',
      'Intangible',
      'Organization',
      'Rating',
      'Thing',
    ], array_keys($vocabulary['types']));
    self::assertSame([
      'parents' => ['AggregateRating'],
      'about' => 'An aggregate rating of an Organization related to its role as an employer.',
    ], $vocabulary['types']['EmployerAggregateRating']);
    // Pending types say so; a definition is its first sentence.
    self::assertTrue($vocabulary['types']['EndorsementRating']['pending']);
    self::assertSame('An EndorsementRating is a rating that expresses some level of endorsement, for example inclusion in a "critic\'s pick" blog.', $vocabulary['types']['EndorsementRating']['about']);
    self::assertSame('The rating for the content.', $vocabulary['properties']['ratingValue']['about']);
    self::assertSame(['Number', 'Text'], $vocabulary['properties']['ratingValue']['ranges']);
    self::assertSame(['AggregateRating'], $vocabulary['properties']['itemReviewed']['domains']);
    // A superseded detail names its replacement; a retired one is gone.
    self::assertSame('review', $vocabulary['properties']['reviews']['superseded']);
    self::assertArrayNotHasKey('feed', $vocabulary['properties']);
    self::assertSame(['ItemAvailability' => ['InStock', 'OutOfStock']], $vocabulary['members']);
  }

  /**
   * A definition is plain text: a Markdown link reads as its words.
   */
  public function testPlainDefinitions(): void {
    $vocabulary = Vocabulary::build([
      '@graph' => [
        [
          '@id' => 'schema:Thing',
          '@type' => 'rdfs:Class',
          'rdfs:comment' => 'The most generic type, see [the reference](https://reference.example/wiki/Thing) and https://example.com/thing. More text.',
        ],
      ],
    ]);
    self::assertSame('The most generic type, see the reference and.', $vocabulary['types']['Thing']['about']);

    // A source clause goes whole; "e.g." doesn't end the sentence.
    $vocabulary = Vocabulary::build([
      '@graph' => [
        [
          '@id' => 'schema:Room',
          '@type' => 'rdfs:Class',
          'rdfs:comment' => 'A room is a space (source: An encyclopedia, see <a href="http://encyclopedia.example/wiki/Room">http://encyclopedia.example/wiki/Room</a>).<br/><br/>More.',
        ],
        [
          '@id' => 'schema:Episode',
          '@type' => 'rdfs:Class',
          'rdfs:comment' => 'A media episode (e.g. TV, radio, video game) which can be part of a series or season. More.',
        ],
      ],
    ]);
    self::assertSame('A room is a space.', $vocabulary['types']['Room']['about']);
    self::assertSame('A media episode (e.g. TV, radio, video game) which can be part of a series or season.', $vocabulary['types']['Episode']['about']);
  }

}
