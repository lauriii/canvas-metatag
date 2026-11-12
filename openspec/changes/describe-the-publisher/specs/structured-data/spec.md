## MODIFIED Requirements

### Requirement: The site nodes describe the identity

The identity node MUST be an `Organization`, a `Person` when the site
identity is a person, or the chosen local business type, with the identity
name (else the site name), the identity's alternate names in their stored
order as `alternateName`, the home address, the profile addresses as
`sameAs`, and the description, email, telephone, legal name, postal address
and opening hours when set. When the site logo resolves for anonymous
visitors, an `ImageObject` logo node MUST be added and referenced as `logo`
(as `image` for a person). The `WebSite` node MUST carry the home address,
the site name (else the identity name), the same alternate names, the page
language and the identity as `publisher`. Both nodes MUST be on every owned
page.

#### Scenario: A person runs the site

- **WHEN** the identity is a person with a logo
- **THEN** the identity node MUST be a `Person` whose `image` references `{home}#logo`

#### Scenario: A logo visitors cannot see

- **WHEN** the logo media is unpublished
- **THEN** the graph MUST have no logo node, and the identity MUST have no `logo`

#### Scenario: Alternate names

- **WHEN** the identity is named "Humanify Studio" with the alternate names "Humanify" and "HS"
- **THEN** the identity and the website MUST both carry `alternateName` `["Humanify", "HS"]`, in that order, on the front page and on every other owned page

#### Scenario: No alternate names

- **WHEN** the identity has no alternate names
- **THEN** neither node MUST carry `alternateName`

#### Scenario: A local business

- **WHEN** the identity is a Store with an address in Helsinki and opening hours Monday to Friday 9 to 17
- **THEN** the identity node's `@type` MUST be `Store` with a `PostalAddress` and an `openingHoursSpecification` for those days

#### Scenario: A site name apart from the organization's

- **WHEN** the identity is "Humanify Example Ventures Inc." and the site name is "Humanify Studio"
- **THEN** the `WebSite` node's `name` MUST be "Humanify Studio" and the identity's "Humanify Example Ventures Inc."
