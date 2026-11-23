// cspell:ignore summ Perfo Hedy titl
import { describe, expect, it } from 'vitest';

import textCases from '../../tests/fixtures/text-cases.json';
import { REGISTRY } from './data.test-helper';
import type { FactInfo, Part, SourceRow, Value } from './types';
import {
  FOLD,
  allEmptySaid,
  braceKey,
  compose,
  compositionSaid,
  composes,
  fold,
  keyOf,
  sentences,
  type Lookup,
  brokenWhy,
  entriesFor,
  entriesIn,
  fitsPart,
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
  it('braceKey() takes `{` as each keyboard layout types it, never a shortcut', () => {
    const key = (over: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; altGraph: boolean }>) => {
      const { altGraph = false, ...event } = { key: '{', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over };
      return braceKey({ ...event, getModifierState: (name: string) => name === 'AltGraph' && altGraph });
    };
    // Shift+[ (a US layout), Option+8 (a German layout), AltGr+7 (reported
    // as Ctrl and Alt on one system).
    expect(key({ shiftKey: true })).toBe(true);
    expect(key({ altKey: true, shiftKey: true })).toBe(true);
    expect(key({ ctrlKey: true, altKey: true, altGraph: true })).toBe(true);
    // A shortcut is no brace; nor is another key.
    expect(key({ ctrlKey: true })).toBe(false);
    expect(key({ metaKey: true, shiftKey: true })).toBe(false);
    expect(key({ key: '[' })).toBe(false);
  });

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

// Compositions, shared with PHP (tests/fixtures/text-cases.json).

describe('compositions (tests/fixtures/text-cases.json)', () => {
  const file = textCases as unknown as {
    compositions: { name: string; parts: Part[]; values: Record<string, string>; long?: string[]; room?: number; expect: string }[];
    canon: { name: string; parts: Part[]; expect: Value | null }[];
    composes: { type: string; path: string; scope: 'page' | 'template' | 'site'; expect: boolean }[];
  };
  const key = (part: Part) => ('fact' in part ? part.fact : 'source' in part ? part.source.expression : '');

  it.each(file.compositions.map((one) => [one.name, one] as const))('joins %s', (_, one) => {
    const joined = compose(one.parts, (part) => one.values[key(part)] ?? '', (part) => (one.long ?? []).includes(key(part)), one.room ?? 0).join('');
    expect(joined.replace(/\s+/g, ' ').trim()).toBe(one.expect);
  });

  it.each(file.canon.map((one) => [one.name, one] as const))('folds %s', (_, one) => {
    expect(fold(one.parts) ?? null).toEqual(one.expect);
  });

  it('knows where a value composes', () => {
    for (const one of file.composes) {
      const prop = one.path.startsWith('schema.props.') ? REGISTRY[one.type].props?.find((prop) => prop.key === one.path.slice(13)) : null;
      expect(composes(prop, one.path, one.scope), `${one.type} ${one.path} ${one.scope}`).toBe(one.expect);
    }
  });
});

