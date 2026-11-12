# Design

## Context

See proposal.md for the motivation. The starting point:

- canvas_metatag_ai has one route, `POST /canvas-metatag/api/ai/suggest`.
  `AiController` checks and caps the request, applies the per-user flood
  limit and maps exceptions to error codes. `Assistant` makes one structured
  chat call and cleans the answer. Nothing is stored.
- The companion change `build-ai-on-drupal-ai` moves the prompts into the AI
  prompt library, honours guardrails, changes the tags to
  `canvas_metatag_ai_search|social|schema`, and adds error mappings. This
  change builds on its engine but does not depend on it for the read tool.
- The dialog's state finds a page's version in `ApiController::pageContext()`:
  the translation, then, for users with update access,
  `AutoSaveManager::getAutoSaveEntityForPreview($page)->entity`. Its
  `resolved` member is `Resolver::resolve()` of that entity.
- The AI module (1.5.x) has a plugin type for tools: `#[FunctionGroup]`,
  `#[FunctionCall]`, `FunctionCallBase`. Any agent, assistant or other tool
  consumer on the site can offer a registered tool.
- Canvas AI (in Canvas 1.x, hidden and experimental) runs its chat as an AI
  Agents orchestrator, `canvas_ai_orchestrator`, with one sub-agent per
  capability. It passes the editor's entity type and id as the tokens
  `[canvas_ai:entity_type]` and `[canvas_ai:entity_id]`. On a node or a
  template the entity type is `node`. It sends no language.
- Canvas's own `canvas_metadata_generation_agent` writes the page description
  from the chat, and `canvas_title_generation_agent` the page title. Both
  apply their result.

## Goals / Non-Goals

**Goals:**

- One read tool that any agent on the site can use, needing only `ai`.
- An SEO sub-agent in Canvas's chat that a site gets by enabling Canvas AI,
  and an administrator can turn off without code.
- No new write path. The dialog stays the only place where SEO values change.
- The suggestion tool only if the server can read a Canvas page's text well.

**Non-Goals:**

- A tool or agent for content templates or nodes.
- Any change to the dialog, to Canvas's agents, or to Canvas AI's prompts
  beyond one appended section.
- Tuning Canvas AI's orchestrator routing beyond that section.

## Decisions

### 1. Tools are AI module function calls, in their own group

`modules/canvas_metatag_ai/src/Plugin/AiFunctionGroup/CanvasMetatagTools.php`
declares the group `canvas_metatag`, "SEO (Canvas Metatag)". `GetSeo` and
(gated) `SuggestSeo` in `src/Plugin/AiFunctionCall/` extend `FunctionCallBase`
and implement `ExecutableFunctionCallInterface` and
`StructuredExecutableFunctionCallInterface`. A small `SeoToolTrait` holds the
page lookup and access check. Function names: `canvas_metatag_get_seo`,
`canvas_metatag_suggest_seo`.

Alternatives considered:

- *An AI Agents plugin.* Makes `ai_agents` a hard requirement for a read that
  does not need it.
- *A Canvas AI tool.* Canvas AI is hidden and experimental, and its tools are
  built to apply changes to the editor.
- *A JSON route for agents.* Agents do not call routes; it would integrate
  with nothing.

### 2. The read tool first; the suggestion tool behind a spike

The read tool needs nothing new: it is `Resolver::resolve()` with a page
lookup. The suggestion tool needs the page's text on the server, and that is
uncertain. Canvas code components render on the server as island elements
whose text is only in their props, which become attributes; an HTML-to-text
conversion drops them. Every component on the farm site's pages is a code component.

The spike (tasks group 4) compares, on two farm site pages built from code
components, (a) a server render converted with `ai.html_to_markdown_converter`
and (b) a walk over the preview render array of the draft's component tree
that collects the string props of code components in tree order (headings kept
as headings), with other components rendered and converted, against what the
dialog reads from the live preview. It writes nothing and calls no provider.
The pass mark is open decision 2 of the proposal.

- **Pass:** group 5 adds `PageText` (the method that passed) and
  `SuggestSeo`.
