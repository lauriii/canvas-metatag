## ADDED Requirements

### Requirement: Worked-out values are told apart from fields

A link menu MUST group the module's worked-out values as "Automatic", after the
type's fields. An entry, or a Default box, whose value reads a field MUST say
which ("from Summary"). A worked-out value no item of the type can have MUST
wait in the last row, disabled, with the reason "No ‹type› has one". When a
pick links the whole value, a field's menu MUST NOT offer the value the field
follows by default. Boxes, chips and announcements MUST name a worked-out
value by its label alone.

#### Scenario: Where a value comes from

- **WHEN** an editor opens the link menu of a text detail on "Every Article", whose Body has a summary
- **THEN** the Description entry MUST be under "Automatic" and show the previewed article's description with "from Body"

#### Scenario: A value no item can have

- **WHEN** an editor opens the link menu of a text detail on "Every Bookmark", whose type has only a title and a link field
- **THEN** Description MUST NOT be among the entries at the top, and opening the last row MUST list it disabled with the reason "No bookmark has one"

#### Scenario: The field's own default

- **WHEN** an editor opens the link menu of "Every Post"'s description, which follows its default from Summary
- **THEN** "Automatic" MUST NOT list Description, and the description's Default box MUST say "from Summary"

#### Scenario: The field's own default when adding to a composition

- **WHEN** the description is a composer holding " Free delivery." and the editor opens "Add a field to Description", or opens "Replace ‹Source›" on one of its chips
- **THEN** "Automatic" MUST list Description with "from Summary", and picking it MUST put a chip named "Description" at the caret or in the chip's place

#### Scenario: Starting from the field's own default

- **WHEN** the editor opens the menu of "Every Post"'s untouched description, or "Link Description" in its empty composer
- **THEN** it MUST offer "Add words or fields" with "Start from Description", and picking it MUST give a composer whose first chip is Description

#### Scenario: Linked to a worked-out value

- **WHEN** a text detail of "Every Article" is linked to Site name
- **THEN** its box MUST show "Site name", and its description MUST start with "Linked to Site name."

### Requirement: Fields named for the value come first

A field is named for a value when its whole label, or its machine name without
`field_`, is one of the value's words, compared without case: summary,
description, excerpt, teaser, intro, lead or abstract for a description;
headline or title for a title. With an empty filter, those fields MUST come
first in a link menu, in form order, and the other fields MUST follow in form
order.

#### Scenario: Summary before an earlier field

- **WHEN** an editor opens the description's link menu on "Every Post", whose form lists Image › Alternative text before Summary
- **THEN** Summary MUST be the first entry of the Post group

#### Scenario: A typed filter

- **WHEN** the editor types "alt" into that menu's filter
- **THEN** the entries MUST be ranked by the filter alone

### Requirement: Worked-out values read the same in a composer

A chip of a worked-out value MUST say in its tooltip, and its composer in its
description, which field it reads ("from Summary"). "No ‹type› has one" and
the order of fields named for the value MUST hold in the menu's link, add and
replace modes alike.

#### Scenario: A chip that reads a field

- **WHEN** "Every Post"'s description is Description, " Free delivery.", and Description reads Summary
- **THEN** the chip MUST read "Description", never "Automatic › Description", its tooltip MUST say "from Summary", and the composer's description MUST say it too

#### Scenario: Adding on a type without the value

- **WHEN** an editor opens "Add a field to Description" in a composer on "Every Bookmark"
- **THEN** Description MUST wait in the last row, disabled, with the reason "No bookmark has one"

#### Scenario: Named fields first when adding

- **WHEN** an editor opens "Add a field to Description" with an empty filter on "Every Post", whose form lists Image › Alternative text before Summary
- **THEN** Summary MUST be the first entry of the Post group
