## ADDED Requirements

### Requirement: An empty description on a headless site names the frontend

When `canvas_headless` has a frontend and the description is empty, the search
preview, the link preview and the focused description field MUST say "No
description sent. The frontend decides what to show." in place of any sentence
about what search engines pick. When text previews are off, the search preview
MUST keep saying so.

#### Scenario: The search preview

- **WHEN** a page has no description and the first frontend is `https://www.example.com`
- **THEN** the search preview MUST say "No description sent. The frontend decides what to show."

#### Scenario: The link preview

- **WHEN** the same page sets no social description
- **THEN** the link preview MUST say "No description sent. The frontend decides what to show." where the card's description would be

#### Scenario: The focused field

- **WHEN** an editor focuses an empty description that no check speaks for in the field: at template scope, where an empty description is a quiet check listed in Checks only
- **THEN** the field MUST say "No description sent. The frontend decides what to show."

### Requirement: A template's draft names its Review changes entry

While a template has a draft, the status MUST name it as Canvas's "Review
changes" panel, headed "Unpublished changes", lists it. A page's draft status MUST stay as it is, because Canvas
lists a page under its own title.

#### Scenario: A template's draft

- **WHEN** "Every Article" has a draft
- **THEN** the status MUST say "Draft · listed under Unpublished changes as “Article content items — Full content view”", with a no-break space before the label's dash, so that no line of it starts with the dash

#### Scenario: A page's draft

- **WHEN** a page has a draft
- **THEN** the status MUST say "Draft · goes live when you publish the page"

## MODIFIED Requirements

### Requirement: The search result preview

The Search view MUST open with a search result at true size: the site's logo, or
its first letter, and name, the page's address as a breadcrumb, then the title
and the description, cut where a result on a phone cuts them. It MUST follow
typing. Its address MUST use Canvas's live URL alias while that differs from
the saved one. With no description, it MUST say who chooses the text instead.
Its accessible name MUST end with the description, or with the sentence shown
in its place.

#### Scenario: Typing a title

- **WHEN** an editor types "Pricing plans" into the title of a page whose ending is the site's name "Example"
- **THEN** the preview MUST show "Pricing plans | Example"

#### Scenario: A new alias in Page data

- **WHEN** an editor changes the page's URL alias in Canvas and has not saved it
- **THEN** the preview's address MUST show the new alias

#### Scenario: No description

- **WHEN** the page has no description on a site without a headless frontend
- **THEN** the preview MUST say "Search engines will pick text from the page."
- **AND** its accessible name MUST end with that sentence, as it ends with "No description sent. The frontend decides what to show." on a headless site and "No description: text previews are off." when text previews are off

#### Scenario: Text previews off

- **WHEN** nosnippet is set or the text limit is zero
- **THEN** the preview MUST say "No description: text previews are off"

#### Scenario: A canonical address elsewhere

- **WHEN** the page has a canonical address other than its own
- **THEN** the preview MUST say "Search engines are asked to show" that address "instead."

#### Scenario: The caption

- **WHEN** the page is not published, or is hidden from search
- **THEN** the caption MUST add "Not published yet" or "Hidden from search"; at template scope it MUST read "Previewing" with the node's name, and "Template not in use yet" while unpublished

### Requirement: Title and description lengths are guidance

While the title or the description has focus, its field MUST show the resolved
length and "Fits in results", or "May be cut off after" the last words that fit.
Length MUST be estimated with the font sizes and widths of search results, for
desktop and for phones. Unmeasurable text MUST show its character count only.
Length MUST NOT be a warning at rest. An empty description MUST say who chooses
the text instead.

#### Scenario: A long title

- **WHEN** an editor focuses a title wider than a desktop result
- **THEN** the field MUST say where it may be cut off

#### Scenario: An empty description

- **WHEN** an editor focuses an empty description that no check speaks for in the field, on a site without a headless frontend: at template scope, where an empty description is a quiet check listed in Checks only
- **THEN** the field MUST say "Empty. Search engines will pick text from the page."

#### Scenario: An empty description on a page

- **WHEN** an editor focuses a page's empty description
- **THEN** the field MUST name the "Add a description" check, which says who chooses the text instead
