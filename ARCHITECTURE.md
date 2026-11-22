# Canvas Metatag: architecture

How the module is wired. The code is the source of truth; this document
explains its shape so that a maintainer does not have to rebuild it from a
dozen files. Every statement here was checked against the code as it is. The
README says what the module does for site builders; this says how.

## 1. The big picture

Canvas Metatag is a Canvas extension of `type: canvas`: a React app that Canvas
opens in a modal dialog, in a same-origin iframe, from
`extension/index.html`. The app talks to a small JSON API of this module. Every
head the module emits, in Drupal's own HTML, in the canvas_headless content
API and in the dialog's previews, comes from one PHP class, `Resolver`.

```
 CANVAS EDITOR (parent window, Canvas's React app and Redux store)
 ================================================================
   Page data form, layout saves, "Review changes", preview iframe
        ^  reads store, dispatches 4 private actions, reads preview DOM
        |  (host.ts is the only file that touches the parent window)
 SEO DIALOG IFRAME  extension/src  (React, Radix Themes)
 ================================================================
   App.tsx (reducer + effects)   model.ts (rules, mirror of Values)
   components/*Tab.tsx           api.ts (fetch, CSRF, error codes)
        |  JSON, same origin, cookie session, X-CSRF-Token on writes
        v
 DRUPAL  src/
 ================================================================
   ApiController   GET  /canvas-metatag/api/state
                   PUT  /canvas-metatag/api/draft/canvas_page/{id}
                   PUT  /canvas-metatag/api/draft/content_template/{id}
                   PUT  /canvas-metatag/api/site
                   GET  /canvas-metatag/api/media
        |  writes                       |  reads
        v                               v
   Canvas AutoSaveManager       Resolver::resolve()  <-- Values (rules)
   (page + template drafts)            |              <-- SchemaGraph
   canvas_metatag.site config          |                  (JSON-LD)
                     +-----------------+-----------------+
                     v                 v                 v
           CanvasMetatagHooks  HeadlessContentController  GET /state
           (coupled HTML head) (canvas_headless JSON)     ("resolved")
```

One producer, three consumers. `Resolver::resolve()` returns
`head{title, meta, link, script}`, the effective social image, a report on the
structured data, and the cacheability of all of it. The coupled hooks and the
headless decorator copy `head` as it is. `GET /state` returns the same array
without the cacheability, so the dialog's Output view and previews show what a
visitor gets.

`Values` (validation, cascade, text outputs) and `SchemaGraph` (type registry,
literal checks, `@graph` assembly) are static and pure. The text rules of
`Values` exist a second time in TypeScript (`extension/src/model.ts`) so that
the dialog can preview without a round trip. `tests/fixtures/text-cases.json`
pins both implementations to the same cases.

## 2. Ownership: which heads are ours

`Resolver::owns($entity, $draft)`:

- a `canvas_page` is always owned;
- a node is owned when `ContentTemplate::loadForEntity($node, 'full')` exists
  and is enabled. With `$draft` (editor previews) an existing disabled
  template counts too, which is how Canvas previews a template that was never
  published;
- nothing else is owned.

Where the module emits a head:

| Adapter | Routes | Entity |
|---|---|---|
| Coupled | `entity.canvas_page.canonical`, `entity.node.canonical` | the route parameter (already the negotiated translation), stored, never a draft |
| Headless | canvas_headless content API, `CanvasContentRoute::isPreview` false, status 200, view mode `full` | `route.entity` of the response, its draft only for a preview token (section 12) |
| Dialog | `GET /state` | the page or its draft; the template's preview node |

Every other route keeps core's head and the Metatag module's, untouched. The
exception is Metatag on owned entities: section 10.

## 3. The three scopes

| Scope | Stored in | Written by | Goes live |
|---|---|---|---|
| Page | base field `canvas_metatag` on `canvas_page` (`string_long`, translatable, revisionable), sparse JSON | `PUT /draft/canvas_page/{id}` into the page's Canvas draft | when the page is published in Canvas |
| Template ("Every Article") | third-party setting `canvas_metatag.values` on the node type's `full` `ContentTemplate` | `PUT /draft/content_template/{id}` into the template's Canvas draft | when the template is published in Canvas (which also enables it) |
| Site | config object `canvas_metatag.site` (`identity` + `values`) | `PUT /site` | immediately; last save wins |

Allowed keys per scope (`Values::KEYS`):

| Key | Page | Template | Site |
|---|---|---|---|
| `title` (main part) | yes | yes | no: each page's own title |
| `title_end` (ending) | yes | yes | yes |
| `description` | no: Canvas's own Page data field | yes | no |
| `canonical` | yes | no | no |
| `social{title,description,image}` | yes | yes | no |
| `robots{...}` | yes | yes | yes |
| `schema{type,props,custom,skip,main}` | yes | yes | no |
| `schema.extend` | `#primary`, `#webpage` | `#primary`, `#webpage` | `#identity` |

A page's description is Canvas's own `description` field. The dialog edits it
by dispatching into the editor's Page data form (section 9), so it is saved,
reviewed and published by Canvas like any other Page data change.

Page and template values live in Canvas drafts, so they show in "Review
changes", are discarded there, and publish with the rest of the draft. The
module never saves a page or a template itself (section 9).

Site identity (`kind` organization or person, `name`, `separator`, `logo` and
`default_image` media UUIDs, `same_as` profile URLs) is site-only and has no
draft.

## 4. Data model

The shape is the same in all three places, minus the keys a scope does not
allow: JSON text in the page field, a config mapping for the template and the
site (typed in `config/schema/canvas_metatag.schema.yml`). Empty values are
pruned and map keys sorted (`Values::canon()`), so an empty override is no
value at all (`Values::encode()` returns NULL), and Canvas's draft hash does
not change when nothing changed.

```json
{
  "canonical": "/plans",
  "robots": { "max_snippet": -1, "noindex": true },
  "schema": {
    "custom": "{\"@type\":\"FAQPage\",\"mainEntity\":[...]}",
    "props": { "offers_price": { "text": "25" }, "offers_priceCurrency": { "text": "EUR" } },
    "type": "Product"
  },
  "social": { "image": { "media": "<media uuid>" } },
  "title": { "text": "Plans and prices" },
  "title_end": { "text": "" }
}
```

- Every value (title, title ending, description, social title, description
  and image, each `schema.props` entry) is a map with exactly one key
  (section 5): `{"text": ...}`, `{"fact": ...}`, `{"media": uuid}` or
  `{"source": {"expression", "sourceType"}}`. `{"text": ""}` is stored only as
  `title_end`, where it means "No ending". Lengths of typed text: title 255,
  description 1000, social title 255, social description 1000, a schema
  property 2000.
- `canonical` is a path on the public base (one leading slash, RFC 3986
  characters plus non-ASCII letters) or an absolute http(s) URL with a host
  and no credentials; never a fragment.
- `robots`: booleans `noindex`, `nofollow`, `nosnippet`; integer `max_snippet`
  (-1 to 1000); `max_image_preview` one of none, standard, large.
- `schema.type` is a key of `data/schema-types.json` (read mode keeps a type
  the registry no longer has, so the dialog can say so; output is a web
  page); `schema.props` are that type's property keys; `schema.custom` is
  custom JSON-LD text, stored as written (section 7); `schema.skip` lists
  the `@id`s, as written, of hand-added items left out until they are on
  the page (cleaned against the custom JSON-LD on every read and write);
  `schema.extend` holds details added to the module's own nodes, as written,
  by short id; `schema.main` is the `@id` of the hand-added item a plain web
  page is mainly about.
- `canvas_metatag.site:currency` is an ISO 4217 code (`data/currencies.json`)
  or empty: the currency of every price that names none.

`Values::clean($input, $scope, $accepts, $inheritedType)` is the one
validator. `$accepts($source, $kind)` says whether a field link is offered
(`Sources::accepts()` for a template, never for a page or the site).

- Write mode (`$accepts` given) reports every problem as
  `dotted.path => sentence`; the API answers 422 with that map. A value with
  two keys, a fact a place does not offer, or a link the menu does not offer
  is refused. A stored link whose field is gone is kept as it is, so the other
  values stay savable.
- Read mode (`$accepts` NULL) drops what is invalid silently and keeps links,
  which output reads later (a link that reads nothing gives the default).
  Everything stored is cleaned again in read mode when it is read, so a value
  that bypassed the API (config import, JSON:API, custom code) still comes out
  safe.
- Scope rules: a page may link only `title_end` (to Site name),
  `social.image` (to Image) and schema details that are not text; the site
  may link only `title_end` to Site name. A template may link every value.
- Control, C1 and bidi override characters are stripped; typed text is never
  trimmed, scanned or rewritten otherwise. Braces in typed text are text.

