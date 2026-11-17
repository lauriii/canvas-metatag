<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests the verdict of each search feature on a built graph.
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class SearchFeaturesTest extends UnitTestCase {

  private const HOME = 'https://example.com/';

  private const URL = 'https://example.com/shop/lamp';

  private const IMAGE = ['url' => 'https://example.com/files/lamp.jpg', 'width' => 1200, 'height' => 1200, 'alt' => ''];

  /**
   * The verdicts of a page, built the way the resolver builds it.
   *
   * @param array $schema
   *   The effective `schema` value; props are typed text, `image` an image.
   * @param array $ctx
   *   Overrides of the context.
   * @param bool $node
   *   Keep the node each verdict is on.
   *
   * @return array<string, array>
   *   Feature (and the node, for a hand-added one) => verdict.
   */
  private static function verdicts(array $schema, array $ctx = [], bool $node = FALSE): array {
    $ctx += [
      'home' => self::HOME,
      'url' => self::URL,
      'langcode' => 'en',
      'title' => 'Oak desk lamp',
      'description' => 'A lamp.',
      'timezone' => 'UTC',
      'identity' => ['kind' => 'organization', 'name' => 'Humanify Studio', 'same_as' => []],
    ];
    $schema['props'] = array_map(static fn (string $text): array => $text === 'image' ? ['media' => 'image'] : ['text' => $text], $schema['props'] ?? []);
    $built = SchemaGraph::build($ctx, $schema, static fn (array $value): string|array|null => match (array_key_first($value)) {
      'text' => $value['text'],
      'media' => self::IMAGE,
      'fact' => $value['fact'] === 'title' ? $ctx['title'] : NULL,
      default => NULL,
    });
    $verdicts = SchemaGraph::features($built['graph'], [
      'home' => $ctx['home'],
      'url' => $ctx['url'],
      'front' => $ctx['url'] === $ctx['home'],
      'type' => $built['type'],
      'gates' => $built['gates'],
      'extra' => isset($built['withheld']['node']) ? [$built['withheld']['node']] : [],
    ]);
    $keyed = [];
    foreach ($verdicts as $verdict) {
      $on = $verdict['node'] ?? '';
      $keyed[$verdict['feature'] . (str_starts_with($on, self::URL . '#') && !str_ends_with($on, '#primary') && !str_ends_with($on, '#webpage') ? ' ' . substr($on, strlen(self::URL)) : '')] = array_diff_key($verdict, ['feature' => TRUE] + ($node ? [] : ['node' => TRUE]));
    }
    return $keyed;
  }

  /**
   * The props of a product with everything both product features need.
   */
  private const PRODUCT = [
    'offers_price' => '89',
    'offers_priceCurrency' => 'EUR',
    'sold_here' => 'yes',
    'image' => 'image',
    'offers_availability' => 'InStock',
    'brand_name' => 'Humanify',
    'sku' => 'LAMP-1',
    'description' => 'A lamp.',
  ];

  /**
   * Products: both features, what makes them not fit, and the question.
   */
  public function testProduct(): void {
    $product = static fn (array $props, string $custom = ''): array => self::verdicts([
      'type' => 'Product',
      'props' => $props + self::PRODUCT,
      'custom' => $custom,
    ]);
    self::assertSame([
      'product-snippet' => ['verdict' => 'ready'],
      'merchant-listing' => ['verdict' => 'ready'],
    ], $product([]));

    // A missing required fact is named, with the detail that sets it.
    $without = self::PRODUCT;
    unset($without['image']);
    self::assertSame([
      'verdict' => 'needs',
      'missing' => [['path' => 'image', 'prop' => 'image']],
    ], self::verdicts(['type' => 'Product', 'props' => $without])['merchant-listing']);

    // A price above zero; either path of `a|b` will do.
    self::assertSame([[
      'path' => 'offers.price',
      'prop' => 'offers_price',
      'rule' => 0,
    ],
    ], $product(['offers_price' => '0'])['merchant-listing']['missing']);
    $without = self::PRODUCT;
    unset($without['offers_priceCurrency']);
    self::assertSame([[
      'path' => 'offers.priceCurrency',
      'prop' => 'offers_priceCurrency',
    ],
    ], self::verdicts(['type' => 'Product', 'props' => $without])['merchant-listing']['missing']);

    // The listing fits only what is bought here, once, at one price.
    self::assertSame([
      'verdict' => 'not_fit',
      'reason' => 'recurring',
    ], $product(['billing' => 'P1M'])['merchant-listing']);
    self::assertSame(['verdict' => 'ready'], $product(['billing' => 'once'])['merchant-listing']);
    self::assertSame([
      'verdict' => 'not_fit',
      'reason' => 'not_sold_here',
    ], $product(['sold_here' => 'no'])['merchant-listing']);
    $without = self::PRODUCT;
    unset($without['sold_here']);
    self::assertSame(['verdict' => 'unanswered'], self::verdicts([
      'type' => 'Product',
      'props' => $without,
    ])['merchant-listing']);
    // A product result does not ask who sells it.
    self::assertSame('ready', self::verdicts(['type' => 'Product', 'props' => $without])['product-snippet']['verdict']);

    // Recommended facts that are missing help.
    self::assertSame(
      [['path' => 'brand.name', 'prop' => 'brand_name'], ['path' => 'sku', 'prop' => 'sku']],
      self::verdicts([
        'type' => 'Product',
        'props' => array_diff_key(self::PRODUCT, ['brand_name' => TRUE, 'sku' => TRUE]),
      ])['merchant-listing']['helps'],
    );

    // A withheld product is judged as it would ship.
    $withheld = self::verdicts([
      'type' => 'Product',
      'props' => ['sold_here' => 'yes', 'image' => 'image'],
    ])['merchant-listing'];
    self::assertSame('needs', $withheld['verdict']);
    self::assertSame([
      ['path' => 'offers.price', 'prop' => 'offers_price'],
      ['path' => 'offers.priceCurrency', 'prop' => 'offers_priceCurrency'],
    ], $withheld['missing']);
  }

  /**
   * Hand-added products: several offers, an aggregate offer, one-of paths.
   */
  public function testHandAddedProducts(): void {
    $seller = ['@id' => self::HOME . '#identity'];
    $plans = static fn (array $prices, string $type = 'Product'): array => self::verdicts([
      'custom' => (string) json_encode([
        '@type' => $type,
        '@id' => '#plans',
        'name' => 'Plans',
        'image' => self::IMAGE['url'],
        'offers' => array_map(static fn (string $price): array => [
          '@type' => 'Offer',
          'price' => $price,
          'priceCurrency' => 'EUR',
          'seller' => $seller,
        ], $prices),
      ]),
    ]);
    $several = $plans(['25', '45', '95']);
    self::assertSame(['verdict' => 'not_fit', 'reason' => 'several_offers'], $several['merchant-listing #plans']);
    self::assertSame(['verdict' => 'not_fit', 'reason' => 'several_offers'], $several['product-snippet #plans']);
    // One price in several offers is one price.
    self::assertSame('ready', $plans(['25', '25'])['merchant-listing #plans']['verdict']);

    // An aggregate offer is not one offer; a hand-added product without a
    // seller is not bought here.
    $aggregate = self::verdicts([
      'custom' => (string) json_encode([
        '@type' => 'Product',
        '@id' => '#range',
        'name' => 'Range',
        'image' => self::IMAGE['url'],
        'offers' => ['@type' => 'AggregateOffer', 'price' => '25', 'priceCurrency' => 'EUR', 'seller' => $seller],
      ]),
    ]);
    self::assertSame([['path' => 'offers.@type', 'rule' => 1]], $aggregate['merchant-listing #range']['missing']);
    $no_seller = self::verdicts(['custom' => '{"@type":"Product","@id":"#x","name":"X","offers":{"@type":"Offer","price":"5","priceCurrency":"EUR"}}']);
    self::assertSame(['verdict' => 'not_fit', 'reason' => 'not_sold_here'], $no_seller['merchant-listing #x']);
    // A price written as an object is no price, and no warning.
    $object = self::verdicts(['custom' => '{"@type":"Product","@id":"#o","name":"O","offers":[{"@type":"Offer","price":{"@value":5}},{"@type":"Offer","price":{"@value":6}}]}']);
    self::assertSame(['verdict' => 'not_fit', 'reason' => 'not_sold_here'], $object['merchant-listing #o']);

    // A product result needs a price, a review or a rating: any one of them.
    self::assertSame('ready', self::verdicts(['custom' => '{"@type":"Product","@id":"#r","name":"R","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"12"}}'])['product-snippet #r']['verdict']);
    self::assertSame([['path' => 'offers.price']], self::verdicts(['custom' => '{"@type":"Product","@id":"#n","name":"N"}'])['product-snippet #n']['missing']);
  }

  /**
   * Articles are complete, never ready; events need a town and a country.
   */
  public function testArticleAndEvent(): void {
    $article = self::verdicts([
      'type' => 'Article',
      'props' => [
        'image' => 'image',
        'datePublished' => '2026-03-02T09:00:00+02:00',
        'author_name' => 'Ada',
        'author_url' => 'https://example.com/ada',
        'dateModified' => '2026-03-03',
      ],
    ]);
    self::assertSame(['article' => ['verdict' => 'complete']], $article);
    $bare = self::verdicts(['type' => 'BlogPosting']);
    self::assertSame('needs', $bare['article']['verdict']);
    self::assertSame(['image', 'datePublished'], array_column($bare['article']['missing'], 'path'));

    $event = static fn (array $props): array => self::verdicts([
      'type' => 'Event',
      'props' => $props + [
        'startDate' => '2026-07-01',
        'location_name' => 'The New Mill',
        'location_address_streetAddress' => '1 Mill Lane',
        'location_address_addressLocality' => 'Leeds',
      ],
    ]);
    // It ships, and the event result needs the country.
    self::assertSame([[
      'path' => 'location.address.addressCountry',
      'prop' => 'location_address_addressCountry',
    ],
    ], $event([])['event']['missing']);
    self::assertSame('ready', $event(['location_address_addressCountry' => 'GB'])['event']['verdict']);
  }

  /**
   * A profile is judged on the page, which names its person.
   */
  public function testProfile(): void {
    self::assertSame([
      'profile-page' => ['node' => self::URL . '#webpage', 'verdict' => 'ready'],
    ], self::verdicts(['type' => 'ProfilePage'], [], TRUE));
    // A hand-added profile whose person has no name.
    $hand = self::verdicts(['custom' => '{"@type":"ProfilePage","@id":"#prof","mainEntity":{"@type":"Person","jobTitle":"Chef"}}']);
    self::assertSame(['verdict' => 'needs', 'missing' => [['path' => 'mainEntity.name']]], $hand['profile-page #prof']);
    // An alternate name is enough.
    self::assertSame('ready', self::verdicts(['custom' => '{"@type":"ProfilePage","@id":"#prof","mainEntity":{"@type":"Person","alternateName":"Ada"}}'])['profile-page #prof']['verdict']);
  }

  /**
   * Site nodes are judged on the home page only.
   */
  public function testSiteNodes(): void {
    $logo = ['url' => 'https://example.com/files/logo.png', 'width' => 512, 'height' => 512];
    $front = ['url' => self::HOME, 'logo' => $logo];
    self::assertSame([
      'organization-logo' => ['verdict' => 'ready'],
      'site-name' => ['verdict' => 'ready'],
    ], self::verdicts([], $front));
    // A logo too small.
    self::assertSame([[
      'path' => 'logo.width',
      'site' => 'identity.logo',
      'rule' => 0,
    ],
    ], self::verdicts([], ['logo' => ['width' => 64] + $logo] + $front)['organization-logo']['missing']);
    // In a subdirectory.
    self::assertSame([
      'verdict' => 'not_fit',
      'reason' => 'subdirectory',
    ], self::verdicts([], [
      'home' => 'https://example.com/shop/',
      'url' => 'https://example.com/shop/',
    ] + $front)['site-name']);
    // A person runs the site: no logo verdict.
    self::assertArrayNotHasKey('organization-logo', self::verdicts([], $front + [
      'identity' => [
        'kind' => 'person',
        'name' => 'Ada',
        'same_as' => [],
      ],
    ]));
    // Any other page: a plain web page has no search feature.
    self::assertSame(['' => ['verdict' => 'none']], self::verdicts([], ['logo' => $logo]));
    // A hand-added website is not where the site name is read.
    self::assertSame(['verdict' => 'not_here'], self::verdicts(['custom' => '{"@type":"WebSite","@id":"#site","name":"Shop"}'])['site-name #site']);
  }

  /**
   * Retired features, and references inside the graph.
   */
  public function testRetiredAndReferences(): void {
    $faq = self::verdicts(['custom' => '{"@type":"FAQPage","@id":"#faq","mainEntity":[]}']);
    self::assertSame(['faq #faq' => ['verdict' => 'retired']], $faq);
    // A search action inside a hand-added website is found where it is.
    self::assertSame('retired', self::verdicts(['custom' => '{"@type":"Thing","@id":"#t","potentialAction":{"@type":"SearchAction","target":"x"}}'])['sitelinks-search-box #t']['verdict']);

    // A review that names what it reviews counts as that item's review: a
    // hand-added product with no price has a product result only with it.
    $product = '{"@type":"Product","@id":"#p","name":"P"}';
    self::assertSame('needs', self::verdicts(['custom' => $product])['product-snippet #p']['verdict']);
    $verdicts = self::verdicts([
      'custom' => "[$product," . '{"@type":"Review","@id":"#review","itemReviewed":{"@id":"#p"},"reviewRating":{"@type":"Rating","ratingValue":"5"},"author":{"@type":"Person","name":"Ada"}}]',
    ]);
    self::assertSame('ready', $verdicts['product-snippet #p']['verdict']);
    // A review of a withheld main product ships without the reference and
    // counts for no product: the product still needs its price.
    $built = SchemaGraph::build([
      'home' => self::HOME,
      'url' => self::URL,
      'langcode' => 'en',
      'title' => 'Oak desk lamp',
      'description' => '',
      'timezone' => 'UTC',
      'identity' => ['kind' => 'organization', 'name' => 'Humanify Studio', 'same_as' => []],
    ], [
      'type' => 'Product',
      'custom' => '{"@type":"Review","@id":"#r","itemReviewed":{"@id":"#primary"},"reviewRating":{"@type":"Rating","ratingValue":"5"},"author":{"@type":"Person","name":"Ada"}}',
    ], static fn (): NULL => NULL);
    self::assertContains('offers_price', $built['withheld']['missing']);
    $review = array_values(array_filter($built['graph']['@graph'], static fn (array $node): bool => $node['@type'] === 'Review'))[0];
    self::assertArrayNotHasKey('itemReviewed', $review);
    $verdicts = self::verdicts([
      'type' => 'Product',
      'custom' => '{"@type":"Review","@id":"#r","itemReviewed":{"@id":"#primary"},"reviewRating":{"@type":"Rating","ratingValue":"5"},"author":{"@type":"Person","name":"Ada"}}',
    ]);
    self::assertSame('needs', $verdicts['product-snippet']['verdict']);
    self::assertContains(['path' => 'offers.price', 'prop' => 'offers_price'], $verdicts['product-snippet']['missing']);
    // Followed both ways: a reference resolves to the node in the graph.
    $verdicts = self::verdicts([
      'custom' => '[{"@type":"Product","@id":"#p","name":"P","image":"https://example.com/p.jpg","offers":{"@id":"#offer"}},{"@type":"Offer","@id":"#offer","price":"5","priceCurrency":"EUR","seller":{"@id":"https://example.com/#identity"}}]',
    ]);
    self::assertSame('ready', $verdicts['merchant-listing #p']['verdict']);
  }

}
