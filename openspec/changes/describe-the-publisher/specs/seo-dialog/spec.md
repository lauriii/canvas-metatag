## ADDED Requirements

### Requirement: A place's hours and a workplace can be the publisher's

Once the identity has opening hours, the opening hours sheet of a place MUST offer "Same as ‹Site›", which copies them. Once the identity's address is complete, a job's workplace MUST offer "At ‹Site›'s address". (Handed over by `populate-every-schema-type`, H2.)

#### Scenario: Same hours as the site

- **WHEN** the identity is open Mon–Fri 09:00–17:00 and an editor presses "Same as Humanify Studio" in a place's hours sheet
- **THEN** the week MUST read Mon–Fri 09:00–17:00
