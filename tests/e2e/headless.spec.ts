import { FRONTEND_URL, NODES, PAGES, SITE_NAME, TEMPLATE_ID, TEST_ID, UI, USERS } from './constants';
import { button, contentHead, expect, link, openPage, openSeo, openTemplate, outputRows, readHead, sheet, tab, test, textbox, writeDraft } from './fixture';

/**
 * Headless delivery, checked where Drupal's part ends: the `head` of the
 * Canvas content API. One frontend is configured and nothing runs at its
 * address; what a frontend renders from `head` is the frontend's own business.
 */

test.describe.configure({ mode: 'serial' });

const pricing = PAGES.pricing;
const article = NODES.article;
/** Request URIs are relative to the site, as a frontend sends them. */
const uri = (path: string) => path.slice(1);

test('the content API carries the SEO head, on the frontend address', async ({ visitor }) => {
  const expected = [
    [uri(pricing.path), `${pricing.title} | ${SITE_NAME}`],
    [uri(article.path), `${article.title} | ${SITE_NAME}`],
  ];
  for (const [requestUri, title] of expected) {
    const head = await contentHead(visitor.request, requestUri);
    expect(Object.keys(head).sort()).toEqual(['link', 'meta', 'script', 'title']);
    expect(head.title).toBe(title);

    const canonical = `${FRONTEND_URL}${requestUri}`;
    expect(head.link.filter(({ rel }) => rel === 'canonical')).toEqual([{ rel: 'canonical', href: canonical }]);
    expect(head.meta.find(({ property }) => property === 'og:url')?.content).toBe(canonical);

    // Structured data is an object, never markup, and every node it names
    // lives on the frontend.
    expect(head.script).toHaveLength(1);
    const [{ type, textContent }] = head.script;
    expect(type).toBe('application/ld+json');
    expect(textContent['@context']).toBe('https://schema.org');
    expect(textContent['@graph'].length).toBeGreaterThan(2);
    for (const node of textContent['@graph']) {
      expect(node['@id']?.startsWith(`${FRONTEND_URL}/`), JSON.stringify(node)).toBe(true);
    }
  }

  // The page on Drupal's own address declares the frontend copy canonical.
  expect(link(await readHead(visitor, pricing.path), 'canonical')).toBe(`${FRONTEND_URL}${uri(pricing.path)}`);
});

test('a preview token sees the page draft and the template draft; visitors do not', async ({
  drupal,
  page,
  visitor,
}) => {
  await drupal.login(USERS.editor);
  await writeDraft(page, `canvas_page/${pricing.id}`, `layout/canvas_page/${pricing.id}`, {
    title: { text: 'Draft pricing' },
  });
  await writeDraft(
    page,
    `content_template/${TEMPLATE_ID}`,
    `layout-content-template/${TEMPLATE_ID}/${article.id}`,
    { title_end: { text: 'Drafts' } },
  );

  // The editor's session mints an assertion; a frontend redeems it for a
  // token. This is what the editor's own draft preview does.
  const csrf = await (await page.request.get('./session/token')).text();
  const minted = await page.request.post(
    `./canvas-headless/assertion?entity_type=canvas_page&entity=${pricing.id}`,
    { headers: { 'X-CSRF-Token': csrf } },
  );
  expect(minted.status(), await minted.text()).toBe(200);
  const { assertion } = (await minted.json()) as { assertion: string };
  const redeemed = await visitor.request.post('./oauth/token', {
    form: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
      client_id: 'canvas_headless',
    },
  });
  expect(redeemed.status(), await redeemed.text()).toBe(200);
  const token = ((await redeemed.json()) as { access_token: string }).access_token;

  expect((await contentHead(visitor.request, uri(pricing.path), token)).title).toBe(`Draft pricing | ${SITE_NAME}`);
  expect((await contentHead(visitor.request, uri(article.path), token)).title).toBe(
    `${article.title} | Drafts`,
  );
  expect((await contentHead(visitor.request, uri(pricing.path))).title).toBe(`${pricing.title} | ${SITE_NAME}`);
  expect((await contentHead(visitor.request, uri(article.path))).title).toBe(`${article.title} | ${SITE_NAME}`);
});

test('Output says what the frontend receives', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openPage(page, pricing.id);
  const frame = await openSeo(page);
  await button(frame, UI.action.output).click();
  await expect(frame.getByText(UI.output.headless)).toBeVisible();
  // Where addresses come from is the sheet's ⓘ.
  await expect(frame.getByRole('button', { name: 'About addresses', exact: true })).toHaveAttribute(
    'aria-description',
    UI.output.frontend,
  );
  expect((await outputRows(frame)).canonical).toBe(`${FRONTEND_URL}${uri(pricing.path)}`);
});

test('an empty description says the frontend decides, in both previews and in Checks', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openPage(page, PAGES.stored.id);
  const frame = await openSeo(page);
  await expect(frame.getByTestId(TEST_ID.search)).toContainText(UI.noDescriptionSent);
  // The focused field names the check; the check says what is true.
  const description = textbox(frame, UI.field.description);
  await description.focus();
  await expect(description).toHaveAccessibleDescription(/Add a description/);
  await button(frame, UI.tab.checks).click();
  const checks = sheet(frame, 'Checks');
  await expect(checks).toContainText('Add a description');
  await expect(checks).toContainText(UI.noDescriptionSent);
  await expect(frame.getByText(/search engines (will )?pick text from the page/i)).toHaveCount(0);
  await button(frame, UI.action.back).click();
  await tab(frame, UI.tab.social).click();
  await expect(frame.getByTestId(TEST_ID.social)).toContainText(UI.noDescriptionSent);
  // The card shows the sentence whole: it wraps, where a description is cut.
  const card = frame.getByTestId(TEST_ID.social).locator('.seo-social-description');
  await expect(card).toHaveText(UI.noDescriptionSent);
  expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('headless-card.png') });
});

test('a template previewing an item without a description says so on the focused field', async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, NODES.noSummary.id);
  const frame = await openSeo(page);
  await expect(frame.getByText(/^Previewing/)).toContainText(NODES.noSummary.title);
  // At template scope an empty description is a quiet check: the field
  // itself says what is true.
  const description = frame.getByRole('combobox', { name: UI.field.description, exact: true });
  await description.focus();
  await expect(description).toHaveAccessibleDescription(new RegExp(UI.noDescriptionSent.replaceAll('.', '\\.')));
  await expect(frame.getByText(/search engines (will )?pick text from the page/i)).toHaveCount(0);
});

test("the README's example scripts the dialog by roles and names", async ({ drupal, page }) => {
  await drupal.login(USERS.editor);
  await openTemplate(page, NODES.article.id);
  await openSeo(page);
  // Copied from the README's "Scripting the dialog".
  const seo = page.frameLocator('iframe[title="SEO"]');
  await seo.getByRole('button', { name: 'Change the link for Description' }).click();
  const menu = seo.getByRole('dialog', { name: 'Link Description' });
  await menu.getByRole('textbox', { name: 'Find a field' }).fill('summary');
  await menu.getByRole('group', { name: 'Article' }).getByRole('option', { name: /^Summary, / }).click();
  await expect(seo.getByRole('combobox', { name: 'Description', exact: true })).toContainText('Summary');
});
