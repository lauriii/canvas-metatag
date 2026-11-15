# Design

## Context

See proposal.md for the motivation. Starting point, after the 13 queued
changes have landed:

- One producer of output: `Resolver::resolve($entity, $draft)` returns
  `head{title, meta, link, script}`, the image, a report and cacheability.
  `Resolver::report()` (rethink-structured-data) adds verdicts, rules and,
  later, clashes and reach. Only the dialog's state calls it.
  `Resolver::origin()` takes the public base from `canvas_metatag_public_base`
  or, failing that, the request.
- One validator: `Values::clean($input, $scope, $accepts, $type)` and
  `cleanIdentity()`. Write mode returns `path => sentence`; read mode drops
  silently at render time.
- One public method finds the version the editor sees for a page
  (expose-seo-to-canvas-ai, decision 3).
- Template field links are Canvas entity-field sources;
  `Sources::vocabulary($bundle)` lists the rows the link menu offers and
  `Sources::sourceFor()` builds one from a field name and a kind
  (link-values-to-fields).
- Writes reach pages and templates only through the dialog's draft routes,
  which need the editor's client id and auto-save entry. Site settings are
  saved by `PUT /canvas-metatag/api/site`. All routes are cookie-only by design.
  Canvas's `AutoSaveManager::saveEntity()` records one owner per entry.
- Checks run only in the dialog (`extension/src/checks.ts`), from the dialog's
  state and the editor's preview document.
- Drush 13 is on every site. Since 13.7 a module command is an `#[AsCommand]`
  Symfony console class in `src/Drush/Commands/` with `AutowireTrait`, and
  `FormatterTrait` gives `--format`. Drush's own `WorkspacePublishCommand`
  (13.7) is that shape. Symfony rejects an unknown option before a command
  runs: exit 1, a message on stderr, nothing on stdout (checked on Drush
  13.8). Without `--uri` or `DRUSH_OPTIONS_URI` the request host is
  `default`, so request-based addresses are `http://default/…`.
- Core facts checked on the farm site: config actions and recipes validate
  only configuration whose type is fully validatable; `drush config:set`
  validates nothing; `ConfigEvents::IMPORT_VALIDATE` lets a module refuse an
  import, and core's importer does not itself run typed validation; the
  default content importer acts as the administrator through
  `AdminAccountSwitcher` unless given an account, calls `$entity->validate()`
  and throws on violations; `PreExportEvent::setCallback()` lets a module
  export a field and add dependencies. Core's JSON Schema validator
  (`justinrainbow/json-schema`) supports drafts up to 07.

## Goals / Non-Goals

**Goals:**

- A coding agent with a shell completes the probe's seven jobs using only
  documented commands, with no browser session, no `php:eval` and no reading
  of the module's code.
- One surface: four verbs over one service and one output contract, built on
  the producer and validator the dialog uses, so the two cannot drift.
- Whatever `inspect` prints, `set` accepts unchanged.
- Configuration and content written from code are validated where they are
  written, or reported, never dropped in silence.
- The dialog, its routes and its sentences stay as they are.

**Non-Goals:**

- Any new HTTP route, token authentication or protocol server.
- Rules with ids, severities or outcomes of their own on the server.
- Bulk writes, per-node overrides, component mappings from the command line.
- A PHP API promise; the stable surface is the JSON contract, the config
  action and the configuration schema.

## Decisions

### 1. Four Drush commands over one service

`describe`, `inspect`, `check` and `set`, plus the queued `vocabulary`. Each
command is a thin `#[AsCommand]` class in `src/Drush/Commands/` with
`AutowireTrait` and `FormatterTrait` (`defaultFormatter: 'json'`), which
parses options, calls `Operations` and returns the document. Humans get
`--format=yaml` for free; JSON is the contract. Each command's one-line
description contains "SEO" and "meta tags" or "structured data (JSON-LD)", so
`drush list | grep -i seo` finds them. `Operations` (final, `@internal`)
returns each document as an array; site tests run the commands with Symfony's
`CommandTester`.

*Alternatives:*
- *An HTTP API with tokens:* reopens the cookie-only rule and needs an auth
  story per site. The commands run where the agent already is.
