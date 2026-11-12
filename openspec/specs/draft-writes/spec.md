# draft-writes

## Purpose

Carry page and content type values into Canvas's own drafts, so that they
appear in "Review changes", can be discarded there and publish with the rest of
the draft, without ever losing a value to the editor's own saves and without
writing over another session's work. This capability owns the write protocol
for both scopes; page-seo and template-seo own what is stored.

## Requirements

### Requirement: Values are written into the draft, never saved directly

A page write MUST go into the Canvas draft of the page translation it names,
and a template write into the template's Canvas draft, under the editor's
client id. The module MUST NOT save a stored page or template itself. A write
for a target that has no draft yet MUST start the draft from the stored entity
without changing the stored one. The answer to a write MUST be the stored
values, in their canonical order, and nothing else.

#### Scenario: A page write

- **WHEN** the dialog writes a page's title override
- **THEN** the page's draft MUST hold it under the editor's client id, and the stored page MUST keep its revision and value
- **AND** the answer MUST be `{"values": …}` with the keys sorted, whatever order they were sent in

#### Scenario: A template write

- **WHEN** the dialog writes type values for the Article template
- **THEN** the template's draft MUST hold them, and the stored template MUST have no setting of the module

### Requirement: A write needs the editor's client id and entry

A write MUST carry the values as an object, the editor's client instance id as
a non-empty string and the editor's auto-save entries as a map of objects;
otherwise the system MUST answer 400 `bad_request` and write nothing. A page
write MUST also name the language it writes. The dialog MUST NOT write without
the editor's client id and its auto-save entry for the target; the target's
settings are then read-only.

#### Scenario: No client id

- **WHEN** a template write has values and auto-save entries but no client instance id
- **THEN** the system MUST answer 400 and the template MUST get no draft

#### Scenario: The editor gives no entry

- **WHEN** the dialog cannot read the editor's client id or its entry for the page
- **THEN** the dialog MUST NOT send a write

### Requirement: Writes follow Canvas's conflict rule

Every write MUST be checked with the rule Canvas applies to its own editor,
using only the entry for the target: with the client id that wrote the draft,
only the draft's starting point MUST match; with another client id, the hash
MUST match too. A write that fails the rule MUST be answered with 409
`conflict` and MUST write nothing. A write under another client id that passes
the rule MUST make the editor's next save a conflict, as any other session's
write does.

#### Scenario: Another session wrote the draft

- **WHEN** another client id writes with an entry it read before the draft changed, or with no entry for the target
- **THEN** the system MUST answer 409 `conflict` and the draft MUST keep its values

#### Scenario: A reloaded editor

- **WHEN** another client id writes with the entry of the current draft
- **THEN** the write MUST be accepted

#### Scenario: The editor after a write under another id

- **WHEN** a write under another client id lands in the page's draft
- **THEN** the editor's next save of the page MUST be refused by Canvas as a conflict

### Requirement: A write is validated as a whole

Every write MUST be validated before anything is written, with the rules of its
scope (page-seo, template-seo, dynamic-values, structured-data). An invalid
write MUST be answered with 422 `invalid` and one sentence per refused field,
keyed by its dotted path, and MUST write nothing. A value sent back exactly as
the draft, or else the stored entity, holds it MUST be accepted as it is, even
when it would no longer pass, so that the other fields stay savable.

#### Scenario: Two invalid fields

- **WHEN** a page write has the title `{nope}` and the canonical `pricing`
- **THEN** the system MUST answer 422 naming `title` and `canonical`, and MUST NOT create a draft

#### Scenario: A stored value that no longer passes

- **WHEN** a template's stored title uses a field that was deleted, and a write changes only the description
- **THEN** the write MUST be accepted with the title as stored
- **AND** a write that changes that title MUST be refused until the missing field is removed from it

### Requirement: Canvas's own saves keep the value

An editor save of the layout, of one component or of Page data MUST keep the
module's value in the draft, for pages and templates alike. An editor round
trip that changes nothing MUST NOT create a draft, whether or not the page has
a stored value, and also when the Metatag module is installed.

#### Scenario: Write, then editor saves

- **WHEN** the dialog writes a value, and the editor then saves the whole component tree and then one component, with the entry it had before the write
- **THEN** the draft MUST hold the value and the component change, and the editor MUST NOT be in conflict

#### Scenario: An unchanged round trip

- **WHEN** the editor loads a page's layout and saves it back unchanged
- **THEN** the page MUST have no draft

### Requirement: Writing the stored value back removes the draft

When a write makes the draft equal to the stored entity, Canvas MUST drop the
draft, so that undoing the only change returns the target to "no changes".
Key order MUST NOT matter.

#### Scenario: Resetting the only change

- **WHEN** an editor changes a published template's value and then writes the stored values back, in another key order
- **THEN** the template MUST have no draft

### Requirement: A write the editor overwrote is written again

Before each write the dialog MUST wait until the editor has no layout request
in flight. After each write it MUST wait until the editor has made no request
for 250 ms, read the target's values back, and write again when they differ
from the answer to its write. It MUST try at most five times, then report that
the change could not be stored and keep it in the dialog.

#### Scenario: An editor save lands on top

- **WHEN** an editor save overwrites the dialog's write in the draft
- **THEN** the dialog MUST write the value again, and the draft MUST end with it

#### Scenario: Rapid edits on both sides

- **WHEN** an editor alternates edits to the page title in Page data and to the title in the dialog
- **THEN** the draft MUST end with the last value of each

### Requirement: A confirmed write is followed up

Edits made while a write was in flight MUST be written next, with the same
procedure. After a confirmed write the dialog MUST ask Canvas to refresh its
list of changes, so that "Review changes" lists the target at once.

#### Scenario: Typing during a write

- **WHEN** an editor keeps typing in the title while the previous write is being confirmed
- **THEN** the dialog MUST write the newer title once the first write is confirmed

### Requirement: A refused field never deletes a saved one

When some fields are refused, the dialog MUST send the write again with each
refused field at its last confirmed value, until that field is edited again. A
refusal that names new fields MUST NOT count as an attempt.

#### Scenario: One field refused

- **WHEN** an editor changes the title and types a canonical the server refuses
- **THEN** the title MUST be saved to the draft and the canonical MUST keep its last saved value
