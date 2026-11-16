## ADDED Requirements

### Requirement: The Schema view opens on what search engines read

The Schema view MUST open with a stage captioned "Understood as" holding one
to three plain sentences built only from the structured data the target
ships, then one line per search feature, then one line saying whether the
facts match the page. schema.org type and property names MUST NOT appear in
the view outside Output.

#### Scenario: A product page

- **WHEN** a page is a product named "Oak desk lamp" at 89 EUR, in stock, bought on this page
- **THEN** the stage MUST read "Oak desk lamp, a product sold by Humanify Studio for €89, in stock."

#### Scenario: A clause with nothing behind it

- **WHEN** the product's "Bought on this page" is unset
- **THEN** the sentence MUST NOT say "sold by", because the graph has no seller

#### Scenario: A monthly price stored without its billing

- **WHEN** a product's price is 2500 and no billing is set
- **THEN** the sentence MUST say "for €2,500" with no period

### Requirement: Each fact in the sentence leads to where it is set

Each fact in the read-back MUST be a button named "‹Label›, ‹value›, ‹where
it is set›" ("Price, €89, set on this page", "Seller, Humanify Studio, from
Site"). Pressing it MUST focus its field, or go to Search, Social or Site
when the value is set there. The facts MUST be one group: Tab enters it,
the arrow keys move inside it, Tab leaves it.

#### Scenario: The seller

- **WHEN** an editor presses "Humanify Studio" in a product's sentence
- **THEN** the dialog MUST switch to Site with the identity name field in view

#### Scenario: Keyboard

- **WHEN** focus is on the first fact and the editor presses the right arrow
- **THEN** focus MUST move to the next fact, and Tab MUST move to the first feature line

### Requirement: A required fact from a default opens its own field

When a fact that a feature of the kind requires comes from a default, pressing
it MUST open that fact's own field in place, out of More details, and focus
it. While its value follows the page title, the field MUST say "Now the page
title" with a secondary "Edit in Search".

#### Scenario: A page title as an event name

- **WHEN** an event's name follows the page title and the editor presses it in the sentence
- **THEN** focus MUST land on the Schema view's Name field, which says "Now the page title" with "Edit in Search"

### Requirement: A product named after its page is said

On a page, a product or service name equal to the page title MUST carry the
hint "The name is the page title. Give the product its own name.", with
"Edit in Search" while it follows the title. At template scope a name that
follows each item's own title MUST NOT carry it.

#### Scenario: A page title as a product name

- **WHEN** a product's name follows the page title "Shop our lamps" and the editor presses it in the sentence
- **THEN** focus MUST land on the Schema view's Name field, not on Search's title, and the field MUST show the hint and "Edit in Search"

#### Scenario: Every Product

- **WHEN** "Every Product" names each product after its own title
- **THEN** no hint and no Checks row MUST ask for another name

### Requirement: One line per search feature

Under the sentence, captioned "In search results", the stage MUST show one
line per verdict (search-features), at most four, ordered: needs, only if
people buy it here, can show, complete, doesn't fit, not shown here, retired,
no search feature. Each feature's line MUST be a button named after the
feature and its verdict, and MAY carry a separate fix button for the first
missing fact; "No search feature" is plain text. A verdict that changes, in
its words, MUST be announced once.

#### Scenario: A profile

- **WHEN** a page is a person's profile and its profile verdict is given on the page node
- **THEN** the stage MUST show that one line, and no "No search feature" beside it

#### Scenario: The line's name

- **WHEN** the merchant listing does not fit a monthly price
- **THEN** its line MUST be named "Merchant listing doesn't fit: a recurring price"

#### Scenario: Needs an image

- **WHEN** a product bought here has no image
- **THEN** the stage MUST show "Merchant listing" with "Needs an image" and a "Choose" button that opens the image chooser with the page's own images first

#### Scenario: A fix button's name

- **WHEN** the event result needs a city
- **THEN** its fix button MUST be named "Add City", after the fact it sets

