# Product decisions

The product owner's decisions that the open changes in `openspec/changes/`
rely on, recorded on 2026-11-13 and 2026-11-14 for the implementation run.
The product owner asked for everything to be done with high quality and said
"experience needs to be clean even though we're making this more powerful".
Where a change left a decision open, the lead took the recommended option
below.

Each item names the change that implements it, and that change's
`proposal.md` records the decision it relies on. Item numbers are stable:
specs and proposals cite them as "(decisions.md, item N)". Add new items at
the end; never renumber.

The SEO dialog's visual rules (tokens, components, review checklist) are in
`design-system.md`.

1. link-values-to-fields: FULL PLAN (Canvas entity-field prop sources at
   template scope, contained in one Sources class, pinning tests, and a CI
   job against Canvas's development branch). Not the fallback.
2. Naming search engines / platforms in UI copy: NO. Keep neutral wording
   ("In search results", raw tag names in Services). Repo rule stands.
   Documentation links in the rules file may keep their URLs only in a data
   file, never in UI copy. Applies to every change (cited by
   populate-every-schema-type and extend-structured-data-by-id).
3. Reopened README non-goals (record in README "Non-goals" edits):
   - head alter hook for developers (hook_canvas_metatag_head_alter): yes
     (add-advanced-meta-tags);
   - page-level AI directives for the one crawler that reads them, two fixed
     choices: yes (date-sensitive, 1 Feb 2027) (add-advanced-meta-tags);
   - breadcrumb structured data, only where a breadcrumb block shows: yes
     (read-page-components);
   - repeating structured data, only for lists from set-up components or
     multi-value fields mapped by populate-every-schema-type: yes.
   Everything else stays closed (sitemaps, redirects, robots.txt/llms.txt
   management, keyword scoring, bulk editing, per-node overrides, metatag
   import, search-console integration).
4. Front pages the module does not own: no output there (keep closed);
   Checks explains. Revisit later as an opt-in. (add-home-page-defaults)
5. Vague home-page title check: a small per-language word list in a data
   file. (add-home-page-defaults)
6. "Plans for a service" is the default kind for pricing components;
   memberships/subscriptions are not steered to merchant listings.
   (populate-every-schema-type, derive-structured-data-from-components)
7. Components bet (derive-structured-data-from-components): GO, gated on the
   kernel test that component values are read as an anonymous visitor and on
   the budgets: +10 ms warm on page delivery, +300 ms cold on the dialog's
   state route for 20 mapped components, 10,000 nodes for reach.
8. Phase order as written (rethink first). The human usability gate (4 of 5
   marketers) cannot run here: replace it with a simulated first-time-user
   walkthrough by an independent agent and record that it is a substitute.
   Applies to every change with a usability gate.
9. AI: never call a paid provider. Kernel and e2e tests use the echo/test
   providers only; any agent-capable test must fail if another provider is
   called. Applies to every change (cited by populate-every-schema-type and
   extend-structured-data-by-id).
10. The automatic main-thing choice for components: default "Ask whoever
    edits the page", never automatic for products.
    (derive-structured-data-from-components)
11. Hand-added JSON-LD can be filled as a form or as JSON (product owner,
    2026-11-13: "make it easier to fill the custom json-ld, you should either
    fill as form or as json (if you want to just copy paste)"; plus "take
    inspiration from" a schema editor plugin for another site builder:
    learned from, improved on, never copied or named). Built in
    extend-structured-data-by-id (amended before the workflow reaches it);
    design and review resolution in that change's `design.md`. The lead took
    the recommended option for each question:
    - REOPENS extend's "a visual builder for arbitrary schema.org types" (out
      of scope) and "no schema.org vocabulary at runtime" (non-goal, also in
      rethink): yes, inside the two expert sheets only ("Add your own
      JSON-LD", "Add details"). The main path stays kinds, verdicts and the
      read-back.
    - NARROWS populate's "no general nested-object editor" and "no Add item
      repeater" to the registry's facts.
    - Vocabulary: the site downloads schema.org's release with
      `drush canvas-metatag:vocabulary` (CC BY-SA 3.0, not redistributed);
      the module ships only its own one-line descriptions of documented
      types. No in-dialog download button.
    - Hand-added JSON-LD is stored as written (keys no longer sorted), with a
      re-encode probe, non-finite numbers refused, and the 32 KB cap counted
      minified (64 KB raw).
    - `@type` may be a list of 1-4 types; a schema.org `@context` is accepted
      and left out of the output.
    - Decision 3 ("typed lines of repeating content are never allowed")
      governs the module's own facts only; hand-added JSON-LD may repeat.
    - Field links inside hand-added items on templates: yes, whole values
      only (`{field.x}`, one hop), filled through Sources; images by
      `{media.uuid}`. This reverses link-values' "field names in hand-added
      JSON-LD are no longer filled" for whole values only; mixed text stays
      literal.
    - Module ids are reserved: a hand-added item can't take one and two can't
      share one (refused at save); `#identity`, `#logo`, `#website`,
      `#return-policy` point at the site's own items; a post-update renames
      old collisions without changing any page's output.
    - Rethink's "reviews of your own organization" (G7) narrowed: only the
      identity or an organization matching its address or profiles; an
      employer rating of another company is not flagged.
    - Sheet name stays "Add your own JSON-LD"; Form is the default tab,
      remembered per viewer. No AI on hand-added items (decision 9 stands).
    - Cut to keep it clean: no repair library, no Rename @id or Duplicate,
      no JSON value menu, no cross-page references, no multi-step undo.
      Reach counts for hand-added items come with set-up-types.
12. Strong zero-config sharing defaults (product owner, 2026-11-14: "make
    sure the defaults are really strong ... whenever it's being reference in
    social media etc everything just look good"). Built as the new change
    `strengthen-zero-config-defaults`, inserted right after
    `read-page-components`; design and review resolution in that change's
    `design.md`. The lead took the recommended option for each question:
    - 12.1 REOPENS the README non-goal "image upload or image styles" for
      made share images only: a card drawn from the title and a 1200 x 630
      version of a page's own image, served by a module route. No upload UI,
      no core image styles, no focal point.
    - 12.2 REOPENS the README non-goal `og:locale` (with alternates).
    - 12.3 New installs share a card made from the title; upgraded sites with
      a default image keep "Use this image"; a third choice is "No image".
    - 12.4 A page still named with Canvas's placeholder takes its first
      heading; without one it keeps the placeholder and its own card, never
      the home page's title or card. "Name this page" is fix once published.
    - 12.5 A Canvas page without a description uses its own text after its
      first heading, never text another published page also offers; a node
      with only a long text field gets a description from it.
    - 12.6 Site icons on the owned front page only, while the theme uses
      core's default favicon. Icons on every route and a theme-color tag stay
      out ("head output on routes it does not own" stays closed).
    - 12.7 Bundle open-licence (OFL) fonts, subset; the font family names
      appear in the repo because their licences must ship with them.
    - 12.8 A cut title keeps its ending and loses words from its main part
      (reverses harden-template-scope's "the cut removes the ending").
    - 12.9 Home page (amends add-home-page-defaults, replacing its D10 "no
      home rules"): a vaguely named owned front page is titled "{Site name}"
      plus " | {slogan}" when Drupal has a slogan, its og:title is the same,
      it shares the site card when it has no image, and it falls back to the
      identity description (front page only; the slogan is never a
      description).
    - 12.10 describe-the-publisher: the organization logo falls back to the
      theme's own logo (not core's); Drupal's slogan is the organization's
      `slogan`. No derived alternate name.
    - 12.11 Card look: no host line; a small line only for article, event,
      product, recipe, job posting and person kinds (date without time, the
      kind's own name, a person's job title), none for page-like types, no
      prices or durations; no per-type label setting. Colours stay the
      brand's: text contrast 5.5:1 for titles and 4.5:1 for small text
      (measured), instead of darkening every brand to 7:1.
    - 12.12 Logos: SVG logos give the card's colour and a monogram mark; SVG
      is never rasterised (one engine, no external fetches). Site > Sharing
      asks for a PNG version in words.
    - 12.13 Made images are served by a module route outside the files path
      (no web-server rule), stored, immutable-cached, cards with
      `X-Robots-Tag: noindex`; no lock, no flood control, no cron pruning.
    - 12.14 The dialog stays clean: one Site > Sharing section (two-option
      sample, Logo, Colour in words, "When a page has no image"); the Social
      view shows the real image once; a card is an improve Check only on
      article, event, product and recipe pages.
    - Deferred: theme-color and icons on every route, a CJK/Indic/Thai font
      pack, focal point, hyphenation, a Chat / Feed / Search preview switch
      (offered to refine-seo-dialog).
13. make-the-module-agent-ready (coding agents use the module from a shell)
    - Writes: pages go to the Canvas draft; site and content-type settings
      are stored live so config export sees them; `--to` overrides.
    - Config import / recipes: refuse bad shapes, naming config and path.
    - No installable agent skill for now; commands + README + paste-in block.
    - Preview-only checks (headings, alt text, measured lengths) are listed as
      "not checked" from the shell; revisit after the acceptance run.
    - One change, landing last in the queue (after describe-the-publisher).
