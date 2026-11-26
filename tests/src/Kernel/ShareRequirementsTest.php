<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas_metatag\Hook\CanvasMetatagHooks;
use Drupal\canvas_metatag\Hook\ShareHooks;
use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\Extension\Requirement\RequirementSeverity;
use Drupal\Core\StreamWrapper\PublicStream;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The status report row "SEO share images".
 *
 * Share-images "Without the tools, sharing degrades to the original files".
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(ShareHooks::class)]
#[CoversClass(CanvasMetatagHooks::class)]
#[Group('canvas_metatag')]
#[RequiresFunction('imagettftext')]
final class ShareRequirementsTest extends CanvasKernelTestBase {

  use ShareTestTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    self::spyOnRenderer($container);
  }

  /**
   * A healthy site makes images; public files elsewhere are reported.
   */
  public function testRequirements(): void {
    $row = $this->row();
    self::assertSame('SEO share images', (string) $row['title']);
    self::assertSame('Made on this site', (string) $row['value']);
    self::assertSame(RequirementSeverity::OK, $row['severity']);
    self::assertArrayNotHasKey('description', $row);

    // Public files on a stream that has no local path.
    $this->container->set('stream_wrapper.public', new class() extends PublicStream {

      /**
       * {@inheritdoc}
       */
      public function realpath() {
        return FALSE;
      }

    });
    $row = $this->row();
    self::assertSame('Not made', (string) $row['value']);
    self::assertSame(RequirementSeverity::Warning, $row['severity']);
    self::assertStringStartsWith("The public files are not on this server's disk", (string) $row['description']);
  }

  /**
   * A test card that cannot be drawn in memory is reported.
   */
  public function testBrokenRender(): void {
    ShareRendererSpy::$broken = TRUE;
    $row = $this->row();
    self::assertSame('Not made', (string) $row['value']);
    self::assertSame(RequirementSeverity::Warning, $row['severity']);
    // Pages still name made images: links to them fail, as it says.
    self::assertStringStartsWith('A test card could not be drawn', (string) $row['description']);
    self::assertStringContainsString('share images are not made and links to them fail', (string) $row['description']);
    self::assertSame('card', ShareRendererSpy::$drawn[0][0]);
  }

  /**
   * Without GD's FreeType, the report names it, and nothing is drawn.
   */
  public function testNoFreeType(): void {
    ShareRendererSpy::$unavailable = TRUE;
    $row = $this->row();
    self::assertSame('Not made', (string) $row['value']);
    self::assertSame(RequirementSeverity::Warning, $row['severity']);
    self::assertStringContainsString('FreeType', (string) $row['description']);
    self::assertStringContainsString('pages share their original images', (string) $row['description']);
    self::assertSame([], ShareRendererSpy::$drawn);
  }

  /**
   * The row as the status report gets it.
   */
  private function row(): array {
    return $this->container->get('module_handler')->invoke('canvas_metatag', 'runtime_requirements')['canvas_metatag_share'];
  }

}
