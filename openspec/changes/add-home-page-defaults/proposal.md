# Proposal

## Why

The product owner asked whether the home page should have special rules for its
meta tags. The answer is: very few rules about what it emits, and several about
what can go wrong on it. Search engines read site-wide facts from the root page
only (the site name, the site icon, HTML-tag site verification), so a mistake on
the home page costs the whole site. Today the module knows only one thing about
the home page (its canonical is the public base), finds it by a comparison that
misses translations and separate per-language pages, emits a self-canonical
`/index.php/`, and lets an editor break `/` without a word of warning.

A first answer ("title = site name, Organization only on the home page, slogan
as description, verification only on the home page, a 'Home page' scope") was
reviewed and rejected; design.md records why, decision by decision.

## What Changes

- **The front page is decided once, per language, by entity** (new capability
  `front-page`). Every consumer (coupled head, headless head, dialog state,
  Checks, structured data, Site preview) uses the same decision. The state says
  whether the target is the home page now, becomes it when published
  (`staged`), or stops being it (`leaving`).
- **Head output fixes that hit the home page hardest, for every page:**
  - the canonical, `og:url`, hreflang and every `@id` no longer carry the
    script name when a visitor requests `/index.php/…`;
  - a translation is the front page only where the front page setting resolves
    in its language, so a canonical is never an address that does not open;
  - `x-default` is the translation in the site's default language (today the
    entity's original language);
  - separate front pages per language (one alias, one entity per language)
    list each other as alternates;
  - a page or template whose component tree holds a paged listing keeps its
    normalised `page` parameter in the canonical; every other page still folds
    it away;
  - heads are invalidated when the alias the front page setting names changes,
    and when URL language negotiation changes.
- **Structured data:** on the front page the page node says it is `about` the
  site identity; the identity and the website carry the site's alternate names
  (a new, ordered identity field). The identity stays on every owned page.
- **Checks become home-aware where the cost is site-wide:**
  - hidden from search, or a canonical sending search engines elsewhere: *to
    fix* on the front page (a noindex from a configuration override stays *to
    improve*, because it is per environment by design);
  - a front-page address that will stop working: *to fix* (an alias-form front
    page setting with a changed draft alias; a language whose root does not
    open);
  - the page name, search title or shared title that is only the site name or a
    vague word in its own language ("Home", "Etusivu"): *to improve*, fixed by
    renaming the page;
  - text previews off, links not followed, a prefixed default language, a home
    page typed as one product or one article: *to improve*;
  - a template that renders the front node is checked against that node for
    visibility, whatever node the editor previews.
- **The dialog says it is the home page, and what reads it,** with sentences
  that stay true for subdirectory installs and headless frontends. Site gains a
  read-only "Home page" row that says what the home page is and what this
  module can and cannot do there.
- No new scope, no stored home-only setting, no home title pattern, no
  description fallback. No **BREAKING** change for stored data.

## Capabilities

### New Capabilities

- `front-page`: which entity is the site's front page in each language, now and
  after the next publish, and how that is reported to the dialog.

### Modified Capabilities

- `head-output`: "Hreflang links list published translations", "Every
  dependency invalidates the head" (MODIFIED); the front page is the public
  base only where it is the front page, no address carries the script name,
  separate front pages per language are alternates, Metatag's front page
  defaults count on the front page (in the Metatag layer of
  `add-advanced-meta-tags`), a paged listing keeps its page in the canonical
  (ADDED).
- `structured-data`: the identity and the website carry the alternate names;
  the front page is about the site (ADDED).
- `seo-checks`: "Checks describe the page or template being edited", "Title
  rules", "Description rules", "Search visibility rules" (MODIFIED); front
  page visibility, title, address, listing, share image and site name rules
  (ADDED).
- `seo-dialog`: home page caption and true-to-setup sentences (ADDED).
- `site-seo`: "The identity says who runs the site" (added by
  `add-advanced-meta-tags`; alternate names join it), "Without a page in
  context, site settings preview a published page" (MODIFIED); alternate
  names and the "Home page" row (ADDED).

## Out of scope

- Any output on a front page route the module does not own (a Views listing, a
  custom route, an untemplated node). The README non-goal "head output on
  routes it does not own" stays closed in this change; see the open product
  question below.
- Verification codes and Metatag's verification tags: owned by
  `add-advanced-meta-tags`.
- The full identity (address, contact, legal name, merchant policies) and site
  kinds as identity subtypes: owned by the structured-data work. design.md D9
  records the placement rule this change hands over.
- A "Home page" scope, home-only stored settings, a home title pattern, a
  slogan or site-wide description fallback (README non-goal kept), forcing
  `index` on the home page.
- `og:locale` (README non-goal kept), hreflang code validity, favicon checks,
  a check for robots.txt or response headers (not visible to the dialog).
- Writing the front page setting from the dialog. The fix for an alias-form
  setting points to where a site administrator sets it.

No README non-goal is reopened.

## Depends on / overlaps with other changes

This change is last in the order of the active changes. It archives after
`link-values-to-fields` and `add-advanced-meta-tags`, and its MODIFIED blocks
are written on their text.

- **Depends on `link-values-to-fields`.** That change replaces the title
  pattern with a main part and an ending. It also modifies `seo-checks` "Title
  rules" and `site-seo` "Without a page in context, site settings preview a
  published page". This change's blocks for those two start from its text
  (the ending is cut off, facts instead of dynamic values) and add the front
  page. Under both
  title models `og:title` falls back to the page's own name, so the "rename
  the page" fix holds either way.
- **Depends on `add-advanced-meta-tags`.** That change makes the Metatag
  module a resolver layer and adds verification codes on every owned page.
  This change's "Home page" row and home page sentences speak of those codes,
  its block for `site-seo` "The identity says who runs the site" modifies a
  requirement that change adds, and its front page defaults join that
  change's Metatag layer. Its open question "should Metatag's
  front-page defaults count when the entity is the front page?" is answered
  here: yes, decided by `front-page` (tasks.md, 2.8). Its "Verification
  missing from the home page" check keeps its wording and reads the front page
  from `front-page` once this change lands. Its open question on emitting on
  an unowned front page is the same product question as below.
- **Structured-data design (in progress, not yet a change).** It plans an
  identity alternate name among other identity fields; this change adds only
  that field, with the same meaning. It should read the front page from
  `front-page` rather than derive it again.
- `build-ai-on-drupal-ai`, `expose-seo-to-canvas-ai`: no overlap beyond the
  existing Suggest action, which the front page title check offers.

## Open product questions

1. **Site facts on a front page the module does not own.** Emit only the
   site's identity, logo and website nodes (and, with
   `add-advanced-meta-tags`, verification codes) on the front route when it is
   a listing or a custom route, never its title, description, canonical or
   robots? It would narrow a README non-goal. Without it, a site whose home
   page is a listing has no site-name markup on `/`. Recommended: opt-in in
   Site, off by default, in a follow-up change. This change does not depend on
   the answer.
2. **The vague-word list.** A small list per language (about 20 words in
   about 15 languages, data not code), as specified, or a language-agnostic
   rule? Recommended: the list.

## Impact

- PHP: a front page service (per-language map, staged read), `Resolver`
  (`url()`, `publicUrl()`, hreflang, canonical query, cacheability),
  `SchemaGraph` (`front` flag, `about`, `alternateName`), `Values` (identity
  alternate names), `ApiController` (state members, `anyPage()`), config
  schema, a post-update that invalidates rendered output.
- Extension: `checks.ts` (front rules, template governance), `Previews.tsx`
  (no `pathname === '/'` guess), caption and Site row components, a new data
  file of vague words per language, the host contract for Canvas's homepage
  path in its store.
- Canvas internals: the staged homepage configuration update and the
  editor-store homepage path. Both get an ARCHITECTURE.md row and a contract
  test.
- Docs: README (multilingual root, `/index.php` redirect, paged frontends),
  ARCHITECTURE.md §2, §7, §13, §14.
