# Reference: mockup frames and the tag inventory

Planning inputs for this change, distilled from the design work of
12–13 Nov 2026. Where anything here differs from proposal.md, design.md or the
spec deltas, those win.

## Mockup frames (`mockups/`)

The approved direction, drawn at the dialog's real width (1000 px wide shots of
a 468 px dialog at about 2×). Tasks 2.8, 4.6, 5.6, 6.11 and 7.2 compare the
built dialog with them. Each frame carries its own caption above the dialog.

| Frame | What it shows |
|---|---|
| F01 | This page › Search › Advanced, scrolled: video previews, image search, stop date, canonical, AI use with its note, the Other tags row |
| F02 | Every Event › Advanced: the stop date linked to the End date field, link menu open (non-date fields listed, disabled, with a reason) |
| F03 | Site: Visibility with AI use, then Services: verification codes, the paste input, Other tags; the Site save bar unchanged |
| F04 | Every Article › Other tags at rest: own rows, From the site (switches), From the Metatag module (switch), one row added by a module's hook mentioned, not editable |
| F05 | Every Article › a row open: Meta tag / Link, name with "as name / property", linked content, the tag line preview |
| F06 | This page › Paste a snippet: the review list, one verdict per element, "Add 1 tag · 5 skipped" |
| F07 | This page › a typed key that the dialog sets: refused with Show |
| F08 | Output: the new rows with their source (page, site, Metatag module, a module's hook) |
| F09 | Checks: a passed stop date (to fix, one-click remedy), AI use not read yet, a tag from the Metatag module |
| F10 | This page › Other tags, empty: "Most pages need none" |

The frames were edited for publication: vendor-named keys are replaced by
placeholders. `example-site-verification` and `example-verification` stand for
two real verification names, `ai-crawler` for the crawler name that carries AI
use (`ai_use_crawler` in the policy), and `example:app_id` for a social
network's app id key that the Metatag module can set. The built dialog shows
the real keys, because the policy file holds the real protocol names.

F03's caption says labels are the tags' own names "until the product owner
decides on service names". Follow the spec deltas on labels.

## The tag inventory (324 rows)

The inventory judged every tag the Metatag module 2.2.3 and its submodules can
output (277 plugin rows), the robots directives (23) and newer tags Metatag
does not offer (24). Each row got one class and one custom-row verdict.

| Class | Rows | Custom-row verdict |
|---|---|---|
| Already covered by this module | 30 | owned |
| Deserves a typed control | 15 | owned once the control ships |
| Fine as a generic row | 115 | allow |
| Refuse | 164 | deny (60 with a sentence), or obsolete and simply not offered |

Audience: everyone 48, some sites 33, niche 121, obsolete 122.

### Owned keys (refused as rows, with a pointer to their control)

`title`, `description`, `robots` (every directive, including `noarchive`,
`nocache`, `noodp`/`noydir`, `noai`/`noimageai`, `indexifembedded`, `none`,
which have no control and get a sentence instead), `og:title`,
`og:description`, `og:url`, `og:type`, `og:site_name`, `og:image` and every
`og:image:*` (`:url`, `:secure_url`, `:type`, `:width`, `:height`, `:alt`),
`article:published_time`, `article:modified_time`, `article:expiration_time`
(fed by the stop date), the card keys the module emits (`twitter:card`,
`twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`,
`twitter:site`), the seven verification names, and the links `canonical` and
`alternate` with `hreflang` (automatic from translations).

**Verification names.** Six are the `name` values of tag plugins in Metatag's
`metatag_verification` submodule: the two largest search engines, two regional
search engines, a pin-board platform and a social network's domain
verification. The seventh is a third regional engine that Metatag does not
offer. The three regional engines go under "More".
The other four plugins in that submodule (a safe-browsing service, a security
scanner, a video-meeting service and an obsolete read-later service) stay
generic rows.

### Denied keys, by reason

- **Acts like a server header or is dangerous:** every `http-equiv`
  (`refresh`, `set-cookie`, `x-ua-compatible`, `cleartype`,
  `content-security-policy`, …); meta `referrer` (can leak full addresses);
  `charset`; `<base>`; `<script>` (other than the module's JSON-LD); `<style>`;
  link rels `stylesheet`, `preload`, `preconnect`, `dns-prefetch`, `prefetch`,
  `prerender`, `modulepreload`, `pingback`.
- **Combines with robots for one crawler:** the general and the news crawler
  names of the largest search engine, and the AI use crawler's name (that one
  comes only from the AI use controls).
- **Owned by the theme, core or the server:** `viewport`, `color-scheme`,
  `generator` (fingerprinting), `cache-control`, `expires`, `pragma`,
  `application-name`, `mobile-web-app-capable`, the three mobile-platform
  `*-web-app-*` keys of one phone maker, link rels `icon` (any size),
  touch icons and their precomposed variants, `mask-icon`, `manifest`.
- **Language:** `og:locale`, `og:locale:alternate` (README non-goal).
- **Personal data:** `og:email`, `og:phone_number`, `profile:gender`.
- **No consumer, links only:** link rels `shortlink`, `image_src`, `next`,
  `prev`, `amphtml`, app-scheme and `media=handheld` `alternate`s. With the
  four-relation link allowlist (`me`, `author`, `license`, `alternate` with a
  feed type) these never need their own entries.

### Allowed as generic rows (the 115), by job

Dublin Core (`dcterms.*`, 55 rows: libraries, archives, public sector); app
deep links (`al:*`, 15: custom schemes pass, `javascript`, `vbscript`, `data`,
`file` are refused); article metadata (`article:author`, `section`, `tag`,
`publisher`); authorship handles (`fediverse:creator`, the card network's
creator key, `author`); Open Graph media (`og:audio*`, `og:video*`); Open Graph
profile (`profile:first_name`, `last_name`, `username`); the largest search
engine's own directive tag (a meta name equal to the engine's name) carrying
`notranslate` and similar (the route for `notranslate`, since `robots` is
owned); `rating=adult`; a pin-board
platform's three opt-outs; four niche verification names; four site-search
metadata keys; app and brand chrome (an app banner key, `format-detection`,
`theme-color`, an app id key); link relations (feed `alternate`, `license`,
`author`, `me`); scholarly `citation_*`; the card network's label/data pairs.

Harmless obsolete keys such as `keywords` stay accepted and earn nothing
(design decision 2). Obsolete keys are not listed in the policy file.

### Not head tags (out of scope)

The robots HTTP header (and a crawler's header form), the `Content-Usage`
header and its robots.txt form, robots.txt user agents for AI training, and
the `data-nosnippet` body attribute.

### Watch list at the time of writing

- Nothing in the AI use rows is honoured before 1 Feb 2027; copy says so until
  then.
- The largest search engine was reported to be adding page-level AI controls by
  March 2027 with no mechanism named. If it is a robots rule it is one more
  choice in the AI use row.
- An AI-training user agent in robots.txt was announced for early 2027;
  robots.txt stays a non-goal and the AI use note points to it.
- `noarchive` loses its AI meaning for one engine on 1 Mar 2027; it gets a
  sentence, not a control.

### Facts to re-verify before copy freezes

The pin-board opt-out keys' behaviour; the app banner syntax; the status of
the social network's app id and app links; the card network's fallback for
image alt text; the token shape of the third regional engine's code;
`unavailable_after` support by the second engine; whether scholarly search
still prefers `citation_*` over Dublin Core.
