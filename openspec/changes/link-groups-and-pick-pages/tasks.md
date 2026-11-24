# Tasks

Needs `populate-every-schema-type` archived. PHPUnit one class at a time;
Playwright one spec at a time, one worker.

## 1. Link all parts to

- [ ] 1.1 `Sources::fillRows()`: the fields that fill a whole group (an address field; a reference whose target has the parts as separate fields, matched by field type and label). Verify with kernel `SourcesTest` (an address field; the complex fixture's venue: street, postal code, city and country matched; an unmatched part named).
- [ ] 1.2 "Link all parts to" from the group label's link icon and the sheet's first row: the mapping shown first, one draft write, the bar "All ‹n› parts of ‹Group› linked to ‹Source›" with Undo. Verify with Playwright `schema-kinds.spec.ts` on Every Event (Venue linked in one action; Undo restores).
- [ ] 1.3 "Link to ‹Reference› › ‹Field›" in a missing part's guidance and its Checks row. Verify with `checks.test.ts` and Playwright `schema-kinds.spec.ts` (Street address linked alone).

## 2. The page picker

- [ ] 2.1 A search route for pages a reference may pick: published, public, described as an accepted kind. Verify with kernel `ApiTest::testPagePickerRefusesUnpublishedOrUnacceptedNodes`.
- [ ] 2.1a The `{node}` value, moved here from `populate-every-schema-type` (round 3 review): `Values::clean()` accepts `{node: uuid}` on a Place reference at page scope only (a valid UUID, nothing beside it; refused elsewhere); `Resolver::picked()` resolves it among nodes and Canvas pages through `Resolver::target()` (a page visitors may not see is never named; a deleted pick joins the head with the node and Canvas page list tags); the config schema key `canvas_metatag.value.node`; the dialog's tag for it (`keyOf()`, "Chosen page"). Verify with `ValuesTest::testNodeOnlyOnPlaceRefAtPageScope` and kernel `RefTargetsTest::testPages` (a picked venue page is its main thing with its address; a picked page visitors may not see withholds the event).
- [ ] 2.2 On a Canvas page the Venue and Workplace sheets offer "A ‹venue› page" through the picker, storing `{node}`. Verify with Playwright `schema-kinds.spec.ts` (a venue page picked; the sentence names it).

## 3. Readings

- [ ] 3.1 Linked pairs stack; "raw → reading" only when it converts; tags drop a shared parent; box dates in full; the linked group box's tooltip; "First of ‹n›" in a box's tooltip. Verify with a new `extension/src/pairs.test.ts`.

## 4. References and decimals

- [ ] 4.1 Decimal rows one reference hop away, read exactly. Verify with kernel `SourcesTest` (a decimal of a referenced type; `89.990000` → `89.99`).
- [ ] 4.2 A reference's link menu leaves out reference fields whose targets are described as a kind it does not accept. Verify with kernel `ApiTest` (rows carry their targets' kinds) and `values.test.ts`.

- [ ] 4.3 A link menu that hangs above its field and opened with a typed filter (its height measured then) grows again when the filter is cleared, and its "No field matches" line follows the current filter (round 1 UX review, Pay › Per and Closing date). Verify with Playwright `template-complex.spec.ts` (a menu opened by typing, its filter cleared: every row in sight).
- [ ] 4.4 Text menus at template scope offer noise beside the named-first order of `complete-the-headless-frontend` (its round 2 UX review, Every Article): an image's numbers ("Image › Height 1600", "Image › Width 2400") are offered as sources of a title or description, and Body (long text) is the first entry of the Title's link menu. Fold an image's dimensions under "fields that aren't text" in text places, and in a title-like place's link menu list long text after short text; add the value-links scenarios. Verify with `values.test.ts` cases on the article fixture (Height and Width in the fold of the description's menu; Body after the short text fields in the Title's).

## 5. Docs and the site

- [ ] 5.1 README (Link all parts to, the page picker) and ARCHITECTURE.md. Verify with the cspell job.
- [ ] 5.2 Browser check on the farm site: Every Event's venue linked in one action; an event page picking a venue page. Save screenshots.
