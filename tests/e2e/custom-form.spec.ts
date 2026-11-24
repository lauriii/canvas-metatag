import AxeBuilder from '@axe-core/playwright';
import type { FrameLocator, Locator, Page } from '@playwright/test';

import { PAGES, SITE_NAME, UI, USERS } from './constants';
import { SEO_IFRAME, button, expect, openPage, openSeo, pageQuery, seoState, sheet, tab, test, writeDraft } from './fixture';

/**
 * "Add your own JSON-LD" as a form: an employer rating of another company
 * built from an empty sheet with the keyboard only, Form and JSON over one
 * text, the sheet's levels, and its accessibility at three frame sizes. The
 * tests share the sandbox and run in order.
 */

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ drupal }) => {
  await drupal.login(USERS.editor);
});

const ID = PAGES.about.id;

/** The hand-added text the draft holds. */
const custom = async (page: Page) => ((await seoState(page, pageQuery(ID))).target?.values.schema as { custom?: string } | undefined)?.custom ?? '';

/** Presses Tab (or another key) until the element has focus. */
async function keyTo(page: Page, target: Locator, key = 'Tab', most = 40): Promise<void> {
  for (let n = 0; n < most; n++) {
    if (await target.evaluate((element) => element === element.ownerDocument.activeElement).catch(() => false)) return;
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
}

/** Serious and critical accessibility violations in the dialog. */
async function violations(page: Page): Promise<string[]> {
  const { violations: found } = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
  return found
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, nodes }) => `${id}: ${nodes.map(({ html }) => html.slice(0, 160)).join(', ')}`);
}

/** Focus is in the open sheet: never on the page. */
const focusInSheet = (frame: FrameLocator) =>
  frame.locator('body').evaluate((body) => {
    const active = body.ownerDocument.activeElement;
    return !!active && active !== body && !!active.closest('.seo-sheet');
  });

/**
 * Opens the sheet from Output, as an editor finds it. With `slowFrames`, the
 * dialog's animation frames come 300 ms late while the sheet opens, as on a
 * busy machine (undone with `fastFrames`).
 */
async function openSheet(page: Page, slowFrames = false): Promise<FrameLocator> {
  await openPage(page, ID);
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  await button(frame, UI.schema.code).click();
  if (slowFrames) {
    await frame.locator('body').evaluate((body) => {
      const view = body.ownerDocument.defaultView as Window & { fastFrames?: typeof requestAnimationFrame };
      view.fastFrames = view.requestAnimationFrame.bind(view);
      view.requestAnimationFrame = (callback) => view.setTimeout(() => callback(view.performance.now()), 300);
    });
  }
  await sheet(frame, 'Output').getByRole('button', { name: UI.schema.ownJsonLd, exact: true }).click();
  return frame;
}

/** Undoes openSheet's slow frames. */
const fastFrames = (frame: FrameLocator) =>
  frame.locator('body').evaluate((body) => {
    const view = body.ownerDocument.defaultView as Window & { fastFrames?: typeof requestAnimationFrame };
    if (view.fastFrames) view.requestAnimationFrame = view.fastFrames;
  });

