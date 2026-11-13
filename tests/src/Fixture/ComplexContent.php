<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Fixture;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\JavaScriptComponent;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\File\FileSystemInterface;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\link\LinkItemInterface;
use Drupal\node\Entity\NodeType;
use Drupal\taxonomy\Entity\Vocabulary;
use Drupal\user\Entity\User;

// cspell:ignore Kallio Haddad Martín Leinonen Mannerheimintie Ruisleipä
// cspell:ignore شقشوقة שקשוקה مصباح مكتب عمر حداد صورة ملحن وعازف عود يكتب
// cspell:ignore للأوركسترا والفرق الصغيرة ضوء دافئ للقراءة الليلية
// cspell:ignore עגבניות ביצים פלפל שום מבשלים רוטב שוברים ביצה
// cspell:ignore Leinikki Helsingfors Kaartinkaupunki
/**
 * Complex content for scenario tests and demos: many types, many shapes.
 *
 * Node types Venue, Person, Event, Product, Recipe, Job posting and
 * Announcement (owned by the fixture), plus Article nodes on an Article type
 * that is created only when missing. Core image fields and image media;
 * single and multi-value references with hidden targets; text lists whose
 * labels differ from their keys; very long, emoji and right-to-left text;
 * empty optional fields. Canvas content templates built from the components
 * in `tests/fixtures/complex/components.json`, with props linked to fields
 * and through references, a teaser template, a template that was never
 * published, a template whose draft differs from what is live, a type with no
 * nodes and an unpublished node to preview with.
 *
 * Every entity has a fixed UUID, so install() is idempotent: content that
 * exists is kept, templates and their drafts are reset to the fixture's
 * state. teardown() removes what install() created and nothing else.
 *
 * The SEO values of the templates are in the stored form of today (brace
 * dynamic values). A change that converts stored values updates them here.
 *
 * Only core modules and Canvas: node, field, text, options, link, datetime,
 * image, file, media, taxonomy, path. Not used, because the farm site does
 * not enable them: datetime_range (Event has a start and an end field
 * instead), language (no translations), and field_test (the field
 * `field_no_view_access` is hidden from visitors only where a test enables
 * it).
 *
 * Run on a site with `drush php:script tests/fixtures/complex/install.php`
 * and `teardown.php`; in kernel tests through ComplexContentTrait.
 *
 * @see \Drupal\Tests\canvas_metatag\Kernel\ComplexContentTrait
 */
final class ComplexContent {

  /**
   * Node types the fixture owns, by machine name.
   */
  public const TYPES = [
    'venue' => 'Venue',
    'person' => 'Person',
    'event' => 'Event',
    'product' => 'Product',
    'recipe' => 'Recipe',
    'job_posting' => 'Job posting',
    'announcement' => 'Announcement',
  ];

  /**
   * The vocabulary the fixture owns.
   */
  public const VOCABULARY = 'product_category';

  /**
   * The editor client id of the Event template's draft.
   */
  public const CLIENT_ID = 'complex-fixture-editor';

  /**
   * The directory of the fixture's image files.
   */
  public const DIRECTORY = 'public://canvas-metatag-complex';

  /**
   * The text format of HTML props and formatted text fields.
   *
   * The one Canvas ships, so bodies render on any site Canvas runs on.
   */
  private const HTML = 'canvas_html_block';

  /**
   * Components the templates use; see components.json.
   */
  public const COMPONENTS = ['section', 'grid', 'heading', 'paragraph', 'card', 'image-feature'];

  /**
   * Fields per bundle.
   *
   * Name => [type, label, storage settings, settings, cardinality, required].
   * A type `target_type:bundle` is an entity reference; the storage settings
   * of a text list are its allowed values, key => label. Storages are shared
   * by name; `body` and `field_image` are those of a standard Article type.
   *
   * Canvas links a required prop only to a required field, and a single-value
   * prop only to a single-value field or a reference, so the image fields the
   * templates show are required.
   */
  private const FIELDS = [
    'venue' => [
      'body' => ['text_with_summary', 'About the venue'],
      'field_street' => ['string', 'Street address'],
      'field_postal_code' => ['string', 'Postal code'],
      'field_locality' => ['string', 'City'],
      'field_country' => ['list_string', 'Country', [
        'FI' => 'Finland',
        'SE' => 'Sweden',
        'AE' => 'United Arab Emirates',
      ],
      ],
    ],
    'person' => [
      'body' => ['text_with_summary', 'Biography'],
      'field_role' => ['string', 'Role'],
      'field_photo' => ['media:image', 'Photo', [], [], 1, TRUE],
      'field_links' => ['link', 'Profiles', [], [], -1],
    ],
    'event' => [
      'body' => ['text_with_summary', 'Description'],
      'field_starts' => ['datetime', 'Starts', ['datetime_type' => 'datetime']],
      'field_ends' => ['datetime', 'Ends', ['datetime_type' => 'datetime']],
      'field_venue' => ['node:venue', 'Venue'],
      'field_performers' => ['node:person', 'Performers', [], [], -1],
      'field_tickets' => ['link', 'Tickets'],
      'field_poster' => ['media:image', 'Poster'],
      // The keys are what structured data needs; the labels are not.
      'field_event_status' => ['list_string', 'Status', [
        'EventScheduled' => 'On as planned',
        'EventPostponed' => 'Moved to a later date',
        'EventCancelled' => 'Called off',
      ],
      ],
    ],
    'product' => [
      'body' => ['text_with_summary', 'Description'],
      'field_price' => ['decimal', 'Price', ['precision' => 10, 'scale' => 2]],
      'field_currency' => ['list_string', 'Currency', [
        'EUR' => 'Euro (€)',
        'USD' => 'US dollar ($)',
        'GBP' => 'Pound sterling (£)',
      ],
      ],
      'field_sku' => ['string', 'SKU'],
      'field_gallery' => ['media:image', 'Gallery', [], [], -1],
      'field_category' => ['taxonomy_term:' . self::VOCABULARY, 'Category'],
    ],
    'recipe' => [
      'body' => ['text_with_summary', 'Introduction'],
      'field_image' => ['image', 'Photo', [], [], 1, TRUE],
      'field_ingredients' => ['string', 'Ingredients', [], [], -1],
      'field_steps' => ['text_long', 'Steps', [], [], -1],
      'field_prep_minutes' => ['integer', 'Preparation (minutes)'],
      'field_cook_minutes' => ['integer', 'Cooking (minutes)'],
      'field_yield' => ['string', 'Serves'],
      'field_diet' => ['list_string', 'Suitable for', [
        'vegan' => 'Vegan',
        'gluten_free' => 'Gluten-free',
        'nut_free' => 'No nuts',
      ], [], -1,
      ],
    ],
    'job_posting' => [
      'body' => ['text_with_summary', 'Description'],
      'field_salary' => ['decimal', 'Salary', ['precision' => 10, 'scale' => 2]],
      'field_salary_unit' => ['list_string', 'Salary is', [
        'HOUR' => 'per hour',
        'MONTH' => 'per month',
        'YEAR' => 'per year',
      ],
      ],
      'field_employment_type' => ['list_string', 'Employment', [
        'FULL_TIME' => 'Full time',
        'PART_TIME' => 'Part time',
        'CONTRACTOR' => 'Contract',
      ],
      ],
      'field_valid_through' => ['datetime', 'Apply by', ['datetime_type' => 'date']],
      'field_location' => ['node:venue', 'Location'],
      'field_image' => ['image', 'Logo'],
      // Hidden from visitors where field_test is enabled.
      'field_no_view_access' => ['string_long', 'Internal notes'],
    ],
    'announcement' => [
      'body' => ['text_with_summary', 'Text'],
    ],
    'article' => [
      'body' => ['text_with_summary', 'Body'],
      'field_image' => ['image', 'Image'],
      'field_tags' => ['taxonomy_term:tags', 'Tags', [], [], -1],
      'field_byline' => ['string', 'Byline'],
      'field_summary' => ['string_long', 'Summary'],
    ],
  ];

