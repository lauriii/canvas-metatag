## MODIFIED Requirements

### Requirement: What the dialog edits follows the editor's route

On a Canvas page's editor the target MUST be "This page". On a node type's Full
content template it MUST be "Every <Type>", previewed with the node the editor
previews when there is one. On any other route there MUST be no target, and the
dialog MUST show only Site settings, under the heading "Site settings", without
scope menu or tabs. When only the previewed node changes, the view MUST go to
its top, with no new target announced. Another page MUST be announced and open
at its top.

#### Scenario: Canvas's start screen

- **WHEN** the dialog is opened with no page or template in the editor
- **THEN** it MUST show Site settings with the note "Open a page or a content template to edit its SEO."

#### Scenario: Another kind of template

- **WHEN** the editor shows a template that is not a node type's Full content template
- **THEN** the note MUST say "SEO for a content type is set in its Full content template."

#### Scenario: A type without a Full content template

- **WHEN** the editor shows the Full content template route of a type that has no Full content template, with nothing to preview
- **THEN** the dialog MUST show Site settings with the note "This content type has no Full content template yet. Add one to set its SEO.", not an error

#### Scenario: An entity the editor has not loaded yet

- **WHEN** the editor is on a page route whose page it has not loaded yet
- **THEN** the dialog MUST wait for it, and MUST NOT show Site settings meanwhile

#### Scenario: From the start screen to a page

- **WHEN** the dialog is open on Canvas's start screen and the editor opens a page from Canvas's page menu
- **THEN** from the moment Site's note goes until the page is shown, the dialog MUST NOT say "Site settings" nor "Live site settings"

#### Scenario: The editor previews another node

- **WHEN** an editor picks another article in the template editor's preview picker
- **THEN** the dialog's previews and checks MUST follow that article, and the template's values MUST stay the same

#### Scenario: Another node while scrolled down

- **WHEN** the Schema view of "Every Event" is scrolled to its end and the editor previews another event
- **THEN** the Schema view MUST show its top and keep its header and values until the event's values arrive, no loading placeholder MUST appear and the tabs MUST NOT move, no "Now editing" message MUST appear, the status region MUST say nothing new while the event loads, and, while Canvas has not stored the event's draft for up to 2 seconds, no warning that the dialog cannot save MUST appear and no field MUST be disabled

#### Scenario: Typing while the new node's draft is stored

- **WHEN** an editor types into the description right after the editor previews another event, before Canvas has stored its draft
- **THEN** the change MUST reach the template's draft once it is stored, also when that takes longer than 2 seconds, and until then the status MUST say "This change could not be stored in the draft"

#### Scenario: A change left behind while the draft was missing

- **WHEN** an editor types a title on a page whose draft Canvas has not stored, opens another page and comes back before Canvas has stored it
- **THEN** once Canvas has stored it, the title MUST come back as a restored change and reach the page's draft; had the page's values changed meanwhile, the title MUST be offered instead

#### Scenario: The editor and the server name different languages

- **WHEN** a page loads while the editor and the server name different languages for it
- **THEN** the warning that SEO can't save to this page MUST show at once, saying that the editor and the server disagree about the language, and MUST NOT be held back as a draft on its way

#### Scenario: Another page

- **WHEN** the editor moves from one Canvas page to another, with the view at its top
- **THEN** the dialog MUST say "Now editing" and the other page's title, the view MUST stay at its top, and a description typed right after MUST reach the page

#### Scenario: Another page with the same title

- **WHEN** the editor moves to another page, or another language of the page, with the same title
- **THEN** the dialog MUST say "Now editing" and the title

#### Scenario: A type without content

- **WHEN** the editor shows the Announcement type's Full content template and there is no announcement yet
- **THEN** the target MUST be "Every Announcement", not Site settings

### Requirement: Switching between the target and Site

The header MUST name the current scope ("This page", "Every Article" or "Site")
on a button that opens a menu of the two scopes, each saying what it covers.
Choosing a scope MUST close any open sheet, show that scope and return focus to
the button. The target MUST be shown first when it loads. Each scope MUST
remember its own tab. Switching MUST withdraw an Undo on offer. Short of room,
the Checks button MUST give way before the scope's name.

#### Scenario: The menu's items

- **WHEN** an editor opens the scope menu on a page
- **THEN** "This page" MUST name the page, and "Site" MUST name the site with "every page, live when saved"

#### Scenario: A template's item

- **WHEN** the scope menu is opened at template scope
- **THEN** "Every Article" MUST say "Previewing" and the previewed node's name

