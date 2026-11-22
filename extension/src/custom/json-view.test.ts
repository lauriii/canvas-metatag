import { describe, expect, it } from 'vitest';
import rules from '../../../data/search-features.json';
import type { SearchFeatures } from '../types';
import { caretWords } from './JsonView';
import { problems } from './problems';
import { commitOf } from './sheet';

const R = rules as unknown as SearchFeatures;

const TEXT = `{
  "@type": "EmployerAggregateRating",
  "itemReviewed": {
    "@type": "Organization",
    "name": "Acme Logistics"
  },
  "ratingValue": 4.2,
  "ratingCount": 318
}`;

describe('the JSON box explains the value under the caret', () => {
  it('names the line, the path, the label and what it expects, and Edit in form with its place', () => {
    const offset = TEXT.indexOf('4.2') + 1;
    const words = caretWords(TEXT, offset, JSON.parse(TEXT), R);
    expect(words.line).toBe('Line 7 · ratingValue · Rating value: a number, like 4.2');
    expect(words.edit).toBe('Edit in form: Rating value, line 7');
  });

  it('says what a linked value is linked to and its previewed value', () => {
    const text = '{"@type": "Rating", "ratingValue": "{field.field_score}"}';
    const words = caretWords(text, text.indexOf('field_score'), JSON.parse(text), R, (name) => (name === 'field_score' ? { label: 'Score', value: '4.5' } : undefined));
    expect(words.line).toBe('Line 1 · ratingValue · Rating value: linked to Score (4.5)');
  });

  it('outside a value there is nothing to edit in the form', () => {
    expect(caretWords(TEXT, 0, JSON.parse(TEXT), R).edit).toBeNull();
  });
});

describe('the box commits on blur or Ctrl/Cmd+Enter', () => {
  it('a red problem blocks the commit: the text is kept as a draft, never sent', () => {
    const broken = TEXT.replace('4.2,', '4.2');
    expect(commitOf(broken, problems(broken, R, null), TEXT)).toBe('draft');
    // Advice never blocks; an unchanged text does nothing.
    const advice = TEXT.replace('"Acme Logistics"', '"Acme Logistics", "url": "acme.example"');
    expect(commitOf(advice, problems(advice, R, null), TEXT)).toBe('store');
    expect(commitOf(TEXT, problems(TEXT, R, null), TEXT)).toBe('same');
  });
});
