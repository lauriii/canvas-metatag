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
  detailLookup,
  fold,
  followsDefault,
  keptAsChip,
  keyOf,
  partsText,
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
  boxSaid,
  boxTag,
  chipTitle,
  startWords,
  namedFor,
  noItemHas,
  readsVia,
  tagOf,
  textOf,
  tree,
  withoutDefault,
  wordsShown,
  detailFrom,
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
    description: { ...fact('Description', 'text', 'New music by the lake.'), via: 'Description' },
    site: fact('Site name', 'text', 'Example'),
    url: fact('Page address', 'address', 'https://www.example.com/midsummer'),
    author: fact('Author', 'text', 'Rosa'),
    published: fact('First published', 'date', '2026-05-04T11:00:00+03:00'),
    modified: fact('Last updated', 'date', '2026-11-15T06:29:13+02:00'),
    image: { ...fact('Image', 'image', ''), image: null, via: 'Poster' },
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
    expect(entries.filter((entry) => entry.group === 'Automatic').map((entry) => entry.label)).toEqual([
      'Title',
      'Description',
      'Site name',
      'Author',
    ]);
    // The Description fact and the type's own Description field are told
    // apart by their group, never by a machine name.
    const descriptions = entries.filter((entry) => entry.label === 'Description');
    expect(descriptions.map((entry) => entry.group)).toEqual(['Event', 'Automatic']);
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
    expect(rows[3]).toMatchObject({ type: 'entry', entry: { group: 'Automatic' } });
  });

  it('says what a fact is when a field above gives the same, unless it says the field it reads', () => {
    const lookup = {
      ...LOOKUP,
      facts: {
        ...LOOKUP.facts,
        title: fact('Title', 'text', 'In short.'),
        description: { ...fact('Description', 'text', 'In short.'), via: 'Body › Summary' },
      },
      sources: [row('body', ['Body', 'Summary'], { hop: false, value: 'In short.' })],
    };
    const entries = entriesFor('schema.props.abstract', 'text', 'template', lookup, 'Event');
    // Its value and "from Body › Summary" tell it from the field's row.
    expect(entries.find((one) => one.key === 'fact:description')).toMatchObject({ shown: 'In short.', from: 'Body › Summary' });
    expect(entries.find((one) => one.key === 'fact:description')?.note).toBeUndefined();
    // A fact that reads no field says what it is.
    expect(entries.find((one) => one.key === 'fact:title')?.note).toBe('Its title');
    // A fact of its own value says its value.
    expect(entries.find((one) => one.key === 'fact:site')?.note).toBeUndefined();
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

describe('worked-out values in the link menu', () => {
  // "Every Article": a Body with a summary.
  const article: Lookup = {
    ...LOOKUP,
    facts: { ...LOOKUP.facts, description: { ...fact('Description', 'text', 'How teams turn feedback into releases.'), via: 'Body › Summary' } },
    sources: [
      row('body', ['Body'], { kinds: ['text', 'html'], value: '<p>The long story of how teams ship.</p>' }),
      row('body', ['Body', 'Summary'], { hop: false, value: 'How teams turn feedback into releases.' }),
    ],
  };
  // "Every Bookmark": only a title and a link field; no text or image field.
  const bookmark: Lookup = {
    ...LOOKUP,
    facts: { ...LOOKUP.facts, description: fact('Description', 'text', ''), image: { ...fact('Image', 'image', ''), image: null } },
    sources: [row('field_link', ['Link'], { kinds: ['address'], value: 'https://www.example.com/' })],
  };
  // "Every Post": its form lists a byline and an image's alternative text
  // before a plain Summary, which gives the Description.
  const post: Lookup = {
    ...LOOKUP,
    facts: { ...LOOKUP.facts, description: { ...fact('Description', 'text', 'Ten lessons from a year of shipping.'), via: 'Summary' } },
    sources: [
      row('field_byline', ['Byline'], { value: 'Ada Writer' }),
      row('field_image', ['Image', 'Alternative text'], { hop: false, value: 'A desk' }),
      row('field_post_summary', ['Summary'], { value: 'Ten lessons from a year of shipping.', named: ['description'] }),
    ],
  };
  const top = (lookup: Lookup, path: string, typeLabel: string) =>
    tree(entriesFor(path, 'text', 'template', lookup, typeLabel), null, '').flatMap((one) =>
      one.type === 'entry' ? [one.entry] : [],
    );

  it('groups them as Automatic, after the fields, and says which field one reads', () => {
    const entries = entriesFor('schema.props.abstract', 'text', 'template', article, 'Article');
    expect(entries.map((entry) => entry.group)).toEqual(['Article', 'Article', 'Automatic', 'Automatic', 'Automatic', 'Automatic']);
    const description = entries.find((entry) => entry.key === 'fact:description');
    expect(description).toMatchObject({
      label: 'Description',
      full: 'Description',
      shown: 'How teams turn feedback into releases.',
      from: 'Body › Summary',
    });
    // Body › Summary above gives the same text: "from" tells them apart, so
    // no note is added.
    expect(entries.find((entry) => entry.full === 'Body › Summary')?.shown).toBe(description?.shown);
    expect(description?.note).toBeUndefined();
    // Facts that read no field show their value alone.
    expect(entries.find((entry) => entry.key === 'fact:site')?.from).toBeUndefined();
  });

  it('is listed last in its group, disabled, when no item of the type can have it', () => {
    expect([noItemHas('description', bookmark), noItemHas('image', bookmark), noItemHas('title', bookmark)]).toEqual([true, true, false]);
    expect(noItemHas('description', article)).toBe(false);
    const entries = entriesFor('schema.props.abstract', 'text', 'template', bookmark, 'Bookmark');
    expect(entries.find((entry) => entry.key === 'fact:description')).toMatchObject({ disabled: 'No bookmark has one', unavailable: true });
    // At the top, where its reason is seen: the last of "Automatic".
    const automatic = top(bookmark, 'schema.props.abstract', 'Bookmark').filter((entry) => entry.group === 'Automatic');
    expect(automatic.at(-1)?.key).toBe('fact:description');
    expect(automatic.slice(0, -1).every((entry) => !entry.disabled)).toBe(true);
    // The fold holds the fields that don't fit, and says what they are.
    const rows = tree(entries, null, '');
    expect(rows.at(-1)).toMatchObject({ type: 'level', level: FOLD, count: 1 });
    const folded = entries.filter((entry) => levelOf(entry) === FOLD);
    expect(folded.map((entry) => entry.key)).toEqual([bookmark.sources[0].source.expression]);
    expect(foldLabel(folded, 'text')).toBe("1 field that isn't text");
    // The same in an image place: Image first, its reason in sight, then the
    // fold; never at page scope.
    const image = entriesFor('social.image', 'image', 'template', bookmark, 'Bookmark');
    expect(image.find((entry) => entry.key === 'fact:image')?.disabled).toBe('No bookmark has one');
    expect(tree(image, null, '').map((one) => (one.type === 'entry' ? one.entry.key : one.level))).toEqual(['fact:image', FOLD]);
    expect(entriesFor('schema.props.image', 'image', 'page', bookmark, 'Page').find((entry) => entry.key === 'fact:image')?.disabled).toBeUndefined();
    // A list of text: one value is the reason, and it waits in the fold.
    expect(levelOf(entriesFor('schema.props.keywords', 'text', 'template', bookmark, 'Bookmark', undefined, 'list').find((entry) => entry.key === 'fact:description')!)).toBe(FOLD);
  });

  it('is offered on a type with no item yet, by the field it would read', () => {
    // No item to preview: no value, but the type's form names the field.
    const none: Lookup = { ...article, resolvable: false, facts: { ...article.facts, description: { ...fact('Description', 'text', ''), via: 'Body' } } };
    const description = entriesFor('schema.props.abstract', 'text', 'template', none, 'Article').find((entry) => entry.key === 'fact:description');
    expect(description).toMatchObject({ from: 'Body', status: 'none' });
    expect(description?.disabled).toBeUndefined();
  });

  it('reads a plain Summary on "Every Post", and says so beside its value', () => {
    const description = entriesFor('schema.props.abstract', 'text', 'template', post, 'Post').find((entry) => entry.key === 'fact:description');
    // The Summary field above gives the same text: the value stays, with
    // where it comes from, never a guess about a summary.
    expect(description).toMatchObject({ shown: 'Ten lessons from a year of shipping.', from: 'Summary', group: 'Automatic' });
    expect(description?.note).toBeUndefined();
    expect(description?.disabled).toBeUndefined();
  });

  it("leaves the field's own default out when the pick links the whole value", () => {
    const entries = entriesFor('description', 'text', 'template', post, 'Post');
    // Adding to a composition offers it, with where it comes from.
    expect(entries.find((entry) => entry.key === 'fact:description')).toMatchObject({ group: 'Automatic', from: 'Summary' });
    const link = withoutDefault(entries, { fact: 'description' });
    expect(link.map((entry) => entry.key)).not.toContain('fact:description');
    expect(link).toHaveLength(entries.length - 1);
    expect(withoutDefault(entries, null)).toBe(entries);
  });

  it('a box names a worked-out value by its label, and the field it reads', () => {
    const said = (over: Partial<Parameters<typeof boxSaid>[0]>) =>
      boxSaid({ linked: true, broken: false, source: '', group: '', why: '', type: 'article', defaultName: '', said: 'This article: Example.', ...over });
    expect(said({ source: tagOf({ fact: 'site' }, article) })).toBe('Linked to Site name. This article: Example.');
    expect(said({ linked: false, defaultName: "each post's description", from: 'Summary', said: 'This post: Ten lessons.' })).toBe(
      "Follows the default: each post's description, from Summary. This post: Ten lessons.",
    );
    expect(said({ source: 'Description', from: 'Body' })).toBe('Linked to Description, from Body. This article: Example.');
    expect(said({ source: 'Summary', group: 'Article › ' })).toBe('Linked to Article › Summary. This article: Example.');
    // The link button's tooltip says the default the same way.
    expect(followsDefault("each post's description", 'Summary')).toBe("Follows the default: each post's description, from Summary");
    expect(followsDefault('the site name')).toBe('Follows the default: the site name');
  });

  it('a box that follows words says when the previewed item gives none', () => {
    // The social description of a person without a biography: "Empty for
    // this person", never "This person: .".
    expect(wordsShown('', true)).toEqual({ status: 'empty', value: '', text: '', image: null });
    expect(wordsShown('Ten lessons.', true)).toEqual({ status: 'ok', value: 'Ten lessons.', text: 'Ten lessons.', image: null });
    expect(wordsShown('Ten lessons.', false).status).toBe('none');
  });

  it("a detail's Description is the head's, and reads its default's field only while it follows the default", () => {
    const head = 'How teams turn feedback into releases. Free delivery.';
    // Following the default: the field it reads is said.
    const follows = detailLookup(article, 'How teams turn feedback into releases.', undefined);
    expect(follows.facts.description).toMatchObject({ value: 'How teams turn feedback into releases.', via: 'Body › Summary' });
    expect(detailLookup(article, '', { fact: 'description' }).facts.description?.via).toBe('Body › Summary');
    // Set for the place: what is set, from no one field.
    const set = detailLookup(article, head, { parts: [{ fact: 'description' }, { text: ' Free delivery.' }] });
    expect(set.facts.description).toMatchObject({ value: head, via: '' });
    expect(boxTag({ linked: false, value: { fact: 'description' }, source: 'Description', label: 'Summary', lookup: set, template: true, type: 'article' }).tag).toBe(
      'Default · Description',
    );
    const entry = entriesFor('schema.props.abstract', 'text', 'template', set, 'Article').find((one) => one.key === 'fact:description');
    expect(entry).toMatchObject({ shown: head });
    expect(entry?.from).toBeUndefined();
    // Every item has a description that is set, also on a type whose items
    // have none of their own.
    expect(noItemHas('description', detailLookup(bookmark, 'Saved for later.', { text: 'Saved for later.' }))).toBe(false);
    expect(noItemHas('description', detailLookup(bookmark, '', undefined))).toBe(true);
  });

  it("an unset detail names the field its image reads, or says no item has one", () => {
    // "Every Article" with a Hero image; "Every Bookmark" with none.
    const hero: Lookup = { ...article, facts: { ...article.facts, image: { ...fact('Image', 'image', ''), image: null, via: 'Hero image' } } };
    expect(detailFrom('image', hero, true, 'article')).toBe('From the Hero image field');
    expect(detailFrom('image', bookmark, true, 'bookmark')).toBe('No bookmark has one');
    // A page's own image can always be had.
    expect(detailFrom('image', bookmark, false, 'page')).toBe('From the Image field');
    expect(detailFrom('description', bookmark, true, 'bookmark')).toBe('Same as description');
    expect(detailFrom('title', article, true, 'article')).toBe('From the page title');
    expect(detailFrom('published', article, true, 'article')).toBe('From the page');
  });

  it('composing starts empty from a default no item of the type has', () => {
    expect(keptAsChip({ fact: 'description' }, 'words', bookmark, true)).toBe(false);
    expect(startWords(keptAsChip({ fact: 'description' }, 'words', bookmark, true), false, 'Description', 'Description')).toBe('Type words and add fields');
    expect(keptAsChip({ fact: 'description' }, 'words', post, true)).toBe(true);
    expect(startWords(true, false, 'Description', 'Description')).toBe('Keep the default and add to it');
    // On a page the Description is the page's own.
    expect(keptAsChip({ fact: 'description' }, 'words', bookmark, false)).toBe(true);
    // A value a composition can't hold starts empty too.
    expect(keptAsChip({ fact: 'description' }, 'line', post, true)).toBe(false);
    expect(keptAsChip(undefined, 'words', post, true)).toBe(false);
  });

  it('an item without a field lacks it wherever the composition uses it', () => {
    const description: Part = { fact: 'description' };
    const parts: Part[] = [description, { text: ' Free delivery. ' }, description];
    expect(partsText(parts, 'words', post)).toBe('Ten lessons from a year of shipping. Free delivery. Ten lessons from a year of shipping.');
    expect(partsText(parts, 'words', post, description)).toBe('');
    const byline: Part = { source: post.sources[0].source };
    expect(partsText([description, { text: ' by ' }, byline], 'words', post, byline)).toBe('Ten lessons from a year of shipping.');
  });
});

describe('fields named for the value', () => {
  const post: Lookup = {
    ...LOOKUP,
    sources: [
      row('field_byline', ['Byline'], { value: 'Ada Writer' }),
      row('field_image', ['Image', 'Alternative text'], { hop: false, value: 'A desk' }),
      row('field_post_summary', ['Summary'], { value: 'Ten lessons from a year of shipping.', named: ['description'] }),
      row('field_lead_time', ['Lead time'], { value: 'Two weeks' }),
    ],
  };

  it("are the fields the server says are named for the place's value", () => {
    // The server decides (Values::isNamedFor(), as the Description fact).
    expect(namedFor('description', post.sources[2])).toBe(true);
    expect(namedFor('description', post.sources[3])).toBe(false);
    expect(namedFor('social.description', post.sources[2])).toBe(true);
    expect(namedFor('schema.props.headline', row('field_headline', ['Headline'], { named: ['title'] }))).toBe(true);
    expect(namedFor('title', row('field_title', ['Title'], { named: ['title'] }))).toBe(true);
    expect(namedFor('description', row('field_title', ['Title'], { named: ['title'] }))).toBe(false);
    // A place of another value: none.
    expect(namedFor('schema.props.genre', post.sources[2])).toBe(false);
  });

  it('come first with an empty filter, then the others in form order', () => {
    const rows = tree(entriesFor('description', 'text', 'template', post, 'Post'), null, '');
    const fields = rows.flatMap((one) => (one.type === 'entry' && one.entry.group === 'Post' ? [one.entry.label] : []));
    expect(fields).toEqual(['Summary', 'Byline', 'Lead time', 'Image › Alternative text']);
    // Another place keeps the form's order.
    const abstract = tree(entriesFor('schema.props.genre', 'text', 'template', post, 'Post'), null, '');
    expect(abstract.flatMap((one) => (one.type === 'entry' && one.entry.group === 'Post' ? [one.entry.label] : []))).toEqual([
      'Byline',
      'Summary',
      'Lead time',
      'Image › Alternative text',
    ]);
  });

  it("leave a typed filter's ranking as it was", () => {
    const entries = entriesFor('description', 'text', 'template', post, 'Post');
    const plain = entries.map(({ named: _named, ...entry }) => entry);
    const keys = (rows: ReturnType<typeof tree>) => rows.map((one) => (one.type === 'entry' ? one.entry.key : one.level));
    for (const filter of ['alt', 'e', 'summary']) {
      expect(keys(tree(entries, null, filter))).toEqual(keys(tree(plain, null, filter)));
    }
    expect(tree(entries, null, 'alt')[0]).toMatchObject({ entry: { label: 'Image › Alternative text' } });
  });
});

describe('the default a place follows', () => {
  // "Every Event": the Description reads its field's summary.
  const event: Lookup = {
    ...LOOKUP,
    facts: { ...LOOKUP.facts, description: { ...fact('Description', 'text', 'New music by the lake.'), via: 'Description › Summary' } },
    sources: [
      row('body', ['Description'], { hop: false, kinds: ['text', 'html'], value: 'An evening of new music.' }),
      row('field_event_status', ['Status'], { value: 'EventScheduled', shown: 'On as planned', list: true }),
      row('body', ['Description', 'Summary'], { hop: false, kinds: ['text', 'html'], value: 'New music by the lake.' }),
      row('field_poster', ['Poster', 'Image'], { hop: false, kinds: ['image'], value: '', image: { name: 'Midsummer poster', alt: 'An orchestra at dusk', thumb: '/p.png', width: 1600, height: 900 } as never }),
    ],
  };
  const group = (path: string, kind: 'text' | 'image', lookup = event) =>
    tree(withoutDefault(entriesFor(path, kind, 'template', lookup, 'Event'), { fact: path === 'social.image' ? 'image' : 'description' }), null, '').flatMap(
      (one) => (one.type === 'entry' ? [one.entry] : []),
    );

  it('lists the field it reads first, where the Default box names it', () => {
    expect(group('description', 'text').filter((entry) => entry.group === 'Event').map((entry) => entry.full)).toEqual([
      'Description › Summary',
      'Description',
      'Status',
    ]);
    expect(readsVia(group('description', 'text')[0], 'Description › Summary')).toBe(true);
    // Another place keeps the form's order.
    expect(group('schema.props.genre', 'text').filter((entry) => entry.group === 'Event').map((entry) => entry.full)[0]).toBe('Description');
  });

  it("leaves the Image an image follows out of its menu, and leads with the Image's field", () => {
    // "Every Person" and "Every Event": the social image follows Image, which
    // reads a field; the menu that links it offers the field, not Image.
    const image = group('social.image', 'image');
    expect(image.map((entry) => entry.key)).not.toContain('fact:image');
    expect(image[0].full).toBe('Poster › Image');
    expect(readsVia(image[0], 'Poster')).toBe(true);
    expect(readsVia(image[0], 'Post')).toBe(false);
  });

  it('marks the level that holds the field the default reads', () => {
    // "Every Person": the Image reads Photo, a media reference: its level
    // says "Default" before it is opened.
    const person: Lookup = {
      ...event,
      facts: { ...event.facts, image: { ...fact('Image', 'image', ''), via: 'Photo' } },
      sources: [event.sources[1], row('field_photo', ['Photo', 'Image'], { kinds: ['image'], value: '' })],
    };
    const entries = withoutDefault(entriesFor('social.image', 'image', 'template', person, 'Person'), { fact: 'image' });
    const rows = tree(entries, null, '', (entry) => readsVia(entry, 'Photo'));
    expect(rows.find((one) => one.type === 'level' && one.level === 'Photo')).toMatchObject({ marked: true });
    expect(tree(entries, null, '').find((one) => one.type === 'level' && one.level === 'Photo')).not.toHaveProperty('marked');
  });

  it('keeps a default no item has in its menu, disabled, with the reason', () => {
    // "Every Announcement": no image field. The social image's menu says why
    // nothing fits instead of opening on the fold alone.
    const announcement: Lookup = { ...event, facts: { ...event.facts, image: { ...fact('Image', 'image', ''), image: null } }, sources: [event.sources[1]] };
    const menu = tree(withoutDefault(entriesFor('social.image', 'image', 'template', announcement, 'Announcement'), { fact: 'image' }), null, '');
    expect(menu.map((one) => (one.type === 'entry' ? one.entry.key : one.level))).toEqual(['fact:image', FOLD]);
    expect(menu[0]).toMatchObject({ entry: { group: 'Automatic', disabled: 'No announcement has one' } });
  });

  it('a Default box names the field it reads, or says no item can have it', () => {
    const tag = (over: Partial<Parameters<typeof boxTag>[0]>) =>
      boxTag({ linked: false, value: { fact: 'description' }, source: 'Description', label: 'Description', lookup: event, template: true, type: 'event', ...over });
    expect(tag({})).toEqual({ tag: 'Default · from Description › Summary', from: 'Description › Summary' });
    // "Every Article" with a Hero image: the social image's box.
    const article: Lookup = { ...event, facts: { ...event.facts, image: { ...fact('Image', 'image', ''), image: null, via: 'Hero image' } } };
    expect(tag({ value: { fact: 'image' }, source: 'Image', label: 'Image', lookup: article, type: 'article' }).tag).toBe('Default · from Hero image');
    // "Every Bookmark": no field gives a description.
    const bookmark: Lookup = { ...event, facts: { ...event.facts, description: fact('Description', 'text', '') }, sources: [] };
    expect(tag({ lookup: bookmark, type: 'bookmark' })).toEqual({ tag: 'Default', none: 'No bookmark has one' });
    // A page's own value can always be had; a default of another place
    // names its source; a link is named by its source alone.
    expect(tag({ lookup: bookmark, template: false, type: 'page' }).none).toBeUndefined();
    expect(tag({ value: { fact: 'published' }, source: 'First published', label: 'Date published' }).tag).toBe('Default · First published');
    expect(tag({ value: { fact: 'description' }, source: 'Description', label: 'Abstract' }).tag).toBe('Default · Description, from Description › Summary');
    expect(tag({ linked: true, value: { fact: 'site' }, source: 'Site name' }).tag).toBe('Site name');
  });
});

describe('worked-out values in a composer', () => {
  // "Every Post": a plain Summary gives the Description.
  const post: Lookup = {
    ...LOOKUP,
    facts: { ...LOOKUP.facts, description: { ...fact('Description', 'text', 'Ten lessons from a year of shipping.'), via: 'Summary' } },
    sources: [
      row('field_byline', ['Byline'], { value: 'Ada Writer', text: 'Ada Writer' }),
      row('field_image', ['Image', 'Alternative text'], { hop: false, value: 'A desk', text: 'A desk' }),
      row('field_post_summary', ['Summary'], { value: 'Ten lessons from a year of shipping.', text: 'Ten lessons from a year of shipping.', named: ['description'] }),
    ],
  };
  // "Every Bookmark": no field gives a description.
  const bookmark: Lookup = {
    ...LOOKUP,
    facts: { ...LOOKUP.facts, description: fact('Description', 'text', ''), image: { ...fact('Image', 'image', ''), image: null } },
    sources: [row('field_link', ['Link'], { kinds: ['address'], value: 'https://www.example.com/' })],
  };
  const composing = (lookup: Lookup, path: string, typeLabel: string) =>
    entriesFor(path, 'text', 'template', lookup, typeLabel, undefined, undefined, undefined, path === 'description' ? 'words' : 'line');

  it("offers the field's own default when adding or replacing, never when linking the whole value", () => {
    const entries = composing(post, 'description', 'Post');
    for (const mode of ['add', 'replace'] as const) {
      const offered = entriesIn(entries, mode).find((entry) => entry.key === 'fact:description');
      expect(offered).toMatchObject({ label: 'Description', group: 'Automatic', from: 'Summary' });
      expect(offered?.disabled).toBeUndefined();
    }
    // Linking: Value.tsx leaves it out (withoutDefault()) in link mode only.
    expect(withoutDefault(entriesIn(entries, 'link'), { fact: 'description' }).some((entry) => entry.key === 'fact:description')).toBe(false);
  });

  it('says "No ‹type› has one" when adding on a type without the value', () => {
    for (const path of ['description', 'title']) {
      const added = entriesIn(composing(bookmark, path, 'Bookmark'), 'add');
      // Never "Too long for a title": the reason that holds for every item.
      expect(added.find((entry) => entry.key === 'fact:description')).toMatchObject({ disabled: 'No bookmark has one', unavailable: true });
      const automatic = tree(added, null, '').flatMap((one) => (one.type === 'entry' && one.entry.group === 'Automatic' ? [one.entry.key] : []));
      expect(automatic.at(-1)).toBe('fact:description');
    }
  });

  it('lists the fields named for the value first when adding', () => {
    const rows = tree(entriesIn(composing(post, 'description', 'Post'), 'add'), null, '');
    expect(rows.flatMap((one) => (one.type === 'entry' && one.entry.group === 'Post' ? [one.entry.label] : []))).toEqual(['Summary', 'Byline', 'Image › Alternative text']);
  });

  it('names the field a worked-out value reads as the menu names it', () => {
    // "Every Event": the Description reads the body field, labelled
    // Description too: "from Description (body)", never a circle.
    const event: Lookup = {
      ...LOOKUP,
      facts: { ...LOOKUP.facts, description: { ...fact('Description', 'text', 'An evening of new music.'), via: 'Description' } },
      sources: [row('body', ['Description'], { hop: false, kinds: ['text', 'html'], value: 'An evening of new music.' })],
    };
    const entries = entriesFor('title', 'text', 'template', event, 'Event', undefined, undefined, undefined, 'line');
    expect(entries.find((entry) => entry.key === 'fact:description')?.from).toBe('Description (body)');
    expect(entries.find((entry) => 'source' in entry.value)?.full).toBe('Description (body)');
    // The Default box names it by its label: "from" always names a field.
    expect(boxTag({ linked: false, value: { fact: 'description' }, source: 'Description', label: 'Description', lookup: event, template: true, type: 'event' }).tag).toBe('Default · from Description');
    // The description's own menu, linking, lists no Description fact: the
    // field goes by its label. Adding, both are listed, told apart.
    const own = entriesFor('description', 'text', 'template', event, 'Event', undefined, undefined, undefined, 'words');
    const linking = withoutDefault(own, { fact: 'description' }).find((entry) => 'source' in entry.value)!;
    expect(linking).toMatchObject({ label: 'Description', full: 'Description' });
    expect(readsVia(linking, 'Description')).toBe(true);
    expect(entriesIn(own, 'add').find((entry) => 'source' in entry.value)?.full).toBe('Description (body)');
    // Linking alone, nothing is told apart: the field keeps its label.
    expect(entriesFor('schema.props.abstract', 'text', 'template', event, 'Event').find((entry) => entry.key === 'fact:description')?.from).toBe('Description');
  });

  it('finds the field the default reads when it is told apart from a fact by its machine name', () => {
    // The Event's Body is labelled like the Description fact.
    const entries = composing(LOOKUP, 'description', 'Event');
    const body = entries.find((entry) => entry.full === 'Description (body)')!;
    expect(readsVia(body, 'Description')).toBe(true);
    expect(body.named).toBe(true);
    expect(readsVia(entries.find((entry) => entry.full === 'Status')!, 'Description')).toBe(false);
  });

  it('a chip is named by its label, and says the field it reads in its tooltip and the description', () => {
    expect(tagOf({ fact: 'description' }, post)).toBe('Description');
    expect(chipTitle('Ten lessons from a year of shipping.', 'Summary')).toBe('Ten lessons from a year of shipping. · from Summary');
    expect(chipTitle('Ten lessons.', 'Summary', 'Without Description: Free delivery.')).toBe('Ten lessons. · from Summary\nWithout Description: Free delivery.');
    expect(chipTitle('Empty for this post')).toBe('Empty for this post');
    expect(compositionSaid('post', 'Ten lessons from a year of shipping. Free delivery.', '', [{ label: 'Description', status: 'ok', from: 'Summary' }])).toBe(
      'This post: Ten lessons from a year of shipping. Free delivery. Description comes from Summary.',
    );
    // Said once, however often the value is a part.
    expect(compositionSaid('post', 'A. B.', '', [{ label: 'Description', status: 'ok', from: 'Summary' }, { label: 'Description', status: 'ok', from: 'Summary' }])).toBe(
      'This post: A. B. Description comes from Summary.',
    );
  });

  it('"Add words or fields" says what the composer starts from', () => {
    expect(startWords(true, true, 'Summary', 'Description')).toBe('Keep Summary and add to it');
    expect(startWords(true, false, 'Title', 'Social title')).toBe('Start from Title');
    expect(startWords(true, false, 'Description', 'Description')).toBe('Keep the default and add to it');
    expect(startWords(false, false, 'Description', 'Title')).toBe('Type words and add fields');
  });
});
