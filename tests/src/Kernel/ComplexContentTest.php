<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\AutoSave\AutoSaveManager;
use Drupal\canvas\Entity\Component;
use Drupal\canvas\Entity\ContentTemplate;
use Drupal\canvas\Plugin\Canvas\ComponentSource\JsonSchemaPropsComponentSourceBase;
use Drupal\canvas\PropExpressions\Component\ComponentPropExpression;
use Drupal\canvas\ShapeMatcher\PropSourceSuggester;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Entity\TypedData\EntityDataDefinition;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas_metatag\Fixture\ComplexContent;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Pins the complex content fixture that scenario tests and demos build on.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(ComplexContent::class)]
#[Group('canvas_metatag')]
final class ComplexContentTest extends CanvasKernelTestBase {

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
   * The fixture installs valid templates whose links Canvas itself offers.
   */
  public function testInstall(): void {
    // Saving validated each template (strict config schema), and the fixture
    // validates again. Every link is one Canvas offers for that prop.
    $suggester = $this->container->get(PropSourceSuggester::class);
    $unknown = [];
    foreach (ComplexContent::links() as $id => $instances) {
      $bundle = explode('.', $id)[1];
      foreach ($instances as $instance => $props) {
        $component = Component::load('js.' . explode(':', $instance)[1]);
        self::assertInstanceOf(Component::class, $component);
        $source = $component->getComponentSource();
        self::assertInstanceOf(JsonSchemaPropsComponentSourceBase::class, $source);
        $offered = [];
        foreach ($suggester->suggest($source->getSourceSpecificComponentId(), $source->getMetadata(), EntityDataDefinition::createFromDataType("entity:node:$bundle")) as $cpe => $suggestions) {
          foreach ($suggestions['entity-field'] as $suggestion) {
            $offered[ComponentPropExpression::fromString($cpe)->propName][] = $suggestion->toArray()['expression'];
          }
        }
        foreach ($props as $prop => $expression) {
          if (!in_array($expression, $offered[$prop] ?? [], TRUE)) {
            $unknown["$id $instance $prop"] = ['stored' => $expression, 'offered' => $offered[$prop] ?? []];
          }
        }
      }
    }
    self::assertSame([], $unknown);

    $templates = ContentTemplate::loadMultiple();
    foreach ([
      'event.full',
      'product.full',
      'product.teaser',
      'job_posting.full',
      'person.full',
      'announcement.full',
    ] as $id) {
      self::assertTrue($templates["node.$id"]->status(), $id);
    }
    // Never published.
    self::assertFalse($templates['node.recipe.full']->status());
    self::assertArrayNotHasKey('node.venue.full', $templates);
    // A type with no nodes.
    self::assertSame(0, (int) $this->container->get('entity_type.manager')->getStorage('node')->getQuery()->accessCheck(FALSE)->condition('type', 'announcement')->count()->execute());

    // The Event template's draft differs from what is live.
    $draft = $this->container->get(AutoSaveManager::class)->getAutoSaveEntity($templates['node.event.full']);
    self::assertFalse($draft->isEmpty());
    self::assertSame(ComplexContent::CLIENT_ID, $draft->clientId);
    $draft_template = $draft->entity;
    self::assertInstanceOf(ContentTemplate::class, $draft_template);
    self::assertSame(['text' => 'Tickets'], $draft_template->getThirdPartySetting('canvas_metatag', 'values')['title_end']);
    self::assertSame(['text' => 'Events'], $templates['node.event.full']->getThirdPartySetting('canvas_metatag', 'values')['title_end']);
    self::assertCount(count($templates['node.event.full']->getComponentTree()) + 1, $draft_template->getComponentTree());

    // The unpublished preview node, hidden references and empty fields.
    $nodes = Node::loadMultiple($this->complex['node']);
    $ids = $this->complex['node'];
    $node = static fn (string $key): NodeInterface => $nodes[$ids[$key]];
    self::assertFalse($node('event_unpublished')->isPublished());
    self::assertFalse($node('venue_hidden')->isPublished());
    self::assertSame([], $node('product_empty')->get('field_gallery')->getValue());
    self::assertCount(2, $node('event_full')->get('field_performers'));
    self::assertSame('', $node('article_mixed')->get('field_image')->alt);
    // Formatted text uses the format Canvas ships, so it renders anywhere.
    self::assertSame('canvas_html_block', $node('product_lamp')->get('body')->format);
    foreach (['recipe_bread', 'recipe_rtl'] as $key) {
      self::assertSame(['canvas_html_block'], array_unique(array_column($node($key)->get('field_steps')->getValue(), 'format')), $key);
    }

    // Every node resolves; the template decides which heads are ours.
    $resolver = $this->resolver();
    foreach ($this->complex['node'] as $key => $id) {
      $owned = in_array($nodes[$id]->bundle(), ['event', 'product', 'job_posting', 'person'], TRUE);
      self::assertSame($owned, $resolver->owns($nodes[$id]), $key);
      if ($owned) {
        self::assertNotSame('', $resolver->resolve($nodes[$id])['head']['title'], $key);
      }
    }
    // A template that was never published counts for previews only.
    self::assertTrue($resolver->owns($node('recipe_bread'), TRUE));

    // The baseline the scenario matrix starts from, with linked values: a
    // text list gives its key, so the currency passes; the street address is
    // read through the venue, so the event ships; a hidden first performer or
    // venue gives nothing.
    $lamp = $resolver->resolve($node('product_lamp'));
    self::assertNull($lamp['schema']['withheld']);
    $event = $resolver->resolve($node('event_full'));
    self::assertNull($event['schema']['withheld']);

    self::assertSame('Midsummer Night Concert | Events', $event['head']['title']);
    self::assertSame('Lakeside Concert Hall', $this->linked($node('event_full'), 'field_venue␞␟entity␜␜entity:node␝title␞␟value'));
    self::assertSame('EventScheduled', $this->linked($node('event_full'), 'field_event_status␞␟value'));
    self::assertSame('', $this->linked($node('event_hidden_refs'), 'field_venue␞␟entity␜␜entity:node␝title␞␟value'));
    self::assertSame('', $this->linked($node('event_hidden_refs'), 'field_performers␞␟entity␜␜entity:node␝title␞␟value'));
    self::assertSame('2027-06-19T19:00:00+03:00', $this->linked($node('event_full'), 'field_starts␞␟value', 'date'));
    self::assertSame('2027-01-31', $this->linked($node('job_developer'), 'field_valid_through␞␟value', 'date'));
    self::assertSame('', $this->linked($node('job_developer'), 'field_no_view_access␞␟value'));

    // The field that visitors cannot view is hidden here.
    self::assertFalse($node('job_developer')->get('field_no_view_access')->access('view', new AnonymousUserSession()));
  }

