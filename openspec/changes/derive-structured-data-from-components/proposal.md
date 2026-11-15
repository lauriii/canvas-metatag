# Proposal

## Why

The product owner: "hmw to do something industry leading there since that's
really important?"

Structured data is hard because it is a second copy of the page that someone
types, and a copy drifts. Canvas holds the page as typed components on the
server: which component each part is and what its props hold. If a site
builder says once what a component means ("the Pricing table shows plans
with prices"), every copy of it, on every page and template, can describe
itself, from the same data the page renders, and the editor's whole job
becomes reading the sentence and saying "Looks right". FAQs, plans and videos
stop being hand-written JSON. This is the bold bet of the redesign, gated on
the reader's tests and budget from `read-page-components`.

## What Changes

- **Set up a component once** (site builders): Site › Components lists every
  component that says something, how many pages and templates use it, and
  the versions in use. "Set up ‹component›" proposes a mapping from the
  component's prop shapes (never AI): what it shows (plans for a service,
  things people buy here, a video, questions with answers, an image's credit
  and licence), its items, facts it lacks typed once (a currency), and what
  happens when a page is mainly this component: ask whoever edits the page,
  automatically (never for products), or never. Mappings are kept per
  component version. Saving names where it goes live: "Save and apply to 3
  places".
- **Parts in the graph:** each set-up instance becomes a node at
  `{url}#c-{uuid}`, or the offers of the page's main thing. Monthly and
  annual prices become separate offers, each with its billing period. Parts
  that need a parent are left out (and said) until the page is about them.
- **Suggestion band:** on a page whose main thing could come from a
  component, the stage reads the suggestion as it would ship, with "Looks
  right" and "Change…". A pricing component suggests **plans for a service**
  unless set up as things people buy here; a product suggestion first asks
  "Can people buy it on this page?". Until someone agrees, search engines get
  a plain web page.
- **Mostly about:** when a page has several candidates, the editor picks
  one; the others read back as "It also shows …" with honest lines (a video
  on a page not mainly for watching it is "not shown here").
- **Every fact points at its source:** facts from a component are read-only
  boxes tagged "▦ Pricing table › prop", with "Select in page".
- **States said, never hidden:** a component version lacking a mapped prop,
  a component not set up yet (builders get "Set up…", editors "Ask a site
  builder"), the chosen part gone from the page or from a translation's own
  tree.
- **Video to watch** becomes a kind when a video component is set up.

## Out of scope

- Mapping through AI; per-instance switches; ratings or reviews from
  components.
- Sending mappings through Canvas's publish review (needs an upstream
  auto-save integration for third-party configuration). Site-level saves go
  live at once, with their effect named first.

## Non-goals reopened (product owner sign-off needed)

- The README lists **repeating structured data such as FAQs or recipe steps
  (use custom JSON-LD)** as not provided. This change provides it for lists
  that come from set-up components only. Recommended: yes.
- **Go / no-go** on this change, gated on `read-page-components`' kernel and
  budget tests. Recommended: go.
- **"Automatically"** per component: allowed, default "Ask whoever edits the
  page", never for products. Recommended: yes.

## Depends on / followed by

- **Depends on** `rethink-structured-data` (kinds, Service, billing, verdicts,
  report), `read-page-components` (the reader and its gates) and
  `extend-structured-data-by-id` (the `schema.main` key and the module id
  list with its `c-` prefix).
- **Followed by** `add-structured-data-diff-and-overview`.

## Capabilities

### New Capabilities

- `component-mappings`: how a site builder says what a component means, per
  version, and how that is proposed, stored and applied.

### Modified Capabilities

- `structured-data`: parts at `#c-{uuid}`, component offers on the main
  thing, the main thing chosen among parts, the Video to watch type.
- `seo-dialog`: the suggestion band, Mostly about, component boxes and Select
  in page, the selection strip, Site › Components and the Set up sheet.
- `seo-checks`: component version lacking a prop, component not set up, the
  chosen part gone.
- `search-features`: the video feature and its watch-page rule.

## Impact

- **Config:** new config entity `canvas_metatag.component_mapping.<id>` with
  a dependency on its Canvas component.
- **Server:** `Proposer` (suggestions), set-up proposals from prop shapes,
  `SchemaGraph` parts, `Resolver::report()` (suggestion, `main_missing`),
  server-side parity from component props for headless.
- **Client:** suggestion band, component boxes, Components and Set up
  sheets, `host.ts` selection.
- **Canvas internals:** the supported `selectedComponentUuid` extension
  message; the editor's component route for "Select in page"; JS component
  prop titles (config, translated by config translation).
- **Docs:** README (components that describe themselves; the non-goal line),
  ARCHITECTURE.md §7, §11, §13, §17.
