# Reference: "Add your own JSON-LD" as a form or as JSON

The design of the hand-added JSON-LD sheet in this change, kept for the agent
that builds it. It is the final design after two reviews (structured data and
technical search; UX, accessibility and engineering), with every review
decision folded in.

**Precedence.** The specs in `../specs/` win, then `../design.md`, then this
file, then the mockup. This file adds what those leave implicit: layout,
states, switching rules, the full copy and the keyboard rules.

**Pictures.** [`mockup.html`](mockup.html) is a self-contained sketch (open it
in a browser; no network). Each frame is the dialog's 468 px iframe. The four
key states are also here as images:

| Image | State |
|---|---|
| [`img/f1-empty-sheet.png`](img/f1-empty-sheet.png) | F1: empty sheet, "What is it?", Paste JSON-LD row |
| [`img/f3-item-form.png`](img/f3-item-form.png) | F3: an employer rating in Form: verdict, needs, either-or group, Also helps |
| [`img/f7-json-after-paste.png`](img/f7-json-after-paste.png) | F7: JSON after a clean paste: report with Undo, gutter, caret line, verdicts |
| [`img/f9-problems.png`](img/f9-problems.png) | F9: problems: red and amber, line and path, one fix each, "Not saved" bar |

The mockup is a sketch: spacing and icons are indicative; copy, bands, order
and states are the point. Known gaps between it and this file are listed in §13.

The product owner's ask (13 Nov 2026): "make it easier to fill the custom
json-ld, you should either fill as form or as json (if you want to just copy
paste)". Before that: "the json+ld is somewhat hard to use", "make sure we
have a way to populate each json+ld schema type", "experience needs to be
clean even though we're making this more powerful".

---

## 1. Principles (each is testable)

1. **One text, two views.** `schema.custom` is one JSON text. Form and JSON
   both edit it. Switching tabs never changes a byte (R1).
2. **Form by default; JSON is one tab away.** The last tab is remembered per
   viewer. Paste works in either tab and you stay in the tab you pasted in.
3. **Only needs are empty.** A row is empty only when a live search feature in
   `data/search-features.json` needs it. An either-or need is one group with one
   sentence, never two asterisks. Everything else is one search away.
4. **Point before you copy.** A detail that takes an item offers what is
   already on the page before "Describe it here".
5. **Nothing is dropped or reworded.** Keys the form doesn't know stay where
   they are, editable by shape. Normalising runs only on paste or an explicit
   fix, says what it changed in one line, and can be undone.
6. **Every problem has a place and words.** "Line 7 · itemReviewed › sameAs:
   use the full address." Red is exactly what the server refuses and blocks
   saving; amber never blocks.
