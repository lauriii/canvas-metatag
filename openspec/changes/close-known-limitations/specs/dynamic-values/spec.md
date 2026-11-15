## ADDED Requirements

### Requirement: A member set to null is ignored

A value's members whose value is null MUST be ignored before its form is checked, so that a configuration override can replace a value of another kind.

#### Scenario: An override replaces a linked title with text

- **WHEN** a template's stored title is `{"fact": "title"}` and `settings.php` sets it to `{"fact": null, "text": "Staging"}`
- **THEN** the title MUST resolve as the text "Staging", and no value MUST be dropped

### Requirement: A file address is absolute

A file address that the site rewrites to a protocol-relative one, as a file delivery network integration does, MUST take the scheme of the site's public address, and MUST then be used like any other absolute address. A file address that is still not absolute http or https MUST give nothing.

#### Scenario: Files served from a delivery network

- **WHEN** the site rewrites public file addresses to `//cdn.example.com/...` and its public address is `https://www.example.com`
- **THEN** a page's chosen image MUST be shared as `https://cdn.example.com/...`, and the dialog's picker MUST list it

## MODIFIED Requirements

### Requirement: Values are what an anonymous visitor may see

Every value from published content MUST be what an anonymous visitor may see, whoever asks. A field, referenced entity, media item or file that visitors may not view MUST give nothing, so the value falls back to its default. An image MUST be a public file: in Drupal's public files or a file system the site declares public, never private or temporary files. The dialog MUST name the reason. The Author fact MUST need only the right to view the account's label.

#### Scenario: A field visitors cannot view

- **WHEN** a template links the description to a field that anonymous visitors may not view
- **THEN** the head and the dialog's preview MUST use the default description, and the linked box MUST say "Hidden from visitors"

#### Scenario: An author without public profiles

- **WHEN** anonymous visitors may not view user profiles
- **THEN** the Author fact MUST still be the author's display name, without access to the profile

#### Scenario: A private file

- **WHEN** a linked image field's file is in the private file system
- **THEN** the linked image MUST give nothing, the default image MUST be used, and the linked box MUST say "Private file: not shared"

#### Scenario: A file system declared public

- **WHEN** `settings.php` declares a read-only file system public in `file_additional_public_schemes` and a chosen image's file is on it
- **THEN** `og:image` MUST be that file's own address, with its own size

#### Scenario: Private files can't be declared public

- **WHEN** `settings.php` lists the private file system in `file_additional_public_schemes`
- **THEN** an image in private files MUST still give nothing

#### Scenario: A declared file system that is gone

- **WHEN** `file_additional_public_schemes` names a file system no module provides any more, and a chosen image's file record is on it
- **THEN** the image MUST give nothing and the page MUST still be served

### Requirement: Values follow the translation

For a translation, the Title and Description facts and every field link MUST be the translation's own. A referenced entity, a Canvas page's image and an image chosen as a media item (a social image, the logo, the default image), alt text included, MUST be taken in the page's language, or, when the entity lacks it, in the language Drupal falls back to when it shows that entity on the page. The dialog's image tiles MUST follow the same rule.

#### Scenario: A French translation

- **WHEN** the French translation of a page titled "Pricing" is titled "Tarifs"
- **THEN** the Title fact MUST be "Tarifs" in the French head

#### Scenario: A chosen image with a translated alt text

- **WHEN** a French page uses a social image whose media item has a French translation with its own alt text
- **THEN** `og:image:alt` MUST be that French alt text, and the dialog's Social tab MUST show it

#### Scenario: A language the media item lacks

- **WHEN** a German page uses that media item, which has no German translation, and the languages keep their default weights
- **THEN** `og:image:alt` MUST be the media item's default-language alt text

#### Scenario: An unpublished media translation

- **WHEN** the media item's French translation is unpublished
- **THEN** the French page MUST NOT use it, its image MUST be the next in the chain, and the dialog MUST say its French version is unpublished
