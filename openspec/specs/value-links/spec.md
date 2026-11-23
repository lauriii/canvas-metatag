# value-links Specification

## Purpose
Let a site builder link a value in the SEO dialog to where it comes from, see at
a glance which source each linked value follows and what it gives for the
previewed item, and go back to typed text, by mouse, keyboard and assistive
technology.

## Requirements

### Requirement: Where values can be linked

At template scope, every value field MUST offer linking: the title's main part
and ending, the description, the social title, description and image, and each
structured data detail, a choice of options included. At page scope only
structured data details of kind address, date and image MAY offer it, to the
page's facts of that kind, when a fact other than the detail's default is
offered. Site settings, and a page's title, description and social texts, MUST
NOT offer it.

#### Scenario: A template's description

- **WHEN** an editor opens the Search tab of "Every Article", which sets no description
- **THEN** the Description field MUST have a link button by its label, named "Change the link for Description" while it follows its default

#### Scenario: A page's date detail

- **WHEN** an editor opens the Schema tab of an Article page
- **THEN** the date details MUST offer linking to "First published" and "Last updated", and the page's title and description MUST NOT offer linking

#### Scenario: A page's image detail

- **WHEN** an editor opens the Schema tab of an Article page, whose Image detail follows the page's Image, its only image fact
- **THEN** the Image detail MUST NOT offer linking

#### Scenario: Site settings

- **WHEN** an administrator opens Site
- **THEN** no field MUST offer linking

### Requirement: The link control sits by the label

A field that offers linking MUST show a link button right after its label,
named "Link ‹Field› to a field" while the value is typed or empty, "Change the
link for ‹Field›" while a box shows it linked or following its default, and
"Add a field to ‹Field›", with a plus, in a composer that holds anything. The
name MUST follow the value alone, never where a caret was. Its tooltip MUST
start with that name, then say the state. It MUST open the field's link menu.

#### Scenario: A broken link's button

- **WHEN** the description of "Every Article" links to a field that was deleted
- **THEN** the button by its label MUST be red with a broken link's icon, where a working link's is gray

#### Scenario: A linked description

- **WHEN** the description of "Every Article" is linked to Summary
- **THEN** the button by its label MUST be named "Change the link for Description" and its tooltip MUST say "Linked to Summary"

#### Scenario: Unlinked to an empty input

- **WHEN** an editor unlinks the description and the empty input has focus
- **THEN** the button by its label MUST be named "Link Description to a field"

#### Scenario: A composed title

- **WHEN** "Every Event"'s title is Title, " in ", Venue › City
- **THEN** the button by its label MUST be named "Add a field to Title", show a plus, and its tooltip MUST say "Made of Title, “in”, Venue › City"

#### Scenario: Typed text on a template

- **WHEN** "Every Article"'s description is the typed text "Summer offers" and an editor clicks the button by its label
- **THEN** the button MUST be named "Add a field to Description", and its menu MUST offer "Replace the text with a field"

### Requirement: A field with a box is one Tab stop

While a box shows a value, the link button by its label MUST stay out of the
Tab order: the box, which opens the same menu, is the field's one stop. The
button MUST still open the menu on a click. A composer MUST be one stop and its
link button another, as a typed input and its button are.

#### Scenario: Tabbing through a template's Schema tab

- **WHEN** an editor tabs through "Every Event"'s Schema tab, whose details are linked
- **THEN** each linked detail MUST take one Tab for its box and one for its ×, and none for its link button

#### Scenario: Tabbing through a composed title

- **WHEN** an editor tabs into "Every Event"'s composed title
- **THEN** the link button, the composer and the ending's button MUST each take one Tab, in that order

### Requirement: A linked value is shown as a box

A linked value, and a value that follows its default where linking is offered,
MUST replace the input with a box that names its source and shows the previewed
item's value, with an × to unlink instead of a Reset. A default MUST be
tagged "Default", with its source after it when that is not the field. The box
MUST be a combobox named for the field, its value what it shows (as a select's
trigger is), described first by a sentence that says the source and the item's
value.

#### Scenario: Linked to Summary

- **WHEN** "Every Article"'s description is linked to Summary and the previewed article's summary is "How teams turn output into stories."
- **THEN** a combobox named "Description" MUST show "Summary" and that text, and its description MUST start with "Linked to Article › Summary. This article: How teams turn output into stories."

#### Scenario: A linked date, at rest

- **WHEN** "Every Event"'s Starts detail is linked to the Starts field and the previewed event starts on 20 June 2026 at 19:00
- **THEN** the box MUST show "Starts" and that date and time formatted in the dialog's language, without focusing or opening anything, and the value MUST NOT move or fold away when focus leaves the box

#### Scenario: A linked list field

- **WHEN** a detail is linked to Event status and the previewed event's status is stored as `EventScheduled` with the label "On as planned"
- **THEN** the box and its link menu entry MUST show "On as planned", not `EventScheduled`

#### Scenario: Following the default

- **WHEN** "Every Article" sets no description
- **THEN** the box MUST be tagged "Default", with the previewed article's description, in the look of a default and without the link icon, and described "Follows the default: each article's description."

#### Scenario: A page's date detail

- **WHEN** an Article page sets no Published date
- **THEN** the detail MUST show a box tagged "Default · First published" with the page's first publication date

#### Scenario: A value that ends with a full stop

