import { describe, expect, it } from 'vitest';

import textCases from '../../tests/fixtures/text-cases.json';
import { ApiError } from './api';
import type { EditorToken } from './host';
import {
  type DraftIO,
  LIMITS,
  MESSAGES,
  REGISTRY,
  applyChanges,
  article,
  breadcrumb,
  canon,
  cascade,
  chipsIn,
  dateText,
  diff,
  dirOf,
  displayLabels,
  draftPayload,
  fieldNames,
  fill,
  footer,
  getPath,
  inSentence,
  inherited,
  initialState,
  insertChip,
  jsonStrings,
  measure,
  merge,
  meter,
  openPending,
  pendingFor,
  plain,
  previewNote,
  previewText,
  prune,
  readPending,
  reducer,
  removeChip,
  saveDraft,
  seedCaret,
  seedTitle,
  setPath,
  sitePaths,
  siteTexts,
  socialImage,
  source,
  strips,
  tabOf,
  texts,
  toDisplay,
  toStored,
  tokenGroups,
  truncate,
  unsent,
  view,
  wholeChips,
} from './model';
import type {
  Action,
  Measurer,
  Resolved,
  SeoValues,
  State,
  StatePayload,
  Target,
} from './types';

// Fixtures.

const SITE = {
  identity: {
    kind: 'organization' as const,
    name: '',
    separator: '|',
    logo: '',
    default_image: '',
    same_as: [],
  },
  values: {
    title: '{title} {sep} {site}',
    robots: { max_image_preview: 'large' as const },
  },
};

const target = (over: Partial<Target> = {}): Target => ({
  scope: 'page',
  entity_type: 'canvas_page',
  id: '8',
  label: 'Pricing',
  auto_save_key: 'canvas_page:8:en',
  translatable: true,
  default_langcode: 'en',
  published: true,
  has_draft: false,
  values: {},
  from_default: {},
  ...over,
});

const payload = (over: Partial<StatePayload> = {}): StatePayload => ({
  langcode: 'en',
  languages: { en: 'English' },
  origin: { url: 'https://www.example.com', source: 'request' },
  can: { target: true, site: true },
  capabilities: { ai: null },
  site: SITE,
  target: target(),
  preview: {
    entity_type: 'canvas_page',
    id: '8',
    label: 'Pricing',
    url: 'https://www.example.com/pricing',
    published: true,
  },
  tokens: {
    title: { label: 'Page title', type: 'text', value: 'Pricing' },
    description: { label: 'Description', type: 'text', value: 'Plans.' },
    site: { label: 'Site name', type: 'text', value: 'Example' },
    sep: { label: 'Separator', type: 'text', value: '|' },
  },
  media: {},
  resolved: null,
  ...over,
});

const PAGE = { kind: 'page', id: '8' } as const;

const ready = (over: Partial<StatePayload> = {}): State =>
  reducer(initialState(PAGE), {
    type: 'loaded',
    ctx: PAGE,
    payload: payload(over),
    readonly: 'no',
  });

const run = (state: State, ...actions: Action[]) =>
  actions.reduce(reducer, state);

const edit = (
  path: string,
  value: unknown,
  scope: 'target' | 'site' = 'target',
) => ({ type: 'edit', scope, path, value }) as const;

// Text outputs, shared with PHP.

describe('text outputs (tests/fixtures/text-cases.json)', () => {
  const file = textCases as {
    tokens: Record<string, string>;
    site: SeoValues;
    cases: {
      name: string;
      target?: SeoValues;
      site?: SeoValues;
      tokens?: Record<string, string>;
      expect: Record<string, string>;
    }[];
  };
  it.each(file.cases.map((row) => [row.name, row] as const))('%s', (_, row) => {
    const out = texts(cascade(row.target ?? {}, row.site ?? file.site), {
      ...file.tokens,
      ...row.tokens,
    });
    expect(
      Object.fromEntries(
        Object.keys(row.expect).map((key) => [
          key,
          out[key as keyof typeof out],
        ]),
      ),
    ).toEqual(row.expect);
  });

  it('separators with nothing to separate go, as in PHP', () => {
    const title = (tokens: Record<string, string>) =>
      texts(
        { title: '{title} {sep} {field.section} {sep} {site}' },
        { ...file.tokens, 'field.section': '', ...tokens },
      ).title;
    // "| | Example" and "Pricing | |" before trimming.
    expect(title({ title: '' })).toBe('Example');
    expect(title({ site: '' })).toBe('Pricing');
    expect(title({ title: '', site: '' })).toBe('');
  });

  it('fill() ignores names that only exist on the prototype', () => {
    expect(fill('{constructor} {title}', { title: 'A' })).toBe(' A');
  });

  it('plain() cuts in code points and removes DEL like PHP', () => {
    expect(plain('👨‍👩 team', 3)).toBe('👨‍👩');
    expect(plain('a\u007Fb\u0085c', 10)).toBe('abc');
    // A no-break space is not one of the four collapsed characters.
    const nbsp = String.fromCharCode(0xa0);
    expect(plain(`a${nbsp} b`, 10)).toBe(`a${nbsp} b`);
  });
});

// Layers.

describe('layers', () => {
  it('merge() replaces per leaf', () => {
    expect(
      merge<SeoValues>(
        { robots: { noindex: true, nofollow: true }, social: { image: 'a' } },
        { robots: { noindex: false }, title: 'T' },
      ),
    ).toEqual({
      robots: { noindex: false, nofollow: true },
      social: { image: 'a' },
      title: 'T',
    });
  });

  it('cascade() takes the title and robots from the site, and nothing else', () => {
    expect(
      cascade({ robots: { noindex: true } }, {
        title: 'S',
        description: 'ignored',
        robots: { noindex: false, max_image_preview: 'large' },
      } as SeoValues),
    ).toEqual({
      title: 'S',
      robots: { noindex: true, max_image_preview: 'large' },
    });
    expect(cascade({ title: 'T' }, {})).toEqual({ title: 'T' });
  });

  it('source() walks target, default-language version, site, fallback', () => {
    const layers = {
      target: { title: 'T', robots: { nofollow: true } },
      from_default: {
        robots: { noindex: true },
        social: { image: 'uuid' },
        schema: { type: 'Article' },
      },
      site: { title: 'S', robots: { max_image_preview: 'large' as const } },
    };
    expect(source('title', layers)).toBe('target');
    expect(source('robots.nofollow', layers)).toBe('target');
    expect(source('robots.noindex', layers)).toBe('default');
    expect(source('social.image', layers)).toBe('default');
    expect(source('schema.type', layers)).toBe('default');
    expect(source('robots.max_image_preview', layers)).toBe('site');
    // A directive follows Site › Defaults even where the site stores none.
    expect(source('robots.nosnippet', layers)).toBe('site');
    expect(source('social.title', layers)).toBe('fallback');
    expect(source('title', { ...layers, target: {} })).toBe('site');
    // The site layer cannot supply anything but the title and robots.
    expect(
      source('description', {
        target: {},
        from_default: {},
        site: { description: 'x' } as SeoValues,
      }),
    ).toBe('fallback');
  });
});

