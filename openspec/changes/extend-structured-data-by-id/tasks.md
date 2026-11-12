# Tasks

Needs `rethink-structured-data`.

## 1. Storage and validation

- [ ] 1.1 Config schema for `schema.extend` and `schema.custom_main`; `Values::cleanExtend()` (custom JSON-LD rules, selector keys, `@id` refused, `@type` add-only, cap shared with `custom`) on every read and write path. Verify with `ValuesTest` (a `@type` change refused; `offers[*]` and `offers[name=Growth]` accepted; 32 KB across both keys refused) and `PageDraftTest` / `TemplateDraftTest` (values travel in the draft).

## 2. Merge

- [ ] 2.1 `SchemaGraph` merge per leaf with the `sources` map, deep objects, list selectors, clash and unmatched-selector reports, facts fill, `custom_main`. Verify with a new unit `ExtendMergeTest` (siblings merge while `offers.price` clashes; deep merge; `[*]`; `[name=Growth]`; unmatched selector; `@type` add with the Product warning; `custom_main` only on a web page; the rules run on the merged graph so G7 sees an `aggregateRating` added to `#identity`).

## 3. Sheets

- [ ] 3.1 "Add details" in Output's outline and the Add details sheet with its lint lines and the merged node's verdicts; Remove. Verify with Playwright `page.spec.ts` (sku and itemCondition added, price clash named, Output's JSON shows the merge).
- [ ] 3.2 Name feedback in both sheets from the rules file's `names`. Verify with `checks.test.ts` ("Instock" suggests "InStock"; an unknown type gets nothing).
- [ ] 3.3 The main toggle in "Add your own JSON-LD". Verify with Playwright `page.spec.ts` (shown on a web page, hidden on a product page; Output marks the item "Main").
- [ ] 3.4 Clash rows in Checks. Verify with `checks.test.ts`.

## 4. Live verdicts

- [ ] 4.1 `extension/src/features.ts` mirror and the shared fixtures under `tests/fixtures/features/`. Verify with `features.test.ts` and `SearchFeaturesTest` running the same fixtures to the same verdicts.
- [ ] 4.2 The stage uses the mirror for dialog-owned values and shows "Draft" for component values until the round trip. Verify with Playwright `schema.spec.ts` (a typed price flips the verdict before the write answers).

## 5. CI and docs

- [ ] 5.1 CI vocabulary lint of fixture graphs and one full graph per registry type, using documented names only. Verify the job green, and red on a deliberate misspelling.
- [ ] 5.2 README (for experts: Add details, selectors, what always wins); ARCHITECTURE.md §7, §17. Verify with the cspell CI job.
- [ ] 5.3 Run every suite as in `rethink-structured-data` 8.2. Verify all are green.
- [ ] 5.4 Browser check on the farm site: Add details on a product (clash and merge), a misspelt name in your own JSON-LD, the main toggle on a web page, live verdict flip. Save a screenshot of each.

## Workflow follow-up

- Archive after `rethink-structured-data`.
