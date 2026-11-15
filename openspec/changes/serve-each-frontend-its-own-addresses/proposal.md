# Proposal

## Why

The product owner asked us to "think deeply about domain handling for
headless; the headless application might be on a different domain than
Drupal", and then corrected the first answer twice:

- The public base must not be "the first frontend": "it needs to be the
  specific frontend that's being rendered".
- "You could have preview environments too where the URL is unknown. Could we
  let the frontend define those URLs?"
- "Clients might have their own image optimization in use and may not want to
  expose Drupal URL at all to the public."

Today every address the module emits comes from one base for the whole site:
the `canvas_metatag_public_base` setting, else the first `canvas_headless`
frontend, else the host of the request. That is wrong in four ways that
matter to a site with headless frontends:

1. **The wrong frontend.** With two frontends (a main site and a shop, or one
   app per country), every head names the first one. Canonical links,
   `og:url`, hreflang and every JSON-LD `@id` of the second frontend point at
   the first, which moves the second's ranking to it.
2. **Drupal cannot tell who is rendering.** Nothing on a content API request
   names the frontend in a way that is both reliable and part of the cache key.
   There is one OAuth client for all frontends, the SDK sends no `Origin`, and
   a header is not part of the page cache key: an anonymous request carrying
   one would be answered from, or would fill, another frontend's cache entry.
   A probe on the farm site showed it both ways.
3. **Preview deployments have no address.** A per-branch deployment's URL is
   not known in advance, so today its head points at production (or, through
   the request-host fallback, at Drupal), and it is indexable.
4. **Drupal's host leaks.** Every image address (`og:image`, logo, JSON-LD
   images, the share cards the queued `strengthen-zero-config-defaults` makes)
   is on Drupal's host. So are addresses on a Drupal language domain, and
   anything built when the frontend's server calls Drupal over an internal
   host or Drush runs on `http://default`. A site whose CMS is private (basic
   auth, a VPN, an internal network) gets dead share images, and a site that
   wants Drupal's address kept out of public output cannot do it.

It also closes two of the README's known limitations: addresses that stay on
Drupal's domain with a language per domain and a headless frontend, and the
cache rebuild that a change to `canvas_metatag_public_base` takes.

