## ADDED Requirements

### Requirement: Title suggestions leave room for the ending

A text request MAY carry the page's title ending, with its separator, as a page
member. The user message MUST carry it on its own line. For a title request,
the fixed text the server adds after the configured prompt MUST say that the
ending in the request is added to the title automatically, that it counts
toward the title's length, and that the title must not include it or the site
name. The shipped prompts MUST NOT contain this sentence.

#### Scenario: A page with the site's ending

- **WHEN** a title request carries the ending " | Example"
- **THEN** the user message MUST contain "| Example" as the title ending, and the system prompt MUST NOT contain "Example"

#### Scenario: No ending

- **WHEN** a title request carries no ending, or an empty one
- **THEN** the request MUST be accepted, and the user message MUST say that the title has no ending

#### Scenario: An edited search prompt

- **WHEN** the search result prompt is set to "Say hello." and an editor asks for title suggestions
- **THEN** the system prompt MUST still say that the ending is added automatically and counts toward the length

## MODIFIED Requirements

### Requirement: Suggestions never change anything by themselves

A suggestion request MUST NOT write configuration, a page, or a Canvas draft,
whether it succeeds or fails. A suggestion MUST reach the page only when the
editor uses it in the dialog. A used suggestion MUST then be saved like typed
text, through the dialog's own draft save and its validation.

#### Scenario: Asking for suggestions

- **WHEN** an editor asks for text suggestions and a structured data proposal
- **THEN** the site's configuration, the stored page and every Canvas draft MUST be unchanged

#### Scenario: Suggestions on screen

- **WHEN** text variants are shown and the editor has not chosen "Use"
- **THEN** the page's draft MUST NOT contain any of them

#### Scenario: Using a title variant

- **WHEN** the editor uses a title variant
- **THEN** the variant MUST become the page's title main part as typed text, the page's title ending MUST be unchanged, and the value MUST be saved into the page's draft

#### Scenario: A proposal on screen

- **WHEN** a structured data proposal is shown and not used
- **THEN** the page's structured data values MUST be unchanged

### Requirement: Request text is capped

The server MUST cut, in characters, the hint to 200, each current value to
2000, the page title, the title ending and the site name to 255 and the page
text to 12,000. Current values of fields that were not requested MUST NOT be
sent.

#### Scenario: Multibyte text

- **WHEN** a current value has 2001 characters of "ä"
- **THEN** exactly 2000 characters MUST reach the provider

#### Scenario: A current value of another field

- **WHEN** a title request carries a current social title
- **THEN** the social title MUST NOT reach the provider

#### Scenario: A long ending

- **WHEN** a title request carries an ending of 300 characters
- **THEN** exactly 255 characters of it MUST reach the provider

### Requirement: Model output is untrusted

Only requested fields, and for a proposal only allowed keys, MUST survive.
Values MUST be reduced to plain text and cut (300 characters for text, 2000
for a detail). Text variants that contain a web address MUST be dropped.
Markup and braces MUST be kept as plain text: a used suggestion is stored as
typed text, which is never scanned for values, and every output escapes it.

#### Scenario: A hijacked answer

- **WHEN** the model returns an unrequested `canonical` row and a title with `{site}` and a script tag
- **THEN** the `canonical` row MUST be dropped, and the title MUST be returned as plain text with `{site}` and the script tag as typed, which the head emits as text and never fills

#### Scenario: A web address in a variant

- **WHEN** a text variant contains `www.example.com/menu`
- **THEN** that variant MUST be dropped

#### Scenario: JSON wrapped in prose

- **WHEN** the model wraps valid JSON in prose or a code fence
- **THEN** the server MUST still read it
