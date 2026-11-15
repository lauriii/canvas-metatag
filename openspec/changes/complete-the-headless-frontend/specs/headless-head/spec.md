## ADDED Requirements

### Requirement: A frontend on the SDK's metadata adapter can render the whole head

The README MUST give one recipe for `@drupal-canvas/headless-next` that turns
the content API head into the framework's metadata and elements with no row,
link or script lost, and that inherits no description or canonical the head
leaves out. Its helper MUST be one example file that the README quotes. A test
MUST run the helper on the module's head and fail when anything is lost.

#### Scenario: An article's image details and times

- **WHEN** the recipe is applied to the content API head of a published article with an image
- **THEN** the metadata MUST hold the image's address, width, height and alt text as one Open Graph image, and the article's publication and modification times

#### Scenario: No description

- **WHEN** the head of a page has no description row
- **THEN** the recipe's metadata MUST set the description to the empty string, so that no layout's description is inherited

#### Scenario: No canonical

- **WHEN** the head of a page has neither a canonical link nor hreflang links
- **THEN** the recipe's metadata MUST set its alternates to null, so that no layout's canonical is inherited

#### Scenario: Structured data

- **WHEN** the recipe's JSON-LD component renders a head
- **THEN** it MUST render one `application/ld+json` script whose text parses back to `head.script[0].textContent` and contains no `</script`

#### Scenario: A row the recipe does not handle

- **WHEN** a later change adds a meta row to the head that the recipe does not map
- **THEN** the test MUST fail and name the row

#### Scenario: The README and the file differ

- **WHEN** the example file changes and the README's quote of it does not
- **THEN** the test MUST fail

### Requirement: Page addresses on a host no visitor reaches are left out

When the public base comes from the setting or a frontend and is on a
non-public host (a loopback, private or link-local IP, a single-label host, or
a host under `localhost`, `local`, `test`, `internal` or `invalid`), and
Drupal's own host is not a development host, the head MUST carry no canonical,
`og:url`, hreflang or JSON-LD script, in coupled and headless output alike.

#### Scenario: A development frontend in production

- **WHEN** a page is fetched through the content API at `https://cms.example.com`, no public base is set, and the first frontend is `http://localhost:3000`
- **THEN** its head MUST carry no canonical, `og:url`, hreflang or JSON-LD script, and MUST keep its title, description and `og:image`

#### Scenario: A development site

- **WHEN** the same page is fetched at `https://cms.example.test`
- **THEN** its canonical MUST be on `http://localhost:3000`

#### Scenario: Plain http on a public host

- **WHEN** the first frontend is `http://www.example.com` and the page is fetched at `https://cms.example.com`
- **THEN** its canonical MUST be on `http://www.example.com`

### Requirement: The status report flags a public base no visitor can use

The status report MUST show "SEO public addresses" as an error when the public
base comes from the setting or a frontend and is plain http or on a non-public
host. While Drupal's own host is a development host it MUST be a warning, and
absent when the public base is on a development host too. A public base from
the request that is plain http MUST be a warning on a production-like host.
Each message MUST name the address and its fix.

#### Scenario: A development frontend in production

- **WHEN** the status report is viewed at `https://cms.example.com`, no public base is set, and the first frontend is `http://localhost:3000`
- **THEN** it MUST show an error naming `http://localhost:3000` and the `canvas_metatag_public_base` setting

#### Scenario: A local frontend on a development site

- **WHEN** the same configuration is viewed at `https://cms.example.test`
- **THEN** the status report MUST NOT show the row

#### Scenario: A plain http frontend on a development site

- **WHEN** the first frontend is `http://www.example.com` and the status report is viewed at `https://cms.example.test`
- **THEN** it MUST show a warning, not an error

#### Scenario: A public base set for the environment

- **WHEN** the setting is `https://www.example.com` and the first frontend is `http://localhost:3000`
- **THEN** the status report MUST NOT show the row

#### Scenario: Plain http behind a proxy

- **WHEN** neither a frontend nor the setting is configured and the status report is viewed at `http://www.example.com`
- **THEN** it MUST show a warning that names Drupal's reverse proxy settings
