<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests the registry's shapes, groups and attributes.
 *
 * Each attribute has one reader in PHP (SchemaGraph::ATTRIBUTES) and one in
 * TypeScript (extension/src/coverage.test.ts pins that list).
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class RegistryTest extends UnitTestCase {

  /**
   * The registry file as stored, shapes included.
   */
  private static function raw(): array {
    return json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/data/schema-types.json'), TRUE, 32, JSON_THROW_ON_ERROR);
  }

  /**
   * Every attribute is one the module reads, with a value it understands.
   */
  public function testAttributes(): void {
    foreach (SchemaGraph::types() as $id => $type) {
      $keys = array_column($type['props'] ?? [], 'key');
      self::assertSame($keys, array_unique($keys), "$id has each key once.");
      foreach ($type['props'] ?? [] as $prop) {
        $at = "$id.{$prop['key']}";
        self::assertSame([], array_diff(array_keys($prop), SchemaGraph::ATTRIBUTES), "$at: an attribute nothing reads.");
        if ($prop['kind'] === 'enum') {
          // An enum is emitted as a URL (the default), a code or the type,
          // or never: a gate.
          self::assertTrue(!isset($prop['emit']) || $prop['emit'] === FALSE || in_array($prop['emit'], SchemaGraph::EMIT, TRUE), "$at emit");
          self::assertNotEmpty(SchemaGraph::options($prop), "$at has choices.");
          foreach (array_keys($prop['option_labels'] ?? []) as $option) {
            self::assertContains($option, SchemaGraph::options($prop), "$at labels only its options.");
          }
        }
        else {
          self::assertArrayNotHasKey('emit', $prop, "$at: only an enum has emit.");
        }
        foreach ($prop['scopes'] ?? [] as $scope => $reason) {
          self::assertContains($scope, ['page', 'template'], $at);
          self::assertContains($reason, SchemaGraph::SCOPE_REASONS, $at);
        }
        if (isset($prop['unit'])) {
          self::assertSame('number', $prop['kind'], $at);
          self::assertArrayHasKey($prop['unit'], SchemaGraph::UNITS, $at);
          self::assertContains($prop['unit'], $prop['units'] ?? [$prop['unit']], $at);
        }
        if (isset($prop['pair'])) {
          self::assertSame($prop['key'], SchemaGraph::prop($id, $prop['pair'])['pair'] ?? NULL, "$at pairs both ways.");
        }
        foreach ($prop['when'] ?? [] as $gate => $values) {
          $gated = SchemaGraph::prop($id, $gate);
          self::assertSame('enum', $gated['kind'] ?? NULL, "$at is gated by an enum.");
          self::assertSame([], array_diff($values, SchemaGraph::options($gated)), "$at is gated by its options.");
        }
        if (isset($prop['under'])) {
          self::assertNotNull(SchemaGraph::prop($id, $prop['under']), $at);
        }
        if (isset($prop['codes'])) {
          self::assertNotEmpty(SchemaGraph::codes($prop['codes']), $at);
        }
        if ($prop['kind'] === 'ref') {
          self::assertArrayHasKey('accept', $prop, $at);
          foreach ($prop['accept'] as $accepted) {
            self::assertContains($accepted, ['Place', 'Person', 'Organization'], "$at accepts a kind the registry's types are.");
          }
        }
        // A list never holds a group: in a group, only its reference is one.
        if (!empty($prop['list']) && isset($prop['group'])) {
          self::assertSame($prop['group'], $prop['key'], "$at: a group never sits inside a list.");
        }
      }
    }
  }

  /**
   * Every use names a shape; groups require parts they have.
   */
  public function testShapesAndGroups(): void {
    $raw = self::raw();
    $shapes = $raw['$shapes'];
    foreach ($shapes as $name => $shape) {
      $parts = array_column($shape['parts'], 'key');
      foreach ($shape['requires'] as $entry) {
        self::assertSame([], array_diff($entry, $parts), "$name requires its own parts.");
      }
      foreach ($shape['parts'] as $part) {
        if (isset($part['use'])) {
          self::assertArrayHasKey($part['use'], $shapes, "$name uses a shape.");
        }
      }
    }
    foreach ($raw as $id => $type) {
      foreach (str_starts_with($id, '$') ? [] : $type['props'] ?? [] as $entry) {
        if (isset($entry['group'])) {
          self::assertArrayHasKey($entry['use'], $shapes, "$id.{$entry['group']} uses a shape.");
        }
      }
    }
    foreach (SchemaGraph::types() as $id => $type) {
      $keys = array_column($type['props'] ?? [], 'key');
      foreach ($type['groups'] ?? [] as $key => $group) {
        foreach ($group['parts'] as $part) {
          self::assertTrue(in_array($part, $keys, TRUE) || isset($type['groups'][$part]), "$id.$key: $part");
        }
        foreach ($group['requires'] as $entry) {
          self::assertSame([], array_diff($entry, $group['parts']), "$id.$key requires its parts.");
        }
        foreach ($group['needs'] ?? [] as $other) {
          self::assertContains($other, $keys, "$id.$key needs a property of the type.");
        }
        self::assertArrayHasKey($key, $type['nested'], "$id.$key is typed.");
      }
    }
    // The flattened keys of today's details stay as stored.
    $event = array_column(SchemaGraph::types()['Event']['props'], 'key');
    foreach ([
      'location_name',
      'location_address_streetAddress',
      'location_address_addressLocality',
      'location_address_postalCode',
      'location_address_addressCountry',
      'organizer_name',
      'offers_price',
    ] as $key) {
      self::assertContains($key, $event);
    }
    self::assertSame('Place', SchemaGraph::types()['Event']['nested']['location']);
    self::assertSame('PostalAddress', SchemaGraph::types()['Event']['nested']['location_address']);
    self::assertSame('QuantitativeValue', SchemaGraph::types()['JobPosting']['nested']['baseSalary_value']);
  }

  /**
   * Every slot of a sentence names a detail, a fact or a site setting.
   */
  public function testSentences(): void {
    foreach (SchemaGraph::types() as $id => $type) {
      foreach ($type['slots'] ?? [] as $name => $slot) {
        self::assertTrue(isset($slot['fact']) || isset($slot['site']) || SchemaGraph::prop($id, $slot['prop'] ?? '') !== NULL, "$id: {$name}");
      }
      foreach ($type['say'] ?? [] as $sentence) {
        foreach ($sentence as $variant) {
          preg_match_all('/\{(\w+)\}/', $variant, $m);
          self::assertSame([], array_diff($m[1], array_keys($type['slots'] ?? [])), "$id: $variant");
        }
      }
    }
  }

  /**
   * Where a type or property is offered, and literals of the new forms.
   */
  public function testOfferedAndLiterals(): void {
    self::assertTrue(SchemaGraph::offered('Recipe', NULL, 'page'));
    self::assertFalse(SchemaGraph::offered('Recipe', 'recipeInstructions', 'page'));
    self::assertFalse(SchemaGraph::offered('Event', 'performer', 'page'));
    self::assertTrue(SchemaGraph::offered('Event', 'performer', 'template'));
    self::assertFalse(SchemaGraph::offered('CollectionPage', 'items', 'page'));
    self::assertFalse(SchemaGraph::offered('Movie', NULL, 'page'));
    self::assertFalse(SchemaGraph::offered('Event', 'nope', 'page'));

    // Codes, a list of codes, a duration, a coordinate, hours.
    self::assertTrue(SchemaGraph::validLiteral('Event', 'location_address_addressCountry', 'FI'));
    self::assertFalse(SchemaGraph::validLiteral('Event', 'location_address_addressCountry', 'Finland'));
    self::assertTrue(SchemaGraph::validLiteral('JobPosting', 'applicantLocationRequirements', 'FI,SE'));
    self::assertFalse(SchemaGraph::validLiteral('JobPosting', 'applicantLocationRequirements', 'FI,FI'));
    self::assertFalse(SchemaGraph::validLiteral('JobPosting', 'applicantLocationRequirements', 'FI,XX'));
    self::assertTrue(SchemaGraph::validLiteral('Recipe', 'prepTime', '90'));
    self::assertFalse(SchemaGraph::validLiteral('Recipe', 'prepTime', '0'));
    self::assertFalse(SchemaGraph::validLiteral('Recipe', 'prepTime', '1.5'));
    self::assertTrue(SchemaGraph::validLiteral('LocalBusiness', 'geo_latitude', '-33.86'));
    self::assertFalse(SchemaGraph::validLiteral('LocalBusiness', 'geo_latitude', '91'));
    self::assertTrue(SchemaGraph::validLiteral('LocalBusiness', 'openingHoursSpecification', 'Mo-Fr 09:00-17:00'));
    self::assertFalse(SchemaGraph::validLiteral('LocalBusiness', 'openingHoursSpecification', 'Monday 9 to 5'));
    self::assertTrue(SchemaGraph::validLiteral('LocalBusiness', 'placeKind', 'Restaurant'));
    self::assertTrue(SchemaGraph::validLiteral('Event', 'organizer', 'Example Hall Ltd'));
  }

}