test('an employer rating of another company, built with the keyboard only', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);

  // An empty sheet opens on "What is it?", with focus in it.
  const search = own.getByRole('combobox', { name: 'What is it?' });
  await expect(search).toBeFocused();
  await page.keyboard.type('rating');
  await expect(own.getByRole('option').first()).toHaveAccessibleName(/^Employer rating/);
  await page.keyboard.press('Enter');
  // The first thing to fill takes focus: Item reviewed.
  await expect(own.getByRole('heading', { name: 'Employer rating', level: 3 })).toBeVisible();
  await expect(own.getByText('Needed for Employer rating')).toBeVisible();

  // Item reviewed: described here, as another company.
  const reviewed = own.getByRole('button', { name: /^Item reviewed:/ });
  await expect(reviewed).toBeFocused();
  await page.keyboard.press('Enter');
  await keyTo(page, frame.getByRole('menuitem', { name: 'Describe it here' }), 'ArrowDown');
  await page.keyboard.press('Enter');
  const name = own.getByRole('group', { name: 'Details of item reviewed' }).getByRole('textbox', { name: 'Name', exact: true });
  // Described in place: focus goes to its first need, not back to the menu's button.
  await expect(name).toBeFocused();
  await page.keyboard.type('Acme Logistics');
  await keyTo(page, own.getByRole('textbox', { name: 'Rating value', exact: true }));
  // Typed one character at a time, a decimal stays a number.
  await page.keyboard.type('4.2');
  await keyTo(page, own.getByRole('textbox', { name: 'Ratings', exact: true }));
  await page.keyboard.type('318');
  await page.keyboard.press('Tab');
  const verdicts = own.getByRole('group', { name: 'In search results' });
  await expect(verdicts).toContainText('Can show');
  // The condition the feature is shown on, under it.
  await expect(verdicts).toContainText('Only if visitors can post ratings on this site');

  await expect.poll(async () => JSON.parse((await custom(page)) || '{}')).toMatchObject({
    '@type': 'EmployerAggregateRating',
    itemReviewed: { '@type': 'Organization', name: 'Acme Logistics' },
    ratingValue: 4.2,
    ratingCount: 318,
  });

  // JSON shows the stored text byte for byte; back to Form changes nothing.
  const stored = await custom(page);
  await tab(frame, 'JSON').click();
  await expect(own.getByRole('textbox', { name: 'JSON-LD' })).toHaveValue(stored);
  await tab(frame, 'Form').click();
  await expect(tab(frame, 'Form')).toBeFocused();
  expect(await custom(page)).toBe(stored);

  // Accessibility at the dialog's sizes.
  for (const size of [{ width: 1600, height: 600 }, { width: 1600, height: 350 }]) {
    await page.setViewportSize(size);
    expect(await violations(page), `${size.width} × ${size.height}`).toEqual([]);
  }
  // In a short frame the JSON box keeps 160 px.
  await tab(frame, 'JSON').click();
  expect((await own.getByRole('textbox', { name: 'JSON-LD' }).boundingBox())?.height).toBeGreaterThanOrEqual(159);
  await tab(frame, 'Form').click();
  await page.setViewportSize({ width: 1600, height: 1000 });

  // 200 % zoom: the frame keeps its size, so the dialog lays out in half
  // its width. The tabs move under the title; nothing scrolls sideways.
  await page.locator(SEO_IFRAME).evaluate((element) => {
    (element as HTMLElement).style.width = '50%';
  });
  const title = own.getByRole('heading', { name: UI.schema.ownJsonLd, level: 2 });
  await expect.poll(async () => ((await tab(frame, 'Form').boundingBox())?.y ?? 0) - ((await title.boundingBox())?.y ?? 0)).toBeGreaterThan(10);
  for (const view of ['Form', 'JSON']) {
    await tab(frame, view).click();
    const sideways = await frame.locator('html').evaluate((html) =>
      [html, ...html.querySelectorAll('*')]
        .filter((element) => element.scrollWidth > element.clientWidth + 1 && (element === html || ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)) && !element.classList.contains('seo-jsonbox-text'))
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
    );
    expect(sideways, view).toEqual([]);
    expect(await violations(page), `200 % · ${view}`).toEqual([]);
  }
  await tab(frame, 'Form').click();
  await page.locator(SEO_IFRAME).evaluate((element) => {
    (element as HTMLElement).style.width = '';
  });
});

test('levels: one item opens on it, Back goes to the list, then closes', async ({ page }) => {
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  // One item: it opens on it, with a way to add another.
  await expect(own.getByRole('heading', { name: 'Employer rating', level: 3 })).toBeVisible();
  const addItem = own.getByRole('button', { name: 'Add an item', exact: true });
  await addItem.click();
  await expect(own.getByRole('combobox', { name: 'What is it?' })).toBeFocused();
  // Escape goes back up: on Add an item.
  await page.keyboard.press('Escape');
  await expect(addItem).toBeFocused();
  await addItem.click();
  await expect(own.getByRole('combobox', { name: 'What is it?' })).toBeFocused();
  await page.keyboard.type('Book');
  await expect(own.getByRole('option').first()).toHaveAccessibleName(/^Book/);
  await page.keyboard.press('Enter');
  await expect(own.getByRole('heading', { name: 'Book', level: 3 })).toBeFocused();
  // Escape: the list, with focus on that item's row; again: closed.
  await page.keyboard.press('Escape');
  const rows = own.locator('.seo-clist-sentence');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toBeFocused();
  // Opened from Output: back to Output, on the button that opened it.
  await page.keyboard.press('Escape');
  await expect(own).toHaveCount(0);
  const back = sheet(frame, 'Output').getByRole('button', { name: UI.schema.ownJsonLd, exact: true });
  await expect(back).toBeFocused();

  // Removing an item says so, and Undo brings back the same text.
  await expect.poll(() => custom(page)).toContain('"#book"');
  const before = await custom(page);
  await back.click();
  // Each item's menu is named for it.
  await own.getByRole('button', { name: /^More for A book/ }).click();
  await frame.getByRole('menuitem', { name: 'Remove item' }).click();
  await expect(frame.getByText('Removed the item “Book”.').first()).toBeVisible();
  // The button went with its item: focus stays in the sheet.
  await expect.poll(() => focusInSheet(frame)).toBe(true);
  await button(frame, 'Undo').click();
  await expect.poll(() => custom(page)).toBe(before);
});

