import type { Locator, Page } from '@playwright/test';

import { PAGES, SITE_NAME, TEST_ID, UI, USERS } from './constants';
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

test('an untouched title is inherited; typing keeps the site suffix; reset returns to it', async ({ page }) => {
  const frame = await open(page);
  const title = textbox(frame, UI.field.title);
  const preview = frame.getByTestId(TEST_ID.search);

  // Nothing is stored: field and preview show the site's pattern, resolved.
  // Where it comes from is said on hover or focus.
  await title.hover();
  await expect(frame.getByText(UI.source.site, { exact: true }).first()).toBeVisible();
  await expect.poll(() => shown(title)).toBe(inherited);
  await expect(preview).toContainText(inherited);
  await expect(preview).toContainText(pricing.description);
  await expect(status(frame)).toContainText(UI.footer.matchesPage);
  // Without the AI submodule there is no AI control (see ai.spec.ts).
  await expect(frame.getByRole('button', { name: /^Suggest/ })).toHaveCount(0);

  // Typing replaces the page's part of the pattern and keeps the rest.
  await title.pressSequentially('Pricing plans');
  await expect(title).toHaveValue('Pricing plans {Separator} {Site name}');
  await expect(frame.getByText(UI.source.page, { exact: true })).toBeVisible();
  // The preview, in sight above the field, shows what the chips become.
  await expect(preview).toContainText('Pricing plans | Example');

  // A value from the menu is one chip; Backspace next to it removes all of it.
  await caretAfter(title, 'Pricing plans');
  await button(frame, UI.action.insert).click();
  await frame.getByRole('menuitem', { name: /^Page title/ }).click();
  await expect(title).toHaveValue(/Pricing plans ?\{Page title\} \{Separator\} \{Site name\}/);
  await caretAfter(title, '{Page title}');
  await title.press('Backspace');
  await expect(title).not.toHaveValue(/Page title/);

  // Typing "{" opens the same menu at the caret.
  await caretAfter(title, 'Pricing plans');
  await page.keyboard.type(' by {');
  await expect(frame.getByRole('menu')).toBeVisible();
  // The menu's filter takes the keys that follow once it has focus.
  await expect(frame.getByRole('textbox', { name: 'Filter values' })).toBeFocused();
  await page.keyboard.type('Page t');
  await page.keyboard.press('Enter');
  await expect(title).toHaveValue('Pricing plans by {Page title} {Separator} {Site name}');
  await expect(preview).toContainText('Pricing plans by Pricing | Example');

  // Reset removes the override, and with it the draft.
  await button(frame, `Reset ${UI.field.title}`).click();
  await expect(button(frame, UI.action.undo)).toBeVisible();
  await expect.poll(() => shown(title)).toBe(inherited);
  await expect(preview).toContainText(inherited);
  await expect(status(frame)).toContainText(UI.footer.matchesPage, { timeout: 30_000 });
  expect(await draftTitle(page, pricing.id)).toBeUndefined();
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
  await expect.poll(() => draftTitle(page, pricing.id)).toBe('Pricing plans {sep} {site}');
  const state = await seoState(page, pageQuery(pricing.id));
  expect(state.target?.has_draft).toBe(true);
  expect(state.tokens.title.value).toBe('Pricing and plans');
  await expect(title).toHaveValue('Pricing plans {Separator} {Site name}');
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
  await button(frame, UI.checks.goToTitle).first().click();
  await expect(panel).toHaveCount(0);
  await expect(tab(frame, UI.tab.search)).toHaveAttribute('aria-selected', 'true');
  await expect(textbox(frame, UI.field.title)).toBeFocused();

  // A fix is an ordinary edit: its row goes away and the change is saved.
  await button(frame, UI.tab.checks).click();
  // The same fix also sits under the field, behind the sheet.
  await panel.getByRole('button', { name: UI.checks.removeRepeat, exact: true }).click();
  await expect(panel.getByText(UI.checks.siteTwice)).toHaveCount(0);
  await expect(panel.getByText(UI.checks.titleLong).first()).toBeVisible();
  await expect.poll(() => stored(page, checks.id), { timeout: 30_000 }).not.toContain(SITE_NAME);
});

