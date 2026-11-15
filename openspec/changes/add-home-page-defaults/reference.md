# Reference: what the sources say about a home page

The source notes behind design.md, distilled. Fetched from the primary
documentation on 2026-11-13; quotes are verbatim except that the engine's own
name is replaced by "[the engine]". "The engine" is the search engine with the
most complete public documentation on these topics. The decisions themselves
are in design.md (D1–D13) and the spec deltas, which win over anything here.
Tags: **[doc]** primary documentation, **[recalled]** known before and not
re-checked, **[inferred]** our reading.

## Title and site name (D10)

- Title links [doc]: "Avoid vague descriptors like "Home" for your home
  page". "The `<title>` element on your site's home page is a reasonable place
  to include some additional information about your site", for example
  "ExampleSocialSite, a place for people to meet and mingle"; on other pages
  "consider including just your site name at the beginning or end".
  "[The engine] may omit the site name from the title link" "if it's
  repetitive with the site name that's already shown". Rewrites are caused by
  half-empty titles (`<title>| Site Name</title>`), boilerplate and no clear
  main title. Sources for a title link include `<title>`, `<h1>`, `og:title`
  and `WebSite` structured data.
- Site names [doc]: "add `WebSite` structured data to your home page"; the
  system also considers `og:site_name`, `<title>` and headings on the home
  page, "however, `WebSite` structured data is most important". "Structured
  data must be on the home page of a site", meaning "the domain or subdomain
  level root URI"; "`https://example.com/de/index.html` isn't the home page";
  site names are not supported at the subdirectory level; one site name per
  domain or subdomain. `alternateName`: "You can list more than one", "in
  order of your preference". Duplicate home pages should carry "the same
  structured data on all page duplicates". "The home page must be crawlable".
- So [inferred]: the home title is the site's strongest title, not a slot for
  the bare site name; a translated `WebSite.name` on `/fr` is harmless but not
  "the French site name"; a home page labelled "Home" leaks that label into
  `<title>` and `og:title` (seen on the farm site).

## Description (D7, D10)

[doc] The snippet is "primarily" built from page content; the meta
description is used "if it might give users a more accurate description".
"Use site-level descriptions on the main home page or other aggregation
pages". "There's no limit on how long a meta description can be". So the home
page is where a site-level description is right; a slogan or tagline is a
poor fallback, and a Check that asks for a real sentence does more good than
a silent fallback. `nosnippet` or `max-snippet:0` on the home page removes the
snippet brand searches see.

## Robots and the root (D7)

[doc] `noindex` keeps the page out of results; conflicting rules resolve to
the more restrictive one; a robots.txt block hides the robots meta tag. The
root carries site-wide signals: the site name ("The home page must be
crawlable"), the site icon (the crawler "must be able to crawl the home
page") and tag verification (the "non-logged-in home page", which "cannot
require authentication"). "We don't recommend using noindex to prevent
selection of a canonical page within a single site". So `/home` and
`/node/N` need a canonical to `/`, never `noindex`, and a `noindex` or a
canonical override on the root costs the whole site: Checks raise severity
there.

## Canonicals at the root (D3, D6)

- [doc] Redirects and `rel="canonical"` are strong signals, sitemaps weak.
  "Use absolute paths"; the link counts only in `<head>`; "Do include a
  rel="canonical" link on the canonical page itself"; HTTPS is preferred over
  HTTP; with hreflang, use "a canonical page in the same language".
- [doc] At the root `https://example.com` equals `https://example.com/`;
  elsewhere a trailing slash makes a different URL.
- [doc] Pagination: "Don't use the first page of a paginated sequence as the
  canonical page"; `?page=n` URLs "are treated as separate pages";
  `rel=next/prev` are no longer used.
- Observed on the farm site (anonymous requests, 13 Nov 2026): `/`, the front
  alias, another page's system path and `/?utm_source=x` all gave the right
  canonical. `/index.php`, `/index.php/home` and `/index.php/about` gave a
  self-canonical that keeps `/index.php`, also in `og:url`, hreflang and the
  page node's `@id`: the URL generator's base URL includes the script name and
  only the base path was stripped. Not limited to the home page.
- [inferred] Without a configured public base the origin follows the request,
  so a site answering on both http and https (or two hosts) without a server
  redirect self-canonicalises each variant.
- [inferred] A prefixed default language (`/en`) makes `/` canonicalise away
  from the domain root, where site name, icon and verification are read.
  Prefer an unprefixed default language or a redirect from `/`.

## Languages (D4)

[doc] Each language version lists itself and all others; links that are not
reciprocal are ignored; alternates are fully qualified; only ISO 639-1
languages and ISO 3166-1 alpha-2 regions. "The reserved `x-default` value is
used when no other language/region matches", designed "for language selector
pages", "especially on language/country selectors or auto-redirecting home
pages". The crawler sends no `Accept-Language` and crawls from one country,
so a negotiating root shows it one language. So [inferred]: on the root,
`x-default` should follow the site's default language (or the selector at
`/`), not the entity's original language; each language root is
self-canonical; separate per-language front pages form no translation cluster
by themselves.