test('a paste in Form is cleaned up, opens its item, and Undo clean-up restores it', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  const frame = await openSheet(page, true);
  const own = sheet(frame, UI.schema.ownJsonLd);
  // The sheet opens with focus in "What is it?"; Paste JSON-LD is next. A Tab
  // pressed before the sheet's next frames keeps its place: the sheet never
  // takes focus back (it once did on a busy machine).
  await expect(own.getByRole('combobox', { name: 'What is it?' })).toBeFocused();
  await page.keyboard.press('Tab');
  const paste = own.getByRole('button', { name: 'Paste JSON-LD', exact: true });
  await expect(paste).toBeFocused();
  // Longer than the slowed frames: focus is still where the Tab put it.
  await page.waitForTimeout(1000);
  await expect(paste).toBeFocused();
  await fastFrames(frame);
  await page.keyboard.press('Enter');
  const box = own.getByRole('textbox', { name: 'Paste JSON-LD' });
  await box.fill('<script type="application/ld+json">{"@context": "https://schema.org", "@type": "Organization", "name": "Acme Logistics"}</script>');
  await own.getByRole('button', { name: 'Add', exact: true }).click();
  // One line says what was added; what changed is a disclosure away. The item opens, in Form.
  await expect(own.getByText('Cleaned up the paste and added 1 item.', { exact: true })).toBeVisible();
  await own.getByText('What changed').click();
  await expect(own.getByText(/^Cleaned up the paste: took it out of its script tag, removed the context line/)).toBeVisible();
  await expect(own.getByRole('heading', { name: 'Organization', level: 3 })).toBeVisible();
  await expect.poll(() => custom(page)).toContain('"name": "Acme Logistics"');
  await own.getByRole('button', { name: 'Undo clean-up', exact: true }).click();
  await expect(own.getByText(/^Cleaned up the paste/)).toHaveCount(0);
  // The exact paste is back: it can't be saved as it is, so it is shown in
  // JSON with its problem, and nothing of it is stored.
  await expect(own.getByRole('textbox', { name: 'JSON-LD' })).toHaveValue(/^<script type="application\/ld\+json">/);
  await expect(own.getByRole('button', { name: 'Clean up', exact: true })).toBeVisible();
  await expect.poll(() => custom(page)).toBe('');
});

test('Form and JSON keep the place: the value focused, the item under the caret', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {
    schema: {
      custom: JSON.stringify(
        [
          { '@type': 'EmployerAggregateRating', '@id': '#employer-rating', itemReviewed: { '@id': '#acme' }, ratingValue: 4.2, ratingCount: 318 },
          { '@type': 'Organization', '@id': '#acme', name: 'Acme Logistics', url: 'https://acme-logistics.example' },
        ],
        null,
        2,
      ),
    },
  });
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await own.getByRole('button', { name: 'Acme Logistics, an organization.', exact: true }).click();
  await own.getByRole('textbox', { name: 'URL', exact: true }).focus();
  await tab(frame, 'JSON').click();
  // The caret is on the value being edited, and the line says so.
  const box = own.getByRole('textbox', { name: 'JSON-LD' });
  const at = await box.evaluate((area: HTMLTextAreaElement) => area.value.slice(area.selectionStart, area.selectionStart + 6));
  expect(at).toBe('"url":');
  await expect(own.getByText(/· url · URL/)).toBeVisible();
  // Back in Form: the same item.
  await tab(frame, 'Form').click();
  await expect(own.getByRole('heading', { name: 'Organization', level: 3 })).toBeVisible();
  await tab(frame, 'JSON').click();
  await tab(frame, 'Form').click();
  await expect(own.getByRole('heading', { name: 'Organization', level: 3 })).toBeVisible();

  // In JSON, Back leaves the sheet.
  await tab(frame, 'JSON').click();
  await expect(own.getByRole('button', { name: 'Back to Output', exact: true })).toBeVisible();
});

