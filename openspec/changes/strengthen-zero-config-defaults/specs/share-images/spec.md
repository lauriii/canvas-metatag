## ADDED Requirements

### Requirement: A page without an image shares a card made from its title

When a page's image chain ends at the site's card, the shared image MUST be a 1200 × 630 PNG showing the page's `og:title`, the Site name and the logo, else the name's first letter, on the site's colour. A title of up to two lines MUST stay inside the centre 630 × 630 square. The image's alt text MUST be the full `og:title` and the Site name.

#### Scenario: A fresh install's Canvas page in a chat app

- **WHEN** a Canvas page titled "Services" with no image, on a fresh install whose site is named "Humanify Studio", is shared in a chat app
- **THEN** the preview MUST show a large 1200 × 630 image with "Services" and "Humanify Studio" on it, and the head MUST carry `og:image:width` 1200, `og:image:height` 630, `og:image:type` `image/png` and `og:image:alt` "Services, Humanify Studio"

#### Scenario: A compact preview crops to the centre square

- **WHEN** the card of an event titled "Midsummer Night Concert" is cropped to its centre 630 × 630
- **THEN** every letter of the title MUST be inside the crop

#### Scenario: The card draws the shared title

- **WHEN** a page titled "Pricing" sets the social title "Pricing that grows with your team"
- **THEN** its card MUST show "Pricing that grows with your team", not "Pricing"

### Requirement: The card's small line names the kind of page

The line above the title MUST be the page type's structured-data kind for the Article family, Event, Product, Recipe and Job posting, with a date without a time for an article (published) and an event (start), written in the page's language; a person's mapped job title; and nothing for any other type. It MUST NOT show prices, pay or durations.

#### Scenario: An event

- **WHEN** an event "Midsummer Night Concert" starts on 19 June 2027 at 19:00 on an English site
- **THEN** its card's small line MUST read "EVENT · JUNE 19, 2027", with no time

#### Scenario: A page-like type

- **WHEN** a Basic page "About our team" without an image is shared
- **THEN** its card MUST have no small line, and MUST NOT show "Basic page"

#### Scenario: A person

- **WHEN** a person "Mira Kallio" has the job title "Conductor" mapped and no photo
- **THEN** the small line MUST read "CONDUCTOR"

### Requirement: Card colours stay the brand's and stay readable

The field MUST be the site's colour (the colour set in Site, else picked from the logo, else a neutral dark), moved in lightness only until white or dark text reaches 5.5:1 on every part of the field, whichever needs fewer steps, dark text counting five steps more. Small text MUST reach 4.5:1 on every part of the field.

#### Scenario: An orange logo

- **WHEN** the site's logo is orange `#FF6B00` and no colour is set
- **THEN** the card's field MUST stay orange, with dark text, and a contrast checker MUST measure at least 5.5:1 for the title and 4.5:1 for the small line at any point

#### Scenario: A navy logo

- **WHEN** the logo is navy `#1A358D`
- **THEN** the field MUST be navy with white text, its middle within 2% lightness of the logo's colour

#### Scenario: No logo and no colour

- **WHEN** a fresh site has no logo and no colour
- **THEN** the field MUST be the neutral dark field with white text

### Requirement: The logo is shown as it is drawn

The logo MUST be trimmed to what it draws before it is measured or placed. A one-colour logo on transparency MUST be drawn in the text colour; a multicolour one under 3:1 against the field MUST sit on a white plate; a logo over 2.2 times as wide as tall MUST stand alone without the name. Without a logo, or with an SVG logo, the mark MUST be the name's first letter on a tile.

#### Scenario: A wordmark on a large transparent canvas

- **WHEN** the logo is a dark one-colour wordmark placed on a square transparent canvas
- **THEN** the card MUST show the wordmark alone, in the text colour, the same as for the wordmark trimmed tight

#### Scenario: An SVG logo

- **WHEN** the logo is an SVG whose main fill is `#FF6B00`
- **THEN** the card MUST use an orange field and show the site name's first letter as the mark

### Requirement: Text the fonts can't draw makes no card

A card MUST never show a missing-glyph box or an empty tile. A title with a character the bundled fonts don't cover MUST give no card, and the chain MUST go on. Emoji outside the basic plane MUST be left out of the image only. An `&` MUST be drawn as typed, also when followed by `#169;`.

#### Scenario: A Japanese title

- **WHEN** a page titled "湖畔の夏至コンサート" has no image and the site has no image of its own
- **THEN** the head MUST carry no `og:image`, the card hint MUST be `summary`, and no image with boxes MUST exist at any address

#### Scenario: Emoji in a title

- **WHEN** a page is titled "Launch week 🚀 five new things for editors ✨"
- **THEN** the card MUST show "Launch week five new things for editors ✨" and `og:title` MUST keep "🚀"

#### Scenario: An ampersand

- **WHEN** a page is titled "Q&A night: Tom &#169; Jerry & friends"
- **THEN** the card MUST show those characters as typed, with no "©"

### Requirement: Right-to-left and long titles are set correctly

Arabic letters MUST be joined and right-to-left words shown in reading order with numbers kept; the brand row MUST be mirrored on a right-to-left page. A title MUST use the largest size that fits in at most four balanced lines; past that the last line MUST end in "…" after a whole word longer than three letters.

#### Scenario: An Arabic page

