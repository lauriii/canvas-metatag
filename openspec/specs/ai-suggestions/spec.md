# ai-suggestions

## Purpose

Let editors ask the site's AI provider for search and social text and for a
structured data type with its facts, through the optional canvas_metatag_ai
submodule. Suggestions are shown for review and are never applied or stored by
themselves. What the page and the model send is treated as untrusted data.

## Requirements

### Requirement: Suggestions exist only with the submodule

The base module MUST NOT show any AI control. The submodule MUST add one route,
`POST /canvas-metatag/api/ai/suggest`, and a "Use AI suggestions for SEO"
permission. It MUST depend on the AI module and use the site's default
provider.

#### Scenario: Submodule not enabled

- **WHEN** an editor opens the SEO dialog on a site without canvas_metatag_ai
- **THEN** the dialog MUST NOT show any "Suggest" control

#### Scenario: Submodule enabled

- **WHEN** canvas_metatag_ai is enabled and a default chat provider is set up
- **THEN** an editor with both permissions MUST see "Suggest" controls on a page they can edit

### Requirement: Suggestions never change anything by themselves

A suggestion request MUST NOT write configuration, a page, or a Canvas draft,
whether it succeeds or fails. A suggestion MUST reach the page only when the
editor uses it in the dialog. A used suggestion MUST then be saved like typed
text, through the dialog's own draft save and its validation.

#### Scenario: Asking for suggestions

- **WHEN** an editor asks for text suggestions and a structured data proposal
- **THEN** the site's configuration, the stored page and every Canvas draft MUST be unchanged

#### Scenario: Suggestions on screen

- **WHEN** text variants are shown and the editor has not chosen "Use"
- **THEN** the page's draft MUST NOT contain any of them

#### Scenario: Using a title variant

- **WHEN** the editor uses a title variant
- **THEN** the variant MUST replace the page's part of the title pattern, the inherited separator and site name MUST stay, and the value MUST be saved into the page's draft

#### Scenario: A proposal on screen

- **WHEN** a structured data proposal is shown and not used
- **THEN** the page's structured data values MUST be unchanged

### Requirement: Who may ask

The suggest route MUST require both "Use AI suggestions for SEO" and "Edit SEO
settings in Canvas". It MUST accept POST only, from a browser session only (no
bearer token), with a valid CSRF header token when a session cookie is sent.
Its responses MUST NOT be cached.

#### Scenario: One permission only

- **WHEN** a user with only one of the two permissions, or neither, posts to the route
- **THEN** the system MUST deny it with 403, and the provider MUST NOT be called

#### Scenario: Missing or wrong CSRF token

- **WHEN** a request with a session cookie has no `X-CSRF-Token` header, or a wrong one
- **THEN** the system MUST deny it with 403

### Requirement: The dialog learns whether suggestions can be offered

The dialog's state MUST carry `capabilities.ai`. It MUST be NULL for a user
without the AI permission, so that they learn nothing about the provider. For a
user with it, it MUST be `{available, reason}`. Working this out MUST NOT call
the provider's service. Other modules MAY change it through
`hook_canvas_metatag_capabilities_alter`.

#### Scenario: Provider ready

- **WHEN** a user with the AI permission opens the dialog and the default provider is set up
- **THEN** `capabilities.ai` MUST be `{available: true, reason: null}`

#### Scenario: No provider configured

- **WHEN** a user with the AI permission opens the dialog and no default provider and model are set
- **THEN** `capabilities.ai` MUST be `{available: false, reason: no_provider}`

#### Scenario: Provider not usable

- **WHEN** the default names a provider that is uninstalled, broken or not set up
- **THEN** `capabilities.ai` MUST be `{available: false, reason: not_usable}`

#### Scenario: Without the AI permission

- **WHEN** a user with "Edit SEO settings in Canvas" only opens the dialog
- **THEN** `capabilities.ai` MUST be NULL, and no provider MUST be called

#### Scenario: Site administrators are told why

- **WHEN** a user who administers SEO site settings and has the AI permission opens Site settings and suggestions are not available
- **THEN** the dialog MUST say that AI suggestions are off, and whether no provider is set up or the provider is not ready

### Requirement: Where suggestions are offered

The dialog MUST offer suggestions only when `capabilities.ai.available` is
true, the target is a Canvas page (not a content template or site settings),
and the page can be written in the dialog. It MUST offer them for the search
title, the search description, the link card (social title and description
together) and the page type. The Checks list's "Suggest" is seo-checks.

#### Scenario: A content template

- **WHEN** an editor opens the dialog on a content template
- **THEN** no "Suggest" control MUST be shown in its fields

#### Scenario: A read-only page

- **WHEN** the page cannot be written in the dialog (no update access, a conflict, or the editor cannot be read)
- **THEN** no "Suggest" control MUST be shown in its fields, and no suggestion tray MUST open

### Requirement: Text suggestions

A text request MUST name one or more of `title`, `description`, `social.title`
and `social.description`, a count, a site language, and the page. The server
MUST return, per requested field, up to the requested number of distinct,
non-empty variants, with the count clamped to 1 to 5. The prompt MUST ask for
text in the configured name of the requested site language.

