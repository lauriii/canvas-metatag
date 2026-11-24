import AxeBuilder from '@axe-core/playwright';
import type { FrameLocator, Locator, Page } from '@playwright/test';

import { COMPLEX, TEST_ID, USERS } from './constants';
import { SEO_IFRAME, button, expect, openSeo, openTemplate, previewNode, publishAll, readHead, seoState, test, writeDraft } from './fixture';

/**
 * Composing a template's text from typed words and fields: the composer, on
 * the complex fixture's Event template (project `complex`). What it does is
 * the browser's, so it is proved here: keys, caret, chips as units, the
 * menu at the caret, undo, the clipboard, input methods, what assistive
 * technology reads, small frames, and the head a visitor gets.
 */

test.describe.configure({ mode: 'serial' });

const { event, eventHidden, eventLong } = COMPLEX;
const templateQuery = `entity_type=content_template&id=node.event.full&preview=${event.id}`;

/** The composer of a field: one textbox named by its label. */
const composer = (frame: FrameLocator, label: string) => frame.getByRole('textbox', { name: label, exact: true });
/** The box of a field that holds one field or follows its default. */
const box = (frame: FrameLocator, label: string) => frame.getByRole('combobox', { name: label, exact: true });
/** The chips of a composer, in order. */
const chips = (field: Locator) => field.locator('.seo-field-chip');

/** Where the caret is: in a text node (with its offset) or between nodes, and whether inside a chip. */
async function caret(field: Locator) {
  return field.evaluate((element) => {
    const selection = element.ownerDocument.getSelection()!;
    const node = selection.focusNode!;
    const chip = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element))?.closest('.seo-field-chip');
    const inside = !!chip && node.nodeType === Node.TEXT_NODE && selection.focusOffset > 0 && selection.focusOffset < (node.textContent ?? '').length;
    // The text before the caret, chips as their labels.
    const range = element.ownerDocument.createRange();
    range.setStart(element, 0);
    range.setEnd(selection.focusNode!, selection.focusOffset);
    return { before: range.toString(), inside, selected: selection.toString(), collapsed: selection.isCollapsed };
  });
}

/**
 * Whether a clipboard event made by a script carries its data here: one
 * engine drops it, so its copy and paste are left to the owner's check.
 */
const syntheticClipboard = (frame: FrameLocator) =>
  frame.locator('body').evaluate(() => {
    const data = new DataTransfer();
    data.setData('text/plain', 'x');
    return new ClipboardEvent('paste', { clipboardData: data }).clipboardData?.getData('text/plain') === 'x';
  });

/**
 * Lets the accessibility scan run in Firefox. Its ARIA element reflection
 * (`ariaLabelledByElements` and the like) crashes the page when the page reads
 * a property that Playwright's own world read first, which every query by
 * role and name does. The scan then reads the `aria-*` attributes instead,
 * as it does in an engine without the properties. The extension sets only
 * the attributes, so the scan finds the same names and references.
 */
const hideAriaElementReflection = (page: Page) =>
  Promise.all(
    page.frames().map((one) =>
      one.evaluate(() => {
        for (const name of Object.getOwnPropertyNames(Element.prototype).filter((property) => /^aria\w*Elements?$/.test(property))) {
          Object.defineProperty(Element.prototype, name, { configurable: true, get: () => null });
        }
      }),
    ),
  );

/** Starts a log of what the dialog's polite live regions say. */
async function listen(frame: FrameLocator) {
  await frame.locator('body').evaluate((body) => {
    const log: string[] = ((window as unknown as { said: string[] }).said = []);
    new MutationObserver(() => {
      for (const region of body.querySelectorAll('[role="status"]')) {
        const text = region.textContent?.trim() ?? '';
        if (text && log.at(-1) !== text) {
          log.push(text);
        }
      }
    }).observe(body, { subtree: true, childList: true, characterData: true });
  });
}
const said = (frame: FrameLocator) => frame.locator('body').evaluate(() => (window as unknown as { said: string[] }).said);

/**
 * Tab, or Shift+Tab with `back`, as a keyboard user presses it. WebKit's
 * desktop default moves Tab only between text fields, past buttons and
 * links; Alt+Tab is its key for every control, as Tab is once the user has
 * turned on Tab to every item.
 */
const tab = (page: Page, back = false) =>
  page.keyboard.press(`${back ? 'Shift+' : ''}${page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+' : ''}Tab`);

/** The text of each range a composer has marked with a CSS highlight. */
const highlighted = (frame: FrameLocator, name: string) =>
  frame.locator('body').evaluate((_, key) => {
    const marks = (CSS as unknown as { highlights?: Map<string, Iterable<Range>> }).highlights?.get(key);
    return marks ? [...marks].map((range) => range.toString()) : [];
  }, name);

/** Until Canvas has fitted its dialog to the window: a menu opened before would close as the frame crosses 420 px. */
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
}

/** Nothing sideways in the dialog, and no chip of a composer split over two lines. */
async function whole(frame: FrameLocator, field: Locator) {
  expect(await frame.locator('.seo-body').first().evaluate((body) => body.scrollWidth - body.clientWidth)).toBeLessThanOrEqual(1);
  expect(await field.evaluate((element) => [...element.querySelectorAll('.seo-field-chip')].some((chip) => chip.getClientRects().length > 1))).toBe(false);
}

/** Composes the event's title by keyboard: Title in ‹City› · ‹Starts›. */
async function composeByKeyboard(page: Page, frame: FrameLocator) {
  await box(frame, 'Title').focus();
  await page.keyboard.press('End');
  const title = composer(frame, 'Title');
  await expect(title).toBeFocused();
  await page.keyboard.type(' in ');
  await page.keyboard.type('{');
  const menu = frame.getByRole('dialog', { name: 'Add a field to Title' });
  await expect(menu).toBeVisible();
  const where = menu.locator('.seo-menu-where');
  await expect(where).toHaveText(`After “${event.title} in”`);
  // Whole, never squeezed by a long list.
  expect(await where.evaluate((line) => line.clientHeight >= line.scrollHeight)).toBe(true);
  await page.keyboard.type('city');
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  // Focus is back at once, the caret after the field: the next keys flow on.
  await page.keyboard.type(' · ');
  await page.keyboard.type('{starts}');
  await page.keyboard.press('Enter');
  await expect(chips(title)).toHaveText(['Title', 'Venue › City', 'Starts']);
  return title;
}

