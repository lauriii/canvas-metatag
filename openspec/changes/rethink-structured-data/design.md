# Design

## Context

See proposal.md for why. Today `SchemaGraph::build()` turns the stored type
and properties into an `@graph` of identity, logo, website, page node, an
optional main node and custom nodes, and returns a small report
(`withheld`, `missing_required`, `missing_recommended`). `Resolver::resolve()`
is the only producer of head output: the coupled head, the headless `head`
member and the dialog's state all come from it. The dialog's Schema tab is a
Type select of the ten registry types, a property form, a "Custom JSON-LD"
row and a "View output" row. Three things are silent today: an unknown stored
type becomes a web page, a linked value that fails its kind is dropped, and a
custom node that reuses a module `@id` is dropped.

`link-values-to-fields` (a dependency) makes every value typed text, a fact,
a media item or a field link, and gives the dialog its linked boxes and link
states. This change uses them unchanged.

## Goals / Non-Goals

**Goals:**

- The view's first element is the result: what search engines can read, and
  what each search feature needs, in the editor's words.
- Every verdict is computed on the server from one rules file, and the same
  words are used in the stage, at the field and in Checks.
- The sentence never says more than the graph that ships.
- No extra cost on a visitor's request.

**Non-Goals:**

- Reading Canvas component trees (next change).
- Live verdicts while typing (the stage refreshes from the server after a
  draft write; a client mirror is `extend-structured-data-by-id`).
- A schema.org vocabulary at runtime.

## Decisions

### 1. Verdicts come from a rules file, evaluated on the built graph

`data/search-features.json` holds, per feature: `label`, `where` (one plain
sentence from the feature's documentation), `status` (`shown` | `retired`),
`since` and `changelog` for retired features (only with a dated changelog
entry), `doc`, `on` (types), `required` paths (`a|b` either; a nested list is
one of), `recommended`, `rules` (`gt`, `is`, `in`, `future`), `not_for`
(rules that make a feature not fit, each with a reason and a source),
`confirm` (at most two guidelines no machine checks), `names` (documented
property and enum names) and a file-level `reviewed` date.

`SchemaGraph::features($graph)` (pure, about 100 lines) evaluates it on the
built graph, following `{"@id"}` references inside it, so custom nodes get
verdicts too. Verdict values: `ready`, `complete` (a feature with no required
paths, counted on its recommended set), `needs` (with `missing`),
`unanswered` (merchant listing while "Bought on this page" is unset),
`not_fit` (with `reason`), `not_here`, `retired`, `none`.

Initial entries: product snippet, merchant listing (`not_for`: a billing
duration in the offer's price specification; more than one offer at different
prices without a product group; no `offers.seller` that is the identity),
article, event (address locality and country required by the feature;
confirm lines for public events and one event per page), profile page,
organization logo (organizations only), site name (`#website` on the home
page; not for a home address with a path); retired: FAQ (since 2026-05-07),
how-to, sitelinks search box, special announcement, course info, practice
problem.

*Alternatives:* verdicts written in PHP per feature (rejected: rules change
with the search engine's documentation, and a data file can be reviewed and
dated); a client-side evaluator only (rejected: Checks, headless and the
overview need the same answer, so the server owns it; a mirror comes later).

Sources: every rule's source address is in its `doc` field and was checked
on 2026-11-13. The claims this design relies on are the structured data
general guidelines (visible content, true representation, no guarantee), the
merchant listing documentation (image required, price above zero, the
merchant is the seller, only pages where a shopper can buy, the plain price
is used), the shopping policy on unsupported content (services, recurring
subscriptions), the product snippet documentation (single-product pages;
review and aggregator pages), the site names documentation (no
subdirectories), the review snippet documentation (reviews of your own
organization are ineligible), the search updates log (FAQ results not shown
since 7 May 2026) and the AI features documentation (no special structured
data is needed).

### 2. Delivery and report are two functions

`resolve()` keeps producing the head and returns only members produced while
building the graph: `withheld` (now with `missing`), `dropped`,
`unknown_type`, `nodes`, `sources`. A new `Resolver::report($entity, $draft)`
calls `resolve()` and adds `features`, `rules`, `clashes` (later) and parity
inputs. Only `ApiController::state()` calls `report()`. A kernel test with a
spy fails if the `page_attachments` hook or the headless decorator reaches
`features()` or the rules.

*Alternative:* add everything to `resolve()`'s report (rejected: it runs on
every page-cache miss).

### 3. Kinds are registry entries; the stored id does not change

The registry gains, per type, `kind` (`label`, `earn`, `not_for`, `icon`,
`order`) and `say` (sentence variants). Types without `kind` (Blog post, News
article, About, Contact, Collection page) are variants reached through a
"Kind of article" or "Kind of page" fact (`variant_of`). Stored
`schema.type` ids are unchanged, so nothing migrates. New type `Service`:
`provider` (the identity), name, description, one offer (price, currency,
billing).

### 4. Billing, "bought on this page" and the seller

