## MODIFIED Requirements

### Requirement: Every dependency invalidates the head

A change to any of these MUST invalidate an owned page: the entity, the site
settings, the site name, timezone and front page, the template, the content
type's fields, the order of its form and the media types, the media, files and
labels used, the anonymous role, and the public base (headless-head). A node
page the module does not own MUST be invalidated when a content template is
added or changed. Installing the module MUST invalidate rendered caches.

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

## ADDED Requirements

### Requirement: A cut never breaks a character

A text cut to its limit MUST NOT end inside a character that is drawn as one:
an emoji sequence, a flag, or a letter with its marks. Such a character MUST be
left out whole. The limit MUST stay a number of code points.

#### Scenario: An emoji sequence at the limit

- **WHEN** a title is 254 code points of text without spaces followed by a five-code-point emoji sequence
- **THEN** the title MUST be the 254 code points of text without any part of the sequence

#### Scenario: A flag at the limit

- **WHEN** the 1000th code point of a description of 1200 code points is the first half of a flag
- **THEN** the description MUST end before the flag

#### Scenario: A content's description cut from its text

- **WHEN** a content's formatted text has no summary and an emoji sequence spans its 160th code point
- **THEN** `{description}` MUST end before the sequence

### Requirement: A cut head text ends at a word

The title, the description and the social texts MUST be cut at the last space
within the limit when the cut would fall inside a word and that space is
within the last tenth of the limit. A separator left at the end of a title by
the cut MUST be removed with the space before it.

#### Scenario: A very long event title

- **WHEN** the template's title is `{title} {sep} Events` and an event's title is 247 characters ending in "first performed"
- **THEN** the event's title MUST end with "first performed", with no separator and no part of "Events"

#### Scenario: A text without spaces

- **WHEN** a title is 300 characters of text written without spaces
- **THEN** the title MUST be cut at 255 code points, never inside a character that is drawn as one
