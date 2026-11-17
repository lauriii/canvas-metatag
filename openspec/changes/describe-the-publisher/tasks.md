# Tasks

Needs `rethink-structured-data`, `read-page-components`,
`strengthen-zero-config-defaults` and `add-home-page-defaults`; runs after the
last two.

## 1. Identity depth

- [ ] 1.1 Config schema and `Values` rules for `site_name`, `description`, `email`, `telephone`, `address`, `opening_hours`, `subtype`. Verify with `ValuesTest` (an address without a country refused; hours in order; unknown subtype refused) and `ApiTest::testSite`.
- [ ] 1.2 `SchemaGraph` identity and website nodes: subtype, contact details, `PostalAddress`, `openingHoursSpecification`, website name from `site_name`. Verify with `SchemaGraphTest` (a Store; a separate site name; output unchanged when the new keys are empty).
- [ ] 1.3 `local-business` rules entry, regenerated strings. Verify with `SearchFeaturesTest` (store with and without hours; organization not evaluated).

- [ ] 1.4 Logo fallback to the default theme's own logo through the logo rule of `strengthen-zero-config-defaults`, and `slogan` from Drupal's slogan in the page's language. Verify with `SchemaGraphTest` (theme logo as `{home}#logo`; core's logo gives no logo node; slogan present and never the description) and `ResolverTest` (a theme logo path outside the theme refused).

## 1b. The identity description on the home page (moved from `add-home-page-defaults` group 6b)

- [ ] 1b.1 The owned front page's description falls back to the identity description, cut like any derived description, never to the slogan, and no other page gets it. Verify with `ResolverTest` (front page; About page; slogan only) and `HeadlessHeadTest` (same in `head.meta`). (Was `add-home-page-defaults` 6b.3.)
- [ ] 1b.2 The site card's line falls back to the identity description shortened at its first clause when Drupal has no slogan. Verify with `ShareCardTest` (the farm site's description gives "Human expertise that amplifies what your AI agents can do"; a slogan wins; neither gives no line) and `ResolverTest` (the front page named "Home" without a slogan: its `og:image:alt` is "{Site name}: {line}" with that line). (Was the identity-description half of `add-home-page-defaults` 6b.2 and of the site card line in `strengthen-zero-config-defaults`.)
- [ ] 1b.3 Checks on the front page without a description of its own: with an identity description, no "Add a description" and the description field says "From the site's description"; without one, "Add a description" as `add-home-page-defaults` words it. Verify with `checks.test.ts` cases for both. (Was part of `add-home-page-defaults` 6b.4.)

## 1c. Handed over by `populate-every-schema-type` (H2)

- [ ] 1c.1 "At ‹Site›'s address" for a job's workplace: an inline `Place` with the identity's address, offered only while that address has a street or city and a country. Verify with `SchemaGraphTest::testJobAtPublishersAddressEmitsInlinePlace` and Playwright `schema-kinds.spec.ts` (the choice absent without an address, present with one).
- [ ] 1c.2 A profile about the publisher is the identity: a reference to it gives `{"@id": "{home}#identity"}`. Verify with kernel `RefTargetsTest` (a recipe author linking to the publisher's profile).
- [ ] 1c.3 "Same as ‹Site›" in the opening hours sheet once the identity has hours (`WeekEditor`'s `same`). Verify with `controls.test.ts` and Playwright `schema-kinds.spec.ts`.

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
- [ ] 4.3 Browser check on the farm site: Site stage, linking Profiles to the footer with ticks, a local business with hours, the save bar, the drift row; with no slogan and an identity description, the front page named "Home" shows that description in Output and the site card line in the Social preview, and Checks says "From the site's description". Save a screenshot of each.

## Workflow follow-up

- Archive after `add-home-page-defaults`, `strengthen-zero-config-defaults`,
  `rethink-structured-data` and `read-page-components`. The `structured-data`
  and `seo-checks` ("Description rules") blocks here are written on
  `add-home-page-defaults`' text and the `share-images` block on
  `strengthen-zero-config-defaults`' text; if theirs changes before they
  archive, re-derive these blocks.
- Review `data/profile-hosts.json` with the rules file's yearly review.
