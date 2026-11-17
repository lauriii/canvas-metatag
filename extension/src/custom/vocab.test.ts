import { describe, expect, it, vi } from 'vitest';
import { ancestors, detailsOf, loadVocabulary, score, typeWith, type Vocabulary } from './vocab';

const VOCAB = {
  release: '30.1',
  licence: 'CC BY-SA 3.0',
  attribution: 'schema.org',
  types: {
    Thing: { parents: [] },
    Organization: { parents: ['Thing'] },
    LocalBusiness: { parents: ['Organization'] },
    FoodEstablishment: { parents: ['LocalBusiness'] },
    Restaurant: { parents: ['FoodEstablishment'] },
    Bakery: { parents: ['FoodEstablishment'] },
    Rating: { parents: ['Thing'] },
    EndorsementRating: { parents: ['Rating'], pending: true },
  },
  properties: {
    name: { domains: ['Thing'], ranges: ['Text'] },
    servesCuisine: { domains: ['FoodEstablishment'], ranges: ['Text'] },
    review: { domains: ['Organization'], ranges: ['Review'] },
    reviews: { domains: ['Organization'], ranges: ['Review'], superseded: 'review' },
  },
  members: {},
} as unknown as Vocabulary;

describe('the schema.org vocabulary', () => {
  it('ranks whole names, then starts, then word starts; nothing else', () => {
    expect(score('Rating', 'rating')).toBe(100);
    expect(score('Rating value', 'rating')).toBe(80);
    expect(score('EmployerAggregateRating', 'rating')).toBe(60);
    expect(score('Endorsement', 'dors')).toBe(0);
    expect(score('Anything', '')).toBe(1);
  });

  it('finds the details of a type and its parents, nearest first', () => {
    expect(ancestors(VOCAB, 'Restaurant')).toEqual(['Restaurant', 'FoodEstablishment', 'LocalBusiness', 'Organization', 'Thing']);
    expect(detailsOf(VOCAB, ['Restaurant'])).toEqual(['servesCuisine', 'review', 'reviews', 'name']);
    // A detail of a narrower type: the type that has it.
    expect(typeWith(VOCAB, 'servesCuisine', ['LocalBusiness'])).toBe('FoodEstablishment');
    // A superseded detail names its replacement.
    expect(VOCAB.properties.reviews.superseded).toBe('review');
  });

  it('is read once; a failure can be tried again', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(VOCAB);
    await expect(loadVocabulary(get, '30.1')).rejects.toThrow('down');
    await expect(loadVocabulary(get, '30.1')).resolves.toBe(VOCAB);
    await loadVocabulary(get, '30.1');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
