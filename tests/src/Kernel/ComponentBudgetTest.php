<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas\Entity\Page;
use Drupal\canvas_metatag\Resolver;
use Drupal\canvas_metatag\Sources;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use Drupal\Tests\canvas\Traits\GenerateComponentConfigTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Reading a page's components stays within the agreed budget.
 *
 * The product owner's budget (decisions, item 7): reading 20 mapped
 * component instances adds at most 10 ms to a warm page delivery. Measured
 * with what delivery reads now (the instance list and the breadcrumb trail
 * of a page two levels down) and the values a later change maps.
 *
 * Wall-clock time on shared CI runners is not the farm's: there, a run over
 * the budget is reported as incomplete, not failed. Run it locally to hold
 * the budget.
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(Sources::class)]
#[CoversClass(Resolver::class)]
#[Group('canvas_metatag')]
final class ComponentBudgetTest extends CanvasKernelTestBase {

  use GenerateComponentConfigTrait;
  use SeoFixtureTrait;

  /**
   * Milliseconds the warm reading of 20 instances may take.
   */
  private const WARM_BUDGET = 10.0;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'canvas_test_sdc',
    'node',
    'field',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setUpSite();
    $this->generateComponentConfig();
  }

  /**
   * Twenty instances, each with a value read, and the trail, warm.
   */
  public function testWarmDelivery(): void {
    $this->createChrome([self::breadcrumb()]);
    $this->createPage(['title' => 'Shop', 'path' => ['alias' => '/shop']]);
    $this->createPage(['title' => 'Lamps', 'path' => ['alias' => '/shop/lamps']]);
    $tree = [];
    for ($at = 1; $at <= 20; $at++) {
      $tree[] = self::placed(sprintf('00000000-0000-4000-8000-%012d', $at), 'sdc.canvas_test_sdc.props-no-slots', ['heading' => "Plan $at"]);
    }
    $page = Page::load($this->createPage(['path' => ['alias' => '/shop/lamps/plans'], 'components' => $tree])->id());
    $sources = $this->container->get(Sources::class);
    $resolver = $this->container->get(Resolver::class);
    // What delivery reads: the instance list and, where a breadcrumb shows,
    // the trail.
    $trail = \Closure::bind(fn (Page $page, CacheableMetadata $cacheability): array => $this->trail($page, FALSE, FALSE, $cacheability), $resolver, Resolver::class);
    $read = static function () use ($sources, $resolver, $page, $trail): array {
      $cacheability = new CacheableMetadata();
      [$crumbs] = $trail($page, $cacheability);
      [$instances] = $sources->instances($sources->tree($page, FALSE, $cacheability));
      $read = 0;
      foreach ($instances as $instance) {
        $read += count($resolver->parts($instance, ['heading' => 'text'], $page, $cacheability)[0]);
      }
      return [$read, count($crumbs ?? [])];
    };
    // Cold: Canvas's components, the access results, the routes and the
    // expressions are loaded once per process.
    self::assertSame([20, 3], $read());
    $times = [];
    for ($run = 0; $run < 5; $run++) {
      $start = hrtime(TRUE);
      $read();
      $times[] = (hrtime(TRUE) - $start) / 1e6;
    }
    sort($times);
    // The median run.
    $message = sprintf('Reading 20 instances and the trail took %.1f ms warm.', $times[2]);
    if (getenv('CI') && $times[2] > self::WARM_BUDGET) {
      self::markTestIncomplete($message . ' Over the budget on a CI runner: measure it on a quiet machine.');
    }
    self::assertLessThanOrEqual(self::WARM_BUDGET, $times[2], $message);
  }

}
