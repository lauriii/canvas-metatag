<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\Hook\CanvasMetatagHooks;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Values;
use Drupal\Component\Uuid\Uuid;
use Drupal\Tests\UnitTestCase;
use Masterminds\HTML5;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests the JSON-LD registry, literal validation and @graph assembly.
 */
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class SchemaGraphTest extends UnitTestCase {

  private const UUID = '6f1c2a0e-5b7d-4c1e-9a53-0d6f7c1b2e44';

  private const HOME = 'https://www.example.com/';

  private const URL = 'https://www.example.com/blog/hello';

  private const CTX = [
    'home' => self::HOME,
    'url' => self::URL,
    'langcode' => 'en',
    'title' => 'Hello',
    'description' => 'A first post.',
    'published' => '2026-03-02T09:00:00+02:00',
    'modified' => '2026-03-04T11:30:00+02:00',
    'timezone' => 'Europe/Helsinki',
    'identity' => ['kind' => 'organization', 'name' => 'Example', 'same_as' => []],
  ];

  private const IMAGE = [
    'url' => 'https://cms.example.com/sites/default/files/hello.jpg',
    'width' => 1200,
    'height' => 630,
    'alt' => 'A waving hand',
  ];

  /**
   * Builds a graph the way the resolver does.
   *
   * @param array $schema
   *   The effective `schema` value.
   * @param array<string, string> $facts
   *   Fact name => text; also what custom JSON-LD strings are filled with.
   * @param array<string, array> $images
   *   Media UUID, or `image` for the Image fact => image array.
   * @param array $ctx
   *   Overrides of the context.
   * @param array<string, string> $links
   *   Source expression => what the link gives.
   */
  private static function build(array $schema, array $facts = [], array $images = [], array $ctx = [], array $links = []): array {
    return SchemaGraph::build(
      $ctx + ['facts' => $facts] + self::CTX,
      $schema,
      static fn (array $value, string $kind): string|array|null => match (array_key_first($value)) {
        'text' => $value['text'],
        'fact' => $kind === 'image' ? $images[$value['fact']] ?? NULL : $facts[$value['fact']] ?? '',
        'media' => $images[$value['media']] ?? NULL,
        'source' => $links[$value['source']['expression']] ?? NULL,
        default => NULL,
      },
    );
  }

  /**
   * Typed text.
   */
  private static function typed(string $text): array {
    return ['text' => $text];
  }

  /**
   * A field link.
   */
  private static function link(string $field): array {
    return ['source' => ['expression' => "ℹ︎␜entity:node:page␝{$field}␞␟value", 'sourceType' => 'entity-field']];
  }

  /**
   * The rules every graph follows by construction.
   */
  private static function assertGraphRules(array $graph, string $home, string $url): void {
    self::assertSame(['@context', '@graph'], array_keys($graph));
    self::assertSame('https://schema.org', $graph['@context']);
    self::assertStringNotContainsString('@context', (string) json_encode($graph['@graph']));
    $ids = array_column($graph['@graph'], '@id');
    self::assertSame($ids, array_unique($ids), 'Every @id is unique.');
    foreach ($graph['@graph'] as $node) {
      // One type, or a hand-added list of them.
      self::assertNotEmpty($node['@type'] ?? NULL, 'Every node has a type.');
      foreach ((array) $node['@type'] as $type) {
        self::assertIsString($type, 'Every type is a name.');
      }
    }
    $ours = array_map(static fn (string $name): string => (in_array($name, [
      'identity',
      'logo',
      'website',
    ], TRUE) ? $home : $url) . "#$name", [
      'identity',
      'logo',
      'website',
      'webpage',
      'primaryimage',
      'primary',
    ]);
    array_walk_recursive($graph, static function (mixed $value, int|string $key) use ($ids, $ours): void {
      if ($key === '@id') {
        self::assertMatchesRegularExpression('~^https?://~', $value, 'Every @id is absolute.');
        if (in_array($value, $ours, TRUE)) {
          self::assertContains($value, $ids, 'Every reference to one of our nodes resolves inside the graph.');
        }
      }
    });
  }

  /**
   * The registry is loaded with `extends` resolved.
   */
  public function testTypes(): void {
    $types = SchemaGraph::types();
    self::assertSame(
      [
        'WebPage',
        'AboutPage',
        'ContactPage',
        'CollectionPage',
        'Article',
        'BlogPosting',
        'NewsArticle',
        'Event',
        'Product',
        'Service',
        'ProfilePage',
        'JobPosting',
        'LocalBusiness',
        'Recipe',
        'Course',
      ],
      array_keys($types),
    );
    foreach (['BlogPosting' => 'Blog post', 'NewsArticle' => 'News article'] as $id => $label) {
      self::assertSame($label, $types[$id]['label']);
      self::assertSame($id, $types[$id]['primary_type']);
      self::assertSame('Article', $types[$id]['variant_of']);
      self::assertSame('article', $types[$id]['og_type']);
      // A variant is reached through its base's kind; it has none itself.
      self::assertArrayNotHasKey('kind', $types[$id]);
      self::assertSame($types['Article']['props'], $types[$id]['props']);
      self::assertSame($types['Article']['refs'], $types[$id]['refs']);
      self::assertSame($types['Article']['nested'], $types[$id]['nested']);
      self::assertArrayNotHasKey('extends', $types[$id]);
    }
    // Every key is a legal config key and, unless it is never emitted, a
    // schema.org property path whose every intermediate object has a type.
    foreach ($types as $id => $type) {
      foreach ($type['props'] ?? [] as $prop) {
        self::assertMatchesRegularExpression('/^[A-Za-z]+(_[A-Za-z]+)*$/', $prop['key']);
        self::assertContains($prop['kind'], [
          'text',
          'url',
          'date',
          'number',
          'enum',
          'currency',
          'image',
          'ref',
          'hours',
        ]);
        $path = ($prop['emit'] ?? TRUE) ? explode('_', $prop['key']) : [];
        array_pop($path);
        while ($path) {
          self::assertArrayHasKey(implode('_', $path), $type['nested'], "$id: {$prop['key']}");
          array_pop($path);
        }
      }
    }

    $result = self::build(['type' => 'BlogPosting'], ['title' => 'Hello']);
    self::assertSame('BlogPosting', $result['graph']['@graph'][3]['@type']);
    self::assertSame('WebPage', $result['graph']['@graph'][2]['@type']);
    // An unknown or absent type is a plain web page.
    foreach ([[], ['type' => 'Movie']] as $schema) {
      $result = self::build($schema);
      self::assertSame(['Organization', 'WebSite', 'WebPage'], array_column($result['graph']['@graph'], '@type'));
      self::assertNull($result['withheld']);
    }
    // The kinds, each a type the editor can choose, in their order.
    $kinds = array_filter($types, static fn (array $type): bool => isset($type['kind']));
    uasort($kinds, static fn (array $a, array $b): int => $a['kind']['order'] <=> $b['kind']['order']);
    self::assertSame([
      'Product',
      'Service',
      'Article',
      'Event',
      'ProfilePage',
      'JobPosting',
      'LocalBusiness',
      'Recipe',
      'Course',
      'WebPage',
    ], array_keys($kinds));
    foreach ($types as $id => $type) {
      self::assertTrue(isset($type['kind']) xor isset($type['variant_of']), "$id is a kind or a variant of one");
    }
  }

  /**
   * Plans for a service, billing and the seller.
   */
  public function testCommerce(): void {
    $offer = static fn (array $schema, array $ctx = []): array => self::build($schema, ['title' => 'Studio membership'], [], $ctx)['graph']['@graph'][3];
    // A service: provided by the identity, one offer.
    $service = $offer([
      'type' => 'Service',
      'props' => ['offers_price' => self::typed('2500'), 'offers_priceCurrency' => self::typed('EUR')],
    ]);
    self::assertSame('Service', $service['@type']);
    self::assertSame(['@id' => self::HOME . '#identity'], $service['provider']);
    self::assertSame('Studio membership', $service['name']);
    self::assertSame(['@type' => 'Offer', 'price' => '2500', 'priceCurrency' => 'EUR'], $service['offers']);

    // Billed every month or year: a price specification beside the price.
    foreach (['P1M' => 'MON', 'P1Y' => 'ANN'] as $period => $unit) {
      $node = $offer([
        'type' => 'Service',
        'props' => [
          'offers_price' => self::typed('2500'),
          'offers_priceCurrency' => self::typed('EUR'),
          'billing' => self::typed($period),
        ],
      ]);
      self::assertSame([
        '@type' => 'Offer',
        'price' => '2500',
        'priceCurrency' => 'EUR',
        'priceSpecification' => [
          '@type' => 'UnitPriceSpecification',
          'price' => '2500',
          'priceCurrency' => 'EUR',
          'billingDuration' => $period,
          'unitCode' => $unit,
        ],
      ], $node['offers']);
    }
    // Once, or not set: nothing more.
    foreach ([['billing' => self::typed('once')], []] as $billing) {
      $node = $offer([
        'type' => 'Product',
        'props' => ['offers_price' => self::typed('89'), 'offers_priceCurrency' => self::typed('EUR')] + $billing,
      ]);
      self::assertArrayNotHasKey('priceSpecification', $node['offers']);
      self::assertArrayNotHasKey('billing', $node);
    }

    // The site is the seller only when people buy it here; the answer itself
    // never ships.
    $product = static fn (?string $here): array => $offer([
      'type' => 'Product',
      'props' => ['offers_price' => self::typed('89')] + ($here === NULL ? [] : ['sold_here' => self::typed($here)]),
    ]);
    self::assertSame(['@id' => self::HOME . '#identity'], $product('yes')['offers']['seller']);
    self::assertArrayNotHasKey('seller', $product('no')['offers']);
    self::assertArrayNotHasKey('seller', $product(NULL)['offers']);
    self::assertStringNotContainsString('sold_here', (string) json_encode($product('yes')));
    $result = self::build([
      'type' => 'Product',
      'props' => ['offers_price' => self::typed('89'), 'sold_here' => self::typed('yes')],
    ], ['title' => 'Lamp']);
    self::assertSame(['sold_here' => 'yes'], $result['gates']);
    // A gate keeps the clean value it was validated as: a linked value with
    // spaces around it still bills and still sells.
    $result = self::build([
      'type' => 'Product',
      'props' => [
        'offers_price' => self::typed('89'),
        'sold_here' => self::typed('yes '),
        'billing' => self::typed(' P1M'),
      ],
    ], ['title' => 'Lamp']);
    self::assertSame(['billing' => 'P1M', 'sold_here' => 'yes'], $result['gates']);
    self::assertSame('P1M', $result['graph']['@graph'][3]['offers']['priceSpecification']['billingDuration']);
    self::assertSame(['@id' => self::HOME . '#identity'], $result['graph']['@graph'][3]['offers']['seller']);

    // The currency: the product's, else the site's, else none.
    self::assertSame('USD', $offer([
      'type' => 'Product',
      'props' => ['offers_price' => self::typed('89'), 'offers_priceCurrency' => self::typed('USD')],
    ], ['currency' => 'EUR'])['offers']['priceCurrency']);
    self::assertSame('EUR', $offer([
      'type' => 'Product',
      'props' => ['offers_price' => self::typed('89')],
    ], ['currency' => 'EUR'])['offers']['priceCurrency']);
    self::assertArrayNotHasKey('priceCurrency', $offer([
      'type' => 'Product',
      'props' => ['offers_price' => self::typed('89')],
    ])['offers']);
    // No price, no offer: the site currency never makes an offer of nothing.
    $priceless = self::build(['type' => 'Service', 'props' => []], ['title' => 'Consulting'], [], ['currency' => 'EUR']);
    self::assertArrayNotHasKey('offers', $priceless['graph']['@graph'][3]);
    self::assertArrayNotHasKey('offers_priceCurrency', $priceless['sources']);

    // An event's organizer is the identity, unless it names another.
    $event = static fn (array $props): array => self::build([
      'type' => 'Event',
      'props' => $props + [
        'startDate' => self::typed('2026-07-01'),
        'location_address_streetAddress' => self::typed('1 Example Street'),
        'location_address_addressCountry' => self::typed('FI'),
      ],
    ], ['title' => 'Launch'])['graph']['@graph'][3];
    self::assertSame(['@id' => self::HOME . '#identity'], $event([])['organizer']);
    self::assertSame([
      '@type' => 'Organization',
      'name' => 'Example Hall Ltd',
    ], $event(['organizer_name' => self::typed('Example Hall Ltd')])['organizer']);
    // A person's employer.
    $person = self::build([
      'type' => 'ProfilePage',
      'props' => ['worksFor_name' => self::typed('Example')],
    ], ['title' => 'Ada'])['graph']['@graph'][3];
    self::assertSame(['@type' => 'Organization', 'name' => 'Example'], $person['worksFor']);
  }

  /**
   * A hand-added item can be left out by its @id, its text kept.
   */
  public function testSkip(): void {
    $custom = (string) json_encode([
      ['@type' => 'FAQPage', '@id' => '#faq', 'name' => 'Questions'],
      ['@type' => 'Thing', 'name' => 'Kept'],
    ]);
    $result = self::build(['custom' => $custom, 'skip' => ['#faq']]);
    self::assertSame([
      'Organization',
      'WebSite',
      'WebPage',
      'Thing',
    ], array_column($result['graph']['@graph'], '@type'));
    self::assertSame([
      'id' => self::URL . '#faq',
      'type' => 'FAQPage',
      'origin' => 'hand',
      'item' => 0,
      'left_out' => 'skip',
    ], $result['nodes'][3]);
    self::assertSame([
      'id' => NULL,
      'type' => 'Thing',
      'origin' => 'hand',
      'item' => 1,
      'at' => 3,
    ], $result['nodes'][4]);
    // Not listed: emitted.
    self::assertSame([
      'Organization',
      'WebSite',
      'WebPage',
      'FAQPage',
      'Thing',
    ], array_column(self::build(['custom' => $custom])['graph']['@graph'], '@type'));
  }

  /**
   * The @id table, exactly. These are identity and never change.
   */
  public function testIds(): void {
    $result = self::build(['type' => 'Article'], ['title' => 'Hello'], ['image' => self::IMAGE], [
      'logo' => ['url' => 'https://cms.example.com/logo.png', 'width' => 10, 'height' => 10],
      'image' => self::IMAGE,
    ]);
    self::assertSame([
      'Organization' => 'https://www.example.com/#identity',
      'ImageObject' => 'https://www.example.com/blog/hello#primaryimage',
      'WebSite' => 'https://www.example.com/#website',
      'WebPage' => 'https://www.example.com/blog/hello#webpage',
      'Article' => 'https://www.example.com/blog/hello#primary',
    ], array_column($result['graph']['@graph'], '@id', '@type'));
    self::assertSame('https://www.example.com/#logo', $result['graph']['@graph'][1]['@id']);
    self::assertGraphRules($result['graph'], self::HOME, self::URL);
  }

  /**
   * The Description fact is the page's description as search shows it.
   */
  public function testSummaryDefault(): void {
    $result = self::build(['type' => 'Article'], ['description' => 'Raw body text cut at'], [], ['description' => 'The summary.']);
    self::assertSame('The summary.', $result['graph']['@graph'][3]['description']);
    // Linked to it explicitly, the same.
    $result = self::build([
      'type' => 'Article',
      'props' => ['description' => ['fact' => 'description']],
    ], ['description' => 'Raw body text cut at'], [], ['description' => 'The summary.']);
    self::assertSame('The summary.', $result['graph']['@graph'][3]['description']);
  }

  /**
   * A link that gives nothing gives the default.
   *
   * One that does not fit is left out.
   */
  public function testLinkedValues(): void {
    $article = static fn (array $props, array $links): array => self::build([
      'type' => 'Article',
      'props' => $props,
    ], ['title' => 'Hello', 'author' => 'Ada'], [], [], $links)['graph']['@graph'][3];
    // Empty: the default.
    self::assertSame([
      '@type' => 'Person',
      'name' => 'Ada',
    ], $article(['author_name' => self::link('field_byline')], [])['author']);
    self::assertSame('Hello', $article(['headline' => self::link('field_headline')], ['ℹ︎␜entity:node:page␝field_headline␞␟value' => ''])['headline']);
    // Linked: the value, never scanned for names.
    self::assertSame([
      '@type' => 'Person',
      'name' => '{site}',
    ], $article(['author_name' => self::link('field_byline')], ['ℹ︎␜entity:node:page␝field_byline␞␟value' => '{site}'])['author']);
    // A field that is not an address: the author page is left out.
    self::assertArrayNotHasKey('url', $article(['author_url' => self::link('field_link')], ['ℹ︎␜entity:node:page␝field_link␞␟value' => 'not an address'])['author'] ?? []);
    // Defaults are facts.
    $defaults = self::build([
      'type' => 'Article',
    ], [
      'title' => 'Hello',
      'author' => 'Ada',
      'published' => '2026-01-02',
      'modified' => '2026-01-03',
    ], ['image' => self::IMAGE])['graph']['@graph'][3];
    self::assertSame([
      'Hello',
      '2026-01-02',
      '2026-01-03',
      'Ada',
      self::IMAGE['url'],
    ], [
      $defaults['headline'],
      $defaults['datePublished'],
      $defaults['dateModified'],
      $defaults['author']['name'],
      $defaults['image']['url'],
    ]);
  }

  /**
   * Empty and invalid properties are left out and reported by level.
   */
  public function testMissing(): void {
    // Recommended and optional properties: the node ships without them.
    // No description: the summary, which defaults to it, is left out too.
    $result = self::build(['type' => 'Article', 'props' => ['author_url' => self::link('field_link')]], [
      'title' => 'Hello',
      'modified' => 'yesterday',
    ], [], ['description' => ''], ['ℹ︎␜entity:node:page␝field_link␞␟value' => 'not a url']);
    self::assertNull($result['withheld']);
    // Values that do not fit are said, with what they gave.
    self::assertSame([
      ['key' => 'dateModified', 'value' => 'yesterday', 'kind' => 'date'],
      ['key' => 'author_url', 'value' => 'not a url', 'kind' => 'url'],
    ], $result['dropped']);
    $article = $result['graph']['@graph'][3];
    self::assertSame(['@type', '@id', 'mainEntityOfPage', 'publisher', 'headline'], array_keys($article));
    self::assertSame(['@id' => self::URL . '#primary'], $result['graph']['@graph'][2]['mainEntity']);

    // A required property that does not resolve withholds the primary node.
    $result = self::build([
      'type' => 'Event',
      'props' => ['startDate' => self::link('field_when'), 'location_name' => self::typed('Example Hall')],
    ], ['title' => 'Launch'], [], ['description' => ''], ['ℹ︎␜entity:node:page␝field_when␞␟value' => '']);
    self::assertSame(['startDate'], $result['withheld']['missing']);
    self::assertSame([], $result['withheld']['dropped']);
    // The node as it would have been, for the verdicts.
    self::assertSame(['@type' => 'Place', 'name' => 'Example Hall'], $result['withheld']['node']['location']);
    self::assertSame(['Organization', 'WebSite', 'WebPage'], array_column($result['graph']['@graph'], '@type'));
    self::assertArrayNotHasKey('mainEntity', $result['graph']['@graph'][2]);
    self::assertGraphRules($result['graph'], self::HOME, self::URL);

    // A stored empty default: the title is empty, so the name is missing.
    $result = self::build(['type' => 'ProfilePage'], ['title' => ' ']);
    self::assertSame(['name'], $result['withheld']['missing']);
    self::assertSame('ProfilePage', $result['graph']['@graph'][2]['@type']);
  }

  /**
   * How each kind is emitted.
   */
  public function testEmission(): void {
    $event = static fn (array $props, string $timezone = 'Europe/Helsinki'): array => self::build(
      [
        'type' => 'Event',
        'props' => array_map(static fn (string $v): array => Uuid::isValid($v) ? ['media' => $v] : self::typed($v), $props + [
          'location_address_streetAddress' => '1 Example Street',
          'location_address_addressCountry' => 'FI',
        ]),
      ],
      ['title' => 'Launch'],
      [self::UUID => self::IMAGE],
      ['timezone' => $timezone],
    )['graph']['@graph'][3];

    // A time without an offset gets the site default timezone's, for that
    // day; a date, and a time that has an offset, are left alone.
    // A time is written with its seconds.
    self::assertSame('2026-01-15T18:00:00+02:00', $event(['startDate' => '2026-01-15T18:00'])['startDate']);
    self::assertSame('2026-07-01T18:00:30+03:00', $event(['startDate' => '2026-07-01T18:00:30'])['startDate']);
    self::assertSame('2026-07-01T18:00:00-04:00', $event(['startDate' => '2026-07-01T18:00:00'], 'America/New_York')['startDate']);
    self::assertSame('2026-07-01', $event(['startDate' => '2026-07-01'])['startDate']);
    self::assertSame('2026-07-01T18:00:00Z', $event(['startDate' => '2026-07-01T18:00Z'])['startDate']);
    self::assertSame('2026-07-01T18:00:00+05:30', $event(['startDate' => '2026-07-01T18:00:00+05:30'])['startDate']);

    $node = $event([
      'startDate' => '2026-07-01',
      'eventStatus' => 'EventCancelled',
      'image' => self::UUID,
      'location_name' => "  Example \n Hall\x07 ",
    ]);
    self::assertSame('https://schema.org/EventCancelled', $node['eventStatus']);
    self::assertSame([
      '@type' => 'ImageObject',
      'url' => self::IMAGE['url'],
      'width' => 1200,
      'height' => 630,
    ], $node['image']);
    self::assertSame([
      '@type' => 'Place',
      'name' => 'Example Hall',
      'address' => ['@type' => 'PostalAddress', 'streetAddress' => '1 Example Street', 'addressCountry' => 'FI'],
    ], $node['location']);

    // Site nodes: a person carries the logo as `image`.
    $graph = self::build([], [], [], [
      'identity' => ['kind' => 'person', 'name' => 'Ada', 'same_as' => ['https://social.example.com/ada']],
      'logo' => ['url' => 'https://cms.example.com/ada.png', 'width' => 10, 'height' => 20],
    ])['graph']['@graph'];
    self::assertSame([
      '@type' => 'Person',
      '@id' => self::HOME . '#identity',
      'name' => 'Ada',
      'url' => self::HOME,
      'image' => ['@id' => self::HOME . '#logo'],
      'sameAs' => ['https://social.example.com/ada'],
    ], $graph[0]);
    self::assertSame([
      '@type' => 'ImageObject',
      '@id' => self::HOME . '#logo',
      'url' => 'https://cms.example.com/ada.png',
      'contentUrl' => 'https://cms.example.com/ada.png',
      'width' => 10,
      'height' => 20,
    ], $graph[1]);

    // An image without stored dimensions (an SVG, a migrated file) claims
    // none: no width or height of 0.
    $unmeasured = ['width' => 0, 'height' => 0] + self::IMAGE;
    $graph = self::build([
      'type' => 'Article',
      'props' => ['image' => ['media' => self::UUID]],
    ], [], [self::UUID => $unmeasured], [
      'logo' => ['url' => 'https://cms.example.com/logo.svg', 'width' => 0, 'height' => 0],
      'image' => $unmeasured,
    ])['graph']['@graph'];
    $nodes = array_column($graph, NULL, '@id');
    self::assertSame(['@type', '@id', 'url', 'contentUrl'], array_keys($nodes[self::HOME . '#logo']));
    self::assertSame(['@type', '@id', 'url', 'contentUrl', 'caption'], array_keys($nodes[self::URL . '#primaryimage']));
    // The page's own image is referenced from the main node, not repeated.
    self::assertSame(['@id' => self::URL . '#primaryimage'], end($graph)['image']);
    $graph = self::build([
      'type' => 'Article',
      'props' => ['image' => ['media' => self::UUID]],
    ], [], [self::UUID => $unmeasured], ['image' => ['url' => 'https://cms.example.com/other.jpg'] + self::IMAGE])['graph']['@graph'];
    self::assertSame(['@type' => 'ImageObject', 'url' => self::IMAGE['url']], end($graph)['image']);
  }

  /**
   * Literals per kind, with options and pattern.
   */
  #[DataProvider('providerLiterals')]
  public function testValidLiteral(string $type, string $key, string $value, bool $expected): void {
    self::assertSame($expected, SchemaGraph::validLiteral($type, $key, $value));
  }

  /**
   * Data provider for testValidLiteral().
   */
  public static function providerLiterals(): \Generator {
    yield 'text' => ['Article', 'headline', 'Anything <b> & {more}', TRUE];
    yield 'unknown key' => ['Article', 'offers_price', '5', FALSE];
    yield 'unknown type' => ['Movie', 'name', 'A', FALSE];
    yield 'type without props' => ['WebPage', 'headline', 'A', FALSE];
    yield 'inherited prop' => ['NewsArticle', 'headline', 'A', TRUE];
    yield 'url' => ['Article', 'author_url', 'https://example.com/ada', TRUE];
    yield 'url http' => ['Article', 'author_url', 'http://example.com/ada', TRUE];
    yield 'url path' => ['Article', 'author_url', '/ada', FALSE];
    yield 'url script' => ['Article', 'author_url', 'javascript:alert(1)', FALSE];
    yield 'url credentials' => ['Article', 'author_url', 'https://a:b@example.com/', FALSE];
    yield 'date' => ['Event', 'startDate', '2026-07-01', TRUE];
    yield 'date and minutes' => ['Event', 'startDate', '2026-07-01T18:00', TRUE];
    yield 'date and seconds' => ['Event', 'startDate', '2026-07-01T18:00:59', TRUE];
    yield 'date and offset' => ['Event', 'startDate', '2026-07-01T18:00:00+03:00', TRUE];
    yield 'date and UTC' => ['Event', 'startDate', '2026-07-01T18:00Z', TRUE];
    yield 'date impossible' => ['Event', 'startDate', '2026-02-30', FALSE];
    yield 'date hour' => ['Event', 'startDate', '2026-07-01T24:00', FALSE];
    yield 'date words' => ['Event', 'startDate', 'tomorrow', FALSE];
    yield 'date trailing newline' => ['Event', 'startDate', "2026-07-01\n", FALSE];
    yield 'date with space' => ['Event', 'startDate', '2026-07-01 18:00', FALSE];
    yield 'number' => ['Product', 'offers_price', '49', TRUE];
    yield 'number decimal' => ['Product', 'offers_price', '49.90', TRUE];
    yield 'number comma' => ['Product', 'offers_price', '49,90', FALSE];
    yield 'number negative' => ['Product', 'offers_price', '-1', FALSE];
    yield 'number trailing newline' => ['Product', 'offers_price', "49\n", FALSE];
    yield 'enum' => ['Product', 'offers_availability', 'InStock', TRUE];
    yield 'enum URL form' => ['Product', 'offers_availability', 'https://schema.org/InStock', FALSE];
    yield 'enum other' => ['Event', 'eventStatus', 'InStock', FALSE];
    yield 'currency' => ['Product', 'offers_priceCurrency', 'EUR', TRUE];
    yield 'currency lower case' => ['Product', 'offers_priceCurrency', 'eur', FALSE];
    yield 'currency trailing newline' => ['Product', 'offers_priceCurrency', "EUR\n", FALSE];
    yield 'currency symbol' => ['Product', 'offers_priceCurrency', '€', FALSE];
    // A telephone number in an international or local form; never words.
    yield 'telephone' => ['LocalBusiness', 'telephone', '+358 9 123 4567', TRUE];
    yield 'telephone local' => ['LocalBusiness', 'telephone', '09 123-4567', TRUE];
    yield 'telephone words' => ['LocalBusiness', 'telephone', 'call us', FALSE];
    yield 'telephone short' => ['LocalBusiness', 'telephone', '123', FALSE];
    // Coordinates inside their ranges, each half named.
    yield 'latitude' => ['LocalBusiness', 'geo_latitude', '60.1699', TRUE];
    yield 'latitude negative' => ['LocalBusiness', 'geo_latitude', '-33.86', TRUE];
    yield 'latitude out of range' => ['LocalBusiness', 'geo_latitude', '91', FALSE];
    yield 'longitude out of range' => ['LocalBusiness', 'geo_longitude', '-180.5', FALSE];
    yield 'duration at most 30 days' => ['Recipe', 'prepTime', '43200', TRUE];
    yield 'duration over 30 days' => ['Recipe', 'prepTime', '43201', FALSE];
    yield 'currency not in the list' => ['Product', 'offers_priceCurrency', 'ABC', FALSE];
    yield 'billing' => ['Service', 'billing', 'P1M', TRUE];
    yield 'billing other period' => ['Service', 'billing', 'P1W', FALSE];
    yield 'bought here' => ['Product', 'sold_here', 'yes', TRUE];
    yield 'bought here other' => ['Product', 'sold_here', 'maybe', FALSE];
    yield 'back order kept' => ['Product', 'offers_availability', 'BackOrder', TRUE];

    yield 'pattern no space' => ['Product', 'sku', 'A 1', FALSE];
    // An image is a media item, a fact or a link, never text.
    yield 'image UUID' => ['Article', 'image', self::UUID, FALSE];
    yield 'image file name' => ['Article', 'image', 'hello.jpg', FALSE];
  }

  /**
   * Custom nodes can point at our nodes and can never replace or extend them.
   */
  public function testCustom(): void {
    $custom = [
      // Appended; a fixed name is filled, other brace text stays, field
      // names included.
      [
        '@type' => 'WebSite',
        '@id' => '#search',
        'name' => '{site} search by {field.field_byline}',
        'potentialAction' => [
          '@type' => 'SearchAction',
          'target' => ['urlTemplate' => '{url}?q={search_term_string}'],
          'query-input' => 'required name=search_term_string',
        ],
        'position' => 3,
        'free' => TRUE,
      ],
      // Takes one of our ids: dropped.
      ['@type' => 'Organization', '@id' => self::HOME . '#identity', 'name' => 'Evil'],
      ['@type' => 'Thing', '@id' => '#primary', 'name' => 'Evil'],
      // Nested objects with our ids: reduced to the reference, or removed
      // when that node is not in this graph.
      [
        '@type' => 'FAQPage',
        '@id' => 'https://other.example.org/#faq',
        'about' => ['@id' => '#webpage', 'name' => 'Evil'],
        'publisher' => ['@type' => 'Organization', '@id' => self::HOME . '#identity', 'name' => 'Evil'],
        'image' => ['@id' => '#primaryimage'],
        'mentions' => [['@id' => '#primary', 'name' => 'Evil'], ['@id' => '#local', 'name' => 'Kept']],
      ],
      // The same id twice: the first wins.
      ['@type' => 'Thing', '@id' => 'https://other.example.org/#faq'],
      // No id at all.
      ['@type' => 'Thing', 'name' => 'Anonymous'],
    ];
    $result = self::build(
      ['type' => 'Article', 'custom' => (string) json_encode($custom)],
      ['title' => 'Hello', 'site' => 'Example', 'url' => self::URL],
    );
    $nodes = array_slice($result['graph']['@graph'], 4);
    self::assertSame([
      [
        '@type' => 'WebSite',
        '@id' => self::URL . '#search',
        'name' => 'Example search by {field.field_byline}',
        'potentialAction' => [
          '@type' => 'SearchAction',
          'target' => ['urlTemplate' => self::URL . '?q={search_term_string}'],
          'query-input' => 'required name=search_term_string',
        ],
        'position' => 3,
        'free' => TRUE,
      ],
      [
        '@type' => 'FAQPage',
        '@id' => 'https://other.example.org/#faq',
        'about' => ['@id' => self::URL . '#webpage'],
        'publisher' => ['@id' => self::HOME . '#identity'],
        'mentions' => [['@id' => self::URL . '#primary'], ['@id' => self::URL . '#local', 'name' => 'Kept']],
      ],
      ['@type' => 'Thing', 'name' => 'Anonymous'],
    ], $nodes);
    self::assertSame('Example', $result['graph']['@graph'][0]['name']);
    self::assertGraphRules($result['graph'], self::HOME, self::URL);

    // One object instead of a list; a withheld primary node cannot be
    // referenced.
    $result = self::build([
      'type' => 'Event',
      'custom' => '{"@type":"Thing","subjectOf":{"@id":"#primary"},"name":"A"}',
    ]);
    self::assertNotNull($result['withheld']);
    self::assertSame(['@type' => 'Thing', 'name' => 'A'], $result['graph']['@graph'][3]);
    self::assertGraphRules($result['graph'], self::HOME, self::URL);

    // Two types: output as the list it was written as.
    $result = self::build(['custom' => '{"@type":["Restaurant","Store"],"@id":"#shop","name":"Rye"}']);
    self::assertSame(['@type' => ['Restaurant', 'Store'], '@id' => self::URL . '#shop', 'name' => 'Rye'], $result['graph']['@graph'][3]);
    self::assertGraphRules($result['graph'], self::HOME, self::URL);

    // Garbage that got past the cleaner adds nothing.
    foreach (['<script>', '"text"', '[1, {"name": "no type"}]'] as $text) {
      self::assertCount(3, self::build(['custom' => $text])['graph']['@graph']);
    }
  }

  /**
   * A reference to a module node the graph has not is removed and reported.
   */
  public function testReferenceToAbsentModuleNodeRemoved(): void {
    $result = self::build([
      'type' => 'Event',
      'custom' => '{"@type": "Review", "@id": "#r", "itemReviewed": {"@id": "#primary"}, "author": {"@id": "#logo"}, "reviewBody": "Fine."}',
    ]);
    self::assertNotNull($result['withheld']);
    self::assertSame(['@type' => 'Review', '@id' => self::URL . '#r', 'reviewBody' => 'Fine.'], end($result['graph']['@graph']));
    self::assertSame([
      ['path' => 'itemReviewed', 'item' => 0, 'name' => self::URL . '#primary', 'status' => 'absent'],
      ['path' => 'author', 'item' => 0, 'name' => self::HOME . '#logo', 'status' => 'absent'],
    ], $result['empty']);
  }

  /**
   * Structured data that cannot be written out is left out on its own.
   */
  public function testUnencodableGraphLeftOut(): void {
    $graph = self::build(['custom' => '{"@type": "Thing", "name": "A"}'])['graph'];
    self::assertSame([['type' => 'application/ld+json', 'textContent' => $graph]], Resolver::script($graph, $error));
    self::assertNull($error);
    self::assertSame($graph, Resolver::graphOf(['script' => Resolver::script($graph)]));
    $graph['@graph'][] = ['@type' => 'Rating', 'ratingValue' => INF];
    self::assertSame([], Resolver::script($graph, $error));
    self::assertNotNull($error);
    // The report judges what the head carries: nothing, never a warning.
    self::assertSame(['@context' => 'https://schema.org', '@graph' => []], Resolver::graphOf(['script' => Resolver::script($graph)]));
  }

  /**
   * A snippet from a generator: its schema.org context is not output.
   */
  public function testPastedContextLeftOut(): void {
    $graph = self::build(['custom' => '{"@context":"https://schema.org","@type":"Organization","name":"Acme Logistics"}'])['graph'];
    $item = end($graph['@graph']);
    self::assertSame('Acme Logistics', $item['name']);
    self::assertArrayNotHasKey('@context', $item);
  }

  /**
   * Linked text is cut at a word; a graph over 256 KB loses what was added.
   */
  public function testOutputCaps(): void {
    $long = str_repeat('word ', 9000);
    $result = SchemaGraph::build(self::CTX + [
      'scope' => 'template',
      'fill' => static fn (string $name): array => ['ok', $long],
    ], ['custom' => '{"@type": "Article", "@id": "#a", "articleBody": "{field.body}"}'], static fn (): mixed => NULL);
    $body = end($result['graph']['@graph'])['articleBody'];
    self::assertLessThanOrEqual(SchemaGraph::FILL_MAX, mb_strlen($body));
    self::assertStringEndsWith('word', $body);
    self::assertSame([['path' => 'articleBody', 'item' => 0]], $result['cut']);

    // Ten items of 30 KB: the module's nodes stay, the rest is left out.
    $items = array_map(static fn (int $n): array => [
      '@type' => 'Thing',
      '@id' => "#t$n",
      'name' => str_repeat('x', 30000),
    ], range(1, 10));
    $result = self::build([
      'type' => 'Article',
      'custom' => (string) json_encode($items),
      'extend' => ['#webpage' => '{"keywords": "k", "name": "Clashes"}'],
    ]);
    self::assertTrue($result['over']);
    self::assertCount(4, $result['graph']['@graph']);
    self::assertArrayNotHasKey('keywords', $result['graph']['@graph'][2]);
    // Nothing reports details that are no longer output.
    self::assertSame([], array_filter(array_column($result['nodes'], 'extended')));
    foreach (['added', 'clashes', 'type_added', 'unmatched'] as $member) {
      self::assertArrayNotHasKey($member, $result);
    }
    self::assertSame(array_fill(0, 10, 'over'), array_column(array_filter($result['nodes'], static fn (array $node): bool => $node['origin'] === 'hand'), 'left_out'));
  }

  /**
   * Hostile text survives the coupled encoder as one script element.
   */
  public function testEncoderSafety(): void {
    $hostile = "</script><script>alert(1)</script> <!-- & \"double\" 'single' \u{2028}\u{2029} --> ]]>";
    $result = self::build(
      [
        'type' => 'Article',
        'props' => ['headline' => ['fact' => 'title']],
        'custom' => (string) json_encode(['@type' => 'Thing', 'name' => $hostile]),
      ],
      ['title' => $hostile],
      [],
      ['title' => $hostile, 'identity' => ['kind' => 'organization', 'name' => $hostile, 'same_as' => []]],
    );
    // Encoded the way the coupled adapter prints it into HTML.
    $json = json_encode($result['graph'], CanvasMetatagHooks::JSON_FLAGS);
    self::assertDoesNotMatchRegularExpression('/[<>&\']|\x{2028}|\x{2029}/u', $json);

    $document = (new HTML5())->loadHTML('<!DOCTYPE html><html><head><title>T</title><script type="application/ld+json">' . $json . '</script></head><body><p>Body</p></body></html>');
    $scripts = $document->getElementsByTagName('script');
    self::assertCount(1, $scripts);
    self::assertSame($result['graph'], json_decode((string) $scripts->item(0)?->textContent, TRUE, 32, JSON_THROW_ON_ERROR));
    self::assertSame('Body', $document->getElementsByTagName('p')->item(0)?->textContent);
    // The custom node keeps the text as typed; ours are normalized.
    self::assertSame($hostile, $result['graph']['@graph'][4]['name']);
    self::assertSame(Values::plain($hostile, 2000), $result['graph']['@graph'][3]['headline']);
  }

  /**
   * Builds with field links that give lists, as the resolver does.
   *
   * @param array $schema
   *   The `schema` value.
   * @param array<string, mixed> $links
   *   Field name => what it gives: a value, or a list of values.
   * @param array $ctx
   *   Overrides of the context.
   */
  private static function linked(array $schema, array $links = [], array $ctx = []): array {
    return SchemaGraph::build($ctx + ['facts' => []] + self::CTX, $schema, static function (array $value, string $kind, bool $list = FALSE) use ($links): mixed {
      $found = match (array_key_first($value)) {
        'text' => $value['text'],
        'source' => $links[preg_replace('/^.*␝([a-z_]+)␞.*$/u', '$1', $value['source']['expression'])] ?? NULL,
        'fact' => ['title' => 'Hello', 'published' => self::CTX['published']][$value['fact']] ?? '',
        default => NULL,
      };
      $many = is_array($found) && array_is_list($found);
      if ($list) {
        return $many ? $found : ($found === NULL || $found === '' ? [] : [$found]);
      }
      return $many ? $found[0] ?? NULL : $found;
    });
  }

  /**
   * The main node of a build.
   */
  private static function main(array $built): array {
    return array_column($built['graph']['@graph'], NULL, '@id')[self::URL . '#primary'] ?? [];
  }

  /**
   * A list property gives every item of its field, in order.
   */
  public function testListEmitsEveryItemInOrder(): void {
    $built = self::linked(['type' => 'Recipe', 'props' => ['recipeIngredient' => self::link('field_ingredients')]], [
      'field_ingredients' => ['200 g flour', '1 tsp salt', '2 eggs'],
    ], ['scope' => 'template']);
    self::assertSame(['200 g flour', '1 tsp salt', '2 eggs'], self::main($built)['recipeIngredient']);
    // The same field on a property that is not a list gives its first item.
    $built = self::linked(['type' => 'Recipe', 'props' => ['recipeYield' => self::link('field_ingredients')]], [
      'field_ingredients' => ['200 g flour', '1 tsp salt'],
    ], ['scope' => 'template']);
    self::assertSame('200 g flour', self::main($built)['recipeYield']);
  }

  /**
   * Empty items are left out; items over the maximum are dropped and said.
   */
  public function testListDropsEmptyAndOverMax(): void {
    $built = self::linked(['type' => 'ProfilePage', 'props' => ['sameAs' => self::link('field_links')]], [
      'field_links' => [
        'https://a.example.com/',
        '',
        'not a url',
        ...array_map(static fn (int $n): string => "https://$n.example.com/", range(1, 10)),
      ],
    ], ['scope' => 'template']);
    self::assertCount(10, self::main($built)['sameAs']);
    self::assertSame('https://a.example.com/', self::main($built)['sameAs'][0]);
    self::assertSame([
      ['key' => 'sameAs', 'count' => 1, 'reason' => 'invalid'],
      ['key' => 'sameAs', 'count' => 1, 'reason' => 'max'],
    ], $built['dropped_items']);
    // Private images are dropped and counted.
    $image = static fn (string $name): array => [
      'url' => "https://cms.example.com/$name.jpg",
      'width' => 800,
      'height' => 800,
      'alt' => '',
    ];
    $built = self::linked([
      'type' => 'Product',
      'props' => ['image' => self::link('field_gallery'), 'offers_price' => self::typed('9')],
    ], [
      'field_gallery' => [$image('a'), NULL, $image('b'), NULL, $image('c')],
    ], ['scope' => 'template']);
    self::assertCount(3, self::main($built)['image']);
    self::assertSame([['key' => 'image', 'count' => 2, 'reason' => 'private']], $built['dropped_items']);
  }

  /**
   * A list of text keeps its repeats.
   */
  public function testTextListsKeepDuplicates(): void {
    $built = self::linked(['type' => 'Recipe', 'props' => ['recipeIngredient' => self::link('field_ingredients')]], [
      'field_ingredients' => ['1 tsp salt', '200 g flour', '1 tsp salt'],
    ], ['scope' => 'template']);
    self::assertSame(['1 tsp salt', '200 g flour', '1 tsp salt'], self::main($built)['recipeIngredient']);
  }

  /**
   * Lists of things that are the same when equal lose their repeats.
   */
  public function testIdentityListsDropDuplicates(): void {
    $ada = [
      'name' => 'Ada',
      'url' => 'https://www.example.com/ada',
      'id' => 'https://www.example.com/ada#primary',
      'type' => 'Person',
    ];
    $bo = [
      'name' => 'Bo',
      'url' => 'https://www.example.com/bo',
      'id' => 'https://www.example.com/bo#primary',
      'type' => 'Person',
    ];
    $built = self::linked(['type' => 'Article', 'props' => ['author' => self::link('field_writers')]], [
      'field_writers' => [$ada, $bo, $ada],
    ], ['scope' => 'template']);
    self::assertSame(['Ada', 'Bo'], array_column(self::main($built)['author'], 'name'));
    $built = self::linked(['type' => 'ProfilePage', 'props' => ['sameAs' => self::link('field_links')]], [
      'field_links' => ['https://a.example.com/', 'https://b.example.com/', 'https://a.example.com/'],
    ], ['scope' => 'template']);
    self::assertSame(['https://a.example.com/', 'https://b.example.com/'], self::main($built)['sameAs']);
  }

  /**
   * A reference is the publisher, a page's main thing, or a name.
   */
  public function testRefIdentityAndTargetAndInlineFallback(): void {
    $event = static fn (array $props, array $links = []): array => self::main(self::linked([
      'type' => 'Event',
      'props' => $props + [
        'startDate' => self::typed('2027-06-19'),
        'location_name' => self::typed('Hall'),
      ],
    ], $links, ['scope' => 'template']));
    self::assertSame(['@id' => self::HOME . '#identity'], $event(['organizer' => ['fact' => 'identity']])['organizer']);
    // A restaurant is a place: the venue points at the page's main node.
    $restaurant = [
      'name' => 'Riverside Hall',
      'url' => self::HOME . 'places/riverside',
      'id' => self::HOME . 'places/riverside#primary',
      'type' => 'Restaurant',
      'address' => ['@type' => 'PostalAddress', 'addressLocality' => 'Helsinki', 'addressCountry' => 'FI'],
    ];
    self::assertSame([
      '@id' => self::HOME . 'places/riverside#primary',
      '@type' => 'Restaurant',
      'name' => 'Riverside Hall',
      'url' => self::HOME . 'places/riverside',
      'address' => $restaurant['address'],
    ], $event(['location' => self::link('field_venue')], ['field_venue' => [$restaurant]])['location']);
    // A page described as something it does not accept is named only.
    $built = self::linked([
      'type' => 'Event',
      'props' => ['startDate' => self::typed('2027-06-19'), 'location' => self::link('field_venue')],
    ], [
      'field_venue' => [['type' => 'Article', 'id' => self::HOME . 'news/hall#primary'] + $restaurant],
    ], ['scope' => 'template']);
    self::assertSame(['@type' => 'Place', 'name' => 'Riverside Hall'], self::main($built)['location']);
    self::assertSame([['key' => 'location', 'name' => 'Riverside Hall', 'reason' => 'kind']], $built['refs_inline']);
    // Someone else, by name.
    self::assertSame(['@type' => 'Organization', 'name' => 'Example Hall Ltd'], $event(['organizer_name' => self::typed('Example Hall Ltd')])['organizer']);
  }

  /**
   * Every @id the module writes is absolute.
   */
  public function testAbsoluteIdsOnly(): void {
    $built = self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location' => self::link('field_venue'),
        'organizer' => ['fact' => 'identity'],
      ],
    ], [
      'field_venue' => [
        [
          'name' => 'Hall',
          'url' => self::HOME . 'hall',
          'id' => self::HOME . 'hall#primary',
          'type' => 'EventVenue',
        ],
      ],
    ], ['scope' => 'template']);
    array_walk_recursive($built['graph'], static function (mixed $value, int|string $key): void {
      if ($key === '@id') {
        self::assertMatchesRegularExpression('~^https://www\.example\.com/~', $value);
      }
    });
  }

  /**
   * On a Canvas page an organizer nobody set is the publisher, and said.
   */
  public function testPageDefaultPublisherReported(): void {
    $props = ['startDate' => self::typed('2027-06-19'), 'location_name' => self::typed('Hall')];
    $page = self::linked(['type' => 'Event', 'props' => $props]);
    self::assertSame(['@id' => self::HOME . '#identity'], self::main($page)['organizer']);
    self::assertSame(['organizer'], $page['defaults']);
    // Touched, it is no longer a default.
    $named = self::linked(['type' => 'Event', 'props' => $props + ['organizer_name' => self::typed('Ada')]]);
    self::assertSame([], $named['defaults']);
    // Someone else, not named yet: no organizer, and not the site.
    $other = self::linked(['type' => 'Event', 'props' => $props + ['organizer' => self::typed('')]]);
    self::assertArrayNotHasKey('organizer', self::main($other));
    self::assertSame([], $other['defaults']);
    // On a template nobody's default is assumed.
    $template = self::linked(['type' => 'Event', 'props' => $props], [], ['scope' => 'template']);
    self::assertArrayNotHasKey('organizer', self::main($template));
    self::assertSame([], $template['defaults']);
  }

  /**
   * An enum is a schema.org URL, a bare code or the node's type.
   */
  public function testEnumEmitsCodeUrlOrType(): void {
    $job = self::main(self::linked([
      'type' => 'JobPosting',
      'props' => [
        'description' => self::link('body'),
        'employmentType' => self::typed('FULL_TIME'),
        'work' => self::typed('remote'),
        'hiringOrganization' => ['fact' => 'identity'],
      ],
    ], ['body' => '<p>Build things.</p>'], ['scope' => 'template']));
    self::assertSame('FULL_TIME', $job['employmentType']);
    // Where the work is: remote, also when it may be on site, is TELECOMMUTE;
    // on site is said by the workplace alone.
    self::assertSame('TELECOMMUTE', $job['jobLocationType']);
    foreach (['both' => 'TELECOMMUTE', 'onsite' => NULL] as $work => $emitted) {
      self::assertSame($emitted, self::main(self::linked([
        'type' => 'JobPosting',
        'props' => [
          'description' => self::link('body'),
          'work' => self::typed($work),
          'hiringOrganization' => ['fact' => 'identity'],
        ],
      ], ['body' => '<p>Build things.</p>'], ['scope' => 'template']))['jobLocationType'] ?? NULL);
    }
    $place = self::main(self::linked([
      'type' => 'LocalBusiness',
      'props' => [
        'placeKind' => self::typed('Restaurant'),
        'address_addressLocality' => self::typed('Tampere'),
        'address_addressCountry' => self::typed('FI'),
      ],
    ]));
    self::assertSame('Restaurant', $place['@type']);
    self::assertArrayNotHasKey('placeKind', $place);
    $event = self::main(self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location_name' => self::typed('Hall'),
        'eventStatus' => self::typed('EventScheduled'),
      ],
    ]));
    self::assertSame('https://schema.org/EventScheduled', $event['eventStatus']);
  }

  /**
   * A group missing what it requires is left out and said.
   */
  public function testGroupIncompleteIsDroppedAndReported(): void {
    $built = self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location_name' => self::typed('Riverside Hall'),
        'location_address_streetAddress' => self::typed('Mill Road 4'),
        'location_address_addressLocality' => self::typed('Tampere'),
      ],
    ]);
    self::assertSame(['@type' => 'Place', 'name' => 'Riverside Hall'], self::main($built)['location']);
    self::assertSame([['group' => 'location_address', 'missing' => ['location_address_addressCountry']]], $built['incomplete']);
    // The verdicts judge the address as it is: it needs its country.
    self::assertSame('PostalAddress', $built['judged']['location']['address']['@type']);
    $verdicts = SchemaGraph::features($built['graph'], [
      'home' => self::HOME,
      'url' => self::URL,
      'type' => 'Event',
      'judged' => $built['judged'],
    ]);
    self::assertSame([['path' => 'location.address.addressCountry', 'prop' => 'location_address_addressCountry']], $verdicts[0]['missing']);
  }

  /**
   * A required group left out withholds the main node.
   */
  public function testRequiredGroupWithholdsMainNode(): void {
    $built = self::linked(['type' => 'Event', 'props' => ['startDate' => self::typed('2027-06-19')]]);
    self::assertSame(['location'], $built['withheld']['missing']);
    self::assertSame([], self::main($built));
  }

  /**
   * A country is its code.
   */
  public function testCountryCodeEnumEmitsCode(): void {
    $event = self::main(self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location_address_addressLocality' => self::typed('Tampere'),
        'location_address_addressCountry' => self::typed('FI'),
      ],
    ]));
    self::assertSame('FI', $event['location']['address']['addressCountry']);
  }

  /**
   * A suggested country is never emitted unless it was chosen.
   */
  public function testCountrySuggestionNeverEmitted(): void {
    // The publisher is in Finland; the suggestion is the dialog's alone.
    $prop = SchemaGraph::prop('Event', 'location_address_addressCountry');
    self::assertSame('country', $prop['suggest']);
    $built = self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location_name' => self::typed('Hall'),
        'location_address_addressLocality' => self::typed('Tampere'),
      ],
    ], [], ['identity' => ['kind' => 'organization', 'name' => 'Example', 'same_as' => [], 'country' => 'FI']]);
    self::assertArrayNotHasKey('address', self::main($built)['location']);
    self::assertStringNotContainsString('"FI"', (string) json_encode($built['graph']));
  }

  /**
   * Presale is PreOrder; not on sale yet has only the date it goes on sale.
   */
  public function testTicketsPresaleIsPreOrderAndNotOnSaleHasNoAvailability(): void {
    $offers = static fn (string $availability): array => self::main(self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location_name' => self::typed('Hall'),
        'offers_price' => self::typed('25'),
        'offers_availability' => self::typed($availability),
        'offers_validFrom' => self::typed('2027-01-10'),
      ],
    ], [], ['currency' => 'EUR']))['offers'];
    self::assertSame([
      '@type' => 'Offer',
      'price' => '25',
      'priceCurrency' => 'EUR',
      'availability' => 'https://schema.org/PreOrder',
      'validFrom' => '2027-01-10',
    ], $offers('PreOrder'));
    self::assertSame(['@type' => 'Offer', 'price' => '25', 'priceCurrency' => 'EUR', 'validFrom' => '2027-01-10'], $offers('NotYet'));
  }

  /**
   * A property gated by another counts only while its gate holds.
   */
  public function testWhenSkipsProp(): void {
    $place = static fn (string $kind): array => self::main(self::linked([
      'type' => 'LocalBusiness',
      'props' => [
        'placeKind' => self::typed($kind),
        'address_addressLocality' => self::typed('Tampere'),
        'address_addressCountry' => self::typed('FI'),
        'menu' => self::typed('https://www.example.com/menu'),
      ],
    ]));
    self::assertSame('https://www.example.com/menu', $place('Restaurant')['menu']);
    self::assertArrayNotHasKey('menu', $place('Dentist'));
    // On sale from is said for presale only.
    $offers = self::main(self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location_name' => self::typed('Hall'),
        'offers_price' => self::typed('25'),
        'offers_availability' => self::typed('InStock'),
        'offers_validFrom' => self::typed('2027-01-10'),
      ],
    ]))['offers'];
    self::assertArrayNotHasKey('validFrom', $offers);
  }

  /**
   * Weekly days with the same times share a node; dated entries stay apart.
   */
  public function testHoursGroupsWeeklyDaysAndKeepsDatedApart(): void {
    $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/hours.json'), TRUE, 16, JSON_THROW_ON_ERROR);
    foreach ($fixture['valid'] as $case) {
      self::assertNotNull(SchemaGraph::hours($case['text']), $case['text']);
      self::assertSame($case['nodes'], SchemaGraph::hoursNodes((array) SchemaGraph::hours($case['text']), $case['today'] ?? ''), $case['text']);
    }
    foreach ($fixture['invalid'] as $text) {
      self::assertNull(SchemaGraph::hours($text), $text);
    }
  }

  /**
   * A job description keeps basic markup and no script or event handler.
   */
  public function testJobDescriptionFilteredHtml(): void {
    self::assertSame(
      '<p>Hi</p><a>apply</a><ul><li>Design</li></ul>',
      SchemaGraph::filterHtml('<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">apply</a><ul><li>Design</li></ul>'),
    );
    self::assertSame(
      '<p><strong>Build</strong> <em>tools</em><br> <a href="https://www.example.com/jobs">jobs</a> <a>here</a></p>',
      SchemaGraph::filterHtml('<p style="color:red"><strong>Build</strong> <em>tools</em><br/> <a href="https://www.example.com/jobs" target="_blank">jobs</a> <a href="/relative">here</a></p><style>p{}</style><!-- note -->'),
    );
    self::assertSame('Text &lt; more', SchemaGraph::filterHtml('<div>Text < more</div>'));
    self::assertSame('', SchemaGraph::filterHtml("\xC3\x28"));
    self::assertSame(20000, mb_strlen(SchemaGraph::filterHtml(str_repeat('a', 25000))));
    // A tag that is never closed stays text, whatever it holds.
    self::assertSame('<p>Apply</p>&lt;a href=javascript:alert(1) onclick=alert(1)', SchemaGraph::filterHtml('<p>Apply</p><a href=javascript:alert(1) onclick=alert(1)'));
    // The cut never leaves half a tag that opens.
    $cut = SchemaGraph::filterHtml(str_repeat('a', 19990) . ' <a href="https://www.example.com/jobs">jobs</a>');
    self::assertStringContainsString('&lt;a href=', $cut);
    self::assertSame(0, preg_match('~<(?!/?(?:p|ul|ol|li|br|strong|em)>|/a>|a>|a href="[^"<>]*">)~', $cut));
    // A comment inside a tag's name never makes a script of it: its text is
    // removed with it.
    self::assertSame('<p>Hi</p>', SchemaGraph::filterHtml('<p>Hi</p><scr<!-- -->ipt>alert(1)</script>'));
    // Only the href attribute is the link: not data-href, not text in
    // another attribute's value.
    self::assertSame('<a href="https://www.example.com/jobs">jobs</a>', SchemaGraph::filterHtml('<a data-href="https://evil.example.com/" href="https://www.example.com/jobs">jobs</a>'));
    self::assertSame('<a>jobs</a>', SchemaGraph::filterHtml('<a title="x href=https://evil.example.com/" data-href="https://evil.example.com/">jobs</a>'));
  }

  /**
   * Each workplace carries its own page's address.
   */
  public function testJobLocationRefListCarriesEachTargetsAddress(): void {
    $office = static fn (string $slug, array $address): array => [
      'name' => ucfirst($slug),
      'url' => self::HOME . $slug,
      'id' => self::HOME . "$slug#primary",
      'type' => 'LocalBusiness',
      'address' => ['@type' => 'PostalAddress'] + $address,
    ];
    $job = self::main(self::linked([
      'type' => 'JobPosting',
      'props' => [
        'description' => self::link('body'),
        'hiringOrganization' => ['fact' => 'identity'],
        'work' => self::typed('onsite'),
        'jobLocation' => self::link('field_offices'),
      ],
    ], [
      'body' => '<p>Build things.</p>',
      'field_offices' => [
        $office('north', [
          'streetAddress' => 'Mill Road 4',
          'postalCode' => '33100',
          'addressLocality' => 'Tampere',
          'addressCountry' => 'FI',
        ]),
        $office('south', ['streetAddress' => 'Hall Road 1', 'addressLocality' => 'Tampere', 'addressCountry' => 'FI']),
      ],
    ], ['scope' => 'template']));
    self::assertSame(['Mill Road 4', 'Hall Road 1'], array_column(array_column($job['jobLocation'], 'address'), 'streetAddress'));
    self::assertSame('33100', $job['jobLocation'][0]['address']['postalCode']);
    self::assertArrayNotHasKey('postalCode', $job['jobLocation'][1]['address']);
    self::assertArrayNotHasKey('jobLocationType', $job);
    // On site or remote: remote work beside the workplace.
    $both = self::main(self::linked([
      'type' => 'JobPosting',
      'props' => [
        'description' => self::link('body'),
        'hiringOrganization' => ['fact' => 'identity'],
        'work' => self::typed('both'),
        'jobLocation' => self::link('field_offices'),
      ],
    ], [
      'body' => '<p>Build things.</p>',
      'field_offices' => [$office('north', ['addressLocality' => 'Tampere', 'addressCountry' => 'FI'])],
    ], ['scope' => 'template']));
    self::assertSame('TELECOMMUTE', $both['jobLocationType']);
    self::assertSame('Tampere', $both['jobLocation']['address']['addressLocality']);
  }

  /**
   * A workplace page described otherwise is its name beside the parts.
   *
   * As for an event's venue: the workplace keeps the address linked in its
   * own parts, and the report says the page is only named.
   */
  public function testNamedWorkplaceKeepsTheGroupsParts(): void {
    $built = self::linked([
      'type' => 'JobPosting',
      'props' => [
        'description' => self::link('body'),
        'hiringOrganization' => ['fact' => 'identity'],
        'work' => self::typed('onsite'),
        'jobLocation' => self::link('field_location'),
        'jobLocation_address_streetAddress' => self::link('field_street'),
        'jobLocation_address_addressLocality' => self::link('field_city'),
        'jobLocation_address_addressCountry' => self::link('field_country'),
      ],
    ], [
      'body' => '<p>Build things.</p>',
      'field_location' => [
        [
          'name' => 'Example office',
          'url' => self::HOME . 'office',
          'id' => self::HOME . 'office#primary',
          'type' => 'Article',
        ],
      ],
      'field_street' => 'Kungsgatan 1',
      'field_city' => 'Stockholm',
      'field_country' => 'SE',
    ], ['scope' => 'template']);
    self::assertSame([
      '@type' => 'Place',
      'name' => 'Example office',
      'address' => [
        '@type' => 'PostalAddress',
        'streetAddress' => 'Kungsgatan 1',
        'addressLocality' => 'Stockholm',
        'addressCountry' => 'SE',
      ],
    ], self::main($built)['jobLocation']);
    self::assertSame([['key' => 'jobLocation', 'name' => 'Example office', 'reason' => 'kind']], $built['refs_inline']);
  }

  /**
   * A country typed as a name before countries were codes is dropped.
   *
   * Its address is left out, and the report lists the country as a value
   * that does not fit: Checks ask for the country from the list.
   */
  public function testCountryStoredAsNameIsDropped(): void {
    $built = self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location_name' => self::typed('Riverside Hall'),
        'location_address_addressLocality' => self::typed('Tampere'),
        'location_address_addressCountry' => self::typed('Finland'),
      ],
    ]);
    self::assertSame(['@type' => 'Place', 'name' => 'Riverside Hall'], self::main($built)['location']);
    self::assertSame([['key' => 'location_address_addressCountry', 'value' => 'Finland', 'kind' => 'enum']], $built['dropped']);
    self::assertSame([['group' => 'location_address', 'missing' => ['location_address_addressCountry']]], $built['incomplete']);
  }

  /**
   * An event that shipped with only a street keeps its Event (decision 8).
   *
   * Before groups, a street was all an event needed. Its venue, with no name
   * and an address without a country, is left out and reported; the event
   * is not withheld. Nothing set for the venue still withholds it.
   */
  public function testOldMinimumEventIsKept(): void {
    foreach ([[], ['location_address_addressLocality' => 'Tampere'], ['location_address_addressCountry' => 'Finland']] as $more) {
      $built = self::linked([
        'type' => 'Event',
        'props' => [
          'startDate' => self::typed('2027-06-19'),
          'location_address_streetAddress' => self::typed('Hämeenkatu 1'),
        ] + array_map(self::typed(...), $more),
      ]);
      self::assertNull($built['withheld']);
      $event = self::main($built);
      self::assertSame('Event', $event['@type']);
      self::assertArrayNotHasKey('location', $event);
      self::assertSame(['location_address', 'location'], array_column($built['incomplete'], 'group'));
      self::assertSame(['location_address_addressCountry'], $built['incomplete'][0]['missing']);
    }
  }

  /**
   * Someone else with only a website is not someone yet: the name is asked.
   */
  public function testWhoWithoutNameIsIncomplete(): void {
    $built = self::linked([
      'type' => 'Event',
      'props' => [
        'startDate' => self::typed('2027-06-19'),
        'location_name' => self::typed('Riverside Hall'),
        'organizer_url' => self::typed('https://hall.example.org/'),
      ],
    ]);
    self::assertArrayNotHasKey('organizer', self::main($built));
    self::assertSame([['group' => 'organizer', 'missing' => ['organizer_name']]], $built['incomplete']);
    // Not the site by default either: the organizer was answered.
    self::assertSame([], $built['defaults']);
  }

  /**
   * One amount is a value; From above To is left out and said.
   */
  public function testPaySingleValueAndFromOverTo(): void {
    $pay = static fn (array $links): array => self::linked([
      'type' => 'JobPosting',
      'props' => [
        'description' => self::link('body'),
        'hiringOrganization' => ['fact' => 'identity'],
        'baseSalary_value_minValue' => self::link('field_from'),
        'baseSalary_value_maxValue' => self::link('field_to'),
        'baseSalary_value_unitText' => self::typed('MONTH'),
      ],
    ], $links + ['body' => '<p>Build things.</p>'], ['scope' => 'template', 'currency' => 'EUR']);
    self::assertSame(
      [
        '@type' => 'MonetaryAmount',
        'value' => ['@type' => 'QuantitativeValue', 'value' => 4200, 'unitText' => 'MONTH'],
        'currency' => 'EUR',
      ],
      self::main($pay(['field_from' => '4200']))['baseSalary'],
    );
    self::assertSame(
      ['@type' => 'QuantitativeValue', 'minValue' => 4200, 'maxValue' => 5000.5, 'unitText' => 'MONTH'],
      self::main($pay(['field_from' => '4200', 'field_to' => '5000.50']))['baseSalary']['value'],
    );
    $built = $pay(['field_from' => '5000', 'field_to' => '4200']);
    self::assertArrayNotHasKey('baseSalary', self::main($built));
    self::assertTrue($built['pay_order']);
  }

  /**
   * Steps are HowToSteps when there are several; countries are Countries.
   */
  public function testItemWrapsHowToStepAndCountry(): void {
    $recipe = self::main(self::linked([
      'type' => 'Recipe',
      'props' => ['recipeInstructions' => self::link('field_steps')],
    ], ['field_steps' => ['Preheat', 'Mix']], ['scope' => 'template']));
    self::assertSame([['@type' => 'HowToStep', 'text' => 'Preheat'], ['@type' => 'HowToStep', 'text' => 'Mix']], $recipe['recipeInstructions']);
    $job = self::main(self::linked([
      'type' => 'JobPosting',
      'props' => [
        'description' => self::link('body'),
        'hiringOrganization' => ['fact' => 'identity'],
        'work' => self::typed('remote'),
        'applicantLocationRequirements' => self::typed('FI,SE'),
      ],
    ], ['body' => '<p>Build things.</p>'], ['scope' => 'template']));
    self::assertSame([['@type' => 'Country', 'name' => 'FI'], ['@type' => 'Country', 'name' => 'SE']], $job['applicantLocationRequirements']);
  }

  /**
   * A duration is ISO 8601, in the unit its field counts in.
   */
  public function testDurationEmitsIso(): void {
    $recipe = static fn (array $props, array $links = []): array => self::main(self::linked([
      'type' => 'Recipe',
      'props' => $props,
    ], $links, ['scope' => 'template']));
    $times = $recipe(['prepTime' => self::typed('90'), 'cookTime' => self::typed('30')]);
    self::assertSame(['PT1H30M', 'PT30M'], [$times['prepTime'], $times['cookTime']]);
    self::assertSame('PT1H', $recipe(['prepTime' => self::typed('60'), 'cookTime' => self::typed('5')])['prepTime']);
    // A field that counts hours: 1.5 hours.
    $linked = $recipe([
      'prepTime' => self::typed('10'),
      'cookTime' => self::link('field_cook_hours') + ['unit' => 'hour'],
    ], ['field_cook_hours' => '1.5']);
    self::assertSame('PT1H30M', $linked['cookTime']);
    self::assertSame('PT2H', SchemaGraph::duration(120));
    self::assertSame('PT0M', SchemaGraph::duration(0));
  }

  /**
   * Prep and cook time are emitted together or not at all.
   */
  public function testPrepWithoutCookNotEmitted(): void {
    $built = self::linked(['type' => 'Recipe', 'props' => ['prepTime' => self::typed('20')]]);
    self::assertArrayNotHasKey('prepTime', self::main($built));
    self::assertSame(['prepTime'], $built['unpaired']);
    // Left out for its pair: not reported as set, so nothing asks again for
    // what is there. A linked time over 30 days gives nothing.
    self::assertArrayNotHasKey('prepTime', $built['sources']);
    $built = self::linked([
      'type' => 'Recipe',
      'props' => ['prepTime' => self::link('field_prep'), 'cookTime' => self::typed('30')],
    ], ['field_prep' => '50000'], ['scope' => 'template']);
    self::assertSame(['cookTime'], $built['unpaired']);
    self::assertSame([], array_intersect(['prepTime', 'cookTime'], array_keys($built['sources'])));
  }

  /**
   * Someone else, typed by name, keeps the website typed with the name.
   *
   * A reference that gives only a name is the group's name, never a reason
   * to drop its other parts: a venue page not described as a place keeps
   * the address linked in the venue's parts.
   */
  public function testNamedReferenceKeepsTheGroupsParts(): void {
    $event = static fn (array $props, array $links = []): array => self::main(self::linked([
      'type' => 'Event',
      'props' => $props + ['startDate' => self::typed('2027-06-19')],
    ], $links, ['scope' => 'template']));
    self::assertSame(
      ['@type' => 'Organization', 'name' => 'Example Hall Ltd', 'url' => 'https://hall.example.org/'],
      $event([
        'location_name' => self::typed('Hall'),
        'organizer' => self::typed('Example Hall Ltd'),
        'organizer_url' => self::typed('https://hall.example.org/'),
      ])['organizer'],
    );
    $location = $event([
      'location' => self::link('field_venue'),
      'location_address_streetAddress' => self::link('field_street'),
      'location_address_addressLocality' => self::typed('Helsinki'),
      'location_address_addressCountry' => self::typed('FI'),
    ], [
      'field_venue' => [
        [
          'name' => 'Lakeside',
          'url' => self::HOME . 'lakeside',
          'id' => self::HOME . 'lakeside#primary',
          'type' => 'Article',
        ],
      ],
      'field_street' => 'Rantakatu 1',
    ])['location'];
    self::assertSame('Lakeside', $location['name']);
    self::assertSame([
      '@type' => 'PostalAddress',
      'streetAddress' => 'Rantakatu 1',
      'addressLocality' => 'Helsinki',
      'addressCountry' => 'FI',
    ], $location['address']);
    // A country linked to a field that gives a lowercase code is the code.
    self::assertSame('FI', $event([
      'location_name' => self::typed('Hall'),
      'location_address_addressLocality' => self::typed('Helsinki'),
      'location_address_addressCountry' => self::link('field_country'),
    ], ['field_country' => 'fi'])['location']['address']['addressCountry']);
  }

  /**
   * Instructions with items are steps; one text is one text.
   */
  public function testInstructionsStepsFromItemsTextOtherwise(): void {
    $steps = static fn (mixed $field): mixed => self::main(self::linked([
      'type' => 'Recipe',
      'props' => ['recipeInstructions' => self::link('field_steps')],
    ], ['field_steps' => $field], ['scope' => 'template']))['recipeInstructions'];
    self::assertSame('Mix it all and bake.', $steps(['Mix it all and bake.']));
    // A formatted method of one paragraph is that paragraph, as text.
    self::assertSame('Mix it all and bake.', $steps(Values::items('<p>Mix it all and bake.</p>')));
    self::assertCount(3, $steps(['Mix', 'Proof', 'Bake']));
  }

  /**
   * Calories are "n calories" in a NutritionInformation, only with a yield.
   */
  public function testCaloriesNeedYieldAndFormat(): void {
    $recipe = static fn (array $props): array => self::linked([
      'type' => 'Recipe',
      'props' => $props + ['nutrition_calories' => self::typed('180')],
    ]);
    self::assertSame(['@type' => 'NutritionInformation', 'calories' => '180 calories'], self::main($recipe(['recipeYield' => self::typed('1 loaf')]))['nutrition']);
    $built = $recipe([]);
    self::assertArrayNotHasKey('nutrition', self::main($built));
    self::assertSame([['group' => 'nutrition', 'missing' => ['recipeYield']]], $built['incomplete']);
  }

  /**
   * Terms of a multi-value field are joined into one text; typed text stays.
   */
  public function testJoinTerms(): void {
    $recipe = self::main(self::linked([
      'type' => 'Recipe',
      'props' => ['keywords' => self::link('field_tags'), 'recipeCuisine' => self::typed('Thai, vegan')],
    ], ['field_tags' => ['rye', 'sourdough', 'rye']], ['scope' => 'template']));
    self::assertSame('rye, sourdough, rye', $recipe['keywords']);
    self::assertSame('Thai, vegan', $recipe['recipeCuisine']);
  }

  /**
   * A list page lists public pages in order.
   *
   * The course list counts complete courses only.
   */
  public function testItemListCountsOnlyCompleteTargets(): void {
    $course = static fn (string $slug, bool $complete = TRUE): array => [
      'name' => $slug,
      'url' => self::HOME . $slug,
      'id' => self::HOME . "$slug#primary",
      'type' => 'Course',
      'complete' => $complete,
    ];
    $built = self::linked(['type' => 'CollectionPage', 'props' => ['items' => self::link('field_pages')]], [
      'field_pages' => [
        $course('a'),
        $course('b', FALSE),
        NULL,
        $course('c'),
        ['name' => 'News', 'url' => self::HOME . 'news'],
      ],
    ], ['scope' => 'template']);
    $list = $built['graph']['@graph'][2]['mainEntity'];
    self::assertSame('ItemList', $list['@type']);
    self::assertSame([1, 2, 3, 4], array_column($list['itemListElement'], 'position'));
    self::assertSame([['key' => 'items', 'count' => 1, 'reason' => 'hidden']], $built['dropped_items']);
    $verdicts = SchemaGraph::features($built['graph'], [
      'home' => self::HOME,
      'url' => self::URL,
      'type' => 'CollectionPage',
      'items' => $built['items'],
    ]);
    self::assertSame([
      'feature' => 'course-list',
      'node' => self::URL . '#webpage',
      'verdict' => 'needs',
      'count' => 2,
      'of' => 4,
      'missing' => [['path' => 'itemListElement']],
    ], $verdicts[0]);
    // A list page is never offered on a Canvas page.
    self::assertArrayNotHasKey('mainEntity', self::linked([
      'type' => 'CollectionPage',
      'props' => ['items' => self::link('field_pages')],
    ], ['field_pages' => [$course('a')]])['graph']['@graph'][2]);
  }

  /**
   * A free-text detail of a template composes: read in words, kept literal.
   *
   * The joined text is checked as typed text of the detail is, so one that
   * is too long is cut; compositions never pass through fillFacts(), while
   * hand-added JSON-LD keeps filling its whole-value names.
   */
  public function testComposedDetails(): void {
    $composition = ['parts' => [['fact' => 'title'], ['text' => ' {site} · '], self::link('field_city')]];
    $asked = [];
    $read = static function (array $value, string $kind) use (&$asked): string {
      if (!isset($value['parts'])) {
        return '';
      }
      $asked[] = $kind;
      return $kind === 'line' ? 'Hello {site} · Helsinki' : str_repeat('Long words ', 300);
    };
    $custom = (string) json_encode([['@type' => 'WebSite', '@id' => '#search', 'name' => '{site} search']]);
    $schema = [
      'type' => 'Article',
      'props' => [
        'headline' => $composition,
        'description' => ['parts' => [['fact' => 'description'], ['text' => ' Free delivery.']]],
      ],
      'custom' => $custom,
    ];
    $ctx = ['scope' => 'template', 'facts' => ['site' => 'Example']] + self::CTX;
    $built = SchemaGraph::build($ctx, $schema, $read);
    $main = self::main($built);
    // A headline is title-like: a line; a description: words.
    self::assertSame(['line', 'words'], array_slice($asked, 0, 2));
    // Text a field holds, braces included, is never filled.
    self::assertSame('Hello {site} · Helsinki', $main['headline']);
    // Longer than a detail allows: cut as typed text is, never reported.
    self::assertSame(2000, mb_strlen($main['description']));
    self::assertSame([], $built['dropped']);
    // Hand-added JSON-LD fills its whole-value names.
    self::assertSame('Example search', array_column($built['graph']['@graph'], 'name', '@id')[self::URL . '#search']);

    // On a page a detail is asked in its own kind, never in words.
    $asked = [];
    SchemaGraph::build(['scope' => 'page'] + $ctx, ['type' => 'Article', 'props' => ['headline' => $composition]], $read);
    self::assertSame(['text'], $asked);
  }

}