- **WHEN** the previewed article's summary is "Why it matters."
- **THEN** the box's description MUST end with "This article: Why it matters." and one full stop

### Requirement: A box looks like an input, its tag says the link

A box MUST be drawn as an input: the input's fill and border, the input's
focus ring and a darker border on hover. Only its tag MUST have colour: the
link's for a link, gray for a default, red for a broken link, whose border is
red too.

#### Scenario: A template's Schema tab at rest

- **WHEN** an editor opens "Every Event"'s Schema tab, whose details are linked
- **THEN** each box MUST have the fill and border of the inputs beside it, and only its tag MUST be blue

### Requirement: An image row names its link as a box does

An image that is linked, or that follows a default at template scope, MUST
show the box's tag (its link, or "Default · ‹Source›") above the image's name
and size, and the state words of a link that gives nothing under the tag. A
linked image MUST unlink with an ×, not Reset.

#### Scenario: The social image linked to the Image field

- **WHEN** "Every Article"'s social image is linked to its Image field
- **THEN** the image row MUST show the tag "Image" with the link's icon over the image's alternative text and size, and an "Unlink image" button

### Requirement: A box keeps one layout per kind of field

A one-line value (a title) MUST show its source before its value on one line,
one control high, its source never squeezed by a long value; any other value
MUST show its source over its value, never shorter than the input it turns
into. Beside another detail neither line MUST wrap or move with focus: the path
MUST give way from its start, so that the field it ends at stays in sight, and
the value MUST be cut at its end, with the whole path and value in its
description and tooltip.

#### Scenario: Linked a pair of details

- **WHEN** "Every Event"'s Venue and Street address, side by side, are linked to Venue › Title and Venue › Street address
- **THEN** each box MUST show its path over its value, the path giving way from its start so that "City" or "Street address" stays, the value cut at its end, and focusing a box MUST NOT change its height

#### Scenario: A long title at rest

- **WHEN** "Every Article"'s title follows its default and the previewed article's title is longer than the box
- **THEN** the box MUST show the whole tag "Default" and cut only the title

### Requirement: Every link state is said in words

