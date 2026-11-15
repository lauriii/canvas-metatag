## Why

canvas_metatag_ai already calls the AI module's provider layer, but it keeps
its own prompts in code, ignores the site's guardrails and tells
administrators nothing about its state. The product owner asked that the
optional AI submodule be built on the Drupal AI ecosystem. Today a site
builder cannot change the wording of the suggestions, a guardrail stop is
reported as an unusable answer, and an administrator has to open the SEO
dialog to learn whether suggestions work.

## What Changes

- **Editable prompts.** The submodule installs three prompts in the AI
  module's Prompt Library: search result, social card and structured data.
  People who may create, edit and delete AI prompts edit them there. The
  editorial text moves out of the code.
- **Safety text stays in code.** The sentence that page text is material, not
  instructions, and the JSON shape of the answer are always added after the
  configured prompt. An edited prompt cannot remove them.
- **Prompt variables** (`{language}`, `{count}`, `{types}`, `{properties}`)
  are filled from server values only.
- **Search or social prompt.** A text request uses the social prompt when it
  asks only for social fields, else the search prompt. A request that mixes
  social and search fields is refused as `bad_request`. The dialog never
  sends one.
- **A missing prompt turns suggestions off.** The dialog's
  `capabilities.ai.reason` gains `no_prompt`, and a request whose prompt is
  missing answers `ai_not_configured` without calling the provider. The
  default prompts cannot be deleted, only edited, and every prompt of our
  types goes on uninstall.
- **Guardrail stops.** When the scores of the stops of the site's global
  guardrails, before and after generation, add up to the lowest stop
  threshold of the attached sets, the request answers `blocked`. Stops below
  it let the answer through, cleaned as any other.
- **Status report.** A new "SEO suggestions (Canvas Metatag AI)" entry says
  which provider and model are used, or why suggestions are off, with a link
  to the setting that fixes it. A missing prompt is named by its label, with
  how to add it back.
- **Kept on purpose.** Answers are read with the AI module's link filter in
  full-trust mode, a plain JSON decode runs before the AI module's JSON
  recovery, and the structured output schema stays in its array form. Every
  output cleaner stays.
- **Provider calls** use the AI module's site-wide request timeout instead of
  the module's own 30 seconds, and are tagged by prompt kind
  (`canvas_metatag_ai_search`, `_social`, `_schema`). **BREAKING** for anyone
  filtering on the old `canvas_metatag_ai_text` tag.
- **Errors.** A provider that refuses access, cannot chat or lacks the
  operation type (`AiAccessDeniedException`, `AiMissingFeatureException`,
  `AiOperationTypeMissingException`) maps to `ai_not_configured`; broken
  output reported by the AI module maps to `invalid_response`. The server's
  `blocked` message becomes "The site's AI rules stopped this request."
  because a stop after generation is not about sending; the dialog adds the
  next step that fits the request, and offers Try again only where it can
  help.
- **Logging.** The module's failure record keeps code, task, prompt kind and
  exception class and drops the provider's message, which the AI module
  already logs on its own channel.
