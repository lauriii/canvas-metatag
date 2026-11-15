# Proposal

## Why

The product owner read the README's "Known limitations" and asked: "how could
we address as many gaps as possible". The quality bar is the usual one:
immaculate, clean, minimal. Fix a gap in the module where it can be done
properly. Where the right fix belongs in Canvas, ship the module-side
mitigation and draft the upstream proposal, without posting it.

The README lists eight gaps. In this document they are G1 to G8, in README
order:

| | README line, short | Outcome of this change |
|---|---|---|
| G1 | A dialog save and an editor save in the same instant can overwrite each other | **closed**; a write that crosses a publish is written again; upstream draft |
| G2 | The headless head depends on Canvas resolving this module's controller | **made safe**: it no longer depends on the controller; if Canvas drops a member it reads, it falls back to Canvas's head and says so; upstream draft |
| G3 | A page image's alt text comes from the media item's default language | **closed** |
| G4 | With a language per domain and a headless frontend, addresses stay on Drupal's domain | owned by `serve-each-frontend-its-own-addresses`; not touched |
| G5 | Images count only in the public file system | **closed** (core's declaration of public file systems), and protocol-relative file addresses are fixed too |
| G6 | Under a configuration override of a template's setting, fields and output disagree | **closed for the module's own setting**, and a leak of that setting into exported configuration is closed too. Other overridden template properties still leak through Canvas's publish; upstream draft |
| G7 | Changing `canvas_metatag_public_base` takes a cache rebuild | owned by `serve-each-frontend-its-own-addresses`; not touched |
| G8 | Tested in Chromium on a single-language site | **narrowed**: values carry their language, and how an editor edits a translation is answered. The engine, multilingual and screen-reader coverage is its own change, `test-in-every-engine-and-language`, queued next; the README line stays until it lands |

Each gap was traced to its root cause in the module, Canvas 1.x and core
11.4 on the farm site. Five findings go beyond what the README says:

- **G1 mostly runs the other way.** Canvas's layout save reads the draft when
  the request starts and writes the whole entity 100 to 500 ms later. A dialog
  write in between is lost. The five-try read-back loop narrows that window,
  but it cannot cover two writes that have no read-back: the one sent while
  the dialog closes, and the queued command-line `set --to=draft`. A loss there
  is silent.
- **G2 can take the content API down.** Canvas routes to
  `CanvasContentController::class . '::get'`. If a Canvas update renames
  `get()`, adds an argument or widens its return type, every uncached content
  API request answers 500 through the module's decorator, and the status
  report still says all is well.
- **G6 leaks into configuration.** Canvas loads content templates with
  configuration overrides applied, because its routes are not admin routes. Its
  first layout save copies the override into the draft, and publishing stores
  it in active configuration. Config export then carries a per-environment
  value, such as a staging title ending, to every environment. A probe on the
  farm site confirmed the copy.
- **G5's scheme check is what keeps private files out.** Core grants anonymous
  `view` on a private file used by published media. Only the module's
  literal `'public'` check stops such an image from being shared, so the new
  rule has to refuse private files explicitly. A file delivery network that
  makes file addresses protocol-relative loses every image the same silent
  way.
- **G8: no value carries `lang`.** On any non-English site, screen readers
  read titles and previews with the English voice (WCAG 2.2, 3.1.2).

## What Changes

- **G1: Canvas's saves keep the module's value.** Canvas never edits the
  module's value: the page field has no form widget, and the template's
  third-party setting is in no form. So whenever Canvas saves a page or
  template draft, the module's value is taken from the latest draft, not from
  the copy Canvas read when its request started. The module's own writes to
  one draft run one at a time, under a lock.
  - How: a small subclass of Canvas's `AutoSaveManager`, swapped in through the
    service provider only while Canvas still has the expected class and method
    signature, plus a `Drafts` service. `Drafts` is the documented (`@api`)
    and only way to write the SEO value into a draft; uninstall, post-update
    and the test seeds use it too.
  - A write that cannot get the lock within 5 seconds answers 409 `busy` with
    `Retry-After: 1`. The dialog retries once, silently. A Canvas save is
    never refused.
  - The dialog's read-back loop, `whenIdle()`, `quiet()` and the `failed`
    result are deleted, along with the module's reading of Canvas's
    request-in-progress flags. A write is confirmed by its answer.
  - The dialog's follow-up read catches a write that a publish of the same
    page took away, and writes it once more into a new draft.
  - The status report warns when the swap is not in place.
- **G2: the headless head attaches to the response.** The controller
  decorator is replaced by a `KernelEvents::RESPONSE` subscriber, registered
  only when `canvas_headless` is installed. It reads what the content API
  publishes (`head`, `route.entity`) plus the internals it already uses. The
  controller can be renamed, re-routed or decorated by another module without
  effect. If a member it reads is gone, Canvas's head is left in place, one
  error is logged when caches are rebuilt, and the status report names the
  member and says what to do.
- **G3: media text follows the page language.** Every media lookup gets the
  page's language and picks the translation the way core does when it shows
  that media on the page, fallback order included. This covers the social
  image, logo, default image, `{media}` values and the dialog's image tiles.
  The module's partial copy of core's translation lookup goes.
- **G5: public means what core says it means.** One helper accepts `public`
  and the file systems `settings.php` declares public in
  `file_additional_public_schemes`, if they are registered. It never accepts
  `private` or `temporary`. It replaces the three literal checks.
  - A file on another host keeps its own address. A resized copy is used only
    where it can be stored; otherwise the original is shared at its own size.
  - A protocol-relative file address takes the public address's scheme.
  - Editors are told why an image is not used in link previews (private
    files, unpublished, its translation unpublished, or not a public file),
    in the image field, a new check and the linked box. The check asks for a
    site administrator when only the file setup can change it.
  - The picker filters by media type in its query, so private images can no
    longer hide public ones.
  - Administrators get an information row listing image media types that
    link previews never use.
- **G6: an overridden setting is shown as it applies, and locked.** One
  detector finds which value paths an override replaces, for templates and for
  site settings.
  - The state lists them in `overridden`, next to the stored `values`.
  - The dialog shows each overridden field locked with the value that
    applies, saying "Set in site configuration outside SEO", and tells users
    who may change site settings where to act.
  - Previews apply the override even when a draft exists.
  - A write that changes an overridden path is refused, also from the command
    line, with the same next step.
  - Drafts the module starts never hold an override.
  - A presave guard stops a Canvas publish from storing the override of the
    module's setting.
  - A null member is ignored, so an override can replace a linked value with
    text.
- **G8: values carry their language.** Every value gets `lang`, and language
  names in the dialog's sentences are isolated for direction. A probe answers
  how an editor edits a translation's SEO, and the README says it.
- **README "Known limitations" is rewritten** to the residuals below, and the
  docs (README, ARCHITECTURE, design-system, decisions) follow.

## What stays open, and why

- **G1, during publish or discard.** A module write that reaches the server
  while Canvas is publishing or discarding the same draft goes with that
  draft. The dialog's follow-up read writes it again, so the editor loses
  nothing; the README says so in one line. Guarding Canvas's delete would
  break Canvas's deliberate discard of an incompatible template draft and the
  module's own uninstall. The upstream draft closes it.
- **G2, the remaining internals.** The head still reads Canvas's route option
  for template drafts, `CanvasContentRoute` and `PreviewTokenInspector`. These
  are the same internals as today, but a change to any of them now leaves
  Canvas's head in place and is named in the status report and the log. The
  upstream alter hook removes all of them.
- **G4 and G7** belong to `serve-each-frontend-its-own-addresses`. This change
  keeps whatever README lines that change leaves.
- **G6, other template properties.** Canvas's publish can still store other
  overridden properties of a template (its status, its component tree, other
  modules' settings). Under an override of the module's own setting, a
  dialog edit leaves a draft in "Review changes" that Canvas never sees as
  unchanged. Both go with the upstream draft.
- **G8, test coverage.** Firefox, WebKit, multilingual suites, scans of every
  view and a scripted screen-reader pass are their own change,
  `test-in-every-engine-and-language`.
- **Not taken up here:**
  - A content type with no content is read-only. It builds on this change's
    `Drafts::write()` and on the server-side draft path from
    `make-the-module-agent-ready`, and it changes a template-seo rule. It is the
    next candidate.
  - Site settings: the last save wins. That needs a product decision.
  - Custom JSON-LD `{}` becoming `[]` belongs to
    `extend-structured-data-by-id`.
  - Language overrides of the module's settings are documented as not
    supported: nothing in its schema is translatable.

## Upstream drafts (not posted)

All drafts are in `upstream/`, ready to paste, and each is marked "Draft — not
posted". Search each queue for an existing issue first.

- `canvas-auto-save-update.md` (G1): `AutoSaveManager::update()`, an atomic
  read-modify-write under a per-entry lock, and `withLocks()` for publish and
  discard. Includes a kernel reproduction of Canvas's own instance of the race,
  the publish toggle against a layout save.
- `canvas-headless-head-alter.md` (G2): `hook_canvas_headless_head_alter()`,
  invoked after `normalize()` with the rendered entity in its context.
- `canvas-override-free-editing.md` (G6): load config entities override-free
  on Canvas's edit and publish routes and in `getUnchangedHash()`.
- `core-public-schemes.md` (G5, optional, core): one
  `StreamWrapperManager::isPublic()`, and file access that honours declared
  public schemes.

`test-in-every-engine-and-language` carries its own optional draft, asking
Canvas to run its Playwright suite in Firefox and WebKit.

When each one lands, the module deletes its mitigation, as design.md says per
gap. It never runs a fallback path and the upstream API side by side.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `draft-writes`: Canvas's saves keep the value, and the module's writes to
  one draft are serialized. The read-back loop requirement is removed. A
  write is confirmed by its answer, `busy` is retried once, and a write a
  publish took away is written again. The status report says when drafts
  are unprotected.
- `headless-head`: the head does not depend on Canvas's controller. The status
  report and the log name what is missing.
- `dynamic-values`: the definition of "public file"; absolute file
  addresses; media text in the page's language; a null member is ignored.
- `head-output`: the social image chain uses the original where no resized
  copy can be stored; image types link previews never use are reported, and
  the picker leaves them out.
- `seo-dialog`: the image field says why its image is not used in link
  previews; fields set outside SEO are read-only and say where to act; values
  carry their language.
- `seo-checks`: an image link previews can't use is named with its reason;
  the command line's `overridden` covers templates and refuses writes.
- `template-seo` and `site-seo`: settings replaced by configuration are shown
  as they apply and cannot be stored over.

## Dependencies and place in the queue

Land **last**, after `serve-each-frontend-its-own-addresses`, and add it to
decisions.md as item 15, with `test-in-every-engine-and-language` queued
after it. Every MODIFIED block is written on the text that lands before it:

- `link-values-to-fields`: dynamic-values "Values follow the translation"
  (this change reverses its default-language scenario) and "Values are what an
  anonymous visitor may see"; template-seo "The dialog edits the stored
  setting, the output uses overrides".
- `strengthen-zero-config-defaults`: head-output "The social image follows a
  chain".
- `make-the-module-agent-ready`: seo-checks "The command line reports what the
  dialog cannot show". This change also routes that change's live write through
  `Drafts::write()`, adds the `overridden` field code to its closed list, and
  turns its site-only override check into the shared detector.
- `serve-each-frontend-its-own-addresses` took the sentence that a file
  served from another host keeps its own address, with a scenario, so this
  change has no public-addresses block.
- Current specs: draft-writes, headless-head, site-seo "Overrides from outside
  apply to the output only".

These changes only gain coverage, through the shared helpers:
`read-page-components`, `populate-every-schema-type`,
`describe-the-publisher`, and `add-advanced-meta-tags` (its head alter runs
inside the subscriber's render context).

**Phases.** The change ships in four phases. Each phase is releasable on its
own, with its own empty post-update so that `drush updb` flushes heads or
rebuilds the container, in this order:

1. G3 and G5 (media)
2. G1 and G2 (Canvas seams; they share the service provider)
3. G6 (overrides; it uses G1's `Drafts`)
4. G8's product side (`lang`, and the translation editing probe)

## Out of scope and non-goals

No README non-goal is reopened. No new UI surface is added, apart from the
lock state of a field, which uses the existing locked style. There is no new
setting: G5 uses core's existing declaration.

## Open decisions (recommended option first)

1. **G3, an unpublished media translation.** Recommended: the page's image
   moves to the next in the chain, as core's formatter hides it too, and the
   dialog says "its French version is unpublished". Alternative: fall back to
   a published translation.
2. **G6, an overridden field.** Recommended: show the value that applies,
   locked, with where to change it. Alternative: core's "editable, with an
   overridden message". The dialog's fields drive a live preview, so an edit
   that changes nothing on screen would read as a bug.
3. **G5, the status row.** Recommended: information, private types included
   and worded neutrally, so a deliberate setup is not nagged. Alternative: a
   warning for undeclared file systems only.
4. **G1, a write a publish took away.** Recommended: the dialog writes it
   again, once, into a new draft. Alternative: only tell the editor, with the
   existing "could not be stored" strip.
5. **G8, splitting the test coverage out.** Recommended: its own change,
   queued next, so this one reviews as product fixes. Alternative: keep it as
   a fifth phase here.

## Size

M to L overall: about 6 agent days.

| Gap | Size |
|---|---|
| G1 | M, 2 days, with the test seed sweep |
| G2 | S, half a day |
| G3 | S, half a day |
| G5 | M, 1.5 days, with the reasons, the picker filter and protocol-relative addresses |
| G6 | M, 2 days |
| G8 product side | S, half a day |

The follow-up, `test-in-every-engine-and-language`, is M: 2 to 3 days plus a
day for what the first Firefox and WebKit runs find.
