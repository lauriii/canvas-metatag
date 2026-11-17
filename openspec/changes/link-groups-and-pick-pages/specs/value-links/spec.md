## ADDED Requirements

### Requirement: All parts of a group link in one action

On a template, "Link all parts to" MUST list the fields that can fill a whole
group: an address field, or a reference whose target type has the parts. It
MUST open from the group label's link icon and as the first row of the
group's sheet. Choosing one MUST link every part in one draft write, say
"All ‹n› parts of ‹Group› linked to ‹Source›" with Undo, and leave each part
unlinkable alone.

#### Scenario: A venue reference

- **WHEN** a builder chooses "Venue › Address" for the Venue group of Every Event
- **THEN** name, street, postal code, city and country MUST each link to the venue's field, and the bar MUST read "All 5 parts of Venue linked to Venue › Address" with Undo

#### Scenario: A venue with its address in separate fields

- **WHEN** Every Event's Venue references venues whose street, postal code, city and country are separate text fields
- **THEN** "Link all parts to" MUST offer Venue, show which venue field each part will link to before anything is written, link the confirmed parts in one draft write, and name the parts it could not match

### Requirement: A missing part a reference can fill offers that field

On a template, a group's missing part that a reference of the type can fill
MUST offer "Link to ‹Reference› › ‹Field›" in its guidance and in its Checks
row, linking it in one action.

#### Scenario: A template's missing street

- **WHEN** Every Event's Street address is empty and its Venue references venues with a Street field
- **THEN** the guidance under Street address and the Checks row MUST offer "Link to Venue › Street"

### Requirement: A reference's menu offers only pages of a kind it accepts

A reference's link menu MUST leave out reference fields whose targets are
described as a kind the reference does not accept.

#### Scenario: An organizer's menu

- **WHEN** Every Event has a Venue reference to place pages and an Organizer that accepts people and organizations
- **THEN** the Organizer's link menu MUST NOT offer Venue
