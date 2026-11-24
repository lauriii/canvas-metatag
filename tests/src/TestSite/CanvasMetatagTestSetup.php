<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\TestSite;

use Drupal\ai\Entity\AiGuardrail;
use Drupal\ai\Entity\AiGuardrailSet;
use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\JavaScriptComponent;
use Drupal\canvas\Entity\Page;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Field\Entity\BaseFieldOverride;
use Drupal\Core\Language\LanguageInterface;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\file\Entity\File;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\language\Entity\ContentLanguageSettings;
use Drupal\media\Entity\Media;
use Drupal\media\Entity\MediaType;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\TestSite\TestSetupInterface;
use Drupal\Tests\canvas_metatag\Fixture\ComplexContent;
use Drupal\user\Entity\Role;
use Drupal\user\Entity\User;
use Drupal\user\RoleInterface;

// @phpstan-ignore function.impossibleType
if (!\class_exists(TestSetupInterface::class)) {
  // Test discovery may run before the \Drupal\TestSite namespace can be
  // autoloaded. Mirrors Canvas's CanvasTestSetup.
  $root = \getcwd();
  foreach (['/core', '/web/core', ''] as $prefix) {
    $interface = $root . $prefix . '/tests/Drupal/TestSite/TestSetupInterface.php';
    if (\file_exists($interface)) {
      require_once $interface;
      break;
    }
  }
}

/**
 * Provisions an isolated Drupal install for the Canvas Metatag e2e tests.
 *
 * Run by `core/scripts/test-site.php install --setup-file …`, once per spec
 * file. Two environment flags choose what is added to the base (coupled) site:
 *
 * - CANVAS_METATAG_E2E_HEADLESS=1 installs canvas_headless with one frontend,
 *   and adds node 4, an article without a summary.
 * - CANVAS_METATAG_E2E_AI=1 installs the AI submodule and its test provider,
 *   edits the search result prompt and adds a site guardrail (configureAi()).
 * - CANVAS_METATAG_E2E_COMPLEX=1 adds the complex content fixture after the
 *   base site: its nodes are 4 to 24, in the order of COMPLEX_NODES.
 * - CANVAS_METATAG_E2E_COURSES=1, with the complex fixture, adds courses and
 *   a page that lists them (installCourses()): nodes 25 to 30.
 *
 * The values here are repeated in tests/e2e/constants.ts. Entities are created
 * in a fixed order, so their ids are stable: pages 1 to 5, nodes 1 to 3.
 *
 * @see \Drupal\Tests\canvas\TestSite\CanvasTestSetup
 */
class CanvasMetatagTestSetup implements TestSetupInterface {

  public const string SITE_NAME = 'Example';

  // The second site language. The About page has a translation in it.
  public const string LANGCODE = 'fi';

  // The frontend of the headless project. Nothing answers at this address.
  public const string FRONTEND_URL = 'https://www.example.test';

  // Canvas pages 1 to 5, in this order.
  public const string HOME_TITLE = 'Home';
  public const string PRICING_TITLE = 'Pricing';
  public const string PRICING_DESCRIPTION = 'Simple plans for teams of every size. Start free, upgrade when you grow.';
  public const string PRICING_HEADING = 'Plans and prices';
  public const string PRICING_HEADING_UUID = '3b0f6a52-7c1d-4e8a-9f25-6d4c1b2a7e01';
  public const string ABOUT_TITLE = 'About us';
  public const string ABOUT_TITLE_TRANSLATED = 'Tietoa meistä';
  // No main heading, a small image, and a stored title that is too long and
  // names the site twice.
  public const string CHECKS_TITLE = 'Checks';
  public const string CHECKS_STORED_TITLE = 'Example pricing plans compared in detail for every team size and every budget';
  // A page whose published SEO title differs from the inherited one.
  public const string STORED_TITLE = 'Stored';
  public const string STORED_SEO_TITLE = 'Published title';
  // A search result prompt without {count}. The Prompt Library's form would
  // refuse it; a configuration import would not.
  public const string AI_SEARCH_PROMPT = 'Write the search result title and description of this page in {language}.';

