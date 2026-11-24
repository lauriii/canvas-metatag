# Design

## Context

A developer built a frontend on the Canvas SDK's adapter for a React
framework's metadata API (`@drupal-canvas/headless-next`, "the adapter") and
reported what went wrong (proposal, "Why"). Each item was traced on the farm
site:

- the module's worktree, with `link-values-to-fields` partly built;
- Canvas 1.x-dev and its SDK packages, `@drupal-canvas/headless` 0.11.0 and
  the adapter 0.8.0;
- the framework's metadata resolution and rendering, version 16.3, from
  Canvas's own dependencies;
- the live dialog on "Every Article", including the accessibility tree of an
  open link menu.

Line references drift while the queued changes land, so each task re-reads
its code first.

One principle runs through every decision: **the head the module sends is
complete and correct, so the module fixes what it says and shows, documents
what a frontend must do, and drafts the rest for the package that owns it.**
The module never changes its output to work around one frontend's defaults.
It changes its output only where the output itself is wrong: a default that
misses a type's own summary (D4), and an address no visitor can reach (D5).

## Goals / Non-Goals

**Goals**

- A frontend on the adapter can render the whole head, and only the CMS's
  head, by following one README recipe that a test keeps true.
- A type with a Summary field gets it as the default description, with no
  configuration.
- The dialog never tells an editor something that is false on a headless
  site.
- An editor who links a template value can tell the type's fields from the
  module's worked-out values, and cannot pick a value no item will have.
- A production site with a development frontend ships no localhost
  canonical, and gets a status report error now, not when the last queued
  change lands.
- An editor can find their template's SEO change in "Review changes".
- Scripts and assistive technology reach every part of the link menu by role
  and name.

**Non-goals**

- Working around a frontend's defaults in the head the module sends (D3).
- Shipping JavaScript from this module for frontends to install.
- Anything inside Canvas's own UI.

## Decisions

### D1. A recipe, an example file and a contract test, not a package

The adapter's `toNextMetadata()` maps only the head entries its authors
listed, and drops every other `property` row on purpose, because putting
them in the framework's `other` member would render them as `name` tags. It
never reads `head.script`. The framework itself can render everything
the module sends:

- `openGraph.images` objects carry `url`, `width`, `height`, `alt` and
  `type`;
- `openGraph.publishedTime` and `modifiedTime` render when `type` is
  `article`;
- `openGraph.alternateLocale` renders `og:locale:alternate`.

So the loss is the adapter's, and the real fix is upstream (D7). Until it
lands, the README gives one recipe with three parts:

1. `generateMetadata()` returns `canvasMetadata(page.head)`.
2. `canvasMetadata()` is a helper of about 30 lines. It starts from
   `toNextMetadata(head)` and adds:
   - the `og:image` rows with the `og:image:*` rows that follow each one, as
     `openGraph.images` objects;
   - the `article:published_time` and `article:modified_time` rows, as
     `openGraph.publishedTime` and `modifiedTime`;
   - every `og:locale:alternate` row, as `openGraph.alternateLocale`;
   - `description: ''` when the head has no description, and
     `alternates: null` when it has neither a canonical nor hreflang (D3).
3. `<CanvasJsonLd head={page.head} />` renders each `head.script` entry
   with the SDK's `serializeJsonForHtml()`, never `JSON.stringify()`.

The helper documents its rule once: the CMS head is the page's whole head,
so an absent member means none, not "inherit the layout's".

The helper's only source is `examples/headless-next/canvas-head.tsx`, where
a developer looks for it. Its `package.json` pins the exact adapter, SDK,
framework and React versions it is tested with. The README quotes the file
between two marker comments, and a check fails when they differ. A copied
snippet cannot rot unnoticed.

The contract test, `tests/e2e/headless-frontend.spec.ts`, reads the content
API head of an article and of pages, and asserts:

