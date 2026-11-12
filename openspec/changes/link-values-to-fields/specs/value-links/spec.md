## Purpose

Let a site builder link a value in the SEO dialog to where it comes from, see at
a glance which source each linked value follows and what it gives for the
previewed item, and go back to typed text, by mouse, keyboard and assistive
technology.

## ADDED Requirements

### Requirement: Where values can be linked

At template scope, every value field MUST offer linking: the title's main part
and ending, the description, the social title, description and image, and each
structured data detail except a choice of options. At page scope only
structured data details of kind address, date and image MUST offer it, to the
page's facts of that kind. Site settings, and a page's title, description and
social texts, MUST NOT offer it.

#### Scenario: A template's description

- **WHEN** an editor opens the Search tab of "Every Article"
- **THEN** the Description field MUST have a button named "Link Description to a field"

#### Scenario: A page's date detail

- **WHEN** an editor opens the Schema tab of an Article page
- **THEN** the date details MUST offer linking to "First published" and "Last updated", and the page's title and description MUST NOT offer linking

#### Scenario: Site settings

- **WHEN** an administrator opens Site
- **THEN** no field MUST offer linking

### Requirement: The link control sits by the label

A field that offers linking MUST show a link button right after its label. Its
name MUST be "Link ‹Field› to a field" while the value is typed or empty, and
"Change the link for ‹Field›" while it is linked or follows its default. Its
icon MUST show whether the value is unlinked, linked or broken. It MUST open
the field's link menu.

#### Scenario: A linked description

- **WHEN** the description of "Every Article" is linked to Summary
- **THEN** the button by its label MUST be named "Change the link for Description" and its tooltip MUST say "Linked to Summary"

### Requirement: A linked value is shown as a box

A linked value, and at template scope a value that follows its default, MUST
replace the input with a box that names its source and shows the previewed
item's value, with an × to unlink. A value linked here MUST look different from
one that follows its default. The box MUST be a button named for the field,
described by a sentence that says the source and the item's value.

#### Scenario: Linked to Summary

- **WHEN** "Every Article"'s description is linked to Summary and the previewed article's summary is "How teams turn output into stories."
- **THEN** a button named "Description" MUST show "Summary" and that text, and its description MUST start with "Linked to Article › Summary. This article: How teams turn output into stories."

#### Scenario: Following the default

- **WHEN** "Every Article" sets no description
- **THEN** the box MUST show "Description" as its source, with the previewed article's description, in the look of a default

### Requirement: Every link state is said in words

A linked box MUST say, in its value and in its description, when the source is
empty for the previewed item ("Empty for this ‹type›"), hidden from visitors
("Hidden from visitors"), broken ("No longer exists", with the field's machine
name), or when the type has no item to preview ("No ‹type› to preview"). Under
the field, the dialog MUST say what is used instead.

#### Scenario: Empty for this article

- **WHEN** the description is linked to Summary and the previewed article has no summary
- **THEN** the box MUST say "Empty for this article", and the field MUST say "This article has no Summary, so its Body summary, else the start of its Body is used."

#### Scenario: Broken

- **WHEN** the description is linked to `field_summary` and that field was deleted
- **THEN** the box MUST show `field_summary` and "No longer exists" with a visible ×, and the field MUST say that each article uses its default description, with "Link another field"

#### Scenario: Nothing to preview

- **WHEN** the Article type has no article yet
- **THEN** each box MUST say "No article to preview"

### Requirement: The link menu offers what fits the field

The link menu MUST be a dialog named "Link ‹Field›" with a "Find a field"
filter that matches labels and values, ignoring case and accents. Each entry
MUST show its label and the previewed item's value. Entries of another kind
MUST be shown disabled with a reason, such as "An image, not text". Entries
hidden from visitors MUST be shown disabled as "Hidden from visitors". The
current entry MUST be marked.

#### Scenario: Finding Summary

- **WHEN** an editor opens the description's link menu and types "summ"
- **THEN** the Summary entry MUST be listed with the previewed article's summary as its value

#### Scenario: An image in a text menu

- **WHEN** the title's link menu is opened on a type with an image field
- **THEN** the image field MUST be listed disabled with the reason "An image, not text"

#### Scenario: Nothing found

- **WHEN** the filter matches nothing
- **THEN** the menu MUST say "No field matches “‹filter›”."

