import { readFileSync, writeFileSync } from 'node:fs';
import * as nodeModule from 'node:module';

import type * as Recipe from '../../examples/headless-next/canvas-head';
import type { APIRequestContext } from '@playwright/test';

import { NODES, PAGES } from './constants';
import { contentHead, drupalFile, expect, test } from './fixture';

/**
 * The README's recipe for `@drupal-canvas/headless-next`, run on the module's
 * real content API heads: `examples/headless-next/canvas-head.tsx`, with the
 * packages its lockfile pins (`npm ci` in that folder first).
 *
 * The framework's metadata renderer is not a public API, so nothing here
 * renders through it: each row is looked for in the member the framework
 * renders it from. The rendered HTML is checked by hand with a running app.
 */

type Head = Parameters<typeof Recipe.canvasMetadata>[0];
type Metadata = ReturnType<typeof Recipe.canvasMetadata>;

/** The example folder, where the helper and its packages are. */
const EXAMPLE = new URL('../../examples/headless-next/', import.meta.url);
const exampleRequire = nodeModule.createRequire(new URL('package.json', EXAMPLE));

/** Canvas's adapter, in the Canvas codebase under test. */
const CANVAS = process.env.CANVAS_METATAG_CANVAS_DIR ?? 'modules/contrib/canvas';

// The adapter imports `next/headers`, which only the framework's bundler
// resolves; Node needs the file name, given by module.registerHooks() (Node
// 22.15 or later). Without it the tests that run the recipe are skipped,
// saying so, on a developer's machine; in CI they fail, so that the recipe
// is never passed by being skipped. The README test needs no hooks.
const registerHooks = (nodeModule as Partial<typeof nodeModule>).registerHooks;
const NO_HOOKS = `Node ${process.version} has no module.registerHooks(): running the recipe needs Node 22.15 or later.`;
if (!registerHooks && process.env.CI) {
  throw new Error(NO_HOOKS);
}
/** Skips a test that runs the recipe where Node can't load it. */
const needsHooks = () => test.skip(!registerHooks, NO_HOOKS);
registerHooks?.({
  resolve: (specifier, context, next) => next(/^next\/[\w-]+$/.test(specifier) ? `${specifier}.js` : specifier, context),
});
const recipe = (registerHooks ? await import('../../examples/headless-next/canvas-head') : undefined) as typeof Recipe;

/** The heads of the article, the Pricing page and a page without a description. */
async function contentHeads(request: APIRequestContext): Promise<Record<'article' | 'pricing' | 'noDescription', Head>> {
  const read = async (path: string) => (await contentHead(request, path.slice(1))) as unknown as Head;
  return { article: await read(NODES.article.path), pricing: await read(PAGES.pricing.path), noDescription: await read(PAGES.stored.path) };
}

/**
 * The rows and links of a head that the metadata does not hold, by name.
 * A row with no known member throws, naming the row: a row a later change
 * adds must be mapped by the recipe, and here.
 */
function lost(metadata: Metadata, head: Head): string[] {
  const og = (metadata.openGraph ?? {}) as Record<string, unknown>;
  const images = ((og.images as unknown[]) ?? []).map((image) => (typeof image === 'string' ? { url: image } : image)) as Record<
    string,
    unknown
  >[];
  const twitter = (metadata.twitter ?? {}) as Record<string, unknown>;
  const other = (metadata.other ?? {}) as Record<string, unknown>;
  const alternates = (metadata.alternates ?? {}) as { canonical?: unknown; languages?: Record<string, unknown> };
  const same = (value: unknown, content: string) => [value].flat().some((one) => String(one) === content);
  let image = -1;
  const missing: string[] = [];
  for (const row of head.meta ?? []) {
    const key = row.name ?? row.property;
    const content = row.content;
    if (key === 'og:image') {
      image++;
    }
    const member: Record<string, () => unknown> = {
      description: () => metadata.description,
      robots: () => other.robots,
      'twitter:card': () => twitter.card,
      'og:type': () => og.type,
      'og:site_name': () => og.siteName,
      'og:title': () => og.title,
      'og:description': () => og.description,
      'og:url': () => og.url,
      'og:locale': () => og.locale,
      'og:locale:alternate': () => og.alternateLocale,
      'og:image': () => images[image]?.url,
      'og:image:width': () => images[image]?.width,
      'og:image:height': () => images[image]?.height,
      'og:image:alt': () => images[image]?.alt,
      'og:image:type': () => images[image]?.type,
      'article:published_time': () => og.publishedTime,
      'article:modified_time': () => og.modifiedTime,
    };
    if (!key || !(key in member)) {
      throw new Error(`No metadata member is known for the row ${JSON.stringify(row)}: map it in the recipe and here.`);
    }
    if (!same(member[key](), content)) {
      missing.push(key);
    }
  }
  for (const { rel, href, hreflang } of head.link ?? []) {
    const value = rel === 'canonical' ? alternates.canonical : rel === 'alternate' && hreflang ? alternates.languages?.[hreflang] : undefined;
    if (rel !== 'canonical' && !(rel === 'alternate' && hreflang)) {
      throw new Error(`No metadata member is known for the link ${JSON.stringify({ rel, href, hreflang })}.`);
    }
    const urls = [value].flat().map((one) => (one && typeof one === 'object' ? (one as { url: unknown }).url : one));
    if (!urls.some((url) => String(url) === href)) {
      missing.push(`link ${rel}${hreflang ? ` ${hreflang}` : ''}`);
    }
  }
  return missing;
}

