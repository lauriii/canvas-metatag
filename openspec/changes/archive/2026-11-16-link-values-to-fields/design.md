# Design

## Context

See proposal.md for why. Today a value is a string in which `{name}` and
`{field.NAME}` are filled in one pass (`Values::fill()`). `Resolver::tokens()`
does two jobs: it is the fill table, and it supplies the entity facts behind
every fallback (title, description, image chain, JSON-LD ids and dates, the
site name in the dialog). The dialog edits strings with a chip editor
(`TemplateInput.tsx`, about 570 lines, plus about 260 lines of brace helpers in
`model.ts`).

What the stored data actually holds: almost every value is one whole source
(the social image, typed structured data details, a template description) or a
title made of a main part, the separator and an ending. Free composition occurs
only in tests.

Canvas links a component prop in a content template to a field of the host
entity with an `entity-field` prop source: `{sourceType: 'entity-field',
expression}`, where the expression is a string in Canvas's own grammar. Canvas
evaluates it against the host, checking `view` access for the current user on
the host, each field and each reference hop. Everything involved is internal
to Canvas: Canvas 1.x has no public PHP API. The module already depends on
Canvas internals for drafts and templates (ARCHITECTURE.md §11), but none of
Canvas's formats is in the module's stored data today.

The dialog runs in a separate frame. It cannot import Canvas's linking
components, only copy their pattern.

## Goals / Non-Goals

**Goals:**

- One value type for every scope: typed text, a fact, a chosen media item, or a
  field link (templates only).
- The preview and the output follow the same rule, so the dialog never shows
  a value the head will not carry.
- Every Canvas internal sits behind one class, is pinned by a contract test,
  and has a row in ARCHITECTURE.md §11.
- A shipped, tested stopping point before any Canvas source reaches stored
  data (the fallback).

**Non-Goals:**

- A general expression or formatting language.
- Reusing Canvas's linking UI or its suggestion route.
- Declaring field dependencies on the template.

## Decisions

### 1. A value is exactly one of four things

A stored value is a map with exactly one key:

```
{text: string}            typed; never parsed. '' only as the title ending ("No ending")
{fact: Fact}              title | site | url | author | published | modified | description | image
{media: uuid}             image settings only
{source: {sourceType: 'entity-field', expression: string}}   templates only, no adapter
```

An absent key means "use the default". `Values::clean()` enforces "exactly one
key" on every read and write; no separate validation constraint is added,
because every reader cleans in read mode. The config schema gains a
`canvas_metatag.value` mapping type with the four optional keys and a choice
constraint on `fact` and `sourceType`.

The product owner chose the full plan (proposal.md, "Decisions taken"), so
the fallback's fifth key `{field: NAME}` was never built: links are stored as
`source` from the start.

Alternatives considered:

- *Keep strings with braces, render them without chips* (text that reads like
  the output, with linked words underlined). Fastest for experts and keeps free
  composition, but it needs a custom selection model, input-method handling and
  its own undo inside a text field, and a value at rest is hard to tell from
  typed text. Highest cost and risk.
- *Value first, with a source row and a popover with tabs (field, text,
  combine) and a configurable fallback.* Clear, but every template edit becomes
  a modal choice, the persistent source row costs space on every field, and the
  combine editor and fallback need an evaluator in two languages.
- *A list of segments per value* (text, fact and source pieces). It keeps
  composition, but nothing outside the title needs it, and the title needs only
  two parts.

### 2. The title composes by structure

The title is `title` (main part) and `title_end` (ending), joined by
`' ' . separator . ' '`. An empty part drops out with its separator, which
replaces `trimSeparators()`. The main part is never inherited from the site;
the ending is taken from the target, else the site, else the Site name fact.
`{text: ''}` as the ending means "No ending"; it is the one blank value
`canon()` keeps. The separator stays an identity setting and is no longer a
value. The page title holds only the editor's words, so stale copies of the
site name can no longer happen.

Alternatives considered: keep a pattern string (keeps every problem of
chips); a free segment list (see decision 1).

### 3. An empty link gives the field's own default

A link that is empty, hidden from visitors or broken for an item gives exactly
what an unlinked field gives. It cannot be configured. The stored shape leaves
room for an explicit fallback key later with no migration.

For the title's ending, "what an unlinked field gives" is the site layer's
ending (its typed ending, "No ending", else the site name): `texts()` takes it
as the fallback on both sides, since `cascade()` has already put the target's
link in its place.

Alternative considered: a configurable fallback per link. Every fallback chain
the module has today is the field's default, so it adds UI and evaluation code
for no stored case.

