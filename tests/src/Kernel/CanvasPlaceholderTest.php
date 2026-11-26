<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Controller\ApiContentControllers;
use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\PageContent;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The label Canvas gives a new page: a Canvas internal (ARCHITECTURE §11).
 *
 * A page still named with it takes its first heading as its title
 * (PageContent::placeholders()).
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(PageContent::class)]
#[Group('canvas_metatag')]
#[Group('canvas_metatag_canvas_contract')]
final class CanvasPlaceholderTest extends CanvasKernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_metatag',
  ];

  /**
   * Canvas names a new page as the module expects, in English.
   */
  public function testPlaceholder(): void {
    $type = $this->container->get('entity_type.manager')->getDefinition(Page::ENTITY_TYPE_ID);
    $label = ApiContentControllers::defaultTitle($type);
    self::assertInstanceOf(TranslatableMarkup::class, $label);
    self::assertSame(PageContent::PLACEHOLDER, $label->getUntranslatedString());
    self::assertSame('Untitled page', (string) $label);
    self::assertContains((string) $label, $this->container->get(PageContent::class)->placeholders('en'));
  }

}
