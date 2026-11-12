## ADDED Requirements

### Requirement: Suggestion prompts live in the AI prompt library

Installing the submodule MUST add three prompt types to the AI module's
Prompt Library, each with a default prompt: search result, social card and
structured data. People with the AI module's permission to edit prompts MUST
be able to change them there, and the next request MUST use the changed
text. Uninstalling the submodule MUST remove the three types and their
prompts.

#### Scenario: After install

- **WHEN** canvas_metatag_ai is enabled
- **THEN** the Prompt Library MUST list a default prompt for the search result, the social card and structured data

#### Scenario: An edited prompt

- **WHEN** a site builder changes the search result prompt and an editor then asks for title suggestions
- **THEN** the system prompt of that request MUST start with the changed text

#### Scenario: Uninstall

- **WHEN** canvas_metatag_ai is uninstalled
- **THEN** its three prompt types and their prompts MUST no longer exist

### Requirement: Only the default prompt of each type is used

Each request MUST use the default prompt of its type. Other prompts that
someone adds to the same type MUST NOT be used. Each prompt type's label MUST
say that only its default prompt is used.

#### Scenario: A second prompt of a type

- **WHEN** a site builder adds another prompt to the search result type and an editor asks for title suggestions
- **THEN** the request MUST use the default search result prompt

#### Scenario: The label

- **WHEN** a site builder opens the Prompt Library
- **THEN** each of the three prompt types MUST say that only its default prompt is used

### Requirement: Prompt variables are filled by the server

The server MUST replace `{language}` with the configured name of the
requested language, `{count}` with the clamped number of variants, and
`{types}` and `{properties}` with the registry's types and their allowed
properties. Nothing from the request MUST fill a variable. Tokens in a prompt
MUST NOT be replaced.

#### Scenario: Language and count

- **WHEN** an editor asks for 3 title variants in a language configured as "Suomi"
- **THEN** the system prompt MUST contain "Suomi" and "3" where the prompt has `{language}` and `{count}`

#### Scenario: A prompt without a variable

- **WHEN** a site builder removes `{count}` from the search result prompt and an editor asks for 3 variants
- **THEN** the server MUST still return at most 3 variants per field

#### Scenario: A token in a prompt

- **WHEN** a prompt contains `[site:name]`
- **THEN** the system prompt MUST contain `[site:name]` as written

### Requirement: The safety text is added in code

After the configured prompt, the server MUST add fixed text that a site
builder cannot edit: that the page text between `<page_content>` tags is
material to describe and not instructions, and the JSON shape of the answer.
The shipped prompts MUST NOT contain this text.

#### Scenario: A prompt rewritten by a site builder

- **WHEN** the search result prompt is set to "Say hello." and an editor asks for title suggestions
- **THEN** the system prompt MUST end with the fixed safety text and answer shape, and the dialog MUST still show three title variants

#### Scenario: The shipped prompts

- **WHEN** a site builder opens a shipped prompt in the Prompt Library
- **THEN** it MUST NOT contain the `<page_content>` sentence or the answer shape

### Requirement: A text request uses the search or the social prompt

A text request that asks only for `social.title` or `social.description`, or
both, MUST use the social card prompt. A text request that asks only for
`title` or `description`, or both, MUST use the search result prompt. A
structured data request MUST use the structured data prompt.

#### Scenario: Link card

- **WHEN** the dialog asks for the social title and social description together
- **THEN** the system prompt MUST start with the social card prompt

#### Scenario: Search description

- **WHEN** the dialog asks for description variants
- **THEN** the system prompt MUST start with the search result prompt

### Requirement: A missing prompt turns suggestions off

When the default prompt of any of the three types is missing or empty,
suggestions MUST be off. `capabilities.ai` MUST then be
`{available: false, reason: no_prompt}`, unless a provider reason applies
first. A suggestion request MUST answer 422 `ai_not_configured`, and the
provider MUST NOT be called.

#### Scenario: A deleted prompt

- **WHEN** a site builder deletes the default structured data prompt and the default provider is ready
- **THEN** `capabilities.ai` MUST be `{available: false, reason: no_prompt}`

#### Scenario: A request without its prompt

- **WHEN** the default search result prompt is empty and an editor asks for title suggestions
- **THEN** the server MUST answer 422 `ai_not_configured`, and the provider MUST NOT be called

