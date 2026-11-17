# Design

## Context

Today a value is a map with exactly one key (`src/Values.php`, docblock and
`value()`):

```
{text: string}      typed; never scanned
{fact: Fact}        one of the module's facts
{media: uuid}       image places only
{source: {sourceType: 'entity-field', expression}}   templates only, no adapter
{node: uuid}        a picked page (populate-every-schema-type)
```

plus `{source, unit}` for a linked duration. Every place has a kind (text,
address, date, number, image, html, ref, hours). A link fits a place when the
kind is among the kinds of the vocabulary row that `Sources` builds from
Canvas's `PropSourceSuggester`. A link that is empty, hidden from visitors or
broken gives the place's default as a whole (`Values::texts()`,
`SchemaGraph::build()`).

Composition exists in three places only:

- the title, by structure: main part, separator, ending;
- JSON-LD list properties with `join` (keywords, cuisine);
- custom JSON-LD strings, which fill nine fixed names anywhere inside them.

`extend-structured-data-by-id` adds whole-value `{field.x}` and
`{media.uuid}` inside hand-added JSON-LD; mixed text stays literal there.

Canvas offers no way to join text. Its `AdaptedPropSource` takes several named
inputs, but only through an adapter plugin whose inputs are fixed and typed,
it fails as a whole when one input is hidden, it is internal, and its own
docblock warns that the UX "could easily be overwhelmingly complex". Its
adapters are day count, Unix timestamp to date, and three image adapters.

The dialog never evaluates a field itself. `GET /state` sends one row per
vocabulary entry with the previewed item's value (`Resolver::sourceRows()`),
the client resolves values from those rows (`values.ts resolve()`), computes
the texts with a twin of `Values::texts()` (`model.ts texts()`), and replaces
them with the server's texts once nothing is unsent. Parity of the two text
rule sets is pinned by `tests/fixtures/text-cases.json`.

Line numbers drift while `populate-every-schema-type` and
`extend-structured-data-by-id` land, so each task re-reads its code first.
Examples assume a site whose default country is the United Kingdom, so an
English date reads "20 June 2026" (D5).

One principle runs through every decision: **composition adds to the link
model, it never replaces it.** A value of one field is the link it is today,
stored the same way, shown in the same box and handled by the same keys.
Composing is a step out of that box, never a different reading of it. Every
part of a composition is a value the module already knows how to check,
evaluate, cache and describe.

## Goals / Non-Goals

**Goals**

- A builder writes "‹Title› in ‹City› · ‹Date›" in one control, by mouse or
  keyboard, starting from the default or a linked field, and sees what the
  previewed item gets while writing it.
- A typo, an unknown field, a field of the wrong kind or a malformed shape can
  never be stored, by the dialog, configuration import or a recipe.
- An empty, hidden or deleted field never leaves a dangling "in", "·" or
  "Tickets for", and the dialog shows which words go with which field before
  an item lacks it.
- Nothing stored today changes, and the 80 % case (one field, or the default)
  looks and works exactly as it does now: the same box, the same keys, the
  same Tab stops, the same role.
- The head, the headless content API and JSON-LD carry the same text the
  dialog shows, escaped and cached correctly, with dates and numbers read
  correctly in every language with no configuration.

**Non-goals**

- Composition on pages, in Site settings, in the title ending, or in
  hand-added JSON-LD.
- Formatting choices on a field, fallback text per field, or translation of
  typed words.
- Making the social title follow a composed search title. It keeps following
  the Title fact; its menu offers to copy the search title's composition
  (D9), and the copy is then the builder's own.

## Decisions

### D1. A composition is a list of parts, never a string

A fifth exclusive key:

```
{parts: Part[]}
Part := {text: string}      typed; never scanned
      | {fact: Fact}        a fact that fits the place (D3)
      | {source: Source}    one Canvas entity-field source, no adapter
```

Example, "‹Title› in ‹City› · ‹Starts›":

```
{parts: [
  {fact: title},
  {text: ' in '},
  {source: {sourceType: entity-field, expression: 'ℹ︎␜entity:node:event␝field_venue␞␟entity␜…␝field_city␞␟value'}},
  {text: ' · '},
  {source: {sourceType: entity-field, expression: 'ℹ︎␜entity:node:event␝field_starts␞␟value'}},
]}
```

**Canonical form** (`Values::canon()` and its TypeScript twin `prune()`):

- neighbouring text parts merge into one;
- an empty string part is dropped;
- whitespace before the first field or fact and after the last is trimmed: it
  can never change the output, because head texts are trimmed anyway, and
  without the trim "‹Title›␠" would be a composition that looks and compares
  unlike the link it equals;
- whitespace between fields is **kept** as typed, so "‹First› ‹Last›" keeps
  its space. Today `Values::value()` turns blank text into nothing and
  `canon()` prunes blank strings, so parts get their own cleaning path;
- a list of one fact or one source and no text is stored as that fact or
  source; a list of text only is stored as `{text}`; an empty list is no
  value.

So every value stored today is already canonical, and a composition of one
field is byte for byte the link it replaces. `sameValue()` and the rule that
a value equal to what it inherits is not stored compare canonical forms.
`ApiController::carry()` compares raw values today (`$kept ===` the sent
value), so it is changed to clean the sent value in read mode first and
compare canonical forms (D3).

**Config schema and its constraint.** `canvas_metatag.value` gains `parts`, a
sequence of `canvas_metatag.value_part`: a mapping with `text`, `fact` (a
Choice narrowed to the facts that fit text: `title`, `description`, `site`,
`author`, `published`, `modified`) and `source` (the existing source
mapping). A module validation constraint on `canvas_metatag.value` and
`canvas_metatag.value_part` runs `Values`' shape rules: exactly one key,
`parts` only at the value level and never nested, no empty part list, at most
eight facts and sources. Configuration import, recipes, Canvas's draft
validation and `make-the-module-agent-ready`'s `set` then refuse a malformed
composition with its config name and path (decisions.md, item 13), instead of
read mode dropping it silently. What the constraint cannot know (whether a
source is offered by the bundle) stays in `Values::clean()` with the `accepts`
callable.

**Alternatives.**

- *A template string* such as `"{title} in {city}"`. It brings back parsing,
  an escape syntax for literal braces, typos that fail silently, and two
  parsers kept in step in PHP and TypeScript. Typed text is "never scanned"
  (dynamic-values), and parts keep that promise without exceptions.
