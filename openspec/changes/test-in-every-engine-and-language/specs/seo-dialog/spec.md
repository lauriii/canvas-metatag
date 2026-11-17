## ADDED Requirements

### Requirement: The dialog works in each browser engine

The dialog MUST work alike in the current releases of Chromium, Firefox and
WebKit: it opens in the editor and follows it, saves into the draft, keeps a
change made just before it closes, and its tabs, sheets, menus, keyboard use,
copying and right-to-left text behave the same.

#### Scenario: Closing mid-edit in Firefox

- **WHEN** an editor using Firefox types a title and closes the dialog within the save delay
- **THEN** the title MUST reach the page's draft, or the dialog MUST offer it when it next opens

#### Scenario: Copying in WebKit

- **WHEN** an editor using WebKit chooses "Copy tags" on Output
- **THEN** the tags MUST be on the clipboard, and the button MUST say "Copied"

#### Scenario: An Arabic page in each engine

- **WHEN** an editor opens the dialog on a page written in Arabic, in Chromium, Firefox or WebKit
- **THEN** the title input and the previews MUST run right to left, and their labels left to right

## MODIFIED Requirements

### Requirement: The dialog works with assistive technology

The status and passing messages MUST be announced through one polite live
region. Field errors and notices that block writing MUST be alerts; the other
notices MUST be polite. Each preview MUST be one image to assistive technology,
named with what it shows once typing has paused for a second. The dialog MUST
have no serious or critical accessibility violation in any view, in each
engine. Forced colours MUST keep focus and edges visible, and under reduced
motion only the spinner MAY animate.

#### Scenario: A hidden page's preview

- **WHEN** a hidden page's search preview is read out
- **THEN** its name MUST start with "Not shown in search results."

#### Scenario: An automated scan

- **WHEN** each tab of the page, template and site scopes, each sheet, an open scope or value menu, the suggestions tray, a field error, each notice, read-only Site and an Arabic page are scanned for accessibility in Chromium, Firefox and WebKit
- **THEN** no serious or critical violation MUST be found

#### Scenario: Forced colours

- **WHEN** the dialog is shown under forced colours and a field has focus
- **THEN** the field MUST have a 2 px outline in the system's highlight colour, and chips and lists MUST keep a 1 px edge

#### Scenario: Reduced motion

- **WHEN** reduced motion is asked for
- **THEN** a sheet MUST open without sliding, and a loading placeholder MUST NOT pulse

#### Scenario: A screen reader reads an information sentence

- **WHEN** a screen reader reaches an ⓘ button, in a WebKit browser with its platform's screen reader or in Firefox with an open-source one
- **THEN** it MUST read the button's name, then its sentence

#### Scenario: A screen reader reads a composed title

- **WHEN** a screen reader reaches a template's composed title, in a WebKit browser with its platform's screen reader, or in Firefox or a Chromium browser with an open-source one
- **THEN** it MUST read one textbox named by the field, its fields as words, and its description starting with the result, and MUST step over a field in one press
