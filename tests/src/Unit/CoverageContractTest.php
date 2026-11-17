<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_metatag\Values;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests that every offered type can be filled without hand-written JSON-LD.
 *
 * For every type and every scope where it is offered: each property it
 * offers there has a way in that is not custom JSON-LD, each fact its
 * search features require is offered there, and a graph fixture proves the
 * type end to end (PopulateEveryTypeTest). extension/src/coverage.test.ts
 * walks the same registry in the dialog.
 */
#[CoversClass(SchemaGraph::class)]
#[CoversClass(Sources::class)]
#[Group('canvas_metatag')]
final class CoverageContractTest extends UnitTestCase {

  private const SCOPES = ['page', 'template'];

  /**
   * One literal of each kind, to find one a property accepts.
   */
  private const SAMPLES = [
    'text' => ['A name', 'SKU-1', '+358 9 123 4567'],
    'ref' => ['A name'],
    'url' => ['https://www.example.com/'],
    'date' => ['2026-07-01'],
    'number' => ['20', '60.17'],
    'currency' => ['EUR'],
    'hours' => ['Mo-Fr 09:00-17:00'],
  ];

  /**
   * How a property is filled on a scope without custom JSON-LD, or NULL.
   *
   * `default`: a fact, the publisher or an automatic value; `typed`: a
   * control accepts a literal; `media`: an image is chosen; `parts`: a
   * group's reference whose group is filled by its parts (a venue page on a
   * Canvas page, until the page picker ships); `link`: a field is linked,
   * by a kind of value a source row can give.
   */
  public static function route(array $prop, string $scope, string $type = ''): ?string {
    if (isset($prop['default']) || !empty($prop['site'])) {
      return 'default';
    }
    // A group's page reference is never typed: a name typed for the group
    // is its name part.
    if (SchemaGraph::typable($prop, $scope) && ($prop['group'] ?? NULL) !== $prop['key']) {
      $samples = $prop['kind'] === 'enum' ? array_slice(SchemaGraph::options($prop), 0, 1) : self::SAMPLES[$prop['kind']] ?? [];
      foreach ($samples as $sample) {
        if (SchemaGraph::literal($prop, $sample)) {
          return 'typed';
        }
      }
    }
    if ($prop['kind'] === 'image') {
      return 'media';
    }
    if ($scope === 'template' && in_array(Values::kindOf($prop), self::rowKinds(), TRUE)) {
      return 'link';
    }
    return isset($prop['group']) && $prop['group'] === $prop['key'] && self::partsRouted($type, $prop['group'], $scope) ? 'parts' : NULL;
  }

  /**
   * The kinds of value a source row gives (Sources::evaluate() reads these).
   *
   * Each shape the module asks Canvas for gives its kind; formatted text
   * also gives its markup, and a reference to content its target
   * (Sources::build()). Opening hours have none: no field type Canvas reads
   * gives a week.
   *
   * @return list<string>
   *   The kinds.
   */
  private static function rowKinds(): array {
    $shapes = (new \ReflectionClassConstant(Sources::class, 'SHAPES'))->getValue();
    return [...array_unique(array_column($shapes, 1)), 'html', 'ref'];
  }

  /**
   * Whether a group's own parts are each filled without JSON-LD on a scope.
   */
  private static function partsRouted(string $type, string $group, string $scope): bool {
    foreach (SchemaGraph::types()[$type]['props'] ?? [] as $prop) {
      if (($prop['group'] ?? NULL) === $group && $prop['key'] !== $group && SchemaGraph::offered($type, $prop['key'], $scope) && self::route($prop, $scope, $type) !== NULL) {
        return TRUE;
      }
    }
    return FALSE;
  }

  /**
   * Each live feature judged on a type's own main node, by type.
   *
   * @return array<string, array<string, array>>
   *   Type id => feature id => feature.
   */
  private static function features(): array {
    $by = [];
    foreach (SchemaGraph::types() as $id => $type) {
      $own = array_filter([$type['primary_type'] ?? NULL, $type['page_type'] ?? NULL]);
      foreach (SchemaGraph::searchFeatures()['features'] as $name => $feature) {
        if ($feature['status'] === 'shown' && !isset($feature['node']) && !isset($feature['list']) && array_intersect($own, $feature['on'])) {
          $by[$id][$name] = $feature;
        }
      }
    }
    return $by;
  }

