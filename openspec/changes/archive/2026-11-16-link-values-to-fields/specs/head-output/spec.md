## RENAMED Requirements

- FROM: `### Requirement: The title follows the pattern, with fallbacks`
- TO: `### Requirement: The title is its main part and its ending`

## MODIFIED Requirements

### Requirement: Effective values layer the target over the site

The values a head is built from MUST be those of the page, or of the node's
content type, over the site's. The title's main part MUST come from the page or
type only. The title ending MUST come from the page or type when set, else from
the site, else it MUST be the Site name. Robots directives MUST be merged one
by one, the page's or type's winning. Everything else MUST come from the page
or type only. A page translation's inherited settings are in page-seo.

#### Scenario: Nothing set on the page

- **WHEN** a page titled "Pricing" sets nothing on a site named "Example" with the installed defaults
- **THEN** the title MUST be "Pricing | Example" and robots MUST be `max-image-preview:large`

#### Scenario: A type title pattern

- **WHEN** the Article template sets the title ending "Blog" and `nofollow`, and the site sets `max_image_preview` large
- **THEN** an article "Hello" MUST have the title "Hello | Blog" and robots `nofollow, max-image-preview:large`

#### Scenario: A site ending

- **WHEN** the site sets the title ending "Example Co" and a page sets only its main part "Pricing"
- **THEN** the page's title MUST be "Pricing | Example Co"

### Requirement: The title is its main part and its ending

The title MUST be the main part and the ending joined by a space, the site's
separator and a space. The main part MUST be the target's value, else the
entity's Title fact. An empty part MUST be left out together with its
separator. When both parts are empty, the title MUST be the Site name. Over
255 characters, the main part MUST be shortened, at a word near the limit and
never inside a character, so that the separator and the ending stay whole.

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

### Requirement: The description comes from the content

The description MUST be the type's description, typed or linked, when it is
set and not empty for the node. Otherwise it MUST be the entity's own
Description fact (dynamic-values). There is no site-wide description.

#### Scenario: A template description bound to a field

- **WHEN** an Article template links the description to Summary
- **THEN** each article's description MUST be its own summary, and an article without a summary MUST get its Description fact

### Requirement: Social tags fall back to the search values

`og:title` MUST be the social title, else the entity's Title fact, without the
title ending. `og:description` MUST be the social description, else the
description. `og:url` MUST equal the canonical link. `og:site_name` MUST be the
Site name.

#### Scenario: Social overrides

- **WHEN** a page sets the social title "Pricing: compare plans" and the social description "See every plan."
- **THEN** `og:title` MUST be "Pricing: compare plans", and `og:description` MUST be "See every plan."

#### Scenario: No social overrides

- **WHEN** a page titled "Pricing" with the title ending "Example" sets no social text
- **THEN** `og:title` MUST be "Pricing" and `og:description` the description

#### Scenario: A linked social title

- **WHEN** the Article template links the social title to Headline and an article's headline is empty
- **THEN** that article's `og:title` MUST be its Title fact

### Requirement: The social image follows a chain

The image MUST be the first of these that resolves: the social image (a chosen
media item, the Image fact or a linked image field), the Image fact
(dynamic-values), the site's default image. A media item MUST resolve only when
its source is an image, an anonymous visitor may view the media and the file,
and the file is public. The image MUST be the original file with its stored
size, on Drupal's own address. Unknown width and height MUST be left out.

#### Scenario: An override visitors cannot see

- **WHEN** the override is unpublished media, or a file outside the public file system
- **THEN** the page's own image MUST be used instead

#### Scenario: No usable page image

- **WHEN** the page image is not usable and the site has a default image
- **THEN** `og:image` and `og:image:alt` MUST be the site default's

#### Scenario: A linked image field

- **WHEN** the Article template links the social image to Hero and an article's hero is a published public image
- **THEN** that article's `og:image` MUST be the hero image, with its width, height and alt text

### Requirement: The page type sets og:type and the article times

`og:type` MUST be `article` for the Article, Blog post and News article types,
`profile` for Profile, and `website` otherwise. `article:published_time` and
`article:modified_time` MUST be emitted only with `og:type` `article`, as the
First published and Last updated facts.

#### Scenario: An article

- **WHEN** a page's structured data type is Article
- **THEN** `og:type` MUST be `article` and both `article:*` times MUST be present

#### Scenario: A web page

- **WHEN** a page has no structured data type
- **THEN** `og:type` MUST be `website` and there MUST be no `article:*` rows

### Requirement: Inputs that no longer render are hidden

The Metatag widget MUST be hidden in Canvas's Page data form and in the edit
form of an owned node. Canvas's own search preview in Page data MUST be hidden,
because it cannot know the title's ending.

#### Scenario: The Page data form

- **WHEN** an editor opens a Canvas page's Page data form
- **THEN** the Metatag input and the built-in search preview MUST be hidden, and Canvas's description and image inputs MUST stay

### Requirement: A cut head text ends at a word

The title, the description and the social texts MUST be cut at the last space
within the limit when the cut would fall inside a word and that space is
within the last tenth of the limit. A title's main part is cut so that its
ending stays whole.

#### Scenario: A very long event title

- **WHEN** "Every Event" links the main part to the Title fact with the ending "Events", and an event's title is 247 characters ending in "rehearsed and first performed"
- **THEN** the event's title MUST end with "… first | Events": the main part cut at a word, then the separator and the whole ending

#### Scenario: A text without spaces

- **WHEN** a title is 300 characters of text written without spaces
- **THEN** the title MUST be cut at 255 code points, never inside a character that is drawn as one

### Requirement: A cut never breaks a character

A text cut to its limit MUST NOT end inside a character that is drawn as one:
an emoji sequence, a flag, or a letter with its marks. Such a character MUST be
left out whole. The limit MUST stay a number of code points.

#### Scenario: An emoji sequence at the limit

- **WHEN** a title is 254 code points of text without spaces followed by a five-code-point emoji sequence
- **THEN** the title MUST be the 254 code points of text without any part of the sequence

#### Scenario: A flag at the limit

- **WHEN** the 1000th code point of a description of 1200 code points is the first half of a flag
- **THEN** the description MUST end before the flag

#### Scenario: A content's description cut from its text

- **WHEN** a content's formatted text has no summary and an emoji sequence spans its 160th code point
- **THEN** its Description fact MUST end before the sequence
