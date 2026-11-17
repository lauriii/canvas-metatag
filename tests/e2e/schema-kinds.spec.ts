import AxeBuilder from '@axe-core/playwright';
import type { FrameLocator, Page } from '@playwright/test';

import { PAGES, SITE_NAME, UI, USERS } from './constants';
import { SEO_IFRAME, button, expect, openPage, openSeo, sheet, tab, test, writeDraft } from './fixture';

/**
 * The value shapes of the newer kinds on a Canvas page: a group that opens
 * a sheet, the country picker, the choice of who, and the opening hours
 * week. Keyboard first; each sheet passes an accessibility scan and
 * reflows at 200 % zoom and in a window 350 px high.
 */

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ drupal }) => {
  await drupal.login(USERS.editor);
});

/** A page described as a kind, opened on its Schema view. */
async function described(page: Page, id: number, schema: Record<string, unknown>): Promise<FrameLocator> {
  await page.goto('./');
  await writeDraft(page, `canvas_page/${id}`, `layout/canvas_page/${id}`, { schema });
  await openPage(page, id);
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  return frame;
}

/** What scrolls sideways in the dialog: nothing should. */
const sideways = (frame: FrameLocator) =>
  frame.locator('html').evaluate((html) =>
    [html, ...html.querySelectorAll('*')]
      .filter((element) => element.scrollWidth > element.clientWidth + 1 && (element === html || ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)))
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  );

/** Controls the dialog cuts off at its right edge. */
const cutOff = (frame: FrameLocator) =>
  frame.locator('html').evaluate((html) => {
    const width = html.ownerDocument.defaultView!.innerWidth;
    return [...html.querySelectorAll('input, button, [role="combobox"]')]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.right > width + 1;
      })
      .map((element) => element.getAttribute('aria-label') ?? element.textContent ?? element.tagName);
  });

/** Serious accessibility problems in the dialog. */
async function serious(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
  return violations.filter(({ impact }) => impact === 'serious' || impact === 'critical').map(({ id, help }) => `${id}: ${help}`);
}

/** At 200 % zoom the frame keeps its size: the dialog gets half the width. */
const zoom = (page: Page, width: string) =>
  page.locator(SEO_IFRAME).evaluate((element, to) => {
    (element as HTMLElement).style.width = to;
  }, width);

