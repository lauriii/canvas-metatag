## MODIFIED Requirements

### Requirement: The title is its main part and its ending

The title MUST be the main part and the ending joined by a space, the site's separator and a space. The main part MUST be the target's value, else the entity's Title fact. An empty part MUST be left out together with its separator. When both parts are empty, the title MUST be the Site name. The title MUST be at most 255 characters ("A cut head text ends at a word").

#### Scenario: Separators without neighbours

- **WHEN** a page titled "Pricing" inherits the Site name as its ending and the site has no name
- **THEN** the title MUST be "Pricing", with no separator

#### Scenario: A template pattern bound to a field

- **WHEN** a content type's template links the title's main part to Byline
- **THEN** each node's title MUST start with that node's own byline, and saving the node or the template MUST change it

#### Scenario: No ending

- **WHEN** a page titled "Pricing" sets its title ending to "No ending"
- **THEN** its title MUST be "Pricing", with no separator

#### Scenario: Nothing at all

- **WHEN** both parts of a title are empty
- **THEN** the title MUST be the Site name

#### Scenario: A page still named with the placeholder

- **WHEN** a published Canvas page named "Untitled page" shows the heading "Our services" on a site named "Humanify Studio"
- **THEN** its title MUST be "Our services | Humanify Studio" and its `og:title` "Our services"

### Requirement: A cut head text ends at a word

The description and the social texts MUST be cut at the last space within the limit when the cut would fall inside a word and that space is within the last tenth of the limit. A title over 255 characters MUST be cut from the end of its main part, keeping its ending whole, as "A long title keeps its ending" says.

#### Scenario: A very long event title

- **WHEN** an event's title ending is "Events" and its title is 247 characters ending in "first performed"
- **THEN** the event's title MUST end with "… | Events", be at most 255 characters, and its main part MUST end with a whole word before "…"

#### Scenario: A text without spaces

- **WHEN** a title is 300 characters of text written without spaces
- **THEN** the title MUST be cut at 255 code points, never inside a character that is drawn as one

### Requirement: The social image follows a chain

