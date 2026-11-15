# Design

## Context

See proposal.md for why. The state this design starts from:

- **The base.** `Resolver::origin()` returns one base per request: the
  `canvas_metatag_public_base` setting, else `frontends.0.url` of
  `canvas_headless.settings`, else the request's scheme, host and base path.
  `publicUrl()` puts Drupal paths on it, but returns an already absolute URL
  unchanged. That covers a translation on a Drupal language domain and a
  `file` link.
- **Images.** Every image goes through `fileArray()`, which calls
  `generateAbsoluteString()`, so every image is on Drupal's host. Under
  Drush that host is `http://default`, even when the setting is set.
- **Frontends.** `canvas_headless` stores `frontends[]` as `{url, components}`.
  A frontend has no id, no public address separate from its preview address,
  no preview pattern and no per-environment value; the canonical `baseUrl` of
  `FrontendUrl` is its identity. `FrontendUrl::fromConfig()` refuses a
  trailing slash, a query and a missing scheme, lowercases the host and drops
  default ports. Server-side code (editor boot, standalone renewal, the
  embedded preview) always uses the first frontend. The editor's frontend
  switcher saves the choice only in the browser.
- **Requests.** The SDK fetches `/canvas/content-api?requestUri=…` from the
  frontend's server, with `cache: 'no-store'`. It sends `Accept`, a bearer
  token when previewing, and nothing that identifies the frontend. There is
  one OAuth client for all frontends. A query string in the path an app passes
  to `fetchPage()` reaches `requestUri` intact. The core SDK takes a
  `fetchImpl`, but the framework adapters most apps import build their client
  without one, so an app cannot add an outer parameter without patching
  `fetch`.
- **Caches.**
  - The page cache (middleware priority 200) keys on scheme, host and the
    outer URI, and ignores headers.
  - `canvas_headless`'s middleware (priority 150) matches a main GET request
    on exactly `/canvas/content-api`, builds the inner request from
    `requestUri` and five allowed parameters, drops every other outer query
    parameter, and copies request attributes and headers.
  - Probes on the farm site: an extra outer parameter was a page cache miss
    but a dynamic page cache hit (the response built without it), and an
    extra header was a page cache hit. Both would cross-serve heads.
- **Upstream's stance.** `canvas_headless` documents that the frontend owns its
  canonical and maps Drupal URIs to public URLs. This module goes further and
  emits absolute frontend addresses, so the base it uses must be right for the
  frontend that renders.

The full write-ups are kept outside the repository (canvas internals with
file and line references, a table of every address the module and the queued
changes emit, research on established systems, and three reviews of the first
draft). The decisions below cite what they rely on.

## Goals / Non-Goals

**Goals:**

- Build every address in a head for the frontend that renders it, coupled and
  headless, from one builder.
- Let a frontend say who it is, including preview deployments whose addresses
  are not known in advance, without letting anyone poison a shared cache.
- Let a site keep Drupal's host out of everything the module emits, and keep
  `og:image` crawler-safe when images go through the frontend's pipeline.
- Keep zero-config right: one frontend and no settings behaves as today.
  Refuse to guess where no address is known, and make catastrophic
  configuration loud.

**Non-Goals:**

- Changing `canvas_headless`'s response body, its OAuth client or its preview
  flow (upstream requests below).
- Arbitrary path mapping between Drupal and frontend routes.
- A per-frontend identity: the publisher's name, logo and `og:site_name` stay
  site-wide. A site with one brand per frontend can change them per frontend
  in `hook_canvas_metatag_head_alter`, whose context carries the frontend.
- A `WebSite` node per language host (Review decisions, SEO 7).
- A settings UI (open decision 2), an image-facts response member (open
  decision 1), XML sitemaps.

## Decisions

### D1. The frontend names itself inside `requestUri`

A frontend adds `canvasFrontend=<the address it runs at>` to the query of the
path it asks for: `fetchPage('/about?canvasFrontend=https://shop.example.com')`.
That works with every SDK adapter today, with no `fetchImpl` and no change
upstream. The README gives a one-line helper that sets (never appends) the
parameter, and U2 asks the SDK to do it from a setting.

Why inside `requestUri` rather than as an outer parameter:

- It is part of the outer URI, so it is in the page cache key.
- An edge cache that keys on `requestUri`, which every edge in front of the
  content API must already do, keys on it too. An outer parameter would need
  each edge to add it to an allowlist, and one that did not would serve one
  frontend's head to another (the security review's main finding).
- App code can add it; an outer parameter needs a patched `fetch` in the
  common adapters.

**Parsing.** The middleware reads `requestUri` the way `canvas_headless` does
(`query->all()`, string only). It splits `requestUri`'s query on `&` and
counts only a pair whose undecoded name is exactly `canvasFrontend`. Exactly
one such pair, with a value, counts as naming a frontend. A duplicate, an
array or an encoded name such as `canvasFronten%64` counts as naming a value
that selects nothing (D2), so a parser that reads the string another way
cannot make it select something else.

