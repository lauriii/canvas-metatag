<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Values;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests what building a graph reports, and the rules of hand-added items.
 *
 * Nothing is silent: an unknown stored type, a value that does not fit and a
 * withheld main node are said, with their cause.
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class SchemaGraphReportTest extends UnitTestCase {

  private const HOME = 'https://example.com/';

  private const URL = 'https://example.com/pricing';

  /**
   * Builds a graph; a value is typed text, or a link to what `$links` gives.
   */
  private static function build(array $schema, array $links = [], array $ctx = []): array {
    return SchemaGraph::build($ctx + [
      'home' => self::HOME,
      'url' => self::URL,
      'title' => 'Pricing',
      'identity' => [
        'kind' => 'organization',
        'name' => 'Humanify Studio',
        'same_as' => ['https://social.example.org/humanify'],
      ],
    ], $schema, static fn (array $value): string|array|null => match (array_key_first($value)) {
      'text' => $value['text'],
      'fact' => $value['fact'] === 'title' ? 'Pricing' : '',
      'source' => $links[$value['source']['expression']] ?? NULL,
      default => NULL,
    });
  }

  /**
   * A field link.
   */
  private static function link(string $field): array {
    return ['source' => ['expression' => "ℹ︎␜entity:node:product␝{$field}␞␟value", 'sourceType' => 'entity-field']];
  }

  /**
   * The members of the report.
   */
  public function testReport(): void {
    // An unknown stored type: a web page, and said.
    $result = self::build(['type' => 'Movie']);
    self::assertSame('Movie', $result['unknown_type']);
    self::assertSame('WebPage', $result['type']);
    self::assertSame(['Organization', 'WebSite', 'WebPage'], array_column($result['graph']['@graph'], '@type'));
    self::assertNull(self::build([])['unknown_type']);

    // A linked currency that is not a code is dropped with its value, and
    // the product still ships: the currency is not what withholds it.
    $result = self::build([
      'type' => 'Product',
      'props' => [
        'offers_price' => self::link('field_price'),
        'offers_priceCurrency' => self::link('field_currency'),
      ],
    ], [
      'ℹ︎␜entity:node:product␝field_price␞␟value' => '89',
      'ℹ︎␜entity:node:product␝field_currency␞␟value' => 'Euro (€)',
    ]);
    self::assertSame([[
      'key' => 'offers_priceCurrency',
      'value' => 'Euro (€)',
      'kind' => 'currency',
    ],
    ], $result['dropped']);
    self::assertNull($result['withheld']);
    self::assertArrayNotHasKey('priceCurrency', $result['graph']['@graph'][3]['offers']);
    // Where each value came from.
    self::assertSame(['name' => 'default', 'offers_price' => 'set'], $result['sources']);

    // A typed code stored before the list of currencies is read as stored,
    // and said as dropped: never lost without a word.
    $props = ['offers_price' => ['text' => '89'], 'offers_priceCurrency' => ['text' => 'RMB']];
    $stored = Values::clean(['schema' => ['type' => 'Product', 'props' => $props]], 'page', NULL)[0]['schema'];
    self::assertSame([['key' => 'offers_priceCurrency', 'value' => 'RMB', 'kind' => 'currency']], self::build($stored)['dropped']);

    // A required value that does not fit withholds the node, and is said as
    // dropped, not as missing.
    $result = self::build([
      'type' => 'Product',
      'props' => ['offers_price' => self::link('field_price')],
    ], ['ℹ︎␜entity:node:product␝field_price␞␟value' => '€89']);
    self::assertSame([], $result['withheld']['missing']);
    self::assertSame(['offers_price'], $result['withheld']['dropped']);
    self::assertSame([['key' => 'offers_price', 'value' => '€89', 'kind' => 'number']], $result['dropped']);
    $result = self::build(['type' => 'Product']);
    self::assertSame(['offers_price'], $result['withheld']['missing']);

    // Every node with its origin; left-out ones with their reason.
    $result = self::build([
      'type' => 'Product',
      'custom' => (string) json_encode([
      ['@type' => 'FAQPage', '@id' => '#faq'],
      ['@type' => 'Organization', '@id' => self::HOME . '#identity'],
      ['@type' => 'Thing', '@id' => '#faq'],
      ]),
    ]);
    self::assertSame([
      ['id' => self::URL . '#primary', 'type' => 'Product', 'origin' => 'main', 'left_out' => 'withheld'],
      ['id' => self::HOME . '#identity', 'type' => 'Organization', 'origin' => 'site', 'at' => 0],
      ['id' => self::HOME . '#website', 'type' => 'WebSite', 'origin' => 'site', 'at' => 1],
      ['id' => self::URL . '#webpage', 'type' => 'WebPage', 'origin' => 'page', 'at' => 2],
      ['id' => self::URL . '#faq', 'type' => 'FAQPage', 'origin' => 'hand', 'item' => 0, 'at' => 3],
      [
        'id' => self::HOME . '#identity',
        'type' => 'Organization',
        'origin' => 'hand',
        'item' => 1,
        'left_out' => 'reserved',
      ],
      ['id' => self::URL . '#faq', 'type' => 'Thing', 'origin' => 'hand', 'item' => 2, 'left_out' => 'duplicate'],
    ], $result['nodes']);
  }

  /**
   * The rules of hand-added items, over the merged graph.
   */
  public function testRules(): void {
    $rules = static function (array $custom): array {
      $result = self::build([
        'type' => 'Product',
        'props' => ['offers_price' => ['text' => '89']],
        'custom' => (string) json_encode($custom),
      ]);
      return array_map(static fn (array $hit): string => $hit['rule'] . ':' . $hit['item'] . (isset($hit['value']) ? ':' . $hit['value'] : ''), SchemaGraph::rules($result['graph'], ['home' => self::HOME], $result['nodes']));
    };
    // A second identity, by name or by address.
    self::assertSame(['second_identity:0'], $rules([['@type' => 'Organization', 'name' => ' humanify studio ']]));
    self::assertSame(['second_identity:0'], $rules([['@type' => 'LocalBusiness', 'url' => self::HOME]]));
    // A page, or a product, with the site's address is not a second identity.
    self::assertSame([], $rules([['@type' => 'AboutPage', 'url' => self::HOME]]));
    self::assertSame([], $rules([[
      '@type' => 'Product',
      'url' => self::HOME,
      'aggregateRating' => ['@type' => 'AggregateRating', 'ratingValue' => '4.8'],
    ],
    ]));
    self::assertSame([], $rules([[
      '@type' => 'Organization',
      'name' => 'Acme Logistics',
      'url' => 'https://acme.example.net/',
    ],
    ]));

    // A reference to an item of this site that is not in the graph; one to
    // another site, and one that is in the graph, are fine.
    self::assertSame(['dangling:0:' . self::URL . '#foo'], $rules([[
      '@type' => 'Thing',
      'subjectOf' => ['@id' => '#foo'],
      'about' => ['@id' => '#primary'],
      'sameAs' => ['https://other.example.net/'],
    ],
    ]));
    self::assertSame([], $rules([['@type' => 'Thing', 'about' => ['@id' => 'https://other.example.net/#x']]]));
    // A nested item with its own id is not a reference.
    self::assertSame([], $rules([[
      '@type' => 'FAQPage',
      'mainEntity' => [['@type' => 'Question', '@id' => '#q1', 'name' => 'Q']],
    ],
    ]));

    // Reviews of the site's own organization, and only of it.
    self::assertSame(['own_reviews:0'], $rules([[
      '@type' => 'Review',
      'itemReviewed' => ['@id' => self::HOME . '#identity'],
      'reviewBody' => 'Great',
    ],
    ]));
    self::assertSame(['own_reviews:0'], $rules([[
      '@type' => 'AggregateRating',
      'ratingValue' => '4.8',
      'itemReviewed' => ['@type' => 'Organization', 'name' => 'HS', 'url' => 'https://example.com'],
    ],
    ]));
    self::assertSame(['own_reviews:0'], $rules([[
      '@type' => 'Organization',
      'name' => 'HS',
      'sameAs' => 'https://social.example.org/humanify',
      'aggregateRating' => ['@type' => 'AggregateRating', 'ratingValue' => '4.8'],
    ],
    ]));
    // Any type with the site's address is the site: a restaurant's own
    // rating is a rating of the site's organization.
    self::assertSame(['second_identity:0', 'own_reviews:0'], $rules([[
      '@type' => 'Restaurant',
      'url' => self::HOME,
      'aggregateRating' => ['@type' => 'AggregateRating', 'ratingValue' => '4.8'],
    ],
    ]));
    self::assertSame([], $rules([[
      '@type' => 'EmployerAggregateRating',
      'ratingValue' => '4.1',
      'itemReviewed' => ['@type' => 'Organization', 'name' => 'Acme Logistics', 'url' => 'https://acme.example.net/'],
    ],
    ]));
    self::assertSame([], $rules([[
      '@type' => 'AggregateRating',
      'ratingValue' => '4.1',
      'itemReviewed' => ['@type' => 'Organization', 'name' => 'Acme Logistics', 'url' => 'https://acme.example.net/'],
    ],
    ]));
    // A review of the main product is not a review of the organization.
    self::assertSame([], $rules([['@type' => 'Review', 'itemReviewed' => ['@id' => '#primary']]]));

    // Addresses that are not full addresses.
    self::assertSame([
      'relative:0:/about',
      'relative:0:images/a.png',
    ], $rules([[
      '@type' => 'Thing',
      'url' => '/about',
      'image' => ['@type' => 'ImageObject', 'url' => 'images/a.png'],
      'sameAs' => ['https://ok.example.net/'],
    ],
    ]));
    // A left-out item is not checked.
    $result = self::build([
      'custom' => '{"@type":"Organization","@id":"#org","name":"Humanify Studio"}',
      'skip' => ['#org'],
    ]);
    self::assertSame([], SchemaGraph::rules($result['graph'], ['home' => self::HOME], $result['nodes']));
  }

}
