## ADDED Requirements

### Requirement: Worked-out values are told apart from fields

A link menu MUST group the module's worked-out values as "Automatic", after the
type's fields. An entry, or a Default box, whose value reads a field MUST say
which ("from Summary"). A worked-out value no item of the type can have MUST
wait in the last row, disabled, with the reason "No ‹type› has one". A field's
menu MUST NOT offer the value the field follows by default. Boxes and
announcements MUST name a worked-out value by its label alone.

#### Scenario: Where a value comes from

- **WHEN** an editor opens the link menu of a text detail on "Every Article", whose Body has a summary
- **THEN** the Description entry MUST be under "Automatic" and show the previewed article's description with "from Body"

#### Scenario: A value no item can have

- **WHEN** an editor opens the link menu of a text detail on "Every Bookmark", whose type has only a title and a link field
- **THEN** Description MUST NOT be among the entries at the top, and opening the last row MUST list it disabled with the reason "No bookmark has one"

#### Scenario: The field's own default

- **WHEN** an editor opens the link menu of "Every Post"'s description, which follows its default from Summary
- **THEN** "Automatic" MUST NOT list Description, and the description's Default box MUST say "from Summary"

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
