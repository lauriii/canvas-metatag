## ADDED Requirements

### Requirement: A missing description on a headless site names the frontend

When `canvas_headless` has a frontend, every variant of "Add a description",
the front page's included, MUST say "No description sent. The frontend decides
what shows." in place of its sentence about what search engines pick. Its level,
its other sentences and its fix MUST stay the same.

#### Scenario: A headless page without a description

- **WHEN** a page has no description and the first frontend is `https://www.example.com`
- **THEN** "Add a description" MUST be listed to improve, with "No description sent. The frontend decides what shows."

#### Scenario: A coupled page

- **WHEN** a page has no description and `canvas_headless` has no frontend
- **THEN** "Add a description" MUST say "Without one, search engines pick text from the page."
