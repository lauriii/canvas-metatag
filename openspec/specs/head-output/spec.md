# head-output

## Purpose

Give every Canvas page, and every node shown through an enabled Full content
template, one complete search and social head in the HTML Drupal renders:
title, description, robots, canonical, hreflang, Open Graph tags and a card
hint. Define how the stored layers become that head, leave every other route
exactly as it was, keep both page caches effective, and never lose a page
because its head could not be built.

## Requirements

### Requirement: The module owns the head of Canvas pages and template-rendered nodes

The module MUST provide the head on the canonical route of every Canvas page,
and on the canonical route of a node whose content type has an enabled Full
content template. Every other route MUST keep the head it has without the
module: nodes without an enabled Full template, a node's revision,
latest-version and preview routes, Views, error pages and routes without an
entity. The coupled head MUST always be built from the stored entity, never
from a Canvas draft.

#### Scenario: A Canvas page

- **WHEN** an anonymous visitor requests a Canvas page
- **THEN** the head MUST be the module's

#### Scenario: A node whose Full template is disabled

- **WHEN** a node's content type has a Full content template that is not enabled
- **THEN** the node's head MUST be core's, with core's canonical and shortlink links

#### Scenario: Enabling the template

- **WHEN** that template is enabled
- **THEN** the cached node page MUST be invalidated, and the next request MUST get the module's head

#### Scenario: Other routes

- **WHEN** a visitor requests a node without a Full template, or a Views page that lists owned nodes
- **THEN** the response MUST be the same as without the module

#### Scenario: Uninstalling

- **WHEN** the module is uninstalled
- **THEN** owned pages MUST get core's head again, and other routes MUST be unchanged

#### Scenario: A page with an unpublished draft

- **WHEN** a Canvas page has a draft with other SEO values
- **THEN** visitors MUST get the head of the published page

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

### Requirement: Each head element exists exactly once

On an owned route the HTML MUST contain exactly one title, one canonical link,
one set of hreflang links and one JSON-LD script. The module MUST remove core's
canonical and shortlink links and the hreflang links of Content Translation
there. Links MUST be emitted as elements only, never as HTTP `Link` headers.

#### Scenario: A translated page

- **WHEN** a visitor requests a Canvas page that has a published translation
- **THEN** the head MUST have one canonical link and the module's hreflang links only, and no shortlink
- **AND** the response MUST NOT carry a `Link` header

### Requirement: The head has fixed rows in a fixed order

The head MUST consist of the title and these rows, in this order: meta
`description`, meta `robots`, `og:type`, `og:site_name`, `og:title`,
`og:description`, `og:url`, `og:image`, `og:image:width`, `og:image:height`,
`og:image:alt`, `article:published_time`, `article:modified_time`, the card
hint; then the canonical link, the hreflang links and the JSON-LD script. A row
whose value is empty MUST be left out. A link whose address is not an absolute
http(s) URL MUST be left out.

#### Scenario: Nothing to say

- **WHEN** a page has no description, no title, no image and no site default image
- **THEN** the description, `og:title`, `og:description` and every `og:image` row MUST be left out
- **AND** the title MUST be the site name

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

### Requirement: Text is plain and escaped on output

Every text in the head MUST be plain text: control and bidi characters removed,
whitespace collapsed, trimmed, and cut to its limit (title and social title 255
characters, description and social description 1000). Text MUST be emitted as
typed otherwise, and MUST be escaped by the render system, so that no text can
add an element to the page.

#### Scenario: Hostile text in the description

- **WHEN** a page's description contains `</script><script>alert(1)</script>` and `<b>`
- **THEN** the description meta tag MUST carry that text as typed
- **AND** the HTML MUST contain no element created from it

### Requirement: The description comes from the content

The description MUST be the type's description, typed or linked, when it is
set and not empty for the node. Otherwise it MUST be the entity's own
Description fact (dynamic-values). There is no site-wide description.

#### Scenario: A template description bound to a field

- **WHEN** an Article template links the description to Summary
- **THEN** each article's description MUST be its own summary, and an article without a summary MUST get its Description fact

### Requirement: The canonical link points at the public copy

The canonical link MUST be the page's override when one is set: a path is put
on the public base (headless-head), an absolute http(s) URL is used as stored.
Without an override it MUST be the entity's own public URL: its canonical path,
with its language prefix and alias, on the public base. The front page, whether
the front page setting holds its system path or its alias, MUST be the public
base itself, with its language prefix.

#### Scenario: A path override

- **WHEN** a page sets the canonical `/plans?ref=1`
- **THEN** the canonical link and `og:url` MUST be the public base plus `/plans?ref=1`

#### Scenario: An address on another site

- **WHEN** a page sets the canonical `https://other.example.com/x`
- **THEN** the canonical link and `og:url` MUST be that address

#### Scenario: The front page

- **WHEN** a Canvas page is the front page and has a French translation
- **THEN** its canonical MUST be the public base followed by `/`, and the French one the public base followed by `/fr`

