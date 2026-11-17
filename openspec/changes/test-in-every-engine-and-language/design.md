# Design

## Context

See proposal.md for why. The state this design starts from:

- **Config.** `tests/e2e/playwright.config.ts` has one `use` with the desktop
  Chromium device, shared by five projects: `host-contract`, `coupled`,
  `headless`, `ai` and `complex`. One worker, no retries. The README's
  Development section still says "four projects".
- **Seeds.** `fixture.ts` picks the seed flag by project name (`FLAGS`).
  `CanvasMetatagTestSetup` adds Finnish and gives About a published Finnish
  translation. Nothing else is translated, and there is no right-to-left
  language. Right-to-left text exists only in the complex fixture's content.
  `writeDraft()` always writes `langcode: 'en'`.
- **CI.** One `playwright` job installs Chromium and runs every project, on
  merge requests and the default branch.
- **Accessibility.** axe runs on the three tabs and the Checks sheet
  (`access.spec.ts`) and with a link menu open (`template-complex.spec.ts`),
  each with its own copy of the filter. Nothing scans Output, the image
  picker, custom JSON-LD, the scope menu, Site, template scope, the notices,
  read-only Site or the suggestions tray. The styles handle forced colours
  and reduced motion; no test exercises either.
- **Engine-sensitive code in the dialog.** The write on `pagehide` with
  `keepalive`, the session-storage restore, the clipboard with its
  `execCommand` fallback, four `ResizeObserver`s, seven `:has()` rules and a
  typed native date input.
- **Canvas.** Under path prefixes, Canvas redirects a prefixed editor address
  to the unprefixed one (its work item 3546597). Its language select opens a
  preview route. Which translation the dialog edits in each setup is
  recorded by `close-known-limitations` task 4.1.

## Goals / Non-Goals

**Goals:**

- Every suite passes in Chromium, Firefox and WebKit, and the smoke set
  guards every browser-facing change.
- A multilingual site, with a right-to-left language, by path and by domain,
  is exercised in a browser.
- Every view is scanned for accessibility, and its accessibility tree is
  pinned.
- A person checks the dialog with two screen readers before each release,
  against a written checklist.

**Non-Goals:**

- No product behaviour changes (proposal, "Out of scope").
- No mobile engines: the dialog is a desktop editing tool, as Canvas is.

## Decisions

### D1. Engines are one switch over the same projects

`E2E_ENGINES` (default `chromium`) is a comma-separated list. The config
builds today's projects for each engine, with the same `testMatch` and
dependencies, Playwright's desktop device for that engine, today's viewport
and `deviceScaleFactor: 1`.

- Chromium keeps today's names, so every documented command still works.
  The others are prefixed: `firefox:coupled`, `webkit:host-contract`.
- `fixture.ts` strips the prefix before reading `FLAGS`. One line; seeds stay
  keyed by suite.
- `deviceScaleFactor: 1` everywhere: the desktop WebKit device defaults to 2,
  and the frame-fit tests compare pixels. Canvas pins 1 too.
- `install:engines` installs Firefox and WebKit next to the existing
  `install:browsers`.

### D2. Three tiers, chosen by path

`.gitlab-ci.yml`'s job body becomes a hidden `.playwright` template, run by
two jobs:

- `playwright`: every suite in Chromium, on every merge request and
  default-branch push, as today.
- `playwright (engines)`: a matrix over `firefox` and `webkit`.
  - On a merge request or push that touches `extension/`, `tests/e2e/` or
    `tests/src/TestSite/`: the smoke set (`E2E_FILES`).
  - On a schedule (nightly) and on a manual pipeline run: every suite.

A PHP-only change cannot behave differently between engines: every engine
reads the same head. So it pays nothing extra.

**The smoke set** is where engines really differ:

| File | Why |
|---|---|
| `host-contract.spec.ts` | frame sizing, the message bridge, the sandboxed frame, the clipboard, the native date input |
| `page.spec.ts` | draft writes, closing mid-edit, the session-storage offer, page switches, scroll anchoring |
| `access.spec.ts` | Tab order, focus return, every-view scans, 200 % zoom, small frames |
| `multilingual.spec.ts` | right-to-left layout, `lang` on values, text shaping |

