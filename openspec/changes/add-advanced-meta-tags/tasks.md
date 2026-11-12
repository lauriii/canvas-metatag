# Tasks

Applies after `link-values-to-fields` (proposal.md, "Dependencies"); groups 1
and 2 may land before it only under the exception stated there. The module stays
working at the end of every group. Run PHPUnit through the farm's `docker exec`
line, Playwright one spec at a time, and `npm run verify` after every client
change. Group 2 needs the product owner's decision on the reopened non-goal
(proposal.md) before it starts. Groups 3 to 6 can follow in any order after
group 1.

## 1. Head groundwork (no visible change)

- [ ] 1.1 `CanvasMetatagHooks::pageAttachments()`: key every `html_head` item by list and position (`canvas_metatag:meta:<n>`, `canvas_metatag:link:<n>`), links still in `html_head`. Verify with a new `CoupledHeadTest::testRepeatedRows` (a test hook adds two rows with one name; both reach the HTML in order; no `Link` header) and the existing `CoupledHeadTest` unchanged and green.
- [ ] 1.2 Add `data/head-tag-policy.json` (owned keys with their control, denied keys and prefixes with reason ids, reason sentences, verification names, crawler names and the AI use crawler, link relations and feed types, refused schemes) and its loader in `Values`, with the hard floor in code. Verify with a new unit `TagPolicyTest`: the file loads, every reason id has a sentence, every owned key has a control, and the floor (elements, attributes, `http-equiv`, `charset`, `itemprop`, refused schemes) holds even when the file says otherwise.
- [ ] 1.3 `hook_canvas_metatag_head_alter` at the end of `Resolver::resolve()` with `invokeAllWith()`, `head.script` restored after it, the structural filter with one log line per request, and the module recorded per added row; document it in `canvas_metatag.api.php`. Verify with a new kernel `HeadAlterTest` and a test module: a `manifest` link reaches `CoupledHeadTest`'s HTML and `HeadlessHeadTest`'s `head.link`; an `onload` row is dropped and logged; an empty meta row and a link to `/feed.xml` are left out; an added script is not emitted; the hook's cacheability reaches the page cache.
- [ ] 1.4 Docs: ARCHITECTURE.md §1 (the hook), §8 (indexed keys), §19 (policy file, hook). Verify with the cspell and PHPCS CI jobs.

## 2. Robots extras and AI use (dated: before 1 Feb 2027)

