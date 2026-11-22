# Design

The sheet's full design (layout, levels, states, switching rules, every
problem's copy, keyboard and screen-reader rules, what was cut) is in
[`reference/reference.md`](reference/reference.md), with a self-contained
sketch in `reference/mockup.html` and key states in `reference/img/`. The
specs win over it, and this file wins over it.

## Context

See proposal.md for why. Custom JSON-LD (`schema.custom`) is validated when
saved (32 KB, up to 10 objects, depth 8, no `null`, safe schemes), re-encoded
with sorted keys and appended after the module's nodes; a node that takes a
module `@id` is dropped. After `rethink-structured-data`, `report()` returns
`features`, `rules` and `sources` (where each value came from),
`search-features.json` carries documented `names` per feature type, and the
sheet is "Add your own JSON-LD" behind Code. After `link-values-to-fields`
the sheet is a plain textarea (no chip mirror), only the fixed names
(`{title}` … `{image}`) are filled in hand-added JSON-LD, and `Sources` owns
field values. After `populate-every-schema-type` the dialog has a reference
select, a page picker, a code picker, checkbox rows and a duration box.

Facts from the code that shape this design: a `#name` `@id` lands on the
page URL, so `#webpage`, `#primary` and `#primaryimage` already reach the
module's nodes while `#identity`, `#logo` and `#website` do not;
`Values::customValue()` refuses any string that starts with `data:` or
`file:`; `json_decode` turns `1e400` into `INF`, which the head's encoder
then refuses, dropping the whole head; `errors['schema.custom']` is a string
that the model, `checks.ts` and headless clients read.

## Goals / Non-Goals

**Goals:** experts can say everything a feature documents about the module's
own nodes without a second node; nothing they add can overwrite what the page
says. Anyone can fill a hand-added item as a form or paste JSON, and never
loses a byte switching between the two. A type opens with only what its
search features need. Every problem has a line, a path and plain words.

**Non-Goals:** removing a value the module emits; a code-editor library;
cross-page references from the form; AI on hand-added items; translating
schema.org's own words.

## Decisions

### 1. Storage

`schema.extend`: `{ "#primary" | "#webpage" | "#identity" (site): "<json>" }`.
Cleaned by `Values::cleanExtend()` with the custom JSON-LD rules, plus: keys
may carry one selector suffix `[*]` or `[name=…]`; `@id` and `@type` may not
be set except `@type` as a list that contains the node's type. `schema.main`:
the `@id` of one hand-added item (`derive-structured-data-from-components`
later lets the same key hold `c-<uuid>`, so a page has one answer).

`schema.custom` (and each `schema.extend` value) is **stored as written**,
trimmed, after validation; `Values::json(ksort(…))` is no longer applied to
it. Validation decodes the text and refuses: invalid JSON; more than 64 KB as
written; more than 32 KB for custom and extend together, counted on the
minified re-encoding (so whitespace is free); a shape other than one object
or a list of up to 10, each with `@type` a string or a list of 1–4 strings;
depth over 8; `null`; a number that is not finite; an `@` key other than
`@type`, `@id` and, on a top-level item, a schema.org `@context` (accepted,
not output); an `@id` that is neither absolute http(s) nor `#name`; a
top-level `@id` on the module id list; two top-level items with one `@id`;
a string starting with `javascript:` or `vbscript:`, or with `data:` or
`file:` followed by a non-space. The decoded value must also re-encode with
the output's JSON flags (a probe), or the save is refused. Duplicate keys
are accepted (the last wins, as JSON allows); the dialog warns about them.

A refusal keeps `errors['schema.custom']` as a sentence and adds
`error_paths['schema.custom'] = {item, path}` (item index, JSON pointer), so
the dialog can put it on a line or a row without breaking existing readers.

*Alternatives:* keep sorting keys (rejected: a form edit would move every
key after a reload, so the JSON tab could not show what was saved); count
32 KB on the stored text (rejected: formatting a paste would push it over).

