import { describe, expect, it } from 'vitest';
import { RULES } from '../data.test-helper';
import { itemPath, value as parse } from './doc';
import { type Item } from './project';
import { hoistText, targetsOf } from './sheet';

const label = (short: string, node: Item | undefined) => (short === '#identity' ? `${String(node?.name)} (this site)` : short === '#webpage' ? 'This page' : `This page's ${String(node?.['@type']).toLowerCase()}`);

describe('a detail that is an item points before it describes', () => {
  const rating = { '@type': 'EmployerAggregateRating', '@id': '#rating', itemReviewed: { '@type': 'Organization', name: 'Acme Logistics' }, ratingValue: 4.2 };
  const review = { '@type': 'Review', '@id': '#review' };

  it('lists the site, this page, other items, and items described inside them', () => {
    const modules = new Map<string, Item>([
      ['#identity', { '@type': 'Organization', name: 'Example' }],
      ['#webpage', { '@type': 'WebPage' }],
    ]);
    const list = [rating, review];
    const found = targetsOf({ modules, label, withheld: null, list, pathOf: (index) => [index], rules: RULES });
    expect(found.map((one) => one.label)).toEqual(['Example (this site)', 'This page', 'Acme Logistics as an employer: 4.2 out of 5', 'Acme Logistics (described in Employer rating)', 'A review']);
    expect(found[3]).toMatchObject({ id: 'nested:0:itemReviewed', nested: [0, 'itemReviewed'], types: ['Organization'] });
  });

  it('a left-out main thing is listed, disabled with its reason', () => {
    const found = targetsOf({ modules: new Map(), label, withheld: ['Product'], list: [], pathOf: () => [], rules: RULES });
    expect(found).toEqual([{ id: '#primary', label: "This page's product", types: ['Product'], disabled: 'The main thing is left out on this page' }]);
  });

  it('a second item pointing at a described one makes it its own item', () => {
    const text = JSON.stringify([rating, review], null, 2);
    const done = hoistText(text, [...itemPath(parse(text), 0), 'itemReviewed'], [1, 'itemReviewed'], { moduleIds: ['identity', 'webpage'], rules: RULES })!;
    expect(done.name).toBe('Acme Logistics');
    const items = parse(done.text) as Item[];
    expect(items).toHaveLength(3);
    expect(items[0].itemReviewed).toEqual({ '@id': '#acme-logistics' });
    expect(items[1].itemReviewed).toEqual({ '@id': '#acme-logistics' });
    expect(items[2]).toEqual({ '@type': 'Organization', name: 'Acme Logistics', '@id': '#acme-logistics' });
    // The new id never repeats one in use.
    const taken = JSON.stringify([{ ...review, '@id': '#acme-logistics' }, rating, { '@type': 'Review' }], null, 2);
    const again = hoistText(taken, [1, 'itemReviewed'], [2, 'itemReviewed'], { moduleIds: [], rules: RULES })!;
    expect((parse(again.text) as Item[])[3]['@id']).toBe('#acme-logistics-2');
    // One item that is not a list: the text becomes one.
    const one = JSON.stringify(rating);
    expect((parse(hoistText(one, ['itemReviewed'], ['itemReviewed'], { moduleIds: [], rules: RULES })!.text) as Item[]).length).toBe(2);
    expect(hoistText(one, ['ratingValue'], ['x'], { moduleIds: [], rules: RULES })).toBeNull();
  });
});
