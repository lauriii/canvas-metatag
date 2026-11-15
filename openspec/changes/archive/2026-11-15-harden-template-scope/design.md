# Design

## Context

See proposal.md for why. The findings come from a second review of the
complex content fixture (`tests/src/Fixture/ComplexContent.php`) on the farm
site, with screenshots. Each was checked against the code; what was kept,
narrowed or refuted, with file and line, is kept with the review's notes
outside the repository. This change touches code that the pending changes
keep, plus the value menu, whose code and rules the link menu of
`link-values-to-fields` takes over.

## Goals / Non-Goals

**Goals:** a value menu usable at 350 px tall, by keyboard and with a screen
reader; the link preview and the head agree; nothing moves or speaks when only
the previewed node changes; every information button opens for every pointer;
Checks at template scope read short.

**Non-Goals:** the value model and its boxes (`link-values-to-fields`), the
structured data report, verdicts and their wording (`rethink-structured-data`),
lists from multi-value fields (`populate-every-schema-type`).

## Decisions

### 1. A value menu in a short frame uses the frame's height

Root cause: `TemplateInput.openMenu()` picks the side with more room, the
popover has `avoidCollisions={false}`, and its height is
`min(60vh, var(--radix-popover-content-available-height))` (styles.css, the
`max-height: 420px` block). In a 203 px frame (a 350 px window) a field in
the middle of the view has about 85 px on its larger side: the 40 px filter
and the 32 px hint row leave 13 px of list. At 420 px the list is 41 px.

In a frame up to 420 px tall (`window.innerHeight <= 420` in the frame, the
same breakpoint as the CSS) the menu is anchored to a virtual rectangle at
the frame's top edge (8 px in, at the column's left edge: the view's left
plus its padding, read on opening, not a copy of the gutter) instead of
the field box, aligned to its start, opens downwards, is
`calc(100vh - 16px)` tall at most and is as wide as the column (its content
box, read on opening). Hanging over the sticky header, a 340 px menu left the
end of the header row showing beside it (a clipped "…ma" of "Schema", the
red Checks dot); as wide as the column it covers the row whole, and its
values get more room per line (at Canvas's width the fixture's values fit
one line, so the next entry shows 22 px into the fade at 350 px and 30 px at
420 px). The menu then covers every field's buttons, the insert button
included, so pointer selection needs intent: an entry goes active on
`mousemove`, not `mouseenter`, so a menu that opens under a still pointer
keeps its first entry for Enter; a click with `detail > 1` inserts nothing,
so the second click of a double-click on the insert button lands on the
menu and does nothing; a press on an entry keeps focus in the filter. The list fades at its end
(`[data-more]`, a mask) while more entries are below than it shows, and the
list's `scroll-padding-bottom` is the fade's 24 px, so the entry the arrows
make active is never under it: at 350 px
it holds exactly two, and without the hint row nothing else said it scrolls. The hint
row is not rendered there (`display: none` in the short-frame block); the
filter takes the keys as before. The field is covered while the menu is
open: the filter shows what is typed, and Escape or a choice returns focus and
caret to the field (decision 2); a field whose caret was never placed gets
it at its end on Escape, where a chosen value would have gone, so the next
key does not land before the first value. Radix's `Popover.Anchor` passes `virtualRef`
to its Popper anchor; if the Themes wrapper does not, a zero-height anchor
element with `position: fixed; top: 8px` in the short-frame block does the
same (checked in a view and in a sheet, whose entrance uses a transform that
would make `fixed` relative to the sheet).

Since the menu covers the field in a short frame, it names it, at every
height so that one control has one wording: its filter's placeholder and
accessible name read "Insert into ‹label›" (one wording on screen and to
assistive technology), and the menu's accessible name is "Insert a value into
‹label›" (the label read from the field's `<label>`). The side is chosen once, on opening: a frame resized across the
420 px line while the menu is open closes it at once, with no exit animation,
and returns focus to the field, rather than leave it where it no longer fits.
At 200 % zoom (a frame up to 360 px wide) the hint row is left out too; the menu is portaled out of the
`seo` container, so this is a media query on the frame's width.

*Alternatives:* scroll the field to an edge of the view and open on the other
side (rejected: a three-line description at 350 px leaves about 110 px, fewer
than two entries with two-line values); keep the 60 % cap (rejected: 60 % of
203 px holds one entry); one-line values in short frames (rejected: breaks
"each value under its label on up to two lines" for no gain once the menu
has the frame).

