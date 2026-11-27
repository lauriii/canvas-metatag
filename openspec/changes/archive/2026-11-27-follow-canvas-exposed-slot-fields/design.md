# Design

## Context

See proposal.md for why. Facts read in Canvas's source (site-4 runs the 1.x
branch after 1.13.0; the tags were read on git.drupalcode.org):

- `ContentTemplate::getExposedSlots()` is keyed by the machine name of the
  `component_tree` field that backs each slot
  (`ValidExposedSlotConstraintValidator`); one physical slot cannot be
  exposed twice, and no exposed slot's host may sit inside another exposed
  slot's subtree.
- `ContentTemplate::getMergedComponentTree($entity, $cacheability,
  $check_access = TRUE)` is what `build()` renders (and what Canvas's search
  indexing reads, with access off). For each exposed slot it skips a field
  the entity does not have, skips a field the current user may not `view`
  (adding the access result's cacheability), and calls
  `injectSlotContent($component_uuid, $slot_name, $field)`; a UUID
  collision is logged and the template default kept.
- `injectSlotContent()` keeps the template's default content when the field
  is empty, else replaces it with the field's tree: the field's root rows are
  re-rooted under the slot, their descendants keep their parents.
  Per-entity slot content is therefore stored as an ordinary tree (root rows
  with no parent), not as rows parented to the template's component.
- `injectSubTreeItemList()` triggers `E_USER_DEPRECATED` ("deprecated in
  canvas:1.13.0"), yet the 1.13.0 tag has neither `injectSlotContent()` nor
  `getMergedComponentTree()`: its `build()` still asserts one exposed slot
  and injects the field `ComponentTreeLoader` picks. No tagged release has
  the new merge; the next one will.
- An intentionally empty slot is stored as one `marker.empty_slot` instance,
  the field's only root: it replaces the template's default there and
  renders nothing (`SourcesTreeTest::testExposedSlots` pins the first part
  and that the marker has no props, so gives no value).

## Goals / Non-Goals

**Goals:** the reader's tree is the one Canvas renders for a template with
any number of exposed slots, built by Canvas's own merge, with no
deprecation; the account rule decides slot-field access as it decides value
access.

**Non-Goals:** reading a node's own per-content draft in the dialog (it opens
on templates and Canvas pages, not on Canvas's per-content editor); hiding
the empty-slot marker (it has no props and is no breadcrumb).

## Decisions

### 1. Canvas's merge, not ours

`Sources::tree()` takes a node's tree from
`ContentTemplate::getMergedComponentTree()`. Re-implementing the loop over
exposed slots would copy Canvas's rules for missing, empty, hidden and
colliding fields and drift the next time they change; calling the merge
follows them. Alternative considered: loop `getExposedSlots()` and call
`injectSlotContent()` ourselves. Rejected: the same code as Canvas's, one
more internal to pin, and no gain.

### 2. Slot access by the account rule

Canvas checks `view` access on each slot field for the current user. The
head is what visitors get, so the merge runs as an anonymous visitor when
anonymous visitors may view the page, keeping only the cache tags and
max-age of the access results (what an anonymous visitor may see does not
vary by who asks), and as the current user otherwise, keeping all of it.
This is the rule `Sources::read()` applies to values; both go through one
helper (`Sources::asVisitor()` and `keep()`), so they cannot drift apart.
The merge is only asked for when the template exposes a slot: without one
there is no slot access to decide. Alternative: pass
`$check_access = FALSE`. Rejected: a slot visitors never see would feed the
head. Alternative: run as the current user. Rejected: an editor's request
would build a public head from content anonymous visitors cannot see, and
the head would vary by user.

### 3. The item's own instances

`item` (the UUIDs tree() marks as the node's own) is the union of the UUIDs
stored in every exposed slot's field the node has. A field that was not
merged (empty, hidden) contributes nothing that renders, so marking by UUID
stays right without knowing which fields were merged. A UUID collision,
which Canvas's validation refuses and the merge logs, is the one case where
a template instance could share a UUID with the node's field; it is not
guarded.

### 4. Supported Canvas range: keep `^1.11`, one guarded branch

Raising the minimum is not possible yet: no tagged release has
`getMergedComponentTree()`, and requiring `1.x-dev` would stop the module
installing with a released Canvas. composer.json keeps `drupal/canvas:
^1.11` (README already says the module is developed against 1.x-dev). One
branch in `tree()`, guarded by `method_exists(ContentTemplate::class,
'getMergedComponentTree')`, keeps the earlier one-slot read for releases
without it, unchanged, with a `ponytail:` comment: delete it when
composer.json requires the first Canvas release that has
`getMergedComponentTree()`. The deprecated method is reached only there,
where it is not deprecated. README and composer.json do not change;
ARCHITECTURE.md §11 names both paths.

Tests follow the storage of the Canvas they run on: the slot fixture's
per-node rows come from one helper (`SeoFixtureTrait::inSlot()`) that roots
them in the field on the new storage and parents them to the template's
component on the old one, under the same `ponytail:` deletion note; the
two-slot test is marked `#[RequiresMethod(ContentTemplate::class,
'getMergedComponentTree')]`, so CI's main PHPUnit job (the latest release)
skips it and `phpunit (canvas dev)` runs it.

### 5. A slot keyed by a field that is not a component tree

`ResolverTest::testUnreadableComponents` used a slot keyed by a field the
type lacks to make the tree unbuildable. Canvas now renders the template's
default there, so that case moves to `SourcesTreeTest` as a readable one,
and the unreadable case becomes a slot keyed by a field that is not a
component tree (`title`), stored straight into configuration as Canvas
refuses to save it: Canvas's own rendering fails on it the same way, and on
both paths the head is built without component values (one `error`).

## Risks / Trade-offs

- [The merge's signature or rules change again on 1.x] → `SourcesTreeTest`
  is in the contract group run against 1.x-dev; the §11 row names it.
- [The fallback rots unseen: site-4 runs only 1.x-dev] → it is the earlier
  code unchanged, and CI's main PHPUnit job runs the contract group's
  single-slot cases against the latest release.
- [Switching to an anonymous session per template-rendered node] → one
  switch per tree, already done per value read; no measurable cost against
  the components budget (`ComponentBudgetTest` reads Canvas pages, which do
  not merge).
