## ADDED Requirements

### Requirement: A list fact links every item

The link menu of a list fact MUST start with a "Suggested" group of
multi-value fields whose label matches the fact. A multi-value field MUST be
noted "All ‹n›, in order", and one long text "Each list item, in order". A
single short value MUST be disabled with "One value, not a list". On other
facts a multi-value field MUST keep "First of ‹n›".

#### Scenario: Ingredients

- **WHEN** a builder opens the Ingredients link menu on a Recipe type with a multi-value Ingredients field and a formatted Method field
- **THEN** both MUST be under "Suggested", noted "All 8, in order" and "Each list item, in order"

#### Scenario: A summary on a list fact

- **WHEN** the type has a one-line Summary field
- **THEN** it MUST be listed disabled with "One value, not a list"

### Requirement: All parts of a group link in one action

On a template, "Link all parts to" MUST list the fields that can fill a whole
group: an address field, a reference whose target type has one, or a variant
family. It MUST open from the group label's link icon and as the first row
of the group's sheet. Choosing one MUST link every part in one draft write,
say "All ‹n› parts of ‹Group› linked to ‹Source›" with Undo, and leave each
part unlinkable alone.

#### Scenario: A venue reference

- **WHEN** a builder chooses "Venue › Address" for the Venue group of Every Event
- **THEN** name, street, postal code, city and country MUST each link to the venue's field, and the bar MUST read "All 5 parts of Venue linked to Venue › Address" with Undo

### Requirement: A linked group box only opens its sheet

A linked group box MUST open its sheet on click, Enter, Space or Alt+↓.
Backspace, Delete and printable keys MUST do nothing on it, and its tooltip
MUST read "‹Source› · ↵ open".

#### Scenario: Backspace on a linked venue

- **WHEN** focus is on the linked Venue box and the builder presses Backspace
- **THEN** every part MUST stay linked

### Requirement: The publisher is answered once per type

A reference's link menu MUST start with a "This site" group offering the
publisher. A workplace MUST instead offer "At ‹Site›'s address", only when
the identity's address is complete. On a template, an organizer, employer or
author that nobody has set MUST read "Not set" until the builder answers it.

#### Scenario: A new job type

- **WHEN** a builder sets up Every Job and has not chosen an employer
- **THEN** the Employer field MUST read "Not set", "Job posting" MUST read "Needs an employer", and the menu MUST offer "Example Studio (this site)" first

### Requirement: A linked duration says its unit

Linking a duration to a number field MUST ask once what the field counts
(minutes or hours for recipes, seconds or minutes for video), with the first
choice preselected, and store the answer with the link.

#### Scenario: Cook time in hours

- **WHEN** a builder links Cook time to "Cook hours" and answers hours, and a recipe holds 1.5
- **THEN** its `cookTime` MUST be `PT1H30M`
