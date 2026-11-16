## ADDED Requirements

### Requirement: Deleting a linked field leaves the template alone

A template's links MUST NOT make the template depend on the fields they link
to. Deleting a linked field MUST NOT change, disable or delete the template or
its draft; the link MUST become broken (dynamic-values).

#### Scenario: Deleting the summary field

- **WHEN** the Article template links its description to Summary and `field_summary` is deleted
- **THEN** the template MUST still exist with its layout, its values and its enabled state, and its description link MUST be reported as broken

## MODIFIED Requirements

### Requirement: Type values are a setting of the template

A content type's values MUST be stored as a third-party setting of its Full
content template, and MUST export and import with it as configuration. A type
MAY set a title and its ending, a description of at most 1000 characters, social
title, description and image, robots directives and a structured data type with
its details and custom JSON-LD, by the rules of a page (page-seo). It MUST NOT
set a canonical: a node's canonical is its own address. Type values MUST be the
same in every language.

#### Scenario: Export and import

- **WHEN** a template's setting is exported, removed on the site, and the configuration is imported
- **THEN** the setting MUST be back, and the template MUST be valid

#### Scenario: A linked value

- **WHEN** a template write links the description to Summary
- **THEN** the template's setting MUST hold the link, as configuration that validates

#### Scenario: A canonical sent for a type

- **WHEN** a template write includes a canonical
- **THEN** the system MUST refuse it with "This setting is not available here."

### Requirement: The stored setting is always valid configuration

Empty values MUST NOT be stored, and clearing every value MUST remove the
setting. "No ending" MUST be stored, as an empty typed ending. The stored
setting MUST stay valid configuration for any text, including emoji sequences,
joiners and direction marks, and for a broken link, so that a Canvas publish of
the template never fails on it.

#### Scenario: Clearing everything

- **WHEN** an editor removes every type-level value
- **THEN** the template's draft MUST carry no setting of the module

#### Scenario: Unusual text

- **WHEN** a template's title holds a joined emoji and its description a non-joiner and a direction mark, and the template is published
- **THEN** the publish MUST succeed and the stored template MUST validate

#### Scenario: A broken link

- **WHEN** a template whose description links to a deleted field is published
- **THEN** the publish MUST succeed and the stored template MUST validate

### Requirement: Values are previewed with a node of the type

The dialog MUST preview type values, and resolve its output, with the node the
Canvas template editor previews, in the language negotiated for the request.
That node MUST be of the template's content type. When the editor picks another
node to preview, the dialog MUST follow it, including the values shown in
linked boxes and in the link menu.

#### Scenario: Switching the preview node

- **WHEN** the editor switches the template preview to another article
- **THEN** the dialog's caption, previews, linked boxes and link menu MUST show that article's title and field values

#### Scenario: A node of another type

- **WHEN** the state of the Article template is asked for with a node of another type, or a node that does not exist
- **THEN** the system MUST answer 404 `not_found`

### Requirement: The dialog edits the stored setting, the output uses overrides

The dialog's values and writes MUST use the template's stored setting, without
configuration overrides. The head and the dialog's output MUST use the setting
with configuration overrides applied.

#### Scenario: A configuration override of the title

- **WHEN** `settings.php` overrides the Article template's title ending
- **THEN** the dialog's field MUST show the stored ending, and the dialog's output and the head MUST use the override
