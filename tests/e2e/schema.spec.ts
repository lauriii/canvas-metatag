import AxeBuilder from '@axe-core/playwright';
import type { FrameLocator, Locator, Page } from '@playwright/test';

import { IMAGES, PAGES, SITE_NAME, UI, USERS } from './constants';
import { SEO_IFRAME, button, expect, openPage, openSeo, pageQuery, seoState, sheet, tab, test, writeDraft } from './fixture';

/**
 * The Schema view: what search engines read, the search features and what
 * this page is. The tests share the sandbox and run in order.
 */

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ drupal }) => {
  await drupal.login(USERS.editor);
});

async function schema(page: Page, id: number): Promise<FrameLocator> {
  await openPage(page, id);
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  return frame;
}

const stage = (frame: FrameLocator) => frame.getByRole('region', { name: UI.schema.stage });

/** Chooses a kind in its sheet, and confirms it. */
async function choose(frame: FrameLocator, kind: string, confirm: string) {
  await button(frame, UI.schema.kind).click();
  await frame.getByRole('radio', { name: kind }).check();
  await button(frame, confirm).click();
}

/** Whether two elements overlap on screen. */
async function overlap(a: Locator, b: Locator): Promise<boolean> {
  const [one, two] = [(await a.boundingBox())!, (await b.boundingBox())!];
  return one.x < two.x + two.width && two.x < one.x + one.width && one.y < two.y + two.height && two.y < one.y + one.height;
}

const draft = async (page: Page, id: number) =>
  (await seoState(page, pageQuery(id))).target?.values.schema as { type?: string; props?: Record<string, unknown> } | undefined;

test('a new page reads as a web page, chosen by default', async ({ page }) => {
  const frame = await schema(page, PAGES.stored.id);
  const field = frame.locator('.seo-field[data-path="schema.type"]');
  await expect(field).toContainText(UI.schema.webPage);
  await expect(field).toContainText('Default');
  await expect(stage(frame)).toContainText(`a web page of ${SITE_NAME}.`);
  await expect(stage(frame).getByText('No search feature')).toBeVisible();
  // The kind's name is its label; what it reads is its description.
  await expect(button(frame, UI.schema.kind)).toHaveAccessibleDescription(new RegExp(`^${UI.schema.webPage}`));
  await button(frame, UI.schema.kind).click();
  const kinds = frame.getByRole('group', { name: UI.schema.kinds });
  await expect(kinds.getByRole('radio')).toHaveCount(6);
  // Focus starts on the chosen kind; Escape goes back to the field.
  await expect(kinds.getByRole('radio', { name: UI.schema.webPage })).toBeChecked();
  await expect(kinds.getByRole('radio', { name: UI.schema.webPage })).toBeFocused();
  await expect(kinds.locator('.seo-kind').filter({ has: frame.getByRole('radio', { name: UI.schema.webPage }) })).toContainText('Default');
  await expect(kinds.getByRole('radio', { name: UI.schema.product })).toHaveAccessibleDescription(/Not for services, memberships or subscriptions\./);
  await page.keyboard.press('Escape');
  await expect(button(frame, UI.schema.kind)).toBeFocused();
});