  // Image media, by name. Sizes are width x height in pixels.
  public const string IMAGE_HERO = 'E2E Hero';
  public const string IMAGE_SMALL = 'E2E Small';
  public const string IMAGE_LOGO = 'E2E Logo';
  public const string IMAGE_ARTICLE = 'E2E Article';

  // Article nodes 1 and 2, then a Basic page (a type without a template).
  public const string ARTICLE_TITLE = 'How we rebuilt our editor';
  public const string ARTICLE_SUMMARY = 'A look at what changed in our editing pipeline and why it matters.';
  public const string ARTICLE_BYLINE = 'Ada Writer';
  public const string SECOND_ARTICLE_TITLE = 'What we learned from a year of releases';
  public const string SECOND_ARTICLE_SUMMARY = 'Twelve releases, three lessons and one thing we would do differently.';
  public const string SECOND_ARTICLE_BYLINE = 'Grace Editor';
  public const string PLAIN_NODE_TITLE = 'Plain page';
  // The headless projects' node 4: an article with no description.
  public const string NO_SUMMARY_TITLE = 'A note without a summary';

  // Users. Each one's password is its name.
  // Edits Canvas pages and templates, with neither SEO permission.
  public const string USER_NO_SEO = 'e2e_no_seo';
  // The same, plus "edit canvas metatag".
  public const string USER_EDITOR = 'e2e_editor';
  // The same, plus "administer canvas metatag".
  public const string USER_ADMIN = 'e2e_admin';
  // Holds "edit canvas metatag" but cannot edit any Canvas page.
  public const string USER_VIEWER = 'e2e_viewer';

  // The complex fixture's nodes and their ids, mirrored in constants.ts.
  public const array COMPLEX_NODES = [
    'venue_hall' => 4,
    'person_mira' => 7,
    'person_omar' => 8,
    'event_full' => 11,
    'event_hidden_refs' => 12,
    'event_long' => 13,
    'event_unpublished' => 14,
    'product_lamp' => 15,
    'product_rtl' => 16,
    'recipe_bread' => 19,
    'recipe_rtl' => 20,
    'job_developer' => 21,
    'article_mixed' => 24,
  ];

  // The course list of the schema-templates project.
  public const int COURSE_LIST_NODE = 30;

  // The Article template's stored description in the complex project: a
  // link to a field that no longer exists.
  public const string GONE_FIELD = 'field_gone';

  /**
   * {@inheritdoc}
   */
  public function setup(): void {
    $headless = \getenv('CANVAS_METATAG_E2E_HEADLESS') === '1';
    $ai = \getenv('CANVAS_METATAG_E2E_AI') === '1';
    $complex = \getenv('CANVAS_METATAG_E2E_COMPLEX') === '1';

    \Drupal::service('module_installer')->install(['node', 'media', 'language', 'content_translation']);
    // Canvas reads the image media types when it defines the page image field.
    $this->createImageMediaType();
    \Drupal::service('module_installer')->install(\array_merge(
      ['canvas', 'canvas_metatag'],
      $headless ? ['canvas_headless'] : [],
      $ai ? ['canvas_metatag_ai', 'canvas_metatag_ai_test'] : [],
    ));

    \Drupal::configFactory()->getEditable('system.site')->set('name', self::SITE_NAME)->save();
    // The install profile prints every page's title as a main heading. Here,
    // as on a site built with Canvas, a heading is a component on the page.
    \Drupal::entityTypeManager()->getStorage('block')->load('stark_page_title')?->delete();
    \user_role_grant_permissions(RoleInterface::ANONYMOUS_ID, ['access content', 'view media']);
    $this->addTranslationLanguage();
    $this->createUsers($headless, $ai);

    $hero = $this->createImage(self::IMAGE_HERO, 1200, 630, 'Pricing table');
    $small = $this->createImage(self::IMAGE_SMALL, 300, 200, 'A small picture');
    $this->createImage(self::IMAGE_LOGO, 512, 512, 'Example logo');
    $article_image = $this->createImage(self::IMAGE_ARTICLE, 1600, 900, 'An editor at work');

    $heading = $this->createHeadingComponent();
    $this->createPages($heading, $hero, $small);
    $this->createContent($heading, $hero, $article_image);

    if ($headless) {
      $this->configureHeadless();
    }
    if ($complex) {
      $this->installComplexContent();
      if (\getenv('CANVAS_METATAG_E2E_COURSES') === '1') {
        $this->installCourses();
      }
    }
    if ($ai) {
      $this->configureAi();
    }
  }

