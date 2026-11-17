# Tasks

Needs `link-values-to-fields`, `harden-template-scope`,
`rethink-structured-data`, `populate-every-schema-type` and
`read-page-components` built. Test paths: unit tests in `tests/src/Unit/`,
kernel tests in `tests/src/Kernel/`, functional tests in
`tests/src/Functional/` (new), vitest next to the source in `extension/src/`,
Playwright in `tests/e2e/`. Tests that draw are marked
`@requires function imagettftext`. Layout tests assert invariants (every line
inside its measure, line count, nothing outside the safe area, no "…" when
nothing was dropped) and exact line texts only where the breaks have margin,
because font engines move glyph advances by fractions of a pixel. Each group
leaves the module working; nothing visible changes before group 4.

The visual bar is `reference/`: `reference/reference.md` gives the card rules and what each reference card demonstrates, `reference/cards/` the rendered cards, and `reference/prototype/card.php.txt` the prototype renderer to port (its differences from this change are listed in reference.md).

## 1. Fonts and text (no visible change)

- [ ] 1.1 Add `fonts/` with the faces of design.md D14 (sources and notices in `reference/reference.md`, "Fonts"), one OFL licence file per family carrying that family's own notice, and `fonts/build.sh` (subset the Latin family to Latin, Greek and Cyrillic; instance the symbol font at weight 600 and subset it to basic-plane symbols). Verify with a unit `FontsTest`: each font file loads in GD, each family has its licence file, and the total size stays under 1.5 MB.
- [ ] 1.2 Generate a coverage range file per font at build time and `ShareText::covers()`; no TrueType parsing at runtime. Verify with `FontsTest::testCoverageIsCurrent` (regenerates and compares) and `ShareTextTest` (U+FEDF covered by the Arabic face; a Japanese character covered by none).
- [ ] 1.3 `ShareText::clean()`: controls, zero-width characters and direction marks removed, emoji outside the basic plane removed with dangling separators, basic-plane symbols kept, input cut to 300 characters, `&` escaped for GD. Verify with `ShareTextTest` (the "Launch week" and "Hello مرحبا שלום" titles; a probe that "&#169;" draws six glyphs).
- [ ] 1.4 Arabic presentation forms and per-line right-to-left ordering. Verify with `ShareTextTest` (fixed words to their isolated, initial, medial, final and lam-alef forms; mixed Latin, Arabic, Hebrew, digits and brackets to their visual word order).
- [ ] 1.5 Fitting: the title steps of design.md D6, balanced lines, phrase breaks, "…" rules, hyphen split with four letters on each side, the brand row name cut. Verify with `ShareLayoutTest` using the farm site's titles (the 247-character event ends "followed…" on four lines; "Ruisleipä (Finnish rye bread)" breaks before "("; "Blog" at the largest step; no "…" on a complete title; invariants for every case).

## 2. Renderers (no visible change)

