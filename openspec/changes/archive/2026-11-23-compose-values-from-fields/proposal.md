# Proposal

## Why

`link-values-to-fields` replaced brace tokens (`{title}`, `{field.NAME}`)
with values that are either typed text or a link to one source. Reviewing it,
the product owner said:

> "I do like tokens but they need to be strongly typed and connected to a
> field with strong UX. The benefit is that you can connect multiple fields or
> add hard coded text there"

The link model fixed what was wrong with tokens: nothing is parsed, a link
can only name a field the type really offers, every link previews the
item's value and says when it is empty, hidden or broken. But it also took
away what tokens were for. A builder can no longer write an event title as
"‹Title› in ‹City› · ‹Date›", a product description as "‹Summary› Free
delivery.", or a venue's street address from two fields. The archived design
rejected "a list of segments per value" because "nothing outside the title
needs it". The owner has now said that composition is needed.

The old tokens failed in four ways, and this change must not bring any of them
back:

- **Untyped strings.** `{Titel}` was just text. A typo silently did nothing.
- **No preview.** A builder saw braces, not what an item would get.
- **Silent breakage.** A deleted field left an empty hole, and the separators
  around it dangled.
- **Hard to read, edit and announce.** Chips were drawn over a textarea, so
  the caret could land inside one, keys typed after an insert were lost, and
  screen readers read the braces.

The quality bar is the owner's: "experience needs to be clean even though
we're making this more powerful", with strong zero-config defaults.

## What Changes

- **A value can be a composition.** At template scope, a text value may hold
  typed text and up to eight fields or facts, in order. It is stored as a list
  of parts (`{parts: [{fact: title}, {text: ' in '}, {source: …}]}`), never as a
  string, so nothing is ever scanned. Each field part is the same Canvas
  entity-field prop source a single link stores today, checked against the
  type's fields when it is written, and the config schema refuses a malformed
  composition on import. A composition of one field and no text is stored as
  that link, and text alone as typed text, so every value stored today is
  already in its final form.
- **Where it composes.** On a content type's template: the title's main part,
  the description, the social title and description, and the structured data
  details the registry marks as free text (a name, a headline, a description,
  a street address). Everything else stays one value: the title ending,
  images, addresses, dates, numbers, choices, codes, references, opening
  hours, lists, every value on a page, Site settings and hand-added JSON-LD.
