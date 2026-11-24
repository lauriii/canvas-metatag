# Reference: the prototype

`prototype.html` in this folder is the visual bar for this change. The build MUST match it: the
words, the shapes, the places, the hover and focus looks, and the menu's groups. Where the
prototype and a spec disagree, the spec wins, and both are fixed in the same commit
(design-system.md's rule).

The prototype is one self-contained HTML file with no scripts and no outside requests. Open it in
any browser. Frames are 468 px wide, the dialog's width in Canvas, except the 320 px frame. Colors
are the theme's light slate and blue scales, reached through the `--seo-*` roles of
design-system.md §3. Type is the four sizes of §3 Type. Nothing in it is a new token, size, radius
or duration.

"Before" frames redraw today's dialog from the audit of site-4 on 2026-11-24 (46 states, signals
counted at rest and with hover). "After" frames are this change. The signal count in each section
header is the audit's way of counting: every mark at rest that says where a value comes from, or is
a way in to change it. A box is not counted.

The forced-colors frames are a simulation (a high-contrast black theme drawn by hand). The build
checks the real thing in Playwright with `forcedColors: 'active'` (task 7.6).

## Frames

### 1 · The two fields the product owner showed

| Section | Frames | What they show |
|---|---|---|
| **23 Author** (template Article, Schema) | 3 before, 10 after | Before: the select reading "admin (the page's author)", its three options, and the link icon's second menu that offers "This site" again. After: rest ("Article's author" in blue with the link glyph, over "admin", no box); hover on the control; hover on the value (a fill, because a person is picked, not typed); keyboard focus with the screen-reader sentence; the source menu open ("Follows each Article", "Follows the site", "Set for every Article", the unfit footer, the default marked); after "This site" (gray, still no box, the bar's sentence); after "Someone else" (empty Name and Website boxes indented under Author, focus in Name, the control flipped to "Every Article", "Type a name." in the bar); Delete on the control going back; a Canvas page ("This site" for Organizer, "Page's author"); a Recipe whose default is Not set ("Left out until you pick one"). |
| **21 Updated** (template Article, Schema) | 3 before, 9 after | Before: rest, hover ("From the page"), the tooltip ("Follows the default"). After: rest ("Article's last update" in blue over the date); hover on the value; hover on the control; focus; the menu open (the two facts and the date field "Revised on"); after "Type a date" (an empty date box, the control unchanged, no bar); after entering a date (control "Every Article", bar); after picking a field; a Canvas page ("Page's last update", "Page's publish date"). |

### 2 · The vocabulary

| Section | What it shows |
|---|---|
| **V** | Every kind of source in the words and look its control uses: the nine a template has (no other language) and the nine a page has (no broken link). Blue with the glyph for the item, gray for SEO settings, red for broken. |

### 3 · A long Schema tab

| Section | What it shows |
|---|---|
| **O** | Every Event's Schema tab with eleven details in view, today and after, at rest. The calm test: one column of short words at the right, blue where a value is filled from each event, one row per detail that is not set. |

### 4 · Every state

