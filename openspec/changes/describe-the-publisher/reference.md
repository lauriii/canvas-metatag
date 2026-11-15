# Reference: the local business kinds

The "short list of its kinds" in design.md §3 and "the local business kinds
the module lists" in the site-seo delta. It is the same list that
`populate-every-schema-type` offers as "Kind of place" (without its venue
entry, which is not a business and cannot be the identity), so both changes
read one registry list. Where anything here differs from proposal.md,
design.md or the spec deltas, those win.

| Label | `@type` |
|---|---|
| Organization (not a local business) | `Organization` |
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

Plain labels in the dialog; the schema.org name shows only in Output.

Rules that came with the list (structured-data requirements research,
13 Nov 2026):

- The local business feature requires `name` and `address`; recommended are
  `geo`, opening hours, `telephone`, `url`, `priceRange`, and for food kinds
  (Restaurant, Café or coffee shop, Bar or pub, Bakery) `menu` and
  `servesCuisine`. Ratings and reviews only for sites that review *other*
  businesses.
- A local business is also an organization, so the organization rules (logo,
  name, profiles) still apply to it.
- One `@type` value: the feature allows an array, but `additionalType` is not
  supported by it.
- A business with no address customers visit cannot meet the feature
  honestly: the verdict says it needs an address customers visit and the hint
  suggests "Organization". Never ask for a home address.
- A person identity never carries email, telephone, address, hours or a
  subtype.
- At Site scope a typed cuisine is one text value ("Thai, vegan" stays one
  string); a Site identity has no multi-value field to link.