#### Scenario: The fix applies nothing by itself

- **WHEN** the page shows an image and the product has none
- **THEN** no button MUST set that image as the product image in one click

#### Scenario: The change is announced

- **WHEN** the editor chooses an image and the verdict becomes "Can show"
- **THEN** the status region MUST say "Merchant listing can show" once

### Requirement: A verdict opens its proof

Pressing a feature line MUST open a proof named after the feature: where the
feature appears in one plain sentence, each required fact with its value or
a button to set it, at most four facts that also help each with its own
"Add", at most two guidelines no machine checks, and the rules' review date
with a link to the feature's documentation.

#### Scenario: Merchant listing needs an image

- **WHEN** the editor opens the merchant listing proof of a product without an image
- **THEN** it MUST list Name, Price and Bought on this page with their values as their fields show them, and Image as "Not set" with "Choose", and say "Your product in shopping results, with its price and stock."

#### Scenario: Focus on open

- **WHEN** the editor opens a proof by keyboard
- **THEN** focus MUST land on the proof's title, not on one of its actions, and every action in it MUST show the dialog's focus ring

#### Scenario: A withheld event

- **WHEN** an event with a start date, a city and a country but no street address is withheld and the editor opens its proof
- **THEN** the proof MUST show the start date, and "Not set" only for the street address

#### Scenario: Doesn't fit

- **WHEN** the editor opens the merchant listing proof of a monthly membership
- **THEN** it MUST say that shopping listings are for things people buy and own, and suggest Plans for a service

### Requirement: What this page is

