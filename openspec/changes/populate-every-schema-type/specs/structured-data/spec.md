## MODIFIED Requirements

### Requirement: Page types come from one registry

The types MUST be the registry's: Web page, About page, Contact page,
Collection page, Article, Blog post, News article, Event, Product, Service,
Profile, Job posting, A place people visit, Recipe and Course. An absent or
unknown type MUST be a plain Web page, and the report MUST name it. Blog post
and News article MUST have Article's properties with their own main type. A
property key MUST be one the type has; values without a type of their own
belong to the inherited type.

#### Scenario: An unknown type

- **WHEN** the stored type is `Movie`
- **THEN** the graph MUST be that of a Web page, with no main node
- **AND** the report MUST carry `unknown_type: "Movie"`

#### Scenario: A blog post

- **WHEN** the type is Blog post
- **THEN** the main node's `@type` MUST be `BlogPosting` and the page node's `WebPage`

#### Scenario: A property of another type

- **WHEN** a page of the type Article saves the detail `offers_price`
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: A service

- **WHEN** the type is Service with a name and a price
- **THEN** the main node MUST be a `Service` whose `provider` references the identity and whose `offers` is one `Offer`

#### Scenario: A recipe

- **WHEN** a node of a type described as Recipe has a name and an image
- **THEN** the main node MUST be a `Recipe` at `{url}#primary`

### Requirement: Values are emitted in schema.org form

Text MUST be plain text cut at 2000 characters, except a job description.
An enum MUST be emitted as its property declares: `https://schema.org/<Value>`
(the default), the bare code, or the node's `@type`. A date with a time and
no offset MUST get the site timezone's offset that day; other dates MUST be
emitted as stored. An image MUST be an `ImageObject` with its URL, and its
width and height only when known. A group MUST be a nested node typed by the
registry. Every `@id` MUST be absolute.

#### Scenario: A local start time

- **WHEN** an event starts at `2026-07-01T18:00:00` and the site timezone is America/New_York
- **THEN** `startDate` MUST be `2026-07-01T18:00:00-04:00`

#### Scenario: A venue address

- **WHEN** an event sets a venue name and a street address
- **THEN** `location` MUST be a `Place` with that name and an `address` that is a `PostalAddress`

#### Scenario: Codes, addresses and types

- **WHEN** a job is full-time and fully remote, and a place's kind is Restaurant
- **THEN** `employmentType` MUST be `FULL_TIME`, `jobLocationType` MUST be `TELECOMMUTE`, and the place's `@type` MUST be `Restaurant`
- **AND** an event's `eventStatus` MUST still be `https://schema.org/EventScheduled`

#### Scenario: A summary left at its default

- **WHEN** an article's summary is not set
- **THEN** its `description` MUST be the head's description, not the raw text it was cut from

#### Scenario: An image without dimensions

- **WHEN** an image has no stored width or height
- **THEN** its nodes MUST carry no `width` or `height`

### Requirement: No text can leave the script element

The coupled script MUST be encoded with `<`, `>`, `&`, `'` and `"` as JSON
escapes, and with U+2028 and U+2029 escaped, so that no text can end the
script element or open a comment in it. It MUST be the only markup the module
declares safe. The module's own texts MUST be normalized as plain text,
except a job description, which MUST keep only `p`, `ul`, `ol`, `li`, `br`,
`strong`, `em` and `a` with an absolute http(s) `href`. Custom text MUST be
kept as typed.

#### Scenario: A hostile title

- **WHEN** a page title, the site name and a custom node contain `</script><script>alert(1)</script> <!-- -->`
- **THEN** the HTML MUST contain exactly one script element, which MUST decode to the graph
- **AND** the body MUST be unchanged

#### Scenario: A hostile job description

- **WHEN** a job's linked description holds `<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">apply</a><ul><li>Design</li></ul>`
- **THEN** its `description` MUST be `<p>Hi</p><a>apply</a><ul><li>Design</li></ul>`
- **AND** the HTML MUST contain exactly one script element, which MUST decode to the graph

## ADDED Requirements

### Requirement: A type is offered only where every property has a way in

The registry MUST say on which scopes (Canvas page, template) a type or
property is not offered, with a reason. A property MUST NOT be offered on a
scope where only custom JSON-LD could fill it, and no property a type's
search feature requires MAY be withheld from a scope where the type is
offered. A value for a type or property not offered on that scope MUST be
refused.

