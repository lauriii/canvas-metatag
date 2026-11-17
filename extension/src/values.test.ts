import { describe, expect, it } from 'vitest';

import type { FactInfo, SourceRow } from './types';
import {
  FOLD,
  type Lookup,
  brokenWhy,
  entriesFor,
  factsFor,
  foldLabel,
  kindOf,
  levelOf,
  resolve,
  sameValue,
  tagOf,
  textOf,
  tree,
} from './values';

const row = (field: string, path: string[], over: Partial<SourceRow> = {}): SourceRow => ({
  source: { sourceType: 'entity-field', expression: `ℹ︎␜entity:node:event␝${field}␞␟${path.join('_')}` },
  label: path.join(' › '),
  path,
  field,
  hop: path.length > 1,
  kinds: ['text'],
  status: 'ok',
  value: `${path.at(-1)} value`,
  ...over,
});

const fact = (label: string, kind: FactInfo['kind'], value: string): FactInfo => ({ label, kind, value });

const LOOKUP: Lookup = {
  facts: {
    title: fact('Title', 'text', 'Midsummer Night Concert'),
    description: fact('Description', 'text', 'New music by the lake.'),
    site: fact('Site name', 'text', 'Example'),
    url: fact('Page address', 'address', 'https://www.example.com/midsummer'),
    author: fact('Author', 'text', 'Rosa'),
    published: fact('First published', 'date', '2026-05-04T11:00:00+03:00'),
    modified: fact('Last updated', 'date', '2026-11-15T06:29:13+02:00'),
    image: { ...fact('Image', 'image', ''), image: null },
  },
  sources: [
    row('body', ['Description'], { value: 'An evening of new music.' }),
    row('field_starts', ['Starts'], { kinds: ['date'], value: '2027-06-19T19:00:00+03:00' }),
    row('field_ends', ['Ends'], { kinds: ['date'], value: '2027-06-19T22:30:00+03:00' }),
    row('field_venue', ['Venue', 'Street address'], { value: 'Mannerheimintie 13e' }),
    row('field_venue', ['Venue', 'City'], { value: 'Helsinki' }),
    row('field_event_status', ['Status'], { value: 'EventScheduled', shown: 'On as planned', list: true }),
    row('field_notes', ['Notes'], { status: 'hidden', value: '' }),
    row('field_poster', ['Poster', 'Image'], { kinds: ['image'], value: '', image: { name: 'Poster', thumb: '/p.png', width: 1600, height: 900 } as never }),
  ],
  media: {},
  resolvable: true,
};

const link = (field: string) => ({ source: LOOKUP.sources.find((one) => one.field === field)!.source });

describe('resolve()', () => {
  it('gives typed text as typed, braces included', () => {
    expect(resolve({ text: '{site} rocks' }, 'text', LOOKUP)).toMatchObject({ status: 'ok', value: '{site} rocks' });
  });

  it('gives a fact of its kind, and nothing of another', () => {
    expect(resolve({ fact: 'title' }, 'text', LOOKUP).value).toBe('Midsummer Night Concert');
    expect(resolve({ fact: 'image' }, 'text', LOOKUP).status).toBe('broken');
  });

  it('gives a link its row\'s value, a list key its label to show', () => {
    expect(resolve(link('field_event_status'), 'text', LOOKUP)).toMatchObject({
      status: 'ok',
      value: 'EventScheduled',
      text: 'On as planned',
    });
  });

  it('says why a link gives nothing: hidden, broken, or another kind', () => {
    expect(resolve(link('field_notes'), 'text', LOOKUP).status).toBe('hidden');
    expect(resolve({ source: { sourceType: 'entity-field', expression: 'ℹ︎␜entity:node:event␝field_gone␞␟value' } }, 'text', LOOKUP).status).toBe('broken');
    expect(resolve(link('field_starts'), 'text', LOOKUP).status).toBe('broken');
  });

  it('without an item to preview, values are unknown, the site name is not', () => {
    const none = { ...LOOKUP, resolvable: false };
    expect(resolve({ fact: 'title' }, 'text', none).status).toBe('none');
    expect(resolve({ fact: 'site' }, 'text', none).value).toBe('Example');
  });

  it('textOf() is what texts() takes: the output text, or nothing', () => {
    expect(textOf(LOOKUP)(link('field_notes'))).toBe('');
    expect(textOf(LOOKUP)(link('field_venue'))).toBe('Mannerheimintie 13e');
  });
});

