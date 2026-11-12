## ADDED Requirements

### Requirement: Business details are a search feature

The rules file MUST include business details for a local business identity:
required name and address; recommended telephone and opening hours. It MUST
NOT apply to an organization or a person.

#### Scenario: A store with an address

- **WHEN** the identity is a Store with a name and a full address but no hours
- **THEN** "Business details" MUST read "Can show" and its proof MUST list opening hours under "Also helps"

#### Scenario: An organization

- **WHEN** the identity is an organization with an address
- **THEN** no business details verdict MUST be given