  /**
   * Creates or resets the fixture.
   *
   * @return array<string, array<string, int|string>>
   *   Entity type => fixture key => id, and `path` => fixture key => path of
   *   each node.
   */
  public static function install(): array {
    self::checkRequirements();
    self::createTypes();
    $ids = [];
    $author = self::ensure('user', 'author', fn () => User::create([
      'name' => 'Rosa Martín',
      'mail' => 'rosa@example.com',
      'status' => 1,
    ]));
    $ids['user']['author'] = (int) $author->id();
    foreach (self::files() as $key => [$width, $height]) {
      $ids['file'][$key] = (int) self::ensure('file', $key, fn () => self::createFile($key, $width, $height))->id();
    }
    foreach (self::media() as $key => [$name, $file, $alt, $status]) {
      $ids['media'][$key] = (int) self::ensure('media', $key, fn () => \Drupal::entityTypeManager()->getStorage('media')->create([
        'bundle' => 'image',
        'name' => $name,
        'status' => $status,
        'uid' => $author->id(),
        'field_media_image' => ['target_id' => $ids['file'][$file], 'alt' => $alt],
      ]))->id();
    }
    foreach (self::terms() as $key => [$vocabulary, $name, $status]) {
      $ids['taxonomy_term'][$key] = (int) self::ensure('taxonomy_term', $key, fn () => \Drupal::entityTypeManager()->getStorage('taxonomy_term')->create([
        'vid' => $vocabulary,
        'name' => $name,
        'status' => $status,
      ]))->id();
    }
    // In order: nodes refer to nodes created before them.
    foreach (self::nodes() as $key => $values) {
      $node = self::ensure('node', $key, fn () => \Drupal::entityTypeManager()->getStorage('node')->create(self::resolve($values, $ids) + [
        'uid' => $author->id(),
        'status' => 1,
        'created' => strtotime('2026-05-04T08:00:00Z'),
        'changed' => strtotime('2026-05-06T08:00:00Z'),
      ]));
      $ids['node'][$key] = (int) $node->id();
      $ids['path'][$key] = $node->toUrl()->toString();
    }
    foreach (self::templates() as $id => $template) {
      self::saveTemplate($id, $template['status'], $template['tree'], $template['values']);
      $ids['content_template'][$id] = $id;
    }
    self::saveEventDraft($author);
    return $ids;
  }

  /**
   * Removes everything install() created.
   *
   * The Article type, its fields, the `tags` vocabulary, the image media type
   * and the components are left alone: a site may have had them before.
   */
  public static function teardown(): void {
    $entity_type_manager = \Drupal::entityTypeManager();
    $templates = $entity_type_manager->getStorage('content_template')->loadMultiple(array_keys(self::templates()));
    foreach ($templates as $template) {
      \Drupal::service(AutoSaveManager::class)->delete($template);
      $template->delete();
    }
    // Content before what it refers to, the author last: deleting a user
    // deletes their nodes.
    foreach (['node', 'taxonomy_term', 'media', 'file', 'user'] as $entity_type_id) {
      $keys = match ($entity_type_id) {
        'node' => array_reverse(array_keys(self::nodes() + self::previewNodes())),
        'taxonomy_term' => array_keys(self::terms()),
        'media' => array_keys(self::media()),
        'file' => array_keys(self::files()),
        'user' => ['author'],
      };
      foreach ($keys as $key) {
        \Drupal::service('entity.repository')->loadEntityByUuid($entity_type_id, self::uuid($key))?->delete();
      }
    }
    // Types that refer to others first: a reference field left without a
    // target bundle logs an error.
    foreach (array_reverse(array_keys(self::TYPES)) as $bundle) {
      NodeType::load($bundle)?->delete();
    }
    // Field data of the deleted types is purged on cron.
    Vocabulary::load(self::VOCABULARY)?->delete();
  }

  /**
   * The fixed UUID of a fixture entity or component instance.
   */
  public static function uuid(string $key): string {
    $hash = md5('canvas_metatag.complex:' . $key);
    return sprintf(
      '%s-%s-4%s-8%s-%s',
      substr($hash, 0, 8),
      substr($hash, 8, 4),
      substr($hash, 13, 3),
      substr($hash, 17, 3),
      substr($hash, 20, 12),
    );
  }

  /**
   * Every link of a template: component instance key => prop => expression.
   *
   * @return array<string, array<string, array<string, string>>>
   *   Template id => instance key => prop name => expression.
   */
  public static function links(): array {
    $links = [];
    foreach (self::templates() as $id => $template) {
      foreach ($template['tree'] as $key => [$component, , , $inputs]) {
        foreach ($inputs as $prop => $input) {
          if (is_array($input) && ($input['sourceType'] ?? NULL) === 'entity-field') {
            $links[$id][$key . ':' . $component][$prop] = $input['expression'];
          }
        }
      }
    }
    return $links;
  }

