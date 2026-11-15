## ADDED Requirements

### Requirement: Image types link previews never use are reported

The status report MUST list, as information, each image media type whose files are stored on a file system that is neither public nor declared public, saying that link previews never use its images, and MUST name the `settings.php` setting that declares a file system public. The dialog's image picker MUST leave such types out of its query, so a page of results is never empty while other images exist.

#### Scenario: Images on an undeclared file system

- **WHEN** the Photo media type stores its files on a file system that `settings.php` does not declare public
- **THEN** the status report's "Images not used in link previews" MUST list Photo with that file system and name `file_additional_public_schemes`, and the picker MUST NOT offer Photo images

#### Scenario: Private images are listed neutrally

- **WHEN** the Scan media type stores its files in private files
- **THEN** the row MUST list Scan as stored in private files, as information, without asking for a change

#### Scenario: Newer private images do not hide older public ones

- **WHEN** the 25 newest image media are of a type stored in private files and an older image is in public files
- **THEN** the picker's first page MUST list the older image

## MODIFIED Requirements

### Requirement: The social image follows a chain

The image MUST be the first that resolves: the social image (chosen media, or set or linked on the type); the Image fact; a Canvas page's first component image; the site's choice for pages without an image (a card made from the title, the site's image, or none); the site's image when no card can be made. A found image under 600 × 315, SVG or GIF MUST be skipped. Media MUST resolve only as a public image anonymous visitors may view. If no resized copy can be stored, the original MUST be used.

#### Scenario: An override visitors cannot see

- **WHEN** the chosen image is unpublished media, or a file that is not a public file (dynamic-values)
- **THEN** the page's own image MUST be used instead

#### Scenario: An image on a read-only file system

- **WHEN** the chosen image is a 1600 × 900 file on a read-only file system declared public
- **THEN** `og:image` MUST be the original file, with `og:image:width` 1600 and `og:image:height` 900

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
- **THEN** the page's `og:image` MUST be the site's image and `og:image:alt` its alt text

#### Scenario: The site chose no image

- **WHEN** the site's choice is "No image" and a page has no image
- **THEN** the head MUST have no `og:image` rows and the card hint MUST be `summary`
