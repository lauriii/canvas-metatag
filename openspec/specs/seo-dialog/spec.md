# seo-dialog

## Purpose

Let editors set a page's or a content type's search, social and structured data
settings inside the Canvas editor, next to a true-size preview of what search
engines and shared links will show, and let site administrators set the
site-wide defaults from the same place. Nothing typed is lost when the dialog
closes or the editor moves on.

## Requirements

### Requirement: The dialog opens in the editor and follows it

The module MUST add an "SEO" extension to the Canvas editor that opens in a
dialog frame titled "SEO". The same frame MUST follow the editor from page to
page and template to template until it is closed or a side-menu item is
clicked. When the editor moves on, the dialog MUST show the new target,
announce "Now editing" with its name, and keep the selected tab.

#### Scenario: The editor switches to another page

- **WHEN** the dialog is open on one page and the editor opens another
- **THEN** the dialog MUST stay open and show the other page's settings, with "Now editing" and its name in the action bar

#### Scenario: While the first answer loads

- **WHEN** the dialog is opened on a page and the server has not answered yet
- **THEN** the dialog MUST show a placeholder search result with the page's address and Canvas's description, under "This page"

### Requirement: Editors always get the current build

The extension's address MUST carry a version derived from the built
`extension/index.html`, so that a new build is never served from a browser
cache that still holds the old one.

#### Scenario: An updated module

- **WHEN** the module is updated with a new build of the dialog
- **THEN** the extension's address MUST change, and editors MUST get the new build

### Requirement: Focus moves to the dialog once

When the frame opens, focus MUST move to the scope button once, without a focus
ring until a key is pressed. It MUST NOT move again without a user action, also
when the editor moves on.

#### Scenario: Opening the dialog

- **WHEN** an editor opens the dialog with a pointer
- **THEN** the scope button MUST have focus, and no focus ring MUST show until a key is pressed

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

### Requirement: The dialog respects permissions

Without "Edit SEO settings in Canvas" or "Administer SEO site settings" the
dialog MUST offer nothing. Without "Edit SEO settings in Canvas", or without
edit access to the page or template, the target MUST be read-only. Without
"Administer SEO site settings", Site MUST be read-only and have no Save.

#### Scenario: No SEO permission

- **WHEN** an editor without either permission opens the dialog
- **THEN** it MUST say "SEO is not available" and "You don't have permission to edit SEO settings.", with no tab and no field

#### Scenario: No edit access to the page

- **WHEN** the editor may view a page's SEO settings but not change them
- **THEN** the fields MUST be disabled, with the note "You can view these settings but not change them."

#### Scenario: Edit permission only

- **WHEN** an editor with "Edit SEO settings in Canvas" only switches to Site
- **THEN** every Site field MUST be disabled, no Save MUST be shown, and the note MUST say "Only people who administer SEO site settings can change these. You are viewing them."

#### Scenario: The settings cannot be loaded

- **WHEN** loading fails for another reason
- **THEN** the dialog MUST say "SEO settings couldn't load" and offer "Try again"

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

### Requirement: The target has three views; Site has one

The target MUST have the tabs Search, Social and Schema, and a Checks button.
Site MUST be one view without tabs. Every view MUST open scrolled to its top,
where its preview is, when the tab or the scope changes.

#### Scenario: Opening the Social tab

- **WHEN** an editor selects Social
- **THEN** the view MUST start with the link preview, followed by the image, title and description fields

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

### Requirement: Previews show the server's text once settled

While edits are unsaved, previews MUST be computed in the dialog from the working
values and Canvas's live title and description. Once nothing is unsaved and
Canvas's inputs are what the server saw, the texts MUST be the server's own.

#### Scenario: After a confirmed save

- **WHEN** an edit has been saved and confirmed
- **THEN** the search preview's title MUST be the title the server resolves for the draft

### Requirement: Output shows the exact head

Each preview MUST offer "View output", and the Schema view "Code", which open
the Output sheet. It MUST list, value by value and whole, the tags the server
resolves for the target, draft included: title, description, robots and
canonical first, then the rest as emitted. It MUST offer "Copy tags",
confirmed with "Copied".

#### Scenario: After publishing

- **WHEN** a page is published and its Output sheet is opened
- **THEN** its rows MUST equal the head an anonymous visitor gets

#### Scenario: Where addresses come from

- **WHEN** an editor opens "About addresses" in the Output sheet
- **THEN** it MUST name the public address in use and say whether it comes from the site's settings file, the headless frontend, or the address the editor is signed in at

#### Scenario: A headless frontend

- **WHEN** addresses come from a headless frontend
- **THEN** the sheet MUST say that the frontend decides what reaches visitors

#### Scenario: No page to resolve

- **WHEN** the server returned no head
- **THEN** the sheet MUST say "There is no page to show output for."

### Requirement: Output outlines the structured data

The Output sheet's structured data section MUST list the graph's nodes as an
outline, main node first, each with its name, type, `@id` and origin,
left-out and retired nodes with their reason, then the formatted JSON behind
"Show JSON-LD". It MUST offer "Copy structured data", confirmed with
"Copied", and "Test this page".

#### Scenario: The outline

- **WHEN** a product page with a hand-added FAQ is opened in Output
- **THEN** the list "Structured data" MUST start with the product node tagged "Main", and the FAQ row MUST say "Not shown since 7 May 2026" and "Added by hand"

#### Scenario: Testing a draft

- **WHEN** the target has unpublished changes and the editor presses "Test this page"
- **THEN** the structured data MUST be copied and the dialog MUST say "Copied. Paste the code into the test."

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

### Requirement: A page's description is Canvas's own field

At page scope the Description field MUST be Canvas's Page data description,
labelled "Also in Page data". While it has focus, the previews MUST follow it
and nothing MUST be sent. On blur, or Ctrl/Cmd+Enter, the text MUST be handed
to Canvas once, which saves it with its Page data. When Canvas cannot take it,
the field MUST return to Canvas's value.

#### Scenario: Typing a description

- **WHEN** an editor types a new description and leaves the field
- **THEN** Canvas's Page data description MUST hold the text, and Canvas MUST save it at most twice, never once per key

#### Scenario: A template's description

- **WHEN** the target is a content type
- **THEN** its description MUST be a value of the template, like its title

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

### Requirement: Reset and Undo

A field with a value of its own MUST offer "Reset", whose tooltip says what it
returns to. After a reset, the field MUST say "Reset ·" with "Undo" for six
seconds, and focus MUST stay in the field. Fixes and restored changes MUST offer
Undo in the action bar. The next edit, or a scope switch, MUST withdraw an Undo.

#### Scenario: Resetting the only change

- **WHEN** a page's only draft change is its title and the editor resets it
- **THEN** the field MUST show the inherited title, the page's draft change MUST go away, and the status MUST return to "Matches the published page"

#### Scenario: Undo a reset

- **WHEN** the editor presses Undo beside the reset field
- **THEN** the field MUST hold what was reset again

### Requirement: Title and description lengths are guidance

While the title or the description has focus, its field MUST show the resolved
length and "Fits in results", or "May be cut off after" the last words that fit.
Length MUST be estimated with the font sizes and widths of search results, for
desktop and for phones. Unmeasurable text MUST show its character count only.
Length MUST NOT be a warning at rest.

#### Scenario: A long title

- **WHEN** an editor focuses a title wider than a desktop result
- **THEN** the field MUST say where it may be cut off

#### Scenario: An empty description

- **WHEN** an editor focuses an empty description
- **THEN** the field MUST say "Empty. Search engines will pick text from the page."

### Requirement: Search visibility in plain words

The Search view MUST show visibility as one switch, "Show in search results",
and an "Advanced" row with "Follow links", "Text previews" (Allowed, Limited,
Off), "Image previews" (Large, Standard, None) and, for a page, "Canonical
address". Advanced MUST summarise what is set, and start open when something
is set or an issue is about one of its rows.

#### Scenario: Hiding a page

- **WHEN** an editor turns "Show in search results" off
- **THEN** the row MUST say "Hidden · noindex", and a notice MUST say "Hidden from search engines · set on this page" with "Show in search"

#### Scenario: Nothing advanced set

- **WHEN** links are followed, text previews are allowed, image previews are large and no canonical address is set
- **THEN** Advanced MUST be closed and summarised as "Defaults"

#### Scenario: A typed address

- **WHEN** an editor types a canonical address or a character limit
- **THEN** it MUST be taken when the field is left or Enter is pressed, not per key

### Requirement: Page and template settings save into the draft by themselves

