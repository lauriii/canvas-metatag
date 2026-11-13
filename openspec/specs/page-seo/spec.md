# page-seo

## Purpose

Let an editor set the search, social and structured data values of one Canvas
page ("This page"), store them with the page, per translation, and publish them
together with the rest of the page's Canvas draft. How values reach the draft is
draft-writes; how they become the head is head-output.

## Requirements

### Requirement: Page values are stored with the page, per translation

A Canvas page MUST store its SEO overrides in a translatable, revisionable
field of its own, with no form widget. A page MAY set a title pattern, a
canonical address, social title, description and image, robots directives and a
structured data type with its details and custom JSON-LD. A page MUST NOT store
a description: its description is Canvas's own description field, saved and
published with Canvas's Page data (seo-dialog hands it over).

#### Scenario: A description sent for a page

- **WHEN** a write for a page includes a description
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: Installing on a site with pages

- **WHEN** the module is installed on a site with pages and pending Canvas drafts
- **THEN** no page MUST gain a value or a draft, and existing drafts MUST be unchanged

### Requirement: Empty values are not stored

Empty values MUST NOT be stored, and map keys MUST be stored in a fixed order,
so that the same values are always the same text. A page with no override MUST
store nothing at all.

#### Scenario: Nothing set

- **WHEN** an editor clears every override of a page
- **THEN** the page's field MUST be empty, not an empty object

#### Scenario: The same values in another order

- **WHEN** the same values are sent with their keys in another order, or with empty members
- **THEN** the stored text MUST be the same

### Requirement: Page values follow fixed rules

A canonical MUST be a path that starts with exactly one slash, made of the
characters an address path and query allow plus non-ASCII letters, or an
absolute http(s) address with a host and without credentials, at most 2048
characters, and MUST NOT contain a fragment. Titles and social titles MUST be at
most 255 characters, social descriptions 1000. Control and bidi override
characters MUST be removed from text; typed text MUST NOT be otherwise changed.

#### Scenario: A fragment in the canonical

- **WHEN** the canonical is `/plans#faq`
- **THEN** the system MUST refuse it and ask to leave out the `#` and what follows

#### Scenario: A protocol-relative canonical

- **WHEN** the canonical is `//other.example.com/x`
- **THEN** the system MUST refuse it

### Requirement: Robots directives have fixed values

Robots directives MUST be true or false for `noindex`, `nofollow` and
`nosnippet`, a whole number from -1 (no limit) to 1000 for `max_snippet`, and
none, standard or large for `max_image_preview`. Any other directive MUST be
refused.

#### Scenario: A text limit out of range

- **WHEN** `max_snippet` is 2000 or `"50"`
- **THEN** the system MUST refuse `robots.max_snippet`

### Requirement: A Canvas page inherits from no content type

The effective values of a Canvas page MUST be its own values over the site
layer (head-output), with nothing from any content type template.

#### Scenario: An Article template exists

- **WHEN** the Article template sets a title pattern and a Canvas page sets nothing
- **THEN** the page's title MUST follow the site pattern

### Requirement: Values go live when the page is published

Page values MUST live in the page's Canvas draft until the page is published in
Canvas, MUST show in Canvas's "Review changes" and MUST be discarded there with
the rest of the page's changes. Publishing MUST store the value in a new
revision of the page, together with the rest of the draft. Earlier revisions
MUST keep their value. A publisher without either SEO permission MUST be able
to publish a page whose SEO value changed.

#### Scenario: Publishing

- **WHEN** an editor publishes a page with a title override
- **THEN** the page MUST have a new revision with the override, the draft MUST be gone, the previous revision MUST keep its value, and the visitor's head MUST carry the new title

#### Scenario: Discarding in Review changes

- **WHEN** the editor discards the page's changes in "Review changes"
- **THEN** the SEO override MUST be gone with them

### Requirement: Settings are per translation

Each translation MUST have its own values, draft and auto-save entry. A write
MUST name the language it is for, and the dialog MUST edit the translation the
Canvas editor edits, including a translation that so far exists only as a
Canvas draft. A new translation MUST start without overrides. A write or a state
request for a language the page has no translation or draft in MUST be answered
with 404 `not_found`.