describe('prune() and canon()', () => {
  it('drops empty maps, empty lists and blank strings, keeps false and 0', () => {
    expect(
      prune({
        title: '  ',
        description: '',
        canonical: undefined,
        social: { title: '\n\t', image: '' },
        robots: { noindex: false, max_snippet: 0 },
        schema: { props: {}, custom: ' x ' },
        list: [],
      }),
    ).toEqual({
      robots: { noindex: false, max_snippet: 0 },
      schema: { custom: ' x ' },
    });
    expect(prune({})).toEqual({});
  });

  it('canon() is independent of key order and keeps list order', () => {
    const a = { title: 'T', robots: { nofollow: true, noindex: true } };
    const b = { robots: { noindex: true, nofollow: true }, title: 'T' };
    expect(canon(a)).toBe(canon(b));
    expect(canon(a)).toBe(
      '{"robots":{"nofollow":true,"noindex":true},"title":"T"}',
    );
    expect(canon({ a: ['x', 'y'] })).not.toBe(canon({ a: ['y', 'x'] }));
    expect(canon({ title: ' ' })).toBe('{}');
  });

  it('setPath() and getPath()', () => {
    const values = setPath<SeoValues>({}, 'schema.props.headline', 'H');
    expect(values).toEqual({ schema: { props: { headline: 'H' } } });
    expect(getPath(values, 'schema.props.headline')).toBe('H');
    expect(getPath(values, 'schema.props.constructor')).toBeUndefined();
    expect(setPath(values, 'schema.props.headline', undefined)).toEqual({});
    expect(setPath({ title: 'T' }, 'social.image', undefined)).toEqual({
      title: 'T',
    });
  });
});

// Chips.

describe('chips', () => {
  const tokens = {
    title: { label: 'Page title' },
    sep: { label: 'Separator' },
    site: { label: 'Site name' },
    'field.field_hero': { label: 'Image' },
    'field.field_thumb': { label: 'Image' },
    'field.field_odd': { label: 'Sum{mary}' },
  };

  it('round trips', () => {
    for (const stored of [
      '{title} {sep} {site}',
      'Plans {sep} Blog',
      '{field.field_hero} and {field.field_thumb} and {field.field_odd}',
      '{field.gone} {Title} {a b} {} { title }',
    ]) {
      expect(toStored(toDisplay(stored, tokens), tokens)).toBe(stored);
    }
    expect(toDisplay('{title} {sep} Blog', tokens)).toBe(
      '{Page title} {Separator} Blog',
    );
  });

  it('tells colliding labels apart by machine name and removes braces from labels', () => {
    expect(displayLabels(tokens)).toMatchObject({
      'field.field_hero': 'Image (field.field_hero)',
      'field.field_thumb': 'Image (field.field_thumb)',
      'field.field_odd': 'Summary',
      title: 'Page title',
    });
    expect(toDisplay('{field.field_hero}', tokens)).toBe(
      '{Image (field.field_hero)}',
    );
  });

  it('accepts pasted names and leaves unknown brace text alone', () => {
    expect(toStored('{title} by {Site name}', tokens)).toBe(
      '{title} by {site}',
    );
    expect(toStored('{Unknown} {field.gone} {', tokens)).toBe(
      '{Unknown} {field.gone} {',
    );
    expect(toDisplay('{field.gone}', tokens)).toBe('{field.gone}');
  });
});

describe('seedTitle()', () => {
  it('replaces the first {title}, or the whole pattern without one', () => {
    expect(seedTitle('{title} {sep} {site}', 'Plans')).toBe(
      'Plans {sep} {site}',
    );
    expect(seedTitle('{site}: {title} and {title}', 'A')).toBe(
      '{site}: A and {title}',
    );
    expect(seedTitle('{site}', 'Plans')).toBe('Plans');
    expect(seedTitle('{title} {sep} {site}', '$& {x}')).toBe(
      '$& {x} {sep} {site}',
    );
  });

  it('an override equal to the empty seed is removed again (page scope)', () => {
    const typed = run(ready(), edit('title', 'Plans {sep} {site}'));
    expect(typed.edits.target.title).toBe('Plans {sep} {site}');
    const deleted = run(typed, edit('title', ' {sep} {site}'));
    expect(deleted.edits.target).toEqual({});
  });

  it('a template pattern is not seeded and may equal the inherited one', () => {
    const template = {
      kind: 'template',
      id: 'node.article.full',
      bundle: 'article',
      previewId: '11',
    } as const;
    const state = run(
      reducer(initialState(template), {
        type: 'loaded',
        ctx: template,
        payload: payload({ target: target({ scope: 'template' }) }),
        readonly: 'no',
      }),
      edit('title', '{title} {sep} {site}'),
    );
    expect(state.edits.target.title).toBe('{title} {sep} {site}');
    expect(run(state, edit('title', '{sep} {site}')).edits.target.title).toBe(
      '{sep} {site}',
    );
  });
});

// Meters.

