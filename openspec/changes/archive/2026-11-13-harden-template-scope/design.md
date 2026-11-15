# Design

## Context

See proposal.md for why. The findings come from the complex-content fixture
(`tests/src/Fixture/ComplexContent.php`, installed on the farm site) and its
scenario matrix, plus three defects noted while the specs were written. Each
was checked against the code; the list of what was kept, narrowed or refuted,
with file and line, is kept with the review's notes outside the repository.
This change touches only code that the pending changes keep. Where a pending change
deletes or rewrites the code (the chip editor, the "Field: …" select, the
token-empty check, the structured data report), the finding is a task in
that change instead.

## Goals / Non-Goals

**Goals:** no misleading text in the dialog; the head reads the field an
editor would call "first"; no save refused or value lost by an edge in the
write path; usable at 350 px tall and with right-to-left text.

**Non-Goals:** the value model (`link-values-to-fields`), the structured data
report and wording (`rethink-structured-data`), image references in the graph
(`populate-every-schema-type`), Canvas's own dialog sizing and publish logic
(upstream asks).

## Decisions

### 1. "First" means the form's order

`Resolver::tokenTypes()` sorts the bundle's configurable fields by the weight
of their component in the `default` form display; fields without a component
follow, by machine name. `tokens()` iterates that order, so `{description}`
and `{image}` and the dialog's value list all follow it. The head gains the
form display's cache tag (`config:core.entity_form_display.node.<bundle>.default`),
or, while the bundle has no form display, the list tag
`config:entity_form_display_list`: core invalidates only the list tag when a
config entity is created (found by `CoupledHeadTest`).

*Alternatives:* the view display (rejected: editors set values on the form,
and `link-values-to-fields` already keeps Canvas's form-display order for its
link menu, so both changes agree); keep field-name order and only document it
(rejected: a type with `field_hero` and `field_avatar` takes the avatar).

### 2. Formatted text drops the content of script, style and template

`Resolver::text()` removes `<script>`, `<style>` and `<template>` elements with
their content (case-insensitive, across lines) before `strip_tags()`.

Checked on the farm site: `basic_html`, `restricted_html` and Canvas's
`canvas_html_block` keep the text of a removed `<script>` element as visible
text, so the review's premise ("text no visitor sees") holds only for formats
that keep the markup, such as `full_html`, where the browser runs it and shows
nothing. Reading the `processed` value was rejected: it runs the format's
filters, which can render embedded entities for the current user into a
cached, shared head, and it still keeps the script's text under the common
formats. Dropping these three elements gives the intended text everywhere,
with one expression.

### 3. Cut rule

`Values::plain()` keeps the limit in code points and never ends inside an
extended grapheme cluster: after `mb_substr()`, a trailing partial cluster is
dropped (PCRE `\X`). `Values::texts()` (the title, the description and the
social texts only; never structured data values, URLs or the site name) also
backs up to the last space when the cut fell inside a word and that space is
within the last tenth of the limit; `trimSeparators()` already removes a
separator left at the end. `model.ts` mirrors both with `Intl.Segmenter`
(graphemes) and the same space rule; `tests/fixtures/text-cases.json` gains
rows for a ZWJ sequence, a flag, a combining mark, a word cut, a text without
spaces and a cut that leaves a separator.

Keeping the title's ending whole (shortening the entity title first) needs the
title split into parts, which `link-values-to-fields` introduces; it is a task
there.

### 4. A template with nothing to preview

Canvas's route for a Full content template without content has no preview id
(`/template/node/announcement/full`). `host.parseRoute()` returns
`{kind: 'template', id, bundle, previewId: null}` for it. `GET /state` accepts
`entity_type=content_template&id=…` without `preview`: `templateContext()`
checks view access to the template only and returns the values (the draft for
update access), `preview: null`, `resolved: null` and the vocabulary from
`tokens(NULL, 'node', bundle)`.

The dialog is read-only there. Without a preview id there is no layout URL in
`publishReview.autoSavesHash` and so no editor client entry to write under
("No token, no write", ARCHITECTURE §9). Making it writable would need a
server-side write path that bypasses the editor's entry, which this change
does not add. The Search view shows the values at rest, no stage, and the
empty-state line from the spec; Social and Schema show values at rest; Output
and Checks are not offered. When the editor previews a node, the dialog
follows the route as it does today.

The note for other templates becomes "SEO for a content type is set in its
Full content template." (the "with a page to preview" clause sent editors in a
loop).