The registry `data/schema-types.json` describes eleven types (`WebPage`,
`AboutPage`, `ContactPage`, `CollectionPage`, `Article`, `BlogPosting`,
`NewsArticle`, `Event`, `Product`, `Service`, `ProfilePage`). Six are kinds
the editor chooses ("What this page is": `kind` with its label, its name in
a sentence, what it can earn, what it is not for, an icon and an order); the
rest are variants of one (`variant_of`, chosen under `variants`: "Kind of
article"). An entry has a label, a `page_type`, optionally a `primary_type`,
`og_type`, `refs` to our own nodes (a ref may be conditional: `if` a gate
detail has a value, `unless` a detail is set), `nested` types, `main` (the
details shown before More details), `slots` and `say` (the read-back's
sentences, section 7), and `props` with `key`, `kind` (text, url, date,
number, enum, currency, image), `default` (a value, usually
`{"fact": ...}`), `level` (required: the main node is withheld without it),
`options`, `option_labels`, `pattern` and `emit: false` (a gate: stored,
never in the graph, such as "Bought on this page"). One level of `extends`;
a variant never inherits its base's kind.
`SchemaGraph::validLiteral()` is the only check of a literal against its
property; the cleaner, the graph builder and the AI submodule all call it.

`canvas_metatag_post_update_values_as_parts()` converted the token strings of
earlier releases (`Legacy::convert()`): a title split at its last `{sep}`
into its main part and ending, a single token into a fact or a link, a
composite into its first piece, with one log line per loss. Site and
templates first, then their drafts, then page revisions 50 at a time and
page drafts.

## 5. Dynamic values (facts and links)

A value is typed text, a fact, a chosen image or a link to a field. Typed
text is never scanned: `{site}` typed into a title is the six characters.

| Fact | Value | Kind |
|---|---|---|
| `title` (Title) | the entity label | text |
| `description` (Description) | page: Canvas's description field; node: the first `text_with_summary` field's summary, else its text cut at 160 | text |
| `site` (Site name) | identity name, else `system.site:name` | text |
| `url` (Page address) | the entity's own public URL | address |
| `author` (Author) | owner's label (`view label` access) | text |
| `published`, `modified` (First published, Last updated) | `created`, `changed` as ISO 8601 in the site timezone | date |
| `image` (Image) | page: its `image` media; node: the first image field that resolves | image |

`Resolver::facts()` lists them with their labels, kinds and, for a node,
which field Description and Image come from. Which facts a place offers is
`Values::FACTS` and the registry's kinds.

A link (templates only) is a Canvas entity-field prop source,
`{"expression": "ℹ︎␜entity:node:article␝field_summary␞␟value", "sourceType":
"entity-field"}`, stored as Canvas stores it in a component input.
`src/Sources.php` is the only file that calls Canvas's prop source code
(`BoundaryTest` enforces it):

- `vocabulary($bundle)`: what Canvas's `PropSourceSuggester` offers for a
  synthetic component with one prop per kind (text, address, date, number,
  image), labelled by Canvas's `Labeler`, in the order of the bundle's form.
  Adapters, the title, created, changed and owner fields, the module's own
  field, comment fields, any path through an account, file URIs, Canvas's
  computed addresses (`␞␟url`: a reference's URL, a link's resolved URL,
  which keep the value and access of the first account that read them; a
  link is read through its `uri`) and image objects other than the standard
  one are left out. A reference's own name (its `title` or `name`) is marked
  `names`: a filter for the reference finds it first. Formatted text is read as
  stored (`value`, `summary`), never as `processed`; a text list gives its
  stored key (its label is shown); a decimal, which Canvas never matches, is
  added as the module's own `decimal` row, read as its stored digits. The standard image object is rewritten to read the
  file's URI. Cached per bundle and language with `entity_field_info`,
  `config:media_type_list` and the form display's tag, and for the rest of
  the request in `cache.memory` with the same tags (typed as any backend:
  while updates run, every bin is an update backend that keeps nothing). A
  build that throws is logged once and gives no rows for five minutes, and a
  head built meanwhile is cached only until the next try; with `$strict` (the
  post_update) it throws, so that the update fails and can run again.
- `evaluate($source, $host, $kind, $cacheability)`: `[status, value]` with
  status `ok`, `empty`, `hidden` (Canvas denied `view` access on a hop) or
  `broken` (not offered any more, another kind, another bundle, malformed,
  or anything Canvas throws). Never an exception.
- Account rule: when anonymous visitors may view the host, the link is read
  as anonymous (account switcher) and only tags and max-age are kept, plus
  `config:user.role.anonymous`; so a published head never varies by user.
  Otherwise (an unpublished preview node) it is read as the current user with
  full cacheability.
- A multi-value field gives its first non-empty item. Dates become ISO 8601 in
  the site timezone (a date-only value stays a date); formatted text becomes
  sentences and, for a description, an excerpt of at most 160 code points
  (`Values::excerpt()`).

`Resolver::link()` finishes a value: an address on the public base, an image
through its file (public files only). `Resolver::sourceRows()` gives the
dialog every row with the previewed node's value and status.

Formatted text is reduced to plain text in `Values::fromHtml()`: the content
of `script`, `style` and `template` elements is removed first (also when the
element is not closed), then tags. The end of each heading, list item,
definition, table row and caption, and the start of each list and heading, is
marked before tags go; after entities are decoded a mark becomes a full stop,
unless it follows a sentence or clause mark (Latin, CJK in full- and
half-width forms, Arabic, Urdu or Devanagari; closing quotes and brackets
after it included) or nothing, so "Made to last", a nested list and a table
read as sentences, not as one run-on line.

The dialog shows a link or a default as a box that names its source and the
previewed value; the link button and the box open a menu of the type's fields
(levels for references) and the page's facts (`LinkMenu.tsx`, `Value.tsx`).

## 6. Inheritance and output

### Layers

`Resolver::layers($entity, $draft)` returns four cleaned layers:

- `site`: `canvas_metatag.site:values`, read with config overrides;
- `identity`: `canvas_metatag.site:identity`;
- `target`: the page field, or the node's `full` template setting (its Canvas
  draft when `$draft`);
- `from_default`: for a page translation that is not the default one, the
  default translation's `robots`, `social.image` and `schema.type`. The
  translation's own `schema.props` are cleaned against that inherited type.

`Values::cascade()` then takes `title_end` from the target, else the site,
merges `robots` per directive (target wins), and takes everything else from
the target only. There is no site-wide title, description or social text by
design.

### Text outputs (`Values::texts()`)

```
title_main         = title value                -> else Title fact
title_end          = title_end value            -> else Site name fact
                     ({text: ""}: no ending)
title              = title_main + " " + separator + " " + title_end
                     (either part alone when the other is empty)
description        = description value          -> else Description fact
social_title       = social.title value         -> else title_main
social_description = social.description value   -> else description
```

Over 255 characters the title's main part is cut at a word and the ending
stays whole.

Each is cut by `Values::cut()`: `Values::plain()` removes controls,
collapses whitespace, trims and cuts to the limit in code points, never inside
an extended grapheme cluster (an emoji sequence, a flag, a letter with its
marks is left out whole; PCRE `\X`, `Intl.Segmenter` in `model.ts`). A cut
inside a word then backs up to the last space when that space is within the
last tenth of the limit, and the title's separator check removes a separator
the cut left at the end. Structured data values, URLs and the site name get
`plain()` only. A node's `{description}` cut from its text (160 code points,
at a word) drops a split cluster the same way (`Values::whole()`). The output
is plain text; the consumer escapes it.

### Other outputs

- Canonical: the override (a path is put on the public base), else the
  entity's own URL (`Resolver::url()`).
- Robots: fixed directive names in a fixed order; free text never reaches it.
  `max-snippet` is left out under `nosnippet`.
- Image chain: `social.image` (a chosen image, the Image fact or a link),
  then the Image fact, then the site default image. Each must resolve for the
  anonymous visitor, else the next is tried. The result carries `source`:
  override, entity or site.
- Hreflang: one alternate per published translation plus `x-default` (the
  default translation), only when there are two or more.
- `og:type` is the registry's `og_type` (`article` for the Article family),
  else `website`; `article:*` times only for those.

## 7. JSON-LD `@graph`

`SchemaGraph::build()` emits one `{"@context": "https://schema.org",
"@graph": [...]}`. `{home}` is the public base plus `/`; `{url}` is the
entity's own public URL, never the canonical override, so a page's identity
does not move when its canonical does.

