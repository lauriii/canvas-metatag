# Proposal

## Why

Template values refer to content through dynamic values written in braces and
shown as chips inside text. Chips are hard to read, edit and announce, and
almost every stored value is either one whole source ("the summary field") or a
title with an ending ("‹title› | Journal"). The product owner asked for a
better way to set these values, and for Canvas's own field linking (its
entity-field prop sources) to replace the module's field tokens.

## What Changes

- **A value is typed text or linked to one source.** Linking replaces the input
  with a box that names the source and shows the previewed item's value. There
  are no chips anywhere. Typed text is never parsed: braces are literal text.
- **The title has two parts:** a main part and an ending, joined by the site's
  separator. An empty part drops out with its separator. The site sets the
  default ending (its name, "No ending", or typed text); pages and types may
  override it. A page's title is only the editor's own words.
- **A link that is empty for an item gives the field's own default.** The
  fallback cannot be configured. Preview and output follow the same rule.
- **Every link has a state:** linked, empty for this item, hidden from
  visitors, or broken (the field was deleted or changed type). Broken and
  hidden links are listed in Checks.
- **Where linking exists:** every value of a content type's template; on a
  page, only structured data details of kind address, date and image, which
  may link to the page's own facts. Site settings link nothing.
- **Facts stay the module's own:** title, site name, page address, author,
  first published, last updated, description and image. They keep their
  current meaning and access rules.
- **Full plan (recommended): fields are Canvas sources.** A template's field
  link is stored as a Canvas entity-field prop source. The link menu offers
  the fields Canvas offers when linking a component prop, with Canvas's labels
  and order, and can follow references ("Writer › Title"). A CI job runs the
  module's Canvas contract tests against Canvas's development branch.
- **Stored values are converted by an update.** Titles are split into main
  part and ending, whole dynamic values become links, and anything that cannot
  be kept is logged. **BREAKING** for code that reads stored values: they are
  maps, not strings.
- **BREAKING:** free composition such as "‹Title› by ‹Byline›" can no longer be
  stored. The update keeps the first part of such a title and logs what it
  dropped.
- **BREAKING:** the dialog's state no longer has `tokens`; it has `facts`,
  `separator`, the template's link entries and its broken links.
- **BREAKING (full plan only):** a text list field gives its stored key, not
  its label; following a reference needs view access to the referenced entity,
  not only to its label.
- Custom JSON-LD keeps its fill of the module's fixed names. Field names in it
  (`{field.NAME}`) are no longer filled.
- AI title suggestions are written for the main part, knowing the ending that
  will be added. AI text is stored as typed text, so braces in it stay
  literal.

## Decisions taken

