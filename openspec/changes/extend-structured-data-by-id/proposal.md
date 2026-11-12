# Proposal

## Why

The product owner asked for structured data that is easy to use and
"industry leading". Leading includes the experts: today the only way to add
an SKU, an item condition or shipping details to a product is a second,
disconnected product in custom JSON-LD, the exact duplication the redesign
removes. Hand-written JSON-LD also gets no feedback on misspelt names until a
test outside the editor. This change lets experts add details to the
module's own nodes by `@id`, makes a hand-added item the page's main thing
when the page has no kind of its own, and gives the expert sheets the same
verdicts as the stage, live while typing.

## What Changes

- **Add details to ‹node›** from Output: JSON merged into the main node, the
  page node or, at Site scope, the identity, matched by `@id`. The module's
  values win **per leaf** (`offers.price` from the Price field is kept while
  `offers.itemCondition` and `offers.shippingDetails` merge), objects merge
  at any depth, lists the module emits take `offers[*]` (every item) or
  `offers[name=Growth]` (one item). `@id` and `@type` cannot change; a type
  may be added, with a warning that it does not change which search features
  fit.
- **Clashes are named by path** in the sheet and in Checks.
- **Your own JSON-LD gains** inline verdicts per item and a toggle "This is
  what the page is mainly about" (only when the page is a plain web page).
- **Name feedback** in both sheets from the property and value names the
  rules file already documents for each feature ("“Instock” isn't a value
  search engines document for availability. Did you mean “InStock”?"). No
  schema.org vocabulary is bundled.
- **Live verdicts** in the dialog for values the dialog owns, from a client
  mirror of the server's rules pinned by one shared fixture file.
- **CI** lints fixture graphs and one full graph per registry type.

## Out of scope

- A visual builder for arbitrary schema.org types.
- Changing values the module derives (edit the field, the fact or the
  component instead).
- Live verdicts for values that come from components (they refresh on
  Canvas's round trip).

No README non-goal is reopened.

## Depends on / followed by

- **Depends on** `rethink-structured-data` only. May be built in parallel
  with `read-page-components` and `set-up-types-from-templates`.
- Component-derived values (`derive-structured-data-from-components`) become
  one more origin that wins over added details.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `structured-data`: added details merged by `@id`; the main thing chosen
  among hand-added items; validation of added details.
- `seo-dialog`: the Add details sheet, the main toggle, name feedback, live
  verdicts.
- `seo-checks`: clashes between added details and the module's values.

## Impact

- **Server:** `SchemaGraph` (merge, clash report, `custom_main`), `Values`
  (`cleanExtend()`, shared 32 KB cap with custom JSON-LD).
- **Config:** `schema.extend` and `schema.custom_main` in
  `canvas_metatag.schema.yml`.
- **Client:** `Output.tsx` (Add details), `features.ts` (mirror), the sheets'
  lint lines.
- **CI:** vocabulary lint job (documented names only).
- **Docs:** README (for experts), ARCHITECTURE.md §7, §17.
