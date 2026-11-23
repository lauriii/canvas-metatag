<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_headless\Grant\PreviewAssertionGrant;
use Drupal\canvas_headless\PreviewAssertionFactory;
use Drupal\canvas_metatag\Controller\ApiController;
use Drupal\canvas_metatag\Hook\CanvasMetatagHooks;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Sources;
use Drupal\consumers\Entity\Consumer;
use Drupal\Core\Cache\CacheableJsonResponse;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\Session\AccountProxyInterface;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\Core\Session\PermissionCheckerInterface;
use Drupal\field\Entity\FieldConfig;
use Drupal\file\FileInterface;
use Drupal\media\MediaInterface;
use Drupal\node\Entity\Node;
use Drupal\node\NodeInterface;
use Drupal\simple_oauth\Authentication\TokenAuthUser;
use Drupal\simple_oauth\Entity\Oauth2Token;
use Drupal\taxonomy\TermInterface;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\AutoSaveRequestTestTrait;
use Drupal\Tests\canvas_metatag\Fixture\ComplexContent;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Bridge\PsrHttpMessage\HttpMessageFactoryInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Response;

// cspell:ignore Ruisleipä Kallio Martín Leinonen shakshuka
// cspell:ignore صورة عمر حداد ملحن مصباح مكتب
/**
 * Template SEO with complex content: many types, fields, references, drafts.
 *
 * Every expectation is the current specs' (dynamic-values, head-output,
 * structured-data, template-seo, headless-head), on the complex fixture.
 * The scenario matrix of that fixture names each case.
 *
 * @see \Drupal\Tests\canvas_metatag\Fixture\ComplexContent
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Resolver::class)]
#[CoversClass(CanvasMetatagHooks::class)]
#[CoversClass(ApiController::class)]
#[Group('canvas_metatag')]
final class ComplexTemplateTest extends CanvasKernelTestBase {

  use AutoSaveRequestTestTrait;
  use ComplexContentTrait;
  use RequestTrait;
  use UserCreationTrait;

  private const STATE = '/canvas-metatag/api/state';
  private const FRONTEND = 'https://www.example.com';
  private const CLIENT = '0b6c7f0e-6c1f-4a53-9f0b-1c2f3d4e5a6b';
  private const EVENT_SUMMARY = 'New music by the lake on the longest evening of the year.';

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'node',
    'field',
    'taxonomy',
    'page_cache',
    'dynamic_page_cache',
    'canvas_metatag',
    // Refuses `view` on a field named field_no_view_access.
    'entity_test',
    'field_test',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpComplexContent();
  }

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    self::allowPageCaches($container);
  }

  /**
   * Each field is offered by Canvas with its kinds.
   *
   * Title, owner and dates only as facts.
   */
  public function testFieldDiscovery(): void {
    $expected = [
      'venue' => ['body', 'field_street', 'field_postal_code', 'field_locality', 'field_country'],
      'person' => ['body', 'field_role', 'field_photo', 'field_links'],
      'event' => [
        'body',
        'field_starts',
        'field_ends',
        'field_venue',
        'field_performers',
        'field_tickets',
        'field_poster',
        'field_event_status',
      ],
      // The gallery's text and address rows are offered; Canvas does not
      // match a multi-value media field as one image.
      'product' => ['body', 'field_price', 'field_currency', 'field_sku', 'field_gallery', 'field_category'],
      'job_posting' => [
        'body',
        'field_salary',
        'field_salary_unit',
        'field_employment_type',
        'field_valid_through',
        'field_location',
        'field_image',
        'field_no_view_access',
      ],
      'announcement' => ['body'],
    ];
    $sources = $this->container->get(Sources::class);
    foreach ($expected as $bundle => $fields) {
      $rows = $sources->vocabulary($bundle);
      // In the order of the type's form; nothing of the owner, the dates or
      // the title of the type itself.
      self::assertSame($fields, array_values(array_unique(array_column($rows, 'field'))), $bundle);
    }
    $kinds = static fn (string $bundle, string $field): array => array_values(array_unique(array_merge(...array_column(array_filter($sources->vocabulary($bundle), static fn (array $row): bool => $row['field'] === $field), 'kinds'))));
    self::assertSame(['date'], $kinds('event', 'field_starts'));
    self::assertSame(['date'], $kinds('job_posting', 'field_valid_through'));
    self::assertSame(['number'], $kinds('product', 'field_price'));
    self::assertContains('address', $kinds('event', 'field_tickets'));
    self::assertContains('image', $kinds('person', 'field_photo'));
    // A reference is a level: the venue's fields, through Venue.
    $venue = array_filter($sources->vocabulary('event'), static fn (array $row): bool => $row['field'] === 'field_venue');
    self::assertContains('Venue › Street address', array_column($venue, 'label'));

    // A field taken off the form follows the fields on it.
    $this->container->get('entity_display.repository')->getFormDisplay('node', 'venue')->removeComponent('body')->save();
    $this->container->get('cache.static')->deleteAll();
    self::assertSame([
      'field_street',
      'field_postal_code',
      'field_locality',
      'field_country',
      'body',
    ], array_values(array_unique(array_column($sources->vocabulary('venue'), 'field'))));

    // The Event type's Description field and the Description fact share a
    // label: the link menu tells them apart by their group.
    self::assertContains('Description', array_column($sources->vocabulary('event'), 'label'));
    self::assertSame('Description', $this->resolver()->facts(NULL, new CacheableMetadata())['description']['label']);
  }

  /**
   * What a field gives per node: references, lists, media, empty and hidden.
   */
  public function testValuesPerNode(): void {
    $sources = $this->container->get(Sources::class);
    // The source a whole field gave before sources: the field's own value,
    // else the referenced entity's label.
    $link = function (string $key, string $field, string $kind = 'text') use ($sources): string|array|null {
      $node = $this->node($key);
      $source = $sources->sourceFor($node->bundle(), $field, $kind);
      self::assertNotNull($source, "$key: $field");
      return $this->resolver()->link($source, $node, $kind, new CacheableMetadata())[1];
    };
    $fact = fn (string $key, string $name): mixed => $this->resolver()->facts($this->node($key), new CacheableMetadata())[$name][$name === 'image' ? 'image' : 'value'];
    $values = [
      'event_full' => [
        // A summary wins over the text.
        'description' => self::EVENT_SUMMARY,
        'field_starts' => ['2027-06-19T19:00:00+03:00', 'date'],
        'field_ends' => ['2027-06-19T22:30:00+03:00', 'date'],
        'field_venue' => 'Lakeside Concert Hall',
        // The first of two performers.
        'field_performers' => 'Mira Kallio',
        'field_tickets' => ['https://tickets.example.com/midsummer', 'address'],
        // A text list gives its key.
        'field_event_status' => 'EventScheduled',
        'author' => 'Rosa Martín',
        'url' => 'http://localhost/complex/events/midsummer-night-concert',
        'published' => '2026-05-04T11:00:00+03:00',
        'modified' => '2026-05-06T11:00:00+03:00',
      ],
      'event_hidden_refs' => [
        'title' => 'Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮',
        'description' => 'Bring your own instrument. 🎶',
        // An unpublished venue, and a first performer who is unpublished:
        // nothing, never the second performer.
        'field_venue' => NULL,
        'field_performers' => NULL,
        'field_ends' => [NULL, 'date'],
        'field_tickets' => [NULL, 'address'],
        'field_event_status' => 'EventPostponed',
      ],
      'event_long' => [
        // An internal link is put on the public base.
        'field_tickets' => ['http://localhost/complex/venues/lakeside-concert-hall', 'address'],
      ],
      'product_lamp' => [
        // The scale the field stores.
        'field_price' => ['89', 'number'],
        'field_currency' => 'EUR',
        'field_sku' => 'LAMP-OAK-01',
        'field_category' => 'Lamps',
      ],
      'product_rtl' => [
        'title' => 'مصباح مكتب',
        'field_price' => ['1200.5', 'number'],
        'field_currency' => 'USD',
        'field_category' => 'Desks & tables',
      ],
      'product_empty' => [
        'description' => '',
        'field_price' => [NULL, 'number'],
        'field_currency' => NULL,
        'field_sku' => NULL,
        'field_category' => NULL,
      ],
      'product_archived' => [
        'field_price' => ['149', 'number'],
        // An unpublished term is hidden from visitors.
        'field_category' => NULL,
      ],
      'recipe_bread' => [
        'title' => 'Ruisleipä (Finnish rye bread)',
        // Multi-value fields give their first item; formatted text is plain.
        'field_ingredients' => '500 g rye flour',
        'field_prep_minutes' => ['20', 'number'],
        'field_yield' => '1 loaf',
        'field_diet' => 'vegan',
      ],
      'job_developer' => [
        'description' => 'Build editorial tools with a small team.',
        'field_salary' => ['5200', 'number'],
        'field_salary_unit' => 'MONTH',
        'field_employment_type' => 'FULL_TIME',
        // A date-only field stays a date.
        'field_valid_through' => ['2027-01-31', 'date'],
        'field_location' => 'Example office',
        // A field visitors may not view.
        'field_no_view_access' => NULL,
      ],
      'job_expired' => [
        'field_salary' => [NULL, 'number'],
        'field_location' => NULL,
        'field_valid_through' => ['2026-01-15', 'date'],
      ],
      'person_mira' => [
        'description' => 'Conductor of new music.',
        'field_role' => 'Conductor',
        // The first of two profiles.
        'field_links' => ['https://mira.example.org', 'address'],
      ],
      'person_omar' => [
        'title' => 'عمر حداد',
        'field_role' => 'ملحن',
        'field_links' => ['https://omar.example.org', 'address'],
      ],
      'person_empty' => [
        'description' => '',
        'field_role' => NULL,
        'field_links' => [NULL, 'address'],
      ],
    ];
    foreach ($values as $key => $expected) {
      foreach ($expected as $name => $value) {
        [$value, $kind] = is_array($value) ? $value : [$value, 'text'];
        $actual = str_starts_with($name, 'field_') ? $link($key, $name, $kind) : $fact($key, $name);
        self::assertSame($value, $actual, "$key: $name");
      }
    }
    // Canvas offers a multi-value formatted text for a list of formatted
    // texts: the module asks for one, so steps can be linked.
    self::assertSame(['expression' => 'ℹ︎␜entity:node:recipe␝field_steps␞␟value', 'sourceType' => 'entity-field'], $sources->sourceFor('recipe', 'field_steps', 'text'));

    // A long body without a summary: its text, cut at a word boundary within
    // 160 characters.
    $description = $fact('event_long', 'description');
    self::assertStringStartsWith('Each work is introduced by the musicians who play it', $description);
    self::assertLessThanOrEqual(160, mb_strlen($description));
    self::assertGreaterThan(100, mb_strlen($description));

    // Long HTML: plain text with entities decoded, no markup, and nothing of
    // the script at its end. The heading, the list items and the table rows
    // end their sentences.
    $node = $this->node('product_lamp');
    $body = (string) $this->resolver()->link([
      'expression' => 'ℹ︎␜entity:node:product␝body␞␟value',
      'sourceType' => 'entity-field',
    ], $node, 'text', new CacheableMetadata())[1];
    self::assertStringStartsWith('Made to last. Solid oak, turned by hand & finished with natural oil.', $body);
    self::assertStringNotContainsString('<', $body);
    self::assertStringNotContainsString('alert(1)', $body);
    self::assertStringNotContainsString('alert(1)', $fact('product_lamp', 'description'));

    // Images: media and core image fields, as an anonymous visitor sees them.
    $images = [
      // Media with alt text; the image is the original with its size.
      'event_full' => ['field_poster', 'poster', 1600, 900, 'An orchestra on an open-air stage at dusk'],
      // Alt text from right to left.
      'person_omar' => ['field_photo', 'omar', 800, 1000, 'صورة عمر حداد'],
      // A core image field, with the size its file has.
      'recipe_bread' => ['field_image', 'rye_bread', 1200, 800, 'A dark rye loaf on a board'],
      'recipe_rtl' => ['field_image', 'shakshuka', 1000, 750, ''],
      'job_developer' => ['field_image', 'logo', 400, 400, ''],
    ];
    foreach ($images as $key => [$field, $file, $width, $height, $alt]) {
      $expected = ['url' => $this->fileUrl($file), 'width' => $width, 'height' => $height, 'alt' => $alt];
      self::assertSame($expected, array_intersect_key($link($key, $field, 'image') ?? [], $expected), $key);
      // The Image fact is the first image field that resolves: here the only
      // one.
      self::assertSame($expected, array_intersect_key($fact($key, 'image') ?? [], $expected), $key);
    }
    // A gallery is several images: Canvas offers no one image of it, and the
    // Image fact is its first item.
    self::assertNull($sources->sourceFor('product', 'field_gallery', 'image'));
    self::assertSame($this->fileUrl('lamp_front'), $fact('product_lamp', 'image')['url'] ?? NULL);
    // An image visitors cannot see (an unpublished poster) gives nothing; an
    // unpublished first gallery item gives nothing, never the second item.
    self::assertNull($link('event_hidden_refs', 'field_poster', 'image'));
    foreach (['event_hidden_refs', 'product_rtl', 'product_empty'] as $key) {
      self::assertNull($fact($key, 'image'), $key);
    }
  }

  /**
   * Heads and structured data per type, as visitors get them in the HTML.
   */
  public function testCoupledHeadsAndStructuredData(): void {
    // Owned: one title, one canonical, no shortlink, one JSON-LD script, all
    // the resolver's. Not owned: core's head, untouched.
    $owned = [
      'event_full',
      'event_hidden_refs',
      'event_long',
      'product_lamp',
      'product_rtl',
      'product_empty',
      'person_mira',
      'person_omar',
      'person_empty',
      'job_developer',
    ];
    $heads = [];
    foreach ([...$owned, 'venue_hall', 'recipe_bread', 'article_long'] as $key) {
      $response = $this->get($this->complex['path'][$key]);
      $head = self::readHead($response);
      if (!in_array($key, $owned, TRUE)) {
        self::assertSame([], $head['meta'], $key);
        self::assertSame([], $head['json_ld'], $key);
        $rels = array_column($head['links'], 'rel');
        sort($rels);
        self::assertSame(['canonical', 'shortlink'], $rels, $key);
        self::assertSame([$this->node($key)->label() . ' | Example'], $head['titles'], $key);
        continue;
      }
      $expected = $this->resolver()->resolve($this->node($key))['head'];
      self::assertSame([$expected['title']], $head['titles'], $key);
      self::assertSame($expected['meta'], $head['meta'], $key);
      self::assertSame([[
        'rel' => 'canonical',
        'href' => 'http://localhost' . $this->complex['path'][$key],
      ],
      ], $head['links'], $key);
      self::assertSame([$expected['script'][0]['textContent']], $head['json_ld'], $key);
      $heads[$key] = $expected;
    }
    // Served again from the page cache.
    self::assertSame('HIT', $this->get($this->complex['path']['event_full'])->headers->get('X-Drupal-Cache'));

    // An event: the poster is the social image; the street address is linked
    // to the venue's street, so the event itself ships.
    $poster = ['url' => $this->fileUrl('poster'), 'width' => 1600, 'height' => 900];
    self::assertSame([
      'description' => self::EVENT_SUMMARY,
      'robots' => 'max-image-preview:large',
      'og:type' => 'website',
      'og:site_name' => 'Example',
      'og:title' => 'Midsummer Night Concert',
      'og:description' => self::EVENT_SUMMARY,
      'og:url' => 'http://localhost/complex/events/midsummer-night-concert',
      'og:image' => $poster['url'],
      'og:image:width' => '1600',
      'og:image:height' => '900',
      'og:image:alt' => 'An orchestra on an open-air stage at dusk',
      'twitter:card' => 'summary_large_image',
    ], self::meta($heads['event_full']));
    self::assertSame('Midsummer Night Concert | Events', $heads['event_full']['title']);
    $graph = self::graph($heads['event_full']);
    self::assertSame(['identity', 'website', 'webpage', 'primaryimage', 'primary'], array_keys($graph));
    self::assertSame('WebPage', $graph['webpage']['@type']);
    self::assertArrayHasKey('mainEntity', $graph['webpage']);
    // The venue's name; its street has no city or country, so the address
    // is left out and reported, and the event still ships.
    self::assertSame(['@type' => 'Place', 'name' => 'Lakeside Concert Hall'], $graph['primary']['location']);
    self::assertSame([['group' => 'location_address', 'missing' => ['location_address_addressCountry']]], $this->resolver()->resolve($this->node('event_full'))['schema']['incomplete']);
    self::assertSame('https://schema.org/EventScheduled', $graph['primary']['eventStatus']);
    self::assertSame('An orchestra on an open-air stage at dusk', $graph['primaryimage']['caption']);
    // What withholds the main node, and the values that do not fit.
    $reports = [
      'event_full' => [NULL, []],
      // No venue for visitors: no venue at all.
      'event_hidden_refs' => [['location'], []],
      // A text list gives its key, a currency code.
      'product_lamp' => [NULL, []],
      'product_rtl' => [NULL, []],
      'product_empty' => [['offers_price'], []],
      'person_mira' => [NULL, []],
      'person_empty' => [NULL, []],
      // No structured data type: nothing to withhold.
      'job_developer' => [NULL, []],
    ];
    foreach ($reports as $key => [$missing, $dropped]) {
      $schema = $this->resolver()->resolve($this->node($key))['schema'];
      self::assertSame([$missing, $dropped], [$schema['withheld']['missing'] ?? NULL, $schema['dropped']], $key);
    }

    // A long title keeps its ending whole and loses the last words of its
    // main part, cut at a word within 255 characters.
    self::assertStringEndsWith('rehearsed and first | Events', $heads['event_long']['title']);
    self::assertLessThanOrEqual(255, mb_strlen($heads['event_long']['title']));

    // A product: its description is its Description fact, the start of its
    // body cut at a word within 160 characters; a gallery whose first image
    // has no alt text gives the image without one.
    $meta = self::meta($heads['product_lamp']);
    self::assertLessThanOrEqual(160, mb_strlen($meta['description']));
    self::assertStringStartsWith('Made to last. Solid oak, turned by hand & finished with natural oil.', $meta['description']);
    self::assertSame($this->fileUrl('lamp_front'), $meta['og:image']);
    self::assertArrayNotHasKey('og:image:alt', $meta);
    self::assertArrayNotHasKey('caption', self::graph($heads['product_lamp'])['primaryimage']);
    // An unpublished first gallery item: no image anywhere, the small card.
    $meta = self::meta($heads['product_rtl']);
    self::assertArrayNotHasKey('og:image', $meta);
    self::assertSame('summary', $meta['twitter:card']);
    self::assertArrayNotHasKey('primaryimage', self::graph($heads['product_rtl']));

    // A profile: a Person with the role, the first profile and the photo.
    $url = 'http://localhost/complex/people/mira-kallio';
    self::assertSame('profile', self::meta($heads['person_mira'])['og:type']);
    $graph = self::graph($heads['person_mira']);
    self::assertSame('ProfilePage', $graph['webpage']['@type']);
    self::assertSame(['@id' => "$url#primary"], $graph['webpage']['mainEntity']);
    self::assertSame([
      '@type' => 'Person',
      '@id' => "$url#primary",
      'mainEntityOfPage' => ['@id' => "$url#webpage"],
      'name' => 'Mira Kallio',
      'description' => 'Conductor of new music.',
      // The photo is the page's own image: referenced, not repeated.
      'image' => ['@id' => "$url#primaryimage"],
      'jobTitle' => 'Conductor',
      // Every profile link, in order.
      'sameAs' => ['https://mira.example.org', 'https://social.example.net/@mira'],
    ], $graph['primary']);
    self::assertSame($this->fileUrl('mira'), $graph['primaryimage']['url']);
    // Every optional field empty: name and photo only.
    $primary = self::graph($heads['person_empty'])['primary'];
    self::assertSame(['@type', '@id', 'mainEntityOfPage', 'name', 'image'], array_keys($primary));
    self::assertSame('Lin Leinonen', $primary['name']);
    // Right-to-left text is kept as typed.
    $graph = self::graph($heads['person_omar']);
    self::assertSame('عمر حداد', $graph['primary']['name']);
    self::assertSame('ملحن', $graph['primary']['jobTitle']);
    self::assertSame('صورة عمر حداد', $graph['primaryimage']['caption']);
    self::assertSame('صورة عمر حداد', self::meta($heads['person_omar'])['og:image:alt']);

    // A type with no SEO values: the site's title pattern, a web page, its
    // own body as the description and its logo as the image.
    $meta = self::meta($heads['job_developer']);
    self::assertSame('Senior Drupal developer | Example', $heads['job_developer']['title']);
    self::assertSame('Build editorial tools with a small team.', $meta['description']);
    self::assertSame('website', $meta['og:type']);
    self::assertSame($this->fileUrl('logo'), $meta['og:image']);
    self::assertSame(['400', '400'], [$meta['og:image:width'], $meta['og:image:height']]);
    // A square logo makes a small card, as the dialog's link preview shows.
    self::assertSame('summary', $meta['twitter:card']);
    self::assertArrayNotHasKey('og:image:alt', $meta);
    self::assertSame([
      'identity',
      'website',
      'webpage',
      'primaryimage',
    ], array_keys(self::graph($heads['job_developer'])));

    // Emoji, joiners and flags survive the script element and the title.
    self::assertSame('Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 | Events', $heads['event_hidden_refs']['title']);
    self::assertSame('Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮', self::graph($heads['event_hidden_refs'])['webpage']['name']);
  }

  /**
   * A change to a referenced venue, media item or term invalidates the head.
   */
  public function testReferencedEntityChanges(): void {
    $event = ContentTemplate::load('node.event.full');
    self::assertInstanceOf(ContentTemplate::class, $event);
    $values = $event->getThirdPartySetting('canvas_metatag', 'values');
    $event->setThirdPartySetting('canvas_metatag', 'values', [
      'title_end' => [
        'source' => [
          'expression' => 'ℹ︎␜entity:node:event␝field_venue␞␟entity␜␜entity:node␝title␞␟value',
          'sourceType' => 'entity-field',
        ],
      ],
      'social' => [
        'title' => [
          'source' => [
            'expression' => 'ℹ︎␜entity:node:event␝field_performers␞␟entity␜␜entity:node␝title␞␟value',
            'sourceType' => 'entity-field',
          ],
        ],
      ] + ($values['social'] ?? []),
    ] + $values)->save();
    $product = ContentTemplate::load('node.product.full');
    self::assertInstanceOf(ContentTemplate::class, $product);
    $values = $product->getThirdPartySetting('canvas_metatag', 'values');
    $product->setThirdPartySetting('canvas_metatag', 'values', [
      'description' => [
        'source' => [
          'expression' => 'ℹ︎␜entity:node:product␝field_category␞␟entity␜␜entity:taxonomy_term␝name␞␟value',
          'sourceType' => 'entity-field',
        ],
      ],
    ] + $values)->save();

    // The head depends on what it reads through the references.
    $tags = $this->resolver()->resolve($this->node('event_full'))['cacheability']->getCacheTags();
    $poster = $this->entity('media', 'poster');
    $file = $this->entity('file', 'poster');
    $references = [
      'node:' . $this->complex['node']['venue_hall'],
      'media:' . $poster->id(),
      'file:' . $file->id(),
      'node:' . $this->complex['node']['person_mira'],
    ];
    foreach ($references as $tag) {
      self::assertContains($tag, $tags);
    }
    self::assertContains('taxonomy_term:' . $this->complex['taxonomy_term']['lamps'], $this->resolver()->resolve($this->node('product_lamp'))['cacheability']->getCacheTags());

    $event_path = $this->complex['path']['event_full'];
    $product_path = $this->complex['path']['product_lamp'];
    $seen = [];
    $read = function () use ($event_path, $product_path): array {
      $heads = [];
      foreach ([$event_path, $product_path] as $path) {
        $response = $this->get($path);
        $heads[$path] = self::readHead($response) + ['cache' => $response->headers->get('X-Drupal-Cache')];
      }
      $event = $heads[$event_path];
      $meta = self::meta($event);
      return [
        $event['cache'],
        $event['titles'][0],
        $meta['og:image:alt'] ?? NULL,
        $meta['og:image'] ?? NULL,
        $heads[$product_path]['cache'],
        self::meta($heads[$product_path])['description'] ?? NULL,
      ];
    };
    $seen['before'] = $read();
    $seen['again'] = $read();
    $venue = $this->node('venue_hall');
    $venue->setTitle('Lakeside Hall')->save();
    $seen['venue renamed'] = $read();
    $poster->set('field_media_image', ['alt' => 'The stage at dusk'] + (array) $poster->get('field_media_image')->first()?->getValue())->save();
    $seen['poster alt changed'] = $read();
    $term = $this->entity('taxonomy_term', 'lamps');
    \assert($term instanceof TermInterface);
    $term->setName('Table lamps')->save();
    $seen['term renamed'] = $read();
    $this->node('venue_hall')->setUnpublished()->save();
    $this->forgetAccess();
    $seen['venue unpublished'] = $read();
    $poster = $this->entity('media', 'poster');
    \assert($poster instanceof MediaInterface);
    $poster->setUnpublished()->save();
    $this->forgetAccess();
    $seen['poster unpublished'] = $read();

    $url = $this->fileUrl('poster');
    $alt = 'An orchestra on an open-air stage at dusk';
    $hall = 'Midsummer Night Concert | Lakeside Concert Hall';
    $renamed = 'Midsummer Night Concert | Lakeside Hall';
    self::assertSame([
      'before' => ['MISS', $hall, $alt, $url, 'MISS', 'Lamps'],
      'again' => ['HIT', $hall, $alt, $url, 'HIT', 'Lamps'],
      'venue renamed' => ['MISS', $renamed, $alt, $url, 'HIT', 'Lamps'],
      'poster alt changed' => ['MISS', $renamed, 'The stage at dusk', $url, 'HIT', 'Lamps'],
      'term renamed' => ['HIT', $renamed, 'The stage at dusk', $url, 'MISS', 'Table lamps'],
      // A link that is no longer visible gives its default; the event has no
      // other image field and the site no default image.
      'venue unpublished' => [
        'MISS',
        'Midsummer Night Concert | Example',
        'The stage at dusk',
        $url,
        'HIT',
        'Table lamps',
      ],
      'poster unpublished' => ['MISS', 'Midsummer Night Concert | Example', NULL, NULL, 'HIT', 'Table lamps'],
    ], $seen);
  }

  /**
   * A hidden reference that becomes visible, or is deleted, updates the head.
   *
   * The head of a node whose references visitors cannot see depends on those
   * references too: publishing one shows it at once, deleting one empties it.
   */
  public function testHiddenReferencesChange(): void {
    $event = ContentTemplate::load('node.event.full');
    self::assertInstanceOf(ContentTemplate::class, $event);
    $values = $event->getThirdPartySetting('canvas_metatag', 'values');
    $event->setThirdPartySetting('canvas_metatag', 'values', [
      'title_end' => [
        'source' => [
          'expression' => 'ℹ︎␜entity:node:event␝field_venue␞␟entity␜␜entity:node␝title␞␟value',
          'sourceType' => 'entity-field',
        ],
      ],
      'description' => [
        'source' => [
          'expression' => 'ℹ︎␜entity:node:event␝field_performers␞␟entity␜␜entity:node␝title␞␟value',
          'sourceType' => 'entity-field',
        ],
      ],
    ] + $values)->save();
    // The product's image is its Image fact: the first item of its gallery.
    $event_path = $this->complex['path']['event_hidden_refs'];
    $product_path = '/node/' . $this->complex['node']['product_rtl'];
    $read = function () use ($event_path, $product_path): array {
      $event = $this->get($event_path);
      $product = $this->get($product_path);
      $head = self::readHead($event);
      return [
        $event->headers->get('X-Drupal-Cache'),
        $head['titles'][0],
        self::meta($head)['description'] ?? NULL,
        $product->headers->get('X-Drupal-Cache'),
        self::meta(self::readHead($product))['og:image'] ?? NULL,
      ];
    };
    $publish = function (string $entity_type_id, string $key): void {
      $entity = $entity_type_id === 'node' ? $this->node($key) : $this->entity($entity_type_id, $key);
      \assert($entity instanceof NodeInterface || $entity instanceof MediaInterface);
      $entity->setPublished()->save();
      $this->forgetAccess();
    };

    $seen = [];
    $seen['before'] = $read();
    $seen['again'] = $read();
    $publish('node', 'venue_hidden');
    $seen['venue published'] = $read();
    // The first performer joins the second, who was there all along.
    $publish('node', 'person_hidden');
    $seen['first performer published'] = $read();
    $publish('media', 'lamp_prototype');
    $seen['first gallery image published'] = $read();
    $this->node('venue_hidden')->delete();
    $this->forgetAccess();
    $seen['venue deleted'] = $read();

    $title = 'Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮';
    // In text a field gives every item visitors may see: the hidden first
    // performer is left out, the second is kept.
    $own = 'Mira Kallio';
    $image = $this->fileUrl('lamp_prototype');
    $both = 'Unannounced guest, Mira Kallio';
    self::assertSame([
      'before' => ['MISS', "$title | Example", $own, 'MISS', NULL],
      'again' => ['HIT', "$title | Example", $own, 'HIT', NULL],
      'venue published' => ['MISS', "$title | Rehearsal Room B", $own, 'HIT', NULL],
      'first performer published' => ['MISS', "$title | Rehearsal Room B", $both, 'HIT', NULL],
      // The same media item is the event's poster: its head is built again.
      'first gallery image published' => ['MISS', "$title | Rehearsal Room B", $both, 'MISS', $image],
      'venue deleted' => ['MISS', "$title | Example", $both, 'HIT', $image],
    ], $seen);
  }

  /**
   * The template draft is the editor's; visitors get what is published.
   */
  public function testDraftAndLive(): void {
    $event = $this->node('event_full');
    // The Event template's draft ends its titles in "Tickets", the live
    // template in "Events".
    self::assertSame('Midsummer Night Concert | Events', $this->resolver()->resolve($event)['head']['title']);
    self::assertSame('Midsummer Night Concert | Tickets', $this->resolver()->resolve($event, TRUE)['head']['title']);

    // The template's editor sees the draft, in the dialog and its output.
    $this->setUpCurrentUser(permissions: [
      'access content',
      'view media',
      ContentTemplate::ADMIN_PERMISSION,
      AutoSaveManager::PUBLISH_PERMISSION,
      'edit canvas metatag',
    ]);
    $state = $this->state('node.event.full', 'event_full');
    $target = $state['target'];
    self::assertSame(['Event', TRUE, TRUE], [$target['label'], $target['published'], $target['has_draft']]);
    self::assertSame(['text' => 'Tickets'], $state['target']['values']['title_end']);
    self::assertSame([
      'source' => [
        'expression' => 'ℹ︎␜entity:node:event␝field_poster␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}',
        'sourceType' => 'entity-field',
      ],
    ], $state['target']['values']['social']['image']);
    self::assertSame('Midsummer Night Concert', $state['preview']['label']);
    self::assertSame('Midsummer Night Concert | Tickets', $state['resolved']['head']['title']);
    self::assertSame('Lakeside Concert Hall', array_column($state['sources'], 'value', 'label')['Venue › Title']);
    // Another event to preview with: its own values.
    $state = $this->state('node.event.full', 'event_hidden_refs');
    self::assertSame('Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 | Tickets', $state['resolved']['head']['title']);
    self::assertSame([
      'hidden',
      '',
    ], [
      array_column($state['sources'], 'status', 'label')['Venue › Title'],
      array_column($state['sources'], 'value', 'label')['Venue › Title'],
    ]);

    // A template that was never published previews with its values; for
    // visitors the recipe keeps core's head.
    $state = $this->state('node.recipe.full', 'recipe_bread');
    self::assertSame([FALSE, FALSE], [$state['target']['published'], $state['target']['has_draft']]);
    self::assertSame('Ruisleipä (Finnish rye bread) | Recipes', $state['resolved']['head']['title']);
    self::assertSame('500 g rye flour, 500 ml water, 100 g sourdough starter, 10 g salt', self::meta($state['resolved']['head'])['description']);
    self::assertSame($this->fileUrl('rye_bread'), self::meta($state['resolved']['head'])['og:image']);

    // Only the full template has SEO settings: the teaser has no state, and
    // a write to it is refused and writes nothing.
    $teaser = ContentTemplate::load('node.product.teaser');
    self::assertInstanceOf(ContentTemplate::class, $teaser);
    $response = $this->request(Request::create(self::STATE . '?entity_type=content_template&id=node.product.teaser&preview=' . $this->complex['node']['product_lamp']));
    self::assertSame([
      404,
      'not_found',
    ], [$response->getStatusCode(), self::decodeResponse($response)['error']['code']]);
    $response = $this->putTemplate($teaser, ['title' => ['text' => 'Teaser']]);
    self::assertSame([
      404,
      'not_found',
    ], [$response->getStatusCode(), self::decodeResponse($response)['error']['code']]);
    self::assertTrue($this->container->get(AutoSaveManager::class)->getAutoSaveEntity($teaser, TRUE)->isEmpty());

    // Someone who may use Canvas but not edit templates gets what is live.
    $this->setUpCurrentUser(permissions: [
      'access content',
      'view media',
      Page::EDIT_PERMISSION,
      'edit canvas metatag',
    ]);
    $state = $this->state('node.event.full', 'event_full');
    self::assertFalse($state['target']['has_draft']);
    self::assertSame(['text' => 'Events'], $state['target']['values']['title_end']);
    self::assertSame('Midsummer Night Concert | Events', $state['resolved']['head']['title']);

    // Visitors get the live template, and core's head for the recipe.
    $this->container->get(AccountProxyInterface::class)->setAccount(new AnonymousUserSession());
    $path = $this->complex['path']['event_full'];
    self::assertSame(['Midsummer Night Concert | Events'], self::readHead($this->get($path))['titles']);
    $recipe = self::readHead($this->get($this->complex['path']['recipe_bread']));
    self::assertSame(['Ruisleipä (Finnish rye bread) | Example'], $recipe['titles']);
    self::assertSame([], $recipe['json_ld']);

    // Publishing the draft makes it live, with its layout, for every event.
    $this->setUpCurrentUser(permissions: [
      'access content',
      'view media',
      ContentTemplate::ADMIN_PERMISSION,
      AutoSaveManager::PUBLISH_PERMISSION,
      'edit canvas metatag',
    ]);
    $response = $this->makePublishAllRequest();
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    $template = ContentTemplate::load('node.event.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    self::assertTrue($template->status());
    self::assertSame(['text' => 'Tickets'], $template->getThirdPartySetting('canvas_metatag', 'values')['title_end']);
    self::assertTrue($this->container->get(AutoSaveManager::class)->getAutoSaveEntity($template)->isEmpty());
    self::assertFalse(ContentTemplate::load('node.recipe.full')?->status());
    $this->container->get(AccountProxyInterface::class)->setAccount(new AnonymousUserSession());
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame(['Midsummer Night Concert | Tickets'], self::readHead($response)['titles']);
    self::assertSame(['Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 | Tickets'], self::readHead($this->get($this->complex['path']['event_hidden_refs']))['titles']);
  }

  /**
   * A field a value is linked to is deleted.
   *
   * The link is broken, the default is used, the template is left alone.
   */
  public function testBoundFieldDeleted(): void {
    $path = $this->complex['path']['event_full'];
    self::assertSame($this->fileUrl('poster'), self::meta(self::readHead($this->get($path)))['og:image']);

    FieldConfig::loadByName('node', 'event', 'field_poster')?->delete();
    // Canvas keeps its matches for the rest of a request.
    $this->container->get('cache.static')->deleteAll();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    $head = self::readHead($response);
    // The social image and the event image are linked to it, and the event
    // has no other image field: no image anywhere.
    self::assertSame(['Midsummer Night Concert | Events'], $head['titles']);
    $meta = self::meta($head);
    self::assertArrayNotHasKey('og:image', $meta);
    self::assertSame('summary', $meta['twitter:card']);
    self::assertSame([
      'identity',
      'website',
      'webpage',
      'primary',
    ], array_keys(self::graph(['script' => [['textContent' => $head['json_ld'][0]]]])));
    $event = $this->node('event_full');
    $schema = $this->resolver()->resolve($event)['schema'];
    self::assertSame([NULL, []], [$schema['withheld'], $schema['dropped']]);
    self::assertArrayNotHasKey('image', self::graph($this->resolver()->resolve($event)['head'])['primary']);

    // The template keeps its values and stays valid and in use; the field is
    // no longer offered.
    $template = ContentTemplate::load('node.event.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    self::assertTrue($template->status());
    self::assertSame([
      'source' => [
        'expression' => 'ℹ︎␜entity:node:event␝field_poster␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}',
        'sourceType' => 'entity-field',
      ],
    ], $template->getThirdPartySetting('canvas_metatag', 'values')['social']['image']);
    self::assertEntityIsValid($template);
    $this->container->get('cache.static')->deleteAll();
    self::assertNotContains('field_poster', array_column($this->container->get(Sources::class)->vocabulary('event'), 'field'));

    // The dialog shows the stored value; a new use of the field is refused,
    // while sending the stored value back keeps it.
    $this->setUpCurrentUser(permissions: [
      'access content',
      'view media',
      ContentTemplate::ADMIN_PERMISSION,
      'edit canvas metatag',
    ]);
    $state = $this->state('node.event.full', 'event_full');
    self::assertSame([
      'source' => [
        'expression' => 'ℹ︎␜entity:node:event␝field_poster␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}',
        'sourceType' => 'entity-field',
      ],
    ], $state['target']['values']['social']['image']);
    self::assertSame(['path' => 'social.image', 'field' => 'field_poster', 'reason' => 'missing'], $state['broken']['social.image']);
    self::assertNotContains('field_poster', array_column($state['sources'], 'field'));
    $values = $state['target']['values'];
    $response = $this->putTemplate($template, [
      'title' => [
        'source' => ['expression' => 'ℹ︎␜entity:node:event␝field_poster␞␟value', 'sourceType' => 'entity-field'],
      ],
    ] + $values);
    self::assertSame(Response::HTTP_UNPROCESSABLE_ENTITY, $response->getStatusCode());
    self::assertSame(['title' => 'Choose a field from the list.'], self::decodeResponse($response)['error']['fields']);
    $response = $this->putTemplate($template, ['title_end' => ['text' => 'Concerts']] + $values);
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    $poster = [
      'source' => [
        'expression' => 'ℹ︎␜entity:node:event␝field_poster␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}',
        'sourceType' => 'entity-field',
      ],
    ];
    self::assertSame($poster, self::decodeResponse($response)['values']['social']['image']);

    // A template with a broken link publishes: the link is kept, as stored.
    $this->setUpCurrentUser(permissions: [
      'access content',
      'view media',
      ContentTemplate::ADMIN_PERMISSION,
      AutoSaveManager::PUBLISH_PERMISSION,
      'edit canvas metatag',
    ]);
    $response = $this->makePublishAllRequest();
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    $template = ContentTemplate::load('node.event.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    self::assertSame(['text' => 'Concerts'], $template->getThirdPartySetting('canvas_metatag', 'values')['title_end']);
    self::assertSame($poster, $template->getThirdPartySetting('canvas_metatag', 'values')['social']['image']);
  }

  /**
   * The content API carries the same head per type, and drafts for previews.
   */
  public function testHeadless(): void {
    $this->enableHeadless();

    // Owned types: the resolver's head, on the frontend; images stay on
    // Drupal.
    foreach (['event_full', 'event_hidden_refs', 'product_lamp', 'person_mira', 'job_developer'] as $key) {
      $path = $this->complex['path'][$key];
      $head = self::decodeResponse($this->content($path))['head'];
      $expected = $this->resolver()->resolve($this->node($key))['head'];
      self::assertSame(json_decode((string) json_encode($expected), TRUE), $head, $key);
      self::assertSame([['rel' => 'canonical', 'href' => self::FRONTEND . $path]], $head['link'], $key);
      self::assertSame(self::FRONTEND . $path . '#webpage', self::graph($head)['webpage']['@id'], $key);
      if ($key === 'event_hidden_refs') {
        // No poster visitors may see, and no image elsewhere.
        self::assertArrayNotHasKey('og:image', self::meta($head));
        continue;
      }
      self::assertStringStartsWith('http://localhost/', self::meta($head)['og:image'], $key);
    }
    self::assertSame('Midsummer Night Concert | Events', self::decodeResponse($this->content($this->complex['path']['event_full']))['head']['title']);
    // A change to a referenced media item reaches the cached response.
    $event_path = $this->complex['path']['event_full'];
    $response = $this->content($event_path);
    self::assertSame('HIT', $response->headers->get('X-Drupal-Cache'));
    self::assertSame('An orchestra on an open-air stage at dusk', self::meta(self::decodeResponse($response)['head'])['og:image:alt']);
    $poster = $this->entity('media', 'poster');
    \assert($poster instanceof MediaInterface);
    $poster->set('field_media_image', ['alt' => 'The stage at dusk'] + (array) $poster->get('field_media_image')->first()?->getValue())->save();
    $response = $this->content($event_path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame('The stage at dusk', self::meta(self::decodeResponse($response)['head'])['og:image:alt']);
    // Not owned: Canvas's own head.
    self::assertSame(['title' => 'Lakeside Concert Hall'], self::decodeResponse($this->content($this->complex['path']['venue_hall']))['head']);
    self::assertSame(['title' => 'Ruisleipä (Finnish rye bread)'], self::decodeResponse($this->content($this->complex['path']['recipe_bread']))['head']);

    // A preview token reads the template draft, and the template that was
    // never published.
    $this->disableModules(['page_cache']);
    $consumer = Consumer::create([
      'client_id' => PreviewAssertionFactory::CLIENT_ID,
      'label' => 'Canvas Headless preview',
      'confidential' => FALSE,
      'is_default' => FALSE,
      'third_party' => FALSE,
      'grant_types' => ['canvas_headless_preview_assertion'],
      'access_token_expiration' => 900,
    ]);
    $consumer->save();
    $editor = $this->createUser(['access content', 'view media']);
    $token = Oauth2Token::create([
      'bundle' => 'access_token',
      'auth_user_id' => $editor->id(),
      'client' => $consumer->id(),
      'scopes' => [['scope_id' => PreviewAssertionGrant::SCOPE]],
      'value' => $this->randomMachineName(),
    ]);
    $this->container->get(AccountProxyInterface::class)->setAccount(new TokenAuthUser(
      $this->container->get(PermissionCheckerInterface::class),
      $token,
      $this->container->get(HttpMessageFactoryInterface::class),
      $this->container->get(RequestStack::class),
    ));
    $response = $this->content($this->complex['path']['event_full']);
    self::assertSame('Midsummer Night Concert | Tickets', self::decodeResponse($response)['head']['title']);
    self::assertInstanceOf(CacheableJsonResponse::class, $response);
    self::assertContains(AutoSaveManager::CACHE_TAG, $response->getCacheableMetadata()->getCacheTags());
    $head = self::decodeResponse($this->content($this->complex['path']['recipe_bread']))['head'];
    self::assertSame('Ruisleipä (Finnish rye bread) | Recipes', $head['title']);
    self::assertSame('500 g rye flour, 500 ml water, 100 g sourdough starter, 10 g salt', self::meta($head)['description']);
  }

  /**
   * A fixture node, loaded fresh.
   */
  private function node(string $key): NodeInterface {
    $this->container->get('entity_type.manager')->getStorage('node')->resetCache();
    $node = Node::load($this->complex['node'][$key]);
    self::assertInstanceOf(NodeInterface::class, $node);
    return $node;
  }

  /**
   * A fixture entity of another type, by its key.
   */
  private function entity(string $entity_type_id, string $key): MediaInterface|FileInterface|TermInterface {
    $entity = $this->container->get('entity.repository')->loadEntityByUuid($entity_type_id, ComplexContent::uuid($key));
    self::assertTrue($entity instanceof MediaInterface || $entity instanceof FileInterface || $entity instanceof TermInterface);
    return $entity;
  }

  /**
   * The absolute URL of a fixture image file, as the head carries it.
   */
  private function fileUrl(string $key): string {
    $file = $this->entity('file', $key);
    \assert($file instanceof FileInterface);
    return $this->container->get('file_url_generator')->generateAbsoluteString((string) $file->getFileUri());
  }

  /**
   * Requests a path as the current user; the response must be a 200.
   */
  private function get(string $path): Response {
    // A request starts without the entities an earlier one loaded.
    $this->container->get('entity.memory_cache')->deleteAll();
    $response = $this->request(Request::create($path));
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), $path);
    return $response;
  }

  /**
   * The dialog's state for a template, previewed with a fixture node.
   */
  private function state(string $template, string $node): array {
    $response = $this->request(Request::create(self::STATE . '?entity_type=content_template&id=' . $template . '&preview=' . $this->complex['node'][$node]));
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    return self::decodeResponse($response);
  }

  /**
   * Writes template values as the dialog does, on the draft as it is.
   */
  private function putTemplate(ContentTemplate $template, array $values): Response {
    $auto_save = $this->container->get(AutoSaveManager::class);
    return $this->request(Request::create('/canvas-metatag/api/draft/content_template/' . $template->id(), 'PUT', content: (string) json_encode([
      'values' => (object) $values,
      'client_instance_id' => self::CLIENT,
      'auto_saves' => [AutoSaveManager::getAutoSaveKey($template) => $auto_save->getClientAutoSaveData($template)],
    ])));
  }

  /**
   * A hidden reference that becomes visible, or is deleted, updates the head.
   *
   * Apart from testHeadless(), whose preview credentials read the Event
   * template as the fixture leaves it.
   */
  public function testHeadlessHiddenReferences(): void {
    $this->enableHeadless();
    $event = ContentTemplate::load('node.event.full');
    self::assertInstanceOf(ContentTemplate::class, $event);
    $values = $event->getThirdPartySetting('canvas_metatag', 'values');
    $event->setThirdPartySetting('canvas_metatag', 'values', [
      'title_end' => [
        'source' => [
          'expression' => 'ℹ︎␜entity:node:event␝field_venue␞␟entity␜␜entity:node␝title␞␟value',
          'sourceType' => 'entity-field',
        ],
      ],
    ] + $values)->save();
    $path = $this->complex['path']['event_hidden_refs'];
    $read = function () use ($path): array {
      $response = $this->content($path);
      return [$response->headers->get('X-Drupal-Cache'), self::decodeResponse($response)['head']['title']];
    };

    $seen = [];
    $seen['before'] = $read();
    $seen['again'] = $read();
    $this->node('venue_hidden')->setPublished()->save();
    $this->forgetAccess();
    $seen['venue published'] = $read();
    $this->node('venue_hidden')->delete();
    $this->forgetAccess();
    $seen['venue deleted'] = $read();

    $title = 'Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮';
    self::assertSame([
      'before' => ['MISS', "$title | Example"],
      'again' => ['HIT', "$title | Example"],
      'venue published' => ['MISS', "$title | Rehearsal Room B"],
      'venue deleted' => ['MISS', "$title | Example"],
    ], $seen);
  }

  /**
   * Enables canvas_headless with one frontend, or skips the test.
   */
  private function enableHeadless(): void {
    $modules = ['serialization', 'consumers', 'simple_oauth', 'custom_elements', 'canvas_headless'];
    if (array_diff($modules, array_keys($this->container->get('extension.list.module')->getList()))) {
      self::markTestSkipped('canvas_headless or one of its dependencies is not in the codebase.');
    }
    $this->enableModules($modules);
    $this->installEntitySchema('consumer');
    $this->installEntitySchema('oauth2_token');
    $this->installConfig(['simple_oauth', 'canvas_headless']);
    $this->config('canvas_headless.settings')->set('frontends', [[
      'url' => self::FRONTEND,
      'components' => [],
    ],
    ])->save();
  }

  /**
   * Requests the content API of canvas_headless for a path of the site.
   */
  private function content(string $path): Response {
    $this->container->get('entity.memory_cache')->deleteAll();
    $response = $this->request(Request::create('/canvas/content-api?' . http_build_query(['requestUri' => $path])));
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), $path);
    return $response;
  }

}
