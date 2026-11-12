## ADDED Requirements

### Requirement: The identity and the website carry the alternate names

The identity node and the `WebSite` node MUST carry the identity's alternate
names (site-seo), in their stored order, as `alternateName`. Both nodes, with
their alternate names, MUST be on every owned page, not only on the front page.

#### Scenario: Alternate names

- **WHEN** the identity is named "Example Studio" with the alternate names "Example" and "ES"
- **THEN** the identity and the website MUST both carry `alternateName` `["Example", "ES"]`, in that order, on the front page and on every other owned page

#### Scenario: No alternate names

- **WHEN** the identity has no alternate names
- **THEN** neither node MUST carry `alternateName`

### Requirement: The front page is about the site

When the translation is the front page (front-page), its page node MUST
reference the identity as `about`. No other page node MUST.

#### Scenario: The front page

- **WHEN** the page is the front page in English and in French
- **THEN** both translations' page nodes MUST carry `about` referencing `{home}#identity`

#### Scenario: A translation that is not the front page

- **WHEN** the front page setting misses the Finnish translation of the front page (front-page)
- **THEN** the Finnish page node MUST NOT carry `about`

#### Scenario: A page staged as the homepage

- **WHEN** a page is staged as the homepage in Canvas and not yet published
- **THEN** its published page node MUST NOT carry `about`