test('rapid edits in Page data and in the dialog do not lose each other', async ({ page }) => {
  const frame = await open(page);
  const title = textbox(frame, UI.field.title);
  for (const round of [1, 2, 3]) {
    await page.locator(canvasTitle).fill(`Pricing round ${round}`);
    await title.fill(`Race ${round} {Separator} {Site name}`);
  }

  await expect.poll(() => draftTitle(page, pricing.id), { timeout: 60_000 }).toBe('Race 3 {sep} {site}');
  await expect(status(frame)).toContainText(UI.footer.draftPage, { timeout: 30_000 });
  // Let a trailing editor save land before reading both values back.
  await page.waitForTimeout(3_000);
  const state = await seoState(page, pageQuery(pricing.id));
  expect(state.target?.values.title).toBe('Race 3 {sep} {site}');
  expect(state.tokens.title.value).toBe('Pricing round 3');
  expect(await editorConflict(page)).toBe(false);
  await expect(frame.getByText(UI.strip.conflict)).toHaveCount(0);
  await expect(title).toHaveValue('Race 3 {Separator} {Site name}');
});

test('closing mid-edit, a discard in Canvas and a page switch never lose or misplace a change', async ({ page }) => {
  let frame = await open(page);

  await test.step('closed inside the save delay: saved, and not announced as restored', async () => {
    await textbox(frame, UI.field.title).fill('Closed early {Separator} {Site name}');
    await closeSeo(page);
    await expect.poll(() => draftTitle(page, pricing.id), { timeout: 30_000 }).toBe('Closed early {sep} {site}');

    frame = await openSeo(page);
    await expect(textbox(frame, UI.field.title)).toHaveValue('Closed early {Separator} {Site name}');
    await expect(status(frame)).toContainText(UI.footer.draftPage);
    await expect(frame.getByText(UI.strip.offer)).toHaveCount(0);
  });

  await test.step('discarded in "Review changes": offered, not written', async () => {
    await textbox(frame, UI.field.title).fill('Discarded later {Separator} {Site name}');
    await closeSeo(page);
    await expect.poll(() => draftTitle(page, pricing.id), { timeout: 30_000 }).toBe('Discarded later {sep} {site}');

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
    await textbox(frame, UI.field.title).fill('Before the switch {Separator} {Site name}');
    await switchPage(page, PAGES.about.id);
    await expect(frame.getByTestId(TEST_ID.search)).toContainText(PAGES.about.title);
    await expect
      .poll(() => draftTitle(page, pricing.id), { timeout: 30_000 })
      .toBe('Before the switch {sep} {site}');
    await page.waitForTimeout(2_000);
    const about = await seoState(page, pageQuery(PAGES.about.id));
    expect(about.target?.has_draft).toBe(false);
    expect(about.target?.values).toEqual({});
  });
});

test('publishing puts the override into the page head, once, and Output shows the same', async ({ page, visitor }) => {
  const frame = await open(page);
  await textbox(frame, UI.field.title).fill('Plans for every team {Separator} {Site name}');
  await expect
    .poll(() => draftTitle(page, pricing.id), { timeout: 30_000 })
    .toBe('Plans for every team {sep} {site}');
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
    'og:image': [expect.stringMatching(/\/e2e-hero\.png$/)],
    'og:image:width': ['1200'],
    'og:image:height': ['630'],
    'twitter:card': ['summary_large_image'],
  });
  expect(head.jsonLd).toHaveLength(1);
  expect(graphNode(head.jsonLd[0], '#webpage')).toMatchObject({ '@type': 'WebPage', url: canonical });

  // The dialog's Output is that head.
  await button(frame, UI.action.output).click();
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
});
