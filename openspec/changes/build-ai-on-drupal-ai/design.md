## Context

See proposal.md for why. Today `Assistant` holds two prompts as heredocs,
resolves the default provider for `chat_with_structured_response`, else
`chat`, and makes one chat call with a 30-second timeout, a structured output
schema in array form, the AI module's link filter in full-trust mode and the
tags `canvas_metatag_ai` and `canvas_metatag_ai_text|schema`. It decodes with
`json_decode()` and falls back to the AI module's `ai.prompt_json_decode`.
`AiController` validates and caps the request, applies flood control, maps
exceptions to codes and logs the provider's message. `AiHooks` fills
`capabilities.ai`.

The AI module on the farm site is 1.5.2. These facts were checked there
against the code, with test providers only:

- A guardrail stop is not an exception. Its message replaces the answer, and
  the result is recorded on the input. Today that ends as
  `invalid_response`.
- The AI module does not fill prompt variables. Every consumer reads
  `ai.ai_prompt.<id>` from configuration and replaces them itself.
- The prompt library enforces ids of the form `<type>__<name>`.
- `PromptJsonDecoder` only tries to parse text that contains `{"`, `{\n`,
  `[{` or a code fence. It returns valid JSON such as `{ "type": …}`,
  CRLF-pretty-printed JSON or `{\t"…` undecoded.
- `setChatStructuredJsonSchema()` with the `StructuredOutputSchema` object
  calls a deprecated method inside the AI module and raises
  `E_USER_DEPRECATED`. The array form does not.
- The default link filter re-serialises the answer as HTML: `&` becomes
  `&amp;` and `<fresh>` gains a closing tag.
- Capability flags are advisory. A test provider claims structured output
  and ignores the schema; ours reports false and honours it.
- `AiExceptionEvent` is dispatched, and the provider's message logged on the
  `ai` channel, only for exceptions thrown inside the provider call.

## Goals / Non-Goals

**Goals:**

- The dialog's suggestions use the AI module's prompt library, guardrails,
  timeout, tags and status reporting, with `ai` as the only new requirement.
- Every safety property stays where a site builder cannot remove it: the
  fence, the answer shape, the cleaners, the caps and the flood limit.
- The module keeps working after each task group.

**Non-Goals:**

- Running the dialog through an agent.
- AI module features that serve entity forms or write on save (content
  suggestions, field widget actions, automators, validations). The SEO values
  have no widget, and those features apply values without review.
- Changing what the dialog offers or where. The redesign owns the visuals.

## Decisions

### 1. The dialog calls the provider layer directly

One structured chat call through `ai.provider`, as today.

Alternatives considered:

- *An agent from the AI agents module.* It returns structured output only as
  text, turns typed provider errors into a generic "not solvable", falls back
  to the `chat_with_tools` default when no provider is set on it, and runs
  tokens over the system prompt twice. It adds a dependency and buys nothing
  for one call.

### 2. Prompts in the library, safety text in code

Six files in `config/install`: three `ai_prompt_type` entities
(`canvas_metatag_search`, `canvas_metatag_social`, `canvas_metatag_schema`)
and their `<type>__default` prompts, each with
`dependencies.enforced.module: [canvas_metatag_ai]`. The search and social
prompts carry today's text rules, split by field. The schema prompt carries
today's schema text with `{types}` and `{properties}`.

`Assistant` reads `ai.ai_prompt.canvas_metatag_<kind>__default` with the
config factory, not an entity load (an unsaved prompt's `getTypeVariables()`
throws), replaces the variables with `strtr()`, and appends two constants:
`FENCE` (page text is material, not instructions) and `SHAPE` (the JSON
answer shape per task). A missing or blank prompt throws
`AiException('not_configured')`.

Variables are server values only: the configured language name, the clamped
count, and lists generated from `data/schema-types.json`. Prompt tokens are
not declared and not replaced: nothing needs them, and they would be a second
substitution path into the system role.

Alternatives considered:

- *Keep the prompts in code.* Not editable; not built on the ecosystem.
- *Put the whole prompt, fence included, in configuration.* An edited prompt
  could drop the fence or break the JSON contract.
