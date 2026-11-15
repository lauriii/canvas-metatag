# SEO dialog design system

The rules that keep the SEO dialog (`extension/`) consistent: tokens, layout,
type, components, states, copy, accessibility, and the checklist a change to the
dialog is reviewed against. The `refine-seo-dialog` stage uses this file as its
quality bar.

Behaviour is specified in `openspec/specs/` (mainly `seo-dialog`, `seo-checks`
and `ai-suggestions`). **Where this file and a spec disagree, the spec wins**;
fix this file in the same change. Quoted copy here is illustrative unless a spec
quotes it too.

Colours are the 12-step scales of the editor's UI theme (`gray-1`…`gray-12`,
alpha steps `gray-a1`…`gray-a12`, likewise blue, indigo, amber, red, green),
reached only through the `--seo-*` tokens below. Menus, selects, tabs, switches
and tooltips are the theme's own primitives, restyled with these tokens.

---

## 1. Five rules

1. **The result is the hero.** Every page and template view opens with what a
   search result or a shared link will show, at true size. The fields that
   change it sit directly under it, and focusing a field lights up its part of
   the preview.
2. **One quiet header, no footer.** One 44 px header row; nothing fixed at the
   bottom. A floating action bar appears only while a button is needed (Undo,
   Show, Try again, Discard, Save, Hide site) or a passing message shows.
3. **Value at rest, detail on demand.** An untouched, healthy field shows its
   label and value. Where it comes from, Reset, counts and insert buttons show
   on hover or focus. Guidance shows on focus, or stays while there is a
   problem.
4. **One disclosure per view, sheets for tools.** Rare settings sit behind one
   row ("Advanced", "More details"). Big tools (Checks, Output, Choose image,
   Custom JSON-LD) open as full-frame sheets with Back.
5. **One control language.** Four type sizes, one control height (32, plus 28
   for compact buttons), three main radii, one focus ring, one accent. Chips and
   the tab pill are the only pills. There are no text links.

---

## 2. Frame and layout

```
┌ frame (Canvas's dialog body, ~468 px wide) ─────────────────────────────┐
│ HEADER 44  [This page ⌄]◌        [Search][Social][Schema]  [● 2 to improve] │ sticky
│─────────────────────────────────────────────────────────────────────────│
│ BODY: the only scroller. 16 px gutters, 8 px top, 32 px bottom          │
│   Notices (0–2) → Stage (preview) → Fields → Settings list              │
│   ╭ ACTION BAR (floating, only when needed) ───────────────────────╮    │
│   │ ● Unsaved changes · not live yet              [Discard] [Save] │    │
│   ╰────────────────────────────────────────────────────────────────╯    │
└─────────────────────────────────────────────────────────────────────────┘
SHEET covers header + body:  [‹] Checks                              [ⓘ]
```

- **One left edge.** Labels, input boxes, stage edges, lists, notices and sheet
  content start at the 16 px gutter. Text inside stages, lists and notices is
  inset 16; text inside inputs is inset 12.
- **Fixed chrome is the header only.** At 350 px tall that leaves ~306 px of
  content. When the action bar shows, the body's bottom padding grows to 64 and
  the field in use, with its message, stays in sight above the bar.
- **No card-in-card.** The body is transparent over the dialog's white panel.
  The stage is the only tinted surface; settings lists and the social card are
  white with a hairline.
- **Vertical rhythm.** Notices 12 apart, 16 to the next block. Stage → first
  field 24. Field → field 20. Last field → settings list 24. Site groups 32
  apart, 12 from title to first field.
- The header gains a 1 px `--seo-line` hairline only once the body is scrolled
  (fades in over `--seo-fast`).

---

## 3. Tokens

Defined once on the theme root (menus and selects are portaled out of the app
container). No hex values except the preview imitation colour and the shadow
tints. Components use these names, never a raw scale step.

