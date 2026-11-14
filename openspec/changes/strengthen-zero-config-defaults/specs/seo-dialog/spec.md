## MODIFIED Requirements

### Requirement: The link preview

The Social view MUST open with the card a shared link shows: the image the server makes for the draft, the social title and description, and the site's host. The card MUST be large only when the image is at least 600 px wide and 157 px tall, as in the head. Its caption MUST read "When this page is shared". The image field MUST say where the image comes from, without a second picture of what the preview shows.

#### Scenario: A page without an image

- **WHEN** an editor opens Social on a page with no image on a fresh install
- **THEN** the preview MUST show the card made from the page's title as the server draws it, and the image field MUST read "Made from the title" with "Choose image"

#### Scenario: A small or missing image

- **WHEN** the image sent is under 600 px wide or under 157 px tall, or there is none
- **THEN** the card MUST be small and say "Small card: image under 600 px wide", "Small card: image under 157 px tall" or "Small card: no image"

#### Scenario: No social text set

- **WHEN** a page sets no social title or description
- **THEN** the card MUST show the search title and description, and the fields MUST say "Same as search title" and "Same as description"

#### Scenario: Where the image comes from

- **WHEN** no image is chosen for the page and the page has an image
- **THEN** the field MUST say "From the Image field", or "From the page's first image" for a component image, then "Made from the title", "The site's image" or "No image" by the site's choice

#### Scenario: A content type

- **WHEN** a site builder opens Social on the Event template, whose image is linked to Poster
- **THEN** the field MUST say "From each Event's Poster" and that events without one share a card made from the title

#### Scenario: A chosen image that is not public

- **WHEN** the chosen image is unpublished or not a public file
- **THEN** the field MUST say "The chosen image can't be shown publicly" and name what is used instead

#### Scenario: Text from the page

- **WHEN** a Canvas page's description comes from its own text
- **THEN** the description field MUST say "From the page's text"

## ADDED Requirements

### Requirement: Site settings show how shared links look

Site settings MUST have a Sharing section below the identity: a preview with a choice of "Home page" or "A page without an image", then Logo, Colour and "When a page has no image" (Make one from the title, Use this image, No image). Rows MUST say where values come from in words; colour codes and contrast MUST appear only in the colour's Change sheet, stated in text.

#### Scenario: A fresh site

- **WHEN** an administrator opens Site on a fresh install with no logo
- **THEN** Sharing MUST show a sample card, the Logo row "Add your logo. It goes on shared images and your site icon.", the Colour row "Neutral" and "Make one from the title" selected

#### Scenario: A logo from the theme

- **WHEN** the identity has no logo and the theme has its own PNG logo
- **THEN** the Logo row MUST show that logo with "From your theme", and the Colour row "Picked from your logo"

#### Scenario: An SVG logo

- **WHEN** the identity logo is an SVG
- **THEN** the Logo row MUST say "Shared images show your initial because your logo is an SVG. Choose a PNG version."

#### Scenario: Changing the colour

- **WHEN** an administrator chooses the colour `#FF6B00` in the Change sheet
- **THEN** the sheet MUST state the measured contrast of the title in text, the sample MUST update, and saving MUST apply the colour to every card

#### Scenario: Using the site's image

- **WHEN** an administrator selects "Use this image"
- **THEN** the row MUST show the chosen image's thumbnail and "Change"

#### Scenario: The preview choice by keyboard

- **WHEN** an administrator moves between "Home page" and "A page without an image" with the arrow keys
- **THEN** the choice MUST be a radio group whose selected option is announced and filled, and the sample MUST change
