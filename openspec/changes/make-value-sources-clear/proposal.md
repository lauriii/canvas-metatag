# Proposal

## Why

On 2026-11-24 the product owner sent two screenshots of the Schema tab of
"Every Article".

1. **Author.** A box reads "admin (the page's author)", with a link icon after
   the label. The product owner wrote: "this is quite confusing; is this a
   static value or linked value? the UI makes it very unclear".
2. **Updated.** The label "Updated" with a link icon, the aside "From the
   page" at the right, and a box reading "Default · Last updated" over
   "November 16, 2026, 01:14". The product owner wrote: "same here, it's
   unclear what's static, what's linked, what is from this page, etc. It's
   quite overwhelming".

The bar the product owner set: "immaculate", clean even though powerful, with
strong defaults.

An audit of site-4 on the same day walked 46 states across a Canvas page,
four content templates and Site settings. It found that the dialog has no
single language for where a value comes from:

- One field can carry four overlapping source signals in different words
  (Updated: the link icon, "Default", "Last updated", "From the page", and a
  fifth, "Follows the default", in a tooltip). Another carries none (Venue,
  Kind of article, the robots rows, a page's social image).
- "Follows its default" is said at least 13 ways, "linked" 3 ways,
  "inherited from the site" 4 ways and "typed here" 3 ways.
- The link button by every label looks the same whether the value is typed,
  follows a default or is linked. It reads as "this is linked" on fields
  that are not.
- Most source words live in an aside that shows only on hover or focus.
- "Page" is said on templates, where it means "each item".
- Author looks like a choice someone made, and offers "This site" in two
  menus.

Three designs were drawn and judged by three reviewers (a first-time site
builder, an expert who sets up many templates, and design system and
accessibility). All three chose the same base. This change is that base,
with the ideas at least two reviewers praised and every flaw they raised
fixed. Two critics then read it cold, for completeness and for clarity; what
they found is folded in (design.md, decisions 21 to 32).

## What Changes

- **One source control per field.** Every field that can take its value
  from more than one place shows, at the right of its label row, one small
  button that names the source in words and opens the one menu that changes
  it. It is always visible. A field with one possible source has none.
- **A closed vocabulary of sources**, named as nouns, the same in every tab
  and scope: the scope's own name for a value kept here ("This page",
  "Every Article", "Site"); a field ("Poster › Image"); a fact of the item
  ("Article's author", "Page's last update"); another value in the dialog
  ("Search description"); the site ("This site", "Site name", "Site
  setting"); another language ("English version"); "Default" for a built-in
  choice; "Not set"; a broken link (its glyph, its name); and "Outside SEO"
  for a value set in the site's settings file.
- **One color rule.** Blue with the link glyph, as Canvas marks a linked
  prop, means the value is filled from the item: a field or a fact. Gray
  means it is set in SEO settings. Red means broken.
- **A box means you type here.** Text kept at this scope is an input box.
  A value that follows something is a read-out: the value in ink, with no
  box. A choice, a date that follows something, a person and an image are
  read-outs too; they change through the menu.
- **One source menu**, grouped by follows and set, in the status's own
  verbs: "Follows each ‹Type›" or "Follows the page", "Follows the site",
  "Follows the ‹Language› version", then "Set for every ‹Type›" or "Set on
  this page". Only sources that fit are rows. It replaces the link menu's
  "Automatic" group, the Author select and its second menu, a choice's own
  select, Reset and the ×.
- **The title ending is its own row** under the title, with its own source
  control, as Site already draws it.
- **Going back** is a menu row named by where it goes, or Delete on the
  focused control, with Undo in the action bar and a sentence in the status
  ("Updated is back to Article's last update."). The default row never
  stores anything.
- **Settings rows** (Advanced) say their source on the row's second line,
  with no second select; the closed row says what differs ("Site settings",
  "1 set for every Event").
- **Deleted:** the link button after labels and the "+" on composers; the
  hover-only aside's source words, Reset and Edit; the "Default ·" tags and
  the gray default box; the × on linked boxes; the link button's tooltip;
  "(the page's author)" and "(this site)" in option names; the Author
  select; the ending's inline menu button; the second select on settings
  rows; the "Default" pill; "Not answered"; "Link a field…"; gray
  placeholders that stand for inherited values; the menu's "Automatic"
  group, "Instead of the default" and its row of fields that don't fit;
  the explain line under an empty link.
- **Tab order** puts the source control before its box, as Canvas puts its
  link button before its input.
- **Forced colors, 320 px and pair columns** are part of the design, not an
  afterthought.

## Out of scope

- Canvas's own prop form. Canvas keeps its link button and solid pill. Ours
  shares its meaning (blue and the link glyph mean "a field").
- New sources. This change names the sources the dialog has today. There is
  no "from the template" source: a node through a template has no values of
  its own (per-node overrides are a v1 non-goal), so nothing inherits from a
  template. The sources that open changes add (a page's first image, a
  title card, the page's text, a component) take their names from this
  vocabulary when they land (task 9.1).
- A dark theme. The dialog renders with the light appearance only.
- Whether Recipe, like Article, should default its Author to the item's
  author. That is a product call, listed under open questions in design.md.
  Until then Recipe's Not set row says "Left out until you pick one."
- No non-goal is reopened.

## Capabilities

### Modified Capabilities

- `seo-dialog`: the source control, the vocabulary, the read-out, the
  source menu's groups, going back, settings rows and summaries, Author and
  other references, the title and its ending, choices, the kind, Tab order,
  names, forced colors and narrow widths.
- `value-links`: linked values become read-outs under a blue source
  control; the link button, the box, its tag and the × go; the menu's
  "Automatic" group becomes "Follows each ‹Type›"; unfit fields move to the
  menu's footer; chips use the sources' names; unlinking and keyboard paths
  follow the source control.
- `dynamic-values`: the dialog's words for a value hidden from visitors
  move from the box to the read-out.
- `template-seo`: the previewed node's values show in read-outs and the
  source menu.

`seo-checks` keeps its sentences ("Set for every Article.", "Set on this
page."): they already read as this vocabulary in sentence form.

## Impact

- **Dialog code:** `Field.tsx` (`useField`: the aside, Reset, Edit; the new
  source control and read-out), `Value.tsx` (`useLink`, the box, the ×,
  the tooltip), `LinkMenu.tsx` (groups, names, rows for options and actions),
  `SchemaTab.tsx` (`WhoField`, `Detail`, choices, group summaries, the
  kind), `SearchTab.tsx` and `SocialTab.tsx` (read-outs that become native
  inputs on a click), `SettingsList.tsx` (second-line sources, summaries),
  `Composer.tsx` (chip names, the control's flip), `values.ts` (`boxTag()`,
  `detailFrom()`, `DETAIL_FROM` go; one `sourceName()` comes),
  `styles.css` (the control, the read-out, forced colors, the
  `--seo-default-*` and `--seo-link-bg` tokens go).
- **Tests:** `values.test.ts` and the components' vitest files; Playwright
  constants and the specs that name today's buttons (`constants.ts`,
  `template.spec.ts`, `page.spec.ts`, `compose.spec.ts`,
  `template-complex.spec.ts`, `headless.spec.ts`, `schema.spec.ts`); a new
  `sources.spec.ts`.
- **Docs:** `openspec/design-system.md` (rule 3, §3, §5.2, §5.3, §5.5,
  §5.7, §5.13, §7, §8, §9, §10), README's dialog section, and the
  screenshots.
- **Other open changes** that plan UI in today's words must be brought into
  this language (task 9.1; design.md lists them).
- **No stored value changes shape**, and no update hook is needed. The
  dialog's state already carries each value's source, the type's label and
  a broken link's reason. Task 1.1 confirms this against the state route
  before any UI work, and adds a member there only if a name cannot be
  built from it.
