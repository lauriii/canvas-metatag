<!-- cspell:ignore Ruisleipä Leinikki Kesäkahvila Kahvila Oranssi Humanify Donaudampfschifffahrtsgesellschaftskapitänsmützensammlung Donaudampfschifffahrtsgesellsc haftskapitänsmützensammlung gesellsc haft harakat cmap wght rasterise rasterising subsetting wordmark keycap alef bilinearly imagepng Noto مرحبا שלום -->

# Share card reference

This folder holds the visual bar for `strengthen-zero-config-defaults`: what a
made share image must look like, the measurable rules behind it, the rendered
cards that show it, and the prototype renderer that drew them.

- **Behaviour** (chain, routes, hashes, storage, checks, dialog) is defined by
  `../design.md` and `../specs/`. Where this file and those differ, they win.
- **Looks** (layout, type, colour, edge cases) are defined by this file and
  the images in `cards/`. A built card passes when, given the same inputs, it
  looks like its reference card: same layout, same line breaks where the breaks
  have margin, same colours, same marks. Sub-pixel glyph differences between
  FreeType builds are expected.

All cards were rendered by `prototype/card.php.txt` on the farm site (PHP 8.4,
GD 2.3.3 with FreeType) from the farm site's own pages and the complex fixture
content. The site is called "Humanify Studio" there.

## The promise

Every page the module owns shares as a large 1200 × 630 image with a real
title, its own words as the description and the site's name beside it, with
nothing configured: the page's own picture when it has a good one, otherwise a
card drawn in the site's colour from its title and logo.

The product owner, 2026-11-14: *"make sure the defaults are really strong,
for example [a popular React framework] comes with strong defaults which makes
the whole product look good because whenever it's being reference in social
media etc everything just look good"*. Standing direction: the experience
"needs to be clean even though we're making this more powerful".

## Why it looks like this

- **Restraint.** One type family, one colour, three text tiers (brand row,
  small line, title). The card is the product's face on every share; it must
  not look like a template.
- **The site's colour, not ours.** The field is the brand colour moved only as
  far as contrast needs. Orange stays orange (with dark text), navy stays navy.
- **Square-safe first.** Several networks crop the large image to its centre
  square in compact layouts. The first title steps keep the whole title inside
  the centre 630 × 630 with 35 px to spare (`cards/c04-event-86-square-630.png`).
- **Measured, not assumed.** Every render measures the worst contrast over the
  whole field (the prototype samples every 10 px; the module measures against
  the darkest and lightest colours any pixel can have, corners included).
- **Never a broken glyph.** Text the bundled fonts cannot draw makes no card at
  all (the chain goes on) rather than boxes. Emoji outside the basic plane
  leave the image only.
- **Photos shown whole when cropping would hurt.** Square, tall and very wide
  images are framed on their own colours instead of being cut.
- **Cards are last.** Any real image at any scope wins; cards never go into
  structured data and carry `X-Robots-Tag: noindex`.

## Measurable rules

All sizes are px on a 1200 × 630 canvas (GD takes points: px × 0.75). Cap
height is taken as 0.727 of the font size.

### Field and text colour

| Rule | Value |
|---|---|
| Brand colour | stored identity colour, else picked from the logo: resampled to 48 × 48; opaque pixels with saturation ≥ 0.25 and lightness 0.10–0.92 binned into 24 hues weighted by saturation; the heaviest bin's mean if it holds ≥ 5% of opaque pixels. SVG logo: the heaviest saturated `fill`/`stroke`/`stop-color` hex in its source. Else none. |
| Field | diagonal gradient, top-left L+0.03 to bottom-right L−0.04 (saturation capped at 0.85), weights 0.35·x + 0.65·y, plus a light glow of at most 6% above the centre; painted at 150 × 79 and resampled, so no banding |
| No brand colour | neutral `#22252C` → `#0E0F13`, white text |
| Title colour | white (`#FFFFFF`) darkens the colour, ink (`#111318`) lightens it, in 0.01 lightness steps, until the title reaches **5.5:1** on the field's worst point; fewest steps wins, ink pays 5 extra steps; neither reachable → neutral |
| Small text | the title colour at the lowest opacity ≥ 0.70 that reaches **4.5:1** on every sampled pixel |
| Site card line | opacity max(small text opacity, 0.82) |
| Measured range (reference set) | title 5.58–13.99:1, small text 4.52–7.66:1 |

Reference values: navy logo `#1A358D` → field `#1D3A9A→#172F7C`, white,
9.11 / 5.36 (`c04`); yellow → `#EEC42E→#E6B813`, ink, 9.94 / 5.10 (`c21`);
SVG orange `#FF6B00` → `#EE7D2B→#E26A12`, ink, 5.61 / 4.63 (`c27`); teal
multicolour mark → `#22BBAA→#1D9D8F`, ink, 5.61 / 4.58 (`c35`); neutral,
13.99 / 7.66 (`c17`). Rendered but not committed: green 5.70 / 4.52, sky
5.59 / 4.58, pink 5.58 / 4.63 (ink); red 5.85 / 4.65, violet 5.91 / 4.62,
teal 6.24 / 4.64 (white); all visible in `cards/overview.jpg`.

