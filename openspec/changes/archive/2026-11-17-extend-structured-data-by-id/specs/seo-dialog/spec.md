## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Sheets cover the view

Checks, Output, Choose image and Add your own JSON-LD MUST open as sheets
that cover the dialog, with "Back" and a title. Only one MUST be open at a
time, and the view behind it MUST be out of reach. Escape or Back MUST go up
one level in a sheet that has levels, and otherwise close it and return
focus to what opened it, else to the scope button.

#### Scenario: Escape from Checks

- **WHEN** an editor opens Checks with Enter and presses Escape
- **THEN** the sheet MUST close, and focus MUST be back on the Checks button
