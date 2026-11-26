# dynamic-values

## Purpose

Let SEO texts and images follow the content they describe instead of being
typed in: facts every page and node has (its title, description, site name,
address, author, dates and image) and, on a content type's template, links to
the type's own fields, stored as Canvas field sources. Define which facts and
links each scope offers, what each one gives for a page or a node, and make
sure every value is what an anonymous visitor may see, so that no value can
leak hidden content or plant another value.

## Requirements

### Requirement: The vocabulary depends on the scope

Every page and node MUST have eight facts: Title, Description, Site name, Page
address, Author, First published, Last updated and Image, each with a kind:
text, address, date or image. The state MUST list them with their labels and
values, and the separator, which is not a value. On a page, only the title
ending (to the Site name) and structured data details of kind address, date
and image (to a fact of that kind) MAY link. In site settings, only the title
ending MAY link, to the Site name.

#### Scenario: A page

- **WHEN** the dialog opens on a Canvas page
- **THEN** the state MUST list the facts `title`, `description`, `site`, `url`, `author`, `published`, `modified` and `image`, each with its label, kind and value, the separator, and no field

#### Scenario: Site settings

- **WHEN** a site save sends a title ending linked to the Title fact
- **THEN** the system MUST refuse `title_end`

### Requirement: A template adds the type's own fields

In a content type's template, a value MAY also link to a field of the type
whose value fits the value's kind. Plain and formatted text, text list,
number, date, link, image and entity reference fields MUST be offered. An image
field, and a reference to media whose source is an image, MUST be of the image
kind. The node's title, created and changed times and owner MUST be offered
only as their facts. The module's own field, revision fields and comment fields
MUST NOT be offered.

#### Scenario: An Article template

- **WHEN** the Article type has a byline text field and a hero media field that references image media
- **THEN** the template's state MUST list Byline as text and Hero as an image, each with the previewed article's value

#### Scenario: The node's own title

- **WHEN** the link menu of a text value is opened at template scope
- **THEN** the node's title MUST be offered once, as the Title fact, and the node's owner only as the Author fact

### Requirement: Writes use only known values, in their place

A write MUST be refused for a value that is not exactly one known kind of
value, for a fact or field link whose kind does not fit, for a field link
outside a template or not offered for that value, and for anything but a
media item or an image link in an image setting. A refusal MUST name the field
and say why, such as "This value is not valid.", "Choose a value from the
list.", "Choose a field from the list." or "Choose an image from the list."

#### Scenario: An unknown value

- **WHEN** a page write sends a title ending linked to a fact named `nope`
- **THEN** the system MUST refuse `title_end` with "Choose a value from the list."

#### Scenario: An image in text

- **WHEN** a template write links the title to the Image fact
- **THEN** the system MUST refuse `title` with "Choose a value from the list."

#### Scenario: A field value in the site title

- **WHEN** a site save links the title ending to a field
- **THEN** the system MUST refuse `title_end` with "This setting is not available here."

#### Scenario: Two values as the social image

- **WHEN** the social image holds both a media item and the Image fact
- **THEN** the system MUST refuse `social.image` with "This value is not valid."

#### Scenario: A field link on a page

- **WHEN** a page write links its social description to a field
- **THEN** the system MUST refuse `social.description` with "This setting is not available here."

#### Scenario: A field the menu does not offer

- **WHEN** a template write links the description to a field expression that the link menu does not offer
- **THEN** the system MUST refuse `description` with "Choose a field from the list."

#### Scenario: Typed text as an image

- **WHEN** a template write sends typed text as the social image
- **THEN** the system MUST refuse `social.image` with "Choose an image from the list."

### Requirement: What each common value is

For a page or node, Title MUST be its label; Site name the site identity's
name, else the site's own name as the current language shows it; Page address
its own public address (head-output); Author the display name of its owner;
First published and Last updated its created and changed times, as ISO 8601
with the offset of the site's timezone. The separator is the identity's
separator.

#### Scenario: An empty identity name

- **WHEN** the site identity has no name and the site is named "Example"
- **THEN** the Site name fact MUST be "Example"

#### Scenario: Dates

- **WHEN** a page was created at 12:00 UTC and the site's timezone is Europe/Helsinki in summer
- **THEN** the First published fact MUST end with `+03:00`

### Requirement: A page's and a node's own description and image

The Description fact MUST be a Canvas page's description field, else its own text; for a node, the summary of its first formatted text with one, else its first text field named for a description (value-links), else its first shown long text field. Derived text MUST be plain and cut to the whole sentences that fit in 160 characters, else at a word within 159 with "…". The Image fact MUST be a Canvas page's image media, or a node's first image field that resolves. "First" MUST follow form order.

