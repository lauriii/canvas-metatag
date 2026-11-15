# Design

## Context

See proposal.md for why. The state this design starts from:

- `Resolver::url()` decides "front page" by comparing `'/' . internalPath` with
  `getPathByAlias(page.front, entity langcode)` and then emits
  `Url::fromRoute('<front>')`. It adds only `config:system.site`.
  `ApiController::anyPage()` uses a second predicate (`Url::fromUserInput()` in
  the request language) and `Previews.useAddress()` a third (`pathname === '/'`).
- `publicUrl()` strips `Request::getBasePath()`, which excludes the script
  name, so `/index.php/…` requests emit `…/index.php/…` addresses (live on the
  farm site: `/index.php` → canonical `http://site-4.ddev.site/index.php/`).
- Core's Site information form stores the front page setting as typed, alias
  included; it only validates it (`SiteInformationForm`, core 11.4). The farm
  site holds `/home`. Inbound, `PathProcessorFront` (priority 200) maps `/` to
  the setting before alias resolution (priority 100), and alias lookup falls
  back to the language-neutral alias only.
- On core 11.4 `path.matcher` is decorated by `path_alias`'s
  `AliasPathMatcher`, so `isFrontPage()` recognises an alias front page for the
  current request in the negotiated language. It still answers only for the
  current route.
- The graph emits `#identity`, `#logo`, `#website` on every owned page;
  `WebSite.inLanguage` is the page's language.
- Canvas stages "Set as homepage" as a `staged_config_update` with id
  `canvas_set_homepage`, and flips `configuration.homepagePath` in its editor
  store without a round trip.

Sources used below (fetched 2026-11-13; the rules and short verbatim quotes
behind each decision are in reference.md): search engine documentation on
site names, title links, snippets, the robots meta tag, site icons,
localized versions, pagination, duplicate URLs, site verification, and the
organization, local business, profile page, return policy and shipping policy
structured data; the Open Graph protocol (ogp.me); the schema.org vocabulary.

## Goals / Non-Goals

**Goals:**

- One front-page decision, by entity and per language, used everywhere.
- Output that is correct on the home page in every language and setup
  (subdirectory, headless, prefixed default language, separate pages per
  language), without a home-only setting.
- Checks whose severity follows the cost: *fix* only where the home page takes
  site-wide signals down with it.

**Non-Goals:**

- Any output on a front route the module does not own (open product question).
- Writing the front page setting.
- Identity depth and site kinds as data (structured-data work); this design
  only fixes where that depth will be placed (D9).

## Decisions

### D1. Front page detection: a per-language map, by entity

`FrontPage::entities(): array<langcode, {entity_type, id}>`, computed once per
request (memoised) and cheap enough for `/state`. For each configurable
language: read `system.site:page.front` with that language's config override
(base value when none), strip the query, `getPathByAlias($path, $langcode)`,
route the result with the router's path matching (no access check: the head
is built as anonymous later anyway), keep entity type and id when the route is
an entity's canonical route. `isFront($translation)` compares type, id and the
translation's own langcode.

Alternatives considered:
- `PathMatcher::isFrontPage()` / the `url.path.is_front` cache context:
  request-scoped. The head is resolved for `/state` (an API route), for every
  hreflang member (other translations), for drafts and for a template's
  governed node; none of them is the current front route. Its alias support
  also depends on the core version (present on 11.4; the version it landed in
  is not verified, and the module supports `^11.3`).
- Comparing the entity's URL with `{home}`: fails for every non-default
  language and for a prefixed default language.
- `HomePageHelper::isHomepage()` (Canvas): merges current and staged, compares
  language-prefixed URL strings; it cannot tell "is" from "will be".
- One boolean per entity, as today: misses translations whose language has no
  matching alias (then `/fi` is a 404 and the canonical must not claim `/fi`)
  and sites with a separate front entity per language.

The map is also what `anyPage()`, `SchemaGraph` (a `front` flag in `ctx`, D8),
the Checks (via `/state`) and `add-advanced-meta-tags` (Metatag's front-page
defaults, its verification report) read.

