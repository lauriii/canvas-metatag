import { describe, expect, it } from 'vitest';

import textCases from '../../tests/fixtures/text-cases.json';
import { ApiError } from './api';
import { EMPTY_SCHEMA, REGISTRY, RULES } from './data.test-helper';
import type { EditorToken } from './host';
import {
  type DraftIO,
  LIMITS,
  MESSAGES,
  aiError,
  aiOffText,
  applyChanges,
  article,
  breadcrumb,
  canon,
  cascade,
  clip,
  currencyName,
  currencyOptions,
  currencyChoices,
  dateText,
  diff,
  dirOf,
  draftPayload,
  fieldNames,
  footer,
  getPath,
  inSentence,
  inherited,
  initialState,
  kindOfType,
  kinds,
  leaveOut,
  changeKindText,
  proposalLossText,
  removed,
  stageVerdicts,
  typeOf,
  withKind,
  fileSize,
  imageSize,
  largeCardNeeds,
  nowEditing,
  smallCard,
  freshStore,
  holdsStore,
  measure,
  merge,
  meter,
  openPending,
  pendingFor,
  placesText,
  plain,
  previewNote,
  previewText,
  prune,
  readPending,
  robotsUnsent,
  reducer,
  saveDraft,
  setPath,
  sitePaths,
  siteTexts,
  socialImage,
  source,
  strips,
  tabOf,
  texts,
  truncate,
  unsent,
  view,
} from './model';
import type {
  Action,
  Fact,
  Measurer,
  Resolved,
  SeoValues,
  SourceRow,
  State,
  StatePayload,
  Target,
  Value,
  Verdict,
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
    robots: { max_image_preview: 'large' as const },
  },
  currency: '',
};