| Section | What it shows |
|---|---|
| **K1** Kept here, typed (page title) | "This page" over a box; the Ending row under it says "Site ending" over its value; the menu's way back is a row named by where it goes. |
| **K2** Kept here, composed | "Every Article" over a composer; the chip named like a source; focus shows the result line. |
| **F1** Follows a fact, text, page | Social title: rest; hover (the input's edge fades in, text cursor); after a click (native input with the text, nothing stored); after the first change (control flips to "This page", bar). |
| **F2** Follows a fact, text, template | Search title: rest; its source menu ("Add words or fields" under the filter, then the groups, "Type a title" last, the unfit footer); after a click (a composer whose first chip is "Event's title"); after typing (control flips to "Every Event"). The Ending row is typed for every Event, so it has a box. |
| **L1** Linked to a field | A linked description; a pair with one linked and one kept here; a linked image (no Change, no ×); the image's menu with "Choose image…" first and active; an image that follows the type's Image field by default, drawn the same as a link to it; a linked duration with its unit choice. |
| **A1** Another value | Social description and Summary both say "Search description", in gray. |
| **W1** The site, settings rows | Robots rows: the source on each row's second line, a switch or the option as a read-out at the end; the summary only while closed ("1 set for every Event"); the row's menu with the options and "Edit in Site". |
| **W2** Another language | Page About (Suomi): the social image, two robots rows and the kind follow "English version". |
| **C1** Choices | Kind of article: "Default" over "Article"; its menu lists the options. Status kept for every Event: a read-out, not a second select; its menu (a list field, the options, Not set). |
| **C2** What this page is | The same control, chevron right, opening the kinds sheet; Suggest stays. |
| **N1** Not set | Typeable details keep an empty box (units stay); not-typeable details are one row; the whole row's hover fill. |
| **G1** Groups | "2 fields ›", "Mixed sources ›", "1 broken ›", "Not set ›", and the mixed venue's sheet with Clear in its header. |
| **E1** Title ending | The Ending row: follows the site ("Site ending"); kept for every Event (a box); linked (blue); its menu with one footer. |
| **S1** The source gives nothing | Empty for this item; hidden from visitors; broken in its three reasons; a broken link's menu; an issue under a read-out. |
| **S2** Fallback, nothing to preview | A page image whose default field is empty: the control keeps "Page data › Image", the value line says the site image is used. A template with no node: read-only, sources in words with no chevrons, the Ending's locked box, a setting in words. |
| **P1** A page's description | One source only: no control, a box, and focus guidance "Also changes Page data's description." |
| **R1** Read only | Locked: sources stay in words without chevrons, a value kept here keeps a gray locked box. Set outside SEO: lock glyph and "Outside SEO" at rest, with guidance that names the place. |
| **Y1** Site settings | No control where a field has one source (Currency keeps its select, "Not set" in ink); the title ending follows "Site name"; its menu under "Set for the site". |

### 5 · The keyboard path

| Section | What it shows |
|---|---|
| **K** | Template Event. Tab reaches the control (one stop for a read-out, two for a box); Enter opens the menu with focus in the filter, which narrows the rows to what matches; Enter picks and focus returns to the control with the bar's sentence; Delete on the control goes back to the default; Tab from a kept-here control goes to its box. |

### 6 · Forced colors

| Section | What it shows |
|---|---|
| **FC** | Template Event. Today, where the box, its tag and the label run together; after, with real 1 px edges on boxes and none on read-outs, a bordered control on every field, a dashed border for the site, the link glyph for the item's sources and the broken glyph for broken. Values stay in the text color. |

### 7 · Narrow

| Section | What it shows |
|---|---|
| **Z** | Template Recipe at 320 px (200 % zoom): every control under its label, gray ones with a faint fill, pairs stacked, rows keep the source on their second line. A pair column on template Event at 468 px: the rule runs on the field's own width, so "Event's publish date" moves under its label there too. |

## How it was made

The prototype is generated from a build script and a stylesheet that live in the design pass's
scratch folder, not in this change. Edit the HTML directly if it needs to change; it is the
reference, not a build input. It was checked for balanced markup and for names it must not hold.
Task 7.7 compares site-4 against it frame by frame.

The critic pass on 2026-11-24 changed it: facts turned blue with the link glyph; menu headings
became "Follows …" and "Set for …"; the title ending became its own row; settings rows lost their
second select; the translation frame moved to the three settings that really follow another
language; group, broken, issue, duration and Site ending frames were added; and K, FC and Z were
redrawn so that each frame stays on one content type.

## Renders

`renders/` holds PNGs of the prototype in Chrome at 2x, 1500 px wide (three frames per row). Each
section has its own PNG, rendered from that section alone: `01-author.png`, `02-updated.png`,
`03-vocabulary.png`, `04-long-schema-tab.png`, then `05-kept-typed.png` to `25-narrow.png` for K1
to Z. Each one holds the section's before and after frames together. `render-full.png` stacks the
page's introduction and every section in page order. Render again after any change to the HTML.

Seen and left alone, because they are design or content, not rendering:

- Asides in before frames run 6 px past the box edge. That matches today's dialog.
- An open menu covers the end of the read-out beside it. That matches how the menu opens.