  /**
   * Creates the code components of components.json that do not exist.
   *
   * Copies of the components of the farm site, prop for prop, so that Canvas
   * offers the same links in a test or a sandbox as on that site. They render
   * nothing.
   */
  public static function createComponentDoubles(): void {
    $definitions = json_decode((string) file_get_contents(__DIR__ . '/../../fixtures/complex/components.json'), TRUE, 512, JSON_THROW_ON_ERROR);
    $source = 'export default function Component() { return null; }';
    foreach ($definitions as $name => $definition) {
      if (Component::load('js.' . $name)) {
        continue;
      }
      JavaScriptComponent::create([
        'machineName' => $name,
        'name' => $definition['name'],
        'status' => TRUE,
        'required' => $definition['required'],
        'props' => $definition['props'],
        'slots' => $definition['slots'],
        'js' => ['original' => $source, 'compiled' => $source],
        'css' => ['original' => '', 'compiled' => ''],
        'dataDependencies' => [],
      ])->save();
    }
  }

  /**
   * Fails with a clear message when the site lacks a dependency.
   */
  private static function checkRequirements(): void {
    $missing = array_diff(
      [
        'node', 'field', 'text', 'options', 'link', 'datetime', 'image', 'file', 'media', 'taxonomy', 'path',
        'canvas', 'canvas_metatag',
      ],
      array_keys(\Drupal::moduleHandler()->getModuleList()),
    );
    if ($missing) {
      throw new \RuntimeException('The complex fixture needs these modules: ' . implode(', ', $missing) . '.');
    }
    if (!\Drupal::entityTypeManager()->getStorage('media_type')->load('image')) {
      throw new \RuntimeException('The complex fixture needs the image media type with the source field field_media_image.');
    }
    foreach (self::COMPONENTS as $name) {
      if (!Component::load('js.' . $name)) {
        throw new \RuntimeException("The complex fixture needs the code component js.$name (tests/fixtures/complex/components.json).");
      }
    }
  }

  /**
   * Creates the vocabulary, the node types, their fields and displays.
   */
  private static function createTypes(): void {
    foreach ([self::VOCABULARY => 'Product category', 'tags' => 'Tags'] as $vid => $label) {
      if (!Vocabulary::load($vid)) {
        Vocabulary::create(['vid' => $vid, 'name' => $label])->save();
      }
    }
    $repository = \Drupal::service('entity_display.repository');
    foreach (self::TYPES + ['article' => 'Article'] as $bundle => $label) {
      if (!NodeType::load($bundle)) {
        NodeType::create(['type' => $bundle, 'name' => $label])->save();
      }
      $form = $repository->getFormDisplay('node', $bundle)->setComponent('title');
      $view = $repository->getViewDisplay('node', $bundle);
      foreach (self::FIELDS[$bundle] as $name => $definition) {
        [$type, $label, $storage_settings, $settings, $cardinality, $required] = $definition + [
          2 => [],
          3 => [],
          4 => 1,
          5 => FALSE,
        ];
        $settings += match ($type) {
          'text_with_summary' => ['display_summary' => TRUE],
          'link' => ['link_type' => LinkItemInterface::LINK_GENERIC, 'title' => 1],
          'image' => ['alt_field_required' => FALSE],
          default => [],
        };
        if ($type === 'list_string') {
          $storage_settings = ['allowed_values' => $storage_settings];
        }
        if (str_contains($type, ':')) {
          [$target_type, $target_bundle] = explode(':', $type);
          $type = 'entity_reference';
          $storage_settings['target_type'] = $target_type;
          $settings += [
            'handler' => 'default:' . $target_type,
            'handler_settings' => ['target_bundles' => [$target_bundle => $target_bundle]],
          ];
        }
        if (!FieldStorageConfig::loadByName('node', $name)) {
          FieldStorageConfig::create([
            'field_name' => $name,
            'entity_type' => 'node',
            'type' => $type,
            'settings' => $storage_settings,
            'cardinality' => $cardinality,
          ])->save();
        }
        if (!FieldConfig::loadByName('node', $bundle, $name)) {
          FieldConfig::create([
            'field_name' => $name,
            'entity_type' => 'node',
            'bundle' => $bundle,
            'label' => $label,
            'settings' => $settings,
            'required' => $required,
          ])->save();
        }
        if (!$form->getComponent($name)) {
          $form->setComponent($name);
        }
        if (!$view->getComponent($name)) {
          $view->setComponent($name, ['label' => 'above']);
        }
      }
      $form->save();
      $view->save();
    }
  }

  /**
   * Loads a fixture entity by its UUID, or creates it.
   */
  private static function ensure(string $entity_type_id, string $key, callable $create): EntityInterface {
    $entity = \Drupal::service('entity.repository')->loadEntityByUuid($entity_type_id, self::uuid($key));
    if ($entity === NULL) {
      $entity = $create();
      \assert($entity instanceof ContentEntityInterface);
      $entity->set('uuid', self::uuid($key));
      $entity->save();
    }
    return $entity;
  }

  /**
   * Writes a PNG of an exact size and saves its file entity.
   */
  private static function createFile(string $key, int $width, int $height): EntityInterface {
    $directory = self::DIRECTORY;
    \Drupal::service('file_system')->prepareDirectory($directory, FileSystemInterface::CREATE_DIRECTORY);
    $uri = $directory . '/' . strtr($key, '_', '-') . '.png';
    self::paint($uri, $key, $width, $height);
    return \Drupal::entityTypeManager()->getStorage('file')->create(['uri' => $uri, 'status' => 1]);
  }

