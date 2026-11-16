## Purpose

Let a site builder link a value in the SEO dialog to where it comes from, see at
a glance which source each linked value follows and what it gives for the
previewed item, and go back to typed text, by mouse, keyboard and assistive
technology.

## ADDED Requirements

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

A field that offers linking MUST show a link button right after its label. Its
name MUST be "Link ‹Field› to a field" while the value is typed or empty, and
"Change the link for ‹Field›" while a box shows it linked or following its
default; its tooltip MUST start with that name and then say the state. It
MUST be gray, and red with a broken link's icon when the link is broken: the
box says the rest. It MUST open the field's link menu.

#### Scenario: A linked description

- **WHEN** the description of "Every Article" is linked to Summary
- **THEN** the button by its label MUST be named "Change the link for Description" and its tooltip MUST say "Linked to Summary"

#### Scenario: Unlinked to an empty input

- **WHEN** an editor unlinks the description and the empty input has focus
- **THEN** the button by its label MUST be named "Link Description to a field"

### Requirement: A field with a box is one Tab stop

While a box shows a value, the link button by its label MUST stay out of the
Tab order: the box, which opens the same menu, is the field's one stop. The
button MUST still open the menu on a click.

#### Scenario: Tabbing through a template's Schema tab

- **WHEN** an editor tabs through "Every Event"'s Schema tab, whose details are linked
- **THEN** each linked detail MUST take one Tab for its box and one for its ×, and none for its link button

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

Picking an entry MUST store the link in the draft at once, show the entry's
value in the box straight away, close the menu and return focus to the box (for
an image, to its link button). The
dialog MUST announce "‹Field› linked to ‹Source›." and the action bar MUST say
"Linked to ‹Source›" with Undo.

#### Scenario: Linking the description

- **WHEN** an editor picks Summary in the description's link menu
- **THEN** the template's draft MUST hold the link, the box MUST show the summary, and Undo in the bar MUST restore the previous value

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
In the menu, Up, Down, Home and End MUST move, Enter MUST link, and Escape MUST
close it and return focus to its opener at once.

#### Scenario: Linking by keyboard

- **WHEN** an editor focuses an empty template description, types `{`, then "summ" and Enter
- **THEN** the description MUST be linked to Summary and the box MUST have focus

#### Scenario: A brace in text

- **WHEN** an editor types `{` after other text in a typed input
- **THEN** the brace MUST be typed, and no menu MUST open

#### Scenario: The current entry in a level

- **WHEN** an editor presses Enter on Street address, linked to Venue › Street address
- **THEN** the menu MUST open in the Venue level with Street address active

#### Scenario: A key right after Escape

- **WHEN** an editor opens the description's menu from its box, presses Escape and at once Backspace
- **THEN** the description MUST be unlinked, an empty input with focus
