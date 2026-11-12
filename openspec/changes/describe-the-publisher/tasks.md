# Tasks

Needs `rethink-structured-data`, `read-page-components` and
`add-home-page-defaults`.

## 1. Identity depth

- [ ] 1.1 Config schema and `Values` rules for `site_name`, `description`, `email`, `telephone`, `address`, `opening_hours`, `subtype`. Verify with `ValuesTest` (an address without a country refused; hours in order; unknown subtype refused) and `ApiTest::testSite`.
- [ ] 1.2 `SchemaGraph` identity and website nodes: subtype, contact details, `PostalAddress`, `openingHoursSpecification`, website name from `site_name`. Verify with `SchemaGraphTest` (a Store; a separate site name; output unchanged when the new keys are empty).
- [ ] 1.3 `local-business` rules entry, regenerated strings. Verify with `SearchFeaturesTest` (store with and without hours; organization not evaluated).

## 2. Linked identity

- [ ] 2.1 `{component: …}` identity values for region and front page sources, read through `Sources`, with profile ticks; `data/profile-hosts.json`; same-site, same registrable domain and `mailto:` never offered as profiles. Verify with a new kernel `IdentityLinkTest` (footer with four links: two ticked, partner unticked, `/privacy` absent; email from `mailto:`).
- [ ] 2.2 Derived identity cache under `canvas_metatag:identity`, recomputed on front page update and invalidated only on change; heads carry that tag and not the front page's. Verify with `IdentityLinkTest` (hero edit keeps `/pricing` cached; footer link edit invalidates it) and `CoupledHeadTest` (tags of a head).
- [ ] 2.3 ARCHITECTURE.md §11 row for the front page update hook. Verify the row names its `IdentityLinkTest` case.

## 3. Site view

- [ ] 3.1 Publisher stage with sentence and verdict lines; identity fields; link menu with ticks; legal name proposal; "Save and apply" with the effect from `putSite`'s dry run. Verify with Playwright `site.spec.ts` (sentence, Site name and Logo lines, ticks, Use it for the legal name, the save bar's effect).
- [ ] 3.2 Profile drift row in Checks for administrators. Verify with `checks.test.ts` and Playwright `site.spec.ts` ("Use the footer's profiles" links Profiles).

## 4. Docs and the site

- [ ] 4.1 README (the publisher, linking to the footer, what a profile is); ARCHITECTURE.md §7, §13, §17. Verify with the cspell CI job.
- [ ] 4.2 Run every suite as in `rethink-structured-data` 8.2 plus the Canvas contract job. Verify all are green.
- [ ] 4.3 Browser check on the farm site: Site stage, linking Profiles to the footer with ticks, a local business with hours, the save bar, the drift row. Save a screenshot of each.

## Workflow follow-up

- Archive after `add-home-page-defaults`, `rethink-structured-data` and
  `read-page-components`.
- Review `data/profile-hosts.json` with the rules file's yearly review.
