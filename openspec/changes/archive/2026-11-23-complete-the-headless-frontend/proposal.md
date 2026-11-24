# Proposal

## Why

A developer built a real frontend on a Canvas site with this module, using
the Canvas SDK's adapter for a React framework's metadata API
(`@drupal-canvas/headless-next`, "the adapter" below) and a JSON-LD library.
They sent seven findings. Item 1 is outside this module, and is already fixed
in the library: jsonld-stitch (formerly ldgraph) rejected the SDK's
JSON-LD type, and its `graph` prop now takes any JSON-LD document typed as
plain JSON. This change answers items 2 to 7.

Each finding was traced to its cause in the module, in Canvas 1.x and its
SDK packages (`@drupal-canvas/headless` 0.11, the adapter 0.8), in the
framework's metadata resolution, and in the live dialog on the farm site:

| | Feedback, short | Cause | Outcome of this change |
|---|---|---|---|
| 2 | The adapter does not fill in the whole head; every site adds JSON-LD itself | `toNextMetadata()` drops `og:image:*` and `article:*`, and never reads `head.script`. The framework can render all of them, so the loss is in the adapter | **Mitigated**: one complete, tested recipe in the README, from a helper file in `examples/headless-next/`. **Upstream draft** for the adapter |
| 3 | "Page › Description" reads "Empty for this post"; the post's real description is "Post › Summary" | The Description fact reads only a formatted text with a summary, so Post's Summary field is never used. In the menu, that fact looks like a field of the page | **Fixed**: the Description fact takes a text field named for a description, so this developer's posts get their Summary with no linking. The link menu tells fields from worked-out values |
| 4 | The search preview says "Search engines will pick text from the page"; on the frontend every post got the site description | An empty description sends no row. The framework then keeps the layout's description, and copies it into the share card too | **Fixed**: item 3 removes most empty descriptions; the recipe blocks the leak; the dialog says what is true. **Upstream draft** for the adapter |
| 5 | The public address comes from the editor's preview frontend; production's first frontend is `http://localhost:3000` | The public base is the first frontend, which is configuration and travels by config import | **Covered** by `serve-each-frontend-its-own-addresses`, which lands last. Until then, this change leaves out page addresses on a non-public host in production and adds a status report error |
| 6 | "Review changes" lists "Post content items — Full content view", with nothing pointing at SEO | Canvas names a change by the entity's label. It offers modules no way to add details | **Mitigated**: a template's draft status names that entry. **Upstream draft** for Canvas |
| 7 | The dialog's options and buttons lack roles and test IDs | Roles and names are there, inside a frame titled "SEO". One real gap: link menu groups are hidden from assistive technology | **Fixed**: groups are named; the README says how to script the dialog. No test IDs |

Two suggestions were dropped after research:

- **"Warn when the public address differs from the request host."** On a
  headless site Drupal's host always differs from the public address. The
  meaningful inverse, a public address on one of Drupal's hosts, is already a
  warning in `serve-each-frontend-its-own-addresses`.
- **Sending an empty description tag.** It would block the framework's
  inheritance, but it puts `<meta name="description" content="">` in every
  other frontend and in coupled pages, and the head-output spec leaves empty
  rows out. The fix belongs in the adapter, and in the recipe until then.

## What Changes

- **Item 2. A complete recipe for the adapter, kept true by a test.**
  - The README's script-only snippet becomes one recipe for the framework's
    app router: `toNextMetadata()`, then a small helper, then a component
    that renders `head.script` with the SDK's serializer.
  - The helper adds what the adapter drops (`og:image` details, `article:*`
    times, `og:locale:alternate`). It also treats the CMS head as the page's
    whole head: an empty description and no `alternates` when the head has
    none, so that the layout's are not inherited.
  - The helper is one file, `examples/headless-next/canvas-head.tsx`, with
    the exact package versions it is tested with. The README quotes it, and
    a test fails when they differ.
  - A Playwright test runs the helper on the module's real content API head
    and asserts that every meta row, link and script survives. A second
    check runs the adapter alone, from the Canvas codebase under test, and
    fails on the first Canvas release whose adapter keeps those rows.
  - The README does not require a JSON-LD library. The module sends one
    complete `@graph`, with the site's organization and website, so a layout
    must not add its own.
