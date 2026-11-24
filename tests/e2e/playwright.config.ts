import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Canvas Metatag e2e suite.
 *
 * Site lifecycle and teardown live in the fixtures (see fixture.ts), built on
 * Drupal core's `@drupal/playwright`: every spec file gets its own seeded
 * sandbox, reached over the site's base URL (`DRUPAL_TEST_BASE_URL`) by
 * carrying the test cookie. `ignoreHTTPSErrors` covers a self-signed
 * certificate.
 *
 * The four seeds of CanvasMetatagTestSetup are the projects `coupled`,
 * `headless` (also `headless-frontend`), `ai` and `complex` (the coupled site plus the complex content
 * fixture). `host-contract` is the coupled seed too: it is a project
 * of its own only so that it runs first, and so that a Canvas change which
 * breaks the editor integration fails once, loudly, instead of in every spec.
 * `schema-kinds` is the coupled seed: the newer kinds' sheets and controls.
 * `schema-templates` is the complex seed plus courses and a page that lists
 * them: recipes, job postings and the list page, set up on content types.
 * Use `--no-deps` to run one project without it.
 */
const use = {
  ...devices['Desktop Chrome'],
  // Canvas needs a wide window; the SEO dialog is then 468 pixels wide.
  viewport: { width: 1600, height: 1000 },
};

export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.DRUPAL_TEST_BASE_URL ?? 'http://localhost',
    ignoreHTTPSErrors: true,
    // Typed dates and the previews' number formats depend on it.
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'host-contract', testMatch: 'host-contract.spec.ts', use },
    {
      name: 'coupled',
      testMatch: ['page.spec.ts', 'template.spec.ts', 'site.spec.ts', 'access.spec.ts', 'schema.spec.ts', 'custom-form.spec.ts'],
      dependencies: ['host-contract'],
      use,
    },
    { name: 'headless', testMatch: 'headless.spec.ts', dependencies: ['host-contract'], use },
    // The headless seed: the README's recipe for the metadata adapter, run
    // on its heads (needs `npm ci` in examples/headless-next).
    { name: 'headless-frontend', testMatch: 'headless-frontend.spec.ts', dependencies: ['host-contract'], use },
    { name: 'ai', testMatch: 'ai.spec.ts', dependencies: ['host-contract'], use },
    { name: 'complex', testMatch: ['template-complex.spec.ts', 'compose.spec.ts'], dependencies: ['host-contract'], use },
    // The composer's keys, caret and selection in the other engines (design
    // D10 of compose-values-from-fields): the complex seed, one engine at a time.
    { name: 'compose-firefox', testMatch: 'compose.spec.ts', dependencies: ['host-contract'], use: { browserName: 'firefox', viewport: use.viewport } },
    { name: 'compose-webkit', testMatch: 'compose.spec.ts', dependencies: ['host-contract'], use: { browserName: 'webkit', viewport: use.viewport } },
    { name: 'schema-kinds', testMatch: 'schema-kinds.spec.ts', dependencies: ['host-contract'], use },
    {
      name: 'schema-templates',
      testMatch: ['schema-recipe.spec.ts', 'schema-job.spec.ts', 'schema-list-page.spec.ts'],
      dependencies: ['host-contract'],
      use,
    },
  ],
});
