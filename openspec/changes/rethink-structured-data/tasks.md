# Tasks

Needs `link-values-to-fields` groups 1–3 merged. The module stays working at
the end of every group. PHPUnit runs through the farm's `docker exec` line;
Playwright runs one spec at a time.

## 1. Rules file and verdicts (server, no visible change)

- [ ] 1.1 Add `data/search-features.json` with the entries, `not_for` rules, `where` lines, `confirm` lines, `names`, `doc` addresses and the `reviewed` date of design.md decision 1. Verify with a new unit `SearchFeaturesFileTest` (the file parses, every feature has a source address and a `where` line, retired entries with `since` have a `changelog`).
- [ ] 1.2 Add `SchemaGraph::features($graph)`: verdicts `ready`, `complete`, `needs`, `unanswered`, `not_fit`, `not_here`, `retired`, `none`, following `@id` references inside the graph. Verify with a new unit `SearchFeaturesTest`: one passing and one failing graph per feature; `a|b` and one-of paths; price `gt 0`; `is Offer`; recurring price, several offers and not sold here; site name in a subdirectory; event without a country; a person's logo not evaluated; FAQ retired; a review referencing `#primary`.
- [ ] 1.3 Registry consistency. Verify with a new unit `RegistryConsistencyTest`: every `required` prop is required by the type's least demanding feature; every feature path maps to a prop or a graph fact.

## 2. Registry, graph and report

- [ ] 2.1 Registry: `kind` blocks, `say` sentence variants, `variant_of`, `need`, `option_labels`, `per_item`; new type `Service`; Product and Service `billing`; Product `sold_here` (`emit: false`); `offers_seller` nested conditional ref; Event `organizer`; Person `worksFor`; availability keeps `BackOrder`; `currency` kind with the site default. Verify with `SchemaGraphTest` (Service node with `provider`; `priceSpecification` for P1M and P1Y and none for once; `seller` only when sold here; `organizer` defaults to the identity) and `ValuesTest` (currency codes, `sold_here` values).
- [ ] 2.2 Report members from `build()`: `unknown_type`, `dropped` (key, raw value, reason), `withheld.missing`, `nodes` with origins, `sources` per prop branch. Verify with a new unit `SchemaGraphReportTest`.
- [ ] 2.3 `schema.skip`: cleaned in `Values` on every read and write path, honoured in `build()`, custom JSON-LD unchanged. Verify with `ValuesTest` and `SchemaGraphTest` (a skipped `#faq` absent, the stored JSON intact).
- [ ] 2.4 Site `currency` in config schema, `Values` site rules and `putSite`. Verify with `ValuesTest` ("€" refused, "EUR" kept) and `ApiTest::testSite`.
- [ ] 2.5 One image chain for products (social override, then page image, never the site default). Verify with `ResolverTest::testProductImage`.
- [ ] 2.6 Split `Resolver::report()` from `resolve()`; only `ApiController::state()` calls it; it adds `features` and `rules` (G1, G2, G7 over the merged graph, G9, G10, hidden-text inputs). Verify with a new kernel `DeliveryPathTest` (a spy proves `page_attachments` and the headless decorator never reach `features()` or the rules) and `ApiTest::testPageState` / `testTemplateState` (the report members present).
- [ ] 2.7 Site-save effect: `putSite` dry run lists the published targets whose structured data would change, at most 25 named. Verify with `ApiTest::testSiteSaveEffect`.

## 3. Strings

- [ ] 3.1 Add `scripts/registry-strings.php` generating `src/RegistryStrings.php` (literal `TranslatableMarkup`, context `canvas_metatag:schema`) from both data files; add a CI job that fails when they differ. Verify with the job green and red on a deliberate edit.
- [ ] 3.2 `/state` carries translated registry and rules strings; an untranslated sentence is `null` (checked in locale storage). Verify with `ApiTest::testTranslatedRegistry` (a Finnish translation present and absent).
- [ ] 3.3 `model.ts` stops importing English from the JSON. Verify with `npm run verify`.

## 4. Schema view