- **Item 3. A summary is the default description, and the link menu tells
  fields from worked-out values.**
  - A node's Description fact gains one step. After a non-empty summary of
    its first formatted text with a summary, it takes the first plain or
    formatted text field named for a description: Summary, Description,
    Excerpt, Teaser, Intro, Lead or Abstract, by label or machine name. Only
    then does it cut the formatted text.
  - The words live in one data file that the resolver and the link menu
    both read, so the default and the menu's order always agree.
  - In the link menu, built by `link-values-to-fields`, the facts group is
    called "Automatic", not "Page". An entry or a Default box whose value
    reads a field says which ("from Summary").
  - A fact that no item of the type can have is disabled, with the reason
    "No post has one".
  - A field's menu does not offer its own default when the pick links the
    whole value. The field's Default box and "Reset" already return to it.
    In a composer (`compose-values-from-fields`), adding or replacing a field
    offers it, and "Add words or fields · Start from ‹Title›" adopts it as
    the first chip.
  - A chip of a worked-out value is named by its label alone ("Title"), and
    says "from ‹via›" in its tooltip and the composer's description.
  - With an empty filter, the type's fields named for the value come first.
    This and "No ‹type› has one" hold in every mode of the menu: link, add
    and replace.
- **Item 4. The dialog tells the truth about an empty description on a
  headless site.** The search preview, the link preview, the focused field
  and the "Add a description" check all say "No description sent. The
  frontend decides what to show." On a coupled site, every sentence stays as
  it is.
- **Item 5. Page addresses on a non-public host are left out in
  production, and the status report says so.**
  - When the public base comes from the setting or a frontend and is on a
    non-public host, and Drupal's own host is not a development host, the
    head carries no canonical, `og:url`, hreflang or JSON-LD script. Plain
    http on a public host is reported, never left out.
  - The status report row "SEO public addresses" is an error for a public
    base from the setting or a frontend that is plain http or on a
    non-public host. On a development host it is a warning, and nothing when
    the public base is a development host too.
  - A public base from the request that is plain http is a warning naming
    Drupal's reverse proxy settings.
- **Item 6. A template's draft names its "Review changes" entry.** Its
  status reads "Draft · listed under Unpublished changes as “Article
  content items — Full content view”", the label Canvas shows in the panel
  its "Review changes" button opens.
- **Item 7. Named groups, and a note on scripting the dialog.**
  - Link menu groups become `role="group"`, named by their heading. This is
    already required by `link-values-to-fields`' scenario "A group whose
    label has a space", but not built.
  - Tests query the groups by role, not by `.seo-menu-group`.
  - A README section, "Scripting the dialog", says the dialog is in a frame
    titled "SEO", and that roles and names are the supported hooks.
  - No test IDs. Testing Library ranks them last, and they would be a second
    contract that can drift from what users get.
- **Upstream drafts** (in `upstream/`, not posted):
  - `canvas-sdk-next-head.md`: map the whole head in `toNextMetadata()`,
    treat an absent description and canonical as none, and export a JSON-LD
    component.
  - `canvas-review-change-details.md`: let modules add a short detail to a
    pending change, so that "Review changes" can say "SEO: Description".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dynamic-values`: a node's Description fact takes a text field named for
  a description.
- `headless-head`: the documented recipe keeps the whole head; page
  addresses on a non-public host are left out in production; the status
  report flags a public base no visitor can use.
- `seo-dialog`: the previews and the description field speak for the
  frontend on a headless site; a template's draft names its "Review
  changes" entry.
- `seo-checks`: "Add a description" says what is true on a headless site.
- `value-links`: the "Automatic" group, sources, unavailable facts, no
  default in its own menu when a pick links the whole value, and fields named
  for the value first; worked-out values read the same in a composer.

## Already covered by queued changes

- **Item 4, fewer empty descriptions:** `strengthen-zero-config-defaults`
  derives one from a node's first formatted or long text and from a page's
  own text, after this change's named field.
- **Item 5:** `serve-each-frontend-its-own-addresses` gives each frontend its
  own public address, separate from where the editor previews. It errors on
  `http://localhost:3000` in production, and shows administrators a check.
  The scenario "A development frontend in production" is this developer's
  case.
