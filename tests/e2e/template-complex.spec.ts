import type { FrameLocator, Locator, Page } from '@playwright/test';

import { COMPLEX, SITE_NAME, TEST_ID, UI, USERS } from './constants';

// cspell:ignore ביצים ברוטב
import {
  button,
  closeReview,
  expect,
  link,
  openSeo,
  openTemplate,
  publishAll,
  readHead,
  reviewRows,
  seoState,
  sheet,
  status,
  tab,
  test,
  textbox,
} from './fixture';

/**
 * Template SEO on complex content: several node types with references,
 * lists, media and unusual text, a template whose draft differs from what is
 * live and one that was never published. The sandbox is the coupled site
 * plus the complex fixture (project `complex`).
 */

test.describe.configure({ mode: 'serial' });

const {
  event,
  eventHidden,
  eventLong,
  eventUnpublished,
  personOmar,
  product,
  productRtl,
  recipe,
  recipeRtl,
  announcement,
  ending,
} = COMPLEX;

/** Opens the "Insert value" menu of the title field. */
async function insertMenu(frame: FrameLocator) {
  await button(frame, UI.action.insert).first().click();
  const menu = frame.getByRole('menu', { name: 'Values' });
  await expect(menu).toBeVisible();
  return menu;
}

/** Switches the template editor's preview to another node of the type. */
async function previewNode(page: Page, bundle: string, node: { id: number; title: string }): Promise<void> {
  await page.getByTestId('select-content-preview-item').click();
  await page.getByRole('menuitem', { name: node.title }).click();
  await expect(page).toHaveURL(new RegExp(`/canvas/template/node/${bundle}/full/${node.id}$`));
}

test('the Event template opens on its draft and offers the type fields with their values', async ({
  drupal,
  page,
  visitor,
}) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  const preview = frame.getByTestId(TEST_ID.search);

  // The draft, not what is live: its title ends in "Tickets".
  await expect(button(frame, 'Every Event')).toBeVisible();
  await expect(frame.getByText(/^Previewing/)).toContainText(event.title);
  await expect(textbox(frame, UI.field.title)).toHaveValue(`{Page title} {Separator} ${ending.draft}`);
  await expect(preview).toContainText(`${event.title} | ${ending.draft}`);
  await expect(status(frame)).toContainText(UI.footer.draftTemplate);

  // The Event's fields come first, each with the previewed event's value. A
  // text field offers no images, and two values that share the label
  // "Description" are told apart.
  const menu = await insertMenu(frame);
  const fields = menu.getByRole('group', { name: 'Event', exact: true });
  await expect(fields.getByRole('menuitem', { name: /^Venue/ })).toContainText(event.venue);
  await expect(fields.getByRole('menuitem', { name: /^Status/ })).toContainText(event.status);
  await expect(fields.getByRole('menuitem', { name: /^Description \(field\.body\)/ })).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: /^Description \(description\)/ })).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: /^Poster/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // The template is among the changes to review; visitors get what is live.
  await expect(await reviewRows(page, /Event/)).toHaveCount(1);
  await closeReview(page);
  const head = await readHead(visitor, event.path);
  expect(head.titles).toEqual([`${event.title} | ${ending.live}`]);
  expect(link(head, 'canonical')).toBe(visitor.url());
  expect(head.jsonLd).toHaveLength(1);
});

test('the dialog follows the previewed event, also through hidden references and long titles', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  const preview = frame.getByTestId(TEST_ID.search);
  const caption = frame.getByText(/^Previewing/);

  // Emoji and joiners read as typed; an unpublished venue is empty.
  await previewNode(page, 'event', eventHidden);
  await expect(caption).toContainText(eventHidden.title);
  await expect(preview).toContainText(`${eventHidden.title} | ${ending.draft}`);
  const menu = await insertMenu(frame);
  await expect(menu.getByRole('menuitem', { name: /^Venue/ })).toContainText('Empty for this event');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // A title near the limit: Checks asks to shorten it.
  await previewNode(page, 'event', { id: eventLong.id, title: eventLong.title });
  await expect(caption).toContainText(eventLong.title);
  await button(frame, UI.tab.checks).click();
  await expect(sheet(frame, 'Checks').getByText(UI.checks.titleLong).first()).toBeVisible({ timeout: 60_000 });
  // The event is withheld from structured data until a street address is
  // set; the address is on the venue, which a value cannot reach.
  await expect(sheet(frame, 'Checks').getByText('Add Street address').first()).toBeVisible();
});

test('Checks on a product say why it is withheld and that its image has no alt text', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, product.id, 'product');
  const frame = await openSeo(page);
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(`${product.title} | ${SITE_NAME}`);
  await button(frame, UI.tab.checks).click();
  const panel = sheet(frame, 'Checks');
  // The currency list gives its label, which is not a currency code.
  await expect(panel.getByText('Add Currency').first()).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByText('The social image has no alt text').first()).toBeVisible();
});

