## ADDED Requirements

### Requirement: The return policy appears once something is bought here

Site › Identity MUST show a Return policy row only once a page or template
says "Bought on this page: yes". Its sheet MUST offer "Link to your returns
page" (a picker of published, public pages) or "Describe it": countries,
returns (within a number of days, any time, not accepted), days, and fees
(free, or the customer pays). Saving MUST name the pages it changes first.

#### Scenario: No shop yet

- **WHEN** no page says "Bought on this page: yes"
- **THEN** Site › Identity MUST show no Return policy row

#### Scenario: A returns page

- **WHEN** an administrator links the policy to the published page "Returns"
- **THEN** the return policy node MUST carry that page's URL and nothing else
