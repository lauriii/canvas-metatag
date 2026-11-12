<img src="assets/icon.svg" width="64" height="64" alt="">

# Canvas Metatag

Search, social and structured data settings for Drupal Canvas, edited where the
page is edited. The module adds an **SEO** dialog to the Canvas editor and
renders the result: title, description, robots, canonical, hreflang, Open
Graph, a card hint and one JSON-LD `@graph`. It works for pages Drupal renders
itself and for sites that deliver through `canvas_headless`.

## Requirements

- Drupal core 11.3 or later, PHP 8.3.
- [Drupal Canvas](https://www.drupal.org/project/canvas). The module is
  developed and tested against Canvas 1.x-dev. Earlier releases are untested.

Optional, each detected when present: `canvas_headless` (headless delivery),
`content_translation` (hreflang), the `ai` module (suggestions, through the
`canvas_metatag_ai` submodule), and the Metatag module (see below).

The dialog reads the editor's state and writes into the editor's drafts. Canvas
has no public API for either yet, so the module depends on Canvas internals.
`tests/e2e/host-contract.spec.ts` checks every one of them against the real
editor and is the test that fails when Canvas changes. How the module is built,
and the full list of those internals with the test that pins each, is in
[ARCHITECTURE.md](ARCHITECTURE.md).

## What the module takes over

Enabling the module takes over `<head>` for

- every Canvas page, and
- every node shown through an enabled **Full content** content template.

On those pages there is exactly one title, one canonical link, one set of
hreflang links and one JSON-LD script. Core's own canonical and shortlink links
and the hreflang links of Content Translation are removed there. Every other
route (Views, error pages, nodes without an enabled Full template) is left
exactly as it was.

If the Metatag module is installed, its values are no longer used on the pages
above, and its fields are hidden in Canvas's Page data form and in the edit
form of a node whose type has an enabled Full template. It keeps working
everywhere else. For such a page or node Metatag stays silent on every route,
including the revision, latest-version and preview routes of a node, where this
module emits no head either: those show the title only. Canvas's own search
preview in Page data is hidden too, because it cannot know the title pattern;
the dialog has its own.

If building the head fails (an invalid site timezone, an incompatible Canvas
version), the page is served with core's head and the error is logged under
`canvas_metatag`.

## The three scopes

| Scope | Where you edit it | Saved | Goes live |
|---|---|---|---|
| **This page** | The editor of a Canvas page | Automatically, into the page's Canvas draft | When the page is published in Canvas |
| **Every \<Type\>**, for example "Every Article" | The editor of the content type's Full content template, with a page to preview | Automatically, into the template's Canvas draft | When the template is published in Canvas |
| **Site** | Anywhere in Canvas | With "Save for whole site" | Immediately |

A page setting wins over the site's, and a content type's setting wins over the
site's. Site holds what is safe as a site-wide value: who runs the site, the
title pattern and separator, a default social image and the search visibility
defaults. There is no site-wide description: a page's own text is the default.

Because page and template settings live in Canvas drafts, they show in "Review
changes", can be discarded there, and publish together with everything else in
the draft. Publishing a template also enables it.

Values can contain dynamic values such as the page title, the site name, or, in
a template, the content type's own fields. `{author}` publishes the display
name of the content's author, which is the account's login name unless
something changes it. To publish another name, install a module that changes
display names, or bind "Author name" to a byline field in the template.

## Permissions

- **Edit SEO settings in Canvas**: use the dialog for pages and content
  templates. Each page or template also needs Canvas's own edit access. The
  canonical address may point at any site, and search engines and social
  networks then follow it: grant this to people you trust with the page's
  address.
- **Administer SEO site settings**: change Site settings. Changes apply to the
  whole site at once.
- **Use AI suggestions for SEO** (submodule): ask for suggestions. Needs "Edit
  SEO settings in Canvas" as well.

Canvas shows the SEO button to every editor; without the first permission the
dialog says so.

The API accepts browser sessions only (no bearer tokens). The permissions gate
the dialog and its API. Reading the stored field (for example through JSON:API)
needs one of the first two permissions; visitors get the rendered head.
Writing it is not restricted, because Canvas refuses to publish a page whose
changed field the publisher cannot edit. Anything else that may edit a page
(custom code, a writable JSON:API) can set the field, and whatever it stores is
cleaned again before it is rendered.

## Translations

- Settings are per translation. The dialog edits the translation the Canvas
  editor edits, including a translation that so far exists only as a Canvas
  draft.
- A new translation starts without overrides. It follows the default-language
  version's search visibility, social image and page type until it sets its
  own, and never inherits its canonical address or its text. The details of an
  inherited page type (a product's price) are the translation's own.
- Its title and description are the translated page title and description.
- Title patterns of templates and of the site are shared by all languages.
- Published translations get reciprocal hreflang links and an `x-default`.

## AI suggestions (optional)

`canvas_metatag_ai` adds suggestions for the title, the description, the social
card and the structured data type of a page. It needs the `ai` module with a
default chat provider. Suggestions are shown for review and are never applied by
themselves.

```
drush en canvas_metatag_ai
```

## Headless delivery

With `canvas_headless`, the same head is the `head` member of the content API
response (`title`, `meta`, `link`, `script`), for published content and for
draft previews of the full view. Addresses in it (the canonical link, `og:url`,
hreflang, every JSON-LD `@id`) use the public address, and the page on Drupal's
own address declares that copy canonical. Image addresses stay on Drupal, where
the files are.

The public address is, in this order: the `canvas_metatag_public_base` setting,
the first configured headless frontend, else the address of the request. The
first frontend is where the editor previews; when visitors use another address
(a preview app on its own host), set it per environment in `settings.php`, so
that a configuration import cannot move it:

```php
$settings['canvas_metatag_public_base'] = 'https://www.example.com';
```

Rebuild caches after changing it. Site › Identity shows the address in use and
where it comes from.

The headless head depends on Canvas resolving this module's content
controller. If a Canvas update changes that, the status report shows an error
for "SEO for headless content".

What reaches visitors is the frontend's decision. This is what the Canvas SDK
packages do with `head`, read in the Canvas 1.x-dev source, not tested against
running frontends:

| Package | What it renders from `head` |
|---|---|
| `@drupal-canvas/headless-tanstack-start` (`toTanStackHead()`) | Everything, including JSON-LD |
| `@drupal-canvas/headless-angular` (`CanvasDocumentHead`) | Everything, including JSON-LD |
| `@drupal-canvas/headless-next` (`toNextMetadata()`) | Title, description, robots, canonical, hreflang, the card hint, and Open Graph title, description, URL, type, site name and image. Not `article:*`, not the `og:image:*` details, not JSON-LD |
| `@drupal-canvas/headless-nuxt`, `@drupal-canvas/headless-astro`, `@drupal-canvas/headless-react` | Nothing by themselves: the app passes `head` to its own head manager |

Where JSON-LD is not rendered for you, render `head.script` yourself, with the
SDK's serializer, never with plain `JSON.stringify()`:

```tsx
import { serializeJsonForHtml } from '@drupal-canvas/headless';

{page.head.script?.map((script, index) => {
  const json = serializeJsonForHtml(script.textContent);
  return (
    <script
      key={index}
      type={script.type}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
})}
```

Robots and the canonical link must be in the HTML the server sends. Search
engines do not reliably pick them up when they are added in the browser.

The canonical link is written into `head.link` by this module directly:
Canvas's own head builder drops canonical links, and this one must reach the
frontend.

Notes for Canvas. In the code, places that exist only until Canvas changes are
marked `UPSTREAM(canvas)`; ARCHITECTURE.md lists every ask:

- A head alter hook in the `canvas_headless` head builder would replace this
  module's decorator of the content controller.
- `@drupal-canvas/headless-next` should map `article:*` and `og:image:*`, and
  render `head.script`.

## Deployment

- Site settings are the configuration object `canvas_metatag.site`. A content
  type's settings are a third-party setting of its content template. Both
  export and import like any other configuration.
- A configuration import that changes a template's SEO setting discards that
  template's unpublished Canvas draft on the target site, as Canvas does for
  any other change to a template.
- To keep a staging site out of search engines, override the site setting in
  its `settings.php`. The dialog shows such pages as hidden and says the
  setting comes from outside:

  ```php
  $config['canvas_metatag.site']['values']['robots']['noindex'] = TRUE;
  ```

## What it does not do

XML sitemaps, redirects, `robots.txt` or `llms.txt`; keyword or readability
scoring, or any score; bulk editing; overrides for a single node (a node uses
its content type's settings); import of Metatag data; search console
integrations; head output on routes it does not own; breadcrumb structured
data; repeating structured data such as FAQs or recipe steps (use custom
JSON-LD); robots rules for single crawlers and AI-training opt-outs (those
belong in `robots.txt`); `og:locale`; image upload or image styles; a site-wide
default description or social text; a UI for translating template or site
patterns; editing a translation's own SEO text where the Canvas editor cannot
open that translation; a frontend npm package; dark mode. Site settings are not
locked while someone edits them: the last save wins.

## Known limitations

- A dialog save and an editor save of the same page in the same instant can
  overwrite each other in the draft. The dialog reads its value back after
  every save and writes it again (up to five times), and reports a change it
  could not store; Canvas has no way yet to make the two one write.
- The headless head depends on Canvas resolving this module's content
  controller (see "Headless delivery").
- A page image's alt text comes from the media item's default language.
- With a language per domain and a headless frontend, addresses stay on the
  Drupal domain.
- Images count only when their file is in the public file system.
- Under a configuration override of a content template's SEO setting, the
  dialog's fields show the stored setting while its previews and the output
  use the override.
- Changing `canvas_metatag_public_base` takes a cache rebuild.
- Tested in Chromium on a single-language site. Translations are covered by
  kernel tests; a multilingual site, screen readers, Firefox and Safari were
  not tested in a browser.

ARCHITECTURE.md ("Known limitations and non-goals") has the technical detail.

## Development

The extension is a React app in `extension/`. Its build output in
`extension/dist/` and the asset hashes in `extension/index.html` are committed.

```bash
cd extension
npm install
npm run verify   # Type check, unit tests, forbidden-pattern check, build.
npm run dev      # Rebuild on change.
```

Run the PHPUnit tests with Canvas's configuration, from the Drupal root:

```bash
vendor/bin/phpunit --configuration web/modules/contrib/canvas/phpunit.xml.dist \
  web/modules/contrib/canvas_metatag/tests \
  web/modules/contrib/canvas_metatag/modules/canvas_metatag_ai/tests
```

Playwright end-to-end tests live in `tests/e2e/`. Every spec file installs a
seeded site of its own (`tests/src/TestSite/CanvasMetatagTestSetup.php`), so run
them where the Drupal command line and the web server share a file system, for
example inside the web container of a local development site. The `headless`
and `ai` projects need `canvas_headless` with its dependencies and the `ai`
module in the codebase.

```bash
cd tests/e2e
npm install
npx playwright install chromium
DRUPAL_TEST_BASE_URL=https://drupal.example.com npx playwright test
npx playwright test --project=coupled --no-deps page.spec.ts   # One spec.
```

The suite has four Playwright projects. `host-contract` runs first and the
other three (`coupled`, `headless`, `ai`) depend on it; `--no-deps` skips it.
The environment variables, including the one for running Playwright outside the
web container, are listed at the top of `tests/e2e/fixture.ts`.