describe('measure, truncate and the meter', () => {
  // Every character is 10 px wide.
  const fake: Measurer = (text) => Array.from(text).length * 10;

  it('measure() gives null without a measurer or when it throws', () => {
    expect(measure('abc', '14px sans-serif', fake)).toBe(30);
    expect(measure('abc', '14px sans-serif', null)).toBeNull();
    expect(
      measure('abc', '14px sans-serif', () => {
        throw new Error('no canvas');
      }),
    ).toBeNull();
  });

  it('truncate() cuts at a word boundary with an ellipsis', () => {
    expect(truncate('one two three', 200, 'f', fake)).toBe('one two three');
    // "one two…" is 80 px, "one two three" is 130.
    expect(truncate('one two three', 100, 'f', fake)).toBe('one two…');
    expect(truncate('abcdefghijkl', 50, 'f', fake)).toBe('abcd…');
    expect(truncate('one two three', 100, 'f', null)).toBe('one two three');
  });

  it('dirOf() finds the direction dir="auto" gives', () => {
    // cspell:ignore مرحبا שלום
    expect(dirOf('مرحبا')).toBe('rtl');
    // Digits and punctuation are skipped, as dir="auto" skips them.
    expect(dirOf('2026: שלום')).toBe('rtl');
    expect(dirOf('\u{1E900}')).toBe('rtl');
    expect(dirOf('Hello مرحبا')).toBe('ltr');
    expect(dirOf('')).toBe('ltr');
  });

  it('previewNote(): one "not" in the caption, both in the ⓘ', () => {
    const note = (template: boolean, published: boolean, node = true) =>
      previewNote({ template, published, node, label: 'Event' });
    const estimate =
      'This preview is an estimate; search engines sometimes rewrite titles and descriptions.';
    const node =
      "This event isn't published yet. Values that only editors can see are left out.";
    expect(note(false, true)).toEqual({ suffix: null, unpublished: '', info: estimate });
    expect(note(false, false).suffix).toBe('Not published yet');
    expect(note(true, true)).toEqual({
      suffix: null,
      unpublished: '',
      info: `${estimate} Switch the previewed event with the preview picker in the top bar.`,
    });
    expect(note(true, false).suffix).toBe('Template not in use yet');
    expect(note(true, true, false)).toEqual({
      suffix: 'Not published yet',
      unpublished: node,
      info: `${node} ${estimate}`,
    });
    // An unpublished node under a template not in use: the node's state in
    // the caption, both in the ⓘ.
    expect(note(true, false, false)).toEqual({
      suffix: 'Not published yet',
      unpublished: `${node} The template is not in use yet.`,
      info: `${node} The template is not in use yet. ${estimate}`,
    });
  });

  it('inSentence() keeps an abbreviation', () => {
    expect(inSentence('Event')).toBe('event');
    expect(inSentence('Basic page')).toBe('basic page');
    expect(inSentence('FAQ')).toBe('FAQ');
    expect(inSentence('FAQ page')).toBe('FAQ page');
  });

  it('truncate() never cuts inside a character drawn as one', () => {
    // The family is five code points, 50 px; only one cluster fits.
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    expect(truncate(`ab${family}cd`, 60, 'f', fake)).toBe('ab…');
    expect(truncate(`ab${family}cd`, 85, 'f', fake)).toBe(`ab${family}…`);
  });

  it('truncate() wraps before it cuts when there are more lines', () => {
    // Two lines of 80 px: "one two" / "three…".
    expect(truncate('one two three four', 80, 'f', fake, 2)).toBe(
      'one two three…',
    );
    expect(truncate('one two three', 80, 'f', fake, 2)).toBe('one two three');
  });

  it('meter states', () => {
    expect(meter('title', '', fake)).toMatchObject({
      state: 'empty',
      sentence: '',
    });
    expect(meter('description', '', fake)).toMatchObject({
      state: 'empty',
      sentence: 'Empty · search engines will choose text from the page',
    });
    expect(meter('title', 'Pricing | Example', fake)).toMatchObject({
      state: 'fits',
      chars: 17,
      sentence: '17 characters · fits',
      where: null,
    });
    expect(meter('title', 'a', fake).sentence).toBe('1 character · fits');
    expect(meter('title', 'Pricing | Example', null)).toMatchObject({
      state: 'unmeasured',
      sentence: '17 characters',
    });

    // 60 characters: over one desktop line of 580 px, inside two phone lines of 340.
    const desktop = meter('title', `${'word '.repeat(11)}words`, fake);
    expect(desktop).toMatchObject({
      state: 'long',
      where: 'desktop',
      ratio: 1,
    });
    expect(desktop.sentence).toBe(
      '60 characters · may be cut off on desktop after "…word word word"',
    );

    // 80 characters: over both title limits.
    const both = meter('title', `${'word '.repeat(15)}words`, fake);
    expect(both).toMatchObject({ state: 'long', where: 'both' });
    expect(both.sentence).toMatch(/^80 characters · may be cut off after "…/);

    // 70 characters: over the phone limit of 680 px, inside the desktop one of 920.
    const phones = meter('description', `${'word '.repeat(13)}words`, fake);
    expect(phones).toMatchObject({ state: 'long', where: 'phones' });
    expect(phones.sentence).toContain('may be cut off on phones after');
  });

  it('the preview truncates at the phone limits, or by characters', () => {
    const long = `${'word '.repeat(15)}words`;
    expect(previewText('title', long, fake)).toBe(
      truncate(long, LIMITS.title.phone.px, LIMITS.title.font, fake, 2),
    );
    const cut = previewText('title', long, null);
    expect(cut.endsWith('…')).toBe(true);
    expect(Array.from(cut).length).toBeLessThanOrEqual(LIMITS.title.chars + 1);
    expect(previewText('title', 'Short', null)).toBe('Short');
  });
});

// Reducer.

describe('reducer', () => {
  it('load: the target is selected first, working copies are the server values', () => {
    const state = ready({
      target: target({ values: { title: 'Plans {sep} {site}' } }),
    });
    expect(state).toMatchObject({
      phase: 'ready',
      scope: 'target',
      tab: 'search',
      edits: { target: { title: 'Plans {sep} {site}' }, site: SITE },
      sent: null,
      siteDirty: false,
      readonly: 'no',
    });
    expect(unsent(state)).toBe(false);
  });

  it('load without a target shows Site', () => {
    const none = { kind: 'none', template: false } as const;
    const state = reducer(initialState(none), {
      type: 'loaded',
      ctx: none,
      payload: payload({ target: null }),
      readonly: 'no',
    });
    expect(state).toMatchObject({ scope: 'site', tab: 'identity' });
    expect(run(state, { type: 'scope', scope: 'target' }).scope).toBe('site');
  });

  it('edit: sets a leaf, marks the save pending, clears the error and undo', () => {
    const state = run(
      ready(),
      {
        type: 'errors',
        scope: 'target',
        fields: { canonical: 'Bad.', title: 'Bad.' },
      },
      { type: 'reset', scope: 'target', path: 'title' },
      edit('canonical', '/pricing'),
    );
    expect(state.edits.target).toEqual({ canonical: '/pricing' });
    expect(state.save.target.phase).toBe('pending');
    expect(state.errors.target).toEqual({ title: 'Bad.' });
    expect(state.undo).toBeNull();
    expect(unsent(state)).toBe(true);
  });

  it('edit: undefined, empty and whitespace-only values remove the override', () => {
    const set = run(ready(), edit('social.title', 'Hello'));
    for (const value of [undefined, '', '  \n']) {
      expect(run(set, edit('social.title', value)).edits.target).toEqual({});
    }
    // A trailing space is what the user typed.
    expect(run(set, edit('social.title', 'Hello ')).edits.target).toEqual({
      social: { title: 'Hello ' },
    });
  });

  it('inherit-equal rule: a toggle switched off and on again stores nothing', () => {
    const on = run(ready(), edit('robots.noindex', true));
    expect(on.edits.target).toEqual({ robots: { noindex: true } });
    expect(run(on, edit('robots.noindex', false)).edits.target).toEqual({});
  });

  it('inherit-equal rule: selects follow the site layer, then the constants', () => {
    const state = ready();
    // The site says large.
    expect(inherited(state.server!, 'target', 'robots.max_image_preview')).toBe(
      'large',
    );
    expect(
      run(state, edit('robots.max_image_preview', 'large')).edits.target,
    ).toEqual({});
    expect(
      run(state, edit('robots.max_image_preview', 'standard')).edits.target,
    ).toEqual({ robots: { max_image_preview: 'standard' } });
    // Absent everywhere: the search engines' own defaults.
    expect(run(state, edit('robots.max_snippet', -1)).edits.target).toEqual({});
    expect(run(state, edit('robots.max_snippet', 0)).edits.target).toEqual({
      robots: { max_snippet: 0 },
    });
    expect(run(state, edit('schema.type', 'WebPage')).edits.target).toEqual({});
    expect(run(state, edit('schema.type', 'Article')).edits.target).toEqual({
      schema: { type: 'Article' },
    });
  });

  it('inherit-equal rule: false overrides an inherited true, and the default-language version is a source', () => {
    const state = ready({
      langcode: 'fi',
      languages: { en: 'English', fi: 'Finnish' },
      target: target({
        auto_save_key: 'canvas_page:8:fi',
        from_default: {
          robots: { noindex: true },
          social: { image: 'aaaaaaaa-0000-4000-8000-000000000000' },
          schema: { type: 'Article' },
        },
      }),
    });
    expect(run(state, edit('robots.noindex', true)).edits.target).toEqual({});
    expect(run(state, edit('robots.noindex', false)).edits.target).toEqual({
      robots: { noindex: false },
    });
    expect(run(state, edit('schema.type', 'Article')).edits.target).toEqual({});
    expect(run(state, edit('schema.type', 'WebPage')).edits.target).toEqual({
      schema: { type: 'WebPage' },
    });
    expect(
      run(state, edit('social.image', 'aaaaaaaa-0000-4000-8000-000000000000'))
        .edits.target,
    ).toEqual({});
    expect(view(state)!.source('robots.noindex')).toBe('default');
    expect(view(state)!.hidden).toBe(true);
  });

  it('inherit-equal rule at Site scope: nothing below but the constants', () => {
    const state = run(
      ready(),
      edit('values.robots.max_image_preview', 'standard', 'site'),
    );
    expect(state.edits.site.values).toEqual({ title: '{title} {sep} {site}' });
    expect(state.siteDirty).toBe(true);
    const back = run(
      state,
      edit('values.robots.max_image_preview', 'large', 'site'),
    );
    expect(back.edits.site).toEqual(SITE);
    expect(back.siteDirty).toBe(false);
    // Identity keys are never removed.
    const named = run(
      ready(),
      edit('identity.name', 'Example Inc', 'site'),
      edit('identity.name', '', 'site'),
    );
    expect(named.edits.site.identity.name).toBe('');
    expect(named.siteDirty).toBe(false);
  });

  it('reset and undo', () => {
    const set = run(
      ready(),
      edit('schema.custom', '{"@type":"Thing"}'),
      edit('title', 'T'),
    );
    const reset = run(set, {
      type: 'reset',
      scope: 'target',
      path: 'schema.custom',
    });
    expect(reset.edits.target).toEqual({ title: 'T' });
    expect(reset.undo).toMatchObject({ text: 'Reset', path: 'schema.custom' });
    const undone = run(reset, { type: 'undo' });
    expect(undone.edits.target).toEqual(set.edits.target);
    expect(undone.undo).toBeNull();
    // Undo is cleared by the next edit and by a scope change.
    expect(run(reset, edit('title', 'U')).undo).toBeNull();
    expect(run(reset, { type: 'scope', scope: 'site' }).undo).toBeNull();
  });

  it('Site discard keeps the working copy for Undo', () => {
    const dirty = run(
      ready(),
      { type: 'scope', scope: 'site' },
      edit('identity.name', 'Example Inc', 'site'),
    );
    const discarded = run(dirty, { type: 'discard' });
    expect(discarded).toMatchObject({
      siteDirty: false,
      edits: { site: SITE },
    });
    expect(footer(discarded)).toEqual({
      dot: 'gray',
      text: 'Discarded',
      actions: ['undo'],
    });
    const undone = run(discarded, { type: 'undo' });
    expect(undone.edits.site.identity.name).toBe('Example Inc');
    expect(undone.siteDirty).toBe(true);
  });

  it('apply: a fix edits the working copy exactly as typing would', () => {
    const hidden = run(ready(), edit('robots.noindex', true));
    const fixed = run(hidden, {
      type: 'apply',
      scope: 'target',
      values: { ...hidden.edits.target, robots: { noindex: false } },
    });
    expect(fixed.edits.target).toEqual({});
    expect(fixed.save.target.phase).toBe('pending');
    const restored = run(ready(), {
      type: 'apply',
      scope: 'target',
      values: { title: 'T' },
      undo: MESSAGES.restored,
    });
    expect(restored.undo).toMatchObject({
      text: MESSAGES.restored,
      edits: { target: {} },
    });
    expect(
      footer({
        ...restored,
        save: { ...restored.save, target: { phase: 'idle' } },
      }),
    ).toMatchObject({
      text: "Restored a change that hadn't been saved",
      actions: ['undo'],
    });
  });

  it('context change: the target copy goes, unsaved site edits and the tab stay', () => {
    const state = run(
      ready(),
      { type: 'tab', tab: 'social' },
      edit('title', 'T'),
      edit('identity.name', 'Example Inc', 'site'),
      { type: 'errors', scope: 'target', fields: { title: 'Bad.' } },
    );
    const next = { kind: 'page', id: '9' } as const;
    const loading = run(state, { type: 'loading', ctx: next });
    expect(loading).toMatchObject({
      phase: 'loading',
      ctx: next,
      edits: { target: {} },
      errors: { target: {} },
      siteDirty: true,
    });
    const loaded = run(loading, {
      type: 'loaded',
      ctx: next,
      payload: payload({
        target: target({
          id: '9',
          label: 'About us',
          values: { title: 'About' },
        }),
        site: {
          ...SITE,
          identity: { ...SITE.identity, name: 'Changed elsewhere' },
        },
      }),
      readonly: 'no',
      flash: 'Now editing: About us',
    });
    expect(loaded).toMatchObject({
      phase: 'ready',
      scope: 'target',
      tab: 'social',
      edits: { target: { title: 'About' } },
      flash: 'Now editing: About us',
    });
    expect(loaded.edits.site.identity.name).toBe('Example Inc');
    expect(footer(loaded)).toMatchObject({
      dot: 'info',
      text: 'Now editing: About us',
    });
  });

  it('each scope remembers its tab', () => {
    const state = run(
      ready(),
      { type: 'tab', tab: 'checks' },
      { type: 'tab', tab: 'defaults' },
      { type: 'scope', scope: 'site' },
      { type: 'tab', tab: 'defaults' },
      { type: 'scope', scope: 'target' },
    );
    expect(state.tab).toBe('checks');
    expect(run(state, { type: 'scope', scope: 'site' }).tab).toBe('defaults');
  });

  it('an editor round trip replaces the inputs only when nothing is unsent', () => {
    const fresh = payload({
      target: target({ values: { title: 'Published' }, has_draft: false }),
    });
    const clean = run(ready(), {
      type: 'refreshed',
      payload: fresh,
      readonly: 'no',
    });
    expect(clean.edits.target).toEqual({ title: 'Published' });

    const typing = run(ready(), edit('title', 'Mine'), {
      type: 'refreshed',
      payload: fresh,
      readonly: 'no',
    });
    expect(typing.edits.target).toEqual({ title: 'Mine' });
    expect(typing.server).toBe(fresh);

    // Confirmed, then discarded in "Review changes": the fields return to the published values.
    const confirmed = run(ready(), edit('title', 'Mine'), {
      type: 'confirmed',
      payload: payload({ target: target({ values: { title: 'Mine' } }) }),
      sent: canon({ title: 'Mine' }),
    });
    expect(
      run(confirmed, { type: 'refreshed', payload: fresh, readonly: 'no' })
        .edits.target,
    ).toEqual({
      title: 'Published',
    });

    // A refused field keeps what was typed.
    const refused = run(confirmed, {
      type: 'errors',
      scope: 'target',
      fields: { title: 'Bad.' },
    });
    expect(
      run(refused, { type: 'refreshed', payload: fresh, readonly: 'no' }).edits
        .target,
    ).toEqual({
      title: 'Mine',
    });
  });

  it('a conflict stays until the editor is reloaded', () => {
    const state = run(
      ready(),
      { type: 'readonly', readonly: 'conflict' },
      {
        type: 'refreshed',
        payload: payload(),
        readonly: 'no',
      },
    );
    expect(state.readonly).toBe('conflict');
  });
});

// Derived values.

describe('view()', () => {
  it("lays Canvas's live title and description over the tokens", () => {
    const state = run(ready(), {
      type: 'live',
      live: { title: 'Prices', description: 'New.' },
    });
    expect(view(state)!.texts).toEqual({
      title: 'Prices | Example',
      description: 'New.',
      social_title: 'Prices',
      social_description: 'New.',
    });
  });

  it("the server's text wins once nothing is unsent", () => {
    const resolved: Resolved = {
      head: {
        title: 'Pricing – Example (server)',
        meta: [
          { name: 'description', content: 'Plans.' },
          { name: 'robots', content: 'noindex, max-image-preview:large' },
          { property: 'og:title', content: 'Pricing' },
          { property: 'og:description', content: 'Plans.' },
        ],
        link: [],
        script: [],
      },
      image: null,
      schema: {
        withheld: false,
        missing_required: [],
        missing_recommended: [],
      },
    };
    const state = ready({ resolved });
    const shown = view(state)!;
    expect(shown.texts.title).toBe('Pricing – Example (server)');
    // noindex that only the server's output has: a configuration override.
    expect(shown).toMatchObject({ hidden: true, hiddenBy: 'config' });
    expect(strips(state, shown, false)).toMatchObject([
      {
        id: 'hidden',
        text: 'Hidden from search engines · set in site configuration outside SEO',
        actions: [],
      },
    ]);
    // While typing, the client's own text.
    expect(view(run(state, edit('title', 'Mine')))!.texts.title).toBe('Mine');
  });
});

// The write procedure.

const TOKEN: EditorToken = {
  clientInstanceId: 'client-1',
  autoSaves: {
    'canvas_page:8:en': { autoSaveStartingPoint: '8-1', hash: null },
  },
  langcode: 'en',
};

/** A dialog state and a server draft, wired to saveDraft() the way App.tsx wires them. */
function harness(stored: SeoValues = {}) {
  const sim = {
    state: ready({ target: target({ values: stored }) }),
    draft: stored,
    puts: [] as SeoValues[],
    token: TOKEN as EditorToken | null,
    /** Runs between our PUT and the read-back: an editor save, a newer edit. */
    afterPut: (_attempt: number) => {},
    refuse: (_values: SeoValues): Record<string, string> | null => null,
    dispatch(action: Action) {
      sim.state = reducer(sim.state, action);
    },
    io: {} as DraftIO,
  };
  sim.io = {
    edits: () => sim.state.edits.target,
    server: () => sim.state.server!.target!.values,
    refused: () => Object.keys(sim.state.errors.target),
    whenIdle: async () => {},
    token: () => sim.token,
    put: async (values) => {
      sim.puts.push(values);
      const fields = sim.refuse(values);
      if (fields) {
        throw new ApiError('invalid', 'Some values need attention.', fields);
      }
      sim.draft = values;
      return { values };
    },
    quiet: async () => sim.afterPut(sim.puts.length),
    getState: async () =>
      payload({ target: target({ values: sim.draft, has_draft: true }) }),
    refuse: (fields) =>
      sim.dispatch({ type: 'errors', scope: 'target', fields }),
    confirmed: (state, sent) =>
      sim.dispatch({ type: 'confirmed', payload: state, sent }),
  };
  return sim;
}

describe('saveDraft()', () => {
  it('confirmed: one write, the server truth is replaced, the inputs are not', async () => {
    const sim = harness();
    // A trailing space is the user's text and stays the user's text.
    sim.dispatch(edit('title', 'Plans {sep} {site} '));
    const before = sim.state.edits;
    expect(await saveDraft(sim.io)).toBe('done');
    expect(sim.puts).toEqual([{ title: 'Plans {sep} {site} ' }]);
    expect(sim.state.edits).toBe(before);
    expect(sim.state.server!.target).toMatchObject({
      has_draft: true,
      values: { title: 'Plans {sep} {site} ' },
    });
    expect(sim.state.sent).toBe(canon({ title: 'Plans {sep} {site} ' }));
    expect(unsent(sim.state)).toBe(false);
  });

  it('confirmation leaves the inputs alone when the server stores a value differently', async () => {
    const sim = harness();
    sim.dispatch(edit('schema.custom', '{ "@type": "Thing" }'));
    const put = sim.io.put;
    // The server re-encodes custom JSON.
    sim.io.put = async (values, token) => {
      await put(values, token);
      sim.draft = { schema: { custom: '{"@type":"Thing"}' } };
      return { values: sim.draft };
    };
    expect(await saveDraft(sim.io)).toBe('done');
    expect(sim.puts).toHaveLength(1);
    expect(sim.state.edits.target.schema!.custom).toBe('{ "@type": "Thing" }');
    expect(sim.state.server!.target!.values.schema!.custom).toBe(
      '{"@type":"Thing"}',
    );
    // Saves are triggered by edits, not by a difference.
    expect(unsent(sim.state)).toBe(false);
  });

  it('overwritten by an editor save: written again', async () => {
    const sim = harness();
    sim.dispatch(edit('title', 'Mine'));
    sim.afterPut = (attempt) => {
      if (attempt === 1) {
        sim.draft = {};
      }
    };
    expect(await saveDraft(sim.io)).toBe('done');
    expect(sim.puts).toEqual([{ title: 'Mine' }, { title: 'Mine' }]);
    expect(sim.draft).toEqual({ title: 'Mine' });
  });

  it('newer edits that arrive while saving go out in the same call', async () => {
    const sim = harness();
    sim.dispatch(edit('title', 'One'));
    sim.afterPut = (attempt) => {
      if (attempt === 1) {
        sim.dispatch(edit('title', 'One two'));
      }
    };
    expect(await saveDraft(sim.io)).toBe('done');
    expect(sim.puts).toEqual([{ title: 'One' }, { title: 'One two' }]);
    expect(sim.state.sent).toBe(canon({ title: 'One two' }));
  });

  it('five overwritten writes: the change could not be stored', async () => {
    const sim = harness();
    sim.dispatch(edit('title', 'Mine'));
    sim.afterPut = () => {
      sim.draft = {};
    };
    expect(await saveDraft(sim.io)).toBe('failed');
    expect(sim.puts).toHaveLength(5);
    expect(sim.state.edits.target).toEqual({ title: 'Mine' });
    expect(sim.state.sent).toBeNull();
  });

  it('a refused field never deletes a saved one', async () => {
    const sim = harness({ canonical: '/pricing', title: 'Saved' });
    sim.dispatch(edit('canonical', 'not an address'));
    sim.dispatch(edit('social.title', 'New'));
    sim.refuse = (values) =>
      values.canonical === 'not an address'
        ? { canonical: 'Enter a full address.' }
        : null;
    expect(await saveDraft(sim.io)).toBe('done');
    // The refusal is not counted; the second write carries the stored value.
    expect(sim.puts).toEqual([
      { canonical: 'not an address', social: { title: 'New' }, title: 'Saved' },
      { canonical: '/pricing', social: { title: 'New' }, title: 'Saved' },
    ]);
    expect(sim.draft.canonical).toBe('/pricing');
    // The field keeps what was typed and shows the server's sentence.
    expect(sim.state.edits.target.canonical).toBe('not an address');
    expect(sim.state.errors.target).toEqual({
      canonical: 'Enter a full address.',
    });
    expect(
      footer({
        ...sim.state,
        save: { ...sim.state.save, target: { phase: 'idle' } },
      }),
    ).toMatchObject({
      text: '1 field needs attention · other changes saved',
      actions: ['goto'],
    });
  });

  it('a refused path without a stored value is left out, and the same refusal twice stops', async () => {
    expect(
      draftPayload({ canonical: 'x', title: 'T' }, {}, ['canonical']),
    ).toEqual({ title: 'T' });
    const sim = harness();
    sim.dispatch(edit('title', 'T'));
    sim.refuse = () => ({ title: 'Never good.' });
    const result = await saveDraft(sim.io);
    expect(result).toBeInstanceOf(ApiError);
    expect((result as ApiError).code).toBe('invalid');
    expect(sim.puts).toEqual([{ title: 'T' }, {}]);
  });

  it('editing a refused field sends it again', async () => {
    const sim = harness();
    sim.dispatch(edit('canonical', 'bad'));
    sim.refuse = (values) =>
      values.canonical === 'bad' ? { canonical: 'Bad.' } : null;
    await saveDraft(sim.io);
    sim.dispatch(edit('canonical', '/good'));
    expect(sim.state.errors.target).toEqual({});
    expect(await saveDraft(sim.io)).toBe('done');
    expect(sim.draft).toEqual({ canonical: '/good' });
  });

  it('no editor token: nothing is written', async () => {
    const sim = harness();
    sim.dispatch(edit('title', 'T'));
    sim.token = null;
    expect(await saveDraft(sim.io)).toBe('readonly');
    expect(sim.puts).toEqual([]);
  });

  it('a conflict or a network failure stops with the error', async () => {
    const sim = harness();
    sim.dispatch(edit('title', 'T'));
    sim.io.put = async () => {
      throw new ApiError(
        'conflict',
        'The editor does not hold the latest draft.',
      );
    };
    expect(await saveDraft(sim.io)).toMatchObject({ code: 'conflict' });
    sim.io.put = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await saveDraft(sim.io)).toMatchObject({ code: 'network' });
  });
});

