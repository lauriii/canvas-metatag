## ADDED Requirements

### Requirement: The site sets a currency

Site settings MUST offer a Currency, chosen from ISO 4217 codes labelled in
the dialog's language ("Euro (€)"), empty by default. It MUST be the default
currency of every price on the site.

#### Scenario: Choosing a currency

- **WHEN** an administrator chooses Euro and saves
- **THEN** `currency` MUST be stored as "EUR"

#### Scenario: A code that is not a currency

- **WHEN** a save sends the currency "€"
- **THEN** it MUST be refused with a message asking for a three-letter code

### Requirement: A site save says what it changes elsewhere

When a site save would change the structured data of other pages, the dialog
MUST say before saving where it goes live and what changes there, naming at
most 25 places and counting the rest, and the save button MUST read "Save and
apply to ‹n› places".

#### Scenario: A first currency

- **WHEN** an administrator sets the site currency while three published products have no currency
- **THEN** the bar MUST say it goes live on those three pages and that their merchant listing may change, with "Save and apply to 3 places"
