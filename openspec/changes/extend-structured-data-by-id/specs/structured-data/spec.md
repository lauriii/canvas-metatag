## ADDED Requirements

### Requirement: Details can be added to the module's own nodes

A page or template MAY add JSON details to its main node or page node, and
the site to its identity, matched by `@id`. Added details MUST be validated
like custom JSON-LD, share its 32 KB limit, and merge into the node at any
depth. They MUST NOT change the node's `@id` or `@type`, except to add a type
to a list that keeps the node's own type.

#### Scenario: Details inside an offer

- **WHEN** a product adds `{"sku": "OAK-DL-01", "offers": {"itemCondition": "https://schema.org/NewCondition"}}`
- **THEN** the Product node MUST carry the SKU and its offer the item condition, next to the price it already had

#### Scenario: Changing the type

- **WHEN** added details set `"@type": "Service"` on a product
- **THEN** the save MUST be refused with a message that the type can only be added to

### Requirement: The page's own values win per leaf

Where added details set a value the module emits, from a field, a fact, a
component, Search, Social or the site, the module's value MUST be kept, the
other added values MUST still merge, and the clash MUST be reported with its
path.

#### Scenario: A price from the Price field

- **WHEN** added details set `offers.price` to 79 and `offers.shippingDetails`, and the Price field holds 89
- **THEN** the offer MUST keep 89, carry the shipping details, and report a clash at `offers.price`

### Requirement: Added details can reach items of a list

For a list the module emits, added details MUST name `‹list›[*]` to merge into
every item or `‹list›[name=‹name›]` to merge into the item with that name. A
selector that matches no item MUST be reported.

#### Scenario: One plan

- **WHEN** a service with three offers adds `{"offers[name=Growth]": {"eligibleQuantity": 5}}`
- **THEN** only the Growth offer MUST carry it

#### Scenario: No such plan

- **WHEN** the selector is `offers[name=Pro]` and no offer is named Pro
- **THEN** nothing MUST merge and the report MUST name the selector

### Requirement: A hand-added item can be the page's main thing

When a page is a plain web page, the editor MAY mark one hand-added item as
what the page is mainly about. The page node MUST then reference it as
`mainEntity` and the item MUST carry `mainEntityOfPage` pointing at the page
node. With any other kind the mark MUST be ignored and reported.

#### Scenario: A recipe added by hand

- **WHEN** a web page marks its hand-added `#x-recipe` item as its main thing
- **THEN** the page node's `mainEntity` MUST be `{"@id": "‹url›#x-recipe"}`
