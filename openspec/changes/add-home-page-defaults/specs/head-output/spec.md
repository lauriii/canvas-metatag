## MODIFIED Requirements

### Requirement: Hreflang links list published translations

When an entity has two or more published translations, the head MUST carry one
`alternate` link per published translation, on its own public URL, plus
`x-default` pointing at the translation in the site's default language when it
is published, else at the original translation when it is published, else at
none. Every translation MUST carry the same set. With one published
translation there MUST be no alternate links, except between separate front
pages per language.

#### Scenario: An unpublished translation

- **WHEN** a page has English and French published and German unpublished
- **THEN** the alternates MUST be `en`, `fr` and `x-default`, on both translations

#### Scenario: Only one language left

- **WHEN** the French translation is unpublished
- **THEN** the page MUST have the canonical link only

#### Scenario: A page created in another language

- **WHEN** the site's default language is English and a page was created in Finnish and translated into English, both published
- **THEN** `x-default` MUST point at the English translation

### Requirement: Every dependency invalidates the head

Changing any of these MUST invalidate an owned page: the entity, the site
settings, the site name, timezone and front page, the alias the front page
setting names, URL language negotiation, the template, the content type's
fields, the order of its form and the media types, the media, files and labels
used, the anonymous role, and the public base (headless-head). A node page the
module does not own MUST be invalidated when a content template is added or
changed. Installing the module MUST invalidate rendered caches.

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

## ADDED Requirements

### Requirement: The front page is the public base only where it is the front page

A translation of the front page MUST have the public base, with its language
prefix, as its canonical only in a language where it is the front page
(front-page). In a language where it is not, its canonical MUST be its own
public URL, so that a canonical never names an address that does not open.

#### Scenario: The front page

- **WHEN** a Canvas page is the front page and has a French translation
- **THEN** its canonical MUST be the public base followed by `/`, and the French one the public base followed by `/fr`

#### Scenario: A language the front page setting misses

- **WHEN** the front page setting is page 5's English alias `/home` and page 5's Finnish translation has the alias `/fi/koti`
- **THEN** the Finnish canonical MUST be the public base followed by `/fi/koti`, never `/fi`

### Requirement: No address carries the script name

No address the module emits (the canonical link, `og:url`, the hreflang links
and every structured data `@id`) MUST carry the script name of the request.

#### Scenario: A request through index.php

- **WHEN** a visitor requests `/index.php` or `/index.php/about`, with the public base from the request or from the setting
- **THEN** the canonical link, `og:url`, the hreflang links and every structured data `@id` MUST be the same as for `/` or `/about`, without `index.php`

### Requirement: Separate front pages per language are alternates

When the front page is a different entity per language (front-page), each of
those front pages MUST carry, instead of its own translations, one `alternate`
link per language whose front page is published, on the public base with that
language's prefix, plus `x-default` on the front page of the site's default
language.

#### Scenario: A front page per language

- **WHEN** page 5 is the English front page and page 9 the Finnish one, each published with one translation
- **THEN** both MUST carry the alternates `en` on the public base followed by `/`, `fi` on the public base followed by `/fi`, and `x-default` on the English one

### Requirement: Metatag's front page defaults count on the front page

When the owned translation is the front page in its language (front-page), the
Metatag layer of other tags MUST also read Metatag's front page defaults,
which win over its global defaults there. No other owned page MUST get them.

#### Scenario: Metatag's front page defaults

- **WHEN** Metatag's front page defaults hold a verification tag and the front page is an owned Canvas page
- **THEN** the front page MUST carry that tag in both deliveries, no other owned page MUST carry it, and changing the front page defaults MUST change the next request for the cached front page

### Requirement: A paged listing keeps its page in the canonical

When the component tree of a page, or of the template that renders a node,
contains a listing with a pager, the canonical link and `og:url` MUST keep the
request's `page` parameter, normalised: only digits and commas accepted, a
first page left out. On every other page, and for every other parameter, the
canonical MUST stay the entity's own URL.

#### Scenario: Page two of a listing

- **WHEN** the front page holds a listing with a pager and a visitor requests `/?page=2&utm_source=x`
- **THEN** the canonical MUST be the public base followed by `/?page=2`

#### Scenario: The first page

- **WHEN** a visitor requests `/?page=0` or `/?page=0,0` on that page
- **THEN** the canonical MUST be the public base followed by `/`

#### Scenario: A page without a pager

- **WHEN** a visitor requests `/about?page=7` and the About page holds no listing with a pager
- **THEN** the canonical MUST be the public base followed by `/about`

#### Scenario: A malformed value

- **WHEN** a visitor requests `/?page=abc` on a page with a pager
- **THEN** the canonical MUST be the public base followed by `/`

#### Scenario: Cached per page

- **WHEN** `/?page=1` and `/?page=2` of a paged front page are requested in turn
- **THEN** each response MUST carry its own canonical, and the second request of each MUST be a cache hit

### Requirement: A vaguely named front page is titled by the site

When the owned front page's title main part is its Title fact alone, by default or linked, and its name is empty, the Site name, an alternate name or a vague word in its language, its title MUST be the Site name, followed by the separator and Drupal's slogan when one is set, and its `og:title` MUST be the same unless a social title is set. A composed main part and a front page with a real name MUST keep the usual title.

#### Scenario: A front page named Home

- **WHEN** the English front page is named "Home", the site is named "Humanify Studio" and Drupal has no slogan
- **THEN** its title and its `og:title` MUST both be "Humanify Studio"

#### Scenario: A slogan

- **WHEN** the same front page's site has the slogan "Human expertise for AI-made work"
- **THEN** its title and `og:title` MUST be "Humanify Studio | Human expertise for AI-made work"

#### Scenario: A real name

- **WHEN** the front page is named "Industrial pumps for breweries"
- **THEN** its title MUST be "Industrial pumps for breweries | Humanify Studio"

#### Scenario: A node home page linked to its title

- **WHEN** the front page is the event "Home", whose template links the title's main part to the Title fact
- **THEN** its title MUST be "Humanify Studio", as with no title of its own

#### Scenario: A node home page with a composed title

- **WHEN** the front page is the event "Home" in Helsinki, whose template's main part is Title, " in ", Venue › City
- **THEN** its title MUST be "Home in Helsinki | Humanify Studio", and "Say what the site offers" MUST still judge that resolved text

### Requirement: A vaguely named front page shares the site card

When the image chain of a front page titled by the site ends at a card, the card MUST be the site card (share-images), not a card of the page's name.

#### Scenario: Shared in a chat app

- **WHEN** the front page named "Home" has no image and is shared in a chat app on a site with a logo
- **THEN** the preview MUST show a 1200 × 630 image with the logo and "Humanify Studio", and no "Home"