| Node | `@id` | When |
|---|---|---|
| Organization or Person | `{home}#identity` | always |
| ImageObject (logo) | `{home}#logo` | logo set and resolvable |
| WebSite | `{home}#website` | always |
| WebPage (or the type's `page_type`) | `{url}#webpage` | always |
| ImageObject (page image) | `{url}#primaryimage` | an image resolved |
| primary node (Article, Event, Product, ...) | `{url}#primary` | the type has a `primary_type` and every required property resolved |

These ids never change after release: other pages and search engines refer to
them. The page node points at the primary node through `mainEntity` only when
it ships. When a required property is missing the primary node is withheld.
Building reports, with the graph: `withheld` (`missing`, `dropped`: required
values that gave nothing or did not fit, and the node as it would have been),
`dropped` (every value that did not fit its kind, with what it gave),
`sources` (each value's branch: `set`, `default`, `site`), `gates`,
`unknown_type`, and `nodes` (every node with its origin `site`, `page`,
`main` or `hand`, its place in `@graph`, or why it was left out:
`withheld`, `skip`, `reserved`, `duplicate`). Nothing is silent.

### Value shapes: groups, lists, references

`data/schema-types.json` describes each type's properties with a few value
shapes instead of one kind per schema.org shape. `SchemaGraph::types()`
expands them at load; the client receives the expanded registry.

- **Shapes and groups.** `$shapes` (address, venue, who, geo, pay, tickets,
  nutrition) list their parts in a fixed order and what they `require`
  (each entry a list of parts of which one must be set). A type's group
  entry (`group`, `use`, `label`, `level`, `ref`) becomes one property per
  part, keyed by path as before (`location_address_postalCode`), plus the
  group's reference (`location`) when it has one; the type lists the group
  under `groups` and each nested node's type under `nested`. A group is
  emitted only when its requirements resolve; otherwise it is reported under
  `incomplete` and the verdicts judge the node with the group as it is
  (`judged`), so a verdict names the part it misses. A required group left
  out withholds the main node. A group's name part is labelled by the group
  outside it ("Venue") and by its own label inside it (`short`).
- **Scopes.** A type or a property lists the scopes where it is **not**
  offered, with a reason (`component`: only a component mapping could fill
  it; `policy`). `SchemaGraph::offered()` is read by `Values::clean()`
  (refused with "This comes from a field or a component."), by `build()`
  (ignored), and by the dialog (not shown). `CoverageContractTest` and
  `coverage.test.ts` fail when an offered property has no way in that is not
  custom JSON-LD.
- **Lists.** A `list` property takes every item of a linked multi-value field
  (`Sources::evaluate(..., TRUE)`), in field order, without empty items, up
  to its `max`; one formatted text gives its list items, else its paragraphs
  (`Values::items()`), one plain text its lines. Lists of references, URLs,
  images and codes drop repeats; lists of text keep them. A typed value is
  several codes on a code list (`FI,SE`), one value on a URL, image or
  reference list, and refused on a text list. A list of one is emitted as
  its item. `join` makes several values one text; `item` wraps each
  (`HowToStep` when there are several, `Country`).
- **References.** A `ref` value is the publisher (`{fact: identity}`), a
  reference field on a template, or a name (`{text}`). Only as many targets
  as the property emits (`max`) are read; the rest are counted as over the
  cap, never read. `Resolver::target()` reads each
  target's own SEO values and fields, never its rendered page and never its
  references: its label, public URL, the kind it is described as (a
  restaurant is a local business, a place and an organization:
  `SchemaGraph::ancestors()`), its address when it has one, and, for a
  course, whether it has a summary. An accepted target is emitted as
  `{@id, @type, name, url, address}`; any other gives only its name, which a
  group keeps beside its own parts, and is reported under `refs_inline`; a
  target visitors may not see, in the host's language, is never named
  (`Resolver::target()` checks the translation and gives NULL, once per
  target; `dropped_items`, reason `hidden`). A kind of place linked to a field counts only when it is a
  listed kind. Its cache tags join the head; a target no template describes
  yet joins it with its bundle's template, or the template list, so that
  describing it later rebuilds the head. A list group with one target that
  gives only a name (a workplace page described otherwise) keeps its own
  parts beside it, as a venue does. On a Canvas page an organizer or a
  recipe's author nobody set is the publisher (`page_default`), reported
  under `defaults`; "Someone else" not named yet is stored as `{text: ''}`
  on the reference (kept by `Values::canon()` and the client's `prune()`, as
  "No ending" is), so the default stops and nothing is emitted. Event
  templates relied on the site as the organizer before `page_default`:
  `canvas_metatag_post_update_event_organizer()` stores it on those that
  never set one. A required group nothing was set for withholds the main
  node; one set but incomplete is left out and reported, so an event that
  shipped with only a street keeps its Event, and
  `canvas_metatag_post_update_country_codes()` stores a venue country
  written as a name or code as its code.
- **Enum emission.** `emit` is `url` (`https://schema.org/X`, the default),
  `code` (`FULL_TIME`, `FI`), `type` (the main node's `@type`: a kind of
  place) or `false` (a gate).
- **Durations, hours, pay.** A duration is a whole number of its `unit`; a
  linked one keeps the unit its field counts in beside the source
  (`{source, unit}`); emitted as ISO 8601, at most 30 days
  (`SchemaGraph::DURATION_MAX`, also in `controls.ts`). `pair` emits prep and cook time
  together or neither (`unpaired`). Opening hours are one week in a small
  grammar shared with the dialog (`SchemaGraph::hours()`, `controls.ts`,
  `tests/fixtures/hours.json`); weekly days with the same times share a node,
  a dated entry is its own, dates that have passed are left out (the head is
  then cached until the day ends). Pay with one amount is a `value`; From
  above To is left out (`pay_order`).
- **The job description** is the only text kept as markup:
  `SchemaGraph::filterHtml()` keeps `p ul ol li br strong em` and `a` with an
  absolute http(s) `href`, removes the content of script, style and template
  elements, and cuts at 20,000 characters; then every `<` that does not
  start one of the tags it rebuilt is escaped. It is linked only
  (`link_only`), never typed or proposed by AI; job postings are offered on
  templates only. Where the work is (`work`: on site, fully remote, on site
  or remote) is a gate: remote gives `jobLocationType` `TELECOMMUTE`, and it
  gates the workplace and the applicant countries (a group's `when` holds
  for each part). A one-of requirement names the alternative an answer has
  not ruled out (`SchemaGraph::asked()`).
- **Each page's own** (`per_item`): a closing date, performers, a venue page
  and a workplace page are linked only on templates
  (`SchemaGraph::typable($prop, $scope)`), never typed once for every page.
- **A country** is a code; a linked one in lower case is upper-cased, and a
  name stored before countries were codes is kept when read, so the report
  lists it as dropped.
- **A list page** (`CollectionPage` with `items`, templates only) is the page
  node's `mainEntity`: an `ItemList` of the public pages a reference field
  holds, in order. The course list feature counts the linked courses that
  are complete (`items` in the report; `features()` reads it).

Commerce: a price billed every month or year (`billing`, a gate) is also
emitted as `offers.priceSpecification` (a `UnitPriceSpecification` with the
`billingDuration` and the unit code `MON` or `ANN`); a product's offer has
the identity as `seller` only when "Bought on this page" (`sold_here`) is
yes; a price's currency defaults to the site currency (never an offer with
no price). An image a main node takes
by default is the one chosen to share the page, else the page's own, never
the site default.

### Search features and the report (dialog only)

`data/search-features.json` lists each search feature the module knows
(live or retired, the types it applies to, `required`, `complete`,
`recommended` and rule paths, `not_for` misfits, `where` it shows, at most
two `confirm` guidelines, documented `names`, the source address) and the
date it was `reviewed`. `SchemaGraph::features($graph, $ctx)` evaluates it on
the built graph, following `{"@id"}` references inside it (the withheld main
node is judged as it would ship): one verdict per feature and node, `ready`,
`complete`, `needs` (with what is missing and what sets it), `unanswered`,
`not_fit` (with a reason), `not_here`, `retired`, or `none`.
`SchemaGraph::rules()` checks the hand-added items over the merged graph: a
second identity, a reference to an item of this site that is not there, a
review or rating of the site's own organization (not an employer rating, not
another company), an address that is not a full one.

Delivery and report are two functions: `Resolver::resolve()` builds the head
for every consumer; `Resolver::report()` calls it and adds `features` and
`rules`. Only `ApiController::state()` calls `report()`, so a visitor's
request never computes them (`DeliveryPathTest`). The dialog reads the
graph back (`extension/src/readback.ts`: the first `say` variant whose slots
all resolve, values formatted with `Intl` in the dialog's language, a fact
list when a sentence has no translation) and compares it with the page
(`checks.ts`: text, prices next to a currency with their period, dates four
ways, images by file, ratings; never codes).

Registry and rules strings are translated on the server:
`scripts/registry-strings.php` writes `src/RegistryStrings.php`, one literal
`TranslatableMarkup` per string (context `canvas_metatag:schema`), and a CI
job fails when it is stale. `/state` carries `registry` and
`search_features` in the dialog's language; a type's `say` is `null` when one
of its sentences has no translation in locale storage. A CI job warns when
the rules were reviewed more than 120 days ago.

Property keys with underscores are paths (`location_address_streetAddress` is
`location > address > streetAddress`), typed by `nested`. Enums become
`https://schema.org/<Value>`; a date-time without an offset gets the site
timezone's offset; ImageObjects leave out unmeasured (0) dimensions.

Custom JSON-LD (`schema.custom`) and added details (`schema.extend`, by
`#primary`, `#webpage` or, at Site scope, `#identity`) are checked by
`Values::checkCustom()` on every read and write, and the dialog's
`extension/src/custom/validate.ts` runs the same fixtures
(`tests/fixtures/custom/`): valid JSON, at most 64 KB as written and 32 KB for
all of a page's texts together counted minified, 1 to 10 objects each with an
`@type` of one to four types, depth at most 8, no `null`, no number that
cannot be written out, only `@type`, `@id` and (top level) a schema.org
`@context` starting with `@`, an `@id` that is http(s) or `#name`, no string
starting with `javascript:` or `vbscript:`, or with `data:` or `file:` followed
by more text, and a re-encode probe with the output's flags. A refusal keeps
its sentence in `errors` and adds `error_paths` ({item, path}). A hand-added
item never takes an id of `SchemaGraph::MODULE_IDS` (`identity`, `logo`,
`website`, `return-policy` on `{home}`; `webpage`, `primaryimage`, `primary`,
`group` and the prefix `c-` on `{url}`), and two never share one; values
stored before that rule are renamed `‹id›-2` when read
(`Values::renameReserved()`) and by
`canvas_metatag_post_update_own_jsonld_as_written`, which also writes stored
text out with two spaces in its own key order. The text is stored as written,
never re-encoded.

On output (`SchemaGraph::preparer()`), `#name` ids are put on `{url}` except
the short ids of the site's own items, which point at `{home}`; fixed names
(`{title}` …) are filled anywhere in a text (`Values::fillFacts()`); a whole
value `{field.‹name›}` or `{field.‹name›.‹name›}` is filled through `Sources`
for the item being output (`Resolver::fill()`: dates in the site's zone with
their offset, a number only where the name expects one, an absolute address
only where the name expects one, text cut at 5,000 characters at a word; filled
text that starts with a refused scheme is broken, as typed text would be
refused), and `{media.‹uuid›}` with the file's public address; a
fill that gives nothing leaves out the value, an object left with only its
type, id and rating bounds, an emptied list, and an item left with only its
type and id, each reported in `empty`. A nested reference to one of ours
becomes a bare `{"@id": ...}`, or is removed and reported when that node is
not in the graph. Added details merge into our nodes per leaf
(`SchemaGraph::merge()`): objects at any depth, list selectors `offers[*]` and
`offers[name=X]`, `@type` only added to; a value we emit wins and is reported
in `clashes` with its path. `schema.main` makes one hand-added item the plain
web page's `mainEntity`. A graph over 256 KB keeps only our own nodes
(`over`); a graph that cannot be encoded leaves the head without its script
and keeps every other tag (`Resolver::script()`, `unencodable`).