**Before a release**, a manual pipeline runs the nightly matrix on the release
commit. The smoke set also runs in WebKit on the farm's desktop host, which is
closer to the shipping browser than the CI build. Then the screen-reader pass
(D6).

**On the farm** only one browser suite runs at a time. Each engine is its own
`playwright test` run, after the previous one ends; `workers: 1` keeps one
browser per run. Firefox is the heaviest; nothing else runs beside it.

### D3. A multilingual seed beside the others

`CANVAS_METATAG_E2E_MULTILINGUAL=1` adds, on top of the coupled seed:

- **Languages.** `en` (default), `fi` and `ar`. Arabic covers both direction
  and shaping; Hebrew is already in the complex fixture.
- **Pages.** About gets a published Arabic translation. Pricing gets a
  published Finnish translation and an Arabic translation that exists only as
  a Canvas draft. A new page is written in Arabic, with no translations: it
  opens in its own language under any negotiation, so it carries the
  right-to-left checks in every engine. Checks stays untranslated, as the
  fallback case.
- **Media.** The image media type and the alt text are translatable; the hero
  gets Finnish and Arabic alt text.
- **Articles.** Node 1 gets Finnish and Arabic translations with their own
  aliases. The Article template's title and description are stored linked to
  the node's fields.
- **Template.** An Arabic language override of the Article template's
  component tree, with its own heading.

`CANVAS_METATAG_E2E_LANGUAGE_DOMAINS` switches negotiation to domains
(`fi.<host>`, `ar.<host>`). Only Chromium can map extra host names to the site
without touching the system (host resolver rules), so that suite is Chromium
only; the behaviour it tests is the server's, which every engine reads alike.

Two new projects carry them, `multilingual` and `language-domains`. The
existing seeds do not change. `constants.ts` mirrors the new pages and
languages, and `writeDraft()` takes a language.

### D4. The language suites prove existing requirements

`multilingual.spec.ts`, path prefixes, every engine:

- **M1.** A prefixed editor address opens what task 4.1 recorded, and the
  dialog says which version it edits. It pins Canvas's redirect: when Canvas
  opens translations under a prefix, it fails loudly.
- **M2.** Settings of the default version (noindex, the type) reach the
  translations, each keeping its own text; the same hreflang set on all three.
- **M3.** The Arabic page: values and previews run right to left with
  `lang="ar"`, labels stay left to right in the dialog's language, scans are
  clean, the head has the Arabic title and `inLanguage`. Preview screenshots
  are attached.
- **M4.** `/fi/pricing` shares the Finnish alt text.
- **M5.** `/fi/checks`, untranslated, has the English canonical and no
  alternates.
- **M6.** Each article translation's head comes from its own fields, and the
  template editor previewing the Arabic article shows the overridden heading.

`language-domains.spec.ts`, Chromium:

- **L1.** Canonical, `og:url`, `@id` and alternates are on each language's
  domain, reciprocally.
- **L2.** The editor on a language's domain, as task 4.1 recorded it: the
  translation it edits takes the write, and the other does not.

These scenarios are already in head-output, page-seo and public-addresses, or
come with `close-known-limitations`; the suites add browser proof, so no head
requirement changes. Cookies are per host: the fixture sets the test cookie
and signs in on each host it uses. A proxy that routes by host must answer the
language hosts; the fixture fails with that sentence instead of skipping.

### D5. One accessibility helper, every view, one tree per view

- `expectAccessible(page, view)` in `fixture.ts` runs axe on the dialog
  frame, keeps the serious and critical filter, and names the view in each
  failure. It replaces the copies and runs in every engine: axe is page
  script, and engines differ in what they render.
- `access.spec.ts` walks every view the coupled seed reaches: each tab of each
  scope, each sheet, the scope menu, read-only Site, each notice and a field
  error. `ai.spec.ts` scans the suggestions tray; M3 scans a right-to-left
  page.
- One `toMatchAriaSnapshot()` per view, stored once under `tests/e2e/__aria__/`
  with dynamic text as regular expressions. Chromium only: Playwright builds
  the tree from the DOM the same way in every engine, so other engines add
  nothing. It catches a lost name, a changed role or state, a heading level or
  an unnamed control that axe and role locators miss.
- Forced colours and reduced motion are emulated in Chromium, the engine that
  emulates both: the focus ring and edges stay, nothing slides, scans stay
  clean.

### D6. Screen readers: a scripted pass by a person

