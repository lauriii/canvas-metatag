# Design

## Context

See proposal.md for why. Today:

- `Resolver::resolve()` builds one `head{title, meta, link, script}` that the
  coupled hooks, the headless decorator and `GET /state` all copy
  (ARCHITECTURE.md §1). The robots map is closed: `noindex`, `nofollow`,
  `nosnippet`, `max_snippet`, `max_image_preview` (`Values::robots()`).
- `CanvasMetatagHooks::pageAttachments()` keys each `html_head` item by its
  name, property or rel. Core keeps the last item per key
  (`HtmlResponseAttachmentsProcessor::processHtmlHead()`), so a second tag with
  the same name would replace the first in coupled HTML while headless keeps
  both. Harmless today, because every key is emitted once.
- `CanvasMetatagHooks::metatagsAlter()` blanks every Metatag key for an owned
  entity (`array_fill_keys`). That silences Metatag's own output on every path,
  including its contribution to canvas_headless's head, and also drops
  verification codes, theme colours and custom tags that a site set there.
- The headless decorator replaces `head` wholesale.
- `link-values-to-fields` (applied before this change) gives every value one
  shape, `{text}`, `{fact}`, `{media}` or a field source, with the link control,
  link states and the Checks rules for broken and hidden links.

The tag inventory behind this change judged 324 candidate tags (every tag the
Metatag module and its submodules can output, the robots directives, and the
newer tags it does not offer). About 25 jobs still matter; 15 rows deserve a
typed control; 115 are fine as a generic row; 164 should be refused. The
design follows that split. reference.md lists the keys behind each verdict,
which is what `data/head-tag-policy.json` is built from.

## Goals / Non-Goals

**Goals:**

- Typed controls only where a value has a closed shape or a known meaning:
  robots directives, AI use, the stop date, verification codes.
- One generic, strict list for everything else, filled mostly by pasting.
- One path for every consumer: whatever reaches the coupled head reaches the
  headless head and the Output sheet, in the same order, from `resolve()`.
- Nothing new is declared safe markup, nothing new varies by user, and no new
  Canvas internal is used.

**Non-Goals:**

- A catalogue of named tags with labels and kinds.
- Any element other than `meta` and `link`, any attribute a user names, any
  HTTP header.
- Output on routes the module does not own.
- A policy alter hook for other modules. The head alter hook covers code.

## Decisions

### 1. Typed controls sit next to the setting they modify

Video previews and image search join Image previews in Advanced; the stop date
sits before the canonical address; AI use gets its own label under the other
directives; verification codes get a Site group "Services" after Visibility.
Other tags is the last row of Advanced (page, type) and of Services (site).

Alternatives: a fourth tab, or one "More tags" sheet holding typed and generic
tags together. Rejected: the redesign keeps three tabs and one disclosure per
view, and Advanced already holds robots; a sheet of everything hides the dated
AI controls behind a search.

### 2. Rules, not tags: one policy file

`data/head-tag-policy.json` holds rules only: owned keys with the control they
point at, denied keys and prefixes with a reason id, reason sentences,
verification names, crawler names (one of them the AI use crawler), the link
relations and feed types, and the refused schemes. `Values` reads it; the state
carries it as `tagPolicy`, so the dialog shows the server's sentences without a
TypeScript mirror or a shared fixture. A hard floor stays in code, not in the
file: the element set (`meta`, `link`), the attribute set (`name`, `property`,
`content`, `rel`, `href`, `type`), `http-equiv`, `charset`, `itemprop`, and the
refused schemes.

The bar for a new entry: a real consumer this year, harm or a conflict if the
key is accepted (for denied keys), or a control in the dialog (for owned keys).
Harmless obsolete keys (`keywords`) are accepted and earn nothing; a list of
everything obsolete would need keeping current.

Alternatives: a curated catalogue with labels, kinds and an "Add tag" search.
Rejected: a list to keep true every year, labels that would have to name
services, and most entries have no audience left. A per-row free attribute
list: rejected, every attribute widens what can go wrong.

### 3. Stored shapes

All new members are new keys, so nothing stored today changes.

