## ADDED Requirements

### Requirement: Empty rows and unusable links are left out

A row of the head whose value is empty MUST be left out. A link whose address
is not an absolute http(s) URL MUST be left out. This holds for the fixed rows,
the added tags and rows added by a module.

#### Scenario: An empty row from a module

- **WHEN** a module adds a meta row whose content is empty
- **THEN** the head MUST NOT carry that row

#### Scenario: A relative link from a module

- **WHEN** a module adds a link row whose address is `/feed.xml`
- **THEN** the head MUST NOT carry that link

### Requirement: Repeated tags are all emitted

When the head has several rows with the same name, property or relation, the
coupled HTML MUST carry every one of them, in order, as the headless head does.

#### Scenario: Two verification codes for one service

- **WHEN** the site has two codes for the same verification name
- **THEN** an owned page's HTML MUST carry two meta tags with that name, one per code

### Requirement: AI use is one tag per directive

AI answers and AI training MUST be emitted as meta tags named for the one
crawler that reads them, one tag per directive: AI answers "Its own AI only"
as `ai-grounding:disallowextended`, "Not allowed" as `ai-grounding:disallow`;
AI training "Not allowed" as `ai-training:disallow`. "Allowed" MUST emit
nothing, also over a site default. They merge one by one like robots.

#### Scenario: Both directives

- **WHEN** the site sets AI training "Not allowed" and a page sets AI answers "Its own AI only"
- **THEN** the page MUST carry two AI use meta tags, `ai-grounding:disallowextended` and then `ai-training:disallow`, and robots MUST NOT carry either

#### Scenario: Allowed over a site default

- **WHEN** the site sets AI training "Not allowed" and a page sets it "Allowed"
- **THEN** the page MUST carry no AI use tag

### Requirement: The stop date is emitted with its offset

A stop date MUST be emitted as an ISO 8601 date and time with the offset of the
site's time zone. A date without a time MUST mean the end of that day,
23:59:59, in the site's time zone.

#### Scenario: A date only

- **WHEN** a page in a site in the Helsinki time zone sets the stop date 2027-03-12
- **THEN** robots MUST include `unavailable_after:2027-03-12T23:59:59+02:00`

#### Scenario: A linked date that is empty

- **WHEN** "Every Event" links the stop date to End date and an event has none
- **THEN** that event's head MUST carry no `unavailable_after` and no `article:expiration_time`

### Requirement: Verification codes are on every owned page

Each verification code of the site MUST be emitted as one meta tag, named for
its service, with the code as its content, on every route the module owns, in
both deliveries. Routes the module does not own MUST NOT get them.

#### Scenario: A code and an unowned front page

- **WHEN** the site has a verification code and the front page is a Views page
- **THEN** every Canvas page MUST carry the code, and the front page MUST be the same as without the module

### Requirement: Modules can change the head in code

A module MAY add, change or remove rows of the head in code before any consumer
gets it. Its rows MUST reach the coupled head, the headless head and the
dialog's Output. They MUST then pass a structural check: meta and link only,
scalar attributes, no attribute starting with `on`, links absolute http(s),
empty rows left out. The policy of other-tags MUST NOT apply to them.

#### Scenario: A module adds a manifest link

- **WHEN** a module adds a `manifest` link to the head of every owned page
- **THEN** the coupled HTML and the headless `head.link` MUST carry it, and the Output sheet MUST say "Added by" and the module's name

#### Scenario: A row with an event attribute

- **WHEN** a module adds a meta row with an `onload` attribute
- **THEN** the row MUST be left out, and the error MUST be logged under `canvas_metatag`

#### Scenario: A module adds a script

- **WHEN** a module adds an entry to the head's scripts
- **THEN** the head MUST carry the module's JSON-LD script only

### Requirement: Metatag's other tags are the outermost layer

With Metatag installed, the module MUST read Metatag's tags for an owned
entity, with its global, entity type and bundle defaults, and use
them as the outermost layer of other tags (other-tags). A Metatag tag MUST be
left out when the module sets its key from its own settings, when the head
already carries that key, or when the other-tags policy refuses it. When
reading Metatag's tags fails, or would make the head vary by user, the head
MUST be built without them and the error logged.

#### Scenario: A verification tag set in Metatag

- **WHEN** Metatag's global defaults hold a verification tag, a theme colour and an `og:image`, and the site sets no code for that verification name
- **THEN** an owned page MUST carry the verification tag and the theme colour once each, in both deliveries, and MUST NOT carry Metatag's `og:image`

#### Scenario: The site sets the same verification name

- **WHEN** Metatag's defaults hold a code for a verification name and the site has its own code for that name
- **THEN** an owned page MUST carry the site's code only

#### Scenario: Turned off on one page

- **WHEN** a page turns off a key that comes from Metatag
- **THEN** that page MUST NOT carry it, and other owned pages MUST

#### Scenario: Metatag's defaults change

- **WHEN** an administrator changes Metatag's global defaults
- **THEN** the next request for a cached owned page MUST show the change

#### Scenario: A default that depends on the visitor

- **WHEN** a Metatag default uses a value of the current user
- **THEN** owned pages MUST carry no Metatag tag, the page cache MUST still serve them, and the error MUST be logged once per request under `canvas_metatag`

## MODIFIED Requirements

### Requirement: Effective values layer the target over the site

The values a head is built from MUST be those of the page, or of the node's
content type, over the site's. The title's main part MUST come from the page or
type only. The title ending MUST come from the page or type, else the site,
else it MUST be the Site name. Robots directives, AI use included, MUST be
merged one by one, the page's or type's winning. Other tags MUST layer per key
(other-tags). Everything else MUST come from the page or type only. What a
translation inherits is in page-seo.

