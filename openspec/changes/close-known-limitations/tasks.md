# Tasks

## Conventions

Test paths:

- kernel tests in `tests/src/Kernel/`;
- unit tests in `tests/src/Unit/`;
- test modules in `tests/modules/`;
- vitest next to the source in `extension/src/`;
- Playwright in `tests/e2e/`.

Run PHPUnit through the farm's `docker exec`. Run one browser suite at a time.

Browser checks run on the farm site (site-4), signed in as an editor. Screenshots
go on the merge request. Each phase ends releasable, with its own empty
post-update and "run database updates" in its release notes.

Where a test is meant to fail before the fix, commit it first and record the
failure in the merge request.

## 1. Media text and public files (G3, G5)

- [ ] 1.1 Add `Resolver::isPublic(string $uri)` and use it in `describe()`, `usable()` and `link()`. Its rule: `public`, or a scheme listed in `file_additional_public_schemes` that is neither private nor temporary and has a registered wrapper. Delete the check in `uriImage()` and the `ponytail:` notes. Use the resized 1200 × 630 version only when the image style supports the URI and the scheme is writable; otherwise emit the original with its own dimensions.
  - Prove it with a new `ResolverTest::testImageFileSystems()` using core's `file_test` wrappers:
    - an undeclared `dummy-remote` image is skipped;
    - once declared, it is emitted with its absolute address, and `describe()` returns it;
    - a declared `dummy-external-readonly` file is emitted as the original, at its off-host address and with its own width and height;
    - `private`, `temporary` and an unregistered scheme listed in the setting give nothing and do not throw;
    - a declared file in unpublished media gives nothing.
- [ ] 1.2 In `fileArray()`, put the public base's scheme in front of an address that starts with `//`, then apply the existing `isHttpUrl` rule. Prove it with a `ResolverTest` case using a test `hook_file_url_alter` that returns `//cdn.example.com/...`: the head's `og:image` and `describe()`'s thumbnail are `https://cdn.example.com/...`.
- [ ] 1.3 Make a linked image whose file isn't public read `hidden` with a reason, not `empty`. Prove it with a `ResolverTest::testLinkedValues()` case on `temporary://`: the link gives `['hidden', NULL]`, `sourceRows()` shows status `hidden` with reason `not-public`, and the default image is used; a private file gives reason `private`.
- [ ] 1.4 Add a `BoundaryTest` case that fails when a PHP file other than `Resolver` calls `StreamWrapperManager::getScheme(`. Include a negative control.
- [ ] 1.5 Set `image.hidden` in `facts()` to a reason (`private`, `unpublished`, `translation` or `not-public`) when a page's own image exists but can't be shared. Show it in the image field ("Not used in link previews: the image is in private files · using …" and the other three), and in the linked box ("Private file: not shared" for a file reason; "Hidden from visitors" stays for access denials). Prove it with:
  - `ResolverTest` assertions: each reason, and no `hidden` for a public image;
  - `model.test.ts` cases for each sentence with each fallback, and a `Value` render case for the linked box.
- [ ] 1.6 Add the check `image-hidden` with the reason in its title: to improve when links show no image and an editor can act; good to know otherwise, with "Ask a site administrator" when the reason is the type's file system and no public image type exists. Suppress "Add a social image" beside it. Prove it with `checks.test.ts` cases for both levels, the administrator line and the suppression.
- [ ] 1.7 Filter the picker in its query: `ApiController::media()` keeps only image media types whose source field storage `uri_scheme` passes `isPublic()`, through one helper shared with the status row; `describe()` stays the per-file guard. Give the empty state "No images found. Only published images stored in public files are listed. To use a new image, add it to the media library first." Prove it with `ApiTest` cases: GET media lists a declared-scheme image and leaves out an undeclared one; with the 25 newest image media in a private type and one older public image, the public image is on page 0. Add a vitest render case for the empty state.
- [ ] 1.8 Add the status report information row "Images not used in link previews". It lists every image media type whose storage scheme fails `isPublic()`, private types worded neutrally, and names `file_additional_public_schemes` for the others. Make `runtimeRequirements()` merge rows instead of returning early (design D8). Prove it with an `InstallTest` case: the row lists a `dummy-remote` type, goes away once that scheme is declared, lists a private type neutrally, and appears alongside the headless row.
- [ ] 1.9 Give `image()` a required `$langcode`, and pass the entity's language from the value closure and from the logo. In `mediaImage()` and `label()`, use `EntityRepositoryInterface::getTranslationFromContext()`, and delete `translated()`. Pass the target's language to `describe()` and `describeMedia()`. Add `config:configurable_language_list` when the picked translation is a fallback.
  - Prove it with a new `ResolverTest::testMediaFollowsThePageLanguage()`, with en, fr and de and a translated media item used as the social image, the default image and the logo:
    - the French alt and logo on the French page;
    - English on a German page, with the tag;
    - the French alt on the German page once French outweighs English;
    - an unpublished French translation falls through the chain with reason `translation`;
    - `{media}` in a schema prop gives the French alt.
  - Add one French `og:image:alt` assertion each to `CoupledHeadTest::testPage()` and `HeadlessHeadTest::testPublishedPage()`, and an `ApiTest` case: the French page's state describes the image with the French alt.
