## MODIFIED Requirements

### Requirement: Checks describe the page or template being edited

Checks MUST be computed for the target, a page or a content type's template,
from the values the dialog shows, unsaved edits and Canvas's live page title
and description included. At template scope they MUST be about the node the
editor previews, named once on one line of the Checks sheet and called "this
‹type›" in its issues. A value empty for the previewed node MUST be stated as
a fact, good to know and not counted. The Site scope MUST have no checks of
its own.

#### Scenario: Typing changes the checks

- **WHEN** an editor types a title that names the site twice
- **THEN** "Remove the repeated site name" MUST be listed before the change is saved

#### Scenario: A template is checked against its preview

- **WHEN** the dialog edits "Every Article" while the editor previews the article "Hello world"
- **THEN** the Checks sheet MUST say "Checked against Hello world", and a detail that would say "this page" MUST say "this article" instead

#### Scenario: A very long node title

- **WHEN** the editor previews an event whose title is 247 characters long
- **THEN** "Checked against" MUST fit on one line, ending with an ellipsis, with the whole title on hover, and no issue's sentence MUST repeat the title

#### Scenario: A value empty for the previewed node

- **WHEN** "Every Event"'s description holds {Performers} and the previewed event has no performers
- **THEN** the issue MUST say "Performers is empty for this event", not "Fill in Performers", and be good to know, not counted in the Checks button; the same MUST hold for a value the title or the social texts use

#### Scenario: A structured data property linked to a field empty for the previewed node

- **WHEN** "Every Event" links its Ends property to the field Ends and the previewed event has no end
- **THEN** the issue MUST say "Ends is empty for this event", be good to know, not counted, and "Event is missing: Ends." MUST NOT be listed

#### Scenario: Shown in search, not saved yet

- **WHEN** an editor clicks "Show in search results" on "Every Article" and the change is not saved yet
- **THEN** no noindex issue MUST be listed, so nothing says that hiding is set outside SEO: the check that a page is hidden by a setting outside SEO MUST NOT judge an unsaved change by the server's output for the values before it

#### Scenario: A template that is hidden from search

- **WHEN** "Every Article" is set to be hidden from search
- **THEN** the issue MUST say "Show this article in search"

#### Scenario: Site scope and loading

- **WHEN** the dialog shows the Site scope, or the editor's next page is still loading
- **THEN** the Checks button MUST NOT be shown

### Requirement: Social image rules

When the server has resolved the page, the checks MUST judge the image a shared
link shows: whether there is one, its size, ratio, weight and format, and its
alt text. Without a resolution, no social image rule MUST be listed. The size
advice MUST use the link preview's rule, in one row: an image that already
makes a large card is good to know, not to improve. Sizes MUST be written
"1200 × 630", never broken across lines.

#### Scenario: No image

- **WHEN** no social image resolves
- **THEN** "Add a social image" MUST be listed to improve

#### Scenario: A small image

- **WHEN** the image is 400 × 400
- **THEN** "Use a larger social image" MUST be the one row about its size, listed to improve, its detail MUST say that most link previews show it as a small thumbnail, that an image at least 600 px wide makes a large card and that 1200 × 630 is best, and no row about its ratio ("The social image will be cropped") MUST be listed

#### Scenario: An image that already makes a large card

- **WHEN** the image is 800 × 420
- **THEN** "The social image could be sharper" MUST be listed as good to know, not counted, its detail MUST state that it works as a large card and that 1200 × 630 looks sharper, and it MUST NOT ask for 1200 × 630 as what a large card needs

#### Scenario: A large card that is cropped

- **WHEN** the image is 800 × 1000
- **THEN** one row, "The social image could be sharper", MUST be listed as good to know, its detail MUST tell the cropping in the same row (it works as a large card, cropped, and 1200 × 630 fits best), and "The social image will be cropped" MUST NOT be listed besides it

#### Scenario: Ratio, weight and alt text

- **WHEN** the ratio of an image of at least 1200 × 630 is outside 1.85 to 2, the file is over 5 MB, or the image has no alt text
- **THEN** each MUST be listed as good to know

#### Scenario: Format

- **WHEN** the image is not JPEG, PNG, GIF or WebP
- **THEN** "Use JPEG, PNG or WebP" MUST be listed to improve, naming its format as people know it ("BMP", not "X-MS-BMP")

#### Scenario: Weight in one unit

- **WHEN** the image file is 10,665,459 bytes
- **THEN** the weight row and the image field MUST both say "10.2 MB", counted as the 5 MB rule counts