- after `canvasMetadata()`, every meta row the module sent is present in
  the metadata object, in the member the framework renders it from. The
  check is generic: a row added by a later change, such as `og:image:type`
  or `og:locale:alternate`, must be handled or the test fails;
- for a head without a description or a canonical, `description` and
  `alternates` are own properties of the result. This proves the blocking
  without rendering through the framework;
- the JSON-LD component's output parses back to `head.script[0].textContent`,
  and holds no `</script`;
- the adapter alone, loaded from the Canvas codebase the pipeline built
  (`packages/headless-next/src/head.ts`, whose imports are types only),
  loses exactly the listed rows. This is the README table's adapter row. It
  fails on the first Canvas release whose adapter keeps them; then the pin
  is raised and the recipe trimmed.

The test does not render through the framework: its metadata renderer is not
a public API. The rendered HTML is checked by hand with a running frontend
(tasks, manual QA).

**Alternatives.**

- An npm helper published by this module adds a package to version against
  the SDK, for a gap the SDK should close.
- A fixture frontend built in CI renders for real, but adds a framework
  build to every pipeline and competes for the farm's memory (open decision
  5).

### D2. No JSON-LD library in the recipe, and no site nodes in the layout

The module sends one `script` entry, a complete `@graph` with stable
`@id`s, including the site's organization or person (`#identity`) and
website (`#website`). A frontend renders it as is. The README's one
sentence on JSON-LD says:

- don't add site-level organization or website nodes in the layout; the
  CMS graph has them, and a second copy under another `@id` splits the
  site's identity;
- a frontend that adds other nodes references the module's `@id`s, and may
  merge by `@id` with any library.

The developer's library fixed its types, so it now takes
`script.textContent` without a cast. That mattered because the SDK types it
as plain JSON.

### D3. An absent head member: say it, block the inheritance, never send an empty row

