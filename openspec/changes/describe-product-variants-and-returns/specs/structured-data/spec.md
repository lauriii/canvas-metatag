## ADDED Requirements

### Requirement: Product variants are described on each variant's page

On a template, a product with a family MUST add a `ProductGroup` at
`{url}#group` with the family's name, code and dimensions, and `hasVariant`
holding this page's product by `@id` and each other variant by URL only. The
product MUST point back with `isVariantOf`. A sibling whose family code
differs, or the page itself, MUST be left out of `hasVariant`.

#### Scenario: Three colours

- **WHEN** the walnut lamp's family is "Oak desk lamp" (ODL-100), varies by colour, with ash and oak siblings
- **THEN** `{url}#group` MUST list `{"@id": "{url}#primary"}` and two products with only their `url`

#### Scenario: A sibling of another family

- **WHEN** one listed sibling's family code is ODL-200
- **THEN** it MUST be left out, and the report MUST count it as dropped with the reason `family`

### Requirement: The return policy is one site node

When the site describes its return policy, the identity MUST reference
`{home}#return-policy` through `hasMerchantReturnPolicy`. The node MUST carry
either the returns page's URL, or the countries, the category, the number of
days when it is a fixed window, and the fees.

#### Scenario: Thirty days, customer pays

- **WHEN** the policy is described for Finland and Sweden, within 30 days, the customer paying
- **THEN** the node MUST carry `applicableCountry` ["FI", "SE"], `returnPolicyCategory` `https://schema.org/MerchantReturnFiniteReturnWindow`, `merchantReturnDays` 30 and `returnFees` `https://schema.org/ReturnFeesCustomerResponsibility`