// The pending rule.

describe('pending changes', () => {
  const server = { title: 'Saved', robots: { noindex: true } };

  it('diff() and applyChanges() are inverses over leaves', () => {
    const edits = { title: 'Mine', social: { image: 'uuid' } };
    const changes = diff(server, edits);
    expect(changes).toEqual({
      title: 'Mine',
      'robots.noindex': null,
      'social.image': 'uuid',
    });
    expect(prune(applyChanges(server, changes))).toEqual(edits);
    expect(
      diff(
        { identity: { name: '', same_as: [] } },
        { identity: { name: '', same_as: ['https://example.com/a'] } },
      ),
    ).toEqual({
      'identity.same_as': ['https://example.com/a'],
    });
  });

  it('mirrors every edit against the values it was first made against', () => {
    const first = pendingFor(null, '1', server, { ...server, title: 'Mine' })!;
    expect(first).toEqual({
      uid: '1',
      base: canon(server),
      changes: { title: 'Mine' },
    });
    // The base and the user stay those of the first change.
    const second = pendingFor(
      first,
      '2',
      { title: 'Other' },
      { ...server, title: 'Mine too' },
    )!;
    expect(second).toEqual({
      uid: '1',
      base: canon(server),
      changes: { title: 'Mine too' },
    });
    // Back to the base: nothing to keep.
    expect(pendingFor(second, '1', server, server)).toBeNull();
    // After a confirmed write only the refused paths remain.
    expect(
      pendingFor(
        null,
        '1',
        { title: 'Mine' },
        { title: 'Mine', canonical: 'bad' },
        ['canonical'],
      ),
    ).toEqual({
      uid: '1',
      base: canon({ title: 'Mine' }),
      changes: { canonical: 'bad' },
    });
    expect(pendingFor(null, null, server, { title: 'x' })!.uid).toBe('');
  });

  it('readPending() refuses what is not an entry', () => {
    const entry = { uid: '1', base: canon(server), changes: { title: 'Mine' } };
    expect(readPending(JSON.stringify(entry))).toEqual(entry);
    for (const raw of [
      null,
      '',
      'nope',
      '{}',
      '{"uid":1,"base":"{}","changes":{}}',
      '{"uid":"1","base":"x","changes":{}}',
      '{"uid":"1","base":"{}","changes":[]}',
    ]) {
      expect(readPending(raw)).toBeNull();
    }
  });

  const entry = { uid: '1', base: canon(server), changes: { title: 'Mine' } };

  it('a change the server already has is dropped silently', () => {
    expect(openPending(entry, '1', { ...server, title: 'Mine' })).toBe('drop');
    expect(
      openPending(
        { ...entry, changes: { 'robots.nofollow': null } },
        '2',
        server,
      ),
    ).toBe('drop');
  });

  it('same user and same base: restored', () => {
    expect(
      openPending(entry, '1', { robots: { noindex: true }, title: 'Saved' }),
    ).toBe('restore');
  });

  it('changed base: offered', () => {
    expect(openPending(entry, '1', { title: 'Published since' })).toBe('offer');
  });

  it('another user, or an unreadable one: offered', () => {
    expect(openPending(entry, '2', server)).toBe('offer');
    expect(openPending(entry, null, server)).toBe('offer');
    expect(openPending({ ...entry, uid: '' }, null, server)).toBe('offer');
  });

  it('the offer names its fields and takes the second strip', () => {
    const state = run(
      ready(),
      { type: 'readonly', readonly: 'conflict' },
      {
        type: 'offer',
        offer: {
          scope: 'target',
          pending: {
            ...entry,
            changes: {
              title: 'Mine',
              'social.image': 'uuid',
              'robots.noindex': true,
              'robots.nofollow': true,
            },
          },
        },
      },
    );
    expect(strips(state, view(state), false)).toMatchObject([
      {
        id: 'conflict',
        role: 'alert',
        text: 'This page was changed somewhere else. What you typed is kept.',
        actions: ['reload'],
      },
      {
        id: 'offer',
        role: 'status',
        text: "An earlier change wasn't saved: Title, Image, Search visibility",
        actions: ['drop', 'use'],
      },
    ]);
    expect(
      fieldNames(['identity.same_as', 'values.title', 'schema.props.name']),
    ).toEqual(['Profiles elsewhere', 'Title pattern', 'Structured data']);
  });
});

