# Proposal

## Why

The product owner: "make sure we have a way to populate each json+ld schema
type" and "start implementing these schemas and additional types", under
"experience needs to be clean even though we're making this more powerful".

Today the registry has ten types, about thirty properties and six value kinds
(text, url, date, number, enum, image). It has no lists, nested objects,
references, durations, opening hours, codes or ranges. A job posting, a
recipe, a local business page or an event with a linked venue can't be
described without hand-written JSON, and a multi-value field silently gives
its first item. This change adds a few value shapes and the types they make
possible. It also adds a contract test that keeps every offered type fully
populated without JSON.

## What Changes

- **Value shapes, not a long list of kinds.** Two new kinds: `ref` (a link
  to the publisher, another page's main thing, or a name) and `hours`
  (opening hours). One flag, `list` (several values, only from a multi-value
  field or one long text's own list items or lines, never typed). One
  container, `group`, built from shared shapes: address, venue, who, money
  (pay), geo, one ticket type and nutrition. Attributes on existing kinds:
  `codes` (countries), `emit` (an enum as a schema.org URL, a bare code or
  the node's type), `unit` for durations, `item`, `join`, `pair`, `html`
  (the job description, filtered), `inline` (a target's address) and
  `scopes` (where a prop is offered, and why not elsewhere).
- **New types:** Job posting (on templates), A place people visit (a local
  business or a venue), Recipe, Course, and a list page (ItemList).
- **Deeper existing types:** Event venue as one box that opens a sheet,
  linked part by part or to a venue page on a template, with one ticket
  type and (on templates) performers. Article authors and images, and
  profile links, as lists. Product images as a list.
- **Calm controls.** A group reads as one box and opens a sheet, which says
  what it misses once. Codes and currencies use a searchable picker, and six
  or fewer choices are checkbox rows. Durations use one box with two
  numbers, and read in their unit when linked. Opening hours are a week, a
  day per row. At most four facts sit above More details. There is no "Add
  item" repeater for the registry's facts (hand-added items get a form, with
  lists, in `extend-structured-data-by-id`).
- **Honest defaults.** The publisher is the organizer or recipe author by
  default on a Canvas page, where the sentence shows it and Checks notes it;
  choosing "Someone else" is kept. On a template the publisher is answered
  once per type; event templates that relied on the old default keep the
  site as their organizer through a post-update. A country is suggested,
  never assumed. No ratings, estimates or invisible content.
- **Coverage contract.** A data-driven PHPUnit and vitest test over the
  registry fails if any property of any offered type lacks a non-JSON way
  in on a scope where the type is offered. One graph fixture per type and
  scope in `tests/fixtures/graphs` reaches its verdict with no custom
  JSON-LD, checking emitted values against each feature's rules.
- **Report and Checks:** dropped list items, incomplete groups (with what a
  feature asks more of them, in one row), references that fell back to a
  name, untouched defaults, a recipe time without its pair, and pay From
  above To.

## Out of scope

- Moved out after the round 1 review (16 Nov 2026), so that what archives
  is what ships: "Link all parts to", the page picker for Canvas pages and
  its search route, linked pairs and their readings, and decimals one
  reference away (`link-groups-and-pick-pages`); product variants and the
  return policy at Site (`describe-product-variants-and-returns`); "At
  ‹Site›'s address", a profile about the publisher and "Same as ‹Site›"
  (`describe-the-publisher`, H2). Until the page picker ships, a venue or
  workplace page is linked on templates only; a Canvas page fills the group
  from its own parts. Round 3 moved the `{node}` value with it (its
  acceptance, `Resolver::picked()`, its config schema key and the dialog's
  tag): until then a page pick is refused at save.

- Typed lists of repeating content (ingredients, steps, performers, several
  ticket types, list items) on Canvas pages. They come from components, by
  amendments D1–D4 to `derive-structured-data-from-components`. Until then
  those props are not offered on Canvas pages.
- Job postings on Canvas pages (the description is linked only; D5).
- Video and image licence routes (handed to derive, H3). Self-setup
  proposals for the new kinds (handed to `set-up-types-from-templates`, H1).
  The identity's address, hours and coordinates (handed to
  `describe-the-publisher`, H2).
- Ratings, reviews, user-generated and retired types, partner programmes and
  merchant-account configuration. These stay on the expert path.
- Per-node overrides and bulk editing (README non-goals, unchanged).

## Follow-ups (from the gate, 17 Nov 2026)

- In a window 350 px high, a code picker whose box sits mid-frame opens
  with its filter and footer in the frame (as the spec asks) but no list
  rows: there is no room left for them on either side. Typing a code and
  Enter still pick, so keyboard use works; pointing does not. Not fixed here
  because making room means either scrolling the dialog further than its
  content allows or overlapping the box, both a design call for a later
  change.

## Decisions this relies on (product owner, 13 Nov 2026)

- **Decision 3, reopened README non-goal:** repeating structured data, only
  for lists from set-up components or multi-value fields mapped by this
  change. This change narrows the README line for multi-value fields, and
  derive adds components. Read as: choices of codes are not repeating
  content, and typed lines of repeating content are never allowed. One long
  text's own `<li>`/`<p>` items count as a multi-value source, because they
  are structure the editor made.
- **Decision 2:** neutral wording ("In search results"); source addresses
  only in `data/search-features.json`.
- **Product owner, 2026-11-13: hand-added JSON-LD can be filled as a form or
  as JSON** (decisions.md, item 11, built in `extend-structured-data-by-id`).
  Read with it: decision 3's "typed lines of repeating content are never
  allowed" governs the module's own facts. Hand-added JSON-LD could always
  repeat anything; extend's form only shows it. This change's controls take a
  shape so that form can reuse them; nothing in the coverage contract counts
  hand-added JSON-LD as a route.
- **Decision 8:** the human usability gate cannot run here; a first-time
  walkthrough by an independent agent replaces it, recorded as a substitute
  (tasks 9.3).
- **Decision 6:** Plans for a service stays the kind for memberships and
  several plans.
- **Decision 9:** new props are `ai: false` except plain text, and AI tests
  use the echo/test providers only.

## Decisions for the product owner (the specs follow each recommendation)

1. Decimal fields linkable for numbers (the module's own rows next to
   Canvas's). Recommended: yes.
2. Job description as filtered HTML, linked only, as the job feature asks.
   Recommended: yes.
3. Duration unit asked once when a field is linked. Recommended: yes.
4. A place people visit beside an identity that is itself a local business:
   keep both addresses. Recommended: keep both.
5. "A venue (not a business)" as a place kind, so venue pages can be linked
   by `@id`. Recommended: yes.
6. One long text's list items (or a plain text's lines) as list entries.
   Recommended: yes.
7. The publisher as an explicit once-per-type answer on templates, with a
   post-update that keeps the site as the organizer of event templates that
   never set one. Recommended: yes.
8. A venue is complete with its name or its address (the event feature
   recommends the name; it does not require it), so that no event that
   ships today is withheld after the update. Recommended: yes. Round 3: an
   event could ship with only a street; its venue, without a name and with
   no country (or one written as a name), is set but incomplete, and a
   required group that has values never withholds: the venue is left out
   and asked for, the Event kept. A post-update
   (`canvas_metatag_post_update_country_codes`) stores a venue country
   written as a name or a code ("Finland", "fi") as its code.

Variants on templates and a page picker on Canvas pages were decisions of
this change before round 1; they moved with their work (see Out of scope).

Change-level out-of-scope line this reopens: `describe-the-publisher`'s "a
kind for a local business page".

## Depends on / archive order

- **Depends on** `link-values-to-fields` (values, linked boxes, link menu,
  Sources) and `rethink-structured-data` (kinds, verdicts, read-back, rules
  file, report).
- **Archive right after `rethink-structured-data`.** The `structured-data`
  and `seo-dialog` MODIFIED blocks are written on rethink's text, and the
  `dynamic-values` block on link-values' text.
- **Later changes rebase onto this one** (design.md "Hand-overs"):
  `set-up-types-from-templates` (H1: self-setup rules; its author
  requirement becomes a case of `ref`), `describe-the-publisher` (H2: the
  shapes), `derive-structured-data-from-components` (D1–D7 mapping kinds,
  H3 video and image licence, H4: rebase its "Page types come from one
  registry"). `read-page-components` and `extend-structured-data-by-id`
  need no change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `structured-data`: new types, lists, groups and shapes, references,
  durations, hours, enum emission, scopes, the job description filter, the
  list page.
- `search-features`: job posting, recipe, local business on a page, course
  list, and value rules.
- `seo-dialog`: summary boxes and sheets, the choice of who, code and
  currency pickers and checkbox rows, the duration input, the opening hours
  sheet, what each scope offers, the unknown-kind example.
- `value-links`: list rows, the linked group box, the publisher row, the
  unit question.
- `dynamic-values`: every item of a multi-value field on list props, one
  long text split at its items or lines, decimal fields.
- `seo-checks`: the new structured data rows.
- `ai-suggestions`: proposals for the new types are plain text only.

## Impact

- **Data:** `data/schema-types.json` (shapes, groups, new types and props,
  attributes), `data/search-features.json` (new features and value rules),
  `data/codes/country.json`, `tests/fixtures/graphs/*.json`,
  `tests/fixtures/hours.json`.
- **Server:** `SchemaGraph` (expansion, `offered()`, kinds, groups, emit,
  `filterHtml()`, new nodes, report members), `Values` (lists, refs,
  units, scopes, "Someone else" not named yet; a `{node}` page pick is
  refused until the page picker ships),
  `Resolver` (ref targets, ancestor map, inline addresses), `Sources`
  (lists, long-text split, decimal rows), `RegistryStrings`, and the
  post-updates `canvas_metatag_post_update_event_organizer` and
  `canvas_metatag_post_update_country_codes`.
- **Config:** `canvas_metatag.schema.yml` (new value forms).
- **Client:** `SchemaTab.tsx` (summary box, sheets, the choice of who, code
  and currency pickers, checkbox rows, duration input, week editor),
  `Controls.tsx`, `controls.ts`, `checks.ts`, `model.ts`, `values.ts` (the
  link menu).
- **Canvas internals:** none new. Decimal rows are the module's own and
  carry a contract test that fails when Canvas starts matching decimals.
- **Docs:** README (types, the non-goal line), ARCHITECTURE.md §7, §11 and
  §17.
