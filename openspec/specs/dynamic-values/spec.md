# dynamic-values

## Purpose

Let SEO texts and images refer to the content they describe: the page title,
the site name, a content type's own fields. Define which dynamic values exist
in each scope, what each one is for a page or a node, and make sure every value
is what an anonymous visitor may see, so that no value can leak hidden content
or plant another value.

## Requirements

### Requirement: Dynamic values are names in braces

A dynamic value MUST be written `{name}` or `{field.NAME}`, with a lower-case
name. Brace text that does not have this form MUST be literal text. Filling in
MUST happen in one pass: a filled-in value MUST NOT be scanned again, so that
content cannot add a dynamic value of its own. In the head's texts, a name that
has no value MUST be filled with nothing.

#### Scenario: A field value that looks like a dynamic value

- **WHEN** a node's byline field holds the text `{site}` and the title pattern is `{field.field_byline}: {title}`
- **THEN** the title MUST start with the literal text `{site}`

#### Scenario: Brace text that is not a dynamic value

- **WHEN** a title is `Plans {for teams}`
- **THEN** the title MUST be emitted as typed

#### Scenario: A name that no longer exists

- **WHEN** a stored title uses `{field.field_gone}`, a field that was deleted
- **THEN** that part of the title MUST be empty

### Requirement: The vocabulary depends on the scope

Every page and node MUST have these dynamic values: page title (`{title}`),
description (`{description}`), site name (`{site}`), separator (`{sep}`), page
address (`{url}`), author (`{author}`), first published (`{published}`), last
updated (`{modified}`) and page image (`{image}`). A Canvas page, and the site
title pattern, MUST use exactly these. Each value MUST have a kind: text,
number, date and time, address or image.

#### Scenario: A page

- **WHEN** the dialog opens on a Canvas page
- **THEN** the state MUST list the nine values every page has, each with its label and kind, and no `{field.*}` value

### Requirement: A template adds the type's own fields

In a content type's template, the vocabulary MUST also hold one `{field.NAME}`
per configurable field of the type whose type is supported: plain and formatted
text, a text list, email, telephone, integer, decimal, float, date, date range,
timestamp, link, image and entity reference. Base fields MUST NOT be offered.
An image field, and a reference to media whose source is an image, MUST be of
the image kind.

#### Scenario: An Article template

- **WHEN** the Article type has a byline text field and a hero media field that references image media
- **THEN** the state MUST also list `{field.field_byline}` as text and `{field.field_hero}` as an image

### Requirement: Writes use only known values, in their place

A write MUST be refused for a text that uses a name outside its vocabulary, or
that uses an image value. An image setting (the social image, an image detail of
structured data) MUST be a media UUID or exactly one image value. A refusal
MUST name the field and say why.

#### Scenario: An unknown value

- **WHEN** a page write has the title `{nope}`
- **THEN** the system MUST refuse `title`, saying that `{nope}` is not a value SEO knows and to choose one from the list

#### Scenario: An image in text

- **WHEN** a page write has the title `{image} pricing`
- **THEN** the system MUST refuse `title`, saying the value is an image and cannot be used in text

#### Scenario: A field value in the site title

- **WHEN** a site save uses `{field.field_x}` in the title pattern
- **THEN** the system MUST refuse it

#### Scenario: Two values as the social image

- **WHEN** the social image is `{image}{image}`
- **THEN** the system MUST refuse it with "Choose an image from the list."

### Requirement: What each common value is

For a page or node, `{title}` MUST be its label; `{site}` the site identity's
name, else the site's own name as the current language shows it; `{sep}` the
identity's separator; `{url}` its own public address (head-output); `{author}`
the display name of its owner; `{published}` and `{modified}` its created and
changed times, as ISO 8601 with the offset of the site's timezone.

#### Scenario: An empty identity name

- **WHEN** the site identity has no name and the site is named "Example"
- **THEN** `{site}` MUST be "Example"

#### Scenario: Dates

- **WHEN** a page was created at 12:00 UTC and the site's timezone is Europe/Helsinki in summer
- **THEN** `{published}` MUST end with `+03:00`

### Requirement: A page's and a node's own description and image

`{description}` MUST be, for a Canvas page, its Canvas description field; for a
node, the summary of its first formatted text field with a summary, else that
text cut at a word boundary within 160 characters. `{image}` MUST be, for a
Canvas page, the image of its image media; for a node, the first image field
that resolves. "First" MUST follow the order of the type's form.

#### Scenario: A node's description

- **WHEN** an article's first formatted text with a summary has no summary
- **THEN** `{description}` MUST be its text without markup, cut at a word boundary within 160 characters

#### Scenario: A node's image

