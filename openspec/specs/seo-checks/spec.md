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

#### Scenario: A structured data property linked to a field empty for the previewed node

- **WHEN** "Every Event" links its Ends property to the field Ends and the previewed event has no end
- **THEN** the issue MUST say "Ends is empty for this event", be good to know, not counted, and "Event is missing: Ends." MUST NOT be listed

#### Scenario: Shown in search, not saved yet

- **WHEN** an editor clicks "Show in search results" on "Every Article" and the change is not saved yet
- **THEN** no noindex issue MUST be listed, so nothing says that hiding is set outside SEO: the check that a page is hidden by a setting outside SEO MUST NOT judge an unsaved change by the server's output for the values before it

#### Scenario: A template that is hidden from search

- **WHEN** "Every Article" is set to be hidden from search
- **THEN** the issue MUST say "Show this article in search"

#### Scenario: Site scope and loading

- **WHEN** the dialog shows the Site scope, or the editor's next page is still loading
- **THEN** the Checks button MUST NOT be shown

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

A fix MUST be offered only for a value set on the target itself, and only while
the target can be written. Applying it MUST be an ordinary edit: saved like
typing, and undoable from the action bar, which names what was done. After a
fix in the sheet, focus MUST move to the next row's first button, else to the
summary.

#### Scenario: Remove the repeat

- **WHEN** the page's own title is "Example pricing {sep} {site}" and the site is named "Example"
- **THEN** "Remove the repeat" MUST change it to "pricing {sep} {site}", the row MUST go away, and the bar MUST say "Repeat removed" with Undo

#### Scenario: Separators left behind

- **WHEN** "Remove the repeat" is applied to "Pricing | Example | {site}"
- **THEN** the title MUST become "Pricing | {site}"

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

- **WHEN** the site name is repeated only because the page title contains it
- **THEN** the issue MUST NOT offer a fix

#### Scenario: Read-only

- **WHEN** the target is read-only
- **THEN** no one-click fix MUST be shown, in the sheet or under a field

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
text MUST ignore case and punctuation.

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

### Requirement: Empty dynamic values are reported once

When the title, description, social title or social description uses a dynamic
text value that is empty for the page, the checks MUST list "Fill in <value> or
remove it" to improve, once per value, leading to the first field that uses it.
Image values and names outside the page's vocabulary MUST NOT be reported.

#### Scenario: One value in two fields

- **WHEN** the page title is empty and both the title and the social title use it
- **THEN** exactly one "Fill in Page title or remove it" MUST be listed, leading to Title

#### Scenario: A deleted field

- **WHEN** a title uses a field the content type no longer has
- **THEN** it MUST NOT be reported

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

- **WHEN** the description equals the title without the site name, ignoring case and punctuation
- **THEN** "Make the description say more" MUST be listed to improve

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

The checks MUST judge the page's structured data: required and recommended
details the server reports missing, dates in the wrong order, and typed text
that is not on the page.

#### Scenario: A required detail is missing

- **WHEN** an Event has no start date
- **THEN** "Add Starts" MUST be listed to fix, saying Event details are left out until it is filled in, and leading to that detail in the Schema tab

#### Scenario: Recommended details are missing

- **WHEN** an Event has no end date and no venue
- **THEN** one row "Event is missing: Ends, Venue." MUST be listed to improve

#### Scenario: Dates in the wrong order

- **WHEN** an article's "Updated" is before its "Published", or an event's "Ends" before its "Starts", after dynamic values are filled in
- **THEN** that MUST be listed to improve

#### Scenario: A venue that is not on the page

- **WHEN** an Event's venue is typed as "The New Mill" and the page never mentions it
- **THEN** "Check Venue" MUST be listed to improve

#### Scenario: What is not compared with the page

- **WHEN** a detail is bound to a dynamic value, has a fixed format such as a currency, or is not text
- **THEN** it MUST NOT be compared with the page's text

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
