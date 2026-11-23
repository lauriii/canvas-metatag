## MODIFIED Requirements

### Requirement: Checks describe the page or template being edited

Checks MUST be computed for the target, a page or a content type's template,
from the values the dialog shows, unsaved edits and Canvas's live page title
and description included. At template scope they MUST be about the node the
editor previews, named once on one line of the Checks sheet and called "this
‹type›" in its issues. A value, or a field of a composition, empty for the
previewed node MUST be stated as a fact, good to know and not counted. The Site
scope MUST have no checks of its own.

#### Scenario: Typing changes the checks

- **WHEN** an editor types a title that names the site twice
- **THEN** "Remove the repeated site name" MUST be listed before the change is saved

#### Scenario: A template is checked against its preview

- **WHEN** the dialog edits "Every Article" while the editor previews the article "Hello world"
- **THEN** the Checks sheet MUST say "Checked against Hello world", and a detail that would say "this page" MUST say "this article" instead

#### Scenario: A very long node title

- **WHEN** the editor previews an event whose title is 247 characters long
- **THEN** "Checked against" MUST fit on one line, ending with an ellipsis, with the whole title on hover, and no issue's sentence MUST repeat the title

#### Scenario: A value empty for the previewed node

- **WHEN** "Every Event"'s description is Title, " with ", Performers, and the previewed event has no performers
- **THEN** the issue MUST say "Performers is empty for this event", not "Fill in Performers", and be good to know, not counted in the Checks button; the same MUST hold for a field the title or the social texts hold

#### Scenario: A description linked to a field empty for the previewed node

- **WHEN** "Every Product"'s description is linked to SKU and the previewed product has no SKU and no description of its own
- **THEN** "SKU is empty for this product" MUST be listed as good to know, and "Add a description" MUST NOT be listed or counted

#### Scenario: A structured data property linked to a field empty for the previewed node

- **WHEN** "Every Event" links its Ends property to the field Ends and the previewed event has no end
- **THEN** the issue MUST say "Ends is empty for this event", be good to know, not counted, and "Also helps the event result: Ends." MUST NOT be listed

#### Scenario: Shown in search, not saved yet

- **WHEN** an editor clicks "Show in search results" on "Every Article" and the change is not saved yet
- **THEN** no noindex issue MUST be listed, so nothing says that hiding is set outside SEO: the check that a page is hidden by a setting outside SEO MUST NOT judge an unsaved change by the server's output for the values before it

#### Scenario: A template that is hidden from search

- **WHEN** "Every Article" is set to be hidden from search
- **THEN** the issue MUST say "Show this article in search"

#### Scenario: Site scope and loading

- **WHEN** the dialog shows the Site scope, or the editor's next page is still loading
- **THEN** the Checks button MUST NOT be shown

#### Scenario: Every field of a composition empty

- **WHEN** "Every Event"'s title is Venue › Title, " · ", Starts, and the previewed event has neither
- **THEN** the issue MUST say "Venue › Title and Starts are empty for this event, so the title is its default", good to know and not counted

### Requirement: A broken link is listed to fix

A value linked to a field that no longer exists or no longer fits MUST be
listed to fix as "Link the ‹field› again", and a field of a composition as
"Replace ‹machine name› in the ‹field›". The detail MUST name the lost field's
machine name and say what each item gets until it is replaced. The action
MUST be "Link another field" or "Replace field", which leads to the field and
opens its menu, with a composition's lost field selected.

#### Scenario: A deleted summary field

- **WHEN** the Article template's description is linked to `field_summary` and that field was deleted
- **THEN** "Link the description again" MUST be listed to fix, its detail MUST name `field_summary`, and "Link another field" MUST put focus in the description and open its link menu

#### Scenario: A deleted field in a composed title

- **WHEN** "Every Event"'s title is Title, " in ", City, and `field_city` was deleted
- **THEN** "Replace field_city in the title" MUST be listed to fix, its detail MUST say "It no longer exists, so each event's title leaves it out.", and "Replace field" MUST select it in the title and open "Replace field_city"

### Requirement: A link hidden from visitors is listed to improve

A value linked to a field that anonymous visitors may not view, alone or in a
composition, MUST be listed to improve as "‹Source› is hidden from visitors",
with Show and a detail that says what is used instead or left out. Links hidden
by one reference MUST be one row, "‹Reference› is hidden from visitors for this
‹type›", naming the affected values ("and N more" after two), advising to
publish it or preview another item. A link only empty for the item MUST NOT be
listed.

#### Scenario: A hidden field

- **WHEN** the Article template links the description to a field that anonymous visitors may not view
- **THEN** "Notes is hidden from visitors" MUST be listed to improve, for a field labelled Notes, leading to Description

#### Scenario: A hidden field in a composition

