# structured-data

## Purpose

Describe every owned page to search engines as one JSON-LD `@graph`: who runs
the site, the website, the page and, for richer kinds of page, its main
subject. Keep node identities stable, ship a main node only when it is
complete, let editors add their own nodes without replacing the module's,
and make sure no text can escape the script element. Alongside the graph,
report to the dialog what was left out, dropped or withheld and where each
value came from, so that every verdict can be explained.

## Requirements

### Requirement: One graph per page

Each owned page MUST carry exactly one JSON-LD script holding one object with
exactly the keys `@context` (`https://schema.org`) and `@graph`. No node in
`@graph` MUST carry its own `@context`. Every node MUST have a `@type`, every
`@id` MUST be absolute, and no two nodes in `@graph` MUST share an `@id`.
Members of the module's own nodes that have no value MUST be left out.

#### Scenario: A page with no settings

- **WHEN** a page has no structured data settings
- **THEN** `@graph` MUST hold the identity, the website and a `WebPage` node, plus the logo and the page image when they resolve

### Requirement: Node identities are fixed

The module's nodes MUST use these `@id`s, where `{home}` is the public base
followed by `/` and `{url}` is the entity's own public URL: the identity
`{home}#identity`, the logo `{home}#logo`, the website `{home}#website`, the page
`{url}#webpage`, the page image `{url}#primaryimage`, the main node
`{url}#primary`. `{url}` MUST NOT follow a canonical override, so that a page's
identity does not move when its canonical does.

#### Scenario: A canonical override

- **WHEN** a page at `/love` sets the canonical `/plans?ref=1`
- **THEN** the page node's `@id` MUST be on `/love`, not on `/plans`

#### Scenario: The front page

- **WHEN** the page is the site's front page
- **THEN** its page node's `@id` MUST be `{home}#webpage`

### Requirement: The site nodes describe the identity

The identity node MUST be an `Organization`, or a `Person` when the site
identity is a person, with the identity name (else the site name), the home
address and the identity's profile addresses as `sameAs`. When the site logo
resolves for anonymous visitors, an `ImageObject` logo node MUST be added and
referenced as `logo` (as `image` for a person). The `WebSite` node MUST carry
the home address, the name, the page language and the identity as `publisher`.

#### Scenario: A person runs the site

- **WHEN** the identity is a person with a logo
- **THEN** the identity node MUST be a `Person` whose `image` references `{home}#logo`

#### Scenario: A logo visitors cannot see

- **WHEN** the logo media is unpublished
- **THEN** the graph MUST have no logo node, and the identity MUST have no `logo`

### Requirement: The page node describes the page

The page node MUST have the type's page type (`WebPage` unless the type names
another), the entity's own URL, its label as `name`, the head's description,
the language (left out for a language-neutral entity), `isPartOf` the website,
and the First published and Last updated facts.
When an image resolves, the node MUST reference the page image node as
`primaryImageOfPage`, which MUST carry the alt text as `caption`.
`mainEntity` MUST reference the main node only when it is in the graph.

#### Scenario: An about page

- **WHEN** the type is About page
- **THEN** the page node's `@type` MUST be `AboutPage`, and there MUST be no main node

#### Scenario: A translation

- **WHEN** a French translation is resolved
- **THEN** the page node's `inLanguage` MUST be `fr`

### Requirement: Page types come from one registry

The available types MUST be the eleven of the registry: Web page, About page,
Contact page, Collection page, Article, Blog post, News article, Event,
Product, Service and Profile. An absent or unknown type MUST be a plain Web
page, and the report MUST name the unknown stored type. Blog post and News
article MUST have the properties of Article with their own main type. A
property key MUST be one the type has; property values without a type of their
own belong to the inherited type (page-seo).

#### Scenario: An unknown type

- **WHEN** the stored type is `Recipe`
- **THEN** the graph MUST be that of a Web page, with no main node
- **AND** the report MUST carry `unknown_type: "Recipe"`

#### Scenario: A blog post

- **WHEN** the type is Blog post
- **THEN** the main node's `@type` MUST be `BlogPosting` and the page node's `WebPage`

#### Scenario: A property of another type

- **WHEN** a page of the type Article saves the detail `offers_price`
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: A service

- **WHEN** the type is Service with a name and a price
- **THEN** the main node MUST be a `Service` whose `provider` references the identity and whose `offers` is one `Offer`

### Requirement: Property values are checked against their kind

A typed value MUST pass its property's kind, options and pattern: text is any
text; a url is an absolute http(s) URL with a host and no credentials; a date
is a real `YYYY-MM-DD`, optionally with a time and an offset or `Z`; a number
is digits with an optional decimal part; an enum is one of the options; a
currency is a code of the ISO 4217 list the module ships. An image MUST be a
chosen media item, the Image fact or a linked image field. A typed value that
fails MUST be refused when saved.

#### Scenario: Dates and numbers