- **Item 7:** `test-in-every-engine-and-language` adds one accessibility tree
  snapshot per view, which pins roles and names. `make-the-module-agent-ready`
  gives agents commands, so they need not script the dialog at all.

## Amendments to other changes

Applied in the same commit as this plan, so no change reaches the build
without them.

- **`strengthen-zero-config-defaults`**: its MODIFIED dynamic-values "A
  page's and a node's own description and image" keeps this change's named
  field step before its first formatted or long text fallback.
- **`serve-each-frontend-its-own-addresses`**:
  1. Its headless-head delta REMOVEs this change's "The status report flags
     a public base no visitor can use" and "Page addresses on a host no
     visitor reaches are left out". Its status rows reuse the same
     `Values::isPublicHost()` and `Values::isDevelopmentHost()`, and keep
     the row title "SEO public addresses".
  2. Its plain http error names the fix: the frontend's public address for
     this environment. It keeps this change's warning for a request-derived
     plain http base on a site without frontends.
  3. "An address that can't be known is left out" and D12 take over the
     non-public-host omission, per frontend.
  4. Its README task names the frontend in the recipe's `fetchPage()`
     request URI, and its two-frontend Playwright work runs this change's
     recipe test once with a named frontend.
  5. This change's headless wording follows the frontend being previewed.
- **`test-in-every-engine-and-language`**, task 4.3: add one accessibility
  tree snapshot of an open template link menu, with its groups, taken once
  in link mode and once in add mode (`compose-values-from-fields`).

## Dependencies and place in the queue

Land **right after `compose-values-from-fields`** (decisions.md item 17,
which supersedes item 16's "Runs first after the JSON-LD form pause"). The
link menu, its defaults and its rows are built on the composer from the
start, not reworked later.

- Item 3 is built on the link menu that `link-values-to-fields` adds and
  the add and replace modes that `compose-values-from-fields` gives it
  (amendment recorded there, 2026-11-17). The
  MODIFIED blocks for dynamic-values "A page's and a node's own description
  and image" and seo-dialog "The search result preview" are written on its
  text, and the `value-links` capability it creates must exist.
- Of the queued changes after it, only `strengthen-zero-config-defaults`
  modifies a requirement this change modifies, and it is amended above.
- Landing early matters for items 4 and 5. Until
  `serve-each-frontend-its-own-addresses` lands, last in the queue, a
  production site with a development frontend ships localhost canonicals
  and has no signal at all.

It ships in four phases, each releasable:

1. The recipe, the contract test and the upstream drafts (README, example
   and tests only).
2. The non-public-host omission and the status report row.
3. The named-field default, the dialog's headless words and the draft status.
4. The link menu, named groups and the scripting note.

## Out of scope and non-goals

- No README non-goal is reopened.
- No npm package from this module. The helper is a documented example; the
  real fix is in the adapter.
- No empty description row (see "Why").
- No list of what a draft changes. `add-structured-data-diff-and-overview`'s
  "When you publish" is where a diff belongs, and the upstream draft lets
  Canvas show it.
- No test IDs, and no change to Canvas's "Review changes" from the module's
  frame. The dialog's frame never reaches into Canvas's UI.
- Choosing which JSON-LD library a frontend uses. The README names none.

## Decisions taken

The product owner's decisions, taken by the lead on the recommended option
of each (decisions.md, item 16). This change relies on all five.

1. **The facts group's name.** Decided: "Automatic". (Not taken: "Built
   in"; or keep "Page" and rely on the value lines.)
2. **The early status report row.** Decided: ship it here, because
   production has no signal until the last change in the queue lands. (Not
   taken: wait for `serve-each-frontend-its-own-addresses`.)
3. **Leaving out page addresses on a non-public host now.** Decided: yes,
   narrowly: only a non-public host, only a base from the setting or a
   frontend, only while Drupal's host is production-like; plain http on a
   public host is only reported. A missing canonical is safe; a localhost
   canonical breaks every share card. (Not taken: keep them until
   `serve-each-frontend-its-own-addresses` and rely on the status report
   error.)
4. **Naming a JSON-LD library in the README.** Decided: no; the module's
   graph is complete. (Not taken: name one as an option for frontends that
   add nodes of their own.)
5. **How the recipe is proved.** Decided: the contract test on the
   module's real head, plus a manual check with a running frontend. (Not
   taken: also build a fixture frontend in CI. It adds a framework build to
   every pipeline, and on the farm it competes for memory with the site.)

