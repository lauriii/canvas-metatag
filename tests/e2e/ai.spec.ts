import type { FrameLocator, Locator } from '@playwright/test';

import { PAGES, SITE_NAME, UI, USERS } from './constants';
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
 *
 * The AI setup sets the search result prompt in configuration to a short
 * text without {count}, for every test here. The test provider answers in
 * prose, which the tray shows as an error, unless the system prompt still
 * ends with the fixed safety text and answer shape: every title suggestion
 * below proves that an edited prompt keeps working.
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

test('a title suggestion changes nothing until it is used, and keeps the ending', async ({ page }) => {
  const control = button(frame, UI.ai.suggest).first();
  await expect(control).toHaveAccessibleDescription(UI.ai.sends);
  // The request says the ending on its own; the current title is its main
  // part.
  const request = page.waitForRequest((sent) => sent.url().includes('/canvas-metatag/api/ai/suggest') && sent.method() === 'POST');
  const first = await suggest(control);
  const body = (await request).postDataJSON();
  expect(body.page.ending).toBe(`| ${SITE_NAME}`);
  expect(body.current.title).not.toContain(`| ${SITE_NAME}`);
  await page.screenshot({ path: test.info().outputPath('title-suggestions.png') });
  // The count is said after the text, not read as part of it.
  await expect(first).toHaveAccessibleDescription(/^\d+ characters?$/);
  await expect(first).not.toHaveAccessibleName(/\d\s*$/);

  // Three variants are on screen and nothing has been written.
  await expect(status(frame)).toContainText(UI.footer.matchesPage);
  expect(await draftTitle(page, pricing.id)).toBeUndefined();

  // Used, it is the title's own words, as typing is; the ending stays.
  await first.click();
  await button(frame, UI.ai.use).click();
  await expect(textbox(frame, UI.field.title)).toHaveValue(/\S/);
  await expect(button(frame, UI.field.titleEnding)).toHaveAccessibleName(`Title ending: ${SITE_NAME}`);
  await expect
    .poll(async () => (await draftTitle(page, pricing.id)) ?? '', { timeout: 30_000 })
    .toMatch(/\S/);
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
    .toEqual({ title: { text: expect.stringMatching(/\S/) }, description: { text: expect.stringMatching(/\S/) } });
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

test('a site guardrail blocks a request and the tray says so', async ({ page }) => {
  // The AI setup adds a global guardrail that stops any request with the
  // marker in it, before the provider is called.
  const before = await draftTitle(page, pricing.id);
  const radios = frame.getByRole('radio');
  const others = await radios.count();
  await suggest(button(frame, UI.ai.suggest).first());
  await button(frame, UI.ai.steer).click();
  await frame.getByRole('textbox', { name: UI.ai.steer }).fill(UI.ai.policyMarker);
  await button(frame, UI.ai.retry).first().click();

  await expect(frame.getByText(UI.ai.blocked)).toBeVisible({ timeout: 30_000 });
  // The sentence replaces the variants, and nothing claims AI wrote text.
  await expect(radios).toHaveCount(others);
  await expect(frame.getByText(UI.ai.disclosure)).toHaveCount(0);
  await expect(button(frame, UI.ai.retry).first()).toBeVisible();
  expect(await draftTitle(page, pricing.id)).toBe(before);
});

const SUGGEST = /\/canvas-metatag\/api\/ai\/suggest(\?|$)/;
const STATUS: Record<string, number> = { provider_error: 502, blocked: 422, ai_not_configured: 422 };

test('a failure that asking again cannot help offers only Dismiss', async ({ page }) => {
  // The server's answers are stood in for, in order: the guardrail the AI
  // setup adds needs Refine text, and the provider is set up for the whole
  // project.
  const codes: string[] = [];
  await page.route(SUGGEST, (route) => {
    const code = codes.shift() ?? 'provider_error';
    return route.fulfill({ status: STATUS[code], json: { error: { code, message: 'From the server.' } } });
  });
  const tray = frame.getByRole('group', { name: UI.ai.tray, exact: true });
  const final = async (sentence: string) => {
    await expect(tray.getByText(sentence, { exact: true })).toBeVisible({ timeout: 30_000 });
    // One sentence and one way out: no Try again, no Refine, no disclosure.
    await expect(tray.getByRole('button')).toHaveText([UI.ai.dismiss]);
    await expect(tray.locator('p')).toHaveCount(1);
    await expect(tray).toBeFocused();
    await tray.getByRole('button', { name: UI.ai.dismiss }).click();
    await expect(tray).toHaveCount(0);
  };

  // Blocked without Refine text, after a failure that offered Try again:
  // the button that asked goes, and focus goes to the tray.
  codes.push('provider_error', 'blocked');
  await button(frame, UI.ai.suggest).first().click();
  await tray.getByRole('button', { name: UI.ai.retry }).click();
  await final(UI.ai.blockedFinal);

  // Not set up, in the structured data tray.
  codes.push('ai_not_configured');
  await tab(frame, UI.tab.schema).click();
  await button(frame, UI.ai.suggestSchema).click();
  await final(UI.ai.notConfigured);
});
