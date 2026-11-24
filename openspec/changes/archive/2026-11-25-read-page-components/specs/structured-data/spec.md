## MODIFIED Requirements

### Requirement: Node identities are fixed

The module's nodes MUST use these `@id`s, where `{home}` is the public base
followed by `/` and `{url}` is the entity's own public URL: the identity
`{home}#identity`, the logo `{home}#logo`, the website `{home}#website`, the page
`{url}#webpage`, the page image `{url}#primaryimage`, the main node
`{url}#primary`, the breadcrumb `{url}#breadcrumb`. `{url}` MUST NOT follow a
canonical override, so that a page's identity does not move when its
canonical does. Custom nodes MUST NOT take a module id (see "The module's ids
are reserved").

#### Scenario: A canonical override

- **WHEN** a page at `/love` sets the canonical `/plans?ref=1`
- **THEN** the page node's `@id` MUST be on `/love`, not on `/plans`

#### Scenario: The front page

- **WHEN** the page is the site's front page
- **THEN** its page node's `@id` MUST be `{home}#webpage`

#### Scenario: A custom breadcrumb id

- **WHEN** an editor saves a custom node with the `@id` `#breadcrumb`
- **THEN** it MUST be refused; and a custom node that reaches the graph with that id without being renamed MUST be dropped and reported

#### Scenario: A custom breadcrumb id stored before

- **WHEN** a custom node stored before this release has the `@id` `#breadcrumb`
- **THEN** it MUST keep its output under the `@id` `#breadcrumb-2`, with the references to it

### Requirement: Stored custom nodes never take the module's ids

When read, a top-level custom item with one of the module's ids, or a second
item with an id already used, MUST be left out, behind the save's refusal
and the update's rename. An id the module took later (`#breadcrumb`) is the
exception: the item was output before, so it MUST NOT be left out; it MUST
be read as `#breadcrumb-2`, with the references that reached it, and output
as before.

#### Scenario: A stored item that takes the identity's id

- **WHEN** a value stored before ids were reserved holds a top-level item with the `@id` `#identity`, and two items with the `@id` `#x`
- **THEN** the item MUST be left out, the module's identity MUST be unchanged, and only the first `#x` MUST be output

#### Scenario: A stored item that takes the breadcrumb's id

- **WHEN** a value stored before the breadcrumb trail was described holds a top-level item with the `@id` `#breadcrumb`, and another item whose `subjectOf` points at it
- **THEN** the item MUST be output as `#breadcrumb-2`, the reference MUST point at `#breadcrumb-2`, and the page's own trail, if it has one, MUST keep `#breadcrumb`

### Requirement: The module's ids are reserved

The module MUST keep one list of the ids it emits, each anchored on the home
or the page address. A top-level hand-added item MUST NOT take an id on the
list, and two top-level hand-added items MUST NOT share an id; such a save
MUST be refused with the id named. An update MUST rename such ids stored
before this rule, rewriting references to them, without changing any page's
output, and MUST leave stored text with nothing to rename exactly as it was
written.

#### Scenario: The page's own id

- **WHEN** an editor saves a hand-added item with the `@id` `#webpage`
- **THEN** the save MUST be refused with "“#webpage” is made by this page. Use Add details, or give the item another @id."

#### Scenario: The breadcrumb's id

- **WHEN** an editor saves a hand-added item with the `@id` `#breadcrumb`
- **THEN** the save MUST be refused with "“#breadcrumb” is kept for the breadcrumb trail of the page. Give the item another @id."

#### Scenario: Two items with one id

- **WHEN** two hand-added items both use the `@id` `#acme`
- **THEN** the save MUST be refused with "“#acme” is used by two items. Give the second another @id."

#### Scenario: An id stored before the rule

- **WHEN** a page stored a hand-added `Organization` with `@id` `#identity` and a review pointing at it before the update
- **THEN** after the update the item MUST be `#identity-2`, the review MUST point at `#identity-2`, and the update's output MUST list the page

#### Scenario: Text with nothing to rename

- **WHEN** the update that renames `#breadcrumb` runs over a template, a template's draft and a page draft whose hand-added JSON-LD is written compactly and has no `#breadcrumb`
- **THEN** each text MUST stay byte for byte as it was, and the update MUST say it changed 0 places

## ADDED Requirements

### Requirement: A breadcrumb trail is described where it shows

When a breadcrumb component renders on the page, the graph MUST carry a
`BreadcrumbList` of the trail it shows, as an anonymous visitor gets it, in
the page's language: each item with its position, name and absolute address
on the public base (only the last MAY have none), referenced by the page node
as `breadcrumb`. Without a rendered breadcrumb, with a trail of fewer than two
items, and on the front page, there MUST be none.

#### Scenario: A page with a breadcrumb

- **WHEN** a page at `/shop/lamps/oak` renders Drupal's breadcrumb "Home › Shop › Lamps" (the current page is not a crumb)
- **THEN** the graph MUST have a `BreadcrumbList` at `/shop/lamps/oak#breadcrumb` with three items, each with an absolute `item` on the public base

#### Scenario: A trail whose last crumb has no link

- **WHEN** a breadcrumb builder gives "Home", a crumb without a link, a crumb without a name, a crumb on another site and the current page as a last crumb without a link
- **THEN** the trail MUST be "Home", the crumb on another site with its own address, and the last item with its name and no `item`

#### Scenario: A draft with a new address

- **WHEN** an editor previews an unpublished page whose draft has the alias `/shop/lamps/brass`, not saved yet
- **THEN** its trail MUST be the one that address gets: "Home › Shop › Lamps"

#### Scenario: A top-level page

- **WHEN** a page at `/shop` renders a breadcrumb of only "Home"
- **THEN** the graph MUST have no `BreadcrumbList` and the page node no `breadcrumb`

#### Scenario: A translation

- **WHEN** the French translation of a page is resolved from a request in English, also where the session decides the language before the address
- **THEN** its trail MUST have the French names and the French addresses, and the request's languages MUST be left as they were

#### Scenario: A page without one

- **WHEN** a page renders no breadcrumb component
- **THEN** the graph MUST have no `BreadcrumbList` and the page node no `breadcrumb`
