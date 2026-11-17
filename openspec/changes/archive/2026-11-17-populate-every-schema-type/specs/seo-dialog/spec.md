## ADDED Requirements

### Requirement: A nested object is one line that opens a sheet

A group of more than three parts MUST show as one summary box holding its
formatted line, or "Not set", with a chevron, named by its label and then
what it reads. Pressing it MUST open a sheet with a plain "Reads as" line
that says what the box says (a page named as the group, once), then the
parts in the shape's order. The sheet has no Save button. Its header MUST
offer Clear, or "Unlink all" on a template when every set part is linked;
either leaves focus on the sheet's title.

#### Scenario: A venue on an event page

- **WHEN** an editor presses the Venue box reading "Riverside Hall, Helsinki"
- **THEN** a sheet titled "Venue" MUST open with focus on its title, listing Name, Street address, Postal code, City, Region and Country in that order
- **AND** Escape MUST close it and return focus to the Venue box

#### Scenario: An address without a country

- **WHEN** a venue has a street and a city but no country
- **THEN** the Venue field MUST say "Add the country, so the address can be used." with an "Add" button named "Add Country", as the verdict's is, that opens the sheet on Country, and the sheet MUST say the same sentence once under "Reads as"

### Requirement: A group's sheet says what it misses once

What the group misses, and those of its values the page does not show, MUST
be said once under "Reads as", never under each part. While the group's page
reference is set, its own parts MUST wait folded under "Own details, if the
page has none", which reads them as the box would, or "Not set".

#### Scenario: A workplace page linked

- **WHEN** a builder opens the Workplace sheet with a workplace page linked
- **THEN** its own parts MUST be folded under "Own details, if the page has none", reading "Not set" and closed while none is set

### Requirement: What a group misses is said under it

What a group misses MUST be said under its box, in one sentence with what a
search feature asks more of it ("Add the city and the country for event
listings."). A jump to a missing part (Add in a verdict, Show in Checks, a
part of the sentence) MUST open the group's sheet with focus on that part's
own control, never its link button, and Back MUST return to where the jump
came from, else to the group's box.

#### Scenario: A country written as a name

- **WHEN** a venue's country is stored as "Finland", which the list does not hold
- **THEN** its box and its sheet MUST say "Choose the country from the list." with a "Choose" button, and the event result MUST read "Needs a country from the list"

#### Scenario: Add Country in the verdict

- **WHEN** an event's venue misses its country and the editor presses the verdict's "Add Country"
- **THEN** the Venue sheet MUST open with focus on Country

### Requirement: A part held back is set

In a verdict's proof, a part that is set but left out with its incomplete
group MUST read as its value and why it waits, never "Not set".

#### Scenario: A street without a city

- **WHEN** an event's venue has a name and a street, and no city or country
- **THEN** the event result's proof MUST read "Street address: Mannerheimintie 13e · left out until the address is complete", with Add only beside City and Country

### Requirement: A reference is chosen, never typed as data

An organizer, employer, author or the organization a person works for MUST
be one select: "Not set" where nothing is assumed, "‹Site› (this site)",
and "Someone else", which reveals a name and a website indented under it,
shown as "Name" and "Website" and named "‹Label› name" and "‹Label›
website". The site or a linked reference field MUST hide them. On a template
the choice MAY be linked to a reference field instead; the site chosen there
leaves focus on its linked box.

#### Scenario: Someone else organizes

- **WHEN** an editor chooses "Someone else" for the organizer
- **THEN** "Organizer name" and "Organizer website" MUST appear under it with focus on "Organizer name", and the organizer MUST be emitted with that name only once it is typed

### Requirement: Who nobody chose is said

An organizer or recipe author MUST default to the publisher on a Canvas
page, where the select has no "Not set"; choosing "Someone else" there MUST
be kept, so that the site is no longer assumed, and nothing is emitted until
a name is typed. Where nobody set it but a default names someone (an
article's author), "Not set" MUST read that name: "‹Name› (the page's
author)", and More details MUST name it first.

#### Scenario: Someone else, not named yet

- **WHEN** an editor of an event page chooses "Someone else" and types nothing
- **THEN** no organizer MUST be emitted, Checks MUST not say "The organizer is your site", and the choice MUST still read "Someone else" when the dialog opens again

#### Scenario: An article's author

- **WHEN** a page described as an article has no author set and its author is Ada Lovelace
- **THEN** the Author select MUST read "Ada Lovelace (the page's author)" and More details MUST start with "Author: Ada Lovelace"

### Requirement: A reference to another page is linked on a template

A reference to another page (a venue page, a workplace page) MUST be linked
to a reference field on a template. It is not offered on a Canvas page until
the page picker ships (`link-groups-and-pick-pages`); until then a page
pick is refused at save.

#### Scenario: A venue on a Canvas page

- **WHEN** an editor opens the Venue sheet of an event page
- **THEN** it MUST offer the venue's name and address, and no box for a venue page

### Requirement: Codes are picked from a searchable list

A country, a currency or another code list MUST open a picker with a "Find
a ‹thing›" filter matching the label, the code and the English name, an
exact code first. With no filter, the site's default MUST come first,
marked Suggested. Several codes MUST use checkbox rows that commit on each
toggle, announce the new total and keep their order while the list is open.
Six or fewer choices that are not codes MUST be checkbox rows in place.

#### Scenario: Who can apply from

- **WHEN** an editor ticks Estonia after Finland and Sweden
- **THEN** the screen reader MUST hear "Estonia selected, 3 chosen" and the footer MUST read "3 chosen · up to 50"

#### Scenario: A code typed

- **WHEN** an editor types "FI" in the country picker and presses Enter
- **THEN** Finland MUST be chosen, not Fiji, and focus MUST be on the Country box

