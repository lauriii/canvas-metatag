import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { Drupal } from '@drupal/playwright';
import type { DrupalSite } from '@drupal/playwright';
import { test as base, expect } from '@playwright/test';
import type { FrameLocator, Locator, Page, Response } from '@playwright/test';

import { TEST_ID } from './constants';

/**
 * Playwright harness for the Canvas Metatag e2e suite, built on Drupal core's
 * official `@drupal/playwright` package (the same one Canvas uses).
 *
 * `@drupal/playwright`'s own `Drupal.install()` installs a bare `minimal` site
 * with no way to run a PHP setup file, but this suite's fixtures (pages, an
 * Article type with an enabled content template, images, people) are
 * provisioned by CanvasMetatagTestSetup. So we install with
 * `test-site.php --setup-file` ourselves, then hand the resulting site to the
 * package's `Drupal` page object for the test cookie and for signing in.
 *
 * Every spec file gets a sandbox of its own, installed before its first test
 * and removed before the next file's: the specs publish pages and change site
 * settings, so they must not see each other's leftovers. Tests inside a file
 * share the sandbox and run in order.
 *
 * Environment:
 * - DRUPAL_TEST_BASE_URL: where the web server serves the docroot.
 * - DRUPAL_TEST_DB_URL: the sandbox database.
 * - DRUPAL_TEST_DRUPAL_ROOT: the docroot, when it is not above the cwd.
 * - DRUPAL_TEST_WEBSERVER_USER: run the Drupal CLI as this user, so that the
 *   sandbox files belong to the user the web server runs as.
 * - CANVAS_METATAG_E2E_CLI: a command prefix that reaches the Drupal CLI in
 *   its docroot, for when Playwright runs outside the web container, for
 *   example `docker exec -w /var/www/html/web <container>`.
 * - CANVAS_METATAG_SETUP_FILE: the setup file, relative to the docroot.
 * - DRUPAL_TEST_PLAYWRIGHT_SKIP_TEARDOWN=true keeps the sandboxes.
 *
 * @see \Drupal\Tests\canvas_metatag\TestSite\CanvasMetatagTestSetup
 */

const execFileAsync = promisify(execFile);

/**
 * Setup-file path, relative to the Drupal root. A local site has the module at
 * modules/contrib; drupal.org CI symlinks it under modules/custom, so the CI
 * job overrides this.
 */
const SETUP_FILE =
  process.env.CANVAS_METATAG_SETUP_FILE ??
  'modules/contrib/canvas_metatag/tests/src/TestSite/CanvasMetatagTestSetup.php';

const BASE_URL = (process.env.DRUPAL_TEST_BASE_URL ?? 'http://localhost').replace(/\/?$/, '/');
const DB_URL = process.env.DRUPAL_TEST_DB_URL ?? 'sqlite://localhost/sites/default/files/.ht.sqlite';
const CLI = process.env.CANVAS_METATAG_E2E_CLI ?? '';

/** The environment flag CanvasMetatagTestSetup reads, by Playwright project. */
const FLAGS: Record<string, string> = {
  headless: 'CANVAS_METATAG_E2E_HEADLESS=1',
  ai: 'CANVAS_METATAG_E2E_AI=1',
  complex: 'CANVAS_METATAG_E2E_COMPLEX=1',
};

/**
 * The Drupal root the CLI runs from: DRUPAL_TEST_DRUPAL_ROOT if set, else walk
 * up from the cwd looking for the docroot, as `@drupal/playwright` does.
 */
function drupalRoot(): string {
  if (process.env.DRUPAL_TEST_DRUPAL_ROOT) {
    return process.env.DRUPAL_TEST_DRUPAL_ROOT;
  }
  let dir = process.cwd();
  for (let i = 0; i < 15; i++) {
    if (existsSync(`${dir}/index.php`) && existsSync(`${dir}/core/lib/Drupal.php`)) {
      return dir;
    }
    dir = resolve(dir, '..');
  }
  throw new Error('Unable to find Drupal root directory.');
}

