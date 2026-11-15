# Tasks

Needs `link-values-to-fields` and `rethink-structured-data` merged; archive
right after `rethink-structured-data`. The module stays working at the end of
every group. PHPUnit runs one class at a time through the farm's `docker exec`
line; Playwright runs one spec at a time, one worker. AI tests use the
echo/test providers only and fail if any other provider is called.

## 1. Registry, scopes and the coverage contract (no visible change)

- [ ] 1.1 Registry: `$shapes` and `groups` (replacing `nested`, same flattened keys), `scopes` with reason keys, `emit` on every enum (default `url`), and `SchemaGraph::types()` expansion and `offered()`. Verify with a new unit `RegistryTest`: every attribute has its reader, every enum has a valid `emit`, `say` slots resolve, `requires` and `pair` name existing leaves, every `use` names a shape, no group under a list, `scopes` reasons are known. Existing `SchemaGraphTest` stays green (no output change).
- [ ] 1.2 Spikes kept as kernel contract tests: `datetime` and `daterange` fields for date slots; `office_hours` as an object shape; address parts through one reference hop; `link`, `email` and `telephone` fields for url and text slots. Verify with a new kernel `SourcesSpikeTest`; record each result in ARCHITECTURE.md §17, and add rows (as for decimals) for any field Canvas misses.
- [ ] 1.3 The coverage contract: a new unit `CoverageContractTest` (every prop offered on a scope has a non-JSON route there; every feature-required path is offered wherever its type is; a fixture exists per offered type and scope) and a new `extension/src/coverage.test.ts` (every offered prop has a control and every linkable kind a link-menu filter; the fixture list matches). Verify both fail on a deliberately unroutable prop, then pass.
- [ ] 1.4 Graph fixtures harness: `tests/fixtures/graphs/<type>.<scope>.json` (values, context, expected graph and verdicts) and a new unit `PopulateEveryTypeTest` that builds each with empty `custom` and `extend` and checks emitted values against each feature's value rules in `data/search-features.json`. Add fixtures for today's types (WebPage, AboutPage, ContactPage, CollectionPage, Article, BlogPosting, NewsArticle, Event, Product, Service, ProfilePage; page and template each). Verify with the test green.
- [ ] 1.5 Value rules in `data/search-features.json` (accepted codes, types and formats per feature) and the verdict rule that a fact with an unaccepted value counts as missing. Verify with `SearchFeaturesTest::testUnacceptedValueIsMissing` (a hand-added remote job with `jobLocationType` "Remote").
- [ ] 1.6 Move the unknown-type examples from `Recipe` to `Movie` in rethink's tests (`SchemaGraphReportTest`, Playwright `schema.spec.ts` unknown kind). Verify both green.

## 2. Lists, references and enum emission (phase A, server)

