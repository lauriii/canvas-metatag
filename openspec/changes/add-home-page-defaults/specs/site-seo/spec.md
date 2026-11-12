## MODIFIED Requirements

### Requirement: The identity says who runs the site

The identity MUST hold the kind (organization or person), a name, the title
separator, a logo, a default social image, up to ten profile addresses, up to
ten verification codes and up to five alternate names.

#### Scenario: Exporting the identity

- **WHEN** an administrator has set every identity member and the site settings are exported
- **THEN** the export MUST hold the kind, the name, the separator, the logo, the default image, the profile addresses, the verification codes and the alternate names under `identity`

### Requirement: Without a page in context, site settings preview a published page

Site settings MUST be available from every Canvas screen. With no page or Full
content template in context, the state MUST be resolved for the front page
(front-page) in the editor's language when it is a published Canvas page, or a
published node whose head the module owns, that the user may view; else for
the published Canvas page that changed last; else for nothing.

#### Scenario: The front page is a Canvas page

- **WHEN** the front page is set to a Canvas page, by its path or its alias, and no page is in context
- **THEN** the site settings MUST be previewed with that page, on the home address

#### Scenario: The front page is a templated node

- **WHEN** the front page is a published article and articles have an enabled Full content template
- **THEN** the site settings MUST be previewed with that article, on the home address

#### Scenario: No front page of Canvas

- **WHEN** the front page is not a Canvas page or an owned node
- **THEN** the site settings MUST be previewed with the published page that changed last, never with an unpublished one

#### Scenario: No page at all

- **WHEN** the site has no published Canvas page
- **THEN** the state MUST have no preview and no output, and the facts MUST be listed with empty values

## ADDED Requirements

### Requirement: The identity holds alternate names

The identity MAY hold up to five alternate names of the site, in order of
preference, each plain text of at most 255 characters. Blank entries MUST be
ignored, a name equal to the identity name or to an earlier alternate name
MUST be refused, and a sixth MUST be refused. Like the rest of the identity,
they MUST be the same in every language.

#### Scenario: Two alternate names

- **WHEN** an administrator saves the alternate names "Example" and "ES"
- **THEN** they MUST be stored in that order and appear in the structured data in that order

#### Scenario: A repeat

- **WHEN** the identity is named "Example" and the first alternate name is "example"
- **THEN** the save MUST be refused with "This is already the site's name." keyed to that alternate name

#### Scenario: Older configuration

- **WHEN** a site saved before this change has no alternate names
- **THEN** its identity MUST read as having none, without an update

### Requirement: Site settings show what the home page is

Site settings MUST show one read-only "Home page" row that names the home page
and says what this module does there: for an owned page, what search engines
read from it; for a page set by its alias, that it is; for a page the module
does not own, what is missing from it; for a language without a home page, that
its root does not open.

#### Scenario: An owned Canvas page

- **WHEN** the front page is the Canvas page "Home", set by its permanent address
- **THEN** the row MUST name "Home (Canvas page)" and offer to open it

#### Scenario: Set by its alias

- **WHEN** the front page setting holds the page's alias `/home`
- **THEN** the row MUST add "Set by its address /home" and explain that changing that address takes the home page down

#### Scenario: A listing

- **WHEN** the front page is a Views listing
- **THEN** the row MUST say the module does not publish the home page's title, description or site markup, that search engines will not find the site name there, and that verification codes set in SEO are not on it

#### Scenario: A node home page

- **WHEN** the front page is an article rendered by a template
- **THEN** the row MUST name the article and offer to open "Every Article" previewing it

### Requirement: Home page actions follow site permissions

Actions in the "Home page" row that change the front page setting, or lead to
the form that holds it, MUST be shown only to people who may administer site
configuration. Others MUST read that a site administrator can change it.

#### Scenario: An administrator

- **WHEN** a user who may administer site configuration sees "Set by its address /home"
- **THEN** the row MUST give the permanent address `/page/5` to copy and lead to the form that holds the front page setting

#### Scenario: An SEO administrator without site configuration

- **WHEN** a user who may administer SEO site settings, but not site configuration, sees the same row
- **THEN** the row MUST NOT lead to that form, and MUST say that a site administrator can change it
