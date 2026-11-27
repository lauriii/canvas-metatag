# Proposal

## Why

Canvas's development branch (the line after 1.13.0) changed how a content
template's exposed slots are stored. A template may now expose several
slots, and each one is keyed in `exposed_slots` by the name of the
`component_tree` field on the bundle that holds that slot's per-entity
content (`ValidExposedSlotConstraint` refuses any other key). Canvas merges
them with `ContentTemplate::getMergedComponentTree()`, one
`ComponentTreeItemList::injectSlotContent()` per slot, and deprecates
`injectSubTreeItemList()`.

`Sources::tree()` still reads one slot, from the one tree field
`ComponentTreeLoader::load()` picks, with the deprecated method. On a
template with two exposed slots it reads the wrong content, so a node's
structured data, breadcrumb and page facts come from components that do not
render, and the instances the node placed itself (owner `item`) are wrong.
It also triggers a deprecation on every template-rendered node.

## What Changes

- The component reader builds a node's tree with Canvas's own merge
  (`getMergedComponentTree()`): every exposed slot is read from its backing
  field, an empty field keeps the template's own default content, and a slot
  whose field is missing keeps the default too, as Canvas renders them. The
  module no longer re-implements the merge and calls no deprecated method.
- A slot field visitors may not view is left out as Canvas leaves it out,
  decided by the account rule the module already uses for values: as an
  anonymous visitor on a page anonymous visitors may view (only cache tags
  and max-age kept), else as the current user.
- The instances a node placed in any of its slots are its own (owner
  `item`), whichever slot holds them.
- Supported Canvas stays `^1.11`. No tagged Canvas release has the new merge
  yet (1.13.0 does not), so one guarded branch keeps the earlier one-slot
  read on releases without it, marked for deletion when composer.json
  requires the first release that has it.
- ARCHITECTURE.md §11 lists the Canvas internals now relied on.

Out of scope: editing a node's own slot content from the SEO dialog, or
opening the dialog in Canvas's per-content editor; the empty-slot marker
component Canvas stores for an intentionally empty slot is read like any
other instance (it has no props and gives no value). No README non-goal is
reopened.

Product-owner decisions relied on: none beyond the standing rule that the
module is developed against Canvas 1.x-dev (README "Requirements").

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `page-components`: "What renders is what is read" covers several exposed
  slots, each read from its own field, with Canvas's rules for an empty,
  missing or hidden slot field. "Previews read drafts; a disabled template
  is not read" gains a scenario for a template draft that exposes another
  slot.

## Impact

- `src/Sources.php` (`tree()`), its tests `SourcesTreeTest` (contract
  group) and `ResolverTest::testUnreadableComponents`, the slot fixture in
  `SeoFixtureTrait`, the count test module (a field denied to anonymous
  visitors).
- ARCHITECTURE.md §7 ("The page's components and its breadcrumb trail") and §11
  (Canvas internals).
- No API, storage, configuration, UI or dependency change.

## After archiving

The merged "What renders is what is read" text was over the strict
validator's 500-character limit for a requirement, so the main spec splits
it: the slot rules and their five scenarios became "Each exposed slot is
read from its own field", and the edge cases the paragraph listed (the
empty-slot marker gives no value; hidden is decided as for values) moved
into those scenarios. Intent unchanged.
