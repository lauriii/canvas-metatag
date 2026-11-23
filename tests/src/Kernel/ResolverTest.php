<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Values;
use Drupal\field\Entity\FieldConfig;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\file\Entity\File;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use Drupal\Tests\content_translation\Traits\ContentTranslationTestTrait;
use Drupal\user\Entity\Role;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

// cspell:ignore Tarifs tarifs ville amet Canvasville Preise Accueil
// cspell:ignore مرحبا عنوان शीर्षक
/**
 * Tests ownership, layers, facts, links, URLs, the head and its cacheability.
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
    'text',
    'datetime',
    'link',
    'options',
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
    $page = $this->createPage(['canvas_metatag' => '{"title":{"text":"Plans"},"robots":{"noindex":true},"bogus":1,"canonical":"no-slash"}']);
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
    $template = $this->createTemplate(FALSE, ['title_end' => ['text' => 'Blog'], 'robots' => ['nofollow' => TRUE]]);
    self::assertFalse($resolver->owns($node));
    self::assertTrue($resolver->owns($node, TRUE));
    self::assertFalse($resolver->owns($note, TRUE));
    $template->setStatus(TRUE)->save();
    self::assertTrue($resolver->owns($node));
    self::assertFalse($resolver->owns($note));

    // Page over site. What any other write path stored is cleaned on read.
    $cacheability = new CacheableMetadata();
    $layers = $resolver->layers($page, FALSE, $cacheability);
    self::assertSame(['robots' => ['noindex' => TRUE], 'title' => ['text' => 'Plans']], $layers['target']);
    self::assertSame(['robots' => ['max_image_preview' => 'large']], $layers['site']);
    self::assertSame('|', $layers['identity']['separator']);
    self::assertSame([], $layers['from_default']);
    self::assertContains('config:canvas_metatag.site', $cacheability->getCacheTags());
    self::assertSame(
      ['robots' => ['noindex' => TRUE, 'max_image_preview' => 'large'], 'title' => ['text' => 'Plans']],
      Values::cascade($layers['target'], $layers['site']),
    );

    // Template over site, and the template's draft only when asked for.
    $cacheability = new CacheableMetadata();
    $layers = $resolver->layers($node, FALSE, $cacheability);
    self::assertSame(['robots' => ['nofollow' => TRUE], 'title_end' => ['text' => 'Blog']], $layers['target']);
    self::assertContains('config:canvas.content_template.node.article.full', $cacheability->getCacheTags());
    self::assertNotContains(AutoSaveManager::CACHE_TAG, $cacheability->getCacheTags());
    $draft = clone $template;
    $draft->setThirdPartySetting('canvas_metatag', 'values', ['title_end' => ['text' => 'Draft ending']]);
    $this->container->get(AutoSaveManager::class)->saveEntity($draft);
    self::assertSame(['text' => 'Blog'], $resolver->layers($node, FALSE, new CacheableMetadata())['target']['title_end']);
    $cacheability = new CacheableMetadata();
    self::assertSame(['title_end' => ['text' => 'Draft ending']], $resolver->layers($node, TRUE, $cacheability)['target']);
    self::assertContains(AutoSaveManager::CACHE_TAG, $cacheability->getCacheTags());
    self::assertSame('Hello | Blog', $resolver->resolve($node)['head']['title']);
    $node = Node::load($node->id());
    self::assertSame('Hello | Draft ending', $resolver->resolve($node, TRUE)['head']['title']);

    // A translation that is not the default one inherits three settings of
    // the default one, and nothing else.
    $image = $this->createImage('Shared');
    $page = $this->createPage([
      'path' => ['alias' => '/plans'],
      'canvas_metatag' => Values::encode([
        'canonical' => '/elsewhere',
        'robots' => ['noindex' => TRUE, 'max_snippet' => 50],
        'schema' => ['type' => 'Article', 'props' => ['headline' => ['text' => 'English headline']]],
        'social' => ['image' => ['media' => $image->uuid()], 'title' => ['text' => 'English social title']],
        'title' => ['text' => 'English title'],
      ]),
    ]);
    $french = $page->addTranslation('fr', ['title' => 'Tarifs', 'status' => TRUE, 'path' => ['alias' => '/tarifs']]);
    // The details of the inherited type are stored without a type.
    $french->set('canvas_metatag', '{"robots":{"max_snippet":-1},"schema":{"props":{"headline":{"text":"Titre"}}},"social":{"title":{"text":"Titre social"}}}');
    $page->save();
    $french = Page::load($page->id())->getTranslation('fr');
    $layers = $resolver->layers($french, FALSE, new CacheableMetadata());
    self::assertSame([
      'robots' => ['max_snippet' => 50, 'noindex' => TRUE],
      'schema' => ['type' => 'Article'],
      'social' => ['image' => ['media' => $image->uuid()]],
    ], $layers['from_default']);
    self::assertSame([
      'robots' => ['max_snippet' => -1],
      'schema' => ['props' => ['headline' => ['text' => 'Titre']]],
      'social' => ['title' => ['text' => 'Titre social']],
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
   * The facts of a page (stored and draft) and of a node.
   */
  public function testFacts(): void {
    $resolver = $this->resolver();
    $hero = $this->createImage('Pricing hero', ['alt' => 'Pricing table']);
    $page = $this->createPage(['image' => $hero->id()]);
    $cacheability = new CacheableMetadata();
    self::assertSame([
      'title' => ['label' => 'Title', 'kind' => 'text', 'value' => 'Pricing'],
      'description' => ['label' => 'Description', 'kind' => 'text', 'value' => 'Plans and prices for Example.'],
      'site' => ['label' => 'Site name', 'kind' => 'text', 'value' => 'Example'],
      'url' => ['label' => 'Page address', 'kind' => 'address', 'value' => 'http://localhost/pricing'],
      'author' => ['label' => 'Author', 'kind' => 'text', 'value' => 'Ada Writer'],
      // A date also in words, as a place that composes reads it.
      'published' => [
        'label' => 'First published',
        'kind' => 'date',
        'value' => self::PUBLISHED,
        'text' => 'March 2, 2026',
      ],
      'modified' => [
        'label' => 'Last updated',
        'kind' => 'date',
        'value' => self::MODIFIED,
        'text' => 'March 4, 2026',
      ],
      'image' => ['label' => 'Image', 'kind' => 'image', 'value' => '', 'image' => $this->imageOf($hero)],
      // The publisher, for references, by its name.
      'identity' => ['label' => 'This site', 'kind' => 'ref', 'value' => 'Example'],
    ], $resolver->facts($page, $cacheability));
    self::assertSame('|', $resolver->separator(new CacheableMetadata()));
    // The author's name is public although profiles are not: anonymous
    // visitors have no permission to view them here.
    self::assertFalse(Role::load('anonymous')?->hasPermission('access user profiles'));
    self::assertContains('user:' . $this->author->id(), $cacheability->getCacheTags());

    // The identity name wins over the site name. Without an entity, only
    // the site name has a value.
    $this->config('canvas_metatag.site')->set('identity.name', 'Example Ltd')->set('identity.separator', '·')->save();
    $draft = clone $page;
    $draft->set('title', 'Draft title')->set('description', 'Draft description.');
    $facts = $resolver->facts($draft, new CacheableMetadata());
    self::assertSame([
      'Draft title',
      'Draft description.',
      'Example Ltd',
    ], [$facts['title']['value'], $facts['description']['value'], $facts['site']['value']]);
    self::assertSame('·', $resolver->separator(new CacheableMetadata()));
    $empty = $resolver->facts(NULL, new CacheableMetadata());
    self::assertSame(array_keys($facts), array_keys($empty));
    self::assertSame(['', 'Example Ltd'], array_values(array_unique(array_column($empty, 'value'))));
    self::assertNull($empty['image']['image']);

    // A node: the first formatted text with a summary, and the first image
    // that resolves, in the order of the form.
    $this->createField('field_body', 'text_with_summary', 'Body');
    $this->createField('field_photo', 'image', 'Photo');
    $this->createField('field_hero', 'entity_reference', 'Hero image', ['target_type' => 'media'], [
      'handler' => 'default:media',
      'handler_settings' => ['target_bundles' => ['image' => 'image']],
    ]);
    $photo = File::load($this->createImage('Photo')->get('field_media_image')->first()?->get('target_id')->getValue());
    self::assertInstanceOf(File::class, $photo);
    $article_hero = $this->createImage('Article hero', ['alt' => 'A waving hand', 'width' => 800, 'height' => 400]);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'uid' => $this->author->id(),
      'created' => strtotime(self::CREATED),
      'changed' => strtotime(self::CHANGED),
      'field_body' => ['value' => '<p>' . str_repeat('Lorem ipsum dolor sit amet. ', 10) . '</p>', 'summary' => ''],
      'field_photo' => ['target_id' => $photo->id(), 'alt' => 'A photo', 'width' => 640, 'height' => 480],
      'field_hero' => $article_hero->id(),
    ]);
    $node->save();
    $cacheability = new CacheableMetadata();
    $facts = $resolver->facts($node, $cacheability);
    // No summary: the text, cut at a word boundary within 160 characters.
    self::assertSame(str_repeat('Lorem ipsum dolor sit amet. ', 5) . 'Lorem ipsum dolor', $facts['description']['value']);
    self::assertSame('Body', $facts['description']['via']);
    // Without a form, the first image by name.
    self::assertSame($this->imageOf($article_hero), $facts['image']['image']);
    self::assertSame('Hero image', $facts['image']['via']);
    self::assertSame('http://localhost/node/' . $node->id(), $facts['url']['value']);
    foreach ([
      'media:' . $article_hero->id(),
      'config:user.role.anonymous',
      'entity_field_info',
      'config:media_type_list',
    ] as $tag) {
      self::assertContains($tag, $cacheability->getCacheTags());
    }
    self::assertSame([], array_filter($cacheability->getCacheContexts(), static fn (string $context): bool => str_starts_with($context, 'user')));

    // A summary wins. When the first image is not usable, the next one; an
    // unpublished image media and a file that is not public are no image.
    $node->set('field_body', ['value' => '<p>Text</p>', 'summary' => 'A <i>short</i> summary.'])->save();
    $article_hero->setUnpublished()->save();
    $this->forgetAccess();
    $facts = $resolver->facts(Node::load($node->id()), new CacheableMetadata());
    self::assertSame('A short summary.', $facts['description']['value']);
    self::assertSame([
      'width' => 640,
      'height' => 480,
      'alt' => 'A photo',
      'name' => 'A photo',
    ], array_intersect_key($facts['image']['image'], ['name' => 1, 'alt' => 1, 'width' => 1, 'height' => 1]));
    self::assertSame('Photo', $facts['image']['via']);
    $photo->setFileUri('temporary://photo.png');
    $photo->save();
    $this->forgetAccess();
    self::assertNull($resolver->facts(Node::load($node->id()), new CacheableMetadata())['image']['image']);

    // The content of script, style and template elements never displays.
    $node->set('field_body', [
      'value' => '<p>Ask us</p><script>alert(1)</script><style>p{color:red}</style><template><p>Later</p></template>',
      'summary' => '',
    ])->save();
    self::assertSame('Ask us', $resolver->facts(Node::load($node->id()), new CacheableMetadata())['description']['value']);

    // The cut never ends inside a character drawn as one.
    $family = "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}";
    foreach ([
      [str_repeat('a', 157) . $family . ' tail', str_repeat('a', 157)],
      [str_repeat('a', 159) . "e\u{301} tail", str_repeat('a', 159)],
    ] as [$body, $description]) {
      $node->set('field_body', ['value' => "<p>$body</p>", 'summary' => ''])->save();
      self::assertSame($description, $resolver->facts(Node::load($node->id()), new CacheableMetadata())['description']['value']);
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
    $image = fn (): ?array => $resolver->facts(Node::load($node->id()), new CacheableMetadata())['image']['image'];

    // Without a form, by name; the head waits for a form to be created.
    self::assertSame($this->imageOf($avatar), $image());
    $head = fn (): array => $resolver->resolve($this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($node->id()))['cacheability']->getCacheTags();
    self::assertContains('config:entity_form_display_list', $head());

    // The form puts the photo first.
    $display = $this->container->get('entity_display.repository')->getFormDisplay('node', 'article')
      ->setComponent('field_photo', ['weight' => 1])
      ->setComponent('field_avatar', ['weight' => 2])
      ->removeComponent('field_note');
    $display->save();
    self::assertSame($this->imageOf($photo), $image());

    // The head depends on the form.
    self::assertContains('config:core.entity_form_display.node.article.default', $head());

    // Moving the photo below the avatar changes the Image fact.
    $display->setComponent('field_photo', ['weight' => 3])->save();
    self::assertSame($this->imageOf($avatar), $image());
  }

  /**
   * Values linked to fields: their value, else the default.
   */
  public function testLinkedValues(): void {
    $resolver = $this->resolver();
    $this->createArticleFields();
    $writer = Node::create(['type' => 'person', 'title' => 'Ada', 'status' => 1]);
    $writer->save();
    $hero = $this->createImage('Hero', ['alt' => 'A waving hand', 'width' => 800, 'height' => 400]);
    $node = Node::create([
      'type' => 'article',
      'title' => 'Hello',
      'uid' => $this->author->id(),
      'field_summary' => 'How teams turn output into stories.',
      'field_byline' => '{site}',
      'field_body' => ['value' => '<p>The body.</p>', 'summary' => 'The body summary.'],
      'field_writer' => $writer->id(),
      'field_hero' => $hero->id(),
      'field_no_view_access' => 'Not for visitors',
    ]);
    $node->save();
    $this->createTemplate(TRUE, [
      'title' => $this->linkTo('Byline'),
      'description' => $this->linkTo('Summary'),
      'social' => ['image' => $this->linkTo('Hero › Image', 'image')],
      'schema' => ['type' => 'Article', 'props' => ['author_name' => $this->linkTo('Writer › Title')]],
    ]);
    $head = fn (): array => $resolver->resolve($this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($node->id()));

    // A translation reads its own values, a reference in its language, and
    // an address inside the site in its language.
    $this->enableContentTranslation('node', 'article');
    $this->enableContentTranslation('node', 'person');
    // The objects loaded before have no translation fields yet.
    $this->container->get('entity_field.manager')->clearCachedFieldDefinitions();
    $nodes = $this->container->get('entity_type.manager')->getStorage('node');
    $nodes->resetCache();
    $writer = $nodes->load($writer->id());
    $node = $nodes->load($node->id());
    $writer->addTranslation('fr', ['title' => 'Ada (fr)', 'status' => 1])->save();
    $node->addTranslation('fr', [
      'title' => 'Bonjour',
      'status' => 1,
      'field_summary' => 'Comment les équipes racontent.',
      'field_writer' => $writer->id(),
      'field_more' => ['uri' => 'internal:/node/' . $node->id()],
    ])->save();
    $french = $this->container->get('entity_type.manager')->getStorage('node')->loadUnchanged($node->id())->getTranslation('fr');
    $resolved = $resolver->resolve($french);
    self::assertSame('Comment les équipes racontent.', self::meta($resolved['head'])['description']);
    self::assertSame('Ada (fr)', self::graph($resolved['head'])['primary']['author']['name']);
    self::assertSame([
      'ok',
      'http://localhost/fr/node/' . $node->id(),
    ], $resolver->link($this->linkTo('More', 'address')['source'], $french, 'address', new CacheableMetadata()));
    // A reference names its target in the host's language only when
    // visitors may see that translation: an unpublished French translation
    // of a published page is never named, by its title or its address.
    $nodes->load($writer->id())->getTranslation('fr')->setUnpublished()->save();
    $this->container->get('entity_type.manager')->getAccessControlHandler('node')->resetCache();
    $writer = $nodes->loadUnchanged($writer->id());
    self::assertSame('Ada', $resolver->target($writer, 'en', new CacheableMetadata())['name']);
    self::assertNull($resolver->target($writer, 'fr', new CacheableMetadata()));
    self::assertNull($resolver->target($writer->getTranslation('fr'), 'fr', new CacheableMetadata()));

    $resolved = $head();
    $meta = self::meta($resolved['head']);
    // A value that looks like a name is literal text.
    self::assertSame('{site} | Example', $resolved['head']['title']);
    self::assertSame('How teams turn output into stories.', $meta['description']);
    self::assertSame($this->imageOf($hero)['url'], $meta['og:image']);
    self::assertSame([
      '800',
      '400',
      'A waving hand',
    ], [$meta['og:image:width'], $meta['og:image:height'], $meta['og:image:alt']]);
    self::assertSame('entity', $resolved['image']['source']);
    self::assertSame('Ada', self::graph($resolved['head'])['primary']['author']['name']);
    // A published head never varies by user: the same cached head for all.
    self::assertSame([], array_filter($resolved['cacheability']->getCacheContexts(), static fn (string $context): bool => str_starts_with($context, 'user')));
    foreach ([
      'config:user.role.anonymous',
      'node:' . $writer->id(),
      'entity_field_info',
      'config:media_type_list',
    ] as $tag) {
      self::assertContains($tag, $resolved['cacheability']->getCacheTags());
    }

    // Empty for this item: the default.
    $node->set('field_summary', NULL)->set('field_byline', NULL)->save();
    $resolved = $head();
    self::assertSame('The body summary.', self::meta($resolved['head'])['description']);
    self::assertSame('Hello | Example', $resolved['head']['title']);
    // Hidden from visitors: the default too.
    $writer->setUnpublished()->save();
    $this->forgetAccess();
    self::assertSame('Ada Writer', self::graph($head()['head'])['primary']['author']['name']);
    self::assertSame([
      'hidden',
      NULL,
    ], $resolver->link($this->linkTo('Notes')['source'], $node, 'text', new CacheableMetadata()));

    // A linked image that is empty for the item: the item's Image fact, here
    // from another image field, before the site's default.
    $this->createField('field_photo', 'entity_reference', 'Photo', ['target_type' => 'media'], [
      'handler' => 'default:media',
      'handler_settings' => ['target_bundles' => ['image' => 'image']],
    ]);
    $photo = $this->createImage('Photo', ['alt' => 'A photo', 'width' => 640, 'height' => 480]);
    $nodes->resetCache();
    $node = $nodes->load($node->id());
    $node->set('field_hero', NULL)->set('field_photo', $photo->id())->save();
    $meta = self::meta($head()['head']);
    self::assertSame([$this->imageOf($photo)['url'], 'A photo'], [$meta['og:image'], $meta['og:image:alt']]);
    // A linked image whose file is not public gives none: the head falls
    // back the same way.
    $node->set('field_hero', $hero->id())->save();
    $file = $hero->get('field_media_image')->entity;
    \assert($file instanceof File);
    $file->setFileUri('temporary://hero.png');
    $file->save();
    $this->forgetAccess();
    [,
      $value,
    ] = $resolver->link($this->linkTo('Hero › Image', 'image')['source'], Node::load($node->id()), 'image', new CacheableMetadata());
    self::assertNull($value);
    self::assertSame($this->imageOf($photo)['url'], self::meta($head()['head'])['og:image']);
    $file->setFileUri('public://hero.png');
    $file->save();
    $node->set('field_photo', NULL)->save();
    $this->forgetAccess();

    // A deleted field: the template keeps the link, each item its default;
    // recreating the field heals it.
    $link = $this->linkTo('Summary');
    $node->set('field_summary', 'Back again.')->save();
    FieldConfig::loadByName('node', 'article', 'field_summary')?->delete();
    // Canvas keeps its matches for the rest of a request.
    $this->container->get('cache.static')->deleteAll();
    self::assertSame('The body summary.', self::meta($head()['head'])['description']);
    self::assertSame($link, ContentTemplate::load('node.article.full')?->getThirdPartySetting('canvas_metatag', 'values')['description']);
    self::assertSame(['broken', NULL], $resolver->link($link['source'], $node, 'text', new CacheableMetadata()));
    $this->createField('field_summary', 'string_long', 'Summary');
    $this->container->get('cache.static')->deleteAll();
    $nodes->resetCache();
    $node = $nodes->load($node->id());
    $node->set('field_summary', 'Healed.')->save();
    self::assertSame('Healed.', self::meta($head()['head'])['description']);
    self::assertSame(['ok', 'Healed.'], $resolver->link($link['source'], $node, 'text', new CacheableMetadata()));

    // A value linked to formatted text reads it as sentences, and its start.
    $body = $this->linkTo('Body')['source'];
    foreach ([
      '<h2>Made to last</h2><p>Solid oak.</p><ul><li>Dimmable</li><li>Fabric cable, 3 m.</li></ul>' => 'Made to last. Solid oak. Dimmable. Fabric cable, 3 m.',
      '<p>One</p><p>Two &amp; <b>three</b></p>' => 'One Two & three',
      '<h2>Questions?</h2>' => 'Questions?',
      '<ul><li><a href="/x">Oak.</a></li></ul>' => 'Oak.',
      '<ul><li><h3>Nested</h3></li></ul><dl><dt>Term</dt><dd>Its meaning</dd></dl>' => 'Nested. Term Its meaning.',
      '<ul><li>Features<ul><li>Dimmable</li></ul></li></ul>' => 'Features. Dimmable.',
      '<table><caption>Sizes</caption><tr><th>Height</th><td>45 cm</td></tr><tr><th>Weight</th><td>1.2 kg</td></tr></table>' => 'Sizes. Height 45 cm. Weight 1.2 kg.',
      // Only a sentence or clause mark ends one: a closing bracket does not.
      '<h2>Price (USD)</h2><p>From 49</p>' => 'Price (USD). From 49',
      '<h2>"Made to last."</h2><h2>Oak, ash,</h2>' => '"Made to last." Oak, ash,',
      "<h2>Marked\x01</h2><p>\x01Text</p>" => 'Marked. Text',
      // The text before a heading ends too.
      '<p>Buy now</p><h2>Specs</h2>' => 'Buy now. Specs.',
      // Marks of other scripts, full-width forms included, spare it.
      '<h2>見出し：</h2><p>本文</p><h2>見出し。</h2>' => '見出し： 本文. 見出し。',
      '<h2>مرحبا،</h2><p>x</p><h2>عنوان؟</h2><ul><li>نص،</li></ul>' => 'مرحبا، x. عنوان؟ نص،',
      '<h2>शीर्षक॥</h2><h2>a؛</h2><h2>b；</h2><h2>c．</h2>' => 'शीर्षक॥ a؛ b； c．',
      // A custom element is not a list; its words join as written.
      '<p>Hello <ul-thing>world</ul-thing></p>' => 'Hello world',
      // Script and style never display, also with ">" in an attribute.
      '<p>Ask us</p><script data-x="a>b">alert(1)</script><template><template>Inner</template>Outer</template><p>today</p>' => 'Ask us today',
      // Text that is not valid UTF-8 gives nothing, never a mark.
      "<p>Ask us</p><h2>\xff bad</h2><p>x</p>" => '',
    ] as $html => $text) {
      $node->set('field_body', ['value' => $html, 'summary' => ''])->save();
      [$status, $value] = $resolver->link($body, Node::load($node->id()), 'text', new CacheableMetadata());
      self::assertSame($text, (string) $value, $html);
      self::assertSame($text === '' ? 'empty' : 'ok', $status);
    }
    // A long formatted text gives its start, cut at a word within 160.
    $node->set('field_body', [
      'value' => '<p>' . str_repeat('Lorem ipsum dolor sit amet. ', 40) . '</p>',
      'summary' => '',
    ])->save();
    self::assertSame(str_repeat('Lorem ipsum dolor sit amet. ', 5) . 'Lorem ipsum dolor', $resolver->link($body, Node::load($node->id()), 'text', new CacheableMetadata())[1]);

    // An address: a link inside the site is put on the public base.
    $node->set('field_more', ['uri' => 'internal:/pricing'])->save();
    self::assertSame([
      'ok',
      'http://localhost/pricing',
    ], $resolver->link($this->linkTo('More', 'address')['source'], Node::load($node->id()), 'address', new CacheableMetadata()));
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
    self::assertSame([
      NULL,
      [],
      NULL,
    ], [$resolved['schema']['withheld'], $resolved['schema']['dropped'], $resolved['schema']['unknown_type']]);
    // Delivery computes no verdicts and no rules.
    self::assertArrayNotHasKey('features', $resolved['schema']);
    self::assertArrayNotHasKey('rules', $resolved['schema']);
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
        'social' => [
          'title' => ['text' => 'Compare plans'],
          'description' => ['text' => 'See every plan.'],
          'image' => ['media' => $small->uuid()],
        ],
      ]),
    ]));
    $meta = self::meta($resolved['head']);
    self::assertSame('I <3 Canvas &amp; more | Example', $resolved['head']['title']);
    self::assertSame('noindex, nosnippet, max-image-preview:none', $meta['robots']);
    self::assertSame('Compare plans', $meta['og:title']);
    self::assertSame('See every plan.', $meta['og:description']);
    self::assertSame('Plans and prices for Example.', $meta['description']);
    self::assertSame('http://localhost/plans?ref=1', $meta['og:url']);
    self::assertSame('http://localhost/plans?ref=1', $resolved['head']['link'][0]['href']);
    self::assertSame('article', $meta['og:type']);
    self::assertSame(self::PUBLISHED, $meta['article:published_time']);
    self::assertSame(self::MODIFIED, $meta['article:modified_time']);
    self::assertSame([
      'og:image:height',
      'article:published_time',
      'article:modified_time',
      'twitter:card',
    ], array_slice(array_keys($meta), -4));
    self::assertSame('override', $resolved['image']['source']);
    // Too small for the large card.
    self::assertSame('summary', $meta['twitter:card']);
    // The large card needs 600 x 157, as the dialog's link preview does.
    $cards = [];
    foreach ([[400, 400], [600, 315], [1200, 630], [1200, 150], [599, 630], [600, 157]] as [$width, $height]) {
      $image = $this->createImage("Card $width x $height", ['width' => $width, 'height' => $height]);
      $page = $this->createPage(['canvas_metatag' => Values::encode(['social' => ['image' => ['media' => $image->uuid()]]])]);
      $cards["$width x $height"] = self::meta($resolver->resolve($page)['head'])['twitter:card'];
    }
    self::assertSame([
      '400 x 400' => 'summary',
      '600 x 315' => 'summary_large_image',
      '1200 x 630' => 'summary_large_image',
      '1200 x 150' => 'summary',
      '599 x 630' => 'summary',
      '600 x 157' => 'summary_large_image',
    ], $cards);
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
        'canvas_metatag' => Values::encode(['social' => ['image' => ['media' => $unusable->uuid()]]]),
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
    self::assertSame([
      ['rel' => 'canonical', 'href' => 'http://localhost/prices'],
      ...$alternates,
    ], $resolver->resolve($page)['head']['link']);
    $resolved = $resolver->resolve($page->getTranslation('fr'));
    self::assertSame([
      ['rel' => 'canonical', 'href' => 'http://localhost/fr/tarifs'],
      ...$alternates,
    ], $resolved['head']['link']);
    self::assertSame('fr', self::graph($resolved['head'])['webpage']['inLanguage']);
    // The translated front page keeps its language prefix.
    self::assertSame('http://localhost/fr', $resolver->url($home->addTranslation('fr', ['title' => 'Accueil']), new CacheableMetadata()));
    // It is still the front page where the site's nodes are judged.
    self::assertTrue($resolver->resolve($home->getTranslation('fr'))['schema']['front']);
    self::assertFalse($resolver->resolve($page->getTranslation('fr'))['schema']['front']);
    // One published translation is no alternate at all.
    $page->getTranslation('fr')->setUnpublished();
    $page->save();
    self::assertSame([[
      'rel' => 'canonical',
      'href' => 'http://localhost/prices',
    ],
    ], $resolver->resolve(Page::load($page->id()))['head']['link']);
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
    $this->createTemplate(TRUE, ['title_end' => ['text' => 'Blog']]);
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
    $GLOBALS['config']['canvas_metatag.site']['values']['title_end'] = ['text' => 'Staging'];
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
    $draft->set('title', 'Draft title')->set('canvas_metatag', '{"title":{"text":"Draft words"}}');
    $this->container->get(AutoSaveManager::class)->saveEntity($draft);
    $draft = $this->container->get(AutoSaveManager::class)->getAutoSaveEntityForPreview($page)->entity;
    self::assertInstanceOf(Page::class, $draft);
    self::assertSame([$page->id(), $page->getRevisionId()], [$draft->id(), $draft->getRevisionId()]);
    $stored = $resolver->resolve($page);
    $drafted = $resolver->resolve($draft);
    self::assertSame('Pricing | Example', $stored['head']['title']);
    self::assertSame('Draft words | Example', $drafted['head']['title']);
    self::assertSame($stored, $resolver->resolve($page));
    self::assertSame($drafted, $resolver->resolve($draft));

    // The draft flag is part of what is kept.
    $template = ContentTemplate::load('node.article.full');
    self::assertInstanceOf(ContentTemplate::class, $template);
    $template_draft = clone $template;
    $template_draft->setThirdPartySetting('canvas_metatag', 'values', ['title_end' => ['text' => 'Draft ending']]);
    $this->container->get(AutoSaveManager::class)->saveEntity($template_draft);
    $node = Node::load($node->id());
    self::assertSame('Hello | Blog', $resolver->resolve($node)['head']['title']);
    $drafted = $resolver->resolve($node, TRUE);
    self::assertSame('Hello | Draft ending', $drafted['head']['title']);
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
    self::assertSame([
      'url' => 'https://www.example.com/shop',
      'source' => 'frontend',
    ], $this->resolver()->origin($cacheability));
    self::assertSame(['config:canvas_headless.settings'], $cacheability->getCacheTags());
    self::assertSame([], $cacheability->getCacheContexts());
    // A link field pointing at a page of the site gives its frontend address.
    $this->createArticleFields();
    $node = Node::create([
      'type' => 'article',
      'title' => 'Linked',
      'status' => 1,
      'field_more' => ['uri' => 'entity:canvas_page/' . $page->id()],
    ]);
    $node->save();
    self::assertSame([
      'ok',
      'https://www.example.com/shop/pricing',
    ], $this->resolver()->link($this->linkTo('More', 'address')['source'], $node, 'address', new CacheableMetadata()));
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
    self::assertSame([
      'url' => 'https://www.example.org',
      'source' => 'settings',
    ], $this->resolver()->origin($cacheability));
    // A fresh object: results are kept per entity object for the request.
    $resolved = $this->resolver()->resolve($this->container->get('entity_type.manager')->getStorage(Page::ENTITY_TYPE_ID)->loadUnchanged($page->id()));
    self::assertSame('https://www.example.org/plans', $resolved['head']['link'][0]['href']);
    self::assertSame('https://www.example.org/plans', self::meta($resolved['head'])['og:url']);
    self::assertSame('https://www.example.org/pricing#webpage', self::graph($resolved['head'])['webpage']['@id']);
    // A value that is not a base URL is ignored.
    foreach ([
      '/relative',
      'ftp://www.example.org',
      'https://www.example.org/?a=b',
      'https://user@www.example.org',
    ] as $bad) {
      $this->setSetting('canvas_metatag_public_base', $bad);
      self::assertSame('frontend', $this->resolver()->origin(new CacheableMetadata())['source'], $bad);
    }
  }

  /**
   * A product's image: the one shared, else the page's, never the site's.
   *
   * The site currency is the default currency of its price.
   */
  public function testProductImage(): void {
    $hero = $this->createImage('Hero');
    $shared = $this->createImage('Shared');
    $default = $this->createImage('Default');
    $this->config('canvas_metatag.site')->set('identity.default_image', $default->uuid())->set('currency', 'EUR')->save();
    $product = ['schema' => ['type' => 'Product', 'props' => ['offers_price' => ['text' => '89']]]];
    $image = function (array $values, array $page = []) use ($product): ?string {
      $graph = self::graph($this->resolver()->resolve($this->createPage($page + [
        'canvas_metatag' => Values::encode(array_replace_recursive($product, $values)),
        'path' => ['alias' => '/lamp-' . $this->randomMachineName()],
      ]))['head']);
      // The page's own image is referenced by its @id.
      $own = $graph['primary']['image'] ?? [];
      return $own['url'] ?? (isset($own['@id']) ? $graph['primaryimage']['url'] : NULL);
    };

    self::assertSame($this->imageOf($hero)['url'], $image([], ['image' => $hero->id()]));
    self::assertSame($this->imageOf($shared)['url'], $image(['social' => ['image' => ['media' => $shared->uuid()]]], ['image' => $hero->id()]));
    // The site's default image is for sharing, never the product's.
    self::assertNull($image([]));
    // Set on the product, its own.
    self::assertSame($this->imageOf($hero)['url'], $image([
      'schema' => ['props' => ['image' => ['media' => $hero->uuid()]]],
      'social' => ['image' => ['media' => $shared->uuid()]],
    ]));

    $offer = self::graph($this->resolver()->resolve($this->createPage([
      'canvas_metatag' => Values::encode($product),
      'path' => ['alias' => '/lamp'],
    ]))['head'])['primary']['offers'];
    self::assertSame('EUR', $offer['priceCurrency']);
  }

}
