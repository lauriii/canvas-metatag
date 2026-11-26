<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\ShareImage;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;

// cspell:ignore ihdr iend nnccccc
/**
 * A page's own image as its 1200 × 630 share version.
 *
 * Share-images "A page's own image is shared as a 1200 × 630 version" and
 * "Untrusted inputs are bounded"; design D9.
 */
#[CoversClass(ShareImage::class)]
#[Group('canvas_metatag')]
#[RequiresFunction('imagecreatetruecolor')]
final class ShareImageTest extends UnitTestCase {

  /**
   * A folder for the files a test writes.
   */
  private string $dir;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->dir = sys_get_temp_dir() . '/share-image-' . bin2hex(random_bytes(4));
    mkdir($this->dir);
  }

  /**
   * {@inheritdoc}
   */
  protected function tearDown(): void {
    array_map('unlink', glob("$this->dir/*"));
    rmdir($this->dir);
    parent::tearDown();
  }

  /**
   * What each size gets.
   */
  #[DataProvider('providerTreatment')]
  public function testTreatment(int $w, int $h, bool $chosen, string $expected): void {
    self::assertSame($expected, ShareImage::treatment($w, $h, $chosen));
  }

  /**
   * Data provider for testTreatment().
   */
  public static function providerTreatment(): \Generator {
    yield 'a 4:3 photo is cropped' => [1600, 1200, FALSE, 'cover'];
    yield 'a wide photo is cropped' => [1770, 996, FALSE, 'cover'];
    yield 'a square is shown whole' => [1200, 1200, FALSE, 'frame'];
    yield 'a panorama is shown whole' => [3000, 1000, FALSE, 'frame'];
    yield 'a small wide image would need over 1.25×' => [640, 320, FALSE, 'frame'];
    yield 'a found image under 600 × 315 is skipped' => [590, 400, FALSE, 'skip'];
    yield 'a chosen 400 × 400 is shown whole' => [400, 400, TRUE, 'frame'];
    yield 'a chosen wide image is never enlarged' => [1100, 600, TRUE, 'frame'];
    yield 'a chosen 150 × 150 is sent as it is' => [150, 150, TRUE, 'original'];
    yield 'a 24 megapixel camera photo is cropped' => [6000, 4000, FALSE, 'cover'];
    yield 'over 24 megapixels is skipped' => [6000, 6000, FALSE, 'skip'];
  }

  /**
   * An image is decoded only when it fits in the memory left.
   */
  public function testMemoryBudget(): void {
    $mb = 1024 * 1024;
    // No limit.
    self::assertTrue(ShareImage::fits(24_000_000, 2, 20 * $mb, NULL));
    // A 4000 × 3000 photo needs about 46 MB, plus its file and a margin.
    self::assertTrue(ShareImage::fits(12_000_000, 1, 4 * $mb, 200 * $mb));
    // A transparent 4800 × 4800 PNG is decoded and flattened: two copies,
    // about 176 MB, which 128 MB left can't hold.
    self::assertFalse(ShareImage::fits(4800 * 4800, 2, 10 * $mb, 128 * $mb));
    // Make() refuses what does not fit, before decoding.
    $limit = ini_get('memory_limit');
    $file = "$this->dir/large.png";
    imagepng(imagecreatetruecolor(2000, 1200), $file);
    ini_set('memory_limit', (string) (memory_get_usage() + 8 * $mb));
    try {
      self::assertNull(ShareImage::make($file, FALSE));
    }
    finally {
      ini_set('memory_limit', (string) $limit);
    }
    self::assertInstanceOf(\GdImage::class, ShareImage::make($file, FALSE));
  }

  /**
   * A phone photo stored sideways (EXIF 6) comes out upright.
   */
  #[RequiresFunction('exif_read_data')]
  public function testOrientation(): void {
    $file = dirname(__DIR__, 2) . '/fixtures/share-images/orientation-6.jpg';
    self::assertSame(6, ShareImage::orientation($file));
    $image = ShareImage::make($file, FALSE);
    self::assertSame([1200, 630], [imagesx($image), imagesy($image)]);
    // Upright, the top is red and the bottom blue, shown whole.
    self::assertSame('red', $this->hue($image, 600, 120));
    self::assertSame('blue', $this->hue($image, 600, 510));
  }

  /**
   * A cut-out whose transparent pixels are stored black sits on white.
   */
  public function testCutout(): void {
    $image = imagecreatetruecolor(800, 800);
    imagealphablending($image, FALSE);
    imagesavealpha($image, TRUE);
    imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
    imagefilledrectangle($image, 250, 200, 550, 600, imagecolorallocate($image, 46, 107, 86));
    imagepng($image, "$this->dir/cutout.png");
    $out = ShareImage::make("$this->dir/cutout.png", FALSE);
    foreach ([[5, 5], [1190, 620], [300, 315]] as [$x, $y]) {
      self::assertSame([255, 255, 255], $this->rgb($out, $x, $y), "($x, $y)");
    }
    self::assertSame([46, 107, 86], $this->rgb($out, 600, 315));
  }

  /**
   * A 4:3 photo fills the card, cropped around its centre.
   */
  public function testCover(): void {
    $image = imagecreatetruecolor(1600, 1200);
    imagefill($image, 0, 0, imagecolorallocate($image, 40, 60, 200));
    // Bands that the crop removes: 180 rows at the top and the bottom.
    imagefilledrectangle($image, 0, 0, 1599, 150, imagecolorallocate($image, 220, 40, 40));
    imagefilledrectangle($image, 0, 1049, 1599, 1199, imagecolorallocate($image, 220, 40, 40));
    imagejpeg($image, "$this->dir/photo.jpg", 90);
    $out = ShareImage::make("$this->dir/photo.jpg", FALSE);
    self::assertSame([1200, 630], [imagesx($out), imagesy($out)]);
    foreach ([[0, 0], [1199, 0], [600, 315], [0, 629]] as [$x, $y]) {
      self::assertSame('blue', $this->hue($out, $x, $y), "($x, $y)");
    }
  }

  /**
   * Shown whole, enlarged at most 1.25×, a chosen image never.
   */
  #[DataProvider('providerFrame')]
  public function testFrame(int $w, int $h, bool $chosen, int $width): void {
    $image = imagecreatetruecolor($w, $h);
    imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
    // A red picture inside a plain white edge one pixel wide.
    imagefilledrectangle($image, 1, 1, $w - 2, $h - 2, imagecolorallocate($image, 220, 40, 40));
    imagepng($image, "$this->dir/image.png");
    $out = ShareImage::make("$this->dir/image.png", $chosen);
    self::assertSame([1200, 630], [imagesx($out), imagesy($out)]);
    // The red picture's width along the middle row.
    $red = 0;
    for ($x = 0; $x < 1200; $x++) {
      $red += $this->hue($out, $x, 315) === 'red' ? 1 : 0;
    }
    self::assertEqualsWithDelta($width, $red, 3);
  }

  /**
   * Data provider for testFrame(): size, chosen, width shown.
   */
  public static function providerFrame(): \Generator {
    yield 'a square at full height' => [1200, 1200, FALSE, 630];
    yield 'a small wide image at 1.25×' => [640, 320, FALSE, 800];
    yield 'a chosen 400 × 400 at 1×' => [400, 400, TRUE, 400];
  }

  /**
   * What is not made: a chosen 150 × 150, a huge image, a found GIF.
   */
  public function testNotMade(): void {
    imagepng(imagecreatetruecolor(150, 150), "$this->dir/small.png");
    self::assertNull(ShareImage::make("$this->dir/small.png", TRUE));
    imagegif(imagecreatetruecolor(800, 600), "$this->dir/found.gif");
    self::assertNull(ShareImage::make("$this->dir/found.gif", FALSE));
    file_put_contents("$this->dir/logo.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"/>');
    self::assertNull(ShareImage::make("$this->dir/logo.svg", FALSE));
    // A 9000 × 9000 PNG header: skipped before anything is decoded.
    $ihdr = 'IHDR' . pack('NNCCCCC', 9000, 9000, 8, 2, 0, 0, 0);
    $png = "\x89PNG\r\n\x1a\n" . pack('N', 13) . $ihdr . pack('N', crc32($ihdr)) . pack('N', 0) . 'IEND' . pack('N', crc32('IEND'));
    file_put_contents("$this->dir/huge.png", $png);
    self::assertSame([9000, 9000], array_slice(getimagesize("$this->dir/huge.png"), 0, 2));
    self::assertNull(ShareImage::make("$this->dir/huge.png", FALSE));
  }

  /**
   * A detailed 2400 × 1600 photo stays under 300 KB.
   */
  public function testWeight(): void {
    mt_srand(7);
    $image = imagecreatetruecolor(2400, 1600);
    for ($y = 0; $y < 1600; $y += 2) {
      for ($x = 0; $x < 2400; $x += 2) {
        imagefilledrectangle($image, $x, $y, $x + 1, $y + 1, mt_rand(0, 0xFFFFFF));
      }
    }
    imagejpeg($image, "$this->dir/noisy.jpg", 100);
    $bytes = ShareImage::jpeg(ShareImage::make("$this->dir/noisy.jpg", FALSE));
    self::assertLessThanOrEqual(ShareImage::MAX_BYTES, strlen($bytes));
    self::assertSame([1200, 630, IMAGETYPE_JPEG], array_slice(getimagesizefromstring($bytes), 0, 3));
    // No metadata is copied.
    self::assertStringNotContainsString('Exif', substr($bytes, 0, 64));
  }

  /**
   * A pixel's colour.
   */
  private function rgb(\GdImage $image, int $x, int $y): array {
    $c = imagecolorat($image, $x, $y);
    return [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
  }

  /**
   * Whether a pixel is red, blue or something else.
   */
  private function hue(\GdImage $image, int $x, int $y): string {
    [$r, $g, $b] = $this->rgb($image, $x, $y);
    return match (TRUE) {
      $r > 150 && $g < 100 && $b < 100 => 'red',
      $b > 150 && $r < 100 && $g < 120 => 'blue',
      default => 'other',
    };
  }

}
