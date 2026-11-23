## MODIFIED Requirements

### Requirement: The title is edited as a main part and an ending

The Title field MUST be one control in two parts: the main part, and a button
named "Title ending: ‹value›", described "Added after the separator ‹sep›."
("The title ends with its main part." for "No ending"), that shows the
separator and the ending and opens the ending's menu (value-links). The main
part MUST be a text input on a page (with Suggest when suggestions are
offered) and, on a template, a value that can be linked and composed: a box
while it follows its default or links one field, and a composer otherwise.
The ending MUST NOT be composed. Reset MUST remove both parts.

#### Scenario: A page's title

- **WHEN** an editor opens the Search tab of a page on the site "Example" with the installed defaults
- **THEN** the Title field MUST be one textbox named "Title" and one button named "Title ending: Example"

#### Scenario: A template's title

- **WHEN** an editor opens the Search tab of "Every Event" on the site "Example"
- **THEN** the Title field MUST be the box "Default", described "Follows the default: each event's title.", and one button named "Title ending: Example"

#### Scenario: A template's composed title

- **WHEN** "Every Event"'s title main part is Title, " in ", Venue › City
- **THEN** the Title field MUST be one composer named "Title" whose result line leaves out "| Example", and one button named "Title ending: Example"

### Requirement: Preview and fields point at each other

Clicking a part of a preview MUST put focus in the field that sets it, in a
composer with the caret at its end. Focusing a field MUST highlight its part of
the preview. The title's main part and its ending MUST each highlight only
their own words; a composed main part MUST highlight as one part.

#### Scenario: Clicking the preview's title

- **WHEN** an editor clicks the title in the search preview
- **THEN** the Title field MUST have focus

#### Scenario: Focusing the ending

- **WHEN** an editor focuses the title ending button, or opens its menu
- **THEN** only the separator and the ending MUST be highlighted in the search preview

#### Scenario: Clicking the title of a template

- **WHEN** an editor of "Every Event", whose title follows its default, clicks the title in the search preview
- **THEN** the Title box MUST have focus

#### Scenario: Focusing a composed title

- **WHEN** an editor focuses "Every Event"'s composed title
- **THEN** "Summer Gala in Helsinki · 20 June 2026" MUST be highlighted in the search preview as one part, and the ending MUST NOT be

#### Scenario: Clicking a composed title in the preview

- **WHEN** an editor clicks the composed title in the search preview and types "!"
- **THEN** the composition MUST end with "!"

## ADDED Requirements

### Requirement: A composed value previews as the head will have it

The previews, the length guidance and Checks MUST use a composition's result for
the previewed item, with the same empty-field rule as the head, a title's
ending included. The length guidance MUST say that it is for this item and that
others vary. Until the server answers, the dialog MUST compose from the
server's words for each field and MUST NOT format a field itself. Changing the
previewed item MUST change every composed result.

#### Scenario: Length of a composed title

- **WHEN** an editor focuses "Every Event"'s composed title while previewing "Summer Gala"
- **THEN** the length guidance MUST measure "Summer Gala in Helsinki · 20 June 2026 | Example", and say that it is for this event and others vary

#### Scenario: Another event

- **WHEN** the editor picks another event, in Oslo on 1 July 2026, in Canvas's preview
- **THEN** the composer's result and the search preview MUST read "‹its title› in Oslo · 1 July 2026"

#### Scenario: The same words as the head

- **WHEN** the edit is saved and confirmed
- **THEN** the search preview's title MUST equal the head's title for that event