## 8. The emitted head

| Row | Coupled HTML | Headless `head` |
|---|---|---|
| title | `head_title` in `preprocess_html` | `head.title` |
| `description`, `robots`, `twitter:card` | `<meta name>` via `html_head` | `head.meta[]` |
| `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (+ `:width`, `:height`, `:alt`), `article:published_time`, `article:modified_time` | `<meta property>` | `head.meta[]` |
| canonical, hreflang alternates | `<link>` via `html_head` (not `html_head_link`, so no Link headers) | `head.link[]` |
| JSON-LD | one `<script type="application/ld+json">` | `head.script[0]` with `textContent` as an object |

The card hint is `summary_large_image` from an effective image of 600 × 157
px (`Resolver::LARGE_CARD`), else `summary`; the dialog's link preview draws a
large card by the same rule (`LARGE_CARD` and `smallCard()` in `model.ts`,
whose numbers also word the reason in its About this preview tip and, through
`largeCardNeeds()`, the size Checks ask for), so the card the head asks for
is the card the editor sees.

Rows with an empty value are omitted; a link whose `href` is not an absolute
http(s) URL is dropped. The coupled adapter also removes core's canonical and
shortlink (`entity_view_alter`) and content_translation's hreflang links
(`page_attachments_alter`) on owned routes, so each exists exactly once.

Escaping: meta and link attributes go through the render system. The JSON-LD
script is the one place this module declares markup safe: it is
`json_encode()` with `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS |
JSON_HEX_QUOT` (`CanvasMetatagHooks::JSON_FLAGS`), so no text can end the
script element. The headless `head` is JSON; the frontend serializes it
(README, "Headless delivery").

A failure while building the coupled head is caught in
`CanvasMetatagHooks::head()`, logged to the `canvas_metatag` channel, and the
page is served with core's head (and Metatag's, if installed). The same holds
for the headless decorator. The head may be lost; the page never is.

## 9. Writing into Canvas drafts

### Why the module never saves the page or template

Page and template SEO must publish together with the layout, appear in
"Review changes", and be discarded with it. Saving the entity directly would
publish it immediately and also conflict with the open editor. So the value is
written into the same Canvas auto-save entry the editor writes, under the
editor's own client id, and Canvas's publish stores it like any other field or
third-party setting.

### The editor client id

Canvas's conflict rule is per client: every editor tab has a
`clientInstanceId`, and each auto-save entry remembers the client that wrote it
and a hash. The dialog reads, through `host.ts`:

- `publishReview.clientInstanceId`,
- `publishReview.autoSavesHash[<layout URL>]`: the entry map
  (`{autoSaveStartingPoint, hash}` per auto-save key) for this page
  (`canvas/api/v0/layout/canvas_page/{id}`) or template
  (`canvas/api/v0/layout-content-template/node.{bundle}.full/{previewId}`),
- the langcode, from the page's auto-save key `canvas_page:{id}:{langcode}`.

No token, no write: without both, the target scope is read-only. Right after
a load (another page, or another node in a template's preview) the editor has
not stored the new draft yet: for up to 2 s that state is not shown, the
fields stay as they were and a change typed meanwhile waits for the token.
Stored later than that, the change is kept (the footer says it is not stored)
and goes out once the token is there. A change left in session storage is
restored or offered only for a writable target; a load that came before the
token looks at it again once the token is there. Another node in the same
template's preview keeps the view, its values and any change typed while the
node loads (phase `refreshing`), instead of the loading placeholder.

### The write procedure

```
 dialog (model.ts saveDraft)                 server (ApiController)
 ---------------------------                 ----------------------
 edit -> sessionStorage (sync) -> 400 ms timer
 whenIdle(): canvasLayoutRequestInProgress
             is empty
 PUT draft {values, langcode, ------------>  Values::clean (write mode)
   client_instance_id, auto_saves}           422 -> refused paths; a value
                                               equal to the stored one is
                                               carried forward instead
                                             validateAutoSaves([entity],
                                               only this target's entry,
                                               editor client id) -> 409
                                             read draft (bypass cache), or
                                               clone the stored entity
                                             set field / 3rd-party setting
                                             saveEntity(target, client id)
               <-------------------------    {values} (canonical echo)
 quiet(250): no layout request for 250 ms
 GET /state  ------------------------------>  pageContext / templateContext
 canon(state.target.values) == echo?
   no  -> an editor save overwrote ours: retry (max 5)
   yes -> confirmed; newer edits waiting? go again
