// cspell:ignore Kevätmessut huhtikuuta toukokuuta
import { describe, expect, it } from 'vitest';

import { REGISTRY, RULES } from './data.test-helper';
import { type Part, dateWords, itemKind, itemName, judged, readback, valueAt } from './readback';
import type { GraphNode } from './types';

const HOME = 'https://example.com/';
const URL = 'https://example.com/lamp';
const ID = { identity: `${HOME}#identity`, website: `${HOME}#website`, page: `${URL}#webpage`, main: `${URL}#primary` };

const site = [
  { '@type': 'Organization', '@id': ID.identity, name: 'Humanify Studio', url: HOME },
  { '@type': 'WebSite', '@id': ID.website, url: HOME, name: 'Humanify Studio', publisher: { '@id': ID.identity } },
];

/** A graph of the site nodes, a page node and, when given, a main node. */
function graph(main: Record<string, unknown> | null, page: Record<string, unknown> = {}, extra: Record<string, unknown>[] = []) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...site,
      { '@type': 'WebPage', '@id': ID.page, url: URL, name: 'Oak desk lamp | Shop', isPartOf: { '@id': ID.website }, ...page },
      ...(main ? [{ '@id': ID.main, mainEntityOfPage: { '@id': ID.page }, ...main }] : []),
      ...extra,
    ],
  };
}

const read = (type: string, g: ReturnType<typeof graph>, locale = 'en', nodes: GraphNode[] = [], registry = REGISTRY) =>
  readback({ graph: g, url: URL, registry, rules: RULES, type, nodes, locale });

/** The sentence as text. */
const text = (parts: Part[] | null) =>
  parts?.map((part) => (typeof part === 'string' ? part : part.text)).join('') ?? null;

const product = (offers: Record<string, unknown>) => ({
  '@type': 'Product',
  name: 'Oak desk lamp',
  offers: { '@type': 'Offer', ...offers },
});