  /**
   * Writes a PNG of an exact size: a gradient of its own hue and its name.
   *
   * Each image is told apart in a preview, and its size shows how it crops.
   */
  private static function paint(string $uri, string $key, int $width, int $height): void {
    $image = imagecreatetruecolor($width, $height);
    \assert($image !== FALSE);
    $hue = hexdec(substr(md5($key), 0, 2)) / 255;
    for ($y = 0; $y < $height; $y++) {
      [$r, $g, $b] = self::rgb($hue, 0.45, 0.62 - 0.3 * $y / $height);
      imageline($image, 0, $y, $width, $y, (int) imagecolorallocate($image, $r, $g, $b));
    }
    // The built-in font is ASCII, 9 by 15 pixels: draw it small, scale it up.
    $label = ucfirst(strtr($key, '_', ' ')) . " - {$width}x{$height}";
    $text = imagecreatetruecolor(9 * strlen($label), 15);
    \assert($text !== FALSE);
    imagefill($text, 0, 0, (int) imagecolorallocate($text, 0, 0, 0));
    imagecolortransparent($text, (int) imagecolorallocate($text, 0, 0, 0));
    imagestring($text, 5, 0, 0, $label, (int) imagecolorallocate($text, 255, 255, 255));
    $scale = max(1, intdiv((int) ($width * 0.8), imagesx($text)));
    imagecopyresized($image, $text, intdiv($width - imagesx($text) * $scale, 2), intdiv($height - 15 * $scale, 2), 0, 0, imagesx($text) * $scale, 15 * $scale, imagesx($text), 15);
    $stream = fopen($uri, 'wb');
    \assert($stream !== FALSE);
    imagepng($image, $stream);
    fclose($stream);
  }

  /**
   * HSL to RGB, each 0–1 in and 0–255 out.
   */
  private static function rgb(float $h, float $s, float $l): array {
    $c = (1 - abs(2 * $l - 1)) * $s;
    $x = $c * (1 - abs(fmod($h * 6, 2) - 1));
    [$r, $g, $b] = [[$c, $x, 0], [$x, $c, 0], [0, $c, $x], [0, $x, $c], [$x, 0, $c], [$c, 0, $x]][(int) ($h * 6) % 6];
    $m = $l - $c / 2;
    return array_map(static fn (float $v): int => (int) round(($v + $m) * 255), [$r, $g, $b]);
  }

  /**
   * Content for looking at the templates on a site; tests don't use it.
   *
   * Needs install() first. Adds announcements, repaints the images, and makes
   * the most complete node of each type the most recently changed one, which
   * is the node Canvas opens a content template with.
   *
   * @return array<string, string>
   *   Content template id => path of its editor, showing that node.
   */
  public static function preview(): array {
    $repository = \Drupal::service('entity.repository');
    $author = $repository->loadEntityByUuid('user', self::uuid('author'))
      ?? throw new \RuntimeException('Install the fixture first (install.php).');
    foreach (self::files() as $key => [$width, $height]) {
      if ($file = $repository->loadEntityByUuid('file', self::uuid($key))) {
        self::paint($file->getFileUri(), $key, $width, $height);
        image_path_flush($file->getFileUri());
      }
    }
    $ids = [];
    foreach (['file' => self::files(), 'media' => self::media(), 'taxonomy_term' => self::terms()] as $entity_type_id => $made) {
      foreach (array_keys($made) as $key) {
        $ids[$entity_type_id][$key] = (int) $repository->loadEntityByUuid($entity_type_id, self::uuid($key))?->id();
      }
    }
    foreach (self::previewNodes() as $key => $values) {
      self::ensure('node', $key, fn () => \Drupal::entityTypeManager()->getStorage('node')->create(self::resolve($values, $ids) + [
        'uid' => $author->id(),
        'status' => 1,
      ]));
    }
    $now = \Drupal::time()->getRequestTime();
    $links = [];
    foreach (array_keys(self::nodes() + self::previewNodes()) as $key) {
      $node = $repository->loadEntityByUuid('node', self::uuid($key));
      $best = in_array($key, self::SHOWCASE, TRUE);
      // Older than any other content, so a site's own articles come first.
      $node->setChangedTime($best ? $now : strtotime('2020-01-01T00:00:00Z'))->save();
      if ($best) {
        foreach (array_keys(self::templates()) as $id) {
          if (str_starts_with($id, "node.{$node->bundle()}.")) {
            $links[$id] = '/canvas/template/node/' . $node->bundle() . '/' . explode('.', $id)[2] . '/' . $node->id();
          }
        }
      }
    }
    return $links;
  }

  /**
   * The node each content template is previewed with.
   */
  private const SHOWCASE = [
    'event_full',
    'product_floor',
    'recipe_bread',
    'job_developer',
    'person_mira',
    'announcement_hours',
  ];

  /**
   * Nodes only preview() adds: tests rely on Announcement having none.
   */
  private static function previewNodes(): array {
    return [
      // The fixture's own products test edge cases: long or unsafe markup.
      'product_floor' => [
        'type' => 'product',
        'title' => 'Oak floor lamp',
        'body' => self::body('<p>A tall reading lamp in solid oak, turned by hand and finished with natural oil.</p><ul><li>Warm 2700 K light</li><li>Dimmable</li><li>Fabric cable, 3 m</li></ul>', 'A tall reading lamp in solid oak.'),
        'field_price' => '249.00',
        'field_currency' => 'EUR',
        'field_sku' => 'LAMP-OAK-02',
        'field_gallery' => ['@media.lamp_side', '@media.lamp_front'],
        'field_category' => '@taxonomy_term.lamps',
        'path' => ['alias' => '/complex/products/oak-floor-lamp'],
      ],
      'announcement_tickets' => [
        'type' => 'announcement',
        'title' => 'Season tickets on sale',
        'body' => self::body('<p>Twelve concerts for the price of nine, on sale until the end of August.</p>', 'Twelve concerts for the price of nine.'),
      ],
      'announcement_hours' => [
        'type' => 'announcement',
        'title' => 'New summer opening hours',
        'body' => self::body('<p>From June to August the box office is open every day from noon to 8 pm, and an hour before every concert.</p>', 'The box office is open every day from noon.'),
        'path' => ['alias' => '/complex/news/summer-opening-hours'],
      ],
    ];
  }

  /**
   * Replaces `@key` references in node values with the ids made so far.
   */
  private static function resolve(array $values, array $ids): array {
    array_walk_recursive($values, static function (mixed &$value) use ($ids): void {
      if (is_string($value) && preg_match('/^@(\w+)\.(\w+)$/', $value, $m)) {
        $value = $ids[$m[1]][$m[2]] ?? throw new \LogicException("Unknown fixture reference $value.");
      }
    });
    return $values;
  }

