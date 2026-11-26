import AxeBuilder from '@axe-core/playwright';
import type { FrameLocator, Page } from '@playwright/test';

import { IMAGES, PAGES, SITE_NAME, UI, USERS } from './constants';
import {
  SEO_IFRAME,
  button,
  closeSeo,
  expect,
  graphNode,
  link,
  openPage,
  openSeo,
  readHead,
  scope,
  sheet,
  status,
  switchPage,
  test,
  textbox,
} from './fixture';

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

/** Picks an image for a row ("logo", "site image") in the Choose image sheet. */
async function pick(frame: FrameLocator, noun: string, image: { name: string }): Promise<void> {
  await button(frame, new RegExp(`^(Choose image for the|Change) ${noun}$`)).click();
  await sheet(frame, 'Choose image').getByRole('button', { name: image.name, exact: true }).click();
  await expect(sheet(frame, 'Choose image')).toHaveCount(0);
}

test.beforeEach(async ({ drupal }) => {
  await drupal.login(USERS.admin);
});

/** The sample's image (in Sharing, or the colour's sheet): a data URL the server drew. */
const sample = (frame: FrameLocator) => frame.locator('[data-testid="seo-share-sample"] img, .seo-share-sample > img').first();

/** Sets the default theme's own logo, or puts the theme's default back. */
async function themeLogo(page: Page, path: string | null): Promise<void> {
  await page.goto('./admin/appearance/settings/stark');
  const own = page.getByLabel('Use the logo supplied by the theme');
  await own.setChecked(path === null);
  if (path !== null) {
    await page.getByLabel('Path to custom logo').fill(path);
  }
  await page.getByRole('button', { name: 'Save configuration' }).click();
  await expect(page.getByText('The configuration options have been saved.')).toBeVisible();
}