- [ ] 1.10 Add an empty post-update, "Use the page language and every public file system for images in heads". Prove it with a `PostUpdateTest` case asserting that it is registered and runs.
- [ ] 1.11 Browser check on site-4, with a French language and a French alt text added to the Pricing hero:
  - the French page's head and Social tab carry the French alt;
  - an image moved to private files shows "Not used in link previews: the image is in private files · using the site default" and the `image-hidden` check;
  - the picker's empty state;
  - the status report's "Images not used in link previews" row.

  Revert the site afterwards and attach screenshots.

## 2. Canvas seams (G1, G2)

- [ ] 2.1 Add the test module `canvas_metatag_race_test`. Its `hook_form_canvas_page_form_alter()`, guarded by a state flag, calls `ApiController::putPage()` once, from inside Canvas's layout POST. Add these tests and commit them first, failing:
  - `PageDraftTest::testWriteDuringEditorSave`: the draft holds the new title and the dialog's value, with no conflict;
  - `TemplateDraftTest::testWriteDuringEditorSave`: a stale-object replay of the layout POST;
  - `PageDraftTest::testPublishToggleDuringWrite`: a stale-object replay of the publish toggle.

  These run in one process with one lock id, so they prove the copy-over, not mutual exclusion (2.3 covers that).
- [ ] 2.2 Add `CanvasMetatagServiceProvider` with the guarded class swap in `alter()` (design D1), and `SeoAutoSaveManager`. Prove it with a unit `ServiceProviderTest`: the class is swapped for plain Canvas, and not swapped when the class is already another one, when it is final, or when `saveEntity()` has another signature (fixture classes).
- [ ] 2.3 Add `Drafts` (`write()`, `asGiven()`, `keep()`), marked `@api`, with the per-key depth counter, the explicit 10-second expiry and the written-out acquire loop (design D1). Route `putDraft()` through `write()`, map `Busy` to 409 `busy` with `Retry-After: 1`, and wrap the uninstall and post-update draft saves in `asGiven()`, keeping uninstall's order of read draft, store template, write draft back.
  - Add a `SeedsDrafts` test trait whose `seedDraft($entity, $client)` wraps `asGiven()`, and move every kernel seed that calls `saveEntity()` with a module value onto it. The checklist is `grep -rn 'saveEntity(' tests/`, including ApiTest, HeadlessHeadTest, PageDraftTest, ResolverTest, InstallTest, PostUpdateTest and `tests/src/Fixture/ComplexContent.php`.
  - Prove it with:
    - 2.1 turning green;
    - `PageDraftTest::testCanvasFirstSaveTakesTheStoredValue`, which includes a draft-only translation with no entry;
    - `PageDraftTest::testOtherCodeKeepsTheValue`: a bare `saveEntity()` with another module value keeps the latest one;
    - unit `DraftsTest` with a fake lock: contention answers `Busy` and writes nothing; a nested `keep()` inside `write()` does not release the outer lock; an expired holder is broken; `keep()` goes ahead unlocked after 5 seconds;
    - `PageDraftTest::testBusy`, with a stub lock: the PUT answers 409 `busy` with `Retry-After`, and a layout POST answers 200 and keeps the value;
    - the existing `testWritingTheStoredValueBackDeletesTheDraft`, `InstallTest::testUninstallAndReinstall` and `PostUpdateTest`, green on the trait.
  - Measure the added cost per Canvas save on a page with a large component tree, and record it in the merge request.
