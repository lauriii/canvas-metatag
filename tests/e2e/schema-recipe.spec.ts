import type { FrameLocator, Page } from '@playwright/test';

import { COMPLEX, PAGES, UI, USERS } from './constants';
import { button, expect, openPage, openSeo, openTemplate, sheet, tab, test, writeDraft } from './fixture';

/**
 * A recipe set up on its content type, and one typed on a Canvas page. On
 * the template its lists come from fields: the ingredients from a field of
 * several values, the steps from one, and one formatted text gives its own
 * list items. On a page the times are typed, and the lists are not offered.
 * The sandbox is the complex fixture (project `schema-templates`).
 */

test.describe.configure({ mode: 'serial' });

const { recipe } = COMPLEX;

test.beforeEach(async ({ drupal }) => {
  await drupal.login(USERS.editor);
});

/** Opens More details, unless it is open. */
async function openMore(frame: FrameLocator) {
  const more = frame.getByRole('button', { name: /^More details/ });
  if ((await more.getAttribute('aria-expanded')) !== 'true') {
    await more.click();
  }
}

/** Chooses a kind in its sheet, and confirms it. */
async function choose(frame: FrameLocator, kind: string, confirm: string) {
  await button(frame, UI.schema.kind).click();
  await frame.getByRole('radio', { name: kind }).check();
  await button(frame, confirm).click();
}

/** The link menu of a detail, opened from its link button. */
/** The facts shown before More details. */
const shownFirst = (frame: FrameLocator) =>
  frame.locator('.seo-panel[data-state="active"]').evaluate((panel) =>
    [...panel.querySelectorAll(':scope > [data-path^="schema.props."]')].map((one) => one.getAttribute('data-path')),
  );

async function linkMenu(frame: FrameLocator, label: string) {
  await button(frame, UI.action.link(label)).click();
  const menu = frame.getByRole('dialog', { name: `Link ${label}` });
  await expect(menu).toBeVisible();
  return menu;
}

test('every recipe: lists from fields of several values, a body by its items, times in their unit', async ({ page }) => {
  await openTemplate(page, recipe.id, 'recipe');
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  await choose(frame, 'A recipe', 'Change to a recipe');
  // On a content type a recipe's substance comes first: its ingredients and
  // steps, then its times; More details holds the rest.
  await expect.poll(() => shownFirst(frame)).toEqual(['schema.props.recipeIngredient', 'schema.props.recipeInstructions', 'schema.props.prepTime', 'schema.props.cookTime']);

  // Ingredients: the field of several values named like it comes first and
  // gives every item (a single value is refused: values.test.ts).
  let menu = await linkMenu(frame, 'Ingredients');
  const suggested = menu.getByRole('group', { name: 'Suggested' }).getByRole('option');
  await expect(suggested.first()).toHaveAccessibleName(/^Ingredients, All 4, in order/);
  await suggested.first().click();
  // At rest the box says that every item is used.
  await expect(frame.getByRole('combobox', { name: 'Ingredients', exact: true })).toContainText(`${recipe.firstIngredient} and 3 more`);

  // Steps: a formatted text gives its own list items; the steps field every one.
  menu = await linkMenu(frame, 'Steps');
  await expect(menu.getByRole('option', { name: /^Introduction, Each list item, in order/ })).toBeVisible();
  await menu.getByRole('option', { name: /^Steps, All 3, in order/ }).click();

  // Times: linked to fields that count minutes, read in their unit.
  menu = await linkMenu(frame, 'Prep time');
  await menu.getByRole('option', { name: /^Preparation \(minutes\)/ }).click();
  await expect(frame.getByRole('combobox', { name: 'Prep time: the field counts minutes', exact: true })).toBeVisible();
  await expect(frame.getByRole('combobox', { name: 'Prep time', exact: true })).toContainText('20 min');
  menu = await linkMenu(frame, 'Cook time');
  await menu.getByRole('option', { name: /^Cooking \(minutes\)/ }).click();
  await expect(frame.getByRole('combobox', { name: 'Cook time', exact: true })).toContainText('50 min');

  // What ships: every ingredient, one step per item, times in ISO 8601.
  await expect(frame.getByRole('region', { name: UI.schema.stage })).toContainText('Recipe result', { timeout: 30_000 });
  await button(frame, UI.schema.code).click();
  const output = sheet(frame, 'Output');
  await output.getByRole('button', { name: 'Show JSON-LD' }).click();
  await expect(output).toContainText('"recipeIngredient"', { timeout: 30_000 });
  await expect(output).toContainText('HowToStep');
  await expect(output).toContainText('PT20M');
  await expect(output).toContainText('PT50M');
  await page.screenshot({ path: test.info().outputPath('every-recipe-output.png') });
});

/** A Canvas page described as a recipe, opened on its Schema view. */
async function described(page: Page, id: number): Promise<FrameLocator> {
  await page.goto('./');
  await writeDraft(page, `canvas_page/${id}`, `layout/canvas_page/${id}`, { schema: { type: 'Recipe' } });
  await openPage(page, id);
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  return frame;
}

test('a recipe page: times typed in hours and minutes, no lists to fill', async ({ page }) => {
  const frame = await described(page, PAGES.pricing.id);
  // On a page its times and image come first; ingredients and steps come
  // from components: not offered on a page.
  await expect.poll(() => shownFirst(frame)).toEqual(['schema.props.prepTime', 'schema.props.cookTime', 'schema.props.totalTime', 'schema.props.image']);
  await openMore(frame);
  await expect(frame.locator('[data-path="schema.props.recipeIngredient"]')).toHaveCount(0);
  await expect(frame.locator('[data-path="schema.props.recipeInstructions"]')).toHaveCount(0);
  // Ninety minutes carry into an hour when focus leaves the box.
  const minutes = frame.getByRole('textbox', { name: 'Prep time, minutes' });
  await minutes.fill('90');
  await minutes.press('Tab');
  await expect(frame.getByRole('textbox', { name: 'Prep time, hours' })).toHaveValue('1');
  await expect(minutes).toHaveValue('30');
  await frame.getByRole('textbox', { name: 'Cook time, minutes' }).fill('30');
  await frame.getByRole('textbox', { name: 'Cook time, minutes' }).press('Tab');
  await button(frame, UI.schema.code).click();
  const output = sheet(frame, 'Output');
  await output.getByRole('button', { name: 'Show JSON-LD' }).click();
  await expect(output).toContainText('PT1H30M', { timeout: 30_000 });
  await expect(output).toContainText('PT30M');
  await page.screenshot({ path: test.info().outputPath('recipe-page-times.png') });
});
