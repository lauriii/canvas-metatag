## ADDED Requirements

### Requirement: Tools check access on every call

Every SEO tool MUST check, on every call and for the current user, the
permission `edit canvas metatag` and Canvas's view and update access to the
page translation it reads. The suggestion tool MUST also require "Use AI
suggestions for SEO". The administrative permission MUST NOT replace the edit
permission. A tool MUST NOT rely on the agent or caller that runs it to check
access.

#### Scenario: Anonymous

- **WHEN** an anonymous user's request runs the read tool for a published page
- **THEN** the call MUST be refused, and nothing of the page MUST be in any output

#### Scenario: Update access without the permission

- **WHEN** a user who may edit the page in Canvas, without `edit canvas metatag`, runs a tool for it
- **THEN** the call MUST be refused

#### Scenario: The permission without update access

- **WHEN** a user with `edit canvas metatag` who may view but not update a page runs a tool for it
- **THEN** the call MUST be refused, so that no draft data reaches them

#### Scenario: Suggestions without the AI permission

- **WHEN** a user with `edit canvas metatag` and update access, without "Use AI suggestions for SEO", runs the suggestion tool
- **THEN** the call MUST be refused, and the provider MUST NOT be called

#### Scenario: Administrative permission only

- **WHEN** a user with `administer canvas metatag` and update access, without `edit canvas metatag`, runs the read tool
- **THEN** the call MUST be refused

### Requirement: Tool refusals say nothing about the page

A refused tool call MUST fail with one fixed sentence, "You may not see this
page's SEO settings.", whatever the reason. It MUST NOT say whether the page is
published, has a draft, or which check failed.

#### Scenario: An unpublished page

- **WHEN** a user who may not view an unpublished page runs the read tool for it
- **THEN** the call MUST fail with "You may not see this page's SEO settings."

#### Scenario: A page the user may view but not update

- **WHEN** a user with `edit canvas metatag` who may view a page with a draft but not update it runs the read tool
- **THEN** the call MUST fail with the same sentence, and MUST NOT say that a draft exists