- **Fail:** group 5 is dropped. Before archive, the gated requirements are
  removed from this change's deltas: in `seo-tools`, the five requirements
  whose names start with "The suggestion tool" or "Suggestion tool"; in
  `seo-access`, the suggestion tool sentence and its scenario; the whole
  `ai-suggestions` delta; and the "when it ships" phrases in
  `seo-chat-agent`. The agent then tells the editor to open SEO and use
  Suggest there.

Alternatives considered:

- *Ship both now.* Very likely returns near-empty text on real Canvas sites,
  so the suggestions would be generic.
- *Take the page text from the caller.* A model can be steered to send
  anything, and Canvas's chat does not hand page text to sub-agent tools.
- *Read tool only, for good.* The gate keeps that as the fallback without
  ruling out the better answer.

### 3. One rule for "the version the editor sees"

The draft-and-translation lookup moves out of `ApiController::pageContext()`
into one public method of the base module, used by the dialog's state and by
the tools, so the two cannot drift. The tools ask with no language, so they get
the translation the request's content language selects, as the dialog's state
does when it names none. A draft-only translation is not reachable that way.

Alternatives considered:

- *Copy the rule into the submodule.* It would drift. An earlier draft of this
  design used `getAutoSaveEntity()`, which differs from the dialog for
  translations.
- *A language argument on the tools.* Canvas AI has no language to pass. Open
  decision 4.

### 4. The read tool returns the resolved output

`GetSeo` returns what `Resolver::resolve()` gives for the editor's version:
title, description, social title, description and image address, robots
directives, canonical, structured data type, `withheld`, `missing_required`,
`missing_recommended`. About ten `Label: value` lines for the model, and the
same as a map for structured consumers. Each value goes through
`Values::plain(…, 300)`. Every token value in it is already what anonymous
visitors may see.

Alternatives considered:

- *The stored overrides.* The model would have to know the cascade, and the
  stored field is not public (seo-access).
- *The whole head.* Long, and custom JSON-LD carries free text from the page
  into the chat for no benefit.

### 5. Tools check access themselves, on every call

A tool cannot rely on whoever runs it: the agent, Canvas AI's permission "Use
Drupal Canvas AI", or another tool consumer says nothing about SEO or this
page. So each call checks `edit canvas metatag`, `view` and `update` on the
translation, and the suggestion tool also `use canvas metatag ai`. The entity
type is a context with an `AllowedValues: ['canvas_page']` constraint, so
`node` is refused before `execute()` loads anything. Refusals use one fixed
sentence.

Update access is required, not only view: the tool reads the draft. The
dialog's state shows viewers the stored version instead, but the chat runs in
the editor, where update access is the norm, and one rule is simpler to test.

### 6. A sub-agent and an override, as optional configuration

`config/optional/ai_agents.ai_agent.canvas_metatag_seo_agent.yml` and
`config/optional/ai_agents.ai_agent_override.canvas_metatag_seo_chat.yml`.
The override has `parent_agent: canvas_ai_orchestrator`, `tools_add` with
`ai_agents::ai_agent::canvas_metatag_seo_agent`, `tools_remove: []`, empty tool
settings and limits, `prompt_mod_strategy: suffix`, and
`fail_if_parent_missing: false`. The agent has `max_loops: 4`, no default
information tools, no structured output, and a fixed secured system prompt.

Every dependency goes under `dependencies.enforced` (module
`canvas_metatag_ai`, `ai_agents`, `canvas_ai`; for the override also config
for both agents). A config entity's dependencies are recalculated on save and
only `enforced` survives; the override calculates none of its own.

Alternatives considered:

- *Add the read tool straight to the orchestrator* through the override's
  `tools_add`. Saves one model loop per turn and the agent file. Against:
  Canvas structures each capability as a sub-agent, its orchestrator prompt
  says to delegate, and a sub-agent is reusable and visible in the agents UI.
  Open decision 1.
- *A new submodule for the bridge.* One more module to enable, for two YAML
  files.
- *Injecting the tool at runtime* (a config override, or an event subscriber
  on agent requests). Invisible in the agents UI and in config export.
- *Wrapping or replacing Canvas's description agent.* See decision 8.

