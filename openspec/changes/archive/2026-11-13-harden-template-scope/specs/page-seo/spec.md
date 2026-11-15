## ADDED Requirements

### Requirement: A translation keeps the details of its published type

While the default version's draft changes its structured data type, a write to
a translation MUST keep the translation's stored details of the published type,
which the dialog cannot show. Taking the type change back, or discarding it,
MUST lose none of them.

#### Scenario: A type change taken back while it is a draft

- **WHEN** the English version is published as a Product, its draft changes the type to Article, the French translation, whose stored details hold the price 25, changes only its title, and the English draft then changes the type back to Product
- **THEN** the French details MUST show the price 25 again, and once published, the French head MUST carry the Product with the price 25

#### Scenario: The type change is discarded

- **WHEN** the same French title change is made and the English draft is then discarded
- **THEN** the French details MUST still hold the price 25

#### Scenario: The type change is published

- **WHEN** the English Article draft is published and the French translation is then written again
- **THEN** the French details of the Product MAY be dropped, and the French head MUST carry no Product

### Requirement: A new translation publishes its own values

When a translation that exists only as a Canvas draft is published, its SEO
value MUST be stored with it, also when that value equals the default
version's.

#### Scenario: The same value as the default version

- **WHEN** the English version stores the title `{title}` and nothing else, and a Spanish draft-only translation stores the same title and is published
- **THEN** the stored Spanish translation MUST hold the title `{title}`

#### Scenario: A different value

- **WHEN** the Spanish draft-only translation stores `{"robots":{"noindex":true}}` and is published
- **THEN** the stored Spanish translation MUST hold that value
