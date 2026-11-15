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
  // Its published SEO title is "Published title {sep} {site}".
  stored: { id: 5, title: 'Stored', path: './stored', seoTitle: 'Published title {sep} {site}' },
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
  /** The Announcement type has no content; its template stores this title. */
  announcement: { title: '{Page title} {Separator} News' },
  /** What the Event template's live and draft title patterns end with. */
  ending: { live: 'Events', draft: 'Tickets' },
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
    titlePattern: 'Title pattern',
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
    insert: 'Insert value',
    undo: 'Undo',
    startFromDefault: 'Use the site pattern',
    chooseImage: /^(Choose|Change) image$/,
    useHeroField: 'Use the Hero image field',
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
    draftTemplate: 'Draft · goes live when you publish the template',
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
    invalid: "The AI answer couldn't be used. Try again.",
    busy: 'The AI service is busy. Try again in a minute.',
    notFound: 'Not found on the page. Check before using.',
  },
} as const;
