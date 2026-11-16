<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Group;
use Symfony\Component\Filesystem\Filesystem;

/**
 * Only Sources may use Canvas's prop source, matching and expression code.
 *
 * Those are Canvas internals whose grammar is persisted in the module's data:
 * keeping them in one class keeps a Canvas change in one place.
 */
#[CoversNothing]
#[Group('canvas_metatag')]
final class BoundaryTest extends UnitTestCase {

  /**
   * The namespaces only Sources may name.
   */
  public const INTERNAL = '/Drupal\\\\canvas\\\\(?:PropSource|ShapeMatcher|PropExpressions)\\\\/';

  /**
   * No other PHP file of the module names them.
   */
  public function testOnlySourcesUsesCanvasSources(): void {
    $root = dirname(__DIR__, 3);
    self::assertSame([], self::offenders($root));
    self::assertContains("$root/src/Sources.php", self::files($root));
    self::assertContains("$root/canvas_metatag.post_update.php", self::files($root));
  }

  /**
   * The check finds a file that names one of them, wherever it is.
   */
  public function testCatchesAnImport(): void {
    $root = sys_get_temp_dir() . '/canvas_metatag_boundary_' . getmypid();
    $planted = [
      'src/Sources.php' => FALSE,
      'src/Resolver.php' => TRUE,
      'canvas_metatag.post_update.php' => TRUE,
      'canvas_metatag.module' => TRUE,
      'modules/sub/src/Sources.php' => TRUE,
      'tests/src/Kernel/SourcesTest.php' => FALSE,
    ];
    foreach (array_keys($planted) as $path) {
      @mkdir(dirname("$root/$path"), 0777, TRUE);
      file_put_contents("$root/$path", "<?php\nuse Drupal\\canvas\\PropSource\\PropSource;\n");
    }
    try {
      $expected = array_map(static fn (string $path): string => "$root/$path", array_keys(array_filter($planted)));
      sort($expected);
      self::assertSame($expected, self::offenders($root));
    }
    finally {
      (new Filesystem())->remove($root);
    }
  }

  /**
   * The module's PHP files that name an internal namespace.
   *
   * @return list<string>
   *   Their paths; the module's own src/Sources.php is left out.
   */
  private static function offenders(string $root): array {
    return array_values(array_filter(
      self::files($root),
      static fn (string $file): bool => $file !== "$root/src/Sources.php" && preg_match(self::INTERNAL, (string) file_get_contents($file)),
    ));
  }

  /**
   * Every PHP file of the module, tests and node_modules left out.
   *
   * @return list<string>
   *   Their paths.
   */
  private static function files(string $root): array {
    $files = [];
    $iterator = new \RecursiveIteratorIterator(new \RecursiveCallbackFilterIterator(
      new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
      static fn (\SplFileInfo $file): bool => !$file->isDir()
        || !in_array($file->getFilename(), ['tests', 'node_modules', '.git'], TRUE),
    ));
    foreach ($iterator as $file) {
      if ($file->isFile() && in_array($file->getExtension(), ['php', 'module', 'install', 'inc'], TRUE)) {
        $files[] = $file->getPathname();
      }
    }
    sort($files);
    return $files;
  }

}
