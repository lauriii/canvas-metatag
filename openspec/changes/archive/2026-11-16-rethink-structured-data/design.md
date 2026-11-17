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
- A schema.org vocabulary at runtime (`extend-structured-data-by-id` adds one
  that the site downloads).

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
prices; no `offers.seller` that is the identity),
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
on 2026-11-13; reference.md lists the first entries' paths, rules and guides,
and the G-rules. The claims this design relies on are the structured data
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

Custom nodes are unchanged in storage, except that leaving out an item
without an `@id` first gives it one (`#‹type in lowercase›`, made unique on
the page, never a module id). New `schema.skip`: the `@id`s, as written, of
hand-added items left out until they are on the page. The G-rules run over
the merged graph: G1 second identity (its line points at the identity by its
full address, `{home}#identity`), G2 dangling `@id`, G7 a `Review` or
`AggregateRating` (not an `EmployerAggregateRating`) whose `itemReviewed`
resolves to the identity or to an organization of any type whose `url` or
`sameAs` matches the identity's (a restaurant or a hotel with the site's
address is the site; a page, the site's website and the registry's own
kinds, such as a product, are not organizations), G9 unknown stored kind, G10 relative address. Hidden
hand-added text is to fix. G7 is narrowed on purpose: the review rule is
about an entity that controls the reviews of itself, and the employer rating
documentation has no such clause, so a rating of another company is fine.

### 9. Severity

To fix: the main node is withheld; hidden hand-added text; G7. To improve:
a feature needs something while another can show; a module fact not found on
the page; an unknown stored kind; a product or service name equal to the page
title; G1, G2, G10. Good to know: retired features in use, no search feature,
"doesn't fit", an unanswered "Bought on this page".

### 10. Adapted while implementing

What the implementation found, and how the plan above was adapted:

- **Facts are worded in the rules file, not the registry.** Hand-added items
  get verdicts too, and they have no registry property. So the label and the
  "need" of each feature path ("an image", "a country") are in the rules
  file's `facts` map, keyed by path; the registry keeps its own labels. The
  registry's `need` and `per_item` (task 2.1) were left out: nothing used
  them.
- **Site nodes are judged on the home page only.** Organization logo and
  site name are evaluated on the module's identity and website nodes of the
  front page; elsewhere they give no line, so a plain page reads "No search
  feature". `not_here` is the verdict of a hand-added node of such a type.
- **A withheld main node is judged as it would ship.** `build()` reports the
  node with `withheld`, and `report()` evaluates it, so the dialog says what
  it needs instead of "No search feature".
- **Event address.** The event feature asks for the street address as well
  as the town and the country, so that what withholds the Event node (the
  street address) is what its least demanding feature requires
  (`RegistryConsistencyTest`). The currency is no longer required to emit a
  product: a product without one ships and the merchant listing needs one.
- **The facts shown first are listed in the registry (`main`).** "What the
  features need" in the order the spec gives (Price, Currency, Bought on
  this page, Image) is a short list per kind; `RegistryConsistencyTest`
  checks that every fact a feature needs and nothing fills by default is in
  it.
- **The spy is a call-site check.** `SchemaGraph` and `Resolver` are final
  and static where it matters, so `DeliveryPathTest` is a unit test that
  finds every call of `report()`, `features()` and `rules()` by the function
  it is made in: only `ApiController::state()` calls `report()`, and only
  `report()` calls the other two. A call added on the delivery path fails it,
  as a spy would.
- **An item without an `@id` is given one in the dialog.** Leaving out such
  an item writes the custom JSON-LD with the new `@id` and the skip list in
  one draft write (`model.ts` `leaveOut()`), so `SchemaGraph` only honours
  the list.
- **The kind sheet confirms every change.** A radio group changes on arrow
  keys; the kind changes only with the sheet's "Change to ‹kind›" button,
  which also carries the sentence naming what is removed.
- **Parity compares what is set, never defaults.** A date or text that
  comes from a fact by default (the First published date of an article) is
  the page's own and is not compared; typed values, linked values and facts
  chosen for a detail are. The stage says so: "The facts you set match the
  page."

### 11. Settled in review (round 1)

