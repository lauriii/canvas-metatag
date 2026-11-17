## ADDED Requirements

### Requirement: A list fact links every item

The link menu of a list of text MUST start with a "Suggested" group of
multi-value fields whose label matches the fact. A multi-value field MUST be
noted "All ‹n›, in order", and one long text "Each list item, in order". A
single short value, a field or a fact, MUST be disabled with "One value, not
a list". A list of codes MUST take a list field of codes, of one value or
several, and never one long text's items. On other facts a multi-value field
MUST keep "First of ‹n›".

#### Scenario: Ingredients

- **WHEN** a builder opens the Ingredients link menu on a Recipe type with a multi-value Ingredients field and a formatted Method field
- **THEN** Ingredients MUST be first, under "Suggested", noted "All 8, in order", and Method MUST be noted "Each list item, in order"

#### Scenario: A summary on a list fact

- **WHEN** the type has a one-line Summary field
- **THEN** it MUST be listed disabled with "One value, not a list", and so MUST the page title

#### Scenario: One employment type per job

- **WHEN** a job type has a single-value Employment list field holding PART_TIME
- **THEN** Employment type MUST link to it, and a job holding PART_TIME MUST emit `employmentType` `PART_TIME`

### Requirement: A linked group box only opens its sheet

A group box, linked or not, MUST open its sheet on click, Enter, Space or
Alt+↓. Backspace, Delete and printable keys MUST do nothing on it.

#### Scenario: Backspace on a linked venue

- **WHEN** focus is on the linked Venue box and the builder presses Backspace
- **THEN** every part MUST stay linked

### Requirement: The publisher is answered once per type

The publisher MUST be offered before any field: in a reference's link menu
as its own "This site" group, first, and in the choice of who as "‹Site›
(this site)". On a template, an organizer, employer or author that nobody
has set MUST read "Not set", with what it is needed for, until the builder
answers it.

#### Scenario: A new job type

- **WHEN** a builder sets up Every Job and has not chosen an employer
- **THEN** the Employer field MUST read "Not set" with "Needed for job listings", and its choices MUST be "Not set", "Example Studio (this site)" and "Someone else"

### Requirement: A linked duration says its unit

Linking a duration to a number field MUST ask what the field counts
(minutes or hours for recipes), with the first choice preselected, in one
question beside the linked box, and store the answer with the link.

#### Scenario: Cook time in hours

- **WHEN** a builder links Cook time to "Cook hours" and answers hours, and a recipe holds 1.5
- **THEN** its `cookTime` MUST be `PT1H30M`
