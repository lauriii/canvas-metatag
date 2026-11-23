## ADDED Requirements

### Requirement: Free-text details can be composed

On a template, a free-text detail the registry marks (a name, a headline, a
description, a street address) MAY be composed. The joined text MUST be
checked and cut as typed text of that detail is. A composition holding a field
MUST count as given by each item. A Description fact in it MUST read as a
detail linked to the Description fact alone does.

#### Scenario: A street address from two fields

- **WHEN** "Every Venue"'s Street address detail is Street, " ", Number, and a venue holds "Main street" and "1"
- **THEN** that venue's `address.streetAddress` MUST be "Main street 1"

#### Scenario: A product name from the brand and the title

- **WHEN** "Every Product"'s name detail is Brand, " ", Title
- **THEN** each product's `name` MUST be its brand and title, and a product without a brand MUST be named by its title alone, with no space before it

#### Scenario: A result that fails its detail

- **WHEN** a composed detail's result is longer than the detail allows
- **THEN** it MUST be cut as typed text of that detail is, and it MUST NOT be reported as left out

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