As built: the client marks the target read-only for this reason
(`readonly: 'empty'`, chosen when the state has no `preview`), so every field
shows its value at rest as a read-only field would; the empty-state line is a
notice above the fields; the header has no Checks button, the footer offers no
Output, the Schema tab no "View output", and a field's "what it becomes" line
is not shown (there are no values to fill in). The scope menu's second line
reads "No ‹type› yet", the notice's words.

After review (round 1): with nothing to fill in (`resolved: null`), a chip is
never marked empty (the amber "empty" style would make a healthy template look
broken), and a read-only chip is a neutral gray label at full contrast (no
extra opacity). A field without a value of its own shows what it inherits:
its pattern's values as gray chips (the title's site pattern; the
description's `{description}`, the value it falls back to), else "Same as
‹source›" (the social title and description). An empty input that shows an
inherited value takes that value's direction. "Custom JSON-LD · Off" is a
static row when the target is read-only and nothing is set: its sheet would
hold an empty, disabled box only; when that sheet does open read-only, Back
takes focus so Esc works. The notice reads "No ‹type› yet. Add one to preview
and edit these settings.": one sentence for why the fields are locked and the
way out. The header's scope name takes the room the missing Checks button
leaves (and a long name gives way before the header overflows).

After review (round 2): read-only, a settings row shows its value in words
where the other rows' values are ("Show in search results · On", "Text
previews · Allowed"), not a faint switch whose state cannot be told at rest or
a chevron that opens nothing; a Type without a value reads "None" without the
hint that invites a choice. A field that cannot take focus says what it
inherits in its `aria-description` ("Inherits: Description.", "Same as the
search title."). A type label inside a sentence loses its capital only when it
is not an abbreviation ("No FAQ yet").

The `{description}` chip keeps its label "Description": it is the name of the
value in the whole vocabulary (on a Canvas page it is the page's Description
field), and its tooltip says where it comes from; renaming it belongs to the
vocabulary, not to this change.

Canvas serves the same route, without a preview id, for a type that has no
Full content template ("Template for X not found"), and briefly while it picks
a node to preview. The server answers 404 `not_found` there; `api.getState()`
then reads the state without a context, so the dialog shows Site settings with
a note instead of an error with a Try again that can never succeed: "This
content type has no Full content template yet. Add one to set its SEO." (the
note for other templates, "set in its Full content template", would point at
something that does not exist). The transient route before Canvas's redirect is left as is: the
dialog follows the redirect, and the empty state shows only while the dialog
is open during that redirect.

### 5. Unpublished preview node

The state's `preview` gains `published` (nodes: `isPublished()` of the
negotiated translation; pages: as `target.published`). The search and link
previews' captions add "· Not published yet" (the page caption's wording); the
ⓘ text starts with "This ‹type› isn't published yet. Values that only editors
can see are left out." with the type's label in lower case. When the template
is not in use either, the caption names only the node's state and the ⓘ adds
"The template is not in use yet.", so two "not" suffixes never stack.
`link-values-to-fields` (full plan) changes how such a node is read; its task
updates the second sentence.

The editor sees an unpublished node in Canvas's preview picker only with
access to it; the Playwright `complex` project gives its editors `bypass node
access` for that (and to add the first announcement).

### 6. Output while catching up