test('a template that was never published previews its values; visitors keep core head', async ({
  drupal,
  page,
  visitor,
}) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, recipe.id, 'recipe');
  const frame = await openSeo(page);
  const preview = frame.getByTestId(TEST_ID.search);
  await expect(frame.getByText(/^Previewing/)).toContainText('Template not in use yet');
  await expect(preview).toContainText(`${recipe.title} | Recipes`);
  await expect(preview).toContainText(recipe.firstIngredient);

  const head = await readHead(visitor, recipe.path);
  expect(head.titles).toEqual([`${recipe.title} | ${SITE_NAME}`]);
  expect(head.links.filter(({ rel }) => rel === 'shortlink')).toHaveLength(1);
  expect(head.meta['og:title']).toBeUndefined();
  expect(head.jsonLd).toEqual([]);
});

test('a node that is not published is named as such in the caption', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  const caption = frame.getByText(/^Previewing/);
  await expect(caption).not.toContainText('Not published');

  await previewNode(page, 'event', eventUnpublished);
  await expect(caption).toContainText(eventUnpublished.title);
  await expect(caption).toContainText('Not published');
  await expect(frame.getByRole('button', { name: 'About this preview' })).toHaveAttribute(
    'aria-description',
    /^This event isn't published yet\. Values that only editors can see are left out\. /,
  );
  await expect(frame.locator('.seo-stage-cap-l', { hasText: 'Link preview' })).toContainText('Not published yet');

  await previewNode(page, 'event', { id: event.id, title: event.title });
  await expect(caption).toContainText(event.title);
  await expect(caption).not.toContainText('Not published');
});

test('text takes its own direction: right to left in previews and inputs, labels as the dialog', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.editor);
  const direction = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).direction);

  // An Arabic description ends with its full stop at its left.
  await openTemplate(page, productRtl.id, 'product');
  let frame = await openSeo(page);
  const description = frame.getByTestId(TEST_ID.search).locator('.seo-result-text');
  await expect(description).toHaveAttribute('dir', 'auto');
  expect(await direction(description)).toBe('rtl');
  await frame.getByTestId(TEST_ID.search).screenshot({ path: test.info().outputPath('search-preview-rtl.png') });

  // A Hebrew value that starts with a digit is laid out right to left; the
  // field's label is the dialog's own words.
  await openTemplate(page, recipeRtl.id, 'recipe');
  frame = await openSeo(page);
  const input = textbox(frame, UI.field.description);
  await input.fill('4 ביצים ברוטב');
  expect(await direction(input)).toBe('rtl');
  expect(await direction(frame.locator('label', { hasText: /^Description$/ }).first())).toBe('ltr');
  await frame.locator('body').screenshot({ path: test.info().outputPath('input-rtl.png') });

  // An empty input takes the direction of the value it inherits: the social
  // title of an Arabic name.
  await openTemplate(page, personOmar.id, 'person');
  frame = await openSeo(page);
  await tab(frame, UI.tab.social).click();
  const social = textbox(frame, UI.field.socialTitle);
  await expect(social).toHaveValue('');
  expect(await direction(social)).toBe('rtl');
  expect(await direction(frame.locator('.seo-field[data-path="social.title"] label').first())).toBe('ltr');
});

