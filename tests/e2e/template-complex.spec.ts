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

/** Opens the "Insert value" menu of the title field. */
async function insertMenu(frame: FrameLocator) {
  await button(frame, UI.action.insert).first().click();
  const menu = frame.getByRole('menu', { name: 'Values' });
  await expect(menu).toBeVisible();
  return menu;
}

/**
 * The open value menu is inside the dialog's frame, shows at least two
 * entries whole and, in a short frame, no keyboard hints.
 */
async function expectMenuFits(page: Page, frame: FrameLocator) {
  const box = (await page.locator(SEO_IFRAME).boundingBox())!;
  const menu = (await frame.locator('.seo-menu').boundingBox())!;
  expect(menu.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(menu.y + menu.height).toBeLessThanOrEqual(box.y + box.height + 1);
  expect(menu.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(menu.x + menu.width).toBeLessThanOrEqual(box.x + box.width + 1);
  const whole = await frame.locator('.seo-menu-list').evaluate((list) => {
    const view = list.getBoundingClientRect();
    return [...list.querySelectorAll('[role="menuitem"]')].filter((item) => {
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
    const items = [...element.querySelectorAll('[role="menuitem"]')].map((item) => item.getBoundingClientRect());
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
  const checks = sheet(frame, 'Checks');
  await expect(checks.getByText('Add Street address').first()).toBeVisible();
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
  await expect(frame.locator('.seo-field[data-path="title"] textarea')).toBeEnabled({ timeout: 30_000 });
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
  // node's draft, reaches the template's draft.
  const draft = async () =>
    (await seoState(page, `entity_type=content_template&id=node.event.full&preview=${event.id}`)).target?.values
      .description ?? '';
  await tab(frame, UI.tab.search).click();
  const description = textbox(frame, UI.field.description);
  const kept = await description.inputValue();
  await previewNode(page, 'event', event);
  await description.fill('Typed during the switch');
  await expect.poll(draft, { timeout: 30_000 }).toBe('Typed during the switch');
  await description.fill(kept);
  await expect.poll(draft, { timeout: 30_000 }).toBe(kept);
});

test('on a long event the value menu works by keyboard in a short window, long values stay short at rest', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, eventLong.id, 'event');
  const frame = await openSeo(page);
  const title = textbox(frame, UI.field.title);
  await expect(title).toBeEnabled();
  const stored = await title.inputValue();
  expect(stored).toBe(`{Page title} {Separator} ${ending.draft}`);
  await page.setViewportSize({ width: 1440, height: 350 });

  // The search preview cuts the long title as a result list would; the field
  // keeps the pattern whole.
  const shown = (await frame.getByTestId(TEST_ID.search).locator('.seo-result-title').innerText()).trim();
  expect(shown.startsWith(eventLong.title)).toBe(true);
  expect(shown.endsWith('…')).toBe(true);

  // A brace typed in the field opens the menu; the filter takes the keys.
  await title.focus();
  await page.keyboard.press('End');
  await page.keyboard.type('{');
  const menu = frame.getByRole('menu', { name: 'Values' });
  await expect(menu).toBeVisible();
  // The menu covers the field in a short window: its filter names it.
  const filter = frame.getByRole('textbox', { name: `Insert into ${UI.field.title}` });
  await expect(filter).toBeFocused();
  await page.keyboard.type('Desc');
  // The arrows move through the two values named Description, the type's
  // field first; the active one stays in sight.
  const active = () =>
    filter.evaluate((element) => {
      const id = element.getAttribute('aria-activedescendant');
      return id ? (element.ownerDocument.getElementById(id)?.firstElementChild?.textContent ?? '') : '';
    });
  await expect.poll(active).toBe('Description (field.body)');
  await page.keyboard.press('ArrowDown');
  await expect.poll(active).toBe('Description (description)');
  await expect(menu.getByRole('menuitem', { name: /^Description \(description\)/ })).toBeInViewport();

  // The 6 KB body is two lines at rest, the whole of it on hover; its name
  // carries the label and at most 150 characters of it.
  const entry = menu.getByRole('menuitem', { name: /^Description \(field\.body\)/ });
  await expect(entry).toHaveAccessibleName(/^Description \(field\.body\) ?.{0,150}…$/su);
  const body = entry.locator('span').last();
  await expect(body).toHaveAttribute('title', /^Each work is introduced by the musicians who play it/);
  expect(((await body.getAttribute('title')) ?? '').length).toBeGreaterThan(5000);
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(true);
  expect(await body.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(2 * 16 + 1);

  // The menu stays inside the dialog's frame, in a window 350 px high.
  const box = (await page.locator(SEO_IFRAME).boundingBox())!;
  const popover = (await frame.locator('.seo-menu').boundingBox())!;
  expect(popover.y).toBeGreaterThanOrEqual(box.y - 1);
  expect(popover.y + popover.height).toBeLessThanOrEqual(box.y + box.height + 1);
  await page.screenshot({ path: test.info().outputPath('value-menu-1440x350.png') });

  // No serious accessibility violation with the menu open.
  const { violations } = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
  expect(
    violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`),
  ).toEqual([]);

  // Escape leaves the menu and the brace with it: back in the field, which
  // holds what it held, and nothing is written.
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(title).toBeFocused();
  await expect(title).toHaveValue(stored);
  await expect(status(frame)).toContainText(UI.footer.draftTemplate);
});

test('in a short window the value menu shows its values', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  const description = textbox(frame, UI.field.description);
  await expect(description).toBeEnabled();
  const menu = frame.getByRole('menu', { name: 'Values' });
  for (const height of [350, 420]) {
    await page.setViewportSize({ width: 1440, height });
    await tab(frame, UI.tab.search).click();
    // A brace typed in the description.
    await description.focus();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('{');
    await expect(menu).toBeVisible();
    await expectMenuFits(page, frame);
    // The menu covers the field: it names the field it fills.
    await expect(frame.getByRole('dialog', { name: `Insert a value into ${UI.field.description}` })).toBeVisible();
    // Its filter says so, on screen and to assistive technology alike.
    await expect(frame.getByRole('textbox', { name: `Insert into ${UI.field.description}` })).toHaveAttribute(
      'placeholder',
      `Insert into ${UI.field.description}`,
    );
    await page.screenshot({ path: test.info().outputPath(`value-menu-description-1440x${height}.png`) });
    // The arrows never leave the active entry under the fade.
    for (let step = 0; step < 3; step++) {
      await page.keyboard.press('ArrowDown');
      await expectActiveClear(frame);
    }
    await page.screenshot({ path: test.info().outputPath(`value-menu-arrows-1440x${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(description).toHaveValue('');
    // Keys typed at once after a choice, or after Escape, reach the field.
    await page.keyboard.type('{Perfo');
    await page.keyboard.press('Enter');
    await page.keyboard.type(' AFTER');
    await expect(description).toHaveValue('{Performers} AFTER');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('{');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.type('x');
    await expect(description).toHaveValue('x');
    await page.keyboard.press('Backspace');
    await expect(description).toHaveValue('');
    // The insert button of a field in the right-hand column.
    await tab(frame, UI.tab.schema).click();
    await frame
      .locator('.seo-field[data-path="schema.props.location_address_streetAddress"]')
      .getByRole('button', { name: UI.action.insert })
      .click();
    await expect(menu).toBeVisible();
    await expectMenuFits(page, frame);
    await page.screenshot({ path: test.info().outputPath(`value-menu-street-1440x${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // A double-click opens the menu and inserts nothing: the menu leaves the
    // field's buttons uncovered, and an entry under a still pointer neither
    // takes the second click nor becomes the active one.
    const street = frame.locator('.seo-field[data-path="schema.props.location_address_streetAddress"]');
    await street.getByRole('button', { name: UI.action.insert }).dblclick();
    await expect(menu).toBeVisible();
    await page.waitForTimeout(300);
    await expect(street.getByRole('textbox')).toHaveValue('');
    await expect(menu.getByRole('menuitem').first()).toHaveAttribute('data-active', 'true');
    await page.screenshot({ path: test.info().outputPath(`value-menu-street-dblclick-1440x${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // The same on Venue, in the left-hand column, whose insert button the
    // menu covers: the second click lands on the menu, which takes nothing,
    // and the field holds what it held.
    const left = frame.locator('.seo-field[data-path="schema.props.location_name"]');
    const insert = left.getByRole('button', { name: UI.action.insert });
    const held = await left.getByRole('textbox').inputValue();
    const under = await insert.boundingBox();
    await insert.dblclick();
    await expect(menu).toBeVisible();
    const over = (await frame.locator('.seo-menu').boundingBox())!;
    expect(under!.x + under!.width / 2).toBeGreaterThan(over.x);
    expect(under!.x + under!.width / 2).toBeLessThan(over.x + over.width);
    await page.waitForTimeout(300);
    await expect(left.getByRole('textbox')).toHaveValue(held);
    await expect(menu.getByRole('menuitem').first()).toHaveAttribute('data-active', 'true');
    await page.screenshot({ path: test.info().outputPath(`value-menu-left-dblclick-1440x${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  }

  // The menu's place is chosen once: a frame resized across 420 px while it
  // is open closes it, back in the field, which holds what it held.
  await tab(frame, UI.tab.search).click();
  for (const [from, to] of [
    [350, 900],
    [900, 350],
  ]) {
    await page.setViewportSize({ width: 1440, height: from });
    await description.focus();
    await page.keyboard.type('{');
    await expect(menu).toBeVisible();
    await page.setViewportSize({ width: 1440, height: to });
    // At once, with no exit animation left where it no longer fits.
    await expect(menu).toBeHidden({ timeout: 1000 });
    await expect(description).toBeFocused();
    await expect(description).toHaveValue('');
  }

  // A value chosen by keyboard hands the next keys to the field at once.
  await page.setViewportSize({ width: 1440, height: 900 });
  await tab(frame, UI.tab.search).click();

  // From the insert button of a field never focused, Escape hands the next
  // key to the field at its end, where a value would have gone.
  const titleField = textbox(frame, UI.field.title);
  const titleHeld = await titleField.inputValue();
  await frame.locator('.seo-scope').focus();
  await button(frame, UI.action.insert).first().click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(titleField).toBeFocused();
  await page.keyboard.type('x');
  await expect(titleField).toHaveValue(`${titleHeld}x`);
  await page.keyboard.press('Backspace');
  await expect(titleField).toHaveValue(titleHeld);

  await description.focus();
  await page.keyboard.type('{Perfo');
  await page.keyboard.press('Enter');
  await page.keyboard.type(' AFTER');
  await expect(description).toHaveValue('{Performers} AFTER');
  await expect(description).toBeFocused();
  // Back to what the template inherits.
  await button(frame, `Reset ${UI.field.description}`).click();
  await expect(description).toHaveValue('');
  await expect(status(frame)).toContainText(UI.footer.draftTemplate, { timeout: 30_000 });

  // By keyboard alone, with the caret never placed (Tab leaves it at the
  // start), a value from the insert button goes at the end.
  const title = textbox(frame, UI.field.title);
  const stored = await title.inputValue();
  await title.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(0, 0));
  await button(frame, UI.action.insert).first().focus();
  await page.keyboard.press('Shift+Tab');
  await expect(title).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  expect(await title.inputValue()).toMatch(new RegExp(`^${stored.replace(/[{}|]/g, '\\$&')} \\{[^}]+\\}$`));
  await frame.locator('.seo-field[data-path="title"]').screenshot({ path: test.info().outputPath('keyboard-insert-at-end.png') });
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

  // A group whose label has a space is named by it.
  const menu = await insertMenu(frame);
  await expect(menu.getByRole('group', { name: 'Job posting', exact: true })).toBeVisible();
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
  const zoomed = await insertMenu(frame);
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
  // At Canvas's dialog width the addition is whole or left out, so that
  // only the name may end in an ellipsis: never two on one line. (Here the
  // name is whole once "Not published yet" is left out; the tip says it.)
  await expect
    .poll(() =>
      caption.evaluate((element) =>
        [...element.children]
          .filter((part) => getComputedStyle(part).display !== 'none' && part.scrollWidth > part.clientWidth)
          .map((part) => part.tagName)
          .filter((tag) => tag !== 'EM'),
      ),
    )
    .toEqual([]);
  await caption.screenshot({ path: test.info().outputPath('caption-unpublished-468.png') });
  await expect(frame.getByRole('button', { name: 'About this preview' })).toHaveAttribute(
    'aria-description',
    /^This event isn't published yet\. Values that only editors can see are left out\. /,
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
  const insert = button(frame, UI.action.insert).first();
  let moves = 0;
  await expect(async () => {
    await insert.hover({ position: { x: 2 + (moves++ % 8), y: 6 } });
    await expect(frame.getByRole('tooltip', { name: new RegExp(`^${UI.action.insert}`) })).toBeVisible({
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
