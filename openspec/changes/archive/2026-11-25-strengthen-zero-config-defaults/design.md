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

- An entity's image: `/canvas-metatag/share/{langcode}/{entity_type}/{id}/{hash}.png`
  for its card, `{hash}.jpg` for the share version of its own photo.
- The site's image: `/canvas-metatag/share/site/{hash}.jpg`.
- Icons: `/canvas-metatag/share/icon/{size}/{hash}.png`.

A photo version lives under the entity that shares it, never under its file:
the route's ownership and anonymous access checks, the rebuilt share and the
entity's deletion then cover it too, and no address enumerates the site's
files. A file shared by several pages is stored once per page. The site's
image is the exception (review round 3): it is no entity's, so tying it to
an entity's visibility protects nothing, while a copy per page and language
would fill the disk with identical images, each decoded on its own. Like the
icons it has one site address, hashed from `photoInput()` of its file, and
is stored once; an entity's address of it redirects there.

Ordinary Drupal routes outside the files path, so no web server rule is
involved. Bytes are stored under `public://canvas-metatag/share-{secret}/`
(a name derived from the hash salt) at the same relative path and returned
as a `BinaryFileResponse` with
`Cache-Control: public, max-age=31536000, s-maxage=86400, immutable` (a
day at most in shared caches, as a served image carries no cache tags); cards add
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
hash equals the requested hash. Otherwise it answers an uncached 302 (the
routes' `no_cache` option; review round 1: core's page cache keeps a
redirect for good on a site whose page max-age is 0, as Expires is then
rewritten to the past) to the entity's current share image address (a photo
version when the page has gained one), never a cacheable 301 (an A→B→A edit
would loop in a shared cache). The `langcode` parameter takes core's own
rule for a language code (`en-x-simple`, `en-GB`); the controller refuses
one that is not installed.

Nothing comes from the request: the card draws no host name.

### D4. Storage without locks or cron

Renders are deterministic and bounded by owned entities × languages, so two
concurrent renders write the same bytes. The file is written as
`{hash}.png.{random}.tmp` in its own directory and renamed. After a
successful write the other files in that entity's directory are deleted.
Entity delete, translation delete, unpublish and loss of anonymous access
delete the entity's directory; a save of the anonymous role deletes every
stored image (they are made again on request). A render failure is logged under
`canvas_metatag`, remembered for five minutes in `cache.default`, and
answered 404 with `Cache-Control: no-cache`; a crawler never gets a 500
page. Before drawing the marker holds the draw's start time, and is cleared
on success or set to "failed": a request that finds a start under a minute
old draws too (the same bytes, so link previews fetching a new image from
several clients at once each get it), and one older than that is a draw
whose process ended (out of memory, out of time), remembered as failed.
Stored images carry no cache tags, so they are sent with
`s-maxage=86400` beside the year for browsers: a proxy or CDN keeps the
image of a page unpublished since for a day at most. An address that now
shares nothing answers 404 and deletes the entity's stored images; a change
to what icons are drawn from deletes the stored icons. The route matches names case-sensitively in the
controller (the router does not), and its 404 and 302 answers are not HTML.
An unpublished or deleted media item, or a deleted file, deletes every
stored share version of that file, under whichever pages shared it (which
pages did is not known); other files' versions stay. Access lost without a
save the hooks see (an access module, a grants rebuild, a template turned
off) deletes the entity's folder at its next 404. Moving "When a page has no
image" away from cards deletes every stored card, since nothing shares them.
Uninstalling deletes the share folder.
No flood control: the crawlers this serves fetch from a few addresses, and a
valid request costs one bounded render.

### D5. The editor preview renders the draft in memory

