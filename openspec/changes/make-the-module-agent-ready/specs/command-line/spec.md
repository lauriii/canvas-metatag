## ADDED Requirements

### Requirement: One command family

The module MUST offer the Drush commands `canvas-metatag:describe`, `inspect`,
`check` and `set`, beside `canvas-metatag:vocabulary`. Each one-line
description MUST name SEO. Each command's help MUST describe every argument
and option, give at least two examples and name the README's command-line
section. Commands MUST NOT prompt: a missing input MUST fail with the option
or argument to pass.

#### Scenario: Listing the commands

- **WHEN** a developer runs `drush list --filter=canvas-metatag`
- **THEN** the five commands MUST be listed, each with a one-line description that contains "SEO"

#### Scenario: No input

- **WHEN** `drush canvas-metatag:set /pricing` runs with no values argument
- **THEN** it MUST exit 2 at once, and its error MUST say to pass the values as an argument, `@file` or `-`

### Requirement: Targets are named as developers know them

A target MUST be `site`; `node.<bundle>` or the template's configuration name
for a content type's full template; `<entity type>:<id>` for a Canvas page, a
node or a component mapping; or a path or full address on the site, followed
through aliases and the language prefix. `--langcode` MUST pick a page
translation. A target the module does not own MUST be refused with
`not_owned`, and one that does not exist with `not_found`.

#### Scenario: An alias

- **WHEN** an agent inspects `/pricing`, an alias of Canvas page 3
- **THEN** the target MUST be `canvas_page:3` with its label and public address

#### Scenario: A page the module does not own

- **WHEN** an agent inspects the path of a view
- **THEN** the command MUST exit 2 with the code `not_owned`

#### Scenario: A near miss

- **WHEN** an agent inspects `node.12`
- **THEN** the command MUST exit 2 with `not_found`, and `next` MUST offer `node:12`

#### Scenario: A content type

- **WHEN** an agent inspects `node.article` without `--preview`
- **THEN** the target MUST be the Article full template, previewed with the node the dialog would preview, named in `target.preview`

#### Scenario: A content type with no content

- **WHEN** an agent inspects `node.article` and no article is published
- **THEN** the command MUST exit 0 with the template's values, `head` MUST be `null`, and `not_checked` MUST give the reason `no_preview_node`

### Requirement: Commands act as the administrator unless told otherwise

Commands MUST act as the site's administrator, as core's default content
import does, and MUST restore the previous account afterwards, also on
failure. With `--as=<user name>` they MUST act as that account with the
dialog's access (seo-access). An unknown name MUST be `not_found` and a
blocked account `forbidden`. The README MUST say this access emulates the
dialog and is not a security boundary.

#### Scenario: Reading without an account

- **WHEN** an agent inspects a published page without `--as`
- **THEN** `values`, `inherited` and the issues MUST be those an administrator sees

#### Scenario: A blocked account

- **WHEN** an agent runs `inspect /pricing --as=former-editor` and that account is blocked
- **THEN** the command MUST exit 2 with `forbidden`

### Requirement: Addresses need a public base

When the public base would come from the request and Drush has no site
address, a command that prints or matches addresses MUST refuse with
`base_unknown`, and `next` MUST add `--uri` or name the public base setting.
`describe` MUST still run. Results built by a command MUST NOT reach the
dialog's cache for another base.

#### Scenario: No site address

- **WHEN** `inspect /pricing` runs with neither `--uri` nor a public base setting
- **THEN** it MUST exit 2 with `base_unknown`, and `next` MUST hold the same command with `--uri`

### Requirement: One versioned JSON document

Once a command runs, it MUST print exactly one JSON document to standard
output with `contract` (1), `command`, `ok`, `target`, `errors` and `next`,
and notices only to standard error. Errors Drush raises before the command
runs keep Drush's behaviour. The module MUST ship a JSON Schema of the
documents. Adding a member MUST NOT change `contract`; removing or changing
one MUST.