### Page card

| Element | Rule |
|---|---|
| Brand row | top at y 60, centred: mark 52 px, 16 px gap, Site name Inter SemiBold 30 px (26 px if wider than 640 px, then cut at a word with "…" to 640 px; never dropped); mirrored on a right-to-left page (name left of the mark) |
| Small line (label) | Inter SemiBold 26 px, capitals, tracking 0.10 em; Hebrew 30 px and Arabic 32 px, as typed, no tracking; cut with "…" past 900 px; absent for page-like types |
| Title | Inter Display SemiBold, steps `[px, measure, max lines]` tried in order: `[128,560,1]` (12 characters or fewer), `[104,560,2] [96,560,2] [88,560,2]` (square-safe), `[88,980,2]`, `[76,580,3]` (square-safe), `[76,1000,3] [66,1008,3] [58,1008,4] [52,1008,4]` |
| Leading | 1.06 at ≥ 84 px, 1.10 at ≥ 66 px, 1.14 below |
| Gap | label to title: 0.36 × title px + 12 |
| Placement | label + title block centred between y 136 and y 548; nothing below (no host line) |
| Lines | balanced (the narrowest measure that keeps the greedy line count); a two-line title breaks at a phrase boundary instead (before "(" or a lone dash, after ":" ";" ",") when both lines fit and the shorter is over 0.4 of the longer |
| Truncation | only past the last step: the fourth line ends in "…" after the last whole word that fits, never after a word of 3 letters or fewer; trailing `, ; : . -` dropped |
| Long words | from the 66 px step down, a word wider than the measure is split with a hyphen, at least 4 letters each side; no "…" unless text was dropped |

### Site card

Used by `add-home-page-defaults` for a vaguely named front page.

| Element | Rule |
|---|---|
| Mark | 128 px (a wordmark: 112 px box, 0.82 of it tall) |
| Site name | 40 px below the mark, Inter Display SemiBold `[88,600,1] [76,600,1] [76,600,2] [64,1000,2] [56,1000,2]`, leading 1.10; left out beside a wordmark |
| Line | 46 px below, Inter Regular `[34,600,2] [31,600,2] [28,640,2]`, leading 1.40; left out when equal to the description shared beside it |
| Placement | the whole block centred vertically on the canvas |
| No card | when neither a mark nor the Site name can be drawn |

### Logo marks

| Logo | Treatment |
|---|---|
| Any | trimmed to what it draws first (alpha ≤ 120, or unlike the corner colour on a light opaque canvas); ratio and colour from the trimmed box |
| Opaque, not wide | app-icon tile: 22% corners, 1.5 px inner ring at 26% (white on a dark field, black on a light one) |
| Transparent, one colour | tinted to the text colour, no plate (`c22`) |
| Transparent, multicolour, under 3:1 against the field | kept in colour on a white plate inside the 52 px box, 16% padding (`c35`) |
| Wider than 2.2:1 | a wordmark: drawn alone in a 50 px box at 0.82 of its height, centred on the 52 px row, the Site name not repeated; a plated wordmark gets a pill padded 0.30 × its height (`c22`) |
| SVG | no rasterising; the monogram, in the colour read from the SVG source (`c27`) |
| None | monogram: the Site name's first grapheme in the title face at half the tile, on a white tile (dark field) or an ink tile (light field) (`c17`, `c21`); nothing when that letter cannot be drawn |

### Text handling

- Controls, zero-width characters and direction marks removed; whitespace
  collapsed; every input cut to 300 characters before fitting.
- Emoji outside the basic plane (and any grapheme with a joiner or keycap) are
  left out of the image only, with a separator they leave dangling;
  basic-plane symbols (✨ ☀ ★ ✓) are drawn in the text colour from the symbol
  font at weight 600 (`c15`).
- Every character must be covered by a bundled font; otherwise no card.
- Arabic: presentation forms (isolated, initial, medial, final, lam-alef, the
  four common Persian letters), harakat dropped. Right-to-left words reordered
  per line; paragraph direction from the first strong letter, else the page
  language (`c12`, `c14`).
- A lone dash breaks before itself, so a right-to-left run stays on one line
  (`c14`).
- `&` is passed to GD as `&#38;` because GD decodes `&#N;` in any string
  (`c25` shows "&#169;" drawn as typed).

### A page's own image

