# Reference: the first rules file and the graph rules

Planning inputs for `data/search-features.json` and the G-rules, distilled
from the structured-data research of 12–13 Nov 2026. "The engine" is the
search engine whose structured data documentation the rules follow; its
guides are named here by title, and each entry's `doc` field carries the
address. Re-read every guide when writing the file and stamp `reviewed` with
that date. Where anything here differs from proposal.md, design.md or the spec
deltas, those win.

## Initial entries

Paths walk the built node and follow `{"@id"}` references inside the graph.
`a|b` means either; a nested list means one of. `on` lists types and their
subtypes explicitly, so nothing depends on a vocabulary at runtime.

| Feature id | Label | `on` | `required` | `recommended` | Rules, `not_for`, `confirm` | Guide |
|---|---|---|---|---|---|---|
| `product-snippet` | Product result | Product | `name`; one of [`offers.price\|offers.priceSpecification.price`, `review`, `aggregateRating`] | `offers.priceCurrency`, `offers.availability`, `offers.priceValidUntil` | Single-product pages; review and aggregator pages are the other use | Product snippet |
| `merchant-listing` | Merchant listing | Product | `name`, `image`, `offers.price\|offers.priceSpecification.price`, `offers.priceCurrency\|offers.priceSpecification.priceCurrency` | `description`, `brand.name`, `sku`, `gtin`, `mpn`, `offers.availability`, `offers.itemCondition`, `offers.hasMerchantReturnPolicy`, `offers.shippingDetails` | `offers.price` `gt` 0; `offers.@type` `is` Offer (not AggregateOffer). `not_for`: `recurring` when `offers.priceSpecification.billingDuration` exists; `several_offers` when more than one Offer at different prices and no ProductGroup; `not_sold_here` when no `offers.seller` resolves to `#identity`. `confirm`: "People can buy this product from you on this page." | Merchant listing; the shopping policy on unsupported content (services, recurring subscriptions) |
| `article` | Article | Article, BlogPosting, NewsArticle | none ("There are no required properties"): verdict `complete` on the recommended set | `headline`, `image`, `datePublished`, `dateModified`, `author.name`, `author.url\|author.sameAs` | One author per entry; dates must match the page | Article; Publication dates |
| `event` | Event | Event | `name`, `startDate`, `location.address` with `location.address.addressLocality` and `location.address.addressCountry` | `location.name` (the guide's table says required, its text recommended: keep recommended), `description`, `endDate`, `eventStatus`, `image`, `offers`, `organizer.name`, `performer.name` | `confirm`: "The event is open to the public." and "The page is about this one event." | Event |
| `profile-page` | Profile page | ProfilePage | `mainEntity.name\|mainEntity.alternateName` | | `confirm`: the page is about one person or organization affiliated with the site; not the home page of a store | Profile page |
| `organization-logo` | Logo | Organization only | a logo of at least 112 × 112 | | Copy says "if search engines can crawl the file" (robots is not checked) | Organization |
| `site-name` | Site name | the `#website` node on the home page | `name`, `url` | `alternateName` | `not_for`: `subdirectory` when the home address has a path ("does not support site names at the subdirectory level") | Site names |
| `faq` | FAQ | FAQPage | | | `retired`, `since` 2026-05-07 (search updates log) | Search updates |
| `how-to`, `sitelinks-search-box`, `special-announcement`, `course-info`, `practice-problem` | | | | | `retired`; a date only where a changelog entry gives one, otherwise "no longer shown" without a date | Search updates |

Later changes add `breadcrumb` (read-page-components), `local-business`
(describe-the-publisher: required `name`, `address`; recommended opening
hours, telephone) and `video` (derive-structured-data-from-components). Image
licence and recipe entries are added only when a type, a component set-up or a
plausible custom node produces them. Each feature costs upkeep: add one when
something the module emits can earn it.

## Graph rules (run over the merged graph)

| Id | Rule | Severity | Basis |
|---|---|---|---|
| G1 | A hand-added node typed Organization, Person, LocalBusiness… whose `name` or `url` equals the identity's and is not `{home}#identity`: "Point to the site's identity instead", showing the full `@id` | improve | The guidelines relate items by `@id`; a second identity splits facts |
| G2 | An `{"@id"}`-only value that resolves neither in the graph nor to an absolute address on another site: "Points to #foo, which isn't on this page" | improve | Hand-added ids resolve against the page address |
| G7 | `aggregateRating` or `review` on the identity, or on an Organization or LocalBusiness node it controls | to fix | Review snippet: reviews an entity controls about itself are ineligible. An employer rating of another company is not flagged |
| G9 | Unknown stored kind: reported as `unknown_type`, output stays a web page, Checks explains | improve | |
| G10 | A relative address in a hand-added node's `url`, `image` or `sameAs` | improve | |

Retired features in hand-added JSON-LD are "Good to know" (gray), from the
rules file. A nested node typed `Thing` is a CI lint, never a runtime check
("Don't use the `Thing` type").

## Guides the rules rely on (by title)

Structured data general guidelines (visible content, true representation,
required properties, no guarantee); search gallery (which features are live);
search updates log (FAQ results not shown since 7 May 2026; other
retirements); product snippet; merchant listing (image required, price above
zero, the merchant is the seller, only pages where a shopper can buy, the
plain `offers.price` is used, markup in the initial HTML); the shopping policy
on unsupported content; generating structured data with JavaScript; article;
event; profile page; organization; site names; review snippet; publication
dates; AI features ("no special schema.org structured data" is needed).