- [ ] 2.4 Route `make-the-module-agent-ready`'s live write, which applies the same patch to the draft, through `Drafts::write()`. For templates, read the draft, store, then write it back inside `asGiven()`. Move its `draft_in_use` owner check inside the `write()` closure. Add the client-id note to its interplay text (design D1). Prove it with that change's command kernel test, plus two cases: a `set --to=live` during a stale-object editor save keeps both changes, and a template live write that only changes the label does not release the lock early.
- [ ] 2.5 Add the status report warning "SEO values in Canvas drafts" when the injected manager is not a `SeoAutoSaveManager`. Prove it with `InstallTest::testDraftProtectionRequirement`: silent normally, and the warning when the container holds a plain `AutoSaveManager`, while a dialog write is still stored.
- [ ] 2.6 Simplify the client's `saveDraft()` to one PUT confirmed by its answer. Delete `DraftIO.whenIdle`, `quiet`, `host.whenIdle()`, `host.quiet()`, the `failed` result and the reads of `canvasLayoutRequestInProgress` and `canvasLayoutRequestComplete`. On `busy`, retry once after a second without a message; a second `busy` shows the existing failed line. When the follow-up state shows no draft and live values that differ at the written paths, write once more; a second time shows the `unstored` strip.
  - Prove it with vitest: delete the `model.test.ts` cases "written again" and "five overwritten writes", and add "one write, confirmed by its answer", "busy, then 200: no message", "busy twice: failed line" and "a write a publish took away is written once more". Delete the `host.test.ts` idle and quiet cases.
  - Keep the store-actions half of `host-contract.spec.ts`. The existing `page.spec.ts` "rapid edits" test must still pass unchanged.
- [ ] 2.7 Replace `HeadlessContentController` with `src/EventSubscriber/HeadlessHead.php` (design D3), registered from `CanvasMetatagServiceProvider::register()` only with `canvas_headless`. It checks `isMainRequest()` and reads the cache header through `DynamicPageCacheSubscriber::HEADER`. Remove the services.yml entry, and the class resolver from the hooks.
  - Prove it with `HeadlessHeadTest`, where every existing assertion stays:
    - `testOtherRoutesAreUntouched` reworked to call Canvas's controller and then dispatch a `ResponseEvent`;
    - a new `testIndependentOfTheController`: a route enhancer at -2000 sends the request to a renamed controller, and the head is still the module's, with nothing logged and `config:canvas_metatag.site` on the response;
    - a Dynamic Page Cache MISS then HIT with the resolver forced to throw before the hit, with no error logged;
    - a sub-request is left alone.
  - `InstallTest::testContainerBuildsWithoutHeadless` asserts the subscriber is absent, then present after installing `canvas_headless`.
- [ ] 2.8 Rewrite the headless status row on `HeadlessHead::CONTRACT`, a constant checked once per request. It reports an error naming the missing member or the missing listener, with "Update SEO for Canvas. Until then the content API sends Canvas's own head, without SEO values." Add `hook_rebuild()` logging one error when a member is missing. Prove it with:
  - `InstallTest` cases: silent on real Canvas, and an error after `removeSubscriber()`;
  - a unit case with a contract list naming `CanvasContentRoute::noSuchMethod`, and a kernel case that a rebuild logs exactly one error for it.
- [ ] 2.9 Add an empty post-update, "Protect SEO values in Canvas drafts and set the headless head on the response", so `drush updb` rebuilds the container. Prove it with a `PostUpdateTest` case.
- [ ] 2.10 Run `tests/e2e` `host-contract`, `coupled` and `headless` in Chromium on site-4. They must pass.
- [ ] 2.11 Browser check on site-4:
  - Type in Page data and in the dialog's title in turns. Both values survive a reload, and "Review changes" lists the page once.
  - Close the dialog mid-edit; the value is in the draft.
  - Type a title and publish at once; the title is published or listed in "Review changes".
  - Open a headless preview with a token; the head is the module's.
  - The status report shows none of the new error or warning rows.

  Attach screenshots.