/** Runs a Drupal CLI command in the docroot. */
async function exec(command: string): Promise<string> {
  const user = process.env.DRUPAL_TEST_WEBSERVER_USER;
  const full = [CLI, user ? `sudo -u ${user}` : '', command].filter(Boolean).join(' ');
  const { stdout } = await execFileAsync('bash', ['-c', full], {
    cwd: CLI ? undefined : drupalRoot(),
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

/** Installs a sandbox seeded by CanvasMetatagTestSetup for one project. */
async function installSeededSite(project: string): Promise<DrupalSite> {
  // `env` carries the flag past sudo and into a container alike.
  const stdout = await exec(
    `env ${FLAGS[project] ?? ''} php core/scripts/test-site.php install --no-interaction` +
      ` --setup-file ${SETUP_FILE} --install-profile minimal` +
      ` --base-url ${BASE_URL} --db-url ${DB_URL} --json`,
  );
  const line = stdout
    .split('\n')
    .map((l) => l.trim())
    .reverse()
    .find((l) => l.startsWith('{'));
  if (!line) {
    throw new Error(`installSeededSite: no JSON in test-site.php output:\n${stdout}`);
  }
  const data = JSON.parse(line) as { db_prefix: string; user_agent: string; site_path: string };
  return {
    dbPrefix: data.db_prefix,
    userAgent: data.user_agent,
    sitePath: data.site_path,
    url: BASE_URL,
    teardown: async () =>
      process.env.DRUPAL_TEST_PLAYWRIGHT_SKIP_TEARDOWN === 'true'
        ? ''
        : exec(`php core/scripts/test-site.php tear-down --no-interaction --db-url ${DB_URL} ${data.db_prefix}`),
  };
}

interface Sandbox {
  file: string;
  site: DrupalSite | null;
}

export const test = base.extend<{ site: DrupalSite; drupal: Drupal; visitor: Page }, { sandbox: Sandbox }>({
  // Relative paths ("./pricing") only resolve beneath a base URL that ends
  // with a slash, which matters when Drupal is served from a subdirectory.
  baseURL: async ({ baseURL }, use) => {
    await use(baseURL?.replace(/\/?$/, '/'));
  },
  sandbox: [
    async ({}, use) => {
      const sandbox: Sandbox = { file: '', site: null };
      await use(sandbox);
      await sandbox.site?.teardown();
    },
    { scope: 'worker', timeout: 600_000 },
  ],
  // The sandbox of the spec file this test is in.
  site: [
    async ({ sandbox }, use, testInfo) => {
      if (sandbox.file !== testInfo.file || !sandbox.site) {
        await sandbox.site?.teardown();
        sandbox.site = null;
        sandbox.site = await installSeededSite(testInfo.project.name);
        sandbox.file = testInfo.file;
      }
      await use(sandbox.site);
    },
    // Installing and removing a site can each take minutes in a slow container.
    { auto: true, timeout: 900_000 },
  ],
  // Specs sign in themselves, as one of USERS: `drupal.login(USERS.editor)`.
  drupal: [
    async ({ page, site }, use) => {
      const drupal = new Drupal({ page, drupalSite: site });
      await drupal.setTestCookie();
      await use(drupal);
    },
    { auto: true },
  ],
  // A signed-out browser on the same sandbox, with scripts off: what it reads
  // is the HTML a crawler receives. `visitor.request` is its API client.
  visitor: async ({ browser, site }, use) => {
    const context = await browser.newContext({
      baseURL: site.url,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: false,
    });
    await context.addCookies([
      { name: 'SIMPLETEST_USER_AGENT', value: encodeURIComponent(site.userAgent), url: site.url },
    ]);
    await use(await context.newPage());
    await context.close();
  },
});

export { expect };

// ---------------------------------------------------------------------------
// The Canvas editor (the host). These selectors are Canvas's own.
// ---------------------------------------------------------------------------

export const SEO_IFRAME = 'iframe#canvas-extension-iframe-canvas_metatag';

const sideMenu = (page: Page) => page.getByTestId('canvas-side-menu');

/** Opens the editor of a Canvas page and waits until it owns the page. */
export async function openPage(page: Page, id: number): Promise<void> {
  await page.goto(`./canvas/editor/canvas_page/${id}`);
  await expect(page.getByTestId('canvas-publish-review')).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(() => page.evaluate(() => window.drupalSettings?.canvas?.store?.getState().pageDataOwner?.entityId ?? null), {
      timeout: 60_000,
    })
    .toBe(String(id));
}

/** Opens the Full template editor of a node type, previewing one node. */
export async function openTemplate(page: Page, previewId: number, bundle = 'article'): Promise<void> {
  await page.goto(`./canvas/template/node/${bundle}/full/${previewId}`);
  await expect(page.getByTestId('canvas-publish-review')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('select-content-preview-item')).toBeVisible({ timeout: 60_000 });
}

/** Opens the SEO dialog from the Extensions panel. */
export async function openSeo(page: Page): Promise<FrameLocator> {
  const launcher = page.getByTestId('canvas-primary-panel').getByRole('button', { name: /SEO/ });
  if (!(await launcher.isVisible())) {
    await sideMenu(page).getByLabel('Extensions').click();
  }
  await launcher.click();
  await expect(page.locator(SEO_IFRAME)).toBeAttached();
  return page.frameLocator(SEO_IFRAME);
}

/** Clicks a side-menu button, which closes the dialog and destroys its frame. */
export async function closeSeo(page: Page, panel = 'Layers'): Promise<void> {
  await sideMenu(page).getByLabel(panel).click();
  await expect(page.locator(SEO_IFRAME)).toHaveCount(0);
}

/** Switches the editor to another page with its page list: no page load. */
export async function switchPage(page: Page, id: number): Promise<void> {
  await page.getByTestId('canvas-navigation-button').click();
  await page.locator(`[data-canvas-page-id="${id}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/canvas/editor/canvas_page/${id}$`));
}

/** Selects a component of the page, by clicking its outline in the preview. */
export async function selectComponent(page: Page, uuid: string): Promise<void> {
  const outline = page.locator(`#canvasPreviewOverlay [data-canvas-uuid="${uuid}"]`).first();
  await expect(outline).toBeAttached({ timeout: 60_000 });
  // The SEO dialog may cover it, so the events are dispatched, as Canvas's
  // own tests do.
  await outline.evaluate((element) => {
    for (const type of ['mousedown', 'mouseup', 'click']) {
      element.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, button: 0 }));
    }
  });
  await expect(page.getByTestId('canvas-contextual-panel--settings')).toBeVisible();
}