- [ ] 2.1 `ShareCard` colour: picked from a raster logo, from an SVG source, the field and text colour rule, measured contrast. Verify with `ShareCardTest` (navy, orange, green, sky, pink, red, violet, teal, yellow and a near-white colour each reach 5.5:1 for the title and 4.5:1 for small text over every sampled pixel; orange keeps an orange field with dark text; no logo gives the neutral field).
- [ ] 2.2 `ShareCard` logo marks: trim, tint for one-colour transparent logos, plate for multicolour logos under 3:1, wordmark over 2.2:1, monogram, none when the letter can't be drawn; the theme logo and its path rule; size guard. Verify with `ShareCardTest` (a wordmark on a square transparent canvas draws the same mark as trimmed; a theme logo path outside the theme is refused; a 5000 px logo is skipped).
- [ ] 2.3 `ShareCard::page()` and `::site()` with the small line, returning no image when the title or, for the site card, both mark and name can't be drawn. Verify with `ShareCardTest` (a 1200 × 630 PNG; the title box of a two-line title inside the centre 630 × 630; a Japanese title gives none; a Japanese site name without a logo gives no site card; the site card line left out when equal to the description).
- [ ] 2.4 The small line from the kind registry with dates from `compose-values-from-fields`' `Words` helper (long date, no time, the item's locale, its fallback format), never a second date formatter. Verify with `ShareLabelTest` (Event "EVENT · JUNE 19, 2027"; Finnish month names; the card's date equals the date in words a composed title holds for the same event and language; Basic page none; Person with and without a mapped job title; no price, pay or duration for any kind).
- [ ] 2.5 `ShareImage`: EXIF orientation, skip rules, cover and frame with the enlargement limits, transparent sources, chosen images, encoding q82/q72/q60 under 300 KB. Verify with `ShareImageTest` (an orientation-6 fixture comes out upright; a cut-out whose transparent pixels are black sits on white; 1600 × 1200 is cropped; 1200 × 1200 is framed; 640 × 320 framed at most 1.25×; a chosen 400 × 400 framed at 1×; a chosen 150 × 150 refused; a noisy 2400 × 1600 at most 300 KB; a 9000 × 9000 image skipped).
- [ ] 2.6 Built cards match `reference/` (compare by viewing): render every case in the `reference/reference.md` card table with `ShareCard`, `ShareImage` and the icon renderer from the same inputs, and open each beside its file in `reference/cards/`. Verify by viewing: same layout, line breaks, colours, marks and photo treatment (sub-pixel glyph differences allowed; the site card line is the slogan in this change), and list any deliberate difference in the merge request.

## 3. Serving (no visible change: nothing links to it yet)

- [ ] 3.1 `CardInput` in `Resolver` from the entity and configuration in the entity's language, and the hash. Verify with a kernel `CardInputTest` (changing the title, the Site name, the logo, the colour, the kind or the language changes the hash; changing the request host or the interface language does not; the Finnish page's hash equals the hash the route rebuilds for `/fi`).
- [ ] 3.2 `ShareController` routes for cards, photo versions and icons: parameter validation before loading, ownership and anonymous access (404), rebuild and compare, 302 with five minutes of caching and the entity's tags to the current address, render, temp file and rename, sibling deletion, `BinaryFileResponse` with the immutable cache header, `X-Robots-Tag: noindex` on cards, failures logged and remembered for five minutes. Verify with a kernel `ShareRouteTest` (an unpublished page 404; a stale hash 302 to the current one; a page that gained a photo 302 to its photo version; `Host: evil.example` writes no file; two fetches render once; a throwing renderer gives 404 `no-cache` and a log entry).
- [ ] 3.3 Delete an entity's stored images on delete, translation delete, unpublish and loss of anonymous access. Verify with `ShareRouteTest` (each case leaves no directory and the address answers 404).
- [ ] 3.4 Functional proof that the route works through the front controller. Verify with a functional `ShareRouteFunctionalTest` (a card address returns `image/png` with the expected headers, and the file exists on disk afterwards).
- [ ] 3.5 The preview route from the server-side draft, with the state route's permission and entity checks, `no-store`, no file. Verify with a kernel `SharePreviewTest` (an editor gets the draft's title; a user without update access to a draft gets 403; nothing written to disk).
- [ ] 3.6 `hook_requirements`: an in-memory test render, GD with FreeType, a local public stream. Verify with a kernel `ShareRequirementsTest` (a non-local public stream reported; a healthy site reports OK).

## 4. Head output (visible)