  /**
   * Points the AI defaults at the test provider, and adds what a site adds.
   *
   * The search result prompt is set in configuration, as an import would
   * set it, without {count}. A global guardrail stops any request that
   * contains "#policy".
   */
  private function configureAi(): void {
    // The provider and model ids are those of canvas_metatag_ai_test.
    $echo = ['provider_id' => 'canvas_metatag_echo', 'model_id' => 'echo-json'];
    \Drupal::configFactory()->getEditable('ai.settings')
      ->set('default_providers.chat', $echo)
      ->set('default_providers.chat_with_structured_response', $echo)
      ->set('global_guardrails', ['canvas_metatag_e2e'])
      ->save();
    \Drupal::configFactory()->getEditable('ai.ai_prompt.canvas_metatag_search__default')
      ->set('prompt', self::AI_SEARCH_PROMPT)
      ->save();
    AiGuardrail::create([
      'id' => 'canvas_metatag_e2e_policy',
      'label' => 'Policy marker',
      'description' => '',
      'guardrail' => 'regexp_guardrail',
      'guardrail_settings' => [
        'regexp_pattern' => '/#policy/',
        'scan_all_user_messages' => FALSE,
        'violation_message' => 'Stopped by the site policy.',
      ],
    ])->save();
    AiGuardrailSet::create([
      'id' => 'canvas_metatag_e2e',
      'label' => 'Canvas Metatag e2e',
      'description' => '',
      'stop_threshold' => 1.0,
      'pre_generate_guardrails' => ['plugin_id' => ['canvas_metatag_e2e_policy']],
      'post_generate_guardrails' => ['plugin_id' => []],
    ])->save();
  }

  /**
   * Creates the "image" media type.
   */
  private function createImageMediaType(): void {
    $type = MediaType::create(['id' => 'image', 'label' => 'Image', 'source' => 'image']);
    $type->save();
    $source_field = $type->getSource()->createSourceField($type);
    $storage = $source_field->getFieldStorageDefinition();
    \assert($storage instanceof FieldStorageConfig);
    $storage->save();
    $source_field->save();
    $type->set('source_configuration', ['source_field' => $source_field->getName()])->save();
  }

  /**
   * Adds a second language and makes Canvas pages translatable.
   *
   * Canvas ships the page's base fields as not translatable, so without the
   * overrides a translation would overwrite the source text.
   */
  private function addTranslationLanguage(): void {
    ConfigurableLanguage::createFromLangcode(self::LANGCODE)->save();
    ContentLanguageSettings::loadByEntityTypeBundle('canvas_page', 'canvas_page')
      ->setDefaultLangcode(LanguageInterface::LANGCODE_SITE_DEFAULT)
      ->setLanguageAlterable(TRUE)
      ->save();
    \Drupal::service('content_translation.manager')->setEnabled('canvas_page', 'canvas_page', TRUE);

    $base = \Drupal::service('entity_field.manager')->getBaseFieldDefinitions('canvas_page');
    foreach (['title', 'description', 'components', 'image', 'path'] as $field_name) {
      \assert($base[$field_name] instanceof BaseFieldDefinition);
      $override = BaseFieldOverride::loadByName('canvas_page', 'canvas_page', $field_name)
        ?? BaseFieldOverride::createFromBaseFieldDefinition($base[$field_name], 'canvas_page');
      $override->set('translatable', TRUE)->save();
    }
    \Drupal::service('entity_field.manager')->clearCachedFieldDefinitions();
    \Drupal::service('router.builder')->rebuild();
  }