- [ ] 2.1 `list`: `Sources::evaluate()` keeps every item on list props; one long text splits at `<li>`, else `<p>`, else lines; short single values are disabled with their reason; identity-like lists deduplicate, text lists keep repeats; `max`. Verify with new unit `NormaliseTest::testHtmlListItemsSplit` and kernel `SourcesTest` (all items with "All n"; one body gives its items; a short field disabled) and `SchemaGraphTest::testListEmitsEveryItemInOrder`, `testListDropsEmptyAndOverMax`, `testTextListsKeepDuplicates`, `testIdentityListsDropDuplicates`.
- [ ] 2.2 `Values::clean()`: typed codes on enum lists, one value on url, image and ref lists, refusal on text lists, `link_only` props and anything `offered()` excludes. Verify with `ValuesTest::testTypedListOnlyOnEnumListAndOneOnUrlImageRef`, `testTextListAndLinkOnlyRefuseTypedValues`, `testNotOfferedOnScopeRefused`.
- [ ] 2.3 `ref`: `{fact: identity}`, `{node}` on Place refs at page scope, `Resolver` targets (ancestor map, profile main entity or `#identity`, `inline` address, tags, no render), absolute ids, `refs_inline` and `defaults[]` in the report. Verify with unit `SchemaGraphTest::testRefIdentityAndTargetAndInlineFallback`, `testAbsoluteIdsOnly`, `testPageDefaultPublisherReported`, `ValuesTest::testIdentityFactOnlyOnRefAndNodeOnlyOnPlaceRefAtPageScope`, and a new kernel `RefTargetsTest` (published profile → `@id`; unpublished → name; another kind → name; a Restaurant venue accepted as a Place; Person and Organization profiles; a profile about the publisher → `#identity`; a per-item main-entity choice → name with `unknown_kind`; per-target address; tags joined).
- [ ] 2.4 `emit`: url, code and `@type`. Verify with `SchemaGraphTest::testEnumEmitsCodeUrlOrType`.
- [ ] 2.5 Decimal rows for number slots, on the bundle and one hop, read exactly. Verify with kernel `SourcesTest` (decimal rows on number slots only, `89.990000` → `89.99`) and a new kernel `SourcesDecimalContractTest` that fails when Canvas starts matching decimals; add the row to ARCHITECTURE.md's Canvas-internals table.
- [ ] 2.6 Lists and refs on today's types: Article `author` (ref list) and `image` (list), Profile `sameAs` (url list) and `worksFor`, Product `image` (list), Event `organizer` and (template only) `performer` with the people-or-groups choice. Update their fixtures. Verify with `PopulateEveryTypeTest` and `CoverageContractTest`.
- [ ] 2.7 Docs for this group: ARCHITECTURE.md §7 (lists, refs, emit, scopes, the report members) and §17 (new tests); README (lists come from multi-value fields; the narrowed "repeating structured data" non-goal line, PO decision 3). Verify with the cspell and PHPCS jobs.

## 3. Groups, sheets and the link menu (phase A, client and Event)

