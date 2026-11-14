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

Then, on 13 Nov 2026, the product owner looked at a schema editor where any
schema.org type opens as a form of its details and said: "make it easier to
fill the custom json-ld, you should either fill as form or as json (if you
want to just copy paste)". Earlier: "make sure we have a way to populate each
json+ld schema type" and "experience needs to be clean even though we're
making this more powerful". Today the most common paste fails outright: a
snippet with `@context`, a `<script>` wrapper, an `@graph` or a list of types
is refused, and the only editor is a code box. So this change also makes
"Add your own JSON-LD" (and "Add details") a form or JSON over one stored
text, opening with only what a search feature needs.

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
- **Live verdicts** in the dialog for values the dialog owns, from a client
  mirror of the server's rules pinned by one shared fixture file.
- **Form or JSON.** Both expert sheets get two tabs, Form and JSON, over the
  same stored text. Switching never changes a byte; the form edits only the
  bytes of the value it changes, and keeps every key it doesn't know. Form is
  the default and the choice is remembered per viewer.
- **A type opens with only what it needs.** The form shows empty rows only
  for what a search feature needs ("Rating count or review count" is one
  group with one sentence), then the values already set, then "Also helps"
  and one search over every other detail. A detail that is an item points at
  something on the page before "Describe it here", which opens in place.
- **Paste that works.** A script tag, a schema.org `@context`, an `@graph`,
  a list of items, blank-node ids and empty values are cleaned up on paste,
  reported in one line, and can be undone. A paste that copies what the page
  already makes is reviewed item by item before anything is added.
- **Problems with a place.** Every problem names its line and path in plain
  words with at most one fix. Red is exactly what the server refuses; advice
  is amber and never blocks a save. Unsaved text with a problem is kept for
  the next visit.
- **The server stores hand-added JSON-LD as written** (no more sorted keys),
  accepts a list of up to four types and a schema.org `@context`, refuses
  numbers that can't be output, refuses a hand-added item that takes one of
  the module's ids, and reports where a refusal is.
- **Short ids** `#identity`, `#logo`, `#website` and `#return-policy` point
  at the site's own items from any page; one list of module ids guards them.
- **Rules for ratings, reviews, Q&A, forums, image metadata, software and
  movies** in the rules file, each with what its needs must look like
  (`expects`), so a verdict never says "Can show" for a name where an
  organization is needed.
- **Name feedback** in both sheets, from the rules file's documented names,
  and from the whole schema.org vocabulary when the site has downloaded it.
  Always advice.
- **Every schema.org type** in the form once a site administrator downloads
  the vocabulary with Drush; without it, every type a search feature reads is
  fully supported and any other is edited by the shape of its values.
- **Template values can be linked.** On a content template, a value in a
  hand-added item can be linked to a field of the type (whole values only),
  with a preview of a real item, and images are chosen from the media
  library.
- **CI** lints fixture graphs and one full graph per registry type.

## Out of scope

- Changing values the module derives (edit the field, the fact or the
  component instead).
