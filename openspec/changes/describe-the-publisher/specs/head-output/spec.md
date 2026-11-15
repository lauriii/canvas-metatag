## ADDED Requirements

### Requirement: A linked identity invalidates heads only when it changes

When an identity value follows a component on the front page, heads MUST
depend on the identity's value, not on the front page itself: publishing the
front page MUST invalidate other pages' heads only when the identity's value
changed.

#### Scenario: A front page edit that does not touch the footer

- **WHEN** an editor publishes a new hero text on the front page
- **THEN** the cached head of `/pricing` MUST still be served from cache

#### Scenario: A footer profile changes

- **WHEN** an editor changes a profile link in the footer and publishes the front page
- **THEN** the cached head of `/pricing` MUST be invalidated and carry the new link

### Requirement: The front page falls back to the site's description

When the owned front page has no description of its own, its description MUST be the identity description, cut like any derived description. The slogan MUST NOT be used as a description, and no other page MUST get the identity description.

#### Scenario: An identity description

- **WHEN** the front page has no description and the identity description is "Human expertise that amplifies what your AI agents can do."
- **THEN** its meta description and `og:description` MUST be that sentence, and the About page's MUST NOT

#### Scenario: Only a slogan

- **WHEN** the front page has no description, the identity has none, and Drupal has a slogan
- **THEN** the front page MUST have no meta description
