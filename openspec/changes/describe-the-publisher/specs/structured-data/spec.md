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

## ADDED Requirements

### Requirement: The identity's logo falls back to the theme's logo

When the identity has no logo, the logo node MUST use the default theme's own logo when it is not core's default and is a public file or a file inside that theme's folder, at its absolute public address. The same logo MUST sign the share images (share-images).

#### Scenario: A theme logo

- **WHEN** the identity has no logo and the default theme has its own logo file
- **THEN** the identity MUST reference `{home}#logo`, whose `url` is that file's absolute address

#### Scenario: Core's logo

- **WHEN** the identity has no logo and the theme uses core's default logo
- **THEN** the graph MUST have no logo node

### Requirement: Drupal's slogan is the organization's slogan

When Drupal's site slogan is set, the identity node MUST carry it as `slogan`, in the page's language. It MUST NOT be used as a description.

#### Scenario: A slogan

- **WHEN** Drupal's slogan is "Human expertise for AI-made work"
- **THEN** the identity node MUST carry `slogan` "Human expertise for AI-made work" and its `description` MUST NOT be the slogan

### Requirement: A workplace at the publisher's address is a place

A job whose workplace is the publisher's address MUST emit an inline `Place` whose `address` is the identity's address. That choice MUST be offered only while the identity's address has a street or city and a country, and a job location MUST never reference the identity node itself. (Handed over by `populate-every-schema-type`, H2.)

#### Scenario: At our address

- **WHEN** a job's workplace is the publisher's address and the identity is at Mill Road 4, Tampere, Finland
- **THEN** `jobLocation` MUST be `{"@type": "Place", "address": {"@type": "PostalAddress", …, "addressCountry": "FI"}}`

### Requirement: A profile about the publisher is the publisher

A reference to a profile page that is about the publisher (its person is the identity) MUST be the identity, `{"@id": "{home}#identity"}`, never the profile's own main node. (Handed over by `populate-every-schema-type`, H2.)

#### Scenario: The founder's own site

- **WHEN** a recipe's author links to a profile page about the publisher, a person
- **THEN** that author MUST be `{"@id": "{home}#identity"}`
