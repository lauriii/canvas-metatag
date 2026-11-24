# seo-checks

## Purpose

Tell an editor, without a score, what in a page's or a content type's SEO is
missing or likely wrong, how much it matters, and where to change it. Fix in
place only what is certain, and lead to the field for everything else.

## Requirements

### Requirement: Checks describe the page or template being edited

Checks MUST be computed for the target, a page or a content type's template,
from the values the dialog shows, unsaved edits and Canvas's live page title
and description included. At template scope they MUST be about the node the
editor previews, named once on one line of the Checks sheet and called "this
‹type›" in its issues. A value, or a field of a composition, empty for the
previewed node MUST be stated as a fact, good to know and not counted. The Site
scope MUST have no checks of its own.

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

- **WHEN** "Every Event"'s description is Title, " with ", Performers, and the previewed event has no performers
- **THEN** the issue MUST say "Performers is empty for this event", not "Fill in Performers", and be good to know, not counted in the Checks button; the same MUST hold for a field the title or the social texts hold

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

#### Scenario: Every field of a composition empty

- **WHEN** "Every Event"'s title is Venue › Title, " · ", Starts, and the previewed event has neither
- **THEN** the issue MUST say "Venue › Title and Starts are empty for this event, so the title is its default", good to know and not counted

### Requirement: Some rules describe the saved draft

Rules about the social image, missing structured data details, the emitted
canonical link and a noindex set in configuration MUST use the server's
resolution of the saved draft, and MUST follow a confirmed save.

#### Scenario: A new image

- **WHEN** an editor picks a larger social image
- **THEN** "Use a larger social image" MUST go away once the change is saved to the draft

### Requirement: Three severities, and only two are counted

Every issue MUST have one severity: to fix, to improve, or good to know. The
count MUST include only issues to fix and to improve. Checks MUST NOT show a
score or a percentage.

#### Scenario: Something to fix

- **WHEN** there is at least one issue to fix
- **THEN** the Checks button MUST show a red dot and "N to fix"

#### Scenario: Only things to improve

- **WHEN** there is nothing to fix and at least one issue to improve
- **THEN** the Checks button MUST show an amber dot and "N to improve"

#### Scenario: Nothing counted

- **WHEN** there is nothing to fix or to improve
- **THEN** the Checks button MUST show a check mark and "Checks"

#### Scenario: The accessible name carries the whole count

- **WHEN** there is one issue to fix and two to improve
- **THEN** the button's accessible name MUST be "Checks, 1 to fix, 2 to improve"

#### Scenario: Good to know is never counted

- **WHEN** the only issues are good to know
- **THEN** the count MUST be zero, and the summary MUST read "Nothing to fix"

### Requirement: The Checks sheet groups issues by severity

The Checks button MUST open a sheet titled "Checks". It MUST start with a
summary heading that takes focus, then list "To fix", "To improve" and "Good to
know" in that order, leaving out empty groups. Each row MUST have a short
instruction and MAY have a detail. An "About checks" note MUST say that checks
cover the dialog's settings and the page preview, not robots.txt, speed or
rankings.

#### Scenario: A summary

- **WHEN** there is one issue to fix and two to improve
- **THEN** the heading MUST read "1 to fix · 2 to improve"

#### Scenario: Nothing at all

- **WHEN** no rule fires
- **THEN** the sheet MUST say "Everything this dialog can check looks right."

### Requirement: An issue leads to its field

An issue about a field MUST offer "Show", named for the field. Show MUST close
the sheet, switch to the field's scope and tab, open the disclosure that holds
it, scroll it into view, put focus in it and announce "Moved to" with its name.
An issue about a Site field MUST lead there only for people who can administer
SEO site settings. An issue about the page's content MUST NOT lead to a field.

#### Scenario: Show the title

- **WHEN** an editor presses "Show title" in the Checks sheet
- **THEN** the sheet MUST close, the Search tab MUST be selected, and the Title field MUST have focus

#### Scenario: A setting of the whole site

- **WHEN** the page is hidden by the site's default and the editor may not administer site settings
- **THEN** the issue MUST NOT offer Show

#### Scenario: The page's content

- **WHEN** the page has no main heading
- **THEN** the issue MUST NOT offer Show, and its detail MUST say that this is done in the page, not here

### Requirement: One-click fixes only where the result is certain

