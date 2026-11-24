## ADDED Requirements

### Requirement: A linked value is a read-out under its field's name

A linked value, and a default that reads a field or a fact, MUST show the
previewed item's value as a read-out under a source control with the link
glyph, in the link color. There MUST be no box, tag or × around it. The
value MUST be formatted as the head gives it: dates and times in the
dialog's language, a list field by its label.

#### Scenario: Linked to Summary

- **WHEN** "Every Article"'s description is linked to Summary and the previewed article's summary is "How teams turn output into stories."
- **THEN** the source control MUST read "Summary" with the link glyph, and the read-out under it MUST read that text, with no box and no ×

#### Scenario: A linked date, at rest

- **WHEN** "Every Event"'s Starts detail is linked to the Starts field and the previewed event starts on 20 June 2026 at 19:00
- **THEN** the read-out MUST show that date and time formatted in the dialog's language, without focusing or opening anything

#### Scenario: A linked list field

- **WHEN** a detail is linked to Event status and the previewed event's status is stored as `EventScheduled` with the label "On as planned"
- **THEN** the read-out and its source menu row MUST show "On as planned", not `EventScheduled`

#### Scenario: A description's own default

- **WHEN** "Every Event" sets no description, and its default is worked out from Description › Summary
- **THEN** the source control MUST read "Event's description" with the link glyph, the same look as a link to a field, and its menu row MUST say "from Description › Summary"

### Requirement: A followed image has no Change

An image that follows a field, a fact, the site or another language MUST be
an image row with no Change and no ×. Its source menu MUST open with "Choose
image…" first and active, so one Enter opens the media library. An image
chosen here MUST keep Change. On a page, an image detail's menu MUST offer
"Choose image…" and the page's own image fact only.

#### Scenario: The social image linked to the Image field

- **WHEN** "Every Article"'s social image is linked to its Image field
- **THEN** the image row MUST show the previewed article's image, its alternative text and size, under the source control "Image" with the link glyph, and no Change

#### Scenario: The same image by default

- **WHEN** "Every Article" sets no social image and its default reads the Image field
- **THEN** the image field MUST look the same as when it is linked to Image: the source control "Image" with the link glyph, and no Change

#### Scenario: Choosing an image here

- **WHEN** an editor opens that image's source menu and presses Enter
- **THEN** the media library MUST open, and leaving it MUST return focus to the source control

### Requirement: Keeping a value here starts from its box

Picking "Type a ‹kind›" in the kept-here group MUST replace the read-out at
once with an empty box of the value's kind, with focus. Until a value is
entered, nothing MUST be stored, the status MUST say nothing, and the source
control MUST keep naming the source in use. Escape, or leaving the box
empty, MUST bring the read-out back with no sentence. "Someone else" is the
one action stored at once (seo-dialog "Who nobody chose is said").

#### Scenario: A date for every Event

- **WHEN** an editor picks "Type a date" in the source menu of "Every Event"'s Ends, which is linked to Ends
- **THEN** an empty date input MUST have focus, the source control MUST still read "Ends", the draft MUST NOT change, and no sentence MUST be said
- **AND** once a date is entered, the source control MUST read "Every Event", the status MUST say "Ends is now set for every Event.", and Undo in the bar MUST restore the link

#### Scenario: Leaving it empty

- **WHEN** an editor picks "Type a date" and presses Escape
- **THEN** Ends MUST be linked to Ends as before, and its read-out MUST be back

#### Scenario: Typing right after choosing

- **WHEN** an editor picks "Type a street address" in Street address's source menu and at once types "Main street 1"
- **THEN** Street address MUST read "Main street 1"

### Requirement: A group's source control only opens its sheet

A group's source control and its read-out MUST open its sheet on click,
Enter, Space or Alt+Down. Backspace, Delete and printable keys MUST do
nothing on them.

#### Scenario: Backspace on a linked venue

- **WHEN** focus is on the Venue source control, reading "2 fields", and the builder presses Backspace
- **THEN** every part MUST stay linked

### Requirement: Composing starts from a read-out