test('a venue without a country: the verdict adds it, the picker finds it by its code', async ({ page }) => {
  const frame = await described(page, PAGES.pricing.id, {
    type: 'Event',
    props: {
      startDate: { text: '2027-06-19T19:00' },
      location_name: { text: 'Riverside Hall' },
      location_address_streetAddress: { text: 'Mill Road 4' },
      location_address_addressLocality: { text: 'Tampere' },
    },
  });
  const venue = frame.locator('.seo-group[data-path="schema.props.location"]');
  const box = venue.locator('.seo-group-box');
  // Named by its label, then what it reads.
  await expect(box).toHaveAccessibleName(/^Venue.*Riverside Hall, Tampere$/);
  // The box only opens its sheet: Backspace and typing change nothing.
  await box.focus();
  await page.keyboard.press('Backspace');
  await page.keyboard.press('x');
  await expect(box).toHaveAccessibleName(/^Venue.*Riverside Hall, Tampere$/);
  await expect(sheet(frame, 'Venue')).toHaveCount(0);
  // Space and Alt+↓ open it too.
  for (const key of ['Space', 'Alt+ArrowDown']) {
    await box.press(key);
    await expect(sheet(frame, 'Venue')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(box).toBeFocused();
  }
  // Pressed, it opens on its title, its parts in the shape's order; on a
  // Canvas page there is no venue page to pick yet.
  await box.press('Enter');
  const opened = sheet(frame, 'Venue');
  await expect(opened.getByRole('heading', { name: 'Venue' })).toBeFocused();
  expect((await opened.locator('.seo-group-parts label.seo-label').allTextContents()).map((label) => label.trim())).toEqual([
    'Name',
    'Street address',
    'Postal code',
    'City',
    'Region',
    'Country',
  ]);
  // What the venue misses is said once, under what it reads as, and so is
  // what the page does not show: one line each, none under the parts.
  await expect(opened.locator('.seo-group-gap > *')).toHaveText([
    'Add the country, so the address can be used.',
    "Couldn't find “Riverside Hall”, “Mill Road 4” and “Tampere” on this page.",
  ]);
  await expect(opened.locator('.seo-group-parts .seo-guide-slot[data-open]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(box).toBeFocused();
  // What it misses is said under it, as the verdict says it.
  await expect(venue).toContainText('Add the country, so the address can be used.');
  await expect(frame.getByRole('region', { name: UI.schema.stage })).toContainText('Needs a country');

  // The verdict's Add opens the sheet on the part it misses.
  await frame.getByRole('region', { name: UI.schema.stage }).getByRole('button', { name: 'Add Country', exact: true }).click();
  const venueSheet = sheet(frame, 'Venue');
  const country = venueSheet.getByRole('combobox', { name: 'Country', exact: true });
  await expect(country).toBeFocused();
  // No page to pick on a Canvas page yet: no box that would take a name.
  await expect(venueSheet.getByText('Venue page')).toHaveCount(0);
  expect(await serious(page)).toEqual([]);

  // "FI" is Finland, first; Enter picks it and gives the box focus back.
  await page.keyboard.press('Enter');
  await page.keyboard.type('FI');
  await expect(frame.getByRole('listbox').getByRole('option').first()).toHaveText(/^Finland/);
  await page.keyboard.press('Enter');
  await expect(country).toBeFocused();
  await expect(country).toHaveText(/Finland/);
  await expect(venueSheet.locator('.seo-reads-as')).toHaveText('Reads as: Riverside Hall, Tampere');

  // At 200 % zoom the sheet reflows; nothing scrolls sideways or is cut off.
  await zoom(page, '50%');
  expect(await sideways(frame)).toEqual([]);
  expect(await cutOff(frame)).toEqual([]);
  await zoom(page, '');

  // In a window 350 px high the picker stays in the frame, its filter in sight.
  await page.setViewportSize({ width: 1600, height: 350 });
  await country.scrollIntoViewIfNeeded();
  await country.click();
  const filter = frame.getByRole('searchbox', { name: 'Find a country' });
  await expect(filter).toBeFocused();
  const frameBox = (await page.locator(SEO_IFRAME).boundingBox())!;
  const filterBox = (await filter.boundingBox())!;
  expect(filterBox.y).toBeGreaterThanOrEqual(frameBox.y);
  expect(filterBox.y + filterBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height);
  await page.keyboard.press('Escape');
  await expect(filter).toHaveCount(0);
  await expect(country).toBeFocused();
  await page.setViewportSize({ width: 1600, height: 1000 });

  // Once the verdict no longer asks for it, its Add is gone: Escape returns
  // to the venue's box.
  await expect(frame.getByRole('region', { name: UI.schema.stage }).getByRole('button', { name: 'Add Country', exact: true })).toHaveCount(0, { timeout: 30_000 });
  await page.keyboard.press('Escape');
  await expect(box).toBeFocused();
  await expect(venue).not.toContainText('Add the country');
});

test("a part held back is set in the verdict's proof; Back returns to the Add that jumped", async ({ page }) => {
  const frame = await described(page, PAGES.pricing.id, {
    type: 'Event',
    props: {
      startDate: { text: '2027-06-19T19:00' },
      location_name: { text: 'Lakeside Concert Hall' },
      location_address_streetAddress: { text: 'Mannerheimintie 13e' },
    },
  });
  const stage = frame.getByRole('region', { name: UI.schema.stage });
  const line = stage.locator('.seo-feature', { hasText: 'Event result' });
  await expect(line).toContainText('Needs a city', { timeout: 30_000 });
  await line.locator('.seo-feature-line').click();
  const proof = frame.locator('.seo-proof');
  const row = (label: string) => proof.locator('.seo-proof-facts > div').filter({ has: frame.locator('dt', { hasText: new RegExp(`^${label}$`) }) });
  await expect(row('Street address').locator('dd')).toHaveText('Mannerheimintie 13e · left out until the address is complete');
  // Add only beside what it misses.
  await expect(proof.locator('.seo-proof-facts').getByRole('button')).toHaveText(['Add', 'Add']);
  await expect(row('City').getByRole('button', { name: 'Add City' })).toBeVisible();
  await expect(row('Country').getByRole('button', { name: 'Add Country' })).toBeVisible();
  await page.keyboard.press('Escape');

  // The verdict's Add opens the sheet on the part; Back returns to it.
  const add = stage.getByRole('button', { name: 'Add City', exact: true });
  await add.click();
  await expect(sheet(frame, 'Venue').getByRole('textbox', { name: 'City', exact: true })).toBeFocused();
  await button(frame, UI.action.back).click();
  await expect(add).toBeFocused();
});

test('the organizer is the site, or someone else whose name is asked for under it', async ({ page }) => {
  const frame = await described(page, PAGES.checks.id, {
    type: 'Event',
    props: { startDate: { text: '2027-06-19T19:00' }, location_name: { text: 'Riverside Hall' } },
  });
  // More details names the default that may need changing first.
  const more = frame.getByRole('button', { name: /^More details/ });
  await expect(more).toContainText(`Organizer: ${SITE_NAME} (this site)`);
  await more.click();
  // One choice, the site by default: no loose Name and Website, and no
  // "Not set" on a Canvas page.
  const organizer = frame.getByRole('combobox', { name: 'Organizer', exact: true });
  await expect(organizer).toHaveText(`${SITE_NAME} (this site)`);
  await expect(frame.getByRole('textbox', { name: 'Organizer name' })).toHaveCount(0);
  await organizer.click();
  await expect(frame.getByRole('listbox', { name: 'Organizer' }).getByRole('option')).toHaveText([`${SITE_NAME} (this site)`, 'Someone else']);
  await frame.getByRole('option', { name: 'Someone else' }).click();
  const name = frame.getByRole('textbox', { name: 'Organizer name', exact: true });
  await expect(name).toBeFocused();
  await expect(frame.getByRole('textbox', { name: 'Organizer website', exact: true })).toBeVisible();
  // Under the choice they read "Name" and "Website".
  await expect(frame.locator('[data-path="schema.props.organizer_name"] label')).toHaveText(/^NameOrganizer name$/);
  // Chosen, someone else is kept: the site is no longer assumed, nor said
  // to be by default, while the name is still to come.
  await expect(more).not.toContainText(`Organizer: ${SITE_NAME}`, { timeout: 30_000 });
  await button(frame, UI.tab.checks).click();
  await expect(sheet(frame, 'Checks')).not.toContainText('The organizer is');
  await page.keyboard.press('Escape');
  await name.fill('Lakeside Events');
  await name.blur();
  // Back to the site: the name and website go with it.
  await organizer.click();
  await frame.getByRole('option', { name: `${SITE_NAME} (this site)` }).click();
  await expect(frame.getByRole('textbox', { name: 'Organizer name' })).toHaveCount(0);
  // The same select, as by default: never a linked box.
  await expect(organizer).toHaveText(`${SITE_NAME} (this site)`);
  await expect(frame.locator('[data-path="schema.props.organizer"] .seo-linked-box')).toHaveCount(0);
});

test("an article's author nobody set is the page's author, said first in More details", async ({ page }) => {
  const frame = await described(page, PAGES.checks.id, { type: 'Article' });
  const more = frame.getByRole('button', { name: /^More details/ });
  await expect(more).toContainText(/^More details\s*Author: [^,(]+, /);
  if ((await more.getAttribute('aria-expanded')) !== 'true') {
    await more.click();
  }
  await expect(frame.getByRole('combobox', { name: 'Author', exact: true })).toHaveText(/^[^(]+ \(the page's author\)$/);
});

test('opening hours: a week by keyboard, focus never lost, reflowing at 200 % zoom', async ({ page }) => {
  const frame = await described(page, PAGES.about.id, { type: 'LocalBusiness' });
  const hoursBox = frame.getByRole('button', { name: /^Opening hours/ });
  await expect(hoursBox).toHaveAccessibleName('Opening hours Not set');
  await hoursBox.click();
  const week = sheet(frame, 'Opening hours');
  await expect(week.getByRole('heading', { name: 'Opening hours' })).toBeFocused();

  await week.getByRole('combobox', { name: 'Monday status' }).click();
  await frame.getByRole('option', { name: 'Open', exact: true }).click();
  await week.getByLabel('Monday, opens').fill('09:00');
  await week.getByLabel('Monday, closes').fill('17:00');
  // Under Monday, whose times it copies; then focus is on Tuesday.
  await button(frame, 'Use for Tue–Fri').click();
  await expect(week.getByRole('combobox', { name: 'Tuesday status' })).toBeFocused();
  await expect(week.locator('.seo-week > [role="status"]')).toHaveText('Tuesday to Friday set to 09:00–17:00');
  // It reads as the box will, on top.
  await expect(week.locator('.seo-reads-as')).toHaveText('Reads as: Mon–Fri 09:00–17:00');
  await page.screenshot({ path: test.info().outputPath('hours-week.png') });

  // A second range: focus on its opening time; removed: on the + again.
  await button(frame, 'Add a second range on Monday').click();
  await expect(week.getByLabel('Monday, second opens')).toBeFocused();
  await week.getByLabel('Monday, second opens').fill('18:00');
  await week.getByLabel('Monday, second closes').fill('20:00');
  await button(frame, "Remove Monday's second range").click();
  await expect(button(frame, 'Add a second range on Monday')).toBeFocused();
  expect(await serious(page)).toEqual([]);

  // At 200 % zoom a day's name keeps its word, and its times stay in the frame.
  await zoom(page, '50%');
  expect(await sideways(frame)).toEqual([]);
  expect(await cutOff(frame)).toEqual([]);
  const wednesday = week.getByText('Wednesday', { exact: true });
  expect((await wednesday.boundingBox())!.height).toBeLessThan(30);
  await zoom(page, '');

  // A special day: added, it takes focus, named by its visible date.
  await week.getByLabel('A special day').fill('2026-12-24');
  await button(frame, 'Add a special day').click();
  await expect(week.getByRole('combobox', { name: '24 Dec 2026 status' })).toBeFocused();
  await expect(week.locator('.seo-special')).toContainText('24 Dec 2026');

  // The focused control may show a tooltip: the first Escape closes it.
  await page.keyboard.press('Escape');
  if (await week.isVisible()) {
    await page.keyboard.press('Escape');
  }
  await expect(week).toHaveCount(0);
  await expect(hoursBox).toBeFocused();
  await expect(hoursBox).toHaveAccessibleName(/^Opening hours Mon–Fri 09:00–17:00/);

  // Clear, in the sheet's header: the week goes, the title keeps focus.
  await hoursBox.click();
  await week.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(week.getByRole('heading', { name: 'Opening hours' })).toBeFocused();
  await expect(week.locator('.seo-reads-as')).toHaveText('Reads as: Not set');
  await page.keyboard.press('Escape');
  await expect(hoursBox).toHaveAccessibleName('Opening hours Not set');
});
