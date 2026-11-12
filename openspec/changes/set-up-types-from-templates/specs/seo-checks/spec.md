## ADDED Requirements

### Requirement: A linked field the template does not show is reported

At type scope, a structured data value linked to a field the template does
not show MUST be listed to improve and said at the field, with "Open
template" and "Leave ‹fact› out". The last-updated date MUST be exempt.

#### Scenario: An author nobody sees

- **WHEN** the Article type's author is linked to Writer and the template never shows Writer
- **THEN** "The Article template doesn't show the writer." MUST be listed to improve and shown under the Author field

#### Scenario: The modified date

- **WHEN** the Article type's modified date follows Last updated and the template shows no update date
- **THEN** nothing MUST be listed

### Requirement: Dropped values are counted per type

At type scope, values that fail their kind on some items MUST be counted in
one row to improve with "Show which", which lists those items with links to
edit them. The dialog MUST NOT change those items.

#### Scenario: A currency field holding a symbol

- **WHEN** the Product type's currency is linked to a field that holds "€" on 3 products
- **THEN** "On 3 Products this field holds “€”, not a currency, so their price is left out." MUST be listed with "Show which" and no other action