`GET /canvas-metatag/api/share-preview?entity_type&id&langcode&v` (for a
template `preview`, the node it is previewed with, in place of `langcode`,
as the state route takes it) renders the image from the server-side draft
the dialog already stores, with the state route's permission and its entity
checks (`view`, plus `update` for a draft),
`_auth: cookie`, and never writes a file. `v` is the hash of what is drawn
(the card's input, or the photo's), so the answer is
`Cache-Control: private, max-age=3600`: the editor's browser reuses the bytes
when the link preview remounts, and no shared cache keeps them. A draft head
(`resolve(draft: TRUE)`) uses this address, so no public address is ever
computed from draft values. After integration the dialog reads every page
with the draft flag (for its chrome's drafts): a page without a draft of
its own then shares what is live, at its public address, as Output shows. The dialog debounces it by 400 ms: it asks for
the address the server's answer to the draft's save names, and a save waits
400 ms after the last keystroke.

Site › Sharing draws its samples the same way, from what is being edited:
`GET /canvas-metatag/api/share-sample?sample&title&name&logo&colour&share_fallback&default_image`
(`home`: what the owned front page shares, its own image at the address its
head sends, else what a page without one shares; `page`: a page without an
image titled `title`, as "When a page has no image" says: the card, the site
image's share version, or none), with the state route's permission, the
identity members checked as a save checks them (an administrator's as edited;
anyone else gets the stored ones, so no other image is decoded for them),
`no-store`, never a file. A title the fonts can't draw shows what its head sends
instead (the site's image, else `none`); the colour is then measured on a
short title.
The samples never show an image the head does not send: the site card comes
to the home sample with add-home-page-defaults, through the front page's own
share. Its JSON answer carries the image (a data URL, or an address the site
already serves), what it `shows` (`card`, `photo`, `none`) and what cards are
drawn with: the colour, whether it was picked from the logo, the text
colour, the title's measured contrast (said in the colour's sheet) and
whether the logo is an SVG, and the home page's `og:description`.

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
  point; fewest steps wins, ink paying five extra steps. Small text is solid:
  the text colour at the lowest opacity of at least 0.70 over the field's
  colour nearest to it that reaches 4.5:1 against the darkest and lightest
  colours any pixel of the field can have (review round 3: a translucent line
  measured on points sampled every 10 px fell to 4.45:1 in a corner).
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
names are the registry's translatable labels. Dates have no time: they are
read by `compose-values-from-fields`' `Words` helper (`IntlDateFormatter`,
long date style, no time style, in the item's locale: its language with its
region, else the site's default country; without `intl`, `j F Y` through
Drupal's date formatter), so a card and a composed title agree on a date's
form in every language. No prices, salaries or durations.

### D9. A page's own image

Decoded with GD after `getimagesize()` (photos over 24 megapixels skipped,
and any whose full-size copies and file would not fit in the memory the
request has left, with 16 MB to spare: with PHP's bundled GD running out is
a fatal error no handler catches);
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
- encoding: progressive JPEG q82, then q72, q60 and q50 while over 300 KB
  (q50 keeps even pure noise under it: about 270 KB at 1200 × 630);
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
  ("Untitled page", translated into the editor's interface language). When
  a Canvas page's label equals it in the page's language, or as written,
  its Title fact is the page's first heading: in render order, the first
  text of a heading component, or a `title`, `heading` or `headline` prop of
  a component placed at the top of its own content (not in a slot, where
  cards keep their titles), read as an anonymous visitor; with no heading it
  stays the placeholder. The label is a Canvas internal: an ARCHITECTURE.md
  row and a contract test.
- **The reader:** read-page-components is not built yet. Until it is, a
  reader of this change's own, `PageContent` (a file of its own, so the two
  merge without conflict), walks a page's own `components` tree in render
  order and reads only typed values of code components (`js`, `sdc`):
  plain and formatted text, and images through their media or file entity.
  A linked or personalized value, a block, and anything placed inside them
  are left out; an instance that cannot be read is skipped and logged.
  Typed values need no access check, and images go through
  `Resolver::mediaImage()` as an anonymous visitor. On integration
  read-page-components' `Sources::tree()`/`instances()` replace its tree
  walk; its public `read()` stays what this change needs.
- **Integrated (2026-11-25):** `PageContent` is now a thin adapter over the
  module's one component reader. `Sources::tree()`/`instances()` say what
  renders (the page's own tree only), `Sources::props()` reads each value by
  the account rule, and `Resolver::uriImage()` turns an image into the image
  array. The two rules differed; per use:
  - *Personalization:* the default case, read-page-components' rule, for the
    heading, the text and the image alike. Link previews and crawlers are
    visitors in no segment, so the default case is exactly what a shared link
    and a search result show; skipping the whole switch (the stand-in's rule)
    would describe the page by words further down, or by nothing.
  - *Non-code components:* still give no values (a block's settings are its
    configuration, not the page's words), but are read through: what a
    personalization switch holds is read. A block holds nothing.
  - *Linked values:* read like typed ones, as an anonymous visitor may see
    them, so an unpublished media item gives no image.
  - *Alt text:* a component image's alt is its own alt text; the media name
    stand-in applies to images read as media (the Image field, a chosen
    image).
- **Storage, after integration:** stored images moved to
  `public://canvas-metatag/share-{secret}/` (a name derived from the hash
  salt) and the `.htaccess` that marked cards `noindex` was removed: nginx
  ignores it, and no address under the files path can now be worked out or is
  linked, so a card is only ever served by its route, with `noindex`.
- **Cut title:** a composed main part (`compose-values-from-fields`) first
  loses whole fields with the words that go with them, from its end, using
  that change's segments; then words come off the end of the main part,
  which ends in "…", until main part, separator and ending fit in 255
  characters; the ending is cut only when it alone is too long. A cut never
  leaves " in …" or " · …".
- **Sentences:** descriptions derived from text are cut to the whole
  sentences that fit in 160 characters (`IntlBreakIterator` sentence instance
  in the page's language); when the first sentence is longer, at a word within
  159 characters with "…". This is the one sentence-cut helper that
  `compose-values-from-fields` adds for a long-text part's budget; this
  change reuses it with its own limit rather than writing a second one.
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

### D11a. Built on the composer

`compose-values-from-fields` lands before this change (decisions.md item 17),
so this change builds on it from the start:

- **The Default box** stays the at-rest look of an untouched field. Composing
  starts from it (that change's D9: Arrow right, End, `{` or "Add words or
  fields · Start from ‹Title›"); nothing here adds another way.
- **The cut title** drops whole fields of a composed main part before words
  (D11, and head-output "A cut head text ends at a word").
- **The small line's date** comes from the `Words` helper (D8).
- **Sentence cuts** share one helper with the long-text budget (D11).
- **The card's title** is the social title as resolved, composed or not: the
  `og:title` exactly as emitted (D3). A composed social title is drawn as its
  joined text, never as its parts.

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
padded 6%, except a one-colour mark under 3:1 against a dark background,
drawn as the touch icon is so that it can't sink into a dark tab strip) and
`apple-touch-icon` 180 (opaque: the logo on the field colour, a one-colour
mark tinted), else the monogram; core's favicon link is removed
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
over values already resolved and never draws or decodes an image. The only
files it reads are the EXIF headers of the JPEG images it considers (the
chain's, the logo, the site's image; the media picker reads them too), so
that a size is the upright one everywhere (the share treatment,
`og:image:width` of an original, `primaryImageOfPage`), as D9 turns it
upright.

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