**Normalizing.** The value is decoded once, lowercased, its default port and
one trailing slash dropped, then canonicalized with
`FrontendUrl::fromConfig()` and `canvas_headless`'s address pattern. An
address without a scheme selects nothing; the scheme can't be guessed.

**Matching**, in this order:

1. a frontend's address or public address;
2. a frontend's language address;
3. a frontend's preview address (D9).

Saving the settings refuses every overlap that would make the order matter
beyond that (public-addresses, "Selection is unambiguous"). A language address
equal to another frontend's address is allowed, and selects that frontend:
that is how one brand per language links its alternates.

Alternatives considered, and why each was rejected:

| Signal | Why not |
|---|---|
| A request header | Not in the page cache key, and many shared caches ignore `Vary` by default. The farm site probe served the cached entry to a request with the header. |
| An outer query parameter | Needs a patched `fetch` in the common adapters, and every edge must allowlist it, or one frontend's head is cached for another. |
| `Origin` / `Referer` | Absent on server-to-server fetches; trivially forged by anything that is not a browser. |
| Request host, `X-Forwarded-Host` | Drupal's own host, often internal; building public addresses from it is the classic cache-poisoning pattern. Frameworks that read it make it opt-in behind a trusted proxy. |
| OAuth client / consumer | One fixed client for every frontend; anonymous public traffic carries no token at all. |
| Preview token or assertion claim | Previews only; no frontend claim exists; the mint takes no frontend. |
| Language only | Does not tell two frontends of one language apart. Kept as a complement (D6). |

### D2. What happens when nothing is selected

- **One frontend.** A request that names none selects it. Zero-config sites and
  every frontend written before this change keep their addresses.
- **Two or more frontends.** A request that names none selects none. Drupal
  cannot know which frontend renders it, and the product owner ruled out "the
  first one". The head carries no page or image address: no canonical,
  `og:url`, hreflang, JSON-LD script or image rows. A missing canonical is
  harmless; a canonical on another brand's domain moves that page's ranking to
  it. The response stays cacheable: no caller chose anything.
- **A value that selects nothing** (unknown, misspelled, a look-alike, a
  duplicate): the same head, and the response is private and never page
  cached. An edge that ignored the parameter can't then store an address-less
  head for everyone.
- **Never `noindex`.** A head with no addresses never adds `noindex`. A
  forged or mistaken value must not be able to de-index anything.

The `Canvas-Metatag-Address` header (D14) says which case applied.

### D3. The trust model: a selector, not an assertion

The value can select only addresses an administrator configured. It never
carries an address that Drupal would use on the caller's word alone: even a
preview head is built from the pattern with the host filled in (D9).

| Value | Outcome | Harm |
|---|---|---|
| Another configured frontend's address | That frontend's public head, under that URL's own cache key | None: the same as visiting that frontend. |
| A host matching a preview pattern | A `noindex` head on that host, private, never stored by a shared cache | The requester gets a `noindex` copy of published content addressed to that host. The breadth rules keep patterns off hosts anyone can register (D9). |
| Anything else | No addresses, private | None. |
| A header, `Origin`, consumer id or forwarded host | Ignored for selection and page addresses | None. |

Draft access is not part of this. It stays with `canvas_headless`'s preview
token, so naming a frontend never reveals a draft.

**Production still trusts its own frontend.** Drupal can't tell a production
request from a preview one: the frontend decides by what it sends. A
production build that sends its deployment address instead of its public one
gets `noindex` heads if that address matches a preview pattern. The README
recipe reads the value from one explicit variable set per environment, never
from a platform's deployment-address variable; the header marks preview
selections so a post-deploy check can fail on them; and the README's
post-deploy check asserts production HTML has no `noindex` and no other host.

Alternatives rejected:

- **A signed value** (a shared secret in each frontend's environment). A secret
  to rotate in every deployment, protecting nothing the pattern and private
  responses do not.
- **Requiring a preview token for preview addresses.** Branch deployments
  browsed anonymously by reviewers would get no addresses and be indexable
  unless the host adds a header (open decision 4).

### D4. How the selection reaches the resolver and the caches

- **Middleware.** A canvas_metatag middleware at priority 175 runs between the
  page cache (200) and `canvas_headless` (150), on exactly the requests
  `canvas_headless` treats as content API requests: its own `API_PATH`
  constant, main request, GET. It resolves the value (D1), stores the result
  as the request attribute `_canvas_metatag_frontend`, and for a preview or a
  value that selects nothing triggers the page cache kill switch, so Drupal
  sends `Cache-Control: private`. `canvas_headless` copies attributes to the
  inner request, so the resolver sees the selection on the request it renders.
- **Cache context.** A new `canvas_metatag_frontend` context returns the
  selected frontend's canonical address, `none`, or `default`. The resolver
  adds it to every head it builds while frontends exist, so the dynamic page
  cache stores one variation per selection. Preview heads are `max-age 0`, so
  minted preview hosts add no dynamic page cache entries. On Drupal's own pages
  the attribute is never set and the context is constant.
- **The request attribute is the only source.** No other code reads the query
  or headers to decide the frontend.
- **Contract tests.** ARCHITECTURE.md gets rows for the `canvas_headless`
  internals relied on: `CanvasContentApiRequest::API_PATH`, the middleware
  priority, the request condition (with HEAD and a trailing slash as negative
  cases), attribute copying, `requestUri` reaching the middleware intact, and
  `FrontendUrl`. Each comes with a kernel test that fails if Canvas changes it.
- **Upstream.** Ask for a supported frontend selector on the content API (U1).

### D5. Per-frontend address settings in configuration

A new configuration object, `canvas_metatag.addresses`, installed empty:

```yaml
frontends:
  - url: 'https://www.example.com'      # the frontend's canvas_headless address
    public: ''                          # optional: where visitors reach it
    trailing_slash: false
    languages:                          # optional: an address per language
      - { langcode: fr, url: 'https://fr.example.com' }
    images: '{base}{path}'              # optional: image address template
    previews:                           # optional: preview address patterns
      - 'https://*.preview.example.com'
      - 'https://staging.example.com'
```

- **Which frontend an entry applies to.** A `canvas_headless` frontend whose
  canonical address equals an entry's `url` or `public` gets the entry. One
  that matches an entry's preview pattern gets the entry as a preview: every
  address on its own address, `noindex`, the entry's image address. Order
  means nothing.
- **Per environment.** Staging overrides only `canvas_headless.settings` (its
  frontend must be the staging app, which redeems staging Drupal's preview
  assertions); the production entry already lists the staging address as a
  preview, so the entry follows with no further override. A development
  frontend without an entry gets the defaults. `$config` overrides of this
  object are by index, as for any configuration sequence; keys can't hold
  addresses. They invalidate nothing when they change; D16 covers that.
- **Defaults.** A frontend without an entry, or a member left out, gets: its
  own address as public address, no slash, every language on it, images on
  Drupal, no previews. That is exactly today's first-frontend behaviour.
- **Validation.** Config schema constraints refuse bad shapes on save, import
  and recipe apply (the rules are in the spec). The command-line change's
  `configuration-as-code` checks cover the object. `settings.php` overrides
  bypass validation, so the service validates again on read, ignores an
  invalid entry or member, and the status report shows an error.
- **No UI** (open decision 2).

`public` exists for frontends that editors preview at one address and
visitors reach at another (for example, a dedicated preview app). The existing
setting already did this for the first frontend, and `public` generalises it.

### D6. One address builder

A new `Addresses` service replaces `origin()` and `publicUrl()`:

- `for(Request|null, ?string $named): Frontend` resolves the selection once
  per request: the attribute, else a named frontend (dialog, command), else
  the default.
- `page(Url, LanguageInterface)` builds a page address.
- `home()` builds `{home}`.
- `image(array $facts)` builds an image or file address.
- `cacheability()` returns the selection's cacheability.

Every call site the audit found goes through it:

- canonical (default, path override), `og:url`, hreflang and `x-default`;
- `facts.url` and `facts.image`;
- linked `internal:`, `entity:` and `route:` values and root-relative paths;
- linked file values and linked images;
- media images: the social override, the site image, the logo and image
  properties;
- `{home}`, the module's `@id`s, `WebSite`/identity/`WebPage` `url`;
- `ImageObject` `url`/`contentUrl`, `{url}`, `{image}` and `#name` ids.

From the queued changes:

- share cards, photo versions and icons (strengthen-zero-config-defaults);
- the theme-logo fallback (describe-the-publisher), whose root-relative theme
  path is its `{path}`;
- the derived identity (describe-the-publisher): it is stored as facts and its
  addresses are built at head time (D13);
- component images and breadcrumb `Link`s (read-page-components): the `Url`
  of each crumb goes through `page()`, never `toString()` on Drupal's host;
- `{media.uuid}` (extend-structured-data-by-id);
- head alter rows (add-advanced-meta-tags): the alter context gets the
  frontend and the builder.

Values an editor typed as absolute addresses are emitted as typed. Rewriting
them would second-guess the editor and could not be explained in Output.
Checks flag the ones that name Drupal or a preview host instead.

### D7. Page addresses: language addresses, the slash and the home address

- **The address.** A page's address is the address of its language, followed
  by Drupal's path, without the script name and base path. The request's own
  query never enters it.
- **Language addresses.** When the frontend has an address for that language,
  Drupal's prefix for the language is removed. One rule covers one app on
  several domains, separate apps per language, and locale prefixes that differ
  from Drupal's. Hreflang needs this: alternates must be absolute and
  reciprocal, and a wrong one makes search engines ignore the set.
- **Alternates on another frontend.** A language address that is another
  frontend's address is built in that frontend's form (its slash setting). The
  status report warns when that frontend does not build the alternate back,
  which is the usual mistake with one brand per language.
- **Domain negotiation.** With a frontend, a Drupal language domain is never
  used. Core makes a language's address absolute on its domain when that
  differs from the request's, so the builder keeps only the path, without the
  domain, base path or prefix, and puts it on the frontend's language address.
  That one step serves the canonical, `og:url`, hreflang, `@id`s and linked
  addresses alike. Without a language address the module cannot know where
  that language lives, so its addresses are left out (D12) and the status
  report shows an error naming the language and the frontend. Without
  frontends, Drupal's language domains are the public site.
- **The language's cache context.** Every head keeps `languages:language_url`,
  which `canvas_headless` adds to content API responses. The resolver adds it
  too, so coupled heads don't depend on Canvas for it.
- **Trailing slash.** One boolean per frontend, applied to page addresses with
  a path, before the query; never to image addresses. Search engines treat `/a`
  and `/a/` as different addresses, so the wrong form points at a redirect.
- **The home address.** A language's front page address is its address plus
  `/` when that has no path, else its address in the slash form. `{home}` is
  the front page address of the frontend's public (or preview) address, in
  every language: one identity per frontend, and the `WebSite` `url` equals
  the front page's canonical link, as search engines expect, also for a
  frontend under a path.
- **No other path mapping.** The frontend serves Drupal's paths, as upstream
  documents. Anything else is `hook_canvas_metatag_head_alter`.

### D8. Image addresses: one template per frontend

`images` is a template with four tokens:

- `{base}`: the frontend's public address, or the preview address. Never a
  language address: a locale prefix would put images on paths a proxy rule
  does not match, and give one image a different address per language.
- `{path}`: the root-relative Drupal path of the file or made image, without
  Drupal's base path, as Drupal percent-encodes it. It contains no `?`, `#` or
  `&`, so it is safe in a path or a query.
- `{source}`: the absolute Drupal address, encoded as one query value.
- `{width}`: the width of the image the module sends.

**The recommended template is `{base}{path}`:** the frontend passes the
public files path and `/canvas-metatag/share/` on to Drupal. The images a
head names are already crawler-ready after strengthen-zero-config-defaults
(cards 1200 × 630 PNG, photo versions 1200 × 630 JPEG under 300 KB, others
originals at their stored size), so they need routing, not optimization. The
status report lists the paths to pass on.

**Other templates are for those who need them,** for example an image service
whose origin is Drupal (`https://img.example.com{path}?w={width}`). The README
gives the checklist a template must pass, because each item silently breaks
share cards:

- a fixed output format, never negotiated from `Accept` (crawlers send odd
  `Accept` headers, and a shared cache may store one variant for all);
- every width the module can send is allowed, or the template pins none;
- quality and fit pinned;
- the path allowed in the frontend's robots.txt.

`{height}` is not offered: a height without a fit mode invites distortion,
and no pipeline found needs it. A template can still point at a route on the
frontend that signs or transforms as it likes.

**Validation.** A template is `{base}` followed by a path, or an http(s)
address with a literal host; tokens only after the first `/` of the path, so
no token can form a host.

**Files that aren't images** (a linked PDF) go on `{base}{path}` whenever an
image address is set: an optimizer can't serve them, and leaving them out
would drop valid data. The frontend passes the files path on anyway.

**A file served from another host** keeps its own address: one whose Drupal
address is on none of Drupal's hosts (the request's, the language domains, the
public file host), as a module that rewrites file addresses or a remote file
system makes it. It has no Drupal path a frontend could pass on, and no Drupal
host to keep out.