- *A Canvas adapted source* (`AdaptedPropSource` with a module adapter
  plugin). It persists a second, larger Canvas grammar (`adapter:*`,
  `adapterInputs`, `static:field_item:*` envelopes for every literal), needs
  a variable-arity adapter Canvas does not have, and evaluates all or
  nothing, so per-part empty and hidden states are lost. It would also put a
  second Canvas API into stored data, outside `Sources`. Rejected.
- *Storing every value as parts and migrating.* It rewrites every template
  and page revision for no gain, and every later change would read two forms
  of the same link.

### D2. Composition is for text people read, at template scope

| Place | Composes | Why |
|---|---|---|
| Template title, main part | yes | the headline case |
| Template description, social title, social description | yes | prose |
| Template structured data detail marked `compose: true` in the registry (name, headline, alternate name, description, a street address line) | yes | prose, or joining split fields ("‹Street› ‹No.›") |
| Template title ending | no | one value keeps its menu, its fallback to the site ending and the repeated-name fix certain |
| Choices, codes, currencies, postal codes and every detail not marked | no | the joined text could never be one of the options, or a machine parses it |
| Images, addresses, dates, numbers, durations, references, opening hours, formatted markup (`html`) | no | a machine parses them; formatting follows the place (D5) |
| Text lists and `join` properties | no | each item is one value; they are already joined |
| Hand-added JSON-LD | no | D15 |
| Every page value | no | a page's text is the editor's own words, and its only tokens would be facts of itself |
| Site settings | no | there is no item to read fields from |

Structured data details opt in: the registry (`data/schema-types.json`)
gains `compose: true` on the props that compose, and
`RegistryConsistencyTest` checks that only text props without `options`,
`pattern`, `list`, `join` or `html` carry it. Inferring "free text" from
missing keys would silently opt in postal codes and every future text prop.

`Values` gets one predicate, `composes(?array $prop, string $path, string
$scope)`: the four head texts at template scope, and a structured data detail
at template scope whose registry prop says `compose: true`. Validation,
`SchemaGraph`, `Resolver::target()`, `broken()` and Checks use it. The client
computes the same predicate from the registry it already receives (no
per-path boolean in the state, which would go stale when the editor switches
the structured data type before saving), pinned by a shared fixture.

Two kinds of composing place matter for long text (D5): **title-like**
places (the title's main part, the social title, a name, a headline, an
alternate name, a street address line) and **description-like** places (the
description, the social description, a structured data description).

### D3. Writes check every part, in a form that says what the place wants

**The `words` form.** A place that composes reads every field and fact as
words for people (D5), so a reader must be told which form a place wants.
Today `Values::texts()` asks for kind `text` for the title and its ending
alike, and `SchemaGraph` asks for `text` for names and enum details alike
(`Values::KINDS` maps `enum` and `currency` to `text`). So the form is
explicit: kind `words`.

- `Values::texts()` passes `words` for the title's main part, the description
  and the social texts, never for `title_end`.
- `SchemaGraph::build()` and `Resolver::target()` pass `words` for a detail
  where `composes()` is true, and the detail's kind otherwise.
- `Sources::problem()`, `evaluate()` and `sourceFor()` map `words` to a row
  whose kinds include `text`, `date` or `number`; it reads the row's `kinds`
  and never the expression. `sourceFor()` ranks text, then date, then number.
- `ApiController::broken()` checks a value with `words` where `composes()` is
  true; the client's `resolve()` and `textOf()` do the same.

So a lone date link in the description, which this change accepts, is the
one-part composition it looks like, read in words, and never "broken" in the
head, the dialog or Checks. Before this change such a link was refused, so no
stored value changes meaning.

**Write rules.** `Values::value()` handles `parts` in write mode:

- the place must compose (D2), else "This setting is not available here.";
- each part must be exactly one of `text`, `fact`, `source`, else "This value
  is not valid." A media item or a picked page as a part is not valid;
- a text part is stripped of controls and bidi overrides, as typed text is;
- a fact part must fit text (D5): Title, Description, Site name, Author, First
  published, Last updated. Page address and Image do not fit: "Choose a value
  from the list.";
- a source part must fit `words`: `Sources::accepts($bundle, $source,
  'words')`, else "Choose a field from the list.";
- in a title-like place, a part that is long text (a formatted text row, or
  the Description fact) is refused with "Choose a field from the list.", as
  the menu does not offer it there (D5). A whole link keeps today's rule;
- at most eight fact and source parts, else "Use at most 8 fields in one
  value." Eight bounds evaluation (D8) and keeps a composer readable at the
  dialog's width;
- the typed characters of all text parts count against the place's maximum
  (255, 1000 or 2000), as typed text does today. Fields count as nothing when
  stored; the output is cut after joining (D7).

`Values::schema()` checks `composes()` before folding, and runs `propError()`
and `literal()` on the folded value, so a parts value of text only can never
bypass a prop that may not be typed.

**Refused parts never block the text around them.** One deleted field must
not lock every word around it. The grandfathering happens in validation,
where the path is known, not in `carry()`: before `Values::clean()`, the
controller collects the sources stored in each path's value (the stored
template and its draft, read in read mode), and the write-mode `accepts`
callable takes the path and returns true when `Sources` accepts the source
**or** that source is already stored in that path's value, at any position.
`carry()` stays for whole values and compares canonical forms (D1). A new
unknown expression is still refused.

### D4. Which words go with which field

A composition is joined by one fixed rule. A **run** is the typed text
between two fields or facts, before the first, or after the last.

1. **The lead-in** (the run before the first field or fact) goes with the
   first field, unless its last character that is not a space is label
   punctuation (`:` `.` `!` `?` `…` `|` `·` `•` `–` `—` `-` `/`); then it
   always shows. "Tickets for ‹Performers›": "Tickets for " goes with
   Performers. "Tickets: ‹Title›": "Tickets: " always shows.
2. **A run between two** goes with the field after it, except a closing mark
   at its very first character, which goes with the field before. A closing
   mark is a closing bracket (Unicode `Pe`), or a quote (`Pi`, `Pf`, `"` or
   `'`) that is directly followed by a space, punctuation or the end of the
   run. So in "‹Title› (‹City›) · ‹Starts›" the ")" goes with City, in
   „‹Subtitle›“ · ‹Starts› the “ goes with Subtitle, and in
   "‹Brand›'s ‹Title›" the "'s " goes with Title.
3. **A run that goes with the field after it shows only when that field
   gives a value and some field or fact before it was kept.** So a connector
   never starts the result: "‹City› · ‹Starts›" without a City gives
   "20 June 2026", never "· 20 June 2026".