## 3. Configuration overrides (G6)

- [ ] 3.1 Add `Overrides::pinned()` (design D6), and replace `make-the-module-agent-ready`'s site-only override check with it. In `templateContext()`, replace each pinned path in `values` with the stored value read through `getEditable()`. Prove it with `ApiTest` cases:
  - a template `settings.php` override gives `target.overridden`, while `target.values` stays as stored, with and without a draft that holds the override, and `resolved` uses the override;
  - a site override of noindex and `identity.name` gives `site.overridden` with both paths;
  - a pinned `schema.type` pins its props;
  - a test-only `config.factory.override` service in `canvas_metatag_test` is pinned;
  - an override of an empty map pins nothing.

  Replace the two blocks "edited as stored".
- [ ] 3.2 Refuse writes that change a pinned path, compared with the stored value: 422 `invalid` with "This is set in site configuration outside SEO. Change it there, or remove the override first.", and the field code `overridden` with the same sentence on the command line. Prove it with:
  - `ApiTest` PUT template and PUT site cases: a changed pinned path is refused, and sending the stored value back answers 200 with storage untouched;
  - a command kernel case: `set` is refused at `/title_end`, and `check` of the template lists `overridden`.
- [ ] 3.3 Start the module's template drafts override-free and keep stored values at pinned paths (design D2); let `keep()` take the module's value from Canvas's compare copy when there is no draft. Lay pinned values over a template draft in `Resolver::layers()`. Prove it with `TemplateDraftTest` cases:
  - with an override and a draft, `resolve($node, TRUE)` uses the override;
  - a dialog write of the description under an override of the ending and of the template's `status` makes a draft that holds the stored ending and the stored status;
  - an unchanged editor round trip under an override leaves no draft.
- [ ] 3.4 Add the `content_template_presave` guard, reading "stored" through `getEditable()` and "effective" through `ConfigFactory::get()` (design D6). Prove it with `TemplateDraftTest` cases, committed first and failing:
  - under an override, the entity's original holds the override (the reason the guard does not read it);
  - with an override active, a layout save of the template loaded with overrides, followed by a publish, leaves the stored value unchanged;
  - a deliberate third value saved through the entity is stored;
  - a config import of another value is stored.
- [ ] 3.5 Ignore null members in `Values::value()`. Prove it with `ValuesTest`: `{fact: NULL, text: 'X'}` cleans to `{text: 'X'}`, and add a `ResolverTest` case for a `settings.php` override that turns a linked title into text.
- [ ] 3.6 In the client:
  - add `overridden` to the types;
  - lay overridden values over the layers in `view()`;
  - add `source()` `'config'`;
  - keep pinned paths in `tidy()`; drop unsent pinned edits on load and say so once in the offer strip;
  - lock fully pinned fields in Field and SiteTab, with the aside visible at rest, and the next-step sentence for users with the `site` access flag;
  - hide fixes whose patch touches a pinned path;
  - make `hiddenBy: 'config'` read the site's `overridden`.

  Prove it with vitest:
  - `model.test.ts`: cascade, source, `tidy()`, the dropped edit and its strip text, no client and server text difference;
  - `checks.test.ts`: no fix offered at a pinned path;
  - `Field` render cases for the locked state with and without the next-step sentence.
- [ ] 3.7 Add an empty post-update, "Keep configuration overrides out of stored SEO settings", so the attribute hook is compiled in. Prove it with a `PostUpdateTest` case.
- [ ] 3.8 Add e2e cases in `template.spec.ts` and `site.spec.ts`. The setup appends one `$config` line to the test site's `settings.php`. Assert:
  - the locked field, the aside text and the preview text;
  - that moving a component in Canvas and publishing keeps the stored value, read without overrides.
- [ ] 3.9 Browser check on site-4, with a temporary `settings.php` override of the Article ending and of the site's noindex:
  - the locked ending reads "Staging" in the field, the previews and Output;
  - Site's "Hide from search engines" is locked on;
  - a layout publish leaves `drush cget` (without overrides) unchanged.

  Remove the override afterwards and attach screenshots.

## 4. Values' language (G8, product side)

