## MODIFIED Requirements

### Requirement: Image addresses go through the frontend's image address

Every image the module emits, made images included, MUST be addressed through the frontend's image address: `{base}` is the frontend's public or preview address, never a language address; `{path}` the image's root-relative Drupal path without Drupal's base path; `{source}` its Drupal address as one query value; `{width}` its width. Other files MUST be on `{base}{path}`. Without an image address, all MUST be Drupal's own file address. A file served from another host MUST keep its own address.

#### Scenario: A proxied path

- **WHEN** the image address is `{base}{path}`, French has the address `https://www.example.com/fr-fr`, and a page's image is `public://hero.jpg`
- **THEN** JSON-LD images of it MUST be `https://www.example.com/sites/default/files/hero.jpg` on the English and the French page alike

#### Scenario: An image service

- **WHEN** the image address is `https://img.example.com{path}?w={width}` and a page shares a made card
- **THEN** `og:image` MUST be `https://img.example.com/canvas-metatag/share/` followed by the card's path and `?w=1200`, with `og:image:type` `image/png`, `og:image:width` 1200 and `og:image:height` 630

#### Scenario: A linked file

- **WHEN** the image address is `https://img.example.com{path}?w={width}` and a value links `public://guide.pdf`
- **THEN** its address MUST be `https://www.example.com/sites/default/files/guide.pdf`

#### Scenario: A Drupal installed under a path

- **WHEN** Drupal runs under `/cms` and the image address is `{base}{path}`
- **THEN** the image `public://hero.jpg` MUST be `https://www.example.com/sites/default/files/hero.jpg`

#### Scenario: A file on a file system declared public

- **WHEN** the image address is `{base}{path}` and a page's image is on a read-only file system declared public whose files are served from `https://files.example.net`
- **THEN** `og:image` MUST be the original file's own `https://files.example.net` address
