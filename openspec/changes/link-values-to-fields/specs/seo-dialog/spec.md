## ADDED Requirements

### Requirement: The title is edited as a main part and an ending

The Title field MUST be one control in two parts: the main part, and a button
named "Title ending: ‹value›", described "Added after the separator ‹sep›.",
that shows the separator and the ending and opens the ending's menu
(value-links). The main part MUST be a text input on a page (with Suggest when
suggestions are offered), a value that can be linked on a template, and the
fixed text "Page title" in Site. Reset MUST remove both parts.

#### Scenario: A page's title

- **WHEN** an editor opens the Search tab of a page on the site "Example" with the installed defaults
- **THEN** the Title field MUST be one textbox named "Title" and one button named "Title ending: Example"

#### Scenario: Resetting a title

- **WHEN** a page sets both its main part and the ending "Docs", and the editor presses Reset beside Title
- **THEN** both parts MUST be removed, and the field MUST say "Reset ·" with Undo

#### Scenario: The site's title

- **WHEN** an administrator opens Site
- **THEN** the title MUST show the fixed main part "Page title", the ending, and the separator under it, with an example line such as "For About us: About us | Example"

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

- **WHEN** an administrator presses "Edit" beside an inherited title ending
- **THEN** the dialog MUST switch to Site and put focus on its title ending

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

- **WHEN** an editor focuses the title ending button
- **THEN** only the separator and the ending MUST be highlighted in the search preview

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
