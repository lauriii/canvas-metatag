<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests that the search features rules file says what the dialog needs.
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class SearchFeaturesFileTest extends UnitTestCase {

  /**
   * Every feature has its source, where it shows and dated retirements.
   */
  public function testFile(): void {
    $rules = SchemaGraph::searchFeatures();
    self::assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/D', $rules['reviewed']);
    self::assertNotEmpty($rules['features']);
    foreach ($rules['features'] as $id => $feature) {
      self::assertMatchesRegularExpression('/^[a-z]+(-[a-z]+)*$/D', $id);
      self::assertNotSame('', $feature['label'], $id);
      self::assertMatchesRegularExpression('/^[A-Z].*\.$/', $feature['where'], "$id says where it appears in one sentence.");
      self::assertNotEmpty($feature['on'], $id);
      self::assertContains($feature['status'], ['shown', 'retired'], $id);
      // The source: the documentation of a live feature, the changelog
      // entry of a retired one, never the removed documentation.
      $source = $feature['status'] === 'shown' ? $feature['doc'] : $feature['changelog'];
      self::assertMatchesRegularExpression('~^https://[^\s]+$~', $source, $id);
      if ($feature['status'] === 'retired') {
        self::assertArrayNotHasKey('doc', $feature, $id);
        if (isset($feature['since'])) {
          self::assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/D', $feature['since'], $id);
        }
        continue;
      }
      self::assertLessThanOrEqual(2, count($feature['confirm'] ?? []), "$id: at most two guidelines.");
      // Every path is spelled as the documentation names it, and is worded.
      $paths = [
        ...self::paths($feature['required']),
        ...self::paths($feature['complete'] ?? []),
        ...self::paths($feature['recommended'] ?? []),
        ...array_column($feature['rules'] ?? [], 'path'),
      ];
      foreach ($paths as $path) {
        foreach (explode('.', $path) as $name) {
          self::assertTrue($name === '@type' || in_array($name, $feature['names'], TRUE), "$id: $name is a documented name.");
        }
      }
      // What a verdict names: the first path of each entry, and rule paths.
      $named = array_column($feature['rules'] ?? [], 'path');
      foreach ([...$feature['required'], ...$feature['complete'] ?? [], ...$feature['recommended'] ?? []] as $entry) {
        foreach ((array) $entry as $one) {
          $named[] = explode('|', $one)[0];
        }
      }
      foreach ($named as $path) {
        self::assertArrayHasKey($path, $rules['facts'], "$id: $path has a label and a need.");
      }
      foreach ($feature['not_for'] ?? [] as $not) {
        self::assertNotSame('', $not['reason']);
        self::assertMatchesRegularExpression('/^[A-Z].*\.$/', $not['why']);
      }
    }
    // The FAQ is dated from the changelog.
    self::assertSame('2026-05-07', $rules['features']['faq']['since']);
  }

  /**
   * The paths of required or recommended entries, one-of lists flattened.
   *
   * @return list<string>
   *   Each path, alternatives split.
   */
  private static function paths(array $entries): array {
    $paths = [];
    foreach ($entries as $entry) {
      foreach ((array) $entry as $one) {
        array_push($paths, ...explode('|', $one));
      }
    }
    return $paths;
  }

}