**Without a template,** images stay on Drupal's own file address: core's
`file_public_base_url` when set, else the request host. This keeps
zero-config sharing working where the CMS is public. On the content API, an
image that would land on a non-public host (a private IP, a single label, an
internal name) is left out: an absent `og:image` beats a dead one, and the
platform falls back to its own card. Rejected: routing images through the
frontend by default (every frontend that does not proxy would get dead
images), and `file_public_base_url` as the mechanism (one value per site, and
it moves the editor's thumbnails too).

**Made images** keep a path computed only from the entity and configuration,
so the same bytes serve through any host. Their outdated-path redirect is
root-relative, and the share route sets no cookie and varies only on
encoding, so it is safe behind a shared proxy or cache.

**Proxy bounds** (README): forward exact prefixes only, GET and HEAD only;
rewrite `Host` to Drupal's (or `trusted_host_patterns` answers 400); strip
`Cookie`, `Authorization` and client `X-Forwarded-Host`; never forward
`/canvas-metatag/api/`, `/user/`, `/system/files/` or `/canvas/`, so Drupal's
cookie-authenticated editor routes never become same-origin with the public
frontend.

### D9. Preview addresses

- **Form.** `*` stands in the first host label only, once. A label that is
  only `*` needs at least three labels after it (`https://*.preview.example.com`);
  a label with fixed text beside `*` needs at least two
  (`https://feat-*--site.example.net`). A shared hosting domain gives anyone a
  host one label under it, so `https://*.hosting.example` is refused, while a
  label with the project's fixed text in it is not. A pattern without `*` is
  one exact address (a staging host). A pattern may carry a path.
- **Refused.** A wildcard elsewhere, credentials, a query, a fragment, and the
  overlaps in "Selection is unambiguous".
- **Matching.** Scheme, port and the whole host must match the anchored
  pattern, so `…preview.example.com.example.net` fails. The declared path must
  equal the pattern's path. The selected base is the pattern with the host
  filled in, never the raw declared string, so no caller text reaches an
  address or a cache key.
- **The head.** Every address on the preview address; images through the
  template with `{base}` set to it; language addresses unused, so alternates
  sit on the preview host with Drupal's prefixes, for reviewers only (a
  language Drupal finds by domain has no prefix, so its addresses are left
  out, D12); and `noindex` merged first into robots.
