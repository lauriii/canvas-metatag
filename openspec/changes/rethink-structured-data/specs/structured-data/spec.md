## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: A price says how it is billed

A product's or service's price MAY be billed once, every month or every year.
A price billed every month or year MUST be emitted both as the offer's
`price` and as a `priceSpecification` of type `UnitPriceSpecification` with
the price, the currency, the billing duration and its unit code. A price
billed once, or with no billing set, MUST carry no price specification.

#### Scenario: A monthly membership

- **WHEN** a service costs 2500 EUR billed every month
- **THEN** its offer MUST carry `price` 2500, `priceCurrency` "EUR" and a `priceSpecification` with `billingDuration` "P1M" and `unitCode` "MON"

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

A price's currency MUST default to the site currency when the target sets
none. A currency MUST be a three-letter code from the ISO 4217 list.

#### Scenario: No currency on the page

- **WHEN** the site currency is EUR and a product sets a price but no currency
- **THEN** its offer's `priceCurrency` MUST be "EUR"

#### Scenario: No site currency

- **WHEN** neither the site nor the product sets a currency
- **THEN** the offer MUST have no `priceCurrency`, and the merchant listing MUST need one

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
