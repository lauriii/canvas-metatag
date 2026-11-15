## ADDED Requirements

### Requirement: Each head is built for one frontend

While `canvas_headless` has frontends, every address in a head MUST be built
for one of them: the canonical link, `og:url`, hreflang links, JSON-LD `@id`s
and URLs, breadcrumb items, `{url}`, `{home}`, linked addresses of the site and
image addresses. On the content API it MUST be the frontend the request
selects. Drupal's own pages, the dialog and commands MUST use the frontend they
name, else the default frontend: the first `canvas_headless` frontend.

#### Scenario: Two frontends

- **WHEN** the frontends are `https://www.example.com` and `https://shop.example.com`, and a content API request for `/about` selects `https://shop.example.com`
- **THEN** the canonical link and `og:url` MUST be `https://shop.example.com/about`, and every `@id` MUST start with `https://shop.example.com/`

#### Scenario: One frontend

- **WHEN** `https://www.example.com` is the only frontend and a content API request for `/about` names none
- **THEN** every address MUST be on `https://www.example.com`

#### Scenario: Drupal's own copy

- **WHEN** the same two frontends are configured and a visitor requests `/about` on Drupal's own address
- **THEN** its canonical link MUST be `https://www.example.com/about`

### Requirement: A frontend names itself in the content API address

A content API request MAY carry `canvasFrontend` in the query of its
`requestUri`: the address the frontend runs at. It MUST count only when that
literal name occurs once, with a string value. Lowercased, without a default
port and without one trailing slash, it MUST select the frontend that has it
as its address, public address or a language address, or whose preview
address it matches. A request with no frontend named selects the only
frontend, when there is one.

#### Scenario: Another spelling

- **WHEN** a request for `/about?canvasFrontend=HTTPS://Shop.Example.com:443/` arrives
- **THEN** the head MUST be the one built for `https://shop.example.com`

#### Scenario: Named twice

- **WHEN** `requestUri` carries `canvasFrontend` twice, or under an encoded name such as `canvasFronten%64`
- **THEN** the request MUST select no frontend

### Requirement: Nothing but the name selects a frontend

Headers, the request's host, `Origin`, `Referer`, forwarded hosts, the consumer
and the token MUST NOT select a frontend, and page addresses MUST NOT depend on
them. Images without an image address follow Drupal's own file address.

#### Scenario: Forged headers

- **WHEN** an anonymous request names `https://www.example.com` and carries `X-Forwarded-Host: shop.example.com` with the reverse proxy trusted, `Origin: https://shop.example.com`, `X-Consumer-ID` and a different `Host` allowed by the trusted host patterns
- **THEN** its page addresses MUST be the same as without those headers, and the next request naming `https://www.example.com` MUST be a page cache hit with the same head

### Requirement: A request that selects no frontend gets no addresses

When a content API request selects no frontend while two or more exist, or
names a value that selects none, its head MUST carry no page or image address:
no canonical, `og:url`, hreflang, JSON-LD script or image rows. It MUST NOT add
`noindex`. A response to a value that selects none MUST NOT be stored by
Drupal's page cache and MUST be sent as private.

#### Scenario: Not named

- **WHEN** the frontends are `https://www.example.com` and `https://shop.example.com`, and a request for `/about` names none
- **THEN** the head MUST carry no canonical, `og:url`, hreflang, image row or JSON-LD script, and its robots MUST be the page's own

#### Scenario: A misspelled name

- **WHEN** a request names `https://shop.exmaple.com`
- **THEN** the head MUST carry no address, and the second identical anonymous request MUST be a page cache miss sent with `private`

### Requirement: Selection is unambiguous

A frontend's own address or public address MUST win over another frontend's
language address, and any exact address over a preview address. Saving the
address settings MUST refuse a public address equal to another frontend's
address or public address, a language address of two frontends, a preview
address that matches an entry's address, public address or language address,
and preview addresses of two frontends that can match one host.

#### Scenario: A language on another frontend

- **WHEN** `https://www.example.com` has the French address `https://www.example.net`, which is also a frontend, and a request names `https://www.example.net`
- **THEN** the head MUST be built for the frontend `https://www.example.net`

#### Scenario: Overlapping previews

- **WHEN** an administrator gives `https://www.example.com` the preview address `https://*.preview.example.com` and `https://shop.example.com` the preview address `https://shop-*.preview.example.com`
- **THEN** the save MUST be refused, naming both