- **The dialog's chrome is English.** Registry and rules strings arrive
  translated; the client's frames around them ("Needs …", "Add … for …",
  "‹Feature› doesn't fit: …") stay English, as every other line of the
  dialog does. Decision 5's "no glued words" is about the read-back, which
  stays whole sentences. Lists inside an English sentence are joined in
  English. Dates are written one way in the whole dialog (`dateWords()`:
  the dialog's language, and for English the style the fields use, "19 June
  2027, 19:00"): the read-back, verdicts, the proof and the fields.
- **A review names what it reviews.** `features()` counts a `Review` or
  `AggregateRating` whose `itemReviewed` is a node of the graph as that
  node's `review` or `aggregateRating`, so a hand-added review of a
  hand-added product gives it a product result. A review of a withheld main
  node has nothing to point at: its reference is left out with the node.
- **Gates hold clean values.** A detail that is never emitted (`billing`,
  `sold_here`) is reported with the value it was validated as, so a linked
  " P1M" bills and "yes " sells.
- **A site save names its effect for the currency only.** The identity's
  name, kind and logo reach every page by design and are named in Site
  itself; listing every page for them would say nothing. A content type
  whose currency is unset or linked to a field is one place ("Every
  Product"): it follows the site currency wherever the field is empty.
  Pages are read 50 at a time and only 25 are named. The bar says how many
  places; the Currency field names them and what may change, since the bar
  holds two lines beside its buttons.
- **A stored code is never lost without a word.** A three-letter currency
  typed before the list of codes ("RMB") is kept when read, so the graph
  reports it as dropped and the field shows it; anything else that was never
  a code is dropped on read, as before.
- **The name-is-title hint is for pages.** At template scope a product named
  after each item's own title is right, so neither the field nor Checks asks
  for another name there. On a page, the hint carries "Edit in Search" while
  the name follows the title.
- **Billed stays in More details.** The four facts shown first stay Price,
  Currency, Bought on this page and Image. A price the page shows per month
  or year leads to Billed instead: its "Couldn't find … as a one-time price"
  row jumps there and says to set it.
- **Output's headless line is unchanged.** The clause about markup that
  scripts add later is not part of this change; it belongs with
  `complete-the-headless-frontend`.
- **The kinds sheet's confirm is a bar at its foot**, in sight wherever the
  list is scrolled, and focus starts on the chosen kind.
- **The proof says facts in the field's words**: the image by its media
  name, the currency by its name, "Bought on this page" with its answer.

### 12. Settled in review (round 2)

- **A withheld main node is proved by its own values.** Its verdict is
  judged as `extra` (decision 10); the proof reads the node the report keeps
  under `withheld.node`, so only the fact that is truly missing says "Not
  set". The read-back stays a web page: it says only what ships.
- **The site currency fills a price, never an offer of nothing.** It is
  applied only when the offer's price resolved; a service without a price
  has no `offers`, so a currency change reaches exactly the places
  `effect()` names.
- **The kinds sheet's confirm is its foot, outside the scroller**, so it
  never covers the chosen kind. In a frame too short for both (at most 320
  px high) the sheet scrolls as one and the confirm follows the list. Its
  sentence is announced through a status region of its own; the buttons are
  not part of it.
- **Focus is placed, never dropped.** A proof opens on its title (not on an
  action Enter would run unseen) and wears the dialog's ring though it is
  portaled; leaving a hidden item out from the stage keeps focus on the
  stage's line; Undo returns to the control focused before the bar; a fix in
  Checks moves on within its own group. A line is announced when its words
  change or it comes, never because the stage was drawn again.
- **A fix is named after what it sets** ("Add City", "Choose Image",
  "Answer Bought on this page"), as the proof's buttons are.
- **No match line when nothing is set here.** A page that sets no facts and
  no JSON-LD of its own has nothing to compare with the page: a line saying
  so was noise (review round 3).
- **Read-only means at rest.** With nothing to preview, a linked or
  defaulted value's box and the title ending are text, with no menu and no
  link button.
- **`@type` is one string.** `Values` refuses a list, so the graph and the
  dialog handle only strings (a list belongs to `extend-structured-data-by-id`,
  which brings it in with its own validation).
- **Currency lives in Site's own "Prices" group**, after Sharing.

## Data model

| Where | Key | Change |
|---|---|---|
| `schema` (page, template) | `type` | unchanged; new id `Service` |
| | `props` | new keys `billing`, `sold_here`, `organizer`, `worksFor`; `offers_priceCurrency` of kind `currency` |
| | `skip` | new: list of hand-added items' `@id`s |
| `canvas_metatag.site` | `currency` | new: an ISO 4217 code or empty |

## Migration Plan

No stored value is converted. Existing products have no `billing` and no
`sold_here`: they read "for ‹price›" and "Only if people buy it here". A
three-letter currency typed before the list of codes is kept and reported as
dropped (decision 11); anything else that was never a code is dropped on
read, as today. The site currency starts empty; no update guesses it.
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
  the UI; a CI job that is allowed to fail warns after 120 days (it never
  fails the pipeline).
- [Parity false positives on prices] → only numbers next to a currency; a
  "check again" action; never auto-deleting.
- [A sentence reads wrong in a language] → whole-sentence variants; the fact
  list when untranslated.
- [Verdicts lag while typing] → the stage dims and sets `aria-busy` during a
  draft write; refreshes about a second after the last edit.
