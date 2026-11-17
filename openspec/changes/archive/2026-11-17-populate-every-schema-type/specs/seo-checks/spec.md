## ADDED Requirements

### Requirement: Parts left out of structured data are reported

Checks MUST list an incomplete group and dropped list items as to improve,
naming what is missing by its own name ("the name", "how often it is paid")
or why items were dropped. A list over its maximum, a reference that fell
back to a name and a closed job MUST be good to know. Pay whose From is above
its Up to MUST be to fix, and said under the Pay box. A list page short of
complete pages MUST say how many count.

#### Scenario: A venue without a country

- **WHEN** an event's venue has no country
- **THEN** Checks MUST list "Add the country to the venue's address" to improve, with "An address needs a street or city, and a country."

#### Scenario: A list page of courses

- **WHEN** a list page links five pages, two of them complete courses
- **THEN** Checks MUST list "Course list: 2 of the 5 linked pages are complete courses" to improve

#### Scenario: Pay in the wrong order

- **WHEN** a job's linked pay has From 5000 and Up to 4200
- **THEN** Checks MUST list it to fix, and no `baseSalary` MUST be emitted

### Requirement: A part is asked for once

What a feature asks more of a group that is incomplete MUST be in the
group's row, with what it is needed for; a part asked for there MUST NOT be
asked for again for a feature. A part whose stored value does not fit (a
country typed as a name) MUST be asked for only where it is dropped.

#### Scenario: A venue with a street only

- **WHEN** an event's venue has a name and a street, and no city or country
- **THEN** Checks MUST list "Add the city and the country to the venue's address" to improve, with "Needed for event listings.", and no other row for the city or the country

#### Scenario: An organizer with only a website

- **WHEN** an event page's organizer is someone else with only a website
- **THEN** Checks MUST list "Add the name to the organizer"

#### Scenario: A country stored as a name

- **WHEN** a venue's country is stored as "Finland"
- **THEN** Checks MUST list "Choose the country from the list" once, and not "Add the country to the venue's address"

### Requirement: Recipe times are checked as a pair and in their unit

A recipe with a prep time and no cook time, or the reverse, MUST be listed to
improve as "Add the cook time, or give a total time instead". A linked
recipe time that reads as more than a day MUST be listed to improve with
"Change the unit".

#### Scenario: Minutes read as hours

- **WHEN** Prep time links to a field answered as hours and a recipe holds 45
- **THEN** Checks MUST ask "Is Prep time in hours or minutes?", and "Change the unit" MUST answer minutes

### Requirement: Facts that speak for the site are noted

On a Canvas page, an organizer or recipe author that is the publisher only
by default MUST be good to know until the editor changes or confirms the
field; choosing "Someone else" changes it, before any name is typed. A byline linked as text that holds " and ", "&" or a
comma MUST be good to know with "If this names several people, link a field
with one person per value."

#### Scenario: The default organizer

- **WHEN** an event page's organizer was never touched
- **THEN** Checks MUST list "The organizer is your site" as good to know, and touching the field MUST remove it
