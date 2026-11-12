## ADDED Requirements

### Requirement: The stage says what publishing changes

When the draft's structured data differs from the published one in a value
or a verdict, the stage MUST list the changes as "‹fact› · ‹was› → ‹now›" and
"‹feature› · ‹was› → ‹now›", and say that shopping results read prices from
the page. Changes only to modification dates or order MUST NOT be listed. At
type scope it MUST give the change in reach.

#### Scenario: A price change

- **WHEN** the draft raises a product's price from €89 to €95
- **THEN** the stage MUST list "Price · €89 → €95" and no notice

#### Scenario: A template change

- **WHEN** a draft link change would leave 37 articles without an image
- **THEN** the stage MUST say "Publishing this change: Article title, image and date 212 → 175 of 212"

### Requirement: A change that stops a working feature is named with its fix

When publishing would stop a feature that can show today, one amber notice
MUST name the feature and the cause, with actions named after it: restore
the published value and show its field. When several edits caused it, the
action MUST be "Review changes". A bare "Undo" MUST NOT be offered.

#### Scenario: The image was removed

- **WHEN** the draft removes the image of a product whose merchant listing can show
- **THEN** the notice MUST say "When you publish, merchant listings stop: the product image was removed." with "Put the image back" and "Show the image field"

#### Scenario: Putting it back

- **WHEN** the editor presses "Put the image back"
- **THEN** the published image MUST be written into the draft and the notice MUST go away
