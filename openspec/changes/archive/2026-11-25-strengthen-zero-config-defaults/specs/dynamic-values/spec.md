## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: A long text field the page shows

A node's long text field MUST count as shown only when its `full` content template links it, as the template replaces the view display. A node type without a template MUST follow the display its page renders with (`full` when enabled, else `default`).

#### Scenario: A long text the content template does not link

- **WHEN** a content type whose `full` content template renders its pages has a long text field "Internal notes" that its default display shows and its template does not link, and a long text field "Opening hours" that its template links and its `full` display hides
- **THEN** its Description fact MUST come from "Opening hours", and MUST be empty while that field is empty, never "Internal notes"

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
