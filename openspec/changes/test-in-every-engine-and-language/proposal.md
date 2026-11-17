# Proposal

## Why

The README's last known limitation reads: "Tested in Chromium on a
single-language site. Translations are covered by kernel tests; a multilingual
site, screen readers, Firefox and [the WebKit browser] were not tested in a
browser." (The quote replaces a product name, as nothing committed names one.)

Editors use Firefox and WebKit browsers, right-to-left languages and screen
readers. The dialog relies on what engines do differently: a write sent while
the frame closes, session storage, the clipboard, frame sizing, focus after a
click, `:has()` and native date inputs. Canvas tests its editor in Chromium
only, so nobody finds out when either side breaks in another engine.

`close-known-limitations` fixes the product side of this gap: values carry
their language, and it answers how an editor edits a translation. This change
adds the coverage, then removes the README line.

## What Changes

- **Engines.** One switch, `E2E_ENGINES`, gives every Playwright project in
  Chromium, Firefox and WebKit. Chromium keeps today's project names; the
  others are prefixed `firefox:` and `webkit:`. Every engine pins a device
  scale factor of 1, because the dialog's fit measurements compare pixels.
- **A smoke set** of four spec files, chosen where engines differ:
  `host-contract`, `page`, `access` and `multilingual`.
- **Three tiers.**

  | When | What runs |
  |---|---|
  | Every push and merge request | Every suite in Chromium. The smoke set in Firefox and WebKit when the change touches `extension/`, `tests/e2e/` or the test seeds |
  | Nightly | Every suite in every engine; the language-domain suite in Chromium only |
  | Before a release | The nightly matrix on the release commit, green; the smoke set in the farm's desktop WebKit; the screen-reader pass |

  No retries and no allowed failures. A failure in one engine is triaged as
  a module bug, a Canvas bug or an engine-build quirk (design D7).
- **The farm runs one browser suite at a time.** One engine per
  `playwright test` run, one run at a time, with one worker as today.
- **A multilingual seed**, behind its own flag, so that today's seeds stay
  byte for byte the same. It adds Finnish and Arabic (right to left):
  translated pages, a translation that exists only as a draft, a page written
  in Arabic, translated image alt text, translated articles whose values are
  linked to fields, and an Arabic override of the article template's
  component tree. Languages are found by path prefix, or, in a variant, by
  domain.
- **Two suites.** `multilingual.spec.ts` (every engine) and
  `language-domains.spec.ts` (Chromium only; it maps extra host names).
- **Accessibility automation.**
  - One `expectAccessible()` helper replaces the copies of the axe filter and
    scans every view, in every engine, including a right-to-left page.
  - Accessibility-tree snapshots (ARIA snapshots) of each view, in Chromium.
  - Forced colours and reduced motion, emulated in Chromium.
- **A scripted screen-reader pass** before each release.
  `tests/e2e/SCREEN-READERS.md` holds a 14-step checklist for two pairs: a
  WebKit browser with its platform's built-in screen reader, and Firefox with
  an open-source screen reader. The template composer of
  `compose-values-from-fields` joins it: its steps also run with the
  open-source screen reader in a Chromium browser, and with a real Japanese
  and a real Chinese input method. Each pass is recorded in the release
  notes.
- **Docs.** The README's limitation line is replaced by one sentence: screen
  readers are checked by hand before each release, not on every change.
  README, ARCHITECTURE and the design-system checklist list the projects,
  engines and tiers.

## Capabilities

### New Capabilities

None. CI tiers, seeds and checklists are how the module is verified, not
behaviour a site builder can observe, so they live in design.md and
tasks.md.

### Modified Capabilities

- `seo-dialog`: a new requirement, "The dialog works in each browser engine".
  "The dialog works with assistive technology" covers every view in each
  engine, forced colours and reduced motion, and a screen reader reading an
  information sentence.

Head output gains tests, not requirements: the language suites prove
existing head-output and public-addresses scenarios in a browser (design D4).

## Dependencies and place in the queue

Lands right after `close-known-limitations`, as decisions.md item 15
already queues it. It needs from that change:

- values carrying `lang` and language names in `<bdi>` (scanned in M3 and
  read in the screen-reader pass);
- media text in the page's language (M4);
- the translation editing probe, task 4.1, whose recorded outcome decides
  what L2 asserts.

`compose-values-from-fields` lands before this change (decisions.md item
17; amendment recorded there on 2026-11-17). Its composer joins the
screen-reader and input-method matrix (steps 13 and 14 of design D6, a third
pair with the open-source screen reader in a Chromium browser), and its
accessibility tree snapshots join task 4.3, with the link menu taken in add
mode as well. The farm has no screen reader, so that change's own check is
the owner's merge check; this change's checklist makes it part of every
release pass after it.

`serve-each-frontend-its-own-addresses` lands before both and proves its
language-domain case with a frontend in kernel tests. The seeds here have no
frontend, so L1 covers Drupal's language domains as the public site.

## Out of scope and non-goals

- No product change. A defect the new runs find is fixed in this change only
  when it is small and in the module; otherwise it gets its own change.
- Automated screen readers, and every suite in every engine on every merge
  request (design, "Alternatives considered").
- Translating the dialog's own words. They stay English, left to right.
- No README non-goal is reopened. Editing a translation's own SEO text where
  the editor cannot open it stays a non-goal.

## Open decisions (recommended option first)

1. **Nightly or weekly.** Recommended: nightly. Weekly, if drupal.org's
   runner quota asks contributed projects to keep schedules light; nothing
   else changes.
2. **WebKit in CI.** Recommended: in CI, if the runner image can install its
   system libraries. Otherwise WebKit runs by hand on the farm before each
   release, and the README says so.

## Upstream draft (not posted)

`upstream/canvas-test-engines.md` asks Canvas to run its Playwright suite in
Firefox and WebKit on a schedule. It is optional: this change does not depend
on it.

## Size

M: 2 to 3 agent days, plus a day for what the first Firefox and WebKit runs
find, and about 1.5 hours of a person for the first screen-reader pass.
