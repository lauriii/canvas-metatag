## ADDED Requirements

### Requirement: Structured data proposals for the new kinds are plain text only

AI proposals MAY fill plain text facts found on the page (a name, a summary,
a job title, a venue name). They MUST NOT propose a reference, opening
hours, a duration, money, a code, a list, a date or an identifier; such
facts MUST be listed as "Add it yourself".

#### Scenario: A recipe page

- **WHEN** the test provider returns a recipe name, a prep time and three ingredients
- **THEN** the review tray MUST offer only the name; Prep time and Cook time MUST read "Add it yourself", and Ingredients, not offered on a page, MUST NOT be listed
