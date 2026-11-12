## Purpose

Say which Canvas component instances count as rendered on a Canvas page or on
a node shown through a content template, and how the module reads their
values for structured data without leaking content, losing the head or
making the page uncacheable.

## ADDED Requirements

### Requirement: What renders is what is read

The components read for a Canvas page MUST be those of its own tree and of
the active page regions. For a node shown through a content template they
MUST be the template's components, the components placed in the node's own
slot, and those of the page regions. Each MUST be known with its owner:
template, item, page or region.

#### Scenario: A component in an item's own slot

- **WHEN** an editor places a video component in one article's exposed slot
- **THEN** that article's components MUST include it with the owner "item", and no other article's MUST

#### Scenario: A component on the template

- **WHEN** the Article template shows a heading linked to the title
- **THEN** every article's components MUST include it with the owner "template"

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
- **THEN** that value MUST be empty in the structured data

### Requirement: Images are public addresses with their size

A component's image MUST be given as the absolute public address of its file,
with the file's width and height when known, never as the rendered source
with style or width parameters. An image visitors cannot get MUST give no
value.

#### Scenario: A hero image

- **WHEN** a component's image prop shows a media image
- **THEN** its value MUST be the file's absolute address on the public base with its width and height

### Requirement: Personalized content gives its default case

For a personalization switch, only the default case MUST be read; other cases
MUST be reported as skipped.

#### Scenario: Two variants

- **WHEN** a page has a personalization switch with a default case and a returning-visitor case
- **THEN** only the default case's components MUST be read

### Requirement: A component that cannot be read costs only itself

A component whose values cannot be read MUST be reported as skipped with its
reason, and the head MUST still carry everything else. A failure of the whole
reading MUST give the head without component values.

#### Scenario: A broken component

- **WHEN** one component throws while its values are read
- **THEN** the page's head MUST still carry its title, its tags and its structured data, and the dialog's report MUST list that component as skipped

### Requirement: Component values never make the head uncacheable

A component value that would make the head vary per user or session, or
expire, MUST be left out and reported, so that the page's cacheability is
unchanged.

#### Scenario: A per-user value

- **WHEN** a component's value depends on the current user
- **THEN** it MUST be left out of the structured data and reported, and the head MUST NOT gain a user cache context

### Requirement: Reading components stays within its budget

Reading 20 mapped component instances MUST stay within the budget agreed with
the product owner, at delivery and on the dialog's state route.

#### Scenario: The budget

- **WHEN** a page with 20 mapped instances is resolved warm at delivery
- **THEN** the reading MUST add no more than the agreed time