/** What the JSON-LD component renders, as markup. */
function jsonLd(head: Head): string {
  const { createElement } = exampleRequire('react') as { createElement: (type: unknown, props: unknown) => unknown };
  const { renderToStaticMarkup } = exampleRequire('react-dom/server') as {
    renderToStaticMarkup: (element: unknown) => string;
  };
  return renderToStaticMarkup(createElement(recipe.CanvasJsonLd, { head }));
}

test('the recipe keeps every row', async ({ visitor }) => {
  needsHooks();
  const heads = await contentHeads(visitor.request);
  for (const [name, head] of Object.entries(heads)) {
    expect(lost(recipe.canvasMetadata(head), head), name).toEqual([]);
  }
  // What the article's head is for: one image with its details, and its times.
  const og = recipe.canvasMetadata(heads.article).openGraph as Record<string, unknown>;
  expect(og.images).toEqual([
    expect.objectContaining({ url: expect.any(String), width: '1200', height: '630', alt: expect.any(String) }),
  ]);
  expect(og.publishedTime).toEqual(expect.any(String));
  expect(og.modifiedTime).toEqual(expect.any(String));
});

test('absent means none', async ({ visitor }) => {
  needsHooks();
  const heads = await contentHeads(visitor.request);
  const description = heads.noDescription;
  expect(description.meta?.some(({ name }) => name === 'description')).toBe(false);
  const metadata = recipe.canvasMetadata(description);
  expect(Object.hasOwn(metadata, 'description')).toBe(true);
  expect(metadata.description).toBe('');

  const unaddressed = { ...heads.pricing, link: heads.pricing.link?.filter(({ rel }) => !['canonical', 'alternate'].includes(rel)) };
  const without = recipe.canvasMetadata(unaddressed);
  expect(Object.hasOwn(without, 'alternates')).toBe(true);
  expect(without.alternates).toBeNull();
  // A head that has them keeps them.
  expect(recipe.canvasMetadata(heads.pricing).alternates).toEqual(expect.objectContaining({ canonical: expect.any(String) }));
});

test('JSON-LD', async ({ visitor }) => {
  needsHooks();
  const heads = await contentHeads(visitor.request);
  const tricky = '</script><script>alert(1)</script> & \u2028 end';
  const fixture: Head = {
    title: 'Fixture',
    script: [{ type: 'application/ld+json', textContent: { '@context': 'https://schema.org', name: tricky } }],
  };
  for (const head of [heads.article, heads.pricing, fixture]) {
    const markup = jsonLd(head);
    const scripts = [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
    expect(scripts).toHaveLength(1);
    expect(markup).toBe(scripts[0][0]);
    const text = scripts[0][1];
    expect(text.toLowerCase()).not.toContain('</script');
    // A line separator ends a line in a script: always escaped.
    expect(text).not.toContain('\u2028');
    expect(JSON.parse(text)).toEqual(head.script?.[0].textContent);
  }
  expect(jsonLd(fixture)).not.toContain('&');
});

// The adapter alone loses exactly these: the upstream draft
// canvas-sdk-next-head.md of the change complete-the-headless-frontend asks
// Canvas to keep them.
// When a Canvas release keeps them, this fails: raise the example's pins,
// trim the recipe and this list.
const ADAPTER_LOSES = ['og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt', 'article:published_time', 'article:modified_time'];

test('the adapter alone', async ({ visitor }, testInfo) => {
  needsHooks();
  // head.ts imports types only, so it runs as it is.
  const file = testInfo.outputPath('head.ts');
  writeFileSync(file, await drupalFile(`${CANVAS}/packages/headless-next/src/head.ts`));
  const { toNextMetadata } = (await import(file)) as { toNextMetadata: typeof Recipe.canvasMetadata };

  const head = (await contentHeads(visitor.request)).article;
  const metadata = toNextMetadata(head);
  expect(lost(metadata, head)).toEqual(ADAPTER_LOSES);
  // And the script: the framework's metadata has no member for it.
  expect(JSON.stringify(metadata)).not.toContain('@graph');
  expect(head.script).toHaveLength(1);
});

test('the README quotes the helper', () => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const quote = readme.match(/<!-- canvas-head\.tsx -->\n```tsx\n([\s\S]*?)```\n<!-- \/canvas-head\.tsx -->/);
  expect(quote, 'the README block between the canvas-head.tsx markers').not.toBeNull();
  expect(quote?.[1]).toBe(readFileSync(new URL('canvas-head.tsx', EXAMPLE), 'utf8'));
});
