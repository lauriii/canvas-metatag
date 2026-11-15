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
   * Each field type is offered with its kind; base fields are not.
   */
  public function testFieldDiscovery(): void {
    $common = [
      'title' => 'text',
      'description' => 'text',
      'site' => 'text',
      'sep' => 'text',
      'url' => 'url',
      'author' => 'text',
      'published' => 'datetime',
      'modified' => 'datetime',
      'image' => 'image',
    ];
    $expected = [
      'venue' => [
        'body' => 'text',
        'field_street' => 'text',
        'field_postal_code' => 'text',
        'field_locality' => 'text',
        // A text list.
        'field_country' => 'text',
      ],
      'person' => [
        'body' => 'text',
        'field_role' => 'text',
        // A reference to image media is an image.
        'field_photo' => 'image',
        'field_links' => 'url',
      ],
      'event' => [
        'body' => 'text',
        'field_starts' => 'datetime',
        'field_ends' => 'datetime',
        // A reference to a node gives its label.
        'field_venue' => 'text',
        'field_performers' => 'text',
        'field_tickets' => 'url',
        'field_poster' => 'image',
        'field_event_status' => 'text',
      ],
      'product' => [
        'body' => 'text',
        'field_price' => 'number',
        'field_currency' => 'text',
        'field_sku' => 'text',
        'field_gallery' => 'image',
        'field_category' => 'text',
      ],
      'recipe' => [
        'body' => 'text',
        // A core image field.
        'field_image' => 'image',
        'field_ingredients' => 'text',
        'field_steps' => 'text',
        'field_prep_minutes' => 'number',
        'field_cook_minutes' => 'number',
        'field_yield' => 'text',
        'field_diet' => 'text',
      ],
      'job_posting' => [
        'body' => 'text',
        'field_salary' => 'number',
        'field_salary_unit' => 'text',
        'field_employment_type' => 'text',
        // Date only.
        'field_valid_through' => 'datetime',
        'field_location' => 'text',
        'field_image' => 'image',
        // Offered; its value is empty wherever visitors may not view it.
        'field_no_view_access' => 'text',
      ],
      'announcement' => ['body' => 'text'],
    ];
    $resolver = $this->resolver();
    foreach ($expected as $bundle => $fields) {
      $types = $resolver->tokenTypes('node', $bundle);
      // The values every entity has come first; the fields follow in the
      // order of the type's form.
      self::assertSame($common, array_slice($types, 0, count($common)), $bundle);
      $fields = array_combine(array_map(static fn (string $name): string => "field.$name", array_keys($fields)), $fields);
      self::assertSame($fields, array_slice($types, count($common)), $bundle);
    }

    // A field taken off the form follows the fields on it.
    $this->container->get('entity_display.repository')->getFormDisplay('node', 'venue')->removeComponent('body')->save();
    self::assertSame(
      ['field.field_street', 'field.field_postal_code', 'field.field_locality', 'field.field_country', 'field.body'],
      array_slice(array_keys($resolver->tokenTypes('node', 'venue')), count($common)),
    );

    // Labels are the fields' own. Two values share the label "Description"
    // on the Event type: the dialog tells them apart by their names.
    $tokens = $resolver->tokens(NULL, 'node', 'event', new CacheableMetadata());
    self::assertSame('Description', $tokens['description']['label']);
    self::assertSame('Description', $tokens['field.body']['label']);
    self::assertSame('Venue', $tokens['field.field_venue']['label']);
    self::assertSame(['label' => 'Poster', 'type' => 'image', 'value' => '', 'image' => NULL], $tokens['field.field_poster']);
  }

  /**
   * Field values per node: references, lists, media, empty and hidden ones.
   */
  public function testValuesPerNode(): void {
    $values = [
      'event_full' => [
        // A summary wins over the text.
        'description' => self::EVENT_SUMMARY,
        'field.body' => self::EVENT_SUMMARY,
        'field.field_starts' => '2027-06-19T19:00:00+03:00',
        'field.field_ends' => '2027-06-19T22:30:00+03:00',
        'field.field_venue' => 'Lakeside Concert Hall',
        // The first of two performers.
        'field.field_performers' => 'Mira Kallio',
        'field.field_tickets' => 'https://tickets.example.com/midsummer',
        // A text list gives its label.
        'field.field_event_status' => 'On as planned',
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
        'field.field_venue' => '',
        'field.field_performers' => '',
        'field.field_ends' => '',
        'field.field_tickets' => '',
        'field.field_event_status' => 'Moved to a later date',
      ],
      'event_long' => [
        // An internal link is put on the public base.
        'field.field_tickets' => 'http://localhost/complex/venues/lakeside-concert-hall',
      ],
      'product_lamp' => [
        // The scale the field stores.
        'field.field_price' => '89.00',
        'field.field_currency' => 'Euro (€)',
        'field.field_sku' => 'LAMP-OAK-01',
        'field.field_category' => 'Lamps',
      ],
      'product_rtl' => [
        'title' => 'مصباح مكتب',
        'field.field_price' => '1200.50',
        'field.field_currency' => 'US dollar ($)',
        'field.field_category' => 'Desks & tables',
      ],
      'product_empty' => [
        'description' => '',
        'field.body' => '',
        'field.field_price' => '',
        'field.field_currency' => '',
        'field.field_sku' => '',
        'field.field_category' => '',
      ],
      'product_archived' => [
        'field.field_price' => '149.00',
        // An unpublished term: its label is hidden from visitors.
        'field.field_category' => '',
      ],
      'recipe_bread' => [
        'title' => 'Ruisleipä (Finnish rye bread)',
        // Multi-value fields give their first item; formatted text is plain.
        'field.field_ingredients' => '500 g rye flour',
        'field.field_steps' => 'Mix the flour, water and starter; leave overnight.',
        'field.field_prep_minutes' => '20',
        'field.field_yield' => '1 loaf',
        'field.field_diet' => 'Vegan',
      ],
      'job_developer' => [
        'description' => 'Build editorial tools with a small team.',
        'field.field_salary' => '5200.00',
        'field.field_salary_unit' => 'per month',
        'field.field_employment_type' => 'Full time',
        // A date-only field stays a date.
        'field.field_valid_through' => '2027-01-31',
        'field.field_location' => 'Example office',
        // A field visitors may not view.
        'field.field_no_view_access' => '',
      ],
      'job_expired' => [
        'field.field_salary' => '',
        'field.field_location' => '',
        'field.field_valid_through' => '2026-01-15',
      ],
      'person_mira' => [
        'description' => 'Conductor of new music.',
        'field.field_role' => 'Conductor',
        // The first of two profiles.
        'field.field_links' => 'https://mira.example.org',
      ],
      'person_omar' => [
        'title' => 'عمر حداد',
        'field.field_role' => 'ملحن',
        'field.field_links' => 'https://omar.example.org',
      ],
      'person_empty' => [
        'description' => '',
        'field.field_role' => '',
        'field.field_links' => '',
      ],
    ];
    $actual = [];
    foreach ($values as $key => $expected) {
      $node = $this->node($key);
      $tokens = $this->resolver()->tokens($node, 'node', $node->bundle(), new CacheableMetadata());
      $actual[$key] = array_intersect_key(array_map(static fn (array $token): string => $token['value'], $tokens), $expected);
      // In the order of the expectation.
      $actual[$key] = array_merge(array_intersect_key($expected, $actual[$key]), $actual[$key]);
    }
    self::assertSame($values, $actual);

    // A long body without a summary: its text, cut at a word boundary within
    // 160 characters.
    $node = $this->node('event_long');
    $tokens = $this->resolver()->tokens($node, 'node', 'event', new CacheableMetadata());
    $text = $tokens['field.body']['value'];
    $description = $tokens['description']['value'];
    self::assertStringStartsWith('Each work is introduced by the musicians who play it', $text);
    self::assertLessThanOrEqual(160, mb_strlen($description));
    self::assertGreaterThan(100, mb_strlen($description));
    self::assertStringStartsWith($description, $text);
    self::assertMatchesRegularExpression('/^[^\pL\pN]/u', mb_substr($text, mb_strlen($description), 1));

    // Long HTML: plain text with entities decoded, no markup, and nothing of
    // the script at its end.
    $node = $this->node('product_lamp');
    $tokens = $this->resolver()->tokens($node, 'node', 'product', new CacheableMetadata());
    $body = $tokens['field.body']['value'];
    // The heading, the list items and the table rows end their sentences.
    self::assertStringStartsWith('Made to last. Solid oak, turned by hand & finished with natural oil.', $body);
    self::assertStringEndsWith('Warm 2700 K light. Dimmable. Fabric cable, 2 m. Height 45 cm. Weight 1.2 kg. Questions? Ask us 💡', $body);
    self::assertStringNotContainsString('<', $body);
    foreach (['field.body', 'description'] as $name) {
      self::assertStringNotContainsString('alert(1)', $tokens[$name]['value'], $name);
    }

    // Images: media and core image fields, as an anonymous visitor sees them.
    $images = [
      // Media with alt text; the image is the original with its size.
      'event_full' => ['field.field_poster', 'poster', 1600, 900, 'An orchestra on an open-air stage at dusk'],
      // The first item of a gallery, without alt text.
      'product_lamp' => ['field.field_gallery', 'lamp_front', 1200, 1200, ''],
      // Alt text from right to left.
      'person_omar' => ['field.field_photo', 'omar', 800, 1000, 'صورة عمر حداد'],
      // A core image field, with the size its file has.
      'recipe_bread' => ['field.field_image', 'rye_bread', 1200, 800, 'A dark rye loaf on a board'],
      'recipe_rtl' => ['field.field_image', 'shakshuka', 1000, 750, ''],
      'job_developer' => ['field.field_image', 'logo', 400, 400, ''],
    ];
    foreach ($images as $key => [$token, $file, $width, $height, $alt]) {
      $node = $this->node($key);
      $tokens = $this->resolver()->tokens($node, 'node', $node->bundle(), new CacheableMetadata());
      $expected = ['url' => $this->fileUrl($file), 'width' => $width, 'height' => $height, 'alt' => $alt];
      self::assertSame($expected, array_intersect_key($tokens[$token]['image'] ?? [], $expected), $key);
      // {image} is the first image field that resolves: here the only one.
      self::assertSame($tokens[$token]['image'], $tokens['image']['image'], $key);
    }
    // No image, or one visitors cannot see: an unpublished first gallery
    // item gives nothing, never the second item.
    $missing = [
      'event_hidden_refs' => 'field.field_poster',
      'product_rtl' => 'field.field_gallery',
      'product_empty' => 'field.field_gallery',
    ];
    foreach ($missing as $key => $token) {
      $node = $this->node($key);
      $tokens = $this->resolver()->tokens($node, 'node', $node->bundle(), new CacheableMetadata());
      self::assertNull($tokens[$token]['image'], $key);
      self::assertNull($tokens['image']['image'], $key);
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
      self::assertSame([['rel' => 'canonical', 'href' => 'http://localhost' . $this->complex['path'][$key]]], $head['links'], $key);
      self::assertSame([$expected['script'][0]['textContent']], $head['json_ld'], $key);
      $heads[$key] = $expected;
    }
    // Served again from the page cache.
    self::assertSame('HIT', $this->get($this->complex['path']['event_full'])->headers->get('X-Drupal-Cache'));

    // An event: the poster is the social image; the event itself is withheld,
    // because its street address is on the venue, which a value of one
    // level cannot reach.
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
    self::assertSame(['identity', 'website', 'webpage', 'primaryimage'], array_keys($graph));
    self::assertSame('WebPage', $graph['webpage']['@type']);
    self::assertArrayNotHasKey('mainEntity', $graph['webpage']);
    self::assertSame('An orchestra on an open-air stage at dusk', $graph['primaryimage']['caption']);
    $reports = [
      'event_full' => [TRUE, ['location_address_streetAddress'], []],
      // No end, no venue for visitors, no poster.
      'event_hidden_refs' => [TRUE, ['location_address_streetAddress'], ['endDate', 'location_name', 'image']],
      // A text list gives its label, which is not a currency code.
      'product_lamp' => [TRUE, ['offers_priceCurrency'], ['offers_availability']],
      'product_rtl' => [TRUE, ['offers_priceCurrency'], ['image', 'offers_availability']],
      'product_empty' => [
        TRUE,
        ['offers_price', 'offers_priceCurrency'],
        ['description', 'image', 'offers_availability'],
      ],
      'person_mira' => [FALSE, [], []],
      'person_empty' => [FALSE, [], ['description']],
      // No structured data type: nothing to withhold.
      'job_developer' => [FALSE, [], []],
    ];
    foreach ($reports as $key => [$withheld, $required, $recommended]) {
      self::assertSame(
        ['withheld' => $withheld, 'missing_required' => $required, 'missing_recommended' => $recommended],
        $this->resolver()->resolve($this->node($key))['schema'],
        $key,
      );
    }

    // A long title is cut at the last word within 255 characters, and the
    // separator the cut leaves goes with it.
    $long = (string) $this->node('event_long')->label();
    self::assertStringEndsWith('first performed', $heads['event_long']['title']);
    self::assertSame($long, $heads['event_long']['title']);

    // A product: its description is its whole body as plain text, cut at
    // the last word within the description's limit; a gallery whose first
    // image has no alt text gives the image without one.
    $meta = self::meta($heads['product_lamp']);
    $body = $this->resolver()->tokens($this->node('product_lamp'), 'node', 'product', new CacheableMetadata())['field.body']['value'];
    self::assertLessThanOrEqual(1000, mb_strlen($meta['description']));
    self::assertGreaterThanOrEqual(900, mb_strlen($meta['description']));
    self::assertStringStartsWith($meta['description'] . ' ', $body);
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
      'image' => ['@type' => 'ImageObject', 'url' => $this->fileUrl('mira'), 'width' => 800, 'height' => 800],
      'jobTitle' => 'Conductor',
      'sameAs' => 'https://mira.example.org',
    ], $graph['primary']);
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
    self::assertSame(['identity', 'website', 'webpage', 'primaryimage'], array_keys(self::graph($heads['job_developer'])));

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
    $event->setThirdPartySetting('canvas_metatag', 'values', ['title' => '{title} at {field.field_venue}'] + $values)->save();
    $product = ContentTemplate::load('node.product.full');
    self::assertInstanceOf(ContentTemplate::class, $product);
    $values = $product->getThirdPartySetting('canvas_metatag', 'values');
    $product->setThirdPartySetting('canvas_metatag', 'values', ['description' => '{field.field_category}'] + $values)->save();

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
    $hall = 'Midsummer Night Concert at Lakeside Concert Hall';
    $renamed = 'Midsummer Night Concert at Lakeside Hall';
    self::assertSame([
      'before' => ['MISS', $hall, $alt, $url, 'MISS', 'Lamps'],
      'again' => ['HIT', $hall, $alt, $url, 'HIT', 'Lamps'],
      'venue renamed' => ['MISS', $renamed, $alt, $url, 'HIT', 'Lamps'],
      'poster alt changed' => ['MISS', $renamed, 'The stage at dusk', $url, 'HIT', 'Lamps'],
      'term renamed' => ['HIT', $renamed, 'The stage at dusk', $url, 'MISS', 'Table lamps'],
      // A value that is no longer visible is empty; the event has no other
      // image field and the site no default image.
      'venue unpublished' => ['MISS', 'Midsummer Night Concert at', 'The stage at dusk', $url, 'HIT', 'Table lamps'],
      'poster unpublished' => ['MISS', 'Midsummer Night Concert at', NULL, NULL, 'HIT', 'Table lamps'],
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
      'title' => '{title} at {field.field_venue}',
      'description' => '{field.field_performers}',
    ] + $values)->save();
    $product = ContentTemplate::load('node.product.full');
    self::assertInstanceOf(ContentTemplate::class, $product);
    $values = $product->getThirdPartySetting('canvas_metatag', 'values');
    $product->setThirdPartySetting('canvas_metatag', 'values', ['social' => ['image' => '{field.field_gallery}']] + $values)->save();

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
    // The first performer, not the second, who was there all along.
    $publish('node', 'person_hidden');
    $seen['first performer published'] = $read();
    $publish('media', 'lamp_prototype');
    $seen['first gallery image published'] = $read();
    $this->node('venue_hidden')->delete();
    $this->forgetAccess();
    $seen['venue deleted'] = $read();

    $title = 'Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 at';
    // With no performer to show, the description is the node's own.
    $own = 'Bring your own instrument. 🎶';
    $image = $this->fileUrl('lamp_prototype');
    self::assertSame([
      'before' => ['MISS', $title, $own, 'MISS', NULL],
      'again' => ['HIT', $title, $own, 'HIT', NULL],
      'venue published' => ['MISS', "$title Rehearsal Room B", $own, 'HIT', NULL],
      'first performer published' => ['MISS', "$title Rehearsal Room B", 'Unannounced guest', 'HIT', NULL],
      'first gallery image published' => ['HIT', "$title Rehearsal Room B", 'Unannounced guest', 'MISS', $image],
      'venue deleted' => ['MISS', $title, 'Unannounced guest', 'HIT', $image],
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
    self::assertSame('{title} {sep} Tickets', $state['target']['values']['title']);
    self::assertSame('{field.field_poster}', $state['target']['values']['social']['image']);
    self::assertSame('Midsummer Night Concert', $state['preview']['label']);
    self::assertSame('Midsummer Night Concert | Tickets', $state['resolved']['head']['title']);
    self::assertSame('Lakeside Concert Hall', $state['tokens']['field.field_venue']['value']);
    // Another event to preview with: its own values.
    $state = $this->state('node.event.full', 'event_hidden_refs');
    self::assertSame('Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 | Tickets', $state['resolved']['head']['title']);
    self::assertSame('', $state['tokens']['field.field_venue']['value']);

    // A template that was never published previews with its values; for
    // visitors the recipe keeps core's head.
    $state = $this->state('node.recipe.full', 'recipe_bread');
    self::assertSame([FALSE, FALSE], [$state['target']['published'], $state['target']['has_draft']]);
    self::assertSame('Ruisleipä (Finnish rye bread) | Recipes', $state['resolved']['head']['title']);
    self::assertSame('500 g rye flour', self::meta($state['resolved']['head'])['description']);
    self::assertSame($this->fileUrl('rye_bread'), self::meta($state['resolved']['head'])['og:image']);

    // Only the full template has SEO settings: the teaser has no state, and
    // a write to it is refused and writes nothing.
    $teaser = ContentTemplate::load('node.product.teaser');
    self::assertInstanceOf(ContentTemplate::class, $teaser);
    $response = $this->request(Request::create(self::STATE . '?entity_type=content_template&id=node.product.teaser&preview=' . $this->complex['node']['product_lamp']));
    self::assertSame([404, 'not_found'], [$response->getStatusCode(), self::decodeResponse($response)['error']['code']]);
    $response = $this->putTemplate($teaser, ['title' => '{title}']);
    self::assertSame([404, 'not_found'], [$response->getStatusCode(), self::decodeResponse($response)['error']['code']]);
    self::assertTrue($this->container->get(AutoSaveManager::class)->getAutoSaveEntity($teaser, TRUE)->isEmpty());

    // Someone who may use Canvas but not edit templates gets what is live.
    $this->setUpCurrentUser(permissions: ['access content', 'view media', Page::EDIT_PERMISSION, 'edit canvas metatag']);
    $state = $this->state('node.event.full', 'event_full');
    self::assertFalse($state['target']['has_draft']);
    self::assertSame('{title} {sep} Events', $state['target']['values']['title']);
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
    self::assertSame('{title} {sep} Tickets', $template->getThirdPartySetting('canvas_metatag', 'values')['title']);
    self::assertTrue($this->container->get(AutoSaveManager::class)->getAutoSaveEntity($template)->isEmpty());
    self::assertFalse(ContentTemplate::load('node.recipe.full')?->status());
    $this->container->get(AccountProxyInterface::class)->setAccount(new AnonymousUserSession());
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame(['Midsummer Night Concert | Tickets'], self::readHead($response)['titles']);
    self::assertSame(['Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 | Tickets'], self::readHead($this->get($this->complex['path']['event_hidden_refs']))['titles']);
  }

  /**
   * A field a value is bound to is deleted: that part is empty.
   */
  public function testBoundFieldDeleted(): void {
    $path = $this->complex['path']['event_full'];
    self::assertSame($this->fileUrl('poster'), self::meta(self::readHead($this->get($path)))['og:image']);

    FieldConfig::loadByName('node', 'event', 'field_poster')?->delete();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    $head = self::readHead($response);
    // The social image and the event image are bound to it, and the event
    // has no other image field: no image anywhere.
    self::assertSame(['Midsummer Night Concert | Events'], $head['titles']);
    $meta = self::meta($head);
    self::assertArrayNotHasKey('og:image', $meta);
    self::assertSame('summary', $meta['twitter:card']);
    self::assertSame(['identity', 'website', 'webpage'], array_keys(self::graph(['script' => [['textContent' => $head['json_ld'][0]]]])));
    $event = $this->node('event_full');
    self::assertSame([
      'withheld' => TRUE,
      'missing_required' => ['location_address_streetAddress'],
      'missing_recommended' => ['image'],
    ], $this->resolver()->resolve($event)['schema']);

    // The template keeps its values and stays valid and in use; the field is
    // no longer offered.
    $template = ContentTemplate::load('node.event.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    self::assertTrue($template->status());
    self::assertSame('{field.field_poster}', $template->getThirdPartySetting('canvas_metatag', 'values')['social']['image']);
    self::assertEntityIsValid($template);
    self::assertArrayNotHasKey('field.field_poster', $this->resolver()->tokenTypes('node', 'event'));

    // The dialog shows the stored value; a new use of the field is refused,
    // while sending the stored value back keeps it.
    $this->setUpCurrentUser(permissions: [
      'access content',
      'view media',
      ContentTemplate::ADMIN_PERMISSION,
      'edit canvas metatag',
    ]);
    $state = $this->state('node.event.full', 'event_full');
    self::assertSame('{field.field_poster}', $state['target']['values']['social']['image']);
    self::assertArrayNotHasKey('field.field_poster', $state['tokens']);
    $values = $state['target']['values'];
    $response = $this->putTemplate($template, ['title' => '{title} {field.field_poster}'] + $values);
    self::assertSame(Response::HTTP_UNPROCESSABLE_ENTITY, $response->getStatusCode());
    self::assertSame(['title'], array_keys(self::decodeResponse($response)['error']['fields']));
    $response = $this->putTemplate($template, ['title' => '{title} {sep} Concerts'] + $values);
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    self::assertSame('{field.field_poster}', self::decodeResponse($response)['values']['social']['image']);
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
        // No poster, and no image elsewhere.
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
    self::assertSame('500 g rye flour', self::meta($head)['description']);
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
      'values' => $values,
      'client_instance_id' => self::CLIENT,
      'auto_saves' => [AutoSaveManager::getAutoSaveKey($template) => $auto_save->getClientAutoSaveData($template)],
    ])));
  }

  /**
   * A hidden reference that becomes visible, or is deleted, updates the head.
   *
   * Apart from testHeadless(), whose preview tokens read the Event template
   * as the fixture leaves it.
   */
  public function testHeadlessHiddenReferences(): void {
    $this->enableHeadless();
    $event = ContentTemplate::load('node.event.full');
    self::assertInstanceOf(ContentTemplate::class, $event);
    $values = $event->getThirdPartySetting('canvas_metatag', 'values');
    $event->setThirdPartySetting('canvas_metatag', 'values', ['title' => '{title} at {field.field_venue}'] + $values)->save();
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

    $title = 'Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 at';
    self::assertSame([
      'before' => ['MISS', $title],
      'again' => ['HIT', $title],
      'venue published' => ['MISS', "$title Rehearsal Room B"],
      'venue deleted' => ['MISS', $title],
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
    $this->config('canvas_headless.settings')->set('frontends', [['url' => self::FRONTEND, 'components' => []]])->save();
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
