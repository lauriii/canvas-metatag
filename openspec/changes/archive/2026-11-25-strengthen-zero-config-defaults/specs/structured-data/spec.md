## MODIFIED Requirements

### Requirement: The page node describes the page

The page node MUST have the type's page type (`WebPage` by default), the entity's URL, its label as `name`, the head's description, the language (none when language-neutral), `isPartOf` the website, and the First published and Last updated facts. `primaryImageOfPage` MUST only be the page's own image, as the original file at its upright size with its alt text as `caption`; never the site's image or a made image. `mainEntity` MUST reference the main node only when it is in the graph.

#### Scenario: An about page

- **WHEN** the type is About page
- **THEN** the page node's `@type` MUST be `AboutPage`, and there MUST be no main node

#### Scenario: A translation

- **WHEN** a French translation is resolved
- **THEN** the page node's `inLanguage` MUST be `fr`

#### Scenario: A page that shares a card

- **WHEN** a page without an image shares a card made from its title
- **THEN** its page node MUST have no `primaryImageOfPage`

#### Scenario: A page that shares the site's image

- **WHEN** a page without an image shares the site's chosen image
- **THEN** its page node MUST have no `primaryImageOfPage`

#### Scenario: A phone photo

- **WHEN** a page's image is a 3000 × 4000 portrait stored sideways with an EXIF orientation of 6
- **THEN** `primaryImageOfPage` MUST be the original file with width 3000 and height 4000