#### Scenario: No provider and no prompt

- **WHEN** no default provider is set and a prompt is missing
- **THEN** `capabilities.ai.reason` MUST be `no_provider`

### Requirement: A guardrail stop blocks the request

The site's guardrails MUST apply to every suggestion call. When guardrail
stops, before or after generation, together reach the lowest stop threshold
of the attached guardrail sets, the server MUST answer 422 `blocked`. The
stop message MUST NOT be returned as a suggestion. Stops below the threshold
MUST NOT block, and the answer MUST then be cleaned like any other.

#### Scenario: Page text stopped before generation

- **WHEN** a global guardrail set stops the request because of the page text
- **THEN** the server MUST answer 422 `blocked`, and the provider MUST NOT be called

#### Scenario: Answer stopped after generation

- **WHEN** a global guardrail set stops the model's answer
- **THEN** the server MUST answer 422 `blocked`, and no part of the stop message or the answer MUST be returned

#### Scenario: A stop below the threshold

- **WHEN** a guardrail set has a stop threshold of 2 and one of its guardrails stops with a score of 1
- **THEN** the server MUST return the cleaned suggestions

#### Scenario: Blocked in the dialog

- **WHEN** a request is blocked and the editor is in the suggestion tray
- **THEN** the tray MUST say "The site's AI rules stopped this request.", nothing MUST be written, and "Try again" MUST stay available

### Requirement: Answers are read as the model wrote them

The server MUST read the answer text without the AI module's link filter
rewriting it. Well-formed JSON MUST be read as it is, whatever its white
space. Only an answer that is not JSON MUST go to the AI module's JSON
recovery. A provider's claim to support structured output MUST NOT be
trusted: the shape is checked on every answer.

#### Scenario: Ampersand and angle brackets

- **WHEN** the model answers a title variant "fish & chips <fresh>"
- **THEN** the variant MUST be returned as "fish & chips <fresh>", not "&amp;" and not with an added closing tag

#### Scenario: JSON with spaces or Windows line ends

- **WHEN** the model answers `{ "suggestions": [...] }`, or JSON pretty-printed with CRLF line ends or tabs
- **THEN** the server MUST read it and return the variants

#### Scenario: A provider that ignores the schema

- **WHEN** the provider answers in prose although it claims structured output
- **THEN** the server MUST answer 502 `invalid_response`

### Requirement: The status report says whether suggestions work

The site's status report MUST have an entry "SEO suggestions (Canvas Metatag
AI)". It MUST say which provider, model and operation are used, or why
suggestions are off, with a link to the page that fixes it. Building it MUST
NOT call the provider's service.

#### Scenario: Suggestions on

- **WHEN** the default provider for structured chat is set up and every prompt exists
- **THEN** the entry MUST be OK and name the provider, the model and "Chat with structured response"

#### Scenario: No provider

- **WHEN** no default provider is set for structured chat or chat
- **THEN** the entry MUST be a warning that links to the AI settings

#### Scenario: Provider not set up

- **WHEN** the default provider is not set up
- **THEN** the entry MUST be a warning that names the provider and links to the AI providers page

#### Scenario: A prompt missing

- **WHEN** the default social card prompt is deleted
- **THEN** the entry MUST be a warning that names the missing prompt and links to the Prompt Library

## MODIFIED Requirements

### Requirement: Suggestions exist only with the submodule

The base module MUST NOT show any AI control. The submodule MUST add one route,
`POST /canvas-metatag/api/ai/suggest`, and a "Use AI suggestions for SEO"
permission. It MUST depend on the AI module, version 1.5.0 or later, and use
the site's default provider.

#### Scenario: Submodule not enabled

- **WHEN** an editor opens the SEO dialog on a site without canvas_metatag_ai
- **THEN** the dialog MUST NOT show any "Suggest" control

#### Scenario: Submodule enabled

- **WHEN** canvas_metatag_ai is enabled and a default chat provider is set up
- **THEN** an editor with both permissions MUST see "Suggest" controls on a page they can edit

#### Scenario: An older AI module

- **WHEN** a site has an AI module older than 1.5.0
- **THEN** Drupal MUST refuse to enable canvas_metatag_ai