In a place that can be composed, a click on the read-out, Arrow right or End
on its source control, or "Add words or fields" (kept under the filter, in
sight as the menu opens) MUST turn it into a composer holding its field, or
the default's fact as a field, with the caret after it. `{` on the source
control MUST do the same and open "Add a field to ‹Field›". Leaving the
composer unchanged MUST bring the read-out back and store nothing.

#### Scenario: The brace is said

- **WHEN** an editor focuses the source control of a detail that can be composed, where no other guidance shows
- **THEN** the guidance MUST say "Type { to add a field"

#### Scenario: Starting from the default

- **WHEN** an editor tabs to "Every Event"'s untouched title's source control, presses End, types " in ", then `{`, "city" and Enter
- **THEN** the title MUST be Event's title, " in ", Venue › City, with the caret after Venue › City, under the source control "Every Event"

#### Scenario: Starting from a linked description

- **WHEN** an editor clicks the read-out of the description linked to Summary and types " Free delivery."
- **THEN** the description MUST be Summary followed by " Free delivery."

#### Scenario: From the menu

- **WHEN** an editor opens the source menu of the description linked to Summary
- **THEN** it MUST offer "Add words or fields" with "Keep Summary and add to it", and picking it MUST give a composer holding Summary, with the caret after it

#### Scenario: Nothing added

- **WHEN** an editor presses End on the untouched title's source control and then Tab
- **THEN** the title MUST show its read-out again, the draft MUST NOT hold a title, and focus MUST be on the Ending's source control

## MODIFIED Requirements

### Requirement: Where values can be linked

At template scope, every value field MUST offer linking: the title's main part
and ending, the description, the social title, description and image, and each
structured data detail, a choice of options included. At page scope only
structured data details of kind address, date and image MAY offer it, to the
page's facts of that kind, when a fact other than the detail's default is
offered. Site settings, and a page's title, description and social texts, MUST
NOT offer it. Linking MUST be offered in the field's source menu, never by a
button by its label.

#### Scenario: A template's description

- **WHEN** an editor opens the Search tab of "Every Article", which sets no description
- **THEN** the Description field MUST have the source control "Article's description", and no link button by its label

#### Scenario: A page's date detail

- **WHEN** an editor opens the Schema tab of an Article page
- **THEN** the date details' source menus MUST offer "Page's publish date" and "Page's last update", and the page's title and description MUST NOT offer linking

#### Scenario: A page's image detail

- **WHEN** an editor opens the Schema tab of an Article page, whose Image detail follows the page's Image, its only image fact
- **THEN** the Image detail's source menu MUST offer "Choose image…" and MUST NOT list another field

#### Scenario: Site settings

- **WHEN** an administrator opens Site
- **THEN** no field MUST offer linking

### Requirement: Every link state is said in words

