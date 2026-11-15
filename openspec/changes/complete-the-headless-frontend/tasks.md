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

Before starting, re-read the link menu, `values.ts`, `LinkMenu.tsx` and the
resolver's facts as `link-values-to-fields` left them. Line numbers in the
design drift.

## 1. The recipe for the adapter (item 2)

- [ ] 1.1 Add `examples/headless-next/` with a `package.json` that pins `@drupal-canvas/headless-next`, `@drupal-canvas/headless`, the framework it adapts to, `react` and `react-dom` as exact versions, a `tsconfig.json` with `jsx: react-jsx`, and a lockfile. Ignore its `node_modules/`. Run `npm ci` there in the `playwright` CI job before the suite. Prove it with `npm ci` and `npx tsc --noEmit` in that folder.
- [ ] 1.2 Write `examples/headless-next/canvas-head.tsx`. It holds `canvasMetadata(head)` and `CanvasJsonLd({ head })` as design D1 describes, with no other exports and no dependency beyond the SDK, the framework's metadata type and React. Its comment states the rule once: the CMS head is the page's whole head. Prove it with 1.3.
- [ ] 1.3 Add `tests/e2e/headless-frontend.spec.ts`, importing the helper from the example. It reads, as a visitor, the content API heads of the article, the Pricing page and a seeded page without a description. Its tests:
  - "the recipe keeps every row": every `meta` row of each head is found in `canvasMetadata()`'s result, under the member the framework renders it from. A row with no known member fails the test and names the row;
  - "absent means none": for the page without a description, and for a head with its canonical and hreflang links removed, `description` is `''` and `alternates` is `null`, both own properties of the result;
  - "JSON-LD": `renderToStaticMarkup(<CanvasJsonLd head={head} />)` gives one script whose text parses back to `head.script[0].textContent` and contains no `</script`. A fixture value with `</script>`, `&` and U+2028 goes through it;
  - "the adapter alone": `toNextMetadata()` from the Canvas codebase under test (`packages/headless-next/src/head.ts`) loses exactly `og:image:width`, `og:image:height`, `og:image:alt`, `article:published_time`, `article:modified_time` and the script. The list is pinned, with a comment pointing at `upstream/canvas-sdk-next-head.md`. First confirm that the Canvas build in the `playwright` job carries that file; if it doesn't, run this test against the example's pinned adapter and say so in the README table;
  - "the README quotes the helper": the README block between the markers equals the file.

  Negative control, recorded in the merge request: delete the image detail mapping from the helper; the first test fails and names `og:image:alt`.
- [ ] 1.4 Rewrite the README's "Headless delivery":
  - The adapter row of the table says what it loses and that a test checks it. The column's note "read in the source, not tested" stays only for the packages that are still untested.
  - One recipe, "With `@drupal-canvas/headless-next`", has the metadata function, the helper quoted between `<!-- canvas-head.tsx -->` markers, and the component in the page. It links the example folder and its tested versions, and says why the empty description and the null alternates are there: a layout's are otherwise inherited, and its description copied into the share card.
  - The generic `serializeJsonForHtml()` snippet stays for the packages that render nothing.
  - One sentence on JSON-LD (design D2): the graph already holds the site's organization and website, so a layout must not add its own; a frontend that adds other nodes references the module's `@id`s.
  - "Notes for Canvas" points at the upstream ask.

  Prove it with 1.3's README test, and with `cspell` on the README.
- [ ] 1.5 Update ARCHITECTURE.md's `UPSTREAM(canvas)` ask 5 so that it names the absent description and canonical and the JSON-LD component, and points at the recipe. Docs only.

## 2. Addresses no visitor can reach (item 5)

- [ ] 2.1 Add `Values::isPublicHost(string $host)` and `Values::isDevelopmentHost(string $host)`, with the definitions of `serve-each-frontend-its-own-addresses`. A non-public host is a loopback, private or link-local IP, a single-label host, or a host under `localhost`, `local`, `test`, `internal` or `invalid`. A development host is a loopback address, `localhost`, a host under `localhost`, `test` or `invalid`, or one with a known local development suffix, from a short list in code. Prove it with a `ValuesTest` unit data provider: `127.0.0.1`, `[::1]`, `10.0.0.5`, `cms`, `cms.internal`, `site.test`, `localhost` and a known local suffix on one side; `www.example.com` and `203.0.113.10` on the other.
- [ ] 2.2 Leave out page addresses on a non-public host (design D5): when `Resolver::origin()` takes the setting or a frontend on a non-public host and Drupal's own host is not a development host, the page has no address, so the canonical, `og:url`, hreflang and JSON-LD script are left out. Add `url.site` to the head's cacheability in that case. Prove it with `HeadlessHeadTest` and `CoupledHeadTest` cases for each scenario of headless-head "Page addresses on a host no visitor reaches are left out", including a page cache case that the two Drupal hosts get their own heads.
- [ ] 2.3 Make `runtimeRequirements()` merge rows instead of returning early. Add the "SEO public addresses" row of design D5, built from `Resolver::origin()` and the current request's host, with the messages in D5. Prove it with a new `StatusReportTest` kernel test that covers each scenario of headless-head "The status report flags a public base no visitor can use". Requests are made at `https://cms.example.com`, `https://cms.example.test` and `http://www.example.com`. The "SEO for headless content" error still appears alongside.
- [ ] 2.4 Add one line to the README's "Deployment": what the row means, what is left out until it is fixed, and that both are replaced by the per-frontend rules later. Docs only.