- *A protocol server:* optional per project. It can wrap these commands later.
- *Core `dr` commands only:* experimental, 11.4+, invisible to Drush.
- *One command per job or per route:* more names to learn, each needing the
  same targets, account and contract.
- *`inspect` and `check` as one command:* see Review decisions.

### 2. Targets are named as developers know them

`Target::parse()` accepts:

| Form | Means |
|---|---|
| `site` | the site settings |
| `node.<bundle>`, `canvas.content_template.node.<bundle>.full` | the full content template of that node type |
| `canvas_page:<id>`, `node:<id>` | that entity |
| `component_mapping:<id>` | a component mapping (`inspect` and `check` only) |
| `/path`, `https://host/path` | the entity the path routes to, through aliases and the language prefix; a host other than the public base is refused |

`--langcode` picks a page translation. A near miss (`node.12`) is `not_found`
with the likely form in `next`. A target the module does not own (a view, a
node type without a full template) is `not_owned`. A template is inspected
with `--preview=node:<id>`, or else with the node the dialog would preview,
named in `target.preview`; with no published node of the type, `values` and
`inherited` print, `head` is `null` and `not_checked` says `no_preview_node`.
A page that was never published has no visitor head: `head` is `null` and
`next` adds `--draft`.

### 3. Administrator by default, `--as` emulates an editor

Commands act as the administrator through core's `AdminAccountSwitcher`, as
the default content importer does, and switch back in `finally`.
`--as=<user name>` switches to that account instead, to answer "what would
this editor see or be allowed to do"; an unknown name is `not_found`, a
blocked account `forbidden`. With `--as`, access is the dialog's
(seo-access), and a rule the account may not see is listed under
`not_checked` with `needs_account`.

This is fidelity, not security: a Drush shell already has `php:eval` and
`sql:query`. The README and `canvas_metatag.api.php` say so.

*Alternatives:* anonymous by default (a CI `check --all` could not see stored
values and would pass silently); a required `--as` on writes (a flag on every
write that protects nothing); `--as` taking a name, id or email (a user name
can look like either; Drush's own `user:login` keeps them apart).

### 4. Where a write lands

`set` takes `--to=draft|live`. Default: `draft` for a page (content, reviewed
in "Review changes"), `live` for the site and templates (configuration,
reviewed in the git diff and visible to `config:export` at once). `describe`
prints each kind's default, and every result says `written_to` (open
decision 1).

- **draft:** the patch goes into the target's Canvas draft through the
  dialog's `putDraft()` path. The server reads the target's auto-save entry
  itself and writes under a client id made for the run. The write is refused
  with `draft_in_use` (owner, last change, and what to ask of them) when a
  draft exists that another account owns, so a command never takes over an
  editor's work or re-attributes it. A draft the account owns is written as
  the dialog writes it; an editor with the target open gets Canvas's
  conflict on their next save, as with any session.
- **live:** the patch is stored on the page translation (a new revision, the
  acting account as revision user, log "canvas-metatag:set via command line")
  or on the template. If the target has a draft, the same patch is applied to
  it under the rule above, so a later publish cannot undo the write; a draft
  that then equals the stored entity is removed (draft-writes). This is also
  how an agent leaves a draft it made: `set --to=live` with the same values.
- Site settings have no draft and are always stored.

A draft write's result puts the `--to=live` command in `next` and says that
visitors and configuration export see the value once it is published.