## Size

S to M: about 3 agent days.

| Item | Size |
|---|---|
| 2: recipe, example, contract test | M, 1 day |
| 3: named-field default, link menu | S to M, 1 day |
| 4: headless words | S, a quarter day |
| 5: omission and status report row | S, half a day |
| 6: draft status | S, a quarter day |
| 7: groups, note | S, a quarter day |
| Upstream drafts | written with this change |

## Built on merge onto compose-values-from-fields

This change was built on the link menu of `link-values-to-fields`, while
`compose-values-from-fields` was built in parallel. Everything that applies
to link mode is built and tested here. What needs the composer (add and
replace modes, chips, the composer's description) is finished when the two
are merged. The helpers are shaped for it: `entriesFor()` in `values.ts`
applies "No ‹type› has one" and marks the fields named for the value in every
mode, `tree()` orders them first for any menu with an empty filter, and only
`withoutDefault()` is link mode's own step, which add and replace modes leave
out.

Left for the merge, by scenario (superseded: every item below was built on
the merge, as "Built when merged onto `compose-values-from-fields`" says
further down; kept as the plan it was):

- value-links "Worked-out values are told apart from fields":
  - "The field's own default when adding to a composition": "Add a field to
    Description" and "Replace ‹Source›" list Description under "Automatic"
    with "from Summary" (call `entriesFor()` without `withoutDefault()`), and
    picking it puts a chip named "Description".
  - "Starting from the field's own default": the row "Add words or fields ·
    Start from ‹label›" on a Default box and in an empty composer, which
    adopts the default as the first chip.
- value-links "Worked-out values read the same in a composer":
  - "A chip that reads a field": the chip reads "Description", its tooltip
    and the composer's description say "from Summary" (`Entry.from`, and
    `boxSaid()`'s wording). Menu rows in add and replace modes get "from
    ‹via›" beside their label from the same `toItem()` (`MenuItem.hint`);
    the "Default" mark of the field the default reads is link mode's only.
  - "Adding on a type without the value" and "Named fields first when
    adding": the add-mode menu shows what `entriesFor()` and `tree()` already
    give; one `values.test.ts` case per scenario in add mode.
- Task 4.3: the axe scan of the open menu in add mode, and the accessibility
  tree snapshot of `test-in-every-engine-and-language` task 4.3 in add mode.
- Task 5.2 "Default and link menu": "Add words or fields" says "Start from
  Description" and gives a Description chip whose tooltip says "from
  Summary"; "Add a field to Description" then lists Description; the groups
  are named in add mode.

The Default box's words moved into `values.ts` (`boxTag()` for its tag,
"from ‹via›" and "No ‹type› has one"; `boxSaid()` for its description), so
that vitest covers them; `Value.tsx`'s `useLink()` calls them. The composer
rewrites this box: whoever merges keeps these helpers as the one source of
the box's words, or moves their cases into the composer and deletes them,
never leaving two sources.

Built when merged onto `compose-values-from-fields`:

- `withoutDefault()` applies to "Link ‹Field›" only; "Add a field to …" and
  "Replace ‹Source›" offer the default with "from ‹via›" beside it, and the
  "Default" mark stays link mode's. `entriesFor()` keeps "No ‹type› has
  one" and the named fields first in every mode (`values.test.ts`, "worked-out
  values in a composer"; `compose.spec.ts`, "a worked-out value in a
  composer", with the axe scan of the open add menu).
