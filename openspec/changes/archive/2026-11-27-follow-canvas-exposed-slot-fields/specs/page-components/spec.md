## MODIFIED Requirements

### Requirement: What renders is what is read

The components read for a Canvas page MUST be those of its own tree and of
the page's chrome (the page variant it resolves to, else the active page
regions). For a node shown through a content template they MUST be the
template's components, the components placed in the node's own slots, and
those of the page's chrome. Each MUST be known with its owner: template,
item, page or region (the chrome).

A template may expose several slots, each filled from its own field on the
node. Each slot MUST be read from its own field, as Canvas renders it: a
node's content in a slot replaces the template's default content there; a
slot whose field is empty (the node never filled it), or whose field the
type no longer has, shows the template's default content; a slot the node
emptied on purpose holds only Canvas's empty-slot marker, which replaces the
template's default content there and has no props, so gives no value; a
slot whose field the page's visitors may not view (decided as for values,
see "Values are what the page's visitors may see") shows the template's
default content. Every instance MUST be read once.

#### Scenario: A component in an item's own slot

- **WHEN** an editor places a video component in one article's exposed slot
- **THEN** that article's components MUST include it with the owner "item", and no other article's MUST

#### Scenario: Two exposed slots

- **WHEN** the Article template exposes a body slot and a footer slot, each backed by its own field, and one article fills both
- **THEN** that article's components MUST include each slot's components once, in the slot they fill, with the owner "item", and MUST NOT include the template's default content of either slot

#### Scenario: A slot left empty

- **WHEN** the Article template's footer slot holds a default component and an article fills its body slot but never its footer
- **THEN** that article's components MUST include the default component with the owner "template", and its body content with the owner "item"

#### Scenario: A slot emptied on purpose

- **WHEN** the Article template's footer slot holds a default component and an article's footer field holds only Canvas's empty-slot marker
- **THEN** that article's components MUST include the marker with the owner "item", in the footer slot, and MUST NOT include the default component

#### Scenario: A slot field visitors may not view

- **WHEN** anonymous visitors may view an article but not its footer slot's field
- **THEN** the article's components MUST be read with the template's default footer content, for every user who asks, and the head MUST NOT vary by user; it MUST keep the cache tags and max-age of the slot fields' access, as Canvas's page does (this is the page's own cacheability, as Canvas renders it, not a component value; see "Component values never make the head uncacheable")

#### Scenario: A slot whose field is gone

- **WHEN** the Article template exposes a footer slot keyed by a field the type no longer has
- **THEN** that article's components MUST include the template's default content of that slot with the owner "template"

#### Scenario: A component on the template

- **WHEN** the Article template shows a heading linked to the title, outside its exposed slots
- **THEN** every article's components MUST include it with the owner "template"

#### Scenario: A component of the page's chrome

- **WHEN** the site's page variant shows a breadcrumb around every page
- **THEN** every page's components MUST include it with the owner "region"

#### Scenario: Legacy regions

- **WHEN** no page variant applies and an enabled region of the default theme holds a breadcrumb
- **THEN** every page's components MUST include it with the owner "region", and adding, changing or removing a region MUST rebuild the head

### Requirement: Previews read drafts; a disabled template is not read

An editor's preview MUST read the valid drafts of the template and of the
chrome, as Canvas's preview renders them, and MUST be rebuilt when one of
those drafts changes. The published page MUST NOT read them. A disabled
template renders nothing, so its components MUST NOT be read outside its
own preview.

#### Scenario: A draft of the chrome

- **WHEN** the page variant's draft, or a region's, adds a component
- **THEN** an editor's preview MUST read it, the published page MUST NOT, and the dialog MUST say that what it shows includes unpublished changes to that part

#### Scenario: A template draft that exposes another slot

- **WHEN** the Article template's draft exposes its footer slot and the published template exposes only its body slot
- **THEN** an article's footer content MUST be read in the template's preview only, and the published page MUST read the template's default footer

#### Scenario: A disabled template

- **WHEN** the Article template is disabled
- **THEN** an article's components MUST NOT include the template's, except in the template's preview
