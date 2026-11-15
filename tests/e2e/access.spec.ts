import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { PAGES, SITE_NAME, TEST_ID, UI, USERS } from './constants';
import {
  SEO_IFRAME,
  button,
  draftTitle,
  expect,
  isLayoutSave,
  openPage,
  openSeo,
  pageQuery,
  scope,
  seoState,
  sheet,
  status,
  switchPage,
  tab,
  test,
  textbox,
  writeDraft,
} from './fixture';

/**
 * Who may do what, what the dialog does when it cannot save safely, and
 * whether everyone can use it: keyboard, assistive technology, zoom.
 */

test.describe.configure({ mode: 'serial' });

const pricing = PAGES.pricing;

test('without the permission the dialog says so and offers nothing', async ({ drupal, page }) => {
  await drupal.login(USERS.noSeo);
  await openPage(page, pricing.id);
  const frame = await openSeo(page);
  await expect(frame.getByRole('heading', { name: UI.noAccess.heading })).toBeVisible();
  await expect(frame.getByText(UI.noAccess.text)).toBeVisible();
  await expect(frame.getByRole('tab')).toHaveCount(0);
  await expect(frame.getByRole('textbox')).toHaveCount(0);
});

test('with "edit" only, site settings can be read and not changed', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openPage(page, pricing.id);
  const frame = await openSeo(page);
  await expect(textbox(frame, UI.field.title)).toBeEnabled();

  await scope(frame, UI.scope.site);
  await expect(frame.getByText(UI.site.readOnly)).toBeVisible();
  await expect(textbox(frame, UI.field.name)).toBeDisabled();
  await expect(button(frame, UI.action.save)).toHaveCount(0);

  // The server agrees.
  const token = await (await page.request.get('./session/token')).text();
  const refused = await page.request.put('./canvas-metatag/api/site', {
    headers: { 'X-CSRF-Token': token },
    data: { identity: {}, values: {} },
  });
  expect(refused.status()).toBe(403);
});

test('someone who may view a page but not edit it never receives its draft', async ({ drupal, page }) => {
  const { id, seoTitle } = PAGES.stored;
  await drupal.login(USERS.editor);
  await writeDraft(page, `canvas_page/${id}`, `layout/canvas_page/${id}`, { title: 'Draft title {sep} {site}' });
  expect(await seoState(page, pageQuery(id))).toMatchObject({
    can: { target: true },
    target: { has_draft: true, values: { title: 'Draft title {sep} {site}' } },
  });

  await drupal.logout();
  await drupal.login(USERS.viewer);
  const state = await seoState(page, pageQuery(id));
  expect(state.can).toEqual({ target: false, site: false });
  expect(state.target).toMatchObject({ has_draft: false, values: { title: seoTitle } });
  expect(state.resolved?.head.title).toBe(`Published title | ${SITE_NAME}`);
});

test('when the editor cannot be read the page is read-only, and the site still saves', async ({ drupal, page }) => {
  await drupal.login(USERS.admin);
  await openPage(page, pricing.id);
  await page.evaluate(() => {
    delete window.drupalSettings.canvas.store;
  });
  const frame = await openSeo(page);

  // Reading still works; nothing can be typed into the page's settings.
  await expect(frame.getByRole('alert').filter({ hasText: UI.strip.cannotSave })).toBeVisible();
  await expect(button(frame, UI.action.reload)).toBeVisible();
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(`${pricing.title} | ${SITE_NAME}`);
  await expect(textbox(frame, UI.field.title)).toBeDisabled();
  await expect(status(frame)).toContainText(UI.footer.readOnly);

  // Site settings do not go through the editor, so they still save.
  await scope(frame, UI.scope.site);
  const profiles = textbox(frame, UI.field.profiles);
  await profiles.fill('https://social.example/example');
  await profiles.blur();
  await button(frame, UI.action.save).click();
  await expect
    .poll(async () => (await seoState(page, '')).site.identity.same_as, { timeout: 30_000 })
    .toEqual(['https://social.example/example']);
  await expect(status(frame)).toContainText(UI.footer.siteLive, { timeout: 30_000 });
});

/**
 * Hides the page's draft entry from the dialog (which reads the editor
 * through drupalSettings) until `release()`, as an editor slow to store it
 * would.
 */