- **WHEN** a value is `2026-02-30`, `2026-07-01 18:00`, `49,90` or `-1`
- **THEN** it MUST fail its kind

#### Scenario: A currency in lower case

- **WHEN** an editor saves the currency `eur`
- **THEN** the save MUST be refused with a message asking for a currency code from the list

#### Scenario: Defaults are facts

- **WHEN** a node of a type whose structured data type is Article sets none of the Article details
- **THEN** its Article node's headline, image, dates and author name MUST come from its Title, Image, First published, Last updated and Author facts

### Requirement: A value that fails its kind is dropped and reported

A linked value that fails its kind, or a stored value that no longer passes,
MUST be left out and reported as dropped with the value it gave, never as
missing; when its property is required, the main node is withheld for it. A
three-letter currency code stored before the list (such as "RMB") MUST be
kept when read, so that it is reported as dropped instead of lost without a
word.

#### Scenario: A linked currency "Euro (€)"

- **WHEN** a template links a product's currency to a field whose value for this node is "Euro (€)"
- **THEN** the offer MUST have no `priceCurrency`, the report MUST list the currency as dropped with the value "Euro (€)", never as missing, and the product MUST still ship

#### Scenario: A required value that does not fit

- **WHEN** a template links a product's price to a field whose value for this node is "€89"
- **THEN** the main node MUST be withheld, with `offers_price` dropped and not missing

#### Scenario: A code stored before the list

- **WHEN** a page stored the currency "RMB" before currencies came from the list
- **THEN** reading the page MUST keep "RMB", and the graph MUST report it as dropped with that value

#### Scenario: A field that is not an address

- **WHEN** a template links the author page to a field whose value is not an address
- **THEN** the author page MUST be left out

### Requirement: Values are emitted in schema.org form

Text values MUST be plain text cut at 2000 characters. An enum MUST be emitted
as `https://schema.org/<Value>`. A date with a time and no offset MUST get the
offset of the site's timezone on that day; other dates MUST be emitted as
stored. An image MUST be an `ImageObject` with its URL, and its width and
height only when known. A property key with underscores MUST be a path of
nested nodes, each typed by the registry.

#### Scenario: A local start time

- **WHEN** an event starts at `2026-07-01T18:00:00` and the site timezone is America/New_York
- **THEN** `startDate` MUST be `2026-07-01T18:00:00-04:00`

#### Scenario: A venue address

- **WHEN** an event sets a venue name and a street address
- **THEN** `location` MUST be a `Place` with that name and an `address` that is a `PostalAddress`

#### Scenario: A summary left at its default

- **WHEN** an article's summary is not set
- **THEN** its `description` MUST be the head's description, not the raw text it was cut from

#### Scenario: An image without dimensions

- **WHEN** an image has no stored width or height
- **THEN** its nodes MUST carry no `width` or `height`

### Requirement: The main node ships only when complete

A type with a main type MUST add a main node with `mainEntityOfPage` pointing at
the page node, its fixed references (an article's `publisher` is the
identity), and every property that resolves from the stored value or the
default. When a required property does not resolve, the main node MUST be
withheld. The module MUST report whether it was withheld, which required
properties caused it, and every value it dropped because it failed its kind,
for the dialog.

#### Scenario: An event without a start date

- **WHEN** an event's start date field is empty
- **THEN** the graph MUST have no Event node
- **AND** the report MUST say the main node was withheld because `startDate` is missing

#### Scenario: An article without an image

- **WHEN** an article has no image and no modified date
- **THEN** the Article node MUST ship without them

#### Scenario: A dropped value

- **WHEN** a template links the currency to a field whose value for this node is "€"
- **THEN** the offer MUST have no `priceCurrency` and the report MUST list the currency as dropped with the value "€"

### Requirement: Custom JSON-LD is validated when saved

Custom JSON-LD MUST be refused when it is not valid JSON, is over 32 KB, is not
one object or a list of up to 10 objects each with a string `@type`, nests
deeper than 8 levels, contains `null`, has a key other than `@type` and `@id`
starting with `@`, has an `@id` that is neither an absolute http(s) URL nor a
`#name`, or has a string that starts with a script, data or file scheme. It
MUST be stored re-encoded with keys sorted, and checked again when read.

#### Scenario: A script address

- **WHEN** an editor saves custom JSON-LD with `"sameAs": ["javascript:alert(5)"]`
- **THEN** the save MUST be refused with "Addresses must start with https:// or http://."
- **AND** the same MUST hold for `vbscript:`, `data:` and `file:` addresses

#### Scenario: A scheme mentioned in text

- **WHEN** a name is "Learn javascript: the basics"
- **THEN** the custom JSON-LD MUST be accepted

#### Scenario: An empty list

- **WHEN** the custom JSON-LD is `[]`
- **THEN** nothing MUST be stored

### Requirement: Custom nodes can point at the module's nodes, never replace them

