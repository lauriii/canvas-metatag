## Purpose

Let a site builder add the head tags the dialog has no control for, as plain
`meta` and `link` rows at site, content type and page scope, without ever
storing markup, and without a row being able to contradict, hide or break what
the module emits.

## ADDED Requirements

### Requirement: Other tags are meta and link rows

A row MUST be either a meta tag with a `name` or a `property` and its content,
or a link with a relation and an address. Rows MUST be stored as data, never as
markup. The site, a content type and a Canvas page MAY each hold up to 20 rows,
with at most 10 rows for the same key. A row MUST be emitted with no attribute
other than these, and a link to a feed with its type.

#### Scenario: A meta row on the site

- **WHEN** an administrator saves the site row `dcterms.rights` with "© Example Co"
- **THEN** every owned page MUST carry `<meta name="dcterms.rights" content="© Example Co">` after the module's own meta tags

#### Scenario: A twenty-first row

- **WHEN** a page write holds 21 rows
- **THEN** the system MUST refuse `tags` with "Use at most 20 tags here. Remove one first." and store none of them

#### Scenario: An eleventh row with the same key

- **WHEN** a content type write holds eleven rows named `article:tag`
- **THEN** the system MUST refuse the eleventh with "Use at most 10 article:tag tags."

### Requirement: A key is a short name of plain characters

A key MUST start with a letter and consist of at most 64 ASCII letters, digits,
`:`, `.`, `_` and `-`. Keys MUST be compared without regard to case, and a meta
`name` and a meta `property` with the same key MUST count as the same key.

#### Scenario: A key with a space

- **WHEN** a row's key is `my tag`
- **THEN** the system MUST refuse it with "Use letters, digits and : . _ - only, starting with a letter."

#### Scenario: A look-alike letter

- **WHEN** a row's key is `description` written with a Cyrillic "е"
- **THEN** the system MUST refuse it as an invalid name, and the head MUST NOT carry it

### Requirement: Keys the module sets are refused with a pointer

A row MUST NOT use a key the module emits from its own settings: the title,
description, robots, the Open Graph and article keys and card keys it emits,
the article expiration time, a verification name, or the canonical link. The refusal MUST name the control that sets the key.
At page and content type scope a verification name MUST be refused as belonging
to the whole site.

#### Scenario: The social image as a row

- **WHEN** a row's key is `og:image`, as a name or as a property
- **THEN** the system MUST refuse it with "og:image is set in Social › Image."

#### Scenario: A canonical link

- **WHEN** a row is a link with the relation `canonical`
- **THEN** the system MUST refuse it with "The canonical address is set in Search › Advanced."

#### Scenario: A verification code on a page

- **WHEN** a page row uses one of the verification names
- **THEN** the system MUST refuse it with "Verification codes belong to the whole site."

### Requirement: Dangerous and misplaced tags are refused with a reason

A row MUST NOT act like an HTTP header, combine with robots for one crawler,
duplicate what the theme sets, change how browsers send addresses, reveal the
site's software, set the language, or publish personal data. The tag policy
lists those keys. Each refusal MUST be one sentence that says why.

#### Scenario: A redirect

- **WHEN** a row's key is `refresh`
- **THEN** the system MUST refuse it with "Not allowed: it acts like a server header and can redirect visitors."

#### Scenario: Robots rules for one crawler

- **WHEN** a row's key is one of the crawler names in the tag policy
- **THEN** the system MUST refuse it with "Not allowed: it combines with Show in search results and could hide the page. Use the settings in Search."

#### Scenario: A theme tag

- **WHEN** a row's key is `viewport` or `color-scheme`
- **THEN** the system MUST refuse it with "Set by the theme."

#### Scenario: Personal data

- **WHEN** a row's key is `og:email`
- **THEN** the system MUST refuse it with "Not allowed: personal data does not belong in the page head."

#### Scenario: A harmless obsolete key

