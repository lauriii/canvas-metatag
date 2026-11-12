## MODIFIED Requirements

### Requirement: Two permissions

The module MUST provide "Edit SEO settings in Canvas" (`edit canvas metatag`)
and "Administer SEO site settings" (`administer canvas metatag`). The
administrative permission MUST be marked as restricted. The edit permission's
description MUST warn that the canonical address and the links of other tags
may point at another site.

#### Scenario: Permissions page

- **WHEN** a site builder opens the permissions page
- **THEN** both permissions MUST be listed, the administrative one with the restricted-access warning

#### Scenario: The edit permission's warning

- **WHEN** a site builder reads the edit permission's description
- **THEN** it MUST say that the canonical address and other tags' links may point at another site
