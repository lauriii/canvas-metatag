## ADDED Requirements

### Requirement: A nested object is one line that opens a sheet

A group of more than three parts MUST show as one summary box holding its
formatted line, or "Not set", with a chevron. Pressing it MUST open a sheet
with a plain "Reads as" line, then the parts in the shape's fixed order. The
sheet MUST have no Save button: parts commit like any field. Its header MUST
offer Clear, or "Unlink all" on a template when every set part is linked.

#### Scenario: A venue on an event page

- **WHEN** an editor presses the Venue box reading "Riverside Hall, Helsinki"
- **THEN** a sheet titled "Venue" MUST open with focus on its title, listing Name, Street, Postal code and City, Region and Country in that order
- **AND** Escape MUST close it and return focus to the Venue box

#### Scenario: An address without a country

- **WHEN** a venue has a street and a city but no country
- **THEN** the Venue field MUST say "Add the country, so the address can be used." with an "Add country" button that opens the sheet on Country

### Requirement: A reference is chosen, never typed as data

On a Canvas page a reference MUST be a select offering the publisher ("‹Site›
(this site)"), for places "A ‹venue› page", and "Someone else", which reveals
Name and, where the property has one, Website. A page picker MUST list only
published, publicly viewable pages described as an accepted kind. An
organizer, employer or recipe author MUST default to the publisher on a
Canvas page.

#### Scenario: Picking a venue page

- **WHEN** an editor chooses "A venue page" and picks "Riverside Hall"
- **THEN** the Venue box MUST read the page's name and town, and the event MUST reference that page's main node

#### Scenario: Someone else organizes

- **WHEN** an editor chooses "Someone else" for the organizer
- **THEN** focus MUST move to Name, and the organizer MUST be emitted with that name only once it is typed

### Requirement: Codes are picked from a searchable list

A country or other code list MUST open a picker with a "Find a ‹thing›"
filter matching the label, the code and the English name, suggested rows
first. Several codes MUST use checkbox rows that commit on each toggle and
announce the new total. A list of six or fewer choices that are not codes
MUST be checkbox rows in place, with no popover.

#### Scenario: Who can apply from

- **WHEN** an editor ticks Estonia after Finland and Sweden
- **THEN** the screen reader MUST hear "Estonia selected, 3 chosen" and the footer MUST read "3 chosen · up to 50"

#### Scenario: Varies by

- **WHEN** a builder opens the Variants sheet
- **THEN** Colour, Size, Material and Pattern MUST be checkbox rows, and ticking Colour MUST show a Colour field under them

### Requirement: A duration is one box with two numbers

A duration MUST be one box with two number inputs and their unit words
(hours and minutes, or minutes and seconds), with empty slots rather than
zeros. Minutes past 59 MUST carry into hours on blur. Zero MUST be refused
with "Leave it empty if you don't know it." Each input MUST be named by the
field and its unit.

#### Scenario: Ninety minutes typed

- **WHEN** an editor types 90 in the minutes of Prep time and leaves the field
- **THEN** it MUST read 1 h 30 min and store 90

### Requirement: Opening hours are edited as a week

Opening hours MUST read as one grouped line with any special days counted,
and open a sheet of seven day rows, each with a status select named
"‹Day› status" (Open, Closed, Open 24 hours) and times. A new week MUST be
all closed, and opening a day MUST fill in no times. "Use for Tue–Fri" MUST
appear once Monday has both times and Tuesday to Friday are closed.

#### Scenario: The weekday shortcut

- **WHEN** Monday is Open 09:00–17:00, Tuesday to Friday are closed and the editor presses "Use for Tue–Fri"
- **THEN** Tuesday to Friday MUST read Open 09:00–17:00

#### Scenario: Overlapping times

- **WHEN** Monday has 09:00–13:00 and 12:00–17:00
- **THEN** the row MUST say "Times overlap." and nothing MUST be stored

### Requirement: Only what the scope can fill is offered

A Schema view MUST show only the facts its scope can fill. "Also helps"
lines MUST list only facts offered on that scope. A fact that belongs to
another fact (who can apply, under where the work is) MUST show as a line
under it. More details MUST name a default the editor may need to change
first ("Organizer (your site), status and 3 more").

#### Scenario: A recipe on a Canvas page

- **WHEN** a Canvas page is described as a recipe
- **THEN** the view MUST show no Ingredients or Steps field and no "Also helps" line for them

#### Scenario: A remote job

- **WHEN** every job of a type is fully remote
- **THEN** "Open to people in ‹countries› · Change" MUST be a line under Where the work is, and at most four facts MUST come before More details

### Requirement: Linked pairs stack and show their reading

When either half of a pair is linked, the pair MUST stack. A linked value
MUST show "raw → reading" only when the reading converts the raw value, and
the reading alone otherwise. A tag MUST drop a parent shared by the pair or
group, keeping the full path in its tooltip.

#### Scenario: Linked prep and cook times

- **WHEN** Prep time and Cook time link to Prep minutes (20) and Cook minutes (55)
- **THEN** they MUST stack, reading "20 min" and "55 min"

#### Scenario: A linked price

- **WHEN** a price links to a decimal field holding 4200.00 and the currency is EUR
- **THEN** the box MUST read "4200.00 → €4,200"

## MODIFIED Requirements

### Requirement: An unknown stored kind is said

When the stored type is not in the registry, the view MUST show the notice
"This page was described as “‹type›”, which this site no longer knows. Search
engines get a plain web page." with "Choose what it is", and the kind field
MUST read "Not known: “‹type›”".

#### Scenario: A removed type

- **WHEN** a page's stored type is `Movie`
- **THEN** the notice MUST be shown and Checks MUST list one issue to improve
