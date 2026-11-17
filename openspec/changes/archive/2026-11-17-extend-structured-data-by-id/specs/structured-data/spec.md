## ADDED Requirements

### Requirement: Details can be added to the module's own nodes

A page or template MAY add JSON details to its main node or page node, and
the site to its identity, matched by `@id`. Added details MUST be validated
like custom JSON-LD, share its 32 KB limit, and merge into the node at any
depth. They MUST NOT change the node's `@id` or `@type`, except to add a type
to a list that keeps the type the node is output with: the kind of place
chosen for a local business, the registry's type otherwise, and the
identity's kind for the site's identity.

#### Scenario: Details inside an offer

- **WHEN** a product adds `{"sku": "OAK-DL-01", "offers": {"itemCondition": "https://schema.org/NewCondition"}}`
- **THEN** the Product node MUST carry the SKU and its offer the item condition, next to the price it already had

#### Scenario: A restaurant

- **WHEN** a local business page's kind of place is Restaurant and its added details set `"@type": ["Restaurant", "Store"]`
- **THEN** the save MUST be accepted, and `["LocalBusiness", "Store"]` MUST be refused

#### Scenario: Changing the type

- **WHEN** added details set `"@type": "Service"` on a product
- **THEN** the save MUST be refused with a message that the type can only be added to

### Requirement: The page's own values win per leaf

Where added details set a value the module emits, from a field, a fact, a
component, Search, Social or the site, the module's value MUST be kept, the
other added values MUST still merge, and the clash MUST be reported with its
path.

#### Scenario: A price from the Price field

- **WHEN** added details set `offers.price` to 79 and `offers.shippingDetails`, and the Price field holds 89
- **THEN** the offer MUST keep 89, carry the shipping details, and report a clash at `offers.price`

### Requirement: Added details can reach items of a list

For a list the module emits, added details MUST name `‹list›[*]` to merge into
every item or `‹list›[name=‹name›]` to merge into the item with that name. A
selector that matches no item MUST be reported.

#### Scenario: One plan

- **WHEN** a service with three offers adds `{"offers[name=Growth]": {"eligibleQuantity": 5}}`
- **THEN** only the Growth offer MUST carry it

#### Scenario: No such plan

- **WHEN** the selector is `offers[name=Pro]` and no offer is named Pro
- **THEN** nothing MUST merge and the report MUST name the selector

### Requirement: A hand-added item can be the page's main thing

When a page is a plain web page, the editor MAY mark one hand-added item as
what the page is mainly about. The page node MUST then reference it as
`mainEntity` and the item MUST carry `mainEntityOfPage` pointing at the page
node. With any other kind the mark MUST be ignored and reported.

#### Scenario: A recipe added by hand

- **WHEN** a web page marks its hand-added `#x-recipe` item as its main thing
- **THEN** the page node's `mainEntity` MUST be `{"@id": "‹url›#x-recipe"}`

### Requirement: Hand-added JSON-LD is stored as written

Custom JSON-LD and added details MUST be stored as sent, trimmed, without
reordering keys or changing spacing. Their 32 KB limit MUST be counted
together on the minified encoding, and the text as sent MUST NOT exceed
64 KB. A value whose decoded form can't be encoded for output MUST be
refused. A refusal MUST keep its sentence and add the item and path it is
about.

#### Scenario: Key order is kept

- **WHEN** an editor saves `{"@type": "Rating", "ratingValue": 4.5, "bestRating": 5}` with two-space indents
- **THEN** reading it back MUST give the same text, byte for byte

#### Scenario: Spaces don't count

- **WHEN** hand-added JSON-LD is 31 KB minified and 40 KB as formatted
- **THEN** it MUST be accepted

#### Scenario: A number that can't be output

- **WHEN** an editor saves `{"@type": "Rating", "ratingValue": 1e400}`
- **THEN** the save MUST be refused with "ratingValue: this number is too large to use." and the error MUST name item 0 and the path `/ratingValue`

### Requirement: A pasted context and lists of types are accepted

A top-level item MAY carry a schema.org `@context` (http or https, with or
without a trailing slash, as a string, an `@vocab` object or a list), which
MUST be accepted and left out of the output. Any other context MUST be
refused. `@type` MAY be a list of one to four strings, which MUST be output
as written.

#### Scenario: A snippet from a generator

- **WHEN** an editor saves `{"@context": "https://schema.org", "@type": "Organization", "name": "Acme Logistics"}`
- **THEN** it MUST be stored as written and the graph MUST carry the organization with no `@context` of its own