#### Scenario: A node's description

- **WHEN** an article's first formatted text with a summary has no summary and begins "Made to last. Solid oak, finished by hand in our workshop in Tampere, with brass fittings that age well. Each piece is numbered, signed and registered so that it can be repaired for decades."
- **THEN** its Description fact MUST be "Made to last. Solid oak, finished by hand in our workshop in Tampere, with brass fittings that age well."

#### Scenario: Abbreviations are not sentence ends

- **WHEN** a node's text begins "Dr. Kallio leads the choir, e.g. on Fridays. Rehearsals start at 18."
- **THEN** its Description fact MUST NOT end after "Dr." or "e.g."

#### Scenario: One long first sentence

- **WHEN** a node's text begins with one sentence of 240 characters
- **THEN** its Description fact MUST end with a whole word and "…", within 160 characters

#### Scenario: Only a long text field

- **WHEN** a content type has no formatted text with a summary and a node's first long text field holds "Open Monday to Friday. Closed on public holidays."
- **THEN** its Description fact MUST be that text

#### Scenario: A Summary field

- **WHEN** a Post type has a Body without a summary and a plain long text field `field_post_summary` labelled "Summary", and a post's Summary is "Ten lessons from a year of shipping."
- **THEN** its Description fact MUST be "Ten lessons from a year of shipping." and name Summary as its source

#### Scenario: A word inside a label

- **WHEN** a Product type has a plain text field labelled "Lead time" and no other text field
- **THEN** its Description fact MUST NOT be read from "Lead time"

#### Scenario: A node's image

- **WHEN** an article's first image field references unpublished media and its second a published public image
- **THEN** its Image fact MUST be the second image

#### Scenario: The form decides which image is first

- **WHEN** the Person type's form shows a Photo field above an Avatar field, both with a public image, and Avatar's machine name sorts first
- **THEN** its Image fact MUST be the Photo field's image

### Requirement: A long text field the page shows

A node's long text field MUST count as shown only when its `full` content template links it, as the template replaces the view display. A node type without a template MUST follow the display its page renders with (`full` when enabled, else `default`).

#### Scenario: A long text the content template does not link

- **WHEN** a content type whose `full` content template renders its pages has a long text field "Internal notes" that its default display shows and its template does not link, and a long text field "Opening hours" that its template links and its `full` display hides
- **THEN** its Description fact MUST come from "Opening hours", and MUST be empty while that field is empty, never "Internal notes"

### Requirement: A node's description and image name their field

A node's Description and Image facts MUST name the field they come from as the
link menu names it ("Body › Summary" for a summary), else the first field that
could give them, also for a type with no item yet.

#### Scenario: A type with no item yet

- **WHEN** the template of a type with a Body and a Hero image field is opened and the type has no item
- **THEN** its Description fact MUST name Body and its Image fact Hero image as their sources, with no value

### Requirement: Field values are plain values: the first item, every item on a list or in text

A field link MUST give its first item, every item in field order on a list
property, or in text every item visitors may see. Formatted text MUST become
plain text: script, style and template content and tags removed, entities
decoded, whitespace collapsed, a space between blocks. A heading, list item,
definition, table row or caption, and text before a list or heading, MUST end
in a full stop unless it ends in a sentence or clause mark. Text typed into a
plain text field MUST NOT be stripped.

#### Scenario: A field with several values

- **WHEN** a byline field holds "Ada" and "Grace", "Every Article"'s description links to it, and so does its title ending
- **THEN** the description MUST be "Ada, Grace", and the ending, which is not text that composes, MUST be "Ada"

#### Scenario: Several values on a list property

- **WHEN** an article's author list links to a Writers field holding Ada and Grace
- **THEN** the value MUST be Ada and Grace, in that order

#### Scenario: Formatted text

- **WHEN** a value links to a formatted text field that holds `<p>One</p><p>Two &amp; <b>three</b></p>`
- **THEN** the value MUST be "One Two & three"

#### Scenario: A heading and a list

- **WHEN** a product's body holds `<h2>Made to last</h2><p>Solid oak.</p><ul><li>Dimmable</li><li>Fabric cable, 3 m.</li></ul>` and no summary
- **THEN** a value linked to the body MUST be "Made to last. Solid oak. Dimmable. Fabric cable, 3 m."

#### Scenario: A nested list, a table and a definition

- **WHEN** a body holds `<ul><li>Features<ul><li>Dimmable</li></ul></li></ul>`, `<table><tr><th>Height</th><td>45 cm</td></tr><tr><th>Weight</th><td>1.2 kg</td></tr></table>` or `<dl><dt>Term</dt><dd>Its meaning</dd></dl>`
- **THEN** its value MUST be "Features. Dimmable.", "Height 45 cm. Weight 1.2 kg." or "Term Its meaning."

