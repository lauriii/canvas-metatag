## MODIFIED Requirements

### Requirement: A write is validated as a whole

Every write MUST be validated before anything is written, with the rules of its
scope (page-seo, template-seo, dynamic-values, structured-data). An invalid
write MUST be answered with 422 `invalid` and one sentence per refused field,
keyed by its dotted path, and MUST write nothing. A value sent back exactly as
the draft, or else the stored entity, holds it MUST be accepted as it is, even
when it would no longer pass, so that the other fields stay savable.

#### Scenario: Two invalid fields

- **WHEN** a page write links the title ending to a field and has the canonical `pricing`
- **THEN** the system MUST answer 422 naming `title_end` and `canonical`, and MUST NOT create a draft

#### Scenario: A stored value that no longer passes

- **WHEN** a template's stored description links to a field that was deleted, and a write changes only the title
- **THEN** the write MUST be accepted with the description as stored
- **AND** a write that links the description to another field the link menu does not offer MUST be refused with "Choose a field from the list."
