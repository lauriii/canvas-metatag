# Design

## Context

See proposal.md for why. This design pass ran on 2026-11-24:

- **An audit** of site-4 walked 46 states (a Canvas page, the Event,
  Article, Recipe and Product templates, Site settings, and Canvas's own
  prop form) and counted every cue that says where a value comes from: 94
  at rest and 126 with hover. The most on one field was 7.
- **Research** read how mature editors show bound, default and inherited
  values, and what their users get wrong. Its twelve principles are cited
  below as P1 to P12. The ones that decided most: one source line per
  field, in words, visible at rest (P1); name the source, not the mechanism
  (P2); show the value first (P3); the local typed value is the quiet
  baseline (P4); separate states by form, not color alone (P5); the source
  is the control (P6); going back is one action named by where it goes
  (P7); one vocabulary across fields and scopes (P9); screen readers hear
  the same words, from the DOM (P11).
- **Three designs**: A put a blue token naming the source inside each box;
  B kept Canvas's link icon by the label and added a source pill in the
  box; C put one source control at the right of the label row and drew
  followed values with no box.
- **Three reviewers** scored them: a first-time site builder, an expert who
  sets up dozens of templates, and design system, accessibility and build.
  All three chose **C**. Two of three scored A second. All three said B
  keeps the icon the product owner found confusing and moves signals
  rather than removing them.
- **Two critics** then read the merged plan cold: one for completeness
  (every state, path, scenario and task) and one for clarity (read as the
  product owner). Decisions 21 to 32 come from them. What was not taken is
  under "Considered and rejected".

The dialog renders with Radix Themes' light appearance only
(`extension/src/main.tsx`), so a dark theme is not part of this design.

The prototype in `reference/prototype.html` is the visual bar. Its frames
are listed in `reference/reference.md`.

## Goals / Non-Goals

**Goals**

- For every field in every scope, a site builder can tell at a glance,
  without hovering: is this typed here, filled from the item (a field or a
  fact), set somewhere wider (the site, another language), built in, or not
  set; and how to change it.
- Fewer signals than today: at most one source mark per field, none
  hover-only. The title's ending is its own field.
- One way to change a source, the same by mouse, keyboard, touch and
  screen reader.

**Non-Goals**

- New sources, new storage, or a change to what any value outputs.
- Canvas's own prop form.
- A dark theme.

## The model

Three rules carry the whole design, and one color rule makes them quick to
read.

1. **One source control per field.** A field that can take its value from
   more than one place has one small button at the right end of its label
   row. It names the source in words, ends in a chevron, and opens the one
   source menu. It is never hidden and never hover-only. A field with one
   possible source has no control and keeps its own native control (Site's
   Name is a box, Site's Currency a select, a page's description a box).
2. **A box means you type here.** Text kept at this scope (typed or
   composed) sits in an input box, as today. Everything else is a
   **read-out**: the value in ink, aligned with the label, with no box. That
   covers any value that follows something, and also a choice, a person, or
   a date that follows something, which change through the menu, not by
   typing over them. An image row keeps its own shape; it offers Change only
   when the image is chosen here.
3. **One menu, grouped by follows and set.** The source menu lists every
   source that fits the field, each with the value it would give for the
   previewed item. Its group headings use the status's own verbs: "Follows
   each Article", "Follows the site", then "Set for every Article". Linking,
   unlinking, going back to the default, choosing an option and overriding
   an inherited value are all one thing: pick a row.

**The color rule.** Blue with the link glyph means the value is filled from
the item: a field or a fact, one value per article. Gray means it is set in
SEO settings: here, in another value of this dialog, in Site, in another
language, built in, or not set. Red means broken. Color is never the only
cue: the words and the glyph say the same (P5).

```
Updated                               (link) Article's last update ⌄   ← blue: from each article
November 16, 2026, 01:14                                              ← read-out, no box

Author                                     (link) Article's author ⌄
admin

Description                                          Every Article ⌄   ← gray: set in SEO
┌──────────────────────────────────────────────────────────────────┐   ← a box: you type here
│ Body  Free delivery.                                             │
└──────────────────────────────────────────────────────────────────┘

Image                                        (link) Poster › Image ⌄
[img] An orchestra on an open-air stage at dusk
  1600 × 900 · 8 KB
```

## The vocabulary of sources

A closed set of ten kinds. Each is a noun: what the value follows, never
the mechanism (P2). The same state uses the same words in every tab and
every scope (P9).