`tests/e2e/SCREEN-READERS.md`, linked from the README's Development section,
is a 14-step checklist of about 30 minutes per pair:

1. The frame is announced as "SEO" and focus lands on the scope button.
2. Tabs: name, state and position; arrows and Home move between them.
3. A field: label, then its inherited value as description; one polite
   status after a pause, nothing per key.
4. Every ⓘ button: name, then its sentence.
5. Each preview is one image with its settled name.
6. Checks: the count, the named sheet, each "Show" with its issue; Escape
   returns.
7. A value menu: group names, the active option, unavailable options.
8. The conflict alert and a field error are read at once; other notices
   politely.
9. The Finnish and Arabic pages are read in their own voices.
10. Output: "Copied" is announced.
11. The suggestions tray, with the test provider: a working status, the
    variants as a radio group.
12. The system's high-contrast theme: focus and edges stay visible.
13. A template's composed title (`compose-values-from-fields`): one textbox
    named by the field, its chips read as words in the flow, a chip stepped
    over in one press and told from a typed word of the same text, its
    description starting with the result, and "added", "removed" and
    "replaced" announced once. The link menu in add mode reads its header
    ("After …") and its groups.
14. Input methods in the composer: a Japanese and a Chinese input method
    compose beside a chip and as the first key after an insert, losing no
    key and never composing inside a chip.

Pairs: a WebKit browser with its platform's built-in screen reader, and
Firefox with an open-source screen reader; the farm's desktop host can carry
the first. Steps 13 and 14 also run with the open-source screen reader in a
Chromium browser, the pairs `compose-values-from-fields` names for its
composer. A record in the release notes gives the date, module commit,
Canvas version, each pair with versions, the keyboard setting used, and each
step's result. A failed step 4 blocks the release and is fixed by giving the
sentence a hidden element named by `aria-describedby`.

### D7. Triage, never retry

A failure in one engine is one of three things:

1. A module bug: fixed in this change when small, or its own change.
2. A Canvas bug: an upstream draft, `test.fixme()` for that engine with the
   draft's issue link once posted, and one README limitation line.
3. A quirk of Playwright's engine build that the real browser does not show:
   worked around in the test, with a comment saying so.

Known cases to expect: the WebKit browser skips buttons on Tab unless full
keyboard access is on, so the keyboard step may need the engine's modifier;
native date segments differ, so the test types digits only; a dropped
`keepalive` write on close must leave the offer, never nothing.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Every suite in every engine on every merge request | Triples runner minutes for PHP changes, which cannot differ by engine. |
| Tags to pick the smoke set | A rule every new test must remember; each file installs its own sandbox anyway, so files are the natural unit. |
| The multilingual seed folded into the coupled one | It would change what today's suites observe: hreflang sets, the language menu. |
| Domain negotiation in every engine | Firefox maps only loopback names; WebKit cannot map names without the system's hosts file. The behaviour is the server's. |
| Driving screen readers from tests | Needs desktop runners with a signed-in session and accessibility grants; drupal.org CI has none, and on the farm other agents would inherit them. Speech timing makes it flaky. Revisit if the pass finds the same regression twice. |
| A simulated screen reader from the DOM | The same information as the ARIA snapshot, plus a dependency. |
| A dedicated test-coverage capability | Specs state observable behaviour; tiers and checklists are not that. |

## Risks / Trade-offs

- **The first runs find Canvas bugs.** Canvas tests neither engine. D7's
  triage and the upstream draft handle them; the README names each one
  instead of a blanket line. A day is budgeted.
- **WebKit's system libraries on the CI image.** `--with-deps` already needs
  root and network (marked `CEILING` in `.gitlab-ci.yml`). If it cannot
  install them, Canvas's testing image is the fallback; failing that, WebKit
  runs on the farm before each release (proposal, open decision 2).
- **CI WebKit is not the shipping browser.** The farm's desktop WebKit run and
  the screen-reader pass cover it before a release.
- **Snapshot churn.** Regular expressions, one file per view, Chromium only.
  If churn stays high, the snapshots shrink to the header, tab list and sheets.
- **Runner minutes.** Path-filtered smoke runs, a nightly that can become
  weekly, and measured times recorded in ARCHITECTURE.

## Migration

None for sites. Developers get `npm run install:engines` and `E2E_ENGINES`.