- **The box stays; composing is a step out of it.** A value that follows its
  default or links one field keeps today's box, keys and Tab stop. Arrow
  right, End or `{` on the box, or "Add words or fields" in its menu, turns it
  into a composer: one control that looks like an input and holds typed text
  and fields as chips, starting from that field or the default.
  - A chip is named by its source, the way the link menu names it ("Venue ›
    City"), and shows its state: filled, muted when empty or hidden, red when
    broken. The item's result shows on a line inside the control.
  - Fields are added from the existing link menu, at the caret: by the link
    button (named "Add a field to ‹Field›"), by Alt+Down, Enter, or by typing
    `{`. Typing `{` twice types a brace.
  - A chip moves and is removed as one unit. Clicking it opens the menu to
    replace or remove it.
  - Everything works by keyboard and is announced to screen readers. Undo in
    the control restores typing, added and removed fields.
- **An empty field is left out with its own words.** Typed text goes with the
  field after it, a lead-in with the first field unless it ends a label, and
  a connector shows only once something before it was kept. A separator left
  at the end never shows. A field that is empty, hidden from visitors or
  broken for an item is left out together with its words. Only when every
  field is empty does the value give its default. The rule is the same in the
  head and in the dialog, and the dialog shows which words go with which
  field, and what an item without it gets, while composing.
- **Fields read as words in text.** In a composed value, a date reads in the
  item's language and the site's country ("20 June 2026", "June 20, 2026",
  "20. Juni 2026") and a decimal with the locale's marks, through `intl` with
  no configuration. A list field gives its label, not its stored key. A long
  text part gets the room the rest of the composition leaves. Only the server
  formats; the dialog shows the server's words.
- **A field with several values gives all of them in text.** Alone or
  composed, it gives every item visitors may see, in field order, joined with
  the language's list separator ("Ada, Grace, Hedy"). In a title-like place it
  gives at most two and a translatable, plural-aware "and ‹n› more" ("Ada,
  Grace and 1 more"), so one field cannot blow a title's length. This changes
  the output of a text value already linked to a multi-value field, and the
  release note says so.
- **Checks and output follow.** A broken or hidden field inside a composition
  is listed like a broken or hidden link. Checks also steer toward a good
  composition: boilerplate descriptions, a generic lead-in before the title,
  a date or the site name inside a name detail, typed words on a multilingual
  site. The head, the headless content API and JSON-LD carry the joined text,
  escaped and cut as today, with the cache tags of every field the
  composition reads; a cut title drops whole fields before words.
- **Migration.** No stored value changes. The brace converter that has not yet
  run on a site keeps a template's whole composite instead of its first piece.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dynamic-values`: a value can be a composition; which typed text goes with
  which field; an empty or broken field inside a composition; fields read as
  words in text; a field with several values gives every visible item in
  text; where composition is refused; storage and the brace update.
- `value-links`: composing from a box, the composer, adding and replacing
  fields at the caret, chips that move as one, states said per chip, the link
  button's names, a read-only composer, and which entries fit in text.
- `seo-dialog`: the title's main part composes on a template; previews and
  lengths use the composed result.
- `seo-checks`: empty, hidden and broken fields inside a composition; typed
  words on a multilingual site; the repeated site name fix; checks that steer
  a composition; a description that contains the title.
- `structured-data`: free-text details can be composed and are checked after
  joining; a referenced page's composed details are read.
- `head-output`: how a composition is joined, escaped, cut and cached.
- `template-seo`: a composition is valid configuration, and a malformed one is
  refused.

## Decisions taken

The reasons are in design.md.

1. **Parts, not a string, and not a Canvas adapter** (D1). A composition is a
   module-owned list of the value shapes that exist today. Each field part is
   one Canvas entity-field source, contained in `src/Sources.php` as now. A
   validation constraint in the config schema enforces the shape.
2. **One field alone is the link it is today** (D1), stored the same and shown
   in the same box with the same keys (D9). No stored value changes;
   add-advanced-meta-tags, the "Automatic" group and the defaults keep
   building on single values.
3. **Composition is for text people read, on templates** (D2). Structured
   data details opt in with `compose: true` in the registry. The title ending
   stays one value.
4. **A place says which form it wants** (D3): kind `words`, passed by the
   places that compose and nowhere else.
5. **Words go with the field after them, and connectors need something
   before them** (D4). The rule is fixed, shared by PHP and TypeScript, pinned
   by the existing text fixture, and made visible in the composer. There is
   no per-field fallback text in this change.
6. **Formatting follows the place, not the field, and needs no
   configuration** (D5). A date in text reads in the item's locale through
   `intl`; the same field in a date detail stays ISO 8601. No date format is
   installed and there is no per-chip format menu.
7. **A field with several values gives every item visitors may see in text**
   (D6, decision 16): joined with the language's list separator, and in
   title-like places at most two and "and ‹n› more". Outside text it keeps
   the first item, or every item on a list property. The release note names
   the changed output.
8. **A list field gives its label in text** (D5). This changes the output of an
   existing text value linked to a list field, from its key to its label; the
   release note says so.
9. **A long text part gets the room the composition leaves** (D5), cut at a
   sentence; title-like places don't offer long text.
10. **Composing is an explicit step out of the box** (D9). The box's keys,
    role and Tab stop stay; Arrow right, End, `{` or "Add words or fields"
    start composing, from a linked field or from the default.
11. **`{` opens the link menu at the caret** (D9), and `{{` types a brace. A
    typed or pasted brace is never turned into a field.
12. **The editor is built on a small editor library chosen by a spike** (D10),
    never a hand-written `contenteditable` editor. Phase 3 starts once a
    library passes every automated criterion: keys, caret, input-method
    composition in Chromium, axe, accessibility tree snapshots and
    announcements read from a live-region log. The farm has no screen reader,
    so none runs there: the screen reader steps go into the PR body as
    the owner's merge check, and a failure there is a blocking follow-up
    before merge.
13. **Hand-added JSON-LD keeps `extend-structured-data-by-id`'s whole-value
    names** (D15). Its text is stored as written, so composition there would
    need a string grammar.
14. **AI is unchanged** (D14): suggestions exist on pages only, pages don't
    compose, and suggested text is always typed text.
15. **Rollback needs a configuration restore** (D13), and the release note
    says so.

### Taken on 2026-11-17

These were open when the plan was written. The owner's lead accepted the plan
on 2026-11-17 and took the recommended option of each; decisions.md item 17
records them.

16. **A field with several values in text: every item visitors may see**
    (D6). In text, a field gives every item visitors may see, in field order,
    joined with the language's list separator, alone or composed; in
    title-like places (the title's main part, the social title, a name, a
    headline, an alternate name, a street address line) at most two items
    and then a translatable, plural-aware "and ‹n› more", so one field cannot
    blow a title's length. "‹Title› with ‹Performers›" then names the
    performers instead of stating something false. It changes the output of
    existing text values linked to multi-value fields, so the release note
    says it, and it reverses the archived "Ada" scenario. Not taken: the
    first item, said by "First of ‹n›" in the menu, the chip, the result line
    and a Checks row.
17. **Which words go with an empty field: the fixed rule** (D4), made visible
    by the tint and the "Without ‹Field›" line. Not taken: a "Goes with
    ‹Field›" choice on each chip, stored with the text, for the rare unit
    written before the next field ("‹Price› € · ‹Title›"); or per-field
    fallback text, as messaging tools have. Both fit the stored shape later
    without a migration.
18. **The typed trigger: `{`, with `{{` for a literal brace** (D9). It is the
    old token gesture and rare in titles. It needs Shift or AltGr on most
    keyboard layouts, so the link button, Alt+Down and Enter stay as the
    other ways in. Not taken: the button and keys only; or `/`, which is
    common in titles ("Q&A / FAQ"), or `@` and `%`, common in handles and
    offers.
19. **No composition inside hand-added JSON-LD** (D15). Its text is stored as
    written, so composing there needs a string grammar with escapes, the
    thing this change avoids. An expert composes the module's own details and
    adds the rest by `@id`. Not taken: fill `{field.x}` anywhere inside a
    hand-added string.
20. **The editor library: `lexical` first, then ProseMirror** (D10). The
    React-first library first, because its token text stays in the text
    flow, where screen readers and the caret behave; then the schema-based
    toolkit. If neither passes the spike's automated criteria, stop and
    report rather than hand-write an editor. Not taken: a hand-written
    `contenteditable="plaintext-only"` editor. Built (design D10, spike
    result): `lexical` 0.17.1 in a chunk of its own, loaded only where a
    value composes; the current release is twice the size budget.
21. **Typed words on translated items: shared by all languages** (D12), with
    a good-to-know check on any multilingual site, and punctuation glue
    suggested in the composer's help. Not taken, and for a later change: a
    per-language override of a whole template value, which reopens README's
    "shared by all languages".

## Amendments to other changes

Applied to those changes' own proposals, designs, spec deltas and tasks on
2026-11-17, when this plan was accepted (task 0.3). Where an amended change's
MODIFIED block must be rebuilt on this change's text, that change has a task
to rebuild it once this change is archived. This change does not edit them.

- **`complete-the-headless-frontend`** (lands right after this change):
  1. Its rule "A field's menu MUST NOT offer the value the field follows by
     default" applies only when the pick links the whole value. In add mode,
     and when replacing a chip of a composition, the menu offers it. On a
     Default box and in an empty composer, the row "Add words or fields ·
     Start from ‹Title›" adopts it as the first chip. Its scenario "The
     field's own default" gains these cases.
  2. A chip of a worked-out value is named by its label alone ("Title"), never
     "Automatic › Title", like boxes and announcements.
  3. "from ‹via›" goes into a chip's tooltip and the composer's description.
  4. "No ‹type› has one" and "Fields named for the value come first" apply to
     the menu in every mode: link, add and replace.
  5. Its accessibility tree snapshot of an open link menu (amendment to
     `test-in-every-engine-and-language`) is taken once in add mode as well.
- **`strengthen-zero-config-defaults`**:
  1. Its MODIFIED head-output "A cut head text ends at a word" keeps this
     change's ADDED "A composed value is joined from plain parts": a composed
     main part first loses whole fields with their words, then words, then
     ends in "…". A cut never leaves " in …" or " · …".
  2. The Default box stays the at-rest look of an untouched field; composing
     starts from it (this change's D9).
  3. Its share card's date (D8 "The small line") uses this change's `Words`
     helper for dates, so the card and a composed title agree on a date's
     form in every language.
  4. Its sentence cut for derived descriptions and this change's long-text
     budget share one sentence-cut helper.
  5. The share card uses the social title as resolved, composed or not.
- **`add-advanced-meta-tags`**:
  1. At template scope, the content of an other tag of a text kind composes,
     like the description. An address row and the stop date stay one link.
     A row's `value` is a Value, so parts are checked by `Values::value()`.
  2. Its MODIFIED value-links "Where values can be linked" is unchanged by
     this change, so it needs no rebase. Its other tags sheet uses the
     composer for text rows.
- **`add-home-page-defaults`**:
  1. Its MODIFIED seo-checks "Checks describe the page or template being
     edited" is rebuilt on this change's text. This change replaces the
     brace-era scenario "A value empty for the previewed node" that still
     reads `{Performers}`.
  2. Its vague-title rule for the front page applies when the main part is
     the Title fact alone, whether by default or linked. A composed main part
     is the builder's choice and is kept. "Make the title specific" still
     judges the resolved text.
- **Also affected, smaller:**
  - `make-the-module-agent-ready`: `set` accepts `{parts: […]}`, with the
    `{field: handle}` shorthand inside parts. `inspect` prints parts with
    handles, and the round trip test covers a composed title. Its config
    import refusal builds on this change's value constraint. Its MODIFIED
    template-seo "The stored setting is always valid configuration" is
    rebuilt on this change's text, keeping the scenarios "A composition" and
    "A malformed composition".
  - `set-up-types-from-templates`: a composition that holds a field counts as
    set per item, never as the same text on every item. Reach can show the
    spread of a composed title's length ("38–71 characters on other events").
    Self-setup may propose compositions later.
  - `test-in-every-engine-and-language`: the composer joins the screen reader
    and input method matrix (a WebKit browser with its platform's screen
    reader, an open-source screen reader with Firefox and with a Chromium
    browser, Japanese and Chinese input).
  - `extend-structured-data-by-id` lands first and needs nothing. Its
    whole-value names stay the only field grammar inside hand-added JSON-LD.

## Dependencies and place in the queue

Land **right after `extend-structured-data-by-id`**, before
`complete-the-headless-frontend`. This supersedes decisions.md item 16's
"Runs first after the JSON-LD form pause"; decisions.md item 17 records it,
and the amendments above were applied with it.

- It builds on `populate-every-schema-type` (kinds, the `html`, `ref` and
  `hours` kinds that never compose, `typable()`, list properties, "First of
  ‹n›" outside text) and on `extend-structured-data-by-id` (the boundary with
  hand-added JSON-LD).
- MODIFIED blocks are written on the text of `openspec/specs` as these two
  changes leave it. `populate-every-schema-type` modifies dynamic-values
  "Field values are plain values of the first item", which this change now
  modifies too (decision 16), so that block is written on its text. No other
  requirement is modified by both; the first task re-checks all of them after
  the two are archived.
- Landing before `complete-the-headless-frontend`,
  `strengthen-zero-config-defaults`, `add-advanced-meta-tags` and
  `add-home-page-defaults` means they build their menus, defaults and rows on
  the composer from the start instead of reworking them.

It ships in four phases. Phase 1 is a spike that ships no code; phases 2 to 4
are each releasable:

1. The editor spike, with its pass criteria and a written result. Phase 3
   starts once a library passes every automated criterion (keys, caret,
   input-method composition in Chromium, axe, accessibility tree snapshots,
   announcements read from a live-region log); phase 2 does not wait. No
   screen reader runs on the farm: the screen reader steps are written
   into the PR body as the owner's merge check, and if that check fails, the
   fix is a blocking follow-up before merge.
2. The model and the output: storage, validation, joining, words, the head,
   JSON-LD, caching, Checks' server data and the brace converter. A
   composition from configuration import renders correctly, and the dialog
   shows it read-only.
3. The composer.
4. Checks, docs, the design system and manual QA.

## Follow-ups (from the gate, 23 Nov 2026)

- The composer in WebKit (`compose-webkit`) never ran. Playwright's WebKit
  build cannot create any page on the farm's host, even a blank one in a bare
  script. The repair after the gate traced it: the engine's network process
  hangs while it starts, before any page exists. Its loader thread waits
  forever on a look-up of the system's analytics service, a look-up an
  ordinary process gets at once. No fix in this module can reach that. It
  joins the owner's merge check beside the screen reader steps (design D10):
  run the `compose-webkit` project where WebKit runs, before merge.
- Firefox's axe step (`compose-firefox`, `compose.spec.ts` test 3) crashed
  that engine's page (`Target crashed`). The repair after the gate found the
  cause, an engine defect: once Playwright's own world reads an element's
  `ariaLabelledByElements` (every query by role and name does), a read from
  the page crashes it. A blank page with one labelled `div` crashes the same
  way, so the composer is not the cause. The scan now hides those properties
  from the page in Firefox, so axe reads the `aria-*` attributes. The
  extension only sets attributes, so the scan sees the same names. All eight
  Firefox tests pass. A clipboard event made by a script carries no data in
  that engine, so its scripted copy and paste steps are annotated as not run
  there. Copy and paste by hand in Firefox before merge.

## Out of scope and non-goals

- No README non-goal is reopened. Template values stay shared by all
  languages (README, "Translations").
- No composition on pages, in Site settings, in the title ending or in
  hand-added JSON-LD.
- No per-field fallback text, no formatting choices on a chip (date styles,
  case, time of day), no separator chip, no date ranges as one chip.
- No AI at template scope.
- Composed defaults. Defaults stay single facts; nothing needs a composition
  to look good with zero configuration.
- Recovering the words that `canvas_metatag_post_update_values_as_parts`
  dropped on sites that already ran it. Only a database backup has them.

## Size

L: about 10 agent days.

| Item | Size |
|---|---|
| Editor spike | S, 2 days (one per library) |
| Storage, validation, constraint, joining, words, output, caching | M, 2.5 days |
| Client model twins, Checks | M, 1.5 days |
| Composer | M to L, 3 days |
| Brace converter, docs, design system, QA | S, 1 day |