### D2. Staged and leaving: read Canvas's staged update ourselves

Load the `staged_config_update` `canvas_set_homepage`, take its `page.front`
input and run it through D1 for the target's language. `/state` reports
`target.front: 'current' | 'staged' | 'leaving' | null` and, at template scope,
`target.governs_front: {nid, label} | null` (the front node of this bundle when
its Full template is this one). Public output reads only the current setting.
The extension re-reads `/state` when Canvas's `configuration.homepagePath`
changes in its store. Both are Canvas internals: each gets an ARCHITECTURE.md
§11 row and a contract test.

Alternative: reuse `HomePageHelper` (rejected in D1); poll (wasteful).

### D3. Canonical: no script name, never a 404

`publicUrl()` strips `Request::getBaseUrl()` (base path plus script name)
instead of `getBasePath()`. That fixes the canonical, `og:url`, hreflang and
every `@id` on every page, and it removes a cache hazard: with a public base
from settings or a frontend no `url.site` context is added, so `/index.php/x`
and `/x` share a dynamic page cache entry; once the output never contains the
script name, the shared entry is right for both.

`url()` emits `<front>` for a translation only when D1 says that translation is
the front page. A translation the map misses keeps its own URL, which serves;
the Checks report the dead language root (D7).

The README gains: redirect `/index.php/*` at the web server (a canonical is a
weaker signal than a redirect, per the duplicate-URL guidance).

### D4. Hreflang: x-default from the default language; a front cluster from the map

`x-default` = the published translation in the site default language, else
the published original, else none. Today it is always the original, which is
wrong for content created in another language. The localized-versions guidance
designs `x-default` for language selectors and auto-redirecting roots, and the
generic root is its example; the default-language root is the closest the
module can see.

