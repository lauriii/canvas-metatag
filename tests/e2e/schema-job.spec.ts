import type { FrameLocator } from '@playwright/test';

import { COMPLEX, SITE_NAME, UI, USERS } from './constants';
import { button, expect, openSeo, openTemplate, sheet, tab, test } from './fixture';

/**
 * Job postings, set up on their content type: the employer answered once,
 * where the work is as one question, the pay sheet and a closed job. And a
 * venue linked part by part: its box only opens its sheet. The sandbox is
 * the complex fixture (project `schema-templates`).
 */

test.describe.configure({ mode: 'serial' });

const { event, job, jobExpired, product } = COMPLEX;

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

/** The facts shown before More details: a detail under another counts with it. */
const shownFirst = (frame: FrameLocator) =>
  frame.locator('.seo-panel[data-state="active"]').evaluate((panel) =>
    [...panel.querySelectorAll(':scope > [data-path^="schema.props."]')].map((one) => one.getAttribute('data-path')),
  );

test('every job posting: the employer answered once, and where the work is as one question', async ({ page }) => {
  await openTemplate(page, job.id, 'job_posting');
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  await choose(frame, 'A job posting', 'Change to a job posting');
  // Not one yet: the sentence says what it needs, in the words Checks uses.
  await expect(frame.locator('.seo-readback .seo-muted')).toHaveText('Not a job posting yet: it needs a description and an employer.', { timeout: 30_000 });

  // Nobody has answered for the employer: "Not set", and what it is for.
  const employer = frame.getByRole('combobox', { name: 'Employer', exact: true });
  await expect(employer).toHaveText('Not set');
  await expect(frame.locator('[data-path="schema.props.hiringOrganization"]')).toContainText('Needed for job listings');
  await employer.click();
  await expect(frame.getByRole('option')).toHaveText(['Not set', `${SITE_NAME} (this site)`, 'Someone else']);
  await page.keyboard.press('Escape');
  // Its link menu offers the site first, as its own group.
  await button(frame, UI.action.link('Employer')).click();
  const employerMenu = frame.getByRole('dialog', { name: 'Link Employer' });
  await expect(employerMenu.getByRole('group').first()).toHaveAccessibleName('This site');
  await page.keyboard.press('Escape');
  // The site, chosen by keyboard: the same select says so, and keeps focus;
  // nothing reads as linked.
  await employer.focus();
  await page.keyboard.press('Enter');
  await frame.getByRole('option', { name: `${SITE_NAME} (this site)` }).press('Enter');
  await expect(employer).toBeFocused();
  await expect(employer).toHaveText(`${SITE_NAME} (this site)`);
  await expect(frame.locator('[data-path="schema.props.hiringOrganization"] .seo-linked-box')).toHaveCount(0);

  // A job description is only linked: its box opens the link menu, which
  // lists the formatted text fields.
  await frame.getByRole('button', { name: 'Description', exact: true }).click();
  const description = frame.getByRole('dialog', { name: 'Link Description' });
  const body = description.getByRole('group', { name: 'Job posting' }).getByRole('option', { name: /^Description, / });
  await expect(body).toBeVisible();
  await body.click();

  // On site: the workplace, and nobody is asked where they may apply from.
  const where = frame.getByRole('combobox', { name: 'Where the work is', exact: true });
  await where.click();
  await frame.getByRole('option', { name: 'On site', exact: true }).click();
  await expect(frame.locator('.seo-group[data-path="schema.props.jobLocation"]')).toBeVisible();
  await expect(frame.locator('[data-path="schema.props.applicantLocationRequirements"]')).toHaveCount(0);
  // Fully remote: the reverse, and at most four facts before More details.
  await where.click();
  await frame.getByRole('option', { name: 'Fully remote', exact: true }).click();
  await expect(frame.locator('.seo-group[data-path="schema.props.jobLocation"]')).toHaveCount(0);
  const open = frame.locator('[data-path="schema.props.applicantLocationRequirements"]');
  await expect(open).toBeVisible();
  expect((await shownFirst(frame)).length).toBeLessThanOrEqual(4);

  // Who can apply from: each toggle is said with the new total, and the
  // list keeps the order it opened with.
  await open.getByRole('combobox').click();
  const filter = frame.getByRole('searchbox', { name: 'Find a country' });
  const rows = frame.locator('.seo-picker-list [role="option"]');
  const opened = (await rows.allTextContents()).slice(0, 5);
  for (const country of ['Finland', 'Sweden', 'Estonia']) {
    await filter.fill(country);
    // The row Enter picks is shown.
    await expect(rows.first()).toHaveAttribute('data-active');
    await filter.press('Enter');
  }
  await expect(frame.locator('.seo-picker-foot')).toHaveText('3 chosen · up to 50');
  await expect(frame.locator('.seo-picker [aria-live="polite"]')).toHaveText('Estonia selected, 3 chosen');
  await filter.fill('');
  expect((await rows.allTextContents()).slice(0, 5)).toEqual(opened);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: test.info().outputPath('every-job-remote.png') });
  // The verdict's proof says where the work is as it was answered, never as
  // the code it gives.
  const line = frame.getByRole('region', { name: UI.schema.stage }).locator('.seo-feature', { hasText: 'Job posting' });
  await line.locator('.seo-feature-line').click();
  const whereRow = frame.locator('.seo-proof .seo-proof-facts > div').filter({ has: frame.locator('dt', { hasText: /^Where the work is$/ }) });
  await expect(whereRow.locator('dd')).toHaveText('Fully remote');
  await page.keyboard.press('Escape');

  // On site: the workplace, under where the work is. Linked to the
  // Location field, it is that page, one Enter away; its own details wait
  // folded, "Not set", and its box says it is linked.
  await where.click();
  await frame.getByRole('option', { name: 'On site', exact: true }).click();
  const workplace = frame.locator('.seo-under > .seo-group[data-path="schema.props.jobLocation"]');
  await expect(workplace).toBeVisible();
  await workplace.locator('.seo-group-box').click();
  const workplaceSheet = sheet(frame, 'Workplace');
  await workplaceSheet.getByRole('button', { name: 'Workplace page', exact: true }).click();
  const pages = frame.getByRole('dialog', { name: 'Link Workplace page' });
  await pages.getByRole('option', { name: /^Location, Its page/ }).click();
  const own = workplaceSheet.getByRole('button', { name: /^Own details, if the page has none/ });
  await expect(own).toHaveAttribute('aria-expanded', 'false');
  await expect(own).toContainText('Not set');
  await page.keyboard.press('Escape');
  await expect(workplace.locator('.seo-linked-tag')).toHaveText('Location');
});

