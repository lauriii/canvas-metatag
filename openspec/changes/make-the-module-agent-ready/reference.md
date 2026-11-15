# Reference: the probe's baseline

The probe behind proposal.md, distilled so that task 8.2 can compare the
acceptance run against it and task 2.2 can reproduce its invalid values.
Run on 15 Nov 2026 on the farm site, about six minutes of commands plus
reading time, by a coding agent with a shell, drush, curl and `drush
php:script`, and no browser. The tree held the `link-values-to-fields` value
model (`{text|fact|media|source}`) while README and ARCHITECTURE still
described `{token}` strings. Where anything here differs from proposal.md,
design.md or the spec deltas, those win.

## The seven jobs, before

| # | Job | Outcome | Tries and guesses |
|---|---|---|---|
| 1 | Find out what the module does and how it is configured | Done by reading | About 6 minutes of reading (README 343 lines, ARCHITECTURE 887 lines, config schema, routing, `canvas_metatag.api.php`). No commands, no "as code" section, no machine contract. Allowed keys, facts and types live in `Values::KEYS`, `Values::FACTS` and `data/schema-types.json`; the README never names the registry. The docs' `"{title} {sep} {site}"` would ship literal braces. |
| 2 | Set the site identity and default image | Done, unverified | Guessed how to find a media UUID (`php:eval`; the only listing is the cookie-only `/api/media`). Guessed what "publisher" maps to. `config:set` stored bad values without a word; typed config `validate()` caught only an invalid kind. |
| 3 | Set the Article type's title ending, description from the summary field, BlogPosting | Done through the dialog's internals | Hand-written `{expression: field_summary}` refused with "Choose a field from the list."; the real Canvas expression had to come from `Sources::sourceFor()` via `php:eval` after reading `src/Sources.php`. The title model (main part, `title_end`, site separator) learned from code. |
| 4 | Set a page's SEO values and read its head | Done twice, both off the supported path | Entity save: about 2 tries, publishes at once, no validation (`{"schema":{"type":"Nope","custom":"not json"},"robots":"yes"}` saved with 0 violations). Dialog draft API: 4 tries (400 "The request could not be read.", 409 "Reload the editor.", then success with `autoSaves` copied from Canvas's internal layout endpoint); the PUT replaced every value, so sending a title wiped the structured data. Published head read with curl on the first try; the JSON head needed canvas_headless and 2 tries at the parameter name; the draft head only through the cookie-only `/state`. |
| 5 | Does the page pass the checks? | **Impossible** | The checks run in the dialog's script on the editor preview and a pixel measurer. Only `resolved.schema` (`withheld`, `missing_required`, `missing_recommended`) was reachable, through a cookie session. No exit code, no severities. |
| 6 | Add hand-written JSON-LD | Done with refusals | `@context` refused ("Only "@type" and "@id" may start with @."), `@graph` refused, `javascript:` refused, non-JSON refused, all without a JSON pointer. A node reusing the module's `#identity` `@id` was accepted, then silently dropped at output. |
| 7 | Make it reproducible on another environment | Partly | `config:export` covers the site config and template settings, but the README shows no recipe actions. `content:export --with-dependencies` exported one entity and missed the media named inside the SEO JSON; identity media are UUIDs with no dependency. Nothing verifies after import that media, links and types still resolve. |

Baseline summary used by task 8.2: two jobs (3 and 4) needed the dialog's
internals, one (5) was impossible, and every job needed at least one guess.

## The six invalid stored values (task 2.2)

A page stored around the API with these values produced a "clean" head and a
report that mentioned none of them:

| Key | Stored | Read mode did | Write mode would say |
|---|---|---|---|
| `canonical` | a `javascript:` address | fell back to the page's own URL | "Enter a full address that starts with https://, or a path that starts with /." |
| `robots.max_snippet` | `5000` | dropped; robots only `noindex` | "Enter a number from 0 to 1000, or -1 for no limit." |
| `schema.type` | `"Prodcut"` (a typo) | fell back to WebPage | "Choose one of the listed page types." |
| `schema.props.offers_price` | an invalid price | dropped | "This setting is not available here." while the type is wrong; with the type fixed "Enter a number, like 49 or 49.90." |
| `social.image` | a bad media reference | dropped | "Choose a value from the list." |
| `bogus` | an unknown key | dropped | "This setting is not available here." |

`resolve()` returned `schema: {withheld: false, missing_required: [],
missing_recommended: []}` for it.

## Other observations the design relies on

- The social title falls back to the page title, not the search title (by
  design, but surprising to an agent).
- A Product on a page with an image had no `image` in its node.
- `drush uli` plus a cookie jar was the only way to reach the HTTP API, and
  leaves an admin session open; the commands run with `--uid` instead.
- Cleanup after the probe was checked: no pages or auto-save entries left,
  the page returned 404, no site configuration, template or other content
  changed. The acceptance run (tasks 7.2 and 8.1) must leave the site the
  same way.