### Requirement: One frontend's head never serves another

A head MUST vary by the frontend the request selected, in the page cache and
in the dynamic page cache, so that a response cached for one frontend is never
sent for another, nor for a request that selects none.

#### Scenario: Taking turns

- **WHEN** anonymous requests for `/about` name `https://shop.example.com`, then nothing, then `https://shop.example.com`, then nothing
- **THEN** the third and fourth MUST be page cache hits, the third with the shop's head and the fourth with no addresses

#### Scenario: Behind the page cache

- **WHEN** the page cache is bypassed and requests for `/about` name each frontend in turn, twice
- **THEN** the second of each MUST be a dynamic page cache hit with its own frontend's head

### Requirement: Each frontend's addresses are configured with it

`canvas_metatag.addresses` MUST hold entries with, optionally: a public
address, whether page addresses end in a slash, an address per language, an
image address and preview addresses. An entry MUST apply to the
`canvas_headless` frontend with its address or public address, and as a
preview to one that matches its preview addresses. Without an entry, a
frontend MUST use its own address, no slash, every language on it, images on
Drupal and no previews.

#### Scenario: One frontend and no settings

- **WHEN** the only frontend is `https://www.example.com` and the address settings are empty
- **THEN** the canonical link of `/about` MUST be `https://www.example.com/about`, and `og:image` MUST be Drupal's own file address

#### Scenario: Editors preview at another address

- **WHEN** the frontend `https://preview.example.com` has the public address `https://www.example.com`
- **THEN** heads built for it MUST be on `https://www.example.com`, and a request naming `https://www.example.com` MUST select it

#### Scenario: A staging environment

- **WHEN** staging overrides the frontends to `https://staging.example.com`, and the entry for `https://www.example.com` has the preview address `https://staging.example.com` and an image address
- **THEN** heads for the staging frontend MUST be on `https://staging.example.com` with `noindex`, and images MUST use the entry's image address

### Requirement: Address settings are validated

Saving or importing the address settings MUST refuse: an entry whose address
is not a valid frontend address, two entries for one frontend, a public or
language address that is not an absolute http(s) base without credentials,
query, fragment or trailing slash, an unknown language, an invalid image
address and an invalid preview address. A refused value set in `settings.php`
MUST be ignored and reported.

#### Scenario: An override in the settings file

- **WHEN** `settings.php` overrides a frontend's public address with `https://user:pass@www.example.com`
- **THEN** heads MUST use the frontend's own address, and the status report MUST show an error naming the override

### Requirement: Page addresses follow the frontend's form

A page's address MUST be its language's address, followed by its Drupal path
without the base path and script name, and without Drupal's language prefix
when the frontend has an address for that language. The request's query MUST
NOT enter it. With the slash setting, an address with a path MUST end in `/`
before any query. A path override MUST be put on the same address, in the same
form. An address on another frontend MUST take that frontend's form.

#### Scenario: A trailing slash

- **WHEN** the frontend ends addresses in a slash
- **THEN** the canonical link of `/about` MUST be `https://www.example.com/about/`, that of a page with the canonical path `/plans?ref=1` `https://www.example.com/plans/?ref=1`, and the front page's `https://www.example.com/`

#### Scenario: A tracking parameter

- **WHEN** a request for `/about?utm_source=x` is resolved
- **THEN** the canonical link MUST be `https://www.example.com/about`

#### Scenario: A language on its own domain

- **WHEN** French has the address `https://fr.example.com` and Drupal's French prefix is `fr`
- **THEN** the French page `/fr/a-propos` MUST have the canonical `https://fr.example.com/a-propos`, and the English page's French alternate MUST be the same

#### Scenario: Another locale prefix

- **WHEN** French has the address `https://www.example.com/fr-fr`
- **THEN** the French page `/fr/a-propos` MUST have the canonical `https://www.example.com/fr-fr/a-propos`

#### Scenario: A path override in French

- **WHEN** the French translation sets the canonical `/offres` and French has the address `https://fr.example.com`
- **THEN** its canonical link MUST be `https://fr.example.com/offres`

### Requirement: The home address is the front page's

