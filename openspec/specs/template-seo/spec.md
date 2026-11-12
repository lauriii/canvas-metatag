# template-seo

## Purpose

Let a site builder set the search, social and structured data values of every
node of a content type ("Every Article") in that type's Full content template,
bound to the type's own fields, previewed with a real node, and published
together with the template. Every node of the type uses them; there is no
per-node override. How values reach the draft is draft-writes; how they become
the head is head-output.

## Requirements

### Requirement: Only the Full content template of a node type has SEO settings

Type-level settings MUST exist only for a node type's content template in the
`full` view mode. A write or a state request for any other template MUST be
answered with 404 `not_found` and MUST write nothing. The dialog names this
scope "Every" plus the content type's label (seo-dialog).

#### Scenario: A teaser template

- **WHEN** a write targets the Article type's teaser template
- **THEN** the system MUST answer 404 `not_found` and the template MUST get no draft

### Requirement: Type values are a setting of the template

A content type's values MUST be stored as a third-party setting of its Full
content template, and MUST export and import with it as configuration. A type
MAY set a title pattern, a description of at most 1000 characters, social
title, description and image, robots directives and a structured data type
with its details and custom JSON-LD, by the rules of a page (page-seo). It
MUST NOT set a canonical: a node's canonical is its own address.
Type values MUST be the same in every language.

#### Scenario: Export and import

- **WHEN** a template's setting is exported, removed on the site, and the configuration is imported
- **THEN** the setting MUST be back, and the template MUST be valid

#### Scenario: A canonical sent for a type

- **WHEN** a template write includes a canonical
- **THEN** the system MUST refuse it with "This setting is not available here."

### Requirement: The stored setting is always valid configuration

Empty values MUST NOT be stored, and clearing every value MUST remove the
setting. The stored setting MUST stay valid configuration for any text,
including emoji sequences, joiners and direction marks, so that a Canvas
publish of the template never fails on it.

#### Scenario: Clearing everything

- **WHEN** an editor removes every type-level value
- **THEN** the template's draft MUST carry no setting of the module

#### Scenario: Unusual text

- **WHEN** a template's title holds a joined emoji and its description a non-joiner and a direction mark, and the template is published
- **THEN** the publish MUST succeed and the stored template MUST validate

### Requirement: Values are previewed with a node of the type

The dialog MUST preview type values, and resolve its output, with the node the
Canvas template editor previews, in the language negotiated for the request.
That node MUST be of the template's content type. When the editor picks another
node to preview, the dialog MUST follow it.

#### Scenario: Switching the preview node

- **WHEN** the editor switches the template preview to another article
- **THEN** the dialog's caption and preview MUST show that article's title and field values

#### Scenario: A node of another type

- **WHEN** the state of the Article template is asked for with a node of another type, or a node that does not exist
- **THEN** the system MUST answer 404 `not_found`

### Requirement: Values go live when the template is published

Type values MUST live in the template's Canvas draft until the template is
published in Canvas, and MUST show in "Review changes" with the template.
Publishing MUST store them with the template and MUST enable the template. Only
an enabled template MUST give its nodes the module's head (head-output); a
template that was never published MUST affect only previews (headless-head).
Every node of the type MUST use the published values, each with its own field
values.

#### Scenario: Publishing

- **WHEN** an editor publishes the Article template with type values
- **THEN** the template MUST be enabled and hold the values, the draft MUST be gone, and each article's head MUST come from its own fields

### Requirement: The dialog edits the stored setting, the output uses overrides

The dialog's values and writes MUST use the template's stored setting, without
configuration overrides. The head and the dialog's output MUST use the setting
with configuration overrides applied.

#### Scenario: A configuration override of the title

- **WHEN** `settings.php` overrides the Article template's title pattern
- **THEN** the dialog's field MUST show the stored pattern, and the dialog's output and the head MUST use the override

### Requirement: Uninstalling keeps template drafts usable

Uninstalling the module MUST remove its setting from every stored template and
from every template draft. A template draft MUST keep its layout work and its
client id. A template without a setting of the module MUST keep its draft
untouched. During a configuration import the stored templates MUST be left to
the import; only the drafts MUST be cleaned.

#### Scenario: A template with a draft

- **WHEN** the module is uninstalled while a template has a draft with layout changes and type values
- **THEN** the draft MUST still hold the layout changes, MUST NOT hold the type values, and the stored template MUST NOT depend on the module
