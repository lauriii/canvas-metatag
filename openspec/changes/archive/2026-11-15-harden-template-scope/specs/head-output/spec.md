## MODIFIED Requirements

### Requirement: The card hint follows the image size

The card hint MUST be `summary_large_image` when the effective image is at
least 600 pixels wide and 157 pixels tall, else `summary`, also when there is
no image. It MUST use the same rule as the dialog's link preview (seo-dialog),
so that the card the head asks for is the card the editor sees.

#### Scenario: A large image

- **WHEN** the effective image is 1200 by 630 pixels
- **THEN** the card hint MUST be `summary_large_image`

#### Scenario: A small image

- **WHEN** the effective image is 200 by 100 pixels
- **THEN** the card hint MUST be `summary`

#### Scenario: A square logo

- **WHEN** the effective image is 400 by 400 pixels
- **THEN** the card hint MUST be `summary`

#### Scenario: A wide banner

- **WHEN** the effective image is 1200 by 150 pixels
- **THEN** the card hint MUST be `summary`
