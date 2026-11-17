# Proposal

## Why

`populate-every-schema-type` made every offered type fillable without
hand-written JSON-LD, but its review (round 1, 16 Nov 2026) found four of its
planned conveniences unbuilt. They were moved here so that its archived specs
say only what the module does:

- a group (a venue, an address) is linked part by part on a template;
- a reference to another page cannot be picked on a Canvas page;
- a linked number shows the field's raw value with no reading ("20", not
  "20 min"; "4200", not "€4,200");
- a decimal field is offered on the type only, not one reference away.

## What Changes

- **"Link all parts to"** on a template: one draft write links every part of
  a group to an address field, or to a reference whose target keeps its
  address in separate fields (with a part → field mapping shown first), with
  Undo. A missing part that a reference can fill offers "Link to ‹Reference› ›
  ‹Field›" in its guidance and in Checks.
- **The page picker** on a Canvas page: a venue or workplace reference picks a
  published, public page described as an accepted kind, through a search
  route, storing a `{node}` value: validated, stored and resolved here
  (moved from `populate-every-schema-type`, which refuses it until then).
- **Linked pairs and readings:** a linked pair stacks; a box shows "raw →
  reading" only when the reading converts the value; a tag drops a parent the
  pair or group shares; a linked group box says "‹Source› · ↵ open"; a single
  fact linked to a multi-value field says "First of ‹n›" in its tooltip.
- **Decimals one hop away:** a number links to a decimal field of a type a
  reference reaches, read as its exact digits.
- **A reference's menu leaves out pages of another kind**: an organizer's
  menu does not suggest a Place reference.

## Out of scope

Product variants and the return policy (`describe-product-variants-and-returns`);
the publisher's address, hours and profile (`describe-the-publisher`, H2).

## Decisions this relies on

- Product owner, 13 Nov 2026: "just do it all and make sure quality is
  high"; "experience needs to be clean even though we're making this more
  powerful". These are conveniences: each saves steps without adding a
  control to the view at rest.
- Decision 1 (link-values-to-fields, full plan): field links are Canvas
  entity-field sources, contained in `Sources`.
