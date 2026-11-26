<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas_metatag\Controller\ApiController;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Sources;
use Drupal\canvas_metatag\Words;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\language\ConfigurableLanguageManagerInterface;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\node\Entity\Node;
use Drupal\node\NodeInterface;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Kernel\Traits\RequestTrait;
use Drupal\Tests\canvas\Traits\AutoSaveRequestTestTrait;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

// cspell:ignore Kallio Leinonen حداد عمر Garfunkel juin prévu Reporté Annulé
/**
 * Template values composed of typed text, fields and facts.
 *
 * On the complex fixture's events: the head, the dialog's state and writes,
 * words in text, several values, broken parts and cacheability (the specs
 * dynamic-values, head-output and value-links of compose-values-from-fields).
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Resolver::class)]
#[CoversClass(Sources::class)]
#[CoversClass(Words::class)]
#[CoversClass(ApiController::class)]
#[Group('canvas_metatag')]
final class ComposeTest extends CanvasKernelTestBase {

  use AutoSaveRequestTestTrait;
  use ComplexContentTrait;
  use RequestTrait;
  use UserCreationTrait;

  private const CLIENT = '0b6c7f0e-6c1f-4a53-9f0b-1c2f3d4e5a6b';
  private const CITY = 'ℹ︎␜entity:node:event␝field_venue␞␟entity␜␜entity:node:venue␝field_locality␞␟value';
  private const STARTS = 'ℹ︎␜entity:node:event␝field_starts␞␟value';
  private const PERFORMERS = 'ℹ︎␜entity:node:event␝field_performers␞␟entity␜␜entity:node␝title␞␟value';
  private const STATUS = 'ℹ︎␜entity:node:event␝field_event_status␞␟value';
  private const NOTES = 'ℹ︎␜entity:node:event␝field_notes␞␟value';
  private const TITLE = 'Midsummer Night Concert';

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
    'canvas_metatag_count_test',
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
    $this->config('system.date')->set('country.default', 'GB')->save();
    FieldStorageConfig::create(['field_name' => 'field_notes', 'entity_type' => 'node', 'type' => 'string_long'])->save();
    FieldConfig::create([
      'field_name' => 'field_notes',
      'entity_type' => 'node',
      'bundle' => 'event',
      'label' => 'Notes',
    ])->save();
  }

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    self::allowPageCaches($container);
  }

  /**
   * A field link value.
   */
  private static function source(string $expression): array {
    return ['source' => ['expression' => $expression, 'sourceType' => 'entity-field']];
  }

  /**
   * A composition of parts.
   */
  private static function parts(array|string ...$parts): array {
    return ['parts' => array_map(static fn (array|string $part): array => is_string($part) ? ['text' => $part] : $part, $parts)];
  }

  /**
   * Sets values of the live Event template, over what the fixture has.
   */
  private function values(array $values): void {
    $template = ContentTemplate::load('node.event.full');
    \assert($template instanceof ContentTemplate);
    $template->setThirdPartySetting('canvas_metatag', 'values', $values + $template->getThirdPartySetting('canvas_metatag', 'values'))->setStatus(TRUE)->save();
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
   * Requests a path as an anonymous visitor; the response must be a 200.
   */
  private function get(string $path): Response {
    $this->container->get('entity.memory_cache')->deleteAll();
    $response = $this->request(Request::create($path));
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), $path);
    return $response;
  }

  /**
   * The dialog's state for the Event template, previewed with an event.
   */
  private function state(string $node): array {
    $response = $this->request(Request::create('/canvas-metatag/api/state?entity_type=content_template&id=node.event.full&preview=' . $this->complex['node'][$node]));
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    return self::decodeResponse($response);
  }

  /**
   * Writes the Event template's values as the dialog does.
   */
  private function put(array $values): Response {
    $template = ContentTemplate::load('node.event.full');
    \assert($template instanceof ContentTemplate);
    $auto_save = $this->container->get(AutoSaveManager::class);
    return $this->request(Request::create('/canvas-metatag/api/draft/content_template/node.event.full', 'PUT', content: (string) json_encode([
      'values' => (object) $values,
      'client_instance_id' => self::CLIENT,
      'auto_saves' => [AutoSaveManager::getAutoSaveKey($template) => $auto_save->getClientAutoSaveData($template)],
    ])));
  }

  /**
   * Signs in an editor of templates.
   */
  private function editor(): void {
    $this->setUpCurrentUser(permissions: [
      'access content',
      'view media',
      ContentTemplate::ADMIN_PERMISSION,
      AutoSaveManager::PUBLISH_PERMISSION,
      'edit canvas metatag',
    ]);
  }

  /**
   * An event title, description, social title and name, composed.
   *
   * Words go with the field after them, dates read in the item's locale,
   * several performers are joined, and at most two in a title-like place.
   */
  public function testComposedHead(): void {
    $event = $this->node('event_full');
    $event->set('field_performers', [
      $this->complex['node']['person_mira'],
      $this->complex['node']['person_omar'],
      $this->complex['node']['person_empty'],
    ])->set('field_notes', '</script><b>VIP</b> {site}')
      ->set('body', ['value' => '<p>Doors <b>open</b></p>', 'format' => 'canvas_html_block'])
      ->save();
    $body = $this->container->get(Sources::class)->sourceFor('event', 'body', 'words');
    self::assertNotNull($body);
    $template = ContentTemplate::load('node.event.full');
    \assert($template instanceof ContentTemplate);
    $schema = $template->getThirdPartySetting('canvas_metatag', 'values')['schema'];
    $schema['props']['name'] = self::parts(['fact' => 'title'], ' · ', self::source(self::CITY));
    $schema['props']['description'] = self::parts(['fact' => 'description'], ' Free entry.');
    $this->values([
      'title' => self::parts(['fact' => 'title'], ' in ', self::source(self::CITY), ' · ', self::source(self::STARTS)),
      'description' => self::parts(['fact' => 'title'], ' with ', self::source(self::PERFORMERS), ' <3 ', self::source(self::NOTES), ' ', ['source' => $body]),
      'social' => ['title' => self::parts(['fact' => 'title'], ' with ', self::source(self::PERFORMERS))],
      'schema' => $schema,
    ]);

    $response = $this->get($this->complex['path']['event_full']);
    $head = self::readHead($response);
    $meta = self::meta(['meta' => $head['meta']]);
    // An event title: its venue's city and its start date in words.
    self::assertSame([self::TITLE . ' in Helsinki · 19 June 2027 | Events'], $head['titles']);
    // Every performer visitors may see; markup and names in a field are
    // text, a formatted field is made plain, and typed text is never
    // stripped.
    self::assertSame(self::TITLE . ' with Mira Kallio, عمر حداد, Lin Leinonen <3 </script><b>VIP</b> {site} Doors open', $meta['description']);
    // No element is made from them in the head: only escaped text.
    $html = (string) $response->getContent();
    self::assertStringNotContainsString('<b>', substr($html, 0, (int) strpos($html, '</head>')));
    self::assertSame(self::TITLE . ' with Mira Kallio, عمر حداد and 1 more', $meta['og:title']);
    $graph = $head['json_ld'][0]['@graph'];
    $primary = array_values(array_filter($graph, static fn (array $node): bool => ($node['@type'] ?? '') === 'Event'))[0];
    self::assertSame(self::TITLE . ' · Helsinki', $primary['name']);
    // Words after the description: the head's description, as a detail
    // linked to Description alone gives.
    self::assertSame($meta['description'] . ' Free entry.', $primary['description']);
    // Its start in the structured data stays a date with its time.
    self::assertSame('2027-06-19T19:00:00+03:00', $primary['startDate']);

    // A venue visitors may not see and a hidden performer are left out with
    // their words.
    $hidden = self::readHead($this->get($this->complex['path']['event_hidden_refs']));
    self::assertSame(['Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 · 6 February 2027 | Events'], $hidden['titles']);
    self::assertSame('Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮 with Mira Kallio Bring your own instrument. 🎶', self::meta(['meta' => $hidden['meta']])['description']);

    // Every field empty: the default, and none of the words.
    $empty = Node::create([
      'type' => 'event',
      'title' => 'Open day',
      'status' => 1,
      'path' => ['alias' => '/complex/events/open-day'],
    ]);
    $empty->save();
    $head = self::readHead($this->get('/complex/events/open-day'));
    self::assertSame(['Open day | Events'], $head['titles']);
    // The title is a fact every event has: never " with" after it.
    self::assertSame('Open day', self::meta(['meta' => $head['meta']])['description']);
    $this->values(['description' => self::parts('Tickets for ', self::source(self::PERFORMERS), ' in ', self::source(self::CITY))]);
    $head = self::readHead($this->get('/complex/events/open-day'));
    self::assertArrayNotHasKey('description', self::meta(['meta' => $head['meta']]));

    // A lone link to a text list gives its label in text, its key in a
    // choice detail.
    $this->values(['description' => self::source(self::STATUS)]);
    $head = self::readHead($this->get($this->complex['path']['event_full']));
    self::assertSame('On as planned', self::meta(['meta' => $head['meta']])['description']);
    $primary = array_values(array_filter($head['json_ld'][0]['@graph'], static fn (array $node): bool => ($node['@type'] ?? '') === 'Event'))[0];
    self::assertSame('https://schema.org/EventScheduled', $primary['eventStatus']);
  }

  /**
   * Names with markup characters are text, escaped once by the head.
   */
  public function testPlainNames(): void {
    $this->node('person_mira')->setTitle('Simon & Garfunkel')->save();
    $this->node('person_omar')->setTitle("O'Brien")->save();
    $event = $this->node('event_full');
    $event->set('field_performers', [
      $this->complex['node']['person_mira'],
      $this->complex['node']['person_omar'],
      $this->complex['node']['person_empty'],
    ])->save();
    $template = ContentTemplate::load('node.event.full');
    \assert($template instanceof ContentTemplate);
    $schema = $template->getThirdPartySetting('canvas_metatag', 'values')['schema'];
    $schema['props']['name'] = self::parts(['fact' => 'title'], ' with ', self::source(self::PERFORMERS));
    $this->values([
      'social' => ['title' => self::parts(['fact' => 'title'], ' with ', self::source(self::PERFORMERS))],
      'schema' => $schema,
    ]);
    $head = self::readHead($this->get($this->complex['path']['event_full']));
    $names = self::TITLE . " with Simon & Garfunkel, O'Brien and 1 more";
    self::assertSame($names, self::meta(['meta' => $head['meta']])['og:title']);
    $primary = array_values(array_filter($head['json_ld'][0]['@graph'], static fn (array $node): bool => ($node['@type'] ?? '') === 'Event'))[0];
    self::assertSame($names, $primary['name']);
  }

  /**
   * A list label and a date read in the item's language, not the interface's.
   */
  public function testItemLanguage(): void {
    $this->enableModules(['language']);
    $this->installConfig(['language']);
    ConfigurableLanguage::createFromLangcode('fr')->save();
    $languages = $this->container->get('language_manager');
    \assert($languages instanceof ConfigurableLanguageManagerInterface);
    $languages->getLanguageConfigOverride('fr', 'field.storage.node.field_event_status')
      ->set('settings.allowed_values', [['label' => 'Comme prévu'], ['label' => 'Reporté'], ['label' => 'Annulé']])
      ->save();
    $this->values([
      'title' => self::parts(['fact' => 'title'], ' · ', self::source(self::STARTS)),
      'description' => self::parts(['fact' => 'title'], ' : ', self::source(self::STATUS)),
    ]);
    $gala = Node::create([
      'type' => 'event',
      'langcode' => 'fr',
      'title' => 'Gala d’été',
      'status' => 1,
      'field_starts' => '2027-06-19T16:00:00',
      'field_event_status' => 'EventScheduled',
    ]);
    $gala->save();
    $this->container->get('cache.static')->deleteAll();
    // The interface is in English; the event is French.
    self::assertSame('en', $this->container->get('language_manager')->getCurrentLanguage()->getId());
    $head = $this->resolver()->resolve($gala)['head'];
    self::assertSame('Gala d’été · 19 juin 2027 | Events', $head['title']);
    self::assertSame('Gala d’été : Comme prévu', self::meta(['meta' => $head['meta']])['description']);
    // An English event in the same request keeps the English label.
    self::assertSame(self::TITLE . ' : On as planned', self::meta(['meta' => $this->resolver()->resolve($this->node('event_full'))['head']['meta']])['description']);

    // The dialog previewing the French event says the French words.
    $this->editor();
    $this->complex['node']['gala'] = (int) $gala->id();
    $rows = array_column($this->state('gala')['sources'], NULL, 'label');
    self::assertSame('Comme prévu', $rows['Status']['text']);
    self::assertSame('19 juin 2027', $rows['Starts']['text']);
  }

  /**
   * A cut composed title loses whole fields before words.
   */
  public function testCutTitle(): void {
    $this->values([
      'title' => self::parts(['fact' => 'title'], ' in ', self::source(self::CITY), ' · ', self::source(self::STARTS)),
    ]);
    $long = $this->node('event_long');
    $title = $this->resolver()->resolve($long)['head']['title'];
    // The long title and its ending fill the room: the city and the date go
    // whole, then words of the title, never leaving " in" or " ·".
    self::assertStringStartsWith(mb_substr((string) $long->label(), 0, 200), $title);
    self::assertStringNotContainsString('Helsinki', $title);
    self::assertStringNotContainsString('·', $title);
    self::assertStringEndsWith(' first… | Events', $title);
    self::assertStringNotContainsString(' in …', $title);
    self::assertLessThanOrEqual(255, mb_strlen($title));
  }

  /**
   * A composition reads each field once, and asks host access once.
   */
  public function testOneRead(): void {
    $template = ContentTemplate::load('node.event.full');
    \assert($template instanceof ContentTemplate);
    $schema = $template->getThirdPartySetting('canvas_metatag', 'values')['schema'];
    $schema['props']['name'] = self::parts(['fact' => 'title'], ' · ', self::source(self::CITY));
    $this->values([
      'title' => self::parts(['fact' => 'title'], ' in ', self::source(self::CITY)),
      'social' => ['title' => self::parts(['fact' => 'title'], ' in ', self::source(self::CITY))],
      'schema' => $schema,
    ]);
    $event = $this->node('event_full');
    $this->container->get('state')->delete('canvas_metatag_count_test');
    $this->resolver()->resolve($event);
    $counts = $this->container->get('state')->get('canvas_metatag_count_test');
    // The title, the social title and the name each hold Venue › City.
    self::assertSame(1, $counts['field']['field_locality'] ?? 0);
    self::assertSame(1, $counts['node'][(string) $event->id()] ?? 0);
  }

  /**
   * The head depends on every field a composition reads, and on its words.
   */
  public function testCacheability(): void {
    $this->values([
      'title' => self::parts(['fact' => 'title'], ' in ', self::source(self::CITY), ' · ', self::source(self::STARTS)),
    ]);
    $venue = $this->node('venue_hall');
    $venue->set('field_locality', NULL)->save();
    $path = $this->complex['path']['event_full'];
    self::assertSame([self::TITLE . ' · 19 June 2027 | Events'], self::readHead($this->get($path))['titles']);
    self::assertSame('HIT', $this->get($path)->headers->get('X-Drupal-Cache'));
    // A city added later.
    $venue->set('field_locality', 'Helsinki')->save();
    $this->forgetAccess();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame([self::TITLE . ' in Helsinki · 19 June 2027 | Events'], self::readHead($response)['titles']);
    // The site's country changes.
    $this->config('system.date')->set('country.default', 'US')->save();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame([self::TITLE . ' in Helsinki · June 19, 2027 | Events'], self::readHead($response)['titles']);
    // A performer unpublished later.
    $this->values(['description' => self::parts(['fact' => 'title'], ' with ', self::source(self::PERFORMERS))]);
    self::assertSame(self::TITLE . ' with Mira Kallio, عمر حداد', self::meta(['meta' => self::readHead($this->get($path))['meta']])['description']);
    $this->node('person_omar')->setUnpublished()->save();
    $this->forgetAccess();
    $response = $this->get($path);
    self::assertSame('MISS', $response->headers->get('X-Drupal-Cache'));
    self::assertSame(self::TITLE . ' with Mira Kallio', self::meta(['meta' => self::readHead($response)['meta']])['description']);
  }

  /**
   * The dialog shows the server's words and every broken part.
   */
  public function testState(): void {
    $this->editor();
    $state = $this->state('event_full');
    $rows = array_column($state['sources'], NULL, 'label');
    self::assertSame('19 June 2027', $rows['Starts']['text']);
    self::assertSame('On as planned', $rows['Status']['text']);
    self::assertSame('Mira Kallio, عمر حداد', $rows['Performers › Title']['text']);
    self::assertArrayNotHasKey('line', $rows['Performers › Title']);
    // The body, labelled Description: long text, with enough of its start
    // for a description to cut it.
    self::assertTrue($rows['Description']['long']);
    self::assertSame('An evening of new music by the lake. Bring a blanket.', $rows['Description']['part']);
    self::assertMatchesRegularExpression('/^\d{1,2} \w+ \d{4}$/u', $state['facts']['published']['text']);

    // A field that changed kind: it gives no words now.
    $sources = $this->state('event_full')['sources'];
    $words = ['text', 'date', 'number'];
    $image = array_values(array_filter($sources, static fn (array $row): bool => !array_intersect($words, $row['kinds']) && !$row['hop']))[0];
    $this->values(['title' => self::parts(['fact' => 'title'], ' · ', ['source' => $image['source']])]);
    $this->container->get('cache.static')->deleteAll();
    $state = $this->state('event_full');
    $kind = ['path' => 'title', 'part' => 2, 'field' => $image['field'], 'reason' => 'kind'];
    self::assertSame($kind, $state['broken']['title.parts.2'] ?? NULL);
    self::assertStringStartsWith(self::TITLE . ' | ', $state['resolved']['head']['title']);
    // A deleted field in a composed title: the part is listed, the words
    // around it stay savable, a new unknown field is refused.
    $title = self::parts(['fact' => 'title'], ' in ', self::source(self::NOTES));
    self::assertSame(Response::HTTP_OK, $this->put(['title' => $title])->getStatusCode());
    FieldConfig::loadByName('node', 'event', 'field_notes')?->delete();
    $this->container->get('cache.static')->deleteAll();
    $state = $this->state('event_full');
    self::assertSame(['path' => 'title', 'part' => 2, 'field' => 'field_notes', 'reason' => 'missing'], $state['broken']['title.parts.2'] ?? NULL);
    // Each event's title leaves it out with its words.
    self::assertStringStartsWith(self::TITLE . ' | ', $state['resolved']['head']['title']);
    $at = self::parts(['fact' => 'title'], ' at ', self::source(self::NOTES));
    $response = $this->put(['title' => $at]);
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    self::assertSame($at, self::decodeResponse($response)['values']['title']);
    $response = $this->put(['title' => self::parts(['fact' => 'title'], ' at ', self::source('ℹ︎␜entity:node:event␝field_nope␞␟value'))]);
    self::assertSame(Response::HTTP_UNPROCESSABLE_ENTITY, $response->getStatusCode());
    self::assertSame('Choose a field from the list.', self::decodeResponse($response)['error']['fields']['title']);
    // The title ending never composes.
    $response = $this->put(['title_end' => self::parts(['fact' => 'site'], ' x')]);
    self::assertSame('This setting is not available here.', self::decodeResponse($response)['error']['fields']['title_end']);
    // A whole value sent back with its keys in another order is carried.
    $reordered = ['sourceType' => 'entity-field', 'expression' => self::NOTES];
    $response = $this->put(['title' => ['parts' => [['fact' => 'title'], ['text' => ' at '], ['source' => $reordered]]]]);
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    // Text added to a title already at its limit is refused, not cut back to
    // the stored title and carried as if nothing changed.
    $full = self::parts(['fact' => 'title'], str_repeat('a', 255));
    $this->values(['title' => $full]);
    $response = $this->put(['title' => self::parts(['fact' => 'title'], str_repeat('a', 256))]);
    self::assertSame(Response::HTTP_UNPROCESSABLE_ENTITY, $response->getStatusCode());
    self::assertSame('Use at most 255 characters.', self::decodeResponse($response)['error']['fields']['title']);
    // Sent back unchanged, it saves.
    self::assertSame(Response::HTTP_OK, $this->put(['title' => $full])->getStatusCode());
  }

  /**
   * A stored source the type can still read stays where it fits, only.
   *
   * A title linked whole to a long text keeps it; that long text is never
   * a part of the title (dynamic-values "Where composition is refused"),
   * however it is sent.
   */
  public function testStoredSourceAsPart(): void {
    $this->editor();
    $body = array_column($this->state('event_full')['sources'], NULL, 'label')['Description']['source'];
    $this->values(['title' => ['source' => $body]]);
    // Saved again whole: carried.
    $response = $this->put(['title' => ['source' => $body]]);
    self::assertSame(Response::HTTP_OK, $response->getStatusCode(), (string) $response->getContent());
    // As a part of the title: refused.
    $response = $this->put(['title' => self::parts(['fact' => 'title'], ' – ', ['source' => $body])]);
    self::assertSame(Response::HTTP_UNPROCESSABLE_ENTITY, $response->getStatusCode());
    self::assertSame('Choose a field from the list.', self::decodeResponse($response)['error']['fields']['title']);
    // Imported that way all the same: the dialog lists the part as broken,
    // as saving reads it, so it can be replaced.
    $this->values(['title' => self::parts(['fact' => 'title'], ' – ', ['source' => $body])]);
    $this->container->get('cache.static')->deleteAll();
    self::assertSame(['path' => 'title', 'part' => 2, 'field' => 'body', 'reason' => 'kind'], $this->state('event_full')['broken']['title.parts.2'] ?? NULL);
    // Linked whole, the same long text still fits.
    $this->values(['title' => ['source' => $body]]);
    $this->container->get('cache.static')->deleteAll();
    self::assertArrayNotHasKey('title', $this->state('event_full')['broken']);
  }

  /**
   * Outside text a field gives its first item; typed braces stay text.
   */
  public function testFirstItemAndTypedBraces(): void {
    $event = $this->node('event_full');
    $event->set('field_performers', [
      $this->complex['node']['person_mira'],
      $this->complex['node']['person_omar'],
    ])->save();
    // A multi-value list on a choice detail.
    FieldStorageConfig::create([
      'field_name' => 'field_statuses',
      'entity_type' => 'node',
      'type' => 'list_string',
      'settings' => [
        'allowed_values' => ['EventScheduled' => 'On as planned', 'EventPostponed' => 'Moved to a later date'],
      ],
      'cardinality' => -1,
    ])->save();
    FieldConfig::create([
      'field_name' => 'field_statuses',
      'entity_type' => 'node',
      'bundle' => 'event',
      'label' => 'Statuses',
    ])->save();
    $this->node('event_full')->set('field_statuses', ['EventPostponed', 'EventScheduled'])->save();
    $template = ContentTemplate::load('node.event.full');
    \assert($template instanceof ContentTemplate);
    $schema = $template->getThirdPartySetting('canvas_metatag', 'values')['schema'];
    $schema['props']['eventStatus'] = self::source('ℹ︎␜entity:node:event␝field_statuses␞␟value');
    $this->values([
      // Braces typed inside a composition are text, never a field.
      'title' => self::parts(['fact' => 'title'], ' {field.field_city}'),
      // The ending is no text that composes: the first performer.
      'title_end' => self::source(self::PERFORMERS),
      'schema' => $schema,
    ]);
    $head = self::readHead($this->get($this->complex['path']['event_full']));
    self::assertSame([self::TITLE . ' {field.field_city} | Mira Kallio'], $head['titles']);
    $primary = array_values(array_filter($head['json_ld'][0]['@graph'], static fn (array $node): bool => ($node['@type'] ?? '') === 'Event'))[0];
    self::assertSame('https://schema.org/EventPostponed', $primary['eventStatus']);
  }

  /**
   * A product's name composed of its brand and its title.
   */
  public function testProductName(): void {
    FieldStorageConfig::create(['field_name' => 'field_brand', 'entity_type' => 'node', 'type' => 'string'])->save();
    FieldConfig::create([
      'field_name' => 'field_brand',
      'entity_type' => 'node',
      'bundle' => 'product',
      'label' => 'Brand',
    ])->save();
    $this->node('product_lamp')->set('field_brand', 'Lumo')->save();
    $product = ContentTemplate::load('node.product.full');
    \assert($product instanceof ContentTemplate);
    $values = $product->getThirdPartySetting('canvas_metatag', 'values');
    $values['schema']['props']['name'] = self::parts(self::source('ℹ︎␜entity:node:product␝field_brand␞␟value'), ' ', ['fact' => 'title']);
    $product->setThirdPartySetting('canvas_metatag', 'values', $values)->save();
    $name = function (string $key): string {
      $graph = self::readHead($this->get((string) $this->node($key)->toUrl()->toString()))['json_ld'][0]['@graph'];
      return array_values(array_filter($graph, static fn (array $node): bool => ($node['@type'] ?? '') === 'Product'))[0]['name'];
    };
    self::assertSame('Lumo Oak desk lamp', $name('product_lamp'));
    // A product without a brand: its title, with no space before it.
    self::assertSame((string) $this->node('product_rtl')->label(), $name('product_rtl'));
  }

}