A fix MUST be offered only for a value set on the target itself, or by setting
the target's own title ending, and only while the target can be written.
Applying it MUST be an ordinary edit: saved like typing, and undoable from the
action bar, which names what was done. After a fix in the sheet, focus MUST
move to the next row's first button, else to the summary.

#### Scenario: Remove the repeat

- **WHEN** the page's own title is "Example pricing", its ending is the inherited Site name, and the site is named "Example"
- **THEN** "Remove the repeat" MUST set the page's title ending to "No ending", the row MUST go away, and the bar MUST say "Repeat removed" with Undo

#### Scenario: Separators left behind

- **WHEN** "Remove the repeat" has been applied to that page
- **THEN** the title MUST be "Example pricing", with no separator at its end

#### Scenario: Show in search results

- **WHEN** the page's own noindex hides a published page
- **THEN** "Show in search results" MUST turn the page's noindex off

#### Scenario: Allow text previews

- **WHEN** the page itself turns text previews off, by nosnippet or a limit of zero
- **THEN** "Allow text previews" MUST turn nosnippet off and remove the limit

#### Scenario: Allow large previews

- **WHEN** the page itself sets image previews to standard or none
- **THEN** "Allow large previews" MUST set them to large

#### Scenario: A value inherited from the site

- **WHEN** noindex, nosnippet or the image preview size comes from the site's defaults
- **THEN** the issue MUST NOT offer a fix

#### Scenario: A repeat that comes from a dynamic value

- **WHEN** the site name is repeated only because a template's main part is linked to the Title fact and the previewed node's title contains the site name
- **THEN** the issue MUST NOT offer a fix

#### Scenario: Read-only

- **WHEN** the target is read-only
- **THEN** no one-click fix MUST be shown, in the sheet or under a field

#### Scenario: A repeat from the Site name in a composition

- **WHEN** "Every Event"'s title is Title, " at ", Site name, and its ending is the inherited Site name
- **THEN** "Remove the repeat" MUST be offered and MUST set the template's title ending to "No ending"

#### Scenario: The site name typed in a composition

- **WHEN** "Every Event"'s title is Title, " – Example events", its ending is the inherited Site name, and the site is named "Example"
- **THEN** "Remove the repeat" MUST be offered and MUST set the template's title ending to "No ending"

### Requirement: A suggestion can stand in for a fix

When AI suggestions are available and the target is a page, the issues about a
missing or long description MUST offer "Suggest", which leads to the
description and opens its suggestions there when they can be offered
(ai-suggestions). At template scope, and without AI, it MUST NOT be offered.
Under a field, it MUST NOT be offered while the target is read-only.

#### Scenario: A page without a description, with AI

- **WHEN** a page has no description and AI suggestions are available
- **THEN** the issue MUST offer "Suggest a description"

#### Scenario: A template

- **WHEN** a template's description is missing and AI suggestions are available
- **THEN** the issue MUST NOT offer Suggest

### Requirement: An issue also shows under its field

Each field of the target MUST show under its control the first issue to fix or
to improve that is about it, with its fix or Suggest button. Good-to-know issues
MUST NOT be shown under fields. A missing required structured-data detail MUST
show the field's own "Needed for" line instead. Length MUST NOT be a warning on
a field at rest.

#### Scenario: The fix behind the sheet

- **WHEN** the title repeats the site name
- **THEN** the Title field MUST show "Remove the repeated site name" with "Remove the repeat"

#### Scenario: A long title at rest

- **WHEN** the title may be cut off and the Title field does not have focus
- **THEN** the field MUST NOT show a warning

### Requirement: Title rules

The checks MUST judge the resolved search title: whether it exists, says
something, repeats the site name, matches the main heading, and fits. Comparing
text MUST ignore case and punctuation. When the title may be cut off inside its
ending, the detail MUST say that the ending is the part that gets lost.

#### Scenario: No title

- **WHEN** the resolved title is empty
- **THEN** "Add a title" MUST be listed to fix

#### Scenario: A generic title

- **WHEN** content in a language whose code starts with "en" has a title that, without the site name and separators, is "home", "homepage", "untitled", "page", "new page" or "welcome"
- **THEN** "Make the title specific" MUST be listed to improve

#### Scenario: Generic titles outside English

- **WHEN** a Finnish page is titled "Home"
- **THEN** "Make the title specific" MUST NOT be listed

#### Scenario: The site name twice

