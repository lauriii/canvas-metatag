import AxeBuilder from '@axe-core/playwright';
import type { FrameLocator, Locator, Page } from '@playwright/test';

import { COMPLEX, SITE_NAME, TEST_ID, UI, USERS } from './constants';

// cspell:ignore ביצים ברוטב Perfo
import {
  SEO_IFRAME,
  button,
  closeReview,
  expect,
  link,
  openSeo,
  openTemplate,
  outputRows,
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
  articleMixed,
  event,
  eventHidden,
  eventLong,
  eventUnpublished,
  job,
  personOmar,
  product,
  productRtl,
  recipe,
  recipeRtl,
  announcement,
  ending,
} = COMPLEX;

/** The description's link menu. */
const linkMenuOf = (frame: FrameLocator) => frame.getByRole('dialog', { name: `Link ${UI.field.description}` });

/** Opens the link menu of the description, which follows its default. */
async function linkMenu(frame: FrameLocator) {
  await button(frame, UI.action.changeLink(UI.field.description)).click();
  const menu = linkMenuOf(frame);
  await expect(menu).toBeVisible();
  return menu;
}

/** The box of a value that is linked or follows its default. */
const box = (frame: FrameLocator, label: string) => frame.getByRole('combobox', { name: label, exact: true });

/**
 * The open value menu is inside the dialog's frame, shows at least two
 * entries whole and, in a short frame, no keyboard hints.
 */
async function expectMenuFits(page: Page, frame: FrameLocator) {
  // Measured once it has grown in: its entrance scales it.
  await frame.locator('.seo-menu').evaluate((menu) => Promise.all(menu.getAnimations({ subtree: true }).map((one) => one.finished)));
  const box = (await page.locator(SEO_IFRAME).boundingBox())!;
  const menu = (await frame.locator('.seo-menu').boundingBox())!;
  expect(menu.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(menu.y + menu.height).toBeLessThanOrEqual(box.y + box.height + 1);
  expect(menu.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(menu.x + menu.width).toBeLessThanOrEqual(box.x + box.width + 1);
  const whole = await frame.locator('.seo-menu-list').evaluate((list) => {
    const view = list.getBoundingClientRect();
    return [...list.querySelectorAll('[role="option"]')].filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.top >= view.top - 0.5 && rect.bottom <= view.bottom + 0.5;
    }).length;
  });
  expect(whole).toBeGreaterThanOrEqual(2);
  await expect(frame.locator('.seo-menu-hint')).toBeHidden();
  // In a short frame it starts at the column's left edge and is as wide as
  // the column: no word of the header shows beside it.
  const [edge, width] = await frame.locator('.seo-menu').evaluate((element) => {
    const body = element.ownerDocument.querySelector('.seo-frame > .seo-body')!;
    const style = getComputedStyle(body);
    const left = body.getBoundingClientRect().left + parseFloat(style.paddingLeft);
    const column = body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // Its layout width: the entrance animation may transform its box.
    return [Math.abs(element.getBoundingClientRect().left - left), Math.abs((element as HTMLElement).offsetWidth - column)];
  });
  expect(edge).toBeLessThanOrEqual(1);
  expect(width).toBeLessThanOrEqual(1);
  // Its list goes on below, and shows it: its end fades, until the end, and
  // the next entry shows a sliver above the fade.
  const list = frame.locator('.seo-menu-list');
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(true);
  await expect(list).toHaveAttribute('data-more', '');
  const peek = await list.evaluate((element) => {
    const bottom = element.getBoundingClientRect().bottom;
    const items = [...element.querySelectorAll('[role="option"]')].map((item) => item.getBoundingClientRect());
    const next = items.find((item) => item.bottom > bottom + 0.5);
    return {
      peek: next ? bottom - next.top : 0,
      list: element.getBoundingClientRect().height,
      items: items.slice(0, 4).map((item) => [Math.round(item.top), Math.round(item.height)]),
    };
  });
  expect(peek.peek, JSON.stringify(peek)).toBeGreaterThanOrEqual(12);
  await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(list).not.toHaveAttribute('data-more');
  await list.evaluate((element) => element.scrollTo({ top: 0 }));
  await expect(list).toHaveAttribute('data-more', '');
}

/**
 * Waits until Canvas has fitted its dialog to a resized window: the frame's
 * height has stopped changing. A menu opened before would close when the
 * frame crosses 420 px.
 */
async function settled(frame: FrameLocator) {
  let last = -1;
  await expect
    .poll(async () => {
      const now = await frame.locator('body').evaluate(() => window.innerHeight);
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [300] })
    .toBe(true);
  return last;
}

/** The entry the arrows make active is never under the list's end fade. */
async function expectActiveClear(frame: FrameLocator) {
  await expect
    .poll(() =>
      frame.locator('.seo-menu-list').evaluate((list) => {
        const item = list.querySelector('[data-active]');
        return (
          !!item &&
          (!list.hasAttribute('data-more') ||
            item.getBoundingClientRect().bottom <= list.getBoundingClientRect().bottom - 24 + 0.5)
        );
      }),
    )
    .toBe(true);
}

