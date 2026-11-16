## MODIFIED Requirements

### Requirement: Only people with update access read drafts

The dialog's state MUST include draft data (draft values, the draft label, the
facts and link values read from the draft, and the output built from them)
only for a user with Canvas's update access to the page or template. Anyone
else MUST get what is stored and `has_draft: false`. A translation that exists
only as a Canvas draft MUST be reported as not found to users without update
access. Update access without `edit canvas metatag` MUST give the draft with
`can.target: false`.

#### Scenario: A viewer of a page with a draft

- **WHEN** a user who may view but not update a page with an SEO draft asks for its state
- **THEN** the response MUST contain the stored values and the published title, MUST say `has_draft: false`, and MUST NOT contain any draft text

#### Scenario: A viewer of a template with a draft

- **WHEN** a user who may view but not update a template asks for its state while it has a draft
- **THEN** the values and the previewed title MUST be the stored ones, with `has_draft: false`

#### Scenario: A draft-only translation

- **WHEN** a user without update access asks for the state of a translation that exists only as a Canvas draft
- **THEN** the system MUST answer 404, so that they do not learn that the draft exists

#### Scenario: Update access, administrative permission only

- **WHEN** a user who may update the page and has `administer canvas metatag` but not `edit canvas metatag` asks for its state
- **THEN** the response MUST include the draft, with `can.target: false`

#### Scenario: Link values of an unpublished node

- **WHEN** a user asks for a template's state while the previewed node is unpublished and one of its linked fields is one that user may not view
- **THEN** that field's value MUST NOT be in the response