- **WHEN** an article's first image field references unpublished media and its second a published public image
- **THEN** `{image}` MUST be the second image

#### Scenario: The form decides which image is first

- **WHEN** the Person type's form shows a Photo field above an Avatar field, both with a public image, and Avatar's machine name sorts first
- **THEN** `{image}` MUST be the Photo field's image

### Requirement: Field values are plain values of the first item

A `{field.NAME}` value MUST come from the field's first item. Formatted
text MUST become plain text: script, style and template content removed, tags
removed, entities decoded, whitespace collapsed, a space between blocks. A
heading, list item, definition, table row or caption, and the text before a
list or a heading, MUST end in a full stop unless it ends in a sentence or
clause mark. Formatted text MUST give its summary when it has one. Text typed
into a plain text field MUST NOT be stripped.

#### Scenario: A field with several values

- **WHEN** a byline field holds "Ada" and "Grace"
- **THEN** `{field.field_byline}` MUST be "Ada"

#### Scenario: Formatted text

- **WHEN** a formatted text field holds `<p>One</p><p>Two &amp; <b>three</b></p>`
- **THEN** its value MUST be "One Two & three"

#### Scenario: A heading and a list

- **WHEN** a product's body holds `<h2>Made to last</h2><p>Solid oak.</p><ul><li>Dimmable</li><li>Fabric cable, 3 m.</li></ul>` and no summary
- **THEN** `{field.body}` MUST be "Made to last. Solid oak. Dimmable. Fabric cable, 3 m."

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

#### Scenario: Formatted text with a script and a style block

- **WHEN** a product's body holds `<p>Ask us</p><script>alert(1)</script><style>p{color:red}</style>` and no summary
- **THEN** `{field.body}` and the product's `{description}` MUST be "Ask us"

### Requirement: Other field kinds give their natural value

A text list MUST give the label of its value. A date MUST be ISO 8601 with the
site's offset, except a date-only field, which MUST stay a date. A decimal MUST
keep the field's scale. A link MUST be an absolute http(s) address, put on the
public base when it is internal, or nothing. An entity reference MUST give the
referenced entity's label, or its image when it references image media.

#### Scenario: A date-only field

- **WHEN** an event date field stores only the date 2026-07-01
- **THEN** its value MUST be `2026-07-01`

#### Scenario: An internal link

- **WHEN** a link field points at a Canvas page of the site and a headless frontend is the public base
- **THEN** its value MUST be that page's address on the frontend

### Requirement: Values are what an anonymous visitor may see

Every value that comes from content MUST be what an anonymous visitor may see,
whoever asks. A field the anonymous visitor may not view, a referenced entity
whose label they may not view, and media or a file they may not view MUST give
nothing. An image MUST also be a file in the public file system. The author's
name MUST need only the right to view the account's label, not the profile.

#### Scenario: A field visitors cannot view

- **WHEN** a template binds the title to a field that anonymous visitors may not view
- **THEN** that value MUST be empty in the head and in the dialog's preview

#### Scenario: An author without public profiles

- **WHEN** anonymous visitors may not view user profiles
- **THEN** `{author}` MUST still be the author's display name

#### Scenario: A private file

- **WHEN** an image field's file is not in the public file system
- **THEN** that image value MUST be nothing

### Requirement: Values follow the translation

For a translation, `{title}`, `{description}` and every field value MUST be the
translation's own. The label of a referenced entity and the page image of a
Canvas page MUST be taken in the translation's language when the referenced
entity has that translation. An image chosen by its media UUID (a social
image, the logo, the default image) MUST use the media item's default
translation, also for its alt text.

#### Scenario: A French translation

- **WHEN** the French translation of a page titled "Pricing" is titled "Tarifs"
- **THEN** `{title}` MUST be "Tarifs" in the French head

#### Scenario: A chosen image with a translated alt text

- **WHEN** a French page uses a social image whose media item has a French translation with its own alt text
- **THEN** `og:image:alt` MUST be the alt text of the media item's default language

### Requirement: A type's fields are listed in the order of its form

A template's vocabulary MUST list the type's fields in the order of the type's
form. Fields that are not on the form MUST follow, ordered by machine name.

#### Scenario: A venue

- **WHEN** the Venue type's form shows Description, Street, Postal code, Locality and Country in that order
- **THEN** the template's vocabulary (the state's `tokens`) MUST list `{field.body}`, `{field.field_street}`, `{field.field_postal_code}`, `{field.field_locality}` and `{field.field_country}` in that order, after the values every entity has

#### Scenario: A field hidden from the form

- **WHEN** a field of the type is not on its form
- **THEN** it MUST be listed after the fields on the form
