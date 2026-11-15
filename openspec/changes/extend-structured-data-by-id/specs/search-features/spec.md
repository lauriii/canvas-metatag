## ADDED Requirements

### Requirement: A need says what its value must look like

A needed name MAY state what its value must be: text, a number, a date, a
date and time, an address, a duration, yes or no, one of listed codes, or an
item of listed types with names it must carry. A value of another shape MUST
count as missing, and the verdict MUST name the shape. The check MUST run on
the merged, filled graph.

#### Scenario: A company given only as a name

- **WHEN** a hand-added employer rating's `itemReviewed` is the text "Acme Logistics"
- **THEN** "Employer rating" MUST read "Needs item reviewed as an organization"

#### Scenario: An author given only as a name

- **WHEN** a hand-added review's `author` is the text "Mia Virtanen"
- **THEN** "Review snippet" MUST read "Needs author as a person or organization", with "Make it a person", which MUST write `{"@type": "Person", "name": "Mia Virtanen"}`

### Requirement: Ratings, reviews and discussions have rules

The rules file MUST have entries for employer rating, review snippet, Q&A,
discussion forum, image metadata, software app and movie, each with what it
needs and what it expects of each need, what helps, a one-line description
written for this module, a sentence for the item list, and any condition no
machine checks. Hand-added items of these types MUST get their verdicts.

#### Scenario: An employer rating of another company

- **WHEN** a hand-added employer rating has an organization that isn't the site's, a rating value and a rating count
- **THEN** "Employer rating" MUST read "Can show" with the condition "Only if visitors can post ratings on this site"

#### Scenario: Either count

- **WHEN** the employer rating has neither a rating count nor a review count
- **THEN** it MUST read "Needs a rating count or review count"

#### Scenario: A dataset

- **WHEN** a page carries a hand-added `Dataset`
- **THEN** its line MUST read "No search feature"
