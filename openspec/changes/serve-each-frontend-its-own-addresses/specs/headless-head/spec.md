## MODIFIED Requirements

### Requirement: The content API carries the same share images

The headless head MUST carry the same image address, type, width, height and
alt text, `og:locale` rows and front page icon links as the coupled head built
for the same frontend (public-addresses). Without an image address, a frontend
MUST need no change to share made images. A draft head MUST NOT name the
editor's share preview: an image made from the draft MUST be left out.

#### Scenario: A page without an image

- **WHEN** a headless frontend fetches a Canvas page without an image through the content API
- **THEN** `head.meta` MUST carry the same `og:image` card address, `og:image:type`, `og:image:width`, `og:image:height` and `og:image:alt` as the coupled HTML head, and fetching that address MUST return the card

#### Scenario: A preview token

- **WHEN** a frontend fetches a draft with a preview token
- **THEN** the image address MUST NOT be a public share address made from the draft's values, nor the editor's share preview, and a draft whose card would show a new title MUST carry no `og:image`

#### Scenario: Through the frontend

- **WHEN** the frontend's image address is `{base}{path}` and it fetches a Canvas page without an image
- **THEN** `og:image` MUST be the card's path on the frontend's address, and the coupled head built for that frontend MUST carry the same address

## REMOVED Requirements

### Requirement: Addresses use the public base

**Reason**: Addresses are built for the frontend that renders the response,
not for one public base, and images are no longer pinned to Drupal's host.
The rules apply to coupled and headless output alike, so they move to their
own capability.

**Migration**: See public-addresses, "Each head is built for one frontend",
"Page addresses follow the frontend's form" and "Image addresses go through
the frontend's image address". One frontend and no address settings give the
same addresses as before.

### Requirement: The public base has three sources

**Reason**: "The first frontend" is only the default now. A content API request
selects its own frontend, and the request's address is no longer used while a
frontend is configured, nor ever for content API output.

**Migration**: See public-addresses, "A frontend names itself in the content
API address" and "The settings file moves the default frontend per
environment". `canvas_metatag_public_base` keeps its meaning for the default
frontend. With two or more frontends, each must name itself.

### Requirement: The public base is part of the cacheability

**Reason**: The cacheability now covers the selected frontend and the address
settings too.

**Migration**: See public-addresses, "Addresses are part of the cacheability"
and "One frontend's head never serves another".

### Requirement: Page addresses on a host no visitor reaches are left out

**Reason**: complete-the-headless-frontend left these addresses out early, for
the single public base. The rule now applies to every frontend's addresses.

**Migration**: See public-addresses, "An address that can't be known is left
out". The same hosts are left out, with the same development-host rule.

### Requirement: The status report flags a public base no visitor can use

**Reason**: complete-the-headless-frontend added this row early, for the
single public base. The full guardrail replaces it.

**Migration**: See public-addresses, "The status report refuses addresses no
visitor can use" and "The status report warns about risky addresses". The row
keeps its title, "SEO public addresses", and its helpers.