- **The response** is private and never page cached (D4): a preview head is the
  most dangerous head the module builds, and must never reach a shared cache
  that keys on less than the full query.

Why `noindex` in the head, and always: hosts' own preview headers are
unreliable (some platforms drop them for custom branch domains), and
frameworks that know their environment default to "indexable only in
production". Rejected: a canonical pointing at production on previews. It
keeps the preview indexable if anything else fails, and the share-card test on
a preview then fetches production assets that may not exist yet.

### D10. Defaults when nothing names a frontend

- **The default frontend** is `canvas_headless`'s first: the editor's default
  preview frontend. Drupal's own copy of a page, commands and cron use it. The
  content API uses it only when it is the only frontend (D2).
- **`canvas_metatag_public_base`** keeps its documented meaning: it replaces
  the default frontend's public address in this environment, or is the site's
  public address when no frontend is configured. A change to it needs no
  cache rebuild (D16). Sites that set it because the synced first frontend is
  a development URL keep working. Other frontends no longer get it.
- **The request host** is used only for Drupal's own pages on a site with no
  frontend and no setting, where it is the site's real host and the page cache
  keys on it. Content API output and commands never use it for page addresses.
- **Drupal's own copy** (coupled HTML of an owned page while frontends exist)
  keeps one canonical to the default frontend's copy, with no `noindex` (open
  decision 3). Search engines document cross-domain canonicals, and say not to
  use `noindex` to steer canonical selection. The README's private CMS guidance
  comes first: restrict Drupal's HTML at the network or with HTTP auth (the
  frontend's server keeps its access), else send `X-Robots-Tag: noindex` from
  the web server on Drupal's HTML; robots.txt hides a `noindex` and does not
  stop indexing. With two or more frontends, the default may not serve every
  page; the README says so.

### D11. The editor dialog

- **Which frontend.** The extension reads Canvas's active frontend from
  `drupalSettings.canvas.headless.frontendUrl` (set by Canvas at boot and
  rewritten when the editor switches). It sends it as `frontend` on the state
  route and on every route that resolves a head. The server accepts only
  `canvas_headless` frontends' addresses there, and falls back to the default.
  A frontend that matches an entry's preview pattern (staging) is shown as a
  preview, with `noindex`, as it is served.
- **Display.** The search preview, social preview, Output, Site and "About
  addresses" use that frontend's addresses. "About addresses" names the
  frontend and the source of its address.
- **The link preview image** loads Drupal's display copy (the media thumbnail,
  or the share-preview route for a draft), never the frontend's image address,
  which may be a host the editor can't reach. The published address is checked
  separately (D14).
- **The loading skeleton** shows no host, where today it shows the editor's
  Drupal host.
- **Caching.** Address joining in the extension uses the state's address,
  never `location`.

### D12. Unknown addresses are left out, never guessed

Wherever the builder cannot produce a correct address, it returns nothing,
and the existing rule "links that are not absolute http(s) URLs are left out"
drops the row:

- a content API request that selects no frontend among several (D2);
- a language found by domain with no frontend address;
- content API output with no frontend and no setting;
- commands on `http://default`;
- an image that a sized template can't describe, or that would be on a
  non-public Drupal host (D8);
- a draft card on the content API, which would otherwise name the editor's
  share preview route on Drupal's host.

A page without its own address carries no canonical, `og:url` or JSON-LD
script, because every `@id` would be relative. The dialog shows why in Output,
the status report names the cause, and the content API header says it. This
replaces failures seen in the wild: canonicals on the CMS host, on an internal
host, on localhost, or on another brand's domain.

### D13. What is kept beyond a request

The rule: anything kept beyond a request holds frontend-independent facts
(entity references, stream URIs, Drupal paths, sizes), and addresses are built
from them at head time. That cannot drift as new caches appear. It applies to
describe-the-publisher's derived identity, which is computed in a save hook
where no frontend is selected.

Results that are built addresses by nature are keyed by the frontend's cache
key (its canonical address, or `default`):

- the resolver's per-request memo (when the dialog resolves for a named
  frontend);