#### Scenario: A heading that ends in a bracket

- **WHEN** a body holds `<h2>Price (USD)</h2><p>From 49</p>`
- **THEN** its value MUST be "Price (USD). From 49"

#### Scenario: A paragraph before a heading

- **WHEN** a body holds `<p>Buy now</p><h2>Specs</h2>`
- **THEN** its value MUST be "Buy now. Specs."

#### Scenario: A heading that ends in a mark of another script

- **WHEN** a body holds `<h2>見出し：</h2><p>本文</p>` or `<h2>مرحبا،</h2><p>x</p>`
- **THEN** its value MUST be "見出し： 本文" or "مرحبا، x", with no full stop added

#### Scenario: Marks that spare the full stop

- **WHEN** a heading ends in a full stop, question or exclamation mark, ellipsis, colon, semicolon or comma, or in the same mark in CJK text (full-width and half-width forms), Arabic, Urdu or Devanagari text, with closing quotes or brackets after it
- **THEN** no full stop MUST be added after it

#### Scenario: Formatted text that is not valid UTF-8

- **WHEN** a body holds text that is not valid UTF-8
- **THEN** its value MUST be empty

#### Scenario: A value linked to a long formatted text

- **WHEN** an Article template links the description, or the title or a structured data detail, to a Body of 1,000 characters
- **THEN** that value MUST be the Body's text, not its summary, cut at a word boundary within 160 characters

#### Scenario: Formatted text with a script and a style block

- **WHEN** a product's body holds `<p>Ask us</p><script>alert(1)</script><style>p{color:red}</style>` and no summary
- **THEN** a value linked to the body and the product's Description fact MUST be "Ask us"

### Requirement: Other field kinds give their natural value

A date MUST be ISO 8601 with the site's offset, except a date-only field,
which MUST stay a date. A number MUST keep the digits it is stored with. A
link MUST be an absolute http(s) address, put on the public base when it is
internal, or nothing. An entity reference MUST give the referenced entity's
label, or its image when it references image media. In a value that can be
composed, a date, a number, a list and a reference's label MUST read as words;
a link and an image do not fit text.

#### Scenario: A date-only field

- **WHEN** an event date field stores only the date 2026-07-01 and a date value links to it
- **THEN** the value MUST be `2026-07-01`

#### Scenario: An internal link

- **WHEN** an address value links to a link field that points at a Canvas page of the site, and a headless frontend is the public base
- **THEN** the value MUST be that page's address on the frontend

#### Scenario: The same date in a date detail and in the title

- **WHEN** "Every Event" links its Starts detail to the Starts field and also puts Starts in its title, and an event starts on 20 June 2026 at 19:00 in Europe/Helsinki
- **THEN** its `startDate` MUST be `2026-06-20T19:00:00+03:00` and its title MUST hold "20 June 2026"

### Requirement: Values are what an anonymous visitor may see

Every value that comes from published content MUST be what an anonymous visitor
may see, whoever asks. A field, referenced entity, media item or file that
visitors may not view MUST give nothing, so the value falls back to its
default, and the dialog MUST say "Hidden from visitors". An image MUST be a
file in the public file system. The Author fact MUST need only the right to
view the account's label, not the profile.

#### Scenario: A field visitors cannot view

- **WHEN** a template links the description to a field that anonymous visitors may not view
- **THEN** the head and the dialog's preview MUST use the default description, and the linked box MUST say "Hidden from visitors"

#### Scenario: An author without public profiles

- **WHEN** anonymous visitors may not view user profiles
- **THEN** the Author fact MUST still be the author's display name

#### Scenario: A private file

- **WHEN** a linked image field's file is not in the public file system
- **THEN** the linked image MUST give nothing and the default image MUST be used

### Requirement: Values follow the translation

For a translation, the Title and Description facts and every field link MUST be
the translation's own. A referenced entity and the page image of a Canvas page
MUST be taken in the translation's language when the referenced entity has that
translation. An image chosen as a media item (a social image, the logo, the
default image) MUST use the media item's default translation, also for its alt
text.

#### Scenario: A French translation

- **WHEN** the French translation of a page titled "Pricing" is titled "Tarifs"
- **THEN** the Title fact MUST be "Tarifs" in the French head

#### Scenario: A chosen image with a translated alt text

- **WHEN** a French page uses a social image whose media item has a French translation with its own alt text
- **THEN** `og:image:alt` MUST be the alt text of the media item's default language

### Requirement: A value is typed text, one source, or a composition