describe('a composition for the previewed item', () => {
  const words: Lookup = {
    ...LOOKUP,
    facts: { ...LOOKUP.facts, published: { ...LOOKUP.facts.published!, text: '4 May 2026' } },
    sources: [
      ...LOOKUP.sources.map((one) =>
        one.field === 'field_starts'
          ? { ...one, text: '19 June 2027' }
          : one.field === 'field_event_status'
            ? { ...one, text: 'On as planned' }
            : one.field === 'body'
              ? { ...one, text: 'An evening of new music.', long: true as const, part: 'An evening of new music. Bring a blanket. '.repeat(8) }
              : { ...one, text: one.value }),
      row('field_performers', ['Performers', 'Title'], { many: true, count: 3, value: 'Ada', text: 'Ada, Grace, Hedy', line: 'Ada, Grace and 1 more' }),
    ],
  };
  const performers = { source: words.sources.at(-1)!.source };

  it('joins the server words of its fields', () => {
    const title: Value = { parts: [{ fact: 'title' }, { text: ' in ' }, link('field_venue'), { text: ' · ' }, link('field_starts')] };
    // The first Venue row is the street: link() finds it by field.
    expect(resolve(title, 'line', words).value).toBe('Midsummer Night Concert in Mannerheimintie 13e · 19 June 2027');
    expect(resolve({ parts: [{ fact: 'title' }, { text: ', ' }, { fact: 'published' }] }, 'line', words).value).toBe('Midsummer Night Concert, 4 May 2026');
  });

  it('gives a list its label and several values every item, at most two in a title', () => {
    expect(resolve(link('field_event_status'), 'words', words).value).toBe('On as planned');
    expect(resolve(performers, 'words', words).value).toBe('Ada, Grace, Hedy');
    expect(resolve(performers, 'line', words).value).toBe('Ada, Grace and 1 more');
  });

  it('never formats a date: a date row without words gives nothing', () => {
    expect(resolve(link('field_starts'), 'words', LOOKUP)).toMatchObject({ status: 'empty', value: '' });
    // A lone date link in the description is read in words, never broken.
    expect(resolve(link('field_starts'), 'words', words)).toMatchObject({ status: 'ok', value: '19 June 2027' });
  });

  it('gives a long text part the room the rest leaves', () => {
    const value: Value = { parts: [link('body'), { text: ' Free delivery.' }] };
    const joined = [textOf(words)(value, 'words')].flat().join('');
    expect(joined.endsWith('Bring a blanket. Free delivery.')).toBe(true);
    expect(Array.from(joined).length).toBeLessThanOrEqual(155);
  });

  it('gives its default when every field is empty, and keeps its parts as segments', () => {
    const empty = { ...words, sources: words.sources.map((one) => ({ ...one, status: 'empty' as const, value: '', text: '' })) };
    expect(textOf(empty)({ parts: [link('field_venue'), { text: ' · ' }, link('field_starts')] }, 'line')).toEqual([]);
    expect(textOf(words)({ parts: [{ fact: 'title' }, { text: ' · ' }, link('field_starts')] }, 'line')).toEqual(['Midsummer Night Concert', ' · 19 June 2027']);
  });

  it('keys and compares compositions as values', () => {
    const a: Value = { parts: [{ fact: 'title' }, { text: ' ' }, link('field_starts')] };
    expect(sameValue(a, { parts: [{ fact: 'title' }, { text: ' ' }, link('field_starts')] })).toBe(true);
    expect(sameValue(a, { parts: [{ fact: 'title' }, { text: '  ' }, link('field_starts')] })).toBe(false);
    expect(keyOf(a)).not.toBe(keyOf({ parts: [{ fact: 'title' }, link('field_starts')] }));
  });

  it('cuts a long text at a sentence, else a word', () => {
    expect(sentences('One. Two. Three is long.', 12)).toBe('One. Two.');
    expect(sentences('alpha beta gamma delta', 13)).toBe('alpha beta…');
  });
});

