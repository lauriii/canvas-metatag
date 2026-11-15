## MODIFIED Requirements

### Requirement: Made images have their own address

Every made image MUST have a path that changes when anything drawn changes,
computed only from the entity and configuration, never from the request, and
addressed through the frontend's image address (public-addresses). It MUST be
made on the first request, stored, and served with a one-year immutable cache
and no cookie; a card also with `X-Robots-Tag: noindex`. An outdated path MUST redirect, with
a root-relative location and for at most five minutes of caching, to the
current one.

#### Scenario: Renaming a page

- **WHEN** an editor renames a published page and publishes it
- **THEN** its `og:image` address MUST change, the old address MUST answer 302 to the new one, and the new image MUST show the new title

#### Scenario: A request with another host name

- **WHEN** a card address is requested with the host header `evil.example`
- **THEN** the image MUST be the same bytes as with the site's own host, and no other file MUST be stored

#### Scenario: Headers

- **WHEN** a crawler fetches a card
- **THEN** the response MUST be `image/png` with `Cache-Control: public, max-age=31536000, immutable` and `X-Robots-Tag: noindex`, with no `Set-Cookie` and no `Vary` but on `Accept-Encoding`

#### Scenario: Through the frontend

- **WHEN** the frontend's image address is `{base}{path}` and the frontend passes requests for the card's path on to Drupal
- **THEN** the card MUST be the same bytes as on Drupal's own address, and an outdated path MUST redirect to a `Location` that starts with `/`
