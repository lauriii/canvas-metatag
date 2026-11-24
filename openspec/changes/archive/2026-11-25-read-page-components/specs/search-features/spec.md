## ADDED Requirements

### Requirement: Breadcrumbs are a search feature

The rules file MUST include the breadcrumb feature: a `BreadcrumbList` with
at least two items with a name. (The module's own trail gives every item but
the last an address; the rules do not check a hand-added one's.)

#### Scenario: A complete trail

- **WHEN** the graph has a breadcrumb list of three named items
- **THEN** "Breadcrumb" MUST read "Can show"

#### Scenario: A trail of one

- **WHEN** a breadcrumb list added by hand has one item
- **THEN** "Breadcrumb" MUST read "Needs a second named item", its proof MUST say "With a second named item, it can show in results." with an Edit button beside Documentation, and its Checks row MUST say "Add a second named item to your breadcrumb trail", its detail "You added this breadcrumb trail by hand. It can show in results once it has one."

#### Scenario: A trail of two, one without a name

- **WHEN** a breadcrumb list added by hand has two items and only one has a name
- **THEN** "Breadcrumb" MUST read "Needs a second named item"