describe('the link menu', () => {
  const template = (path: string, kind: Parameters<typeof entriesFor>[1]) =>
    entriesFor(path, kind, 'template', LOOKUP, 'Event');

  it('offers the type\'s fields, then the facts of the kind', () => {
    const entries = template('description', 'text');
    expect(entries.filter((entry) => entry.group === 'Page').map((entry) => entry.label)).toEqual([
      'Title',
      'Description',
      'Site name',
      'Author',
    ]);
    // The Description fact and the type's own Description field are told
    // apart by their group, never by a machine name.
    const descriptions = entries.filter((entry) => entry.label === 'Description');
    expect(descriptions.map((entry) => entry.group)).toEqual(['Event', 'Page']);
  });

  it('shows dates in a text place disabled: a date, not text', () => {
    const starts = template('title', 'text').find((entry) => entry.key === link('field_starts').source.expression)!;
    expect(starts.disabled).toBe('A date, not text');
    // A date place takes them, and shows each item's date.
    const dates = template('schema.props.startDate', 'date').filter((entry) => !entry.disabled && entry.group === 'Event');
    expect(dates.map((entry) => [entry.label, entry.shown])).toEqual([
      ['Starts', '2027-06-19T19:00:00+03:00'],
      ['Ends', '2027-06-19T22:30:00+03:00'],
    ]);
  });

  it('shows an image in a text place disabled, and a hidden field as hidden', () => {
    const entries = template('title', 'text');
    expect(entries.find((entry) => entry.label === 'Image' && entry.level === 'Poster')?.disabled).toBe('An image, not text');
    expect(entries.find((entry) => entry.label === 'Notes')?.disabled).toBe('Hidden from visitors');
  });

  it('shows a list field by its label', () => {
    expect(template('schema.props.eventStatus', 'text').find((entry) => entry.label === 'Status')?.shown).toBe('On as planned');
  });

  it('tells two fields with one label apart by machine name', () => {
    const twins = { ...LOOKUP, sources: [row('field_summary', ['Summary']), row('field_teaser', ['Summary'])] };
    expect(entriesFor('description', 'text', 'template', twins, 'Article').filter((entry) => entry.group === 'Article').map((entry) => entry.label)).toEqual([
      'Summary (field_summary)',
      'Summary (field_teaser)',
    ]);
  });

  it('a page links only its ending and structured data addresses, dates and images', () => {
    expect(factsFor('title_end', 'text', 'page')).toEqual(['site']);
    expect(factsFor('social.image', 'image', 'page')).toEqual([]);
    expect(factsFor('title', 'text', 'page')).toEqual([]);
    expect(factsFor('schema.props.startDate', 'date', 'page')).toEqual(['published', 'modified']);
    expect(factsFor('schema.props.headline', 'text', 'page')).toEqual([]);
    expect(factsFor('title_end', 'text', 'site')).toEqual(['site']);
    expect(entriesFor('description', 'text', 'page', LOOKUP, 'Page')).toEqual([]);
  });
});