test('a title composed by keyboard: chips, the result, the head', async ({ drupal, page, visitor }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  await listen(frame);

  // The 80 % case: the title follows its default in a box, one Tab stop.
  await expect(box(frame, 'Title')).toHaveAccessibleDescription(/^Follows the default: each event's title\./);
  await expect(button(frame, 'Change the link for Title')).toHaveAttribute('tabindex', '-1');

  const title = await composeByKeyboard(page, frame);
  await expect(title).toContainText(`Title in Venue › City · Starts`);
  // Focused, the search preview lights the composed main part, one part,
  // never the ending.
  const previewParts = frame.getByTestId(TEST_ID.search).locator('.seo-result-title .seo-part');
  await expect.poll(() => previewParts.evaluateAll((parts) => parts.map((part) => part.hasAttribute('data-on')))).toEqual([true, false]);
  await expect(previewParts.first()).toHaveText(new RegExp(`^${event.title} in Helsinki · `));
  // The result line, inside the border, and the search preview agree: the
  // result right after a pick, without the ending.
  const result = frame.locator('.seo-field[data-path="title"] .seo-composer-result');
  await expect(result).toHaveText(new RegExp(`^${event.title} in Helsinki · \\w+ \\d+,? \\w*`));
  await expect(result).not.toContainText('| ');
  // Hovering a chip says what an item without it gets.
  await chips(title).nth(2).hover();
  await expect(result).toHaveText(/^Without Starts: /);
  await frame.locator('.seo-tab-head, .seo-header').first().hover();
  await box(frame, 'Description').focus();
  // At rest the search preview shows the result: the line under the fields
  // goes, as nothing is left out for this event.
  await expect(result).toHaveCount(0);
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(`${event.title} in Helsinki`);
  // Its description starts with the result.
  await expect(title).toHaveAccessibleDescription(new RegExp(`^This event: ${event.title} in Helsinki · `));
  // The button now adds a field, and is a Tab stop of its own; its tooltip
  // says what the title is made of.
  await expect(button(frame, 'Add a field to Title')).not.toHaveAttribute('tabindex', '-1');
  await button(frame, 'Add a field to Title').hover();
  await expect(frame.locator('.rt-TooltipContent')).toContainText('Add a field to Title · Made of Title, “in”, Venue › City, “·”, Starts');
  // Its name is said once: the tip after the name describes it.
  await expect(button(frame, 'Add a field to Title')).toHaveAccessibleDescription('Made of Title, “in”, Venue › City, “·”, Starts');
  expect(await said(frame)).toEqual(expect.arrayContaining(['Venue › City added to Title.', 'Starts added to Title.']));

  // Stored as parts, in the template's draft.
  await expect
    .poll(async () => (await seoState(page, templateQuery)).target?.values?.title, { timeout: 30_000 })
    .toEqual({
      parts: [
        { fact: 'title' },
        { text: ' in ' },
        { source: { expression: expect.stringContaining('field_locality'), sourceType: 'entity-field' } },
        { text: ' · ' },
        { source: { expression: expect.stringContaining('field_starts'), sourceType: 'entity-field' } },
      ],
    });

  // Reload: the same composer, the same chips.
  await page.reload();
  await expect(page.getByTestId('canvas-publish-review')).toBeVisible({ timeout: 60_000 });
  const again = await openSeo(page);
  await expect(chips(composer(again, 'Title'))).toHaveText(['Title', 'Venue › City', 'Starts']);

  // Published, a visitor's head holds it: the same words as the search
  // preview.
  const previewTitle = (await again.getByTestId(TEST_ID.search).locator('.seo-result-title').innerText()).replace(/\s+/g, ' ').trim();
  await publishAll(page);
  const head = await readHead(visitor, event.path);
  expect(head.titles[0]).toMatch(new RegExp(`^${event.title} in Helsinki · .+ \\| `));
  expect(head.titles[0]).toBe(previewTitle);
});

test('chips move and go as one; the menu at the caret; undo; braces', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  await listen(frame);
  const title = composer(frame, 'Title');
  await expect(chips(title)).toHaveCount(3);

  // Tab in: the caret at the end.
  await title.focus();
  expect((await caret(title)).before).toBe('Title in Venue › City · Starts');
  // A chip is stepped over in one press, never entered.
  await page.keyboard.press('ArrowLeft');
  let at = await caret(title);
  expect([at.before, at.inside]).toEqual(['Title in Venue › City · ', false]);
  await page.keyboard.press('ArrowLeft');
  expect((await caret(title)).before).toBe('Title in Venue › City ·');
  // Shift selects a chip whole.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  at = await caret(title);
  expect(at.selected).toBe('Starts');
  // Enter on a selected chip: replace it.
  await page.keyboard.press('Enter');
  const replace = frame.getByRole('dialog', { name: 'Replace Starts' });
  await expect(replace).toBeVisible();
  await expect(replace.getByRole('option', { name: /^Remove Starts/ })).toBeVisible();
  // Escape: no change, the selection it had.
  await page.keyboard.press('Escape');
  await expect(replace).toBeHidden();
  await expect(title).toBeFocused();
  expect((await caret(title)).selected).toBe('Starts');

  // Backspace beside a chip removes it whole, and says so.
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await expect(chips(title)).toHaveText(['Title', 'Venue › City']);
  await expect.poll(() => said(frame)).toContain('Starts removed from Title.');
  // Undo in the composer brings it back, in the draft too.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(chips(title)).toHaveText(['Title', 'Venue › City', 'Starts']);
  await expect
    .poll(async () => ((await seoState(page, templateQuery)).target?.values?.title as { parts?: unknown[] } | undefined)?.parts?.length, { timeout: 30_000 })
    .toBe(5);

  // `{{` types one brace; a brace typed into text is text.
  await page.keyboard.press('End');
  await page.keyboard.type('{');
  await expect(frame.getByRole('dialog', { name: 'Add a field to Title' })).toBeVisible();
  await page.keyboard.type('{');
  await expect(frame.getByRole('dialog', { name: 'Add a field to Title' })).toBeHidden();
  await expect(title).toContainText('Starts{');
  await page.keyboard.press('Backspace');

  // A click on a chip opens its menu, to replace or remove it.
  await chips(title).nth(1).click();
  const city = frame.getByRole('dialog', { name: 'Replace Venue › City' });
  await expect(city).toBeVisible();
  await city.getByRole('option', { name: /^Remove Venue › City/ }).click();
  await expect(chips(title)).toHaveText(['Title', 'Starts']);
  await expect.poll(() => said(frame)).toContain('Venue › City removed from Title.');
  // The bar's Undo restores it.
  await frame.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(chips(title)).toHaveText(['Title', 'Venue › City', 'Starts']);
  // And so does the draft.
  await expect
    .poll(async () => ((await seoState(page, templateQuery)).target?.values?.title as { parts?: unknown[] } | undefined)?.parts?.length, { timeout: 30_000 })
    .toBe(5);
});