#### Scenario: Piping the output

- **WHEN** an agent pipes `inspect /pricing` into a JSON parser
- **THEN** the parse MUST succeed, with no banner, warning or progress line in the document

#### Scenario: The contract holds

- **WHEN** the module's tests run every command over the fixture site
- **THEN** every document MUST validate against the shipped JSON Schema

### Requirement: Exit codes

A command MUST exit 0 when it did what was asked; 1 when the answer is no:
`check` found an issue at or above its threshold, or `set` was sent values the
rules refuse; and 2 when it could not do what was asked: wrong usage, input
that is not JSON, a target not found or not owned, refused access, a draft in
use, a conflict or no public base. Good-to-know issues MUST NOT change the
exit code.

#### Scenario: Refused values

- **WHEN** `set` is sent a canonical `pricing` for a page
- **THEN** it MUST exit 1

#### Scenario: Input that is not JSON

- **WHEN** `set` is sent `{title:`
- **THEN** it MUST exit 2 with the code `bad_json`

### Requirement: Errors say what to do next

Every error MUST have a `code` from a fixed list and a `message` that says
what to do. A value's error MUST give its `path` as a JSON Pointer into the
`set` document, the valid values in `allowed` when they are a finite list, and
limits in `min`, `max` or `max_length`. `next` MUST hold a command that runs
as printed, repeating the run's `--as`, `--langcode` and `--uri`.

#### Scenario: A misspelled type

- **WHEN** `set` is sent `schema.type` "Prodcut"
- **THEN** the error MUST have the code `choice`, the path `/schema/type`, the page types in `allowed`, and `next` MUST include `drush canvas-metatag:describe --type=Product`

#### Scenario: A limit

- **WHEN** `set` is sent `robots.max_snippet` 5000
- **THEN** the error MUST have the code `range`, the path `/robots/max_snippet`, `min` -1 and `max` 1000

#### Scenario: A bare string

- **WHEN** `set` is sent `{"title": "Oak lamp"}`
- **THEN** the error MUST have the code `form`, list the title's forms in `allowed`, and its message MUST show `{"text": "Oak lamp"}`

### Requirement: describe prints what can be written where