The spec's "menus … capped to 60 % of the height" in "The dialog fits small
heights and zoom" becomes "suggestion lists"; value menus get their rule in
"Value menus stay inside the dialog".

### 2. The field has focus when a value is inserted

Root cause: `insert()` closes the menu, and focus returns to the field only in
`onCloseAutoFocus`, when Radix unmounts the content after its exit animation.
Keys typed meanwhile go to the filter, which is being removed. `insert()` now
calls `input.current?.focus()` before `setMenu(null)`; the caret the change
sets is placed by the existing layout effect, which runs only while the field
has focus. `onCloseAutoFocus` keeps its job for a click outside, and only
refocuses the field when focus is lost or still in the menu: a Tab or a click
on another control within the exit animation keeps its own target. Escape
had the same gap (keys typed during the exit animation reached the filter):
found while checking this in the browser, the content's `onEscapeKeyDown`
now focuses the field too.

A value chosen from the insert button goes in at the caret only when the
caret was put there: by a pointer, a key in the field, or anywhere but the
start. Focus by Tab leaves the caret at the start, where a value is rarely
meant, so a keyboard user's value goes at the end. Focus coming back from
the menu keeps whatever the field knew.

### 3. Group names and entry names

A group's id is `${menuId}-g-${index}`, not its label: `aria-labelledby` is a
list of ids, so "Job posting" pointed at two ids that do not exist. An
entry's value is rendered as at most its first 150 grapheme clusters plus
"…" (cut with the `graphemes` segmenter `model.ts` already has), so its
accessible name is the label and that much of the value; the `title` keeps the
whole value for hover. Two clamped lines at 340 px show about 110 characters,
so nothing visible changes.

### 4. One large-card rule

`Resolver` emits `summary_large_image` when the effective image is at least
600 px wide and 157 px tall (one constant pair), else `summary`. `model.ts`
replaces `LARGE_CARD_WIDTH` with `largeCard(width, height)`, read by the link
preview and the social image check. The width is the dialog's existing rule;
the height keeps the card protocol's own minimum, below which a consumer may
refuse a large card. A 400 × 400 logo now gives `summary` and a small card in
both places. The numbers live once on each side (`Resolver::LARGE_CARD`,
`model.ts` `LARGE_CARD`); the reason for a small card ("Small card: image
under 600 px wide", "… under 157 px tall", "… no image") is built from them
by `smallCard()`, and the least size Checks ask for ("at least 600 px wide")
by `largeCardNeeds()`, from the same private `shortOf()`. The caption says
only "· Small card", short enough for 200 % zoom; the reason is the first sentence of the preview's "About this preview"
tip, which the Social view now shows whenever the card is small (and, as
before, when the previewed node is not published).

Since images 300 to 599 px wide now make a small card, that card must look
right: a 96 px square thumbnail beside the text, the card as tall as the
thumbnail (the text column's padding is 8 px, so host, two title lines and
the description fit in 96 px). The large card's whole-pixel height rule
(`round(100cqw / 1.91, 1px)`) applied to the thumbnail too and drew it
212 px tall; the compact rule now sets its height. Checks follow the same
card: a thumbnail is square, so it has no cropping row, and its size row
names the least size that makes a large card and the best one ("…small
thumbnail; an image at least 600 px wide makes a large card, and 1200 × 630
is best."), so the tip and Checks name one threshold. At 200 % zoom (a
frame up to 360 px) the thumbnail is 64 px at the card's top, so that the
title keeps most of the width (96 px left it about 90 px).

### 5. A preview switch

`App.tsx` scrolls the view to its top when the target changes (`keyOf(ctx)`),
not only on a tab or scope change. The "Now editing ‹label›" message is
dispatched only when the target's identity, its `auto_save_key` (entity type,
id and language), differs from the previous one, so a template keeps quiet
when only its preview node changes, and two pages with one title are still
told apart; the caption already names the node.

