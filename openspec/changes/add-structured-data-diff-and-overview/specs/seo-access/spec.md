## MODIFIED Requirements

### Requirement: Each route has its own access

The routes MUST require:

- `GET /canvas-metatag/api/state` and `GET /canvas-metatag/api/media`: either permission;
- `GET /canvas-metatag/api/reach`: `edit canvas metatag` and update access to the template it names;
- `GET /canvas-metatag/api/overview` and its CSV export: `administer canvas metatag`;
- `PUT /canvas-metatag/api/draft/canvas_page/{id}`: `edit canvas metatag` and update access to the page; the id MUST be numeric;
- `PUT /canvas-metatag/api/draft/content_template/{id}`: `edit canvas metatag` and update access to the template;
- `PUT /canvas-metatag/api/site`: `administer canvas metatag`.

#### Scenario: Canvas edit access only

- **WHEN** a user who may edit Canvas pages but has neither SEO permission requests the state or the media list
- **THEN** the system MUST deny it with 403

#### Scenario: Not a page id

- **WHEN** a draft write names the page `abc`
- **THEN** the system MUST answer 404

#### Scenario: Reach without access to the template

- **WHEN** a user with `edit canvas metatag` but no update access to the Article template asks for its reach
- **THEN** the system MUST deny it with 403

#### Scenario: The overview for an editor

- **WHEN** a user with only `edit canvas metatag` requests the overview
- **THEN** the system MUST deny it with 403
