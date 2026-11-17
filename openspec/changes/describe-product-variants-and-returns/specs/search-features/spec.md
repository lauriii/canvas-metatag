## ADDED Requirements

### Requirement: Product variants are judged on templates only

Product variants MUST need the family's name and, on each variant, a SKU or
GTIN. On a Canvas page, a product with several prices MUST read "Doesn't fit:
several plans on one product" for merchant listings, with no fix toward
variants.

#### Scenario: A variant without identifiers

- **WHEN** a product with a family has neither a SKU nor a GTIN
- **THEN** "Product variants" MUST read "Needs a SKU or GTIN per product"

### Requirement: A return policy is judged at Site

The return policy feature MUST need either a returns page or the countries
and the category, and the number of days when the window is fixed.

#### Scenario: A fixed window without days

- **WHEN** the policy says "Within a number of days" with countries and no days
- **THEN** "Return policy" MUST read "Needs the number of days"
