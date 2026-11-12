import type { FrameLocator, Page } from '@playwright/test';

import { IMAGES, PAGES, SITE_NAME, UI, USERS } from './constants';
import { button, closeSeo, expect, graphNode, link, openSeo, readHead, status, tab, test, textbox } from './fixture';

/**
 * Site settings: reached from anywhere, saved explicitly, live at once.
 */

test.describe.configure({ mode: 'serial' });

/** Opens the dialog from Canvas's start screen, where no page is in context. */
async function openSite(page: Page): Promise<FrameLocator> {
  await page.goto('./canvas');
  await expect(page.getByTestId('canvas-side-menu')).toBeVisible({ timeout: 60_000 });
  return openSeo(page);
}

/** Picks an image in the inline picker of the image row that is showing. */
async function pick(frame: FrameLocator, image: { name: string }): Promise<void> {
  await button(frame, UI.action.chooseImage).click();
  await frame.getByRole('button', { name: new RegExp(`^${image.name}`) }).click();
}

test.beforeEach(async ({ drupal }) => {
  await drupal.login(USERS.admin);
});

test('with no page in context the dialog is the site settings, and a save applies at once', async ({
  page,
  visitor,
}) => {
  // A visitor has already seen the page, so it is in the page cache.
  expect((await readHead(visitor, PAGES.about.path)).titles).toEqual([`${PAGES.about.title} | ${SITE_NAME}`]);

  const frame = await openSite(page);
  await expect(frame.getByRole('heading', { name: UI.site.heading })).toBeVisible();
  // Each site tab carries the note; the hidden tabs stay mounted.
  await expect(frame.getByRole('tabpanel').getByText(UI.site.hint)).toBeVisible();
  await expect(frame.getByText(UI.site.band)).toBeVisible();
  await expect(frame.getByRole('radio', { name: UI.scope.page })).toHaveCount(0);
  await expect(status(frame)).toContainText(UI.footer.siteLive);

  // Identity: who runs the site.
  await textbox(frame, UI.field.name).fill('Example Co');
  await pick(frame, IMAGES.logo);

  // Defaults: the separator and the image for pages that have none.
  await tab(frame, UI.tab.defaults).click();
  await frame
    // Named in words: a screen reader may skip punctuation.
    .getByRole('radio', { name: 'Middle dot', exact: true })
    .or(button(frame, 'Middle dot'))
    .first()
    .click();
  await pick(frame, IMAGES.hero);
  await expect(status(frame)).toContainText(UI.footer.siteUnsaved);

  await button(frame, UI.action.save).click();
  // "Saved · live now" shows for two seconds, then the footer settles.
  await expect(status(frame)).toContainText(new RegExp(`${UI.footer.siteSaved}|${UI.footer.siteLive}`), {
    timeout: 30_000,
  });
  await expect(status(frame)).toContainText(UI.footer.siteLive);

  // A page nobody touched has the new name, separator and image, and names
  // its translation.
  const about = await readHead(visitor, PAGES.about.path);
  expect(about.titles).toEqual([`${PAGES.about.title} · Example Co`]);
  expect(about.meta).toMatchObject({
    'og:site_name': ['Example Co'],
    'og:image': [expect.stringMatching(/\/e2e-hero\.png$/)],
  });
  expect(
    about.links
      .filter(({ rel }) => rel === 'alternate')
      .map(({ hreflang }) => hreflang)
      .sort(),
  ).toEqual(['en', 'fi', 'x-default']);

  // The home page says who runs the site.
  const home = await readHead(visitor, './');
  expect(link(home, 'canonical')).toBe(visitor.url());
  expect(home.jsonLd).toHaveLength(1);
  const [graph] = home.jsonLd;
  const identity = graphNode(graph, '#identity');
  expect(identity).toMatchObject({ '@type': 'Organization', name: 'Example Co', url: visitor.url() });
  expect(graphNode(graph, '#logo')).toMatchObject({
    '@type': 'ImageObject',
    '@id': (identity.logo as { '@id': string })['@id'],
    url: expect.stringMatching(/\/e2e-logo\.png$/),
    width: 512,
    height: 512,
  });
  expect(graphNode(graph, '#website')).toMatchObject({
    '@type': 'WebSite',
    name: 'Example Co',
    publisher: { '@id': identity['@id'] },
  });
});

test('unsaved site edits survive a side-menu click, and hiding the site asks first', async ({ page }) => {
  let frame = await openSite(page);
  await textbox(frame, UI.field.name).fill('Example Corporation');
  await expect(status(frame)).toContainText(UI.footer.siteUnsaved);

  // The click destroys the dialog. Opened again, the edit is back, unsaved.
  await closeSeo(page, 'Pages');
  frame = await openSeo(page);
  await expect(textbox(frame, UI.field.name)).toHaveValue('Example Corporation');
  await expect(button(frame, UI.action.save)).toBeEnabled();
  await button(frame, UI.action.discard).click();
  await expect(textbox(frame, UI.field.name)).toHaveValue('Example Co');

  // Hiding every page is confirmed in place, with its consequence spelled out.
  await tab(frame, UI.tab.defaults).click();
  const section = button(frame, new RegExp(`^${UI.field.siteVisibility}`));
  if ((await section.getAttribute('aria-expanded')) !== 'true') {
    await section.click();
  }
  const shown = frame.getByRole('switch', { name: UI.field.showInSearch });
  await expect(shown).toBeChecked();
  await shown.click();
  await expect(status(frame)).toContainText(UI.footer.hidesSite);
  await expect(button(frame, UI.action.hideAndSave)).toBeVisible();
  await expect(button(frame, UI.action.save)).toHaveCount(0);
  await button(frame, UI.action.discard).click();
  await expect(shown).toBeChecked();
  await expect(status(frame)).not.toContainText(UI.footer.hidesSite);
});
