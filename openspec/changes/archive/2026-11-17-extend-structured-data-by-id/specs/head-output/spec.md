## ADDED Requirements

### Requirement: Structured data that can't be encoded never removes the head

When the structured data can't be encoded, the head MUST still carry every
other tag the module outputs, robots included, and only the JSON-LD script
MUST be left out. The same MUST hold for the headless head. The dialog's
report MUST say so.

#### Scenario: A value stored before validation

- **WHEN** a no-index page's stored hand-added JSON-LD has an item with a number that can't be encoded (`1e400`)
- **THEN** its head MUST carry its title, description, canonical and `noindex` robots tag, and its JSON-LD MUST leave out that item and keep the others

#### Scenario: Structured data that can't be encoded

- **WHEN** the built structured data can't be encoded
- **THEN** only the JSON-LD script MUST be left out, and the dialog's report MUST carry `unencodable`