When D1 finds different entities per language, a front entity's alternates are
the published front entity of each language (`{langcode → url(front entity)}`),
so the roots list each other ("each language version must list itself as well
as all other language versions"). Every member computes the same set; each
adds the other members' cache tags.

No "my root redirects / is a language picker" setting: the module cannot see
that truth, least of all at a headless edge. The README says to put
`x-default` on such a root in the frontend or theme.

### D5. Cacheability

| New dependency | Metadata | Where |
|---|---|---|
| the alias the front page setting names | `route_match` tag, only while the setting is in alias form | `url()` |
| URL language negotiation (prefixes, domains) | `config:language.negotiation`, when the language module is enabled | `url()` |
| a paged listing's page | `url.query_args:page` context, only on entities that keep it (D6) | `resolve()` |
| other front entities of a per-language cluster | their entity tags | hreflang |

`route_match` is the only tag core invalidates when a `PathAlias` is saved, and
it is invalidated on every alias save site-wide. Scoping it to alias-form
settings limits the churn to the sites that need it, and the Checks and the
Site row steer administrators to the permanent address, which removes it.
`config:system.site` already covers changes of the setting itself, including a
published staged homepage. No user or permission context is added.

Alternative: tag every head with `route_match` (needless churn on sites with a
system-path setting), or ignore alias edits (stale canonicals on `/`, against
"Every dependency invalidates the head").

### D6. Pager: kept only where the tree holds a paged listing

The head is resolved per entity and cannot see whether a pager rendered. The
entity's component tree can be read: a Canvas page's own tree, or the Full
template's tree for a node. Keep `page` when that tree contains a Views block
whose display has a pager (a static, cacheable fact carried by the entity's or
template's tags). Accept only `^\d+(,\d+)*$`, drop trailing zero elements and
the parameter when all are zero (Drupal pagers are zero-based and list one
element per pager), keep no other parameter, and add `url.query_args:page`
there only. Headless works unchanged because canvas_headless copies the
request query into the inner request.

Alternatives: keep `page` on every page (self-canonical duplicates for any
`?page=N` and unbounded cache variation; rejected after review); keep today's
fold and only report it (search engine guidance says not to canonicalise a
paginated sequence to its first page). Out-of-range pages are the listing's
concern and are not handled.

### D7. Checks: severity follows the site-wide cost

| Rule | Severity | Reason |
|---|---|---|
| hidden, from page, type, default-language version or site layer | fix | these travel with content and exported config; site name, icon and verification are read from the root, which must be crawlable |
| hidden, only by a configuration override | improve | per environment by design (the README's staging recipe); a red dot on every staging site trains people to ignore red |
| canonical elsewhere (no normalisation) | fix | the root sends its signals away; both sides come from `url()`, so only a stored override differs, and an `http` override is a real defect |
| alias-form setting with a changed draft alias; a language root that does not open | fix | `/` or `/fi` returns "Page not found" |
| vague or brand-only name, title or shared title | improve | nothing breaks; titles are rewritten from other sources |
| text previews off; links not followed; prefixed default language; home typed as one Product or Article | improve | the home result or the site markup gets worse |
| share image from the page's own image; shared settings of a node home page; one site name | good to know | facts the editor may want, not errors |

Headers (`X-Robots-Tag`), robots.txt and an authentication wall are not visible
to the dialog and are not claimed. At template scope the visibility rules
judge the governed front node (D2) whatever is previewed. The vague-word list
is a data file keyed by language, applied in the translation's own language
only (a word vague in one language can be a brand in another). The title rule
judges the page's name, the bare search title and `og:title`, because
`og:title` falls back to the page's name (not to the search title) and is
itself a title-link source; its first action therefore leads to Canvas's page
title.

### D8. Structured data on the front page

- `SchemaGraph::build()` gets `ctx.front` from D1 (not inferred from
  `url === home`). When true, the page node gets `about: {"@id": "{home}#identity"}`.
  `about`, not `mainEntity`: a home page usually shows many things. It is for
  understanding only; the dialog promises no search feature for it.
- `alternateName` on the identity and the website comes from a new ordered
  identity field (site-seo). The site-name guidance says the `WebSite` markup
  on the home page weighs most and that alternate names are given in order of
  preference.
- No `SearchAction` (the sitelinks search box is retired), no one-item
  breadcrumb, no WebPage name override at home.
- `WebSite.inLanguage` stays the page's language; it varies by page for one
  `@id`. Flagged to the structured-data work, not changed here.

### D9. Identity placement (rule handed to the structured-data work)

The identity stays on every owned page (in-graph references such as
`Article.publisher` need it in the same graph; "home only" would mean nowhere
when the front route is not owned). When identity depth arrives, it is split
into two depths with one `@id`:
- **lean, every owned page:** type, name, alternate names, url, logo,
  profiles, plus whatever the subtype's search feature requires (a local
  business's `address`), so that no page carries an invalid node;
- **full, one page:** contact, legal name, identifiers, merchant return and
  shipping policies, on the owned front page, else on the single page of kind
  About page, else nowhere. The policy guidance recommends a single page and
  says every page is not needed; a policy repeated everywhere can disagree with
  the visible policy page everywhere.

The page is derived, never a setting.

### D10. Title, shared title, image and description of a vaguely named front page

Replaced on 2026-11-14 (product decision 12; the first version said "no home
rules"). A front page named "Home" shared as "Home" in every chat bubble, and
the title-link guidance names "Home" as a vague title to avoid.

- **Rule:** when the owned front page's main title part would be its name
  (no title of its own) and that name is empty, the Site name, an alternate
  name, or a vague word of the translation's language (the D7 word list), the
  main part is the Site name and the ending is Drupal's slogan when set, else
  there is no ending ("Humanify Studio", or "Humanify Studio | Human expertise
  for AI-made work"). `og:title`, when no social title is set, is the same
  text. A real name ("Industrial pumps for breweries") is kept as typed and
  takes the site's ending like every page.
- **Image:** when the chain of `strengthen-zero-config-defaults` would make a
  card for such a front page, it makes the site card instead (logo, Site name,
  Drupal's slogan as its line when set).
- **Description:** nothing here. The front page's fallback to the identity
  description, and that description as the site card's line when there is no
  slogan, moved on 2026-11-14 to `describe-the-publisher`, which adds the
  identity description and runs after this change (it used to run before,
  and this change waited for it). The slogan is never a description: a
  tagline is not a description. No other page gets a site-wide description.
- The "Say what the site offers" check keeps asking for a real name; its
  detail says what the page shares today.

### D11. Site kinds: variants, not rules

Kinds are not exclusive and are not stored by this change. What varies:

| Kind | Identity | Front page node | Checks here |
|---|---|---|---|
| organization | Organization or a specific subtype | WebPage + `about` | — |
| single-location local business | most specific local business subtype; address is required, so it stays in the lean set (D9) | WebPage + `about`; the home page is the location page | — (subtype checks belong to the structured-data work) |
| several locations | the brand Organization | WebPage + `about` | each location is its own page |
| online store | online store subtype; policies on the full identity, once | WebPage + `about`, never Product | home typed as Product → improve |
| store with premises | local business subtype (a store), products as Product | WebPage + `about` | as above |
| personal site | Person | Profile page only when the home page is about the person | — |
| publication | Organization | Collection page + `about`, never Article | home typed as Article → improve; paged listing (D6) matters most |
| multilingual | one identity, one name in every language | per translation, D1/D4 | language root, prefix, one site name |
| headless | same graph through the content API | same | sentences conditional (seo-dialog) |

### D12. Headless

The headless head is the resolver's head (one path), so D1–D8 reach it without
new code in the headless decorator. Nothing is added to the head to mark the
home page: the canonical already marks the root, and a flag would not fix the
upstream language-switcher mismatch. The README says the frontend must serve
`/` with the front page's head, redirect the alias to `/`, render `head.script`
on the server, and set its own canonical if it paginates with its own
parameter.

### D13. No write to the front page setting

The fix for an alias-form setting gives an administrator the permanent address
(`/page/5`, the form Canvas's "Set as homepage" stores) to copy and leads to
the form that holds the setting. A dialog-side write would be a second way to
change core configuration with its own access, staging and undo rules.

## Risks / Trade-offs

- [An alias-form front setting churns caches on every alias save] → The tag is
  added only while the setting is an alias, and two *fix* rows plus the Site
  row push to the permanent address.
- [Renaming the home page to fix its title regenerates its alias through an
  automatic alias pattern, and `/` breaks] → `front-address-change` fires on the
  draft alias before publishing; the title row mentions it when the setting is
  an alias.
- [Canvas may not offer "Set as homepage" for a page it already counts as the
  homepage] → The fix gives the permanent address for the site information
  form, which is always available to administrators.
- [Detecting a paged listing in the component tree reads Canvas's tree format
  and Views display options] → A Canvas internal row and contract test; on any
  failure the page folds `page` as today.
- [Out-of-range pages self-canonicalise] → Named; the listing decides its
  out-of-range answer.
- [The vague-word list misses a language] → Data file, extended on report; a
  missing language means no row, never a false one.
- [The per-language map costs a lookup per language per request] → Memoised per
  request; a few alias lookups; measured in the kernel test with three
  languages.
- [Staging sites see a red dot] → Only when noindex is exported in site
  settings or set on content; the README recipe (a settings override) gives
  *improve*.
- [Overlap with `link-values-to-fields` on two requirements and with
  `add-advanced-meta-tags` on one] → Disjoint edits. This change archives
  last, and its blocks are written on their text (tasks.md, "Workflow
  follow-up").

## Migration Plan

- No stored data changes; alternate names are a new optional identity member
  (absent reads as none).
- Output changes on deploy for: `/index.php/…` requests; `x-default` of content
  created in a non-default language; translations the front setting misses
  (canonical moves from `/fi` to the translation's own URL); separate
  per-language front pages (gain alternates); pages with paged listings
  (`?page=N` canonicals); the front page's graph (`about`). A post-update
  invalidates the `rendered` cache tag so that no cached page mixes old and
  new.
- Rollback: reverting the code restores today's output after a cache rebuild;
  a stored alternate-name member is dropped by read-mode cleaning.

## Open Questions

- Whether `WebSite.inLanguage` should list the site's languages or be left
  out. It does not change this change's specs; the structured-data work owns
  it.
