# Proposal

## Why

`populate-every-schema-type` planned product variants on templates and a
site-wide return policy (its group 8, phases F and G). Neither was built in
its implementation run, and its review (round 1, 16 Nov 2026) asked that its
archived specs not promise them. They move here unchanged in intent.

## What Changes

- **Product variants on templates, one page per variant:** a `variant` group
  ("Link all parts to" Family from `link-groups-and-pick-pages`), "Varies by"
  checkbox rows (colour, size, material, pattern), a `ProductGroup` at
  `{url}#group` with `hasVariant` (this page by `@id`, siblings by URL only)
  and `isVariantOf`; a sibling of another family is dropped and counted.
- **A return policy at Site › Identity**, shown once a page or template says
  "Bought on this page: yes": a returns page, or a description (countries,
  category, days, fees), as one node at `{home}#return-policy` that the
  identity references.
- Their search features ("Product variants", "Return policy"), a Checks row
  for a sibling of another family, README and browser checks.

## Out of scope

Variants on Canvas pages (a product with several prices there stays "Doesn't
fit: several plans on one product"); merchant-account configuration; shipping.

## Decisions this relies on

- Populate's decision for the product owner 1: variants on templates, one
  page per variant (reopens "variants are out" for templates only).
- Decision 2: neutral wording; source addresses only in
  `data/search-features.json`.
