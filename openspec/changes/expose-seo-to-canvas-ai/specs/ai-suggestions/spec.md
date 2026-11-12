## MODIFIED Requirements

### Requirement: Suggestions never change anything by themselves

A suggestion request MUST NOT write configuration, a page, or a Canvas draft,
whether it succeeds or fails. This holds for the dialog's route and for the
suggestion tool. A suggestion MUST reach the page only when the editor uses it
in the dialog. A used suggestion MUST then be saved like typed text, through
the dialog's own draft save and its validation.

#### Scenario: Asking for suggestions

- **WHEN** an editor asks for text suggestions and a structured data proposal
- **THEN** the site's configuration, the stored page and every Canvas draft MUST be unchanged

#### Scenario: Asking through the suggestion tool

- **WHEN** an agent runs the suggestion tool for a page with a Canvas draft
- **THEN** the site's configuration, the stored page and its Canvas draft MUST be unchanged

#### Scenario: Suggestions on screen

- **WHEN** text variants are shown and the editor has not chosen "Use"
- **THEN** the page's draft MUST NOT contain any of them

#### Scenario: Using a title variant

- **WHEN** the editor uses a title variant
- **THEN** the variant MUST become the page's title main part as typed text, the page's title ending MUST be unchanged, and the value MUST be saved into the page's draft

#### Scenario: A proposal on screen

- **WHEN** a structured data proposal is shown and not used
- **THEN** the page's structured data values MUST be unchanged

### Requirement: Calls are rate limited per user

The server MUST allow 30 suggestion calls per user per 5 minutes and answer
429 `rate_limited` after that, for both tasks. Calls of the suggestion tool
MUST count against the same limit, and a limited user MUST get the
`rate_limited` sentence from the tool. Requests refused as bad MUST NOT count.
Each user MUST have their own limit.

#### Scenario: The 31st call

- **WHEN** a user makes a 31st valid request within 5 minutes
- **THEN** the server MUST answer 429 `rate_limited`, and the provider MUST NOT be called

#### Scenario: Dialog and tool share the limit

- **WHEN** a user has made 30 suggestion tool calls within 5 minutes and then asks in the dialog
- **THEN** the server MUST answer 429 `rate_limited`, and the provider MUST NOT be called

#### Scenario: The tool after the limit

- **WHEN** a user has made 30 dialog requests within 5 minutes and an agent then runs the suggestion tool for them
- **THEN** the tool MUST fail with "The AI service is busy. Try again in a minute.", and the provider MUST NOT be called

#### Scenario: Another user

- **WHEN** another user asks while the first is limited
- **THEN** their request MUST succeed
