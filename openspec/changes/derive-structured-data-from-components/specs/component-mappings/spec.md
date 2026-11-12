## Purpose

Let a site builder say once what a Canvas component means for structured
data, so that every copy of it on every page and template describes itself
from the values it renders, per component version, with the effect of each
save named before it goes live.

## ADDED Requirements

### Requirement: A component is set up once for the site

People who can administer SEO site settings MUST be able to set up a
component: what it shows, which props give which facts, facts it lacks typed
once, and what happens when a page is mainly this component. A set-up MUST
apply to every instance of the component on every page and template.

#### Scenario: The pricing table

- **WHEN** an administrator sets up the Pricing table as plans for a service, with plan names and monthly and annual prices from its props and the currency Euro
- **THEN** every page and template using the Pricing table MUST describe its plans from its own props

#### Scenario: An editor

- **WHEN** a user with only `edit canvas metatag` opens Site
- **THEN** no Components row or Set up action MUST be offered

### Requirement: A set-up is proposed from the component's props

The Set up sheet MUST propose a mapping from the component's prop shapes and
titles, without AI, and MUST store nothing until saved. Props that change only
how the component looks MUST be named as not used.

#### Scenario: Monthly and annual prices

- **WHEN** a pricing component has, per tier, a name, a monthly price and an annual price
- **THEN** the proposal MUST make two offers per tier, billed every month and every year

### Requirement: Plans are a service unless set up as goods

A component with plans and prices MUST be proposed as plans for a service.
It MUST describe things people buy only when the builder sets it up so.

#### Scenario: Default

- **WHEN** the Set up sheet opens for a pricing component
- **THEN** "It shows" MUST read "Plans for a service"

### Requirement: A set-up follows each instance's version

A set-up MUST record the version it was made for and MAY hold items per
version. Each instance MUST be read with the items for its own version; a
mapped prop its version lacks MUST give no value and be reported.

#### Scenario: A renamed prop on a newer version

- **WHEN** one page uses a newer Pricing table without `entryTierPriceMonthly`
- **THEN** that page's Starter plan MUST be left out and reported, and pages on the older version MUST be unchanged

### Requirement: Saving a set-up says where it goes live

Before saving a set-up, the sheet MUST name where it goes live and what
changes there, at most 25 places named and the rest counted, and the button
MUST read "Save and apply to ‹n› places".

#### Scenario: Three places

- **WHEN** the Pricing table is used on two pages and one template
- **THEN** the sheet MUST say "Goes live now on 2 pages, 1 template." and name the plans added

### Requirement: Leading a page is asked, automatic or never

A set-up MUST say what happens when a page is mainly this component: ask
whoever edits the page (default), apply automatically, or never. Automatic
MUST NOT be offered for things people buy.

#### Scenario: A product component

- **WHEN** a component is set up as things people buy here
- **THEN** "Automatically" MUST NOT be offered

### Requirement: Removing a component removes its set-up

When a Canvas component is deleted, its set-up MUST be removed with it, and
configuration import MUST import the component before its set-up.

#### Scenario: A deleted component

- **WHEN** the Pricing table component is deleted
- **THEN** its set-up MUST be gone and no page MUST describe plans from it