- A fact chip says "· from ‹via›" in its tooltip (`chipTitle()`) and the
  composer's description says "‹Label› comes from ‹via›."
  (`compositionSaid()`).
- "Add words or fields" is offered in an empty composer that still follows
  its default too. Its detail keeps compose's rule (`startWords()`): "Start
  from ‹default›", but "Keep the default and add to it" where the default is
  named like its field, so "Every Post"'s description says the latter; the
  value-links scenario says so.
- `boxTag()` and `boxSaid()` stay the one source of the Default box's words:
  the composer never draws that box, it has its own words.
- A field told apart from a fact by its machine name ("Description (body)")
  is still the field the default reads (`readsVia()`). It carries the
  machine name only where a menu lists both, and on its chip: the Default
  box says "from Description", and the description's own menu, which lists
  no Description fact, names the field "Description" (task 8.4).
- Task 4.3's accessibility tree snapshot in add mode stays with
  `test-in-every-engine-and-language`, which owns the snapshots.

Also deferred, not composer work:

- The front page's variant of "Add a description" does not exist until
  `add-home-page-defaults` lands, so the seo-checks delta no longer names it;
  that change uses `NO_DESCRIPTION_SENT` for it and states its headless
  wording.
- A link menu opened in a window 350 px high, or at 200 % zoom, can run past
  the visible part of Canvas's dialog: the frame is taller than the dialog's
  scroll area, and the menu fits itself to the frame. It predates this
  change. Fitting it to what is visible needs the host to tell the frame its
  visible area; scrolling the editor's page from the frame is ruled out
  (`reveal()` in `ui.tsx`). ARCHITECTURE lists it as a known limitation,
  linked to `UPSTREAM(canvas)` ask 6, and `test-in-every-engine-and-language`
  task 4.5 tracks it with the menu's two other defects (tasks.md, "Not done
  here").
- Task 4.4's pointer to the commands of `make-the-module-agent-ready`: that
  change adds it to "Scripting the dialog" when its commands exist.

Adapted while building:

- The extension's tests run without a DOM, and the previews, the field and
  the value box read the whole app context, so the "vitest render cases" of
  tasks 3.3 and 4.1 test the functions those components take their words
  from (`emptyDescription()`, `boxSaid()`); `headless.spec.ts` and
  `template-complex.spec.ts` check the rendered words in the real dialog.
- A page's focused empty description shows its "Add a description" check
  in the field, as it does on a coupled site, so the field's own sentence
  speaks only where no check does: at template scope, on a type none of
  whose items has a description (there an empty description is a quiet
  check, in Checks only). The seo-dialog scenario "The focused field" says
  so. `headless.spec.ts` finds the sentence in the page's check, and on the
  focused field of a template previewing the headless seed's node 4, "A
  note without a summary" (`CanvasMetatagTestSetup`); `emptyDescription()`
  in vitest covers both wordings.
- The headless test seed describes articles as articles, so that the
  content API head of the article carries the `article:*` rows that the
  contract test checks.
- The example pins the framework at 16.4.6, not 16.3: 16.3's last release
  has a critical advisory. The adapter's `head.ts` is the same in the Canvas
  1.13.0 release (adapter 0.10.0) and on the farm (0.8.0); the Canvas release
  tarball carries `packages/headless-next/src/head.ts`, so the adapter-alone
  test runs on the Canvas build of the `playwright` job.
- The status report names the setting as "canvas_metatag_public_base in
  settings.php", in place of the PHP expression of design D5, so that the
  translatable sentence carries no code.
- Task 5.2's rendered check of "none at all for a head without one" (the
  canonical) could not be made on the farm site: its host is a development
  host, so every head keeps its addresses. headless-frontend.spec "absent
  means none" and the HeadlessHeadTest and CoupledHeadTest cases cover it.
- A fact no item of the type can have is listed last in its group, disabled,
  not in the fold (review): at the top its reason is seen at once, and on a
  type without an image the image menu no longer opens on a single fold
  row. The fold keeps its "fields that aren't ‹kind›" label. The Default box
  and the template's Checks say "No ‹type› has one" and "No ‹type› has a
  description" there, not "Empty for this ‹type›".