The research behind this change is summarised in design.md: how Canvas and
`canvas_headless` identify frontends today (they don't), an audit of every
address the module and the queued changes emit, how established headless
systems, frameworks and crawlers handle site addresses, preview deployments
and images, and three reviews of the first draft.

## What Changes

- **Each response is built for one frontend.** A frontend names itself by
  adding `canvasFrontend=<its address>` to the path it asks the content API
  for. That works with every SDK adapter today, and puts the name in every
  cache key that already includes `requestUri`. The name selects one of the
  frontends the administrator configured, or a preview deployment matching one
  of their preview patterns. Headers, `Origin`, the request host, the consumer
  and the token never select a frontend.
- **Nothing is guessed.** With one frontend, a request that names none gets
  it, as today. With several, a request that names none, or names something
  that matches nothing, gets a head with no addresses rather than another
  frontend's. It never gets `noindex`.
- **New capability `public-addresses`** collects every address rule in one
  place, for coupled and headless output: selection, the address settings,
  page, home and image addresses, preview addresses, the defaults,
  cacheability, the response header and the status report.
- **Per-frontend address settings** in a new configuration object,
  `canvas_metatag.addresses`. Each entry is optional, applies to the frontend
  with its address (or, as a preview, to one matching its patterns, which is
  how staging needs no extra override), and has five optional members:
  - a public address, for a frontend that editors preview at another address;
  - a trailing slash setting;
  - an address per language, for per-language domains or locale prefixes that
    differ from Drupal's;
  - an image address (`{base}`, `{path}`, `{source}`, `{width}`); the
    recommended one is `{base}{path}`, with the frontend passing Drupal's file
    and share-image paths on;
  - preview address patterns.

  A frontend without an entry works exactly as today's first frontend does.
  There is no new UI.
- **One address builder.** Canonical, `og:url`, hreflang, every JSON-LD `@id`
  and URL, `{url}`, `{home}`, breadcrumb items, linked addresses of the site,
  hook-added rows and every image (made share images included) go through one
  builder for the selected frontend. That closes the bypasses the audit found.
  `{home}` becomes the front page's own address, so the `WebSite` `url` always
  matches the front page's canonical.
- **Language domains.** While frontends exist, no address names a Drupal
  language domain. The builder keeps the path and puts it on the frontend's
  address for that language, for every address above. A language Drupal finds
  by domain without one is left out, and the status report shows an error.
- **Settings-file changes apply without a cache rebuild.** The module keeps a
  hash of the address values `settings.php` sets, compares it on cron and on
  requests the page cache did not answer, and invalidates every head when it
  changes. Configuration changes already invalidate through their own tags.
- **Preview deployments** get every address on their own address, `noindex`,
  and a private response that no shared cache stores.
- **Drupal's host can be kept out of public output.** With an image address
  that does not use `{source}`, a test proves that no head row, JSON-LD value
  or header the module adds names any of Drupal's hosts in any encoding,
  whatever host the frontend called Drupal at, for drafts too. Without an
  image address, images on a host no crawler can reach are left out instead of
  shipped dead.
- **Defaults.** Drupal's own copy of a page and commands use the default
  frontend, `canvas_headless`'s first. `canvas_metatag_public_base` keeps
  today's meaning for it. The request's host is used only for Drupal's own
  pages on a site without frontends.
- **Guardrails.**
  - The status report shows errors for development, private, plain-http or
    staging-looking addresses unless this Drupal is clearly a development copy,
    so a private CMS is not let off. It reports settings that apply to no
    frontend, languages without a frontend address, image addresses that bring
    Drupal's host back, and hreflang alternates another frontend doesn't
    return, and lists the paths a frontend must pass on to Drupal.
  - Checks flag typed addresses on Drupal's host or on a preview address, and
    a shared image whose public address gives another size than the head
    declares.
  - Content API responses say in a header which address they were built on and
    how it was chosen, so a missing name, a misspelling or a production build
    serving as a preview shows on the first `curl`.
- **The dialog shows the frontend Canvas previews with.** It loads the link
  preview image from Drupal rather than from a frontend address the editor may
  not reach, and shows no host before its state loads.
- **Commands** take `--frontend=<address>` and refuse to print addresses that
  would be on Drush's `http://default`.

## Out of scope

- The body of the content API response, which `canvas_headless` builds. Its
  file URLs, `context.site.baseUrl` and translation links name Drupal's host;
  design.md lists them as upstream requests. The "no Drupal host" guarantee
  covers what this module adds.
- Mapping Drupal paths to frontend routes that differ from them. A frontend
  serves Drupal's paths (as the `canvas_headless` documentation recommends),
  with its own base, locale prefixes and trailing slash; anything stranger
  belongs in `hook_canvas_metatag_head_alter` (add-advanced-meta-tags).
- A per-frontend publisher identity and a `WebSite` node per language host.
- A UI for the address settings, an image-facts member in the response, and a
  `noindex` on Drupal's own copy of a page (open decisions 1-3).
- Fixing `canvas_headless`: its standalone preview renewal always goes to the
  first frontend, and its assertions carry no frontend. These are reported
  upstream.
- XML sitemaps stay a README non-goal. No non-goal is reopened.

## Capabilities

### New Capabilities

- `public-addresses`: which frontend a head is built for, the address
  settings, page, home and image address forms, preview addresses, defaults,
  cacheability, the response header and the status report.

### Modified Capabilities

- `headless-head`: the three public-base requirements move to
  `public-addresses`; share images are no longer pinned to Drupal's host, and
  a draft head never names the editor's share preview.
- `head-output`: the canonical and dependency requirements point at
  `public-addresses`; a language with its own address keeps no prefix on the
  front page.
- `structured-data`: `{home}` is the frontend's home address.
- `site-seo`: the state reports the address for the frontend it was asked
  for.
- `share-images`: made images have a host-independent path, put on the
  frontend's image address, set no cookie, and redirect with a root-relative
  location.
- `seo-checks`: development addresses, typed addresses on Drupal's or a
  preview host, and a shared image whose public address gives another size.
- `seo-dialog`: the dialog follows the frontend Canvas previews with.
- `command-line`: `--frontend`, and no addresses on `http://default`.

## Dependencies and place in the queue

Land **last**, after `make-the-module-agent-ready`. Every queued change adds
address producers: share cards and icons, breadcrumbs, `{media.uuid}`, the
theme logo and derived identity, head alter rows, the reach, overview and
command-line caches. This change moves all of them onto one builder in one
pass over a settled set, and its MODIFIED blocks are written on the text of:

- `strengthen-zero-config-defaults`: headless-head "The content API carries
  the same share images", share-images "Made images have their own address".
- `add-home-page-defaults`: head-output "Every dependency invalidates the
  head".
- `read-page-components`: structured-data "Node identities are fixed".
- `make-the-module-agent-ready`: command-line "Addresses need a public base".

Coverage only (addresses routed through the builder, no spec text changed):
`describe-the-publisher`, `extend-structured-data-by-id`,
`add-advanced-meta-tags`, `link-values-to-fields`, `set-up-types-from-templates`,
`add-structured-data-diff-and-overview`.

## Open decisions

1. **Image facts in the response.** Recommended: no new member. The image
   address, pointed at a route on the frontend when it needs signing or other
   logic, covers every case found, and the response keeps exactly the members
   Canvas defines. Alternative: a `headImages` member with path, stream URI,
   size, type and alt for each image the head names.
2. **A UI for the address settings.** Recommended: configuration only
   (`drush config:set`, recipes, config sync, `settings.php` overrides), with
   the status report as the readout. These settings differ per environment and
   are set by developers. Alternative: a Site > Addresses sheet in the dialog.
3. **Drupal's own copy of a page.** Recommended: keep the canonical pointing at
   the default frontend, with no `noindex`, and document how to keep a private
   CMS out of search (network or HTTP auth first, a web-server `X-Robots-Tag`
   second). Alternatives: `noindex` on Drupal's copy of owned pages while a
   frontend is configured (search engines say not to steer canonicals with
   it), or an opt-in redirect of Drupal's copy to the frontend.
4. **Preview addresses without a token.** Recommended: a pattern match is
   enough, because preview responses are private and never stored by a shared
   cache, so a declared preview only changes the response its requester gets.
   Alternative: honour preview addresses only with a preview token. That stops
   branch deployments from showing their own addresses to anonymous reviewers.
5. **Several frontends and a request that names none.** Recommended: no
   addresses, so no frontend ever carries another's canonical. Alternative:
   the first frontend's addresses, as today, flagged by the header.
6. **Queue position.** Recommended: last. Alternative: land task groups 1-2
   (selection and cache isolation) first, before
   `strengthen-zero-config-defaults`, and the rest last.
