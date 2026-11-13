## ADDED Requirements

### Requirement: Parts left out of structured data are reported

Checks MUST list an incomplete group and dropped list items as to improve,
naming what is missing or why items were dropped. A list over its maximum
and a reference that fell back to a name MUST be good to know. Pay whose From
is above its To MUST be to fix. A variant sibling of another family MUST be
to improve.

#### Scenario: A venue without a country

- **WHEN** an event's venue has no country
- **THEN** Checks MUST list "Add the country to the venue's address" to improve, with "An address needs a street or city, and a country."

#### Scenario: A template's missing part that a reference can fill

- **WHEN** Every Event's Street address is empty and its Venue references venues with a Street field
- **THEN** the guidance under Street address and the Checks row MUST offer "Link to Venue › Street", which links it in one action, and MUST NOT only ask to add a value the template cannot type

#### Scenario: Pay in the wrong order

- **WHEN** a job's linked pay has From 5000 and To 4200
- **THEN** Checks MUST list it to fix, and no `baseSalary` MUST be emitted

### Requirement: Recipe times are checked as a pair and in their unit

A recipe with a prep time and no cook time, or the reverse, MUST be listed to
improve as "Add the cook time, or give a total time instead". A linked
recipe time that reads as more than a day MUST be listed to improve with
"Change the unit".

#### Scenario: Minutes read as hours

- **WHEN** Prep time links to a field answered as hours and a recipe holds 45
- **THEN** Checks MUST ask "Is Prep time in hours or minutes?"

### Requirement: Facts that speak for the site are noted

On a Canvas page, an organizer, employer or recipe author that is the
publisher only by default MUST be good to know until the editor changes or
confirms the field. A byline linked as text that holds " and ", "&" or a
comma MUST be good to know with "If this names several people, link a field
with one person per value."

#### Scenario: The default organizer

- **WHEN** an event page's organizer was never touched
- **THEN** Checks MUST list "The organizer is your site" as good to know, and touching the field MUST remove it