### 4. A hybrid data model: Canvas sources for fields, facts for the rest (full plan)

Field values on templates become Canvas `entity-field` sources. Title, site
name, page address, author, the two dates, and the description and image
heuristics stay the module's facts:

- Canvas reads the author through `view` on the user, which needs "access user
  profiles"; the module uses `view label`, which core always allows.
- Canvas builds a host URL from the request; the module uses its public base
  and handles the front page and the headless frontend.
- "The first formatted text with a summary" and "the first image that
  resolves" cannot be expressed as one source.
- Site settings have no host type, so they can never hold a source. Pages need
  no picker: a Canvas page's fields are exactly the facts.

Typed text, `{media}` and facts never go through Canvas.

Alternatives considered: everything as Canvas sources (wrong for the author and
the address, impossible at site scope); keep the module's own field reading
(the fallback, decision 12).

### 5. One class owns every Canvas source API (full plan)

`src/Sources.php` is the only file that may use anything under
`Drupal\canvas\PropSource`, `Drupal\canvas\ShapeMatcher` or
`Drupal\canvas\PropExpressions`. `Values` and `SchemaGraph` stay pure. A unit
test greps `src/` and `modules/` to enforce it. Public methods:
`vocabulary($bundle)`, `evaluate($source, $host, $kind, $cacheability)`,
`accepts($bundle, $source, $kind)`, `problem($bundle, $source, $kind)`,
`sourceFor($bundle, $field, $kind)` (the migration's lookup), `shown()` (a text
list's label) and `machineName($source)`. The previewed rows are built by
`Resolver::sourceRows()`, which adds what the module finishes itself (an
address on the public base, an image through its file).

### 6. The vocabulary comes from Canvas's suggester (full plan)

`vocabulary($bundle)` calls `PropSourceSuggester::suggest()` with a synthetic
component description that has one optional prop per value shape (text, text
list, HTML, image object, URL, date-time, date, number). It keeps only
`entity-field` suggestions without adapters, then (as built):

- removes the module's own field, revision author fields, paths through the
  owner, comment fields, `public://` URIs and image objects whose width and
  height do not map to width and height;
- leaves out `title`, `created`, `changed` and the owner, which are the Title,
  date and Author facts. The facts are not interleaved with the fields: the
  menu lists the type's fields first, then the facts as their own "Page"
  group, because a template's link is for the type's fields;
- reads formatted text as stored (`processed` becomes `value`,
  `summary_processed` becomes `summary`, labelled "Summary"), and a text list
  as its stored key (`label` becomes `value`; the label is kept to show);
- adds decimal fields, which Canvas never matches (JSON numbers would lose
  their digits), read as their stored digits with their scale;
- rewrites image objects from `src_with_alternate_widths` to a hop through the
  file entity, so file access is checked and `src` is a clean path (the one
  place the module writes Canvas grammar; pinned by a test);
- merges rows that share an expression across shapes, labels them with
  `Labeler` (split into a path; entity-type hops dropped), and keeps Canvas's
  form-display order. There is no separate crumb: a row's path is its label,
  and a reference is a level named by its first step.

A build that throws is logged under `canvas_metatag` and gives no rows, so a
Canvas change empties the menu instead of failing the dialog. Canvas keeps its
matches in `cache.static` for the rest of a request.

It is cached per bundle and interface language, tagged with field info, the
bundle's form display and the media type list. Cost measured on the farm site:
about 170–200 ms cold, 4 ms warm.

Alternatives considered:

- *Canvas's suggestion HTTP route.* It needs a Component entity and a different
  permission, drops adapters and returns a tree that loses leaves.
- *The module's own one-hop builder* (about 40 lines over the field
  definitions). Kept as the documented escape hatch if the suggester's
  contract breaks; it loses multi-hop rows. Not built now.
- *Canvas's private matcher service.* Needs reflection.

### 7. Evaluation account rule (full plan)

One decision per `resolve()`: when anonymous visitors may view the host,
evaluate as anonymous and take only cache tags and max-age from the result,
plus `config:user.role.anonymous` (as `Resolver::allowed()` does today).
Otherwise evaluate as the current user and keep Canvas's cacheability; such a
head is only ever shown to users who may view the unpublished entity. Never
take the `user` or `user.permissions` contexts while switched. The host check
resets the access handler's static cache first, because a Canvas draft shares
its entity's UUID. `CacheableAccessDeniedHttpException` becomes "hidden";
every other `\Throwable` (unknown field, wrong bundle, delta or locked-language
hop, malformed string) becomes "broken". `is_required` is always FALSE.

