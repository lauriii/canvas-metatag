## ADDED Requirements

### Requirement: Structured data that can't be encoded never removes the head

When the structured data can't be encoded, the head MUST still carry every
other tag the module outputs, robots included, and only the JSON-LD script
MUST be left out. The same MUST hold for the headless head. The dialog's
report MUST say so.

#### Scenario: A value stored before validation

- **WHEN** a no-index page's stored hand-added JSON-LD decodes to a number that can't be encoded
- **THEN** its head MUST carry its title, description, canonical and `noindex` robots tag, and no JSON-LD script