  /**
   * Every offered property has a way in where its type is offered.
   */
  public function testEveryPropertyHasWayIn(): void {
    $checked = 0;
    foreach (SchemaGraph::types() as $id => $type) {
      foreach (self::SCOPES as $scope) {
        if (!SchemaGraph::offered($id, NULL, $scope)) {
          continue;
        }
        foreach ($type['props'] ?? [] as $prop) {
          if (!SchemaGraph::offered($id, $prop['key'], $scope)) {
            // Not offered: the registry says why, with a known reason.
            self::assertContains($prop['scopes'][$scope], SchemaGraph::SCOPE_REASONS, "$id.{$prop['key']}");
            continue;
          }
          self::assertNotNull(self::route($prop, $scope, $id), "$id on a $scope: {$prop['key']} can only be filled with custom JSON-LD.");
          $checked++;
        }
      }
    }
    self::assertGreaterThan(100, $checked);
  }

  /**
   * Every fact a type's search features require is offered with the type.
   */
  public function testRequiredFactsAreOffered(): void {
    foreach (self::features() as $id => $features) {
      foreach (self::SCOPES as $scope) {
        if (!SchemaGraph::offered($id, NULL, $scope)) {
          continue;
        }
        foreach ($features as $name => $feature) {
          foreach ($feature['required'] as $entry) {
            $offered = FALSE;
            foreach ((array) $entry as $one) {
              foreach (explode('|', $one) as $path) {
                $key = SchemaGraph::propOf($path, $id);
                $group = $key === NULL ? NULL : SchemaGraph::types()[$id]['groups'][$key] ?? NULL;
                $offered = $offered
                  || ($group !== NULL && array_filter($group['parts'], static fn (string $part): bool => SchemaGraph::prop($id, $part) === NULL || SchemaGraph::offered($id, $part, $scope)))
                  || ($key !== NULL && $group === NULL && SchemaGraph::offered($id, $key, $scope));
              }
            }
            self::assertTrue($offered, "$id on a $scope: $name requires " . json_encode($entry) . ', which is not offered there.');
          }
        }
      }
    }
  }

  /**
   * A graph fixture proves each offered type on each scope.
   */
  public function testEveryOfferedTypeHasFixture(): void {
    $dir = dirname(__DIR__, 2) . '/fixtures/graphs';
    $expected = [];
    foreach (array_keys(SchemaGraph::types()) as $id) {
      foreach (self::SCOPES as $scope) {
        if (SchemaGraph::offered($id, NULL, $scope)) {
          $expected[] = "$id.$scope";
          self::assertFileExists("$dir/$id.$scope.json");
        }
        else {
          self::assertFileDoesNotExist("$dir/$id.$scope.json", "$id is not offered on a $scope.");
        }
      }
    }
    // Every fixture is of a type the registry has, on a scope it is offered.
    foreach (glob("$dir/*.json") as $file) {
      $parts = explode('.', basename($file, '.json'));
      self::assertContains($parts[0] . '.' . end($parts), $expected, basename($file));
    }
  }

  /**
   * The contract fails for a property only custom JSON-LD could fill.
   */
  public function testUnroutablePropertyFails(): void {
    // A description that is linked only, on a Canvas page: why job postings
    // are offered on templates only.
    $description = ['key' => 'description', 'kind' => 'text', 'html' => TRUE, 'link_only' => TRUE];
    self::assertNull(self::route($description, 'page'));
    self::assertSame('link', self::route($description, 'template'));
    // A list of text on a Canvas page: it comes from a component.
    $ingredients = ['key' => 'recipeIngredient', 'kind' => 'text', 'list' => TRUE];
    self::assertNull(self::route($ingredients, 'page'));
    // A venue page on a Canvas page: the venue is filled by its parts.
    self::assertSame('parts', self::route(SchemaGraph::prop('Event', 'location'), 'page', 'Event'));
    self::assertSame('link', self::route(SchemaGraph::prop('Event', 'location'), 'template', 'Event'));
    // A kind no source row gives is never linked.
    self::assertNull(self::route(['key' => 'x', 'kind' => 'hours', 'link_only' => TRUE], 'template'));
    // Opening hours are typed in the week sheet, also on a template.
    self::assertSame('typed', self::route(['key' => 'openingHoursSpecification', 'kind' => 'hours'], 'template'));
    // A list of text is never typed, and is refused on a page.
    $recipe = SchemaGraph::types()['Recipe'];
    self::assertFalse(SchemaGraph::offered('Recipe', 'recipeIngredient', 'page'));
    self::assertTrue(SchemaGraph::offered('Recipe', 'recipeIngredient', 'template'));
    self::assertSame('component', array_column($recipe['props'], NULL, 'key')['recipeIngredient']['scopes']['page']);
    self::assertFalse(SchemaGraph::offered('JobPosting', NULL, 'page'));
    self::assertTrue(SchemaGraph::offered('JobPosting', NULL, 'template'));
  }

}
