## MODIFIED Requirements

### Requirement: Structured data rules

The checks MUST judge the page's structured data with the verdicts' own words
(search-features): a withheld main node (also when a required detail is linked
to a field the previewed item has empty), a feature that needs a fact, dates in
the wrong order, facts that are not on the page, an unknown stored type, and
a product or service named after the page title. "Doesn't fit", "Only if
people buy it here", retired features and "No search feature" MUST be good to
know and never counted.

#### Scenario: A required detail is missing

- **WHEN** an Event has no start date
- **THEN** "Add a start date" MUST be listed to fix, saying the event is left out until it is filled in, and leading to that detail in the Schema tab

#### Scenario: A required detail linked to a field this item has empty

- **WHEN** "Every Event" links Starts to a field and the previewed event has no start
- **THEN** "Starts is empty for this event" MUST be listed to fix, saying the event is left out for this event, not "Add a start date"

#### Scenario: A feature needs a fact

- **WHEN** a product bought here has no image
- **THEN** "Add an image for merchant listings" MUST be listed to improve, with "Choose an image" and "Show"

#### Scenario: Recommended details are missing

- **WHEN** an Event has no end date and no venue name
- **THEN** one row "Also helps the event result: Ends, Venue." MUST be listed as good to know

#### Scenario: Dates in the wrong order

- **WHEN** an article's "Updated" is before its "Published", or an event's "Ends" before its "Starts", after linked values are resolved
- **THEN** that MUST be listed to improve

#### Scenario: A venue that is not on the page

- **WHEN** an Event's venue is typed as "The New Mill" and the page never mentions it
- **THEN** "Couldn't find “The New Mill” on this page" MUST be listed to improve

#### Scenario: A linked value that is not on the page

- **WHEN** an article's author is linked to a field whose value the page never shows
- **THEN** "Linked to Byline, but couldn't find it on this page" MUST be listed to improve

#### Scenario: What is not compared with the page

- **WHEN** a detail has a fixed format such as a currency, an identifier or a code
- **THEN** it MUST NOT be compared with the page's text

#### Scenario: A recurring price

- **WHEN** a product's merchant listing reads "Doesn't fit: a recurring price"
- **THEN** Checks MUST list it as good to know, and the count MUST NOT change

## ADDED Requirements

### Requirement: Hand-added text nobody can see is to fix

Text in a hand-added item that is not on the page MUST be listed to fix,
saying that search engines ask that structured data only describes what
visitors can see and that pages that break this can lose rich results. It
MUST offer "Leave it out until it's on the page" and "It's on the page,
check again", and MUST never delete anything by itself.

#### Scenario: A question that is not on the page

- **WHEN** a hand-added FAQ asks "Is the shade dimmable?" and the page never shows it
- **THEN** "Couldn't find the question “Is the shade dimmable?” on this page" MUST be listed to fix

#### Scenario: Leaving it out

- **WHEN** the editor presses "Leave it out until it's on the page"
- **THEN** the item MUST be left out of the graph, the row MUST go away, and the custom JSON-LD MUST be unchanged

### Requirement: Reviews of your own organization are reported

Over the whole graph, a review or an aggregate rating whose subject is the
site's identity, or an organization whose address or profiles match the
identity's, MUST be listed to fix with "Not eligible for review stars: these
are reviews of your own organization." An employer rating, or a rating of
any other organization, MUST NOT be. A rating value or count that is not on
the page MUST be listed to improve.

#### Scenario: A rating on the identity

- **WHEN** the home address is `https://example.com/` and a hand-added `Review` has `itemReviewed` `{"@id": "https://example.com/#identity"}`
- **THEN** the row MUST be listed to fix with that sentence

#### Scenario: A copy of the site's organization

- **WHEN** a hand-added `AggregateRating` reviews an `Organization` whose `url` is the identity's
- **THEN** the row MUST be listed to fix with that sentence

#### Scenario: A rating of another company

- **WHEN** a hand-added `EmployerAggregateRating` or `AggregateRating` reviews an `Organization` named "Acme Logistics" with its own `url`
- **THEN** no review-of-yourself row MUST be listed

#### Scenario: A rating not on the page

- **WHEN** a hand-added aggregate rating says 4.8 and the page never shows 4.8
- **THEN** "Couldn't find the rating 4.8 on this page" MUST be listed to improve