A read-out MUST say in words, in one italic line that replaces the value,
when its source is empty for the previewed item ("Empty for this ‹type›"),
hidden from visitors ("Hidden from visitors", through a reference "… for
this ‹type›"), broken ("No longer exists", "No longer gives text", "Can no
longer be read"), or when the type has no item to preview ("No ‹type› to
preview"), followed by what is used instead ("so the detail is left out").
A broken link's source control MUST name the field by its label while the
field exists, else by its machine name. Its source menu MUST list the broken
entry first in its group, checked, in the broken color, with its reason, and
open on it; every other row is a way out, so no separate "Link another
field" action is offered. An issue about the value MUST sit under the
read-out, after any such line.

#### Scenario: Empty for this article

- **WHEN** the description is linked to Summary and the previewed article has no summary
- **THEN** the read-out MUST say "Empty for this article, so its default description is used."

#### Scenario: Broken

- **WHEN** the description is linked to `field_summary` and that field was deleted
- **THEN** the source control MUST read `field_summary` in the broken color with the broken-link glyph, and the read-out MUST say "No longer exists, so each article uses its default description."

#### Scenario: A broken link's menu

- **WHEN** an editor opens the source menu of that description
- **THEN** `field_summary` MUST be the first entry under "Follows each Article", checked, in the broken color, saying "No longer exists", and active, and "Article's description" MUST be listed marked "Default"

#### Scenario: A field that changed its type

- **WHEN** the description is linked to QA note and that field became a number
- **THEN** the source control MUST read "QA note", and the read-out MUST say "No longer gives text", not "No longer exists"

#### Scenario: A broken image

- **WHEN** "Every Article"'s social image is linked to Hero and Hero can no longer be read
- **THEN** the source control MUST read "Hero" in the broken color with the broken-link glyph, and the image row MUST say "Can no longer be read, so the site image is used."

#### Scenario: Nothing to preview

- **WHEN** the Article type has no article yet
- **THEN** each read-out, the social description's included, MUST say "No article to preview"

#### Scenario: An image hidden for this item

- **WHEN** "Every Event"'s social image is linked to Poster › Image and the previewed event's poster is unpublished
- **THEN** the image row MUST say "Hidden from visitors for this event, so the site default image is used." under the source control "Poster › Image", and the Schema tab's image detail MUST show the same source and words

#### Scenario: A detail through a hidden reference

- **WHEN** "Every Event"'s Street address is linked to Venue › Street address and the previewed event's venue is unpublished
- **THEN** the read-out MUST say "Hidden from visitors for this event, so the detail is left out."

#### Scenario: An issue under a linked detail

- **WHEN** "Every Event"'s Ends is linked to Ends and the previewed event ends before it starts
- **THEN** the issue MUST be said under Ends's read-out

### Requirement: The link menu offers what fits the field

The source menu MUST be a dialog named "Source of ‹Field›" with a "Find a
source" filter that matches labels, paths and values, ignoring case and
accents, best match first. Each entry MUST show its label and the previewed
item's value. Only the entries that fit MUST be rows; the others MUST wait
behind one quiet line in the menu's footer, "‹n› other fields can't be used
here", that opens them disabled with a reason, such as "An image, not
text". The filter MUST still find them, disabled. The current entry MUST be
marked. "No source matches" MUST be announced.

#### Scenario: Finding Summary

- **WHEN** an editor opens the description's source menu and types "summ"
- **THEN** the Summary entry MUST be listed with the previewed article's summary as its value

#### Scenario: An image in a text menu

- **WHEN** the title's source menu is opened on a type with an image field
- **THEN** the image field MUST NOT be a row, and opening the footer line "‹n› other fields can't be used here" MUST list it disabled with the reason "An image, not text"

#### Scenario: A reference with nothing that fits

- **WHEN** the description's source menu is opened on a type whose Image reference offers only a file size
- **THEN** no "Image" level MUST be listed

#### Scenario: The best match first

- **WHEN** an editor types "summ" in the description's source menu on a type with Summary, Body › Summary and a Body that mentions summaries
- **THEN** Summary MUST be the first entry and active, then Body › Summary, then Body

#### Scenario: Choosing between two dates

- **WHEN** an editor opens the source menu of "Every Event"'s Starts detail
- **THEN** the Starts and Ends entries MUST each show the previewed event's date and time, so they can be told apart before one is picked

#### Scenario: Nothing found

- **WHEN** the filter matches nothing
- **THEN** the menu MUST say "No source matches “‹filter›”.", in a polite live region

### Requirement: Picking an entry links the value at once

Picking an entry MUST store it in the draft at once, show its value straight
away, close the menu and return focus to the source control, or, for a field
added to or replacing one in a composer, to the composer with the caret right
after that field. The status and the action bar MUST say "‹Field› now follows
‹Source›." for a whole value, with Undo, and "‹Source› added to ‹Field›." for
an added field. Picking the row marked "Default" MUST store nothing and say
"‹Field› is back to ‹Source›."

#### Scenario: Linking the description

- **WHEN** an editor picks Summary in the description's source menu
- **THEN** the template's draft MUST hold the link, the read-out MUST show the summary, the status MUST say "Description now follows Summary.", and Undo in the bar MUST restore the previous value

#### Scenario: Adding a field

- **WHEN** an editor with the caret after "Summer Gala in " in "Every Event"'s title picks Venue › City in "Add a field to Title"
- **THEN** the draft MUST hold the composition, the caret MUST be right after Venue › City, and the dialog MUST announce "Venue › City added to Title."

### Requirement: The title ending has its own menu

The Ending's menu MUST be a source menu named "Source of Title ending" with
the filter "Find a source". It MUST offer the Site ending under "Follows the
site", marked "Default"; at template scope the type's text fields under
"Follows each ‹Type›", in the source menu's levels; and under the kept-here
group "Type an ending", which opens the Ending's text box empty with focus,
and "No ending". Outside Site its one footer MUST say where the separator is
set and offer "Edit in Site" to administrators.

#### Scenario: Typing an ending

- **WHEN** an editor picks "Type an ending" and types "Blog"
- **THEN** the ending MUST be "Blog" in its box, the search preview's title MUST end with "| Blog", and the Ending's source control MUST read the kept-here word

#### Scenario: No ending

- **WHEN** an editor picks "No ending"
- **THEN** the title MUST have no separator and no ending

#### Scenario: Filtering for an option

- **WHEN** an editor types "no end" in the ending's menu
- **THEN** "No ending" MUST be the first entry

### Requirement: The ending's button shows what the item gets

An ending linked to a field that gives nothing for the previewed item MUST
keep that field in its source control, with the link glyph, and its read-out
MUST say that the field is empty and what the title gets, as the head does
(dynamic-values).

#### Scenario: An empty linked ending

- **WHEN** the site sets "No ending" and "Every Event" links its ending to a field that the previewed event has empty
- **THEN** the Ending's source control MUST name that field with the link glyph, and its read-out MUST say "Empty for this event, so the title has no ending."

### Requirement: An image can follow each item's image field

At template scope, the image's source menu MUST offer, under "Follows each
‹Type›", the type's image fields, each with the previewed item's image.
Picking one MUST link the image. "Choose image…" MUST open the media library;
picking an image there MUST store that media item, and leaving it MUST
return focus to the source control.

#### Scenario: Linking the social image to Hero

- **WHEN** an editor picks Hero under "Follows each Article" in the social image's source menu
- **THEN** the social image MUST be linked to Hero, and the image row MUST show the previewed article's hero image and its size under the source control "Hero"

### Requirement: A read-only target shows links without changing them

When the target is read-only, every source control MUST be static words with
no chevron, still focusable and named as at rest, with no `aria-haspopup`
and no `aria-expanded`, and MUST NOT open a menu. Nothing MUST react: a
read-out MUST show no input edge, fill or text cursor on hover, a click MUST
NOT turn it into a box, and Delete and Backspace on a control MUST do
nothing. A group MUST still open its sheet, read-only. A value kept here
MUST keep a locked box, and a composer MUST show its fields without letting
them be edited.

#### Scenario: A conflict

- **WHEN** the target became read-only after a conflict
- **THEN** pressing Enter on the description's source control MUST open nothing, the control MUST still name the description's source, and nothing MUST be written

#### Scenario: Delete on a locked control

- **WHEN** an editor focuses the social title's source control on a locked page and presses Delete
- **THEN** nothing MUST be written and the social title MUST still follow the page's title

#### Scenario: Hover on a locked read-out

- **WHEN** an editor hovers the social title's read-out on a locked page
- **THEN** no input edge, fill or text cursor MUST appear

### Requirement: Linking works by keyboard

Enter, Space and Alt+Down on a source control MUST open its menu with the
current entry active, inside its level. A printable key on a source control
MUST open its menu with the key in its filter. Delete or Backspace on it MUST
go back to the default. Alt+Down, or `{` in an empty input or composer at
template scope, MUST open the menu from a box; `{` in a non-empty page input
MUST be typed. In a composer, Alt+Down, `{` and Enter MUST open the menu at
the caret. In the menu, Up, Down, Home and End MUST move, Enter MUST pick,
and Escape MUST close it and return focus to its opener at once.

#### Scenario: Linking by keyboard

- **WHEN** an editor focuses an empty template description composer, types `{`, then "summ" and Enter
- **THEN** the description MUST be linked to Summary and its source control MUST have focus

#### Scenario: A brace in text

- **WHEN** an editor types `{` after other text in a page's typed input
- **THEN** the brace MUST be typed, and no menu MUST open

#### Scenario: The current entry in a level

- **WHEN** an editor presses Enter on Street address's source control, linked to Venue › Street address
- **THEN** the menu MUST open in the Venue level with Street address active

#### Scenario: A key right after Escape

- **WHEN** an editor opens the description's menu from its source control, presses Escape and at once Backspace
- **THEN** the description MUST be back to its default, and its source control MUST have focus

#### Scenario: A key right after a pick

- **WHEN** an editor focuses an empty template description composer, types `{`, "summ", Enter and then "x"
- **THEN** the description's source menu MUST open again with "x" in its filter, and nothing MUST be written

### Requirement: The publisher is answered once per type

The publisher MUST be offered in every reference's source menu as "This
site" under "Follows the site", in sight as the menu opens: only the type's
fields that can be a person are rows above it, and the rest wait behind the
footer line. On a template, an organizer, employer or author that nobody has
set MUST read "Not set", with what it is needed for, until the builder
answers it.

#### Scenario: A new job type

- **WHEN** a builder sets up Every Job and has not chosen an employer
- **THEN** the Employer field MUST read "Not set" with "Needed for job listings", and its source menu MUST offer "This site" with "Example Studio" under "Follows the site", and "Someone else" and "Not set" under "Set for every Job"

### Requirement: A linked duration says its unit

Linking a duration to a number field MUST ask what the field counts
(minutes or hours for recipes), with the first choice preselected, in one
compact segmented choice under its read-out, and store the answer with the
link.

#### Scenario: Cook time in hours

- **WHEN** a builder links Cook time to "Cook hours" and answers hours, and a recipe holds 1.5
- **THEN** its `cookTime` MUST be `PT1H30M`

### Requirement: Text on a template is a composer unless it is one field

At template scope, a value that can be composed MUST show a read-out while it
follows its default or links one field or fact, as linked values do
everywhere. While it holds typed text or more than one field, or is empty
with focus, it MUST be a composer that holds typed text and fields, each
named as its source control would name it. While it has focus, a composer
MUST stay a composer. Everywhere else the input or read-out MUST stay.

#### Scenario: Typing over the default

- **WHEN** "Every Article" sets no description, and an editor clicks its read-out and types "A"
- **THEN** the description MUST be a composer holding "Article's description" and the typed text "A", under the source control "Every Article"

#### Scenario: A click on a linked box

- **WHEN** "Every Article"'s description is linked to Summary and an editor clicks its read-out
- **THEN** a composer holding Summary MUST have focus, with the caret after it, and nothing MUST be stored

#### Scenario: A page

- **WHEN** an editor opens a page's Search tab
- **THEN** the title and description MUST be typed inputs or read-outs, with no composer

### Requirement: An empty composer can start from its default

While a composer is empty and its value follows its default, "Source of
‹Field›" MUST offer "Add words or fields" first, with "Keep the default and
add to it", and picking it MUST make the default the composer's first field.

#### Scenario: Starting over from the default

- **WHEN** an editor clicks "Every Event"'s untouched title, presses Backspace to remove its field, then types `{`
- **THEN** "Source of Title" MUST offer "Add words or fields" with "Keep the default and add to it" first, and picking it MUST give a composer whose only field is Event's title

### Requirement: Fields are added at the caret

In a composer that holds anything, Alt+Down, `{` or Enter MUST open "Add a
field to ‹Field›", which puts the pick at the caret, else at the end. Its
header MUST say where and its hints MUST say "↵ add". An empty composer MUST
open "Source of ‹Field›". `{`, typed with whatever keys the keyboard layout
needs (Shift, Option, AltGr), MUST NOT be typed; `{` in the empty filter MUST
close the menu and type one. Escape MUST type nothing.

#### Scenario: Composing a title by keyboard

- **WHEN** an editor in "Every Event"'s title holding "Tickets: " types `{`, "titl", Enter, " in ", `{`, "city", Enter
- **THEN** the title MUST be "Tickets: ", Event's title, " in ", Venue › City, with the caret after Venue › City

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

### Requirement: A field in a composer moves and goes as one

The caret MUST step over a field with one arrow press, Shift with an arrow MUST
select it whole, and no selection MUST end inside one. Backspace or Delete
beside a field MUST remove it whole and announce "‹Source› removed from
‹Field›."; "‹Field› is back to ‹Source›." MUST be announced only when the
value becomes empty and follows its default again. A click on a field, or
Enter with it selected, MUST open "Replace ‹Source›" with "↵ replace" in its
hints and "Remove ‹Source›" as its first row, under the filter.

#### Scenario: Stepping over a field

- **WHEN** the caret is before Venue › City and the editor presses the right arrow once
- **THEN** the caret MUST be right after Venue › City

#### Scenario: Removing a field

- **WHEN** the caret is right after Venue › City and the editor presses Backspace
- **THEN** Venue › City MUST be gone, the typed text MUST stay, and the dialog MUST announce "Venue › City removed from Title."

#### Scenario: Replacing a field

- **WHEN** an editor clicks Venue › City in the title and picks Venue › Title in "Replace Venue › City"
- **THEN** Venue › Title MUST take its place, the words around it MUST stay, and the dialog MUST announce "Venue › City replaced by Venue › Title."

### Requirement: Copying keeps the fields a target can take

A copy inside the dialog MUST keep the fields the target can take, and leave
out, with their words and a message, those it can't; the message MUST be
announced and shown under the field until focus leaves it. A field MUST never
be pasted as its label. A paste on the source control of a value that can be
typed over MUST open its box (a page's input or a template's composer) and
paste there. The plain text of any copy MUST be the previewed item's result
for the selection.

#### Scenario: Copying a composition

- **WHEN** an editor copies the composed title and pastes it into the social title of the same template
- **THEN** the social title MUST hold the same fields and text

#### Scenario: Pasting a field another type doesn't have

- **WHEN** an editor copies Event's title, " in ", Venue › City from "Every Event" and pastes it into "Every Article"'s description
- **THEN** the description MUST hold Article's title only, and the dialog MUST say "Venue › City isn't available here, so it was left out."

#### Scenario: Copying out of the dialog

- **WHEN** an editor copies the composed title and pastes it into a document outside the dialog
- **THEN** the document MUST receive "Summer Gala in Helsinki · 20 June 2026"

### Requirement: Undo in a composer never outlives the draft

Undo in the composer MUST restore typing and added, replaced and removed
fields. A change from outside the composer, such as Undo in the action bar,
going back to the default or a fix from Checks, MUST replace its content and
clear its undo history.

#### Scenario: Undo after removing a field

- **WHEN** an editor removes Venue › City with Backspace and presses Ctrl+Z
- **THEN** Venue › City MUST be back where it was, in the composer and in the draft

#### Scenario: Undo in the bar, then in the composer

- **WHEN** an editor adds Venue › City, presses Undo in the action bar, and then Ctrl+Z in the composer
- **THEN** the composer MUST show the value without Venue › City, and Ctrl+Z MUST NOT bring back a value the draft no longer holds

### Requirement: A field's own default is offered unless it links the whole value

While a field is added to a composer or replaces a field of a composition, the
menu MUST offer the fact the value follows by default, such as Event's title
in a title, so a composition can start from it.

#### Scenario: Title in the title

- **WHEN** an editor has typed "Tickets: " in "Every Event"'s title and opens "Add a field to Title"
- **THEN** Event's title MUST be offered, and picking it MUST give "Tickets: ", Event's title

### Requirement: The social title can copy the search title

While a template's title main part is composed, the social title's menu MUST
offer "Copy the search title" right after "Add words or fields", its detail the
composition as it reads with its fields by name ("Event's title at Venue ›
City, Starts"), which puts a copy of that composition into the social title.
The copy MUST NOT follow later changes to the search title. The social
title's default MUST be each item's own title, named "‹Type›'s title", not the
search title.

#### Scenario: Copying the composed title

- **WHEN** "Every Event"'s title main part is Event's title, " in ", Venue › City, its social title is not set, and an editor picks "Copy the search title"
- **THEN** the social title MUST be Event's title, " in ", Venue › City

### Requirement: Worked-out values are told apart from fields

A source menu MUST list the module's worked-out values with the item's facts
under "Follows each ‹Type›", named as facts ("Article's description"), with
the link glyph, before the type's fields. An entry whose value reads a field
MUST say which ("from Summary"). A worked-out value no item of the type can
have MUST be listed last among the facts, disabled: "No ‹type› has one". A
text value whose own default is a worked-out value MUST name that fact in its
source control, list it as its default row, and list the field it reads once,
as a field.

#### Scenario: Where a value comes from

- **WHEN** an editor opens the source menu of a text detail on "Every Article", whose Body has a summary
- **THEN** "Article's description" MUST be under "Follows each Article" and show the previewed article's description with "from Body › Summary", even where the Body › Summary entry below shows the same text

#### Scenario: A value no item can have

- **WHEN** an editor opens the source menu of a text detail on "Every Bookmark", whose type has only a title and a link field
- **THEN** "Bookmark's description" MUST be the last fact, disabled with the reason "No bookmark has one", and the footer's unfit fields MUST NOT list it; the description's read-out MUST say "No bookmark has one", never "Empty for this bookmark"

#### Scenario: The field's own default

- **WHEN** an editor opens the source menu of "Every Post"'s description, which follows its default from Summary
- **THEN** the source control MUST read "Post's description" with the link glyph, the menu MUST list "Post's description" checked, marked "Default" and saying "from Summary", and Summary once, as a field; the social image's source control MUST name its image field, and its menu MUST NOT list a worked-out image

#### Scenario: The field's own default when adding to a composition

- **WHEN** the description is a composer holding " Free delivery." and the editor opens "Add a field to Description", or opens "Replace ‹Source›" on one of its fields
- **THEN** "Follows each Post" MUST list "Post's description" with "from Summary", and picking it MUST put a field named "Post's description" at the caret or in the field's place

#### Scenario: Starting from the field's own default

- **WHEN** the editor opens the source menu of "Every Post"'s untouched description, or "Source of Description" in its empty composer
- **THEN** it MUST offer "Add words or fields" with "Keep the default and add to it", and picking it MUST give a composer whose first field is "Post's description"

#### Scenario: A field labelled like the value it follows

- **WHEN** "Every Product"'s description follows its default from its body field, labelled Description
- **THEN** its source control MUST say "Product's description", never the field's machine name
- **AND** the description's source menu MUST list the field as "Description (body)" beside "Product's description", and so MUST any other menu that lists both

#### Scenario: Linked to a worked-out value

- **WHEN** a text detail of "Every Article" is linked to Site name
- **THEN** its source control MUST read "Site name", and the status MUST have said "‹Detail› now follows Site name."

### Requirement: A worked-out value says its field whole

A menu entry of a worked-out value MUST say the field it reads beside its
label, on screen and in its accessible name, whole however long its value.

#### Scenario: A long value

- **WHEN** the previewed event's description is its Body's first 160 characters, and an editor opens the Title's source menu on "Every Event"
- **THEN** the "Event's description" entry under "Follows each Event" MUST show "from Description (body)" on screen and in its accessible name, wherever its value is cut

### Requirement: The field the default reads leads its menu

With an empty filter, the field a description's or image's worked-out
default reads MUST come first among the fields, with the fields named for
the value. While a description follows its default, its menu MUST mark the
default's fact current, saying "Default". While an image follows its
default, its menu MUST mark the field the default reads current, saying
"Default". Picking the current default row MUST write nothing.

#### Scenario: The field the default reads

- **WHEN** an editor opens the description's source menu on "Every Event", whose Description has a summary and whose form lists Description before Status
- **THEN** Description › Summary MUST be the first field under "Follows each Event", before Description and Status

#### Scenario: What the default reads, in its menu

- **WHEN** an editor opens the description's source menu on "Every Event", which follows its default from Description › Summary
- **THEN** the "Event's description" entry MUST be marked current, its accessible name MUST start with "Event's description, Default", and the menu MUST open on it

#### Scenario: Choosing what the default reads

- **WHEN** the editor chooses that entry from the description's source menu
- **THEN** the menu MUST close and the value MUST keep following its default: nothing is written

#### Scenario: Choosing the field the default reads

- **WHEN** the editor chooses Description › Summary instead
- **THEN** the description MUST be linked to Description › Summary, and its source control MUST read "Description › Summary"

#### Scenario: What the default reads, through a reference

- **WHEN** an editor opens the social image's source menu on "Every Person", whose Image reads Photo, a media reference
- **THEN** the Photo row at the menu's first level MUST say "Default" beside its label, and the Photo › Image entry inside it MUST be marked current

### Requirement: Worked-out values read the same in a composer

A field in a composer that is a worked-out value MUST be named as its fact
("Post's description") and say in its tooltip, and its composer in its
description, which field it reads ("from Summary"). "No ‹type› has one" and
the order of fields named for the value MUST hold in the menu's link, add and
replace modes alike.

#### Scenario: A chip that reads a field

- **WHEN** "Every Post"'s description is Post's description, " Free delivery.", and Post's description reads Summary
- **THEN** the field MUST read "Post's description", never "Automatic › Description", its tooltip MUST say "from Summary", and the composer's description MUST say it too

#### Scenario: Adding on a type without the value

- **WHEN** an editor opens "Add a field to Description" in a composer on "Every Bookmark"
- **THEN** "Bookmark's description" MUST be the last fact under "Follows each Bookmark", disabled, with the reason "No bookmark has one"

#### Scenario: Named fields first when adding

- **WHEN** an editor opens "Add a field to Description" with an empty filter on "Every Post", whose form lists Byline and Image › Alternative text before Summary
- **THEN** Summary MUST be the first field under "Follows each Post"

## REMOVED Requirements

### Requirement: The link control sits by the label

**Reason**: The link button by the label looked the same whether a value was
typed, followed a default or was linked, so it read as "this is linked" on
fields that were not. The source control at the right of the label row
(seo-dialog "Every field says where its value comes from, at rest") replaces
it, and names the source in words.

**Migration**: None. Tests that find "Link ‹Field› to a field" or "Change the
link for ‹Field›" find the source control by "‹Source›, source of ‹Field›".
The scenario "A broken link's button" goes with this requirement; seo-dialog
"A deleted field" and "Every link state is said in words" replace it.

### Requirement: A field with a box is one Tab stop

**Reason**: Replaced by seo-dialog "The source control comes first in the Tab
order": the source control, then the box. A read-out is not a Tab stop.

**Migration**: None.

### Requirement: A linked value is shown as a box

**Reason**: A box now means "you type here". A linked value is a read-out
under a blue source control ("A linked value is a read-out under its field's
name"). The tag "Default" and the × go.

**Migration**: None. Nothing stored changes.

### Requirement: A box looks like an input, its tag says the link

**Reason**: There is no linked box and no tag. Color stays a second cue: the
source control's words and glyph carry the meaning, blue for what is filled
from the item, red for broken.

**Migration**: None.

### Requirement: An image row names its link as a box does

**Reason**: Replaced by "A followed image has no Change": the source control
names the link; the image row has no tag and no ×.

**Migration**: None.

### Requirement: A box keeps one layout per kind of field

**Reason**: Replaced by seo-dialog "The source control fits narrow fields"
and the read-out's one layout. A path still gives way from its start
(seo-dialog "A field is named by its label, as a link").

**Migration**: None.

### Requirement: Unlinking starts with an empty input

**Reason**: There is no ×, and a key on a read-out does nothing: read-outs
are not Tab stops. Unlinking is picking another row; "Keeping a value here
starts from its box" says what the box starts with, and Delete on the source
control goes back to the default.

**Migration**: None.

### Requirement: A linked group box only opens its sheet

**Reason**: Replaced by "A group's source control only opens its sheet".

**Migration**: None.

### Requirement: Composing starts from a box

**Reason**: Replaced by "Composing starts from a read-out": the same keys on
the source control, and a click on the read-out.

**Migration**: None.
