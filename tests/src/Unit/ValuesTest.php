<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Values;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

// cspell:ignore cing Ünïcode ééééé hinnasto päivä ddev lndo
/**
 * Tests the value shape: validation, encoding, layers and text output.
 */
#[CoversClass(Values::class)]
#[Group('canvas_metatag')]
final class ValuesTest extends UnitTestCase {

  private const UUID = '6f1c2a0e-5b7d-4c1e-9a53-0d6f7c1b2e44';

  /**
   * A source the template's link menu offers, and one it does not.
   */
  private const SUMMARY = [
    'expression' => 'ℹ︎␜entity:node:article␝field_summary␞␟value',
    'sourceType' => 'entity-field',
  ];
  private const HERO = [
    'expression' => 'ℹ︎␜entity:node:article␝field_hero␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}',
    'sourceType' => 'entity-field',
  ];
  private const CRAFTED = [
    'expression' => 'ℹ︎␜entity:node:article␝uid␞␟entity␜␜entity:user␝mail␞␟value',
    'sourceType' => 'entity-field',
  ];

  /**
   * Write mode's check of a source: the two offered ones, each of its kind.
   */
  private static function accepts(): \Closure {
    $text = ['text', 'words', 'line'];
    return static fn (array $source, string $kind): bool => ($source === self::SUMMARY && in_array($kind, $text, TRUE))
      || ($source === self::HERO && $kind === 'image');
  }

  /**
   * Typed text.
   */
  private static function typed(string $text): array {
    return ['text' => $text];
  }

  /**
   * Every rule refuses what it must, at the path the dialog shows it on.
   */
  #[DataProvider('providerRefused')]
  public function testRefused(string $scope, array $input, string $path, ?string $message = NULL, bool $readKeeps = FALSE): void {
    $errors = Values::clean($input, $scope, self::accepts())[1];
    self::assertSame([$path], array_keys($errors));
    if ($message !== NULL) {
      self::assertSame($message, $errors[$path]);
    }
    // Read mode drops the offending key instead of failing. It keeps a text
    // that was too long (cut) and a source it cannot check.
    $leaf = Values::clean($input, $scope, NULL)[0];
    foreach (explode('.', $path) as $segment) {
      $leaf = is_array($leaf) ? ($leaf[$segment] ?? NULL) : NULL;
    }
    self::assertSame($readKeeps, $leaf !== NULL);
  }