// What the shell says.

describe('footer and strips', () => {
  const at = (state: State) => footer(state);

  it('target: published, unpublished, draft, translation draft', () => {
    expect(at(ready())).toEqual({
      dot: 'gray',
      text: 'Matches the published page',
      actions: ['output'],
    });
    expect(at(ready({ target: target({ published: false }) })).text).toBe(
      "Not published yet · search engines can't see this page",
    );
    expect(
      at(ready({ target: target({ scope: 'template', published: false }) }))
        .text,
    ).toBe('Template not published yet · not in use');
    expect(at(ready({ target: target({ scope: 'template' }) })).text).toBe(
      'Matches the published template',
    );
    expect(at(ready({ target: target({ has_draft: true }) }))).toEqual({
      dot: 'blue',
      text: 'Draft · goes live when you publish the page',
      actions: ['output'],
    });
    expect(
      at(
        ready({
          langcode: 'fi',
          languages: { en: 'English', fi: 'Finnish' },
          target: target({ has_draft: true }),
        }),
      ).text,
    ).toBe('Draft of the Finnish version · goes live with the English version');
  });

  it('target: saving, saved, failed, read-only', () => {
    const editing = run(ready(), edit('title', 'T'));
    expect(at(editing)).toEqual({
      dot: 'spinner',
      text: 'Saving…',
      actions: [],
    });
    const save = (phase: 'saved' | 'error', message?: string) =>
      run(editing, { type: 'save', scope: 'target', save: { phase, message } });
    expect(at(save('saved'))).toEqual({
      dot: 'ok',
      text: 'Saved to draft',
      actions: [],
    });
    expect(at(save('error', MESSAGES.failed))).toEqual({
      dot: 'error',
      text: "Couldn't save · your changes are kept here",
      actions: ['retry'],
    });
    expect(at(run(ready(), { type: 'readonly', readonly: 'store' }))).toEqual({
      dot: 'gray',
      text: 'Read-only',
      actions: ['output'],
    });
    // A template with nothing to preview has no output to show.
    expect(at(run(ready(), { type: 'readonly', readonly: 'empty' }))).toEqual({
      dot: 'gray',
      text: 'Read-only',
      actions: [],
    });
  });

  it('site: clean, unsaved, hiding the site, saved', () => {
    const site = run(ready(), { type: 'scope', scope: 'site' });
    expect(at(site)).toEqual({
      dot: 'gray',
      text: 'Live site settings',
      actions: [],
    });
    const dirty = run(site, edit('identity.name', 'Example Inc', 'site'));
    expect(at(dirty)).toEqual({
      dot: 'blue',
      text: 'Unsaved changes · not live yet',
      actions: ['discard', 'save'],
    });
    expect(at(run(dirty, edit('values.robots.noindex', true, 'site')))).toEqual(
      {
        dot: 'warn',
        text: 'This asks search engines to drop every page.',
        actions: ['discard', 'hide'],
      },
    );
    const saved = run(dirty, {
      type: 'siteSaved',
      payload: payload({ site: dirty.edits.site }),
      sent: canon(dirty.edits.site),
    });
    expect(saved.siteDirty).toBe(false);
    expect(at(saved)).toEqual({
      dot: 'ok',
      text: 'Saved · live now',
      actions: [],
    });
    // A site save in flight does not show at the target scope.
    const saving = run(dirty, {
      type: 'save',
      scope: 'site',
      save: { phase: 'saving' },
    });
    expect(at(saving).text).toBe('Saving…');
    expect(at(run(saving, { type: 'scope', scope: 'target' })).text).toBe(
      'Matches the published page',
    );
  });

  it("strips: can't save, with the language sentence; hidden with Undo only when set here", () => {
    const blocked = run(ready(), { type: 'readonly', readonly: 'store' });
    expect(strips(blocked, view(blocked), true)[0].text).toBe(
      "SEO can't save to this page right now. Site settings still work. The editor and the server disagree about the language being edited.",
    );
    const hidden = run(ready(), edit('robots.noindex', true));
    expect(strips(hidden, view(hidden), false)).toMatchObject([
      {
        id: 'hidden',
        text: 'Hidden from search engines · set on this page',
        actions: ['show'],
      },
    ]);
    const bySite = ready({
      site: { ...SITE, values: { robots: { noindex: true } } },
    });
    expect(strips(bySite, view(bySite), false)).toMatchObject([
      {
        id: 'hidden',
        text: 'Hidden from search engines · set for the whole site',
        actions: [],
      },
    ]);
    // Never more than two; the hidden strip yields only to the two read-only states.
    const both = run(hidden, { type: 'readonly', readonly: 'conflict' });
    expect(strips(both, view(both), false).map((strip) => strip.id)).toEqual([
      'conflict',
      'hidden',
    ]);
    // None at Site scope.
    expect(
      strips(
        run(hidden, { type: 'scope', scope: 'site' }),
        view(hidden),
        false,
      ),
    ).toEqual([]);
  });

  it('tabs and paths', () => {
    expect(tabOf('target', 'robots.noindex')).toBe('search');
    expect(tabOf('target', 'social.image')).toBe('social');
    expect(tabOf('target', 'schema.props.name')).toBe('schema');
    expect(tabOf('site', 'identity.same_as.2')).toBe('identity');
    expect(tabOf('site', 'identity.separator')).toBe('defaults');
    expect(tabOf('site', 'values.title')).toBe('defaults');
    expect(
      sitePaths({
        title: 'a',
        'identity.name': 'b',
        'robots.max_snippet': 'c',
      }),
    ).toEqual({
      'values.title': 'a',
      'identity.name': 'b',
      'values.robots.max_snippet': 'c',
    });
  });

  it('the registry resolves extends', () => {
    expect(REGISTRY.BlogPosting).toMatchObject({
      label: 'Blog post',
      group: 'Article',
      primary_type: 'BlogPosting',
      og_type: 'article',
    });
    expect(REGISTRY.BlogPosting.props).toBe(REGISTRY.Article.props);
    expect(REGISTRY.WebPage.props).toBeUndefined();
  });
});

