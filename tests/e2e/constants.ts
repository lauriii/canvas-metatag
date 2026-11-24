/**
 * What the specs rely on, in one place.
 *
 * The first half mirrors the seeding in
 * \Drupal\Tests\canvas_metatag\TestSite\CanvasMetatagTestSetup: keep it in sync
 * with that PHP class. The second half is the contract with the SEO dialog:
 * the strings it shows (also its accessible names) and its four test ids.
 * Nothing else about the dialog's markup is relied on.
 */

export const SITE_NAME = 'Example';
export const LANGCODE = 'fi';
/** The headless project's frontend. Nothing answers at this address. */
export const FRONTEND_URL = 'https://www.example.test';

/** Canvas pages, by id. `path` is relative to the site's base URL. */
export const PAGES = {
  home: { id: 1, title: 'Home', path: './home' },
  pricing: {
    id: 2,
    title: 'Pricing',
    path: './pricing',
    description: 'Simple plans for teams of every size. Start free, upgrade when you grow.',
    heading: 'Plans and prices',
    headingUuid: '3b0f6a52-7c1d-4e8a-9f25-6d4c1b2a7e01',
  },
  about: { id: 3, title: 'About us', path: './about', translatedTitle: 'Tietoa meistä' },
  // No main heading, a small image, and a stored title that is too long and
  // names the site twice.
  checks: { id: 4, title: 'Checks', path: './checks' },
  // Its published SEO title's main part is "Published title". No description.
  stored: { id: 5, title: 'Stored', path: './stored', seoTitle: 'Published title' },
  /** Described as a Movie, which the registry does not have. */
  unknownKind: { id: 6, title: 'Night at the cinema', path: './night-at-the-cinema' },
  /** Shows Drupal's breadcrumb: Home › About us. */
  trail: { id: 7, title: 'Our team', path: './about/team' },
} as const;

/** Image media, by name. The file is the lower-cased, hyphenated name. */
export const IMAGES = {
  hero: { name: 'E2E Hero', file: 'e2e-hero.png', width: 1200, height: 630 },
  small: { name: 'E2E Small', file: 'e2e-small.png', width: 300, height: 200 },
  logo: { name: 'E2E Logo', file: 'e2e-logo.png', width: 512, height: 512 },
  article: { name: 'E2E Article', file: 'e2e-article.png', width: 1600, height: 900 },
} as const;

/** Nodes, by id. Articles have the enabled template; the Basic page has none. */
export const NODES = {
  article: {
    id: 1,
    title: 'How we rebuilt our editor',
    path: './blog/how-we-rebuilt-our-editor',
    summary: 'A look at what changed in our editing pipeline and why it matters.',
    byline: 'Ada Writer',
    image: IMAGES.hero,
  },
  second: {
    id: 2,
    title: 'What we learned from a year of releases',
    path: './blog/a-year-of-releases',
    summary: 'Twelve releases, three lessons and one thing we would do differently.',
    byline: 'Grace Editor',
    image: IMAGES.article,
  },
  plain: { id: 3, title: 'Plain page', path: './plain-page' },
  /** The headless projects only: an article without a summary. */
  noSummary: { id: 4, title: 'A note without a summary' },
} as const;

export const TEMPLATE_ID = 'node.article.full';

/**
 * The complex content fixture (project `complex`): CanvasMetatagTestSetup with
 * CANVAS_METATAG_E2E_COMPLEX=1 adds it after the base site, and checks these
 * ids against its COMPLEX_NODES. Titles and values are those of
 * \Drupal\Tests\canvas_metatag\Fixture\ComplexContent.
 */
