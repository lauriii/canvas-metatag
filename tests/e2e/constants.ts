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
  site: {
    heading: 'Site settings',
    hint: 'Open a page or a content template to edit its SEO.',
    readOnly: 'Only people who administer SEO site settings can change these. You are viewing them.',
  },
  noAccess: {
    heading: 'SEO is not available',
    text: "You don't have permission to edit SEO settings.",
  },
  output: {
    headless:
      'What SEO sends to your frontend. Your frontend decides what reaches visitors. Includes changes that are still drafts.',
    // The ⓘ in the Output sheet's header carries it as its aria-description.
    frontend: `Addresses use your frontend: ${FRONTEND_URL}`,
  },
  checks: {
    noHeading: 'Add a main heading',
    titleLong: /^Shorten the title/,
    imageSmall: 'Use a larger social image',
    imageSmallDetail: /^The social image is \d+ [x×] \d+\./,
    siteTwice: 'Remove the repeated site name',
    removeRepeat: 'Remove the repeat',
    goToTitle: 'Show title',
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