## 3. The default description and the dialog's words (items 3, 4 and 6)

- [ ] 3.1 Add `data/value-words.json` with the description and title words of value-links "Fields named for the value come first". In the resolver, after an empty summary, take the first `string`, `string_long`, `text` or `text_long` field in form order whose label or machine name without `field_` is a description word, compared without case. Set `via` to the field that gave the value, else the first that could. Prove it with `ResolverTest` cases for each scenario of dynamic-values "A page's and a node's own description and image", plus a field the visitor may not view (skipped).
- [ ] 3.2 Add `headless` to the dialog's state: `canvas_headless` is installed and has at least one frontend. Prove it with `ApiTest` cases: true with a frontend, false without one, false without the module.
- [ ] 3.3 Use "No description sent. The frontend decides what shows." (design D3) in the search preview and the link preview (`Previews.tsx`), the focused empty description (`Field.tsx`) and every variant of "Add a description" (`checks.ts`), only when `headless` is true. Prove it with:
  - `checks.test.ts` cases for the page and the front page variant, headless and coupled;
  - a vitest render case each for both previews and the field, headless and coupled;
  - a `headless.spec.ts` case that opens the dialog on a page without a description and finds the sentence in the search preview, in the link preview and on the focused field;
  - the existing coupled scenarios, unchanged.
- [ ] 3.4 Add `canvas_label` (Canvas's `label()` of the target, as Canvas stores it in the draft) to the target in the state. Show the template's draft status as "Draft · in Review changes as “‹canvas_label›”". Prove it with:
  - a `TemplateDraftTest` case: `canvas_label` equals the `label` of Canvas's auto-save entry for the same draft;
  - `model.test.ts` cases for a template draft, a page draft and a translation's draft (both unchanged);
  - a `template.spec.ts` step: after linking the description, the status reads the template's Canvas label, and Canvas's "Review changes" lists a row with that same label.

## 4. The link menu and named groups (items 3 and 7)

- [ ] 4.1 In `entriesFor()`, name the facts group "Automatic". Add "from ‹via›" to a fact entry's value line, and to a Default box's description, when the fact reads a field. Move a fact that cannot be had on the type to the quiet last row, disabled with "No ‹type› has one". At template scope that means Description or Image without `via`. First confirm that the resolver sets `via` from the type's form even when no item exists; if not, set it there. Leave the field's own default fact out of its menu. Name facts by their label alone in boxes and announcements. Prove it with `values.test.ts` cases for each, with "Every Bookmark" as a fixture type with no text or image field, and "Every Post" with a Summary field. Add a `Value` render case: the description of a box linked to Site name starts with "Linked to Site name.".
- [ ] 4.2 With an empty filter, order the type's fields named for the value first (from `data/value-words.json`, the same rule as 3.1), keeping form order within each band. Prove it with a `values.test.ts` case where Image › Alternative text comes before Summary in form order: Summary comes first. Add a case that a typed filter's ranking is unchanged.
- [ ] 4.3 In `LinkMenu.tsx`, wrap each group's options in `role="group"` with `aria-labelledby` on its heading. Drop `aria-hidden` from the heading and the `role="presentation"` wrappers, and keep `aria-activedescendant` working. If `link-values-to-fields` already did this, keep its version and do only the test changes. Prove it with:
  - `template-complex.spec.ts`: replace both `.seo-menu-group` queries with `getByRole('group', { name })` ("Event", "Automatic", "Job posting");
  - an axe scan of the open menu with no violations;
  - Up and Down still moving across groups.
- [ ] 4.4 Add "Scripting the dialog" to the README (design D8): the frame titled "SEO", roles and names as the hooks, and an example locator chain for the description's link menu. Point agents at the commands of `make-the-module-agent-ready` once it lands. Prove it by copying the example into a `headless.spec.ts` step that must pass.

## 5. Checks before archiving

- [ ] 5.1 `openspec validate --all --strict`, PHPUnit (kernel and unit), vitest, `npm run typecheck` and the Playwright suites touched (`headless`, `headless-frontend`, `template`, `template-complex`), one at a time.
- [ ] 5.2 Manual QA on site-4, with screenshots. Restore every setting afterwards.
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
  - **Default and link menu.** On a type given a plain Summary field for the check (removed afterwards), the description's Default box says "from Summary", Summary comes first in the type's group, and "Automatic" lists no Description. With a screen reader's tree (Playwright's accessibility snapshot), the groups are named.
  - **Review changes.** Link the description of "Every Article". The status reads "Draft · in Review changes as “Article content items — Full content view”", and Canvas's "Review changes" lists the same label. Discard the draft there.
- [ ] 5.3 Record in decisions.md the queue position and the open decisions as taken. Confirm that the amendments applied with this plan are still in `strengthen-zero-config-defaults`, `serve-each-frontend-its-own-addresses` and `test-in-every-engine-and-language`.
