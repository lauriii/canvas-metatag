## Purpose

Give site builders one read-only view of how the whole site's structured data
stands: per content type, Canvas page and set-up component, what it is
described as, which search features it can show and for how many items, and
what is missing, using the same verdicts as the dialog, without a crawl,
stored history or a score.

## ADDED Requirements

### Requirement: The overview lists types, pages and components

With the overview submodule enabled, a Canvas page extension "Structured data"
MUST list content types, Canvas pages and set-up components, each with what
it is described as, its search feature lines, its reach and what it needs,
computed from published output with the dialog's verdicts. It MUST NOT show
a score or a percentage on its own.

#### Scenario: Every Product

- **WHEN** 172 of 212 published products can show a merchant listing and 37 have no image
- **THEN** the Every Product row MUST read "172 of 212" with "37 have no image"

#### Scenario: A retired feature

- **WHEN** two pages carry hand-added FAQs
- **THEN** a summary MUST say "FAQ on 2" with "Not shown since 7 May 2026", never counted as needing something

### Requirement: A row opens the right scope

Each row MUST open the Canvas editor on that type's template, that page or
that component's set-up, with the SEO dialog on the Schema view.

#### Scenario: Opening a type

- **WHEN** a builder presses "Open" on Every Article
- **THEN** the Article template MUST open with the dialog on "Every Article" and Schema

### Requirement: The overview respects access

Rows for entities the user may not update MUST be counted but not opened, and
no value of an entity the user may not view MUST be shown.

#### Scenario: A restricted page

- **WHEN** a builder may not update a Canvas page
- **THEN** that page MUST count in the totals but its row MUST have no "Open"

### Requirement: The overview can be exported

The overview MUST export the current view as CSV with the same columns,
built in a batch so that large sites do not time out.

#### Scenario: Ten thousand pages

- **WHEN** a builder exports the Pages view of a site with 10,000 pages
- **THEN** the export MUST run as a batch and give one row per page