// cspell:ignore Ruisleipä שקשוקה مصباح مكتب عمر حداد
export const COMPLEX = {
  event: {
    id: 11,
    title: 'Midsummer Night Concert',
    path: './complex/events/midsummer-night-concert',
    venue: 'Lakeside Concert Hall',
    status: 'On as planned',
  },
  /** Emoji in the title; its venue and first performer are unpublished. */
  eventHidden: {
    id: 12,
    title: 'Workshop 🎻 Strings for beginners 👩🏽‍🔬🇫🇮',
    path: './complex/events/strings-workshop',
  },
  /** The start of a title of 247 characters. */
  eventLong: { id: 13, title: 'An unusually long evening programme of chamber music' },
  /** Not published: visitors cannot see it. */
  eventUnpublished: { id: 14, title: 'Autumn season opening (draft)' },
  product: { id: 15, title: 'Oak desk lamp', path: './complex/products/oak-desk-lamp' },
  /** Name and biography from right to left. */
  personOmar: { id: 8, title: 'عمر حداد' },
  /** Title and description from right to left. */
  productRtl: { id: 16, title: 'مصباح مكتب' },
  /** The Recipe template was never published. */
  recipe: {
    id: 19,
    title: 'Ruisleipä (Finnish rye bread)',
    path: './complex/recipes/rye-bread',
    firstIngredient: '500 g rye flour',
  },
  /** A recipe written from right to left. */
  recipeRtl: { id: 20, title: 'שקשוקה' },
  /** Its image is a 400 × 400 logo: a small card. */
  job: { id: 21, title: 'Senior Drupal developer' },
  /**
   * An article with no summary. The Article template's stored description
   * links to `gone`, a field that no longer exists.
   */
  articleMixed: { id: 24, gone: 'field_gone' },
  /** The Announcement type has no content; its template stores this ending. */
  announcement: { ending: 'News' },
  /** What the Event template's live and draft titles end with. */
  ending: { live: 'Events', draft: 'Tickets' },
  /** A job whose closing date has passed. */
  jobExpired: { id: 22 },
  /** Project schema-templates: five courses, four with a summary. */
  courseList: { id: 30, title: 'All courses', complete: 4 },
} as const;

const user = (username: string) => ({ username, password: username });
export const USERS = {
  /** Edits Canvas pages and templates, with neither SEO permission. */
  noSeo: user('e2e_no_seo'),
  /** The same, plus "edit canvas metatag" (and the AI permission in the ai project). */
  editor: user('e2e_editor'),
  /** The same, plus "administer canvas metatag". */
  admin: user('e2e_admin'),
  /** Holds "edit canvas metatag" but cannot edit any Canvas page. */
  viewer: user('e2e_viewer'),
} as const;

/** The dialog's four test ids. */
export const TEST_ID = {
  status: 'seo-footer-status',
  search: 'seo-search-preview',
  social: 'seo-social-preview',
  output: 'seo-output',
} as const;

