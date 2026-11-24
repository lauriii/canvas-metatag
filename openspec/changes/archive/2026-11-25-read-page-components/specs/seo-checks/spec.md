## ADDED Requirements

### Requirement: Values from components are compared with the page

When the report marks a structured data value as coming from a component
(`from_components`), the dialog MUST compare it with the page like a typed
value, because a component can hold a value it does not show. A value not
found MUST be listed to improve, naming the component, with Show leading to
the detail it fills when the page's kind has a field for it, and no Show
otherwise.

#### Scenario: A hidden plan

- **WHEN** the report says a plan "Starter" comes from the Pricing table component, and the page does not show it
- **THEN** "Couldn't find “Starter” on this page" MUST be listed to improve, its detail saying it comes from the Pricing table component

#### Scenario: Nothing marked yet

- **WHEN** a page is resolved before components are mapped to structured data (this change defines the contract only)
- **THEN** the report MUST mark no value as coming from a component, and no such row MUST be listed

### Requirement: Skipped components are reported to builders

A component the report lists as skipped (`skipped_parts`: missing prop,
error, access or cacheability) MUST be listed under Good to know, never
counted, for people who can administer SEO site settings and for nobody
else. A personalization case other than the default one MUST NOT be listed:
only the default case is ever read, by design.

#### Scenario: What reaches the report in this change

- **WHEN** a page is resolved before component values are read for structured data
- **THEN** only `error` and `personalized` MUST reach `skipped_parts`; missing prop, access and cacheability come with reading component values

#### Scenario: An editor who does not build the site

- **WHEN** someone who cannot administer SEO site settings opens Checks on a page with a skipped component
- **THEN** no row about skipped components MUST be listed

### Requirement: Skipped component rows say what and where once

Every row MUST be one statement of what is left out (or couldn't be read)
and where the component is placed (on the page, in the template, around the
page), naming it once, a prop in words, never a version hash; its detail
gives the reason and any remedy. Copies skipped for one reason in one place
MUST be one row with the count. A value visitors cannot see MUST be worded
as its outcome, never as an instruction to publish the prop.

#### Scenario: A renamed prop

- **WHEN** a Pricing table on the page is an older version without the prop `monthlyPrice` a later change maps
- **THEN** the row under Good to know MUST say "The Pricing table's monthly price on this page is left out", its detail "The component is an older version without “Monthly price”. Replace it with the current version.", and never show the version

#### Scenario: Three copies

- **WHEN** three Cards on a page show an image visitors cannot see
- **THEN** one row MUST say "The Card's image on this page is left out in 3 places", its detail "Visitors can't see it."

#### Scenario: One component in two places

- **WHEN** a Card whose content changes for each visitor is placed on the page and around the page
- **THEN** there MUST be two rows: "The Card on this page is left out" and "The Card around the page is left out"

### Requirement: The page's own breadcrumb trail is not a Check

The breadcrumb trail is the site's structure: nothing in the dialog sets it.
The page's own trail is described only with two items or more, so it never
needs anything; it MUST NOT be listed in Checks, and a page without one MUST
show no "Breadcrumb" line.

#### Scenario: A trail of one

- **WHEN** a top-level page shows a breadcrumb of only "Home"
- **THEN** the Schema view MUST show no "Breadcrumb" line and Checks MUST list nothing about it
