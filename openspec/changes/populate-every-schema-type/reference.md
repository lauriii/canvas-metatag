# Reference: mockup frames and the kinds of place

Planning inputs for this change from the design rounds of 13–14 Nov 2026
(a structured-data expert's review and a site builder's review were folded
into design.md). Where anything here differs from proposal.md, design.md or
the spec deltas, those win.

## Mockup frames (`mockups/`)

The approved round-2 mockup, drawn at the dialog's width (1000 px wide shots
of a 468 px dialog at about 2×; frames marked "600" are cut at the real 600 px
dialog height, the rest are drawn 800 px tall so a whole view shows). Each
frame carries its own caption and a phase tag above the dialog. The phase
letters were the mockup's own grouping; follow tasks.md for order. Frame
numbers in captions that are not in the folder (P02, P04b, P06, P13b and
others) were left out of the repository. In P04 and P07 the sample venue's
name was painted over with the made-up "Riverside Hall".

| Frame | What it shows | Tasks |
|---|---|---|
| P04 | Event › Venue sheet: a venue page or typed parts in the address shape's order; the street flagged as needed for the event result (no example text in the flagged field); the country picker with the publisher's country suggested | group 3 |
| P05 | Event › Tickets sheet: price and currency on one row (currency starts as the site's), availability in plain words, On sale from only for presale and not-on-sale-yet, where to buy; "Free tickets: price 0." | group 3 |
| P07 | Every Event at 600 px: one When box from a date range field, Venue linked to place pages, performers as profile pages, the reason row under "Can show on 37 of 40" with Show which | 3.11 |
| P09 | Every Recipe: one body with two lists; linking Ingredients asks which list in the link menu's follow-up step; the reason row under 120 of 124; an Also helps row | group 6 |
| P12 | Every Job at 600 px: description linked and filtered, Where the work is through a value map, workplace from location pages, the closed-job line | group 5 |
| P13 | Every Job › link menu: the value-map step, one row per stored value with a Select, preselected by the nearest option, with the gray line on the remote option | group 5 |
| P14 | Every Job › Pay sheet: Amount and Up to, linked and stacked, read exactly from decimal fields; Unlink all keeps the typed currency | 5.5 |
| P17 | Every Product at 600 px: price from a decimal field, three verdicts with their reason row, variants as one line | group 8 |
| P18 | Every Product › Variants sheet: Link all parts to Family, Varies by as checkbox rows, Other variants recommended | 8.4 |
| P20 | A location page: address and opening hours as one-line rows that open sheets, telephone with its check, kind of place and coordinates under More details | group 4 |
| P21 | Opening hours sheet: one row per day with a status Select (Open, Closed, Open 24 hours), a second range on a day, "Same as ‹publisher›" copied once, special days apart | group 4 |
| P22 | Every Location: address linked in one action, hours from an opening-hours field ("all day" reads as open 24 hours), telephone from a telephone field, the Also helps row | 4.4 |
| P25 | Every Course list: an ItemList from a multi-value reference, "Course list · Can show: 4 courses" | 7.2 |

Not committed: the specimen frames (every control kind and its states), the
recipe, course, webinar and video page frames, and frames whose sample
content named a real commercial venue. The words in the specs are the
contract for those views.

## Kinds of place (task 4.3: "the vetted list")

"A place people visit" offers one kind per page or content type, emitted as
`@type`. Plain labels in the dialog; the schema.org name shows only in Output.

| Label | `@type` |
|---|---|
| Store | `Store` |
| Restaurant | `Restaurant` |
| Café or coffee shop | `CafeOrCoffeeShop` |
| Bar or pub | `BarOrPub` |
| Bakery | `Bakery` |
| Hotel | `Hotel` |
| Dentist | `Dentist` |
| Medical clinic | `MedicalClinic` |
| Health and beauty | `HealthAndBeautyBusiness` |
| Legal service | `LegalService` |
| Financial service | `FinancialService` |
| Real estate agent | `RealEstateAgent` |
| Home and construction | `HomeAndConstructionBusiness` |
| Automotive | `AutomotiveBusiness` |
| Sports and fitness | `SportsActivityLocation` |
| Library | `Library` |
| Child care | `ChildCare` |
| Travel agency | `TravelAgency` |
| Other local business | `LocalBusiness` |
| A venue (not a business) | `EventVenue` |

- `EventVenue` earns no business verdict and reads "No search feature".
- **Food kinds** (Restaurant, Café or coffee shop, Bar or pub, Bakery) also
  offer Menu (a URL) and Cuisine. A typed cuisine is one text value ("Thai,
  vegan" stays one string); only a linked multi-value field gives a list.
- The local business feature requires `name` and `address`; recommended are
  `geo`, opening hours, `telephone`, `url`, `priceRange`, and for food kinds
  `menu` and `servesCuisine`. A business with no address customers visit
  cannot meet it honestly: the verdict says it needs an address customers
  visit. Never ask for a home address.
- Only one type per node: the feature allows an array of types, but
  `additionalType` is not supported by it.