- **WHEN** a row's key is `keywords`
- **THEN** the row MUST be accepted and emitted

### Requirement: Links have four relations

A link row's relation MUST be `me`, `author`, `license`, or `alternate` with a
feed type: RSS, Atom or JSON Feed. Its address MUST be an absolute http(s)
address with a host and no credentials, of at most 2048 characters, or a path
from `/`, which is put on the public base (headless-head).

#### Scenario: A stylesheet

- **WHEN** a row is a link with the relation `stylesheet`
- **THEN** the system MUST refuse it with "Only profile, author, license and feed links can be added."

#### Scenario: A feed path

- **WHEN** a content type row is an RSS `alternate` link to `/journal/feed.xml`
- **THEN** each node's head MUST carry a link with that relation, the type `application/rss+xml` and the public base followed by `/journal/feed.xml`

#### Scenario: A language link

- **WHEN** a pasted link carries `hreflang`
- **THEN** the dialog MUST NOT add it, and say "Language links come from the page's translations."

### Requirement: Values never carry a script address

A meta row's content MUST be plain text of at most 1000 characters. Content
whose scheme, after removing whitespace and control characters and ignoring
case, is `javascript`, `vbscript`, `data` or `file` MUST be refused on write
and left out on output. Other schemes MUST be accepted, so that app links work.

#### Scenario: A hidden script scheme

- **WHEN** a row's content is "JaVa", a tab character, then "Script:alert(1)"
- **THEN** the system MUST refuse it with "Addresses starting with javascript: are not allowed."

#### Scenario: An app address

- **WHEN** a row's content is `example://open/pricing`
- **THEN** the row MUST be accepted and emitted as typed

### Requirement: Stored rows are cleaned again on output

Rows that reach storage without the dialog (configuration import, JSON:API,
custom code) MUST pass the same rules when the head is built. A row that does
not MUST be left out without an error.

#### Scenario: A refused key written through JSON:API

- **WHEN** a page's stored value holds a row named `referrer`
- **THEN** the page's head MUST NOT carry a `referrer` meta tag, and the page MUST be served

### Requirement: The nearest scope wins per key

Rows MUST layer in this order: the Metatag module's, the site's, then the
page's or the content type's. For each key, the nearest layer that has rows for
it MUST win with all its rows. A page or a content type MAY turn an inherited
key off, which MUST remove it. Rows MUST keep their stored order.

#### Scenario: Turning a site tag off on one page

- **WHEN** the site sets `dcterms.rights` and a page turns `dcterms.rights` off
- **THEN** that page MUST NOT carry `dcterms.rights`, and other pages MUST

#### Scenario: Repeated rows are replaced as a whole

- **WHEN** the site has two `me` links and a page has one `me` link of its own
- **THEN** the page MUST carry its own `me` link only

#### Scenario: Turning a key off at the site

- **WHEN** a site save holds a row that turns a key off
- **THEN** the system MUST refuse it with "This setting is not available here."

### Requirement: A content type's rows can follow a field

At content type scope a row's content or address MAY be typed or linked to a
source (value-links). A linked row that is empty, hidden from visitors or
broken for a node MUST be left out for that node. At page and site scope rows MUST be typed.

#### Scenario: A handle per article

- **WHEN** "Every Article" has a `fediverse:creator` row linked to Writer › Handle
- **THEN** each article MUST carry its writer's handle, and an article whose writer has no handle MUST carry no `fediverse:creator`

#### Scenario: A link sent for a page row

- **WHEN** a page row's content is linked to a field
- **THEN** the system MUST refuse it

### Requirement: The policy is the same in the dialog and on the server

The rules of this capability MUST be one policy that the server applies on
write and on output, and that the dialog receives in its state, so that the
dialog shows the server's sentence before anything is sent.

#### Scenario: Typing a refused key

- **WHEN** an editor types `og:title` as a row's key and leaves the field
- **THEN** the dialog MUST show "og:title is set in Social › Title." without a request to the server
