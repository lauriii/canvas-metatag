## ADDED Requirements

### Requirement: Authors link to their own pages

When an article's author is linked to a reference field, each referenced
entity MUST be one `author` entry, in field order. An entry MUST reference the
target's main node and carry its type, name and address when the target is
published, visible to anonymous visitors, described as a person's or an
organization's profile, and named; otherwise it MUST be a `Person` with the
name only.

#### Scenario: Two writers with profile pages

- **WHEN** an article's Writer field references Ada and Bo, both with public profile pages
- **THEN** `author` MUST hold two entries in that order, each `{"@id": "‹page›#primary", "@type": "Person", "name": …, "url": "‹page›"}`

#### Scenario: An unpublished profile

- **WHEN** Bo's profile page is unpublished
- **THEN** Bo's entry MUST be `{"@type": "Person", "name": "Bo"}`

#### Scenario: An organization as author

- **WHEN** the Writer field references a page described as an organization's profile
- **THEN** its entry's `@type` MUST be `Organization`
