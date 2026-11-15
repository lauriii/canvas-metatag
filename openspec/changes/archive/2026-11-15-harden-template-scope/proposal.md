# Proposal

## Why

A second review of template scope on the complex content fixture (seven
content types, long and right-to-left text, hidden references, short windows)
found places where the dialog hides what it offers, says something the head
does not do, or makes a simple task fiddly: a value menu that shows no values
in a short window, keys lost right after picking a value, a link preview that
draws a small card while the head asks for a large one, a view left scrolled
to its bottom after the preview changes, an information button a mouse or a
finger cannot open. The product owner asked for high quality and a clean
experience while the module gains power. This change fixes what stands on
today's code and records the rest in the changes that replace that code.

The three defects noted while the specs were written (site saves refused by a
stored value, a translation losing the details of its published type, a new
translation equal to the default) were fixed by the first change of this name
(archived 2026-11-13) and are not part of this one.

## What Changes

- **Value menus in short windows:** in a frame up to 420 px tall a value menu
  uses the frame's height from the column's left edge, leaves out its
  keyboard hints, shows at least two values whole and fades at its end while
  more are below, never over the active entry. Its filter names the field it
  fills ("Insert into ‹label›") at every height; a double-click on the insert
  button inserts nothing; a frame resized across 420 px closes it at once.
- **No key lost after picking a value:** the field has focus and its caret
  the moment a value is inserted.
- **Value menus to assistive technology:** a group is named by its label also
  when the label has a space; an entry's name carries its label and at most
  the first 150 characters of its value.
- **One large-card rule:** the head's card hint and the dialog's link preview
  use the same rule, an image at least 600 px wide and 157 px tall, so what
  the dialog draws is what the head asks for.
- **A preview switch is calm:** when the editor previews another node, the
  view goes to its top and otherwise stays (`refreshing`, no loading
  placeholder), and no "Now editing" message appears, because the scope did
  not change. The editor's brief "draft not stored yet" state after a load is
  held back for up to 2 s; a change typed meanwhile is saved once the draft
  is stored, however late (until then the footer says "This change could not
  be stored in the draft"), and a change left in the session is restored or
  offered once the target can be written. A language mismatch is not held.
  Opening a page from Site settings never shows "Site settings" while it
  loads.
- **Information buttons open on click and tap**, as well as on hover and
  focus; a second click closes them however long after the first.
- **Checks at template scope** name the previewed node once, on one line
  ("Checked against …"), and say "this ‹type›" inside their sentences. A value
  empty for the previewed node is a fact, good to know and not counted
  ("Performers is empty for this event"). "Show in search" is judged by the
  server's output only once it has the change. One file-size unit in Checks
  and the image field; formats named as people know them ("BMP"). The link
  preview's caption says "Small card", its information says why, and a
  caption's addition shows whole or not at all.
- **The scope button** shows a long type name whole while the header has
  room; the Checks button gives way first ("● 2"), with a tooltip only where
  its visible text does not say every count.
- **Headings, list items, definitions and table rows end a sentence** when
  formatted text becomes plain text, as does the text before a list or a
  heading: "Made to last. Solid oak, …" instead of "Made to last Solid oak,
  …". A clause or sentence mark of any script (full-width and Arabic forms
  included) spares the full stop.
- **Text cut inside a character** (half an emoji pasted) becomes the
  replacement character as it is typed, in the dialog's own fields and in a
  Canvas page's Description, so neither a draft save nor Canvas's layout
  save is refused as unreadable.
- **Tests and fixture:** the `complex` Playwright project runs (the value menu
  test written in the last round was never run), the headless head is checked
  for a hidden referenced node, and the fixture's preview content no longer
  dates a node's last change before its creation.

## Decisions relied on

From the lead's decisions on the product owner's behalf (2026-11-13,
binding):

- **1. link-values-to-fields, full plan.** The chip editor, the "Field: …"
  select, the social image's "From each ‹Type›" row and the brace menu are
  replaced by that change's linked boxes and link menu. Findings in that code
  are tasks there (see Out of scope), except the value menu's height, focus
  and names, which this change fixes because the link menu takes over the
  menu's code and its rules (seo-dialog "Value menus stay inside the
  dialog").
- **2. No search engine or platform names in UI copy.** The large-card rule
  is described as "most link previews", never by a platform.
- **8. Phase order as written.** This change hardens shipped behavior and
  lands before `link-values-to-fields`.

