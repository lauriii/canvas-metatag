## ADDED Requirements

### Requirement: Stop date rules

The checks MUST say when a published target's stop date has passed, as a fix
that removes the stop date, and when a stop date is still ahead, as good to
know. A template's rule MUST use the date of the node it previews.

#### Scenario: A passed stop date

- **WHEN** a published page's stop date is 1 Mar 2026 and today is later
- **THEN** "Remove the stop date" MUST be listed to fix, saying the page stopped showing in search on 1 Mar 2026, with the fix "Remove the stop date"

#### Scenario: A stop date ahead

- **WHEN** a page's stop date is 12 Mar 2027 and today is earlier
- **THEN** "Stops showing on 12 Mar 2027" MUST be listed as good to know

### Requirement: AI use is not read before its date

Until 1 Feb 2027, when the target's effective AI answers or AI training is not
"Allowed", the checks MUST list as good to know that AI use is read from that
date. The date MUST be one constant in the dialog.

#### Scenario: Before the date

- **WHEN** a page sets AI training "Not allowed" on 13 Nov 2026
- **THEN** "AI use is read from 1 Feb 2027" MUST be listed as good to know, and nothing MUST be counted

#### Scenario: After the date

- **WHEN** the same page is checked on 2 Feb 2027
- **THEN** that row MUST NOT be listed

### Requirement: Tags from the Metatag module are reported

When the target's head carries tags that come from the Metatag module, the
checks MUST list once, as good to know, how many and which, with a way to the
Output sheet.

#### Scenario: One tag from Metatag

- **WHEN** a page's head carries a theme colour from Metatag's defaults
- **THEN** "1 tag comes from the Metatag module" MUST be listed as good to know, naming `theme-color`

### Requirement: Verification missing from the home page is reported

When the site has verification codes and the front page is not a route the
module owns, the checks MUST say, as good to know and only to people who may
administer site settings, that the codes are not on the home page.

#### Scenario: A front page from Views

- **WHEN** an administrator opens Checks on a page, the site has a code and the front page is a Views page
- **THEN** "Verification codes are not on the home page" MUST be listed as good to know

#### Scenario: An editor without the site permission

- **WHEN** an editor without the administrative permission opens the same Checks
- **THEN** that row MUST NOT be listed

### Requirement: A Metatag default image is offered as the site's image

When Metatag's global defaults hold an `og:image` that owned pages no longer carry, site administrators MUST see, as good to know, that the module shares its own images, with "Use it for pages without an image", which selects "Use this image" in Site › Sharing with that image when it is a media item, and otherwise leads there.

#### Scenario: A site that relied on Metatag's image

- **WHEN** Metatag's global defaults hold an `og:image` from a media item and the module is enabled
- **THEN** a site administrator MUST see the row, and its action MUST select that image in Site › Sharing without saving
