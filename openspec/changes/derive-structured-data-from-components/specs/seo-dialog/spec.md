## ADDED Requirements

### Requirement: A suggestion is read back before anyone agrees

When a page's main thing could come from a set-up component and nothing is
stored, the stage MUST read the suggestion as it would ship, tagged
"Suggested", with its verdicts and a band "Suggested from the ‹component› on
this page." / "Until you confirm, search engines get a plain web page." with
"Change…" and "Looks right". No band MUST be shown on a non-default
translation.

#### Scenario: The pricing page

- **WHEN** `/pricing` shows the set-up Pricing table and has no stored kind
- **THEN** the stage MUST read "Studio membership, a service from Humanify Studio in three plans: …" with "No search feature", and the band's "Looks right" MUST store Plans for a service

#### Scenario: A product suggestion

- **WHEN** the suggestion is a product
- **THEN** the band MUST first ask "Can people buy it on this page?" with "Yes, they buy it here" and "No, they contact us"

### Requirement: Facts from a component point at it

A fact from a component MUST show as a read-only box tagged with the
component and prop, with "Select in page" for instances on the page or its
template, which selects the instance in the Canvas editor and keeps focus in
the dialog. An instance in an item's own content MUST read "From this
‹item›'s own content" with no action.

#### Scenario: Selecting the table

- **WHEN** the editor presses "Starter" in the sentence of a page confirmed as plans for a service
- **THEN** the Pricing table MUST be selected in the editor and the status region MUST say "Selected Pricing table in the page"

### Requirement: Several things on one page

When a page has several set-up parts, the view MUST offer "Mostly about"
listing them with what each could earn, and the sentence MUST add "It also
shows ‹parts›." with one honest line per part.

#### Scenario: The home page

- **WHEN** the home page shows a video, an FAQ and the Pricing table and is mostly about the front page
- **THEN** "Video result" MUST read "Not shown here: the page isn't mainly this video" and a gray line MUST say the plans are left out because the page isn't about them

### Requirement: Site lists the components that say something

For people who can administer SEO site settings, Site MUST offer "Components"
listing each component that has props worth describing, with what it is set
up as, where it is used and the versions in use; others MUST be named once as
showing the page's text. Each opens "Set up ‹component›".

#### Scenario: The components list

- **WHEN** an administrator opens Components on the farm site
- **THEN** the Pricing table MUST read "Plans for a service · 2 pages, 1 template · 2 versions in use", and the Event card MUST offer "Set up…"
