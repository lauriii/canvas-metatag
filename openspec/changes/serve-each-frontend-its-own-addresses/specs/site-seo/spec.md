## MODIFIED Requirements

### Requirement: The public address in use is shown

The state MUST report, for the frontend it was built for, the address page
addresses are built on (public-addresses), that frontend's `canvas_headless`
address, and the source: `frontend`, `preview` when it matches an entry's
preview address, `settings` for `canvas_metatag_public_base`, `request`, or
`none` when it can't be known. A state request MAY name a configured frontend
by its address; any other name MUST be ignored. Site settings MUST show it.

#### Scenario: No setting and no frontend

- **WHEN** neither the setting nor a headless frontend is configured
- **THEN** the state MUST report the request's address with the source `request`

#### Scenario: Naming a frontend

- **WHEN** the frontends are `https://www.example.com` and `https://shop.example.com`, and the state is requested for `https://shop.example.com`
- **THEN** the state MUST report `https://shop.example.com` with the source `frontend`, and its resolved head MUST be built for that frontend

#### Scenario: A name that is not a frontend

- **WHEN** the state is requested for `https://feat-42.preview.example.com`, which only matches a preview address
- **THEN** the state MUST be built for the default frontend
