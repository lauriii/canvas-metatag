import { describe, expect, it } from 'vitest';
import { RULES } from '../data.test-helper';
import type { ExpectsSpec, Verdict } from '../types';
import { sentence } from './project';
import { appendItem, asItem, emptyWords, limitLine, listTags, shapeNeed, typedPaths } from './sheet';

describe('hand-added items are listed as sentences', () => {
  it('an employer rating in the list', () => {
    const acme = { '@type': 'Organization', '@id': '#acme', name: 'Acme Logistics' };
    expect(sentence({ '@type': 'EmployerAggregateRating', itemReviewed: { '@id': '#acme' }, ratingValue: 4.2, ratingCount: 318 }, RULES, () => acme)).toBe('Acme Logistics as an employer: 4.2 out of 5 from 318 ratings.');
  });

  it('dates read as dates', () => {
    expect(sentence({ '@type': 'Book', name: '2026-12-04T10:00' }, RULES)).toBe('4 December 2026, 10:00, a book.');
  });

  it('tags Main, Left out and Not saved', () => {
    expect(listTags({ '@type': 'Recipe', '@id': '#r' }, { main: '#r', skip: ['#r'], unsaved: true })).toEqual(['Main', 'Left out', 'Not saved']);
    expect(listTags({ '@type': 'Recipe' }, { main: '#r', unsaved: false })).toEqual([]);
  });

  it('at the limit, Add an item is disabled with its reason', () => {
    expect(limitLine(10, 1000, 32768)).toBe('10 items is the most one page can have. Remove one to add another.');
    expect(limitLine(8, 1024, 32768)).toBe('8 of 10 items · 1.0 KB of 32 KB, including added details');
    expect(limitLine(2, 1024, 32768)).toBeNull();
  });

  it('an item added to one item makes a list', () => {
    const one = '{\n    "@type": "Thing",   "name": "A"\n}';
    expect(JSON.parse(appendItem(one, { '@type': 'Book' }))).toEqual([{ '@type': 'Thing', name: 'A' }, { '@type': 'Book' }]);
    const list = '[\n  {"@type": "Thing"}\n]';
    expect(JSON.parse(appendItem(list, { '@type': 'Book' }))).toEqual([{ '@type': 'Thing' }, { '@type': 'Book' }]);
    expect(appendItem('', { '@type': 'Book' })).toBe('{\n  "@type": "Book"\n}');
  });
});

describe('a need says what its value must look like', () => {
  const needs = (path: string, expects: ExpectsSpec): Verdict => ({ feature: 'review-snippet', node: null, verdict: 'needs', missing: [{ path, expects }] });

  it('an author given only as a name: one wording, and Make it a person', () => {
    const verdict = needs('author', 'item:Person|Organization');
    expect(shapeNeed(verdict, RULES)).toBe('Needs author as a person or organization');
    const fix = asItem(verdict, { '@type': 'Review', author: 'Mia Virtanen' });
    expect(fix).toEqual({ label: 'Make it a person', path: ['author'], value: { '@type': 'Person', name: 'Mia Virtanen' } });
    // The item reviewed as an organization.
    const reviewed = needs('itemReviewed', 'item:Organization');
    expect(shapeNeed(reviewed, RULES)).toBe('Needs item reviewed as an organization');
    expect(asItem(reviewed, { itemReviewed: 'Acme Logistics' })?.label).toBe('Make it an organization');
    // Nothing to wrap: no fix.
    expect(asItem(verdict, { '@type': 'Review' })).toBeNull();
  });
});

describe('what a translation copies, and what a link left empty', () => {
  it('marks typed text to translate, never addresses, ids, codes, numbers or links', () => {
    const data = [{ '@type': 'Review', '@id': '#r', name: 'Great desk', url: 'https://example.com', reviewBody: 'Sturdy.', itemCondition: 'NewCondition', ratingValue: '4.5', author: { '@type': 'Person', name: '{field.field_byline}' } }];
    expect(typedPaths(data)).toEqual(['0/name', '0/reviewBody']);
  });

  it('a review without a score', () => {
    expect(emptyWords({ path: 'reviewRating.ratingValue', name: 'field_score', status: 'empty' }, { field: () => 'Score', thing: 'book review', rules: RULES })).toBe('No Score for this book review, so its rating is left out.');
    expect(emptyWords({ path: 'author.name', name: 'field_byline', status: 'hidden' }, { field: () => 'Byline', thing: 'book review', rules: RULES })).toBe('Byline is hidden for this book review, so its author is left out.');
    // As the server names them: the field with its prefix, a node by its address.
    expect(emptyWords({ path: 'reviewRating.ratingValue', name: 'field.field_score', status: 'empty' }, { field: (name) => (name === 'field_score' ? 'Score' : name), thing: 'book review', rules: RULES })).toBe('No Score for this book review, so its rating is left out.');
    expect(emptyWords({ path: 'itemReviewed', name: 'https://site.example/node/92#primary', status: 'absent' }, { field: (name) => name, thing: 'page', rules: RULES, node: () => 'the product' })).toBe("The product isn't output here, so its item reviewed is left out.");
  });
});