describe('tree()', () => {
  const entries = entriesFor('location_address_streetAddress', 'text', 'template', LOOKUP, 'Event');

  it('lists a reference as one level, in the order of the form, and what does not fit last, folded', () => {
    const rows = tree(entries, null, '');
    // Poster holds only an image: no level for it. Dates, the image and the
    // hidden Notes wait in the fold.
    expect(rows.filter((one) => one.type === 'level')).toEqual([
      { type: 'level', level: 'Venue', group: 'Event', count: 2 },
      { type: 'level', level: FOLD, group: '', count: 4 },
    ]);
    expect(rows.at(-1)).toMatchObject({ type: 'level', level: FOLD });
    const folded = tree(entries, FOLD, '');
    expect(folded.map((one) => one.type === 'entry' && one.entry.full)).toEqual(['Starts', 'Ends', 'Notes', 'Poster › Image']);
    expect(folded.every((one) => one.type === 'entry' && one.deep && !!one.entry.disabled)).toBe(true);
    expect(foldLabel(folded.flatMap((one) => (one.type === 'entry' ? [one.entry] : [])), 'text')).toBe("4 fields that can't be linked here");
    expect(foldLabel(entries.filter((one) => one.kind === 'date'), 'text')).toBe("2 fields that aren't text");
  });

  it('opens at the level that holds an entry', () => {
    const street = entries.find((one) => one.full === 'Venue › Street address')!;
    expect(levelOf(street)).toBe('Venue');
    expect(levelOf(entries.find((one) => one.full === 'Starts')!)).toBe(FOLD);
    expect(levelOf(entries.find((one) => one.full === 'Description')!)).toBe(null);
  });

  it('lists the best matches first: label, its start, a word, the path, the value', () => {
    const own = entriesFor('description', 'text', 'template', {
      ...LOOKUP,
      sources: [
        row('body', ['Body'], { value: 'Summaries of the year.' }),
        row('body', ['Body', 'Summary'], { hop: false, value: 'Short.' }),
        row('field_summary', ['Summary'], { value: 'How teams turn output into stories.' }),
      ],
    }, 'Article');
    const order = (query: string) => tree(own, null, query).map((one) => one.type === 'entry' && one.entry.full);
    // "Midsummer" in the previewed title: a value match, last.
    expect(order('summ')).toEqual(['Summary', 'Body › Summary', 'Body', 'Title']);
    expect(order('Summary')).toEqual(['Summary', 'Body › Summary']);
  });

  it('opens a level in place', () => {
    expect(tree(entries, 'Venue', '').map((one) => one.type === 'entry' && one.entry.label)).toEqual(['Street address', 'City']);
  });

  it('keeps a reference hidden for this item only pickable; a field visitors never see is not', () => {
    const lookup = { ...LOOKUP, sources: [...LOOKUP.sources, row('field_venue', ['Venue', 'Title'], { status: 'hidden', value: '', names: true })] };
    const own = entriesFor('description', 'text', 'template', lookup, 'Event');
    expect(own.find((one) => one.full === 'Venue › Title')?.disabled).toBeUndefined();
    expect(own.find((one) => one.full === 'Notes')?.disabled).toBe('Hidden from visitors');
  });

  it('keeps what does not fit inside a level in the one fold, so a level counts what it lists', () => {
    const lookup = { ...LOOKUP, sources: [...LOOKUP.sources, row('field_poster', ['Poster', 'Alternative text'])] };
    const images = entriesFor('social.image', 'image', 'template', lookup, 'Event');
    expect(tree(images, null, '').find((one) => one.type === 'level' && one.level === 'Poster')).toMatchObject({ count: 1 });
    expect(tree(images, 'Poster', '').map((one) => one.type === 'entry' && one.entry.full)).toEqual(['Poster › Image']);
    expect(tree(images, FOLD, '').map((one) => one.type === 'entry' && one.entry.full)).toContain('Poster › Alternative text');
  });

  it('lists what fits first when filtered, and finds a reference by its name', () => {
    expect(tree(entries, null, 'st').map((one) => one.type === 'entry' && one.entry.full)).toEqual(['Venue › Street address', 'Status', 'Starts', 'Poster › Image']);
    const lookup = { ...LOOKUP, sources: [row('field_performers', ['Performers', 'Role']), row('field_performers', ['Performers', 'Title'], { names: true })] };
    const own = entriesFor('description', 'text', 'template', lookup, 'Event');
    expect(tree(own, null, 'Perfo')[0]).toMatchObject({ type: 'entry', entry: { full: 'Performers › Title' } });
  });

  it('lists a deep match at the top, with its path', () => {
    const rows = tree(entries, null, 'street');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'entry', deep: true, entry: { full: 'Venue › Street address' } });
    // Values match too, and accents and case do not count.
    expect(tree(entries, null, 'MANNERHÉIM').map((one) => one.type === 'entry' && one.entry.full)).toEqual(['Venue › Street address']);
  });
});

