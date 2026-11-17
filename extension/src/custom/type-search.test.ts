import { describe, expect, it } from 'vitest';
import { REGISTRY, RULES } from '../data.test-helper';
import { typeOptions, type SearchContext } from './search';

const PLAIN: SearchContext = { rules: RULES, vocabulary: null, registry: REGISTRY, pageType: 'WebPage', nodeTypes: { '#webpage': ['WebPage'] } };

describe('choosing a type', () => {
  it('"rating" puts Employer rating first, tagged Search feature, with its line', () => {
    const found = typeOptions('rating', PLAIN);
    expect(found[0]).toMatchObject({ value: 'EmployerAggregateRating', label: 'Employer rating', hint: 'EmployerAggregateRating', detail: "A company's rating by the people who work there." });
    // The list holds types without a search feature too: the tag tells them apart.
    expect(found.some((one) => !one.tag)).toBe(true);
    expect(found[0].tag).toBe('Search feature');
  });

  it('a schema.org name typed exactly comes first', () => {
    expect(typeOptions('Rating', PLAIN)[0].value).toBe('Rating');
  });

  it('reads in order before anything is typed', () => {
    const labels = typeOptions('', PLAIN).map((one) => one.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it('a kind of page steers first, tagged Page kind', () => {
    for (const word of ['recipe', 'event', 'product', 'job']) {
      const [first] = typeOptions(word, PLAIN);
      expect(first.tag, word).toBe('Page kind');
      expect(first.steer?.to).toBe('kind');
    }
    expect(typeOptions('recipe', PLAIN)[0].detail).toBe('This page can describe itself as a recipe, with its own fields and checks.');
    // Not on a page of another kind: it already is one.
    expect(typeOptions('recipe', { ...PLAIN, pageType: 'Product' })[0].tag).not.toBe('Page kind');
  });

  it('retired features are never tagged or suggested; FAQ page is not a search feature', () => {
    const faq = typeOptions('faq', PLAIN).find((one) => one.value === 'FAQPage');
    expect(faq).toBeUndefined();
    expect(typeOptions('', PLAIN).some((one) => one.value === 'FAQPage' || one.value === 'HowTo')).toBe(false);
  });

  it('"question" offers to make this page a Q&A page', () => {
    const qa = typeOptions('question', PLAIN).find((one) => one.value === 'QAPage');
    expect(qa).toMatchObject({ label: 'Q&A page', steer: { to: 'page', type: 'QAPage' }, detail: 'This makes the page itself a Q&A page.' });
  });

  it('a type the page already is offers Add details to it', () => {
    const product = typeOptions('product', { ...PLAIN, pageType: 'Product', nodeTypes: { '#primary': ['Product'], '#webpage': ['WebPage'] } }).find((one) => one.value === 'Product');
    expect(product?.steer).toEqual({ to: 'details', node: '#primary', type: 'Product' });
  });

  it('a name that is not a type is offered as itself', () => {
    expect(typeOptions('Gizmo', PLAIN).pop()).toMatchObject({ value: 'Gizmo', label: 'Use “Gizmo” as the type' });
    expect(typeOptions('EndorsementRating', PLAIN).pop()?.label).toBe('Use “EndorsementRating” as the type');
  });

  it('the tag tells rows apart only when some rows have none', () => {
    const shown = typeOptions('', PLAIN);
    expect(shown.length).toBeGreaterThan(5);
    expect(shown.some((one) => one.tag === 'Search feature')).toBe(false);
  });
});
