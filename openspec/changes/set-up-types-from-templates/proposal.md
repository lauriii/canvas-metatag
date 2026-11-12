# Proposal

## Why

The product owner: "the json+ld is somewhat hard to use", and "hmw to do
something industry leading there since that's really important?"

Most items get their structured data at content type scope, so this is where
"set once" saves the most time. Today an editor setting up "Every Article"
picks a type and links each property by hand, sees one previewed article and
no way to know how many of the 212 articles actually carry an author or an
image, and nothing warns that a linked field is one the template never shows.
Canvas already knows which fields each content template renders. This change
uses that to set a type up from its template in one click, to speak about
every item rather than one sample, and to warn where structured data would
describe something visitors cannot see.

## What Changes

- **Self-setup.** On the first visit to an unset type, the dialog proposes a
  kind and links from what the template renders ("Headline from Title,
  image from Image, dates from each article"), each with its reason ("shown
  in Heading"). **Use it** stores only links to fields the template shows;
  others are named as left out and offered unticked in **Review**.
- **Reach.** Verdicts at type scope count every published item: "Can show on
  175 of 212", "Complete on 175 of 212". Facts that help get gray "Also helps"
  rows ("Author on 175 · 37 have none · Preview one"). Counts are exact,
  cached, and from a sample above 2,000 items, said as "about".
- **Preview one** swaps the previewed item to one of the failing set, in the
  dialog only.
- **Visibility parity.** A linked field the template does not show is said
  at the field with "Open template" and "Leave ‹author› out". The modified
  date is exempt.
- **Per-item facts.** A name, headline, date, price or image typed once for
  every item makes every feature that needs it read "Needs a name per
  product", with no count.
- **Dropped values counted** ("3 Products have a currency that isn't one ·
  Show which"); the dialog never edits those items.
- **Authors as links.** An author linked to a reference field gives one
  author entry per referenced entity, linked to its profile page when that
  page is public and describes a person or an organization.

## Out of scope

- Writing to content items from the dialog (no bulk writes).
- Component mappings (`derive-structured-data-from-components`).
- Publishing a template's structured data change with a diff
  (`add-structured-data-diff-and-overview`).

No README non-goal is reopened: reach is read-only and per type, not bulk
editing.

## Depends on / followed by

- **Depends on** `rethink-structured-data`, `read-page-components` (the
  template's component tree) and `link-values-to-fields` groups 6–7 (field
  links as Canvas sources, the link menu with references).
- **Followed by** `add-structured-data-diff-and-overview` (the template
  publish diff and the overview reuse the reach route).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `template-seo`: self-setup, reach, preview one, per-item facts.
- `seo-checks`: a linked field the template does not show; per-item facts
  fixed at type scope; dropped values counted.
- `structured-data`: authors linked to their profile pages, several authors,
  organization authors.
- `seo-access`: the reach route's access.

## Impact

- **Server:** `Sources::shown($template)` (the fields the template renders),
  a proposer for self-setup in `Resolver::report()`, a new reach route
  `GET /canvas-metatag/api/reach`, `SchemaGraph` author entries.
- **Client:** setup band and Review sheet, reach lines and Also helps rows,
  Preview one, field guidance.
- **Access:** the reach route needs the edit permission and update access to
  the template.
- **Docs:** README (Every ‹Type›), ARCHITECTURE.md §3, §7, §13 (reach cache),
  §17.
