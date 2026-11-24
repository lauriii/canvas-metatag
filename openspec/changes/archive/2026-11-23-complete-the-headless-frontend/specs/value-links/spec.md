## ADDED Requirements

### Requirement: Worked-out values are told apart from fields

A link menu MUST group the module's worked-out values as "Automatic", after the
type's fields. An entry, or a Default box, whose value reads a field MUST say
which ("from Summary"). A worked-out value no item of the type can have MUST
be listed last in its group, disabled: "No ‹type› has one". When a
pick links the whole value, a field's menu MUST NOT offer the value the field
follows by default. Boxes, chips and announcements MUST name a worked-out
value by its label alone.

#### Scenario: Where a value comes from

- **WHEN** an editor opens the link menu of a text detail on "Every Article", whose Body has a summary
- **THEN** the Description entry MUST be under "Automatic" and show the previewed article's description with "from Body › Summary", even where the Body › Summary entry above shows the same text

#### Scenario: A value no item can have

- **WHEN** an editor opens the link menu of a text detail on "Every Bookmark", whose type has only a title and a link field
- **THEN** Description MUST be the last entry under "Automatic", disabled with the reason "No bookmark has one", and the last row MUST NOT list it; the description's Default box MUST say "No bookmark has one", never "Empty for this bookmark"

#### Scenario: The field's own default

- **WHEN** an editor opens the link menu of "Every Post"'s description, which follows its default from Summary
- **THEN** "Automatic" MUST NOT list Description, and the description's Default box MUST say "from Summary"; the social image's Default box MUST say "from ‹the image field›" the same way, and its menu MUST NOT list Image

#### Scenario: The field's own default when adding to a composition

- **WHEN** the description is a composer holding " Free delivery." and the editor opens "Add a field to Description", or opens "Replace ‹Source›" on one of its chips
- **THEN** "Automatic" MUST list Description with "from Summary", and picking it MUST put a chip named "Description" at the caret or in the chip's place

#### Scenario: Starting from the field's own default

- **WHEN** the editor opens the menu of "Every Post"'s untouched description, or "Link Description" in its empty composer
- **THEN** it MUST offer "Add words or fields" with "Keep the default and add to it", as on any default named like its field, and picking it MUST give a composer whose first chip is Description

#### Scenario: A field labelled like the value it follows

- **WHEN** "Every Product"'s description follows its default from its body field, labelled Description
- **THEN** its Default box, the box's description and the link button's tooltip MUST say "from Description", never the field's machine name
- **AND** the description's link menu, which lists no Description under "Automatic", MUST list the field as "Description", marked "Default"; a menu that lists both, such as "Add a field to Description", MUST list the field as "Description (body)"

#### Scenario: Linked to a worked-out value

- **WHEN** a text detail of "Every Article" is linked to Site name
- **THEN** its box MUST show "Site name", and its description MUST start with "Linked to Site name."

### Requirement: Fields named for the value come first

A whole plain or formatted text field without a summary is named for a value
when its label as stored, or its machine name without `field_`, is one of the
value's words, compared without case: summary, description, excerpt, teaser,
intro, lead or abstract for a description; headline or title for a title.
With an empty filter, those fields MUST come first in a link menu, in form
order, and the rest MUST follow in the menu's usual order.

#### Scenario: Summary before an earlier field

- **WHEN** an editor opens the description's link menu on "Every Post", whose form lists Byline and Image › Alternative text before Summary
- **THEN** Summary MUST be the first entry of the Post group

#### Scenario: A translated label

- **WHEN** a field labelled "Summary" is shown as "Résumé" in the editor's language
- **THEN** it MUST still come first in the description's menu, and the Description MUST still read it, in every language

#### Scenario: A typed filter

- **WHEN** the editor types "alt" into that menu's filter
- **THEN** the entries MUST be ranked by the filter alone

### Requirement: A worked-out value says its field whole

A menu entry of a worked-out value MUST say the field it reads beside its
label, on screen and in its accessible name, whole however long its value.

#### Scenario: A long value

- **WHEN** the previewed event's Description is its Body's first 160 characters, and an editor opens the Title's link menu on "Every Event"
- **THEN** the Description entry under "Automatic" MUST show "from Description (body)" on screen and in its accessible name, wherever its value is cut: the body field is labelled Description too, and is named as the menu names it, so no entry reads "Description · from Description"

### Requirement: The field the default reads leads its menu

With an empty filter, the field a description's or image's worked-out
default reads MUST come first in its group, with the fields named for the
value. While a field follows that default, a menu that links the whole value
MUST mark that field's entry current, saying "Default".

#### Scenario: The field the default reads

- **WHEN** an editor opens the description's link menu on "Every Event", whose Description has a summary and whose form lists Description before Status
- **THEN** Description › Summary MUST be the first entry of the Event group, before Description and Status: the menu lists no Description fact, so the body field goes by its label

#### Scenario: What the default reads, in its menu

- **WHEN** an editor opens the description's link menu on "Every Event", which follows its default from Description › Summary
- **THEN** the Description › Summary entry MUST be marked current, its accessible name MUST start with "Description › Summary, Default", and the menu MUST open on it

#### Scenario: Choosing what the default reads

- **WHEN** the editor chooses that entry from the Default box's menu
- **THEN** the menu MUST close and the value MUST keep following its default: nothing is written

#### Scenario: What the default reads, through a reference

- **WHEN** an editor opens the social image's link menu on "Every Person", whose Image reads Photo, a media reference
- **THEN** the Photo row at the menu's first level MUST say "Default" beside its label, and the Photo › Image entry inside it MUST be marked current

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
- **THEN** Description MUST be the last entry under "Automatic", disabled, with the reason "No bookmark has one"

#### Scenario: Named fields first when adding

- **WHEN** an editor opens "Add a field to Description" with an empty filter on "Every Post", whose form lists Byline and Image › Alternative text before Summary
- **THEN** Summary MUST be the first entry of the Post group

## MODIFIED Requirements

### Requirement: In text, dates and numbers fit

In the menu of a value that can be composed, date and number fields and the
date facts MUST fit, with their words for the previewed item. Adding to a
title-like place, long text (a field or the Description fact) MUST wait in
the last row with "Too long for a title"; every other kind that does not fit,
with its reason. A field with several values MUST show its joined items, never
"First of ‹n›". A field labelled like a fact MUST add its machine name on its
chip and where a menu lists both.

#### Scenario: Starts in the title's menu

- **WHEN** an editor opens "Add a field to Title" on "Every Event"
- **THEN** Starts MUST be among the entries that fit, showing "20 June 2026", and the Website link field MUST wait in the last row with "An address, not text"

#### Scenario: Body in a title

- **WHEN** an editor opens "Add a field to Title" on "Every Article"
- **THEN** Body MUST wait in the last row with "Too long for a title"

#### Scenario: Several performers

- **WHEN** the previewed event has the performers Ada, Grace and Hedy
- **THEN** Performers › Title MUST show "Ada, Grace and 1 more" in "Add a field to Title", and "Ada, Grace, Hedy" in "Add a field to Description", and neither MUST say "First of 3"

#### Scenario: A field labelled Description

- **WHEN** the Article type has a field labelled "Description" and an editor adds it to a composition
- **THEN** its entry and its chip MUST read "Description (field_description)", apart from the Description fact
