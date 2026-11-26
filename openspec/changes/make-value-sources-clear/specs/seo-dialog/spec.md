## ADDED Requirements

### Requirement: Every field says where its value comes from, at rest

A field that can take its value from more than one place MUST show one
source control at the right end of its label row: a ghost button that names
the source in words. It MUST be visible at rest, never only on hover or
focus, and it MUST be the only control that changes the source. A field with
one possible source MUST NOT show one, and MUST keep its own control. No
field MUST say its source by a gray value, a placeholder, a tag in its box,
or a link button by its label.

#### Scenario: Updated on a template

- **WHEN** an editor opens the Schema tab of "Every Article", whose Updated detail follows its default, without hovering or focusing anything
- **THEN** the Updated field MUST show the source control "Article's last update" and the previewed article's last update date in ink, with no box, no "Default" and no link button by the label

#### Scenario: Author on a template

- **WHEN** an editor opens the Schema tab of "Every Article", whose Author follows its default, and the previewed article's author is admin
- **THEN** the Author field MUST show the source control "Article's author" and "admin" in ink, with no select and no "(the page's author)"

#### Scenario: Fields with one source

- **WHEN** an administrator opens Site, or an editor opens a page's Search tab
- **THEN** Site's Name, Default image, Currency and search visibility switches, and a page's description and canonical address, MUST show no element named "‹words›, source of ‹Field›"
- **AND** Currency MUST keep its own select, reading "Not set" in ink while nothing is chosen

#### Scenario: Nothing hidden behind hover

- **WHEN** an editor hovers or focuses any field on any tab of a page or a template
- **THEN** no word about where the value comes from MUST appear that was not already shown at rest

### Requirement: A value kept here is named by its scope

A value kept at this scope, typed, chosen or composed, MUST be named by the
scope button's own label: "This page", "Every ‹Type›" or "Site". No other
word MUST name that state at rest. Every sentence about it (a box's
description, a menu heading, the status, Checks) MUST use the verb "set":
"Set for every ‹Type›", "Set on this page", "Set for the site".

#### Scenario: Kept here, by scope

- **WHEN** a value is typed on a page, for every Event, and in Site
- **THEN** its source control MUST read "This page", "Every Event" and "Site", the same words as the scope button

#### Scenario: One verb

- **WHEN** Ends is typed for every Event and a screen reader focuses its date input
- **THEN** its description MUST include "Set for every Event.", the source menu's group MUST be headed "Set for every Event", and no text in the dialog MUST say "Same for every Event", "Kept for every Event" or "One date for every Event"

### Requirement: A field is named by its label, as a link

A value that follows a field MUST be named by the field's label, or its path
from the item ("Poster › Image", "Page data › Image"), after a link glyph, in
the link color. A path MUST give way from its start, so that the field it
ends at stays in sight.

#### Scenario: A linked field

- **WHEN** "Every Event"'s social image is linked to Poster › Image
- **THEN** the source control MUST read "Poster › Image" with the link glyph, in the link color

### Requirement: A fact is named for its item

A value that follows a fact of the item MUST be named "‹Item›'s ‹fact›",
where ‹Item› is "Page" on a Canvas page and the type's label on a template,
and MUST look like a field: the link glyph, in the link color, because it is
filled from each item. The word "page" MUST NOT name an item on a template.
A base property of the item (its title, author, creation and change dates)
MUST be offered as a fact only, never again among the type's fields.

#### Scenario: The same date on a template and a page

- **WHEN** an editor opens Updated on "Every Article", and then on an Article page
- **THEN** the source control MUST read "Article's last update" on the template and "Page's last update" on the page, each with the link glyph in the link color

#### Scenario: A page's dates

- **WHEN** an editor opens the Schema tab of an Article page
- **THEN** Updated and Published MUST be read-outs under "Page's last update" and "Page's publish date", and each source menu MUST offer "Type a date" under "Set on this page"

#### Scenario: No base property twice

- **WHEN** an editor opens Updated's source menu on "Every Article"
- **THEN** "Article's last update" and "Article's publish date" MUST be listed once each, as facts, and the type's fields MUST NOT list Changed or Authored on

### Requirement: Wider sources are named by what they follow

A value that follows another value in the dialog MUST be named by it
("Search description"). A value from the site MUST be named "This site" when
the site is a who, else "Site" and the setting ("Site name", "Site ending",
"Site image", "Site setting"). A value from another language MUST be named
"‹Language› version". These sources MUST be drawn in the secondary ink,
without the link glyph.

#### Scenario: The social description

- **WHEN** "Every Event" sets no social description
- **THEN** its source control MUST read "Search description", without the link glyph

#### Scenario: Summary on Schema

- **WHEN** "Every Event" sets no Summary detail
- **THEN** its source control MUST read "Search description" and its read-out MUST show the search description as it reads

### Requirement: A translation follows its default language only for shared settings

On a Canvas page translation, only the settings that are the same in every
language MUST follow the default translation: the robots rows, "Show in
search results" included, the kind, and the social image. While they do,
their source control MUST read "‹Language› version", and the source menu
MUST list it under "Follows the ‹Language› version", marked "Default".
Texts MUST NOT follow another language. Templates and Site MUST NOT offer
another language as a source.

#### Scenario: A translation's social image

- **WHEN** the English About page has a chosen social image and its Finnish translation sets none
- **THEN** the Finnish social image MUST show that image as an image row with no Change under the source control "English version", and its menu MUST open with "Choose image…" active and list "English version" checked and marked "Default"

#### Scenario: A translation's robots row

- **WHEN** the English page sets "Follow links" off and the Finnish translation sets nothing
- **THEN** the Finnish Follow links row MUST say "English version" on its second line, and turning its switch MUST set it on this page and say "Follow links is now set on this page."

#### Scenario: A translation's kind

- **WHEN** the English page is an article and the Finnish translation stores no kind
- **THEN** "What this page is" MUST read "An article" under "English version", with a right chevron

#### Scenario: Going back to the default language

- **WHEN** the Finnish social image is set on this page and an editor presses Delete on its source control
- **THEN** it MUST follow the English version again, and the status MUST say "Image is back to the English version."

#### Scenario: Texts are translated

- **WHEN** an editor opens the Search or Social tab of the Finnish page
- **THEN** no title, description or social text MUST name "English version", and the description MUST show no source control

### Requirement: Default, Not set, broken and outside SEO have one meaning each

"Default" MUST mean only what a field gives when nobody chooses: at rest it
MUST name only a built-in choice, and in a source menu it MUST mark the
default row. "Not set" MUST name a value that is left out. A broken link
MUST be named by a broken-link glyph and the field's label, or its machine
name once the field is gone, in the broken color. A value set outside SEO
MUST be named "Outside SEO" after a lock glyph, as static words, and its
guidance MUST say where it is set.

#### Scenario: A default and the same source picked by hand

