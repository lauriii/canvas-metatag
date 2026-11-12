## ADDED Requirements

### Requirement: Add details opens from a node in Output

Each module node in Output's outline that accepts details MUST offer "Add
details", opening a sheet titled "Add details to ‹name›" that names the node's
type and `@id`, says that values from the page always win, and shows, before
saving, what will be added, each clash by path, and the merged node's
verdicts.

#### Scenario: Adding details to a product

- **WHEN** an editor types details with `sku`, `offers.price` and `offers.itemCondition` for a product whose price comes from its Price field
- **THEN** the sheet MUST say "Valid. Adds sku and offers.itemCondition." and "“offers.price” comes from the Price field, so it isn't changed here. Its other details are added."

### Requirement: Hand-written JSON-LD gets name feedback

Both expert sheets MUST point out a property or value name that differs from
a documented name of a search feature for that type only by spelling or
case, with the documented name. Names on types no feature documents MUST get
no feedback.

#### Scenario: A misspelt availability

- **WHEN** a hand-added product's offer says `"availability": "Instock"`
- **THEN** the sheet MUST say "“Instock” isn't a value search engines document for availability. Did you mean “InStock”?"

### Requirement: A hand-added item can be marked as the main thing

In "Add your own JSON-LD", on a plain web page, each item with an `@id` MUST
offer "This is what the page is mainly about". On pages of any other kind the
toggle MUST NOT be shown.

#### Scenario: A product page

- **WHEN** the page's kind is "A product people buy"
- **THEN** no item MUST offer the toggle

### Requirement: Verdicts follow the editor's typing

Verdicts for values the dialog owns MUST update while the editor types,
without waiting for the draft write, and MUST agree with the server's once it
answers. Values from components MUST update when Canvas's draft is saved, and
the stage MUST say "Draft" until then.

#### Scenario: Adding a price

- **WHEN** an editor types a price above zero into an empty Price field of a product with an image
- **THEN** "Merchant listing" MUST read "Can show" before the draft write finishes
