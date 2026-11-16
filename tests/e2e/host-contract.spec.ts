import type { FrameLocator } from '@playwright/test';

import { PAGES, TEST_ID, UI, USERS } from './constants';
import {
  SEO_IFRAME,
  button,
  closeSeo,
  expect,
  isLayoutSave,
  openPage,
  openSeo,
  switchPage,
  tab,
  test,
  textbox,
} from './fixture';

/**
 * What the dialog needs from the Canvas editor, checked against the real
 * editor: the paths and action names `extension/src/host.ts` uses, and the
 * behavior of the frame the dialog runs in. None of it is a public Canvas API, so this spec
 * runs before all others and is the one that fails when Canvas changes.
 */

test.describe.configure({ mode: 'serial' });

const id = PAGES.pricing.id;
const canvasTitle = '[data-drupal-selector="edit-title-0-value"]';
const canvasDescription = 'textarea[name="description[0][value]"]';

/** Leaves a mark in the dialog's window, to tell whether it was reloaded. */
const mark = (frame: FrameLocator) =>
  frame.locator('body').evaluate(() => {
    (window as Window & { e2eMark?: string }).e2eMark = 'kept';
  });
const marked = (frame: FrameLocator) =>
  frame.locator('body').evaluate(() => (window as Window & { e2eMark?: string }).e2eMark ?? null);

test.beforeEach(async ({ drupal, page }) => {
  await drupal.login(USERS.admin);
  await openPage(page, id);
});

test('the editor exposes every path the host adapter reads', async ({ page }) => {
  // The draft entry arrives with the editor's first layout response.
  await expect(async () => {
    const shape = await page.evaluate((pageId) => {
      const settings = window.drupalSettings;
      const store = settings.canvas.store;
      const state = store.getState();
      const inFlight = settings.canvas.canvasLayoutRequestInProgress;
      const preview = document.querySelector<HTMLIFrameElement>(
        'iframe[data-canvas-preview="true"][data-canvas-swap-active="true"]',
      );
      return {
        store: [typeof store.getState, typeof store.dispatch, typeof store.subscribe],
        uid: String(settings.user.uid),
        baseUrl: typeof settings.path.baseUrl,
        pathname: state.ui.currentRoute.pathname,
        owner: state.pageDataOwner,
        title: state.pageData.present['title[0][value]'],
        description: state.pageData.present['description[0][value]'],
        alias: state.pageData.present['path[0][alias]'],
        clientId: typeof state.publishReview.clientInstanceId,
        draft:
          state.publishReview.autoSavesHash[`canvas/api/v0/layout/canvas_page/${pageId}`]?.[
            `canvas_page:${pageId}:en`
          ] ?? null,
        queryError: typeof state.queryError,
        conflict: state.queryError?.latestError?.status === '409',
        inFlight: inFlight === undefined || Array.isArray(inFlight),
        preview: Boolean(preview?.contentDocument?.body),
      };
    }, id);
    expect(shape).toEqual({
      store: ['function', 'function', 'function'],
      uid: expect.stringMatching(/^\d+$/),
      baseUrl: 'string',
      pathname: `/editor/canvas_page/${id}`,
      owner: { entityType: 'canvas_page', entityId: String(id) },
      title: PAGES.pricing.title,
      description: PAGES.pricing.description,
      alias: '/pricing',
      clientId: 'string',
      draft: { autoSaveStartingPoint: expect.anything(), hash: null },
      queryError: 'object',
      conflict: false,
      inFlight: true,
      preview: true,
    });
  }).toPass({ timeout: 60_000 });
});

test('the store actions write the description, refresh the changes and signal idle', async ({ page }) => {
  const saved = page.waitForResponse(isLayoutSave(id));
  const idle = page.evaluate(
    () =>
      new Promise<boolean>((done) => {
        document.addEventListener('canvasLayoutRequestComplete', () => done(true), { once: true });
      }),
  );
  await page.evaluate((value) => {
    const store = window.drupalSettings.canvas.store;
    const fieldName = 'description[0][value]';
    store.dispatch({ type: 'formState/setFieldValue', payload: { formId: 'page_data_form', fieldName, value } });
    store.dispatch({ type: 'layoutModel/setUpdatePreview', payload: true });
    store.dispatch({ type: 'pageData/updatePageDataExternally', payload: { [fieldName]: value } });
  }, 'Written through the store.');

  expect((await saved).status()).toBe(200);
  expect(await idle).toBe(true);
  await expect(page.locator(canvasDescription)).toHaveValue('Written through the store.');
  expect(await page.evaluate(() => Array.isArray(window.drupalSettings.canvas.canvasLayoutRequestInProgress))).toBe(
    true,
  );

  // Without this action the button only catches up with the editor's own
  // ten-second poll.
  const refetch = page.waitForRequest(
    (request) => new URL(request.url()).pathname.endsWith('/canvas/api/v0/auto-saves/pending'),
    { timeout: 3_000 },
  );
  await page.evaluate(() => {
    window.drupalSettings.canvas.store.dispatch({
      type: 'pendingChangesApi/invalidateTags',
      payload: [{ type: 'PendingChanges', id: 'LIST' }],
    });
  });
  await refetch;
  await expect(page.getByTestId('canvas-publish-review')).toHaveText('Review 1 change');
});