- the command-line report cache (make-the-module-agent-ready).

The reach route cache (set-up-types-from-templates) and the overview and
report cache (add-structured-data-diff-and-overview) never show addresses, so
they compute on the default frontend only; the CSV export says which.

### D14. Guardrails

**Development host.** The status report and Checks decide whether a risky
address is an error by looking for positive evidence that this Drupal is a
development copy: its own host is a loopback address, `localhost`, under
`localhost`, `test` or `invalid`, or under a known local-development suffix
(a short list kept in code). Anything else, including a private IP, an
internal name, plain http behind a TLS-terminating proxy, and Drush on
`http://default`, is production-like. A private CMS is exactly where a
localhost canonical would otherwise go unnoticed.

**Status report** ("SEO public addresses"):

- **Errors**, warnings on a development host: a public or language address,
  or the setting, that is plain http or on a non-public host; invalid address
  settings or an invalid setting; a language Drupal finds by domain that a
  frontend has no address for.
- **Warnings:**
  - `canvas_headless` with no frontend and no setting;
  - an entry that applies to no frontend;
  - a public address on one of Drupal's hosts;
  - a staging-looking first label (`staging`, `stage`, `dev`, `test`, `qa`,
    `uat`, `preview`);
  - an image address that uses `{source}` or names Drupal;
  - an alternate on another frontend that that frontend doesn't build back.
- **Information:** one row listing each frontend, its address and source, its
  image address and the Drupal paths a forwarding frontend must pass on, its
  languages and previews, the default, and, when anonymous visitors may view
  content, that Drupal's own pages are public, linking the README's private
  CMS guidance.

**Checks** (seo-checks):

- development addresses for the frontend being previewed, shown only to those
  who can fix them;
- typed canonicals, link values and structured data addresses on Drupal's or
  a preview host, for every editor (the state carries Drupal's language
  domains and the preview patterns, which are not secrets);
- a published `og:image` address that answers with another size, or not at
  all from the editor's browser.

The existing "Sent elsewhere" row already tells an editor when a typed
canonical names another frontend.

**Header.** Content API responses with the module's head carry
`Canvas-Metatag-Address: <base or none>; <named|default|preview|unnamed|unrecognized>`.
A developer sees at once that a misspelled name selected nothing, that a
second app forgot to name itself, or that production is being served as a
preview. It names only public addresses. The README shows the `curl`
one-liner to read it, the two-request check that an edge cache keys on the
selection, and a post-deploy check for production.

### D15. Commands

`--frontend=<address>` selects a `canvas_headless` frontend; an unknown one is
a `choice` error listing the configured ones. Without it, the default frontend
is used, so `--uri` is no longer needed for page addresses when a frontend
exists. Images that would be on Drush's `http://default` (no image template,
no `file_public_base_url`, no `--uri`) refuse with `base_unknown`. Today they
print `http://default/sites/...`.

### D16. Settings-file changes reach cached heads

Saving, importing or applying configuration invalidates its own tag
(`Config::save()`), and every head carries `config:canvas_headless.settings`
and `config:canvas_metatag.addresses`. `settings.php` invalidates nothing: the
public base setting, core's `file_public_base_url`, and `$config` overrides of
those two objects, which is how staging sets its frontend (D5). A cache
context can't carry them either: the anonymous page cache answers before
contexts are read.

- The `Addresses` service hashes what `settings.php` sets: the two settings
  and `$GLOBALS['config']` for the two objects. Module overrides, such as a
  language's, are left out, so the hash never varies with the request. The
  last hash is kept in state.
- `hook_cron` and a main-request subscriber that runs before the dynamic page
  cache (priority above 27) compare it, only on requests the page cache did
  not answer. That costs no config read and one state read, from the state
  cache core loads on every request anyway.
- On a difference they invalidate `config:canvas_metatag.addresses` through
  core's cache tag invalidator, so the page cache, the dynamic page cache and
  any purger that sends tags to a CDN drop every output holding a built
  address: heads, coupled and headless, and the command-line report cache.
  Then they store the new hash and log one notice. A value that differs
  between web heads invalidates on every flip; the stream of notices names it.

Rejected: a check in a middleware ahead of the page cache (a state read on
every cached response), a new tag (every head already carries the address
settings' tag), and keeping the rebuild (a deploy that changes `settings.php`
without one serves old canonicals until an unrelated save).

## Cache model

