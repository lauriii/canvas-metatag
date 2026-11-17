import type { FrameLocator } from '@playwright/test';

import { NODES, SITE_NAME, TEMPLATE_ID, TEST_ID, UI, USERS } from './constants';
import {
  button,
  closeReview,
  expect,
  graphNode,
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
 * SEO for a content type, set in its Full content template: linked to the
 * type's fields, previewed against the article the editor previews, live when
 * the template is published.
 */

test.describe.configure({ mode: 'serial' });

const article = NODES.article;
const second = NODES.second;
const templateQuery = `entity_type=content_template&id=${TEMPLATE_ID}&preview=${article.id}`;

const source = (path: string) => ({
  source: { expression: `ℹ︎␜entity:node:article␝${path}`, sourceType: 'entity-field' },
});

/** Links a value to an entry of its link menu, from the button by its label. */
async function linkTo(frame: FrameLocator, field: string, entry: string | RegExp): Promise<void> {
  // "Link X to a field", or "Change the link for X" when X follows a default.
  await frame
    .getByRole('button', { name: UI.action.link(field) })
    .or(frame.getByRole('button', { name: UI.action.changeLink(field) }))
    .first()
    .click();
  const menu = frame.getByRole('dialog', { name: `Link ${field}` });
  await menu.getByRole('option', { name: entry }).first().click();
}

test('type-level values are linked to fields, follow the previewed article and publish with the template', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, article.id);
  const frame = await openSeo(page);
  const preview = frame.getByTestId(TEST_ID.search);

  await expect(button(frame, UI.scope.article)).toBeVisible();
  const caption = frame.getByText(/^Previewing/);
  await expect(caption).toContainText(article.title);
  await expect(preview).toContainText(`${article.title} | ${SITE_NAME}`);
  // A value that follows its default is a box that names its source.
  const description = frame.getByRole('combobox', { name: UI.field.description, exact: true });
  await expect(description).toHaveAccessibleDescription(/^Follows the default: each article's description\./);

  // The link button says the same as its tooltip, first.
  const linkButton = frame.getByRole('button', { name: UI.action.changeLink(UI.field.description) });
  await expect(linkButton).toBeVisible();

  // Clicking the preview's title puts focus in the Title box, which follows
  // its default; focusing the ending, or opening its menu, highlights only
  // the separator and the ending.
  await preview.locator('.seo-result-title .seo-part').first().click();
  await expect(frame.getByRole('combobox', { name: UI.field.title, exact: true })).toBeFocused();
  const ending = frame.getByRole('button', { name: UI.field.titleEnding });
  const lit = () => preview.locator('.seo-result-title .seo-part').evaluateAll((parts) => parts.map((part) => part.hasAttribute('data-on')));
  await ending.focus();
  await expect.poll(lit).toEqual([false, true]);
  await ending.click();
  const endingMenu = frame.getByRole('dialog', { name: 'Title ending' });
  await expect(endingMenu.getByRole('textbox')).toBeFocused();
  await expect.poll(lit).toEqual([false, true]);
  // Its footer says where the separator is set; Edit is for administrators.
  await expect(endingMenu.locator('.seo-menu-foot')).toHaveText(/^The separator \| is set for the whole site\.$/);
  await page.keyboard.press('Escape');
  await expect(ending).toBeFocused();

  // Nothing found is said so.
  await linkButton.click();
  const finder = frame.getByRole('dialog', { name: `Link ${UI.field.description}` });
  await finder.getByRole('textbox', { name: 'Find a field' }).fill('zzz');
  await expect(finder).toContainText('No field matches “zzz”.');
  await page.keyboard.press('Escape');
  // The description, linked to each article's own summary, by keyboard: `{`
  // in the empty input, "summ", Enter (Summary is the best match, not the
  // Body that mentions summaries), and Backspace at once unlinks again.
  await description.press('Backspace');
  const typed = textbox(frame, UI.field.description);
  await expect(typed).toBeFocused();
  await expect(frame.getByRole('button', { name: UI.action.link(UI.field.description) })).toBeVisible();
  await page.keyboard.type('{');
  const menu = frame.getByRole('dialog', { name: `Link ${UI.field.description}` });
  await expect(menu.getByRole('textbox', { name: 'Find a field' })).toBeFocused();
  await page.keyboard.type('summ');
  await expect(menu.getByRole('option').first()).toHaveAccessibleName(new RegExp(`^Summary, `));
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backspace');
  await expect(typed).toBeFocused();
  await expect(typed).toHaveValue('');
  await expect(frame.getByRole('status').filter({ hasText: 'Description unlinked.' })).toHaveCount(1);
  // Undo brings the link back: a box that says its source and this
  // article's summary, ending with one full stop.
  await button(frame, UI.action.undo).click();
  await expect(description).toHaveAccessibleDescription(
    new RegExp(`^Linked to Article › Summary\\. This article: ${article.summary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\.)`),
  );
  await expect(preview).toContainText(article.summary);
  await expect(linkButton).toBeVisible();
  // Its tooltip says the same as its name, then the link.
  await linkButton.hover();
  await expect(frame.getByRole('tooltip').first()).toContainText('Linked to Summary');

  // The ending: "Blog", typed into the ending's menu.
  await frame.getByRole('button', { name: UI.field.titleEnding }).click();
  await page.keyboard.type('Blog');
  await frame.getByRole('option', { name: /^Use “Blog” as the ending/ }).click();
  await expect(preview).toContainText(`${article.title} | Blog`);

  // The social image follows each article's hero, chosen in Choose image,
  // where the field shows this article's image.
  await tab(frame, UI.tab.social).click();
  await expect(frame.getByTestId(TEST_ID.social)).toContainText(article.summary);
  await button(frame, UI.action.chooseImage).click();
  const hero = sheet(frame, 'Choose image').getByRole('button', { name: UI.action.useHeroField });
  await expect(hero.locator('img')).toHaveCount(1);
  await hero.click();
  await expect(sheet(frame, 'Choose image')).toHaveCount(0);
  // The image row names the link, path and all.
  await expect(frame.getByText(/^Hero image › /)).toBeVisible();
  await expect(frame.getByText(`${article.image.width} × ${article.image.height}`, { exact: false }).first()).toBeVisible();
  // The image's link menu ends with the library; leaving it from there
  // returns to the field.
  await frame.getByRole('button', { name: UI.action.changeLink('Image') }).click();
  // It opens in the level of the current entry, Hero image; the library is
  // at the top.
  const imageMenu = frame.getByRole('dialog', { name: 'Link Image' });
  await imageMenu.getByRole('option', { name: 'Back to Article' }).click();
  await imageMenu.getByRole('option', { name: /^Choose from the media library/ }).click();
  await expect(sheet(frame, 'Choose image')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(frame.getByRole('button', { name: UI.action.changeLink('Image') })).toBeFocused();

  // Structured data: every Article is an Article, by its byline.
  await tab(frame, UI.tab.schema).click();
  await button(frame, UI.schema.kind).click();
  await frame.getByRole('radio', { name: UI.schema.article }).check();
  await button(frame, 'Change to an article').click();
  const more = button(frame, 'More details');
  if ((await more.getAttribute('aria-expanded')) !== 'true') {
    await more.click();
  }
  await linkTo(frame, 'Author name', /^Byline/);
  await expect(frame.getByRole('combobox', { name: 'Author name', exact: true })).toContainText(article.byline);

  // All of it is in the template's draft, as Canvas sources.
  await expect
    .poll(async () => (await seoState(page, templateQuery)).target?.values, { timeout: 30_000 })
    .toEqual({
      description: source('field_summary␞␟value'),
      schema: { props: { author_name: source('field_byline␞␟value') }, type: 'Article' },
      social: {
        image: {
          source: {
            expression: expect.stringMatching(/^ℹ︎␜entity:node:article␝field_hero␞␟entity␜␜entity:media:image␝/),
            sourceType: 'entity-field',
          },
        },
      },
      title_end: { text: 'Blog' },
    });
  // Saved: the status says so, unless the last link's Undo is still on offer.
  await expect(status(frame)).toContainText(new RegExp(`${UI.footer.draftTemplate}|^Linked to Byline`), { timeout: 30_000 });

  // The editor's own preview picker decides which article the dialog shows,
  // in the previews and in the linked boxes.
  await tab(frame, UI.tab.search).click();
  await page.getByTestId('select-content-preview-item').click();
  await page.getByRole('menuitem', { name: second.title }).click();
  await expect(page).toHaveURL(new RegExp(`/canvas/template/node/article/full/${second.id}$`));
  await expect(caption).toContainText(second.title);
  await expect(preview).toContainText(`${second.title} | Blog`);
  await expect(description).toContainText(second.summary);

  // Canvas lists the template among its changes, and publishes it.
  await expect(await reviewRows(page, /Article/)).toHaveCount(1);
  await closeReview(page);
  await publishAll(page);
});

test("each article's head comes from its own fields; a type without a template is untouched", async ({ visitor }) => {
  for (const node of [article, second]) {
    const head = await readHead(visitor, node.path);
    expect(head.titles).toEqual([`${node.title} | Blog`]);
    expect(link(head, 'canonical')).toBe(visitor.url());
    expect(head.links.filter(({ rel }) => rel === 'shortlink')).toEqual([]);
    expect(head.meta).toMatchObject({
      description: [node.summary],
      'og:type': ['article'],
      'og:title': [node.title],
      'og:image': [expect.stringMatching(new RegExp(`/${node.image.file}$`))],
      'og:image:width': [String(node.image.width)],
    });
    expect(head.jsonLd).toHaveLength(1);
    expect(graphNode(head.jsonLd[0], '#primary')).toMatchObject({
      '@type': 'Article',
      headline: node.title,
      author: { '@type': 'Person', name: node.byline },
    });
  }

  // Core's own head, exactly as without the module.
  const plain = await readHead(visitor, NODES.plain.path);
  expect(plain.titles).toEqual([`${NODES.plain.title} | ${SITE_NAME}`]);
  expect(plain.links.filter(({ rel }) => rel === 'shortlink')).toHaveLength(1);
  expect(plain.meta['og:title']).toBeUndefined();
  expect(plain.jsonLd).toEqual([]);
});
