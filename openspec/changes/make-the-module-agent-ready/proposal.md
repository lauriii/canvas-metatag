# Proposal

## Why

The product owner: "We need to make sure that agentic workflows can use this
module easily", clarified as "outside AI, when a developer builds with a
coding agent". A developer builds a Canvas site and asks a coding agent in a
terminal (shell, files, perhaps a browser) to set up and verify SEO with this
module. The agent must discover what the module does, configure it as code,
set and read SEO for pages and templates, add structured data, and verify the
result without the editor UI, with feedback it can act on.

A probe on the farm site ran seven such jobs as an agent with only a shell.
Two could only be done by reverse-engineering the dialog, and one not at all:

- **Verifying is browser-only.** The checks run in the dialog's script and
  read the editor's preview. A shell can read the published HTML, but not why
  it looks that way or whether it passes.
- **Bad values vanish without a trace.** A page stored from code with six
  invalid values produced a "clean" head and a report that mentioned none of
  them. `drush config:set`, config import and recipes store a bad media id or
  a site-scope description without a word; the value just never shows.
- **There is no supported write path.** The draft API needs Canvas's internal
  auto-save data and the editor's client id (four tries, a 400 and a 409), and
  replaces every value: sending a title wiped the structured data. Saving the
  entity publishes at once and validates nothing.
- **Field links are not hand-writable.** A template value linked to a field
  is a Canvas expression with control-picture separators. Writing
  `field_summary` is refused with "Choose a field from the list."
- **Errors are dialog sentences** with no code and no allowed values, and
  nothing tells an agent where to start: no commands, no command-line
  section, no pointer to the type registry.

No SEO module in the ecosystem offers a "show me the resolved head and whether
it is valid" command, and there is no public structured data testing service
to call. The module's own resolver and checks are the only oracle an agent
can run, so exposing them is the highest-value change.

## What Changes

