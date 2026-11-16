## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: One long text gives its own list items

On a text list property, one long text field MUST give one item per list item
when it is formatted and has list items, otherwise one per paragraph, and one
per line when it is plain text. Each item MUST be plain text. The module MUST
NOT split text in any other way.

#### Scenario: A method with list items

- **WHEN** a list property links to a formatted field holding `<p>Intro</p><ul><li>Mix</li><li>Bake</li></ul>`
- **THEN** the items MUST be "Mix" and "Bake"

#### Scenario: Paragraphs

- **WHEN** the field holds `<p>Mix</p><p>Bake</p>`
- **THEN** the items MUST be "Mix" and "Bake"

### Requirement: Decimal fields can be linked as numbers

A number value MUST be linkable to a decimal field of the type, or of a type
it references, read as its exact digits without trailing zeros and never
through floating point. A test MUST fail when Canvas starts offering decimal
fields itself, so the module's own entries are removed.

#### Scenario: A price

- **WHEN** a price links to a decimal field holding 89.990000
- **THEN** the value MUST be `89.99`
