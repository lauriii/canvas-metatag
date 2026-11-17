# Tasks

Needs `populate-every-schema-type` and `link-groups-and-pick-pages`
archived. PHPUnit one class at a time; Playwright one spec at a time.

## 1. Product variants

- [ ] 1.1 The `variant` shape and group on templates: Link all parts to Family, varies-by checkbox rows (colour, size, material, pattern), the dimension leaves, siblings URL-only, the family drift guard, "needs a page per variant" without a family reference. Verify with `SchemaGraphTest::testVariantGroupNodeAndSiblingsUrlOnly`, `testVariantSiblingOfOtherFamilyDropped`, kernel `ReachTest` (family drops counted) and fixture `Product.variants.template.json`.
- [ ] 1.2 The "Product variants" feature and the Checks row for a sibling of another family. Verify with `SearchFeaturesTest` (a variant without identifiers) and `checks.test.ts`.
- [ ] 1.3 Playwright `schema-variants.spec.ts`: a template "Product variants · Can show"; a Canvas page with several prices "Doesn't fit".

## 2. The return policy

- [ ] 2.1 Site › Identity › Return policy, shown once something is bought here: a returns page (page picker) or a description (countries, category, days, fees pinned to `FreeReturn` and `ReturnFeesCustomerResponsibility`); the node at `{home}#return-policy`; the save effect. Verify with `ValuesTest` (site rules), `ApiTest::testSiteReturnPolicy`, `SearchFeaturesTest` (a fixed window without days) and Playwright `schema-return-policy.spec.ts`.

## 3. Docs and the site

- [ ] 3.1 README (variants, return policy). Verify with the cspell job.
- [ ] 3.2 Browser check on the farm site: Every Product with variants and Site › Return policy. Save screenshots.