test('a review of the site itself: the verdict and the menu say it, and a value removed comes back', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {
    schema: { custom: JSON.stringify({ '@type': 'Review', '@id': '#review', author: { '@type': 'Person', name: 'Mia Virtanen' }, reviewRating: { '@type': 'Rating', ratingValue: 5 } }, null, 2) },
  });
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await own.getByRole('button', { name: /^Item reviewed:/ }).click();
  const site = frame.getByRole('menuitemradio', { name: /\(this site\)/ });
  await expect(site).toContainText("Ratings of your own organization can't show.");
  await site.click();
  await expect(own.getByRole('group', { name: 'In search results' })).toContainText("Doesn't fit: a review of your own organization");
  // The site's organization takes details only from those who edit the
  // site's settings: an editor of pages is not offered it.
  await expect(own.getByRole('button', { name: /^Add details to / })).toHaveCount(0);

  // Removing a value offers Undo, which stays, and focus stays in the item.
  await expect.poll(() => custom(page)).toContain('"#identity"');
  const stored = await custom(page);
  await own.getByRole('button', { name: 'More for Author', exact: true }).click();
  await frame.getByRole('menuitem', { name: 'Remove', exact: true }).click();
  await expect(button(frame, 'Undo')).toBeVisible();
  await expect.poll(() => frame.locator(':focus').count()).toBe(1);
  await expect.poll(() => custom(page)).not.toContain('Mia Virtanen');
  await page.waitForTimeout(7000);
  await expect(button(frame, 'Undo')).toBeVisible();
  await button(frame, 'Undo').click();
  await expect.poll(() => custom(page)).toBe(stored);
});

test('a site editor adds details to the site from a reference to it', async ({ page, drupal }) => {
  await drupal.logout();
  await drupal.login(USERS.admin);
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {
    schema: { custom: JSON.stringify({ '@type': 'Review', '@id': '#review', itemReviewed: { '@id': '#identity' } }, null, 2) },
  });
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await own.getByRole('button', { name: /^Add details to / }).click();
  // The site's own sheet, saved with Site settings.
  const details = frame.getByRole('region', { name: /^Add details to / });
  await expect(details).toContainText('Site settings: live on every page once saved.');
  await expect.poll(() => focusInSheet(frame)).toBe(true);
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
});

test('the main thing on a web page: marked, and cleared with its item', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {
    schema: { custom: JSON.stringify([{ '@type': 'Event', '@id': '#concert', name: 'Concert' }, { '@type': 'Thing', '@id': '#other', name: 'Other' }], null, 2) },
  });
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await own.getByRole('button', { name: /^Concert/ }).click();
  await own.getByRole('switch', { name: 'This is what the page is mainly about' }).click();
  await expect.poll(async () => ((await seoState(page, pageQuery(ID))).target?.values.schema as { main?: string } | undefined)?.main).toBe('#concert');
  // Removing the item takes the mark with it: the next write is not refused.
  await button(frame, 'Back to all items').click();
  await own.getByRole('button', { name: /^More for Concert/ }).click();
  await frame.getByRole('menuitem', { name: 'Remove item' }).click();
  await expect.poll(async () => ((await seoState(page, pageQuery(ID))).target?.values.schema as { main?: string; custom?: string } | undefined)?.custom ?? '').not.toContain('#concert');
  expect(((await seoState(page, pageQuery(ID))).target?.values.schema as { main?: string } | undefined)?.main).toBeUndefined();
  await expect(frame.getByText(/needs attention/)).toHaveCount(0);
});

