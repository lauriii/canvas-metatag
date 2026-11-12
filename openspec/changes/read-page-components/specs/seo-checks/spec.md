## ADDED Requirements

### Requirement: Values from components are compared with the page

A structured data value that comes from a component MUST be compared with the
page like a typed value, because a component can hold a value it does not
show. A value not found MUST be listed to improve, naming the component.

#### Scenario: A hidden plan

- **WHEN** a pricing component holds a plan whose display is switched off
- **THEN** "From the Pricing table, but couldn't find “Starter” on this page" MUST be listed to improve

### Requirement: Skipped components are reported to builders

A component that was skipped (missing prop, error, access, personalization or
cacheability) and would have given a value MUST be listed to improve for
people who can administer SEO site settings, naming the component and, for a
missing prop, the prop and version.

#### Scenario: A renamed prop

- **WHEN** a page's component version lacks a prop a later change maps
- **THEN** the row MUST name the component, the prop and the version