### Requirement: The dialog learns whether suggestions can be offered

The dialog's state MUST carry `capabilities.ai`. It MUST be NULL for a user
without the AI permission, so that they learn nothing about the provider. For a
user with it, it MUST be `{available, reason}`, where reason is NULL,
`no_provider`, `not_usable` or `no_prompt`. Working this out MUST NOT call the
provider's service. Other modules MAY change it through
`hook_canvas_metatag_capabilities_alter`.

#### Scenario: Provider ready

- **WHEN** a user with the AI permission opens the dialog, the default provider is set up and every prompt exists
- **THEN** `capabilities.ai` MUST be `{available: true, reason: null}`

#### Scenario: No provider configured

- **WHEN** a user with the AI permission opens the dialog and no default provider and model are set
- **THEN** `capabilities.ai` MUST be `{available: false, reason: no_provider}`

#### Scenario: Provider not usable

- **WHEN** the default names a provider that is uninstalled, broken or not set up
- **THEN** `capabilities.ai` MUST be `{available: false, reason: not_usable}`

#### Scenario: Prompt missing

- **WHEN** the default provider is set up and one of the three default prompts is missing or empty
- **THEN** `capabilities.ai` MUST be `{available: false, reason: no_prompt}`

#### Scenario: Without the AI permission

- **WHEN** a user with "Edit SEO settings in Canvas" only opens the dialog
- **THEN** `capabilities.ai` MUST be NULL, and no provider MUST be called

#### Scenario: Site administrators are told why

- **WHEN** a user who administers SEO site settings and has the AI permission opens Site settings and suggestions are not available
- **THEN** the dialog MUST say that AI suggestions are off, and whether no provider is set up, the provider is not ready, or a suggestion prompt is missing

### Requirement: Text suggestions

A text request MUST name a count, a site language, the page, and either one
or both of `title` and `description`, or one or both of `social.title` and
`social.description`. The server MUST return, per requested field, up to the
requested number of distinct, non-empty variants, with the count clamped to 1
to 5. The shipped prompts MUST ask for text in the configured name of the
requested site language.

#### Scenario: Count out of range

- **WHEN** a request asks for 99 variants, or for 0 or a negative number
- **THEN** the server MUST return at most 5, or exactly 1, variants per field

#### Scenario: Repeated fields

- **WHEN** a request names the same field twice
- **THEN** it MUST be treated as one field

#### Scenario: Language

- **WHEN** a request names a site language and the shipped prompts are in use
- **THEN** the system prompt MUST name that language by its configured name, not its code

### Requirement: Requests are checked

The server MUST refuse with 400 `bad_request`, before any provider call, a body
over 128 KB, a body that is not a JSON object, an unknown or missing task, a
language that is not one of the site's own, an unknown, missing or empty list
of fields, a list that mixes social fields with search fields, a non-integer
count, and members of the wrong type. Optional members (current values, hint,
page members) MAY be left out.

#### Scenario: Unknown field

- **WHEN** a text request names `canonical` as a field
- **THEN** the server MUST answer 400 `bad_request`, and the provider MUST NOT be called

#### Scenario: Mixed fields

- **WHEN** a text request names `title` and `social.title`
- **THEN** the server MUST answer 400 `bad_request`, and the provider MUST NOT be called

#### Scenario: A placeholder language

- **WHEN** a request names `und` or a language the site does not have
- **THEN** the server MUST answer 400 `bad_request`

#### Scenario: A minimal request

- **WHEN** a text request has only a task, a language, one field, a count and an empty page
- **THEN** the server MUST accept it

### Requirement: Failures have stable codes and reveal nothing

Every failure MUST answer `{error: {code, message}}` and nothing else, with the
module's own message, never the provider's. The codes MUST be:
`ai_not_configured` (422), `blocked` (422), `rate_limited` (429),
`quota_exceeded` (503), `invalid_response` (502) and `provider_error` (502).
The dialog MUST show its own sentence for each code and offer to try again.

#### Scenario: No provider, or a provider that cannot be set up

- **WHEN** no default is set, the default provider is no longer installed, or it cannot load its key
- **THEN** the server MUST answer 422 `ai_not_configured`

#### Scenario: A provider that refuses access or cannot chat