A value MUST be exactly one of: typed text, a fact (Title, Description, Site
name, Page address, Author, First published, Last updated, Image), a chosen
media item, a link to a field of the content type, or a composition of typed
text with fields and facts. A value that is not set MUST give its default.
Typed text, alone or in a composition, MUST be stored and emitted as typed
and MUST NOT be scanned for values, so braces are literal text.

#### Scenario: Braces in typed text

- **WHEN** a page's title is `Plans {for teams} {site}`
- **THEN** the title MUST be emitted with `Plans {for teams} {site}` as typed, and `{site}` MUST NOT be filled

#### Scenario: A field value that looks like a value

- **WHEN** an article's byline field holds the text `{site}` and the Article template links the author name to Byline
- **THEN** the author name MUST be the literal text `{site}`

#### Scenario: Two sources in one value

- **WHEN** a write sends a value that holds both typed text and a fact as two keys of one value
- **THEN** the system MUST refuse it with "This value is not valid."

#### Scenario: Braces typed inside a composition

- **WHEN** "Every Event"'s title is the Title fact followed by the typed text ` {field.field_city}`
- **THEN** each event's title MUST end with the literal text `{field.field_city}`, and no field MUST be read for it

### Requirement: An empty link gives the field's own default

When a linked field is empty for an item, hidden from visitors, or broken, the
value MUST be what it would be with nothing set. In a composition, such a field
or fact MUST instead be left out with the text that goes with it, and only when
every field and fact of the composition gives nothing MUST the value be what it
would be with nothing set. The fallback MUST NOT be configurable. The dialog's
preview and the head MUST follow the same rule.

#### Scenario: An article without a summary

- **WHEN** the Article template links the description to Summary and an article's summary is empty
- **THEN** that article's description MUST be its Description fact, in the head and in the dialog's preview

#### Scenario: An empty linked image

- **WHEN** the Article template links the social image to Hero and an article has no hero image
- **THEN** the image MUST be the article's Image fact, else the site's default image

#### Scenario: An empty linked ending

- **WHEN** the site sets the ending "Example Co", "Every Article" links its ending to Section, and an article's section is empty, hidden or broken
- **THEN** that article's title MUST end with "| Example Co", in the head and in the dialog; with the site's "No ending" it MUST have no ending

#### Scenario: A composed title without a city

- **WHEN** "Every Event"'s title is Title, " in ", Venue › City, " · ", Starts, and the event "Summer Gala" on 20 June 2026 has a venue without a city
- **THEN** its title MUST start with "Summer Gala · 20 June 2026", in the head and in the dialog's preview

#### Scenario: A composition whose fields are all empty

- **WHEN** "Every Event"'s description is "Tickets for ", Performers, " in ", Venue › City, and an event has no performers and no venue
- **THEN** that event's description MUST be its Description fact, and the head MUST NOT carry "Tickets for"

### Requirement: A link to a field that no longer fits is broken

A stored link, alone or in a composition, MUST be kept when its field is
deleted, changes to a type that no longer fits the value's kind, or cannot be
read. Alone, it MUST give the default; in a composition, it MUST be left out as
an empty field is. The template's state MUST list it as broken, with the
field's machine name, the reason (`missing`, `kind` or `error`) and its place
in a composition. Recreating the field MUST make the link work again.

#### Scenario: A deleted field

- **WHEN** the Article template links the description to Summary and `field_summary` is deleted
- **THEN** the template MUST still hold the link, each article's description MUST be its Description fact, and the state MUST list `field_summary` as broken with the reason `missing`

#### Scenario: A field that changed kind

- **WHEN** a link of the text kind points at a field that can no longer give text
- **THEN** the state MUST list it as broken with the reason `kind`

#### Scenario: The field comes back

- **WHEN** `field_summary` is created again on the Article type
- **THEN** the link MUST give each article's summary again

#### Scenario: A deleted field in a composed title

- **WHEN** "Every Event"'s title is Title, " in ", City, and `field_city` is deleted
- **THEN** each event's title MUST start with its own title alone, and the state MUST list `field_city` as broken with the reason `missing` as the title's third part

#### Scenario: Editing the words around a broken field

- **WHEN** an editor changes " in " to " at " in that title while `field_city` is still deleted
- **THEN** the write MUST be accepted, and the template MUST keep the link to `field_city` with the new words

### Requirement: Values stored in the earlier form are converted by an update

Running the database updates MUST convert the brace values stored in site
settings, in every node `full` template and its draft, and in every revision,
translation and draft of a page. A template's value that can be composed MUST
become a composition of every part it named that fits text, at most eight
fields, a `{sep}` that does not split a title as typed text; a part that
cannot be converted MUST be dropped with the words that go with it.

