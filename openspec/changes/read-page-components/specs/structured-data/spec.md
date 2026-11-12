## MODIFIED Requirements

### Requirement: Node identities are fixed

The module's nodes MUST use these `@id`s, where `{home}` is the public base
followed by `/` and `{url}` is the entity's own public URL: the identity
`{home}#identity`, the logo `{home}#logo`, the website `{home}#website`, the page
`{url}#webpage`, the page image `{url}#primaryimage`, the main node
`{url}#primary`, the breadcrumb `{url}#breadcrumb`. `{url}` MUST NOT follow a
canonical override, so that a page's identity does not move when its
canonical does. Custom nodes MUST NOT take any of these fragments.

#### Scenario: A canonical override

- **WHEN** a page at `/love` sets the canonical `/plans?ref=1`
- **THEN** the page node's `@id` MUST be on `/love`, not on `/plans`

#### Scenario: The front page

- **WHEN** the page is the site's front page
- **THEN** its page node's `@id` MUST be `{home}#webpage`

#### Scenario: A custom breadcrumb id

- **WHEN** a custom node uses the `@id` `#breadcrumb`
- **THEN** it MUST be dropped and reported

## ADDED Requirements

### Requirement: A breadcrumb trail is described where it shows

When a breadcrumb component renders on the page, the graph MUST carry a
`BreadcrumbList` of the page's breadcrumb trail, each item with its position,
name and absolute address, the last item without an address, and the page
node MUST reference it as `breadcrumb`. Without a rendered breadcrumb there
MUST be no `BreadcrumbList`.

#### Scenario: A page with a breadcrumb

- **WHEN** a page at `/shop/lamps/oak` renders a breadcrumb "Home › Shop › Lamps › Oak desk lamp"
- **THEN** the graph MUST have a `BreadcrumbList` at `/shop/lamps/oak#breadcrumb` with four items, the last without `item`

#### Scenario: A page without one

- **WHEN** a page renders no breadcrumb component
- **THEN** the graph MUST have no `BreadcrumbList` and the page node no `breadcrumb`
