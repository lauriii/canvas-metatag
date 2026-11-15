## MODIFIED Requirements

### Requirement: The stored setting is always valid configuration

Empty values MUST NOT be stored, and clearing every value MUST remove the
setting. "No ending" MUST be stored, as an empty typed ending. The stored
setting MUST pass the module's constraint, which refuses only shapes the rules
can never accept (configuration-as-code), and MUST stay valid for any text,
including emoji sequences, joiners and direction marks, and for a broken link,
so that a Canvas publish of the template fails only on a value the output
would drop anyway.

#### Scenario: Clearing everything

- **WHEN** an editor removes every type-level value
- **THEN** the template's draft MUST carry no setting of the module

#### Scenario: Unusual text

- **WHEN** a template's title holds a joined emoji and its description a non-joiner and a direction mark, and the template is published
- **THEN** the publish MUST succeed and the stored template MUST validate

#### Scenario: A broken link

- **WHEN** a template whose description links to a deleted field is published
- **THEN** the publish MUST succeed and the stored template MUST validate

#### Scenario: A malformed setting

- **WHEN** a template whose stored setting holds `{"fact": "nope"}` is published
- **THEN** the publish MUST fail, naming the setting's path