#### Scenario: The installed site pattern

- **WHEN** the site's title is `{title} {sep} {site}`
- **THEN** after the update the site MUST store no title ending, and a page "Pricing" on the site "Example" MUST still have the title "Pricing | Example"

#### Scenario: A template ending

- **WHEN** the Article template's title is `{title} {sep} Journal`
- **THEN** after the update its main part MUST be unset and its ending MUST be "Journal"

#### Scenario: A page title with the site's ending

- **WHEN** a page's title is `Pricing plans for every team {sep} {site}`
- **THEN** after the update its main part MUST be the text "Pricing plans for every team" and its ending MUST be inherited from the site

#### Scenario: A whole field value

- **WHEN** the Article template's description is `{field.field_summary}`
- **THEN** after the update the description MUST be linked to Summary

#### Scenario: A composite title

- **WHEN** a template's title is `{title} by {field.field_byline}`
- **THEN** after the update its main part MUST be the composition Title, " by ", Byline, and nothing MUST be logged as lost

#### Scenario: A composite with a field the type no longer has

- **WHEN** a template's description is `{title} in {field.field_gone} {sep} {site}`, the site's separator is "|", and `field_gone` has no matching source
- **THEN** after the update the description MUST be Title, " | ", Site name, and the log MUST name `field_gone` without the words

#### Scenario: An old revision

- **WHEN** a page with an old revision in the brace form is reverted to that revision after the update
- **THEN** the reverted page MUST hold the converted value

### Requirement: A conversion logs what it loses and keeps drafts

A conversion that loses text or a part MUST be logged under `canvas_metatag`
with the entity, the key and the names it dropped, never the words. A draft
MUST keep its other changes and its client id.

#### Scenario: A template draft

- **WHEN** the Article template has a draft with layout changes and a brace title
- **THEN** after the update the draft MUST hold the layout changes and the converted title, under the same client id

#### Scenario: A composite on a page

- **WHEN** a page's title is `Plans for {site} teams`
- **THEN** after the update its main part MUST be the text "Plans for", and the log MUST say that it kept its first part and dropped `{site}` and typed text, without the words themselves

### Requirement: A field link is stored as a Canvas field source

A template's field link, alone or as a part of a composition, MUST be stored
as a Canvas entity-field prop source, `{sourceType: entity-field, expression}`,
in the form Canvas itself writes, with no adapter. A composition MUST be a list
of parts and MUST NOT be stored as a Canvas adapted source or as a string.
When Canvas deprecates a stored form, a module update MUST convert the stored
links, in compositions too.

#### Scenario: Exporting a template

- **WHEN** the Article template links its description to Summary and its configuration is exported
- **THEN** the description MUST be `source` with `sourceType: entity-field` and the expression Canvas uses for the value of `field_summary` on Article

#### Scenario: Links made before sources

- **WHEN** the database is updated on a site whose templates use whole `{field.NAME}` values
- **THEN** each link MUST become the Canvas source for that field and kind, a link to the type's first formatted text with a summary MUST become the Description fact, and a link with no matching source MUST be dropped and logged

#### Scenario: Exporting a composed title

- **WHEN** "Every Event"'s title is Title, " in ", Venue › City, and its configuration is exported
- **THEN** the title MUST be `parts` holding `fact: title`, `text: ' in '`, and `source` with `sourceType: entity-field` and Canvas's expression for the venue's city, in that order

### Requirement: Links can follow references

A template value MAY link through an entity reference to a field of the
referenced entity, such as a writer's name, a tag's name or an image's
alternative text. A referenced entity MUST be read in the item's language when
it has that translation. A hop to an entity that visitors may not view MUST
give nothing.

#### Scenario: A writer's name

- **WHEN** the Article template links the author name detail to Writer › Title and an article's writer is "Ada"
- **THEN** that article's author name MUST be "Ada"

#### Scenario: Several tags

- **WHEN** a text value links to Tags › Name and an article has the tags "AI" and "Writing"
- **THEN** the value MUST be "AI"

#### Scenario: An unpublished writer

- **WHEN** an article's writer is an unpublished node
- **THEN** the author name MUST be its default

### Requirement: Field links offer what Canvas offers

The fields a template value can link to MUST be those Canvas offers when
linking a component prop of that kind in a content template, with Canvas's
labels, in the order of the type's form, then fields off it, less the module's
exclusions and facts. A formatted text with a summary MUST be offered as two
entries; a link to its text MUST give the text cut at a word within 160
characters. A text list MUST give its stored key, and its label in the item's
language in a value that can be composed.

#### Scenario: Body and its summary

- **WHEN** the Article type has a Body field with a summary
- **THEN** the description's link menu MUST offer "Body" and "Body › Summary" as two entries