#### Scenario: Ingredients on a Canvas page

- **WHEN** a Canvas page described as a recipe saves `recipeIngredient`
- **THEN** the save MUST be refused with "This comes from a field or a component."

#### Scenario: A job posting on a Canvas page

- **WHEN** an editor lists the kinds for a Canvas page
- **THEN** Job posting MUST NOT be among them, and every template kind list MUST include it

### Requirement: Lists keep every item in order

A list property MUST emit every item of its source in field order, without
empty items, up to its maximum. Duplicates MUST be removed only from lists
of references, addresses, images, codes and profile links; text lists keep
repeats. A typed value MUST be several codes on a code list, one value on a
url, image or reference list, and is refused on a text list.

#### Scenario: Salt twice

- **WHEN** a recipe's Ingredients field holds "1 tsp salt", "200 g flour" and "1 tsp salt"
- **THEN** `recipeIngredient` MUST hold all three, in that order

#### Scenario: Three writers

- **WHEN** an article's author links to a Writers field with Ada, Bo and Ada
- **THEN** `author` MUST hold two entries, Ada then Bo

#### Scenario: Typed ingredients

- **WHEN** a template types `recipeIngredient` as text
- **THEN** the save MUST be refused with "This comes from a field or a component."

### Requirement: A group is one nested node or nothing

A group MUST be emitted only when its required parts resolve; otherwise it
MUST be left out and the report MUST name it as incomplete with the missing
parts. A required group left out MUST withhold the main node. A group MUST
NOT sit inside a list. A suggested value, such as the publisher's country,
MUST never be emitted unless it was chosen.

#### Scenario: An address without a country

- **WHEN** an event's venue has a name, a street and a city but no country, and the publisher is in Finland
- **THEN** `location` MUST carry no `address`, and the report MUST list `location_address` as incomplete, missing `addressCountry`

#### Scenario: No venue at all

- **WHEN** an event has a start date and no venue
- **THEN** the graph MUST have no Event node and the report MUST say the venue is missing

### Requirement: References point at the thing, or name it

A reference MUST be `{"@id": "{home}#identity"}` for the publisher. For a
page that is published, viewable by anonymous visitors, named, and described
as an accepted kind (a subtype counts as its ancestors), it MUST be the
page's main node `@id` with its type, name, URL and any inline address.
Otherwise it MUST be the property's inline type with the name only. The
target's cache tags MUST join the head.

#### Scenario: A restaurant as a venue

- **WHEN** an event's venue links to a published page described as a Restaurant with an address
- **THEN** `location` MUST be `{"@id": "‹page›#primary", "@type": "Restaurant", "name": …, "url": "‹page›", "address": {…}}`

#### Scenario: An unpublished profile

- **WHEN** a performer's profile page is unpublished
- **THEN** that performer MUST be `{"@type": "Person", "name": …}` and the report MUST list it under `refs_inline` with `not_public`

#### Scenario: A profile about the publisher

- **WHEN** an author links to a profile page that is about the publisher
- **THEN** that author MUST be `{"@id": "{home}#identity"}`

#### Scenario: Two workplaces

- **WHEN** a job's workplaces link to two office pages in one city, one without a postal code
- **THEN** `jobLocation` MUST hold two places, each with its own page's address

### Requirement: A workplace at the publisher's address is a place

A job whose workplace is the publisher's address MUST emit an inline `Place`
whose `address` is the identity's address. That choice MUST be offered only
while the identity's address has a street or city and a country, and a job
location MUST never reference the identity node itself.

#### Scenario: At our address

- **WHEN** a job's workplace is the publisher's address and the identity is at Mill Road 4, Tampere, Finland
- **THEN** `jobLocation` MUST be `{"@type": "Place", "address": {"@type": "PostalAddress", …, "addressCountry": "FI"}}`

### Requirement: Durations and opening hours are emitted in their standard forms

A duration MUST be stored as a whole number in its unit and emitted as ISO
8601. Prep and cook time MUST be emitted together or not at all. Opening
hours MUST be stored as one validated week, and weekly days with the same
times MUST share one specification. A dated entry MUST NOT merge with a
weekly one and MUST carry no days unless given. Open all day MUST be
`00:00`–`23:59`; a dated closure `00:00`–`00:00`.

#### Scenario: Ninety minutes