7. **What is stored is what is shown.** The JSON tab shows the stored text.
   The output adds only what the graph merge adds (page URL on `#name` ids,
   short ids resolved, fills, the module's `@context`) and normalises number
   spelling. Verdicts are computed on the merged, filled graph.
8. **No new controls.** Reuse `populate-every-schema-type`'s controls,
   `link-values-to-fields`' link button, linked box and link menu, the image
   chooser, `rethink-structured-data`'s verdict lines and the dialog's tokens.

---

## 2. Layout

### 2.1 Entry points

No new rows on the main view.

| From | Opens at |
|---|---|
| The read-back's "Added by hand: ‹item›" part | That item. Accessible name "Added by hand, ‹item›, edit it" |
| Code › Output › "Add your own JSON-LD · ‹n› added" | The item list, or the empty sheet |
| "What this page is" sheet, last row "Something else on this page" ("A rating, a review, a discussion… Add it as its own item.") | Type search, focus in "What is it?"; the kind is unchanged |
| A Checks row about a hand-added item (`jump.field = 'schema.custom'` plus path) | The item and row, with the jump wash |
| The unknown-kind notice ("This page was described as “Recipe”…") | Second button **Describe it by hand**: type search pre-filled with the stored type |
| Output › a module node › **Add details** | "Add details to ‹name›": the same editor with the type fixed (§2.5) |

### 2.2 The sheet header

One full-frame sheet. Header 44 px: Back · title "Add your own JSON-LD" ·
**Form | JSON** tabs (pill style, 24 px) · ⋯ (Copy all, Remove all; its slot
is always reserved so the tabs don't move). At 200 % zoom the tabs take a
second header row.

There is **one Back**: the header's. It goes up one level and is named for
where it goes ("Back to all items"); at the top level it closes the sheet.
Escape does the same. There is no second back row inside the body; the
template preview stepper keeps its own row. Focus returns to the control that
opened the level.

### 2.3 Levels

| Level | Shown when |
|---|---|
| Item list | 2 or more items |
| Type search | no items, or "Add an item" |
| Item | one item opened; with exactly one item the sheet opens here |
| Paste review | a paste that needs a decision (§6.3) |
| Choose image | an image row's Choose or Change |

Nested items are inline (two levels). A third level is a summary line with
**Edit in JSON**, not another level of the sheet.

### 2.4 Scopes

| Scope | Intro | Notes |
|---|---|---|
| This page | "Describe something this page shows that its structured data doesn't cover yet. It's added as its own item." | Main-thing switch on a plain web page only |
| Every ‹Type› (template) | "Added to every ‹Type›'s structured data, filled in for each ‹type›." | Preview stepper "Previewing ‹title› ‹ ‹n› of ‹N› ›"; any value can be linked; verdicts are the previewed item's ("For ‹title›: Can show") |
| Site | — | No hand-added items at site scope. Site nodes take details through Add details |
| Translation | — | Each translation has its own items. An empty one whose source has items offers "Copy from ‹English›" (keeps `@id`s; typed text marked "Translate this" until edited) |

Item list intro: "Added to this page's structured data as separate items."

### 2.5 Add details to ‹node›

The same editor with three differences: the type is fixed; details the module
already emits show read-only with their source ("From the Price field");
"Add a detail" lists only details the module doesn't emit. List selectors
(`offers[*]`, `offers[name=X]`) read "For every offer" / "For the offer named
‹X›" in Form and stay keys in JSON.

---

## 3. The form

### 3.1 Choosing a type (F1, F2)

- **Empty sheet:** "What is it?" with placeholder "Search types, like rating or
  event", focused. Before typing, the list shows the types the rules file
  documents, those with a live search feature first. Under it the row
  **Paste JSON-LD** ("Script tags, several items and @graph are fine.") and
  "Up to 10 items, 32 KB in all."
- **Each result:** plain label (the rule's or kind's label, else the schema.org
  name split into words); on the second line the schema.org name in monospace
  and one line about it. Documented types use the module's own `about` line;
  other types use schema.org's first definition sentence, only from the site's
  downloaded vocabulary, with "Definitions are schema.org's own, in English."
  in the ⓘ.
- **Ranking:** a live search feature first, tagged "Search feature" in gray;
  then match quality. Word starts in label and name first ("rat" finds Rating,
  not Corporation); then definition words under "Definitions that mention
  “‹q›”". Pending types say "Proposed" unless a feature documents them.
- **Never offered as types:** datatypes, enumeration classes, retired terms.
  Types of retired features are never tagged or suggested.
- **Steering:**
  - A page-kind word: first row tagged "Page kind": "This page can describe
    itself as ‹a recipe›, with its own fields and checks." [Use What this page
    is] [Add by hand anyway].
  - The page already is that kind: "This page already describes ‹the
    product›. Add what's missing to it instead." [Add details to ‹name›] [Add a
    separate item anyway].
  - Types the page always makes (WebPage, WebSite, the identity, a breadcrumb
    where one shows): "Made by this page already." with Add details.
  - A page or site subtype (QAPage…): "This makes the page itself a ‹Q&A
    page›." [Make this page a ‹Q&A page›], which adds the type to `#webpage`
    and, for Q&A, opens a new question as the main thing.
- **A type the vocabulary doesn't have:** last row "Use “‹text›” as the
  type"; the item says "Not a schema.org type. Search engines may ignore it."
  and is edited by shape.
- Search hint: "‹N› types · ↑ ↓ move · ↵ choose". Result counts announced
  politely after 300 ms ("6 types").

Choosing a type writes `{"@type": "…", "@id": "#‹slug›"}` and opens the item
with focus in the first empty need.

### 3.2 Item anatomy (F3), top to bottom

1. **Head:** plain type label (h3), `Type · #id` in monospace, the `about`
   line; ⓘ and ⋯ on the right.
2. **Verdict box** "In search results": one line per feature that reads the
   item, in rethink's grammar (Can show · Needs ‹x› · Not shown since ‹date› ·
   No search feature · Doesn't fit: ‹reason›). The first `confirm` line shows
   under "Can show" ("Only if visitors can post ratings on this site"). An item
   referenced by another reads "Part of the ‹employer rating›".
3. **Needed for ‹feature›:** the feature's `required`, in the rules file's
   order, an empty row only here. An either-or need is one `fieldset`: legend
   "Rating count or review count", the two inputs side by side with "or", and
   "Fill one, so the rating can show." A wrong shape counts as missing and says
   so ("Needs author as a person or organization" [Make it a person]).