- [ ] 3.1 Groups in `build()`: `requires`, `incomplete`, required groups withhold, `suggest` never emitted; shapes address, money, geo, venue, tickets (Presale → `PreOrder`, Not on sale yet → `validFrom` only). Verify with `SchemaGraphTest::testGroupIncompleteIsDroppedAndReported`, `testRequiredGroupWithholdsMainNode`, `testCountryCodeEnumEmitsCode`, `testCountrySuggestionNeverEmitted`, `testTicketsPresaleIsPreOrderAndNotOnSaleHasNoAvailability`, `testWhenSkipsProp`.
- [ ] 3.2 `fillRows()` and "Link all parts to": one draft write for every leaf (and the ref leaf), from the label's link icon and the sheet's first row; the bar copy with Undo. Verify with kernel `SourcesTest` (`fillRows` for an address field and a one-hop venue reference) and Playwright `schema-event.spec.ts` (template venue linked in one action; Undo restores).
- [ ] 3.2a "Link all parts to" also offers a reference whose target keeps the address in separate fields: it shows the proposed part → field mapping (by field type and label) before writing, links the confirmed parts in one draft write and names the unmatched ones; a missing part a reference can fill offers "Link to ‹Reference› › ‹Field›" in its guidance and in Checks. Verify with kernel `SourcesTest` (`fillRows` on the complex fixture's venue: street, postal code, city, country matched) and Playwright `schema-event.spec.ts` (Every Event: Venue linked in one action from separate fields; the Street address guidance links it alone).
- [ ] 3.3 Summary field and sheet: the formatted line, "Reads as" as a plain status line, parts in shape order, Clear or Unlink all, focus to the title and back; the linked group box key map. Verify with a new `extension/src/boxKey.test.ts` (Enter, Space, Alt+↓ open; Backspace and printable keys do nothing) and Playwright `schema-event.spec.ts` (Escape returns focus to the Venue box; Backspace on the linked box changes nothing).
- [ ] 3.4 The ref select ("‹Site› (this site)", "A ‹venue› page", "Someone else" with Name and Website) and the single-value page picker (published, public, accepted kinds), with its search route. Verify with kernel `ApiTest::testPagePickerRefusesUnpublishedOrUnacceptedNodes` and Playwright `schema-event.spec.ts` (a venue page picked; the sentence names it).
- [ ] 3.5 Code picker and checkbox rows: filter by label, code and English name; suggested rows; multi toggles announced with the new total; max; six-or-fewer choices inline. Verify with a new `extension/src/picker.test.ts` and Playwright `schema-event.spec.ts` (country picker by keyboard).
- [ ] 3.6 Link menu: Suggested group for list props, "All n, in order", "Each list item, in order", "One value, not a list", the "This site" row, "Not set" for an unanswered publisher on templates; flip above under 200 px. Verify with `extension/src/checks.test.ts` additions and Playwright `schema-event.spec.ts` (Organizer reads "Not set" on a new type; the menu offers the publisher first).
- [ ] 3.7 Linked pairs stack; "raw → reading" only when it converts; tags drop a shared parent; box dates full. Verify with a new `extension/src/pairs.test.ts`.
- [ ] 3.7a `controlFor()` and the controls it returns (summary field, ref select, page picker, code picker, checkbox rows, duration box, week) take a shape and attributes, never a registry key, so `extend-structured-data-by-id` can reuse them. Verify with a new `extension/src/controls.test.ts` that renders each control from a shape and attributes alone, with no registry loaded.
- [ ] 3.8 Only what the scope can fill: facts and Also helps lines filtered by `offered()`; More details names an untouched default first. Verify with `extension/src/readback.test.ts` additions (list formatting, address line with country name, pay range) and Playwright `schema-event.spec.ts` at 468 × 600 (the first fact's label visible without scrolling).
- [ ] 3.9 Event fixtures (page: typed dates, venue page, one ticket type; template: dates from a date range, venue in one action, performers) reach "Event result · Can show". Verify with `PopulateEveryTypeTest`, `CoverageContractTest`, axe on the venue sheet and picker, and the venue sheet at 350 px height and 200 % zoom in `schema-event.spec.ts`.
- [ ] 3.10 Docs: README (the Event venue, Link all parts to, the page picker); ARCHITECTURE.md §17. Verify with the cspell job.
- [ ] 3.11 Browser check on the farm site: an event page (venue sheet, country picker, a venue page) and Every Event (venue linked in one action, performers). Save screenshots.

## 4. A place people visit (phase B)

- [ ] 4.1 `hours` kind: the grammar shared by PHP and TS (`tests/fixtures/hours.json`), grouping, dated entries apart and without days, 24 hours, past dates pruned; `office_hours` rows behind `moduleExists()`. Verify with `SchemaGraphTest::testHoursGroupsWeeklyDaysAndKeepsDatedApart`, `ValuesTest::testHoursLiteralValidation`, `NormaliseTest` (`office_hours` items), and a new `extension/src/hours.test.ts` (round trip, overlap refused, a new week all closed, "Use for Tue–Fri" once Monday has both times).
- [ ] 4.2 The week sheet: status select named "‹Day› status", no prefilled times, "+" for a second range, special days, "Same as ‹Site›" when the identity has hours; times wrap below 440 px. Verify with Playwright `schema-place.spec.ts` (keyboard path; `locale: 'en-US'` without overflow at 468; axe; 350 px and 200 %).
- [ ] 4.3 The type: kinds of place (the vetted list plus "A venue (not a business)" → `EventVenue`), address, geo with named halves, telephone and coordinates checks (`Values::check()`), price range, menu and cuisine for food kinds. Verify with `ValuesTest::testChecks` (GTIN, phone, coordinates, short), `SearchFeaturesTest` (a venue reads "No search feature") and fixtures `LocalBusiness.page.json`, `LocalBusiness.template.json`.
- [ ] 4.4 Docs and browser check: README (a place people visit), ARCHITECTURE.md §17; on the farm site a location page (address, hours sheet) and Every Location (address in one action). Save screenshots.

## 5. Job posting, templates only (phase C)

- [ ] 5.1 `html` and `filterHtml()`: linked only, never typed, never AI; the allow-list; the 20,000-character cut. Verify with `SchemaGraphTest::testJobDescriptionFilteredHtml` (`<script>`, `onclick`, `style`, a `javascript:` and a relative href removed; the allowed elements kept) and kernel `CoupledHeadTest` (one script element that decodes to the graph).
- [ ] 5.2 Workplace: a ref list with each target's address, "At ‹Site›'s address" as an inline Place only when the identity's address is complete, or an address field in one action. Verify with `SchemaGraphTest::testJobAtPublishersAddressEmitsInlinePlace`, `testJobLocationRefListCarriesEachTargetsAddress` (two targets in one city, one without a postal code).
- [ ] 5.3 Pay (`pay` shape, decimal rows, one amount → `value`, From above To dropped and to fix), where the work is (On site, Fully remote, On site or remote), who can apply as a line under it, employment type rows, closing date, the employer answered once. Verify with `SchemaGraphTest::testPaySingleValueAndFromOverTo`, `testItemWrapsHowToStepAndCountry` (the Country half), `SearchFeaturesTest` (a closed job ships and reads "Not shown: this job closed ‹date›"; description equal to the title; remote without countries) and Playwright `schema-job.spec.ts` (workplace from location pages and at the publisher's address; pay sheet; remote with countries).
- [ ] 5.4 Fixture `JobPosting.template.json`; `JobPosting` offered on templates only. Verify with `PopulateEveryTypeTest` and `CoverageContractTest`.
- [ ] 5.5 Docs and browser check: README (job postings are set up on a content type); on the farm site Every Job (workplace menu, pay sheet, a closed job). Save screenshots.

## 6. Recipe (phase D)

- [ ] 6.1 Durations: `unit`, `units`, ISO output, the duration input (empty slots, carry, refuse zero), the unit question on link stored beside the source, `pair`. Verify with `SchemaGraphTest::testDurationEmitsIso`, `testPrepWithoutCookNotEmitted`, `ValuesTest::testDurationIntegerRange`, `testDurationUnitBesideSourceOnly`, and a new `extension/src/duration.test.ts`.
- [ ] 6.2 Instructions as steps or one text, `nutrition` with the yield, `join` for category, cuisine and keywords. Verify with `SchemaGraphTest::testInstructionsStepsFromItemsTextOtherwise`, `testCaloriesNeedYieldAndFormat`, `testJoinTerms`, `testItemWrapsHowToStepAndCountry` (the HowToStep half).
- [ ] 6.3 Checks: prep without cook, a time read as more than a day with "Change the unit". Verify with `extension/src/checks.test.ts` additions.
- [ ] 6.4 Fixtures `Recipe.page.json` (no ingredients or steps offered) and `Recipe.template.json`. Verify with `PopulateEveryTypeTest`, `CoverageContractTest`, and Playwright `schema-recipe.spec.ts` (ingredients from a multi-value field and steps from one body's list items on the template; typed times on a page; no Ingredients field on the page).
- [ ] 6.5 AI: proposals for the new types are plain text only; other facts are counted as "Add it yourself". Verify with kernel `AssistantTest` (the test provider returns a name, a prep time and ingredients; only the name is offered) and Playwright `ai.spec.ts`.
- [ ] 6.6 Docs and browser check: README (recipes); on the farm site Every Recipe and a recipe page. Save screenshots.

## 7. Course and the list page (phase E)

- [ ] 7.1 Course (name, description with the 60-character meter, provider automatic) and the list page's Items (ref list, templates only) as an `ItemList` of public targets in order; the course list verdict counts complete targets only. Verify with `SchemaGraphTest::testItemListCountsOnlyCompleteTargets`, `SearchFeaturesTest` (a course alone; 2 of 5 complete) and fixtures `Course.page.json`, `Course.template.json`, `CollectionPage.list.template.json`.
- [ ] 7.2 Playwright `schema-list-page.spec.ts`: a template list page reads "Course list · Can show: 4 courses". Docs: README (course lists). Browser check on the farm site with a screenshot.

## 8. Product variants and the return policy (phases F, G)

- [ ] 8.1 The `variant` group on templates: Link all parts to Family, varies-by checkbox rows (colour, size, material, pattern), the dimension leaves, other variants URL-only, the family drift guard, the "needs a page per variant" line without a family reference. Verify with `SchemaGraphTest::testVariantGroupNodeAndSiblingsUrlOnly`, `testVariantSiblingOfOtherFamilyDropped`, kernel `ReachTest` (family drops counted), fixture `Product.variants.template.json`, and Playwright `schema-variants.spec.ts` (template "Product variants · Can show"; a Canvas page with several prices "Doesn't fit").
- [ ] 8.2 Return policy at Site › Identity, shown once something is bought here: a returns page (page picker) or a description (countries, category, days, fees pinned to `FreeReturn` and `ReturnFeesCustomerResponsibility`), the node at `{home}#return-policy`, and the save effect. Verify with `ValuesTest` (site rules), `ApiTest::testSiteReturnPolicy`, `SearchFeaturesTest` (a fixed window without days) and Playwright `schema-return-policy.spec.ts`.
- [ ] 8.3 Checks for this group and the earlier ones: incomplete groups, dropped items, over the cap, fallen-back references, pay order, family drops, untouched defaults, a byline that may be several people. Verify with `extension/src/checks.test.ts` (each row and severity).
- [ ] 8.4 Docs and browser check: README (variants, return policy); on the farm site Every Product with variants and Site › Return policy. Save screenshots.

## 9. Integration

- [ ] 9.1 Run every suite: each PHPUnit class touched (unit and kernel), the AI submodule's tests, `npm run verify` (incl. `coverage.test.ts`), the E2E type check, the build-assets check, and each Playwright project one at a time, including the new `schema-kinds` project. Verify all green.
- [ ] 9.2 Publishing hygiene: grep the repository for vendor and product names and for real identifiers (none); `.cspell-project-words.txt` updated. Verify with the cspell job and the grep.
- [ ] 9.3 A first-time walkthrough of Every Event, Every Recipe and Every Job by an independent agent (PO decision 8's substitute for the usability gate), recording the actions each needs and anything unclear. Verify the record exists and every "unclear" item is fixed or filed.


## 10. Findings from the complex-content review

Recorded by `harden-template-scope`. Do these with group 2.

- [ ] 10.1 [2.6] An image detail of the main node (Article `image`, Person `image`, Product `image`) that resolves to the same file as the page image references `{url}#primaryimage` by `@id` instead of repeating an inline `ImageObject`; a different file stays inline. Verify with `SchemaGraphTest` (same file gives `{"@id": "…#primaryimage"}`; another file stays inline) and the updated `tests/fixtures/graphs/*.json`.
- [ ] 10.2 [3.8] A non-list fact linked to a multi-value field says "First of ‹n›" in the menu and in the box's tooltip, so the dialog says that only the first item is used. Verify with `extension/src/checks.test.ts` and Playwright `schema-event.spec.ts`.
- [ ] 10.3 [2.1] The `dynamic-values` block keeps `harden-template-scope`'s archived requirement "Field values are plain values of the first item" whole, every sentence and every scenario (copied from `openspec/specs/dynamic-values/spec.md` as archived): among them the full stop after a heading, list item, definition, table row or caption and after the text before a list or a heading; the marks that spare it, also in CJK (full- and half-width), Arabic, Urdu and Devanagari text, with closing quotes and brackets after them; and text that is not valid UTF-8 giving an empty value. Items split from one long text are not given one. Verify with `ResolverTest` (the heading-and-list scenario) and `NormaliseTest::testHtmlListItemsSplit`. The block was rebased onto that text before `harden-template-scope` archived (2026-11-15), within the 500-character limit for requirement text; check it against the archived text and keep every scenario.

## Workflow follow-up

- Archive right after `rethink-structured-data`.
- At archive, `derive-structured-data-from-components`, `set-up-types-from-templates`
  and `describe-the-publisher` rebase onto this change (design.md
  "Hand-overs" D1–D7, H1–H4).
