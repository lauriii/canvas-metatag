import { describe, expect, it } from 'vitest';
import rules from '../../../data/search-features.json';
import type { SearchFeatures } from '../types';
import { problems, savable } from './problems';
import type { Vocabulary } from './vocab';

const R = rules as unknown as SearchFeatures;

const RATING = `{
  "@type": "EmployerAggregateRating",
  "@id": "#employer-rating",
  "itemReviewed": {
    "@type": "Organization",
    "name": "Acme Logistics",
    "sameAs": "acme-logistics.example"
  },
  "ratingValue": 4.2,
  "ratingCount": 318
}`;

describe('problems name the line, the path and the fix', () => {
  it('a missing comma on line 9, red, with its fix', () => {
    const found = problems(RATING.replace('4.2,', '4.2'), R, null);
    expect(found[0]).toMatchObject({ tone: 'red', line: 9, message: 'Line 9 · ratingValue: a comma is missing after 4.2.' });
    expect(found[0].fix!.label).toBe('Add the comma');
    expect(savable(found)).toBe(false);
  });

  it('an address without its scheme is amber, with the address to use', () => {
    const found = problems(RATING, R, null);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ tone: 'amber', line: 7, message: 'Line 7 · itemReviewed › sameAs: use the full address.' });
    expect(found[0].fix!.label).toBe('Use https://acme-logistics.example');
    expect(found[0].fix!.apply(RATING)).toBe(RATING.replace('"acme-logistics.example"', '"https://acme-logistics.example"'));
    expect(savable(found)).toBe(true);
    // The form's row says it in its own words, without the place.
    expect(found[0].words).toBe('Use the full address.');
    // A file name is no host: no fix that makes one of it.
    const file = problems('{"@type": "Thing", "image": "photo.jpg"}', R, null);
    expect(file[0]).toMatchObject({ tone: 'amber', words: 'Use the full address.' });
    expect(file[0].fix).toBeUndefined();
  });

  it('a duplicate key, hidden characters, an enumeration near miss: amber', () => {
    const found = problems('{\n  "@type": "Product",\n  "name": "A",\n  "name": "B",\n  "description": "B\u200b",\n  "offers": {"@type": "Offer", "availability": "Instock"}\n}', R, null);
    expect(found.map((one) => one.message)).toEqual([
      'Line 3 · name: “name” appears twice. Only the second is used.',
      'Line 5 · description: This text has hidden characters.',
      'Line 6 · offers › availability: “Instock” isn\'t a value search engines document for availability. Did you mean “InStock”?',
    ]);
    expect(found.map((one) => one.fix?.label)).toEqual(['Remove the first', 'Remove hidden characters', 'Use InStock']);
    expect(found[0].fix!.apply('{\n  "@type": "Product",\n  "name": "A",\n  "name": "B"\n}')).toBe('{\n  "@type": "Product",\n  "name": "B"\n}');
  });

  it('positions out of order, with the fix', () => {
    const text = '{"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": 1}, {"@type": "ListItem", "position": 3}, {"@type": "ListItem", "position": 3}]}';
    const [found] = problems(text, R, null);
    expect(found.message).toBe('Line 1 · itemListElement: Positions aren’t 1, 2, 3 in order.');
    expect(found.fix!.apply(text)).toContain('"position": 2');
  });

  it('a misspelt detail: only with the vocabulary when the rules don’t name it', () => {
    const text = '{"@type": "EmployerAggregateRating", "ratingcount": 3}';
    const vocabulary = {
      types: { EmployerAggregateRating: { parents: ['AggregateRating'] }, AggregateRating: { parents: [] } },
      properties: { ratingCount: { domains: ['AggregateRating'], ranges: ['Integer'] } },
    } as unknown as Vocabulary;
    // The rules file names ratingCount for an employer rating.
    expect(problems(text, R, null)[0].message).toBe("Line 1 · ratingcount: ratingcount isn't a detail of an employer rating. Did you mean ratingCount?");
    expect(problems('{"@type": "Book", "nmae": "A"}', R, null)).toEqual([]);
    expect(problems('{"@type": "Book", "nmae": "A"}', R, { ...vocabulary, types: { Book: { parents: [] } }, properties: { name: { domains: ['Book'], ranges: ['Text'] } } } as unknown as Vocabulary)[0].fix!.label).toBe('Use name');
  });

  it('the server’s refusals are red, on their line', () => {
    const found = problems('{\n  "@type": "Rating",\n  "ratingValue": 1e400\n}', R, null);
    expect(found).toEqual([expect.objectContaining({ tone: 'red', line: 3, message: 'Line 3 · ratingValue: this number is too large to use.' })]);
  });

  it('a field name inside other text is amber', () => {
    expect(problems('{"@type": "Book", "name": "By {field.field_byline}"}', R, null)[0].message).toBe('Line 1 · name: This name is only filled when it is the whole value.');
  });
});

describe('one cause, one problem', () => {
  it('says only the first syntax problem, and offers a fix only when it reads past it', () => {
    // A deleted "[": one problem, and no "Add the comma" that wouldn't help.
    const text = '{\n  "@type": "Review",\n  "itemReviewed": {"@id": "#a"}, {"@id": "#b"}],\n  "author": "Mia"\n}';
    const found = problems(text, R, null);
    expect(found).toHaveLength(1);
    expect(found[0].fix?.label).not.toBe('Add the comma');
    // A missing comma still has its fix.
    const comma = problems('{\n  "@type": "Rating"\n  "ratingValue": 4\n}', R, null);
    expect(comma).toHaveLength(1);
    expect(comma[0].fix?.label).toBe('Add the comma');
  });

  it('another vocabulary’s context: the fix removes it, and the problem goes', () => {
    const text = '{\n  "@context": {"@vocab": "https://example.org/terms/"},\n  "@type": "Thing",\n  "name": "A"\n}';
    const found = problems(text, R, null, {}, () => '{\n  "@type": "Thing",\n  "@id": "#thing",\n  "@context": {"@vocab": "https://example.org/terms/"},\n  "name": "A"\n}');
    expect(found[0]).toMatchObject({ tone: 'red', line: 2 });
    expect(found[0].fix?.label).toBe('Remove the context');
    const fixed = found[0].fix!.apply(text);
    expect(fixed).toBe('{\n  "@type": "Thing",\n  "name": "A"\n}');
    expect(savable(problems(fixed, R, null))).toBe(true);
  });

  it('the 32 KB every hand-added text of the page shares is red, in the server’s words', () => {
    const text = JSON.stringify({ '@type': 'Thing', name: 'x'.repeat(20000) });
    expect(savable(problems(text, R, null, {}, undefined, 10000))).toBe(true);
    const over = problems(text, R, null, {}, undefined, 14000);
    expect(over[0]).toMatchObject({ tone: 'red', line: 1, words: '34 KB. Keep under 32 KB, including added details.' });
    expect(savable(over)).toBe(false);
  });

  it('offers Clean up on a script tag left in', () => {
    const text = '<script type="application/ld+json">{"@type": "Rating", "ratingValue": 4}</script>';
    const found = problems(text, R, null, {}, () => '{"@type": "Rating", "ratingValue": 4}');
    expect(found[0].fix?.label).toBe('Clean up');
  });
});