describe('small helpers', () => {
  it('kindOf() takes the property kind of a detail', () => {
    expect(kindOf('social.image')).toBe('image');
    expect(kindOf('schema.props.startDate', [{ key: 'startDate', label: 'Starts', kind: 'date' }])).toBe('date');
    expect(kindOf('description')).toBe('text');
  });

  it('sameValue() ignores key order', () => {
    expect(sameValue({ source: { sourceType: 'entity-field', expression: 'x' } }, { source: { expression: 'x', sourceType: 'entity-field' } } as never)).toBe(true);
    expect(sameValue({ text: '' }, undefined)).toBe(false);
  });

  it('enables only a list field whose value is an option for a choice', () => {
    const status = entriesFor('schema.props.eventStatus', 'text', 'template', LOOKUP, 'Event', ['EventScheduled', 'EventCancelled']);
    expect(status.filter((one) => !one.disabled).map((one) => one.full)).toEqual(['Status']);
    expect(status.find((one) => one.full === 'Description')?.disabled).toBe('Not one of the options');
    expect(status.find((one) => one.full === 'Title')?.disabled).toBe('Not one of the options');
    // A date is not an option either: one reason for every entry.
    expect(status.find((one) => one.full === 'Starts')?.disabled).toBe('Not one of the options');
  });

  it('lists the type\'s own fields first, then a part of one, then the references', () => {
    const lookup = {
      ...LOOKUP,
      sources: [
        row('field_image', ['Image', 'Alternative text'], { hop: false }),
        row('field_venue', ['Venue', 'City']),
        row('field_byline', ['Byline']),
      ],
    };
    const rows = tree(entriesFor('title', 'text', 'template', lookup, 'Article'), null, '');
    expect(rows.slice(0, 3).map((one) => (one.type === 'entry' ? one.entry.label : one.level))).toEqual([
      'Byline',
      'Image › Alternative text',
      'Venue',
    ]);
    // The facts keep their group, after the type's.
    expect(rows[3]).toMatchObject({ type: 'entry', entry: { group: 'Page' } });
  });

  it('says what a fact is when a field above gives the same', () => {
    const lookup = {
      ...LOOKUP,
      facts: { ...LOOKUP.facts, description: { ...fact('Description', 'text', 'An evening of new music.'), via: 'Body' } },
    };
    const entries = entriesFor('description', 'text', 'template', lookup, 'Event');
    expect(entries.find((one) => one.key === 'fact:description')?.note).toBe('The Body summary, else the start of the Body');
    // A fact of its own value says its value.
    expect(entries.find((one) => one.key === 'fact:title')?.note).toBeUndefined();
  });

  it('says why a broken link gives nothing', () => {
    expect(brokenWhy('missing', 'text')).toBe('no longer exists');
    expect(brokenWhy(undefined, 'text')).toBe('no longer exists');
    expect(brokenWhy('kind', 'text')).toBe('no longer gives text');
    expect(brokenWhy('kind', 'date')).toBe('no longer gives a date');
    expect(brokenWhy('error', 'text')).toBe('can no longer be read');
  });

  it('names a broken link by the machine name the server gives, for every reason', () => {
    const gone = { source: { sourceType: 'entity-field' as const, expression: 'ℹ︎␜entity:node:article␝field_summary␞␟value' } };
    const broken = (reason: 'missing' | 'kind' | 'error') => ({ ...LOOKUP, broken: { description: { field: 'field_summary', reason } } });
    expect(tagOf(gone, broken('missing'), 'description')).toBe('field_summary');
    // Still offered, for another kind: the machine name all the same.
    expect(tagOf(link('field_starts'), { ...LOOKUP, broken: { description: { field: 'field_starts', reason: 'kind' } } }, 'description')).toBe('field_starts');
    // Without the server's word (a restored link it has not seen yet): the
    // machine name in the link itself.
    expect(tagOf(gone, LOOKUP, 'description')).toBe('field_summary');
    expect(tagOf({ source: { sourceType: 'entity-field', expression: 'garbled' } }, LOOKUP, 'description')).toBe('A field');
    expect(tagOf(link('field_venue'), LOOKUP)).toBe('Venue › Street address');
  });

  it('names a value relinked from a broken one by its row, before the server has said', () => {
    const broken = { ...LOOKUP, broken: { description: { field: 'field_summary', reason: 'missing' as const } } };
    expect(tagOf(link('field_venue'), broken, 'description')).toBe('Venue › Street address');
  });
});