- **WHEN** one template's Updated follows its default and another's is linked by hand to Revised on, which today gives the same date
- **THEN** each field MUST name its own source at rest, and only the source menu MUST mark the default row "Default"

#### Scenario: A deleted field

- **WHEN** "Every Article"'s description links to `field_teaser`, which was deleted
- **THEN** its source control MUST read `field_teaser` with the broken-link glyph, in the broken color

#### Scenario: An ending set in the settings file

- **WHEN** the test site overrides the title ending in its configuration and an administrator opens Site
- **THEN** the Title ending MUST show the lock glyph and "Outside SEO" with no chevron, still focusable, over a locked box, with the guidance "Set in the site's settings file. Ask whoever hosts the site."
- **AND** Delete or Enter on its control MUST do nothing and write nothing

### Requirement: No mechanism words at rest

At rest no field MUST say "Linked", "Automatic", "Inherited", "Set for
every", "Set on this page", "From the page", "Same as", "Site default",
"Site configuration", "(this site)" or "(the page's author)". A menu heading
and a sentence in the status or in Checks MAY use "Follows" and "Set"
("Follows each Article", "Updated now follows Starts.", "Set for every
Article.").

#### Scenario: A template's Schema tab at rest

- **WHEN** an editor opens "Every Article"'s Schema tab
- **THEN** none of those words MUST be on screen

### Requirement: A box means you type here

Text kept at this scope, typed or composed, MUST be an input box or a
composer. Every other value of a field with a source control MUST be a
read-out: the value in the dialog's ink, aligned with the label, with no
box, never gray and never a placeholder. Only three exceptions MUST hold: a
locked value kept here keeps a gray locked box; a field with one source
keeps its own control; a linked duration shows its unit choice under its
read-out.

#### Scenario: A date that follows the item

- **WHEN** "Every Article"'s Updated follows its default
- **THEN** the date MUST be a read-out with no box

#### Scenario: A composed description

- **WHEN** "Every Article"'s description is Body and the typed words " Free delivery."
- **THEN** it MUST be a composer under the source control "Every Article"

#### Scenario: A one-source select

- **WHEN** an administrator opens Site with no currency chosen
- **THEN** Currency MUST be a select reading "Not set" in ink, with no source control

### Requirement: Choices and people are read-outs

A choice, a person and a date that follows something MUST be read-outs, a
choice and a person even when chosen here, and MUST change through the
source menu, whose kept-here group lists the options. There MUST never be a
second select beside a source control.

#### Scenario: A choice kept for every Event

- **WHEN** "Every Event"'s Status is set to Scheduled
- **THEN** the field MUST show the source control "Every Event" and the read-out "Scheduled", and no select

#### Scenario: A built-in choice

- **WHEN** an editor opens "Every Article"'s Kind of article, which nobody chose
- **THEN** it MUST read "Article" under the source control "Default", and its source menu MUST list Article, Blog post and News article under "Set for every Article", Article checked and marked "Default"

### Requirement: Not set is an empty box only where it can be typed

A field that is not set MUST show an empty box when it can be typed, with no
placeholder, and only its label row when it cannot. A row that is only a
label MUST be a target as a whole, with a hover fill and a pointer, and open
the source menu.

#### Scenario: Not set

- **WHEN** a recipe's Prep time and Organizer are not set
- **THEN** Prep time MUST show "Not set" and empty boxes with their units, and Organizer MUST show only its label row with "Not set"

#### Scenario: Hover on the row

- **WHEN** an editor hovers Organizer's label row
- **THEN** the whole row MUST show the row hover fill and a pointer, and its source control the control's hover look

#### Scenario: A click on the row

- **WHEN** an editor clicks Organizer's label
- **THEN** Organizer's source menu MUST open

### Requirement: A read-out of text turns into its box on a click

A read-out of text that can be typed over MUST show the input's edge and a
text cursor on hover, and a click MUST turn it into its box with the caret:
on a page, the native input holding the text; on a template, a composer
holding the followed source first, or a copy of another value it follows.
Nothing MUST be stored until the first change, when the source control MUST
read the kept-here word. Escape, or leaving it unchanged, MUST bring the
read-out back.

#### Scenario: A page's social title

- **WHEN** an editor clicks the read-out "About" of a page's social title, which follows the page's title
- **THEN** a text input holding "About" MUST have focus with the caret at the end, the source control MUST still read "Page's title", and nothing MUST be stored

#### Scenario: The first change

- **WHEN** the editor then types " Humanify"
- **THEN** the source control MUST read "This page" and the status MUST say "Social title is now set on this page."

#### Scenario: Escape

- **WHEN** an editor clicks the read-out and presses Escape without typing
- **THEN** the read-out "About" MUST be back and the field MUST still follow the page's title

#### Scenario: Starting from another value

- **WHEN** "Every Event"'s social description follows the search description, which is Event's description and " Book now.", and an editor clicks its read-out and types "!"
- **THEN** the social description MUST be a composer holding Event's description, " Book now.!", under "Every Event", and a later change to the search description MUST NOT change it

### Requirement: A paste on a source control opens its box

A paste on the source control of text that can be typed over MUST open its
box, as a click does, and paste there.

#### Scenario: Pasting on the control

- **WHEN** an editor focuses the source control of a page's social title and pastes "Hello"
- **THEN** the text input MUST open holding the page's title with "Hello" pasted at the end, and the control MUST read "This page"

### Requirement: Other read-outs open the source menu

A read-out that is not text that can be typed over (a date, a person, a
choice, an image, a group) MUST show a hover fill and a pointer, and a click
MUST open its source menu, or a group's sheet.

#### Scenario: A date read-out

- **WHEN** an editor clicks the read-out of "Every Article"'s Updated
- **THEN** its source menu MUST open, and no input MUST appear

#### Scenario: A person read-out

- **WHEN** an editor hovers and then clicks the read-out "admin" of "Every Article"'s Author
- **THEN** the read-out MUST show the row hover fill and a pointer, and the click MUST open Author's source menu

### Requirement: One source menu per field

The source control MUST open the field's source menu: a dialog named "Source
of ‹Field›" with a filter labelled "Find a source", in every source menu,
and a listbox of rows. Each row MUST be named in the source control's words
and look, and show under its name the value it would give for the previewed
item or what happens; an action row only when that adds something. The
default row MUST be marked "Default"; the current row MUST be checked and
selected.

#### Scenario: Updated's current row

- **WHEN** an editor opens the source menu of "Every Article"'s Updated
- **THEN** "Article's last update" MUST be checked, marked "Default" and show the previewed article's date

#### Scenario: A page's typed title

- **WHEN** an editor opens the source menu of a page's title, typed on the page
- **THEN** it MUST have the filter "Find a source", list "Page's title" with the page's title, marked "Default", under "Follows the page", and "This page" with the typed title, checked, under "Set on this page"

### Requirement: The source menu is grouped by follows and set

Rows MUST be grouped, each group shown only when it has a row, in this
order: "Follows each ‹Type›" or "Follows the page" (facts, then fields that
fit); "Follows the site"; "Follows the ‹Language› version"; then "Set for
every ‹Type›", "Set on this page" or "Set for the site" (actions that keep a
value here, a choice's options, and "Not set"). Groups MUST be named by
their headings to assistive technology.

#### Scenario: Updated's menu

- **WHEN** an editor opens the source menu of "Every Article"'s Updated, on a type with the date field Revised on
- **THEN** "Follows each Article" MUST list "Article's last update" (checked, marked "Default", with its date), "Article's publish date" and "Revised on", each with its date; "Set for every Article" MUST list "Type a date" and "Not set"; and the footer MUST say how many other fields can't be used here

#### Scenario: A template title's menu

- **WHEN** an editor opens the source menu of "Every Event"'s title, which follows its default
- **THEN** it MUST show, in order, "Add words or fields" under the filter, "Follows each Event" with "Event's title" (checked, "Default") and the type's text fields, "Follows the site" with "Site name", and "Set for every Event" with "Type a title"

#### Scenario: A page's date

- **WHEN** an editor opens the source menu of an Article page's Published detail
- **THEN** its first group MUST be "Follows the page" and its last "Set on this page"

#### Scenario: A translation

- **WHEN** an editor opens the source menu of a Finnish page's social image that follows the English version
- **THEN** a group "Follows the English version" MUST list "English version", checked

#### Scenario: No Automatic group

- **WHEN** any source menu is open
- **THEN** it MUST NOT have a group named "Automatic" or a row "Instead of the default"

### Requirement: A source menu leads to Site

When a source menu lists a row from the site and the editor may administer
site settings, its one footer MUST offer "Edit in Site", which MUST switch
to Site, scroll to that setting and put focus on it. A menu MUST have at
most one footer.

#### Scenario: Edit the site's ending

- **WHEN** an administrator opens the title ending's source menu on a page and presses "Edit in Site", by mouse or by keyboard
- **THEN** the dialog MUST switch to Site, scroll to its Title ending and put focus on it

### Requirement: Going back is a row, a key and Undo

The way back to a field's default MUST be its default row in the source
menu, or Delete or Backspace on the focused source control. Neither MUST do
anything when the field already follows its default. Every change of source
MUST offer Undo in the action bar, which MUST stay until the next edit or a
scope switch, with no time limit. No field MUST offer Reset.

#### Scenario: Delete on the control

- **WHEN** "Every Article"'s Author follows This site and an editor presses Delete on its focused source control
- **THEN** Author MUST follow "Article's author" again, focus MUST stay on the control, and the status MUST say "Author is back to Article's author."

#### Scenario: Going back on the only change

- **WHEN** a page's only draft change is its title and the editor picks "Page's title" in the title's source menu
- **THEN** the field MUST show the page's title as a read-out, the page's draft change MUST go away, and the status MUST return to "Matches the published page"

#### Scenario: Undo

- **WHEN** the editor then presses Undo in the action bar
- **THEN** the title MUST hold the typed text again, in its box, under "This page"

#### Scenario: Undo waits

- **WHEN** an editor links Updated to Revised on and then does nothing for a minute
- **THEN** Undo MUST still be in the action bar

### Requirement: Every change of source is said in one sentence

After a change of source, the status and the action bar MUST say one
sentence: "‹Field› now follows ‹Source›." for a followed source; "‹Field› is
now set for every ‹Type›.", "… set on this page." or "… set for the site."
for a value kept here; "‹Field› is back to ‹Source›." for the default;
"‹Field› is now not set." for Not set. A source name MUST lose its leading
capital in a sentence. A pick that stores nothing yet MUST say nothing.

#### Scenario: Following the site

- **WHEN** an editor picks "This site" in Author's source menu
- **THEN** the status MUST say "Author now follows this site."

#### Scenario: Linking a field

- **WHEN** an editor picks Revised on in Updated's source menu on "Every Article"
- **THEN** the status MUST say "Updated now follows Revised on."

#### Scenario: Typing a date for every Article

- **WHEN** an editor picks "Type a date" and enters a date
- **THEN** the status MUST say "Updated is now set for every Article." only once the date is entered

#### Scenario: Back to Not set

- **WHEN** "Every Recipe"'s Author follows This site and an editor presses Delete on its source control
- **THEN** the status MUST say "Author is now not set."

### Requirement: The source control comes first in the Tab order

A field's source control MUST come before its box in the Tab order. The
title's ending is the next field. A read-out MUST NOT be a Tab stop, so a
field whose value is a read-out is one Tab stop. The source control MUST
open its menu on Enter, Space or Alt+Down. On the source control of text
that can be typed over, Arrow right or End MUST turn the read-out into its
box with the caret at the end, as a click does.

#### Scenario: Tabbing through a template's Schema tab

- **WHEN** an editor tabs from Updated, which follows its default, to Ends, which is typed for every Event
- **THEN** focus MUST go to Updated's source control, then Ends's source control, then Ends's date input

#### Scenario: Tabbing through a page's title

- **WHEN** an editor tabs through a page's typed title and its ending, which follows the site
- **THEN** focus MUST go to the title's source control, the title's input, then the ending's source control

#### Scenario: End on a page's social title

- **WHEN** an editor focuses the source control of a page's social title, which follows the page's title, and presses End
- **THEN** a text input holding the page's title MUST have focus with the caret at the end

### Requirement: Sources are named for assistive technology from the screen

A source control MUST be a button whose name starts with its visible words
and then names its field ("Article's last update, source of Updated"), with
`aria-haspopup="dialog"` and `aria-expanded`, described by the read-out under
it. A static source control MUST have neither. A box MUST be described by
its source as a sentence ("Set for every Article.", "Set on this page.",
"Not set."). Sources MUST NOT be given only through `aria-description`.

#### Scenario: A screen reader on Updated

- **WHEN** a screen reader focuses the source control of "Every Article"'s Updated
- **THEN** it MUST hear "Article's last update, source of Updated", a collapsed button with a popup, described by the previewed article's date

#### Scenario: A box kept here

- **WHEN** a screen reader focuses Ends's date input, typed for every Event
- **THEN** its description MUST include "Set for every Event."

### Requirement: Settings rows say their source on a second line

A settings row whose setting can follow the site, or another language, MUST
say its source on its second line, as a source control. A switch MUST stay
at the row's end; turning it MUST set the value here. A setting with options
MUST have no select: its options MUST be rows of the source menu's kept-here
group, and the row MUST end in the chosen option as a read-out that opens
that menu.

#### Scenario: Advanced on a template

- **WHEN** an editor opens Advanced on "Every Event", which sets nothing
- **THEN** Follow links, Text previews and Image previews MUST each say "Site setting" on their second line, Follow links MUST end in its switch, Text previews and Image previews MUST end in their option as a read-out with no select, and no summary MUST show while it is open

#### Scenario: One row set

- **WHEN** the editor picks Standard under "Set for every Event" in Image previews' source menu
- **THEN** that row's second line MUST read "Every Event" and the row MUST end in "Standard"

#### Scenario: Picking the site's value by hand

- **WHEN** the site's Image previews is Large and the editor picks Large under "Set for every Event"
- **THEN** Image previews MUST be stored as Large for every Event, and its second line MUST read "Every Event"

### Requirement: A closed settings list summarizes its sources

A closed disclosure of settings rows MUST summarize sources, not values: the
source's name when every row in it follows that source ("Site settings"),
else what differs ("1 set for every Event", "2 set on this page"). The
summary MUST show only while the disclosure is closed.

#### Scenario: Closed with one row set

- **WHEN** "Every Event" sets Image previews to Standard and the editor closes Advanced
- **THEN** the closed row MUST read "1 set for every Event"

#### Scenario: Open

- **WHEN** the editor opens Advanced again
- **THEN** its row MUST show no summary

### Requirement: A default that gives nothing names what is used

A field whose default reads a field that is empty for the previewed item
MUST keep that field in its source control, and its read-out MUST start with
the state in words and say what is used instead.

#### Scenario: A page without an image

- **WHEN** a page's social image follows its default, the page's Image field is empty, and the site has a default image
- **THEN** the source control MUST read "Page data › Image", and the image row MUST show the site's image with "Empty for this page, so the site image is used."

### Requirement: Sources hold in forced colors

In forced colors four things MUST stay apart without color: a box MUST have
a visible edge and a read-out none; every source control MUST be drawn as a
bordered button; a field or a fact MUST keep its link glyph, a source from
the site or another language MUST have a dashed border, a broken link MUST
keep its glyph and Outside SEO its lock; focus MUST be a Highlight outline.
Values MUST keep the text color, never the color for disabled text.

#### Scenario: A Schema tab in forced colors

- **WHEN** "Every Event"'s Schema tab is shown with forced colors active
- **THEN** an input MUST have an outline and a read-out none, every source control MUST have a solid border, "This site" a dashed one, "Event's last update" and "Starts" their link glyph, `field_teaser` its broken glyph, the focused control a Highlight outline, and no value MUST be drawn in GrayText

### Requirement: The source control fits narrow fields

When a field is narrower than 280 px, at 200 % zoom, at 320 px or in a pair
column, its source control MUST move under its label, start on the label's
edge and may use the field's whole width; a control in the secondary ink
MUST keep a faint hover fill there at rest. The label MUST NOT wrap for it
and no part of the page MUST scroll sideways. Long words MUST end in an
ellipsis, with the whole source in the control's name.

#### Scenario: A pair column

- **WHEN** Starts and Ends sit side by side on "Every Event"'s Schema tab at the dialog's width, Starts following "Event's publish date"
- **THEN** each source control MUST sit under its label, whole or ending in an ellipsis, and no label MUST wrap

#### Scenario: 200 % zoom

- **WHEN** the dialog is half its normal width
- **THEN** every source control MUST sit under its label, "Not set" and "Every Recipe" MUST show a faint fill, and the dialog MUST NOT scroll sideways

### Requirement: The title ending is its own field

The title's ending MUST be its own field, labelled "Ending" under the title
and named "Title ending" to assistive technology, with its own source
control and source menu. Following the site, it MUST read "Site ending"
over a read-out. Set here, it MUST read the kept-here word over a text box
holding the ending after the separator. Linked, it MUST name the field over
a read-out.

#### Scenario: A page's ending

- **WHEN** a page on the site "Example" sets no ending
- **THEN** the Ending field MUST show the source control "Site ending" and the read-out "| Example", with no box

#### Scenario: An ending kept for every Event

- **WHEN** "Every Event" sets the ending "Tickets"
- **THEN** the Ending field MUST show "Every Event" over a text box holding "Tickets" after the separator, and typing in it MUST change the ending

#### Scenario: A linked ending

- **WHEN** "Every Event" links its ending to Venue › Short name and the previewed event's venue is "Lakeside"
- **THEN** the Ending field MUST show "Venue › Short name" with the link glyph over the read-out "| Lakeside"

#### Scenario: The ending's menu

- **WHEN** an administrator opens the Ending's source menu on a page
- **THEN** it MUST have the filter "Find a source", list "Site ending" (checked, "Default"), "Type an ending" and "No ending", and end in one footer with the separator note and "Edit in Site"

### Requirement: A detail only a field fills is a row that opens the source menu

A detail that only a field fills (a job description, or what each page has
of its own on a template) MUST be its label row with the source control "Not
set" until it is linked, and the row MUST open the source menu.

#### Scenario: A job description

- **WHEN** a builder presses the Description row of Every Job posting
- **THEN** its source menu MUST open, listing the formatted text fields under "Follows each Job posting"

## MODIFIED Requirements

### Requirement: Values equal to what is inherited are not stored

Clearing a text field, or leaving only white space in it, MUST remove the
override. Picking the row marked "Default" in a source menu MUST store
nothing, for every kind of field, so the field keeps following its source. A
switch turned back to the value it would inherit MUST store nothing.
Picking any other row MUST be stored, even when it gives the same value as
the default today. Text MUST be kept as typed, trailing spaces included.

#### Scenario: A switch turned off and on again

- **WHEN** an editor turns "Show in search results" off and on again on a page that inherits it
- **THEN** the page MUST store no visibility setting

#### Scenario: Linking the default source

- **WHEN** an editor picks "Article's title", the row marked "Default", in the source menu of "Every Article"'s title, which is typed
- **THEN** the template MUST store no title main part, the source control MUST read "Article's title", and the status MUST say "Title is back to Article's title."

#### Scenario: Picking the site's ending

- **WHEN** an editor picks "Site ending" in the ending's source menu
- **THEN** nothing MUST be stored for the ending

### Requirement: A page's description is Canvas's own field

At page scope, in every language, the Description field MUST be Canvas's
Page data description. It has one source, so it MUST show no source control;
while it has focus, its guidance MUST say "Also changes Page data's
description.". While it has focus, the previews MUST follow it and nothing
MUST be sent. On blur, or Ctrl/Cmd+Enter, the text MUST be handed to Canvas
once, which saves it with its Page data. When Canvas cannot take it, the
field MUST return to Canvas's value.

#### Scenario: Typing a description

- **WHEN** an editor types a new description and leaves the field
- **THEN** Canvas's Page data description MUST hold the text, and Canvas MUST save it at most twice, never once per key

#### Scenario: Shared with Page data

- **WHEN** an editor focuses a page's description
- **THEN** the field MUST say "Also changes Page data's description." and show no source control

#### Scenario: A template's description

- **WHEN** the target is a content type
- **THEN** its description MUST be a value of the template, like its title

### Requirement: Search visibility in plain words

The Search view MUST show visibility as one switch row, "Show in search
results", that says its source on its second line, and an "Advanced" row
with "Follow links", "Text previews" (Allowed, Limited, Off), "Image
previews" (Large, Standard, None) and, for a page, "Canonical address", which
has one source and no source control. Advanced MUST summarize the sources of
its rows while closed, and start open when something is set or an issue is
about one of its rows.

#### Scenario: Hiding a page

- **WHEN** an editor turns "Show in search results" off on a page
- **THEN** the row MUST say "Hidden · noindex" with "This page" on its second line, and a notice MUST say "Hidden from search engines" with "Show in search"

#### Scenario: Nothing advanced set

- **WHEN** links are followed, text previews are allowed, image previews are large and no canonical address is set, all from the site
- **THEN** Advanced MUST be closed and summarized as "Site settings"

#### Scenario: A typed address

- **WHEN** an editor types a canonical address or a character limit
- **THEN** it MUST be taken when the field is left or Enter is pressed, not per key

### Requirement: The title is edited as a main part and an ending

The Title field MUST be two fields: the main part, under the title's source
control, and the Ending under it, with its own source control ("The title
ending is its own field"). The title's source control MUST speak for the
main part only. The main part MUST be a text input on a page while it is
typed there, a read-out while it follows the page's title, and on a template
a value that can be linked and composed: a read-out while it follows its
default or links one field, and a composer otherwise. The ending MUST NOT be
composed, and MUST be described by what it adds. Going back to the title's
default MUST NOT change the ending.

#### Scenario: What the ending adds

- **WHEN** the title's ending is "Example" and the separator "|", or the ending is "No ending"
- **THEN** the Ending's source control MUST be described "Added after the separator |.", or "The title ends with its main part."

#### Scenario: A page's title

- **WHEN** an editor opens the Search tab of a page on the site "Example" with the installed defaults, and the page has typed its title
- **THEN** the Title field MUST have the source control "This page" and one textbox named "Title", and the Ending field the source control "Site ending, source of Title ending" over the read-out "| Example"

#### Scenario: A template's title

- **WHEN** an editor opens the Search tab of "Every Event" on the site "Example"
- **THEN** the Title field MUST have the source control "Event's title" over the previewed event's title as a read-out, and the Ending field "Site ending" over "| Example"

#### Scenario: A template's composed title

- **WHEN** "Every Event"'s title main part is Event's title, " in ", Venue › City
- **THEN** the Title field MUST have the source control "Every Event" and one composer named "Title" whose result line leaves out "| Example", and the Ending field MUST still read "Site ending"

### Requirement: Site sets only the title ending

Site MUST set the title's ending only, as a field "Title ending" as wide as the
other controls, with no control for the main part, and an example line of a
whole title under it. While it follows the site name, the field MUST show the
source control "Site name" and the ending as a read-out. Its source menu MUST
list "Site name" under "Follows the site", marked "Default", and "Type an
ending" and "No ending" under "Set for the site".

#### Scenario: The site's title

- **WHEN** an administrator opens Site
- **THEN** a field "Title ending" MUST show "Site name" and the ending "| Example" as wide as the other controls, with no "Page title" control, the separator under it, and an example line such as "For About us: About us | Example"

#### Scenario: The site ending's menu

- **WHEN** an administrator opens the Title ending's source menu in Site
- **THEN** it MUST list "Site name" checked and marked "Default", then "Type an ending" and "No ending" under "Set for the site"

### Requirement: The kind always reads what search engines get

"A web page" MUST be a kind the editor can choose. The field and the kinds
sheet MUST always show the kind that is output, never an empty or "Choose"
state, read-only included. While the kind is built in, the field's source
control MUST read "Default" and the kinds sheet MUST mark that kind
"Default"; picking it MUST store nothing. On a page translation that stores
no kind, the control MUST read "‹Language› version". A kind taken from
Suggest MUST be set on this page, as any pick is.

#### Scenario: A new page

- **WHEN** an editor opens Schema on a page with no stored type
- **THEN** the field MUST read "A web page" under the source control "Default", with no "Default" pill, and the kinds sheet MUST have "A web page" selected and marked "Default"

#### Scenario: Back to a web page

- **WHEN** an editor changes an article to "A web page"
- **THEN** the field MUST read "A web page", the output graph MUST have no main node, and after the draft is saved and the dialog reopened the field MUST still read "A web page"

#### Scenario: A translation of an article

- **WHEN** a translation's default-language version is an article and the editor opens its Schema tab
- **THEN** the field MUST read "An article" under "English version"
- **AND** when the editor chooses "A web page", the translation MUST store `WebPage`, its control MUST read "This page", and its output MUST be a web page while the default-language version stays an article

#### Scenario: Taking a suggestion

- **WHEN** an editor takes Suggest's kind on a page
- **THEN** the control MUST read "This page" and the status MUST say "What this page is is now set on this page."

### Requirement: Only what the scope can fill is offered

A Schema view MUST show only the facts its scope can fill. "Also helps"
lines MUST list only facts offered on that scope. A fact that belongs to
another fact ("Open to people in", under where the work is) MUST show
indented under it, and only while the answer calls for it. More details
MUST name its details, never their values, a detail that follows a default
the editor may need to change first ("Organizer, Summary, 5 more"). At most
four facts MUST come before More details; a choice of who, and a detail
shown under another, count as one.

#### Scenario: A recipe on a Canvas page

- **WHEN** a Canvas page is described as a recipe
- **THEN** the view MUST show no Ingredients or Steps field and no "Also helps" line for them

#### Scenario: A remote job

- **WHEN** every job of a type is fully remote
- **THEN** "Open to people in" MUST be under Where the work is, no Workplace MUST be shown, and at most four facts MUST come before More details

#### Scenario: A default in More details

- **WHEN** an event page's Organizer follows the site and sits in More details with Summary and five others
- **THEN** More details MUST read "Organizer, Summary, 5 more"

### Requirement: A nested object is one line that opens a sheet

A group of more than three parts MUST show as its label row and one read-out
line holding its formatted line, or only its label row while nothing is set.
Its source control MUST say what its set parts follow, empty parts left out:
"‹n› broken" in the broken color when any part is broken; else "‹n› fields"
with the link glyph when every set part is linked to a field; else the
shared source's name when every set part follows one source ("This site",
"Every Event", "This page"); else "Mixed sources"; or "Not set". It MUST end
in a right chevron. Pressing it or the read-out MUST open a sheet with a
plain "Reads as" line that says what the read-out says (a page named as the
group, once), then the parts in the shape's order, each with its own source
control. The sheet has no Save button. Its header MUST offer Clear, which
sets every part to Not set, says "‹Group› is now not set." with Undo, and
leaves focus on the sheet's title.

#### Scenario: A venue on an event page

- **WHEN** an editor presses the Venue read-out reading "Riverside Hall, Helsinki"
- **THEN** a sheet titled "Venue" MUST open with focus on its title, listing Name, Street address, Postal code, City, Region and Country in that order
- **AND** Escape MUST close it and return focus to the Venue source control

#### Scenario: Two parts linked

- **WHEN** "Every Event"'s Venue › Name and Street address are linked to Venue › Title and Venue › Street address, and no other part is set
- **THEN** the Venue source control MUST read "2 fields" with the link glyph and a right chevron

#### Scenario: Mixed sources

- **WHEN** the same venue also has City typed for every Event
- **THEN** the Venue source control MUST read "Mixed sources" with a right chevron

#### Scenario: A broken part

- **WHEN** one of the venue's linked parts links a field that was deleted
- **THEN** the Venue source control MUST read "1 broken" in the broken color, with the broken-link glyph

#### Scenario: A group set on a page

- **WHEN** every set part of an event page's Venue is typed on the page
- **THEN** the Venue source control MUST read "This page"

#### Scenario: An address without a country

- **WHEN** a venue has a street and a city but no country
- **THEN** the Venue field MUST say "Add the country, so the address can be used." with an "Add" button named "Add Country", as the verdict's is, that opens the sheet on Country, and the sheet MUST say the same sentence once under "Reads as"

### Requirement: What a group misses is said under it

What a group misses MUST be said under its read-out, in one sentence with
what a search feature asks more of it ("Add the city and the country for
event listings."). A jump to a missing part (Add in a verdict, Show in
Checks, a part of the sentence) MUST open the group's sheet with focus on
that part's first control, and Back MUST return to where the jump came from,
else to the group's source control.

#### Scenario: A country written as a name

- **WHEN** a venue's country is stored as "Finland", which the list does not hold
- **THEN** its field and its sheet MUST say "Choose the country from the list." with a "Choose" button, and the event result MUST read "Needs a country from the list"

#### Scenario: Add Country in the verdict

- **WHEN** an event's venue misses its country and the editor presses the verdict's "Add Country"
- **THEN** the Venue sheet MUST open with focus on Country

### Requirement: A reference is chosen, never typed as data

An organizer, employer, author or the organization a person works for MUST
change through one source menu: the item's own person fact where the type
has one ("‹Item›'s author"), then the type's fields that can be a person
(user references, person or organization references, and text fields that
can hold a name), by their labels; "This site" under "Follows the site"; and
under the kept-here group "Someone else", which reveals a name and a website
indented under it, shown as "Name" and "Website" and named "‹Label› name"
and "‹Label› website", and "Not set" where nothing is assumed. The site, a
fact or a linked field MUST hide them. There MUST be no separate select and
no second link menu.

#### Scenario: Someone else organizes

- **WHEN** an editor chooses "Someone else" for the organizer
- **THEN** "Organizer name" and "Organizer website" MUST appear under it, empty, with focus on "Organizer name", the source control MUST read the kept-here word, the status MUST say "Organizer is now set for every ‹Type›. Type a name." or "… set on this page. Type a name.", and the organizer MUST be emitted with that name only once it is typed

#### Scenario: This site, once

- **WHEN** an editor opens the source menu of "Every Article"'s Author on a type with a Byline text field
- **THEN** "This site" MUST be listed once, under "Follows the site", and "Byline" MUST be listed under "Follows each Article" after "Article's author"

### Requirement: Who nobody chose is said

An organizer or recipe author MUST default to the publisher on a Canvas
page, where its source menu has no "Not set"; choosing "Someone else" there
MUST be kept at once, so that the site is no longer assumed, and nothing is
emitted until a name is typed. Where nobody set it but a default names
someone (an article's author), the field MUST show the default's source
("Page's author", "Article's author") and the name as a read-out. Where the
type has no default, the "Not set" row MUST be the default and say "Left out
until you pick one."

#### Scenario: Someone else, not named yet

- **WHEN** an editor of an event page chooses "Someone else" and types nothing
- **THEN** no organizer MUST be emitted, Checks MUST not say "The organizer is your site", and the source control MUST still read "This page" when the dialog opens again

#### Scenario: The organizer of a page

- **WHEN** an editor opens the Schema tab of an event page whose Organizer nobody set
- **THEN** Organizer MUST read "Humanify Studio" under "This site", and its source menu MUST NOT list "Not set"

#### Scenario: An article's author

- **WHEN** a page described as an article has no author set and its author is Ada Lovelace
- **THEN** Author MUST show the source control "Page's author" and the read-out "Ada Lovelace", and More details, where Author sits, MUST name Author first

#### Scenario: A recipe template

- **WHEN** a builder opens the source menu of "Every Recipe"'s Author, which is not set
- **THEN** its "Not set" row MUST be checked, marked "Default" and say "Left out until you pick one.", and "Recipe's author" MUST be offered under "Follows each Recipe"

### Requirement: A linked list says how many it gives

A list linked to a field of several values MUST read its first item and how
many more at rest, in its read-out.

#### Scenario: Ingredients linked

- **WHEN** Ingredients link to a field holding four ingredients for the previewed recipe
- **THEN** the read-out MUST read "500 g rye flour and 3 more"

### Requirement: A linked duration reads in its unit

A linked duration MUST read in its unit ("20 min"), and the question of what
its field counts MUST be a compact segmented choice under the read-out, not
a select, named by its time and what it shows.

#### Scenario: Prep time linked

- **WHEN** a builder links Prep time to a field holding 20 for the previewed recipe
- **THEN** the read-out MUST read "20 min" and the choice under it MUST be named "Prep time: the field counts minutes"

### Requirement: The link preview

The Social view MUST open with the card a shared link shows: the server's image for the draft, the social title and description, and the site's host. It MUST be large only when the image is at least 600 px wide and 157 px tall, as in the head; a small card shows a square thumbnail no taller than the card. The caption MUST read "When this page is shared" (on a type, "When this ‹type› is shared"), adding "Small card". The image field MUST say where the image comes from in its source control.

#### Scenario: A page without an image

- **WHEN** an editor opens Social on a page with no image on a fresh install
- **THEN** the preview MUST show the card made from the page's title as the server draws it, and the image field's source control MUST read `Title card`, its menu opening with "Choose image…"

#### Scenario: A small or missing image

- **WHEN** the image sent is under 600 px wide, under 157 px tall, or there is none
- **THEN** the card MUST be small, its caption MUST add "Small card", and "About this preview" MUST say "Small card: image under 600 px wide.", "Small card: image under 157 px tall." or "Small card: no image."

#### Scenario: The card the head asks for

- **WHEN** the image sent is an original file under 600 px wide, such as a chosen 150 × 150 image, or a 400 × 400 logo on a site that cannot make images
- **THEN** the card MUST be small, with a square thumbnail as tall as the card at Canvas's dialog width, and Output MUST show the card hint `summary`

#### Scenario: No social text set

- **WHEN** a page sets no social title or description
- **THEN** the card MUST show the page's title and the search description, and the fields' source controls MUST read "Page's title" and "Search description"

#### Scenario: Where the image comes from

- **WHEN** no image is chosen for the page
- **THEN** the image field's source control MUST read "Page data › Image" (or "Page's first image" for a component image) when the page has one, else `Title card`, `Site image` or "No image" by the site's choice

#### Scenario: A found image too small to share

- **WHEN** the page's own image is 500 × 300, so the page shares a card made from its title
- **THEN** the source control MUST read `Title card`, and its read-out MUST say that the Image field's image is too small to share, with its size

#### Scenario: The page's own image is not public

- **WHEN** the media item in a page's Image field is unpublished or not a public file, so the page shares a card made from its title
- **THEN** the source control MUST read `Title card`, and its read-out MUST say "The Image field's image can't be shown publicly"

#### Scenario: A content type

- **WHEN** a site builder opens Social on the Event template, whose image is linked to Poster
- **THEN** the source control MUST read "Poster › Image" and its read-out MUST say that an event without one shares a card made from its title; for a previewed event without a Poster, only "This event has no Poster, so it shares a card made from its title."

#### Scenario: A content type's image too small to share

- **WHEN** Social on the Article template previews an article whose Image is 500 × 300, so it shares a card made from its title
- **THEN** the image field's read-out MUST say "This article's Image is too small to share (500 × 300), so it shares a card made from its title.", as the missing-image case says it, and not what an article without one shares

#### Scenario: A page still named for a new page

- **WHEN** a page still has the name Canvas gives a new page and is titled by its first heading
- **THEN** the social title's and the search title's source controls MUST say the title comes from the page's first heading while it is not typed

#### Scenario: A content type's missing image in Checks

- **WHEN** the previewed event has no Poster, so it shares a card
- **THEN** Checks MUST ask to add a Poster to this event in words, without a Choose image fix: an image chosen on the template would be every event's

#### Scenario: A chosen image that is not public

- **WHEN** the chosen image is unpublished or not a public file
- **THEN** the source control MUST name what is shared instead (`Title card` when a card is, `Site image`, "Page data › Image", or "No image" only when nothing is shared), and its read-out MUST say "The chosen image can't be shown publicly" whole on a line

#### Scenario: Text from the page

- **WHEN** a Canvas page's description comes from its own text
- **THEN** the description field's source control MUST read "Page's text"

### Requirement: Preview and fields point at each other

Clicking a part of a preview MUST put focus on the field that sets it: in its
box, in a composer with the caret at its end, or on its source control while
the value is a read-out. Focusing a field MUST highlight its part of the
preview. The title's main part and its ending MUST each highlight only their
own words; a composed main part MUST highlight as one part.

#### Scenario: Clicking the preview's title

- **WHEN** an editor clicks the title in the search preview of a page that types its title
- **THEN** the Title input MUST have focus

#### Scenario: Focusing the ending

- **WHEN** an editor focuses the Ending's source control or its box, or opens its menu
- **THEN** only the separator and the ending MUST be highlighted in the search preview

#### Scenario: Clicking the title of a template

- **WHEN** an editor of "Every Event", whose title follows its default, clicks the title in the search preview
- **THEN** the Title field's source control MUST have focus

#### Scenario: Focusing a composed title

- **WHEN** an editor focuses "Every Event"'s composed title
- **THEN** "Summer Gala in Helsinki · 20 June 2026" MUST be highlighted in the search preview as one part, and the ending MUST NOT be

#### Scenario: Clicking a composed title in the preview

- **WHEN** an editor clicks the composed title in the search preview and types "!"
- **THEN** the composition MUST end with "!"

### Requirement: A content type with nothing to preview is shown read-only

When a type's Full content template has no node to preview, the dialog MUST
show the template's values at rest, read-only, with no previews, no Output and
no Checks, and MUST say "No ‹type› yet. Add one to preview and edit these
settings.". No value MUST be marked as empty; a read-out MUST say "No ‹type›
to preview", also to assistive technology; source controls MUST be static
words with no chevron, still focusable; a value kept here MUST keep a locked
box; a setting MUST show its value in words.

#### Scenario: The Announcement type

- **WHEN** the Announcement template stores `title_end: {text: 'News'}` and the type has no content
- **THEN** the Search view MUST show the title's read-out saying "No announcement to preview" under "Announcement's title", and the Ending field "Every Announcement" over a locked box holding "News", none of them marked as empty, MUST NOT offer to edit them, and MUST say "No announcement yet. Add one to preview and edit these settings."

#### Scenario: Inherited fields

- **WHEN** the Announcement template stores no description and no social texts, and the type has no content
- **THEN** the description's read-out and the social description's read-out MUST each say "No announcement to preview", also in their source controls' descriptions

#### Scenario: Settings at rest

- **WHEN** the Announcement template sets no robots directive and no structured-data type, and the type has no content
- **THEN** "Show in search results" MUST read "On" and "Text previews" "Allowed", each with a static "Site setting" second line, with no switch and no menu, and "What this page is" MUST read "A web page" with no sheet to open

#### Scenario: Custom JSON-LD not set

- **WHEN** the Announcement template has no custom JSON-LD and the type has no content
- **THEN** the Schema view MUST NOT offer "Add your own JSON-LD" and MUST NOT open an empty editor

#### Scenario: The first announcement is added

- **WHEN** an editor adds an announcement while the dialog is open on the Announcement template, and the template editor moves to preview it
- **THEN** the open dialog MUST follow the editor to the previewed announcement and the values MUST become editable

### Requirement: Text keeps its own direction

Every text that shows a value MUST take its direction from its own text: the
previews' title, description, address and caption, the link preview's texts,
read-outs and values in source menus, and every input for free text (titles,
descriptions, names, search and filter fields). Inputs for addresses, numbers,
dates and code, and the dialog's own words, MUST keep the dialog's direction.

#### Scenario: An Arabic description

- **WHEN** a product's description is Arabic text that ends with a full stop
- **THEN** the search preview MUST show it right to left, with the full stop at its left end

#### Scenario: A Hebrew value in an input

- **WHEN** a description input holds Hebrew text that starts with a digit, such as an ingredient count
- **THEN** the input MUST lay the value out right to left

#### Scenario: An inherited Arabic value

- **WHEN** a person's social title is not set and follows its default, an Arabic name
- **THEN** its read-out MUST show the name right to left, as the link preview does

#### Scenario: A linked Arabic value

- **WHEN** "Every Product"'s description is linked to a field and the previewed product's value is Arabic
- **THEN** the read-out MUST show it right to left

### Requirement: Link menus stay inside the dialog

A menu that lists values with their previews (a source menu, the title
ending's menu) MUST open fully inside the dialog, whichever column its field
is in, and keep its side while open. Each entry MUST show its value under its
label across the menu's width, up to two lines, with the whole value available
on hover. Once a value is chosen, or the menu is left with Escape, its source
control, or the box it put a value in, MUST have focus. To assistive
technology the menu MUST be named after the field it fills.

#### Scenario: By keyboard alone

- **WHEN** an editor tabs to the source control of "Every Event"'s description, presses Alt+Down and then Enter on an entry
- **THEN** the description MUST follow that entry and its source control MUST have focus

#### Scenario: A field in the right-hand column

- **WHEN** an editor opens the source menu of Street address, beside Venue on "Every Event"'s Schema tab
- **THEN** the whole menu MUST be inside the dialog

#### Scenario: A double-click on the box in a short window

- **WHEN** an editor double-clicks the read-out of Street address on "Every Event"'s Schema tab in a window 1440 × 350, the menu opening over it
- **THEN** the menu MUST be open with its current entry active, and the second press MUST pick nothing, wherever it lands

#### Scenario: A long value

- **WHEN** the menu lists the previewed event's description
- **THEN** the description MUST be shown under "Event's description" on up to two lines, not cut beside the label

#### Scenario: A short window

- **WHEN** the editor's window is 1440 × 350 or 1440 × 420 and an editor presses Alt+Down on the source control of "Every Event"'s description
- **THEN** the menu MUST use the frame's height from the column's left edge and be as wide as the column, with nothing of the header beside it, MUST show at least two entries whole and a part of the next one as a cue that the list goes on, MUST NOT show the keyboard hints, and its filter MUST say "Find a source", on screen and to assistive technology alike

#### Scenario: The arrows in a short window

- **WHEN** an editor presses the down arrow through the menu in a window 1440 × 350
- **THEN** the active entry MUST stay clear of the cue that more entries are below

#### Scenario: The filter at every height

- **WHEN** the menu is open in a window 1440 × 900
- **THEN** its filter MUST say "Find a source", as in a short window, and typing in it MUST NOT move it

#### Scenario: A window resized across 420 px

- **WHEN** the window goes from 350 to 900 px tall, or from 900 to 350, while the menu is open
- **THEN** the menu MUST close at once and the source control MUST have focus, the field holding what it held

#### Scenario: At 200 % zoom

- **WHEN** an editor opens the menu in a dialog half its normal width
- **THEN** the menu MUST NOT show the keyboard hints

#### Scenario: A key right after a choice

- **WHEN** an editor presses Alt+Down on the description's source control, types "Perfo", presses Enter and at once Delete, in a window 1440 × 900, 1440 × 420 or 1440 × 350
- **THEN** the description MUST have followed the performer's name, Performers › Title, and Delete MUST have taken it back to its default, with focus on the source control

#### Scenario: Typing on right after Escape

- **WHEN** an editor types "{" in "Every Event"'s empty description composer, presses Escape and at once types "x"
- **THEN** the description MUST read "x"

#### Scenario: Escape from a box

- **WHEN** an editor opens the menu from the title's source control, presses Escape and at once Alt+Down
- **THEN** the source control MUST have focus at once, and the menu MUST open again

#### Scenario: A group whose label has a space

- **WHEN** the menu is opened on "Every Job posting"
- **THEN** each group MUST be named by its heading to assistive technology, the type's group "Follows each Job posting"

#### Scenario: A very long value

- **WHEN** the menu lists a description of 6,000 characters
- **THEN** that entry's accessible name MUST be at most its label and 150 characters of the value with an ellipsis, and its hover text MUST hold the whole value

### Requirement: A link menu has room for its entries

A menu MUST never move its filter while it is open: below its field it MUST
grow with what it lists, up to the room there; above its field, or opened by
a key, it MUST keep the height it opened with. It MUST list at least three
entries, or all of them, when the frame has room, and MUST end above the
action bar while the bar shows, in a short frame too. Its keyboard hints MUST
show in every menu, except in a frame up to 420 px tall and at 200 % zoom.

#### Scenario: A menu above its field

- **WHEN** an editor opens the source menu of Status, low on "Every Event"'s Schema tab in a window 1440 × 900 or 1440 × 600
- **THEN** the menu MUST show every entry that fits and the row of those that do not, whole

#### Scenario: Opening again after Escape

- **WHEN** an editor presses Enter on a source control, Escape, Enter again, then Down and a letter
- **THEN** the menu's filter MUST have focus and hold the letter, and the field MUST keep its value

### Requirement: Template values in hand-added items can be linked

On a content template, each value in a hand-added item MUST offer a source
control, a read-out while it follows a field, and a source menu of the type's
fields with the previewed item's values, and the sheet MUST say which item it
previews ("In search results, for ‹title›" and the source menu's "For
‹title›"). A typed name, headline, date, price or image MUST say "The same
‹label› on every ‹Type›. Link it to a field instead." with "Link it" when the
type has a field of a fitting kind. Verdicts MUST be the previewed item's.

#### Scenario: No fitting field

- **WHEN** a hand-added review on the Product template has a typed rating value, and the only number field is Price
- **THEN** no "Link it" advice MUST be shown, and the source menu MUST list Price under "Follows each Product" in the same menu, never in a submenu

#### Scenario: Linking a score

- **WHEN** an editor links Rating value to the Score field on the Book review template
- **THEN** the source control MUST read "Score" over the previewed review's value, and the JSON MUST hold `"{field.field_score}"`

#### Scenario: Linking a text field to an author

- **WHEN** an editor links Author's name to the Byline text field
- **THEN** the JSON MUST hold `{"@type": "Person", "name": "{field.field_byline}"}` and the row MUST say "Linked as a person's name"

#### Scenario: A name inside text

- **WHEN** a value is `By {field.field_byline}`
- **THEN** the sheet MUST say "This name is only filled when it is the whole value." in amber

## REMOVED Requirements

### Requirement: Each field shows what it inherits

**Reason**: The source no longer shows in gray or on hover. "Every field says
where its value comes from, at rest", "A value kept here is named by its
scope", "A fact is named for its item", "Wider sources are named by what
they follow", "A box means you type here", "A read-out of text turns into
its box on a click" and "Other read-outs open the source menu" replace it.
The aside's Edit moves to the source menu's footer ("Edit in Site").

**Migration**: None. Nothing stored changes. The scenario "Edit the site
default" becomes the footer of a source menu that lists a site row ("A
source menu leads to Site").

### Requirement: Reset and Undo

**Reason**: Reset is replaced by the default row in the source menu and by
Delete on the source control ("Going back is a row, a key and Undo"). Undo
stays in the action bar for every change of source, fixes and restored
changes.

**Migration**: None. Tests that press Reset pick the default row instead.

### Requirement: Reset of the title says what it clears

**Reason**: There is no Reset. The ending is its own field ("The title ending
is its own field"), so going back on the title never touches it, and going
back is said in the status ("Title is back to Event's title.").

**Migration**: None.

### Requirement: A detail a field fills is a box that opens the link menu

**Reason**: A detail that is not set and cannot be typed is now its label row
with "Not set", not a box reading "Link a field…" with a second link icon.
"A detail only a field fills is a row that opens the source menu" replaces
it.

**Migration**: None.
