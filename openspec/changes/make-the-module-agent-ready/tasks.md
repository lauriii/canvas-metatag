# Tasks

Needs every queued change archived (proposal.md, "Dependencies"). The module
stays working at the end of every group. PHPUnit runs through the farm's
`docker exec` line with SQLite; Playwright runs one spec at a time. No group
changes the dialog, so no screenshots are needed; group 7 proves the dialog is
unchanged. Command tests use Symfony's `CommandTester` in kernel tests; one
functional test runs real Drush.

## 1. Spikes (answers recorded in design.md before group 4)

- [ ] 1.1 Canvas auto-save: an entry's owner and last change can be read, and a write under a per-run client id with the server-read entry passes Canvas's rule and records the acting account as owner. Verify with a kernel test against the pinned Canvas version.
- [ ] 1.2 `ConfigEvents::IMPORT_VALIDATE` errors stop `drush config:import` before any write, also for config entities of other modules. Verify with a kernel test that imports a changed template with a logged error and finds the active storage unchanged.
- [ ] 1.3 `PreExportEvent::setCallback('canvas_metatag', …)` can add media dependencies, and `content:export --with-dependencies` follows them. Verify with a kernel test exporting a page with a social image.
- [ ] 1.4 Canvas's command-line tool: does a push ever delete and re-create a content template, and does page sync keep or clear the `canvas_metatag` field? Verify by reading the tool's push and page-sync code at the pinned Canvas version and with one push of a fixture template on a throwaway site; record the answer and the README line it needs.

Drush command discovery needs no spike: Drush's `WorkspacePublishCommand` (13.7) is an `#[AsCommand]` class with `AutowireTrait`; task 5.1's smoke test pins it.

## 2. Coded problems, dropped values, handles (server, no visible change)

- [ ] 2.1 `Values::clean()` and `cleanIdentity()` return `Problem` objects (`code`, `path`, `allowed`, `min`, `max`, `max_length`) with the closed code list of design.md decision 6, `form` included; `ApiController` maps them to today's sentences and `error_paths`. Verify with `ValuesTest` (one row per code with its limits; `schema.type` "Prodcut" gives `choice` with every page type; a bare string gives `form`) and `ApiTest` (every refusal body byte-identical to before).
- [ ] 2.2 `Resolver::resolve()` keeps read-mode problems in the report's `dropped` for every key. Verify with `ResolverTest::testDroppedEverywhere` (the probe's six invalid stored values in reference.md, each listed with their code; delivery's head unchanged) and `DeliveryPathTest` still green.
- [ ] 2.3 `Sources::vocabulary()` gives each row a unique handle (`field`, `field:property`, `field.ref_field`), and the shorthand resolves exactly those. Verify with a kernel `SourcesHandleTest` (`field_summary` for text; `field_body:summary` differs from `field_body`; `field_writer.name` equals the link menu's source; `field_summary` refused for an image with the image handles listed; every row's handle round-trips).

## 3. Configuration as code

