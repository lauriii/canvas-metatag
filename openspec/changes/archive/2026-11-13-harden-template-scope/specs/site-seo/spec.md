## ADDED Requirements

### Requirement: A site value sent back unchanged is kept

A site save that sends a value exactly as it is stored MUST accept it as
stored, even when it would no longer pass, so that the other site settings
stay savable. A value that differs from the stored one MUST be validated as
usual.

#### Scenario: A title that a configuration import made invalid

- **WHEN** the stored site title is `{field.field_x} {sep} {site}` after a configuration import, and an administrator changes only the logo
- **THEN** the save MUST be accepted, the logo MUST be stored, and the title MUST stay as stored

#### Scenario: Changing that title

- **WHEN** the administrator then changes that title to `{field.field_x} {sep} Example`
- **THEN** the save MUST be refused for `title` until the unknown value is removed
