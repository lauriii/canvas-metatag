# Tasks

Needs `rethink-structured-data` and `link-values-to-fields` groups 6–7. The
reader has no visible effect until group 3.

## 1. Contract fixtures (no caller yet)

- [ ] 1.1 Extend `SeoFixtureTrait` with an article template that has one exposed slot, a component with two versions (prop `price` renamed `monthlyPrice`), a media image prop, a personalization switch with a default and a second case, a page region with a breadcrumb block, and a component that throws. Verify existing kernel tests still pass.

## 2. The reader

- [ ] 2.1 `Sources::tree()` and `instances()` (template, item slot, page, regions; owner and version). Verify with a new kernel `SourcesTreeTest` in `@group canvas_metatag_canvas_contract`: the slot component appears on its own article only; owners are right; a page's own tree and the regions are read.
- [ ] 2.2 Per-version prop definitions and `skipped_parts{reason: prop-missing, prop, version}`. Verify with `SourcesTreeTest` (two pages, two versions, both read; a missing prop reported).
- [ ] 2.3 Evaluation through `Sources::evaluate()`; images through their entity and `Resolver::mediaImage()` / `fileImage()`. Verify with `SourcesTreeTest` (an unpublished reference empty on a public page; an image absolute, public, sized, with no width parameter).
- [ ] 2.4 Guards: personalization default case only; per-instance and boundary catch; per-user, session or expiring values left out and reported. Verify with `SourcesTreeTest` (the second case skipped as `personalized`; a throwing component reported as `error` while `CoupledHeadTest` still finds the head; no `user` context on the head).
- [ ] 2.5 `Sources::usage()` counting default revisions and templates only. Verify with `SourcesTreeTest` (a non-default revision not counted).
- [ ] 2.6 Budget: a kernel `ComponentBudgetTest` (20 mapped instances warm at delivery) and a timing note for HTTP `/state` cold and warm recorded in ARCHITECTURE.md §13. Verify the test passes within the agreed budget and the product owner signs off the numbers in proposal.md.
- [ ] 2.7 ARCHITECTURE.md §11: one row per internal in design.md, each naming its `SourcesTreeTest` case. Verify every named test exists and the Canvas contract CI job is green.

## 3. Breadcrumbs

- [ ] 3.1 `Resolver` asks the breadcrumb builder for the route when a breadcrumb block renders; `SchemaGraph` adds `{url}#breadcrumb` and the page node's `breadcrumb`; `#breadcrumb` reserved for custom nodes by adding `breadcrumb` (page-anchored) to `SchemaGraph::MODULE_IDS` from `extend-structured-data-by-id`, so saving a hand-added `#breadcrumb` is refused and the post-update rule renames stored ones. Verify with `SchemaGraphTest` (four items, last without `item`; no list without the block; a stored custom `#breadcrumb` dropped and reported), `ModuleIdsTest` (the breadcrumb id is on the list) and `ValuesTest` (a new hand-added `#breadcrumb` refused) and `ResolverTest::testBreadcrumb` (absolute links on the public base, cache tags of the tree).
- [ ] 3.2 `breadcrumb` entry in `data/search-features.json` and the regenerated strings. Verify with `SearchFeaturesTest` (four items can show; one item needs 2 items) and the strings CI job.
- [ ] 3.3 The Schema view shows the "Breadcrumb" line and Output lists the node with origin "This page". Verify with Playwright `schema.spec.ts` on a farm page that renders a breadcrumb.
- [ ] 3.4 Headless: the content API's structured data carries the same list. Verify with `HeadlessHeadTest::testBreadcrumb`.

## 4. Component values in the page match and Checks

- [ ] 4.1 The report's `sources` mark component-derived values; `checks.ts` compares them with the page and lists skipped components to builders. Verify with `checks.test.ts` (a hidden plan not found; a skipped prop row only for site administrators).

## 5. Docs and the site

- [ ] 5.1 README: breadcrumbs only where they show; the non-goal line changed after the product owner's sign-off; known gap for themes that alter the trail. ARCHITECTURE.md §7 and §17. Verify with the cspell CI job.
- [ ] 5.2 Run every suite as in `rethink-structured-data` 8.2 plus the Canvas contract job. Verify all are green.
- [ ] 5.3 Browser check on the farm site: a page with a breadcrumb (Schema line, Output row), a page without one, and the Checks row for a skipped component as an administrator. Save a screenshot of each.

## Workflow follow-up

- Archive after `rethink-structured-data` (its `search-features` capability
  must exist first).
- File UPSTREAM(canvas) issues: a public "component instances of an entity,
  resolved for an account" API; support for several exposed slots without
  breaking the injection contract.
