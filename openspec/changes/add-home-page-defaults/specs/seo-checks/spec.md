## MODIFIED Requirements

### Requirement: Checks describe the page or template being edited

Checks MUST be computed for the target, a page or a content type's template,
from the values the dialog shows, unsaved edits and Canvas's live page title
and description included. At template scope they MUST be about the node the
editor previews, named once on one line of the Checks sheet and called "this
‹type›" in its issues; when the template renders the front page (front-page),
the front page visibility rules MUST judge the front node. A value empty for
the previewed node MUST be stated as a fact, good to know and not counted. The
Site scope MUST have no checks of its own.

#### Scenario: Typing changes the checks

- **WHEN** an editor types a title that names the site twice
- **THEN** "Remove the repeated site name" MUST be listed before the change is saved

#### Scenario: A template is checked against its preview

- **WHEN** the dialog edits "Every Article" while the editor previews the article "Hello world"
- **THEN** the Checks sheet MUST say "Checked against Hello world", and a detail that would say "this page" MUST say "this article" instead

#### Scenario: A very long node title

- **WHEN** the editor previews an event whose title is 247 characters long
- **THEN** "Checked against" MUST fit on one line, ending with an ellipsis, with the whole title on hover, and no issue's sentence MUST repeat the title

#### Scenario: A value empty for the previewed node

- **WHEN** "Every Event"'s description holds {Performers} and the previewed event has no performers
- **THEN** the issue MUST say "Performers is empty for this event", not "Fill in Performers", and be good to know, not counted in the Checks button; the same MUST hold for a value the title or the social texts use

#### Scenario: A description linked to a field empty for the previewed node

- **WHEN** "Every Product"'s description is linked to SKU and the previewed product has no SKU and no description of its own
- **THEN** "SKU is empty for this product" MUST be listed as good to know, and "Add a description" MUST NOT be listed or counted

#### Scenario: A structured data property linked to a field empty for the previewed node

- **WHEN** "Every Event" links its Ends property to the field Ends and the previewed event has no end
- **THEN** the issue MUST say "Ends is empty for this event", be good to know, not counted, and "Also helps the event result: Ends." MUST NOT be listed

#### Scenario: Shown in search, not saved yet

- **WHEN** an editor clicks "Show in search results" on "Every Article" and the change is not saved yet
- **THEN** no noindex issue MUST be listed, so nothing says that hiding is set outside SEO: the check that a page is hidden by a setting outside SEO MUST NOT judge an unsaved change by the server's output for the values before it

#### Scenario: A template that is hidden from search

- **WHEN** "Every Article" is set to be hidden from search
- **THEN** the issue MUST say "Show this article in search"

#### Scenario: Site scope and loading

- **WHEN** the dialog shows the Site scope, or the editor's next page is still loading
- **THEN** the Checks button MUST NOT be shown

#### Scenario: A template that renders the home page

- **WHEN** the front page is the article "Welcome", and an editor turns off "Show in search results" for "Every Article" while previewing "Hello world"
- **THEN** "Show your home page in search" MUST be listed to fix, saying "This also applies to your home page Welcome."

#### Scenario: Shared settings on a node home page

- **WHEN** the dialog edits the template that renders the front node
- **THEN** a good-to-know row MUST say that the home page's title and description follow every node of the type, and that a Canvas page can have its own

### Requirement: Title rules

The checks MUST judge the resolved search title: whether it exists, says
something, repeats the site name, matches the main heading, and fits. Comparing
text MUST ignore case and punctuation. When the title may be cut off inside its
ending, the detail MUST say that the ending is the part that gets lost. On the
front page the front page title rule MUST replace "Make the title specific".

#### Scenario: No title

- **WHEN** the resolved title is empty
- **THEN** "Add a title" MUST be listed to fix

#### Scenario: A generic title

- **WHEN** content in a language whose code starts with "en" has a title that, without the site name and separators, is "home", "homepage", "untitled", "page", "new page" or "welcome"
- **THEN** "Make the title specific" MUST be listed to improve