## Structured data on the home page (D8, D9, D11)

- Organization [doc]: place it "on your home page, or a single page that
  describes your organization"; "You don't need to include it on every page".
  No required properties; recommended `name`, `alternateName`, `legalName`,
  `url`, `logo`, `description`, `sameAs`, `address`, `contactPoint`,
  `telephone`, `email`, identifiers, `hasMerchantReturnPolicy`,
  `hasShippingService`. Logo "must be 112x112px, at minimum", crawlable, and
  look right "on a purely white background". Use the most specific subtype
  (an online shop is `OnlineStore`; a local business the most specific
  `LocalBusiness` subtype).
- General guidelines [doc]: "Put the structured data on the page that it
  describes, unless specified otherwise" (Organization is such a case);
  "Don't mark up content that is not visible". Every documented `@id` use is
  within one page; examples moved to fragment ids in 2024 [secondhand].
  Nothing documents that an `@id` on page B resolves to a node defined only on
  page A, so the module keeps repeating the identity node on every page
  (dropping it elsewhere would be a regression). No engine requires "one graph
  per page"; it is the module's own consistency rule.
- Local business [doc]: required `name` and `address`; for several locations,
  "Define each local business location as a `LocalBusiness` type" on its own
  page, with the brand organization on the home page.
- Profile page [doc]: valid for "An "About Me" page on a blog site", not for
  "The main home page of a store". On a personal site the home page's
  profile must point `mainEntity` at `#identity`, not emit a second Person.
- The home page's own node [inferred]: `WebPage` with `about` →
  `#identity` (`mainEntity` only when the page really is about the
  publisher); `CollectionPage` for a listing front page; no one-item
  breadcrumb; `name` is the real title, not the admin label.
- The sitelinks search box was retired on 21 Nov 2024 [doc]: do not emit
  `WebSite.potentialAction`; `nositelinkssearchbox` is ignored. Sitelinks are
  automated from link structure.

## Sharing the home page (D10)

- Open Graph protocol [doc]: required `og:title`, `og:type`, `og:image`,
  `og:url` ("The canonical URL of your object that will be used as its
  permanent ID"); `og:image:alt` is "not a caption".
- The largest social network [doc]: `og:url` is "the undecorated URL",
  shares "aggregate at this URL"; "Images are cached based on the URL and
  won't be updated unless the URL changes".
- A professional network [doc]: image at least 1200 × 627, at most 5 MB,
  1.91:1. A chat app [doc] fetches "as little of the page as it can" with
  range requests and caches about 30 minutes, so tags belong early in
  `<head>`.
- So [inferred]: the home page is the URL most often shared bare; its card
  should be a deliberate choice, `og:title` must not be the admin label, and
  `og:url` must be the exact canonical root string.

## Verification and the site icon (D13, handed to other changes)

[doc] Tag verification goes in "the <head> section in the HTML of your site's
non-logged-in home page", as an anonymous visitor reaches it (redirects
followed). So [inferred] verification is a site setting that must not depend
on which entity is the front page; emitting it on every page is harmless and
more robust; DNS verification survives front-page and headless changes.
Site icon [doc]: "Add a `<link>` tag to the header of your home page", one
icon per hostname, square, at least 8×8 (larger than 48×48 recommended), a
stable URL; it is the theme's concern, at most a Check.
