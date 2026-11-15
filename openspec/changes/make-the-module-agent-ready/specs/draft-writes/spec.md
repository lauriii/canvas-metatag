## MODIFIED Requirements

### Requirement: Values are written into the draft, never saved directly

A dialog write MUST go into the Canvas draft of the page translation or
template it names, under the editor's client id. The dialog MUST NOT save a
stored page or template; only a live command-line write and the config action
store directly. A write for a target with no draft yet MUST start the draft
from the stored entity without changing it. The answer to a write MUST be the
stored values, in their canonical order, and nothing else.

#### Scenario: A page write

- **WHEN** the dialog writes a page's title override
- **THEN** the page's draft MUST hold it under the editor's client id, and the stored page MUST keep its revision and value
- **AND** the answer MUST be `{"values": …}` with the keys sorted, whatever order they were sent in

#### Scenario: A template write

- **WHEN** the dialog writes type values for the Article template
- **THEN** the template's draft MUST hold them, and the stored template MUST have no setting of the module

### Requirement: A write needs the editor's client id and entry

A write through the API MUST carry the values as an object, the editor's
client instance id as a non-empty string and the editor's auto-save entries as
a map of objects; otherwise the system MUST answer 400 `bad_request` and write
nothing. A page write MUST also name the language it writes. The dialog MUST
NOT write without the editor's client id and its auto-save entry for the
target; the target's settings are then read-only.

#### Scenario: No client id

- **WHEN** a template write has values and auto-save entries but no client instance id
- **THEN** the system MUST answer 400 and the template MUST get no draft

#### Scenario: The editor gives no entry

- **WHEN** the dialog cannot read the editor's client id or its entry for the page
- **THEN** the dialog MUST NOT send a write

## ADDED Requirements

### Requirement: A command-line write never takes over a draft

A command-line draft write MUST read the target's draft entry itself, write
under a client id of its own run, and apply Canvas's conflict rule and the
dialog's validation. It MUST write only when the target has no draft or the
acting account owns it, and MUST otherwise refuse with `draft_in_use`, naming
the owner, and change nothing. An editor's next save MUST be a conflict, as
after any other session's write.

#### Scenario: Another editor's draft

- **WHEN** a command writes a page's title while the page has a draft owned by another account
- **THEN** it MUST exit 2 with `draft_in_use` naming that account, and the draft MUST be unchanged

#### Scenario: An editor has the page open

- **WHEN** a command writes the title of a page that has no draft while an editor has it open in Canvas
- **THEN** the new draft MUST hold the title and be owned by the acting account, and the editor's next save MUST be refused by Canvas as a conflict

### Requirement: A live write keeps the account's draft in step

When a command stores values on a target that has a draft, it MUST apply the
same patch to that draft, so that publishing the draft keeps them, and a draft
that then equals the stored entity MUST be removed. When another account owns
the draft, it MUST refuse with `draft_in_use` and store nothing.

#### Scenario: Leaving one's own draft

- **WHEN** a command wrote a template's values into a draft and then runs the same `set` with `--to=live`
- **THEN** the stored template MUST hold the values, and the template MUST have no draft
