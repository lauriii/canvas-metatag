## MODIFIED Requirements

### Requirement: Node identities are fixed

The module's nodes MUST use these `@id`s, where `{home}` is the home address
(public-addresses) and `{url}` the entity's own public URL: the identity
`{home}#identity`, the logo `{home}#logo`, the website `{home}#website`, the
page `{url}#webpage`, the page image `{url}#primaryimage`, the main node
`{url}#primary`, the breadcrumb `{url}#breadcrumb`. `{url}` MUST NOT follow a
canonical override. Custom nodes MUST NOT take a module id (see "The module's
ids are reserved").

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

#### Scenario: A frontend under a path

- **WHEN** the frontend's public address is `https://example.com/shop` without the slash setting
- **THEN** the identity `@id` MUST be `https://example.com/shop#identity`, and the `WebSite` `url` MUST be `https://example.com/shop`
