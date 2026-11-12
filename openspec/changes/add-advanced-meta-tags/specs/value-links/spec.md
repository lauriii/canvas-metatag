## MODIFIED Requirements

### Requirement: Where values can be linked

At template scope, every value field MUST offer linking: the title's main part
and ending, the description, the social title, description and image, each
structured data detail except a choice of options, the stop date, and the
content or address of each other tag. At page scope only structured data
details of kind address, date and image MUST offer it, to the page's facts of
that kind. Site settings, and a page's title, description, social texts, stop
date and other tags, MUST NOT offer it.

#### Scenario: A template's description

- **WHEN** an editor opens the Search tab of "Every Article"
- **THEN** the Description field MUST have a button named "Link Description to a field"

#### Scenario: A page's date detail

- **WHEN** an editor opens the Schema tab of an Article page
- **THEN** the date details MUST offer linking to "First published" and "Last updated", and the page's title and description MUST NOT offer linking

#### Scenario: Site settings

- **WHEN** an administrator opens Site
- **THEN** no field MUST offer linking

#### Scenario: A template's stop date

- **WHEN** an editor opens Search › Advanced of "Every Event"
- **THEN** "Stop showing after" MUST have a button named "Link Stop showing after to a field", and its menu MUST offer only date fields and the date facts

#### Scenario: A page's stop date

- **WHEN** an editor opens Search › Advanced of a Canvas page
- **THEN** "Stop showing after" MUST be a date input without a link button