The status region must not speak, nor the view warn or move. A preview switch
passes through the loading phase (no status) and, until Canvas has stored the
new node's draft, the `store` read-only state, before it settles where it was.
`SaveStatus` keeps the last settled footer while the target loads (a ref
written in a layout effect while the phase is `ready`, read only in the
other phases). The `store`
state that came with a load is held back for the whole view, in `App`: for up
to 2 s the context's state reads as writable, so there is no "can't save"
strip, no locked field, no "Read-only" status and the content does not drop
by the strip's height. A change typed meanwhile stays pending and is sent
once the draft is stored (the save timer runs again when `readonly` or the
hold changes). `flush()`, the one write when the dialog or the target goes,
sends only in the `ready` phase with a writable target: a change typed while
a preview refreshes or during the hold, with the dialog closed before the
answer or the hold ends, is not written to Canvas's draft then. It stays in
session storage and is restored or offered on the next open (below). The
path past the 2 s hold is the same code at either scope and is tested at page
scope (`access.spec.ts`); the template test types while Canvas stores the
draft quickly. Stored only after the hold, the change is not dropped: the
footer says "This change could not be stored in the draft" (with Try again),
and when `readonly` turns `no` the change is pending again and goes out. The
Description, Canvas's own field, is handed to Canvas during the hold too: it
needs no token. A language mismatch between the editor's token and the
server is known at load and is not held. After 2 s a store that is really missing shows and is said;
each load has its own 2 s (keyed on its context), so a long `store` state
followed by another switch never lets the next load speak. A `store` state
reached later, on a save, shows at once, and a "Now editing" message is never
held back. The message is decided by `nowEditing()` in `model.ts`, the hold
by `freshStore()` and `holdsStore()` there (no ref written during render). A
change left in session storage is restored or offered only while the target
is writable; a load that came in the `store` state looks at it again once
`readonly` turns `no` (once per load, and not when something was typed
meanwhile, which replaced it), so a change left behind while a draft was
missing is not lost on the way back.

