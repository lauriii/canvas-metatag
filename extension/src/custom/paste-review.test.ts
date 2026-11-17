import { describe, expect, it } from 'vitest';
import rules from '../../../data/search-features.json';
import type { StatePayload } from '../types';
import { clean } from './clean';
import { chosen, danglingWords, reasonOf, reportFor, reviewOf } from './PasteReview';

const server = {
  search_features: rules,
  module_ids: { identity: 'home', logo: 'home', website: 'home', 'return-policy': 'home', webpage: 'url', primaryimage: 'url', primary: 'url', group: 'url' },
} as unknown as StatePayload;
const modules = new Map<string, Record<string, unknown>>([
  ['#identity', { '@type': 'Organization', '@id': 'https://www.example.com/#identity', name: 'Humanify', url: 'https://www.example.com/' }],
  ['#webpage', { '@type': 'WebPage', '@id': 'https://www.example.com/jobs#webpage' }],
]);

describe('a paste that copies the page is reviewed', () => {
  it('a whole graph copied from another site: only the rating is ticked', () => {
    const paste = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': '#site', url: 'https://www.example.com/' },
        { '@type': 'WebPage', '@id': '#page' },
        { '@type': 'Organization', '@id': '#org', name: 'Humanify', url: 'https://www.example.com' },
        { '@type': 'EmployerAggregateRating', '@id': '#rating', itemReviewed: { '@id': '#org' }, ratingValue: 4.2, ratingCount: 3, author: { '@id': '#gone' } },
      ],
    });
    const done = clean(paste, { home: 'https://www.example.com/', url: 'https://www.example.com/jobs', langcode: 'en' });
    const review = reviewOf(done, { server, modules, existing: 0, size: paste.length })!;
    expect(review.rows.map((row) => row.tick)).toEqual([false, false, false, true]);
    expect(review.rows[2].reason).toBe("This is your site's organization. Links to it will point to yours.");
    expect(review.rows[0].reason).toBe('Already made by this page.');
    // Another page's web page is made by this page too; only this page's own is added to with Add details.
    expect(review.rows[1].reason).toBe('Already made by this page.');
    const own = reviewOf(clean('[{"@type": "WebPage", "url": "https://www.example.com/jobs", "name": "Jobs"}, {"@type": "Book", "name": "A"}]', { home: 'https://www.example.com/', url: 'https://www.example.com/jobs', langcode: 'en' }), { server, modules: new Map([...modules, ['#webpage', { '@type': 'WebPage', url: 'https://www.example.com/jobs' }]]), existing: 0, size: 99 })!;
    expect(own.rows[0].reason).toBe('The page itself: add to it with Add details in Output');
    // Copied from the page's own head: its id is this page's web page.
    const head = '[{"@type": "WebPage", "@id": "https://www.example.com/jobs#webpage", "name": "Jobs"}, {"@type": "Book", "name": "A"}]';
    const copied = reviewOf(clean(head, { home: 'https://www.example.com/', url: 'https://www.example.com/jobs', langcode: 'en' }), { server, modules, existing: 0, size: 99 })!;
    expect(copied.rows[0].reason).toBe('The page itself: add to it with Add details in Output');
    // The rating's link to the organization points at the site's own.
    const { items, dangling } = chosen(review.rows, review.rows.map((row) => row.tick));
    expect(items).toHaveLength(1);
    expect(items[0].itemReviewed).toEqual({ '@id': '#identity' });
    expect(dangling).toBe(0);
    // Unticking nothing else: a link to an item the page does not make counts.
    const more = chosen(
      [...review.rows, { item: { '@type': 'Person', '@id': '#gone' }, tick: false, reason: '' }],
      [false, false, false, true, false],
    );
    expect(more.dangling).toBe(1);
    expect(danglingWords(1)).toBe('1 link will point at nothing. Tick what it points at to keep it.');
    expect(danglingWords(2)).toBe('2 links will point at nothing. Tick what they point at to keep them.');
  });

  it('a clean paste of new items needs no review', () => {
    const done = clean('{"@type": "Book", "@id": "#book", "name": "A"}', { home: 'https://www.example.com/', url: 'https://www.example.com/jobs', langcode: 'en' });
    expect(reviewOf(done, { server, modules, existing: 0, size: 40 })).toBeNull();
  });
});

describe('the review follows the ticks', () => {
  it('says what an unticked row does, and counts links in what is added', () => {
    const row = { item: { '@type': 'Rating' }, tick: true, reason: 'Will be added' };
    expect(reasonOf(row, false)).toBe("Won't be added");
    expect(reasonOf({ ...row, tick: false, reason: 'Already made by this page.' }, true)).toBe('Will be added');
    expect(reasonOf(row, true)).toBe('Will be added');
    const rows = [
      { item: { '@type': 'Review', '@id': '#r', itemReviewed: { '@id': '#identity' } }, tick: true, reason: 'Will be added' },
      { item: { '@type': 'Review', '@id': '#s', author: { '@id': '#identity' }, itemReviewed: { '@id': '#identity' } }, tick: true, reason: 'Will be added' },
    ];
    expect(chosen(rows, [true, false]).pointed).toBe(1);
    expect(reportFor("Cleaned up the paste: took it out of its script tag and pointed 3 links at your site's own items.", 1)).toBe("Cleaned up the paste: took it out of its script tag and pointed 1 link at your site's own items.");
    expect(reportFor("Cleaned up the paste: pointed 3 links at your site's own items.", 0)).toBeNull();
  });
});