4. **The run after the last** goes with the last field. When it holds only
   separator characters (`·` `•` `|` `–` `—` `-` `/` `,` `;` `:`) and spaces,
   it never shows, so removing the last field from "‹Title› · ‹Starts›" can
   never put "Summer Gala · | Example" in a head. A unit or symbol (" €",
   " km") still shows with its field.
5. A field or fact that gives nothing for the item (empty, hidden or broken)
   is left out together with the runs that go with it.
6. When every field and fact gives nothing, the value gives its default, as
   an empty link does today, and text alone is never emitted.

Worked examples, for "Summer Gala" in Helsinki on 20 June 2026:

| Composition | Missing | Result |
|---|---|---|
| ‹Title› in ‹City› · ‹Starts› | City | Summer Gala · 20 June 2026 |
| ‹Title› in ‹City› · ‹Starts› | Starts | Summer Gala in Helsinki |
| ‹Title› (‹City›) · ‹Starts› | City | Summer Gala · 20 June 2026 |
| ‹Title› – ‹Price› € | Price | Summer Gala |
| ‹City› · ‹Starts› | City | 20 June 2026 |
| ‹Performers› at ‹Venue› | Performers | Royal Hall |
| Tickets for ‹Performers› in ‹City› | Performers | Helsinki |
| Tickets: ‹Performers› in ‹City› | Performers | Tickets: Helsinki |
| ‹Brand›'s ‹Title› | Brand | Lamp |
| ‹Title› "‹Subtitle›" | Subtitle | Summer Gala |
| ‹Title› · (the last field removed) | none | Summer Gala |
| ‹First› ‹Last› | First | Last name only, trimmed |
| ‹City› ‹Starts› | both | the place's default |

The rule runs in `Values::compose()` and in its twin in `values.ts`, and
`text-cases.json` gains a composition table, holding every row above, that
both test suites read.

**The rule is visible while editing** (D9): a hovered chip, or the chip beside
the caret, is tinted together with the words that go with it, and the result
line shows what an item without it gets ("Without Performers: Helsinki").
So a builder sees the bad case before any item has it. The link menu's footer
in add mode says the rule once: "When an item doesn't have a field, the words
joining it are left out too."

**Alternatives.**

- *Drop the text before an empty field.* Gets "‹Title› – ‹Price› €" wrong
  ("Summer Gala €").
- *Keep text only when both neighbours have a value.* Gives "Summer Gala20
  June 2026".
- *Store which field each text goes with, chosen in the editor* ("Goes with
  ‹Price›"). It handles a unit written before the next field ("‹Price› € ·
  ‹Title›"), but every chip needs an extra control for a rare case. The fixed
  rule decides the common cases, the tint shows its answer, and the stored
  shape can take an optional key on a text part later without a migration
  (proposal, decision 17: the fixed rule was taken).
- *Fallback text per field*, as messaging tools have ("Hi ‹first name|there›").
  It suits greetings; SEO texts are mostly "‹A› · ‹B›", where leaving the part
  out is the better fallback. Also not taken (decision 17).

### D5. Fields read as words in text, and only the server formats

In a place that composes, every field and fact gives text for people to read,
whatever its kind. The same field in a date or number place keeps its
machine form.

`Sources` stays the one class that holds Canvas code: it returns the machine
value plus the row's metadata (scale, the shown expression of a list, the
`html` flag, the leaf type). All formatting for people happens in one
Resolver-side helper, `Words`, used for fields and facts alike, so a date
field and the First published fact can never be formatted two ways.
`strengthen-zero-config-defaults` reuses the same helper for its share card's
date (amendment), so a card and a title never disagree.

| Field or fact | In words | In its own kind (unchanged) |
|---|---|---|
| Date, datetime, First published, Last updated, a number row whose leaf type is a timestamp | the date without its time, long style, in the item's locale (D12); a date-only value is never put through a timezone | ISO 8601 with offset; date-only stays a date |
| Integer | its stored digits, no grouping ("2026", never "2,026") | its digits |
| Decimal | its digits to the field's scale, in the item's locale ("49,90" in German, "1.234,50" with grouping) | its digits without trailing zeros |
| Float | the shortest form that reads back the same | as stored |
| Text list | its label, in the item's language | its stored key |
| Reference | the label of the referenced item, in the item's language | the same |
| Formatted text, the Description fact (long text) | alone: as a link to it gives today; in a composition: the budget left (below) | the same |
| Several values | every item visitors may see, joined with the language's list separator; in a title-like place at most two and "and ‹n› more" (D6) | the first, or every item on a list property |

- **The item's locale** is the item's language with its own region when the
  langcode has one (`pt-br`, `de-ch`), else with the site's default country
  (`system.date:country.default`), else the language alone.
- **Dates** use `IntlDateFormatter` with the LONG date style and no time, in
  that locale, in the site's timezone, except a date-only value, which is
  formatted as the date it is. English with the United States gives "June
  20, 2026", with the United Kingdom "20 June 2026"; German "20. Juni 2026";
  Finnish "20. kesäkuuta 2026"; Japanese "2026年6月20日". Without the `intl`
  extension, the helper calls core's date formatter with the custom pattern
  `j F Y` in the item's language. No date format is installed and no module
  setting is added: the right date in every language is zero configuration.
- **Decimals** use `NumberFormatter` (DECIMAL, minimum and maximum fraction
  digits equal to the scale) in the same locale; without `intl`, the digits
  with ".". Integers stay ungrouped, because they are years and counts.
- **Timestamps offered as numbers** (a custom timestamp field, or a hop such
  as Venue › Authored on, which `LEFT_OUT` does not exclude because it checks
  only the host field) read as dates, never as Unix seconds. A
  `SourcesTest` contract case pins how Canvas offers them.
- **List labels** are read in the host's language: the helper sets the config
  override language to the host's langcode around the read, as core's
  `DateFormatter` does, because Canvas computes the label in the interface
  language and a public head drops that cache context.
- **Long text in a composition.** A long-text part (a formatted text row or
  the Description fact) gets the room left: about 155 characters minus the
  rest of the result, and at least 70. It is cut at the last whole sentence
  within that room, else at a word with "…". So "‹Body› Free delivery." keeps
  its call to action inside a search snippet and never reads "…dolor sit
  Free delivery.". Title-like places do not offer long text: such rows wait
  in the menu's last row with "Too long for a title" (D3).
- **Never relative, never a time of day.** "Tomorrow" would be wrong in a cached
  head the next day, and a time makes titles long. A time of day would be a
  formatting choice on a field, which link-values put out of scope.