- **WHEN** a recipe's prep time is 90 minutes and its cook time 30
- **THEN** `prepTime` MUST be `PT1H30M` and `cookTime` `PT30M`

#### Scenario: Prep without cook

- **WHEN** a recipe has a prep time and no cook time
- **THEN** neither MUST be emitted

#### Scenario: A week with a holiday

- **WHEN** a place is open `Mo-Fr 09:00-17:00; 2026-12-24 closed`
- **THEN** it MUST have one specification for Monday to Friday and one with `validFrom` and `validThrough` 2026-12-24, `00:00`–`00:00` and no `dayOfWeek`

### Requirement: Pay, tickets and calories follow their feature's shape

Pay with one amount MUST emit `value`, and pay whose From is above its To
MUST be left out and reported. A ticket on presale MUST be `PreOrder`, and a
ticket not on sale yet MUST carry `validFrom` and no availability. Calories
MUST be emitted as "‹n› calories" in a `NutritionInformation`, only with the
recipe's yield.

#### Scenario: One salary

- **WHEN** a job pays From 4200 EUR a month with no To
- **THEN** `baseSalary.value` MUST be `{"@type": "QuantitativeValue", "value": 4200, "unitText": "MONTH"}`

#### Scenario: Presale

- **WHEN** an event's tickets are on presale from 2027-01-10
- **THEN** its offer's `availability` MUST be `https://schema.org/PreOrder` with that `validFrom`

### Requirement: Recipe steps are steps, or one text

Recipe instructions MUST be one `HowToStep` per item when the source has
items (a multi-value field, or one long text with list items or several
paragraphs), and one text otherwise. They MUST never be a single step holding
the whole method.

#### Scenario: A body with a numbered list

- **WHEN** a recipe's method field holds `<ol><li>Preheat</li><li>Mix</li></ol>`
- **THEN** `recipeInstructions` MUST be two `HowToStep`s, "Preheat" then "Mix"

#### Scenario: One paragraph

- **WHEN** the method field holds one paragraph
- **THEN** `recipeInstructions` MUST be that paragraph as text

### Requirement: Product variants are described on each variant's page

On a template, a product with a family MUST add a `ProductGroup` at
`{url}#group` with the family's name, code and dimensions, and `hasVariant`
holding this page's product by `@id` and each other variant by URL only. The
product MUST point back with `isVariantOf`. A sibling whose family code
differs, or the page itself, MUST be left out of `hasVariant`.

#### Scenario: Three colours

- **WHEN** the walnut lamp's family is "Oak desk lamp" (ODL-100), varies by colour, with ash and oak siblings
- **THEN** `{url}#group` MUST list `{"@id": "{url}#primary"}` and two products with only their `url`

#### Scenario: A sibling of another family

- **WHEN** one listed sibling's family code is ODL-200
- **THEN** it MUST be left out, and the report MUST count it as dropped with the reason `family`

### Requirement: A list page lists public pages in order

A page described as a list of pages MUST have an `ItemList` as its page
node's `mainEntity`, with one `ListItem` per linked page in display order,
each with its position and URL, only for pages that are published and
viewable by anonymous visitors.

#### Scenario: An unpublished course

- **WHEN** a list page links four courses and one is unpublished
- **THEN** the `ItemList` MUST hold three items, positions 1 to 3

### Requirement: The return policy is one site node

When the site describes its return policy, the identity MUST reference
`{home}#return-policy` through `hasMerchantReturnPolicy`. The node MUST carry
either the returns page's URL, or the countries, the category, the number of
days when it is a fixed window, and the fees.

#### Scenario: Thirty days, customer pays

- **WHEN** the policy is described for Finland and Sweden, within 30 days, the customer paying
- **THEN** the node MUST carry `applicableCountry` ["FI", "SE"], `returnPolicyCategory` `https://schema.org/MerchantReturnFiniteReturnWindow`, `merchantReturnDays` 30 and `returnFees` `https://schema.org/ReturnFeesCustomerResponsibility`

### Requirement: The report says what was left out of a node

For the dialog, the report MUST list incomplete groups with their missing
parts, dropped list items with a count and a reason, references that fell
back to a name with the reason, and references that are the publisher only
by a Canvas page's default. Delivery MUST NOT compute or read them.

#### Scenario: Private images

- **WHEN** a product's images field holds five images, two of them private files
- **THEN** `image` MUST hold three images and the report MUST list `image` as dropped twice with the reason `private`