### 7. The page comes from Canvas AI's context, entity type included

Both contexts are forced with `tool_usage_limits`
(`action: force_value`, `hide_property: true`) from `[canvas_ai:entity_type]`
and `[canvas_ai:entity_id]`. Sub-agents inherit the parent's token context.
The model neither sees nor sets them.

Alternative considered: *force the entity type to `canvas_page`.* On a node
the chat sends the node's id, which would then load an unrelated Canvas page
with the same id. Forced from the token, `node` fails the constraint and the
tool never runs.

### 8. Canvas keeps the description and the page title

The suggestion tool has no `description` kind. The override's text sends the
page description to `canvas_metadata_generation_agent` and the page title to
`canvas_title_generation_agent`, and "title in search results", social and
structured data to our agent. We do not call, wrap, override or remove
Canvas's agents. Applying a description from the chat is Canvas's product
decision; the dialog keeps its reviewed variants of the same field, and the
last write wins in Canvas's draft.

Alternative considered: *route descriptions to our agent.* Two agents for one
field confuse routing, and ours could not apply its suggestion.

### 9. Suggestions only, and the chat says how to use one

No tool implements Canvas AI's builder response interface (`@internal`), which
is how Canvas's chat applies a tool's result to the editor. The tool's text
says "Not applied". The agent's secured prompt ends every answer with "To use
one, open SEO in the top bar and paste it into the matching field."

Alternative considered: *tell the editor to use Suggest in the dialog.* That
is a second paid call and returns different variants, so the one the editor
liked is gone.

### 10. The suggestion tool reuses the dialog's engine and budget

`SuggestSeo` calls `Assistant::suggestText()` (kinds `search_title` →
`['title']`, `social` → both social fields, three variants) or
`suggestSchema()`, with a new trailing `$via` argument (`dialog` or `chat`)
that adds the tag `canvas_metatag_ai_dialog` or `canvas_metatag_ai_chat`. It
passes `entity_context` request metadata (`entity_type`, `entity_id`, `uuid`,
`bundle`), the shape AI module automators use, so logging modules can tie the
call to the page.

A `search_title` request carries the page's effective title ending and
separator as `page.ending`, read by the same cascade the head uses
(`link-values-to-fields`, decision 13), so tool variants leave room for the
ending as the dialog's do. Braces in a variant stay plain text: after
`link-values-to-fields` a used suggestion is typed text, which is never
scanned for values, and `Assistant::withoutBraces()` is gone.

The flood check moves from `AiController` into `Assistant::throttle()`, so the
route and the tool share one budget with the same event and numbers. Errors go
through one exception-to-code mapping and the same sentences
(`AiController::code()` and `message()`). `build-ai-on-drupal-ai` keeps the
mapping inside the controller's `match`, so this change extracts it. A tool
failure throws `AiFunctionCallingExecutionError` with that sentence.

Alternatives considered: *a budget of the tool's own* doubles what one account
can spend; *own messages* drift from the dialog's.

### 11. Optional dependencies

`ai_agents` is not in the info file. It goes into `require-dev` (kernel tests)
and `suggest` in `composer.json`. `canvas_ai` ships with Canvas. The tools and
the dialog work on `ai` alone.

### 12. Tests

- Kernel tests use the AI module's echo test providers and always set the
  provider explicitly. No test enables a paid provider.
- No Playwright test of Canvas's chat: it needs a model that calls tools, and
  Canvas's own chat tests intercept its controller. The kernel tests cover
  the bridge.
- Nobody chats on the farm site: Canvas's chat passes the site's chat default (the
  echo provider) to sub-agents, which proves nothing, and agents started
  elsewhere use the tool-calling default, which is a paid provider there.

## Canvas and AI internals relied on

Each gets a row in ARCHITECTURE.md section 11 with the test that fails when it
changes.