Page and template settings MUST be saved into the target's Canvas draft without
a Save button, 400 ms after the last edit, and at once when the frame loses
focus or the browser leaves the page. When the editor moves to another target,
or the page is left while a write is in flight, the waiting change MUST be sent
once more in a way that outlives the frame. Each write follows draft-writes.

#### Scenario: Saved into the draft

- **WHEN** an editor changes a page's title
- **THEN** the status MUST show "Saving…", then "Saved to draft" for two seconds, then "Draft · goes live when you publish the page", and Canvas MUST list the page among its changes

#### Scenario: Closed inside the save delay

- **WHEN** an editor changes the title and closes the dialog at once
- **THEN** the change MUST reach the draft, and reopening MUST show it without offering it again

#### Scenario: Moving on mid-edit

- **WHEN** an editor changes a page's title and the editor opens another page before the write
- **THEN** the change MUST be saved to the first page, and the other page MUST be unchanged

### Requirement: The status says where the settings stand

The dialog MUST have one status, with a glyph beside the scope button: a spinner
while saving, a check once saved, a lock when read-only. For the target it MUST
say whether it is saving, saved, a draft, the same as published, unpublished or
read-only. For Site it MUST say whether the settings are live, unsaved, saving
or saved.

#### Scenario: Matches the published page

- **WHEN** a published page has no draft change
- **THEN** the status MUST say "Matches the published page" (for a template, "Matches the published template")

#### Scenario: An unpublished target

- **WHEN** a page or template was never published and has no draft change
- **THEN** the status MUST say "Not published yet · search engines can't see this page" or "Template not published yet · not in use"

#### Scenario: A translation's draft

- **WHEN** the Finnish translation of an English page has a draft change
- **THEN** the status MUST say "Draft of the Finnish version · goes live with the English version"

#### Scenario: Site settings at rest

- **WHEN** Site is shown with no unsaved change
- **THEN** the status MUST say "Live site settings"

### Requirement: An action bar only when a button is needed

An action bar MUST float over the end of the view only while a button is needed
(Undo, Show, Try again, Discard, Save, Hide site) or a passing message is shown.
A jump's "Moved to" message MUST NOT show it. When a pressed button goes away,
focus MUST move to the button now in its place, else to the scope button from
the bar, or to the first field from a notice.

#### Scenario: Nothing to do

- **WHEN** a page's settings match the published page
- **THEN** no action bar MUST be shown

### Requirement: Refused fields keep what was typed

When the server refuses a field, the field MUST show the reason as an alert and
keep the typed text, while the field is written at its last saved value
(draft-writes). The status MUST count the fields that need attention, with
"Show" leading to the first.

#### Scenario: One invalid field among valid ones

- **WHEN** an editor types an unknown value into the title and changes the description
- **THEN** the description MUST be saved, the title MUST show why it was refused, and the status MUST say "1 field needs attention · other changes saved"

#### Scenario: The same refusal again

- **WHEN** a write is refused again for the same fields
- **THEN** the status MUST say "· other changes not saved"

### Requirement: Save failures are explained

A failed write MUST be explained in the status, and the typed text MUST stay in
the dialog.

#### Scenario: No connection

- **WHEN** the server does not answer
- **THEN** the status MUST say "Couldn't save · your changes are kept here" with "Try again"

#### Scenario: Signed out

- **WHEN** the session has ended
- **THEN** the status MUST say "You've been signed out. Sign in again in another tab, then try again."

#### Scenario: Overwritten five times

- **WHEN** editor saves overwrote the dialog's write five times in a row
- **THEN** the status MUST say "This change could not be stored in the draft" with "Try again"

### Requirement: A conflict makes the target read-only

When another session or tab has changed the target's draft, or the editor itself
reports a conflict, the target MUST become read-only with an alert and "Reload
editor", until the editor is reloaded. Fields MUST stay readable and the
previews MUST keep working.

#### Scenario: Another session saved first

- **WHEN** another session writes the page's draft and the editor's next save is refused
- **THEN** the dialog MUST say "This page was changed somewhere else. What you typed is kept.", offer "Reload editor", and disable the page's fields

### Requirement: An unreadable editor makes the target read-only

When the editor's state cannot be read safely, the target MUST be read-only with
an alert and "Reload editor", and the status MUST say "Read-only". Site settings
MUST still save.

#### Scenario: The editor cannot be read

- **WHEN** the editor's state is not available to the dialog
- **THEN** the dialog MUST say "SEO can't save to this page right now. Site settings still work.", the previews MUST still show the page, and a Site change MUST still save

#### Scenario: Two languages

- **WHEN** the editor and the server name different languages for the page
- **THEN** the alert MUST add "The editor and the server disagree about the language being edited."

### Requirement: Notices above the view

The dialog MUST show at most two notices above the view, in this order: a
conflict, an unreadable editor, the target hidden from search, an earlier
unsaved change. Only the last MAY show at Site scope. The hidden notice MUST say
where noindex is set and follow the working values. It MUST offer "Show in
search" only when noindex is set on the target and the target can be written.

#### Scenario: Hidden by the site

- **WHEN** a page is hidden by the site's defaults
- **THEN** the notice MUST say "Hidden from search engines · set for the whole site", with no button

#### Scenario: Hidden by configuration

- **WHEN** no SEO setting hides the page but a configuration override makes its robots tag say noindex
- **THEN** the notice MUST say "Hidden from search engines · set in site configuration outside SEO", with no button

#### Scenario: Turned back on

- **WHEN** an editor presses "Show in search" on a page hidden by its own setting
- **THEN** the notice MUST go away at once, before the write returns

### Requirement: Unsaved changes survive closing the dialog

Every edit MUST be kept for the browser tab until saved. When the dialog opens
again, a kept change MUST be dropped when the server already has it, restored
when the same user made it against the same values, and offered otherwise.
Nothing offered MUST be written until "Use it", which applies it on top of
today's values as an ordinary edit. One change MUST be offered at a time.

#### Scenario: Restored

- **WHEN** an unsaved change of the same user, made against the same values, is found
- **THEN** it MUST be applied, and the bar MUST say "Restored a change that hadn't been saved" with Undo

#### Scenario: Discarded in "Review changes"

- **WHEN** an editor's saved change is discarded in Canvas's "Review changes" and the dialog is opened again
- **THEN** a notice MUST say "An earlier change wasn't saved:" with the fields' names, "Discard" and "Use it", and the page's draft MUST stay empty

### Requirement: Site settings save explicitly and apply at once

Site changes MUST NOT be saved until "Save", or Ctrl/Cmd+Enter. While unsaved,
the bar MUST say "Unsaved changes · not live yet" with "Discard" and "Save".
Discard MUST return to the saved settings, with Undo. Refused Site fields MUST
show their reasons and stay unsaved. Unsaved Site changes MUST survive the
editor moving on and the dialog closing.

#### Scenario: Saving

- **WHEN** an administrator presses Save
- **THEN** the status MUST say "Saved · live now" for two seconds, then "Live site settings"

#### Scenario: A side-menu click closes the dialog

- **WHEN** an administrator changes the site's name and a side-menu click closes the dialog
- **THEN** reopening MUST show the changed name, still unsaved, with Save

#### Scenario: The editor moves on

- **WHEN** the editor opens another page while Site has unsaved changes
- **THEN** the Site changes MUST stay, unsaved

### Requirement: Hiding the whole site is confirmed

Turning off "Show in search results" at Site MUST replace Save with "Hide site",
next to "Discard", and say "This asks search engines to drop every page."
Ctrl/Cmd+Enter MUST NOT hide the site.

#### Scenario: Hiding the site

- **WHEN** an administrator turns off "Show in search results" at Site
- **THEN** the bar MUST offer "Discard" and "Hide site", and no "Save"

#### Scenario: The shortcut

- **WHEN** the administrator then presses Ctrl+Enter
- **THEN** nothing MUST be saved

### Requirement: Content type settings are previewed with a node

At template scope, values MAY be linked to the content type's fields
(value-links), and previews, checks and Output MUST use the node the editor
previews.

#### Scenario: A title bound to a field

- **WHEN** an editor links "Every Article"'s title main part to Byline
- **THEN** the preview MUST show the previewed article's byline followed by the ending, and the template's draft MUST hold the link

### Requirement: Translations are edited where the editor edits them

On a site with more than one language, the scope button MUST show a page's
language code, and the scope menu MUST say which version is edited and what it
shares with the others. Values inherited from the default-language version MUST
say so. Which translation is edited is page-seo.

