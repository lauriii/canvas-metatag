## ADDED Requirements

### Requirement: The publisher reads back in one sentence

Site MUST open with a "Publisher" stage: one sentence built from the identity
nodes that ship, then verdict lines for the site name, the logo when the
identity is an organization, and business details when it is a local
business with an address.

#### Scenario: An organization with profiles

- **WHEN** the identity is the organization Humanify Studio with an email and two profiles
- **THEN** the stage MUST read "Humanify Studio, an organization that people can email at ‹email›, the same as its profiles on two networks." with "Site name" and "Logo" lines

#### Scenario: A person

- **WHEN** the identity is a person
- **THEN** no logo line MUST be shown

### Requirement: The identity holds contact details, an address and hours

The identity MAY hold a site name for the website (default the identity
name), a description, an email, a telephone, a postal address, opening hours
and a subtype: organization, local business, or one of the local business
kinds the module lists. Each MUST be the same in every language.

#### Scenario: A local shop

- **WHEN** an administrator sets the subtype "Store", an address and opening hours
- **THEN** they MUST be stored and the stage MUST show a "Business details" line

#### Scenario: An address without a country

- **WHEN** a save sends an address with a street but no country
- **THEN** it MUST be refused with a message naming the country

### Requirement: Profiles and email can follow the site's components

Profiles and email MAY follow a link prop of a component in a page region or,
when none is there, on the front page. Profiles MUST follow only the links
ticked as profiles; links on the site's own domain and `mailto:` links MUST
NOT be offered as profiles; email MUST follow a `mailto:` link.

#### Scenario: Footer links

- **WHEN** the footer links to two network profiles, a partner agency and `/privacy`, and the administrator links Profiles to it
- **THEN** the two profiles MUST be ticked, the partner unticked, `/privacy` not offered, and only the ticked links MUST be emitted as `sameAs`

#### Scenario: A footer edit

- **WHEN** an editor changes a profile link in the footer and publishes the front page
- **THEN** the identity's `sameAs` MUST carry the new link

### Requirement: The legal name is proposed, never applied

When a copyright line on the front page or in a region names a legal entity
and the identity has no legal name, Site MUST propose it with "Use it", and
MUST NOT store it until the administrator uses it.

#### Scenario: A copyright line

- **WHEN** the footer says "© 2025–2026 Humanify Example Ventures Inc."
- **THEN** the Legal name field MUST show "The footer says “Humanify Example Ventures Inc.”" with "Use it"
