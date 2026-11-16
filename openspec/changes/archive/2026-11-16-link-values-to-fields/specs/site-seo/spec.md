## ADDED Requirements

### Requirement: The site sets the default title ending

The site's title ending MUST be one of: the Site name (the default, stored as
nothing), "No ending", or typed text of at most 255 characters. Every page and
content type that sets no ending of its own MUST use it. The site MUST NOT set
the title's main part: each page and node uses its own.

#### Scenario: A typed ending

- **WHEN** an administrator sets the title ending "Example Co" and saves
- **THEN** a page "About us" that sets no ending MUST have the title "About us | Example Co"

#### Scenario: No ending

- **WHEN** an administrator sets the title ending to "No ending" and saves
- **THEN** a page "About us" that sets no ending MUST have the title "About us"

#### Scenario: A main part sent for the site

- **WHEN** a site save includes a title main part
- **THEN** the system MUST refuse it with "This setting is not available here."

### Requirement: A site value the site may not hold is ignored

A site value the site may not hold, such as a title ending linked to a field
by a configuration import, MUST be ignored: not shown, not used in the head,
and dropped by the next save, so that the other site settings stay savable. A
value that differs from what the dialog shows MUST be validated as usual.

#### Scenario: An ending that a configuration import linked to a field

- **WHEN** the stored site values hold `title_end: {source: …}` after a configuration import, and an administrator changes only the logo
- **THEN** the dialog MUST show the Site name as the ending, the head MUST end titles with the Site name, the save MUST be accepted, the logo MUST be stored and the ending MUST be gone

#### Scenario: Linking the ending again

- **WHEN** the administrator then sends a title ending linked to a field
- **THEN** the save MUST be refused for `title_end` with "This setting is not available here."

## MODIFIED Requirements

### Requirement: Site settings are one configuration object

Site settings MUST be stored in the configuration object
`canvas_metatag.site` and MUST export and import like any other configuration.
The identity MUST hold the kind (organization or person), a name, the title
separator, a logo, a default social image and up to ten profile addresses. The
site-wide values MAY hold only a title ending and robots directives: there is
no site-wide description, social text, canonical or structured data type. Site
settings MUST be the same in every language.

#### Scenario: A description sent for the site

- **WHEN** a site save includes a description
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: Uninstalling

- **WHEN** the module is uninstalled
- **THEN** the configuration object MUST be removed, and a reinstall MUST start from the installed defaults

### Requirement: Installed defaults

Installing the module MUST store no title ending (so the ending is the Site
name), `max_image_preview` large, the kind organization, the separator `|`, an
empty name and no images or profiles.

#### Scenario: A fresh install

- **WHEN** the module is installed
- **THEN** a page titled "Pricing" on a site named "Example" MUST have the title "Pricing | Example" and robots `max-image-preview:large`

### Requirement: Site values are validated as a whole

A site save MUST send the whole identity and the whole set of site values.
Every member MUST be validated before anything is stored. When any member is
invalid, the system MUST answer 422 `invalid` with one sentence per refused
member, keyed by its dotted path (`identity.<key>` for the identity), and MUST
store nothing. An identity member that is left out MUST take its default.

#### Scenario: Several invalid members

- **WHEN** a save has the kind "robot", the separator "ab", the logo "nope", a second profile "example", a title ending linked to a field and a text preview limit of 2000
- **THEN** the system MUST answer 422 naming each of them, and the stored settings MUST be unchanged

#### Scenario: Clearing everything

- **WHEN** a save sends an empty identity and no values
- **THEN** the identity MUST fall back to its defaults (separator `|`) and there MUST be no site-wide values

#### Scenario: A malformed request

- **WHEN** a site save is not a JSON object, lacks the identity or the values, has values that are a list, or is over 128 KiB
- **THEN** the system MUST answer 400 `bad_request` and store nothing

### Requirement: Without a page in context, site settings preview a published page

Site settings MUST be available from every Canvas screen. With no page or Full
content template in context, the state MUST be resolved for the front page when
it is a published Canvas page the user may view, else for the published Canvas page that
changed last, else for nothing.

#### Scenario: The front page is a Canvas page

- **WHEN** the front page is set to a Canvas page, by its path or its alias, and no page is in context
- **THEN** the site settings MUST be previewed with that page, on the home address

#### Scenario: No front page of Canvas

- **WHEN** the front page is not a Canvas page
- **THEN** the site settings MUST be previewed with the published page that changed last, never with an unpublished one

#### Scenario: No page at all

- **WHEN** the site has no published Canvas page
- **THEN** the state MUST have no preview and no output, and the facts MUST be listed with empty values

## REMOVED Requirements

### Requirement: A site value sent back unchanged is kept

**Reason**: The site holds only its title ending and robots. A value it may
not hold is ignored and dropped by the next save, never sent back.

**Migration**: "A site value the site may not hold is ignored" (above).
