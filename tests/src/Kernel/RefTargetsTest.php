<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\SchemaGraph;
use Drupal\canvas_metatag\Sources;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\language\ConfigurableLanguageManagerInterface;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\node\Entity\Node;
use Drupal\node\NodeInterface;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

// cspell:ignore Kallio Mannerheimintie Kungsgatan Ruisleipä Finlande Suède
// cspell:ignore Émirats arabes unis
/**
 * Every type, populated end to end on the complex fixture's content.
 *
 * Templates link the fixture's fields (references to venues and people,
 * multi-value text, decimals, formatted text); Canvas pages type values and
 * pick a venue page. Each graph is what a visitor's head carries, read by
 * the resolver: references point at the target's main node, or name it, or
 * leave out what visitors may not see.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Resolver::class)]
#[CoversClass(Sources::class)]
#[CoversClass(SchemaGraph::class)]
#[Group('canvas_metatag')]
final class RefTargetsTest extends CanvasKernelTestBase {

  use ComplexContentTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'node',
    'field',
    'taxonomy',
    'canvas_metatag',
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
   * A field link on a content type.
   */
  private static function link(string $bundle, string $path): array {
    return ['source' => ['expression' => "ℹ︎␜entity:node:{$bundle}␝{$path}", 'sourceType' => 'entity-field']];
  }

  /**
   * Describes a content type: its full template's structured data.
   */
  private static function describe(string $bundle, array $schema): void {
    $template = ContentTemplate::load("node.$bundle.full") ?? ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => $bundle,
      'content_entity_type_view_mode' => 'full',
      'component_tree' => [],
    ]);
    \assert($template instanceof ContentTemplate);
    $values = $template->getThirdPartySetting('canvas_metatag', 'values') ?? [];
    $template->setThirdPartySetting('canvas_metatag', 'values', ['schema' => $schema] + $values);
    $template->setStatus(TRUE)->save();
  }

  /**
   * The resolver's report of an entity: its graph's nodes by id suffix.
   *
   * @return array{0: array<string, array>, 1: array}
   *   The nodes ("primary", "webpage" and so on), and the report.
   */
  private function read(NodeInterface|Page $entity): array {
    $result = $this->container->get(Resolver::class)->report($entity);
    $nodes = [];
    foreach ($result['head']['script'][0]['textContent']['@graph'] as $node) {
      $nodes[substr($node['@id'], strrpos($node['@id'], '#') + 1)] = $node;
    }
    return [$nodes, $result['schema']];
  }

  /**
   * A fixture node, as stored.
   */
  private function node(string $key): NodeInterface {
    $node = Node::load($this->complex['node'][$key]);
    \assert($node instanceof NodeInterface);
    return $node;
  }

  /**
   * The public URL of a fixture node.
   */
  private function url(string $key): string {
    return 'http://localhost' . $this->complex['path'][$key];
  }

  /**
   * A referenced page's composed details are read with its own facts.
   *
   * Structured-data "A venue's composed address on an event" and "The
   * venue's own title".
   */
  public function testComposedDetails(): void {
    $fresh = fn (string $key): NodeInterface => $this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($this->complex['node'][$key]);
    self::describe('event', [
      'type' => 'Event',
      'props' => [
        'startDate' => self::link('event', 'field_starts␞␟value'),
        'location' => self::link('event', 'field_venue␞␟entity␜␜entity:node␝title␞␟value'),
      ],
    ]);
    $address = [
      'address_postalCode' => self::link('venue', 'field_postal_code␞␟value'),
      'address_addressLocality' => self::link('venue', 'field_locality␞␟value'),
      'address_addressCountry' => self::link('venue', 'field_country␞␟value'),
    ];
    // A street address from two fields.
    self::describe('venue', [
      'type' => 'LocalBusiness',
      'props' => $address + [
        'placeKind' => ['text' => 'EventVenue'],
        'address_streetAddress' => [
          'parts' => [
            self::link('venue', 'field_street␞␟value'),
            ['text' => ', PO '],
            self::link('venue', 'field_postal_code␞␟value'),
          ],
        ],
      ],
    ]);
    [$hall] = $this->read($this->node('venue_hall'));
    self::assertSame('Mannerheimintie 13e, PO 00100', $hall['primary']['address']['streetAddress']);
    [$event] = $this->read($fresh('event_full'));
    self::assertSame('Mannerheimintie 13e, PO 00100', $event['primary']['location']['address']['streetAddress']);

    // The venue's own title, never the event's.
    self::describe('venue', [
      'type' => 'LocalBusiness',
      'props' => $address + [
        'placeKind' => ['text' => 'EventVenue'],
        'address_streetAddress' => [
          'parts' => [['fact' => 'title'], ['text' => ', '], self::link('venue', 'field_street␞␟value')],
        ],
      ],
    ]);
    [$event] = $this->read($fresh('event_full'));
    self::assertSame('Lakeside Concert Hall, Mannerheimintie 13e', $event['primary']['location']['address']['streetAddress']);

    // In the referencing page's language: a French event reads the venue's
    // country label in French, though the venue has no translation.
    $this->enableModules(['language']);
    $this->installConfig(['language']);
    ConfigurableLanguage::createFromLangcode('fr')->save();
    $languages = $this->container->get('language_manager');
    \assert($languages instanceof ConfigurableLanguageManagerInterface);
    $languages->getLanguageConfigOverride('fr', 'field.storage.node.field_country')
      ->set('settings.allowed_values', [
        ['label' => 'Finlande'],
        ['label' => 'Suède'],
        ['label' => 'Émirats arabes unis'],
      ])
      ->save();
    self::describe('venue', [
      'type' => 'LocalBusiness',
      'props' => $address + [
        'placeKind' => ['text' => 'EventVenue'],
        'address_streetAddress' => [
          'parts' => [
            self::link('venue', 'field_street␞␟value'),
            ['text' => ', '],
            self::link('venue', 'field_country␞␟value'),
          ],
        ],
      ],
    ]);
    $english = $fresh('event_full');
    $english->addTranslation('fr', [
      'title' => 'Concert de la Saint-Jean',
      'status' => 1,
      'field_venue' => $english->get('field_venue')->getValue(),
      'field_starts' => $english->get('field_starts')->getValue(),
    ])->save();
    $this->container->get('cache.static')->deleteAll();
    [$event] = $this->read($fresh('event_full'));
    self::assertSame('Mannerheimintie 13e, Finland', $event['primary']['location']['address']['streetAddress']);
    [$event] = $this->read($fresh('event_full')->getTranslation('fr'));
    self::assertSame('Mannerheimintie 13e, Finlande', $event['primary']['location']['address']['streetAddress']);
  }

  /**
   * Places, events, people, jobs and recipes linked through their fields.
   */
  public function testTemplates(): void {
    $fresh = fn (string $key): NodeInterface => $this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($this->complex['node'][$key]);
    $event_props = [
      'startDate' => self::link('event', 'field_starts␞␟value'),
      'endDate' => self::link('event', 'field_ends␞␟value'),
      'location' => self::link('event', 'field_venue␞␟entity␜␜entity:node␝title␞␟value'),
      'performer' => self::link('event', 'field_performers␞␟entity␜␜entity:node␝title␞␟value'),
      'organizer' => ['fact' => 'identity'],
      'eventStatus' => self::link('event', 'field_event_status␞␟value'),
      'offers_url' => self::link('event', 'field_tickets␞␟uri'),
    ];
    // Before venues are described, an event names its venue; describing
    // them later rebuilds its head: the template list is among its tags.
    self::describe('event', ['type' => 'Event', 'props' => $event_props]);
    $named = $this->container->get(Resolver::class)->resolve($fresh('event_full'));
    $graph = array_column($named['head']['script'][0]['textContent']['@graph'], NULL, '@type');
    self::assertSame(['@type' => 'Place', 'name' => 'Lakeside Concert Hall'], $graph['Event']['location']);
    self::assertContains('config:content_template_list', $named['cacheability']->getCacheTags());

    // Venues are places people visit, their address in separate fields.
    self::describe('venue', [
      'type' => 'LocalBusiness',
      'props' => [
        'placeKind' => ['text' => 'EventVenue'],
        'address_streetAddress' => self::link('venue', 'field_street␞␟value'),
        'address_postalCode' => self::link('venue', 'field_postal_code␞␟value'),
        'address_addressLocality' => self::link('venue', 'field_locality␞␟value'),
        'address_addressCountry' => self::link('venue', 'field_country␞␟value'),
        'openingHoursSpecification' => ['text' => 'Tu-Su 10:00-22:00'],
      ],
    ]);
    [$hall, $report] = $this->read($this->node('venue_hall'));
    self::assertSame('EventVenue', $hall['primary']['@type']);
    self::assertSame([
      '@type' => 'PostalAddress',
      'streetAddress' => 'Mannerheimintie 13e',
      'postalCode' => '00100',
      'addressLocality' => 'Helsinki',
      'addressCountry' => 'FI',
    ], $hall['primary']['address']);
    self::assertSame([['feature' => NULL, 'node' => NULL, 'verdict' => 'none']], $report['features']);

    // An event: its venue and performers are their pages' main things.
    [$event, $report] = $this->read($fresh('event_full'));
    self::assertSame([
      '@id' => $this->url('venue_hall') . '#primary',
      '@type' => 'EventVenue',
      'name' => 'Lakeside Concert Hall',
      'url' => $this->url('venue_hall'),
      'address' => $hall['primary']['address'],
    ], $event['primary']['location']);
    // Profiles are people: Mira's page is its main thing, a person.
    self::assertSame([$this->url('person_mira') . '#primary', 'Person', 'Mira Kallio'], [
      $event['primary']['performer'][0]['@id'],
      $event['primary']['performer'][0]['@type'],
      $event['primary']['performer'][0]['name'],
    ]);
    self::assertCount(2, $event['primary']['performer']);
    self::assertSame(['@id' => 'http://localhost/#identity'], $event['primary']['organizer']);
    self::assertSame('event', $report['features'][0]['feature']);
    self::assertSame('ready', $report['features'][0]['verdict']);
    // The venue's page changes, and so does every event that points at it.
    $result = $this->container->get(Resolver::class)->resolve($this->node('event_full'));
    self::assertContains('node:' . $this->complex['node']['venue_hall'], $result['cacheability']->getCacheTags());
    // A kind of place linked to a field that gives no listed kind is a local
    // business, as the venue's own page says it is: never the field's text.
    $describedAs = static fn (string $kind) => self::describe('venue', [
      'type' => 'LocalBusiness',
      'props' => [
        'placeKind' => $kind === '' ? self::link('venue', 'field_locality␞␟value') : ['text' => $kind],
        'address_streetAddress' => self::link('venue', 'field_street␞␟value'),
        'address_addressLocality' => self::link('venue', 'field_locality␞␟value'),
        'address_addressCountry' => self::link('venue', 'field_country␞␟value'),
      ],
    ]);
    $describedAs('');
    self::assertSame('LocalBusiness', $this->read($fresh('event_full'))[0]['primary']['location']['@type']);
    self::assertSame('LocalBusiness', $this->read($fresh('venue_hall'))[0]['primary']['@type']);
    $describedAs('EventVenue');

    // Hidden references: an unpublished venue and performer are never named.
    [$hidden, $report] = $this->read($this->node('event_hidden_refs'));
    self::assertArrayNotHasKey('primary', $hidden);
    self::assertSame(['location'], $report['withheld']['missing']);
    self::assertContains(['key' => 'location', 'count' => 1, 'reason' => 'hidden'], $report['dropped_items']);
    self::assertContains(['key' => 'performer', 'count' => 1, 'reason' => 'hidden'], $report['dropped_items']);
    self::assertStringNotContainsString('Unannounced guest', (string) json_encode($hidden));
    self::assertStringNotContainsString('Rehearsal Room B', (string) json_encode($hidden));

    // A profile's links elsewhere: every one, in order.
    [$mira] = $this->read($this->node('person_mira'));
    self::assertSame(['https://mira.example.org', 'https://social.example.net/@mira'], $mira['primary']['sameAs']);

    // A job: its description filtered, its workplace with its address, its
    // pay read exactly from a decimal field.
    self::describe('job_posting', [
      'type' => 'JobPosting',
      'props' => [
        'description' => self::link('job_posting', 'body␞␟value'),
        'validThrough' => self::link('job_posting', 'field_valid_through␞␟value'),
        'employmentType' => self::link('job_posting', 'field_employment_type␞␟value'),
        'hiringOrganization' => ['fact' => 'identity'],
        'work' => ['text' => 'onsite'],
        'jobLocation' => self::link('job_posting', 'field_location␞␟entity␜␜entity:node␝title␞␟value'),
        'baseSalary_value_minValue' => self::link('job_posting', 'field_salary␞␟value'),
        'baseSalary_value_unitText' => self::link('job_posting', 'field_salary_unit␞␟value'),
        'baseSalary_currency' => ['text' => 'EUR'],
      ],
    ]);
    [$job, $report] = $this->read($this->node('job_developer'));
    self::assertSame('<p>Build editorial tools with a small team.</p>', $job['primary']['description']);
    self::assertSame('FULL_TIME', $job['primary']['employmentType']);
    self::assertSame('Example office', $job['primary']['jobLocation']['name']);
    self::assertSame('SE', $job['primary']['jobLocation']['address']['addressCountry']);
    self::assertSame(['@type' => 'QuantitativeValue', 'value' => 5200, 'unitText' => 'MONTH'], $job['primary']['baseSalary']['value']);
    self::assertSame('ready', $report['features'][0]['verdict']);
    // A closed job still ships, and reads as closed.
    [$expired, $report] = $this->read($this->node('job_expired'));
    self::assertSame('JobPosting', $expired['primary']['@type']);
    // Its one employment type, from the single-value list field.
    self::assertSame('PART_TIME', $expired['primary']['employmentType']);
    self::assertSame([
      'feature' => 'job-posting',
      'node' => $this->url('job_expired') . '#primary',
      'verdict' => 'closed',
      'date' => '2026-01-15',
    ], $report['features'][0]);

    // A recipe: ingredients and steps from multi-value fields, times in
    // minutes.
    self::describe('recipe', [
      'type' => 'Recipe',
      'props' => [
        'image' => self::link('recipe', 'field_image␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}'),
        'author' => ['fact' => 'identity'],
        'prepTime' => self::link('recipe', 'field_prep_minutes␞␟value'),
        'cookTime' => self::link('recipe', 'field_cook_minutes␞␟value'),
        'recipeYield' => self::link('recipe', 'field_yield␞␟value'),
        'recipeIngredient' => self::link('recipe', 'field_ingredients␞␟value'),
        'recipeInstructions' => self::link('recipe', 'field_steps␞␟value'),
      ],
    ]);
    [$recipe, $report] = $this->read($this->node('recipe_bread'));
    self::assertSame(['500 g rye flour', '500 ml water', '100 g sourdough starter', '10 g salt'], $recipe['primary']['recipeIngredient']);
    self::assertSame([
      ['@type' => 'HowToStep', 'text' => 'Mix the flour, water and starter; leave overnight.'],
      ['@type' => 'HowToStep', 'text' => 'Add the salt, shape and proof for 2 hours.'],
      ['@type' => 'HowToStep', 'text' => 'Bake at 250 °C for 50 minutes.'],
    ], $recipe['primary']['recipeInstructions']);
    self::assertSame(['PT20M', 'PT50M'], [$recipe['primary']['prepTime'], $recipe['primary']['cookTime']]);
    self::assertSame('ready', $report['features'][0]['verdict']);
    // Steps from one formatted text: its list items.
    $bread = $fresh('recipe_bread');
    $bread->set('body', [
      'value' => '<p>Start the day before.</p><ol><li>Preheat</li><li>Mix</li></ol>',
      'format' => 'canvas_html_block',
    ])->save();
    self::describe('recipe', [
      'type' => 'Recipe',
      'props' => ['recipeInstructions' => self::link('recipe', 'body␞␟value')],
    ]);
    self::assertSame([
      ['@type' => 'HowToStep', 'text' => 'Preheat'],
      ['@type' => 'HowToStep', 'text' => 'Mix'],
    ], $this->read($fresh('recipe_bread'))[0]['primary']['recipeInstructions']);

    // A product: its price read exactly from a decimal field. Canvas offers
    // no list of images from a media gallery (ARCHITECTURE.md §11): the
    // product's image is its Image fact, the gallery's first.
    self::describe('product', [
      'type' => 'Product',
      'props' => [
        'offers_price' => self::link('product', 'field_price␞␟value'),
        'offers_priceCurrency' => self::link('product', 'field_currency␞␟value'),
        'sold_here' => ['text' => 'yes'],
      ],
    ]);
    [$lamp] = $this->read($this->node('product_lamp'));
    self::assertSame(['@id' => $this->url('product_lamp') . '#primaryimage'], $lamp['primary']['image']);
    self::assertSame('89', $lamp['primary']['offers']['price']);
  }

  /**
   * Canvas pages: typed values, the venue typed part by part.
   *
   * A venue page picked by the editor comes with the page picker
   * (link-groups-and-pick-pages).
   */
  public function testPages(): void {
    $page = static function (string $title, array $schema): Page {
      $page = Page::create([
        'title' => $title,
        'status' => 1,
        'canvas_metatag' => json_encode(['schema' => $schema], JSON_THROW_ON_ERROR),
      ]);
      $page->save();
      return $page;
    };
    [$event, $report] = $this->read($page('Midsummer', [
      'type' => 'Event',
      'props' => [
        'startDate' => ['text' => '2027-06-19T19:00'],
        'location_name' => ['text' => 'Lakeside Concert Hall'],
        'location_address_addressLocality' => ['text' => 'Helsinki'],
        'location_address_addressCountry' => ['text' => 'FI'],
        'offers_price' => ['text' => '25'],
        'offers_priceCurrency' => ['text' => 'EUR'],
        'offers_availability' => ['text' => 'PreOrder'],
        'offers_validFrom' => ['text' => '2027-01-10'],
      ],
    ]));
    self::assertSame('Lakeside Concert Hall', $event['primary']['location']['name']);
    self::assertSame('Helsinki', $event['primary']['location']['address']['addressLocality']);
    self::assertSame('https://schema.org/PreOrder', $event['primary']['offers']['availability']);
    // Nobody set the organizer: the site, by default, and said.
    self::assertSame(['@id' => 'http://localhost/#identity'], $event['primary']['organizer']);
    self::assertSame(['organizer'], $report['defaults']);
    // A place, a recipe and a course, typed.
    [$place, $report] = $this->read($page('Lakeside Café', [
      'type' => 'LocalBusiness',
      'props' => [
        'placeKind' => ['text' => 'CafeOrCoffeeShop'],
        'address_streetAddress' => ['text' => 'Mannerheimintie 13e'],
        'address_addressLocality' => ['text' => 'Helsinki'],
        'address_addressCountry' => ['text' => 'FI'],
        'openingHoursSpecification' => ['text' => 'Mo-Fr 08:00-18:00'],
        'telephone' => ['text' => '+358 9 123 4567'],
      ],
    ]));
    self::assertSame('CafeOrCoffeeShop', $place['primary']['@type']);
    self::assertSame('ready', $report['features'][0]['verdict']);
    [$recipe, $report] = $this->read($page('Rye bread', [
      'type' => 'Recipe',
      'props' => [
        'prepTime' => ['text' => '20'],
        'cookTime' => ['text' => '50'],
        'recipeYield' => ['text' => '1 loaf'],
      ],
    ]));
    self::assertSame(['PT20M', 'PT50M'], [$recipe['primary']['prepTime'], $recipe['primary']['cookTime']]);
    self::assertSame(['@id' => 'http://localhost/#identity'], $recipe['primary']['author']);
    [$course, $report] = $this->read($page('Drupal basics', ['type' => 'Course']));
    self::assertSame(['@id' => 'http://localhost/#identity'], $course['primary']['provider']);
    self::assertSame('elsewhere', $report['features'][0]['verdict']);
  }

  /**
   * A list page of courses counts the complete ones it links.
   */
  public function testCourseList(): void {
    // Articles described as courses, listed from an announcement.
    self::describe('article', ['type' => 'Course']);
    FieldStorageConfig::create([
      'field_name' => 'field_courses',
      'entity_type' => 'node',
      'type' => 'entity_reference',
      'settings' => ['target_type' => 'node'],
      'cardinality' => -1,
    ])->save();
    FieldConfig::create([
      'field_name' => 'field_courses',
      'entity_type' => 'node',
      'bundle' => 'announcement',
      'label' => 'Courses',
    ])->save();
    $this->container->get('entity_display.repository')->getFormDisplay('node', 'announcement')->setComponent('field_courses')->save();
    $course = static function (string $title, string $body = '', int $status = 1): int {
      $node = Node::create([
        'type' => 'article',
        'title' => $title,
        'status' => $status,
        'body' => $body === '' ? [] : ['value' => "<p>$body</p>", 'format' => 'plain_text'],
      ]);
      $node->save();
      return (int) $node->id();
    };
    $ids = [
      $course('Drupal basics', 'Build your first site.'),
      $course('Site building', 'Content types and views.'),
      $course('Theming'),
      $course('Accessibility', 'Pages for everyone.', 0),
      $course('Content modelling', 'Fields that fit.'),
    ];
    self::describe('announcement', [
      'type' => 'CollectionPage',
      'props' => [
        'items' => self::link('announcement', 'field_courses␞␟entity␜␜entity:node␝title␞␟value'),
      ],
    ]);
    $list = Node::create(['type' => 'announcement', 'title' => 'All courses', 'status' => 1, 'field_courses' => $ids]);
    $list->save();
    [$nodes, $report] = $this->read($list);
    self::assertSame('ItemList', $nodes['webpage']['mainEntity']['@type']);
    self::assertSame([1, 2, 3, 4], array_column($nodes['webpage']['mainEntity']['itemListElement'], 'position'));
    self::assertSame([
      'feature' => 'course-list',
      'node' => 'http://localhost/node/' . $list->id() . '#webpage',
      'verdict' => 'ready',
      'count' => 3,
      'of' => 4,
    ], $report['features'][0]);

    // More pages than a list emits: only the hundred it emits are read, the
    // rest are counted, and their pages are not among the head's tags.
    $more = array_map(static fn (int $n): int => $course("Course $n", 'A summary.'), range(1, 100));
    $list->set('field_courses', [...$ids, ...$more])->save();
    // A new object: the resolver keeps a result per entity for the request.
    $list = $this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($list->id());
    \assert($list instanceof NodeInterface);
    [$nodes, $report] = $this->read($list);
    self::assertCount(100, $nodes['webpage']['mainEntity']['itemListElement']);
    self::assertContains(['key' => 'items', 'count' => 1, 'reason' => 'hidden'], $report['dropped_items']);
    self::assertContains(['key' => 'items', 'count' => 4, 'reason' => 'max'], $report['dropped_items']);
    $tags = $this->container->get(Resolver::class)->resolve($list)['cacheability']->getCacheTags();
    self::assertContains('node:' . $more[95], $tags);
    self::assertNotContains('node:' . $more[96], $tags);
  }

}