Normalising by kind keeps the module's rules: a list gives its first non-empty
item; markup becomes plain text; an entity gives its label; dates become ISO
8601 in the site timezone (date-only stays a date); addresses must be absolute
http(s) or are made public from `internal:`, `entity:` and `route:`; an image
keeps only a public file, made absolute.

Alternative considered: evaluating everything as anonymous. Unpublished hosts
deny everything, and new pages and nodes are unpublished while they are
built, so every link would preview as empty.

### 8. Writes are checked against the vocabulary

A write of a `source` is accepted only at template scope and only when its
expression equals a vocabulary row whose kinds include the value's kind. The
string is never parsed (a malformed one throws a `TypeError`). Read mode keeps
any well-shaped source, which then evaluates as broken if it cannot be read.
The existing carry-forward of values sent back unchanged stays, so a broken
link never blocks other edits. In the fallback half the same check runs
against the module's field list.

### 9. No field dependencies on the template

`calculateDependencies()` of a source is not used. If the template depended on
a field, `ContentTemplate::onDependencyRemoval()` could rewrite or delete the
whole template when the field is deleted. A deleted field becomes a broken
link instead. Recreating the field heals it.

### 10. The head keeps its field and media type tags

An earlier draft of this design dropped `entity_field_info` and `config:media_type_list`
from node heads once fields are sources. Deleting a field does not save any
node or the template, so without the tag a cached head would keep the deleted
field's value. The tags stay; the head-output requirement "Every dependency
invalidates the head" is unchanged.

### 11. The link menu copies Canvas's pattern, not its code

The icon by the label, a box that replaces the input and × to unlink are
Canvas's own linking pattern, with the same Radix icons. The menu is a popover
with a filter, preview values and drill-in levels instead of fly-outs, because
the dialog is 468 px wide. Typing on a focused box replaces it with typed text
(with Undo), because people type long literals on templates.

Alternative considered: typing on a box opens the menu filtered. Kept as a
one-line switch if hallway tests show accidental replacement.

### 12. Land the fallback first, then the Canvas half

An earlier draft pinned the Canvas contract before anything else. This change
planned to land the fallback first (tasks groups 1–5) and pin the contract at
the start of the full plan (group 6). The product owner decided for the full
plan before implementation started, so the fallback stopping point was not
built: the field link went straight to a Canvas source, with one post_update
(see the Migration Plan).

### 13. Smaller decisions

- **The repeated site name fix** sets "No ending" only when the main part is
  typed on the target. A main part linked to the item's title would apply one
  item's text to every item, so no fix is offered there.
- **Custom JSON-LD** keeps its fill of the fixed names (title, description,
  site, sep, url, author, published, modified, image). Only field names stop
  being filled; the update logs templates whose custom JSON-LD uses one.
- **Linking a value to its default source is stored.** Its box offers × to go
  back (and no Reset beside it). This is an explicit exception to "values
  equal to what is inherited are not stored".
- **A page's number details** have no fact to link to, so they get no link
  icon.
- **AI:** a title variant is stored as `{text}` in the main part. The request
  carries the resolved ending (`page.ending`, cut to 255). The ending goes into
  the user message, sanitised like the page title. The system prompt only
  says that the ending given in the request is added automatically and counts
  toward the length. That sentence is fixed text in code, added with the
  fence and the answer shape after the Prompt Library prompt
  (`build-ai-on-drupal-ai`, decision 2), and only for title requests, so an
  edited prompt cannot drop it. An earlier draft put the ending into the
  system prompt; that would break "The system prompt holds nothing from the
  request".
  `Assistant::withoutBraces()` goes: typed text is never parsed, so a model
  cannot plant a link.

## Risks / Trade-offs

- [Canvas's expression grammar is persisted in the module's data (full plan).
  It has changed before.] → One class; contract tests (`@group
  canvas_metatag_canvas_contract`) that a CI job runs against Canvas's
  development branch and that may not fail; a module post_update per Canvas
  deprecation that re-serialises through `PropSource::parse()->toArray()`;
  anything unreadable shows as broken, never as a 500; the fallback as the last
  resort.
- [The suggester is internal and a refactor is pending; it is fed a synthetic
  component description.] → The contract test fails first; the one-hop builder
  is the escape hatch; ask upstream for a public "suggest sources for a shape
  on a bundle" service.
- [Free composition is gone.] → Only tests used it. The update logs every
  composite it shortens.
- [Gray (default) versus blue (set here) must be learned.] → Only the box's
  tag carries the colour (the box itself is drawn as an input, review round
  3); the tag's words ("Default", the link's path), the aside and the
  accessible description say it too; hallway test with two site builders.
