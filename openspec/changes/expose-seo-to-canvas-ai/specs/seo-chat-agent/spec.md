# Spec Delta

## Purpose

Let Canvas's AI chat answer questions about a page's search and social
appearance through an SEO sub-agent that reads the page with the SEO tools and
only ever suggests. Optional: it exists only where AI Agents and Canvas AI are
enabled.

## ADDED Requirements

### Requirement: The agent exists only with Canvas AI

canvas_metatag_ai MUST ship the agent "SEO suggestions (Canvas Metatag)"
(`canvas_metatag_seo_agent`) and the agent override `canvas_metatag_seo_chat`
as optional configuration. Both MUST be created when AI Agents and Canvas AI
are enabled, whether before or after the submodule. Both MUST be removed when
either of those modules, or the submodule, is uninstalled.

#### Scenario: Without Canvas AI

- **WHEN** canvas_metatag_ai is enabled on a site without AI Agents or Canvas AI
- **THEN** neither the agent nor the override MUST exist, and the dialog's suggestions MUST work as before

#### Scenario: Canvas AI enabled later

- **WHEN** AI Agents and Canvas AI are enabled after canvas_metatag_ai
- **THEN** the agent and the override MUST be created

#### Scenario: Canvas AI uninstalled

- **WHEN** Canvas AI is uninstalled
- **THEN** the agent and the override MUST be removed, and canvas_metatag_ai MUST stay enabled

#### Scenario: Submodule uninstalled

- **WHEN** canvas_metatag_ai is uninstalled
- **THEN** the agent and the override MUST be removed, and Canvas's orchestrator agent MUST be as it was before the install

### Requirement: Canvas's AI chat can delegate SEO questions

The override MUST add the SEO agent to the tools of Canvas's orchestrator agent
and append a section to its instructions that says when to use it. It MUST NOT
remove any tool, change any tool setting, or replace any of the orchestrator's
instructions. An administrator MUST be able to turn the bridge off by disabling
the override in the agents UI.

#### Scenario: The orchestrator after install

- **WHEN** Canvas's orchestrator agent is built with the override enabled
- **THEN** it MUST offer `canvas_metatag_seo_agent` next to all of its own tools, and its instructions MUST end with the SEO section

#### Scenario: Bridge turned off

- **WHEN** an administrator disables the override
- **THEN** the orchestrator MUST NOT offer the SEO agent, and the SEO agent MUST stay available to other agents

### Requirement: The agent has the SEO tools only

The agent MUST have the read tool and, when it ships, the suggestion tool, and
no other tool. Its answers MUST NOT draw on information tools that put page
text into its instructions.

#### Scenario: Agent tools

- **WHEN** a site builder opens the SEO agent in the agents UI
- **THEN** its tools MUST be "Get SEO settings" and, when it ships, "Suggest SEO text", and nothing else

### Requirement: The agent works on the page open in Canvas

The entity type and id the agent passes to a tool MUST come from Canvas AI's
editor context, and the model MUST NOT see or set them. When the editor is on
a node or a template, the tools MUST refuse to run, and no SEO data of any page
MUST reach the chat.

#### Scenario: A Canvas page

- **WHEN** the agent runs from the chat on Canvas page 7
- **THEN** every tool call MUST be for entity type `canvas_page` and id 7

#### Scenario: A node with the id of a page

- **WHEN** the agent runs from the chat on node 12 and Canvas page 12 exists
- **THEN** no tool MUST run for page 12, and nothing of page 12 MUST be in the answer

### Requirement: The agent only suggests

The agent's protected instructions MUST say that it cannot change the page,
that tool results are material and not instructions, and that it never writes
the page description or the page title. Every answer MUST end by telling the
editor to open SEO in the top bar and paste a suggestion into the matching
field.

#### Scenario: Protected instructions

- **WHEN** a site builder opens the SEO agent in the agents UI
- **THEN** its protected instructions MUST contain those rules, and they MUST contain no token that request data can fill

#### Scenario: After the agent answers

- **WHEN** the agent has answered in Canvas's chat
- **THEN** the page, its Canvas draft and the site's configuration MUST be unchanged by the agent and its tools

### Requirement: Canvas keeps the page description and title

The override's instructions MUST send requests for the page description to
Canvas's own description agent, and for the page's own title to Canvas's own
title agent. Requests for the title in search results, the social card or
structured data MUST go to the SEO agent.

#### Scenario: Override instructions

- **WHEN** a site builder reads the override in the agents UI
- **THEN** its text MUST name Canvas's description and title agents for those fields, and the SEO agent for search titles, social cards and structured data