  /**
   * Creates the four people the specs sign in as.
   */
  private function createUsers(bool $headless, bool $ai): void {
    $canvas = [
      'access content',
      'view media',
      // Canvas's Page data form shows the URL alias only with it, and the
      // dialog's previews read the alias from that form.
      'create url aliases',
      Page::EDIT_PERMISSION,
      Page::CREATE_PERMISSION,
      AutoSaveManager::PUBLISH_PERMISSION,
      ContentTemplate::ADMIN_PERMISSION,
    ];
    if ($headless) {
      // Lets the spec mint the token a frontend previews drafts with.
      $canvas[] = 'access canvas headless preview';
    }
    $roles = [
      'e2e_canvas' => $canvas,
      'e2e_seo' => \array_merge(['edit canvas metatag'], $ai ? ['use canvas metatag ai'] : []),
      'e2e_seo_admin' => ['administer canvas metatag'],
      'e2e_seo_only' => ['access content', 'view media', 'edit canvas metatag'],
    ];
    foreach ($roles as $id => $permissions) {
      Role::create(['id' => $id, 'label' => $id, 'permissions' => $permissions])->save();
    }
    $users = [
      self::USER_NO_SEO => ['e2e_canvas'],
      self::USER_EDITOR => ['e2e_canvas', 'e2e_seo'],
      self::USER_ADMIN => ['e2e_canvas', 'e2e_seo', 'e2e_seo_admin'],
      self::USER_VIEWER => ['e2e_seo_only'],
    ];
    foreach ($users as $name => $user_roles) {
      User::create([
        'name' => $name,
        'mail' => $name . '@example.com',
        'pass' => $name,
        'status' => 1,
        'roles' => $user_roles,
      ])->save();
    }
  }

  /**
   * Creates an image media item of an exact size.
   */
  private function createImage(string $name, int $width, int $height, string $alt): Media {
    $uri = 'public://' . \strtolower(\str_replace(' ', '-', $name)) . '.png';
    $image = \imagecreatetruecolor($width, $height);
    \assert($image !== FALSE);
    $stream = \fopen($uri, 'wb');
    \assert($stream !== FALSE);
    \imagepng($image, $stream);
    \fclose($stream);

    $file = File::create(['uri' => $uri]);
    $file->setPermanent();
    $file->save();
    $media = Media::create([
      'bundle' => 'image',
      'name' => $name,
      'field_media_image' => ['target_id' => $file->id(), 'alt' => $alt],
    ]);
    $media->save();
    return $media;
  }

  /**
   * Creates a code component that renders a heading.
   *
   * A code component of our own, so that the fixture does not depend on
   * Canvas's test modules. Its "level" decides whether a page has a main
   * heading, which the Checks tab reports on.
   */
  private function createHeadingComponent(): Component {
    $source = <<<JS
      import { jsx as _jsx } from "react/jsx-runtime";
      export default function Heading({ text, level }) {
        return _jsx(level === "h1" ? "h1" : "h2", { children: text });
      }
      JS;
    JavaScriptComponent::create([
      'machineName' => 'metatag_e2e_heading',
      'name' => 'E2E Heading',
      'status' => TRUE,
      'props' => [
        'text' => [
          'type' => 'string',
          'title' => 'Text',
          'examples' => ['A heading'],
        ],
        'level' => [
          'type' => 'string',
          'title' => 'Level',
          'enum' => ['h1', 'h2'],
          'meta:enum' => ['h1' => 'Main heading', 'h2' => 'Section heading'],
          'examples' => ['h2'],
        ],
      ],
      'js' => ['original' => $source, 'compiled' => $source],
      'css' => ['original' => '', 'compiled' => ''],
      'slots' => [],
      'dataDependencies' => [],
    ])->save();
    $component = Component::load('js.metatag_e2e_heading');
    \assert($component instanceof Component);
    return $component;
  }

  /**
   * Returns a component tree holding one heading.
   *
   * @return list<array<string, mixed>>
   *   The tree, as a component tree field or a content template stores it.
   */
  private static function heading(Component $component, string $uuid, string $text, string $level): array {
    return [
      [
        'uuid' => $uuid,
        'component_id' => $component->id(),
        'component_version' => $component->getActiveVersion(),
        'inputs' => ['text' => $text, 'level' => $level],
      ],
    ];
  }