test('paste, input methods, assistive technology and small frames', async ({ drupal, page, browserName }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  const title = composer(frame, 'Title');
  await expect(chips(title)).toHaveCount(3);

  // One textbox named by the label, never multi-line, its chips' labels as
  // text in the flow, its description starting with the result.
  const tree = await frame.locator('.seo-field[data-path="title"]').ariaSnapshot();
  expect(tree).toMatch(/textbox "Title"/);
  await expect(title).not.toHaveAttribute('aria-multiline', 'true');
  await expect(title).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(title).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowDown');
  await expect(title).toHaveAccessibleDescription(/^This event: /);

  await title.focus();
  await page.keyboard.press('End');

  // Copying keeps the fields for another composer of the dialog; its plain
  // text is what the selection reads as for the item.
  const clipboard = await syntheticClipboard(frame);
  test.info().annotations.push({ type: 'clipboard', description: clipboard ? 'synthetic events' : 'not run: synthetic clipboard events carry no data in this engine' });
  if (clipboard) {
    await page.keyboard.press('ControlOrMeta+a');
    const copied = await title.evaluate((element) => {
      const data = new DataTransfer();
      element.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
      return { parts: data.getData('application/x-canvas-metatag-parts'), plain: data.getData('text/plain') };
    });
    expect(JSON.parse(copied.parts).parts).toHaveLength(5);
    expect(copied.plain).toMatch(new RegExp(`^${event.title} in Helsinki · `));
    await frame.getByRole('tab', { name: 'Social', exact: true }).click();
    await box(frame, 'Title').focus();
    await page.keyboard.press('End');
    const social = composer(frame, 'Title');
    await expect(social).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await social.evaluate((element, parts) => {
      const data = new DataTransfer();
      data.setData('application/x-canvas-metatag-parts', parts);
      data.setData('text/plain', 'ignored');
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, copied.parts);
    await expect(chips(social)).toHaveText(['Title', 'Venue › City', 'Starts']);
    // A pasted brace pattern stays text; a pasted line break is a space.
    await social.evaluate((element) => {
      const data = new DataTransfer();
      data.setData('text/plain', ' {field.x}\nand more');
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(social).toContainText('{field.x} and more');
    await expect(chips(social)).toHaveCount(3);
    // Reset it: the social title follows its default again.
    await frame.getByRole('button', { name: 'Reset Title', exact: true }).click();
    await expect(box(frame, 'Title')).toBeVisible();
    await frame.getByRole('tab', { name: 'Search', exact: true }).click();
  }
  await expect(chips(title)).toHaveCount(3);
  await title.focus();
  await page.keyboard.press('End');

  // An input method composes beside a chip, the first key after an insert
  // included, and loses no key (Chromium: the protocol's composition).
  // Simulated composition is Chromium's protocol only; other engines get the
  // owner's check with a real input method (design D10).
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await session.send('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 });
    await session.send('Input.imeSetComposition', { text: 'にほ', selectionStart: 2, selectionEnd: 2 });
    await session.send('Input.insertText', { text: '日本' });
    await expect(title).toHaveText('Title in Venue › City ·日本 Starts');
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Backspace');
    }
    await expect(title).toHaveText('Title in Venue › City · Starts');

    // What the platform inserts on its own beside a chip, through the same
    // input path as an input method: a smart quote right after a field, and
    // a text replacement of a selected word. Fields stay whole.
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await session.send('Input.insertText', { text: '“' });
    await expect(title).toHaveText('Title“ in Venue › City · Starts');
    await expect(chips(title)).toHaveText(['Title', 'Venue › City', 'Starts']);
    await page.keyboard.press('Backspace');
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await session.send('Input.insertText', { text: 'at' });
    await expect(title).toHaveText('Title at Venue › City · Starts');
    await expect(chips(title)).toHaveText(['Title', 'Venue › City', 'Starts']);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(title).toHaveText('Title in Venue › City · Starts');
    // A `{` that comes as text input only (AltGr on one system reports Ctrl
    // and Alt, so no key handler takes it): the menu opens, nothing typed.
    await page.keyboard.press('End');
    await session.send('Input.insertText', { text: '{' });
    await expect(frame.getByRole('dialog', { name: 'Add a field to Title' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(title).toHaveText('Title in Venue › City · Starts');
    // Text inserted with no key (dictation, an emoji picker) while a box has
    // focus never lands in the composer focus left.
    await box(frame, 'Description').focus();
    await session.send('Input.insertText', { text: 'A' });
    await expect(box(frame, 'Description')).toBeFocused();
    await expect(title).toHaveText('Title in Venue › City · Starts');
    await title.focus();
    await page.keyboard.press('End');
  }

  // No serious or critical violation, at rest and with the menu open.
  const scan = async () => {
    // Colours are read once a line has faded in: mid-fade, its ink is
    // lighter than it ever rests.
    await frame.locator('body').evaluate((body) =>
      Promise.all(body.ownerDocument.getAnimations().filter((one) => one.effect?.getComputedTiming().endTime !== Infinity).map((one) => one.finished.catch(() => undefined))),
    );
    if (browserName === 'firefox') {
      await hideAriaElementReflection(page);
    }
    return (await new AxeBuilder({ page }).include(SEO_IFRAME).analyze()).violations.filter((one) => one.impact === 'serious' || one.impact === 'critical');
  };
  expect(await scan()).toEqual([]);
  await page.keyboard.press('Alt+ArrowDown');
  const added = frame.getByRole('dialog', { name: 'Add a field to Title' });
  await expect(added).toBeVisible();
  // Its hints say what Enter does: add.
  await expect(added.locator('.seo-menu-hint')).toContainText('↵add');
  expect(await scan()).toEqual([]);
  await page.keyboard.press('Escape');
  // And with a field's menu open to replace it: it opens in the field's
  // level, Remove right after the way back, and the field keeps its ring
  // while its menu is open.
  await chips(title).nth(1).click();
  const replaced = frame.getByRole('dialog', { name: 'Replace Venue › City' });
  await expect(replaced).toBeVisible();
  await expect(replaced.getByRole('option').nth(1)).toHaveAccessibleName('Remove Venue › City');
  await expect(chips(title).nth(1)).toHaveAttribute('data-selected', '');
  expect(await scan()).toEqual([]);
  // Escape leaves it selected: Enter opens its menu again.
  await page.keyboard.press('Escape');
  await expect(title).toBeFocused();
  expect((await caret(title)).selected).toBe('Venue › City');
  await page.keyboard.press('Enter');
  await expect(replaced).toBeVisible();
  await page.keyboard.press('Escape');
  // The Schema tab with a composed detail.
  await frame.getByRole('tab', { name: 'Schema', exact: true }).click();
  await box(frame, 'Event name').focus();
  await page.keyboard.type('{');
  await expect(frame.getByRole('dialog', { name: 'Add a field to Event name' })).toBeVisible();
  await page.keyboard.type('city');
  await page.keyboard.press('Enter');
  const eventName = composer(frame, 'Event name');
  await expect(chips(eventName)).toHaveText(['Title', 'Venue › City']);
  expect(await scan()).toEqual([]);
  // Its Reset goes back to the default it follows, said so.
  await frame.getByRole('button', { name: 'Reset Event name', exact: true }).focus();
  await expect(frame.getByRole('tooltip')).toHaveText("Back to each event's title");
  await frame.getByRole('tab', { name: 'Search', exact: true }).click();

  // At 420 and 350 px tall the menu stays in the frame and says where the
  // field goes.
  for (const height of [420, 350]) {
    await page.setViewportSize({ width: 1440, height });
    await settled(frame);
    await title.focus();
    await page.keyboard.press('Alt+ArrowDown');
    const menu = frame.getByRole('dialog', { name: 'Add a field to Title' });
    await expect(menu).toBeVisible();
    await expect(menu.locator('.seo-menu-where')).toHaveText(/^After “.+ · .+”$/);
    await expect(menu.locator('.seo-menu-where')).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(`composer-menu-1440x${height}.png`) });
    await page.keyboard.press('Escape');
    await expect(title).toBeFocused();
  }
  // At 200 % zoom nothing overflows sideways; chips wrap whole, on the
  // Search tab and on the Schema tab.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await frame.locator('html').evaluate((html) => {
    html.style.zoom = '2';
  });
  await whole(frame, title);
  await frame.getByRole('tab', { name: 'Schema', exact: true }).click();
  await expect(chips(eventName)).toHaveCount(2);
  await whole(frame, eventName);
  // The default again, for the tests that follow.
  await frame.getByRole('button', { name: 'Reset Event name', exact: true }).click();
  await expect(box(frame, 'Event name')).toBeVisible();
  // In a frame 234 px wide (the dialog's width at 200 % zoom; a zoomed root
  // misplaces every tooltip), the add button's tooltip wraps inside it.
  await frame.locator('html').evaluate((html) => {
    html.style.zoom = '';
  });
  await frame.getByRole('tab', { name: 'Search', exact: true }).click();
  await page.locator(SEO_IFRAME).evaluate((element) => {
    (element as HTMLElement).style.width = '234px';
  });
  await expect.poll(() => frame.locator('body').evaluate(() => window.innerWidth)).toBe(234);
  await button(frame, 'Add a field to Title').hover();
  const tip = frame.locator('.rt-TooltipContent');
  await expect(tip).toContainText('Made of Title');
  expect(await tip.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth;
  })).toBe(true);
  await page.locator(SEO_IFRAME).evaluate((element) => {
    (element as HTMLElement).style.width = '';
  });
});

