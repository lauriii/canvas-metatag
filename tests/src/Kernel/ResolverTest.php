<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Values;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\file\Entity\File;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\taxonomy\Entity\Term;
use Drupal\taxonomy\Entity\Vocabulary;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use Drupal\user\Entity\Role;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

// cspell:ignore Tarifs tarifs ville amet Canvasville Preise Accueil
/**
 * Tests ownership, layers, tokens, URLs, the head and its cacheability.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Resolver::class)]
#[Group('canvas_metatag')]
final class ResolverTest extends CanvasKernelTestBase {

  use ContentTranslationTestTrait;
  use GenerateComponentConfigTrait;
  use SeoFixtureTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'taxonomy',
    'telephone',
    'datetime_range',
    'language',
    'content_translation',
    // Refuses `view` on a field named field_no_view_access.
    'entity_test',
    'field_test',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->installEntitySchema('taxonomy_term');
    $this->installConfig(['language']);
    ConfigurableLanguage::createFromLangcode('fr')->save();
    ConfigurableLanguage::createFromLangcode('de')->save();
    $this->enableContentTranslation(Page::ENTITY_TYPE_ID, Page::ENTITY_TYPE_ID);
    // The language path processor exists only on a multilingual site.
    $this->container->get('kernel')->rebuildContainer();
    $this->generateComponentConfig();
  }

  /**
   * A page is always ours; a node when its full template is enabled.
   */
  public function testOwnershipAndLayers(): void {
    $resolver = $this->resolver();
    $page = $this->createPage(['canvas_metatag' => '{"title":"Plans {sep} {site}","robots":{"noindex":true},"bogus":1,"canonical":"no-slash"}']);
    $node = Node::create(['type' => 'article', 'title' => 'Hello']);
    $node->save();
    NodeType::create(['type' => 'note', 'name' => 'Note'])->save();
    $note = Node::create(['type' => 'note', 'title' => 'A note']);
    $note->save();

    self::assertTrue($resolver->owns($page));
    self::assertFalse($resolver->owns($this->author));
    // No template at all.
    self::assertFalse($resolver->owns($node));
    self::assertFalse($resolver->owns($node, TRUE));
    $cacheability = new CacheableMetadata();
    self::assertSame([], $resolver->layers($node, FALSE, $cacheability)['target']);
    self::assertContains('config:content_template_list', $cacheability->getCacheTags());

    // A template that was never published counts only for a draft preview.
    $template = $this->createTemplate(FALSE, ['title' => '{title} {sep} Blog', 'robots' => ['nofollow' => TRUE]]);
    self::assertFalse($resolver->owns($node));
    self::assertTrue($resolver->owns($node, TRUE));
    self::assertFalse($resolver->owns($note, TRUE));
    $template->setStatus(TRUE)->save();
    self::assertTrue($resolver->owns($node));
    self::assertFalse($resolver->owns($note));

    // Page over site. What any other write path stored is cleaned on read.
    $cacheability = new CacheableMetadata();
    $layers = $resolver->layers($page, FALSE, $cacheability);
    self::assertSame(['robots' => ['noindex' => TRUE], 'title' => 'Plans {sep} {site}'], $layers['target']);
    self::assertSame(['robots' => ['max_image_preview' => 'large'], 'title' => '{title} {sep} {site}'], $layers['site']);
    self::assertSame('|', $layers['identity']['separator']);
    self::assertSame([], $layers['from_default']);
    self::assertContains('config:canvas_metatag.site', $cacheability->getCacheTags());
    self::assertSame(
      ['robots' => ['noindex' => TRUE, 'max_image_preview' => 'large'], 'title' => 'Plans {sep} {site}'],
      Values::cascade($layers['target'], $layers['site']),
    );

    // Template over site, and the template's draft only when asked for.
    $cacheability = new CacheableMetadata();
    $layers = $resolver->layers($node, FALSE, $cacheability);
    self::assertSame(['robots' => ['nofollow' => TRUE], 'title' => '{title} {sep} Blog'], $layers['target']);
    self::assertContains('config:canvas.content_template.node.article.full', $cacheability->getCacheTags());
    self::assertNotContains(AutoSaveManager::CACHE_TAG, $cacheability->getCacheTags());
    $draft = clone $template;
    $draft->setThirdPartySetting('canvas_metatag', 'values', ['title' => 'Draft pattern']);
    $this->container->get(AutoSaveManager::class)->saveEntity($draft);
    self::assertSame('{title} {sep} Blog', $resolver->layers($node, FALSE, new CacheableMetadata())['target']['title']);
    $cacheability = new CacheableMetadata();
    self::assertSame(['title' => 'Draft pattern'], $resolver->layers($node, TRUE, $cacheability)['target']);
    self::assertContains(AutoSaveManager::CACHE_TAG, $cacheability->getCacheTags());
    self::assertSame('Hello | Blog', $resolver->resolve($node)['head']['title']);
    $node = Node::load($node->id());
    self::assertSame('Draft pattern', $resolver->resolve($node, TRUE)['head']['title']);

    // A translation that is not the default one inherits three settings of
    // the default one, and nothing else.
    $image = $this->createImage('Shared');
    $page = $this->createPage([
      'path' => ['alias' => '/plans'],
      'canvas_metatag' => Values::encode([
        'canonical' => '/elsewhere',
        'robots' => ['noindex' => TRUE, 'max_snippet' => 50],
        'schema' => ['type' => 'Article', 'props' => ['headline' => 'English headline']],
        'social' => ['image' => $image->uuid(), 'title' => 'English social title'],
        'title' => 'English title',
      ]),
    ]);
    $french = $page->addTranslation('fr', ['title' => 'Tarifs', 'status' => TRUE, 'path' => ['alias' => '/tarifs']]);
    // The details of the inherited type are stored without a type.
    $french->set('canvas_metatag', '{"robots":{"max_snippet":-1},"schema":{"props":{"headline":"Titre"}},"social":{"title":"Titre social"}}');
    $page->save();
    $french = Page::load($page->id())->getTranslation('fr');
    $layers = $resolver->layers($french, FALSE, new CacheableMetadata());
    self::assertSame([
      'robots' => ['max_snippet' => 50, 'noindex' => TRUE],
      'schema' => ['type' => 'Article'],
      'social' => ['image' => $image->uuid()],
    ], $layers['from_default']);
    self::assertSame([
      'robots' => ['max_snippet' => -1],
      'schema' => ['props' => ['headline' => 'Titre']],
      'social' => ['title' => 'Titre social'],
    ], $layers['target']);
    self::assertSame([], $resolver->layers($page, FALSE, new CacheableMetadata())['from_default']);

    $resolved = $resolver->resolve($french);
    $meta = self::meta($resolved['head']);
    self::assertSame('Tarifs | Example', $resolved['head']['title']);
    self::assertSame('noindex, max-image-preview:large', $meta['robots']);
    self::assertSame('article', $meta['og:type']);
    self::assertSame('Titre social', $meta['og:title']);
    self::assertSame($this->imageOf($image)['url'], $meta['og:image']);
    self::assertSame('override', $resolved['image']['source']);
    // Neither the canonical nor the text of the other language.
    self::assertSame('http://localhost/fr/tarifs', $meta['og:url']);
    self::assertSame('Titre', self::graph($resolved['head'])['primary']['headline']);
  }

  /**
   * The tokens of a page (stored and draft) and of a node, per field type.
   */
  public function testTokens(): void {
    $resolver = $this->resolver();
    $hero = $this->createImage('Pricing hero', ['alt' => 'Pricing table']);
    $page = $this->createPage(['image' => $hero->id()]);
    $cacheability = new CacheableMetadata();
    $tokens = $resolver->tokens($page, 'canvas_page', 'canvas_page', $cacheability);
    self::assertSame([
      'title' => ['label' => 'Page title', 'type' => 'text', 'value' => 'Pricing'],
      'description' => ['label' => 'Description', 'type' => 'text', 'value' => 'Plans and prices for Example.'],
      'site' => ['label' => 'Site name', 'type' => 'text', 'value' => 'Example'],
      'sep' => ['label' => 'Separator', 'type' => 'text', 'value' => '|'],
      'url' => ['label' => 'Page address', 'type' => 'url', 'value' => 'http://localhost/pricing'],
      'author' => ['label' => 'Author', 'type' => 'text', 'value' => 'Ada Writer'],
      'published' => ['label' => 'First published', 'type' => 'datetime', 'value' => self::PUBLISHED],
      'modified' => ['label' => 'Last updated', 'type' => 'datetime', 'value' => self::MODIFIED],
      'image' => ['label' => 'Page image', 'type' => 'image', 'value' => '', 'image' => $this->imageOf($hero)],
    ], $tokens);
    self::assertSame(array_map(static fn (array $token): string => $token['type'], $tokens), $resolver->tokenTypes('canvas_page', 'canvas_page'));
    // The author's name is public although profiles are not: anonymous
    // visitors have no permission to view them here.
    self::assertFalse(Role::load('anonymous')?->hasPermission('access user profiles'));
    self::assertContains('user:' . $this->author->id(), $cacheability->getCacheTags());

    // The identity name wins over the site name. With no entity the map
    // holds labels and types only.
    $this->config('canvas_metatag.site')->set('identity.name', 'Example Ltd')->set('identity.separator', '·')->save();
    $draft = clone $page;
    $draft->set('title', 'Draft title')->set('description', 'Draft description.');
    $tokens = $resolver->tokens($draft, 'canvas_page', 'canvas_page', new CacheableMetadata());
    self::assertSame(
      ['Draft title', 'Draft description.', 'Example Ltd', '·'],
      [$tokens['title']['value'], $tokens['description']['value'], $tokens['site']['value'], $tokens['sep']['value']],
    );
    $empty = $resolver->tokens(NULL, 'canvas_page', 'canvas_page', new CacheableMetadata());
    self::assertSame(array_keys($tokens), array_keys($empty));
    self::assertSame([''], array_values(array_unique(array_column($empty, 'value'))));
    self::assertNull($empty['image']['image']);

    // One field of every supported type on the Article type.
    Vocabulary::create(['vid' => 'topics', 'name' => 'Topics'])->save();
    $this->createField('field_secret', 'string', 'Secret');
    $this->createField('field_no_view_access', 'string', 'Hidden');
    $this->createField('field_byline', 'string', 'Byline', cardinality: 2);
    $this->createField('field_note', 'string_long', 'Note');
    $this->createField('field_email', 'email', 'Email');
    $this->createField('field_phone', 'telephone', 'Phone');
    $this->createField('field_level', 'list_string', 'Level', [
      'allowed_values' => ['pro' => 'Professional', 'free' => 'Free'],
    ]);
    $this->createField('field_teaser', 'text', 'Teaser');
    $this->createField('field_notes', 'text_long', 'Notes');
    $this->createField('field_body', 'text_with_summary', 'Body');
    $this->createField('field_count', 'integer', 'Count');
    $this->createField('field_price', 'decimal', 'Price', ['precision' => 10, 'scale' => 2]);
    $this->createField('field_ratio', 'float', 'Ratio');
    $this->createField('field_starts', 'datetime', 'Starts', ['datetime_type' => 'datetime']);
    $this->createField('field_day', 'datetime', 'Day', ['datetime_type' => 'date']);
    $this->createField('field_period', 'daterange', 'Period', ['datetime_type' => 'datetime']);
    $this->createField('field_stamp', 'timestamp', 'Stamp');
    $this->createField('field_link', 'link', 'Link');
    $this->createField('field_inside', 'link', 'Inside link');
    $this->createField('field_photo', 'image', 'Photo');
    $this->createField('field_hero', 'entity_reference', 'Hero image', ['target_type' => 'media'], [
      'handler' => 'default:media',
      'handler_settings' => ['target_bundles' => ['image' => 'image']],
    ]);
    $this->createField('field_topic', 'entity_reference', 'Topic', ['target_type' => 'taxonomy_term'], [
      'handler' => 'default:taxonomy_term',
      'handler_settings' => ['target_bundles' => ['topics' => 'topics']],
    ]);
    $this->createField('field_old_topic', 'entity_reference', 'Old topic', ['target_type' => 'taxonomy_term'], [
      'handler' => 'default:taxonomy_term',
      'handler_settings' => ['target_bundles' => ['topics' => 'topics']],
    ]);
    $this->createField('field_flag', 'boolean', 'Flag');

    $topic = Term::create(['vid' => 'topics', 'name' => 'Releases']);
    $topic->save();
    $old_topic = Term::create(['vid' => 'topics', 'name' => 'Retired', 'status' => FALSE]);
    $old_topic->save();
    $photo = File::load($this->createImage('Photo')->get('field_media_image')->first()?->get('target_id')->getValue());
    self::assertInstanceOf(File::class, $photo);
    $article_hero = $this->createImage('Article hero', ['alt' => 'A waving hand', 'width' => 800, 'height' => 400]);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'uid' => $this->author->id(),
      'created' => strtotime(self::CREATED),
      'changed' => strtotime(self::CHANGED),
      'field_secret' => 'I <3 Canvas',
      'field_no_view_access' => 'Not for visitors',
      'field_byline' => ['First byline', 'Second byline'],
      'field_note' => "Line one\nline two",
      'field_email' => 'ada@example.com',
      'field_phone' => '+358 40 1234567',
      'field_level' => 'pro',
      'field_teaser' => ['value' => '<em>Short</em> &amp; sweet'],
      'field_notes' => ['value' => "<p>One</p><p>Two&nbsp;three</p>\n<script>alert(1)</script><ul><li>H<sub>2</sub>O in <em>Canvas</em>ville</li><li>Two</li></ul>"],
      'field_body' => ['value' => '<p>' . str_repeat('Lorem ipsum dolor sit amet. ', 10) . '</p>', 'summary' => ''],
      'field_count' => 42,
      'field_price' => '49.90',
      'field_ratio' => 1.5,
      'field_starts' => '2026-03-02T07:00:00',
      'field_day' => '2026-03-02',
      'field_period' => ['value' => '2026-03-02T07:00:00', 'end_value' => '2026-03-03T07:00:00'],
      'field_stamp' => strtotime(self::CHANGED),
      'field_link' => ['uri' => 'https://www.example.org/more?x=1'],
      'field_inside' => ['uri' => 'internal:/pricing'],
      'field_photo' => ['target_id' => $photo->id(), 'alt' => 'A photo', 'width' => 640, 'height' => 480],
      'field_hero' => $article_hero->id(),
      'field_topic' => $topic->id(),
      'field_old_topic' => $old_topic->id(),
      'field_flag' => TRUE,
    ]);
    $node->save();

    $cacheability = new CacheableMetadata();
    $tokens = $resolver->tokens($node, 'node', 'article', $cacheability);
    self::assertSame(array_map(static fn (array $token): string => $token['type'], $tokens), $resolver->tokenTypes('node', 'article'));
    self::assertArrayNotHasKey('field.field_flag', $tokens);
    self::assertArrayNotHasKey('field.title', $tokens);
    self::assertSame([
      'label' => 'Hero image',
      'type' => 'image',
      'value' => '',
      'image' => $this->imageOf($article_hero),
    ], $tokens['field.field_hero']);
    $values = array_map(static fn (array $token): string => $token['value'], $tokens);
    $long = trim(str_repeat('Lorem ipsum dolor sit amet. ', 10));
    // Compared without regard to order: without a form, fields come by name.
    self::assertEquals([
      'title' => 'Hello',
      // The formatted text with a summary: no summary, so its text, cut at a
      // word boundary within 160 characters.
      'description' => str_repeat('Lorem ipsum dolor sit amet. ', 5) . 'Lorem ipsum dolor',
      'site' => 'Example Ltd',
      'sep' => '·',
      'url' => 'http://localhost/node/' . $node->id(),
      'author' => 'Ada Writer',
      'published' => self::PUBLISHED,
      'modified' => self::MODIFIED,
      'image' => '',
      // Text a person typed into a plain field is never stripped.
      'field.field_secret' => 'I <3 Canvas',
      // A field the visitor may not view.
      'field.field_no_view_access' => '',
      // Only the first value.
      'field.field_byline' => 'First byline',
      'field.field_note' => "Line one\nline two",
      'field.field_email' => 'ada@example.com',
      'field.field_phone' => '+358 40 1234567',
      'field.field_level' => 'Professional',
      'field.field_teaser' => 'Short & sweet',
      // Blocks are apart, inline markup keeps its words whole.
      // A script's content never displays.
      'field.field_notes' => 'One Two three H2O in Canvasville Two',
      'field.field_body' => $long,
      'field.field_count' => '42',
      'field.field_price' => '49.90',
      'field.field_ratio' => '1.5',
      'field.field_starts' => self::PUBLISHED,
      'field.field_day' => '2026-03-02',
      'field.field_period' => self::PUBLISHED,
      'field.field_stamp' => self::MODIFIED,
      'field.field_link' => 'https://www.example.org/more?x=1',
      'field.field_inside' => 'http://localhost/pricing',
      'field.field_photo' => '',
      'field.field_hero' => '',
      'field.field_topic' => 'Releases',
      // A referenced entity the visitor may not see.
      'field.field_old_topic' => '',
    ], $values);
    self::assertLessThanOrEqual(160, mb_strlen($values['description']));
    // A plain image field is named by its alt text (else after its file).
    self::assertSame(
      ['width' => 640, 'height' => 480, 'alt' => 'A photo', 'name' => 'A photo'],
      array_intersect_key($tokens['field.field_photo']['image'], ['name' => 1, 'alt' => 1, 'width' => 1, 'height' => 1]),
    );
    // {image} is the first image; without a form, by name.
    self::assertSame($tokens['field.field_hero']['image'], $tokens['image']['image']);
    self::assertSame('Byline', $tokens['field.field_byline']['label']);
    foreach ([
      'taxonomy_term:' . $topic->id(),
      'taxonomy_term:' . $old_topic->id(),
      'media:' . $article_hero->id(),
      'file:' . $photo->id(),
      'config:user.role.anonymous',
    ] as $tag) {
      self::assertContains($tag, $cacheability->getCacheTags());
    }
    self::assertSame([], array_filter($cacheability->getCacheContexts(), static fn (string $context): bool => str_starts_with($context, 'user')));

    // A summary wins. When the first image is not usable, {image} is the
    // next one; an unpublished image media and a file that is not public are
    // no image.
    // The file object is the one the node's field item loads, so it is
    // changed only when it is saved as well.
    $node->set('field_body', ['value' => '<p>Text</p>', 'summary' => 'A <i>short</i> summary.'])->save();
    $article_hero->setUnpublished()->save();
    $this->forgetAccess();
    $tokens = $resolver->tokens(Node::load($node->id()), 'node', 'article', new CacheableMetadata());
    self::assertSame('A short summary.', $tokens['description']['value']);
    self::assertSame('A short summary.', $tokens['field.field_body']['value']);
    self::assertNull($tokens['field.field_hero']['image']);
    self::assertSame($tokens['field.field_photo']['image'], $tokens['image']['image']);
    self::assertNotNull($tokens['image']['image']);
    $photo->setFileUri('temporary://photo.png');
    $photo->save();
    $this->forgetAccess();
    $tokens = $resolver->tokens(Node::load($node->id()), 'node', 'article', new CacheableMetadata());
    self::assertNull($tokens['field.field_photo']['image']);
    self::assertNull($tokens['image']['image']);

    // The content of script, style and template elements never displays.
    $hidden = '<script>alert(1)</script><style>p{color:red}</style><template><p>Later</p></template>';
    $node->set('field_body', ['value' => '<p>Ask us</p>' . $hidden, 'summary' => ''])->save();
    $tokens = $resolver->tokens(Node::load($node->id()), 'node', 'article', new CacheableMetadata());
    self::assertSame('Ask us', $tokens['field.field_body']['value']);
    self::assertSame('Ask us', $tokens['description']['value']);
    // Also with ">" in a quoted attribute, and a template inside another.
    $hidden = '<script data-x="a>b">alert(1)</script><template><template>Inner</template>Outer</template>';
    $node->set('field_body', ['value' => '<p>Ask us</p>' . $hidden . '<p>today</p>', 'summary' => ''])->save();
    $tokens = $resolver->tokens(Node::load($node->id()), 'node', 'article', new CacheableMetadata());
    self::assertSame('Ask us today', $tokens['field.field_body']['value']);

    // The cut {description} never ends inside a character drawn as one.
    $family = "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}";
    foreach ([
      [str_repeat('a', 157) . $family . ' tail', str_repeat('a', 157)],
      [str_repeat('a', 159) . "e\u{301} tail", str_repeat('a', 159)],
    ] as [$body, $description]) {
      $node->set('field_body', ['value' => "<p>$body</p>", 'summary' => ''])->save();
      $tokens = $resolver->tokens(Node::load($node->id()), 'node', 'article', new CacheableMetadata());
      self::assertSame($description, $tokens['description']['value']);
    }
  }

  /**
   * The first field of a kind is the first on the type's form.
   */
  public function testFormOrder(): void {
    $resolver = $this->resolver();
    $handler = ['handler' => 'default:media', 'handler_settings' => ['target_bundles' => ['image' => 'image']]];
    $this->createField('field_photo', 'entity_reference', 'Photo', ['target_type' => 'media'], $handler);
    $this->createField('field_avatar', 'entity_reference', 'Avatar', ['target_type' => 'media'], $handler);
    $this->createField('field_note', 'string', 'Note');
    $photo = $this->createImage('Photo', ['alt' => 'A photo']);
    $avatar = $this->createImage('Avatar', ['alt' => 'An avatar']);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Ada',
      'field_photo' => $photo->id(),
      'field_avatar' => $avatar->id(),
    ]);
    $node->save();
    $image = fn (): ?array => $resolver->tokens(Node::load($node->id()), 'node', 'article', new CacheableMetadata())['image']['image'];

    // Without a form, by name; the head waits for a form to be created.
    self::assertSame($this->imageOf($avatar), $image());
    $head = fn (): array => $resolver->resolve($this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($node->id()))['cacheability']->getCacheTags();
    self::assertContains('config:entity_form_display_list', $head());
    self::assertSame(['field.field_avatar', 'field.field_note', 'field.field_photo'], array_keys(array_filter($resolver->tokenTypes('node', 'article'), static fn (string $name): bool => str_starts_with($name, 'field.'), ARRAY_FILTER_USE_KEY)));

    // The form puts the photo first; a field not on the form comes last.
    $display = $this->container->get('entity_display.repository')->getFormDisplay('node', 'article')
      ->setComponent('field_photo', ['weight' => 1])
      ->setComponent('field_avatar', ['weight' => 2])
      ->removeComponent('field_note');
    $display->save();
    self::assertSame($this->imageOf($photo), $image());
    self::assertSame(['field.field_photo', 'field.field_avatar', 'field.field_note'], array_keys(array_filter($resolver->tokenTypes('node', 'article'), static fn (string $name): bool => str_starts_with($name, 'field.'), ARRAY_FILTER_USE_KEY)));

    // The head depends on the form.
    self::assertContains('config:core.entity_form_display.node.article.default', $head());

    // Moving the photo below the avatar changes {image}.
    $display->setComponent('field_photo', ['weight' => 3])->save();
    self::assertSame($this->imageOf($avatar), $image());
  }

  /**
   * The fallbacks, robots, images, URLs and alternates of the head.
   */
  public function testHead(): void {
    $resolver = $this->resolver();
    $logo = $this->createImage('Logo', ['width' => 512, 'height' => 512]);
    $default = $this->createImage('Default image', ['alt' => 'The default']);
    $hero = $this->createImage('Pricing hero', ['alt' => "Pricing \n table"]);
    $this->config('canvas_metatag.site')
      ->set('identity.logo', $logo->uuid())
      ->set('identity.default_image', $default->uuid())
      ->set('identity.same_as', ['https://social.example.com/example'])
      ->save();

    // Nothing set on the page: every row of the head, in order.
    $page = $this->createPage(['image' => $hero->id()]);
    $resolved = $resolver->resolve($page);
    $url = 'http://localhost/pricing';
    $image_url = $this->imageOf($hero)['url'];
    self::assertSame('Pricing | Example', $resolved['head']['title']);
    self::assertSame([
      ['name' => 'description', 'content' => 'Plans and prices for Example.'],
      ['name' => 'robots', 'content' => 'max-image-preview:large'],
      ['property' => 'og:type', 'content' => 'website'],
      ['property' => 'og:site_name', 'content' => 'Example'],
      ['property' => 'og:title', 'content' => 'Pricing'],
      ['property' => 'og:description', 'content' => 'Plans and prices for Example.'],
      ['property' => 'og:url', 'content' => $url],
      ['property' => 'og:image', 'content' => $image_url],
      ['property' => 'og:image:width', 'content' => '1200'],
      ['property' => 'og:image:height', 'content' => '630'],
      ['property' => 'og:image:alt', 'content' => 'Pricing table'],
      ['name' => 'twitter:card', 'content' => 'summary_large_image'],
    ], $resolved['head']['meta']);
    self::assertSame([['rel' => 'canonical', 'href' => $url]], $resolved['head']['link']);
    // The documented return shape, pinned at run time.
    // @phpstan-ignore staticMethod.alreadyNarrowedType
    self::assertSame(['title', 'meta', 'link', 'script'], array_keys($resolved['head']));
    // @phpstan-ignore staticMethod.alreadyNarrowedType
    self::assertSame(['type', 'textContent'], array_keys($resolved['head']['script'][0]));
    self::assertSame('application/ld+json', $resolved['head']['script'][0]['type']);
    self::assertSame($this->imageOf($hero) + ['source' => 'entity'], $resolved['image']);
    self::assertSame(['withheld' => FALSE, 'missing_required' => [], 'missing_recommended' => []], $resolved['schema']);
    self::assertSame([
      '@context' => 'https://schema.org',
      '@graph' => [
        [
          '@type' => 'Organization',
          '@id' => 'http://localhost/#identity',
          'name' => 'Example',
          'url' => 'http://localhost/',
          'logo' => ['@id' => 'http://localhost/#logo'],
          'sameAs' => ['https://social.example.com/example'],
        ],
        [
          '@type' => 'ImageObject',
          '@id' => 'http://localhost/#logo',
          'url' => $this->imageOf($logo)['url'],
          'contentUrl' => $this->imageOf($logo)['url'],
          'width' => 512,
          'height' => 512,
        ],
        [
          '@type' => 'WebSite',
          '@id' => 'http://localhost/#website',
          'url' => 'http://localhost/',
          'name' => 'Example',
          'inLanguage' => 'en',
          'publisher' => ['@id' => 'http://localhost/#identity'],
        ],
        [
          '@type' => 'WebPage',
          '@id' => "$url#webpage",
          'url' => $url,
          'name' => 'Pricing',
          'description' => 'Plans and prices for Example.',
          'inLanguage' => 'en',
          'isPartOf' => ['@id' => 'http://localhost/#website'],
          'datePublished' => self::PUBLISHED,
          'dateModified' => self::MODIFIED,
          'primaryImageOfPage' => ['@id' => "$url#primaryimage"],
        ],
        [
          '@type' => 'ImageObject',
          '@id' => "$url#primaryimage",
          'url' => $image_url,
          'contentUrl' => $image_url,
          'width' => 1200,
          'height' => 630,
          'caption' => 'Pricing table',
        ],
      ],
    ], $resolved['head']['script'][0]['textContent']);
    // The same entity object in the same request is resolved once.
    self::assertSame($resolved['cacheability'], $resolver->resolve($page)['cacheability']);

    // Overrides, an Article with its two extra rows, and the canonical as a
    // path. The structured data keeps the page's own address.
    $small = $this->createImage('Small', ['width' => 200, 'height' => 100]);
    $resolved = $resolver->resolve($this->createPage([
      'title' => 'I <3 Canvas &amp; more',
      'path' => ['alias' => '/love'],
      'canvas_metatag' => Values::encode([
        'canonical' => '/plans?ref=1',
        'robots' => [
          'noindex' => TRUE,
          'nofollow' => FALSE,
          'nosnippet' => TRUE,
          'max_snippet' => 50,
          'max_image_preview' => 'none',
        ],
        'schema' => ['type' => 'Article'],
        'social' => ['title' => '{title}: compare', 'description' => 'See every plan.', 'image' => $small->uuid()],
        'title' => '{sep} {title} {sep} {sep} {field.gone} {site} {sep}',
      ]),
    ]));
    $meta = self::meta($resolved['head']);
    self::assertSame('I <3 Canvas &amp; more | Example', $resolved['head']['title']);
    self::assertSame('noindex, nosnippet, max-image-preview:none', $meta['robots']);
    self::assertSame('I <3 Canvas &amp; more: compare', $meta['og:title']);
    self::assertSame('See every plan.', $meta['og:description']);
    self::assertSame('Plans and prices for Example.', $meta['description']);
    self::assertSame('http://localhost/plans?ref=1', $meta['og:url']);
    self::assertSame('http://localhost/plans?ref=1', $resolved['head']['link'][0]['href']);
    self::assertSame('article', $meta['og:type']);
    self::assertSame(self::PUBLISHED, $meta['article:published_time']);
    self::assertSame(self::MODIFIED, $meta['article:modified_time']);
    self::assertSame(['og:image:height', 'article:published_time', 'article:modified_time', 'twitter:card'], array_slice(array_keys($meta), -4));
    self::assertSame('override', $resolved['image']['source']);
    // Too small for the large card.
    self::assertSame('summary', $meta['twitter:card']);
    self::assertArrayNotHasKey('og:image:alt', $meta);
    $graph = self::graph($resolved['head']);
    self::assertSame('http://localhost/love#webpage', $graph['webpage']['@id']);
    self::assertSame('Article', $graph['primary']['@type']);
    self::assertSame('Ada Writer', $graph['primary']['author']['name']);
    self::assertSame(['@id' => 'http://localhost/love#primary'], $graph['webpage']['mainEntity']);

    // The canonical as a full address is emitted as stored. `false` and -1
    // emit nothing, also over a site default; 0 is a limit.
    $this->config('canvas_metatag.site')->set('values.robots', ['max_snippet' => 160, 'nofollow' => TRUE])->save();
    $resolved = $resolver->resolve($this->createPage(['canvas_metatag' => '{"canonical":"https://other.example.com/x","robots":{"nofollow":false,"max_snippet":-1}}']));
    self::assertSame('https://other.example.com/x', self::meta($resolved['head'])['og:url']);
    self::assertArrayNotHasKey('robots', self::meta($resolved['head']));
    self::assertSame('http://localhost/pricing', self::graph($resolved['head'])['webpage']['url']);
    $resolved = $resolver->resolve($this->createPage(['canvas_metatag' => '{"robots":{"max_snippet":0}}']));
    self::assertSame('nofollow, max-snippet:0', self::meta($resolved['head'])['robots']);
    $resolved = $resolver->resolve($this->createPage());
    self::assertSame('nofollow, max-snippet:160', self::meta($resolved['head'])['robots']);

    // The image chain: an override that is not usable (unpublished, or not a
    // public file) is skipped, then the page image, then the site default.
    $private = $this->createImage('Private', scheme: 'temporary');
    $unpublished = $this->createImage('Unpublished', values: ['status' => FALSE]);
    foreach ([$private, $unpublished] as $unusable) {
      $resolved = $resolver->resolve($this->createPage([
        'image' => $hero->id(),
        'canvas_metatag' => Values::encode(['social' => ['image' => $unusable->uuid()]]),
      ]));
      self::assertSame($this->imageOf($hero) + ['source' => 'entity'], $resolved['image']);
    }
    $resolved = $resolver->resolve($this->createPage(['image' => $private->id()]));
    self::assertSame($this->imageOf($default) + ['source' => 'site'], $resolved['image']);
    self::assertSame('The default', self::meta($resolved['head'])['og:image:alt']);
    $this->config('canvas_metatag.site')->set('identity.default_image', '')->set('identity.logo', $unpublished->uuid())->save();
    $resolved = $resolver->resolve($this->createPage(['description' => '', 'title' => '']));
    self::assertNull($resolved['image']);
    $meta = self::meta($resolved['head']);
    self::assertSame(['robots', 'og:type', 'og:site_name', 'og:url', 'twitter:card'], array_keys($meta));
    self::assertSame('summary', $meta['twitter:card']);
    // An empty title falls back to the site name. An unusable logo is no logo.
    self::assertSame('Example', $resolved['head']['title']);
    $graph = self::graph($resolved['head']);
    self::assertArrayNotHasKey('logo', $graph);
    self::assertArrayNotHasKey('logo', $graph['identity']);
    self::assertArrayNotHasKey('primaryimage', $graph);

    // The front page is the base itself, whether the setting holds the
    // system path or its alias.
    $home = $this->createPage(['title' => 'Home', 'path' => ['alias' => '/home']]);
    foreach (['/home', '/page/' . $home->id()] as $front) {
      $this->config('system.site')->set('page.front', $front)->save();
      $home = Page::load($home->id());
      self::assertSame('http://localhost/', $resolver->url($home, new CacheableMetadata()), $front);
    }
    self::assertSame('http://localhost/#webpage', self::graph($resolver->resolve($home)['head'])['webpage']['@id']);

    // Alternates: one per published translation, and x-default.
    $page = $this->createPage(['path' => ['alias' => '/prices']]);
    $page->addTranslation('fr', ['title' => 'Tarifs', 'status' => TRUE, 'path' => ['alias' => '/tarifs']]);
    $page->addTranslation('de', ['title' => 'Preise', 'status' => FALSE]);
    $page->save();
    $page = Page::load($page->id());
    $alternates = [
      ['rel' => 'alternate', 'hreflang' => 'en', 'href' => 'http://localhost/prices'],
      ['rel' => 'alternate', 'hreflang' => 'fr', 'href' => 'http://localhost/fr/tarifs'],
      ['rel' => 'alternate', 'hreflang' => 'x-default', 'href' => 'http://localhost/prices'],
    ];
    self::assertSame([['rel' => 'canonical', 'href' => 'http://localhost/prices'], ...$alternates], $resolver->resolve($page)['head']['link']);
    $resolved = $resolver->resolve($page->getTranslation('fr'));
    self::assertSame([['rel' => 'canonical', 'href' => 'http://localhost/fr/tarifs'], ...$alternates], $resolved['head']['link']);
    self::assertSame('fr', self::graph($resolved['head'])['webpage']['inLanguage']);
    // The translated front page keeps its language prefix.
    self::assertSame('http://localhost/fr', $resolver->url($home->addTranslation('fr', ['title' => 'Accueil']), new CacheableMetadata()));
    // One published translation is no alternate at all.
    $page->getTranslation('fr')->setUnpublished();
    $page->save();
    self::assertSame([['rel' => 'canonical', 'href' => 'http://localhost/prices']], $resolver->resolve(Page::load($page->id()))['head']['link']);
  }

  /**
   * Overrides reach the output; the full cacheability; stored versus draft.
   */
  public function testCacheabilityAndDraft(): void {
    $resolver = $this->resolver();
    $logo = $this->createImage('Logo', ['width' => 512, 'height' => 512]);
    $hero = $this->createImage('Pricing hero');
    $this->config('canvas_metatag.site')->set('identity.logo', $logo->uuid())->save();
    $page = $this->createPage(['image' => $hero->id()]);
    $files = [
      $hero->get('field_media_image')->first()?->get('target_id')->getValue(),
      $logo->get('field_media_image')->first()?->get('target_id')->getValue(),
    ];

    $cacheability = $resolver->resolve($page)['cacheability'];
    $expected = [
      'canvas_page:' . $page->id(),
      'config:canvas_headless.settings',
      'config:canvas_metatag.site',
      'config:system.date',
      'config:system.site',
      'config:user.role.anonymous',
      'file:' . $files[0],
      'file:' . $files[1],
      'media:' . $hero->id(),
      'media:' . $logo->id(),
      'user:' . $this->author->id(),
    ];
    sort($expected);
    $tags = $cacheability->getCacheTags();
    sort($tags);
    self::assertSame($expected, $tags);
    // No user context: every access check runs for the anonymous account,
    // so both page caches stay effective. The interface language is what
    // the language module adds to every configuration object it may
    // translate, here the site settings.
    $contexts = $cacheability->getCacheContexts();
    sort($contexts);
    self::assertSame(['languages:language_content', 'languages:language_interface', 'url.site'], $contexts);
    self::assertSame(-1, $cacheability->getCacheMaxAge());

    // A template-rendered node depends on its template as well.
    $this->createTemplate(TRUE, ['title' => '{title} {sep} Blog']);
    $node = Node::create(['type' => 'article', 'title' => 'Hello', 'uid' => $this->author->id()]);
    $node->save();
    $resolved = $resolver->resolve($node);
    self::assertSame('Hello | Blog', $resolved['head']['title']);
    $tags = $resolved['cacheability']->getCacheTags();
    foreach ([
      'node:' . $node->id(),
      'config:canvas.content_template.node.article.full',
      'config:canvas_metatag.site',
      'config:canvas_headless.settings',
      'config:user.role.anonymous',
    ] as $tag) {
      self::assertContains($tag, $tags);
    }
    self::assertNotContains(AutoSaveManager::CACHE_TAG, $tags);
    self::assertSame([], array_filter($resolved['cacheability']->getCacheContexts(), static fn (string $context): bool => str_starts_with($context, 'user')));

    // A configuration override of the site settings (a staging site that
    // forces noindex in settings.php) reaches the output.
    $GLOBALS['config']['canvas_metatag.site']['values']['robots']['noindex'] = TRUE;
    $GLOBALS['config']['canvas_metatag.site']['values']['title'] = '{title} {sep} Staging';
    $this->container->get('config.factory')->clearStaticCache();
    $page = Page::load($page->id());
    $resolved = $resolver->resolve($this->createPage(['path' => ['alias' => '/other']]));
    self::assertSame('Pricing | Staging', $resolved['head']['title']);
    self::assertSame('noindex, max-image-preview:large', self::meta($resolved['head'])['robots']);
    unset($GLOBALS['config']['canvas_metatag.site']);
    $this->container->get('config.factory')->clearStaticCache();

    // A stored page and its draft share id, langcode and revision id; they
    // are two results in one request.
    $draft = clone $page;
    $draft->set('title', 'Draft title')->set('canvas_metatag', '{"title":"{title} draft"}');
    $this->container->get(AutoSaveManager::class)->saveEntity($draft);
    $draft = $this->container->get(AutoSaveManager::class)->getAutoSaveEntityForPreview($page)->entity;
    self::assertInstanceOf(Page::class, $draft);
    self::assertSame([$page->id(), $page->getRevisionId()], [$draft->id(), $draft->getRevisionId()]);
    $stored = $resolver->resolve($page);
    $drafted = $resolver->resolve($draft);
    self::assertSame('Pricing | Example', $stored['head']['title']);
    self::assertSame('Draft title draft', $drafted['head']['title']);
    self::assertSame($stored, $resolver->resolve($page));
    self::assertSame($drafted, $resolver->resolve($draft));

    // The draft flag is part of what is kept.
    $template = ContentTemplate::load('node.article.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    $template_draft = clone $template;
    $template_draft->setThirdPartySetting('canvas_metatag', 'values', ['title' => 'Draft pattern']);
    $this->container->get(AutoSaveManager::class)->saveEntity($template_draft);
    $node = Node::load($node->id());
    self::assertSame('Hello | Blog', $resolver->resolve($node)['head']['title']);
    $drafted = $resolver->resolve($node, TRUE);
    self::assertSame('Draft pattern', $drafted['head']['title']);
    self::assertContains(AutoSaveManager::CACHE_TAG, $drafted['cacheability']->getCacheTags());
    self::assertSame('Hello | Blog', $resolver->resolve($node)['head']['title']);
  }

  /**
   * The public base is the first configured headless frontend.
   */
  public function testFrontendBase(): void {
    $modules = ['serialization', 'consumers', 'simple_oauth', 'custom_elements', 'canvas_headless'];
    if (array_diff($modules, array_keys($this->container->get('extension.list.module')->getList()))) {
      self::markTestSkipped('canvas_headless or one of its dependencies is not in the codebase.');
    }
    $page = $this->createPage(['canvas_metatag' => '{"canonical":"/plans"}']);
    $home = $this->createPage(['title' => 'Home', 'path' => ['alias' => '/home']]);
    $this->config('system.site')->set('page.front', '/page/' . $home->id())->save();

    // Without the module: the request's host.
    $cacheability = new CacheableMetadata();
    self::assertSame(['url' => 'http://localhost', 'source' => 'request'], $this->resolver()->origin($cacheability));
    self::assertSame(['config:canvas_headless.settings'], $cacheability->getCacheTags());
    self::assertSame(['url.site'], $cacheability->getCacheContexts());

    $this->enableModules($modules);
    // Installed, no frontend yet: still the request's host.
    self::assertSame('request', $this->resolver()->origin(new CacheableMetadata())['source']);
    // A value that is not an unambiguous base URL is not a frontend.
    $GLOBALS['config']['canvas_headless.settings']['frontends'] = [
      ['url' => 'https://user@www.example.com', 'components' => []],
    ];
    $this->container->get('config.factory')->clearStaticCache();
    self::assertSame('request', $this->resolver()->origin(new CacheableMetadata())['source']);
    unset($GLOBALS['config']['canvas_headless.settings']);
    $this->config('canvas_headless.settings')
      ->set('assertion_expiration', 60)
      ->set('frontends', [
        ['url' => 'https://www.example.com/shop', 'components' => []],
        ['url' => 'https://second.example.com', 'components' => []],
      ])
      ->save();

    $cacheability = new CacheableMetadata();
    self::assertSame(['url' => 'https://www.example.com/shop', 'source' => 'frontend'], $this->resolver()->origin($cacheability));
    self::assertSame(['config:canvas_headless.settings'], $cacheability->getCacheTags());
    self::assertSame([], $cacheability->getCacheContexts());
    // The canonical, og:url and every @id are on the frontend.
    $resolved = $this->resolver()->resolve(Page::load($page->id()));
    self::assertSame('https://www.example.com/shop/plans', $resolved['head']['link'][0]['href']);
    self::assertSame('https://www.example.com/shop/plans', self::meta($resolved['head'])['og:url']);
    $graph = self::graph($resolved['head']);
    self::assertSame('https://www.example.com/shop/pricing#webpage', $graph['webpage']['@id']);
    self::assertSame('https://www.example.com/shop/#website', $graph['website']['@id']);
    self::assertSame('https://www.example.com/shop/', $graph['identity']['url']);
    self::assertSame('https://www.example.com/shop/', $this->resolver()->url(Page::load($home->id()), new CacheableMetadata()));

    // The frontend is where the editor previews. Where visitors go may be
    // another address, set per environment; it wins.
    $this->setSetting('canvas_metatag_public_base', 'https://www.example.org/');
    $cacheability = new CacheableMetadata();
    self::assertSame(['url' => 'https://www.example.org', 'source' => 'settings'], $this->resolver()->origin($cacheability));
    // A fresh object: results are kept per entity object for the request.
    $resolved = $this->resolver()->resolve($this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID)->loadUnchanged($page->id()));
    self::assertSame('https://www.example.org/plans', $resolved['head']['link'][0]['href']);
    self::assertSame('https://www.example.org/plans', self::meta($resolved['head'])['og:url']);
    self::assertSame('https://www.example.org/pricing#webpage', self::graph($resolved['head'])['webpage']['@id']);
    // A value that is not a base URL is ignored.
    foreach (['/relative', 'ftp://www.example.org', 'https://www.example.org/?a=b', 'https://user@www.example.org'] as $bad) {
      $this->setSetting('canvas_metatag_public_base', $bad);
      self::assertSame('frontend', $this->resolver()->origin(new CacheableMetadata())['source'], $bad);
    }
  }

}
