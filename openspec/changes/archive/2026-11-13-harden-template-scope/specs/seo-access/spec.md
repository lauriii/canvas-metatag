## MODIFIED Requirements

### Requirement: The API is for signed-in browsers

The API MUST accept browser sessions only, never a bearer token, and its
responses MUST NOT be cached. Every unsafe method MUST require a valid CSRF
header token when the request carries a session cookie. Every refusal by the
module's controllers MUST be JSON `{error: {code, message}}`, with `fields`
added for a refusal of values. The dialog MUST fetch a new CSRF token and try
once more when a write is denied by the route.

#### Scenario: Missing CSRF token

- **WHEN** a draft write or site save with a session cookie has no `X-CSRF-Token` header, or a wrong one
- **THEN** the system MUST deny it with 403

#### Scenario: Reads need no token

- **WHEN** a user with a session reads the state or the media list without a CSRF header
- **THEN** the system MUST answer 200

#### Scenario: A state request that cannot be read

- **WHEN** the state is asked for with a langcode but no page, with a langcode for a template, with a preview node but no template, or with an entity type other than a page or a template
- **THEN** the system MUST answer 400 `bad_request`

### Requirement: Viewing needs view access

The state of a page MUST require view access to the page translation. The state
of a template MUST require view access to the template and, when it is
previewed with a node, to that node. Without view access the system MUST answer
403 `forbidden`.

#### Scenario: An unpublished page

- **WHEN** a user with `edit canvas metatag` who may not view an unpublished page asks for its state
- **THEN** the system MUST answer 403 `forbidden`

#### Scenario: A template without Canvas access

- **WHEN** a user with `edit canvas metatag` and no access to Canvas asks for a template's state
- **THEN** the system MUST answer 403 `forbidden`

#### Scenario: A template without a node, without Canvas access

- **WHEN** a user with `edit canvas metatag` and no access to Canvas asks for a template's state without a preview node
- **THEN** the system MUST answer 403 `forbidden`
