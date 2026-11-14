## ADDED Requirements

### Requirement: Advanced rows in plain words

Advanced MUST also hold "Video previews" (Allowed, Up to a number of seconds,
Still image) and "Show images in image search" after "Image previews"; for a
page or content type "Stop showing after" before "Canonical address"; then
under the label "AI use" the rows "AI answers" (Allowed, Its own AI only, Not
allowed) and "AI training" (Allowed, Not allowed); and "Other tags" last. Site
› Visibility MUST offer the same rows except the stop date, the canonical
address and Other tags.

#### Scenario: Advanced on a page

- **WHEN** an editor opens Advanced on a Canvas page
- **THEN** it MUST list "Follow links", "Text previews", "Image previews", "Video previews", "Show images in image search", "Stop showing after", "Canonical address", "AI answers", "AI training" and "Other tags", in that order

#### Scenario: Site › Visibility

- **WHEN** an administrator opens Site › Visibility
- **THEN** it MUST offer the same rows without "Stop showing after", "Canonical address" and "Other tags"

### Requirement: AI use says who reads it and from when

Under the AI use rows, at every scope, the dialog MUST say that one search
engine reads them, from 1 Feb 2027 until that date, that turning text previews
off also keeps a page out of AI answers in search, and that opting out of AI
training for every crawler belongs in robots.txt. A row whose value is not the
default MUST show the directive it emits.

#### Scenario: Before the date

- **WHEN** an editor opens Advanced on 13 Nov 2026
- **THEN** the note MUST start with "One search engine reads these, from 1 Feb 2027."

#### Scenario: A value that is not the default

- **WHEN** an editor sets AI answers to "Its own AI only"
- **THEN** the row MUST show `ai-grounding:disallowextended` under its label

### Requirement: The search preview says when a page stops showing

When the target has a stop date, the search preview's caption MUST add "Stops
showing after" and the date, and "Past its stop date" once the date has passed.

#### Scenario: A future stop date

- **WHEN** a page's stop date is 12 Mar 2027 and today is earlier
- **THEN** the caption MUST read "Search result · Stops showing after 12 Mar 2027"

### Requirement: Site has a Services group for verification codes

Site MUST have a group "Services" after Visibility, listing each verification
code with its tag name, the code and a Remove button, then an input "Paste a
verification tag or code", then an "Other tags" row. A pasted whole tag MUST
become a code row. A bare code MUST ask which tag it is for. Codes MUST save
with Site's Save.

#### Scenario: Pasting a whole tag

- **WHEN** an administrator pastes a verification meta tag into the input and presses Enter
- **THEN** a new row MUST show the tag's name and code, the input MUST be empty, and the bar MUST say "Unsaved changes · not live yet"

#### Scenario: Pasting a bare code

- **WHEN** an administrator pastes a code without a tag
- **THEN** the dialog MUST ask "Which tag is this code for?" with the verification names, and add the row once one is picked

#### Scenario: Removing a code

- **WHEN** an administrator removes a saved code
- **THEN** the bar MUST say "Removing a code can disconnect the site from that service." with "Discard" and "Save"

#### Scenario: Without the site permission

- **WHEN** an editor without the administrative permission opens Site
- **THEN** the codes MUST be shown without Remove, and the input MUST be replaced by "Only people who administer SEO site settings can add codes."

### Requirement: Other tags open in a sheet

"Other tags" MUST be the last row of Advanced for a page or content type, and
the last row of Services at Site, with the number of rows set at that scope. It
MUST open the Other tags sheet: "Paste a snippet" and "Add tag", this scope's
rows, then inherited rows grouped "From the site" and "From the Metatag
module", each with a switch to use it here at page and content type scope.

#### Scenario: Inherited rows

- **WHEN** an editor opens Other tags of a page whose site has the row `dcterms.rights`
- **THEN** it MUST be listed under "From the site" with its value and a switch named "Use dcterms.rights on this page", on

#### Scenario: Turning one off

- **WHEN** the editor turns that switch off
- **THEN** the row MUST read "Off on this page", and the page's draft MUST hold the key turned off

#### Scenario: Metatag's tags at Site

- **WHEN** an administrator opens Other tags at Site and Metatag's defaults hold a theme colour
- **THEN** it MUST be listed under "From the Metatag module" without a switch, saying it is changed in the Metatag module

#### Scenario: A row added by a module

- **WHEN** a module adds a row to the head in code
- **THEN** the sheet MUST say how many rows modules add, with a way to Output, and MUST NOT offer to edit them

#### Scenario: Nothing set anywhere

- **WHEN** no scope has a row
- **THEN** the sheet MUST say "No other tags yet. Most pages need none. When a service gives you a tag, paste it here and it becomes a row."

### Requirement: A tag is added in a row of its own

"Add tag" MUST open an empty row with a choice of meta tag or link. A meta tag
MUST have a name, whether it is a name or a property, and its content; a link
MUST have its kind (profile, author, license or feed), a feed's format, and
its address. The row MUST show the tag a visitor gets for the previewed item.
A row MUST be written when it is valid and left; an empty new row MUST vanish.

