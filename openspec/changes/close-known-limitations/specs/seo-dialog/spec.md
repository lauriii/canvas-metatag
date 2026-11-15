## ADDED Requirements

### Requirement: The image field says why the page's image is not shared

When the page's own image exists but can't be used in link previews, the image field MUST say so with the reason (it is in private files, it is unpublished, its version in the page's language is unpublished, or its file system is not public) and name what is used instead, as it does for a chosen image. The image picker's empty state MUST say that only published images stored in public files are listed.

#### Scenario: A page image in private files

- **WHEN** a page's own image is stored in private files and the site has a default image
- **THEN** the image field MUST say "Not used in link previews: the image is in private files · using the site default"

#### Scenario: An unpublished translation

- **WHEN** a French page's image has a French version that is unpublished
- **THEN** the image field MUST say "Not used in link previews: its French version is unpublished", followed by what is used instead

### Requirement: A field set outside SEO is read-only

A field whose paths are all replaced by a configuration override MUST show the value that applies, locked, with "Set in site configuration outside SEO" visible without hover, and MUST offer no Reset, Edit, Suggest or fix. A user who may change site settings MUST also be told to change it where the configuration sets it, or remove that override first. A field with one overridden part MUST lock only that part. An unsent change to an overridden path MUST be dropped, saying so once.

#### Scenario: An overridden title ending

- **WHEN** `settings.php` sets the Article template's title ending to "Staging"
- **THEN** the template's ending MUST show "Staging", locked, with "Set in site configuration outside SEO", and the title preview MUST end in "Staging"

#### Scenario: A staging site's search visibility

- **WHEN** `settings.php` sets the site's `noindex`
- **THEN** Site's "Hide from search engines" MUST show on, locked, with "Set in site configuration outside SEO"

#### Scenario: An unsent change to a path now overridden

- **WHEN** the dialog reopens with an unsent change to the Article ending, and an override of that ending has since been set
- **THEN** the change MUST be dropped, and the offer strip MUST say "A change to Title ending wasn't kept: it is now set in site configuration"

### Requirement: Values carry their language

Every text that shows a value MUST carry the language it is written in: the edited translation's in page scope, the previewed node's in template scope, the site's default language in site scope. The dialog's own words MUST keep the dialog's language, and a language name inside them MUST be isolated for direction.

#### Scenario: An Arabic page

- **WHEN** the dialog edits a page whose language is Arabic
- **THEN** the title input and the search preview's title MUST carry the language `ar`, and the field's label MUST NOT