  /**
   * Creates Canvas pages 1 to 7.
   */
  private function createPages(Component $heading, Media $hero, Media $small): void {
    $home = Page::create([
      'title' => self::HOME_TITLE,
      'description' => 'Welcome to Example.',
      'path' => ['alias' => '/home'],
      'status' => 1,
    ]);
    $home->save();
    \Drupal::configFactory()->getEditable('system.site')
      ->set('page.front', '/' . $home->toUrl()->getInternalPath())
      ->save();

    Page::create([
      'title' => self::PRICING_TITLE,
      'description' => self::PRICING_DESCRIPTION,
      'path' => ['alias' => '/pricing'],
      'image' => ['target_id' => $hero->id()],
      'components' => self::heading($heading, self::PRICING_HEADING_UUID, self::PRICING_HEADING, 'h1'),
      'status' => 1,
    ])->save();

    $about = Page::create([
      'title' => self::ABOUT_TITLE,
      'description' => 'Who we are and how we work.',
      'path' => ['alias' => '/about'],
      'status' => 1,
    ]);
    $about->save();
    // Only what differs: copying the source's path would move its alias to
    // the translation.
    $about->addTranslation(self::LANGCODE, ['title' => self::ABOUT_TITLE_TRANSLATED, 'status' => 1]);
    $about->save();

    Page::create([
      'title' => self::CHECKS_TITLE,
      'description' => 'A page the Checks tab has something to say about.',
      'path' => ['alias' => '/checks'],
      'image' => ['target_id' => $small->id()],
      'components' => self::heading($heading, '9d2e4c71-5a3b-4f60-8e17-2c6b0a9d4f02', 'A section heading', 'h2'),
      'canvas_metatag' => \json_encode(['title' => ['text' => self::CHECKS_STORED_TITLE]], JSON_THROW_ON_ERROR),
      'status' => 1,
    ])->save();

    Page::create([
      'title' => self::STORED_TITLE,
      'path' => ['alias' => '/stored'],
      'canvas_metatag' => \json_encode(['title' => ['text' => self::STORED_SEO_TITLE]], JSON_THROW_ON_ERROR),
      'status' => 1,
    ])->save();

    // Described with a type this release no longer has. Changed long ago, so
    // it is never the page the dialog opens without one.
    Page::create([
      'title' => 'Night at the cinema',
      'path' => ['alias' => '/night-at-the-cinema'],
      'canvas_metatag' => \json_encode(['schema' => ['type' => 'Movie']], JSON_THROW_ON_ERROR),
      'status' => 1,
      'changed' => 946684800,
    ])->save();

    // Shows Drupal's breadcrumb: Home › About us, under the About page.
    $breadcrumb = Component::load('block.system_breadcrumb_block');
    \assert($breadcrumb instanceof Component);
    Page::create([
      'title' => 'Our team',
      'path' => ['alias' => '/about/team'],
      'components' => [
        [
          'uuid' => '5e8b1c2d-3f4a-4b6c-8d7e-9f0a1b2c3d4e',
          'component_id' => $breadcrumb->id(),
          'component_version' => $breadcrumb->getActiveVersion(),
          'inputs' => ['label' => '', 'label_display' => '0'],
        ],
      ],
      'status' => 1,
      'changed' => 946684800,
    ])->save();
  }