- **The dialog never formats.** `Resolver::sourceRows()` gives each row a
  `text` member, the server's words for the previewed item, and each date
  fact gets one too. The client composes those strings. So the preview and
  the head cannot differ.

The text list label is a deliberate change to existing output: a description
linked to Event status read `EventScheduled` and now reads "On as planned".
The archived change accepted the key as a regression; the release note names
the fix.

**Alternatives.**

- *Format choices on a date chip* ("20 June 2026", "Jun 2026", "2026"), each
  shown as an example. It adds a control to every date chip for a title that
  nearly always wants the full date.
- *One installed date format, `j F Y`, translatable per language.* Through
  core's formatter it is right only in British English and French; German,
  Finnish, Japanese and American English all need a hand-made pattern per
  language, so the zero-config result is wrong on most sites. Rejected.
- *A data file of decimal marks by language.* It misses regional variants
  and grouping, and duplicates the locale data `intl` already has.

### D6. A field with several values gives every item visitors may see

Taken with the recommended option on 2026-11-17 (proposal, decision 16). In
words, the form of every place that composes (D3), a field with several
values gives every item an anonymous visitor may see, alone or composed. A
one-part composition stays exactly that link (D1), so the rule is the same
for a lone link and a part.

- **Which items.** Every item in field order, each read in words (D5) and
  made plain on its own. An item visitors may not see (a referenced performer
  that is unpublished, a denied hop) and an empty item are left out and not
  counted; their cacheability is kept (D8). With no item left, the field
  gives nothing, and D4 rule 5 leaves it out with its words.
- **The separator.** The language's list separator: the middle separator of
  the item locale's (D12) standard list pattern, read from ICU's locale data
  through `intl` (", " in English, German, French and Finnish, "、" in
  Japanese, "، " in Arabic); without `intl`, ", ". So "‹Title› with
  ‹Performers›" reads "Summer Gala with Ada, Grace, Hedy" in a description.
- **Title-like places** (D2: the title's main part, the social title, a
  name, a headline, an alternate name, a street address line): at most two
  items, then a translatable, plural-aware tail, `formatPlural()` with
  "@items and 1 more" and "@items and @count more", in the item's language:
  "Summer Gala with Ada, Grace and 1 more". One field cannot blow a title's
  length. Two items or fewer read in full.
- **Description-like places** give every visible item; the place's own cut
  (D7) and a long-text part's budget (D5) apply after joining.
- **Outside words nothing changes.** A date, a number, an image, a choice, a
  code, the title ending and every place that does not compose keep the
  first item, or every item on a list property (`populate-every-schema-type`),
  so a choice detail linked to a multi-value list field still gives one code.
