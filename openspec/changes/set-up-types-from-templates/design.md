# Design

## Context

See proposal.md for why. After `link-values-to-fields`, a template value may
be linked to a Canvas entity-field source, and `Sources` evaluates it. After
`read-page-components`, `Sources::tree()` returns the template's component
tree with owners. Template values travel in Canvas's template auto-save
draft. The dialog's `/state` is not cached and is refetched about 300 ms
after every Canvas round trip.

## Goals / Non-Goals

**Goals:** a one-click setup that never marks up what visitors cannot see;
statements about every item; a cost that does not grow with every keystroke.

**Non-Goals:** per-node overrides (a README non-goal); a crawl; stored
history.

## Decisions

### 1. The template field reader

`Sources::shown(ContentTemplate $template)` walks the template's own tree
(owner "template" only) and returns `[{field, component, prop}]` from the
entity-field sources its instances use, multi-hop sources included
("Writer › Name" counts as showing Writer). Item-slot components are per item
and never count.

### 2. Self-setup proposals

`Resolver::report()` for an unset type proposes a kind and links, in this
order of evidence: a heading prop sourced from the title → `headline`/`name`;
an image prop sourced from an image field → `image`; a reference or text
field shown as a byline → `author`; a date or date range → dates. Each
proposal carries its reason. Fields not in `shown` are proposed only as
"not shown by the template" and never stored by Use it.

*Alternative:* propose from field names alone (rejected: it links fields
nobody sees).

### 3. Reach has its own route and cache

`GET /canvas-metatag/api/reach?template=…` returns per feature the count of
published items whose verdict is ready or complete, per fact the count of
items where it is empty, per prop the count of dropped values. It runs a
batched `resolve()` over published items (`accessCheck(FALSE)` and
`status = 1`, then the anonymous access check per item inside `resolve()`),
caches each item's result with the cacheability `resolve()` returns, and
caches the answer in `cache.default` with `node_list:{bundle}`, the template's
tags and `config:canvas_metatag.site`. Above 2,000 items it evaluates a
seeded sample of 500 and marks the counts approximate. The dialog fetches it
when the verdict section mounts and when the template's own values change,
never on a Canvas round trip. The template's draft values are applied to
every item, so reach previews the draft. Hand-added items and added details
(`extend-structured-data-by-id`, which runs earlier and shows verdicts for
the previewed item only) are part of each item's graph, so their features
are counted too, with their whole-value field links filled per item.

Because reach resolves every item, it can also show the spread of a
composed title's length across items, which the dialog's guidance cannot
measure from one previewed item (`compose-values-from-fields` D11): "38–71
characters on other events", beside the length guidance of a composed
title, from the same cached per-item results.

*Alternatives:* entity queries (rejected: they cannot express validity
rules, multi-hop sources or node grants); counting inside `/state`
(rejected: recomputed after every round trip).

### 4. Per-item facts

Registry props marked `per_item` (name, headline, dates, price, image) given
one typed value at type scope make every feature requiring them `needs`
with the reason `per_item`, and the reach line shows no count. Its field
line uses the words `extend-structured-data-by-id` already shows for typed
values in hand-added items: "The same ‹label› on every ‹Type›. Link it to a
field instead."

A composition (`compose-values-from-fields`, which lands earlier) that holds
at least one field or a per-item fact counts as set per item, never as the
same text on every item, whatever typed words it also holds ("‹Title› ·
‹Starts›" is per item). Only a value of typed text alone is "the same on
every ‹Type›".

Self-setup proposes single links only in this change. It may propose
compositions later (for example "‹Title› · ‹Starts›" for an event's name);
that needs its own decision and is not built here.

### 5. Authors

When `author` links to a reference field, each referenced entity is one
`author` entry, in field order. An entry is `{@id: "‹target url›#primary",
@type: Person|Organization, name, url}` when the target is published,
viewable anonymously, its stored kind is a person's profile (or an
organization's), and its label is not empty: decided from stored values,
never by resolving the target. Otherwise `{@type: Person, name}`. The
target's cache tags join the head.

### 6. Dropped values

Counted per prop in reach; "Show which" lists the items with edit links. No
write.

## Canvas internals relied on

- The template's component tree and entity-field sources (through `Sources`,
  rows added by `link-values-to-fields` and `read-page-components`).
- No new internal.

## Risks / Trade-offs

- [Reach is slow on large types] → per-item cache, sampling above 2,000 and a
  kernel budget test at 10,000 nodes.
- [Sampled counts mislead] → said as "about" with "Counted from a sample of
  500".
- [An author page changes kind] → its cache tags are on the head; the next
  render falls back to the inline person.
- [Use it leaves out an author the editor wanted] → the band names it and
  Review offers it unticked with the reason.

## Migration Plan

Nothing stored changes. Types already set up get no band; reach and parity
apply at once.