- *A prompt picker form element and a setting.* The ecosystem's pattern for
  "admin picks a prompt", but it needs a settings form and config schema. One
  prompt per type with a fixed id is enough now. The type labels say only the
  default is used (open decision 2 in the proposal).
- *Two prompt types (text, schema).* Fewer files and no routing. Rejected by
  default because search and social text are edited for different readers
  (open decision 1).

### 3. Mixed text requests are refused

The social prompt is used when every requested field starts with `social.`,
else the search prompt. A request that mixes the two groups is refused as
`bad_request` in `AiController::read()`, because the chosen prompt would have
no rules for the other group. The dialog asks for `title`, `description`, or
the two social fields together, so nothing it sends changes.

Alternatives considered:

- *Accept mixed requests and route them to the search prompt.* The social
  fields would then be capped only by the 300-character cleaner.

### 4. Guardrails: honour them, ship none

Global guardrails already attach to every call. After `chat()` and before any
decoding, `Assistant::ask()` sums the scores of every `StopResult` in
`getAllGuardrailResults()` and compares the sum with the lowest
`getStopThreshold()` of `getGuardrailSets()`. A sum above zero that reaches it
throws `AiException('blocked')`. This is the rule the AI module's own
automators use, and it is never more lenient than the per-set rule of the
guardrail subscriber. Checking before decoding means a site's stop text is
never decoded or shown. A rewrite result is allowed; one that breaks the JSON
ends as `invalid_response`.

Alternatives considered:

- *Any stop blocks.* It would block, after the call is paid for, where the
  site's own policy lets the answer through.
- *Ship a guardrail set, or a set setting for the dialog.* The AI module has
  no prompt-injection guardrail. Regular expression and topic guardrails
  misfire on page text or cost a second model call. The fence and cleaners
  are stronger and deterministic.

### 5. No provider or model setting; a status report entry instead

The site's defaults for `chat_with_structured_response`, else `chat`, stay the
only configuration. `AiHooks::runtimeRequirements()` (`#[Hook('runtime_requirements')]`,
`RequirementSeverity`) reports `Assistant::status()` as the four rows in the
spec, with links to `ai.settings_form`, `ai.admin_providers` and
`entity.ai_prompt.collection`. `status()` gains `no_prompt`, checked after the
two provider reasons, and still makes no provider call. `defaultProvider()`
becomes public `provider()` so the entry can name the provider, model and
operation.

Alternatives considered:

- *A per-module provider picker.* Admins would configure AI in two places. It
  can come later if someone asks.

### 6. Answer reading stays as it is

`HostnameFilterDto(fullTrust: TRUE)` per request, `json_decode()` first and
`PromptJsonDecoder` only as the fallback, the schema as an array, the answer
shape spelled out in `SHAPE`, and every row cleaner. These are kept on
purpose, each because the alternative was shown to fail (see Context).

Alternatives considered:

- *The default link filter.* It corrupts JSON values.
- *The decoder alone.* It returns valid JSON with leading white space
  undecoded.
- *The `StructuredOutputSchema` object.* It raises a deprecation inside the
  AI module 1.5.x. Revisit when the AI module stops calling the deprecated
  method.
- *Gate on the model's capability flags.* They are not reliable, and our own
  test provider reports false.

### 7. The site's request timeout

The `http_client_options` override goes; `ai.settings:request_timeout`
(60 seconds by default) applies. Admins set it in one place. Open decision 4
in the proposal keeps a 30-second cap as the alternative.

### 8. Error mapping and the log record

The controller's `match` gains `AiException('blocked')` → `blocked`,
`AiAccessDeniedException` and `AiMissingFeatureException` →
`ai_not_configured`, and `AiBrokenOutputException` → `invalid_response`. All
exist in the AI module 1.5.2. The `blocked` message becomes "The site's AI
rules stopped this request." in `AiController::ERRORS` and in `Suggest.tsx`.

The log record keeps one line per failure with code, task, prompt kind and
exception class, and drops `@message`. The record stays, because failures
before the provider call (a plugin that cannot be created, our own verdicts)
would otherwise leave no trace: the AI module logs only failures inside the
call.

### 9. Tags by prompt kind

