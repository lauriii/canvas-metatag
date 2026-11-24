<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Kernel;

use Drupal\canvas_headless\Controller\CanvasContentController;
use Drupal\canvas_metatag\Hook\CanvasMetatagHooks;
use Drupal\Core\Extension\Requirement\RequirementSeverity;
use Drupal\Tests\canvas\Kernel\CanvasKernelTestBase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;

// cspell:ignore ddev
/**
 * Tests the status report row "SEO public addresses".
 */
#[RunTestsInSeparateProcesses]
#[CoversClass(CanvasMetatagHooks::class)]
#[Group('canvas_metatag')]
final class StatusReportTest extends CanvasKernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    ...CanvasKernelTestBase::CANVAS_KERNEL_TEST_MINIMAL_MODULES,
    'serialization',
    'canvas_metatag',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $modules = ['consumers', 'simple_oauth', 'custom_elements', 'canvas_headless'];
    if (array_diff($modules, array_keys($this->container->get('extension.list.module')->getList()))) {
      self::markTestSkipped('canvas_headless or one of its dependencies is not in the codebase.');
    }
    $this->enableModules($modules);
    $this->installConfig(['canvas_headless']);
  }

  /**
   * Each case of the row, by the frontend, the setting and Drupal's host.
   */
  public function testPublicAddresses(): void {
    // A development frontend in production: an error with its fix, beside
    // the error of a content API that no longer runs through this module.
    $this->frontend('http://localhost:3000');
    $this->container->set(CanvasContentController::class, new \stdClass());
    $report = $this->report('https://cms.example.com');
    $row = $report['canvas_metatag_public_base'];
    self::assertSame('SEO public addresses', (string) $row['title']);
    self::assertSame(RequirementSeverity::Error, $row['severity']);
    self::assertSame('http://localhost:3000', $row['value']);
    self::assertSame("Pages carry no address, because http://localhost:3000 is not public. Set canvas_metatag_public_base in settings.php to the public address for this environment.", (string) $row['description']);
    self::assertSame(RequirementSeverity::Error, $report['canvas_metatag_headless']['severity']);

    // A local frontend on a development site is the normal local setup,
    // plain http on a known local suffix too; in production, plain http is
    // an error.
    self::assertArrayNotHasKey('canvas_metatag_public_base', $this->report('https://cms.example.test'));
    $this->frontend('http://front.ddev.site');
    self::assertArrayNotHasKey('canvas_metatag_public_base', $this->report('https://cms.example.test'));
    self::assertSame(RequirementSeverity::Error, $this->report('https://cms.example.com')['canvas_metatag_public_base']['severity']);
    // A known local suffix resolves to 127.0.0.1: no visitor reaches it, in
    // https too.
    $this->frontend('https://front.ddev.site');
    $row = $this->report('https://cms.example.com')['canvas_metatag_public_base'];
    self::assertSame(RequirementSeverity::Error, $row['severity']);
    self::assertStringStartsWith('Pages carry no address, because https://front.ddev.site is not public.', (string) $row['description']);
    self::assertArrayNotHasKey('canvas_metatag_public_base', $this->report('https://cms.example.test'));

    // Canvas refuses a frontend in another spelling of an address (its form
    // and config schema too; stored past them here): pages use the
    // request's address, so there is nothing to report.
    foreach (['http://127.1:3000', 'http://[::ffff:127.0.0.1]:3000'] as $url) {
      $settings = ['frontends' => [['url' => $url, 'components' => []]]] + $this->config('canvas_headless.settings')->get();
      $this->container->get('config.storage')->write('canvas_headless.settings', $settings);
      $this->container->get('config.factory')->reset('canvas_headless.settings');
      self::assertArrayNotHasKey('canvas_metatag_public_base', $this->report('https://cms.example.com'), $url);
    }

    // A frontend on an internal name, seen from a development site.
    $this->frontend('http://cms.internal:8080');
    $row = $this->report('https://cms.example.test')['canvas_metatag_public_base'];
    self::assertSame(RequirementSeverity::Warning, $row['severity']);
    self::assertStringContainsString('http://cms.internal:8080, which is not public', (string) $row['description']);

    // A plain http frontend: an error in production, a warning on a
    // development site.
    $this->frontend('http://www.example.com');
    $row = $this->report('https://cms.example.com')['canvas_metatag_public_base'];
    self::assertSame(RequirementSeverity::Error, $row['severity']);
    self::assertSame("Pages tell visitors and search engines to use http://www.example.com, which is not https. Set canvas_metatag_public_base in settings.php to the public address for this environment.", (string) $row['description']);
    self::assertSame(RequirementSeverity::Warning, $this->report('https://cms.example.test')['canvas_metatag_public_base']['severity']);

    // A public base set for the environment wins over the frontend.
    $this->frontend('http://localhost:3000');
    $this->setSetting('canvas_metatag_public_base', 'https://www.example.com');
    self::assertArrayNotHasKey('canvas_metatag_public_base', $this->report('https://cms.example.com'));
    // A setting that is not an absolute address is ignored, and the row says
    // so, not that it is missing.
    $this->setSetting('canvas_metatag_public_base', 'www.example.com');
    $row = $this->report('https://cms.example.com')['canvas_metatag_public_base'];
    self::assertSame(RequirementSeverity::Error, $row['severity']);
    self::assertSame('http://localhost:3000', $row['value']);
    self::assertSame('canvas_metatag_public_base in settings.php is "www.example.com", which is not an absolute http or https address without a query or fragment, so pages use http://localhost:3000. Set it to the public https address for this environment, such as https://www.example.com.', (string) $row['description']);
    self::assertSame(RequirementSeverity::Warning, $this->report('https://cms.example.test')['canvas_metatag_public_base']['severity']);
    // Another spelling of a loopback address is an address, and not public.
    foreach (['http://127.1:3000', 'http://[::ffff:127.0.0.1]:3000', 'http://0177.0.0.1:3000'] as $base) {
      $this->setSetting('canvas_metatag_public_base', $base);
      $row = $this->report('https://cms.example.com')['canvas_metatag_public_base'];
      self::assertSame(RequirementSeverity::Error, $row['severity'], $base);
      self::assertStringStartsWith("Pages carry no address, because $base is not public.", (string) $row['description']);
      self::assertArrayNotHasKey('canvas_metatag_public_base', $this->report('https://cms.example.test'), $base);
    }
    // An empty setting is unset: the frontend's row, not the setting's.
    $this->setSetting('canvas_metatag_public_base', '');
    $this->frontend('http://localhost:3000');
    self::assertStringStartsWith('Pages carry no address, because http://localhost:3000 is not public.', (string) $this->report('https://cms.example.com')['canvas_metatag_public_base']['description']);
    $this->setSetting('canvas_metatag_public_base', NULL);

    // Neither: the request's address. Plain http behind a proxy that ends
    // TLS is a warning naming Drupal's reverse proxy settings, and https or
    // a development host are fine.
    $this->config('canvas_headless.settings')->set('frontends', [])->save();
    $row = $this->report('http://www.example.com')['canvas_metatag_public_base'];
    self::assertSame(RequirementSeverity::Warning, $row['severity']);
    self::assertSame("Pages say their address is http://www.example.com. If visitors use https, set Drupal's reverse proxy settings.", (string) $row['description']);
    self::assertArrayNotHasKey('canvas_metatag_public_base', $this->report('https://www.example.com'));
    self::assertArrayNotHasKey('canvas_metatag_public_base', $this->report('http://cms.example.test'));
  }

  /**
   * Sets the one frontend.
   */
  private function frontend(string $url): void {
    $this->config('canvas_headless.settings')->set('frontends', [['url' => $url, 'components' => []]])->save();
  }

  /**
   * The module's status report rows, as seen at an address of Drupal's.
   */
  private function report(string $drupal): array {
    $stack = $this->container->get(RequestStack::class);
    $stack->push(Request::create($drupal . '/admin/reports/status'));
    try {
      return $this->container->get('module_handler')->invoke('canvas_metatag', 'runtime_requirements');
    }
    finally {
      $stack->pop();
    }
  }

}