/** True for a response to one of the editor's own saves of a page. */
export const isLayoutSave = (id: number) => (response: Response) =>
  new URL(response.url()).pathname.endsWith(`/canvas/api/v0/layout/canvas_page/${id}`) &&
  ['POST', 'PATCH'].includes(response.request().method());

/** Whether the editor has reported a conflict. */
export const editorConflict = (page: Page): Promise<boolean> =>
  page.evaluate(() => window.drupalSettings.canvas.store.getState().queryError?.latestError?.status === '409');

/** Opens "Review changes" and returns the rows that mention `text`. */
export async function reviewRows(page: Page, text: string | RegExp): Promise<Locator> {
  const panel = page.getByTestId('canvas-publish-reviews-content');
  if (!(await panel.isVisible())) {
    await page.getByTestId('canvas-publish-review').click();
  }
  await expect(panel).toBeVisible();
  return panel.getByTestId('pending-change-row').filter({ hasText: text });
}

/** Closes "Review changes" if it is open. */
export async function closeReview(page: Page): Promise<void> {
  const panel = page.getByTestId('canvas-publish-reviews-content');
  if (await panel.isVisible()) {
    // Canvas may close it itself while its preview re-renders, and a click
    // would then wait for a button that never comes back. The panel being
    // hidden is what counts.
    await panel
      .getByLabel('Close')
      .click({ timeout: 10_000 })
      .catch(() => undefined);
  }
  await expect(panel).toBeHidden();
}