*Alternatives:* always the draft (a template set from code is invisible to
`config:export` until someone publishes in the editor); always stored (skips
review for pages, and an open draft would overwrite it on publish); refusing
`--to=live` when a draft exists (a dead end: no command publishes or discards
a draft); publishing the Canvas draft (publishes everyone's other changes).

### 5. A write is a merge patch; values are leaves

`set` applies its JSON object to the current values (the draft's when writing
to the draft, else the stored values) as a merge patch (RFC 7396): objects
that group settings merge (`describe` rows name every leaf, so the groups are
the rows' parents); a value (`{text}`, `{fact}`, `{media}`, `{field}`,
`{source}`, a list) is replaced whole; `null` removes it. A patch that changes
`schema.type` drops the details the new type lacks, as the dialog does, and
lists them in a `details-removed` issue (good to know). At page scope,
`description` is Canvas's Page data description and is written into the same
draft or revision, as the dialog hands it to Canvas.

The result is what `inspect` would print for the version written (full own
values, inherited values, head, issues) plus `changed` and `written_to`.
`--dry-run` prints the same document for the patched copy and writes nothing.
A patch that changes nothing writes nothing and says `changed: false`.

*Alternatives:* replace by default (the probe's footgun); a `--replace` flag
(reintroduces it on purpose; `null` removes); `set <target> <path> <value>`
(values are JSON anyway, and five keys would mean five draft writes); a
before/after diff (the agent has the before from `inspect`; a second contract
member to keep).

### 6. One validator, coded problems, one path syntax

`Values::clean()` and `cleanIdentity()` return `Problem` objects instead of
sentences: `{code, path, allowed?, min?, max?, max_length?}`. The API maps
each to the sentence and `error_paths` it gives today, so the dialog and its
tests do not change. The command line renders its message from the code and
limits and adds `next`.

Every path the command line prints (errors, issues, `inherited`, `describe`
rows) is a JSON Pointer into the `set` document: `/schema/props/offers_price`,
`/tags/2/content`, `/schema/extend/#primary/name`. Hand-added JSON-LD is
decoded (decision 10), so a pointer reaches into it directly.

Field codes, a closed list: `not_here` (a path this scope or type does not
have; `allowed` lists those it has), `form` (the value is not one of this
path's forms, such as a bare string; the message shows the wrapped value),
`choice`, `range`, `format` (a literal that fails its kind), `too_long`,
`media` (not a published, public image), `field` (a handle the template
cannot link; `allowed` lists those it can), `json`, `reserved`. An unknown
type is one `choice` error on `/schema/type`.

*Alternatives:* a second validator for code (would drift); parsing sentences
(fragile, not translatable); dotted paths (ambiguous for list items and for
keys holding `#` or `[`).

### 7. Refuse shapes, report stale references

Constraints refuse what the rules can never accept: unknown keys, keys of
another scope, invalid literals, out-of-range numbers, malformed sources and
JSON-LD. They do not refuse a reference that was valid and went stale (a
deleted media item or field, a component version that lost a prop): `check`
reports it (`media-missing`, the link rules). Otherwise imports would depend
on import order, and a Canvas publish could fail on an image someone deleted.

`set` and the config action validate in write mode, where a stale reference
in a changed value is refused, as in the dialog; a value carried over
unchanged is kept (draft-writes, "A write is validated as a whole").

### 8. Configuration validation on every path that validates

- `canvas_metatag.site` gets `FullyValidatable`. Its schema splits
  `canvas_metatag.values` into per-scope types (`…values.site`,
  `…values.template`, `…values.page`) sharing their members, with
  `requiredKey: false` for optional members.
- A `CanvasMetatagValues` constraint (option: `scope`) on those types, on the
  identity and on the `component_mapping` entity delegates to the cleaners in
  write mode, with decision 7's reference checks off. For a template, the
  bundle comes from the parent template.
- The page base field gets the same constraint (scope page), so content
  import, entity APIs and Canvas's publish validate it.
- An `IMPORT_VALIDATE` subscriber validates `canvas_metatag.site`, changed
  templates' third-party settings and component mappings in the import's
  source storage with `TypedConfigManager::createFromNameAndData()->validate()`
  (the same constraint, no third path), logging one error per violation
  (configuration name, path, message). It carries a `@todo` to remove it once
  core validates imports itself.

`drush config:set` validates nothing in core; the README steers to `set site`,
and `check site` reports what `config:set` stored. Before the first import
after updating, the README says to run `check --all`.

*Alternatives:* a post-command hook on `config:set` (Drush's legacy hooks for
one command); validation only in `check` (bad values still stored by recipes
and imports); a post-update that prints refused values (its output scrolls
away and duplicates `check --all` and the import refusal).

### 9. One config action for recipes

`#[ConfigAction(id: 'setCanvasMetatag')]` applies to `canvas_metatag.site`
and to `canvas.content_template.node.*.full`. Its value is what `set` takes
for that target: a merge patch, validated in write mode, with the
hand-writable forms. It shares `Operations::set()`'s patch and validation code
and stores directly, without an account check, as every config action does.
A template draft is left alone; the README says a configuration import that
changes a template's setting discards its draft.

```yaml
config:
  actions:
    canvas_metatag.site:
      setCanvasMetatag:
        identity: { kind: organization, name: 'Acme Lamps', logo: { media: 12 } }
    canvas.content_template.node.article.full:
      setCanvasMetatag:
        title: { fact: title }
        description: { field: field_summary }
        schema: { type: BlogPosting }
```

*Alternatives:* core's `simpleConfigUpdate` and `setThirdPartySetting` (they
keep working, but replace whole values and take only Canvas's expression
grammar); storing the shorthand (two stored forms would split every reader).

### 10. Hand-writable values, canonical storage, exact round trip

At the write boundaries (`set`, the config action):

- **Fields by handle.** `Sources::vocabulary($bundle)` gives every row a
  unique handle: the field name for its main property (`field_summary`), a
  `:` suffix for another property (`field_body:summary`), `.` to cross a
  reference (`field_writer.name`). `{"field": "<handle>"}` becomes the row's
  `{"source": …}`. A handle the template cannot link is refused with code
  `field` and the handles of that kind in `allowed`.
- **Media** by id or UUID (`{"media": 12}`) becomes the stored UUID form.
- **Hand-added JSON-LD** (`schema.custom`, each `schema.extend` value) is
  accepted as a JSON object or list as well as text, and stored as two-space
  pretty-printed text; one `@graph` wrapper is unwrapped.
- **A page's description** is Canvas's field (decision 5).

`inspect` prints a handle for every source the vocabulary lists, media as
`{"media": "<uuid>"}`, and JSON-LD decoded; only a source the vocabulary no
longer lists (stale, and reported by `check`) prints as `{"source": …}`. A
contract test round-trips every fixture: what `inspect` prints, `set` accepts
with `changed: false`. The field shorthand does not apply inside hand-added
JSON-LD, which keeps its own `{field.name}` placeholders; the README shows the
three forms in one table, and notes that `config:export` shows the stored
Canvas expression.

### 11. Server checks, pinned to the dialog's

`Checks::for($target, $report)` computes every rule whose inputs are on the
server: stored or draft values, the resolved head, the report, media facts,
identity and link states. Ids, severities and paths are the dialog's; the
server writes each message once, from the rule.

`data/checks.json` lists every rule id once with its severity and `where`:
`server`, or `editor` for rules that read the preview or measure rendered
text (`title-long`, `description-long`, `title-heading`, `img-alt`,
`content-unavailable`, hand-added text not on the page). A unit test fails
when either side emits an id the file does not list; a shared fixture
(`tests/fixtures/checks/*.json`, inputs and expected `{id, severity, path}`)
runs in `ChecksTest` and `checks.test.ts` and is the only place a server
rule's expectations live. The command line lists `editor` rules under
`not_checked` with `needs_editor_preview`.

Rules only the command line reports: `value-dropped` (to fix: a stored value
the output leaves out, with its code), `media-missing` (to fix; its message
says how to ship media with a recipe), `setting-ignored` (to improve: SEO
values on a template other than full), `overridden` (good to know: a site
value replaced in settings.php), `literal-braces` (to improve: text holding a
former `{title}`-style token, with a fix when the whole text is one token),
`details-removed` (good to know, decision 5).

An issue whose value is inherited names its layer in `from`, and its `fix` is
`{target, patch}`, so a template-caused issue is fixed on the template, not on
every page.

*Alternatives:* see Review decisions on porting fewer rules and on measuring
lengths on the server.

### 12. Dropped values become report members

Read-mode cleaning already computes problems and throws them away. `resolve()`
keeps them in the report's `dropped` (rethink-structured-data adds the member
for structured data; this change fills it for every key), at no extra cost on
delivery, and `Checks` turns each into `value-dropped`.

### 13. `check` is built for scripts

`--all` covers the site, every full template, every component mapping and
every Canvas page, in batches, reusing the per-entity report cache when
add-structured-data-diff-and-overview has landed. A template is checked
against each published node of its type; an issue found on its nodes carries
`count` and up to five `examples`. `results` lists only targets with issues;
`summary` counts all; `not_checked` is printed once. Targets with `--all` are
a usage error.

### 14. A public base or nothing

When the public base would come from the request and the host is Drush's
placeholder `default`, every command that prints or matches addresses refuses
with `base_unknown` and a `next` that adds `--uri=https://…` or sets
`canvas_metatag_public_base`. `describe` still runs. Report cache entries vary
by the public base, as every entry does, so a command run never fills the
dialog's cache with another host. Every `next` line repeats the run's `--as`,
`--langcode` and `--uri` and uses the target's `ref`, so it runs as printed.

### 15. Docs where an agent looks, kept true by tests

A site builder's agent works at the project root and finds the module through
`drush list`, `--help` and the README; a module-level agent file is not read
by it. So:

- each command's help: every option, three examples, the README section;
- `describe` returns `docs`: the README's absolute path with the section
  anchor, and the project page;
- README "Set up and verify from the command line": a ten-line model (site,
  content type, page, and nodes inheriting from their type; value forms; draft
  or live; `--as`; `--uri`), a three-line block to paste into the project's
  agent instructions, then the seven jobs. It leads with `@file` input
  (resolved against the caller's working directory, since stdin needs an
  interactive exec in containers), shows how to ship identity media as recipe
  default content, notes that `drush` may be the project's wrapper, and says
  that empty stdout means Drush refused before the command ran;
- `docs/cli.schema.json` (draft-07): the output contract;
- a test runs every `drush canvas-metatag:` line and applies every recipe
  snippet on a fixture site, substituting placeholders such as `<media-id>`,
  and validates every JSON example against the schema.

Short and specific on purpose: long context files make agents slower and less
accurate.

### 16. Export carries the media an SEO value names

A `PreExportEvent` subscriber sets a callback for the `canvas_metatag` field
that exports the value unchanged and calls `addDependency()` for each media
item it names, so `content:export --with-dependencies` includes them. Identity
images are simple configuration and cannot depend on content: the README
ships them as recipe content, and `check site` reports `media-missing` if they
are absent.

## The output contract (version 1)

One JSON document on stdout once the command runs; notices on stderr.
Drush's own errors before a command runs (unknown option, bootstrap failure,
unknown command) keep Drush's behaviour: exit 1, stderr only.
`docs/cli.schema.json` describes the documents. Adding a member does not
change `contract`; removing, renaming or changing the meaning of one does.

