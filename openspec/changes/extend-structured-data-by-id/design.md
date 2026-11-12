# Design

## Context

See proposal.md for why. Custom JSON-LD (`schema.custom`) is validated when
saved (32 KB, up to 10 objects, depth 8, no `null`, safe schemes), re-encoded
with sorted keys and appended after the module's nodes; a node that takes a
module `@id` is dropped. After `rethink-structured-data`, `report()` returns
`features`, `rules` and `sources` (where each value came from), and
`search-features.json` carries documented `names` per feature type.

## Goals / Non-Goals

**Goals:** experts can say everything a feature documents about the module's
own nodes without a second node; nothing they add can overwrite what the page
says.

**Non-Goals:** removing a value the module emits; a schema.org vocabulary at
runtime (licence question open; CI only).

## Decisions

### 1. Storage

`schema.extend`: `{ "#primary" | "#webpage" | "#identity" (site): "<json>" }`.
Cleaned by `Values::cleanExtend()` with the custom JSON-LD rules, plus: keys
may carry one selector suffix `[*]` or `[name=…]`; `@id` and `@type` may not
be set except `@type` as a list that contains the node's type. The 32 KB cap
is shared with `custom`. `schema.custom_main`: the `@id` of one custom item.

### 2. Merge in `SchemaGraph`

After the main thing and before custom nodes:

- walk the added JSON; for each leaf path, if `sources` says the module
  emits it, keep the module's value and report a clash `{node, path, kept,
  ignored}`; else set it;
- objects merge at any depth; a list the module emits accepts only selector
  keys (`offers[*]` merges an object into every item, `offers[name=X]` into
  the item named X; a selector that matches nothing is reported);
- `@type` add-only, with a warning when the node is a Product;
- the facts-only `{name}` fill applies as in custom JSON-LD;
- the merged graph is what `features()` and the rules evaluate.

*Alternatives:* one-level merge with whole keys refused (rejected by review:
it refuses all of `offers`, where the expert's needs live); letting added
values win (rejected: the page would stop matching its markup).

### 3. A hand-added main thing

When `custom_main` names a custom item and the kind is a plain web page, the
page node's `mainEntity` references it and the item gets
`mainEntityOfPage`. With any other kind the toggle is hidden and a stored
value is ignored and reported.

### 4. Name feedback

The sheets compare keys and enum values of items whose `@type` matches a
feature's `on` types against that feature's `names`, case-insensitively, and
suggest the documented spelling. Unknown keys on types no feature documents
get no feedback.

### 5. Live verdicts

`extension/src/features.ts` mirrors `features()` on the `/state` graph
patched with the dialog's unsaved values by path. One fixture file
(`tests/fixtures/features/*.json`) is run by `SearchFeaturesTest` and
`features.test.ts`, so both agree. Component-derived values are not
patched; the stage shows "Draft" until Canvas's round trip.

## Risks / Trade-offs

- [Merge surprises] → the sheet shows the merged node's verdicts and every
  clash by path before saving.
- [Mirror drifts from PHP] → the shared fixtures fail CI.
- [32 KB shared cap] → the sheet shows bytes left.

## Migration Plan

New keys only. Rollback: remove `extend` and `custom_main` before
downgrading; the previous cleaners refuse unknown keys on the next write.

## Canvas internals relied on

None.