- **WHEN** an Arabic page titled "حفل ليلة منتصف الصيف على ضفاف البحيرة" has no image
- **THEN** its card MUST show the title joined and right to left, with the logo to the right of the site name

#### Scenario: A 247-character title

- **WHEN** an event's title is 247 characters
- **THEN** its card MUST show four lines, the last ending in "…" after a word of more than three letters, and the alt text MUST hold the whole title

### Requirement: A page's own image is shared as a 1200 × 630 version

A page's own or chosen image MUST be sent as a 1200 × 630 JPEG under 300 KB, turned upright first: cropped around its centre when its ratio is 1.30 to 2.4 and that needs at most 1.25 times enlargement; otherwise shown whole on its own colours, a plain or transparent background continued. A chosen image MUST NOT be enlarged; one under 200 × 200 MUST be sent as the original.

#### Scenario: A phone photo

- **WHEN** a page's image is a portrait JPEG stored sideways with an EXIF orientation of 6
- **THEN** the shared image MUST show the photo upright and whole

#### Scenario: A transparent product cut-out

- **WHEN** a product's image is a PNG whose transparent pixels are stored as black
- **THEN** the shared image MUST show the product on white, with no black area

#### Scenario: A 4:3 photo

- **WHEN** a recipe's photo is 1600 × 1200
- **THEN** the shared image MUST fill 1200 × 630, cropped around the centre

#### Scenario: A high JPEG quality setting

- **WHEN** the site's JPEG quality is 100 and a page's photo is a detailed 2400 × 1600 image
- **THEN** the shared image MUST be at most 300 KB

### Requirement: Made images have their own address

Every made image MUST have an address that changes when anything drawn changes, computed only from the entity and configuration, never from the request. It MUST be made on the first request, stored, and served with a one-year immutable cache; a card also with `X-Robots-Tag: noindex`. An outdated address MUST redirect, for at most five minutes of caching, to the current one.

#### Scenario: Renaming a page

- **WHEN** an editor renames a published page and publishes it
- **THEN** its `og:image` address MUST change, the old address MUST answer 302 to the new one, and the new image MUST show the new title

#### Scenario: A request with another host name

- **WHEN** a card address is requested with the host header `evil.example`
- **THEN** the image MUST be the same bytes as with the site's own host, and no other file MUST be stored

#### Scenario: Headers

- **WHEN** a crawler fetches a card
- **THEN** the response MUST be `image/png` with `Cache-Control: public, max-age=31536000, immutable` and `X-Robots-Tag: noindex`

### Requirement: Only public pages have public images

A made image's address MUST answer 404 for an entity anonymous visitors can't view, one the module doesn't own, an invalid address, or a hash the module did not compute for the entity's current values. Unpublishing, deleting, or losing anonymous access MUST delete the entity's stored images. A draft's values MUST never reach a public address.

#### Scenario: Unpublishing

- **WHEN** a published page with a card is unpublished
- **THEN** its card address MUST answer 404 and its stored card file MUST be gone

#### Scenario: A draft title

- **WHEN** an editor types a new title in the dialog and does not publish
- **THEN** no public address MUST serve an image with the new title

### Requirement: The editor previews the draft's image

The dialog's preview MUST render the draft's image in memory, only for users who may view the page (and update it, for a draft), with `Cache-Control: no-store`, and MUST NOT store a file.

#### Scenario: Typing a title

- **WHEN** an editor changes a page's title in the dialog
- **THEN** within a second of stopping typing the link preview MUST show the card with the new title, and no file MUST be written

#### Scenario: Someone without access

- **WHEN** a user who may not update an unpublished page requests its preview
- **THEN** the system MUST answer 403

### Requirement: Without the tools, sharing degrades to the original files

When GD with FreeType is missing or the public files are not on local disk, no card MUST be made, a page's own or the site's image MUST be sent as the original file with its stored size, and the status report MUST say what is missing.

#### Scenario: No FreeType

- **WHEN** GD has no FreeType support
- **THEN** a page with a 1600 × 900 photo MUST share the original photo, a page without an image MUST have no `og:image` unless the site's image is chosen, and the status report MUST name FreeType

### Requirement: Untrusted inputs are bounded

The logo MUST come only from public files or the default theme's own folder; component images only through media or file entities on public files. The module MUST never fetch an address to make an image. A logo over 4096 pixels a side or a photo over 40 megapixels MUST be skipped; text MUST be cut to 300 characters before it is set.

#### Scenario: A theme logo outside the theme

- **WHEN** the theme's logo path is set to an address on another host or a file outside the theme's folder
- **THEN** the card MUST use the monogram, and no request to that host MUST be made

#### Scenario: A huge image

- **WHEN** a page's image is 9000 × 9000 pixels
- **THEN** it MUST be skipped for the share image, and the chain MUST go on

### Requirement: The site card shows the identity

The site card MUST show the logo, else the name's first letter, large; the Site name, left out beside a wordmark; and a line: Drupal's slogan, left out when there is none or when equal to the shared description. It MUST be used only where a requirement asks for it.

#### Scenario: A site card with a slogan

- **WHEN** the site card is drawn for a site whose Drupal slogan is "Human expertise for AI-made work"
- **THEN** it MUST show the logo, the Site name and "Human expertise for AI-made work"

#### Scenario: A site card without a slogan

- **WHEN** the site card is drawn for a site with a logo and no Drupal slogan
- **THEN** it MUST show the logo and the Site name, and no line