### Requirement: A picker stays in its frame

A picker MUST never be taller than the room on its side of the box, with its
filter in sight and only its list scrolling. Picking one code MUST give the
box focus back.

#### Scenario: A short window

- **WHEN** the window is 350 px high and an editor opens the Country picker
- **THEN** the "Find a country" filter MUST be inside the dialog's frame

### Requirement: A duration is one box with two numbers

A duration MUST be one box with two number inputs and their unit words
(hours and minutes), with empty slots rather than zeros. Minutes past 59
MUST carry into hours when focus leaves the box, and the value is checked
only then: moving from hours to minutes never refuses it. Zero MUST be
refused with "Leave it empty if you don't know it.", more than 30 days with
"Use at most 30 days.". Each input MUST be named by the field and its unit.

#### Scenario: Ninety minutes typed

- **WHEN** an editor types 90 in the minutes of Prep time and leaves the field
- **THEN** it MUST read 1 h 30 min and store 90

### Requirement: A linked duration reads in its unit

A linked duration MUST read in its unit ("20 min"), and the question of what
its field counts MUST be a compact choice named by its time and what it
shows.

#### Scenario: Prep time linked

- **WHEN** a builder links Prep time to a field holding 20 for the previewed recipe
- **THEN** the box MUST read "20 min" and the choice beside it MUST be named "Prep time: the field counts minutes"

### Requirement: Opening hours are edited as a week

Opening hours MUST read as one grouped line with any special days counted,
and open a sheet that says the same line as "Reads as", then seven day rows,
each on one row: its name, its times, then a status select named
"‹Day› status" (Open, Closed, Open 24 hours). Its header MUST offer Clear. A
new week MUST be all closed, and opening a day MUST fill in no times. "Use for Tue–Fri" MUST
appear under Monday once Monday has both times and Tuesday to Friday are
closed.

#### Scenario: The weekday shortcut

- **WHEN** Monday is Open 09:00–17:00, Tuesday to Friday are closed and the editor presses "Use for Tue–Fri"
- **THEN** Tuesday to Friday MUST read Open 09:00–17:00, focus MUST be on Tuesday's status, and "Tuesday to Friday set to 09:00–17:00" MUST be said

#### Scenario: Overlapping times

- **WHEN** Monday has 09:00–13:00 and 12:00–17:00
- **THEN** the row MUST say "Times overlap." and nothing MUST be stored

### Requirement: The week never loses focus or its words

A button that takes itself away MUST hand focus on: "Use for Tue–Fri" to
Tuesday's status, adding a second range to its opening time, removing one
to that day's +, adding a special day to that day's status. At 200 % zoom a day's name MUST keep its word and its times
MUST stay in the frame.

#### Scenario: A second range

- **WHEN** an editor adds a second range on Monday, then removes it
- **THEN** focus MUST be on "Monday, second opens", then on "Add a second range on Monday"

### Requirement: Only what the scope can fill is offered

A Schema view MUST show only the facts its scope can fill. "Also helps"
lines MUST list only facts offered on that scope. A fact that belongs to
another fact ("Open to people in", under where the work is) MUST show
indented under it, and only while the answer calls for it. More details
MUST name a default the editor may need to change first ("Organizer: your
site, summary, 5 more"). At most four facts MUST come before More details; a
choice of who, and a detail shown under another, count as one.

#### Scenario: A recipe on a Canvas page

- **WHEN** a Canvas page is described as a recipe
- **THEN** the view MUST show no Ingredients or Steps field and no "Also helps" line for them

#### Scenario: A remote job

- **WHEN** every job of a type is fully remote
- **THEN** "Open to people in" MUST be under Where the work is, no Workplace MUST be shown, and at most four facts MUST come before More details

### Requirement: Where the work is is one question

A job posting MUST ask "Where the work is" with On site, Fully remote, and
On site or remote. On site and On site or remote MUST show the Workplace;
Fully remote and On site or remote MUST show "Open to people in". Its
guidance MUST belong to this one question.

#### Scenario: An on-site job

- **WHEN** a builder answers On site
- **THEN** the Workplace box MUST show and "Open to people in" MUST not

### Requirement: A detail a field fills is a box that opens the link menu

A detail only a field fills (a job description, or what each page has of its
own on a template) MUST be a box the size of an input reading "Link a
field…", named by its label, that opens the link menu.

#### Scenario: A job description

- **WHEN** a builder presses the Description box of Every Job posting
- **THEN** the link menu MUST open, listing the formatted text fields

### Requirement: A linked list says how many it gives

A list linked to a field of several values MUST read its first item and how
many more at rest.

#### Scenario: Ingredients linked

- **WHEN** Ingredients link to a field holding four ingredients for the previewed recipe
- **THEN** the box MUST read "500 g rye flour and 3 more"

### Requirement: A kind chosen is said until it can be one

While the main thing of a chosen kind is left out, the sentence MUST say so
after what it reads, in gray, naming what it needs.

#### Scenario: A job type chosen, not complete yet

- **WHEN** a builder chooses "A job posting" and nothing is linked yet
- **THEN** the sentence MUST end "Not a job posting yet: it needs a description and an employer." in gray, in the words Checks asks for them

## MODIFIED Requirements

### Requirement: An unknown stored kind is said

When the stored type is not in the registry, the view MUST show the notice
"This page was described as “‹type›”, which this site no longer knows. Search
engines get a plain web page." with "Choose what it is", and the kind field
MUST read "Not known: “‹type›”".

#### Scenario: A removed type

- **WHEN** a page's stored type is `Movie`
- **THEN** the notice MUST be shown and Checks MUST list one issue to improve