The view itself stays while the node loads: a switch within the same template
(same template id, both with a preview node) is the phase `refreshing`, which
keeps the view, its values, its sheet and the Checks button, with the last
server answer, until the new answer replaces it (stale while revalidating;
the template's values are the same by definition). A change typed meanwhile is
kept by `loaded` and sent. Only another target shows the loading placeholder.
The bar's "stay at the end" rule applies only to a view scrolled away from its
top: a view at its top when "Now editing" brings the bar stays at its top,
and the control in use is revealed with its message (its `.seo-field`).

*Trade-off:* the view goes to its top on every preview switch, so someone
comparing a detail at the bottom of Schema across several nodes scrolls down
again each time. Keeping the position when the field under the viewport still
exists was considered; the top is predictable, and the caption that names the
new node is the first thing seen.

### 6. Information buttons

`InfoTip` keeps Radix's Tooltip and controls its `open`: hover and focus open
it as today; a click or tap on a tip that is not pinned pins it, also one
already shown by hover or focus, which stays; a click on a pinned tip unpins
and closes it at once, even under the pointer (keeping it open on hover after
the unpinning would make the second click look like it did nothing, as the
click also focuses the button). Radix's
own close on pointer down is ignored from pointer down to click, so a tip
shown by hover does not blink; and a pointer down on the button, which is
outside the tip's layer, does not count as a click elsewhere (it would unpin
the tip just before the click pins it again). Escape, a pointer down elsewhere, a scroll of an ancestor
and another tooltip opening (Radix's `tooltip.open` event) unpin and close it;
a pinned tip would otherwise follow its button under the header, or stand
beside a hover tip. It renders `IconBtn` with `tip=""`, so the two buttons cannot drift.
Radix announces its own delayed hover opening with that event too, through a
setter that still holds the closed state of the moment the pointer arrived:
after a click has pinned the tip, the hover delay running out would read as
another tooltip, unpin the tip, and the next click would pin it again. So an
announcement counts only when this tip's own `onOpenChange(true)` did not
follow it in the same task. A tap takes the click's path: on touch, `pointerleave` comes before `click`,
which clears `pressing` but still toggles the pin; the Playwright projects
click with a mouse, and the tap is covered by that shared path, not by a
touch test of its own. Every ⓘ tip opens below its button (`side="bottom"`,
flipped only where there is no room), so a pinned tip is never drawn over
the sticky header and its tabs, and every caption tip opens the same way.
Any scroll of an ancestor unpins, also one a resize or a focus causes: a
rule that tells a user's scroll from a layout's (or watches the button
leave the view) was not taken for one unreproduced report.
`aria-description` stays, so the sentence is also read with the button. One
component serves every ⓘ button (About this preview, About checks, About
addresses, and those of the Site and Schema views).

### 7. Checks name the node once

At template scope `checks.ts` uses "this ‹type›" (`inSentence(label)`) where
it used the previewed node's label inside sentences, and in the one message
that said "this page" ("Show this article in search"). A value empty for the
previewed node is a fact there ("Performers is empty for this event"), not a
task the template cannot do ("Fill in Performers"); so is a recommended
structured data property linked only to fields the node has no value in
(`schema-empty:‹key›`, "Ends is empty for this event"), which leaves the
counted "Event is missing: …" row, and is listed once when the texts already
name the same value. A required property stays a fix: without it the
type's details are left out. The heading rule at template scope says where
the heading is set ("in the template's layout") and that SEO settings cannot
set it. The noindex rule believes the server's robots tag only while the
robots settings are sent (`robotsUnsent()`), as the view's own `hiddenBy`
does, so a fix just made never reads as "set outside SEO", and typing in
another field does not make the issue come and go. The header's short
Checks form ("● 1") shows the number its long form gives (fixes, else
improvements) and a tooltip says every count, only where the visible text
does not already (the short form, or fixes and improvements both); the
tooltip stays mounted and is turned off (`open={false}`) rather than left
out, so the button is never remounted and the Checks sheet returns focus to
it. In a narrow frame the previews' captions let their
suffixes give way first (`flex-shrink: 1000` against the name's 1): a suffix
shows whole or not at all (`Stage` measures it before paint and leaves out the
last cut one until none is cut), so only the node's name can end in an
ellipsis, and one line never carries two. It measures when the caption's
text or width changes, not on every keystroke. What a left-out suffix said
is said elsewhere too: the "About this preview" tip carries the preview's
state (a page not published, a template not in use, a draft node) and
"hidden from search engines", which the view's strip also says; Site's
identity gap ("· Add a logo") is also an item of Checks. A suffix left out
at Canvas's width (the unpublished node's "Not published yet" beside a
242 px name) is not wrapped onto a line of its own: the caption stays one
line and the tip says it. An image's weight is written by one
formatter (`fileSize()`, 1 MB = 1024 × 1024 bytes, as the 5 MB rule counts) in
Checks and in the image field, and its format by the name people know ("BMP"
for `image/x-ms-bmp`). The sheet's "Checked
against ‹node›" line is one line with an ellipsis and the whole name in its
`title`, laid out in the name's own direction (`dir="auto"`); at 200 % zoom
it takes up to two lines, since a `title` is out of reach by keyboard or
touch. The node's name stays where it is the subject (the line itself and
the previews' captions).

### 8. The scope button's room

`.seo-scope` loses its fixed `max-width: 148px`; it already shrinks
(`flex: 0 1 auto; min-width: 0`) with an ellipsis, so it gives way only when
the header has no more room. The 200 % zoom layout (header on two rows) is
unchanged.

Measured while implementing: at Canvas's dialog width the frame is 468 px,
and on `job_developer` the tabs and "2 to improve" leave the name 100 px of
the 121 px it needs, so "Every Job posting" is still shortened there; the cap
was never what cut it (the button is 130 px, under 148). Tightening the
header's spacing to win 21 px would fit by about a pixel and break with
other fonts or counts, and hiding the status glyph's reserved slot would make
the header jump on every save.

So the Checks text gives way first, as SPEC §2.2 already does below 452 px:
the header measures, before paint, whether the scope's name is cut with the
long Checks text, and if so sets `data-tight`, which shows the dot and count
("● 2"). It measures again when its width changes (a `ResizeObserver`) and
when the target, the loading state or the issues change. A container query on
the header's content box (436 px at 468) was rejected: it would drop the
words on every target at Canvas's width, also where the name fits.

### 9. Headings and list items end a sentence

`Resolver::text()` marks the end of each `h1`–`h6`, `li`, `dd`, `tr` and
`caption` element, and the start of each `ul`, `ol`, `dl` and `h1`–`h6`, with
a control character before tags are removed. The start of a list or a heading
ends the text before it ("Buy now. Specs." for `<p>Buy now</p><h2>Specs</h2>`;
a mark beside another collapses into one): an item that holds a nested list ("Features" over "Dimmable") reads
"Features. Dimmable.", and a paragraph that introduces a list without a colon
gets a full stop too. A term (`dt`) is not ended, its definition is: "Term
Its meaning." reads as one sentence, where a stop between the two did not. A
table row is one sentence ("Height 45 cm. Weight 1.2 kg."). After decoding, a
mark that starts the text, or follows a sentence or clause mark (`. ! ? … : ;
,` and their forms in other scripts: CJK, also full- and half-width, Arabic
and Devanagari, `。！？、，．：；｡؟۔।॥،؛`, the same list as the client's cut words
in `checks.ts`, with any closing quotes and brackets after it), is removed; any other becomes a full stop, so "Price (USD)" gets one.
Then whitespace collapses as today. A list's start is matched only as a tag
(`<ul` or `<h2` followed by a space, `/` or `>`), so a custom element such as
`<ul-thing>` is not one. An empty heading, list or list item still ends the
text before it ("Foo." for `<p>Foo</p><h2></h2>`): harmless, and rarer than
the code it would take. Should a markup pattern fail, the text is
kept; the marks never are (a failed mark pass turns them into spaces), and
text that is not valid UTF-8 gives an empty string, as before. Paragraphs keep the
space they get today, so the spec's "One Two & three" example stands. A full
stop after a heading in a script that uses another stop (CJK) reads as Latin
punctuation; that is still better than a run-on sentence, and such headings
are rare in a description.

### 10. Tests and fixture

- The `complex` Playwright project is run once in this change's first group,
  on today's code, to learn which of the value menu test's assertions fail
  for a product reason (the short-frame menu, decision 1) and which for the
  test's; the test stays strict where the product is at fault.
- `ComplexTemplateTest::testHeadlessHiddenReferences`, a method of its own so
  that changing the live Event template cannot disturb the preview-token
  assertions of `testHeadless`: publishing the hidden venue changes the
  content API's head at once.
- `ComplexContent::preview()` sets a non-showcase node's changed time to its
  created time plus one day, still before the showcase nodes (now). The nodes
  only `preview()` adds get the fixture's creation date too; one made by an
  earlier run, created today, is capped one second before now, so it never
  overtakes the showcase.

### 11. Text cut inside a character

A paste cut in the middle of an emoji leaves half of it, a lone UTF-16
surrogate. `JSON.stringify` writes it as an escape that the server's JSON
decoder refuses, so the whole draft PUT came back 400 and "Try again" could
never succeed. The reducer's `edit` turns a lone surrogate into U+FFFD as it
is typed (`wellFormed()`): the field shows what will be saved, and the save
goes through. A Canvas page's Description is Canvas's own field and never
passes the reducer: the same `wellFormed()` runs in its change path, before
the text is held or handed to Canvas, whose layout save otherwise failed
with a 500 that only a reload cleared.
Reporting it per field from the server was rejected: the request is refused
before any field is read.

### 12. From Site settings to a page

When the route moves from no target (Canvas's start screen) to a page or
template, the loading phase keeps the last answer, whose target is none, so
the header still said "Site settings" for as long as the page took. While
loading towards a target from none, the scope reads "This page" or "Template",
as the first load's header does, and the status says nothing.

## Risks / Trade-offs

- The short-frame menu covers the field while it is open → the filter shows
  the typed text, and the choice or Escape returns to the field with its
  caret. At 350 px there is no layout that shows both the field and two
  entries.
- Images 300 to 599 px wide lose the large card in consumers of the card hint
  → they are shown small, as the dialog already shows them; Checks already
  advise a larger image.
- A full stop added after headings changes descriptions taken from formatted
  text without a summary → expectations in `ComplexTemplateTest` and
  `ResolverTest` change with it; no stored value changes.

## Hand-overs

- `link-values-to-fields`: `LinkMenu` inherits decisions 1–3 (its tasks 9.3
  and 9.11); its `dynamic-values` rebase keeps decision 9 (9.7).
- `populate-every-schema-type`: its `dynamic-values` block keeps decision 9
  (10.3).
- `add-home-page-defaults`: its "Checks describe the page or template being
  edited" keeps decision 7's scenarios (6.6, marked as blocking that
  change's gate: this change archives first).
- Not done here, recorded for a later pass: the full stop added after text
  before a heading is always ASCII, also after CJK text ("见出し。 本文.");
  an ideographic full stop there would read better.
