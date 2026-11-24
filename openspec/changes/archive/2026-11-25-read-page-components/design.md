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
- Since this design was written, Canvas renders a page's chrome from a page
  variant (`PageVariantResolver`: the page's or template's choice, else the
  site default `canvas.settings:default_page_variant`); the global page
  regions are a legacy fallback when no variant resolves. The farm site's
  default variant renders the theme's page template around the content.
- Canvas validates every instance it saves against the component as it is
  now, so an instance on an older version, or one with lost inputs, can only
  exist from before; tests write it to storage directly
  (`SeoFixtureTrait::storeInstance()`).
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
host and the node's exposed-slot subtree injected by Canvas's own
`injectSubTreeItemList()` (so only what Canvas renders: the slot's direct
children); for a Canvas page, its own tree; plus the page's chrome: the page
variant that resolves for the entity, else the default theme's legacy page
regions, each with its valid draft in previews (as `CanvasPageVariant`
does). The dialog reads a page's chrome as a draft for whoever may edit the
page, as the editor's preview shows it. `Sources::instances($tree)` returns
`{uuid, component, label, version, owner}` (owner `page`, `template`, `item`
or `region`, for the chrome) with the item and its host for reading.

*Alternative:* walk `ContentTemplate::getComponentTree()` alone (rejected:
misses every component an editor placed in an item's slot).

### 2. Each instance is read against its own version

Prop definitions come from
`Component::load($id)->getSettings($item->getComponentVersion())`, which reads
a version without loading it (`loadVersion()` changes the shared entity that
rendering uses). `Sources::props($instance, $kinds, $page)` reads the props a
caller asks for; a prop the version lacks is reported in `skipped_parts` with
the version, and gives nothing.

### 3. One account rule

Explicit inputs are evaluated with `Sources::evaluate()` unchanged. The
cacheability guard (decision 5) applies where the head is served to
anonymous visitors only: a page they may not view is read as the user who
asks, and its head is that user's, so its values keep their cacheability.

*Alternative:* always anonymous (rejected: an unpublished page's field props
would read empty in the dialog, and it contradicts the linked-values rule).

### 4. Images through their entity

For an image prop the reader rewrites the prop's expression to read the
file's stored URI instead of `src_with_alternate_widths`, the same rewrite as
a linked image field (`Sources::IMAGE_FROM`/`IMAGE_TO`), and evaluates it by
the account rule; `Resolver::parts()` turns it into the image array with
`uriImage()`: public scheme only, absolute address, the item's width and
height. Adapted from "pass the media entity to `mediaImage()`": the
evaluator checks anonymous access at each hop (media, then file) exactly as
for every other value, and one image path serves linked and component
images. Parity compares file URIs.

### 5. Fail closed, never lose the head

- Personalization: only the case whose `segments` hold the default segment
  (`default`), the one Canvas renders for a visitor in no segment
  (`Personalization::isNegotiatedCase()`), told by the switch's
  `ComponentSourceWithSwitchCasesInterface`, not the submodule's classes;
  the other cases are reported as
  `skipped_parts{reason: personalized}`, and what is inside them is left out
  with them; no UI copy about it (Checks does not list them). Canvas offers two variants for now, `default` and
  `halloween`; the tests use the second as "returning visitors".
- A catch per instance (logged, in `instances()` and `props()` alike) and
  one at the reader's boundary
  (`Resolver::trail()`): an error builds the graph without component values
  and reports `{reason: error}` (one with an empty uuid for the boundary). A
  trail the breadcrumb builder cannot build costs the trail only and is
  reported as the breadcrumb's `error`. The head reads the instance list
  (for the breadcrumb), so delivery reports `personalized` and `error`;
  `props()` reports the rest to its consumers.
- A value visitors may not see is reported `{reason: access, prop}`.
- Cacheability is collected per instance; on a page anonymous visitors may
  view, an instance whose values, read as an anonymous visitor, vary by
  `user` or `session` (contexts `read()` records apart before dropping
  them), or have a max-age that is not permanent, is left out and reported
  (`{reason: cacheability}`, renamed
  from `max-age` because it covers contexts too), so the page stays
  cacheable.

### 6. Breadcrumbs only where they render

When `instances()` finds a breadcrumb block (`block.system_breadcrumb_block`)
in the page's tree or chrome, and the page is not the front page (which
shows none), `Resolver::breadcrumb()` asks Drupal's breadcrumb builder (the
block's own) for the entity's canonical route. The builder reads the path
from the request context, not the route match, so the context's path is set
to the entity's own path for the call, and the call runs as an anonymous
visitor, in the entity's language (when the request is in another, a request
for the entity's own address is pushed and the language manager renegotiated
for the call, with the translation's and the config overrides' language);
all of it is restored. The context's path is the generated address's path
only (a language served on its own domain is linked with its host), and a
draft's unsaved alias is compared decoded and put in encoded, as the path
processors expect. Only the trail follows that unsaved alias: the ids and
the canonical stay on the stored address until the page is saved ("Node
identities are fixed"), so an unpublished page's Output can show
`/page/41#breadcrumb` beside a trail for `/shop/lamps/brass`. That is
intended; moving the ids with a draft's alias is not this change's to
decide. Only its tags and max-age are kept. A trail of fewer
than two crumbs (a top-level page's "Home") says nothing about where the page
sits: there is no list then, so the editor never sees a "Needs 2 items" they
cannot act on. `SchemaGraph`
adds a `BreadcrumbList` at `{url}#breadcrumb`, referenced as the page node's
`breadcrumb`, with origin `page` (Output: "This page"). Links are absolute on
the public base; only the last crumb may have no link (it then carries no
`item`); a crumb in the middle without one is left out. `#breadcrumb` becomes
a reserved fragment: a new hand-added one is refused; one stored before was
output, so read mode and `canvas_metatag_post_update_reserve_breadcrumb`
rename it `#breadcrumb-2` and keep its output and references
(`SchemaGraph::LATER_IDS`), instead of dropping it.

The `breadcrumb` feature needs two items: a new rule kind `min` (a count at a
path), in `SchemaGraph::features()` and `features.ts`; it judges hand-added
trails, since the module's own has two or more. The module's own trail is
the site's structure, not something to set in the dialog: its verdict is the
Schema view's line only, never a Checks row. The search preview shows the
trail in the result's address line, as the feature describes: the host,
then the crumbs, less the first when the builder linked it to the front page
(the report's `trail_home`; a contributed builder's first crumb is kept
otherwise).

*Alternative:* always emit the trail (rejected: it would describe something
visitors do not see).

### 7. Usage counts

`Sources::usage($componentId)` gives `{content, templates}`: content items
whose default revision places the component (an entity query on every
`component_tree` field, each item counted once), and content templates that
place it.

It ships before its consumer (`derive-structured-data-from-components`'
Components list), as `props()` and `Resolver::parts()` do: it reads the
`component_tree` field's `component_id` column, a Canvas internal the
contract job pins (ARCHITECTURE.md §11), so the guard is in place, and
proven by `SourcesTreeTest::testUsage`, before anything depends on it.

### 8. Component values in the page match

The report's `sources[key]` is `component` for a value from a component, and
`from_components[key]` gives `{label, value}` (the component's name and the
text it gave); `checks.ts` looks for that text on the page like a typed
value. This change defines the contract and the check; the producer comes
with `derive-structured-data-from-components`. `skipped_parts` other than
`personalized` are Checks rows under Good to know (never counted) for users
who can administer site settings: nothing in the dialog changes them.

## Canvas internals relied on

| Internal | Used for | Guard |
|---|---|---|
| `ContentTemplate::build()` subtree injection, `getExposedSlots()`, `ComponentTreeLoader::getCanvasFieldName()` | the item's own slot | `SourcesTreeTest` fixture with one exposed slot |
| `ComponentTreeItem::getComponentVersion()`, `Component::getSettings($version)` (never `loadVersion()`) | per-version props | two-version fixture |
| `getExplicitInput()` / `EvaluationResult` | values and cacheability | per-instance and boundary catch |
| image prop source (`entity:media:image␝field_media_image`) | image entity | image fixture |
| `canvas_personalization` switch and case; the case whose `segments` hold `default` renders (`Personalization::isNegotiatedCase()`) | default case | contract case; fail closed |
| page variant (`PageVariantResolver::resolve()`, `resolvePreviewVariant()`), legacy page regions (`PageRegion::loadForTheme()`), the auto-saves of the template, the variant and the regions | breadcrumb and chrome components; previews | chrome fixture (`createChrome()`), `SourcesTreeTest::testChrome` |

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

Only a hand-added `#breadcrumb` stored before changes: the post-update
renames it `#breadcrumb-2`, with the references to it, and leaves every
other stored text exactly as written. Pages that render a breadcrumb gain a
node on the next cache rebuild; the module's install-time invalidation is not needed
because the graph's cache tags already include the tree.