  /**
   * Saves a template in the fixture's state; its draft is dropped by Canvas.
   */
  private static function saveTemplate(string $id, bool $status, array $tree, array $values): ContentTemplate {
    [$entity_type_id, $bundle, $mode] = explode('.', $id);
    $storage = \Drupal::entityTypeManager()->getStorage('content_template');
    $template = $storage->loadUnchanged($id) ?? $storage->create([
      'content_entity_type_id' => $entity_type_id,
      'content_entity_type_bundle' => $bundle,
      'content_entity_type_view_mode' => $mode,
    ]);
    \assert($template instanceof ContentTemplate);
    $template->set('component_tree', self::tree($tree));
    $template->setStatus($status);
    if ($values) {
      $template->setThirdPartySetting('canvas_metatag', 'values', $values);
    }
    else {
      $template->unsetThirdPartySetting('canvas_metatag', 'values');
    }
    $template->save();
    $violations = $template->getTypedData()->validate();
    if ($violations->count()) {
      $messages = [];
      foreach ($violations as $violation) {
        $messages[] = $violation->getPropertyPath() . ': ' . strip_tags((string) $violation->getMessage());
      }
      throw new \RuntimeException("Template $id is not valid: " . implode('; ', $messages));
    }
    return $template;
  }

  /**
   * Gives the Event template a draft that differs from what is live.
   *
   * Another eyebrow and an extra paragraph in the layout, and another title
   * ending, saved as the fixture's author under the fixture's client id.
   */
  private static function saveEventDraft(EntityInterface $author): void {
    $template = \Drupal::entityTypeManager()->getStorage('content_template')->loadUnchanged('node.event.full');
    \assert($template instanceof ContentTemplate);
    $live = self::templates()['node.event.full'];
    $tree = $live['tree'];
    $tree['event_eyebrow'][3]['text'] = self::html('<p>Tonight only</p>');
    $tree['event_draft_note'] = ['paragraph', 'event_intro', 'content', [
      'text' => self::html('<p>Doors open an hour before the start.</p>'),
      'variant' => 'body',
    ],
    ];
    $template->set('component_tree', self::tree($tree));
    $template->setThirdPartySetting('canvas_metatag', 'values', ['title' => '{title} {sep} Tickets'] + $live['values']);
    $switcher = \Drupal::service('account_switcher');
    \assert($author instanceof User);
    $switcher->switchTo($author);
    try {
      \Drupal::service(AutoSaveManager::class)->saveEntity($template, self::CLIENT_ID);
    }
    finally {
      $switcher->switchBack();
    }
  }

  /**
   * A component tree as Canvas stores it.
   *
   * @param array<string, array{0: string, 1: ?string, 2: ?string, 3: array}> $tree
   *   Instance key => [component name, parent key, slot, inputs].
   */
  private static function tree(array $tree): array {
    $items = [];
    foreach ($tree as $key => [$name, $parent, $slot, $inputs]) {
      $component = Component::load('js.' . $name);
      \assert($component instanceof Component);
      $items[] = array_filter([
        'uuid' => self::uuid($key),
        'component_id' => $component->id(),
        'component_version' => $component->getActiveVersion(),
        'parent_uuid' => $parent === NULL ? NULL : self::uuid($parent),
        'slot' => $slot,
        'inputs' => $inputs,
      ], static fn (mixed $value): bool => $value !== NULL);
    }
    return $items;
  }

  /**
   * A static HTML prop value.
   */
  private static function html(string $markup): array {
    return ['value' => $markup, 'format' => self::HTML];
  }

  /**
   * A formatted text with summary field item.
   */
  private static function body(string $markup, string $summary = ''): array {
    return ['value' => $markup, 'summary' => $summary, 'format' => self::HTML];
  }

  /**
   * A formatted text field item.
   */
  private static function formatted(string $markup): array {
    return ['value' => $markup, 'format' => self::HTML];
  }

  /**
   * A prop linked to a field of the template's node.
   *
   * @param string $bundle
   *   The node type.
   * @param string $path
   *   `field␞␟property`, or a reference hop in the form Canvas offers it:
   *   with the bundle for a configurable field of the target
   *   (`field_venue␞␟entity␜␜entity:node:venue␝field_street␞␟value`), without
   *   it for a base field (`field_venue␞␟entity␜␜entity:node␝title␞␟value`).
   */
  private static function link(string $bundle, string $path): array {
    return ['sourceType' => 'entity-field', 'expression' => 'ℹ︎␜entity:node:' . $bundle . '␝' . $path];
  }

  /**
   * An image prop linked to an image media reference field.
   */
  private static function mediaImage(string $bundle, string $field): array {
    return self::link($bundle, $field . '␞␟entity␜␜entity:media:image␝field_media_image␞␟{src↠src_with_alternate_widths,alt↠alt,width↠width,height↠height}');
  }

  /**
   * Image files: key => [width, height].
   */
  private static function files(): array {
    return [
      'poster' => [1600, 900],
      'mira' => [800, 800],
      'omar' => [800, 1000],
      'lamp_front' => [1200, 1200],
      'lamp_side' => [1200, 1200],
      'lamp_prototype' => [640, 480],
      'silhouette' => [600, 600],
      'rye_bread' => [1200, 800],
      'shakshuka' => [1000, 750],
      'logo' => [400, 400],
      'article_photo' => [1200, 630],
    ];
  }

  /**
   * Image media: key => [name, file key, alt text, published].
   */
  private static function media(): array {
    // cspell:disable
    return [
      'poster' => ['Midsummer poster', 'poster', 'An orchestra on an open-air stage at dusk', TRUE],
      'mira' => ['Mira Kallio portrait', 'mira', 'Portrait of Mira Kallio', TRUE],
      'silhouette' => ['Silhouette', 'silhouette', 'A grey silhouette', TRUE],
      // Right-to-left alt text.
      'omar' => ['Omar Haddad portrait', 'omar', 'صورة عمر حداد', TRUE],
      // No alt text.
      'lamp_front' => ['Oak lamp, front', 'lamp_front', '', TRUE],
      'lamp_side' => ['Oak lamp, side', 'lamp_side', 'The oak desk lamp seen from the side', TRUE],
      // Not published: visitors cannot see it.
      'lamp_prototype' => ['Oak lamp prototype', 'lamp_prototype', 'An early prototype', FALSE],
    ];
    // cspell:enable
  }

  /**
   * Terms: key => [vocabulary, name, published].
   */
  private static function terms(): array {
    return [
      'lamps' => [self::VOCABULARY, 'Lamps', TRUE],
      'desks' => [self::VOCABULARY, 'Desks & tables', TRUE],
      // Not published: visitors cannot see it.
      'archived' => [self::VOCABULARY, 'Archived', FALSE],
      'tag_design' => ['tags', 'Design', TRUE],
      'tag_light' => ['tags', 'Light', TRUE],
    ];
  }