```

Details that matter:

- `validateAutoSaves()` is Canvas's own `AutoSaveValidateTrait` (`@internal`).
  With the same client id only the starting point must match; with another
  client id the hash must match too. The trait reads `$this->autoSaveManager`,
  so the controller property must have exactly that name.
- The server reads the draft with `bypass_cache` and writes immediately after.
  Nothing slow may run between the read and the write.
- Canvas's next layout save (`ApiLayoutController::post()`) starts from the
  auto-saved entity and converts only the fields in its form. The
  `canvas_metatag` field has no form display, so it is carried forward, and so
  is the template's third-party setting.
- A value sent back exactly as the draft (or the stored entity) holds it is
  carried forward although it no longer passes (`ApiController::carry()`):
  read mode keeps it, and every other field must stay savable. Site saves do
  the same against the stored site values.
- A page translation's details (`schema.props`) belong to the type it
  inherits from the default translation's draft. While that type differs from
  the published one, `putPage()` writes the translation's details of the
  published type along, unseen and never echoed, so that taking the type
  change back loses none of them.
- A 422 that names new paths is not counted as an attempt: those fields are
  marked refused (the footer says "other changes saved") and the PUT is resent
  with the refused paths at their last confirmed value. A refused field never
  deletes a saved one.
- Writing the stored value back makes Canvas drop the draft (Canvas compares
  hashes), which is how ↺ on the only change returns a page to "no changes".
- The description of a page goes another way: on blur, `host.setDescription()`
  dispatches `formState/setFieldValue`, `layoutModel/setUpdatePreview` and
  `pageData/updatePageDataExternally`, and Canvas saves it with its own Page
  data.

### Never losing typed text

`App.tsx` mirrors every edit synchronously to `sessionStorage` under
`canvas_metatag:pending:<auto-save key>` (`uid`, the server values it was made
against, and the changes). On open, `openPending()` decides: drop (already
saved), restore (same user, same base values) or offer (anything else; the
dialog asks). When the editor moves to another page, and on `pagehide` while
a write is in flight, the waiting change is flushed once with `keepalive`
(otherwise `pagehide` and `blur` start a normal save). Only that flush uses
`keepalive`, because it caps the body at 64 KiB. After a confirmed write,
`refreshPending()` invalidates Canvas's pending-changes query so "Review
changes" updates at once.

### Conflicts and races

| Situation | Result |
|---|---|
| Canvas layout POST in flight when the dialog wants to write | `whenIdle()` waits for `canvasLayoutRequestInProgress` to empty (or the `canvasLayoutRequestComplete` event) |
| Canvas POST lands between our read and write, same client id | not detectable on the server; the read-back after `quiet(250)` sees the difference and retries, up to 5 times, then reports `failed` |
| Another tab or user (other client id) wrote the draft | `validateAutoSaves` -> 409 `conflict`; the dialog shows the conflict strip and offers to reload the editor |
| The editor itself got a 409 (`queryError.latestError.status`) | the dialog goes read-only (`conflict`) |
| Editor store unreadable (Canvas changed shape) | read-only (`store`); site settings still save |
| Two people saving site settings | last save wins, no detection (by design) |

The remaining lost-update window is a Canvas POST under the same client id
that lands inside our read-to-write on the server. The client narrows it; only
an upstream API could close it (section 11).

## 10. Coexistence with the Metatag module

- `hook_metatags_alter` (ordered last) blanks every Metatag tag for an owned
  entity: every key kept with an empty value, because Metatag's token
  replacement fails on an empty list and empty tags output nothing. One hook
  silences all of Metatag's output paths, including its headless head builder.
  Ownership here is entity-based, not route-based, so Metatag is also silent
  on the revision, latest-version and preview routes of an owned node, where
  this module emits nothing either (documented in the README).
- If `owns()` throws there, Metatag stays the fallback.
- The Metatag widget is hidden in Canvas's Page data form and in the node form
  of an owned node; Canvas's own search preview (`seo_settings.serp_preview`)
  is hidden, because it cannot know the title's ending.
- Without Metatag none of this runs: the hook is never invoked and the form
  alters are `isset()`-guarded.

## 11. Canvas internals this module depends on

Canvas has no public API yet for reading the editor's state, writing into its
drafts, or altering the headless head. Every dependency is listed here. When
Canvas is updated, run the tests in the last column; the Playwright project
`host-contract` runs first precisely so that a Canvas change fails once and
loudly.

### PHP

| Dependency | Where used | If Canvas changes it | Caught by |
|---|---|---|---|
| `Controller\AutoSaveValidateTrait::validateAutoSaves()` (`@internal`), property name `autoSaveManager` | `ApiController::putDraft()` | both draft PUTs fail (500); the dialog reports a network error | `PageDraftTest::testConflictRule`, `testWriteUnderAnotherIdConflictsTheEditor` |
| `AutoSaveManager::getAutoSaveEntity()`, `getAutoSaveEntityForPreview()`, `saveEntity($entity, $clientId)`, `getAllAutoSaveList()`, static `getAutoSaveKey()`; `AutoSaveEntity` props `entity`, `clientId`, `hash`, `isEmpty()` | `ApiController`, `Resolver::layers()`, `HeadlessContentController`, `canvas_metatag.install` | draft writes, draft previews, uninstall cleanup | `PageDraftTest`, `TemplateDraftTest`, `HeadlessHeadTest::testDrafts`, `InstallTest::testUninstallAndReinstall` |
| Auto-save key format `canvas_page:{id}:{langcode}`, `content_template:{id}` | server via `getAutoSaveKey()`; client re-derives it in `host.ts` | the client finds no entry and goes read-only | `host-contract.spec.ts` (first test), `host.test.ts` |
| Layout save starts from the auto-saved entity and converts only form fields (`ApiLayoutController::post()`, `ClientDataToEntityConverter`) | the whole draft transport | an editor save would erase the dialog's value | `PageDraftTest::testWriteThenEditorSave`, `testUnchangedLayoutRoundTripCreatesNoDraft`, `TemplateDraftTest::testWriteThenEditorSaves`, `page.spec.ts` |
| Publish stores the field / third-party setting and enables the template (`ApiAutoSaveController`) | going live | values would not publish | `PageDraftTest::testPublish`, `TemplateDraftTest::testPublish`, `page.spec.ts`, `template.spec.ts` |
| A draft of a never-published translation is kept under its own key and added on publish | `ApiController::translation()`, `Resolver::layers()`, install | that translation's SEO cannot be opened | `PageDraftTest::testDraftOfAnUnpublishedTranslation` |
| Publishing a draft-only translation copies only the fields that differ from the stored default translation (`ApiAutoSaveController::applyAutoSaveTranslationSnapshots()`); its auto-save entry still exists during the save | `CanvasMetatagHooks::pagePresave()` restores a value equal to the default's | a new translation whose value equals the default's is published without it again (once Canvas compares against nothing, the hook finds nothing to do and can go) | `PageDraftTest::testPublishingNewTranslationEqualToDefault` |
| An entity's translation drafts are published and discarded together, from the default translation's entry (`includeSiblingTranslationAutoSaves()`, `getTranslationGroupAutoSaves()`) | `putPage()` keeping a translation's details of the published type | a translation published alone, while the default's type change is a draft, would keep details the dialog cannot show (no loss) | `PageDraftTest::testTranslationKeepsDetailsOfThePublishedType` |
| `onCanvasConfigEntitySave()` drops a template draft when the stored template changes | `canvas_metatag_uninstall()` writes drafts back | uninstall loses or keeps template drafts | `InstallTest::testUninstallAndReinstall` |
| `Entity\ContentTemplate::loadForEntity($entity, 'full')`, `getTargetEntityTypeId()`, `getMode()`, `getTargetBundle()`; config name `canvas.content_template.*.*.*` (schema) | `Resolver::owns()/layers()`, hooks, `ApiController`, config schema | node ownership; failures are caught and logged (head lost, page served) | `ResolverTest::testOwnershipAndLayers`, `CoupledHeadTest::testNodeAndOtherRoutes` |
| `Entity\Page`: base fields `description`, `image`, `created`, `changed`, owner; route `entity.canvas_page.canonical` | `Resolver::facts()`, hooks | facts and the coupled head | `ResolverTest::testFacts`, `CoupledHeadTest::testPage` |
| Stored shape `{expression, sourceType: 'entity-field'}` and the expression grammar | template values and their drafts | a stored link reads nothing (broken, each node its default) | `SourcesTest::testEvaluate` (round trip per field type), the `phpunit (canvas dev)` CI job |
| `PropSource::parse()`, `EntityFieldPropSource::evaluate($host, FALSE)`, `EvaluationResult` | `Sources::evaluate()` | links read nothing | `SourcesTest::testEvaluate` |
| Evaluator behavior: `view` access per hop for the current user, `CacheableAccessDeniedHttpException`; other exceptions | statuses hidden and broken | caught as broken (`\Throwable`) | `SourcesTest::testEvaluate` (statuses) |
| `PropSourceSuggester::suggest()` with a synthetic `ComponentMetadata`; its matches kept in `cache.static` for the request | `Sources::vocabulary()` | no fields to link (logged once, kept five minutes, empty menu); the post_update stops instead | `SourcesTest::testVocabulary`, `testSuggesterFailure` |
| `PropSourceSuggester`'s constructor parameter `entityDisplayRepository`, and properties named as its parameters | `SourcesTest::testSuggesterFailure` only | that test cannot build its failing suggester | the test itself |
| `getAllAutoSaveList(FALSE, TRUE)` and its `conflict_id` key (`AUTO_SAVE_CONFLICT_KEY`); `resolveConflict()`; the key-value store `AUTO_SAVE_STORE` and its entry keys `owner` and `updated` | `canvas_metatag_post_update_values_as_parts()` | after the update, drafts of converted pages report a conflict, or name the update as their editor | `PostUpdateTest::testValuesAsParts` |
| `Labeler::label()`, `Labeler::flatten()` and its separators | row labels and paths | labels change | `SourcesTest::testVocabulary` (paths) |
| The suggester matches a multi-value formatted text field to an array of HTML strings (`htmls`), and a multi-value field to the shape of its items for a single prop; it offers no array of image objects (a media gallery is linked by its first image only, never as a list) and no `office_hours` or `daterange` fields on the farm site (opening hours are typed) | list rows (`many`), recipe steps | lists give their first item only, or steps vanish from the menu | `SourcesTest::testVocabulary`, `testEvaluate` (list mode), `RefTargetsTest::testTemplates` |
| A reference field's items are read directly (`$items->referencedEntities` through each item's `entity`), with `view` access for an anonymous visitor per target | `Sources::targets()` | references read nothing | `SourcesTest::testEvaluate` (ref kind), `RefTargetsTest` |
| JSON schema ref `json-schema-definitions://canvas.module/image` and the standard image object expression | image rows and their file rewrite | image rows vanish | `SourcesTest::testVocabulary` (the rewrite byte for byte), `SourcesTest::testEvaluate` (a media image) |
| Page form `canvas_page_form`: `seo_settings.serp_preview`, `metatags` | `formCanvasPageFormAlter()` | the alter does nothing (guarded) | `MetatagCoexistenceTest` |
| Route option `_canvas_use_template_draft`, set by `CanvasContentController::get()` | `HeadlessContentController` | drafts not shown in headless previews (fails closed to published) | `HeadlessHeadTest::testDrafts` |
| `canvas_headless\Controller\CanvasContentController` (final) reached through `CanvasContentRouteEnhancer`'s `_controller` string and the class resolver | `canvas_metatag.services.yml` decorator | headless heads silently lose our tags (and Metatag's); the status report shows an error | `HeadlessHeadTest` (incl. the runtime requirement), `InstallTest::testContainerBuildsWithoutHeadless` |
| `CanvasContentRoute::resolve()` (`entity`, `isPreview`, `viewMode`), `PreviewTokenInspector::hasPreviewScope()`, `CanvasContentApiRequest` query constants | decorator | caught; Canvas's head is kept | `HeadlessHeadTest` |
| Response JSON `head`, `route.entity.{entityType,id,langcode}` | decorator | caught; Canvas's head is kept | `HeadlessHeadTest::testPublishedPage`, `headless.spec.ts` |
| `FrontendUrl::fromConfig()`, `canvas_headless.settings:frontends.0.url` | `Resolver::origin()` | public base falls back to the request host | `ResolverTest::testFrontendBase` |
| `hook_canvas_extension_info_alter`, extension `type: canvas`, `api_version: 1.0` | `canvasExtensionInfoAlter()`, `canvas_metatag.canvas_extension.yml` | the dialog does not open, or a stale build is served | every Playwright spec |

### JavaScript (all in `extension/src/host.ts`)

`check-patterns.mjs` (part of `npm run verify`) refuses `.parent` in any other
source file. Every read is in try/catch and degrades to read-only, never to a
guessed write.

