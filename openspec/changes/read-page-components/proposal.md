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
  the page node, only when a breadcrumb component renders on that page; a
  "Breadcrumb" verdict line in the Schema view.
- **Component values join the page match:** a fact that comes from a
  component is compared with the page like any other (used fully in
  `derive-structured-data-from-components`).
- **Gates:** a kernel test that the reader has no render side effects and
  never leaks unpublished content, and a performance budget at delivery and
  on the dialog's state route.

## Out of scope

- Mapping components to structured data (`derive-structured-data-from-
  components`), identity links (`describe-the-publisher`) and template
  self-setup (`set-up-types-from-templates`): they consume this reader.
- Any UI to configure breadcrumbs: the trail is Drupal's own for the route.

## Non-goals reopened (product owner sign-off needed)

- The README lists **breadcrumb structured data** as not provided. This
  change provides it, only where the breadcrumb shows. Recommended: yes.

## Depends on / followed by

- **Depends on `rethink-structured-data`** (rules file, report, verdict
  lines) and **`link-values-to-fields`** groups 6–7 (the `Sources` class,
  its account rule and the Canvas contract CI job).
- **Followed by** `set-up-types-from-templates`, `describe-the-publisher` and
  `derive-structured-data-from-components`, which read components through
  it.

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

- **Server:** `src/Sources.php` (`tree()`, `instances()`, image reading,
  guards), `SchemaGraph` (breadcrumb), `Resolver` (breadcrumb builder call,
  report member `skipped_parts`).
- **Data:** a `breadcrumb` entry in `data/search-features.json`.
- **Canvas internals:** content template subtree injection, component
  versions, explicit input evaluation, the image prop shape, the
  personalization switch; each gets an ARCHITECTURE.md §11 row and a
  contract test.
- **Docs:** README (breadcrumbs; the non-goal line), ARCHITECTURE.md §7,
  §11, §13 (cacheability), §17.
