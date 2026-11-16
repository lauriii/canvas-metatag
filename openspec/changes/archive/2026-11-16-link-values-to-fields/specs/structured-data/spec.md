## MODIFIED Requirements

### Requirement: The page node describes the page

The page node MUST have the type's page type (`WebPage` unless the type names
another), the entity's own URL, its label as `name`, the head's description,
the language (left out for a language-neutral entity), `isPartOf` the website,
and the First published and Last updated facts.
When an image resolves, the node MUST reference the page image node as
`primaryImageOfPage`, which MUST carry the alt text as `caption`.
`mainEntity` MUST reference the main node only when it is in the graph.

#### Scenario: An about page

- **WHEN** the type is About page
- **THEN** the page node's `@type` MUST be `AboutPage`, and there MUST be no main node

#### Scenario: A translation

- **WHEN** a French translation is resolved
- **THEN** the page node's `inLanguage` MUST be `fr`

### Requirement: Property values are checked against their kind

A typed value MUST pass its property's kind, options and pattern: text is any
text; a url is an absolute http(s) URL with a host and no credentials; a date
is a real `YYYY-MM-DD`, optionally with a time and an offset or `Z`; a number
is digits with an optional decimal part; an enum is one of the options. An
image MUST be a chosen media item, the Image fact or a linked image field. A
typed value that fails MUST be refused when saved; a linked value that fails
MUST be treated as missing.

#### Scenario: Dates and numbers

- **WHEN** a value is `2026-02-30`, `2026-07-01 18:00`, `49,90` or `-1`
- **THEN** it MUST fail its kind

#### Scenario: A currency in lower case

- **WHEN** an editor saves the currency `eur`
- **THEN** the save MUST be refused with a message asking for a three-letter code

#### Scenario: A field that is not an address

- **WHEN** a template links the author page to a field whose value is not an address
- **THEN** the author page MUST be left out

#### Scenario: Defaults are facts

- **WHEN** a node of a type whose structured data type is Article sets none of the Article details
- **THEN** its Article node's headline, image, dates and author name MUST come from its Title, Image, First published, Last updated and Author facts

### Requirement: Custom nodes can point at the module's nodes, never replace them

Custom nodes MUST be appended after the module's nodes. A `#name` `@id` MUST be
put on the entity's own URL. In strings, the module's fixed names MUST be
filled and other brace text kept. A top-level
custom node with one of the module's `@id`s MUST be dropped. A nested object
with one of them MUST become a bare reference, or be removed when that node is
not in the graph. When two custom nodes share an `@id`, the first MUST win.
Text that is not a usable node MUST add nothing.

#### Scenario: A search action

- **WHEN** a custom node has the `@id` `#search` and the target `{url}?q={search_term_string}`
- **THEN** its `@id` MUST be on the page's URL, `{url}` MUST be filled, and `{search_term_string}` MUST be kept

#### Scenario: Taking over the identity

- **WHEN** a custom node uses the `@id` `{home}#identity`
- **THEN** it MUST be dropped, and the module's identity MUST be unchanged

#### Scenario: Pointing at a withheld node

- **WHEN** a custom node references `#primary` and the main node is withheld
- **THEN** the reference MUST be removed

#### Scenario: A field name in custom JSON-LD

- **WHEN** a template's custom JSON-LD has the name `{field.field_byline}`
- **THEN** the name MUST be emitted as the text `{field.field_byline}`

#### Scenario: The fixed names

- **WHEN** a custom node's strings use `{title}`, `{description}`, `{site}`, `{sep}`, `{url}`, `{author}`, `{published}`, `{modified}` and `{image}`
- **THEN** each MUST be filled with the page's value