A language's front page address MUST be its address followed by `/` when that
has no path, and otherwise in the frontend's slash form. `{home}` MUST be the
front page address of the frontend's public address, or of the preview
address, in every language, so that every page one frontend serves names one
identity and the home address matches the front page's canonical link.

#### Scenario: A French page on its own domain

- **WHEN** French has the address `https://fr.example.com` and a French page is resolved for `https://www.example.com`
- **THEN** its identity `@id` MUST be `https://www.example.com/#identity`

#### Scenario: A frontend under a path

- **WHEN** the frontend's public address is `https://example.com/shop` without the slash setting
- **THEN** the front page's canonical link and the `WebSite` `url` MUST both be `https://example.com/shop`, and the identity `@id` MUST be `https://example.com/shop#identity`

### Requirement: An address that can't be known is left out

When an address can't be built for the frontend, the rows that need it MUST be
left out, never put on another host. This covers a language Drupal finds by its
domain that the frontend has no address for, content API output with no
frontend and no public address setting, and an image the image address can't
describe. A page without its own address MUST carry no canonical, `og:url` or
JSON-LD script.

#### Scenario: A language found by its domain

- **WHEN** Drupal finds German by the domain `de.cms.example.com` and the frontend has no German address
- **THEN** no head MUST carry a German alternate, and the German page MUST carry no canonical, `og:url` or JSON-LD script

#### Scenario: A headless site without a frontend

- **WHEN** a frontend fetches `/about` through the content API at `http://cms.internal:8080`, no frontend is configured and no public address is set
- **THEN** the head MUST carry no canonical, `og:url`, hreflang or JSON-LD script

#### Scenario: An image address that needs a size

- **WHEN** the image address uses `{width}` and the logo's file has no stored size
- **THEN** the graph MUST have no logo node

### Requirement: Image addresses go through the frontend's image address

Every image the module emits, made images included, MUST be addressed through
the frontend's image address: `{base}` is the frontend's public or preview
address, never a language address; `{path}` the image's root-relative Drupal
path without Drupal's base path; `{source}` its Drupal address encoded as one
query value; `{width}` its width. Other files MUST be on `{base}{path}`.
Without an image address, all MUST be Drupal's own file address.

#### Scenario: A proxied path

- **WHEN** the image address is `{base}{path}`, French has the address `https://www.example.com/fr-fr`, and a page's image is `public://hero.jpg`
- **THEN** JSON-LD images of it MUST be `https://www.example.com/sites/default/files/hero.jpg` on the English and the French page alike

#### Scenario: An image service

- **WHEN** the image address is `https://img.example.com{path}?w={width}` and a page shares a made card
- **THEN** `og:image` MUST be `https://img.example.com/canvas-metatag/share/` followed by the card's path and `?w=1200`, with `og:image:type` `image/png`, `og:image:width` 1200 and `og:image:height` 630

#### Scenario: A linked file

- **WHEN** the image address is `https://img.example.com{path}?w={width}` and a value links `public://guide.pdf`
- **THEN** its address MUST be `https://www.example.com/sites/default/files/guide.pdf`

#### Scenario: A Drupal installed under a path

- **WHEN** Drupal runs under `/cms` and the image address is `{base}{path}`
- **THEN** the image `public://hero.jpg` MUST be `https://www.example.com/sites/default/files/hero.jpg`

### Requirement: An image address can only fill in a path

An image address MUST be `{base}` followed by a path, or an absolute http(s)
address with a literal host, and tokens MUST appear only after the first `/`
of its path. It MUST use `{path}` or `{source}`, and no token but `{base}`,
`{path}`, `{source}` and `{width}`. Declared image type and size MUST stay
those of the image the module sends.

#### Scenario: An image address without the image

- **WHEN** an administrator imports the image address `https://img.example.com/fixed.jpg`
- **THEN** the import MUST be refused, naming the image address

#### Scenario: A host made from a token

- **WHEN** an administrator saves the image address `https://img{path}`
- **THEN** the save MUST be refused

### Requirement: Images on a host no crawler reaches are left out

On the content API, when a frontend has no image address and no public file
address is set, an image whose Drupal address is on a non-public host MUST be
left out: a loopback, private or link-local IP, a single-label host, or a host
under `localhost`, `local`, `test`, `internal` or `invalid`.

#### Scenario: Fetched over an internal host