### Envelope (every command)

```json
{
  "contract": 1,
  "command": "inspect",
  "ok": true,
  "target": { "...": "Target, or null for describe and check" },
  "errors": [],
  "next": ["drush --uri=https://example.com canvas-metatag:check canvas_page:3"]
}
```

### Target

```json
{
  "ref": "canvas_page:3", "kind": "page", "entity_type": "canvas_page",
  "id": "3", "bundle": null, "langcode": "en", "label": "Pricing",
  "url": "https://example.com/pricing", "version": "published",
  "published": true, "has_draft": true, "draft_owner": "jane", "preview": null
}
```

`kind`: `site`, `template`, `page`, `node` or `component_mapping`. `version`:
`published` or `draft`. For a template, `preview` is `{ "ref": "node:12",
"label": "…" }` or `null`.

### Error

```json
{
  "code": "choice",
  "path": "/schema/type",
  "message": "\"Prodcut\" is not a page type. Use one of the allowed types.",
  "allowed": ["AboutPage", "Article", "BlogPosting", "Event", "Product"]
}
```

Codes: the field codes of decision 6 (exit 1), and `usage`, `bad_json`,
`not_found`, `not_owned`, `not_editable`, `forbidden`, `draft_in_use`,
`conflict`, `base_unknown` (exit 2). Optional members: `path`, `allowed`,
`min`, `max`, `max_length`.