/** Publishes everything in "Review changes". */
export async function publishAll(page: Page): Promise<void> {
  const trigger = page.getByTestId('canvas-publish-review');
  await expect(trigger).toHaveText(/^Review \d+ changes?$/, { timeout: 30_000 });
  await trigger.click();
  await page.getByLabel('Select all changes', { exact: true }).click();
  await page.getByRole('button', { name: /^Publish \d+ selected/ }).click();
  await expect(page.getByText('All changes published!')).toBeVisible({ timeout: 60_000 });
  await closeReview(page);
}

// ---------------------------------------------------------------------------
// The SEO dialog. Role and accessible name, plus the four test ids.
// ---------------------------------------------------------------------------

export const tab = (frame: FrameLocator, name: string | RegExp) => frame.getByRole('tab', { name, exact: true });
export const textbox = (frame: FrameLocator, name: string) => frame.getByRole('textbox', { name, exact: true });
export const button = (frame: FrameLocator, name: string | RegExp) => frame.getByRole('button', { name, exact: true });
export const status = (frame: FrameLocator) => frame.getByTestId(TEST_ID.status);
/** A full-frame sheet: "Checks", "Output", "Choose image", "Custom JSON-LD". */
export const sheet = (frame: FrameLocator, name: string) => frame.getByRole('region', { name, exact: true });

/** Switches scope with the scope menu in the header. */
export async function scope(frame: FrameLocator, name: string): Promise<void> {
  await frame.getByRole('button', { name: /^(This page|Every \w+|Site)$/ }).click();
  await frame.getByRole('menuitemradio', { name, exact: true }).click();
  await expect(frame.getByRole('button', { name, exact: true })).toBeVisible();
}

/** Sets the caret of a text field after the first occurrence of `text`. */
export async function caretAfter(field: Locator, text: string): Promise<void> {
  await field.evaluate((element, needle) => {
    const input = element as HTMLTextAreaElement;
    const at = input.value.indexOf(needle) + needle.length;
    input.focus();
    input.setSelectionRange(at, at);
  }, text);
}

/** What the dialog's Output lists, as name => value. */
export async function outputRows(frame: FrameLocator): Promise<Record<string, string>> {
  const list = frame.getByTestId(TEST_ID.output);
  await expect(list).toBeVisible();
  const names = await list.getByRole('term').allTextContents();
  const values = await list.getByRole('definition').allTextContents();
  return Object.fromEntries(names.map((name, i) => [name.trim(), (values[i] ?? '').trim()]));
}

// ---------------------------------------------------------------------------
// Server truth: the module's own API, and the HTML a visitor receives.
// ---------------------------------------------------------------------------

export interface JsonLd {
  '@context': string;
  '@graph': Array<Record<string, unknown> & { '@id'?: string; '@type'?: string }>;
}

/** The `head` the module emits, for coupled and for headless delivery. */
export interface ApiHead {
  title: string;
  meta: Array<{ name?: string; property?: string; content: string }>;
  link: Array<{ rel: string; href: string; hreflang?: string }>;
  script: Array<{ type: string; textContent: JsonLd }>;
}

/** The parts of `GET /canvas-metatag/api/state` the specs read. */
export interface SeoState {
  can: { target: boolean; site: boolean };
  site: { identity: { name: string; same_as: string[] } };
  capabilities: { ai: { available: boolean; reason: string | null } | null };
  target: { values: { title?: { text: string } | Record<string, unknown> } & Record<string, unknown>; has_draft: boolean } | null;
  facts: Record<string, { label: string; kind: string; value: string }>;
  resolved: { head: ApiHead; schema?: { nodes: { origin: string }[] } } | null;
}