- **WHEN** the site name appears twice in the resolved title
- **THEN** "Remove the repeated site name" MUST be listed to improve

#### Scenario: Title and heading differ

- **WHEN** the preview has exactly one main heading, neither it nor the title contains the other, and they share no word
- **THEN** "Match the title to the main heading" MUST be listed to improve

#### Scenario: A heading that shares a word

- **WHEN** the title is "Team plans" and the main heading "Plans for teams"
- **THEN** "Match the title to the main heading" MUST NOT be listed

#### Scenario: Short words

- **WHEN** a Latin-script title and heading share only words under four letters
- **THEN** they MUST count as sharing no word, while in other scripts two characters MUST count as a word

#### Scenario: Several main headings

- **WHEN** the preview has two main headings
- **THEN** the title MUST NOT be compared with either

#### Scenario: A long title

- **WHEN** the title may be cut off on desktop or on phones
- **THEN** "Shorten the title" MUST be listed as good to know, with the last words that fit

#### Scenario: Text that cannot be measured

- **WHEN** the dialog cannot measure text
- **THEN** "Shorten the title" MUST NOT be listed

#### Scenario: The ending is cut off

- **WHEN** the title may be cut off after its main part, inside the ending "Journal"
- **THEN** the detail of "Shorten the title" MUST say "The ending “Journal” is the part that gets lost."

### Requirement: Description rules

The checks MUST judge the resolved search description: whether it exists, fits,
and says more than the title.

#### Scenario: No description

- **WHEN** the resolved description is empty
- **THEN** "Add a description" MUST be listed to improve

#### Scenario: A long description

- **WHEN** the description may be cut off
- **THEN** "Shorten the description" MUST be listed as good to know

#### Scenario: Repeating the title

- **WHEN** the description equals the title without the site name, or one contains the other as whole words and the two differ by fewer than 20 letters, ignoring case and punctuation
- **THEN** "Make the description say more" MUST be listed to improve

#### Scenario: A description that holds the title

- **WHEN** "Every Event"'s description is Title, " in ", City, "." and its title is Title
- **THEN** "Make the description say more" MUST be listed to improve

#### Scenario: A description that names the title and goes on

- **WHEN** a page or a template is titled "Pricing" and its description is "Pricing for teams of every size, billed monthly or yearly, with every feature included and a free month to try it before you decide which plan fits."
- **THEN** "Make the description say more" MUST NOT be listed

### Requirement: Search visibility rules

The checks MUST say when a published target is hidden from search engines and
where that is set, when hiding and a canonical address are combined, when
search engines are sent elsewhere, and when text or large image previews are
off.

#### Scenario: A hidden page

- **WHEN** a published page is hidden by its own setting
- **THEN** "Show this page in search" MUST be listed to improve, with "Hidden from search engines. Set on this page."

#### Scenario: An unpublished page

- **WHEN** a page that was never published is hidden
- **THEN** "Show this page in search" MUST NOT be listed

#### Scenario: Where it is set

- **WHEN** the noindex comes from the content type, the default-language version or the site
- **THEN** the detail MUST say "Set for every Article.", "Set on the English version." or "Set for the whole site."

#### Scenario: Hidden by configuration

- **WHEN** no SEO layer hides the page but the emitted robots tag says noindex
- **THEN** the detail MUST say "Set in site configuration outside SEO.", and no fix MUST be offered

#### Scenario: Hidden and canonical

- **WHEN** a hidden page also has a canonical address
- **THEN** the checks MUST say to use one or the other, to improve

#### Scenario: Sent elsewhere

- **WHEN** the emitted canonical link differs from the page's own address
- **THEN** a good-to-know row MUST say that search engines are asked to show that address instead

#### Scenario: Text previews off

- **WHEN** nosnippet is set, or the text limit is zero
- **THEN** "Text previews are off" MUST be listed as good to know

#### Scenario: Image previews not large

- **WHEN** image previews are standard, none, or not set at all
- **THEN** "Large image previews are off" MUST be listed as good to know

### Requirement: Social image rules

When the server has resolved the page, the checks MUST judge the image a shared
link shows: whether there is one, its size, ratio, weight and format, and its
alt text. Without a resolution, no social image rule MUST be listed. The size
advice MUST use the link preview's rule, in one row: an image that already
makes a large card is good to know, not to improve. Sizes MUST be written
"1200 × 630", never broken across lines.

#### Scenario: No image

