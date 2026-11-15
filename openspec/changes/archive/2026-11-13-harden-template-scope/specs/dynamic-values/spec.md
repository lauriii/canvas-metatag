## MODIFIED Requirements

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

A `{field.NAME}` value MUST be the value of the field's first item. Formatted
text MUST become plain text: the content of script, style and template
elements removed, tags removed, entities decoded, whitespace collapsed, with a
space between blocks. A formatted text with a summary MUST give its summary,
else its text. Text typed into a plain text field MUST NOT be stripped.

#### Scenario: A field with several values

- **WHEN** a byline field holds "Ada" and "Grace"
- **THEN** `{field.field_byline}` MUST be "Ada"

#### Scenario: Formatted text

- **WHEN** a formatted text field holds `<p>One</p><p>Two &amp; <b>three</b></p>`
- **THEN** its value MUST be "One Two & three"

#### Scenario: Formatted text with a script and a style block

- **WHEN** a product's body holds `<p>Ask us</p><script>alert(1)</script><style>p{color:red}</style>` and no summary
- **THEN** `{field.body}` and the product's `{description}` MUST be "Ask us"

## ADDED Requirements

### Requirement: A type's fields are listed in the order of its form

A template's vocabulary MUST list the type's fields in the order of the type's
form. Fields that are not on the form MUST follow, ordered by machine name.

#### Scenario: A venue

- **WHEN** the Venue type's form shows Description, Street, Postal code, Locality and Country in that order
- **THEN** the template's vocabulary (the state's `tokens`) MUST list `{field.body}`, `{field.field_street}`, `{field.field_postal_code}`, `{field.field_locality}` and `{field.field_country}` in that order, after the values every entity has

#### Scenario: A field hidden from the form

- **WHEN** a field of the type is not on its form
- **THEN** it MUST be listed after the fields on the form
