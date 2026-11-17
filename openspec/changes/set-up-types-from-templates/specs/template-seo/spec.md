## ADDED Requirements

### Requirement: An unset type is proposed from what its template shows

On the first visit to a type without structured data settings, the Schema
view MUST propose a kind and links taken from the fields the template shows,
each with its reason, in a band with "Use it" and "Review…". "Use it" MUST
store only links to fields the template shows; the band MUST name each field
it leaves out.

#### Scenario: The Article template

- **WHEN** the Article template shows Title in a heading, Image in a hero and the published date, but not Writer
- **THEN** the band MUST read "Headline from Title, image from Image, dates from each article. Writer isn't shown by the template, so the author is left out."

#### Scenario: Use it

- **WHEN** the editor presses "Use it"
- **THEN** the template draft MUST hold the kind and the three links and no author link

#### Scenario: Review

- **WHEN** the editor opens "Review…"
- **THEN** every proposed link MUST be listed with its reason, the author link unticked and marked "not shown by the template"

### Requirement: Type verdicts count every published item

At type scope, each feature line MUST state how many published items of the
type it holds for ("Can show on 175 of 212"), and facts that help MUST get a
gray "Also helps" row with how many items lack them. Counts MUST use the
template's draft values, each item's own fields and what anonymous visitors
may see. Above 2,000 items the counts MAY come from a sample and MUST say so.

#### Scenario: Authors missing on some articles

- **WHEN** 37 of 212 published articles have no Writer
- **THEN** the stage MUST show "Also helps · Author on 175 · 37 have none" with "Preview one", in gray

#### Scenario: A large type

- **WHEN** the type has 12,000 published items
- **THEN** the counts MUST read as approximate and say "Counted from a sample of 500"

#### Scenario: Counting is not repeated on every edit

- **WHEN** the editor changes a component in the Canvas template editor without changing the type's structured data values
- **THEN** the counts MUST NOT be recomputed

### Requirement: Preview one shows an item that fails

"Preview one" MUST switch the dialog's previewed item to one of the items
counted as failing, in the dialog only, with "Back" to the previous item.

#### Scenario: One of the 37

- **WHEN** the editor presses "Preview one" on the author row
- **THEN** the caption MUST read "Previewing ‹title› · 1 of 37 without a writer" and the sentence MUST say "No author."

### Requirement: Per-item facts are not typed once for every item

When a fact that differs per item (name, headline, dates, price, image) is
typed as one value at type scope, every feature that needs it MUST read
"Needs a ‹fact› per ‹item›" with no count, and the field MUST offer to link
it.

#### Scenario: One name for every product

- **WHEN** the Product type's name is typed as "Oak desk lamp"
- **THEN** "Product result" MUST read "Needs a name per product" and the Name field MUST say "The same name on every Product. Link it to a field instead." with "Link to Title"

#### Scenario: A composed name

- **WHEN** the Event type's name is composed as Title, " · ", Starts
- **THEN** it MUST count as set per item, and nothing MUST say "The same name on every Event"

### Requirement: Reach shows the spread of a composed title's length

At type scope, when the title's main part is a composition that holds a field,
the length guidance MUST add the range of the full title's length across the
published items reach counted.

#### Scenario: Titles that vary

- **WHEN** "Every Event"'s title is Title, " in ", Venue › City, and the published events' titles run from 38 to 71 characters
- **THEN** the title's length guidance MUST add "38–71 characters on other events"
