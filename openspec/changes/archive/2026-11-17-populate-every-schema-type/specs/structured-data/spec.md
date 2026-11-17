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

Text MUST be plain, cut at 2000 characters (a job description at 20,000).
An enum MUST be emitted as its property declares: `https://schema.org/<Value>`
(the default), the bare code, or the node's `@type`. A date-time without an
offset MUST get the site timezone's offset that day, with seconds; other dates
MUST stay as stored. An image MUST be an `ImageObject` with its URL, with
width and height only when known. A group MUST be a nested node typed by the
registry. Every `@id` MUST be absolute.

#### Scenario: A local start time

- **WHEN** an event starts at `2026-07-01T18:00:00` and the site timezone is America/New_York
- **THEN** `startDate` MUST be `2026-07-01T18:00:00-04:00`

#### Scenario: A venue address

- **WHEN** an event sets a venue name, a street address and a country
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
except a job description; custom text MUST be kept as typed.

#### Scenario: A hostile title

- **WHEN** a page title, the site name and a custom node contain `</script><script>alert(1)</script> <!-- -->`
- **THEN** the HTML MUST contain exactly one script element, which MUST decode to the graph
- **AND** the body MUST be unchanged

## ADDED Requirements

### Requirement: A job description keeps only basic markup

A job description MUST keep only `p`, `ul`, `ol`, `li`, `br`, `strong`, `em`
and `a` with an absolute http(s) `href` (its own `href` attribute, never
another that holds the word). The content of script, style and template
elements MUST be removed with them, also when a comment splits their tag.

#### Scenario: A hostile job description

- **WHEN** a job's linked description holds `<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">apply</a><ul><li>Design</li></ul>`
- **THEN** its `description` MUST be `<p>Hi</p><a>apply</a><ul><li>Design</li></ul>`
- **AND** the HTML MUST contain exactly one script element, which MUST decode to the graph

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
parts. A required group nothing was set for MUST withhold the main node; one
that has values but is incomplete MUST NOT (decision 8). A group MUST
NOT sit inside a list item; only a group's reference may be a list, each
target with its own parts. A suggested value, such as the site's default
country, MUST never be emitted unless it was chosen.

#### Scenario: An address without a country

- **WHEN** an event's venue has a name, a street and a city but no country, and the publisher is in Finland
- **THEN** `location` MUST carry no `address`, and the report MUST list `location_address` as incomplete, missing `addressCountry`

#### Scenario: An event with only a street

- **WHEN** an event has a start date and a venue street, with no venue name and no country, as events could before groups
- **THEN** the Event node MUST stay in the graph without `location`, and the report MUST list `location_address` as incomplete, missing `addressCountry`

#### Scenario: No venue at all

- **WHEN** an event has a start date and no venue
- **THEN** the graph MUST have no Event node and the report MUST say the venue is missing

### Requirement: A venue needs its name or address, someone else a name

A venue MUST be complete with its name or its address; the name is what a
feature recommends, not what the venue needs. Someone else (an organizer,
an employer) MUST be complete with their name.

#### Scenario: Someone else with only a website

- **WHEN** an event page's organizer has a website and no name
- **THEN** the graph MUST have no `organizer`, and the report MUST list `organizer` as incomplete, missing `organizer_name`

### Requirement: References point at the thing, or name it

A reference MUST be `{"@id": "{home}#identity"}` for the publisher. A page
visitors may see, described as an accepted kind (a subtype counts as its
ancestors), MUST be its main node `@id` with its type, name, URL and any
inline address. A page described otherwise MUST give only its name, and a
group (a list group too, for its one target) keeps its other parts beside
it. A page visitors may not see, in its language, MUST be left out, never
named. The target's cache tags MUST join the head.

#### Scenario: A restaurant as a venue

- **WHEN** an event's venue links to a published page described as a Restaurant with an address
- **THEN** `location` MUST be `{"@id": "‹page›#primary", "@type": "Restaurant", "name": …, "url": "‹page›", "address": {…}}`

#### Scenario: An unpublished profile

- **WHEN** a performer's profile page is unpublished
- **THEN** that performer MUST be left out, its name nowhere in the graph, and the report MUST list `performer` under `dropped_items` with the reason `hidden`

#### Scenario: A page described as something else

- **WHEN** a venue links to a published page described as an article, and the venue's street, city and country are linked to the event's own fields
- **THEN** `location` MUST be a `Place` with that page's name and the linked address, and the report MUST list it under `refs_inline` with `kind`

#### Scenario: An unpublished translation

- **WHEN** a French event page's venue is a published page whose French translation is unpublished
- **THEN** the French head MUST name neither that translation's title nor its address

