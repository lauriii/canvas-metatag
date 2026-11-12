## ADDED Requirements

### Requirement: Clashes with added details are listed

Each added detail the module's own value overrides MUST be listed to improve,
naming the path and where the kept value comes from, and leading to the Add
details sheet.

#### Scenario: A price clash

- **WHEN** added details set `offers.price` and the Price field sets the price
- **THEN** "“offers.price” comes from the Price field, so the added value isn't used" MUST be listed to improve
