# Proposal

## Why

The product owner: "the json+ld is somewhat hard to use", and then: "hmw to do
something industry leading there since that's really important?"

Today the Schema tab is a form of schema.org classes and property names with no
result to look at. Editors cannot tell what search engines will understand,
which search features the page can earn, or whether the markup matches the
page. The same form lets a membership be described as a product that looks
ready for shopping results, a monthly fee ship as a one-time price, and a
hand-added question nobody can see put the page's other results at risk. This
change is the easy-to-use core of the redesign: the view opens on a plain
reading of what the page says to search engines and an honest line per search
feature, decided from dated rules, before anything is published. It is the
first of seven changes (see "Depends on / followed by").

## What Changes

- **The Schema view opens on a read-back.** One to three plain sentences built
  only from the graph that ships ("Oak desk lamp, a product sold by Humanify
  Studio for €89, in stock."). Each fact is a button that goes to where the
  value is set. No schema.org words outside Output.
- **One line per search feature.** Verdicts: can show, complete, needs
  ‹fact›, only if bought here, doesn't fit, not shown here, retired (dated),
  no search feature. Each opens a proof: where the feature appears (one plain
  line), required facts with their values, what else helps, the guideline no
  machine checks, the rule's source and the date it was checked. Verdicts
  never promise a result.
- **A rules file.** A new data file lists the live and retired search
  features, their required and recommended paths, the rules that make a
  feature not fit, and a review date. The server evaluates it.
- **"What this page is"** replaces the Type select: kinds in the editor's
  words with what each can earn. **Plans for a service** is a new kind
  (memberships, subscriptions, services; no result of its own).
- **Honest commerce facts.** A product gains **Billed** (once, every month,
  every year; emitted as a price specification) and **Bought on this page**
  (decides whether the site is the seller). A recurring price, several plans
  on one product, or a product not bought here make the shopping listing
  "doesn't fit", in gray, with no fix toward it.
- **Facts ordered by what the features need**, required facts show their
  guidance at rest, and a required fact that comes from a default (the name
  from the page title) opens its own field in place.
- **Matches the page:** one line says whether the facts were found on the
  page: text, prices with their currency and period, dates, images, ratings,
  and linked values.
- **Custom JSON-LD moves behind Code** as "Add your own JSON-LD", with a
  one-release notice where it was. Its items read back as "Added by hand",
  get verdicts, and text in them that is not on the page is **to fix**, with
  "Leave it out until it's on the page". Reviews and ratings of your own
  organization are reported over the whole graph; a rating of another
  company is not.
- **Output shows the graph as an outline** (main thing first, origin, `@id`,
  left-out and retired items with reasons), then the exact JSON, Copy and a
  hand-off to a structured data test.
- **Site currency**, the default for every price; a site save that changes
  structured data elsewhere names its effect first.
- **Nothing silent:** an unknown stored kind, a dropped value and a withheld
  main node are reported to the dialog with their cause.
- **Delivery stays cheap:** head output computes only the graph; verdicts,
  rules and checks run only for the dialog.
- **Registry strings are translatable** as whole sentences; a language without
  a translation shows a fact list instead of a sentence.
- AI structured data proposals never include dates or authors; facts not
  found on the page are counted, not offered.

## Out of scope

- Component-derived facts, breadcrumbs, template self-setup and reach, adding
  details to the module's nodes, publisher depth, the publish diff and the
  site overview: the six changes that follow.
- Result mocks, scores, "AI-ready" claims or any promise that a result will
  show. Nothing documents that structured data earns AI citations; the
  search features' own documentation says no special structured data is
  needed for AI features.
- Ratings and reviews as kinds or defaults; a schema.org vocabulary at
  runtime; conversion of existing custom JSON-LD. (`extend-structured-data-by-id`
  later adds a form for hand-added items and a vocabulary the site downloads,
  product owner, 2026-11-13.)
- Merchant shipping and return policies.

No README non-goal is reopened by this change.

## Decisions for the product owner

1. **Naming the search engine.** The verdict caption and the rules line could
   name the search engine whose rules are encoded. The specs use the neutral
   copy ("In search results", "Rules checked ‹date›"). Recommended: keep it
   neutral in the repo; the source addresses of each rule live in the rules
   file.
2. **Plans for a service in this change** and the guard that keeps
   memberships and subscriptions out of shopping listings. Recommended: yes.

## Decisions this relies on

- **Product owner, 2026-11-13: hand-added JSON-LD can be filled as a form or
  as JSON** (decisions.md, item 11; built in `extend-structured-data-by-id`).
  This change narrows its review rule for it: a review or aggregate rating is
  "of your own organization" only when its subject is the site's identity or
  an organization with the identity's address or profiles, so an employer
  rating of another company is not flagged. The G1 line points at the
  identity by its full address, which today's validator accepts.

## Depends on / followed by

- **Depends on `link-values-to-fields`** groups 1–3 (the value model, facts,
  linked boxes and states). Archive after it: the `structured-data` and
  `seo-checks` deltas here are written on its text.
- Independent of `add-home-page-defaults`, `add-advanced-meta-tags`,
  `build-ai-on-drupal-ai` and `expose-seo-to-canvas-ai`; see design.md
  "Overlaps".
- **Followed by**, in order: `read-page-components`,
  `set-up-types-from-templates`, `extend-structured-data-by-id` (may run in
  parallel after this one), `describe-the-publisher`,
  `derive-structured-data-from-components`,
  `add-structured-data-diff-and-overview`.

## Capabilities

### New Capabilities

- `search-features`: which search features apply to a graph, the verdict for
  each, why, and the dated rules behind them.

### Modified Capabilities

- `structured-data`: the registry gains kinds, Plans for a service, billing,
  "bought on this page" and the seller; the report says why the main node was
  withheld and what was dropped; hand-added items can be left out.
- `seo-dialog`: the Schema view (read-back, verdicts, proof, kinds, facts),
  Output's structured data section, the moved custom JSON-LD.
- `seo-checks`: structured data rows use the verdicts' words and severities;
  hidden hand-added text is to fix; reviews of yourself; price, date and
  image parity.
- `site-seo`: the site currency; saves that change structured data elsewhere
  name their effect.
- `head-output`: the dialog's report is computed apart from delivery.
- `ai-suggestions`: structured data proposals leave out dates and authors and
  do not offer unverified facts.

## Impact

- **Data:** `data/schema-types.json` (kinds, sentences, new props, Service),
  new `data/search-features.json`.
- **Server:** `SchemaGraph` (nested refs, price specification, feature
  evaluation, report members), `Resolver` (delivery and report split, image
  chain for products), `Values` (currency kind, site currency, skip list),
  `ApiController` (report, translated registry), a generated
  `src/RegistryStrings.php`.
- **Config:** `canvas_metatag.schema.yml` (site currency, schema skip list).
- **Client:** `SchemaTab.tsx` rebuilt (stage, kind sheet, proof popover);
  new `readback.ts`; `Output.tsx`; `checks.ts`; `types.ts`.
- **AI submodule:** reserved properties extended to dates and authors.
- **CI:** a strings drift job; a rules-review warning.
- **Docs:** ARCHITECTURE.md §7 (graph, report), §17 (tests); README (Schema
  tab, Plans for a service, what verdicts mean).