test('Site › Sharing shows how shared links look and what they are drawn with', async ({ page }) => {
  // A fresh site: a sample card, no logo, a neutral colour, cards for pages
  // without an image.
  let frame = await openSite(page);
  const sharing = frame.getByRole('radiogroup', { name: 'Sample' });
  await expect(sharing.getByRole('radio', { name: 'Page without image' })).toBeChecked();
  await expect(sample(frame)).toHaveAttribute('src', /^data:image\/png;base64,/);
  const logo = frame.locator('.seo-field[data-path="identity.logo"]');
  await expect(logo).toContainText('Add your logo. It goes on shared images and your site icon.');
  const colour = frame.locator('.seo-field[data-path="identity.colour"]');
  await expect(colour.locator('.seo-image-name')).toHaveText('Neutral');
  await expect(frame.getByRole('radio', { name: 'Make one from the title', exact: true })).toBeChecked();
  // No colour code and no contrast outside the colour's sheet.
  await expect(frame.locator('.seo-field[data-path="identity.colour"]')).not.toContainText('#');

  // The sample by keyboard: the arrows choose, and the card follows.
  const page_card = await sample(frame).getAttribute('src');
  await sharing.getByRole('radio', { name: 'Page without image' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(sharing.getByRole('radio', { name: 'Home page' })).toBeChecked();
  await expect(sharing.getByRole('radio', { name: 'Home page' })).toBeFocused();
  await expect(sample(frame)).not.toHaveAttribute('src', page_card!);

  // At 200% zoom the frame keeps its size: half the width. The switch's
  // labels wrap inside it, and nothing here is a serious accessibility
  // problem.
  const halfWidth = (to: string) =>
    page.locator(SEO_IFRAME).evaluate((element, width) => {
      (element as HTMLElement).style.width = width;
    }, to);
  await halfWidth('50%');
  const outside = () =>
    sharing.evaluate((root) => {
      const box = root.getBoundingClientRect();
      return [...root.querySelectorAll('.rt-SegmentedControlItemLabel')]
        .filter((label) => {
          const own = label.getBoundingClientRect();
          return own.top < box.top - 1 || own.bottom > box.bottom + 1 || own.left < box.left - 1 || own.right > box.right + 1;
        })
        .map((label) => label.textContent);
    });
  await expect.poll(outside).toEqual([]);
  const { violations } = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
  expect(
    violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`),
  ).toEqual([]);
  await halfWidth('');

  // Orange, in the colour's sheet: its contrast in words, the sample follows.
  const home_card = await sample(frame).getAttribute('src');
  await button(frame, 'Change colour').click();
  const sheetColour = sheet(frame, 'Colour');
  // The arrows choose here too.
  await sheetColour.getByRole('radio', { name: 'Neutral' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(sheetColour.getByRole('radio', { name: 'Choose a colour' })).toBeChecked();
  await sheetColour.getByRole('textbox', { name: 'Colour code' }).fill('#FF6B00');
  // Shaded so its dark text reads: said as the colour typed.
  await expect(sheetColour.getByRole('status')).toHaveText(/^Your #FF6B00 is shaded to #[0-9A-F]{6} so dark text reaches \d+\.\d:1\./);
  await expect(sample(frame)).not.toHaveAttribute('src', home_card!);
  await button(frame, 'Back').click();
  await expect(colour.locator('.seo-image-name')).toHaveText('Your colour');
  await expect(status(frame)).toContainText(UI.footer.siteUnsaved);
  await button(frame, 'Discard').click();
  await expect(colour.locator('.seo-image-name')).toHaveText('Neutral');

  // "When a page has no image": the arrows choose, and the page sample
  // shows what it says.
  await sharing.getByRole('radio', { name: 'Page without image' }).click();
  const fallback = frame.getByRole('radiogroup', { name: 'When a page has no image' });
  await fallback.getByRole('radio', { name: 'Make one from the title' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(fallback.getByRole('radio', { name: 'Use this image' })).toBeChecked();
  // None chosen yet: what the head sends, a link without an image.
  const none = frame.getByTestId('seo-share-sample');
  await expect(none).toHaveAttribute('data-layout', 'compact');
  await expect(none).toHaveAccessibleName(/\. No image\./);
  await page.keyboard.press('ArrowDown');
  await expect(fallback.getByRole('radio', { name: 'No image' })).toBeChecked();
  // A link without an image: the link preview's small card, with its title.
  await expect(none).toHaveAttribute('data-layout', 'compact');
  await expect(none).toContainText('About us');
  await expect(none.locator('img')).toHaveCount(0);
  // "Use this image" saved without one: said under its row.
  await fallback.getByRole('radio', { name: 'Use this image' }).click();
  await button(frame, UI.action.save).click();
  const missing = frame.locator('.seo-share-fallback-image .seo-guide');
  await expect(missing).toHaveText('Choose the image to use.');
  // Focus goes to what needs attention, never left behind.
  await expect(fallback.getByRole('radio', { name: 'Use this image' })).toBeFocused();
  await button(frame, 'Discard').click();
  await expect(fallback.getByRole('radio', { name: 'Make one from the title' })).toBeChecked();

  // The theme's own PNG logo: shown, and its colour picked.
  await themeLogo(page, 'public://e2e-theme-logo.png');
  frame = await openSite(page);
  const themed = frame.locator('.seo-field[data-path="identity.logo"]');
  await expect(themed.locator('.seo-image-name')).toContainText('From your theme');
  await expect(themed.locator('.seo-thumb img')).toHaveAttribute('src', /e2e-theme-logo\.png/);
  await expect(frame.locator('.seo-field[data-path="identity.colour"] .seo-image-name')).toHaveText('Picked from your logo');

  // An SVG logo: shared images show the initial, and the row asks for a PNG.
  await themeLogo(page, 'public://e2e-theme-logo.svg');
  frame = await openSite(page);
  await expect(frame.locator('.seo-field[data-path="identity.logo"]')).toContainText(
    'Shared images show your initial because your logo is an SVG. Choose a PNG version.',
  );
  await themeLogo(page, null);
});

test('Site › Sharing opened from a page samples that page; the colour sheet a short, typical title', async ({ page }) => {
  await openPage(page, PAGES.story.id);
  const frame = await openSeo(page);
  await scope(frame, UI.scope.site);
  // The page in the editor, as a link to it without an image would look.
  const shared = frame.getByTestId('seo-share-sample');
  await expect(shared).toContainText(PAGES.story.title);
  await expect(shared).toHaveAccessibleName(new RegExp(`Title: .?${PAGES.story.title}`));
  await expect(sample(frame)).toHaveAttribute('src', /^data:image\/png;base64,/);
  // The colour's sheet draws a card it can always draw, its contrast in
  // one sentence.
  await button(frame, 'Change colour').click();
  const colourSheet = sheet(frame, 'Colour');
  await expect(colourSheet.locator('.seo-share-sample > img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await expect(colourSheet.getByRole('status')).toHaveText(/^(White|Dark) text on #[0-9A-F]{6} reads at \d+\.\d:1\.$/);
  await button(frame, 'Back').click();
});

/** The next real save of Site (not a dry run): its body. */
const siteSave = (page: Page) =>
  page
    .waitForRequest((request) => request.method() === 'PUT' && /\/canvas-metatag\/api\/site(\?|$)/.test(request.url()) && !request.postDataJSON()?.dry_run)
    .then((request) => request.postDataJSON() as { identity: { share_fallback: string; default_image: string } });

test('Site › Sharing: a stored site image is shown under its choice, and one kept under cards can be removed', async ({ page }) => {
  let frame = await openSite(page);
  const fallback = frame.getByRole('radiogroup', { name: 'When a page has no image' });
  await fallback.getByRole('radio', { name: 'Use this image' }).click();
  await pick(frame, 'site image', IMAGES.hero);
  let saved = siteSave(page);
  await button(frame, UI.action.save).click();
  expect((await saved).identity).toMatchObject({ share_fallback: 'image' });
  await expect(status(frame)).toContainText(UI.footer.siteSaved);

  // As an upgraded site with a default image has it (site-seo "Upgraded
  // sites keep their site image"): "Use this image", its thumbnail and
  // Change.
  frame = await openSite(page);
  const choices = frame.getByRole('radiogroup', { name: 'When a page has no image' });
  await expect(choices.getByRole('radio', { name: 'Use this image' })).toBeChecked();
  const row = frame.locator('.seo-share-fallback-image');
  await expect(row.locator('.seo-thumb img')).toBeVisible();
  await expect(button(frame, 'Change site image')).toBeVisible();

  // Cards chosen: the image is still shared when a title can't be drawn, so
  // said there, with Remove.
  await choices.getByRole('radio', { name: 'Make one from the title' }).click();
  const kept = frame.locator('.seo-share-fallback-kept');
  await expect(kept).toContainText(`Pages whose title can't be drawn share “${IMAGES.hero.name}”.`);
  await kept.getByRole('button', { name: "Remove the site's image" }).click();
  await expect(kept).toHaveCount(0);
  await expect(choices.getByRole('radio', { name: 'Make one from the title' })).toBeFocused();
  saved = siteSave(page);
  await button(frame, UI.action.save).click();
  expect((await saved).identity).toMatchObject({ share_fallback: 'card', default_image: '' });
  await expect(status(frame)).toContainText(UI.footer.siteSaved);
});

test('Site › Sharing on a server that cannot make images says so in place of the sample', async ({ page }) => {
  await page.route('**/canvas-metatag/api/state**', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, share: { ...body.share, missing: 'fonts' } } });
  });
  const frame = await openSite(page);
  await expect(frame.getByTestId('seo-share-unmade')).toHaveText(
    "Shared images can't be made on this server: the image library has no font support.",
  );
  await expect(frame.getByTestId('seo-share-sample')).toHaveCount(0);
  await expect(frame.getByRole('radiogroup', { name: 'When a page has no image' })).toBeVisible();
  await expect(frame.locator('.seo-field[data-path="identity.logo"]')).toBeVisible();
  await expect(frame.locator('.seo-field[data-path="identity.colour"]')).toHaveCount(0);
  await page.unroute('**/canvas-metatag/api/state**');
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
  await frame.getByRole('radio', { name: 'Use this image', exact: true }).click();
  await pick(frame, 'site image', IMAGES.hero);
  // The row shows the chosen image and offers to change it; the page sample
  // shows it as pages share it.
  await expect(frame.locator('.seo-share-fallback-image .seo-thumb img')).toBeVisible();
  await expect(button(frame, 'Change site image')).toBeVisible();
  await expect(sample(frame)).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  await expect(status(frame)).toContainText(UI.footer.siteUnsaved);

  // The site sets the title's ending, a control as wide as the others, with
  // an example in words. Nothing in Site links to a field.
  await expect(frame.getByText('Page title', { exact: true })).toHaveCount(0);
  const endingField = frame.locator('.seo-field[data-path="values.title_end"]');
  await expect(endingField.locator('.seo-label', { hasText: 'Title ending' })).toBeVisible();
  const [fieldWidth, buttonWidth] = await endingField.evaluate((field) => [
    field.getBoundingClientRect().width,
    field.querySelector('.seo-ending-btn')!.getBoundingClientRect().width,
  ]);
  expect(buttonWidth).toBeGreaterThanOrEqual(fieldWidth - 1);
  const example = frame.locator('.seo-field[data-path="values.title_end"] .seo-guide');
  await expect(example).toHaveText(/^For .+: .+ · Example Co$/);
  await expect(frame.locator('[data-link]')).toHaveCount(0);
  // The ending's menu: typed endings and its options, no fields; what
  // matches comes before typing it as an ending.
  const ending = button(frame, UI.field.titleEnding);
  await ending.click();
  const menu = frame.getByRole('dialog', { name: 'Title ending' });
  await expect(menu.getByRole('textbox', { name: 'Type an ending' })).toBeFocused();
  await page.keyboard.type('no end');
  await expect(menu.getByRole('option')).toHaveText([/^No ending/, /^Use “no end” as the ending/]);
  await page.keyboard.press('Enter');
  await expect(ending).toBeFocused();
  await expect(ending).toHaveAccessibleName("Title ending: No ending");
  await expect(example).toHaveText(/^For .+: [^·]+$/);
  // Back to the site name.
  await ending.click();
  await menu.getByRole('option', { name: /^Site name/ }).click();
  await expect(ending).toHaveAccessibleName("Title ending: Example Co");

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
    // The site's image, as its 1200 × 630 share version, at the site's one
    // address of it.
    'og:image': [expect.stringMatching(/\/canvas-metatag\/share\/site\/[0-9a-f]{16}\.jpg$/)],
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

test('opening a page from the start screen never shows Site settings while the page loads', async ({ page }) => {
  const frame = await openSite(page);
  await expect(frame.getByText(UI.site.hint)).toBeVisible();
  // Every change to the dialog, from here on: its scope, its status, and
  // whether Site's own note is still there.
  await frame.locator('body').evaluate((body, hint) => {
    const seen: { scope: string; status: string; hint: boolean }[] = [];
    Object.assign(window, { e2eSeen: seen });
    new MutationObserver(() =>
      seen.push({
        scope: body.querySelector('.seo-scope')?.textContent ?? '',
        status: body.querySelector('[data-testid="seo-footer-status"]')?.textContent ?? '',
        hint: !!body.querySelector('.seo-body')?.textContent?.includes(hint),
      }),
    ).observe(body, { subtree: true, childList: true, characterData: true });
  }, UI.site.hint);
  await switchPage(page, PAGES.about.id);
  await expect(button(frame, UI.scope.page)).toBeVisible({ timeout: 60_000 });
  type Seen = { scope: string; status: string; hint: boolean }[];
  const seen = await frame.locator('body').evaluate(() => (window as Window & { e2eSeen?: Seen }).e2eSeen ?? []);
  const waiting = seen.slice(seen.findIndex(({ hint }) => !hint));
  expect(waiting.length).toBeGreaterThan(0);
  expect(
    waiting.filter(({ scope, status }) => scope.includes('Site settings') || status.includes(UI.footer.siteLive)),
  ).toEqual([]);
});
