# Proposal

## Why

The product owner asked for structured data that is easy to use and "industry
leading". The leading part rests on one thing only Canvas has: the page as
typed data on the server, component by component. Three later changes need
to read it (template self-setup, the publisher linked to the footer, and
components that describe themselves), and reviews of the design found that
reading it naively breaks in five ways: components placed in a content
item's own slot are missed, components on an older version have other prop
names, image props render as relative addresses with width parameters, the
experimental personalization switch, and one failing component costing the
whole head. This change builds the reader once, behind its gates, and ships
its first visible use: a breadcrumb trail in the structured data, only where
the breadcrumb actually shows.

## What Changes

- **A component reader** that returns, for a Canvas page or a node shown
  through a content template, every component instance that renders: the
  template's tree, the item's own slot content and the page regions, each
  with its component, version and owner (template, item, page, region).
- **Instances are read against their own version** and evaluated with the
  same account rule as linked values (anonymous when the page is public).
- **Image props are read through their media or file**, giving absolute
  public addresses with real dimensions; never the rendered `src`.
- **Fail closed:** personalized content contributes its default case only; a
  component that cannot be read is reported as skipped and the rest of the
  head still ships; a component that would make the page uncacheable for
  visitors is left out and reported.
- **Breadcrumbs:** a `BreadcrumbList` at `{url}#breadcrumb`, referenced from
  the page node, only when a breadcrumb component renders on that page and
  its trail has two crumbs or more; a "Breadcrumb" verdict line in the Schema
  view, and the trail in the search preview's address line. A hand-added `#breadcrumb` is
  refused from now on; one stored before keeps its output as
  `#breadcrumb-2` (read mode and a post-update).
- **Component values join the page match:** a fact that comes from a
  component is compared with the page like any other (used fully in
  `derive-structured-data-from-components`).
- **Ships ahead of its consumers:** `Sources::props()`, `Sources::usage()`
  and `Resolver::parts()` have no production caller until
  `strengthen-zero-config-defaults` and
  `derive-structured-data-from-components` (the Components list) use them.
  They ship here because they read the Canvas internals this change pins in
  the contract job (stored inputs per version, the `component_tree` column),
  so a Canvas change breaks a test before it reaches a consumer. They are not
  dead code; until then only `error` and `personalized` reach the report's
  `skipped_parts`, and nothing marks a value as coming from a component.
- **Gates:** a kernel test that the reader has no render side effects and
  never leaks unpublished content, and a performance budget at delivery and
  on the dialog's state route.

## Out of scope

- Mapping components to structured data (`derive-structured-data-from-
  components`), identity links (`describe-the-publisher`) and template
  self-setup (`set-up-types-from-templates`): they consume this reader.
- Any UI to configure breadcrumbs: the trail is Drupal's own for the route.

## Non-goals reopened (product owner sign-off)

- The README listed **breadcrumb structured data** as not provided. This
  change provides it, only where the breadcrumb shows. Signed off: yes,
  only where a breadcrumb block shows (decisions, item 3).

## Product owner decisions this change relies on

- **Item 3:** breadcrumb structured data, only where a breadcrumb block
  shows. The README's non-goal now reads "breadcrumb structured data where
  no breadcrumb shows".
- **Item 7:** the budgets: +10 ms warm at page delivery and +300 ms cold on
  the dialog's state route, for 20 mapped components. Measured on the farm
  site (`/pricing`, 24 instances, every prop of the 21 that have props): 4 ms
  warm, about 95 ms in a cold process (115 ms right after a cache rebuild);
  `GET /state` for that page 122 ms cold and 27-31 ms warm in all. Within
  both budgets; `ComponentBudgetTest` holds the warm one. Recorded in
  ARCHITECTURE.md section 13.
- **Item 2:** no search engine or platform named in UI copy; the breadcrumb
  feature's documentation link stays in `data/search-features.json` only.
- **Item 8:** no human usability gate here; the dialog gains one Schema view
  line and Checks rows for site builders only (under Good to know, never
  counted: nothing in the dialog changes them).
- **"Experience needs to be clean"** (the product owner's brief): a top-level
  page's trail is "Home" alone, which says nothing about where the page sits
  and which no editor can change. Rather than a permanent "Needs 2 items"
  line on every such page, the module describes trails of two crumbs or
  more only (lead's call on review round 1).

## Canvas version

`composer.json` keeps `drupal/canvas: ^1.11`. Checked against the 1.11.0
release archive: it ships `PageVariantResolver` (with
`resolve($entity, $template, $is_preview)`, identical to 1.x-dev),
`Entity\PageVariant::getComponentTree()`,
`ComponentSourceWithSwitchCasesInterface::isCase()`,
`ContentTemplate::getExposedSlots()`,
`ComponentTreeItemList::injectSubTreeItemList()`,
`Component::getSettings($version)` and
`AutoSaveManager::getAutoSaveEntity()`. No constraint change is needed.

## Depends on / followed by

- **Depends on `rethink-structured-data`** (rules file, report, verdict
  lines) and **`link-values-to-fields`** groups 6–7 (the `Sources` class,
  its account rule and the Canvas contract CI job).
- **Followed by** `strengthen-zero-config-defaults` (inserted right after
  this change: a Canvas page's first component image, its own text and its
  first heading, read through `instances()` and `Sources::evaluate()`),
  `set-up-types-from-templates`, `describe-the-publisher` and
  `derive-structured-data-from-components`, which read components through
  it. Nothing in this change's scope changes for that consumer; its budgets
  apply to it unchanged.

## Capabilities

### New Capabilities

- `page-components`: which component instances count as rendered on a page
  or item, how their values are read, and how failures are contained.

### Modified Capabilities

- `structured-data`: the breadcrumb node and its reserved identity.
- `search-features`: the breadcrumb feature (capability added by
  `rethink-structured-data`).
- `seo-checks`: values from components are compared with the page.

## Impact

- **Server:** `src/Sources.php` (`tree()`, `instances()`, `props()`,
  `usage()`, image reading, guards), `SchemaGraph` (breadcrumb node, the
  `breadcrumb` module id, the `min` rule), `Resolver` (`trail()`,
  `breadcrumb()`, `parts()`, report member `skipped_parts`), `Values`
  (`#breadcrumb` stored before is renamed and kept), a post-update.
- **Dialog:** `checks.ts` (component values compared with the page; skipped
  components for site builders; the module's own trail never a Checks row),
  `features.ts` (the `min` rule), `Header.tsx` (a sheet keeps Escape and Tab
  inside the dialog's frame).
- **Data:** a `breadcrumb` entry in `data/search-features.json`.
- **Canvas internals:** content template subtree injection, component
  versions, explicit input evaluation, the image prop shape, the
  personalization switch; each gets an ARCHITECTURE.md §11 row and a
  contract test.
- **Docs:** README (breadcrumbs; the non-goal line), ARCHITECTURE.md §7,
  §11, §13 (cacheability), §17.
