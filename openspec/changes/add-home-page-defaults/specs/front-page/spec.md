# Spec Delta

## Purpose

Decide which entity is the site's front page in each language, now and after
the next publish, so that the head, the structured data, the checks and the
dialog all agree about the home page.

## ADDED Requirements

### Requirement: The front page is an entity, per language

For each language, the front page MUST be the entity that Drupal's front page
setting leads to in that language: the setting's path without its query, read
as a URL alias in that language or as a language-neutral alias, else as a
system path. A translation MUST count as the front page only when its entity is
the one found for its own language.

#### Scenario: A system path

- **WHEN** the front page setting is `/page/5` and page 5 has English and Finnish translations
- **THEN** both translations MUST count as the front page

#### Scenario: An alias in one language only

- **WHEN** the front page setting is `/home`, which is page 5's English alias, and page 5's Finnish translation has the alias `/fi/koti`
- **THEN** the English translation MUST count as the front page and the Finnish one MUST NOT

#### Scenario: One alias, a page per language

- **WHEN** `/home` is page 5's alias in English and page 9's alias in Finnish, and the front page setting is `/home`
- **THEN** page 5 MUST be the English front page and page 9 the Finnish one

#### Scenario: A query in the setting

- **WHEN** the front page setting is `/home?ref=start`
- **THEN** the front page MUST be the entity of `/home`

#### Scenario: A front page that is not an entity

- **WHEN** the front page setting is a Views listing or a custom route
- **THEN** no entity MUST count as the front page, and no owned head MUST change

### Requirement: Every consumer gets the same answer

The coupled head, the headless head, the dialog's state, the checks and the
Site preview MUST all use the front page decision, whatever route the request
is on. The decision MUST NOT depend on the path a visitor used to reach the
page.

#### Scenario: The dialog's state on the home page

- **WHEN** the dialog loads the state of the page that is the front page
- **THEN** the state MUST say that the target is the home page, although the request is an API request

#### Scenario: Two addresses of the home page

- **WHEN** a visitor requests `/` and then `/home` for the front page, coupled or through the content API
- **THEN** both heads MUST be the same

### Requirement: The state says whether the target is the home page

The dialog's state MUST say, for the target translation, one of: it is the
home page; it becomes the home page when published; it stops being the home
page when published; or none. At template scope it MUST name the node of the
type that is the front page, if any.

#### Scenario: A home page staged in Canvas

- **WHEN** an editor sets a page as the homepage in Canvas and has not published
- **THEN** that page's state MUST say it becomes the home page when published, and the current home page's state MUST say it stops being the home page when published

#### Scenario: A template that renders the home page

- **WHEN** the front page is the article "Welcome" and the dialog edits "Every Article" while previewing "Hello world"
- **THEN** the state MUST name "Welcome" as the home page this template renders

#### Scenario: Canvas changes the staged homepage

- **WHEN** an editor sets another page as the homepage while the dialog is open
- **THEN** the dialog MUST read the state again and follow it, without a reload

### Requirement: A staged home page changes nothing public

The head, the headless head and the structured data MUST use the current
front page only. A homepage change staged in Canvas MUST take effect on them
when it is published.

#### Scenario: Before and after publishing

- **WHEN** a page is staged as the homepage
- **THEN** its canonical MUST stay its own address until the change is published, and MUST be the public base followed by `/` after it

### Requirement: The state describes the site's home page

For Site settings, the state MUST report the home page per language: the
entity, whether the module owns its head, whether the front page setting holds
an alias, and whether the public base is a host root or has a path.

#### Scenario: A listing as the home page

- **WHEN** the front page setting is `/node`
- **THEN** the state MUST report that the home page is not owned by the module

#### Scenario: Set by an alias

- **WHEN** the front page setting is `/home`, page 5's alias
- **THEN** the state MUST report page 5, owned, set by its alias `/home`

#### Scenario: A base with a path

- **WHEN** the public base is `https://www.example.com/shop`
- **THEN** the state MUST report that the home page is not a host root
