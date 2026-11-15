# Proposal

## Why

The product owner asked how a site can add the more advanced head tags people
need beyond what the dialog sets today. Sites need four things the module
cannot do now: prove ownership to search engines and other services, use the
rest of the robots vocabulary, say how one search engine may use a page for AI
answers and training (read from 1 Feb 2027), and add the odd tag a partner
service asks for. Two defects block all of it: tags a site set in the Metatag
module vanish on Canvas pages, and repeated tags collapse to one in Drupal's
own HTML.

## What Changes

- **Fixes first.** Every tag the module emits reaches Drupal's HTML, also when
  two tags share a name. Tags set in the Metatag module that this module does
  not set pass through on Canvas pages and template-rendered nodes, in both
  deliveries, and can be turned off per page or content type. Metatag itself
  stays silent there, as today.
- **More robots directives in Search › Advanced** (page, content type, and the
  site defaults in Site › Visibility): video previews (allowed, up to a number
  of seconds, still image) and image search. Closed values, merged one by one
  like the existing directives.
- **A stop date** ("Stop showing after") on a page or a content type, typed or,
  for a content type, linked to a date field. It is emitted inside robots and,
  for articles, as the article expiration time. Never a site setting.
- **AI use** in Search › Advanced and Site › Visibility: "AI answers"
  (allowed, its own AI only, not allowed) and "AI training" (allowed, not
  allowed), emitted as the crawler-specific tag that one search engine reads
  from 1 Feb 2027, one tag per directive. The dialog says who reads it and
  from when.
- **Verification codes** in a new Site group, "Services": paste a service's
  tag or its code; codes are emitted on every page the module owns.
- **Other tags:** a sheet, reached from Search › Advanced and from Site ›
  Services, of plain `meta` and `link` rows at site, content type and page
  scope. Paste is the main way in: each pasted element gets a verdict in
  words, and only rows are stored, never markup. Keys the dialog sets are
  refused with a pointer to their control; dangerous or misplaced tags are
  refused with a reason. Per key, the nearest scope wins; an inherited row can
  be turned off. At content type scope a value can follow a field.
- **A developer hook** to add or change head rows in code. It reaches the
  coupled head, the headless head and the dialog's Output.
- **Output and Checks** say where every added tag comes from, when a stop date
  has passed, when AI use is not read yet, and which tags come from the
  Metatag module.

No **BREAKING** change for stored data: every new value is a new key. The
coupled head gains rows only where a site sets them, plus the Metatag tags
that the module used to drop.

## Reopened non-goal (product-owner sign-off needed)

- **README: "robots rules for single crawlers and AI-training opt-outs (those
  belong in robots.txt)".** This change reopens it for one crawler only: the
  one that reads page-level AI preferences from a meta tag, as two closed
  choices. The README line becomes untrue on 1 Feb 2027 otherwise. Rules for
  any other single crawler stay refused, and robots.txt stays out. This needs
  an explicit product-owner decision before the AI use group is built
  (tasks.md, group 2).

Kept closed, on purpose:

- Head output on routes the module does not own. When the front page is not a
  Canvas page or a template-rendered node, verification codes are not added
  there, and Checks says so. Emitting them there would reopen this non-goal.
- Import of Metatag data. Metatag's tags are read live and stored nowhere.
- Per-node overrides, robots.txt and llms.txt management, search-console
  integrations (the dialog never checks whether a code verified the site),
  translation of site and template text. (`og:locale` is emitted by
  `strengthen-zero-config-defaults`, which reopens that non-goal.)

## Out of scope

- A catalogue of named tags with labels, kinds and suggestions. The rules are
  data (what is refused and why), not a list of tags.
- Apps and app links, and tags derived from Site › Identity profiles. A site
  can add those as other tags.
