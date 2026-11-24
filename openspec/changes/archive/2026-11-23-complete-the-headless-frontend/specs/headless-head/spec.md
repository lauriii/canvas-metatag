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
non-public host (see "Hosts no visitor reaches"), and Drupal's own host is
not a development host, the head MUST carry no canonical, `og:url`, hreflang
or JSON-LD script, in coupled and headless output alike, and the dialog's
report MUST carry `unaddressed`.

#### Scenario: A development frontend in production

- **WHEN** a page is fetched through the content API at `https://cms.example.com`, no public base is set, and the first frontend is `http://localhost:3000`
- **THEN** its head MUST carry no canonical, `og:url`, hreflang or JSON-LD script, and MUST keep its title, description and `og:image`

#### Scenario: A development site

- **WHEN** the same page is fetched at `https://cms.example.test`
- **THEN** its canonical MUST be on `http://localhost:3000`

#### Scenario: Plain http on a public host

- **WHEN** the first frontend is `http://www.example.com` and the page is fetched at `https://cms.example.com`
- **THEN** its canonical MUST be on `http://www.example.com`

### Requirement: Hosts no visitor reaches

A host is non-public when it is a loopback, private, shared or link-local IP
in any spelling a browser reads, a single-label host, a name whose last label
is a number, or a host under `localhost`, `local`, `test`, `example`,
`internal`, `invalid`, `home.arpa` or a known local development suffix.
Nothing MUST be looked up.

#### Scenario: Spellings a browser reads

- **WHEN** a host is `127.1`, `2130706433`, `0177.0.0.1`, `0x7f000001` or `[::ffff:127.0.0.1]`
- **THEN** it MUST be non-public and a development host, as `127.0.0.1` is; `0.0.0.0` and `[::]`, where development servers listen, MUST be too

#### Scenario: Another spelling of a loopback address

- **WHEN** `canvas_metatag_public_base` is `http://127.1:3000`, `http://[::ffff:127.0.0.1]:3000` or `http://0177.0.0.1:3000` and the page is fetched at `https://cms.example.com`
- **THEN** its head MUST carry no canonical, as for `http://localhost:3000`, and the status report MUST show the error naming that address

#### Scenario: A frontend Canvas refuses

- **WHEN** the first frontend is `http://127.1:3000` or `http://[::ffff:127.0.0.1]:3000`, which Canvas does not accept as a frontend, and the page is fetched at `https://cms.example.com`
- **THEN** its addresses MUST be on `https://cms.example.com`, the request's, and the status report MUST NOT show the row

#### Scenario: A known local development suffix in production

- **WHEN** the first frontend is `https://front.ddev.site` and the page is fetched at `https://cms.example.com`
- **THEN** its head MUST carry no canonical, and the status report MUST show the error

#### Scenario: A name under .local

- **WHEN** the first frontend is `https://mysite.local` and the page is fetched at `https://cms.example.com`
- **THEN** its head MUST carry no canonical

### Requirement: Development hosts

A development host is a loopback or unspecified address in any spelling,
`localhost`, a host under `localhost`, `test` or `invalid`, or one under a
known local development suffix. Nothing MUST be looked up. Every other host,
a private address or an internal name included, MUST count as
production-like.

#### Scenario: Drupal on an internal name

- **WHEN** Drupal is reached at `https://cms.internal` and the first frontend is `http://localhost:3000`
- **THEN** the head MUST carry no canonical: an internal name is production-like, not a development host

#### Scenario: Drupal on a development host

- **WHEN** the same page is fetched at `https://cms.example.test`, or at a host under a known local development suffix
- **THEN** its canonical MUST be on `http://localhost:3000`

### Requirement: The status report flags a public base no visitor can use

The status report MUST show "SEO public addresses" as an error when the public
base comes from the setting or a frontend and is plain http or on a non-public
host: a warning while Drupal's own host is a development host, and absent when
the base is on a development host too. A base from the request that is plain
http on a public host MUST be a warning on a production-like Drupal host. Each
message MUST name the address, what is wrong with it, and its fix.

#### Scenario: A development frontend in production

- **WHEN** the status report is viewed at `https://cms.example.com`, no public base is set, and the first frontend is `http://localhost:3000`
- **THEN** it MUST show an error naming `http://localhost:3000` and the `canvas_metatag_public_base` setting

#### Scenario: A local frontend on a development site

- **WHEN** the same configuration is viewed at `https://cms.example.test`
- **THEN** the status report MUST NOT show the row

#### Scenario: A plain http frontend on a known local suffix

- **WHEN** the first frontend is plain http under a known local development suffix and the status report is viewed at `https://cms.example.test`
- **THEN** the status report MUST NOT show the row

#### Scenario: A plain http frontend in production

- **WHEN** the first frontend is `http://www.example.com` and the status report is viewed at `https://cms.example.com`
- **THEN** it MUST show an error naming `http://www.example.com`, saying it is not https, and naming the `canvas_metatag_public_base` setting

#### Scenario: A plain http frontend on a development site

- **WHEN** the first frontend is `http://www.example.com` and the status report is viewed at `https://cms.example.test`
- **THEN** it MUST show a warning, not an error

#### Scenario: A public base set for the environment

- **WHEN** the setting is `https://www.example.com` and the first frontend is `http://localhost:3000`
- **THEN** the status report MUST NOT show the row

#### Scenario: Plain http behind a proxy

- **WHEN** neither a frontend nor the setting is configured and the status report is viewed at `http://www.example.com`
- **THEN** it MUST show a warning that names Drupal's reverse proxy settings

### Requirement: A public base setting that is not an address is reported

A `canvas_metatag_public_base` that is not an absolute http or https address
without a query or fragment is ignored. The status report row "SEO public
addresses" MUST then name its value and the address pages use instead: an
error, a warning while Drupal's own host is a development host.

#### Scenario: A setting that is not an address

- **WHEN** the setting is `www.example.com`, the first frontend is `http://localhost:3000`, and the status report is viewed at `https://cms.example.com`
- **THEN** it MUST show an error naming `www.example.com`, saying it is not an absolute http or https address and that pages use `http://localhost:3000`