#### Scenario: A long type name

- **WHEN** the dialog edits "Every Job posting" in Canvas's dialog, whose tabs and "2 to improve" leave too little room for the name
- **THEN** the Checks button MUST drop its words to its dot and "2", with its accessible name unchanged and a tooltip that says every count, and the scope button MUST show "Every Job posting" whole; in a wider frame both MUST be whole

#### Scenario: No room for the name

- **WHEN** the header has no room for the scope's name even with the Checks button reduced to its dot and number
- **THEN** the name MUST be shortened with an ellipsis

#### Scenario: Unsaved site changes while on the page

- **WHEN** Site has unsaved changes and the target is shown
- **THEN** the scope button MUST show a blue dot and be described as "Site has unsaved changes", and the Site item MUST read "Unsaved changes"

#### Scenario: The idle status lives in the menu

- **WHEN** no action bar is shown
- **THEN** the scope menu MUST end with the current status, for example "Draft · goes live when you publish the page"

### Requirement: The link preview

The Social view MUST open with the card a shared link shows: the site's host,
the social title and description, and the image. The card MUST be large only
when the image is at least 600 px wide and 157 px tall, the same rule as the
head's card hint (head-output). A small card MUST show the image as a square
thumbnail beside the text, no taller than the card; the caption MUST add
"Small card", and the preview's information MUST say why. The image field MUST
say where the image comes from.

#### Scenario: A small or missing image

- **WHEN** the image is under 600 px wide, under 157 px tall, or there is none
- **THEN** the card MUST be small, its caption MUST add "Small card", and "About this preview" MUST say "Small card: image under 600 px wide.", "Small card: image under 157 px tall." or "Small card: no image."

#### Scenario: The card the head asks for

- **WHEN** the image is a 400 × 400 logo
- **THEN** the card MUST be small, with a square thumbnail as tall as the card at Canvas's dialog width, and Output MUST show the card hint `summary`

#### Scenario: No social text set

- **WHEN** a page sets no social title or description
- **THEN** the card MUST show the search title and description, and the fields MUST say "Same as search title" and "Same as description"

#### Scenario: Where the image comes from

- **WHEN** no image is chosen for the page and the page has an image
- **THEN** the field MUST say "From the Image field"; with neither it MUST fall back to "Site default image", and then to "No image"

#### Scenario: A chosen image that is not public

- **WHEN** the chosen image is unpublished or not a public file
- **THEN** the field MUST say "The chosen image can't be shown publicly" and name what is used instead

### Requirement: The dialog fits small heights and zoom

The header MUST stay in place, and the view below it MUST be the only part that
scrolls. When the action bar shows, the view MUST make room for it and keep its
end, or the control just used with its message, in sight; a view at its top
stays there. In a frame up to 420 px tall, previews MUST be compacted and
suggestion lists capped to 60 % of the height; value menus follow "Value menus
stay inside the dialog".

#### Scenario: At 200 % zoom

- **WHEN** the dialog has half its normal width
- **THEN** the header MUST wrap, no element on any tab or on the Checks sheet MUST overflow sideways, a caption's previewed node MUST stay named, a caption's addition ("Not published yet", "Small card") MUST show whole or be left out and then be said in the preview's information (for the site's identity, in Checks), a small card's text MUST keep most of the card's width, "Checked against" MUST show up to two lines of the node's name, and a text cut short MUST end in an ellipsis

#### Scenario: A long node name beside an addition

- **WHEN** the editor previews "Autumn season opening (draft)", which is not published, at Canvas's dialog width
- **THEN** the search preview's caption MUST end the name in an ellipsis, or show it whole, and MUST NOT cut "Not published yet"

#### Scenario: The bar appears at the end of the view

- **WHEN** the view is scrolled to its end and the action bar appears
- **THEN** the view MUST stay scrolled to its end, above the bar

#### Scenario: The bar appears under the field in use

- **WHEN** the view is scrolled to its middle, a field sits at its lower edge, and a change to that field brings the action bar
- **THEN** the field and its message MUST be in sight above the bar

### Requirement: Value menus stay inside the dialog

A menu that lists values with their previews MUST open fully inside the
dialog, whichever column its field is in. Each entry MUST show its value
under its label across the menu's width, up to two lines, with the whole
value available on hover. Once a value is chosen, or the menu is left with
Escape, the field MUST have focus. A value MUST go in at the caret the editor
placed, else at the end. To assistive technology the menu MUST be named after
the field it fills.

