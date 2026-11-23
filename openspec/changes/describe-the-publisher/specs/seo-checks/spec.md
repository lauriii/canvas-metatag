## MODIFIED Requirements

### Requirement: Description rules

The checks MUST judge the resolved search description: whether it exists, fits,
and says more than the title. On the front page, the missing-description row
MUST ask for a description of the whole site, and a description that comes
from the identity MUST be named as the site's description.

#### Scenario: No description

- **WHEN** the resolved description is empty
- **THEN** "Add a description" MUST be listed to improve

#### Scenario: A long description

- **WHEN** the description may be cut off
- **THEN** "Shorten the description" MUST be listed as good to know

#### Scenario: Repeating the title

- **WHEN** the description equals the title without the site name, or one contains the other as whole words and the two differ by fewer than 20 letters, ignoring case and punctuation
- **THEN** "Make the description say more" MUST be listed to improve

#### Scenario: A description that holds the title

- **WHEN** "Every Event"'s description is Title, " in ", City, "." and its title is Title
- **THEN** "Make the description say more" MUST be listed to improve

#### Scenario: A description that names the title and goes on

- **WHEN** a page or a template is titled "Pricing" and its description is "Pricing for teams of every size, billed monthly or yearly, with every feature included and a free month to try it before you decide which plan fits."
- **THEN** "Make the description say more" MUST NOT be listed

#### Scenario: The site's description on the home page

- **WHEN** the front page has no description of its own and the identity has a description
- **THEN** "Add a description" MUST NOT be listed, and the description field MUST say "From the site's description"

#### Scenario: No description on the home page

- **WHEN** the front page has no description and the identity has none
- **THEN** "Add a description" MUST be listed to improve, with "Describe the whole site: what it offers and who it's for. Without one, search engines pick text from the page."

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