### Issue

```json
{
  "id": "title-site-twice", "severity": "improve", "path": "/title_end",
  "message": "Remove the repeated site name",
  "detail": "The title already ends with the site name.",
  "from": "template",
  "fix": { "target": "node.article", "patch": { "title_end": { "text": "" } } }
}
```

`severity`: `fix`, `improve` or `info`. `fix` exists only where the dialog
offers a one-click fix or decision 11 names one. `count` and `examples` appear
on a template's results.

### describe

```json
{
  "contract": 1, "command": "describe", "ok": true, "target": null,
  "docs": { "readme": "/var/www/html/web/modules/contrib/canvas_metatag/README.md#set-up-and-verify-from-the-command-line", "project": "https://www.drupal.org/project/canvas_metatag" },
  "targets": {
    "page": { "default_to": "draft", "rows": [
      { "path": "/title", "label": "Title", "forms": ["text", "fact"], "max_length": 300, "inherits": "template", "example": { "text": "Oak desk lamp" } },
      { "path": "/robots/max_snippet", "label": "Text preview length", "forms": ["number"], "min": -1, "max": 1000, "example": 160 }
    ] },
    "site": { "default_to": "live", "rows": [ { "path": "/identity/logo", "label": "Logo", "forms": ["media"], "example": { "media": 12 } } ] }
  },
  "facts": { "title": { "kind": "text", "label": "Title" } },
  "types": { "Product": { "label": "Product", "scopes": ["page", "template"] } },
  "fields": [ { "handle": "field_writer.name", "label": "Writer › Name", "kinds": ["text"] } ],
  "media": [ { "id": 12, "uuid": "…", "label": "Desk lamp", "width": 1200, "height": 630 } ],
  "truncated": false,
  "checks": { "title-site-twice": { "severity": "improve", "where": "server" } },
  "errors": [], "next": []
}
```

