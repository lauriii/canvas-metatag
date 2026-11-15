## 1. Before starting

- [x] 1.1 Wait until the dialog redesign and its Playwright gate have landed,
      then rebase onto `drupal/HEAD`. Verify: the submodule's kernel tests
      (`AssistantTest`, `AiControllerTest`) and the Playwright `ai` project
      pass unchanged on the farm site.
      Done: the redesign is committed on this branch. This checkout has no
      `drupal` remote, so there was nothing to rebase here; the branch stays
      based on upstream. Baseline: the last gate's runs of `AssistantTest`,
      `AiControllerTest` and the `ai` project passed before this change.
- [x] 1.2 Settle the proposal's open decisions 1 to 4, or accept their
      defaults. Verify: the proposal records the outcome; if decision 1 goes
      to two prompts, update the spec delta and tasks 3.1 to 3.4 first.
      Done: defaults accepted (proposal, "Decisions taken").

## 2. Hardening on the AI module (no visible change except `blocked`)

- [x] 2.1 Set `ai:ai (>=1.5.0)` in `canvas_metatag_ai.info.yml` and add the
      `suggest` entry for `drupal/ai` to `composer.json`. Verify:
      `composer validate` passes and the submodule still enables on the farm
      site.
- [x] 2.2 Make `EchoSeoProvider::getConfiguredModels()` list `echo-json` with
      the structured response capability, and set
      `default_providers.chat_with_structured_response` in
      `CanvasMetatagTestSetup` (AI mode). Verify:
      `AssistantTest::testProviderResolutionOrder` passes and the Playwright
      `ai` project still passes.
- [x] 2.3 Add the `blocked` reason to `AiException` and the threshold-aware
      guardrail check to `Assistant::ask()`, before decoding. Verify: new
      `AssistantTest::testGuardrailStopIsBlocked` (a saved `regexp_guardrail`
      in a global set: a matching page text is blocked before generation; a
      post-generation set matching the echo answer is blocked; a set with
      `stop_threshold: 2` and one match is not blocked and returns cleaned
      variants).
- [x] 2.4 Keep the full-trust link filter, `json_decode()` before the decoder,
      and the schema array, with comments saying why. Verify: new
      `AssistantTest::testBareJsonWithSpaces` (`{ "suggestions": …}`, CRLF and
      tab pretty-printing decode) and `testNoDeprecations` (the schema reaches
      the request as an array with `strict: true`, no `E_USER_DEPRECATED`);
      `testSuggestText` still returns "fish & chips <fresh>" intact.
- [x] 2.5 Remove the 30-second `http_client_options` override. Verify: new
      `AssistantTest::testSiteTimeoutApplies` (the provider is created without
      configuration of ours).
- [x] 2.6 Map `AiException('blocked')` to `blocked`,
      `AiAccessDeniedException` and `AiMissingFeatureException` to
      `ai_not_configured`, and `AiBrokenOutputException` to
      `invalid_response`. Verify: `AiControllerTest::testErrorCodes` with a
      case for each.
- [x] 2.7 Drop `@message` from the failure record. Verify:
      `AiControllerTest::testNothingOfThePromptIsLogged` expects records
      without the provider's message, plus one record for a default that names
      a plugin that cannot be created.
- [x] 2.8 Change the `blocked` sentence to "The site's AI rules stopped this
      request." in `AiController::ERRORS` and `Suggest.tsx`, and rebuild
      `extension/dist`. Verify: `npm run verify`; new Playwright test "a site
      guardrail blocks a request and the tray says so" in `ai.spec.ts`
      (setup saves a global `regexp_guardrail` matching `#policy`; typing it
      in Refine shows the sentence, writes nothing and keeps Try again).
