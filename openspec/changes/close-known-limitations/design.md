# Design

## Context

Each gap was traced on the farm site (core 11.4, Canvas 1.x) by reading the
code and running read-only probes. Line references in this document drift
while the queued changes land, so each task re-reads its code first. G4 and
G7 belong to `serve-each-frontend-its-own-addresses`, and this change does not
touch them.

All the gaps share one principle: **the module never relies on a coincidence
of timing, naming or storage it does not control.**

- When Canvas offers a seam, the module uses it.
- When Canvas offers none, the module uses the narrowest internal there is. It
  checks that internal before relying on it, falls back to Canvas's own
  behaviour when it changes, and says so in the status report.
- In both cases a test fails when the internal changes, and an upstream draft
  replaces the internal with an API.

The plan was reviewed from a maintainer's and from a site's side. What was
taken up is folded into the decisions below; what was not is under "Review
decisions".

## Goals / Non-Goals

**Goals**

- Close G1, G3 and G5 in the module, and G6 for the module's own setting.
- Make G2 independent of Canvas's controller, and tell administrators when it
  falls back.
- For G8, ship the product fix (values carry their language) and answer how
  an editor edits a translation; plan the test infrastructure as its own
  change (`followups/test-in-every-engine-and-language.md`).
- Write paste-ready upstream drafts for what only Canvas, or core, can finish.
- Rewrite "Known limitations" so that it lists only what is still true.

**Non-goals**

- G4 and G7.
- The read-only type with no content, site settings' last-save-wins and
  JSON-LD `{}` (proposal, "What stays open").
