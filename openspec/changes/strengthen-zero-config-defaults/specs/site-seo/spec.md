## MODIFIED Requirements

### Requirement: Installed defaults

Installing the module MUST store no title ending (so the ending is the Site name), `max_image_preview` large, the kind organization, the separator `|`, an empty name, no images or profiles, no colour, and a card made from the title for pages without an image.

#### Scenario: A fresh install

- **WHEN** the module is installed
- **THEN** a page titled "Pricing" on a site named "Example" MUST have the title "Pricing | Example", robots `max-image-preview:large`, and an `og:image` that is a 1200 × 630 card showing "Pricing" and "Example"

## ADDED Requirements

### Requirement: The identity holds the sharing choices

The identity MUST hold what pages without an image share (a card made from the title, the site's image, or nothing) and a colour (`#RRGGBB`, or empty for the colour picked from the logo). "The site's image" MUST need a chosen site image. Both MUST be validated with the identity, exported with it, and be the same in every language.

#### Scenario: Choosing the site's image without one

- **WHEN** a site save chooses "the site's image" with no default image
- **THEN** the system MUST answer 422 naming `identity.share_fallback`, and store nothing

#### Scenario: A colour that is not a colour

- **WHEN** a site save sends the colour "blue"
- **THEN** the system MUST answer 422 naming `identity.colour`

#### Scenario: Exporting

- **WHEN** an administrator chooses "No image" and the colour `#0F8A7E` and exports the configuration
- **THEN** the export MUST hold `share_fallback: none` and `colour: '#0F8A7E'` under `identity`

### Requirement: Upgraded sites keep their site image

Updating the module on a site that has a default image MUST make pages without an image keep sharing that image; a site without one MUST get the card. The update MUST invalidate rendered output.

#### Scenario: A site with a default image

- **WHEN** a site with a default image is updated
- **THEN** a page without an image MUST still share that image, as a 1200 × 630 version with the image's own alt text, and Site → Sharing MUST show "Use this image" selected

#### Scenario: A site without one

- **WHEN** a site without a default image is updated
- **THEN** a page without an image MUST share a card made from its title