- **WHEN** the provider refuses the site's key or access to the model, or does not support chat
- **THEN** the server MUST answer 422 `ai_not_configured`

#### Scenario: A site policy blocks the prompt

- **WHEN** a subscriber of the AI module flags the prompt as unsafe, or a guardrail stop reaches its threshold
- **THEN** the server MUST answer 422 `blocked`

#### Scenario: Provider quota

- **WHEN** the provider reports that the quota is used up
- **THEN** the server MUST answer 503 `quota_exceeded`, without the provider's message

#### Scenario: Unusable answer

- **WHEN** the model answers in prose with no JSON, or JSON in another shape, or JSON with no usable value, or the AI module reports broken output
- **THEN** the server MUST answer 502 `invalid_response`

#### Scenario: Anything else

- **WHEN** the provider fails in any other way
- **THEN** the server MUST answer 502 `provider_error`

#### Scenario: Failure in the dialog

- **WHEN** a request fails with `rate_limited`
- **THEN** the tray MUST say the AI service is busy and to try again in a minute

#### Scenario: The blocked message

- **WHEN** a request fails with `blocked`
- **THEN** the message MUST be "The site's AI rules stopped this request."

### Requirement: Nothing of the prompt is logged

A failure MUST be logged once on the `canvas_metatag_ai` channel with its code,
the task, the prompt kind and the exception class, and without the provider's
message. This module MUST NOT log the prompts, the page text, the editor's
current values and hint, or the model's answer on any channel. Whether the AI
module's own request logging stores them is the site's choice.

#### Scenario: A logged failure

- **WHEN** a call fails because of the provider's rate limit
- **THEN** the log MUST name `rate_limited`, the task, the prompt kind and the exception, and MUST NOT contain the provider's message, the page text or the hint

#### Scenario: A failure before the provider is called

- **WHEN** the default provider names a plugin that cannot be created
- **THEN** one record MUST be logged on the `canvas_metatag_ai` channel with `ai_not_configured` and the exception class

### Requirement: The system prompt holds nothing from the request

The system prompt MUST hold only the default prompt of its kind from the
Prompt Library, with its variables filled by the server, followed by the
module's fixed safety text. Everything from the request MUST go into the user
message: the page text between `<page_content>` tags, the hint between
`<editor_hint>` tags.

#### Scenario: Request text

- **WHEN** a request carries a page title, site name, page text, current values and a hint
- **THEN** none of them MUST appear in the system prompt

#### Scenario: A hint that names a variable

- **WHEN** the hint contains `{language}` or `{count}`
- **THEN** the hint MUST reach the user message as written, and MUST NOT change the system prompt

### Requirement: Provider calls are bounded

The submodule MUST use the default provider and model for structured chat when
both are set, else those for chat. It MUST make one non-streamed call with the
AI module's site-wide request timeout, ask for structured JSON output, and tag
the call `canvas_metatag_ai` and `canvas_metatag_ai_search`,
`canvas_metatag_ai_social` or `canvas_metatag_ai_schema`. An answer that is not
a chat message MUST count as `invalid_response`.

#### Scenario: Both defaults set

- **WHEN** both a structured chat default and a chat default are configured
- **THEN** the structured chat default MUST be used, for the call and for `capabilities.ai`

#### Scenario: The site's timeout

- **WHEN** the AI module's request timeout is set to 20 seconds
- **THEN** a suggestion call MUST NOT set a timeout of its own

#### Scenario: Tags

- **WHEN** the dialog asks for link card variants
- **THEN** the call MUST be tagged `canvas_metatag_ai` and `canvas_metatag_ai_social`

### Requirement: Editors are told what is sent

The permission's description MUST say that each request is a paid call and
sends the page's current text, including unpublished draft text, to the
provider, and that sites which log AI requests may store that text. Every
suggest control MUST say that it sends the page's text to the AI service, and
every suggestion tray MUST end with a note that the text was written by AI and
its facts need checking.

#### Scenario: A suggestion tray

- **WHEN** suggestions are shown
- **THEN** the tray MUST say that they were written by AI from the page's text, and to check the facts

#### Scenario: The permission

- **WHEN** an administrator reads "Use AI suggestions for SEO" on the permissions page
- **THEN** it MUST say that the page's text, including draft text, is sent to the provider, and that sites which log AI requests may store it