describe('the menu of a place that composes', () => {
  const rows: SourceRow[] = [
    row('field_starts', ['Starts'], { kinds: ['date'], value: '2027-06-19T19:00:00+03:00', text: '19 June 2027' }),
    row('field_performers', ['Performers', 'Title'], { many: true, count: 3, value: 'Ada', text: 'Ada, Grace, Hedy', line: 'Ada, Grace and 1 more' }),
    row('body', ['Body'], { kinds: ['text', 'html'], long: true, value: 'Long text.', text: 'Long text.' }),
    row('field_tickets', ['Tickets'], { kinds: ['address'], value: 'https://tickets.example.com' }),
    row('field_description', ['Description'], { value: 'A field labelled like a fact', text: 'A field labelled like a fact' }),
  ];
  const lookup: Lookup = { ...LOOKUP, facts: { ...LOOKUP.facts, published: { ...LOOKUP.facts.published!, text: '4 May 2026' } }, sources: rows };
  const entries = (path: string) => entriesFor(path, 'text', 'template', lookup, 'Event', undefined, undefined, undefined, path === 'description' ? 'words' : 'line');
  const entry = (list: ReturnType<typeof entries>, label: string) => list.find((one) => one.label === label)!;

  it('lets dates and numbers fit with their words, and dates facts too', () => {
    const title = entries('title');
    expect(entry(title, 'Starts')).toMatchObject({ disabled: undefined, shown: '19 June 2027' });
    expect(title.find((one) => one.key === 'fact:published')).toMatchObject({ disabled: undefined, shown: '4 May 2026' });
    // An address is not text.
    expect(entry(title, 'Tickets').disabled).toBe('An address, not text');
  });

  it('shows several values joined, never the first of them', () => {
    expect(entries('title').find((one) => one.full === 'Performers › Title')).toMatchObject({ shown: 'Ada, Grace and 1 more', note: undefined });
    expect(entries('description').find((one) => one.full === 'Performers › Title')).toMatchObject({ shown: 'Ada, Grace, Hedy', note: undefined });
  });

  it('keeps long text out of a title, never out of a description', () => {
    // A long field and the Description fact alike: linked whole, never
    // added to or put in place of a part of a title.
    for (const key of ['fact:description', rows[2].source.expression]) {
      expect(entries('title').find((one) => one.key === key)).toMatchObject({ long: true, disabled: undefined });
      expect(entriesIn(entries('title'), 'link').find((one) => one.key === key)?.disabled).toBeUndefined();
      for (const mode of ['add', 'replace'] as const) {
        const listed = entriesIn(entries('title'), mode).find((one) => one.key === key)!;
        expect(listed.disabled).toBe('Too long for a title');
        // So it waits in the last row with the other entries that don't fit.
        expect(levelOf(listed)).toBe(FOLD);
      }
      expect(entries('description').find((one) => one.key === key)?.long).toBeUndefined();
      expect(entriesIn(entries('description'), 'add').find((one) => one.key === key)?.disabled).toBeUndefined();
    }
  });

  it('takes a pasted part only when it fits the place', () => {
    const linkTo = (field: string) => ({ source: rows.find((one) => one.field === field)!.source });
    expect(fitsPart({ text: ' in ' }, 'line', lookup)).toBe(true);
    expect(fitsPart({ text: 3 }, 'line', lookup)).toBe(false);
    expect(fitsPart({ text: 'a', fact: 'title' }, 'line', lookup)).toBe(false);
    expect(fitsPart({ fact: 'image' }, 'words', lookup)).toBe(false);
    expect(fitsPart({ fact: 'url' }, 'words', lookup)).toBe(false);
    expect(fitsPart({ fact: 'description' }, 'line', lookup)).toBe(false);
    expect(fitsPart({ fact: 'description' }, 'words', lookup)).toBe(true);
    expect(fitsPart(linkTo('body'), 'line', lookup)).toBe(false);
    expect(fitsPart(linkTo('body'), 'words', lookup)).toBe(true);
    expect(fitsPart(linkTo('field_tickets'), 'words', lookup)).toBe(false);
    expect(fitsPart({ source: { sourceType: 'entity-field', expression: 'gone' } }, 'words', lookup)).toBe(false);
    expect(fitsPart({ source: { sourceType: 'entity-field' } }, 'words', lookup)).toBe(false);
  });

  it('names a field labelled like a fact by its machine name', () => {
    expect(entries('title').some((one) => one.label === 'Description (field_description)')).toBe(true);
  });

  it('finds an old token typed from memory', () => {
    const list = tree(entries('title'), null, '{starts}');
    expect(list[0]).toMatchObject({ type: 'entry', entry: { label: 'Starts' } });
    // The item's own Title before a referenced page's.
    const venue = { ...lookup, sources: [row('field_venue', ['Venue', 'Title'], { hop: true, text: 'Lakeside Hall' }), ...rows] };
    const withVenue = entriesFor('title', 'text', 'template', venue, 'Event', undefined, undefined, undefined, 'line');
    for (const filter of ['title', 'titl', '{title}']) {
      expect(tree(withVenue, null, filter)[0]).toMatchObject({ type: 'entry', entry: { key: 'fact:title' } });
    }
  });
});

describe('what a composer says', () => {
  it('starts with the result, then each part that gives nothing, one full stop', () => {
    expect(compositionSaid('event', 'Summer Gala · 20 June 2026', '', [
      { label: 'Title', status: 'ok' },
      { label: 'Venue › City', status: 'empty' },
      { label: 'Starts', status: 'ok' },
    ])).toBe('This event: Summer Gala · 20 June 2026. Venue › City is empty for this event.');
    expect(compositionSaid('event', 'Summer Gala', '', [{ label: 'field_city', status: 'broken', why: 'no longer exists' }, { label: 'Notes', status: 'hidden' }]))
      .toBe('This event: Summer Gala. field_city no longer exists. Notes is hidden from visitors.');
    // Every field empty: what the default gives.
    expect(compositionSaid('event', '', 'Summer Gala', [{ label: 'City', status: 'empty' }])).toBe('This event: Summer Gala. City is empty for this event.');
    // Every field empty: what the guidance says.
    expect(allEmptySaid(['Venue › City', 'Starts'], 'event', 'Title')).toBe('Venue › City and Starts are empty for this event, so its default title is used.');
    expect(allEmptySaid(['Performers › Title'], 'event', 'Description')).toBe('Performers › Title is empty for this event, so its default description is used.');
    // A result with its own mark ends once.
    expect(compositionSaid('event', 'Doors open!', '', [])).toBe('This event: Doors open!');
    expect(compositionSaid('event', 'A bare event. It has its own text.', '', [{ label: 'Performers › Title', status: 'empty' }]))
      .toBe('This event: A bare event. It has its own text. Performers › Title is empty for this event.');
  });
});
