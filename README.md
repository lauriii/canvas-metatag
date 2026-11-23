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
`content_translation` (hreflang), the `ai` module 1.5 or later (suggestions,
through the `canvas_metatag_ai` submodule), and the Metatag module (see below).

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
preview in Page data is hidden too, because it cannot know the title's ending;
the dialog has its own.

If building the head fails (an invalid site timezone, an incompatible Canvas
version), the page is served with core's head and the error is logged under
`canvas_metatag`.

## Structured data: the Schema tab

The Schema tab opens on what search engines read: one to three plain
sentences built only from the structured data the page ships ("Oak desk lamp,
a product sold by Humanify Studio for €89, in stock."). Each fact in them
leads to where it is set. Under them, one line per search feature the page's
structured data applies to, with a verdict:

- **Can show** / **Complete**: the markup has what the feature asks for.
  A feature without required facts (an article's title, image and date) is
  complete, never "can show".
- **Needs ‹fact›**: what is missing, with a button to set it.
- **Only if people buy it here**: a product's merchant listing waits for the
  answer to "Bought on this page".
- **Doesn't fit**: the feature is not for this, such as a shopping listing
  for a monthly membership. It is gray and never counted.
- **Not shown since ‹date›** / **No longer shown**: a retired feature.
- **No search feature**: the page still says what it is about.

A verdict says what the markup makes possible; search engines decide whether
to show a result. Each line opens its proof: where the feature appears, what
it needs and what also helps, the guidelines no machine checks, the date the
rules were last reviewed and their source (`data/search-features.json`).

**What this page is** is one of these kinds: a product people buy, plans for
a service (memberships, subscriptions and services: no search feature of their
own, never shopping listings), an article (Kind of article: blog post, news
article), an event people attend in person, a person's profile, a job posting
(on a content type only: one page per job), a place people visit (a local
business, or a venue that is not one), a recipe, a course, or a web page (Kind
of page: about, contact, collection). A product says how its price is
**Billed** (once, every month, every year) and whether it is **Bought on this
page**; only then is the site its seller. Site › Prices › Currency is the
currency of every price and pay that names none.

Every detail a kind offers can be filled without writing JSON-LD, and a kind
is offered only where that holds (a contract test pins it):

- **Groups.** A venue, an address, the tickets or the pay is one line that
  opens a sheet with its parts. A group is left out until it has what it
  needs (an address needs a street or city, and a country; a venue its name
  or its address); the box, its sheet and Checks say which part is missing,
  in one sentence with what a search feature asks more of it.
- **References.** An organizer, an employer or an author is one choice:
  your site, or someone else, whose name and website you then give; on a
  content type it can also link a reference field. A venue, a workplace and
  performers point at another page's main thing by linking a reference field
  on a content type; on a Canvas page you give the venue's or workplace's name
  and address. A page described as an accepted kind is referenced by its
  `@id` with its name, address and URL; any other page gives its name; a page
  visitors may not see is never named. On a Canvas page, an organizer or a
  recipe's author nobody set is the site, and Checks says so; choosing
  "Someone else" is kept, and nothing is emitted until a name is typed.
- **Each page's own.** On a content type, a closing date, performers, a venue
  page and a workplace page are linked to a field, never typed once for
  every page.
- **Lists.** On a content type, a multi-value field gives every item in
  order (ingredients, profile links, authors), and one formatted text gives
  its own list items, else its paragraphs, and one long plain text its
  lines. A text list is never typed, so
  ingredients and steps are offered on content types only. Outside text that
  composes, a field of several values on a single detail gives its first
  item, and the menu says "First of ‹n›"; in text that composes, a list gives
  its label and a field of several values every item visitors may see.
- **Codes and durations.** Countries are picked from a searchable list;
  short lists of choices are checkboxes. A time is one box of hours and
  minutes; a linked one asks whether its field counts minutes or hours.
- **Opening hours** are a week with special days, in one sheet.
- **A job description** is linked from a formatted field and keeps only
  paragraphs, lists, line breaks, bold, italics and links to full addresses.
  Where the work is is one answer (on site, fully remote, or on site or
  remote); the workplace and the countries people can apply from follow it.
- **A list page** (a collection page on a content type) lists the pages a
  multi-value reference field holds, in order; three complete courses make a
  course list.

Your own JSON-LD is under **Code › Add your own JSON-LD**, as a **Form** or
as **JSON** over the same text: switching never changes a byte, and the text
is stored exactly as written. A type opens with only what its search features
need ("Rating count or review count" is one group), then every value already
set, then what also helps, and one search over every other detail. A detail
that is an item points at the site, the page or another item before it is
described in place. Paste works in either tab: a script tag, a schema.org
`@context`, an `@graph`, a list of items and empty values are cleaned up and
reported in one line, with **Undo clean-up**; a paste that copies what the
page already makes is reviewed item by item. Each problem names its line, its
path and at most one fix; red is what the server refuses and is never saved
(the text is kept for the next visit), amber is advice. Each item gets its
verdicts, live while typing, and its checks: text that is not on the page can
be left out until it is. On a plain web page one item can be what the page is
mainly about.

For experts, **Output › Add details** adds JSON to the module's own items: the
page's main thing, the page itself, or (at Site scope) the site's identity.
Details merge at any depth; the page's own values always win, per value, and
each clash is named by its path ("“offers.price” comes from the Price field").
A list the module makes takes `offers[*]` (every item) or
`offers[name=Growth]` (one item). The `@id` never changes, and a type can only
be added to. In hand-added items `#identity`, `#logo`, `#website` and
`#return-policy` point at the site's own items from any page; a hand-added item
can never take one of the module's ids. On a content template a whole value
`"{field.field_score}"` (or one reference hop, `"{field.field_venue.title}"`)
is filled from the item's field, and `"{media.‹uuid›}"` from a media item; a
value whose link gives nothing, or text that could not be typed there (such as
an address starting with `javascript:`), is left out. Inside other text these names stay
as written.

The form knows the types and details search features document. To offer every
schema.org type, a site administrator downloads schema.org's vocabulary:
`drush canvas-metatag:vocabulary`. It is fetched over https from schema.org,
trimmed and kept in the site's private files (public ones without a private
path) with its licence: schema.org's definitions are CC BY-SA 3.0, so the
module never ships them. The status report names the installed release. The
dialog reads it through an access-checked route; on a site without private
files the file itself is public, like schema.org's own release.

## The three scopes

| Scope | Where you edit it | Saved | Goes live |
|---|---|---|---|
| **This page** | The editor of a Canvas page | Automatically, into the page's Canvas draft | When the page is published in Canvas |
| **Every \<Type\>**, for example "Every Article" | The editor of the content type's Full content template, previewing one of its items | Automatically, into the template's Canvas draft | When the template is published in Canvas |
| **Site** | Anywhere in Canvas | With "Save for whole site" | Immediately |

A page setting wins over the site's, and a content type's setting wins over the
site's. Site holds what is safe as a site-wide value: who runs the site, the
title's ending and separator, a default social image and the search visibility
defaults. There is no site-wide title or description: a page's own text is the
default.

A title is two parts: the page's own words and an ending, joined by the
separator ("Plans and prices | Example"). The ending is the site name unless a
content type or a page chooses another one, or "No ending". When a title is
too long, its words are cut and the ending stays whole.

Because page and template settings live in Canvas drafts, they show in "Review
changes", can be discarded there, and publish together with everything else in
the draft. Publishing a template also enables it.

A value is either typed text or linked: to a fact such as the page title, the
site name or the author, or, in a template, to one of the content type's
fields, as Canvas offers them for a component in that template (references
included, such as "Venue › Street address"). Typed text is used as it is:
braces are text. The Author fact publishes the display name of the content's
author, which is the account's login name unless something changes it. To
publish another name, install a module that changes display names, or link
"Author name" to a byline field in the template.

In a template, the title's main part, the description, the social texts and
the structured data details that are free text (a name, a headline, a
description, a street address) can also be composed: typed words and up to
eight fields or facts in one value, such as "‹Title› in ‹Venue › City› ·
‹Starts›". A value that links one field keeps its box; press → or End on it,
type `{`, or choose "Add words or fields" in its menu to start composing from
it. In the composer, `{` (or Alt+↓, Enter or the + button by the label) adds a
field at the caret; type `{{` for a brace. A field is moved, selected and
removed as one unit; click it to replace or remove it.

When an item lacks a field, the field is left out with the words that go with
it: the words before a field go with it, the lead-in with the first field
unless it ends in a label mark ("Tickets: "), a closing bracket or quote with
the field before it, and a separator left at the end never shows. Only when
every field of a composition gives nothing does the value give its default.
The composer tints a field's words and shows what an item without it gets.

In a place that composes, fields read as words: a date as the item's language
writes it, in the language's own region or else the site's default country
("20 June 2026" with the United Kingdom, "June 20, 2026" with the United
States, "2026年6月20日" in Japanese), never with a time; a decimal with the
language's marks ("1.234,50" in German); a whole number as stored ("2026"); a
text list as its label. A field with several values gives every item visitors
may see, joined ("Ada, Grace, Lin"), and at most two and "and 1 more" in a
title-like place. Nothing needs configuring.

A link reads what an anonymous visitor may see. A field or a referenced item
visitors may not view gives nothing, and the value falls back to its default;
Checks says so. A few things work differently from what you might expect:

- Outside text that composes, a text list gives its stored key
  (`EventScheduled`), not its label, which is what structured data needs.
- On a single detail that is not text, a multi-value field gives its first
  item; on a list (ingredients, steps, profile links) it gives every item. A
  multi-value media field, such as a gallery, links only its first image.
- While you preview an item visitors cannot see yet, its links are read with
  your access.
- A field deleted after it was linked leaves the link in place; each item uses
  its default until the field is back, and the dialog marks the link.

Where a value is "the first" field of a kind (the description of a content
item is its first formatted text with a summary, its page image the first
image that resolves), first means the order of the content type's form. Fields
not on the form come last.

## Permissions

- **Edit SEO settings in Canvas**: use the dialog for pages and content
  templates. Each page or template also needs Canvas's own edit access. The
  canonical address may point at any site, and search engines and social
  networks then follow it: grant this to people you trust with the page's
  address.
- **Administer SEO site settings**: change Site settings. Changes apply to the
  whole site at once.
- **Use AI suggestions for SEO** (submodule): ask for suggestions. Needs "Edit
  SEO settings in Canvas" as well. Each request sends the page's text,
  including unpublished drafts, to the AI provider.

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
- Title endings and other values of templates and of the site are shared by
  all languages, the words typed in a composed template value included: use
  punctuation ("‹Title› · ‹City›") where words would need translating. The
  fields and dates in it read in each translation's language.
- Published translations get reciprocal hreflang links and an `x-default`.

## AI suggestions (optional)

`canvas_metatag_ai` adds suggestions for the title, the description, the social
card and the structured data type of a page. It needs the `ai` module, 1.5 or
later, with a default provider for "Chat with structured response" or, failing
that, for "Chat". Suggestions are shown for review and are never applied by
themselves.

```
drush en canvas_metatag_ai
```

- **Is it working?** The status report has an entry "SEO suggestions (Canvas
  Metatag AI)". It names the provider and model in use, or says why
  suggestions are off and links to the page that fixes it: the AI settings
  (`ai.settings_form`), the AI providers page (`ai.admin_providers`) or the
  Prompt Library (`entity.ai_prompt.collection`). A prompt removed through
  configuration is added back in the Prompt Library with the machine name
  "default"; if its prompt type is gone too, the entry asks for a reinstall
  of the submodule (`system.modules_uninstall`). Site administrators see the
  same reason in the dialog's Site settings.
