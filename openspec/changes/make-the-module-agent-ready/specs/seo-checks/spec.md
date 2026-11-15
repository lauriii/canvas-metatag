## MODIFIED Requirements

### Requirement: Site identity is reported only to those who can fix it

For people who can administer SEO site settings, the checks MUST list as good to
know what search engines do not know about who runs the site: no name, no logo,
no profile link. In the dialog it MUST lead to the first gap in Site settings;
on the command line it MUST be listed for the `site` target. Others MUST NOT
see it.

#### Scenario: An incomplete identity

- **WHEN** the site has a name but no logo and no profile link
- **THEN** the row MUST say "Search engines know little about who runs this site: no logo, no profile link."

#### Scenario: The site name stands in

- **WHEN** the identity has no name but the site has one
- **THEN** a missing name MUST NOT be reported

#### Scenario: An editor without site permission

- **WHEN** the site has no logo and the editor may not administer site settings
- **THEN** the identity row MUST NOT be listed

#### Scenario: On the command line

- **WHEN** `check site` runs without `--as` and the site has no logo
- **THEN** `identity-incomplete` MUST be listed as good to know with the path `/identity/logo`

## ADDED Requirements

### Requirement: Rules decided on the server

Every rule whose inputs are the stored or draft values, the resolved head, the
report and media facts MUST also run on the server for the command line, with
the dialog's ids, severities and paths, pinned to the dialog by one shared
fixture. Every rule id MUST be listed once as run on the server or in the
editor only; the command line MUST list editor-only rules as not checked, with
the reason.

#### Scenario: The same issue in both places

- **WHEN** a page's title names the site twice
- **THEN** `inspect` MUST list `title-site-twice` to improve with the path the dialog's Checks give it

#### Scenario: A rule that needs the preview

- **WHEN** `inspect` runs for any page
- **THEN** `title-long` and the main heading rule MUST be under `not_checked` with the reason `needs_editor_preview`

#### Scenario: An unlisted rule

- **WHEN** a rule id is added to the dialog's checks or the server's without being listed
- **THEN** the module's tests MUST fail

### Requirement: The command line reports what the dialog cannot show

The command line MUST report, for the site, media that do not resolve (to
fix) and a site value replaced by a configuration override (good to know); for
templates, SEO values on a template other than full; for any target, text
holding a former `{title}`-style token (to improve). Each message MUST say how
to fix it.

#### Scenario: Settings on a teaser template

- **WHEN** `check --all` runs and the Product teaser template holds SEO values
- **THEN** its result MUST list `setting-ignored` to improve, saying that only the full template is read

#### Scenario: An override

- **WHEN** settings.php sets the site's noindex
- **THEN** `check site` MUST list `overridden` as good to know, naming `/values/robots/noindex`

#### Scenario: A former token

- **WHEN** a template's title is `{"text": "{title}"}`
- **THEN** `check` MUST list `literal-braces` to improve, with a fix that sets `{"fact": "title"}`

#### Scenario: A missing logo after import

- **WHEN** the site's logo names a media item this environment does not have
- **THEN** `check site` MUST list `media-missing` to fix, and its message MUST say to ship the image with the recipe's content