test('a product reads back from what ships, and a fact leads to where it is set', async ({ page }) => {
  const frame = await schema(page, PAGES.stored.id);
  await choose(frame, UI.schema.product, 'Change to a product');
  // The facts its features need come first, before More details.
  expect(await frame.locator('.seo-field[data-path^="schema.props."]').evaluateAll((fields) => fields.slice(0, 4).map((field) => field.getAttribute('data-path')))).toEqual([
    'schema.props.offers_price',
    'schema.props.offers_priceCurrency',
    'schema.props.sold_here',
    'schema.props.image',
  ]);
  await frame.getByRole('textbox', { name: 'Price', exact: true }).fill('89');
  await frame.getByRole('textbox', { name: 'Price', exact: true }).press('Enter');
  await frame.getByRole('combobox', { name: 'Currency', exact: true }).click();
  await frame.getByRole('option', { name: /^Euro/ }).click();
  await frame.getByRole('combobox', { name: 'Bought on this page', exact: true }).click();
  await frame.getByRole('option', { name: 'Yes, from us' }).click();

  // No page image: the merchant listing needs one, and says so at the field.
  await expect(stage(frame)).toContainText(`a product sold by ${SITE_NAME} for €89.`, { timeout: 30_000 });
  await expect(button(frame, 'Merchant listing: Needs an image')).toBeVisible();
  await expect(frame.locator('.seo-field[data-path="schema.props.image"]')).toContainText('Needed for merchant listings');

  // Its proof: where it shows, what it needs, the date of the rules. Opened
  // by keyboard, focus lands on its title, not on an action.
  await button(frame, 'Merchant listing: Needs an image').focus();
  await page.keyboard.press('Enter');
  const proof = frame.getByRole('dialog', { name: 'Merchant listing' });
  await expect(proof.getByRole('heading', { name: 'Merchant listing' })).toBeFocused();
  await expect(proof).toContainText('Your product in shopping results, with its price and stock.');
  // Each fact with its value as its field shows it; the image to choose.
  const fact = (name: string) => proof.locator('.seo-proof-facts > div').filter({ has: frame.getByText(name, { exact: true }) });
  await expect(fact('Price')).toContainText('€89');
  await expect(fact('Bought on this page')).toContainText('Yes, from us');
  await expect(fact('Image')).toContainText('Not set');
  await expect(proof.getByRole('button', { name: 'Choose Image', exact: true })).toBeVisible();
  await expect(proof.getByRole('button', { name: 'Documentation', exact: true })).toBeVisible();
  await expect(proof).toContainText(UI.schema.proofFoot);
  await expect(proof).toContainText(/^.*Rules checked /);
  // The portaled proof wears the dialog's focus ring.
  await page.keyboard.press('Tab');
  await expect(proof.getByRole('button', { name: 'Choose Image', exact: true })).toBeFocused();
  expect(await proof.getByRole('button', { name: 'Choose Image', exact: true }).evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  await page.keyboard.press('Escape');
  await expect(button(frame, 'Merchant listing: Needs an image')).toBeFocused();

  // Choose (named after what it sets): the image chooser (its order, the
  // page's own images first, is pinned by rankImages() in checks.test.ts).
  // Once chosen, the verdict changes, said once.
  await button(frame, 'Choose Image').click();
  const chooser = sheet(frame, 'Choose image');
  await chooser.getByRole('button', { name: IMAGES.hero.name, exact: true }).click();
  await expect(button(frame, 'Merchant listing: Can show')).toBeVisible({ timeout: 30_000 });
  await expect(stage(frame).getByRole('status')).toHaveText('Merchant listing can show');

  // Output: the outline starts with the product, tagged Main, with its id.
  await button(frame, UI.schema.code).click();
  const output = sheet(frame, 'Output');
  const outline = output.getByRole('list', { name: 'Structured data' }).getByRole('listitem');
  await expect(outline.first()).toContainText('Product');
  await expect(outline.first()).toContainText('Main');
  await expect(outline.first()).toContainText(/#primary$/);
  // Copy structured data: the head's JSON-LD, and it says so.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await output.getByRole('button', { name: 'Copy structured data', exact: true }).click();
  await expect(output.getByRole('button', { name: 'Copy structured data', exact: true })).toHaveText('Copied');
  const copied = JSON.parse(await frame.locator('body').evaluate(() => navigator.clipboard.readText()));
  expect(copied['@graph'].map((node: { '@id': string }) => node['@id'])).toEqual(expect.arrayContaining([expect.stringMatching(/#primary$/)]));
  // Show JSON-LD: the formatted JSON, as a group of its own.
  await output.getByRole('button', { name: 'Show JSON-LD', exact: true }).click();
  await expect(output.getByRole('group', { name: 'Structured data JSON' })).toContainText('"@graph"');
  await page.keyboard.press('Escape');

  // The facts are one stop for Tab; Tab leaves them for the first line.
  const name = frame.getByRole('button', { name: /^Name, Stored, from the page title$/ });
  await name.focus();
  await page.keyboard.press('Tab');
  await expect(stage(frame).locator('.seo-feature-line').first()).toBeFocused();

  // The name follows the page title: pressed, its own field opens here,
  // focused, with what to do about it.
  await name.click();
  const own = frame.getByRole('textbox', { name: 'Name', exact: true });
  await expect(own).toBeFocused();
  const field = frame.locator('.seo-field[data-path="schema.props.name"]');
  await expect(field).toContainText('The name is the page title. Give the product its own name.');
  // The name is typed here: nothing leads away to Search.
  await expect(field.getByRole('button', { name: 'Edit in Search', exact: true })).toHaveCount(0);

  // The arrows move between the facts.
  await name.focus();
  await page.keyboard.press('ArrowRight');
  await expect(frame.getByRole('button', { name: `Seller, ${SITE_NAME}, from Site` })).toBeFocused();
  // The seller is the site's: it is set in Site.
  await page.keyboard.press('Enter');
  // (This editor may not change site settings: the field is in view, read-only.)
  await expect(frame.getByRole('textbox', { name: 'Name', exact: true })).toBeInViewport();
  await expect(frame.getByRole('button', { name: UI.scope.site })).toBeVisible();
  await frame.getByRole('button', { name: UI.scope.site }).click();
  await frame.getByRole('menuitemradio', { name: UI.scope.page }).click();
});

test('a proof stays 8 px inside a short frame, its end in reach', async ({ page }) => {
  const frame = await schema(page, PAGES.stored.id);
  // A frame some 420 px tall.
  await page.setViewportSize({ width: 1440, height: 620 });
  await stage(frame).getByRole('button', { name: /^Merchant listing/ }).click();
  const proof = frame.getByRole('dialog', { name: 'Merchant listing' });
  await expect(proof).toBeVisible();
  const [box, iframe] = [(await proof.boundingBox())!, (await page.locator(SEO_IFRAME).boundingBox())!];
  expect(box.y).toBeGreaterThanOrEqual(iframe.y + 7.5);
  expect(box.y + box.height).toBeLessThanOrEqual(iframe.y + iframe.height - 7.5);
  // What does not fit scrolls inside its padding: the foot is reached.
  const documentation = proof.getByRole('button', { name: 'Documentation', exact: true });
  await documentation.scrollIntoViewIfNeeded();
  await expect(documentation).toBeInViewport();
  const end = (await documentation.boundingBox())!;
  expect(end.y + end.height).toBeLessThanOrEqual(box.y + box.height);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('a recurring price does not fit a shopping listing, and plans for a service do', async ({ page }) => {
  const frame = await schema(page, PAGES.stored.id);
  await frame.getByRole('button', { name: 'More details' }).click();
  await frame.getByRole('combobox', { name: 'Billed', exact: true }).click();
  await frame.getByRole('option', { name: 'Every month' }).click();
  const misfit = button(frame, "Merchant listing doesn't fit: a recurring price");
  await expect(misfit).toBeVisible({ timeout: 30_000 });
  await expect(frame.getByText('Memberships and subscriptions are services.')).toBeVisible();
  // Its proof says why, and what fits.
  await misfit.click();
  const proof = frame.getByRole('dialog', { name: 'Merchant listing' });
  await expect(proof).toContainText('Shopping listings are for things people buy and own.');
  await expect(proof.getByRole('button', { name: UI.schema.toService })).toBeVisible();
  await page.keyboard.press('Escape');

  await button(frame, UI.schema.toService).first().click();
  await expect(frame.locator('.seo-field[data-path="schema.type"]')).toContainText(UI.schema.service);
  // The button goes; focus stays on the kind, which now reads it.
  await expect(button(frame, UI.schema.kind)).toBeFocused();
  await expect(frame.getByRole('textbox', { name: 'Price', exact: true })).toHaveValue('89');
  await expect(stage(frame).locator('.seo-features').getByText('No search feature')).toBeVisible({ timeout: 30_000 });
  // The lines changed: the status says what they are now.
  await expect(stage(frame).getByRole('status')).toHaveText('No search feature');
  await expect.poll(async () => (await draft(page, PAGES.stored.id))?.type).toBe('Service');
  const props = (await draft(page, PAGES.stored.id))?.props;
  expect(props).toMatchObject({ offers_price: { text: '89' }, offers_priceCurrency: { text: 'EUR' }, billing: { text: 'P1M' } });
});

test('an event names itself after the page, and its withheld proof reads its values', async ({ page }) => {
  const id = PAGES.checks.id;
  await writeDraft(page, `canvas_page/${id}`, `layout/canvas_page/${id}`, {
    schema: {
      type: 'Event',
      props: {
        startDate: { text: '2027-06-19T19:00' },
        location_address_addressLocality: { text: 'Turku' },
        location_address_addressCountry: { text: 'FI' },
      },
    },
  });
  const frame = await schema(page, id);
  // No street address: the event is withheld, and its proof still reads
  // what it has. Only the street address is not set.
  const line = stage(frame).locator('.seo-feature-line').first();
  await expect(line).toHaveAccessibleName(/^Event result: Needs/, { timeout: 30_000 });
  await line.click();
  const proof = frame.getByRole('dialog', { name: 'Event result' });
  await expect(proof).toContainText('19 June 2027, 19:00');
  await expect(proof).toContainText('Turku');
  const unset = proof.locator('.seo-proof-facts > div').filter({ hasText: 'Not set' });
  await expect(unset).toHaveCount(1);
  await expect(unset).toContainText('Street address');
  await page.keyboard.press('Escape');
  // The fix is named after what it sets.
  await expect(proof).toBeHidden();
  await expect(stage(frame).getByRole('button', { name: 'Add Street address', exact: true })).toBeVisible();

  // Filled in: the name follows the page title, and pressing it opens its
  // own field here, focused, saying so.
  await frame.getByRole('textbox', { name: 'Street address', exact: true }).fill('Linnankatu 1');
  await frame.getByRole('textbox', { name: 'Street address', exact: true }).press('Tab');
  const name = stage(frame).getByRole('button', { name: /^Event name, .+, from the page title$/ });
  await expect(name).toBeVisible({ timeout: 30_000 });
  await name.click();
  await expect(frame.getByRole('textbox', { name: 'Event name', exact: true })).toBeFocused();
  const field = frame.locator('.seo-field[data-path="schema.props.name"]');
  await expect(field).toContainText('Now the page title');
  await expect(field.getByRole('button', { name: 'Edit in Search', exact: true })).toBeVisible();

  // The Schema view passes an automated accessibility scan.
  const { violations } = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
  expect(
    violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`),
  ).toEqual([]);
  await writeDraft(page, `canvas_page/${id}`, `layout/canvas_page/${id}`, {});
});

test('the kinds sheet keeps its confirm in sight, never over the chosen kind', async ({ page }) => {
  const frame = await schema(page, PAGES.stored.id);
  await button(frame, UI.schema.kind).click();
  for (const height of [900, 350]) {
    await page.setViewportSize({ width: 1440, height });
    await frame.getByRole('radio', { name: UI.schema.article }).check();
    const confirm = frame.locator('.seo-sheet-foot');
    await expect(confirm.getByRole('button', { name: 'Change to an article', exact: true })).toBeVisible();
    await frame.getByRole('radio', { name: UI.schema.article }).scrollIntoViewIfNeeded();
    const chosen = frame.locator('.seo-kind').filter({ has: frame.getByRole('radio', { name: UI.schema.article }) });
    expect(await overlap(chosen, confirm), `${height}`).toBe(false);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Escape');
});

test('changing the kind names what it removes, and Undo brings it back', async ({ page }) => {
  const frame = await schema(page, PAGES.stored.id);
  await button(frame, UI.schema.kind).click();
  await frame.getByRole('radio', { name: UI.schema.event }).check();
  // Said in the form's order, the price first; its words are announced too.
  await expect(frame.locator('.seo-sheet-foot').getByText(/^Changing to an event removes the price \(€89\) and the billing \(every month\) you set\. Undo brings them back\.$/)).toBeVisible();
  await expect(frame.getByRole('status').filter({ hasText: /^Changing to an event removes the price/ })).toHaveCount(1);
  // Until it is confirmed, the kind is what it was.
  await button(frame, 'Keep plans for a service').click();
  await expect(frame.locator('.seo-field[data-path="schema.type"]')).toContainText(UI.schema.service);

  await choose(frame, UI.schema.event, 'Change to an event');
  await expect.poll(async () => (await draft(page, PAGES.stored.id))?.type).toBe('Event');
  await button(frame, 'Undo').click();
  await expect.poll(async () => (await draft(page, PAGES.stored.id))?.props).toMatchObject({ offers_price: { text: '89' } });
  // Back to a web page: nothing stored, and it stays one when opened again.
  await choose(frame, UI.schema.webPage, 'Change to a web page');
  await expect.poll(async () => (await draft(page, PAGES.stored.id))?.type).toBeUndefined();
  // Nothing ships as the main node.
  expect((await seoState(page, pageQuery(PAGES.stored.id))).resolved?.schema?.nodes.filter((node) => node.origin === 'main')).toEqual([]);
  const again = await schema(page, PAGES.stored.id);
  await expect(again.locator('.seo-field[data-path="schema.type"]')).toContainText(UI.schema.webPage);
});

test('a kind this site no longer knows is said, and the page stays a web page', async ({ page }) => {
  const frame = await schema(page, PAGES.oldRecipe.id);
  await expect(frame.getByText('This page was described as “Recipe”, which this site no longer knows. Search engines get a plain web page.')).toBeVisible();
  await expect(frame.locator('.seo-field[data-path="schema.type"]')).toContainText('Not known: “Recipe”');
  await button(frame, UI.tab.checks).click();
  await expect(sheet(frame, 'Checks').getByText('Choose what this page is')).toBeVisible();
});

test('a blog post is an article, its kind of article in More details', async ({ page }) => {
  const id = PAGES.checks.id;
  await writeDraft(page, `canvas_page/${id}`, `layout/canvas_page/${id}`, { schema: { type: 'BlogPosting' } });
  const frame = await schema(page, id);
  await expect(frame.locator('.seo-field[data-path="schema.type"]')).toContainText(UI.schema.article);
  await expect(frame.locator('.seo-field[data-path="schema.type"]')).toContainText('Kind of article: Blog post');
  await frame.getByRole('button', { name: 'More details' }).click();
  await expect(frame.getByRole('combobox', { name: 'Kind of article', exact: true })).toHaveText('Blog post');
});

test('the price and its currency fit side by side, no word broken, at 100 and 200 %', async ({ page }) => {
  const frame = await schema(page, PAGES.pricing.id);
  await choose(frame, UI.schema.product, 'Change to a product');
  // With a currency of its own, the label row carries its source and Reset.
  await frame.getByRole('combobox', { name: 'Currency', exact: true }).click();
  await frame.getByRole('option', { name: /^Euro/ }).click();
  const pair = frame.locator('.seo-price');
  const [price, currency] = await pair.locator('.seo-field').all();
  const box = async (locator: typeof price) => (await locator.boundingBox())!;
  for (const size of [{ width: 1440, height: 900 }, { width: 720, height: 450 }]) {
    await page.setViewportSize(size);
    await currency.getByRole('combobox').focus();
    await expect(currency.getByRole('button', { name: 'Reset Currency' })).toBeVisible();
    // Side by side at the dialog's width; below the width where both fit
    // the pair stacks. Each label row and the chosen currency stay on one line.
    const apart = Math.abs((await box(price)).y - (await box(currency)).y);
    if (size.width === 1440) {
      expect(apart).toBeLessThan(2);
    } else if (apart >= 2) {
      expect((await box(currency)).x).toBeCloseTo((await box(price)).x, 0);
    }
    for (const line of [price.locator('.seo-label-row'), currency.locator('.seo-label-row'), currency.getByRole('combobox')]) {
      expect((await box(line)).height, `${size.width}`).toBeLessThan(36);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await choose(frame, UI.schema.webPage, 'Change to a web page');
});

test('your own JSON-LD lives behind Code, read back and checked item by item', async ({ page }) => {
  const id = PAGES.checks.id;
  const custom = [
    { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Is the shade dimmable?', acceptedAnswer: { '@type': 'Answer', text: 'Yes.' } }] },
    { '@type': 'Organization', name: SITE_NAME, url: 'https://example.org/' },
  ];
  await writeDraft(page, `canvas_page/${id}`, `layout/canvas_page/${id}`, { schema: { custom: JSON.stringify(custom) } });
  const frame = await schema(page, id);
  // Said once per page where it was, with a way to the sheet.
  await expect(frame.getByText(UI.schema.moved)).toBeVisible();
  await button(frame, 'Open it').click();
  await expect(sheet(frame, UI.schema.ownJsonLd)).toBeVisible();
  // The items by the names the stage reads back, never "Item 1".
  await expect(sheet(frame, UI.schema.ownJsonLd).locator('.seo-hand-name').first()).toHaveText(/^FAQ/);
  await page.keyboard.press('Escape');
  // Followed, the notice goes; the way back is Code, where it lives now.
  await expect(frame.getByText(UI.schema.moved)).toHaveCount(0);
  await expect(button(frame, UI.schema.code)).toBeFocused();
  await expect(stage(frame)).toContainText('Added by hand: FAQ');
  await expect(button(frame, 'FAQ: Not shown since 7 May 2026')).toBeVisible();

  // Output: the graph as an outline, then the test of a draft.
  await button(frame, UI.schema.code).click();
  const output = sheet(frame, 'Output');
  const rows = output.getByRole('list', { name: 'Structured data' }).getByRole('listitem');
  await expect(rows.filter({ hasText: 'FAQPage' })).toContainText('Not shown since 7 May 2026');
  await expect(rows.filter({ hasText: 'FAQPage' })).toContainText('Added by hand');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const popup = page.waitForEvent('popup');
  await output.getByRole('button', { name: 'Test this page', exact: true }).click();
  await (await popup).close();
  await expect(output.getByText('Copied. Paste the code into the test.')).toBeVisible();

  // The sheet: the second identity points at the site's, the question nobody
  // can see is to fix, and leaving it out keeps the JSON-LD.
  await output.getByRole('button', { name: UI.schema.ownJsonLd, exact: true }).click();
  const own = sheet(frame, UI.schema.ownJsonLd);
  await expect(own.getByText(/^This is your site's organization\. Point to it with “@id”: “http.+\/#identity” instead\.$/)).toBeVisible();
  await expect(own.getByText("Couldn't find the question “Is the shade dimmable?” on this page")).toBeVisible();
  await own.getByRole('button', { name: "Leave it out until it's on the page" }).first().click();
  await expect.poll(async () => (await draft(page, id)) as unknown).toMatchObject({ skip: ['#faqpage'] });
  expect(JSON.parse(((await draft(page, id)) as { custom: string }).custom)[0]['@id']).toBe('#faqpage');
  await expect(frame.getByText('Gave the item the id #faqpage so it can be left out.').first()).toBeVisible();
  // The row goes, the item says why, and so does Output.
  await expect(own.getByText("Couldn't find the question “Is the shade dimmable?” on this page")).toHaveCount(0, { timeout: 30_000 });
  await expect(own.getByText("Left out until it's on the page")).toBeVisible();
  await page.keyboard.press('Escape');
  // Back to what opened the first sheet.
  await expect(button(frame, UI.schema.code)).toBeFocused();
  await button(frame, UI.schema.code).click();
  const left = sheet(frame, 'Output').getByRole('list', { name: 'Structured data' }).getByRole('listitem').filter({ hasText: 'FAQPage' });
  await expect(left).toContainText("Left out until it's on the page");
  await page.keyboard.press('Escape');

  // Opened again: the notice is not.
  const again = await schema(page, id);
  await expect(again.getByText(UI.schema.moved)).toHaveCount(0);
});