#### Scenario: Generic titles outside English

- **WHEN** a Finnish page is titled "Home"
- **THEN** "Make the title specific" MUST NOT be listed

#### Scenario: The site name twice

- **WHEN** the site name appears twice in the resolved title
- **THEN** "Remove the repeated site name" MUST be listed to improve

#### Scenario: Title and heading differ

- **WHEN** the preview has exactly one main heading, neither it nor the title contains the other, and they share no word
- **THEN** "Match the title to the main heading" MUST be listed to improve

#### Scenario: A heading that shares a word

- **WHEN** the title is "Team plans" and the main heading "Plans for teams"
- **THEN** "Match the title to the main heading" MUST NOT be listed

#### Scenario: Short words

- **WHEN** a Latin-script title and heading share only words under four letters
- **THEN** they MUST count as sharing no word, while in other scripts two characters MUST count as a word

#### Scenario: Several main headings

- **WHEN** the preview has two main headings
- **THEN** the title MUST NOT be compared with either

#### Scenario: A long title

- **WHEN** the title may be cut off on desktop or on phones
- **THEN** "Shorten the title" MUST be listed as good to know, with the last words that fit

#### Scenario: Text that cannot be measured

- **WHEN** the dialog cannot measure text
- **THEN** "Shorten the title" MUST NOT be listed

#### Scenario: The ending is cut off

- **WHEN** the title may be cut off after its main part, inside the ending "Journal"
- **THEN** the detail of "Shorten the title" MUST say "The ending “Journal” is the part that gets lost."

#### Scenario: A generic title on the home page

- **WHEN** the front page in English is titled "Home"
- **THEN** "Make the title specific" MUST NOT be listed, and "Say what the site offers" MUST be

### Requirement: Description rules

The checks MUST judge the resolved search description: whether it exists, fits,
and says more than the title. On the front page, the missing-description row
MUST ask for a description of the whole site.

#### Scenario: No description

- **WHEN** the resolved description is empty
- **THEN** "Add a description" MUST be listed to improve

#### Scenario: A long description

- **WHEN** the description may be cut off
- **THEN** "Shorten the description" MUST be listed as good to know

#### Scenario: Repeating the title

- **WHEN** the description equals the title without the site name, ignoring case and punctuation
- **THEN** "Make the description say more" MUST be listed to improve

#### Scenario: No description on the home page

- **WHEN** the front page has no description
- **THEN** "Add a description" MUST be listed to improve, with "Describe the whole site: what it offers and who it's for. Without one, search engines pick text from the page."

### Requirement: Search visibility rules

The checks MUST say when a published target is hidden from search engines and
where that is set, when hiding and a canonical address are combined, when
search engines are sent elsewhere, and when text or large image previews are
off. On the front page, the front page visibility rules MUST replace the rows
for a hidden page, a canonical address elsewhere and text previews off.

#### Scenario: A hidden page

- **WHEN** a published page is hidden by its own setting
- **THEN** "Show this page in search" MUST be listed to improve, with "Hidden from search engines. Set on this page."

#### Scenario: An unpublished page

- **WHEN** a page that was never published is hidden
- **THEN** "Show this page in search" MUST NOT be listed

#### Scenario: Where it is set

- **WHEN** the noindex comes from the content type, the default-language version or the site
- **THEN** the detail MUST say "Set for every Article.", "Set on the English version." or "Set for the whole site."

#### Scenario: Hidden by configuration

- **WHEN** no SEO layer hides the page but the emitted robots tag says noindex
- **THEN** the detail MUST say "Set in site configuration outside SEO.", and no fix MUST be offered

#### Scenario: Hidden and canonical

- **WHEN** a hidden page also has a canonical address
- **THEN** the checks MUST say to use one or the other, to improve

#### Scenario: Sent elsewhere

