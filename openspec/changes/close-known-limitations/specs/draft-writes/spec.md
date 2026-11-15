## ADDED Requirements

### Requirement: The module's writes to one draft happen one at a time

Each write of the module to a page or template draft MUST read and write that draft as one step, with the conflict rule checked inside it. A write that cannot start within 5 seconds MUST be answered 409 `busy` with `Retry-After: 1`, and MUST write nothing. The dialog MUST retry a `busy` write once, after a second, without a message, and show its usual failed line only when the retry is `busy` too.

#### Scenario: A draft that stays busy

- **WHEN** another process holds a page's draft for longer than 5 seconds
- **THEN** a dialog write MUST be answered 409 `busy` and the draft MUST be unchanged
- **AND** an editor save of the page MUST still be stored, with the module's value kept

#### Scenario: Busy once

- **WHEN** a dialog write is answered `busy` and its retry is answered 200
- **THEN** the dialog MUST show no message

### Requirement: The status report says when drafts are unprotected

When the module cannot keep its value through Canvas's saves, because another module replaced Canvas's auto-save service or Canvas changed it, the status report MUST show a warning for "SEO values in Canvas drafts" saying that a dialog change made at the same instant as an editor save can be lost. Writes MUST keep working.

#### Scenario: Another module replaced the service

- **WHEN** Canvas's auto-save service is not the one the module extends
- **THEN** the status report MUST show the warning, and a dialog write MUST still be stored

#### Scenario: Everything is in place

- **WHEN** Canvas's auto-save service is the one the module extends
- **THEN** the status report MUST NOT show the warning

## MODIFIED Requirements

### Requirement: Canvas's own saves keep the value

A save of a page or template draft through Canvas's auto-save service MUST keep the module's value as the latest draft holds it, also when the save began before a write of the module, and MUST NOT be refused for it. Only the module's draft service may change that value. An editor round trip that changes nothing MUST NOT create a draft, whether or not the page has a stored value, and also when the Metatag module is installed.

#### Scenario: Write, then editor saves

- **WHEN** the dialog writes a value, and the editor then saves the whole component tree and then one component, with the entry it had before the write
- **THEN** the draft MUST hold the value and the component change, and the editor MUST NOT be in conflict

#### Scenario: A write during an editor save

- **WHEN** an editor save of a page has read the draft, the dialog then writes the title, and the editor save is then written
- **THEN** the draft MUST hold the dialog's title and the editor's change, and the editor MUST NOT be in conflict

#### Scenario: A write during a template save

- **WHEN** the same happens to the Article template's draft with a component change
- **THEN** the draft MUST hold both

#### Scenario: A write during a publish toggle

- **WHEN** the editor's publish toggle has read a page's draft, the dialog then writes the title, and the toggle is then written
- **THEN** the draft MUST hold the title and the new status

#### Scenario: Rapid edits on both sides

- **WHEN** an editor alternates edits to the page title in Page data and to the title in the dialog
- **THEN** the draft MUST end with the last value of each

#### Scenario: An unchanged round trip

- **WHEN** the editor loads a page's layout and saves it back unchanged
- **THEN** the page MUST have no draft

#### Scenario: Other code saves a draft

- **WHEN** code other than the module saves a page's draft through Canvas's auto-save service with another SEO value
- **THEN** the draft MUST keep the module's value

### Requirement: A confirmed write is followed up

A write MUST be confirmed by its answer, without reading the draft back. Edits made while a write was in flight MUST be written next, the same way. After a confirmed write the dialog MUST ask Canvas to refresh its list of changes and MUST refresh its output and previews. When that refresh shows no draft and live values that differ from the write, the dialog MUST write the change once more; if that happens again, it MUST say the change could not be stored.

#### Scenario: Typing during a write

- **WHEN** an editor keeps typing in the title while the previous write is being confirmed
- **THEN** the dialog MUST write the newer title once the first write is confirmed

#### Scenario: One write per change

- **WHEN** the editor changes the title once and the write is answered 200
- **THEN** the dialog MUST send exactly one write for it

#### Scenario: A write that a publish took away

- **WHEN** a dialog write is answered 200 while Canvas publishes the same page, and the refresh then shows no draft and the old live title
- **THEN** the dialog MUST write the title again, and "Review changes" MUST list the page

## REMOVED Requirements

### Requirement: A write the editor overwrote is written again

**Reason**: Canvas's saves now keep the module's value ("Canvas's own saves keep the value", "The module's writes to one draft happen one at a time"), so no editor save can overwrite a write; the read-back loop never covered the write sent on close or a command-line write.

**Migration**: None. The dialog writes once; its follow-up read refreshes the output and catches a write lost to a publish. The scenario "Rapid edits on both sides" moves to "Canvas's own saves keep the value".
