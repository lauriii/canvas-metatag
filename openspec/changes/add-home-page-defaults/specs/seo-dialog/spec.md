## ADDED Requirements

### Requirement: The dialog says when the target is the home page

When the target is the front page (front-page), the view's caption MUST start
with "Home page", and the scope menu MUST say "your home page" under the page's
name. A page that becomes or stops being the home page when published MUST say
so instead. The scope MUST stay "This page" or "Every <Type>".

#### Scenario: The home page

- **WHEN** an editor opens the dialog on the Canvas page that is the front page
- **THEN** the caption MUST start with "Home page", and the scope button MUST still read "This page"

#### Scenario: Staged as the homepage

- **WHEN** the page is staged as the homepage in Canvas
- **THEN** the caption MUST read "Becomes the home page when you publish"

#### Scenario: Leaving

- **WHEN** another page is staged as the homepage
- **THEN** the current home page's caption MUST read "Stops being the home page when you publish"

#### Scenario: A template previewing the home node

- **WHEN** the dialog edits "Every Article" while previewing the article that is the front page
- **THEN** the caption MUST read "Previewing" with the article's name and "Home page"

#### Scenario: A translation that is not the home page

- **WHEN** the front page setting misses the Finnish translation of the front page
- **THEN** the Finnish caption MUST NOT say "Home page"

### Requirement: The search preview shows the home address

The search result preview of the front page MUST show the home address that
the canonical link uses, with its language prefix, whatever the page's alias,
and MUST NOT guess the home page from the address in the browser.

#### Scenario: A Finnish home page

- **WHEN** the Finnish translation of the front page is edited
- **THEN** the preview's address MUST be the public base followed by `/fi`

#### Scenario: A public base with a path

- **WHEN** the public base is `https://www.example.com/shop` and the front page has the alias `/home`
- **THEN** the preview's address MUST be `https://www.example.com/shop/`, not `https://www.example.com/shop/home`

### Requirement: Home page sentences are true for the site's setup

On the front page, the dialog MUST say what search engines read from it (the
site name, the site icon, verification codes) only where that is true: not the
site name or icon when the public base has a path, and only on condition when
a headless frontend serves the site.

#### Scenario: A site at the host root

- **WHEN** the public base is `https://www.example.com` and the front page is edited
- **THEN** the search preview's site name MUST say "Search engines read your site name from this page"

#### Scenario: A site in a subdirectory

- **WHEN** the public base is `https://www.example.com/shop`
- **THEN** the dialog MUST say that search engines read site names and icons from `https://www.example.com/`, which this site does not control, and MUST NOT say they read them from this page

#### Scenario: A headless frontend

- **WHEN** the public base comes from a headless frontend
- **THEN** the sentence MUST begin "If your frontend serves this page at its home address"
