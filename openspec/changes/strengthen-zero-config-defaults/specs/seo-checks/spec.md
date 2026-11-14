## MODIFIED Requirements

### Requirement: Social image rules

When the server has resolved the page, the checks MUST judge the image a shared link shows: whether there is one, the source's size, ratio, weight and format, and its alt text, saying what the module does with it. A card made from the title MUST be listed only on Article, Event, Product and Recipe pages, to improve. Without a resolution no social image rule MUST be listed. Sizes MUST be written "1200 × 630", never broken across lines.

#### Scenario: No image

- **WHEN** no social image resolves because the site's choice is "No image"
- **THEN** "Add a social image" MUST be listed to improve

#### Scenario: A card on an event

- **WHEN** an event without an image shares a card made from its title
- **THEN** "Add a photo of this event" MUST be listed to improve, with "Choose image", and its detail MUST say that links show a card made from the title

#### Scenario: A card on a landing page

- **WHEN** a Canvas landing page without an image shares a card made from its title
- **THEN** no social image row MUST be listed

#### Scenario: A small image

- **WHEN** a found image is 500 × 300 and the page shares a card instead
- **THEN** "Use a larger social image" MUST be listed to improve, its detail MUST say that the image is too small to share and that 1200 × 630 fills the card

#### Scenario: An image that already makes a large card

- **WHEN** the image is 800 × 420
- **THEN** "The social image could be sharper" MUST be listed as good to know, not counted, its detail MUST say that it is shared cropped to 1200 × 630 and that 1200 × 630 looks sharper

#### Scenario: A large card that is cropped

- **WHEN** the image is 1600 × 1000
- **THEN** one row MUST be listed as good to know, saying that it is shared cropped to 1200 × 630 around its centre, and "The social image will be cropped" MUST NOT be listed besides it

#### Scenario: A very small chosen image

- **WHEN** the chosen image is 150 × 150
- **THEN** "Use a larger social image" MUST be listed to fix, and its detail MUST say that it is too small to share large and that 1200 × 630 fills the card

#### Scenario: A square chosen image

- **WHEN** the chosen image is 800 × 800
- **THEN** "The social image is shown whole" MUST be listed as good to know, its detail MUST say that it is shown whole on its own colours and that 1200 × 630 fills the card

#### Scenario: Ratio, weight and alt text

- **WHEN** the source of an image of at least 1200 × 630 is outside 1.85 to 2 in ratio, its file is over 5 MB, or it has no alt text
- **THEN** each MUST be listed as good to know, the ratio row saying whether it is cropped or shown whole

#### Scenario: Format

- **WHEN** the chosen image is not JPEG, PNG, GIF or WebP
- **THEN** "Use JPEG, PNG or WebP" MUST be listed to improve, naming its format as people know it ("BMP", not "X-MS-BMP")

#### Scenario: Weight in one unit

- **WHEN** the image file is 10,665,459 bytes
- **THEN** the weight row and the image field MUST both say "10.2 MB", counted as the 5 MB rule counts

## ADDED Requirements

### Requirement: Sharing problems are reported to site administrators

Only users who may change site settings MUST see, as good to know: that shared images can't be made on this server and why; that the images' host is not reachable from outside or is http on an https site; that the logo is an SVG; that titles in a language can't be drawn; that pages without an image all share one site image; that the site's image has no alt text.

#### Scenario: No FreeType

- **WHEN** GD on the server has no FreeType support
- **THEN** a site administrator MUST see "Shared images can't be made on this server: the image library has no font support. Links use the site's image." (or "no image") and an editor MUST NOT

#### Scenario: An internal host

- **WHEN** a headless frontend fetches the content API from `http://cms:8080` and the share image addresses use that host
- **THEN** a site administrator MUST see that visitors' apps can't reach the images, naming the setting for Drupal's public file address

#### Scenario: Titles in an uncovered script

- **WHEN** a Japanese page's title can't be drawn
- **THEN** a site administrator MUST see "Shared images can't be made for Japanese titles yet."

#### Scenario: Every page shares one picture

- **WHEN** an upgraded site shares its site image on pages without one
- **THEN** a site administrator MUST see "Pages without an image share the same picture." with "Make one from each page's title", which selects that choice in Site → Sharing

### Requirement: A page still named with the placeholder is named

A Canvas page whose name is still Canvas's placeholder for a new page MUST list "Name this page": to improve while it has never been published, to fix once published. Its action MUST lead to Canvas's page title.

#### Scenario: A published page

- **WHEN** a published Canvas page is still named "Untitled page"
- **THEN** "Name this page" MUST be listed to fix

### Requirement: Links already shared keep their old preview

On a published page whose draft changes the shared title or image, "Links already shared keep their old preview for a while." MUST be listed as good to know, not counted.

#### Scenario: A new social title

- **WHEN** an editor changes the social title of a published page
- **THEN** that row MUST be listed until the change is published or undone