// What the components lean on.

describe('chips in the editor', () => {
  const tokens = payload().tokens;
  const text = 'Plans {Separator} {Site name}';

  it('a chip is brace text that names a known value by its label', () => {
    expect(chipsIn(`${text} {nope} {sep}`, tokens)).toEqual([
      { start: 6, end: 17, name: 'sep', label: 'Separator' },
      { start: 18, end: 29, name: 'site', label: 'Site name' },
    ]);
  });

  it('Backspace and Delete next to or inside a chip remove the whole chip', () => {
    const chips = chipsIn(text, tokens);
    // Right behind the chip, and inside it.
    for (const caret of [17, 10]) {
      expect(removeChip(text, chips, caret, 'Backspace')).toEqual({
        text: 'Plans {Site name}',
        caret: 5,
        label: 'Separator',
      });
    }
    expect(removeChip(text, chips, 6, 'Delete')?.label).toBe('Separator');
    // Right in front of a chip Backspace is an ordinary key, as is Delete behind one.
    expect(removeChip(text, chips, 6, 'Backspace')).toBeNull();
    expect(removeChip(text, chips, 17, 'Delete')).toBeNull();
    expect(removeChip(text, chips, 3, 'Backspace')).toBeNull();
    // The last chip leaves the space before it, so a word typed next does not
    // run into the chip in front of it.
    expect(removeChip(text, chips, 29, 'Backspace')).toEqual({
      text: 'Plans {Separator} ',
      caret: 18,
      label: 'Site name',
    });
  });

  it('a selection never ends inside a chip; a caret stays where it is', () => {
    const chips = chipsIn(text, tokens);
    expect(wholeChips(chips, 2, 9)).toEqual([2, 17]);
    expect(wholeChips(chips, 9, 20)).toEqual([6, 29]);
    expect(wholeChips(chips, 9, 9)).toEqual([9, 9]);
    expect(wholeChips(chips, 0, 6)).toEqual([0, 6]);
  });

  it('a chip from the button is set off by spaces and never lands inside another', () => {
    const chips = chipsIn(text, tokens);
    expect(insertChip(text, chips, 5, 'Page title', false)).toEqual({
      text: 'Plans {Page title} {Separator} {Site name}',
      caret: 18,
    });
    expect(insertChip(text, chips, 9, 'Page title', false).text).toBe(
      'Plans {Separator} {Page title} {Site name}',
    );
    expect(insertChip('', [], 0, 'Page title', false)).toEqual({
      text: '{Page title}',
      caret: 12,
    });
  });

  it('a chip from a typed brace replaces the brace', () => {
    const typed = 'Plans by { {Separator} {Site name}';
    expect(
      insertChip(typed, chipsIn(typed, tokens), 10, 'Page title', true),
    ).toEqual({
      text: 'Plans by {Page title} {Separator} {Site name}',
      caret: 21,
    });
  });

  it('the caret of a seeded title stays behind what was typed', () => {
    expect(seedCaret('{title} {sep} {site}', 'P', tokens)).toBe(1);
    expect(seedCaret('{site} {sep} {title}', 'Pr', tokens)).toBe(
      '{Site name} {Separator} '.length + 2,
    );
    expect(seedCaret('{site}', 'Pr', tokens)).toBe(2);
  });

  it('the insert menu groups values and leaves images out', () => {
    const all = {
      ...tokens,
      image: { label: 'Page image', type: 'image' as const, value: '' },
      'field.field_byline': {
        label: 'Byline',
        type: 'text' as const,
        value: 'Ada',
      },
    };
    expect(tokenGroups(all, true)).toEqual([
      { label: 'PAGE', names: ['title', 'description'] },
      { label: 'SITE', names: ['site', 'sep'] },
      { label: 'FIELDS', names: ['field.field_byline'] },
    ]);
    expect(tokenGroups(all, false).map((group) => group.label)).toEqual([
      'PAGE',
      'SITE',
    ]);
  });
});