#### Scenario: Someone else, with a website

- **WHEN** an organizer is someone else, named "Example Hall Ltd" with the website https://hall.example.org/
- **THEN** `organizer` MUST be `{"@type": "Organization", "name": "Example Hall Ltd", "url": "https://hall.example.org/"}`

#### Scenario: A workplace page described as something else

- **WHEN** a job's workplace links to a published page described as an article, and the workplace's street, city and country are linked to the job's own fields
- **THEN** `jobLocation` MUST be a `Place` with that page's name and the linked address, and the report MUST list it under `refs_inline` with `kind`

#### Scenario: Two workplaces

- **WHEN** a job's workplaces link to two office pages in one city, one without a postal code
- **THEN** `jobLocation` MUST hold two places, each with its own page's address

### Requirement: A page described later rebuilds the heads that name it

A reference target that no template describes yet MUST join the head with
its type's template, or with the template list when its type has none, so
that describing it later rebuilds every head that names it.

#### Scenario: Venues described after the events

- **WHEN** an event names a venue page whose type has no template, and a template is then made for venues
- **THEN** the event's head MUST be rebuilt with the venue's `@id`, type and address

### Requirement: Where a job's work is is one answer

A job posting MUST ask where the work is: on site, fully remote, or on site
or remote. Remote work, also when it may be on site, MUST be emitted as
`jobLocationType` `TELECOMMUTE`; on site MUST add nothing of its own. The
workplace MUST count only for on site and on site or remote work, and the
countries people can apply from only for remote work. A verdict that needs
where the work is MUST name the workplace's address once the answer is on
site.

#### Scenario: On site or remote

- **WHEN** a job's work is on site or remote, with a workplace page in Tampere
- **THEN** the JobPosting MUST carry `jobLocationType` `TELECOMMUTE` and that workplace

#### Scenario: On site, nowhere yet

- **WHEN** a job's work is on site and no workplace is set
- **THEN** "Job posting" MUST ask for a workplace address, not for where the work is

### Requirement: What each page has of its own is linked on a template

A closing date, performers, a venue page and a workplace page MUST NOT be
typed once for every page of a template: there they MUST be linked to a
field. A closing date MAY be typed on a Canvas page. Performers are offered
on templates only. A venue or workplace page is picked on a Canvas page only
through the page picker (`link-groups-and-pick-pages`); until then the
group is filled by its own parts there, and a page pick is refused at save.

#### Scenario: A closing date for every job

- **WHEN** a template's closing date is saved as typed text
- **THEN** it MUST be refused with "This comes from a field or a component."

### Requirement: A country is a code

A country MUST be emitted as its ISO 3166-1 code; a linked field that gives
the code in lower case MUST give it in upper case. A country typed before
countries were codes MUST be kept when read, so that the report lists it as
a value that does not fit instead of losing it.

#### Scenario: A country stored as a name

- **WHEN** an event's venue has the country "Finland" stored as text
- **THEN** the stored value MUST stay, `location` MUST carry no address, and the report MUST list the country as dropped

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

Pay with one amount MUST emit `value`, and pay whose From is above its Up to
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
items (a multi-value field, one long text with list items or several
paragraphs, or one plain text of several lines), and one text otherwise.
They MUST never be a single step holding the whole method.

#### Scenario: A body with a numbered list

- **WHEN** a recipe's method field holds `<ol><li>Preheat</li><li>Mix</li></ol>`
- **THEN** `recipeInstructions` MUST be two `HowToStep`s, "Preheat" then "Mix"

#### Scenario: One paragraph

- **WHEN** the method field holds one paragraph
- **THEN** `recipeInstructions` MUST be that paragraph as text

### Requirement: A list page lists public pages in order

A page described as a list of pages MUST have an `ItemList` as its page
node's `mainEntity`, with one `ListItem` per linked page in display order,
each with its position and URL, only for pages that are published and
viewable by anonymous visitors.

#### Scenario: An unpublished course

- **WHEN** a list page links four courses and one is unpublished
- **THEN** the `ItemList` MUST hold three items, positions 1 to 3

### Requirement: The report says what was left out of a node

For the dialog, the report MUST list incomplete groups with their missing
parts, dropped list items with a count and a reason, references that fell
back to a name with the reason, and references that are the publisher only
by a Canvas page's default. Delivery MUST NOT compute or read them.

#### Scenario: Private images

- **WHEN** a product's images field holds five images, two of them private files
- **THEN** `image` MUST hold three images and the report MUST list `image` as dropped twice with the reason `private`