### Requirement: A reference opens as a level in the link menu

Entries that go through the same reference MUST be grouped under that
reference as a level. Opening a level MUST replace the list in place, with a
"Back to ‹Type›" button and the reference's label as a heading. A filter match
inside a level MUST be listed at the top level with its path, and MUST be
linkable from there.

#### Scenario: Writer › Name

- **WHEN** an editor opens the author name's link menu, moves to "Writer" and presses the right arrow
- **THEN** the menu MUST show a heading "Writer", a "Back to Article" button and the writer's fields, and Enter on "Name" MUST link the detail to Writer › Name

#### Scenario: A deep match

- **WHEN** an editor types "name" in the filter
- **THEN** "Writer › Name" MUST be listed at the top level and MUST be linkable without opening the level

### Requirement: Picking an entry links the value at once

Picking an entry MUST store the link in the draft at once, show the entry's
value in the box straight away, close the menu and return focus to the box. The
dialog MUST announce "‹Field› linked to ‹Source›." and the action bar MUST say
"Linked to ‹Source›" with Undo.

#### Scenario: Linking the description

- **WHEN** an editor picks Summary in the description's link menu
- **THEN** the template's draft MUST hold the link, the box MUST show the summary, and Undo in the bar MUST restore the previous value

### Requirement: Unlinking starts with an empty input

The ×, Backspace or Delete on a box, or Unlink in the menu, MUST replace the box
with an empty typed input that has focus; it MUST NOT copy the item's value
into it. A printable key on a box MUST replace it with an input holding that
key. Unlinking a link MUST offer Undo. At template scope, leaving the input
empty MUST bring back the default box.

#### Scenario: Backspace on a linked box

- **WHEN** an editor presses Backspace on the description's box linked to Summary
- **THEN** an empty textbox "Description" MUST have focus, the dialog MUST announce "Description unlinked.", and Undo MUST restore the link

#### Scenario: Unlinking a date detail

- **WHEN** an editor unlinks a structured data date detail
- **THEN** the detail MUST become the date input of its kind, empty

### Requirement: The title ending has its own menu

The ending's menu MUST be a dialog named "Title ending" with the filter "Type
an ending or find a field". It MUST offer the current ending, the Site name as
the site default, "No ending", at template scope the type's text fields, and,
for a typed filter, "Use “‹filter›” as the ending". Its footer MUST say where
the separator is set and offer Edit to administrators.

#### Scenario: Typing an ending

- **WHEN** an editor types "Blog" in the ending's menu and presses Enter on "Use “Blog” as the ending"
- **THEN** the ending MUST be "Blog", and the search preview's title MUST end with "| Blog"

#### Scenario: No ending

- **WHEN** an editor picks "No ending"
- **THEN** the title MUST have no separator and no ending

### Requirement: An image can follow each item's image field

At template scope, the Choose image sheet MUST offer "From each ‹Type›": the
type's image fields, each with the previewed item's image. Picking one MUST
link the image. Picking an image from the library MUST store that media item.
The image's link menu MUST end with "Choose from the media library…".

#### Scenario: Linking the social image to Hero

- **WHEN** an editor picks Hero under "From each Article" in Choose image
- **THEN** the social image MUST be linked to Hero, and the box MUST show the previewed article's hero image and its size

### Requirement: A read-only target shows links without changing them

When the target is read-only, a box MUST have no ×, and its menu MUST open with
every entry disabled. The box MUST stay focusable and say its source and value.

#### Scenario: A conflict

- **WHEN** the target became read-only after a conflict
- **THEN** pressing Enter on the description's box MUST open its menu with every entry disabled, and nothing MUST be written

### Requirement: Linking works by keyboard

Enter, Space and Alt+Down on a box or link button MUST open its menu with the
current entry focused. Alt+Down, or `{` in an empty input, MUST open the menu
from a typed input; `{` in a non-empty input MUST be typed. In the menu, Up,
Down, Home and End MUST move, Enter MUST link, and Escape MUST close it and
return focus to its opener.

#### Scenario: Linking by keyboard

- **WHEN** an editor focuses an empty template description, types `{`, then "summ" and Enter
- **THEN** the description MUST be linked to Summary and the box MUST have focus

#### Scenario: A brace in text

- **WHEN** an editor types `{` after other text in a typed input
- **THEN** the brace MUST be typed, and no menu MUST open