  /**
   * Creates the Article type, its enabled template, and nodes 1 to 3.
   */
  private function createContent(Component $heading, Media $hero, Media $article_image): void {
    NodeType::create(['type' => 'article', 'name' => 'Article'])->save();
    NodeType::create(['type' => 'page', 'name' => 'Basic page'])->save();
    $fields = [
      'field_summary' => ['string_long', 'Summary', [], []],
      'field_byline' => ['string', 'Byline', [], []],
      'field_hero' => [
        'entity_reference',
        'Hero image',
        ['target_type' => 'media'],
        ['handler' => 'default:media', 'handler_settings' => ['target_bundles' => ['image' => 'image']]],
      ],
    ];
    foreach ($fields as $name => [$type, $label, $storage_settings, $settings]) {
      FieldStorageConfig::create([
        'field_name' => $name,
        'entity_type' => 'node',
        'type' => $type,
        'settings' => $storage_settings,
      ])->save();
      FieldConfig::create([
        'field_name' => $name,
        'entity_type' => 'node',
        'bundle' => 'article',
        'label' => $label,
        'settings' => $settings,
      ])->save();
    }

    ContentTemplate::create([
      'content_entity_type_id' => 'node',
      'content_entity_type_bundle' => 'article',
      'content_entity_type_view_mode' => 'full',
      'component_tree' => self::heading($heading, '5c8a1f93-2b6d-4a47-b0e9-7f3d2c1e8a03', 'From the blog', 'h2'),
      'status' => TRUE,
    ])->save();

    // The author's name is what the Author fact publishes.
    $author = User::create(['name' => 'Site Author', 'mail' => 'author@example.com', 'status' => 1]);
    $author->save();
    $articles = [
      [self::ARTICLE_TITLE, '/blog/how-we-rebuilt-our-editor', self::ARTICLE_SUMMARY, self::ARTICLE_BYLINE, $hero],
      [
        self::SECOND_ARTICLE_TITLE,
        '/blog/a-year-of-releases',
        self::SECOND_ARTICLE_SUMMARY,
        self::SECOND_ARTICLE_BYLINE,
        $article_image,
      ],
    ];
    foreach ($articles as [$title, $alias, $summary, $byline, $image]) {
      Node::create([
        'type' => 'article',
        'title' => $title,
        'uid' => $author->id(),
        'path' => ['alias' => $alias],
        'field_summary' => $summary,
        'field_byline' => $byline,
        'field_hero' => ['target_id' => $image->id()],
        'status' => 1,
      ])->save();
    }
    Node::create([
      'type' => 'page',
      'title' => self::PLAIN_NODE_TITLE,
      'uid' => $author->id(),
      'path' => ['alias' => '/plain-page'],
      'status' => 1,
    ])->save();
  }

  /**
   * Adds the complex content fixture, with the ids the specs expect.
   *
   * @see \Drupal\Tests\canvas_metatag\Fixture\ComplexContent
   */
  private function installComplexContent(): void {
    \Drupal::service('module_installer')->install(['taxonomy']);
    // The editors of this project manage the content they template: they
    // preview a draft event and add the first announcement.
    \user_role_grant_permissions('e2e_canvas', ['bypass node access']);
    ComplexContent::createComponentDoubles();
    $ids = ComplexContent::install();
    $wrong = \array_diff_assoc(self::COMPLEX_NODES, \array_intersect_key($ids['node'], self::COMPLEX_NODES));
    if ($wrong) {
      throw new \RuntimeException('The complex fixture made other node ids than the specs expect: ' . \implode(', ', \array_keys($wrong)));
    }
    // A template whose link broke: its field was deleted after it was
    // linked. Stored as it would be; no write could make it now.
    $template = ContentTemplate::load('node.article.full');
    \assert($template instanceof ContentTemplate);
    $template->setThirdPartySetting('canvas_metatag', 'values', [
      'description' => [
        'source' => [
          'sourceType' => 'entity-field',
          'expression' => 'ℹ︎␜entity:node:article␝' . self::GONE_FIELD . '␞␟value',
        ],
      ],
    ])->save();
    // A composed title on a type with no content yet, as configuration
    // import gives one: shown at rest, with nothing to preview.
    $announcement = ContentTemplate::load('node.announcement.full');
    \assert($announcement instanceof ContentTemplate);
    $announcement->setThirdPartySetting('canvas_metatag', 'values', [
      'title' => ['parts' => [['fact' => 'title'], ['text' => ' · '], ['fact' => 'site']]],
    ] + $announcement->getThirdPartySetting('canvas_metatag', 'values', []))->save();
  }