Custom nodes MUST be appended after the module's nodes. A `#name` `@id` MUST be
put on the entity's own URL. In strings, the module's fixed names MUST be
filled and other brace text kept. A top-level
custom node with one of the module's `@id`s MUST be dropped. A nested object
with one of them MUST become a bare reference, or be removed when that node is
not in the graph. When two custom nodes share an `@id`, the first MUST win.
Text that is not a usable node MUST add nothing.

#### Scenario: A search action

- **WHEN** a custom node has the `@id` `#search` and the target `{url}?q={search_term_string}`
- **THEN** its `@id` MUST be on the page's URL, `{url}` MUST be filled, and `{search_term_string}` MUST be kept

#### Scenario: Taking over the identity

- **WHEN** a custom node uses the `@id` `{home}#identity`
- **THEN** it MUST be dropped, and the module's identity MUST be unchanged

#### Scenario: Pointing at a withheld node

- **WHEN** a custom node references `#primary` and the main node is withheld
- **THEN** the reference MUST be removed

#### Scenario: A field name in custom JSON-LD

- **WHEN** a template's custom JSON-LD has the name `{field.field_byline}`
- **THEN** the name MUST be emitted as the text `{field.field_byline}`

#### Scenario: The fixed names

- **WHEN** a custom node's strings use `{title}`, `{description}`, `{site}`, `{sep}`, `{url}`, `{author}`, `{published}`, `{modified}` and `{image}`
- **THEN** each MUST be filled with the page's value

### Requirement: No text can leave the script element

The coupled script MUST be encoded with `<`, `>`, `&`, `'` and `"` as JSON
escapes, and with U+2028 and U+2029 escaped, so that no text can end the script
element or open a comment in it. It MUST be the only markup the module
declares safe. The module's own texts MUST be normalized as plain text; custom
text MUST be kept as typed.

#### Scenario: A hostile title

- **WHEN** a page title, the site name and a custom node contain `</script><script>alert(1)</script> <!-- -->`
- **THEN** the HTML MUST contain exactly one script element, which MUST decode to the graph
- **AND** the body MUST be unchanged

### Requirement: A price says how it is billed

A product's or service's price MAY be billed once, every month or every year.
A price billed every month or year MUST be emitted both as the offer's
`price` and as a `priceSpecification` of type `UnitPriceSpecification` with
the price, the currency, the billing duration and its unit code. A price
billed once, or with no billing set, MUST carry no price specification.

#### Scenario: A monthly membership

- **WHEN** a service costs 2500 EUR billed every month
- **THEN** its offer MUST carry `price` "2500", `priceCurrency` "EUR" and a `priceSpecification` with `billingDuration` "P1M" and `unitCode` "MON"

#### Scenario: A one-time price

- **WHEN** a product costs 89 EUR with no billing set
- **THEN** its offer MUST carry no `priceSpecification`

### Requirement: The site is the seller only when people buy here

A product MAY say whether people buy it on this page from the site. Only when
it says yes MUST the offer's `seller` reference the identity. Otherwise the
offer MUST have no seller. The answer itself MUST NOT appear in the graph.

#### Scenario: Bought here

- **WHEN** a product's "Bought on this page" is yes
- **THEN** its offer's `seller` MUST be `{"@id": "{home}#identity"}`

#### Scenario: A review page

- **WHEN** a product's "Bought on this page" is no or unset
- **THEN** its offer MUST have no `seller`

### Requirement: Prices default to the site currency

A price's currency MUST default to the site currency when the target sets a
price and no currency; it MUST NOT fill an offer that has no price. A currency
MUST be a code from the ISO 4217 list.

#### Scenario: No currency on the page

- **WHEN** the site currency is EUR and a product sets a price but no currency
- **THEN** its offer's `priceCurrency` MUST be "EUR"

#### Scenario: No site currency

- **WHEN** neither the site nor the product sets a currency
- **THEN** the offer MUST have no `priceCurrency`, and the merchant listing MUST need one

#### Scenario: A service without a price

- **WHEN** the site currency is EUR and a service sets no price
- **THEN** its node MUST have no `offers`

### Requirement: A hand-added item can be left out until it is on the page

A page or template MAY list hand-added items to leave out, by their `@id`. A
listed item MUST NOT be emitted; the rest of the custom JSON-LD MUST be
emitted as before. The stored custom JSON-LD MUST be unchanged, except that
an item without an `@id` MUST first be given one.

#### Scenario: Leaving out a question nobody can see

- **WHEN** the editor leaves out the hand-added `#faq` item
- **THEN** the graph MUST have no `#faq` node, and the custom JSON-LD MUST still hold it

#### Scenario: Leaving out an item without an id

- **WHEN** the editor leaves out a hand-added `FAQPage` that has no `@id`
- **THEN** the item MUST be given the `@id` `#faqpage`, that id MUST be listed, and the bar MUST say "Gave the item the id #faqpage so it can be left out."