test('the dialog frame is named, sized, and follows the editor until a side-menu click', async ({ page }) => {
  const frame = await openSeo(page);
  const iframe = page.locator(SEO_IFRAME);
  await expect(iframe).toHaveAttribute('title', 'SEO');
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin');
  expect((await iframe.boundingBox())?.width).toBeCloseTo(468, 0);
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(PAGES.pricing.title);

  // The frame sits in the dialog's scroll container; Canvas sizes both to
  // the window less 300 px, and host.fitFrame() grows both to the space
  // below the dialog's heading.
  const sizes = () =>
    iframe.evaluate((element) => {
      const panel = element.closest('[role="dialog"]');
      let box = element.parentElement;
      while (box && box !== panel && !/auto|scroll/.test(getComputedStyle(box).overflowY)) {
        box = box.parentElement;
      }
      const rect = element.getBoundingClientRect();
      const dialog = panel?.getBoundingClientRect();
      return {
        contained: !!panel && !!box && box !== panel,
        height: rect.height,
        bottom: rect.bottom,
        box: box ? parseFloat(getComputedStyle(box).maxHeight) : NaN,
        panelTop: dialog?.top ?? NaN,
        panelBottom: dialog?.bottom ?? NaN,
      };
    });
  let size = await sizes();
  expect(size.contained).toBe(true);
  expect(size.height).toBeGreaterThanOrEqual(1000 - 300);
  expect(size.box).toBeCloseTo(size.height, 0);
  // Opened at 1000 px tall, then the window gets short: the dialog moves up
  // to where Canvas opens it in a 420 px window, a fifth from the top.
  await page.setViewportSize({ width: 1440, height: 420 });
  await expect.poll(async () => (await sizes()).bottom).toBeLessThanOrEqual(420);
  size = await sizes();
  expect(size.panelTop).toBeLessThanOrEqual(420 * 0.2 + 1);
  expect(size.height).toBeGreaterThan(420 - 300);
  expect(size.box).toBeCloseTo(size.height, 0);
  // A tall window: the frame ends inside the window and inside the dialog,
  // and is never shorter than Canvas makes it.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect.poll(async () => (await sizes()).height).toBeGreaterThanOrEqual(1000 - 300);
  size = await sizes();
  expect(size.bottom).toBeLessThanOrEqual(1000);
  expect(size.bottom).toBeLessThanOrEqual(size.panelBottom);

  // The bridge tells the frame when the preview was rendered again.
  const message = frame.locator('body').evaluate(
    () =>
      new Promise<string>((done) => {
        window.addEventListener('message', (event) => {
          if (event.source === window.parent && event.data?.type === 'canvas:data:subscribe:previewHtml') {
            done(typeof event.data.payload);
          }
        });
        window.parent.postMessage({ type: 'canvas:data:subscribe:previewHtml' }, window.location.origin);
      }),
  );
  await page.locator(canvasTitle).fill('Pricing and plans');
  expect(await message).toBe('string');

  // Another page: the same document, now about that page.
  await mark(frame);
  await switchPage(page, PAGES.about.id);
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(PAGES.about.title);
  expect(await marked(frame)).toBe('kept');

  await closeSeo(page);
});

test('inside the frame: Enter, links, the clipboard and a typed date', async ({ page }) => {
  const frame = await openSeo(page);
  const url = page.url();

  // Enter submits nothing and reloads nothing.
  await mark(frame);
  await textbox(frame, UI.field.title).press('Enter');
  await expect(textbox(frame, UI.field.title)).toBeVisible();
  expect(await marked(frame)).toBe('kept');
  expect(page.url()).toBe(url);

  // The frame cannot open a tab itself; an anchor in the editor document can.
  expect(await frame.locator('body').evaluate(() => window.open('about:blank', '_blank') === null)).toBe(true);
  const popup = page.waitForEvent('popup');
  await frame.locator('body').evaluate(() => {
    const parent = window.parent;
    const anchor = parent.document.createElement('a');
    anchor.href = new URL('robots.txt', parent.location.href).href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    parent.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  });
  await (await popup).close();

  // Copy works without a clipboard permission prompt.
  await button(frame, UI.action.output).click();
  await button(frame, UI.action.copy).first().click();
  await expect(frame.getByText(UI.action.copied).first()).toBeVisible();
  await button(frame, UI.action.back).click();

  // A fixed date is typed into the browser's own date input.
  await tab(frame, UI.tab.schema).click();
  await frame.getByRole('combobox', { name: 'Type', exact: true }).click();
  await frame.getByRole('option', { name: /^Event/ }).click();
  // A page's Starts has no default to follow: its date input shows at once.
  const date = frame.locator('.seo-field[data-path="schema.props.startDate"] input[type="date"]');
  await date.focus();
  // Day and month are the same number: the field's order of day and month
  // follows the operating system's region, which the browser locale does not
  // override.
  await page.keyboard.type('04042027');
  await expect(date).toHaveValue('2027-04-04');
});