- **Dependency.** `ai:ai (>=1.5.0)`.
- The permission description adds that sites which log AI requests may store
  the page text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-suggestions`: prompts come from the AI prompt library with a fixed
  safety tail; a missing prompt is a new "off" reason; guardrail stops answer
  `blocked`; a status report entry; mixed text requests are refused; the
  timeout, tags, error mapping, log record, `blocked` sentence, permission
  text and AI module version change.

## Impact

- `modules/canvas_metatag_ai`: `Assistant` (prompt loading, guardrail check,
  timeout, tags), `AiController` (error mapping, log record, mixed-field
  refusal), `AiException` (`blocked` reason), `AiHooks` (runtime
  requirements, a presave hook that ties every prompt of our types to the
  submodule, an access hook that keeps the default prompts from being
  deleted), `Routing\RouteSubscriber` (the same check on the delete form),
  info.yml (version floor), permissions.yml (description), six new files in
  `config/install` (three prompt types, three prompts).
- Tests: `AssistantTest`, `AiControllerTest`, new kernel tests
  `PromptsTest` and `RequirementsTest`, new unit test `ShippedConfigTest`.
  `EchoSeoProvider` lists its models with the structured response
  capability. `CanvasMetatagTestSetup` (AI mode) sets the structured
  response default, an edited search result prompt and a global guardrail.
- Extension: `types.ts` reason union; `model.ts` (the Site view's "AI
  suggestions are off" line, the tray's error sentences and whether to offer
  Try again); `Suggest.tsx`, `Field.tsx` and `ChecksSheet.tsx` (what a
  suggest control sends, the AI disclosure only with suggestions, Dismiss for
  a failure that asking again would repeat); rebuilt `extension/dist`.
- `composer.json`: a `suggest` entry for `drupal/ai`.
- README and ARCHITECTURE §15 to §17: prompts, guardrails, status report,
  observability caveat, and the AI module APIs the submodule relies on.
- No Canvas internal is added. No stored data, no update hook.

## Out of scope

- Exposing the SEO data to AI agents or to Canvas's AI chat (function call
  tools, a sub-agent, an agent override). That is `expose-seo-to-canvas-ai`,
  a later change, and it stays optional.
- Suggestions at template scope. Template values are linked to sources, so AI
  there must choose a source. That needs `link-values-to-fields` first and is
  a later change, not yet proposed.
- A per-module provider or model setting, a shipped guardrail set, a
  guardrail setting for the dialog, and a prompt picker form element.
- A site-wide cap on suggestion calls (see open decisions).
- Sending an entity id with the dialog's request so the server reads the
  draft text itself.
- An event subscriber for observability. Sites use the AI module's own
  logging with the tags.

No v1 non-goal is reopened. Bulk editing stays a non-goal.

## Dependencies

- **Depends on:** no other change. It starts after the dialog redesign has
  landed (tasks.md, 1.1). It is first in the order of the active changes.
- **Followed by:**
  - `link-values-to-fields`: its title ending sentence joins the fixed text
    this change adds after the configured prompt.
  - `expose-seo-to-canvas-ai`: its suggestion tool uses this change's
    prompts, tags and error mapping, and extends `ShippedConfigTest`.
- If `link-values-to-fields` is archived first, its `ai-suggestions` delta
  must be rewritten without the Prompt Library before this one archives.

## Decisions taken (2026-11-13)

The product owner asked for everything at high quality, with a clean
experience. Where this change left a decision open, the lead took the default
(the lead's decision record for the implementation run), so open decisions 1
to 4 below are settled as their defaults: three prompts with mixed text
requests refused; only the default prompt is used and the type labels say so;
the `blocked` sentence "The site's AI rules stopped this request.", with a
next step the dialog adds after review ("Try different wording in Refine, or
ask a site administrator." when Refine text was sent, else "Ask a site
administrator."); the AI module's site-wide timeout. Decision 5 stays out of
scope. The review's fixes follow the product owner's "experience needs to be
clean even though we're making this more powerful": a default prompt cannot
be deleted (one click turned every suggestion off), the dialog's Site line
says that site administrators can see how to fix it in the status report,
and a tray never offers Try again where asking again is refused again.

Also binding here (PO decision 9): no paid provider is ever called. The kernel
tests and the `ai` Playwright project use the echo test providers only, and
the kernel tests fail if a call is about to reach any other provider.

## Open decisions

These have a default in this change. The product owner or lead may reverse
each one; the effect of reversing it is stated.

1. **Three prompts or two.** Default: three (search, social, schema) and
   mixed text requests refused. Alternative: one text prompt and one schema
   prompt, no refusal, tags `_text` and `_schema` as today.
2. **Only the default prompt is used.** An administrator can add more prompts
   of our types in the Prompt Library, and they do nothing. Default: each prompt
   type's label says so. Alternative: a prompt picker setting.
3. **`blocked` wording.** Default: "The site's AI rules stopped this
   request." for stops before and after generation. The redesign owns the
   copy and may change it.
4. **Timeout.** Default: the AI module's site-wide request timeout (60 seconds
   unless changed). Alternative: at most 30 seconds per call, so that a
   gateway timeout does not hit first.
5. **Site-wide rate cap.** Not in this change. The per-user limit stays at 30
   calls per 5 minutes and there is no limit across users. A site-wide cap is
   a product number.
