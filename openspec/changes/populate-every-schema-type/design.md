# Design

## Context

See proposal.md for why. After `link-values-to-fields`, a value is exactly
one of `{text}`, `{fact}`, `{media}` or `{source}`. A template value may be
linked to a Canvas entity-field source that `Sources` evaluates, and the
dialog shows linked boxes and a link menu. After `rethink-structured-data`,
types are kinds with sentences, verdicts come from `data/search-features.json`,
`build()` reports what it dropped or withheld, and the report is computed
apart from delivery.

Today `SchemaGraph::value()` resolves one string per property, with a
key-prefix path walk (`nested`) for nested nodes. A multi-value field gives
its first item. Every enum becomes `https://schema.org/<Value>`.

Two reviews shaped this design: a structured-data expert's and a site
builder's. The fixes they asked for are in the decisions below: enum
emission, workplaces with addresses, reference matching, the job description
filter, recipe steps, defaults, deduplication, the group box keys, linked
pairs, and the speed of setting up a type.

## Goals / Non-Goals

**Goals:** every offered type reaches its feature without custom JSON-LD;
the dialog stays one column of one-line values; nothing is populated from
content visitors can't see; nothing is stated about the site that the page
doesn't say.

**Non-Goals:** typed repeaters; a general nested-object or JSON editor;
parsing free text into addresses, hours, prices or durations; estimates;
reverse queries at delivery; per-node overrides; component mapping kinds
(derive owns them, D1–D7).

## Decisions

### 1. Value shapes, not many kinds

Two kinds are new: `ref` and `hours`. `list` is a flag, `group` a container,
and the rest are attributes on existing kinds. A country is an `enum` with
`codes: country` (labels from `Intl.DisplayNames`, one static code file). A
duration is a `number` with a `unit`, emitted as ISO 8601. Each attribute has
one PHP reader and one TS reader, and `RegistryTest` pins them all.

*Alternative:* a kind per schema.org shape (address, money, duration,
country, opening hours, offer…). Rejected: twice the controls, and every
kind needs its own link rules.

### 2. `scopes`: offered only where it can be filled

