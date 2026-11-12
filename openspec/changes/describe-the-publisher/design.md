# Design

## Context

See proposal.md for why. The identity is part of `canvas_metatag.site`
(simple config, last save wins, live at once). Its nodes `{home}#identity`,
`{home}#logo`, `{home}#website` are on every owned page, so every head
carries `config:canvas_metatag.site`. On the farm site the header and footer
are components inside every page tree, not in page regions. After
`read-page-components`, `Sources` can read a component prop on any entity
with the visitor account rule.

## Goals / Non-Goals

**Goals:** a publisher that reads back in one sentence; identity values that
cannot disagree with the footer; no site-wide cache churn from linking.

**Non-Goals:** reading profiles from arbitrary pages; guessing profiles.

## Decisions

### 1. Linked identity values

An identity value may be `{component: {source: region|front_page, uuid, prop}}`.
A region source is preferred: every page render already depends on the
region, so the head gains no new dependency. A front-page source is resolved
into a derived identity stored in `cache.default`, keyed by language, under
the tag `canvas_metatag:identity`; `hook_canvas_page_update` on the front page
recomputes it and invalidates the tag only when the value changed. Heads
carry `canvas_metatag:identity`, never the front page's own tags.

*Alternative:* add the front page's tags to every head (rejected: each
front page publish would clear the whole site's page caches).

### 2. Profiles are ticked

The link menu for Profiles lists a component's link props with a tick each.
Ticks are pre-set only for hosts on a short allowlist of profile and
knowledge-base hosts (`data/profile-hosts.json`, reviewed with the rules
file); same-site links, links on the site's registrable domain and `mailto:`
are never ticked. Stored: the prop path plus the ticked indexes. `sameAs`
asserts the same entity, so partner, client, credit and policy links must
never reach it.

### 3. Identity depth

New keys: `site_name` (website node name; default the identity name),
`description`, `email`, `telephone`, `address {street, locality, region,
postal_code, country}`, `opening_hours` (days and times, the site timezone),
`subtype` (`Organization`, `LocalBusiness` and a short list of its kinds).
A local business emits its address and `openingHoursSpecification` on the
identity node.

### 4. Verdicts

The Site stage shows the `site-name` verdict (from `rethink-structured-data`),
`organization-logo` for organizations only, and a new `local-business`
feature (required name and address; recommended telephone and opening
hours). The stage sentence uses the `say` of the identity kind.

### 5. Legal name proposal

A copyright line in a region or front page component ("© 2025–2026 Humanify
Example Ventures Inc.") is parsed for a name after the years; it is offered
as guidance with "Use it". Never applied by itself.

### 6. Save effect

`putSite` dry run (from `rethink-structured-data`) names where the change
goes live; the button reads "Save and apply".

## Canvas internals relied on

Region component trees and the front page tree, through `Sources` (rows added
by `read-page-components`). `hook_canvas_page_update` (or the entity update
hook for `canvas_page`) to recompute the derived identity: add an
ARCHITECTURE.md §11 row and a kernel test.

## Risks / Trade-offs

- [The allowlist misses a profile host] → the editor ticks it by hand; the
  allowlist is reviewed yearly.
- [A footer link changes and the head lags] → the derived value is
  recomputed on every front page save; the region path has no lag.
- [A local business without hours reads incomplete] → hours are recommended,
  so the verdict can still show.

## Migration Plan

Existing identity values are unchanged; the new keys start empty and
`site_name` defaults to the identity name, so output is unchanged until
something is set. Rollback: remove the new keys before downgrading.
