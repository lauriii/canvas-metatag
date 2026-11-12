# Tasks

The module stays working at the end of every group. Run PHPUnit through the
farm's `docker exec` line and Playwright one spec at a time. Groups 1–5 are the
fallback and need no Canvas source code; group 5 is the gate where the product
owner's decision (proposal.md, "Open decisions" 1) is taken. Groups 6–8 are the
full plan.

## 1. Facts beside tokens (no visible change)

- [ ] 1.1 Extract `Resolver::facts()` from `tokens()`: the eight facts with label, value, `image` for Image and `via` (the field label a heuristic used); the separator as `separator()`. `tokens()` calls it. Verify with a new `ResolverTest::testFacts` (values, `via`, anonymous access, cacheability) while `testTokens` still passes.
- [ ] 1.2 Add `facts` and `separator` to `GET /state` next to `tokens`, for page, template and site without a page. Verify in `ApiTest::testPageState`, `testTemplateState` and `testSite`.
- [ ] 1.3 Make the client read `facts` and `separator` instead of `tokens` for the site name, page address and separator (`types.ts`, header, Site and Search tabs, previews, the identity check). Verify with `npm run verify` and Playwright `page.spec.ts` and `site.spec.ts`, unchanged and green.

## 2. Converter for stored values (pure; not run yet)

- [ ] 2.1 Add `src/Legacy.php` (`@internal`): `convert(array $old, string $scope, array $fieldMap, ?array $siteEnd)` returns the new values and log lines, as the Migration Plan in design.md describes, with `{field: NAME}` for whole field values. It holds the only copy of the old brace pattern. Verify with a new unit `LegacyTest`: every conversion rule, the farm site's seven stored values, and the composites `{title} by {field.field_byline}`, `{field.field_byline}: {title}`, `{title}, oak` and `Never published: {title}`, each with its log line.

## 3. Typed and linked values, end to end (one unit)

The tasks of this group land together: the stored format, the server, the
update and the dialog change at once.