4. **Also set:** every other key with a value, in the text's order.
5. **Not expected on ‹a book›:** keys that aren't details of the type. A key
   that belongs to a subtype says "‹servesCuisine› is a detail of a
   restaurant." [Change the type to Restaurant].
6. **Not schema.org names, kept as written:** other names, edited by shape.
7. **Also helps:** `recommended` not yet set, at most four, as + buttons.
8. **Add a detail:** one search over every detail of the type ("‹n› more
   details of ‹an employer rating›"). Empty query groups: Also helps → "Of ‹a
   rating›" (own and parents' details, nearest class first) → "Of any item"
   (Name, Description, Image, URL, Same as). Plumbing details last
   (`potentialAction`, `mainEntityOfPage`, `subjectOf`, `additionalType`,
   `identifier`, `disambiguatingDescription`, `owner`). Each row: label,
   expected kind on the right ("Number", "Organization or person"), one line.
   Choosing focuses the new row; a row left empty disappears on blur.
   Superseded names offer the replacement ("‘reviews’ was replaced by
   ‘review’. Use review").
9. **Main thing switch** "This is what the page is mainly about", on a plain
   web page only.

A type with no feature: "No search feature. Search engines and other tools can
still read it.", then "Suggested: + Name + Description + Image + URL", then Add
a detail. **No empty rows.** An employer rating opens with three needs and
"Also helps: Best rating, Worst rating".

At 350 px tall the head hides the `about` line (ⓘ keeps it) and the verdict
sits on the type line.

### 3.3 Value controls

The control comes from `expects` (or the downloaded vocabulary's ranges) **and**
the value's actual JSON shape; the shape wins, so nothing is converted until
edited.

| Expects | Control | Stored as | Copy |
|---|---|---|---|
| text | text input; growing multi-line for `description`, `text`, `reviewBody`, `articleBody` | string as typed | — |
| number | text input, `inputmode="decimal"`, optional suffix ("out of 5" from `bestRating`) | number; a pasted `"4.2"` stays a string until edited | "Use a dot for decimals (4.4, not 4,4)." |
| number or text | as number, but text is accepted ("85%" stays text, no decimal advice) | as typed | — |
| date | date in the dialog's language + calendar button | `YYYY-MM-DD` | "Use a date like 2026-11-13." |
| date and time | date + time + zone select (default the site's) | `YYYY-MM-DDThh:mm±hh:mm`, offset computed for that date | "Stored as 2026-07-10T09:30+03:00 (Helsinki, summer time)". Time optional for date-or-datetime; once set, the offset is required. A pasted `Z` or offset is kept |
| duration | populate's duration box | `PT1H30M` | "Leave it empty if you don't know it." |
| url | `type="text" inputmode="url"` | absolute string | amber "Use the full address." [Use https://…] |
| bool | select: Not set / Yes / No | `true` / `false` / absent | Not set is not No |
| enum | ≤ 6 members: select in plain words; more: code picker; several: checkbox rows | `https://schema.org/InStock`; a pasted `InStock` is kept | near-miss advice |
| item | menu button (§3.4) | `{"@id": …}`, nested object, or string | — |
| image | image row + Choose image level; on templates a link to an image field | `"{media.‹uuid›}"`; a pasted ImageObject stays an object | gone or private: "No longer exists" / "Hidden from visitors" |
| linked (template) | link button, linked box, link menu | the whole value is one name: `"{field.‹name›}"`, `"{field.‹name›.‹name›}"`, a fixed name `"{title}"` | Linking a text field to an item detail writes `{"@type": "Person", "name": "{field.…}"}` and says "Linked as a person's name." |
| anything else | by shape: string → text, number → number, boolean → Yes/No, object → group, array → list | unchanged | "Not what ‹label› expects (‹a number or text›). Kept as written." |

`@type` lists (`["Restaurant","Store"]`, 1–4 types) show the first type's
label, then "+1 type"; both types' details are offered.

**Lists.** Every row's ⋯ offers Add another value · Move up · Move down · Show
in JSON · Remove. List-like details (`sameAs`, `image`, `recipeIngredient`,
`author`, `keywords`, the rules file's `list` names) show "+ Add another"
directly. Values stack with × each; reordering is never drag-only. A second
value turns a scalar into a list; removing never collapses it back. In
`itemListElement` or a list whose items carry `position`, moving renumbers
`position` in the same step; Form shows position read-only; out-of-order
positions are amber: "Positions aren't 1, 2, 3 in order." [Number them in
order].

**Templates.** A typed name, headline, date, price or image: "The same
‹label› on every ‹Type›. Link it to a field instead." [Link it]. On a site with
more than one language, typed text: "The same text goes on every language.
Link it to a field so each translation gets its own." Linked boxes with nothing
to preview: "No ‹employer› to preview".

### 3.4 A detail that is an item (F4, F5)

A **menu button** (the insert menu's dropdown), not a select:

- choices (`menuitemradio`), filtered by what the detail expects **and** by
  presence in the current graph: "‹Site› (this site)" → `{"@id": "#identity"}`
  · "This page" → `#webpage` · "This page's ‹main thing›" → `#primary` · other
  hand-added items by name ("Acme Logistics (described in Employer rating)").
  An absent target is disabled with its reason ("The main thing is left out on
  this page"). A choice a rule would flag says why: "Ratings of your own
  organization can't show."
- commands (`menuitem`): **Describe it here** · **Just a name** ("‹Employer
  rating› can't show with only a name.").
- no cross-page references in this change; pasted absolute addresses are kept.

A module item renders as a read-only linked box with **Add details to
‹name›**, never as editable nested fields.

**Describe it here** writes a nested object in place. It does not count
toward the 10 items, is not in the item list, and gets an `@id` only when
something must point at it. When a second item chooses it, it moves to top
level in one edit; the bar says "Acme Logistics is now its own item so both can
use it." [Undo].

**Inline nesting:** under the detail's label on a 2 px rail with a 12 px
indent; the parent stays in view. Miniature anatomy: type in monospace, its
needs, its values, "Add a detail to ‹name›". The nested type choice offers the
subtypes `expects` accepts. **At rest** a nested item is one summary line
("Acme Logistics · Described here · name, website and 2 more") with a chevron;
it opens expanded when new, when it has an unmet need, or when a jump targets
it. A group of three rows or fewer never collapses. Two rails at most; the
store's depth limit of 8 still applies.

Mixed ranges show the plain value first (`description`, `image`); ⋯ › "Use an
item instead".

### 3.5 The item list (F6)

Each row, top to bottom:

1. **Sentence** (14/20, at most two lines) as the row's button. Built like the
   stage's read-back from the item's own JSON: the rules file's `say` ("Acme
   Logistics as an employer: 4.2 out of 5 from 318 ratings."), else "‹name›,
   ‹a type label›." or "‹A type label› with ‹n› details."; invalid text: the
   type label, then "Not saved: the code has a problem." On templates, the
   previewed item's values.
2. **Type line** (12/16, gray-11): plain type · `#id` in monospace, then tags
   **Main**, **Left out**, **Not saved**.
3. **Verdict lines**, at most two, with their fix button.
4. **⋯**: Show in JSON · Show in Output · Change type · Leave out of the page /
   Put back · This is what the page is mainly about (plain web page) · Remove
   item.

Under the list: **Add an item** and **Paste JSON-LD**, and "‹n› of 10 items ·
‹x› KB of 32 KB, including added details" when within 20 % of a limit. At the
limit "Add an item" is disabled with "10 items is the most one page can have.
Remove one to add another."

**Leave out** on an item without `@id` mints one first and says so. A hidden
text verdict (to fix) offers "Leave it out until it's on the page" and "It's on
the page, check again".

**Change type** keeps details the new type also has; for the rest: "‹2›
details aren't expected on ‹a rating›. They're kept, and search features may
ignore them." [Remove them] [Keep them]. Kept ones move to "Not expected on…",
so changing back restores them.

---

## 4. The JSON view (F7)

- **Toolbar** above the box: "‹n› items" · **Format** (two-space indent, keeps
  key order) · **Copy** ("Copied"; hint "Copies what you wrote. Output has it
  filled in for this page."). Copy is always available, read-only included.
- **The box** is a native `<textarea>` named "JSON-LD": monospace 12/18,
  `spellcheck=false`, `autocapitalize=off`, `wrap=off`, horizontal scroll inside
  the box. No code-editor library, so Tab leaves the box.
- **Mirror** behind it (`aria-hidden`) paints the gutter numbers, the error-line
  band, red or amber gutter dots and wavy underlines. Light colouring: keys
  gray-12, strings blue-11, punctuation gray-10. Colour is never the only cue:
  gutter glyphs differ, and forced-colors mode gets outlines and glyphs.
- Enter keeps the previous line's indent. **Commit** on blur or Ctrl/Cmd+Enter.
  Text with a red problem is **held, not sent**.
- **Caret line** (12/16) under the box: `Line 9 · ratingValue` (monospace) ·
  "Rating value: a number, like 4.2" · **Edit in form**, named with its place
  ("Edit Rating value in form, line 6"). On a linked value: "Linked to Score.
  The Quiet Orchard: 4.5". On a problem: the problem's words. Past 75 % of the cap:
  "28.4 of 32 KB".
- **Status line:** "Valid · ‹n› items · ‹x› KB of 32 KB · Saves when you leave
  the box (‹Ctrl›+Enter)" (the platform's key name).
- **Verdicts** under it: "In search results", one line per item; pressing one
  puts the caret on that item. At 350 px tall the textarea keeps 160 px and the
  verdict box collapses to one line under it.
- Empty box placeholder: "Paste JSON-LD here. A whole script tag, several items
  or an @graph are fine."

---

## 5. Switching rules

- **Form → JSON** always works. The caret goes to the focused field's value,
  scrolled to the middle and washed for 600 ms. Announced "JSON, line 6".
- **JSON → Form** always switches.
  - Valid text: Form opens on the item and row under the caret (jsonc-parser
    `getLocation(offset)`), scrolled and washed. Announced "Form, Rating value".
  - Invalid text: Form shows one notice, "The form can't read this JSON: line
    ‹n› has a problem. Nothing is lost." with the one fix when there is exactly
    one, and **Go to line ‹n›**. No partial form.
  - While the text has a red problem the Form tab carries a red dot.
- **Activation is automatic** (arrow keys switch, like the dialog's header
  tablist; switching is lossless). **Focus stays on the tab**; the target row
  or line is scrolled into view. **Edit in form** is the one command that moves
  focus into the other view.
- **Memory:** the tab is remembered per viewer in `localStorage` (try/catch;
  a throwing store falls back to Form). Default Form.
- **Paste keeps the tab:** in Form, a clean paste opens the list or the item
  with the report and [Undo clean-up]; a paste that needs a decision opens the
  review, and Add returns to Form; an invalid paste shows the "can't read"
  notice with its fix.
- **Round trip** rules R1–R13 are in `../design.md` decision 6. In short:
  switching changes no byte; a form edit changes only its value's bytes (via
  `modify` + `applyEdits`); key and item order are the text's; numbers keep
  their spelling and type until edited; unknown keys stay in place; only
  Format, a clean-up or a fix re-indents; an item with a duplicate key is
  locked in Form ("“name” appears twice. Fix it in JSON." [Show in JSON]); a
  single object becomes a list when a second item is added ("Now a list of 2
  items").

---

## 6. Paste

### 6.1 When clean-up runs

Only when the box is empty, the paste replaces all of it, the caret is between
top-level items, or the text contains `<script`. A paste inside a value is
ordinary typing. In Form, "Paste JSON-LD" or a paste while focus isn't in a
text input counts as a paste into an empty box (or after the last item).

### 6.2 Steps and report clauses

The full step list is `../design.md` decision 8. Each step that changes
something adds one clause to "Cleaned up the paste: ‹clauses›." [Undo
clean-up]. Undo restores the exact pasted text, which then shows its own
problems.

| Step | Clause |
|---|---|
| script tag(s) extracted | "took it out of its script tag" / "out of 3 script tags" |
| `@graph` or top-level list flattened | "split the graph into 3 items" |
| schema.org `@context` dropped | "removed the context line" |
| `schema:` and full names shortened, `type`/`id` read as `@type`/`@id` | "used short names" |
| `null`, `""`, `[]`, `{}` dropped (never `0`, `false`) | "left out 3 empty values" |
| this site's module ids → short ids | "pointed 2 links at your site's organization" |
| blank nodes `_:x` named | "named 2 unnamed items" |
| items given an `@id` | "gave 2 items a name so they can be linked" |
| integers above 2^53 → text | "wrote 1 long number as text" † |
| `@language` dropped | "the page sets its language" |
| microdata or RDFa seen | "The page you copied also has microdata, which wasn't imported." |
| HTML-escaped text | "Some values look HTML-escaped (&amp;amp;)." |
| another system's placeholders (`{{ … }}`, `%%…%%`, `[node:…]`) | amber: "Some values look like another system's placeholders." † |

No JSON-LD at all: "No JSON-LD found in what you pasted. Microdata isn't
imported."

### 6.3 Paste review (F8)

Opens when the paste has an item the page already makes, more than 10 items,
or more than 32 KB. Title "Add from your paste"; "Found ‹n› items in ‹m› script
tags." Each item: tick, sentence, reason.

- Will be added: "Will be added · can show in search results"
- The site's organization: "This is your site's organization. Links to it will
  point to yours."
- Made by the page: "Already made by this page."
- A page or site type: "The page itself: its type is set in Add details to
  This page"
- Over the limit: "Only 10 items fit. Untick some to choose."
- Links to unticked items the page doesn't make: "‹n› link(s) will point at
  nothing" before the button.
- Footer: "The pasted text isn't kept. Only the items you add are saved."
  [Cancel] [Add ‹n› items].

---

## 7. Validation and error copy

### 7.1 Grammar

`Line ‹n› · ‹path›: ‹what is wrong, in plain words›.` with at most two buttons:
the fix when there is exactly one, and "Go to line ‹n›". The line is **where
the fix goes** (a missing comma is reported on the line that needs it). Paths
use " › " between steps. At most three problems listed, then "and ‹n› more";
the header reads "‹n› item(s) · ‹n› problems". Checked 150 ms after typing
stops.

### 7.2 Red: blocks saving (exactly syntax plus the server's rules)

The TS mirror (`validate.ts`) and `Values::custom()` share the fixtures in
`tests/fixtures/custom/`, so the red set is identical on both sides.

| Problem | Copy | Fix |
|---|---|---|
| missing comma | "a comma is missing after 4.2." | [Add the comma] |
| unclosed string | "this text has no closing quote." | — |
| trailing comma | "remove the comma before }." | [Remove the comma] † |
| single or smart quotes | "use double quotes (\") around names and text." | — |
| comment | "JSON can't have comments." | — |
| unclosed brace | "The code ends before every { has its }." | — |
| no `@type` | "“@type” is missing." | — |
| bad `@id` | "@id: use a full address, or a name that starts with #." | — |
| other `@` key or context | "Only “@type”, “@id” and a schema.org “@context” may start with @." | [Clean up] for a script tag, `@context` or `@graph` left in |
| non-finite number | "ratingValue: this number is too large to use." | — |
| unsafe scheme | "sameAs: text can't start with “javascript:”." | — |
| depth | "too deeply nested (items and lists count). Keep to 8." | — |
| count | "11 items. Keep up to 10." | — |
| size | "34 KB. Keep under 32 KB." | — |
| `null` | "offers › price is empty (null). Remove it or give it a value." | [Remove it] † |
| module id | "“#webpage” is made by this page. Use Add details, or give the item another @id." | — |
| shared id | "“#acme” is used by two items. Give the second another @id." | — |
| lone surrogate | "this text has a broken character." † | — |

Syntax words come from jsonc-parser's error codes, never the engine's message.

† Copy marked † is proposed here: the reviews fixed the rule but not its
words. Keep the grammar; adjust the words if a spec scenario says otherwise.

### 7.3 Amber: advice, never blocks

| Problem | Copy | Fix |
|---|---|---|
| relative or schemeless address | "use the full address." | [Use https://…] |
| misspelt documented name | "ratingcount isn't a detail of an employer rating. Did you mean ratingCount?" | [Use ratingCount] |
| enumeration near miss | "“Instock” isn't a value search engines document for availability. Did you mean “InStock”?" | [Use InStock] |
| duplicate key | "“name” appears twice. Only the second is used." | [Remove the first] |
| unknown or superseded name, unknown type | §3.1, §3.2 copy | — |
| page-level type as an item | "This makes the page itself a ‹Q&A page›." | [Make this page a ‹Q&A page›] |
| positions | "Positions aren't 1, 2, 3 in order." | [Number them in order] |
| identifier holding a number (`gtin`, `isbn`, `sku`, `postalCode`, `telephone`) | "Write ‹gtin› as text so no digits are lost." † | [Write it as text] |
| hidden characters (painted in the mirror) | "This text has hidden characters." † | [Remove hidden characters] |
| HTML-escaped text | "This looks HTML-escaped (&amp;amp;)." † | — |
| a field name inside other text | "This name is only filled when it is the whole value." | — |
| multi-value field into one value | "Only the first ‹tag› is used." † | — |
| two described objects, one `@id`, different values | "Two items use “#acme” with different details." † | — |

### 7.4 Saving, drafts and the bar

- A server refusal keeps `errors['schema.custom']` and adds
  `error_paths['schema.custom'] = {item, path}`, so a 422 lands on a line in
  JSON or a row in Form (red, `role="alert"`).
- Text with a red problem lives in the model's `drafts` (keyed by target,
  language and field, mirrored to `localStorage`). The item is tagged "Not
  saved"; the bar says "Not saved: line ‹n› has a problem." [Show]. Leaving the
  sheet or following another page keeps it; reopening says "You left JSON-LD
  with a problem on line ‹n› unsaved." [Restore] [Discard]. The page keeps the
  last valid text meanwhile.
- Network error: "Couldn't save your JSON-LD." [Try again].
- Commits are announced once: "Saved. 2 items." or "Not saved: line 9 has a
  problem."

---

## 8. States

| State | Form | JSON |
|---|---|---|
| Empty (F1) | "What is it?" + documented types + Paste JSON-LD row + limits line | Empty box with placeholder |
| Vocabulary loading | Opens at once; documented types search immediately; two skeleton rows and "Loading schema.org types…" after 150 ms | Unaffected |
| No vocabulary on the site | "Only types with a search feature are listed. Type an exact schema.org name to use another; the form still edits it. A site administrator can add the full list." Other types by shape. No download button in the sheet | Unaffected; name advice only for documented names |
| Vocabulary failed | "Schema.org types couldn't load." [Try again]; edit by shape | Unaffected |
| Invalid JSON (F9, F10) | "can't read" notice + fix + Go to line; red dot on Form | Problems; bar "Not saved…" [Show] |
| Server refused | The row at `path`, red | The line at `path` |
| At a limit | Add an item disabled with its reason | Problems as §7.2 |
| Left out | Tag "Left out", [Put back] | Text unchanged; gutter tag "left out" on the item's first line |
| Duplicate key | Item locked | Amber problem [Remove the first] |
| Read-only (someone else is editing) | Locked controls, "Read-only. You can view and copy this JSON-LD."; no Add, no ⋯ edits | `readonly` textarea, selectable; Copy |
| Template, nothing to preview | Linked boxes "No ‹employer› to preview"; verdicts "No ‹employer› yet" | — |
| Retired feature | "Not shown since 7 May 2026"; allowed | Same |
| Short frame (468 × 350) | about line hidden, verdict on the type line | box ≥ 160 px; one-line clean-up notice; verdicts collapsed under the box |

---

## 9. Undo

One slot, as the model already has. The bar offers **Undo** after: removing an
item or value ("Removed the item “‹label›”." [Undo]), a clean-up, a type change
that moved details, a move to its own item, an unlink. Undo restores the text
exactly. Inside a text input native undo runs first; Ctrl/Cmd+Z in the JSON box
right after one of those programmatic changes routes to the model's undo.
Programmatic text changes always go through the model (setting `.value` wipes
the browser's undo stack); no `execCommand`.

---

## 10. Keyboard and screen readers

- **Tabs:** `role="tablist"` named "Edit as", two `tab`s, each view a
  `tabpanel`. Automatic activation; focus stays on the tab; announced with the
  place ("JSON, line 6" / "Form, Rating value").
- **Tab order:** Back → tabs → ⋯ → item head buttons → verdict lines (one
  roving group) → rows in visual order (input, link button, aside buttons) →
  Also helps → Add a detail → switch → bar. In JSON: notice buttons → textarea
  → Edit in form → problems' buttons → verdict rows.
- **Comboboxes** (type search, Add a detail; one filter-list component):
  ARIA 1.2 combobox with `aria-expanded`, `aria-controls`,
  `aria-activedescendant`; focus stays in the box; ↑/↓, Enter, Escape clears
  then closes. Option names "‹Label›, ‹tag›, ‹n› of ‹N›"; description the about
  line.
- **Needs:** `aria-required="true"`, guidance in `aria-describedby`, no
  asterisk. The either-or is a `fieldset` with a real `legend` and description
  "Needed for employer rating: fill one"; each input has its own label.
- **Inline nested items:** `role="group"` labelled by the detail. The summary
  line is a `button` with `aria-expanded` and `aria-controls`; expanding focuses
  the first empty need and announces "Item reviewed, Organization, expanded";
  collapsing returns focus to the summary. Rails are `aria-hidden`.
- **Reference chooser:** a menu button; choices `menuitemradio`, commands
  `menuitem`.
- **Levels:** entering one focuses its `h3` (tabIndex −1). Back is named for
  where it goes. Escape goes up. Focus returns to the opener.
- **JSON box:** native, so Tab leaves it. `aria-invalid` while a red problem
  exists; `aria-describedby` the summary ("3 problems. First: line 9, a comma
  is missing after 4.2."). The caret line's knowledge is reachable through
  "Edit in form" (named with its place) and the status region.
- **Paste report** is a polite status; Undo clean-up is the next Tab stop.
- **Targets, contrast, zoom:** rows 44 px, buttons 28/24 px, no text lighter
  than gray-11 (gutter numbers included), forced-colors rules, nothing sticky
  that hides the focused field. At 200 % zoom the tabs take a second row and
  either-or pairs stack.
- **Checked by:** a keyboard-only Playwright run and axe at 468 × 600,
  468 × 350 and 200 % zoom.

---

## 11. Copy deck (sentence case, every string through `t()`)

| Where | Text |
|---|---|
| Sheet title | Add your own JSON-LD |
| Tabs | Form · JSON (tablist "Edit as") |
| Header menu | Copy all · Remove all |
| Type field | What is it? · placeholder "Search types, like rating or event" |
| Search groups | Has a search feature · Names · Definitions that mention “‹q›” |
| Tags | Search feature · Page kind · Proposed · Main · Left out · Not saved |
| Paste row | Paste JSON-LD · Script tags, several items and @graph are fine. |
| Limits | Up to 10 items, 32 KB in all. · ‹n› of 10 items · ‹x› KB of 32 KB, including added details · 10 items is the most one page can have. Remove one to add another. |
| Bands | Needed for ‹feature› · Also set · Not expected on ‹a book› · Not schema.org names, kept as written · Also helps · Suggested · Add a detail |
| Either-or | ‹A› or ‹B› · Fill one, so the ‹rating› can show. |
| No feature | No search feature. Search engines and other tools can still read it. |
| Reference menu | ‹Site› (this site) · This page · This page's ‹main thing› · Describe it here · Just a name |
| Nested | Hide details of ‹label› · Add a detail to ‹name› · Edit in JSON |
| Item menu | Show in JSON · Show in Output · Change type · Leave out of the page · Put back · This is what the page is mainly about · Remove item |
| Value menu | Add another value · Move up · Move down · Show in JSON · Remove |
| JSON toolbar | ‹n› items · Format · Copy · Copied |
| Caret line | Line ‹n› · ‹path› · ‹Label›: ‹expected› · Edit in form |
| Status | Valid · ‹n› items · ‹x› KB of 32 KB · Saves when you leave the box (‹Ctrl›+Enter) |
| Read-only | Read-only. You can view and copy this JSON-LD. |
| Vocabulary | Loading schema.org types… · Schema.org types couldn't load. [Try again] · Definitions are schema.org's own, in English. |

Words never used in the UI: node, schema (alone), required, rich result,
property (outside monospace names), score, eligible, and any search engine or
vendor name. "Detail" is the user's word for a property.

---

## 12. Not in this change (cut on purpose; don't build)

- An automatic repair library or a "Fix automatically" preview (per-problem
  fixes and "Clean up" stay).
- A deep-item level of the sheet (a third level is a summary line with "Edit
  in JSON").
- Rename its @id; Duplicate.
- A `{` value menu inside JSON strings (links are made in Form; typing the
  whole brace name in JSON also makes a link).
- Usage-based ranking; "You used recently".
- F8 / Shift+F8 and Ctrl/Cmd+. shortcuts.
- A vocabulary download button or POST route (drush only).
- A multi-step undo history.
- Cross-page references in the reference menu.
- Counts of reach across template items ("Can show on 35 of 37"): they belong
  to `set-up-types-from-templates`.
- A code-editor library, folding, side-by-side Form and JSON, importing from a
  URL, importing microdata or RDFa, AI on hand-added items, hand-added items at
  site scope, drag-only reordering, a completeness score, translating
  schema.org's words.

---

## 13. Mockup frame index

| Frame | Shows | Known gaps against this file |
|---|---|---|
| F0 | Entry: the read-back's "Added by hand" part | The kinds sheet's "Something else on this page" row isn't drawn |
| F1 | Empty sheet | — |
| F2 | Type search "rating" | — |
| F3 | Employer rating: verdict, needs, either-or, nested item at rest, Also helps, main switch | — |
| F4 | Reference menu on Item reviewed | Drawn as a list; build it as a menu button |
| F5 | Nested organization inline on a rail | — |
| F6 | Item list: sentences, type lines, verdicts, tags, Undo bar | The organization here came from a pasted `@graph` with `@id` links |
| F7 | JSON after a clean paste: report, caret line, verdicts | — |
| F8 | Paste review | The header Back cancels the review (no in-body back row) |
| F9 | Problems | — |
| F10 | Form while the JSON is invalid | — |
| F11 | Template scope: stepper, linked boxes, previewed-item verdict, typed-once line | Author should say "Linked as a person's name." |
| F13 | Every kind of value on a no-feature type | — |
| F14 | Loading, no vocabulary, steering, change type, read-only | — |

(F12, the cut `{` value menu, was removed from the mockup.)
