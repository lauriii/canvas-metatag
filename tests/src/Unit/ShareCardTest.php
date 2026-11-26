<?php

declare(strict_types=1);

namespace Drupal\Tests\canvas_metatag\Unit;

use Drupal\canvas_metatag\ShareCard;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RequiresFunction;

// cspell:ignore wordmark colours multicolour Kahvila Oranssi
/**
 * The share card: colour, logo marks, the page and site cards.
 *
 * Share-images "Card colours stay the brand's and stay readable", "The logo
 * is shown as it is drawn", "A page without an image shares a card made
 * from its title", "Text the fonts can't draw makes no card", "Untrusted
 * inputs are bounded" and "The site card shows the identity"; design D6, D10.
 */
#[CoversClass(ShareCard::class)]
#[Group('canvas_metatag')]
#[RequiresFunction('imagettftext')]
final class ShareCardTest extends UnitTestCase {

  /**
   * A folder for the files a test writes.
   */
  private string $dir;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->dir = sys_get_temp_dir() . '/share-card-' . bin2hex(random_bytes(4));
    mkdir($this->dir);
  }

  /**
   * {@inheritdoc}
   */
  protected function tearDown(): void {
    $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->dir, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) {
      $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    }
    rmdir($this->dir);
    parent::tearDown();
  }

  /**
   * Each brand colour reaches 5.5:1 for the title and 4.5:1 for small text.
   *
   * Measured by the card against the darkest and lightest colours its field
   * can have, and again here against the field's pixels: every one of its
   * edges, and every third elsewhere.
   */
  #[DataProvider('providerColours')]
  public function testColourContrast(string $colour, string $text): void {
    $card = ShareCard::page([
      'title' => 'New summer opening hours',
      'label' => 'Event · June 19, 2027',
      'site_name' => 'Humanify',
      'colour' => $colour,
    ]);
    $info = $card['info'];
    self::assertSame($text, $info['text']);
    self::assertGreaterThanOrEqual(ShareCard::TITLE_CONTRAST, $info['contrast']['title']);
    self::assertGreaterThanOrEqual(ShareCard::SMALL_CONTRAST, $info['contrast']['small']);
    $theme = ShareCard::theme(ShareCard::rgb($colour));
    $field = ShareCard::field($theme);
    // The small line's solid colour: the text over the field's nearest one.
    $range = ShareCard::fieldRange($theme);
    $nearest = $range[$info['text'] === '#FFFFFF' ? 1 : 0];
    $small = ShareCard::mix($nearest, ShareCard::rgb($text), $info['contrast']['small_opacity']);
    [$title, $line] = [INF, INF];
    foreach ([...range(0, ShareCard::H - 1, 3), ShareCard::H - 1] as $y) {
      $edge = $y === 0 || $y === ShareCard::H - 1;
      foreach ($edge ? range(0, ShareCard::W - 1) : [...range(0, ShareCard::W - 1, 3), ShareCard::W - 1] as $x) {
        $c = imagecolorat($field, $x, $y);
        $bg = [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
        $title = min($title, ShareCard::contrast(ShareCard::rgb($text), $bg));
        $line = min($line, ShareCard::contrast($small, $bg));
      }
    }
    self::assertGreaterThanOrEqual(ShareCard::TITLE_CONTRAST, $title);
    self::assertGreaterThanOrEqual(ShareCard::SMALL_CONTRAST, $line);
  }

  /**
   * The small line reaches 4.5:1 on every pixel, the field's corners too.
   *
   * An orange logo with a white dot and no colour set: the picked colour's
   * gradient is darkest at the bottom right, where a small line measured on
   * sampled points once fell to 4.45:1. The line is solid, measured against
   * the darkest colour the field can have.
   */
  public function testSmallLineOnPickedOrange(): void {
    $logo = $this->image(200, 200, [255, 107, 0]);
    imagefilledellipse($logo, 100, 100, 60, 60, imagecolorallocate($logo, 255, 255, 255));
    $picked = ShareCard::pickColour($logo);
    self::assertNotNull($picked);
    $card = ShareCard::page([
      'title' => 'Midsummer Night Concert',
      'label' => 'Event · June 19, 2027',
      'site_name' => 'Humanify',
      'logo' => ['image' => $logo, 'colour' => $picked],
      'colour' => '',
    ]);
    $info = $card['info'];
    self::assertSame('#111318', $info['text']);
    $theme = ShareCard::theme($picked);
    [$darkest, $lightest] = ShareCard::fieldRange($theme);
    $small = ShareCard::mix($darkest, ShareCard::rgb($info['text']), $info['contrast']['small_opacity']);
    self::assertGreaterThanOrEqual(ShareCard::SMALL_CONTRAST, $info['contrast']['small']);
    // Every pixel of each corner, and the field's whole range.
    foreach ([[0, 0], [1160, 0], [0, 590], [1160, 590]] as [$left, $top]) {
      for ($y = $top; $y < $top + 40; $y++) {
        for ($x = $left; $x < $left + 40; $x++) {
          $c = imagecolorat($card['image'], $x, $y);
          $bg = [($c >> 16) & 255, ($c >> 8) & 255, $c & 255];
          self::assertGreaterThanOrEqual(ShareCard::SMALL_CONTRAST, ShareCard::contrast($small, $bg), "$x,$y");
          foreach ([0, 1, 2] as $i) {
            self::assertTrue($bg[$i] >= $darkest[$i] && $bg[$i] <= $lightest[$i], "$x,$y in the field's range");
          }
        }
      }
    }
    self::assertGreaterThanOrEqual(ShareCard::SMALL_CONTRAST, ShareCard::contrast($small, $darkest));
    self::assertGreaterThanOrEqual(ShareCard::SMALL_CONTRAST, ShareCard::contrast($small, $lightest));
  }

  /**
   * Data provider for testColourContrast(): colour, text colour.
   */
  public static function providerColours(): \Generator {
    yield 'navy' => ['#1A358D', '#FFFFFF'];
    yield 'orange' => ['#FF6B00', '#111318'];
    yield 'green' => ['#22C55E', '#111318'];
    yield 'sky' => ['#0EA5E9', '#111318'];
    yield 'pink' => ['#EC4899', '#111318'];
    yield 'red' => ['#DC2626', '#FFFFFF'];
    yield 'violet' => ['#7C3AED', '#FFFFFF'];
    yield 'teal' => ['#0F8A7E', '#FFFFFF'];
    yield 'yellow' => ['#F5C518', '#111318'];
    yield 'near-white' => ['#F7F5EE', '#111318'];
  }

  /**
   * The field keeps the brand's look: orange stays orange, navy stays navy.
   */
  public function testFieldKeepsTheBrand(): void {
    $orange = ShareCard::theme(ShareCard::rgb('#FF6B00'));
    self::assertFalse($orange['dark']);
    self::assertEqualsWithDelta(ShareCard::hsl(ShareCard::rgb('#FF6B00'))[0], ShareCard::hsl($orange['centre'])[0], 0.01);
    self::assertSame(['#EE7D2B', '#E26A12'], [ShareCard::hex($orange['top']), ShareCard::hex($orange['bottom'])]);
    $navy = ShareCard::theme(ShareCard::rgb('#1A358D'));
    self::assertTrue($navy['dark']);
    self::assertEqualsWithDelta(ShareCard::hsl(ShareCard::rgb('#1A358D'))[2], ShareCard::hsl($navy['centre'])[2], 0.02);
  }

  /**
   * No logo and no colour: the neutral field with white text.
   */
  public function testNeutral(): void {
    $info = ShareCard::page(['title' => 'Services', 'site_name' => 'Humanify'])['info'];
    self::assertSame([['#22252C', '#0E0F13'], '#FFFFFF', 'monogram'], [$info['field'], $info['text'], $info['mark']]);
  }

  /**
   * The colour picked from a raster logo; none from a gray one.
   */
  public function testPickColour(): void {
    $logo = $this->image(200, 200, [26, 53, 141]);
    imagefilledellipse($logo, 100, 100, 90, 90, imagecolorallocate($logo, 255, 255, 255));
    // The mean of the heaviest hue: the fill, with the dot's soft edge.
    self::assertEqualsWithDelta([26, 53, 141], ShareCard::pickColour($logo), 6);
    self::assertNull(ShareCard::pickColour($this->image(100, 100, [90, 90, 90])));
  }

  /**
   * The colour of an SVG logo is read from its source; it is never drawn.
   */
  public function testSvgLogo(): void {
    self::assertSame('#FF6B00', ShareCard::hex(ShareCard::svgColour('<svg><circle fill="#FF6B00"/><path fill="#ff6b00"/><path fill="#1A358D"/><rect fill="#fff"/></svg>')));
    self::assertSame('#0F8A7E', ShareCard::hex(ShareCard::svgColour('<svg><path style="stroke:#0F8A7E;fill:none"/><stop stop-color="#eee"/></svg>')));
    self::assertNull(ShareCard::svgColour('<svg><path fill="#000"/><path fill="#ffffff"/></svg>'));
    file_put_contents("$this->dir/logo.svg", '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle r="30" fill="#FF6B00"/></svg>');
    $logo = ShareCard::readLogo("$this->dir/logo.svg", [$this->dir]);
    self::assertNull($logo['image']);
    self::assertSame('#FF6B00', ShareCard::hex($logo['colour']));
    $info = ShareCard::page(['title' => 'Services', 'site_name' => 'Kahvila Oranssi', 'logo' => $logo])['info'];
    self::assertSame(['monogram', '#111318'], [$info['mark'], $info['text']]);
  }

  /**
   * A stored colour wins over the logo's.
   */
  public function testStoredColour(): void {
    $logo = ['image' => NULL, 'colour' => ShareCard::rgb('#FF6B00')];
    $input = ['title' => 'Services', 'site_name' => 'A', 'logo' => $logo];
    self::assertSame('#FFFFFF', ShareCard::page($input + ['colour' => '#1A358D'])['info']['text']);
    // Not a colour: the logo's.
    self::assertSame('#111318', ShareCard::page($input + ['colour' => 'blue'])['info']['text']);
  }

  /**
   * A wordmark on a large transparent canvas draws as the same mark trimmed.
   */
  public function testWordmarkIsTrimmed(): void {
    $theme = ShareCard::theme(NULL);
    $square = $this->transparent(1000, 1000);
    $tight = $this->transparent(600, 150);
    foreach ([[$square, 200, 425], [$tight, 0, 0]] as [$image, $x, $y]) {
      $ink = imagecolorallocate($image, 30, 42, 59);
      imagefilledellipse($image, $x + 75, $y + 75, 150, 150, $ink);
      imagefilledrectangle($image, $x + 170, $y + 30, $x + 599, $y + 120, $ink);
    }
    $marks = [ShareCard::mark($square, 50, $theme, 'Lakeside'), ShareCard::mark($tight, 50, $theme, 'Lakeside')];
    foreach ($marks as $mark) {
      self::assertTrue($mark['wordmark']);
      self::assertSame('tinted', $mark['kind']);
      self::assertSame(41, $mark['h']);
    }
    self::assertEqualsWithDelta($marks[1]['w'], $marks[0]['w'], 2);
    // Drawn in the text colour: the middle of the dot is white.
    $c = imagecolorat($marks[0]['image'], 20, 20);
    self::assertSame([255, 255, 255], [($c >> 16) & 255, ($c >> 8) & 255, $c & 255]);
    $logo = ['image' => $square, 'colour' => NULL];
    $card = ShareCard::page(['title' => 'Services', 'site_name' => 'Lakeside', 'logo' => $logo]);
    self::assertSame('tinted', $card['info']['mark']);
    // The wordmark alone: the Site name is left out beside it.
    self::assertNull($card['info']['brand']['name']);
    self::assertNotNull($card['info']['brand']['mark']);
  }

  /**
   * The brand row reads from the page's side: the logo first, right to left.
   */
  public function testBrandRowMirrors(): void {
    $logo = ['image' => $this->image(300, 300, [26, 53, 141]), 'colour' => NULL];
    $input = ['title' => 'Services', 'site_name' => 'Humanify Studio', 'logo' => $logo];
    $ltr = ShareCard::page($input)['info']['brand'];
    self::assertLessThan($ltr['name'], $ltr['mark']);
    $rtl = ShareCard::page($input + ['dir' => 'R'])['info']['brand'];
    self::assertGreaterThan($rtl['name'], $rtl['mark']);
  }

  /**
   * Each kind of logo makes its own mark.
   */
  public function testMarks(): void {
    $theme = ShareCard::theme(ShareCard::rgb('#1A358D'));
    // An opaque logo in the field's own colour: an app-icon tile with a
    // hairline edge, its corners open to the field, never on a white plate.
    $tile = ShareCard::mark($this->image(300, 300, [26, 53, 141]), 52, $theme, 'Humanify');
    self::assertSame('tile', $tile['kind']);
    $rgba = static function (\GdImage $image, int $x, int $y): array {
      $c = imagecolorat($image, $x, $y);
      return [($c >> 16) & 255, ($c >> 8) & 255, $c & 255, ($c >> 24) & 127];
    };
    self::assertSame([26, 53, 141, 0], $rgba($tile['image'], 26, 26));
    $edge = $rgba($tile['image'], 26, 0);
    $field = ShareCard::mix($theme['top'], $theme['bottom'], 0.5);
    self::assertGreaterThan(20, array_sum(array_map(static fn ($a, $b): int => abs($a - $b), [26, 53, 141], array_slice($edge, 0, 3))));
    self::assertGreaterThan(20, array_sum(array_map(static fn ($a, $b): float => abs($a - $b), $field, array_slice($edge, 0, 3))));
    self::assertNotSame([255, 255, 255], array_slice($edge, 0, 3));
    self::assertSame(127, $rgba($tile['image'], 0, 0)[3]);
    // Multicolour and dark on a dark field: on a white plate.
    $boat = $this->transparent(300, 200);
    imagefilledrectangle($boat, 20, 20, 140, 120, imagecolorallocate($boat, 31, 42, 74));
    imagefilledrectangle($boat, 160, 20, 280, 120, imagecolorallocate($boat, 120, 30, 40));
    imagefilledrectangle($boat, 20, 140, 280, 180, imagecolorallocate($boat, 20, 60, 50));
    $plate = ShareCard::mark($boat, 52, $theme, 'Harbour Market');
    self::assertSame(['plate', 52, FALSE], [$plate['kind'], $plate['h'], $plate['wordmark']]);
    $c = imagecolorat($plate['image'], 26, 2);
    self::assertSame([255, 255, 255], [($c >> 16) & 255, ($c >> 8) & 255, $c & 255]);
    self::assertSame('monogram', ShareCard::mark(NULL, 52, $theme, 'humanify')['kind']);
    // No tile without a glyph in it.
    self::assertNull(ShareCard::mark(NULL, 52, $theme, '湖畔'));
  }

  /**
   * The theme logo comes from public files or the theme's own folder only.
   */
  public function testThemeLogoPath(): void {
    mkdir("$this->dir/root/themes/custom/lake", 0777, TRUE);
    mkdir("$this->dir/root/sites/default/files", 0777, TRUE);
    mkdir("$this->dir/root/core/misc", 0777, TRUE);
    touch("$this->dir/root/themes/custom/lake/logo.png");
    touch("$this->dir/root/sites/default/files/logo.png");
    touch("$this->dir/root/core/misc/druplicon.png");
    [$root, $theme] = ["$this->dir/root", 'themes/custom/lake'];
    $public = realpath("$root/sites/default/files");
    self::assertSame(realpath("$root/$theme/logo.png"), ShareCard::themeLogo('/themes/custom/lake/logo.png', $root, $theme, $public));
    self::assertSame(realpath("$public/logo.png"), ShareCard::themeLogo('public://logo.png', $root, $theme, $public));
    // A path from the root into the public files, as the Appearance form
    // stores an uploaded logo.
    self::assertSame(realpath("$public/logo.png"), ShareCard::themeLogo('/sites/default/files/logo.png', $root, $theme, $public));
    self::assertNull(ShareCard::themeLogo('/core/misc/druplicon.png', $root, $theme, $public));
    self::assertNull(ShareCard::themeLogo('/themes/custom/lake/../../../core/misc/druplicon.png', $root, $theme, $public));
    self::assertNull(ShareCard::themeLogo('public://../../../core/misc/druplicon.png', $root, $theme, $public));
    self::assertNull(ShareCard::themeLogo('https://evil.example/logo.png', $root, $theme, $public));
    self::assertNull(ShareCard::themeLogo('//evil.example/logo.png', $root, $theme, $public));
  }

  /**
   * A logo out of bounds is not read.
   *
   * Outside the allowed folders, over 4096 px, or too large for the memory
   * left.
   */
  public function testLogoBounds(): void {
    mkdir("$this->dir/public");
    imagepng($this->image(5000, 20, [26, 53, 141]), "$this->dir/public/wide.png");
    imagepng($this->image(200, 200, [26, 53, 141]), "$this->dir/public/logo.png");
    imagepng($this->image(200, 200, [26, 53, 141]), "$this->dir/outside.png");
    self::assertSame(['image' => NULL, 'colour' => NULL], ShareCard::readLogo("$this->dir/public/wide.png", ["$this->dir/public"]));
    self::assertSame(['image' => NULL, 'colour' => NULL], ShareCard::readLogo("$this->dir/outside.png", ["$this->dir/public"]));
    self::assertSame(['image' => NULL, 'colour' => NULL], ShareCard::readLogo("$this->dir/public/../outside.png", ["$this->dir/public"]));
    self::assertInstanceOf(\GdImage::class, ShareCard::readLogo("$this->dir/public/logo.png", ["$this->dir/public"])['image']);
    // One that would not fit in the memory left is never decoded: the card
    // shows the monogram.
    self::assertInstanceOf(\GdImage::class, ShareCard::readLogo("$this->dir/public/logo.png", ["$this->dir/public"], NULL)['image']);
    $tight = ShareCard::readLogo("$this->dir/public/logo.png", ["$this->dir/public"], 16 * 1024 * 1024);
    self::assertSame(['image' => NULL, 'colour' => NULL], $tight);
    self::assertSame('monogram', ShareCard::page(['title' => 'Services', 'site_name' => 'Humanify', 'logo' => $tight])['info']['mark']);
  }

  /**
   * A page card is a 1200 × 630 PNG; two lines stay in the centre square.
   */
  public function testPageCard(): void {
    $card = ShareCard::page([
      'title' => 'Midsummer Night Concert',
      'label' => 'Event · June 19, 2027',
      'site_name' => 'Humanify Studio',
      'colour' => '#1A358D',
    ]);
    $png = ShareCard::png($card['image']);
    self::assertSame([1200, 630, IMAGETYPE_PNG], array_slice(getimagesizefromstring($png), 0, 3));
    self::assertSame(['Midsummer', 'Night Concert'], $card['info']['lines']);
    self::assertSame('EVENT · JUNE 19, 2027', $card['info']['label']);
    [$x0, $y0, $x1, $y1] = $card['info']['box'];
    // The centre 630 × 630 with 35 px to spare.
    self::assertGreaterThanOrEqual(285 + 35, $x0);
    self::assertLessThanOrEqual(915 - 35, $x1);
    // And no title pixel outside it: the field there is dark navy.
    $reddest = 0;
    for ($y = (int) $y0; $y < $y1; $y += 2) {
      foreach ([...range(0, 284, 3), ...range(916, 1199, 3)] as $x) {
        $reddest = max($reddest, (imagecolorat($card['image'], $x, $y) >> 16) & 255);
      }
    }
    self::assertLessThan(120, $reddest);
  }

  /**
   * A right-to-left page's small line reads from the right, numbers kept.
   *
   * Share-images "An Arabic page": laid out as a browser lays out the line
   * in the page's direction.
   */
  public function testRightToLeftLabel(): void {
    $card = static fn (string $label): ?string => ShareCard::page([
      'title' => 'خدماتنا',
      'label' => $label,
      'site_name' => 'Humanify Studio',
      'dir' => 'R',
    ])['info']['label_order'];
    // Read from the right: "Article", then the date, its day first.
    self::assertSame('2026 نوفمبر 25 · Article', $card('Article · 25 نوفمبر 2026'));
    self::assertSame('2026 نوفمبر 25 · مقالة', $card('مقالة · 25 نوفمبر 2026'));
    // A left-to-right page keeps the line as written.
    self::assertSame('Article · 25 نوفمبر 2026', ShareCard::page([
      'title' => 'Services',
      'label' => 'Article · 25 نوفمبر 2026',
      'site_name' => 'Humanify Studio',
    ])['info']['label_order']);
  }

  /**
   * A title the fonts can't draw gives no card.
   */
  public function testNoGlyphNoCard(): void {
    self::assertNull(ShareCard::page(['title' => '湖畔の夏至コンサート', 'site_name' => 'Humanify'])['image']);
    self::assertNull(ShareCard::page(['title' => '🚀🚀', 'site_name' => 'Humanify'])['image']);
    self::assertNull(ShareCard::page(['title' => '', 'site_name' => 'Humanify'])['image']);
  }

  /**
   * The site card: a Japanese name without a logo makes none.
   */
  public function testSiteCard(): void {
    self::assertNull(ShareCard::site(['site_name' => '湖畔スタジオ'])['image']);
    $logo = ['image' => $this->image(300, 300, [26, 53, 141]), 'colour' => NULL];
    self::assertInstanceOf(\GdImage::class, ShareCard::site(['site_name' => '湖畔スタジオ', 'logo' => $logo])['image']);
    $slogan = 'Human expertise for AI-made work';
    $card = ShareCard::site(['site_name' => 'Humanify Studio', 'logo' => $logo, 'line' => $slogan]);
    self::assertSame(['Human expertise for AI-made work'], $card['info']['line']);
    self::assertSame('tile', $card['info']['mark']);
    // Left out when equal to the description shared beside the card.
    $card = ShareCard::site(['site_name' => 'Humanify Studio', 'line' => $slogan, 'description' => $slogan]);
    self::assertNull($card['info']['line']);
    self::assertNull(ShareCard::site(['site_name' => 'Humanify Studio'])['info']['line']);
  }

  /**
   * Icons are made at their sizes; the touch icon is opaque.
   */
  public function testIcons(): void {
    $ring = $this->transparent(256, 256);
    imagefilledellipse($ring, 128, 128, 220, 220, imagecolorallocate($ring, 17, 143, 128));
    $logo = ['image' => $ring, 'colour' => ShareCard::rgb('#118F80')];
    foreach ([32, 192, 180] as $size) {
      $icon = ShareCard::icon(['site_name' => 'Tidewater', 'logo' => $logo], $size);
      self::assertSame([$size, $size], [imagesx($icon), imagesy($icon)]);
      $alpha = (imagecolorat($icon, 0, 0) >> 24) & 0x7F;
      self::assertSame($size === 180 ? 0 : 127, $alpha, "$size");
    }
    self::assertNull(ShareCard::icon(['site_name' => '湖畔'], 32));
    // A dark one-colour mark would sink into a dark tab strip: every size
    // is drawn as the touch icon is, tinted on the field.
    $dark = $this->transparent(256, 256);
    imagefilledellipse($dark, 128, 128, 220, 220, imagecolorallocate($dark, 35, 49, 68));
    $darkLogo = ['image' => $dark, 'colour' => ShareCard::rgb('#233144')];
    foreach ([32, 192] as $size) {
      $icon = ShareCard::icon(['site_name' => 'Tidewater', 'logo' => $darkLogo], $size);
      self::assertSame(0, (imagecolorat($icon, 0, 0) >> 24) & 0x7F, "$size");
      $centre = imagecolorat($icon, intdiv($size, 2), intdiv($size, 2));
      $mark = [($centre >> 16) & 255, ($centre >> 8) & 255, $centre & 255];
      self::assertGreaterThan(3.0, ShareCard::contrast($mark, [14, 15, 19]), "$size");
    }

    // A multicolour mark the field's colour was picked from goes on white
    // in the touch icon, as on the card's plate: its own colour would sink.
    $boat = $this->transparent(300, 200);
    imagefilledrectangle($boat, 20, 20, 140, 120, imagecolorallocate($boat, 17, 143, 128));
    imagefilledrectangle($boat, 160, 20, 280, 120, imagecolorallocate($boat, 240, 170, 40));
    imagefilledrectangle($boat, 20, 140, 280, 180, imagecolorallocate($boat, 31, 42, 74));
    $boatLogo = ['image' => $boat, 'colour' => ShareCard::pickColour($boat)];
    $touch = ShareCard::icon(['site_name' => 'Harbour', 'logo' => $boatLogo], 180);
    self::assertSame(0xFFFFFF, imagecolorat($touch, 2, 2) & 0xFFFFFF);
    // One colour is tinted on the field instead.
    $touch = ShareCard::icon(['site_name' => 'Tidewater', 'logo' => $logo], 180);
    self::assertNotSame(0xFFFFFF, imagecolorat($touch, 2, 2) & 0xFFFFFF);

    // A wordmark's favicon is the monogram: as a 32 px strip it can't be
    // read. Larger icons keep the wordmark.
    $wordmark = $this->transparent(800, 160);
    imagefilledrectangle($wordmark, 0, 20, 799, 140, imagecolorallocate($wordmark, 17, 143, 128));
    $wide = ['site_name' => 'Tidewater', 'logo' => ['image' => $wordmark, 'colour' => ShareCard::rgb('#118F80')]];
    $favicon = ShareCard::icon($wide, 32);
    self::assertSame(0, (imagecolorat($favicon, 16, 2) >> 24) & 0x7F, 'The monogram tile fills the top.');
    self::assertSame(127, (imagecolorat(ShareCard::icon($wide, 192), 96, 4) >> 24) & 0x7F, 'Above the wordmark stays clear.');
  }

  /**
   * A large logo is kept at 800 px on its longer side, alpha intact.
   */
  public function testLargeLogoIsKeptSmall(): void {
    mkdir("$this->dir/public");
    $big = $this->transparent(3000, 1500);
    imagefilledellipse($big, 1500, 750, 1400, 1400, imagecolorallocate($big, 17, 143, 128));
    imagepng($big, "$this->dir/public/big.png");
    $read = ShareCard::readLogo("$this->dir/public/big.png", ["$this->dir/public"]);
    self::assertSame([800, 400], [imagesx($read['image']), imagesy($read['image'])]);
    self::assertSame(127, (imagecolorat($read['image'], 0, 0) >> 24) & 0x7F);
    self::assertSame('#118F80', ShareCard::hex($read['colour']));
  }

  /**
   * An opaque image in one colour.
   */
  private function image(int $w, int $h, array $rgb): \GdImage {
    $image = imagecreatetruecolor($w, $h);
    imagefill($image, 0, 0, imagecolorallocate($image, ...$rgb));
    return $image;
  }

  /**
   * A transparent image.
   */
  private function transparent(int $w, int $h): \GdImage {
    $image = ShareCard::canvas($w, $h);
    imagealphablending($image, FALSE);
    return $image;
  }

}
