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

The Description fact MUST be, for a Canvas page, its Canvas description field;
for a node, the summary of its first formatted text field with a summary, else
that text cut at a word boundary within 160 characters. The Image fact MUST be,
for a Canvas page, the image of its image media; for a node, the first image
field that resolves. "First" MUST follow the order of the type's form.

#### Scenario: A node's description

- **WHEN** an article's first formatted text with a summary has no summary
- **THEN** its Description fact MUST be its text without markup, cut at a word boundary within 160 characters

#### Scenario: A node's image

- **WHEN** an article's first image field references unpublished media and its second a published public image
- **THEN** its Image fact MUST be the second image

#### Scenario: The form decides which image is first

- **WHEN** the Person type's form shows a Photo field above an Avatar field, both with a public image, and Avatar's machine name sorts first
- **THEN** its Image fact MUST be the Photo field's image

### Requirement: Field values are plain values of the first item

A field link MUST give the value of the field's first item, or every item in
field order on a list property. Formatted text MUST become plain text: script,
style and template content removed, tags removed, entities decoded, whitespace
collapsed, a space between blocks. A heading, list item, definition, table row
or caption, and the text before a list or a heading, MUST end in a full stop
unless it ends in a sentence or clause mark. Text typed into a plain text field
MUST NOT be stripped.

#### Scenario: A field with several values

- **WHEN** a byline field holds "Ada" and "Grace" and a value links to it
- **THEN** the value MUST be "Ada"

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

A date MUST be ISO 8601 with the site's offset, except a date-only field, which
MUST stay a date. A number MUST keep the digits it is stored with. A link MUST
be an absolute http(s) address, put on the public base when it is internal, or
nothing. An entity reference MUST give the referenced entity's label, or its
image when it references image media.

#### Scenario: A date-only field

- **WHEN** an event date field stores only the date 2026-07-01 and a date value links to it
- **THEN** the value MUST be `2026-07-01`

#### Scenario: An internal link

- **WHEN** an address value links to a link field that points at a Canvas page of the site, and a headless frontend is the public base
- **THEN** the value MUST be that page's address on the frontend

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

### Requirement: A value is typed text or linked to one source

A value MUST be exactly one of: typed text, a fact (Title, Description, Site
name, Page address, Author, First published, Last updated, Image), a chosen
media item, or a link to a field of the content type. A value that is not set
MUST give its default. Typed text MUST be stored and emitted as typed and MUST
NOT be scanned for values, so braces are literal text.

#### Scenario: Braces in typed text

- **WHEN** a page's title is `Plans {for teams} {site}`
- **THEN** the title MUST be emitted with `Plans {for teams} {site}` as typed, and `{site}` MUST NOT be filled

#### Scenario: A field value that looks like a value

- **WHEN** an article's byline field holds the text `{site}` and the Article template links the author name to Byline
- **THEN** the author name MUST be the literal text `{site}`

#### Scenario: Two sources in one value

- **WHEN** a write sends a value that holds both typed text and a fact
- **THEN** the system MUST refuse it with "This value is not valid."

### Requirement: An empty link gives the field's own default

When a linked field is empty for an item, hidden from visitors, or broken, the
value MUST be what it would be with nothing set. The fallback MUST NOT be
configurable. The dialog's preview and the head MUST follow the same rule.

#### Scenario: An article without a summary

- **WHEN** the Article template links the description to Summary and an article's summary is empty
- **THEN** that article's description MUST be its Description fact, in the head and in the dialog's preview

#### Scenario: An empty linked image

- **WHEN** the Article template links the social image to Hero and an article has no hero image
- **THEN** the image MUST be the article's Image fact, else the site's default image

#### Scenario: An empty linked ending

- **WHEN** the site sets the ending "Example Co", "Every Article" links its ending to Section, and an article's section is empty, hidden or broken
- **THEN** that article's title MUST end with "| Example Co", in the head and in the dialog; with the site's "No ending" it MUST have no ending

### Requirement: A link to a field that no longer fits is broken

A stored link MUST be kept when its field is deleted, changes to a type that no
longer fits the value's kind, or cannot be read. It MUST give the default. The
template's state MUST list it as broken, with the field's machine name and the
reason: `missing`, `kind` or `error`. Recreating the field MUST make the link
work again.

#### Scenario: A deleted field

- **WHEN** the Article template links the description to Summary and `field_summary` is deleted
- **THEN** the template MUST still hold the link, each article's description MUST be its Description fact, and the state MUST list `field_summary` as broken with the reason `missing`

#### Scenario: A field that changed kind

- **WHEN** a link of the text kind points at a field that can no longer give text
- **THEN** the state MUST list it as broken with the reason `kind`

#### Scenario: The field comes back

- **WHEN** `field_summary` is created again on the Article type
- **THEN** the link MUST give each article's summary again

### Requirement: Values stored in the earlier form are converted by an update

Running the database updates MUST convert the brace values stored in site
settings, in every node `full` template and its draft, in every revision and
translation of a page, and in every page draft. A conversion that loses text
MUST be logged under `canvas_metatag` with the entity and key, never the value.
A draft MUST keep its other changes and its client id.

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
- **THEN** after the update its main part MUST be the Title fact, and the log MUST say that it kept its first part and dropped typed text and the byline, without the words themselves

#### Scenario: An old revision

- **WHEN** a page with an old revision in the brace form is reverted to that revision after the update
- **THEN** the reverted page MUST hold the converted value

#### Scenario: A template draft

- **WHEN** the Article template has a draft with layout changes and a brace title
- **THEN** after the update the draft MUST hold the layout changes and the converted title, under the same client id

### Requirement: A field link is stored as a Canvas field source

A template's field link MUST be stored as a Canvas entity-field prop source,
`{sourceType: entity-field, expression}`, in the form Canvas itself writes,
with no adapter. When Canvas deprecates a stored form, a module update MUST
convert the stored links.

#### Scenario: Exporting a template

- **WHEN** the Article template links its description to Summary and its configuration is exported
- **THEN** the description MUST be `source` with `sourceType: entity-field` and the expression Canvas uses for the value of `field_summary` on Article

#### Scenario: Links made before sources

- **WHEN** the database is updated on a site whose templates use whole `{field.NAME}` values
- **THEN** each link MUST become the Canvas source for that field and kind, a link to the type's first formatted text with a summary MUST become the Description fact, and a link with no matching source MUST be dropped and logged

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
labels, in the order of the type's form (then fields off the form), less the
module's exclusions and facts. A formatted text with a summary MUST be offered
as two entries; a link to its text MUST give the text cut at a word within 160
characters, for any value. A text list MUST give its stored key.

#### Scenario: Body and its summary

- **WHEN** the Article type has a Body field with a summary
- **THEN** the description's link menu MUST offer "Body" and "Body › Summary" as two entries

#### Scenario: A text list

- **WHEN** a text value links to a text list field whose stored key is `green` and whose label is "Green"
- **THEN** the value MUST be `green`

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
