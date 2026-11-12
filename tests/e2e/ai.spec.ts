import type { FrameLocator, Locator } from '@playwright/test';

import { PAGES, UI, USERS } from './constants';
import {
  button,
  draftTitle,
  expect,
  openPage,
  openSeo,
  pageQuery,
  seoState,
  status,
  tab,
  test,
  textbox,
} from './fixture';

/**
 * AI suggestions, against the test provider of canvas_metatag_ai_test: it
 * answers at once and the same every time, and markers in "Refine" make it
 * fail in a chosen way. That no AI control exists without the submodule is
 * asserted where the coupled project already has the dialog open, in
 * page.spec.ts.
 */

test.describe.configure({ mode: 'serial' });

const pricing = PAGES.pricing;
let frame: FrameLocator;

/**
 * Opens a suggestion panel and returns its three variants: the radio buttons
 * that were not there before.
 */
async function suggest(control: Locator): Promise<Locator> {
  const radios = frame.getByRole('radio');
  const before = await radios.count();
  await control.click();
  await expect(radios).toHaveCount(before + 3, { timeout: 30_000 });
  await expect(frame.getByText(UI.ai.disclosure)).toBeVisible();
  return radios.nth(before);
}

test.beforeEach(async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openPage(page, pricing.id);
  frame = await openSeo(page);
  await expect(textbox(frame, UI.field.title)).toBeEnabled();
});

test('a title suggestion changes nothing until it is used, and keeps the site suffix', async ({ page }) => {
  const first = await suggest(button(frame, UI.ai.suggest).first());

  // Three variants are on screen and nothing has been written.
  await expect(status(frame)).toContainText(UI.footer.matchesPage);
  expect(await draftTitle(page, pricing.id)).toBeUndefined();

  // Used, it replaces the page's part of the pattern, as typing does.
  await first.click();
  await button(frame, UI.ai.use).click();
  await expect(textbox(frame, UI.field.title)).toHaveValue(/^.+ \{Separator\} \{Site name\}$/);
  await expect
    .poll(async () => (await draftTitle(page, pricing.id)) ?? '', { timeout: 30_000 })
    .toMatch(/^.+ \{sep\} \{site\}$/);
});

test('"Refine" reaches the provider, and its failures are explained in the tray', async ({ page }) => {
  const control = button(frame, UI.ai.suggest).nth(1);
  await suggest(control);

  // Refine is one click away: a button that becomes a text field.
  const refine = button(frame, UI.ai.steer);
  const steer = frame.getByRole('textbox', { name: UI.ai.steer });
  for (const [hint, message] of [
    ['#garbage', UI.ai.invalid],
    ['#rate-limit', UI.ai.busy],
  ]) {
    if (!(await steer.isVisible())) {
      // A tray left by an earlier failure is started again.
      if (!(await refine.isVisible())) {
        await page.keyboard.press('Escape');
        await suggest(control);
      }
      await refine.click();
    }
    await steer.fill(hint);
    await button(frame, UI.ai.retry).first().click();
    await expect(frame.getByText(message)).toBeVisible({ timeout: 30_000 });
  }

  await expect(textbox(frame, UI.field.description)).toHaveValue(pricing.description);
});

test('the social suggestion fills title and description together', async ({ page }) => {
  await tab(frame, UI.tab.social).click();
  await suggest(button(frame, UI.ai.suggestSocial));
  await button(frame, UI.ai.use).click();
  await expect
    .poll(async () => (await seoState(page, pageQuery(pricing.id))).target?.values.social, { timeout: 30_000 })
    .toEqual({ title: expect.stringMatching(/\S/), description: expect.stringMatching(/\S/) });
});

test('a structured-data proposal leaves what it could not verify unchecked', async ({ page }) => {
  await tab(frame, UI.tab.schema).click();
  await button(frame, UI.ai.suggestSchema).click();
  await expect(frame.getByText(/^This looks like an? /)).toBeVisible({ timeout: 30_000 });
  await expect(frame.getByText(UI.ai.notFound).first()).toBeVisible();
  await expect(frame.getByRole('checkbox', { checked: false }).first()).toBeVisible();
  await expect(frame.getByText(UI.ai.disclosure)).toBeVisible();

  // A proposal is only a proposal.
  expect((await seoState(page, pageQuery(pricing.id))).target?.values.schema).toBeUndefined();
});