test('arrows, Backspace, paste, the preview and Reset beside chips', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  await listen(frame);
  const title = composer(frame, 'Title');
  await expect(chips(title)).toHaveText(['Title', 'Venue › City', 'Starts']);
  const original = 'Title in Venue › City · Starts';
  await title.focus();

  // Home: Backspace removes nothing after the caret.
  await page.keyboard.press('Home');
  expect((await caret(title)).before).toBe('');
  await page.keyboard.press('Backspace');
  await expect(title).toHaveText(original);
  // Arrow right steps over a chip, then on into the words after it.
  const steps = ['Title', 'Title ', 'Title i', 'Title in', 'Title in ', 'Title in Venue › City', 'Title in Venue › City '];
  for (const before of steps) {
    await page.keyboard.press('ArrowRight');
    const at = await caret(title);
    expect([at.before, at.inside]).toEqual([before, false]);
  }
  // Shift selects a chip whole, and a second press goes on past it.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowRight');
  expect((await caret(title)).selected).toBe('Venue › City');
  await page.keyboard.press('Shift+ArrowRight');
  expect((await caret(title)).selected).toBe('Venue › City ');
  // Selected whole, the result says what an item without it gets.
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(frame.locator('.seo-field[data-path="title"] .seo-composer-result')).toHaveText(/^Without Venue › City: /);

  // The menu says where a field goes: after the caret's words, in the
  // item's words; a field right after another gets a space.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Alt+ArrowDown');
  const menu = frame.getByRole('dialog', { name: 'Add a field to Title' });
  await expect(menu.locator('.seo-menu-where')).toHaveText(`After “${event.title} in Helsinki”`);
  // "title" finds the event's own Title before a referenced page's.
  await page.keyboard.type('title');
  await expect(menu.getByRole('option').first()).toHaveAccessibleName(/^Title/);
  await page.keyboard.press('Enter');
  await expect(chips(title)).toHaveText(['Title', 'Venue › City', 'Title', 'Starts']);
  await expect(title).toHaveText('Title in Venue › City Title · Starts');
  // Undo says what it takes away, and redo what it brings back.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(title).toHaveText(original);
  await expect.poll(() => said(frame)).toContain('Title removed from Title.');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(chips(title)).toHaveCount(4);
  await expect.poll(() => said(frame)).toContain('Title added to Title.');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(title).toHaveText(original);

  // A paste after the last field: the caret after it, and undone as a step.
  await page.keyboard.press('End');
  if (await syntheticClipboard(frame)) {
    const paste = (data: Record<string, string>) =>
      title.evaluate((element, entries) => {
        const transfer = new DataTransfer();
        for (const [type, value] of Object.entries(entries)) {
          transfer.setData(type, value);
        }
        element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
      }, data);
    await paste({ 'text/plain': ' X' });
    await page.keyboard.type('Y');
    await expect(title).toHaveText(`${original} XY`);
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(title).toHaveText(original);
    // Fields this place can't take are left out with their words, named as
    // they were copied: a field another type has, and long text in a title.
    await paste({
      'application/x-canvas-metatag-parts': JSON.stringify({
        parts: [{ text: ' with ' }, { source: { sourceType: 'entity-field', expression: 'ℹ︎␜entity:node:article␝field_nope␞␟value' } }, { text: ' and ' }, { fact: 'site' }, { text: ' — ' }, { fact: 'description' }],
        labels: ['', 'Venue › City', '', 'Site name', '', 'Description'],
      }),
      'text/plain': 'ignored',
    });
    await expect(title).toHaveText(`${original} and Site name`);
    await expect.poll(() => said(frame)).toContain("Venue › City and Description aren't available here, so they were left out.");
    // Shown too, under the field, until focus leaves it.
    await expect(frame.locator('.seo-field[data-path="title"] .seo-guide')).toContainText("Venue › City and Description aren't available here");
    await page.keyboard.press('ControlOrMeta+z');
    await expect(title).toHaveText(original);

    // Past eight fields a paste leaves the rest out, and the menu adds none.
    const sites = Array.from({ length: 6 }, () => [{ text: ' ' }, { fact: 'site' }]).flat();
    await paste({
      'application/x-canvas-metatag-parts': JSON.stringify({ parts: sites, labels: sites.map((part) => ('fact' in part ? 'Site name' : '')) }),
      'text/plain': 'ignored',
    });
    await expect(chips(title)).toHaveCount(8);
    await expect.poll(() => said(frame)).toContain("Site name isn't available here, so it was left out.");
    // Eight fields in the 468 px dialog wrap whole, none split, and nothing
    // goes sideways.
    expect(await title.evaluate((element) => [...element.querySelectorAll('.seo-field-chip')].filter((chip) => chip.getClientRects().length > 1).length)).toBe(0);
    expect(await title.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await title.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(30);
    await page.keyboard.press('Alt+ArrowDown');
    await expect(menu.locator('.seo-menu-where')).toHaveText('At most 8 fields in one value.');
    await expect(menu.getByRole('option', { name: /^Starts/ }).first()).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    // A field is still replaced at eight.
    await chips(title).first().click();
    const eighth = frame.getByRole('dialog', { name: 'Replace Title' });
    await expect(eighth.getByRole('option', { name: /^Starts/ }).first()).not.toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await page.keyboard.press('End');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(title).toHaveText(original);

  }

  // The social title can copy the composed search title.
  await frame.getByRole('tab', { name: 'Social', exact: true }).click();
  await box(frame, 'Title').click();
  const social = frame.getByRole('dialog', { name: 'Link Title' });
  // A step on the whole value, after "Add words or fields", as it reads.
  await expect(social.getByRole('option').nth(1)).toHaveAccessibleName('Copy the search title, Title in Venue › City · Starts');
  await social.getByRole('option', { name: /^Copy the search title/ }).click();
  await expect(chips(composer(frame, 'Title'))).toHaveText(['Title', 'Venue › City', 'Starts']);
  await frame.getByRole('button', { name: 'Reset Title', exact: true }).click();
  await frame.getByRole('tab', { name: 'Search', exact: true }).click();
  await expect(title).toHaveText(original);

  // A click on the composed title in the search preview: the caret at the
  // end, and typing goes on there.
  await frame.getByTestId(TEST_ID.search).locator('.seo-result-title .seo-part').first().click();
  await expect(title).toBeFocused();
  await page.keyboard.type('!');
  await expect(title).toHaveText(`${original}!`);
  await page.keyboard.press('Backspace');
  await expect(title).toHaveText(original);

  // A detail that composes says the brace on focus; `{` on its box adds a
  // field after its default, and Escape stays in the composer.
  await frame.getByRole('tab', { name: 'Schema', exact: true }).click();
  await box(frame, 'Event name').focus();
  await expect(frame.locator('.seo-field[data-path="schema.props.name"]').getByText('Type { to add a field')).toBeVisible();
  await page.keyboard.type('{');
  const nameMenu = frame.getByRole('dialog', { name: 'Add a field to Event name' });
  await expect(nameMenu.locator('.seo-menu-where')).toHaveText(`After “${event.title}”`);
  await page.keyboard.press('Escape');
  await expect(composer(frame, 'Event name')).toBeFocused();
  await frame.getByRole('tab', { name: 'Search', exact: true }).click();
  await expect(title).toHaveText(original);

  // Reset by keyboard: the title's box takes focus.
  const reset = frame.getByRole('button', { name: 'Reset Title', exact: true });
  await reset.focus();
  await page.keyboard.press('Enter');
  await expect(box(frame, 'Title')).toBeFocused();
  // Its menu starts with composing.
  await page.keyboard.press('Enter');
  const link = frame.getByRole('dialog', { name: 'Link Title' });
  await expect(link.getByRole('option').first()).toHaveAccessibleName('Add words or fields, Keep the default and add to it');
  await expect(link.getByRole('option').first()).toBeInViewport();
  await expect(link.getByRole('option', { name: /^Type a title for every/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // The description's menu opens on its current entry, the field its
  // default reads: composing stays in sight, under the filter.
  await box(frame, 'Description').click();
  const describe = frame.getByRole('dialog', { name: 'Link Description' });
  await expect(describe.getByRole('option', { name: /^Description › Summary, Default, / })).toHaveAttribute('data-active');
  await expect(describe.getByRole('option').first()).toHaveAccessibleName('Add words or fields, Keep the default and add to it');
  await expect(describe.getByRole('option').first()).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Escape');
  await box(frame, 'Title').focus();

  // A pick from the menu of an empty composer links the whole value: the
  // box, focused, and the next key types over it.
  await page.keyboard.press('Backspace');
  await expect(title).toBeFocused();
  await page.keyboard.type('{');
  await expect(link).toBeVisible();
  // Still following its default, it may start from it again.
  await expect(link.getByRole('option').first()).toHaveAccessibleName('Add words or fields, Keep the default and add to it');
  await page.keyboard.type('starts');
  await page.keyboard.press('Enter');
  await expect(box(frame, 'Title')).toBeFocused();
  await expect(box(frame, 'Title')).toHaveAccessibleDescription(/^Linked to /);
  await page.keyboard.type('x');
  await expect(title).toBeFocused();
  await expect(title).toHaveText('x');
  await expect(chips(title)).toHaveCount(0);
});

test('a brace by layout, a box stepped out of, Tab order, announcements and a paste on a box', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  await listen(frame);
  const field = frame.locator('.seo-field[data-path="title"]');
  const ending = frame.getByRole('button', { name: /^Title ending:/ });
  // The tests before left the title set: the default again.
  const titleBox = box(frame, 'Title');
  const title = composer(frame, 'Title');
  await expect(titleBox.or(title)).toBeVisible();
  const reset = field.getByRole('button', { name: 'Reset Title', exact: true });
  if (await reset.count()) {
    await reset.click();
  }
  await expect(titleBox).toBeVisible();

  // `{` typed as a layout types it, with Shift: the menu at the caret, and
  // no brace and no value written.
  await titleBox.focus();
  await page.keyboard.press('Shift+BracketLeft');
  const add = frame.getByRole('dialog', { name: 'Add a field to Title' });
  await expect(add).toBeVisible();
  // The rule, while the value takes its first fields.
  await expect(add.locator('.seo-menu-rule')).toHaveText("When an item doesn't have a field, the words joining it are left out too.");
  await page.keyboard.press('Escape');
  await expect(title).toBeFocused();
  await expect(title).toHaveText('Title');
  // In a short frame the entries need the room: the rule gives way.
  for (const height of [420, 350]) {
    await page.setViewportSize({ width: 1440, height });
    await settled(frame);
    await title.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(add).toBeVisible();
    await expect(add.locator('.seo-menu-rule')).toBeHidden();
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await settled(frame);
  await title.focus();
  // Nothing added: Tab shows the box again and goes on to the ending.
  await tab(page);
  await expect(titleBox).toBeVisible();
  await expect(ending).toBeFocused();
  await expect.poll(async () => (await seoState(page, templateQuery)).target?.values?.title, { timeout: 30_000 }).toBeUndefined();
  // Arrow right on the box: its default as a field, the caret after it;
  // Shift+Tab goes back to the link button, not to the box.
  await titleBox.focus();
  await page.keyboard.press('ArrowRight');
  await expect(title).toBeFocused();
  expect((await caret(title)).before).toBe('Title');
  await tab(page, true);
  await expect(titleBox).toBeVisible();
  await expect(button(frame, 'Change the link for Title')).toBeFocused();

  // `{` on a detail's box, with Shift too.
  await frame.getByRole('tab', { name: 'Schema', exact: true }).click();
  await box(frame, 'Event name').focus();
  await page.keyboard.press('Shift+BracketLeft');
  await expect(frame.getByRole('dialog', { name: 'Add a field to Event name' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(composer(frame, 'Event name')).toHaveText('Title');
  await frame.getByRole('tab', { name: 'Search', exact: true }).click();

  const composed = await composeByKeyboard(page, frame);
  // Two fields: the rule is no longer the footer.
  await page.keyboard.press('Alt+ArrowDown');
  await expect(add).toBeVisible();
  await expect(add.locator('.seo-menu-rule')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Tabbing through a composed title: its button, the composer, the ending.
  await button(frame, 'Add a field to Title').focus();
  await tab(page);
  await expect(composed).toBeFocused();
  // Tabbed in, the caret is at the end: `{` adds after the last part.
  await page.keyboard.type('{');
  await expect(add.locator('.seo-menu-where')).toHaveText(/^After “…?.*Helsinki · .+”$/);
  await page.keyboard.press('Escape');
  await expect(composed).toBeFocused();
  await tab(page);
  await expect(ending).toBeFocused();

  // A field selected whole shows a ring; its tooltip says what the event
  // gets without it.
  await composed.focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(chips(composed).nth(2)).toHaveAttribute('data-selected', '');
  await page.keyboard.press('ArrowRight');
  await expect(chips(composed).nth(2)).not.toHaveAttribute('data-selected', '');
  await expect(chips(composed).nth(1)).toHaveAttribute('title', new RegExp(`^Helsinki\\nWithout Venue › City: ${event.title} · `));

  // Replacing a field: "↵ replace", and said.
  await chips(composed).nth(1).click();
  const replace = frame.getByRole('dialog', { name: 'Replace Venue › City' });
  await expect(replace.locator('.seo-menu-hint')).toContainText('↵replace');
  await page.keyboard.type('title');
  await replace.getByRole('option', { name: /^Venue › Title,/ }).click();
  await expect(chips(composed)).toHaveText(['Title', 'Venue › Title', 'Starts']);
  await expect.poll(() => said(frame)).toContain('Venue › City replaced by Venue › Title.');
  // The bar's Undo, then Ctrl+Z: the composer never brings back what the
  // draft no longer holds, and the next key goes at the end.
  await frame.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(chips(composed)).toHaveText(['Title', 'Venue › City', 'Starts']);
  // Focus is back in the composer, the caret at its end.
  await expect(composed).toBeFocused();
  expect((await caret(composed)).before).toBe('Title in Venue › City · Starts');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(chips(composed)).toHaveText(['Title', 'Venue › City', 'Starts']);

  // Linked and unlinked from a box, said at the time.
  const description = box(frame, 'Description');
  await description.focus();
  await page.keyboard.press('Enter');
  const link = frame.getByRole('dialog', { name: 'Link Description' });
  await page.keyboard.type('status');
  await page.keyboard.press('Enter');
  await expect(description).toHaveAccessibleDescription(/^Linked to Event › Status\. /);
  await expect.poll(() => said(frame)).toContain('Description linked to Status.');
  // Its menu keeps the field and adds to it, first; picked, a composer
  // holding the field, the caret after it.
  await page.keyboard.press('Enter');
  await expect(link.getByRole('option').first()).toHaveAccessibleName('Add words or fields, Keep Status and add to it');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(composer(frame, 'Description')).toBeFocused();
  await expect(chips(composer(frame, 'Description'))).toHaveText(['Status']);
  expect((await caret(composer(frame, 'Description'))).before).toBe('Status');
  // Nothing added: the box again.
  await tab(page, true);
  await expect(description).toBeVisible();
  await description.focus();
  // Arrow right: the field as a chip, the caret after it.
  await page.keyboard.press('ArrowRight');
  const descriptionComposer = composer(frame, 'Description');
  await expect(descriptionComposer).toBeFocused();
  await expect(chips(descriptionComposer)).toHaveText(['Status']);
  // Words typed, then taken away: the field alone folds back to its box,
  // and Tab goes on past the field, never back into it.
  await page.keyboard.type(' x');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await tab(page);
  await expect(description).toBeVisible();
  await expect(description).not.toBeFocused();
  expect(await frame.locator('body').evaluate(() => document.activeElement !== document.body && !document.activeElement?.closest('.seo-field[data-path="description"]'))).toBe(true);
  await description.focus();
  await page.keyboard.press('Backspace');
  await expect.poll(() => said(frame)).toContain('Description unlinked.');
  await expect(descriptionComposer).toBeFocused();
  // Typed text only: the button adds a field, and its menu can put a field
  // in the text's place, first.
  await page.keyboard.type('Summer offers');
  await button(frame, 'Add a field to Description').click();
  const textOnly = frame.getByRole('dialog', { name: 'Add a field to Description' });
  await expect(textOnly.getByRole('option').first()).toHaveAccessibleName('Replace the text with a field, Then pick the field');
  await page.keyboard.press('Escape');
  await descriptionComposer.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await tab(page);
  await expect(description).toBeVisible();

  // An emptied composer shows what the event gets instead, and the brace.
  await composed.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await expect(chips(composed)).toHaveCount(0);
  expect(await composed.evaluate((element) => getComputedStyle(element, '::before').content)).toBe(`"${event.title}"`);
  await expect(field.locator('.seo-guide')).toHaveText('Type { to add a field');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(chips(composed)).toHaveCount(3);

  // A paste on the social title's Default box replaces it with what the
  // copy holds, as a typed key does.
  // The draft follows the bar's Undo and the composer's: Venue › City again.
  let parts = { parts: [] as unknown[] };
  await expect
    .poll(async () => {
      parts = (await seoState(page, templateQuery)).target?.values?.title as { parts: unknown[] };
      return JSON.stringify(parts);
    }, { timeout: 30_000 })
    .toContain('field_locality');
  await frame.getByRole('tab', { name: 'Social', exact: true }).click();
  const clipboard = await syntheticClipboard(frame);
  test.info().annotations.push({ type: 'clipboard', description: clipboard ? 'synthetic events' : 'paste on a box not run: synthetic clipboard events carry no data in this engine' });
  if (clipboard) {
    await box(frame, 'Title').evaluate((element, copied) => {
      const data = new DataTransfer();
      data.setData('application/x-canvas-metatag-parts', copied);
      data.setData('text/plain', 'ignored');
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, JSON.stringify({ parts: parts.parts, labels: parts.parts.map(() => '') }));
    await expect(chips(composer(frame, 'Title'))).toHaveText(['Title', 'Venue › City', 'Starts']);
    await frame.getByRole('button', { name: 'Reset Title', exact: true }).click();
  }
  await frame.getByRole('tab', { name: 'Search', exact: true }).click();
});

test('another event, a conflict, and a type with nothing to preview', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  const title = composer(frame, 'Title');
  await expect(chips(title)).toHaveText(['Title', 'Venue › City', 'Starts']);
  const result = frame.locator('.seo-field[data-path="title"] .seo-composer-result');
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(`${event.title} in Helsinki · `);
  await expect(result).toHaveCount(0);
  // Another event, with the dialog open: its venue is unpublished, so Venue
  // › City is hidden for it. Every composed result follows.
  const layoutLoaded = page.waitForResponse((response) => response.url().endsWith(`/layout-content-template/node.event.full/${eventHidden.id}`));
  await previewNode(page, 'event', eventHidden);
  // The editor's load of its layout sets off the dialog's read-back of the
  // state, 300 ms on. The other session below writes after that read-back:
  // before it, the read-back would bring that write in and leave nothing to
  // refuse.
  const loaded = await layoutLoaded;
  const loadedAt = loaded.request().timing().startTime + loaded.request().timing().responseStart;
  const readBack = page.waitForResponse((response) => response.url().includes('/canvas-metatag/api/state?') && response.request().timing().startTime >= loadedAt);
  // At rest, beside the preview that shows the result: only what is left out.
  await expect(result).toHaveText('Venue › City left out for this event');
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(`${eventHidden.title} · `);
  const city = chips(title).nth(1);
  await expect(city).toHaveAttribute('data-state', 'hidden');
  // Its state only: the result already goes without it.
  await expect(city).toHaveAttribute('title', 'Hidden from visitors for this event');
  expect(await city.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('dashed');
  // In use: the result, the note on its own line, the length guidance for
  // this event, never the city.
  await title.focus();
  await expect(result.locator('.seo-composer-text')).toHaveText(new RegExp(`^${eventHidden.title} · `));
  await expect(result.locator('.seo-composer-note')).toHaveText('Venue › City left out for this event');
  const guide = frame.locator('.seo-field[data-path="title"] .seo-guide');
  await expect(guide).toContainText('for this event; others vary');
  await expect(guide).not.toContainText('City');
  await expect(title).toHaveAccessibleDescription(new RegExp(`^This event: ${eventHidden.title} · .*Venue › City`));
  // Its description is its result and its guidance, never Reset or a count.
  await expect(title).not.toHaveAccessibleDescription(/Reset|\d+$/);

  // Another session writes the template's draft: the next write here is
  // refused, and the dialog turns read-only.
  await readBack;
  await writeDraft(page, 'content_template/node.event.full', `layout-content-template/node.event.full/${eventHidden.id}`, { robots: { nofollow: true } });
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(frame.getByRole('alert').filter({ hasText: /changed somewhere else/ })).toBeVisible({ timeout: 30_000 });
  await expect(title).toHaveAttribute('aria-readonly', 'true');
  // Enter and Alt+Down still open the menu, to look: every entry disabled.
  const pickable = (menu: Locator) => menu.locator('[role="option"]:not([aria-disabled="true"]):not([data-kind])');
  for (const key of ['Enter', 'Alt+ArrowDown']) {
    await title.focus();
    await page.keyboard.press(key);
    const menu = frame.getByRole('dialog', { name: 'Add a field to Title' });
    await expect(menu).toBeVisible();
    await expect(menu.locator('.seo-menu-where')).toHaveText('Read-only: nothing can be picked.');
    await expect(menu.getByRole('option').first()).toBeVisible();
    await expect(pickable(menu)).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
  // A click on a field: its menu, every entry disabled.
  await chips(title).first().click();
  const replace = frame.getByRole('dialog', { name: 'Replace Title' });
  await expect(replace).toBeVisible();
  await expect(pickable(replace)).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Nothing was written over the other session's draft.
  expect((await seoState(page, `entity_type=content_template&id=node.event.full&preview=${eventHidden.id}`)).target?.values?.title).toBeUndefined();

  // A type with no content yet, given a composed title by configuration:
  // its fields, neutral, and "No announcement to preview"; nothing editable.
  await page.goto('./canvas/template/node/announcement/full');
  await expect(page.getByTestId('canvas-publish-review')).toBeVisible({ timeout: 60_000 });
  const empty = await openSeo(page);
  const group = empty.getByRole('group', { name: 'Title', exact: true });
  await expect(group.locator('.seo-field-chip')).toHaveText(['Title', 'Site name']);
  await expect(group.locator('.seo-field-chip').first()).toHaveAttribute('data-state', 'none');
  await expect(empty.locator('.seo-field[data-path="title"] .seo-composer-result')).toHaveText('No announcement to preview');
  await expect(empty.locator('.seo-field[data-path="title"] [contenteditable="true"]')).toHaveCount(0);
  await expect(empty.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);

  // A composition holding a field that no longer exists: the field red by
  // its machine name, and the guidance says so with "Replace field".
  const { articleMixed } = COMPLEX;
  await writeDraft(page, 'content_template/node.article.full', `layout-content-template/node.article.full/${articleMixed.id}`, {
    description: { parts: [{ fact: 'title' }, { text: ' in ' }, { source: { sourceType: 'entity-field', expression: `ℹ︎␜entity:node:article␝${articleMixed.gone}␞␟value` } }] },
  });
  await openTemplate(page, articleMixed.id, 'article');
  const article = await openSeo(page);
  const broken = composer(article, 'Description');
  await expect(chips(broken)).toHaveText(['Title', articleMixed.gone]);
  await expect(chips(broken).nth(1)).toHaveAttribute('data-state', 'broken');
  const guidance = article.locator('.seo-field[data-path="description"] .seo-guide');
  await expect(guidance).toContainText(`${articleMixed.gone} no longer exists, so it is left out of every article's description.`);
  // Said once, in the guidance's words, never its button's.
  await expect(broken).toHaveAccessibleDescription(new RegExp(`^This article: [^]*[.!?] ${articleMixed.gone} no longer exists, so it is left out of every article's description\\.$`));
  await guidance.getByRole('button', { name: 'Replace field', exact: true }).click();
  await expect(article.getByRole('dialog', { name: `Replace ${articleMixed.gone}` })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('the words that go with a field, an empty field, and a field named like a fact', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  // This event has no performers.
  await openTemplate(page, eventLong.id, 'event');
  const frame = await openSeo(page);
  const field = frame.locator('.seo-field[data-path="description"]');
  const description = composer(frame, 'Description');
  // Composed of typed words and Performers alone: every field empty, so the
  // default is used, and the guidance says so.
  await box(frame, 'Description').focus();
  await page.keyboard.press('End');
  await expect(description).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('Tickets for ');
  await page.keyboard.type('{');
  await page.keyboard.type('performers');
  await page.keyboard.press('Enter');
  await expect(chips(description)).toHaveText(['Performers › Title']);
  await expect(field.locator('.seo-guide')).toContainText('Performers › Title is empty for this event, so its default description is used.');
  // The description says it once, in the guidance's words.
  await expect(description).toHaveAccessibleDescription(/^This event: (?:(?!is empty)[\s\S])*\.? Performers › Title is empty for this event, so its default description is used\.$/);
  // An empty field says its state, and only that.
  await expect(chips(description).first()).toHaveAttribute('data-state', 'empty');
  await expect(chips(description).first()).toHaveAttribute('title', 'Empty for this event');
  await page.keyboard.type(' in ');
  await page.keyboard.type('{');
  await page.keyboard.type('city');
  await page.keyboard.press('Enter');
  await expect(description).toHaveText('Tickets for Performers › Title in Venue › City');

  // The caret beside Performers: it and the words that go with it, marked.
  await page.keyboard.press('Home');
  for (let i = 0; i < 'Tickets for '.length; i++) {
    await page.keyboard.press('ArrowRight');
  }
  await expect(chips(description).first()).toHaveAttribute('data-near', '');
  await expect(chips(description).nth(1)).not.toHaveAttribute('data-near', '');
  await expect.poll(() => highlighted(frame, 'seo-chip-words')).toEqual(['Tickets for ']);
  // Left out with the empty field, its words are drawn muted.
  await expect.poll(() => highlighted(frame, 'seo-chip-dropped')).toContain('Tickets for ');
  // A separator typed after the last field is left out, and drawn so.
  await page.keyboard.press('End');
  await page.keyboard.type(' · ');
  const dropped = description.locator('[data-dropped]');
  await expect(dropped).toHaveText(' · ');
  await expect(dropped).toHaveAttribute('title', 'Left out at the end');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Backspace');
  }
  await expect(dropped).toHaveCount(0);

  // A field labelled like a fact keeps its machine name on its chip.
  await page.keyboard.type(' ');
  await page.keyboard.type('{');
  await page.keyboard.type('body');
  await page.keyboard.press('Enter');
  await expect(chips(description).last()).toHaveText('Description (body)');
  // The default again.
  await field.getByRole('button', { name: 'Reset Description', exact: true }).click();
  await expect(box(frame, 'Description')).toBeVisible();
});

test('a worked-out value in a composer: started from, added, replaced, and where it comes from', async ({ drupal, page, browserName }) => {
  await drupal.login(USERS.editor);
  // The event's description follows its default, the Description worked out
  // from its Description › Summary.
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  const field = frame.locator('.seo-field[data-path="description"]');
  const description = composer(frame, 'Description');
  const reset = field.getByRole('button', { name: 'Reset Description', exact: true });
  if (await reset.count()) {
    await reset.click();
  }
  const from = 'from Description › Summary';

  // Linking the whole value leaves out the default it follows; composing
  // starts from it.
  await box(frame, 'Description').click();
  const link = frame.getByRole('dialog', { name: 'Link Description' });
  await expect(link.getByRole('group', { name: 'Automatic' }).getByRole('option', { name: /^Description, / })).toHaveCount(0);
  // The row the default reads is marked current; choosing it keeps the
  // default, which is more than a link to that one field.
  await link.getByRole('option', { name: /, Default, / }).click();
  await expect(link).toBeHidden();
  await expect(box(frame, 'Description')).toContainText(`Default · ${from}`);
  await expect(reset).toHaveCount(0);
  await box(frame, 'Description').click();
  await expect(link).toBeVisible();
  await link.getByRole('option', { name: 'Add words or fields, Keep the default and add to it' }).click();
  await expect(description).toBeFocused();
  // The chip is named by the value's label alone; its tooltip and the
  // composer's description say the field it reads.
  await expect(chips(description)).toHaveText(['Description']);
  await expect(chips(description).first()).toHaveAttribute('title', new RegExp(` · ${from}$`));
  await expect(description).toHaveAccessibleDescription(new RegExp(`^This event: .*Description comes ${from}\\.`, 's'));
  // With the mouse, its "+" opens the add menu, and the composition that
  // holds only the default stays.
  await field.getByRole('button', { name: 'Add a field to Description' }).click();
  const adding = frame.getByRole('dialog', { name: 'Add a field to Description' });
  await expect(adding).toBeVisible();
  await expect(chips(description)).toHaveText(['Description']);
  await page.keyboard.press('Escape');
  await expect(adding).toBeHidden();
  await expect(description).toBeFocused();

  // Adding to the composition offers the default, saying where it comes
  // from; the groups are named in add mode too.
  await page.keyboard.type(' Free delivery.');
  await page.keyboard.type('{');
  const add = frame.getByRole('dialog', { name: 'Add a field to Description' });
  await expect(add).toBeVisible();
  await expect(add.getByRole('group')).toHaveCount(2);
  await expect(add.getByRole('group').nth(0)).toHaveAccessibleName('Event');
  await expect(add.getByRole('group').nth(1)).toHaveAccessibleName('Automatic');
  const offered = add.getByRole('group', { name: 'Automatic' }).getByRole('option', { name: new RegExp(`^Description, ${from}, `) });
  await expect(offered).toBeVisible();
  await expect(offered.locator('.seo-menu-via')).toHaveText(`· ${from}`);
  // The "Default" mark is the link menu's only.
  await expect(add.getByRole('option', { name: /, Default, / })).toHaveCount(0);
  if (browserName === 'firefox') {
    await hideAriaElementReflection(page);
  }
  const scan = await new AxeBuilder({ page }).include({ fromFrames: [SEO_IFRAME, 'body'] }).analyze();
  expect(scan.violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`)).toEqual([]);
  await offered.click();
  await expect(add).toBeHidden();
  await expect(chips(description)).toHaveText(['Description', 'Description']);

  // Replacing a chip offers it too.
  await chips(description).first().click();
  const replace = frame.getByRole('dialog', { name: 'Replace Description' });
  await expect(replace).toBeVisible();
  await expect(replace.getByRole('group', { name: 'Automatic' }).getByRole('option', { name: new RegExp(`^Description, ${from}, `) })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(replace).toBeHidden();

  // In an empty composer, "Link Description" starts from the default too:
  // its first chip, which leaving gives back as the Default box.
  await reset.click();
  await expect(box(frame, 'Description')).toBeVisible();
  await box(frame, 'Description').focus();
  await page.keyboard.press('Backspace');
  await expect(description).toBeFocused();
  await expect(chips(description)).toHaveCount(0);
  await page.keyboard.type('{');
  await expect(link).toBeVisible();
  const start = link.getByRole('option').first();
  await expect(start).toHaveAccessibleName('Add words or fields, Keep the default and add to it');
  // Enter picks a field, never the step on the whole value.
  await expect(start).not.toHaveAttribute('data-active');
  await start.click();
  await expect(description).toBeFocused();
  await expect(chips(description)).toHaveText(['Description']);
  await tab(page);
  await expect(box(frame, 'Description')).toBeVisible();
  await expect(box(frame, 'Description')).toHaveAccessibleDescription(new RegExp(`^Follows the default: each event's description, ${from}\\.`));
});

test('the composer that cannot load leaves the dialog working', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  // The composer's chunk is gone (a module updated while the editor was
  // open, or the network): every fetch of it fails.
  await page.route(/\/Composer-[^/]*\.js(\?.*)?$/, (route) => route.fulfill({ status: 404, body: '' }));
  await openTemplate(page, event.id, 'event');
  const field_ = (name: string) => ({ source: { sourceType: 'entity-field', expression: `ℹ︎␜entity:node:event␝${name}␞␟value` } });
  await writeDraft(page, 'content_template/node.event.full', `layout-content-template/node.event.full/${event.id}`, {
    title: { parts: [{ fact: 'title' }, { text: ' in ' }, field_('field_venue␞␟entity␜␜entity:node:venue␝field_locality'), { text: ' · ' }, field_('field_starts')] },
  });
  await openTemplate(page, event.id, 'event');
  const frame = await openSeo(page);
  // The composed title shows its parts as they are, and says what to do.
  const field = frame.locator('.seo-field[data-path="title"]');
  await expect(field.getByRole('group', { name: 'Title', exact: true }).locator('.seo-field-chip')).toHaveText(['Title', 'Venue › City', 'Starts']);
  await expect(field.locator('.seo-guide')).toContainText('The editor could not load. Reload the editor.');
  // Composing from a box tries again, says it, and the box stays.
  await box(frame, 'Description').focus();
  await page.keyboard.press('End');
  await expect(frame.locator('.seo-field[data-path="description"] .seo-guide')).toContainText('The editor could not load. Reload the editor.');
  await expect(box(frame, 'Description')).toBeVisible();
  // The rest of the dialog works.
  await frame.getByRole('tab', { name: 'Social', exact: true }).click();
  await expect(frame.getByRole('tab', { name: 'Social', exact: true })).toHaveAttribute('aria-selected', 'true');
});