#### Scenario: A new translation

- **WHEN** a translation is added to a page with overrides
- **THEN** the translation MUST start with no overrides, and the source language's values MUST be unchanged

#### Scenario: Writing a translation

- **WHEN** an editor writes the French translation's title
- **THEN** only the French draft MUST change, and the English values MUST be untouched

#### Scenario: A translation drafted in Canvas

- **WHEN** an editor opens the SEO dialog on a Spanish translation that exists only as a Canvas draft
- **THEN** the dialog MUST edit the Spanish draft, the state MUST report it as not published, and the stored page MUST still have no Spanish translation

#### Scenario: A language without a version

- **WHEN** a write names German for a page with no German translation and no German draft
- **THEN** the system MUST answer 404 `not_found`

### Requirement: A translation inherits three settings of the default version

A translation that is not the default one MUST inherit the robots directives,
the social image and the structured data type of the default-language version
until it sets its own; its own directives MUST win one by one. A draft-only
translation MUST inherit from the stored default version. Canonical, title,
social text and structured data details MUST NOT be inherited. The details of
an inherited type MUST be the translation's own, validated against that type.

#### Scenario: Inherited visibility and type

- **WHEN** the English version sets `noindex`, a social image and the type Product, and the French translation sets nothing
- **THEN** the French head MUST carry `noindex`, that image and the Product type, with the French title and the French canonical

#### Scenario: Details of an inherited type

- **WHEN** the French translation of a Product page sets a price and a name without naming a type
- **THEN** the write MUST be accepted and the product MUST appear with the French details

#### Scenario: The same details on the default version

- **WHEN** the default version, which names no type, sends those details
- **THEN** the system MUST refuse each of them

### Requirement: A duplicate does not keep the canonical

Duplicating a page MUST keep its SEO overrides in every translation, except the
canonical, which MUST be removed in every translation.

#### Scenario: Duplicating

- **WHEN** a page with a canonical, a title and `noindex` is duplicated
- **THEN** the copy MUST keep the title and `noindex`, MUST have no canonical, and the original MUST keep its canonical

### Requirement: Uninstalling removes page values from drafts

Uninstalling the module MUST remove the page field and MUST remove the SEO
value from every page draft, including the draft of a translation that was
never published, keeping the rest of the draft. After a reinstall, pages and
their drafts MUST have no SEO value.

#### Scenario: A page with a draft

- **WHEN** the module is uninstalled while a page has a draft with an SEO value
- **THEN** the page and its draft MUST still load, and after a reinstall neither MUST carry the old value

### Requirement: A translation keeps the details of its published type

While the default version's draft changes its structured data type, a write to
a translation MUST keep the translation's stored details of the published type,
which the dialog cannot show. Taking the type change back, or discarding it,
MUST lose none of them.

#### Scenario: A type change taken back while it is a draft

- **WHEN** the English version is published as a Product, its draft changes the type to Article, the French translation, whose stored details hold the price 25, changes only its title, and the English draft then changes the type back to Product
- **THEN** the French details MUST show the price 25 again, and once published, the French head MUST carry the Product with the price 25

#### Scenario: The type change is discarded

- **WHEN** the same French title change is made and the English draft is then discarded
- **THEN** the French details MUST still hold the price 25

#### Scenario: The type change is published

- **WHEN** the English Article draft is published and the French translation is then written again
- **THEN** the French details of the Product MAY be dropped, and the French head MUST carry no Product

### Requirement: A new translation publishes its own values

When a translation that exists only as a Canvas draft is published, its SEO
value MUST be stored with it, also when that value equals the default
version's.

#### Scenario: The same value as the default version

- **WHEN** the English version stores the title `{title}` and nothing else, and a Spanish draft-only translation stores the same title and is published
- **THEN** the stored Spanish translation MUST hold the title `{title}`

#### Scenario: A different value

- **WHEN** the Spanish draft-only translation stores `{"robots":{"noindex":true}}` and is published
- **THEN** the stored Spanish translation MUST hold that value
