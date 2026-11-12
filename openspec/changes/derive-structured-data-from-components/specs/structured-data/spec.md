## MODIFIED Requirements

### Requirement: Page types come from one registry

The available types MUST be the twelve of the registry: Web page, About page,
Contact page, Collection page, Article, Blog post, News article, Event,
Product, Service, Video to watch and Profile. An absent or unknown type MUST
be a plain Web page, and the report MUST name the unknown stored type. Blog
post and News article MUST have the properties of Article with their own main
type. A property key MUST be one the type has; property values without a type
of their own belong to the inherited type (page-seo).

#### Scenario: An unknown type

- **WHEN** the stored type is `Recipe`
- **THEN** the graph MUST be that of a Web page, with no main node
- **AND** the report MUST carry `unknown_type: "Recipe"`

#### Scenario: A blog post

- **WHEN** the type is Blog post
- **THEN** the main node's `@type` MUST be `BlogPosting` and the page node's `WebPage`

#### Scenario: A property of another type

- **WHEN** a page of the type Article saves the detail `offers_price`
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: A service

- **WHEN** the type is Service with a name and a price
- **THEN** the main node MUST be a `Service` whose `provider` references the identity and whose `offers` is one `Offer`

#### Scenario: A video to watch

- **WHEN** the type is Video to watch and the page has a set-up video component
- **THEN** the page node MUST be a `WebPage` whose main node is that component's `VideoObject`

## ADDED Requirements

### Requirement: Set-up components add parts to the graph

Each instance of a set-up component that renders on the page MUST add a node
at `{url}#c-{uuid}` built from its own values, linked from the page node's
`hasPart`, unless its set-up attaches it to the main thing. Its values MUST
follow the page-components rules.

#### Scenario: A video on the home page

- **WHEN** the home page shows a set-up video component
- **THEN** the graph MUST have a `VideoObject` at `{home}#c-‹uuid›` referenced from the page node's `hasPart`

#### Scenario: The same component on two pages

- **WHEN** `/home` and `/pricing` share an instance UUID
- **THEN** their parts MUST have different `@id`s, one per page

### Requirement: Plans attach only to a confirmed main thing

Parts whose set-up attaches them to a main thing (plans, offers) MUST become
the main node's `offers` only when the page's confirmed kind accepts them.
Otherwise they MUST be left out and the report MUST say why.

#### Scenario: Confirmed as a service

- **WHEN** a page with the Pricing table is confirmed as plans for a service
- **THEN** the Service node's `offers` MUST hold one offer per plan and billing period

#### Scenario: Not confirmed

- **WHEN** the suggestion has not been confirmed
- **THEN** the graph MUST be that of a web page and the report MUST list the plans as left out because they need a main thing

### Requirement: The main thing may be one part

When a page has several candidates, the editor MAY choose the part the page is
mainly about; translations MUST inherit that choice. When the chosen part is
not in the tree being built, the main node MUST be withheld and the report
MUST say so; nothing MUST be chosen in its place.

#### Scenario: A deleted part

- **WHEN** the editor removes the component the page was mainly about
- **THEN** the page MUST have no main node and the report MUST carry `main_missing`
