<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\Values;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

// cspell:ignore cing Ünïcode ééééé hinnasto päivä
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
    return static fn (array $source, string $kind): bool => ($source === self::SUMMARY && $kind === 'text') || ($source === self::HERO && $kind === 'image');
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
    $shape = 'Use one object, or a list of up to 10 objects, each with "@type".';
    $id = 'An "@id" must be a full address, or a name that starts with #.';
    $t = self::typed(...);

    // Shape and scope.
    yield 'unknown key' => ['page', ['keywords' => $t('a, b')], 'keywords'];
    yield 'site description' => ['site', ['description' => $t('Text')], 'description', $here];
    yield 'site main part' => ['site', ['title' => $t('Text')], 'title', $here];
    yield 'page description' => ['page', ['description' => $t('Text')], 'description'];
    yield 'template canonical' => ['template', ['canonical' => '/a'], 'canonical'];
    yield 'site social' => ['site', ['social' => ['title' => $t('A')]], 'social'];
    yield 'site schema' => ['site', ['schema' => ['type' => 'Article']], 'schema'];
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
    yield 'a date in text' => ['template', ['description' => ['fact' => 'published']], 'description', $list];
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
      ['schema' => ['type' => 'Recipe']],
      'schema.type',
      'Choose one of the listed page types.',
      TRUE,
    ];
    yield 'schema type that is not a name' => [
      'page',
      ['schema' => ['type' => 'Recipe<script>']],
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

    // Custom JSON-LD.
    yield 'custom not JSON' => [
      'page',
      ['schema' => ['custom' => '{"@type": ']],
      'schema.custom',
      'This is not valid JSON.',
    ];
    yield 'custom scalar' => ['page', ['schema' => ['custom' => '"FAQPage"']], 'schema.custom', $shape];
    yield 'custom without @type' => ['page', ['schema' => ['custom' => '{"name": "A"}']], 'schema.custom', $shape];
    yield 'custom @type list' => ['page', ['schema' => ['custom' => '{"@type": ["A", "B"]}']], 'schema.custom', $shape];
    yield 'custom list of scalars' => ['page', ['schema' => ['custom' => '["FAQPage"]']], 'schema.custom', $shape];
    yield 'custom eleven nodes' => [
      'page',
      ['schema' => ['custom' => '[' . implode(',', array_fill(0, 11, '{"@type": "Thing"}')) . ']']],
      'schema.custom',
      $shape,
    ];
    yield 'custom null value' => [
      'page',
      ['schema' => ['custom' => '{"@type": "Thing", "name": null}']],
      'schema.custom',
      $shape,
    ];
    yield 'custom too deep' => [
      'page',
      ['schema' => ['custom' => '{"@type": "Thing", "a": ' . str_repeat('{"b": ', 8) . '1' . str_repeat('}', 8) . '}']],
      'schema.custom',
      $shape,
    ];
    yield 'custom @context' => [
      'page',
      ['schema' => ['custom' => '{"@context": "https://example.com", "@type": "Thing"}']],
      'schema.custom',
      'Only "@type" and "@id" may start with @.',
    ];
    yield 'custom nested @graph' => [
      'page',
      ['schema' => ['custom' => '{"@type": "Thing", "about": {"@graph": []}}']],
      'schema.custom',
      'Only "@type" and "@id" may start with @.',
    ];
    yield 'custom relative @id' => [
      'page',
      ['schema' => ['custom' => '{"@type": "Thing", "@id": "/thing"}']],
      'schema.custom',
      $id,
    ];
    yield 'custom nested @id' => [
      'page',
      ['schema' => ['custom' => '{"@type": "Thing", "about": {"@id": "javascript:alert(1)"}}']],
      'schema.custom',
      $id,
    ];
    foreach ([
      'javascript:alert(5)',
      ' JavaScript :x',
      'data:text/html,x',
      'vbscript:x',
      'file:///etc/passwd',
    ] as $url) {
      yield 'custom script address ' . $url => [
        'page',
        ['schema' => ['custom' => (string) json_encode(['@type' => 'Thing', 'about' => ['sameAs' => [$url]]])]],
        'schema.custom',
        'Addresses must start with https:// or http://.',
      ];
    }
    yield 'custom too large' => [
      'page',
      ['schema' => ['custom' => '{"@type": "Thing", "name": "' . str_repeat('a', 32768) . '"}']],
      'schema.custom',
      'Custom JSON-LD is too large. Keep it under 32 KB.',
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
    $stored = '{"@id":"#faq","@type":"FAQPage","empty":{},"list":[],"name":"Q&A <b>",'
      . '"potentialAction":{"urlTemplate":"/s?q={search_term_string}"},"url":"https://example.com/a"}';
    yield 'custom is re-encoded' => ['page', ['schema' => ['custom' => $typed]], ['schema' => ['custom' => $stored]]];
    yield 'custom list with an absolute @id' => [
      'page',
      ['schema' => ['custom' => '[{"@type":"Thing","@id":"https://example.com/#thing","about":{"@id":"#primary"}}]']],
      ['schema' => ['custom' => '[{"@id":"https://example.com/#thing","@type":"Thing","about":{"@id":"#primary"}}]']],
    ];
    yield 'custom at the depth limit' => [
      'page',
      ['schema' => ['custom' => '{"@type":"Thing","a":' . str_repeat('{"b":', 7) . '1' . str_repeat('}', 7) . '}']],
    ];
    yield 'custom empty list is nothing' => ['page', ['schema' => ['custom' => '[]']], []];
    yield 'custom text that only mentions a scheme' => [
      'page',
      ['schema' => ['custom' => '{"@type":"Thing","name":"Learn javascript: the basics"}']],
    ];
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
    self::assertSame(['schema' => ['type' => 'Recipe']], Values::clean([
      'schema' => [
        'type' => 'Recipe',
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
    ], array_keys(Values::clean($props, 'page', self::accepts(), 'Recipe')[1]));
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
    $text = static fn (array $value): string => match (array_key_first($value)) {
      'text' => $value['text'],
      'fact' => $facts[$value['fact']] ?? '',
      'source' => $links[$value['source']['expression']] ?? '',
      default => '',
    };
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

}
