# Spec Delta

## Purpose

Offer a Canvas page's SEO to the AI module's tool system, so that agents, such
as Canvas's AI chat, can read what search engines and social apps get and
propose better text. The tools are read-only and never apply anything.

## ADDED Requirements

### Requirement: The submodule offers SEO tools

canvas_metatag_ai MUST register a tool group "SEO (Canvas Metatag)" with the
AI module, holding the read tool `canvas_metatag:get_seo` and, when it ships,
the suggestion tool `canvas_metatag:suggest_seo`. The base module MUST NOT
register any tool. The tools MUST need only the AI module, not the AI Agents
module or Canvas AI.

#### Scenario: Submodule enabled

- **WHEN** canvas_metatag_ai is enabled
- **THEN** the AI module's tool list MUST contain `canvas_metatag:get_seo` in the group "SEO (Canvas Metatag)"

#### Scenario: Submodule not enabled

- **WHEN** only canvas_metatag is enabled
- **THEN** the AI module's tool list MUST NOT contain any `canvas_metatag:` tool

#### Scenario: No agent modules

- **WHEN** canvas_metatag_ai is enabled on a site without AI Agents and Canvas AI
- **THEN** the read tool MUST run and return its output

### Requirement: Tools work on one Canvas page

Every tool MUST take an entity type and an entity id. The entity type MUST be
`canvas_page`; any other type MUST be refused before a page is loaded. An id
that names no page MUST be refused with "No such page." A refusal MUST end the
call with an error and no output.

#### Scenario: A node with the id of a page

- **WHEN** a tool is called with entity type `node` and an id that is also the id of an existing Canvas page
- **THEN** the call MUST be refused, and nothing of that page MUST be in any output

#### Scenario: A missing page

- **WHEN** a tool is called with entity type `canvas_page` and an id no page has
- **THEN** the call MUST fail with "No such page."

### Requirement: Tools see the version the editor sees

A tool MUST read the page translation that the request's content language
selects, falling back to the default translation. It MUST read that
translation's Canvas draft when there is one, by the same rule the dialog's
state uses. A translation that exists only as a draft MUST NOT be reachable
through a tool.

#### Scenario: A page with an SEO draft

- **WHEN** a page has an unpublished SEO title in its Canvas draft and a user with access calls the read tool
- **THEN** the output MUST show the draft's title, not the published one

#### Scenario: A page without a draft

- **WHEN** a page has no Canvas draft
- **THEN** the read tool MUST report the stored page

### Requirement: The read tool reports what visitors would get

The read tool MUST return, for the page's current version: the search title,
the description, the social title, description and image, whether search
engines are asked not to index or follow it, the canonical address, the
structured data type, whether the main structured data item is withheld, and
the required and recommended details it is missing. These MUST match what the
dialog's state reports as resolved for the same user and page.

#### Scenario: Same as the dialog

- **WHEN** a user opens the dialog's state for a page and calls the read tool for the same page
- **THEN** each reported value MUST equal the matching value of the state's resolved output

#### Scenario: A withheld event

- **WHEN** a page's type is Event and its start date is not set
- **THEN** the read tool MUST say that the event is withheld and that the start date is missing

#### Scenario: A hidden page

- **WHEN** a page's search visibility is set to not indexed
- **THEN** the read tool MUST say that search engines are asked not to index it

### Requirement: Read tool output is plain and bounded

The read tool MUST return the same facts twice: as labelled lines of text for a
model, and as a structured map for other tool consumers. Every value MUST be
plain text cut to 300 characters. The output MUST NOT contain the page's body
text or the text of custom JSON-LD.

#### Scenario: Markup in a title

- **WHEN** a page's search title contains `<script>`
- **THEN** the read tool MUST return it as plain text, not as markup

#### Scenario: A long description

- **WHEN** a page's description is 1000 characters long
- **THEN** the read tool MUST return at most 300 characters of it

### Requirement: Tools never write

A tool call MUST NOT save an entity, change a Canvas draft, write configuration
or write to a temporary store, whether it succeeds or fails.

#### Scenario: A successful call

- **WHEN** a user with access calls each tool for a page with a draft
- **THEN** the page, its Canvas draft and the site's configuration MUST be unchanged

#### Scenario: A refused call

- **WHEN** a tool refuses a call
- **THEN** nothing MUST have been written

