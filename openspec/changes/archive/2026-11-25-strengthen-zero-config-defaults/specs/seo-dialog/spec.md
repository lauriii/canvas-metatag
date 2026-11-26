## MODIFIED Requirements

### Requirement: The link preview

The Social view MUST open with the card a shared link shows: the image the server makes for the draft, the social title and description, and the site's host. The card MUST be large only when the image is at least 600 px wide and 157 px tall, as in the head. Its caption MUST read "When this page is shared", or on a content type "When this ‹type label in a sentence› is shared". The image field MUST say where the image comes from, without a second picture of what the preview shows.

#### Scenario: A page without an image

- **WHEN** an editor opens Social on a page with no image on a fresh install
- **THEN** the preview MUST show the card made from the page's title as the server draws it, and the image field MUST read "Made from the title" with "Choose image"

#### Scenario: A small or missing image

- **WHEN** the image sent is under 600 px wide or under 157 px tall, or there is none
- **THEN** the card MUST be small and say "Small card: image under 600 px wide", "Small card: image under 157 px tall" or "Small card: no image"

#### Scenario: The card the head asks for

- **WHEN** the image sent is an original file under 600 px wide, such as a chosen 150 × 150 image, or a 400 × 400 logo on a site that cannot make images
- **THEN** the card MUST be small, with a square thumbnail as tall as the card at Canvas's dialog width, and Output MUST show the card hint `summary`

#### Scenario: No social text set

- **WHEN** a page sets no social title or description
- **THEN** the card MUST show the page title and the description, and the fields MUST say "From the page title" and "Same as description"

#### Scenario: Where the image comes from

- **WHEN** no image is chosen for the page
- **THEN** the field MUST say "From the Image field" (or "From the page's first image" for a component image) when the page has one, else "Made from the title", "The site's image" or "No image" by the site's choice

#### Scenario: A found image too small to share

- **WHEN** the page's own image is 500 × 300, so the page shares a card made from its title
- **THEN** the field MUST say "Made from the title" and that the Image field's image is too small to share, with its size

#### Scenario: The page's own image is not public

- **WHEN** the media item in a page's Image field is unpublished or not a public file, so the page shares a card made from its title
- **THEN** the field MUST say "Made from the title" with "The Image field's image can't be shown publicly" on a line under it

#### Scenario: A content type

- **WHEN** a site builder opens Social on the Event template, whose image is linked to Poster
- **THEN** the field MUST name Poster as where the image comes from, and only while the field is in use say "An event without one shares a card made from its title."; for a previewed event without a Poster it MUST say at rest only "This event has no Poster, so it shares a card made from its title."

#### Scenario: A content type's image too small to share

- **WHEN** Social on the Article template previews an article whose Image is 500 × 300, so it shares a card made from its title
- **THEN** the field MUST say at rest "This article's Image is too small to share (500 × 300), so it shares a card made from its title.", as the missing-image case says it, and not what an article without one shares

#### Scenario: A page still named for a new page

- **WHEN** a page still has the name Canvas gives a new page and is titled by its first heading
- **THEN** the Social title MUST say "From the page's first heading", and so MUST the Search title while its main part is not typed

#### Scenario: A content type's missing image in Checks

- **WHEN** the previewed event has no Poster, so it shares a card
- **THEN** Checks MUST ask to add a Poster to this event in words, without a Choose image fix: an image chosen on the template would be every event's

#### Scenario: A chosen image that is not public

- **WHEN** the chosen image is unpublished or not a public file
- **THEN** the field MUST name what is shared instead in the image field's words ("Made from the title" when a card is, "The site's image", "From the Image field", or "No image" only when nothing is shared), with "The chosen image can't be shown publicly" whole on a line under it

#### Scenario: Text from the page

- **WHEN** a Canvas page's description comes from its own text
- **THEN** the description field MUST say "From the page's text"

## ADDED Requirements

### Requirement: Site settings show how shared links look