#### Scenario: Two types

- **WHEN** an item's `@type` is `["Restaurant", "Store"]`
- **THEN** it MUST be accepted and output with both types

#### Scenario: Another vocabulary

- **WHEN** an item's `@context` is `{"@vocab": "https://example.org/terms/"}`
- **THEN** the save MUST be refused with "Only “@type”, “@id” and a schema.org “@context” may start with @."

### Requirement: The module's ids are reserved

The module MUST keep one list of the ids it emits, each anchored on the home
or the page address. A top-level hand-added item MUST NOT take an id on the
list, and two top-level hand-added items MUST NOT share an id; such a save
MUST be refused with the id named. An update MUST rename such ids stored
before this rule, rewriting references to them, without changing any page's
output.

#### Scenario: The page's own id

- **WHEN** an editor saves a hand-added item with the `@id` `#webpage`
- **THEN** the save MUST be refused with "“#webpage” is made by this page. Use Add details, or give the item another @id."

#### Scenario: Two items with one id

- **WHEN** two hand-added items both use the `@id` `#acme`
- **THEN** the save MUST be refused with "“#acme” is used by two items. Give the second another @id."

#### Scenario: An id stored before the rule

- **WHEN** a page stored a hand-added `Organization` with `@id` `#identity` and a review pointing at it before the update
- **THEN** after the update the item MUST be `#identity-2`, the review MUST point at `#identity-2`, and the update's output MUST list the page

### Requirement: Short ids point at the site's own items

In hand-added JSON-LD and added details, `#identity`, `#logo`, `#website`
and `#return-policy` MUST resolve to the site's own ids on the home address
from every page. Other `#name` ids MUST resolve on the page's address, as
before. A reference to a module id whose node is not in the graph MUST be
removed and reported.

#### Scenario: The site as author, from another page

- **WHEN** a hand-added review on `/about` has `"author": {"@id": "#identity"}`
- **THEN** its author MUST be `{"@id": "{home}#identity"}`

### Requirement: Whole values fill from fields and media

A hand-added string that is exactly `{media.‹uuid›}` MUST be filled with the
media file's public address. On a template, a string that is exactly
`{field.‹name›}` or `{field.‹name›.‹name›}` MUST be filled from that field
of the item being output, as plain text, through the same field sources as
other links. A value MUST be a number only when the field stores numbers and
the name expects one.

#### Scenario: A score from a number field

- **WHEN** a Book review template's hand-added `reviewRating.ratingValue` is `"{field.field_score}"` and the review's Score is 4.5
- **THEN** that review's output MUST have `"ratingValue": 4.5`

#### Scenario: An image from the media library

- **WHEN** a hand-added `image` is `"{media.‹uuid›}"` of a published image
- **THEN** the output MUST carry the absolute public address of its file

### Requirement: Linked dates carry an offset

A date and time filled from a field MUST be output in the site's time zone
with its offset. A date-only field MUST be output as `YYYY-MM-DD`.

#### Scenario: An event start from a datetime field

- **WHEN** the site's zone is Europe/Helsinki and `startDate` is `"{field.field_starts}"` holding 10 July 2026, 06:30 UTC
- **THEN** the output MUST be `"2026-07-10T09:30:00+03:00"`

### Requirement: An empty fill leaves out only what it empties

When a filled value is empty, hidden from visitors or gone, it MUST be left
out. An object left with nothing but `@type`, `@id`, `bestRating` or
`worstRating` MUST be left out; empty list elements and empty lists MUST be
left out; a top-level item MUST be left out only when nothing but `@type`
and `@id` is left. Each MUST be reported with its path.

#### Scenario: A review without a score

- **WHEN** a Book review template's `reviewRating` holds `"{field.field_score}"` and `"bestRating": 5`, and a review has no Score
- **THEN** that review's output MUST keep the review without `reviewRating`, and the report MUST name `reviewRating.ratingValue`

#### Scenario: One of two profiles empty

- **WHEN** `sameAs` is `["{field.field_site}", "{field.field_social}"]` and the social field is empty
- **THEN** `sameAs` MUST hold only the site address

### Requirement: Structured data output stays bounded

A text value filled from a field MUST be cut at 5,000 characters at a word
boundary. When the structured data would exceed 256 KB, hand-added items and
added details MUST be left out, the module's own nodes MUST still be output,
and the report MUST say so.

