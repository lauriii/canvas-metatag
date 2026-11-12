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
| `title` (pattern) | yes | yes | yes |
| `description` | no: Canvas's own Page data field | yes | no |
| `canonical` | yes | no | no |
| `social{title,description,image}` | yes | yes | no |
| `robots{...}` | yes | yes | yes |
| `schema{type,props,custom}` | yes | yes | no |

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
    "props": { "offers_price": "25", "offers_priceCurrency": "EUR" },
    "type": "Product"
  },
  "social": { "image": "<media uuid> or {image}" },
  "title": "{title} {sep} {site}"
}
```

- Texts are templates with tokens (section 5). Lengths: title 255,
  description 1000, social title 255, social description 1000, a schema
  property 2000.
- `canonical` is a path on the public base (one leading slash, RFC 3986
  characters plus non-ASCII letters) or an absolute http(s) URL with a host
  and no credentials; never a fragment.
- `robots`: booleans `noindex`, `nofollow`, `nosnippet`; integer `max_snippet`
  (-1 to 1000); `max_image_preview` one of none, standard, large.
- `schema.type` is a key of `data/schema-types.json`; `schema.props` are that
  type's property keys; `schema.custom` is custom JSON-LD text, re-encoded on
  write (section 7).
- Images are a media UUID or exactly one image token.

`Values::clean($input, $scope, $tokens, $inheritedType)` is the one validator.

- Write mode (`$tokens` given) reports every problem as
  `dotted.path => sentence`; the API answers 422 with that map.
- Read mode (`$tokens` NULL) drops what is invalid silently and keeps unknown
  tokens, which output later blanks. Everything stored is cleaned again in read
  mode when it is read, so a value that bypassed the API (config import,
  JSON:API, custom code) still comes out safe.
- Control, C1 and bidi override characters are stripped; typed text is never
  trimmed or rewritten otherwise.

The registry `data/schema-types.json` describes ten types (`WebPage`,
`AboutPage`, `ContactPage`, `CollectionPage`, `Article`, `BlogPosting`,
`NewsArticle`, `Event`, `Product`, `ProfilePage`). An entry has a label, a
`page_type`, optionally a `primary_type`, `og_type`, `refs` to our own nodes,
`nested` types, and `props` with `key`, `kind` (text, url, date, number, enum,
image), `default`, `level` (required or recommended), `options` and
`pattern`. One level of `extends`. `SchemaGraph::validLiteral()` is the only
check of a literal against its property; the cleaner, the graph builder and the
AI submodule all call it.

## 5. Dynamic values (tokens)

Grammar: `{name}` or `{field.NAME}` (`Values::TOKEN`); brace text that does not
match is literal. `Values::fill()` substitutes in one pass and never scans a
substituted value again, so a field value cannot inject a token.

| Token | Value | Type |
|---|---|---|
| `{title}` | the entity label | text |
| `{description}` | page: Canvas's description field; node: first `text_with_summary` field's summary, else its text cut at 160 | text |
| `{site}` | identity name, else `system.site:name` | text |
| `{sep}` | identity separator | text |
| `{url}` | the entity's own public URL | url |
| `{author}` | owner's label (`view label` access) | text |
| `{published}`, `{modified}` | `created`, `changed` as ISO 8601 in the site timezone | datetime |
| `{image}` | page: its `image` media; node: first image field that resolves | image |
| `{field.NAME}` | node templates: each configurable field of a supported type, delta 0 | by field type |

The vocabulary of a bundle is `Resolver::tokenTypes()`; write mode refuses an
unknown token, and an image token in text. Every token value is what an
anonymous visitor may see: field, media, file and label access run for the
anonymous account (`Resolver::allowed()`), images must be public files.
Formatted text is reduced to plain text in `Resolver::text()`.

The dialog shows tokens as labelled chips (`{Page title}`); `model.ts`
converts labels to stored names on commit (`toStored()`), also inside custom
JSON-LD strings.

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

`Values::cascade()` then takes `title` from the target, else the site, merges
`robots` per directive (target wins), and takes everything else from the
target only. There is no site-wide description or social text by design.

### Text outputs (`Values::texts()`)

```
title              = fill(title pattern), separators with nothing to
                     separate removed  -> else {title} -> else {site}
description        = fill(description)          -> else {description}
social_title       = fill(social.title)         -> else {title}
social_description = fill(social.description)   -> else description
```

Each is passed through `Values::plain()`: controls removed, whitespace
collapsed, trimmed, cut to its limit in code points. The output is plain text;
the consumer escapes it.

### Other outputs

- Canonical: the override (a path is put on the public base), else the
  entity's own URL (`Resolver::url()`).
- Robots: fixed directive names in a fixed order; free text never reaches it.
  `max-snippet` is left out under `nosnippet`.
- Image chain: `social.image` (UUID or token), then `{image}`, then the site
  default image. Each must resolve for the anonymous visitor, else the next is
  tried. The result carries `source`: override, entity or site.
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
it ships. When a required property is missing the primary node is withheld and
the report says which (`schema.withheld`, `missing_required`,
`missing_recommended`); the Checks tab reads that report.

Property keys with underscores are paths (`location_address_streetAddress` is
`location > address > streetAddress`), typed by `nested`. Enums become
`https://schema.org/<Value>`; a date-time without an offset gets the site
timezone's offset; ImageObjects leave out unmeasured (0) dimensions.