#### Scenario: Count out of range

- **WHEN** a request asks for 99 variants, or for 0 or a negative number
- **THEN** the server MUST return at most 5, or exactly 1, variants per field

#### Scenario: Repeated fields

- **WHEN** a request names the same field twice
- **THEN** it MUST be treated as one field

#### Scenario: Language

- **WHEN** a request names a site language
- **THEN** the system prompt MUST name that language by its configured name, not its code

### Requirement: Text suggestions are reviewed in the dialog

The dialog MUST ask for three variants and show them for review. The search and
social previews MUST show the chosen variant in place. The link card
suggestion MUST fill social title and description together. The editor MAY
steer a new request with a hint, and MAY ask again.

#### Scenario: Link card

- **WHEN** an editor uses a link card variant
- **THEN** both the social title and the social description of the page MUST be set from it

#### Scenario: Steering

- **WHEN** an editor types a hint in "Refine" and asks again
- **THEN** the hint MUST reach the provider, cut to 200 characters

#### Scenario: Little text on the page

- **WHEN** the page's text is shorter than 200 characters
- **THEN** the dialog MUST warn that the text suggestions may be generic

### Requirement: Structured data proposals

A schema request MUST return one type from the module's registry, values only
for that type's text and date properties that the registry does not reserve for
people, and the keys whose value could not be verified. A text value MUST count
as verified only when the page text contains it, ignoring case and white
space. A date MUST never count as verified.

#### Scenario: A type outside the registry

- **WHEN** the model answers with a type the registry does not have, or with none
- **THEN** the server MUST answer `invalid_response`

#### Scenario: Reserved and non-text properties

- **WHEN** the model returns a price, a currency, an availability, an SKU, an image, an event status or an `@id`
- **THEN** none of them MUST be in the proposal

#### Scenario: A value not on the page

- **WHEN** a proposed venue does not appear in the page text
- **THEN** its key MUST be listed as unverified

#### Scenario: A value on the page in another case and spacing

- **WHEN** the page text contains the proposed venue in capitals and with extra spaces
- **THEN** the venue MUST count as verified

#### Scenario: A type without details

- **WHEN** the proposal is a type that has no property a model may fill
- **THEN** the server MUST return the type with an empty `props` object and no unverified keys

#### Scenario: A value that does not fit its property

- **WHEN** a proposed value is not a valid literal for its property, such as an end date of "next Friday"
- **THEN** it MUST be left out of the proposal

### Requirement: Structured data proposals are reviewed in the dialog

The dialog MUST show the proposed type and its details, verified details
ticked, unverified ones unticked and marked. "Use selected" MUST apply only the
type and the ticked details. When the new type would drop details of the
current one, the dialog MUST say how many and ask before applying.

#### Scenario: Unverified details

- **WHEN** a proposal lists a key as unverified
- **THEN** the dialog MUST show it unticked, with a note that it was not found on the page, or that dates cannot be checked

#### Scenario: A type change that drops details

- **WHEN** the editor uses a proposal of another type and the current type has details the new one lacks
- **THEN** the dialog MUST say how many details would be removed, and apply only when the editor confirms

### Requirement: Requests are checked

The server MUST refuse with 400 `bad_request`, before any provider call, a body
over 128 KB, a body that is not a JSON object, an unknown or missing task, a
language that is not one of the site's own, an unknown, missing or empty list
of fields, a non-integer count, and members of the wrong type. Optional members
(current values, hint, page members) MAY be left out.

#### Scenario: Unknown field

- **WHEN** a text request names `canonical` as a field
- **THEN** the server MUST answer 400 `bad_request`, and the provider MUST NOT be called

#### Scenario: A placeholder language

- **WHEN** a request names `und` or a language the site does not have
- **THEN** the server MUST answer 400 `bad_request`

#### Scenario: A minimal request

- **WHEN** a text request has only a task, a language, one field, a count and an empty page
- **THEN** the server MUST accept it

### Requirement: Request text is capped

The server MUST cut, in characters, the hint to 200, each current value to
2000, the page title and site name to 255 and the page text to 12,000. Current
values of fields that were not requested MUST NOT be sent.

#### Scenario: Multibyte text

- **WHEN** a current value has 2001 characters of "ä"
- **THEN** exactly 2000 characters MUST reach the provider

#### Scenario: A current value of another field

- **WHEN** a title request carries a current social title
- **THEN** the social title MUST NOT reach the provider

### Requirement: Calls are rate limited per user

The server MUST allow 30 suggestion calls per user per 5 minutes and answer
429 `rate_limited` after that, for both tasks. Requests refused as bad MUST NOT
count. Each user MUST have their own limit.

#### Scenario: The 31st call

- **WHEN** a user makes a 31st valid request within 5 minutes
- **THEN** the server MUST answer 429 `rate_limited`, and the provider MUST NOT be called

#### Scenario: Another user

