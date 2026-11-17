<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\Values;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Tests how one formatted text gives the items of a list.
 */
#[CoversClass(Values::class)]
#[Group('canvas_metatag')]
final class NormaliseTest extends UnitTestCase {

  /**
   * List items first, else paragraphs; each item plain text, no full stop.
   */
  public function testHtmlListItemsSplit(): void {
    // The list items, not the text around them.
    self::assertSame(['Mix', 'Bake'], Values::items('<p>Intro</p><ul><li>Mix</li><li>Bake</li></ul>'));
    self::assertSame(['Preheat', 'Mix'], Values::items('<ol><li>Preheat</li><li>Mix</li></ol>'));
    // Paragraphs when there is no list.
    self::assertSame(['Mix', 'Bake'], Values::items('<p>Mix</p><p>Bake</p>'));
    // A heading is no item; one paragraph is one.
    self::assertSame(['Solid oak.'], Values::items('<h2>Made to last</h2><p>Solid oak.</p>'));
    self::assertSame(['Mix it all and bake.'], Values::items('<p>Mix it all and bake.</p>'));
    // A nested list stays in its item, with the full stops of plain text.
    self::assertSame(['Features. Dimmable.', 'Oak'], Values::items('<ul><li>Features<ul><li>Dimmable</li></ul></li><li>Oak</li></ul>'));
    // Markup and entities inside an item; empty items left out.
    self::assertSame(['Salt & pepper', 'Oil'], Values::items('<ul><li><strong>Salt</strong> &amp; pepper</li><li> </li><li>Oil</li></ul>'));
    // Text with neither is one item; text that is not UTF-8 none.
    self::assertSame(['One method'], Values::items('One method'));
    self::assertSame([], Values::items("\xC3\x28"));
    // A script in an item is never text.
    self::assertSame(['Mix'], Values::items('<ul><li>Mix<script>alert(1)</script></li></ul>'));
  }

}