### 2. Merge in `SchemaGraph`

After the main thing and before custom nodes:

- walk the added JSON; for each leaf path, if `sources` says the module
  emits it, keep the module's value and report a clash `{node, path, kept,
  ignored}`; else set it;
- objects merge at any depth; a list the module emits accepts only selector
  keys (`offers[*]` merges an object into every item, `offers[name=X]` into
  the item named X; a selector that matches nothing is reported);
- `@type` add-only, with a warning when the node is a Product;
- the fills of decision 7 apply as in custom JSON-LD;
- the merged graph is what `features()` and the rules evaluate.

*Alternatives:* one-level merge with whole keys refused (rejected by review:
it refuses all of `offers`, where the expert's needs live); letting added
values win (rejected: the page would stop matching its markup).

### 3. A hand-added main thing

When `schema.main` names a hand-added item and the kind is a plain web page,
the page node's `mainEntity` references it and the item gets
`mainEntityOfPage`. With any other kind the toggle is hidden and a stored
value is ignored and reported.

### 4. Module ids and short ids

`SchemaGraph::MODULE_IDS` lists every id the module emits with its anchor:
`identity`, `logo`, `website`, `return-policy` on `{home}`; `webpage`,
`primaryimage`, `primary`, `group` on `{url}`; and the reserved prefix `c-`
on `{url}` for component parts. `read-page-components` adds `breadcrumb`.
A unit test builds every fixture graph and fails when a node id is not on
the list. In hand-added JSON a short id `#‹name›` on the list resolves to its
anchor, so `{"@id": "#identity"}` points at the site's identity from any
page; other `#name`s stay on the page URL. Minting, the TS validator and the
paste re-pointing read the same list (served in `/state`).

A post-update (`canvas_metatag_post_update_own_jsonld_as_written`) walks
page translations and template settings: it pretty-prints stored text with
two spaces in its stored key order (values over 64 KB as written are skipped
and listed); renames a top-level `@id` on the list, or the second of two
equal ones, to `‹id›-2`, rewriting references to it in the same text; and
puts a renamed item that was dropped from the output before into
`schema.skip`, so no page's output changes. Every change is listed in the
update's output. Reading a value written before the update applies the same
rename in memory, so Canvas drafts saved earlier still load.

### 5. Rules for hand-added types

`data/search-features.json` gains entries for employer rating, review
snippet (Review and AggregateRating on the documented item types), Q&A
(QAPage with a Question as its main thing), discussion forum, image
metadata, software app and movie. No dataset entry is added (its results
feature is being phased out), so a Dataset reads "No search feature". Each
entry and documented name gains:

- `about`: an own-written line ("A company's rating by the people who work
  there."), translatable through `/state` like registry strings;
- `expects` per name: `text`, `number`, `number|text`, `date`, `datetime`,
  `date|datetime`, `duration`, `url`, `bool`, `enum:‹A›|‹B›` or
  `item:‹Type›|‹Type›` with optional `needs` (names the item must carry) and
  `max` (lengths);
- `say`: the item's sentence for the item list, with clauses that drop when
  their value is missing;
- `confirm` lines where the documentation sets a condition no machine checks
  ("Only if visitors can post ratings on this site").

`features()` and the TS mirror check `expects` on the merged, filled graph:
a required name with the wrong shape is missing, with the expected shape in
the verdict ("Needs author as a person or organization"). The rules' review
date and source addresses work as in rethink.

### 6. One text, two views (client)

`extension/src/custom/` holds the sheet. `doc.ts` wraps `jsonc-parser`
(`parseTree`, `modify`, `applyEdits`, `getLocation`, with
`disallowComments: true` and `allowTrailingComma: false`). The text is the
truth while the sheet is open; Form is a projection of it
(`project(text, vocabulary | null, rules, graph)`, pure, run on a 150 ms
pause, with null-prototype maps so a `__proto__` key stays a row). A form
commit is `applyEdits(text, modify(text, path, value, {insertSpaces: true,
tabSize: 2}))`, so only that value's bytes change. Round-trip rules, each a
vitest (R2 also a property test with `fast-check`):

- R1 switching tabs changes no byte; R2 a form edit changes only its value's
  bytes and the comma or indent `modify` needs; R3 key and item order are the
  text's (needs go after `@id`, added details at the end of the item, new
  items at the end); R4 a number keeps its spelling in storage until edited
  (the output normalises it); R5 a value keeps its JSON type until edited;
  R6 unknown keys, types and shapes are kept in place; R7 whitespace and
  escapes are kept unless Format, a paste clean-up or a fix runs; R8
  normalisation only on paste or an explicit fix, reported, undoable; R9 what
  is saved is what reloads; R10 invalid text is held, not sent, and survives
  leaving (decision 10); R11 an item with a duplicate key is locked in Form;
  R12 a linked value is exactly a whole-value brace name; R13 a single object
  becomes a list when a second item is added, said in the bar.