### Requirement: Tools cannot apply anything in Canvas's chat

A tool MUST NOT return anything that Canvas's AI chat applies to the editor. What
a tool returns MUST reach the editor only as text the agent writes.

#### Scenario: Read tool in the chat

- **WHEN** Canvas's AI chat runs the read tool
- **THEN** the editor's page, its form values and its layout MUST be unchanged by the tool's result

### Requirement: The suggestion tool proposes search, social and structured data

The suggestion tool MUST take a kind, one of `search_title`, `social` and
`schema`, and MAY take a hint. It MUST return three search title variants,
three social cards (title and description together), or one structured data
type with its facts. It MUST NOT offer the page description or the page's own
title. A search title request MUST carry the page's effective title ending,
with its separator, as the dialog's request does, so that the variants leave
room for it.

#### Scenario: Search title variants and the ending

- **WHEN** the suggestion tool is called with kind `search_title` for a page whose title ending is the site name "Example"
- **THEN** the user message MUST carry "| Example" as the title ending

#### Scenario: Social card

- **WHEN** the suggestion tool is called with kind `social`
- **THEN** it MUST return variants for the social title and the social description

#### Scenario: Description asked for

- **WHEN** the suggestion tool is called with kind `description`
- **THEN** the call MUST be refused, and the provider MUST NOT be called

#### Scenario: A long hint

- **WHEN** the hint has 500 characters
- **THEN** only the first 200 MUST reach the provider

### Requirement: The suggestion tool reads the page's text on the server

The suggestion tool MUST take the page's title and text from the version the
editor sees, never from its caller. The text MUST be cut to 12,000
characters. It MUST be fenced and cleaned exactly as text from the dialog is.

#### Scenario: Text in a component

- **WHEN** a draft page has a heading component with the text "Spring menu"
- **THEN** the text sent to the provider MUST contain "Spring menu"

#### Scenario: Text that closes the fence

- **WHEN** the page text contains `</page_content>`
- **THEN** the user message MUST contain exactly one opening and one closing `page_content` tag

### Requirement: Suggestion tool output says it was not applied

The suggestion tool's text output MUST say that nothing was applied and that
the editor can copy a variant into the SEO dialog. Its values MUST be cleaned
as the dialog's suggestions are. A structured data proposal MUST list the
facts that were not found on the page separately, marked to check before use.

#### Scenario: Title variants

- **WHEN** the suggestion tool returns search title variants
- **THEN** its text MUST say that they were not applied, followed by the numbered variants

#### Scenario: An unverified fact

- **WHEN** a proposed event venue is not in the page text
- **THEN** the output MUST list the venue under facts not found on the page

#### Scenario: Braces in a variant

- **WHEN** the model returns a title variant with `{site}` in it
- **THEN** the variant MUST be returned with `{site}` as plain text, as the dialog's suggestions keep it

#### Scenario: A web address in a variant

- **WHEN** the model returns a title variant that contains `www.example.com`
- **THEN** that variant MUST NOT be in the output

### Requirement: Suggestion tool failures reveal nothing

When a suggestion cannot be made, the suggestion tool MUST fail with the
sentence the dialog's API gives for the same error code, never the provider's
message. A failure MUST be logged like a failed dialog request, and the page
text, the hint and the answer MUST NOT reach any log.

#### Scenario: Provider rate limit

- **WHEN** the provider reports a rate limit during a suggestion tool call
- **THEN** the tool MUST fail with "The AI service is busy. Try again in a minute."

#### Scenario: Not set up

- **WHEN** no default AI provider is set up
- **THEN** the tool MUST fail with "AI suggestions aren't set up on this site yet.", and the log MUST NOT contain the page text

### Requirement: Suggestion tool calls can be told apart

A provider call made by the suggestion tool MUST carry the tag
`canvas_metatag_ai_chat`, and one made from the dialog MUST carry
`canvas_metatag_ai_dialog`, besides the tags the call already has. A
suggestion tool call MUST also name the page as entity context in its request
metadata.

#### Scenario: Tags

- **WHEN** the suggestion tool asks for title variants
- **THEN** the provider call MUST be tagged `canvas_metatag_ai` and `canvas_metatag_ai_chat`

#### Scenario: Entity context

- **WHEN** the suggestion tool asks for variants for page 7
- **THEN** the request metadata MUST name entity type `canvas_page`, id 7, its UUID and its bundle
