# page-components Specification

## Purpose
Say which Canvas component instances count as rendered on a Canvas page or on
a node shown through a content template, and how the module reads their
values for structured data without leaking content, losing the head or
making the page uncacheable.

## Requirements

### Requirement: What renders is what is read

The components read for a Canvas page MUST be those of its own tree and of
the page's chrome (the page variant it resolves to, else the active page
regions). For a node shown through a content template they MUST be the
template's components, the components placed in the node's own slots, and
those of the page's chrome. Each MUST be known with its owner: template,
item, page or region (the chrome). Every instance MUST be read once.

#### Scenario: A component in an item's own slot

- **WHEN** an editor places a video component in one article's exposed slot
- **THEN** that article's components MUST include it with the owner "item", and no other article's MUST

#### Scenario: A component on the template

- **WHEN** the Article template shows a heading linked to the title, outside its exposed slots
- **THEN** every article's components MUST include it with the owner "template"

#### Scenario: A component of the page's chrome

- **WHEN** the site's page variant shows a breadcrumb around every page
- **THEN** every page's components MUST include it with the owner "region"

#### Scenario: Legacy regions

- **WHEN** no page variant applies and an enabled region of the default theme holds a breadcrumb
- **THEN** every page's components MUST include it with the owner "region", and adding, changing or removing a region MUST rebuild the head

### Requirement: Each exposed slot is read from its own field

A template may expose several slots, each filled from its own field on the
node. Each slot MUST be read from its own field, as Canvas renders it: the
node's content replaces the template's default content there, and a slot
whose field is empty, missing or hidden from the page's visitors shows the
template's default content.

#### Scenario: Two exposed slots

- **WHEN** the Article template exposes a body slot and a footer slot, each backed by its own field, and one article fills both
- **THEN** that article's components MUST include each slot's components once, in the slot they fill, with the owner "item", and MUST NOT include the template's default content of either slot

#### Scenario: A slot left empty

- **WHEN** the Article template's footer slot holds a default component and an article fills its body slot but never its footer
- **THEN** that article's components MUST include the default component with the owner "template", and its body content with the owner "item"

#### Scenario: A slot emptied on purpose

- **WHEN** the Article template's footer slot holds a default component and an article's footer field holds only Canvas's empty-slot marker
- **THEN** that article's components MUST include the marker with the owner "item", in the footer slot, and MUST NOT include the default component; the marker has no props, so it gives no value

#### Scenario: A slot field visitors may not view

- **WHEN** anonymous visitors may view an article but not its footer slot's field
- **THEN** the article's components MUST be read with the template's default footer content, for every user who asks (decided as for values, see "Values are what the page's visitors may see"), and the head MUST NOT vary by user; it MUST keep the cache tags and max-age of the slot fields' access, as Canvas's page does (this is the page's own cacheability, as Canvas renders it, not a component value; see "Component values never make the head uncacheable")

#### Scenario: A slot whose field is gone

- **WHEN** the Article template exposes a footer slot keyed by a field the type no longer has
- **THEN** that article's components MUST include the template's default content of that slot with the owner "template"

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

### Requirement: Each instance is read with its own version

An instance MUST be read against the prop definitions of the component
version it was placed with. A prop its version lacks MUST be reported as
skipped with the version, and MUST give no value.

#### Scenario: Two versions in use

- **WHEN** one page uses version 1 of a component with the prop `price` and another uses version 2 where it is renamed `monthlyPrice`
- **THEN** each page's value MUST be read from its own prop name

### Requirement: Values are what the page's visitors may see

Component values MUST be evaluated as an anonymous visitor when the page is
visible to anonymous visitors, and as the current user otherwise, as linked
values are. An unpublished referenced entity MUST NOT give a value on a
public page.

#### Scenario: An unpublished reference

- **WHEN** a public page's component shows the title of an unpublished node
- **THEN** that value MUST give nothing and be reported as skipped (access)

### Requirement: Images are public addresses with their size

A component's image MUST be given as the absolute public address of its file
on Drupal's own host (as every image is, see headless-head), with the file's
width and height when known, never as the rendered source with style or
width parameters. An image visitors cannot get MUST give no value.

#### Scenario: A hero image

- **WHEN** a component's image prop shows a media image
- **THEN** its value MUST be the file's absolute public address on Drupal's own host, with its width and height

### Requirement: Personalized content gives its default case

For a personalization switch, only the case Canvas renders for visitors in
no segment MUST be read: the one whose segments hold the default segment.
Other cases MUST be reported as skipped.

#### Scenario: Two variants

- **WHEN** a page has a personalization switch with a default case and a returning-visitor case
- **THEN** only the default case's components MUST be read

#### Scenario: A case named otherwise

- **WHEN** the case whose segments hold the default segment has another variant name
- **THEN** that case's components MUST be read, and the other case's MUST NOT

### Requirement: A component that cannot be read costs only itself

A component that cannot be read MUST be reported as skipped with its
reason, what is inside it MUST be left out with it, and the head MUST still
carry everything else. A failure of the whole reading MUST give the head
without component values; a breadcrumb trail that cannot be built MUST cost
the trail only.

#### Scenario: A broken component

- **WHEN** one component on a page can no longer be read (its component or the version it was placed with is gone)
- **THEN** the page's head MUST still carry its title, its tags and its structured data with the breadcrumb trail, and the dialog's report MUST list that component as skipped

#### Scenario: A value that throws

- **WHEN** one component throws while its values are read
- **THEN** only that component's values MUST be left out, and it MUST be reported as skipped and its error logged

### Requirement: Component values never make the head uncacheable

On a page anonymous visitors may view, a component value that would make the
head vary per user or session, or expire, MUST be left out with the rest of
its component's values and reported, so that the page's cacheability is
unchanged. A page they may not view is read as the user who asks, and its
head is that user's: its values MUST be kept with their cacheability.

#### Scenario: A value that expires

- **WHEN** a component's value on a public page may only be kept for a minute
- **THEN** it MUST give nothing and be reported (cacheability), and MUST add no max-age and no user cache context to what the head collects

#### Scenario: A value that varies by user

- **WHEN** reading a component's value on a public page as an anonymous visitor gives a result that varies by user or session
- **THEN** it MUST give nothing and be reported (cacheability), and MUST add no user cache context to what the head collects

#### Scenario: An author's own unpublished page

- **WHEN** an author previews their unpublished article, whose component shows its title
- **THEN** the value MUST be the title

### Requirement: Reading components stays within its budget

Reading 20 mapped component instances, with the breadcrumb trail, MUST stay
within the budget agreed with the product owner at warm delivery. The
dialog's state route's cold cost MUST be measured and recorded against its
budget.

#### Scenario: The budget

- **WHEN** a page with 20 mapped instances is resolved warm at delivery
- **THEN** the reading MUST add no more than the agreed time