### Requirement: Robots directives are built from fixed names

The robots meta tag MUST list only `noindex`, `nofollow`, `nosnippet`,
`max-snippet:<n>` and `max-image-preview:<value>`, in that order, from the
effective directives. `false` and a `max_snippet` of -1 MUST emit nothing, also
over a site default; 0 MUST be emitted as a limit. `max-snippet` MUST be left
out under `nosnippet`. When no directive is left, the robots tag MUST be left
out.

#### Scenario: Page over site

- **WHEN** the site sets `max_image_preview` large and a page sets `noindex`
- **THEN** robots MUST be `noindex, max-image-preview:large`

#### Scenario: Turning a site default off

- **WHEN** the site sets `nofollow` and `max_snippet` 160, and a page sets `nofollow` false and `max_snippet` -1
- **THEN** the page MUST have no robots tag

#### Scenario: nosnippet wins over a limit

- **WHEN** a page sets `nosnippet` and `max_snippet` 50
- **THEN** robots MUST include `nosnippet` and MUST NOT include `max-snippet`

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

### Requirement: The card hint follows the image size

The card hint MUST be `summary_large_image` when the effective image is at
least 600 pixels wide and 157 pixels tall, else `summary`, also when there is
no image. It MUST use the same rule as the dialog's link preview (seo-dialog),
so that the card the head asks for is the card the editor sees.

#### Scenario: A large image

- **WHEN** the effective image is 1200 by 630 pixels
- **THEN** the card hint MUST be `summary_large_image`

#### Scenario: A small image

- **WHEN** the effective image is 200 by 100 pixels
- **THEN** the card hint MUST be `summary`

#### Scenario: A square logo

- **WHEN** the effective image is 400 by 400 pixels
- **THEN** the card hint MUST be `summary`

#### Scenario: A wide banner

- **WHEN** the effective image is 1200 by 150 pixels
- **THEN** the card hint MUST be `summary`

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

### Requirement: Hreflang links list published translations

When an entity has two or more published translations, the head MUST carry one
`alternate` link per published translation, on its own public URL, plus
`x-default` pointing at the default translation when that one is published.
Every translation MUST carry the same set. With one published translation there
MUST be no alternate links.

#### Scenario: An unpublished translation

- **WHEN** a page has English and French published and German unpublished
- **THEN** the alternates MUST be `en`, `fr` and `x-default`, on both translations

#### Scenario: Only one language left

- **WHEN** the French translation is unpublished
- **THEN** the page MUST have the canonical link only

### Requirement: The head is cacheable and invalidated by what it depends on

The head MUST carry the cacheability of everything it was built from, so that
the page cache and the dynamic page cache serve it and drop it when it changes.
It MUST NOT vary by user or by permissions, because every access check runs for
the anonymous account.

#### Scenario: A cached page

- **WHEN** the same page is requested twice
- **THEN** the second response MUST be a page cache hit, byte for byte the same

### Requirement: Every dependency invalidates the head

A change to any of these MUST invalidate an owned page: the entity, the site
settings, the site name, timezone and front page, the template, the content
type's fields, the order of its form and the media types, the media, files and
labels used, the anonymous role, and the public base (headless-head). A node
page the module does not own MUST be invalidated when a content template is
added or changed. Installing the module MUST invalidate rendered caches.

#### Scenario: A dependency changes

- **WHEN** the site settings, the page, its image media or the site name change
- **THEN** the next request MUST miss the cache and show the new value

#### Scenario: Media access is revoked

- **WHEN** the anonymous role loses the permission to view media
- **THEN** the cached page MUST be invalidated, and the head MUST have no `og:image`

#### Scenario: A configuration override

- **WHEN** `settings.php` overrides the site settings to force `noindex`
- **THEN** every owned page MUST carry `noindex`

#### Scenario: Installing the module

- **WHEN** the module is installed on a site with cached pages
- **THEN** rendered caches MUST be invalidated, so that no cached page keeps core's canonical next to the module's

#### Scenario: The form's order changes

- **WHEN** a site builder moves a person's Photo field below its Avatar field on the Person form, and both hold a public image
- **THEN** the cached person page MUST be invalidated and its `og:image` MUST become the Avatar image

### Requirement: One resolver serves every consumer

The coupled HTML head, the headless `head` member and the `resolved` member of
the dialog's state MUST all be the head the module resolves for the entity, so
that what an editor sees is what a visitor gets. Verdicts, rules and checks
that only the dialog shows MUST be computed for the dialog's state alone and
never while a visitor's head is built.

#### Scenario: Publishing an override

- **WHEN** an editor publishes a page with a title override
- **THEN** the visitor's HTML head MUST carry it once, and the state's `resolved` head for the published page MUST be the same

#### Scenario: A visitor's request

- **WHEN** a visitor requests a product page that misses the page cache
- **THEN** search feature verdicts and structured data rules MUST NOT be computed

### Requirement: A failure costs the head, never the page

When building the head fails, the module MUST log the error to the
`canvas_metatag` channel and serve the page with core's head (and the Metatag
module's, when installed).

