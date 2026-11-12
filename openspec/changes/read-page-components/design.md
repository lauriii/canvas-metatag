# Design

## Context

See proposal.md for why. `link-values-to-fields` adds `src/Sources.php`, the
only class allowed to use Canvas's prop source and expression classes, with
`evaluate()` (the account rule: anonymous when the host is anonymously
visible, else the current user) and a contract CI job against Canvas's
development branch. Canvas 1.x has no stable public PHP API.

Facts read on the farm site (Canvas 1.x):

- `ContentTemplate::build()` renders `getComponentTree($entity)` with
  `injectSubTreeItemList($this->getExposedSlots(), $entity->get($canvasField))`,
  with an open `@todo` and an assertion for exactly one exposed slot.
- Each instance pins `component_version`
  (`ComponentTreeItem::getComponentVersion()`); `Component` is a versioned
  config entity with `loadVersion()`.
- An image prop resolves through `src_with_alternate_widths` to a relative
  address with a query string; the head of `/pricing` carries
  `config:image.style.canvas_parametrized_width`.
- `canvas_personalization` is marked highly experimental; its switch holds
  cases with a `variant_id`, one of which is `default`.
- Header and footer components sit inside every page tree on the farm site,
  and pages copied from each other share instance UUIDs.
- A first read of 22 instances on `/pricing` costs 440–640 ms in a cold
  process and 3–4 ms warm.

## Goals / Non-Goals

**Goals:** one reader for every later change; nothing it reads can leak or
break a head; its cost is measured at delivery and in the dialog.

**Non-Goals:** mapping components to structured data; selection in the
editor; a public API (asked upstream).

## Decisions

### 1. The tree is what renders

`Sources::tree(ContentEntityInterface $entity, bool $draft)` mirrors
`ContentTemplate::build()`: for a node, the template tree with the node as
host plus the node's exposed-slot subtree (read through
`ComponentTreeLoader::getCanvasFieldName()`); for a Canvas page, its own
tree; plus the active page regions. `Sources::instances($tree)` returns
`{uuid, component, version, owner}`.

*Alternative:* walk `ContentTemplate::getComponentTree()` alone (rejected:
misses every component an editor placed in an item's slot).

### 2. Each instance is read against its own version

Prop definitions come from
`Component::load($id)->loadVersion($item->getComponentVersion())`. A prop the
version lacks is reported in `skipped_parts` with the version.

### 3. One account rule

Explicit inputs are evaluated with `Sources::evaluate()` unchanged.

*Alternative:* always anonymous (rejected: an unpublished page's field props
would read empty in the dialog, and it contradicts the linked-values rule).

### 4. Images through their entity

For an image prop the reader takes the media or file entity from the prop
source and passes it to `Resolver::mediaImage()` / `fileImage()`: public
scheme, anonymous access, absolute address on the public base, real width and
height. Parity compares file URIs.

### 5. Fail closed, never lose the head

- Personalization: only the case whose `variant_id` is `default`; the rest
  `skipped_parts{reason: personalized}`; no UI copy about it.
- A catch per instance and one at the reader's boundary: an error builds the
  graph without component values and reports `{reason: error}`.
- Cacheability is merged per instance; an instance adding `user` or
  `session` contexts, or a max-age that is not permanent, is left out and
  reported (`{reason: max-age}`), so the page stays cacheable.

### 6. Breadcrumbs only where they render

When `instances()` finds a breadcrumb block (`block.system_breadcrumb_block`)
in the page's tree or regions, `Resolver` asks Drupal's breadcrumb builder for
the entity's route and `SchemaGraph` adds a `BreadcrumbList` at
`{url}#breadcrumb`, referenced as the page node's `breadcrumb`. Links are
absolute on the public base; a crumb without a link is the last item and
carries no `item`. `#breadcrumb` becomes a reserved fragment.

*Alternative:* always emit the trail (rejected: it would describe something
visitors do not see).

### 7. Usage counts

`Sources::usage($componentId)` counts default revisions and templates only,
for later changes.

## Canvas internals relied on

| Internal | Used for | Guard |
|---|---|---|
| `ContentTemplate::build()` subtree injection, `getExposedSlots()`, `ComponentTreeLoader::getCanvasFieldName()` | the item's own slot | `SourcesTreeTest` fixture with one exposed slot |
| `ComponentTreeItem::getComponentVersion()`, `Component::loadVersion()` | per-version props | two-version fixture |
| `getExplicitInput()` / `EvaluationResult` | values and cacheability | per-instance and boundary catch |
| image prop source (`entity:media:image␝field_media_image`) | image entity | image fixture |
| `canvas_personalization` switch and case | default case | contract case; fail closed |
| page regions | breadcrumb and region components | region fixture |

Each gets an ARCHITECTURE.md §11 row; all run in the Canvas contract job.

## Risks / Trade-offs

- [Canvas changes the slot injection (several exposed slots)] → the contract
  test fails before parts silently vanish.
- [Cold cost on the dialog's state] → measured on HTTP `/state`; budget
  agreed with the product owner before `derive-structured-data-from-
  components` starts.
- [Breadcrumb trail differs from what the block shows when a theme alters it]
  → the builder is the block's own source; a theme override is a known gap in
  the README.

## Migration Plan

Nothing stored changes. Pages that render a breadcrumb gain a node on the
next cache rebuild; the module's install-time invalidation is not needed
because the graph's cache tags already include the tree.