```css
--focus-8: var(--blue-10);              /* theme ring is 2.3:1 on white; blue-10 gives 3:1 */

/* Space: 4/8 grid */
--seo-1: 4px;  --seo-2: 8px;  --seo-3: 12px;
--seo-4: 16px;                           /* gutter, list inset */
--seo-5: 24px;                           /* stage → field, field → list */
--seo-6: 32px;                           /* group → group, body bottom */
--seo-gutter: var(--seo-4);
--seo-field-gap: 20px;                   /* between fields */

/* Sizes */
--seo-header-h: 44px;  --seo-row-h: 44px;
--seo-control-h: 32px; --seo-control-h-sm: 28px; --seo-icon-btn: 24px;

/* Radii: chip 4 (inline), then these three */
--seo-radius-control: 6px;               /* inputs, buttons, tab pill */
--seo-radius-card: 10px;                 /* notices, social card, code */
--seo-radius-surface: 12px;              /* stage, lists, popovers, tray, bar */

/* Colour roles */
--seo-ink: var(--gray-12);
--seo-ink-2: var(--gray-11);             /* the lightest text colour allowed */
--seo-icon: var(--gray-10);
--seo-line: var(--gray-a4);   --seo-line-soft: var(--gray-a3);
--seo-control-border: var(--gray-a6); --seo-control-border-hover: var(--gray-a8);
--seo-hover: var(--gray-a3);  --seo-hover-row: var(--gray-a2);
--seo-stage-bg: var(--gray-2);
--seo-selected: var(--blue-a3);          /* linked highlight, active menu row, chosen option */
--seo-primary: var(--blue-11); --seo-primary-hover: var(--blue-12);
--seo-danger: var(--red-11);
--seo-fix: var(--red-11);      --seo-fix-dot: var(--red-9);
--seo-improve: var(--amber-11); --seo-improve-dot: var(--amber-9);
--seo-ok: var(--green-11);
--seo-preview-link: var(--indigo-11);    /* result title: distinct from the UI's blue */
--seo-preview-text: #4d5156;             /* imitation of result snippets */

/* Value boxes (linked values, see §5.5): blue = linked here,
   gray = follows its default, red = broken */
--seo-link-bg: var(--blue-a2);    --seo-link-line: var(--blue-a6);    --seo-link-ink: var(--blue-11);
--seo-default-bg: var(--gray-a2); --seo-default-line: var(--gray-a5); --seo-default-ink: var(--gray-11);
--seo-broken-bg: var(--red-a2);   --seo-broken-line: var(--red-a7);   --seo-broken-ink: var(--red-11);

/* Elevation and focus */
--seo-ring: 0 0 0 1px var(--blue-10), inset 0 0 0 1px var(--blue-10), 0 0 0 4px var(--blue-a3);
--seo-ring-inset: inset 0 0 0 2px var(--blue-10);     /* rows: never clipped */
--seo-shadow-pop: 0 0 0 1px var(--gray-a4), 0 10px 28px -8px rgba(0,0,45,.16), 0 2px 6px -2px rgba(0,0,45,.08);
--seo-shadow-bar: 0 0 0 1px var(--gray-a4), 0 6px 16px -6px rgba(0,0,45,.18);

/* Motion */
--seo-ease: cubic-bezier(.2,.8,.2,1);
--seo-fast: 120ms;   /* hover, border, aside fade, hairline, preview highlight */
--seo-base: 180ms;   /* tab pill, disclosure, tray, row collapse */
--seo-sheet: 200ms;  /* sheet in (out 160ms) */
```

Under `prefers-reduced-motion: reduce` every duration is 0.

### Type

One scale; the theme's default font stack (no webfont); mono is the theme's
code font. Counts and dimensions use `tabular-nums`.

| Role | Size / line | Weight | Used for |
|---|---|---|---|
| meta | 12 / 16 | 400 (500 for group labels) | guidance, asides, captions, group labels, hints |
| label | 13 / 20 | 500 | labels, rows, tabs, buttons, menu items |
| body | 14 / 20 | 400 | values, inputs, check titles, scope label (600) |
| heading | 18 / 24 | 600, −0.01em | the Checks summary only |

Preview imitations may use their own sizes (result title 18/24, snippet 14/22,
link-card title 15/20 600); they are pictures of other surfaces, not UI.
Sentence case everywhere. The link card's host is the only uppercase text.

### Contrast (on white)

