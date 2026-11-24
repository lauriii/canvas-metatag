# Tasks

## Conventions

Test paths:

- kernel tests in `tests/src/Kernel/`;
- vitest next to the source in `extension/src/`;
- Playwright in `tests/e2e/`.

Run PHPUnit through the farm's `docker exec`. Run one browser suite at a
time. Browser checks run on the farm site (site-4), signed in as an editor
unless a task says administrator. Screenshots go on the merge request.

Where a test is meant to fail before the fix, commit it first and record the
failure in the merge request. Each phase ends releasable.

Before starting, re-read the link menu, `values.ts`, `LinkMenu.tsx`,
`Composer.tsx` and the resolver's facts as `link-values-to-fields` and
`compose-values-from-fields` left them. The menu has link, add and replace
modes from the start. Line numbers in the design drift.

## 1. The recipe for the adapter (item 2)

- [x] 1.1 Add `examples/headless-next/` with a `package.json` that pins `@drupal-canvas/headless-next`, `@drupal-canvas/headless`, the framework it adapts to, `react` and `react-dom` as exact versions, a `tsconfig.json` with `jsx: react-jsx`, and a lockfile. Ignore its `node_modules/`. Run `npm ci` there in the `playwright` CI job before the suite. Prove it with `npm ci` and `npx tsc --noEmit` in that folder.
- [x] 1.2 Write `examples/headless-next/canvas-head.tsx`. It holds `canvasMetadata(head)` and `CanvasJsonLd({ head })` as design D1 describes, with no other exports and no dependency beyond the SDK, the framework's metadata type and React. Its comment states the rule once: the CMS head is the page's whole head. Prove it with 1.3.
- [x] 1.3 Add `tests/e2e/headless-frontend.spec.ts`, importing the helper from the example. It reads, as a visitor, the content API heads of the article, the Pricing page and a seeded page without a description. Its tests:
  - "the recipe keeps every row": every `meta` row of each head is found in `canvasMetadata()`'s result, under the member the framework renders it from. A row with no known member fails the test and names the row;
  - "absent means none": for the page without a description, and for a head with its canonical and hreflang links removed, `description` is `''` and `alternates` is `null`, both own properties of the result;
  - "JSON-LD": `renderToStaticMarkup(<CanvasJsonLd head={head} />)` gives one script whose text parses back to `head.script[0].textContent` and contains no `</script`. A fixture value with `</script>`, `&` and U+2028 goes through it;
  - "the adapter alone": `toNextMetadata()` from the Canvas codebase under test (`packages/headless-next/src/head.ts`) loses exactly `og:image:width`, `og:image:height`, `og:image:alt`, `article:published_time`, `article:modified_time` and the script. The list is pinned, with a comment pointing at `upstream/canvas-sdk-next-head.md`. First confirm that the Canvas build in the `playwright` job carries that file; if it doesn't, run this test against the example's pinned adapter and say so in the README table;
  - "the README quotes the helper": the README block between the markers equals the file.

  Negative control, recorded in the merge request: delete the image detail mapping from the helper; the first test fails and names `og:image:alt`.
- [x] 1.4 Rewrite the README's "Headless delivery":
  - The adapter row of the table says what it loses and that a test checks it. The column's note "read in the source, not tested" stays only for the packages that are still untested.
  - One recipe, "With `@drupal-canvas/headless-next`", has the metadata function, the helper quoted between `<!-- canvas-head.tsx -->` markers, and the component in the page. It links the example folder and its tested versions, and says why the empty description and the null alternates are there: a layout's are otherwise inherited, and its description copied into the share card.
  - The generic `serializeJsonForHtml()` snippet stays for the packages that render nothing.
  - One sentence on JSON-LD (design D2): the graph already holds the site's organization and website, so a layout must not add its own; a frontend that adds other nodes references the module's `@id`s.
  - "Notes for Canvas" points at the upstream ask.

  Prove it with 1.3's README test, and with `cspell` on the README.
- [x] 1.5 Update ARCHITECTURE.md's `UPSTREAM(canvas)` ask 5 so that it names the absent description and canonical and the JSON-LD component, and points at the recipe. Docs only.

## 2. Addresses no visitor can reach (item 5)

