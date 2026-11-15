## MODIFIED Requirements

### Requirement: Addresses need a public base

A command that prints or matches addresses MUST build them for the default
frontend, or for the one named by `--frontend=<address>` (public-addresses); a
name that is not a configured frontend MUST be `choice`. With no frontend and
no public base setting, or with images on Drush's own `http://default`, it MUST
refuse with `base_unknown`, and `next` MUST add `--uri` or name the setting.
`describe` MUST still run. A command's results MUST NOT reach the dialog's
cache for another frontend.

#### Scenario: No site address

- **WHEN** `inspect /pricing` runs with neither `--uri`, a public base setting nor a frontend
- **THEN** it MUST exit 2 with `base_unknown`, and `next` MUST hold the same command with `--uri`

#### Scenario: A second frontend

- **WHEN** `inspect /pricing --frontend=https://shop.example.com` runs and that is a configured frontend
- **THEN** every address it prints MUST be on `https://shop.example.com`, and `next` commands MUST repeat `--frontend`

#### Scenario: Images on Drush's address

- **WHEN** a frontend is configured with no image address, no public file address is set and Drush has no `--uri`
- **THEN** `inspect /pricing` MUST exit 2 with `base_unknown`, naming the public file address setting and the frontend's image address

#### Scenario: An unknown frontend

- **WHEN** `inspect /pricing --frontend=https://old.example.com` runs and no frontend has that address
- **THEN** it MUST exit 2 with the code `choice`, listing the configured frontends in `allowed`
