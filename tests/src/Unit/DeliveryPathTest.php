<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Group;

/**
 * A visitor's head never computes what only the dialog shows.
 *
 * Verdicts and the rules of hand-added items run in Resolver::report(), which
 * only the dialog's state route calls; the coupled head (page_attachments)
 * and the headless decorator call resolve(). This test finds every call by
 * the function it is made in, so a call added on the delivery path fails.
 */
#[CoversNothing]
#[Group('canvas_metatag')]
final class DeliveryPathTest extends UnitTestCase {

  /**
   * Each dialog-only function is called from where it may be, only.
   */
  public function testOnlyTheDialogReachesTheVerdicts(): void {
    $root = dirname(__DIR__, 3);
    $calls = self::calls($root);
    self::assertSame(['Controller/ApiController.php::state'], $calls['report'] ?? []);
    self::assertSame(['Resolver.php::report'], $calls['features'] ?? []);
    self::assertSame(['Resolver.php::report'], $calls['rules'] ?? []);
    // The delivery paths call resolve(), and nothing else of the three.
    self::assertContains('Hook/CanvasMetatagHooks.php::head', $calls['resolve']);
    self::assertContains('Controller/HeadlessContentController.php::get', $calls['resolve']);
  }

  /**
   * The check sees a call wherever it is made.
   */
  public function testCatchesCall(): void {
    $root = sys_get_temp_dir() . '/canvas_metatag_delivery_' . getmypid();
    @mkdir("$root/src/Hook", 0777, TRUE);
    file_put_contents("$root/src/Hook/Hooks.php", "<?php\nclass Hooks {\n  public function pageAttachments() {\n    \$this->resolver?->report(\$entity);\n    SchemaGraph::features([], []);\n  }\n}\n");
    try {
      $calls = self::calls($root);
      self::assertSame(['Hook/Hooks.php::pageAttachments'], $calls['report']);
      self::assertSame(['Hook/Hooks.php::pageAttachments'], $calls['features']);
    }
    finally {
      unlink("$root/src/Hook/Hooks.php");
      rmdir("$root/src/Hook");
      rmdir("$root/src");
      rmdir($root);
    }
  }

  /**
   * Where report(), resolve(), features() and rules() are called.
   *
   * @return array<string, list<string>>
   *   Method => "file::function" of each call in src/, sorted.
   */
  private static function calls(string $root): array {
    $calls = [];
    $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator("$root/src", \FilesystemIterator::SKIP_DOTS));
    foreach ($files as $file) {
      if ($file->getExtension() !== 'php') {
        continue;
      }
      $tokens = array_values(array_filter(token_get_all((string) file_get_contents($file->getPathname())), static fn (mixed $token): bool => !is_array($token) || !in_array($token[0], [
        T_WHITESPACE,
        T_COMMENT,
        T_DOC_COMMENT,
      ], TRUE)));
      $function = '';
      foreach ($tokens as $at => $token) {
        if (is_array($token) && $token[0] === T_FUNCTION && is_array($tokens[$at + 1]) && $tokens[$at + 1][0] === T_STRING) {
          $function = $tokens[$at + 1][1];
        }
        $called = is_array($token) && $token[0] === T_STRING && in_array($token[1], [
          'report',
          'resolve',
          'features',
          'rules',
        ], TRUE) && ($tokens[$at + 1] ?? NULL) === '(';
        $by = $tokens[$at - 1] ?? NULL;
        if ($called && is_array($by) && in_array($by[0], [T_OBJECT_OPERATOR, T_NULLSAFE_OBJECT_OPERATOR, T_DOUBLE_COLON], TRUE)) {
          $calls[$token[1]][] = substr($file->getPathname(), strlen("$root/src/")) . "::$function";
        }
      }
    }
    return array_map(static function (array $where): array {
      $where = array_values(array_unique($where));
      sort($where);
      return $where;
    }, $calls);
  }

}
