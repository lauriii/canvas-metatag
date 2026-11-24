import { afterEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '../data.test-helper';
import { pageValue } from './CustomSheet';
import type { Problem } from './doc';
import { keepTab, readTab } from './drafts';
import { notSaved, savable, withRefusal } from './problems';
import { project } from './project';
import { backLabel, detailsExample, mergeWords, restorePaste, typeChangeWords, unexpectedKeys } from './sheet';
import type { Vocabulary } from './vocab';

describe('Back goes up one level at a time', () => {
  it('is named for where it goes', () => {
    expect(backLabel('item', 3)).toBe('Back to all items');
    expect(backLabel('item', 1)).toBe('Back');
    expect(backLabel('search', 2)).toBe('Back to all items');
    expect(backLabel('search', 1)).toBe('Back to your item');
    expect(backLabel('review', 0)).toBe('Back');
    expect(backLabel('review', 2)).toBe('Back to all items');
    // Opened from What this page is: back there, whatever the page holds.
    expect(backLabel('search', 2, { entry: 'What this page is' })).toBe('Back to What this page is');
    // Opened from Output: back there, or to Site while its change waits.
    expect(backLabel('item', 1, { node: '#primary', from: 'Add details to Oak desk' })).toBe('Back to Output');
    expect(backLabel('item', 1, { node: '#identity', from: 'Add details to Acme', siteDirty: true })).toBe('Back to Site settings');
  });
});

describe('the tab is remembered per viewer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('survives storage that throws: Form, and no error', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(readTab()).toBe('form');
    expect(() => keepTab('json')).not.toThrow();
  });

  it('remembers the last tab', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } });
    keepTab('json');
    expect(readTab()).toBe('json');
  });
});

