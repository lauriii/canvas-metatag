<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\Hook\CanvasMetatagHooks;
use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Values;
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
   */
  private static function build(array $schema, array $tokens = [], array $images = [], array $ctx = []): array {
    return SchemaGraph::build(
      $ctx + self::CTX,
      $schema,
      static fn (string $template, bool $keep = FALSE): string => Values::fill($template, $tokens, $keep),
      static fn (string $reference): ?array => $images[$reference] ?? NULL,
    );
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
      self::assertIsString($node['@type'] ?? NULL, 'Every node has a type.');
    }
    $ours = array_map(static fn (string $name): string => (in_array($name, ['identity', 'logo', 'website'], TRUE) ? $home : $url) . "#$name", [
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
   * One expected graph per registry family.
   */
  #[DataProvider('providerFixtures')]
  public function testFixture(string $name): void {
    $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 2) . "/fixtures/graphs/$name.json"), TRUE, 32, JSON_THROW_ON_ERROR);
    $result = self::build($fixture['schema'], $fixture['tokens'], $fixture['images'], $fixture['ctx']);
    self::assertSame($fixture['graph'], $result['graph']);
    self::assertSame($fixture['report'], array_diff_key($result, ['graph' => TRUE]));
    self::assertGraphRules($result['graph'], $fixture['ctx']['home'], $fixture['ctx']['url']);
  }

  /**
   * Data provider for testFixture().
   */
  public static function providerFixtures(): array {
    return [['WebPage'], ['Article'], ['Event'], ['Product'], ['ProfilePage']];
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
        'ProfilePage',
      ],
      array_keys($types),
    );
    foreach (['BlogPosting' => 'Blog post', 'NewsArticle' => 'News article'] as $id => $label) {
      self::assertSame($label, $types[$id]['label']);
      self::assertSame($id, $types[$id]['primary_type']);
      self::assertSame('Article', $types[$id]['group']);
      self::assertSame('article', $types[$id]['og_type']);
      self::assertSame($types['Article']['props'], $types[$id]['props']);
      self::assertSame($types['Article']['refs'], $types[$id]['refs']);
      self::assertSame($types['Article']['nested'], $types[$id]['nested']);
      self::assertArrayNotHasKey('extends', $types[$id]);
    }
    // Every key is a legal config key and a schema.org property path, and
    // every intermediate object has a type.
    foreach ($types as $id => $type) {
      foreach ($type['props'] ?? [] as $prop) {
        self::assertMatchesRegularExpression('/^[A-Za-z]+(_[A-Za-z]+)*$/', $prop['key']);
        self::assertContains($prop['kind'], ['text', 'url', 'date', 'number', 'enum', 'image']);
        $path = explode('_', $prop['key']);
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
    foreach ([[], ['type' => 'Recipe']] as $schema) {
      $result = self::build($schema);
      self::assertSame(['Organization', 'WebSite', 'WebPage'], array_column($result['graph']['@graph'], '@type'));
      self::assertFalse($result['withheld']);
    }
  }

  /**
   * The @id table, exactly. These are identity and never change.
   */
  public function testIds(): void {
    $result = self::build(['type' => 'Article'], ['title' => 'Hello'], ['{image}' => self::IMAGE], [
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
   * Empty and invalid properties are left out and reported by level.
   */
  public function testMissing(): void {
    // Recommended and optional properties: the node ships without them.
    $result = self::build(['type' => 'Article', 'props' => ['author_url' => '{field.field_link}']], [
      'title' => 'Hello',
      'field.field_link' => 'not a url',
      'modified' => 'yesterday',
    ]);
    self::assertFalse($result['withheld']);
    self::assertSame([], $result['missing_required']);
    self::assertSame(['image', 'datePublished', 'dateModified', 'author_name'], $result['missing_recommended']);
    $article = $result['graph']['@graph'][3];
    self::assertSame(['@type', '@id', 'mainEntityOfPage', 'publisher', 'headline'], array_keys($article));
    self::assertSame(['@id' => self::URL . '#primary'], $result['graph']['@graph'][2]['mainEntity']);

    // A required property that does not resolve withholds the primary node.
    $result = self::build([
      'type' => 'Event',
      'props' => ['startDate' => '{field.field_when}', 'location_name' => 'Example Hall'],
    ], ['title' => 'Launch', 'field.field_when' => '']);
    self::assertTrue($result['withheld']);
    self::assertSame(['startDate', 'location_address_streetAddress'], $result['missing_required']);
    self::assertSame(['endDate', 'description', 'image'], $result['missing_recommended']);
    self::assertSame(['Organization', 'WebSite', 'WebPage'], array_column($result['graph']['@graph'], '@type'));
    self::assertArrayNotHasKey('mainEntity', $result['graph']['@graph'][2]);
    self::assertGraphRules($result['graph'], self::HOME, self::URL);

    // A stored empty default: the title is empty, so the name is missing.
    $result = self::build(['type' => 'ProfilePage'], ['title' => ' ']);
    self::assertTrue($result['withheld']);
    self::assertSame(['name'], $result['missing_required']);
    self::assertSame('ProfilePage', $result['graph']['@graph'][2]['@type']);
  }

  /**
   * How each kind is emitted.
   */
  public function testEmission(): void {
    $event = static fn (array $props, string $timezone = 'Europe/Helsinki'): array => self::build(
      ['type' => 'Event', 'props' => $props + ['location_address_streetAddress' => '1 Example Street']],
      ['title' => 'Launch'],
      [self::UUID => self::IMAGE],
      ['timezone' => $timezone],
    )['graph']['@graph'][3];

    // A time without an offset gets the site default timezone's, for that
    // day; a date, and a time that has an offset, are left alone.
    self::assertSame('2026-01-15T18:00+02:00', $event(['startDate' => '2026-01-15T18:00'])['startDate']);
    self::assertSame('2026-07-01T18:00:30+03:00', $event(['startDate' => '2026-07-01T18:00:30'])['startDate']);
    self::assertSame('2026-07-01T18:00:00-04:00', $event(['startDate' => '2026-07-01T18:00:00'], 'America/New_York')['startDate']);
    self::assertSame('2026-07-01', $event(['startDate' => '2026-07-01'])['startDate']);
    self::assertSame('2026-07-01T18:00Z', $event(['startDate' => '2026-07-01T18:00Z'])['startDate']);
    self::assertSame('2026-07-01T18:00:00+05:30', $event(['startDate' => '2026-07-01T18:00:00+05:30'])['startDate']);

    $node = $event([
      'startDate' => '2026-07-01',
      'eventStatus' => 'EventCancelled',
      'image' => self::UUID,
      'location_name' => "  Example \n Hall\x07 ",
    ]);
    self::assertSame('https://schema.org/EventCancelled', $node['eventStatus']);
    self::assertSame(['@type' => 'ImageObject', 'url' => self::IMAGE['url'], 'width' => 1200, 'height' => 630], $node['image']);
    self::assertSame([
      '@type' => 'Place',
      'name' => 'Example Hall',
      'address' => ['@type' => 'PostalAddress', 'streetAddress' => '1 Example Street'],
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
    $graph = self::build(['type' => 'Article', 'props' => ['image' => self::UUID]], [], [self::UUID => $unmeasured], [
      'logo' => ['url' => 'https://cms.example.com/logo.svg', 'width' => 0, 'height' => 0],
      'image' => $unmeasured,
    ])['graph']['@graph'];
    $nodes = array_column($graph, NULL, '@id');
    self::assertSame(['@type', '@id', 'url', 'contentUrl'], array_keys($nodes[self::HOME . '#logo']));
    self::assertSame(['@type', '@id', 'url', 'contentUrl', 'caption'], array_keys($nodes[self::URL . '#primaryimage']));
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
    yield 'unknown type' => ['Recipe', 'name', 'A', FALSE];
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
    yield 'pattern' => ['Product', 'offers_priceCurrency', 'EUR', TRUE];
    yield 'pattern lower case' => ['Product', 'offers_priceCurrency', 'eur', FALSE];
    yield 'pattern trailing newline' => ['Product', 'offers_priceCurrency', "EUR\n", FALSE];
    yield 'pattern no space' => ['Product', 'sku', 'A 1', FALSE];
    yield 'image UUID' => ['Article', 'image', self::UUID, TRUE];
    yield 'image token' => ['Article', 'image', '{image}', TRUE];
    yield 'image file name' => ['Article', 'image', 'hello.jpg', FALSE];
  }

  /**
   * Custom nodes can point at our nodes and can never replace or extend them.
   */
  public function testCustom(): void {
    $custom = [
      // Appended; a known token is filled, other brace text stays.
      [
        '@type' => 'WebSite',
        '@id' => '#search',
        'name' => '{site} search',
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
        'name' => 'Example search',
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
    $result = self::build(['type' => 'Event', 'custom' => '{"@type":"Thing","subjectOf":{"@id":"#primary"},"name":"A"}']);
    self::assertTrue($result['withheld']);
    self::assertSame(['@type' => 'Thing', 'name' => 'A'], $result['graph']['@graph'][3]);
    self::assertGraphRules($result['graph'], self::HOME, self::URL);

    // Garbage that got past the cleaner adds nothing.
    foreach (['<script>', '"text"', '[1, {"name": "no type"}]'] as $text) {
      self::assertCount(3, self::build(['custom' => $text])['graph']['@graph']);
    }
  }

  /**
   * Hostile text survives the coupled encoder as one script element.
   */
  public function testEncoderSafety(): void {
    $hostile = "</script><script>alert(1)</script> <!-- & \"double\" 'single' \u{2028}\u{2029} --> ]]>";
    $result = self::build(
      [
        'type' => 'Article',
        'props' => ['headline' => '{title}'],
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

}
