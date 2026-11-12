## ADDED Requirements

### Requirement: Typed profiles that differ from the footer are reported

For people who can administer SEO site settings, when the identity's typed
profiles differ from the profile links of the footer component, a row to
improve MUST say so and offer "Use the footer's profiles", which links
Profiles to those links. Only links that would be ticked as profiles MUST be
compared.

#### Scenario: A missing profile

- **WHEN** the typed profiles are one network profile and the footer links two network profiles and a partner agency
- **THEN** "Your profiles in structured data don't match the profile links in your footer." MUST be listed, comparing the two profiles only

#### Scenario: Linked profiles

- **WHEN** Profiles is linked to the footer
- **THEN** the row MUST NOT be listed
