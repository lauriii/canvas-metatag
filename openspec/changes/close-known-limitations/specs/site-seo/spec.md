## RENAMED Requirements

- FROM: `### Requirement: Overrides from outside apply to the output only`
- TO: `### Requirement: Site settings replaced by configuration are shown as they apply`

## MODIFIED Requirements

### Requirement: Site settings replaced by configuration are shown as they apply

Where a configuration override replaces a site setting, the state MUST list its path (`identity.<key>` or `values.<path>`) in `overridden` with the value the output uses, while `identity` and `values` stay as stored. The head and the state's resolved output MUST use the override. A save MUST be refused at an overridden path unless it sends the stored value (active configuration without overrides), and otherwise MUST store exactly what was sent.

#### Scenario: A staging site

- **WHEN** `settings.php` sets the site's `noindex` and an identity name
- **THEN** the state's site settings MUST be the stored values, `overridden` MUST hold `values.robots.noindex` and `identity.name` with the overridden values, and every owned page and the state's resolved output MUST carry `noindex` and the overridden name

#### Scenario: A save at an overridden path

- **WHEN** a save on that site sends `noindex` off
- **THEN** the system MUST answer 422 `invalid` with "This is set in site configuration outside SEO. Change it there, or remove the override first." at `values.robots.noindex`, and MUST store nothing
