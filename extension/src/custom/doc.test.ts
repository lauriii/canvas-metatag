import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { append, format, lineOf, nodeAt, offsetOf, pathAt, rawItems, set, syntax, value } from './doc';
import { appendItem, appendPaste, restorePaste } from './sheet';

const RATING = `[
  {
    "@type": "EmployerAggregateRating",
    "@id": "#employer-rating",
    "itemReviewed": { "@id": "#acme-logistics" },
    "ratingValue": 4.2,
    "ratingCount": 318,
    "x-internal": "keep me",
    "bestRating": 5
  }
]`;

describe('one text, two views', () => {
  it('R2, R6: a form edit changes only its value’s bytes, and keeps unknown keys in place', () => {
    const next = set(RATING, [0, 'ratingValue'], 4.5);
    expect(next).toBe(RATING.replace('4.2', '4.5'));
    expect(next.indexOf('"x-internal": "keep me"')).toBe(RATING.indexOf('"x-internal": "keep me"'));
  });

  it('R3: a new detail goes at the end of its item; R13: a second item makes a list', () => {
    const one = '{\n  "@type": "Rating",\n  "ratingValue": 4\n}';
    expect(set(one, ['bestRating'], 5)).toBe('{\n  "@type": "Rating",\n  "ratingValue": 4,\n  "bestRating": 5\n}');
    expect(value(set(`[${one}]`, [1], { '@type': 'Thing' }))).toEqual([{ '@type': 'Rating', ratingValue: 4 }, { '@type': 'Thing' }]);
  });

  it('R4, R5: numbers keep their spelling and strings stay strings until edited', () => {
    const text = '{"@type": "Rating", "ratingValue": "4.2", "worstRating": 1.0e0, "bestRating": 5}';
    expect(set(text, ['bestRating'], 10)).toBe('{"@type": "Rating", "ratingValue": "4.2", "worstRating": 1.0e0, "bestRating": 10}');
  });

  it('R7: Format re-indents with two spaces and keeps the key order', () => {
    expect(format('{"b":1,"a":{"c":2}}')).toBe('{\n  "b": 1,\n  "a": {\n    "c": 2\n  }\n}');
  });

  it('places: offset, line and path', () => {
    const offset = RATING.indexOf('4.2');
    expect(lineOf(RATING, offset)).toBe(6);
    expect(pathAt(RATING, offset + 1)).toEqual([0, 'ratingValue']);
    expect(lineOf(RATING, offsetOf(RATING, [0, 'ratingCount']))).toBe(7);
    expect(nodeAt(RATING, [0, 'itemReviewed', '@id'])?.value).toBe('#acme-logistics');
  });

  it('a missing comma is on the line where the comma goes', () => {
    const broken = RATING.replace('4.2,', '4.2');
    const [problem] = syntax(broken);
    expect(problem).toMatchObject({ line: 6, message: 'a comma is missing after 4.2.' });
    expect(problem.path).toEqual([0, 'ratingValue']);
    expect(problem.fix!.label).toBe('Add the comma');
    expect(problem.fix!.apply(broken)).toBe(RATING);
  });

  it('R4: adding items never re-encodes the items there are', () => {
    const one = '{"@type": "Product", "weight": 4.50, "gtin": 12345678901234567890}';
    // Add an item to one object: a list of it as written, and the new one.
    const two = appendItem(one, { '@type': 'Thing', '@id': '#thing' });
    expect(two).toBe('[\n  {"@type": "Product", "weight": 4.50, "gtin": 12345678901234567890},\n  {\n    "@type": "Thing",\n    "@id": "#thing"\n  }\n]');
    // A list keeps each item's own lines, the first one too.
    const list = '[\n  {"@type": "Product", "weight": 4.50},\n  {"@type": "Thing", "n": 12345678901234567890}\n]';
    expect(appendItem(list, { '@type': 'Book' })).toBe('[\n  {"@type": "Product", "weight": 4.50},\n  {"@type": "Thing", "n": 12345678901234567890},\n  {\n    "@type": "Book"\n  }\n]');
    // A list on one line takes the new item on that line.
    expect(append('[{"@type": "A", "w": 4.50}]', ['{\n  "@type": "B"\n}'])).toBe('[{"@type": "A", "w": 4.50}, { "@type": "B" }]');
    // A paste after the items there were; Undo clean-up puts the raw paste after them.
    const paste = '[\n    {"@type": "Rating", "ratingValue": 4.50},\n    {"@type": "Thing"}\n  ]';
    expect(rawItems(paste)).toEqual(['{"@type": "Rating", "ratingValue": 4.50}', '{"@type": "Thing"}']);
    expect(appendPaste(one, '{"@type": "Rating", "ratingValue": 4.50}')).toBe('[\n  {"@type": "Product", "weight": 4.50, "gtin": 12345678901234567890},\n  {"@type": "Rating", "ratingValue": 4.50}\n]');
    expect(restorePaste(list, '<script>{"@type": "Rating"}</script>')).toBe('[\n  {"@type": "Product", "weight": 4.50},\n  {"@type": "Thing", "n": 12345678901234567890},\n  <script>{"@type": "Rating"}</script>\n]');
    expect(restorePaste(list, paste)).toBe('[\n  {"@type": "Product", "weight": 4.50},\n  {"@type": "Thing", "n": 12345678901234567890},\n  {"@type": "Rating", "ratingValue": 4.50},\n  {"@type": "Thing"}\n]');
  });

  it('R2 as a property: random edits keep every byte outside the value', () => {
    const keys = ['name', 'ratingValue', 'ratingCount', 'url'];
    fc.assert(
      fc.property(
        fc.constantFrom(...keys),
        fc.oneof(fc.string(), fc.integer(), fc.double({ noNaN: true, noDefaultInfinity: true }), fc.boolean()),
        (key, next) => {
          const text = '{\n  "@type": "Thing",\n  "name": "A",\n  "ratingValue": 4.2,\n  "ratingCount": 3,\n  "url": "https://example.com"\n}';
          const node = nodeAt(text, [key])!;
          const edited = set(text, [key], next);
          const before = text.slice(0, node.offset);
          const after = text.slice(node.offset + node.length);
          expect(edited.startsWith(before)).toBe(true);
          expect(edited.endsWith(after)).toBe(true);
          expect((value(edited) as Record<string, unknown>)[key]).toEqual(JSON.parse(JSON.stringify(next)));
        },
      ),
      { numRuns: 200 },
    );
  });
});