- [x] 2.1 Add `Values::isPublicHost(string $host)` and `Values::isDevelopmentHost(string $host)`, with the definitions of `serve-each-frontend-its-own-addresses`. A non-public host is a loopback, private or link-local IP, a single-label host, or a host under `localhost`, `local`, `test`, `internal` or `invalid`. A development host is a loopback address, `localhost`, a host under `localhost`, `test` or `invalid`, or one with a known local development suffix, from a short list in code. Prove it with a `ValuesTest` unit data provider: `127.0.0.1`, `[::1]`, `10.0.0.5`, `cms`, `cms.internal`, `site.test`, `localhost` and a known local suffix on one side; `www.example.com` and `203.0.113.10` on the other.
- [x] 2.2 Leave out page addresses on a non-public host (design D5): when `Resolver::origin()` takes the setting or a frontend on a non-public host and Drupal's own host is not a development host, the page has no address, so the canonical, `og:url`, hreflang and JSON-LD script are left out. Add `url.site` to the head's cacheability in that case. Prove it with `HeadlessHeadTest` and `CoupledHeadTest` cases for each scenario of headless-head "Page addresses on a host no visitor reaches are left out", including a page cache case that the two Drupal hosts get their own heads.
- [x] 2.3 Make `runtimeRequirements()` merge rows instead of returning early. Add the "SEO public addresses" row of design D5, built from `Resolver::origin()` and the current request's host, with the messages in D5. Prove it with a new `StatusReportTest` kernel test that covers each scenario of headless-head "The status report flags a public base no visitor can use". Requests are made at `https://cms.example.com`, `https://cms.example.test` and `http://www.example.com`. The "SEO for headless content" error still appears alongside.
- [x] 2.4 Add one line to the README's "Deployment": what the row means, what is left out until it is fixed, and that both are replaced by the per-frontend rules later. Docs only.

## 3. The default description and the dialog's words (items 3, 4 and 6)

- [x] 3.1 Add `data/value-words.json` with the description and title words of value-links "Fields named for the value come first". In the resolver, after an empty summary, take the first `string`, `string_long`, `text` or `text_long` field in form order whose label or machine name without `field_` is a description word, compared without case. Set `via` to the field that gave the value, else the first that could. Prove it with `ResolverTest` cases for each scenario of dynamic-values "A page's and a node's own description and image", plus a field the visitor may not view (skipped).
- [x] 3.2 Add `headless` to the dialog's state: `canvas_headless` is installed and has at least one frontend. Prove it with `ApiTest` cases: true with a frontend, false without one, false without the module.
- [x] 3.3 Use "No description sent. The frontend decides what to show." (design D3) in the search preview and the link preview (`Previews.tsx`), the focused empty description (`Field.tsx`) and every variant of "Add a description" (`checks.ts`), only when `headless` is true. Prove it with:
  - `checks.test.ts` cases for the page, headless and coupled (the front page variant moved to `add-home-page-defaults`, which owns that check);
  - `model.test.ts` "an empty description": `emptyDescription()` for the search preview, the card and the field, headless and coupled (the project has no component render tooling, so the three places share this one function);
  - a `headless.spec.ts` case that opens the dialog on a page without a description and finds the sentence in the search preview, in the link preview and the "Add a description" check on the focused field, and one that focuses the description of a template previewing an article without one and finds the sentence on the field;
  - the coupled words ("Search engines will pick text from the page." in the search preview, "Empty. Search engines will pick text from the page." on the focused field) are proved by the `model.test.ts` cases alone: no coupled e2e seed previews an item without a description, and `headless.spec.ts` checks that neither shows on a headless site.