New Product and Service props: `billing` (`once` | `P1M` | `P1Y`), emitted as
`offers.priceSpecification` (`UnitPriceSpecification` with `price`,
`priceCurrency`, `billingDuration`, `unitCode` `MON`/`ANN`) beside
`offers.price`; `once` emits nothing extra. Product only: `sold_here`
(`yes` | `no`, `emit: false`, a gate fact that is stored but never in the
graph). The registry's `refs` may name nested keys and be conditional:
`offers_seller` → the identity reference, only when `sold_here` is `yes`.
`SchemaGraph` walks nested refs like prop keys. New fact props: Event
`organizer` (default the identity), Person `worksFor`.

*Alternative:* a confirm sentence in the proof popover (rejected by review:
editors never open it, and the question decides eligibility, so it is a
fact).

### 5. The read-back is filled only from the graph

`say` is a map of whole-sentence variants per optional clause and arity, each
slot a path in the built graph. `readback.ts` picks the variant whose slots
all resolve (following `@id`s), formats values with `Intl` in the dialog's UI
language, and falls back to a label · value list when the server sends
`say: null`. No words are glued on the client.

### 6. Registry strings are translated on the server

A script generates `src/RegistryStrings.php` with one literal
`TranslatableMarkup` per registry and rules string (context
`canvas_metatag:schema`), so the strings are extracted for translation. CI
fails when the generated file and the JSON differ. `/state` carries the
translated strings; a sentence without a translation in the UI language
(checked in locale storage, not by comparing with English) is `null`.

*Alternative:* `t()` on JSON values (rejected: not extractable, fails coding
standards, and cannot detect a missing translation).

### 7. Parity is computed in the dialog

`checks.ts` compares with the editor's preview document (as today): text
literals; prices only when next to a currency symbol or code, parsed with
either decimal separator, and with the period words next to them; dates in
four formats of the page language; images by file URI; rating values and
counts; linked and fact values too. Never codes or identifiers.

### 8. Hand-added items: verdicts, rules and a skip list

Custom nodes are unchanged in storage. New `schema.skip`: keys of hand-added
items left out until they are on the page. The G-rules run over the merged
graph: G1 second identity, G2 dangling `@id`, G7 reviews or ratings of the
identity or of an organization node, G9 unknown stored kind, G10 relative
address. Hidden hand-added text is to fix.

### 9. Severity

To fix: the main node is withheld; hidden hand-added text; G7. To improve:
a feature needs something while another can show; a module fact not found on
the page; an unknown stored kind; a product or service name equal to the page
title; G1, G2, G10. Good to know: retired features in use, no search feature,
"doesn't fit", an unanswered "Bought on this page".

## Data model

| Where | Key | Change |
|---|---|---|
| `schema` (page, template) | `type` | unchanged; new id `Service` |
| | `props` | new keys `billing`, `sold_here`, `organizer`, `worksFor`; `offers_priceCurrency` of kind `currency` |
| | `skip` | new: list of hand-added item keys |
| `canvas_metatag.site` | `currency` | new: an ISO 4217 code or empty |

## Migration Plan

No stored value is converted. Existing products have no `billing` and no
`sold_here`: they read "for ‹price›" and "Only if people buy it here". A
currency typed as anything but a code is reported as dropped, as today it is
silently refused. The site currency starts empty; no update guesses it.
Rollback: the new keys are ignored by the previous release's cleaners only if
they are removed first, so a rollback runs `drush config:delete` on
`canvas_metatag.site:currency` and leaves page drafts as they are (unknown
props are refused on the next save, as today).

## Canvas internals relied on

None new. The dialog's parity reads the editor preview document it already
reads (ARCHITECTURE.md §11, `host.ts`).

## Overlaps with other pending changes

- `link-values-to-fields` modifies `structured-data` "Property values are
  checked against their kind" and `seo-checks` "Structured data rules"; this
  change's `seo-checks` delta is written on its text.
- `add-home-page-defaults` modifies "The site nodes describe the identity"
  and "The page node describes the page"; this change leaves both alone.
- `add-advanced-meta-tags` modifies `seo-dialog` "Sheets cover the view",
  which still names "Custom JSON-LD". This change adds the renamed sheet as
  its own requirement; at archive, the list in "Sheets cover the view" is
  updated to "Add your own JSON-LD" (tasks.md, Workflow follow-up).

## Risks / Trade-offs

- [Editors read "doesn't fit" as a bug] → the proof says why and what would
  fit; it is never amber and never counted.
- [The rules file goes stale as documentation changes] → `reviewed` date in
  the UI; a CI job warns after 120 days and opens an issue (never fails
  unrelated merges).
- [Parity false positives on prices] → only numbers next to a currency; a
  "check again" action; never auto-deleting.
- [A sentence reads wrong in a language] → whole-sentence variants; the fact
  list when untranslated.
- [Verdicts lag while typing] → the stage dims and sets `aria-busy` during a
  draft write; refreshes about a second after the last edit.
