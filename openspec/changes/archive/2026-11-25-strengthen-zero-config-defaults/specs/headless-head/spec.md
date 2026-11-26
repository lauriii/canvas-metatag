## ADDED Requirements

### Requirement: The content API carries the same share images

The headless head MUST carry the same image address, type, width, height and alt text, `og:locale` rows and front page icon links as the coupled head, on Drupal's own address. A frontend MUST need no change to share made images.

#### Scenario: A page without an image

- **WHEN** a headless frontend fetches a Canvas page without an image through the content API
- **THEN** `head.meta` MUST carry the same `og:image` card address, `og:image:type`, `og:image:width`, `og:image:height` and `og:image:alt` as the coupled HTML head, and fetching that address MUST return the card

#### Scenario: A preview token

- **WHEN** a frontend fetches a draft with a preview token
- **THEN** the image address MUST NOT be a public share address made from the draft's values
