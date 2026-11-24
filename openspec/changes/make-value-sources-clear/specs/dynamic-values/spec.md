## MODIFIED Requirements

### Requirement: Values are what an anonymous visitor may see

Every value that comes from published content MUST be what an anonymous visitor
may see, whoever asks. A field, referenced entity, media item or file that
visitors may not view MUST give nothing, so the value falls back to its
default, and the dialog's read-out MUST say "Hidden from visitors" and what is
used instead. An image MUST be a file in the public file system. The Author
fact MUST need only the right to view the account's label, not the profile.

#### Scenario: A field visitors cannot view

- **WHEN** a template links the description to a field that anonymous visitors may not view
- **THEN** the head and the dialog's preview MUST use the default description, and the description's read-out MUST say "Hidden from visitors for this article, so its default description is used."

#### Scenario: An author without public profiles

- **WHEN** anonymous visitors may not view user profiles
- **THEN** the Author fact MUST still be the author's display name

#### Scenario: A private file

- **WHEN** a linked image field's file is not in the public file system
- **THEN** the linked image MUST give nothing and the default image MUST be used

### Requirement: Fields read as words in text

In a value that can be composed, a date field, a timestamp Canvas offers as a
number, or a date fact MUST give its date without the time, in the long style
of the item's locale (its language with its region, else the site's country),
in the site's timezone; a date-only field MUST never move a day. An integer
MUST give its digits, a decimal its digits to its scale in the locale's marks,
a text list its label in the item's language. The dialog MUST show the
server's words.

#### Scenario: A date in a title

- **WHEN** an event's Starts is 20 June 2026 at 19:00 in Europe/Helsinki, the title holds Starts, and the site's default country is the United Kingdom
- **THEN** the English title MUST hold "20 June 2026", and the title of its French translation "20 juin 2026"

#### Scenario: The site's country

- **WHEN** the same event is on a site whose default country is the United States
- **THEN** the English title MUST hold "June 20, 2026"

#### Scenario: Other languages

- **WHEN** the event has German, Finnish and Japanese translations
- **THEN** their titles MUST hold "20. Juni 2026", "20. kesäkuuta 2026" and "2026年6月20日"

#### Scenario: A date-only field in another timezone

- **WHEN** the site's timezone is America/Los_Angeles, its country the United Kingdom, and a date-only field holds 2026-07-01
- **THEN** a title that holds it MUST read "1 July 2026"

#### Scenario: A decimal

- **WHEN** a product's Price, a decimal field of scale 2, holds 1234.50 and the description holds Price
- **THEN** the description MUST hold "1,234.50" in English and "1.234,50" in German, and follow the region for `de-ch` and `pt-br`

#### Scenario: A year

- **WHEN** a book's Year, an integer field, holds 2026 and the title holds Year
- **THEN** the title MUST hold "2026", never "2,026"

#### Scenario: A timestamp offered as a number

- **WHEN** Canvas offers Venue › Authored on as a number, the title holds it, and the venue was created on 20 June 2026
- **THEN** the title MUST hold "20 June 2026", never the timestamp's digits
- **AND** where Canvas offers no timestamp (today it offers neither a timestamp field nor a hop's Authored on on the fixture's types), the menu MUST NOT list one, and the contract test MUST end incomplete, named, rather than pass

#### Scenario: A list label in the item's language

- **WHEN** the dialog's language is English, the previewed event is French, and the description holds Event status
- **THEN** the description, in the dialog and in the head, MUST hold the French label

#### Scenario: One way of writing a date in the dialog

- **WHEN** the site has no country, the previewed English event starts on 19 June 2027 at 19:00, and its title holds Starts
- **THEN** the composed title, its menu row and the Starts detail's read-out MUST all write the date "June 19, 2027", the read-out adding its time