async function hideDraft(page: Page, id: number): Promise<() => Promise<void>> {
  await page.evaluate((id) => {
    const settings = window.drupalSettings;
    const real = settings.canvas.store;
    const key = `canvas/api/v0/layout/canvas_page/${id}`;
    let hidden = true;
    let seen: unknown = null;
    let stripped: Record<string, unknown> = {};
    const release = () => {
      hidden = false;
      // Any action makes the store tell its subscribers.
      real.dispatch({ type: 'pendingChangesApi/invalidateTags', payload: [{ type: 'PendingChanges', id: 'LIST' }] });
    };
    Object.assign(window, { e2eRelease: release });
    settings.canvas.store = {
      ...real,
      getState() {
        const state = real.getState();
        if (!hidden) {
          return state;
        }
        const hash = state.publishReview.autoSavesHash;
        if (hash !== seen) {
          seen = hash;
          stripped = { ...hash };
          delete stripped[key];
        }
        return { ...state, publishReview: { ...state.publishReview, autoSavesHash: stripped } };
      },
    };
  }, id);
  return () => page.evaluate(() => (window as Window & { e2eRelease?: () => void }).e2eRelease?.());
}

test('a change typed before the editor has stored the draft is saved once it has, however late', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.admin);
  await openPage(page, pricing.id);
  const release = await hideDraft(page, pricing.id);
  const frame = await openSeo(page);
  const title = textbox(frame, UI.field.title);

  // For 2 s the missing draft is taken for one on its way: the field is
  // writable. After that it is shown, and the change waits, said so.
  await expect(title).toBeEnabled();
  await title.fill('Stored late {Separator} {Site name}');
  await expect(frame.getByRole('alert').filter({ hasText: UI.strip.cannotSave })).toBeVisible({ timeout: 10_000 });
  await expect(status(frame)).toContainText(UI.footer.unstored);
  await expect(title).toHaveValue('Stored late {Separator} {Site name}');

  // Once the editor has stored it, the change goes out by itself.
  const sent = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().includes('/canvas-metatag/api/draft/'),
  );
  await release();
  await sent;
  await expect(frame.getByRole('alert').filter({ hasText: UI.strip.cannotSave })).toHaveCount(0);
  await expect.poll(() => draftTitle(page, pricing.id), { timeout: 30_000 }).toBe('Stored late {sep} {site}');
  await expect(status(frame)).toContainText(UI.footer.draftPage, { timeout: 30_000 });
});

test('a change left behind while the draft was missing is restored once the editor has stored it', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.admin);
  await openPage(page, pricing.id);
  const release = await hideDraft(page, pricing.id);
  const frame = await openSeo(page);
  const title = textbox(frame, UI.field.title);
  await title.fill('Left behind {Separator} {Site name}');
  await expect(status(frame)).toContainText(UI.footer.unstored, { timeout: 10_000 });

  // Away and back while the draft is still missing: the change is kept in
  // the session, not written, and not looked at while the page can't be.
  await switchPage(page, PAGES.about.id);
  await expect(status(frame)).toContainText(`Now editing ${PAGES.about.title}`);
  await switchPage(page, pricing.id);
  await expect(status(frame)).toContainText(`Now editing ${pricing.title}`);
  await expect(title).not.toHaveValue('Left behind {Separator} {Site name}');

  // Once the editor has stored it, the change comes back and goes out.
  await release();
  await expect(title).toHaveValue('Left behind {Separator} {Site name}', { timeout: 10_000 });
  await expect(status(frame)).toContainText(UI.footer.restored);
  await expect.poll(() => draftTitle(page, pricing.id), { timeout: 30_000 }).toBe('Left behind {sep} {site}');
});

test('a save from another session is shown as a conflict, not written over', async ({ drupal, page }) => {
  const { id } = PAGES.about;
  await drupal.login(USERS.admin);
  await openPage(page, id);
  const frame = await openSeo(page);
  await expect(textbox(frame, UI.field.title)).toBeEnabled();

  // Another session takes over the page's draft; the editor's next save is
  // then refused by Canvas.
  await writeDraft(page, `canvas_page/${id}`, `layout/canvas_page/${id}`, { robots: { nofollow: true } });
  const refused = page.waitForResponse(isLayoutSave(id));
  await page.locator('[data-drupal-selector="edit-title-0-value"]').fill('About us, edited');
  expect((await refused).status()).toBe(409);

  await expect(frame.getByRole('alert').filter({ hasText: UI.strip.conflict })).toBeVisible();
  await expect(button(frame, UI.action.reload)).toBeVisible();
  await expect(textbox(frame, UI.field.title)).toBeDisabled();
});