"Describe it here" writes a nested object in place. It does not count toward
the 10, is not in the item list, and gets an `@id` only when something must
point at it; when a second item points at it, it moves to top level in one
edit ("‹Acme Logistics› is now its own item so both can use it." with Undo).
Inline nesting goes two levels deep; a third level is a summary line with
"Edit in JSON".

The tabs use the header's pill style and automatic activation; focus stays on
the tab while the target row or line is scrolled to the middle and washed;
"Edit in form" is the command that moves focus. The header Back goes up one
level and closes the sheet only at the top; Escape does the same. The tab is
remembered in `localStorage` (try/catch), default Form.

### 7. Values in hand-added items

Controls come from `expects` (or the vocabulary's ranges when downloaded)
and the value's actual shape; the shape wins, so nothing is coerced. They are
`populate-every-schema-type`'s controls, driven by a shape, and
`link-values-to-fields`' linked box and link menu:

- text, multi-line for long text; number with a text fallback when the name
  also takes text (`ratingValue` may be "85%"); URL as `type="text"
  inputmode="url"`; Yes/No with "Not set"; enumerations as a select (six or
  fewer), the code picker or checkbox rows;
- date; date and time with a time zone select (default the site's) that
  stores the offset computed for that date with `Intl` and recomputes it when
  the date changes; for date-or-datetime names the time is optional and the
  offset is required once a time is set; a pasted `Z` or offset is kept;
- an item: a menu button (choices: the site's identity, this page, this
  page's main thing, other hand-added items, filtered by what the name
  expects and by presence in the current graph; commands: "Describe it
  here", "Just a name"). A module item renders as a read-only linked box with
  "Add details to ‹name›";
- an image: `"{media.‹uuid›}"` written in JSON (there is no image chooser in
  the sheet, proposal "Narrowed in review" 6), filled at render to
  the file's public address; at template scope a link to an image field;
- at template scope any value can be linked: the whole value becomes
  `"{field.‹name›}"` or one reference hop `"{field.‹name›.‹name›}"`, filled
  through `Sources::evaluate()` with link-values' empty, hidden and broken
  states; linking a text field to a name that expects an item writes
  `{"@type": "‹first expected type›", "name": "{field.‹name›}"}`.

The fixed names keep filling inside any text. `{field.…}` and `{media.…}`
fill only as a whole value; inside other text they stay literal and the
sheet and Checks say so. When a fill is empty: the leaf is removed; an object
left with nothing but `@type`, `@id`, `bestRating` or `worstRating` is
removed; empty list elements and empty lists are removed; a top-level item
with nothing but `@type` and `@id` left is removed. A value is a number only
when the field stores numbers and the name expects one. A multi-value field
into a one-value name takes the first value (amber line). Datetime fields
are emitted in the site's zone with an offset, date-only fields as
`YYYY-MM-DD`. A filled text value is cut at 5,000 characters at a word
boundary; an emitted graph over 256 KB leaves out hand-added items and added
details, keeps the module's nodes, and is to fix.

### 8. Paste

`clean.ts` runs only when the box is empty, the paste replaces all of it,
the caret is between top-level items, or the text contains `<script`; a
paste inside a value is typing. In order: a 512 KB gate; BOM, code fences
and leading prose removed; JSON-LD script blocks extracted with `DOMParser`
(inert: its nodes are never adopted into the document) and merged; microdata
or RDFa noted, not imported; strict parse (on failure the text is kept with
its problems); a top-level list, `@graph` and per-item `@context` flattened;
a schema.org `@context` and `@language` dropped (another context stays and is
red); `schema:` and full schema.org names shortened, and `type`/`id` read as
`@type`/`@id` only when the context was schema.org's; `null`, `""`, `[]` and
`{}` dropped (never `0` or `false`); `@value`, `@list` and `@set` unwrapped,
keeping the value in the page's language; blank nodes `_:x` and relative ids
named; this site's absolute module ids turned into short ids; integers above
2^53 turned into text; HTML-escaped text and other systems' placeholders
flagged; items without an `@id` given one (never a module id; ASCII-folded;
`-2`, `-3`); formatted with two spaces when that fits 64 KB. Each step that
changes something adds a clause to the one-line report.

The paste goes to review (shared with `add-advanced-meta-tags`' "Paste a
snippet") when it has an item the page already makes (same `@id`; the main
thing's type family with the same `url`, `name` or `sku`; a page or site
type; an organization whose `url` or `sameAs` matches the identity), more
than 10 items, or more than 32 KB. Unticked items that match a module node
re-point references to its short id; other unticked targets are counted
("2 links will point at nothing"). The tab the paste came from is the tab
the editor ends on. The pasted text is never sent or stored; only added items
are.

### 9. Problems and verdicts in the sheet

Red is exactly decision 1's refusals plus syntax, and `validate.ts` (a TS
mirror of `Values::custom()` with paths) runs the same fixtures as
`ValuesTest` under `tests/fixtures/custom/`. Syntax words come from
`jsonc-parser`'s error codes, placed on the line where the fix goes. Amber
never blocks: relative or schemeless addresses, duplicate keys, name advice
(documented names, or the vocabulary when downloaded), enumeration near
misses, unknown or superseded names, page-level types, positions out of
order, identifier names holding numbers, hidden characters, HTML-escaped
text, mixed-text field names, two described objects with one `@id` and
different values. Verdicts are extend's live mirror on the merged graph; on
a template they are for the previewed item.

### 10. Drafts that are never sent

The model gains `drafts`, keyed by target, language and field. Text with a
red problem stays there, is never written, and is mirrored to `localStorage`
(try/catch). Following another page keeps it; reopening the target offers
Restore or Discard. Undo stays the model's one slot: the bar offers it after
a removal, a clean-up, a type change, a move to top level and an unlink, and
Ctrl/Cmd+Z in the textarea right after a programmatic change routes to it.

### 11. The vocabulary

`Vocabulary::build()` trims a schema.org release to what the form needs:
types (label words, parents, own properties, first definition sentence,
pending or superseded), properties (domains, ranges, first sentence,
replacement) and enumeration members; datatypes, enumeration classes and
retired terms are not offered as types. The pinned release is fetched only
by `drush canvas-metatag:vocabulary [--release=…]` (https only, 4 MB, 20 s),
written to `private://canvas_metatag/vocabulary-‹release›.json` (`public://`
without a private path) with its source, release, licence and attribution.
`GET /canvas-metatag/api/vocabulary?r=‹release›` serves it with the dialog's
state access and `Cache-Control: private, max-age=31536000, immutable`; it
answers 404 when none is installed. `/state` reports `vocabulary: {release}
| null`. The status report says which release is installed and whether the
module pins a newer one. The same `build()` feeds the CI lint. The client
fetches it the first time the sheet opens, in the background.

### 12. Live verdicts

`extension/src/features.ts` mirrors `features()` on the `/state` graph
patched with the dialog's unsaved values by path. One fixture file
(`tests/fixtures/features/*.json`) is run by `SearchFeaturesTest` and
`features.test.ts`, so both agree. Component-derived values are not
patched; the stage shows "Draft" until Canvas's round trip.

### 13. Delivery fails closed for structured data only

`CanvasMetatagHooks::head()` encodes the JSON-LD script on its own; an
encode error leaves out that script, keeps every other tag, logs once and
adds a "to fix" report member. The headless head does the same.

## Risks / Trade-offs

- [Merge surprises] → the sheet shows the merged node's verdicts and every
  clash by path before saving.
- [Mirror drifts from PHP] → the shared fixtures fail CI on both sides.
- [32 KB shared cap] → the sheet shows bytes left, including added details.
- [Scope lands while the workflow runs] → task groups each leave the module
  working; the vocabulary and template links come last.
- [Form-first slows experts] → paste works from Form; the tab is remembered;
  the caret line brings the form's knowledge into JSON.
- [Arbitrary types invite markup nobody sees] → hidden text stays to fix;
  "No search feature" types say search engines may ignore them; no score.
- [Licence] → the site downloads the vocabulary; the shipped `about` lines
  are the module's own words; nothing shipped depends on the download.
- [Stored as written] → validation is unchanged or stricter; output always
  re-encodes with the hex flags; `ValuesTest` re-encode cases change on
  purpose; the probe and fail-closed head cover non-finite numbers.
- [Whole-value field names fill again] → only whole values; the post-update
  lists every stored value that starts filling.
- [Bundle growth] → one library; a CI budget at the measured size plus 5 KB.

## Migration Plan

New keys `schema.extend` and `schema.main`. One post-update re-formats and
renames as in decision 4 and lists whole-value `{field.…}` names that start
filling; templates get a one-time config diff (release notes). Rollback:
remove `extend` and `main` before downgrading; the previous cleaners refuse
unknown keys on the next write, and re-sort custom JSON-LD when it is next
saved.

## Adapted during implementation

- Paste reads script blocks with a regular expression on the pasted text,
  not `DOMParser` (decision 8): a script element's content is raw text up to
  its first `</script>`, nothing is parsed as markup, and the clean-up stays
  testable without a DOM.
- Drafts with a problem live in `extension/src/custom/drafts.ts` (memory for
  the dialog's life, mirrored to storage), not in the model (decision 10):
  only the sheet reads them.
- `Values::clean()` gives the error paths through an optional by-reference
  argument, so its two-element result stays as every caller reads it.
- A stored value with a number that cannot be written out is refused by read
  mode before output (decision 13): the head keeps every tag and only that
  item goes. `Resolver::script()` still guards the encoding of the whole
  graph.
- The rules file marks the new entries `only: hand` (judged only on top-level
  hand-added items) or `only: page` (Q&A, on the page node), adds `labels`
  for types whose name in words is not a label, and `subtypes` for type
  checks without the vocabulary.
- The pinned vocabulary release is 30.1.

## Canvas internals relied on

None new. Field links go through `Sources` (`link-values-to-fields`).

## Review round 2: accepted edge

A stored text that read mode partly refuses (an item stored before a rule,
such as `1e400` from a config import) reaches the dialog as the read-mode
text without that item, with "Show it" while `target.refused` names it. The
next write of any value stores the working copy, so the refused item is gone
for good, and "Show it" with it. Accepted: such values could not be stored
through the dialog or the API, the item could never be output, and "Show it"
offers it before any write. Carrying the stored text unchanged until the
editor edits `schema.custom` would add a second source of truth to the draft
for values the module never wrote.

The fail-closed branch of the head (`schema.unencodable`) is reachable only
through a value no fill gives: a number field filled as text keeps its
digits as a string, and one filled as a number is finite. It stays as a
guard, tested at `Resolver::script()`.
