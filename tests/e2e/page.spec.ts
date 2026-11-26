import type { Locator, Page } from '@playwright/test';

import { IMAGES, PAGES, SITE_NAME, TEST_ID, UI, USERS } from './constants';
import {
  button,
  caretAfter,
  closeReview,
  closeSeo,
  draftTitle,
  editorConflict,
  expect,
  isLayoutSave,
  link,
  graphNode,
  openPage,
  openSeo,
  outputRows,
  pageQuery,
  publishAll,
  readHead,
  reviewRows,
  scope,
  selectComponent,
  seoState,
  sheet,
  status,
  switchPage,
  tab,
  test,
  textbox,
} from './fixture';

/**
 * One Canvas page from first look to publication. The tests share the sandbox
 * and run in order: each starts from what the previous one left in the draft.
 */

test.describe.configure({ mode: 'serial' });

const pricing = PAGES.pricing;
const inherited = `${pricing.title} | ${SITE_NAME}`;
const canvasTitle = '[data-drupal-selector="edit-title-0-value"]';
const canvasDescription = 'textarea[name="description[0][value]"]';

async function open(page: Page, id: number = pricing.id) {
  await openPage(page, id);
  return openSeo(page);
}

/** What an inherited field shows: its text, whether typed into it or not. */
const shown = async (field: Locator) => (await field.inputValue()) || (await field.getAttribute('placeholder'));

/** The stored-or-draft title, as a string for matchers that need one. */
const stored = async (page: Page, id: number) => (await draftTitle(page, id)) ?? '';

test.beforeEach(async ({ drupal }) => {
  await drupal.login(USERS.editor);
});

test('a page title is its own words and an ending; braces are text; reset removes both', async ({ page }) => {
  const frame = await open(page);
  const title = textbox(frame, UI.field.title);
  const ending = frame.getByRole('button', { name: UI.field.titleEnding });
  const preview = frame.getByTestId(TEST_ID.search);

  // Nothing is stored: the page's title shows in gray, the ending is the
  // site's, and the preview joins them.
  await expect(title).toHaveAttribute('placeholder', pricing.title);
  await expect(title).toHaveValue('');
  await expect(ending).toHaveAccessibleName(`Title ending: ${SITE_NAME}`);
  await expect(ending).toHaveAccessibleDescription('Added after the separator |.');
  await expect(preview).toContainText(inherited);
  await expect(preview).toContainText(pricing.description);
  await expect(status(frame)).toContainText(UI.footer.matchesPage);
  // Without the AI submodule there is no AI control (see ai.spec.ts).
  await expect(frame.getByRole('button', { name: /^Suggest/ })).toHaveCount(0);
  // A page's title is never linked.
  await expect(frame.getByRole('button', { name: UI.action.link(UI.field.title) })).toHaveCount(0);

  // Typing stores only the typed words; braces are text, never filled.
  await title.pressSequentially('Pricing plans {site}');
  await expect(preview).toContainText(`Pricing plans {site} | ${SITE_NAME}`);
  await expect.poll(() => stored(page, pricing.id)).toBe('Pricing plans {site}');
  await expect(frame.getByText(UI.source.page, { exact: true })).toBeVisible();

  // No ending: the title is the main part alone, with no separator.
  await ending.click();
  const menu = frame.getByRole('dialog', { name: 'Title ending' });
  await expect(menu.getByRole('textbox', { name: 'Type an ending' })).toBeFocused();
  await menu.getByRole('option', { name: /^No ending/ }).click();
  await expect(ending).toBeFocused();
  await expect(ending).toHaveAccessibleName('Title ending: No ending');
  await expect(preview).toContainText('Pricing plans {site}');
  await expect(preview).not.toContainText(`{site} | ${SITE_NAME}`);
  // A typed ending, from the menu's filter.
  await ending.click();
  await page.keyboard.type('Docs');
  await page.keyboard.press('Enter');
  await expect(ending).toHaveAccessibleName('Title ending: Docs');
  await expect(preview).toContainText('Pricing plans {site} | Docs');

  // Reset removes both parts, and with them the draft.
  await button(frame, `Reset ${UI.field.title}`).click();
  // Beside Undo, where the title now comes from.
  await expect(frame.getByText(`Reset · ${UI.source.site} ·`)).toBeVisible();
  await expect(button(frame, UI.action.undo)).toBeVisible();
  await expect(title).toHaveValue('');
  await expect(ending).toHaveAccessibleName(`Title ending: ${SITE_NAME}`);
  await expect(preview).toContainText(inherited);
  await expect(status(frame)).toContainText(UI.footer.matchesPage, { timeout: 30_000 });
  expect(await draftTitle(page, pricing.id)).toBeUndefined();
});

