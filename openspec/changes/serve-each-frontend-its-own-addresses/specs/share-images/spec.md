## MODIFIED Requirements

### Requirement: Made images have their own address

Every made image MUST have a path whose name (a hash) changes with anything
drawn, never depending on the request, and addressed through the frontend's
image address (public-addresses). It MUST be made on first request, stored at
no files path one can work out, and served only at its address with a
one-year immutable cache (a day at most in shared caches) and no cookie; a
card also with `X-Robots-Tag: noindex`. An outdated path MUST redirect,
root-relative and never cached, to the current one.

#### Scenario: Renaming a page

- **WHEN** an editor renames a published page and publishes it
- **THEN** its `og:image` address MUST change, the old address MUST answer 302 to the new one, and the new image MUST show the new title

#### Scenario: A request with another host name

- **WHEN** a card address is requested with the host header `evil.example`
- **THEN** the image MUST be the same bytes as with the site's own host, and no other file MUST be stored

#### Scenario: Headers

- **WHEN** a crawler fetches a card
- **THEN** the response MUST be `image/png` with the Cache-Control directives `public`, `max-age=31536000`, `s-maxage=86400` and `immutable`, and `X-Robots-Tag: noindex`, with no `Set-Cookie` and no `Vary` but on `Accept-Encoding`

#### Scenario: The files path

- **WHEN** the files path that mirrors a stored card's address (`/sites/default/files/canvas-metatag/share/…`) is requested, on any web server
- **THEN** the answer MUST be 404: a card is never served without `noindex`

#### Scenario: Through the frontend

- **WHEN** the frontend's image address is `{base}{path}` and the frontend passes requests for the card's path on to Drupal
- **THEN** the card MUST be the same bytes as on Drupal's own address, and an outdated path MUST redirect to a `Location` that starts with `/`