test('the pay sheet says pay in the wrong order at the pay; a closed job reads as closed', async ({ page }) => {
  await openTemplate(page, job.id, 'job_posting');
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  // Set up by the test before: a job posting.
  const pay = frame.locator('.seo-group[data-path="schema.props.baseSalary"]');
  await openMore(frame);
  await pay.locator('.seo-group-box').click();
  const paySheet = sheet(frame, 'Pay');
  await expect(paySheet.getByRole('heading', { name: 'Pay' })).toBeFocused();
  await paySheet.getByRole('textbox', { name: 'From', exact: true }).fill('5000');
  await paySheet.getByRole('textbox', { name: 'From', exact: true }).press('Tab');
  await paySheet.getByRole('textbox', { name: 'Up to', exact: true }).fill('4200');
  await paySheet.getByRole('textbox', { name: 'Up to', exact: true }).press('Tab');
  await paySheet.getByRole('combobox', { name: 'Paid per', exact: true }).click();
  await frame.getByRole('option', { name: /^month$/i }).click();
  // Said where the amounts are edited, once, under Reads as.
  await expect(paySheet.locator('.seo-group-gap')).toContainText('From is more than Up to.', { timeout: 30_000 });
  await page.screenshot({ path: test.info().outputPath('pay-sheet.png') });
  await button(frame, UI.action.back).click();
  // Said under the pay, to fix, and in Checks with a Show named for it.
  await expect(pay).toContainText('From is more than Up to.', { timeout: 30_000 });
  await expect(pay).not.toContainText('Pay:');
  // Its Show lands on the amount to change.
  await pay.getByRole('button', { name: 'Show pay' }).click();
  await expect(paySheet.getByRole('textbox', { name: 'Up to', exact: true })).toBeFocused();
  await button(frame, UI.action.back).click();
  await button(frame, UI.tab.checks).click();
  await expect(sheet(frame, 'Checks').getByRole('button', { name: 'Show pay' })).toBeVisible();
  await page.keyboard.press('Escape');

  // A job whose closing date has passed still ships, and reads as closed.
  await frame.getByRole('button', { name: UI.action.link('Closing date') }).click();
  await frame.getByRole('dialog', { name: 'Link Closing date' }).getByRole('option', { name: /^Apply by/ }).click();
  await openTemplate(page, jobExpired.id, 'job_posting');
  const expired = await openSeo(page);
  await tab(expired, UI.tab.schema).click();
  await expect(expired.locator('.seo-feature', { hasText: 'Job posting' })).toContainText(/Not shown: this job closed/, { timeout: 30_000 });
  await page.screenshot({ path: test.info().outputPath('closed-job.png') });
});

