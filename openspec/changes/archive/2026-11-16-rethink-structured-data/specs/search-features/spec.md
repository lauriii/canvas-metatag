## Purpose

Decide, for a page's built structured data, which search features apply, the
verdict for each and why, from one dated set of rules that the dialog,
Checks and every later report share. A verdict says what the markup makes
possible; it never promises that a result will show.

## ADDED Requirements

### Requirement: Search features come from one dated rules file

The module MUST ship one rules file listing each search feature it knows, as
live or retired, with the types it applies to, its required and recommended
paths, the rules that make it not fit, a plain sentence saying where it
appears, its source address and the date the rules were last reviewed. The
dialog MUST show that date with every verdict's proof.

#### Scenario: The review date

- **WHEN** an editor opens the proof of any verdict
- **THEN** it MUST end with "Rules checked ‹date›" using the rules file's review date, and a link to the feature's documentation

#### Scenario: A stale rules file

- **WHEN** the rules file's review date is more than 120 days old in CI
- **THEN** CI MUST report a warning and MUST NOT fail the pipeline

### Requirement: Each applicable feature gets one verdict

For every feature whose types occur in the built graph, the module MUST give
one verdict per node: can show, complete, needs (naming the missing facts),
only if bought here, doesn't fit (with a reason), not shown here, retired, or,
when no feature applies, no search feature. Verdicts MUST be computed on the
graph that ships, and on a withheld main node as it would ship, following
`@id` references inside it, both ways for a review or a rating.

#### Scenario: A product with everything required

- **WHEN** a product has a name, an image, a price above zero, a currency and the site as its seller
- **THEN** both "Product result" and "Merchant listing" MUST read "Can show"

#### Scenario: A missing required fact

- **WHEN** that product has no image
- **THEN** "Merchant listing" MUST read "Needs an image" and name `image` as missing

#### Scenario: A plain page

- **WHEN** a page is a web page with no hand-added items
- **THEN** the only verdict MUST be "No search feature"

#### Scenario: A reference inside the graph

- **WHEN** a hand-added product `#p` with a name and no price is followed by a hand-added review whose `itemReviewed` is `{"@id": "#p"}`
- **THEN** the review MUST count as that product's review, and `#p`'s "Product result" MUST read "Can show"

#### Scenario: A review of a withheld main node

- **WHEN** the main node is a product withheld for want of a price and a hand-added review's `itemReviewed` is `{"@id": "#primary"}`
- **THEN** the review MUST ship without that reference, as a reference to a module node that is not in the graph does (structured-data), and MUST count for no product

### Requirement: A feature without required facts is complete, not ready

A feature whose documentation lists no required properties MUST NOT read "Can
show". Its verdict MUST be "Complete" when the recommended facts it uses are
present, and otherwise name what is missing from them.

#### Scenario: An article with an image and dates

- **WHEN** an article has a headline, an image, a published date with a time zone and an author with an address
- **THEN** its line MUST read "Article title, image and date" and "Complete"

### Requirement: Shopping listings fit only what people buy and own

The merchant listing MUST read "Doesn't fit" with its reason when the offer
carries a billing period, when one product carries more than one offer at
different prices, or when the editor said people do
not buy it on this page. It MUST read "Only if people buy it here" while that
answer is unset. A hand-added product whose offer does not name the site's
identity as its seller MUST read "Doesn't fit: not bought on this page".

#### Scenario: A monthly price

- **WHEN** a product's offer is billed every month
- **THEN** "Merchant listing" MUST read "Doesn't fit: a recurring price" and offer no fix

#### Scenario: Several plans on one product

- **WHEN** a product carries offers of €25, €45 and €95 from the same seller
- **THEN** "Merchant listing" and "Product result" MUST read "Doesn't fit: several plans on one product"

#### Scenario: A hand-added product sold by someone else

- **WHEN** a hand-added product's offer has a price and a currency and no seller, or another seller
- **THEN** its "Merchant listing" MUST read "Doesn't fit: not bought on this page"

#### Scenario: Not answered yet

- **WHEN** a product's "Bought on this page" is unset
- **THEN** "Merchant listing" MUST read "Only if people buy it here" with an action that focuses that fact, and MUST NOT be counted in Checks

### Requirement: Site names are judged on the home page

The site name feature MUST be evaluated on the website node of the home page.
When the site's home address has a path, it MUST read "Doesn't fit: the site
is in a subdirectory".

#### Scenario: A site at a domain root

- **WHEN** the front page's graph has a website node with a name and the home address `https://example.com/`
- **THEN** "Site name" MUST read "Can show"

#### Scenario: A site in a subdirectory

- **WHEN** the home address is `https://example.com/shop/`
- **THEN** "Site name" MUST read "Doesn't fit: the site is in a subdirectory"

### Requirement: Feature rules that are stricter than the emission rule

A feature MAY require more than the module needs to emit a node; the node
MUST still ship and the verdict MUST name what the feature lacks. An event
listing MUST require a town and a country in the address; an organization
logo MUST be evaluated only for an organization.

#### Scenario: An event without a country

- **WHEN** an event has a start date, a venue and a street address but no country
- **THEN** the Event node MUST ship and "Event result" MUST read "Needs a country"

#### Scenario: A person's logo

- **WHEN** the site identity is a person with an image
- **THEN** no organization logo verdict MUST be given

### Requirement: Retired features are dated only from a changelog

A retired feature MUST read "Not shown since ‹date›" only when the rules file
records a dated changelog entry, and "No longer shown" otherwise. Its proof
MUST link the changelog entry, not the removed documentation. A retired
feature MUST never be offered as a kind and MUST never be counted.

#### Scenario: A hand-added FAQ

- **WHEN** a page carries a hand-added `FAQPage`
- **THEN** its line MUST read "FAQ" and "Not shown since 7 May 2026", in gray, and Checks MUST list it as good to know only

### Requirement: Verdicts never promise a result

Structured data verdict, proof and Checks copy MUST say what the markup makes
possible and that search engines decide whether to show it. The words "will show",
"eligible", "AI-ready", "get cited" and "score" MUST NOT appear.

#### Scenario: The proof's foot

- **WHEN** any proof is open
- **THEN** it MUST say "Meeting these makes a result possible. Search engines decide whether to show it."
