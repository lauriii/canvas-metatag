# Proposal

## Why

The product owner asked for structured data that is "industry leading". Two
questions remain unanswered after the earlier changes: "what will publishing
this change do to what machines read?" and "how does the whole site stand?".
Shopping results read prices from the page, so a price edit matters; removing
a product image can quietly stop a listing that works today. And a site
builder has no single place to see which types and pages can show which
search features, without crawling the site or paying for a separate tool.

## What Changes

- **When you publish:** inside the stage, only when the draft's structured
  data differs from the published one in a way machines read, a list of the
  changes by node and path ("Price · €89 → €95") and of verdict changes
  ("Merchant listing · Can show → Needs an image"). Template scope says the
  change in reach ("Article title, image and date 212 → 175 of 212").
- **A publish break** (a feature that can show live would stop) raises one
  amber notice whose actions are named after the cause ("Put the image back",
  "Show the image field"), or "Review changes" when several edits caused it.
  Never a bare "Undo" next to several changes.
- **Structured data overview,** an optional submodule adding a Canvas page
  extension: per content type, per Canvas page and per set-up component, what
  it is described as, its search feature lines and reach, and what is
  missing, from published output with the same verdicts as the stage. Each
  row opens the right scope in the editor. CSV export through a batch. No
  crawl, no stored history, no score.

## Out of scope

- Search console data, rankings, traffic or any external service (a README
  non-goal; not reopened).
- Stored history of verdicts over time.
- Editing from the overview.

No README non-goal is reopened.

## Depends on / followed by

- **Depends on** `rethink-structured-data` (report, verdicts) for the page
  diff; `set-up-types-from-templates` (reach route) for the template diff and
  the overview's type rows; `derive-structured-data-from-components` for the
  overview's component rows (they are hidden without it). Archive after
  `set-up-types-from-templates`: the `seo-access` delta here is written on its
  text.

## Capabilities

### New Capabilities

- `structured-data-overview`: the site-wide read-only view of structured data
  reach and its export.

### Modified Capabilities

- `seo-dialog`: the "When you publish" block and the publish break notice.
- `seo-access`: the overview route and its CSV export.

## Impact

- **Server:** `Resolver::report()` diff of draft and published graphs by `@id`
  and path, with verdicts on both; a new route
  `GET /canvas-metatag/api/overview` (paged, per-entity access, reusing the
  per-entity report cache); a batch for CSV.
- **New submodule:** `modules/canvas_metatag_overview` (Canvas page
  extension).
- **Client:** publish block and notice in the stage; the overview app.
- **Docs:** README (the overview), ARCHITECTURE.md §7, §13, §17.
