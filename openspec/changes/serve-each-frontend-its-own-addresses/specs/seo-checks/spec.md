## ADDED Requirements

### Requirement: Development addresses are to fix for those who can fix them

When the page's address for the frontend being previewed is plain http or on a
non-public host (public-addresses), users who may administer SEO site settings
MUST see "Visitors would get the address of a development site" to fix, naming
the address, unless Drupal's own host is a development host (public-addresses,
"The status report refuses addresses no visitor can use"). Others MUST NOT see
it.

#### Scenario: A local frontend in production

- **WHEN** a site administrator opens the dialog at `https://cms.example.com` and the frontend Canvas previews with is `http://localhost:3000`
- **THEN** the row MUST be listed to fix, naming `http://localhost:3000`

#### Scenario: A private CMS

- **WHEN** the same administrator opens the dialog at `http://cms.internal`
- **THEN** the row MUST be listed to fix

#### Scenario: An editor

- **WHEN** an editor without the site settings permission opens the same page
- **THEN** the row MUST NOT be listed

#### Scenario: A development site

- **WHEN** the dialog is opened at `https://cms.example.test`
- **THEN** the row MUST NOT be listed

### Requirement: Typed addresses on Drupal's or a preview host are flagged

While a frontend is configured, a typed canonical on one of Drupal's hosts or
on a frontend's preview address MUST be listed to fix, as "Search engines are
sent to an address visitors don't use". A typed link value, structured data
address or profile on one of them MUST be listed to improve. Drupal's hosts
are the host the editor uses and the language domains. Every user who may edit
a page's SEO MUST get these rows.

#### Scenario: A canonical on the CMS

- **WHEN** the editor uses `https://cms.example.com` and a page sets the canonical `https://cms.example.com/plans`
- **THEN** the row MUST be listed to fix, leading to the canonical field

#### Scenario: A link on a preview deployment

- **WHEN** an editor without site settings permissions edits a page whose hand-added item's `url` is `https://feat-42.preview.example.com/plans`, and `https://*.preview.example.com` is a preview address
- **THEN** the row MUST be listed to improve

#### Scenario: A coupled site

- **WHEN** no frontend is configured and a page sets the canonical `https://cms.example.com/plans`
- **THEN** the row MUST NOT be listed

### Requirement: The shared image is checked at its public address

The dialog MUST load the published `og:image` address built for the frontend
being previewed. When it loads at another size than the head declares, Checks
MUST list "The shared image's address gives another size" to fix. When it
doesn't load, Checks MUST list "The shared image's address didn't open from
your browser" as good to know. The link preview MUST NOT wait for it.

#### Scenario: An optimizer that resizes

- **WHEN** the image address is `{base}/_img{path}?w=640` and the head declares `og:image:width` 1200
- **THEN** the row MUST be listed to fix

#### Scenario: A frontend the editor can't reach

- **WHEN** the image address is on a host the editor's browser can't reach
- **THEN** the row MUST be good to know, and the link preview MUST still show the image