describe('what previews and rows say', () => {
  it('an address reads as a breadcrumb', () => {
    expect(breadcrumb('https://www.example.com/blog/hello%20world')).toBe(
      'www.example.com › blog › hello world',
    );
    expect(breadcrumb('https://www.example.com/')).toBe('www.example.com');
    expect(breadcrumb('not an address')).toBe('not an address');
  });

  it('a date reads in words, at the time as written', () => {
    expect(dateText('2026-03-02T09:00:00+02:00')).toBe('2 March 2026, 09:00');
    expect(dateText('2027-03-04')).toBe('4 March 2027');
    expect(dateText('soon')).toBe('soon');
  });

  it('a type label takes "a" or "an"', () => {
    expect(article('Event')).toBe('an');
    expect(article('Product')).toBe('a');
  });

  const image = {
    url: 'https://cms.example.com/hero.jpg',
    width: 1200,
    height: 630,
    alt: '',
    bytes: 1,
    mime: 'image/jpeg',
    name: 'Hero',
    thumb: '/hero-thumb.jpg',
  };
  const withImage = (over: Partial<StatePayload> = {}) =>
    ready({
      tokens: {
        ...payload().tokens,
        image: { label: 'Page image', type: 'image', value: '', image },
        'field.field_hero': {
          label: 'Hero image',
          type: 'image',
          value: '',
          image: { ...image, name: 'Field hero' },
        },
      },
      ...over,
    });
  const shown = (state: State) => socialImage(state, view(state)!, {});

  it('the social image names where it comes from', () => {
    expect(shown(withImage())).toEqual({ image, from: 'From the page image' });
    expect(
      shown(run(withImage(), edit('social.image', '{field.field_hero}'))),
    ).toMatchObject({ image: { name: 'Field hero' }, from: 'From Hero image' });
    expect(shown(ready())).toEqual({ image: null, from: 'No image' });
    expect(
      shown(
        ready({
          site: {
            ...SITE,
            identity: { ...SITE.identity, default_image: 'uuid-site' },
          },
          media: {
            'uuid-site': { name: 'Card', thumb: '/c.jpg', width: 1, height: 1, bytes: 1 },
          },
        }),
      ),
    ).toMatchObject({ image: { name: 'Card' }, from: 'Site default' });
  });

  it('an image chosen here shows before the server knows it', () => {
    const state = run(withImage(), edit('social.image', 'uuid-new'));
    const picked = { name: 'New', thumb: '/n.jpg', width: 800, height: 400 };
    expect(socialImage(state, view(state)!, { 'uuid-new': picked })).toEqual({
      image: picked,
      from: 'Chosen here',
    });
    // Once the write is confirmed the server's own facts take over.
    const resolved = {
      head: { title: '', meta: [], link: [], script: [] },
      image: { ...image, name: 'New', source: 'override' as const },
      schema: {
        withheld: false,
        missing_required: [],
        missing_recommended: [],
      },
    };
    const confirmed = reducer(state, {
      type: 'confirmed',
      payload: payload({
        target: target({ values: { social: { image: 'uuid-new' } } }),
        resolved,
      }),
      sent: canon(state.edits.target),
    });
    expect(
      socialImage(confirmed, view(confirmed)!, { 'uuid-new': picked }).image,
    ).toBe(resolved.image);
  });

  it('an image inherited from the default-language version says so', () => {
    const state = ready({
      langcode: 'fi',
      languages: { en: 'English', fi: 'Finnish' },
      target: target({ from_default: { social: { image: 'uuid-en' } } }),
    });
    expect(shown(state).from).toBe('From the English version');
  });

  it('Site "Becomes" uses the working copy of the name and the separator', () => {
    const state = run(
      ready(),
      edit('identity.separator', '·', 'site'),
      edit('identity.name', 'Example Co', 'site'),
    );
    expect(siteTexts(state, view(state)!).title).toBe('Pricing · Example Co');
  });

  it('a reset that takes several values keeps one undo, on its field', () => {
    const state = run(
      ready(),
      edit('schema.type', 'Event'),
      edit('schema.props.name', 'Launch'),
    );
    const reset = reducer(state, {
      type: 'apply',
      scope: 'target',
      values: {},
      undo: 'Reset',
      path: 'schema.type',
    });
    expect(reset.edits.target).toEqual({});
    expect(reset.undo).toMatchObject({ text: 'Reset', path: 'schema.type' });
    expect(reducer(reset, { type: 'undo' }).edits.target).toEqual(
      state.edits.target,
    );
  });

  it('a chosen image the server cannot show says so, and shows what is used', () => {
    // Stored and confirmed, but the output falls back to the page image.
    const resolved = {
      head: { title: '', meta: [], link: [], script: [] },
      image: { ...image, source: 'entity' as const },
      schema: { withheld: false, missing_required: [], missing_recommended: [] },
    };
    const state = withImage({
      target: target({ values: { social: { image: 'uuid-private' } } }),
      media: {},
      resolved,
    });
    expect(shown(state)).toEqual({
      image: resolved.image,
      from: "The chosen image can't be shown publicly · using the page image",
    });
  });

  it('Site "Becomes" trims the separator, as the server stores it', () => {
    const state = run(
      ready(),
      edit('identity.separator', ' / ', 'site'),
      edit('identity.name', '', 'site'),
    );
    expect(siteTexts(state, view(state)!).title).toBe('Pricing / Example');
  });
});