`gray-11` text 6.0:1 · `amber-11` 4.7:1 · `red-11` 5.2:1 · blue-11 on blue-2
4.5:1 · white on blue-11 4.8:1 · white on red-11 4.9:1 · focus ring blue-10
3.3:1 · switch on blue-9 3.2:1 (non-text). No text lighter than `--seo-ink-2`,
placeholder and inherited text included.

### Motion

| What | Property | Duration |
|---|---|---|
| Hover fills, borders, aside fade, preview highlight | background, box-shadow, opacity | 120 ms |
| Tab pill | transform, width | 180 ms |
| Disclosure, AI tray, confirm, check row collapse | grid rows 0fr↔1fr + opacity | 180 ms |
| Menus, selects, popovers | opacity + 4 px translateY | 160 in / 120 out |
| Sheets | 16 px translateX + opacity | 200 in / 160 out |
| Action bar | 8 px translateY + opacity | 160 in / 120 out |
| Save glyph | opacity cross-fade; spinner only after 400 ms | 200 ms |
| Jump wash | background fade-out, once | 600 ms |

Nothing else exceeds 200 ms. No bounce, pulse or loop except the spinner.
Animate only opacity, transform and grid rows; never height on text, never
layout on scroll. Reduced motion: no transforms, and the jump wash becomes a
static 1.5 s tint.

---

## 4. Navigation

- **Scopes.** "This page" (Canvas page), "Every ‹Type›" (a node type's Full
  content template), "Site". Page and template have the tabs Search · Social ·
  Schema and a Checks button; Site is one scrolling view with no tabs and no
  Checks. With no target the header reads "Site settings" (an h2, no menu).
- **Header** (44, padding 0 16, flex, gap 8): scope button (label 14/600, an
  optional language code 12/500, an optional 6 px blue unsaved-site dot, a
  12 px chevron; 28 tall, its text on the gutter), the save glyph, the tabs
  (`margin-left:auto`; items 28 tall, 13/500, inactive `--seo-ink-2`, active
  `--seo-ink` on a sliding `--seo-hover` pill), then the Checks button.
- **Short of room, the Checks button gives way first**: it drops its words to
  the dot and count ("● 2") with its accessible name unchanged and a tooltip
  that says every count; the scope name stays whole. Only if there is still no
  room is the name cut with an ellipsis. Do not cap the scope button at a fixed
  width.
