# Tasks

## Conventions

Playwright lives in `tests/e2e/`, vitest next to the source in
`extension/src/`. On the farm, run one browser suite at a time: one engine per
`playwright test` run, the next only after it ends. Screenshots and run links
go on the merge request.

## 1. Engines

- [ ] 1.1 Add `E2E_ENGINES` to `playwright.config.ts` (design D1): today's projects per engine, Chromium unprefixed, `firefox:` and `webkit:` prefixes, `deviceScaleFactor: 1`. Strip the prefix in `fixture.ts` before reading `FLAGS`, list the variable in its header, and add the `install:engines` script. Prove it with `npm run typecheck`, `E2E_ENGINES=chromium,firefox,webkit npx playwright test --list` showing the prefixed projects beside today's unchanged names, and an unchanged full Chromium run.
- [ ] 1.2 Run the smoke set in Firefox on the farm, then in WebKit. Prove it with both runs green, or each failure triaged under 5.1.

## 2. CI tiers

- [ ] 2.1 Turn the `playwright` job into a `.playwright` template run by `playwright` (every suite, Chromium) and `playwright (engines)` (Firefox and WebKit: the smoke set on browser-facing paths, every suite on a schedule or a manual run), as design D2 says, with no retries and no allowed failure. Prove it with three pipelines linked in the merge request: a change to `extension/` runs both engine jobs on the smoke set; a PHP-only change runs neither; a manual run runs every suite in every engine.
- [ ] 2.2 Check that the runner image installs WebKit's system libraries. If it cannot, try Canvas's testing image; failing that, run WebKit by hand before a release and say so in the README (proposal, open decision 2). Prove it with the job log of 2.1's manual run.
- [ ] 2.3 Have a maintainer add the nightly schedule on the default branch. Prove it with one green scheduled run, and record each job's measured time in ARCHITECTURE.

## 3. Multilingual seed and suites

- [ ] 3.1 Add `CANVAS_METATAG_E2E_MULTILINGUAL` to `CanvasMetatagTestSetup` (design D3): Finnish and Arabic, the translated and draft-only pages, the Arabic page, translated alt text, translated articles with linked values, and the Arabic component tree override. Mirror it in `constants.ts`, and give `writeDraft()` a language. Prove it with `npm run typecheck`, the `coupled`, `headless`, `ai` and `complex` projects passing unchanged, and 3.3.
- [ ] 3.2 Add the domain variant, `CANVAS_METATAG_E2E_LANGUAGE_DOMAINS`, with Chromium host resolver rules and the test cookie and sign-in per host. Prove it with 3.4, and with the fixture failing with the routing sentence (design D4) when a language host does not reach the site.
- [ ] 3.3 Write `multilingual.spec.ts` M1 to M6 (design D4), with M1 and L2 following the outcome `close-known-limitations` task 4.1 recorded. Prove it with the `multilingual` project green in Chromium, Firefox and WebKit, M3's preview screenshots attached.
- [ ] 3.4 Write `language-domains.spec.ts` L1 and L2. Prove it with the `language-domains` project green in Chromium.

## 4. Accessibility automation

- [ ] 4.1 Add `expectAccessible(page, view)` to `fixture.ts` and replace the axe copies in `access.spec.ts` and `template-complex.spec.ts`. Prove it with one `AxeBuilder` use left in `tests/e2e/`, and both suites green.
- [ ] 4.2 Scan every view (seo-dialog "An automated scan"): in `access.spec.ts` each tab of each scope, each sheet, the scope menu, read-only Site, each notice and a field error; the suggestions tray in `ai.spec.ts`; the Arabic page in M3. Prove it with the smoke set green in all three engines, and a negative control recorded in the merge request: a temporarily unnamed button fails the scan, naming its view.
- [ ] 4.3 Add one `toMatchAriaSnapshot()` per page-scope and site-scope view, one of an open template link menu with its named groups (complete-the-headless-frontend), taken once in link mode and once in add mode, and the composed title of `compose-values-from-fields` with every part present and with one part empty, stored once under `tests/e2e/__aria__/`, dynamic text as regular expressions, Chromium only with the reason in each skip. Prove it with a second run of `--update-snapshots=changed` that changes nothing, and the snapshots reviewed in the merge request.
- [ ] 4.4 Add the forced-colours and reduced-motion test to `access.spec.ts` (seo-dialog "Forced colours" and "Reduced motion"). Prove it green in Chromium, with a negative control recorded: without the forced-colours rules, it fails.

## 5. Triage

- [ ] 5.1 Triage every Firefox or WebKit failure as design D7 says. For each Canvas bug: a draft in `upstream/`, `test.fixme()` for that engine, and one README limitation line. Prove it with the smoke set and a manual full run green, every `fixme` listed in the merge request with its draft.

## 6. Screen readers

- [ ] 6.1 Write `tests/e2e/SCREEN-READERS.md`: the 14 steps of design D6 (13 and 14 for the composer of `compose-values-from-fields`), the two pairs named neutrally and the third pair for steps 13 and 14, and the record to fill in. Link it from the README's Development section. Prove it with a person's review in the merge request.
- [ ] 6.2 Run the first pass with a person at the screen, with both pairs. Prove it with the filled-in record in the merge request (date, module commit, Canvas version, each pair with versions, keyboard setting, each step's result). A failed step 4 is fixed before merging, with `aria-describedby` and a vitest render case, and that step is run again. A failed step 13 or 14 is a blocking follow-up on the composer, as `compose-values-from-fields` D10 says for its own merge check.

## 7. Docs

- [ ] 7.1 In the README's "Known limitations", remove the line "Tested in Chromium on a single-language site. …". Add "Screen readers are checked by hand before each release, not on every change.", plus 5.1's lines and 2.2's, if any. Prove it with a grep of README and ARCHITECTURE for "not tested in a browser" and "Not exercised in a browser" finding nothing.
- [ ] 7.2 Update the README's Development section: the seven projects (replacing "four"), `E2E_ENGINES`, `install:engines`, one engine at a time, the language-host routing sentence, the checklist link.
- [ ] 7.3 Update ARCHITECTURE: the test table (the two language projects, the engine runs, the accessibility additions), the CI paragraph with 2.3's times, a section 11 row for Canvas's prefix redirect pinned by M1, and remove the "Not exercised in a browser" bullet.
- [ ] 7.4 Update `openspec/design-system.md`'s checklist ("Automated accessibility scan clean on every view, in every engine; ARIA snapshots updated with intent") and add the product owner's answers to the open decisions to `openspec/decisions.md`.
- [ ] 7.5 Re-read `upstream/canvas-test-engines.md` against Canvas's current config; keep "Draft — not posted". Run cspell on the changed files, adding the seed's Finnish and Arabic words or a `cspell:disable` block.

## 8. Verification

- [ ] 8.1 Run `openspec validate test-in-every-engine-and-language --strict`, and check that each requirement body is under 500 characters.
- [ ] 8.2 On the farm, run every suite in Chromium, then Firefox, then WebKit, one run at a time. All green apart from 5.1's `fixme`s, and the nightly pipeline green.
- [ ] 8.3 Browser check on the farm site: the Arabic page in the dialog in Firefox and in WebKit, right-to-left previews and `lang` in the inspector, with screenshots. End with `farm-env.sh preview`.
