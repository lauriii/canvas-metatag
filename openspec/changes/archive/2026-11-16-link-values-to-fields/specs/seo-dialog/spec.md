## ADDED Requirements

### Requirement: The title is edited as a main part and an ending

The Title field MUST be one control in two parts: the main part, and a button
named "Title ending: ‹value›", described "Added after the separator ‹sep›."
("The title ends with its main part." for "No ending"), that shows the
separator and the ending and opens the ending's menu (value-links). The main
part MUST be a text input on a page (with Suggest when suggestions are
offered) and a value that can be linked on a template. Reset MUST remove both
parts.

#### Scenario: A page's title

- **WHEN** an editor opens the Search tab of a page on the site "Example" with the installed defaults
- **THEN** the Title field MUST be one textbox named "Title" and one button named "Title ending: Example"

### Requirement: Reset of the title says what it clears

When only the ending of a title is set, the field MUST say so ("Ending set for
every ‹Type›", "Ending set on this page") and its Reset MUST say that it goes
back to the site ending. After any Reset, the field MUST say where the value
now comes from beside Undo.

#### Scenario: Resetting a title

- **WHEN** a page sets both its main part and the ending "Docs", and the editor presses Reset beside Title
- **THEN** both parts MUST be removed, and the field MUST say "Reset ·" and where the title now comes from, with Undo

#### Scenario: Only the ending is set

- **WHEN** "Every Event" sets the ending "Tickets" and no main part
- **THEN** the Title field MUST say "Ending set for every Event", and its Reset MUST be named "Reset title ending" and say "Back to the site ending"

### Requirement: Site sets only the title ending

Site MUST set the title's ending only, as a field "Title ending" as wide as the
other controls, with no control for the main part, and an example line of a
whole title under it.

#### Scenario: The site's title

- **WHEN** an administrator opens Site
- **THEN** a field "Title ending" MUST show the ending as wide as the other controls, with no "Page title" control, the separator under it, and an example line such as "For About us: About us | Example"

### Requirement: Undo stays with what it would change

The action bar's Undo of a change to the target MUST go when the target is
published, or when another item is previewed: it would change what is now
live, or what was done for another preview.

#### Scenario: Publishing after linking

- **WHEN** an editor links "Every Article"'s description to Byline and publishes the template
- **THEN** the bar MUST NOT offer Undo for the link

### Requirement: Link menus stay inside the dialog

A menu that lists values with their previews (a link menu, the title ending's
menu) MUST open fully inside the dialog, whichever column its field is in, and
keep its side while open. Each entry MUST show its value under its label
across the menu's width, up to two lines, with the whole value available on
hover. Once a value is chosen, or the menu is left with Escape, the field MUST
have focus. To assistive technology the menu MUST be named after the field it
fills.

#### Scenario: By keyboard alone

- **WHEN** an editor tabs to the description's box of "Every Event", presses Alt+Down and then Enter on an entry
- **THEN** the description MUST be linked to that entry and its box MUST have focus

#### Scenario: A field in the right-hand column

- **WHEN** an editor opens the link menu of Street address, beside Venue on "Every Event"'s Schema tab
- **THEN** the whole menu MUST be inside the dialog

#### Scenario: A double-click on the box in a short window

- **WHEN** an editor double-clicks the box of Street address on "Every Event"'s Schema tab in a window 1440 × 350, the menu opening over the box
- **THEN** the menu MUST be open with its current entry active, and the second press MUST link nothing, wherever it lands

#### Scenario: A long value

- **WHEN** the menu lists the previewed event's description
- **THEN** the description MUST be shown under "Description" on up to two lines, not cut beside the label

#### Scenario: A short window

- **WHEN** the editor's window is 1440 × 350 or 1440 × 420 and an editor presses Alt+Down on the description's box of "Every Event"
- **THEN** the menu MUST use the frame's height from the column's left edge and be as wide as the column, with nothing of the header beside it, MUST show at least two entries whole and a part of the next one as a cue that the list goes on, MUST NOT show the keyboard hints, and its filter MUST say "Find a field", on screen and to assistive technology alike

#### Scenario: The arrows in a short window

- **WHEN** an editor presses the down arrow through the menu in a window 1440 × 350
- **THEN** the active entry MUST stay clear of the cue that more entries are below

#### Scenario: The filter at every height

- **WHEN** the menu is open in a window 1440 × 900
- **THEN** its filter MUST say "Find a field", as in a short window, and typing in it MUST NOT move it

#### Scenario: A window resized across 420 px

- **WHEN** the window goes from 350 to 900 px tall, or from 900 to 350, while the menu is open
- **THEN** the menu MUST close at once and the field MUST have focus, holding what it held

#### Scenario: At 200 % zoom

- **WHEN** an editor opens the menu in a dialog half its normal width
- **THEN** the menu MUST NOT show the keyboard hints

#### Scenario: A key right after a choice

- **WHEN** an editor presses Alt+Down on the description's box, types "Perfo", presses Enter and at once Backspace, in a window 1440 × 900, 1440 × 420 or 1440 × 350
- **THEN** the description MUST have been linked to the performer's name, Performers › Title, and Backspace MUST have unlinked it, leaving an empty description with focus

#### Scenario: Typing on right after Escape

- **WHEN** an editor types "{" in the description's empty input (after unlinking), presses Escape and at once types "x"
- **THEN** the description MUST read "x"

#### Scenario: Escape from a box

- **WHEN** an editor opens the menu from the title's box, presses Escape and at once Alt+Down
- **THEN** the box MUST have focus at once, and the menu MUST open again

#### Scenario: A group whose label has a space

- **WHEN** the menu is opened on "Every Job posting"
- **THEN** each group MUST be named by its label to assistive technology, the type's group "Job posting"

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

- **WHEN** an editor opens the link menu of Status, low on "Every Event"'s Schema tab in a window 1440 × 900 or 1440 × 600
- **THEN** the menu MUST show every entry that fits and the row of those that do not, whole

#### Scenario: Opening again after Escape

- **WHEN** an editor presses Enter on a box, Escape, Enter again, then Down and a letter
- **THEN** the menu's filter MUST have focus and hold the letter, and the box MUST keep its value

### Requirement: A link menu opens on the side with room

A menu MUST open below its field when three entries fit there, else on the
side with more room, and MUST stay inside the frame at its left and right
edges. Moving the pointer onto an entry MUST NOT scroll the list.

#### Scenario: A description in the middle of the frame

- **WHEN** an editor opens the link menu of "Every Event"'s description in a window 1440 × 900, with less room below the field than three entries need and more above
- **THEN** the menu MUST open above the field and list at least three entries whole

#### Scenario: The pointer on the last rows

- **WHEN** the title's link menu is scrolled to its end and the pointer moves onto its last row
- **THEN** the list MUST NOT scroll, and a click MUST link the row under the pointer

## MODIFIED Requirements

### Requirement: Each field shows what it inherits

A field without a value of its own MUST show the value it inherits, in grey, and
say where it comes from on hover or focus: "Set on this page", "Set for every
<Type>", "From the <language> version", "Site default", or what it falls back
to. When the value comes from the site and the editor may administer site
settings, the field MUST offer "Edit", which leads to that setting in Site.

#### Scenario: An untouched title

- **WHEN** a page has no title of its own
- **THEN** the main part MUST show the page's title in grey, and the ending MUST show the site's ending and say "Site default"

#### Scenario: Edit the site default

- **WHEN** an administrator presses "Edit" beside the title of a page whose ending is inherited, by mouse or by keyboard
- **THEN** the dialog MUST switch to Site, scroll to its title ending and put focus on it

### Requirement: The search result preview

The Search view MUST open with a search result at true size: the site's logo, or
its first letter, and name, the page's address as a breadcrumb, then the title
and the description, cut where a result on a phone cuts them. It MUST follow
typing. Its address MUST use Canvas's live URL alias while that differs from
the saved one.

#### Scenario: Typing a title

- **WHEN** an editor types "Pricing plans" into the title of a page whose ending is the site's name "Example"
- **THEN** the preview MUST show "Pricing plans | Example"

#### Scenario: A new alias in Page data

- **WHEN** an editor changes the page's URL alias in Canvas and has not saved it
- **THEN** the preview's address MUST show the new alias

#### Scenario: No description

- **WHEN** the page has no description
- **THEN** the preview MUST say "Search engines will pick text from the page."

#### Scenario: Text previews off

- **WHEN** nosnippet is set or the text limit is zero
- **THEN** the preview MUST say "No description: text previews are off"

#### Scenario: A canonical address elsewhere

- **WHEN** the page has a canonical address other than its own
- **THEN** the preview MUST say "Search engines are asked to show" that address "instead."

#### Scenario: The caption

- **WHEN** the page is not published, or is hidden from search
- **THEN** the caption MUST add "Not published yet" or "Hidden from search"; at template scope it MUST read "Previewing" with the node's name, and "Template not in use yet" while unpublished

### Requirement: Preview and fields point at each other

Clicking a part of a preview MUST put focus in the field that sets it. Focusing a
field MUST highlight its part of the preview. The title's main part and its
ending MUST each highlight only their own words.

#### Scenario: Clicking the preview's title

- **WHEN** an editor clicks the title in the search preview
- **THEN** the Title field MUST have focus

#### Scenario: Focusing the ending

- **WHEN** an editor focuses the title ending button, or opens its menu
- **THEN** only the separator and the ending MUST be highlighted in the search preview

#### Scenario: Clicking the title of a template

- **WHEN** an editor of "Every Event", whose title follows its default, clicks the title in the search preview
- **THEN** the Title box MUST have focus

### Requirement: Values equal to what is inherited are not stored

Clearing a text field, or leaving only white space in it, MUST remove the
override. A switch, a select or an image set to the value it would inherit MUST
store nothing, so it keeps following its source. Choosing the site's ending in
the title ending's menu MUST store nothing. A link MUST be stored even when it
gives the same value as the default. Text MUST be kept as typed, trailing spaces
included.

#### Scenario: A switch turned off and on again

- **WHEN** an editor turns "Show in search results" off and on again on a page that inherits it
- **THEN** the page MUST store no visibility setting

#### Scenario: Linking the default source

- **WHEN** an editor links "Every Article"'s title main part to the Title fact, which is its default
- **THEN** the template MUST store the link, and the field MUST offer Reset

### Requirement: Content type settings are previewed with a node

At template scope, values MAY be linked to the content type's fields
(value-links), and previews, checks and Output MUST use the node the editor
previews.

#### Scenario: A title bound to a field

- **WHEN** an editor links "Every Article"'s title main part to Byline
- **THEN** the preview MUST show the previewed article's byline followed by the ending, and the template's draft MUST hold the link

### Requirement: The caption names an unpublished preview node

At template scope, when the previewed node is not published, the captions of
the search and link previews MUST add "Not published yet", and the
information of each MUST first say that this node is not published yet and
that its fields are read with the editor's access until visitors can see it.
When the template is not in use either, the caption MUST name only the node's
state, and the information MUST add the template's.

#### Scenario: Previewing a draft event

- **WHEN** the template editor previews an event that is not published
- **THEN** the caption MUST read "Previewing" with the event's name and "Not published yet", and the information MUST start with "This event isn't published yet. Its fields are read with your access until visitors can see it."

#### Scenario: Previewing a published event

- **WHEN** the template editor previews a published event
- **THEN** the caption MUST NOT say "Not published yet"

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
- **THEN** "Show in search results" MUST read "On" and "Text previews" "Allowed", with no switch and no menu, and the Type MUST read "None" without the hint that invites a choice

#### Scenario: Custom JSON-LD not set

- **WHEN** the Announcement template has no custom JSON-LD and the type has no content
- **THEN** the Schema view MUST show "Custom JSON-LD" as "Off" and MUST NOT open an empty editor

#### Scenario: The first announcement is added

- **WHEN** an editor adds an announcement while the dialog is open on the Announcement template, and the template editor moves to preview it
- **THEN** the open dialog MUST follow the editor to the previewed announcement and the values MUST become editable

### Requirement: Text keeps its own direction

Every text that shows a value MUST take its direction from its own text: the
previews' title, description, address and caption, the link preview's texts,
values at rest in boxes and link menus, and every input for free text (titles,
descriptions, names, search and filter fields). An empty input's placeholder
MUST take the direction of the inherited value. Inputs for addresses, numbers,
dates and code, and the dialog's own words, MUST keep the dialog's direction.

#### Scenario: An Arabic description

- **WHEN** a product's description is Arabic text that ends with a full stop
- **THEN** the search preview MUST show it right to left, with the full stop at its left end

#### Scenario: A Hebrew value in an input

- **WHEN** a description input holds Hebrew text that starts with a digit, such as an ingredient count
- **THEN** the input MUST lay the value out right to left

#### Scenario: An inherited Arabic value

- **WHEN** a person's social title is not set and follows its default, an Arabic name
- **THEN** the default box MUST show the name right to left, as the link preview does

#### Scenario: A linked Arabic value

- **WHEN** "Every Product"'s description is linked to a field and the previewed product's value is Arabic
- **THEN** the linked box MUST show it right to left

## REMOVED Requirements

### Requirement: Typing into an inherited page title keeps the site's pattern

**Reason**: A page's title is now only its main part; the ending is inherited
from the site and never copied into the page's value.

**Migration**: Stored page titles are split by the update (dynamic-values).
Typing into the title stores only the typed words; see "The title is edited as
a main part and an ending".

### Requirement: Dynamic values are chips

**Reason**: There are no chips. A value is typed text or linked to one source,
shown as a linked box (value-links).

**Migration**: Linking is done with the link icon by the label or from the box
(value-links). Stored values are converted by the update (dynamic-values).

### Requirement: A chip is one unit

**Reason**: There are no chips. Typed values are plain inputs, which take plain
text on one line; Enter submits nothing (see "The dialog works by keyboard").

**Migration**: None.

### Requirement: A chip field says what it becomes

**Reason**: A linked box always shows the source and the previewed item's value
(value-links).

**Migration**: None.

### Requirement: Value menus stay inside the dialog

**Reason**: The insert menu, its chips and its caret rules are gone with
values in braces. Its rules for staying inside the dialog, short frames, the
keyboard and long values now apply to the link menu.

**Migration**: "Link menus stay inside the dialog" (above).