describe('readback()', () => {
  it('reads a product back, from the graph only', () => {
    const lamp = product({ price: '89', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', seller: { '@id': ID.identity } });
    const result = read('Product', graph(lamp));
    expect(text(result.sentence)).toBe('Oak desk lamp, a product sold by Humanify Studio for €89, in stock.');
    // Each fact is a part of its own, with where it is set.
    expect(result.sentence?.filter((part) => typeof part !== 'string')).toEqual([
      { slot: 'name', label: 'Name', text: 'Oak desk lamp', full: 'Oak desk lamp', prop: 'name' },
      { slot: 'seller', label: 'Seller', text: 'Humanify Studio', full: 'Humanify Studio', prop: 'sold_here', site: 'identity.name' },
      { slot: 'price', label: 'Price', text: '€89', full: '€89', prop: 'offers_price' },
      { slot: 'availability', label: 'Availability', text: 'in stock', full: 'in stock', prop: 'offers_availability' },
    ]);
  });

  it('never says what the graph does not carry', () => {
    // No seller: no "sold by".
    expect(text(read('Product', graph(product({ price: '89', priceCurrency: 'EUR' }))).sentence)).toBe('Oak desk lamp, a product for €89.');
    // A monthly price stored without its billing: no period.
    expect(text(read('Product', graph(product({ price: '2500', priceCurrency: 'EUR' }))).sentence)).toBe('Oak desk lamp, a product for €2,500.');
    // With its billing: the period.
    const monthly = product({ price: '2500', priceCurrency: 'EUR', priceSpecification: { '@type': 'UnitPriceSpecification', price: '2500', billingDuration: 'P1M' } });
    expect(text(read('Product', graph(monthly)).sentence)).toBe('Oak desk lamp, a product for €2,500 a month.');
    // No currency: a number.
    expect(text(read('Product', graph(product({ price: '89.5' }))).sentence)).toBe('Oak desk lamp, a product for 89.50.');
    // A withheld product: what ships is a web page.
    expect(text(read('Product', graph(null)).sentence)).toBe('Oak desk lamp | Shop, a web page of Humanify Studio.');
  });

  it('has a sentence for every kind and variant', () => {
    const service = { '@type': 'Service', name: 'Studio membership', provider: { '@id': ID.identity }, offers: { '@type': 'Offer', price: '2500', priceCurrency: 'EUR', priceSpecification: { billingDuration: 'P1Y' } } };
    expect(text(read('Service', graph(service)).sentence)).toBe('Studio membership, a service from Humanify Studio for €2,500 a year.');
    const article = { '@type': 'BlogPosting', headline: 'Hello', author: { '@type': 'Person', name: 'Ada' }, datePublished: '2026-03-02T09:00:00+02:00' };
    expect(text(read('BlogPosting', graph(article)).sentence)).toBe('Hello, a blog post by Ada, published 2 March 2026, 09:00.');
    expect(text(read('Article', graph({ '@type': 'Article', headline: 'Hello' })).sentence)).toBe('Hello, an article.');
    const event = { '@type': 'Event', name: 'Spring fair', startDate: '2027-04-05', location: { '@type': 'Place', name: 'The New Mill', address: { '@type': 'PostalAddress', addressLocality: 'Leeds' } } };
    expect(text(read('Event', graph(event)).sentence)).toBe('Spring fair, an event at The New Mill, Leeds, starting 5 April 2027.');
    expect(text(read('ProfilePage', graph({ '@type': 'Person', name: 'Ada', jobTitle: 'Engineer' }, { '@type': 'ProfilePage' })).sentence)).toBe('Ada, Engineer, on a profile page.');
    expect(text(read('AboutPage', graph(null, { '@type': 'AboutPage', name: 'About us' })).sentence)).toBe('About us, the page about Humanify Studio.');
    expect(text(read('WebPage', graph(null)).sentence)).toBe('Oak desk lamp | Shop, a web page of Humanify Studio.');
    // A page title as a fact of the page, set in Search.
    expect(read('WebPage', graph(null)).facts[0]).toMatchObject({ label: 'Name', fact: 'title' });
  });

  it('formats prices and dates in the dialog language', () => {
    const lamp = product({ price: '2500', priceCurrency: 'EUR', seller: { '@id': ID.identity } });
    const finnish = read('Product', graph(lamp), 'fi');
    expect(finnish.facts.find((fact) => fact.slot === 'price')?.text).toBe('2 500 €');
    const event = { '@type': 'Event', name: 'Kevätmessut', startDate: '2027-04-05' };
    expect(read('Event', graph(event), 'fi').facts.find((fact) => fact.slot === 'start')?.text).toBe('5. huhtikuuta 2027');
  });

  it('lists the facts when the sentence has no translation', () => {
    const registry = { ...REGISTRY, Product: { ...REGISTRY.Product, say: null } };
    const result = read('Product', graph(product({ price: '89', priceCurrency: 'EUR', seller: { '@id': ID.identity } })), 'fi', [], registry);
    expect(result.sentence).toBeNull();
    expect(result.facts.map((fact) => [fact.label, fact.text])).toEqual([
      ['Name', 'Oak desk lamp'],
      ['Seller', 'Humanify Studio'],
      ['Price', '89,00 €'.replace(',00', '')],
    ]);
  });

  it('shortens long facts in a sentence past 40 words, and names them whole', () => {
    const name = Array.from({ length: 45 }, (_, at) => `word${at}`).join(' ');
    const result = read('Product', graph({ ...product({ price: '89' }), name }));
    const fact = result.sentence?.find((part) => typeof part !== 'string' && part.slot === 'name');
    expect(fact).toMatchObject({ text: 'word0 word1 word2 word3 word4 word5 word6 word7…', full: name });
    // A short sentence is whole.
    expect(text(read('Product', graph(product({ price: '89' }))).sentence)).toBe('Oak desk lamp, a product for 89.');
  });

  it('names the hand-added items that ship', () => {
    const extra = [
      { '@type': 'FAQPage', '@id': `${URL}#faq` },
      { '@type': 'Thing', name: 'Opening hours' },
    ];
    const nodes: GraphNode[] = [
      { id: `${URL}#faq`, type: 'FAQPage', origin: 'hand', item: 0, at: 3 },
      { id: null, type: 'Thing', origin: 'hand', item: 1, at: 4 },
      { id: `${URL}#gone`, type: 'Thing', origin: 'hand', item: 2, left_out: 'skip' },
    ];
    expect(read('WebPage', graph(null, {}, extra), 'en', nodes).hand).toEqual(['FAQ', 'Opening hours']);
  });

  it('names an unnamed hand-added item in plain words, never by its schema.org type', () => {
    const extra = [
      { '@type': 'Review', reviewBody: 'Great' },
      { '@type': 'AggregateRating', ratingValue: '4.5' },
      { '@type': 'EmployerAggregateRating', ratingValue: '4' },
      { '@type': 'Corporation' },
      { '@type': 'Thing' },
    ];
    const nodes: GraphNode[] = extra.map((node, item) => ({ id: null, type: node['@type'], origin: 'hand', item, at: 3 + item }));
    expect(read('WebPage', graph(null, {}, extra), 'en', nodes).hand).toEqual(['a review', 'a rating', 'an employer rating', 'an organization', 'an item']);
  });

  it('says what a hand-added item is, apart from its own name', () => {
    expect(itemKind({ '@type': 'FAQPage', name: 'Pricing questions' }, RULES)).toBe('FAQ');
    expect(itemName({ '@type': 'FAQPage', name: 'Pricing questions' }, RULES)).toBe('Pricing questions');
    expect(itemKind({ '@type': 'Review' }, RULES)).toBe('a review');
  });

  it('judges a withheld main node by its own values', () => {
    const withheld = { '@type': 'Event', '@id': `${URL}#primary`, name: 'Concert', startDate: '2027-06-19T19:00', organizer: { '@id': ID.identity } };
    const shipped = graph(null, {});
    const { node, index } = judged(shipped, `${URL}#primary`, `${URL}#primary`, withheld);
    expect(node).toBe(withheld);
    // Its references are followed into the graph that ships.
    expect(valueAt(node, 'startDate', index)).toBe('2027-06-19T19:00');
    expect(valueAt(node, 'organizer.name', index)).toBe('Humanify Studio');
    // A node of the graph is its own; another node is never the withheld one.
    expect(judged(shipped, `${URL}#webpage`, `${URL}#primary`, withheld).node?.['@type']).toBe('WebPage');
    expect(judged(shipped, `${URL}#other`, `${URL}#primary`, withheld).node).toBeUndefined();
    expect(judged(shipped, `${URL}#primary`, `${URL}#primary`, null).node).toBeUndefined();
  });

  it('writes dates one way, as the fields do', () => {
    expect(dateWords('2027-06-19T19:00:00+02:00', 'en')).toBe('19 June 2027, 19:00');
    expect(dateWords('2026-05-07', 'en')).toBe('7 May 2026');
    expect(dateWords('2026-05-07', 'fi')).toBe('7. toukokuuta 2026');
  });
});
