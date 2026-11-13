# Proposal

## Why

A review of template scope with complex content (seven content types,
references, empty and hidden fields, right-to-left text, very long titles,
a type with no content yet) and a check of three defects found while writing
the specs showed places where the dialog misleads, the head reads the wrong
field, or a save refuses or loses a value. The product owner asked for high
quality and a clean experience. This change fixes what stands on today's code
and records the rest in the changes that replace that code.

## What Changes

- **A type with no content yet:** the dialog opens "Every ‹Type›" on that
  type's Full content template, shows its values read-only (what each field
  inherits included, no value flagged as empty) and says "No ‹type› yet. Add
  one to preview and edit these settings." The state route answers a template
  without a preview node. The note for other templates stops sending editors
  back to where they are; a type without a Full template gets that note
  instead of an error.
- **An unpublished preview node** is named as such in the captions ("Not
  published yet"), with a line that values only editors can see are left
  out.
- **Field order is the form's order:** `{description}`, `{image}` and the
  template's value list follow the order of the type's form, not field names.
- **Formatted text drops what never displays:** the content of script,
  style and template elements is removed before tags are.
- **Cuts never break a character:** a text cut to its limit never splits an
  emoji sequence or a letter from its marks, and a head text ends at a word
  when one is near the limit, without a dangling separator.
- **Social image advice agrees with the link preview:** one width rule
  (600 px) for the preview and Checks; a 600 to 1199 px image "works as a
  large card; 1200 × 630 looks sharper", good to know rather than something
  to improve.
- **Output says when it is catching up:** "Updating…" while a save or its
  read-back is pending, announced to assistive technology.
- **Text keeps its own direction:** previews, values at rest and inputs for
  free text take their direction from their text (`dir="auto"`); an empty
  input takes the direction of the value it inherits.
- **Short windows:** the dialog's frame grows to the height the editor's
  window allows, and a dialog opened in a taller window moves up to where
  Canvas opens it in the current one, so the first field and its label are in
  view at 350 and 420 px tall. Nothing of it outlives the dialog.
- **Show buttons told apart** in Checks: each is named for its field and
  described by its issue.
- **Site saves carry a stored value forward** when it is sent back unchanged
  but no longer passes, as draft writes already do.
- **A translation keeps the details of its published type** while the
  default version's type change is only a draft, so that taking the change
  back loses none of them.
- **A never-published translation keeps SEO values equal to the default
  version's** when it is published (a Canvas publish behaviour, worked
  around and reported upstream).
- **Tests:** the complex fixture uses a text format Canvas ships, and the
  `complex` Playwright project is run and fixed.

## Product decisions relied on

From the lead's decisions on the product owner's behalf (2026-11-13):

- **2. No search engine or platform names in UI copy.** The link preview and
  Checks wording stay neutral ("Most link previews…").
- **8. Phase order as written.** This change is not part of the structured
  data phases. It hardens shipped behaviour and is meant to land before
  `link-values-to-fields`, which rebases its `dynamic-values`, `seo-dialog`
  and `seo-checks` blocks onto this text.

## Out of scope

Recorded in the pending change that replaces the code involved:

- `link-values-to-fields`: an enum detail bound to a field shows an empty
  select; dates in text read as machine dates; keys typed right after
  inserting a value are lost; chip labels with machine names, unsorted
  entries and chips that wrap mid-word; template-scope wording of empty
  values; keeping the title's ending when a title is too long; the editor's
  access for unpublished preview nodes.
- `rethink-structured-data`: a required value that resolves but fails its
  pattern ("Currency" gives "Euro (€)") is reported as missing; the duplicate
  and ambiguous "Event is missing: Ends." line.
- `populate-every-schema-type`: main-node images repeat the page image
  inline instead of pointing at `{url}#primaryimage`.
- `add-home-page-defaults`: a recommendation to set one public address when
  addresses come from the request.

Canvas only, no module change: a slow "Please wait" after discarding a
draft, a warning logged on every anonymous render of an event whose venue is
unpublished, and the preview button overflowing with a 250-character title.

No README non-goal is reopened.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dynamic-values`: field order follows the form; formatted text drops the
  content of non-displayed elements.
- `head-output`: cut rule for head texts; the form's order invalidates heads.
- `seo-dialog`: a template with nothing to preview; the unpublished preview
  node caption; Output's pending state; text direction; short windows.
- `seo-checks`: social image wording; distinct Show names.
- `site-seo`: unchanged stored values are carried forward on save.
- `page-seo`: translation details of the published type are kept; a
  never-published translation publishes values equal to the default's.
- `template-seo`: values without a node to preview.
- `seo-access`: the state of a template without a preview node.

## Impact

- **Server:** `Resolver` (`tokenTypes()`, `tokens()`, `text()`, cache tag of
  the form display), `Values` (`plain()`, `texts()`), `ApiController`
  (`state()`, `templateContext()`, `putSite()`, `putPage()`, a shared
  carry-forward), `CanvasMetatagHooks` (a `canvas_page` presave for new
  translations).
- **Client:** `host.ts` (route without a preview id, frame height and
  position), `api.ts` (a type without a Full template), `App.tsx`,
  `Previews.tsx`, `Output.tsx`, `ChecksSheet.tsx`, `checks.ts`, `model.ts`
  (cut rule mirror, one card width constant, sizes), `Field.tsx`,
  `TemplateInput.tsx` and the preview components (`dir="auto"`, values at
  rest without a node), `SearchTab.tsx`, `SchemaTab.tsx`, `SettingsList.tsx`,
  `MediaPicker.tsx`; rebuilt `extension/dist`.
- **Canvas internals:** new rows in ARCHITECTURE.md §11 (the dialog frame's
  scroll container; publishing a new translation compares it against the
  default one; translation drafts publish and discard together) and two
  upstream asks.
- **Tests:** `ResolverTest`, `ValuesTest`, `ApiTest`, `PageDraftTest`,
  `ComplexTemplateTest`, `ComplexContentTest`, `text-cases.json`,
  `CoupledHeadTest`, `model.test.ts`, `checks.test.ts`, `host.test.ts`,
  `api.test.ts`, Playwright `host-contract`, `access`, `page` and
  `template-complex`; the `complex` sandbox lets its editors see unpublished
  content (`CanvasMetatagTestSetup`).
- **Docs:** ARCHITECTURE.md §5, §6, §9, §11, §13, §14, §17, §18; README.
