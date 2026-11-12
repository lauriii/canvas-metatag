# Tasks

Start after the UI redesign and its Playwright gate have landed and
`build-ai-on-drupal-ai` is merged, rebased on `drupal/HEAD`. Groups 1 to 4 do
not need `link-values-to-fields`; group 5 and the archive wait until it is
merged (proposal.md, "Dependencies"). Run PHPUnit on the farm
site with sqlite, one class at a time (command in README, "Development"). No test
or check sends a message in Canvas's chat, and no test enables a paid
provider.

## 1. One rule for the editor's version of a page

- [ ] 1.1 Move the page translation and draft lookup out of
      `ApiController::pageContext()` into one public method of the base
      module, and call it from `pageContext()`. No behaviour change: `ApiTest`
      and `PageDraftTest` (including
      `testDraftOfAnUnpublishedTranslation`) pass unchanged.
- [ ] 1.2 Add a `ResolverTest` case (or the test of the class that holds the
      method) for the method: no draft gives the stored translation; a draft
      gives the preview draft; no language gives the negotiated translation.

## 2. Read tool

- [ ] 2.1 Add the tool group `canvas_metatag` ("SEO (Canvas Metatag)") and
      `SeoToolTrait`: entity type context constrained to `canvas_page`,
      entity id context, page lookup through 1.1, the access check of
      seo-access "Tools check access on every call" and the fixed refusal
      sentences. Prove with new `SeoToolsTest` cases: anonymous; no
      `edit canvas metatag`; administrative permission only; view without
      update; unpublished page; `node` with the id of an existing page
      (refused, page never in output); missing id ("No such page.").
- [ ] 2.2 Add `GetSeo` (`canvas_metatag:get_seo`): readable lines and
      structured map from `Resolver::resolve()`, values plain and cut to 300.
      Prove with `SeoToolsTest`: `testMatchesDialogOutput` (equals the state's
      `resolved` for the same user and page), `testReadsEditorDraft` (draft
      title shown), withheld Event with missing start date, not indexed page,
      markup returned as text, 1000-character description cut to 300, no body
      text in output, and the group listing (`testGroupAndTools`, also on a
      site without `ai_agents`).