- **Full plan** (product owner, 2026-11-13, recorded in the implementation
  run's decisions: "just do it all and make sure quality is high";
  "experience needs to be clean even though we're making this more
  powerful"). Fields are Canvas entity-field prop sources at template scope,
  contained in one class (`src/Sources.php`), pinned by `SourcesTest` and run
  against Canvas's development branch by the `phpunit (canvas dev)` CI job.
  The fallback stopping point (tasks group 5) was not built; its migration
  step folded into the one post_update.
- Decisions 2 and 3 below were taken as recommended: an empty, hidden or
  broken link gives the value's default, and a multi-value field gives its
  first item.
- Test providers only: the AI tests use the module's echo and test
  providers.
- Review round 1, under the product owner's "experience needs to be clean":
  the link menu lists what fits first and folds the rest into one last row
  (the spec's "shown disabled with a reason" kept behind it); a choice detail
  fits only a list field; a structured data detail that follows the
  Description fact shows the description as search shows it, as the head
  already emits it, rather than renaming the fact; two fields of one type
  with one label keep their machine names; length stays guidance on focus,
  not at rest (seo-dialog "Title and description lengths are guidance"); a
  page may no longer link its social image to its own default, the Image
  fact.
- Review round 2, under the same words: an entry through a reference that
  only the previewed item hides (an unpublished venue) stays pickable and
  says so, since every other item gives it; a field visitors may never view
  stays disabled. What does not fit inside a level waits in the menu's one
  last row. A linked box beside another detail keeps two lines, cut at their
  ends. A linked box offers its × and no Reset beside it. Site sets the title
  ending as a field of its own, without the "Page title" pill. A page's
  details whose only fact is their default get no link button. Galleries
  (several images) stay unlinkable (README, Known limitations); the hidden
  image scenario uses an unpublished poster instead. A Canvas computed address
  (`␞␟url`) is no longer offered: it keeps what the first account to read it
  saw. A linked ending that gives nothing for the item falls back to the
  site's ending, as an unset one does.

## Open decisions (product owner), as they were put

1. **Full plan or fallback.** Recommended: the full plan above.
   - *Full plan:* fields become Canvas prop sources, stored in the module's
     configuration and content, with the contract tests and a CI job against
     Canvas's development branch that someone must own. Gains Canvas's field
     vocabulary, references and labels.
   - *Fallback:* ship only the new value model and linking UI, with fields
     still read by the module's own code (one level, today's field types).
     This answers the first ask (better UX) without the second (Canvas
     sources). It carries no Canvas grammar in stored data.

   `tasks.md` reaches the fallback as a shipped, tested state at the end of
   group 5. Choosing the fallback means stopping there and removing these
   requirements from the deltas before archiving, with nothing else in the
   specs changing:
   - `dynamic-values`: "A field link is stored as a Canvas field source",
     "Links can follow references", "Field links offer what Canvas offers",
     "A node visitors cannot view yet is previewed with the editor's access";
   - `value-links`: "A reference opens as a level in the link menu".
2. **The fallback of an empty link is always the field's default.** Is that
   enough? The stored shape can take an explicit fallback later without a
   migration.
3. **A multi-value field gives its first item.** Is that enough, or should
   text values join their items?

## Out of scope

- Free composition of values inside text (prefixes, "by ‹Author›"). If real
  demand appears, the ending may accept a short typed lead-in.
- Linking at page scope beyond structured data details, and any linking at
  site scope: a site value has no content type to read fields from.
- Adapters or formatting choices on a link (image styles, date formats).
  Formatting follows the value's kind.
- Translating template or site text (an existing non-goal).
- Canvas's own suggestion HTTP route and its UI components: the dialog runs
  in a separate frame and cannot use them.

No README non-goal is reopened.

## Follow-ups

- **The `phpunit (canvas dev)` job has not run in a pipeline yet** (tasks 6.4
  and 8.1). The job is in `.gitlab-ci.yml`, but the implementation run could
  not start a pipeline: the branch is not pushed, and gitlab-ci-local's
  images do not fit beside the sites on the shared development machine. What
  the job runs was run instead: the `canvas_metatag_canvas_contract` group
  (`SourcesTest`, `PostUpdateTest`) against Canvas's development branch
  (`1.x-dev`), green. The first pipeline of this branch must show the job
  green; if `composer require drupal/canvas:1.x-dev` does not resolve on the
  runner, fix the job before the next release.

## Dependencies

- **Depends on `build-ai-on-drupal-ai`**, for task group 4 and the
  `ai-suggestions` delta only. The title ending sentence is part of the fixed
  text that change adds after the Prompt Library prompt. Groups 1–3 and 5–8
  do not need it and may start first. Archive this change after it.
- **Followed by:**
  - `add-advanced-meta-tags`: its stop date and other tags use this change's
    value type, link control and link states, and its deltas for head-output,
    site-seo and value-links are written on this change's text.
  - `expose-seo-to-canvas-ai`: its `ai-suggestions` delta keeps this change's
    title variant rule, and its suggestion tool sends the title ending and
    keeps braces as text.
  - `add-home-page-defaults`: it builds on this change's title rules and
    site settings.
  - A later change for suggestions at template scope, not yet proposed: AI
    there must choose a source, which this change introduces.

## Capabilities

### New Capabilities

- `value-links`: how the dialog links a value to a source and shows it: the
  link control, the linked box and its states, the link menu, unlinking, and
  the title ending's menu.

### Modified Capabilities

- `dynamic-values`: brace values are replaced by typed text, facts, field
  links and chosen media; field links, their states and their conversion.
- `head-output`: the title is a main part and an ending; the description,
  social texts and image follow links and fall back to defaults; the article
  times are named as facts.
- `site-seo`: the site sets a title ending instead of a pattern.
- `page-seo`: a page stores its own title words and may set an ending.
- `template-seo`: type values are typed or linked; deleting a linked field
  leaves the template alone.
- `structured-data`: detail values are typed, facts, links or media; the page
  node's dates are named as facts; custom JSON-LD stops filling field names.
- `seo-dialog`: chips and the title pattern are removed; the title is edited
  as two parts.
- `seo-checks`: empty dynamic values are no longer reported; broken and
  hidden links are; the repeated site name fix sets "No ending".
- `ai-suggestions`: title suggestions know the ending; braces are kept as
  text.
- `draft-writes`: refusals name links instead of dynamic values.
- `seo-access`: the state's draft data includes facts and link values instead
  of tokens.

## Impact

- **Server:** `Values`, `Resolver`, `SchemaGraph`, `ApiController`; a new
  converter and `canvas_metatag.post_update.php`; full plan only: a new
  `Sources` class, the only one that may use Canvas's prop source, shape
  matching and expression classes.
- **Configuration:** `canvas_metatag.schema.yml` (a value type),
  `config/install/canvas_metatag.site.yml` (no stored title),
  `data/schema-types.json` (defaults become facts).
- **Client:** new value, link box, link menu, value and title controls; the
  chip editor, its CSS and the brace helpers are deleted.
- **AI submodule:** the request carries the ending, and the fixed text added
  after the search result prompt says how it is used; brace stripping is
  deleted.
- **Canvas internals (full plan):** the entity-field prop source shape and
  expression grammar (persisted), `PropSource::parse()` and evaluation,
  `PropSourceSuggester::suggest()`, `Labeler`, and the Canvas image JSON
  schema reference. Each gets a row in ARCHITECTURE.md §11 and a contract
  test.
- **CI (full plan):** a new PHPUnit job against Canvas's development branch.
  It is not allowed to fail.
- **Docs:** ARCHITECTURE.md §4–6, §11, §17; README (field reading, accepted
  regressions, known gaps).