| Source | Treatment |
|---|---|
| Ratio 1.30–2.4, enlargement ≤ 1.25× (chosen: 1×) | cover: cropped to 1200 × 630 around the centre (`p01`) |
| Other shapes, plain edges | shown whole, full height, on its own edge colour, seamless (`p11`) |
| Other shapes | shown whole, inset 40 px top and bottom (sides ≥ 64 px), 16 px corners, soft shadow (36 px blur, 10 px drop, 45%), on a wash of its own colours: a 3 × 2 sample darkened 30% and interpolated bilinearly, so nothing in the photo ghosts (`p09`, `p16`) |
| Transparent | flattened onto the colour of its opaque edge pixels (alpha ≤ 8 ignored); white when under 25% of the edge is opaque; neutral dark when the subject is light; seamless (`p15`) |
| EXIF orientation 2–8 | applied before anything else (`p16`) |
| Chosen, ≥ 200 × 200 but small | framed at 1×, never enlarged (`p18`) |
| Found, under 600 × 315, SVG or GIF | skipped |
| Encoding | progressive JPEG q82, then q72, q60 and q50 while over 300 KB (q50 keeps even pure noise under it); no metadata copied |

### Icons (owned front page only)

32 and 192 px keep a transparent logo transparent, trimmed, padded 6%; the
180 px touch icon is opaque (logo on the field colour, a one-colour mark
tinted to the text colour, 14% padding); an opaque logo fills the square; no logo: the
card's monogram. See `cards/icons-on-light-and-dark.png`.

### Budgets (reference set)

Cards 15–75 KB PNG, 20–68 ms; photo versions 9–105 KB JPEG, 6–49 ms, all at
q82; icons 0.3–4 KB.

## The reference cards

`cards/overview.jpg` is the whole rendered set at a glance (36 card cases,
18 photo cases). The files below are the representative set; each is
1200 × 630 unless noted. Values are what the prototype measured.

| File | Demonstrates | Key values |
|---|---|---|
| `c01-front-site-card.png` | Site card: tile mark, Site name, line shortened at its first clause | name 76 px; line "Human expertise that amplifies / what your AI agents can do". In this change the line is the slogan only (see below) |
| `c02-canvas-blog.png` | One-word title at the 128 px step; no label on a page-like type | 128 px, "Blog" |
| `c04-event-86.png` | The canonical page card: kind and date label, square-safe two lines | 88 px; "EVENT · JUNE 19, 2027"; "Midsummer / Night Concert"; 9.11 / 5.36 |
| `c04-event-86-square-630.png` (630 × 630) | The centre-square crop keeps the whole title | — |
| `c05-event-88-247-chars.png` | 247-character title: four lines at 52 px, "…" after a whole word | last line "musicians themselves, followed…" |
| `c05-event-88-247-chars-thumb-400x210.png` (400 × 210) | Legibility at feed size | — |
| `c07-recipe-94.png` | Phrase break before "(" | 88 px wide step; "Ruisleipä / (Finnish rye bread)" |
| `c11-title-120-chars.png` | Four balanced lines at 58 px, nothing cut | no "…" |
| `c12-rtl-arabic.png` | Arabic: joined forms, label 32 px, mirrored brand row | 88 px |
| `c14-article-99-mixed.png` | Latin, Arabic and Hebrew on one line; direction marks and emoji removed; lone dash breaks before itself | "Hello مرحبا שלום / — Leinikki" |
| `c15-emoji-launch.png` | Astral emoji dropped, basic-plane sparkle drawn at the title's weight | "things for editors ✨" |
| `c17-no-logo-announcement.png` | Fresh site: no logo, no colour → neutral field, white monogram tile | 13.99 / 7.66 |
| `c19-untitled-page.png` | A page still named "Untitled page" with no heading gets its own page card, never the home card | 104 px |
| `c21-light-brand.png` | Light brand colour keeps its look with ink text; ink monogram tile | 9.94 / 5.10 |
| `c22-wordmark-logo.png` | Dark one-colour wordmark: trimmed, tinted white, no plate, name not repeated | field `#233144→#17202D`, 11.87 / 6.73 |
| `c25-ampersand.png` | `&` and a literal `&#169;` drawn as typed | "Q&A night: Tom &#169; / Jerry & friends" |
| `c26-unbreakable-word.png` | Hyphen split at 66 px, four letters each side, no false "…" | accepted nit: "gesellsc-haft" (no hyphenation dictionary) |
| `c27-svg-logo-orange.png` | SVG logo: colour from its source, monogram mark, ink text on orange | 5.61 / 4.63, small text opacity 0.84 |
| `c33-long-site-name.png` | 61-character Site name cut at a word to 640 px at 26 px | "The Northern Lakes Regional Chamber Music…" |
| `c35-multicolour-mark.png` | Multicolour transparent mark (a sailboat: teal and amber sails on a navy hull) on a white plate inside the 52 px box; one-line title at the 88 px wide step. The mark was redrawn on the committed image after the run; the field and values are the run's | 5.61 / 4.58 |
| `p01-front-cover.jpg` | Cover crop of a wide photo (1770 × 996) | 105 KB |
| `p09-real-square.jpg` | Square photo shown whole on its colour wash, rounded, shadowed | 46 KB |
| `p11-product-on-white.jpg` | Plain-edged product shot continued seamlessly | 9 KB |
| `p15-cutout-stored-black.jpg` | Transparent cut-out whose transparent pixels are stored black sits on white | 10 KB |
| `p16-phone-orientation-6.jpg` | Phone portrait stored sideways (EXIF 6) comes out upright, framed | 58 KB |
| `p18-chosen-400-square.jpg` | A chosen 400 × 400 image framed at 1×, not enlarged | 14 KB |
| `icons-on-light-and-dark.png` (1900 × 440) | Front page icons 180 / 192 / 32 for a logo, no logo and a transparent mark, on light and dark | — |
| `overview.jpg` (1540 × 3115) | Every case of the reference run | — |