test('details added to a product: what is added, what the page keeps, and no main switch', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {
    schema: {
      type: 'Product',
      props: { offers_price: { text: '89' }, offers_priceCurrency: { text: 'EUR' } },
      extend: { '#primary': JSON.stringify({ sku: 'OAK-DL-01', offers: { price: 79, itemCondition: 'https://schema.org/NewCondition' } }, null, 2) },
    },
  });
  await openPage(page, ID);
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  await button(frame, UI.schema.code).click();
  await sheet(frame, 'Output').getByRole('button', { name: /^Add details to (?!this page)/ }).first().click();
  const details = frame.getByRole('region', { name: /^Add details to / });
  await expect(details.getByText('Product · #primary')).toBeVisible();
  // Form says what is added by the rows' labels, and the clash under its row.
  await expect(details.getByText(/^Adds .+ and Item condition\.$/)).toBeVisible();
  // The page's price, read-only, with the added one said unused.
  await expect(details.getByText('From the Price field').first()).toBeVisible();
  await expect(details.getByText(/Your “79” isn't used\./)).toBeVisible();
  // A product page has no main-thing switch, and the typed-once advice is
  // never on the page's own values.
  await expect(details.getByRole('switch')).toHaveCount(0);
  await expect(details.getByText(/Link it to a field instead/)).toHaveCount(0);
  // JSON says it by path, and marks the clash's line.
  await tab(frame, 'JSON').click();
  await expect(details.getByText('Adds sku and offers.itemCondition.')).toBeVisible();
  await expect(details.getByText(/· offers › price: comes from the Price field, so it isn't changed here\./)).toBeVisible();
  await tab(frame, 'Form').click();
  // The output merges: the added sku beside the page's own price.
  const graph = async () => (((await seoState(page, pageQuery(ID))).resolved?.head.script ?? []) as { textContent: { '@graph': Record<string, unknown>[] } }[])[0]?.textContent['@graph'] ?? [];
  await expect.poll(async () => (await graph()).find((node) => String(node['@id']).endsWith('#primary'))).toMatchObject({ sku: 'OAK-DL-01', offers: { price: '89', itemCondition: 'https://schema.org/NewCondition' } });
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
});

test('"Something else on this page" opens the type search in Form, and Back returns to the kinds', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  await openPage(page, ID);
  const frame = await openSeo(page);
  // Last used: JSON. The type search still opens in Form.
  await frame.locator('html').evaluate(() => window.localStorage.setItem('canvas_metatag:jsonld-tab', 'json'));
  await tab(frame, UI.tab.schema).click();
  await button(frame, UI.schema.kind).click();
  await sheet(frame, UI.schema.kind).getByRole('button', { name: /^Something else on this page/ }).click();
  const own = sheet(frame, UI.schema.ownJsonLd);
  await expect(own.getByRole('combobox', { name: 'What is it?' })).toBeFocused();
  await expect(tab(frame, 'Form')).toHaveAttribute('aria-selected', 'true');
  await button(frame, 'Back to What this page is').click();
  await expect(sheet(frame, UI.schema.kind)).toBeVisible();
  // The kind is as it was.
  expect(((await seoState(page, pageQuery(ID))).target?.values.schema as { type?: string } | undefined)?.type).toBeUndefined();
});

test('"Make this page a Q&A page": the page grows its type, and the question is its main thing', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await own.getByRole('combobox', { name: 'What is it?' }).fill('Q&A page');
  await page.keyboard.press('Enter');
  await own.getByRole('button', { name: 'Make this page a Q&A page', exact: true }).click();
  await expect(own.getByRole('heading', { name: 'Question', level: 3 })).toBeVisible();
  // The question shows what Q&A needs of it.
  await expect(own.getByText(/^Needed for Q&A/)).toBeVisible();
  await expect.poll(async () => (await seoState(page, pageQuery(ID))).target?.values.schema).toMatchObject({ main: expect.stringMatching(/^#/), extend: { '#webpage': expect.stringContaining('QAPage') } });
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
});

test('Edit in form focuses the row, and switching tabs says where it lands', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {
    schema: { custom: JSON.stringify({ '@type': 'EmployerAggregateRating', '@id': '#employer-rating', itemReviewed: { '@type': 'Organization', name: 'Acme Logistics' }, ratingValue: 4.2, ratingCount: 318 }, null, 2) },
  });
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await tab(frame, 'JSON').click();
  const box = own.getByRole('textbox', { name: 'JSON-LD' });
  // The caret on the rating value: the line under the box says what it is.
  await box.evaluate((area: HTMLTextAreaElement) => {
    const at = area.value.indexOf('4.2') + 1;
    area.focus();
    area.setSelectionRange(at, at);
  });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(own.getByText(/· ratingValue · Rating value: a number/)).toBeVisible();
  await own.getByRole('button', { name: /^Edit in form: Rating value, line \d+$/ }).click();
  await expect(own.getByRole('textbox', { name: 'Rating value', exact: true })).toBeFocused();
  // Back to JSON and to Form by the tabs: the announcement names the row.
  await tab(frame, 'JSON').click();
  await box.evaluate((area: HTMLTextAreaElement) => {
    const at = area.value.indexOf('4.2') + 1;
    area.focus();
    area.setSelectionRange(at, at);
  });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await tab(frame, 'Form').click();
  await expect(own.locator('[role="status"][aria-live="polite"]').last()).toHaveText('Form, Rating value');
});

test('a paste that copies the page: 1 of 4 is added, and cancelling returns to Paste JSON-LD', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  const home = `${((await seoState(page, pageQuery(ID))) as unknown as { origin: { url: string } }).origin.url}/`;
  const graph = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': '#site', url: home },
      { '@type': 'WebPage', '@id': 'https://other.example.org/about#page' },
      { '@type': 'Organization', '@id': '#org', name: SITE_NAME, url: home },
      { '@type': 'EmployerAggregateRating', '@id': '#rating', itemReviewed: { '@id': '#org' }, ratingValue: 4.2, ratingCount: 318 },
    ],
  });
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await own.getByRole('button', { name: 'Paste JSON-LD', exact: true }).click();
  await own.getByRole('textbox', { name: 'Paste JSON-LD' }).fill(graph);
  await own.getByRole('button', { name: 'Add', exact: true }).click();
  // The review: only the rating is ticked; the page's own are said so.
  await expect(own.getByRole('heading', { name: 'Add from your paste' })).toBeVisible();
  await expect(own.getByRole('checkbox')).toHaveCount(4);
  await expect(own.getByRole('checkbox', { checked: true })).toHaveCount(1);
  await expect(own.getByText('Already made by this page.')).toHaveCount(2);
  await own.getByRole('button', { name: 'Add 1 item', exact: true }).click();
  await expect(own.getByText('Cleaned up the paste and added 1 item.', { exact: true })).toBeVisible();
  await expect(own.getByRole('heading', { name: 'Employer rating', level: 3 })).toBeVisible();
  await expect.poll(() => custom(page)).toContain('"#identity"');

  // Again, cancelled: back on the button that opened the box.
  await own.getByRole('button', { name: 'Paste JSON-LD', exact: true }).click();
  await own.getByRole('textbox', { name: 'Paste JSON-LD' }).fill(graph);
  await own.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(own.getByRole('heading', { name: 'Add from your paste' })).toBeVisible();
  await own.getByRole('button', { name: 'Back to your item', exact: true }).click();
  await expect(own.getByRole('button', { name: 'Paste JSON-LD', exact: true })).toBeFocused();
});