- [ ] 3.1 Config: add the `canvas_metatag.value` mapping type (text, fact with a choice constraint, media, field) to `canvas_metatag.schema.yml`; make `title`, `title_end`, `description` and the social values use it and `schema.props` a sequence of it; drop `values.title` from `config/install/canvas_metatag.site.yml`; turn every `data/schema-types.json` default into `{"fact": …}`. Verify with `InstallTest` (a fresh install titles "Pricing" as "Pricing | Example") and the config schema checks in `TemplateDraftTest`.
- [ ] 3.2 `Values`: keys with `title_end` (site: `title_end`, `robots`); one-key `value()` checks by kind and scope with the `$accepts` closure and the refusal sentences of the dynamic-values delta; `canon()` keeps `title_end: {text: ''}`; `cascade()` takes `title_end` from the target, else the site; `texts($effective, $value, $sep)` joins the two parts and drops an empty one; `fill()` becomes private `fillFacts()` for custom JSON-LD (fixed names only); delete `trimSeparators()` and the token branches. Verify with `ValuesTest` and the rewritten shared fixture `tests/fixtures/text-cases.json`.
- [ ] 3.3 `SchemaGraph::build()` resolves stored details and registry defaults through the `$value` closure; `validLiteral()` loses the image-token branch; custom JSON-LD uses `fillFacts()`. Verify with `SchemaGraphTest` and `tests/fixtures/graphs/*.json` rewritten as Values, including a custom node with `{field.field_byline}` kept as text.
- [ ] 3.4 `Resolver`: the `$value` closure (text, fact, media, field) memoised per `resolve()`; `{field: NAME}` read by the existing `fieldValue()` with anonymous field access, giving ok, empty, hidden or broken; empty, hidden and broken give the default; the image chain is the social image, the Image fact, the site default; the Title fact's label becomes "Title". Keep `entity_field_info` and `config:media_type_list` on node heads (design decision 10). Verify with a new `ResolverTest::testLinkedValues` (description from Summary, empty summary, social image from a field, a hidden field, a deleted field, no per-user context on a published head), `testHead` and `testCacheabilityAndDraft` on Value literals, `CoupledHeadTest` and `HeadlessHeadTest`.
- [ ] 3.5 `ApiController`: the state drops `tokens` and adds `sources` (template: the type's fields as one level, keyed `field:<name>`, with the previewed node's values and hidden entries marked) and `unknown` (`missing`, `kind`, `error`); a page gets `sources: []`; writes pass the template's field check, page and site refuse links; the media list reads `{media}`; the carry-forward is unchanged. Verify with `ApiTest::testTemplateState`, `testPageState`, `testSite`, `testWritesFollowTheShownValues` (422 "Choose a field from the list.", a broken link sent back unchanged) and `TemplateDraftTest`, `PageDraftTest` on Values.
- [ ] 3.6 Add `canvas_metatag.post_update.php` with `canvas_metatag_post_update_values_as_parts` (batched; site settings; templates and drafts walked as `canvas_metatag_uninstall()` does; page revisions and translations through their tables, then a storage cache reset and `canvas_page_list` and `rendered` invalidation; page drafts; log lines without values, plus a line for custom JSON-LD that names a field). Verify with a new kernel `PostUpdateTest`: old values seeded in site settings, a template and its draft, two revisions × two translations and a page draft; asserts the converted values, the template draft's layout and client id, and the log lines.
- [ ] 3.7 Client model: `types.ts` gains `Value`, `title_end`, `facts`, `separator`, `sources`, `unknown`; new pure `values.ts` (`resolve`, `titleText`, `defaultOf`, `rowsFor`, `tagOf`, `sameValue`, `boxKey`); `model.ts` `texts()`, `cascade()`, `prune()` and `socialImage()` read Values; delete the brace, chip and seed helpers. Verify with a new `values.test.ts` and `model.test.ts` running the shared `text-cases.json` to the same output as PHP.
- [ ] 3.8 Dialog: new `LinkedValue`, `LinkMenu` (one level; row, filter and hint code moved from `TemplateInput.tsx`), `ValueControl` and `TitleControl`; a `link` slot in `Field`; the tabs, `MediaPicker` ("From each ‹Type›" from `sources`) and `Previews` (`.seo-part` per title part) rewired; the structured data "Field: …" select and the custom JSON-LD chip mirror removed (a plain textarea with the new sheet line); delete `TemplateInput.tsx` and the chip CSS; add the `--seo-link-*`, `--seo-default-*` and `--seo-broken-*` tokens. Verify with `npm run verify` and a rebuilt `extension/dist`.
- [ ] 3.9 Checks: delete `token-empty`; add `link-broken` (to fix, "Link another field") and `link-hidden` (to improve); the repeated site name fix sets "No ending" only for a typed main part; the long title detail names a lost ending; structured data rules read Values. Verify with `checks.test.ts`.
- [ ] 3.10 AI: a used title variant is stored as `{title: {text: …}}`; delete `Assistant::withoutBraces()` and its two call sites. Verify with `AssistantTest` (braces kept as text) and Playwright `ai.spec.ts` (stored title `{text: <variant>}`, ending inherited).
- [ ] 3.11 Playwright: update `constants.ts` and `fixture.ts`; `template.spec.ts` (link the description to Summary; ending "Use “Blog” as the ending"; unlink with Backspace and Undo; switch the previewed article; publish and check the head; delete a linked field and see the broken box and the Checks row); `page.spec.ts` (Title textbox and "Title ending" button; typing stores `{text}`; "No ending"; a date detail linked to "Last updated"); `site.spec.ts` (ending, "No ending", example line); `access.spec.ts` (read-only boxes). Verify each spec green, one at a time.
- [ ] 3.12 Docs: ARCHITECTURE.md §4–6 (value model, title parts, facts, field reading), §17 (new tests); README (the three scopes, title ending, linking); `canvas_metatag.api.php` (values are maps); `.cspell-project-words.txt`. Verify with the cspell and PHPCS CI jobs.
- [ ] 3.13 Browser check on the farm site after `drush updb`: "Every Article" Search, Social and Schema with linked, default, empty, hidden and broken boxes; the link menu; the ending menu; a page's title and date detail; Site's ending. Save screenshots of each.