| Internal | Used for | If it changes | Caught by |
|---|---|---|---|
| Canvas AI tokens `[canvas_ai:entity_type]`, `[canvas_ai:entity_id]`, and entity type `node` on nodes and templates | forcing the page | tools get no page and refuse | `SeoAgentTest::testForcedPage`, `testNodeIsRefused` |
| Orchestrator id `canvas_ai_orchestrator`; sub-agent tool id `ai_agents::ai_agent::<id>` | the override | the agent is not offered; nothing breaks | `SeoAgentTest::testOrchestratorOffersAgent` |
| Sub-agents inherit the parent's token context (AI Agents) | forcing the page in the sub-agent | tools get an unreplaced token and refuse | `SeoAgentTest::testForcedPage` |
| `tool_usage_limits` keys `action`, `values`, `hide_property` (config schema `type: ignore`) | forcing the page | the model could choose ids; access is still checked | `SeoAgentTest::testForcedPage`, `ShippedConfigTest` |
| `ai_agent_override` fields and the `suffix` strategy | the bridge | the agent is not offered | `SeoAgentTest`, `ShippedConfigTest` |
| Canvas AI applies a tool result to the editor only through its builder response interface (`@internal`) | read-only in the chat | a tool's text could be applied | `SeoToolsTest::testToolsCannotApply` |
| `AutoSaveManager::getAutoSaveEntityForPreview()` (existing row) | tools read the editor's version | tools read the stored page | `SeoToolsTest::testReadsEditorDraft` |
| AI module `FunctionGroup`, `FunctionCall`, `FunctionCallBase`, context constraints, `AiFunctionCallingExecutionError` | the tools | tools missing or unvalidated | `SeoToolsTest` |
| (gated) Preview render array of a page's component tree; code components as island elements with text in props | page text | suggestions from little text | `SeoToolsTest::testPageText` |
| (gated) `ai.html_to_markdown_converter` | text of other components | same | `SeoToolsTest::testPageText` |

## Risks / Trade-offs

- [Canvas AI is experimental; its orchestrator prompt and ids may change] →
  The override only appends, does not fail when the parent is missing, and
  `SeoAgentTest` checks that the orchestrator still offers the agent.
- [Cost per chat turn: the sub-agent adds at least one model loop; the
  suggestion tool adds a third paid call] → The read tool ships first and makes
  no model call; the suggestion tool shares the per-user limit. A site-wide cap
  is open decision 3.
- [Page-derived text reaches the chat through tool results] → Tool output is
  cleaned, bounded and plain; the secured prompt says tool results are
  material; the tools write nothing. The sub-agent's free-text reply then
  reaches the orchestrator, which has write tools. That reply is not bounded
  by our cleaners, so we claim no bound for it. It does not widen what is
  exposed: Canvas already gives the orchestrator the same page's layout.
- [The agent may still say it applied something] → Cosmetic, because nothing
  can be written through it. The secured prompt forbids it; an optional manual
  evaluation checks it against a real model (open decision 5).
- [Text that code components fetch in the browser is not on the server] →
  Documented gap of the suggestion tool; the dialog reads the live preview and
  has no such gap.
- [A translation is reviewed in the request's content language, which may not
  be the one being edited] → Open decision 4; documented.
- [`tool_usage_limits` is not checked by config schema] → `SeoAgentTest`
  asserts that the forced page reached the tool.
- [Kernel tests with Canvas, AI Agents and Canvas AI are slow] → One class,
  `SeoAgentTest`, holds every case that needs them.

## Migration Plan

- The module has no release, so there is no update hook. Dev sites (the farm
  site included) reinstall the submodule: `drush pmu canvas_metatag_ai && drush en
  canvas_metatag_ai`. It stores no data.
- The agent and override install from `config/optional` with `ai_agents` and
  `canvas_ai`, now or later.
- Rollback: disable the override in the agents UI (chat only), or uninstall
  the submodule. Enforced dependencies remove the agent and the override.
- After a first release, new optional config needs a post-update that calls
  `installOptionalConfig()` for the submodule, and a changed agent prompt is
  updated only where the stored text equals the previous shipped text.

## Open Questions

- The exact wording of the agent's instructions and of the override's section.
  It can be tuned without changing the specs, as long as the rules in
  `seo-chat-agent` hold.
- Whether the read tool's labels are translatable strings. The model reads
  them, so English may be enough.