| Layer | Key today | What this change adds | Why it can't cross-serve |
|---|---|---|---|
| Page cache (anonymous) | scheme + host + outer URI + format | nothing for a named frontend; previews and unrecognized values are not stored | The name is in `requestUri`, so in the URI. Headers can't select anything. |
| Bearer (preview) requests | bypass the page cache | nothing | n/a |
| Dynamic page cache | route + contexts (`url` of the inner request, `oauth2_scopes`, the mirrored API parameters…) | `canvas_metatag_frontend` context on every head built while frontends exist; preview heads `max-age 0` | The context reads the attribute set from the URI. |
| CDN / reverse proxy | usually the full URL, at least `requestUri` | nothing | It already keys on `requestUri`, which carries the name. Previews and unrecognized values are `private`. |
| Edge in front of the frontend | the frontend's own URL | nothing | Each frontend sends its own fixed name; the README's post-deploy check covers a production build that sends a preview name. |
| Coupled HTML | page cache per Drupal URL | the constant context | Always the default frontend. |
| Config | `config:canvas_headless.settings` | `config:canvas_metatag.addresses` | Invalidated on change. |
| `settings.php` values (D16) | none | a stored hash, compared on cron and on requests the page cache did not answer | A change invalidates `config:canvas_metatag.addresses`. |
| Language | `languages:language_url` on the content API | the same context on every head | A domain or prefix picks the language, and the head varies with it. |
| Images on Drupal's host | `url.site` | unchanged; dropped where a template builds the address | The template does not depend on the request host. |
| Kept results | tags only | facts, or a frontend key (D13) | Addresses are built per request. |

The new dimension's size is bounded by the configured frontends; preview
hosts add none, because preview responses are not stored.

## Risks / Trade-offs

- **Two or more frontends lose addresses until each names itself.** Today they
  get wrong ones. The status report lists the frontends, the header says
  `unnamed`, and the release notes say so. With one frontend nothing changes.
- **A production build can declare itself a preview.** Only the frontend can
  prevent it; the README recipe, the header and the post-deploy check make it
  hard to miss.
- **Reordering `canvas_headless` frontends moves the default.** This affects
  only Drupal's own copy and commands. The status report shows which is the
  default.
- **Canvas internals.** The middleware relies on the content API path, its
  condition, the priority 150, attribute copying and `requestUri` reaching it
  intact. The contract tests fail if Canvas changes any of them. U1 removes
  the dependency.
- **Settings keyed by address drift per environment.** Preview patterns cover
  staging; a development frontend without an entry gets the defaults; an entry
  that applies to nothing is reported.
- **A template that serves another size or format.** The dialog check catches
  size; format can't be checked from a browser, so the README checklist is the
  defence. `og:image:width` and `height` are always declared from the image
  sent; a template that resizes without `{width}` makes them wrong, and only
  the dialog check sees it.
- **Leaving rows out.** A site that relied on Drupal-domain hreflang, on
  request-host canonicals in headless output or on images on an internal host
  loses those rows until it configures addresses. The status report shows an
  error and the release notes say so. That is preferable to emitting
  addresses that are wrong.
- **A settings-file change waits for cron on a fully cached site,** or for
  the first request the page cache does not answer. A deploy that runs
  `drush deploy` rebuilds caches anyway.
- **Typed addresses stay as typed.** An editor can still name Drupal's host by
  hand. Checks flag it; the guarantee covers what the module builds.
- **Drupal-hosted images without a template follow core.** A trusted proxy that
  passes a client's `X-Forwarded-Host` through steers them, as it steers every
  absolute URL core builds. The guarantee "page addresses never depend on the
  request" holds; images are covered once a template or the public file
  address is set.

## Migration

- A post-update installs `canvas_metatag.addresses` with `frontends: []` and
  invalidates `rendered`.
- **One frontend, no settings:** identical output, including images on
  Drupal, except images on a non-public host in content API output, which are
  left out.
- **The setting with frontends:** identical for the default frontend in
  Drupal's own copy and commands.
- **Several frontends:** content API requests that name no frontend lose their
  addresses until each frontend names itself; each that does gets its own.
- **Also reported in the status report and release notes:** content API output
  with no frontend and no setting loses its request-host canonical; a language
  found by domain loses its Drupal-domain addresses until it has a frontend
  address; commands stop printing `http://default` image addresses.
- README and ARCHITECTURE.md describe the new model. "Image URLs always stay
  on Drupal" is replaced, and the three-source list is replaced by D10. Their
  known limitations lose the language-domain line and the cache-rebuild line.

## Upstream requests (canvas_headless), drafted, not filed

- **U1.** A supported frontend selector on the content API, validated against
  configured frontends and part of the cache key. Coordinate the name.
- **U2.** An SDK setting for the app's own address that adds the selector,
  takes a function for apps that serve several hosts, reads the
  `Canvas-Metatag-Address` header and fails loudly in production on
  `preview`, `unnamed` or `unrecognized`.
- **U3.** File URLs in the body: an option to emit root-relative paths (as core
  JSON:API does), or a per-frontend file base, instead of the request host.
- **U4.** `context.site.baseUrl` names Drupal's request host in public JSON.
- **U5.** Carry the editor's chosen frontend into the assertion mint and the
  standalone renewal, which today always lands on the first frontend. Accept
  configured frontends only, never preview patterns, so the renewal can't
  become an open redirect.
- **U6.** A distinct public address per frontend, beside its preview address.

## Review decisions

