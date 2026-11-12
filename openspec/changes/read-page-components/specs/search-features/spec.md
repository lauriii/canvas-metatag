## ADDED Requirements

### Requirement: Breadcrumbs are a search feature

The rules file MUST include the breadcrumb feature: a `BreadcrumbList` with
at least two items, each with a name and, except the last, an address.

#### Scenario: A complete trail

- **WHEN** the graph has a breadcrumb list of four named items
- **THEN** "Breadcrumb" MUST read "Can show"

#### Scenario: A trail of one

- **WHEN** the breadcrumb list has only the current page
- **THEN** "Breadcrumb" MUST read "Needs 2 items"