test('a kind of place is chosen on a template, by mouse and by keyboard', async ({ page }) => {
  // Products here are places people visit: a shop's own pages.
  await openTemplate(page, product.id, 'product');
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  await choose(frame, 'A place people visit', 'Change to a place people visit');
  // The default reads as its option, never as typed text.
  const field = frame.locator('[data-path="schema.props.placeKind"]');
  await expect(field.locator('.seo-linked-box')).toContainText('Other local business');
  await expect(field).not.toContainText('Typed text');
  await field.locator('.seo-linked-box').click();
  await frame.getByRole('dialog', { name: 'Link Kind of place' }).getByRole('option', { name: /^Choose an option for every Product/ }).click();
  const kind = frame.getByRole('combobox', { name: 'Kind of place', exact: true });
  await expect(kind).toBeFocused();
  // By mouse: the list opens and stays open, and the choice holds.
  await kind.click();
  await frame.getByRole('option', { name: 'Restaurant', exact: true }).click();
  await expect(kind).toHaveText('Restaurant');
  // By keyboard.
  await kind.focus();
  await page.keyboard.press('Enter');
  await frame.getByRole('option', { name: 'Hotel', exact: true }).press('Enter');
  await expect(kind).toBeFocused();
  await expect(kind).toHaveText('Hotel');
});

test('a linked venue: its box only opens its sheet, whose parts unlink at once', async ({ page }) => {
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  await tab(frame, UI.tab.schema).click();
  const venue = frame.locator('.seo-group[data-path="schema.props.location"]');
  const box = venue.locator('.seo-group-box');
  const before = await box.textContent();
  await box.focus();
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  await expect(box).toHaveText(before!);
  await expect(sheet(frame, 'Venue')).toHaveCount(0);
  // Pressed, it opens on its title, its parts in the shape's order.
  await box.press('Enter');
  const venueSheet = sheet(frame, 'Venue');
  await expect(venueSheet.getByRole('heading', { name: 'Venue' })).toBeFocused();
  const labels = await venueSheet.locator('.seo-group-parts .seo-field > .seo-label-row .seo-label > :is(label, span.seo-label)').allTextContents();
  expect(labels.map((label) => label.trim()).filter((label) => label !== 'Venue page')).toEqual(['Name', 'Street address', 'Postal code', 'City', 'Region', 'Country']);
  // Every set part is linked: Unlink all, and the title keeps focus.
  const unlink = venueSheet.getByRole('button', { name: 'Unlink all' });
  await expect(unlink).toBeVisible();
  await unlink.click();
  await expect(venueSheet.getByRole('heading', { name: 'Venue' })).toBeFocused();
  await expect(venueSheet.getByRole('button', { name: 'Unlink all' })).toHaveCount(0);
  // Its Undo is in reach in the sheet, over it.
  await expect(frame.locator('.seo-bar').getByRole('button', { name: UI.action.undo, exact: true })).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Escape');
  await expect(box).toBeFocused();
  await button(frame, UI.action.undo).click();
  await expect(box).toHaveText(before!);
});