/** Typed text. */
const t = (text: string) => ({ text });

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
  ui: 'en',
  registry: REGISTRY,
  search_features: RULES,
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
  facts: {
    title: { label: 'Title', kind: 'text', value: 'Pricing' },
    description: { label: 'Description', kind: 'text', value: 'Plans.' },
    site: { label: 'Site name', kind: 'text', value: 'Example' },
    url: { label: 'Page address', kind: 'address', value: 'https://www.example.com/pricing' },
    author: { label: 'Author', kind: 'text', value: 'Ada' },
    published: { label: 'First published', kind: 'date', value: '2026-03-02T09:00:00+02:00' },
    modified: { label: 'Last updated', kind: 'date', value: '2026-03-04T09:00:00+02:00' },
    image: { label: 'Image', kind: 'image', value: '', image: null },
  },
  separator: '|',
  sources: [],
  broken: {},
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
  const file = textCases as unknown as {
    facts: Record<string, string>;
    separator: string;
    site: SeoValues;
    cases: {
      name: string;
      target?: SeoValues;
      site?: SeoValues;
      facts?: Record<string, string>;
      links?: Record<string, string>;
      separator?: string;
      expect: Record<string, string>;
    }[];
  };
  it.each(file.cases.map((row) => [row.name, row] as const))('%s', (_, row) => {
    const facts = { ...file.facts, ...row.facts };
    const text = (value: Value) =>
      'text' in value
        ? value.text
        : 'fact' in value
          ? (facts[value.fact] ?? '')
          : 'source' in value
            ? (row.links?.[value.source.expression] ?? '')
            : '';
    const site = row.site ?? file.site;
    const out = texts(
      cascade(row.target ?? {}, site),
      text,
      row.separator ?? file.separator,
      site.title_end,
    );
    expect(
      Object.fromEntries(
        Object.keys(row.expect).map((key) => [
          key,
          out[key as keyof typeof out],
        ]),
      ),
    ).toEqual(row.expect);
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
        { robots: { noindex: true, nofollow: true }, social: { image: { media: 'a' } } },
        { robots: { noindex: false }, title: t('T') },
      ),
    ).toEqual({
      robots: { noindex: false, nofollow: true },
      social: { image: { media: 'a' } },
      title: t('T'),
    });
  });

  it('cascade() takes the title ending and robots from the site, and nothing else', () => {
    expect(
      cascade({ robots: { noindex: true } }, {
        title: t('ignored'),
        title_end: t('S'),
        description: t('ignored'),
        robots: { noindex: false, max_image_preview: 'large' },
      }),
    ).toEqual({
      title_end: t('S'),
      robots: { noindex: true, max_image_preview: 'large' },
    });
    expect(cascade({ title: t('T'), title_end: t('') }, { title_end: t('S') })).toEqual({ title: t('T'), title_end: t('') });
  });

  it('source() walks target, default-language version, site, fallback', () => {
    const layers: { target: SeoValues; from_default: SeoValues; site: SeoValues } = {
      target: { title: t('T'), robots: { nofollow: true } },
      from_default: {
        robots: { noindex: true },
        social: { image: { media: 'uuid' } },
        schema: { type: 'Article' },
      },
      site: { title_end: t('S'), robots: { max_image_preview: 'large' as const } },
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
    // The ending follows Site whether or not the site stores one.
    expect(source('title_end', layers)).toBe('site');
    expect(source('title_end', { ...layers, site: {} })).toBe('site');
    expect(source('title', { ...layers, target: {} })).toBe('fallback');
    // The site layer cannot supply anything but the ending and robots.
    expect(
      source('description', {
        target: {},
        from_default: {},
        site: { description: t('x') },
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
    // "No ending" is the one empty value that is kept.
    expect(prune({ title_end: { text: '' }, title: { text: ' ' } })).toEqual({ title_end: { text: '' } });
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
    const values = setPath<SeoValues>({}, 'schema.props.headline', t('H'));
    expect(values).toEqual({ schema: { props: { headline: t('H') } } });
    expect(getPath(values, 'schema.props.headline')).toEqual(t('H'));
    expect(getPath(values, 'schema.props.constructor')).toBeUndefined();
    expect(setPath(values, 'schema.props.headline', undefined)).toEqual({});
    expect(setPath({ title: 'T' }, 'social.image', undefined)).toEqual({
      title: 'T',
    });
  });
});

// Typed text and links.

describe('values in the reducer', () => {
  const templateCtx = {
    kind: 'template',
    id: 'node.article.full',
    bundle: 'article',
    previewId: '11',
  } as const;
  const loaded = (over: Partial<StatePayload> = {}) =>
    reducer(initialState(templateCtx), {
      type: 'loaded',
      ctx: templateCtx,
      payload: payload({ target: target({ scope: 'template', label: 'Article' }), ...over }),
      readonly: 'no',
    });

  it('half of a character, as a cut paste leaves it, becomes the replacement character', () => {
    const typed = run(
      ready(),
      edit('social.description', t('Cut \uD83D here, whole \uD83D\uDE00, end \uDE00')),
    );
    expect(typed.edits.target.social?.description).toEqual(
      t('Cut \uFFFD here, whole \uD83D\uDE00, end \uFFFD'),
    );
  });

  it("a page's title holds only the editor's words", () => {
    const typed = run(ready(), edit('title', t('Pricing plans')));
    expect(typed.edits.target).toEqual({ title: t('Pricing plans') });
    expect(view(typed)!.texts.title).toBe('Pricing plans | Example');
    expect(run(typed, edit('title', t(' '))).edits.target).toEqual({});
  });

  it("choosing the site's ending stores nothing; another ending and No ending are stored", () => {
    expect(run(ready(), edit('title_end', { fact: 'site' })).edits.target).toEqual({});
    expect(run(ready(), edit('title_end', t(''))).edits.target).toEqual({ title_end: t('') });
    const site = { ...SITE, values: { ...SITE.values, title_end: t('Example Co') } };
    // Over a typed site ending, the site name is an ending of its own.
    expect(run(ready({ site }), edit('title_end', { fact: 'site' })).edits.target).toEqual({ title_end: { fact: 'site' } });
    expect(run(ready({ site }), edit('title_end', t('Example Co'))).edits.target).toEqual({});
  });

  it('a link to the default source is stored at template scope', () => {
    const state = run(loaded(), edit('title', { fact: 'title' }));
    expect(state.edits.target).toEqual({ title: { fact: 'title' } });
  });

  it('a linked value resolves through the sources, and gives its default when empty', () => {
    const summary = {
      source: { sourceType: 'entity-field', expression: 'ℹ︎␜entity:node:article␝field_summary␞␟value' },
      label: 'Summary',
      path: ['Summary'],
      field: 'field_summary',
      hop: false,
      kinds: ['text'],
      status: 'ok',
      value: 'A short summary.',
    } satisfies SourceRow;
    const linked = run(loaded({ sources: [summary] }), edit('description', { source: summary.source }));
    expect(view(linked)!.texts.description).toBe('A short summary.');
    const empty = run(loaded({ sources: [{ ...summary, status: 'empty', value: '' }] }), edit('description', { source: summary.source }));
    expect(view(empty)!.texts.description).toBe('Plans.');
    // A link the type no longer offers is broken: the default too.
    const broken = run(loaded(), edit('description', { source: summary.source }));
    expect(view(broken)!.texts.description).toBe('Plans.');
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
      "This event isn't published yet. Its fields are read with your access until visitors can see it.";
    expect(note(false, true)).toEqual({ suffix: null, unpublished: '', info: estimate });
    // What the caption adds is in the ⓘ too: a narrow caption leaves it out.
    expect(note(false, false)).toEqual({
      suffix: 'Not published yet',
      unpublished: '',
      info: `This page isn't published yet. ${estimate}`,
    });
    expect(
      previewNote({ template: false, published: true, node: true, label: 'Page', hidden: true }).info,
    ).toBe(`It is hidden from search engines. ${estimate}`);
    expect(note(true, true)).toEqual({
      suffix: null,
      unpublished: '',
      info: `${estimate} Switch the previewed event with the preview picker in the top bar.`,
    });
    expect(note(true, false)).toEqual({
      suffix: 'Template not in use yet',
      unpublished: '',
      info: `The template is not in use yet. ${estimate} Switch the previewed event with the preview picker in the top bar.`,
    });
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
      target: target({ values: { title: t('Plans') } }),
    });
    expect(state).toMatchObject({
      phase: 'ready',
      scope: 'target',
      tab: 'search',
      edits: { target: { title: t('Plans') }, site: SITE },
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
    const set = run(ready(), edit('social.title', t('Hello')));
    for (const value of [undefined, t(''), t('  \n')]) {
      expect(run(set, edit('social.title', value)).edits.target).toEqual({});
    }
    // A trailing space is what the user typed.
    expect(run(set, edit('social.title', t('Hello '))).edits.target).toEqual({
      social: { title: t('Hello ') },
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
          social: { image: { media: 'aaaaaaaa-0000-4000-8000-000000000000' } },
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
      run(state, edit('social.image', { media: 'aaaaaaaa-0000-4000-8000-000000000000' }))
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
    expect(state.edits.site.values).toEqual({});
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
      edit('title', t('T')),
    );
    const reset = run(set, {
      type: 'reset',
      scope: 'target',
      path: 'schema.custom',
    });
    expect(reset.edits.target).toEqual({ title: t('T') });
    expect(reset.undo).toMatchObject({ text: 'Reset', path: 'schema.custom' });
    const undone = run(reset, { type: 'undo' });
    expect(undone.edits.target).toEqual(set.edits.target);
    expect(undone.undo).toBeNull();
    // Undo is cleared by the next edit and by a scope change.
    expect(run(reset, edit('title', t('U'))).undo).toBeNull();
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

  it('a site currency names where it goes live before it is saved', () => {
    const dirty = run(
      ready(),
      { type: 'scope', scope: 'site' },
      edit('currency', 'EUR', 'site'),
    );
    const names = Array.from({ length: 25 }, (_, at) => `Lamp ${at + 1}`);
    const many = run(dirty, { type: 'effect', effect: { count: 30, places: names } });
    expect(footer(many)).toMatchObject({
      dot: 'blue',
      text: 'Also changes 30 places.',
      actions: ['discard', 'save'],
      labels: { save: 'Save and update 30 places' },
    });
    // The Currency field names 25 of them and counts the rest.
    expect(placesText({ count: 30, places: names })).toBe(`${names.join(', ')} and 5 more`);
    expect(placesText({ count: 3, places: ['Oak desk lamp', 'Membership', 'Every Product'] })).toBe('Oak desk lamp, Membership and Every Product');
    // One place, by its name.
    const one = run(dirty, { type: 'effect', effect: { count: 1, places: ['Every Product'] } });
    expect(footer(one)).toMatchObject({
      text: 'Also changes Every Product.',
      labels: { save: 'Save and update Every Product' },
    });
    // Nowhere: the usual words.
    expect(footer(run(dirty, { type: 'effect', effect: { count: 0, places: [] } })).text).toBe('Unsaved changes · not live yet');
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
      values: { title: t('T') },
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
      edit('title', t('T')),
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
          values: { title_end: t('About') },
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
      edits: { target: { title_end: t('About') } },
      flash: 'Now editing: About us',
    });
    expect(loaded.edits.site.identity.name).toBe('Example Inc');
    expect(footer(loaded)).toMatchObject({
      dot: 'info',
      text: 'Now editing: About us',
    });
  });

  it('another preview of the same template keeps the view, and a change typed meanwhile', () => {
    const template = target({
      scope: 'template',
      entity_type: 'content_template',
      id: 'node.event.full',
      label: 'Event',
      auto_save_key: 'content_template:node.event.full',
      values: { title: t('Saved') },
    });
    const one = { kind: 'template', id: 'node.event.full', bundle: 'event', previewId: '1' } as const;
    const two = { ...one, previewId: '2' } as const;
    const state = reducer(initialState(one), {
      type: 'loaded',
      ctx: one,
      payload: payload({ target: template }),
      readonly: 'no',
    });
    const refreshing = run(state, { type: 'loading', ctx: two, refresh: true });
    expect(refreshing).toMatchObject({
      phase: 'refreshing',
      ctx: two,
      edits: { target: { title: t('Saved') } },
    });
    expect(refreshing.server).toBe(state.server);
    const answer = {
      type: 'loaded',
      ctx: two,
      payload: payload({ target: template }),
      readonly: 'store',
    } as const;
    // Typed meanwhile: kept, and waiting to be sent.
    const typed = run(refreshing, edit('title', t('Typed')), answer);
    expect(typed).toMatchObject({
      phase: 'ready',
      edits: { target: { title: t('Typed') } },
      save: { target: { phase: 'pending' } },
    });
    // Nothing typed: the server's values.
    expect(run(refreshing, answer)).toMatchObject({
      edits: { target: { title: t('Saved') } },
      save: { target: { phase: 'idle' } },
    });
    // An Undo of the template's values goes with the node it was made on.
    const changed = run(state, { type: 'apply', scope: 'target', values: { title: t('Linked') }, undo: 'Linked to Byline' });
    expect(changed.undo).not.toBeNull();
    expect(run(changed, { type: 'loading', ctx: two, refresh: true }).undo).toBeNull();
  });

  it('a publish takes away an Undo that would change the target', () => {
    const draft = target({
      scope: 'template',
      entity_type: 'content_template',
      id: 'node.event.full',
      label: 'Event',
      auto_save_key: 'content_template:node.event.full',
      has_draft: true,
      values: { title: t('Linked') },
    });
    const one = { kind: 'template', id: 'node.event.full', bundle: 'event', previewId: '1' } as const;
    const state = run(
      reducer(initialState(one), { type: 'loaded', ctx: one, payload: payload({ target: { ...draft, values: {} } }), readonly: 'no' }),
      { type: 'apply', scope: 'target', values: { title: t('Linked') }, undo: 'Linked to Byline' },
    );
    expect(state.undo).not.toBeNull();
    // Still a draft: the Undo stays.
    expect(run(state, { type: 'refreshed', payload: payload({ target: draft }), readonly: 'no' }).undo).not.toBeNull();
    // Published: gone.
    const published = run(
      { ...state, server: payload({ target: draft }) },
      { type: 'refreshed', payload: payload({ target: { ...draft, has_draft: false } }), readonly: 'no' },
    );
    expect(published.undo).toBeNull();
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
      target: target({ values: { title: t('Published') }, has_draft: false }),
    });
    const clean = run(ready(), {
      type: 'refreshed',
      payload: fresh,
      readonly: 'no',
    });
    expect(clean.edits.target).toEqual({ title: t('Published') });

    const typing = run(ready(), edit('title', t('Mine')), {
      type: 'refreshed',
      payload: fresh,
      readonly: 'no',
    });
    expect(typing.edits.target).toEqual({ title: t('Mine') });
    expect(typing.server).toBe(fresh);

    // Confirmed, then discarded in "Review changes": the fields return to the published values.
    const confirmed = run(ready(), edit('title', t('Mine')), {
      type: 'confirmed',
      payload: payload({ target: target({ values: { title: t('Mine') } }) }),
      sent: canon({ title: t('Mine') }),
    });
    expect(
      run(confirmed, { type: 'refreshed', payload: fresh, readonly: 'no' })
        .edits.target,
    ).toEqual({
      title: t('Published'),
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
      title: t('Mine'),
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
  it("lays Canvas's live title and description over the facts", () => {
    const state = run(ready(), {
      type: 'live',
      live: { title: 'Prices', description: 'New.' },
    });
    expect(view(state)!.texts).toEqual({
      title: 'Prices | Example',
      description: 'New.',
      social_title: 'Prices',
      social_description: 'New.',
      title_main: 'Prices',
      title_end: 'Example',
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
      schema: EMPTY_SCHEMA,
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
    const typed = run(state, edit('title', t('Mine')));
    expect(view(typed)!.texts.title).toBe('Mine | Example');
    // Typing elsewhere leaves the server's robots tag true; a robots change
    // not yet sent does not.
    expect(view(typed)).toMatchObject({ hidden: true, hiddenBy: 'config' });
    expect(robotsUnsent(typed)).toBe(false);
    const snippet = run(state, edit('robots.max_snippet', 50));
    expect(robotsUnsent(snippet)).toBe(true);
    expect(view(snippet)).toMatchObject({ hidden: false, hiddenBy: null });
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
    sim.dispatch(edit('title', t('Plans {sep} {site} ')));
    const before = sim.state.edits;
    expect(await saveDraft(sim.io)).toBe('done');
    expect(sim.puts).toEqual([{ title: t('Plans {sep} {site} ') }]);
    expect(sim.state.edits).toBe(before);
    expect(sim.state.server!.target).toMatchObject({
      has_draft: true,
      values: { title: t('Plans {sep} {site} ') },
    });
    expect(sim.state.sent).toBe(canon({ title: t('Plans {sep} {site} ') }));
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
    sim.dispatch(edit('title', t('Mine')));
    sim.afterPut = (attempt) => {
      if (attempt === 1) {
        sim.draft = {};
      }
    };
    expect(await saveDraft(sim.io)).toBe('done');
    expect(sim.puts).toEqual([{ title: t('Mine') }, { title: t('Mine') }]);
    expect(sim.draft).toEqual({ title: t('Mine') });
  });

  it('newer edits that arrive while saving go out in the same call', async () => {
    const sim = harness();
    sim.dispatch(edit('title', t('One')));
    sim.afterPut = (attempt) => {
      if (attempt === 1) {
        sim.dispatch(edit('title', t('One two')));
      }
    };
    expect(await saveDraft(sim.io)).toBe('done');
    expect(sim.puts).toEqual([{ title: t('One') }, { title: t('One two') }]);
    expect(sim.state.sent).toBe(canon({ title: t('One two') }));
  });

  it('five overwritten writes: the change could not be stored', async () => {
    const sim = harness();
    sim.dispatch(edit('title', t('Mine')));
    sim.afterPut = () => {
      sim.draft = {};
    };
    expect(await saveDraft(sim.io)).toBe('failed');
    expect(sim.puts).toHaveLength(5);
    expect(sim.state.edits.target).toEqual({ title: t('Mine') });
    expect(sim.state.sent).toBeNull();
  });

  it('a refused field never deletes a saved one', async () => {
    const sim = harness({ canonical: '/pricing', title: t('Saved') });
    sim.dispatch(edit('canonical', 'not an address'));
    sim.dispatch(edit('social.title', t('New')));
    sim.refuse = (values) =>
      values.canonical === 'not an address'
        ? { canonical: 'Enter a full address.' }
        : null;
    expect(await saveDraft(sim.io)).toBe('done');
    // The refusal is not counted; the second write carries the stored value.
    expect(sim.puts).toEqual([
      { canonical: 'not an address', social: { title: t('New') }, title: t('Saved') },
      { canonical: '/pricing', social: { title: t('New') }, title: t('Saved') },
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
      draftPayload({ canonical: 'x', title: t('T') }, {}, ['canonical']),
    ).toEqual({ title: t('T') });
    const sim = harness();
    sim.dispatch(edit('title', t('T')));
    sim.refuse = () => ({ title: 'Never good.' });
    const result = await saveDraft(sim.io);
    expect(result).toBeInstanceOf(ApiError);
    expect((result as ApiError).code).toBe('invalid');
    expect(sim.puts).toEqual([{ title: t('T') }, {}]);
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
    sim.dispatch(edit('title', t('T')));
    sim.token = null;
    expect(await saveDraft(sim.io)).toBe('readonly');
    expect(sim.puts).toEqual([]);
  });

  it('a conflict or a network failure stops with the error', async () => {
    const sim = harness();
    sim.dispatch(edit('title', t('T')));
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
  const server = { title: t('Saved'), robots: { noindex: true } };

  it('diff() and applyChanges() are inverses over leaves', () => {
    const edits = { title: t('Mine'), social: { image: { media: 'uuid' } } };
    const changes = diff(server, edits);
    expect(changes).toEqual({
      title: t('Mine'),
      'robots.noindex': null,
      'social.image': { media: 'uuid' },
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
    const first = pendingFor(null, '1', server, { ...server, title: t('Mine') })!;
    expect(first).toEqual({
      uid: '1',
      base: canon(server),
      changes: { title: t('Mine') },
    });
    // The base and the user stay those of the first change.
    const second = pendingFor(
      first,
      '2',
      { title: t('Other') },
      { ...server, title: t('Mine too') },
    )!;
    expect(second).toEqual({
      uid: '1',
      base: canon(server),
      changes: { title: t('Mine too') },
    });
    // Back to the base: nothing to keep.
    expect(pendingFor(second, '1', server, server)).toBeNull();
    // After a confirmed write only the refused paths remain.
    expect(
      pendingFor(
        null,
        '1',
        { title: t('Mine') },
        { title: t('Mine'), canonical: 'bad' },
        ['canonical'],
      ),
    ).toEqual({
      uid: '1',
      base: canon({ title: t('Mine') }),
      changes: { canonical: 'bad' },
    });
    // A refused link is not kept: it can be picked again, and kept it would
    // be sent again on every opening.
    const gone = {
      source: {
        sourceType: 'entity-field' as const,
        expression: 'ℹ︎␜entity:node:article␝field_gone␞␟value',
      },
    };
    expect(
      pendingFor(
        null,
        '1',
        { title: t('Mine') },
        { title: t('Mine'), description: gone },
        ['description'],
      ),
    ).toBeNull();
    expect(pendingFor(null, null, server, { title: t('x') })!.uid).toBe('');
  });

  it('readPending() refuses what is not an entry', () => {
    const entry = { uid: '1', base: canon(server), changes: { title: t('Mine') } };
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

  const entry = { uid: '1', base: canon(server), changes: { title: t('Mine') } };

  it('a change the server already has is dropped silently', () => {
    expect(openPending(entry, '1', { ...server, title: t('Mine') })).toBe('drop');
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
      openPending(entry, '1', { robots: { noindex: true }, title: t('Saved') }),
    ).toBe('restore');
  });

  it('changed base: offered', () => {
    expect(openPending(entry, '1', { title: t('Published since') })).toBe('offer');
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
              title: t('Mine'),
              'social.image': { media: 'uuid' },
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
      fieldNames(['identity.same_as', 'values.title_end', 'schema.props.name']),
    ).toEqual(['Profiles elsewhere', 'Title ending', 'Structured data']);
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

  it('kinds: six, in order, each type reached through one', () => {
    expect(kinds(REGISTRY)).toEqual(['Product', 'Service', 'Article', 'Event', 'ProfilePage', 'WebPage']);
    expect(kindOfType(REGISTRY, 'BlogPosting')).toBe('Article');
    expect(kindOfType(REGISTRY, 'AboutPage')).toBe('WebPage');
    // A type this site no longer has is a web page.
    expect(kindOfType(REGISTRY, 'Recipe')).toBe('WebPage');
    expect(typeOf(REGISTRY, 'Recipe')).toBe(REGISTRY.WebPage);
    expect(REGISTRY.BlogPosting.props).toEqual(REGISTRY.Article.props);
    expect(REGISTRY.BlogPosting.kind).toBeUndefined();
  });

  it('the kind always reads what is output, and the inherited one can be chosen', () => {
    const choose = (state: State, to: string) =>
      run(state, { type: 'apply', scope: 'target', values: withKind(state.server!, state.edits.target, to) });
    // Back to a web page: nothing is stored, and the field reads the default.
    const article = ready({ target: target({ values: { schema: { type: 'Article', props: { headline: t('Hi') } } } }) });
    expect(choose(article, 'WebPage').edits.target).toEqual({});
    // Over an inherited article, a web page is stored: it differs.
    const translation = ready({ target: target({ values: {}, from_default: { schema: { type: 'Article' } } }) });
    expect(choose(translation, 'WebPage').edits.target).toEqual({ schema: { type: 'WebPage' } });
    // Choosing the inherited kind follows it again.
    const own = ready({ target: target({ values: { schema: { type: 'WebPage' } }, from_default: { schema: { type: 'Article' } } }) });
    expect(choose(own, 'Article').edits.target).toEqual({});
  });

  it('names currencies with their codes, sorted by name in the dialog\'s language', () => {
    expect(currencyName('EUR', 'en')).toBe('Euro · EUR');
    expect(currencyName('EUR', 'fi')).toBe('Euro · EUR');
    expect(currencyName('USD', 'fi')).toBe('Yhdysvaltain dollari · USD');
    // A code with no name of its own is said as the code.
    expect(currencyName('XXX', 'en')).toMatch(/XXX$/);
    expect(currencyName('ZZZ', 'en')).toBe('ZZZ');
    const en = currencyOptions('en');
    expect(en.map(([, name]) => name)).toEqual([...en.map(([, name]) => name)].sort((a, b) => a.localeCompare(b, 'en')));
    expect(en.find(([code]) => code === 'EUR')).toEqual(['EUR', 'Euro · EUR']);
    // Those in use first, then the most common, then the rest.
    const { common, rest } = currencyChoices('en', ['SEK', undefined, 'EUR']);
    expect(common.map(([code]) => code)).toEqual(['SEK', 'EUR', 'USD', 'GBP']);
    expect(rest).toHaveLength(en.length - 4);
    expect(rest.some(([code]) => code === 'EUR')).toBe(false);
    // Another language, its own names and order.
    expect(currencyOptions('fi').find(([code]) => code === 'USD')?.[1]).toBe('Yhdysvaltain dollari · USD');
  });

  it('lists the stage\'s lines with "No search feature" last', () => {
    const main = "https://example.com/plans#primary";
    const page = "https://example.com/plans#webpage";
    const faq = { feature: 'faq', node: "https://example.com/plans#faq", verdict: 'retired' as const };
    const report = (features: Verdict[]) => ({ ...EMPTY_SCHEMA, type: 'Service', nodes: [{ id: main, type: 'Service', origin: 'main' as const, at: 3 }], features });
    // A service has no feature of its own: the hand-added FAQ comes first.
    expect(stageVerdicts(report([faq]), main, page)).toEqual([faq, { feature: null, node: main, verdict: 'none' }]);
    // Only "No search feature" from the server: said once.
    expect(stageVerdicts(report([{ feature: null, node: null, verdict: 'none' }]), main, page)).toHaveLength(1);
    // A main node with a feature: no made-up line.
    expect(stageVerdicts(report([{ feature: 'merchant-listing', node: main, verdict: 'ready' }]), main, page)).toHaveLength(1);
    // A profile is judged on the page, which covers its person.
    expect(stageVerdicts(report([{ feature: 'profile-page', node: page, verdict: 'ready' }]), main, page)).toEqual([{ feature: 'profile-page', node: page, verdict: 'ready' }]);
  });

  it('a change of kind keeps the details the new one has, and names the rest', () => {
    const product = ready({ target: target({ values: { schema: { type: 'Product', props: { name: t('Studio'), offers_price: t('120'), offers_priceCurrency: t('EUR'), billing: t('P1M'), sold_here: t('yes') } } } }) });
    const server = product.server!;
    expect(removed(server, product.edits.target, 'Event', 'en')).toEqual(['the price (€120)', 'the answer to “Bought on this page” (yes, from us)', 'the billing (every month)']);
    // A draft price that is not a number yet is said as typed, never "€NaN".
    const draft = ready({ target: target({ values: { schema: { type: 'Product', props: { offers_price: t('49,90'), offers_priceCurrency: t('EUR') } } } }) });
    expect(removed(draft.server!, draft.edits.target, 'Event', 'en')).toEqual(['the price (49,90)']);
    // An event's dates, as the dialog writes dates, by their nouns, in the form's order.
    const event = ready({ target: target({ values: { schema: { type: 'Event', props: { endDate: t('2027-05-11'), startDate: t('2027-05-12T18:00'), location_name: t('Hall') } } } }) });
    expect(removed(event.server!, event.edits.target, 'Article', 'en')).toEqual(['the start (12 May 2027, 18:00)', 'the end (11 May 2027)', 'the venue (Hall)']);
    // Plans for a service keep the name, the price, the currency and the billing.
    expect(withKind(server, product.edits.target, 'Service').schema).toEqual({
      type: 'Service',
      props: { name: t('Studio'), offers_price: t('120'), offers_priceCurrency: t('EUR'), billing: t('P1M') },
    });
  });

  it('says what a change of kind removes, one value or several', () => {
    expect(changeKindText('an event', ['the price (€2,500)', 'the availability (in stock)'])).toBe(
      'Changing to an event removes the price (€2,500) and the availability (in stock) you set. Undo brings them back.',
    );
    expect(changeKindText('an article', ['the start (12 May 2027, 18:00)', 'the end (13 May 2027)', 'the venue (The New Mill)'])).toBe(
      'Changing to an article removes the start (12 May 2027, 18:00), the end (13 May 2027) and the venue (The New Mill) you set. Undo brings them back.',
    );
    expect(changeKindText('an event', ['the price (€89)'])).toBe('Changing to an event removes the price (€89) you set. Undo brings it back.');
    expect(changeKindText('a web page', [])).toBe('Change this page to a web page.');
    // The AI tray says the same before a proposed kind is used.
    expect(proposalLossText(['the price (€89)', 'the billing (every month)'])).toBe('Using this removes the price (€89) and the billing (every month) you set.');
  });

  it('leaves out a hand-added item, giving it an id first', () => {
    const faq = { '@type': 'FAQPage', name: 'Questions' };
    const base = 'https://example.com/plans';
    const left = leaveOut({ schema: { custom: JSON.stringify([faq, { '@type': 'FAQPage', '@id': '#faqpage' }]) } }, { item: 0, id: null, type: 'FAQPage' }, base)!;
    expect(left).toMatchObject({ id: '#faqpage-2', given: true });
    expect(JSON.parse(left.values.schema!.custom!)[0]).toEqual({ '@id': '#faqpage-2', ...faq });
    expect(left.values.schema!.skip).toEqual(['#faqpage-2']);
    // With an id: listed as written, the JSON-LD unchanged.
    const custom = JSON.stringify({ '@type': 'FAQPage', '@id': '#faq' });
    expect(leaveOut({ schema: { custom } }, { item: 0, id: `${base}#faq`, type: 'FAQPage' }, base)).toEqual({ values: { schema: { custom, skip: ['#faq'] } }, id: '#faq', given: false });
    expect(leaveOut({ schema: { custom: 'not json' } }, { item: 0, id: null, type: 'FAQPage' }, base)).toBeNull();
    // An unsent edit moved the items: the one the report named is found by
    // its id, and one without an id is never mistaken for another.
    const moved = JSON.stringify([{ '@type': 'Product', '@id': '#p' }, { '@type': 'FAQPage', '@id': '#faq' }]);
    expect(leaveOut({ schema: { custom: moved } }, { item: 0, id: `${base}#faq`, type: 'FAQPage' }, base)?.id).toBe('#faq');
    expect(leaveOut({ schema: { custom: JSON.stringify([{ '@type': 'Product' }, faq]) } }, { item: 0, id: null, type: 'FAQPage' }, base)).toBeNull();
    expect(leaveOut({ schema: { custom: moved } }, { item: 0, id: `${base}#gone`, type: 'FAQPage' }, base)).toBeNull();
  });
});


// What the components lean on.

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
  const hero = {
    source: { sourceType: 'entity-field', expression: 'ℹ︎␜entity:node:article␝field_hero␞␟{src↝entity␜␜entity:file␝uri␞␟value,alt↠alt,width↠width,height↠height}' },
    label: 'Hero image',
    path: ['Hero image'],
    field: 'field_hero',
    hop: false,
    kinds: ['image'],
    status: 'ok',
    value: '',
    image: { ...image, name: 'Field hero' },
  } satisfies SourceRow;
  const withImage = (over: Partial<StatePayload> = {}) =>
    ready({
      facts: {
        ...payload().facts,
        image: { label: 'Image', kind: 'image', value: '', image },
      } as Record<Fact, StatePayload['facts'][Fact]>,
      sources: [hero],
      target: target({ scope: 'template', label: 'Product' }),
      ...over,
    });
  const shown = (state: State, picked = {}) => socialImage(state, view(state, picked)!);

  it('the social image names where it comes from', () => {
    expect(shown(withImage())).toEqual({ image, from: 'Image' });
    expect(
      shown(run(withImage(), edit('social.image', { source: hero.source }))),
    ).toMatchObject({ image: { name: 'Field hero' }, from: 'Hero image' });
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
    ).toMatchObject({ image: { name: 'Card' }, from: 'Site default image' });
  });

  it('a linked image that gives nothing says so, and what is used instead', () => {
    const hidden = run(
      withImage({ sources: [{ ...hero, status: 'hidden', image: null }] }),
      edit('social.image', { source: hero.source }),
    );
    expect(shown(hidden)).toEqual({ image, from: 'Image', state: 'hidden' });
    const gone = run(withImage({ sources: [] }), edit('social.image', { source: hero.source }));
    expect(shown(gone)).toEqual({ image, from: 'Image', state: 'broken' });
  });

  it('an image chosen here shows before the server knows it', () => {
    const state = run(withImage(), edit('social.image', { media: 'uuid-new' }));
    const picked = { name: 'New', thumb: '/n.jpg', width: 800, height: 400 };
    expect(shown(state, { 'uuid-new': picked })).toEqual({
      image: picked,
      from: 'Chosen here',
    });
    // Once the write is confirmed the server's own facts take over.
    const resolved = {
      head: { title: '', meta: [], link: [], script: [] },
      image: { ...image, name: 'New', source: 'override' as const },
      schema: EMPTY_SCHEMA,
    };
    const confirmed = reducer(state, {
      type: 'confirmed',
      payload: payload({
        target: target({ values: { social: { image: { media: 'uuid-new' } } } }),
        resolved,
      }),
      sent: canon(state.edits.target),
    });
    expect(
      shown(confirmed, { 'uuid-new': picked }).image,
    ).toBe(resolved.image);
  });

  it('an image inherited from the default-language version says so', () => {
    const state = ready({
      langcode: 'fi',
      languages: { en: 'English', fi: 'Finnish' },
      target: target({ from_default: { social: { image: { media: 'uuid-en' } } } }),
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
      edit('schema.props.name', t('Launch')),
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
      schema: EMPTY_SCHEMA,
    };
    const state = withImage({
      target: target({ values: { social: { image: { media: 'uuid-private' } } } }),
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
      edit('schema.props.name', t('Widget')),
    );
    expect(inherited(state.server!, 'target', 'schema.type')).toBe('Product');
    expect(view(state)!.effective.schema).toEqual({
      type: 'Product',
      props: { name: t('Widget') },
    });
    // What is sent: the server cleans it against the inherited type.
    expect(draftPayload(state.edits.target, {}, [])).toEqual({
      schema: { props: { name: t('Widget') } },
    });
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
      schema: EMPTY_SCHEMA,
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

describe('aiOffText()', () => {
  it('says why AI suggestions are off, for each reason, and where to look', () => {
    const where =
      ' Site administrators can see how to fix it in the status report.';
    expect(aiOffText('no_provider')).toBe(
      `AI suggestions are off: no AI provider is set up.${where}`,
    );
    expect(aiOffText('not_usable')).toBe(
      `AI suggestions are off: the AI provider isn't ready to use.${where}`,
    );
    // The status report's words for the same state.
    expect(aiOffText('no_prompt')).toBe(
      `AI suggestions are off: a suggestion prompt is empty or missing.${where}`,
    );
    // A capabilities alter hook may leave the reason out.
    expect(aiOffText(null)).toBe(
      `AI suggestions are off: no AI provider is set up.${where}`,
    );
  });
});

describe('aiError()', () => {
  it('names the next step for a guardrail stop by whether Refine text was sent', () => {
    expect(aiError('blocked', true)).toEqual({
      text: "The site's AI rules stopped this request. Try different wording in Refine, or ask a site administrator.",
      retry: true,
    });
    // Set off by the page text, or in the structured data tray: asking
    // again is refused again.
    expect(aiError('blocked')).toEqual({
      text: "The site's AI rules stopped this request. Ask a site administrator.",
      retry: false,
    });
  });

  it('offers to try again only where that can help', () => {
    expect(aiError('rate_limited', true)).toEqual({
      text: 'The AI service is busy. Wait a minute, then try again.',
      retry: true,
    });
    expect(aiError('invalid_response')).toEqual({
      text: "The AI answer couldn't be used.",
      retry: true,
    });
    for (const code of ['provider_error', 'network', 'bad_request', null]) {
      expect(aiError(code)).toEqual({
        text: "The AI service didn't answer.",
        retry: true,
      });
    }
    expect(aiError('ai_not_configured')).toEqual({
      text: "AI suggestions aren't set up on this site yet.",
      retry: false,
    });
    expect(aiError('quota_exceeded', true)).toEqual({
      text: "The site's AI allowance is used up. Ask a site administrator.",
      retry: false,
    });
    // A 403 from Drupal's access check, after a fresh token was tried.
    expect(aiError('forbidden')).toEqual({
      text: 'Your session or permissions changed. Reload the editor and try again.',
      retry: false,
    });
  });
});

describe('largeCardNeeds()', () => {
  it('needs 600 px of width and 157 of height, as the head\'s card hint', () => {
    expect(
      [
        [400, 400],
        [600, 315],
        [1200, 630],
        [1200, 150],
        [599, 630],
        [600, 157],
      ].map(([width, height]) => largeCardNeeds(width, height)),
    ).toEqual([
      'at least 600 px wide',
      '',
      '',
      'at least 157 px tall',
      'at least 600 px wide',
      '',
    ]);
  });

  it('says why a card is small, from the same numbers', () => {
    expect(
      [null, { width: 400, height: 400 }, { width: 1200, height: 150 }, { width: 600, height: 157 }].map(
        smallCard,
      ),
    ).toEqual([
      'Small card: no image',
      'Small card: image under 600 px wide',
      'Small card: image under 157 px tall',
      '',
    ]);
  });
});

describe('fileSize()', () => {
  it('counts as the 5 MB rule does, in one unit base everywhere', () => {
    expect(
      [10665459, 5 * 1048576, 1048575, 1048576 - 600, 2048, 100].map(fileSize),
    ).toEqual(['10.2 MB', '5 MB', '1 MB', '1023 KB', '2 KB', '1 KB']);
    // The image field says what the weight row says.
    expect(imageSize({ width: 1200, height: 630, bytes: 10665459 })).toBe(
      '1200\u00a0×\u00a0630 · 10.2 MB',
    );
    expect(imageSize({ width: 1200, height: 630 })).toBe('1200\u00a0×\u00a0630');
  });
});

describe('holdsStore()', () => {
  it('holds the store state that came with a load, never a language mismatch', () => {
    expect(holdsStore('ready', 'store', true, false)).toBe(true);
    // A mismatch is known at load: shown at once.
    expect(holdsStore('ready', 'store', true, true)).toBe(false);
    // One reached later, on a save, shows at once.
    expect(holdsStore('ready', 'store', false, false)).toBe(false);
    expect(holdsStore('ready', 'no', true, false)).toBe(false);
    expect(holdsStore('loading', 'store', true, false)).toBe(false);
  });

  it('a store state is fresh from a load until another state is seen', () => {
    let fresh = freshStore(false, 'loading', 'no');
    expect(fresh).toBe(true);
    fresh = freshStore(fresh, 'ready', 'store');
    expect(fresh).toBe(true);
    fresh = freshStore(fresh, 'ready', 'no');
    expect(fresh).toBe(false);
    // The same state later, on a save, is not fresh.
    expect(freshStore(fresh, 'ready', 'store')).toBe(false);
    expect(freshStore(fresh, 'refreshing', 'store')).toBe(true);
  });
});

describe('nowEditing()', () => {
  const template = target({
    scope: 'template',
    entity_type: 'content_template',
    id: 'node.event.full',
    label: 'Event',
    auto_save_key: 'content_template:node.event.full:en',
  });

  it('is quiet when only the previewed node changes', () => {
    expect(nowEditing(template, { ...template, values: { title: t('x') } })).toBeUndefined();
  });

  it('names another page, also under the same title, and another language', () => {
    const pricing = target();
    expect(nowEditing(pricing, target({ id: '9', auto_save_key: 'canvas_page:9:en' }))).toBe(
      'Now editing Pricing',
    );
    expect(nowEditing(pricing, target({ auto_save_key: 'canvas_page:8:fi' }))).toBe('Now editing Pricing');
    expect(nowEditing(pricing, template)).toBe('Now editing Every Event');
    expect(nowEditing(pricing, null)).toBeUndefined();
  });
});

describe('clip()', () => {
  it('keeps a short text, cuts a long one after whole characters', () => {
    expect(clip('Oak', 3)).toBe('Oak');
    expect(clip('Oak lamp', 3)).toBe('Oak…');
    // A family emoji and a flag are one character each.
    expect(clip('👨‍👩‍👧🇫🇮 lamp', 2)).toBe('👨‍👩‍👧🇫🇮…');
    expect(Array.from(clip('a'.repeat(6000), 150))).toHaveLength(151);
  });
});
