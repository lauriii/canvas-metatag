<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\Legacy;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests the conversion of values stored in the brace form.
 */
#[CoversClass(Legacy::class)]
#[Group('canvas_metatag')]
final class LegacyTest extends UnitTestCase {

  private const UUID = '6f1c2a0e-5b7d-4c1e-9a53-0d6f7c1b2e44';

  /**
   * The fields of the article type, as the update links them.
   */
  private static function fields(): \Closure {
    return static fn (string $name, string $kind): ?array => match ("$name:$kind") {
      'field_summary:text', 'field_byline:text', 'field_summary:words', 'field_byline:words', 'field_byline:line' => [
        'source' => ['expression' => "ℹ︎␜entity:node:article␝{$name}␞␟value", 'sourceType' => 'entity-field'],
      ],
      'body:text' => ['fact' => 'description'],
      'field_hero:image' => [
        'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_hero␞␟image', 'sourceType' => 'entity-field'],
      ],
      'field_starts:date' => [
        'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_starts␞␟value', 'sourceType' => 'entity-field'],
      ],
      // A date is never text, and a field that is gone gives nothing.
      default => NULL,
    };
  }

  /**
   * One conversion per rule of the update.
   */
  #[DataProvider('providerConvert')]
  public function testConvert(string $scope, array $old, array $expected, array $log = [], ?array $below = NULL): void {
    self::assertSame([$expected, $log], Legacy::convert($old, $scope, self::fields(), $below));
  }

  /**
   * Data provider for testConvert().
   */
  public static function providerConvert(): \Generator {
    $byline = [
      'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_byline␞␟value', 'sourceType' => 'entity-field'],
    ];
    $summary = [
      'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_summary␞␟value', 'sourceType' => 'entity-field'],
    ];

    // Titles.
    yield 'the installed site pattern' => [
      'site',
      ['title' => '{title} {sep} {site}', 'robots' => ['max_image_preview' => 'large']],
      ['robots' => ['max_image_preview' => 'large']],
    ];
    yield 'a site ending' => [
      'site',
      ['title' => '{title} {sep} Example Co'],
      ['title_end' => ['text' => 'Example Co']],
    ];
    yield 'a site title without an ending' => ['site', ['title' => '{title}'], ['title_end' => ['text' => '']]];
    yield 'a site main part' => [
      'site',
      ['title' => 'Welcome {sep} {site}'],
      [],
      ['title: the site sets only the ending now; dropped the main part.'],
    ];
    yield 'a template ending' => [
      'template',
      ['title' => '{title} {sep} Journal'],
      ['title_end' => ['text' => 'Journal']],
    ];
    yield 'a page title with the site ending' => [
      'page',
      ['title' => 'Pricing plans for every team {sep} {site}'],
      ['title' => ['text' => 'Pricing plans for every team']],
    ];
    yield 'an ending equal to the site\'s' => [
      'page',
      ['title' => 'Pricing {sep} Example Co'],
      ['title' => ['text' => 'Pricing']],
      [],
      ['text' => 'Example Co'],
    ];
    yield 'the site name over a typed site ending' => [
      'page',
      ['title' => 'Pricing {sep} {site}'],
      ['title' => ['text' => 'Pricing'], 'title_end' => ['fact' => 'site']],
      [],
      ['text' => 'Example Co'],
    ];
    yield 'a title without a separator' => [
      'page',
      ['title' => 'Pricing | Example'],
      ['title' => ['text' => 'Pricing | Example'], 'title_end' => ['text' => '']],
    ];
    // A separator before the last is typed separator text.
    yield 'the last separator splits' => [
      'template',
      ['title' => '{title} {sep} Guides {sep} Journal'],
      ['title' => ['parts' => [['fact' => 'title'], ['text' => ' | Guides']]], 'title_end' => ['text' => 'Journal']],
    ];
    yield 'a linked main part' => ['template', ['title' => '{field.field_byline} {sep} {site}'], ['title' => $byline]];

    // A template's composites are composed whole; a page's keep their
    // first part.
    yield 'a composite title' => [
      'template',
      ['title' => '{title} by {field.field_byline}'],
      ['title' => ['parts' => [['fact' => 'title'], ['text' => ' by '], $byline]], 'title_end' => ['text' => '']],
    ];
    yield 'byline: title' => [
      'template',
      ['title' => '{field.field_byline}: {title}'],
      ['title' => ['parts' => [$byline, ['text' => ': '], ['fact' => 'title']]], 'title_end' => ['text' => '']],
    ];
    yield 'title, oak' => [
      'template',
      ['title' => '{title}, oak'],
      ['title' => ['parts' => [['fact' => 'title'], ['text' => ', oak']]], 'title_end' => ['text' => '']],
    ];
    yield 'a composite with a field the type no longer has' => [
      'template',
      ['description' => '{title} in {field.field_gone} {sep} {site}'],
      ['description' => ['parts' => [['fact' => 'title'], ['text' => ' | '], ['fact' => 'site']]]],
      ['description: composed of the parts that fit; dropped {field.field_gone}.'],
    ];
    yield 'an address inside a composite' => [
      'template',
      ['description' => '{title} at {url}'],
      ['description' => ['fact' => 'title']],
      ['description: composed of the parts that fit; dropped {url}.'],
    ];
    yield 'a long text in a composed title' => [
      'template',
      ['social' => ['title' => '{title}: {field.body}']],
      [],
      // What is left is the place's default: said as such.
      ['social.title: uses its default; dropped {field.body}.'],
    ];
    yield 'nine fields' => [
      'template',
      ['description' => '{title} · {author} · {site} · {published} · {modified} · {title} · {author} · {site} · {published}'],
      [
        'description' => [
          'parts' => [
        ['fact' => 'title'], ['text' => ' · '], ['fact' => 'author'], ['text' => ' · '], ['fact' => 'site'], ['text' => ' · '],
        ['fact' => 'published'], ['text' => ' · '], ['fact' => 'modified'], ['text' => ' · '], ['fact' => 'title'], ['text' => ' · '],
        ['fact' => 'author'], ['text' => ' · '], ['fact' => 'site'],
          ],
        ],
      ],
      ['description: composed of the parts that fit; dropped {published}.'],
    ];
    yield 'a composite on a page' => [
      'page',
      ['title' => 'Plans for {site} teams'],
      ['title' => ['text' => 'Plans for'], 'title_end' => ['text' => '']],
      ['title: kept its first part; dropped {site}, typed text.'],
    ];
    yield 'never published: title' => [
      'page',
      ['title' => 'Never published: {title}'],
      ['title' => ['text' => 'Never published:'], 'title_end' => ['text' => '']],
      ['title: kept its first part; dropped {title}.'],
    ];

    // Other values.
    yield 'a whole field' => ['template', ['description' => '{field.field_summary}'], ['description' => $summary]];
    yield 'the first formatted text is the Description fact' => ['template', ['description' => '{field.body}'], []];
    yield 'a whole fact' => [
      'template',
      ['social' => ['title' => '{author}']],
      ['social' => ['title' => ['fact' => 'author']]],
    ];
    yield 'a default fact is not kept' => ['template', ['social' => ['title' => '{title}', 'image' => '{image}']], []];
    yield 'typed text stays as typed' => [
      'template',
      ['social' => ['description' => ' See every plan. ']],
      ['social' => ['description' => ['text' => ' See every plan. ']]],
    ];
    yield 'a media item' => [
      'page',
      ['social' => ['image' => self::UUID]],
      ['social' => ['image' => ['media' => self::UUID]]],
    ];
    yield 'an image field' => [
      'template',
      ['social' => ['image' => '{field.field_hero}']],
      [
        'social' => [
          'image' => [
            'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_hero␞␟image', 'sourceType' => 'entity-field'],
          ],
        ],
      ],
    ];
    yield 'a date field in text' => [
      'template',
      ['description' => '{field.field_starts}'],
      [],
      ['description: removed; dropped {field.field_starts}.'],
    ];
    // Its lead-in goes with it.
    yield 'a field that is gone' => [
      'template',
      ['description' => 'Read {field.field_gone}'],
      [],
      ['description: removed; dropped {field.field_gone}.'],
    ];
    yield 'an unknown name' => [
      'template',
      ['social' => ['title' => '{nope}']],
      [],
      ['social.title: removed; dropped {nope}.'],
    ];
    yield 'a field on a page' => [
      'page',
      ['social' => ['title' => '{field.field_byline}']],
      [],
      ['social.title: not available here; dropped.'],
    ];
    yield 'a composite that starts with the default' => [
      'template',
      ['social' => ['title' => '{title} {sep} {site}']],
      ['social' => ['title' => ['parts' => [['fact' => 'title'], ['text' => ' | '], ['fact' => 'site']]]]],
    ];
    yield 'a composite on a page that starts with the default' => [
      'page',
      ['social' => ['title' => '{title} {sep} {site}']],
      [],
      ['social.title: uses its default; dropped {sep}, {site}.'],
    ];
    yield "a page's social description that is its default" => [
      'page',
      ['social' => ['description' => '{description}']],
      [],
    ];
    yield 'a fact a page cannot link' => [
      'page',
      ['social' => ['title' => '{author}']],
      [],
      ['social.title: not available here; dropped.'],
    ];

    // Structured data details take the kind of their property.
    yield 'details' => ['template', [
      'schema' => [
        'type' => 'Event',
        'props' => [
          'startDate' => '{field.field_starts}',
          'name' => '{title}',
          'eventStatus' => 'EventScheduled',
          'image' => self::UUID,
          'location_name' => '{published}',
        ],
      ],
    ], [
      'schema' => [
        'props' => [
          'eventStatus' => ['text' => 'EventScheduled'],
          'image' => ['media' => self::UUID],
          'startDate' => [
            'source' => ['expression' => 'ℹ︎␜entity:node:article␝field_starts␞␟value', 'sourceType' => 'entity-field'],
          ],
        ],
        'type' => 'Event',
      ],
    ], ['schema.props.location_name: removed; dropped {published}.'],
    ];
    // A translation names no type: its details belong to the type it
    // inherits, and a page draft keeps the published type's. They stay.
    yield 'a translation\'s detail of an inherited type' => [
      'page',
      ['schema' => ['props' => ['offers_price' => '49', 'headline' => 'Tarifs {sep} {site}']]],
      ['schema' => ['props' => ['headline' => ['text' => 'Tarifs'], 'offers_price' => ['text' => '49']]]],
      ['schema.props.headline: kept its first part; dropped {sep}, {site}.'],
    ];
    yield 'a detail of another type that does not pass there' => [
      'page',
      ['schema' => ['props' => ['offers_priceCurrency' => 'euros']]],
      [],
      ['schema.props.offers_priceCurrency: not available here; dropped.'],
    ];
    yield 'custom JSON-LD that names a field' => [
      'template',
      ['schema' => ['custom' => '{"@type":"Thing","name":"{field.field_byline}"}']],
      ['schema' => ['custom' => '{"@type":"Thing","name":"{field.field_byline}"}']],
      ['schema.custom: names a field. A whole value is filled from its field; a name inside other text stays as written.'],
    ];

    // Already converted: left as it is.
    yield 'values' => [
      'template',
      ['title_end' => ['text' => 'Journal'], 'description' => $summary],
      ['description' => $summary, 'title_end' => ['text' => 'Journal']],
    ];
  }

  /**
   * The seven values the farm site stored, converted as the update does.
   */
  public function testFarmSite(): void {
    $none = static fn (): ?array => NULL;
    self::assertSame([
      ['robots' => ['max_image_preview' => 'large']],
      [],
    ], Legacy::convert(['title' => '{title} {sep} {site}', 'robots' => ['max_image_preview' => 'large']], 'site', $none));
    self::assertSame([['title_end' => ['text' => 'News']], []], Legacy::convert(['title' => '{title} {sep} News'], 'template', $none));
    self::assertSame([
      ['title_end' => ['text' => 'Recipes']],
      ['description: removed; dropped {field.field_ingredients}.'],
    ], Legacy::convert(['title' => '{title} {sep} Recipes', 'description' => '{field.field_ingredients}'], 'template', $none));
    [$article] = Legacy::convert([
      'title' => '{title} {sep} Journal',
      'description' => '{field.field_summary}',
      'social' => ['image' => '{field.field_hero}'],
      'schema' => ['type' => 'Article', 'props' => ['author_name' => '{field.field_byline}']],
    ], 'template', self::fields());
    self::assertSame(['description', 'schema', 'social', 'title_end'], array_keys($article));
    self::assertSame('Journal', $article['title_end']['text']);
    self::assertSame('ℹ︎␜entity:node:article␝field_byline␞␟value', $article['schema']['props']['author_name']['source']['expression']);
    // A product's body and gallery are its Description and Image facts:
    // nothing to keep.
    $product = static fn (string $name, string $kind): ?array => [
      'body:text' => ['fact' => 'description'],
      'field_gallery:image' => ['fact' => 'image'],
    ]["$name:$kind"] ?? NULL;
    self::assertSame([['schema' => ['type' => 'Product']], []], Legacy::convert([
      'description' => '{field.body}',
      'social' => ['image' => '{field.field_gallery}'],
      'schema' => ['type' => 'Product', 'props' => ['image' => '{field.field_gallery}']],
    ], 'template', $product));
  }

}
