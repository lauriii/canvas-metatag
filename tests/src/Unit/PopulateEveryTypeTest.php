<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Values;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests that every offered type reaches its verdict with no custom JSON-LD.
 *
 * One fixture per type and scope in tests/fixtures/graphs: the values (typed,
 * facts, page picks and field links, as the complex fixture's content gives
 * them), the expected graph, report and verdicts. Each emitted value is
 * checked against the values its feature accepts and the form its property
 * declares, so a URL where a code belongs fails.
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class PopulateEveryTypeTest extends UnitTestCase {

  /**
   * Each fixture: the graph, the report and the verdicts.
   */
  #[DataProvider('providerFixtures')]
  public function testFixture(string $name): void {
    $fixture = json_decode((string) file_get_contents(self::dir() . "/$name.json"), TRUE, 64, JSON_THROW_ON_ERROR);
    self::assertArrayNotHasKey('custom', $fixture['schema'], 'Filled without custom JSON-LD.');
    self::assertArrayNotHasKey('extend', $fixture['schema'], 'Filled without hand-added details.');
    // Through routes the dialog can save: every value is kept as it is.
    [$clean, $errors] = Values::clean(['schema' => $fixture['schema']], $fixture['ctx']['scope'] ?? 'page', static fn (): bool => TRUE);
    self::assertSame([], $errors);
    self::assertEqualsCanonicalizing(array_keys($fixture['schema']['props'] ?? []), array_keys($clean['schema']['props'] ?? []));
    $built = SchemaGraph::build($fixture['ctx'], $fixture['schema'], self::values($fixture));
    self::assertSame($fixture['graph'], $built['graph']);
    self::assertSame($fixture['report'], array_diff_key($built, ['graph' => TRUE]));
    $verdicts = SchemaGraph::features($built['graph'], [
      'home' => $fixture['ctx']['home'],
      'url' => $fixture['ctx']['url'],
      'front' => FALSE,
      'type' => $built['type'],
      'scope' => $fixture['ctx']['scope'] ?? 'page',
      'gates' => $built['gates'],
      'extra' => isset($built['withheld']['node']) ? [$built['withheld']['node']] : [],
      'judged' => $built['judged'],
      'incomplete' => $built['incomplete'],
      'items' => $built['items'],
      'today' => $fixture['ctx']['today'],
    ]);
    self::assertSame($fixture['verdicts'], $verdicts);

    // Every @id is absolute and unique.
    $ids = array_column($built['graph']['@graph'], '@id');
    self::assertSame($ids, array_unique($ids));
    array_walk_recursive($built['graph'], static function (mixed $value, int|string $key): void {
      if ($key === '@id') {
        self::assertMatchesRegularExpression('~^https://~', $value);
      }
    });
    self::assertValueRules($built, $verdicts);
  }

  /**
   * Data provider for testFixture().
   */
  public static function providerFixtures(): \Generator {
    foreach (glob(self::dir() . '/*.json') as $file) {
      yield basename($file, '.json') => [basename($file, '.json')];
    }
  }

  /**
   * Every emitted value is in the form its property and its feature say.
   *
   * An enum emitted as a schema.org URL is one, a code is a bare code, and
   * a value a feature lists the accepted values of is one of them.
   */
  private static function assertValueRules(array $built, array $verdicts): void {
    $main = array_values(array_filter($built['graph']['@graph'], static fn (array $node): bool => str_ends_with($node['@id'], '#primary')))[0] ?? NULL;
    if ($main === NULL) {
      return;
    }
    $rules = SchemaGraph::searchFeatures()['features'];
    foreach (array_filter(array_column($verdicts, 'feature')) as $feature) {
      foreach ($rules[$feature]['accepts'] ?? [] as $path => $accepted) {
        foreach (self::at($main, $path) as $value) {
          self::assertContains($value, $accepted, "$feature accepts $path");
        }
      }
    }
    foreach (SchemaGraph::types()[$built['type']]['props'] ?? [] as $prop) {
      if ($prop['kind'] !== 'enum' || ($prop['emit'] ?? 'url') === FALSE || ($prop['emit'] ?? 'url') === 'type') {
        continue;
      }
      foreach (self::at($main, str_replace('_', '.', $prop['key'])) as $value) {
        $value = is_array($value) ? $value['name'] ?? '' : $value;
        if (($prop['emit'] ?? 'url') === 'url') {
          self::assertStringStartsWith('https://schema.org/', $value, $prop['key']);
        }
        else {
          self::assertContains($value, SchemaGraph::options($prop), $prop['key']);
        }
      }
    }
  }

  /**
   * The values at a dotted path; a list on the way gives each of its items.
   */
  private static function at(mixed $node, string $path): array {
    $values = [$node];
    foreach (explode('.', $path) as $segment) {
      $next = [];
      foreach ($values as $value) {
        foreach (is_array($value) && array_is_list($value) ? $value : [$value] as $item) {
          if (is_array($item) && array_key_exists($segment, $item)) {
            $found = $item[$segment];
            array_push($next, ...(is_array($found) && array_is_list($found) ? $found : [$found]));
          }
        }
      }
      $values = $next;
    }
    return $values;
  }

  /**
   * What a value gives, by the fixture: as the resolver gives it.
   */
  private static function values(array $fixture): \Closure {
    return static function (array $value, string $kind, bool $list = FALSE) use ($fixture): mixed {
      $found = match (array_key_first($value)) {
        'text' => $value['text'],
        'fact' => $kind === 'image' ? $fixture['images'][$value['fact']] ?? NULL : $fixture['facts'][$value['fact']] ?? '',
        'media' => $fixture['images'][$value['media']] ?? NULL,
        'node' => $fixture['nodes'][$value['node']] ?? NULL,
        'source' => $fixture['links'][$value['source']['expression']] ?? NULL,
        default => NULL,
      };
      $many = is_array($found) && array_is_list($found);
      if ($list) {
        return $many ? $found : ($found === NULL || $found === '' ? [] : [$found]);
      }
      // A field link gives its first item.
      return $many ? $found[0] ?? NULL : $found;
    };
  }

  /**
   * The fixtures' directory.
   */
  private static function dir(): string {
    return dirname(__DIR__, 2) . '/fixtures/graphs';
  }

}