#### Scenario: A text list

- **WHEN** a choice detail links to a text list field whose stored key is `green` and whose label is "Green", and the description links to the same field
- **THEN** the detail MUST be `green`, and the description MUST be "Green"

#### Scenario: Two fields with one label

- **WHEN** two linkable fields of the type are both labelled "Summary"
- **THEN** each entry MUST add its machine name, such as "Summary (field_summary)"

### Requirement: A node visitors cannot view yet is previewed with the editor's access

When anonymous visitors may not view the previewed node, its links MUST be read
with the editor's access, so that a node being built previews its fields. When
visitors may view it, links MUST be read as an anonymous visitor. The head of a
published node MUST NOT vary by user or by permissions.

#### Scenario: An unpublished article

- **WHEN** the template preview uses an unpublished article whose description links to Summary
- **THEN** the dialog's preview MUST show that article's summary

#### Scenario: A published article

- **WHEN** a visitor and an editor request a published article whose head uses linked fields
- **THEN** both MUST get the same cached head

### Requirement: One long text gives its own list items

On a text list property, one long text field MUST give one item per list item
when it is formatted and has list items, otherwise one per paragraph, and one
per line when it is plain text; its link menu MUST note it "Each list item,
in order" or "Each line, in order". Each item MUST be plain text. A heading
is not an item, an item gets no full stop of its own, and formatted text
with neither list items nor paragraphs is one item. The module MUST NOT
split text in any other way.

#### Scenario: A method with list items

- **WHEN** a list property links to a formatted field holding `<p>Intro</p><ul><li>Mix</li><li>Bake</li></ul>`
- **THEN** the items MUST be "Mix" and "Bake"

#### Scenario: Paragraphs

- **WHEN** the field holds `<p>Mix</p><p>Bake</p>`
- **THEN** the items MUST be "Mix" and "Bake"

#### Scenario: A heading and a paragraph

- **WHEN** the field holds `<h2>Made to last</h2><p>Solid oak.</p>`
- **THEN** the one item MUST be "Solid oak."

#### Scenario: Lines of plain text

- **WHEN** a list property links to a plain long text field holding "Mix", a line break and "Bake"
- **THEN** the items MUST be "Mix" and "Bake"

### Requirement: Decimal fields can be linked as numbers

A number value MUST be linkable to a decimal field of the type, read as its
exact digits without trailing zeros and never through floating point. A
test MUST fail when Canvas starts offering decimal fields itself, so the
module's own entries are removed.

#### Scenario: A price

- **WHEN** a price links to a decimal field holding 49.90
- **THEN** the value MUST be `49.9`

### Requirement: A template text can be composed from fields and typed text

At template scope, the title's main part, the description, the social texts
and each structured data detail the registry marks as free text MAY be
composed: typed text and up to eight fields or facts, in order, each one the
place may link to. One field or fact and no text MUST be stored as that link,
and typed text alone as typed text. Text between fields MUST be kept as typed,
spaces included; spaces before the first field and after the last MUST be
trimmed.

#### Scenario: An event title

- **WHEN** "Every Event"'s title is Title, " in ", Venue › City, " · ", Starts, and the event "Summer Gala" in Helsinki starts on 20 June 2026, on the site "Example"
- **THEN** its title MUST be "Summer Gala in Helsinki · 20 June 2026 | Example", in the head and in the dialog

#### Scenario: One field alone

- **WHEN** an editor removes everything but Summary from a composed description
- **THEN** the template MUST store the description exactly as linking it to Summary stores it

#### Scenario: A space between two fields

- **WHEN** a Person template's name detail is First name, " ", Last name, and a person is Ada Lovelace
- **THEN** the template MUST store the space as its own part, and the name MUST be "Ada Lovelace"

#### Scenario: A space after the last field

- **WHEN** a write sends the description Summary, " "
- **THEN** the template MUST store the description exactly as linking it to Summary stores it

### Requirement: Which words go with which field

In a composition, text between two fields or facts MUST go with the one after
it, except a closing mark at its very first character (a closing bracket, or a
quote followed by a space, punctuation or the end), which goes with the one
before. Text after the last MUST go with the last, and text before the first
with the first. Text that goes with a field MUST show only when that field
gives a value, in the head and the dialog alike.

#### Scenario: A missing date

- **WHEN** "Every Event"'s title is Title, " in ", City, " · ", Starts, and "Summer Gala" in Helsinki has no start date
- **THEN** its title MUST start with "Summer Gala in Helsinki" and MUST NOT hold "·"

#### Scenario: A bracket whose opening went with an empty field before

