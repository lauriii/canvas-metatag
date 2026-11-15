## ADDED Requirements

### Requirement: The dialog shows the frontend Canvas previews with

The dialog MUST ask for its state for the frontend Canvas previews with, and
its search and social previews, Output and Site MUST show that frontend's
addresses. "About addresses" MUST name that frontend. The link preview MUST
show its image from Drupal, never from the image address. Until the state has
loaded, no host MUST be shown.

#### Scenario: The second frontend

- **WHEN** Canvas previews with `https://shop.example.com` and the editor opens the dialog on `/about`
- **THEN** the search preview MUST show `shop.example.com` and the address `/about`, and "About addresses" MUST name `https://shop.example.com`

#### Scenario: Switching frontends

- **WHEN** the editor switches Canvas to `https://www.example.com` and reopens the dialog
- **THEN** the previews and Output MUST show addresses on `https://www.example.com`

#### Scenario: An image address the editor can't reach

- **WHEN** the frontend's image address is on a host the editor's browser can't reach
- **THEN** the link preview MUST still show the image

#### Scenario: Loading

- **WHEN** the dialog opens and the state has not loaded
- **THEN** the search preview MUST NOT show the host the editor uses
