# Proposal

## Why

The product owner asked that the optional AI submodule be built on the Drupal
AI ecosystem. The companion change `build-ai-on-drupal-ai` moves the SEO
dialog's suggestions onto AI core. This change does the second half: it makes
a page's SEO available to agents. Canvas's own AI chat can then answer "how
does this page look in search results?" without the editor opening the SEO
dialog. Today an agent cannot see any of it.

## What Changes

- **A read tool.** The submodule adds a function-call tool of the AI module,
  "Get SEO settings" (`canvas_metatag:get_seo`), in its own tool group "SEO
  (Canvas Metatag)". For one Canvas page it returns what search engines and
  social apps get from the editor's current version: titles, descriptions,
  social image, search visibility, canonical, structured data type and what
  the structured data is missing. It is the same output the dialog shows.
- **A suggestion tool, behind a gate.** "Suggest SEO text"
  (`canvas_metatag:suggest_seo`) proposes variants for the search title, the
  social card, or a structured data type with its facts. It reads the page's
  text on the server. It ships only if a spike shows that the server can get
  most of a Canvas page's visible text; pages built from code components keep
  their text in component properties, so this may fail. If it fails, the read
  tool ships alone.
- **Both tools are read-only.** They never write a page, a draft or
  configuration, and they cannot apply anything in Canvas's chat. Each tool
  checks the current user's permissions and Canvas access to the page on
  every call, whoever calls it.
- **An SEO sub-agent for Canvas AI.** When the AI Agents module and Canvas AI
  are enabled, the submodule installs an agent, "SEO suggestions (Canvas
  Metatag)", and an agent override that offers it to Canvas's AI chat. Both
  are optional configuration: they install themselves when those modules are
  enabled, and an administrator can turn the bridge off in the agents UI.
- **The chat works on the page open in Canvas only.** The page is taken from
  the editor's context, never from the model. On a node or a template the
  tools refuse to run.
- **Canvas keeps the page description and the page title.** The agent does not
  write either. Canvas's own agents keep them in the chat; the dialog keeps
  its reviewed description variants.
- **Shared budget.** The suggestion tool counts against the same per-user
  limit as the dialog, and uses the same prompts, fences, cleaners and error
  sentences.
- No change to the SEO dialog, the head output or the stored values. No
  **BREAKING** changes.

Out of scope:

- applying anything from the chat, or opening the dialog from it;
- AI for content templates, nodes in the chat, and bulk runs;
- everything the companion change owns: the prompt library, guardrails, the
  status report entry, timeouts and the dialog's error copy;
- an entity id on the dialog's own suggestion request (the dialog keeps
  sending the preview's text);
- a site-wide spend cap;
- a Playwright test of Canvas's chat (it needs a model that can call tools).

Non-goals reopened: none. A read tool lets a site's own agents review pages
one at a time. It is not bulk editing: nothing can be written through it.

## Dependencies

- **Depends on `build-ai-on-drupal-ai`.** The suggestion tool uses its
  prompts, guardrail rule, tags and error mapping, and this change extends its
  `ShippedConfigTest`. Start after it is merged.
- **Depends on `link-values-to-fields`** for the suggestion tool (task group
  5) and the `ai-suggestions` delta. A used title variant becomes the page's
  title main part as typed text, braces stay plain text, and a search title
  request carries the page's title ending. The read tool and the sub-agent
  (groups 1 to 4) do not need it. Archive after it.
- Independent of `add-advanced-meta-tags` and `add-home-page-defaults`: no
  requirement is shared.

## Capabilities

### New Capabilities

- `seo-tools`: the SEO tools the submodule offers to the AI module's tool
  system, what each returns, and that they never change anything.
- `seo-chat-agent`: the SEO sub-agent and how it joins Canvas's AI chat.

### Modified Capabilities

- `seo-access`: tools check the same access as the dialog, on every call.
- `ai-suggestions`: suggestions made through the tool change nothing either,
  and share the per-user limit (only if the suggestion tool ships).

## Impact

- New code in `modules/canvas_metatag_ai` only, plus one public method in the
  base module so the dialog and the tools find a page's editor draft by one
  rule.
- New optional configuration: one AI agent and one agent override, installed
  only with `ai_agents` and `canvas_ai`.
- Dependencies: `ai` stays the only required one. `ai_agents` becomes a dev
  requirement (for kernel tests) and a Composer suggestion. `canvas_ai` ships
  with Canvas.
- New dependencies on Canvas AI and AI Agents internals, each with a row in
  ARCHITECTURE.md and a test that fails when it changes.
- Docs: README (AI section, permissions) and ARCHITECTURE (sections 11, 15, 16
  and 17).

## Open decisions

1. **Sub-agent or plain tools on the orchestrator.** This change uses a
   sub-agent, as Canvas does for each of its capabilities. Adding the read
   tool straight to Canvas's orchestrator would save one model loop per chat
   turn. Revisit if chat cost matters more than following Canvas's structure.
2. **The spike's pass mark.** Proposed: on two farm site pages built from code
   components, the server's text holds at least 80% of the heading and
   paragraph text the dialog reads from the live preview. Needs agreement
   before the spike runs.
3. **A site-wide spend cap.** The suggestion tool shares the per-user limit,
   which bounds one account but not the site. A site-wide number is a product
   decision, shared with the companion change.
4. **Translations in the chat.** Canvas AI does not tell the tools which
   language is being edited. The tools review the translation the request's
   content language selects. Confirm that this is good enough, or ask Canvas
   for the editor's language.
5. **A manual prompt check.** Whether to ship an evaluation group for a human
   to run against a real model before a release. It never runs in CI.