- **WHEN** the social description is Performers › Title, " (", Venue › City, ")" and the event has no performers
- **THEN** it MUST be "Helsinki", never "Helsinki)": the closing mark goes with the opening one

#### Scenario: Brackets

- **WHEN** the title is Title, " (", City, ") · ", Starts, and "Summer Gala" on 20 June 2026 has no city
- **THEN** its title MUST start with "Summer Gala · 20 June 2026"

#### Scenario: A unit after the last field

- **WHEN** the title is Title, " – ", Price, " €", and a product "Lamp" has no price
- **THEN** its title MUST start with "Lamp" and MUST NOT hold "€"

#### Scenario: A possessive

- **WHEN** the name detail is Brand, "'s ", Title, and the product "Lamp" has no brand
- **THEN** its name MUST be "Lamp"

#### Scenario: A quote before an empty field

- **WHEN** the title is Title, ' "', Subtitle, '"', and "Summer Gala" has no subtitle
- **THEN** its title MUST start with "Summer Gala" and MUST NOT hold a quote

### Requirement: A lead-in that is a label always shows

Text before the first field or fact whose last character that is not a space
is label punctuation (`:` `.` `!` `?` `…` `|` `·` `•` `–` `—` `-` `/`) MUST
always show while any field or fact gives a value.

#### Scenario: A lead-in

- **WHEN** the description is "Tickets: ", Title, and the event is "Summer Gala"
- **THEN** the description MUST be "Tickets: Summer Gala"

#### Scenario: A label before an empty first field

- **WHEN** the description is "Tickets: ", Performers, " in ", Venue › City, and an event in Helsinki has no performers
- **THEN** the description MUST be "Tickets: Helsinki"

### Requirement: Joining words never dangle

Text that goes with the field after it MUST show only when a field or fact
before it was also kept, unless it is the text before the first. Text after the
last field that holds only separator characters (`·` `•` `|` `–` `—` `-` `/`
`,` `;` `:`) and spaces MUST never show. When every field and fact gives
nothing, text alone MUST never be emitted.

#### Scenario: A missing first field

- **WHEN** the title is City, " · ", Starts, and an event on 20 June 2026 has no city
- **THEN** its title MUST start with "20 June 2026", never with "·"

#### Scenario: A lead-in that reads into its field

- **WHEN** the description is "Tickets for ", Performers, " in ", Venue › City, and an event in Helsinki has no performers
- **THEN** the description MUST be "Helsinki", never "Tickets for in Helsinki"

#### Scenario: A separator left at the end

- **WHEN** an editor removes Starts from the title Title, " · ", Starts, on the site "Example"
- **THEN** "Summer Gala"'s title MUST be "Summer Gala | Example"

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
- **THEN** the composed title, its menu row and the Starts detail's box MUST all write the date "June 19, 2027", the box adding its time

### Requirement: In text, a field gives every item visitors may see

In a value that can be composed, alone or in a composition, a field with
several values MUST give every item an anonymous visitor may see, in field
order, joined with the list separator of the item's locale. In a title-like
place (the title's main part, the social title, a name, a headline, a
street address line) it MUST give at most two items and
then a translatable, plural-aware "and ‹n› more". The dialog MUST show the
server's words.

#### Scenario: Items that end a sentence

- **WHEN** the description holds Performers › Biography, and the first biography ends "…small ensembles."
- **THEN** the next item MUST follow it after a space, never ".,"

#### Scenario: Every performer in a description

- **WHEN** "Every Event"'s description is Title, " with ", Performers › Title, and "Summer Gala" has the performers Ada, Grace and Hedy
- **THEN** its description MUST be "Summer Gala with Ada, Grace, Hedy", in the head and in the dialog

#### Scenario: Three performers in a title

- **WHEN** the title's main part is Title, " with ", Performers › Title, for the same event on the site "Example"
- **THEN** its title MUST be "Summer Gala with Ada, Grace and 1 more | Example"

#### Scenario: Two performers in a title

- **WHEN** the event has only the performers Ada and Grace
- **THEN** its title MUST start with "Summer Gala with Ada, Grace", with no "more"

#### Scenario: A performer visitors may not see

- **WHEN** Grace's page is unpublished
- **THEN** the description MUST be "Summer Gala with Ada, Hedy", and nothing MUST count Grace

#### Scenario: The language's separator

- **WHEN** the event has a Japanese translation
- **THEN** its description MUST join the performers with "、"

#### Scenario: A detail that is not text

- **WHEN** a choice detail links to a multi-value text list field holding `green` and `blue`
- **THEN** the detail MUST be `green`

### Requirement: A long text in a composition gets the room left