- **WHEN** a frontend without an image address fetches a page with an image through the content API at `http://cms.internal:8080`
- **THEN** the head MUST carry no `og:image` and no JSON-LD image, and its canonical link MUST be on the frontend

### Requirement: Public output can keep Drupal's host out

When the selected frontend's image address uses neither `{source}` nor one of
Drupal's hosts, no head row, JSON-LD value or response header the module adds
MUST contain one of Drupal's hosts, raw, percent-encoded, JSON-escaped or
base64-encoded, whatever host the frontend called Drupal at, for published
pages and drafts alike. Drupal's hosts are the request's host, the language
domains and the public file host. Values an editor typed MUST be emitted as
typed.

#### Scenario: A private CMS

- **WHEN** a frontend fetches an owned page with an image, a made card, a logo, translations, breadcrumbs, a linked internal page and a linked file through the content API at `http://cms.internal:8080`, and its image address is `{base}{path}`
- **THEN** no form of `cms.internal` MUST appear in `head` or in a header the module adds

#### Scenario: A draft

- **WHEN** the same frontend fetches the page's draft with a preview token
- **THEN** no form of `cms.internal` MUST appear in `head`

#### Scenario: A typed address

- **WHEN** an editor typed the canonical `https://cms.example.com/x`
- **THEN** the canonical link MUST be that address, and Checks MUST report it (seo-checks)

### Requirement: Preview addresses are narrow

A preview address MUST be a base whose first host label holds one `*`: alone,
with at least three labels after it, or beside fixed text, with at least two.
A pattern without `*` is one exact address. A declared value MUST match the
whole host, scheme, port and the pattern's path exactly. Saving MUST refuse a
`*` anywhere else, credentials, a query and a fragment.

#### Scenario: A look-alike host

- **WHEN** `https://*.preview.example.com` is a preview address and a request names `https://feat-42.preview.example.com.example.net`
- **THEN** the request MUST select no frontend

#### Scenario: Another path

- **WHEN** a request names `https://feat-42.preview.example.com/x`
- **THEN** the request MUST select no frontend

#### Scenario: A pattern that is too wide

- **WHEN** an administrator saves the preview address `https://*.hosting.example`
- **THEN** the save MUST be refused, and `https://feat-*.hosting.example` MUST be accepted

### Requirement: Preview heads are on the preview address and not indexed

A request selecting a preview address MUST get every address on it, built from
the pattern with the declared host filled in, language addresses unused, and
`noindex` added first to robots. Its response MUST NOT be stored by Drupal's
page cache or the dynamic page cache, and MUST be sent as private.

#### Scenario: A branch deployment

- **WHEN** `https://www.example.com` lists `https://*.preview.example.com` and a request for `/about` names `https://feat-42.preview.example.com`
- **THEN** the canonical link MUST be `https://feat-42.preview.example.com/about`, robots MUST start with `noindex`, and an image address using `{base}` MUST be on `https://feat-42.preview.example.com`

#### Scenario: Not shared

- **WHEN** the same anonymous request is sent twice
- **THEN** the second MUST be a page cache miss, sent with `private`

#### Scenario: A staging address

- **WHEN** `https://www.example.com` lists `https://staging.example.com` and a request names it
- **THEN** every address MUST be on `https://staging.example.com`, with `noindex`

### Requirement: The settings file moves the default frontend per environment

The `canvas_metatag_public_base` setting in `settings.php`, when it is an
absolute http(s) base, MUST replace the default frontend's public address in
that environment, and MUST be the public address when no frontend is
configured. Without either, Drupal's own pages MUST use the request's address,
and content API output and commands MUST NOT. The request's address MUST never
be used while a frontend is configured.

#### Scenario: The setting with two frontends

- **WHEN** the setting is `https://www.example.org/` and the frontends are `https://www.example.com` and `https://shop.example.com`
- **THEN** heads that name the first MUST be on `https://www.example.org`, and heads naming the second on `https://shop.example.com`

#### Scenario: A site without frontends

- **WHEN** neither a frontend nor the setting is configured and a visitor requests `/about` at `https://cms.example.com`
- **THEN** its canonical link MUST be `https://cms.example.com/about`

#### Scenario: A value that is not a base

- **WHEN** the setting is a relative path, an ftp address, an address with a query, or one with credentials
- **THEN** it MUST be ignored, and the status report MUST say so

### Requirement: Addresses are part of the cacheability

