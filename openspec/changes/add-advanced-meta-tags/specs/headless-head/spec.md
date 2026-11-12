## ADDED Requirements

### Requirement: Added tags reach the headless head as plain rows

AI use tags, verification codes, other tags, Metatag's tags and rows added by a
module MUST be in `head.meta` and `head.link` in the same order as in the
coupled HTML, each an object of its attributes only. A feed link MUST carry its
`type`. The head MUST keep exactly the keys `title`, `meta`, `link` and
`script`.

#### Scenario: A code, a meta row and a feed link

- **WHEN** the site has a verification code, the row `dcterms.rights` and an RSS feed link, and a frontend requests an owned page
- **THEN** `head.meta` MUST hold the code's tag and then `{"name": "dcterms.rights", "content": …}`, and `head.link` MUST hold `{"rel": "alternate", "type": "application/rss+xml", "href": …}` after the hreflang links

#### Scenario: Metatag installed

- **WHEN** Metatag's defaults hold a theme colour and a frontend requests an owned page
- **THEN** `head.meta` MUST carry the theme colour once, from the module's head, and nothing else of Metatag's

#### Scenario: A draft preview

- **WHEN** a frontend requests a preview of a page whose draft adds a row
- **THEN** `head.meta` MUST carry the draft's row, and the published response MUST NOT