- Live verdicts for values that come from components (they refresh on
  Canvas's round trip).
- A code-editor library, folding, and Form and JSON side by side (468 px
  can't hold both).
- Importing from an address, or importing microdata or RDFa (a paste that has
  them says so).
- References to another page's items from the form (a pasted address is kept
  as written).
- AI suggestions for hand-added items (decision 9 and the rule that the
  Canvas AI tools never carry custom JSON-LD text stand).
- Hand-added items at Site scope; more than 10 items; drag-only reordering.
- Counting how many items of a type a hand-added item can show on
  (`set-up-types-from-templates` owns reach).
- Translating schema.org's own labels and definitions.
- Per-node overrides and bulk editing (README non-goals, unchanged).

No README non-goal is reopened. Plan-level decisions this change reopens are
listed below.

## Decisions this relies on

- **Product owner, 2026-11-13: hand-added JSON-LD can be filled as a form or
  as JSON.** The lead took the recommended option for each question it raised
  (PO-DECISIONS item 11):
  1. **Reopened: "a visual builder for arbitrary schema.org types" (was out
     of scope here) and "no schema.org vocabulary at runtime" (was a
     non-goal here and in `rethink-structured-data`).** Yes, inside the two
     expert sheets only; the main path stays kinds, verdicts and the
     read-back. `populate-every-schema-type`'s "no general nested-object
     editor" and "no Add item repeater" now cover the registry's facts only.
  2. **The vocabulary is downloaded by the site** (`drush
     canvas-metatag:vocabulary`) from schema.org, because it is CC BY-SA 3.0
     and the module is GPL-2.0-or-later; nothing is redistributed. The module
     ships only its own one-line descriptions of the types its rules file
     documents.
  3. **Hand-added JSON-LD is stored as written**, no longer with sorted keys,
     so what you save is what you reload.
  4. **`@type` may be a list** of one to four types, and a schema.org
     `@context` is accepted and left out of the output.
  5. **Decision 3 ("typed lines of repeating content are never allowed")
     governs the module's own facts.** Hand-added JSON-LD could always repeat
     anything; the form only shows it.
  6. **Field links inside hand-added items on templates: yes**, as whole
     values, filled through the same field sources as every other link.
  7. The sheet keeps its name "Add your own JSON-LD"; Form is the default
     tab.
- **Decision 2:** neutral wording; source addresses of the new rules only in
  `data/search-features.json`.
- **Decision 8:** the usability gate is replaced by an independent agent's
  first-time walkthrough, recorded as a substitute.
- **Decision 9:** nothing here calls an AI provider.

## Depends on / followed by

- **Depends on** `rethink-structured-data` (rules file, verdicts, Output,
  the renamed sheet, `schema.skip`), `link-values-to-fields` (linked boxes,
  link menu, field sources) and `populate-every-schema-type` (shape-driven
  controls, reference select, code picker, duration box). All three run
  before this change. May be built in parallel with `read-page-components`
  and `set-up-types-from-templates`.
- **Followed by:** `read-page-components` adds `#breadcrumb` to the module id
  list; `set-up-types-from-templates` counts reach for hand-added items too;
  `derive-structured-data-from-components` stores a component main thing in
  the same `schema.main` key and makes component values one more origin that
  wins over added details; `add-advanced-meta-tags` reuses the paste review.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `structured-data`: added details merged by `@id`; the main thing chosen
  among hand-added items; validation of added details; hand-added JSON-LD
  stored as written with type lists and a pasted context; module ids and
  short ids; whole-value links and media; what an empty link leaves out;
  bounded output; the downloaded vocabulary.
- `seo-dialog`: the Add details sheet, the main toggle, name feedback, live
  verdicts; Form and JSON tabs; type search; needs-first form; references and
  nested items; value controls; paste clean-up and review; problems; the
  item list; unsaved drafts; translations; template links; levels and
  keyboard.
- `search-features`: what a needed value must look like; rules for ratings,
  reviews, Q&A, forums, image metadata, software and movies.
- `seo-checks`: clashes between added details and the module's values;
  hand-added links that can't fill; structured data left out of the head.
- `head-output`: a structured data value that can't be encoded never removes
  the other tags.

## Impact

- **Server:** `SchemaGraph` (merge, clash report, `schema.main`, module id
  list, short ids, whole-value fills, empty-link rules, output cap), `Values`
  (`cleanExtend()`, custom JSON-LD stored as written, type lists, context,
  finite numbers, scheme rule, module id and duplicate id refusals,
  `error_paths`), `CanvasMetatagHooks::head()` (fails closed for JSON-LD),
  new `Vocabulary`, `VocabularyController`, a Drush command and a
  requirements line; one post-update.
- **Data:** `data/search-features.json` (new entries with `about`,
  `expects`, `say`, `confirm`).
- **Config:** `schema.extend` and `schema.main` in
  `canvas_metatag.schema.yml`; the post-update re-formats stored custom
  JSON-LD on pages and templates (a one-time config diff for templates).
- **Client:** `Output.tsx` (Add details), `features.ts` (mirror), a new
  `extension/src/custom/` (sheet, tabs, form, JSON view, paste, problems,
  drafts), `jsonc-parser` (MIT, about 6 KB gzip) as the one new library, a
  bundle budget in CI.
- **CI:** vocabulary lint job (documented names and `expects`).
- **Docs:** README (for experts: Add details, selectors, what always wins,
  form or JSON, the vocabulary download and its licence), ARCHITECTURE.md
  §7, §17.