- **WHEN** another user asks while the first is limited
- **THEN** their request MUST succeed

### Requirement: Failures have stable codes and reveal nothing

Every failure MUST answer `{error: {code, message}}` and nothing else, with the
module's own message, never the provider's. The codes MUST be:
`ai_not_configured` (422), `blocked` (422), `rate_limited` (429),
`quota_exceeded` (503), `invalid_response` (502) and `provider_error` (502).
The dialog MUST show its own sentence for each code and offer to try again.

#### Scenario: No provider, or a provider that cannot be set up

- **WHEN** no default is set, the default provider is no longer installed, or it cannot load its key
- **THEN** the server MUST answer 422 `ai_not_configured`

#### Scenario: A site policy blocks the prompt

- **WHEN** a subscriber of the AI module flags the prompt as unsafe
- **THEN** the server MUST answer 422 `blocked`

#### Scenario: Provider quota

- **WHEN** the provider reports that the quota is used up
- **THEN** the server MUST answer 503 `quota_exceeded`, without the provider's message

#### Scenario: Unusable answer

- **WHEN** the model answers in prose with no JSON, or JSON in another shape, or JSON with no usable value
- **THEN** the server MUST answer 502 `invalid_response`

#### Scenario: Anything else

- **WHEN** the provider fails in any other way
- **THEN** the server MUST answer 502 `provider_error`

#### Scenario: Failure in the dialog

- **WHEN** a request fails with `rate_limited`
- **THEN** the tray MUST say the AI service is busy and to try again in a minute

### Requirement: Nothing of the prompt is logged

A failure MUST be logged on the `canvas_metatag_ai` channel with its code, the
task, the exception class and the provider's message. The prompts, the page
text, the editor's current values and hint, and the model's answer MUST NOT
reach any log channel.

#### Scenario: A logged failure

- **WHEN** a call fails because of the provider's rate limit
- **THEN** the log MUST name `rate_limited`, the task and the exception, and MUST NOT contain the page text or the hint

### Requirement: The system prompt holds nothing from the request

The system prompt MUST hold only the module's own text, the variant count, the
configured language name and the registry's types and properties. Everything
from the request MUST go into the user message: the page text between
`<page_content>` tags, the hint between `<editor_hint>` tags.

#### Scenario: Request text

- **WHEN** a request carries a page title, site name, page text, current values and a hint
- **THEN** none of them MUST appear in the system prompt

### Requirement: Request text cannot break out of its fence

Before it is sent, request text MUST be reduced to plain lines and
compatibility forms MUST be folded. Every opening or closing delimiter tag MUST
be removed however it is spelled (case, spaces, attributes, fullwidth brackets,
control characters), repeatedly, so that a removal cannot assemble a new tag.

#### Scenario: Page text that closes the fence

- **WHEN** the page text contains `</page_content>`, `<PAGE_CONTENT >`, a nested `<page_<page_content>content>` or a fullwidth variant
- **THEN** the user message MUST contain exactly one opening and one closing `page_content` tag

#### Scenario: A hint that closes its tag

- **WHEN** the hint contains `</editor_hint>`
- **THEN** the tag MUST be removed, and the rest of the hint kept

### Requirement: Model output is untrusted

Only requested fields, and for a proposal only allowed keys, MUST survive.
Braces MUST be removed from every value so that a model cannot plant a dynamic
value. Values MUST be reduced to plain text and cut (300 characters for text,
2000 for a detail). Text variants that contain a web address MUST be dropped.
Markup MUST be kept as plain text; every output escapes it.

#### Scenario: A hijacked answer

- **WHEN** the model returns an unrequested `canonical` row and a title with `{site}` and a script tag
- **THEN** the `canonical` row MUST be dropped, the braces removed, and the script tag returned as plain text

#### Scenario: A web address in a variant

- **WHEN** a text variant contains `www.example.com/menu`
- **THEN** that variant MUST be dropped

#### Scenario: JSON wrapped in prose

- **WHEN** the model wraps valid JSON in prose or a code fence
- **THEN** the server MUST still read it

### Requirement: Provider calls are bounded

The submodule MUST use the default provider and model for structured chat when
both are set, else those for chat. It MUST make one non-streamed call with a
30-second timeout, ask for structured JSON output, and tag the call
`canvas_metatag_ai` and `canvas_metatag_ai_text` or `canvas_metatag_ai_schema`.
An answer that is not a chat message MUST count as `invalid_response`.

#### Scenario: Both defaults set

- **WHEN** both a structured chat default and a chat default are configured
- **THEN** the structured chat default MUST be used, for the call and for `capabilities.ai`

### Requirement: Editors are told what is sent

The permission's description MUST say that each request is a paid call and
sends the page's current text, including unpublished draft text, to the
provider. Every suggest control MUST say that it sends the page's text to the
AI service, and every suggestion tray MUST end with a note that the text was
written by AI and its facts need checking.

#### Scenario: A suggestion tray

- **WHEN** suggestions are shown
- **THEN** the tray MUST say that they were written by AI from the page's text, and to check the facts