- **WHEN** no social image resolves
- **THEN** "Add a social image" MUST be listed to improve

#### Scenario: A small image

- **WHEN** the image is 400 × 400
- **THEN** "Use a larger social image" MUST be the one row about its size, listed to improve, its detail MUST say that most link previews show it as a small thumbnail, that an image at least 600 px wide makes a large card and that 1200 × 630 is best, and no row about its ratio ("The social image will be cropped") MUST be listed

#### Scenario: An image that already makes a large card

- **WHEN** the image is 800 × 420
- **THEN** "The social image could be sharper" MUST be listed as good to know, not counted, its detail MUST state that it works as a large card and that 1200 × 630 looks sharper, and it MUST NOT ask for 1200 × 630 as what a large card needs

#### Scenario: A large card that is cropped

- **WHEN** the image is 800 × 1000
- **THEN** one row, "The social image could be sharper", MUST be listed as good to know, its detail MUST tell the cropping in the same row (it works as a large card, cropped, and 1200 × 630 fits best), and "The social image will be cropped" MUST NOT be listed besides it

#### Scenario: Ratio, weight and alt text

- **WHEN** the ratio of an image of at least 1200 × 630 is outside 1.85 to 2, the file is over 5 MB, or the image has no alt text
- **THEN** each MUST be listed as good to know

#### Scenario: Format

- **WHEN** the image is not JPEG, PNG, GIF or WebP
- **THEN** "Use JPEG, PNG or WebP" MUST be listed to improve, naming its format as people know it ("BMP", not "X-MS-BMP")

#### Scenario: Weight in one unit

- **WHEN** the image file is 10,665,459 bytes
- **THEN** the weight row and the image field MUST both say "10.2 MB", counted as the 5 MB rule counts

### Requirement: Content rules read the editor's preview

Rules about the page's content MUST read the page as Canvas's preview renders
it. When the preview cannot be read, they MUST stay silent, and one good-to-know
row MUST say "Content checks need the page preview, which cannot be read here."

#### Scenario: No main heading

- **WHEN** the preview has no h1
- **THEN** "Add a main heading" MUST be listed to improve, saying to set one heading to Heading 1 in the page, or in the template

#### Scenario: Images without alt text

- **WHEN** five images in the preview have no alt attribute
- **THEN** "5 images on the page have no alternative text." MUST be listed to improve, naming three files "and 2 more"

#### Scenario: An empty alt

- **WHEN** an image has an empty alt attribute
- **THEN** it MUST NOT be counted

#### Scenario: The preview cannot be read

- **WHEN** the editor's preview document is not available
- **THEN** the heading, image, title-to-heading and structured-data-on-page rules MUST NOT be listed

### Requirement: Structured data rules

The checks MUST judge the page's structured data with the verdicts' own words
(search-features): a withheld main node (also when a required detail is linked
to a field the previewed item has empty), a feature that needs a fact, dates in
the wrong order, facts that are not on the page, an unknown stored type, and
a page's product or service named after its title.

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

### Requirement: What a structured data rule counts

A fact set in site settings MUST be listed only for those who may change
them, and a rule's words MUST come from its own feature. "Doesn't fit",
"Only if people buy it here", retired features and "No search feature" MUST
be good to know and never counted.

#### Scenario: A recurring price

- **WHEN** a product's merchant listing reads "Doesn't fit: a recurring price"
- **THEN** Checks MUST list it as good to know, and the count MUST NOT change

### Requirement: Site identity is reported only to those who can fix it

For people who can administer SEO site settings, the checks MUST list as good to
know what search engines do not know about who runs the site: no name, no logo,
no profile link. It MUST lead to the first gap in Site settings. Others MUST NOT
see it.

#### Scenario: An incomplete identity

- **WHEN** the site has a name but no logo and no profile link
- **THEN** the row MUST say "Search engines know little about who runs this site: no logo, no profile link."

#### Scenario: The site name stands in

- **WHEN** the identity has no name but the site has one
- **THEN** a missing name MUST NOT be reported

#### Scenario: An editor without site permission

- **WHEN** the site has no logo and the editor may not administer site settings
- **THEN** the identity row MUST NOT be listed

### Requirement: Show buttons are told apart

Each Show in the Checks sheet MUST be named "Show ‹field›" and described by its
issue's sentence, so that no two Show buttons on the sheet share both name and
description.