#### Scenario: An invalid site timezone

- **WHEN** the resolver throws for a page
- **THEN** the page MUST be served with core's title, no module meta tags and no JSON-LD
- **AND** the error MUST be logged under `canvas_metatag`

### Requirement: The Metatag module stays silent where the head is ours

When the Metatag module is installed, it MUST output nothing for an owned
entity, on every route, including a node's revision, latest-version and preview
routes, where this module emits no head either. Its tokens and computed field
MUST be empty for an owned entity. On everything else Metatag MUST keep
working. When ownership cannot be decided, Metatag MUST stay the fallback.
Installing the module where Metatag is installed MUST say that Metatag's values
are no longer used on owned pages.

#### Scenario: A page with old Metatag values

- **WHEN** a Canvas page carries Metatag values from before the module was installed
- **THEN** its HTML MUST contain one title, one canonical, one robots tag, one `og:title` and one JSON-LD script, all the module's, and nothing of Metatag's

#### Scenario: A node the module does not own

- **WHEN** a node's type has no enabled Full template
- **THEN** its head MUST be Metatag's, without the module's tags

#### Scenario: Installing next to Metatag

- **WHEN** the module is installed, not as part of a configuration import, on a site with Metatag
- **THEN** a status message MUST say that Metatag's values are no longer used for Canvas pages and template-rendered content

### Requirement: Inputs that no longer render are hidden

The Metatag widget MUST be hidden in Canvas's Page data form and in the edit
form of an owned node. Canvas's own search preview in Page data MUST be hidden,
because it cannot know the title's ending.

#### Scenario: The Page data form

- **WHEN** an editor opens a Canvas page's Page data form
- **THEN** the Metatag input and the built-in search preview MUST be hidden, and Canvas's description and image inputs MUST stay

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

### Requirement: Structured data that can't be encoded never removes the head

When the structured data can't be encoded, the head MUST still carry every
other tag the module outputs, robots included, and only the JSON-LD script
MUST be left out. The same MUST hold for the headless head. The dialog's
report MUST say so.

#### Scenario: A value stored before validation

- **WHEN** a no-index page's stored hand-added JSON-LD has an item with a number that can't be encoded (`1e400`)
- **THEN** its head MUST carry its title, description, canonical and `noindex` robots tag, and its JSON-LD MUST leave out that item and keep the others

#### Scenario: Structured data that can't be encoded

- **WHEN** the built structured data can't be encoded
- **THEN** only the JSON-LD script MUST be left out, and the dialog's report MUST carry `unencodable`

### Requirement: A composed value is joined from plain parts

Each field and fact of a composition MUST become plain text on its own before
the parts are joined; typed text MUST NOT be stripped of markup. The joined text
MUST then have its whitespace collapsed, and be escaped and cut as any text of
its place. Fixed names MUST never be filled in it.

#### Scenario: Markup in a field and in typed text

- **WHEN** "Every Event"'s description is Title, " <3 ", Notes, " ", Body, an event's plain text Notes hold `</script><b>VIP</b>`, and its formatted Body holds `<p>Doors <b>open</b></p>`
- **THEN** the description meta tag MUST carry "<3", `</script><b>VIP</b>` and "Doors open" as text, and the HTML MUST contain no element created from them

#### Scenario: A field that holds a fixed name

- **WHEN** an event's Notes field holds `{site}` and the description holds Notes
- **THEN** the description MUST hold `{site}` literally

### Requirement: A composed text too long for its place loses whole fields first

A composed text that is too long for its place, the title's main part, the
social title or a description, MUST first lose whole fields, with the text that
goes with them, from its end, and only then words: none of its joining words
MUST be left dangling.

#### Scenario: A cut composed title

- **WHEN** a composed main part is Title, " in ", City, and an event's title with the ending fills the 255 characters
- **THEN** the title MUST leave out " in ‹city›" before it loses any word of the event's title, and MUST NOT end in " in"

#### Scenario: A cut composed social title

- **WHEN** the social title is Title, " first performed at ", Venue, and an event's title and venue together pass 255 characters
- **THEN** `og:title` MUST be the event's title alone, never ending in " first performed at" or a cut venue

### Requirement: A composed value depends on every field it names

The head MUST carry the cache tags of every field, reference and entity a
composition reads, whether or not it gave a value, and of the site's date
settings. Each distinct field, in each form, MUST be read once per head, and
the host's access for visitors MUST be checked once per head.

#### Scenario: A city added later

- **WHEN** an event's venue has no city, its cached head leaves the city out, and the venue's city is then set
- **THEN** the event's next head MUST hold the city

#### Scenario: The site's country changes

- **WHEN** an administrator changes the site's default country from the United Kingdom to the United States
- **THEN** every cached English head that holds a date in words MUST be replaced, and read "June 20, 2026"

#### Scenario: One field in three places

- **WHEN** the title, the social title and the JSON-LD name each hold Venue › City
- **THEN** building the head MUST read Venue › City once