/** Switches the template editor's preview to another node of the type. */
async function previewNode(page: Page, bundle: string, node: { id: number; title: string }): Promise<void> {
  // By keyboard: a long previewed title lets Canvas's top bar cover the
  // picker's button.
  await page.getByTestId('select-content-preview-item').press('Enter');
  await page.getByRole('menuitem', { name: node.title }).click();
  await expect(page).toHaveURL(new RegExp(`/canvas/template/node/${bundle}/full/${node.id}$`));
  // Until Canvas's menu has gone, its page takes no pointer events: a click
  // into the dialog right after would be lost.
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).pointerEvents)).not.toBe('none');
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
  await expect(button(frame, UI.field.titleEnding)).toHaveAccessibleName(`Title ending: ${ending.draft}`);
  await expect(preview).toContainText(`${event.title} | ${ending.draft}`);
  await expect(status(frame)).toContainText(UI.footer.draftTemplate);
  // Only the ending is set: the title's aside says so, and its Reset says
  // what it clears and what it goes back to.
  const titleField = frame.locator('.seo-field[data-path="title"]');
  await titleField.hover();
  await expect(titleField.locator('.seo-aside')).toContainText('Ending set for every Event');
  const resetEnding = button(frame, 'Reset title ending');
  await resetEnding.hover();
  await expect(frame.locator('.rt-TooltipContent', { hasText: 'Back to the site ending' })).toBeVisible();
  await page.mouse.move(0, 0);

  // The Event's fields come first, each with the previewed event's value: a
  // list gives its label, a reference is a level of its own. The Event's
  // Description and the page's are both offered; an image is not text.
  const menu = await linkMenu(frame);
  await expect(menu.locator('.seo-menu-group')).toHaveText(['Event', 'Page']);
  await expect(menu.getByRole('option', { name: /^Status, / })).toContainText(event.status);
  await expect(menu.getByRole('option', { name: /^Description, / })).toHaveCount(2);
  await menu.getByRole('textbox', { name: 'Find a field' }).fill('Poster › Image');
  await expect(menu.getByRole('option', { name: /^Poster › Image, / })).toHaveAttribute('aria-disabled', 'true');
  await menu.getByRole('textbox', { name: 'Find a field' }).fill('');
  await menu.getByRole('option', { name: /^Venue, / }).click();
  await expect(menu.getByRole('heading', { name: 'Venue' })).toBeVisible();
  await expect(menu.getByRole('option', { name: /^Title, / })).toContainText(event.venue);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(box(frame, UI.field.description)).toHaveAccessibleDescription(/^Follows the default: each event's description\./);

  // Opened by keyboard, it takes the side with room for three entries.
  await box(frame, UI.field.description).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(menu).toBeVisible();
  await menu.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((one) => one.finished)));
  const whole = await menu.locator('.seo-menu-list').evaluate((list) => {
    const view = list.getBoundingClientRect();
    return [...list.querySelectorAll('[role="option"]')].filter((item) => {
      const rect = item.getBoundingClientRect();
      return rect.top >= view.top - 0.5 && rect.bottom <= view.bottom + 0.5;
    }).length;
  });
  expect(whole).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // The pointer on the last rows of a list scrolled to its end never scrolls
  // it: the row under the pointer stays the one a click links.
  await box(frame, UI.field.title).click();
  const titleMenu = frame.getByRole('dialog', { name: `Link ${UI.field.title}` });
  await expect(titleMenu).toBeVisible();
  const list = titleMenu.locator('.seo-menu-list');
  await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  const scrolled = await list.evaluate((element) => element.scrollTop);
  const options = titleMenu.getByRole('option');
  const count = await options.count();
  for (const at of [count - 1, count - 2, count - 3]) {
    await options.nth(at).hover();
  }
  expect(await list.evaluate((element) => element.scrollTop)).toBe(scrolled);
  await page.keyboard.press('Escape');
  await expect(titleMenu).toBeHidden();
  // What does not fit waits in the last row; it opens as a level with its
  // reasons, and Left goes back.
  await linkMenu(frame);
  const fold = menu.getByRole('option', { name: /fields that (can't be linked here|aren't text)$/ });
  await fold.click();
  await expect(menu.getByRole('heading', { name: "Can't be linked here" })).toBeVisible();
  await expect(menu.getByRole('option', { name: /^Poster › Image, An image, not text/ })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(menu.getByRole('heading', { name: "Can't be linked here" })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Structured data: a linked date shows the event's date at rest, the menu
  // tells Starts and Ends apart by their dates, and the status shows its
  // label. A choice fits only its list field.
  await tab(frame, UI.tab.schema).click();
  const starts = box(frame, 'Starts');
  await expect(starts).toContainText(/\d{4}/);
  await frame.getByRole('tab', { name: UI.tab.schema }).focus();
  await expect(starts).toContainText(/\d{4}/);
  await starts.click();
  const dates = frame.getByRole('dialog', { name: 'Link Starts' });
  await expect(dates.getByRole('option', { name: /^Starts, .*\d{4}/ })).toHaveCount(1);
  await expect(dates.getByRole('option', { name: /^Ends, .*\d{4}/ })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(starts).toBeFocused();
  const status_ = box(frame, 'Status');
  await expect(status_).toContainText(event.status);
  await status_.click();
  const choices = frame.getByRole('dialog', { name: 'Link Status' });
  await expect(choices.locator('[role="option"]:not([aria-disabled])').first()).toHaveAccessibleName(new RegExp(`^Status, ${event.status}`));
  await expect(choices.getByRole('option', { name: /^Unlink, Choose an option instead/ })).toHaveCount(1);
  await page.keyboard.press('Escape');
  // Low on the tab, the Status menu opens above its box and lists every
  // entry, the fold row included, whole; at 600 px too.
  for (const height of [900, 600]) {
    await page.setViewportSize({ width: 1440, height });
    await status_.scrollIntoViewIfNeeded();
    await status_.click();
    const listed = await choices.locator('.seo-menu-list').evaluate((list) => {
      const view = list.getBoundingClientRect();
      const options = [...list.querySelectorAll('[role="option"]')];
      return [options.length, options.filter((item) => item.getBoundingClientRect().bottom <= view.bottom + 0.5 && item.getBoundingClientRect().top >= view.top - 0.5).length];
    });
    expect(listed[1], JSON.stringify(listed)).toBeGreaterThanOrEqual(Math.min(3, listed[0]));
    await page.screenshot({ path: test.info().outputPath(`status-menu-1440x${height}.png`) });
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  // The venue's name and street, in its sheet: each box shows its path over
  // its value, the path giving way from its start so the field it ends at
  // stays whole, and focus never changes it.
  await frame.locator('.seo-group[data-path="schema.props.location"] .seo-group-box').click();
  const venueSheet = sheet(frame, 'Venue');
  const pair = [venueSheet.getByRole('combobox', { name: 'Name', exact: true }), box(frame, 'Street address')];
  for (const linked of pair) {
    const tag = linked.locator('.seo-linked-tag');
    await expect(tag).toContainText(/^Venue › /);
    const leaf = tag.locator('.seo-linked-leaf');
    expect(await leaf.evaluate((element) => [getComputedStyle(element).whiteSpace, element.scrollWidth <= element.clientWidth])).toEqual(['nowrap', true]);
    const rest = (await linked.boundingBox())!.height;
    await linked.focus();
    expect((await linked.boundingBox())!.height).toBe(rest);
  }
  // Delete on Street address, then typing at once: the typed text.
  await box(frame, 'Street address').press('Delete');
  await page.keyboard.type('Main street 1');
  await expect(textbox(frame, 'Street address')).toHaveValue('Main street 1');
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.type('Street address');
  await page.keyboard.press('Enter');
  await expect(box(frame, 'Street address')).toHaveAccessibleDescription(/^Linked to Event › Venue › Street address\. /);
  // Street address opens in the Venue level, on its current entry; Back to
  // Event returns to the top.
  await box(frame, 'Street address').click();
  const street = frame.getByRole('dialog', { name: 'Link Street address' });
  await expect(street.getByRole('heading', { name: 'Venue' })).toBeVisible();
  await expect(street.locator('[data-active]')).toHaveAccessibleName(/^Street address, /);
  await street.getByRole('option', { name: 'Back to Event' }).click();
  await expect(street.getByRole('option', { name: /^Venue, / })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await button(frame, UI.action.back).click();
  await tab(frame, UI.tab.search).click();

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
  const menu = await linkMenu(frame);
  await menu.getByRole('option', { name: /^Venue, / }).click();
  const venueTitle = menu.getByRole('option', { name: /^Title, / });
  await expect(venueTitle).toContainText('Hidden from visitors for this event');
  await expect(venueTitle).not.toHaveAttribute('aria-disabled');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  // An image hidden for this event: the social image is linked to Poster ›
  // Image, and this event's poster is unpublished. The row says so, and what
  // is used instead; the Schema tab's image says the same.
  await tab(frame, UI.tab.social).click();
  const socialImage = frame.locator('.seo-field[data-path="social.image"]');
  await expect(socialImage.locator('.seo-image-tag')).toHaveText('Poster › Image');
  await expect(socialImage.locator('.seo-image-name > [data-state]')).toHaveText('Hidden from visitors for this event');
  await expect(socialImage.locator('.seo-guide')).toHaveText(/^So .+ (is used|is shared)\.$/);
  // Its link goes with its ×, as a box's does; there is no Reset beside it.
  await expect(button(frame, 'Unlink image')).toBeVisible();
  await tab(frame, UI.tab.schema).click();
  const schemaImage = frame.locator('.seo-field[data-path="schema.props.image"]');
  await expect(schemaImage.locator('.seo-image-tag')).toHaveText('Poster › Image');
  await expect(schemaImage.locator('.seo-image-name > [data-state]')).toHaveText('Hidden from visitors for this event');
  // A box linked through the hidden venue says so for this event, and the
  // field says what that means once, in the venue's sheet.
  await frame.locator('.seo-group[data-path="schema.props.location"] .seo-group-box').click();
  const street = frame.locator('.seo-field[data-path="schema.props.location_address_streetAddress"]');
  await expect(street.locator('.seo-linked-value')).toHaveText('Hidden from visitors for this event');
  await expect(street.locator('.seo-guide')).toHaveText('So the detail is left out.');
  await page.screenshot({ path: test.info().outputPath('hidden-venue-schema.png'), fullPage: true });
  await button(frame, UI.action.back).click();
  // The read-back says what ships: a web page, not "Add".
  await expect(frame.getByRole('region', { name: UI.schema.stage })).toContainText('a web page of');
  await tab(frame, UI.tab.search).click();
  // Checks say what visitors miss: the venue's name and street are hidden.
  await button(frame, UI.tab.checks).click();
  await expect(sheet(frame, 'Checks').getByText(/hidden from visitors/i).first()).toBeVisible({ timeout: 60_000 });
  await button(frame, UI.action.back).click();

  // A title near the limit: Checks asks to shorten it.
  await previewNode(page, 'event', { id: eventLong.id, title: eventLong.title });
  await expect(caption).toContainText(eventLong.title);
  await button(frame, UI.tab.checks).click();
  await expect(sheet(frame, 'Checks').getByText(UI.checks.titleLong).first()).toBeVisible({ timeout: 60_000 });
  const checks = sheet(frame, 'Checks');
  // The node is named once, on one line, whole on hover; the issues say
  // "this event".
  const against = checks.locator('.seo-checks-against');
  await expect(against).toContainText(`Checked against ${eventLong.title.slice(0, 20)}`);
  expect(
    await against.evaluate((element) => [
      getComputedStyle(element).textOverflow,
      element.scrollWidth > element.clientWidth,
    ]),
  ).toEqual(['ellipsis', true]);
  const name = (await against.getAttribute('title')) ?? '';
  expect(name.startsWith(eventLong.title)).toBe(true);
  expect(Array.from(name)).toHaveLength(247);
  const height = await against.evaluate((element) => [
    element.getBoundingClientRect().height,
    parseFloat(getComputedStyle(element).lineHeight),
  ]);
  expect(height[0]).toBeLessThanOrEqual(height[1] + 1);
  for (const text of await checks.locator('.seo-checks-group').allInnerTexts()) {
    expect(text).not.toContain(eventLong.title);
  }
  await checks.screenshot({ path: test.info().outputPath('checks-event-long.png') });
  await button(frame, UI.action.back).click();

  // Another node while the view is scrolled down: the view opens at its top,
  // and nothing says the dialog edits something new.
  await tab(frame, UI.tab.schema).click();
  const view = frame.locator('.seo-body').first();
  await view.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await view.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  // What the status region says, from before the switch until after it.
  // Nor does anything warn or lock: the editor's brief "no draft stored yet"
  // after a switch shows no strip and disables no field.
  type Seen = HTMLElement & {
    nowEditing?: boolean;
    alert?: boolean;
    locked?: boolean;
    loading?: boolean;
    moved?: boolean;
    said?: string[];
  };
  const spoken = `[data-testid="${TEST_ID.status}"] .seo-visually-hidden`;
  await frame.locator('body').evaluate((body, selector) => {
    const seen = body as Seen;
    seen.nowEditing = false;
    seen.alert = false;
    seen.locked = false;
    seen.loading = false;
    seen.moved = false;
    seen.said = [];
    const region = body.querySelector(selector)!;
    const tabs = body.querySelector('.seo-tabs')!;
    const x = tabs.getBoundingClientRect().x;
    const fields = '.seo-field textarea, .seo-field input';
    const disabled = () => body.querySelectorAll(`.seo-field textarea:disabled, .seo-field input:disabled`).length;
    const before = disabled();
    new MutationObserver(() => {
      seen.nowEditing ||= (body.textContent ?? '').includes('Now editing');
      seen.alert ||= body.querySelector('[role="alert"]') !== null;
      seen.locked ||= body.querySelector(fields) !== null && disabled() > before;
      // The view stays as it was: no loading placeholder, no tab moving.
      seen.loading ||= body.querySelector('.seo-loading') !== null;
      seen.moved ||= !tabs.isConnected || tabs.getBoundingClientRect().x !== x;
    }).observe(body, { childList: true, subtree: true, characterData: true, attributes: true });
    new MutationObserver(() => {
      seen.said!.push(region.textContent ?? '');
    }).observe(region, { childList: true, subtree: true, characterData: true });
  }, spoken);
  const before = await frame.locator(spoken).textContent();
  await previewNode(page, 'event', eventUnpublished);
  await expect(caption).toContainText(eventUnpublished.title);
  await expect(tab(frame, UI.tab.schema)).toHaveAttribute('aria-selected', 'true');
  expect(await view.evaluate((element) => element.scrollTop)).toBe(0);
  const firstField = frame.locator('.seo-field:visible').first();
  const top = async () => (await firstField.boundingBox())!.y;
  const settledTop = await top();
  await frame.locator('body').screenshot({ path: test.info().outputPath('preview-switch-at-once.png') });
  // Once the editor has stored the new node, the status is what it was, and
  // it never changed on the way.
  // (On the Schema tab: the Search tab's ending is there, hidden.)
  await expect(frame.locator('.seo-field[data-path="title"] .seo-ending-btn')).toBeEnabled({ timeout: 30_000 });
  await page.waitForTimeout(2_500);
  expect(await top()).toBe(settledTop);
  await frame.locator('body').screenshot({ path: test.info().outputPath('preview-switch-after-2.5s.png') });
  const seen = await frame.locator('body').evaluate((body) => {
    const { nowEditing, alert, locked, loading, moved, said } = body as Seen;
    return { nowEditing, alert, locked, loading, moved, said };
  });
  expect(seen).toEqual({ nowEditing: false, alert: false, locked: false, loading: false, moved: false, said: [] });
  expect(await frame.locator(spoken).textContent()).toBe(before);

  // A change typed at once after a switch, before Canvas has stored the new
  // node's draft, reaches the template's draft: a key typed on the box
  // replaces the default with typed text.
  const draft = async () =>
    (await seoState(page, `entity_type=content_template&id=node.event.full&preview=${event.id}`)).target?.values
      .description;
  await tab(frame, UI.tab.search).click();
  await previewNode(page, 'event', event);
  await box(frame, UI.field.description).press('A');
  await page.keyboard.type(' change during the switch');
  await expect(textbox(frame, UI.field.description)).toHaveValue('A change during the switch');
  await expect.poll(draft, { timeout: 30_000 }).toEqual({ text: 'A change during the switch' });
  await button(frame, `Reset ${UI.field.description}`).click();
  await expect.poll(draft, { timeout: 30_000 }).toBeUndefined();
});

test('on a long event the link menu works by keyboard in a short window, long values stay short at rest', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, eventLong.id, 'event');
  const frame = await openSeo(page);
  const description = box(frame, UI.field.description);
  // A long title gives way in the one-line box; its tag stays whole.
  const titleTag = box(frame, UI.field.title).locator('.seo-linked-tag');
  await expect(titleTag).toHaveText('Default');
  expect(await titleTag.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(button(frame, UI.field.titleEnding)).toHaveAccessibleName(`Title ending: ${ending.draft}`);
  await page.setViewportSize({ width: 1440, height: 350 });
  expect(await settled(frame)).toBeLessThanOrEqual(420);

  // The search preview cuts the long title as a result list would, ending
  // and all: the head keeps the ending whole only past 255 characters.
  const shown = (await frame.getByTestId(TEST_ID.search).locator('.seo-result-title').innerText()).trim();
  expect(shown.startsWith(eventLong.title.slice(0, 40))).toBe(true);
  expect(shown.endsWith('…')).toBe(true);

  // Alt+Down on the box opens its menu; the filter takes the keys.
  await description.focus();
  await page.keyboard.press('Alt+ArrowDown');
  const menu = linkMenuOf(frame);
  await expect(menu).toBeVisible();
  const filter = menu.getByRole('textbox', { name: 'Find a field' });
  await expect(filter).toBeFocused();
  await page.keyboard.type('Desc');
  // The arrows move through the matches, the type's fields first; the active
  // one stays in sight.
  const active = () =>
    filter.evaluate((element) => {
      const id = element.getAttribute('aria-activedescendant');
      return id ? (element.ownerDocument.getElementById(id)?.firstElementChild?.textContent ?? '') : '';
    });
  await expect.poll(active).toBe('Description');
  await page.keyboard.press('ArrowDown');
  await expect.poll(active).toBe('Description › Summary');
  await expect(menu.getByRole('option', { name: /^Description › Summary/ })).toBeInViewport();

  // The 6 KB body is read as a short excerpt; its name carries the label and
  // at most 150 characters.
  const entry = menu.getByRole('option', { name: /^Description, / }).first();
  await expect(entry).toHaveAccessibleName(/^Description, .{0,150}…?$/su);
  const body = entry.locator('span').last();
  await expect(body).toHaveAttribute('title', /^Each work is introduced by the musicians who play it/);
  expect(((await body.getAttribute('title')) ?? '').length).toBeLessThanOrEqual(160);
  expect(await body.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(2 * 16 + 1);

  // The menu stays inside the dialog's frame, in a window 350 px high.
  const frameBox = (await page.locator(SEO_IFRAME).boundingBox())!;
  const popover = (await frame.locator('.seo-menu').boundingBox())!;
  expect(popover.y).toBeGreaterThanOrEqual(frameBox.y - 1);
  expect(popover.y + popover.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 1);
  await page.screenshot({ path: test.info().outputPath('link-menu-1440x350.png') });

  // No serious accessibility violation with the menu open.
  const { violations } = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
  expect(
    violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`),
  ).toEqual([]);

  // Escape leaves the menu: back on the box, which follows its default, and
  // nothing is written.
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(description).toBeFocused();
  await expect(description).toHaveAccessibleDescription(/^Follows the default: each event's description\./);
  await expect(status(frame)).toContainText(UI.footer.draftTemplate);
});

test('in a short window the link menu shows its values', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  const description = box(frame, UI.field.description);
  await expect(description).toBeEnabled();
  const menu = linkMenuOf(frame);
  const frameHeight = () => frame.locator('body').evaluate(() => window.innerHeight);
  for (const height of [350, 420]) {
    await page.setViewportSize({ width: 1440, height });
    expect(await settled(frame)).toBeLessThanOrEqual(420);
    await tab(frame, UI.tab.search).click();
    await description.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(menu).toBeVisible();
    await expectMenuFits(page, frame);
    // Its filter says what it finds, on screen and to assistive technology.
    await expect(menu.getByRole('textbox', { name: 'Find a field' })).toHaveAttribute('placeholder', 'Find a field');
    await page.screenshot({ path: test.info().outputPath(`link-menu-description-1440x${height}.png`) });
    // The arrows never leave the active entry under the fade.
    for (let step = 0; step < 3; step++) {
      await page.keyboard.press('ArrowDown');
      await expectActiveClear(frame);
    }
    await page.screenshot({ path: test.info().outputPath(`link-menu-arrows-1440x${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(description).toBeFocused();

    // A link chosen by keyboard: the box takes the next keys at once.
    // Backspace unlinks into an empty input; Reset returns to the default.
    await page.keyboard.press('Alt+ArrowDown');
    await page.keyboard.type('Perfo');
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(description).toBeFocused();
    await expect(description).toHaveAccessibleDescription(/^Linked to Event › Performers › /);
    await page.keyboard.press('Backspace');
    await expect(textbox(frame, UI.field.description)).toBeFocused();
    await expect(textbox(frame, UI.field.description)).toHaveValue('');
    // In the empty input, `{` opens the menu; Escape, then a key at once,
    // types it.
    await page.keyboard.type('{');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.type('x');
    await expect(textbox(frame, UI.field.description)).toHaveValue('x');
    await page.keyboard.press('Backspace');
    await textbox(frame, UI.field.description).blur();
    await expect(description).toHaveAccessibleDescription(/^Follows the default: each event's description\./);

    // The link button of a field in the right-hand column. A double-click
    // opens the menu and links nothing: an entry under a still pointer
    // neither takes the second click nor becomes the active one.
    await tab(frame, UI.tab.schema).click();
    await frame.locator('.seo-group[data-path="schema.props.location"] .seo-group-box').click();
    const street = frame.locator('.seo-field[data-path="schema.props.location_address_streetAddress"]');
    await street.locator('[data-link]').click();
    await expect(menu.or(frame.getByRole('dialog', { name: 'Link Street address' }))).toBeVisible();
    await expectMenuFits(page, frame);
    await page.screenshot({ path: test.info().outputPath(`link-menu-street-1440x${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(frame.locator('.seo-menu')).toHaveCount(0);
    const said = street.locator('.seo-linked > span[hidden]');
    const linkedTo = await said.textContent();
    await street.locator('[data-link]').dblclick();
    await expect(frame.locator('.seo-menu')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(said).toHaveText(linkedTo!);
    await expect(frame.locator('.seo-menu [data-active]')).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath(`link-menu-street-dblclick-1440x${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(frame.locator('.seo-menu')).toHaveCount(0);
    // The same on the box, as two presses of a still pointer: the menu that
    // opens over it takes neither.
    const streetBox = (await box(frame, 'Street address').boundingBox())!;
    const [x, y] = [streetBox.x + streetBox.width / 2, streetBox.y + streetBox.height / 2];
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
    await expect(frame.locator('.seo-menu')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(said).toHaveText(linkedTo!);
    await expect(frame.locator('.seo-menu [data-active]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(frame.locator('.seo-menu')).toHaveCount(0);
    await button(frame, UI.action.back).click();
  }

  // In a window 1440 x 900: the filter says "Find a field" and typing does
  // not move it; "Perfo" finds the performer's name first, Enter links it
  // and Backspace at once unlinks. From the title's box, Escape and at once
  // Alt+Down opens the menu again.
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await settled(frame)).toBeGreaterThan(420);
  await tab(frame, UI.tab.search).click();
  await description.focus();
  await page.keyboard.press('Alt+ArrowDown');
  const finder = menu.getByRole('textbox', { name: 'Find a field' });
  await expect(finder).toHaveAttribute('placeholder', 'Find a field');
  const filterTop = async () => (await finder.boundingBox())!.y;
  // Once it has grown in: its entrance scales it.
  await frame.locator('.seo-menu').evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((one) => one.finished)));
  const before = await filterTop();
  await page.keyboard.type('Perfo');
  await expect(menu.getByRole('option').first()).toHaveAccessibleName(/^Performers › Title, /);
  expect(await filterTop()).toBe(before);
  await page.keyboard.press('Enter');
  await expect(description).toHaveAccessibleDescription(/^Linked to Event › Performers › Title\. /);
  await page.keyboard.press('Backspace');
  await expect(textbox(frame, UI.field.description)).toBeFocused();
  await textbox(frame, UI.field.description).blur();
  // Enter on the box opens its menu; Escape, then Backspace at once, reaches
  // the box: an empty input in its place.
  await description.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backspace');
  await expect(textbox(frame, UI.field.description)).toBeFocused();
  await expect(textbox(frame, UI.field.description)).toHaveValue('');
  await textbox(frame, UI.field.description).blur();
  const titleBox = box(frame, UI.field.title);
  await titleBox.click();
  const titleMenu = frame.getByRole('dialog', { name: `Link ${UI.field.title}` });
  await expect(titleMenu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(titleBox).toBeFocused();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(titleMenu).toBeVisible();
  await expect(titleMenu.getByRole('textbox', { name: 'Find a field' })).toBeFocused();
  await page.keyboard.press('Escape');
  // Opened again by Enter after an Escape, the menu takes the keys: the
  // filter has focus and the box keeps its value.
  await page.keyboard.press('Enter');
  await expect(titleMenu.getByRole('textbox', { name: 'Find a field' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('s');
  await expect(titleMenu.getByRole('textbox', { name: 'Find a field' })).toHaveValue('s');
  await page.keyboard.press('Escape');
  await expect(titleBox).toHaveAccessibleDescription(/^Follows the default: each event's title\./);

  // The menu's place is chosen once: a frame resized across 420 px while it
  // is open closes it, back on the box, which holds what it held.
  await tab(frame, UI.tab.search).click();
  for (const [from, to] of [
    [350, 900],
    [900, 350],
  ]) {
    await page.setViewportSize({ width: 1440, height: from });
    expect((await settled(frame)) <= 420).toBe(from <= 420);
    await description.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(menu).toBeVisible();
    await page.setViewportSize({ width: 1440, height: to });
    // At once once the frame has crossed 420 px, with no exit animation
    // left where it no longer fits.
    await expect.poll(async () => (await frameHeight()) <= 420).toBe(to <= 420);
    await expect(menu).toBeHidden({ timeout: 1000 });
    await expect(description).toBeFocused();
    await expect(description).toHaveAccessibleDescription(/^Follows the default: each event's description\./);
  }

  // From the link button of a field never focused, Escape hands focus back
  // to the button.
  await page.setViewportSize({ width: 1440, height: 900 });
  await frame.locator('.seo-scope').focus();
  const opener = button(frame, UI.action.changeLink(UI.field.description));
  await opener.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(opener).toBeFocused();
  // The last change, unlinking, keeps its Undo on offer; the draft is saved.
  await expect(status(frame)).toContainText(new RegExp(`${UI.footer.draftTemplate}|^Unlinked`), { timeout: 30_000 });
});

test('a job posting: its group is named in the menu, its square logo makes a small card everywhere', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.editor);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTemplate(page, job.id, 'job_posting');
  const frame = await openSeo(page);
  // At Canvas's dialog width the Checks text gives way ("● 2"), so that the
  // type's name is whole; a wider frame has room for both.
  const scopeName = frame.locator('.seo-scope-name');
  await expect(scopeName).toHaveText('Every Job posting');
  const checksButton = button(frame, UI.tab.checks);
  await expect(checksButton).toBeVisible();
  const whole = () => scopeName.evaluate((name) => name.scrollWidth <= name.clientWidth);
  await expect.poll(whole).toBe(true);
  await expect(checksButton.locator('.seo-checks-long')).toBeHidden();
  await expect(checksButton.locator('.seo-checks-short')).toBeVisible();
  await expect(checksButton.locator('.seo-checks-short')).toHaveText('2');
  // The number the long form gives, and a tooltip that says it.
  const long = (await checksButton.locator('.seo-checks-long').textContent()) ?? '';
  expect(long.split(' ')[0]).toBe('2');
  await checksButton.hover();
  await expect(frame.getByRole('tooltip')).toHaveText('2 to improve');
  await frame.locator('.seo-scope').hover();
  const checksName = await checksButton.getAttribute('aria-label');
  expect(checksName).toMatch(/^Checks, /);
  await frame.locator('.seo-header').screenshot({ path: test.info().outputPath('job-header-468.png') });
  await page.locator(SEO_IFRAME).evaluate((element) => {
    (element as HTMLElement).style.width = '600px';
  });
  await expect(checksButton.locator('.seo-checks-long')).toBeVisible();
  await expect(checksButton).toHaveAccessibleName(checksName!);
  expect(await whole()).toBe(true);
  // The long form says it all: no tooltip repeats it.
  await checksButton.hover();
  await page.waitForTimeout(1000);
  await expect(frame.getByRole('tooltip')).toHaveCount(0);
  await frame.locator('.seo-scope').hover();
  await page.locator(SEO_IFRAME).evaluate((element) => {
    (element as HTMLElement).style.width = '';
  });
  await expect(checksButton.locator('.seo-checks-long')).toBeHidden();

  // A group whose label has a space is named by it, on screen and to
  // assistive technology: its options are told apart from the page's.
  const menu = await linkMenu(frame);
  await expect(menu.locator('.seo-menu-group', { hasText: 'Job posting' })).toBeVisible();
  await expect(menu.getByRole('group', { name: 'Job posting' })).toBeVisible();
  await expect(menu.getByRole('group', { name: 'Page' }).getByRole('option', { name: /^Description, / })).toHaveCount(1);
  await expect(menu.getByRole('group', { name: 'Job posting' }).getByRole('option', { name: /^Description, / })).toHaveCount(1);
  const { violations } = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
  expect(
    violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // A 400 x 400 logo: a small card in the link preview and in the head.
  await tab(frame, UI.tab.social).click();
  const card = frame.getByTestId(TEST_ID.social);
  await expect(card).toHaveAttribute('data-layout', 'compact');
  // The caption says it is small; its information says why.
  const socialStage = frame.locator('.seo-stage', { has: card });
  await expect(socialStage.locator('.seo-stage-cap-l')).toHaveText(/^Link preview\s*· Small card$/);
  const about = socialStage.getByRole('button', { name: 'About this preview' });
  await expect(about).toHaveAttribute('aria-description', 'Small card: image under 600 px wide.');
  // Its tip opens below the caption, never over the header and its tabs.
  await about.click();
  const tipBox = frame.locator('.rt-TooltipContent', { hasText: 'Small card: image under 600 px wide.' });
  await expect(tipBox).toBeVisible();
  expect((await tipBox.boundingBox())!.y).toBeGreaterThanOrEqual((await about.boundingBox())!.y + 10);
  await frame.locator('body').screenshot({ path: test.info().outputPath('social-tip-below.png') });
  await about.click();
  await expect(tipBox).toHaveCount(0);
  // A square thumbnail, and a card no taller than it.
  const thumb = (await card.locator('.seo-social-image').boundingBox())!;
  expect(Math.abs(thumb.width - thumb.height)).toBeLessThanOrEqual(1);
  expect((await card.boundingBox())!.height).toBeLessThanOrEqual(thumb.height + 1);
  await card.screenshot({ path: test.info().outputPath('social-small-card.png') });
  // At 200 % zoom, a frame half as wide: the caption and the host end in an
  // ellipsis rather than mid-word, and the value menu leaves out its hints.
  await page.locator(SEO_IFRAME).evaluate((element) => {
    (element as HTMLElement).style.width = '234px';
  });
  // A caption's addition shows whole or not at all.
  const shownWhole = (locator: Locator) =>
    locator.evaluate((element) =>
      [...element.children]
        .filter((part) => part.tagName !== 'EM' && getComputedStyle(part).display !== 'none')
        .every((part) => part.scrollWidth <= part.clientWidth),
    );
  await expect.poll(() => shownWhole(socialStage.locator('.seo-stage-cap-l'))).toBe(true);
  const host = card.locator('.seo-social-host');
  expect(await host.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(17);
  expect(await host.evaluate((element) => getComputedStyle(element).textOverflow)).toBe('ellipsis');
  await frame.locator('body').screenshot({ path: test.info().outputPath('social-zoom-200.png') });
  // The search caption keeps the previewed node's name; what is cut ends in
  // an ellipsis.
  await tab(frame, UI.tab.search).click();
  const caption = frame.locator('.seo-stage-cap-l').first();
  expect(await caption.locator('em').evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(0);
  const cut = await caption.evaluate((element) =>
    [...element.children]
      .filter((part) => part.scrollWidth > part.clientWidth)
      .map((part) => getComputedStyle(part).textOverflow),
  );
  expect(cut.every((overflow) => overflow === 'ellipsis')).toBe(true);
  expect(await shownWhole(caption)).toBe(true);
  await caption.screenshot({ path: test.info().outputPath('search-caption-zoom-200.png') });
  const zoomed = await linkMenu(frame);
  await expect(frame.locator('.seo-menu-hint')).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('value-menu-zoom-200.png') });
  await page.keyboard.press('Escape');
  await expect(zoomed).toBeHidden();
  await page.locator(SEO_IFRAME).evaluate((element) => {
    (element as HTMLElement).style.width = '';
  });
  await button(frame, UI.action.output).click();
  await expect(sheet(frame, 'Output').getByText(UI.output.updating)).toHaveCount(0);
  expect((await outputRows(frame))['twitter:card']).toBe('summary');
});

test('Checks on a product say that its image has no alt text, and its currency is a code', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, product.id, 'product');
  const frame = await openSeo(page);
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(`${product.title} | ${SITE_NAME}`);
  await button(frame, UI.tab.checks).click();
  const panel = sheet(frame, 'Checks');
  await expect(panel.getByText('The social image has no alt text').first()).toBeVisible({ timeout: 60_000 });
  // The currency list gives its key, a currency code: nothing to add.
  await expect(panel.getByText('Add Currency')).toHaveCount(0);
  await button(frame, UI.action.back).click();
  // The inherited social description shows at most three lines at rest, as
  // the search description does.
  await tab(frame, UI.tab.social).click();
  const inherited = frame.getByRole('tabpanel', { name: UI.tab.social }).getByRole('combobox', { name: UI.field.socialDescription, exact: true });
  const [height, line] = await inherited.locator('.seo-linked-value').evaluate((element) => [
    element.getBoundingClientRect().height,
    parseFloat(getComputedStyle(element).lineHeight),
  ]);
  expect(height).toBeLessThanOrEqual(3 * line + 1);
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
  // At Canvas's dialog width the addition is whole or left out, so that
  // only the name may end in an ellipsis: never two on one line. (Here the
  // name is whole once "Not published yet" is left out; the tip says it.)
  await expect
    .poll(() =>
      caption.evaluate((element) =>
        [...element.children]
          // Subpixel rounding may leave 1 px; the caption allows as much.
          .filter((part) => getComputedStyle(part).display !== 'none' && part.scrollWidth > part.clientWidth + 1)
          .map((part) => part.tagName)
          .filter((tag) => tag !== 'EM'),
      ),
    )
    .toEqual([]);
  await caption.screenshot({ path: test.info().outputPath('caption-unpublished-468.png') });
  await expect(frame.getByRole('button', { name: 'About this preview' })).toHaveAttribute(
    'aria-description',
    /^This event isn't published yet\. Its fields are read with your access until visitors can see it\. /,
  );
  await expect(frame.locator('.seo-stage-cap-l', { hasText: 'Link preview' })).toContainText('Not published yet');
  // A click or a tap shows the sentence; a second one hides it, however
  // long after the first, and it stays hidden under the pointer.
  const about = frame.getByRole('button', { name: 'About this preview' });
  const tip = frame.locator('.rt-TooltipContent', { hasText: "This event isn't published yet." });
  await about.click();
  await expect(tip).toBeVisible();
  await page.waitForTimeout(1000);
  await about.click();
  await expect(tip).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(tip).toHaveCount(0);
  await caption.hover();
  await expect(tip).toHaveCount(0);
  // Shown by a resting pointer, a click keeps it; a later click hides it.
  await about.hover();
  await expect(tip).toBeVisible();
  await about.click();
  await page.waitForTimeout(1000);
  await expect(tip).toBeVisible();
  await about.click();
  await expect(tip).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(tip).toHaveCount(0);
  // Kept, it goes when a click lands elsewhere, or another tooltip opens.
  await caption.hover();
  await about.click();
  await expect(tip).toBeVisible();
  await caption.click();
  await expect(tip).toHaveCount(0);
  await about.click();
  await expect(tip).toBeVisible();
  // (Radix ignores the moves after leaving a tip that may be on their way
  // to the tip's text; a hand makes many.)
  const linkButton = frame.locator('[data-link]').first();
  let moves = 0;
  await expect(async () => {
    await linkButton.hover({ position: { x: 2 + (moves++ % 8), y: 6 } });
    await expect(frame.getByRole('tooltip', { name: /^(Link|Change the link for) / })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  await expect(tip).toHaveCount(0);
  await caption.hover();
  // A kept sentence goes when the view scrolls; it would follow its button
  // under the header. (A short window, so that the view scrolls.)
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 1440, height: 500 });
  const view = frame.locator('.seo-body').first();
  await expect.poll(() => view.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await about.click();
  await expect(tip).toBeVisible();
  await view.evaluate((element) => {
    element.scrollTop += 8;
  });
  await expect(tip).toHaveCount(0);
  await page.setViewportSize(size);

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

  // A linked value at rest takes its own direction too: the Arabic
  // product's description, in its box.
  const linkedValue = box(frame, UI.field.description).locator('.seo-linked-value');
  await expect(linkedValue).toHaveAttribute('dir', 'auto');
  expect(await direction(linkedValue)).toBe('rtl');
  // So do the link menu's values.
  await box(frame, UI.field.description).click();
  const entry = linkMenuOf(frame).locator('.seo-menu-item[data-active] > span:last-child');
  await expect(entry).toHaveAttribute('dir', 'auto');
  await page.keyboard.press('Escape');

  // The recipe's description is linked: its box keeps the value's
  // direction; a key on it starts typed text, and a Hebrew value that starts
  // with a digit is laid out right to left. The label is the dialog's own.
  await openTemplate(page, recipeRtl.id, 'recipe');
  frame = await openSeo(page);
  const recipe = box(frame, UI.field.description);
  expect(await direction(recipe.locator('.seo-linked-value'))).toBe('rtl');
  await recipe.press('4');
  const input = textbox(frame, UI.field.description);
  await expect(input).toHaveValue('4');
  await page.keyboard.type(' ביצים ברוטב');
  expect(await direction(input)).toBe('rtl');
  expect(await direction(frame.locator('label', { hasText: /^Description$/ }).first())).toBe('ltr');
  await frame.locator('body').screenshot({ path: test.info().outputPath('input-rtl.png') });

  // A default box takes the direction of the value it shows: the social
  // title of an Arabic name.
  await openTemplate(page, personOmar.id, 'person');
  frame = await openSeo(page);
  await tab(frame, UI.tab.social).click();
  const social = box(frame, UI.field.socialTitle).locator('.seo-linked-value');
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
  // The stored ending, as text: no menu, no link, nothing offered to edit.
  await expect(frame.locator('.seo-ending').first()).toContainText(announcement.ending);
  await expect(button(frame, UI.field.titleEnding)).toHaveCount(0);
  await expect(button(frame, UI.action.changeLink(UI.field.description))).toHaveCount(0);
  await expect(frame.getByTestId(TEST_ID.search)).toHaveCount(0);
  await expect(button(frame, UI.tab.checks)).toHaveCount(0);
  await expect(button(frame, UI.action.output)).toHaveCount(0);
  await expect(frame.getByText(UI.site.hint)).toHaveCount(0);
  await expect(frame.getByText(UI.site.otherTemplate)).toHaveCount(0);
  // A value that follows its default says which, and that there is no
  // announcement to fill it from.
  const atRest = (label: string) => frame.getByRole('group', { name: label, exact: true });
  await expect(atRest(UI.field.description)).toHaveAccessibleDescription(
    /^Follows the default: each announcement's description\. No announcement to preview\./,
  );
  await expect(atRest(UI.field.description)).toContainText('Default');
  // Settings are values at rest: no switch or menu that does not open.
  await expect(frame.getByRole('switch')).toHaveCount(0);
  await expect(frame.locator('.seo-row[data-path="robots.noindex"]')).toContainText('On');
  await button(frame, 'Advanced').click();
  // No select, and no box that opens a menu.
  await expect(frame.getByRole('combobox')).toHaveCount(0);
  await expect(frame.locator('.seo-row[data-path="robots.nosnippet"]')).toContainText('Allowed');
  // The social texts follow their defaults, with nothing to fill them from.
  await tab(frame, UI.tab.social).click();
  await expect(atRest(UI.field.socialTitle)).toHaveAccessibleDescription(/^Follows the default: each announcement's title\. No announcement to preview\./);
  await expect(atRest(UI.field.socialDescription)).toHaveAccessibleDescription(/^Follows the default: the description\. No announcement to preview\./);
  await expect(atRest(UI.field.socialDescription)).toContainText('No announcement to preview');
  // No kind of its own: what is output, a web page, with no sheet to open.
  await tab(frame, UI.tab.schema).click();
  await expect(frame.locator('.seo-field[data-path="schema.type"]')).toContainText('A web page');
  await expect(button(frame, UI.schema.kind)).toHaveCount(0);
  // Your own JSON-LD is not offered, and opens no empty editor.
  await expect(button(frame, UI.schema.ownJsonLd)).toHaveCount(0);

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
  await expect(box(frame, UI.field.description)).not.toHaveAccessibleDescription(/No announcement to preview/);
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

test('a link to a field that no longer exists says so in its box, under it and in Checks', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, articleMixed.id, 'article');
  const frame = await openSeo(page);
  const description = box(frame, UI.field.description);
  const field = frame.locator('.seo-field[data-path="description"]');

  // The box names the field it was linked to, says why it gives nothing, and
  // shows its ×; under it, what is used instead, and a way to link again.
  await expect(description.locator('.seo-linked-tag')).toHaveText(articleMixed.gone);
  await expect(description.locator('.seo-linked-value')).toHaveText('No longer exists');
  await expect(button(frame, UI.action.unlink(UI.field.description))).toBeVisible();
  await expect(field.locator('.seo-guide')).toContainText(`${articleMixed.gone} no longer exists, so each article uses its default description.`);
  await expect(field.locator('.seo-guide').getByRole('button', { name: 'Link another field' })).toBeVisible();
  // One Tab stop for the field: the box. Its link button is for the pointer.
  await expect(button(frame, UI.action.changeLink(UI.field.description))).toHaveAttribute('tabindex', '-1');
  await page.screenshot({ path: test.info().outputPath('broken-box.png') });

  // Checks lists it to fix; its action puts focus in the field's link menu.
  await button(frame, UI.tab.checks).click();
  const checks = sheet(frame, 'Checks');
  await expect(checks.getByText('Link the description again')).toBeVisible({ timeout: 60_000 });
  await checks.getByRole('button', { name: 'Link another field' }).click();
  const menu = linkMenuOf(frame);
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('textbox', { name: 'Find a field' })).toBeFocused();

  // Linked to Summary: said at once; this article has none, and the field
  // says what is used instead.
  await page.keyboard.type('Summary');
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(frame.getByRole('status').filter({ hasText: 'Description linked to Summary.' })).toHaveCount(1);
  await expect(description.locator('.seo-linked-tag')).toHaveText('Summary');
  await expect(description.locator('.seo-linked-value')).toHaveText('Empty for this article');
  await expect(field.locator('.seo-guide')).toHaveText('This article has no Summary, so its Body summary, else the start of its Body is used.');
  await expect(status(frame)).toContainText(new RegExp(`${UI.footer.draftTemplate}|^Linked to Summary`), { timeout: 30_000 });

  // Undo goes back to the stored link: the server takes it, and the box
  // names the field again.
  const write = page.waitForResponse((response) => response.url().includes('/canvas-metatag/api/draft/content_template/') && response.request().method() === 'PUT');
  await button(frame, UI.action.undo).click();
  expect((await write).status()).toBe(200);
  await expect(description.locator('.seo-linked-tag')).toHaveText(articleMixed.gone);
  await expect(description.locator('.seo-linked-value')).toHaveText('No longer exists');
  // The draft is the stored template again, and the session keeps nothing to
  // send again.
  await expect(status(frame)).toContainText('Matches the published template', { timeout: 30_000 });
  expect(await frame.locator('body').evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('canvas_metatag:pending:')))).toEqual([]);
});
