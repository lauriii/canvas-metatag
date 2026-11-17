<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Values;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests the one list of ids the module emits, and the short ids.
 */
#[CoversClass(SchemaGraph::class)]
#[CoversClass(Values::class)]
#[Group('canvas_metatag')]
final class ModuleIdsTest extends UnitTestCase {

  /**
   * Every id a fixture graph's module nodes carry is on the list.
   */
  public function testEveryFixtureIdIsListed(): void {
    $files = glob(dirname(__DIR__, 3) . '/tests/fixtures/graphs/*.json');
    self::assertNotEmpty($files);
    foreach ($files as $file) {
      $fixture = json_decode((string) file_get_contents($file), TRUE, 64, JSON_THROW_ON_ERROR);
      $anchors = ['home' => $fixture['ctx']['home'], 'url' => $fixture['ctx']['url']];
      array_walk_recursive($fixture['graph'], static function (mixed $value, int|string $key) use ($anchors, $file): void {
        if ($key !== '@id' || !str_starts_with((string) $value, $anchors['home'])) {
          return;
        }
        // An id of another page of this site is that page's own.
        [$address, $name] = explode('#', (string) $value, 2) + [1 => ''];
        $anchor = SchemaGraph::MODULE_IDS[$name] ?? (str_starts_with($name, SchemaGraph::COMPONENT_PREFIX) ? 'url' : NULL);
        self::assertNotNull($anchor, basename($file) . ": $value");
        if ($anchor === 'home') {
          self::assertSame($anchors['home'], $address . '', basename($file) . ": $value");
        }
      });
    }
  }

  /**
   * A short id of the site's own items points at it from any page.
   */
  public function testShortIdsResolve(): void {
    $result = SchemaGraph::build([
      'home' => 'https://www.example.com/',
      'url' => 'https://www.example.com/about',
      'identity' => ['kind' => 'organization', 'name' => 'Example', 'same_as' => []],
    ], ['custom' => '{"@type": "Review", "@id": "#review", "author": {"@id": "#identity"}, "about": {"@id": "#local"}}'], static fn (): mixed => NULL);
    $review = end($result['graph']['@graph']);
    self::assertSame(['@id' => 'https://www.example.com/#identity'], $review['author']);
    self::assertSame(['@id' => 'https://www.example.com/about#local'], $review['about']);
    self::assertSame('https://www.example.com/about#review', $review['@id']);
  }

  /**
   * A hand-added item never takes one of the list's ids, nor another's.
   */
  public function testRefused(): void {
    self::assertSame(
      '“#webpage” is made by this page. Use Add details, or give the item another @id.',
      Values::clean(['schema' => ['custom' => '{"@type": "Thing", "@id": "#webpage"}']], 'page', static fn (): bool => TRUE)[1]['schema.custom'],
    );
    self::assertSame(
      '“#acme” is used by two items. Give the second another @id.',
      Values::clean(['schema' => ['custom' => '[{"@type": "Organization", "@id": "#acme"}, {"@type": "Organization", "@id": "#acme"}]']], 'page', static fn (): bool => TRUE)[1]['schema.custom'],
    );
    foreach (array_keys(SchemaGraph::MODULE_IDS) as $name) {
      self::assertTrue(Values::reserved("#$name"), $name);
    }
    self::assertTrue(Values::reserved('#c-0f9b'));
    self::assertFalse(Values::reserved('#identity-2'));
  }

}