#### Scenario: Nothing set on the page

- **WHEN** a page titled "Pricing" sets nothing on a site named "Example" with the installed defaults
- **THEN** the title MUST be "Pricing | Example" and robots MUST be `max-image-preview:large`

#### Scenario: A type title pattern

- **WHEN** the Article template sets the title ending "Blog" and `nofollow`, and the site sets `max_image_preview` large
- **THEN** an article "Hello" MUST have the title "Hello | Blog" and robots `nofollow, max-image-preview:large`

#### Scenario: A site ending

- **WHEN** the site sets the title ending "Example Co" and a page sets only its main part "Pricing"
- **THEN** the page's title MUST be "Pricing | Example Co"

#### Scenario: Site tags and a page's own

- **WHEN** the site sets the row `dcterms.rights` and a page sets the row `rating`
- **THEN** the page MUST carry both rows, the site's first

### Requirement: The head has fixed rows in a fixed order

The head MUST consist of the title and these rows, in this order: meta
`description`, meta `robots`, the AI use tags, `og:type`, `og:site_name`,
`og:title`, `og:description`, `og:url`, `og:image`, `og:image:width`,
`og:image:height`, `og:image:alt`, `article:published_time`,
`article:modified_time`, `article:expiration_time`, the card hint, the
verification codes, then the other meta tags; then the canonical link, the
hreflang links, the other links, and the JSON-LD script.

#### Scenario: Nothing to say

- **WHEN** a page has no description, no title, no image and no site default image
- **THEN** the description, `og:title`, `og:description` and every `og:image` row MUST be left out
- **AND** the title MUST be the site name

#### Scenario: Every kind of row

- **WHEN** a page has AI use set, the site has a verification code, an other meta tag and an other link
- **THEN** the AI use tags MUST follow robots, the verification code MUST follow the card hint, the other meta tag MUST follow the verification code, and the other link MUST follow the hreflang links

### Requirement: Robots directives are built from fixed names

The robots meta tag MUST list only `noindex`, `nofollow`, `nosnippet`,
`max-snippet:<n>`, `max-image-preview:<value>`, `max-video-preview:<n>`,
`noimageindex` and `unavailable_after:<date>`, in that order, from the
effective directives. `false` and a `max_snippet` or `max_video_preview` of -1
MUST emit nothing, also over a site default; 0 MUST be emitted as a limit.
`max-snippet` MUST be left out under `nosnippet`. When no directive is left,
the robots tag MUST be left out.

#### Scenario: Page over site

- **WHEN** the site sets `max_image_preview` large and a page sets `noindex`
- **THEN** robots MUST be `noindex, max-image-preview:large`

#### Scenario: Turning a site default off

- **WHEN** the site sets `nofollow` and `max_snippet` 160, and a page sets `nofollow` false and `max_snippet` -1
- **THEN** the page MUST have no robots tag

#### Scenario: nosnippet wins over a limit

- **WHEN** a page sets `nosnippet` and `max_snippet` 50
- **THEN** robots MUST include `nosnippet` and MUST NOT include `max-snippet`

#### Scenario: Video, image search and a stop date

- **WHEN** the site sets `max_image_preview` large and `max_video_preview` 0, and a page sets `noimageindex` and the stop date 2027-03-12 in a site in UTC
- **THEN** robots MUST be `max-image-preview:large, max-video-preview:0, noimageindex, unavailable_after:2027-03-12T23:59:59+00:00`

### Requirement: The page type sets og:type and the article times

`og:type` MUST be `article` for the Article, Blog post and News article types,
`profile` for Profile, and `website` otherwise. `article:published_time` and
`article:modified_time` MUST be emitted only with `og:type` `article`, as the
First published and Last updated facts. `article:expiration_time` MUST be emitted only
with `og:type` `article` and a stop date, as the stop date.

#### Scenario: An article

- **WHEN** a page's structured data type is Article
- **THEN** `og:type` MUST be `article` and both `article:*` times MUST be present

#### Scenario: A web page

- **WHEN** a page has no structured data type
- **THEN** `og:type` MUST be `website` and there MUST be no `article:*` rows

#### Scenario: An article with a stop date

- **WHEN** an Article page sets the stop date 2027-03-12 in a site in UTC
- **THEN** `article:expiration_time` MUST be `2027-03-12T23:59:59+00:00`

#### Scenario: A web page with a stop date

- **WHEN** a page without a structured data type sets a stop date
- **THEN** robots MUST carry it and there MUST be no `article:expiration_time`

### Requirement: The Metatag module stays silent where the head is ours

When installed, the Metatag module MUST output nothing itself for an owned
entity, on every route, including a node's revision, latest-version and
preview routes, where this module emits no head either. Its tokens and computed
field MUST be empty for an owned entity. On everything else Metatag MUST keep
working. When ownership cannot be decided, Metatag MUST stay the fallback.
Installing the module where Metatag is installed MUST say which of Metatag's
values are no longer used on owned pages.

#### Scenario: A page with old Metatag values

- **WHEN** a Canvas page carries Metatag values from before the module was installed
- **THEN** its HTML MUST contain one title, one canonical, one robots tag, one `og:title` and one JSON-LD script, all the module's

#### Scenario: A node the module does not own

- **WHEN** a node's type has no enabled Full template
- **THEN** its head MUST be Metatag's, without the module's tags

#### Scenario: Installing next to Metatag

- **WHEN** the module is installed, not as part of a configuration import, on a site with Metatag
- **THEN** a status message MUST say that Metatag's title, description, robots and social values are no longer used for Canvas pages and template-rendered content, and that its other tags stay and can be turned off in the SEO dialog