#### Scenario: Three issues about the description

- **WHEN** the Checks sheet lists three issues that each lead to the description
- **THEN** their Show buttons MUST each be named "Show description" and MUST each be described by a different issue

### Requirement: A broken link is listed to fix

A value linked to a field that no longer exists or no longer fits MUST be
listed to fix as "Link the ‹field› again", and a field of a composition as
"Replace ‹machine name› in the ‹field›". The detail MUST name the lost field's
machine name and say what each item gets until it is replaced. The action
MUST be "Link another field" or "Replace field", which leads to the field and
opens its menu, with a composition's lost field selected.

#### Scenario: A deleted summary field

- **WHEN** the Article template's description is linked to `field_summary` and that field was deleted
- **THEN** "Link the description again" MUST be listed to fix, its detail MUST name `field_summary`, and "Link another field" MUST put focus in the description and open its link menu

#### Scenario: A deleted field in a composed title

- **WHEN** "Every Event"'s title is Title, " in ", City, and `field_city` was deleted
- **THEN** "Replace field_city in the title" MUST be listed to fix, its detail MUST say "It no longer exists, so each event's title leaves it out.", and "Replace field" MUST select it in the title and open "Replace field_city"

### Requirement: A link hidden from visitors is listed to improve

A value linked to a field that anonymous visitors may not view, alone or in a
composition, MUST be listed to improve as "‹Source› is hidden from visitors",
with Show and a detail that says what is used instead or left out. Links hidden
by one reference MUST be one row, "‹Reference› is hidden from visitors for this
‹type›", naming the affected values ("and N more" after two), advising to
publish it or preview another item. A link only empty for the item MUST NOT be
listed.

#### Scenario: A hidden field

- **WHEN** the Article template links the description to a field that anonymous visitors may not view
- **THEN** "Notes is hidden from visitors" MUST be listed to improve, for a field labelled Notes, leading to Description

#### Scenario: A hidden field in a composition

- **WHEN** "Every Event"'s title is Title, " · ", Notes, and visitors may not view Notes
- **THEN** "Notes is hidden from visitors" MUST be listed to improve, its detail MUST say "So it is left out of every event's title.", and Show MUST lead to Title

### Requirement: Required details hidden by a reference are said once

When a required structured data detail is among the links one reference hides,
the row MUST say once that the type's details are left out for this item and
why, instead of naming each detail.

#### Scenario: A hidden venue

- **WHEN** "Every Event" links Venue name, Street address, City and Postal code through Venue, and the previewed event's venue is unpublished
- **THEN** one row "Venue is hidden from visitors for this event" MUST be listed to improve, saying "Event details are left out for this event, because visitors can't see its venue. Publish the venue or preview another event.", and no "Add Street address" row MUST be listed

#### Scenario: Empty for this article

- **WHEN** the description is linked to Summary and the previewed article has no summary
- **THEN** no issue about the link MUST be listed

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

### Requirement: Parts left out of structured data are reported

Checks MUST list an incomplete group and dropped list items as to improve,
naming what is missing by its own name ("the name", "how often it is paid")
or why items were dropped. A list over its maximum, a reference that fell
back to a name and a closed job MUST be good to know. Pay whose From is above
its Up to MUST be to fix, and said under the Pay box. A list page short of
complete pages MUST say how many count.

#### Scenario: A venue without a country

- **WHEN** an event's venue has no country
- **THEN** Checks MUST list "Add the country to the venue's address" to improve, with "An address needs a street or city, and a country."

#### Scenario: A list page of courses

- **WHEN** a list page links five pages, two of them complete courses
- **THEN** Checks MUST list "Course list: 2 of the 5 linked pages are complete courses" to improve

#### Scenario: Pay in the wrong order

- **WHEN** a job's linked pay has From 5000 and Up to 4200
- **THEN** Checks MUST list it to fix, and no `baseSalary` MUST be emitted

### Requirement: A part is asked for once

What a feature asks more of a group that is incomplete MUST be in the
group's row, with what it is needed for; a part asked for there MUST NOT be
asked for again for a feature. A part whose stored value does not fit (a
country typed as a name) MUST be asked for only where it is dropped.

#### Scenario: A venue with a street only

- **WHEN** an event's venue has a name and a street, and no city or country
- **THEN** Checks MUST list "Add the city and the country to the venue's address" to improve, with "Needed for event listings.", and no other row for the city or the country

