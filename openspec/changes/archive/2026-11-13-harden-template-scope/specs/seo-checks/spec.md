## MODIFIED Requirements

### Requirement: Social image rules

When the server has resolved the page, the checks MUST judge the image a shared
link shows: whether there is one, its size, ratio, weight and format, and its
alt text. Without a resolution, no social image rule MUST be listed. The size
advice MUST use the link preview's width rule: an image that already makes a
large card is good to know, not to improve, stated rather than asked for, and
its cropping MUST be told in the same row. Sizes MUST be written "1200 × 630",
never broken across lines.

#### Scenario: No image

- **WHEN** no social image resolves
- **THEN** "Add a social image" MUST be listed to improve

#### Scenario: A small image

- **WHEN** the image is under 1200 × 630 and under 600 px wide
- **THEN** "Use a larger social image" MUST be listed to improve, and its detail MUST say that most link previews show it as a small thumbnail

#### Scenario: An image that already makes a large card

- **WHEN** the image is 800 × 420
- **THEN** "The social image could be sharper" MUST be listed as good to know, not counted, its detail MUST say that it works as a large card and that 1200 × 630 looks sharper, and it MUST NOT say that a large card needs 1200 × 630

#### Scenario: A large card that is cropped

- **WHEN** the image is 800 × 1000
- **THEN** one row, "The social image could be sharper", MUST be listed as good to know, its detail MUST say that it works as a large card, cropped, and that 1200 × 630 fits best, and "The social image will be cropped" MUST NOT be listed besides it

#### Scenario: Ratio, weight and alt text

- **WHEN** the ratio is outside 1.85 to 2 (of an image that is not already in the row above), the file is over 5 MB, or the image has no alt text
- **THEN** each MUST be listed as good to know

#### Scenario: Format

- **WHEN** the image is not JPEG, PNG, GIF or WebP
- **THEN** "Use JPEG, PNG or WebP" MUST be listed to improve, naming its format

## ADDED Requirements

### Requirement: Show buttons are told apart

Each Show in the Checks sheet MUST be named "Show ‹field›" and described by its
issue's sentence, so that no two Show buttons on the sheet share both name and
description.

#### Scenario: Three issues about the description

- **WHEN** the Checks sheet lists three issues that each lead to the description
- **THEN** their Show buttons MUST each be named "Show description" and MUST each be described by a different issue