- **What the dialog says.** In a place that composes, a multi-value row of
  the link menu shows its joined words for the previewed item ("Ada, Grace
  and 1 more") and does not say "First of ‹n›", which stays for places
  outside words. The chip's tooltip and the result line show the joined
  words. There is no Checks row and no note on the result line: nothing is
  left out. `populate-every-schema-type`'s value-links "A list fact links
  every item" says that other facts keep "First of ‹n›"; once it is archived,
  task 0.2 narrows that sentence to places outside text.
- **Only the server joins.** `Sources` returns every item's machine value
  with its access result; `Words` reads and joins them, and the row's `text`
  member (D5) carries the joined words, so the dialog never joins or counts.
  The memo key (D7) is unchanged: the join belongs to the field and form.

**Changed output.** A text value already linked to a multi-value field
changes: a description linked to Tags that read "News" now reads "News,
Science", and an event title linked to Performers names every performer up
to two. The release note says so (D13). The archived dynamic-values scenario
"A field with several values" ("Ada") is reversed by this change's MODIFIED
block of "Field values are plain values of the first item", written on the
text `populate-every-schema-type` leaves, and the new requirement "In text, a
field gives every item visitors may see" holds the rule.

**Alternatives.**

- *The first item, said everywhere* ("First of ‹n›" in the menu, the chip
  and the result line, and a Checks row). "Summer Gala with Ada" for an event
  with three performers is a false statement in a snippet. Not taken.
- *Every item in title-like places too.* One field with twenty values would
  push the rest of a title past its cut.
- *The language's "and" before the last item.* The option taken uses the
  list separator, and the title-like tail already brings its own words; two
  "and"s would read badly ("Ada and Grace and 1 more").

### D7. Output: plain parts, joined, then the place's own rules

**One reader per entity.** `Resolver` gets one per-entity reader,
`compose(value, entity, facts, form, memo)`, that reads a value of any shape
for an entity. `resolve()` uses it with the host and its facts; `target()`
uses it with the referenced page and **that page's** facts, so a venue's name
composed as "‹Title› · ‹City›" reads the venue's title, not the event's.
Today `target()` has its own closure that knows only `text` and `source`;
it goes. The memo is keyed by entity id, langcode, part and form.

1. Each fact and source is read in words (D5) and made plain on its own:
   formatted text goes through `Values::fromHtml()` before joining. Typed text
   is never stripped of markup, so a typed "<3" or "a < b" survives.
2. The parts are joined by D4.
3. The joined text goes through the place's existing rules: `plain()` and
   `cut()` for head texts, `title()` for the title, `SchemaGraph::value()`
   (plain, `literal()`, the property's pattern) for a structured data detail.
   A detail that fails is dropped and reported, as a linked detail is.
4. The consumers escape as today: render attributes for meta tags, the JSON
   flags for the JSON-LD script, JSON encoding in the content API. A field
   holding `{site}`, `</script>` or `<b>` stays that literal text.
   `fillFacts()` never runs over a composition.

**The Description fact inside a structured data detail.** `SchemaGraph`
gives a whole `{fact: description}` link the head's resolved description
(`ctx['description']`). A Description part of a composed detail reads the
same, so adding " Free delivery." never silently switches which description
is used.

**Cutting a composed main part.** Today `texts()` cuts the main part to 255
characters with `cut()` before `title()` sees it, and `title()` sees only a
string. So for the main part, `compose()` returns segments (each field or
fact with the runs that go with it) instead of a string. `texts()` skips its
255 cut for segments; `title()` computes the room left after the separator
and the ending, drops whole segments from the end until the text fits, and
only then cuts words. A cut never ends in " in" or " ·".
`strengthen-zero-config-defaults` adds "…" after that (amendment 1).
`model.ts texts()` does the same. This is a guard for the hard limit only;
the length that matters in results, about 600 px, is guidance (D11).

**Headless.** The content API carries the head's strings, so a frontend needs
no change. The raw `parts` value is internal configuration: template editors
see it through Canvas's auto-save and configuration APIs, and it is in
configuration export. The README says so and points frontends at the head.

### D8. Cacheability is the union, and each field is read once

- A composition's cacheability is the union of every part it reads, whether
  that part gave a value or not. An empty field on the node is covered by the
  node's tag; an empty field on a referenced venue needs the venue's tag,
  which Canvas adds when the hop resolves; a denied hop keeps its exception's
  cacheability (`Sources::read()` keeps it today); a broken part adds nothing
  beyond `entity_field_info`, which the head already carries.
- Words add `config:system.date` (country and timezone, already there for
  dates) and, for list labels, the field storage's config tag, so a
  translated label reaches the head.
- `resolve()` memoises by the whole value today, so the same City in the
  title, `og:title` and a JSON-LD name would be read three times. The memo is
  keyed per part and form (D7).
- The real cost of a read is not the account switch but `hostAccess()`, which
  resets the node access cache and re-runs anonymous view access on every
  read. A Sources reader made for one host per `resolve()` computes host
  access once and switches to the anonymous account only around Canvas's
  `evaluate()` calls, so the rest of `resolve()` (facts, URLs, media access,
  aliases) never runs as the anonymous user. A kernel test counts host access
  checks (one per host) and evaluations (one per distinct field and form) for
  a template with three compositions.

### D9. The composer

At template scope, a place that composes is edited as today's box while it
holds one field or follows its default, and in one new control, the
composer, while it holds typed text or more than one field. Everywhere else
the input or box stays as it is.

**The states of a value that composes.**

| Value | Control |
|---|---|
| nothing set | the Default box, exactly as today |
| one field or fact, no text | the box, exactly as today: a combobox, an ×, one Tab stop; a click anywhere on it, its value or its empty tag line included, opens "Link ‹Field›" |
| empty with focus (after unlinking), or typed text only | the composer, looking like today's input |
| text and a field, or several fields | the composer, with its chips and a result line |

While it has focus, a composer stays a composer even when its content folds
to one field or none: the control's own state wins under the caret. When focus
leaves, a lone field shows as its box again, and an empty value as the Default
box.

**Composing is a step out of a box.** On a box (linked, or the Default box):

- Arrow Right or End turns it into the composer holding that field as a chip
  (for the Default box, the default's fact becomes a real chip), with the
  caret after it;
- `{` does the same and opens "Add a field to ‹Field›" at the caret;
- the link menu's top level, with an empty filter, has one more row beside
  Unlink: "Add words or fields", with the detail "Keep ‹Summary› and add to
  it" (on the Default box: "Start from ‹Title›"), which does the same.

The social title's menu has one more row while the title's main part is
composed: "Copy the search title", its detail the parts ("Title, “in”, Venue
› City"). It puts a copy of those parts into the social title, which is then
the builder's own; nothing follows anything. Its Default box keeps saying
"Default · Title", and its description adds "each event's own title, not the
search title".

Every other key on a box does what it does today: a printable key replaces it
with a composer holding that key, Backspace, Delete and the × unlink it to an
empty composer, Enter, Space and Alt+Down open "Link ‹Field›". After a pick
in "Link ‹Field›", focus returns to the box, as today. So the box's keys,
role, Tab stop and look are unchanged, and the jump from one line to a chip
line plus a result line happens at the explicit step, never on a keystroke.
Leaving a composer that still holds only the adopted field gives the box back
(the value folds to the link, or to nothing when it equals the default).

**A composer at rest and in use.**

- The chips and typed text sit on the first line(s). Inside the border, in the
  box's value slot, the **result line** shows the item's whole result in the
  box's value colour. It is not editable; a click on it puts the caret at the
  end. A title's result line leaves the ending out, because the ending's
  button beside it shows it; its length is measured on the full title.
- Parts left out for the item are a quiet note after the result: "without
  City". A trailing separator run that rule 4 of D4
  leaves out is drawn muted, with the tooltip "Left out at the end".
- While a chip is hovered, or the caret is beside it, the chip is tinted
  together with the words that go with it (D4), and the result line reads
  "Without Performers: Helsinki", in the quiet style. The line keeps its
  height; it returns to the result when the caret moves on.

**A chip** shows its source as the link menu names it (a path gives way from
its start, so "City" stays in sight), drawn with the box tag's colours. A
filled chip has the link colour; an empty or hidden one is muted with a dashed
outline; a broken one is red and shows its machine name. Its tooltip says
its value or its state in words ("Empty for this event", "Hidden from
visitors", "No longer exists") and "Without City: …". A field labelled like a
fact gets its machine name, as the menu disambiguates two fields ("Summary
(field_summary)"), so a Description fact and a field labelled "Description"
are two different chips. Chips are as tall as the text line, so typed text
and chips share a baseline and the line never jumps. They wrap as units. A
chip has `spellcheck="false"`.

**The link button's name follows the value alone**, never where a caret was:

| Value | Button | Menu | Pick |
|---|---|---|---|
| empty | "Link ‹Field› to a field", link icon | "Link ‹Field›" | links the whole value |
| a box (one field, or the default) | "Change the link for ‹Field›", link icon, out of the Tab order | "Link ‹Field›", current entry marked, with "Add words or fields" | replaces the link |
| a composer that holds anything | "Add a field to ‹Field›", plus icon | "Add a field to ‹Field›"; with text only, one more row "Replace the text with a field" | inserts at the last caret, else at the end |

**Keys in a composer.**

| Key or action | What happens |
|---|---|
| `{` or Alt+Down | in an empty composer, "Link ‹Field›"; otherwise "Add a field to ‹Field›" at the caret |
| Enter | the menu at the caret: "Add a field to ‹Field›", or "Replace ‹Source›" when a chip is selected |
| a click on a chip | "Replace ‹Source›", current entry marked, with "Remove ‹Source›" |
| Arrow keys | step over a chip in one press; Shift selects it whole; a selection never ends inside one; a key typed at a chip's edge goes beside it |
| Backspace or Delete beside a chip | removes it whole, announced |
| Tab in, a click on the preview, a jump from Checks | the caret at the end; a jump to one part selects that chip and opens its menu |
| Escape in a menu | closes it, types nothing, and returns focus to its opener: in a composer, with the caret or selection it had |

- The menu is the existing `LinkMenu` with every behaviour it has: filter,
  values, levels, the quiet last row, ranking, the double-click guard,
  placement, short frames. Only its name, its header and footer lines in add
  mode, its extra rows and what "fits" (D5) change.
- In add mode the menu's header says where the field goes ("After “Summer
  Gala in”"), in short frames too, because there the menu may cover the
  composer. The hints row names the verb of the mode: "↵ link", "↵ add",
  "↵ replace".
- `{` is never typed when it opens the menu. Typing `{` into the menu's empty
  filter closes it and types one `{` at the caret, so a brace is two keys
  away. A brace typed into the filter after other text is part of the filter,
  except that a trailing `}` is ignored when matching, so `{title}` then
  Enter, typed from memory of the old tokens, picks Title. Pasted text is
  never searched for braces.
- After a pick in add or replace mode, focus is back in the composer
  synchronously (`flushSync`, as today) with the caret right after the chip,
  so "`{` city Enter, then space · " keeps flowing.
- With eight fields, the menu still opens but says "At most 8 fields in one
  value." and its entries can't be picked; replace still works.
- On focus, when nothing else is in the guidance line, it says "Type { to add
  a field".

**Text.** The composer is one logical line that wraps. Line breaks typed or
pasted become one space; typed text stored with line breaks (a description
written before this change) shows them as spaces and is not rewritten until
edited. The control keeps `dir="auto"`, the target's `lang`, spellcheck on
typed words, `translate="no"`, and `wellFormed()` for lone surrogates. An
input method composes beside a chip, never inside one.

**Copy and paste.** Paste is plain text, braces literal. Copy inside the
dialog puts the selected parts on the clipboard under a private type, so
pasting into another composer keeps the chips that place can take. A chip
the target can't take (another type's template, where expressions are
bundle-specific, or a place it doesn't fit) is left out with the words that
go with it, and the dialog says "Venue › City isn't available here, so it was
left out." A chip is never pasted as its label, which would put the literal
text "Venue › City" into every item. The clipboard's `text/plain` is the
resolved text of the selection only.

**Saving.** Each change is saved like typing today: `edit` per change, the
draft written 400 ms after the last one. The control's own state wins while
it has focus; it is never re-rendered from the stored canonical form under
the caret.

**Undo.** Inside the composer, Ctrl or Cmd+Z and redo cover typing, added,
replaced and removed fields. The action bar keeps its one Undo for menu
actions ("Added Venue › City", "Linked to Summary", "Removed City"), withdrawn
by the next edit as today. Any change from outside the composer (the bar's
Undo, Reset, a fix from Checks, a server refusal, a draft from another tab)
replaces its content and clears its history, so the composer's Ctrl+Z never
reaches past a value the draft no longer holds. A composer has no ×, as a
typed input has none: Reset in the aside removes the whole value, with
"Reset · ‹source› · Undo" for six seconds.

**What is said under the field.** The guidance line keeps its order: an
error, then an issue, then length. It says what was left out only when that
changes the whole value: every field is empty ("City and Starts are empty for
this event, so its default title is used."), or a field is broken
("field_city no longer exists, so it is left out of every event's title."
with "Replace field"). Then the length count is still passed, so "May be cut
off …" on focus is never hidden. A part that is only empty or hidden for the
item is said in the result line's note, the chip and the description, never
in the guidance line, so a composed title keeps its length guidance and its
Checks issue.

**Read-only and nothing to preview.** When the target is read-only (a
conflict, or a template value overridden elsewhere, decisions.md item 15),
the composer is focusable with `aria-readonly="true"` and is not editable; a
click on a chip or Enter opens its menu with every entry disabled; the result
line and the description stay. When the type has nothing to preview, the
composer is a `group`, not editable, its chips neutral, its result line "No
event to preview", and nothing is called empty.

**Assistive technology.**

- The composer is one `textbox` named by the field's label, never
  multi-line, with `aria-haspopup="dialog"` and
  `aria-keyshortcuts="Alt+ArrowDown"`. A chip's label is real text in the
  flow, so reading the textbox reads "Title in Venue › City". No ARIA is put
  inside the editable content; screen readers handle it unreliably there.
- Its description starts with the result, then each part that gives
  nothing and why, one full stop at the end as the box's sentence has, then
  the aside and the guidance: "This event: Summer Gala · 20 June 2026. Venue ›
  City is empty for this event." "Made of Title, “in”, Venue › City …" is
  added only if the spike's accessibility tree snapshots (D10) show that a
  chip can't be told from a typed word of the same text, or the owner's
  screen reader check does; a part that is only a space then reads "a
  space".
- Announcements, in the field's existing polite region: "‹Field› linked to
  ‹Source›." (whole link), "‹Source› added to ‹Field›.", "‹Source› removed
  from ‹Field›." (also when the last field goes and typed text remains),
  "‹Field› unlinked." (only when the value becomes empty), "‹Old› replaced by
  ‹New›.". Caret moves are never announced.

**Tab order.** A box stays one Tab stop, its button out of the order. A
composer is one stop and its button another, as a typed input and its button
are, because the button is how a keyboard user finds fields without knowing
`{` or Alt+Down.

**Small heights, zoom and pairs.** The menu keeps every short-frame rule. At
420 px tall and under, the composer's result line stays one line, cut at its
end with the whole result in the description. At 200 % zoom chips wrap whole
and nothing overflows sideways. A composed detail in a `.seo-pair` cell cuts
its chip line and its result line at their ends, one line each, with both in
full in the description and tooltip, so the pair never becomes uneven.

### D10. An editor library, chosen by a spike

The old chip editor was a textarea with a painted mirror. A mirrored chip must
take exactly its text's width, so it could not carry padding or a state, the
caret could land inside it, and screen readers read its braces. Hand-written
`contenteditable` editors fail on caret placement beside non-editable islands
(Firefox), input methods, and undo. So the composer is built on a small,
MIT-licensed plain-text editor library with atomic inline nodes.

Two candidates, one day each, in this order:

1. `lexical` with `@lexical/plain-text` and `@lexical/history`. A text node in
   token mode is deleted as one unit while its text stays in the text flow,
   which avoids the non-editable island problems. Token mode does not by
   itself step the caret over a token in one press, snap a selection to whole
   tokens, or put a key typed at a token's edge beside it; those need command
   handlers, which the spike writes and counts.
2. `prosemirror-state`, `prosemirror-view` and `prosemirror-history`, with an
   atomic inline node. The most proven input method handling; its atoms are
   non-editable islands.

Automated pass criteria, all required, run on the farm and recorded in the
merge request and in this section:

- every key of D9, by script in Chromium, Firefox and WebKit, with the caret
  and selection checked after each (a chip stepped over in one press, a
  selection never ending inside one);
- Japanese input, by simulated composition events in Chromium, composes
  beside a chip without losing a key, including the first key after an
  insert;
- an axe scan of the composer, at rest and with its menu open, with no
  serious or critical violation;
- accessibility tree snapshots of the composer: one `textbox` named by the
  field's label, not multi-line, its chips' labels as text in the flow, its
  description starting with the result;
- announcements, read from a log of the field's live region: added, removed,
  replaced, linked and unlinked, each once and in the words of D9;
- macOS text replacement and smart quotes next to a chip, spellcheck, and page
  translation never rewrite a chip's text;
- undo and redo group typing and chip changes correctly;
- the custom caret, selection and boundary handlers stay small: their lines
  are counted and reported;
- the bundle grows by at most 15 % of `main.global.js` gzipped on the main
  branch (about 30 kB today). If the build can load the composer only at
  template scope, the bundle pages load must not grow, and the composer's own
  chunk is capped at 45 kB gzipped;
- the 468 px frame wraps a long composition without splitting a chip.

Phase 3 starts once a library passes every automated criterion. It does not
wait on a person mid-run.

**Screen readers are the owner's merge check.** The farm has no screen reader,
so none runs during the build, and the change says so plainly in design D10
and the merge request. The steps are written into the PR body as a merge
check for the owner: a WebKit browser with its platform's screen reader and
an open-source screen reader with a Chromium browser read the
textbox, its chips and its description, step over a chip in one press, and
tell a chip from a typed word of the same text; a real Japanese input method
composes beside a chip. If that check fails, the fix is a blocking follow-up
before merge, recorded in this section.

If neither library passes the automated criteria, stop and report to the
owner rather than hand-write a `contenteditable` editor (decision 20). The
library is wrapped in one component, `Composer.tsx`, so nothing else imports
it.

### D11. Checks

- **Broken, per part.** `ApiController::broken()` walks `parts` and reports
  `{path, part, field, reason}`. A broken field of a composition is listed to
  fix as "Replace field_city in the title", detail "It no longer exists, so
  each event's title leaves it out.", action "Replace field", which focuses
  the composer, selects that chip and opens "Replace ‹Source›".
- **Hidden, per part.** A field of a composition that visitors may not view is
  listed to improve, like a hidden link, with the detail that it is left out.
  The grouping by reference stays.
- **Empty for the item.** Good to know, not counted: "City is empty for this
  event". When every field is empty: "City and Starts are empty for this
  event, so the title is its default."
- **Typed words on a multilingual site.** When the site has more than one
  language, the type is translatable, and a composition holds typed letters
  (`\p{L}`), good to know, not counted, whatever item is previewed: "The
  words typed in the title are the same in every language". The detail uses
  a translation of the previewed item when there is one ("French events read
  “Gala d'été in Paris”."), else "Translations of each event keep these
  words." No fix: translating fragments out of context is wrong, and the
  README says template values are shared by all languages.
- **The repeated site name.** A main part that holds the Site name fact, or
  the site name in any of its text parts, while the ending is the site name,
  repeats it on every item, so "Remove the repeat" ("No ending") is certain
  and offered. A main part that repeats it only through the item's Title is
  still offered nothing (link-values decision 13). `checks.ts` looks at text
  parts too, not only at `{text}`.
- **Steering toward a good composition**, each to improve, with
  `checks.test.ts` and text-cases rows:
  - "Most of this description is the same on every ‹type›" when typed letters
    make up more than half of a composed description's result;
  - "Start the title with what differs per ‹type›" when a template's composed
    main part has a lead-in with letters ("Tickets: ‹Title›"), because the
    distinctive words then move toward the cut in results;
  - on a composed name, headline or alternate name detail: a Site name part
    ("Keep the site name out of the event's name"), or a date part when the
    type has a date property ("Keep the date out of the event's name; Starts
    already gives it.").
- **Description and title.** "Make the description say more" also fires when
  one text contains the other after normalisation, not only when they are
  equal, so "‹Title› in ‹City›." next to the same title is caught.
- **Lengths.** Guidance on focus for the previewed item, measured on the
  composed result, as today. When the composition holds a field, the sentence
  adds "for this ‹type›; others vary". When "Shorten the title" finds the cut
  inside a composed main part, its detail names the field that is cut
  ("Starts is cut off."), not only the ending. The spread across items comes
  with `set-up-types-from-templates`' reach data (amendment).

### D12. Translation

Parts read the item's language: facts, fields, hops (Canvas resolves each
reference into the negotiated language), list labels (D5), and dates and
numbers in the item's locale. The vocabulary stays cached per interface
language; its values are per item, so a French event previewed in an English
dialog shows "20 juin 2026". Typed words are shared by all languages (README,
"Translations"), noted by D11's check, and the composer's help suggests
punctuation glue ("‹Title› · ‹City›"). A right-to-left field inside
left-to-right text gets no isolation characters in the head, because
`Values::UNSAFE` removes them on purpose; the dialog draws chips and results
with `dir="auto"` so the preview reads right.

### D13. Migration and rollback

- **Stored values: none.** `parts` is a new key and a one-part composition is
  the link it was (D1). No configuration is installed. A config export before
  and after the update is identical. The release note names the output
  changes that are fixes, not migrations: list labels in text (D5); dates
  and numbers now linkable in text; and a field with several values giving
  every item visitors may see in text, joined, at most two and "and ‹n›
  more" in title-like places (D6), which changes the output of a text value
  already linked to a multi-value field.
- **Brace values not yet converted.** `canvas_metatag_post_update_values_as_parts`
  kept the first piece of a composite and logged the rest without the words.
  The module is unreleased and `Legacy` is deleted after 1.0, so
  `Legacy::piece()` now converts a **template's** composite losslessly where
  the place composes: each `{field.NAME}` becomes its `Sources::sourceFor()`
  part with the `words` fit, each whole fact name its fact, the text between
  them text parts. A title still splits at its last `{sep}`. Each other case
  is defined, with a `LegacyTest` row:
  - a `{field.NAME}` with no matching source, or a fact that does not fit text
    (`{url}`, `{image}`), is dropped together with the words that go with it
    by D4, and the path and the dropped names (never the text) are logged;
  - a `{sep}` before the last one becomes typed text holding the identity's
    separator;
  - past eight fields, the first eight are kept and the rest logged by name.

  A page's or the site's composite keeps today's rule (they don't compose). A
  site that already ran the update keeps what it has; the README says that
  only a database backup has the dropped words.
- **Typed text written after link-values is never re-scanned.** "Plans {for
  teams} {site}" is literal by spec, and no update may reinterpret it.
- **Rollback is not clean, and the README says so.** Canvas's
  `ContentTemplate` configuration is fully validatable, so under the previous
  schema an unknown `parts` key fails validation and publishing that template
  in Canvas fails. The previous dialog also cleans the values in read mode,
  dropping `parts`, and its first save writes the whole map back, deleting
  every composition. So going back to a release before this change needs the
  configuration restored from before the update. The release note says this;
  no test pretends otherwise.

### D14. AI

Suggestions exist on Canvas pages only (`ai-suggestions`, "Where suggestions
are offered"), pages don't compose, and a suggestion is stored as typed text
whose braces are literal. Nothing changes. When template-scope AI comes, the
model receives the vocabulary as numbered entries with the previewed item's
values, answers with parts that name entries by number, and the server maps
and checks each with `accepts()`; an unknown number refuses the whole
suggestion. That belongs to the change that adds template AI.

### D15. Hand-added JSON-LD keeps whole-value names

`extend-structured-data-by-id` stores hand-added JSON-LD as written and fills
a string that is exactly `{field.x}` or `{media.uuid}`; inside other text
these stay literal and the sheet says so. Composing there would need names
filled inside strings, an escape for literal braces, and a parser in two
languages: the grammar this change exists to avoid. So the boundary is:

- module values (title, description, social texts, structured data details)
  are structured, and compose;
- hand-added JSON-LD is text an expert wrote, and fills whole values only.

In the form view of hand-added items, text values keep the box. An expert who
needs a composed detail composes the module's own detail and adds the rest
by `@id`.

### D16. Docs and the design system

- `design-system.md`: §5.4 "Chips (dynamic values)" becomes "Composer and
  chips" (metrics, colours, the filled, muted-dashed and broken states, the
  tint of a chip's words, the result line and its note); §5.5 says that a
  lone field stays a box and how composing starts from it; §5.13 names the
  menu names, the hints row's verbs and the "Add words or fields" row; §8
  lists the composer's keys; §9 the short-frame result line. The stale
  "Insert into ‹label›", "↵ insert" and "Braces 'Insert value'" go.
- README: "Every ‹Type›" gains composing, which words go with which field,
  words in text and how dates follow the language and the site's country;
  "Translations" says typed words are shared; the raw `parts` value is
  internal configuration; the release note lists D13's output fixes and that
  a rollback needs the configuration restored.
- ARCHITECTURE.md: the value shapes (§ on values), the join rule, the `words`
  form in `Sources`, the `Words` helper, the value constraint, and that no new
  Canvas API is used, so `BoundaryTest` keeps holding.

## Risks / Trade-offs

- **A new frontend dependency.** The library adds weight and an upgrade path.
  The spike caps the size relative to the bundle and wraps it in one
  component, so it can be replaced without touching anything else.
- **A fixed join rule gets a rare case wrong** ("‹Price› € · ‹Title›" without a
  price leaves "€ Summer Gala"). The tint and the "Without ‹Field›" line show
  it while composing, and the stored shape can take an explicit choice later
  (decision 17).
- **Typed words in one language on a multilingual site.** Said by a check
  whatever item is previewed, and the help steers to punctuation; a
  per-language override is a later, owner-level decision.
- **Composed titles vary in length per item.** Guidance judges one item and
  says that others vary; the spread arrives with reach data.
- **A second control for text on templates.** A lone field keeps the box, so
  only values that hold text or several fields use the composer, and tests
  that query a linked text value's box by role keep working. A typed text
  value on a template becomes a composer, a textbox like the input it
  replaces.
- **Rollback needs a configuration restore** (D13).
- **Evaluation cost.** At most eight fields per value, one host access check
  per host and one read per distinct field and form (D8).

## Review decisions

Three research notes, an edge-case analysis and three critiques (UX,
engineering, SEO) fed this design (kept outside the repository). Taken from
them:

- Parts over strings, one-part folding, inner whitespace kept and outer
  whitespace trimmed, a value constraint in the config schema, grandfathering
  of stored parts in validation, the memo per part and form, host access once
  per host, one per-entity reader for `resolve()` and `target()`.
- An explicit `words` read form; formatting follows the place; one `Words`
  helper with `intl` for dates and decimals; the client never formats.
- A text list gives its label in text, read in the item's language.
- The join rule with lead-ins, "something before it was kept", closing marks
  and trailing separators, made visible by tinting and a "Without" line.
- A lone field stays the box; composing is an explicit step out of it, and
  the default can be adopted as the first chip.
- The button's name and mode follow the value alone.
- Segments for the title's main part, so a cut drops whole fields first.
- A long-text part gets the room the composition leaves.
- Tokens are added only from the menu; typed and pasted braces are literal;
  `{` opens the menu at the caret; a trailing `}` in the filter is ignored.
- A small editor library chosen by a spike whose automated accessibility
  criteria gate phase 3; the owner's screen reader check gates the merge.
- A field with several values gives every visible item in text, joined, with
  at most two and "and ‹n› more" in title-like places (decision 16).
- Chips show labels; the value goes in the result line, not inside the chip.

Not taken:

- **Storing each text's field, chosen in the editor.** The fixed rule covers
  the common cases with no extra control (decision 17).
- **The first item of a multi-value field, said everywhere** ("First of
  ‹n›" on the menu, the chip, the result line and a Checks row). "Summer Gala
  with Ada" for an event with three performers states something false
  (decision 16).
- **A popover per chip with Replace, Format and Remove.** The link menu
  already replaces, its extra row removes, and there is no format to choose.
- **Selecting a chip on the first Backspace and removing it on the second.**
  Undo covers an accidental removal, and one press matches the box and the
  old chip editor.
- **Composing the title ending, and composing in Site settings.** The ending
  stays one value; the site has no item to read fields from.
- **A typed trigger that also closes on `}`.** It would make typing a brace
  pair depend on the menu's state. Ignoring a trailing `}` while matching
  covers the habit without closing anything.
- **A "Without ‹Field›" line per optional field under the composer.** Up to
  eight extra lines make the dialog busier than the problem; the line for the
  chip at hand is enough.
- **Measuring "Without" variants for length.** Leaving a part out only
  shortens the result; the longer items need other items' values, which
  reach data brings.
- **A "Search title" fact the social title follows.** A new fact for one
  place; a copy row in the menu covers it without changing the zero-config
  default.
