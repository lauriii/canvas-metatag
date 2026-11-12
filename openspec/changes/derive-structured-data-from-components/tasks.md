# Tasks

Needs `rethink-structured-data` and `read-page-components`, and the product
owner's go (proposal.md, "Non-goals reopened"). Start only after
`read-page-components`' budget gate passed.

## 1. Mapping storage

- [ ] 1.1 Config entity `canvas_metatag.component_mapping` with schema, dependency on `canvas.component.<id>`, `onDependencyRemoval()`, per-version items and a cache tag added only to heads that contain the component. Verify with a new kernel `ComponentMappingTest` (deleting the component removes the mapping; config import order; a head without the component lacks the tag).

## 2. Proposals and the Set up sheet

- [ ] 2.1 Proposals from prop shapes and config prop titles (plans with monthly and annual offers, video, questions, image licence; unused props named). Verify with a new unit `MappingProposalTest` on the farm site's `js.pricing-table` schema exported as a fixture.
- [ ] 2.2 Site › Components list (usage counts from `Sources::usage()`, versions in use) and the Set up sheet with the effect of saving; "Automatically" hidden for goods; administrators only. Verify with Playwright `site.spec.ts` (list rows; Save and apply to 3 places; an editor sees no Components) and `ApiTest::testMappingSaveEffect`.

## 3. Parts and the main thing

- [ ] 3.1 `SchemaGraph` parts at `{url}#c-{uuid}`, `hasPart`, offers attached only under a confirmed accepting kind, `left_out` otherwise, per-version items with `skipped_parts`. Verify with `SchemaGraphTest` (two pages sharing a UUID get two ids; an unconfirmed pricing page has no Service; a newer version drops Starter) and `IdsSnapshotTest`.
- [ ] 3.2 `Proposer::suggest()` in `report()`: order of preference, header/footer and text-only components ignored, ties to the earliest, Service for pricing unless set up as goods, `mode: auto` read from component ids at delivery. Verify with a new unit `ProposerTest` and `DeliveryPathTest` (the proposer is not called at delivery except the auto check).
- [ ] 3.3 `schema.main`, inherited by translations; `main_missing`. Verify with `ResolverTest::testMainPart` (a French translation inherits; a removed component withholds the main node).
- [ ] 3.4 `VideoPage` type and the `video` rules entry with the watch-page rule. Verify with `SearchFeaturesTest` (not shown here; needs a thumbnail) and `SchemaGraphTest`.

## 4. Dialog

- [ ] 4.1 Suggestion band with the bought-here question for products, Looks right and Change…; none on non-default translations. Verify with Playwright `schema.spec.ts` on `/pricing` (band copy; Looks right stores Service; Undo).
- [ ] 4.2 Component boxes, Select in page through the editor route, the selection strip through `canvas:data:subscribe:selectedComponentUuid`, item-slot copy. Verify with Playwright `host-contract.spec.ts` (selection message received; route navigation selects the instance) and `schema.spec.ts` (pressing a plan selects the table and announces it).
- [ ] 4.3 Mostly about and "It also shows". Verify with Playwright `schema.spec.ts` on the farm home page.
- [ ] 4.4 Checks rows: component changed (builder and editor copy), not set up (builders only), main part gone. Verify with `checks.test.ts`.
- [ ] 4.5 Server-side parity from component props when there is no preview document. Verify with `HeadlessHeadTest::testComponentParity`.

## 5. Docs and the site

- [ ] 5.1 README (components that describe themselves; the "repeating structured data" line changed after sign-off); ARCHITECTURE.md §7, §11 (selection message, editor route, prop titles), §13, §17. Verify with the cspell CI job and that every §11 row names its test.
- [ ] 5.2 Usability gate: five marketers on the suggestion band; at least four catch a seeded wrong price from the read-back. Verify by recording the result in proposal.md.
- [ ] 5.3 Run every suite as in `rethink-structured-data` 8.2 plus the Canvas contract job. Verify all are green.
- [ ] 5.4 Browser check on the farm site: Site › Components, Set up Pricing table with its save effect, `/pricing` band then confirmed, Select in page, the home page with Mostly about, a page on a newer component version. Save a screenshot of each.

## Workflow follow-up

- Archive after `read-page-components`; its `structured-data` delta is
  written on `rethink-structured-data`'s text of "Page types come from one
  registry".
- File UPSTREAM(canvas): a `canvas:select` extension message.