- [x] 2.9 Browser check on the farm site: trigger the guardrail from Refine
      and take a screenshot of the tray.
      Done (screenshots with the run's notes), also at 350 px height with
      "Try again" reached by keyboard; the demo guardrail was removed after.
- [x] 2.10 Docs: README "AI suggestions" (guardrails apply; a stop is
      "blocked"); ARCHITECTURE §16 (guardrail rule, answer reading, log
      record), §17 (new tests), and a §16 table of the AI module APIs relied
      on, as in design.md. Verify: every API row names a test that exists.

## 3. Prompts in the AI prompt library

- [x] 3.1 Add the three `ai.ai_prompt_type.canvas_metatag_*` and three
      `ai.ai_prompt.canvas_metatag_*__default` files to `config/install`, with
      enforced module dependencies and labels that say only the default prompt
      is used. Verify: new unit test `ShippedConfigTest` (each type declares
      exactly its variables, all required; each default prompt contains its
      variables and not `<page_content>` or "Answer with JSON"; every file
      depends on `canvas_metatag_ai`; every label says "default prompt only",
      since review round 1 'only the prompt named "default" is used'; a real
      install and uninstall: `PromptsTest`, task 6.2).
      Shipped prompts are in the form the Prompt Library's Markdown editor
      saves, so saving one unchanged leaves it unchanged (checked on the
      farm site; design.md, decision 2).
- [x] 3.2 Add `Assistant::system()`, the `FENCE` and `SHAPE` constants, and
      delete `TEXT_PROMPT` and `SCHEMA_PROMPT`. Verify: `AssistantTest`
      installs the submodule's config; `testPrompts` asserts the system prompt
      is the shipped prompt with server values followed by `FENCE` and `SHAPE`
      exactly, `[site:name]` stays literal, and the user message is unchanged;
      new `testEditedPromptKeepsSafetyTail` ("Say hello." still ends with the
      tail) and `testOnlyDefaultPromptIsUsed`.
- [x] 3.3 Route text requests to the search or social prompt, and tag calls
      `canvas_metatag_ai_search|social|schema`. Verify: new
      `AssistantTest::testSocialUsesSocialPrompt` and `testTags`.
- [x] 3.4 Refuse text requests that mix social and search fields in
      `AiController::read()`. Verify: `AiControllerTest::testBadRequests` with
      `title` + `social.title` → 400, no provider call.
- [x] 3.5 Add `no_prompt` to `Assistant::status()` (after the provider
      reasons) and throw `not_configured` for a missing or blank prompt.
      Verify: new `AssistantTest::testMissingPrompt` (deleted and blank
      prompt; `no_provider` wins when both apply);
      `AiControllerTest::testErrorCodes` (422 `ai_not_configured`, no provider
      call) and `testCapabilitiesInState` (`no_prompt`).
- [x] 3.6 Add the prompt kind to the failure record. Verify:
      `AiControllerTest::testNothingOfThePromptIsLogged`.
- [x] 3.7 Verify end to end: the Playwright AI setup sets the search
      prompt in configuration to a short text without `{count}` for the
      whole `ai` project, and the test provider answers in prose unless the
      system prompt ends with the fence and answer shape, so every title
      suggestion in `ai.spec.ts` proves it (three variants: the server's
      cap). Also proven by `AssistantTest::testEditedPromptKeepsSafetyTail`
      and `testPrompts`. Review round 2 removed the separate test "suggestions
      still work after the prompt is changed", which repeated the first one.
- [x] 3.8 Browser check on the farm site: reinstall the submodule, open the
      Prompt Library and take a screenshot of the three prompts and their
      type labels.
      Done (screenshots with the run's notes). Reinstalling together with the
      test provider drops the AI defaults that name it; they were set back to
      the echo provider.
- [x] 3.9 Docs: README (prompts are edited in the Prompt Library, with the
      AI module's prompt permission; only the default prompt is used; the
      fence and shape are not editable; the new tags), ARCHITECTURE §16 and
      §19 (prompts live in `config/install`, not in `Assistant.php`).

## 4. Status report and the dialog's Site line

- [x] 4.1 Add `AiHooks::runtimeRequirements()` and make
      `Assistant::provider()` public. Verify: new kernel test
      `RequirementsTest` (OK naming provider and model; no provider;
      provider not set up; prompt deleted; no provider call in any case).
      Since review round 1 the operation is not named, and since round 2
      `provider()` no longer returns it.
- [x] 4.2 Add `no_prompt` to the reason union in `types.ts` and the Site
      view's line "AI suggestions are off: a suggestion prompt is missing.",
      keeping the two existing sentences. Move the reason-to-sentence mapping
      into `model.ts`, and rebuild `extension/dist`. Verify: a `model.test.ts`
      case per reason; `npm run verify`.
- [x] 4.3 Add to the permission description that sites which log AI requests
      may store the page text. Verify: `ShippedConfigTest` asserts the
      sentence in `canvas_metatag_ai.permissions.yml`.
- [x] 4.4 Browser check on the farm site: screenshots of the status report
      entry when on and when a prompt is deleted, and of the Site view line
      in the second state. Restore the prompt afterwards.
      Done (screenshots with the run's notes). The deleted prompt was added
      back through the Prompt Library with the machine name "default", as the
      entry says, then reset to the shipped text.
- [x] 4.5 Docs: README (the status report entry; the observability caveat,
      worded after checking what an empty `log_tags` means), ARCHITECTURE
      §15 and §16. Verify: the README's links and route names match
      `RequirementsTest`.
      Done: an empty `log_tags` logs every call (README says so).

## 5. Integration

- [x] 5.1 Run the base module's and the submodule's PHPUnit tests, PHPStan,
      PHPCS and cspell on the farm site. Verify: all pass.
      Done at gate attempt 3, in the site's container, one class at a time:
      base Unit 192 tests, submodule Unit (`ShippedConfigTest`) 2,
      `PromptsTest` 2, `AssistantTest` 20, `AiControllerTest` 10,
      `RequirementsTest` 2, all passing; PHPCS (Drupal, DrupalPractice) has
      no errors and no warnings on code files. The base module's kernel
      classes were not run again: this change touches no base module class
      they cover (see below).
      Before that, review round 3 ran every submodule class again, one at a
      time, all passing: `PromptsTest` 2 tests, `AssistantTest` 20,
      `AiControllerTest` 10, `RequirementsTest` 2, `ShippedConfigTest` 2;
      the base module's unit tests pass too (192). They ran with the host's
      PHP (8.5) against the farm site's Drupal root and SQLite, because the
      container's file share answered "Too many open files"; the gate
      runs them in the container. PHPStan (level 5, the gate's config) shows
      only one finding in the submodule, which was there before this change
      (`AiControllerTest`: a count after a listener appends); PHPCS is clean
      on the changed files. cspell (gate repair 1, run on the host with core's
      `.cspell.json` and `.cspell-project-words.txt`): every changed file
      outside `openspec/` is clean; this change's design and tasks notes
      keep technical terms (`openspec`, EMFILE, heredocs) that every other
      file under `openspec/` also has. Open: the base module's kernel
      classes. Base module PHP changed only in the e2e test
      setup (`CanvasMetatagTestSetup::configureAi()`) and the hook docs
      (`canvas_metatag.api.php`), which no kernel class covers.
- [x] 5.2 Run `npm run verify` and check that a fresh build matches the
      committed `extension/dist`. Verify: no diff.
- [x] 5.3 Run the Playwright `host-contract` and `ai` projects, one suite at a
      time. Verify: all pass.
      Unticked in review round 2: the recorded pass predates review rounds 1
      and 2, which changed `ai.spec.ts`. Re-run with 7.9.
      Done at gate attempt 3 (one worker): `host-contract` 4 and `ai` 6, all
      10 passing, with the current `ai.spec.ts`.
- [x] 5.4 Run `openspec validate build-ai-on-drupal-ai --strict` and search
      the changed files for commercial vendor names. Verify: clean, and none
      found.

## 6. Review round 1

- [x] 6.1 Default prompts cannot be deleted: `AiHooks::promptAccess()`
      forbids `delete` on the three `__default` prompts, and
      `Routing\RouteSubscriber` adds `_entity_access: ai_prompt.delete` to the
      AI module's delete form. Verify: new kernel test
      `PromptsTest::testDefaultPromptsCannotBeDeleted` (no delete access or
      delete URL access for the defaults, edit still allowed; another prompt
      of the type can be deleted). The farm site's Prompt Library showed only
      Edit for the three, and the delete address answered "Access denied".
      The class passed in review round 3 (see 6.2).
- [x] 6.2 Every prompt of our types depends on the submodule:
      `AiHooks::promptPresave()` adds the enforced module dependency. Verify:
      `PromptsTest::testInstallAndUninstall` (installs with the module
      installer: three types and three prompts; a default re-added and an
      extra prompt get the dependency; uninstall leaves none of ours and keeps
      another module's prompt; reinstall succeeds). On the farm site, the social
      prompt re-added in 4.4 was re-saved so it has the dependency (done).
      Passed in review round 3: `PromptsTest` 2 tests, 35 assertions (host
      PHP, see 5.1).
- [x] 6.3 Variables also filled as `{{ name }}`; the prompt read without
      config overrides; `KINDS` private (public again since 7.1, for the
      status report). Verify:
      `AssistantTest::testEditedPromptKeepsSafetyTail` (a `{{ language }}`
      prompt), new `testPromptTranslationIsNotUsed`. Passed in review
      round 3 (`AssistantTest` 20 tests).
- [x] 6.4 Guardrail sum: `AssistantTest::testGuardrailStopIsBlocked` gains a
      case where neither set reaches its own threshold but the sum does
      (blocked after one generated call), and names the strict-plus-lenient
      case for what it proves. Since review round 3 it also has a lenient
      set's stop blocking through a strict set that passes, and a stop of
      score 0 at a threshold of 0 (8.1). Passed in review round 3.
- [x] 6.5 Status report: the On entry names provider and model and links to
      the AI settings; a missing prompt is named by its label, with plural
      wording. Prompt labels "SEO: …"; type labels say 'only the prompt named
      "default" is used'. Verify: `RequirementsTest`, `ShippedConfigTest`.
      Passed in review round 3.
- [x] 6.6 Error mapping: `AiOperationTypeMissingException` →
      `ai_not_configured`; `#garbage` with a structured chat default →
      `invalid_response`; the log check looks for "You write the text".
      Verify: `AiControllerTest::testErrorCodes`,
      `testNothingOfThePromptIsLogged`. Passed in review round 3.
- [x] 6.7 Dialog: the `blocked` sentence gains a next step (schema tray:
      "Ask a site administrator."); a route-level 403 reads "Your session or
      permissions changed. Reload the editor and try again."; the AI
      disclosure shows only with suggestions; a variant's character count is
      its description, not part of its name; the inline Suggest buttons say
      what they send; the Site line ends "See the status report.". Verify:
      `model.test.ts` (`aiOffText`, `aiErrorText`), Playwright `ai` ("a site
      guardrail blocks…" asserts the sentence and no disclosure),
      `npm run verify`; browser screenshots of the blocked tray and the Site
      line (no Playwright case for the Site line: the `ai` project's prompts
      are shared by every test, and the vitest case covers the text).
      Open: `npm run verify` passes; the Playwright run and the screenshots
      wait for the farm site (its file mount answered "Too many open files"
      on every site of the box).
      Review round 2 changed the blocked wording and the Site line (7.5,
      7.6) and renamed `aiErrorText()` to `aiError()`; 7.9 verifies both.
      Done at gate attempt 3: Playwright `ai` passes, and the farm site
      showed each sentence, the description on every Suggest control, the
      count as a variant's description, no disclosure on error trays, and
      the 403 sentence after the session was removed (screenshots with the
      run's notes).
- [x] 6.8 Docs: README Prompts bullet (rewrapped; no braces workaround;
      cannot be deleted; translations not used), ARCHITECTURE §15–17,
      `canvas_metatag.api.php` (`no_prompt`), spec delta (variables required
      by the Prompt Library; scenarios set through configuration; request
      refused only for its own missing prompt; delete guard; access 403).

## 7. Review round 2

- [x] 7.1 Status report: a default naming a provider plugin that is gone
      says "is not installed" and links to the AI settings; a missing prompt
      is named by its own label (the shipped one only when it is gone); an
      emptied prompt says "empty", a removed one says to add it to the
      prompt type of the same name with the machine name "default"; a
      removed prompt type asks for a reinstall and links to the uninstall
      page. The prompt types derive from `Assistant::KINDS` (public again).
      No post-update: there is no release yet (design, Migration Plan).
      Verify: `RequirementsTest::testEntry` (new "gone" case) and new
      `testPrompts` (emptied and renamed, two emptied, removed, removed plus
      emptied, type removed); `assertEntry()` always checks a link.
      Passed in review round 3, with the wording of 8.2.
- [x] 7.2 `Assistant::provider()` drops the unread `operation` key;
      `Assistant::isSocial()` is the one social/search rule, used by
      `textKind()` and the controller's mixed-field check. Verify:
      `AssistantTest`, `AiControllerTest::testBadRequests`. Passed in review
      round 3.
- [x] 7.3 Labels: type labels "SEO: … (only the prompt named "default" is
      used)", like their prompts. Verify: `ShippedConfigTest` asserts the
      exact label of every type and prompt (passed on the host's PHP; 2
      tests, 46 assertions since review round 3).
- [x] 7.4 `EchoSeoProvider` lists `echo-structured` next to `echo-json`, so
      the structured chat default the tests set is a model it has.
- [x] 7.5 `blocked`: the server's message is neutral ("The site's AI rules
      stopped this request."); the dialog adds "Try different wording in
      Refine, or ask a site administrator." when Refine text was sent, else
      "Ask a site administrator.". After `blocked` without Refine text,
      `ai_not_configured`, `quota_exceeded` or a 403, a tray shows the
      sentence and only Dismiss, with focus on the tray that holds it.
      Verify: `model.test.ts` (`aiError()`: both `blocked` variants and
      `retry` for every code), `AiControllerTest::testErrorCodes` (message),
      Playwright `ai` ("a site guardrail blocks…": Refine text sent, so Try
      again stays; since review round 3 also "a failure that asking again
      cannot help offers only Dismiss", 8.5), `npm run verify`. The
      `AiControllerTest` step passed in review round 3; the Playwright run
      is 7.9.
- [x] 7.6 Site line: "AI suggestions are off: a suggestion prompt is empty
      or missing." and every reason ends "Site administrators can see how to
      fix it in the status report." (the SEO settings permission does not
      open it). Verify: `model.test.ts` (`aiOffText()`).
- [x] 7.7 Playwright `ai`: the first test asserts the suggest control's
      accessible description ("Sends this page's text to the AI service.")
      and that a variant's count is its description (`/^\d+ characters?$/`),
      not the end of its name. Verify: e2e `tsc --noEmit`; the run is 7.9.
- [x] 7.8 Docs: spec delta (variables declared required; `{{ language }}`
      set through configuration; blocked wording per tray; Try again only
      where it helps; log only requests past validation and flood;
      status report scenarios for a gone provider, a removed prompt and a
      removed type; exact type labels), design (Context and §6 on our test
      provider, §2 braces, §5, §8, API table rows for `PromptsTest` and the
      delete form), proposal (guardrail sum, Errors, Impact), README
      (status report recovery, `{language}` form, strict-plus-lenient
      guardrail sets), ARCHITECTURE §16.
- [x] 7.9 On the farm site, one class at a time: `PromptsTest`,
      `AssistantTest`, `AiControllerTest`, `RequirementsTest`,
      `ShippedConfigTest`; then the Playwright `host-contract` and `ai`
      projects; then tick 5.1, 5.3 and 6.2 to 6.7 with the counts. Browser
      check: the blocked tray (with and without Refine text) at 600, 420 and
      350 px heights and 200% zoom, keyboard only; the Site line at 350 px;
      the status report in each state. Screenshots in the run's notes.
      PHPUnit part done in review round 3 (5.1; host PHP, since the
      container cannot read its files). Open: the Playwright projects and
      the browser checks, and 5.3 and 6.7 with them: the farm site's file
      mount still answers "Too many open files" (EMFILE on the VM's file
      share, every site of the box) and the site answers 502. Recovering it
      is a box-level operation for a human.
      Gate attempt 1 (still blocked): `npm run verify` (252 vitest), e2e
      `tsc`, unit suites (192 base, `ShippedConfigTest` 2) and the four
      submodule kernel classes (2, 20, 10, 2) pass on host PHP; PHPCS has no
      errors and no warnings on code files. Playwright and the browser
      checks could not run: the share inside the VM itself answers EMFILE.
      Gate repair 1 (still blocked): the VM's own file table is far from
      full, so the error comes from the host side of the share; recovery
      is still a box-level step for a human. `npm run verify` (252), e2e
      `tsc` and `openspec validate --strict` pass again.
      Gate attempt 2 (still blocked): every web container on the box is
      unhealthy and the share still answers EMFILE (site 502). On host PHP:
      unit 192 and 2, `PromptsTest` 2, `AssistantTest` 20,
      `AiControllerTest` 10, `RequirementsTest` 2 pass; PHPCS has no errors
      and no code-file warnings; `npm run verify` (252), e2e `tsc`,
      `openspec validate --strict` and `--all` pass.
      Gate attempt 3 (done, the share is back): in the site's container,
      unit 192 and 2, `PromptsTest` 2, `AssistantTest` 20,
      `AiControllerTest` 10, `RequirementsTest` 2 pass; Playwright
      `host-contract` and `ai` pass (10 of 10, one worker). Browser, keyboard
      only: the blocked tray with Refine text (Try again kept) and without
      it (only Dismiss, focus on the tray) at 600, 420 and 352 px dialog
      heights and at 720 x 450 (200% zoom); the structured data tray's
      `ai_not_configured` and `blocked`; the Site line at 352 px and 200%
      zoom; the status report on, provider gone, prompt removed, emptied,
      two emptied, one and two types removed. Uninstall with a re-added
      default and an extra prompt leaves none of ours, and reinstall
      succeeds. Screenshots with the run's notes.
- [x] 7.10 At the gate: commit harden-template-scope and this change in
      order, and rebuild `extension/dist` with `npm run verify` after each
      commit, so that each commit's dist matches its own sources.
      Done: harden-template-scope is committed first; a build of that
      commit's own sources gives byte-identical `main.global.js` and
      `main.css`. This change's dist is rebuilt by `npm run verify` before
      its commit.


## 8. Review round 3

- [x] 8.1 `Assistant::stopped()` counts stops, not a positive score: a stop
      of score 0 reaches a set's threshold of 0, as the AI module counts it,
      and is `blocked`, not `invalid_response`. Verify:
      `AssistantTest::testGuardrailStopIsBlocked` (the AI module's
      `counting_stub_guardrail` stopping with score 0 at threshold 0; it
      failed with `invalid_response` before the fix), plus a lenient set's
      stop blocking through a strict set that passes, as the README says.
- [x] 8.2 Status report: the label of a prompt that is gone comes from
      `AiHooks::LABELS`, not from reading `config/install`;
      `ShippedConfigTest` pins the shipped labels to it. A removed prompt
      type is counted ("A suggestion prompt type is missing…", "2 suggestion
      prompt types are missing…"). A removed prompt is added "to the prompt
      type whose name starts the same", since a type's label is its
      prompt's label plus a note. Spec: the type-removed scenario applies
      when its default prompt is missing or empty, as the code checks.
      Verify: `RequirementsTest::testPrompts` (one and two types removed;
      blank prompts saved as white space, which the config schema allows).
- [x] 8.3 Requests refused with 400 or by the flood limit are not logged.
      Verify: `AiControllerTest::testFloodLimit` asserts no
      `canvas_metatag_ai` record after its 400 and two 429 answers.
- [x] 8.4 The permission's paid-call sentence. Verify:
      `ShippedConfigTest::testPermission` asserts "Each request is a paid
      call".
- [x] 8.5 Dialog: an error tray holds one message (the short-page note
      shows only while working or with suggestions); the dialog's
      `rate_limited` sentence says "Wait a minute, then try again.", and
      `invalid_response` and `provider_error` no longer end with "Try
      again.", which the button says. The server's messages are unchanged:
      other clients show them without a button. Verify: `model.test.ts`
      (`aiError()`), `npm run verify`, e2e `tsc --noEmit`; new Playwright
      `ai` test "a failure that asking again cannot help offers only
      Dismiss" (server answers stood in for with `page.route`: in the title
      tray `provider_error`, then Try again, then `blocked` without Refine
      text; then `ai_not_configured` in the structured data tray; each shows
      its sentence, only Dismiss and one paragraph, with focus on the tray).
      The run is 7.9.
- [x] 8.6 Docs and wording: ARCHITECTURE §16 says the provider's message is
      not logged right after the logging sentence, rewrapped; README
      Prompts bullet rewrapped and Guardrails worded as the test proves;
      spec: only an answer that does not decode to a JSON object or list
      goes to the JSON recovery; `EchoSeoProvider` says "Refine";
      `AssistantTest` asserts the language manager's type instead of an
      inline `@var` (PHPStan). Verify: PHPCS, PHPStan,
      `openspec validate build-ai-on-drupal-ai --strict`.

## Workflow follow-up

- Archive the change after review, so the `ai-suggestions` spec takes the
  deltas.
- Exposing SEO data to AI agents and Canvas's AI chat is
  `expose-seo-to-canvas-ai`. It starts after this change is merged.
- Archive this change before `link-values-to-fields` and
  `expose-seo-to-canvas-ai`: their `ai-suggestions` deltas build on its text.
- A site-wide cap on suggestion calls needs a product decision first
  (proposal, open decision 5).