#### Scenario: A row linked to a field

- **WHEN** an editor of "Every Article" adds `fediverse:creator` and links its content to Writer › Handle
- **THEN** the row MUST show `<meta name="fediverse:creator" content="…">` with the previewed article's handle, and the template's draft MUST hold the link

#### Scenario: An Open Graph key

- **WHEN** an editor types `article:section` as the name of a new meta row
- **THEN** the row MUST switch to a property, unless the editor chose otherwise

#### Scenario: Left empty

- **WHEN** an editor adds a row and moves on without typing
- **THEN** nothing MUST be written and the row MUST be gone

### Requirement: A refused row says why and where to go

A refused key or value MUST show the policy's sentence under the field, as an
alert, and keep what was typed. A key the dialog sets MUST offer "Show", which
leads to its control; a verification name at page or content type scope MUST
offer "Go to Site" to people who may administer site settings.

#### Scenario: og:title typed

- **WHEN** an editor types `og:title` as a row's name and leaves the field
- **THEN** the field MUST say "og:title is set in Social › Title." with "Show", and pressing Show MUST close the sheet and put focus in the social title

### Requirement: Pasting a snippet lists a verdict per tag

"Paste a snippet" MUST take up to 20,000 characters, read only its meta and
link elements in the dialog, and list each element found with its verdict in
words. Allowed elements MUST be added as rows only when the editor confirms.
The pasted text MUST NOT be sent to the server or stored.

#### Scenario: A mixed snippet on a page

- **WHEN** an editor pastes `dcterms.rights`, a robots tag, a verification tag, an `og:title`, an `http-equiv` refresh and a script
- **THEN** the list MUST say "Will be added", "Set in Search › Advanced" with Show, "Verification codes belong to the whole site" with Go to Site, "Set in Social › Title" with Show, "Not allowed: it acts like a server header and can redirect visitors." and "Scripts belong in the theme", and the bar MUST offer "Add 1 tag"

#### Scenario: Nothing to read

- **WHEN** an editor pastes text with no meta or link element
- **THEN** the dialog MUST say "No meta or link tag found. Paste the whole tag, starting with <meta or <link." as an alert

#### Scenario: Already set here

- **WHEN** a pasted tag equals a row this scope already has
- **THEN** its verdict MUST be "Already here" and it MUST NOT be added again

### Requirement: Output says where each added tag comes from

The Output sheet MUST list the added tags after the fixed ones, in the order
emitted, and say under each where it comes from: "Site", "This page", "Every"
and the type, with "Verification" or "AI use" where they apply, "Metatag
module", or "Added by" and a module's name.

#### Scenario: A page with tags from everywhere

- **WHEN** a page carries a site verification code, a Metatag theme colour and a module's manifest link
- **THEN** Output MUST list them with "Site · Verification", "Metatag module" and "Added by" and the module's name

## MODIFIED Requirements

### Requirement: Search visibility in plain words

The Search view MUST show visibility as one switch, "Show in search results",
and an "Advanced" row with "Follow links", "Text previews" (Allowed, Limited,
Off), "Image previews" (Large, Standard, None), for a page "Canonical
address", and the rows of "Advanced rows in plain words". Advanced MUST
summarise what is set, and start open when something is set or an issue is
about one of its rows.

#### Scenario: Hiding a page

- **WHEN** an editor turns "Show in search results" off
- **THEN** the row MUST say "Hidden · noindex", and a notice MUST say "Hidden from search engines · set on this page" with "Show in search"

#### Scenario: Nothing advanced set

- **WHEN** links are followed, text previews are allowed, image previews are large, video previews are allowed, images show in image search, AI use is allowed, and no stop date, canonical address or other tag is set
- **THEN** Advanced MUST be closed and summarised as "Defaults"

#### Scenario: A typed address

- **WHEN** an editor types a canonical address or a character limit
- **THEN** it MUST be taken when the field is left or Enter is pressed, not per key

#### Scenario: The new settings in the summary

- **WHEN** a page sets video previews up to 30 seconds, images hidden from image search and AI training "Not allowed"
- **THEN** Advanced MUST start open and its summary MUST read "Video up to 30 s, Hidden from image search, No AI training"

### Requirement: Sheets cover the view

Checks, Output, Choose image, Add your own JSON-LD and Other tags MUST open
as sheets that cover the dialog, with "Back" and a title. Only one MUST be
open at a time, and the view behind it MUST be out of reach. Escape or Back
MUST go up one level in a sheet that has levels, and otherwise close it and
return focus to what opened it, else to the scope button.

#### Scenario: Escape from Checks

- **WHEN** an editor opens Checks with Enter and presses Escape
- **THEN** the sheet MUST close, and focus MUST be back on the Checks button

#### Scenario: Escape inside Other tags

- **WHEN** an editor has the paste panel open in Other tags and presses Escape twice
- **THEN** the first Escape MUST close the paste panel, and the second MUST close the sheet and return focus to the "Other tags" row

#### Scenario: An accessibility scan of Other tags

- **WHEN** the Other tags sheet is scanned with a row open and with the paste list shown
- **THEN** no serious or critical violation MUST be found