  /**
   * Data provider for testRefused().
   */
  public static function providerRefused(): \Generator {
    $address = 'Enter a full address that starts with https://, or a path that starts with /.';
    $hash = 'Leave out the # and everything after it.';
    $image = 'Choose an image from the list.';
    $invalid = 'This value is not valid.';
    $here = 'This setting is not available here.';
    $list = 'Choose a value from the list.';
    $field = 'Choose a field from the list.';
    $t = self::typed(...);

    // Shape and scope.
    yield 'unknown key' => ['page', ['keywords' => $t('a, b')], 'keywords'];
    yield 'site description' => ['site', ['description' => $t('Text')], 'description', $here];
    yield 'site main part' => ['site', ['title' => $t('Text')], 'title', $here];
    yield 'page description' => ['page', ['description' => $t('Text')], 'description'];
    yield 'template canonical' => ['template', ['canonical' => '/a'], 'canonical'];
    yield 'site social' => ['site', ['social' => ['title' => $t('A')]], 'social'];
    // The site only adds details to its identity.
    yield 'site schema type' => ['site', ['schema' => ['type' => 'Article']], 'schema.type'];
    yield 'unknown social key' => ['page', ['social' => ['card' => $t('x')]], 'social.card'];
    yield 'unknown robots key' => ['page', ['robots' => ['noarchive' => TRUE]], 'robots.noarchive'];
    yield 'unknown schema key' => ['page', ['schema' => ['context' => 'x']], 'schema.context'];
    yield 'map expected' => ['page', ['robots' => 'noindex'], 'robots'];

    // Values.
    yield 'a string is not a value' => ['page', ['title' => 'Pricing'], 'title', $invalid];
    yield 'two sources in one value' => [
      'template',
      ['title' => ['text' => 'A', 'fact' => 'title']],
      'title',
      $invalid,
    ];
    yield 'an unknown kind of value' => ['template', ['title' => ['token' => '{title}']], 'title', $invalid];
    yield 'typed text not a string' => ['page', ['title' => ['text' => ['a']]], 'title', $invalid];
    yield 'title too long' => [
      'page',
      ['title' => $t(str_repeat('é', 256))],
      'title',
      'Use at most 255 characters.',
      TRUE,
    ];
    yield 'ending too long' => [
      'page',
      ['title_end' => $t(str_repeat('é', 256))],
      'title_end',
      'Use at most 255 characters.',
      TRUE,
    ];
    yield 'social title too long' => [
      'page',
      ['social' => ['title' => $t(str_repeat('a', 256))]],
      'social.title',
      'Use at most 255 characters.',
      TRUE,
    ];
    yield 'description too long' => [
      'template',
      ['description' => $t(str_repeat('a', 1001))],
      'description',
      'Use at most 1000 characters.',
      TRUE,
    ];
    yield 'social description too long' => [
      'page',
      ['social' => ['description' => $t(str_repeat('a', 1001))]],
      'social.description',
      'Use at most 1000 characters.',
      TRUE,
    ];
    yield 'an unknown fact' => ['page', ['title_end' => ['fact' => 'nope']], 'title_end', $list];
    yield 'an image in text' => ['template', ['title' => ['fact' => 'image']], 'title', $list];
    yield 'a date in a text that does not compose' => [
      'template',
      ['title_end' => ['fact' => 'published']],
      'title_end',
      $list,
    ];
    yield 'a page links its main part' => ['page', ['title' => ['fact' => 'title']], 'title', $here];
    yield 'a page links its social image to its Image fact, its default' => [
      'page',
      ['social' => ['image' => ['fact' => 'image']]],
      'social.image',
      $here,
    ];
    yield 'a page links its social title' => [
      'page',
      ['social' => ['title' => ['fact' => 'title']]],
      'social.title',
      $here,
    ];
    yield 'a page ending linked to the title' => ['page', ['title_end' => ['fact' => 'title']], 'title_end', $list];
    yield 'a site ending linked to the title' => ['site', ['title_end' => ['fact' => 'title']], 'title_end', $list];
    yield 'a page text detail linked to a fact' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['headline' => ['fact' => 'title']]]],
      'schema.props.headline',
      $here,
    ];
    yield 'a field link on a page' => [
      'page',
      ['social' => ['description' => ['source' => self::SUMMARY]]],
      'social.description',
      $here,
    ];
    yield 'a field link in site settings' => ['site', ['title_end' => ['source' => self::SUMMARY]], 'title_end', $here];
    yield 'a field the menu does not offer' => [
      'template',
      ['description' => ['source' => self::CRAFTED]],
      'description',
      $field,
      TRUE,
    ];
    yield 'a field of another kind' => [
      'template',
      ['description' => ['source' => self::HERO]],
      'description',
      $field,
      TRUE,
    ];
    yield 'a source with an adapter' => [
      'template',
      ['description' => ['source' => self::SUMMARY + ['adapter' => 'x']]],
      'description',
      $invalid,
    ];
    yield 'a source of another type' => [
      'template',
      ['description' => ['source' => ['sourceType' => 'static', 'expression' => 'x']]],
      'description',
      $invalid,
    ];
    yield 'media in text' => ['template', ['title' => ['media' => self::UUID]], 'title', $invalid];

    // Canonical.
    yield 'canonical relative' => ['page', ['canonical' => 'pricing'], 'canonical', $address];
    yield 'canonical protocol-relative' => ['page', ['canonical' => '//example.com/a'], 'canonical', $address];
    yield 'canonical backslash' => ['page', ['canonical' => '/a\\b'], 'canonical', $address];
    yield 'canonical control character' => ['page', ['canonical' => "/a\x07b"], 'canonical', $address];
    yield 'canonical other scheme' => ['page', ['canonical' => 'ftp://example.com/a'], 'canonical', $address];
    yield 'canonical script' => ['page', ['canonical' => 'javascript:alert(1)'], 'canonical', $address];
    yield 'canonical credentials' => [
      'page',
      ['canonical' => 'https://user:secret@example.com/a'],
      'canonical',
      $address,
    ];
    yield 'canonical no host' => ['page', ['canonical' => 'https:///a'], 'canonical', $address];
    // Nothing that could end an attribute, a string or a URL.
    foreach (['"', '<', '>', '`', '{', '}', '|', '^', ' ', "\u{202E}", "\u{00A0}"] as $character) {
      yield 'canonical path with ' . json_encode($character) => [
        'page',
        ['canonical' => "/a{$character}b"],
        'canonical',
        $address,
      ];
    }
    yield 'canonical path markup' => ['page', ['canonical' => '/a"><script>alert(2)</script>'], 'canonical', $address];
    yield 'canonical too long' => ['page', ['canonical' => '/' . str_repeat('a', 2048)], 'canonical', $address];
    yield 'canonical path with fragment' => ['page', ['canonical' => '/pricing#plans'], 'canonical', $hash];
    yield 'canonical URL with fragment' => [
      'page',
      ['canonical' => 'https://example.com/pricing#plans'],
      'canonical',
      $hash,
    ];

    // Social image.
    yield 'image not a UUID' => ['page', ['social' => ['image' => ['media' => 'pricing.jpg']]], 'social.image', $image];
    yield 'image as typed text' => ['template', ['social' => ['image' => $t('pricing.jpg')]], 'social.image', $image];
    yield 'image a text fact' => ['template', ['social' => ['image' => ['fact' => 'title']]], 'social.image', $list];
    yield 'image two values' => [
      'page',
      ['social' => ['image' => ['media' => self::UUID, 'fact' => 'image']]],
      'social.image',
      $invalid,
    ];
    yield 'image a stored UUID string' => ['page', ['social' => ['image' => self::UUID]], 'social.image', $invalid];

    // Robots.
    yield 'boolean as string' => ['page', ['robots' => ['noindex' => 'true']], 'robots.noindex'];
    yield 'boolean as number' => ['site', ['robots' => ['nofollow' => 1]], 'robots.nofollow'];
    yield 'max_snippet below' => [
      'page',
      ['robots' => ['max_snippet' => -2]],
      'robots.max_snippet',
      'Enter a number from 0 to 1000, or -1 for no limit.',
    ];
    yield 'max_snippet above' => ['page', ['robots' => ['max_snippet' => 1001]], 'robots.max_snippet'];
    yield 'max_snippet string' => ['page', ['robots' => ['max_snippet' => '160']], 'robots.max_snippet'];
    yield 'max_snippet float' => ['page', ['robots' => ['max_snippet' => 1.5]], 'robots.max_snippet'];
    yield 'max_image_preview' => ['page', ['robots' => ['max_image_preview' => 'huge']], 'robots.max_image_preview'];

    // Structured data.
    // Read mode keeps a type this release no longer has, so it can be said.
    yield 'schema type' => [
      'page',
      ['schema' => ['type' => 'Movie']],
      'schema.type',
      'Choose one of the listed page types.',
      TRUE,
    ];
    yield 'schema type that is not a name' => [
      'page',
      ['schema' => ['type' => 'Movie<script>']],
      'schema.type',
      'Choose one of the listed page types.',
    ];
    yield 'prop of another type' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['offers_price' => $t('5')]]],
      'schema.props.offers_price',
      $here,
    ];
    yield 'prop without a type' => [
      'page',
      ['schema' => ['props' => ['headline' => $t('A')]]],
      'schema.props.headline',
    ];
    yield 'prop of the inherited type, named over' => [
      'page',
      ['schema' => ['type' => 'WebPage', 'props' => ['offers_price' => $t('5')]]],
      'schema.props.offers_price',
    ];
    yield 'prop url' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['author_url' => $t('/me')]]],
      'schema.props.author_url',
      'Enter a full address that starts with https://.',
    ];
    yield 'prop date' => [
      'page',
      ['schema' => ['type' => 'Event', 'props' => ['startDate' => $t('tomorrow')]]],
      'schema.props.startDate',
      'Choose a date.',
    ];
    yield 'prop number' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['offers_price' => $t('49,90')]]],
      'schema.props.offers_price',
      'Enter a number, like 49 or 49.90.',
    ];
    yield 'prop currency' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['offers_priceCurrency' => $t('euro')]]],
      'schema.props.offers_priceCurrency',
      'Choose a currency code from the list, such as EUR.',
    ];
    yield 'prop currency symbol' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['offers_priceCurrency' => $t('€')]]],
      'schema.props.offers_priceCurrency',
      'Choose a currency code from the list, such as EUR.',
    ];
    yield 'prop currency not a code' => [
      'page',
      ['schema' => ['type' => 'Service', 'props' => ['offers_priceCurrency' => $t('ABC')]]],
      'schema.props.offers_priceCurrency',
      'Choose a currency code from the list, such as EUR.',
      // A code stored before the list is kept when read: the graph reports
      // it as dropped.
      TRUE,
    ];
    yield 'prop bought here' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['sold_here' => $t('maybe')]]],
      'schema.props.sold_here',
      'Choose one of the listed options.',
    ];
    yield 'prop bought here on a service' => [
      'page',
      ['schema' => ['type' => 'Service', 'props' => ['sold_here' => $t('yes')]]],
      'schema.props.sold_here',
    ];
    yield 'prop billing' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['billing' => $t('weekly')]]],
      'schema.props.billing',
      'Choose one of the listed options.',
    ];
    yield 'skip not a list' => ['page', ['schema' => ['skip' => '#faq']], 'schema.skip', 'This value is not valid.'];
    yield 'skip not strings' => ['page', ['schema' => ['skip' => [1]]], 'schema.skip', 'This value is not valid.'];
    yield 'prop pattern' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['sku' => $t('A 1')]]],
      'schema.props.sku',
      'This value has characters that are not allowed here.',
    ];
    yield 'prop enum' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['offers_availability' => $t('Maybe')]]],
      'schema.props.offers_availability',
      'Choose one of the listed options.',
    ];
    yield 'prop image as text' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['image' => $t('{title}')]]],
      'schema.props.image',
      $image,
    ];
    yield 'prop date linked to the title' => [
      'template',
      ['schema' => ['type' => 'Article', 'props' => ['datePublished' => ['fact' => 'title']]]],
      'schema.props.datePublished',
      $list,
    ];
    yield 'prop too long' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['headline' => $t(str_repeat('a', 2001))]]],
      'schema.props.headline',
      'Use at most 2000 characters.',
      TRUE,
    ];

    // Custom JSON-LD: the shared fixtures (testSharedFixtures()) hold the
    // rest; these pin the field each error is on.
    yield 'custom not JSON' => [
      'page',
      ['schema' => ['custom' => '{"@type": ']],
      'schema.custom',
      'This is not valid JSON.',
    ];
    yield 'custom as written over 64 KB' => [
      'page',
      ['schema' => ['custom' => '{"@type": "Thing", "name": "' . str_repeat('a', 65536) . '"}']],
      'schema.custom',
      '65 KB as written. Keep under 64 KB.',
    ];
    yield 'added details changing the type' => [
      'page',
      ['schema' => ['type' => 'Product', 'extend' => ['#primary' => '{"@type": "Service"}']]],
      'schema.extend.#primary',
      '@type: a type can only be added to “Product”, in a list that keeps it.',
    ];
    yield 'added details on a node the scope has not' => [
      'page',
      ['schema' => ['extend' => ['#identity' => '{"slogan": "x"}']]],
      'schema.extend.#identity',
    ];
    yield 'a main thing that is not a hand-added item' => [
      'page',
      ['schema' => ['custom' => '{"@type": "Recipe", "@id": "#x-recipe"}', 'main' => '#other']],
      'schema.main',
      'Choose one of your own items.',
    ];
    yield 'the site has no hand-added items' => [
      'site',
      ['schema' => ['custom' => '{"@type": "Thing"}']],
      'schema.custom',
    ];
  }

  /**
   * Valid values come back unchanged, in canonical key order.
   */
  #[DataProvider('providerAccepted')]
  public function testAccepted(string $scope, array $input, ?array $expected = NULL): void {
    self::assertSame([$expected ?? $input, []], Values::clean($input, $scope, self::accepts()));
  }

  /**
   * Data provider for testAccepted().
   */
  public static function providerAccepted(): \Generator {
    $t = self::typed(...);
    yield 'text is stored as typed' => ['page', ['title' => $t('I <3 Canvas & more ')]];
    yield 'format characters survive' => ['template', ['title' => $t("Team 👨‍👩 \u{200C}\u{200F}")]];
    yield 'braces are typed text' => ['page', ['title' => $t('{Title} {site} {field.x}')]];
    yield 'facts and a field on a template' => ['template', [
      'description' => ['source' => self::SUMMARY],
      'social' => ['image' => ['source' => self::HERO], 'title' => ['fact' => 'author']],
      'title' => ['fact' => 'title'],
      'title_end' => ['fact' => 'site'],
    ],
    ];
    yield 'source keys in canonical order' => [
      'template',
      ['description' => ['source' => array_reverse(self::SUMMARY, TRUE)]],
      ['description' => ['source' => ['expression' => self::SUMMARY['expression'], 'sourceType' => 'entity-field']]],
    ];
    yield 'no ending is stored' => ['page', ['title_end' => $t('')]];
    yield 'no ending, whitespace only' => ['site', ['title_end' => $t('  ')], ['title_end' => $t('')]];
    yield 'a page ending linked to the site name' => ['page', ['title_end' => ['fact' => 'site']]];
    yield 'a site ending' => ['site', ['title_end' => $t('Example Co')]];
    yield 'control and bidi characters are removed' => [
      'page',
      ['title' => $t("Pri\x07cing\u{202E}\u{2066}\u{0085}\tplans\n")],
      ['title' => $t("Pricing\tplans\n")],
    ];
    yield 'empty values are pruned' => [
      'page',
      [
        'title' => $t(" \n"),
        'canonical' => '',
        'social' => ['title' => $t('')],
        'robots' => [],
        'schema' => ['props' => [], 'custom' => ' '],
      ],
      [],
    ];
    yield 'canonical path' => ['page', ['canonical' => '/pricing?plan=team']];
    yield 'canonical path with every allowed character' => ['page', ['canonical' => "/a-._~!$&'()*+,;=:@%20/b?c=d"]];
    yield 'canonical path with non-ASCII letters' => ['page', ['canonical' => '/hinnasto/päivä']];
    yield 'canonical URL' => ['page', ['canonical' => 'https://www.example.com/pricing']];
    yield 'image media' => ['page', ['social' => ['image' => ['media' => self::UUID]]]];
    yield 'a page date linked to a fact' => [
      'page',
      ['schema' => ['props' => ['dateModified' => ['fact' => 'modified']], 'type' => 'Article']],
    ];
    yield 'max_snippet no limit' => ['site', ['robots' => ['max_snippet' => -1]]];
    yield 'max_snippet zero' => ['page', ['robots' => ['max_snippet' => 0]]];
    yield 'max_snippet highest' => ['page', ['robots' => ['max_snippet' => 1000]]];
    yield 'false overrides an inherited true' => [
      'page',
      ['robots' => ['noindex' => FALSE, 'max_image_preview' => 'none']],
      ['robots' => ['max_image_preview' => 'none', 'noindex' => FALSE]],
    ];
    yield 'schema literals' => ['page', [
      'schema' => [
        'type' => 'Product',
        'props' => [
          'name' => $t('Desk'),
          'offers_price' => $t('49.90'),
          'offers_priceCurrency' => $t('EUR'),
          'offers_availability' => $t('InStock'),
          'image' => ['media' => self::UUID],
        ],
      ],
    ], [
      'schema' => [
        'props' => [
          'image' => ['media' => self::UUID],
          'name' => $t('Desk'),
          'offers_availability' => $t('InStock'),
          'offers_price' => $t('49.90'),
          'offers_priceCurrency' => $t('EUR'),
        ],
        'type' => 'Product',
      ],
    ],
    ];
    yield 'a linked detail is checked when it is read' => [
      'template',
      ['schema' => ['props' => ['description' => ['source' => self::SUMMARY]], 'type' => 'Event']],
    ];
    yield 'extended type has the props of its parent' => [
      'page',
      ['schema' => ['props' => ['headline' => $t('A')], 'type' => 'BlogPosting']],
    ];
    $typed = <<<'JSON'
       { "name" : "Q&A <b>", "@type":"FAQPage", "@id": "#faq",
        "url": "https://example.com/a", "empty": {}, "list": [],
        "potentialAction": {"urlTemplate": "/s?q={search_term_string}"} }
      JSON;
    yield 'custom is stored as written, trimmed' => [
      'page',
      ['schema' => ['custom' => "\n$typed\n "]],
      ['schema' => ['custom' => trim($typed)]],
    ];
    yield 'custom empty list is nothing' => ['page', ['schema' => ['custom' => '[]']], []];
    yield 'added details and a main thing' => [
      'page',
      [
        'schema' => [
          'custom' => '{"@type": "Recipe", "@id": "#x-recipe"}',
          'extend' => ['#webpage' => '{"@type": ["WebPage", "QAPage"]}'],
          'main' => '#x-recipe',
        ],
      ],
    ];
    yield 'list selectors in added details' => [
      'page',
      [
        'schema' => [
          'extend' => ['#primary' => '{"offers[*]": {"itemCondition": "NewCondition"}, "offers[name=Growth]": {"eligibleQuantity": 5}}'],
          'type' => 'Service',
        ],
      ],
    ];
    yield 'the site adds details to its identity' => [
      'site',
      ['schema' => ['extend' => ['#identity' => '{"slogan": "Moving things since 1990", "foundingDate": "1990"}']]],
    ];
  }

  /**
   * The dialog's red problems are exactly the server's (validate.test.ts).
   *
   * @param array{input: string, accepted: bool, stored?: bool, message?: string, item?: int, path?: string, mode?: array} $case
   *   One case of tests/fixtures/custom/.
   */
  #[DataProvider('providerSharedFixtures')]
  public function testSharedFixtures(array $case): void {
    $checked = Values::checkCustom($case['input'], $case['mode'] ?? []);
    if ($case['accepted']) {
      self::assertNull($checked['error'], $checked['error']['message'] ?? '');
      self::assertSame(($case['stored'] ?? TRUE) ? $case['text'] ?? trim($case['input']) : NULL, $checked['text']);
      return;
    }
    self::assertSame(['message' => $case['message'], 'item' => $case['item'], 'path' => $case['path']], $checked['error']);
  }

  /**
   * Data provider for testSharedFixtures().
   */
  public static function providerSharedFixtures(): \Generator {
    foreach (glob(dirname(__DIR__, 3) . '/tests/fixtures/custom/*.json') as $file) {
      foreach (json_decode((string) file_get_contents($file), TRUE, 64, JSON_THROW_ON_ERROR) as $case) {
        yield basename($file, '.json') . ': ' . $case['name'] => [$case];
      }
    }
  }

  /**
   * Hand-added JSON-LD is stored byte for byte; its limits count minified.
   */
  public function testCustomStoredAsWritten(): void {
    $text = "{\n  \"@type\": \"Rating\",\n  \"ratingValue\": 4.5,\n  \"bestRating\": 5\n}";
    self::assertSame($text, Values::clean(['schema' => ['custom' => $text]], 'page', self::accepts())[0]['schema']['custom']);

    // About 31 KB minified, 40 KB formatted: accepted.
    $items = array_map(static fn (int $n): array => ['@type' => 'Thing', 'name' => str_repeat('x', 3100), 'n' => $n], range(1, 10));
    $formatted = str_replace('"n"', str_repeat(' ', 900) . '"n"', json_encode($items, JSON_PRETTY_PRINT));
    self::assertGreaterThan(40000, strlen($formatted));
    self::assertLessThan(32768, strlen(json_encode($items)));
    [$clean, $errors] = Values::clean(['schema' => ['custom' => $formatted]], 'page', self::accepts());
    self::assertSame([], $errors);
    self::assertSame($formatted, $clean['schema']['custom']);

    // 32 KB across hand-added items and added details together: refused.
    $half = json_encode(['@type' => 'Thing', 'name' => str_repeat('x', 17000)]);
    [, $errors] = Values::clean([
      'schema' => [
        'type' => 'Product',
        'custom' => $half,
        'extend' => ['#primary' => json_encode(['description' => str_repeat('y', 17000)])],
      ],
    ], 'page', self::accepts(), 'WebPage', NULL, $paths);
    // Said on every text: the one sent back as stored is carried, the one
    // that grew is still refused (ApiTest::testCustomJsonLdErrorPath()).
    $over = '34 KB. Keep under 32 KB, including added details.';
    self::assertSame(['schema.custom' => $over, 'schema.extend.#primary' => $over], $errors);
    $whole = ['item' => 0, 'path' => ''];
    self::assertSame(['schema.custom' => $whole, 'schema.extend.#primary' => $whole], $paths);

    // Where in the text a refusal is.
    [, $errors] = Values::clean(['schema' => ['custom' => '[{"@type": "Thing"}, {"@type": "Rating", "ratingValue": 1e400}]']], 'page', self::accepts(), 'WebPage', NULL, $paths);
    self::assertSame('ratingValue: this number is too large to use.', $errors['schema.custom']);
    self::assertSame(['item' => 1, 'path' => '/ratingValue'], $paths['schema.custom']);
  }

  /**
   * An absolute address of the site's own items is the site's too.
   */
  public function testOriginReservesAbsoluteIds(): void {
    $custom = '{"@type": "Organization", "@id": "https://example.com/#identity"}';
    $errors = Values::clean(['schema' => ['custom' => $custom]], 'page', self::accepts(), 'WebPage', 'https://example.com')[1];
    self::assertSame('“https://example.com/#identity” is made by this page. Use Add details, or give the item another @id.', $errors['schema.custom']);
    // Whichever scheme it is written with.
    $http = '{"@type": "Organization", "@id": "http://example.com/#identity"}';
    self::assertArrayHasKey('schema.custom', Values::clean(['schema' => ['custom' => $http]], 'page', self::accepts(), 'WebPage', 'https://example.com')[1]);
    // Another site's identity is just an organization.
    self::assertSame([], Values::clean(['schema' => ['custom' => $custom]], 'page', self::accepts(), 'WebPage', 'https://other.example')[1]);
  }

  /**
   * An added type keeps the type the node is output with.
   */
  public function testAddedTypeKeepsTheEmittedType(): void {
    $place = static fn (string $kind, string $types): array => Values::clean([
      'schema' => [
        'type' => 'LocalBusiness',
        'props' => ['placeKind' => self::typed($kind)],
        'extend' => ['#primary' => '{"@type": ' . $types . '}'],
      ],
    ], 'page', self::accepts())[1];
    // A restaurant is output as Restaurant: a list keeps that.
    self::assertSame([], $place('Restaurant', '["Restaurant", "Store"]'));
    self::assertSame('@type: a type can only be added to “Restaurant”, in a list that keeps it.', $place('Restaurant', '["LocalBusiness", "Store"]')['schema.extend.#primary']);
    // Without a kind, the default is the registry's.
    $default = ['type' => 'LocalBusiness', 'extend' => ['#primary' => '{"@type": ["LocalBusiness", "Store"]}']];
    self::assertSame([], Values::clean(['schema' => $default], 'page', self::accepts())[1]);
    self::assertSame(['#primary' => ['Restaurant'], '#webpage' => ['WebPage'], '#identity' => ['Person']], Values::nodeTypes('LocalBusiness', ['placeKind' => self::typed('Restaurant')], 'person'));

    // The identity keeps its own kind when the site saves.
    $site = static fn (string $kind, string $types): array => Values::clean(['schema' => ['extend' => ['#identity' => '{"@type": ' . $types . '}']]], 'site', self::accepts(), 'WebPage', NULL, $paths, ['identity' => $kind])[1];
    self::assertSame([], $site('organization', '["Organization", "Corporation"]'));
    self::assertArrayHasKey('schema.extend.#identity', $site('organization', '["Person", "Corporation"]'));
    self::assertSame([], $site('person', '["Person", "Patient"]'));
    self::assertSame('@type: a type can only be added to “Person”, in a list that keeps it.', $site('person', '["Organization", "Corporation"]')['schema.extend.#identity']);

    // The page's type changed since: read mode keeps the other details and
    // leaves out only the type that no longer fits.
    $text = "{\n  \"@type\": [\"Product\", \"IndividualProduct\"],\n  \"color\": \"Oak\"\n}";
    $stored = ['schema' => ['type' => 'Event', 'extend' => ['#primary' => $text]]];
    [$clean, $errors] = Values::clean($stored, 'page', NULL);
    self::assertSame([], $errors);
    self::assertSame("{\n  \"color\": \"Oak\"\n}", $clean['schema']['extend']['#primary']);
    // Only a type: nothing is left.
    $stored['schema']['extend']['#primary'] = '{"@type": ["Product", "IndividualProduct"]}';
    self::assertArrayNotHasKey('extend', Values::clean($stored, 'page', NULL)[0]['schema']);
    // Write mode still refuses it, so the dialog says so before it goes.
    $written = ['type' => 'Event', 'extend' => ['#primary' => $text]];
    self::assertArrayHasKey('schema.extend.#primary', Values::clean(['schema' => $written], 'page', self::accepts())[1]);
  }

  /**
   * A stored item that read mode refuses is left out; the others are kept.
   */
  public function testReadLeavesOutOnlyTheRefusedItem(): void {
    $stored = '[{"@type": "Thing", "name": "Kept"}, {"@type": "Rating", "ratingValue": 1e400}, {"@type": "Thing", "name": "Also kept"}]';
    [$clean, $errors] = Values::clean(['schema' => ['custom' => $stored]], 'page', NULL, 'WebPage', NULL, $paths);
    self::assertSame(['Kept', 'Also kept'], array_column(json_decode($clean['schema']['custom'], TRUE), 'name'));
    self::assertSame('ratingValue: this number is too large to use.', $errors['schema.custom']);
    self::assertSame(['item' => 1, 'path' => '/ratingValue'], $paths['schema.custom']);
    // The only item refused: nothing is left.
    self::assertArrayNotHasKey('schema', Values::clean(['schema' => ['custom' => '{"@type":"Rating","ratingValue":1e400}']], 'page', NULL)[0]);
    // A dense value the module rewrites stays under 64 KB as written.
    $dense = json_decode(json_encode(['@type' => 'Thing', 'a' => [[array_fill(0, 15000, 1)]]]));
    self::assertGreaterThan(Values::CUSTOM_RAW_MAX, strlen(Values::pretty($dense)));
    self::assertLessThanOrEqual(Values::CUSTOM_RAW_MAX, strlen(Values::written($dense)));
  }

  /**
   * Ids stored before they were reserved are renamed when read.
   */
  public function testReadRenamesLegacyIds(): void {
    $stored = '[{"@id":"#identity","@type":"Organization","name":"Acme Logistics"},'
      . '{"@id":"#review","@type":"Review","author":{"@id":"#identity"},"itemReviewed":{"@id":"#webpage"}},'
      . '{"@id":"#webpage","@type":"Thing"},{"@id":"#review","@type":"Thing"}]';
    $clean = Values::clean(['schema' => ['custom' => $stored]], 'page', NULL)[0]['schema'];
    $items = json_decode($clean['custom'], TRUE);
    self::assertSame(['#identity-2', '#review', '#webpage-2', '#review-2'], array_column($items, '@id'));
    // A site id on a page was the item itself; the page's id was its node.
    self::assertSame(['@id' => '#identity-2'], $items[1]['author']);
    self::assertSame(['@id' => '#webpage'], $items[1]['itemReviewed']);
    // What was left out before stays out.
    self::assertSame(['#webpage-2', '#review-2'], $clean['skip']);
    // Written by the module: two spaces, in stored key order.
    self::assertStringStartsWith("[\n  {\n    \"@id\": \"#identity-2\",\n    \"@type\"", $clean['custom']);
    // Write mode refuses them.
    self::assertArrayHasKey('schema.custom', Values::clean(['schema' => ['custom' => $stored]], 'page', self::accepts())[1]);
    // An id with the components' prefix was the item: it keeps its output
    // under a name that is not reserved, and references follow it.
    $suite = '[{"@id":"#c-suite","@type":"Thing","name":"Suite"},{"@type":"Review","itemReviewed":{"@id":"#c-suite"}},{"@id":"#c-suite","@type":"Thing"}]';
    $clean = Values::clean(['schema' => ['custom' => $suite]], 'template', NULL)[0]['schema'];
    $items = json_decode($clean['custom'], TRUE);
    self::assertSame('#item-c-suite', $items[0]['@id']);
    self::assertSame(['@id' => '#item-c-suite'], $items[1]['itemReviewed']);
    self::assertSame('#item-c-suite-2', $items[2]['@id']);
    self::assertSame(['#item-c-suite-2'], $clean['skip']);
    [$data, $renames] = Values::renameReserved(json_decode('{"@type":"Thing","@id":"#c-suite"}'));
    self::assertSame('#item-c-suite', $data->{'@id'});
    self::assertSame([['from' => '#c-suite', 'to' => '#item-c-suite', 'skip' => FALSE]], $renames);
  }

  /**
   * Commerce details, the left-out list and the site currency.
   */
  public function testCommerce(): void {
    $product = [
      'schema' => [
        'props' => [
          'billing' => self::typed('P1M'),
          'offers_priceCurrency' => self::typed('EUR'),
          'sold_here' => self::typed('no'),
        ],
        'type' => 'Product',
      ],
    ];
    self::assertSame([$product, []], Values::clean($product, 'page', self::accepts()));

    // Only the @ids of items that are there stay listed, once, as written.
    $custom = '[{"@id":"#faq","@type":"FAQPage"},{"@type":"Thing"}]';
    [
      $clean,
      $errors,
    ] = Values::clean([
      'schema' => [
        'custom' => $custom,
        'skip' => ['#faq', '#gone', '#faq'],
      ],
    ], 'page', self::accepts());
    self::assertSame([], $errors);
    self::assertSame(['#faq'], $clean['schema']['skip']);
    self::assertArrayNotHasKey('skip', Values::clean(['schema' => ['skip' => ['#faq']]], 'page', NULL)[0]['schema'] ?? []);
    // The custom JSON-LD is stored as before.
    self::assertSame($custom, $clean['schema']['custom']);

    // The site currency is a code of the list, or nothing.
    self::assertSame(['EUR', NULL], Values::currency('EUR'));
    self::assertSame(['', NULL], Values::currency(''));
    self::assertSame(['', NULL], Values::currency(NULL));
    foreach (['€', 'eur', 'EURO', 'XXX', 5] as $refused) {
      self::assertSame(['', 'Choose a currency code from the list, such as EUR.'], Values::currency($refused));
    }

    // A stored type this release no longer has is kept, as a web page.
    self::assertSame(['schema' => ['type' => 'Movie']], Values::clean([
      'schema' => [
        'type' => 'Movie',
        'props' => ['name' => self::typed('Soup')],
      ],
    ], 'page', NULL)[0]);
  }

  /**
   * A translation's details belong to the type it inherits.
   */
  public function testInheritedType(): void {
    $props = ['schema' => ['props' => ['name' => self::typed('Widget'), 'offers_price' => self::typed('49')]]];
    self::assertSame([$props, []], Values::clean($props, 'page', self::accepts(), 'Product'));
    self::assertSame([[], []], Values::clean([], 'page', self::accepts(), 'Product'));
    // Read mode keeps them, as the resolver reads a translation.
    self::assertSame($props, Values::clean($props, 'page', NULL, 'Product')[0]);
    // Without the inherited type they are not available.
    self::assertSame([
      'schema.props.name',
      'schema.props.offers_price',
    ], array_keys(Values::clean($props, 'page', self::accepts())[1]));
    // A type named in the values wins over the inherited one.
    self::assertSame([
      'schema.props.name',
      'schema.props.offers_price',
    ], array_keys(Values::clean(['schema' => ['type' => 'Article'] + $props['schema']], 'page', self::accepts(), 'Product')[1]));
    // An inherited type the registry does not know is WebPage.
    self::assertSame([
      'schema.props.name',
      'schema.props.offers_price',
    ], array_keys(Values::clean($props, 'page', self::accepts(), 'Movie')[1]));
  }

  /**
   * Read mode cuts, drops and keeps what write mode refuses.
   */
  public function testReadMode(): void {
    $gone = ['expression' => 'ℹ︎␜entity:node:article␝field_gone␞␟value', 'sourceType' => 'entity-field'];
    [$clean, $errors] = Values::clean([
      'title' => self::typed(str_repeat('é', 300)),
      'description' => self::typed('not allowed on a page'),
      'canonical' => 'javascript:alert(1)',
      'social' => ['title' => ['source' => $gone], 'image' => ['media' => 'nope'], 'card' => 'x'],
      'robots' => ['noindex' => TRUE, 'max_snippet' => 5000],
      'schema' => [
        'type' => 'Article',
        'props' => ['headline' => ['fact' => 'nope'], 'author_url' => self::typed('nope')],
        'custom' => '<script>',
      ],
    ], 'page', NULL);
    self::assertSame([
      'robots' => ['noindex' => TRUE],
      'schema' => ['type' => 'Article'],
      'title' => self::typed(str_repeat('é', 255)),
    ], $clean);
    self::assertNotEmpty($errors);
    // On a template a source that can no longer be read is kept: it reads as
    // broken, and recreating its field heals it.
    self::assertSame(['description' => ['source' => $gone]], Values::clean(['description' => ['source' => $gone]], 'template', NULL)[0]);
  }

  /**
   * The identity is always complete; refused members fall back.
   */
  public function testCleanIdentity(): void {
    $identity = [
      'kind' => 'person',
      'name' => "Ada\x07 Writer",
      'separator' => ' – ',
      'logo' => self::UUID,
      'default_image' => '',
      'same_as' => ['https://social.example.com/ada', '  ', 'https://example.org/ada'],
    ];
    self::assertSame([
      [
        'kind' => 'person',
        'name' => 'Ada Writer',
        'separator' => '–',
        'logo' => self::UUID,
        'default_image' => '',
        'same_as' => ['https://social.example.com/ada', 'https://example.org/ada'],
      ],
      [],
    ], Values::cleanIdentity($identity));

    [$clean, $errors] = Values::cleanIdentity([
      'kind' => 'company',
      'name' => str_repeat('a', 256),
      'separator' => 'and',
      'logo' => 'logo.png',
      'default_image' => 7,
      'same_as' => ['https://example.org/a', 'example.org/b', 'ftp://example.org/c'],
    ]);
    self::assertSame([
      'identity.kind',
      'identity.name',
      'identity.separator',
      'identity.logo',
      'identity.default_image',
      'identity.same_as.1',
      'identity.same_as.2',
    ], array_keys($errors));
    self::assertSame('Line 2 is not a full address. Start with https://.', $errors['identity.same_as.1']);
    self::assertSame('Use one to three symbols, like | or –.', $errors['identity.separator']);
    self::assertSame([
      'kind' => 'organization',
      'name' => str_repeat('a', 255),
      'separator' => '|',
      'logo' => '',
      'default_image' => '',
      'same_as' => ['https://example.org/a'],
    ], $clean);

    // Nothing given: the defaults, and nothing to report.
    self::assertSame([
      [
        'kind' => 'organization',
        'name' => '',
        'separator' => '|',
        'logo' => '',
        'default_image' => '',
        'same_as' => [],
      ],
      [],
    ], Values::cleanIdentity([]));

    foreach (['', '    ', 'a', '1', '||||', '| |'] as $separator) {
      self::assertArrayHasKey('identity.separator', Values::cleanIdentity(['separator' => $separator])[1], "Separator '$separator'");
    }
    foreach (['|', '·', '—', '::', '»'] as $separator) {
      self::assertSame([], Values::cleanIdentity(['separator' => $separator])[1], "Separator '$separator'");
    }
    self::assertSame(['identity.same_as.10'], array_keys(Values::cleanIdentity(['same_as' => array_fill(0, 11, 'https://example.org/a')])[1]));
    // A list, and each address as long as a canonical may be.
    [$clean, $errors] = Values::cleanIdentity(['same_as' => ['a' => 'https://example.org/a']]);
    self::assertSame([['identity.same_as'], []], [array_keys($errors), $clean['same_as']]);
    self::assertSame(['identity.same_as.0'], array_keys(Values::cleanIdentity(['same_as' => ['https://example.org/' . str_repeat('a', 2030)]])[1]));
  }

  /**
   * Hosts no visitor reaches, and hosts of a development copy.
   */
  #[DataProvider('providerHosts')]
  public function testHosts(string $host, bool $public, bool $development): void {
    self::assertSame($public, Values::isPublicHost($host), "$host is public");
    self::assertSame($development, Values::isDevelopmentHost($host), "$host is a development host");
  }

  /**
   * Hosts: whether each is public, and whether it is a development host.
   */
  public static function providerHosts(): \Generator {
    // Loopback addresses and localhost: neither public, and development.
    yield '127.0.0.1' => ['127.0.0.1', FALSE, TRUE];
    yield '[::1]' => ['[::1]', FALSE, TRUE];
    yield 'localhost' => ['localhost', FALSE, TRUE];
    yield 'under localhost' => ['app.localhost', FALSE, TRUE];
    yield 'site.test' => ['site.test', FALSE, TRUE];
    yield 'under invalid' => ['cms.invalid', FALSE, TRUE];
    // Other spellings of a loopback address.
    yield '127.1' => ['127.1', FALSE, TRUE];
    yield 'one number' => ['2130706433', FALSE, TRUE];
    yield 'uncompressed ::1' => ['[0:0:0:0:0:0:0:1]', FALSE, TRUE];
    yield 'IPv4 in IPv6' => ['[::ffff:127.0.0.1]', FALSE, TRUE];
    yield 'loopback in another IPv6 form' => ['[::ffff:7f00:1]', FALSE, TRUE];
    // Octal and hex, as URL parsers in browsers read them.
    yield 'octal' => ['0177.0.0.1', FALSE, TRUE];
    yield 'hex' => ['0x7f.0.0.1', FALSE, TRUE];
    yield 'one hex number' => ['0x7f000001', FALSE, TRUE];
    // Where development servers listen.
    yield 'unspecified IPv4' => ['0.0.0.0', FALSE, TRUE];
    yield 'unspecified IPv6' => ['[::]', FALSE, TRUE];
    // A known local suffix resolves to 127.0.0.1: not public, development.
    yield 'a known local suffix' => ['cms.ddev.site', FALSE, TRUE];
    yield 'another known local suffix' => ['front.lndo.site', FALSE, TRUE];
    // Private, internal, single-label: not public, and production-like.
    yield '10.0.0.5' => ['10.0.0.5', FALSE, FALSE];
    yield '192.168.1.20' => ['192.168.1.20', FALSE, FALSE];
    yield 'link-local' => ['169.254.10.1', FALSE, FALSE];
    yield 'link-local IPv6' => ['[fe80::1]', FALSE, FALSE];
    yield 'private IPv6' => ['[fd00::1]', FALSE, FALSE];
    yield 'cms' => ['cms', FALSE, FALSE];
    yield 'default, as Drush has it' => ['default', FALSE, FALSE];
    yield 'cms.internal' => ['cms.internal', FALSE, FALSE];
    yield 'shop.local' => ['shop.local', FALSE, FALSE];
    yield 'home.arpa' => ['nas.home.arpa', FALSE, FALSE];
    yield 'the example domain' => ['www.example', FALSE, FALSE];
    yield 'shared by a carrier' => ['100.64.1.1', FALSE, FALSE];
    yield 'private IPv4 in IPv6' => ['[::ffff:10.0.0.5]', FALSE, FALSE];
    yield 'numbers that are no address' => ['999.1', FALSE, FALSE];
    yield 'an octal digit out of range' => ['08.0.0.1', FALSE, FALSE];
    yield 'a hex last label' => ['www.example.0x1', FALSE, FALSE];
    // Public, and production-like.
    yield 'www.example.com' => ['www.example.com', TRUE, FALSE];
    yield 'with a final dot, in capitals' => ['WWW.Example.COM.', TRUE, FALSE];
    yield '203.0.113.10' => ['203.0.113.10', TRUE, FALSE];
    yield 'public IPv4 in IPv6' => ['[::ffff:203.0.113.10]', TRUE, FALSE];
    yield 'a word inside a name is not a suffix' => ['test.example.com', TRUE, FALSE];
  }

  /**
   * An absolute http(s) address, IPv6 literals included.
   */
  public function testHttpUrl(): void {
    self::assertTrue(Values::isHttpUrl('https://www.example.com/a?b=1'));
    self::assertTrue(Values::isHttpUrl('http://[::1]:3000'));
    self::assertTrue(Values::isHttpUrl('http://[::ffff:127.0.0.1]:3000/a'));
    self::assertFalse(Values::isHttpUrl('http://[::ffff:127.0.0.1/a'));
    self::assertFalse(Values::isHttpUrl('http://[nope]/'));
    self::assertFalse(Values::isHttpUrl('http://user@www.example.com'));
    self::assertFalse(Values::isHttpUrl('ftp://www.example.com'));
  }

  /**
   * The encoding is canonical: one value, one string.
   */
  public function testEncodeDecode(): void {
    $a = [
      'title' => self::typed('Pricing'),
      'social' => ['image' => ['media' => self::UUID]],
      'schema' => ['type' => 'Article', 'props' => ['headline' => self::typed('Plans and prices')]],
      'robots' => ['max_snippet' => 160],
      'canonical' => '/pricing',
    ];
    $b = [
      'canonical' => '/pricing',
      'robots' => ['max_snippet' => 160, 'nofollow' => NULL],
      'schema' => ['props' => ['headline' => self::typed('Plans and prices')], 'type' => 'Article', 'custom' => ''],
      'social' => ['image' => ['media' => self::UUID], 'title' => self::typed('  ')],
      'title' => self::typed('Pricing'),
      'description' => self::typed(''),
    ];
    $expected = '{"canonical":"/pricing","robots":{"max_snippet":160},"schema":{"props":{"headline":{"text":"Plans and prices"}},"type":"Article"},"social":{"image":{"media":"' . self::UUID . '"}},"title":{"text":"Pricing"}}';
    self::assertSame($expected, Values::encode($a));
    self::assertSame($expected, Values::encode($b));
    self::assertSame($expected, Values::encode(Values::decode($expected)));
    self::assertSame('{"robots":{"noindex":false},"title":{"text":"Ünïcode / ✓"}}', Values::encode([
      'title' => self::typed('Ünïcode / ✓'),
      'robots' => ['noindex' => FALSE],
    ]));
    // "No ending" is the one empty value that is kept.
    self::assertSame('{"title_end":{"text":""}}', Values::encode([
      'title_end' => self::typed(''),
      'title' => self::typed(''),
    ]));

    self::assertNull(Values::encode([]));
    self::assertNull(Values::encode([
      'title' => self::typed(' '),
      'social' => ['title' => self::typed('')],
      'robots' => [],
    ]));

    self::assertSame([], Values::decode(NULL));
    self::assertSame([], Values::decode(''));
    self::assertSame([], Values::decode('{"title":'));
    self::assertSame([], Values::decode('"text"'));
    self::assertSame([], Values::decode('7'));
  }

  /**
   * Custom JSON-LD fills the fixed names in one pass, and only those.
   */
  public function testFillFacts(): void {
    $values = ['title' => '{site}', 'site' => 'Example', 'url' => 'https://example.com/a'];
    self::assertSame('{site} | Example', Values::fillFacts('{title} | {site}', $values));
    self::assertSame('https://example.com/a?q={search_term_string}', Values::fillFacts('{url}?q={search_term_string}', $values));
    // A field name is literal text; a fixed name without a value is empty.
    self::assertSame('{field.field_byline} {Title} {a b} {} .', Values::fillFacts('{field.field_byline} {Title} {a b} {} {author}.', $values));
  }

  /**
   * Output text is normalized and cut in code points.
   */
  public function testPlain(): void {
    self::assertSame('Pricing plans', Values::plain("  Pricing \n\t plans\x07\u{202E}  ", 255));
    self::assertSame('ééé', Values::plain('ééééé', 3));
    self::assertSame('👨‍👩', Values::plain('👨‍👩 family', 3));
    self::assertSame('I <3 Canvas & more', Values::plain('I <3 Canvas & more', 255));
    self::assertSame('a&amp;b <b>', Values::plain('a&amp;b <b>', 255));
    self::assertSame('', Values::plain(" \n ", 255));
    self::assertSame('ab', Values::plain("a\u{0085}\x7Fb", 255));
  }

  /**
   * The shared fixture: the same cases run against model.ts.
   */
  #[DataProvider('providerTextCases')]
  public function testTexts(array $target, array $site, array $facts, array $links, string $separator, array $expect): void {
    $read = static fn (array $value): string => match (array_key_first($value)) {
      'text' => $value['text'],
      'fact' => $facts[$value['fact']] ?? '',
      'source' => $links[$value['source']['expression']] ?? '',
      default => '',
    };
    $text = static fn (array $value, string $form): string|array => isset($value['parts']) ? Values::compose($value['parts'], $read) : $read($value);
    $texts = Values::texts(Values::cascade($target, $site), $text, $separator, $site['title_end'] ?? NULL);
    foreach ($expect as $key => $expected) {
      self::assertSame($expected, $texts[$key], $key);
    }
  }

  /**
   * Data provider for testTexts().
   */
  public static function providerTextCases(): \Generator {
    $file = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/text-cases.json'), TRUE, 32, JSON_THROW_ON_ERROR);
    foreach ($file['cases'] as $case) {
      yield $case['name'] => [
        $case['target'] ?? [],
        $case['site'] ?? $file['site'],
        ($case['facts'] ?? []) + $file['facts'],
        $case['links'] ?? [],
        $case['separator'] ?? $file['separator'],
        $case['expect'],
      ];
    }
  }

  /**
   * The shared fixture's compositions: which words go with which field.
   */
  #[DataProvider('providerCompositions')]
  public function testCompose(array $parts, array $values, array $long, int $room, string $expect): void {
    $key = static fn (array $part): string => $part['fact'] ?? $part['source']['expression'];
    $read = static fn (array $part): string => $values[$key($part)] ?? '';
    $is_long = static fn (array $part): bool => in_array($key($part), $long, TRUE);
    self::assertSame($expect, Values::plain(implode('', Values::compose($parts, $read, $is_long, $room)), PHP_INT_MAX));
  }

  /**
   * Data provider for testCompose().
   */
  public static function providerCompositions(): \Generator {
    foreach (self::fixture()['compositions'] as $row) {
      yield $row['name'] => [$row['parts'], $row['values'], $row['long'] ?? [], $row['room'] ?? 0, $row['expect']];
    }
  }

  /**
   * The shared fixture's canonical forms of a composition.
   */
  #[DataProvider('providerCanon')]
  public function testCanon(array $parts, ?array $expect): void {
    self::assertSame($expect, Values::fold($parts));
    // A write stores the same.
    $accepts = static fn (): bool => TRUE;
    [$clean] = Values::clean(['description' => ['parts' => $parts]], 'template', $accepts);
    self::assertSame($expect, $clean['description'] ?? NULL);
  }

  /**
   * Data provider for testCanon().
   */
  public static function providerCanon(): \Generator {
    foreach (self::fixture()['canon'] as $row) {
      yield $row['name'] => [$row['parts'], $row['expect']];
    }
  }

  /**
   * The shared fixture's places that compose.
   */
  public function testComposes(): void {
    foreach (self::fixture()['composes'] as $row) {
      $prop = str_starts_with($row['path'], 'schema.props.') ? SchemaGraph::prop($row['type'], substr($row['path'], 13)) : NULL;
      self::assertSame($row['expect'], Values::composes($prop, $row['path'], $row['scope']), "{$row['type']} {$row['path']} {$row['scope']}");
    }
    self::assertTrue(Values::titleLike('schema.props.location_address_streetAddress'));
    self::assertFalse(Values::titleLike('social.description'));
    self::assertFalse(Values::titleLike('schema.props.description'));
  }

  /**
   * A composition is checked part by part, in a place that composes.
   */
  #[DataProvider('providerParts')]
  public function testParts(string $scope, array $input, array $errors, ?array $expected = NULL): void {
    [$clean, $refused] = Values::clean($input, $scope, self::accepts());
    self::assertSame($errors, $refused);
    if ($expected !== NULL) {
      self::assertSame($expected, $clean);
    }
  }

  /**
   * Data provider for testParts().
   */
  public static function providerParts(): \Generator {
    $parts = static fn (array ...$parts): array => ['parts' => $parts];
    $title = ['fact' => 'title'];
    $summary = ['source' => self::SUMMARY];
    $other = ['source' => ['expression' => 'ℹ︎␜entity:node:article␝field_other␞␟value', 'sourceType' => 'entity-field']];
    $here = 'This setting is not available here.';
    $invalid = 'This value is not valid.';
    $fact = 'Choose a value from the list.';
    $field = 'Choose a field from the list.';
    $composed = $parts($title, ['text' => ' – '], $summary);
    yield 'a composed title' => ['template', ['title' => $composed], [], ['title' => $composed]];
    yield 'typed text is stripped of controls, never trimmed between fields' => [
      'template',
      ['description' => $parts(['text' => " \u{202E}Tickets:\u{0007} "], $title, ['text' => '  '], $summary, ['text' => ' '])],
      [],
      ['description' => $parts(['text' => 'Tickets: '], $title, ['text' => '  '], $summary)],
    ];
    $x = ['text' => ' x'];
    yield 'a page' => ['page', ['title' => $parts($title, $x)], ['title' => $here]];
    yield 'the title ending' => ['template', ['title_end' => $parts(['fact' => 'site'], $x)], ['title_end' => $here]];
    yield 'the site' => ['site', ['title_end' => $parts(['fact' => 'site'], $x)], ['title_end' => $here]];
    yield 'nine fields' => [
      'template',
      ['description' => $parts(...array_fill(0, 9, $title))],
      ['description' => 'Use at most 8 fields in one value.'],
    ];
    yield 'eight fields' => ['template', ['description' => $parts(...array_fill(0, 8, $title))], []];
    $image = $parts($title, ['fact' => 'image']);
    yield 'an image in a composition' => ['template', ['title' => $image], ['title' => $fact]];
    $address = $parts($title, ['fact' => 'url']);
    yield 'a page address in a composition' => ['template', ['description' => $address], ['description' => $fact]];
    $offered = $parts($title, ['text' => ' '], $other);
    yield 'a field the menu does not offer' => ['template', ['title' => $offered], ['title' => $field]];
    yield 'long text in a title' => [
      'template',
      ['title' => $parts($title, ['text' => ' – '], ['fact' => 'description'])],
      ['title' => $field],
    ];
    yield 'long text in a description' => [
      'template',
      ['description' => $parts(['fact' => 'description'], ['text' => ' Free delivery.'])],
      [],
    ];
    yield 'a media item as a part' => [
      'template',
      ['description' => $parts($title, ['media' => '6f1c2a0e-5b7d-4c1e-9a53-0d6f7c1b2e44'])],
      ['description' => $invalid],
    ];
    $nested = $parts($title, $parts($title));
    yield 'a nested composition' => ['template', ['description' => $nested], ['description' => $invalid]];
    yield 'a part with two keys' => [
      'template',
      ['description' => $parts(['text' => 'a', 'fact' => 'title'])],
      ['description' => $invalid],
    ];
    yield 'no parts' => ['template', ['description' => ['parts' => []]], ['description' => $invalid]];
    $event = static fn (string $key, array $value): array => [
      'schema' => ['type' => 'Event', 'props' => [$key => $value]],
    ];
    yield 'a date detail' => ['template', $event('startDate', $parts($title, $x)), ['schema.props.startDate' => $here]];
    yield 'a postal code' => [
      'template',
      $event('location_address_postalCode', $parts($title, $x)),
      ['schema.props.location_address_postalCode' => $here],
    ];
    $name = $parts($title, ['text' => ' · '], ['fact' => 'published']);
    yield 'a composed name' => ['template', $event('name', $name), []];
    yield 'typed text counts against the length' => [
      'template',
      ['title' => $parts($title, ['text' => str_repeat('a', 256)])],
      ['title' => 'Use at most 255 characters.'],
    ];
    yield 'one field and a space is that link' => [
      'template',
      ['description' => $parts($summary, ['text' => ' '])],
      [],
      ['description' => $summary],
    ];
    yield 'text alone is typed text' => [
      'template',
      ['title' => $parts(['text' => 'Plans '], ['text' => '{site}'])],
      [],
      ['title' => ['text' => 'Plans {site}']],
    ];
    // A detail only a field may give takes no typed text, also as parts.
    yield 'typed text where only a field gives the value' => [
      'template',
      ['schema' => ['type' => 'JobPosting', 'props' => ['description' => $parts(['text' => 'Typed'])]]],
      ['schema.props.description' => $here],
    ];
  }

  /**
   * Every value shape stored before compositions comes back byte for byte.
   */
  public function testShapesUnchanged(): void {
    $values = [
      'description' => ['source' => self::SUMMARY],
      'robots' => ['noindex' => TRUE],
      'schema' => [
        'props' => [
          'eventStatus' => ['text' => 'EventScheduled'],
          'image' => ['media' => '6f1c2a0e-5b7d-4c1e-9a53-0d6f7c1b2e44'],
          'name' => ['fact' => 'title'],
        ],
        'type' => 'Event',
      ],
      'social' => ['image' => ['source' => self::HERO], 'title' => ['text' => ' Spaces kept ']],
      'title' => ['text' => 'Plans {for teams} {site}'],
      'title_end' => ['text' => ''],
    ];
    self::assertSame(json_encode($values), json_encode(Values::clean($values, 'template', NULL)[0]));
    self::assertSame(json_encode($values), json_encode(Values::clean($values, 'template', self::accepts())[0]));
  }

  /**
   * A text cut to a room ends at a whole sentence, else at a word.
   */
  public function testSentences(): void {
    self::assertSame('One. Two.', Values::sentences('One. Two. Three is long.', 12));
    self::assertSame('Short.', Values::sentences('Short.', 70));
    self::assertSame('alpha beta…', Values::sentences('alpha beta gamma delta', 13));
  }

  /**
   * The shared fixture file.
   */
  private static function fixture(): array {
    return json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/text-cases.json'), TRUE, 64, JSON_THROW_ON_ERROR);
  }

  /**
   * Only the title ending and the robots directives come from the site layer.
   */
  public function testCascade(): void {
    $site = [
      'title_end' => self::typed('Example Co'),
      'title' => self::typed('Ignored'),
      'description' => self::typed('Ignored'),
      'social' => ['title' => self::typed('Ignored')],
      'schema' => ['type' => 'Article'],
      'robots' => ['noindex' => TRUE, 'max_image_preview' => 'large'],
    ];
    self::assertSame([
      'title_end' => self::typed('Example Co'),
      'robots' => ['noindex' => TRUE, 'max_image_preview' => 'large'],
    ], Values::cascade([], $site));
    self::assertSame([
      'title' => self::typed('Own'),
      'title_end' => self::typed(''),
      'robots' => ['noindex' => FALSE, 'max_snippet' => -1, 'max_image_preview' => 'large'],
      'canonical' => '/a',
    ], Values::cascade([
      'title' => self::typed('Own'),
      'title_end' => self::typed(''),
      'robots' => ['noindex' => FALSE, 'max_snippet' => -1],
      'canonical' => '/a',
    ], $site));
    self::assertSame([], Values::cascade([], []));
  }

  /**
   * Formatted text reads as sentences, and only as text.
   */
  public function testFromHtml(): void {
    self::assertSame('Made to last. Solid oak. Dimmable. Fabric cable, 3 m.', Values::fromHtml('<h2>Made to last</h2><p>Solid oak.</p><ul><li>Dimmable</li><li>Fabric cable, 3 m.</li></ul>'));
    self::assertSame('Ask us', Values::fromHtml('<p>Ask us</p><script>alert(1)</script><style>p{color:red}</style>'));
    self::assertSame('One Two & three', Values::fromHtml('<p>One</p><p>Two &amp; <b>three</b></p>'));
    self::assertSame('', Values::fromHtml("\xC3\x28"));
  }

  /**
   * Cleans one schema value of a type on a scope, with any source accepted.
   *
   * @return array{0: ?array, 1: ?string}
   *   The clean value, and the error at its path.
   */
  private static function one(string $type, string $key, array $value, string $scope = 'page'): array {
    [$clean, $errors] = Values::clean(['schema' => ['type' => $type, 'props' => [$key => $value]]], $scope, static fn (): bool => TRUE);
    return [$clean['schema']['props'][$key] ?? NULL, $errors["schema.props.$key"] ?? NULL];
  }

  /**
   * A typed value on a list: several codes, or one url, image or reference.
   */
  public function testTypedListOnlyOnEnumListAndOneOnUrlImageRef(): void {
    self::assertSame([['text' => 'FI,SE,EE'], NULL], self::one('JobPosting', 'applicantLocationRequirements', self::typed('FI,SE,EE'), 'template'));
    self::assertSame('Choose one of the listed options.', self::one('JobPosting', 'applicantLocationRequirements', self::typed('FI,Sweden'), 'template')[1]);
    self::assertSame([['text' => 'https://social.example.com/ada'], NULL], self::one('ProfilePage', 'sameAs', self::typed('https://social.example.com/ada')));
    self::assertSame('Enter a full address that starts with https://.', self::one('ProfilePage', 'sameAs', self::typed('https://a.example.com/ https://b.example.com/'))[1]);
    self::assertSame([['media' => self::UUID], NULL], self::one('Product', 'image', ['media' => self::UUID]));
    self::assertSame([['fact' => 'identity'], NULL], self::one('Article', 'author', ['fact' => 'identity']));
  }

  /**
   * A list of text and a linked-only detail refuse typed text.
   */
  public function testTextListAndLinkOnlyRefuseTypedValues(): void {
    self::assertSame([NULL, 'This comes from a field or a component.'], self::one('Recipe', 'recipeIngredient', self::typed('1 tsp salt'), 'template'));
    self::assertSame([NULL, 'This comes from a field or a component.'], self::one('JobPosting', 'description', self::typed('<p>Build things.</p>'), 'template'));
    // Linked, both are kept.
    self::assertSame([['source' => self::SUMMARY], NULL], self::one('Recipe', 'recipeIngredient', ['source' => self::SUMMARY], 'template'));
    self::assertSame([['source' => self::SUMMARY], NULL], self::one('JobPosting', 'description', ['source' => self::SUMMARY], 'template'));
  }

  /**
   * What a scope does not offer is refused, and says why.
   */
  public function testNotOfferedOnScopeRefused(): void {
    self::assertSame([NULL, 'This comes from a field or a component.'], self::one('Recipe', 'recipeIngredient', self::typed('1 tsp salt')));
    self::assertSame([NULL, 'This comes from a field or a component.'], self::one('Event', 'performer', ['fact' => 'identity']));
    [$clean, $errors] = Values::clean(['schema' => ['type' => 'JobPosting']], 'page', self::accepts());
    self::assertSame([[], ['schema.type' => 'Choose one of the listed page types.']], [$clean, $errors]);
    self::assertSame([['schema' => ['type' => 'JobPosting']], []], Values::clean(['schema' => ['type' => 'JobPosting']], 'template', self::accepts()));
    // What each page has of its own is linked on a template, never typed
    // once for every page.
    self::assertSame([NULL, 'This comes from a field or a component.'], self::one('JobPosting', 'validThrough', self::typed('2027-01-31'), 'template'));
    $link = ['source' => ['expression' => 'ℹ︎␜entity:node:job␝field_closes␞␟value', 'sourceType' => 'entity-field']];
    self::assertSame([$link, NULL], self::one('JobPosting', 'validThrough', $link, 'template'));
  }

  /**
   * Someone else, not named yet, is kept on a Canvas page only.
   *
   * There it stops the site from being the organizer by default; elsewhere
   * it is nothing.
   */
  public function testSomeoneElseNotNamedYet(): void {
    self::assertSame([['text' => ''], NULL], self::one('Event', 'organizer', self::typed('')));
    self::assertSame([NULL, NULL], self::one('Event', 'organizer', self::typed(''), 'template'));
    self::assertSame([NULL, NULL], self::one('Event', 'organizer_name', self::typed('')));
  }

  /**
   * The publisher only where it may be one; a page pick not yet.
   *
   * Nothing in the dialog picks a page until the page picker ships
   * (link-groups-and-pick-pages): a `{node}` value is refused.
   */
  public function testIdentityFactOnlyOnRefAndNoPagePickYet(): void {
    self::assertSame('Choose a value from the list.', self::one('Event', 'name', ['fact' => 'identity'], 'template')[1]);
    self::assertSame('Choose a value from the list.', self::one('Event', 'location', ['fact' => 'identity'])[1]);
    self::assertSame([['fact' => 'identity'], NULL], self::one('Event', 'organizer', ['fact' => 'identity']));
    self::assertSame([NULL, 'This value is not valid.'], self::one('Event', 'location', ['node' => self::UUID]));
  }

  /**
   * Opening hours are one valid week.
   */
  public function testHoursLiteralValidation(): void {
    self::assertSame([['text' => 'Mo-Fr 09:00-17:00; 2026-12-24 closed'], NULL], self::one('LocalBusiness', 'openingHoursSpecification', self::typed('Mo-Fr 09:00-17:00; 2026-12-24 closed')));
    foreach (['Mo 09:00-13:00,12:00-17:00', 'Monday 9-5', 'Mo 17:00-09:00'] as $refused) {
      self::assertSame([NULL, 'Check the opening hours: times are in order and do not overlap.'], self::one('LocalBusiness', 'openingHoursSpecification', self::typed($refused)), $refused);
    }
  }

  /**
   * A duration is a whole number of its unit, never zero.
   */
  public function testDurationIntegerRange(): void {
    self::assertSame([['text' => '90'], NULL], self::one('Recipe', 'prepTime', self::typed('90')));
    foreach (['0', '1.5', '-5', 'an hour'] as $refused) {
      self::assertSame([NULL, 'Enter a whole number, or leave it empty if you do not know it.'], self::one('Recipe', 'prepTime', self::typed($refused)), $refused);
    }
    // One limit everywhere: 30 days, as the graph emits and the dialog
    // allows (controls.ts durationValue()).
    self::assertSame([['text' => '43200'], NULL], self::one('Recipe', 'prepTime', self::typed('43200')));
    foreach (['43201', '50000', '100000'] as $refused) {
      self::assertSame([NULL, 'Use at most 30 days.'], self::one('Recipe', 'prepTime', self::typed($refused)), $refused);
    }
  }

  /**
   * A country stored as text before countries were codes is kept when read.
   *
   * The graph then reports it as dropped, and the dialog shows it, instead
   * of losing it without a word; a save asks for a code.
   */
  public function testCountryTextKeptWhenRead(): void {
    $props = ['location_address_addressCountry' => ['text' => 'Finland']];
    // Read mode: no field checker.
    [$read] = Values::clean(['schema' => ['type' => 'Event', 'props' => $props]], 'page', NULL);
    self::assertSame(['text' => 'Finland'], $read['schema']['props']['location_address_addressCountry']);
    self::assertSame([NULL, 'Choose one of the listed options.'], self::one('Event', 'location_address_addressCountry', self::typed('Finland')));
  }

  /**
   * A unit is kept beside a linked duration's field, and nowhere else.
   */
  public function testDurationUnitBesideSourceOnly(): void {
    self::assertSame([['source' => self::SUMMARY, 'unit' => 'hour'], NULL], self::one('Recipe', 'cookTime', [
      'source' => self::SUMMARY,
      'unit' => 'hour',
    ], 'template'));
    self::assertSame([NULL, 'This value is not valid.'], self::one('Recipe', 'cookTime', [
      'text' => '20',
      'unit' => 'hour',
    ], 'template'));
    self::assertSame([NULL, 'This value is not valid.'], self::one('Recipe', 'cookTime', [
      'source' => self::SUMMARY,
      'unit' => 'day',
    ], 'template'));
    self::assertSame([NULL, 'This value is not valid.'], self::one('Recipe', 'recipeYield', [
      'source' => self::SUMMARY,
      'unit' => 'hour',
    ], 'template'));
  }

}
