## MODIFIED Requirements

### Requirement: A page's and a node's own description and image

The Description fact MUST be, for a Canvas page, its Canvas description field;
for a node, the summary of its first formatted text field with a summary, else
its first plain or formatted text field named for a description (value-links),
else that formatted field's text cut at a word boundary within 160 characters.
The Image fact MUST be, for a Canvas page, the image of its image media; for a
node, the first image field that resolves. "First" MUST follow the order of the
type's form.

#### Scenario: A node's description

- **WHEN** an article's first formatted text with a summary has no summary, and the type has no field named for a description
- **THEN** its Description fact MUST be its text without markup, cut at a word boundary within 160 characters

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
