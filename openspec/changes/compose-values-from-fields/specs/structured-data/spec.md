## ADDED Requirements

### Requirement: Free-text details can be composed

On a template, a structured data detail the registry marks as free text, such
as a name, a headline, a description or a street address, MAY be composed.
The joined text MUST then be checked as typed text of that detail is, and a
result that fails MUST be dropped and reported. A composition that holds a
field MUST count as given by each item, never as the same text on every item.
A Description fact inside it MUST read the same description as a detail
linked to the Description fact alone.

#### Scenario: A street address from two fields

- **WHEN** "Every Venue"'s Street address detail is Street, " ", Number, and a venue holds "Main street" and "1"
- **THEN** that venue's `address.streetAddress` MUST be "Main street 1"

#### Scenario: A product name from the brand and the title

- **WHEN** "Every Product"'s name detail is Brand, " ", Title
- **THEN** the dialog MUST NOT say the name is the same for every product, and each product's `name` MUST be its brand and title

#### Scenario: A result that fails its detail

- **WHEN** a composed detail's result is longer than the detail allows
- **THEN** it MUST be cut as typed text of that detail is, and a result that still fails MUST be left out and listed in the report

#### Scenario: Words after the description

- **WHEN** "Every Product"'s description detail is Description, " Free delivery.", and the head's description differs from the product's own Description fact
- **THEN** the detail MUST start with the head's description, as a detail linked to Description alone does

### Requirement: A referenced page's composed details are read

When a page names another page as a place, an organizer or a similar item, its
details MUST be read from that page's own values, composed ones included, with
that page's own fields and facts, in the referencing page's language.

#### Scenario: A venue's composed address on an event

- **WHEN** an event names the venue whose Street address is Street, " ", Number
- **THEN** the event's `location.address.streetAddress` MUST be "Main street 1"

#### Scenario: The venue's own title

- **WHEN** "Every Venue"'s Street address detail is Title, ", ", Street, and the event "Summer Gala" names the venue "Royal Hall" on "Main street 1"
- **THEN** the event's `location.address.streetAddress` MUST be "Royal Hall, Main street 1", never "Summer Gala, Main street 1"
