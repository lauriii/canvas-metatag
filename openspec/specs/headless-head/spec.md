# headless-head

## Purpose

Give sites that deliver through `canvas_headless` the same head as coupled
pages, as the `head` member of the Canvas content API response, for published
content and for draft previews. Put every address in it on the public base,
where visitors reach the site, and leave the rest of Canvas's response alone.

## Requirements

### Requirement: The content API carries the module's head for owned content

When `canvas_headless` is installed, the content API response for a Canvas page,
or for a node whose content type has an enabled Full content template, MUST
carry the module's head as its `head` member, with exactly the keys `title`,
`meta`, `link` and `script`: the head the coupled HTML carries for the same
entity, replacing Canvas's wholesale. The canonical link MUST be in
`head.link`, although Canvas's own head builder drops canonical links.

#### Scenario: A published page

- **WHEN** a frontend requests a Canvas page through the content API
- **THEN** `head` MUST be the module's title, meta rows, links and JSON-LD script
- **AND** `head.link` MUST contain one canonical link

#### Scenario: A translation

- **WHEN** a frontend requests the French path of a page
- **THEN** `head` MUST be that of the translation Canvas rendered

### Requirement: Only canonical content of the full view is changed

The module MUST change only a response with status 200, for a canonical content
route of a saved entity, whose rendered entity is the one the route names, in
the `full` view mode. For anything else the response MUST be Canvas's own:
routes without an entity, errors, entity preview, revision and latest-version
routes, entities the module does not own, and a preview that asks for another
view mode.

#### Scenario: A route without an entity

- **WHEN** a frontend requests the login page through the content API
- **THEN** `head` MUST be Canvas's own

#### Scenario: Revision and preview routes

- **WHEN** the content controller answers an entity preview, revision or latest-version route of an owned node
- **THEN** `head` MUST be Canvas's own

#### Scenario: A different entity

- **WHEN** the entity Canvas rendered is not the one the route names
- **THEN** `head` MUST be Canvas's own

#### Scenario: Another view mode

- **WHEN** a preview asks for the `teaser` view mode
- **THEN** `head` MUST be Canvas's own

### Requirement: The rest of the response is untouched

Everything in the response other than `head` MUST be byte for byte what Canvas
answers without the module. An empty JSON object anywhere in Canvas's response
MUST stay an object.

#### Scenario: The same response around the head

- **WHEN** a frontend requests an owned page, once with the module's head and once with Canvas's own after a failure
- **THEN** everything before and after `head` MUST be the same bytes

#### Scenario: An empty object

- **WHEN** Canvas's response holds an empty JSON object
- **THEN** the response MUST carry it as `{}`, never as `[]`

### Requirement: Structured data is an object, never markup

`head.script` MUST hold one entry, with `type` `application/ld+json` and
`textContent` the JSON-LD graph as a JSON object, never as a string of HTML.
Serializing it safely into HTML MUST be left to the frontend.

#### Scenario: Reading the script

- **WHEN** a frontend reads `head.script[0]`
- **THEN** it MUST find exactly the keys `type` and `textContent`, and `textContent['@context']` MUST be `https://schema.org`

### Requirement: Drafts are read for a preview token, and for nothing else

A request MUST get the page's draft and the template's draft only when its
token has the preview scope and Canvas has chosen to show drafts for it. Every
other request MUST get the published head, even when the route option that
selects drafts is forced on. A template that was never published MUST give the
head only to a preview. When the frontend asks Canvas to exclude auto-saved
drafts, the head MUST be the published one.

#### Scenario: A visitor and a token without the preview scope

- **WHEN** an anonymous request or a token without the preview scope asks for a page that has a draft
- **THEN** `head` MUST be the published page's

#### Scenario: A preview token

- **WHEN** a preview token asks for a page and a node whose template both have drafts
- **THEN** `head` MUST be built from the page draft and from the template draft

#### Scenario: A template never published

