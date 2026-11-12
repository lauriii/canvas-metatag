## 1. Before starting

- [ ] 1.1 Wait until the dialog redesign and its Playwright gate have landed,
      then rebase onto `drupal/HEAD`. Verify: the submodule's kernel tests
      (`AssistantTest`, `AiControllerTest`) and the Playwright `ai` project
      pass unchanged on the farm site.
- [ ] 1.2 Settle the proposal's open decisions 1 to 4, or accept their
      defaults. Verify: the proposal records the outcome; if decision 1 goes
      to two prompts, update the spec delta and tasks 3.1 to 3.4 first.

## 2. Hardening on the AI module (no visible change except `blocked`)

- [ ] 2.1 Set `ai:ai (>=1.5.0)` in `canvas_metatag_ai.info.yml` and add the
      `suggest` entry for `drupal/ai` to `composer.json`. Verify:
      `composer validate` passes and the submodule still enables on the farm
      site.
- [ ] 2.2 Make `EchoSeoProvider::getConfiguredModels()` list `echo-json` with
      the structured response capability, and set
      `default_providers.chat_with_structured_response` in
      `CanvasMetatagTestSetup` (AI mode). Verify:
      `AssistantTest::testProviderResolutionOrder` passes and the Playwright
      `ai` project still passes.
- [ ] 2.3 Add the `blocked` reason to `AiException` and the threshold-aware
      guardrail check to `Assistant::ask()`, before decoding. Verify: new
      `AssistantTest::testGuardrailStopIsBlocked` (a saved `regexp_guardrail`
      in a global set: a matching page text is blocked before generation; a
      post-generation set matching the echo answer is blocked; a set with
      `stop_threshold: 2` and one match is not blocked and returns cleaned
      variants).
- [ ] 2.4 Keep the full-trust link filter, `json_decode()` before the decoder,
      and the schema array, with comments saying why. Verify: new
      `AssistantTest::testBareJsonWithSpaces` (`{ "suggestions": …}`, CRLF and
      tab pretty-printing decode) and `testNoDeprecations` (the schema reaches
      the request as an array with `strict: true`, no `E_USER_DEPRECATED`);
      `testSuggestText` still returns "fish & chips <fresh>" intact.
- [ ] 2.5 Remove the 30-second `http_client_options` override. Verify: new
      `AssistantTest::testSiteTimeoutApplies` (the provider is created without
      configuration of ours).
- [ ] 2.6 Map `AiException('blocked')` to `blocked`,
      `AiAccessDeniedException` and `AiMissingFeatureException` to
      `ai_not_configured`, and `AiBrokenOutputException` to
      `invalid_response`. Verify: `AiControllerTest::testErrorCodes` with a
      case for each.
- [ ] 2.7 Drop `@message` from the failure record. Verify:
      `AiControllerTest::testNothingOfThePromptIsLogged` expects records
      without the provider's message, plus one record for a default that names
      a plugin that cannot be created.
- [ ] 2.8 Change the `blocked` sentence to "The site's AI rules stopped this
      request." in `AiController::ERRORS` and `Suggest.tsx`, and rebuild
      `extension/dist`. Verify: `npm run verify`; new Playwright test "a site
      guardrail blocks a request and the tray says so" in `ai.spec.ts`
      (setup saves a global `regexp_guardrail` matching `#policy`; typing it
      in Refine shows the sentence, writes nothing and keeps Try again).
- [ ] 2.9 Browser check on the farm site: trigger the guardrail from Refine
      and take a screenshot of the tray.
- [ ] 2.10 Docs: README "AI suggestions" (guardrails apply; a stop is
      "blocked"); ARCHITECTURE §16 (guardrail rule, answer reading, log
      record), §17 (new tests), and a §16 table of the AI module APIs relied
      on, as in design.md. Verify: every API row names a test that exists.

## 3. Prompts in the AI prompt library

- [ ] 3.1 Add the three `ai.ai_prompt_type.canvas_metatag_*` and three
      `ai.ai_prompt.canvas_metatag_*__default` files to `config/install`, with
      enforced module dependencies and labels that say only the default prompt
      is used. Verify: new unit test `ShippedConfigTest` (each type declares
      exactly its variables, all required; each default prompt contains its
      variables and not `<page_content>` or "Answer with JSON"; every file
      depends on `canvas_metatag_ai`; every label says "default prompt only").