Site settings MUST have a Sharing section below the identity: a sample with a choice of "Home page" (offered while the module makes the front page's head) or "Page without image", then, right under the sample it changes, "When a page has no image" (Make one from the title, Use this image, No image), then Logo and Colour. Rows MUST say where values come from in words; colour codes and contrast MUST appear only in the colour's Change sheet, stated in text.

#### Scenario: A fresh site

- **WHEN** an administrator opens Site on a fresh install with no logo
- **THEN** Sharing MUST show a sample card, the Logo row "Add your logo. It goes on shared images and your site icon.", the Colour row "Neutral" and "Make one from the title" selected

#### Scenario: A logo from the theme

- **WHEN** the identity has no logo and the theme has its own PNG logo
- **THEN** the Logo row MUST show that logo with "From your theme", and the Colour row "Picked from your logo"

#### Scenario: An SVG logo

- **WHEN** the identity logo is an SVG
- **THEN** the Logo row MUST say "Shared images show your initial because your logo is an SVG. Choose a PNG version."; for a logo over 4096 pixels a side it MUST say "Shared images show your initial because your logo is over 4096 pixels. Choose a smaller version."

#### Scenario: Changing the colour

- **WHEN** an administrator chooses the colour `#FF6B00` in the Change sheet
- **THEN** the sheet MUST state the measured contrast of the title in text, saying when the card shades the colour ("Your #FF6B00 is shaded to #ED741D so dark text reaches 5.6:1."), the sample MUST update, and saving MUST apply the colour to every card

#### Scenario: Using the site's image

- **WHEN** an administrator selects "Use this image"
- **THEN** the row MUST show the chosen image's thumbnail and "Change"; saved without an image, "Choose the image to use." MUST appear under that row and focus MUST move to the choice

#### Scenario: A site image kept under cards

- **WHEN** "Make one from the title" is selected and a site image chosen earlier is still stored (it is shared when a title can't be drawn)
- **THEN** that option MUST say "Pages whose title can't be drawn share “‹image name›”." with a Remove action, so the image is never used unseen; Remove MUST clear the site's image, take the line away and leave focus on the checked choice

#### Scenario: A server that can't make images

- **WHEN** the server can't make images (its image library has no font support, or its public files are not on its own disk)
- **THEN** Sharing MUST show, in place of the sample, "Shared images can't be made on this server: the image library has no font support." (or "…: its public files are not on its own disk."), MUST keep "When a page has no image" and Logo, and MUST leave out Colour

### Requirement: The sample shows what the head sends

Each Sharing sample MUST show the link as the head sends it, in the link preview's own card, with its host, title and description: the home page's own image when it has one; otherwise, and for a page without an image, what "When a page has no image" says as edited: a card made from the title, the site's image as shared, or the small card of a link without an image.

#### Scenario: "Use this image" before one is chosen

- **WHEN** an administrator selects "Use this image" and has not chosen an image yet
- **THEN** the sample MUST show the small card of a link without an image

#### Scenario: A title the fonts can't draw

- **WHEN** the page sample's title is in a script the bundled fonts can't draw
- **THEN** the sample MUST show what the head sends instead: the site's image when one is set, else the small card of a link without an image, never an empty large image

#### Scenario: The sample follows the choice

- **WHEN** an administrator selects "No image", or "Use this image" with an image chosen
- **THEN** the sample MUST show the small card of a link without an image, with its host and title, or the chosen image as pages share it, before saving

#### Scenario: The preview choice by keyboard

- **WHEN** an administrator moves between "Home page" and "Page without image" (the Segmented control Represents uses), or between the options of "When a page has no image" or of the colour's sheet, with the arrow keys
- **THEN** each choice MUST be a radio group whose option is selected as it is reached, announced and filled, and the sample MUST change

#### Scenario: Choosing a colour of one's own

- **WHEN** an administrator selects "Choose a colour" in the colour's sheet
- **THEN** nothing MUST change until a colour is entered, and once one is, the Colour row MUST say "Your colour"

### Requirement: The sample's title

The page sample MUST use the current page's title at page scope and a short neutral title elsewhere; the colour's sheet MUST always use the short neutral title, so that it can show the card.

#### Scenario: The colour's sheet on a page whose title can't be drawn

- **WHEN** an administrator opens Site from the editor of a page whose title the bundled fonts can't draw, and opens the colour's sheet
- **THEN** the sheet MUST show the card made from the short neutral title, with its contrast stated in text