describe('fixes from the reviews', () => {
  it('a translation stores the details of its inherited type without a type', () => {
    const state = run(
      ready({
        langcode: 'fi',
        languages: { en: 'English', fi: 'Finnish' },
        target: target({ from_default: { schema: { type: 'Product' } } }),
      }),
      edit('schema.props.name', 'Widget'),
    );
    expect(inherited(state.server!, 'target', 'schema.type')).toBe('Product');
    expect(view(state)!.effective.schema).toEqual({
      type: 'Product',
      props: { name: 'Widget' },
    });
    // What is sent: the server cleans it against the inherited type.
    expect(draftPayload(state.edits.target, {}, [])).toEqual({
      schema: { props: { name: 'Widget' } },
    });
  });

  it('labels in custom JSON-LD text values are stored as names, keys are left alone', () => {
    const tokens = payload().tokens;
    const typed = '{"@type": "Thing", "{Page title}": 1, "name": "{Page title} at \\"{Site name}\\"", "url": "/s?q={search_term_string}"}';
    const stored = jsonStrings(typed, (text) => toStored(text, tokens));
    expect(stored).toBe(
      '{"@type": "Thing", "{Page title}": 1, "name": "{title} at \\"{site}\\"", "url": "/s?q={search_term_string}"}',
    );
    expect(jsonStrings(stored, (text) => toDisplay(text, tokens))).toBe(typed);
  });

  it('a repeated refusal says nothing else was saved', () => {
    const refused = run(
      ready(),
      edit('title', '{nope}'),
      edit('description', 'New'),
      { type: 'errors', scope: 'target', fields: { title: 'Not known.' } },
    );
    const idle = run(refused, {
      type: 'save',
      scope: 'target',
      save: { phase: 'idle' },
    });
    expect(footer(idle).text).toBe('1 field needs attention · other changes saved');
    const failed = run(refused, {
      type: 'save',
      scope: 'target',
      save: { phase: 'error', message: MESSAGES.unstored },
    });
    expect(footer(failed)).toEqual({
      dot: 'error',
      text: '1 field needs attention · other changes not saved',
      actions: ['goto'],
    });
  });

  it("the hidden strip follows the working copy, not the last saved output", () => {
    const resolved = {
      head: {
        title: '',
        meta: [{ name: 'robots', content: 'noindex' }],
        link: [],
        script: [],
      },
      image: null,
      schema: { withheld: false, missing_required: [], missing_recommended: [] },
    };
    const hidden = ready({
      target: target({ values: { robots: { noindex: true } } }),
      resolved,
    });
    expect(view(hidden)!.hidden).toBe(true);
    // Undo in the strip: shown at once, before the write comes back.
    const shown = run(hidden, edit('robots.noindex', false));
    expect(view(shown)!.hidden).toBe(false);
    expect(strips(shown, view(shown), false)).toEqual([]);
  });
});