- **One command family, four verbs**, Drush commands that print one versioned
  JSON document (Drush's formatter, JSON by default):
  - `canvas-metatag:describe`: what can be written where. One row per
    writable path for each target kind (site, template, page), with its
    forms, limits, allowed values, inheritance and an example; the types and
    their details; a content type's linkable fields; images by search; check
    ids.
  - `canvas-metatag:inspect <target>`: the head visitors get (or the draft,
    with `--draft`), the target's own values in the form `set` takes, every
    inherited value with the layer it comes from, and the issues.
  - `canvas-metatag:check <target>… | --all`: the gate. Only targets with
    issues are listed, a template's issues are counted over its published
    nodes, and the run exits 1 at or above `--fail-on`.
  - `canvas-metatag:set <target> <json|@file|->`: a validated merge patch.
    Pages go to their Canvas draft and the site and templates are stored, by
    default; `--to` picks the other. `--dry-run` prints the result without
    writing it.
  The queued `canvas-metatag:vocabulary` joins the family's contract.
- **One service behind them** (`Operations`, internal), built on
  `Resolver::report()`, `Values` and the editor-version lookup.
- **Targets as developers know them:** `site`, `node.article` (or its
  configuration name), `canvas_page:3`, `node:12`, `component_mapping:<id>`,
  `/pricing` or a full address.
- **Administrator by default, an editor on request.** As core's default
  content import does, commands act as the administrator; `--as=<user name>`
  emulates an editor's access. The shell is trusted; this is fidelity, not a
  boundary.
- **Drafts are never taken over.** A command writes into a draft only when
  there is none or the acting account owns it; otherwise it names the owner.
  Storing a value also updates the account's own draft, so a later publish
  cannot undo it, and a draft that then matches the stored entity is removed.
- **Server-side checks** for every rule whose inputs are on the server, with
  the dialog's ids and severities, pinned by a shared fixture. Rules that read
  the preview or measure text are listed as not checked. Every stored value
  the output drops is an issue to fix.
- **Coded errors with one path syntax.** Every refusal has a code from a
  fixed list, a JSON Pointer into the `set` document, the allowed values or
  limits, and a next command that runs as printed. The dialog's sentences do
  not change.
- **Configuration that fails loudly.** `canvas_metatag.site` becomes fully
  validatable; one constraint guards site settings, template settings,
  component mappings and the page field; a configuration import that would
  store a bad shape is refused. A stale reference is reported, never refused.
- **A recipe config action**, `setCanvasMetatag`, taking what `set` takes.
- **Hand-writable values:** a field by the handle `describe` lists
  (`field_summary`, `field_body:summary`, `field_writer.name`), a media item
  by id, hand-added JSON-LD as a JSON value, a page's description; all stored
  in their canonical form and printed back so they round-trip.
- **Content export carries SEO media.**
- **One README section**, "Set up and verify from the command line": a
  ten-line model, a three-line block to paste into a project's agent
  instructions, then the seven jobs, every line run by a test.

## Out of scope

- AI inside Drupal (`expose-seo-to-canvas-ai`, the AI submodule).
- An HTTP API for agents, bearer tokens or a tool-protocol server. A protocol
  server can wrap the commands later.
- A module-level agent instruction file, an installable agent skill, and the
  proposed Drupal `.ai/docs` convention (open decision 3).
- Commands for the core `dr` runner (experimental, 11.4+; this module supports
  11.3). The logic sits in a service, so a twin is a few lines later.
- Writing component mappings from the command line (recipes and
  configuration create them; `check` and import validation guard them).
- Running the preview-based checks (main heading, image alt text, text not on
  the page, pixel-measured lengths) outside the editor (open decision 4).
- A second output format of our own, a report diff, PHP API stability
  promises, and code generators.
- Changes to the dialog, its state route or its error sentences.

Non-goals: none reopened. `set` takes one target per run and refuses nodes,
so it is neither bulk editing nor per-node overrides. `check --all` is
read-only.

## Dependencies and place in the queue

Run **last**, after `describe-the-publisher`. Validation, `describe` and the
checks must cover every key, shape and rule the queued changes add; doing that
once at the end is one pass over a settled model (open decision 5 covers
landing validation earlier).

- **Hard:** `link-values-to-fields` (value model, `Sources` and its
  vocabulary, behind the field handles), `rethink-structured-data`
  (`Resolver::report()`, `dropped`, verdicts), `extend-structured-data-by-id`
  (the vocabulary command, hand-added JSON-LD and its error paths).
- **Soft:** `expose-seo-to-canvas-ai` adds the base module's editor-version
  lookup; if it has not landed, this change adds that method and the AI change
  reuses it. `add-structured-data-diff-and-overview`'s per-entity report cache
  is reused by `check --all` when present.
- **Coverage only:** `populate-every-schema-type`, `read-page-components`,
  `strengthen-zero-config-defaults`, `set-up-types-from-templates`,
  `derive-structured-data-from-components` (the `component_mapping` entity),
  `add-advanced-meta-tags`, `add-home-page-defaults`, `describe-the-publisher`.

## Capabilities

### New Capabilities

- `command-line`: the commands, targets, accounts, the output contract, exit
  codes, errors, and the README section kept true by tests.
- `configuration-as-code`: validation of the module's configuration and page
  field, refused imports, the recipe config action, hand-writable values, and
  content export with SEO media.

### Modified Capabilities

- `draft-writes`: the dialog's write rules are scoped to the dialog; a
  command-line write follows the draft protocol and never takes over a draft.
- `template-seo`: the stored setting passes the module's shape constraint.
- `seo-checks`: rules decided on the server for the command line; the
  configuration problems only the command line reports; site identity on the
  site target.
- `seo-access`: a command run with `--as` applies the dialog's access to that
  account.

## Impact

- **Server:** new `src/Operations.php`, `src/Checks.php`, `src/Target.php`
  (all `@internal`); thin commands in `src/Drush/Commands/`; a constraint
  plugin; a config action plugin; event subscribers for configuration import
  validation and default content export. `Values::clean()` returns coded
  problems; `Resolver` keeps read-mode drops in the report and resolves an
  in-memory target for dry runs; `Sources` gains handles.
- **Configuration:** `canvas_metatag.schema.yml` (fully validatable site,
  per-scope value types, the constraint).
- **Data:** new `data/checks.json` (every rule id, severity, where it runs);
  new `docs/cli.schema.json` (draft-07); shared fixtures
  `tests/fixtures/checks/*.json`.
- **Client:** `checks.test.ts` runs the shared fixture; no runtime change.
- **Docs:** README (new section; "Deployment" points to it), ARCHITECTURE.md,
  `canvas_metatag.api.php` (the stable surface: the JSON contract, the config
  action, the configuration schema).
- **Composer:** Drush 13.7 or later suggested and in `require-dev`; without
  Drush the module works unchanged.

## Open decisions (product owner)

1. **Where a write lands by default.** Recommended: pages in their Canvas
   draft (content, reviewed in "Review changes"), the site and templates
   stored (configuration, reviewed in the git diff, and visible to
   `config:export` at once). Alternative: the draft for pages and templates
   alike (uniform, but a template set from code needs `--to=live` or a publish
   in the editor before it can be exported).
2. **Refuse or warn on configuration import.** Recommended: refuse bad shapes
   only. A deploy with a bad value stops before anything changes, naming the
   configuration and path. Alternative: import and report in `check`.
3. **An installable agent skill.** Recommended: not in this change. The
   self-describing commands, the README section and its paste-in block are
   what every agent can use.
4. **Content checks outside the editor.** `read-page-components` reads a
   page's components on the server, which could feed the heading and alt-text
   rules. Recommended: report them as not checked, and decide after the
   acceptance run.
5. **Validation earlier than the command line.** Recommended: one change,
   last. Alternative: split groups 2 and 3 into their own change right after
   `link-values-to-fields`, and have every later change add schema,
   constraints and codes for its own keys (more work per change, validated
   configuration sooner).