| Where | Key | Shape |
|---|---|---|
| page, template, site | `robots.max_video_preview` | integer -1 to 3600 |
| page, template, site | `robots.noimageindex` | boolean |
| page, template, site | `robots.ai_answers` | `allow`, `own`, `deny` |
| page, template, site | `robots.ai_training` | `allow`, `deny` |
| page, template | `expires` | a Value of kind date: `{text: 'YYYY-MM-DD'}` or `'YYYY-MM-DDTHH:MM'`; at template scope also a date fact or a date field source |
| page, template, site | `tags` | list of rows, at most 20 |
| site identity | `verification` | list of `{name, code}`, at most 10 |

A row is `{element: meta, attr: name|property, key, value}` or `{element: link,
attr: rel, key, type?, value}`, or the same identity with `off: true` instead of
`value` (page and template only). `value` is a Value: `{text}` at every scope,
or a field source at template scope. Identity: meta `meta:<lowercase key>`
(name and property are the same key), link `link:<rel>` plus `:<type>` for
feeds. `Values::canon()` keeps the order of `tags` and `verification`, prunes
empty rows and exact duplicates.

Verification lives in the identity because it is a fact about the site, has no
inheritance and no draft, and `cleanIdentity()` already validates site-only
facts. A separate top-level `services` mapping was considered and rejected as a
second place for the same kind of fact.

The AI use choices live in the robots map so that they cascade per directive
and follow a translation's inherited robots (page-seo) with no new rule, even
though they are emitted as their own tags.

Config schema: `canvas_metatag.tag` (mapping with `Choice` constraints on
`element`, `attr`, `type`), `canvas_metatag.verification` (mapping, `code` with
a `Regex`; `name` is checked against the policy by `cleanIdentity()`, so the
names live in one file), the four robots keys, `expires` as
`canvas_metatag.value`.

### 4. Cascade per key, nearest layer wins

`Values::cascade()` gains one rule beside the robots merge: layers in the order
Metatag, site, target; for each identity the nearest layer that mentions it wins
with all its rows; `off` removes the identity. Rows keep their layer's order.
A repeated key is replaced as a whole, which is the rule people can predict
("the page's two `me` links replace the site's three").

Alternative: merging per row. Rejected: there is no row identity users can see
other than the key.

### 5. Metatag as the outermost layer of the resolver

When Metatag is installed and the entity is owned, `Resolver` reads
`MetatagManager::tagsFromEntityWithDefaults()` (the entity's own Metatag values
over its global, entity type and bundle defaults) and
`generateRawElements()` with a `BubbleableMetadata`. Neither invokes
`hook_metatags_alter` (Metatag 2.2.x), so `metatagsAlter()` keeps blanking
Metatag's own output exactly as today. Each raw `meta` or `link` element becomes
a row and passes the policy in read mode; an element with any other attribute
is left out. Owned keys and keys the head already carries are left out, so a
site code for a verification name wins over Metatag's code for the same name.

- If the bubbled metadata carries a `user` or `user.*` cache context, the whole
  layer is dropped and logged: the head never varies by user.
- Any exception: the layer is dropped and logged; the head is built without it.
- Cacheability: Metatag's defaults config tags and the bubbled metadata.

Alternatives: silence Metatag by output key and let it attach its surviving
tags itself, merging them into the headless head in the decorator. Rejected:
two paths, Output would need a third read of Metatag, and a page could not turn
a single Metatag tag off. Importing Metatag values into this module's storage
is a README non-goal.

New external dependency rows for ARCHITECTURE.md §11 (Metatag, not Canvas):
`MetatagManagerInterface::tagsFromEntityWithDefaults()` and
`generateRawElements()`, each pinned by `MetatagCoexistenceTest`.

### 6. Indexed html_head keys

`pageAttachments()` keys every row by list and position (`canvas_metatag:meta:7`,
`canvas_metatag:link:2`). Links stay in `html_head`, never `html_head_link`, so
no `Link` headers. This lands first, before any repeatable row.

### 7. Order of the head

`head.meta`: description, robots, AI use tags (answers, then training),
`og:*`, `article:*` (published, modified, expiration), the card hint,
verification codes in stored order, then other meta rows (Metatag's survivors,
the site's, the target's). `head.link`: canonical, hreflang, other link rows.
Then the head alter hook, then the existing filters (empty values, link
addresses), which also apply to the hook's rows. The fixed rows keep their
current order, so every existing test of the fixed head stays valid.

