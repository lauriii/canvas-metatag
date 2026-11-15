# Design

## Context

See proposal.md for why. The visual bar lives in `reference/`:
`reference/reference.md` (the card rules, measured values and what each
reference card demonstrates), `reference/cards/` (the rendered cards, with
`overview.jpg` showing every case) and `reference/prototype/card.php.txt` (the
renderer that drew them). This design and the specs decide behaviour;
`reference/` decides looks.

Facts this design rests on, measured on the farm site (PHP 8.4, GD 2.3.3 with
FreeType, Drupal 11.4) with that prototype renderer over the farm site's own
pages and the complex fixture content:

- A fresh install's owned pages carry no `og:image`; only a chosen image or a
  site default image gives one, at its upload size and shape.
- GD with FreeType draws a 1200 × 630 card in 20–70 ms and a photo version in
  6–50 ms; cards are 15–75 KB PNG, photo versions 9–105 KB JPEG.
- This GD decodes UTF-8 only up to three bytes and decodes `&#N;` in any
  string; it cannot read SVG; `imagecreatefromstring()` ignores EXIF
  orientation; core has no auto-orient image effect, and core's GD toolkit
  saves every derivative at the site-wide JPEG quality without interlacing.
- Many web servers pass missing files under the files path to Drupal only
  for image style derivatives.
- Link previews cache images by URL; some messaging apps are reported to drop
  images over about 300 KB; several networks crop the large image to a centre
  square in compact layouts.

## Goals / Non-Goals

**Goals:** a good share on every owned page with nothing configured; the same
bytes on every host that has GD with FreeType; no cost at page delivery
beyond one hash; nothing public derived from a draft; one new Site section and
no new field anywhere else.

**Non-Goals:** an image editor or upload interface; image styles; icons
outside the owned front page; scripts without a bundled font; home page rules
(add-home-page-defaults).

## Decisions

### D1. The card is the end of the chain, not a value

The chain (head-output) ends with the site's choice for pages without an
image, stored as `identity.share_fallback` (`card`, `image`, `none`) beside
`identity.default_image` (a media UUID or empty). No scope stores "card" as a
value, so any image at any scope overrides it and the stored data shape of
pages and templates does not change.

*Alternative:* a "card" value at type and page scope (rejected: more to
explain, and the skip rules already handle logo-like images).

### D2. One route serves every made image

- Cards: `/canvas-metatag/share/{langcode}/{entity_type}/{id}/{hash}.png`.
- Photo versions: `/canvas-metatag/share/image/{fid}/{hash}.jpg`.
- Icons: `/canvas-metatag/share/icon/{size}/{hash}.png`.

Ordinary Drupal routes outside the files path, so no web server rule is
involved. Bytes are stored under `public://canvas-metatag/share/` at the same
relative path and returned as a `BinaryFileResponse` with
`Cache-Control: public, max-age=31536000, immutable`; cards add
`X-Robots-Tag: noindex` (search features ask for real photos, not text
images; link preview crawlers read images regardless). The public stream must
be a local stream; otherwise no card is made and photos fall back to the
original file (D9).

*Alternative:* serve from the files path like image derivatives (rejected:
depends on a web server rule many hosts lack, and every page's image would
404 silently). *Alternative:* a core image style (rejected: the toolkit may
not be GD, the JPEG quality is global, nothing applies EXIF orientation, and
an in-place file replacement keeps serving stale bytes).

### D3. The address is a hash of what is drawn, from the entity only

`Resolver` builds a `CardInput` array from the entity, its translation and
configuration read in the entity's language: layout, `og:title` exactly as
emitted, the small line, the Site name, the logo (media file id and changed
time, or the theme logo's path and modification time), the colour, the
direction, the langcode and the renderer version. `hash` is the first 16 hex
digits of sha256 over its JSON. A photo version's hash covers the file id,
its changed time, the chosen/found flag and the renderer version.

The route validates its parameters (`entity_type` in the owned types, `id`
digits, `hash` 16 hex, `langcode` installed) before loading anything, loads
the entity, checks that the module owns it and that an anonymous visitor may
view it (404 otherwise), sets the configuration override language to the
path's langcode and rebuilds `CardInput`. It renders only when the rebuilt
hash equals the requested hash. Otherwise it answers 302 with
`Cache-Control: public, max-age=300` and the entity's cache tags to the
entity's current share image address (a photo version when the page has
gained one), never a cacheable 301 (an A→B→A edit would loop in a shared
cache).

