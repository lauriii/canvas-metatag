## ADDED Requirements

### Requirement: A composed value is joined from plain parts

Each field and fact of a composition MUST become plain text on its own before
the parts are joined; typed text MUST NOT be stripped of markup. The joined text
MUST then have its whitespace collapsed, and be escaped and cut as any text of
its place. Fixed names MUST never be filled in it.

#### Scenario: Markup in a field and in typed text

- **WHEN** "Every Event"'s description is Title, " <3 ", Notes, " ", Body, an event's plain text Notes hold `</script><b>VIP</b>`, and its formatted Body holds `<p>Doors <b>open</b></p>`
- **THEN** the description meta tag MUST carry "<3", `</script><b>VIP</b>` and "Doors open" as text, and the HTML MUST contain no element created from them

#### Scenario: A field that holds a fixed name

- **WHEN** an event's Notes field holds `{site}` and the description holds Notes
- **THEN** the description MUST hold `{site}` literally

### Requirement: A composed text too long for its place loses whole fields first

A composed text that is too long for its place, the title's main part, the
social title or a description, MUST first lose whole fields, with the text that
goes with them, from its end, and only then words: none of its joining words
MUST be left dangling.

#### Scenario: A cut composed title

- **WHEN** a composed main part is Title, " in ", City, and an event's title with the ending fills the 255 characters
- **THEN** the title MUST leave out " in ‹city›" before it loses any word of the event's title, and MUST NOT end in " in"

#### Scenario: A cut composed social title

- **WHEN** the social title is Title, " first performed at ", Venue, and an event's title and venue together pass 255 characters
- **THEN** `og:title` MUST be the event's title alone, never ending in " first performed at" or a cut venue

### Requirement: A composed value depends on every field it names

The head MUST carry the cache tags of every field, reference and entity a
composition reads, whether or not it gave a value, and of the site's date
settings. Each distinct field, in each form, MUST be read once per head, and
the host's access for visitors MUST be checked once per head.

#### Scenario: A city added later

- **WHEN** an event's venue has no city, its cached head leaves the city out, and the venue's city is then set
- **THEN** the event's next head MUST hold the city

#### Scenario: The site's country changes

- **WHEN** an administrator changes the site's default country from the United Kingdom to the United States
- **THEN** every cached English head that holds a date in words MUST be replaced, and read "June 20, 2026"

#### Scenario: One field in three places

- **WHEN** the title, the social title and the JSON-LD name each hold Venue › City
- **THEN** building the head MUST read Venue › City once
