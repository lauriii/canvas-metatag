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
 * `headless`, `ai` and `complex` (the coupled site plus the complex content
 * fixture). `host-contract` is the coupled seed too: it is a project
 * of its own only so that it runs first, and so that a Canvas change which
 * breaks the editor integration fails once, loudly, instead of in every spec.
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
      testMatch: ['page.spec.ts', 'template.spec.ts', 'site.spec.ts', 'access.spec.ts'],
      dependencies: ['host-contract'],
      use,
    },
    { name: 'headless', testMatch: 'headless.spec.ts', dependencies: ['host-contract'], use },
    { name: 'ai', testMatch: 'ai.spec.ts', dependencies: ['host-contract'], use },
    { name: 'complex', testMatch: 'template-complex.spec.ts', dependencies: ['host-contract'], use },
  ],
});