#### Scenario: An organizer with only a website

- **WHEN** an event page's organizer is someone else with only a website
- **THEN** Checks MUST list "Add the name to the organizer"

#### Scenario: A country stored as a name

- **WHEN** a venue's country is stored as "Finland"
- **THEN** Checks MUST list "Choose the country from the list" once, and not "Add the country to the venue's address"

### Requirement: Recipe times are checked as a pair and in their unit

A recipe with a prep time and no cook time, or the reverse, MUST be listed to
improve as "Add the cook time, or give a total time instead". A linked
recipe time that reads as more than a day MUST be listed to improve with
"Change the unit".

#### Scenario: Minutes read as hours

- **WHEN** Prep time links to a field answered as hours and a recipe holds 45
- **THEN** Checks MUST ask "Is Prep time in hours or minutes?", and "Change the unit" MUST answer minutes

### Requirement: Facts that speak for the site are noted

On a Canvas page, an organizer or recipe author that is the publisher only
by default MUST be good to know until the editor changes or confirms the
field; choosing "Someone else" changes it, before any name is typed. A byline linked as text that holds " and ", "&" or a
comma MUST be good to know with "If this names several people, link a field
with one person per value."

#### Scenario: The default organizer

- **WHEN** an event page's organizer was never touched
- **THEN** Checks MUST list "The organizer is your site" as good to know, and touching the field MUST remove it

### Requirement: Clashes with added details are listed

Each added detail the module's own value overrides MUST be listed to improve,
naming the path and where the kept value comes from, and leading to the Add
details sheet.

#### Scenario: A price clash

- **WHEN** added details set `offers.price` and the Price field sets the price
- **THEN** "“offers.price” comes from the Price field, so the added value isn't used" MUST be listed to improve

### Requirement: Hand-added links that can't fill are listed

A field or media name inside other text in a hand-added item MUST be listed
to improve with "This name is only filled when it is the whole value." A
hand-added value left out because its link is empty, hidden or gone for the
item being checked MUST be listed to improve with its path, leading to that
row in "Add your own JSON-LD".

#### Scenario: A byline inside text

- **WHEN** a template's hand-added item has `"name": "By {field.field_byline}"`
- **THEN** Checks MUST list it to improve with that sentence

#### Scenario: A review without a score

- **WHEN** the previewed book review has no Score and its hand-added rating links to it
- **THEN** "No Score for this book review, so its rating is left out." MUST be listed to improve

### Requirement: Structured data left out of the head is to fix

When the structured data is left out of the head because it can't be encoded
or would exceed 256 KB, Checks MUST list it to fix, say that the other tags
are still output, and name hand-added JSON-LD or added details when they are
the cause.

#### Scenario: Too much hand-added JSON-LD

- **WHEN** linked values make a page's structured data exceed 256 KB
- **THEN** Checks MUST list "Your own JSON-LD was left out: the structured data would be over 256 KB." to fix

### Requirement: A translation missing hand-added items is good to know

When the source version of a page has hand-added items and a translation
has none, Checks MUST list it as good to know, leading to the translation's
"Add your own JSON-LD".

#### Scenario: French without the rating

- **WHEN** the English page has two hand-added items and its French translation none
- **THEN** "The English version has 2 hand-added items this translation doesn't." MUST be listed as good to know on the French page

### Requirement: Words typed in a composition are noted on a multilingual site

When the site has more than one language and a composition on the template
holds typed letters, Checks MUST note once per value, good to know and not
counted, that those words are the same in every language, whatever item is
previewed, with the detail "Translations of each ‹type› keep these words." No
fix MUST be offered.

#### Scenario: A multilingual site

- **WHEN** "Every Event"'s title is Title, " in ", City, on a site with English and French
- **THEN** "The words typed in the title are the same in every language" MUST be listed as good to know, with the detail "Translations of each event keep these words."

#### Scenario: Punctuation only

- **WHEN** the title is Title, " · ", City
- **THEN** nothing MUST be listed about its words

### Requirement: Checks help write a good composition

Checks MUST list to improve, for a composition on a template: a description
mostly made of typed letters; a title main part whose lead-in holds letters; a
composed name or headline detail of the item itself that holds the Site
name, or a date when the type has a date detail other than its publication date. When "Shorten the title" finds the
cut inside a composed main part, its detail MUST name the field that is cut.

#### Scenario: A boilerplate description