- [ ] 3.2 Add `Assistant::system()`, the `FENCE` and `SHAPE` constants, and
      delete `TEXT_PROMPT` and `SCHEMA_PROMPT`. Verify: `AssistantTest`
      installs the submodule's config; `testPrompts` asserts the system prompt
      is the shipped prompt with server values followed by `FENCE` and `SHAPE`
      exactly, `[site:name]` stays literal, and the user message is unchanged;
      new `testEditedPromptKeepsSafetyTail` ("Say hello." still ends with the
      tail) and `testOnlyDefaultPromptIsUsed`.
- [ ] 3.3 Route text requests to the search or social prompt, and tag calls
      `canvas_metatag_ai_search|social|schema`. Verify: new
      `AssistantTest::testSocialUsesSocialPrompt` and `testTags`.
- [ ] 3.4 Refuse text requests that mix social and search fields in
      `AiController::read()`. Verify: `AiControllerTest::testBadRequests` with
      `title` + `social.title` → 400, no provider call.
- [ ] 3.5 Add `no_prompt` to `Assistant::status()` (after the provider
      reasons) and throw `not_configured` for a missing or blank prompt.
      Verify: new `AssistantTest::testMissingPrompt` (deleted and blank
      prompt; `no_provider` wins when both apply);
      `AiControllerTest::testErrorCodes` (422 `ai_not_configured`, no provider
      call) and `testCapabilitiesInState` (`no_prompt`).
- [ ] 3.6 Add the prompt kind to the failure record. Verify:
      `AiControllerTest::testNothingOfThePromptIsLogged`.
- [ ] 3.7 Verify end to end: new Playwright test "suggestions still work
      after an admin edits the prompt" in `ai.spec.ts` (setup sets the search
      prompt to a short custom text; the title suggestion still shows three
      variants).
- [ ] 3.8 Browser check on the farm site: reinstall the submodule, open the
      Prompt Library and take a screenshot of the three prompts and their
      type labels.
- [ ] 3.9 Docs: README (prompts are edited in the Prompt Library, with the
      AI module's prompt permission; only the default prompt is used; the
      fence and shape are not editable; the new tags), ARCHITECTURE §16 and
      §19 (prompts live in `config/install`, not in `Assistant.php`).

## 4. Status report and the dialog's Site line

- [ ] 4.1 Add `AiHooks::runtimeRequirements()` and make
      `Assistant::provider()` public. Verify: new kernel test
      `RequirementsTest` (OK naming provider, model and operation; no
      provider; provider not set up; prompt deleted; no provider call in any
      case).
- [ ] 4.2 Add `no_prompt` to the reason union in `types.ts` and the Site
      view's line "AI suggestions are off: a suggestion prompt is missing.",
      keeping the two existing sentences. Move the reason-to-sentence mapping
      into `model.ts`, and rebuild `extension/dist`. Verify: a `model.test.ts`
      case per reason; `npm run verify`.
- [ ] 4.3 Add to the permission description that sites which log AI requests
      may store the page text. Verify: `ShippedConfigTest` asserts the
      sentence in `canvas_metatag_ai.permissions.yml`.
- [ ] 4.4 Browser check on the farm site: screenshots of the status report
      entry when on and when a prompt is deleted, and of the Site view line
      in the second state. Restore the prompt afterwards.
- [ ] 4.5 Docs: README (the status report entry; the observability caveat,
      worded after checking what an empty `log_tags` means), ARCHITECTURE
      §15 and §16. Verify: the README's links and route names match
      `RequirementsTest`.

## 5. Integration

- [ ] 5.1 Run the base module's and the submodule's PHPUnit tests, PHPStan,
      PHPCS and cspell on the farm site. Verify: all pass.
- [ ] 5.2 Run `npm run verify` and check that a fresh build matches the
      committed `extension/dist`. Verify: no diff.
- [ ] 5.3 Run the Playwright `host-contract` and `ai` projects, one suite at a
      time. Verify: all pass.
- [ ] 5.4 Run `openspec validate build-ai-on-drupal-ai --strict` and search
      the changed files for commercial vendor names. Verify: clean, and none
      found.

## Workflow follow-up

- Archive the change after review, so the `ai-suggestions` spec takes the
  deltas.
- Exposing SEO data to AI agents and Canvas's AI chat is
  `expose-seo-to-canvas-ai`. It starts after this change is merged.
- Archive this change before `link-values-to-fields` and
  `expose-seo-to-canvas-ai`: their `ai-suggestions` deltas build on its text.
- A site-wide cap on suggestion calls needs a product decision first
  (proposal, open decision 5).