#### Scenario: By keyboard alone

- **WHEN** an editor tabs into a title holding "{Page title} {Separator} Tickets", tabs to "Insert value", presses Enter and chooses a value with Enter
- **THEN** the value MUST follow "Tickets"

#### Scenario: A field in the right-hand column

- **WHEN** an editor opens the insert menu of Street address, beside Venue on "Every Event"'s Schema tab
- **THEN** the whole menu MUST be inside the dialog

#### Scenario: A double-click on the insert button in a short window

- **WHEN** an editor double-clicks "Insert value" of Street address on "Every Event"'s Schema tab in a window 1440 × 350
- **THEN** the menu MUST be open with its first entry active under the still pointer, and the second click MUST NOT insert a value, so the field stays empty

#### Scenario: A long value

- **WHEN** the menu lists the previewed event's description
- **THEN** the description MUST be shown under "Description" on up to two lines, not cut beside the label

#### Scenario: A short window

- **WHEN** the editor's window is 1440 × 350 or 1440 × 420 and an editor types "{" in the description of "Every Event"
- **THEN** the menu MUST use the frame's height from the column's left edge and be as wide as the column, with nothing of the header beside it, MUST show at least two entries whole and a part of the next one as a cue that the list goes on, MUST NOT show the keyboard hints, and its filter MUST say "Insert into Description", on screen and to assistive technology alike

#### Scenario: The arrows in a short window

- **WHEN** an editor presses the down arrow through the menu in a window 1440 × 350
- **THEN** the active entry MUST stay clear of the cue that more entries are below

#### Scenario: The filter at every height

- **WHEN** the menu is open in a window 1440 × 900
- **THEN** its filter MUST say "Insert into ‹label›" for the field it fills, as in a short window, where the menu covers the field

#### Scenario: A window resized across 420 px

- **WHEN** the window goes from 350 to 900 px tall, or from 900 to 350, while the menu is open
- **THEN** the menu MUST close at once and the field MUST have focus, holding what it held

#### Scenario: At 200 % zoom

- **WHEN** an editor opens the menu in a dialog half its normal width
- **THEN** the menu MUST NOT show the keyboard hints

#### Scenario: Typing on right after a choice

- **WHEN** an editor types "{Perfo" in the description, presses Enter and at once types " AFTER", in a window 1440 × 900, 1440 × 420 or 1440 × 350
- **THEN** the description MUST have focus with its caret after the value and read "{Performers} AFTER"

#### Scenario: Typing on right after Escape

- **WHEN** an editor types "{" in an empty description, presses Escape and at once types "x"
- **THEN** the description MUST read "x"

#### Scenario: Escape from the insert button of a field never focused

- **WHEN** an editor clicks "Insert value" of a title holding "{Page title} {Separator} Tickets" that never had focus, presses Escape and types "x"
- **THEN** the caret MUST be at the end, as for a value inserted in a field whose caret was never placed (reached by Tab, or never focused), and the title MUST read "{Page title} {Separator} Ticketsx"

#### Scenario: A group whose label has a space

- **WHEN** the menu is opened on "Every Job posting"
- **THEN** each group MUST be named by its label to assistive technology, the type's group "Job posting"

#### Scenario: A very long value

- **WHEN** the menu lists a description of 6,000 characters
- **THEN** that entry's accessible name MUST be at most its label and 150 characters of the value with an ellipsis, and its hover text MUST hold the whole value

## ADDED Requirements

### Requirement: Information buttons open on click

An information button (ⓘ) MUST show its sentence on hover and on keyboard
focus. A click or tap MUST keep the sentence shown, also one already shown by
hover or focus, and a click on a kept sentence's button MUST hide it. Escape, a
click elsewhere, scrolling and another tooltip opening MUST close it. The
sentence MUST open below its button where there is room, so that it never
covers the header. The sentence MUST also be the button's description to
assistive technology.

#### Scenario: Clicking "About this preview"

- **WHEN** an editor clicks "About this preview" while previewing an unpublished event
- **THEN** the sentence "This event isn't published yet." MUST be shown, a second click MUST hide it, and a click elsewhere MUST hide it too

#### Scenario: Clicking a sentence shown by hover

- **WHEN** an editor rests the pointer on "About this preview" until its sentence shows, then clicks it
- **THEN** the sentence MUST stay shown

#### Scenario: Keyboard

- **WHEN** an editor tabs to "About checks"
- **THEN** its sentence MUST be shown, and Escape MUST hide it