- **WHEN** the emitted canonical link differs from the page's own address
- **THEN** a good-to-know row MUST say that search engines are asked to show that address instead

#### Scenario: Text previews off

- **WHEN** nosnippet is set, or the text limit is zero
- **THEN** "Text previews are off" MUST be listed as good to know

#### Scenario: Image previews not large

- **WHEN** image previews are standard, none, or not set at all
- **THEN** "Large image previews are off" MUST be listed as good to know

#### Scenario: The home page is hidden

- **WHEN** the published front page is hidden by its own setting
- **THEN** "Show this page in search" MUST NOT be listed, and "Show your home page in search" MUST be

## ADDED Requirements

### Requirement: Hiding the home page is graded by where it is set

On the front page, published or staged to become it, a noindex MUST be listed
as "Show your home page in search": to fix when it comes from the page, its
content type, its default-language version or the site settings; to improve
when only a configuration override explains it. The detail MUST say that search
engines read site-wide facts from the home page.

#### Scenario: Hidden on the page

- **WHEN** the published front page sets noindex
- **THEN** "Show your home page in search" MUST be listed to fix, with "Show in search results" as its fix

#### Scenario: Hidden for the whole site

- **WHEN** the site settings set noindex and the front page is published
- **THEN** the row MUST be listed to fix, with "Set for the whole site.", leading to the setting for people who may administer site settings

#### Scenario: Hidden by a settings file

- **WHEN** only a configuration override makes the front page's robots tag say noindex
- **THEN** the row MUST be listed to improve, saying the setting applies to this environment only and does not travel with configuration

#### Scenario: About to become the home page

- **WHEN** a hidden page is staged as the homepage
- **THEN** the row MUST be listed to fix, saying "This page becomes your home page when you publish."

### Requirement: Sending search engines away from the home page is to fix

On the front page, an emitted canonical link that is not exactly the front
page's own address MUST be listed to fix, with no normalisation of scheme,
host or trailing slash. When the canonical is the target's own value, the fix
MUST remove it.

#### Scenario: An override on the home page

- **WHEN** the front page sets the canonical `/welcome`
- **THEN** "Your home page sends search engines to another address" MUST be listed to fix, with "Remove" as its fix

#### Scenario: An insecure address

- **WHEN** the public base is `https://www.example.com` and the front page sets the canonical `http://www.example.com/`
- **THEN** the row MUST be listed to fix

### Requirement: Home page previews and links are judged by their cost

On the front page, text previews off (nosnippet, or a text limit of zero) and
links not followed MUST each be listed to improve. The text preview row MUST
say that brand searches then show no description and that AI answers in
search cannot quote the page.

#### Scenario: Text previews off on the home page

- **WHEN** the front page sets nosnippet
- **THEN** "Text previews are off on your home page" MUST be listed to improve, and "Text previews are off" MUST NOT

#### Scenario: Links not followed

- **WHEN** the front page sets nofollow
- **THEN** "Search engines won't follow links from your home page" MUST be listed to improve

### Requirement: The home page's name says what the site offers

On the front page, the checks MUST list "Say what the site offers" to improve
when the page's name, the title without the site name and separators, or the
shared title is empty, the site name, one of its alternate names, or a vague
word in the translation's own language. Its first action MUST lead to the
page's name.

#### Scenario: The page is named Home

- **WHEN** the English front page is named "Home" and has no title or social title of its own
- **THEN** "Say what the site offers" MUST be listed to improve, its first action MUST lead to Canvas's page title, and its detail MUST say that the home page shares as "Humanify Studio" and that renaming the page says what the site offers

#### Scenario: A title that is only the brand

- **WHEN** the front page's title is "Example Studio" and the site is named "Example Studio"
- **THEN** "Say what the site offers" MUST be listed to improve

#### Scenario: A vague word in another language

- **WHEN** the Finnish front page is named "Etusivu"
- **THEN** "Say what the site offers" MUST be listed to improve