- One tag per item of a multi-value field (link-values-to-fields keeps "the
  first item").
- HTTP headers of any kind, manifests, theme colours with a media query,
  scripts, styles, and any raw head markup. Favicons: the owned front page's
  icon links come from `strengthen-zero-config-defaults`; elsewhere they stay
  out.
- Page facts as values of other tags at page and site scope.
- A permission of its own for other tags.

## Dependencies

- **Depends on `link-values-to-fields`.** The stop date and other tags use
  that change's value type, link control and link states, and a content
  type's rows follow a field through its link menu. Its deltas for "Effective
  values layer the target over the site" and "The page type sets og:type and
  the article times" (head-output), "Site settings are one configuration
  object" (site-seo) and "Where values can be linked" (value-links) start from
  that change's text. Archive after it. Two scenarios follow a reference
  ("Writer › Handle" in other-tags and seo-dialog), which only that change's
  full plan offers. If its product owner chooses the fallback, rewrite them to
  a field of the type before this change archives.
- **Exception for the dated work.** Task groups 1 and 2 (indexed head keys,
  the head alter hook, robots extras and AI use) use no linked value. If AI
  use must ship before 1 Feb 2027 and `link-values-to-fields` is not merged
  by then, they may land first; `link-values-to-fields` task 3.2 then keeps
  the new robots keys in the rewritten shared fixture. The archive order does
  not change.
- **Builds on `strengthen-zero-config-defaults`** (archived before this
  change): its block for "The head has fixed rows in a fixed order" carries
  that change's `og:locale`, `og:locale:alternate`, `og:image:type` and icon
  link rows, and Metatag's sharing tags are left out so that the module's
  made images are the only shared image (task group 6b).
- **Followed by `add-home-page-defaults`.** That change decides once, per
  language, which entity is the front page. Until it lands, the "Verification
  missing from the home page" check uses the front page setting as the state
  reads it today; afterwards it uses the new decision, with no change to this
  change's requirements. It also answers this change's open question on
  Metatag's front-page defaults.
- Independent of `build-ai-on-drupal-ai` and `expose-seo-to-canvas-ai`: no
  requirement is shared.

## Capabilities

### New Capabilities

- `other-tags`: plain `meta` and `link` rows at site, content type and page
  scope: their shape, what is refused and why, how scopes layer per key, field
  links at content type scope, and cleaning on output.

### Modified Capabilities

- `head-output`: more robots directives, AI use tags, the stop date and the
  article expiration time, verification codes, other tags and repeated tags in
  the head and its order; Metatag's tags pass through as the outermost layer;
  a developer hook over the head.
- `headless-head`: other tags, verification codes and Metatag's tags reach the
  headless `head` as plain rows.
- `page-seo`: new robots values; a stop date; other tags per translation.
- `template-seo`: a content type may set other tags and a stop date linked to
  a date field.
- `site-seo`: verification codes in the identity; other tags in the site
  values; no site stop date.
- `seo-dialog`: the new Advanced rows and AI use note, the Services group, the
  Other tags sheet with paste, the stop date in the search preview, sources in
  Output.
- `seo-checks`: rules for a stop date, AI use before its date, tags from the
  Metatag module, and verification missing from the home page.
- `seo-access`: the edit permission's description also warns about links in
  other tags.
- `value-links`: at template scope the stop date and the content or address
  of other tags offer linking too.

## Impact

- **Server:** `Values` (robots keys, `expires`, `tags`, identity
  `verification`, cascade), `Resolver` (rows, order, Metatag layer, hook),
  `CanvasMetatagHooks` (indexed head keys, install message), `ApiController`
  (the tag policy and row sources in the state), config schema, a new
  `data/head-tag-policy.json`, `canvas_metatag.api.php`.
- **Client:** `model.ts` mirror and `text-cases.json` for the new robots keys;
  Search and Site tabs; a new Other tags sheet with paste parsing; Output;
  `checks.ts`.
- **Dependencies:** none new. With the Metatag module installed, two of its
  public manager methods are used; each gets a row in ARCHITECTURE.md and a
  kernel test that fails if Metatag changes it. No new Canvas internal.
- **Docs:** README (what the module takes over, the reopened non-goal, headless
  notes on server rendering and fixed-key frontends), ARCHITECTURE.md §3–§8,
  §10, §11, §17, §19.
