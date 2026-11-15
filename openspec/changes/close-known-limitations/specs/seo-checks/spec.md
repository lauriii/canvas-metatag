## ADDED Requirements

### Requirement: An image link previews can't use is named

When a page's own image or its chosen image exists but can't be used in link previews, the checks MUST say why (private files, unpublished, its translation unpublished, or not a public file) and what links show instead. It MUST be to improve when links show no image and an editor can act, and good to know otherwise, adding "Ask a site administrator" when only the site's file setup can change it. "Add a social image" MUST NOT be listed beside it.

#### Scenario: A chosen image in private files with a site image

- **WHEN** a page's chosen social image is in private files and the site has a default image
- **THEN** the checks MUST list "The chosen image isn't used in link previews: it is in private files" as good to know, saying links show the site's image, and MUST NOT list "Add a social image"

#### Scenario: Nothing to fall back to

- **WHEN** a page's own image is unpublished and the site's choice is "No image"
- **THEN** the checks MUST list "The page's image isn't used in link previews: it is unpublished" to improve, saying links show no image

#### Scenario: Only private image types

- **WHEN** every image media type stores its files in private files and a page's own image is one of them
- **THEN** the check MUST be good to know and MUST say "Ask a site administrator"

## MODIFIED Requirements

### Requirement: The command line reports what the dialog cannot show

The command line MUST report, for the site and for templates, a value replaced by a configuration override (good to know); for the site, media that do not resolve (to fix); for templates, SEO values on a template other than full; for any target, text holding a former `{title}`-style token (to improve). Each message MUST say how to fix it. A write that changes an overridden path MUST be refused with the code `overridden`.

#### Scenario: Settings on a teaser template

- **WHEN** `check --all` runs and the Product teaser template holds SEO values
- **THEN** its result MUST list `setting-ignored` to improve, saying that only the full template is read

#### Scenario: An override

- **WHEN** settings.php sets the site's noindex
- **THEN** `check site` MUST list `overridden` as good to know, naming `/values/robots/noindex`

#### Scenario: An override of a template

- **WHEN** settings.php sets the Article template's title ending
- **THEN** `check` of the Article template MUST list `overridden` as good to know, naming `/title_end`
- **AND** `set` of a different ending on it MUST be refused with `overridden` at `/title_end`

#### Scenario: A former token

- **WHEN** a template's title is `{"text": "{title}"}`
- **THEN** `check` MUST list `literal-braces` to improve, with a fix that sets `{"fact": "title"}`

#### Scenario: A missing logo after import

- **WHEN** the site's logo names a media item this environment does not have
- **THEN** `check site` MUST list `media-missing` to fix, and its message MUST say to ship the image with the recipe's content