- **Prompts.** The wording is in the AI module's Prompt Library
  (`/admin/config/ai/prompts`), as three prompts: "SEO: search result text",
  "SEO: social card text" and "SEO: structured data", each the default prompt
  of its own prompt type. People with the AI module's "Create, Edit, and
  Delete AI Prompts" permission can edit them, and the next request uses the
  new text. They cannot be deleted. Only the prompt named "default" of each
  type is used; other prompts added to these types do nothing, and all of
  them go when the submodule is uninstalled. The variables (`{language}`,
  `{count}`, `{types}`, `{properties}`) are filled by the server. The Prompt
  Library's check asks for them in that form, so keep it; `{{ language }}`,
  which its editor's list inserts, is filled as well. Tokens are not
  replaced, and translations of a prompt are not used: the prompt names the
  language to write in. Two things are added after every prompt and cannot
  be edited: the instruction that the page's text is material, not
  instructions, and the shape of the JSON answer. An empty prompt turns
  suggestions off.
- **Guardrails.** The AI module's global guardrails apply to every suggestion
  call. When their stops reach the lowest stop threshold of the guardrail
  sets, before or after the answer is written, the editor sees "The site's AI
  rules stopped this request." with a next step, and nothing is suggested. The
  module ships no guardrail of its own: it fences the page's text, checks the
  shape of every answer and cleans every value. The stops of all attached
  sets count together against the lowest threshold, so a lenient set's stop
  can block through a strict set that did not stop itself. That fails
  closed.