#### Scenario: Editing a translation

- **WHEN** the editor edits the Finnish translation of an English page
- **THEN** the scope menu MUST say "Editing the Finnish translation"

#### Scenario: An inherited image

- **WHEN** a translation inherits its social image from the English version
- **THEN** the image field MUST say "From the English version"

### Requirement: Sheets cover the view

Checks, Output, Choose image and Add your own JSON-LD MUST open as sheets
that cover the dialog, with "Back" and a title. Only one MUST be open at a
time, and the view behind it MUST be out of reach. Escape or Back MUST go up
one level in a sheet that has levels, and otherwise close it and return
focus to what opened it, else to the scope button.

#### Scenario: Escape from Checks

- **WHEN** an editor opens Checks with Enter and presses Escape
- **THEN** the sheet MUST close, and focus MUST be back on the Checks button

### Requirement: The dialog works by keyboard

Every control MUST work by keyboard. The tab list MUST be one Tab stop, with
arrow keys, Home and End, followed by the Checks button, then the view. Enter
MUST NOT submit, reload or navigate. Escape MUST close the innermost of a menu,
a select, a suggestions tray or a sheet.

#### Scenario: Tabs by keyboard

- **WHEN** the Search tab has focus and the editor presses the right arrow twice, then Home
- **THEN** Social and then Schema MUST be selected in turn, and Search MUST have focus again

#### Scenario: Enter in a title

- **WHEN** an editor presses Enter in the Title field
- **THEN** nothing MUST be submitted and the editor MUST NOT reload

### Requirement: The dialog works with assistive technology

The status and passing messages MUST be announced through one polite live
region. Field errors and notices that block writing MUST be alerts; the other
notices MUST be polite. Each preview MUST be one image to assistive technology,
named with what it shows once typing has paused for a second. The dialog MUST have no serious or
critical accessibility violation on any tab or on the Checks sheet.

#### Scenario: A hidden page's preview

- **WHEN** a hidden page's search preview is read out
- **THEN** its name MUST start with "Not shown in search results."

#### Scenario: An automated scan

- **WHEN** each tab and the Checks sheet are scanned for accessibility
- **THEN** no serious or critical violation MUST be found

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
- **THEN** "Show in search results" MUST read "On" and "Text previews" "Allowed", with no switch and no menu, and "What this page is" MUST read "A web page" with no sheet to open

#### Scenario: Custom JSON-LD not set

- **WHEN** the Announcement template has no custom JSON-LD and the type has no content
- **THEN** the Schema view MUST NOT offer "Add your own JSON-LD" and MUST NOT open an empty editor

#### Scenario: The first announcement is added

- **WHEN** an editor adds an announcement while the dialog is open on the Announcement template, and the template editor moves to preview it
- **THEN** the open dialog MUST follow the editor to the previewed announcement and the values MUST become editable

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

### Requirement: The Schema view opens on what search engines read

The Schema view MUST open with a stage captioned "Understood as" holding one
to three plain sentences built only from the structured data the target
ships, then one line per search feature, then one line saying whether the
facts match the page. schema.org type and property names MUST NOT appear in
the view outside Output.

#### Scenario: A product page

- **WHEN** a page is a product named "Oak desk lamp" at 89 EUR, in stock, bought on this page
- **THEN** the stage MUST read "Oak desk lamp, a product sold by Humanify Studio for €89, in stock."

#### Scenario: A clause with nothing behind it

- **WHEN** the product's "Bought on this page" is unset
- **THEN** the sentence MUST NOT say "sold by", because the graph has no seller

#### Scenario: A monthly price stored without its billing

- **WHEN** a product's price is 2500 and no billing is set
- **THEN** the sentence MUST say "for €2,500" with no period

### Requirement: Each fact in the sentence leads to where it is set

Each fact in the read-back MUST be a button named "‹Label›, ‹value›, ‹where
it is set›" ("Price, €89, set on this page", "Seller, Humanify Studio, from
Site"). Pressing it MUST focus its field, or go to Search, Social or Site
when the value is set there. The facts MUST be one group: Tab enters it,
the arrow keys move inside it, Tab leaves it.

#### Scenario: The seller

- **WHEN** an editor presses "Humanify Studio" in a product's sentence
- **THEN** the dialog MUST switch to Site with the identity name field in view

#### Scenario: Keyboard

- **WHEN** focus is on the first fact and the editor presses the right arrow
- **THEN** focus MUST move to the next fact, and Tab MUST move to the first feature line

### Requirement: A required fact from a default opens its own field

When a fact that a feature of the kind requires comes from a default, pressing
it MUST open that fact's own field in place, out of More details, and focus
it. While its value follows the page title, the field MUST say "Now the page
title" with a secondary "Edit in Search".

#### Scenario: A page title as an event name

- **WHEN** an event's name follows the page title and the editor presses it in the sentence
- **THEN** focus MUST land on the Schema view's Name field, which says "Now the page title" with "Edit in Search"

### Requirement: A product named after its page is said

On a page, a product or service name equal to the page title MUST carry the
hint "The name is the page title. Give the product its own name.", with
"Edit in Search" while it follows the title. At template scope a name that
follows each item's own title MUST NOT carry it.

#### Scenario: A page title as a product name

- **WHEN** a product's name follows the page title "Shop our lamps" and the editor presses it in the sentence
- **THEN** focus MUST land on the Schema view's Name field, not on Search's title, and the field MUST show the hint and "Edit in Search"

#### Scenario: Every Product

- **WHEN** "Every Product" names each product after its own title
- **THEN** no hint and no Checks row MUST ask for another name

### Requirement: One line per search feature

Under the sentence, captioned "In search results", the stage MUST show one
line per verdict (search-features), at most four, ordered: needs, only if
people buy it here, can show, complete, doesn't fit, not shown here, retired,
no search feature. Each feature's line MUST be a button named after the
feature and its verdict, and MAY carry a separate fix button for the first
missing fact; "No search feature" is plain text. A verdict that changes, in
its words, MUST be announced once.

#### Scenario: A profile

- **WHEN** a page is a person's profile and its profile verdict is given on the page node
- **THEN** the stage MUST show that one line, and no "No search feature" beside it

#### Scenario: The line's name

- **WHEN** the merchant listing does not fit a monthly price
- **THEN** its line MUST be named "Merchant listing doesn't fit: a recurring price"

#### Scenario: Needs an image

- **WHEN** a product bought here has no image
- **THEN** the stage MUST show "Merchant listing" with "Needs an image" and a "Choose" button that opens the image chooser with the page's own images first

#### Scenario: A fix button's name

- **WHEN** the event result needs a city
- **THEN** its fix button MUST be named "Add City", after the fact it sets

#### Scenario: The fix applies nothing by itself

- **WHEN** the page shows an image and the product has none
- **THEN** no button MUST set that image as the product image in one click

#### Scenario: The change is announced

- **WHEN** the editor chooses an image and the verdict becomes "Can show"
- **THEN** the status region MUST say "Merchant listing can show" once

### Requirement: A verdict opens its proof

Pressing a feature line MUST open a proof named after the feature: where the
feature appears in one plain sentence, each required fact with its value or
a button to set it, at most four facts that also help each with its own
"Add", at most two guidelines no machine checks, and the rules' review date
with a link to the feature's documentation.

#### Scenario: Merchant listing needs an image

- **WHEN** the editor opens the merchant listing proof of a product without an image
- **THEN** it MUST list Name, Price and Bought on this page with their values as their fields show them, and Image as "Not set" with "Choose", and say "Your product in shopping results, with its price and stock."

#### Scenario: Focus on open

- **WHEN** the editor opens a proof by keyboard
- **THEN** focus MUST land on the proof's title, not on one of its actions, and every action in it MUST show the dialog's focus ring

#### Scenario: A withheld event

- **WHEN** an event with a start date, a city and a country but no street address is withheld and the editor opens its proof
- **THEN** the proof MUST show the start date, and "Not set" only for the street address

#### Scenario: Doesn't fit

- **WHEN** the editor opens the merchant listing proof of a monthly membership
- **THEN** it MUST say that shopping listings are for things people buy and own, and suggest Plans for a service

### Requirement: What this page is

