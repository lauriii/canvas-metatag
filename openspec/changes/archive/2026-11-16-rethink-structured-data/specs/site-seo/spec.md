## ADDED Requirements

### Requirement: The site sets a currency

Site settings MUST offer a Currency, chosen from ISO 4217 codes, each named
in the dialog's language with its code ("Euro · EUR") and listed by that
name, empty by default. It MUST be the default currency of every price on
the site, and the field MUST say so.

#### Scenario: Choosing a currency

- **WHEN** an administrator chooses Euro and saves
- **THEN** `currency` MUST be stored as "EUR"

#### Scenario: A code that is not a currency

- **WHEN** a save sends the currency "€"
- **THEN** it MUST be refused with a message asking for a currency code from the list

### Requirement: A site save says what it changes elsewhere

When a change of the site currency would change the structured data of
other pages, the dialog MUST say before saving where it goes live: the
Currency field MUST name at most 25 places, count the rest and say that
their merchant listing may change, and the bar and the save button MUST
say how many places it changes. A content type whose currency is unset or
linked to a field counts as one place ("Every Product").

#### Scenario: A first currency

- **WHEN** an administrator sets the site currency while three published products have no currency
- **THEN** the Currency field MUST say "Goes live on ‹the three names›. Their merchant listings may change.", and the bar MUST say "Also changes 3 places." with "Save and update 3 places"

#### Scenario: One place

- **WHEN** the change reaches only "Every Product"
- **THEN** the bar MUST say "Also changes Every Product." with "Save and update Every Product"

#### Scenario: A currency linked to a field

- **WHEN** "Every Product" links its currency to a field and the site currency is set
- **THEN** "Every Product" MUST be one of the places named
