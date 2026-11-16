# seo-access

## Purpose

Decide who may read and change a page's or a template's SEO settings, change
the site-wide settings, and read SEO data that is not public: drafts and the
stored overrides. Canvas's own access to each page and template is always
checked as well; the module's permissions never widen it. How the dialog
presents a refusal is seo-dialog.

## Requirements

### Requirement: Two permissions

The module MUST provide "Edit SEO settings in Canvas" (`edit canvas metatag`)
and "Administer SEO site settings" (`administer canvas metatag`). The
administrative permission MUST be marked as restricted. The edit permission's
description MUST warn that the canonical address may point at another site.

#### Scenario: Permissions page

- **WHEN** a site builder opens the permissions page
- **THEN** both permissions MUST be listed, the administrative one with the restricted-access warning

### Requirement: Each route has its own access

The routes MUST require:

- `GET /canvas-metatag/api/state` and `GET /canvas-metatag/api/media`: either permission;
- `PUT /canvas-metatag/api/draft/canvas_page/{id}`: `edit canvas metatag` and update access to the page; the id MUST be numeric;
- `PUT /canvas-metatag/api/draft/content_template/{id}`: `edit canvas metatag` and update access to the template;
- `PUT /canvas-metatag/api/site`: `administer canvas metatag`.

#### Scenario: Canvas edit access only

- **WHEN** a user who may edit Canvas pages but has neither SEO permission requests the state or the media list
- **THEN** the system MUST deny it with 403

#### Scenario: Not a page id

- **WHEN** a draft write names the page `abc`
- **THEN** the system MUST answer 404

### Requirement: Editing a page or template needs the edit permission and update access

Writing a page's or a template's SEO settings MUST require
`edit canvas metatag` and Canvas's update access to that page or template. For
a page, update access MUST be checked again on the translation being written.
Either one alone MUST NOT be enough, and the administrative permission MUST NOT
replace the edit permission. The state MUST say whether the user may write the
target (`can.target`) and the site settings (`can.site`).

#### Scenario: Update access without the permission

- **WHEN** a user who may edit the page in Canvas, without `edit canvas metatag`, writes its SEO settings
- **THEN** the system MUST deny it with 403, and nothing MUST be written

#### Scenario: The permission without update access

- **WHEN** a user with `edit canvas metatag` who may not update the page writes its SEO settings
- **THEN** the system MUST deny it with 403, and nothing MUST be written

#### Scenario: A viewer

- **WHEN** a user with `edit canvas metatag` may view a page but not update it
- **THEN** the state MUST say `can.target: false`

### Requirement: Site settings need the administrative permission

Saving the site identity and site-wide defaults MUST require
`administer canvas metatag`. People with `edit canvas metatag` only MUST be
able to read site settings and MUST NOT be able to change them.

#### Scenario: An editor saves anyway

- **WHEN** a user with `edit canvas metatag` only sends a site save to the API
- **THEN** the system MUST deny it with 403, and the state MUST have said `can.site: false`

### Requirement: The API is for signed-in browsers

The API MUST accept browser sessions only, never a bearer token, and its
responses MUST NOT be cached. Every unsafe method MUST require a valid CSRF
header token when the request carries a session cookie. Every refusal by the
module's controllers MUST be JSON `{error: {code, message}}`, with `fields`
added for a refusal of values. The dialog MUST fetch a new CSRF token and try
once more when a write is denied by the route.

#### Scenario: Missing CSRF token

- **WHEN** a draft write or site save with a session cookie has no `X-CSRF-Token` header, or a wrong one
- **THEN** the system MUST deny it with 403

#### Scenario: Reads need no token

- **WHEN** a user with a session reads the state or the media list without a CSRF header
- **THEN** the system MUST answer 200

#### Scenario: A state request that cannot be read

- **WHEN** the state is asked for with a langcode but no page, with a langcode for a template, with a preview node but no template, or with an entity type other than a page or a template
- **THEN** the system MUST answer 400 `bad_request`

### Requirement: Viewing needs view access

The state of a page MUST require view access to the page translation. The state
of a template MUST require view access to the template and, when it is
previewed with a node, to that node. Without view access the system MUST answer
403 `forbidden`.

#### Scenario: An unpublished page

- **WHEN** a user with `edit canvas metatag` who may not view an unpublished page asks for its state
- **THEN** the system MUST answer 403 `forbidden`

#### Scenario: A template without Canvas access

- **WHEN** a user with `edit canvas metatag` and no access to Canvas asks for a template's state
- **THEN** the system MUST answer 403 `forbidden`

#### Scenario: A template without a node, without Canvas access

- **WHEN** a user with `edit canvas metatag` and no access to Canvas asks for a template's state without a preview node
- **THEN** the system MUST answer 403 `forbidden`

### Requirement: Only people with update access read drafts

The dialog's state MUST include draft data (draft values, the draft label, the
facts and link values read from the draft, and the output built from them)
only for a user with Canvas's update access to the page or template. Anyone
else MUST get what is stored and `has_draft: false`. A translation that exists
only as a Canvas draft MUST be reported as not found to users without update
access. Update access without `edit canvas metatag` MUST give the draft with
`can.target: false`.

#### Scenario: A viewer of a page with a draft

- **WHEN** a user who may view but not update a page with an SEO draft asks for its state
- **THEN** the response MUST contain the stored values and the published title, MUST say `has_draft: false`, and MUST NOT contain any draft text

#### Scenario: A viewer of a template with a draft

- **WHEN** a user who may view but not update a template asks for its state while it has a draft
- **THEN** the values and the previewed title MUST be the stored ones, with `has_draft: false`

#### Scenario: A draft-only translation

- **WHEN** a user without update access asks for the state of a translation that exists only as a Canvas draft
- **THEN** the system MUST answer 404, so that they do not learn that the draft exists

#### Scenario: Update access, administrative permission only

- **WHEN** a user who may update the page and has `administer canvas metatag` but not `edit canvas metatag` asks for its state
- **THEN** the response MUST include the draft, with `can.target: false`

#### Scenario: Link values of an unpublished node

- **WHEN** a user asks for a template's state while the previewed node is unpublished and one of its linked fields is one that user may not view
- **THEN** that field's value MUST NOT be in the response

### Requirement: The stored overrides are not public

Viewing the stored `canvas_metatag` field of a Canvas page, for example through
JSON:API, MUST require one of the two permissions. Editing the field MUST NOT
be restricted by this module, so that Canvas can publish a page whose SEO value
changed by someone without the SEO permissions. Whatever is stored by any route
MUST be cleaned again before it is rendered.

#### Scenario: Reading the field without a permission

- **WHEN** a user with neither permission reads a page's `canvas_metatag` field through an entity API
- **THEN** field view access MUST be forbidden, cached per permissions

#### Scenario: A value stored around the API

- **WHEN** custom code stores a page value with an unknown key, a `javascript:` canonical and a robots limit of 5000
- **THEN** the head MUST leave each of them out and keep the valid values

### Requirement: The media picker offers only what the user may view and visitors can get

The media list MUST contain only published media whose source is an image, that
the user may view and whose file is public, newest first, 24 per page, and MAY
be filtered by name. The dialog's state MUST describe only referenced media the
user may view whose file is public.

#### Scenario: An unpublished image

- **WHEN** a user who may view unpublished media opens the picker
- **THEN** unpublished images MUST NOT be offered

#### Scenario: No media access

- **WHEN** a user without "view media" opens the picker
- **THEN** the list MUST be empty

#### Scenario: A referenced image the user may not view

- **WHEN** the site's default image is unpublished and the user opens the dialog
- **THEN** the state MUST NOT describe that image
