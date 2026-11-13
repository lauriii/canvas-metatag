## ADDED Requirements

### Requirement: Values are readable without a node to preview

The state of a type's Full content template MUST be available without a
preview node. It MUST then hold the template's values, its draft for users with
update access, the type's vocabulary without values, no preview and no output.

#### Scenario: A type with no content

- **WHEN** the state of the Announcement template is asked for without a preview node and the type has no content
- **THEN** the system MUST answer with the template's values, `preview: null` and `resolved: null`

#### Scenario: Another template without a node

- **WHEN** the state of the Article teaser template, or of the Full content template of a type that has none, is asked for without a preview node
- **THEN** the system MUST answer 404 `not_found`
