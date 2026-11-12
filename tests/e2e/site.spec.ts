import type { FrameLocator, Page } from '@playwright/test';

import { IMAGES, PAGES, SITE_NAME, UI, USERS } from './constants';
import { button, closeSeo, expect, graphNode, link, openSeo, readHead, sheet, status, test, textbox } from './fixture';

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

/** Picks an image for a row ("logo", "default image") in the Choose image sheet. */
async function pick(frame: FrameLocator, noun: string, image: { name: string }): Promise<void> {
  await button(frame, new RegExp(`^(Choose|Change) ${noun}$`)).click();
  await sheet(frame, 'Choose image').getByRole('button', { name: image.name, exact: true }).click();
  await expect(sheet(frame, 'Choose image')).toHaveCount(0);
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
  // One view, no tabs, and a note on why there is no page.
  await expect(frame.getByText(UI.site.hint)).toBeVisible();
  await expect(frame.getByRole('tab')).toHaveCount(0);
  await expect(frame.getByRole('button', { name: UI.scope.page })).toHaveCount(0);
  await expect(status(frame)).toContainText(UI.footer.siteLive);

  // Identity: who runs the site.
  await textbox(frame, UI.field.name).fill('Example Co');
  await pick(frame, 'logo', IMAGES.logo);

  // Titles and sharing: the separator and the image for pages that have none.
  await frame
    // Named in words: a screen reader may skip punctuation.
    .getByRole('radio', { name: 'Middle dot', exact: true })
    .or(button(frame, 'Middle dot'))
    .first()
    .click();
  await pick(frame, 'default image', IMAGES.hero);
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
  // The switch is the first row of the Visibility list; the rest is "Advanced".
  await expect(button(frame, UI.field.siteVisibility)).toBeVisible();
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
