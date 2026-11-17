## ADDED Requirements

### Requirement: A Canvas page picks a page for a reference

On a Canvas page, a venue or workplace sheet MUST offer "A ‹venue› page",
which opens a picker listing only published, publicly viewable pages
described as an accepted kind.

#### Scenario: Picking a venue page

- **WHEN** an editor chooses "A venue page" and picks "Riverside Hall"
- **THEN** the Venue box MUST read the page's name and town, and the event MUST reference that page's main node

### Requirement: Linked pairs stack and show their reading

When either half of a pair is linked, the pair MUST stack. A linked value
MUST show "raw → reading" only when the reading converts the raw value, and
the reading alone otherwise. A tag MUST drop a parent shared by the pair or
group, keeping the full path in its tooltip. A linked group box's tooltip
MUST read "‹Source› · ↵ open".

#### Scenario: Linked prep and cook times

- **WHEN** Prep time and Cook time link to Prep minutes (20) and Cook minutes (55)
- **THEN** they MUST stack, reading "20 min" and "55 min"

#### Scenario: A linked price

- **WHEN** a price links to a decimal field holding 4200.00 and the currency is EUR
- **THEN** the box MUST read "4200.00 → €4,200"
