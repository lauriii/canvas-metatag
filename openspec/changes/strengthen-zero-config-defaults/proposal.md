# Proposal

## Why

The product owner asked for defaults that are "really strong", so that the
whole product looks good wherever its pages are referenced: a popular React
framework makes every route share well with one image file, and this module
should do the same with no code and no file. Today, on a fresh install, a
Canvas page shared in a chat app shows a bare link: there is no image unless
an editor chose one or an administrator uploaded a site-wide default, a
page's own photo is sent at whatever size and shape it was uploaded, a page
still called "Untitled page" shares under that name, a long title loses its
ending, and a Canvas page has no description unless someone typed one.

The promise of this change: **every page the module owns shares as a large,
correct 1200 by 630 image with a real title, its own words as the
description and the site's name beside it, without anyone setting
anything.** The page's own picture is used when it has a good one; otherwise
the module draws a card from the page's title, the site's name and logo, in
the site's colour.

## What Changes

- **A made card at the end of the image chain.** A page with no usable image
  shares a 1200 × 630 PNG drawn from its `og:title`, the Site name and the
  logo (or the name's first letter), in the site's colour picked from the
  logo. A small line names the kind of page (an event with its date, a
  recipe, a person's job title) and is left out for page-like types. Text
  stays readable (5.5:1 for titles, 4.5:1 for small text, measured over the
  whole field) and inside the centre square that compact previews keep.
- **A page's own image as a 1200 × 630 version.** A wide photo is cropped
  around its centre; a square, tall, panoramic or transparent image is shown
  whole on its own colours. Photos are turned upright first. Files stay under
  300 KB. `og:image:type`, `:width`, `:height` and `:alt` always describe
  what is sent.
- **Image chain:** chosen social image → the Image fact → on a Canvas page,
  its first component image → the site's choice for pages without an image
  (a card made from the title, the site's image, or none). Found images under
  600 × 315, SVG or GIF are skipped; a chosen image is never skipped from
  200 × 200 up.
- **One route serves every made image,** outside the files path, so no web
  server rule is needed: the address is a hash of what is drawn, built only
  from the entity and configuration, rendered on the first request, stored,
  and served with a one-year immutable cache. Cards carry
  `X-Robots-Tag: noindex`. Unpublished and access-denied entities get 404 and
  their files are deleted. The editor previews the draft's image in memory,
  never as a public file.
- **Text defaults:** a page still named with the editor's placeholder takes
  its first heading as its title; a cut title keeps its ending and loses
  words from its main part instead; descriptions are cut to whole sentences
  in the page's language; a node with only a long text field gets a
  description from it; a Canvas page without a description field value uses
  its own text after its first heading, unless another published page offers
  the same text.
- **Head rows:** `og:locale` and `og:locale:alternate`; `og:image:type`;
  `twitter:card` `summary_large_image` on every page with an image the module
  made or resized; on the owned front page, site icon links made from the
  logo while the theme uses core's default icon.
- **Structured data:** `primaryImageOfPage` is only the page's own image, as
  the original file at its upright size; never the site's image, never a
  made card.
- **Site settings → Sharing:** one section with a live sample (Home page · A
  page without an image), Logo, Colour ("Picked from your logo") and "When a
  page has no image" (Make one from the title · Use this image · No image).
  Nothing new to fill in anywhere else.
- **Checks:** a made card is an improve row only on Article, Event, Product
  and Recipe pages; "Name this page" is to fix once a placeholder-named page
  is published; administrators learn why images can't be made, when the image
  host is not reachable from outside, when the logo is an SVG, when titles in
  a language can't be drawn, and when every page shares the same picture;
  editors learn that links already shared keep their old preview.
- **Upgrade:** a site with a default image keeps it ("Use this image"); a
  site without one gets the card.

## Capabilities

### New Capabilities

- `share-images`: the made card, the 1200 × 630 version of a page's own
  image, the site icons, how they are addressed, stored, served, previewed
  and protected.

### Modified Capabilities

- `head-output`: "The title is its main part and its ending", "The social
  image follows a chain", "The card hint follows the image size", "The head
  has fixed rows in a fixed order", "A cut head text ends at a word"
  (MODIFIED); `og:locale`, image alt text, sharing inputs in the cache, the
  front page icon (ADDED).
- `dynamic-values`: "A page's and a node's own description and image"
  (MODIFIED); a placeholder-named page's Title fact, a Canvas page's own text
  and first component image (ADDED).
- `structured-data`: "The page node describes the page" (MODIFIED).
- `site-seo`: "Installed defaults" (MODIFIED); the sharing choices and the
  upgrade (ADDED).
- `seo-dialog`: "The link preview" (MODIFIED); the Sharing section (ADDED).
- `seo-checks`: "Social image rules" (MODIFIED); sharing rows for
  administrators, the placeholder name, old previews (ADDED).
- `headless-head`: the same share images in the content API (ADDED).

## Product decisions relied on

Recorded as item 12 of the product decisions for the implementation run:

- **12.1 Reopens** the README non-goal "image upload or image styles" for
  **made share images only**: a card drawn from the title and a resized
  version of a page's own image, served by the module. No upload interface,
  no image styles.
- **12.2 Reopens** the README non-goal `og:locale` (with alternates).
- **12.3** New installs share a card made from the title; upgraded sites
  with a default image keep it.
- **12.4** A placeholder-named page takes its first heading; it never borrows
  the home page's title or card.
- **12.5** A Canvas page may use its own text as its description, never text
  another published page offers.
- **12.6** The front page carries site icons made from the logo while the
  theme uses core's default icon; icons elsewhere and a theme colour stay out.
- **12.7** Bundled open-licence fonts.
- **12.8** A cut title keeps its ending (this reverses the rule that the cut
  removes the ending).
- **12.11–12.14** The card's look (no host line, the small line's rules,
  contrast 5.5:1 and 4.5:1 that keeps brand colours), SVG logos never
  rasterised, the module route with `noindex` cards and no lock or throttle,
  and one Site › Sharing section as the only new interface.

No other README non-goal is reopened. "Head output on routes it does not own"
stays closed: the icons are emitted on the owned front page only.

## Out of scope

- Icons on routes other than the owned front page, a theme colour tag, web
  app manifests.
- An upload interface, image styles, focal points, a per-type card label
  setting, a hyphenation dictionary.
- Fonts for scripts other than Latin, Greek, Cyrillic, Arabic and Hebrew:
  titles in other scripts get no card (the chain goes on).
- Rendering share images on save; images on routes the module does not own.
- Home page rules (a vaguely named front page titled by the site and sharing
  the site card): `add-home-page-defaults`. The identity description, as the
  front page's description and as the site card's line without a slogan:
  `describe-the-publisher`.
- The organization logo and slogan in structured data:
  `describe-the-publisher`.

## Depends on / followed by

Insert **right after `read-page-components`**, before
`set-up-types-from-templates`. Archive after the changes it builds on: its
MODIFIED blocks are written on their text.

- **`link-values-to-fields`**: title main part and ending, the social chain,
  the Description, Image and Title facts, the Site name fact, installed
  defaults.
- **`harden-template-scope`**: the 600 × 157 card rule and the social image
  checks this change modifies.
- **`rethink-structured-data`**: the kind registry the card's small line
  reads; the page node.
- **`populate-every-schema-type`**: the mapped Event start date and Person
  job title.
- **`read-page-components`**: a Canvas page's component image, text and first
  heading, read as an anonymous visitor.
- **`compose-values-from-fields`** (lands before this change, decisions.md
  item 17; amendment recorded there on 2026-11-17): a composed main part is
  cut whole fields first, then words, then "…", never leaving " in …" or
  " · …"; the Default box stays the at-rest look of an untouched field and
  composing starts from it; the small line's date uses its `Words` helper;
  its long-text budget and this change's derived descriptions share one
  sentence-cut helper; the card uses the social title as resolved, composed
  or not.
- **Followed by**, in this order among the changes that amend it:
  `add-advanced-meta-tags` (owned prefixes and the fixed rows, amended),
  `add-home-page-defaults` (home rules on top of this change, amended),
  `describe-the-publisher` (Organization logo and slogan, and the identity
  description as the site card's line, amended).

## Impact

- **Server:** new `ShareCard` and `ShareImage` renderers (GD with FreeType),
  `ShareController` (image route, preview route), a `CardInput` builder in
  `Resolver`, `Resolver` (chain, rows, alt, locale, icons, cacheability),
  `Sources` consumers (text, heading, image), `SchemaGraph` (page image),
  `Values` (identity sharing choices), config schema, a post-update,
  `hook_requirements`, entity hooks that delete stored images.
- **Data:** `data/locales.json` (language → territory), font coverage files.
- **Assets:** bundled fonts with their licences (about 1 MB after subsetting).
- **Extension:** link preview, Image field source line, Site → Sharing,
  Checks rows.
- **Canvas internals:** the placeholder label of a new page; gets an
  ARCHITECTURE.md row and a contract test.
- **Docs:** README (reopened non-goals, disk use, the share route),
  ARCHITECTURE.md.
