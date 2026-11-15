# Follow-up change: test-in-every-engine-and-language

**Not part of this change.** The review moved G8's test infrastructure out of
`close-known-limitations` (design.md, "Review decisions"). This file keeps the
plan so that it can be proposed as its own change with `openspec propose`,
queued after `close-known-limitations`. Its upstream draft is
`upstream-canvas-test-engines.md` next to this file.

What stays in `close-known-limitations`: values carry their language (`lang`,
`<bdi>`), and the probe of how an editor edits a translation (its task 4.1).
The README's G8 line stays, as it is, until this follow-up lands.

## Why

The dialog is tested in Chromium on a single-language site. Editors use
Firefox and WebKit browsers, right-to-left languages and screen readers.

## Plan

**Engines.**

- `E2E_ENGINES` generates the same projects for `chromium`, `firefox` and
  `webkit`. Chromium keeps today's project names; the other two get a
  `firefox:` or `webkit:` prefix. `fixture.ts` strips the prefix to pick the
  seed.
- Every engine pins `deviceScaleFactor: 1`.
- The smoke set is `host-contract`, `page`, `access` and `multilingual`,
  chosen for where engines differ: closing mid-edit, clipboard, focus, frame
  sizing and right-to-left text.

**CI.**

- Chromium runs every suite on every merge request and push.
- A matrix job runs the Firefox and WebKit smoke set on merge requests that
  touch `extension/`, `tests/e2e/` or the seeds.
- Every suite runs in every engine on a schedule (nightly recommended,
  weekly if the runner quota asks for it), and on "Run pipeline" before a
  release.
- Before committing to it, confirm that drupal.org's runners can install
  WebKit's system dependencies. If they cannot, WebKit runs by hand before a
  release and the README says so.
- No retries. A failure in one engine is triaged as a module bug (fix it), a
  Canvas bug (upstream draft, `test.fixme` with its link, and one README line)
  or a quirk of the engine build (worked around in the test, with a comment).

**Seed.** `CANVAS_METATAG_E2E_MULTILINGUAL` adds `en`, `fi` and `ar` (right to
left): a draft-only Arabic translation; a page whose own language is Arabic;
translated media alt text; translated articles whose template values are
linked to fields; an Arabic override of the article template's component
tree. A domain variant, Chromium only, maps the extra hosts with
host-resolver rules. The existing seeds are unchanged.

**Suites.** `multilingual.spec.ts` M1 to M6 (prefix and `?language=` editing
as `close-known-limitations` task 4.1 found it, inheritance and hreflang, a
right-to-left page, translated alt text, an untranslated fallback,
per-language articles). `language-domains.spec.ts` L1 and L2.

**Accessibility.**

- One `expectAccessible(page, view)` helper replaces three copies and scans
  every view, in every engine: each scope's tabs, each sheet, the scope and
  value menus, the conflict, read-only, cannot-save and offer strips, a field
  error, the AI tray and a right-to-left page.
- ARIA snapshots in Chromium only, with dynamic text as regular expressions.
- Forced colours and reduced motion emulated in Chromium.

**Screen readers.** `tests/e2e/SCREEN-READERS.md`, a 12-step checklist run
before each release with two desktop pairs, named neutrally: a WebKit browser
with its platform's built-in screen reader, and Firefox with an open-source
screen reader. Results go in the release notes. If a pair does not read
`aria-description`, that is a release blocker, fixed with `aria-describedby`.

## Requirements to carry (seo-dialog)

- **The dialog works in each browser engine.** The dialog MUST work alike in
  current Chromium, Firefox and WebKit: it opens in the editor and follows
  it, saves into the draft, keeps a change made just before it closes, and
  its tabs, sheets, menus, keyboard use, copying and right-to-left text
  behave the same. Scenarios: closing mid-edit in Firefox (the title reaches
  the draft, or the dialog offers it on the next open from session storage);
  copying in WebKit.
- **The dialog works with assistive technology** (MODIFIED): no serious or
  critical violation in any view, in each engine; forced colours keep focus
  outlines and edges.

## Tasks

1. `E2E_ENGINES`, the prefix strip, `deviceScaleFactor: 1` and the
   `install:engines` script; a local Firefox run, then a WebKit run, of the
   smoke set (one engine per invocation).
2. Split `.gitlab-ci.yml` into `.playwright`, `playwright` and
   `playwright (engines)`; prove the path filter and one scheduled run;
   record the measured times in ARCHITECTURE.
3. The multilingual seed and its domain variant, mirrored in `constants.ts`;
   `writeDraft()` takes a language; M1 to M6, L1 and L2.
4. `expectAccessible()`, ARIA snapshots, forced colours and reduced motion.
5. `SCREEN-READERS.md` and the first pass with a person at the screen.
6. Triage every Firefox or WebKit failure; one README line for each Canvas
   bug that stays.
7. Rewrite the README's G8 line to "Screen readers are checked by hand before
   each release, not on every change."

## Size

M, 2 to 3 agent days, plus a day budgeted for what the first Firefox and
WebKit runs find, and about 1.5 hours of a person for the first
screen-reader pass.
