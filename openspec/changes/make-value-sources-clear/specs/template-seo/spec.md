## MODIFIED Requirements

### Requirement: Values are previewed with a node of the type

The dialog MUST preview type values, and resolve its output, with the node the
Canvas template editor previews, in the language negotiated for the request.
That node MUST be of the template's content type. When the editor picks another
node to preview, the dialog MUST follow it, including the values shown in
read-outs and in source menus. Source controls MUST NOT change with the node:
they name what every item follows.

#### Scenario: Switching the preview node

- **WHEN** the editor switches the template preview to another article
- **THEN** the dialog's caption, previews, read-outs and source menus MUST show that article's title and field values, and every source control MUST read as before

#### Scenario: A node of another type

- **WHEN** the state of the Article template is asked for with a node of another type, or a node that does not exist
- **THEN** the system MUST answer 404 `not_found`