`--type=<id>` adds that type's detail rows (same row shape, with `level`).
`fields` only with `--bundle=<bundle>`, every vocabulary row in the link
menu's order; `media` only with `--media=<search>` (published public images
the account may view, at most 24, `truncated` when there are more).

### inspect

Envelope, plus:

```json
{
  "values": { "title": { "text": "Oak desk lamp" }, "schema": { "type": "Product" } },
  "inherited": { "/title_end": { "value": { "fact": "site" }, "from": "site" } },
  "head": {
    "title": "Oak desk lamp | Acme Lamps",
    "meta": [ { "name": "description", "content": "…" } ],
    "link": [ { "rel": "canonical", "href": "https://example.com/lamp" } ],
    "script": [ { "type": "application/ld+json", "json": { "@context": "https://schema.org", "@graph": [] } } ]
  },
  "issues": [],
  "not_checked": [ { "id": "title-long", "reason": "needs_editor_preview" } ]
}
```

`from`: `site`, `template`, `default_translation`, `settings_php`,
`component` or `default`. `head` has the headless head's shape.

### check

```json
{
  "contract": 1, "command": "check", "ok": false, "target": null,
  "fail_on": "fix",
  "summary": { "targets": 14, "fix": 1, "improve": 6, "info": 9 },
  "results": [ { "target": { "ref": "node.event" }, "issues": [ { "id": "schema-required", "severity": "fix", "path": "/schema/props/start_date", "count": 31, "examples": ["node:40", "node:41"] } ] } ],
  "not_checked": [ { "id": "title-long", "reason": "needs_editor_preview" } ],
  "errors": [], "next": ["drush canvas-metatag:inspect node.event --preview=node:40"]
}
```

### set

The `inspect` document for the version written, plus `"dry_run"`,
`"changed"` and `"written_to"` (`draft`, `live`, or `null` for a dry run or no
change).

### Exit codes

0: done, and for `check` nothing at or above `--fail-on`. 1: the answer is
no: `check` found issues at or above `--fail-on`, or `set` was sent values the
rules refuse. 2: the command could not do what was asked (usage, `bad_json`,
`not_found`, `not_owned`, `not_editable`, `forbidden`, `draft_in_use`,
`conflict`, `base_unknown`). Good-to-know issues never change the code. A
Drush error before the command runs exits 1 with empty stdout.

## Risks / Trade-offs

- **Two copies of the server-decidable rules** (PHP and TypeScript) until the
  dialog reads server issues. Mitigated by `data/checks.json` and the shared
  fixture; a follow-up moves the dialog to the server's issues and deletes the
  TypeScript twins.
