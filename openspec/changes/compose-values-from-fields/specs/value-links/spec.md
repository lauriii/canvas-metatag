## MODIFIED Requirements

### Requirement: The link control sits by the label

A field that offers linking MUST show a link button right after its label. Its
name MUST be "Link ‹Field› to a field" while the value is typed or empty, and
"Change the link for ‹Field›" while a box shows it linked or following its
default. In a composer that holds anything, it MUST be "Add a field to
‹Field›", with a plus instead of the link icon. The name MUST follow the value
alone, never where a caret was. Its tooltip MUST start with that name and then
say the state. It MUST be gray, and red with a broken link's icon when the link
is broken: the box says the rest. It MUST open the field's link menu.

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

### Requirement: A box keeps one layout per kind of field

A one-line value (a title) MUST show its source before its value on one line,
one control high, its source never squeezed by a long value; any other value
MUST show its source over its value, never shorter than the input it turns
into. Beside another detail neither line MUST wrap or move with focus: the path
MUST give way from its start, so that the field it ends at stays in sight, and
the value MUST be cut at its end, with the whole path and value in its
description and tooltip. A composer beside another detail MUST cut its line of
fields and its result line at their ends, one line each, with both whole in its
description and tooltip.

#### Scenario: Linked a pair of details

- **WHEN** "Every Event"'s Venue and Street address, side by side, are linked to Venue › Title and Venue › Street address
- **THEN** each box MUST show its path over its value, the path giving way from its start so that "City" or "Street address" stays, the value cut at its end, and focusing a box MUST NOT change its height

#### Scenario: A long title at rest

- **WHEN** "Every Article"'s title follows its default and the previewed article's title is longer than the box
- **THEN** the box MUST show the whole tag "Default" and cut only the title

#### Scenario: A composed street address in a pair

- **WHEN** "Every Venue"'s Street address, beside another detail, is Street, " ", Number
- **THEN** its fields and its result MUST each take one line, and the pair's two cells MUST keep the same height

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

## ADDED Requirements

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
quiet note after the result.

#### Scenario: A composed title at rest

- **WHEN** "Every Event"'s title is Title, " in ", Venue › City, " · ", Starts, and the editor previews "Summer Gala"
- **THEN** the Title field MUST show the fields Title, Venue › City and Starts with the typed " in " and " · " between them, and on the line under them "Summer Gala in Helsinki · 20 June 2026"

#### Scenario: A city the event lacks

- **WHEN** the previewed event has no city and the title is Title, " in ", Venue › City, " · ", Starts
- **THEN** the result line MUST read "Summer Gala · 20 June 2026" with the note "without Venue › City"

### Requirement: Composing starts from a box

In a place that can be composed, Arrow right or End on a box, or "Add words or
fields" at the top of its menu, MUST turn it into a composer holding its field,
or the default's fact as a real field, with the caret after it. `{` on such a
box MUST do the same and open "Add a field to ‹Field›" at the caret. Leaving
the composer before anything is added MUST show the box again and store
nothing new.

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
- **THEN** it MUST offer "Add words or fields" with "Start from Title"

#### Scenario: Nothing added

- **WHEN** an editor presses End on the untouched title and then Tab
- **THEN** the title MUST show its Default box again, and the draft MUST NOT hold a title

### Requirement: Fields are added at the caret

In a composer that holds anything, Alt+Down, `{` or Enter, or the link button,
MUST open "Add a field to ‹Field›", which puts the pick at the caret, or for
the button at the last caret, else at the end. Its header MUST say where, its
hints MUST say "↵ add", and its footer MUST state the empty-field rule. An
empty composer MUST open "Link ‹Field›". `{` MUST NOT be typed; `{` in the empty
filter MUST close the menu and type one. Escape MUST type nothing.

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

#### Scenario: The rule said once

- **WHEN** an editor opens "Add a field to Title"
- **THEN** its footer MUST say "When an item doesn't have a field, the words joining it are left out too."

#### Scenario: The eighth field

- **WHEN** a composer holds eight fields and the editor opens its menu
- **THEN** the menu MUST say "At most 8 fields in one value." and no entry MUST be pickable, except to replace a selected field

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
‹Source›" with "↵ replace" in its hints and "Remove ‹Source›" among its rows.

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
out, with their words and a message, those it can't; a field MUST never be
pasted as its label. The plain text of any copy MUST be the previewed item's
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
together with the words that go with it, and the result line MUST show what an
item without it gets, at the same height. A separator left out at the end MUST
be drawn as left out.

#### Scenario: Seeing the words that go with a field

- **WHEN** the description is "Tickets for ", Performers, " in ", Venue › City, and the caret is beside Performers
- **THEN** Performers and "Tickets for " MUST be marked, and the result line MUST read "Without Performers: Helsinki"

### Requirement: A composer reads well to assistive technology

A composer MUST be a single-line textbox named for its field, with a dialog
popup and Alt+ArrowDown as its key shortcut, whose fields read as their names
and are neither translated nor spellchecked. Its description MUST start with
the item's result, then say each field that gives nothing and why, with one
full stop at the end. Adding, removing and replacing a field MUST be announced
politely; moving the caret MUST NOT be.

#### Scenario: Reading the composed title

- **WHEN** a screen reader focuses "Every Event"'s composed title
- **THEN** it MUST hear a textbox "Title" described "This event: Summer Gala in Helsinki · 20 June 2026."

#### Scenario: Reading a title with an empty field

- **WHEN** a screen reader focuses that title on an event without a city
- **THEN** its description MUST be "This event: Summer Gala · 20 June 2026. Venue › City is empty for this event."

#### Scenario: An automated scan

- **WHEN** the Search tab of "Every Event" is scanned with the title's menu open in add mode
- **THEN** no serious or critical violation MUST be found

### Requirement: A read-only composer shows its parts without changing them

When the target is read-only, or a template value is overridden elsewhere, a
composer MUST stay focusable, marked read-only and not editable, with its
result line and description; a click on a field or Enter MUST open its menu
with every entry disabled. When the type has nothing to preview, a composer
MUST be a group that cannot be edited, its fields neutral and its result "No
‹type› to preview".

#### Scenario: A conflict

- **WHEN** the target became read-only after a conflict and an editor presses Enter in the composed title
- **THEN** its menu MUST open with every entry disabled, and nothing MUST be written

#### Scenario: Before any event exists

- **WHEN** a composed title is imported for the Event type, which has no event yet
- **THEN** the title MUST show its fields and "No event to preview", and MUST NOT be editable

### Requirement: In text, dates and numbers fit

In the link menu of a value that can be composed, date and number fields and
the date facts MUST fit, each with its value in words for the previewed item.
In a title-like place, long text MUST wait in the last row with "Too long for a
title". Images, addresses and every other kind MUST wait in the last row with
their reason. A field with several values MUST show its joined items, never
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
offer "Copy the search title", which puts a copy of that composition into the
social title. The copy MUST NOT follow later changes to the search title. The
social title's default MUST say that it is each item's own title, not the
search title.

#### Scenario: Copying the composed title

- **WHEN** "Every Event"'s title main part is Title, " in ", Venue › City, its social title is not set, and an editor picks "Copy the search title"
- **THEN** the social title MUST be Title, " in ", Venue › City
