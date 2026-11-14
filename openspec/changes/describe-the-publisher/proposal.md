# Proposal

## Why

The product owner asked for structured data that is easy to use and
"industry leading". Who publishes a site is on every page's structured data,
and it is where entity understanding, the one thing structured data still
reliably earns beyond rich results, starts. Today the identity is a name, a
logo and a list of profile addresses typed into Site settings: the profiles
drift from the links in the footer, nothing says whether the site name or
logo can show in search results, a local business has nowhere to put its
address and hours, and a save changes every page with no word about it. This
change reads the publisher back in one sentence with its verdicts, deepens
the identity, and lets it follow the footer's own profile links, safely.

## What Changes

- **Publisher stage in Site:** "Humanify Studio, an organization that people
  can email at hello@…, the same as its profiles on two networks." with
  verdict lines **Site name** (every site), **Logo** (organizations only) and
  **Business details** (a local business with an address).
- **Identity depth:** site name for the website node (default the identity
  name), description, email, telephone, address, opening hours and a subtype
  (organization, local business and a short list of its kinds). Alternate
  names come from `add-home-page-defaults`.
- **Identity linked to components:** profiles and email may follow a
  component prop in a page region or, failing that, on the front page.
  Profiles follow only links ticked as profiles; same-site links, `mailto:`
  and links on another registrable domain of the site are never ticked.
- **A drift check** when typed profiles differ from the footer's profile
  links, with "Use the footer's profiles".
- **Legal name** proposed from the copyright line, never applied on its own.
- **Logo and slogan defaults** (product decision 12): with no identity logo,
  the theme's own logo (not core's) is the organization's logo, the same one
  `strengthen-zero-config-defaults` draws on share images; Drupal's slogan is
  the organization's `slogan`.
- **The identity description on the home page** (moved here from
  `add-home-page-defaults` group 6b, since this change adds the description):
  a front page without a description of its own uses the identity
  description, never the slogan, and no other page does; Checks then say
  "From the site's description" instead of "Add a description"; the site card
  of `strengthen-zero-config-defaults` shows it, shortened at its first
  clause, as its line when Drupal has no slogan.
- **Saving says where it goes live** ("Save and apply") with the effect.
- **Caching:** an identity read from the front page is cached under one tag
  and invalidates heads only when it changes.

## Out of scope

- Merchant shipping and return policies.
- A kind for a local business page: the business is the site's identity.
- Profiles inferred by AI.

No README non-goal is reopened.

## Depends on / followed by

Runs **after `add-home-page-defaults` and `strengthen-zero-config-defaults`**
(build order: … `add-advanced-meta-tags`, `expose-seo-to-canvas-ai`,
`add-home-page-defaults`, this change, then `refine-seo-dialog`).
`add-home-page-defaults` no longer waits for this change: the parts of its
group 6b that need the identity description moved here.

- **Depends on** `rethink-structured-data` (stage, verdicts, site-save
  effect), `read-page-components` (reading region and front-page component
  props) and `add-home-page-defaults` (alternate names, the "site name is one
  name" check, the front page entity, the home page's description rule).
  Archive after all three: the `structured-data` and `seo-checks` ("Description
  rules") deltas here are written on `add-home-page-defaults`' text.
- **After `strengthen-zero-config-defaults`**, whose logo rule (public files
  or the theme's own folder only) the logo fallback reuses, and whose site
  card requirement the `share-images` delta here modifies. Archive after it.
- Independent of `set-up-types-from-templates` and
  `extend-structured-data-by-id`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `site-seo`: identity depth, linked identity values, profile ticks, legal
  name proposal, the publisher stage.
- `structured-data`: the identity's subtype, contact details, address and
  hours; the website's own name.
- `search-features`: business details; the logo for organizations only is
  already in `rethink-structured-data`.
- `seo-checks`: profile drift; "Description rules" (MODIFIED): the home page
  takes the site's description.
- `head-output`: a front-page-sourced identity invalidates heads only when it
  changes; the front page falls back to the identity description.
- `share-images`: "The site card shows the identity" (MODIFIED): the identity
  description is the line when there is no slogan.

## Impact

- **Config:** `canvas_metatag.site:identity` gains `site_name`,
  `description`, `email`, `telephone`, `address`, `opening_hours`, `subtype`
  and linked values with ticks.
- **Server:** `Values` (identity cleaners), `Sources` (region and front page
  props), `Resolver` (derived identity cache, `hook_canvas_page_update`),
  `SchemaGraph` (identity nodes), `ApiController` (save effect), the front
  page's description fallback in `Resolver`, `ShareCard` (site card line).
- **Data:** a `local-business` entry in the rules file; a profile host
  allowlist file reviewed with it.
- **Client:** Site view stage, identity fields, link menu with ticks; the
  home page's description row in Checks.
- **Docs:** README (the publisher), ARCHITECTURE.md §7, §13, §17.
