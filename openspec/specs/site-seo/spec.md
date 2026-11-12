# site-seo

## Purpose

Hold what is safe as a site-wide value: who runs the site, the title pattern
and separator, a default social image and the search visibility defaults.
Site settings are saved as configuration, apply to every owned page and node
at once, and sit below every page and content type value (head-output).

## Requirements

### Requirement: Site settings are one configuration object

Site settings MUST be stored in the configuration object
`canvas_metatag.site` and MUST export and import like any other configuration.
The identity MUST hold the kind (organization or person), a name, the title
separator, a logo, a default social image and up to ten profile addresses. The
site-wide values MAY hold only a title pattern and robots directives: there is
no site-wide description, social text, canonical or structured data type. Site
settings MUST be the same in every language.

#### Scenario: A description sent for the site

- **WHEN** a site save includes a description
- **THEN** the system MUST refuse it with "This setting is not available here."

#### Scenario: Uninstalling

- **WHEN** the module is uninstalled
- **THEN** the configuration object MUST be removed, and a reinstall MUST start from the installed defaults

### Requirement: Installed defaults

Installing the module MUST set the title pattern `{title} {sep} {site}`,
`max_image_preview` large, the kind organization, the separator `|`, an empty
name and no images or profiles.

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

- **WHEN** a save has the kind "robot", the separator "ab", the logo "nope", a second profile "example", a field value in the title and a text preview limit of 2000
- **THEN** the system MUST answer 422 naming each of them, and the stored settings MUST be unchanged

#### Scenario: Clearing everything

- **WHEN** a save sends an empty identity and no values
- **THEN** the identity MUST fall back to its defaults (separator `|`) and there MUST be no site-wide values

#### Scenario: A malformed request

- **WHEN** a site save is not a JSON object, lacks the identity or the values, has values that are a list, or is over 128 KiB
- **THEN** the system MUST answer 400 `bad_request` and store nothing

### Requirement: Site values follow fixed rules

The kind MUST be organization or person, and the name at most 255 characters.
The separator MUST be one to three symbols that are not letters, digits,
spaces or controls; surrounding spaces MUST be ignored. The logo and the
default image MUST be a media UUID or empty. Each profile MUST be an absolute
http(s) address with a host and no credentials, of at most 2048 characters;
blank lines MUST be ignored and an eleventh profile refused.

#### Scenario: A separator with spaces

- **WHEN** the separator is sent as " · "
- **THEN** the stored separator MUST be "·"

#### Scenario: A profile that is not an address

- **WHEN** the second profile line is "example"
- **THEN** the message MUST be "Line 2 is not a full address. Start with https://."

### Requirement: A save is live at once

A site save MUST bypass Canvas's drafts and publishing, and MUST take effect on
the next request to every owned page and node, also one a visitor has in the
page cache. The answer to a save MUST be the settings as stored, in canonical
order. The dialog's save, discard and confirmation steps are seo-dialog.

#### Scenario: Saving a new name, separator and image

- **WHEN** an administrator sets the name "Example Co", the separator "·" and a default image, and saves
- **THEN** a page "About us" that a visitor had cached MUST show the title "About us · Example Co", `og:site_name` "Example Co" and the default image

### Requirement: The last save wins

Site settings MUST NOT be locked while someone edits them. A save MUST replace
the stored settings whatever happened since the dialog loaded them.

#### Scenario: Two administrators

- **WHEN** two administrators save site settings one after the other
- **THEN** the second save MUST be what is stored, without a conflict message

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
- **THEN** the state MUST have no preview and no output, and the dynamic values MUST be listed with empty values

### Requirement: Overrides from outside apply to the output only

The state MUST show the stored site settings, without configuration overrides,
and a save MUST store exactly what was sent. The head and the state's resolved
output MUST use the settings with overrides applied.

#### Scenario: A staging site

- **WHEN** `settings.php` sets the site's `noindex` and an identity name
- **THEN** the state's site settings MUST be the stored values, while every owned page and the state's resolved output carry `noindex` and the overridden name

### Requirement: The public address in use is shown

The state MUST report the public address the module uses for canonical links,
`og:url`, hreflang and structured data ids (headless-head), and where it comes
from: `settings` for the `canvas_metatag_public_base` setting, `frontend` for
the first headless frontend, `request` for the address of the request. Site
settings MUST show it.

#### Scenario: No setting and no frontend

- **WHEN** neither the setting nor a headless frontend is configured
- **THEN** the state MUST report the request's address with the source `request`