- [ ] 2.1 Record the product owner's decision on the reopened non-goal in proposal.md and update the README's "What it does not do" line to keep robots.txt and other single crawlers out. Verify by review: the proposal names the decision and its date.
- [ ] 2.2 `Values`: `max_video_preview`, `noimageindex`, `ai_answers`, `ai_training` in the robots cleaner and the per-directive cascade; the same in `model.ts` and `tests/fixtures/text-cases.json`. Verify with `ValuesTest` (accepted and refused values of page-seo's delta) and `model.test.ts` on the shared fixture.
- [ ] 2.3 `Resolver`: the robots order of head-output's delta and one AI use meta tag per directive after robots; `allow`, `false` and -1 emit nothing over a site default. Verify with `ResolverTest::testRobotsExtras` (every scenario of "Robots directives are built from fixed names" and "AI use is one tag per directive"), `CoupledHeadTest` and `HeadlessHeadTest` (the tags in HTML and in `head.meta`).
- [ ] 2.4 Config schema for the four robots keys at site and template. Verify with `InstallTest` and the config schema check in `TemplateDraftTest` (a published template with every new key validates).
- [ ] 2.5 Dialog: the new Advanced rows and the AI use label, note and code line (`SearchTab.tsx`), the same rows in Site › Visibility (`SiteTab.tsx`), the summary parts, the date constant. Verify with vitest for the summary and the note's two texts (before and after the date) and Playwright `page.spec.ts` (set each row, publish, check the head) and `site.spec.ts` (site defaults, a page turning AI training back to Allowed).
- [ ] 2.6 Checks: "AI use is read from 1 Feb 2027" as good to know. Verify with `checks.test.ts` (listed before the date with a non-default value, not listed after it, not counted).
- [ ] 2.7 Docs: ARCHITECTURE.md §4 (robots keys), §6 (cascade), §8 (rows). Verify with the cspell CI job.
- [ ] 2.8 Browser check on site-4: Advanced on a page and a content type, Site › Visibility, the Output rows, Checks; save screenshots next to the mockup frames F01 and F03.

## 3. Metatag tags as the outermost layer

- [ ] 3.1 `Resolver`: when Metatag is installed and the entity is owned, read `tagsFromEntityWithDefaults()` and `generateRawElements()`, turn elements into rows, apply the policy in read mode, leave out owned keys and keys the head carries, drop the layer on a `user` cache context or an exception (logged), add the config tags and bubbled metadata. Verify with `MetatagCoexistenceTest::testPassThrough` (a verification tag and a theme colour in Metatag's global defaults reach an owned page once, in coupled HTML and in `head.meta`; Metatag's `og:image` and an `http-equiv` custom tag do not; Metatag's own output stays silent), `testSiteCodeWins`, `testUserContextDropsLayer`, `testFailureKeepsHead` and `testDefaultsInvalidate`.
- [ ] 3.2 Install message: "Metatag's title, description, robots and social values are no longer used…; its other tags stay and can be turned off in the SEO dialog." Verify with `MetatagCoexistenceTest::testInstallMessage`.
- [ ] 3.3 State: `resolved.sources` for added rows, `metatag` for this layer and `module:<name>` for hook rows; Output lists added rows with their source line. Verify with `ApiTest::testPageState` (sources match `head` positions) and Playwright `page.spec.ts` (Output shows "Metatag module" with Metatag enabled in the sandbox).
- [ ] 3.4 Checks: "‹n› tags come from the Metatag module". Verify with `checks.test.ts`.
- [ ] 3.5 Docs: README "What the module takes over"; ARCHITECTURE.md §10 rewritten and two Metatag rows in §11 pinned by `MetatagCoexistenceTest`. Verify with the cspell CI job.
- [ ] 3.6 Browser check on site-4 with Metatag enabled and a global default set: the page's HTML, Output and Checks; save screenshots.

## 4. Verification codes

- [ ] 4.1 `Values::cleanIdentity()`: `verification` as a list of up to ten `{name, code}`, names from the policy, the code pattern and sentences of site-seo's delta; config schema. Verify with `ValuesTest::testVerification` and `ApiTest::testSite` (422 paths `identity.verification.<n>.code`, a repeated name accepted), and `InstallTest` (an exported identity holds the codes).
- [ ] 4.2 `Resolver`: one meta tag per code after the card hint on every owned route, never elsewhere. Verify with `CoupledHeadTest::testVerification` (two codes for one name; a Views front page untouched) and `HeadlessHeadTest::testVerification`.
- [ ] 4.3 Dialog: Site › Services with the code list, Remove, the paste input, "Which tag is this code for?", the removal bar text and the read-only line; `paste.ts` with `DOMParser` (allowed in `check-patterns.mjs` for that file only). Verify with a new `paste.test.ts` (a whole tag, a bare code, a tag with extra attributes, hostile input) and Playwright `site.spec.ts` (paste, save, see the tag on a page; remove; read-only as an editor in `access.spec.ts`).
- [ ] 4.4 Checks: "Verification codes are not on the home page" for administrators when the front page is not owned. Verify with `checks.test.ts` and `ApiTest` (the state says whether the front page is owned).
- [ ] 4.5 Docs: README (Services, codes on owned pages only), ARCHITECTURE.md §3 and §4. Verify with the cspell CI job.
- [ ] 4.6 Browser check on site-4: Services with two codes, the bar, the page's HTML; save screenshots next to F03.

## 5. Stop date

- [ ] 5.1 `Values`: `expires` for page and template, a date or date and time, "Enter a date.", refused at site; template links to a date source or fact only; config schema. Verify with `ValuesTest::testExpires` and `ApiTest::testWritesFollowTheShownValues` (a text field link refused).
- [ ] 5.2 `Resolver`: `unavailable_after` in robots and `article:expiration_time` for articles, end of day and offset in the site's time zone, an empty link gives nothing. Verify with `ResolverTest::testStopDate` (Helsinki and UTC, linked and empty, web page and article) and `HeadlessHeadTest`.
- [ ] 5.3 Dialog: "Stop showing after" with date and time in Advanced, linkable at template scope, and the search preview's caption suffix. Verify with vitest for the caption text (future, past) and Playwright `template.spec.ts` (link to a date field, publish, check an event's head) and `page.spec.ts` (typed date, caption).
- [ ] 5.4 Checks: a passed stop date to fix with "Remove the stop date", a future one as good to know. Verify with `checks.test.ts`.
- [ ] 5.5 Docs: README (stop date), ARCHITECTURE.md §4 and §6. Verify with the cspell CI job.
- [ ] 5.6 Browser check on site-4: a page with a stop date, an event type linked to its End date with the link menu open, Checks with a passed date; save screenshots next to F01, F02 and F09.

## 6. Other tags

- [ ] 6.1 `Values::tags()` in write and read mode with every rule of other-tags (shape, key pattern, owned with pointer, denied with reason, site-only verification names, relations and feed types, addresses and paths, refused schemes after removing whitespace and controls, 1000 and 2048 limits, 20 rows and 10 per key, `off` only at page and template); config schema `canvas_metatag.tag`. Verify with `ValuesTest::testTags`, a table of every refusal sentence and accepted case, including the look-alike key and the tab-split scheme.
- [ ] 6.2 Cascade per identity (Metatag, site, target; nearest wins with all its rows; `off` removes) and emission after the verification codes and the hreflang links; a path on the public base; linked values left out when empty or hidden. Verify with `ValuesTest::testTagCascade` and `ResolverTest::testOtherTags`.
- [ ] 6.3 Drafts and translations: rows travel in page and template drafts, a refused row keeps the saved one, a new translation starts without rows. Verify with `PageDraftTest::testTags` (refused path `tags.3.key`, translation) and `TemplateDraftTest::testTags` (publish).
- [ ] 6.4 State: `tagPolicy` for every scope. Verify with `ApiTest::testPageState`, `testTemplateState` and `testSite`.
- [ ] 6.5 Dialog: the Other tags row (Advanced, Services), the sheet with this scope's rows, "From the site" and "From the Metatag module" with switches, the hook note and the empty state (`OtherTags.tsx`, `model.ts` row helpers). Verify with vitest for the row helpers and Playwright `tags.spec.ts` (a site row reaches a page; turned off on that page and published; read-only in a conflict).
- [ ] 6.6 Dialog: the row editor (meta or link, name or property with the Open Graph switch, content or address, kind and feed format, the tag line, Done, Remove, an empty row vanishing), refusals with Show and Go to Site. Verify with Playwright `tags.spec.ts` (a template row linked to a field; `og:title` refused, Show lands on Social › Title).
- [ ] 6.7 Dialog: the paste panel and its verdict list with "Add ‹n› tags · ‹m› skipped". Verify with `paste.test.ts` (the mixed snippet of seo-dialog's delta, nothing found, already here, over 20,000 characters, a link with `media`) and Playwright `tags.spec.ts` (paste on a page, add, see the row in Output).
- [ ] 6.8 The edit permission's description names other tags' links. Verify with `ApiTest::testPermissions` reading the description.
- [ ] 6.9 Keyboard and assistive technology: tab order, Escape order (panel, then sheet), switch and row names, the review list as a list, axe on the sheet with a row open and with the paste list, 200 % zoom. Verify with Playwright `tags.spec.ts` keyboard-only and axe tests.
- [ ] 6.10 Docs: README (Other tags, headless note on rendering `head.meta` and `head.link` on the server, the upstream ask for fixed-key frontends), ARCHITECTURE.md §3, §4, §6, §8, §15, §17, §19; `.cspell-project-words.txt`. Verify with the cspell and PHPCS CI jobs.
- [ ] 6.11 Browser check on site-4: the sheet at page, type and site scope, a row open, the paste list, a refusal, Output; save screenshots next to F04 to F08 and F10.

## 7. Integration

- [ ] 7.1 Run every PHPUnit suite and each Playwright project (`host-contract`, `coupled`, `headless`, `ai`) one at a time on site-4; all green. Verify by the run output.
- [ ] 7.2 Compare the final screenshots with the mockup frames F01 to F10 and record any difference in design.md. Verify by review.

## Workflow follow-up

- Archive after `link-values-to-fields` is archived, so that the MODIFIED
  blocks built on its text (head-output, site-seo, value-links) apply in
  order. Archive before `add-home-page-defaults`.
- After archiving, check that `openspec validate --specs --strict` passes.
