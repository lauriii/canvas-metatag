## MODIFIED Requirements

### Requirement: What the dialog edits follows the editor's route

On a Canvas page's editor the target MUST be "This page". On a node type's Full
content template it MUST be "Every <Type>", previewed with the node the editor
previews when there is one. On any other route there MUST be no target, and the
dialog MUST show only Site settings, under the heading "Site settings", without
scope menu or tabs.

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

#### Scenario: The editor previews another node

- **WHEN** an editor picks another article in the template editor's preview picker
- **THEN** the dialog's previews and checks MUST follow that article, and the template's values MUST stay the same

#### Scenario: A type without content

- **WHEN** the editor shows the Announcement type's Full content template and there is no announcement yet
- **THEN** the target MUST be "Every Announcement", not Site settings

## ADDED Requirements

### Requirement: A content type with nothing to preview is shown read-only

When a type's Full content template has no node to preview, the dialog MUST
show the template's values at rest, read-only, with no previews, no Output and
no Checks, and MUST say "No ‹type› yet. Add one to preview and edit these
settings.". No dynamic value MUST be marked as empty; a field without a value
of its own MUST show what it inherits, also to assistive technology; a setting
MUST show its value in words.

#### Scenario: The Announcement type

- **WHEN** the Announcement template stores the title `{title} {sep} News` and the type has no content
- **THEN** the Search view MUST show that title with its dynamic values as labels, none of them marked as empty, MUST NOT offer to edit it, and MUST say "No announcement yet. Add one to preview and edit these settings."

#### Scenario: Inherited fields

- **WHEN** the Announcement template stores no description and no social title, and the type has no content
- **THEN** the description MUST show the Description value as a label, and the social title MUST say "Same as the search title", each also in the field's accessible description

#### Scenario: Settings at rest

- **WHEN** the Announcement template sets no robots directive and no structured-data type, and the type has no content
- **THEN** "Show in search results" MUST read "On" and "Text previews" "Allowed", with no switch and no menu, and the Type MUST read "None" without the hint that invites a choice

#### Scenario: Custom JSON-LD not set

- **WHEN** the Announcement template has no custom JSON-LD and the type has no content
- **THEN** the Schema view MUST show "Custom JSON-LD" as "Off" and MUST NOT open an empty editor

#### Scenario: The first announcement is added

- **WHEN** an editor adds an announcement while the dialog is open on the Announcement template, and the template editor moves to preview it
- **THEN** the open dialog MUST follow the editor to the previewed announcement and the values MUST become editable

### Requirement: The caption names an unpublished preview node

At template scope, when the previewed node is not published, the captions of
the search and link previews MUST add "Not published yet", and the
information of each MUST first say that this node is not published yet and
that values only editors can see are left out. When the template is not in use
either, the caption MUST name only the node's state, and the information MUST
add the template's.

#### Scenario: Previewing a draft event

- **WHEN** the template editor previews an event that is not published
- **THEN** the caption MUST read "Previewing" with the event's name and "Not published yet", and the information MUST start with "This event isn't published yet. Values that only editors can see are left out."

#### Scenario: Previewing a published event

- **WHEN** the template editor previews a published event
- **THEN** the caption MUST NOT say "Not published yet"

### Requirement: Output says when it is catching up

While a change is being saved, or the output after it is being read back, the
Output sheet MUST say "Updating…" by its heading, in a status that assistive
technology announces, and MUST mark its rows as not current. The words MUST
show only after 400 ms, so that a quick save stays quiet. When the read-back
arrives, the sheet MUST show the new rows without the marker.

#### Scenario: Opening Output right after an edit

- **WHEN** an editor changes the title and opens Output before the save is confirmed
- **THEN** the sheet MUST say "Updating…", and then MUST show the new title without it

#### Scenario: Nothing pending

- **WHEN** Output is opened with every change saved and read back
- **THEN** the sheet MUST NOT say "Updating…"

### Requirement: Text keeps its own direction

Every text that shows a value MUST take its direction from its own text: the
previews' title, description, address and caption, the link preview's texts,
values at rest and inherited values, and every input for free text (titles,
descriptions, names, search and filter fields). An empty input that shows an
inherited value MUST take the direction of that value. Inputs for addresses,
numbers, dates and code, and the dialog's own words, MUST keep the dialog's
direction.

#### Scenario: An Arabic description

- **WHEN** a product's description is Arabic text that ends with a full stop
- **THEN** the search preview MUST show it right to left, with the full stop at its left end

#### Scenario: A Hebrew value in an input

- **WHEN** a description input holds Hebrew text that starts with a digit, such as an ingredient count
- **THEN** the input MUST lay the value out right to left

#### Scenario: An inherited Arabic value

- **WHEN** a person's social title is not set and inherits an Arabic name
- **THEN** the empty input MUST show the inherited name right to left, as the link preview does

### Requirement: The frame uses the height of the editor's window

In the Canvas editor, the dialog's frame MUST be as tall as the editor's window
allows below the dialog's own heading, and never shorter than Canvas makes it,
so that in a window 350 px tall the view still scrolls to every field. It MUST
follow changes of the window's height. A dialog opened in a taller window MUST
move up to where Canvas opens it in the current one. When the dialog closes,
nothing of this MUST remain on the editor's page.

#### Scenario: A window 350 px tall

- **WHEN** the editor's window is 1440 x 350 and the dialog opens on a page
- **THEN** the frame MUST end inside the window, and Tab MUST reach the Title field with the field and its label whole in view

#### Scenario: A window 420 px tall

- **WHEN** the editor's window is 1440 x 420 and the dialog opens on a page
- **THEN** the Title field MUST be reachable without scrolling the editor's own page

#### Scenario: A window made short

- **WHEN** the dialog was opened in a window 900 px tall and the window becomes 350 px tall
- **THEN** the dialog MUST move up to a fifth of the window from its top, and Tab MUST reach the Title field with the field and its label whole in view

#### Scenario: A tall window

- **WHEN** the editor's window is 1600 x 1000
- **THEN** the frame MUST end inside the window and inside the dialog, and MUST NOT be shorter than Canvas makes it