## 4. Title suggestions know the ending

- [ ] 4.1 Needs `build-ai-on-drupal-ai` merged. `Suggest.tsx` sends `page.ending` (the separator and the resolved ending); `AiController` reads it and cuts it to 255; `Assistant` puts it on its own line of the user message and, for title requests, adds the ending rule to the fixed text after the Prompt Library prompt, beside `FENCE` and `SHAPE`; the system prompt stays free of request text. Verify with `AssistantTest` (ending in the user message, absent from the system prompt, cut at 255, no ending, the rule still present after the search prompt is set to "Say hello.") and `AiControllerTest` (accepted with and without it; a non-string ending is 400), and with `ShippedConfigTest` (the shipped search prompt does not contain the rule).
- [ ] 4.2 Verify with Playwright `ai.spec.ts` (the request carries the ending) and a browser check of title suggestions on the farm site, with a screenshot.

## 5. Fallback gate

Choosing the fallback means stopping after this group (see "Workflow
follow-up").

- [ ] 5.1 Run every suite: PHPUnit unit and kernel, the AI submodule's kernel tests, `npm run verify`, the `build-assets` check, and every Playwright project one at a time. Verify all are green.
- [ ] 5.2 README "Known limitations": fields are read one level deep, with today's field types; a hidden field gives the default. Verify the README matches the shipped dialog in the browser.
- [ ] 5.3 Record the product owner's decision in proposal.md ("Open decisions" 1). Verify the proposal names the chosen plan.

## 6. Canvas contract pinned (full plan; no caller yet)

- [ ] 6.1 Extend `SeoFixtureTrait`'s article bundle with `field_writer` (a reference to a `person` node type), `field_tags`, a media image reference, a datetime, a link and a decimal field. Verify existing kernel tests still pass.
- [ ] 6.2 Add `src/Sources.php` and its service: `vocabulary()` (suggester with the synthetic component description, exclusions, facts, image file-hop rewrite, merged kinds, labels and crumbs, cache with its tags), `previewRows()`, `evaluate()` (account rule, hidden and broken, normalisers), `accepts()`, `machineName()`. Verify with a new kernel `SourcesTest` in `@group canvas_metatag_canvas_contract`: vocabulary order and exclusions, the Author fact at the owner's position, date facts, "Tags › Name" as a list, the image rewrite byte for byte, a media image object, paths and crumbs (`[Writer, Name]`, crumb Person); a round-trip and evaluation per field type; statuses (hidden with no `user` or `user.permissions` context and with `config:user.role.anonymous`, an unpublished host as the current user, a deleted field, a wrong bundle and a malformed string as broken); `accepts()`; a second `vocabulary()` call that does not reach the suggester.
- [ ] 6.3 Add a unit `BoundaryTest`: no file under `src/` or `modules/` except `src/Sources.php` uses `Drupal\canvas\PropSource`, `Drupal\canvas\ShapeMatcher` or `Drupal\canvas\PropExpressions`. Verify it fails on a deliberate import, then passes.
- [ ] 6.4 Add the `phpunit (canvas dev)` job to `.gitlab-ci.yml`: it extends the PHPUnit job, requires `drupal/canvas:1.x-dev` and runs only `--group canvas_metatag_canvas_contract`; it is not allowed to fail; `composer.json` keeps `drupal/canvas: ^1.11`. Verify with a pipeline run, or `gitlab-ci-local`, showing the job green.
- [ ] 6.5 ARCHITECTURE.md §11: one row per new Canvas internal (design.md, "Canvas and AI internals relied on"), each naming its `SourcesTest` case. Verify every named test exists.

## 7. Fields become Canvas sources (full plan)

- [ ] 7.1 Add `canvas_metatag_post_update_fields_as_sources` (templates and their drafts; the first formatted text with a summary becomes the Description fact; else the first matching vocabulary row, one hop preferred; else dropped and logged). Verify with `PostUpdateTest`: both updates in a row give the farm site's expected values, drafts included.
- [ ] 7.2 `Values`: `source` replaces `field`; template writes are checked by `Sources::accepts()`; read mode keeps any well-shaped source. Verify with `ValuesTest` and `ApiTest::testWritesFollowTheShownValues` (a vocabulary source accepted, a crafted expression refused with "Choose a field from the list.", a broken source carried forward).
- [ ] 7.3 `Resolver` evaluates sources through `Sources::evaluate()`; delete `FIELD_TYPES`, `tokenTypes()`, the field loop, `fieldValue()`, `link()` (its URL logic moves into the address normaliser) and `referencesImageMedia()`; keep the head's field and media type tags. Verify with `ResolverTest::testLinkedValues` (plus Writer › Name, an unpublished preview node, a published head with no per-user context), `CoupledHeadTest` (page cache hit) and `HeadlessHeadTest`.
- [ ] 7.4 The state's `sources` come from `Sources::previewRows()` (multi-hop entries, crumbs, hidden entries kept) and `unknown` from the vocabulary. Verify with `ApiTest::testTemplateState`, including an unpublished preview node whose restricted field value is not sent to a user who may not view it.
- [ ] 7.5 `LinkMenu` levels: `tree()` in `values.ts`, the crumb row with "Back to ‹Type›", deep filter matches with their path, Right and Left arrows. Verify with `values.test.ts` (`tree`, deep matches) and Playwright `template.spec.ts` (author name linked to Writer › Name through a level).
- [ ] 7.6 Docs: README accepted regressions (a text list gives its key; a reference needs view access) and the unpublished preview gap; ARCHITECTURE.md §5–6 (the Canvas boundary). Verify with the cspell CI job.
- [ ] 7.7 Browser check on the farm site after `drush updb`: a level in the link menu, Writer › Name, a hidden entry, a broken link after deleting a field. Save screenshots of each.

## 8. Integration

- [ ] 8.1 Run every suite as in 5.1, plus the `phpunit (canvas dev)` job. Verify all are green and `extension/dist` matches a fresh build.

## Workflow follow-up

- If the product owner chooses the fallback: before archiving, remove from the
  deltas "A field link is stored as a Canvas field source", "Links can follow
  references", "Field links offer what Canvas offers" and "A node visitors
  cannot view yet is previewed with the editor's access" (dynamic-values) and
  "A reference opens as a level in the link menu" (value-links), then validate
  with `openspec validate link-values-to-fields --strict`. Then rewrite the two
  "Writer › Handle" scenarios of `add-advanced-meta-tags` (other-tags and
  seo-dialog) to a field of the type, since references are full plan only.
- Archive after `build-ai-on-drupal-ai` and before `add-advanced-meta-tags`,
  `expose-seo-to-canvas-ai` and `add-home-page-defaults`, whose deltas build
  on this change's text.
- At archive, rewrite the Purpose of `openspec/specs/dynamic-values/spec.md`
  for facts and links; it still speaks of dynamic values. Do the same for the
  Purpose of `openspec/specs/site-seo/spec.md`, which still names the title
  pattern.
- After 1.0, a separate change deletes `src/Legacy.php` and both post_updates.
- Ask Canvas upstream for a public service that suggests sources for a shape
  on a bundle, and add it to ARCHITECTURE.md's upstream asks.
