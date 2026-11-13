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
remember its own tab. Switching MUST withdraw an Undo on offer.

#### Scenario: The menu's items

- **WHEN** an editor opens the scope menu on a page
- **THEN** "This page" MUST name the page, and "Site" MUST name the site with "every page, live when saved"

#### Scenario: A template's item

- **WHEN** the scope menu is opened at template scope
- **THEN** "Every Article" MUST say "Previewing" and the previewed node's name

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

- **WHEN** an editor types "Pricing plans" into an inherited page title with the site pattern "{title} {sep} {site}"
- **THEN** the preview MUST show "Pricing plans | Example" for the site "Example"

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
field MUST highlight its part of the preview.

#### Scenario: Clicking the preview's title

- **WHEN** an editor clicks the title in the search preview
- **THEN** the Title field MUST have focus

### Requirement: The link preview

The Social view MUST open with the card a shared link shows: the site's host,
the social title and description, and the image. The card MUST be large only
when the image is at least 600 px wide. The image field MUST say where the image
comes from.

#### Scenario: A small or missing image

- **WHEN** the image is under 600 px wide, or there is none
- **THEN** the card MUST be small and say "Small card: image under 600 px wide" or "Small card: no image"

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

Each preview MUST offer "View output", which opens the Output sheet. It MUST
list, value by value and whole, the tags the server resolves for the target,
draft included: title, description, robots and canonical first, then the rest
as emitted. It MUST show the structured data as formatted JSON, and offer "Copy
tags" and "Copy structured data", each confirmed with "Copied".

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

### Requirement: Each field shows what it inherits

A field without a value of its own MUST show the value it inherits, in grey, and
say where it comes from on hover or focus: "Set on this page", "Set for every
<Type>", "From the <language> version", "Site default", or what it falls back
to. When the value comes from the site and the editor may administer site
settings, the field MUST offer "Edit", which leads to that setting in Site.

#### Scenario: An untouched title

- **WHEN** a page has no title of its own
- **THEN** the Title field MUST show the site pattern resolved for the page, and say "Site default"

#### Scenario: Edit the site default

- **WHEN** an administrator presses "Edit" beside an inherited title
- **THEN** the dialog MUST switch to Site and put focus in "Title pattern"

### Requirement: Typing into an inherited page title keeps the site's pattern

At page scope, the first input into an inherited title MUST replace the
pattern's page title with what is typed and keep the rest. Text that brings its
own dynamic values MUST be taken as written. Erasing the typed words MUST
return the field to the inherited title. At template scope, "Use the site
pattern" MUST copy the site's pattern into an empty title.

#### Scenario: The first key

- **WHEN** an editor types "Pricing plans" into an inherited title with the site pattern "{title} {sep} {site}"
- **THEN** the field MUST read "Pricing plans {Separator} {Site name}", with the caret after "Pricing plans", and say "Set on this page"

#### Scenario: Erasing it again

- **WHEN** the editor deletes "Pricing plans" from that title
- **THEN** the page MUST have no title of its own

### Requirement: Dynamic values are chips

Text fields MUST show each dynamic value as a chip with its label, such as
"{Page title}", and store its name, such as "{title}". "Insert value", and
typing "{", MUST open a menu of the text values the field may use, with a
filter that takes the keys typed next, grouped as the content type's fields
(template scope only), the page's values and the site's values.

#### Scenario: Picking a value by keyboard

- **WHEN** an editor types " by {", then "Page t" and Enter
- **THEN** the field MUST read "… by {Page title} …", and the preview MUST show the page's title in its place

#### Scenario: Images are not text

- **WHEN** the insert menu is opened in a text field
- **THEN** it MUST NOT offer image values

### Requirement: A chip is one unit

Backspace or Delete next to or inside a chip MUST remove it whole and announce
"Removed" with its label. The caret MUST step over a chip, and a selection MUST
NOT end inside one. Pasted text MUST be plain. A single-line field MUST turn
pasted line breaks into spaces and MUST NOT break a line on Enter.

#### Scenario: Removing a chip

- **WHEN** the caret is after "{Page title}" and the editor presses Backspace
- **THEN** the whole chip MUST be removed

### Requirement: A chip field says what it becomes

While a chip field has focus and no preview of it is in sight, the field MUST
show what it resolves to for the page.

#### Scenario: A structured data detail

- **WHEN** an editor focuses a detail bound to "{Byline}" on the Schema tab
- **THEN** the field MUST show the previewed article's byline

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
store nothing, so it keeps following its source. Text MUST be kept as typed,
trailing spaces included.

#### Scenario: A switch turned off and on again

- **WHEN** an editor turns "Show in search results" off and on again on a page that inherits it
- **THEN** the page MUST store no visibility setting

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

At template scope, text fields MUST also offer the content type's fields as
dynamic values, the social image MAY be bound to one of its image fields, and
previews, checks and Output MUST use the node the editor previews.

#### Scenario: A title bound to a field

- **WHEN** an editor sets "Every Article"'s title to "{Page title} by {Byline}"
- **THEN** the preview MUST show the previewed article's title and byline, and the template's draft MUST hold "{title} by {field.field_byline}"

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

Checks, Output, Choose image and Custom JSON-LD MUST open as sheets that cover
the dialog, with "Back" and a title. Only one MUST be open at a time, and the
view behind it MUST be out of reach. Escape or Back MUST close it and return
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
end, or the control just used, in sight. In a frame up to 420 px tall, previews
MUST be compacted and menus and suggestion lists capped to 60 % of the height.

#### Scenario: At 200 % zoom

- **WHEN** the dialog has half its normal width
- **THEN** the header MUST wrap, and no element on any tab or on the Checks sheet MUST overflow sideways

#### Scenario: The bar appears at the end of the view

- **WHEN** the view is scrolled to its end and the action bar appears
- **THEN** the view MUST stay scrolled to its end, above the bar

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

### Requirement: Value menus stay inside the dialog

A menu that lists values with their previews MUST open fully inside the
dialog, whichever column its field is in. Each entry MUST show its value
under its label across the menu's width, up to two lines, with the whole
value available on hover.

#### Scenario: A field in the right-hand column

- **WHEN** an editor opens the insert menu of Street address, beside Venue on "Every Event"'s Schema tab
- **THEN** the whole menu MUST be inside the dialog

#### Scenario: A long value

- **WHEN** the menu lists the previewed event's description
- **THEN** the description MUST be shown under "Description" on up to two lines, not cut beside the label