- **WHEN** "Every Event"'s title is Title, " · ", Notes, and visitors may not view Notes
- **THEN** "Notes is hidden from visitors" MUST be listed to improve, its detail MUST say "So it is left out of every event's title.", and Show MUST lead to Title

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

#### Scenario: A repeat from the Site name in a composition

- **WHEN** "Every Event"'s title is Title, " at ", Site name, and its ending is the inherited Site name
- **THEN** "Remove the repeat" MUST be offered and MUST set the template's title ending to "No ending"

#### Scenario: The site name typed in a composition

- **WHEN** "Every Event"'s title is Title, " – Example events", its ending is the inherited Site name, and the site is named "Example"
- **THEN** "Remove the repeat" MUST be offered and MUST set the template's title ending to "No ending"

### Requirement: Description rules

The checks MUST judge the resolved search description: whether it exists, fits,
and says more than the title.

#### Scenario: No description

- **WHEN** the resolved description is empty
- **THEN** "Add a description" MUST be listed to improve

#### Scenario: A long description

- **WHEN** the description may be cut off
- **THEN** "Shorten the description" MUST be listed as good to know

#### Scenario: Repeating the title

- **WHEN** the description equals the title without the site name, or one contains the other as whole words and the two differ by fewer than 20 letters, ignoring case and punctuation
- **THEN** "Make the description say more" MUST be listed to improve

#### Scenario: A description that holds the title

- **WHEN** "Every Event"'s description is Title, " in ", City, "." and its title is Title
- **THEN** "Make the description say more" MUST be listed to improve

#### Scenario: A description that names the title and goes on

- **WHEN** a page or a template is titled "Pricing" and its description is "Pricing for teams of every size, billed monthly or yearly, with every feature included and a free month to try it before you decide which plan fits."
- **THEN** "Make the description say more" MUST NOT be listed

## ADDED Requirements

### Requirement: Words typed in a composition are noted on a multilingual site

When the site has more than one language and a composition on the template
holds typed letters, Checks MUST note once per value, good to know and not
counted, that those words are the same in every language, whatever item is
previewed, with the detail "Translations of each ‹type› keep these words." No
fix MUST be offered.

#### Scenario: A multilingual site

- **WHEN** "Every Event"'s title is Title, " in ", City, on a site with English and French
- **THEN** "The words typed in the title are the same in every language" MUST be listed as good to know, with the detail "Translations of each event keep these words."

#### Scenario: Punctuation only

- **WHEN** the title is Title, " · ", City
- **THEN** nothing MUST be listed about its words

### Requirement: Checks help write a good composition

Checks MUST list to improve, for a composition on a template: a description
mostly made of typed letters; a title main part whose lead-in holds letters; a
composed name or headline detail of the item itself that holds the Site
name, or a date when the type has a date detail other than its publication date. When "Shorten the title" finds the
cut inside a composed main part, its detail MUST name the field that is cut.

#### Scenario: A boilerplate description

- **WHEN** "Every Event"'s description is Title, ". Book tickets for the best events in town with free delivery!", so that typed letters are more than half of its result
- **THEN** "Most of this description is the same on every event" MUST be listed to improve

#### Scenario: A lead-in before the title

- **WHEN** "Every Event"'s title is "Tickets: ", Title
- **THEN** "Start the title with what differs per event" MUST be listed to improve

#### Scenario: A date in an event's name

- **WHEN** "Every Event"'s name detail is Title, " · ", Starts
- **THEN** "Keep the date out of the event's name" MUST be listed to improve, with the detail "Starts already gives it."

#### Scenario: A cut inside the composition

- **WHEN** the title is Title, " · ", Starts, and it may be cut off inside the date
- **THEN** the detail of "Shorten the title" MUST say "Starts is cut off."

### Requirement: A composed detail is looked for on the page field by field

A composed detail MUST NOT be looked for on the page as joined text: each of
its fields that gives a value MUST be looked for on its own (a date in any of
its written forms, a field of several values by its first item too), typed
words never, and only the fields not found MUST be named, with their values.
A field another detail holds whole MUST be named by that detail only, once.

#### Scenario: A composed name whose fields are on the page

- **WHEN** "Every Event"'s name detail is Title, " with ", Performers, and the page shows the title and each performer but never the joined text
- **THEN** no "Couldn't find" issue MUST be listed for the name

#### Scenario: A field of a composed name not on the page

- **WHEN** the name detail is Title, " in ", City, and the page never mentions "Helsinki"
- **THEN** "Couldn't find City (Helsinki) on this page" MUST be listed to improve

#### Scenario: A date in a composed name and in its own detail

- **WHEN** "Every Event"'s name detail is Title, " · ", Starts, its start date detail is Starts, and the page never shows the date
- **THEN** only the start date detail MUST say "Couldn't find the date …", never the name too