- [ ] 4.1 Probe translation editing on site-4 (design D7): under path prefixes, with the editor's `?language=` parameter, and under domain negotiation, open the editor for About in Finnish. Record which translation the dialog edits, the auto-save key, and whether `editorToken()` finds a token. If the lookup misses the language, fix it with a vitest case. Record the outcome in the merge request.
- [ ] 4.2 Put `lang` on every element that has `dir="auto"` for a value, and `<bdi>` around language names in the header. Prove it with vitest render cases for page scope on an Arabic page (`lang="ar"` on the title input and the search preview's title, none on the label), template and site scope, and `npm run verify`.
- [ ] 4.3 Browser check on site-4: an Arabic page in the dialog (right-to-left previews, `lang` in the inspector) and a Finnish translation's head. Attach screenshots.

## 5. Documents

- [ ] 5.1 Rewrite README "Known limitations". The proof is the README diff in the merge request, read against this list.
  - G1 becomes: "A change that reaches the server while Canvas is publishing or discarding the same page is not published. The dialog writes it again into a new draft; a command-line write reports it. Canvas has no way yet to make the two one step."
  - G2 becomes: "The headless head reads a few Canvas internals (see "Headless delivery"). After a Canvas update, the status report and the log say when one is gone, and the content API then answers with Canvas's own head, without SEO values."
  - G3 and G5 are deleted.
  - G6 becomes: "Under a configuration override of a content template, Canvas's publish can store other overridden template properties, such as its status. The module keeps its own setting as stored. Editing a template under an override of its SEO setting leaves a draft in "Review changes"."
  - G4 and G7 stay as `serve-each-frontend-its-own-addresses` left them.
  - The "no content yet" line stays.
  - G8 stays as it is until `test-in-every-engine-and-language` lands; add the probe's sentence if the browser edits only the default language.
- [ ] 5.2 Update the rest of the README:
  - Deployment: declaring a file system public and its cache rebuild; protocol-relative file addresses; overrides shown locked; the null-member recipe; module overrides that vary by host; language overrides of the module's settings are not supported; lists merged item by item; "run database updates" after each update.
  - Translations: media text follows the page language; how an editor edits a translation's SEO, from 4.1.
  - Developer notes: write the SEO value into a draft only through `Drafts`.
  - Notes for Canvas: the response subscriber.
- [ ] 5.3 Update ARCHITECTURE:
  - section 9: the race direction, "Canvas's saves keep the value", the lock and its depth counter, `asGiven()`, the two draft starting points, configuration overrides;
  - section 11:
    - rows: add `AutoSaveManager`, the published response fields and Dynamic Page Cache; remove `canvasLayoutRequestInProgress` and the controller;
    - UPSTREAM asks 1 and 3 rewritten, and ask 8 added;
  - section 12: rewritten;
  - section 13: the language-list tag and the template config in `layers()`;
  - section 14: media in the page language, image reasons, the picker's type filter;
  - the API table: `overridden`, 422, 409 `busy` and `Retry-After`;
  - the test table;
  - sections 17 to 19 and "Known limitations and non-goals".

  Move the `UPSTREAM(canvas)` markers into the new classes.
- [ ] 5.4 Update `openspec/design-system.md` (the source word, the locked field's aside at rest and its next-step sentence, image reasons) and `openspec/decisions.md` (item 15: this change, landing last, plus the product owner's answers to the proposal's open decisions, and the follow-up change queued after it).
- [ ] 5.5 Re-read the four drafts in `upstream/` against the code as built. Correct names and line references, and keep "Draft — not posted" on each. Do not post them.
- [ ] 5.6 Run cspell on the changed files.

## 6. Verification

- [ ] 6.1 Rebase every MODIFIED block on the text that landed: link-values-to-fields, strengthen-zero-config-defaults and make-the-module-agent-ready. Run `openspec validate close-known-limitations --strict` and check each requirement body is under 500 characters.
- [ ] 6.2 Run the whole PHPUnit suite (kernel and unit), the "phpunit (canvas dev)" job, vitest, `npm run verify`, and every Playwright suite in Chromium, on site-4, one at a time. All must pass, and the extension build must be current.
- [ ] 6.3 Final browser pass on site-4 across all phases. Revert every temporary override, language and file move, and end with `farm-env.sh preview`.
