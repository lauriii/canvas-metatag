# Tasks

Test paths: kernel tests in `tests/src/Kernel/`, unit tests (`SchemaGraphTest`,
`ValuesTest`) in `tests/src/Unit/`, vitest next to the source in `extension/src/`,
Playwright in `tests/e2e/`. Browser checks run on the farm
site (`http://site-4.ddev.site`), one browser suite at a time, with screenshots
attached to the merge request.

## 1. The front page decision (front-page)

- [ ] 1.1 Add a front page service with the per-language map (design D1): each language's setting (with its config override), query stripped, alias in that language or language-neutral, routed to entity type and id; memoised per request. Prove it with a new `FrontPageTest` kernel test covering a system path, an alias in one language only, one alias with a page per language, a query in the setting, a Views front page, and a language config override.
- [ ] 1.2 Read Canvas's staged homepage update (`canvas_set_homepage`) through the same service and report `target.front` (`current`, `staged`, `leaving`, null) and, at template scope, `target.governs_front` in `/state`; verify with new cases in `ApiTest` (staged page, leaving page, template governing the front node, template not governing it).
- [ ] 1.3 Report the site's home page in the state for Site (entity per language, owned, set by alias, host root or path); verify with `ApiTest` cases for a Canvas page by alias, a Views front page, a base with a path.
- [ ] 1.4 Make `ApiController::anyPage()` use the service and preview an owned front node too; verify with `ApiTest` "front page is a templated node" and the existing "no front page of Canvas" case.
- [ ] 1.5 Re-read `/state` when Canvas's `configuration.homepagePath` changes in its store; verify with a `host.test.ts` case and a `tests/e2e/host-contract.spec.ts` case that fails if Canvas renames or stops updating that store member.
- [ ] 1.6 Add ARCHITECTURE.md §11 rows for the staged homepage update and the store member, and describe the front page decision in §2; verify the contract tests named in 1.2 and 1.5 are listed beside the rows.

## 2. Head output (head-output)