### 8. The stop date

One Value feeds `unavailable_after` inside robots and, with `og:type` article,
`article:expiration_time`. A date without a time is the end of that day in the
site's time zone; the emitted value always carries the offset, as structured
data dates do. At template scope it links like any other date value; an empty
or hidden link means no stop date (the safe default: the page keeps showing).
No max-age is needed: the head text does not change over time.

### 9. AI use

Two closed choices per scope, emitted as one meta tag per directive named for
the crawler in the policy (`ai_use_crawler`). Combining both directives in one
tag is not documented by that search engine, so they are separate. The date
1 Feb 2027 is one constant in the dialog, used by the note and the Checks rule.
Free text never reaches this tag: the crawler's name is refused as an other
tag.

### 10. The head alter hook

`hook_canvas_metatag_head_alter(array &$head, array $context)` with
`entity`, `draft` and `cacheability` in `$context`, invoked once at the end of
`resolve()` through `invokeAllWith()` so each row can be attributed to its
module. `head.script` is restored afterwards: structured data has its own path.
The structural filter (meta and link only, scalar string attributes, attribute
names of lowercase letters, `:` and `-`, none starting with `on`, links
absolute http(s)) runs after the hook and logs once per request.

### 11. Paste runs in the dialog only

`paste.ts` parses with `DOMParser` (`text/html`, an inert document never
adopted into the dialog) and reads `meta` and `link` attributes only;
`check-patterns.mjs` allows `DOMParser` in that one file. Verdicts come from
`tagPolicy`. The server never parses HTML and never receives the pasted text:
it receives rows and checks them again.

### 12. State additions

`GET /state` adds `tagPolicy`, `resolved.sources` (for each added row of
`head.meta` and `head.link`: list, index and `source` of `metatag`, `site`,
`target`, `verification`, `ai_use` or `module:<name>`), and `verification` in
the site identity. `head` keeps exactly its four keys.

## Risks / Trade-offs

- [The AI use date and directive meanings come from one announcement] →
  Re-verify before release; the date is one constant; the copy says "one
  search engine"; Checks says when it is not read yet.
- [Metatag sites get more tags on Canvas pages after the update] → That is
  what they had before installing this module. The install message and a
  Checks row say so, and each tag can be turned off per page or type.
- [Metatag API change] → Two public interface methods, pinned by a kernel test;
  a failure drops the layer and logs, never the head.
- [Advanced grows to 11 rows on a page] → It stays closed at defaults; the AI
  use label splits it; the summary names what is set.
- [Verification is missing where the front page is not owned] → Checks says so
  to administrators; reopening "routes it does not own" is an open question.
- [A past stop date silently removes a page] → Typed per page or linked per
  type only, never a site default; Checks lists a passed date as a fix with a
  one-click remedy.
- [Frontends that map a fixed set of head keys drop other tags] → README says
  to render `head.meta` and `head.link` on the server; the existing upstream
  ask is extended.
- [Order of changes] → The deltas for "Effective values layer the target over
  the site", "The page type sets og:type and the article times" (head-output),
  "Site settings are one configuration object" (site-seo) and "Where values
  can be linked" (value-links) are written on top of link-values-to-fields. If
  that change's plan changes before it archives, re-derive these four blocks
  from its archived text.

## Migration Plan

- No update hook: every new member is optional and absent means today's
  output.
- Deploy order inside the change: group 1 (indexed keys, hook) changes no
  output; group 2 (AI use, robots extras) is dated and ships first; the Metatag
  layer changes output only on sites with Metatag; the rest adds output only
  where a site sets something.
- Rollback: reverting the code leaves unknown keys in stored values, which read
  mode drops silently (today's cleaner), so the head returns to today's.
- Uninstall: unchanged; the page field, the template setting and the site
  configuration go as today.

## Open Questions

- Should Metatag's front-page defaults count when the entity is the front page?
  `tagsFromEntityWithDefaults()` does not read them. Answerable later without a
  spec change if the answer is "no"; "yes" adds one scenario.
  `add-home-page-defaults` proposes "yes", with the front page decided by its
  `front-page` capability. That scenario then belongs to that change, after
  this one is archived.
- The exact wording of AI use rows and note after re-verifying the
  announcement.
