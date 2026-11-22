## ADDED Requirements

### Requirement: Clashes with added details are listed

Each added detail the module's own value overrides MUST be listed to improve,
naming the path and where the kept value comes from, and leading to the Add
details sheet.

#### Scenario: A price clash

- **WHEN** added details set `offers.price` and the Price field sets the price
- **THEN** "“offers.price” comes from the Price field, so the added value isn't used" MUST be listed to improve

### Requirement: Hand-added links that can't fill are listed

A field or media name inside other text in a hand-added item MUST be listed
to improve with "This name is only filled when it is the whole value." A
hand-added value left out because its link is empty, hidden or gone for the
item being checked MUST be listed to improve with its path, leading to that
row in "Add your own JSON-LD".

#### Scenario: A byline inside text

- **WHEN** a template's hand-added item has `"name": "By {field.field_byline}"`
- **THEN** Checks MUST list it to improve with that sentence

#### Scenario: A review without a score

- **WHEN** the previewed book review has no Score and its hand-added rating links to it
- **THEN** "No Score for this book review, so its rating is left out." MUST be listed to improve

### Requirement: Structured data left out of the head is to fix

When the structured data is left out of the head because it can't be encoded
or would exceed 256 KB, Checks MUST list it to fix, say that the other tags
are still output, and name hand-added JSON-LD or added details when they are
the cause.

#### Scenario: Too much hand-added JSON-LD

- **WHEN** linked values make a page's structured data exceed 256 KB
- **THEN** Checks MUST list "Your own JSON-LD was left out: the structured data would be over 256 KB." to fix

### Requirement: A translation missing hand-added items is good to know

When the source version of a page has hand-added items and a translation
has none, Checks MUST list it as good to know, leading to the translation's
"Add your own JSON-LD".

#### Scenario: French without the rating

- **WHEN** the English page has two hand-added items and its French translation none
- **THEN** "The English version has 2 hand-added items this translation doesn't." MUST be listed as good to know on the French page
