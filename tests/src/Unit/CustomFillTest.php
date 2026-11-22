<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests whole values in hand-added JSON-LD filled from fields and media.
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class CustomFillTest extends UnitTestCase {

  private const UUID = '6f1c2a0e-5b7d-4c1e-9a53-0d6f7c1b2e44';

  /**
   * The hand-added item a template outputs for one item.
   *
   * @param array $item
   *   The item as written.
   * @param array<string, array{0: string, 1: mixed}> $fields
   *   Name inside "{field.…}" => what the fill gives (status, value).
   * @param array<string, array> $media
   *   Media UUID => image.
   *
   * @return array{0: ?array, 1: array}
   *   The output item (NULL when left out) and the report.
   */
  private static function fill(array $item, array $fields = [], array $media = []): array {
    $asked = [];
    $result = SchemaGraph::build([
      'home' => 'https://www.example.com/',
      'url' => 'https://www.example.com/reviews/orchard',
      'scope' => 'template',
      'identity' => ['kind' => 'organization', 'name' => 'Example', 'same_as' => []],
      'facts' => ['title' => 'The Quiet Orchard'],
      'fill' => static function (string $name, string $expects) use ($fields, &$asked): array {
        $asked[$name] = $expects;
        return $fields[$name] ?? ['broken', NULL];
      },
    ], ['custom' => (string) json_encode(['@type' => 'Review', '@id' => '#review'] + $item)], static fn (array $value): mixed => $media[$value['media'] ?? ''] ?? NULL);
    $hand = array_values(array_filter($result['nodes'], static fn (array $node): bool => $node['origin'] === 'hand'))[0];
    return [isset($hand['at']) ? $result['graph']['@graph'][$hand['at']] : NULL, $result + ['asked' => $asked]];
  }

  /**
   * A whole value fills; the same name inside other text stays literal.
   */
  public function testWholeValues(): void {
    [$item, $report] = self::fill([
      'reviewRating' => ['@type' => 'Rating', 'ratingValue' => '{field.field_score}', 'bestRating' => 5],
      'name' => 'By {field.field_byline}',
      'author' => ['@type' => 'Person', 'name' => '{field.field_byline}'],
      'headline' => '{title}',
      'identifier' => '{field.field_code}',
      'image' => '{media.' . self::UUID . '}',
    ], [
      'field_score' => ['ok', 4.5],
      'field_byline' => ['ok', 'Mia Virtanen'],
      'field_code' => ['ok', '42'],
    ], [self::UUID => ['url' => 'https://www.example.com/files/orchard.jpg', 'width' => 10, 'height' => 10]]);
    self::assertSame(4.5, $item['reviewRating']['ratingValue']);
    self::assertSame('By {field.field_byline}', $item['name']);
    self::assertSame(['@type' => 'Person', 'name' => 'Mia Virtanen'], $item['author']);
    self::assertSame('The Quiet Orchard', $item['headline']);
    // "42" from a text field stays text.
    self::assertSame('42', $item['identifier']);
    self::assertSame('https://www.example.com/files/orchard.jpg', $item['image']);
    // A number is asked for only where the name expects one.
    self::assertSame('number|text', $report['asked']['field_score']);
    self::assertSame('', $report['asked']['field_code']);
    self::assertArrayNotHasKey('empty', $report);
  }

  /**
   * An empty fill leaves out only what it empties, and says where.
   */
  public function testEmptyFills(): void {
    // A review without a score keeps the review without its rating.
    [$item, $report] = self::fill([
      'reviewRating' => ['@type' => 'Rating', 'ratingValue' => '{field.field_score}', 'bestRating' => 5],
      'reviewBody' => 'Lovely.',
      'sameAs' => ['{field.field_site}', '{field.field_social}'],
      'image' => '{media.' . self::UUID . '}',
    ], [
      'field_score' => ['empty', NULL],
      'field_site' => ['ok', 'https://orchard.example'],
      'field_social' => ['hidden', NULL],
    ]);
    self::assertSame([
      '@type' => 'Review',
      '@id' => 'https://www.example.com/reviews/orchard#review',
      'reviewBody' => 'Lovely.',
      'sameAs' => ['https://orchard.example'],
    ], $item);
    self::assertSame([
      ['path' => 'reviewRating.ratingValue', 'item' => 0, 'name' => 'field.field_score', 'status' => 'empty'],
      ['path' => 'sameAs.1', 'item' => 0, 'name' => 'field.field_social', 'status' => 'hidden'],
      ['path' => 'image', 'item' => 0, 'name' => 'media.' . self::UUID, 'status' => 'gone'],
    ], $report['empty']);

    // A list left empty goes; an item left with only its type and id goes.
    [$item, $report] = self::fill(['sameAs' => ['{field.field_social}']], ['field_social' => ['empty', NULL]]);
    self::assertNull($item);
    self::assertSame('empty', array_column($report['nodes'], 'left_out', 'origin')['hand']);

    // A link that cannot be read is left out as broken.
    [$item] = self::fill(['reviewBody' => 'Fine.', 'author' => '{field.field_gone}']);
    self::assertArrayNotHasKey('author', $item);
  }

  /**
   * Filled text passes the scheme rule typed text passes.
   */
  public function testFilledTextKeepsTheSchemeRule(): void {
    [$item, $report] = self::fill([
      'reviewBody' => '{field.field_body}',
      'url' => '{field.field_link}',
      'sameAs' => ['{field.field_site}', '{field.field_other}'],
    ], [
      'field_body' => ['ok', 'Data: collected in 2026'],
      'field_link' => ['ok', "java	script:alert(1)"],
      'field_site' => ['ok', 'https://orchard.example'],
      'field_other' => ['ok', 'data:text/html,x'],
    ]);
    self::assertSame('Data: collected in 2026', $item['reviewBody']);
    self::assertArrayNotHasKey('url', $item);
    self::assertSame(['https://orchard.example'], $item['sameAs']);
    self::assertSame([
      ['path' => 'url', 'item' => 0, 'name' => 'field.field_link', 'status' => 'broken'],
      ['path' => 'sameAs.1', 'item' => 0, 'name' => 'field.field_other', 'status' => 'broken'],
    ], $report['empty']);
    // An address is asked for where the name expects one.
    self::assertSame('url', $report['asked']['field_link']);
    self::assertSame('url', $report['asked']['field_site']);
  }

}
