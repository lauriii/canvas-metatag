<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests that the type registry and the search features agree.
 *
 * The registry decides what ships; the rules decide what a feature needs. A
 * detail the module withholds a node for must be one a feature asks for, and
 * a fact a feature asks for must be one the editor can set.
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class RegistryConsistencyTest extends UnitTestCase {

  /**
   * Each live feature that is judged on a type's own nodes, by type.
   *
   * @return array<string, array<string, array>>
   *   Type id => feature id => feature.
   */
  private static function byType(): array {
    $by = [];
    foreach (SchemaGraph::types() as $id => $type) {
      $own = array_filter([$type['primary_type'] ?? NULL, $type['page_type'] ?? NULL]);
      foreach (SchemaGraph::searchFeatures()['features'] as $name => $feature) {
        if ($feature['status'] === 'shown' && !isset($feature['node']) && array_intersect($own, $feature['on'])) {
          $by[$id][$name] = $feature;
        }
      }
    }
    return $by;
  }

  /**
   * Every required detail is required by the type's least demanding feature.
   */
  public function testRequiredMeansRequired(): void {
    $by = self::byType();
    self::assertArrayHasKey('Product', $by);
    foreach (SchemaGraph::types() as $id => $type) {
      $required = array_column(array_filter($type['props'] ?? [], static fn (array $prop): bool => ($prop['level'] ?? '') === 'required'), 'key');
      if (!isset($by[$id])) {
        // No feature: Plans for a service, the web page family.
        continue;
      }
      $features = $by[$id];
      usort($features, static fn (array $a, array $b): int => count($a['required']) <=> count($b['required']));
      $least = $features[0];
      foreach ($required as $key) {
        $asked = FALSE;
        foreach ($least['required'] as $entry) {
          foreach ((array) $entry as $one) {
            foreach (explode('|', $one) as $path) {
              $asked = $asked || SchemaGraph::propOf($path, $id) === $key;
            }
          }
        }
        self::assertTrue($asked, "$id withholds its node without $key; its least demanding feature does not ask for it.");
      }
    }
  }

  /**
   * What a feature needs and nothing fills by default comes first.
   *
   * At most four details come before More details.
   */
  public function testMainDetails(): void {
    $by = self::byType();
    foreach (SchemaGraph::types() as $id => $type) {
      $props = array_column($type['props'] ?? [], NULL, 'key');
      $main = $type['main'] ?? [];
      self::assertLessThanOrEqual(4, count($main), $id);
      self::assertSame([], array_diff($main, array_keys($props)), "$id shows only its own details first.");
      foreach ($by[$id] ?? [] as $name => $feature) {
        foreach ($feature['required'] as $entry) {
          $key = SchemaGraph::propOf(explode('|', ((array) $entry)[0])[0], $id);
          if ($key !== NULL && !isset($props[$key]['default']) && $props[$key]['kind'] !== 'currency') {
            self::assertContains($key, $main, "$id: $name needs $key, which nothing fills.");
          }
        }
      }
    }
  }

  /**
   * Every fact a feature asks for is set with a detail or a site setting.
   */
  public function testPathsAreSettable(): void {
    $rules = SchemaGraph::searchFeatures();
    $by = self::byType();
    foreach ($rules['features'] as $name => $feature) {
      if ($feature['status'] !== 'shown') {
        continue;
      }
      $types = array_keys(array_filter($by, static fn (array $features): bool => isset($features[$name])));
      $entries = [
        ...$feature['required'],
        ...$feature['complete'] ?? [],
        ...$feature['recommended'] ?? [],
        ...array_column($feature['rules'] ?? [], 'path'),
      ];
      foreach ($entries as $entry) {
        $settable = FALSE;
        foreach ((array) $entry as $one) {
          foreach (explode('|', $one) as $path) {
            $settable = $settable
              // What the module always emits, such as an offer's type.
              || str_ends_with($path, '@type')
              || (isset($feature['node']) && isset($rules['site'][$path]))
              || array_filter($types, static fn (string $type): bool => SchemaGraph::propOf($path, $type) !== NULL);
          }
        }
        self::assertTrue((bool) $settable, "$name: " . json_encode($entry) . ' is set by nothing.');
      }
      if (!isset($feature['node'])) {
        self::assertNotEmpty($types, "$name applies to a type of the registry.");
      }
    }
  }

}