- **Timeout.** Calls use the AI module's request timeout (AI settings,
  60 seconds unless changed).
- **Logging.** Calls are tagged `canvas_metatag_ai` and, by prompt,
  `canvas_metatag_ai_search`, `canvas_metatag_ai_social` or
  `canvas_metatag_ai_schema`. With the AI module's observability logging on,
  every AI call is logged when its tag list is empty; list
  `canvas_metatag_ai` there to log only these. If it also logs input, the log
  stores the page's text, including unpublished drafts. This module logs each
  failure once on its `canvas_metatag_ai` channel, with the error code, the
  prompt and the exception class, and never the text.

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
- When updating from an earlier version: a content type whose form shows
  its fields in another order than their machine names may now take another
  field for its description or page image (see "The three scopes"). The
  dialog's previews show it before anything is published, and cached pages
  are refreshed when the form changes. An event's organizer was the site
  unless a name was typed; it now is by default on Canvas pages only, so the
  update stores the site as the organizer of every event content type that
  never set one (and of its draft): their heads stay as they were.
- Composed values (release note). No stored value changes, but some output
  does, as fixes: in a template's title, description, social texts and
  free-text details, a text list gives its label instead of its key, a field
  with several values gives every item visitors may see (at most two and
  "and ‹n› more" in a title-like place) instead of its first, and dates and
  numbers can be linked there and read as words. A composition is stored as a
  list of `parts` in the template's configuration: internal configuration that
  frontends never need, because the content API carries the joined head.
  Brace values of earlier releases are now converted whole on templates, but
  only on sites that had not yet run the update; on a site that already did,
  only a database backup has the words it dropped.
- Going back to a release before composed values needs the configuration
  restored from before the update: the earlier schema refuses `parts`, and the
  earlier dialog's first save deletes every composition.
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
data; repeating structured data typed line by line, such as FAQs (lists come
only from multi-value fields and one text's list items; add your own JSON-LD
for the rest); robots rules for single crawlers and AI-training opt-outs (those
belong in `robots.txt`); `og:locale`; image upload or image styles; a site-wide
default description or social text; a UI for translating template or site
values; editing a translation's own SEO text where the Canvas editor cannot
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
- A content type with no content yet shows its SEO settings read-only: Canvas
  keeps no draft for its template until there is an item to preview.
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
