## MODIFIED Requirements

### Requirement: The site card shows the identity

The site card MUST show the logo, else the name's first letter, large; the Site name, left out beside a wordmark; and a line: Drupal's slogan, else the identity description shortened at its first clause, left out when there is neither or when equal to the shared description. It MUST be used only where a requirement asks for it.

#### Scenario: A site card with a slogan

- **WHEN** the site card is drawn for a site whose Drupal slogan is "Human expertise for AI-made work"
- **THEN** it MUST show the logo, the Site name and "Human expertise for AI-made work"

#### Scenario: A site card with a description

- **WHEN** the site card is drawn for a site without a slogan whose identity description is "Human expertise that amplifies what your AI agents can do: creative direction, editorial judgment and strategy."
- **THEN** it MUST show the logo, the Site name and "Human expertise that amplifies what your AI agents can do"

#### Scenario: A site card without a slogan or a description

- **WHEN** the site card is drawn for a site with a logo, no Drupal slogan and no identity description
- **THEN** it MUST show the logo and the Site name, and no line