`Output.tsx` reads the save phase and whether a read-back is pending (the
same signals as the header's spinner). While either holds, the sheet heading
shows "Updating…" with the 12 px spinner the header uses for a save
(after 400 ms), and the rows get `aria-busy="true"` and gray-11 text. No separate
fetch: the next confirmed state replaces the rows. The words sit in a polite
`role="status"` region: the header's save status is behind the sheet, in the
inert view, and is not announced while the sheet is open. The region is
rendered empty with the sheet and the words are inserted by a 400 ms timer
(not revealed by CSS), because a live region's initial content and a
visibility change are not reliably announced.

### 7. One width rule for the card

`model.ts` exports `LARGE_CARD_WIDTH = 600`; the link preview and the
`image-small` check read it. Under it the detail says "Most link previews
show it as a small thumbnail." and the issue is to improve; from it to
1199 px, the issue is good to know (not counted, no warning on the field),
because it works, and its heading states it instead of asking: "The social
image could be sharper", "It works as a large card; 1200 × 630 looks
sharper.". When such an image is cropped as well, the cropping joins the same
row ("It works as a large card, cropped; 1200 × 630 fits best.") instead of a
second row with a second Show for one image. Sizes are
written by `model.ts` `dimensions()`, "1200 × 630" with non-breaking spaces, in
Checks and in the image rows alike. The head's card hint keeps its
protocol threshold (300 x 157), which belongs to one family of consumers; it
is shown only in Output, as a raw tag, so the dialog's plain words do not
contradict each other.

### 8. Direction

`dir="auto"` on the elements that show values (spec "Text keeps its own
direction"): the search preview's title, description and address, the link
preview's site, title and description, the caption's node name, values at rest
and inherited values (`TemplateInput.tsx`'s mirror and inherited span, the
value menu's values; `Field.tsx`'s resolved line, which also shows Schema
values), and the inputs for free text (`TemplateInput.tsx`'s editable element,
the value menu's filter, plain text inputs and textareas). Inputs for
addresses, numbers, dates and code (custom JSON-LD), labels and the dialog's
own words keep the document direction. `dir="auto"` uses the first strong
character, which is what the scenarios ask for. An empty input ignores its
placeholder for `dir="auto"`, so one that shows an inherited value takes that
value's direction from its first letter (`dirOf()` in `TemplateInput.tsx`).

### 9. Short windows

Canvas sets the extension iframe to `calc(100vh - 300px)` and its scroll
container to the same `max-height` (`ExtensionDialog.tsx`,
`Dialog.module.css`). Checked in the editor: the scroll container is not the
iframe's parent but its grandparent (a flex wrapper sits between), inside the
dialog panel (`[role="dialog"]`, `max-height: 85vh`, 16 px padding). The panel
opens a fifth of the window from the top (`DraggableDialogWrapper`, a
`translate()` computed when it opens) and stays there when the window
changes, so Canvas's 300 px leaves the frame about 60 px short at every window
height, and a dialog opened at 900 px then made 350 px tall keeps 92 px.

`host.fitFrame()` (in `host.ts`, the only file that touches the parent) finds
the nearest scrolling ancestor of the frame inside the panel, gives the frame,
that container and the panel their Canvas styles back, measures, and:

- when the panel sits lower than a fifth of the window (it was opened in a
  taller one), moves it up there with an inline `top` offset, which a drag
  (Canvas's `translate()`) keeps working from. The panel's place is measured
  once, at open: later measurements include the drag, and a resize must not
  undo it;
- sets the frame and the container to `min(window height - 16, panel top +
  panel max-height) - panel padding - frame top` when that is more than
  Canvas's height.

It runs on open and on the parent window's `resize`, and does nothing when the
parent is unreadable. It follows the window, not a drag of the dialog. Canvas
closes the dialog by removing the iframe, which unloads this document without
unmounting React: `fitFrame()` undoes itself on the frame's `pagehide`, and a
`resize` that finds the frame disconnected undoes it too, so no listener or
style outlives the dialog. New ARCHITECTURE §11 rows caught by `host-contract`
"dialog frame"; upstream ask 6: a viewport-aware extension dialog height and
position.

At 1440 x 350 this gives a 202 px frame (158 px of view below the 44 px
header): the panel stays below the editor's top bar, whose preview picker
sits right above the dialog. More would need the dialog over the top bar or
Canvas's own heading gone (ask 6).

The frame grows at every window height, not only short ones: the spec's tall
window scenario says so (ends inside the window and the dialog, never shorter
than Canvas makes it).

*Alternative:* only an upstream issue (rejected: the dialog is unusable at
350 px until Canvas changes, and the quality bar asks for it now).

### 9a. The link preview's ⓘ

The link preview's caption says "Not published yet" for an unpublished preview
node like the search preview's, so it gets the same ⓘ with the node's
sentences (not the search estimate). The caption and ⓘ texts come from
`model.ts` `previewNote()`, which vitest covers for the four combinations of
node and template state.

### 10. Show names

`ChecksSheet.tsx` names each Show `Show ${where}` and describes it by the
row's sentence (`aria-describedby`), so a screen reader says "Show
description, button, Fill in Status or remove it". Two Shows that lead to one
field differ in their description. Folding the sentence into the name gave
doubled words ("Show street address: Add Street address"). The visible label
stays "Show".

### 11. Carry-forward on site saves (baseline a)

The carry-forward in `ApiController::putDraft()` moves to a private helper
`carry(array $sent, array $clean, array $errors, array $current, string $scope,
string $type): array` that returns the clean values and the remaining errors.
`putDraft()` and `putSite()` call it; for the site, `$current` is the stored
`canvas_metatag.site:values` read override-free and cleaned in read mode. The
identity needs none: it is always cleaned in full on read.

### 12. A translation keeps the details of its published type (baseline b)

`putPage()` computes the inherited type twice: from the draft (as today, the
type the dialog shows and validates against) and from the stored default
translation. When they differ, the translation's current details (its draft,
else stored, cleaned against the stored type) whose keys the draft type does
not have are merged into the written `schema.props` after validation. They
are never shown, never echoed (the echo is what the dialog compares its
read-back with), never validated against the draft type, and dropped by read
mode once the default's new type is published; the next write then leaves
them out.

Checked against Canvas while writing the test: Canvas publishes and discards
an entity's translation drafts together, from the default translation's entry
(`includeSiblingTranslationAutoSaves()`, `getTranslationGroupAutoSaves()`), so
"publishing the translation alone" cannot happen today. The loss this guards
against is the type change taken back while it is a draft: without the merge,
the French draft written meanwhile has no Product details, and they are gone
when the English type returns to Product and the drafts are published. The
page-seo scenarios name that path and the discard.

*Alternative:* validate against the stored type (rejected: a translator
could not set details of a type the editor has just chosen until the default
version is published).

### 13. A new translation keeps values equal to the default's (baseline c)

Canvas publishes a translation that exists only as a draft by adding it to the
stored page and copying each field that differs from the stored **default**
translation (`ApiAutoSaveController::applyAutoSaveTranslationSnapshots()`,
`$original_target` falls back to the default). A field equal to the default's
is skipped and stays empty (core's `createTranslation()` initialises it; the
module's `translation_create` hook empties it too). A `canvas_page` presave
hook in `CanvasMetatagHooks` restores it: for each translation that
`isNewTranslation()` with an empty `canvas_metatag`, it reads that
translation's Canvas auto-save entry (still present, Canvas deletes it after
`save()`), and when the draft's value is not empty and equals the default
translation's value, sets it. Nothing else matches that condition, so the hook
cannot override a value Canvas set or a translation made elsewhere.

New ARCHITECTURE §11 row (Canvas skips fields equal to the default translation
when publishing a new translation; the auto-save entry exists during the
publish save) caught by the new `PageDraftTest` case; upstream ask 7: compare a
new translation against nothing. When Canvas fixes it, the test still passes
and the hook can be deleted.

### 14. Tests and fixture

`ComplexContent::body()` and `formatted()` use `canvas_html_block`, the format
Canvas ships, so kernel tests and the minimal-profile sandbox render the
bodies. The `complex` Playwright project is run first (task 1.2) to fix the
spec's guessed selectors against today's behaviour before this change alters
it.

## Canvas internals relied on (new)

| Internal | Where | If Canvas changes it | Caught by |
|---|---|---|---|
| The extension iframe's nearest scrolling ancestor inside `[role="dialog"]` is the dialog's scroll container; Canvas sizes both to `calc(100vh - 300px)` | `host.fitFrame()` | the frame keeps Canvas's height (no worse than today) | `host-contract.spec.ts` "dialog frame" |
| The dialog panel opens a fifth of the window from the top, by a `translate()`, with `top` free | `host.fitFrame()` | a dialog opened in a taller window stays where it opened | `host-contract.spec.ts` "dialog frame" (panel top at 420 px) |
| Closing the dialog removes the iframe without unmounting the extension's React tree | `host.fitFrame()` (`pagehide`) | none: the undo also runs from React's cleanup | `host.test.ts` "is undone when the frame goes away" |
| Publishing a draft-only translation skips fields equal to the default translation; its auto-save entry exists during the save | `CanvasMetatagHooks` presave | the hook stops matching; values equal to the default are lost again | `PageDraftTest::testPublishingNewTranslationEqualToDefault` |

## Risks / Trade-offs

- The form order changes `{image}`/`{description}` on sites whose form order
  differs from field-name order. That is the fix; the change is visible in
  the dialog's preview before anything is published, and the head cache is
  invalidated by the new tag. Release note in README.
- `fitFrame()` writes two styles into Canvas's DOM. It runs only when the
  window is shorter than Canvas's layout assumes, and every read is guarded.
- The presave hook adds one key-value read per new translation save; existing
  translations pay nothing.

## Migration Plan

None: no stored shape changes. A cache rebuild is not needed; the new tag is
added on the next render.

## Open Questions

None. Whether the template should become editable without a node depends on
a Canvas write path for templates without a preview entity; it is noted in
README "Known limitations".
