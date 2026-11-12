# Design

## Context

See proposal.md for why. `Resolver::resolve()` can resolve an entity's draft
or published state; `report()` adds verdicts. `set-up-types-from-templates`
adds a cached reach route computed from published items. Canvas offers page
extensions (`canvas_metatag.canvas_extension.yml` registers the dialog as one
today).

## Goals / Non-Goals

**Goals:** the publish diff says only what machines read differently; the
overview is cheap, read-only and uses the stage's verdicts.

**Non-Goals:** history, crawling, external data, scores.

## Decisions

### 1. The diff

`report()` resolves the draft and the published graph and diffs them by
`@id` and path, ignoring `dateModified` and ordering. Items inside a part are
addressed by path (`offers[1].price`). Verdicts are computed on both; a
feature that is `ready` or `complete` live and not in the draft is a break.
At template scope, the draft's reach is compared with the published reach
from the cached reach route.

*Alternative:* diff the JSON text (rejected: ordering and dates would make
every save look like a change).

### 2. Break actions are named after their cause

The diff knows which path caused the break. When one path did, the notice
offers to restore that value ("Put the image back", from the published
value) and to show its field; when several did, "Review changes" scrolls to
the block. Restoring writes the published value into the draft as any field
edit does.

### 3. The overview

A submodule `canvas_metatag_overview` registers a Canvas page extension and a
route `GET /canvas-metatag/api/overview?view=types|pages|components&page=N`.
Rows use published output: types from the reach route; Canvas pages from each
page's cached report; components from mapping usage. Access is checked per
entity; rows the user may not update are counted but not opened. Drafts are
read per row on demand only. CSV export runs through the Batch API and
streams a file of the same columns.

*Alternative:* computing over drafts by default (rejected: an auto-save
load and a resolve per entity per request).

## Canvas internals relied on

The page extension registration (already used by the dialog). No new
internal.

## Risks / Trade-offs

- [Large sites] → paged rows, cached reports, batch export.
- [The diff is noisy] → machine-read paths only; dates of modification
  ignored.
- [A restore conflicts with a newer editor change] → it goes through the
  draft-writes conflict rule.

## Migration Plan

Nothing stored. The overview is an optional submodule; enabling it adds the
extension.