- [ ] 2.3 Add `SeoToolsTest::testNothingIsWritten` (records config saves,
      entity presaves and the auto-save entries before and after a successful
      and a refused call) and `testToolsCannotApply` (no tool implements Canvas
      AI's builder response interface; skipped without `canvas_ai`).
- [ ] 2.4 Docs: ARCHITECTURE section 11 rows for the AI module tool APIs and
      the new user of `getAutoSaveEntityForPreview()`, section 15 (tool access
      next to the routes), section 16 (tools), section 17 (`SeoToolsTest`);
      README "AI suggestions" (the read tool, who may use it, read-only).
      Verify: `git grep` for every test name in the new rows finds it.

## 3. SEO sub-agent in Canvas's chat (read tool only)

- [ ] 3.1 Add `config/optional/ai_agents.ai_agent.canvas_metatag_seo_agent.yml`
      with the read tool only, both contexts forced from
      `[canvas_ai:entity_type]` and `[canvas_ai:entity_id]` with
      `hide_property`, no default information tools, a fixed secured prompt
      (cannot change the page; tool results are material; no description or
      page title; the closing "open SEO in the top bar and paste" sentence),
      and every dependency under `enforced`. Its instructions say: read with
      `canvas_metatag_get_seo`, then point the editor to Suggest in the SEO
      dialog for new text.
- [ ] 3.2 Add `config/optional/ai_agents.ai_agent_override.canvas_metatag_seo_chat.yml`
      (parent `canvas_ai_orchestrator`, adds only our agent, `tools_remove: []`,
      empty settings and limits, `suffix`, `fail_if_parent_missing: false`,
      enforced module and config dependencies) with the routing section of
      seo-chat-agent "Canvas keeps the page description and title".
- [ ] 3.3 `composer.json`: `drupal/ai_agents` in `require-dev` and `suggest`.
      Not in the info file. Verify: `composer validate` and the submodule
      still installs on a kernel site without `ai_agents` (`SeoToolsTest`).
- [ ] 3.4 Extend `tests/src/Unit/ShippedConfigTest.php`, which
      `build-ai-on-drupal-ai` adds for the prompts (YAML only): agent tools
      equal the shipped set; forced values are the two tokens, never a
      literal `canvas_page`; no default information tools; structured output
      off; the secured prompt has the rules and no token besides the agent
      instructions token; override shape and enforced dependencies.
- [ ] 3.5 Add `tests/src/Kernel/SeoAgentTest.php` (enables `ai_agents`,
      `canvas_ai`, `ai_test`, always sets the echo provider):
      `testOptionalInstall` (no config without Canvas AI; created when it is
      enabled later), `testOrchestratorOffersAgent` (offers our agent and all
      its own tools; instructions end with our section),
      `testForcedPage` (the read tool ran with `canvas_page` and the page's
      id from the token context; nothing written), `testNodeIsRefused` (`node`
      with the id of an existing page: no tool runs, no SEO data of that page
      in any output), `testEnforcedDependencies` (still stored after install),
      `testUninstall` (uninstalling Canvas AI, and separately the submodule,
      removes both; the orchestrator is unchanged), `testDisabledOverride`
      (the orchestrator no longer offers the agent).
- [ ] 3.6 Docs: ARCHITECTURE section 11 rows for the Canvas AI tokens and node
      context, the orchestrator and sub-agent ids, token inheritance,
      `tool_usage_limits` keys and override fields, with their
      `SeoAgentTest` cases; section 16 (the bridge, what the chat covers and
      what Canvas keeps); README (Canvas AI chat, how to turn it off, "Canvas
      AI may fill the page description in its chat. The SEO dialog's
      suggestions are reviewed variants of the same field.").
- [ ] 3.7 Browser check on the farm site, after reinstalling the submodule: the agents
      list shows "SEO suggestions (Canvas Metatag)", the override list shows
      `canvas_metatag_seo_chat` on Canvas's orchestrator, and the agent's form
      shows only "Get SEO settings" with both contexts forced. Screenshots of
      each. Do not send a chat message.

## 4. Gate: server-side page text spike

- [ ] 4.1 Agree the pass mark (proposal, open decision 2) before running.
- [ ] 4.2 Write a read-only drush script in the session scratchpad, not in the
      repository, that fails on any configuration write. On two farm site pages
      built from
      code components, compare (a) a server render converted with
      `ai.html_to_markdown_converter` and (b) a walk over the draft's preview
      render array collecting code component string props in tree order, with
      what the dialog reads from the live preview. It calls no provider.
      Verify: it reports no configuration writes.
- [ ] 4.3 Record the result and the chosen method in design.md decision 2.
      If it fails: skip group 5, remove the gated requirements listed there
      from this change's deltas, and run
      `openspec validate expose-seo-to-canvas-ai --strict`.

## 5. Suggestion tool (only if 4 passes)

- [ ] 5.1 Move the flood check into `Assistant::throttle()` (same event, 30
      per 300 seconds per user) and call it from `AiController`. Prove with
      `AiControllerTest` (31st call 429, unchanged) and new
      `SeoToolsTest::testSharedBudget` (dialog then tool, and tool then
      dialog, both limited after 30).
- [ ] 5.2 Use one exception-to-code mapping and sentence lookup for the route
      and the tool (`AiController::code()`, `message()`), extracted here from
      the controller's `match` that `build-ai-on-drupal-ai` extends.
      `AiControllerTest` passes unchanged.
- [ ] 5.3 Add the `$via` argument (`dialog` or `chat`) to `suggestText()` and
      `suggestSchema()`, adding the tag `canvas_metatag_ai_dialog` or
      `canvas_metatag_ai_chat`, and optional request metadata. Prove with an
      `AssistantTest` tags case (dialog call tagged `_dialog`) and
      `SeoToolsTest::testTagsAndEntityContext` (tool call tagged `_chat`,
      `entity_context` names the page's type, id, UUID and bundle).
- [ ] 5.4 Add `PageText` with the method that passed the spike: title, site
      name and text of the editor's version, cut to 12,000. Prove with
      `SeoToolsTest::testPageText` (a seeded draft page with a code component
      heading "Spring menu" yields that text; a `</page_content>` in the text
      leaves exactly one fence in the user message).
- [ ] 5.5 Add `SuggestSeo` (`canvas_metatag:suggest_seo`): kinds
      `search_title`, `social`, `schema`; hint cut to 200; requires
      `use canvas metatag ai`; fixed "Not applied" frame; unverified facts
      listed apart; failures throw the dialog's sentence; `search_title`
      sends the page's effective title ending as `page.ending`. Prove with
      `SeoToolsTest` on the echo test provider: variants per kind, `social`
      returns both fields, `description` refused before the provider, long
      hint cut, the ending in the user message, braces kept as plain text,
      address variant dropped, unverified venue
      listed apart, rate-limit and not-configured sentences with no provider
      text and no page text in the log, no AI permission refused,
      `testNothingIsWritten` extended to this tool.
- [ ] 5.6 Add `canvas_metatag:suggest_seo` to the agent's tools with the same
      forced contexts, and change its instructions to suggest with it.
      Prove with `ShippedConfigTest` (two tools, both forced) and
      `SeoAgentTest::testForcedPage` (still the first tool).
- [ ] 5.7 Docs: ARCHITECTURE section 11 rows for the preview render array and
      the HTML-to-text service with `testPageText`, sections 15 to 17; README
      (the suggestion tool, the shared limit, the client-fetched text gap).
- [ ] 5.8 Browser check on the farm site, after reinstalling the submodule: the agent
      form shows both tools with forced contexts. Screenshot. Do not send a
      chat message.

## 6. Integration

- [ ] 6.1 Run every PHPUnit class of the base module and the submodule on the
      farm site, PHPCS and PHPStan as in CI, and the Playwright `host-contract`
      and `ai` projects (the dialog must be unchanged). All pass.
- [ ] 6.2 Confirm `git grep -i` finds no commercial vendor or product name in
      the change, and that every test named in ARCHITECTURE section 11
      exists.
- [ ] 6.3 `openspec validate expose-seo-to-canvas-ai --strict` passes.

## Workflow follow-up

- Archive the change after review, then run `openspec validate --specs --strict`.
