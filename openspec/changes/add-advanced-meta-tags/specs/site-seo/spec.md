## ADDED Requirements

### Requirement: The identity says who runs the site

The identity MUST hold the kind (organization or person), a name, the title
separator, a logo, a default social image, up to ten profile addresses and up
to ten verification codes.

#### Scenario: Exporting the identity

- **WHEN** an administrator has set every identity member and the site settings are exported
- **THEN** the export MUST hold the kind, the name, the separator, the logo, the default image, the profile addresses and the verification codes under `identity`

### Requirement: Verification codes are part of the identity

The identity MAY hold up to ten verification codes. Each MUST name one of the
verification names in the tag policy and hold a code of 1 to 128 letters,
digits, `_`, `.`, `=` and `-`. The same name MAY appear more than once, for a
site with several owners. Codes MUST be the same in every language.

#### Scenario: A whole tag in the code

- **WHEN** a site save holds a code that is a whole `<meta …>` tag
- **THEN** the system MUST refuse `identity.verification.0.code` with "This doesn't look like a code. Paste the code or the whole tag."

#### Scenario: An unknown name

- **WHEN** a site save holds a code for a name that is not in the tag policy
- **THEN** the system MUST refuse `identity.verification.0.name`

#### Scenario: An eleventh code

- **WHEN** a site save holds eleven codes
- **THEN** the system MUST refuse the eleventh with "Use at most 10 codes."

## MODIFIED Requirements

### Requirement: Site settings are one configuration object

Site settings MUST be stored in the configuration object
`canvas_metatag.site` and MUST export and import like any other configuration.
They MUST hold the identity ("The identity says who runs the site") and the
site-wide values. The site-wide values MAY hold only a title ending, robots
directives (AI use included) and other tags: there is no site-wide
description, social text, canonical, stop date or structured data type. Site
settings MUST be the same in every language.

#### Scenario: A description sent for the site

- **WHEN** a site save includes a description
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: A stop date sent for the site

- **WHEN** a site save includes a stop date
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: Uninstalling

- **WHEN** the module is uninstalled
- **THEN** the configuration object MUST be removed, and a reinstall MUST start from the installed defaults
