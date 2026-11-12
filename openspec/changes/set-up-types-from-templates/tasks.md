# Tasks

Needs `rethink-structured-data`, `read-page-components` and
`link-values-to-fields` groups 6–7.

## 1. What the template shows

- [ ] 1.1 `Sources::shown($template)`: fields used by template-owned instances, multi-hop sources included, item-slot components excluded. Verify with a new kernel `TemplateShownTest` (Title, Image and Authored on shown; Writer not; a slot component ignored; Writer › Name counts as Writer).

## 2. Self-setup

- [ ] 2.1 Proposer in `Resolver::report()` for an unset type: kind and links with reasons; unshown fields marked. Verify with `ApiTest::testTemplateSetupProposal` (the Article fixture gives three shown links and an unshown author).
- [ ] 2.2 Setup band and Review sheet; "Use it" writes only shown links into the template draft; bar "Every Article set up" with Undo. Verify with Playwright `template.spec.ts` (band copy; after Use it the draft has no author link; Review lists the author unticked) and `TemplateDraftTest` (the draft holds the links and the client id).

## 3. Reach

- [ ] 3.1 Route `GET /canvas-metatag/api/reach` with seo-access rules; batched `resolve()` over published items with the template's draft values; per-item and whole-answer caches with their tags; sampling above 2,000. Verify with a new kernel `ReachTest` (exact counts with a node grant hiding two items and an invalid currency on three; cache hit and invalidation on a node save; sample flag at 2,001 items) and `ApiTest::testReachAccess` (403 without update access to the template).
- [ ] 3.2 Budget. Verify with a kernel `ReachBudgetTest` at 10,000 nodes within the time agreed with the product owner.
- [ ] 3.3 Reach lines, Also helps rows (gray), "Complete on ‹n› of ‹m›", per-item degradation, Preview one with Back; reach fetched on mount and on the template's own value changes only. Verify with `checks.test.ts` (per-item rule) and Playwright `template.spec.ts` ("Also helps · Author on 175"; Preview one caption; a Canvas round trip without a value change does not call the reach route).

## 4. Parity and dropped values

- [ ] 4.1 Unshown linked field guidance with Open template and Leave ‹fact› out; modified date exempt; dropped values row with Show which. Verify with `checks.test.ts` and Playwright `template.spec.ts` (link Author to Writer by hand: the guidance appears; Leave author out unlinks it; Show which lists three products).

## 5. Authors

- [ ] 5.1 `SchemaGraph` author entries from reference fields: one per entity, `@id`, `url`, Person or Organization from the target's stored kind, inline fallback; target cache tags on the head. Verify with `SchemaGraphTest` (two authors, an unpublished one, an organization) and `ResolverTest::testAuthorReference` (tags; no nested resolve of the target).

## 6. Docs and the site

- [ ] 6.1 README (Every ‹Type›: setup, reach, what counts); ARCHITECTURE.md §3, §7, §13 (the reach cache), §17. Verify with the cspell CI job.
- [ ] 6.2 Run every suite as in `rethink-structured-data` 8.2. Verify all are green.
- [ ] 6.3 Browser check on the farm site: "Every Article" first visit (band, Review), after Use it (reach lines), Preview one, a hand-linked author the template doesn't show, "Every Product" with a typed name. Save a screenshot of each.

## Workflow follow-up

- Archive after `read-page-components`.