The first field MUST be "What this page is", reading the kind in plain words
("A product people buy", "Plans for a service", "An article", "An event people
attend in person", "A person's profile", "A web page"). It MUST open a sheet
listing each kind with what it is for and what it can earn. Retired features
MUST NOT be kinds.

#### Scenario: The kinds sheet

- **WHEN** an editor opens "What this page is"
- **THEN** a radio group "What is this page?" MUST list the six kinds, and under "A product people buy" say it is not for services, memberships or subscriptions

#### Scenario: A blog post

- **WHEN** the stored type is Blog post
- **THEN** the kind MUST read "An article" with "Kind of article: Blog post" under it, and the "Kind of article" choice MUST be in More details

### Requirement: The kind always reads what search engines get

"A web page" MUST be a kind the editor can choose. The field and the kinds
sheet MUST always show the kind that is output, marked "Default" when it is
inherited, never an empty or "Choose" state, read-only included. Choosing
the inherited kind MUST show it as chosen.

#### Scenario: A new page

- **WHEN** an editor opens Schema on a page with no stored type
- **THEN** the field MUST read "A web page" and the kinds sheet MUST have "A web page" selected and marked "Default"

#### Scenario: Back to a web page

- **WHEN** an editor changes an article to "A web page"
- **THEN** the field MUST read "A web page", the output graph MUST have no main node, and after the draft is saved and the dialog reopened the field MUST still read "A web page"

#### Scenario: A translation of an article

- **WHEN** a translation's default-language version is an article and the editor chooses "A web page"
- **THEN** the translation MUST store `WebPage` and its output MUST be a web page while the default-language version stays an article

### Requirement: Changing the kind names what is removed

When choosing another kind would remove values set here, the dialog MUST
say which values, with their values, and that Undo brings them back, and
change the kind only when the editor confirms. The confirm MUST stay in
sight at the foot of the kinds sheet however far it is scrolled, and MUST
NOT cover the list; in a frame too short to hold both, it follows the list.
While it waits, its buttons MUST be the next stops after the list. Until
then the field MUST show the current kind.

#### Scenario: A product becomes an event

- **WHEN** a product with a typed price of 120 EUR is changed to an event
- **THEN** the dialog MUST say "Changing to an event removes the price (€120) you set. Undo brings it back." with "Change to an event" and "Keep a product"

#### Scenario: An event becomes an article

- **WHEN** an event with a start on 12 May 2027 at 18:00, an end and a venue is changed to an article
- **THEN** the removed values MUST be named in the form's order, each as its field shows it: "the start (12 May 2027, 18:00), the end (…) and the venue (…)", followed by "Undo brings them back."

### Requirement: Facts follow what the features need

After the kind, the view MUST show at most four facts the kind lists first,
which MUST include those its features require that nothing fills by default
and those that decide whether a feature fits. The rest MUST be behind one
"More details" disclosure, open when one of them holds a value of its own or
a problem. A required fact that resolves empty MUST show its guidance at
rest, and a field MUST show the Checks about itself.

#### Scenario: A product

- **WHEN** a page is a product
- **THEN** Price, Currency, Bought on this page and Image MUST come before More details

#### Scenario: Guidance at rest

- **WHEN** a product bought here has no image
- **THEN** the Image field MUST say "Needed for merchant listings" without being focused

### Requirement: A membership is offered its honest kind

When a product's price is billed every month or year, the kind field MUST say
"Memberships and subscriptions are services." with "Change to plans for a
service", which changes the kind and keeps the name, price, currency and
billing.

#### Scenario: Today's pricing page

- **WHEN** a product named "Studio membership" is billed every month and the editor presses "Change to plans for a service"
- **THEN** the kind MUST be Plans for a service with the same name, price and billing, and the stage MUST read "No search feature"

### Requirement: The stage says whether the facts are on the page

The stage MUST end with one line: the facts set here match the page,
nothing is set here to compare, the most serious fact not found on the page
with its fix and "Show" in its Checks tone, or no preview to check against.
Hand-added text to fix MUST mark "Added by hand" in the to-fix colour. It
MUST compare text, prices with their currency and period, dates, images and
ratings, never codes or identifiers.

#### Scenario: A price shown per month

- **WHEN** the page shows "€2,500 / month" and the product's price is 2500 with no billing
- **THEN** the line MUST say "Couldn't find €2,500 as a one-time price on this page: it says €2,500 a month."

#### Scenario: The same amount in another currency

- **WHEN** the page shows "$2,500" and the product's price is 2500 EUR
- **THEN** the line MUST say "Couldn't find €2,500 on this page: it says $2,500." and lead to Currency

#### Scenario: Nothing set here

- **WHEN** a page sets no structured data facts and no JSON-LD of its own
- **THEN** there MUST be no match line, since nothing of the editor's is there to compare

#### Scenario: A number that is not a price

- **WHEN** the page says "2,500 customers" and nowhere shows a price of 2500
- **THEN** the price MUST count as not found

### Requirement: Your own JSON-LD lives behind Code

The stage MUST have a "Code" button that opens Output. Custom JSON-LD MUST be
edited in a sheet titled "Add your own JSON-LD", opened from Output or from
the sentence's "Added by hand" part, and MUST NOT have a row in the Schema
view. Its items MUST read back as "Added by hand: ‹items›.", each by its name,
its feature or a plain word ("a review"), and get verdicts, also in the
sheet's list of items. Closing the sheet MUST return focus to what opened the
first sheet.

#### Scenario: Pages that had custom JSON-LD

- **WHEN** a page with custom JSON-LD is opened for the first time in this browser, in the first release with this change
- **THEN** a notice MUST say "Custom JSON-LD moved to Code › Add your own JSON-LD" with a button that opens that sheet, and MUST NOT be shown again when the page is opened again

#### Scenario: Inline checks

- **WHEN** the sheet holds an `Organization` named like the site's identity
- **THEN** it MUST say "This is your site's organization. Point to it with “@id”: “‹home›#identity” instead.", with the site's home address in place of ‹home›

### Requirement: An unknown stored kind is said

When the stored type is not in the registry, the view MUST show the notice
"This page was described as “‹type›”, which this site no longer knows. Search
engines get a plain web page." with "Choose what it is", and the kind field
MUST read "Not known: “‹type›”".

#### Scenario: A removed type

- **WHEN** a page's stored type is `Movie`
- **THEN** the notice MUST be shown and Checks MUST list one issue to improve

### Requirement: A sentence without a translation is a list

When the dialog's language has no translation for a kind's sentence, the stage
MUST show the facts as a list of label and value instead of a sentence.
Prices and dates MUST be formatted in the dialog's language.

#### Scenario: An untranslated sentence

- **WHEN** the dialog is in Finnish and the product sentence has no Finnish translation
- **THEN** the stage MUST list "Nimi · Oak desk lamp" style rows and no English sentence

### Requirement: A nested object is one line that opens a sheet

A group of more than three parts MUST show as one summary box holding its
formatted line, or "Not set", with a chevron, named by its label and then
what it reads. Pressing it MUST open a sheet with a plain "Reads as" line
that says what the box says (a page named as the group, once), then the
parts in the shape's order. The sheet has no Save button. Its header MUST
offer Clear, or "Unlink all" on a template when every set part is linked;
either leaves focus on the sheet's title.

#### Scenario: A venue on an event page

- **WHEN** an editor presses the Venue box reading "Riverside Hall, Helsinki"
- **THEN** a sheet titled "Venue" MUST open with focus on its title, listing Name, Street address, Postal code, City, Region and Country in that order
- **AND** Escape MUST close it and return focus to the Venue box

#### Scenario: An address without a country

- **WHEN** a venue has a street and a city but no country
- **THEN** the Venue field MUST say "Add the country, so the address can be used." with an "Add" button named "Add Country", as the verdict's is, that opens the sheet on Country, and the sheet MUST say the same sentence once under "Reads as"

### Requirement: A group's sheet says what it misses once

What the group misses, and those of its values the page does not show, MUST
be said once under "Reads as", never under each part. While the group's page
reference is set, its own parts MUST wait folded under "Own details, if the
page has none", which reads them as the box would, or "Not set".

#### Scenario: A workplace page linked

- **WHEN** a builder opens the Workplace sheet with a workplace page linked
- **THEN** its own parts MUST be folded under "Own details, if the page has none", reading "Not set" and closed while none is set

### Requirement: What a group misses is said under it

What a group misses MUST be said under its box, in one sentence with what a
search feature asks more of it ("Add the city and the country for event
listings."). A jump to a missing part (Add in a verdict, Show in Checks, a
part of the sentence) MUST open the group's sheet with focus on that part's
own control, never its link button, and Back MUST return to where the jump
came from, else to the group's box.

#### Scenario: A country written as a name

- **WHEN** a venue's country is stored as "Finland", which the list does not hold
- **THEN** its box and its sheet MUST say "Choose the country from the list." with a "Choose" button, and the event result MUST read "Needs a country from the list"

#### Scenario: Add Country in the verdict

- **WHEN** an event's venue misses its country and the editor presses the verdict's "Add Country"
- **THEN** the Venue sheet MUST open with focus on Country

### Requirement: A part held back is set

In a verdict's proof, a part that is set but left out with its incomplete
group MUST read as its value and why it waits, never "Not set".

#### Scenario: A street without a city

- **WHEN** an event's venue has a name and a street, and no city or country
- **THEN** the event result's proof MUST read "Street address: Mannerheimintie 13e · left out until the address is complete", with Add only beside City and Country

### Requirement: A reference is chosen, never typed as data

An organizer, employer, author or the organization a person works for MUST
be one select: "Not set" where nothing is assumed, "‹Site› (this site)",
and "Someone else", which reveals a name and a website indented under it,
shown as "Name" and "Website" and named "‹Label› name" and "‹Label›
website". The site or a linked reference field MUST hide them. On a template
the choice MAY be linked to a reference field instead; the site chosen there
leaves focus on its linked box.

#### Scenario: Someone else organizes

- **WHEN** an editor chooses "Someone else" for the organizer
- **THEN** "Organizer name" and "Organizer website" MUST appear under it with focus on "Organizer name", and the organizer MUST be emitted with that name only once it is typed

### Requirement: Who nobody chose is said

An organizer or recipe author MUST default to the publisher on a Canvas
page, where the select has no "Not set"; choosing "Someone else" there MUST
be kept, so that the site is no longer assumed, and nothing is emitted until
a name is typed. Where nobody set it but a default names someone (an
article's author), "Not set" MUST read that name: "‹Name› (the page's
author)", and More details MUST name it first.

#### Scenario: Someone else, not named yet

- **WHEN** an editor of an event page chooses "Someone else" and types nothing
- **THEN** no organizer MUST be emitted, Checks MUST not say "The organizer is your site", and the choice MUST still read "Someone else" when the dialog opens again

#### Scenario: An article's author

- **WHEN** a page described as an article has no author set and its author is Ada Lovelace
- **THEN** the Author select MUST read "Ada Lovelace (the page's author)" and More details MUST start with "Author: Ada Lovelace"

### Requirement: A reference to another page is linked on a template

A reference to another page (a venue page, a workplace page) MUST be linked
to a reference field on a template. It is not offered on a Canvas page until
the page picker ships (`link-groups-and-pick-pages`); until then a page
pick is refused at save.

#### Scenario: A venue on a Canvas page

- **WHEN** an editor opens the Venue sheet of an event page
- **THEN** it MUST offer the venue's name and address, and no box for a venue page

### Requirement: Codes are picked from a searchable list

A country, a currency or another code list MUST open a picker with a "Find
a ‹thing›" filter matching the label, the code and the English name, an
exact code first. With no filter, the site's default MUST come first,
marked Suggested. Several codes MUST use checkbox rows that commit on each
toggle, announce the new total and keep their order while the list is open.
Six or fewer choices that are not codes MUST be checkbox rows in place.

#### Scenario: Who can apply from

- **WHEN** an editor ticks Estonia after Finland and Sweden
- **THEN** the screen reader MUST hear "Estonia selected, 3 chosen" and the footer MUST read "3 chosen · up to 50"

#### Scenario: A code typed

- **WHEN** an editor types "FI" in the country picker and presses Enter
- **THEN** Finland MUST be chosen, not Fiji, and focus MUST be on the Country box

### Requirement: A picker stays in its frame

A picker MUST never be taller than the room on its side of the box, with its
filter in sight and only its list scrolling. Picking one code MUST give the
box focus back.

#### Scenario: A short window

- **WHEN** the window is 350 px high and an editor opens the Country picker
- **THEN** the "Find a country" filter MUST be inside the dialog's frame

### Requirement: A duration is one box with two numbers

A duration MUST be one box with two number inputs and their unit words
(hours and minutes), with empty slots rather than zeros. Minutes past 59
MUST carry into hours when focus leaves the box, and the value is checked
only then: moving from hours to minutes never refuses it. Zero MUST be
refused with "Leave it empty if you don't know it.", more than 30 days with
"Use at most 30 days.". Each input MUST be named by the field and its unit.

#### Scenario: Ninety minutes typed

- **WHEN** an editor types 90 in the minutes of Prep time and leaves the field
- **THEN** it MUST read 1 h 30 min and store 90

### Requirement: A linked duration reads in its unit

A linked duration MUST read in its unit ("20 min"), and the question of what
its field counts MUST be a compact choice named by its time and what it
shows.

#### Scenario: Prep time linked

- **WHEN** a builder links Prep time to a field holding 20 for the previewed recipe
- **THEN** the box MUST read "20 min" and the choice beside it MUST be named "Prep time: the field counts minutes"

### Requirement: Opening hours are edited as a week

Opening hours MUST read as one grouped line with any special days counted,
and open a sheet that says the same line as "Reads as", then seven day rows,
each on one row: its name, its times, then a status select named
"‹Day› status" (Open, Closed, Open 24 hours). Its header MUST offer Clear. A
new week MUST be all closed, and opening a day MUST fill in no times. "Use for Tue–Fri" MUST
appear under Monday once Monday has both times and Tuesday to Friday are
closed.

#### Scenario: The weekday shortcut

- **WHEN** Monday is Open 09:00–17:00, Tuesday to Friday are closed and the editor presses "Use for Tue–Fri"
- **THEN** Tuesday to Friday MUST read Open 09:00–17:00, focus MUST be on Tuesday's status, and "Tuesday to Friday set to 09:00–17:00" MUST be said

#### Scenario: Overlapping times

- **WHEN** Monday has 09:00–13:00 and 12:00–17:00
- **THEN** the row MUST say "Times overlap." and nothing MUST be stored

### Requirement: The week never loses focus or its words

A button that takes itself away MUST hand focus on: "Use for Tue–Fri" to
Tuesday's status, adding a second range to its opening time, removing one
to that day's +, adding a special day to that day's status. At 200 % zoom a day's name MUST keep its word and its times
MUST stay in the frame.

#### Scenario: A second range

- **WHEN** an editor adds a second range on Monday, then removes it
- **THEN** focus MUST be on "Monday, second opens", then on "Add a second range on Monday"

### Requirement: Only what the scope can fill is offered

A Schema view MUST show only the facts its scope can fill. "Also helps"
lines MUST list only facts offered on that scope. A fact that belongs to
another fact ("Open to people in", under where the work is) MUST show
indented under it, and only while the answer calls for it. More details
MUST name a default the editor may need to change first ("Organizer: your
site, summary, 5 more"). At most four facts MUST come before More details; a
choice of who, and a detail shown under another, count as one.

#### Scenario: A recipe on a Canvas page

- **WHEN** a Canvas page is described as a recipe
- **THEN** the view MUST show no Ingredients or Steps field and no "Also helps" line for them

#### Scenario: A remote job

- **WHEN** every job of a type is fully remote
- **THEN** "Open to people in" MUST be under Where the work is, no Workplace MUST be shown, and at most four facts MUST come before More details

### Requirement: Where the work is is one question

A job posting MUST ask "Where the work is" with On site, Fully remote, and
On site or remote. On site and On site or remote MUST show the Workplace;
Fully remote and On site or remote MUST show "Open to people in". Its
guidance MUST belong to this one question.

#### Scenario: An on-site job

- **WHEN** a builder answers On site
- **THEN** the Workplace box MUST show and "Open to people in" MUST not

### Requirement: A detail a field fills is a box that opens the link menu

A detail only a field fills (a job description, or what each page has of its
own on a template) MUST be a box the size of an input reading "Link a
field…", named by its label, that opens the link menu.

#### Scenario: A job description

- **WHEN** a builder presses the Description box of Every Job posting
- **THEN** the link menu MUST open, listing the formatted text fields

### Requirement: A linked list says how many it gives

A list linked to a field of several values MUST read its first item and how
many more at rest.

#### Scenario: Ingredients linked

- **WHEN** Ingredients link to a field holding four ingredients for the previewed recipe
- **THEN** the box MUST read "500 g rye flour and 3 more"

### Requirement: A kind chosen is said until it can be one

While the main thing of a chosen kind is left out, the sentence MUST say so
after what it reads, in gray, naming what it needs.

#### Scenario: A job type chosen, not complete yet

- **WHEN** a builder chooses "A job posting" and nothing is linked yet
- **THEN** the sentence MUST end "Not a job posting yet: it needs a description and an employer." in gray, in the words Checks asks for them

### Requirement: Add details opens from a node in Output

Each module node in Output's outline that accepts details MUST offer "Add
details", opening a sheet titled "Add details to ‹name›" that names the node's
type and `@id` and says that values from the page always win, in one line.
Before saving it MUST show what will be added, each clash and the merged
node's verdicts, in both tabs. It MUST be the same editor as "Add your own
JSON-LD" with the type fixed.

#### Scenario: Details on a template

- **WHEN** an editor opens Output on the Product template
- **THEN** the main thing's button MUST say "Add details to each product", as the sheet's title does

#### Scenario: Details of the site's organization

- **WHEN** a site editor adds a description to the site's organization from a page's Output
- **THEN** the sheet MUST say "Site settings: live on every page once saved.", and the Site view's Identity group MUST say "Added details: Description" with a way back to the sheet

#### Scenario: Adding details to a product

- **WHEN** an editor types details with `sku`, `offers.price` and `offers.itemCondition` for a product whose price comes from its Price field
- **THEN** Form MUST say "Adds SKU and Item condition." and the price row "Your “79” isn't used."; JSON MUST say "Adds sku and offers.itemCondition." and mark the line of `offers.price` amber with "comes from the Price field, so it isn't changed here."

#### Scenario: A clash on an object

- **WHEN** an editor adds `{"offers": {"seller": {"name": "Acme"}}}` to a product whose seller comes from the page
- **THEN** JSON MUST mark the line of `offers.seller` amber with "comes from the page, so it isn't changed here. Its other details are added."

#### Scenario: Details the page already gives

- **WHEN** an editor opens Add details on a product in Form
- **THEN** the price MUST show read-only with "From the Price field", and "Add a detail" MUST NOT offer it
- **AND** when the added details also give a price, it MUST say "Your “79” isn't used." under the page's value, and the row's menu MUST offer to remove it
- **AND** no read-only row MUST carry advice to link it to a field

### Requirement: Hand-written JSON-LD gets name feedback

Both expert sheets MUST point out a property or value name that differs from
a documented name of a search feature for that type only by spelling or
case, with the documented name. When the site has the schema.org
vocabulary, they MUST also point out names that aren't details of the type.
This feedback MUST be advice that never blocks a save.

#### Scenario: A misspelt availability

- **WHEN** a hand-added product's offer says `"availability": "Instock"`
- **THEN** the sheet MUST say "“Instock” isn't a value search engines document for availability. Did you mean “InStock”?" with "Use InStock"

#### Scenario: A misspelt detail with the vocabulary

- **WHEN** the vocabulary is installed and a hand-added employer rating has `ratingcount`
- **THEN** the sheet MUST say "ratingcount isn't a detail of an employer rating. Did you mean ratingCount?" in amber, and the item MUST still save

### Requirement: A hand-added item can be marked as the main thing

In "Add your own JSON-LD", on a plain web page, each item MUST offer "This is
what the page is mainly about"; choosing it on an item without an `@id`
MUST give the item one first. On pages of any other kind the toggle MUST NOT
be shown.

#### Scenario: A product page

- **WHEN** the page's kind is "A product people buy"
- **THEN** no item MUST offer the toggle

### Requirement: Verdicts follow the editor's typing

Verdicts of hand-added items MUST update in their sheet while the editor
types, without waiting for the draft write, and MUST agree with the server's
once it answers. Verdicts of added details and the stage's follow the draft
write: they depend on what the page and its site give. A review or rating of
the site's own organization MUST read "Doesn't fit: a review of your own
organization" as soon as it points at it.

#### Scenario: Filling a rating

- **WHEN** an editor types 318 into "Ratings" of a hand-added employer rating that has a rating value and an organization
- **THEN** its line MUST read "Can show" before the draft write finishes

### Requirement: Your own JSON-LD is a form or JSON over one text

"Add your own JSON-LD" and "Add details" MUST offer two tabs, "Form" and
"JSON", in a tab list named "Edit as", over the same stored text. Switching
MUST NOT change a byte. A form edit MUST change only the bytes of its value.
Form MUST be the default, and the last tab chosen MUST be remembered for that
viewer. The JSON tab MUST show exactly the stored text.

#### Scenario: Switching back and forth

- **WHEN** an editor fills an employer rating in Form, switches to JSON and back, and saves
- **THEN** the stored text MUST be the text the JSON tab showed, byte for byte

#### Scenario: Keys the form doesn't know

- **WHEN** the stored item has a key `x-internal` and the editor changes its rating value in Form
- **THEN** `x-internal` MUST keep its place and value, and only the rating value's bytes MUST change

#### Scenario: Switching keeps the place

- **WHEN** the caret is on the `ratingValue` line in JSON and the editor activates "Form"
- **THEN** focus MUST stay on the tab, the Rating value row MUST be scrolled into view and briefly highlighted, and "Form, Rating value" MUST be announced

### Requirement: The sheet goes up one level at a time

The sheet's levels (all items, choosing a type, one item, the paste review)
MUST share the header's Back, named for where it goes ("Back to all items"),
and Escape MUST do the same, wherever focus is. Entering a level MUST focus
its heading or its first control. Back MUST close the sheet only at the top
level, in JSON, or from another sheet's entry point. Focus MUST return to the
control that opened the level. A sheet with one item MUST open on it.

#### Scenario: Opened from Output

- **WHEN** an editor opens "Add details" from Output and presses Escape
- **THEN** Output MUST show, Back MUST have been named "Back to Output", and focus MUST be on the button that opened the sheet

#### Scenario: Back from an item

- **WHEN** an editor opens one of three items and presses Escape
- **THEN** the item list MUST show with focus on that item's row, and a second Escape MUST close the sheet

#### Scenario: From "Something else on this page"

- **WHEN** an editor opens the type search from "What this page is" › "Something else on this page" and presses Back
- **THEN** Back MUST have been named "Back to What this page is", and that sheet MUST show again

### Requirement: Choosing a type

An empty sheet MUST open on "What is it?" with the placeholder "Search types,
like rating or event". Each result MUST show a plain label, the schema.org
name in monospace and one line about it, and types with a live search
feature MUST come first, tagged "Search feature" in gray when the list also
holds types without one. Types of retired features MUST NOT be tagged or
suggested. A name that isn't a type MUST be offered as "Use “‹text›” as the
type".

#### Scenario: Searching for a rating

- **WHEN** an editor types "rating"
- **THEN** "Employer rating" MUST be first, tagged "Search feature", with `EmployerAggregateRating` and "A company's rating by the people who work there."

#### Scenario: A schema.org name typed exactly

- **WHEN** an editor types "Rating"
- **THEN** "Rating" MUST be first; before anything is typed, the suggestions MUST read in alphabetical order

#### Scenario: A made-up type

- **WHEN** the vocabulary is installed and an editor chooses "Use “Gizmo” as the type"
- **THEN** the item MUST say "Not a schema.org type. Search engines may ignore it." and its values MUST be edited by their shape

### Requirement: Type search steers to what the page already does

A type that is a kind of page MUST be offered first as "This page can
describe itself as ‹a recipe›, with its own fields and checks." with "Use
What this page is" and "Add by hand anyway". A type the page already is MUST
offer "Add details to ‹name›". A page or site type MUST offer to make the
page itself that type through Add details.

#### Scenario: A recipe

- **WHEN** an editor on a plain web page types "recipe"
- **THEN** the first row MUST be the kind, tagged "Page kind", with "Use What this page is" and "Add by hand anyway"

#### Scenario: A Q&A page

- **WHEN** an editor types "question" and chooses "Q&A page"
- **THEN** the sheet MUST say "This makes the page itself a Q&A page." with "Make this page a Q&A page", which MUST add `QAPage` to the page node's types and open a new question as the main thing

### Requirement: A type opens with only what its search features need

An item MUST show, in order: its verdicts; "Needed for ‹feature›" with an
empty row only for what a live feature needs, an either-or need as one group
with one sentence; "Also set" with every other value in the text's order;
"Also helps" with at most four Add buttons; "Add a detail", one search over
every other detail. A type with no feature MUST show no empty rows.

#### Scenario: An employer rating

- **WHEN** an editor chooses "Employer rating"
- **THEN** the item MUST show three needs, "Item reviewed", "Rating value" and the group "Rating count or review count" with "Fill one, so the rating can show.", then "Also helps" with "Best rating" and "Worst rating"

#### Scenario: A type with no search feature

- **WHEN** an editor chooses "Book"
- **THEN** the item MUST say "No search feature. Search engines and other tools can still read it.", offer "Suggested: Name, Description, Image, URL", and show no empty row

#### Scenario: A need with its condition

- **WHEN** an employer rating has everything it needs
- **THEN** its line MUST read "Can show" with "Only if visitors can post ratings on this site"

### Requirement: Details the form doesn't expect are kept

Keys that aren't details of the item's type MUST show under "Not expected on
‹a book›", and names schema.org doesn't have under "Not schema.org names,
kept as written", each editable by the shape of its value. A key that belongs
to a more specific type MUST offer that type. Changing the type MUST keep
every value.

#### Scenario: A cuisine on a local business

- **WHEN** a hand-added `LocalBusiness` has `servesCuisine` and the vocabulary is installed
- **THEN** it MUST show under "Not expected on a local business" with "servesCuisine is a detail of a restaurant." and "Change the type to Restaurant"

#### Scenario: Changing the type

- **WHEN** an editor changes an employer rating with two details a rating doesn't have to "Rating"
- **THEN** the sheet MUST say "2 details aren't expected on a rating. They're kept, and search features may ignore them." with "Remove them" and "Keep them"

### Requirement: A detail that is an item points before it describes

A detail that takes an item MUST offer, in a menu, the site's own items,
this page, its main thing and other hand-added items that fit what the
detail expects and are on the page, then "Describe it here" and "Just a
name". "Describe it here" MUST open the item in place under its label. A
module item MUST show read-only with "Add details to ‹name›".

#### Scenario: Describing another company

- **WHEN** an editor chooses "Describe it here" under Item reviewed and types "Acme Logistics"
- **THEN** the organization MUST be stored inside the rating, not as its own item, and MUST NOT count toward the 10 items

#### Scenario: A second item points at it

- **WHEN** another item chooses "Acme Logistics (described in Employer rating)" in its menu
- **THEN** the organization MUST become its own item with an `@id`, both MUST point at it, and the bar MUST say "Acme Logistics is now its own item so both can use it." with "Undo"

#### Scenario: Only a name where an item is needed

- **WHEN** the menu under an employer rating's Item reviewed is open
- **THEN** "Just a name" MUST say "Employer rating can't show with only a name."

#### Scenario: A left-out main thing

- **WHEN** the page's main node is withheld
- **THEN** "This page's main thing" MUST be disabled with "The main thing is left out on this page"

### Requirement: Every value has a control that keeps its shape

Each value MUST get a control from what its detail expects and its actual
JSON shape, and the shape MUST win, so no value is converted until edited. A
date and time MUST store the offset of its chosen time zone for that date.
An address MUST be a text input. A value the detail doesn't expect MUST say
"Not what ‹label› expects (‹a number or text›). Kept as written."

#### Scenario: A summer date in Helsinki

- **WHEN** an editor sets an event start of 10 July 2026, 09:30, in the zone Helsinki (the site's zone is the default)
- **THEN** the text MUST hold `2026-07-10T09:30+03:00` and the row MUST say "Written as 2026-07-10T09:30+03:00 (Helsinki, summer time)"

#### Scenario: A rating written as a percentage

- **WHEN** a pasted `ratingValue` is "85%"
- **THEN** the row MUST show "85%" as text, with no decimal advice, and the text MUST be unchanged

#### Scenario: A number as text

- **WHEN** a pasted `ratingValue` is the string "4.2"
- **THEN** it MUST stay a string until the editor changes it

### Requirement: Lists keep their order and positions

A detail with several values MUST stack them with "Remove" each and "Add
another"; any detail MUST offer "Add another value". Values MUST move with
"Move up" and "Move down", never by dragging only. In a list whose items
carry `position`, moving MUST renumber the positions in the same step.

#### Scenario: Reordering a list

- **WHEN** an editor moves the third item of an `itemListElement` up
- **THEN** the items MUST swap places and their `position` values MUST read 1, 2, 3 in the new order

#### Scenario: Positions out of order

- **WHEN** a pasted list has positions 1, 3, 3
- **THEN** the sheet MUST say "Positions aren't 1, 2, 3 in order." in amber with "Number them in order"

### Requirement: A paste is cleaned up and reported

A paste into an empty box, over all of it, between items, or containing a
script tag MUST be cleaned up: script tags, a schema.org context, `@graph`,
lists of items, empty values and unnamed items MUST become plain items. One
line MUST say what changed, with "Undo clean-up", which MUST restore the exact paste.
The editor MUST stay on the tab they pasted in. "Paste JSON-LD" MUST be
offered in Form.

#### Scenario: A script tag with a graph

- **WHEN** an editor pastes a `<script type="application/ld+json">` holding `@context` and an `@graph` of two items into an empty JSON box
- **THEN** the box MUST hold the two items, formatted, and say "Cleaned up the paste: took it out of its script tag, split the graph into 2 items and removed the context line." with "Undo clean-up"

#### Scenario: Pasting in Form

- **WHEN** an editor uses "Paste JSON-LD" in Form with a clean snippet of one rating
- **THEN** the sheet MUST stay in Form, open that item and show the clean-up line

#### Scenario: A broken script tag

- **WHEN** an editor pastes into an empty sheet a chat answer whose script tag holds JSON with a trailing comma
- **THEN** the box MUST hold only what was inside the script tag, shown in JSON at its problem with "Remove the comma", and nothing MUST be saved until it is fixed

#### Scenario: Not JSON-LD

- **WHEN** the paste is HTML with only microdata
- **THEN** the sheet MUST say "No JSON-LD found in what you pasted. Microdata isn't imported."

### Requirement: A paste that copies the page is reviewed

A paste with an item the page already makes, more than 10 items or more than
32 KB MUST open "Add from your paste", listing each item with its sentence,
a tick and its reason, and add only on "Add ‹n› items". Links to unticked
items the module makes MUST point at the module's items. It MUST say "The
pasted text isn't kept. Only the items you add are saved."

#### Scenario: A whole graph copied from another site

- **WHEN** the paste holds a website, a web page, the site's organization and an employer rating
- **THEN** only the rating MUST be ticked; the organization MUST say "This is your site's organization. Links to it will point to yours."; the website and the web page "Already made by this page."
- **AND** a pasted web page whose `@id` or `url` is this page's own MUST instead say "The page itself: add to it with Add details in Output"

#### Scenario: Links to nothing

- **WHEN** an unticked item that the page doesn't make is referenced by a ticked one
- **THEN** the review MUST say "1 link will point at nothing" before "Add 1 item"

### Requirement: Problems name the line, the path and the fix

In JSON each problem MUST read "Line ‹n› · ‹path›: ‹what is wrong›." on the
line where the fix goes, with at most one fix and "Go to line ‹n›". In Form a
problem MUST show under its row in the row's words, with its fix, and mark
the row's box. Red MUST be exactly what the server refuses and MUST block
saving; advice MUST be amber and MUST NOT block. At most three MUST be
listed, then "and ‹n› more".

#### Scenario: A problem in Form

- **WHEN** an editor types "photo.jpg" as an image in Form
- **THEN** the row MUST say "Use the full address." in amber under its box, with no "Use https://…" (offered only for text that reads as a host), and no line number
- **AND** a problem no row shows MUST be listed above the form with "Show in JSON"

#### Scenario: A refusal the server sent

- **WHEN** a write of the text is refused with `error_paths`
- **THEN** the sheet MUST show the server's sentence in red at that place

#### Scenario: A missing comma

- **WHEN** line 6 is `"ratingValue": 4.2` and line 7 starts another key
- **THEN** the sheet MUST say "Line 6 · ratingValue: a comma is missing after 4.2." with "Add the comma"

#### Scenario: An address without a scheme

- **WHEN** `sameAs` is "acme-logistics.example"
- **THEN** the sheet MUST say "Line 15 · itemReviewed › sameAs: use the full address." in amber with "Use https://acme-logistics.example", and saving MUST NOT be blocked

#### Scenario: A pasted context left in by hand

- **WHEN** the box holds an item with `@context` set to another vocabulary
- **THEN** the sheet MUST show a red problem on that line with "Remove the context", which removes it and the problem; "Clean up" MUST be offered only when it takes the problem away

#### Scenario: Over the shared size

- **WHEN** the page's other hand-added texts take 14 KB and this one 20 KB, minified
- **THEN** the sheet MUST show "34 KB. Keep under 32 KB, including added details." in red, and the text MUST NOT be sent

### Requirement: The JSON box explains the value under the caret

The JSON tab MUST be a native text box named "JSON-LD" with line numbers,
"Format" and "Copy". Under it one line MUST say "Line ‹n› · ‹path› ·
‹Label›: ‹what it expects›" and offer "Edit in form", named with that place.
A linked value MUST say what it is linked to and its previewed value. The
box MUST say "Saves when you leave the box (‹Ctrl›+Enter)".

#### Scenario: The caret on a rating value

- **WHEN** the caret is in `4.2` on line 6
- **THEN** the line MUST say "Line 6 · ratingValue · Rating value: a number, like 4.2" and "Edit in form" MUST be named "Edit in form: Rating value, line 6", its visible words first

#### Scenario: Copy

- **WHEN** an editor presses "Copy"
- **THEN** the stored text MUST be copied and "Copied" shown, with the hint "Copies what you wrote. Output has it filled in for this page."

### Requirement: Text with a problem is kept, never sent

Text with a red problem MUST NOT be sent. It MUST be kept for that page or
template and language when the editor goes back, follows another page or
closes the dialog, for at most three days in that browser, and the item, the
stage's "Added by hand" line and Checks MUST say "Not saved". Reopening it MUST say "You left JSON-LD with a problem
on line ‹n› unsaved." with "Restore" and "Discard".

#### Scenario: Closing with a problem

- **WHEN** an editor leaves a missing comma on line 9, closes the dialog and reopens it on the same page
- **THEN** the sheet MUST offer "Restore", which MUST bring back the text with its problem

#### Scenario: Stored before a rule

- **WHEN** a page's stored hand-added JSON-LD has an item the server now refuses (`1e400`)
- **THEN** the sheet MUST say "Your stored JSON-LD has a problem on line ‹n›, so that item is left out of the page." with "Show it", which shows the text as written with its problem, and "Leave it out"

#### Scenario: The form can't read it

- **WHEN** the JSON has a syntax problem and the editor activates "Form"
- **THEN** Form MUST say "The form can't read this JSON: line 9 has a problem. Nothing is lost." with the fix and "Go to line 9"

### Requirement: Hand-added items are listed as sentences

With two or more items the sheet MUST list each as a sentence built from its
own values, a type line with its `@id` and the tags "Main", "Left out" and
"Not saved", at most two verdict lines, and a menu: "Show in JSON", "Show in
Output", "Change type", "Leave out of the page" or "Put back", and "Remove
item". "Add an item" and "Paste JSON-LD" MUST follow the list.

#### Scenario: An employer rating in the list

- **WHEN** the sheet holds an employer rating of Acme Logistics, 4.2 from 318 ratings
- **THEN** its row MUST read "Acme Logistics as an employer: 4.2 out of 5 from 318 ratings."

#### Scenario: At the limit

- **WHEN** the page has 10 hand-added items
- **THEN** "Add an item" MUST be disabled with "10 items is the most one page can have. Remove one to add another."

### Requirement: Template values in hand-added items can be linked

On a content template, each value in a hand-added item MUST offer a link
button, a linked box and a link menu of the type's fields with the previewed
item's values, and the sheet MUST say which item it previews ("In search
results, for ‹title›" and the link menu's "For ‹title›"). A typed name,
headline, date, price or image MUST say "The same ‹label› on every ‹Type›.
Link it to a field instead." with "Link it" when the type has a field of a
fitting kind. Verdicts MUST be the previewed item's.

#### Scenario: No fitting field

- **WHEN** a hand-added review on the Product template has a typed rating value, and the only number field is Price
- **THEN** no "Link it" advice MUST be shown, and the link menu MUST list Price under "Other fields" in the same menu, never in a submenu

#### Scenario: Linking a score

- **WHEN** an editor links Rating value to the Score field on the Book review template
- **THEN** the box MUST read "Score" with the previewed review's value, and the JSON MUST hold `"{field.field_score}"`

#### Scenario: Linking a text field to an author

- **WHEN** an editor links Author's name to the Byline text field
- **THEN** the JSON MUST hold `{"@type": "Person", "name": "{field.field_byline}"}` and the row MUST say "Linked as a person's name"

#### Scenario: A name inside text

- **WHEN** a value is `By {field.field_byline}`
- **THEN** the sheet MUST say "This name is only filled when it is the whole value." in amber

### Requirement: Each translation has its own hand-added items

Each translation MUST edit its own hand-added items. An empty translation
whose source has items MUST offer "Copy from ‹English›", which MUST keep
their `@id`s and mark typed text "Translate this" until it is edited. On a
site with more than one language, typed text in a template's hand-added item
MUST say "The same text goes on every language. Link it to a field so each
translation gets its own."

#### Scenario: Copying to French

- **WHEN** an editor opens the French translation of a page whose English version has two hand-added items and presses "Copy from English"
- **THEN** the French sheet MUST hold both items with the same `@id`s, each typed text marked "Translate this"

### Requirement: The kinds sheet leads to hand-added items

The last row of the "What this page is" sheet MUST be "Something else on
this page", described "A rating, a review, a discussion… Add it as its own
item.", and MUST open "Add your own JSON-LD" on choosing a type. It MUST NOT
change the page's kind.

#### Scenario: Looking for a rating

- **WHEN** an editor opens "What this page is" and chooses "Something else on this page"
- **THEN** "Add your own JSON-LD" MUST open with focus in "What is it?", and the kind MUST be unchanged

### Requirement: The sheet works in a short frame

At 350 px tall the JSON box MUST keep at least 160 px, the clean-up line
MUST be one line with its Undo, the verdicts MUST sit under the box as one
collapsed line, and an item's type line MUST carry its verdict. At 200 %
zoom the tabs MUST move to a second header row and either-or pairs MUST
stack.

#### Scenario: A short frame

- **WHEN** the dialog is 468 × 350 px with a pasted item in JSON
- **THEN** the box MUST be at least 160 px tall and every control MUST be reachable without the page scrolling sideways

### Requirement: Without the full list of types

Without the site's vocabulary, type search MUST list the module's kinds and
the types its rules document and say "Only types with a search feature are
listed. Type an exact schema.org name to use another; the form still edits
it." and "A site administrator can add the full list." Other types MUST be
edited by shape. JSON MUST NOT wait for the vocabulary.

#### Scenario: A long-tail type without the list

- **WHEN** no vocabulary is installed and an editor types "EndorsementRating"
- **THEN** "Use “EndorsementRating” as the type" MUST be offered, and its values MUST be edited by shape

#### Scenario: Definitions from the list

- **WHEN** the vocabulary is installed and an editor opens a type's ⓘ
- **THEN** it MUST show schema.org's definition with "Definitions are schema.org's own, in English."

### Requirement: Removing and undoing

Removing an item or a value, a clean-up, a type change, a move to its own
item and an unlink MUST offer "Undo" in the bar, which MUST restore the text
exactly. Undo in the JSON box right after one of these MUST do the same.
The header's menu MUST offer "Copy all" and "Remove all".

#### Scenario: Removing an item

- **WHEN** an editor removes the employer rating
- **THEN** the bar MUST say "Removed the item “Employer rating”." with "Undo", and Undo MUST bring back the same text

### Requirement: An Undo waits for the editor

The action bar's Undo of a removal, a type change, a clean-up or a moved item
MUST stay until the next change, with no time limit, so that it can be
reached by keyboard and screen reader; it MUST go when the editor leaves the
sheet that made it, and the control in use MUST never sit under the bar. Ctrl/Cmd+Z outside a text box MUST do
the same. A button that removes itself (a fix, "Make it a person", Remove)
MUST leave focus on the changed row or the next control, never on the page.

#### Scenario: Removing a value

- **WHEN** an editor removes "Author" from a review with its row's menu and waits ten seconds
- **THEN** the bar MUST still offer Undo, and focus MUST be in the item

### Requirement: The place survives a tab switch

Switching from Form to JSON MUST put the caret on the value last focused in
Form, or on the item shown, and scroll it into view. Switching back MUST open
the item under the caret.

#### Scenario: From the second item

- **WHEN** an editor focuses the URL of the second of two items, switches to JSON and back to Form
- **THEN** the caret MUST have been on `"url"` and Form MUST show the second item

### Requirement: A main thing goes with its item

Removing the item marked as what the page is mainly about MUST clear the
mark in the same change, so that no write is refused for it.

#### Scenario: Removing the main thing

- **WHEN** an editor marks an event as the main thing and removes it
- **THEN** `schema.main` MUST be cleared and the footer MUST NOT report a field that needs attention
