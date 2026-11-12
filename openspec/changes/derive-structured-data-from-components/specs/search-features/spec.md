## ADDED Requirements

### Requirement: Video results need a page for watching it

The rules file MUST include the video feature. A video that is not the page's
main thing MUST read "Not shown here: the page isn't mainly this video"; a
video that is the main thing of a page of the kind Video to watch MUST be
judged on its name, thumbnail and upload date.

#### Scenario: A video on the home page

- **WHEN** the home page shows a set-up video and is mostly about the front page
- **THEN** "Video result" MUST read "Not shown here: the page isn't mainly this video"

#### Scenario: A watch page without a thumbnail

- **WHEN** a Video to watch page's video has a name and an upload date but no thumbnail
- **THEN** "Video result" MUST read "Needs a thumbnail"
