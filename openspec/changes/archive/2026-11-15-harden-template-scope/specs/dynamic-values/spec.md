## MODIFIED Requirements

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