test("Edit beside an inherited ending leads to the site's ending, by keyboard", async ({ drupal, page }) => {
  await drupal.logout();
  await drupal.login(USERS.admin);
  const frame = await open(page);
  const edit = button(frame, `Edit the site default for ${UI.field.title}`);
  await edit.focus();
  await page.keyboard.press('Enter');
  const siteEnding = frame.locator('#seo-site-title-end');
  await expect(siteEnding).toBeFocused();
  await expect(siteEnding).toBeInViewport();
  // The page's ending menu says where the separator is set, and an
  // administrator may go and edit it from there.
  await scope(frame, UI.scope.page);
  await button(frame, UI.field.titleEnding).click();
  const endingMenu = frame.getByRole('dialog', { name: 'Title ending' });
  await expect(endingMenu.locator('.seo-menu-foot')).toContainText('is set for the whole site');
  await endingMenu.locator('.seo-menu-foot').getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(frame.getByRole('dialog', { name: 'Title ending' })).toHaveCount(0);
  await expect(frame.locator('.seo-field[data-path="identity.separator"]')).toBeInViewport();
});

test('after Reset the social image row says where it now comes from, with Undo beside the field', async ({ page }) => {
  const frame = await open(page);
  await tab(frame, UI.tab.social).click();
  await button(frame, UI.action.chooseImage).click();
  await sheet(frame, 'Choose image').getByRole('button', { name: IMAGES.small.name, exact: true }).click();
  await expect(sheet(frame, 'Choose image')).toHaveCount(0);
  await button(frame, 'Reset Image').click();
  const field = frame.locator('.seo-field[data-path="social.image"]');
  await expect(field.locator('.seo-aside')).toHaveText('Reset ·Undo');
  // Said once, in the row: a page's row names where its image comes from.
  await expect(field.locator('.seo-image-name > div').first()).toHaveText(/^(From the Image field|Made from the title|The site's image|No image)$/);
  await expect(status(frame)).toContainText(UI.footer.matchesPage, { timeout: 30_000 });
});

test('Social on a page without an image shows the card the server draws, and follows a typed title', async ({ page }) => {
  const frame = await open(page, PAGES.about.id);
  await tab(frame, UI.tab.social).click();
  const card = frame.getByTestId(TEST_ID.social);
  await expect(frame.locator('.seo-stage', { has: card }).locator('.seo-stage-cap-l')).toContainText('When this page is shared');
  await expect(card).toHaveAttribute('data-layout', 'large');
  // The server's own bytes for the draft, never a public file.
  const image = card.locator('.seo-social-image img[data-front]');
  await expect(image).toHaveAttribute('src', new RegExp(`/canvas-metatag/api/share-preview\\?entity_type=canvas_page&id=${PAGES.about.id}&`));
  expect(await image.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1200, 630]);
  // The image field says where the image comes from, in words: no second picture.
  const field = frame.locator('.seo-field[data-path="social.image"]');
  // One line: "Made from the title" says it all.
  await expect(field.locator('.seo-image-name')).toHaveText('Made from the title');
  await expect(field.locator('.seo-thumb')).toHaveCount(0);
  await expect(field.getByRole('button', { name: 'Choose image', exact: true })).toBeVisible();

  // A typed title: the card follows, once the draft has it (400 ms, then the
  // round trip).
  const before = await image.getAttribute('src');
  await textbox(frame, UI.field.title).pressSequentially('Our people');
  await expect(card.locator('.seo-social-image img[data-front]')).not.toHaveAttribute('src', before!, { timeout: 1_000 });
  await button(frame, 'Reset Title').click();
  await expect(status(frame)).toContainText(UI.footer.matchesPage, { timeout: 30_000 });
});

test('a tiny chosen image is sent as it is: a small card, a square thumbnail, the small card hint', async ({ page }) => {
  const frame = await open(page, PAGES.stored.id);
  await tab(frame, UI.tab.social).click();
  await button(frame, UI.action.chooseImage).click();
  await sheet(frame, 'Choose image').getByRole('button', { name: IMAGES.tiny.name, exact: true }).click();
  const card = frame.getByTestId(TEST_ID.social);
  await expect(card).toHaveAttribute('data-layout', 'compact');
  // A square thumbnail as tall as the card.
  const thumb = (await card.locator('.seo-social-image').boundingBox())!;
  expect(Math.abs(thumb.width - thumb.height)).toBeLessThanOrEqual(1);
  expect((await card.boundingBox())!.height).toBeLessThanOrEqual(thumb.height + 1);
  const stage = frame.locator('.seo-stage', { has: card });
  await expect(stage.getByRole('button', { name: 'About this preview' })).toHaveAttribute('aria-description', 'Small card: image under 600 px wide.');
  await card.screenshot({ path: test.info().outputPath('social-small-card.png') });
  // Output shows the small card hint, once the server has the draft.
  await expect(status(frame)).toContainText(UI.footer.draftPage, { timeout: 30_000 });
  await button(frame, UI.action.output).click();
  await expect(sheet(frame, 'Output').getByText(UI.output.updating)).toHaveCount(0, { timeout: 30_000 });
  expect((await outputRows(frame))['twitter:card']).toBe('summary');
  await button(frame, 'Back').click();
  await button(frame, 'Reset Image').click();
  await expect(status(frame)).toContainText(UI.footer.matchesPage, { timeout: 30_000 });
});

test("a page's own text describes it: the field says so", async ({ page }) => {
  const frame = await open(page, PAGES.story.id);
  const field = frame.locator('.seo-field[data-path="description"]');
  await field.hover();
  await expect(field.locator('.seo-aside')).toContainText("From the page's text");
  await expect(frame.getByTestId(TEST_ID.search)).toContainText('We started as two editors');
});

test("an override is saved into the page draft and survives the editor's own saves", async ({ page }) => {
  const frame = await open(page);
  const title = textbox(frame, UI.field.title);
  await title.pressSequentially('Pricing plans');
  // "Saved to draft" shows for two seconds, then the footer settles.
  await expect(status(frame)).toContainText(new RegExp(`${UI.footer.saved}|${UI.footer.draftPage}`), {
    timeout: 30_000,
  });
  await expect(status(frame)).toContainText(UI.footer.draftPage);

  // Canvas lists the page among its unpublished changes.
  await expect(await reviewRows(page, pricing.title)).toHaveCount(1);
  await closeReview(page);

  // The editor keeps saving: a component, then the page title. No conflict.
  await selectComponent(page, pricing.headingUuid);
  let saved = page.waitForResponse(isLayoutSave(pricing.id));
  await page
    .getByTestId('canvas-contextual-panel')
    .getByRole('textbox', { name: /^Text/ })
    .fill('Plans, prices and questions');
  expect((await saved).status()).toBe(200);
  await page.getByTestId('canvas-contextual-panel--page-data').click();
  saved = page.waitForResponse(isLayoutSave(pricing.id));
  await page.locator(canvasTitle).fill('Pricing and plans');
  expect((await saved).status()).toBe(200);
  expect(await editorConflict(page)).toBe(false);

  // The override is still in the draft, next to Canvas's new page title.
  await expect.poll(() => draftTitle(page, pricing.id)).toBe('Pricing plans');
  const state = await seoState(page, pageQuery(pricing.id));
  expect(state.target?.has_draft).toBe(true);
  expect(state.facts.title.value).toBe('Pricing and plans');
  await expect(title).toHaveValue('Pricing plans');
  await expect(frame.getByTestId(TEST_ID.search)).toContainText('Pricing plans | Example');
});

test("the description is Canvas's own field, handed over once when the field is left", async ({ page }) => {
  const frame = await open(page);
  const description = textbox(frame, UI.field.description);
  await expect(description).toHaveValue(pricing.description);
  const saves: number[] = [];
  page.on('response', (response) => {
    if (isLayoutSave(pricing.id)(response)) {
      saves.push(response.status());
    }
  });

  // While the field has focus its text is its own: the preview follows it and
  // nothing reaches Canvas, however many keys are pressed.
  await description.fill('');
  await description.pressSequentially('Plans that grow with your team.');
  await expect(frame.getByTestId(TEST_ID.search)).toContainText('Plans that grow with your team.');
  await page.waitForTimeout(1_500);
  expect(saves).toEqual([]);
  await expect(page.locator(canvasDescription)).toHaveValue(pricing.description);

  // Leaving the field is one write. Canvas saves it, and then its own form
  // echoing it back: two saves at most, never one per key.
  await description.blur();
  await expect(page.locator(canvasDescription)).toHaveValue('Plans that grow with your team.');
  await expect.poll(() => saves.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(3_000);
  expect(saves.length).toBeLessThanOrEqual(2);
  expect(saves.filter((code) => code !== 200)).toEqual([]);
  await expect(description).toHaveValue('Plans that grow with your team.');

  // Half a character pasted (a lone surrogate, which Canvas refuses as JSON)
  // becomes the replacement character before Canvas gets it: its save works.
  saves.length = 0;
  await description.focus();
  await description.evaluate((element) => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    set.call(element, 'Plans that grow \uD83C');
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(description).toHaveValue('Plans that grow \uFFFD');
  await description.blur();
  await expect(page.locator(canvasDescription)).toHaveValue('Plans that grow \uFFFD');
  await expect.poll(() => saves.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(2_000);
  expect(saves.filter((code) => code !== 200)).toEqual([]);
  await expect(page.getByText('An unexpected error has occurred')).toHaveCount(0);
  // Back to what the tests that follow expect.
  await description.fill('Plans that grow with your team.');
  await description.blur();
  await expect(page.locator(canvasDescription)).toHaveValue('Plans that grow with your team.');
  await expect.poll(() => saves.length, { timeout: 30_000 }).toBeGreaterThan(1);
});

test('a Reset keeps the end of the view, or the field in use, in sight, with its Undo beside it', async ({ page }) => {
  const frame = await open(page);
  await page.setViewportSize({ width: 1440, height: 500 });
  await tab(frame, UI.tab.social).click();
  const view = frame.locator('.seo-frame > .seo-body');
  const bar = frame.locator('.seo-bar');
  const socialTitle = textbox(frame, UI.field.socialTitle);
  const socialDescription = textbox(frame, UI.field.socialDescription);
  await socialTitle.fill('Shared title');
  await socialDescription.fill('Shared words');
  await expect(status(frame)).toContainText(UI.footer.draftPage, { timeout: 30_000 });
  await expect(bar).toHaveCount(0);
  expect(await view.evaluate((element) => element.scrollHeight > element.clientHeight + 40)).toBe(true);
  /**
   * Resets a field without scrolling the view to it: its Undo comes beside
   * it, not in the bar.
   */
  const removeValue = async (name: string) => {
    await button(frame, `Reset ${name}`)
      .last()
      .evaluate((element: HTMLElement) => element.click());
    await expect(frame.getByText(/^Reset · .+ ·$/)).toBeVisible({ timeout: 30_000 });
    await expect(bar).toHaveCount(0);
  };

  // At the end of the view when the bar comes: still at its end, above it.
  await view.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await removeValue(UI.field.socialDescription);
  await expect(socialDescription).toHaveValue('');
  await expect
    .poll(() => view.evaluate((element) => element.scrollTop >= element.scrollHeight - element.clientHeight - 2))
    .toBe(true);
  expect(await view.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await frame.locator('body').screenshot({ path: test.info().outputPath('reset-at-end.png') });

  // Mid-view, the field in use at the view's lower edge: the field and its
  // Undo stay in sight.
  const field = frame.locator('.seo-field[data-path="social.title"]');
  await field.evaluate((element) => {
    const scroller = element.closest('.seo-body')!;
    scroller.scrollTop += element.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom + 4;
  });
  expect(await view.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(
    await view.evaluate((element) => element.scrollTop < element.scrollHeight - element.clientHeight - 2),
  ).toBe(true);
  await removeValue(UI.field.socialTitle);
  await expect(socialTitle).toHaveValue('');
  await expect
    .poll(() =>
      field.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const view = element.closest('.seo-body')!.getBoundingClientRect();
        return box.top >= view.top - 0.5 && box.bottom <= view.bottom + 0.5;
      }),
    )
    .toBe(true);
  await frame.locator('body').screenshot({ path: test.info().outputPath('reset-mid-view.png') });
  // Nothing of this test is left for the next ones.
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect
    .poll(async () => (await seoState(page, pageQuery(pricing.id))).target?.values.social, { timeout: 30_000 })
    .toBeUndefined();
});

test('Checks lists what is wrong, leads to the field and fixes what is certain', async ({ page }) => {
  const checks = PAGES.checks;
  const frame = await open(page, checks.id);
  await button(frame, UI.tab.checks).click();
  const panel = sheet(frame, 'Checks');

  // The heading check reads the page preview, which takes a moment to render.
  await expect(panel.getByText(UI.checks.noHeading).first()).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByText(UI.checks.titleLong).first()).toBeVisible();
  await expect(panel.getByText(UI.checks.imageSmall).first()).toBeVisible();
  await expect(panel.getByText(UI.checks.imageSmallDetail).first()).toBeVisible();
  await expect(panel.getByText(UI.checks.siteTwice).first()).toBeVisible();
  // What Checks covers is one ⓘ away.
  await expect(panel.getByRole('button', { name: 'About checks' })).toHaveAttribute(
    'aria-description',
    UI.checks.closing,
  );
  // Facts only: no score, no percentage.
  await expect(panel).not.toContainText(/score|\d\s?%|\/\s?100/i);

  // "Show" closes the sheet, opens the tab and puts the caret in the field.
  // Two rows lead to the title: their Shows share a name, not a description.
  expect(await button(frame, UI.checks.goToTitle).count()).toBeGreaterThan(1);
  const showTitle = panel
    .getByRole('listitem')
    .filter({ hasText: UI.checks.titleLong })
    .getByRole('button', { name: UI.checks.goToTitle, exact: true });
  await expect(showTitle).toHaveAccessibleDescription(UI.checks.titleLong);
  await showTitle.click();
  await expect(panel).toHaveCount(0);
  await expect(tab(frame, UI.tab.search)).toHaveAttribute('aria-selected', 'true');
  await expect(textbox(frame, UI.field.title)).toBeFocused();

  // A fix is an ordinary edit: its row goes away and the change is saved.
  await button(frame, UI.tab.checks).click();
  // The same fix also sits under the field, behind the sheet.
  await panel.getByRole('button', { name: UI.checks.removeRepeat, exact: true }).click();
  await expect(panel.getByText(UI.checks.siteTwice)).toHaveCount(0);
  // The bar names what was done, with its Undo.
  await expect(frame.locator('.seo-bar')).toContainText('Repeat removed');
  await expect(frame.locator('.seo-bar').getByRole('button', { name: UI.action.undo, exact: true })).toBeVisible();
  await expect(panel.getByText(UI.checks.titleLong).first()).toBeVisible();
  // The title's own words name the site: the fix drops the ending.
  await expect
    .poll(async () => (await seoState(page, pageQuery(checks.id))).target?.values.title_end, { timeout: 30_000 })
    .toEqual({ text: '' });
});

test('rapid edits in Page data and in the dialog do not lose each other', async ({ page }) => {
  const frame = await open(page);
  const title = textbox(frame, UI.field.title);
  for (const round of [1, 2, 3]) {
    await page.locator(canvasTitle).fill(`Pricing round ${round}`);
    await title.fill(`Race ${round}`);
  }

  await expect.poll(() => draftTitle(page, pricing.id), { timeout: 60_000 }).toBe('Race 3');
  await expect(status(frame)).toContainText(UI.footer.draftPage, { timeout: 30_000 });
  // Let a trailing editor save land before reading both values back.
  await page.waitForTimeout(3_000);
  const state = await seoState(page, pageQuery(pricing.id));
  expect(state.target?.values.title).toEqual({ text: 'Race 3' });
  expect(state.facts.title.value).toBe('Pricing round 3');
  expect(await editorConflict(page)).toBe(false);
  await expect(frame.getByText(UI.strip.conflict)).toHaveCount(0);
  await expect(title).toHaveValue('Race 3');
});

test('closing mid-edit, a discard in Canvas and a page switch never lose or misplace a change', async ({ page }) => {
  let frame = await open(page);

  await test.step('closed inside the save delay: saved, and not announced as restored', async () => {
    await textbox(frame, UI.field.title).fill('Closed early');
    await closeSeo(page);
    await expect.poll(() => draftTitle(page, pricing.id), { timeout: 30_000 }).toBe('Closed early');

    frame = await openSeo(page);
    await expect(textbox(frame, UI.field.title)).toHaveValue('Closed early');
    await expect(status(frame)).toContainText(UI.footer.draftPage);
    await expect(frame.getByText(UI.strip.offer)).toHaveCount(0);
  });

  await test.step('discarded in "Review changes": offered, not written', async () => {
    await textbox(frame, UI.field.title).fill('Discarded later');
    await closeSeo(page);
    await expect.poll(() => draftTitle(page, pricing.id), { timeout: 30_000 }).toBe('Discarded later');

    const row = (await reviewRows(page, /Pricing/)).first();
    await row.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Discard changes' }).click();
    await expect
      .poll(async () => (await seoState(page, pageQuery(pricing.id))).target?.has_draft, { timeout: 30_000 })
      .toBe(false);
    await closeReview(page);

    frame = await openSeo(page);
    await expect(frame.getByText(UI.strip.offer)).toBeVisible();
    await page.waitForTimeout(2_000);
    const state = await seoState(page, pageQuery(pricing.id));
    expect(state.target?.has_draft).toBe(false);
    expect(state.target?.values).toEqual({});
    await button(frame, UI.action.discard).click();
    await expect(frame.getByText(UI.strip.offer)).toHaveCount(0);
  });

  await test.step('the editor moves to another page: the change goes to the page it was made on', async () => {
    await textbox(frame, UI.field.title).fill('Before the switch');
    await switchPage(page, PAGES.about.id);
    // Another page is a new target, and the dialog says so.
    await expect(status(frame)).toContainText(`Now editing ${PAGES.about.title}`);
    await expect(frame.getByTestId(TEST_ID.search)).toContainText(PAGES.about.title);
    await expect
      .poll(() => draftTitle(page, pricing.id), { timeout: 30_000 })
      .toBe('Before the switch');
    await page.waitForTimeout(2_000);
    const about = await seoState(page, pageQuery(PAGES.about.id));
    expect(about.target?.has_draft).toBe(false);
    expect(about.target?.values).toEqual({});
  });

  await test.step('there and back: the view stays at its top, and a description typed at once reaches the page', async () => {
    await tab(frame, UI.tab.social).click();
    const view = frame.locator('.seo-frame > .seo-body');
    expect(await view.evaluate((element) => element.scrollTop)).toBe(0);
    await switchPage(page, pricing.id);
    // "Now editing" brings the bar: the view makes room, and stays at its top.
    await expect(status(frame)).toContainText(`Now editing ${pricing.title}`);
    await page.waitForTimeout(500);
    expect(await view.evaluate((element) => element.scrollTop)).toBe(0);
    await switchPage(page, PAGES.about.id);
    await expect(status(frame)).toContainText(`Now editing ${PAGES.about.title}`);
    // While Canvas stores the new page's draft the field is writable, and
    // what is typed there is handed over, not dropped.
    await tab(frame, UI.tab.search).click();
    const description = textbox(frame, UI.field.description);
    await description.fill('Typed right after the switch.');
    await description.blur();
    await expect(page.locator(canvasDescription)).toHaveValue('Typed right after the switch.');
    await expect(description).toHaveValue('Typed right after the switch.');
  });
});

test('publishing puts the override into the page head, once, and Output shows the same', async ({ page, visitor }) => {
  const frame = await open(page);
  await textbox(frame, UI.field.title).fill('Plans for every team');
  await expect
    .poll(() => draftTitle(page, pricing.id), { timeout: 30_000 })
    .toBe('Plans for every team');
  await expect(status(frame)).toContainText(UI.footer.draftPage, { timeout: 30_000 });
  await publishAll(page);
  await expect(status(frame)).toContainText(UI.footer.matchesPage, { timeout: 30_000 });

  const head = await readHead(visitor, pricing.path);
  const canonical = link(head, 'canonical');
  expect(head.titles).toEqual(['Plans for every team | Example']);
  expect(canonical).toBe(visitor.url());
  expect(head.links.filter(({ rel }) => rel === 'shortlink')).toEqual([]);
  expect(head.meta).toMatchObject({
    description: [pricing.description],
    robots: ['max-image-preview:large'],
    'og:type': ['website'],
    'og:site_name': [SITE_NAME],
    'og:title': [pricing.title],
    'og:description': [pricing.description],
    'og:url': [canonical],
    // The page's own image, as its 1200 × 630 share version.
    'og:image': [expect.stringMatching(/\/canvas-metatag\/share\/en\/canvas_page\/\d+\/[0-9a-f]{16}\.jpg$/)],
    'og:image:type': ['image/jpeg'],
    'og:image:width': ['1200'],
    'og:image:height': ['630'],
    'twitter:card': ['summary_large_image'],
  });
  expect(head.jsonLd).toHaveLength(1);
  expect(graphNode(head.jsonLd[0], '#webpage')).toMatchObject({ '@type': 'WebPage', url: canonical });

  // The dialog's Output is that head. Nothing is pending: no marker.
  await button(frame, UI.action.output).click();
  await expect(sheet(frame, 'Output').getByText(UI.output.updating)).toHaveCount(0);
  await expect(frame.getByTestId(TEST_ID.output)).not.toHaveAttribute('aria-busy');
  expect(await outputRows(frame)).toMatchObject({
    title: head.titles[0],
    description: pricing.description,
    robots: 'max-image-preview:large',
    canonical,
    'og:title': pricing.title,
    'og:url': canonical,
    'og:image': head.meta['og:image'][0],
    'twitter:card': 'summary_large_image',
  });

  // Opened right after an edit, Output says it is catching up, then shows
  // the new title. The write is held back so that the words get to show:
  // they come only after 400 ms, so that a quick save stays quiet, into a
  // status region that was there, empty, before them, so that they are
  // announced.
  await button(frame, UI.action.back).click();
  await page.route('**/canvas-metatag/api/draft/**', async (route) => {
    await new Promise((done) => setTimeout(done, 1500));
    await route.continue();
  });
  await textbox(frame, UI.field.title).fill('Plans and prices');
  await frame.locator('body').evaluate((body, words) => {
    const seen: { region?: number; words?: number } = {};
    Object.assign(window, { seen });
    new MutationObserver(() => {
      const region = body.querySelector('[role="status"].seo-updating-live');
      if (region) {
        seen.region ??= performance.now();
        if (region.textContent?.includes(words)) {
          seen.words ??= performance.now();
        }
      }
    }).observe(body, { childList: true, subtree: true, characterData: true });
  }, UI.output.updating);
  await button(frame, UI.action.output).click();
  const output = sheet(frame, 'Output');
  const rows = frame.getByTestId(TEST_ID.output);
  await expect(output.getByRole('status').filter({ hasText: UI.output.updating })).toBeVisible();
  const seen = await frame.locator('body').evaluate(() => (window as unknown as { seen: { region: number; words: number } }).seen);
  // The timer starts with the region; the observer notes it a moment later.
  expect(seen.words - seen.region).toBeGreaterThanOrEqual(350);
  await expect(rows).toHaveAttribute('aria-busy', 'true');
  await expect(output.getByText(UI.output.updating)).toHaveCount(0, { timeout: 30_000 });
  await expect(rows).not.toHaveAttribute('aria-busy');
  expect((await outputRows(frame)).title).toBe('Plans and prices | Example');
  await page.unrouteAll();
});

test("an Article page's dates follow its own, and a key on a date box finds a field", async ({ page }) => {
  const frame = await open(page, PAGES.stored.id);
  const draft = async () => (await seoState(page, pageQuery(PAGES.stored.id))).target?.values.schema;
  const before = await draft();
  await tab(frame, UI.tab.schema).click();
  await button(frame, UI.schema.kind).click();
  await frame.getByRole('radio', { name: UI.schema.article }).check();
  await button(frame, 'Change to an article').click();
  const more = button(frame, 'More details');
  if ((await more.getAttribute('aria-expanded')) !== 'true') {
    await more.click();
  }
  // A date detail follows the page's own date: a default box.
  const published = frame.getByRole('combobox', { name: 'Published', exact: true });
  await expect(published.locator('.seo-linked-tag')).toHaveText('Default · First published');
  // The image follows the page's image, its only choice: nothing to link.
  await expect(frame.locator('.seo-field[data-path="schema.props.image"] [data-link]')).toHaveCount(0);
  // A key on a date box never writes a date: it opens the menu, filtered.
  await published.press('2');
  const menu = frame.getByRole('dialog', { name: 'Link Published' });
  await expect(menu.getByRole('textbox', { name: 'Find a field' })).toHaveValue('2');
  await page.keyboard.press('Escape');
  await expect(published).toBeFocused();
  await expect.poll(async () => ((await draft()) as { props?: Record<string, unknown> } | undefined)?.props?.datePublished).toBeUndefined();
  // Linked to the page's last update instead: stored as that fact.
  await published.click();
  await menu.getByRole('option', { name: /^Last updated, / }).click();
  await expect(published).toBeFocused();
  await expect(published.locator('.seo-linked-tag')).toHaveText('Last updated');
  await expect
    .poll(async () => ((await draft()) as { props?: Record<string, unknown> } | undefined)?.props?.datePublished)
    .toEqual({ fact: 'modified' });
  await button(frame, 'Unlink Published').click();
  // Back to the kind it had: Undo.
  await button(frame, UI.schema.kind).click();
  await frame.getByRole('radio', { name: UI.schema.webPage }).check();
  await button(frame, 'Change to a web page').click();
  await expect.poll(draft, { timeout: 30_000 }).toEqual(before);

});