- [ ] 3.1 Schema: per-scope value types (`canvas_metatag.values.site|template|page`), `FullyValidatable` on `canvas_metatag.site` with `requiredKey: false` where optional, covering every key the queued changes added. Verify with a kernel `ConfigSchemaTest` (installed config and every fixture's config validate; `values.description` at site scope is a violation).
- [ ] 3.2 `CanvasMetatagValues` constraint (option `scope`) on the per-scope types, the identity, the `component_mapping` entity and the page base field, delegating to the cleaners in write mode with reference checks off. Verify with a kernel `ValidationTest` (malformed fact, bad literal, out-of-range robots, malformed source and custom JSON-LD each a violation at its path; a deleted media UUID and a deleted field are not; a recipe setting `values.description` fails; default content with a `javascript:` canonical throws `InvalidEntityException`; the template-seo "unusual text" and "broken link" publishes still succeed).
- [ ] 3.3 `IMPORT_VALIDATE` subscriber using `TypedConfigManager::createFromNameAndData()->validate()` for `canvas_metatag.site`, changed templates' third-party settings and component mappings, with a `@todo` for core. Verify with a kernel `ConfigImportTest` (a 5000 snippet limit in a template refuses the import naming configuration and path; active configuration unchanged; a valid change imports).
- [ ] 3.4 `setCanvasMetatag` config action on `canvas_metatag.site` and `canvas.content_template.node.*.full`: merge patch, write-mode validation, the hand-writable forms of design.md decision 10. Verify with a kernel `ConfigActionTest` (the design.md decision 9 recipe applies; a wildcard over two types; JSON-LD given as a YAML mapping is stored as pretty-printed text; a refused value fails the recipe with path and message; other values kept).
- [ ] 3.5 Export callback and media dependencies (only if 1.3 passed; otherwise drop the requirement from the configuration-as-code delta before archiving). Verify with a kernel `ContentExportTest` (the social image and its file are in the export; a re-import on a clean install shows the image in the head).

## 4. The service

- [ ] 4.1 `Target::parse()`: every form of design.md decision 2, `--langcode`, `--preview`; `not_found` (with a hint for `node.12`), `not_owned`; `head: null` for a template without nodes and a never-published page. Verify with a kernel `TargetTest` (alias, prefixed French path, a view path, a foreign host, a node type without a full template, the configuration name, a component mapping).
- [ ] 4.2 Accounts and base: administrator by default through `AdminAccountSwitcher`, switched back in `finally`; `--as=<user name>` with the access of seo-access; `not_found` and `forbidden` for unknown and blocked names; `base_unknown` when the base comes from a `default` request host. Verify with a kernel `OperationsAccessTest` (each seo-access and command-line scenario, the draft-only translation, the account restored after an exception, a run without a URI).
- [ ] 4.3 `Checks` service and `data/checks.json`. Server rules: `title-empty`, `title-site-twice`, `title-generic`, `description-missing`, `description-title`, `canonical-elsewhere`, `noindex`, `noindex-canonical`, `snippet-off`, `image-missing`, `image-small`, `image-ratio`, `image-format`, `image-heavy`, `image-preview`, `image-alt`, `schema-recommended`, `identity-incomplete`, the queued changes' rules by the same test (inputs on the server), and the command-line rules of decision 11. Editor rules: `title-long`, `description-long`, `title-heading`, `img-alt`, `content-unavailable`, and any rule that reads the preview. Verify with a unit `ChecksTest` over `tests/fixtures/checks/*.json`, `checks.test.ts` over the same files, and `ChecksListTest` (fails on any id either side emits that the file does not list).
- [ ] 4.4 `Operations::describe()`: rows per target kind with forms, limits, allowed values, inheritance and an example; `default_to`; `--type`; `--bundle` handles; `--media=<search>` capped with `truncated`; check ids; `docs` with the absolute README path. Verify with a kernel `DescribeTest` (rows match `Values` for every scope and the identity; every registry type and detail present; every example passes `set --dry-run`; `--bundle=article` order equals the link menu's; `--media` honours media access and public files).
- [ ] 4.5 `Operations::inspect()`: values in the hand-writable form, page description included, `inherited` by pointer with `from`, head in the headless shape, issues with `from` and `{target, patch}` fixes, `not_checked`, `--draft`. Verify with a kernel `InspectTest` (head equal to `CoupledHeadTest`'s and `HeadlessHeadTest`'s for the same page; `from` for each layer, settings.php included; a pasted `</script>` in JSON-LD escaped in `head.script` and in the delivered HTML).
- [ ] 4.6 `Operations::check()`: targets, `--all` in batches with the report cache keyed by public base, templates over their published nodes with `count` and `examples`, `--fail-on`, only targets with issues, `not_checked` once. Verify with a kernel `CheckTest` (exit semantics; a teaser template with values; a deleted logo; an Event node with no date counted under `node.event`; `--all` over the complex fixture) and `CheckBatchTest` (a bounded number of entities in memory at 2,000 pages; a second run served from the cache).
- [ ] 4.7 `Operations::set()`: merge patch, type change dropping details, hand-writable forms, write-mode validation with carried values; `--to` with the per-kind default; draft writes through `putDraft()` with the server-read entry, a per-run client id and `draft_in_use`; live writes with revision user and log, the same patch applied to the account's draft and an equal draft removed; site writes; `changed: false`; `--dry-run`. Verify with kernel `SetTest` (every command-line `set` scenario; the probe's title-only write keeps the Product type) and `SetDraftTest` (the draft-writes delta: another owner's draft refused and untouched, an editor's next save in conflict, leaving one's own draft with `--to=live`).
- [ ] 4.8 Round trip and contract. Verify with `ContractTest`: every document from the kernel tests of this group validates against `docs/cli.schema.json` (draft-07, core's validator), a removed member fails, and for every fixture target `inspect`'s values sent back with `set --dry-run` give `changed: false`.

## 5. Commands

- [ ] 5.1 `DescribeCommand`, `InspectCommand`, `CheckCommand`, `SetCommand` in `src/Drush/Commands/` with `AutowireTrait` and `FormatterTrait` (JSON by default): options, `@file` relative to the caller's directory and `-` input, notices on stderr, exit codes, one-line descriptions naming SEO, help with three examples and the README section. Verify with kernel `CommandTest` (`CommandTester`: each command's exit code for success, refusal and misuse; stdout parses as one document; `set` without values exits 2) and a functional `DrushSmokeTest` (`drush list --filter=canvas-metatag` lists five commands; one `inspect` runs).
- [ ] 5.2 The queued `canvas-metatag:vocabulary` adopts the envelope and exit codes. Verify with `CommandTest::testVocabulary` (an offline run exits 2 with a coded error; the help names the README section).
- [ ] 5.3 Composer suggests `drush/drush` 13.7 or later and requires it for development. Verify with `composer validate`.

## 6. Docs

- [ ] 6.1 README "Set up and verify from the command line": the ten-line model, the paste-in block, the seven jobs leading with `@file`, the three field-link forms in one table, the write destinations and the template-draft warning on configuration import, identity media as recipe content, `--uri` and the project's Drush wrapper, empty stdout, "run `check --all` after updating", and the answers of 1.4; "Deployment" points to it. Verify with a functional `ReadmeExamplesTest` (every `drush canvas-metatag:` line runs with the expected exit code on the fixture site with placeholders substituted, every recipe snippet applies, every JSON example validates) and the cspell CI job.
- [ ] 6.2 `canvas_metatag.api.php` "Stable surface": the JSON contract (version 1), `setCanvasMetatag`, the configuration schema; command-line access is emulation, not a boundary. `@internal` on the new classes. Verify with the cspell CI job.
- [ ] 6.3 ARCHITECTURE.md: the command-line contract, the shape/reference rule, the check classification, tests, where to change what. Verify with the cspell CI job.

## 7. The farm site

- [ ] 7.1 Run every suite: PHPUnit (unit, kernel, functional), vitest, `npm run verify`, Playwright one spec at a time. Verify all are green, the dialog's specs unchanged.
- [ ] 7.2 On the farm site, as a terminal user: `describe`, `inspect` of the home page and of `node.article`, `check --all`, `set --dry-run` and a draft `set` on a throwaway page titled "agent-dx-probe …", then delete it; once without `--uri` to see `base_unknown`. Verify every document against the schema and record commands, exit codes and the `check --all` wall time in the change's `acceptance.md`.

## 8. Acceptance: a fresh agent completes the probe's seven jobs

- [ ] 8.1 On a throwaway farm site with Canvas, this module and a few pages, give a coding agent with no prior context only the module's directory and the seven jobs of the probe: (1) find out what the module does and how it is configured; (2) set the site identity and default image; (3) set the Article type's title ending, description from the summary field and a BlogPosting type; (4) set a page's title, description, social image and a Product with a price, and read its head; (5) find out whether the page passes the checks and fix what is to fix; (6) add hand-written structured data copied from a public example; (7) make the setup reproducible on another environment. Verify that every job completes with no browser, no cookie session, no `php:eval` and no reading of `src/` or `extension/`; that every refusal is recovered on the next command from its message and `next`; and that the second environment's `check --all` exits 0.
- [ ] 8.2 Record the run in `acceptance.md`: per job the commands, refusals and recoveries, command count and time, against the probe's baseline in reference.md (two jobs needing the dialog's internals, one impossible). Any job that misses the pass mark reopens the task that caused it.

## Workflow follow-up

- Archive last, after `describe-the-publisher`.
- A later change moves the dialog to the server's issues for the server rules and deletes their TypeScript twins.
