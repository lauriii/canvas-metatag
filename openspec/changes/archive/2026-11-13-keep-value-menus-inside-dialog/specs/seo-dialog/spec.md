## ADDED Requirements

### Requirement: Value menus stay inside the dialog

A menu that lists values with their previews MUST open fully inside the
dialog, whichever column its field is in. Each entry MUST show its value
under its label across the menu's width, up to two lines, with the whole
value available on hover.

#### Scenario: A field in the right-hand column

- **WHEN** an editor opens the insert menu of Street address, beside Venue on "Every Event"'s Schema tab
- **THEN** the whole menu MUST be inside the dialog

#### Scenario: A long value

- **WHEN** the menu lists the previewed event's description
- **THEN** the description MUST be shown under "Description" on up to two lines, not cut beside the label
