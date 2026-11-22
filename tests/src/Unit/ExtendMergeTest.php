<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests details added to the module's own nodes, and a hand-added main thing.
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class ExtendMergeTest extends UnitTestCase {

  private const HOME = 'https://www.example.com/';

  private const URL = 'https://www.example.com/oak-desk';

  /**
   * Builds a graph the way the resolver does, with typed values.
   */
  private static function build(array $schema): array {
    return SchemaGraph::build([
      'home' => self::HOME,
      'url' => self::URL,
      'langcode' => 'en',
      'title' => 'Oak desk',
      'description' => 'A desk.',
      'timezone' => 'Europe/Helsinki',
      'identity' => ['kind' => 'organization', 'name' => 'Example', 'same_as' => []],
      'facts' => ['title' => 'Oak desk'],
    ], $schema, static fn (array $value): mixed => $value['text'] ?? ['title' => 'Oak desk'][$value['fact'] ?? ''] ?? NULL);
  }

  /**
   * A node of the graph by its @id.
   */
  private static function node(array $result, string $id): ?array {
    foreach ($result['graph']['@graph'] as $node) {
      if (($node['@id'] ?? NULL) === $id) {
        return $node;
      }
    }
    return NULL;
  }

  /**
   * A product's own values win per leaf; the rest merges.
   */
  public function testSiblingsMergeWhileThePriceClashes(): void {
    $result = self::build([
      'type' => 'Product',
      'props' => ['offers_price' => ['text' => '89'], 'offers_priceCurrency' => ['text' => 'EUR']],
      'extend' => [
        '#primary' => json_encode([
          'sku' => 'OAK-DL-01',
          'offers' => [
            'price' => 79,
            'itemCondition' => 'https://schema.org/NewCondition',
            'shippingDetails' => [
              '@type' => 'OfferShippingDetails',
              'shippingRate' => ['@type' => 'MonetaryAmount', 'value' => 0],
            ],
          ],
        ]),
      ],
    ]);
    $product = self::node($result, self::URL . '#primary');
    self::assertSame('OAK-DL-01', $product['sku']);
    self::assertSame('89', $product['offers']['price']);
    self::assertSame('EUR', $product['offers']['priceCurrency']);
    self::assertSame('https://schema.org/NewCondition', $product['offers']['itemCondition']);
    self::assertSame('OfferShippingDetails', $product['offers']['shippingDetails']['@type']);
    self::assertSame([['node' => '#primary', 'path' => 'offers.price', 'prop' => 'offers_price']], $result['clashes']);
    self::assertSame(['sku', 'offers.itemCondition', 'offers.shippingDetails'], array_column($result['added'], 'path'));
    self::assertTrue(array_column($result['nodes'], 'extended', 'id')[self::URL . '#primary']);
  }

  /**
   * Objects merge at any depth; a list takes only selectors.
   */
  public function testDeepMergeAndSelectors(): void {
    $report = [];
    $node = ['@type' => 'Thing', 'a' => ['@type' => 'X', 'b' => ['c' => 1]]];
    SchemaGraph::merge($node, ['a' => ['b' => ['d' => 2]]], '#primary', [], NULL, $report);
    self::assertSame(['c' => 1, 'd' => 2], $node['a']['b']);

    $plans = static fn (): array => [
      '@type' => 'Service',
      'offers' => [
        ['@type' => 'Offer', 'name' => 'Starter', 'price' => '10'],
        ['@type' => 'Offer', 'name' => 'Growth', 'price' => '20'],
        ['@type' => 'Offer', 'name' => 'Scale', 'price' => '30'],
      ],
    ];
    $report = [];
    $node = $plans();
    SchemaGraph::merge($node, ['offers[*]' => ['itemCondition' => 'New', 'price' => '1']], '#primary', [], NULL, $report);
    self::assertSame(['New', 'New', 'New'], array_column($node['offers'], 'itemCondition'));
    self::assertSame(['10', '20', '30'], array_column($node['offers'], 'price'));
    self::assertCount(3, $report['clashes']);

    $report = [];
    $node = $plans();
    SchemaGraph::merge($node, ['offers[name=Growth]' => ['eligibleQuantity' => 5]], '#primary', [], NULL, $report);
    self::assertSame([NULL, 5, NULL], array_map(static fn (array $offer): mixed => $offer['eligibleQuantity'] ?? NULL, $node['offers']));

    $report = [];
    $node = $plans();
    SchemaGraph::merge($node, ['offers[name=Pro]' => ['eligibleQuantity' => 5]], '#primary', [], NULL, $report);
    self::assertSame($plans(), $node);
    self::assertSame([['node' => '#primary', 'path' => 'offers[name=Pro]']], $report['unmatched']);

    // A list the module emits is never replaced by a plain key.
    $report = [];
    $node = $plans();
    SchemaGraph::merge($node, ['offers' => ['itemCondition' => 'New']], '#primary', [], NULL, $report);
    self::assertSame($plans(), $node);
    self::assertSame('offers', $report['clashes'][0]['path']);
  }

  /**
   * A type is only added; the main thing is still judged as what it is.
   */
  public function testTypeAdded(): void {
    $result = self::build([
      'type' => 'Product',
      'props' => ['offers_price' => ['text' => '89'], 'offers_priceCurrency' => ['text' => 'EUR']],
      'extend' => ['#primary' => '{"@type": ["Product", "Service"]}'],
    ]);
    self::assertSame(['Product', 'Service'], self::node($result, self::URL . '#primary')['@type']);
    self::assertSame(['#primary'], $result['type_added']);
    $features = SchemaGraph::features($result['graph'], ['home' => self::HOME, 'url' => self::URL, 'type' => 'Product']);
    self::assertContains('merchant-listing', array_column($features, 'feature'));
  }

  /**
   * A hand-added item is the main thing of a plain web page only.
   */
  public function testMainOnlyOnPlainWebPage(): void {
    $custom = '{"@type": "Recipe", "@id": "#x-recipe", "name": "Rye bread"}';
    $result = self::build(['custom' => $custom, 'main' => '#x-recipe']);
    self::assertSame(['@id' => self::URL . '#x-recipe'], self::node($result, self::URL . '#webpage')['mainEntity']);
    self::assertSame(['@id' => self::URL . '#webpage'], self::node($result, self::URL . '#x-recipe')['mainEntityOfPage']);
    self::assertSame(['id' => self::URL . '#x-recipe', 'ignored' => NULL], $result['main']);

    $result = self::build([
      'type' => 'Product',
      'props' => ['offers_price' => ['text' => '89'], 'offers_priceCurrency' => ['text' => 'EUR']],
      'custom' => $custom,
      'main' => '#x-recipe',
    ]);
    self::assertSame(['@id' => self::URL . '#primary'], self::node($result, self::URL . '#webpage')['mainEntity']);
    self::assertArrayNotHasKey('mainEntityOfPage', self::node($result, self::URL . '#x-recipe'));
    self::assertSame('kind', $result['main']['ignored']);
  }

  /**
   * The rules run on the merged graph: a rating added to the identity.
   */
  public function testRulesSeeAddedDetails(): void {
    $result = self::build([
      'extend' => ['#identity' => '{"aggregateRating": {"@type": "AggregateRating", "ratingValue": 4.8, "ratingCount": 20}}'],
    ]);
    self::assertSame(4.8, self::node($result, self::HOME . '#identity')['aggregateRating']['ratingValue']);
    $rules = SchemaGraph::rules($result['graph'], ['home' => self::HOME], $result['nodes']);
    self::assertSame([['rule' => 'own_reviews', 'item' => -1, 'node' => self::HOME . '#identity']], $rules);
  }

  /**
   * The verdicts see added details on a main node with an incomplete group.
   */
  public function testVerdictsSeeDetailsBesideAnIncompleteGroup(): void {
    $schema = [
      'type' => 'Event',
      'props' => [
        'startDate' => ['text' => '2027-06-19'],
        'location_name' => ['text' => 'Riverside Hall'],
        'location_address_streetAddress' => ['text' => 'Mill Road 4'],
        'location_address_addressLocality' => ['text' => 'Tampere'],
      ],
    ];
    $verdict = static function (array $result): array {
      return SchemaGraph::features($result['graph'], [
        'home' => self::HOME,
        'url' => self::URL,
        'type' => 'Event',
        'judged' => $result['judged'],
      ])[0];
    };
    $before = self::build($schema);
    self::assertContains('location.address.addressCountry', array_column($verdict($before)['missing'], 'path'));
    $result = self::build($schema + [
      'extend' => ['#primary' => '{"location": {"address": {"addressCountry": "FI"}}, "aggregateRating": {"@type": "AggregateRating", "ratingValue": 4.5, "ratingCount": 12}}'],
    ]);
    self::assertSame('FI', $result['judged']['location']['address']['addressCountry']);
    self::assertSame(4.5, $result['judged']['aggregateRating']['ratingValue']);
    self::assertSame([], $verdict($result)['missing'] ?? []);
    // The details are reported once.
    self::assertSame(['location.address', 'aggregateRating'], array_column($result['added'], 'path'));
  }

  /**
   * The site's and Search's values win too, and a nested type is added.
   */
  public function testOtherSourcesWin(): void {
    $result = self::build([
      'extend' => [
        '#webpage' => '{"name": "Another title", "inLanguage": "fi", "breadcrumb": {"@type": "BreadcrumbList"}}',
      ],
    ]);
    $page = self::node($result, self::URL . '#webpage');
    self::assertSame('en', $page['inLanguage']);
    self::assertContains(['node' => '#webpage', 'path' => 'inLanguage'], $result['clashes']);

    $result = self::build(['extend' => ['#identity' => '{"name": "Other Oy", "slogan": "Moving things"}']]);
    $identity = self::node($result, self::HOME . '#identity');
    self::assertSame('Example', $identity['name']);
    self::assertSame('Moving things', $identity['slogan']);
    self::assertSame([['node' => '#identity', 'path' => 'name']], $result['clashes']);

    // A type inside the node: an object of the module's may have none.
    $report = [];
    $node = ['@type' => 'Product', 'offers' => ['price' => '1']];
    SchemaGraph::merge($node, ['offers' => ['@type' => 'Offer']], '#primary', [], NULL, $report);
    self::assertSame('Offer', $node['offers']['@type']);
    self::assertSame(['#primary offers'], $report['type_added']);
  }

  /**
   * Nothing is added to a node the page does not have.
   */
  public function testAbsentNode(): void {
    $result = self::build(['extend' => ['#primary' => '{"sku": "A"}']]);
    self::assertSame([['node' => '#primary', 'path' => '']], $result['unmatched']);
  }

}