- [ ] 2.1 Strip the request's base URL, script name included, in `publicUrl()`; verify with `ResolverTest` and `CoupledHeadTest` cases requesting `/index.php` and `/index.php/about` with the public base from the request and from `settings.php`, asserting the canonical, `og:url`, hreflang and `@id`s carry no `index.php`, and that a cached `/about` entry is right for both request forms.
- [ ] 2.2 Emit `<front>` only for translations the map counts as the front page; verify with `ResolverTest` "a language the front page setting misses" (Finnish canonical on its own alias, never `/fi`).
- [ ] 2.3 Pick `x-default` from the site default language, else the original; verify with `ResolverTest` "a page created in another language" and the existing unpublished-translation cases.
- [ ] 2.4 Build the front page alternates from the map when the front entity differs by language, with the other members' cache tags; verify with `ResolverTest` "a front page per language" (reciprocal sets on both entities) and an invalidation case when page 9 is unpublished.
- [ ] 2.5 Add the `route_match` tag while the setting is in alias form and `config:language.negotiation` when the language module is enabled; verify with `CoupledHeadTest` "the front page alias moves" and "the default language loses its prefix", and a case asserting no `route_match` tag for a system-path setting.
- [ ] 2.6 Confirm headless parity; verify with `HeadlessHeadTest` cases for `requestUri=/` and `/home` returning the same head, and for a Finnish translation the setting misses.
- [ ] 2.7 Add a post-update that invalidates the `rendered` tag; verify with an `InstallTest` case that runs it and asserts a cached front page is rebuilt.
- [ ] 2.8 Needs `add-advanced-meta-tags` group 3 merged. When the owned translation is the front page in its language, read Metatag's front page defaults into the Metatag layer, with their configuration's cache tag; verify with a `MetatagCoexistenceTest::testFrontDefaults` case (a verification tag only in the front page defaults reaches the front page in coupled HTML and in `head.meta`, no other owned page; editing the front page defaults changes the next request for the cached front page).
- [ ] 2.9 Update README (redirect `/index.php/*` at the server; `x-default` on a redirecting or language-picker root belongs to the frontend or theme; the frontend serves `/` with the front page's head and redirects the alias) and ARCHITECTURE.md §13 and §14; verify the cache table lists the new dependencies of design D5.

## 3. Paged listings keep their page (head-output)

- [ ] 3.1 Detect a Views block with a pager in the page's or the Full template's component tree; verify with `ResolverTest` cases for a page with a paged Views block, one with an unpaged block, one without, and a node whose template holds the paged block.
- [ ] 3.2 Keep the normalised `page` (digits and commas, trailing zeros dropped, all-zero dropped) and add `url.query_args:page` only there; verify with `ResolverTest` cases `?page=2&utm_source=x`, `?page=0`, `?page=0,0`, `?page=0,2`, `?page=abc`, and `/about?page=7` on a page without a pager.
- [ ] 3.3 Verify caching per page with `CoupledHeadTest` "cached per page" (two pages, each a second-hit cache hit with its own canonical) and headless with a `HeadlessHeadTest` case for `requestUri=/?page=2`.
- [ ] 3.4 Add the ARCHITECTURE.md §11 row for reading the component tree's block plugin and the Views pager option, with a kernel contract case in `ResolverTest` that fails if the stored shape changes; add the README line on frontends that paginate with their own parameter.

## 4. Structured data and the identity (structured-data, site-seo)

- [ ] 4.1 Add the identity's alternate names (up to five, ordered, plain text, at most 255 characters, no repeat of the name or of each other, same in every language) to the config schema and `Values::cleanIdentity()`; verify with `ValuesTest` cases for order, blank entries, a repeat ("This is already the site's name."), a sixth name, and older configuration without the member.
- [ ] 4.2 Emit `alternateName` on the identity and the website on every owned page; verify with `SchemaGraphTest` "alternate names" and "no alternate names".
- [ ] 4.3 Pass `front` from the service into `SchemaGraph::build()` and emit `about` → `{home}#identity` on the front page node only; verify with `SchemaGraphTest` and a `ResolverTest` case for both translations of the front page, a Finnish translation the setting misses, and a staged page before publishing.
- [ ] 4.4 Add the alternate names field to Site › Identity, with the existing save and validation; verify with a `model.test.ts` case for the save body and `tests/e2e/site.spec.ts` (add, reorder, refused repeat), then check it in the browser on site-4 and attach screenshots.

## 5. Checks (seo-checks)

- [ ] 5.1 Add the vague-word data file keyed by language and the front page title rule (page name, bare title and shared title; replaces "Make the title specific" at home; first action leads to Canvas's page title; node wording); verify with `checks.test.ts` cases for "Home", a brand-only title, Finnish "Etusivu", a word vague only in another language, a vague shared title only, and a node home page.
- [ ] 5.2 Grade "Show your home page in search" by source (page, type, default-language version, site layer: fix; configuration override only: improve; staged: fix with the staged sentence); verify with `checks.test.ts` cases for each source and for a never-published page.
- [ ] 5.3 Add "Your home page sends search engines to another address" (fix, exact comparison, Remove for the target's own value), text previews off and links not followed on the home page (improve, replacing the general rows); verify with `checks.test.ts` cases including an `http` override on an `https` base.
- [ ] 5.4 Add the address rules (alias-form setting with a changed draft alias; a language with a published translation but no front page) with the permanent address for administrators and the sentence for others; verify with `checks.test.ts` cases for both rules, a system-path setting, and an editor without site configuration permission.
- [ ] 5.5 Add the prefixed default language rule only for path-prefix negotiation of the content language; verify with `checks.test.ts` cases for an `en` prefix and for domain negotiation (with the negotiation facts served by `/state`, covered by an `ApiTest` case).
- [ ] 5.6 Add the listing rules (Product; Article and its kinds), the home description detail, the share image row and the site name row (default-language name without overrides; translated names; administrators only); verify with `checks.test.ts` cases for each, including "same name in another language" listing nothing.
- [ ] 5.7 Judge the governed front node at template scope for the visibility rules, and add the shared-settings row; verify with `checks.test.ts` cases using `governs_front`, and `tests/e2e/template.spec.ts` turning off "Show in search results" on the template while previewing another node, then check it in the browser on site-4 and attach screenshots.
- [ ] 5.8 Verify the home page Checks end to end with `tests/e2e/page.spec.ts` on a Canvas home page named "Home" (one improve row "Say what the site offers"; renaming the page clears it and changes `og:title`), then check it in the browser on site-4 and attach screenshots of the Checks sheet before and after.

## 6. Dialog and Site (seo-dialog, site-seo)

- [ ] 6.1 Show "Home page" in the caption and the scope menu, the staged and leaving captions, and the template preview caption; verify with `tests/e2e/page.spec.ts` cases (home page, staged through Canvas's "Set as homepage", leaving) and `tests/e2e/template.spec.ts` (previewing the home node), then check it in the browser on site-4 and attach screenshots.
- [ ] 6.2 Remove the `pathname === '/'` guess from `Previews.useAddress()` and use the home address from the state; verify with `tests/e2e/page.spec.ts` cases for a Finnish home page and a public base with a path, then check the search preview in the browser on site-4 and attach a screenshot.
- [ ] 6.3 Make the home page sentences conditional on host root vs path and on a frontend origin; verify with `tests/e2e/page.spec.ts` cases using a `settings.php` public base with a path and a configured frontend, then check them in the browser on site-4 and attach screenshots.
- [ ] 6.4 Add the read-only "Home page" row to Site (owned page, set by alias, listing, node, language without a home page) with actions gated on site configuration permission; verify with `tests/e2e/site.spec.ts` cases for each state and `tests/e2e/access.spec.ts` for a user who may administer SEO settings but not site configuration, then check it in the browser on site-4 and attach screenshots.

- [ ] 6.5 When the public base comes from the request, Site settings tells administrators, once and in plain words, that each address visitors use (for example http and https) points at itself, and how to set one public address in the settings file; Output's "About addresses" keeps naming the source. Verify with Playwright `site.spec.ts` (shown with no public base set, absent with `canvas_metatag_public_base` set), then check it in the browser on site-4 and attach a screenshot. (Recorded by `harden-template-scope`.)
- [ ] 6.6 [delta rebase] [blocks this change's gate: archive `harden-template-scope` first, then do this before archiving here] Rebase this change's `seo-checks` block "Checks describe the page or template being edited" onto the second `harden-template-scope`'s text: at template scope the Checks sheet names the previewed node once, on one line, and issue sentences say "this ‹type›" (scenarios "A template is checked against its preview", "A very long node title", "A template that is hidden from search" ("Show this article in search", kept beside this change's "Show your home page in search"), "A value empty for the previewed node" and "Shown in search, not saved yet"; this change's own block, whose detail "MUST name 'Hello world'", gives way to them); the front page rules keep naming the front node ("This also applies to your home page Welcome."). Verify with `openspec validate add-home-page-defaults --strict` and `checks.test.ts` (a template rendering the front page: "this article" in the detail, the front node's name only in the home page sentence). (Recorded by `harden-template-scope`, second round.) The block was rebased onto that text before `harden-template-scope` archived (2026-11-15), within the 500-character limit for requirement text; check it against the archived text and keep every scenario.

## 6b. A vaguely named front page (after `strengthen-zero-config-defaults`)

The front page's fallback to the identity description, and the identity description as the site card's line, moved to `describe-the-publisher` (its group 1b), which runs after this change and adds that description.

- [ ] 6b.1 Title and `og:title` of a vaguely named owned front page (design D10): the Site name, plus the separator and Drupal's slogan when set; a real name unchanged; a title or social title of its own unchanged. Verify with `ResolverTest` cases ("Home" without and with a slogan; "Etusivu" on the Finnish front page; "Industrial pumps for breweries"; a social title set; a page named "Home" that is not the front page keeps "Home").
- [ ] 6b.2 The site card for such a front page when its chain ends at a card, with Drupal's slogan as its line when set. Verify with `ResolverTest` (the `og:image` address is the site card's; its `og:image:alt` is "{Site name}: {line}") and `ShareRouteTest::testSiteCard` from `strengthen-zero-config-defaults` (the fetched PNG is 1200 × 630).
- 6b.3 Moved to `describe-the-publisher` task 1b.1 (the front page's description falls back to the identity description, never the slogan).
- [ ] 6b.4 Checks wording: "Say what the site offers" detail, the site card row. Verify with `checks.test.ts` cases for each. ("From the site's description" moved to `describe-the-publisher` task 1b.3.)
- [ ] 6b.5 Browser check on site-4 with the front page named "Home": the Social preview shows the site card, Output shows the title "Humanify Studio", Checks lists "Say what the site offers"; rename the page and see the page card and title change. Save screenshots.

## 7. Integration

- [ ] 7.1 Run the whole PHPUnit suite (kernel and unit), vitest and the Playwright suites touched above on site-4, one browser suite at a time; verify all pass and the extension build is current.
- [ ] 7.2 On site-4, with `page.front` = `/home`, check by anonymous requests that `/`, `/home`, `/index.php` and `/index.php/home` carry the canonical `http://site-4.ddev.site/`, that the front page graph has `about`, and that a second request is a page cache hit; record the output in the merge request.
- [ ] 7.3 Confirm `openspec validate add-home-page-defaults --strict` passes and that nothing in the change names a commercial vendor or product.

## Workflow follow-up

- Archive after `link-values-to-fields`, `add-advanced-meta-tags` and `strengthen-zero-config-defaults` (group 6b uses the site card). Archive before `describe-the-publisher`, which modifies this change's `seo-checks` block "Description rules" and its `structured-data` block, and adds the front page's fallback to the identity description. This change's blocks for `seo-checks` "Title rules" and `site-seo` "Without a page in context, site settings preview a published page" are written on `link-values-to-fields`; its block for `site-seo` "The identity says who runs the site" modifies a requirement `add-advanced-meta-tags` adds. If either change's text changes before it archives, re-derive these blocks from its archived text.
- `add-advanced-meta-tags` records in its design that its open question on Metatag's front-page defaults is answered here (task 2.8).
- Archive after review; verify the archived specs.
