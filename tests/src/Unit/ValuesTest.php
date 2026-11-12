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

  private const TOKENS = [
    'title' => 'text',
    'site' => 'text',
    'sep' => 'text',
    'published' => 'datetime',
    'image' => 'image',
    'field.field_summary' => 'text',
    'field.field_hero' => 'image',
  ];

  /**
   * Every rule refuses what it must, at the path the dialog shows it on.
   */
  #[DataProvider('providerRefused')]
  public function testRefused(string $scope, array $input, string $path, ?string $message = NULL, bool $readKeeps = FALSE): void {
    $errors = Values::clean($input, $scope, self::TOKENS)[1];
    self::assertSame([$path], array_keys($errors));
    if ($message !== NULL) {
      self::assertSame($message, $errors[$path]);
    }
    // Read mode drops the offending key instead of failing. It keeps a text
    // that was too long (cut) and a token it cannot check.
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
    $shape = 'Use one object, or a list of up to 10 objects, each with "@type".';
    $id = 'An "@id" must be a full address, or a name that starts with #.';

    // Shape and scope.
    yield 'unknown key' => ['page', ['keywords' => 'a, b'], 'keywords'];
    yield 'site description' => ['site', ['description' => 'Text'], 'description'];
    yield 'page description' => ['page', ['description' => 'Text'], 'description'];
    yield 'template canonical' => ['template', ['canonical' => '/a'], 'canonical'];
    yield 'site social' => ['site', ['social' => ['title' => 'A']], 'social'];
    yield 'site schema' => ['site', ['schema' => ['type' => 'Article']], 'schema'];
    yield 'unknown social key' => ['page', ['social' => ['card' => 'x']], 'social.card'];
    yield 'unknown robots key' => ['page', ['robots' => ['noarchive' => TRUE]], 'robots.noarchive'];
    yield 'unknown schema key' => ['page', ['schema' => ['context' => 'x']], 'schema.context'];
    yield 'map expected' => ['page', ['robots' => 'noindex'], 'robots'];

    // Templates.
    yield 'title not a string' => ['page', ['title' => ['a']], 'title'];
    yield 'title too long' => ['page', ['title' => str_repeat('é', 256)], 'title', 'Use at most 255 characters.', TRUE];
    yield 'social title too long' => [
      'page',
      ['social' => ['title' => str_repeat('a', 256)]],
      'social.title',
      'Use at most 255 characters.',
      TRUE,
    ];
    yield 'description too long' => [
      'template',
      ['description' => str_repeat('a', 1001)],
      'description',
      'Use at most 1000 characters.',
      TRUE,
    ];
    yield 'social description too long' => [
      'page',
      ['social' => ['description' => str_repeat('a', 1001)]],
      'social.description',
      'Use at most 1000 characters.',
      TRUE,
    ];
    yield 'unknown token' => [
      'page',
      ['title' => '{title} {nope}'],
      'title',
      '"{nope}" is not a value SEO knows. Choose one from the list.',
      TRUE,
    ];
    yield 'image token in text' => [
      'template',
      ['description' => 'See {field.field_hero}'],
      'description',
      '"{field.field_hero}" is an image and can\'t be used in text.',
      TRUE,
    ];

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
    yield 'image not a UUID' => ['page', ['social' => ['image' => 'pricing.jpg']], 'social.image', $image];
    yield 'image text token' => ['page', ['social' => ['image' => '{title}']], 'social.image', $image, TRUE];
    yield 'image two tokens' => ['page', ['social' => ['image' => '{image}{image}']], 'social.image', $image];
    yield 'image token with text' => ['page', ['social' => ['image' => '{image} x']], 'social.image', $image];

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
    yield 'schema type' => [
      'page',
      ['schema' => ['type' => 'Recipe']],
      'schema.type',
      'Choose one of the listed page types.',
    ];
    yield 'prop of another type' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['offers_price' => '5']]],
      'schema.props.offers_price',
    ];
    yield 'prop without a type' => ['page', ['schema' => ['props' => ['headline' => 'A']]], 'schema.props.headline'];
    yield 'prop of the inherited type, named over' => [
      'page',
      ['schema' => ['type' => 'WebPage', 'props' => ['offers_price' => '5']]],
      'schema.props.offers_price',
    ];
    yield 'prop url' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['author_url' => '/me']]],
      'schema.props.author_url',
      'Enter a full address that starts with https://.',
    ];
    yield 'prop date' => [
      'page',
      ['schema' => ['type' => 'Event', 'props' => ['startDate' => 'tomorrow']]],
      'schema.props.startDate',
      'Choose a date.',
    ];
    yield 'prop number' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['offers_price' => '49,90']]],
      'schema.props.offers_price',
      'Enter a number, like 49 or 49.90.',
    ];
    yield 'prop currency' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['offers_priceCurrency' => 'euro']]],
      'schema.props.offers_priceCurrency',
      'Enter a three-letter currency code, like EUR.',
    ];
    yield 'prop pattern' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['sku' => 'A 1']]],
      'schema.props.sku',
      'This value has characters that are not allowed here.',
    ];
    yield 'prop enum' => [
      'page',
      ['schema' => ['type' => 'Product', 'props' => ['offers_availability' => 'Maybe']]],
      'schema.props.offers_availability',
      'Choose one of the listed options.',
    ];
    yield 'prop image' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['image' => '{title}']]],
      'schema.props.image',
      $image,
      TRUE,
    ];
    yield 'prop too long' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['headline' => str_repeat('a', 2001)]]],
      'schema.props.headline',
      'Use at most 2000 characters.',
      TRUE,
    ];
    yield 'prop unknown token' => [
      'page',
      ['schema' => ['type' => 'Article', 'props' => ['headline' => '{nope}']]],
      'schema.props.headline',
      NULL,
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
    foreach (['javascript:alert(5)', ' JavaScript :x', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd'] as $url) {
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
    self::assertSame([$expected ?? $input, []], Values::clean($input, $scope, self::TOKENS));
  }

  /**
   * Data provider for testAccepted().
   */
  public static function providerAccepted(): \Generator {
    yield 'text is stored as typed' => ['page', ['title' => 'I <3 Canvas & more ']];
    yield 'format characters survive' => ['template', ['title' => "Team 👨‍👩 \u{200C}\u{200F}"]];
    yield 'brace text outside the grammar' => ['page', ['title' => '{Title} {a b} {} { title }']];
    yield 'tokens' => ['template', ['description' => '{field.field_summary}', 'title' => '{title} {sep} {site}']];
    yield 'control and bidi characters are removed' => [
      'page',
      ['title' => "Pri\x07cing\u{202E}\u{2066}\u{0085}\tplans\n"],
      ['title' => "Pricing\tplans\n"],
    ];
    yield 'empty values are pruned' => [
      'page',
      [
        'title' => " \n",
        'canonical' => '',
        'social' => ['image' => '', 'title' => ''],
        'robots' => [],
        'schema' => ['props' => [], 'custom' => ' '],
      ],
      [],
    ];
    yield 'canonical path' => ['page', ['canonical' => '/pricing?plan=team']];
    yield 'canonical path with every allowed character' => ['page', ['canonical' => "/a-._~!$&'()*+,;=:@%20/b?c=d"]];
    yield 'canonical path with non-ASCII letters' => ['page', ['canonical' => '/hinnasto/päivä']];
    yield 'canonical URL' => ['page', ['canonical' => 'https://www.example.com/pricing']];
    yield 'image UUID' => ['page', ['social' => ['image' => self::UUID]]];
    yield 'image token' => ['page', ['social' => ['image' => '{image}']]];
    yield 'image field token' => ['template', ['social' => ['image' => '{field.field_hero}']]];
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
          'name' => 'Desk',
          'offers_price' => '49.90',
          'offers_priceCurrency' => 'EUR',
          'offers_availability' => 'InStock',
          'image' => self::UUID,
        ],
      ],
    ], [
      'schema' => [
        'props' => [
          'image' => self::UUID,
          'name' => 'Desk',
          'offers_availability' => 'InStock',
          'offers_price' => '49.90',
          'offers_priceCurrency' => 'EUR',
        ],
        'type' => 'Product',
      ],
    ],
    ];
    yield 'a prop with a token is checked at resolve time' => [
      'template',
      ['schema' => ['props' => ['startDate' => '{field.field_summary}'], 'type' => 'Event']],
    ];
    yield 'extended type has the props of its parent' => [
      'page',
      ['schema' => ['props' => ['headline' => 'A'], 'type' => 'BlogPosting']],
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
   * A translation's details belong to the type it inherits.
   */
  public function testInheritedType(): void {
    $props = ['schema' => ['props' => ['name' => 'Widget', 'offers_price' => '49']]];
    self::assertSame([$props, []], Values::clean($props, 'page', self::TOKENS, 'Product'));
    self::assertSame([[], []], Values::clean([], 'page', self::TOKENS, 'Product'));
    // Read mode keeps them, as the resolver reads a translation.
    self::assertSame($props, Values::clean($props, 'page', NULL, 'Product')[0]);
    // Without the inherited type they are not available.
    self::assertSame(['schema.props.name', 'schema.props.offers_price'], array_keys(Values::clean($props, 'page', self::TOKENS)[1]));
    // A type named in the values wins over the inherited one.
    self::assertSame(['schema.props.name', 'schema.props.offers_price'], array_keys(Values::clean(['schema' => ['type' => 'Article'] + $props['schema']], 'page', self::TOKENS, 'Product')[1]));
    // An inherited type the registry does not know is WebPage.
    self::assertSame(['schema.props.name', 'schema.props.offers_price'], array_keys(Values::clean($props, 'page', self::TOKENS, 'Recipe')[1]));
  }

  /**
   * Read mode cuts, drops and keeps what write mode refuses.
   */
  public function testReadMode(): void {
    [$clean, $errors] = Values::clean([
      'title' => str_repeat('é', 300),
      'description' => 'not allowed on a page',
      'canonical' => 'javascript:alert(1)',
      'social' => ['title' => '{title} {field.gone}', 'image' => '{field.gone}', 'card' => 'x'],
      'robots' => ['noindex' => TRUE, 'max_snippet' => 5000],
      'schema' => [
        'type' => 'Article',
        'props' => ['headline' => '{field.gone}', 'author_url' => 'nope'],
        'custom' => '<script>',
      ],
    ], 'page', NULL);
    self::assertSame([
      'robots' => ['noindex' => TRUE],
      'schema' => ['props' => ['headline' => '{field.gone}'], 'type' => 'Article'],
      // A token that no longer exists is kept, and blanked when filled.
      'social' => ['image' => '{field.gone}', 'title' => '{title} {field.gone}'],
      'title' => str_repeat('é', 255),
    ], $clean);
    self::assertNotEmpty($errors);
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
      ['kind' => 'organization', 'name' => '', 'separator' => '|', 'logo' => '', 'default_image' => '', 'same_as' => []],
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
      'title' => 'Pricing {sep} {site}',
      'social' => ['image' => self::UUID],
      'schema' => ['type' => 'Article', 'props' => ['headline' => 'Plans and prices']],
      'robots' => ['max_snippet' => 160],
      'canonical' => '/pricing',
    ];
    $b = [
      'canonical' => '/pricing',
      'robots' => ['max_snippet' => 160, 'nofollow' => NULL],
      'schema' => ['props' => ['headline' => 'Plans and prices'], 'type' => 'Article', 'custom' => ''],
      'social' => ['image' => self::UUID, 'title' => '  '],
      'title' => 'Pricing {sep} {site}',
      'description' => '',
    ];
    $expected = '{"canonical":"/pricing","robots":{"max_snippet":160},"schema":{"props":{"headline":"Plans and prices"},"type":"Article"},"social":{"image":"' . self::UUID . '"},"title":"Pricing {sep} {site}"}';
    self::assertSame($expected, Values::encode($a));
    self::assertSame($expected, Values::encode($b));
    self::assertSame($expected, Values::encode(Values::decode($expected)));
    self::assertSame('{"robots":{"noindex":false},"title":"Ünïcode / ✓"}', Values::encode([
      'title' => 'Ünïcode / ✓',
      'robots' => ['noindex' => FALSE],
    ]));

    self::assertNull(Values::encode([]));
    self::assertNull(Values::encode(['title' => ' ', 'social' => ['title' => ''], 'robots' => []]));

    self::assertSame([], Values::decode(NULL));
    self::assertSame([], Values::decode(''));
    self::assertSame([], Values::decode('{"title":'));
    self::assertSame([], Values::decode('"text"'));
    self::assertSame([], Values::decode('7'));
  }

  /**
   * Tokens are replaced in one pass.
   */
  public function testFill(): void {
    $values = ['title' => '{site}', 'site' => 'Example', 'field.field_summary' => 'Summary'];
    self::assertSame('{site} | Example', Values::fill('{title} | {site}', $values));
    self::assertSame('Summary  end', Values::fill('{field.field_summary} {field.gone} end', $values));
    self::assertSame('/s?q={search_term_string}&site=Example', Values::fill('/s?q={search_term_string}&site={site}', $values, TRUE));
    self::assertSame('{Title} {a b} {} { title } {a.b.c}', Values::fill('{Title} {a b} {} { title } {a.b.c}', $values));
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
  public function testTexts(array $target, array $site, array $tokens, array $expect): void {
    $texts = Values::texts(Values::cascade($target, $site), $tokens);
    foreach ($expect as $key => $text) {
      self::assertSame($text, $texts[$key], $key);
    }
  }

  /**
   * Data provider for testTexts().
   */
  public static function providerTextCases(): \Generator {
    $file = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/text-cases.json'), TRUE, 16, JSON_THROW_ON_ERROR);
    foreach ($file['cases'] as $case) {
      yield $case['name'] => [
        $case['target'] ?? [],
        $case['site'] ?? $file['site'],
        ($case['tokens'] ?? []) + $file['tokens'],
        $case['expect'],
      ];
    }
  }

  /**
   * Separators that separate nothing go, wherever they are.
   */
  public function testSeparators(): void {
    $title = static fn (string $template, array $tokens = []): string => Values::texts(['title' => $template], $tokens + ['sep' => '|'])['title'];
    self::assertSame('Example', $title('{a} {sep} {b} {sep} Example'));
    self::assertSame('Pricing', $title('Pricing {sep} {a} {sep} {b}'));
    self::assertSame('A | B', $title('{sep} A {sep} {sep} {sep} B {sep}'));
    self::assertSame('A|B | C', $title('A|B {sep} C'));
    self::assertSame('A | B', $title('A | B', ['sep' => '']));
  }

  /**
   * Only the title and the robots directives come from the site layer.
   */
  public function testCascade(): void {
    $site = [
      'title' => '{title} {sep} {site}',
      'description' => 'Ignored',
      'social' => ['title' => 'Ignored'],
      'schema' => ['type' => 'Article'],
      'robots' => ['noindex' => TRUE, 'max_image_preview' => 'large'],
    ];
    self::assertSame([
      'title' => '{title} {sep} {site}',
      'robots' => ['noindex' => TRUE, 'max_image_preview' => 'large'],
    ], Values::cascade([], $site));
    self::assertSame([
      'title' => 'Own',
      'robots' => ['noindex' => FALSE, 'max_snippet' => -1, 'max_image_preview' => 'large'],
      'canonical' => '/a',
    ], Values::cascade(['title' => 'Own', 'robots' => ['noindex' => FALSE, 'max_snippet' => -1], 'canonical' => '/a'], $site));
    self::assertSame([], Values::cascade([], []));
  }

}