Nothing comes from the request: the card draws no host name.

### D4. Storage without locks or cron

Renders are deterministic and bounded by owned entities × languages, so two
concurrent renders write the same bytes. The file is written as
`{hash}.png.{random}.tmp` in its own directory and renamed. After a
successful write the other files in that entity's directory are deleted.
Entity delete, translation delete, unpublish and loss of anonymous access
delete the entity's directory. A render failure is logged under
`canvas_metatag`, remembered for five minutes in `cache.default`, and
answered 404 with `Cache-Control: no-cache`; a crawler never gets a 500 page.
No flood control: the crawlers this serves fetch from a few addresses, and a
valid request costs one bounded render.

### D5. The editor preview renders the draft in memory

`GET /canvas-metatag/api/share-preview?entity_type&id&langcode&v` renders the
image from the server-side draft the dialog already stores, with the state
route's permission and its entity checks (`view`, plus `update` for a draft),
`_auth: cookie`, `Cache-Control: no-store`, and never writes a file. `v` is
the draft's revision hash for the browser cache only. A draft head
(`resolve(draft: TRUE)`) uses this address, so no public address is ever
computed from draft values. The dialog debounces it by 400 ms.

### D6. The card

The full rules, with every size and the measured contrast of each reference
card, are in `reference/reference.md`; the cards in `reference/cards/` show
what a built card must look like (`c04-event-86.png` is the canonical page
card, `c01-front-site-card.png` the site card). In short, on a 1200 × 630
canvas:

- **Field:** the site colour (the stored colour, else picked from the logo,
  else neutral `#22252C`→`#0E0F13`): a diagonal gradient from L+0.03 to
  L−0.04 with a glow of at most 6%, painted small and resampled.
- **Text colour:** white darkens the colour, dark ink `#111318` lightens it,
  in 0.01 lightness steps until the text reaches 5.5:1 on the field's worst
  point; fewest steps wins, ink paying five extra steps. Small text keeps the
  lowest opacity of at least 0.70 that reaches 4.5:1 on every sampled pixel.
  Titles are large-scale text, for which 4.5:1 is the enhanced level; 5.5:1
  leaves margin for previews shown at a third of the size.
- **Picked colour:** the logo resampled to 48 × 48; opaque pixels with
  saturation ≥ 0.25 and lightness 0.10–0.92 binned into 24 hues weighted by
  saturation; the heaviest bin's mean when it holds ≥ 5% of opaque pixels.
  An SVG logo: the heaviest saturated `fill`, `stroke` or `stop-color` hex
  value in its source.
- **Brand row:** at y 60, centred, mirrored on a right-to-left page: the
  logo mark 52 px and the Site name, SemiBold 30 px (26 px, then cut at a
  word with "…" to 640 px). The logo is trimmed to what it draws first; a
  one-colour transparent logo is tinted to the text colour; a multicolour one
  under 3:1 against the field sits on a white plate; a logo wider than 2.2:1
  is a wordmark and stands alone; no logo: the name's first letter on a white
  tile (ink tile on a light field), or nothing when it can't be drawn.
- **Label:** SemiBold 26 px capitals with 0.10 em tracking (Hebrew 30 px,
  Arabic 32 px, as typed).
- **Title:** the display cut, SemiBold; steps `[px, measure, lines]`
  `[128,560,1]` (12 characters or fewer), `[104,560,2] [96,560,2] [88,560,2]`
  (inside the centre square with 35 px to spare), `[88,980,2]`, `[76,580,3]`,
  `[76,1000,3] [66,1008,3] [58,1008,4] [52,1008,4]`; balanced lines; a
  two-line title breaks at a phrase boundary when both lines fit; past the
  last step the fourth line ends in "…" after a whole word longer than three
  letters; from the 66 px step a word wider than the measure is split with a
  hyphen, four letters at least on each side. Label and title are centred
  between y 136 and 548.
