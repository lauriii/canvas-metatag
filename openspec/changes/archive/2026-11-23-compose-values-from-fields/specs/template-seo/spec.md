## MODIFIED Requirements

### Requirement: The stored setting is always valid configuration

Empty values MUST NOT be stored, and clearing every value MUST remove the
setting. "No ending" MUST be stored, as an empty typed ending. The stored
setting MUST stay valid configuration for any text, including emoji sequences,
joiners and direction marks, for a broken link, and for a composition with
spaces between its fields or a broken field in it, so that a Canvas publish of
the template never fails on it. A malformed composition MUST fail validation
of the template's configuration, as Canvas, recipes and configuration
validation run it, naming the configuration and the path: a part with more
than one key, a nested or empty list of parts, more than eight fields and
facts, or a fact that does not fit text.

#### Scenario: Clearing everything

- **WHEN** an editor removes every type-level value
- **THEN** the template's draft MUST carry no setting of the module

#### Scenario: Unusual text

- **WHEN** a template's title holds a joined emoji and its description a non-joiner and a direction mark, and the template is published
- **THEN** the publish MUST succeed and the stored template MUST validate

#### Scenario: A broken link

- **WHEN** a template whose description links to a deleted field is published
- **THEN** the publish MUST succeed and the stored template MUST validate

#### Scenario: A composition

- **WHEN** a template whose title is First name, " ", Last name, with `field_last_name` deleted, is published and its configuration exported and imported
- **THEN** the publish and the import MUST succeed, the stored template MUST validate, and the space MUST still be there

#### Scenario: A malformed composition

- **WHEN** a template whose title is a list of parts in which one part has both `text` and `fact` is validated
- **THEN** validation MUST fail with a violation at that part's path