| Dependency | If Canvas changes it | Caught by |
|---|---|---|
| `parent.drupalSettings.canvas.store` (Redux store Canvas exposes for extensions) | read-only; site settings still work | `host-contract.spec.ts` "exposes every path", `access.spec.ts` "editor cannot be read" |
| State paths `ui.currentRoute.pathname`, `pageDataOwner`, `pageData.present['title[0][value]', 'description[0][value]', 'path[0][alias]']`, `publishReview.clientInstanceId`, `publishReview.autoSavesHash`, `queryError.latestError.status` | wrong context, no token (read-only), no conflict signal | `host-contract.spec.ts` "exposes every path" |
| Layout URL keys of `autoSavesHash` (mirror `replaceEntityParamsInUrl`) | no token: read-only | same |
| Action types `formState/setFieldValue` (form `page_data_form`), `layoutModel/setUpdatePreview`, `pageData/updatePageDataExternally`, `pendingChangesApi/invalidateTags` | description not handed over; review list refreshes on Canvas's own poll | `host-contract.spec.ts` "store actions", `page.spec.ts` description test |
| `drupalSettings.canvas.canvasLayoutRequestInProgress`, `canvasLayoutRequestComplete` event | the write may race an editor save (read-back still retries) | `host-contract.spec.ts` "signal idle", `page.spec.ts` rapid edits |
| Preview iframe `iframe[data-canvas-preview="true"][data-canvas-swap-active="true"]`, same-origin document, `<main>` | Checks and AI lose page facts | `host-contract.spec.ts` "exposes every path" |
| `canvas:data:subscribe:previewHtml` bridge message (supported API) | facts not refreshed | `host-contract.spec.ts` |
| Editor routes `/editor/canvas_page/{id}`, `/template/{type}/{bundle}/{mode}/{id}`, and `/template/node/{bundle}/full` for a type without content (mirror `extractEntityParams`) | wrong or no context | `host.test.ts`, `host-contract.spec.ts` |
| Dialog frame behavior (named, sized, survives editor navigation until a side-menu click) | layout or lifecycle | `host-contract.spec.ts` "dialog frame" |
| The frame's nearest scrolling ancestor inside `[role="dialog"]` is the dialog's scroll container; Canvas sizes it and the frame to `calc(100vh - 300px)`; the panel has a `max-height` and a bottom padding (`host.fitFrame()`) | the frame keeps Canvas's height (no worse than before) | `host-contract.spec.ts` "dialog frame", `host.test.ts` |
| The dialog panel opens a fifth of the window from the top by a `translate()`, leaving `top` free (`host.fitFrame()` moves a dialog opened in a taller window up with `top`) | the dialog stays where it opened; the frame keeps the room below it | `host-contract.spec.ts` "dialog frame" (panel top at 420 px) |
| Closing the dialog removes the iframe without unmounting the extension's React tree (`host.fitFrame()` undoes itself on the frame's `pagehide`) | none: React's cleanup also undoes it | `host.test.ts` "is undone when the frame goes away" |

### UPSTREAM(canvas) asks

1. A head alter hook in the canvas_headless head builder, with the rendered
   entity and the response cacheability. It replaces `HeadlessContentController`
   (which decodes and re-encodes every owned response) with a few lines, and
   removes the controller-resolution dependency. Marked in the decorator.
2. A public extension API for: the current entity and langcode, the editor's
   client id and auto-save entry, an "editor idle" signal, and setting a Page
   data field. It replaces the private store reads and action dispatches.
3. A server-side way for a module to write a field into an entity's auto-save
   entry atomically with Canvas's own layout save (or a per-field merge). It
   closes the same-client lost-update window and replaces the read-back loop.
4. `AutoSaveValidateTrait` as a public service, so the conflict rule is not
   `@internal` (Canvas's own `@todo` already points that way).
5. `@drupal-canvas/headless-next` should map `article:*` and `og:image:*`, and
   render `head.script` (README).
6. A viewport-aware height and position for the extension dialog: Canvas
   leaves the frame 300 px less than the window and keeps the dialog where it
   opened, so a dialog opened at 900 px tall and then made 350 px tall has a
   92 px frame (48 px of view). It replaces `host.fitFrame()`, which moves the
   dialog up and gives it a 202 px frame there.
7. Publishing a translation that exists only as a draft should compare its
   fields against nothing, not against the default translation. It replaces
   `CanvasMetatagHooks::pagePresave()`.

## 12. Headless delivery

`HeadlessContentController` decorates the canvas_headless content controller
service (`decorates:` with `decoration_on_invalid: ignore`, so without
canvas_headless the service simply does not exist). The decorated class is
final, so the decorator is a sibling with the same `get()` method.

Why a decorator: canvas_headless builds `head` in its own head builder, has no
alter hook, and drops canonical links. A decorator is the only place that sees
the finished response with the rendered entity and its cacheability, without
patching Canvas.

```
 get($request, $route_match)
   response = inner->get()                      (Canvas renders, as always)
   try
     fail closed unless: 200, CanvasContentRoute resolves, not isPreview,
       body has head + route.entity, entity not new, type and id match
     view mode (preview may ask for another) must be "full"
     draft = preview scope on the token AND route option
             _canvas_use_template_draft === TRUE
     draft: entity = getAutoSaveEntityForPreview(), + its cacheability
     entity = the translation route.entity.langcode names
     owns(entity, draft)? else return response untouched
     body.head = resolve(entity, draft).head    (replaced wholesale)
     response += resolver cacheability
   catch Throwable: log, return Canvas's response untouched
```

The inner controller has already checked view access (on the draft entity for
a preview) and added the `oauth2_scopes` and API query cache contexts. The
token check is repeated so that a published response can never read a draft.

Public base (`Resolver::origin()`), used for canonical, `og:url`, hreflang,
`{url}` and every `@id`:

1. `$settings['canvas_metatag_public_base']` (absolute http(s), no query or
   fragment), source `settings`;
2. else the first canvas_headless frontend URL, source `frontend`;
3. else the request's scheme, host and base path, source `request`.

Image URLs always stay on Drupal, where the files are.
`hook_runtime_requirements` reports an error when canvas_headless is enabled
but the class resolver no longer returns this decorator.

## 13. Cacheability

Everything `resolve()` reads is added to the `CacheableMetadata` it returns;
both adapters merge it into the response. No `user` or `user.permissions`
context is ever added, because every access check runs for the anonymous
account; both page caches stay effective.

| Depends on | Cache metadata | Added in |
|---|---|---|
| the entity (and the stored default translation of a draft-only translation) | its tags | `resolve()`, `layers()` |
| the content language | context `languages:language_content` | `resolve()` |
| site settings, with overrides | `config:canvas_metatag.site` | `site()` |
| site name, front page, timezone | `config:system.site`, `config:system.date` | `facts()`, `url()` |
| node field definitions, media type sources, the order of the form | `entity_field_info`, `config:media_type_list`, the bundle's default form display (its list tag while it does not exist: creating it invalidates only that) | `facts()`, `formFields()`, `Sources::vocabulary()` |
| a link's value | the tags and max-age of what Canvas read, `config:user.role.anonymous` (all of it, with contexts, for a node anonymous may not view) | `Sources::evaluate()` |
| the template | its tags; without one the `content_template` list tag | `layers()`; coupled node pages that are not owned also get the list tag (`pageAttachments()`) |
| a draft (previews only) | the auto-save entry (`canvas__auto_save`) | `layers()`, decorator |
| media, files, referenced labels | their tags | `mediaImage()`, `usable()`, `label()` |
| image URLs (built on the request host) | context `url.site` | `usable()` |
| anonymous access results | their tags and max-age, `config:user.role.anonymous` | `allowed()` |
| public base | `config:canvas_headless.settings` unless the setting is used; `url.site` when it is the request | `origin()` |

The `settings.php` public base carries no tag: changing it needs a cache
rebuild (README). Install invalidates `rendered`, because core's canonical and
shortlink are removed in an alter that does not run on a render cache hit.
Canvas keys node render caches with and without Canvas and tags them with the
template, so that alter is safe. All API routes are `no_cache`.
`Resolver` keeps results per entity object, per request and per draft flag
in a `WeakMap` (a stored page and its draft share id and revision, so a string
key would mix them).

## 14. Translations

- The page field is translatable; settings are per translation.
  `hook_canvas_page_translation_create` empties it on a new translation, and
  `hook_canvas_page_duplicate` drops the canonical in every translation.
- A non-default translation inherits `robots`, `social.image` and
  `schema.type` from the default one (`from_default`), never its texts or
  canonical. The details of the inherited type are the translation's own.
- The dialog edits the translation the editor edits: the langcode comes from
  the editor's auto-save key. `ApiController::translation()` accepts a
  translation that exists only as a Canvas draft (state `published: false`),
  for users with update access.
- A translation that exists only as a draft is published with its own value,
  also when it equals the default translation's (`pagePresave()`, section 11).
- Hreflang lists published translations only, with `x-default`.
- Site and template values and the identity name are config, the same in
  every language (non-goal).

## 15. Security model

Routes (all `no_cache`, all `_auth: ['cookie']`, so a bearer token cannot
skip the CSRF check):

| Route | Requirements |
|---|---|
| `GET state` | `edit canvas metatag` or `administer canvas metatag`; view access on the page / template / preview node, checked in the controller; draft data only with update access |
| `PUT draft/canvas_page` | `edit canvas metatag`, `canvas_page.update`, CSRF header; update access on the named translation again |
| `PUT draft/content_template` | `edit canvas metatag`, `content_template.update`, CSRF header; must be a node `full` template, loaded override-free |
| `PUT site` | `administer canvas metatag` (restricted), CSRF header |
| `GET media` | either permission; published image media, per-item view access, public files only |
| `POST ai/suggest` (submodule) | `use canvas metatag ai` and `edit canvas metatag`, CSRF header, flood 30 per 5 minutes per user |

The submodule's prompts are edited in the AI module's Prompt Library, under
its restricted `manage ai prompts` permission. What a prompt says cannot
weaken the fence or the answer shape (section 16), and the status report entry
links to the AI module's own admin pages, which keep their own access. The
three default prompts cannot be deleted: `AiHooks` forbids `delete` on them,
and the submodule's route subscriber adds `_entity_access: ai_prompt.delete`
to the Prompt Library's delete form, which otherwise checks only the
permission.

- Input: `Values::clean()` in write mode is the gate; bodies over 128 KiB are
  refused. Output: everything is cleaned again in read mode, every fact and
  link of a published node is read as anonymous, attributes are escaped by the
  render system, JSON-LD is hex-escaped.
- The stored field is the dialog's working data: `hook_entity_field_access`
  denies `view` of `canvas_metatag` without one of the two permissions (for
  JSON:API and similar). Edit access stays open, because Canvas refuses to
  publish a changed field the publisher cannot edit, and anything stored is
  cleaned before output.
- The canonical may point at any site: the edit permission's description says
  so.
- Frontend: no `innerHTML`, no `dangerouslySetInnerHTML`, no `window.open`,
  no submit handlers (enforced by `check-patterns.mjs`); bridge messages are
  accepted only from the parent window; `index.html` loads nothing from
  another origin.

## 16. The AI submodule

`modules/canvas_metatag_ai` adds suggestions; it stores nothing of its own
besides the three prompts it installs.

- `AiHooks` implements `hook_canvas_metatag_capabilities_alter`: users with
  `use canvas metatag ai` get `capabilities.ai = {available, reason}` in the
  state (`no_provider`, `not_usable`, `no_prompt`, in that order); others get
  NULL and learn nothing about the provider. It also implements
  `hook_runtime_requirements`: one entry, "SEO suggestions (Canvas Metatag
  AI)", OK with the provider and model and a link to the AI settings, or a
  warning with the reason and a link to the AI settings (also for a default
  whose provider module is gone), the providers page, the Prompt Library (a
  prompt by its own label, else its shipped one, and the machine name
  "default" for one that is gone) or, when a prompt type is gone, the
  uninstall page. Neither calls the provider's service. The prompt types are
  `canvas_metatag_<kind>` for each of `Assistant::KINDS`. On every prompt of
  its three types, `hook_ai_prompt_presave` adds an enforced dependency on the
  submodule (a prompt saved in the Prompt Library depends on nothing, and
  would outlive an uninstall and block a reinstall);
  `hook_ai_prompt_access` keeps the default prompts from being deleted.
