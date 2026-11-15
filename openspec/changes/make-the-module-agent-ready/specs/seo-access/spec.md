## ADDED Requirements

### Requirement: A command run as an account applies the dialog's access

A command run with `--as` MUST check that account as the dialog's routes check
the user: reading drafts and stored values as the state does, writing a page
or template as a draft write does, writing site settings as a site save does.
A refusal MUST change nothing. Without `--as`, a command acts as the
administrator, and this access is emulation, not a security boundary.

#### Scenario: Update access without the permission

- **WHEN** a command runs `set` for a page as an account that may update it in Canvas but lacks `edit canvas metatag`
- **THEN** it MUST exit 2 with `forbidden`, and nothing MUST be written

#### Scenario: Site settings as an editor

- **WHEN** an account with `edit canvas metatag` only runs `set site`
- **THEN** it MUST exit 2 with `forbidden`

#### Scenario: Stored values as a visitor's account

- **WHEN** a command inspects a published page as an account that may only view it
- **THEN** the head MUST be the visitors' head, `values` and `inherited` MUST be `null`, and the rules that read them MUST be under `not_checked` with `needs_account`

#### Scenario: A draft without update access

- **WHEN** an account that may only view a page inspects it with `--draft`
- **THEN** it MUST exit 2 with `forbidden`

#### Scenario: A draft-only translation

- **WHEN** an account without update access inspects a translation that exists only as a Canvas draft
- **THEN** it MUST exit 2 with `not_found`
