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
  frontend decides what shows." On a coupled site, every sentence stays as
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
  status reads "Draft · in Review changes as “Article content items — Full
  content view”", the label Canvas shows.
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

## Open decisions (recommended option first)

1. **The facts group's name.** Recommended: "Automatic". Alternatives:
   "Built in"; or keep "Page" and rely on the value lines.
2. **The early status report row.** Recommended: ship it here, because
   production has no signal until the last change in the queue lands.
   Alternative: wait for `serve-each-frontend-its-own-addresses`.
3. **Leaving out page addresses on a non-public host now.** Recommended:
   yes, narrowly: only a non-public host, only a base from the setting or a
   frontend, only while Drupal's host is production-like. A missing canonical
   is safe; a localhost canonical breaks every share card. Alternative: keep
   them until `serve-each-frontend-its-own-addresses` and rely on the status
   report error.
4. **Naming a JSON-LD library in the README.** Recommended: no; the module's
   graph is complete. Alternative: name one as an option for frontends that
   add nodes of their own.
5. **How the recipe is proved.** Recommended: the contract test on the
   module's real head, plus a manual check with a running frontend.
   Alternative: also build a fixture frontend in CI. It adds a framework
   build to every pipeline, and on the farm it competes for memory with the
   site.

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