- **Site card** (used by add-home-page-defaults for a vaguely named front
  page): the mark 128 px, the Site name (left out beside a wordmark), and a
  line: the slogan, else the identity description shortened at its first
  clause, left out when equal to the description shared beside it. This
  change draws the slogan only: the identity description does not exist
  until `describe-the-publisher`, which runs after `add-home-page-defaults`
  and adds that fallback to the line.

### D7. Text handling

Controls, zero-width characters and direction marks are removed; emoji
outside the basic plane are left out of the image only (`og:title` keeps
them) with any separator they leave dangling; basic-plane symbols are drawn
in the text colour. Every character must be covered by a bundled font
(coverage range files generated at build time); otherwise the title is not
drawn and the page gets no card. Arabic letters use their presentation forms
(lam-alef ligatures, the four common Persian letters; harakat dropped);
right-to-left words are reordered per line (paragraph direction from the
first strong letter, else the page language). `&` is passed to GD as `&#38;`.
Every text input is cut to 300 characters before it is fitted.

### D8. The small line

The kind (rethink-structured-data's registry) decides: the Article family →
"Article" plus the published date; Event → "Event" plus the start date;
Product, Recipe, Job posting → their names; Person → its mapped job title,
else nothing; every other kind, including the WebPage family → nothing. Kind
names are the registry's translatable labels. Dates have no time:
`IntlDateFormatter` with the long date style and no time style, in the page's
language and the site's default country, else the `j F Y` format through
Drupal's date formatter. No prices, salaries or durations.

### D9. A page's own image

Decoded with GD after `getimagesize()` (photos over 40 megapixels skipped);
EXIF orientation 2–8 applied first (the `exif` extension; without it a JPEG
is used as stored). Then:

- found image (Image fact, component image): skipped under 600 × 315, SVG,
  GIF;
- ratio 1.30–2.4 and at most 1.25× enlargement (chosen images: 1×): cropped
  to 1200 × 630 around the centre;
- otherwise shown whole: plain edges continue seamlessly; anything else sits
  inset with 16 px corners and a soft shadow on a wash of its own colours
  (a 3 × 2 sample, darkened 30%, interpolated, so nothing in the photo
  ghosts); enlargement at most 1.25× (chosen: 1×);
- transparent: flattened onto the colour of its opaque edge pixels, white
  when under a quarter of the edge is opaque, neutral dark when the subject
  is light; seamless;
- chosen image under 200 × 200: the original file with its real size;
- encoding: progressive JPEG q82, then q72, then q60 while over 300 KB;
  metadata is not copied (a camera's location goes too).

Without GD and FreeType, or with public files not on local disk, the chain
uses the original files with their stored sizes (today's behaviour) and no
card.

### D10. Inputs are bounded

The logo is the identity logo (media on public files), else the default
theme's logo when it is not core's and either a `public://` URI or a path
whose `realpath()` lies inside that theme's directory. A component image
counts only through its media or file entity on public files; the module
never fetches an address. A logo over 4096 px a side is skipped.

### D11. Titles and descriptions

- **Placeholder name:** Canvas gives a new page a fixed label
  ("Untitled page", translated). When a Canvas page's label equals it in the
  page's language, its Title fact is the page's first heading (a heading
  component, or the first heading prop of the first component in its own
  content), read through read-page-components as an anonymous visitor; with
  no heading it stays the placeholder. The label is a Canvas internal: an
  ARCHITECTURE.md row and a contract test.
- **Cut title:** words come off the end of the main part, which ends in "…",
  until main part, separator and ending fit in 255 characters; the ending is
  cut only when it alone is too long.
- **Sentences:** descriptions derived from text are cut to the whole
  sentences that fit in 160 characters (`IntlBreakIterator` sentence instance
  in the page's language); when the first sentence is longer, at a word within
  159 characters with "…".
- **Long text:** a node with no summary and no text field named for a
  description (complete-the-headless-frontend) takes its first formatted or
  long text field in form order.
- **A Canvas page's own text:** up to three candidates: text props of at
  least 50 characters, after the first heading, from instances the page
  places in its own content (not page regions, not a template), not starting
  with "©" or "Copyright", read as plain text. A key-value collection per
  language maps a candidate's hash to the published pages offering it,
  updated on save and delete. The first candidate no other published page
  offers wins. Its cache tag is invalidated only when a hash moves between
  one page and several, so ordinary saves do not flush other pages.

### D12. Alt text and locale

- `og:image:alt`: a page's own or chosen image → its alt text, else its media
  name when it has three or more words, does not look like a file name or a
  version ("final", "copy", "v2") and differs from the page title; a card →
  "{full og:title}, {Site name}"; the site's image → its own alt text, else
  the Site name.
- `og:locale`: the region in the langcode (`pt-br` → `pt_BR`), else the
  site's default country when `data/locales.json` lists it for the language,
  else the file's default territory; the file notes conventions that are not
  ISO; a language not in the file gets none. `og:locale:alternate`: the other
  published translations the hreflang links list.

### D13. Front page icons

While the default theme's `favicon.use_default` is true, the owned front page
carries `icon` 32 and 192 (transparent logos stay transparent, trimmed,
padded 6%) and `apple-touch-icon` 180 (opaque: the logo on the field colour,
a one-colour mark tinted), else the monogram; core's favicon link is removed
there. Addresses are stable per logo file and changed time. No other route
changes.

### D14. Fonts

Bundled under `fonts/` with one OFL 1.1 licence file per family, only the
faces in use: Inter 4.1 (display SemiBold for titles and the monogram;
SemiBold and Regular; Medium drew only the host line, which is gone), subset
to Latin, Greek and Cyrillic; Noto Sans Arabic SemiBold (the full build with
presentation forms); Noto Sans Hebrew SemiBold; Noto Emoji instanced at
weight 600 and subset to basic-plane symbols. The families declare no
reserved font name, so subsets keep their names. Where each file comes from,
its notice and the role and scale it is drawn at are listed in
`reference/reference.md` ("Fonts"). Drupal.org's licensing guidance allows
non-code assets whose licence permits distribution. A `fonts/build.sh` records the subsetting, and a unit
test regenerates the coverage files and compares them.

### D15. Cacheability

The head adds `config:system.theme`, the default theme's settings, the logo
media and file, and the bundle's configuration object as a cacheable
dependency (with its language contexts). The theme logo's path and mtime are
inside `CardInput`. No new cache contexts. Page delivery computes one hash
over values already resolved: no file access and no GD.

## Risks / Trade-offs

- [The card is the product's face] → restraint: one family, one colour,
  three text tiers; 36 cases rendered and reviewed
  (`reference/cards/overview.jpg`); the colour can be changed
  in one row; "Use this image" and "No image" are one click.
- [Search guidance discourages text images and generic images] → the card is
  last in the chain, never in structured data, `noindex`; Checks push a real
  photo where rich results want one.
- [Hosts without GD or FreeType, or remote public files] → status report;
  today's behaviour with original files.
- [FreeType versions move glyph advances] → tests assert layout invariants,
  exact lines only where breaks have margin; the dialog previews the server's
  own bytes.
- [A picked colour is wrong for a multicolour logo] → predictable rule, shown
  in Site in words, one-row override.
- [Disk use] → about 40 KB per fetched entity and language; stated in README.
- [Canvas's placeholder label changes] → contract test.
- [The card hint and previews already cached by networks] → new URLs on
  change; Checks tells editors that old shares keep their preview a while.

## Migration Plan

- Install config: `share_fallback: card`, `colour: ''`.
- A post-update sets `share_fallback` to `image` where `default_image` is set,
  else `card`, and invalidates rendered output. A site with a default image
  keeps sharing it, now as a 1200 × 630 version with its own alt text.
- Rollback: reverting the code leaves two unknown identity keys, which the
  previous `Values` cleaner drops on the next save; stored share files can be
  deleted with the directory.

## Open Questions

None. Product decisions 12.1–12.14 are recorded in proposal.md.