- The resolver sets `via` from the type's form with no item too, so that a
  template of a type without content still links Description and Image and
  says where they come from. A summary is named as the menu names it,
  "Body › Summary".
- Which fields are named for a value is sent with the field rows (`named`,
  from `Values::isNamedFor()`), so one function decides the default and the
  menu's order; the extension no longer imports the words file.
- A fact that reads a field keeps its value and "· from ‹via›" where a field
  above gives the same text, in place of a note about what it is.
- "from ‹via›" sits beside an entry's label (`MenuItem.hint`), not at the
  end of its value: a description of 160 characters, cut at 150, lost it
  (review). Its accessible name carries it after the label.
- While a value follows its default, the field that default reads is
  ordered with the fields named for the value, and its row is marked
  current and says "Default" (review): at 350 px the menu covers the
  Default box. The social image passes its default too, so its menu no
  longer offers the Image it follows, and its Default box, source and
  fallback words name the field the Image reads, also on a type with no
  item yet.
- An image entry shows its alternative text, else its media name, whether
  it comes from a field or from the Image value (review).
- Fields are named for a value by their label as stored, never as
  translated for the interface (`Sources::namedFor()`), so the head of each
  language and every editor's menu agree (review).
- A head without addresses sets `unaddressed` on the dialog's report, and
  Checks lists "Page addresses are left out" in an editor's words, naming
  no setting (task 7.3); the seo-checks delta says so. A `canvas_metatag_public_base` that is not an absolute address
  gets its own status report wording, naming its value.
- Every spelling of a loopback address a browser reads is a development
  host (`127.1`, `0177.0.0.1`, `0x7f000001`, `[0:0:0:0:0:0:0:1]`,
  `[::ffff:127.0.0.1]`), as are `0.0.0.0` and `::`, where development
  servers listen; and `.example`, `home.arpa`, 100.64.0.0/10, a name ending
  in a number and a known local development suffix (its names resolve to
  127.0.0.1) are not public. The headless-head delta lists them (review).
- Canvas refuses a frontend in any spelling but a hostname or a dotted quad
  (its form and its config schema), so pages then use the request's address;
  the other spellings reach the module only through
  `canvas_metatag_public_base`, whose check now accepts an IPv6 literal with
  an IPv4 tail. The headless-head scenarios say so (review).
- A template's `canvas_label` is the label Canvas stored with its auto-save
  entry, in the language of whoever wrote the draft, not the template's
  label in the current interface language (review).
- The Schema tab says "No structured data is sent: page addresses are left
  out.", with a way to Checks, where its summary and search features would
  be (`unsentSchema()`), and Checks drops "No search feature for ‹kind›"
  then. Both previews show no address while the head carries none
  (`shownAddresses()`, tasks 6.8 and 7.1); seo-checks "Pages without an
  address say why" says so.
- The scope menu shows the target's status beside an Undo in the bar, so a
  template's draft names its entry as soon as it is stored. The bar's Undo
  keeps no time limit (seo-dialog "An Undo waits for the editor").
- The template's draft status reads "Draft · listed under Unpublished
  changes as “…”" (the heading of the panel "Review changes" opens), with a
  non-breaking space before the label's dash, and the scope menu's status
  dot stays on its first line when the status wraps.
- The dialog's API calls keep the editor's language prefix (task 7.6), but
  Canvas redirects a language-prefixed editor route to the route without
  it, so the prefix is empty in the real editor and the dialog follows the
  user's preferred language only. `UPSTREAM(canvas)` ask 10 and the known
  limitations say so; 7.6 is not user-visible until Canvas keeps the prefix.
- Where a menu lists both, a field labelled like a fact keeps its machine
  name ("Description (body)"), as compose-values-from-fields specified for
  chips; plain words such as "Description field" would leave two fields of
  one label, which only machine names tell apart, with another rule.
- A Reset of the title keeps removing both parts, as seo-dialog "Resetting
  a title" requires: an earlier build of this change kept an ending set on
  its own, which no requirement of this change asks for. Whether it should
  is a question for its own change.
