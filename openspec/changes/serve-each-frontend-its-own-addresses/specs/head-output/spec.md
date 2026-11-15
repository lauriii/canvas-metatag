## MODIFIED Requirements

### Requirement: The canonical link points at the public copy

The canonical link MUST be the page's override when one is set: a path is put
on its language's address in the frontend's form (public-addresses), an
absolute http(s) URL is used as stored. Without an override it MUST be the
entity's own public URL: its canonical path and alias on its language's
address. The front page, whether the setting holds its system path or its
alias, MUST be its language's front page address, with Drupal's language
prefix unless that language has its own address.

#### Scenario: A path override

- **WHEN** a page sets the canonical `/plans?ref=1`
- **THEN** the canonical link and `og:url` MUST be the public base plus `/plans?ref=1`

#### Scenario: An address on another site

- **WHEN** a page sets the canonical `https://other.example.com/x`
- **THEN** the canonical link and `og:url` MUST be that address

#### Scenario: The front page

- **WHEN** a Canvas page is the front page and has a French translation
- **THEN** its canonical MUST be the public base followed by `/`, and the French one the public base followed by `/fr`

#### Scenario: A language with its own address

- **WHEN** French has the address `https://fr.example.com` and the front page has a French translation
- **THEN** the French canonical MUST be `https://fr.example.com/`

### Requirement: Every dependency invalidates the head

Changing any of these MUST invalidate an owned page: the entity; the site
settings, name, timezone and front page; the alias the front page setting
names; URL language negotiation; the template; the type's fields and form
order; media types; the media, files and labels used; the anonymous role; the
frontends and their address settings (public-addresses). A new or changed
content template MUST invalidate node pages the module does not own.
Installing the module MUST invalidate rendered caches.

#### Scenario: A dependency changes

- **WHEN** the site settings, the page, its image media or the site name change
- **THEN** the next request MUST miss the cache and show the new value

#### Scenario: Media access is revoked

- **WHEN** the anonymous role loses the permission to view media
- **THEN** the cached page MUST be invalidated, and the head MUST have no `og:image`

#### Scenario: A configuration override

- **WHEN** `settings.php` overrides the site settings to force `noindex`
- **THEN** every owned page MUST carry `noindex`

#### Scenario: Installing the module

- **WHEN** the module is installed on a site with cached pages
- **THEN** rendered caches MUST be invalidated, so that no cached page keeps core's canonical next to the module's

#### Scenario: The form's order changes

- **WHEN** a site builder moves a person's Photo field below its Avatar field on the Person form, and both hold a public image
- **THEN** the cached person page MUST be invalidated and its `og:image` MUST become the Avatar image

#### Scenario: The front page alias moves

- **WHEN** the front page setting is `/home` and the alias `/home` is moved from page 5 to page 9 in the URL alias list, without saving either page
- **THEN** the next request for page 5 MUST carry its own canonical, and `/` MUST carry page 9's head with the canonical on the public base followed by `/`

#### Scenario: The default language loses its prefix

- **WHEN** a site administrator removes the default language's URL prefix
- **THEN** the next request MUST carry canonical and hreflang links without that prefix

#### Scenario: A frontend's address settings change

- **WHEN** an administrator gives the frontend a trailing slash
- **THEN** the next request for a cached page MUST carry its canonical with the slash, in coupled and headless output alike