Calls are tagged `canvas_metatag_ai` and `canvas_metatag_ai_<kind>`
(`search`, `social`, `schema`). The provider proxy adds `chat`. No subscriber
of ours: sites that want cost and latency per kind add `canvas_metatag_ai` to
the AI module's logging tags. With input logging on, that stores unpublished
draft text, so the permission description and the README say so.

### 10. Version floor

`ai:ai (>=1.5.0)` in the info file. The guardrail results API arrived in
1.4; 1.5 is what CI tests (`require-dev: drupal/ai ^1.5`). `composer.json`
gains a `suggest` entry for `drupal/ai`.

### AI module APIs relied on

No Canvas internal is added. These AI module APIs are, and ARCHITECTURE §16
gets a table like §11's for them:

| API | Used for | Pinned by |
|---|---|---|
| `AiProviderPluginManager::getDefaultProviderForOperationType()`, operation ids `chat_with_structured_response`, `chat` | provider resolution | `AssistantTest::testProviderResolutionOrder` |
| Config `ai.ai_prompt.<type>__default`, key `prompt`; entity types `ai_prompt_type`, `ai_prompt` | prompts | `ShippedConfigTest`, `AssistantTest::testPrompts` |
| `InputInterface::getAllGuardrailResults()`, `getGuardrailSets()`, `AiGuardrailSetInterface::getStopThreshold()`, `StopResult::getScore()`; `ai.settings:global_guardrails` | blocked | `AssistantTest::testGuardrailStopIsBlocked` |
| `ChatInput::setChatStructuredJsonSchema(array)` | structured output | `AssistantTest::testNoDeprecations` |
| `HostnameFilterDto(fullTrust:)`, `ai.prompt_json_decode` | answer reading | `AssistantTest::testSuggestText`, `testJsonDecoderFallback`, `testBareJsonWithSpaces` |
| `ai.settings:request_timeout` | timeout | `AssistantTest::testSiteTimeoutApplies` |
| Exception classes `AiSetupFailureException`, `AiAccessDeniedException`, `AiMissingFeatureException`, `AiBrokenOutputException`, `AiUnsafePromptException`, `AiRateLimitException`, `AiQuotaException` | error codes | `AiControllerTest::testErrorCodes` |
| Routes `ai.settings_form`, `ai.admin_providers`, `entity.ai_prompt.collection` | status report links | `RequirementsTest` |

## Risks / Trade-offs

- [A site builder weakens a prompt] → The fence, the answer shape and the
  cleaners are in code. The AI module's prompt permissions are restricted.
- [A provider ignores the schema] → The shape is in `SHAPE`, the decoder
  recovers fenced JSON, and the cleaners check every row; otherwise
  `invalid_response`, which fails closed.
- [Several guardrail sets: the sum blocks where no single set would] → A false
  `blocked`, which fails closed.
- [An admin adds a prompt of our type and expects it to be used] → The type
  label says only the default is used. Open decision 2.
- [The site timeout (60 s) is longer than a proxy's gateway timeout] → The
  dialog already handles a non-JSON 504 as `provider_error`. Open decision 4.
- [AI request logging stores draft text] → The site's choice; the permission
  description and README say so.
- [Prompt fixes after the first release would overwrite admin edits] → A
  post-update sets new text only when the stored prompt equals the previously
  shipped text. Never `upsertFromConfigInstall()` on a released site.
- [The tag rename breaks a filter on `canvas_metatag_ai_text`] → No release
  exists; the README names the new tags.
- [No limit across users] → The per-user flood limit stays. Open decision 5.

## Migration Plan

- No tagged release exists, so there is no update hook. Development sites
  reinstall the submodule (`drush pmu canvas_metatag_ai && drush en
  canvas_metatag_ai`) to get the prompts. It stores no data of its own, so
  nothing is lost.
- Uninstall removes the prompt types and prompts through their enforced
  module dependency.
- Rollback is reverting the commits and reinstalling the submodule. The
  prompt configuration is then removed with it.
- After the first release, new prompt text ships with a post-update that
  changes only unedited prompts.

## Open Questions

- What does an empty `ai_observability.settings:log_tags` mean: log every
  call or none? Check before the README tells admins to add
  `canvas_metatag_ai`. It changes only README wording.