/** The dialog's strings, which are also its accessible names. */
export const UI = {
  scope: { page: 'This page', article: 'Every Article', site: 'Site' },
  tab: {
    search: 'Search',
    social: 'Social',
    schema: 'Schema',
    // A header button, not a tab: its name carries the count ("Checks, 2 to improve").
    checks: /^Checks/,
  },
  field: {
    title: 'Title',
    titleEnding: /^Title ending: /,
    description: 'Description',
    canonical: 'Canonical address',
    // In the Social tab: scope with getByRole('tabpanel', { name: 'Social' }).
    socialTitle: 'Title',
    socialDescription: 'Description',
    showInSearch: 'Show in search results',
    // The disclosure that holds the rest of the visibility settings.
    siteVisibility: 'Advanced',
    name: 'Name',
    profiles: 'Profiles',
  },
  source: {
    site: 'Site default',
    page: 'Set on this page',
    article: 'Set for every Article',
    heroField: 'From the Hero image field',
  },
  action: {
    // The link button by a field's label, and the box of a linked value.
    link: (field: string) => `Link ${field} to a field`,
    changeLink: (field: string) => `Change the link for ${field}`,
    unlink: (field: string) => `Unlink ${field}`,
    undo: 'Undo',
    chooseImage: /^(Choose|Change) image$/,
    useHeroField: /^Use Hero image › .+$/,
    output: 'View output',
    back: 'Back',
    copy: /^Copy (tags|structured data)$/,
    copied: 'Copied',
    save: 'Save',
    discard: 'Discard',
    hideAndSave: 'Hide site',
    useIt: 'Use it',
    reload: 'Reload editor',
  },
  footer: {
    matchesPage: 'Matches the published page',
    saved: 'Saved to draft',
    draftPage: 'Draft · goes live when you publish the page',
    // A template's draft is named as Canvas's "Review changes" lists it.
    draftTemplate: 'Draft · listed under Unpublished changes as',
    /** The label Canvas lists a type's Full template under. */
    canvasLabel: (type: string) => `${type} content items — Full content view`,
    restored: "Restored a change that hadn't been saved",
    readOnly: 'Read-only',
    unstored: 'This change could not be stored in the draft',
    siteLive: 'Live site settings',
    siteUnsaved: 'Unsaved changes · not live yet',
    siteSaved: 'Saved · live now',
    hidesSite: 'This asks search engines to drop every page.',
  },
  strip: {
    conflict: 'This page was changed somewhere else. What you typed is kept.',
    cannotSave: "SEO can't save to this page right now. Site settings still work.",
    offer: "An earlier change wasn't saved",
  },
  template: {
    nothingToPreview: 'No announcement yet. Add one to preview and edit these settings.',
  },
  site: {
    heading: 'Site settings',
    hint: 'Open a page or a content template to edit its SEO.',
    otherTemplate: 'SEO for a content type is set in its Full content template.',
    noFullTemplate: 'This content type has no Full content template yet. Add one to set its SEO.',
    readOnly: 'Only people who administer SEO site settings can change these. You are viewing them.',
  },
  noAccess: {
    heading: 'SEO is not available',
    text: "You don't have permission to edit SEO settings.",
  },
  /** What an empty description means on a headless site, in every place. */
  noDescriptionSent: 'No description sent. The frontend decides what to show.',
  output: {
    // By the sheet's heading while a change is saved or read back.
    updating: 'Updating…',
    headless:
      'What SEO sends to your frontend. Your frontend decides what reaches visitors. Includes changes that are still drafts.',
    // The ⓘ in the Output sheet's header carries it as its aria-description.
    frontend: `Addresses use your frontend: ${FRONTEND_URL}`,
  },
  checks: {
    noHeading: 'Add a main heading',
    // Every Show is named for its field and described by its issue.
    show: /^Show [a-z ]+$/,
    titleLong: /^Shorten the title/,
    imageSmall: 'Use a larger social image',
    imageSmallDetail: /^The social image is \d+\u00a0×\u00a0\d+\./,
    siteTwice: 'Remove the repeated site name',
    removeRepeat: 'Remove the repeat',
    goToTitle: /^Show title$/,
    // The ⓘ in the Checks sheet's header carries it as its aria-description.
    closing:
      'These checks cover the settings in this dialog and the page preview. They do not check robots.txt, speed or rankings.',
  },
  ai: {
    suggest: /^Suggest a (title|description)$/,
    suggestSocial: 'Suggest title and description',
    suggestSchema: 'Suggest from this page',
    // A button that reveals a textbox of the same name.
    steer: 'Refine',
    use: 'Use',
    retry: 'Try again',
    disclosure: "Written by AI from this page's text. Check the facts.",
    invalid: "The AI answer couldn't be used.",
    busy: 'The AI service is busy. Wait a minute, then try again.',
    blocked:
      "The site's AI rules stopped this request. Try different wording in Refine, or ask a site administrator.",
    // Without Refine text, asking again would be stopped again.
    blockedFinal: "The site's AI rules stopped this request. Ask a site administrator.",
    notConfigured: "AI suggestions aren't set up on this site yet.",
    dismiss: 'Dismiss',
    tray: 'Suggestions',
    sends: "Sends this page's text to the AI service.",
    // Typed into Refine, it trips the site guardrail the AI setup adds.
    policyMarker: '#policy',
    guesses: /^\d+ more guess(es)? (wasn't|weren't) found on the page\.$/,
    // The start date is the person's to set.
    yourself: 'Starts · Add it yourself',
    reserved: "AI doesn't fill in dates, prices or authors.",
  },
  schema: {
    stage: 'Understood as',
    kind: 'What this page is',
    kinds: 'What is this page?',
    product: 'A product people buy',
    service: 'Plans for a service',
    article: 'An article',
    event: 'An event people attend in person',
    webPage: 'A web page',
    toService: 'Change to plans for a service',
    ownJsonLd: 'Add your own JSON-LD',
    moved: 'Custom JSON-LD moved to Code › Add your own JSON-LD',
    code: 'Code',
    proofFoot: 'Meeting these makes a result possible. Search engines decide whether to show it.',
  },
} as const;
