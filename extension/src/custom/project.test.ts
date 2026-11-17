// cspell:ignore pngbook
import { describe, expect, it } from 'vitest';
import rules from '../../../data/search-features.json';
import type { SearchFeatures } from '../types';
import { project, sentence } from './project';

const R = rules as unknown as SearchFeatures;

describe('a type opens with only what its search features need', () => {
  it('an employer rating: three needs, the either-or as one group, then what helps', () => {
    const shown = project({ '@type': 'EmployerAggregateRating', '@id': '#employer-rating' }, R, null);
    expect(shown.label).toBe('Employer rating');
    expect(shown.about).toBe("A company's rating by the people who work there.");
    const [needs] = shown.bands;
    expect(needs.title).toBe('Needed for Employer rating');
    expect(needs.rows.map((row) => ('group' in row ? row.group : row.label))).toEqual(['Item reviewed', 'Rating value', 'Rating count or review count']);
    const group = needs.rows[2];
    expect('group' in group && group.hint).toBe('Fill one, so the rating can show.');
    expect('group' in group && group.rows.map((row) => row.label)).toEqual(['Ratings', 'Reviews']);
    expect(shown.helps).toEqual(['bestRating', 'worstRating']);
  });

  it('a type with no search feature: no empty rows, suggested details', () => {
    const shown = project({ '@type': 'Book', name: 'The Quiet Orchard' }, R, null);
    expect(shown.feature).toBe(false);
    expect(shown.bands.map((band) => band.kind)).toEqual(['set']);
    expect(shown.helps).toEqual(['description', 'image', 'url']);
  });

  it('keeps every key as a row, a "__proto__" one too, in the text’s order', () => {
    const item = JSON.parse('{"@type": "Thing", "x-internal": 1, "__proto__": "kept", "name": "A"}');
    expect(project(item, R, null).bands[0].rows.map((row) => ('group' in row ? row.group : row.key))).toEqual(['x-internal', '__proto__', 'name']);
  });

  it('nested items carry what the detail they are under needs', () => {
    const [needs] = project({ '@type': 'Organization' }, R, null, null, ['name']).bands;
    expect(needs.rows.map((row) => ('group' in row ? row.group : row.key))).toEqual(['name']);
  });
});

describe('items are listed as sentences', () => {
  it('reads the rules file’s sentence, following links to other items', () => {
    const acme = { '@type': 'Organization', '@id': '#acme', name: 'Acme Logistics' };
    const rating = { '@type': 'EmployerAggregateRating', itemReviewed: { '@id': '#acme' }, ratingValue: 4.2, ratingCount: 318 };
    expect(sentence(rating, R, (id) => (id === '#acme' ? acme : undefined))).toBe('Acme Logistics as an employer: 4.2 out of 5 from 318 ratings.');
    expect(sentence({ '@type': 'EmployerAggregateRating' }, R)).toBe('An employer rating.');
    expect(sentence({ '@type': 'Book', name: 'The Quiet Orchard' }, R)).toBe('The Quiet Orchard, a book.');
    expect(sentence({ '@type': 'Book', isbn: '1' }, R)).toBe('A book with 1 detail.');
    expect(sentence({ '@type': 'ItemList', itemListElement: [{}, {}] }, R)).toBe('A list of 2 items.');
    // Names of fields and facts read as what they are filled with.
    expect(sentence({ '@type': 'Book', name: '{title}{sep}{site}' }, R, undefined, (text) => text.replace('{title}', 'Oak').replace('{sep}', ' | ').replace('{site}', 'Acme'))).toBe('Oak | Acme, a book.');
  });

  it('reads a rating kept as text as written, and never turns around a direction control', () => {
    const acme = { '@type': 'Organization', '@id': '#acme', name: 'Acme Logistics' };
    const rating = { '@type': 'EmployerAggregateRating', itemReviewed: { '@id': '#acme' }, ratingValue: '85%', ratingCount: 318 };
    expect(sentence(rating, R, (id) => (id === '#acme' ? acme : undefined))).toBe('Acme Logistics as an employer: 85% from 318 ratings.');
    expect(sentence({ '@type': 'Book', name: 'exe.png\u202Ebook' }, R)).toBe('exe.pngbook, a book.');
  });
});

describe('shapes from the vocabulary', () => {
  it('maps ranges to shapes where the rules file is silent', async () => {
    const { rangeShape, expectsOf } = await import('./project');
    const vocabulary = {
      release: '30.1',
      licence: '',
      attribution: '',
      types: {},
      properties: { lastReviewed: { domains: ['WebPage'], ranges: ['Date'] }, reviewedBy: { domains: ['WebPage'], ranges: ['Organization', 'Person'] }, availability: { domains: ['Offer'], ranges: ['ItemAvailability'] } },
      members: { ItemAvailability: ['InStock', 'OutOfStock'] },
    };
    expect(rangeShape('lastReviewed', vocabulary)).toBe('date');
    expect(rangeShape('reviewedBy', vocabulary)).toBe('item:Organization|Person');
    expect(rangeShape('availability', vocabulary)).toBe('enum:InStock|OutOfStock');
    expect(rangeShape('nothing', vocabulary)).toBe('');
    expect(expectsOf('lastReviewed', ['WebPage'], R, vocabulary)).toBe('date');
    expect(expectsOf('lastReviewed', ['WebPage'], R, null)).toBe('');
  });
});

describe('a detail of a more specific type', () => {
  it('a cuisine on a local business belongs to a restaurant, the documented kind', () => {
    const vocabulary = {
      release: '30.1',
      licence: '',
      attribution: '',
      types: { Thing: { parents: [] }, Place: { parents: ['Thing'] }, LocalBusiness: { parents: ['Place'] }, FoodEstablishment: { parents: ['LocalBusiness'] }, Restaurant: { parents: ['FoodEstablishment'] }, Bakery: { parents: ['FoodEstablishment'] } },
      properties: { name: { domains: ['Thing'], ranges: ['Text'] }, servesCuisine: { domains: ['FoodEstablishment'], ranges: ['Text'] } },
      members: {},
    };
    const shown = project({ '@type': 'LocalBusiness', name: 'Rye', servesCuisine: 'Nordic' }, R, vocabulary);
    expect(shown.belongs.servesCuisine).toBe('Restaurant');
    expect(shown.bands.find((band) => band.kind === 'unexpected')?.rows.map((row) => ('key' in row ? row.key : row.group))).toEqual(['servesCuisine']);
  });
});

describe('an either-or need met by one value', () => {
  it('shows that value alone; the others help', () => {
    const projection = project({ '@type': 'EmployerAggregateRating', itemReviewed: { '@id': '#acme' }, ratingValue: 4, ratingCount: 3 }, R, null);
    const group = projection.bands[0].rows.find((row) => 'group' in row);
    expect(group).toMatchObject({ met: true, rows: [{ key: 'ratingCount' }] });
    expect(projection.helps).toContain('reviewCount');
  });
});

describe('the line under a type', () => {
  it('says a made-up type is one only when the vocabulary can tell', async () => {
    const { typeNote } = await import('./project');
    const vocabulary = { release: '30.1', licence: '', attribution: '', types: { Thing: { parents: [] } }, properties: {}, members: {} };
    expect(typeNote('Gizmo', R, vocabulary)).toBe('Not a schema.org type. Search engines may ignore it.');
    expect(typeNote('Gizmo', R, null)).toBe('Edited by the shape of its values.');
    expect(typeNote('Thing', R, vocabulary)).toBe('');
    expect(typeNote('EmployerAggregateRating', R, null)).toBe("A company's rating by the people who work there.");
  });
});
