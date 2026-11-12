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