`describe` MUST list, for each target kind, every path `set` takes, with its
forms, label, limits, allowed values, the layer it inherits from and an
example `set` accepts, and where a write lands by default. It MUST also list
the facts, the structured data types (with `--type`, one type's detail rows),
every check id with its severity and where it runs, and the README's absolute
path.

#### Scenario: The site document

- **WHEN** an agent runs `describe`
- **THEN** the site rows MUST give the full paths of the identity and the site values, such as `/identity/logo` and `/values/title_end`

#### Scenario: Examples are valid

- **WHEN** the module's tests send every row's example to `set --dry-run` for its target kind
- **THEN** none MUST be refused

### Requirement: describe finds fields and images

With `--bundle`, `describe` MUST list every field row the link menu offers
for that type, in its order, each with a unique handle, its label path and
the kinds it can fill. With `--media=<search>`, it MUST list at most 24
published, public images named like the search that the account may view,
with id, UUID, label and size, and say when there are more.

#### Scenario: A content type's fields

- **WHEN** an agent runs `describe --bundle=article`
- **THEN** `fields` MUST list `field_summary` and `field_writer.name` with their kinds, in the link menu's order

#### Scenario: Images

- **WHEN** an agent runs `describe --media=lamp`
- **THEN** `media` MUST list the matching images with id, UUID, label and size, and `truncated` MUST say whether more match

### Requirement: inspect explains the result

`inspect` MUST print, for the published version or, with `--draft`, the
version the editor sees: the target's own values in the form `set` accepts,
each inherited value by path with the layer it comes from, the head as the
headless head carries it, the issues and the rules not checked. An issue on
an inherited value MUST name its layer, and its fix MUST name the target to
patch.

#### Scenario: Where the ending comes from

- **WHEN** an agent inspects an article whose type sets no title ending
- **THEN** `inherited` MUST hold `/title_end` with `from: site`

#### Scenario: A fix that belongs to the template

- **WHEN** an article repeats the site name because of its type's title ending
- **THEN** the issue MUST say `from: template`, and its fix MUST target `node.article`

#### Scenario: A draft

- **WHEN** an agent inspects a page with `--draft`
- **THEN** the head MUST be built from the draft, and `target.version` MUST be `draft`

### Requirement: What inspect prints, set accepts

The values `inspect` prints MUST be accepted by `set` for the same target
unchanged, with nothing changed: field links as handles, also inside a
composition's `parts`, media as `{"media": "<uuid>"}`, hand-added JSON-LD as
JSON. Only a link the vocabulary no longer offers MAY print in its stored
form.

#### Scenario: A round trip

- **WHEN** an agent sends a template's printed values back with `set`
- **THEN** the result MUST say `changed: false`

#### Scenario: A round trip of a composed title

- **WHEN** `node.event`'s title is Title, " in ", Venue › City, and an agent inspects it and sends the printed values back with `set`
- **THEN** `inspect` MUST print the title as `{"parts": [{"fact": "title"}, {"text": " in "}, {"field": "field_venue.field_city"}]}`, and `set` MUST say `changed: false`

### Requirement: inspect prints the head visitors get

The head `inspect` prints for the published version MUST be the head the
module delivers to visitors, coupled or headless, for the same entity,
language and public base.

#### Scenario: Same head

- **WHEN** a page is published with a title override
- **THEN** the title, meta, link and structured data rows of `inspect` MUST equal those of the visitor's HTML head and of the headless head

### Requirement: check is a gate

`check` MUST run the checks over the given targets or, with `--all`, the
site settings, every full template over each published node of its type,
every component mapping and every Canvas page. It MUST list only targets with
issues, count all of them per severity, list the rules not checked once, and
exit 1 when an issue is at or above `--fail-on`: `fix` by default, or
`improve`.

#### Scenario: Content that misses a detail

- **WHEN** 31 published events have no start date and `check --all` runs
- **THEN** the `node.event` result MUST list the missing start date to fix with `count` 31 and at most five example nodes, and the command MUST exit 1

#### Scenario: Only things to improve

- **WHEN** the only issues are to improve
- **THEN** `check` MUST exit 0, and `check --fail-on=improve` MUST exit 1

#### Scenario: Targets and all

- **WHEN** `check site --all` runs
- **THEN** it MUST exit 2 with `usage`

### Requirement: Dropped values are reported

`inspect` and `check` MUST report every stored value the output leaves out as
an issue to fix with its path and the problem's code, whether the dialog,
configuration import, a recipe or custom code stored it.

#### Scenario: Stored around the API

- **WHEN** custom code stores a page value with a `javascript:` canonical and a robots limit of 5000
- **THEN** `inspect` MUST list `value-dropped` for `/canonical` and for `/robots/max_snippet`, and the head MUST leave both out

### Requirement: set applies a merge patch

`set` MUST read a JSON object from its argument, a file (`@path`, relative to
the caller's directory) or standard input (`-`) and apply it to the target's
current values as a merge patch: objects that group settings merge, a value is
replaced whole and `null` removes it. A patch that changes the structured
data type MUST drop the details the new type lacks, as the dialog does, and
say which.

#### Scenario: Setting only the title

- **WHEN** an agent sets `{"title": {"text": "Oak lamp"}}` on a page with a Product type
- **THEN** the page MUST keep the Product type and its details

#### Scenario: Removing a value

- **WHEN** an agent sets `{"robots": {"noindex": null}}`
- **THEN** the page MUST have no own noindex value, and the inherited one MUST apply

#### Scenario: Changing the type

- **WHEN** a page with a Product price is set to `{"schema": {"type": "Article"}}`
- **THEN** the write MUST succeed without the price, and a `details-removed` issue MUST name `/schema/props/offers_price`

### Requirement: set writes where the target is reviewed

`set` MUST write a page into its Canvas draft and store the site settings and
a template, unless `--to=draft` or `--to=live` says otherwise; the site has no
draft. A live page write MUST be a new revision by the acting account. The
result MUST say where the values went, and after a draft write `next` MUST
hold the `--to=live` command.

#### Scenario: A page by default

- **WHEN** an agent sets a page's title
- **THEN** the page's draft MUST hold it, the stored page MUST be unchanged, and `written_to` MUST be `draft`

#### Scenario: A template by default

- **WHEN** an agent sets `node.article` and the template has no draft
- **THEN** the stored template MUST hold the value, `written_to` MUST be `live`, and configuration export MUST include it

### Requirement: A page's description is set with its SEO

`set` on a page MUST accept `description` and write it as Canvas's Page data
description, into the same draft or revision as the other values, as the
dialog hands it to Canvas. `inspect` MUST print it with the page's values.

#### Scenario: A missing description

- **WHEN** `check` lists `description-missing` for a page and the agent sets `{"description": {"text": "Hand-made oak lamps."}}`
- **THEN** the page's draft MUST hold the description, and `inspect --draft` MUST no longer list the issue

### Requirement: set validates like the dialog

`set` MUST validate the patched values with the dialog's rules for the
target's scope, and MUST store nothing when any is refused, listing every
refused value. A value carried over unchanged MUST be accepted as the dialog
accepts it. The hand-writable forms of configuration-as-code MUST be accepted.

#### Scenario: Two refused values

- **WHEN** `set` is sent a canonical `pricing` and a fact `nope`
- **THEN** both MUST be listed with their codes, and no draft MUST be created

#### Scenario: A field by handle

- **WHEN** `set node.article` is sent `{"description": {"field": "field_summary"}}`
- **THEN** the template MUST hold the Canvas field source for the summary, and `inspect` MUST print it back as `{"field": "field_summary"}`

#### Scenario: A composition by handle

- **WHEN** `set node.article` is sent `{"description": {"parts": [{"field": "field_summary"}, {"text": " Free delivery."}]}}`
- **THEN** the template MUST hold a composition of the summary's Canvas field source and the typed text, refused with code `field` only when a handle is not offered in words

#### Scenario: A composition on a page

- **WHEN** `set` on a page is sent a composed title
- **THEN** it MUST be refused at `/title`, as the dialog refuses it, and nothing MUST be stored

### Requirement: Dry runs and repeated runs change nothing

`set` MUST print what `inspect` would print for the version written, with
`changed` and `written_to`. With `--dry-run` it MUST print that for the
patched values and write nothing. A `set` that changes nothing MUST write
nothing, create no draft and say `changed: false`.

#### Scenario: A dry run

- **WHEN** an agent dry-runs a new product price
- **THEN** the result's values and structured data MUST hold the new price, `written_to` MUST be `null`, and the page MUST have no draft

#### Scenario: Running twice

- **WHEN** the same `set` runs twice
- **THEN** the second run MUST say `changed: false`

### Requirement: set takes one page, template or the site

`set` MUST take one target per run. It MUST refuse a node and a component
mapping with `not_editable`; for a node, `next` MUST name its content type's
template, because nodes have no SEO values of their own.

#### Scenario: A node

- **WHEN** an agent sets values on `node:12`, an article
- **THEN** the command MUST exit 2 with `not_editable`, and `next` MUST name `node.article`

### Requirement: The README's command-line section is tested

The README MUST have a section that opens with a short model of layers, value
forms, write destinations, `--as` and `--uri`, gives a block to paste into a
project's agent instructions, and shows the command or recipe for each job a
developer does. Every command and recipe in it MUST run in the module's
tests, and every JSON example MUST validate against the shipped JSON Schema.

#### Scenario: A renamed option

- **WHEN** an option is renamed and the README still shows the old one
- **THEN** the module's tests MUST fail