**Open: the large-card rule needs the lead's explicit confirmation before the
gate commits or archives this change.** The lead's recorded decisions have no
entry for it. `strengthen-zero-config-defaults`, which the lead planned under
decision 12, already builds on it (its head-output and seo-dialog deltas state
600 × 157 and list this change's rule as a dependency), which suggests it was
accepted, but that is not a recorded decision; the gate should cite that
adoption as the confirmation only if the lead agrees, and then record the
decision here, under "Decisions relied on", and with the lead's decisions. It
changes published output: a page whose effective image is 300 to 599 px wide
goes from `summary_large_image` to `summary`. Primary sources, named
neutrally: the card protocol's own documentation lets a large card start at
300 × 157 (2:1, up to 4096 × 4096); the sharing documentation of the most
widely used Open Graph consumer draws a full-width image only from 600 × 315
and a small thumbnail beside the link below that. So the head's old rule is
what the protocol allows, and the dialog's rule is what most link previews
draw; no single rule is right for both. This change takes the link previews'
width (600) with the protocol's height (157), so that one page looks alike
wherever it is shared and the dialog draws what the head asks for. The other
direction, the dialog drawing a large card from 300 px, was rejected because
most link previews would still show those images small, so the dialog would
promise a card they do not draw. Should the lead prefer the protocol minimum,
`Resolver::LARGE_CARD` and `model.ts` `LARGE_CARD` change together with
`ResolverTest::testHead`, `model.test.ts` "largeCardNeeds()" and the job
posting's small card in `template-complex.spec.ts`.

## Out of scope

Recorded as tasks in the pending change that replaces the code involved:

- `link-values-to-fields` (§9): the social image's row says "From each
  Product's Gallery field" while the site default is used, and Social and
  Schema describe the same link differently (9.13); the time-sensitive
  expectations that `ComplexTemplateTest` pins for a text list's label and a
  street address behind a reference (9.14); the link menu keeps this
  change's short-frame, focus and naming rules (9.3, 9.11); the rebased
  `dynamic-values` text keeps the sentence ending of headings (9.7). Already
  recorded there and confirmed again: an enum detail linked to a field shows
  an empty select (9.1, 9.10); dates read as words in the menu and as ISO in
  text (9.2); machine names such as "Description (field.body)" and chips
  broken inside a word (9.4); the street address that can't be linked yet
  (9.12).
- `rethink-structured-data` (§9): a value that resolves but fails its kind is
  shown as missing (9.1, plus the sentence under its field, 9.3); mixed
  heading forms and the to-fix color of inline hints (9.3); the Price |
  Currency pair at the dialog's width (9.4).
- `populate-every-schema-type` (§10): only a field's first item is used, and
  the dialog does not say so (10.2); main-node images repeat the page image
  inline (10.1, already recorded); the rebased `dynamic-values` text keeps
  the sentence ending of headings (10.3).
- `add-home-page-defaults` (6.6): the rebased "Checks describe the page or
  template being edited" keeps this change's template-scope wording.

Not changed: the fixture's Arabic and Hebrew nodes stay `en`, because the
fixture runs on single-language sites ("language (no translations)").

No README non-goal is reopened.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `seo-dialog`: value menus in short frames, by keyboard and to assistive
  technology; the link preview's large-card rule and caption; a preview switch
  keeps the view at its top without a message, holds back the editor's brief
  draft state, and restores a change left behind; the scope button's room;
  information buttons open on click.
- `head-output`: the card hint uses the link preview's rule.
- `seo-checks`: template-scope wording names the previewed node once.
- `dynamic-values`: headings and list items end a sentence in plain text.

## Impact

- **Server:** `Resolver` (card hint, `text()`).
- **Client:** `TemplateInput.tsx` (anchor, focus, group ids, entry names),
  `model.ts` (`smallCard()` and `largeCardNeeds()` replace `LARGE_CARD_WIDTH`;
  `wellFormed()`, `robotsUnsent()`), `SearchTab.tsx` (the Description's
  change path), `Previews.tsx`,
  `checks.ts`, `ChecksSheet.tsx`, `App.tsx` (scroll and message on a preview
  switch, the `refreshing` phase with `model.ts` and `types.ts`), `ui.tsx`
  (`InfoTip`), `Header.tsx` (the short Checks form), `MediaPicker.tsx` (one
  file size formatter), `styles.css`; rebuilt `extension/dist`.
- **Fixture:** `tests/src/Fixture/ComplexContent.php` (`preview()` only).
- **Tests:** `ResolverTest`, `ComplexTemplateTest`, `model.test.ts`,
  `checks.test.ts`, Playwright `template-complex`, `page`, `access` and
  `site`.
- **Docs:** ARCHITECTURE.md §5 (plain text), §8 (the card hint row) and §17
  (tests).