  /**
   * Nodes by key, in creation order. `@type.key` refers to a fixture id.
   */
  private static function nodes(): array {
    $long_html = '<h2>Made to last</h2><p>' . str_repeat('Solid oak, turned by hand &amp; finished with natural oil. ', 40) . '</p>'
      . '<ul><li>Warm 2700 K light</li><li>Dimmable</li><li>Fabric cable, 2 m</li></ul>'
      . '<table><tr><th>Height</th><td>45 cm</td></tr><tr><th>Weight</th><td>1.2 kg</td></tr></table>'
      . '<p>Questions? <a href="/contact">Ask us</a> 💡</p><script>alert(1)</script>';
    // cspell:disable
    return [
      'venue_hall' => [
        'type' => 'venue',
        'title' => 'Lakeside Concert Hall',
        'body' => self::body('<p>A hall of glass and pine on the shore.</p>'),
        'field_street' => 'Mannerheimintie 13e',
        'field_postal_code' => '00100',
        'field_locality' => 'Helsinki',
        'field_country' => 'FI',
        'path' => ['alias' => '/complex/venues/lakeside-concert-hall'],
      ],
      // Not published: references to it are hidden from visitors.
      'venue_hidden' => [
        'type' => 'venue',
        'title' => 'Rehearsal Room B',
        'field_street' => 'Kaartinkaupunki 4',
        'field_locality' => 'Helsinki',
        'field_country' => 'FI',
        'status' => 0,
      ],
      'venue_office' => [
        'type' => 'venue',
        'title' => 'Example office',
        'field_street' => 'Kungsgatan 1',
        'field_postal_code' => '111 43',
        'field_locality' => 'Stockholm',
        'field_country' => 'SE',
      ],
      'person_mira' => [
        'type' => 'person',
        'title' => 'Mira Kallio',
        'body' => self::body('<p>Mira conducts <em>new music</em> for orchestras and small ensembles.</p>', 'Conductor of new music.'),
        'field_role' => 'Conductor',
        'field_photo' => '@media.mira',
        'field_links' => [
          ['uri' => 'https://mira.example.org', 'title' => 'Website'],
          ['uri' => 'https://social.example.net/@mira', 'title' => 'Profile'],
        ],
        'path' => ['alias' => '/complex/people/mira-kallio'],
      ],
      // Right-to-left name and biography.
      'person_omar' => [
        'type' => 'person',
        'title' => 'عمر حداد',
        'body' => self::body('<p>ملحن وعازف عود يكتب للأوركسترا والفرق الصغيرة.</p>'),
        'field_role' => 'ملحن',
        'field_photo' => '@media.omar',
        'field_links' => [['uri' => 'https://omar.example.org']],
      ],
      // Every optional field empty.
      'person_empty' => [
        'type' => 'person',
        'title' => 'Lin Leinonen',
        'field_photo' => '@media.silhouette',
      ],
      // Not published: references to them are hidden from visitors.
      'person_hidden' => [
        'type' => 'person',
        'title' => 'Unannounced guest',
        'field_role' => 'Soloist',
        'field_photo' => '@media.silhouette',
        'status' => 0,
      ],
      // Every field set.
      'event_full' => [
        'type' => 'event',
        'title' => 'Midsummer Night Concert',
        'body' => self::body('<p>An evening of <strong>new music</strong> by the lake.</p><p>Bring a blanket.</p>', 'New music by the lake on the longest evening of the year.'),
        'field_starts' => '2027-06-19T16:00:00',
        'field_ends' => '2027-06-19T19:30:00',
        'field_venue' => '@node.venue_hall',
        'field_performers' => ['@node.person_mira', '@node.person_omar'],
        'field_tickets' => ['uri' => 'https://tickets.example.com/midsummer', 'title' => 'Buy tickets'],
        'field_poster' => '@media.poster',
        'field_event_status' => 'EventScheduled',
        'path' => ['alias' => '/complex/events/midsummer-night-concert'],
      ],
      // Emoji in the title, hidden first references, optional fields empty.
      'event_hidden_refs' => [
        'type' => 'event',
        'title' => 'Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮',
        'body' => self::body('<p>Bring your own instrument. 🎶</p>'),
        'field_starts' => '2027-02-06T10:00:00',
        'field_venue' => '@node.venue_hidden',
        'field_performers' => ['@node.person_hidden', '@node.person_mira'],
        'field_event_status' => 'EventPostponed',
        'path' => ['alias' => '/complex/events/strings-workshop'],
      ],
      // A title near the 255 character limit, a long body, an internal link.
      'event_long' => [
        'type' => 'event',
        'title' => 'An unusually long evening programme of chamber music, songs and readings in which every work is introduced by the musicians themselves, followed by a conversation with the audience about how new music is commissioned, rehearsed and first performed',
        'body' => self::body(str_repeat('<p>Each work is introduced by the musicians who play it, in their own words, before it is performed.</p>', 60)),
        'field_starts' => '2027-09-10T15:00:00',
        'field_ends' => '2027-09-10T21:00:00',
        'field_venue' => '@node.venue_hall',
        'field_tickets' => ['uri' => 'internal:/complex/venues/lakeside-concert-hall', 'title' => 'How to get there'],
        'field_event_status' => 'EventScheduled',
      ],
      // Not published: the template preview of a node visitors cannot see.
      'event_unpublished' => [
        'type' => 'event',
        'title' => 'Autumn season opening (draft)',
        'body' => self::body('<p>Programme to be announced.</p>', 'The season opens in October.'),
        'field_starts' => '2027-10-01T16:00:00',
        'field_venue' => '@node.venue_hall',
        'field_performers' => ['@node.person_mira'],
        'field_poster' => '@media.poster',
        'status' => 0,
      ],
      // A long HTML body with no summary, a gallery whose first image has no
      // alt text.
      'product_lamp' => [
        'type' => 'product',
        'title' => 'Oak desk lamp',
        'body' => self::body($long_html),
        'field_price' => '89.00',
        'field_currency' => 'EUR',
        'field_sku' => 'LAMP-OAK-01',
        'field_gallery' => ['@media.lamp_front', '@media.lamp_side'],
        'field_category' => '@taxonomy_term.lamps',
        'path' => ['alias' => '/complex/products/oak-desk-lamp'],
      ],
      // Right to left; the gallery's first image is not published.
      'product_rtl' => [
        'type' => 'product',
        'title' => 'مصباح مكتب',
        'body' => self::body('<p>ضوء دافئ للقراءة الليلية.</p>'),
        'field_price' => '1200.50',
        'field_currency' => 'USD',
        'field_sku' => 'LAMP-AR-02',
        'field_gallery' => ['@media.lamp_prototype', '@media.lamp_side'],
        'field_category' => '@taxonomy_term.desks',
      ],
      // Every optional field empty.
      'product_empty' => [
        'type' => 'product',
        'title' => 'Unnamed sample',
      ],
      // A category visitors cannot see.
      'product_archived' => [
        'type' => 'product',
        'title' => 'Brass wall lamp',
        'field_price' => '149.00',
        'field_currency' => 'GBP',
        'field_sku' => 'LAMP-BRASS-03',
        'field_gallery' => ['@media.lamp_side'],
        'field_category' => '@taxonomy_term.archived',
      ],
      'recipe_bread' => [
        'type' => 'recipe',
        'title' => 'Ruisleipä (Finnish rye bread)',
        'body' => self::body('<p>A sour rye loaf that keeps for a week.</p>'),
        'field_image' => ['target_id' => '@file.rye_bread', 'alt' => 'A dark rye loaf on a board'],
        'field_ingredients' => ['500 g rye flour', '500 ml water', '100 g sourdough starter', '10 g salt'],
        'field_steps' => [
          self::formatted('<p>Mix the flour, water and starter; leave <strong>overnight</strong>.</p>'),
          self::formatted('<p>Add the salt, shape and proof for 2 hours.</p>'),
          self::formatted('<p>Bake at 250 °C for 50 minutes.</p>'),
        ],
        'field_prep_minutes' => 20,
        'field_cook_minutes' => 50,
        'field_yield' => '1 loaf',
        'field_diet' => ['vegan', 'nut_free'],
        'path' => ['alias' => '/complex/recipes/rye-bread'],
      ],
      // Right to left; a photo without alt text.
      'recipe_rtl' => [
        'type' => 'recipe',
        'title' => 'שקשוקה',
        'body' => self::body('<p>ביצים ברוטב עגבניות.</p>'),
        'field_image' => ['target_id' => '@file.shakshuka', 'alt' => '', 'width' => 1000, 'height' => 750],
        'field_ingredients' => ['6 עגבניות', '4 ביצים', 'פלפל', 'שום'],
        'field_steps' => [
          self::formatted('<p>מבשלים רוטב.</p>'),
          self::formatted('<p>שוברים ביצה.</p>'),
        ],
        'field_prep_minutes' => 10,
        'field_cook_minutes' => 25,
        'field_diet' => ['gluten_free'],
      ],
      'job_developer' => [
        'type' => 'job_posting',
        'title' => 'Senior Drupal developer',
        'body' => self::body('<p>Build editorial tools with a small team.</p>'),
        'field_salary' => '5200.00',
        'field_salary_unit' => 'MONTH',
        'field_employment_type' => 'FULL_TIME',
        'field_valid_through' => '2027-01-31',
        'field_location' => '@node.venue_office',
        // A logo without alt text.
        'field_image' => ['target_id' => '@file.logo', 'alt' => '', 'width' => 400, 'height' => 400],
        'field_no_view_access' => 'Budget approved up to 5600; do not publish.',
        'path' => ['alias' => '/complex/jobs/senior-drupal-developer'],
      ],
      // The closing date has passed; no salary, no location.
      'job_expired' => [
        'type' => 'job_posting',
        'title' => 'Part-time translator (Arabic, Hebrew)',
        'body' => self::body('<p>Translate concert notes.</p>'),
        'field_employment_type' => 'PART_TIME',
        'field_valid_through' => '2026-01-15',
      ],
      // A title near the 255 character limit and tags.
      'article_long' => [
        'type' => 'article',
        'title' => 'What a year of building editorial tools taught us about structured content, reusable components, accessible defaults and the long tail of edge cases that only show up once real people start writing real things in a content management system',
        'body' => self::body(str_repeat('<p>We kept a list of every surprise.</p>', 30)),
        'field_byline' => 'Rosa Martín',
        'field_summary' => 'Twelve months, one list of surprises.',
        'field_image' => ['target_id' => '@file.article_photo', 'alt' => 'A whiteboard full of notes'],
        'field_tags' => ['@taxonomy_term.tag_design', '@taxonomy_term.tag_light'],
        'path' => ['alias' => '/complex/articles/a-year-of-editorial-tools'],
      ],
      // Mixed direction text with a direction mark, emoji and a joiner; an
      // image without alt text; no summary.
      'article_mixed' => [
        'type' => 'article',
        'title' => "Hello \u{200F}مرحبا\u{200F} 👋🏽 שלום — Leinikki 🧑‍💻",
        'body' => self::body('<p>Three scripts, one page.</p>'),
        'field_byline' => 'عمر حداد',
        'field_image' => ['target_id' => '@file.article_photo', 'alt' => '', 'width' => 1200, 'height' => 630],
      ],
    ];
    // cspell:enable
  }

