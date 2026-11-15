## ADDED Requirements

### Requirement: The head does not depend on Canvas's controller

The module MUST set its head on the finished content API response, from what the request and the response carry, never from which controller Canvas resolves. A change to Canvas's controller (its class, method, arguments or service) MUST NOT stop the module's head or break the response. A response served from Dynamic Page Cache MUST NOT be resolved again.

#### Scenario: Canvas answers through another controller

- **WHEN** the content API is routed to a different controller that returns the same response
- **THEN** `head` MUST be the module's, and nothing MUST be logged

#### Scenario: A Dynamic Page Cache hit

- **WHEN** a preview response is served from Dynamic Page Cache
- **THEN** it MUST carry the module's head without the module resolving it again

### Requirement: The status report names what the headless head lost

When `canvas_headless` is enabled but the content API no longer provides what the module reads, or the module's response step is not registered, the content API MUST answer with Canvas's own head. The status report MUST then show an error for "SEO for headless content" that names what is missing and says to update the module, and one error MUST be logged when caches are rebuilt. Without `canvas_headless` the module MUST install and work without it.

#### Scenario: Canvas drops something the module reads

- **WHEN** a Canvas update removes a class member the module reads
- **THEN** the status report MUST show the error naming that member, content API responses MUST carry Canvas's own head, and the next cache rebuild MUST log one error

#### Scenario: The response step is removed

- **WHEN** another module removes the module's response step
- **THEN** the status report MUST show the error

#### Scenario: Everything is in place

- **WHEN** the content API carries what the module reads and its response step is registered
- **THEN** the status report MUST NOT show it

## REMOVED Requirements

### Requirement: The status report says when the headless head is lost

**Reason**: The module no longer runs through Canvas's content controller, so "another controller" is no longer a failure. "The status report names what the headless head lost" replaces it with what can still break: a Canvas member the module reads, or its own response step.

**Migration**: None. The status report keeps the title "SEO for headless content" and its severity.