test('the three tabs and the Checks sheet work by keyboard, pass an accessibility scan and reflow at 200% zoom', async ({
  drupal,
  page,
}) => {
  // A page with issues, so that every view has something on it.
  await drupal.login(USERS.editor);
  await openPage(page, PAGES.checks.id);
  const frame = await openSeo(page);
  const tabs = [UI.tab.search, UI.tab.social, UI.tab.schema];
  const title = textbox(frame, UI.field.title);
  const checks = button(frame, UI.tab.checks);
  await expect(title).toBeEnabled();

  /** Each tab in turn, then the Checks sheet over the last one. */
  async function eachView(run: (name: string) => Promise<void>) {
    for (const name of tabs) {
      await tab(frame, name).click();
      await expect(frame.getByRole('tabpanel', { name })).toBeVisible();
      await run(`${name} tab`);
    }
    await checks.click();
    await expect(sheet(frame, 'Checks')).toBeVisible();
    await run('Checks sheet');
    await button(frame, UI.action.back).click();
    await expect(sheet(frame, 'Checks')).toHaveCount(0);
  }

  await test.step('keyboard only', async () => {
    // The tab list is one stop; arrows choose a tab, Home returns to the first.
    await tab(frame, UI.tab.search).focus();
    for (const [index, name] of tabs.entries()) {
      if (index > 0) {
        await page.keyboard.press('ArrowRight');
      }
      await expect(tab(frame, name)).toBeFocused();
      await expect(tab(frame, name)).toHaveAttribute('aria-selected', 'true');
      await expect(frame.getByRole('tabpanel', { name })).toBeVisible();
    }
    await page.keyboard.press('Home');
    await expect(tab(frame, UI.tab.search)).toBeFocused();

    // The next stop is the Checks count; Enter opens the sheet and Escape
    // closes it, back on the button.
    await page.keyboard.press('Tab');
    await expect(checks).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(sheet(frame, 'Checks')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(frame, 'Checks')).toHaveCount(0);
    await expect(checks).toBeFocused();

    // On the sheet, "About checks" shows its sentence when tabbed to;
    // Escape hides the sentence and leaves the sheet open.
    await page.keyboard.press('Enter');
    const about = button(frame, 'About checks');
    const focused = () => about.evaluate((element) => element === document.activeElement);
    for (let presses = 0; presses < 6 && !(await focused()); presses++) {
      await page.keyboard.press('Shift+Tab');
    }
    await expect(about).toBeFocused();
    const note = (await about.getAttribute('aria-description')) ?? '';
    const tip = frame.locator('.rt-TooltipContent', { hasText: note });
    await expect(tip).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tip).toHaveCount(0);
    await expect(sheet(frame, 'Checks')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(frame, 'Checks')).toHaveCount(0);
    await expect(checks).toBeFocused();

    // Tab moves on into the panel; the title field is reached and typed in.
    for (let presses = 0; presses < 12; presses++) {
      if (await title.evaluate((element) => element === document.activeElement)) {
        break;
      }
      await page.keyboard.press('Tab');
    }
    await expect(title).toBeFocused();
    const before = await title.inputValue();
    await page.keyboard.type('K');
    await expect(title).not.toHaveValue(before);
  });

  await test.step('no serious accessibility violation on any view', async () => {
    await eachView(async (view) => {
      const { violations } = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
      const serious = violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
      expect(
        serious.map(({ id, help, nodes }) => `${id}: ${help} (${nodes.map(({ target }) => target.join(' ')).join(', ')})`),
        view,
      ).toEqual([]);
    });
  });

  await test.step('every Show on the Checks sheet is named for its field and described by its issue', async () => {
    await checks.click();
    const shows = await sheet(frame, 'Checks')
      .getByRole('button', { name: /^Show\b/ })
      .evaluateAll((buttons) =>
        buttons.map((one) => ({
          name: one.getAttribute('aria-label') ?? '',
          issue: one.ownerDocument.getElementById(one.getAttribute('aria-describedby') ?? '')?.textContent ?? '',
        })),
      );
    expect(shows.length).toBeGreaterThan(1);
    for (const { name, issue } of shows) {
      expect(name).toMatch(UI.checks.show);
      expect(issue).not.toBe('');
    }
    // Two Shows that lead to one field differ in their issue.
    const told = shows.map(({ name, issue }) => `${name} / ${issue}`);
    expect(new Set(told).size).toBe(told.length);
    await button(frame, UI.action.back).click();
    await expect(sheet(frame, 'Checks')).toHaveCount(0);
  });

  await test.step('at 200% zoom nothing scrolls sideways', async () => {
    // The frame keeps its size when the browser zooms, so zooming to 200%
    // gives the dialog half the width to lay its content out in.
    await page.locator(SEO_IFRAME).evaluate((element) => {
      (element as HTMLElement).style.width = '50%';
    });
    await eachView(async (view) => {
      const overflowing = await frame.locator('html').evaluate((html) =>
        [html, ...html.querySelectorAll('*')]
          .filter(
            (element) =>
              element.scrollWidth > element.clientWidth + 1 &&
              (element === html || ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)),
          )
          .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
      );
      expect(overflowing, view).toEqual([]);
    });
    // The short Checks form counts what the long one says ("● 1", "1 to fix").
    const checksButton = button(frame, UI.tab.checks);
    const long = (await checksButton.locator('.seo-checks-long').textContent()) ?? '';
    await expect(checksButton.locator('.seo-checks-short')).toBeVisible();
    await expect(checksButton.locator('.seo-checks-short')).toHaveText(long.split(' ')[0]);
    // A caption cut short ends in an ellipsis, never mid-letter.
    await tab(frame, UI.tab.search).click();
    const cut = await frame.locator('.seo-stage-cap-l').first().evaluate((caption) =>
      [...caption.children]
        .filter((part) => part.scrollWidth > part.clientWidth)
        .map((part) => getComputedStyle(part).textOverflow),
    );
    expect(cut.every((overflow) => overflow === 'ellipsis')).toBe(true);
  });
});

