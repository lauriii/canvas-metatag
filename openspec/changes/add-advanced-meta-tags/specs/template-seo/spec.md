## ADDED Requirements

### Requirement: A type may set other tags and a stop date

A content type MAY set other tags (other-tags) and a stop date, stored in the
template's setting and published with it. The stop date MAY be typed or linked
to a date field of the type or to a page date fact (value-links). Both MUST be
the same in every language.

#### Scenario: A stop date linked to a field

- **WHEN** "Every Event" links the stop date to End date and the template is published
- **THEN** each event's robots MUST carry its own End date as `unavailable_after`

#### Scenario: A link to a field that is not a date

- **WHEN** a template write links the stop date to a text field
- **THEN** the system MUST refuse `expires`

#### Scenario: Rows in the draft

- **WHEN** an editor adds a row to "Every Article" and has not published the template
- **THEN** visitors MUST NOT get the row, and the editor's previews and Output MUST show it
