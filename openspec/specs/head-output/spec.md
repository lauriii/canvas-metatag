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
content type, over the site's. The title pattern MUST come from the page or
type when set, else from the site. Robots directives MUST be merged one by one,
the page's or type's winning. Everything else MUST come from the page or type
only: there is no site-wide description, social text, canonical or structured
data. A page translation's inherited settings are described in page-seo.

#### Scenario: Nothing set on the page

- **WHEN** a page titled "Pricing" sets nothing on a site named "Example" with the installed defaults
- **THEN** the title MUST be "Pricing | Example" and robots MUST be `max-image-preview:large`

#### Scenario: A type title pattern

- **WHEN** the Article template sets the title `{title} {sep} Blog` and `nofollow`, and the site sets `max_image_preview` large
- **THEN** an article "Hello" MUST have the title "Hello | Blog" and robots `nofollow, max-image-preview:large`

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

### Requirement: The title follows the pattern, with fallbacks

The title MUST be the effective title pattern with its dynamic values filled
in. A separator with nothing to separate MUST be removed: one at the start or
end, and one that follows another separator. When the result is empty, the
title MUST be the entity's label, else the site name.

#### Scenario: Separators without neighbours

- **WHEN** the pattern is `{sep} {title} {sep} {sep} {field.gone} {site} {sep}`
- **THEN** the title MUST be the page title, one separator and the site name

#### Scenario: A template pattern bound to a field

- **WHEN** a content type's template sets the pattern `{field.field_byline}: {title}`
- **THEN** each node's title MUST use that node's own field value, and saving the node or the template MUST change it

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

The description MUST be the type's description pattern, filled in, when one is
set. Otherwise it MUST be the entity's own description, `{description}`
(dynamic-values). There is no site-wide description.

#### Scenario: A template description bound to a field

- **WHEN** an Article template sets the description `{field.field_summary}`
- **THEN** each article's description MUST be its own summary field

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

`og:title` MUST be the social title, else the entity's label. `og:description`
MUST be the social description, else the description. `og:url` MUST equal the
canonical link. `og:site_name` MUST be `{site}`.

#### Scenario: Social overrides

- **WHEN** a page sets the social title `{title}: compare` and the social description "See every plan."
- **THEN** `og:title` MUST be the page title followed by ": compare", and `og:description` MUST be "See every plan."

#### Scenario: No social overrides

- **WHEN** a page sets no social text
- **THEN** `og:title` MUST be the page title and `og:description` the description

### Requirement: The page type sets og:type and the article times

`og:type` MUST be `article` for the Article, Blog post and News article types,
`profile` for Profile, and `website` otherwise. `article:published_time` and
`article:modified_time` MUST be emitted only with `og:type` `article`, as
`{published}` and `{modified}`.

#### Scenario: An article

- **WHEN** a page's structured data type is Article
- **THEN** `og:type` MUST be `article` and both `article:*` times MUST be present

#### Scenario: A web page

- **WHEN** a page has no structured data type
- **THEN** `og:type` MUST be `website` and there MUST be no `article:*` rows

### Requirement: The card hint follows the image size

The card hint MUST be `summary_large_image` when the effective image is at
least 300 by 157 pixels, else `summary`, also when there is no image.

#### Scenario: A large image

- **WHEN** the effective image is 1200 by 630 pixels
- **THEN** the card hint MUST be `summary_large_image`

#### Scenario: A small image

- **WHEN** the effective image is 200 by 100 pixels
- **THEN** the card hint MUST be `summary`

### Requirement: The social image follows a chain

The image MUST be the first of these that resolves: the social image override
(a media item or an image dynamic value), `{image}` (dynamic-values), the site's
default image. A media item MUST resolve only when its source is an image, an
anonymous visitor may view the media and the file, and the file is in the
public file system. The image MUST be the original file with its stored size,
on Drupal's own address, where the files are. Width and height MUST be left out
when they are unknown.

#### Scenario: An override visitors cannot see

- **WHEN** the override is unpublished media, or a file outside the public file system
- **THEN** the page's own image MUST be used instead

#### Scenario: No usable page image

- **WHEN** the page image is not usable and the site has a default image
- **THEN** `og:image` and `og:image:alt` MUST be the site default's

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
type's fields and the media types, the media, files and labels used, the
anonymous role, and the public base (headless-head). A node page the module
does not own MUST be invalidated when a content template is added or changed.
Installing the module MUST invalidate rendered caches.

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

### Requirement: One resolver serves every consumer

The coupled HTML head, the headless `head` member and the `resolved` member of
the dialog's state MUST all be the head the module resolves for the entity, so
that what an editor sees is what a visitor gets.

#### Scenario: Publishing an override

- **WHEN** an editor publishes a page with a title override
- **THEN** the visitor's HTML head MUST carry it once, and the state's `resolved` head for the published page MUST be the same

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
because it cannot know the title pattern.

#### Scenario: The Page data form

- **WHEN** an editor opens a Canvas page's Page data form
- **THEN** the Metatag input and the built-in search preview MUST be hidden, and Canvas's description and image inputs MUST stay
