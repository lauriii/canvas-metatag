## MODIFIED Requirements

### Requirement: Field values are plain values of the first item

A field link MUST give the value of the field's first item, except on a list
property, which MUST get every item in field order. Formatted text MUST
become plain text: the content of script, style and template elements
removed, tags removed, entities decoded, whitespace collapsed, with a space
between blocks. A description linked to formatted text MUST be cut at a word
boundary within 160 characters. Text typed into a plain text field MUST NOT be
stripped.

#### Scenario: A field with several values

- **WHEN** a byline field holds "Ada" and "Grace" and a value links to it
- **THEN** the value MUST be "Ada"

#### Scenario: Several values on a list property

- **WHEN** an article's author list links to a Writers field holding Ada and Grace
- **THEN** the value MUST be Ada and Grace, in that order

#### Scenario: Formatted text

- **WHEN** a value links to a formatted text field that holds `<p>One</p><p>Two &amp; <b>three</b></p>`
- **THEN** the value MUST be "One Two & three"

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