Cases with no image (correct outcomes): a Japanese title (no bundled font
covers it, so no card and the chain goes on); a Japanese Site name with no
logo (no site card); a 400 × 400 company logo found on a job posting (skipped,
so the job posting gets a card).

## Where the prototype differs from the change

The prototype is a single-file sketch. Port its drawing, not its plumbing:

- **Site card line.** `c01` draws the identity description. In this change
  the site card line is the slogan only (design.md D6); the identity
  description arrives with `describe-the-publisher`.
- **Font coverage.** The prototype parses each font's `cmap` at runtime. The
  module generates coverage range files at build time and parses nothing at
  runtime (design.md D7, task 1.2).
- **SVG colour and labels.** The SVG colour rule and the label text (kind name
  and date) were computed by the case script, not by `card()`, which takes
  them as inputs. design.md D6 and D8 define them.
- **Fonts loaded.** The prototype still loads Inter Medium, which nothing
  draws since the host line was removed; it need not ship.
- **Focal point.** `share_photo()` takes a focal point; this change crops
  around the centre only.
- **Serving.** Hashing, routes, storage and the preview (design.md D2–D5) are
  not in the prototype.

To run it: copy `card.php.txt` to `card.php` next to a `fonts/` folder holding
the files named in its `Fonts` class, then

```php
require 'card.php';
$f = new Fonts(__DIR__ . '/fonts');
$logo = load_image('logo.png');
$r = card([
  'layout' => 'page', 'title' => 'Midsummer Night Concert',
  'label' => 'Event · June 19, 2027', 'site_name' => 'Humanify Studio',
  'logo' => $logo, 'brand' => brand_from_logo($logo), 'dir' => 'L',
], $f);
imagepng($r['im'], 'card.png');
// $r['info'] has the lines, size, colours and measured contrast.
```

`share_photo($gd, $orientation, $chosen)` and `icon($logo, theme($brand),
$siteName, $f, $size)` work the same way.

## Fonts

None are committed here; task 1.1 adds them under `fonts/`. All are SIL Open
Font License 1.1 with no reserved font name, so subsets keep their names.

| File the prototype loads | Role | Source |
|---|---|---|
| `InterDisplay-SemiBold.ttf` | titles, Site name on the site card, monogram | Inter 4.1, the Inter project's release archive (static display TTF). Notice: "Copyright (c) 2016 The Inter Project Authors" |
| `Inter-SemiBold.ttf` | brand row name, label | Inter 4.1 (static text TTF) |
| `Inter-Regular.ttf` | site card line | Inter 4.1 (static text TTF) |
| `NotoSansArabic-SemiBold.ttf` | Arabic, scaled 0.94 | Noto Sans Arabic, the "full" build that includes the presentation forms, from the Noto project's releases |
| `NotoSansHebrew-SemiBold.ttf` | Hebrew, scaled 0.98 | Noto Sans Hebrew from the Noto project's releases. Notice: "Copyright 2022 The Noto Project Authors" |
| `NotoEmoji-SemiBold-BMP.ttf` | basic-plane symbols, scaled 0.86 | Noto Emoji (variable, monochrome) instanced at wght 600 and subset to basic-plane symbols at build time: about 64 KB instead of 2 MB |

Subset the Inter files to Latin, Greek and Cyrillic (about half the size).
Each family ships with its own OFL file carrying its own copyright notice.
Those files are kept verbatim, notices included (the licence requires the
notice to stay with the font): they are the one recorded exception to the
rule that nothing in the module names a company, and a publishing-hygiene
sweep must leave `fonts/*-OFL.txt` alone.

## Left out of this folder

The other rendered cases (all visible in `overview.jpg`), the individual icon
files, the per-case measurement manifest, the case script and its source
images, the dialog mockup, the earlier rejected directions and the critiques
already folded into design.md.