A box, and an image row under its tag, MUST say when the source is empty for
the previewed item ("Empty for this ‹type›"), hidden from visitors ("Hidden
from visitors", through a reference "… for this ‹type›"), broken (with the
field's machine name: "No longer exists", "No longer gives text", "Can no
longer be read"), or when the type has no item to preview ("No ‹type› to
preview"). Under the field, the dialog MUST say once what is used instead.

#### Scenario: Empty for this article

- **WHEN** the description is linked to Summary and the previewed article has no summary
- **THEN** the box MUST say "Empty for this article", and the field MUST say "This article has no Summary, so its Body summary, else the start of its Body is used."

#### Scenario: Broken

- **WHEN** the description is linked to `field_summary` and that field was deleted
- **THEN** the box MUST show `field_summary` and "No longer exists" with a visible ×, and the field MUST say "field_summary no longer exists, so each article uses its default description.", with "Link another field"

#### Scenario: A field that changed its type

- **WHEN** the description is linked to QA note and that field became a number
- **THEN** the box MUST say "No longer gives text", not "No longer exists"

#### Scenario: Nothing to preview

- **WHEN** the Article type has no article yet
- **THEN** each box, the social description's included, MUST say "No article to preview"

#### Scenario: An image hidden for this item

- **WHEN** "Every Event"'s social image is linked to Poster › Image and the previewed event's poster is unpublished
- **THEN** the image row MUST show the tag "Poster › Image" over "Hidden from visitors for this event", the field MUST say what is used instead ("So the site default image is used."), and the Schema tab's image detail MUST show the same tag and words

#### Scenario: A detail through a hidden reference

- **WHEN** "Every Event"'s Street address is linked to Venue › Street address and the previewed event's venue is unpublished
- **THEN** the box MUST say "Hidden from visitors for this event", and the field MUST say "So the detail is left out."

### Requirement: The link menu offers what fits the field

The link menu MUST be a dialog named "Link ‹Field›" with a "Find a field"
filter that matches labels, paths and values, ignoring case and accents, best
match first. Each entry MUST show its label and the previewed item's value. The
entries that fit MUST come first; the others MUST wait in one quiet row at the
end that opens them disabled with a reason, such as "An image, not text". The
current entry MUST be marked. "No field matches" MUST be announced.

#### Scenario: Finding Summary

- **WHEN** an editor opens the description's link menu and types "summ"
- **THEN** the Summary entry MUST be listed with the previewed article's summary as its value

#### Scenario: An image in a text menu

- **WHEN** the title's link menu is opened on a type with an image field
- **THEN** the image field MUST NOT be among the entries at the top, and opening the last row, "N fields that can't be linked here" or "N fields that aren't text", MUST list it disabled with the reason "An image, not text"

#### Scenario: A reference with nothing that fits

- **WHEN** the description's link menu is opened on a type whose Image reference offers only a file size
- **THEN** no "Image" level MUST be listed

#### Scenario: The best match first

- **WHEN** an editor types "summ" in the description's link menu on a type with Summary, Body › Summary and a Body that mentions summaries
- **THEN** Summary MUST be the first entry and active, then Body › Summary, then Body

#### Scenario: Choosing between two dates

- **WHEN** an editor opens the link menu of "Every Event"'s Starts detail
- **THEN** the Starts and Ends entries MUST each show the previewed event's date and time, so they can be told apart before one is picked

#### Scenario: Nothing found

- **WHEN** the filter matches nothing
- **THEN** the menu MUST say "No field matches “‹filter›”.", in a polite live region

### Requirement: A choice detail fits only a list field

The link menu of a choice detail MUST offer only a list field whose value is
one of the detail's options; every other entry, whatever its kind, MUST wait
in the last row with the one reason "Not one of the options".

#### Scenario: A choice of options

- **WHEN** an editor opens the link menu of "Every Event"'s Status
- **THEN** Status MUST be the only entry that fits, and the type's text fields and its dates MUST wait in the last row with the reason "Not one of the options"

### Requirement: The link menu lists the type's own fields first and tells its entries apart

Among the entries that fit, the type's own fields MUST come before a part of
one ("Image › Alternative text") and before the references to open, each in
the order of the form. A fact that gives the same as a field listed above it
MUST say what it is instead of its value.

#### Scenario: The type's own fields first

- **WHEN** an editor opens the title's link menu on a type whose Image field offers its alternative text and title, and that has Summary and Byline
- **THEN** Summary and Byline MUST be listed before "Image › Alternative text"

#### Scenario: Two entries that give the same image

- **WHEN** the template's image menu lists the Article's Image field and the Page's Image fact, which give the same image
- **THEN** the fact MUST say "The first image it has" under its label

### Requirement: What fits comes first, in levels and filters too

The entries of a level that do not fit MUST wait in the menu's last row too, so
that a level lists and counts only what fits. A filter MUST list what fits
first, and the referenced item's name first for a filter that matches the
reference.

#### Scenario: A level and what does not fit in it

- **WHEN** the social image's menu is opened on "Every Event", whose Poster offers one image and several texts
- **THEN** the Poster level MUST say "1 field" and list only that image, and the texts MUST wait in the last row

#### Scenario: Finding a reference by its name

- **WHEN** an editor types "Perfo" in the description's link menu of "Every Event"
- **THEN** Performers › Title MUST be the first entry, and entries that cannot be linked MUST come after every one that can

### Requirement: Hidden entries in the link menu

A field visitors may never view MUST be disabled with "Hidden from visitors".
An entry through a reference that visitors may not view for the previewed
item only MUST stay pickable, saying "Hidden from visitors for this ‹type›":
other items give it.

#### Scenario: A reference hidden for this item

- **WHEN** an editor opens the Venue level of the description's menu while previewing an event whose venue is unpublished
- **THEN** its entries MUST be pickable and say "Hidden from visitors for this event"

### Requirement: A reference opens as a level in the link menu

Entries that go through the same reference MUST be grouped under that
reference as a level. Opening a level MUST replace the list in place, with a
"Back to ‹Type›" entry, which stays in sight as the level scrolls, and the
reference's label as a heading. A filter match
inside a level MUST be listed at the top level with its path, and MUST be
linkable from there.

#### Scenario: Writer › Title

- **WHEN** an editor opens the author name's link menu, moves to "Writer" and presses the right arrow
- **THEN** the menu MUST show a heading "Writer", a "Back to Article" entry and the writer's fields, and Enter on "Title" MUST link the detail to Writer › Title

#### Scenario: Venue › Street

- **WHEN** an editor opens the link menu of Street address on "Every Event", whose Venue references venues with a Street field
- **THEN** the menu MUST offer a "Venue" level with Street address and the previewed event's venue street as its value, and Enter on it MUST link Street address to Venue › Street address

#### Scenario: A deep match

- **WHEN** an editor types "writer" in the filter
- **THEN** "Writer › Title" MUST be listed at the top level and MUST be linkable without opening the level

### Requirement: Picking an entry links the value at once

Picking an entry MUST store it in the draft at once, show its value straight
away, close the menu and return focus to the box (for an image, to its link
button), or, for a field added to or replacing one in a composer, to the
composer with the caret right after that field. The dialog MUST announce
"‹Field› linked to ‹Source›." for a whole value and "‹Source› added to
‹Field›." for an added field, and the action bar MUST say "Linked to ‹Source›"
or "Added ‹Source›" with Undo.

#### Scenario: Linking the description

- **WHEN** an editor picks Summary in the description's link menu
- **THEN** the template's draft MUST hold the link, the box MUST show the summary, and Undo in the bar MUST restore the previous value

#### Scenario: Adding a field

- **WHEN** an editor with the caret after "Summer Gala in " in "Every Event"'s title picks Venue › City in "Add a field to Title"
- **THEN** the draft MUST hold the composition, the caret MUST be right after Venue › City, and the dialog MUST announce "Venue › City added to Title."

### Requirement: Unlinking starts with an empty input

The ×, Backspace or Delete on a box, or Unlink in the menu, MUST replace the box
at once with an empty input of the value's kind that has focus; it MUST NOT
copy the item's value into it. A printable key on a box MUST replace it with an
input holding that key where that input is text, and else open the menu with
the key in its filter. Unlinking MUST offer Undo. Leaving the input empty MUST
bring back the default box.

#### Scenario: Backspace on a linked box

- **WHEN** an editor presses Backspace on the description's box linked to Summary
- **THEN** an empty textbox "Description" MUST have focus, the dialog MUST announce "Description unlinked.", and Undo MUST restore the link

#### Scenario: Unlinking a date detail

- **WHEN** an editor unlinks a structured data date detail
- **THEN** the detail MUST become the date input of its kind, empty

#### Scenario: A key on a date box

- **WHEN** an editor presses "2" on a page's Published box
- **THEN** the link menu MUST open with "2" in its filter, and nothing MUST be written

#### Scenario: Typing right after unlinking

- **WHEN** an editor presses Delete on Street address's box and at once types "Main street 1"
- **THEN** Street address MUST read "Main street 1"

### Requirement: The title ending has its own menu

The ending's menu MUST be a dialog named "Title ending" with the filter "Type
an ending", at template scope "Type an ending or find a field". It MUST offer
the current ending, the Site name as the site default, "No ending", at template
scope the type's text fields in the link menu's levels, and last, for a typed
filter, "Use “‹filter›” as the ending". Outside Site its footer MUST say where
the separator is set and offer Edit to administrators.

#### Scenario: Typing an ending

- **WHEN** an editor types "Blog" in the ending's menu and presses Enter on "Use “Blog” as the ending"
- **THEN** the ending MUST be "Blog", and the search preview's title MUST end with "| Blog"

#### Scenario: No ending

- **WHEN** an editor picks "No ending"
- **THEN** the title MUST have no separator and no ending

#### Scenario: Filtering for an option

- **WHEN** an editor types "no end" in the ending's menu
- **THEN** "No ending" MUST be listed above "Use “no end” as the ending"

### Requirement: The ending's button shows what the item gets

An ending linked to a field that gives nothing for the previewed item MUST
show the ending the site gives, as the head does (dynamic-values), with the
link's icon, and its description MUST say that it is linked, what the field
gives for the item and that the site ending is used.

#### Scenario: An empty linked ending

- **WHEN** the site sets "No ending" and "Every Event" links its ending to a field that the previewed event has empty
- **THEN** the button MUST be named "Title ending: No ending", show the link's icon, and be described "Linked to ‹Field›, empty for this event, so the title has no ending."

### Requirement: An image can follow each item's image field

At template scope, the Choose image sheet MUST offer "From each ‹Type›": the
type's image fields, each with the previewed item's image. Picking one MUST
link the image. Picking an image from the library MUST store that media item.
The image's link menu MUST end with "Choose from the media library…"; leaving
the sheet from there MUST return focus to the field.

#### Scenario: Linking the social image to Hero

- **WHEN** an editor picks Hero under "From each Article" in Choose image
- **THEN** the social image MUST be linked to Hero, and the image row MUST name the link and show the previewed article's hero image and its size

### Requirement: A read-only target shows links without changing them

When the target is read-only, a box MUST have no ×, and its menu MUST open with
every entry disabled. The box MUST stay focusable and say its source and value.

#### Scenario: A conflict

- **WHEN** the target became read-only after a conflict
- **THEN** pressing Enter on the description's box MUST open its menu with every entry disabled, and nothing MUST be written

### Requirement: Linking works by keyboard

Enter, Space and Alt+Down on a box or link button MUST open its menu with the
current entry active, inside its level. Alt+Down, or `{` in an empty input,
MUST open the menu from a typed input; `{` in a non-empty input MUST be typed.
In a composer, Alt+Down, `{` and Enter MUST open the menu at the caret. In the
menu, Up, Down, Home and End MUST move, Enter MUST link, and Escape MUST close
it and return focus to its opener at once, a composer with the caret or
selection it had.

#### Scenario: Linking by keyboard

- **WHEN** an editor focuses an empty template description, types `{`, then "summ" and Enter
- **THEN** the description MUST be linked to Summary and the box MUST have focus

#### Scenario: A brace in text

- **WHEN** an editor types `{` after other text in a page's typed input
- **THEN** the brace MUST be typed, and no menu MUST open

#### Scenario: The current entry in a level

- **WHEN** an editor presses Enter on Street address, linked to Venue › Street address
- **THEN** the menu MUST open in the Venue level with Street address active

#### Scenario: A key right after Escape

- **WHEN** an editor opens the description's menu from its box, presses Escape and at once Backspace
- **THEN** the description MUST be unlinked, an empty input with focus

#### Scenario: A key right after a pick

- **WHEN** an editor focuses an empty template description, types `{`, "summ", Enter and then "x"
- **THEN** the description MUST hold the typed text "x", as a key on any box replaces it, and Undo MUST restore the link

### Requirement: A list fact links every item

The link menu of a list of text MUST start with a "Suggested" group of
multi-value fields whose label matches the fact. A multi-value field MUST be
noted "All ‹n›, in order", one long text "Each list item, in order", and a
single short value, field or fact, MUST be disabled with "One value, not a
list". A list of codes MUST take only list fields of codes. Outside text, a
multi-value field MUST keep "First of ‹n›" on other facts; where a place
composes, the menu MUST show its joined items.

#### Scenario: A list of codes

- **WHEN** a builder opens the Employment type link menu on a job type with a single-value and a multi-value list field of codes and a formatted Description field
- **THEN** both list fields MUST be offered, and the Description's items MUST NOT be

#### Scenario: Ingredients

- **WHEN** a builder opens the Ingredients link menu on a Recipe type with a multi-value Ingredients field and a formatted Method field
- **THEN** Ingredients MUST be first, under "Suggested", noted "All 8, in order", and Method MUST be noted "Each list item, in order"

#### Scenario: A summary on a list fact

- **WHEN** the type has a one-line Summary field
- **THEN** it MUST be listed disabled with "One value, not a list", and so MUST the page title

#### Scenario: One employment type per job

- **WHEN** a job type has a single-value Employment list field holding PART_TIME
- **THEN** Employment type MUST link to it, and a job holding PART_TIME MUST emit `employmentType` `PART_TIME`

### Requirement: A linked group box only opens its sheet

A group box, linked or not, MUST open its sheet on click, Enter, Space or
Alt+↓. Backspace, Delete and printable keys MUST do nothing on it.

#### Scenario: Backspace on a linked venue

- **WHEN** focus is on the linked Venue box and the builder presses Backspace
- **THEN** every part MUST stay linked

### Requirement: The publisher is answered once per type

The publisher MUST be offered before any field: in a reference's link menu
as its own "This site" group, first, and in the choice of who as "‹Site›
(this site)". On a template, an organizer, employer or author that nobody
has set MUST read "Not set", with what it is needed for, until the builder
answers it.

#### Scenario: A new job type

- **WHEN** a builder sets up Every Job and has not chosen an employer
- **THEN** the Employer field MUST read "Not set" with "Needed for job listings", and its choices MUST be "Not set", "Example Studio (this site)" and "Someone else"

### Requirement: A linked duration says its unit

Linking a duration to a number field MUST ask what the field counts
(minutes or hours for recipes), with the first choice preselected, in one
question beside the linked box, and store the answer with the link.

#### Scenario: Cook time in hours

- **WHEN** a builder links Cook time to "Cook hours" and answers hours, and a recipe holds 1.5
- **THEN** its `cookTime` MUST be `PT1H30M`

### Requirement: Text on a template is a composer unless it is one field

At template scope, a value that can be composed MUST show the Default box while
nothing is set and the box while it links one field or fact, as linked values
do everywhere. While it holds typed text or more than one field, or is empty
with focus, it MUST be a composer that holds typed text and fields, each named
as the link menu names it. While it has focus, a composer MUST stay a composer.
Everywhere else the input or box MUST stay.

#### Scenario: Typing over the default

- **WHEN** "Every Article" sets no description and an editor tabs to its Default box and types "A"
- **THEN** the description MUST be a composer holding the typed text "A"

#### Scenario: A click on a linked box

- **WHEN** "Every Article"'s description is linked to Summary and an editor clicks its value, or the empty space after its tag
- **THEN** the menu "Link Description" MUST open, and no caret MUST be placed

#### Scenario: A page

- **WHEN** an editor opens a page's Search tab
- **THEN** the title and description MUST be typed inputs, with no composer

### Requirement: A composer shows the item's result

A composer that holds a field MUST show the previewed item's whole result on a
line inside its border, under its fields and text, not editable; a title's
result MUST leave out the ending its button already shows. A click on that line
MUST put the caret at the end. Fields left out for the item MUST be named in a
quiet note on a line of its own after the result, never cut with it:
"‹Source› left out for this ‹type›", as at rest.

#### Scenario: A composed title at rest

- **WHEN** "Every Event"'s title is Title, " in ", Venue › City, " · ", Starts, and the editor previews "Summer Gala"
- **THEN** the Title field MUST show the fields Title, Venue › City and Starts with the typed " in " and " · " between them, and on the line under them "Summer Gala in Helsinki · 20 June 2026"

#### Scenario: A city the event lacks

- **WHEN** the previewed event has no city and the title is Title, " in ", Venue › City, " · ", Starts
- **THEN** the result line MUST read "Summer Gala · 20 June 2026" with the note "Venue › City left out for this event"

### Requirement: Beside a preview, a composer at rest says only what is left out

Where a preview on screen shows the same result (the Search and Social tabs),
a composer's result line MUST show only while the composer or its menu is in
use and says more than its chip (typed words, or a second field); otherwise
it MUST keep only the fields left out for the item, "‹Source› left out for
this ‹type›", and nothing when none is. A detail, which has no preview, MUST
keep its result line at rest.

#### Scenario: The composed title at rest

- **WHEN** the previewed event has no city, the title is Title, " in ", Venue › City, and focus is elsewhere on the Search tab
- **THEN** the title's line MUST read "Venue › City left out for this event", and the search preview MUST show the result

### Requirement: Composing starts from a box

In a place that can be composed, Arrow right or End on a box, or "Add words or
fields" at the top of its menu, which stays under the filter and in sight
however far below the current entry is, MUST turn it into a composer holding its field,
or the default's fact as a real field, with the caret after it. `{` on such a
box MUST do the same and open "Add a field to ‹Field›" at the caret. Leaving
the composer before anything is added MUST show the box again and store
nothing new.

#### Scenario: The brace is said

- **WHEN** an editor focuses the box of a detail that can be composed, where no other guidance shows
- **THEN** the guidance MUST say "Type { to add a field"

#### Scenario: Starting from the default

- **WHEN** an editor tabs to "Every Event"'s untouched title, presses End, types " in ", then `{`, "city" and Enter
- **THEN** the title MUST be Title, " in ", Venue › City, with the caret after Venue › City

#### Scenario: Starting from a linked description

- **WHEN** an editor tabs to the description linked to Summary, presses the right arrow and types " Free delivery."
- **THEN** the description MUST be Summary followed by " Free delivery."

#### Scenario: From the menu

- **WHEN** an editor clicks the description linked to Summary
- **THEN** the menu MUST offer "Add words or fields" with "Keep Summary and add to it", and picking it MUST give a composer holding Summary, with the caret after it

#### Scenario: From the Default box's menu

- **WHEN** an editor opens the menu of "Every Event"'s untouched title
- **THEN** it MUST offer "Add words or fields" with "Keep the default and add to it" (never "Start from Title" on Title), in sight as the menu opens

#### Scenario: A default named like its field

- **WHEN** an editor opens the menu of "Every Event"'s untouched description, whose default is the Description fact
- **THEN** it MUST offer "Add words or fields" with "Keep the default and add to it"

#### Scenario: Nothing added

- **WHEN** an editor presses End on the untouched title and then Tab
- **THEN** the title MUST show its Default box again, the draft MUST NOT hold a title, and focus MUST be on the ending's button, where Tab sent it

### Requirement: Fields are added at the caret

In a composer that holds anything, Alt+Down, `{` or Enter, or the link button,
MUST open "Add a field to ‹Field›", which puts the pick at the caret, or for
the button at the last caret, else at the end. Its header MUST say where and its
hints MUST say "↵ add". An empty composer MUST open "Link ‹Field›". `{`, typed
with whatever keys the keyboard layout needs (Shift, Option, AltGr), MUST NOT
be typed; `{` in the empty filter MUST close the menu and type one. Escape MUST
type nothing.

#### Scenario: Composing a title by keyboard

- **WHEN** an editor in "Every Event"'s title holding "Tickets: " types `{`, "titl", Enter, " in ", `{`, "city", Enter
- **THEN** the title MUST be "Tickets: ", Title, " in ", Venue › City, with the caret after Venue › City

#### Scenario: Where the field goes

- **WHEN** an editor opens "Add a field to Title" with the caret after "Summer Gala in"
- **THEN** the menu's header MUST say "After “Summer Gala in”", in a frame 420 px tall too

#### Scenario: A brace

- **WHEN** an editor types `{` twice in a composer
- **THEN** one `{` MUST be typed at the caret, and no menu MUST stay open

#### Scenario: Escape after a brace

- **WHEN** an editor types `{`, Escape and "x" in an empty composer
- **THEN** the field MUST read "x"

#### Scenario: The eighth field

- **WHEN** a composer holds eight fields and the editor opens its menu
- **THEN** the menu MUST say "At most 8 fields in one value." and no entry MUST be pickable, except to replace a selected field

### Requirement: The empty-field rule is said while a value takes its first fields

While the value holds at most one field, "Add a field to ‹Field›" MUST state
the empty-field rule in its footer, except in a frame 420 px tall or less,
where the entries keep the room. From the second field on, the tint and the
"Without" line show the rule, and the footer MUST be gone.

#### Scenario: The rule said once

- **WHEN** an editor opens "Add a field to Title" on a title that holds only Title
- **THEN** its footer MUST say "When an item doesn't have a field, the words joining it are left out too.", and once the title holds two fields the footer MUST be gone

### Requirement: An old token typed from memory finds its field

A trailing `}` in the link menu's filter MUST be ignored when matching, and
MUST NOT close the menu.

#### Scenario: Typing an old token

- **WHEN** an editor types `{title}` in a composer that holds text, and Enter
- **THEN** Title MUST be added at the caret, and no brace MUST be typed

### Requirement: A field in a composer moves and goes as one

The caret MUST step over a field with one arrow press, Shift with an arrow MUST
select it whole, and no selection MUST end inside one. Backspace or Delete
beside a field MUST remove it whole and announce "‹Source› removed from
‹Field›."; "‹Field› unlinked." MUST be announced only when the value becomes
empty. A click on a field, or Enter with it selected, MUST open "Replace
‹Source›" with "↵ replace" in its hints and "Remove ‹Source›" as its first
row, under the filter.

#### Scenario: Stepping over a field

- **WHEN** the caret is before Venue › City and the editor presses the right arrow once
- **THEN** the caret MUST be right after Venue › City

#### Scenario: Removing a field

- **WHEN** the caret is right after Venue › City and the editor presses Backspace
- **THEN** Venue › City MUST be gone, the typed text MUST stay, and the dialog MUST announce "Venue › City removed from Title."

#### Scenario: Replacing a field

- **WHEN** an editor clicks Venue › City in the title and picks Venue › Title in "Replace Venue › City"
- **THEN** Venue › Title MUST take its place, the words around it MUST stay, and the dialog MUST announce "Venue › City replaced by Venue › Title."

### Requirement: Focus enters a composer at its end

Tab into a composer, a click on the preview and a jump from Checks MUST put the
caret at the composer's end. A jump to one field MUST select it and open its
menu.

#### Scenario: Tabbing into a composition

- **WHEN** an editor tabs into "Every Event"'s composed title and types `{`
- **THEN** "Add a field to Title" MUST open with its header saying the field goes after the last part

### Requirement: Typing beside a field adds text

Typing in a composer MUST add text at the caret and MUST NOT remove a field
unless it is selected. Typed or pasted line breaks MUST become one space, and
stored line breaks MUST show as spaces without being rewritten until edited.
Pasted text MUST be plain, braces literal.

#### Scenario: Pasting a brace pattern

- **WHEN** an editor pastes `{title} in {city}` into a composer
- **THEN** it MUST be typed text, and no field MUST be added

#### Scenario: A pasted line break

- **WHEN** an editor pastes "Summer\nGala" into a composer
- **THEN** it MUST read "Summer Gala"

### Requirement: Copying keeps the fields a target can take

A copy inside the dialog MUST keep the fields the target can take, and leave
out, with their words and a message, those it can't; the message MUST be
announced and shown under the field until focus leaves it. A field MUST never
be pasted as its label. A paste on a box that can be composed MUST replace it,
as a typed key does. The plain text of any copy MUST be the previewed item's
result for the selection.

#### Scenario: Copying a composition

- **WHEN** an editor copies the composed title and pastes it into the social title of the same template
- **THEN** the social title MUST hold the same fields and text

#### Scenario: Pasting a field another type doesn't have

- **WHEN** an editor copies Title, " in ", Venue › City from "Every Event" and pastes it into "Every Article"'s description
- **THEN** the description MUST hold Title only, and the dialog MUST say "Venue › City isn't available here, so it was left out."

#### Scenario: Copying out of the dialog

- **WHEN** an editor copies the composed title and pastes it into a document outside the dialog
- **THEN** the document MUST receive "Summer Gala in Helsinki · 20 June 2026"

### Requirement: Undo in a composer never outlives the draft

Undo in the composer MUST restore typing and added, replaced and removed
fields. A change from outside the composer, such as Undo in the action bar,
Reset or a fix from Checks, MUST replace its content and clear its undo
history.

#### Scenario: Undo after removing a field

- **WHEN** an editor removes Venue › City with Backspace and presses Ctrl+Z
- **THEN** Venue › City MUST be back where it was, in the composer and in the draft

#### Scenario: Undo in the bar, then in the composer

- **WHEN** an editor adds Venue › City, presses Undo in the action bar, and then Ctrl+Z in the composer
- **THEN** the composer MUST show the value without Venue › City, and Ctrl+Z MUST NOT bring back a value the draft no longer holds

### Requirement: Each field in a composer says its state in words

A field in a composer MUST say in words, never by colour alone, in the
composer's description and its own tooltip, when it is empty or hidden for the
previewed item, or broken. An empty or hidden field MUST look muted with a
dashed outline, and a broken one MUST be red with its machine name. Without an
item to preview, fields MUST NOT be called empty.

#### Scenario: An empty field

- **WHEN** the previewed event has no city and the title is Title, " in ", Venue › City
- **THEN** Venue › City MUST look muted, and its tooltip MUST say "Empty for this event"

#### Scenario: A deleted field

- **WHEN** `field_city` was deleted
- **THEN** the field in the composer MUST show `field_city` in red

#### Scenario: Nothing to preview

- **WHEN** the Event type has no event yet
- **THEN** the composer's result MUST say "No event to preview", and no field MUST say it is empty

### Requirement: A field keeps its ring while its menu is open

A field whose "Replace ‹Source›" menu is open MUST keep its ring, whether a
click or a key opened it, and Escape MUST leave it selected, so that Enter
opens its menu again.

#### Scenario: A click, then Escape

- **WHEN** an editor clicks Venue › City in the composed title, then presses Escape
- **THEN** Venue › City MUST show its ring while the menu is open and stay selected after, and Enter MUST open "Replace Venue › City"

### Requirement: A field's tooltip says what the item gets without it

While the composition holds another field, a field's tooltip MUST also say
what the item gets without it, "Without ‹Source›: …"; a field that gives
nothing for the item MUST say its state only, as the result already goes
without it. The words that go with such a field MUST be drawn muted, as a
separator left at the end is. A field selected whole
MUST show a ring, so that what Backspace, Enter or a key acts on is seen.

#### Scenario: Hovering the city

- **WHEN** an editor hovers Venue › City in Title, " in ", Venue › City, " · ", Starts
- **THEN** its tooltip MUST say "Helsinki" and "Without Venue › City: Summer Gala · 20 June 2026"

#### Scenario: Selecting a field whole

- **WHEN** an editor selects Venue › City whole with Shift and an arrow
- **THEN** Venue › City MUST show a ring

### Requirement: The guidance under a composer keeps its length

The guidance under a composer MUST say what is left out only when every field
is empty or a field is broken, and MUST still give the length guidance. A field
only empty or hidden for the item MUST be said in the result line, the field
and the description, never in the guidance.

#### Scenario: One empty field

- **WHEN** an editor focuses a composed title whose City is empty for the previewed event and which may be cut off
- **THEN** the guidance MUST give the length guidance, and MUST NOT speak of the city

#### Scenario: A deleted field in the guidance

- **WHEN** `field_city` was deleted
- **THEN** the guidance MUST say "field_city no longer exists, so it is left out of every event's title.", with "Replace field"

#### Scenario: Every field empty

- **WHEN** the previewed event has neither a city nor a start date and the title is Venue › City, " · ", Starts
- **THEN** the guidance MUST say "Venue › City and Starts are empty for this event, so its default title is used."

### Requirement: A composer shows which words go with a field

While a field in a composer is hovered or beside the caret, it MUST be marked
together with the words that go with it. While it is hovered, selected whole or
being replaced, and the composition holds another field, the result line MUST
show what an item without it gets, at the same height; otherwise it MUST show
the result. A separator left out at the end MUST be drawn as left out.

#### Scenario: Seeing the words that go with a field

- **WHEN** the description is "Tickets for ", Performers, " in ", Venue › City, and the caret is beside Performers
- **THEN** Performers and "Tickets for " MUST be marked, and the result line MUST show the result

#### Scenario: An item without a field

- **WHEN** the editor hovers Performers in that description, or selects it whole
- **THEN** the result line MUST read "Without Performers: Helsinki"

### Requirement: A composer reads well to assistive technology

A composer MUST be a single-line textbox named for its field, with a dialog
popup and Alt+ArrowDown as its key shortcut, whose fields read as their names
and are neither translated nor spellchecked. Its description MUST start with
the item's result, then say once each field that gives nothing and why,
with one full stop at the end, then only its guidance's words. Adding,
removing and replacing a field MUST be announced politely; moving the caret
MUST NOT be.

#### Scenario: Reading the composed title

- **WHEN** a screen reader focuses "Every Event"'s composed title
- **THEN** it MUST hear a textbox "Title" described "This event: Summer Gala in Helsinki · 20 June 2026."

#### Scenario: Reading a title with an empty field

- **WHEN** a screen reader focuses that title on an event without a city
- **THEN** its description MUST be "This event: Summer Gala · 20 June 2026. Venue › City is empty for this event."

#### Scenario: Reading a composition whose every field is empty

- **WHEN** a screen reader focuses a composed description whose only field, Performers › Title, is empty for the previewed event
- **THEN** its description MUST name Performers › Title once, in the guidance's words "Performers › Title is empty for this event, so its default description is used."

#### Scenario: An automated scan

- **WHEN** the Search tab of "Every Event" is scanned with the title's menu open in add mode
- **THEN** no serious or critical violation MUST be found

### Requirement: A read-only composer shows its parts without changing them

When the target is read-only, or a template value is overridden elsewhere, a
composer MUST stay focusable, marked read-only and not editable, with its
result line and description; a click on a field, Enter or Alt+Down MUST open
its menu with every entry disabled and its header saying "Read-only: nothing
can be picked."; its levels still open, to look. When the type has nothing to preview, a composer
MUST be a group that cannot be edited, its fields neutral and its result "No
‹type› to preview".

#### Scenario: A conflict

- **WHEN** the target became read-only after a conflict and an editor presses Enter in the composed title
- **THEN** its menu MUST open with every entry disabled, and nothing MUST be written

#### Scenario: Before any event exists

- **WHEN** a composed title is imported for the Event type, which has no event yet
- **THEN** the title MUST show its fields and "No event to preview", and MUST NOT be editable

### Requirement: In text, dates and numbers fit

In the menu of a value that can be composed, date and number fields and the
date facts MUST fit, with their words for the previewed item. Adding to a
title-like place, long text (a field or the Description fact) MUST wait in
the last row with "Too long for a title"; every other kind that does not fit,
with its reason. A field with several values MUST show its joined items, never
"First of ‹n›". A field labelled like a fact MUST add its machine name, in the
menu and on its chip.

#### Scenario: Starts in the title's menu

- **WHEN** an editor opens "Add a field to Title" on "Every Event"
- **THEN** Starts MUST be among the entries that fit, showing "20 June 2026", and the Website link field MUST wait in the last row with "An address, not text"

#### Scenario: Body in a title

- **WHEN** an editor opens "Add a field to Title" on "Every Article"
- **THEN** Body MUST wait in the last row with "Too long for a title"

#### Scenario: Several performers

- **WHEN** the previewed event has the performers Ada, Grace and Hedy
- **THEN** Performers › Title MUST show "Ada, Grace and 1 more" in "Add a field to Title", and "Ada, Grace, Hedy" in "Add a field to Description", and neither MUST say "First of 3"

#### Scenario: A field labelled Description

- **WHEN** the Article type has a field labelled "Description" and an editor adds it to a composition
- **THEN** its entry and its chip MUST read "Description (field_description)", apart from the Description fact

### Requirement: A field's own default is offered unless it links the whole value

While a field is added to a composer or replaces a field of a composition, the
menu MUST offer the fact the value follows by default, such as Title in a
title, so a composition can start from it.

#### Scenario: Title in the title

- **WHEN** an editor has typed "Tickets: " in "Every Event"'s title and opens "Add a field to Title"
- **THEN** Title MUST be offered, and picking it MUST give "Tickets: ", Title

### Requirement: The social title can copy the search title

While a template's title main part is composed, the social title's menu MUST
offer "Copy the search title" right after "Add words or fields", its detail the
composition as it reads with its fields by name ("Title at Venue › City,
Starts"), which puts a copy of that composition into the social title. The copy MUST NOT follow later changes to the search title. The
social title's default MUST say that it is each item's own title, not the
search title.

#### Scenario: Copying the composed title

- **WHEN** "Every Event"'s title main part is Title, " in ", Venue › City, its social title is not set, and an editor picks "Copy the search title"
- **THEN** the social title MUST be Title, " in ", Venue › City
