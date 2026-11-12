## ADDED Requirements

### Requirement: A component change that drops an item is reported

When a page's component version lacks a prop its set-up maps, a row to improve
MUST say which item is left out. For people who can administer SEO site
settings it MUST name the prop, the version and how many pages share it, with
"Set up ‹component›…"; for others it MUST say "Ask a site builder".

#### Scenario: An editor

- **WHEN** an editor without site permission opens a page whose Pricing table version lacks the Starter price
- **THEN** the row MUST read "The Pricing table changed, so the Starter plan is left out. Ask a site builder."

### Requirement: Components not set up are pointed out to builders

A component on the page that has props worth describing and no set-up MUST
be listed as good to know for people who can administer SEO site settings
only.

#### Scenario: A video player

- **WHEN** a page shows a Video player that is not set up
- **THEN** administrators MUST see "This page has a Video player that isn't set up yet." with "Set up Video player…", and editors MUST see nothing

### Requirement: A missing main part is reported

When the part a page was mainly about is gone, the view MUST show "The part
this page was about is gone." with "Choose again", and Checks MUST list it to
improve.

#### Scenario: Removed component

- **WHEN** the component the page was mainly about is removed
- **THEN** the notice and the row MUST be shown, and no other part MUST be chosen
