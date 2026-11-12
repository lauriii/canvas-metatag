## MODIFIED Requirements

### Requirement: Structured data proposals

A schema request MUST return one type from the module's registry, values only
for that type's text properties that the registry does not reserve for
people, and the keys whose value could not be verified. Prices, currencies,
identifiers, dates, authors and ratings MUST be reserved for people. A text
value MUST count as verified only when the page text contains it, ignoring
case and white space.

#### Scenario: A type outside the registry

- **WHEN** the model answers with a type the registry does not have, or with none
- **THEN** the server MUST answer `invalid_response`

#### Scenario: Reserved and non-text properties

- **WHEN** the model returns a price, a currency, an availability, an SKU, an image, an event status, a start date, an author or an `@id`
- **THEN** none of them MUST be in the proposal

#### Scenario: A value not on the page

- **WHEN** a proposed venue does not appear in the page text
- **THEN** its key MUST be listed as unverified

#### Scenario: A value on the page in another case and spacing

- **WHEN** the page text contains the proposed venue in capitals and with extra spaces
- **THEN** the venue MUST count as verified

#### Scenario: A type without details

- **WHEN** the proposal is a type that has no property a model may fill
- **THEN** the server MUST return the type with an empty `props` object and no unverified keys

#### Scenario: A value that does not fit its property

- **WHEN** a proposed value is not a valid literal for its property
- **THEN** it MUST be left out of the proposal

### Requirement: Structured data proposals are reviewed in the dialog

The dialog MUST show the proposed kind and its verified details, ticked.
Unverified details MUST NOT be offered; the dialog MUST only count them. A
reserved fact the kind needs MUST be shown as "Add it yourself". "Use
selected" MUST apply only the kind and the ticked details. When the new kind
would drop details of the current one, the dialog MUST say which and ask
before applying.

#### Scenario: Unverified details

- **WHEN** a proposal lists one key as unverified
- **THEN** the dialog MUST NOT show its value and MUST say "1 more guess wasn't found on the page"

#### Scenario: A start date

- **WHEN** the proposal is an event
- **THEN** the dialog MUST show "Starts · Add it yourself" with "AI doesn't fill in dates, prices or authors."

#### Scenario: A type change that drops details

- **WHEN** the editor uses a proposal of another kind and the current kind has details the new one lacks
- **THEN** the dialog MUST name the details that would be removed, and apply only when the editor confirms
