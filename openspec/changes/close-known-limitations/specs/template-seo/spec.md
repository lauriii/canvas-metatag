## RENAMED Requirements

- FROM: `### Requirement: The dialog edits the stored setting, the output uses overrides`
- TO: `### Requirement: A setting replaced by configuration is shown as it applies`

## MODIFIED Requirements

### Requirement: A setting replaced by configuration is shown as it applies

Where a configuration override replaces a path of a template's setting, the state MUST list it in `overridden` with the value the output uses, keep the stored value (active configuration without overrides) in `values`, also when a draft exists, and the dialog's field and preview MUST use the override. A write MUST be refused at that path unless it sends the stored value. Saving or publishing the template MUST NOT store the override; a configuration import MUST be stored as imported.

#### Scenario: A configuration override of the title

- **WHEN** `settings.php` overrides the Article template's title ending with "Staging" and the stored ending is the site's
- **THEN** the state's `values` MUST hold the stored ending, `overridden` MUST hold "Staging" at `title_end`, and the dialog's field, its previews and the head MUST all use "Staging"

#### Scenario: A draft exists

- **WHEN** the Article template has a draft and the same override is set
- **THEN** the state's `values` MUST still hold the stored ending, and the dialog's previews MUST still use "Staging"

#### Scenario: A write at an overridden path

- **WHEN** a write sends another ending for the Article template
- **THEN** the system MUST answer 422 `invalid` with "This is set in site configuration outside SEO. Change it there, or remove the override first." at `title_end`, and MUST write nothing

#### Scenario: Publishing under an override

- **WHEN** an editor moves a component in the Article template and publishes it while the override is set
- **THEN** the stored ending MUST still be the site's

#### Scenario: A dialog write under an override

- **WHEN** the Article template has no draft, the ending override is set, and the dialog writes a new description
- **THEN** the new draft MUST hold the new description and the stored ending, not "Staging"