- `AiController::suggest()` checks and caps the request (fields, count 1 to 5,
  hint 200, current values 2000, page text 12000 characters, langcode must be
  a site language, no mix of search and social fields), applies flood control,
  and maps exceptions to stable error codes. Each failure after the request
  check and the flood limit is logged once on `canvas_metatag_ai` with the
  code, task, prompt kind and exception class, also when it happens before
  the provider call, which the AI module does not log; refused requests are
  not logged. The provider's message is not logged: the AI module logs it on
  its own channel, and it may quote the prompt. Prompts, page text and
  answers are never logged by this module. The `blocked` message names no
  next step: the dialog's `aiError()` adds the one that fits (other Refine
  text, or a site administrator) and offers Try again only where asking again
  can help.
- `Assistant` uses the default provider for structured chat, else chat, with
  the AI module's site-wide request timeout. Prompts: three prompt types and
  their `<type>__default` prompts in `config/install` (`canvas_metatag_search`,
  `canvas_metatag_social`, `canvas_metatag_schema`, enforced dependency on the
  submodule). `Assistant::system()` reads `ai.ai_prompt.<type>__default` from
  configuration without overrides (an entity load fails once its type is
  gone; a translation would make the instructions depend on who asks), fills
  `{language}`, `{count}`, `{types}`, `{properties}`, also spelled
  `{{ name }}` as the Prompt Library's editor inserts them, with one `strtr()`
  pass from server values only, does not replace tokens, and appends `FENCE`,
  for a title request `ENDING` (the ending is added after the title and counts
  toward its length), and `SHAPE`, which a site builder cannot edit. The user
  message says the title ending ("Title ending: none, the title has no
  ending" for none). A request whose prompt is
  missing or blank is `not_configured`; the dialog offers no suggestion while
  any of the three is.
  Text requests use the social prompt when every field is a social one
  (`Assistant::isSocial()`, shared with the mixed-field check), else the
  search prompt; calls are tagged `canvas_metatag_ai` and
  `canvas_metatag_ai_<kind>`.
- The system prompt holds nothing from the request. The page text goes into
  the user message between `<page_content>` tags; `inline()` folds
  compatibility forms and strips any delimiter tag, repeatedly.
- Guardrails: the AI module attaches the site's global guardrail sets to every
  call. After `chat()` and before anything is decoded, `Assistant::stopped()`
  sums the scores of every `StopResult`, before and after generation, and
  compares the sum with the lowest stop threshold of the attached sets, as the
  AI module's automators do. Reaching it is `blocked`; a stop's message, which
  replaces the answer, is never decoded or shown. A stop below it lets the
  answer through.
- Answer reading, each kept because the alternative was shown to fail: the
  hostname filter is bypassed with `HostnameFilterDto(fullTrust: TRUE)` (the
  default re-serializes the answer as HTML: `&amp;`, added closing tags); a
  plain `json_decode()` runs before the AI module's `PromptJsonDecoder`, which
  only tries text that starts like `{"` or holds a code fence; the structured
  output schema is passed as an array (the `StructuredOutputSchema` object
  makes the AI module 1.5 call its own deprecated method); capability flags
  are not trusted. Answers are checked against the requested shape (braces are
  kept: a used suggestion is typed text, never scanned), values reduced to
  plain text, text suggestions
  with a URL dropped, and schema properties checked with
  `SchemaGraph::validLiteral()`. A schema value is marked unverified unless
  the page text contains it (dates never verify).
- The dialog shows suggestions for review only; an applied suggestion is saved
  like typed text and validated again on save.

### AI module APIs relied on

No Canvas internal comes from the submodule. These AI module (1.5) APIs do;
each row names the test that fails when it changes.

| API | Used for | Pinned by |
|---|---|---|
| `AiProviderPluginManager::getDefaultProviderForOperationType()`, operation ids `chat_with_structured_response`, `chat` | provider resolution | `AssistantTest::testProviderResolutionOrder` |
| Config `ai.ai_prompt.<type>__default`, key `prompt`; entity types `ai_prompt_type`, `ai_prompt` | prompts | `ShippedConfigTest`, `AssistantTest::testPrompts`, `PromptsTest` |
| Route `entity.ai_prompt.delete_form` (parameter `ai_prompt`) | delete guard | `PromptsTest::testDefaultPromptsCannotBeDeleted` |
| `InputInterface::getAllGuardrailResults()`, `getGuardrailSets()`, `AiGuardrailSetInterface::getStopThreshold()`, `StopResult::getScore()`; `ai.settings:global_guardrails` | blocked | `AssistantTest::testGuardrailStopIsBlocked` |
| `ChatInput::setChatStructuredJsonSchema(array)` | structured output | `AssistantTest::testNoDeprecations` |
| `HostnameFilterDto(fullTrust:)`, `ai.prompt_json_decode` | answer reading | `AssistantTest::testSuggestText`, `testJsonDecoderFallback`, `testBareJsonWithSpaces` |
| `ai.settings:request_timeout` | timeout | `AssistantTest::testSiteTimeoutApplies` |
| Exception classes `AiSetupFailureException`, `AiAccessDeniedException`, `AiMissingFeatureException`, `AiOperationTypeMissingException`, `AiBrokenOutputException`, `AiUnsafePromptException`, `AiRateLimitException`, `AiQuotaException` | error codes | `AiControllerTest::testErrorCodes` |
| Routes `ai.settings_form`, `ai.admin_providers`, `entity.ai_prompt.collection`, `system.modules_uninstall` | status report links | `RequirementsTest` |

## 17. Testing

| Suite | Proves | Run |
|---|---|---|
| `tests/src/Unit/ValuesTest`, `SchemaGraphTest` | validation (refused and accepted cases), encoding, cascade, text outputs, separators; registry, kinds, ids, withheld nodes, commerce (billing, the seller, the site currency), left-out items, custom JSON-LD, encoder safety; the shared fixtures `tests/fixtures/text-cases.json` and `graphs/*.json` | PHPUnit |
| `SchemaGraphReportTest`, `SearchFeaturesTest`, `SearchFeaturesFileTest`, `RegistryConsistencyTest`, `DeliveryPathTest` | the report (unknown type, dropped values, nodes and origins), the rules of hand-added items; one passing and one failing graph per search feature; the rules file's sources and dates; that the registry and the rules agree; that only the dialog's state reaches the verdicts | PHPUnit (unit) |
| `ResolverTest` | ownership, layers, facts and access, the form's order, linked values (empty, hidden, deleted field, formatted text), the head, cacheability and drafts, the public base | PHPUnit (kernel) |
| `SourcesTest` (group `canvas_metatag_canvas_contract`) | the Canvas contract of `src/Sources.php`: vocabulary, exclusions, labels, the image rewrite, a round trip and value per field type, every status and the account rule, `accepts()` | PHPUnit (kernel); also against Canvas 1.x-dev in CI |
| `BoundaryTest` | only `src/Sources.php` uses Canvas's prop source code | PHPUnit (unit) |
| `LegacyTest`, `PostUpdateTest` | the conversion of token strings, each loss logged; the post_update on site, templates, drafts, page revisions and page drafts; the site kept as the organizer of event templates; venue countries stored as codes | PHPUnit (unit, kernel) |
| `PageDraftTest`, `TemplateDraftTest` | the draft transport against real Canvas: editor saves carry our value, the conflict rule, publish, translations (incl. draft-only, the details of a published type, a new translation equal to the default), refusals, duplicate | PHPUnit (kernel) |
| `CoupledHeadTest` | the HTML head an anonymous visitor gets, with both page caches; non-owned routes untouched; a failing build serves core's head | PHPUnit (kernel) |
| `HeadlessHeadTest` | the content API head, preview drafts, routes left alone, the runtime requirement | PHPUnit (kernel) |
| `MetatagCoexistenceTest` | Metatag silent where the head is ours, widgets hidden | PHPUnit (kernel) |
| `ApiTest` | route requirements, state (facts, separator, sources, broken links, the report's verdicts and rules; incl. a template without a node to preview), site (stored links ignored, the currency, what a save changes elsewhere), the registry in the dialog's language, media, writes follow shown values, refused links | PHPUnit (kernel) |
| `RegistryTest`, `CoverageContractTest`, `PopulateEveryTypeTest`, `NormaliseTest` | every registry attribute has its reader, shapes and groups are consistent; every property offered on a scope has a way in that is not custom JSON-LD, every required fact is offered with its type, a fixture per offered type and scope; each fixture in `tests/fixtures/graphs/<type>[.<case>].<scope>.json` builds its graph, report and verdicts with no custom JSON-LD and only accepted values; one formatted text's list items | PHPUnit (unit) |
| `RefTargetsTest` | every type end to end on the complex fixture: venues described as places, events pointing at them and at profiles, hidden references never named, jobs (filtered description, workplace address, pay from a decimal, a closed job), recipes (ingredients and steps from multi-value fields), Canvas pages typing values and picking a venue page, a course list | PHPUnit (kernel) |
| `ComplexContentTest`, `ComplexTemplateTest` | the complex content fixture (`tests/src/Fixture/ComplexContent.php`) and template scope on it: field discovery in form order, values per node (headings, list items and table rows as sentences), heads and structured data (a square logo's small card), hidden references published and deleted (coupled and headless), drafts, headless | PHPUnit (kernel) |
| `InstallTest` | install, uninstall (drafts written back), reinstall, container without canvas_headless | PHPUnit (kernel) |
| `AiControllerTest`, `AssistantTest`, `RequirementsTest`, `PromptsTest` | access, caps, mixed fields, flood, error codes, the failure record, nothing written; provider resolution, prompts from the Prompt Library with the fixed tail, routing and tags, missing prompts, guardrail stops, answer reading, timeout, output cleaning; the status report entry; install, uninstall and reinstall with prompts added in the Prompt Library, default prompts that cannot be deleted | PHPUnit (kernel, submodule) |
| `ShippedConfigTest` (submodule) | the shipped prompt types, prompts and permission text | PHPUnit (unit) |
| `ExtendMergeTest`, `ModuleIdsTest`, `CustomFillTest`, `VocabularyTest`, `VocabularyRouteTest` | added details merged per leaf with clashes and selectors, the hand-added main thing; the module id list and short ids; whole-value fills and what an empty one leaves out; the trimmed schema.org vocabulary, its command, route and status line; `ValuesTest::testSharedFixtures` and `SearchFeaturesTest::testSharedFixtures` run `tests/fixtures/custom/` and `tests/fixtures/features/` | PHPUnit (unit, kernel) |
| `extension/src/custom/*.test.ts`, `features.test.ts` (vitest) | the same red set as the server, one text edited by Form without moving other bytes (a property test), paste clean-up, problems with their line, path and fix, the same verdicts as the server; the sheet's pure parts: Back's names and tab memory, type search and its steering, rows (numbers while typed, zone offsets, positions), the reference menu and moving an item to its own, the item list, the caret line, the vocabulary | `npm run verify` |
| `tests/e2e/custom-form.spec.ts` | an employer rating built with the keyboard only, Form ⇄ JSON with no byte change, the sheet's levels and Back to Output, Undo of a removal, a paste in Form; axe at 600 and 350 px tall and in a narrow frame | Playwright (`coupled`) |
| `scripts/vocabulary-lint.php` (CI `vocabulary-lint`) | every type and name in the registry, the rules file (its `expects` too) and the graph fixtures is schema.org's, on the pinned release | CI |
| `extension/src/*.test.ts` (vitest) | model rules mirror PHP (same fixtures), the write loop, pending storage, checks (verdict rows, parity with the page, hand-added items, what a node left out), the read-back, kinds, API client, host adapter parsing; `coverage.test.ts` (every offered detail has a control), `controls.test.ts` (controls by shape, durations, the hours grammar, pickers, group lines) | `npm run verify` |
| Playwright `host-contract` | every Canvas internal of section 11 in the real editor | runs first |
| Playwright `coupled` (`page`, `template`, `site`, `access`, `schema`) |
 the dialog in the real editor end to end: inheritance, draft saves surviving editor saves, closing mid-edit, publish to head, Output catching up, templates linked to fields, title endings, site settings, read-only and conflict states, keyboard, axe scan, 200 % zoom, windows 350 and 420 px tall | |
| Playwright `headless`, `ai` | content API heads and preview tokens; suggestions with a test provider, an edited prompt, and a site guardrail that blocks | |
| Playwright `complex` | template scope on the complex fixture: type fields and their values, levels and hidden references, link menus in windows 350 and 420 px tall, by keyboard and to assistive technology, previews that follow the editor (at the view's top, without a message or a status change), Checks against a long title, an unpublished preview node and its information button (click, hover then click, click elsewhere), a square small card for a square logo, a header whose Checks text gives way to a long type name, a type without content, text direction | |

Commands are in the README ("Development"). Kernel tests use Canvas's
`phpunit.xml.dist`. The Playwright suite installs a seeded sandbox per spec
file with `tests/src/TestSite/CanvasMetatagTestSetup.php`; its environment
variables are listed at the top of `tests/e2e/fixture.ts`. CI
(`.gitlab-ci.yml`) runs the drupal.org template jobs (PHPUnit, PHPCS, PHPStan,
cspell) plus `frontend` (`npm ci && npm run verify`), `build-assets` (fails
when the committed `extension/dist` differs from a fresh build) and
`playwright` (all projects, one worker), and `phpunit (canvas dev)` (the
`canvas_metatag_canvas_contract` group against `drupal/canvas:1.x-dev`).

## 18. Known limitations and non-goals

Non-goals are listed in the README ("What it does not do"). Known
limitations of the implementation:

- Same-client lost-update window (section 9): narrowed by the client, not
  closed. Site settings are last save wins.
- The headless head depends on controller resolution, and the decorator
  decodes and re-encodes each uncached owned response.
- Metatag is silent on revision, latest-version and preview routes of owned
  nodes, where this module emits nothing.
- The Image fact by media UUID uses the media's default translation, so a
  translated alt text is not used (`ponytail:` in `Resolver::image()`).
- With language domains and a headless frontend, URLs stay on the Drupal
  domain; nothing maps a language to a frontend host.
- Only files in the `public` scheme are emitted; a remote wrapper serving
  public files is treated as missing.
- Custom JSON-LD is decoded as arrays on output, so an empty object or an
  object with only numeric keys is emitted as a list.
- A content type's Full template with no content to preview is read-only in
  the dialog: without a preview node Canvas keeps no draft entry to write
  under (section 9). It needs a Canvas write path for templates without a
  preview entity.
- `host.fitFrame()` follows the editor's window, not a drag of the dialog: a
  dialog dragged down keeps the height it had, and a resize keeps the drag
  (the panel's place is measured once, at open). In a window 350 px tall the
  view below the dialog's header is 158 px: the dialog stays below the
  editor's top bar.
- `templateContext()` reads the template's values itself (override-free)
  while `Resolver::layers()` reads them with overrides, so under a config
  override of a template's setting the dialog's values and its preview can
  differ.
- One confirmed save makes a full `GET /state` (the whole resolver, the AI
  status, and `getAutoSaveEntityForPreview()` reads the site's auto-save list).
  Fine at today's sizes.
- The settings-file public base needs a cache rebuild when changed.
- Dialog: one offer of an unsaved change at a time.
- Links: a text list gives its stored key, not its label; a reference is read
  only when visitors may view it (else each node uses its default); an
  unpublished preview node is read with the editor's access; a multi-value
  media field (a gallery) is not offered as an image, the Image fact covers
  it; a multi-value formatted text field is not offered; a multi-value field
  gives its first item.
- Not exercised in a browser: a multilingual site, screen readers, Firefox and
  Safari.

## 19. Where to change what

```
canvas_metatag.routing.yml        the five API routes and their access
canvas_metatag.services.yml       Resolver; the headless decorator
canvas_metatag.install            install (cache), uninstall (drafts)
config/schema/*.yml               stored shape of site and template values
data/schema-types.json            structured data types and properties
src/Values.php                    validation, cascade, text outputs
                                  (change model.ts and the fixtures too)
src/SchemaGraph.php               registry, literal checks, @graph, @ids
src/Sources.php                   EVERY Canvas prop source dependency (PHP)
src/Resolver.php                  ownership, layers, facts, links, images,
                                  public base, URLs, the head, cacheability
src/Controller/ApiController.php  state, draft writes, site, media
src/Controller/
  HeadlessContentController.php   the canvas_headless adapter
src/Hook/CanvasMetatagHooks.php   coupled head, field, Metatag, forms,
                                  field access, status report, extension
extension/src/host.ts             EVERY Canvas editor dependency (JS)
extension/src/api.ts              HTTP client, CSRF, error codes
extension/src/model.ts            state, reducer, write loop, pending
                                  storage, PHP mirror, previews, footer
extension/src/checks.ts           the Checks tab's rules
extension/src/App.tsx             lifecycle: load, follow the editor,
                                  save timer, flush, session storage
extension/src/components/         one file per tab and shared fields
modules/canvas_metatag_ai/        suggestions; prompts in config/install
                                  (Prompt Library), fixed tail in
                                  Assistant.php
tests/fixtures/                   cases shared by PHP and TypeScript
tests/e2e/host-contract.spec.ts   update first when Canvas changes
```

- New fact: `Values::FACTS`, `Resolver::facts()`, the config schema's
  choice; the dialog picks it up from the state.
- New structured data type or property: `data/schema-types.json` and a
  fixture in `tests/fixtures/graphs/`. The AI prompt follows the registry
  (text and date properties, unless a property says `"ai": false`).
- New stored key: `Values::KEYS` and its cleaner, the config schema,
  `model.ts`, `text-cases.json`.
- A Canvas upgrade: run `host-contract` and `SourcesTest`, then `PageDraftTest`,
  `TemplateDraftTest`, `HeadlessHeadTest`, `InstallTest`; walk the table in
  section 11.