- [x] 3.4 Add `canvas_label` (Canvas's `label()` of the target, as Canvas stores it in the draft) to the target in the state. Show the template's draft status as "Draft · listed under Unpublished changes as “‹canvas_label›”". Prove it with:
  - a `TemplateDraftTest` case: `canvas_label` equals the `label` of Canvas's auto-save entry for the same draft;
  - `model.test.ts` cases for a template draft, a page draft and a translation's draft (both unchanged);
  - a `template.spec.ts` step: after linking the description, the status reads the template's Canvas label, and Canvas's "Review changes" lists a row with that same label.

## 4. The link menu and named groups (items 3 and 7)

- [x] 4.1 In `entriesFor()`, name the facts group "Automatic". Add "from ‹via›" to a fact entry's value line, and to a Default box's description, when the fact reads a field. Move a fact that cannot be had on the type to the quiet last row, disabled with "No ‹type› has one". At template scope that means Description or Image without `via`. First confirm that the resolver sets `via` from the type's form even when no item exists; if not, set it there. Leave the field's own default fact out of its menu when the pick links the whole value; offer it in add and replace mode, and let "Add words or fields · Start from ‹label›" adopt it as the first chip. Name facts by their label alone in boxes, chips and announcements, and put "from ‹via›" into a chip's tooltip and the composer's description. Apply "No ‹type› has one" in link, add and replace mode. Prove it with `values.test.ts` cases for each, for every scenario of value-links "Worked-out values read the same in a composer" and "The field's own default when adding to a composition", with "Every Bookmark" as a fixture type with no text or image field, and "Every Post" with a Summary field. Add a `boxSaid()` case in `values.test.ts` (the box's description, without render tooling): the description of a box linked to Site name starts with "Linked to Site name.". The step's words later became "Keep the default and add to it" for a default named like its place (value-links main spec, `startWords()`); the tests follow that.
- [x] 4.2 With an empty filter, order the type's fields named for the value first (from `data/value-words.json`, the same rule as 3.1), keeping form order within each band. Prove it with a `values.test.ts` case where Image › Alternative text comes before Summary in form order: Summary comes first, in link mode and in add mode. Add a case that a typed filter's ranking is unchanged.
- [x] 4.3 In `LinkMenu.tsx`, wrap each group's options in `role="group"` with `aria-labelledby` on its heading. Drop `aria-hidden` from the heading and the `role="presentation"` wrappers, and keep `aria-activedescendant` working. If `link-values-to-fields` already did this, keep its version and do only the test changes. Prove it with:
  - `template-complex.spec.ts`: replace both `.seo-menu-group` queries with `getByRole('group', { name })` ("Event", "Automatic", "Job posting");
  - an axe scan of the open menu with no violations, in link mode and in add mode;
  - Up and Down still moving across groups.
- [x] 4.4 Add "Scripting the dialog" to the README (design D8): the frame titled "SEO", roles and names as the hooks, and an example locator chain for the description's link menu. Point agents at the commands of `make-the-module-agent-ready` once it lands. Prove it by copying the example into a `headless.spec.ts` step that must pass.

## 5. Checks before archiving

- [x] 5.1 `openspec validate --all --strict`, PHPUnit (kernel and unit), vitest, `npm run typecheck` and the Playwright suites touched (`headless`, `headless-frontend`, `template`, `template-complex`), one at a time.
- [x] 5.2 Manual QA on site-4, with screenshots. Restore every setting afterwards.
  - **Headless, rendered.** Configure one frontend on site-4. In the scratchpad, never in the repository, build a minimal app from the README recipe alone, with `CANVAS_SITE_URL` set to the site and a layout that sets a site-wide description and `alternates: { canonical: '/' }`. Run it once, and fetch an article and a page without a description as a visitor. The HTML must carry:
    - `og:image` with its width, height and alt text;
    - `article:published_time` and `article:modified_time`;
    - one JSON-LD script equal to the content API's;
    - no description tag, and no layout description in `og:description`;
    - the CMS canonical only, and none at all for a head without one.

    Stop the app afterwards, and note its memory use in the merge request.
  - **Addresses and status report.** Set the frontend to `http://localhost:3000`:
    - site-4's status report shows no row (both are development hosts), and the content API head keeps its canonical;
    - `drush core:requirements --uri=https://cms.example.com` shows the error with its fix;
    - setting `canvas_metatag_public_base` in `settings.local.php` clears it.
  - **Dialog, headless.** On a page without a description: the sentence in both previews, the field and the "Add a description" check. With the frontend removed, the coupled sentences come back.
  - **Default and link menu.** On a type given a plain Summary field for the check (removed afterwards), the description's Default box says "from Summary", Summary comes first in the type's group, and "Automatic" lists no Description. "Add words or fields" says "Start from Description" and gives a Description chip whose tooltip says "from Summary"; "Add a field to Description" then lists Description. With a screen reader's tree (Playwright's accessibility snapshot), the groups are named, in link mode and in add mode.
  - **Review changes.** Link the description of "Every Article". The status reads "Draft · listed under Unpublished changes as “Article content items — Full content view”", and Canvas's "Review changes" lists the same label. Discard the draft there.
- [x] 5.3 Record in decisions.md the queue position and the open decisions as taken. Confirm that the amendments applied with this plan are still in `strengthen-zero-config-defaults`, `serve-each-frontend-its-own-addresses` and `test-in-every-engine-and-language`.

## 6. Review fixes, round 1

- [x] 6.1 A page with hand-added JSON-LD on a host no visitor reaches opened with a server error: `Resolver::report()` ran the graph rules over nodes whose graph is left out. It skips them while the page is unaddressed. Prove it with `ApiTest::testUnaddressedPageWithHandAddedItems()`: addressed, the rules report the item's relative address; unaddressed, the state is 200 with `unaddressed` and no rules.
- [x] 6.2 `canvas_label` reads its one auto-save entry from Canvas's store (`AutoSaveManager::AUTO_SAVE_STORE`), not every draft on the site, with an `UPSTREAM(canvas)` note asking for a per-entry getter. Prove it with the existing `TemplateDraftTest` cases.
- [x] 6.3 The recipe tests are skipped per test where Node has no `module.registerHooks()` (22.15), and fail in CI instead of passing by being skipped; "the README quotes the helper" always runs. The skip message, the CI comment and the README name the real requirement. Prove it with the e2e type-check and the `headless-frontend` project.
- [x] 6.4 Linking from a value's box, the current row (the field the default reads, or the current link) closes the menu and writes nothing; an editor who left the box for an empty composer still links the field they pick (`template.spec.ts` keeps proving that). The link button's "+" keeps focus in a composer that holds only its default, so a click opens the add menu. Prove both with `compose.spec.ts` steps.
- [x] 6.5 A detail's Description reads the head's description; while the description is set, it names no field it reads (`detailLookup()`), and the on-page check looks for the text the output uses. Prove it with `values.test.ts` and `checks.test.ts` cases.
- [x] 6.6 "Add words or fields" starts empty from a default no item of the type has (`keptAsChip()`); a chip's "Without" line leaves the field out wherever the composition uses it, and its default too when that is the same field (`partsText()`). Prove it with `values.test.ts` cases.
- [x] 6.7 The caption keeps its status in sight: the previewed node's name gives way first, down to a few letters. Prove it with a `template-complex.spec.ts` step that the suffix is visible at the dialog's width.
- [x] 6.8 While the head carries no address, the previews show none. The plain http status message says "which is not https". The headless sentence reads "The frontend decides what to show." The link button's tooltip names the default's field as the box does (`followsDefault()`). A template's image detail says "No ‹type› has one" where no field gives an image. The meter's empty state is a flag only; unreachable fact notes are gone. Prove them with the updated `StatusReportTest`, `model.test.ts`, `values.test.ts` and `checks.test.ts` cases.
- [x] 6.9 The specs: the coupled "An empty description" scenario is narrowed to where no check speaks in the field, with a page scenario naming the check; the status report requirement names what is wrong with the address, with a plain http scenario.

## 7. Review fixes, round 2

- [x] 7.1 The previews take their addresses and the search result's description from `shownAddresses()` and `resultDescription()` in `model.ts`: no address, canonical or card host while the head carries no address, and "text previews are off" before the headless sentence. Prove it with `model.test.ts` cases.
- [x] 7.2 A template's unset image detail says where it comes from through `detailFrom()` in `values.ts` ("From the Hero image field", "No bookmark has one"). Prove it with a `values.test.ts` case.
- [x] 7.3 Checks says "Page addresses are left out" in an editor's words; the setting is named only in the status report row (seo-checks main spec and this delta). Prove it with the full detail in `checks.test.ts`.
- [x] 7.4 A link menu that links the whole value leaves out the default only while the value follows it, and keeps a default no item has, disabled with "No ‹type› has one", never as the current row (`withoutDefault()`). Prove it with a `values.test.ts` case for a social image on a type without an image.
- [x] 7.5 A worked-out value names the field it reads as the menu names it ("Default · from Description (body)"); the social image's aside no longer repeats the Default box's "from ‹via›". Prove it with `values.test.ts` and the updated `template-complex.spec.ts` step.
- [x] 7.6 The length count is read as "247 characters", after the hint; the dialog's API calls keep the editor's language prefix (`host.basePath()`); a link menu above its field stops under the header; the Site title example says when the previewed item sets its own ending (`ownEndingNote()`). Prove them with `host.test.ts` and `model.test.ts` cases, and screenshots.
- [x] 7.7 `Meter.sentence`, which nothing showed, is gone. `StatusReportTest` checks both refused frontend spellings; `ValuesTest` pins link-local and another loopback IPv6 spelling; `HeadlessHeadTest` an internal Drupal host; headless-head defines a development host. `headless-frontend.spec.ts` runs its tests independently.

## 8. Review fixes, round 3

- [x] 8.1 An empty `canvas_metatag_public_base` is unset: the status report says nothing about the setting and reports the frontend's address instead. Prove it with a `StatusReportTest` assertion. `ValuesTest` pins a host under `invalid`.
- [x] 8.2 The archived deltas match the main specs they were merged into: "Development hosts" is added to the headless-head delta, and the value-links and seo-dialog requirements carry main's text.
- [x] 8.3 The Structured data view's "No structured data is sent: page addresses are left out." comes from `unsentSchema()` in `model.ts`, and Checks drops "No search feature for ‹kind›" while the page is unaddressed (seo-checks scenario "The Structured data view"). Prove it with `model.test.ts` and `checks.test.ts` cases.
- [x] 8.4 A field labelled like a fact carries its machine name only where a menu lists both, and on its chip: the Default box, its description and the link button's tooltip say "from Description"; the description's own menu, which lists no Description fact, names the field "Description" (`withoutDefault()`, `Entry.untold`). The level that holds the field a default reads says "Default" (`tree()`'s `marked`), and the current row's check sits at the row's end. Prove it with `values.test.ts` cases and the updated `template-complex.spec.ts` steps.
- [x] 8.5 The search result preview's accessible name ends with its description or the sentence shown in its place (`resultName()`). Prove it with `model.test.ts` cases for the coupled, headless and text-previews-off sentences.
- [x] 8.6 An icon button whose tooltip starts with its name is described by the rest of the tooltip only, and a field's description holds its source word without the transient "Reset ·" and "Undo". The social description follows the description's default while that is unset or stored as the same default. The Site tab's title example says "With the site's ending" where the previewed item sets its own. Checked in the browser, with screenshots on the merge request.
- [x] 8.7 ARCHITECTURE lists `UPSTREAM(canvas)` asks 8 (a per-entry auto-save getter), 9 ("Review changes" details) and 10 (editor routes keeping the language prefix). Task 7.6's `basePath()` takes effect only once Canvas keeps the prefix; the README and ARCHITECTURE known limitations say the dialog follows the editor's language through the user's preferred language.

## 9. Gate

- [x] 9.1 A template's social description that follows the description's default said "This person: ." and showed an empty box when the previewed item has no description: it says "Empty for this ‹type›", as the Search tab's box does (`wordsShown()` in `values.ts`). Prove it with a `values.test.ts` case, and in the browser on "Every Person" previewing a person without a biography.
- [x] 9.2 Gate checks: `npm run verify`, the e2e type-check, the Unit suite and every kernel class one at a time, phpcs (no errors), the full Playwright suite with one worker, and manual QA on site-4. The `compose-webkit` project cannot run on the farm: WebKit there never opens a page, even a blank one (as recorded in `compose-values-from-fields`), so its nine tests join the owner's merge check. Every other project passes.
  - Repair after the gate (2026-11-24): WebKit opens pages on the farm once its sandbox denies the system analytics look-up without reporting it (a reported denial of that look-up never returns on this host, so the network process waited forever); the runner's browser copy is changed, not the repository. `compose-webkit` then ran and needed two test fixes in `compose.spec.ts`: Tab in WebKit's desktop default moves only between text fields, so the keyboard steps press Alt+Tab there (Tab to every item); and the conflict step waits for the dialog's read-back of the state after the editor loads the other event's layout, so the other session's write lands after it and is refused. Re-gate: `npm run verify` (644 vitest tests), the e2e type-check, the Unit suites (612 + 2), the kernel classes this change touched one at a time (`ApiTest`, `CoupledHeadTest`, `HeadlessHeadTest`, `ResolverTest`, `SourcesTest`, `StatusReportTest`, `TemplateDraftTest`, `VocabularyRouteTest`, `ComposeTest`), phpcs (no errors) and the full Playwright suite with one worker, all nine `compose-webkit` tests among its 129 passes. WebKit coverage of the composer no longer waits for the owner's merge check; the screen reader steps still do.

Not done here: three link menu issues seen in review belong to the menu's own change (`keep-value-menus-inside-dialog`, archived) and are queued as `test-in-every-engine-and-language` task 4.5: its bottom fade is translucent over the dialog behind it, a short menu keeps the full frame height, and at 350 px tall or 200 % zoom it can run past the visible part of Canvas's dialog (ARCHITECTURE known limitations, `UPSTREAM(canvas)` ask 6). Text menus offering an image's numbers and long text first in a title's menu are queued as `link-groups-and-pick-pages` task 4.4. Two Checks wordings seen in review belong to the structured-data checks (`populate-every-schema-type`, archived), not here, and wait for an open structured-data change: "Also helps the article title, image and date: Website. Adding it gives …" should name the property in plain words, and "Add an image for article results" should say where an image comes from on a type with no image field. A link menu that opens upward at 600 px shows about two rows; `test-in-every-engine-and-language` task 4.5 should prefer opening below at the frame's full remaining height.