Every head MUST depend on the `canvas_headless` settings, also before that
module is installed, and on the address settings, and a head on the request's
address MUST vary by site. The `settings.php` public address carries no cache
tag: a change to it takes effect after a cache rebuild. What the module keeps
beyond a request MUST hold no built address, or be kept per frontend.

#### Scenario: A frontend is configured later

- **WHEN** a page was cached on the request's address and a first frontend is then configured
- **THEN** the cached page MUST be invalidated, in coupled and headless output alike

#### Scenario: Changing an image address

- **WHEN** an administrator changes a frontend's image address
- **THEN** the next request for a cached page MUST carry the new image addresses

#### Scenario: Results kept for the dialog

- **WHEN** the dialog's state is built for one frontend and then for another
- **THEN** each MUST carry its own frontend's addresses

#### Scenario: An identity read from the front page

- **WHEN** the identity's contact link comes from a front page component and a request selects `https://shop.example.com`
- **THEN** the link MUST be on `https://shop.example.com`

### Requirement: Content API responses say what was selected

A content API response whose head the module built MUST carry
`Canvas-Metatag-Address`: the address its page addresses are built on, or
`none`, then `; ` and how it was chosen: `named`, `preview`, `unrecognized`,
`default` when nothing was named and the only frontend or the public base
setting applied, or `unnamed` when nothing was named and none could.

#### Scenario: A misspelled name

- **WHEN** a request names `https://shop.exmaple.com`
- **THEN** the header MUST be `none; unrecognized`

#### Scenario: A branch deployment

- **WHEN** a request names `https://feat-42.preview.example.com`, which matches a preview address
- **THEN** the header MUST be `https://feat-42.preview.example.com; preview`

### Requirement: The status report refuses addresses no visitor can use

The status report MUST show an error for a public or language address, or the
public base setting, that is plain http or on a non-public host (as in "Images
on a host no crawler reaches are left out"), for invalid address settings, and for a
language Drupal finds by domain with no frontend address. These MUST be
warnings only where Drupal's own host is a development host: loopback,
`localhost`, under `localhost`, `test` or `invalid`, or a known local
development suffix.

#### Scenario: A development frontend in production

- **WHEN** the status report is viewed at `https://cms.example.com` and the first frontend is `http://localhost:3000`
- **THEN** it MUST show an error naming the frontend and saying that visitors would be sent to a development address

#### Scenario: A private CMS

- **WHEN** the same configuration is viewed at `http://cms.internal`, or through `drush` on `http://default`
- **THEN** it MUST show an error

#### Scenario: A development site

- **WHEN** the same configuration is viewed at `https://cms.example.test`
- **THEN** it MUST show a warning, not an error

### Requirement: The status report warns about risky addresses

The status report MUST warn when `canvas_headless` has no frontend and no
public address is set; when an entry applies to no frontend; when a public
address is on one of Drupal's hosts; when a public address's first label is
`staging`, `stage`, `dev`, `test`, `qa`, `uat` or `preview`; when an image
address uses `{source}` or names one of Drupal's hosts; and when a language's
alternate on another frontend is not built the same way by that frontend.

#### Scenario: Settings for a frontend that is gone

- **WHEN** the address settings name `https://old.example.com` and no frontend has or matches that address
- **THEN** the status report MUST warn, naming `https://old.example.com`

#### Scenario: An image address that names Drupal

- **WHEN** an image address is `{base}/_img?url={source}&w={width}`
- **THEN** the status report MUST warn that image addresses carry Drupal's address

#### Scenario: Alternates that don't point back

- **WHEN** `https://www.example.com` has the French address `https://www.example.net`, a frontend without an entry
- **THEN** the status report MUST warn that `https://www.example.net` builds its English alternate on its own host

### Requirement: The status report lists the addresses in use

The status report MUST show one row, "SEO public addresses", listing each
frontend with the address its heads are built on and its source, its image
address, the Drupal paths a frontend that forwards images must pass on, its
language and preview addresses, which frontend is the default, and that
Drupal's own pages are public when anonymous visitors may view content.

#### Scenario: Two frontends

- **WHEN** two frontends are configured and the second has the image address `{base}{path}`
- **THEN** the row MUST list both, mark the first as the default, show the second's image address, and list the public files path and `/canvas-metatag/share/` to pass on