  /**
   * Installing again changes nothing; teardown removes only the fixture.
   */
  public function testIdempotentAndTeardown(): void {
    $counts = $this->counts();
    self::assertSame($this->complex, ComplexContent::install());
    self::assertSame($counts, $this->counts());
    self::assertFalse($this->container->get(AutoSaveManager::class)->getAutoSaveEntity(ContentTemplate::load('node.event.full'))->isEmpty());

    // Content and types that were there before stay.
    $mine = Node::create(['type' => 'article', 'title' => 'Not the fixture\'s']);
    $mine->save();
    ComplexContent::teardown();
    ComplexContent::teardown();
    self::assertSame(['article'], array_keys(NodeType::loadMultiple()));
    self::assertSame([(int) $mine->id()], array_map('intval', array_values($this->container->get('entity_type.manager')->getStorage('node')->getQuery()->accessCheck(FALSE)->execute())));
    self::assertSame([], ContentTemplate::loadMultiple());
    foreach (['media', 'file', 'taxonomy_term'] as $entity_type_id) {
      self::assertSame(0, $this->counts()[$entity_type_id], $entity_type_id);
    }
    self::assertNull($this->container->get('entity.repository')->loadEntityByUuid('user', ComplexContent::uuid('author')));
    self::assertSame([], $this->container->get(AutoSaveManager::class)->getAllAutoSaveList(FALSE, FALSE));
    self::assertNotNull(Component::load('js.heading'));
    self::assertNotNull($this->container->get('entity_type.manager')->getStorage('media_type')->load('image'));

    // And it can be installed again.
    self::assertCount(count($this->complex['node']), ComplexContent::install()['node']);
  }

  /**
   * What a value linked to a field of the node's type gives.
   */
  private function linked(NodeInterface $node, string $path, string $kind = 'text'): string {
    $source = ['expression' => 'ℹ︎␜entity:node:' . $node->bundle() . '␝' . $path, 'sourceType' => 'entity-field'];
    return (string) $this->resolver()->link($source, $node, $kind, new CacheableMetadata())[1];
  }

  /**
   * Entity counts by type.
   *
   * @return array<string, int>
   *   Entity type id => count.
   */
  private function counts(): array {
    $counts = [];
    foreach ([
      'node',
      'media',
      'file',
      'taxonomy_term',
      'user',
      'content_template',
      'field_config',
    ] as $entity_type_id) {
      $counts[$entity_type_id] = (int) $this->container->get('entity_type.manager')->getStorage($entity_type_id)->getQuery()->accessCheck(FALSE)->count()->execute();
    }
    return $counts;
  }

}