test('a type with no content shows its values read-only, until there is one to preview', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await page.goto('./canvas/template/node/announcement/full');
  await expect(page.getByTestId('canvas-publish-review')).toBeVisible({ timeout: 60_000 });
  const frame = await openSeo(page);
  await expect(button(frame, 'Every Announcement')).toBeVisible();
  await expect(frame.getByText(UI.template.nothingToPreview)).toBeVisible();
  // The stored title, with its values as labels, and nothing to edit.
  await expect(textbox(frame, UI.field.title)).toHaveValue(announcement.title);
  await expect(textbox(frame, UI.field.title)).toBeDisabled();
  await expect(frame.getByTestId(TEST_ID.search)).toHaveCount(0);
  await expect(button(frame, UI.tab.checks)).toHaveCount(0);
  await expect(button(frame, UI.action.output)).toHaveCount(0);
  await expect(frame.getByText(UI.site.hint)).toHaveCount(0);
  await expect(frame.getByText(UI.site.otherTemplate)).toHaveCount(0);
  // Nothing is filled in, so no value is flagged as empty; a field that
  // inherits says what it inherits.
  await expect(frame.locator('.seo-chip')).not.toHaveCount(0);
  await expect(frame.locator('.seo-chip[data-empty]')).toHaveCount(0);
  const description = frame.locator('.seo-field[data-path="description"] .seo-inherited');
  await expect(description).toHaveText('{Description}');
  // Also to assistive technology, which cannot focus the field.
  await expect(textbox(frame, UI.field.description)).toHaveAttribute('aria-description', /: Description\.$/);
  // Settings are values at rest: no switch or menu that does not open.
  await expect(frame.getByRole('switch')).toHaveCount(0);
  await expect(frame.locator('.seo-row[data-path="robots.noindex"]')).toContainText('On');
  await button(frame, 'Advanced').click();
  await expect(frame.getByRole('combobox')).toHaveCount(0);
  await expect(frame.locator('.seo-row[data-path="robots.nosnippet"]')).toContainText('Allowed');
  await tab(frame, UI.tab.social).click();
  await expect(frame.locator('.seo-field[data-path="social.title"] .seo-inherited')).toHaveText(
    'Same as the search title',
  );
  await expect(textbox(frame, UI.field.socialTitle)).toHaveAttribute('aria-description', 'Same as the search title.');
  // No type, and nothing to choose: "None", without the invitation.
  await tab(frame, UI.tab.schema).click();
  await expect(frame.getByRole('combobox', { name: 'Type', exact: true })).toHaveText('None');
  await expect(frame.getByText(/^Helps search engines/)).toHaveCount(0);
  // Custom JSON-LD is off and opens no empty editor.
  await expect(frame.getByText('Custom JSON-LD')).toBeVisible();
  await expect(button(frame, 'Custom JSON-LD')).toHaveCount(0);
  await tab(frame, UI.tab.search).click();
  // The scope menu names the state as the notice does.
  await button(frame, 'Every Announcement').click();
  await expect(frame.getByRole('menuitemradio', { name: 'Every Announcement' })).toHaveAccessibleDescription(
    'No announcement yet',
  );
  await page.keyboard.press('Escape');

  // The first announcement, added elsewhere: the open dialog follows the
  // editor to it and the values open up.
  const other = await page.context().newPage();
  await other.goto('./node/add/announcement');
  await other.getByLabel('Title', { exact: true }).fill('Doors open early');
  await other.getByRole('button', { name: 'Save' }).first().click();
  await expect(other.getByText('Doors open early').first()).toBeVisible();
  // Canvas picks it to preview: its id is in the route Canvas moves to.
  await other.goto('./canvas/template/node/announcement/full');
  await expect(other).toHaveURL(/\/canvas\/template\/node\/announcement\/full\/\d+$/, { timeout: 60_000 });
  const id = /(\d+)$/.exec(other.url())![1];
  await other.close();
  // The editor moves to it as a client-side route change, as its preview
  // picker does.
  await page.evaluate((path) => {
    history.pushState({}, '', path);
    dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, `/canvas/template/node/announcement/full/${id}`);
  await expect(frame.getByText(/^Previewing/)).toContainText('Doors open early');
  await expect(textbox(frame, UI.field.title)).toBeEnabled();
  await expect(frame.getByText(UI.template.nothingToPreview)).toHaveCount(0);
});

test('only the full template has SEO settings', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  // Another template of a type: Site settings, with where SEO is set.
  await page.goto(`./canvas/template/node/product/teaser/${product.id}`);
  await expect(page.getByTestId('canvas-publish-review')).toBeVisible({ timeout: 60_000 });
  const frame = await openSeo(page);
  await expect(frame.getByRole('heading', { name: UI.site.heading })).toBeVisible();
  await expect(frame.getByText(UI.site.otherTemplate)).toBeVisible();
  await expect(frame.getByText('Every Product')).toHaveCount(0);

  const response = await page.request.get(
    `./canvas-metatag/api/state?entity_type=content_template&id=node.product.teaser&preview=${product.id}`,
  );
  expect(response.status()).toBe(404);

  // The Full template route of a type that has none: says so, and the way out.
  await page.goto('./canvas/template/node/venue/full');
  const venue = await openSeo(page);
  await expect(venue.getByRole('heading', { name: UI.site.heading })).toBeVisible();
  await expect(venue.getByText(UI.site.noFullTemplate)).toBeVisible();
  await expect(venue.getByText(UI.site.otherTemplate)).toHaveCount(0);
  expect(((await response.json()) as { error: { code: string } }).error.code).toBe('not_found');
  const state = await seoState(page, `entity_type=content_template&id=node.product.full&preview=${product.id}`);
  expect(state.resolved?.head.title).toBe(`${product.title} | ${SITE_NAME}`);
});

test('publishing the Event template makes its draft live for every event', async ({ drupal, page, visitor }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  await publishAll(page);
  for (const node of [event, eventHidden]) {
    expect((await readHead(visitor, node.path)).titles).toEqual([`${node.title} | ${ending.draft}`]);
  }
});