- **WHEN** a node's Full template is disabled but has a draft
- **THEN** a preview token MUST get the module's head from that draft, and an anonymous request MUST get Canvas's own head

#### Scenario: Excluding drafts

- **WHEN** a preview token asks with the query that excludes auto-saved drafts
- **THEN** `head` MUST be the published one

### Requirement: Addresses use the public base

The canonical link, `og:url`, every hreflang link and every JSON-LD `@id` MUST
be on the public base, in coupled and headless output alike. With a language
per domain, addresses MUST stay on the language's Drupal domain. Image
addresses MUST stay on Drupal, where the files are.

#### Scenario: A configured frontend

- **WHEN** the first frontend is `https://www.example.com/shop` and a page sets the canonical `/plans`
- **THEN** the canonical link and `og:url` MUST be `https://www.example.com/shop/plans`, and the page node's `@id` MUST start with `https://www.example.com/shop/`

#### Scenario: The Drupal copy of a page

- **WHEN** a visitor requests a page on Drupal's own address while a frontend is configured
- **THEN** its HTML MUST carry exactly one canonical link, pointing at the frontend copy

#### Scenario: Images

- **WHEN** the head names an image while a frontend is configured
- **THEN** `og:image` MUST be an address on Drupal's own host

### Requirement: The public base has three sources

The public base MUST be, in this order: the `canvas_metatag_public_base`
setting in `settings.php`, when it is an absolute http(s) URL with a host and
without a query, a fragment or credentials, with a trailing slash removed; else
the first `canvas_headless` frontend, when its address is a valid base (later
frontends are never used); else the request's scheme, host and base path.

#### Scenario: The setting wins

- **WHEN** `canvas_metatag_public_base` is `https://www.example.org/` and a frontend is configured
- **THEN** the public base MUST be `https://www.example.org`, without the trailing slash

#### Scenario: A value that is not a base URL

- **WHEN** the setting is a relative path, an ftp address, an address with a query, or one with credentials
- **THEN** it MUST be ignored, and the next source MUST be used

#### Scenario: A frontend address with credentials

- **WHEN** the first frontend is `https://user@www.example.com`
- **THEN** the public base MUST be the request's address

### Requirement: The headless head is cacheable

The response MUST carry the cacheability of everything the head was built
from, so that the page caches store it with the module's head and drop it when
a dependency changes. A response built from a draft MUST depend on Canvas's
auto-save entries; a published response MUST NOT.

#### Scenario: A cached response

- **WHEN** the same path is requested twice
- **THEN** the second response MUST be a page cache hit with the module's head

#### Scenario: A dependency changes

- **WHEN** the site identity name changes
- **THEN** the next response MUST miss the cache and carry the new name

### Requirement: The public base is part of the cacheability

Unless the public base comes from `settings.php`, every head MUST depend on the
`canvas_headless` settings, also before `canvas_headless` is installed, and a
head on the request's address MUST vary by site. The `settings.php` public base
carries no cache tag: a change to it takes effect after a cache rebuild.

#### Scenario: A frontend is configured later

- **WHEN** a page was cached on the request's address and a first frontend is then configured
- **THEN** the cached page MUST be invalidated, in coupled and headless output alike

### Requirement: A failure keeps Canvas's head

When building the head fails, the module MUST log the error to the
`canvas_metatag` channel and return Canvas's response unchanged.

#### Scenario: The resolver throws

- **WHEN** the resolver throws for a page
- **THEN** `head` MUST be Canvas's own, and exactly one error MUST be logged under `canvas_metatag`

### Requirement: The status report says when the headless head is lost

When `canvas_headless` is enabled but its content controller no longer runs
through this module, the status report MUST show an error for "SEO for headless
content". Without `canvas_headless` the module MUST install and work without
it.

#### Scenario: Canvas resolves another controller

- **WHEN** a Canvas update makes the content API resolve a controller that is not the module's
- **THEN** the status report MUST show the error

#### Scenario: The controller is the module's

- **WHEN** the content API runs through the module
- **THEN** the status report MUST NOT show it