export const pageQuery = (id: number) => `entity_type=canvas_page&id=${id}`;

/** Reads the state API as the signed-in user. */
export async function seoState(page: Page, query: string): Promise<SeoState> {
  const response = await page.request.get(`./canvas-metatag/api/state?${query}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as SeoState;
}

/** The stored-or-draft typed title of a page (its main part), for polling. */
export const draftTitle = async (page: Page, id: number): Promise<string | undefined> => {
  const title = (await seoState(page, pageQuery(id))).target?.values.title;
  return title && typeof title.text === 'string' ? title.text : undefined;
};

/**
 * Writes SEO values into a Canvas draft as another editor session would: with
 * a client id that is not the open editor's, and the draft's current hash.
 *
 * @param target `canvas_page/2` or `content_template/node.article.full`.
 * @param layout The Canvas layout route of the target, which reports the hash.
 */
export async function writeDraft(
  page: Page,
  target: string,
  layout: string,
  values: Record<string, unknown>,
): Promise<void> {
  const token = await (await page.request.get('./session/token')).text();
  const { autoSaves } = (await (await page.request.get(`./canvas/api/v0/${layout}`)).json()) as {
    autoSaves: Record<string, unknown>;
  };
  const response = await page.request.put(`./canvas-metatag/api/draft/${target}`, {
    headers: { 'X-CSRF-Token': token },
    data: {
      values,
      client_instance_id: 'e2e-another-session',
      auto_saves: autoSaves,
      // The page route names the translation; the template route has none.
      ...(target.startsWith('canvas_page/') ? { langcode: 'en' } : {}),
    },
  });
  expect(response.status(), await response.text()).toBe(200);
}

/** The head of a page as a visitor's browser parses it. */
export interface PageHead {
  /** Text of every `<title>` in `<head>`. */
  titles: string[];
  /** Every `content`, by `name` or `property`. */
  meta: Record<string, string[]>;
  links: Array<{ rel: string; href: string; hreflang: string | null }>;
  jsonLd: JsonLd[];
}

export async function readHead(visitor: Page, path: string): Promise<PageHead> {
  const response = await visitor.goto(path);
  expect(response?.status(), path).toBe(200);
  return visitor.evaluate(() => {
    const meta: Record<string, string[]> = {};
    for (const element of document.head.querySelectorAll('meta[content]')) {
      const key = element.getAttribute('name') ?? element.getAttribute('property');
      if (key) {
        (meta[key] ??= []).push(element.getAttribute('content') ?? '');
      }
    }
    return {
      titles: [...document.head.querySelectorAll('title')].map((title) => title.textContent ?? ''),
      meta,
      links: [...document.querySelectorAll('link[rel]')].map((link) => ({
        rel: link.getAttribute('rel') ?? '',
        href: link.getAttribute('href') ?? '',
        hreflang: link.getAttribute('hreflang'),
      })),
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (script) => JSON.parse(script.textContent ?? ''),
      ),
    };
  });
}

/** The one link with this `rel` and no `hreflang`, or fails. */
export function link(head: PageHead, rel: string): string {
  const found = head.links.filter((candidate) => candidate.rel === rel && candidate.hreflang === null);
  expect(found, `<link rel="${rel}">`).toHaveLength(1);
  return found[0].href;
}

/** The node of a graph whose `@id` ends with `suffix`, or fails. */
export function graphNode(jsonLd: JsonLd, suffix: string): Record<string, unknown> {
  const found = jsonLd['@graph'].filter((node) => node['@id']?.endsWith(suffix));
  expect(found, `a node with an @id ending in ${suffix}`).toHaveLength(1);
  return found[0];
}
