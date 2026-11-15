## ADDED Requirements

### Requirement: Site settings are fully validatable configuration

`canvas_metatag.site` MUST be fully validatable configuration, and its schema
MUST accept at each scope only the keys that scope accepts, so that a recipe
or config action that stores a bad site value fails, naming the path and the
problem.

#### Scenario: A description at site scope

- **WHEN** a recipe sets `values.description` on `canvas_metatag.site`
- **THEN** applying the recipe MUST fail, naming `values.description`, and the site settings MUST be unchanged

#### Scenario: A bad identity kind

- **WHEN** a config action sets `identity.kind` to `company`
- **THEN** it MUST fail, listing `organization` and `person` as the allowed values

### Requirement: Shapes are refused, stale references reported

Validating site settings, template settings, component mappings or the page
field MUST refuse anything the dialog's rules can never accept. A reference
that was valid and went stale, such as a deleted media item or field, MUST NOT
be a violation; `check` MUST report it, so that imports and Canvas publishes
do not fail on it.

#### Scenario: A malformed value

- **WHEN** a template setting holds `{"fact": "nope"}`
- **THEN** validating the template MUST give a violation at that path

#### Scenario: A deleted image

- **WHEN** the site's default image is deleted
- **THEN** validating the site settings MUST pass, and `check site` MUST list `media-missing` for `/identity/default_image`

### Requirement: Configuration imports refuse invalid SEO settings

A configuration import MUST be refused before anything is imported when it
would store site settings, a template's SEO settings or a component mapping
whose shape fails validation. The refusal MUST name the configuration, the
path and the problem, and MUST use the same constraint as every other
validation.

#### Scenario: A bad value in an import

- **WHEN** the configuration to import sets the Article template's `robots.max_snippet` to 5000
- **THEN** the import MUST be refused naming `canvas.content_template.node.article.full` and `robots.max_snippet`, and no configuration MUST change

### Requirement: A page's SEO field is validated with the page

Validating a Canvas page MUST validate its SEO field with the page scope's
rules, so that content import, entity APIs and Canvas's publish refuse a
value the output would drop. Field edit access MUST stay as seo-access says.

#### Scenario: Default content with a bad value

- **WHEN** default content holds a page whose SEO value has a `javascript:` canonical
- **THEN** importing it MUST fail, naming the page and the field

### Requirement: A recipe sets SEO with one config action

Recipes MUST be able to set site settings and a content type's SEO with the
config action `setCanvasMetatag`, which MUST take what `set` takes for that
target: a merge patch, validated with the dialog's rules, in the hand-writable
forms. It MUST store the configuration directly. A refused value MUST fail the
recipe with its path and message.

#### Scenario: Setting up articles

- **WHEN** a recipe applies `setCanvasMetatag` to `canvas.content_template.node.article.full` with `description: {field: field_summary}` and `schema: {type: BlogPosting}`
- **THEN** the template MUST store the Canvas field source for the summary and the type, and keep its other values

### Requirement: Values from code may be written by hand

Where the module takes values from code (`set` and `setCanvasMetatag`), a
template value MUST accept `{"field": "<handle>"}` with a handle `describe`
lists, a media value an id or UUID, and hand-added JSON-LD a JSON object or
list as well as text. Each MUST be stored in its canonical form. A handle the
template cannot link MUST be refused with the handles it can link in
`allowed`.

#### Scenario: Through a reference

- **WHEN** an article's author is set to `{"field": "field_writer.name"}`
- **THEN** the stored value MUST be the Canvas source the link menu stores for "Writer › Name"

#### Scenario: A part of a field

- **WHEN** an article's description is set to `{"field": "field_body:summary"}`
- **THEN** the stored value MUST be the source of the body's summary, not of its text

#### Scenario: A field of the wrong kind

- **WHEN** an article's social image is set to `{"field": "field_summary"}`
- **THEN** it MUST be refused with code `field`, listing the image handles in `allowed`

#### Scenario: A media id

- **WHEN** the site logo is set to `{"media": 12}`
- **THEN** the stored value MUST be media 12's UUID

#### Scenario: Pasted structured data

- **WHEN** a page's hand-added structured data is set to a JSON object copied from a public example
- **THEN** it MUST be stored as pretty-printed text, and `inspect` MUST print it back as the same object

### Requirement: Content export carries the images SEO names

Exporting a Canvas page as default content with its dependencies MUST include
every media item its SEO values name, so that an import elsewhere shows the
same images.

#### Scenario: A social image

- **WHEN** a page with a chosen social image is exported with its dependencies
- **THEN** the export MUST contain that media item and its file
