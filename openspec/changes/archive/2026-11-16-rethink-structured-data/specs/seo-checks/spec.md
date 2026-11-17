## MODIFIED Requirements

### Requirement: Checks describe the page or template being edited

Checks MUST be computed for the target, a page or a content type's template,
from the values the dialog shows, unsaved edits and Canvas's live page title
and description included. At template scope they MUST be about the node the
editor previews, named once on one line of the Checks sheet and called "this
‹type›" in its issues. A value empty for the previewed node MUST be stated as
a fact, good to know and not counted. The Site scope MUST have no checks of
its own.

#### Scenario: Typing changes the checks

- **WHEN** an editor types a title that names the site twice
- **THEN** "Remove the repeated site name" MUST be listed before the change is saved

#### Scenario: A template is checked against its preview

- **WHEN** the dialog edits "Every Article" while the editor previews the article "Hello world"
- **THEN** the Checks sheet MUST say "Checked against Hello world", and a detail that would say "this page" MUST say "this article" instead

#### Scenario: A very long node title

- **WHEN** the editor previews an event whose title is 247 characters long
- **THEN** "Checked against" MUST fit on one line, ending with an ellipsis, with the whole title on hover, and no issue's sentence MUST repeat the title

#### Scenario: A value empty for the previewed node

- **WHEN** "Every Event"'s description holds {Performers} and the previewed event has no performers
- **THEN** the issue MUST say "Performers is empty for this event", not "Fill in Performers", and be good to know, not counted in the Checks button; the same MUST hold for a value the title or the social texts use

#### Scenario: A description linked to a field empty for the previewed node

- **WHEN** "Every Product"'s description is linked to SKU and the previewed product has no SKU and no description of its own
- **THEN** "SKU is empty for this product" MUST be listed as good to know, and "Add a description" MUST NOT be listed or counted

#### Scenario: A structured data property linked to a field empty for the previewed node

- **WHEN** "Every Event" links its Ends property to the field Ends and the previewed event has no end
- **THEN** the issue MUST say "Ends is empty for this event", be good to know, not counted, and "Also helps the event result: Ends." MUST NOT be listed

#### Scenario: Shown in search, not saved yet

- **WHEN** an editor clicks "Show in search results" on "Every Article" and the change is not saved yet
- **THEN** no noindex issue MUST be listed, so nothing says that hiding is set outside SEO: the check that a page is hidden by a setting outside SEO MUST NOT judge an unsaved change by the server's output for the values before it

#### Scenario: A template that is hidden from search

- **WHEN** "Every Article" is set to be hidden from search
- **THEN** the issue MUST say "Show this article in search"

#### Scenario: Site scope and loading

- **WHEN** the dialog shows the Site scope, or the editor's next page is still loading
- **THEN** the Checks button MUST NOT be shown

### Requirement: Structured data rules

The checks MUST judge the page's structured data with the verdicts' own words
(search-features): a withheld main node (also when a required detail is linked
to a field the previewed item has empty), a feature that needs a fact, dates in
the wrong order, facts that are not on the page, an unknown stored type, and
a page's product or service named after its title. A fact set in site
settings MUST be listed only for those who may change them, and a rule's
words MUST come from its own feature. "Doesn't fit", "Only if people buy it
here", retired features and "No search feature" MUST be good to know and
never counted.

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
- **THEN** one row "Also helps the event result: Ends, Venue." MUST be listed as good to know, naming the facts in the form's order, with the reason "Adding them gives the event result more to show."

#### Scenario: Dates in the wrong order

- **WHEN** an article's "Updated" is before its "Published", or an event's "Ends" before its "Starts", after linked values are resolved
- **THEN** that MUST be listed to improve

#### Scenario: A venue that is not on the page

- **WHEN** an Event's venue is typed as "The New Mill" and the page never mentions it
- **THEN** "Couldn't find “The New Mill” on this page" MUST be listed to improve

#### Scenario: A linked value that is not on the page

- **WHEN** an article's author is linked to the field Byline, whose value "Ada Lovelace" the page never shows
- **THEN** "Couldn't find “Ada Lovelace” on this page" MUST be listed to improve, saying that it comes from Byline

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
visitors can see and that pages that break this can lose their search
features. It MUST offer "Leave it out until it's on the page", while the
JSON-LD still holds the item, and "Check again", and MUST never delete
anything by itself.

#### Scenario: A question that is not on the page

- **WHEN** a hand-added FAQ asks "Is the shade dimmable?" and the page never shows it
- **THEN** "Couldn't find the question “Is the shade dimmable?” on this page" MUST be listed to fix

#### Scenario: Checking again

- **WHEN** the editor presses "Check again" and the question is still not on the page
- **THEN** the bar MUST say "Still not on the page"; once it is there, the row MUST go and the bar MUST say "Found on the page"

#### Scenario: Leaving it out

- **WHEN** the editor presses "Leave it out until it's on the page"
- **THEN** the item MUST be left out of the graph, the row MUST go away, and the custom JSON-LD MUST be unchanged, from Checks as from the sheet; in Checks, focus MUST move to the next row's sentence, never onto the same action there

### Requirement: Reviews of your own organization are reported

Over the whole graph, a review or an aggregate rating whose subject is the
site's identity, or an organization of any type (a restaurant or a hotel
is one; a page or a product is not) whose address or profiles match the
identity's, MUST be listed to fix with "No review stars for reviews of your
own organization." An employer rating, or a rating of
any other organization, MUST NOT be. A rating value or count that is not on
the page MUST be listed to improve.

#### Scenario: A rating on the identity

- **WHEN** the home address is `https://example.com/` and a hand-added `Review` has `itemReviewed` `{"@id": "https://example.com/#identity"}`
- **THEN** the row MUST be listed to fix with that sentence

#### Scenario: A copy of the site's organization

- **WHEN** a hand-added `AggregateRating` reviews an `Organization` whose `url` is the identity's
- **THEN** the row MUST be listed to fix with that sentence

#### Scenario: A rating of a restaurant at the site's address

- **WHEN** a hand-added `Restaurant` whose `url` is the identity's has an `aggregateRating`
- **THEN** the row MUST be listed to fix with that sentence

#### Scenario: A rating of another company

- **WHEN** a hand-added `EmployerAggregateRating` or `AggregateRating` reviews an `Organization` named "Acme Logistics" with its own `url`
- **THEN** no review-of-yourself row MUST be listed

#### Scenario: A rating not on the page

- **WHEN** a hand-added aggregate rating says 4.8 and the page never shows 4.8
- **THEN** "Couldn't find the rating 4.8 on this page" MUST be listed to improve

#### Scenario: A rating written oddly

- **WHEN** a hand-added rating's value is "(4.5"
- **THEN** it MUST be looked for as written, and the dialog MUST keep working