test('a missing comma is kept: closed, reopened, restored and fixed', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await tab(frame, 'JSON').click();
  const broken = '{\n  "@type": "Rating",\n  "ratingValue": 4.2\n  "bestRating": 5\n}';
  const box = own.getByRole('textbox', { name: 'JSON-LD' });
  await box.fill(broken);
  await page.keyboard.press('Tab');
  // Not sent; the Form tab says so in its name.
  await expect(own.getByText('Not saved.', { exact: true })).toBeVisible();
  await expect(tab(frame, /^Form/)).toHaveAccessibleName("Form, can't read the JSON");
  expect(await custom(page)).toBe('');
  // Closed and opened again: the text is offered back.
  await button(frame, 'Back to Output').click();
  await sheet(frame, 'Output').getByRole('button', { name: UI.schema.ownJsonLd, exact: true }).click();
  await expect(own.getByText(/^You left JSON-LD with a problem on line 3 unsaved\.$/)).toBeVisible();
  await own.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(box).toHaveValue(broken);
  // Form can't read it, and says how to go on.
  await tab(frame, /^Form/).click();
  await expect(own.getByText("The form can't read this JSON: line 3 has a problem. Nothing is lost.")).toBeVisible();
  await own.getByRole('button', { name: 'Add the comma', exact: true }).click();
  await expect.poll(() => focusInSheet(frame)).toBe(true);
  await expect.poll(() => custom(page)).toBe(broken.replace('4.2\n', '4.2,\n'));
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
});

