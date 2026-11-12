## MODIFIED Requirements

### Requirement: One resolver serves every consumer

The coupled HTML head, the headless `head` member and the `resolved` member of
the dialog's state MUST all be the head the module resolves for the entity, so
that what an editor sees is what a visitor gets. Verdicts, rules and checks
that only the dialog shows MUST be computed for the dialog's state alone and
never while a visitor's head is built.

#### Scenario: Publishing an override

- **WHEN** an editor publishes a page with a title override
- **THEN** the visitor's HTML head MUST carry it once, and the state's `resolved` head for the published page MUST be the same

#### Scenario: A visitor's request

- **WHEN** a visitor requests a product page that misses the page cache
- **THEN** search feature verdicts and structured data rules MUST NOT be computed