When the module has no description, it sends no row (head-output, "Rows with
an empty value are omitted"). The framework merges metadata per top-level
key, page over layout, so an absent `description` keeps the layout's. It
then copies that description into the share card's `og:description` and
`twitter:description` when they are empty. Every post shared the site
description. A canonical the module leaves out (D5) is inherited the same
way: a layout's `alternates: { canonical: '/' }` would point the page at the
home page.

`openGraph` and `twitter` are safe already: the page always sets them,
because `og:type` and `twitter:card` are always sent. Robots is safe too: the
adapter renders the module's robots row as its own tag, a layout's robots
renders beside it, and crawlers apply the more restrictive of the two (see
"Review decisions").

The fix is in three places:

- **The adapter** should set `description: ''` and `alternates: null` when
  the head has none (D7). The framework renders no tag for them, and stops
  inheriting.
- **The recipe** does it until the adapter does.
- **The dialog** says only what the module knows, in the same words
  everywhere: "No description sent. The frontend decides what to show." That
  is the search preview's and the link preview's muted line, the focused
  empty field's text, and the "Add a description" check's sentence, in
  every variant of that check, the front page's too.

  "Headless site" means `canvas_headless` with at least one frontend. The
  state gains one boolean for it, `headless`. `origin.source` is not enough:
  a `settings.php` public base hides whether a frontend exists. With
  `serve-each-frontend-its-own-addresses` it becomes "the frontend being
  previewed" (amendment 5).

Sending `<meta name="description" content="">` was rejected (proposal,
"Why"). Fewer empty descriptions come from D4's named field, then from
`strengthen-zero-config-defaults`' derived text.

### D4. A summary is the default, and the link menu tells fields from worked-out values

Three things misled the developer:

- "Page › Description" read as a field of the page.
- It showed "Empty for this post" as if this one post lacked it. In fact no
  post can have it: the Description fact reads only a formatted text with a
  summary, and Post keeps its description in a plain "Summary" field.
- In the Description menu it is the field's own default, so picking it
  changes nothing.

**The default.** A node's Description fact gains one step:

1. the summary of its first formatted text with a summary, when not empty;
2. else the first plain or formatted text field (`string`, `string_long`,
   `text`, `text_long`), in form order, whose label or machine name without
   `field_` is a word for a description, compared without case: summary,
   description, excerpt, teaser, intro, lead, abstract;
3. else that formatted text, cut.

An explicit excerpt beats a cut of the body, the common CMS convention.
The fact's `via` names the field that gave the value, else the first that
could. A field `field_post_summary` labelled "Summary" matches by its label.
Exact words, not parts of words: "Lead time" on a product is not a
description. The label is the one stored with the field
(`Sources::namedFor()`), never the one translated for the interface, so a
"Summary" shown as "Résumé" is the description in every language, and the
editor's menu agrees with every visitor's head. `via` is said in the
editor's language.

The words, with title's (headline, title), live in
`data/value-words.json`, read by `Values::isNamedFor()`. The resolver uses it
for the default, and the field rows the dialog gets carry the values each
whole text field is named for (`named`), so one function decides: the default
and the menu's order always agree. `strengthen-zero-config-defaults` builds its "first
formatted or long text" fallback after step 2 (amendment).

**The menu** changes in four ways:

1. **The group is "Automatic".** These values are worked out for each item,
   whatever its type. A fact entry says what it reads beside its label, from
   `via`: "Description · from Summary", also where a field listed above
   gives the same text. It is its own part of the row (`MenuItem.hint`),
   never cut with a long value, and part of its accessible name. A summary is named as the menu names it:
   "from Body › Summary". A box that follows a default
   which reads a field says the same in its description. Facts that read no
   field (Title, Site name, Address, Author, the dates) show their value
   alone. A box, a chip and the announcements name a fact by its label
   alone ("Linked to First published", a chip "Title"), never "Automatic ›
   …". In a composer (`compose-values-from-fields`), "from ‹via›" goes into
   the chip's tooltip and the composer's description, not onto the chip.
2. **A fact no item can have is disabled.** The resolver reports, per fact
   and per type, whether anything of the type can give it. That is `via`
   being set for Description and Image, and always for the rest, also for
   a type with no item yet (the resolver walks the type's form). A fact
   without it is listed last in its group, disabled, with the reason "No
   ‹type› has one" ("No post has one"), so that the reason is seen without
   opening the fold; a Default box that follows it says the same. "Empty for
   this ‹type›" keeps its meaning: this item lacks a value others may have.
3. **A field's own default is not in its menu when the pick links the whole
   value.** Linking a field to the value it already follows changes nothing.
   The field's Default box shows the default and its source, and "Reset"
   returns to it. In add mode, and when replacing a chip of a composition,
   the menu offers it, since "Tickets: ‹Title›" needs Title. On a Default box
   and in an empty composer, the row "Add words or fields · Start from
   ‹Title›" adopts it as the first chip. While a field follows its default,
   the entry of the field that default reads is marked current and says
   "Default" beside its label: at 350 px the menu covers the Default box,
   and nothing else would say what is in use. It is the field's own row,
   not a "Default" entry.
4. **With an empty filter, fields named for the value come first**, by the
   same words, and so does the field a description's or image's default
   reads ("Description › Summary" before "Description" and "Status"). The
   filter's own "best match first" ranking does this already for typed
   text. Without a filter, form order decides within each band. A typed
   filter ranks across groups on purpose, so a group's heading can move
   while typing (round 2 UX review): the best match must be first and
   active, so that Enter picks it ("{title}" adds Title, not Venue › Title;
   value-links "The best match first"). Groups in a fixed order would put a
   weaker match of the type's group above an exact Automatic one.

Points 2 and 4 hold in every mode of the menu: link, add and replace.

Group headings become `role="group"` elements named by their heading through
`aria-labelledby`, wrapping their options. A listbox may own groups of
options. This is what `link-values-to-fields`' scenario "A group whose label
has a space" already requires. The current markup hides the headings
(`aria-hidden`) and wraps each option in `role="presentation"`.

**Alternatives.**

- Fold the facts into the type's group (Title, Author and dates are, after
  all, the post's own). But Description and Image are heuristics, not
  fields, and need to be told apart.
- Hide unavailable facts. Then an editor who knows the module's Description
  wonders where it went. Disabled with a reason teaches the rule.
- A "Default" entry at the top of the menu: a fourth kind of row that
  repeats the Default box and "Reset" (see "Review decisions").

### D5. Addresses no visitor can reach: left out, and reported

`serve-each-frontend-its-own-addresses` designed the full guardrail (its
D12 and D14), but it lands last. Meanwhile a production site whose first
frontend is `http://localhost:3000` ships localhost canonicals today. This
change takes the two smallest pieces now, on today's single public base.

**Left out.** When the public base comes from the setting or a frontend and
is on a non-public host, and Drupal's own host is not a development host,
the page has no address. Its head carries no canonical, `og:url`, hreflang
or JSON-LD script, exactly as `serve-each-frontend-its-own-addresses` does
for addresses it can't know. Images stay on Drupal, as now. The decision
reads Drupal's host, so the head varies by `url.site`.

Plain http on a public host is never left out. A coupled site reached over
http behind a TLS-terminating proxy without Drupal's reverse proxy settings
gets an http public base from the request; losing every canonical there
would be worse than the warning below.

**Reported**, as the row "SEO public addresses":

| Public base | On a non-public host | Plain http, public host |
|---|---|---|
| From the setting or a frontend, Drupal production-like | error: "Pages carry no address, because ‹address› is not public. Set `$settings['canvas_metatag_public_base']` to the public address for this environment." | error: "Pages tell visitors and search engines to use ‹address›, which is not https. Set …" (same fix) |
| From the setting or a frontend, Drupal on a development host | warning; nothing when the base is a development host too | warning |
| From the request (no frontend, no setting) | none | warning on a production-like host: "Pages say their address is http://…. If visitors use https, set Drupal's reverse proxy settings." |

A local Drupal with its frontend on `localhost:3000` is the normal,
correct local setup, so it gets no row.

- "Non-public host" and "development host" are exactly
  `serve-each-frontend-its-own-addresses`' definitions: images on a host no
  crawler reaches; and D14's loopback, `localhost`, `test`, `invalid` and the
  known local suffixes. A known local suffix is both development and
  non-public: its names resolve to 127.0.0.1, so a production Drupal whose
  frontend came over as `https://front.ddev.site` gets the error too. They
  are one static helper each,
  `Values::isPublicHost()` and `Values::isDevelopmentHost()`, so that change
  reuses them.
- The row is computed at runtime, never cached, and costs one parse.

### D6. A template's draft names its "Review changes" entry

Canvas names each pending change by `label()`, captured when the draft is
written, and offers modules no hook, event or details field. For a template
that label is "Article content items — Full content view", which the
developer could not connect to SEO.

The template's draft status says that label, from the state's
`target.canvas_label` (Canvas's own `label()` of the target, read by the
server). It reads: "Draft · listed under Unpublished changes as “Article
content items — Full content view”" ("Unpublished changes" heads the panel
Canvas's "Review changes" button opens), with a non-breaking space before the dash so
that no line starts with it. A page keeps "Draft · goes live when you
publish the page", because Canvas lists it under its own title.

What the draft changes is not listed (see "Review decisions"). It belongs in
`add-structured-data-diff-and-overview`'s visible "When you publish", and in
Canvas's row once the upstream draft lands.

**Alternatives.**

- Changing the template's label through the entity class: it renames every
  template everywhere.
- Writing into Canvas's dialog from the module's frame: it breaks the "no
  private UI" rule (ARCHITECTURE §11).

### D7. Upstream drafts

- `upstream/canvas-sdk-next-head.md` asks the adapter to map the whole head:
  `og:image:*`, `article:*` and `og:locale:alternate`, and to treat an
  absent description and canonical as none. It also asks for an exported
  `CanvasJsonLd` server component. That makes the adapter as complete as
  the other two adapters that render everything. With it, the recipe
  shrinks to `toNextMetadata()` and `<CanvasJsonLd>`, and the example file
  and its README quote are deleted.
- `upstream/canvas-review-change-details.md` asks for an optional `details`
  list on each pending change, filled by an alter hook, and rendered under
  the row's label. With it, D6's status line goes back to "Draft · goes live
  when you publish", and the module adds "SEO: Description, Social image" to
  the row instead.

Both follow `close-known-limitations`' draft format, and neither is posted.

### D8. Scripting the dialog

The dialog is a Canvas extension in a frame titled "SEO". A script that
queries the top document finds none of its roles, which explains "no roles".
The README gains a short section, "Scripting the dialog":

- reach the frame by its title;
- use roles and names, which tests already do for every control;
- `data-path` on a field is the value's path, not a test hook, and is not
  promised.

No test IDs are added. Testing Library ranks `getByTestId` last, for when no
role or text works, and Playwright's guidance prefers user-facing locators.
Every gap found was semantic, and test IDs would have hidden it.

## Risks / Trade-offs

- **The recipe ties the README to the adapter's 0.x API.** The example pins
  exact versions; raising them is a reviewed change that runs the test.
- **The description words are English.** Machine names are usually English
  even on other-language sites, and the words also match them. A miss falls
  back to the cut body, as today.
- **A text field named for a description that holds something else.** It
  becomes the default description. The words are exact, the field must be
  text, and the editor sees "from ‹field›" on the Default box and can link
  another.
- **A long field named for a description is sent whole.** A long "Intro"
  becomes a long meta description, as a long summary already does; only the
  body is cut, because it was never written as a description. The search
  preview and the length meter show the length, and the editor can link
  another field or type one.
- **A template's Default box names the previewed item's source.** "from
  Biography › Summary" for a person with a summary, "from Biography" for one
  without: `via` is the field that gave the value, else the first that
  could. The box is about every item, but its value is the previewed one's,
  and the source goes with the value.
- **Leaving out addresses while misconfigured.** A production site with a
  development frontend loses its canonical and JSON-LD until the public base
  is set. That is the safe failure, and the status report error says how to
  fix it.
- **An extra status row before `serve-each-frontend-its-own-addresses`.** It
  is replaced there, not doubled (amendment 1).

## Migration

No stored data changes. A type with a field named for a description and no
formatted text summary gets that field as its default description; the
release note says so. The README's headless section is rewritten.

## Review decisions

An independent review, read as the developer who sent the feedback, ranked
eight findings. Taken:

- The named-field default moves into this change (dynamic-values), with one
  word list for the resolver and the menu, and the amendments are applied in
  the planning commit.
- The recipe blocks an inherited canonical as well as the description.
- Only non-public hosts are left out, pulled forward into this change; plain
  http is reported only. A development frontend on a development host gets
  no row. One helper name, on `Values`.
- The helper moves to `examples/headless-next/`, and the adapter-alone check
  reads the adapter from the Canvas codebase under test.
- One sentence for an empty description everywhere, the link preview
  included; no claim about what the frontend shows.
- No "Default" entry in the menu.
- `draft_changes` is cut; the label stays.
- The README says not to add site nodes in the layout; D2 no longer speaks
  for every library.

Not taken:

- **`robots: null` in the recipe, and asking the adapter to map robots to
  `metadata.robots`.** The module sends robots on every page (the shipped
  `max-image-preview:large`). Nulling the layout's robots, or replacing it,
  would remove a frontend's own staging `noindex` from its layout. Two robots
  tags are valid: crawlers combine them and apply the more restrictive. The
  test still asserts the module's row survives.
- **Running the adapter-alone check in the PHPUnit job against Canvas's
  development branch.** That job has no running site to read heads from, and
  sites build on released packages, so a release is when the recipe can be
  trimmed. The check runs in the Playwright job, on the Canvas release the
  pipeline built.
