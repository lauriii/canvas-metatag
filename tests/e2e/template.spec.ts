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
  status,
  tab,
  test,
  textbox,
} from './fixture';

/**
 * SEO for a content type, set in its Full content template: bound to the
 * type's fields, previewed against the article the editor previews, live when
 * the template is published.
 */

test.describe.configure({ mode: 'serial' });

const article = NODES.article;
const second = NODES.second;
const templateQuery = `entity_type=content_template&id=${TEMPLATE_ID}&preview=${article.id}`;

/**
 * Binds a structured-data detail to one of the type's fields. A typed detail
 * is a select of matching fields; a text detail may be a text field, where a
 * field is a chip.
 */
async function bind(frame: FrameLocator, detail: string, field: string): Promise<void> {
  const select = frame.getByRole('combobox', { name: detail, exact: true });
  await expect(select.or(textbox(frame, detail)).first()).toBeVisible();
  if (await select.isVisible()) {
    await select.click();
    await frame.getByRole('option', { name: `Field: ${field}`, exact: true }).click();
  } else {
    await textbox(frame, detail).fill(`{${field}}`);
  }
}

test('type-level settings are bound to fields, follow the previewed article and publish with the template', async ({
  drupal,
  page,
}) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, article.id);
  const frame = await openSeo(page);
  const preview = frame.getByTestId(TEST_ID.search);

  await expect(frame.getByRole('radio', { name: UI.scope.article })).toBeChecked();
  await expect(frame.getByText(`Previewing: ${article.title}`)).toBeVisible();
  await expect(preview).toContainText(`${article.title} | ${SITE_NAME}`);

  // The title pattern: a field is a chip that carries the field's label.
  const title = textbox(frame, UI.field.title);
  await title.fill('{Page title} by ');
  await button(frame, UI.action.insert).first().click();
  await frame.getByRole('menuitem', { name: /^Byline/ }).click();
  await expect(title).toHaveValue('{Page title} by {Byline}');
  await expect(frame.getByText(`Becomes: ${article.title} by ${article.byline}`)).toBeVisible();
  await expect(preview).toContainText(`${article.title} by ${article.byline}`);

  // The description: each article's own summary.
  await textbox(frame, UI.field.description).fill('{Summary}');
  await expect(frame.getByText('Each Article uses its own Summary.')).toBeVisible();
  await expect(preview).toContainText(article.summary);

  // The social card follows; its image is bound to the type's image field.
  await tab(frame, UI.tab.social).click();
  await expect(frame.getByTestId(TEST_ID.social)).toContainText(article.title);
  await expect(frame.getByTestId(TEST_ID.social)).toContainText(article.summary);
  const useField = frame
    .getByRole('menuitem', { name: UI.action.useHeroField })
    .or(button(frame, UI.action.useHeroField))
    .first();
  if (!(await useField.isVisible())) {
    await button(frame, UI.action.chooseImage).click();
  }
  await useField.click();

  // Structured data: every Article is an Article, by its byline, with its image.
  await tab(frame, UI.tab.schema).click();
  await frame.getByRole('radio', { name: /^Article/ }).click();
  await bind(frame, 'Author name', 'Byline');
  await bind(frame, 'Image', 'Hero image');
  await expect(frame.getByText(`Becomes: ${article.byline}`)).toBeVisible();

  // All of it is in the template's draft, as field tokens.
  await expect
    .poll(async () => (await seoState(page, templateQuery)).target?.values, { timeout: 30_000 })
    .toEqual({
      description: '{field.field_summary}',
      schema: {
        props: { author_name: '{field.field_byline}', image: '{field.field_hero}' },
        type: 'Article',
      },
      social: { image: '{field.field_hero}' },
      title: '{title} by {field.field_byline}',
    });
  await expect(status(frame)).toContainText(UI.footer.draftTemplate, { timeout: 30_000 });

  // The editor's own preview picker decides which article the dialog shows.
  await tab(frame, UI.tab.search).click();
  await page.getByTestId('select-content-preview-item').click();
  await page.getByRole('menuitem', { name: second.title }).click();
  await expect(page).toHaveURL(new RegExp(`/canvas/template/node/article/full/${second.id}$`));
  await expect(frame.getByText(`Previewing: ${second.title}`)).toBeVisible();
  await expect(preview).toContainText(`${second.title} by ${second.byline}`);
  await expect(preview).toContainText(second.summary);

  // Canvas lists the template among its changes, and publishes it.
  await expect(await reviewRows(page, /Article/)).toHaveCount(1);
  await closeReview(page);
  await publishAll(page);
});

test("each article's head comes from its own fields; a type without a template is untouched", async ({ visitor }) => {
  for (const node of [article, second]) {
    const head = await readHead(visitor, node.path);
    expect(head.titles).toEqual([`${node.title} by ${node.byline}`]);
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
