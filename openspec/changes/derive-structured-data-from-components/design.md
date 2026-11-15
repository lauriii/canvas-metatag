# Design

## Context

See proposal.md for why. `read-page-components` gives, per page or item, the
rendered instances with owner and version, their evaluated props (anonymous
rule, images through media), skipped parts and cacheability guards.
`rethink-structured-data` gives kinds (incl. Plans for a service), billing,
the seller rule, verdicts and the delivery/report split. Spikes on the farm
site: copied pages share instance UUIDs (`/home` and `/pricing` share 22);
`js.pricing-table` has props such as "Entry tier: Price, monthly" whose
titles are config; header and footer sit in every page tree.

## Goals / Non-Goals

**Goals:** zero JSON for plans, FAQs and videos; facts that come from what
renders; a person agrees before a page's main thing changes; nothing breaks
silently when a component changes.

**Non-Goals:** AI mappings; per-instance overrides; Canvas publish review for
mappings.

## Decisions

### 1. One config entity per component

`canvas_metatag.component_mapping.<component id>`: `{component, version, as,
attach: main|part, items: [{fact: prop}], fixed: {…}, lead: {kind, mode:
ask|auto|never}, per_version: {"<version>": {items}}}`, with a config
dependency on `canvas.component.<id>` and `onDependencyRemoval()`. Its cache
tag is added only to heads whose tree contains that component.

*Alternative:* one key in `canvas_metatag.site` (rejected: no dependency, and
every save would invalidate every head).

### 2. Proposals from prop shapes

The Set up sheet proposes from the component's prop schema: a list of objects
with a name and a number named like a price → plans; monthly and annual
numbers → two offers each with `billingDuration`; a video source → a video;
question and answer text pairs → questions; image with credit text → image
licence. JS component prop titles are read from config (translated through
config translation). Builders confirm; nothing is applied by itself.

### 3. Parts in the graph

`SchemaGraph` adds, after the main thing, one node per mapped instance at
`{url}#c-{uuid}` (scoped by page because copied pages share UUIDs). A part
whose mapping attaches to a main thing (offers) goes into the main node's
`offers` only under a confirmed main thing of a kind that accepts it
(Product, Service); otherwise it is `left_out` with `needs-parent`.
Standalone parts are linked from the page node's `hasPart`. Items inside a
part have no `@id` of their own.

### 4. Suggestions and the main thing

`Proposer::suggest()` in `report()`: stored kind → template kind → the
leading set-up component (ignoring header, footer and text-only components;
ties to the earliest) → nothing. A pricing component proposes Service unless
mapped as things people buy here; a product suggestion carries the "bought
here" question. `mode: auto` applies at delivery by reading component ids
only. `schema.main = "c-<uuid>"` stores the editor's pick when there are
several candidates; translations inherit it with `schema.type`
(`from_default`). `schema.main` is the key `extend-structured-data-by-id`
added for a hand-added item's `@id` (`#‹name›`, per translation, never
inherited); this change lets the same key hold `c-<uuid>`, so a page has one
answer to "what is it mainly about". The proposer reads a stored
`schema.main` of either form before suggesting a component. Part ids use
the `c-` prefix that extend already reserves on `SchemaGraph::MODULE_IDS`. When the stored uuid is not in the tree being built, the
report carries `main_missing`, the main thing is withheld, and nothing is
re-suggested silently.

### 5. Versions

Items are resolved against the instance's own version; a version lacking a
mapped prop yields `skipped_parts{prop-missing, version}`. The Set up sheet
lists versions in use and can hold `per_version` items. Copy names the page's
version and how many pages share it.

### 6. Selection

The selection strip uses the supported extension message
`canvas:data:subscribe:selectedComponentUuid`. "Select in page" navigates the
editor's component route (internal, guarded, read fresh each time), only for
template-owned and page-owned instances; item-slot instances read "From this
article's own content". An upstream issue asks for a `canvas:select` message.

### 7. Site-level effect

A mapping save runs `report()` over the usage list's published output (25
named at most) and says the effect before "Save and apply to ‹n› places".

### 8. Headless parity

`report()` compares component-derived values with the components' own props
when no preview document exists.

## Canvas internals relied on

| Internal | Use | Guard |
|---|---|---|
| `canvas.component.*` config and versions | mapping dependency, prop schema | `ComponentMappingTest` |
| JS component prop titles (config) | proposals | contract test |
| `canvas:data:subscribe:selectedComponentUuid` (supported message) | selection strip | Playwright `host-contract.spec.ts` |
| Editor component route | Select in page | Playwright `host-contract.spec.ts`; hidden when absent |

## Risks / Trade-offs

- [Rubber-stamping "Looks right"] → the band asks about facts in the
  sentence, one confirmation per page, Change… beside it; a usability gate:
  4 of 5 marketers catch a seeded wrong price from the read-back.
- [Automatic mode changes a page's main thing site-wide] → never for
  products; the save names every page it changes.
- [A component rename breaks pages silently] → per-version items and the
  named state.
- [Performance] → read-page-components' budget gate must pass first.

## Migration Plan

New config entities only. Pages keep their stored kind; suggestions appear
only where nothing is stored. Rollback: delete the mapping entities.