test('Escape goes back to Output, also with text not saved and after Discard', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  // Frames come late, as on a busy machine: nothing waits for one to keep
  // focus in the dialog.
  const frame = await openSheet(page, true);
  const own = sheet(frame, UI.schema.ownJsonLd);
  const backOnOutput = async () => {
    await page.keyboard.press('Escape');
    await expect(sheet(frame, 'Output')).toBeVisible();
    await expect(own).toHaveCount(0);
    await expect(page.locator(SEO_IFRAME)).toHaveCount(1);
  };
  // Text after the JSON, then Tab past the sheet's last stop: not saved,
  // focus on the sheet's title, never on the editor behind, and Escape goes
  // back.
  await tab(frame, 'JSON').click();
  await own.getByRole('textbox', { name: 'JSON-LD' }).fill('{"@type": "Thing", "name": "Lamp"} more');
  await page.keyboard.press('Tab');
  await expect(own.getByRole('heading', { name: UI.schema.ownJsonLd })).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME');
  await expect(own.getByText('Not saved.', { exact: true })).toBeVisible();
  await backOnOutput();
  await fastFrames(frame);
  // Opened again, the text is offered back; Discard, then Escape.
  await sheet(frame, 'Output').getByRole('button', { name: UI.schema.ownJsonLd, exact: true }).click();
  await own.getByRole('button', { name: UI.action.discard, exact: true }).click();
  await backOnOutput();
  expect(await custom(page)).toBe('');
});

test('a broken script tag copied from a chat: what was inside is kept in JSON, and its fix saves it', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  const frame = await openSheet(page);
  const own = sheet(frame, UI.schema.ownJsonLd);
  await own.getByRole('button', { name: 'Paste JSON-LD', exact: true }).click();
  const inside = '{\n  "@type": "Rating",\n  "ratingValue": 4.2,\n}';
  await own.getByRole('textbox', { name: 'Paste JSON-LD' }).fill(`Here it is:\n\n\`\`\`html\n<script type="application/ld+json">\n${inside}\n</script>\n\`\`\``);
  await own.getByRole('button', { name: 'Add', exact: true }).click();
  // The words, fence and script tag are gone; the trailing comma is the problem, with its fix.
  await expect(own.getByRole('textbox', { name: 'JSON-LD' })).toHaveValue(inside);
  expect(await custom(page)).toBe('');
  await own.getByRole('button', { name: 'Remove the comma', exact: true }).click();
  // As any edit in JSON: saved on leaving the box.
  await expect(own.getByRole('textbox', { name: 'JSON-LD' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect.poll(() => custom(page)).toBe('{\n  "@type": "Rating",\n  "ratingValue": 4.2\n}');
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
});

test('the main switch on an item without an id gives it one, and says so', async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {
    schema: { custom: JSON.stringify([{ '@type': 'Event', name: 'Concert' }, { '@type': 'Thing', '@id': '#other', name: 'Other' }], null, 2) },
  });
  await openPage(page, ID);
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  // The stage's line opens the sheet by keyboard, with focus in it.
  await frame.getByRole('button', { name: 'Added by hand', exact: true }).focus();
  await page.keyboard.press('Enter');
  const own = sheet(frame, UI.schema.ownJsonLd);
  await expect(own).toBeVisible();
  await expect.poll(() => focusInSheet(frame)).toBe(true);
  await own.getByRole('button', { name: /^Concert/ }).click();
  await own.getByRole('switch', { name: 'This is what the page is mainly about' }).click();
  await expect(own.getByText(/^Gave the item the id #[\w-]+ so the page can point at it\.$/)).toBeVisible();
  await expect.poll(async () => ((await seoState(page, pageQuery(ID))).target?.values.schema as { main?: string } | undefined)?.main).toMatch(/^#/);
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
});

test("Output's Add your own JSON-LD opens by keyboard with focus in the sheet", async ({ page }) => {
  await writeDraft(page, `canvas_page/${ID}`, `layout/canvas_page/${ID}`, {});
  await openPage(page, ID);
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  await button(frame, UI.schema.code).click();
  await sheet(frame, 'Output').getByRole('button', { name: UI.schema.ownJsonLd, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(sheet(frame, UI.schema.ownJsonLd).getByRole('combobox', { name: 'What is it?' })).toBeFocused();
});