describe('added details', () => {
  const product = { '@type': 'Product', name: 'Oak desk lamp', offers: { '@type': 'Offer', price: '89', priceCurrency: 'EUR' } };
  const label = (path: string) => (path === 'offers.price' ? 'the Price field' : 'the page');

  it('say what they add and where the page wins', () => {
    const words = mergeWords(product, { sku: 'OAK-DL-01', offers: { price: 79, itemCondition: 'https://schema.org/NewCondition' } }, label);
    expect(words.adds).toEqual(['sku', 'offers.itemCondition']);
    expect(words.clashes).toEqual([{ path: 'offers.price', from: 'the Price field', leaf: true }]);
  });

  it('name a selector that matches no item', () => {
    const plans = { '@type': 'Service', offers: [{ '@type': 'Offer', name: 'Growth' }] };
    expect(mergeWords(plans, { 'offers[name=Pro]': { eligibleQuantity: 5 }, 'offers[name=Growth]': { eligibleQuantity: 5 } }, label)).toEqual({ adds: ['offers[name=Growth]'], clashes: [], unmatched: ['offers[name=Pro]'] });
  });

  it('show the page’s values in the stage’s words', () => {
    const name = (id: string) => (id.endsWith('#logo') ? 'Humanify Studio logo' : null);
    expect(pageValue({ '@type': 'Offer', price: 2500, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' }, { name, ui: 'en' })).toBe('€2,500, in stock');
    expect(pageValue({ '@id': 'https://example.com/#logo' }, { name, ui: 'en' })).toBe('Humanify Studio logo');
    expect(pageValue('https://schema.org/NewCondition', { name, ui: 'en' })).toBe('New condition');
  });

  it('a page node judged on a hand-added item is not: Q&A is the page’s', () => {
    // A hand-added Q&A page has no "Needed for Q&A"; the page itself does.
    expect(project({ '@type': 'QAPage' }, RULES, null).feature).toBe(false);
    expect(project({ '@type': 'QAPage' }, RULES, null, null, [], false).feature).toBe(true);
  });
});

describe('Back from JSON and from an entry point', () => {
  it('leaves the sheet in JSON, and returns to where the type search was opened', () => {
    expect(backLabel('item', 3, { json: true })).toBe('Back');
    expect(backLabel('item', 3, { json: true, from: 'Add your own JSON-LD' })).toBe('Back to Output');
    expect(backLabel('search', 0, { entry: 'What this page is' })).toBe('Back to What this page is');
  });
});

const VOCAB: Vocabulary = {
  release: '30.1',
  licence: '',
  attribution: '',
  types: { Thing: { parents: [] }, Rating: { parents: ['Thing'] }, AggregateRating: { parents: ['Rating'] }, EmployerAggregateRating: { parents: ['AggregateRating'] }, Organization: { parents: ['Thing'] } },
  properties: {
    name: { domains: ['Thing'], ranges: ['Text'] },
    ratingValue: { domains: ['Rating'], ranges: ['Number', 'Text'] },
    bestRating: { domains: ['Rating'], ranges: ['Number', 'Text'] },
    ratingCount: { domains: ['AggregateRating'], ranges: ['Integer'] },
    itemReviewed: { domains: ['AggregateRating'], ranges: ['Thing'] },
    telephone: { domains: ['Organization'], ranges: ['Text'] },
  },
  members: {},
};

describe('added details merge as the server merges them', () => {
  it('a clash on an object: its other details are added', () => {
    const node = { '@type': 'Product', seller: { '@type': 'Organization', name: 'Acme' }, sku: 'OAK' };
    const words = mergeWords(node, { seller: { name: 'Other', telephone: '1' }, sku: 'X', color: 'Oak' }, (at) => (at === 'sku' ? 'the SKU field' : 'the page'));
    expect(words.adds).toEqual(['seller.telephone', 'color']);
    expect(words.clashes).toEqual([
      { path: 'seller.name', from: 'the page', leaf: true },
      { path: 'sku', from: 'the SKU field', leaf: true },
    ]);
    // An object given in place of the page's value: a clash, its other details added.
    expect(mergeWords({ '@type': 'Product', brand: 'Acme' }, { brand: { '@type': 'Brand', name: 'Acme' } }, () => 'the page').clashes).toEqual([{ path: 'brand', from: 'the page', leaf: false }]);
  });
});

describe('a type change', () => {
  const item = { '@type': 'Rating', itemReviewed: { '@id': '#acme' }, ratingValue: 4.2, ratingCount: 318, telephone: '1' };
  it('never counts what the new type inherits as unexpected', () => {
    expect(unexpectedKeys(item, 'EmployerAggregateRating', RULES, VOCAB)).toEqual(['telephone']);
    expect(unexpectedKeys(item, 'Rating', RULES, VOCAB)).toEqual(['itemReviewed', 'ratingCount', 'telephone']);
    // Without the vocabulary nothing is known to be unexpected.
    expect(unexpectedKeys(item, 'Rating', RULES, null)).toEqual([]);
  });
  it('says what it keeps', () => {
    expect(typeChangeWords(2, 'Rating', RULES)).toBe("2 details aren't expected on a rating. They're kept, and search features may ignore them.");
    expect(typeChangeWords(1, 'EmployerAggregateRating', RULES)).toBe("1 detail isn't expected on an employer rating. It's kept, and search features may ignore it.");
  });
});

describe('Undo clean-up', () => {
  it('puts back the exact paste, alone or after the items there were', () => {
    const paste = '{"@context": "https://schema.org", "@type": "Rating", "ratingValue": 4}';
    expect(restorePaste('', `  ${paste}\n`)).toBe(paste);
    expect(JSON.parse(restorePaste('{"@type": "Thing", "name": "A"}', paste))).toEqual([{ '@type': 'Thing', name: 'A' }, JSON.parse(paste)]);
    // Not JSON: added as written, so the text shows its problem.
    const script = '<script type="application/ld+json">{"@type": "Rating"}</script>';
    expect(restorePaste('[{"@type": "Thing"}]', script)).toContain(script);
  });
});

describe('the added details example', () => {
  it('fits the node', () => {
    expect(detailsExample(['Product'])).toBe('{"sku": "…"}');
    expect(detailsExample(['Organization'])).toBe('{"telephone": "…"}');
    expect(detailsExample(['WebPage'])).toBe('{"keywords": "…"}');
  });
});

describe('a refusal from the server', () => {
  const stored = '{\n  "@type": "Thing",\n  "@id": "#breadcrumb"\n}';
  const amber: Problem = { tone: 'amber', line: 1, offset: 0, path: [], message: 'Line 1: advice' };
  const refusal = '“#breadcrumb” is kept for the breadcrumb trail of the page.';

  it('holds for the text that was sent, placed where the server said', () => {
    const found = withRefusal([amber], stored, stored, refusal, () => ['@id']);
    expect(found[0]).toMatchObject({ tone: 'red', line: 3, path: ['@id'], message: `Line 3: ${refusal}`, words: refusal });
    expect(found[1]).toBe(amber);
    expect(savable(found)).toBe(false);
  });

  it('goes once the text changes: its own problems are what count', () => {
    const changed = stored.replace('#breadcrumb', '#trail');
    expect(withRefusal([amber], changed, stored, refusal, () => ['@id'])).toEqual([amber]);
    expect(savable(withRefusal([], changed, stored, refusal, () => ['@id']))).toBe(true);
    // No refusal: nothing added.
    expect(withRefusal([amber], stored, stored, undefined, () => [])).toEqual([amber]);
  });

  it('says it was not saved when it arrives', () => {
    expect(notSaved(refusal)).toBe(`Not saved. ${refusal}`);
  });
});
