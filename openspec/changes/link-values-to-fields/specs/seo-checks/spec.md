## ADDED Requirements

### Requirement: A broken link is listed to fix

A value linked to a field that no longer exists or no longer fits MUST be
listed to fix as "Link the ‹field› again", with a detail that names the lost
field's machine name and says that each item uses its default until another
field is linked. Its action MUST be "Link another field", which leads to the
field and opens its link menu.

#### Scenario: A deleted summary field

- **WHEN** the Article template's description is linked to `field_summary` and that field was deleted
- **THEN** "Link the description again" MUST be listed to fix, its detail MUST name `field_summary`, and "Link another field" MUST put focus in the description and open its link menu

### Requirement: A link hidden from visitors is listed to improve

A value linked to a field that anonymous visitors may not view MUST be listed
to improve as "‹Source› is hidden from visitors", with a detail saying that
the default is used instead and to link a field visitors can see, and with
Show. A link that is only empty for the previewed item MUST NOT be listed.

#### Scenario: A hidden field

- **WHEN** the Article template links the description to a field that anonymous visitors may not view
- **THEN** "Notes is hidden from visitors" MUST be listed to improve, for a field labelled Notes, leading to Description

#### Scenario: Empty for this article

- **WHEN** the description is linked to Summary and the previewed article has no summary
- **THEN** no issue about the link MUST be listed

## MODIFIED Requirements

### Requirement: One-click fixes only where the result is certain

A fix MUST be offered only for a value set on the target itself, or by setting
the target's own title ending, and only while the target can be written.
Applying it MUST be an ordinary edit: saved like typing, and undoable from the
action bar, which names what was done. After a fix in the sheet, focus MUST
move to the next row's first button, else to the summary.

#### Scenario: Remove the repeat

- **WHEN** the page's own title is "Example pricing", its ending is the inherited Site name, and the site is named "Example"
- **THEN** "Remove the repeat" MUST set the page's title ending to "No ending", the row MUST go away, and the bar MUST say "Repeat removed" with Undo

#### Scenario: Separators left behind

- **WHEN** "Remove the repeat" has been applied to that page
- **THEN** the title MUST be "Example pricing", with no separator at its end

#### Scenario: Show in search results

- **WHEN** the page's own noindex hides a published page
- **THEN** "Show in search results" MUST turn the page's noindex off

#### Scenario: Allow text previews

- **WHEN** the page itself turns text previews off, by nosnippet or a limit of zero
- **THEN** "Allow text previews" MUST turn nosnippet off and remove the limit

#### Scenario: Allow large previews

- **WHEN** the page itself sets image previews to standard or none
- **THEN** "Allow large previews" MUST set them to large

#### Scenario: A value inherited from the site

- **WHEN** noindex, nosnippet or the image preview size comes from the site's defaults
- **THEN** the issue MUST NOT offer a fix

#### Scenario: A repeat that comes from a dynamic value

- **WHEN** the site name is repeated only because a template's main part is linked to the Title fact and the previewed node's title contains the site name
- **THEN** the issue MUST NOT offer a fix

#### Scenario: Read-only

- **WHEN** the target is read-only
- **THEN** no one-click fix MUST be shown, in the sheet or under a field

### Requirement: Title rules

The checks MUST judge the resolved search title: whether it exists, says
something, repeats the site name, matches the main heading, and fits. Comparing
text MUST ignore case and punctuation. When the title may be cut off inside its
ending, the detail MUST say that the ending is the part that gets lost.

#### Scenario: No title

- **WHEN** the resolved title is empty
- **THEN** "Add a title" MUST be listed to fix

#### Scenario: A generic title

- **WHEN** content in a language whose code starts with "en" has a title that, without the site name and separators, is "home", "homepage", "untitled", "page", "new page" or "welcome"
- **THEN** "Make the title specific" MUST be listed to improve

#### Scenario: Generic titles outside English

- **WHEN** a Finnish page is titled "Home"
- **THEN** "Make the title specific" MUST NOT be listed

#### Scenario: The site name twice

- **WHEN** the site name appears twice in the resolved title
- **THEN** "Remove the repeated site name" MUST be listed to improve

#### Scenario: Title and heading differ

- **WHEN** the preview has exactly one main heading, neither it nor the title contains the other, and they share no word
- **THEN** "Match the title to the main heading" MUST be listed to improve

#### Scenario: A heading that shares a word

- **WHEN** the title is "Team plans" and the main heading "Plans for teams"
- **THEN** "Match the title to the main heading" MUST NOT be listed

#### Scenario: Short words

- **WHEN** a Latin-script title and heading share only words under four letters
- **THEN** they MUST count as sharing no word, while in other scripts two characters MUST count as a word

#### Scenario: Several main headings

- **WHEN** the preview has two main headings
- **THEN** the title MUST NOT be compared with either

#### Scenario: A long title

- **WHEN** the title may be cut off on desktop or on phones
- **THEN** "Shorten the title" MUST be listed as good to know, with the last words that fit

#### Scenario: Text that cannot be measured

- **WHEN** the dialog cannot measure text
- **THEN** "Shorten the title" MUST NOT be listed

#### Scenario: The ending is cut off

- **WHEN** the title may be cut off after its main part, inside the ending "Journal"
- **THEN** the detail of "Shorten the title" MUST say "The ending “Journal” is the part that gets lost."

### Requirement: Structured data rules

The checks MUST judge the page's structured data: required and recommended
details the server reports missing, dates in the wrong order, and typed text
that is not on the page.

#### Scenario: A required detail is missing

- **WHEN** an Event has no start date
- **THEN** "Add Starts" MUST be listed to fix, saying Event details are left out until it is filled in, and leading to that detail in the Schema tab

#### Scenario: Recommended details are missing

- **WHEN** an Event has no end date and no venue
- **THEN** one row "Event is missing: Ends, Venue." MUST be listed to improve

#### Scenario: Dates in the wrong order

- **WHEN** an article's "Updated" is before its "Published", or an event's "Ends" before its "Starts", after linked values are resolved
- **THEN** that MUST be listed to improve

#### Scenario: A venue that is not on the page

- **WHEN** an Event's venue is typed as "The New Mill" and the page never mentions it
- **THEN** "Check Venue" MUST be listed to improve

#### Scenario: What is not compared with the page

- **WHEN** a detail is linked to a fact or a field, has a fixed format such as a currency, or is not text
- **THEN** it MUST NOT be compared with the page's text

## REMOVED Requirements

### Requirement: Empty dynamic values are reported once

**Reason**: A link that is empty for an item now gives the field's default,
which the dialog shows as guidance under the field. It is no longer an issue.
Links that cannot work are reported as broken or hidden instead.

**Migration**: None. See "A broken link is listed to fix" and "A link hidden
from visitors is listed to improve".