A type or prop lists the scopes where it is **not** offered, with a reason:
`component` (the only route is a mapping derive hasn't added yet) or `policy`
(variants on Canvas pages, image licence on templates). `offered()` is read
by `Values::clean()` (refuse), the vocabulary and the client (don't show),
and the coverage contract. When derive adds a mapping kind, it removes the
`component` entry, and the contract checks the new route.

Offered in this change: Article, Profile, Event, Product, Service, Recipe,
Course and A place people visit on both scopes. Job posting, the list page,
Recipe ingredients and steps, and Event performers are offered on templates
only.

### 3. The coverage contract

`CoverageContractTest` (unit) iterates `SchemaGraph::types()` and the rules
file. For every type and every scope where it is offered:
- every offered prop, through groups and shapes, has a non-JSON route on
  that scope:
  - a typed control (`validLiteral()` accepts some literal for its kind and
    attributes, and it is not a text list or `link_only`);
  - a fact or identity default, or an automatic reference;
  - on templates, a link kind (`Sources::kindsFor()`) or a typed-once value
    when it isn't `per_item`;
- every feature-required path maps to a prop offered on that scope, unless
  the feature is `not_here` there by policy;
- a fixture `tests/fixtures/graphs/<type>.<scope>.json` exists (registry
  ids, such as `LocalBusiness.page.json`; extra cases add a variant,
  `<type>.<variant>.<scope>.json`).

`coverage.test.ts` (vitest) runs the same walk over the registry the client
receives. Every offered prop has a control (`controlFor()`), and every
linkable kind has a link-menu filter. Both sides read the same fixture list.

`PopulateEveryTypeTest` builds each fixture with empty `custom` and `extend`.
It compares the graph and verdict, and checks every emitted value against
the feature's value rules, so a URL where a code belongs fails.

### 4. Lists

`Sources::evaluate()` stops taking the first item on `list` props. One long
text on a text list splits at its `<li>` items, else its `<p>` paragraphs,
else its lines. A short single value is offered disabled ("One value, not a
list"). Duplicates are removed only from identity-like lists: references,
URLs, images, codes and profile links. A typed value is several codes, or
one url, image or reference; it is never a text list. A list never holds a
group.

### 5. Groups and shapes

`$shapes` (address, money, pay, geo, venue, tickets, nutrition, variant) are
expanded at load into flattened leaf keys, as today's `nested` paths are. So
page match, reach, `sources` per leaf and clashes stay per leaf. A shape fixes
leaf order. A group is emitted only when its `requires` resolve; otherwise it
is reported `incomplete`. `pay` emits `value` for one amount and drops From
above To. `tickets` maps Presale to `PreOrder`, and "Not on sale yet" to
`validFrom` with no availability. A `suggest` (the publisher's country) has
no PHP reader, so it is never emitted.

### 6. References

`Resolver` builds `ctx.refs` from the entities the source already loaded, or
from a `{node}` page pick. For each target it gives the label, the public
URL, published and anonymous-view state, the stored kind (read against an
ancestor map from the registry's own kinds, so a Restaurant is a Place and an
Organization), the profile's main entity (or `#identity` when the profile is
about the publisher), the `inline` address, and the cache tags. It reads
config only: it never renders a target, and it follows only one `inline` hop.

Emission:
- the publisher → `{home}#identity`;
- an accepted public target → `{@id, @type, name, url[, address]}`;
- anything else → `{@type: as, name}`.

A job workplace "at the publisher's address" emits an inline `Place` with the
identity's address, never an `@id` to the identity. Every `@id` is absolute.

*Alternative:* resolve the target's graph (rejected: recursion, cost, and
cache fan-out).

### 7. Honest defaults

On a Canvas page the organizer, employer and a recipe's author default to the
publisher. The sentence shows it, and the report's `defaults[]` feeds a
good-to-know Check until the field is touched. On a template nobody's
default is assumed: the field reads "Not set" and the menu offers the
publisher first. A job type reads "Needs an employer" until answered.

### 8. The job description is filtered HTML, linked only

The JSON-LD script is already encoded with `JSON_HEX_TAG | JSON_HEX_AMP |
JSON_HEX_APOS | JSON_HEX_QUOT`, so markup in a string can't end the script
element. The trust boundary is `SchemaGraph::filterHtml()`. It takes the
processed text and keeps `p ul ol li br strong em a`, with `href` only when
it is absolute http(s); everything else is stripped. It has its own hostile
test. The description is never typed and never proposed by AI, so job
postings are offered on templates only until D5.

### 9. Durations, pairs, hours

A duration is typed as whole units. A linked one stores `unit` beside its
`{source}`, asked once in the link menu. `pair` makes `build()` emit prep and
cook time together or not at all. Hours use one grammar shared by PHP and TS
with one fixture file:
- weekly days with the same times are grouped;
- a dated entry is never merged with a weekly one and has no days unless
  given;
- open all day is `00:00`–`23:59`, a dated closure `00:00`–`00:00`;
- a time is never parsed from text.

### 10. The dialog

- A group of more than three parts is a summary box that opens a sheet.
  The sheet holds a plain "Reads as" line and the parts, and has no Save.
- A linked group box only opens its sheet: Backspace and printable keys do
  nothing on it.
- "Link all parts to" links a whole group in one draft write, from the
  label's link icon or the sheet.
- When either half of a pair is linked, the pair stacks. A box shows
  "raw → reading" only when the reading converts the raw value.
- Code lists use a picker with the link menu's anatomy. Six or fewer
  non-code choices are checkbox rows.
- At most four facts sit above More details. More details names a default
  that may need changing first.
- At 468 × 600, the first fact's label is visible without scrolling.

### 11. Variants and list pages

Variants are offered on templates only, one page per variant. They add a
`ProductGroup` at `{url}#group` with the family's name, code and dimensions.
`hasVariant` holds this page's product by `@id` and each sibling by URL only.
A sibling whose family code differs is dropped and counted.

A list page emits an `ItemList` of published, public targets in order. The
course list verdict counts only targets whose own main node is not withheld.

### 12. Decimal rows

`Sources` adds `decimal` rows for number slots, on the bundle and through one
reference hop. They are read as exact strings, never through float. A
contract test fails the day Canvas matches decimals itself, so the rows can
be removed.

## Hand-overs to later changes

These changes archive after this one, so they rebase onto it.

| Id | Change | What it takes on |
|---|---|---|
| D1 | derive-structured-data-from-components | Ingredient list and recipe steps mapping kinds; remove `scopes.page` from `recipeIngredient` and `recipeInstructions` |
| D2 | derive | Event ticket types: offers attach under Event too, one Offer per type |
| D3 | derive | Line-up (performer names, people or groups); remove `scopes.page` from `performer` |
| D4 | derive | "A list of pages" (link prop → internal page URL); remove `scopes.page` from the list page's Items |
| D5 | derive (or read-page-components' main content) | Job description from a rich-text prop through `filterHtml()`; remove `scopes.page` from Job posting |
| D6 | derive | The Set up sheet's unit question uses the prop's `units` |
| D7 | derive | A `tel:` link prop gives `telephone` |
| H1 | set-up-types-from-templates | Self-setup evidence for the new kinds (address and venue fields, people references, ingredient and step fields, prep and cook numbers, `office_hours`, price and salary decimals, `list_string` enums) with `SelfSetupProposalsTest`. Its "Authors link to their own pages" becomes a case of `ref`. Reach counts the new report members |
| H2 | describe-the-publisher | The identity's address, hours and coordinates use the `address` and `geo` shapes and the hours grammar. "At ‹Site›'s address" and "Same as ‹Site›" become available when it lands |
| H3 | derive | The video template route (a video media field in one action; the upload date suggested from Published, never a recording date); image licence on components only |
| H4 | derive | Rebase its MODIFIED "Page types come from one registry" onto this change's text, adding Video to watch |

## Canvas internals relied on

None new. Field links stay Canvas entity-field sources (link-values). The
decimal rows are the module's own, guarded by `SourcesDecimalContractTest`.
`office_hours`, `datetime`/`daterange`, address parts through a hop, and
`link`/`email`/`telephone` fields are proven by kernel spikes before their
rows ship (tasks 1.2).

## Risks / Trade-offs

- [The registry grows complex] → One reader per attribute, `RegistryTest`,
  and the coverage contract. No expression language.
- [Canvas pages can't carry ingredients, performers, several ticket types or
  job postings yet] → They aren't offered until derive's amendments land.
  Better than a typed repeater, which would drift from the page.
- [A builder links a field the template doesn't show] → link-values and
  set-up-types already warn at the field. Self-setup (H1) never links it.
- [Splitting a long text could mislead] → Only `<li>` items, `<p>`
  paragraphs or lines. The menu says "Each list item", and the read-back
  counts the items.
- [The HTML filter is a trust boundary] → An allow-list, absolute http(s)
  links only, and a hostile test. The script is still hex-escaped.
- [Reference targets fan out cache tags] → Only the targets' own tags, with
  no list tags and no reverse queries.

## Migration Plan

Additive. Stored type ids don't change. `nested` is replaced by `groups`
with the same flattened keys, so stored values keep working. Lists change
what a multi-value field emits on list props: from the first item to all
items. The update hook needs no data change; the release notes say it.
`{node}` and the duration `unit` are new value forms, added to the config
schema. Rollback: revert the code. Old stored values stay valid.

## Archive order and overlaps

- Archive right after `rethink-structured-data`. The `structured-data` block
  "Page types come from one registry" and the `seo-dialog` block "An unknown
  stored kind is said" are written on rethink's text. Before rethink
  archives, `openspec validate` notes that the latter is not found yet; that
  is expected. "Field values are plain values of the first item" is written
  on link-values' text. "Values are emitted in schema.org form" and "No text
  can leave the script element" are written on the current main text.
- The unknown-type examples move from `Recipe` (now a type) to `Movie`.
  rethink's Playwright check for an unknown kind is updated the same way
  (task 9.2).
- A dry run on a copy of `openspec/` archived build-ai, link-values, rethink
  and this change in that order, and every delta applied.