- **Refusing imports can stop a deploy** of configuration that held a bad
  shape for months. Mitigated: each error names configuration, path and fix,
  and the README says to run `check --all` after updating. Open decision 2.
- **A stricter rule in a later release could fail Canvas's publish** of a page
  whose stored value passed before. Rules that tighten must ship with a
  post-update that cleans stored values; decision 7 keeps stale references
  out of constraints.
- **A command's draft write puts an editor with the target open in
  conflict.** That is Canvas's rule for every session, and only drafts the
  account owns (or new ones) are written.
- **`check --all` on large sites.** Batched, cached per entity, only issues
  kept in memory; tests assert batching and cache hits, and the acceptance run
  records wall time.
- **Canvas internals.** No new one: drafts go through `putDraft()` and its
  contract tests. A spike checks the Canvas command-line tool's template push.

## Migration Plan

No stored value changes and no update hook. Validation applies to new writes
and imports; `check --all` lists stored values it would refuse. Rollback:
remove the module version; nothing was stored in a new shape.

## Overlaps with queued changes

- `expose-seo-to-canvas-ai`'s `get_seo` tool and the commands use the same
  editor-version lookup (owned by whichever lands first).
- `add-structured-data-diff-and-overview`'s overview and CSV are for people;
  `check --all` is for scripts. They share the report cache.
- `extend-structured-data-by-id`'s vocabulary command adopts the envelope and
  exit codes; its download behaviour does not change.

## Review decisions

Two reviews (a coding agent walking the seven jobs, and a contrib maintainer)
were applied. Adopted: draft ownership and the live write that also updates
the account's draft (no dead end); administrator by default; Drush's
formatter; split exit codes and a contract scoped to "once the command runs";
`base_unknown`; describe rows per target kind with examples; page
description; field handles; JSON-LD as JSON; JSON Pointer paths; `from` and
`{target, patch}` on issues; node coverage in `check`; the `form` code and
`literal-braces`; type changes that drop details; MODIFIED deltas for
draft-writes, template-seo and seo-checks; CommandTester tests, draft-07,
`require-dev`; and the cuts (`--format=text`, `--replace`, `--detail`, the
diff, the post-update, `@api` and its test, media paging,
`account_required`). Rejected or changed:

- **Split validation into an earlier change (maintainer 1).** Kept as one
  change, last, and made open decision 5: landing validation early means every
  queued change must add schema, constraints and codes for its keys, which
  their plans do not say. Converting every validator branch once at the end is
  one pass, not two. The contradictory "groups 1 to 3 may start earlier" line
  is gone, and the AI change is no longer a hard dependency.
- **Port only the saved-draft rules (maintainer 8).** Not adopted: a gate
  without the title and description rules would pass a page with no
  description. Server rules are pure functions of the head and values, pinned
  by one fixture; messages are written once on the server, not copied. The
  follow-up deletes the TypeScript twins.
- **Measure `title-long` and `description-long` on the server (agent F7).**
  Not adopted: a character estimate would give a different answer than the
  dialog's pixel measure under the same id. `inspect` prints the text.
- **Oldest node as the template preview (agent F7).** `inspect` keeps the
  dialog's pick for parity and names it; `check` covers every node, so the
  gate does not depend on the pick.
- **Merge `inspect` and `check` (agent F11).** Not adopted: looking and gating
  differ in exit rule and size, and "check" is the word an agent searches
  for. Their issue objects are the same.
- **An input JSON Schema (agent F11).** `describe` rows are the input
  contract; a second source would drift.
- **`describe --component` (agent F13).** Deferred: mappings are
  configuration, guarded by the constraint, import validation and `check`.
- **`--if-match` (maintainer 3).** Not added: the ownership rule and Canvas's
  conflict rule cover real races; it can be added if acceptance shows a need.
- **`target.base` (maintainer 7).** `target.url` already shows the base, and
  `base_unknown` refuses a wrong one.
- **`ignoreValidationErrors()` to own option errors (agent F10).** Not used:
  it fights the framework; the README explains empty stdout instead.
- **`--as` by id or email (maintainer 2).** User name only, so it is never
  ambiguous.