#### Scenario: A word vague only in another language

- **WHEN** the German front page is named "Start Up Labs" and only English lists "start"
- **THEN** "Say what the site offers" MUST NOT be listed

#### Scenario: Only the shared title is vague

- **WHEN** the front page's title is "Accounting software for small firms | Acme" and its shared title falls back to the page name "Home"
- **THEN** "Say what the site offers" MUST be listed to improve

#### Scenario: A node home page

- **WHEN** the front page is a node named "Home" rendered by a template
- **THEN** the row MUST say the name is the node's title and MUST NOT offer to set a title for this node alone

### Requirement: The home page's address keeps working

On the front page, the checks MUST list to fix: a front page setting that holds
the page's alias while the page's draft alias differs; a language in which the
front page has a published translation but the setting finds no front page.
Fixes MUST point a site administrator to setting the front page by the page's
permanent address.

#### Scenario: A new alias for the home page

- **WHEN** the front page setting is `/home` and an editor changes the page's alias to `/start` in Canvas
- **THEN** "Your home page will show “Page not found”" MUST be listed to fix before publishing, naming the permanent address `/page/5`

#### Scenario: A language without a home page

- **WHEN** the front page setting is page 5's English alias and page 5 has a published Finnish translation
- **THEN** "/fi doesn't open your home page" MUST be listed to fix

#### Scenario: Set by its permanent address

- **WHEN** the front page setting is `/page/5`
- **THEN** neither row MUST be listed, whatever the page's aliases

#### Scenario: An editor without the site permission

- **WHEN** an editor who may not administer site configuration sees either row
- **THEN** the detail MUST say that a site administrator can fix it, and offer no action

### Requirement: A prefixed default language is reported on the home page

On a site that negotiates the content language by URL path prefix and gives the
default language a prefix, the front page MUST list to improve that `/` and the
prefixed root show the same page while the site's markup names `/` as the home
page.

#### Scenario: English under /en

- **WHEN** the default language English has the prefix `en`
- **THEN** the row MUST be listed to improve, recommending to remove the prefix, or else to redirect `/` to `/en`

#### Scenario: Languages by domain

- **WHEN** languages are negotiated by domain
- **THEN** the row MUST NOT be listed

### Requirement: A home page that lists things is not one item

On the front page, a structured data type of Product, or of Article or its
kinds, MUST be listed to improve, saying to describe each item on its own page.

#### Scenario: A home page typed as an article

- **WHEN** the front page's type is Blog post
- **THEN** "Your home page lists articles" MUST be listed to improve

#### Scenario: A home page typed as a product

- **WHEN** the front page's type is Product
- **THEN** "Your home page shows many products" MUST be listed to improve

### Requirement: The home page's share image is chosen on purpose

On the front page, when the shared image comes from the page's own image
rather than a chosen social image or the site's image, or is the site card, a
good-to-know row MUST say so and lead to the social image.

#### Scenario: The hero image is shared

- **WHEN** the front page has no social image and its page image resolves
- **THEN** "Links to your home page show the page's image" MUST be listed as good to know

#### Scenario: The site card is shared

- **WHEN** the front page named "Home" has no image and shares the site card
- **THEN** "Links to your home page show your logo and site name" MUST be listed as good to know

### Requirement: The site name is one name

For people who can administer SEO site settings, the front page MUST list as
good to know when the identity name differs from the site name in the default
language without overrides, or, with no identity name, when the site name's
translations differ.

#### Scenario: Two names

- **WHEN** the identity is named "Example Studio" and the site "Example"
- **THEN** the row MUST offer to add "Example" as an alternate name

#### Scenario: A translated site name

- **WHEN** the identity has no name and the site name is translated differently in Finnish
- **THEN** the row MUST say that search engines use one site name per site and lead to the identity name

#### Scenario: Same name in another language

- **WHEN** the identity name equals the default-language site name and the editor works in Finnish
- **THEN** the row MUST NOT be listed