- Other overridden template properties leaking through Canvas's publish
  (status, component tree, other modules' settings). That is Canvas's to fix
  (`upstream/canvas-override-free-editing.md`).
- Language overrides of the module's settings (D6).
- Posting anything upstream.

## Decisions

### D1. G1: a Canvas save never changes the module's value

Canvas never edits `canvas_metatag` (it has no form display) or the template's
`third_party_settings.canvas_metatag` (it is in no Canvas form). So the rule
"whenever Canvas saves a page or template draft, the module's value comes from
the latest draft" is always correct, and it closes the race for every writer:
the dialog, the write sent while the dialog closes, and the command line.

The pieces:

- **`CanvasMetatagServiceProvider::alter()`** swaps the class of the
  `Drupal\canvas\AutoSave\AutoSaveManager` service for `SeoAutoSaveManager`
  only when all three of these hold:
  - the definition's class is exactly Canvas's, so another module's swap is
    never overwritten;
  - the class is not final;
  - `saveEntity()` still has the signature `(EntityInterface, ?string): void`.

  Otherwise it leaves Canvas alone. The subclass is then never autoloaded, so
  a changed Canvas cannot fatal on it after a container rebuild. The parent
  constructor's autowiring and the `event_subscriber` tag are kept. The
  `Drafts` service is injected with a setter, which avoids a circular
  reference.
- **`SeoAutoSaveManager`** (about 15 lines) overrides only `saveEntity()` and
  hands the save to `Drafts::keep()`.
- **`Drafts`** (final, about 80 lines) is the only way to write the module's
  value into a draft. It is marked `@api`, and the README's developer notes
  say so in one line: write the SEO value into a draft only through `Drafts`.
  - `write($entity, $change, $clientId)`: takes the lock (below), reads the
    draft without the memory cache, or else starts from the stored entity
    (D2), runs `$change`, which is where the conflict rule and validation
    run, and saves. Without the lock after 5 seconds it throws `Busy`, which
    the API answers as 409 `busy` with `Retry-After: 1`.
  - `asGiven($save)`: saves made inside it keep the module's value exactly as
    given. `write()`, uninstall, post-update and the test seeds use it,
    because otherwise the copy-over would put the old value straight back.
  - `keep($entity, $save)`: called by the subclass. It handles pages and
    templates; anything else, and anything inside `asGiven()`, is saved
    unchanged. It takes the module's value from the latest draft, or, with no
    draft, from the copy Canvas compares against (D2). It never refuses
    Canvas: after 5 seconds it goes ahead without the lock.
- **The lock.** Core's `lock` service, one name per auto-save key, acquired
  with an explicit expiry of 10 seconds, longer than the wait. Core's
  database lock is re-entrant per process, and its `release()` drops the row
  whoever nested: a nested `keep()` inside `write()` (the template live write
  in task 2.4 stores config, and Canvas's config save listener then saves the
  draft) would release the outer lock mid-step. So `Drafts` counts depth per
  key in `private array $held`: it calls `acquire()` only at depth 0 and
  `release()` only on return to depth 0, in a `finally`. The wait is written
  out: `acquire()`, then `wait()` and `acquire()` again until the 5-second
  deadline (`wait()` alone sleeps and never acquires).
- **Client.**
  - `saveDraft()` becomes payload, token, PUT. The answer confirms the write.
  - On `busy`, the dialog retries once after a second, silently. A second
    `busy` shows the existing failed line, "Couldn't save · your changes are
    kept here", with Try again. A write sent while the dialog closes is not
    retried; its change stays in session storage and is offered on the next
    open, as today.
  - The follow-up `GET /state` refreshes output and previews. It also catches
    the publish residual: when it shows no draft for the target and live
    values that differ at the paths just written, the change is marked unsent
    and written once more, into a new draft that "Review changes" lists. If
    the second write meets the same state, the existing `unstored` strip
    shows. It never loops.
  - The ARCHITECTURE section 11 row for `canvasLayoutRequestInProgress` goes.
- **Status report.** A warning, "SEO values in Canvas drafts", when the
  injected manager is not a `SeoAutoSaveManager`. Writes keep working: they are
  still locked, and still read the latest draft.
- **Residual.** A publish or discard of the same draft that crosses a module
  write. `delete()` is not a save, and guarding it was rejected (see
  Alternatives). The dialog's follow-up read writes the change again, so the
  editor loses nothing; a command-line write is reported by its own
  follow-up. The README states it, and the upstream draft closes it.
- **Interplay with `make-the-module-agent-ready`.** A Canvas save in flight
  copies the latest value, which may come from another session, and saves
  the entry under the editor's client id. The value survives, but the other
  writer's conflict signal for that entry is lost. Its interplay note says
  so.

**Upstream adoption.** Once `AutoSaveManager::update()` ships, `Drafts::write()`
calls it. The subclass, the swap, the warning and the section 11 row are then
deleted, and the README line goes.

### D2. A draft the module starts holds no override

Two rules, one per writer:

- **The module never puts an override into a draft.** When `write()` finds no
  draft it starts from the stored entity: a page's stored translation, or the
  template loaded override-free (`loadOverrideFree()`, as
  `ApiController::putTemplate()` does today). At a pinned path (D6) it keeps
  the stored value. A pure SEO edit therefore never carries any override,
  of the module or of anything else on the template, into Canvas's publish.
- **`keep()` follows Canvas's own convention.** With no draft, a Canvas save
  takes the module's value from the copy Canvas's `getUnchangedHash()`
  compares against (`loadUnchanged()`, which applies overrides). Canvas's own
  entity already carries every override, so this adds none, and an editor's
  unchanged round trip still leaves no draft. D6's guard keeps the module's
  override out of active configuration at publish.

The cost, accepted: under an override of the module's own setting, a dialog
write leaves a draft whose hash never equals Canvas's overridden unchanged
copy. That draft is visible and harmless. A silent per-environment value in
exported configuration is neither. It goes away with the G6 upstream draft,
which makes `getUnchangedHash()` override-free.

`templateContext()` replaces each pinned path in `values` with the stored
value explicitly, because a draft Canvas started may hold the override there.
"Stored" always means active configuration read without overrides
(`ConfigFactory::getEditable()`).

### D3. G2: the headless head is set on the response, not in the controller

`src/EventSubscriber/HeadlessHead.php` (final) listens to
`KernelEvents::RESPONSE` at priority 8. That is after canvas_headless's error
conversion (9) and before Dynamic Page Cache stores the response (7). It ties
with canvas_headless's own cacheability step (8); both only add, so their
order does not matter. `CanvasMetatagServiceProvider::register()` registers
it only when `canvas_headless` is in `container.modules`.

`HeadlessContentController`, its services.yml entry and the guard's
`ClassResolver` dependency are removed.

Behaviour:

1. Skip unless it is the main request, the request carries Canvas's
   requested-URI attribute, and the response is a 200
   `CacheableJsonResponse`.
2. Skip a Dynamic Page Cache hit, read through
   `DynamicPageCacheSubscriber::HEADER`. The stored copy already carries the
   module's head.
3. Run today's logic unchanged inside one `\Throwable` guard: resolve the
   route, check the full view and the ownership, and read the draft only for a
   preview token together with the route option.
4. Resolve inside `executeInRenderContext()` and merge what bubbles up. A
   controller had a render context; a response listener has none. The head
   alter of `add-advanced-meta-tags` may render.
5. Replace `head` and add the module's cacheability.

`HeadlessHead::CONTRACT` is a constant list of the Canvas members it reads,
as `[class, member]` pairs, checked once per request with `defined()` and
`method_exists()`. If one is missing, the subscriber leaves the response
alone, so the content API answers with Canvas's own head, without the
module's canonical or robots values. It logs nothing per request; instead
`hook_rebuild()` logs one error naming the member, so a site whose content
API is cached in front still hears about it. The status report error "SEO
for headless content" names the member and says: "Update SEO for Canvas.
Until then the content API sends Canvas's own head, without SEO values." It
also reports an error when the subscriber is missing from the dispatcher's
listeners.

**Upstream adoption.** Once `hook_canvas_headless_head_alter()` ships, the
module implements it in about 15 lines. It deletes the subscriber, the guard
and four section 11 rows, and raises its Canvas constraint.

### D4. G3: media text in the page's language, picked the way core picks it

- `Resolver::image()` takes a required `$langcode`. Both callers pass the
  entity's language.
- `mediaImage()` and `label()` use core's
  `EntityRepositoryInterface::getTranslationFromContext()`, the same lookup
  core's reference formatters use. The module's `translated()` is deleted.
- `describe()` and `describeMedia()`, which build the dialog's image and the
  picker tiles, take the target's language too, so the Social tab does not
  flip from the default language's alt to the translation's when the state
  settles.
- When the translation picked is a fallback (not in the page's language), the
  result gains `config:configurable_language_list`, because the order of
  language weights decides the fallback.
- An unpublished translation fails the existing anonymous `view` check, so the
  chain moves on, and the reason is `translation` (D5).
- An emptied alt text stays empty, and the existing alt check reports it.
- An empty post-update flushes heads that are already cached.

### D5. G5: one public-file rule

`Resolver::isPublic(string $uri)` returns TRUE when the scheme is `public`, or
when it is in `$settings['file_additional_public_schemes']`, is neither
`private` nor `temporary`, and `isValidScheme()` accepts it. Core uses that
setting, minus `private` and `temporary`, to choose public caching headers
in its file download controller and to skip `hook_file_download` for image
style derivatives. It does not use it to grant access. The module's rule is
stricter: a declared scheme counts only together with the anonymous `view`
check through a reference visitors may view.

- It is used in `describe()` (the picker and its tiles) and `usable()` (facts,
  overrides, logo and the default image).
- It moves into `link()`, so that a linked image that isn't public reads
  `hidden` with a reason rather than `empty`.
- **Resized copies.** The social image chain asks for a 1200 × 630 version.
  It is used only when the image style supports the URI and the scheme is
  writable. Otherwise the original is emitted, and its real dimensions decide
  whether it passes the 600 × 315 floor. A read-only declared scheme keeps the
  file's own address.
- **Protocol-relative addresses.** `fileArray()` builds the address with
  `generateAbsoluteString()`. A file delivery network integration that
  rewrites public addresses to `//cdn.host/...` made every image NULL, with
  no reason anywhere. When the address starts with `//`, the scheme of the
  public base (`origin()`) is put in front, and then the existing "absolute
  http(s) or nothing" rule applies. The thumbnails follow the same path.
- Changing the setting takes a cache rebuild, as it does for core's own
  download headers. This goes in the Deployment docs, not in the limitations.
- A `BoundaryTest` case fails if any file other than `Resolver` reads a file's
  scheme, so that queued changes cannot copy `'public'` back in.

**Reasons, not a flag.** `facts().image.hidden` becomes a reason:
`'private' | 'unpublished' | 'translation' | 'not-public'`. The server knows
which, and "Hidden from visitors" is untrue for a private image that visitors
do see on the live page. What people see:

- The image field: "Not used in link previews: the image is in private
  files · using …", likewise "…: it is unpublished", "…: its French version
  is unpublished" and "…: its file system is not public".
- The linked box: "Private file: not shared" for a file reason; "Hidden from
  visitors" stays for real access denials.
- The check `image-hidden`, with the same reason in its title. It replaces
  "Add a social image" when the reason is an image that can't be shared. It
  is "to improve" when links show no image and an editor can act
  (unpublished media or translation, or a non-public image chosen while
  public image types exist). It is "good to know" otherwise, and adds "Ask a
  site administrator" when the reason is the type's file system and no
  public image type exists.
- The picker filters in its query: `$types` keeps only image media types
  whose source field storage `uri_scheme` passes `isPublic()`, so 24 newer
  private images can no longer end the list before an older public one.
  `describe()` stays the per-file guard. Its empty state says "No images
  found. Only published images stored in public files are listed. To use a
  new image, add it to the media library first."
- The status report gets one information row, "Images not used in link
  previews". It lists each image media type whose storage scheme fails
  `isPublic()`, private ones included and worded neutrally ("Scan images are
  stored in private files, so link previews never use them."), and names
  `file_additional_public_schemes` for the others. It reads configuration
  only, and shares its type helper with the picker.

### D6. G6: a path a configuration override replaces is pinned

**Detector.** `Overrides::pinned(Config $config, string $key, string $scope)`
uses core's `Config::hasOverrides()` on the scope's value units:

- depth 1 for `title`, `title_end`, `description` and the identity keys;
- depth 2 for `social.*`, `robots.*`, `schema.type` and `schema.custom`;
- depth 3 for `schema.props.<key>`.

It returns, for each pinned path, the cleaned effective value, or NULL when
the override leaves no valid value. A pinned `schema.type` pins all of its
props. It is used for the template and for the site, and it replaces
`make-the-module-agent-ready`'s site-only check.

**State.** The state gains `target.overridden` and `site.overridden`, each a
map of path to effective value. `values` and `identity` keep the stored,
override-free values, also when a draft exists (D2). The two meanings never
share one document.

**Writes.**

- "Changes a pinned path" means differs from the stored value. A write that
  changes one is answered 422 `invalid` with "This is set in site
  configuration outside SEO. Change it there, or remove the override
  first.". The new field code `overridden` joins the closed list, so the
  command line refuses the same way, with the same sentence. Nothing is ever
  stored silently.
- A dialog write keeps the stored value at pinned paths (D2).

**Previews.** `Resolver::layers()` lays the pinned values over a template
draft, and the template's config becomes a cacheable dependency. Without a
draft, the output already uses `loadForEntity()`.

**Publish guard.** A `content_template_presave` hook catches the leak's exact
signature in the module's namespace: a pinned path whose incoming value
equals the effective value and differs from the stored one. In that case it
restores the stored value.

- The sources are named, because the obvious one is wrong. The entity's
  original comes from `loadUnchanged()`, which applies overrides, so it
  equals the incoming value and the guard would never fire. "Stored" is
  `ConfigFactory::getEditable($name)->get('third_party_settings.canvas_metatag')`,
  and "effective" is `ConfigFactory::get($name)` in the same call.
- A kernel assertion pins that reason: under an override, the entity's
  original holds the override.
- It skips config imports (`isSyncing()`), and a deliberate write of any
  third value goes through, as core allows. The guard cannot tell a leak from
  code that deliberately stores exactly the override's value, so the docs say
  to remove the override first or import the value.
- It covers the module's own setting only. Other overridden properties of a
  template still reach active configuration through Canvas's publish; the
  upstream draft covers them, and the README says so.

**Null members.** In `Values::value()`, members set to null are dropped before
the one-member rule. Without that, an override cannot turn a linked value into
text, because core's deep merge would produce an invalid two-member value.

**Client.**

- `view()` cascades over the stored values with the overrides laid on top, so
  the client's text equals the server's.
- `source()` gains `'config'`.
- A fully pinned field is locked, in the existing locked style, with "Set in
  site configuration outside SEO" visible at rest. It offers no Reset, Edit,
  Suggest or fix. For a user who may administer the module's site settings
  (the state's existing `site` access flag), the aside adds "Change it where
  the site's configuration sets it, or remove that override first."
- `tidy()` keeps pinned paths at their stored value. An unsent edit to a
  pinned path is dropped on load, and the existing offer strip says so once:
  "A change to Title ending wasn't kept: it is now set in site
  configuration."
- An overridden site noindex makes `hiddenBy: 'config'` exact. The regex on
  the robots tag stays only as a fallback.

**Mechanisms.**

- `settings.php` overrides are fully covered.
- Module overrides are shown as the editor's request sees them. One that
  varies by host gets a README note.
- Language overrides are not supported. The module's schema has nothing
  translatable, so they exist only as hand-made files. The detector sees
  whatever the request's config factory applies; the README says that
  language overrides of the module's settings are not supported.

**Upstream adoption.** Once Canvas edits and publishes override-free, the
guard becomes a no-op and is deleted with its section 11 row, and the
accepted draft cost in D2 goes away.

### D7. G8: values carry their language, and translation editing is answered

The engine matrix, the multilingual and domain suites, the accessibility
scans and the screen-reader checklist are a change of their own,
`test-in-every-engine-and-language`. Its plan is in
`followups/test-in-every-engine-and-language.md`. What stays here is the
product side.

**Product fix.**

- Each element that already has `dir="auto"` for a value also gets the value's
  language: the translation's, the previewed node's, or the site's default.
- Language names inside English sentences get `<bdi>`.

**Translation editing probe (task 4.1).** The research found that under path
prefixes Canvas redirects language-prefixed editor addresses to the
unprefixed one. Canvas 1.x also has a `?language=` editor parameter, and the
layout GET sends `canvas_preview_langcode`, which Canvas routes through the
site's language negotiation. The module's `editorToken()` looks up
`autoSavesHash` under the bare layout path. The probe, on site-4 with path
prefixes, then with `?language=`, then with domains, records which
translation the dialog edits and whether it gets a token. The outcome
decides:

- the README's Translations sentence: how an editor edits a translation's
  SEO, with the command line as the fallback;
- whether `editorToken()` needs the language in its lookup (a fix here, with
  a vitest case);
- whether the README keeps a line saying the browser edits only the default
  language.

### D8. One status report hook, several rows

`runtimeRequirements()` returns early today when `canvas_headless` is absent.
It becomes a merge of independent rows:

- headless (D3), error;
- drafts (D1), warning;
- images not used in link previews (D5), information.

Each row has its own kernel test, and each test asserts that the other rows
still appear.

## Alternatives considered

| Gap | Alternative | Why not |
|---|---|---|
| G1 | Keep the client read-back loop | It treats the symptom. It cannot cover the closing flush or the command line, and it costs up to five round trips per save. |
| G1 | A separate store merged at publish | "Review changes", discard and publish-all know only Canvas's entries; the module would re-implement the draft lifecycle. |
| G1 | A lock in the module only | Canvas does not take it, so its stale write still lands. |
| G1 | Compare-and-swap on Canvas's hash | It protects only the small direction, and core's key-value store has no compare-and-swap. |
| G1 | The value in Canvas's own POST through a hidden Page data widget | Pages only, a preview re-render on every SEO save, and validation moves into the form system. |
| G1 | A `decorates:` service instead of `setClass()` | Consumers type-hint the concrete class, so the decorator must extend it anyway, and it would forward about 20 methods. |
| G1 | Also guard `delete()` for publish and discard | It breaks Canvas's deliberate discard of an incompatible template draft and the module's uninstall. |
| G1 | 503 for `busy` | Proxies and delivery networks replace 503 bodies with their own pages, and monitoring alerts on it; the server is not unavailable. 409 with its own code stays distinct from `conflict`. |
| G1 | Rely on core's lock being re-entrant | Its `release()` drops the lock for every nesting level. |
| G2 | A stricter guard on the decorator | It detects the 500 instead of preventing it. |
| G2 | Decorating `CanvasContentHeadBuilder` | The class is final, and the controller type-hints it. |
| G2 | `hook_metatags_alter` | Only with Metatag; it alters tag values, not head rows; canonical is dropped after it. |
| G2 | An own route enhancer, or `KernelEvents::VIEW` | The same 500 class as today; VIEW never fires for a Response. |
| G2 | Log on every request when the contract breaks | One line per request floods the log; one line per rebuild is enough. |
| G3 | Page language, else the default translation | Disagrees with core's fallback order, so the head and the body show different text, and it keeps a private copy of a core service. |
| G3 | Fall back to the default alt when a translation's alt is empty | An empty alt can be deliberate, and the alt check already reports it. |
| G5 | Stream wrapper type flags, URL inspection or an anonymous probe | Flags describe the UI, not who can read. A signed, expiring URL looks public. A probe does network I/O while rendering. |
| G5 | A module setting listing public schemes | It duplicates core's documented declaration, and the two lists would drift. |
| G5 | Private files when anonymous may view them through media | It defeats the site's choice, and other services keep the shared image cached after an unpublish. |
| G5 | Filter the picker after the query | A page of 24 private images ends the list while public images exist. |
| G6 | Core's pattern: an editable stored value plus an "overridden" message | The field drives a live preview, so an edit that changes nothing reads as a bug, and it stores a value that will not apply. |
| G6 | The effective value in `values` | The client would send the override back on every save. |
| G6 | Start the module's drafts from the overridden copy | Every override on the template, not only the module's, would reach the draft and then active configuration through Canvas's publish. |
| G6 | Silently keep the stored value on a write | Accepting a request and then ignoring it is the silent behaviour this change removes. |
| G6 | A presave guard that always restores stored values | It would break recipes and code that update stored config under an override. |
| G6 | Swap Canvas's parameter converter for template routes | It changes Canvas's routes from outside; that is the upstream fix. |

## Risks / Trade-offs

- **[Overriding a Canvas service class]**
  - Mitigations: the class and signature guard, a subclass that is never
    autoloaded when the guard fails, the status warning, and the "phpunit
    (canvas dev)" CI job running the interleave tests.
  - Residual, stated plainly: if Composer updates Canvas and the container is
    not rebuilt, the old container still names `SeoAutoSaveManager`. If
    `saveEntity()` changed, loading it is a fatal error, and because
    `AutoSaveManager` subscribes to config CRUD events, that fatal hits any
    config save on the site. That is the standard risk of a `setClass()`
    override. Each phase that changes services ships an empty post-update, so
    `drush updb` and `drush deploy` rebuild the container, and the release
    notes say "run database updates".
- **[Third-party draft writes]** Code other than the module that writes the
  SEO value with `saveEntity()` (a migration, content sync, a later Canvas AI
  write tool) now has that value replaced by the latest one. `Drafts` is the
  documented `@api` way in, and a kernel test pins the rule.
- **[Test seeds]** About 20 existing kernel seeds call `saveEntity()` on a
  draft that carries a module value (ApiTest, HeadlessHeadTest,
  PageDraftTest, ResolverTest, InstallTest, PostUpdateTest and the
  ComplexContent fixture). Left alone, some would fail and some would pass
  while testing the stored value. A `SeedsDrafts` trait wraps `asGiven()`,
  and task 2.3 sweeps every call site.
- **[One swap wins]** If another module swaps the same service, the module
  steps aside and warns. Losses are then back at their old rate, with no
  retry loop. The status report says so.
- **[Cost per Canvas save]**
  - Each page or template save pays one lock and one draft rebuild (the
    rebuild runs `create()` and `loadUnchanged()`), also on the layout GET's
    reconciliation. Budgeted at under 5 ms; measured in task 2.3 on a page
    with a large component tree, not a seed page, and reported in the merge
    request.
  - Fallback: if the cost shows up, read the raw key-value entry instead of
    rebuilding the draft entity. That adds one internal dependency, so it is
    used only if needed.
- **[Lock tests]** The interleave tests run in one process with one lock id,
  so they cannot exercise mutual exclusion. Contention, `busy`, the expiry
  and the 5-second fallback are proven with a fake lock in unit tests.
- **[Dynamic Page Cache coupling (G2)]** The subscriber depends on Dynamic Page
  Cache's priority 7 and its header constant. Both are core, and stable since
  8.0. A MISS-then-HIT test pins them.
- **[The publish guard (G6) relies on the leak's signature]** It cannot tell a
  deliberate store of exactly the override's value from a leak. This is
  documented, with the way around it.
- **[Request-varying module overrides (G6)]** The dialog shows what the
  editor's request gets. This is inherent, and documented.
- **[Intended output changes]**
  - Multilingual sites get translated media text (G3).
  - Sites that declare a scheme public start sharing its images (G5). That is
    opt-in by construction.
  - Sites whose file addresses are protocol-relative start sharing images
    (G5).
  - All go in the release notes.
- **[Specs written on queued text]** If a base requirement changes before this
  change lands, the MODIFIED block is rebased (task 6.1). `openspec validate`
  does not catch a stale copy.

## Migration Plan

- Phase 1 adds an empty post-update so that `drush updb` flushes cached heads
  (G3, G5).
- Phase 2 adds an empty post-update so that `drush updb` rebuilds the
  container for the new services (G1, G2).
- Phase 3 adds an empty post-update for the attribute hook, which core 11
  compiles into the container; without a rebuild the release would deploy
  without its guard. Stored values are untouched.
- Phase 4 changes the dialog's markup and the README only.
- Each phase's release notes say "run database updates".
- Rollback is per phase by reverting it. No stored data changes shape.

## Open Questions

The proposal lists the product owner's decisions. Two questions are for the
implementer:

- The translation editing probe (D7) decides the README's Translations
  sentence and whether `editorToken()` changes.
- The measured cost per Canvas save (Risks) decides whether a raw key-value
  read is needed.

## Review decisions

Two reviews were applied: a maintainer's (core and contributed code) and a
site's (a site builder and a daily editor on a multilingual site with a file
delivery network and private files). Most findings were taken up above. These
were not, or only in part:

| Finding | Decision | Why |
|---|---|---|
| Maintainer: `keep()` should also fall back to the override-free copy | Partly taken: `write()` starts override-free; `keep()` follows Canvas's compare copy | Canvas's own entity already carries every override, so `keep()` adds none, and an editor's unchanged round trip keeps leaving no draft. The guard covers publish for the module's namespace. |
| Maintainer: pin `drupal/canvas` to a tested minor in `composer.json` | Rejected | A contributed module pinning a minor blocks sites from Canvas security releases. The signature guard, the per-phase post-update and the status warning cover it, and the residual is stated in Risks. |
| Maintainer: drop "or the dialog offers it on the next open" for a close-time write | Rejected | Its premise is wrong: the dialog keeps unsent edits in session storage and offers them on the next open. The requirement moves to the follow-up change with the clause. |
| Maintainer: drop the status row unless it is a warning | Rejected in favour of the site review | With the picker filtering by type, an administrator has no other place to learn which image types link previews never use, and editors' checks now point to them. It stays information. |
| Maintainer: README G8 line loses "a multilingual site" | Rejected | Until the follow-up's multilingual suites land, a multilingual site is still not tested in a browser. |
| Site: read language overrides in the target translation's language | Rejected | The module's schema has nothing translatable, so such overrides exist only as hand-made files. They are documented as unsupported instead of half-supported. |
| Site: "Set in the site's configuration files" | Rejected | Module overrides are not files. "Set in site configuration outside SEO" stays accurate for both; the next-step sentence says where to act. |