- **WHEN** "Every Event"'s description is Title, ". Book tickets for the best events in town with free delivery!", so that typed letters are more than half of its result
- **THEN** "Most of this description is the same on every event" MUST be listed to improve

#### Scenario: A lead-in before the title

- **WHEN** "Every Event"'s title is "Tickets: ", Title
- **THEN** "Start the title with what differs per event" MUST be listed to improve

#### Scenario: A date in an event's name

- **WHEN** "Every Event"'s name detail is Title, " · ", Starts
- **THEN** "Keep the date out of the event's name" MUST be listed to improve, with the detail "Starts already gives it."

#### Scenario: A cut inside the composition

- **WHEN** the title is Title, " · ", Starts, and it may be cut off inside the date
- **THEN** the detail of "Shorten the title" MUST say "Starts is cut off."

### Requirement: A composed detail is looked for on the page field by field

A composed detail MUST NOT be looked for on the page as joined text: each of
its fields that gives a value MUST be looked for on its own (a date in any of
its written forms, a field of several values by its first item too), typed
words never, and only the fields not found MUST be named, with their values.
A field another detail holds whole MUST be named by that detail only, once.

#### Scenario: A composed name whose fields are on the page

- **WHEN** "Every Event"'s name detail is Title, " with ", Performers, and the page shows the title and each performer but never the joined text
- **THEN** no "Couldn't find" issue MUST be listed for the name

#### Scenario: A field of a composed name not on the page

- **WHEN** the name detail is Title, " in ", City, and the page never mentions "Helsinki"
- **THEN** "Couldn't find City (Helsinki) on this page" MUST be listed to improve

#### Scenario: A date in a composed name and in its own detail

- **WHEN** "Every Event"'s name detail is Title, " · ", Starts, its start date detail is Starts, and the page never shows the date
- **THEN** only the start date detail MUST say "Couldn't find the date …", never the name too

### Requirement: A missing description on a headless site names the frontend

When `canvas_headless` has a frontend, every variant of "Add a description"
MUST say "No description sent. The frontend decides what to show." in place of
its sentence about what search engines pick. Its level,
its other sentences and its fix MUST stay the same.

#### Scenario: A headless page without a description

- **WHEN** a page has no description and the first frontend is `https://www.example.com`
- **THEN** "Add a description" MUST be listed to improve, with "No description sent. The frontend decides what to show."

#### Scenario: A coupled page

- **WHEN** a page has no description and `canvas_headless` has no frontend
- **THEN** "Add a description" MUST say "Without one, search engines pick text from the page."

### Requirement: A type whose items can't have a description says so

At template scope, when the description follows its default and no field of
the type can give one, Checks MUST say "No ‹type› has a description" as good
to know, with no sentence about items that have one.

#### Scenario: A type with only a title and a link

- **WHEN** "Every Bookmark", whose type has only a title and a link field, follows the default description
- **THEN** Checks MUST list "No bookmark has a description" as good to know, saying "Search engines pick text from the page." on a coupled site and "No description sent. The frontend decides what to show." on a headless one

### Requirement: Pages without an address say why

When the head leaves out page addresses because the public base is on a host
no visitor reaches (headless-head), Checks MUST list one issue to fix, "Page
addresses are left out", in two short sentences an editor can read: what is
left out, and that an administrator can fix it, with the status report saying
how. It MUST NOT name the setting: the status report row does.

#### Scenario: A development frontend in production

- **WHEN** an editor opens the dialog at `https://cms.example.com`, no public base is set, and the first frontend is `http://localhost:3000`
- **THEN** Checks MUST list "Page addresses are left out" to fix, saying "Visitors can't reach the site's public address, so links to this page, share links, language links and structured data are left out. An administrator can fix this; the status report says how."

#### Scenario: A page with hand-added JSON-LD

- **WHEN** the same editor opens a page that has hand-added JSON-LD
- **THEN** the dialog MUST open and Checks MUST list "Page addresses are left out", with no rule about the hand-added items, whose graph is left out
- **AND** the search preview and the link preview MUST show no address

#### Scenario: The Structured data view

- **WHEN** the same editor opens the Structured data view
- **THEN** it MUST say "No structured data is sent: page addresses are left out." with a way to Checks, and show no search features
- **AND** Checks MUST NOT list "No search feature for ‹kind›" as good to know: no structured data reaches search engines