- [ ] 4.1 The chain of head-output "The social image follows a chain", with the site's choice and the fallback when no card can be made; `og:image:type`, width and height of what is sent; the card hint. Verify with `ResolverTest` cases (fresh install card; job posting logo skipped; Canvas page hero component; "Use this image"; "No image"; no FreeType → original files; chosen 150 × 150 sent as is with `summary`) and `CoupledHeadTest::testShareRows` (row order).
- [ ] 4.2 `og:image:alt` rules. Verify with `ResolverTest` (media name accepted and refused; card alt "{og:title}, {Site name}"; the site's image keeps its own alt).
- [ ] 4.3 `og:locale` and `og:locale:alternate` with `data/locales.json`. Verify with `ResolverTest` (`en` → `en_US`; default country GB → `en_GB`; `pt-br` → `pt_BR`; a language not in the file gives none; alternates match hreflang).
- [ ] 4.4 Cacheability of design.md D15 and no drawing at delivery. Verify with `CoupledHeadTest` (replacing the logo, changing the default theme or the bundle's name invalidates a cached page; a spy proves delivery never calls the renderers).
- [ ] 4.5 Front page icons while the theme uses core's default favicon. Verify with `CoupledHeadTest::testFrontPageIcons` (three links on the owned front page and core's favicon link removed; none on another page; none with a theme favicon) and `ShareRouteTest` (icon addresses return PNGs of 32, 192 and 180 pixels).
- [ ] 4.5a The card's title is the social title as resolved, composed or not. Verify with a `CardInputTest` case: a composed social title "‹Title› in ‹City›" gives the card the joined text, and changing the venue's city changes the hash.
- [ ] 4.6 Headless parity. Verify with `HeadlessHeadTest::testShareImages` (`head.meta` image rows equal the coupled head's; a preview token never yields a public share address).

## 5. Titles and descriptions (visible)

- [ ] 5.1 A placeholder-named Canvas page's Title fact from its first heading; the placeholder label in each language as a Canvas internal. Verify with `ResolverTest` (heading "Our services" → title "Our services | …"; no heading → "Untitled page"; translated placeholder) and an ARCHITECTURE.md §11 row with a contract test `CanvasPlaceholderTest` in `@group canvas_metatag_canvas_contract`.
- [ ] 5.2 The ending-protected cut of a title over 255 characters, on `compose-values-from-fields`' segments: whole fields of a composed main part go first, then words, then "…". Verify with `ResolverTest` (the 247-character event with ending "Events" ends "… | Events"; a title without spaces is cut at 255 code points; head-output "A cut composed title" never holds " in …" or " · …") and a text-cases row read by `ValuesTest` and vitest.
- [ ] 5.3 Sentence cuts in the page's language and the long text fallback, through the one sentence-cut helper `compose-values-from-fields` added for its long-text budget (no second helper). Verify with `ResolverTest` ("Made to last…" keeps two sentences; "Dr." and "e.g." are not sentence ends; a 240-character sentence ends in a word and "…"; a long text field gives the description).
- [ ] 5.4 A Canvas page's own text and the per-language index of candidates, with invalidation only when a candidate moves between one page and several. Verify with a kernel `PageTextTest` (the blog intro; text in the footer region ignored; a newsletter text on two pages skipped on both; saving an unrelated page does not invalidate the other page's head).
- [ ] 5.5 A Canvas page's first component image through its media or file entity; addresses ignored. Verify with `ResolverTest` (hero chosen over the second image; an external address never requested, using a mocked HTTP client that fails the test on any call).

## 6. Structured data

- [ ] 6.1 `primaryImageOfPage` only from the page's own image, as the original at its upright size. Verify with `SchemaGraphTest` (card page and site image page: none; orientation-6 photo: width 3000, height 4000).

## 7. Site settings and upgrade

- [ ] 7.1 `identity.share_fallback` and `identity.colour` in the config schema, install config and `Values::cleanIdentity()`. Verify with `ValuesTest` ("image" without a default image refused; "blue" refused; `#0F8A7E` kept) and `ApiTest::testSite` (422 naming the member).
- [ ] 7.2 Post-update: `image` where a default image is set, else `card`; invalidate rendered output. Verify with a kernel `ShareUpdateTest` (both cases; a cached page rebuilt).

## 8. Dialog (visible)

- [ ] 8.1 Link preview from the preview route, caption "When this page is shared", the Image field's source lines and no second thumbnail, "From the page's text" for a derived description, debounced 400 ms. Verify with `model.test.ts` (source lines for each chain step) and Playwright `page.spec.ts` (Social on a page without an image shows the card; typing a title updates it within a second), then check it in the browser on the farm site and save screenshots.
- [ ] 8.2 Template scope: "From each Event's Poster" and what events without one share. Verify with Playwright `template.spec.ts` on the Event template, then check it in the browser on the farm site and save a screenshot.
- [ ] 8.3 Site → Sharing: the sample radio group, Logo, Colour with its Change sheet (contrast stated in text), "When a page has no image" with the thumbnail and Change for "Use this image", the SVG logo sentence. Verify with `model.test.ts` (save body) and Playwright `site.spec.ts` (fresh site; theme logo; switching the sample by keyboard; choosing orange updates the sample), then check it in the browser on the farm site and save screenshots.

## 9. Checks

- [ ] 9.1 "Social image rules" as modified. Verify with `checks.test.ts` (card on an event: improve; card on a landing page: no row; 150 × 150 chosen: fix; 800 × 800 chosen: good to know "shown whole"; weight in one unit).
- [ ] 9.2 Sharing rows for site administrators only. Verify with `checks.test.ts` (no FreeType; internal host `http://cms:8080`; SVG logo; Japanese titles; every page one picture with its action; site image without alt; an editor sees none).
- [ ] 9.3 "Name this page" (improve, then fix once published) and "Links already shared keep their old preview". Verify with `checks.test.ts` (never published; published; a changed social title on a published page).

## 10. Docs and fixtures

- [ ] 10.1 README: the reopened non-goals ("image upload or image styles" narrowed to made share images, `og:locale`), how share images are made and served, disk use (about 40 KB per fetched page and language), requirements (GD with FreeType, local public files). ARCHITECTURE.md: the share route, `CardInput`, storage, the placeholder row. Verify with the cspell CI job.
- [ ] 10.2 Commit four cards rendered by the module for the inputs of `reference/cards/` `c04` (an event), `c12` (an Arabic page), `c17` (a fresh site without a logo) and `c21` (a light brand colour), together under 200 KB, to `tests/fixtures/share-cards/` with a `layout.json` of their line texts, sizes and measured contrast. They are reviewed by eye; `ShareLayoutTest` compares only `layout.json`. Verify with `ShareLayoutTest::testReferenceLayouts`.
- [ ] 10.3 Confirm that nothing in the change names a commercial vendor or product, and run `openspec validate strengthen-zero-config-defaults --strict`.

## 11. Manual QA on the farm site

- [ ] 11.1 Run the whole PHPUnit suite, vitest and the Playwright suites touched above, one browser suite at a time. Verify all pass and the extension build is current.
- [ ] 11.2 Real head output, by anonymous `curl`: a Canvas page without an image (card rows, `og:locale`, `summary_large_image`), a page with a 4:3 photo (cropped JPEG under 300 KB), the job posting (card, not the logo), the front page (icon links), a page named "Untitled page" with a heading; fetch each image address and check its headers and pixel size. Record the output in the merge request.
- [ ] 11.3 In the real editor: open Social on a page without an image, type a new title and watch the card change; choose an image and Remove it; open the Event template; open Site → Sharing, switch the sample, change the colour to orange and back, choose "No image" and "Use this image". Save screenshots of each, including the dialog at 200% zoom.
- [ ] 11.4 Share three published farm pages in a link preview debugger or a chat app reachable from the farm site, and confirm a large 1200 × 630 image with the site name and the page title that looks like its `reference/cards/` counterpart. Where no external tool can reach the farm site, say so in the merge request and attach the fetched images instead.
- [ ] 11.5 Unpublish a page whose card was fetched and confirm the card address answers 404 and the stored file is gone.

## Workflow follow-up

- Archive after `link-values-to-fields`, `harden-template-scope`,
  `rethink-structured-data`, `populate-every-schema-type` and
  `read-page-components`. This change's MODIFIED blocks for `head-output`
  ("The title is its main part and its ending", "The social image follows a
  chain"), `dynamic-values`, `structured-data`, `site-seo` ("Installed
  defaults"), `seo-dialog` ("The link preview") and `seo-checks` ("Social
  image rules") are written on their text; if theirs changes before they
  archive, re-derive these blocks. `head-output` "The card hint follows the image
  size" keeps `harden-template-scope`'s "A square logo" and "A wide banner",
  and `seo-dialog` "The link preview" its "The card the head asks for", as
  original files sent when the site cannot make images.
- `add-advanced-meta-tags` modifies "The head has fixed rows in a fixed order"
  after this change and carries this change's rows in its version.