The image MUST be the first that resolves: the social image (chosen, or set or linked on the type); the Image fact; a Canvas page's first component image; the site's choice for pages without an image (its card, the site's image, or none); the site's image when no card can be made. While the site can make images, a found image under 600 × 315, SVG or GIF MUST be skipped; without them, found images are sent as their original files. Media MUST resolve only as an image anonymous visitors may view.

#### Scenario: An override visitors cannot see

- **WHEN** the chosen image is unpublished media, or a file outside the public file system
- **THEN** the page's own image MUST be used instead

#### Scenario: No usable page image

- **WHEN** the page image is not usable and the site's choice is "Use this image"
- **THEN** `og:image` MUST be a 1200 × 630 version of the site's image and `og:image:alt` its alt text

#### Scenario: A linked image field

- **WHEN** the Article template links the social image to Hero and an article's hero is a published public 1600 × 900 image
- **THEN** that article's `og:image` MUST be a 1200 × 630 version of the hero image, with the hero's alt text

#### Scenario: A small logo found on a job posting

- **WHEN** a job posting's only image is a 400 × 400 company logo and the site makes cards
- **THEN** its `og:image` MUST be the card made from its title

#### Scenario: A Canvas page with a hero component

- **WHEN** a Canvas page has no image of its own and its first component shows a public 2400 × 1600 photo
- **THEN** its `og:image` MUST be a 1200 × 630 version of that photo

#### Scenario: The site chose its own image

- **WHEN** the site's choice for pages without an image is "Use this image" with a 1200 × 630 image, and a page has no image
- **THEN** the page's `og:image` MUST be a 1200 × 630 version of the site's image and `og:image:alt` its alt text

#### Scenario: The site chose no image

- **WHEN** the site's choice is "No image" and a page has no image
- **THEN** the head MUST have no `og:image` rows and the card hint MUST be `summary`

### Requirement: The card hint follows the image size

The card hint MUST be `summary_large_image` when the image sent is at least 600 pixels wide and 157 pixels tall, else `summary`, also when there is no image. It MUST use the same rule as the dialog's link preview (seo-dialog). Every image the module makes or resizes is 1200 × 630, so a page that shares one MUST get `summary_large_image`.

#### Scenario: A large image

- **WHEN** the image sent is 1200 by 630 pixels
- **THEN** the card hint MUST be `summary_large_image`

#### Scenario: A small image

- **WHEN** the image sent is 180 by 180 pixels, a chosen image sent as its original
- **THEN** the card hint MUST be `summary`

#### Scenario: A square logo

- **WHEN** the image sent is 400 by 400 pixels, an original file sent because the site cannot make images
- **THEN** the card hint MUST be `summary`

#### Scenario: A wide banner

- **WHEN** the image sent is 1200 by 150 pixels, an original file sent because the site cannot make images
- **THEN** the card hint MUST be `summary`

#### Scenario: A made card

- **WHEN** a page shares a card made from its title
- **THEN** the card hint MUST be `summary_large_image`

#### Scenario: A small chosen image

- **WHEN** the chosen image is 150 × 150
- **THEN** the image MUST be the original file at 150 × 150 and the card hint MUST be `summary`

#### Scenario: A chosen square logo

- **WHEN** the chosen image is 400 × 400
- **THEN** the image MUST be a 1200 × 630 version showing it whole and the card hint MUST be `summary_large_image`

### Requirement: The head has fixed rows in a fixed order

The head MUST be the title and these rows, in order: meta `description`, meta `robots`, `og:type`, `og:site_name`, `og:locale`, `og:locale:alternate`, `og:title`, `og:description`, `og:url`, `og:image`, `og:image:type`, `og:image:width`, `og:image:height`, `og:image:alt`, `article:published_time`, `article:modified_time`, the card hint; then the canonical link, the hreflang links, the icon links and the JSON-LD script. Empty rows and links that are not absolute http(s) URLs MUST be left out.

#### Scenario: Nothing to say

- **WHEN** a page has no description, no title and no image, and the site's choice for pages without an image is "No image"
- **THEN** the description, `og:title`, `og:description` and every `og:image` row MUST be left out
- **AND** the title MUST be the site name

#### Scenario: A fresh install

- **WHEN** a Canvas page titled "Pricing" on a fresh English install is requested
- **THEN** its head MUST carry, in this order, `og:locale` `en_US`, `og:title` "Pricing", `og:image`, `og:image:type` `image/png`, `og:image:width` 1200, `og:image:height` 630 and `og:image:alt`, and the card hint `summary_large_image`

## ADDED Requirements

### Requirement: A long title keeps its ending

A title over 255 characters MUST lose from the end of its main part whole fields of a composition with their words, then whole words, and end in "…", until the main part, the separator and the ending fit. A main part with no space in the last tenth of its room is cut at its room in code points, never inside a character drawn as one, without "…", so that the title is at most 255 code points. The ending MUST be cut only when it alone is too long.

#### Scenario: A cut composed title

- **WHEN** "Every Event"'s main part is Title, " in ", Venue › City, " · ", Starts, its ending is "Events", and an event's title is 240 characters
- **THEN** the title MUST leave out " · ‹date›" and then " in ‹city›" before it loses any word of the event's title, MUST end its main part with a whole word and "…" only if it still does not fit, and MUST NOT hold " in …" or " · …"

### Requirement: og:locale names the page's language

`og:locale` MUST be the page's language as language_TERRITORY: the region in its language code, else the site's default country when the module's locale list gives it for that language, else the list's default territory. A language not in the list MUST have no `og:locale`. `og:locale:alternate` MUST name each other translation the hreflang links list, in the same form.

#### Scenario: An English site without a country

- **WHEN** an English page is requested on a site with no default country
- **THEN** `og:locale` MUST be `en_US`

#### Scenario: A British site

- **WHEN** the site's default country is the United Kingdom
- **THEN** an English page's `og:locale` MUST be `en_GB`

#### Scenario: A regional language code

- **WHEN** a page is in Brazilian Portuguese (`pt-br`)
- **THEN** `og:locale` MUST be `pt_BR`

#### Scenario: Translations

- **WHEN** a site whose default country is the United Kingdom publishes a page in English and French
- **THEN** the English page MUST carry `og:locale` `en_GB` with `og:locale:alternate` `fr_FR`, and the French page `og:locale` `fr_FR` with `og:locale:alternate` `en_GB`

### Requirement: The image's alt text says what the image shows

`og:image:alt` MUST be: for a page's own or chosen image, its alt text, else its media name when that has three words or more, does not look like a file name or a version and differs from the page title; for a made card, the full `og:title` and the Site name; for the site's image, its alt text, else the Site name.

#### Scenario: A media name used as alt

- **WHEN** a page's image has no alt text and its media is named "Choir rehearsing in the old church"
- **THEN** `og:image:alt` MUST be "Choir rehearsing in the old church"

#### Scenario: A media name that is not a description

- **WHEN** a page's image has no alt text and its media is named "Hero final v3"
- **THEN** there MUST be no `og:image:alt`

### Requirement: Sharing inputs invalidate the head

An owned page MUST be invalidated when the default theme, its logo or favicon setting, the logo media or file, the site's sharing choices or its content type's name changes. Building the head MUST NOT decode an image or draw: the image address MUST be computed from values already resolved. The only files it MAY read are the EXIF headers of the JPEG images it considers, for their upright size.

#### Scenario: A new logo

- **WHEN** an administrator replaces the site logo
- **THEN** the next request for a cached page without an image MUST carry a new `og:image` address whose card shows the new logo

#### Scenario: Delivery cost

- **WHEN** a page whose card was never fetched is requested
- **THEN** the response MUST NOT have drawn the card, and the first request for the card address MUST draw it

### Requirement: The owned front page carries the site icon

While the default theme uses core's default favicon, the owned front page MUST carry `icon` links at 32 and 192 pixels and an `apple-touch-icon` at 180 pixels made from the logo, else from the Site name's first letter, in place of core's favicon link. Every other route, and a theme's own favicon, MUST stay as they are.

#### Scenario: A theme with the default favicon

- **WHEN** the front page is an owned Canvas page and the theme uses core's default favicon
- **THEN** the front page's head MUST carry the three icon links, all absolute PNG addresses, and no link to core's default favicon

#### Scenario: A theme with its own favicon

- **WHEN** the theme sets its own favicon
- **THEN** the front page's head MUST carry the theme's favicon and no icon link from the module