  /**
   * Adds five courses, four with a summary, and a page that lists them.
   *
   * Every Course is described as a course; Every Course list as a list page
   * whose pages it lists come from its Courses field.
   */
  private function installCourses(): void {
    foreach (['course' => 'Course', 'course_list' => 'Course list'] as $bundle => $label) {
      NodeType::create(['type' => $bundle, 'name' => $label])->save();
    }
    FieldConfig::create(['field_name' => 'body', 'entity_type' => 'node', 'bundle' => 'course', 'label' => 'Summary'])->save();
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
      'bundle' => 'course_list',
      'label' => 'Courses',
      'settings' => ['handler' => 'default:node', 'handler_settings' => ['target_bundles' => ['course' => 'course']]],
    ])->save();
    $display = \Drupal::service('entity_display.repository');
    $display->getFormDisplay('node', 'course')->setComponent('body')->save();
    $display->getFormDisplay('node', 'course_list')->setComponent('field_courses')->save();
    $ids = [];
    foreach ([
      'Drupal basics' => 'Build your first site in a day.',
      'Site building' => 'Content types, fields and views.',
      'Theming' => '',
      'Accessibility' => 'Pages that work for everyone.',
      'Content modelling' => 'Fields that fit what you publish.',
    ] as $title => $summary) {
      $node = Node::create([
        'type' => 'course',
        'title' => $title,
        'status' => 1,
        'body' => $summary === '' ? [] : ['value' => "<p>$summary</p>", 'format' => 'plain_text'],
      ]);
      $node->save();
      $ids[] = (int) $node->id();
    }
    $list = Node::create(['type' => 'course_list', 'title' => 'All courses', 'status' => 1, 'field_courses' => $ids]);
    $list->save();
    if ((int) $list->id() !== self::COURSE_LIST_NODE) {
      throw new \RuntimeException("The course list is node {$list->id()}, not " . self::COURSE_LIST_NODE . '.');
    }
    $templates = [
      'course' => ['type' => 'Course'],
      'course_list' => [
        'type' => 'CollectionPage',
        'props' => [
          'items' => [
            'source' => [
              'sourceType' => 'entity-field',
              'expression' => 'ℹ︎␜entity:node:course_list␝field_courses␞␟entity␜␜entity:node␝title␞␟value',
            ],
          ],
        ],
      ],
    ];
    foreach ($templates as $bundle => $schema) {
      ContentTemplate::create([
        'content_entity_type_id' => 'node',
        'content_entity_type_bundle' => $bundle,
        'content_entity_type_view_mode' => 'full',
        'component_tree' => [],
        'status' => TRUE,
        'third_party_settings' => ['canvas_metatag' => ['values' => ['schema' => $schema]]],
      ])->save();
    }
  }

  /**
   * Connects one frontend and gives the token endpoint its signing keys.
   *
   * Articles are described as articles, so that their heads carry the
   * article times a frontend must keep.
   */
  private function configureHeadless(): void {
    $directory = \Drupal::root() . '/' . \Drupal::getContainer()->getParameter('site.path') . '/keys';
    \mkdir($directory, 0700, TRUE);
    $key = \openssl_pkey_new(['private_key_bits' => 2048]);
    \assert($key !== FALSE);
    \openssl_pkey_export($key, $private);
    $details = \openssl_pkey_get_details($key);
    \assert($details !== FALSE);
    foreach (['private' => $private, 'public' => $details['key']] as $name => $contents) {
      \file_put_contents("$directory/$name.key", $contents);
      // The token library refuses keys that others can read.
      \chmod("$directory/$name.key", 0600);
    }
    \Drupal::configFactory()->getEditable('simple_oauth.settings')
      ->set('private_key', "$directory/private.key")
      ->set('public_key', "$directory/public.key")
      ->save();
    \Drupal::configFactory()->getEditable('canvas_headless.settings')
      ->set('frontends', [['url' => self::FRONTEND_URL, 'components' => []]])
      ->save();
    $template = ContentTemplate::load('node.article.full');
    \assert($template instanceof ContentTemplate);
    $template->setThirdPartySetting('canvas_metatag', 'values', ['schema' => ['type' => 'Article']])->save();
    // Previewed at template scope, it has no description to send.
    Node::create(['type' => 'article', 'title' => self::NO_SUMMARY_TITLE, 'status' => 1])->save();
  }

}
