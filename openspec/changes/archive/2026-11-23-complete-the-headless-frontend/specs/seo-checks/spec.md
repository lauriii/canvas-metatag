## ADDED Requirements

### Requirement: A missing description on a headless site names the frontend

When `canvas_headless` has a frontend, every variant of "Add a description"
MUST say "No description sent. The frontend decides what to show." in place of
its sentence about what search engines pick. Its level,
its other sentences and its fix MUST stay the same.

#### Scenario: A headless page without a description

- **WHEN** a page has no description and the first frontend is `https://www.example.com`
- **THEN** "Add a description" MUST be listed to improve, with "No description sent. The frontend decides what to show."

#### Scenario: A coupled page

- **WHEN** a page has no description and `canvas_headless` has no frontend
- **THEN** "Add a description" MUST say "Without one, search engines pick text from the page."

### Requirement: A type whose items can't have a description says so

At template scope, when the description follows its default and no field of
the type can give one, Checks MUST say "No ‹type› has a description" as good
to know, with no sentence about items that have one.

#### Scenario: A type with only a title and a link

- **WHEN** "Every Bookmark", whose type has only a title and a link field, follows the default description
- **THEN** Checks MUST list "No bookmark has a description" as good to know, saying "Search engines pick text from the page." on a coupled site and "No description sent. The frontend decides what to show." on a headless one

### Requirement: Pages without an address say why

When the head leaves out page addresses because the public base is on a host
no visitor reaches (headless-head), Checks MUST list one issue to fix, "Page
addresses are left out", in two short sentences an editor can read: what is
left out, and that an administrator can fix it, with the status report saying
how. It MUST NOT name the setting: the status report row does.

#### Scenario: A development frontend in production

- **WHEN** an editor opens the dialog at `https://cms.example.com`, no public base is set, and the first frontend is `http://localhost:3000`
- **THEN** Checks MUST list "Page addresses are left out" to fix, saying "Visitors can't reach the site's public address, so links to this page, share links, language links and structured data are left out. An administrator can fix this; the status report says how."

#### Scenario: A page with hand-added JSON-LD

- **WHEN** the same editor opens a page that has hand-added JSON-LD
- **THEN** the dialog MUST open and Checks MUST list "Page addresses are left out", with no rule about the hand-added items, whose graph is left out
- **AND** the search preview and the link preview MUST show no address

#### Scenario: The Structured data view

- **WHEN** the same editor opens the Structured data view
- **THEN** it MUST say "No structured data is sent: page addresses are left out." with a way to Checks, and show no search features
- **AND** Checks MUST NOT list "No search feature for ‹kind›" as good to know: no structured data reaches search engines
