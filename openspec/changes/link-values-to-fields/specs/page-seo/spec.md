## MODIFIED Requirements

### Requirement: Page values are stored with the page, per translation

A Canvas page MUST store its SEO overrides in a translatable, revisionable
field of its own, with no form widget. A page MAY set its title's main part as
typed text, a title ending, a canonical address, social title, description and
image, robots directives and a structured data type with its details and custom
JSON-LD. A page MUST NOT store a description: its description is Canvas's own
description field, saved and published with Canvas's Page data (seo-dialog
hands it over).

#### Scenario: A description sent for a page

- **WHEN** a write for a page includes a description
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: Installing on a site with pages

- **WHEN** the module is installed on a site with pages and pending Canvas drafts
- **THEN** no page MUST gain a value or a draft, and existing drafts MUST be unchanged

#### Scenario: Only the page's own words

- **WHEN** an editor types "Pricing plans" as a page's title on a site whose ending is the Site name
- **THEN** the page MUST store only "Pricing plans" as its main part and no ending

### Requirement: Page values follow fixed rules

A canonical MUST be a path that starts with exactly one slash, made of the
characters an address path and query allow plus non-ASCII letters, or an
absolute http(s) address with a host and without credentials, at most 2048
characters, and MUST NOT contain a fragment. Titles, title endings and social
titles MUST be at most 255 characters, social descriptions 1000. Control and
bidi override characters MUST be removed from text; typed text MUST NOT be
otherwise changed.

#### Scenario: A fragment in the canonical

- **WHEN** the canonical is `/plans#faq`
- **THEN** the system MUST refuse it and ask to leave out the `#` and what follows

#### Scenario: A protocol-relative canonical

- **WHEN** the canonical is `//other.example.com/x`
- **THEN** the system MUST refuse it

#### Scenario: A long ending

- **WHEN** a page's title ending has 256 characters
- **THEN** the system MUST refuse `title_end`

### Requirement: A Canvas page inherits from no content type

The effective values of a Canvas page MUST be its own values over the site
layer (head-output), with nothing from any content type template.

#### Scenario: An Article template exists

- **WHEN** the Article template sets a title ending and a Canvas page sets nothing
- **THEN** the page's title MUST end with the site's ending, not the Article template's

### Requirement: A translation inherits three settings of the default version

A translation that is not the default one MUST inherit the robots directives,
the social image and the structured data type of the default-language version
until it sets its own; its own directives MUST win one by one. A draft-only
translation MUST inherit from the stored default version. Canonical, both
title parts, social text and structured data details MUST NOT be inherited.
The details of an inherited type MUST be
the translation's own, validated against that type.

#### Scenario: Inherited visibility and type

- **WHEN** the English version sets `noindex`, a social image and the type Product, and the French translation sets nothing
- **THEN** the French head MUST carry `noindex`, that image and the Product type, with the French title and the French canonical

#### Scenario: Details of an inherited type

- **WHEN** the French translation of a Product page sets a price and a name without naming a type
- **THEN** the write MUST be accepted and the product MUST appear with the French details

#### Scenario: The same details on the default version

- **WHEN** the default version, which names no type, sends those details
- **THEN** the system MUST refuse each of them

#### Scenario: An ending set on the default version

- **WHEN** the English version sets the title ending "Docs" and the French translation sets none
- **THEN** the French title MUST end with the site's ending, not "Docs"