The first field MUST be "What this page is", reading the kind in plain words
("A product people buy", "Plans for a service", "An article", "An event people
attend in person", "A person's profile", "A web page"). It MUST open a sheet
listing each kind with what it is for and what it can earn. Retired features
MUST NOT be kinds.

#### Scenario: The kinds sheet

- **WHEN** an editor opens "What this page is"
- **THEN** a radio group "What is this page?" MUST list the six kinds, and under "A product people buy" say it is not for services, memberships or subscriptions

#### Scenario: A blog post

- **WHEN** the stored type is Blog post
- **THEN** the kind MUST read "An article" with "Kind of article: Blog post" under it, and the "Kind of article" choice MUST be in More details

### Requirement: The kind always reads what search engines get

"A web page" MUST be a kind the editor can choose. The field and the kinds
sheet MUST always show the kind that is output, marked "Default" when it is
inherited, never an empty or "Choose" state, read-only included. Choosing
the inherited kind MUST show it as chosen.

#### Scenario: A new page

- **WHEN** an editor opens Schema on a page with no stored type
- **THEN** the field MUST read "A web page" and the kinds sheet MUST have "A web page" selected and marked "Default"

#### Scenario: Back to a web page

- **WHEN** an editor changes an article to "A web page"
- **THEN** the field MUST read "A web page", the output graph MUST have no main node, and after the draft is saved and the dialog reopened the field MUST still read "A web page"

#### Scenario: A translation of an article

- **WHEN** a translation's default-language version is an article and the editor chooses "A web page"
- **THEN** the translation MUST store `WebPage` and its output MUST be a web page while the default-language version stays an article

### Requirement: Changing the kind names what is removed

When choosing another kind would remove values set here, the dialog MUST
say which values, with their values, and that Undo brings them back, and
change the kind only when the editor confirms. The confirm MUST stay in
sight at the foot of the kinds sheet however far it is scrolled, and MUST
NOT cover the list; in a frame too short to hold both, it follows the list.
While it waits, its buttons MUST be the next stops after the list. Until
then the field MUST show the current kind.

#### Scenario: A product becomes an event

- **WHEN** a product with a typed price of 120 EUR is changed to an event
- **THEN** the dialog MUST say "Changing to an event removes the price (€120) you set. Undo brings it back." with "Change to an event" and "Keep a product"

#### Scenario: An event becomes an article

- **WHEN** an event with a start on 12 May 2027 at 18:00, an end and a venue is changed to an article
- **THEN** the removed values MUST be named in the form's order, each as its field shows it: "the start (12 May 2027, 18:00), the end (…) and the venue (…)", followed by "Undo brings them back."

### Requirement: Facts follow what the features need

After the kind, the view MUST show at most four facts the kind lists first,
which MUST include those its features require that nothing fills by default
and those that decide whether a feature fits. The rest MUST be behind one
"More details" disclosure, open when one of them holds a value of its own or
a problem. A required fact that resolves empty MUST show its guidance at
rest, and a field MUST show the Checks about itself.

#### Scenario: A product

- **WHEN** a page is a product
- **THEN** Price, Currency, Bought on this page and Image MUST come before More details

#### Scenario: Guidance at rest

- **WHEN** a product bought here has no image
- **THEN** the Image field MUST say "Needed for merchant listings" without being focused

### Requirement: A membership is offered its honest kind

When a product's price is billed every month or year, the kind field MUST say
"Memberships and subscriptions are services." with "Change to plans for a
service", which changes the kind and keeps the name, price, currency and
billing.

#### Scenario: Today's pricing page

- **WHEN** a product named "Studio membership" is billed every month and the editor presses "Change to plans for a service"
- **THEN** the kind MUST be Plans for a service with the same name, price and billing, and the stage MUST read "No search feature"

### Requirement: The stage says whether the facts are on the page

The stage MUST end with one line: the facts set here match the page,
nothing is set here to compare, the most serious fact not found on the page
with its fix and "Show" in its Checks tone, or no preview to check against.
Hand-added text to fix MUST mark "Added by hand" in the to-fix colour. It
MUST compare text, prices with their currency and period, dates, images and
ratings, never codes or identifiers.

#### Scenario: A price shown per month

- **WHEN** the page shows "€2,500 / month" and the product's price is 2500 with no billing
- **THEN** the line MUST say "Couldn't find €2,500 as a one-time price on this page: it says €2,500 a month."

#### Scenario: The same amount in another currency

- **WHEN** the page shows "$2,500" and the product's price is 2500 EUR
- **THEN** the line MUST say "Couldn't find €2,500 on this page: it says $2,500." and lead to Currency

#### Scenario: Nothing set here

- **WHEN** a page sets no structured data facts and no JSON-LD of its own
- **THEN** there MUST be no match line, since nothing of the editor's is there to compare

#### Scenario: A number that is not a price

- **WHEN** the page says "2,500 customers" and nowhere shows a price of 2500
- **THEN** the price MUST count as not found

### Requirement: Your own JSON-LD lives behind Code

The stage MUST have a "Code" button that opens Output. Custom JSON-LD MUST be
edited in a sheet titled "Add your own JSON-LD", opened from Output or from
the sentence's "Added by hand" part, and MUST NOT have a row in the Schema
view. Its items MUST read back as "Added by hand: ‹items›.", each by its name,
its feature or a plain word ("a review"), and get verdicts, also in the
sheet's list of items. Closing the sheet MUST return focus to what opened the
first sheet.

#### Scenario: Pages that had custom JSON-LD

- **WHEN** a page with custom JSON-LD is opened for the first time in this browser, in the first release with this change
- **THEN** a notice MUST say "Custom JSON-LD moved to Code › Add your own JSON-LD" with a button that opens that sheet, and MUST NOT be shown again when the page is opened again

#### Scenario: Inline checks

- **WHEN** the sheet holds an `Organization` named like the site's identity
- **THEN** it MUST say "This is your site's organization. Point to it with “@id”: “‹home›#identity” instead.", with the site's home address in place of ‹home›

### Requirement: An unknown stored kind is said

When the stored type is not in the registry, the view MUST show the notice
"This page was described as “‹type›”, which this site no longer knows. Search
engines get a plain web page." with "Choose what it is", and the kind field
MUST read "Not known: “‹type›”".

#### Scenario: A removed type

- **WHEN** a page's stored type is `Recipe`
- **THEN** the notice MUST be shown and Checks MUST list one issue to improve

### Requirement: A sentence without a translation is a list

When the dialog's language has no translation for a kind's sentence, the stage
MUST show the facts as a list of label and value instead of a sentence.
Prices and dates MUST be formatted in the dialog's language.

#### Scenario: An untranslated sentence

- **WHEN** the dialog is in Finnish and the product sentence has no Finnish translation
- **THEN** the stage MUST list "Nimi · Oak desk lamp" style rows and no English sentence

## MODIFIED Requirements

### Requirement: Output shows the exact head

Each preview MUST offer "View output", and the Schema view "Code", which open
the Output sheet. It MUST list, value by value and whole, the tags the server
resolves for the target, draft included: title, description, robots and
canonical first, then the rest as emitted. Its structured data section MUST
list the graph's nodes as an outline, main node first, each with its name,
type, `@id` and origin, left-out and retired nodes with their reason, then
the formatted JSON behind "Show JSON-LD". It MUST offer "Copy tags", "Copy
structured data", each confirmed with "Copied", and "Test this page".

#### Scenario: After publishing

- **WHEN** a page is published and its Output sheet is opened
- **THEN** its rows MUST equal the head an anonymous visitor gets

#### Scenario: Where addresses come from

- **WHEN** an editor opens "About addresses" in the Output sheet
- **THEN** it MUST name the public address in use and say whether it comes from the site's settings file, the headless frontend, or the address the editor is signed in at

#### Scenario: A headless frontend

- **WHEN** addresses come from a headless frontend
- **THEN** the sheet MUST say that the frontend decides what reaches visitors

#### Scenario: No page to resolve

- **WHEN** the server returned no head
- **THEN** the sheet MUST say "There is no page to show output for."

#### Scenario: The outline

- **WHEN** a product page with a hand-added FAQ is opened in Output
- **THEN** the list "Structured data" MUST start with the product node tagged "Main", and the FAQ row MUST say "Not shown since 7 May 2026" and "Added by hand"

#### Scenario: Testing a draft

- **WHEN** the target has unpublished changes and the editor presses "Test this page"
- **THEN** the structured data MUST be copied and the dialog MUST say "Copied. Paste the code into the test."

### Requirement: A content type with nothing to preview is shown read-only

When a type's Full content template has no node to preview, the dialog MUST
show the template's values at rest, read-only, with no previews, no Output and
no Checks, and MUST say "No ‹type› yet. Add one to preview and edit these
settings.". No value MUST be marked as empty; a box MUST say "No ‹type› to
preview", also to assistive technology; a setting MUST show its value in words.

#### Scenario: The Announcement type

- **WHEN** the Announcement template stores `title_end: {text: 'News'}` and the type has no content
- **THEN** the Search view MUST show the title's box saying "No announcement to preview" and the ending "News", none of them marked as empty, MUST NOT offer to edit them, and MUST say "No announcement yet. Add one to preview and edit these settings."

#### Scenario: Inherited fields

- **WHEN** the Announcement template stores no description and no social texts, and the type has no content
- **THEN** the description's box and the social description's box MUST each say "No announcement to preview", also in their accessible descriptions

#### Scenario: Settings at rest

- **WHEN** the Announcement template sets no robots directive and no structured-data type, and the type has no content
- **THEN** "Show in search results" MUST read "On" and "Text previews" "Allowed", with no switch and no menu, and "What this page is" MUST read "A web page" with no sheet to open

#### Scenario: Custom JSON-LD not set

- **WHEN** the Announcement template has no custom JSON-LD and the type has no content
- **THEN** the Schema view MUST NOT offer "Add your own JSON-LD" and MUST NOT open an empty editor

#### Scenario: The first announcement is added

- **WHEN** an editor adds an announcement while the dialog is open on the Announcement template, and the template editor moves to preview it
- **THEN** the open dialog MUST follow the editor to the previewed announcement and the values MUST become editable