- **Scope menu** (280 wide, aligned to the button's start): two-line radio
  items (13/500 label, 12 `--seo-ink-2` description, check at the right). The
  site item says "‹Site name› · every page, live when saved", or "Unsaved
  changes". Multilingual sites add a non-interactive language block. The menu
  ends with a status line (6 px dot + the idle status text): the one place
  idle states are written out. Choosing a scope closes any sheet and returns
  focus to the scope button.
- **Sheets** cover the frame (white, `position:absolute; inset:0`), with a 44
  header: Back (28 icon button), the title (h2, 14/600), optional trailing
  icon buttons. One at a time; the view behind is `inert`; Esc or Back closes
  and returns focus to the opener, else to the scope button. Switching scope
  closes it.
- **Jumps** ("Show" in Checks or the bar): close the sheet → switch scope/tab →
  open the disclosure holding the field → scroll it to the centre → focus it
  (or its label) → highlight its preview part → play the field wash
  (`--seo-selected`, inset −6, radius 8, 600 ms). The status announces "Moved
  to ‹field›"; the bar does not show for it.
- **Focus on open**: once, to the scope button, with no ring until a key is
  pressed. Never moved again without a user action.

---

## 5. Components

Every interactive element has the same three base states: hover (a
`--seo-hover` fill or a darker text step), `:focus-visible` (`--seo-ring`, or
`--seo-ring-inset` on full-width rows), and disabled (`aria-disabled`, 50 %
opacity, or the locked-field style for inputs; disabled buttons stay
focusable).

### 5.1 Buttons (one family)

| Variant | Use | Style |
|---|---|---|
| solid | the single primary in a view: Use, Save | `--seo-primary` bg, white 13/500; hover `--seo-primary-hover` |
| danger | Hide site only | `--seo-danger` bg, white |
| soft | Change, Try again, Suggest (rows), fixes, Show more | `--seo-hover` bg, `--seo-ink`; hover gray-a4 |
| outline | inside notices | white, `inset 0 0 0 1px` `--seo-control-border` |
| ghost | Reset, Edit, Copy, Refine, Remove, bar actions, caption Suggest | transparent, `--seo-ink-2` (bar: blue-11); hover `--seo-hover` |
| icon | in-field / caption 24, header / sheet 28 | ghost, square, 16 px icon (14 in captions) |

Heights 32 (bars, sheets), 28 (inline), 24 (in-field, asides). Radius 6.
Pressed: `translateY(.5px)`. Loading: a 12 px spinner replaces the icon and
the width is locked. At most one solid button per view.

### 5.2 Field

- Anatomy: **label row** (20 tall: label left, aside right) → 8 → **control**
  → 6 → optional **guidance**.
- **Label** 13/500 `--seo-ink`, `tabIndex −1` (jump target). No asterisk:
  required fields set `aria-required` and, when empty, show "Needed for
  ‹Type›".
- **Aside** (12/16 `--seo-ink-2`, flex gap 4): always in the DOM and in
  `aria-describedby`, visually `opacity:0` until the field is hovered or has
  focus within (120 ms). Holds the **source word** and **one action**:
  - source words, one family: "Set on this page", "Set for every ‹Type›",
    "Site default", "From the ‹language› version", "Same as search title",
    "Same as description", "From the ‹Image› field", "Site default image";
  - action: **Reset** (tooltip says what it returns to), **Edit** (value comes
    from the site and the editor may administer it; leads to the Site field),
    or **Use the site pattern** (empty template title);
  - after a reset: "Reset · Undo", kept visible for 6 s; focus stays in the
    field.
- **Guidance** (12/16, flex gap 6, text left, tabular count right). Priority:
  **error** > **issue** > **resolved** > **focus info**.
  - error (server refused): `--seo-danger` with icon, `role="alert"`, the
    control gets the error border; typed text is kept, focus never moves;
  - issue (persistent): the first to-fix or to-improve issue about this field
    (never good-to-know), amber or red with an icon, with its fix or Suggest
    as an inline 24 px ghost button right after the message;
  - resolved (on focus, only when no preview of it is in sight): "→ ‹value›",
    one line, ellipsis;
  - focus info, on focus only: "Fits in results" + count, "May be cut off
    after “…last words”" + count, "Empty. Search engines will pick text from
    the page.", or just "46 characters" when unmeasurable.
  - **Length is never shown at rest.** It is focus guidance, not a warning.
- **Locked / read-only**: control fill gray-a2, border gray-a4, text
  `--seo-ink-2`, still readable; asides hidden.

### 5.3 Inputs, selects, switches, segmented

- **Input box**: min-height 32, padding 6 12, radius 6, white,
  `inset 0 0 0 1px --seo-control-border` (hover `-hover`, focus `--seo-ring`).
  Text 14/20; inherited text shows as `--seo-ink-2` placeholder, with
  `aria-description` "Inherited from ‹source›" (no "(inherited)" tag).
  Multi-line grows (description min 52).
- **Trailing in-field buttons**: absolute stack top-right (`top/right: 4`),
  24 × 24, icon `--seo-icon` → `--seo-ink` on hover/focus; input padding-right
  40 for one button, 64 for two. Braces "Insert value"; sparkle "Suggest a
  title / description" (page scope, AI available, writable).
- **Select**: in a field, a box like an input (chevron at right 10); in a list
  row, a ghost trigger (value + chevron, `--seo-ink-2`, hover fill). Content:
  `--seo-shadow-pop`, radius 12, items 32 tall, optional hint second line.
- **Switch**: on blue-9; off gray-a5 with a thumb shadow (3:1).
- **Segmented**: only for short exclusive sets in Site (Represents,
  Separator). 32 tall, `--seo-hover` track, white thumb.

### 5.4 Chips (dynamic values)

Per the committed `seo-dialog` spec: a dynamic value shows as a chip with its
label and stores its name. Chips are 20 tall, radius 4, blue-11 on blue-2 with
an `inset 0 0 0 1px blue-a5` line, and keep the input's own 14/400 metrics so
the caret stays on the text. An empty-value chip is transparent with an amber
line and amber text. The caret never paints inside a chip; the chip's tooltip
("Summary: …" / "Empty for this article") shows on hover only.

The open change `link-values-to-fields` replaces chips with linked-value boxes
(§5.5). When it is archived, delete this section.

### 5.5 Linked-value box (from `link-values-to-fields` / `value-links`)

A linked value replaces the input with a box the same size as an input
(min-height 32, padding 5 12, radius 6) that names its source and shows the
previewed item's value, with an × to unlink. Looks come from the value-box
tokens: **linked here** (blue), **follows its default** (gray), **broken**
(red). Every state is also said in words ("Empty for this ‹type›", "Hidden
from visitors", "No longer exists", "No ‹type› to preview"), never by colour
alone. The link button sits right after the label; its icon shows unlinked,
linked or broken.

### 5.6 Stages (previews)

- **Surface**: `--seo-stage-bg`, `inset 0 0 0 1px gray-a3`, radius 12, padding
  12 16 16. Caption row 20 tall, 12/16 `--seo-ink-2`, 12 below; caption
  suffixes after a middle dot ("Not published yet", "Hidden from search",
  "Small card"); caption buttons 24 ghost on the right (`</>` "View output",
  ⓘ "About this preview").
- **Search result**: site logo or first letter (28 circle), site name 14/20,
  breadcrumb 12/16, title 18/24 `--seo-preview-link`, snippet 14/22
  `--seo-preview-text`, cut where a phone result cuts. Empty description:
  "Search engines will pick text from the page." in `--seo-ink-2` italic.
- **Link card**: white, radius 10, `0 0 0 1px gray-a4`, overflow hidden. Large
  (1.91:1 image) only when the image is at least 600 px wide **and** 157 px
  tall; otherwise a small card with a square thumbnail as tall as the card
  beside the text. The caption adds only "Small card"; "About this preview"
  says why ("Small card: image under 600 px wide." / "…under 157 px tall." /
  "…no image."). Text block padding 10 14 12: host 12/16 uppercase, title
  15/20 600, description 14/20 one line.
- **Linked parts**: `.seo-part` spans, radius 4; the part of the focused field
  gets `--seo-selected` plus a 2 px `--seo-selected` spread. A pointer click on
  a part focuses its field. The stage stays one `role="img"`; parts are not
  focusable.
- Hidden page: a notice, the caption suffix and the switch off. No dimming, no
  band, no "if it were shown" text.

### 5.7 Settings list, rows, disclosure

- List: white, radius 12, `inset 0 0 0 1px --seo-line`.
- Row: min-height 44, padding 0 12 0 16, flex space-between, gap 12; rows
  separated by `inset 0 1px 0 --seo-line-soft`. Label 13/500 with an optional
  12/16 second line (code names such as `noindex` in mono, only when the value
  is not the default). Trailing: a switch, a value + chevron, or a ghost
  select.
- **Disclosure row**: a whole-row `<button aria-expanded aria-controls>`; its
  trailing summary ("Defaults", "Canonical set", "Availability, image, 5
  more") is `--seo-ink-2` and in `aria-describedby`, not the name. Chevron
  rotates 180° over 180 ms; the body expands inside the same list. It starts
  open when anything inside is set or has an issue.
- **Navigation row** (Custom JSON-LD, View output): whole-row button with a
  chevron-right; opens a sheet.
- Hover: `--seo-hover-row`. Focus: `--seo-ring-inset`.

### 5.8 Image row

40 px thumb (radius 8, `inset 0 0 0 1px gray-a4`; broken: icon on gray-4),
12 gap, name 14/20 one line (middle ellipsis of file names; the media label
when there is one), meta 12/16 `--seo-ink-2` ("1770 × 996 · 249 KB"), then
soft **Change** (28) and, for logo and default image only, ghost **Remove**.
Empty: a dashed 40 px placeholder, "No image", soft "Choose image".

### 5.9 Notices

Radius 10, padding 10 12, flex gap 10: a 16 px icon, one sentence (13/18),
at most two outline buttons 8 below. **Amber** (amber-2 bg, amber-a4 line,
amber-11 icon) for conflicts and kept changes; **neutral** (gray-a2 bg, gray-a3
line, `--seo-ink-2` icon) for hidden, offers, notes and confirms. At most two,
at the top of the body, in the spec's order. Notices that block writing are
`role="alert"`; the rest are polite.

### 5.10 Save glyph and status

One polite live region holds the visually hidden status text; beside the
scope button a 16 px glyph (`aria-hidden`, with a tooltip of the same text):
spinner while saving (only after 400 ms), green check once saved (fades out),
lock when read-only, a red dot on error, nothing otherwise.

### 5.11 Action bar

Floating: `left/right/bottom: 8`, height 44 (grows when wrapped), radius 12,
white, `--seo-shadow-bar`, padding 0 6 0 14, flex gap 8. An 8 px dot (blue,
red-9, amber-9, green) or a warning icon for Hide site; the text 13/18
`--seo-ink`, up to two lines, never cut mid-sentence, `aria-hidden` (the live
region speaks it); buttons 28: ghost blue for Undo / Show / Try again, soft
for Discard, solid for Save, danger for Hide site. A button that removes
itself hands focus to the next bar button, else to the scope button. Passing
messages ("Now editing ‹name›", "Removed ‹label›") show for 4 s with no
buttons.

### 5.12 Information buttons (ⓘ)

A 24 icon button named "About ‹thing›" ("About this preview", "About checks",
"About addresses"). Its sentence shows on hover and on keyboard focus; a click
pins it, a second click hides it; Escape, a click elsewhere, scrolling or
another tooltip closes it. It opens below its button so it never covers the
header, and the sentence is also the button's accessible description. Use one
instead of a paragraph of explanation.

### 5.13 Insert / value menu

A popover anchored to the field that always opens **fully inside the
dialog**, whatever column the field is in. Filter row 40 tall, no box, labelled
"Insert into ‹label›" (on screen and to assistive technology), autofocused.
Groups (the type's fields at template scope, then Page, then Site), group
labels 12/500 `--seo-ink-2`, sentence case, each group named by its label.
Each entry shows its **value under its label**, across the menu's width, up to
two lines, with the whole value on hover; an empty value reads "Empty for this
‹type›". Rows radius 6; the active row is `--seo-selected`, not a solid
accent. A keyboard-hint row ("↑ ↓ move · ↵ insert · esc close") shows only in
tall frames; it is dropped at 420 px and under, and at 200 % zoom. After a
choice or Escape, focus is back in the field at the caret.

### 5.14 AI tray

Mounts inline under its field (or the Social caption, or the Schema type row),
8 below, growing with grid rows + opacity. White, radius 12,
`--seo-shadow-pop`, padding 6. Options: a radio group, rows padding 10 radius
8, text 14/20, tabular count on the right (amber when long), chosen row
`--seo-selected` and tried live in the stage. Footer (top hairline): ghost
Refine left; soft Try again and solid Use right. It always ends with the note
that the text was written by AI from the page's text and the facts need
checking (not on an error). Working: three 20 px skeleton lines plus a status
sentence. Error: one sentence replaces the options; offer "Try again" only
where asking again can help, otherwise only "Dismiss". Esc closes it, clears
the trial and returns focus to the opener; focus goes to the first option on
open.

### 5.15 Check row (Checks sheet)

Grid 16 px / 1fr, gap 12, padding 16 0, `--seo-line-soft` hairlines between
rows. Mark: 8 px dot (`--seo-fix-dot` / `--seo-improve-dot`) or an info icon
for good to know. Title 14/500; detail 13/18 `--seo-ink-2`; actions 10 below,
gap 8, 28 tall: the fix (soft), **Show** (ghost, named "Show ‹field›"),
**Suggest** (soft + sparkle). Groups "To fix", "To improve", "Good to know" in
that order, sentence-case 12/500 labels, 24 above, empty groups left out; the
summary heading (18/24) takes focus. After a fix the row collapses (180 ms)
and focus goes to the next row's first button, else the heading.

### 5.16 Output sheet

Intro 13/18 `--seo-ink-2`. Sections "Tags" and "Structured data", each an h3
(13/600) with a ghost Copy ("Copy tags" / "Copy structured data", then
"Copied"). Tags are a `dl` in a 104 px / 1fr grid (`dt` mono 12, `dd` 13/18,
`overflow-wrap:anywhere`). Structured data is a full-height code block (gray-2,
radius 10, mono 12/18, focusable, no nested scroll). While a save or read-back
is pending, "Updating…" shows by the heading after 400 ms and the rows are
marked not current.

---

## 6. Whole-view states

- **Loading** (after 150 ms): header with the scope button only; the body shows
  the stage skeleton with the real address and description, then two field
  skeletons (12 px label bar + 32 px box).
- **Switching target**: header stays, body skeleton, status says "Now editing
  ‹name›". Another previewed node at template scope: the view goes to its top
  with no skeleton and no announcement.
- **Forbidden / load error**: a centred block 64 from the top: icon
  (`--seo-ink-2`), heading 14/600, one sentence 13 `--seo-ink-2`, and "Try
  again" (soft) for the error. No header, no tabs.
- **No target**: the Site view, header "Site settings", a neutral notice.
- **Nothing to preview** (template with no node): values at rest, read-only,
  no previews, Output or Checks; settings read as words ("On", "Allowed",
  "None"), never as disabled controls.
- **Read-only / conflict**: notice + lock glyph + locked fields; previews keep
  working.

---

## 7. Copy rules

- Calm, short, human. Labels are nouns, buttons are verbs. Sentence case. No
  "we". No jargon in primary labels: tag names live in mono second lines and
  in Output.
- Never name a search engine, social platform or vendor (decisions.md, item 2).
  Say "search result", "link preview", "search engines".
- One word per idea, the same everywhere: **Reset**, **Undo**, **Show**,
  **Suggest**, **Use**, **Try again**, **Discard**, **Change**, **Remove**,
  **Choose image**, **View output**, **Insert value**.
- Source words come from the one family in §5.2. Don't invent a new phrasing
  for a field.
- Help text only where it decides something (a placeholder such as "One
  address per line", a type hint, a footnote). Everything else goes in an ⓘ or
  is cut. Never say the same thing twice on one screen.
- Status strings from the model (`footer()`, `strips()`, `MESSAGES`, `LABELS`)
  and check `message` / `detail` strings are specified in the specs; change
  them there first.
- Example data in docs, tests and mockups: "Example", `example.com`, made-up
  names.

---

## 8. Accessibility and keyboard

- **Structure**: a visually hidden h1 "SEO"; sheet titles h2; Site group
  titles and the Checks summary h3.
- **Tab order** (page/template): scope button → tab list (one stop; arrows,
  Home, End) → Checks button → notice buttons → caption buttons → each field
  (input, its in-field buttons, its aside buttons: focusable while faded,
  focus reveals them) → list rows → action bar.
- **Keys**: `{` opens the insert menu; Backspace/Delete removes a chip whole;
  Ctrl/Cmd+Enter saves Site (never Hide site) and commits the page description,
  Profiles and Custom JSON-LD; Enter commits single-line held fields and never
  submits, reloads or navigates; Escape closes the innermost of menu, select,
  tray, sheet, and stops there.
- **Names**: every icon-only button has an accessible name equal to its
  tooltip's first phrase; visible labels are part of accessible names. Exact
  names are the test contract: change them only with the specs and the e2e
  constants.
- **Live regions**: exactly one polite status; `role="alert"` only on field
  errors and on notices that block writing. The tray's working text is its own
  status while open.
- **Previews**: each is one `role="img"`, named with what it shows once typing
  has paused for a second; a hidden page's name starts "Not shown in search
  results."
- **Direction**: every text that shows a value takes its direction from its
  own text (`dir="auto"`), including empty inputs showing an inherited value;
  inputs for addresses, numbers, dates and code, and the dialog's own words,
  keep the dialog's direction.
- **Targets**: ≥ 24 × 24 (in-field and aside 24, header and sheet 28, rows 44).
- **Forced colours**: chips and stages and lists get a `1px solid CanvasText`
  outline/border; the focus ring becomes `outline: 2px solid Highlight`; the
  switch thumb is `CanvasText`.
- **Never colour alone**: every dot or tint has words (a count, a source word,
  a state sentence) beside it or in its name.
- Automated scan: no serious or critical violation on any tab, the Site view,
  or any sheet.

---

## 9. Small heights and zoom

The header stays put; the body is the only scroller; nothing scrolls sideways.

| Frame | Rules |
|---|---|
| ≥ 480 px tall | As designed. |
| ≤ 420 px tall (`@media (max-height: 420px)` in the frame) | Stage padding 10 14 12, caption margin 8, search title 16/22. Suggestion lists cap at 60 % of the height, scrolling the options only. The insert menu takes the frame's height from the column's left edge, as wide as the column, shows at least two entries whole plus part of the next as a cue, and drops the keyboard hints. Windows resized across 420 px close an open insert menu and return focus to its field. |
| 350 px tall | Same. The "→ resolved" guidance covers fields whose preview has scrolled away. The action bar stays 44 and floats; the body pads for it. Tab reaches the Title field with field and label whole. |
| 200 % zoom (half width; `@container seo (max-width: 360px)`) | The header wraps: scope button + glyph + Checks (dot + count) on row 1, tabs full width on row 2. Field pairs stack. List rows wrap (value under label). The action bar wraps (text, then buttons right-aligned). Image rows wrap buttons under the name. The Output `dl` stacks. A caption keeps the previewed node named and shows an addition whole or moves it into the ⓘ; long text ends in an ellipsis. URLs and code use `overflow-wrap:anywhere`. |

---

## 10. Review checklist

Run it on every change to `extension/`, in a frame 468 wide at 900, 420 and
350 px tall and at 200 % zoom, on page, template and Site scopes and every
sheet.

**Layout and tokens**
- [ ] Everything starts on the 16 px gutter; no card inside a card; the stage
      is the only tinted surface.
- [ ] Only `--seo-*` tokens; no new hex, size, radius or duration.
- [ ] Spacing follows §2's rhythm (12 / 16 / 20 / 24 / 32).
- [ ] Only the four type roles; sentence case; no text lighter than gray-11.

**Controls**
- [ ] Control heights are 32, 28 or 24; radii 4, 6, 10 or 12.
- [ ] At most one solid button in view; danger only for Hide site.
- [ ] Every interactive element has hover, `:focus-visible` ring and disabled
      states; rows use the inset ring.
- [ ] One disclosure per view; big tools are sheets with Back.

**Fields**
- [ ] At rest a healthy field shows only label and value; asides and counts
      show on hover/focus and stay in `aria-describedby`.
- [ ] Length is never a warning at rest.
- [ ] Guidance priority is error > issue > resolved > focus info; only one
      line shows.
- [ ] Inherited values are gray and say where they come from on hover/focus.

**Feedback**
- [ ] No footer; the action bar appears only with a button or a passing
      message, and never hides the field in use.
- [ ] One polite live region; alerts only for field errors and blocking
      notices.
- [ ] At most two notices, in spec order.

**Copy**
- [ ] Words from §7's vocabulary and §5.2's source family; nothing said twice.
- [ ] No vendor, engine or platform names; example data is neutral.

**Accessibility**
- [ ] Tab order as §8; Escape closes only the innermost layer.
- [ ] Icon-only buttons are named after their tooltip; ⓘ sentences are
      descriptions and open on click.
- [ ] Previews are one image each with a settled name.
- [ ] Values with their own direction render correctly (Arabic, Hebrew).
- [ ] Forced colours and reduced motion checked; nothing over 200 ms but the
      jump wash.
- [ ] Automated accessibility scan clean on every tab, Site and every sheet.

**Small frames**
- [ ] 420 / 350 px: Title reachable; menus inside the dialog; bar floats over
      padded content.
- [ ] 200 % zoom: header wraps, no sideways scroll anywhere, captions keep
      their node named.