Three reviews of the first draft (SEO, frontend developer, security and
caching) were applied where we agreed. These were changed:

- An unnamed request with several frontends, and any value that selects
  nothing, gets no addresses instead of the first frontend's (SEO 1,
  frontend 2). Unrecognized values are private (security 2).
- The selector moved inside `requestUri` (frontend 1), which also puts it in
  every edge key that already includes `requestUri` (security 2). It is
  parsed strictly: one literal name, a string (security 2), normalized
  leniently: case, default port, one trailing slash (frontend 2).
- "A production head is never built with a preview address" was false and is
  replaced by the real trust and its mitigations (SEO 2, frontend 3).
- Preview responses are private, never page cached and `max-age 0`
  (security 1). The declared path must equal the pattern's, and the base is
  built from the pattern (security 5). Wildcard breadth rules keep patterns
  off shared hosting domains without a suffix list (SEO 9, frontend 3,
  security 6).
- `{base}` never carries a language address (SEO 3, frontend 4). `{path}` drops
  Drupal's base path (frontend 12). `{height}` is gone (SEO 6). Templates can't
  form a host from a token (security 13). Non-image files go on
  `{base}{path}` (SEO 11).
- `{base}{path}` is the recommended template, with the paths to pass on in the
  status report, a checklist for optimizers, and proxy bounds (SEO 6,
  frontend 8, security 9). The share route sets no cookie.
- Exact addresses win over patterns, a frontend's own address over another's
  language address, and overlaps are refused (SEO 4, frontend 5, security 6).
  Alternates on another frontend take its form, and non-reciprocal ones are
  reported (SEO 4).
- An entry applies to a frontend by address, public address or preview
  pattern, so staging overrides only `canvas_headless.settings` (frontend 6).
- On the content API, images on a non-public Drupal host are left out
  (frontend 7, security 3). The spec no longer claims the request never
  changes an image address (security 3).
- "Production-like" is now the default; a development host needs positive
  evidence (SEO 8, frontend 9, security 4).
- `{home}` is the front page address, so the `WebSite` `url` matches the front
  page canonical on a frontend under a path (SEO 7, second half).
- A draft head on the content API never names the editor's share preview
  route (security 7).
- Kept results hold facts, not addresses; the derived identity is covered
  (security 8).
- Typed-address checks reach every editor (security 12).
- The citation on canonical plus `noindex` is corrected, and the README's
  private CMS guidance is spelled out (SEO 5). Preview hreflang is described
  (SEO 13). The README CDN note covers edges in front of the frontend
  (SEO 14). Multi-host apps, the `curl` check, preview cache growth and the
  coupled copy of single-brand content are documented (frontend 11, 12).
- U5 carries the open-redirect caveat (security 10).

Rejected, with reasons:

- **A status report warning that Drupal's own pages are public** (SEO 5). The
  content API needs anonymous `access content`, so the warning would show on
  every headless site and could not be cleared by the fixes it recommends
  (the module can't see a web-server header or a network rule). It is an
  information line in the listing instead.
- **An opt-in redirect from Drupal's copy to the frontend** (SEO 5). Kept as
  the alternative to open decision 3, not built: it needs a redirect owner for
  pages the frontend may not serve, and the default frontend may not serve
  them with several frontends.
- **A `WebSite` node per language host** (SEO 7, first half). Search engines read
  site names per host, so a language on its own domain gets no declared site
  name. Fixing it splits `#website` across hosts and changes a fixed `@id`
  that several queued changes rely on. It is a follow-up, not part of
  addressing.
- **A status report error when Drupal trusts a forwarded host** (security 3a).
  That is core's own behaviour for every absolute URL; the module can't judge
  whether the proxy strips a client's header. The risk is stated, and setting
  an image address or the public file address removes it.
- **`X-Robots-Tag: noindex` on content API responses** (security 11). Search
  engines rarely index JSON, and a frontend or edge that copies Drupal's
  headers onto its HTML would de-index production. The cost is catastrophic,
  the gain small.
- **A second header echoing the selection** (security 2). Folded into
  `Canvas-Metatag-Address`, which now says how the base was chosen.
- **A public endpoint returning the frontend's address form** (frontend 10).
  The same developer configures the frontend and its entry, the README's
  post-deploy check catches a canonical that redirects, and an endpoint is new
  public surface. Open decision 1 stays: a template can point at a frontend
  route that signs.
- **Recording the content API host in state** (frontend 7). Leaving
  unreachable images out removes the silent failure without a write on a GET.
- **Refusing an optimizer-looking template without `{width}`** (SEO 12).
  "Optimizer-looking" can't be defined; the risk is stated and the dialog
  checks size.
- **A typed canonical on another frontend as a new row** (SEO 15). "Sent
  elsewhere" already reports it as good to know.
- **`noindex` on unrecognized values** (frontend 2). A forged value must not
  be able to de-index anything; an address-less private head is enough.

## Open Questions

See proposal.md, "Open decisions". The design takes the recommended option
for each.
