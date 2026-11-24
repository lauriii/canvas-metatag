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

### Requirement: A frontend on the SDK's metadata adapter can render the whole head

The README MUST give one recipe for `@drupal-canvas/headless-next` that turns
the content API head into the framework's metadata and elements with no row,
link or script lost, and that inherits no description or canonical the head
leaves out. Its helper MUST be one example file that the README quotes. A test
MUST run the helper on the module's head and fail when anything is lost.

#### Scenario: An article's image details and times

- **WHEN** the recipe is applied to the content API head of a published article with an image
- **THEN** the metadata MUST hold the image's address, width, height and alt text as one Open Graph image, and the article's publication and modification times

#### Scenario: No description

- **WHEN** the head of a page has no description row
- **THEN** the recipe's metadata MUST set the description to the empty string, so that no layout's description is inherited

#### Scenario: No canonical

- **WHEN** the head of a page has neither a canonical link nor hreflang links
- **THEN** the recipe's metadata MUST set its alternates to null, so that no layout's canonical is inherited

#### Scenario: Structured data

- **WHEN** the recipe's JSON-LD component renders a head
- **THEN** it MUST render one `application/ld+json` script whose text parses back to `head.script[0].textContent` and contains no `</script`

#### Scenario: A row the recipe does not handle

- **WHEN** a later change adds a meta row to the head that the recipe does not map
- **THEN** the test MUST fail and name the row

#### Scenario: The README and the file differ

- **WHEN** the example file changes and the README's quote of it does not
- **THEN** the test MUST fail

### Requirement: Page addresses on a host no visitor reaches are left out

When the public base comes from the setting or a frontend and is on a
non-public host (see "Hosts no visitor reaches"), and Drupal's own host is
not a development host, the head MUST carry no canonical, `og:url`, hreflang
or JSON-LD script, in coupled and headless output alike, and the dialog's
report MUST carry `unaddressed`.

#### Scenario: A development frontend in production

- **WHEN** a page is fetched through the content API at `https://cms.example.com`, no public base is set, and the first frontend is `http://localhost:3000`
- **THEN** its head MUST carry no canonical, `og:url`, hreflang or JSON-LD script, and MUST keep its title, description and `og:image`

#### Scenario: A development site

- **WHEN** the same page is fetched at `https://cms.example.test`
- **THEN** its canonical MUST be on `http://localhost:3000`

#### Scenario: Plain http on a public host

- **WHEN** the first frontend is `http://www.example.com` and the page is fetched at `https://cms.example.com`
- **THEN** its canonical MUST be on `http://www.example.com`

### Requirement: Hosts no visitor reaches

A host is non-public when it is a loopback, private, shared or link-local IP
in any spelling a browser reads, a single-label host, a name whose last label
is a number, or a host under `localhost`, `local`, `test`, `example`,
`internal`, `invalid`, `home.arpa` or a known local development suffix.
Nothing MUST be looked up.

#### Scenario: Spellings a browser reads

- **WHEN** a host is `127.1`, `2130706433`, `0177.0.0.1`, `0x7f000001` or `[::ffff:127.0.0.1]`
- **THEN** it MUST be non-public and a development host, as `127.0.0.1` is; `0.0.0.0` and `[::]`, where development servers listen, MUST be too

#### Scenario: Another spelling of a loopback address

- **WHEN** `canvas_metatag_public_base` is `http://127.1:3000`, `http://[::ffff:127.0.0.1]:3000` or `http://0177.0.0.1:3000` and the page is fetched at `https://cms.example.com`
- **THEN** its head MUST carry no canonical, as for `http://localhost:3000`, and the status report MUST show the error naming that address

#### Scenario: A frontend Canvas refuses

- **WHEN** the first frontend is `http://127.1:3000` or `http://[::ffff:127.0.0.1]:3000`, which Canvas does not accept as a frontend, and the page is fetched at `https://cms.example.com`
- **THEN** its addresses MUST be on `https://cms.example.com`, the request's, and the status report MUST NOT show the row

#### Scenario: A known local development suffix in production

- **WHEN** the first frontend is `https://front.ddev.site` and the page is fetched at `https://cms.example.com`
- **THEN** its head MUST carry no canonical, and the status report MUST show the error

#### Scenario: A name under .local

- **WHEN** the first frontend is `https://mysite.local` and the page is fetched at `https://cms.example.com`
- **THEN** its head MUST carry no canonical

### Requirement: Development hosts

A development host is a loopback or unspecified address in any spelling,
`localhost`, a host under `localhost`, `test` or `invalid`, or one under a
known local development suffix. Nothing MUST be looked up. Every other host,
a private address or an internal name included, MUST count as
production-like.

#### Scenario: Drupal on an internal name

- **WHEN** Drupal is reached at `https://cms.internal` and the first frontend is `http://localhost:3000`
- **THEN** the head MUST carry no canonical: an internal name is production-like, not a development host

#### Scenario: Drupal on a development host

- **WHEN** the same page is fetched at `https://cms.example.test`, or at a host under a known local development suffix
- **THEN** its canonical MUST be on `http://localhost:3000`

### Requirement: The status report flags a public base no visitor can use

The status report MUST show "SEO public addresses" as an error when the public
base comes from the setting or a frontend and is plain http or on a non-public
host: a warning while Drupal's own host is a development host, and absent when
the base is on a development host too. A base from the request that is plain
http on a public host MUST be a warning on a production-like Drupal host. Each
message MUST name the address, what is wrong with it, and its fix.

#### Scenario: A development frontend in production

- **WHEN** the status report is viewed at `https://cms.example.com`, no public base is set, and the first frontend is `http://localhost:3000`
- **THEN** it MUST show an error naming `http://localhost:3000` and the `canvas_metatag_public_base` setting

#### Scenario: A local frontend on a development site

- **WHEN** the same configuration is viewed at `https://cms.example.test`
- **THEN** the status report MUST NOT show the row

#### Scenario: A plain http frontend on a known local suffix

- **WHEN** the first frontend is plain http under a known local development suffix and the status report is viewed at `https://cms.example.test`
- **THEN** the status report MUST NOT show the row

#### Scenario: A plain http frontend in production

- **WHEN** the first frontend is `http://www.example.com` and the status report is viewed at `https://cms.example.com`
- **THEN** it MUST show an error naming `http://www.example.com`, saying it is not https, and naming the `canvas_metatag_public_base` setting

#### Scenario: A plain http frontend on a development site

- **WHEN** the first frontend is `http://www.example.com` and the status report is viewed at `https://cms.example.test`
- **THEN** it MUST show a warning, not an error

#### Scenario: A public base set for the environment

- **WHEN** the setting is `https://www.example.com` and the first frontend is `http://localhost:3000`
- **THEN** the status report MUST NOT show the row

#### Scenario: Plain http behind a proxy

- **WHEN** neither a frontend nor the setting is configured and the status report is viewed at `http://www.example.com`
- **THEN** it MUST show a warning that names Drupal's reverse proxy settings

### Requirement: A public base setting that is not an address is reported

A `canvas_metatag_public_base` that is not an absolute http or https address
without a query or fragment is ignored. The status report row "SEO public
addresses" MUST then name its value and the address pages use instead: an
error, a warning while Drupal's own host is a development host.

#### Scenario: A setting that is not an address

- **WHEN** the setting is `www.example.com`, the first frontend is `http://localhost:3000`, and the status report is viewed at `https://cms.example.com`
- **THEN** it MUST show an error naming `www.example.com`, saying it is not an absolute http or https address and that pages use `http://localhost:3000`