| Kind | Control says | Look | Value shape | Examples |
|---|---|---|---|---|
| **Kept here** | the scope button's own words | gray (`--seo-ink-2`) | text: a box; a choice: a read-out of the option; an image: an image row with Change | `This page`, `Every Article`, `Site` |
| **A field** | link glyph + the field's label, or its path | blue (`--seo-link-ink`, blue-11) | read-out | `Poster › Image`, `Starts`, `Page data › Image`, `2 fields` (a group) |
| **A fact of the item** | link glyph + `‹Item›'s ‹fact›` | blue, as a field | read-out | `Article's author`, `Article's last update`, `Article's publish date`, `Event's title`, `Article's description`, `Page's title`, `Page's author` |
| **Another value in this dialog** | its name | gray | read-out | `Search description` |
| **The site** | `This site` for the site as a who; `Site ‹thing›` for a site value | gray | read-out | `This site`, `Site name`, `Site ending`, `Site image`, `Site setting` |
| **Another language** | `‹Language› version` | gray | read-out | `English version` (a page translation's social image, robots rows and kind only) |
| **Built in** | `Default` | gray | read-out | Kind of article: Article; What this page is: A web page |
| **Nothing** | `Not set` | gray | typeable: an empty box; otherwise the label row only | Prep time, Organizer, Performers |
| **Broken** | broken-link glyph + the field's label, or its machine name if the field is gone | red (`--seo-broken-ink`, red-11) | italic line: the reason and the outcome | `field_teaser` · "No longer exists, so each article uses its default description." |
| **Set outside SEO** | lock glyph + `Outside SEO`, static | gray | locked box or read-out | an ending set in `settings.php` |

Word rules:

- `‹Item›` is "Page" on a Canvas page and the type's label on a template.
  The word "page" is never said on a template.
- The kept-here word is the scope button's own label ("This page", "Every
  ‹Type›", "Site"). The scope button teaches it once.
- "Set" is the one verb for a value kept here, in every sentence: the menu
  heading ("Set for every Article"), a box's description ("Set for every
  Article."), the status ("Updated is now set for every Article.") and
  Checks ("Set for every Article."). "Follows" is the one verb for the rest.
  "Same for", "Kept for" and "Kept on" are not used.
- In a sentence, a source name that starts a phrase in capitals drops it:
  "Author now follows this site."
- A fact's name is one translatable string per fact, with the type as a
  placeholder, so a language can phrase the possessive its own way.
- `Default` has one meaning: what a field gives when nobody chooses. At rest
  it appears only for a built-in choice, which has no noun behind it. In
  the menu it marks the default row. Picking the default row never stores
  (decision 25), so `Default` at rest always means nobody chose.
- A path gives way from its start ("… › Image"), so the field it ends at
  stays in sight.
- Never at rest, in any field: "Linked", "Automatic", "Inherited", "Set
  for every", "Set on this page", "From the page", "Same as". Menu headings
  and sentences (the status, Checks) are not at rest and may use "Follows"
  and "Set for every".
- A base property of the item (title, author, created, changed) is a fact.
  It is listed once, under its fact name, never again under the type's
  fields, so the same data never shows in two looks.
- A text value's own worked-out default is named as its fact everywhere:
  the description of every Article follows "Article's description" in the
  control, the chip and the menu. Its menu row says which field it reads
  ("from Body › Summary"). An image's default reads one field and is named
  by that field ("Image"), because following it is the same as linking it.
- No kind "from the template" exists: a node through a template has no
  values of its own (per-node overrides are a v1 non-goal), so nothing
  inherits from one.
- `Search title` is not a source today: the social title follows each
  item's own title. `strengthen-zero-config-defaults` may add it, in this
  form.
- A label and its source may echo ("Starts" over Starts, "Status" over
  Status). That is honest: the detail follows the field of the same name.
  It is kept, not hidden.

## The looks

### The source control

A ghost button from the existing family (design-system.md §5.1). No new
token, size, radius or duration.

| State | Look |
|---|---|
| Rest | 24 tall, padding 0 4 0 6, radius 6. Words 12/16 weight 500 in the kind's ink; a 12 px glyph before the words for a field, a fact, broken or Outside SEO; a 12 px chevron after, `--seo-icon`. The chevron hangs 4 px into the gutter so the words end on the field's right edge. |
| Hover | `--seo-hover` fill, the words turn `--seo-ink` (blue turns blue-12). 120 ms. |
| Focus | `--seo-ring`. |
| Open | `--seo-hover` fill, `aria-expanded="true"`. |
| Static (read-only, nothing to preview, Outside SEO) | The same words, no chevron, no hover. Still focusable. No `aria-haspopup` and no `aria-expanded`. |
| A group | A right chevron: it opens the group's sheet. |
| Long words | Up to 62 % of the label row, then an ellipsis. The label never wraps for it. The whole source is in the accessible name. |
| Narrow (the field narrower than 280 px: 200 % zoom, 320 px, pair columns) | The label row stacks: the control moves under the label, starting on the label's edge, and may use the full width. A gray control keeps a faint `--seo-hover` fill at rest here, so a gray line under a label still reads as a button. |

Contrast: gray-11 on white is 6.0:1, blue-11 4.5:1 or more, red-11 5.2:1
(design-system.md §3). The target is 24 × 24 or larger.

### The read-out

14/20 `--seo-ink`, padding 6 12 inside a box that bleeds 12 px past the
gutter, so its text starts on the label's edge and the row keeps the 32 px
rhythm of an input. Titles keep one line, descriptions up to three, cut at
the end. A value is never gray and never a placeholder (P5, P10).

| Read-out of | Hover | Click | Tab stop |
|---|---|---|---|
| Text that can be typed over (a page's social title, a template's title) | The input's 1 px edge fades in and the cursor is a text cursor | Becomes the box: a native input on a page, holding the text with the caret; a composer on a template, holding the followed source as its first chip with the caret after it | No. From the focused control, → or End does what the click does |
| Anything else (a date, a person, a choice, a group, an image row) | `--seo-hover-row` fill, pointer | Opens the source menu (a group: its sheet) | No |

Nothing is stored on the click. The control flips to the kept-here word on
the first change, and the status says so. Escape, or leaving the box
unchanged, turns it back into the read-out.

A text that follows another value of this dialog (the social description
following the search description) starts from a copy of what that value
holds: its words, its fields, or the fact it follows. The copy does not
follow later changes.

The state words of a value that gives nothing (empty, hidden, broken, no
item) take the read-out's place: one italic `--seo-ink-2` line that says
the state and the outcome. It is gray because it is not a value. It
replaces the explain line that sat under the field. An issue (Ends before
Starts) sits under the read-out, after any state line, as it sits under a
box today.

### Boxes

Today's input, select-free date input, composer and number boxes,
unchanged. A box under a kept-here control is described by "Set for every
‹Type›." or "Set on this page." Under "Not set" it is empty and has no
placeholder: the control already says it.

The box rule has three stated exceptions. A locked box is gray, by §5.2's
locked look, so a box still means "kept here" when nothing can be typed. A
field with one source keeps its own native control (a select stays a
select, a switch a switch), because it has no menu to change it through. A
linked duration asks once what its field counts, as a compact segmented
choice under the read-out ("Counts minutes | Counts hours"). That is the
one second control a field may have, and it is not a select.

### Settings rows and summaries

A row in a settings list (Search › Advanced, and the visibility switch
"Show in search results") says its source on the row's second line, as a
ghost source control (design-system.md §5.7 already allows a second line).
The row's end holds its value:

- A switch stays a switch. Turning it sets the value here; the second line
  flips.
- A setting with options has no second select. Its options are rows of the
  source menu, under "Set for every ‹Type›", as a body choice's are. The
  row ends in the chosen option as a read-out, which opens the same menu.

The site's value is the "Site setting" row under "Follows the site", marked
"Default". A row's kept-here group lists its options, or, for a switch,
only the current kept value while there is one: the switch is the way to
set it. A page's canonical address has one source, so it has no control.

A closed disclosure summarizes sources, not values: the source's name when
every row inside follows it ("Site settings"), else what differs ("1 set
for every Event", "2 set on this page"). The summary shows only while the
disclosure is closed. More details names its details only; a detail that
follows a default the editor may want to change comes first ("Organizer,
Summary, 5 more"). It never repeats a default's value, which made a default
read as set.

### Choices

A choice's options are rows of its source menu, under "Set for every
‹Type›" or "Set on this page". The field shows the chosen option as a
read-out under one control. There is never a second select beside a
source control. "Not answered" becomes "Not set".

### Groups

A group (Venue, Tickets) is its label row and a read-out line. Its control
says what its set parts follow, leaving empty parts out:

- "‹n› fields", blue, when every set part is linked to a field;
- the shared source's name when every set part follows one other source
  ("This site", "Every Event", "This page");
- "Mixed sources", gray, when they differ;
- "‹n› broken", red, when any part is broken, before any other rule;
- "Not set" when nothing is set.

It ends in a right chevron and opens the sheet, where each part has its own
control. The sheet's header offers Clear, which sets every part to Not set,
says "Venue is now not set." and offers Undo. "Unlink all" goes.

### References (Author, Organizer, Employer)

One source menu replaces the select and its second link menu. Rows:
"‹Item›'s author" where the type has one (the default on Article), then
the type's fields that can be a person (user references, person or
organization references, and text fields that can hold a name), each by
its label; "This site" under "Follows the site"; and under "Set for every
‹Type›" or "Set on this page": "Someone else", which reveals the name, the
website and person or organization (as `WhoField` does today), and "Not
set". On a Canvas page an organizer or a recipe's author defaults to "This
site", as today. Where a type has no default, its "Not set" row is the
default and says "Left out until you pick one."

### The title and its ending

The ending is its own field, a row labelled "Ending" indented under the
title, as Name and Website sit under Author. It has its own source control,
like Site's "Title ending". The title's control speaks for the main part
only, with no exception.

| The ending | Control | Value |
|---|---|---|
| Follows the site | `Site ending`, gray | read-out "\| Humanify Studio" |
| Set here | the kept-here word | a text box you type in, the separator shown before the text |
| Linked | the field, blue | read-out "\| Lakeside" |
| No ending | the kept-here word | read-out "No ending" |
| Outside SEO | lock, `Outside SEO`, static | locked box |

Its menu: "Site ending" under "Follows the site", marked "Default"; at
template scope the type's text fields under "Follows each ‹Type›"; and
under the kept-here group "Type an ending" (opens the box with focus) and
"No ending". Its one footer says "The separator | is set in Site." with
"Edit in Site" for administrators. The ending is named "Title ending" to
assistive technology and described by what it adds ("Added after the
separator |."). The search preview above still shows the whole title.

### Composer and chips

A composition is kept here, so it is a box under the kept-here word. Each
chip is named by the same words as a source control would name it
("Event's title", "Body", "Venue › City"), so linking and composing share
one name. The "+" by the label goes; "Add words or fields" is a menu row,
and `{` still opens the add menu at the caret. A broken chip keeps the
composer's own broken look (value-links, unchanged); the control above it
still reads the kept-here word.

### Images

A followed image is an image row with no Change and no ×. Its menu opens
with "Choose image…" first and active, so one Enter picks an image here.
An image chosen here keeps Change. An image that follows the type's image
field by default looks the same as one linked to that field, because it is
the same thing. A page's image detail offers "Choose image…" and the
page's own image fact only.

### When the source gives nothing

| State | Control | Read-out |
|---|---|---|
| Empty for this item | the chosen source | "Empty for this ‹type›, so ‹outcome›." |
| Hidden from visitors | the chosen source | "Hidden from visitors for this ‹type›, so ‹outcome›." |
| Broken, the field is gone | red, broken glyph, machine name | "No longer exists, so ‹outcome›." |
| Broken, the field changed kind | red, broken glyph, the field's label | "No longer gives ‹a kind›, so ‹outcome›." |
| Broken, can no longer be read | red, broken glyph, the field's label | "Can no longer be read, so ‹outcome›." |
| No item to preview | the source, static | "No ‹type› to preview" (the view is read-only, as today) |
| A default whose field is empty (a page's image) | the field the default reads | the value that is used, its name line saying "Empty for this page, so the site image is used." |

A broken field's menu lists the broken entry at the top of its group,
checked, red, with its reason as its second line, and opens on it. Every
other row is a way out. The menu replaces today's "Link another field"
action under a broken link.

### Read only, and set outside SEO

Locked: every control is static words, with no chevron and no hover.
Nothing reacts: a read-out shows no edge, fill or text cursor; a click
turns nothing into a box; Delete and Backspace on a control do nothing. A
group still opens its sheet, read-only. A value kept here keeps a gray
locked box, so a box still means "kept here".

A value set in the site's settings file shows the lock glyph and "Outside
SEO" in its control, at rest, over a locked box or a read-out. Its
guidance names the place: "Set in the site's settings file. Ask whoever
hosts the site." The sentence that close-known-limitations specifies
becomes the control's description.

### Another language

Only a Canvas page translation follows another language, and only for the
three settings that are the same in every language (`Resolver::layers()`
reads them from the default translation): the robots rows, including "Show
in search results", the kind ("What this page is"), and the social image.
Texts are translated, so a translation's title, description and social
texts never follow another language. A page's description is Canvas's own
field in every language. Templates and Site do not follow another language.

On a translation, those three fields name "English version" (or the
default language's name), gray, with a dashed border in forced colors. The
menu lists it under "Follows the English version", marked "Default". Delete
on the control goes back to it. Setting the value on the translation is
"Set on this page", in that language. The status says "‹Field› is back to
the English version."

## The source menu

The existing link menu (design-system.md §5.13), renamed and regrouped.
Its placement, sizing, filter, keyboard and short-frame rules are
unchanged. Every source menu has the filter "Find a source", the short
ones included.

```
┌ Find a source ─────────────────────────────┐
│ Follows each Article                       │
│ (link) Article's last update   Default  ✓  │   current: --seo-selected + check
│ November 16, 2026, 01:14                   │
│ (link) Article's publish date              │
│ February 18, 2026, 18:22                   │
│ (link) Revised on                          │
│ November 2, 2026                           │
│ Set for every Article                      │
│ Type a date                                │
│ Not set                                    │
│ Left out                                   │
│ 11 other fields can't be used here      ›  │   footer
│ ↑ ↓ move · ↵ choose · esc close            │   tall frames only
└────────────────────────────────────────────┘
```

- **Groups, in this order**, each shown only when it has a row: "Follows
  each ‹Type›" (template) or "Follows the page" (page): facts, then the
  fields that fit; "Follows the site"; "Follows the ‹Language› version";
  "Set for every ‹Type›", "Set on this page" or "Set for the site": the
  action rows ("Type a date", "Type a title", "Type an ending", "Someone
  else"), a choice's options, and "Not set" where a value may be left out.
- **Two rows sit above the groups**, right under the filter, where they
  apply: "Add words or fields" ("Keep ‹Source› and add to it") on text that
  can be composed, as today; and "Choose image…" ("From the media library")
  on an image, active when the menu opens. They act on the value in place,
  so they stay in sight.
- **Rows** are named by the same words as the control, blue with the glyph
  for a field or a fact. The second line is the value it would give for the
  previewed item, or what happens ("Left out", "Empty for this ‹type›"). An
  action row has a second line only when it adds something ("Type a name
  and a website"). The default row is marked "Default"; the current row has
  a check and the selected fill.
- **Only what fits is a row.** Fields that cannot fill the value wait behind
  one quiet line in the footer, "‹n› other fields can't be used here ›",
  which opens them disabled, each with its reason ("An image, not text").
  The filter still finds them.
- **One footer**, only where needed: the unfit line; "Edit in Site" for
  administrators when a site row is listed; on the ending, "The separator |
  is set in Site."
- **Role**: a dialog named "Source of ‹Field›" with a labelled filter and a
  listbox. Groups are `role="group"` labelled by their heading; rows are
  options, the current one `aria-selected="true"`. Not `role="menu"`: a
  text filter inside a menu is invalid, and the existing listbox code and
  its tests are reused.
- The "Automatic" group, "Instead of the default", "Replace the text with
  a field", "Use “‹filter›” as the ending" and the second Author menu go.

"Link menu" in requirements this change does not touch means this source
menu. Task 9.2 renames them when the specs are archived.

## Interactions

| To… | Mouse or touch | Keyboard | What happens |
|---|---|---|---|
| See where a value comes from | Look at the label row | Tab to the control; its name says it | Nothing to hover |
| Change the source | Click the control, or a non-text read-out | Enter, Space or Alt+↓ on the control; a printable key opens it with that key in the filter. In the menu ↑ ↓ Home End move, Enter picks, Escape closes | The menu shows every source that fits, with its value; the current one is checked |
| Link a field | Pick it under "Follows each ‹Type›". Type to filter | The filter has focus when the menu opens | The control turns blue and names the field; the value becomes a read-out |
| Edit a followed text in place | Click its read-out and type | → or End on the control (`{` also opens the add menu) | A page: the native input holding the text. A template: a composer whose first chip is the followed source ("Add words or fields" does the same). The control flips on the first change |
| Set a new value here | Pick "Type a ‹kind›" | Same | An empty box with focus. Nothing is stored and the control keeps its source until the first value. Escape, or leaving it empty, goes back with no sentence |
| Name someone else | Pick "Someone else" | Same | Stored at once, so the site is no longer assumed. The control flips; the status says "‹Field› is now set for every ‹Type›. Type a name." Nothing is output until a name is typed |
| Pick an option | Pick it | Same | Stored at once; the control flips |
| Go back to the default | Pick the row marked Default | Delete or Backspace on the focused control, or pick the row | "‹Field› is back to ‹Source›." Nothing is stored. Undo in the bar |
| Undo | Undo in the action bar | Ctrl/Cmd+Z, or Tab to Undo | The sentence is a passing message. Undo stays until the next change or a scope switch, with no time limit |
| Edit a site value | "Edit in Site" in the menu's footer | Same | Switches to Site and puts focus on that setting. Today's aside Edit moves here |
| Take a suggestion (description, kind) | Suggest | Same | The value is set here; the control flips; the status says so |
| Paste on a control | — | Ctrl/Cmd+V on the control of text that can be typed over | Opens its box (input or composer) and pastes there |

**Tab order** per field: the source control, then its box (if any). The
title's ending is the next field: its control, then its box. A read-out is
not a Tab stop. A field with a followed value is one stop; a field with a
box is two. This matches what the eye reads, top to bottom, and Canvas,
whose link button comes before its input.

**The status** says one sentence after every change, also shown in the
action bar with Undo:

- "‹Field› now follows ‹Source›." (a field, a fact, another value, the site,
  a language)
- "‹Field› is now set for every ‹Type›." / "… set on this page." /
  "… set for the site."
- "‹Field› is back to ‹Source›." (the default)
- "‹Field› is now not set." (Not set, and going back where the default is
  Not set)

## What screen readers hear

All from the DOM (P11). `aria-description` is no longer used for sources.

- **Source control**: a button with `aria-haspopup="dialog"` and
  `aria-expanded`. Its name starts with its visible words, then names the
  field: "Article's last update, source of Updated" (WCAG 2.5.3). A
  read-out under it is its `aria-describedby`: "November 16, 2026, 01:14."
  A broken one: "field_teaser, broken, source of Description", described
  by the reason line. A static one has no popup and no expanded state.
- **Box**: named by its label as today; described by its source as a
  sentence ("Set for every Article.", "Set on this page.", "Not set.") and
  its guidance.
- **Read-out**: plain text, not focusable, reached through the control's
  description and by reading the page.
- **Menu**: as above. A row's name is its source, then "Default" where it
  applies; its value is its description.
- **After a change**: the polite status speaks the sentence. Focus returns
  to the control, or goes into the new box.

## Forced colors

Today's boxes are drawn with `inset box-shadow`, which forced colors drop,
so a box, its tag and a plain value look alike there. The model needs real
edges and forms per kind (from B). Four things must stay apart:

- **Box and read-out.** Inputs, the composer and image thumbs: `outline:
  1px solid CanvasText; outline-offset: -1px`. A read-out has no edge.
- **A control is a button.** `1px solid ButtonText` border on every source
  control.
- **Item, wider scope, broken.** A field or a fact keeps its link glyph;
  the site and another language get a **dashed** border; broken keeps its
  glyph; Outside SEO its lock.
- **Focus.** `outline: 2px solid Highlight`. The current menu row:
  `Highlight` fill and `HighlightText`.

Values stay `CanvasText`, never `GrayText` (the system's color for
disabled).

## Every audited state, after

Signals counted as the audit counts them: every mark at rest that says where
a value comes from, or is a way in to change it. A box is not a cue, and
neither is its absence. Before is "at rest / with hover"; after has no
hover-only cue.

| # | Field | Truly | After | Before | After |
|---|---|---|---|---|---|
| 1 | Event · Search title | each item's title; ending set for every Event | `(link) Event's title` → read-out; the Ending row `Every Event` → box | 4 / 7 | 1 + 1 (ending) |
| 2 | Event · Search description | the default, worked out from Description › Summary | `(link) Event's description` → read-out | 3 / 3 | 1 |
| 3 | Event · robots rows | the site | second line `Site setting`; closed summary "Site settings" | 1 / 2 | 1 per row |
| 4, 12 | Event · images | linked to Poster › Image | `(link) Poster › Image` → image row, no Change | 4 / 5 | 1 |
| 5 | Event · Social title | each item's title | `(link) Event's title` → read-out | 3 / 4 | 1 |
| 6, 18 | Social description | follows the search description | `Search description` → read-out | 3 / 4 | 1 |
| 7 | Starts, Ends, Status | linked | `(link) Starts` → read-out | 4 / 5 | 1 |
| 8 | Venue | two parts linked | `(link) 2 fields ›` → read-out | 0 / 0 | 1 |
| 9 | Venue sheet parts | linked / empty / link only | `(link) Venue › Title` / `Not set` + empty box / `Not set` row | 3 / 1 / 3 | 1 / 1 / 1 |
| 10 | Event name | each item's title | `(link) Event's title` → read-out | 3 / 4 | 1 |
| 11 | Summary | follows the search description | `Search description` → read-out, or "Empty for this product, so it is left out." | 4 / 5 | 1 |
| 13 | Tickets | not set | `Not set ›` row | 1 / 1 | 1 |
| 14 | Organizer (template) | not set | `Not set` row | 2 / 2 | 1 |
| 15 | Performers | not set, link only | `Not set` row; the second icon goes | 3 / 3 | 1 |
| 16 | Article · composed description | set for every Article | `Every Article` → composer | 3 / 5 | 1 |
| 17, 19 | Article image | the Image field, linked or by default | `(link) Image` → image row (one look for both) | 4 / 5, 3 / 4 | 1 |
| 20 | Published | each item's created date | `(link) Article's publish date` → read-out | 3 / 5 | 1 |
| **21** | **Updated** | each item's changed date | **`(link) Article's last update` → read-out** | **3 / 5** | **1** |
| **23** | **Author** | each item's author | **`(link) Article's author` → read-out "admin"; one menu** | **2 / 2 (both misleading)** | **1 (true)** |
| 24 | Recipe author | not set | `Not set` row; the menu says what that means | 2 / 2 | 1 |
| 25 | Kind of article | built in | `Default` → read-out | 0 / 0 | 1 |
| 26 | More details summary | repeated a default as if set | names only: "Author, Headline, 2 more" | n/a | n/a |
| 27 | Recipe description | linked to Ingredients | `(link) Ingredients` → "500 g rye flour and 3 more" | 4 / 5 | 1 |
| 28 | Prep time, Serves, Brand | not set, typeable | `Not set` + empty box (units stay) | 1 / 1 | 1 |
| 29 | Price, empty for the item | linked | `(link) Price` → "Empty for this product, so the price is left out." | 5 / 6 | 1 |
| 30 | Bought on this page, Availability | not set | `Not set` row ("Not answered" goes) | 2 / 2 | 1 |
| 31 | Page · Search title | typed; ending from the site | `This page` → box; the Ending row `Site ending` → "\| Humanify Studio" | 0 / 2 | 1 + 1 (ending) |
| 33 | Page · description | the page's own field, one source | no control; box; focus guidance | 0 / 1 | 0 |
| 34 | Page · Social image | the default reads Page data › Image | `(link) Page data › Image` → image row | 0 / 1 | 1 |
| 35 | Page · Social title | follows the page's title | `(link) Page's title` → read-out | 1 / 2 | 1 |
| 36 | Page · Social description | follows the search description | `Search description` → read-out | 1 / 2 | 1 |
| 37 | What this page is | built in | `Default ›` → read-out; the pill goes | 1 / 1 | 1 |
| 38, 40, 42 | Site · Name, Default image, robots | one source | no control | 0 / 0 | 0 |
| 39 | Site · Title ending | the site name | `Site name` → read-out "\| Humanify Studio" | 2 / 3 | 1 |
| 41 | Site · Currency | not set, one source | no control; its own select reads "Not set" in ink | 1 / 1 | 0 |
| T | Translation | the English version (image, robots, kind) | `English version` → read-out | 1 / 2 | 1 |
| B | Broken | the field is gone | red `field_teaser` → reason and outcome | 4 / 4 | 1 |
| L | Locked | read only | static words; a kept value keeps a locked box | 0 / 0 | 1 |
| PD | Page · dates | the page's dates | `(link) Page's last update` → read-out | 1 / 2 | 1 |
| PO | Page · Organizer | the site | `This site` → read-out "Humanify Studio" | 1 / 2 | 1 |

Over the rows above: **94 cues at rest and 126 with hover today; 43
after, all at rest.** The most on one field drops from 7 to 1. No field has
two cues that disagree; today rows 1, 6, 10, 18, 21 and 23 do. Some states
gain a cue at rest (8, 25, 31, 34, 35, 36, L, T, PD, PO): today they are
silent at rest, or say their source only with a gray placeholder or on
hover. A cue was owed there.

## What is deleted

- The link button after every linkable label, its tooltip ("Change the
  link for … · Follows the default: …"), and the "+" on composers.
- The aside's source words ("From the page", "From the page title", "Set
  for every ‹Type›", "Set on this page", "From each ‹Type›", "Same as
  description", "Site default", "The site, by default", "Ending set for
  every …", "Also in Page data", "From the ‹X› field"), and its Reset,
  "Reset · Undo" and Edit.
- The box's tag line ("Default", "Default · Title", "Default · from
  Image", "Default · Description, from Description", the blue tag of a
  link), the gray default box, and the × on linked boxes.
- `(the page's author)` and `(this site)` in option names; the Author
  select and its second link menu.
- The "Default" pill on What this page is.
- The title ending's inline menu button beside the main part, and the
  ending menu's "Use “‹filter›” as the ending".
- The second select on settings rows with options.
- Gray values for defaults; placeholders that stand for an inherited value.
- "Not answered", "Link a field…" and the link icon inside link-only boxes.
- The menu's "Automatic" group, "Instead of the default", "Replace the
  text with a field", and the in-list row of fields that don't fit.
- The explain line under a link that gives nothing; "Unlink all".
- Code: `boxTag()`, `detailFrom()` and `DETAIL_FROM` in `values.ts`; the
  aside in `useField()`; the tooltip and `followsDefault()` in `useLink()`;
  the `WhoField` select; `aria-description` "Inherited from …".
- Tokens: `--seo-link-bg`, `--seo-link-line`, `--seo-default-bg`,
  `--seo-default-line`, `--seo-default-ink`.

## Decisions

### 1. The base is C, "Source first"

All three reviewers chose it. It is the calmest on a long Schema tab, the
densest when many details are not set, the only design where a value
typed over a default still says so at rest, and the cheapest where it
matters (followed page text is plain text that becomes the native input on
a click: no inline tokens in a `textarea`, no editor chunk on pages).

*Alternatives:* A (a source token inside each box) was the most compact
and had the best single idea, which is grafted (decision 11). Its typed
fields showed their way in only on hover, and typing over a focused token
silently replaced it. B kept the label's link icon, the exact signal the
product owner found confusing, and added a pill.

### 2. "A box means you type here", not "kept here"

C's rule was "a box means the value is kept here". Reviewers found four
exceptions to it and two chevrons side by side on a choice kept here. The
expert reviewer's restatement removes both: only typeable text gets a box;
choices, people, dates that follow something and groups are read-outs and
change through the menu. The novice and system reviewers asked for the
same fix in their own terms (merge a choice's options into the source
menu; never two chevrons in one row). Its three exceptions are stated
under "Boxes" (decision 29).

### 3. The kept-here word is the scope button's label

The reviewers disagreed. Expert: "Every ‹Type›" on templates and "This
page" on pages. Novice: "Every ‹Type›" on templates, keep "Set here" on
pages. System: keep "Set here" and check its volume. Chosen: the scope
button's own words everywhere ("This page", "Every ‹Type›", "Site").
Why: "Set here" on a template reads as "for this preview item" (all
three noted it); the scope button is already on screen and already says
exactly where a value is kept; one rule with no exception is easier to
learn than one word per scope. Task 7.8 tests "This page" beside "Page's
title"; if people misread it, "Set here" is the fallback on pages only.

### 4. A read-out is not an input, and shows it can be typed over

System: the read-out must not be a borderless input (WCAG 1.4.11); a click
turns it into the box; the keyboard path is the control. Expert: give it a
visible edge on hover and focus, and keep it a Tab stop. Novice: show a
text cursor and name the menu row by its action ("Type a title"). Chosen:
system's structure with the expert's and novice's cues. The read-out is
plain text and never a Tab stop (one stop per followed field keeps a long
tab fast), its input edge fades in on hover with a text cursor, and the
menu's row says the action. This keeps the spreadsheet failure away: the
box appears at the click, before any typing, so nobody overwrites a source
without seeing the shape change.

### 5. Default versus chosen is not shown at rest

All three reviewers noted that a default and the same source picked by
hand look alike. The output is the same, and the question a builder asks
first is "where from", not "who chose it". The menu marks the default row.
The spec says so, so nobody adds a fourth look later. The expert's wish to
audit "what did someone change" is served by Canvas's own Review changes
and by the disclosure summaries.

### 6. "Default" stays, with one meaning

System asked to retire "Default" at rest and name the built-in choice
"Built-in". Chosen: keep "Default", defined once as "what a field gives
when nobody chooses", shown at rest only where no noun stands behind it.
"Built-in" would add a second word for the idea the menu marks as
"Default", which is the audit's inconsistency 7 again.

### 7. Settings rows say their source on a second line

Novice: let a row's select be its source menu. System: put the source on
the row's second line and keep the trailing slot for the value. Chosen:
system's placement, with the novice's merge. The source is on the second
line; a switch stays at the end; a setting with options has its options in
the source menu, as Status does, and ends in its value as a read-out. One
chevron per row, and one pattern for every choice (clarity critic).

### 8. The title ending is its own row

Superseded by decision 23.

### 9. A control keeps the chosen source when it gives nothing

System asked that the control name the source that actually gives the
value ("Site image" when the page's Image field is empty). Chosen: the
control keeps the chosen source, and the read-out says it is empty and
what is used instead. Why: naming the fallback would make a page with no
image yet look as if it were set to the site image, and hide that it will
follow the page once it has one. The system reviewer's real concern, a
field's name over a value that came from elsewhere, is met by the
read-out's first words.

### 10. A broken link names the field by its label while it exists

The novice reviewer asked for labels, not machine names. A field that is
gone has no label left (`tagOf()` names it by machine name), so only the
"no longer exists" case shows a machine name. The other two reasons keep
the label. The expert reviewer's "say the reason, not Missing" is the
read-out: three reasons, three sentences.

### 11. Chips use the sources' names (from A)

Two reviewers asked that the composer's chip and the control use the same
words. A chip that follows a fact reads "Event's title", not "Title". The
fact once called "Description" becomes "Article's description", which
also stops "Description" meaning three things in one menu.

### 12. Menu groups by where the value lives (from A)

All three reviewers asked for A's groups. They teach linked versus kept
here at the moment of choice, and replace "Automatic", "Fields" and a bare
"Set here". Their words are decision 22's.

### 13. Status sentences (from A)

All three asked for A's sentences ("Updated now follows Article's publish
date", "Updated is back to Article's last update") over C's terse "now Set
here".

### 14. Delete on the focused control goes back (from A)

Two reviewers asked for it. One key, said in the status, with Undo.

### 15. Forced-color forms per kind, closed summaries, where a removal goes (from B)

Two or three reviewers asked for each: a dashed border for a wider scope;
summaries that say what differs; a menu row's second line that says where
going back leads; a locked look that keeps the words.

### 16. Not set: the label row only, the whole row a target

The expert reviewer valued the density; the novice reviewer asked where to
click. Chosen: a not-typeable detail that is not set is one row, and the
whole row is the target with a hover fill. A typeable one keeps an empty
box.

### 17. The source menu is a dialog with a listbox

All three designs said `role="menu"`. The system reviewer showed that the
existing link menu is a popover dialog with a filter and a listbox, and a
text input inside `role="menu"` is invalid. Chosen: keep the dialog and
listbox, and its tested keyboard code.

### 18. The control stays 12 px

The novice reviewer suggested 13 px. 12/16 at weight 500 keeps the label
(13/500 ink) the first thing read, measures 6.0:1 in gray-11, and fits a
24 px target. Task 7.8 checks with people that it is found and clicked;
13 px is the fallback.

### 19. Images change in one keystroke

A followed image has no Change. Its menu opens with "Choose image…" first
and active, so Enter, Enter picks one.

### 20. A page's description has no control

It has one source, the page's own field. Drawing it as a blue link over a
box (C) brought back the "static or linked?" doubt on the page's most
important text. It is a plain box, with "Also changes Page data's
description." as focus guidance.

### 21. Blue means "filled from the item"

Clarity critic: gray covered values that change per item ("Article's
author") and values that never change ("This site", "Every Article").
The blue and gray line followed a storage detail (a base property versus a
configured field), which builders do not know. Chosen: color by meaning.
A fact takes the field's look, blue with the link glyph. Gray is everything
set in SEO settings. This answers the product owner's question, "static or
linked?", with one look, and makes the chip and the control match. The
long tab gets more blue, but every blue row means one thing.

### 22. Menu headings use the status's verbs

Both critics found "set here" said four or five ways ("Same for every",
"Kept for every", "One date for every", "Set for every"), and only "each"
versus "every" telling the groups apart. Chosen: "Follows each ‹Type›",
"Follows the page", "Follows the site", "Follows the ‹Language› version";
"Set for every ‹Type›", "Set on this page", "Set for the site". A box's
description, the status and Checks say "Set for every ‹Type›." too. Row
sublines that repeated the heading go. It also takes "this page" out of
the follows group on a page.

### 23. The title ending is its own row

Replaces decision 8, which drew the ending's source by shape only. Both
critics found it broke four of this design's own rules: a box you could not
type in, a gray value, a value that looked like a second source control,
and a different look on Site. Chosen: the ending is a row labelled "Ending"
under the title, drawn as Site draws its Title ending, with its own source
control. A kept ending is a real input. The title's control speaks for the
main part with no exception. Cost: one more row on the Search tab, and one
more Tab stop. The search preview still shows the whole title.

### 24. Setting a value here is pending until its first value

Completeness critic: four rules gave three answers for "Type a date" with
nothing typed. Chosen (the clarity critic's form): picking "Type a ‹kind›"
opens an empty box with focus. Nothing is stored, no sentence is said, and
the control keeps the source in use until a value is entered. Escape or an
empty blur goes back silently. "Someone else" is the one exception: it
stores a marker at once, because on a page it must stop the site being
assumed (seo-dialog "Who nobody chose is said"). It flips the control and
says "‹Field› is now set for every ‹Type›. Type a name."

### 25. Picking the Default row never stores

Completeness critic: kind, link, select and the field a default reads each
had their own answer. Chosen: one rule for every field. Picking the row
marked "Default" stores nothing and says "‹Field› is back to ‹Source›."
Picking any other row stores it, even when it gives the same value today.
So "Default" at rest always means nobody chose, and "Every Article" always
means someone did.

### 26. One name for a text's own default

Clarity critic: the description's default was "Summary" in the control,
"Post's description" as a chip, and listed twice in the menu. Chosen:
"‹Type›'s description" everywhere, blue, its menu row saying "from Body ›
Summary". The field it reads is listed once, as a field. The name no longer
changes on a click. An image keeps the field's name, because following an
image's default and linking its field are the same.

### 27. Only fields that fit are rows

Clarity critic: "12 fields that aren't a date" sat in every menu, and
Updated's menu had no date field to link. Chosen: fitting fields are rows
under "Follows each ‹Type›" (Updated lists "Revised on"; Author lists the
type's person fields and name text fields). The rest wait behind one quiet
footer line that opens them disabled with their reasons.

### 28. A group says what its set parts follow

Both critics found "2 sources" ambiguous and G1's sheet contradicting "2
fields". Chosen: the rules under "Groups". "Mixed sources" says there is
more to see without a count to misread. A broken part turns the group red.

### 29. One-source fields keep their own control

Completeness critic: Site's Currency was a select with no rule for it.
Chosen: the box rule applies to fields with a source control. A field with
one source keeps its native control, "Not set" in ink.

### 30. Only three settings follow another language

The completeness critic found the translation frame drew a state that
cannot exist (a page's description never follows the English version). The
code shows only robots, the kind and the social image follow the default
translation. Chosen: draw and specify those three; say that texts never
follow another language and that templates and Site do not.

### 31. "Outside SEO", not "Site configuration"

Clarity critic: "Site configuration" sat beside six other "Site …" words,
and read as a synonym of "Site setting". Chosen: the lock glyph and
"Outside SEO", with guidance that names the place and who can change it.
The footer that jumps to Site says "Edit in Site", the scope button's word.

### 32. Undo waits for the next change

Completeness critic: "4 s" contradicted the main spec's "An Undo waits for
the editor" and fails keyboard users (WCAG 2.2.1). Chosen: the sentence is a
passing message; Undo stays until the next change or a scope switch.

## Considered and rejected

- **A built-in choice reads the kept-here word at rest** (clarity critic,
  finding 4: "Every Article" over Kind of article's untouched "Article").
  Rejected. With decision 25, picking the default row never stores, so
  "Default" at rest means only "nobody chose" and cannot sit beside the
  same choice made by hand. "Every Article" over an untouched value would
  claim a builder set it, and Checks would then say "Set for every
  Article." when nothing is stored. "Default" stays the one word for
  "built in", shown only where no noun stands behind it. It is an open
  question for the product owner, since "Default" is the word circled in
  screenshot 2.
- **Show a settings row's second line only when it differs from the
  summary** (clarity critic, finding 6). Rejected. A row is a field with
  more than one source, and rule 1 shows every such source at rest. The
  repetition it targeted is removed another way: the summary shows only
  while the disclosure is closed.
- **Flip the control at once when "Type a ‹kind›" is picked** (completeness
  critic, A1). Rejected in favor of the clarity critic's form (decision
  24): the control keeps naming the source in use until a value exists, as
  a page's social title already does, so it never says "set" before
  anything is set.
- **Move the translation frame to the social description or a Schema text
  detail** (completeness critic, A2 and B1). Rejected as drawn: those texts
  are translated and never follow another language. The intent is kept
  with the three settings that really do (decision 30).
- **Short menus have no filter** (completeness critic, D1, the
  alternative). Rejected: every source menu has "Find a source", so the
  keyboard path never changes. The ending's and the kind's menus gain it.
- **Move the "Outside SEO" kind out of this change** (completeness critic,
  B4, the alternative). Rejected: the vocabulary must be closed when the
  build starts. It gets a scenario and a test task instead.
- **Move a duration's unit into the link row of the menu** (completeness
  critic, B8, the alternative). Rejected: the unit is a property of the
  link that a builder must see at rest to trust "45 min". It is a compact
  segmented choice under the read-out, the one stated second control.
- **"Remove" instead of "Clear" on the group sheet** (clarity critic,
  finding 13). Rejected: "Remove" reads as removing the group itself.
  "Clear" sets every part to Not set, which is what it does. It is added to
  design-system.md §7's word list on purpose (task 7.1).

## Other open changes this language touches

Task 9.1 re-checks each against this change before either is applied.
Found on 2026-11-24:

| Change | What it plans in today's language | What it becomes |
|---|---|---|
| `strengthen-zero-config-defaults` | Social and description source lines: "Same as search title", "Same as description", "From the Image field", "From the page's first image", "Made from the title", "The site's image", "From the page's text", "From each Event's Poster" | Source controls: `Search title`, `Search description`, `(link) Image`, `(link) Page's first image`, `Title card`, `Site image`, `(link) Page's text`, `(link) Poster › Image` |
| `close-known-limitations` | A locked field's aside "Set in site configuration outside SEO" visible at rest; its design-system edit of the aside (task 5.4) | The `Outside SEO` kind: lock glyph in the control, the sentence as its description, the place as guidance; its §5.2 edit lands on the new §5.2 |
| `add-advanced-meta-tags` | value-links scenarios with "a link button by its label, named Change the link for Description" and "a date input without a link button" | The source control's words; "a date input with no source control" |
| `link-groups-and-pick-pages` | Linked pairs stack; "raw → reading" in a box; tags drop a shared parent; box dates in full; a linked group box's tooltip; "First of ‹n›" in a box's tooltip | Read-out and control rules: the pair wraps by the 280 px rule; the reading is the read-out; the control's path gives way from its start; no tooltips on read-outs (the words are in the control's description) |
| `test-in-every-engine-and-language` | Accessibility snapshots of the link menu "with its named groups", in link and add mode; three link menu defects | Snapshots of the source menu's new groups and names |
| `describe-the-publisher` | A link menu with ticks for Profiles on Site; the publisher's "This site" | Same menu, new group names; "This site" is the site-as-a-who source |
| `make-the-module-agent-ready` | `describe` lists rows "in the link menu's order" | The order is unchanged; only group names change, and unfit fields leave the rows |
| `set-up-types-from-templates` | The link menu with references | The source menu with references |
| `derive-structured-data-from-components` | Values from components | A component is a source filled from the item: blue, named by the component's label, added to the vocabulary by that change |
| `add-home-page-defaults` | Checks details "Set for every Article.", "Set on this page." | Unchanged: the sentence form this vocabulary uses everywhere |

`read-page-components`, `add-structured-data-diff-and-overview`,
`describe-product-variants-and-returns`, `expose-seo-to-canvas-ai` and
`serve-each-frontend-its-own-addresses` plan no source UI.

Several open changes modify the same value-links and seo-dialog
requirements this change modifies. Whichever is archived second rebases
its delta onto the first (task 9.2).

## Risks / Trade-offs

- **A read-out with no box may look fixed.** → The control's chevron, the
  input edge on hover for text, the fill for the rest, and "Type a ‹kind›"
  in the menu. Task 7.8 tests it with people new to the dialog.
- **The right edge has words on every multi-source field.** That is more
  ink at rest than today's invisible asides, on purpose (P1). → 12 px, one
  mark per field; the 15-detail frame shows it reads as a property sheet.
  If a page's Search tab reads as wallpaper in review, the fallback is to
  drop the control on typed fields whose only other source gives nothing.
- **More blue on a long template tab** (decision 21). → Every blue row
  means one thing, and the gray rows are the ones a builder set or chose.
  Task 7.8 checks it.
- **"This page" next to "Page's title"** both say "page". → The follows
  side is blue with a glyph, and the menu heading is "Follows the page".
  Task 7.8 asks this pair as its own question; "Set here" on pages is the
  fallback.
- **The ending is one more row** (decision 23). → It replaces a menu button
  that hid its source, and matches Site.
- **Possessives may not translate well.** → One string per fact with the
  type as a placeholder; the accessible name keeps long type labels whole.
- **One more click to unlink.** Today × unlinks in one click; now it is
  the control, then a row, or Delete on the control. The menu shows where
  the value goes, which × never did.
- **Canvas users will look for the link icon after the label.** → The link
  glyph lives on in the control, in blue, Canvas's own "linked" color.
- **Contract churn.** Button names are the test contract
  (design-system.md §8). About 16 lines in `tests/e2e` and the specs
  `seo-dialog` and `value-links` quote today's words. → Tasks change them
  with the specs, in one commit per area.
- **Typing over a followed page value is quiet until the first change.**
  → The box appears at the click; the control flips on the first change;
  Undo is in the bar.

## Open questions

- **Product:** should Recipe default its Author to the item's author, as
  Article does? Until answered, Recipe's "Not set" row is the default and
  says "Left out until you pick one." (task 8.1).
- **Product:** a built-in choice reads "Default" at rest (Kind of article,
  What this page is, Attendance). It is the word circled in screenshot 2,
  now alone and with one meaning. Keep it, or show the scope's word? See
  "Considered and rejected".
- **Product:** the title ending as its own row adds one row to every Search
  tab. Is that acceptable for a source that is always visible?
- **Product:** is "Title card" the right name for the image made from the
  title (strengthen-zero-config-defaults)? It is settled when that change
  is brought into this language (task 9.1).