  /**
   * The templates: id => status, tree and SEO values.
   *
   * A tree is instance key => [component, parent key, slot, inputs]. Every
   * link is one Canvas offers for its prop (ComplexContentTest pins this).
   */
  private static function templates(): array {
    return [
      // Many components, nested slots, links through a reference. The poster
      // and the performers are not shown.
      'node.event.full' => [
        'status' => TRUE,
        'tree' => [
          'event_intro' => ['section', NULL, NULL, ['backgroundColor' => 'cream']],
          'event_eyebrow' => ['paragraph', 'event_intro', 'content', [
            'text' => self::html('<p>Live at Example</p>'),
            'variant' => 'eyebrow',
          ],
          ],
          'event_title' => ['heading', 'event_intro', 'content', ['text' => self::link('event', 'title␞␟value')]],
          'event_summary' => ['card', 'event_intro', 'content', [
            'iconNameFromLucide' => 'calendar',
            'title' => self::link('event', 'field_event_status␞␟label'),
            'description' => self::link('event', 'body␞␟processed'),
          ],
          ],
          'event_details' => ['section', NULL, NULL, ['backgroundColor' => 'paper']],
          'event_grid' => ['grid', 'event_details', 'content', []],
          'event_venue' => ['card', 'event_grid', 'content', [
            'iconNameFromLucide' => 'map-pin',
            'title' => self::link('event', 'field_venue␞␟entity␜␜entity:node␝title␞␟value'),
            'description' => self::link('event', 'field_venue␞␟entity␜␜entity:node:venue␝body␞␟processed'),
          ],
          ],
          'event_address' => ['card', 'event_grid', 'content', [
            'iconNameFromLucide' => 'navigation',
            'title' => self::link('event', 'field_venue␞␟entity␜␜entity:node:venue␝field_street␞␟value'),
            'description' => self::html('<p>Public transport stops at the door.</p>'),
          ],
          ],
          'event_tickets' => ['card', 'event_grid', 'content', [
            'iconNameFromLucide' => 'ticket',
            'title' => 'Tickets',
            'description' => self::html('<p>From the box office or online.</p>'),
          ],
          ],
        ],
        'values' => [
          'title' => '{title} {sep} Events',
          'social' => ['image' => '{field.field_poster}'],
          'schema' => [
            'type' => 'Event',
            'props' => [
              'startDate' => '{field.field_starts}',
              'endDate' => '{field.field_ends}',
              'location_name' => '{field.field_venue}',
              'eventStatus' => '{field.field_event_status}',
              'image' => '{field.field_poster}',
            ],
          ],
        ],
      ],
      // The price, the SKU and the gallery are not shown: Canvas does not
      // link a list of images to one image.
      'node.product.full' => [
        'status' => TRUE,
        'tree' => [
          'product_main' => ['section', NULL, NULL, ['backgroundColor' => 'paper']],
          'product_title' => ['heading', 'product_main', 'content', ['text' => self::link('product', 'title␞␟value')]],
          'product_text' => ['card', 'product_main', 'content', [
            'iconNameFromLucide' => 'info',
            'title' => self::link('product', 'field_category␞␟entity␜␜entity:taxonomy_term␝name␞␟value'),
            'description' => self::link('product', 'body␞␟processed'),
          ],
          ],
          'product_currency' => ['card', 'product_main', 'content', [
            'iconNameFromLucide' => 'coins',
            'title' => self::link('product', 'field_currency␞␟label'),
            'description' => self::html('<p>Prices include tax.</p>'),
          ],
          ],
        ],
        'values' => [
          'description' => '{field.body}',
          'social' => ['image' => '{field.field_gallery}'],
          'schema' => [
            'type' => 'Product',
            'props' => [
              'offers_price' => '{field.field_price}',
              'offers_priceCurrency' => '{field.field_currency}',
              'sku' => '{field.field_sku}',
              'image' => '{field.field_gallery}',
            ],
          ],
        ],
      ],
      // Not a full template: no SEO settings.
      'node.product.teaser' => [
        'status' => TRUE,
        'tree' => [
          'product_card' => ['card', NULL, NULL, [
            'iconNameFromLucide' => 'lamp-desk',
            'title' => self::link('product', 'title␞␟value'),
            'description' => self::link('product', 'body␞␟summary_processed'),
          ],
          ],
        ],
        'values' => [],
      ],
      // Never published: it affects previews only. The ingredients and steps
      // are not shown: Canvas does not link a list to a single value.
      'node.recipe.full' => [
        'status' => FALSE,
        'tree' => [
          'recipe_main' => ['section', NULL, NULL, ['backgroundColor' => 'cream']],
          'recipe_feature' => ['image-feature', 'recipe_main', 'content', [
            'image' => self::link('recipe', 'field_image␞␟{src↠src_with_alternate_widths,alt↠alt,width↠width,height↠height}'),
            'title' => self::link('recipe', 'title␞␟value'),
            'description' => self::html('<p>From our kitchen.</p>'),
          ],
          ],
          'recipe_grid' => ['grid', 'recipe_main', 'content', []],
          'recipe_yield' => ['card', 'recipe_grid', 'content', [
            'iconNameFromLucide' => 'wheat',
            'title' => self::link('recipe', 'field_yield␞␟value'),
            'description' => self::link('recipe', 'body␞␟processed'),
          ],
          ],
        ],
        'values' => [
          'title' => '{title} {sep} Recipes',
          'description' => '{field.field_ingredients}',
        ],
      ],
      // Published with no SEO settings.
      'node.job_posting.full' => [
        'status' => TRUE,
        'tree' => [
          'job_title' => ['heading', NULL, NULL, ['text' => self::link('job_posting', 'title␞␟value')]],
          'job_location' => ['card', NULL, NULL, [
            'iconNameFromLucide' => 'building',
            'title' => self::link('job_posting', 'field_location␞␟entity␜␜entity:node:venue␝field_locality␞␟value'),
            'description' => self::link('job_posting', 'body␞␟processed'),
          ],
          ],
          'job_terms' => ['card', NULL, NULL, [
            'iconNameFromLucide' => 'briefcase',
            'title' => self::link('job_posting', 'field_employment_type␞␟label'),
            'description' => self::html('<p>Apply through our careers page.</p>'),
          ],
          ],
        ],
        'values' => [],
      ],
      // The profiles are not shown.
      'node.person.full' => [
        'status' => TRUE,
        'tree' => [
          'person_feature' => ['image-feature', NULL, NULL, [
            'image' => self::mediaImage('person', 'field_photo'),
            'eyebrow' => self::link('person', 'field_role␞␟value'),
            'title' => self::link('person', 'title␞␟value'),
            'description' => self::html('<p>Performer at Example.</p>'),
          ],
          ],
          'person_card' => ['card', NULL, NULL, [
            'iconNameFromLucide' => 'user',
            'title' => 'Biography',
            'description' => self::link('person', 'body␞␟processed'),
          ],
          ],
        ],
        'values' => [
          'schema' => [
            'type' => 'ProfilePage',
            'props' => [
              'jobTitle' => '{field.field_role}',
              'sameAs' => '{field.field_links}',
              'image' => '{field.field_photo}',
            ],
          ],
        ],
      ],
      // A type with no nodes.
      'node.announcement.full' => [
        'status' => TRUE,
        'tree' => [
          'announcement_title' => ['heading', NULL, NULL, ['text' => self::link('announcement', 'title␞␟value')]],
          'announcement_text' => ['paragraph', NULL, NULL, [
            'text' => self::html('<p>News from Example.</p>'),
            'variant' => 'body',
          ],
          ],
        ],
        'values' => ['title' => '{title} {sep} News'],
      ],
    ];
  }

}
