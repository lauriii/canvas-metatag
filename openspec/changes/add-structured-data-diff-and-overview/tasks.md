# Tasks

The page diff (group 1) needs only `rethink-structured-data` and may ship
first. Groups 2–3 need `set-up-types-from-templates`.

## 1. Page diff

- [ ] 1.1 `report()` diff of draft and published graphs by `@id` and path, ignoring modification dates and order, with verdicts on both and the causing paths of a break. Verify with a new kernel `PublishDiffTest` (price change listed, no break; image removed is a break caused by `image`; a reorder and a new `dateModified` give no change).
- [ ] 1.2 Stage block "When you publish" and the break notice with named actions; "Put the image back" writes the published value into the draft; "Review changes" when several paths caused it. Verify with Playwright `schema.spec.ts` (notice copy; restore clears it) and `PageDraftTest` (the restore follows the conflict rule).

## 2. Template diff

- [ ] 2.1 Template scope: draft reach compared with the cached published reach. Verify with `ReachTest::testDraftAgainstPublished` and Playwright `template.spec.ts` ("212 → 175 of 212").

## 3. Overview

- [ ] 3.1 Submodule `canvas_metatag_overview` with its info file, page extension registration and route; access per the seo-access delta. Verify with a new kernel `OverviewAccessTest` (403 for an editor; restricted rows counted, not opened).
- [ ] 3.2 Rows for types (reach route), Canvas pages (cached reports, paged) and set-up components (hidden without `derive-structured-data-from-components`), published output by default and a draft per row on demand. Verify with a new kernel `OverviewTest` (fixture counts match the stage's verdicts for the same entities; paging).
- [ ] 3.3 CSV export through the Batch API. Verify with `OverviewTest::testExport` (one row per page on 10,000 fixture pages within the batch budget).
- [ ] 3.4 The overview app (summary tiles, table, Open). Verify with a new Playwright `overview.spec.ts` (rows, Open lands on the Schema view of the right scope, axe scan).

## 4. Docs and the site

- [ ] 4.1 README (the overview; what it does not do: no crawl, no history, no score); ARCHITECTURE.md §7, §13, §17. Verify with the cspell CI job.
- [ ] 4.2 Run every suite as in `rethink-structured-data` 8.2. Verify all are green.
- [ ] 4.3 Browser check on the farm site: a product draft that removes its image (notice, restore), a price change, a template change with its reach, the overview's three views and an export. Save a screenshot of each.

## Workflow follow-up

- Archive after `set-up-types-from-templates`; the `seo-access` delta here is
  written on its text of "Each route has its own access".