In a description-like place, a formatted text or the Description fact inside a
composition MUST be cut to the room the rest of the result leaves, about 155
characters in all and never under 70 for that part, at its last whole sentence
within that room, else at a word with "…". In a title-like place it MUST NOT be
a part. Alone, it MUST give what a link to it gives today.

#### Scenario: A call to action after the body

- **WHEN** the description is Body, " Free delivery.", and an article's body is 900 characters long
- **THEN** the description MUST end with the last whole sentence of the body that fits, followed by " Free delivery.", and MUST NOT be longer than about 155 characters

### Requirement: Where composition is refused

A composition MUST be refused on a page, in site settings, in the title
ending, and in a value that is not free text: an image, an address, a date, a
number, a choice, a code, a list, a reference, opening hours, formatted
markup, or a detail the registry does not mark. It MUST also be refused with
more than eight fields and facts, with a media item or a picked page as a
part, with a field or fact that does not fit text, or with long text in a
title-like place.

#### Scenario: A page

- **WHEN** a page write sends a composed title
- **THEN** the system MUST refuse `title` with "This setting is not available here."

#### Scenario: The title ending

- **WHEN** a template write sends a composed title ending
- **THEN** the system MUST refuse `title_end` with "This setting is not available here."

#### Scenario: Nine fields

- **WHEN** a template write sends a description that holds nine fields
- **THEN** the system MUST refuse `description` with "Use at most 8 fields in one value."

#### Scenario: An image in a composition

- **WHEN** a template write sends a title that holds the Image fact
- **THEN** the system MUST refuse `title` with "Choose a value from the list."

#### Scenario: A field the menu does not offer, in a composition

- **WHEN** a template write sends a title that holds a field expression the link menu does not offer
- **THEN** the system MUST refuse `title` with "Choose a field from the list."

#### Scenario: Long text in a title

- **WHEN** a template write sends a title that holds Title, " – ", Body
- **THEN** the system MUST refuse `title` with "Choose a field from the list."

#### Scenario: A date detail

- **WHEN** a template write sends a composed Starts detail
- **THEN** the system MUST refuse `schema.props.startDate` with "This setting is not available here."

#### Scenario: A detail the registry does not mark

- **WHEN** a template write sends a composed postal code detail
- **THEN** the system MUST refuse it with "This setting is not available here."

### Requirement: A page still named with the placeholder takes its first heading

When a Canvas page's name is the placeholder Canvas gives a new page, in the page's language, its Title fact MUST be the text of the first heading in the page's own content, read as an anonymous visitor. Without a heading it MUST stay the placeholder. It MUST NOT take the site's name or the home page's title.

#### Scenario: A heading on the page

- **WHEN** a page named "Untitled page" starts with a heading component "Our services"
- **THEN** its Title fact MUST be "Our services"

#### Scenario: No heading

- **WHEN** a page named "Untitled page" has no heading
- **THEN** its Title fact MUST be "Untitled page" and its card MUST show "Untitled page", not the home page's card

### Requirement: A Canvas page's own text

A Canvas page's own text MUST be the first of up to three text values of at least 50 characters that follow its first heading in the SDC and code components (not blocks) the page itself places in its content (not page regions, not a template; a personalized part gives its default case), skipping text that starts with "©", "(c)" or "Copyright", and skipping text another published page in the same language also offers.

#### Scenario: An intro paragraph

- **WHEN** a Canvas page without a description shows the heading "Blog" followed by "Read practical notes on shaping AI-generated work into clear, trusted pages."
- **THEN** its meta description MUST be that sentence

#### Scenario: Text repeated on other pages

- **WHEN** two published Canvas pages both show the same newsletter text right after their headings, and one of them has a second paragraph of its own
- **THEN** neither page's description MUST be the newsletter text, and that page's description MUST be its own paragraph

#### Scenario: Text in a page region

- **WHEN** the only text after the heading is in the footer region
- **THEN** the page MUST have no derived description

#### Scenario: Personalized content

- **WHEN** a page's heading and intro are inside a personalization switch, with other words for returning visitors
- **THEN** its Title fact and description MUST come from the default case, which visitors in no segment and link previews get

### Requirement: A Canvas page's first component image

A Canvas page's first component image MUST be the first image, in render order, among the SDC and code components (not blocks) the page places in its own content (a personalized part gives its default case), read through its media or file entity on public files as an anonymous visitor may see it. An image given only as an address MUST be ignored.

#### Scenario: A hero component

- **WHEN** a Canvas page's first component is a hero with a published media image and its second a card with another image
- **THEN** its first component image MUST be the hero's

#### Scenario: An external address

- **WHEN** a component's image is an address on another site
- **THEN** it MUST NOT be a first component image, and the module MUST NOT request it