#### Scenario: A long body linked to articleBody

- **WHEN** a hand-added `articleBody` is linked to a body of 40,000 characters
- **THEN** the output MUST carry at most 5,000 characters, ending at a word, and the report MUST name the value

### Requirement: The schema.org vocabulary is downloaded by the site

The module MUST NOT ship schema.org's vocabulary. A Drush command MUST
download the module's pinned release over https into the site's files,
trimmed, with its source, release, licence and attribution. The dialog MUST
read it only from the module's route, and the status report MUST name the
installed release and any newer pinned one.

#### Scenario: Not downloaded

- **WHEN** no vocabulary is installed
- **THEN** the route MUST answer 404 and the dialog's state MUST report the vocabulary as absent

#### Scenario: Downloaded

- **WHEN** an administrator runs `drush canvas-metatag:vocabulary`
- **THEN** the trimmed file MUST be in the site's files with its licence and attribution, and the dialog's state MUST report its release

## MODIFIED Requirements

### Requirement: Custom JSON-LD is validated when saved

Custom JSON-LD MUST be refused when it is not valid JSON, is not one object
or a list of up to 10 objects each with a `@type`, nests deeper than 8
levels, contains `null` or a number that can't be output, has a key other
than `@type`, `@id` and `@context` starting with `@`, has an `@id` that is
neither an absolute http(s) URL nor a `#name`, or has a string (an `@type`
too) that starts with a script scheme, or with a data or file scheme
followed by more text; tabs and line breaks before the colon don't hide a
scheme. It MUST be checked again when read; a stored item it refuses MUST
be left out of the output and the others kept.

#### Scenario: A script address

- **WHEN** an editor saves custom JSON-LD with `"sameAs": ["javascript:alert(5)"]`
- **THEN** the save MUST be refused with "sameAs: text can't start with “javascript:”."
- **AND** the same MUST hold for `vbscript:`, `data:text/html,x` and `file:///etc`

#### Scenario: A scheme split by a tab

- **WHEN** a value is `"java\tscript:alert(1)"` or an `@type` is `"javascript:alert(1)"`
- **THEN** the save MUST be refused with the scheme named

#### Scenario: A scheme mentioned in text

- **WHEN** a name is "Learn javascript: the basics" and a description is "Data: collected in 2026"
- **THEN** the custom JSON-LD MUST be accepted

#### Scenario: An empty list

- **WHEN** the custom JSON-LD is `[]`
- **THEN** nothing MUST be stored

### Requirement: Custom nodes can point at the module's nodes, never replace them

Custom nodes MUST be appended after the module's nodes. A `#name` `@id` MUST
be put on the entity's own URL, except the short ids of the site's own
items. In strings, the module's fixed names MUST be filled and other brace
text kept, except whole-value field and media names. A nested object with
one of the module's `@id`s MUST become a bare reference, or be removed when
that node is not in the graph. Text that is not a usable node MUST add
nothing. When read, a top-level item with one of the module's ids, or a
second item with an id already used, MUST be left out, behind the save's
refusal and the update's rename.

#### Scenario: A stored item that takes the identity's id

- **WHEN** a value stored before ids were reserved holds a top-level item with the `@id` `#identity`, and two items with the `@id` `#x`
- **THEN** the item MUST be left out, the module's identity MUST be unchanged, and only the first `#x` MUST be output

#### Scenario: A search action

- **WHEN** a custom node has the `@id` `#search` and the target `{url}?q={search_term_string}`
- **THEN** its `@id` MUST be on the page's URL, `{url}` MUST be filled, and `{search_term_string}` MUST be kept

#### Scenario: Taking over the identity

- **WHEN** a custom node uses the `@id` `{home}#identity`
- **THEN** the save MUST be refused, and the module's identity MUST be unchanged

#### Scenario: Pointing at a withheld node

- **WHEN** a custom node references `#primary` and the main node is withheld
- **THEN** the reference MUST be removed

#### Scenario: A field name in custom JSON-LD

- **WHEN** a template's custom JSON-LD has the name `By {field.field_byline}`
- **THEN** the name MUST be emitted as the text `By {field.field_byline}`

#### Scenario: The fixed names

- **WHEN** a custom node's strings use `{title}`, `{description}`, `{site}`, `{sep}`, `{url}`, `{author}`, `{published}`, `{modified}` and `{image}`
- **THEN** each MUST be filled with the page's value, as before this change