- [ ] 4.1 `readback.ts` (pure): variant choice by resolvable slots following `@id`s, `Intl` formatting in the UI language, the fact-list fallback. Verify with a new `readback.test.ts` (every kind; two locales; no "sold by" without a seller; no period without `billingDuration`; folding past 40 words; `say: null`).
- [ ] 4.2 `Stage` with caption, Code and info buttons, the read-back as one roving group of fact buttons, feature lines with fix buttons, the match line; the status region announces verdict transitions once. Verify with `npm run verify` and Playwright `schema.spec.ts` (new): the product sentence, "Merchant listing: needs an image", Choose lists page images first, verdict flips to "Can show" and is announced once.
- [ ] 4.3 `ProofPopover`: where line, required list, Also helps with one Add each, confirm lines, review date and link; doesn't-fit proofs. Verify with Playwright `schema.spec.ts` (dialog "Merchant listing" content; Escape returns focus to the line).
- [ ] 4.4 `KindField` and `KindSheet` (radio group, not-for line, retired line, builder-only line), the kind-change confirm naming removed values, variants in More details. Verify with Playwright `schema.spec.ts` (product to event: confirm copy, Undo restores the price).
- [ ] 4.5 Facts ordered by feature need, at most four before More details; guidance at rest; a field shows its own Checks; required defaulted facts open in place; the name-equals-title hint; Billed and Bought on this page controls; Currency select with `Intl.DisplayNames`; "Change to plans for a service". Verify with `checks.test.ts` (the field shows its own Check) and Playwright `schema.spec.ts` (pressing the name part focuses Schema › Name; Billed every month gives "Doesn't fit: a recurring price"; Change to plans for a service keeps name, price and billing).
- [ ] 4.6 Unknown stored kind notice and field. Verify with Playwright `schema.spec.ts` on a page whose stored type is `Recipe`.
- [ ] 4.7 Delete the Type select, its grouped items, the type-line copy and the Custom JSON-LD and View output rows. Verify with `npm run verify` (no dead imports) and a rebuilt `extension/dist`.

## 5. Output and your own JSON-LD

- [ ] 5.1 Output's structured data outline (main first, type, `@id`, origin, left-out and retired reasons), Show JSON-LD, Copy, Test this page (published URL or copy for drafts). Verify with Playwright `page.spec.ts` (outline rows; "Copied. Paste the code into the test.").
- [ ] 5.2 Rename the custom JSON-LD sheet "Add your own JSON-LD", open it from Output and from "Added by hand"; inline verdicts, G1/G2/G7/G10 lines and the hidden-text line with its two actions; the one-release moved notice on pages with custom JSON-LD. Verify with Playwright `page.spec.ts` (notice shown once per page, G1 line, Leave it out removes the node from Output and keeps the JSON).

## 6. Checks

- [ ] 6.1 `checks.ts`: rows from `features`, `rules` and report members with the stage's words; severity per design.md decision 9; price parity with currency adjacency and period words; dates four ways; images by file URI; ratings; linked and fact values. Verify with `checks.test.ts` (each severity; "2,500 customers" not a price; "€2,500 / month" against a one-time price; a hidden question to fix; a review of the identity to fix; "doesn't fit" not counted).

## 7. AI proposals

- [ ] 7.1 Reserve dates, authors and ratings in proposals; the review tray counts unverified guesses instead of listing them and shows "Add it yourself" for reserved facts. Verify with `AssistantTest` (a returned start date and author dropped) and Playwright `ai.spec.ts` (the count line, no unverified value shown).

## 8. Docs and checks on the site

- [ ] 8.1 ARCHITECTURE.md §7 (graph, report, delivery split, rules file) and §17 (new tests); README (the Schema tab, kinds, Plans for a service, what a verdict means and does not mean); `.cspell-project-words.txt`. Verify with the cspell and PHPCS CI jobs.
- [ ] 8.2 Run every suite: PHPUnit unit and kernel, the AI submodule's tests, `npm run verify`, the build-assets check, and each Playwright project one at a time; an axe scan of the Schema view. Verify all are green.
- [ ] 8.3 Browser check on the farm site: a product page (needs an image, then can show), the pricing page as a monthly product (doesn't fit) and after "Change to plans for a service", an event without a start date, an About page, a page with custom JSON-LD (moved notice, hidden question to fix), Output, Checks, Site currency with its save effect. Save a screenshot of each.


## 9. Findings from the complex-content review

Recorded by `harden-template-scope`. Do each with the group named in brackets.

- [ ] 9.1 [2.2, 6.1] A required fact that resolves but fails its kind or pattern is reported as `dropped` with its value and reason, not as missing, and Checks words the fix: 'Currency gives "Euro (€)"; a three-letter code such as EUR is needed.' Verify with `SchemaGraphReportTest` (a `priceCurrency` of "Euro (€)" in `dropped`, absent from `withheld.missing`) and `checks.test.ts` (the wording; no "Add Currency").
- [ ] 9.2 [6.1] At template scope, a missing required fact names the previewed item in the verdict's words ("Needs Ends: empty for this event"), and is listed once even when the same value also feeds a text value. Verify with `checks.test.ts` (Every Event previewing an event without an end date: one row).

## Workflow follow-up

- Archive after `link-values-to-fields`; this change's `seo-checks` delta is
  written on its text.
- At archive, update the sheet list in `seo-dialog` "Sheets cover the view"
  from "Custom JSON-LD" to "Add your own JSON-LD" (it is also modified by
  `add-advanced-meta-tags`; edit whichever text is current).
- At archive, rewrite the Purpose of `openspec/specs/structured-data/spec.md`
  to mention kinds and the report, and drop its stray "The idle status lives
  in the menu" scenario, which belongs to `seo-dialog`.
- Remove the moved-notice code one release after this ships.
