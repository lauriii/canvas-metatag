## ADDED Requirements

### Requirement: A page may set a stop date

A page MAY set a stop date: a calendar date, optionally with a time of day,
typed. Anything else MUST be refused with "Enter a date." A page translation
MUST NOT inherit the stop date of the default version. A duplicate MUST keep
it, like the other overrides.

#### Scenario: Not a date

- **WHEN** a page write sets the stop date `2027-02-30` or `next week`
- **THEN** the system MUST refuse `expires` with "Enter a date."

#### Scenario: A translation

- **WHEN** the English version sets a stop date and the French translation sets none
- **THEN** the French head MUST carry no `unavailable_after`

### Requirement: A page's other tags are its own

A page's other tags MUST be stored with the page, per translation, by the rules
of other-tags. A new translation MUST start without rows and MUST NOT inherit
the default version's rows. Removing every row MUST remove the key.

#### Scenario: A new translation

- **WHEN** an English page has the row `rating` and a French translation is created
- **THEN** the French page MUST carry no `rating`, and the English page MUST keep it

## MODIFIED Requirements

### Requirement: Robots directives have fixed values

Robots directives MUST be true or false for `noindex`, `nofollow`, `nosnippet`
and `noimageindex`, a whole number from -1 (no limit) to 1000 for
`max_snippet`, a whole number from -1 (no limit) to 3600 for
`max_video_preview`, where 0 means a still image, none, standard or large for
`max_image_preview`, allow, own or deny for `ai_answers`, and allow or deny for
`ai_training`. Any other directive MUST be refused.

#### Scenario: A text limit out of range

- **WHEN** `max_snippet` is 2000 or `"50"`
- **THEN** the system MUST refuse `robots.max_snippet`

#### Scenario: A video limit out of range

- **WHEN** `max_video_preview` is 4000 or -2
- **THEN** the system MUST refuse `robots.max_video_preview`

#### Scenario: An unknown AI use value

- **WHEN** `ai_training` is `own`
- **THEN** the system MUST refuse `robots.ai_training`