// Opened in a window of that height, or opened at 900 px and the window
// made short: the dialog then moves up to where Canvas opens it.
for (const [height, opened] of [
  [350, 350],
  [420, 420],
  [350, 900],
]) {
  test(`in a window 1440 x ${height} (opened at ${opened}) the frame fits and the title is reached by keyboard`, async ({
    drupal,
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: opened });
    await drupal.login(USERS.editor);
    await openPage(page, pricing.id);
    const frame = await openSeo(page);
    const title = textbox(frame, UI.field.title);
    await expect(title).toBeEnabled();
    await page.setViewportSize({ width: 1440, height });
    const iframe = page.locator(SEO_IFRAME);
    await expect.poll(async () => (await iframe.boundingBox())!.y).toBeLessThanOrEqual(height * 0.2 + 60);
    const box = await iframe.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    // Canvas alone would leave the frame 300 px less than the window; the
    // view below the dialog's header keeps room for a field and its label.
    expect(box!.height).toBeGreaterThan(height - 300);
    expect((await frame.locator('.seo-frame > .seo-body').boundingBox())!.height).toBeGreaterThanOrEqual(150);

    await tab(frame, UI.tab.search).focus();
    for (let presses = 0; presses < 12; presses++) {
      if (await title.evaluate((element) => element === document.activeElement)) {
        break;
      }
      await page.keyboard.press('Tab');
    }
    await expect(title).toBeFocused();
    // The field and its label are both whole in view, not under the header.
    await expect(title).toBeInViewport({ ratio: 1 });
    await expect(frame.locator('label', { hasText: /^Title$/ }).first()).toBeInViewport({ ratio: 1 });
    // Without scrolling the editor's own page.
    expect(await page.evaluate(() => [scrollY, document.scrollingElement?.scrollTop ?? 0])).toEqual([0, 0]);
    await page.screenshot({ path: test.info().outputPath(`dialog-1440x${height}-from-${opened}.png`) });
  });
}
