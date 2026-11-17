## ADDED Requirements

### Requirement: Decimal fields a reference reaches can be linked

A number value MUST be linkable to a decimal field of a type the template's
type references, one hop away, read as its exact digits without trailing
zeros and never through floating point.

#### Scenario: A venue's ticket price

- **WHEN** a price links to Venue › Standard price, a decimal field holding 89.990000
- **THEN** the value MUST be `89.99`