- [An unpublished node previews with the editor's access (full plan); a field
  restricted by field permissions may show a value visitors will not get.] →
  Documented in the README as a known gap.
- [Typing on a box replaces the link.] → Undo in the action bar; switchable.
- [Accepted regressions (full plan): a text list gives its key; a reference
  hop needs `view`, not `view label`.] → Documented in the README; the author
  fact covers users.
- [A malformed source from configuration import or JSON:API.] → Read mode keeps
  it; it evaluates as broken in the dialog and empty in the output.
- [State cost: preview values are evaluated per vocabulary row on every
  template `GET /state`.] → One account switch per request, warm vocabulary
  cache; fine for tens of fields.

## Migration Plan

The module is unreleased, so there is no permanent read shim. A pure,
`@internal` converter (`src/Legacy.php`) holds the only remaining copy of the
old brace regex; it and the post_update are deleted after 1.0.

1. **`canvas_metatag_post_update_values_as_parts`**. Batched,
   50 rows at a time. Converts the site settings, every node `full` template
   (read its draft first, save the stored template, write the converted draft
   back under its client id, as `canvas_metatag_uninstall()` does), every
   revision and translation of the page field (direct table updates, so a
   revert never brings the old form back; then reset the storage cache and
   invalidate `canvas_page_list` and `rendered`), and every page draft.
   Titles split at the last separator: the part before it is the main part,
   the part after it the ending; an ending equal to the layer below is dropped;
   a title without a separator gets "No ending"; `{site}` becomes the Site name
   fact; whole fact names become facts; a media UUID becomes `{media}`; other
   composites keep their first piece and are logged; unknown names are
   dropped and logged. A whole `{field.NAME}` becomes a Canvas source at once
   (the full plan needs no second update): the bundle's first formatted text
   with a summary becomes the Description fact (lossless); otherwise the first
   vocabulary row for that field and kind (`Sources::sourceFor()`, one hop
   preferred, else a row ending at a title or name); an image field with no
   row becomes the Image fact; with nothing, it is dropped and logged. Log
   lines name the key and say "typed text" for typed words, never a value of
   the content.
2. *(Planned `canvas_metatag_post_update_fields_as_sources`: folded into 1,
   because the fallback's `{field: NAME}` never shipped.)*

**Rollback.** Restore the database from before `drush updb`. If the Canvas
dependency must be withdrawn after shipping the full plan: revert the full-plan
groups and add one post_update that maps single-hop sources back to `{field:
NAME}` and drops (and logs) multi-hop ones. About a day; rehearsed by the
migration tests.

## Canvas and AI internals relied on

New, full plan only; each gets a row in ARCHITECTURE.md §11.

| Internal | Used for | If it changes | Caught by |
|---|---|---|---|
| Stored shape `{sourceType: 'entity-field', expression}` and the expression grammar | persisted in template configuration and drafts | module post_update re-serialises; unreadable shows as broken | `SourcesTest` round-trip per field type; canvas-dev CI job |
| `PropSource::parse()`, `EntityFieldPropSource::evaluate($host, FALSE)`, `EvaluationResult` | evaluating a link | one method changes | `SourcesTest` |
| Evaluator behaviour: `view` access for the current user per hop; `CacheableAccessDeniedHttpException`, `DomainException`, `InvalidArgumentException`, `LogicException`, `TypeError` | statuses hidden and broken | account rule and `\Throwable` catch hold | `SourcesTest` statuses |
| `PropSourceSuggester::suggest()` with a synthetic `ComponentMetadata` | the vocabulary | one-hop escape hatch | `SourcesTest` vocabulary |
| `Labeler::label()`, `StructuredDataPropExpression::fromString()` | row labels and paths | fall back to `EntityFieldPropSource::label()` split on " → " | `SourcesTest` paths and crumbs |
| JSON schema ref `json-schema-definitions://canvas.module/image` | the image shape given to the suggester | image rows vanish | `SourcesTest` image rows |

Unchanged existing dependencies: `AutoSaveManager`, `ContentTemplate`, `Page`,
`AutoSaveValidateTrait`, the third-party settings schema hook, the extension
API. The migration's template walk relies on the existing row "`onCanvasConfigEntitySave()`
drops a template draft when the stored template changes".

The AI submodule relies on nothing new in the AI module: only the fixed text
after the configured prompt, the user message and the request payload change.
The Prompt Library prompts of `build-ai-on-drupal-ai` are not edited.

## Open Questions

- Should text values of a multi-value field join their items instead of taking
  the first? Deferrable: it changes one normaliser, not the stored shape.
- Should a configurable fallback ever be added? Deferrable: the stored shape
  takes an extra key without a migration.