describe('list facts in the link menu', () => {
  const lookup: Lookup = {
    ...LOOKUP,
    sources: [
      row('field_ingredients', ['Ingredients'], { many: true, count: 8 }),
      row('field_method', ['Method'], { kinds: ['text', 'html'] }),
      row('field_steps', ['Steps'], { lines: true }),
      row('field_summary', ['Summary']),
    ],
  };
  const notes = (items: 'list' | 'one') =>
    Object.fromEntries(entriesFor('schema.props.recipeIngredient', 'text', 'template', lookup, 'Recipe', undefined, items).filter((entry) => entry.group === 'Recipe').map((entry) => [entry.label, entry.disabled ?? entry.note]));

  it('says what each field gives a list, and refuses one value', () => {
    expect(notes('list')).toEqual({ Ingredients: 'All 8, in order', Method: 'Each list item, in order', Steps: 'Each line, in order', Summary: 'One value, not a list' });
  });

  it('says that a single detail takes the first of several', () => {
    expect(notes('one')).toEqual({ Ingredients: 'First of 8', Method: undefined, Steps: undefined, Summary: undefined });
  });

  it('suggests a field of several values named like the list first, and refuses the facts', () => {
    const entries = entriesFor('schema.props.recipeIngredient', 'text', 'template', lookup, 'Recipe', undefined, 'list', 'Ingredients');
    expect(entries[0]).toMatchObject({ label: 'Ingredients', group: 'Suggested' });
    const facts = entries.filter((entry) => entry.key.startsWith('fact:'));
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((entry) => entry.disabled === 'One value, not a list')).toBe(true);
  });

  it('fills a list of codes from a list field of one value, never from one text', () => {
    const codes: Lookup = {
      ...LOOKUP,
      sources: [row('field_employment', ['Employment'], { value: 'PART_TIME', shown: 'Part time', list: true }), row('body', ['Body'], { kinds: ['text', 'html'] })],
    };
    const entries = entriesFor('schema.props.employmentType', 'text', 'template', codes, 'Job', ['FULL_TIME', 'PART_TIME'], 'list');
    expect(entries.find((entry) => entry.label === 'Employment')?.disabled).toBeUndefined();
    expect(entries.find((entry) => entry.label === 'Body')?.disabled).toBe('Not one of the options');
  });

  it('lists the site first for a reference, in its own group', () => {
    const refs: Lookup = {
      ...LOOKUP,
      facts: { ...LOOKUP.facts, identity: fact('Your site', 'ref', 'Example') },
      sources: [row('field_host', ['Host', 'Title'], { kinds: ['text', 'ref'] })],
    };
    expect(entriesFor('schema.props.organizer', 'ref', 'template', refs, 'Event')[0]).toMatchObject({ key: 'fact:identity', group: 'This site' });
  });

  it('offers a reference field itself as one row: its page, one Enter away', () => {
    const refs: Lookup = {
      ...LOOKUP,
      sources: [row('field_location', ['Location', 'Title'], { kinds: ['text', 'ref'], names: true, value: 'Example office' })],
    };
    const page = entriesFor('schema.props.jobLocation', 'ref', 'template', refs, 'Job').find((entry) => entry.key !== 'fact:identity');
    expect(page).toMatchObject({ label: 'Location', full: 'the Location page', level: null, note: 'Its page: Example office' });
    expect(tagOf({ source: refs.sources[0].source }, refs, undefined, 'ref')).toBe('Location');
    // As text, the same row is the page's title, under its reference.
    expect(entriesFor('schema.props.name', 'text', 'template', refs, 'Job')[0]).toMatchObject({ label: 'Title', level: 'Location' });
  });
});