Custom JSON-LD (`schema.custom`) is validated on write: at most 32 KB, 1 to 10
nodes each with `@type`, depth at most 8, only `@type` and `@id` may start with
`@`, an `@id` is http(s) or `#name`, and no string may start with a
`javascript:`, `vbscript:`, `data:` or `file:` scheme. It is stored re-encoded
with sorted keys, never as typed. On output, `#name` ids are put on `{url}`,
tokens in strings are filled (unknown brace text kept), a top-level node whose
`@id` is one of ours is dropped, and a nested reference to one of ours becomes
a bare `{"@id": ...}`, or is removed when that node is not in the graph.
Custom nodes can point at ours; they can never replace or extend them.

## 8. The emitted head

| Row | Coupled HTML | Headless `head` |
|---|---|---|
| title | `head_title` in `preprocess_html` | `head.title` |
| `description`, `robots`, `twitter:card` | `<meta name>` via `html_head` | `head.meta[]` |
| `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (+ `:width`, `:height`, `:alt`), `article:published_time`, `article:modified_time` | `<meta property>` | `head.meta[]` |
| canonical, hreflang alternates | `<link>` via `html_head` (not `html_head_link`, so no Link headers) | `head.link[]` |
| JSON-LD | one `<script type="application/ld+json">` | `head.script[0]` with `textContent` as an object |

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

No token, no write: without both, the target scope is read-only.

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
  is hidden, because it cannot know the title pattern.
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
| `onCanvasConfigEntitySave()` drops a template draft when the stored template changes | `canvas_metatag_uninstall()` writes drafts back | uninstall loses or keeps template drafts | `InstallTest::testUninstallAndReinstall` |
| `Entity\ContentTemplate::loadForEntity($entity, 'full')`, `getTargetEntityTypeId()`, `getMode()`, `getTargetBundle()`; config name `canvas.content_template.*.*.*` (schema) | `Resolver::owns()/layers()`, hooks, `ApiController`, config schema | node ownership; failures are caught and logged (head lost, page served) | `ResolverTest::testOwnershipAndLayers`, `CoupledHeadTest::testNodeAndOtherRoutes` |
| `Entity\Page`: base fields `description`, `image`, `created`, `changed`, owner; route `entity.canvas_page.canonical` | `Resolver::tokens()`, hooks | tokens and the coupled head | `ResolverTest::testTokens`, `CoupledHeadTest::testPage` |
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
| Editor routes `/editor/canvas_page/{id}`, `/template/{type}/{bundle}/{mode}/{id}` (mirror `extractEntityParams`) | wrong or no context | `host.test.ts`, `host-contract.spec.ts` |
| Dialog frame behavior (named, sized, survives editor navigation until a side-menu click) | layout or lifecycle | `host-contract.spec.ts` "dialog frame" |

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
| site name, front page, timezone | `config:system.site`, `config:system.date` | `tokens()`, `url()` |
| node field definitions, media type sources | `entity_field_info`, `config:media_type_list` | `tokens()` (non-page bundles) |
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
- Hreflang lists published translations only, with `x-default`.
- Site and template patterns and the identity name are config `string`, the
  same in every language (non-goal).

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

- Input: `Values::clean()` in write mode is the gate; bodies over 128 KiB are
  refused. Output: everything is cleaned again in read mode, every token
  value is what anonymous may see, attributes are escaped by the render
  system, JSON-LD is hex-escaped.
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

`modules/canvas_metatag_ai` adds suggestions; it stores nothing.

- `AiHooks` implements `hook_canvas_metatag_capabilities_alter`: users with
  `use canvas metatag ai` get `capabilities.ai = {available, reason}` in the
  state; others get NULL and learn nothing about the provider.
- `AiController::suggest()` checks and caps the request (fields, count 1 to 5,
  hint 200, current values 2000, page text 12000 characters, langcode must be
  a site language), applies flood control, and maps provider exceptions to
  stable error codes. Provider messages are logged; prompts, page text and
  answers never are.
- `Assistant` uses the default provider for structured chat, else chat. The
  system prompt holds nothing from the request. The page text goes into the
  user message between `<page_content>` tags; `inline()` folds compatibility
  forms and strips any delimiter tag, repeatedly. The AI module's hostname
  filter is bypassed (it HTML-escapes and breaks JSON); instead answers are
  checked against the requested shape, braces are removed (no planted tokens),
  values reduced to plain text, text suggestions with a URL dropped, and
  schema properties checked with `SchemaGraph::validLiteral()`. A schema value
  is marked unverified unless the page text contains it (dates never verify).
- The dialog shows suggestions for review only; an applied suggestion is saved
  like typed text and validated again on save.

## 17. Testing

| Suite | Proves | Run |
|---|---|---|
| `tests/src/Unit/ValuesTest`, `SchemaGraphTest` | validation (refused and accepted cases), encoding, cascade, text outputs, separators; registry, ids, withheld nodes, custom JSON-LD, encoder safety; the shared fixtures `tests/fixtures/text-cases.json` and `graphs/*.json` | PHPUnit |
| `ResolverTest` | ownership, layers, tokens and access, the head, cacheability and drafts, the public base | PHPUnit (kernel) |
| `PageDraftTest`, `TemplateDraftTest` | the draft transport against real Canvas: editor saves carry our value, the conflict rule, publish, translations (incl. draft-only), refusals, duplicate | PHPUnit (kernel) |
| `CoupledHeadTest` | the HTML head an anonymous visitor gets, with both page caches; non-owned routes untouched; a failing build serves core's head | PHPUnit (kernel) |
| `HeadlessHeadTest` | the content API head, preview drafts, routes left alone, the runtime requirement | PHPUnit (kernel) |
| `MetatagCoexistenceTest` | Metatag silent where the head is ours, widgets hidden | PHPUnit (kernel) |
| `ApiTest` | route requirements, state, site, media, writes follow shown values | PHPUnit (kernel) |
| `InstallTest` | install, uninstall (drafts written back), reinstall, container without canvas_headless | PHPUnit (kernel) |
| `AiControllerTest`, `AssistantTest` | access, caps, flood, error codes, nothing logged or written; provider resolution, prompts, output cleaning | PHPUnit (kernel, submodule) |
| `extension/src/*.test.ts` (vitest) | model rules mirror PHP (same fixtures), the write loop, pending storage, checks, API client, host adapter parsing | `npm run verify` |
| Playwright `host-contract` | every Canvas internal of section 11 in the real editor | runs first |
| Playwright `coupled` (`page`, `template`, `site`, `access`) | the dialog in the real editor end to end: inheritance, draft saves surviving editor saves, closing mid-edit, publish to head, templates bound to fields, site settings, read-only and conflict states, keyboard, axe scan, 200 % zoom | |
| Playwright `headless`, `ai` | content API heads and preview tokens; suggestions with a test provider | |

Commands are in the README ("Development"). Kernel tests use Canvas's
`phpunit.xml.dist`. The Playwright suite installs a seeded sandbox per spec
file with `tests/src/TestSite/CanvasMetatagTestSetup.php`; its environment
variables are listed at the top of `tests/e2e/fixture.ts`. CI
(`.gitlab-ci.yml`) runs the drupal.org template jobs (PHPUnit, PHPCS, PHPStan,
cspell) plus `frontend` (`npm ci && npm run verify`), `build-assets` (fails
when the committed `extension/dist` differs from a fresh build) and
`playwright` (all projects, one worker).

## 18. Known limitations and non-goals

Non-goals are listed in the README ("What it does not do"). Known
limitations of the implementation:

- Same-client lost-update window (section 9): narrowed by the client, not
  closed. Site settings are last save wins.
- The headless head depends on controller resolution, and the decorator
  decodes and re-encodes each uncached owned response.
- Metatag is silent on revision, latest-version and preview routes of owned
  nodes, where this module emits nothing.
- `{image}` by media UUID uses the media's default translation, so a
  translated alt text is not used (`ponytail:` in `Resolver::image()`).
- With language domains and a headless frontend, URLs stay on the Drupal
  domain; nothing maps a language to a frontend host.
- Only files in the `public` scheme are emitted; a remote wrapper serving
  public files is treated as missing.
- Custom JSON-LD is decoded as arrays on output, so an empty object or an
  object with only numeric keys is emitted as a list.
- `templateContext()` reads the template's values itself (override-free)
  while `Resolver::layers()` reads them with overrides, so under a config
  override of a template's setting the dialog's values and its preview can
  differ.
- One confirmed save makes a full `GET /state` (the whole resolver, the AI
  status, and `getAutoSaveEntityForPreview()` reads the site's auto-save list).
  Fine at today's sizes.
- The settings-file public base needs a cache rebuild when changed.
- Dialog: one offer of an unsaved change at a time; text composed by an input
  method inside a chip, and a paste, are not steps of the browser's undo.
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
src/Resolver.php                  ownership, layers, tokens, images,
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
modules/canvas_metatag_ai/        suggestions (prompts in Assistant.php)
tests/fixtures/                   cases shared by PHP and TypeScript
tests/e2e/host-contract.spec.ts   update first when Canvas changes
```

- New token: `Resolver::TOKENS`, `LABELS`, `tokens()`; the dialog picks it up
  from the state.
- New structured data type or property: `data/schema-types.json` and a
  fixture in `tests/fixtures/graphs/`. The AI prompt follows the registry
  (text and date properties, unless a property says `"ai": false`).
- New stored key: `Values::KEYS` and its cleaner, the config schema,
  `model.ts`, `text-cases.json`.
- A Canvas upgrade: run `host-contract`, then `PageDraftTest`,
  `TemplateDraftTest`, `HeadlessHeadTest`, `InstallTest`; walk the table in
  section 11.
