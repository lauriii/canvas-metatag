// Pure logic: no DOM, no network, no host. Everything here runs in vitest's
// node environment. cascade(), fill(), plain() and texts() mirror the PHP
// class Values and are pinned to it by tests/fixtures/text-cases.json.
import rawRegistry from '../../data/schema-types.json';
import { ApiError } from './api';
import type { EditorToken, HostContext } from './host';
import type {
  Action,
  AiOffReason,
  Edits,
  Identity,
  Measurer,
  Pending,
  Registry,
  Scope,
  SchemaType,
  SeoValues,
  SiteSettings,
  Source,
  State,
  StatePayload,
  Tab,
  Texts,
  TokenInfo,
} from './types';

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const RAW = rawRegistry as unknown as Record<string, SchemaType>;

/** The JSON-LD type registry with `extends` resolved (one level). */
export const REGISTRY: Registry = Object.fromEntries(
  Object.entries(RAW).map(([id, type]) => [
    id,
    { ...(type.extends ? RAW[type.extends] : {}), ...type },
  ]),
);

// Paths and canonical form.

export function getPath(values: unknown, path: string): unknown {
  let at = values;
  for (const key of path.split('.')) {
    if (!isObj(at) || !Object.hasOwn(at, key)) {
      return undefined;
    }
    at = at[key];
  }
  return at;
}

/** A copy with the leaf at `path` set; `undefined` removes it and the maps it empties. */
export function setPath<T>(values: T, path: string, value: unknown): T {
  const dot = path.indexOf('.');
  const key = dot < 0 ? path : path.slice(0, dot);
  const copy: Obj = { ...(isObj(values) ? values : {}) };
  const next = dot < 0 ? value : setPath(copy[key], path.slice(dot + 1), value);
  if (
    next === undefined ||
    (value === undefined && isObj(next) && Object.keys(next).length === 0)
  ) {
    delete copy[key];
  } else {
    copy[key] = next;
  }
  return copy as T;
}

function pruned(value: unknown): unknown {
  if (Array.isArray(value)) {
    const list = value.map(pruned).filter((item) => item !== undefined);
    return list.length ? list : undefined;
  }
  if (isObj(value)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, pruned(item)] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (typeof value === 'string') {
    return value.trim() === '' ? undefined : value;
  }
  return value ?? undefined;
}

/** Drops empty maps, empty lists and strings that are empty or only whitespace. */
export const prune = <T>(values: T): T => (pruned(values) ?? {}) as T;

const sorted = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sorted)
    : isObj(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sorted(value[key])]),
        )
      : value;

/** Two values are equal when their canonical encodings are equal. */
export const canon = (values: unknown): string =>
  JSON.stringify(sorted(prune(values)));

// Layers.

/** Per-leaf replace: `over` wins, maps are merged. */
export function merge<T>(base: T, over: T): T {
  if (!isObj(base) || !isObj(over)) {
    return over === undefined ? base : over;
  }
  const out: Obj = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = merge(out[key], value);
  }
  return out as T;
}

/**
 * The effective values. The site layer supplies the title pattern and robots
 * directives only; everything else comes from the target.
 */
export function cascade(target: SeoValues, site: SeoValues): SeoValues {
  const out: SeoValues = { ...target };
  if (out.title === undefined && site.title !== undefined) {
    out.title = site.title;
  }
  const robots = { ...site.robots, ...target.robots };
  if (Object.keys(robots).length) {
    out.robots = robots;
  }
  return out;
}

/** Where the effective value of a leaf comes from. */
export function source(
  path: string,
  layers: { target: SeoValues; from_default: SeoValues; site: SeoValues },
): Source {
  if (getPath(layers.target, path) !== undefined) {
    return 'target';
  }
  if (getPath(layers.from_default, path) !== undefined) {
    return 'default';
  }
  // A directive follows Site › Defaults whether or not the site stores it:
  // the switch there is what changes it.
  return path.startsWith('robots.') ||
    (path === 'title' && getPath(layers.site, path) !== undefined)
    ? 'site'
    : 'fallback';
}

// Text outputs.

const TOKEN = /\{([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)?)\}/g;

/** The token names a template uses, in order, without repeats. */
export const tokensIn = (template: string): string[] => [
  ...new Set(Array.from(template.matchAll(TOKEN), (match) => match[1])),
];

/**
 * One pass: a known name becomes its value, an unknown one the empty string.
 * A substituted value is never scanned again.
 */
export const fill = (template: string, values: Record<string, string>) =>
  template.replace(TOKEN, (_, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : '',
  );

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * The first `max` characters drawn as one, and "…" when there were more.
 */
export function clip(text: string, max: number): string {
  let out = '';
  let count = 0;
  for (const { segment } of graphemes.segment(text)) {
    if (count++ === max) {
      return `${out}…`;
    }
    out += segment;
  }
  return text;
}

/**
 * A text's direction from its first letter, as `dir="auto"` finds it. Engines
 * have no Bidi_Class escape, so the right-to-left scripts are listed.
 */
export const dirOf = (text: string): 'rtl' | 'ltr' =>
  /^\P{L}*[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\p{Script=Mende_Kikakui}\p{Script=Imperial_Aramaic}\p{Script=Phoenician}\p{Script=Kharoshthi}\p{Script=Avestan}\p{Script=Old_Hungarian}]/u.test( // cspell:disable-line
    text,
  )
    ? 'rtl'
    : 'ltr';

/**
 * A type's label inside a sentence: "Event" reads "event", while a label
 * that starts with an abbreviation ("FAQ page") stays as written.
 */
export const inSentence = (label: string) =>
  /^\p{Lu}\p{Lu}/u.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);

/**
 * Output normalization: control and bidi characters removed, whitespace
 * collapsed, trimmed, cut to `max` code points, never inside a character drawn
 * as one (an emoji sequence, a flag, a letter with its marks).
 */
export function plain(text: string, max: number): string {
  const clean = text
    // C0 and C1 controls except tab, LF and CR (DEL too, as in PHP); bidi
    // overrides and isolates.
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g,
      '',
    )
    .replace(/[ \t\n\r]+/g, ' ')
    .replace(/^ +| +$/g, '');
  const points = Array.from(clean);
  if (points.length <= max) {
    return clean;
  }
  // The cluster that holds the first code point past the limit goes whole.
  const clusters = Array.from(
    graphemes.segment(points.slice(0, max + 1).join('')),
    ({ segment }) => segment,
  );
  clusters.pop();
  return clusters.join('');
}

/**
 * A head text: plain(), ending at a word when one ends near the limit. A cut
 * inside a word backs up to the last space when that space is within the last
 * tenth of the limit.
 */
function cut(text: string, max: number): string {
  const full = plain(text, Infinity);
  const short = plain(full, max);
  if (short === full || short.endsWith(' ') || full[short.length] === ' ') {
    return short.replace(/ +$/, '');
  }
  const points = Array.from(short);
  const space = points.lastIndexOf(' ');
  return space >= 0 && space >= max - Math.floor(max / 10)
    ? points.slice(0, space).join('')
    : short;
}

/** A separator is only ever a whole word equal to the {sep} value. */
export function trimSeparators(text: string, sep: string): string {
  if (sep === '') {
    return text;
  }
  const kept: string[] = [];
  for (const word of text.split(' ')) {
    // Leading, or directly after a kept separator.
    if (word === sep && (kept.length === 0 || kept.at(-1) === sep)) {
      continue;
    }
    kept.push(word);
  }
  while (kept.at(-1) === sep) {
    kept.pop();
  }
  return kept.join(' ');
}

/** The four text outputs. `tokens` is the flat map name => value. */
export function texts(
  effective: SeoValues,
  tokens: Record<string, string>,
): Texts {
  const value = (name: string) => tokens[name] ?? '';
  const title =
    trimSeparators(cut(fill(effective.title ?? '', tokens), 255), value('sep')) ||
    cut(value('title'), 255) ||
    cut(value('site'), 255);
  const description =
    cut(fill(effective.description ?? '', tokens), 1000) ||
    cut(value('description'), 1000);
  return {
    title,
    description,
    social_title:
      cut(fill(effective.social?.title ?? '', tokens), 255) ||
      cut(value('title'), 255),
    social_description:
      cut(fill(effective.social?.description ?? '', tokens), 1000) ||
      description,
  };
}

// Chips: storage holds {name}, the editor shows {Label}.

type Labelled = Record<string, { label: string }>;

/** Token name => the label shown in its chip, unique within the vocabulary. */
export function displayLabels(tokens: Labelled): Record<string, string> {
  const clean = (name: string) =>
    tokens[name].label.replace(/[{}]/g, '').trim() || name;
  const seen: Record<string, number> = {};
  for (const name of Object.keys(tokens)) {
    seen[clean(name)] = (seen[clean(name)] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.keys(tokens).map((name) => [
      name,
      seen[clean(name)] > 1 ? `${clean(name)} (${name})` : clean(name),
    ]),
  );
}

/** Each known {name} becomes {Label}; an unknown one is shown as written. */
export function toDisplay(template: string, tokens: Labelled): string {
  const labels = displayLabels(tokens);
  return template.replace(TOKEN, (match, name: string) =>
    Object.hasOwn(labels, name) ? `{${labels[name]}}` : match,
  );
}

/** Each {Label} becomes {name}; a pasted {name} and any other brace text stay as written. */
export function toStored(text: string, tokens: Labelled): string {
  const names = Object.fromEntries(
    Object.entries(displayLabels(tokens)).map(([name, label]) => [label, name]),
  );
  return text.replace(/\{([^{}]*)\}/g, (match, label: string) =>
    Object.hasOwn(names, label) ? `{${names[label]}}` : match,
  );
}

/**
 * Maps the text of every string value in JSON text, leaving keys and the
 * rest as typed. Text that is not JSON is mapped the same way.
 */
export const jsonStrings = (json: string, to: (text: string) => string) =>
  json.replace(
    /"((?:[^"\\]|\\.)*)"(\s*:)?/g,
    (match, text: string, key?: string) => (key ? match : `"${to(text)}"`),
  );

/**
 * The override created by the first input into an inherited page title: the
 * pattern with its first {title} replaced by what was typed.
 */
export const seedTitle = (pattern: string, typed: string): string =>
  pattern.includes('{title}') ? pattern.replace('{title}', () => typed) : typed;

// Meters and truncation.

/** Where search results cut text. Every number is an estimate. */
export const LIMITS = {
  title: {
    font: '20px sans-serif',
    desktop: { px: 580, lines: 1 },
    phone: { px: 340, lines: 2 },
    /** When text cannot be measured. */
    chars: 60,
  },
  description: {
    font: '14px sans-serif',
    desktop: { px: 920, lines: 1 },
    phone: { px: 680, lines: 1 },
    chars: 160,
  },
} as const;

export function measure(
  text: string,
  font: string,
  measurer: Measurer,
): number | null {
  try {
    const width = measurer ? measurer(text, font) : null;
    return width !== null && Number.isFinite(width) ? width : null;
  } catch {
    return null;
  }
}

/** The longest start of `text` that fits `px` with `suffix`, cut after a word when one fits. */
function fitting(
  text: string,
  px: number,
  font: string,
  measurer: Measurer,
  suffix: string,
): string {
  const fits = (part: string) =>
    (measure(part.trimEnd() + suffix, font, measurer) ?? 0) <= px;
  let end = 0;
  for (
    let next = text.indexOf(' ');
    next >= 0;
    next = text.indexOf(' ', next + 1)
  ) {
    if (!fits(text.slice(0, next))) {
      break;
    }
    end = next;
  }
  if (end > 0) {
    return text.slice(0, end);
  }
  // Not even the first word fits: cut inside it, never inside a character
  // drawn as one.
  const clusters = Array.from(graphemes.segment(text), ({ segment }) => segment);
  let count = clusters.length;
  while (count > 0 && !fits(clusters.slice(0, count).join(''))) {
    count--;
  }
  return clusters.slice(0, count).join('');
}

/**
 * `text` as a result would show it in `lines` lines of `px`: unchanged when it
 * fits (or cannot be measured), else cut at a word boundary with an ellipsis.
 */
export function truncate(
  text: string,
  px: number,
  font: string,
  measurer: Measurer,
  lines = 1,
): string {
  if (measure(text, font, measurer) === null) {
    return text;
  }
  const out: string[] = [];
  let rest = text;
  for (let line = 1; line <= lines; line++) {
    if ((measure(rest, font, measurer) ?? 0) <= px) {
      return [...out, rest].join(' ');
    }
    const last = line === lines;
    const head = fitting(rest, px, font, measurer, last ? '…' : '');
    out.push(last ? `${head.trimEnd()}…` : head);
    rest = rest.slice(head.length).trimStart();
  }
  return out.join(' ');
}

export interface Meter {
  state: 'empty' | 'fits' | 'long' | 'unmeasured';
  /** Code points of the resolved text. */
  chars: number;
  /** Fill of the rail, 0 to 1. */
  ratio: number;
  /** Which limit is exceeded; null unless `long`. */
  where: 'desktop' | 'phones' | 'both' | null;
  /** The last words that fit, for "may be cut off after …". */
  after: string;
  /** The visible sentence, also the meter's aria-valuetext. */
  sentence: string;
}

export function meter(
  kind: keyof typeof LIMITS,
  text: string,
  measurer: Measurer,
): Meter {
  const { font, desktop, phone } = LIMITS[kind];
  const chars = Array.from(text).length;
  const count = `${chars} ${chars === 1 ? 'character' : 'characters'}`;
  const base = { chars, ratio: 0, where: null, after: '' };
  if (text === '') {
    return {
      ...base,
      state: 'empty',
      sentence:
        kind === 'description'
          ? 'Empty · search engines will choose text from the page'
          : '',
    };
  }
  const width = measure(text, font, measurer);
  if (width === null) {
    return { ...base, state: 'unmeasured', sentence: count };
  }
  const ratio = Math.min(
    1,
    Math.max(
      width / (desktop.px * desktop.lines),
      width / (phone.px * phone.lines),
    ),
  );
  const cuts = {
    desktop: truncate(text, desktop.px, font, measurer, desktop.lines),
    phones: truncate(text, phone.px, font, measurer, phone.lines),
  };
  const long = (['desktop', 'phones'] as const).filter(
    (name) => cuts[name] !== text,
  );
  if (long.length === 0) {
    return { ...base, ratio, state: 'fits', sentence: `${count} · fits` };
  }
  const where = long.length === 2 ? 'both' : long[0];
  const cut =
    where === 'both'
      ? [cuts.desktop, cuts.phones].sort((a, b) => a.length - b.length)[0]
      : cuts[where];
  const after = cut.replace(/…$/, '').trim().split(' ').slice(-3).join(' ');
  return {
    chars,
    ratio: 1,
    state: 'long',
    where,
    after,
    sentence: `${count} · may be cut off${
      where === 'both' ? '' : where === 'desktop' ? ' on desktop' : ' on phones'
    } after "…${after}"`,
  };
}

/** Preview text at the phone limits; characters when text cannot be measured. */
export function previewText(
  kind: keyof typeof LIMITS,
  text: string,
  measurer: Measurer,
): string {
  const { font, phone, chars } = LIMITS[kind];
  if (measure(text, font, measurer) !== null) {
    return truncate(text, phone.px, font, measurer, phone.lines);
  }
  const points = Array.from(text);
  if (points.length <= chars) {
    return text;
  }
  const head = points.slice(0, chars).join('');
  const space = head.lastIndexOf(' ');
  return `${(space > 0 ? head.slice(0, space) : head).trimEnd()}…`;
}

// State.

const TABS: Record<Scope, Tab[]> = {
  target: ['search', 'social', 'schema', 'checks'],
  site: ['identity', 'defaults'],
};

const EMPTY_IDENTITY: Identity = {
  kind: 'organization',
  name: '',
  separator: '',
  logo: '',
  default_image: '',
  same_as: [],
};

export const initialState = (ctx: HostContext): State => ({
  phase: 'loading',
  ctx,
  server: null,
  scope: 'target',
  tab: 'search',
  tabs: { target: 'search', site: 'identity' },
  edits: { target: {}, site: { identity: EMPTY_IDENTITY, values: {} } },
  sent: null,
  siteDirty: false,
  save: { target: { phase: 'idle' }, site: { phase: 'idle' } },
  errors: { target: {}, site: {} },
  live: {},
  facts: null,
  readonly: 'no',
  offer: null,
  undo: null,
  flash: null,
});

/** What an absent directive means: the search engines' own defaults. */
const ABSENT: Record<string, unknown> = {
  'robots.noindex': false,
  'robots.nofollow': false,
  'robots.nosnippet': false,
  'robots.max_snippet': -1,
  'robots.max_image_preview': 'standard',
  'schema.type': 'WebPage',
};

/**
 * Leaves chosen with a toggle, a select or a picker: an override equal to the
 * inherited value is not stored, so the control keeps following its source.
 * Text is exempt: "Start from default" copies an inherited pattern in.
 */
const FOLLOWS = Object.keys(ABSENT).concat('social.image');

/** The layers below the target's own values. */
const below = (server: StatePayload): SeoValues =>
  server.target ? cascade(server.target.from_default, server.site.values) : {};

/** What a path of SeoValues shows when the working copy holds nothing for it. */
export function inherited(
  server: StatePayload,
  scope: Scope,
  path: string,
): unknown {
  return (
    (scope === 'target' ? getPath(below(server), path) : undefined) ??
    ABSENT[path]
  );
}

/** Prunes, and removes every followed leaf that equals what it would inherit. */
function settle(server: StatePayload, scope: Scope, values: SeoValues) {
  return prune(
    FOLLOWS.reduce(
      (out, path) =>
        getPath(out, path) === inherited(server, scope, path)
          ? setPath(out, path, undefined)
          : out,
      values,
    ),
  );
}

const without = (errors: Record<string, string>, paths: string[]) =>
  Object.fromEntries(
    Object.entries(errors).filter(
      ([key]) =>
        !paths.some((path) => key === path || key.startsWith(`${path}.`)),
    ),
  );

/** A working copy as it may be stored: settled, and with every identity key. */
function tidy<S extends Scope>(
  server: StatePayload,
  scope: S,
  copy: Edits[S],
): Edits[S] {
  if (scope === 'target') {
    return settle(server, scope, copy as SeoValues) as Edits[S];
  }
  const site = copy as SiteSettings;
  return {
    identity: { ...EMPTY_IDENTITY, ...site.identity },
    values: settle(server, scope, site.values ?? {}),
  } as Edits[S];
}

/** Puts a new working copy in place: the common end of edit, reset, apply and undo. */
function commit<S extends Scope>(
  state: State,
  scope: S,
  copy: Edits[S],
  undo: State['undo'],
): State {
  const server = state.server!;
  const changed = Object.keys(diff(state.edits[scope], copy));
  const next: State = {
    ...state,
    // The same object when nothing changed, so effects do not fire.
    edits: changed.length ? { ...state.edits, [scope]: copy } : state.edits,
    undo,
    errors: { ...state.errors, [scope]: without(state.errors[scope], changed) },
  };
  if (scope === 'site') {
    next.siteDirty = canon(next.edits.site) !== canon(server.site);
    next.save = { ...state.save, site: { phase: 'idle' } };
  } else if (changed.length) {
    next.save = { ...state.save, target: { phase: 'pending' } };
  }
  return next;
}

const withValue = <S extends Scope>(
  state: State,
  scope: S,
  path: string,
  value: unknown,
): Edits[S] =>
  tidy(state.server!, scope, setPath(state.edits[scope], path, value));

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      if (action.refresh) {
        // The same template: its values and the view stay. A save under way
        // is for the node being left, and is not waited for.
        return {
          ...state,
          phase: 'refreshing',
          ctx: action.ctx,
          save: { ...state.save, target: { phase: 'idle' } },
        };
      }
      return {
        ...state,
        phase: 'loading',
        ctx: action.ctx,
        edits: { ...state.edits, target: {} },
        sent: null,
        save: { ...state.save, target: { phase: 'idle' } },
        errors: { ...state.errors, target: {} },
        live: {},
        facts: null,
        readonly: 'no',
        offer: state.offer?.scope === 'site' ? state.offer : null,
        undo: null,
        flash: null,
      };

    case 'loaded': {
      const { payload } = action;
      // The target is selected first, also when arriving from a route without one.
      const scope: Scope = !payload.target
        ? 'site'
        : state.server?.target
          ? state.scope
          : 'target';
      // A change typed while another preview loaded is still to be sent.
      const kept = state.phase === 'refreshing' && unsent(state);
      return {
        ...state,
        phase: 'ready',
        ctx: action.ctx,
        server: payload,
        scope,
        tab: state.tabs[scope],
        edits: {
          target: kept ? state.edits.target : (payload.target?.values ?? {}),
          // Unsaved site edits survive the editor moving.
          site: state.siteDirty ? state.edits.site : payload.site,
        },
        sent: kept ? state.sent : null,
        save: {
          ...state.save,
          target: { phase: kept ? 'pending' : 'idle' },
        },
        readonly: action.readonly,
        flash: action.flash ?? null,
      };
    }

    case 'failed':
      return { ...state, phase: action.phase };

    case 'refreshed': {
      const { payload } = action;
      const mine = canon(state.edits.target);
      // The inputs follow the server only when nothing is unsent, and never
      // while a refused field holds text that exists nowhere else.
      const follow =
        Object.keys(state.errors.target).length === 0 &&
        (mine === state.sent ||
          mine === canon(state.server?.target?.values ?? {}));
      return {
        ...state,
        server: payload,
        // A conflict stays until the editor is reloaded.
        readonly: state.readonly === 'conflict' ? 'conflict' : action.readonly,
        edits: {
          target: follow ? (payload.target?.values ?? {}) : state.edits.target,
          site: state.siteDirty ? state.edits.site : payload.site,
        },
        sent: follow ? null : state.sent,
      };
    }

    case 'confirmed':
      return { ...state, server: action.payload, sent: action.sent };

    case 'edit': {
      if (!state.server) {
        return state;
      }
      const { scope, path } = action;
      let value =
        typeof action.value === 'string'
          ? wellFormed(action.value)
          : action.value;
      // Deleting one's words from a seeded page title returns to the inherited title.
      if (
        scope === 'target' &&
        path === 'title' &&
        state.ctx.kind === 'page' &&
        typeof value === 'string' &&
        value.trim() === seedTitle(below(state.server).title ?? '', '').trim()
      ) {
        value = undefined;
      }
      return commit(state, scope, withValue(state, scope, path, value), null);
    }

    case 'reset':
      return state.server
        ? commit(
            state,
            action.scope,
            withValue(state, action.scope, action.path, undefined),
            { text: 'Reset', edits: state.edits, path: action.path },
          )
        : state;

    case 'apply':
      return state.server
        ? commit(
            state,
            action.scope,
            tidy(state.server, action.scope, action.values as Edits[Scope]),
            action.undo
              ? { text: action.undo, edits: state.edits, path: action.path }
              : null,
          )
        : state;

    case 'undo': {
      if (!state.server || !state.undo) {
        return state;
      }
      const { target, site } = state.undo.edits;
      return commit(commit(state, 'target', target, null), 'site', site, null);
    }

    case 'discard':
      return state.server
        ? {
            ...state,
            edits: { ...state.edits, site: state.server.site },
            siteDirty: false,
            errors: { ...state.errors, site: {} },
            save: { ...state.save, site: { phase: 'idle' } },
            undo: { text: 'Discarded', edits: state.edits },
          }
        : state;

    case 'siteSaved':
      return {
        ...state,
        server: action.payload,
        // Saving never edits the fields; only edits made meanwhile are unsaved.
        siteDirty: canon(state.edits.site) !== action.sent,
        errors: { ...state.errors, site: {} },
        save: { ...state.save, site: { phase: 'saved' } },
        undo: null,
      };

    case 'scope':
      return action.scope === state.scope ||
        (action.scope === 'target' && !state.server?.target)
        ? state
        : {
            ...state,
            scope: action.scope,
            tab: state.tabs[action.scope],
            undo: null,
          };

    case 'tab':
      return TABS[state.scope].includes(action.tab)
        ? {
            ...state,
            tab: action.tab,
            tabs: { ...state.tabs, [state.scope]: action.tab },
          }
        : state;

    case 'save':
      return { ...state, save: { ...state.save, [action.scope]: action.save } };

    case 'errors':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.scope]: { ...state.errors[action.scope], ...action.fields },
        },
      };

    case 'live':
      return { ...state, live: action.live };

    case 'facts':
      return { ...state, facts: action.facts };

    case 'readonly':
      return { ...state, readonly: action.readonly };

    case 'offer':
      return { ...state, offer: action.offer };

    case 'flash':
      return { ...state, flash: action.flash };
  }
}

/** Target edits the server has not confirmed. */
export const unsent = (state: State): boolean => {
  const mine = canon(state.edits.target);
  return (
    mine !== state.sent && mine !== canon(state.server?.target?.values ?? {})
  );
};

/**
 * The robots settings are not yet what the server's output describes; other
 * unsent fields leave its robots tag true, so typing elsewhere moves nothing.
 */
export const robotsUnsent = (state: State): boolean => {
  const robots = (values?: SeoValues | null) => canon(values?.robots ?? {});
  const mine = robots(state.edits.target);
  return (
    (state.sent === null || mine !== robots(JSON.parse(state.sent))) &&
    mine !== robots(state.server?.target?.values)
  );
};

// Derived values: computed with useMemo, never stored.

export interface View {
  /** Token map with Canvas's live, not yet saved title and description laid over it. */
  tokens: Record<string, TokenInfo>;
  /** The flat map name => value that fill() and texts() take. */
  values: Record<string, string>;
  effective: SeoValues;
  texts: Texts;
  source(path: string): Source;
  /** noindex is effective, by our layers or by a configuration override. */
  hidden: boolean;
  /** `config`: only the server's output says so. */
  hiddenBy: Source | 'config' | null;
}

const serverTexts = (payload: StatePayload): Texts | null => {
  const head = payload.resolved?.head;
  if (!head) {
    return null;
  }
  const meta = (key: string, name: string) =>
    head.meta.find((row) => row[key] === name)?.content ?? '';
  return {
    title: head.title,
    description: meta('name', 'description'),
    social_title: meta('property', 'og:title'),
    social_description: meta('property', 'og:description'),
  };
};

/** The target scope as the dialog shows it. Null until the first state. */
export function view(state: State): View | null {
  const server = state.server;
  if (!server) {
    return null;
  }
  const tokens = { ...server.tokens };
  for (const name of ['title', 'description'] as const) {
    const live = state.live[name];
    if (tokens[name] && live !== undefined) {
      tokens[name] = { ...tokens[name], value: live };
    }
  }
  const values = Object.fromEntries(
    Object.entries(tokens).map(([name, token]) => [name, token.value]),
  );
  const layers = {
    target: state.edits.target,
    from_default: server.target?.from_default ?? {},
    site: server.site.values,
  };
  const effective = cascade(
    merge(layers.from_default, layers.target),
    layers.site,
  );
  let shown = texts(effective, values);
  // Once nothing is unsent and Canvas's inputs are what the server saw, the
  // server's text is the truth.
  const resolved = serverTexts(server);
  const settled =
    !unsent(state) &&
    (['title', 'description'] as const).every(
      (name) => tokens[name]?.value === server.tokens[name]?.value,
    );
  if (resolved && settled) {
    if (
      process.env.NODE_ENV !== 'production' &&
      JSON.stringify(resolved) !== JSON.stringify(shown)
    ) {
      console.warn('canvas_metatag: client and server text differ', {
        client: shown,
        server: resolved,
      });
    }
    shown = resolved;
  }
  const robots = server.resolved?.head.meta.find(
    (row) => row.name === 'robots',
  )?.content;
  const noindex = effective.robots?.noindex === true;
  // The server's robots tag describes the working copy only once its robots
  // settings are sent.
  const byConfig =
    !noindex && !robotsUnsent(state) && /(^|,\s*)noindex\b/.test(robots ?? '');
  const from = (path: string) => source(path, layers);
  return {
    tokens,
    values,
    effective,
    texts: shown,
    source: from,
    hidden: noindex || byConfig,
    hiddenBy: noindex ? from('robots.noindex') : byConfig ? 'config' : null,
  };
}

// The write procedure (one call at a time).

export interface DraftIO {
  /** The working copy, read fresh. */
  edits(): SeoValues;
  /** The last server-confirmed values, read fresh. */
  server(): SeoValues;
  /** Paths the server refused and the user has not edited since, read fresh. */
  refused(): string[];
  /** No layout request in flight. */
  whenIdle(): Promise<void>;
  /** Null: the editor cannot vouch for a write. */
  token(): EditorToken | null;
  /** Throws ApiError. */
  put(values: SeoValues, token: EditorToken): Promise<{ values: SeoValues }>;
  /** No editor request ran for `ms`. */
  quiet(ms: number): Promise<void>;
  /** Throws ApiError. */
  getState(): Promise<StatePayload>;
  refuse(fields: Record<string, string>): void;
  /** Our write is in the draft: replace the server truth, never the inputs. */
  confirmed(state: StatePayload, sent: string): void;
}

/** `failed`: the change could not be stored in the draft after five tries. */
export type DraftResult = 'done' | 'readonly' | 'failed' | ApiError;

/**
 * What is sent: the working copy, with every refused path put back to its
 * last confirmed value. A refused field never deletes a saved one.
 */
export const draftPayload = (
  wanted: SeoValues,
  server: SeoValues,
  refused: string[],
): SeoValues =>
  prune(
    refused.reduce(
      (values, path) => setPath(values, path, getPath(server, path)),
      wanted,
    ),
  );

const asApiError = (error: unknown) =>
  error instanceof ApiError
    ? error
    : new ApiError('network', 'The server did not answer.');

/**
 * The measured loss-free sequence: wait for the editor to be idle, write,
 * wait for quiet, read back, and go again when an editor save overwrote ours.
 */
export async function saveDraft(io: DraftIO): Promise<DraftResult> {
  // A refusal that names new paths is retried without counting as an attempt;
  // the cap only guards against a server that never stops naming new ones.
  let refusals = 0;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wanted = prune(io.edits());
    const payload = draftPayload(wanted, io.server(), io.refused());
    await io.whenIdle();
    const token = io.token();
    if (!token) {
      return 'readonly';
    }
    let stored: { values: SeoValues };
    try {
      stored = await io.put(payload, token);
    } catch (error) {
      const known = io.refused();
      if (
        error instanceof ApiError &&
        error.code === 'invalid' &&
        Object.keys(error.fields).some((path) => !known.includes(path)) &&
        ++refusals <= 20
      ) {
        io.refuse(error.fields);
        attempt--;
        continue;
      }
      return asApiError(error);
    }
    await io.quiet(250);
    let state: StatePayload;
    try {
      state = await io.getState();
    } catch (error) {
      return asApiError(error);
    }
    if (canon(state.target?.values ?? {}) !== canon(stored.values)) {
      // An editor save overwrote ours.
      continue;
    }
    const sent = canon(wanted);
    io.confirmed(state, sent);
    if (canon(io.edits()) === sent) {
      return 'done';
    }
    // Newer edits arrived while saving: go again with them.
    attempt = 0;
  }
  return 'failed';
}

// Never losing typed text, without replaying stale text.

/** Leaf differences as dotted path => new value; null = removed. Lists are leaves. */
export function diff(
  base: unknown,
  now: unknown,
  prefix = '',
): Record<string, unknown> {
  const from = isObj(base) ? base : {};
  const to = isObj(now) ? now : {};
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const [a, b] = [pruned(from[key]), pruned(to[key])];
    if (isObj(a) || isObj(b)) {
      Object.assign(out, diff(a, b, `${prefix}${key}.`));
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[`${prefix}${key}`] = b ?? null;
    }
  }
  return out;
}

export const applyChanges = <T>(
  values: T,
  changes: Record<string, unknown>,
): T =>
  Object.entries(changes).reduce(
    (out, [path, value]) => setPath(out, path, value ?? undefined),
    values,
  );

export const pendingKey = (key: string) => `canvas_metatag:pending:${key}`;

/** A stored entry, or null when it is missing or not one of ours. */
export function readPending(raw: string | null): Pending | null {
  try {
    const entry = JSON.parse(raw ?? 'null');
    return typeof entry?.uid === 'string' &&
      typeof entry.base === 'string' &&
      isObj(JSON.parse(entry.base)) &&
      isObj(entry.changes)
      ? { uid: entry.uid, base: entry.base, changes: entry.changes }
      : null;
  } catch {
    return null;
  }
}

/**
 * The entry for a working copy: its changes against the server values they
 * were first made against. Null when there is nothing to keep. With `only`,
 * the entry is limited to those paths (after a confirmed write: the refused
 * ones, whose typed text exists nowhere else).
 */
export function pendingFor(
  previous: Pending | null,
  uid: string | null,
  server: unknown,
  edits: unknown,
  only?: string[],
): Pending | null {
  const base = previous?.base ?? canon(server);
  const changes = Object.fromEntries(
    Object.entries(diff(JSON.parse(base), edits)).filter(
      ([path]) => !only || only.includes(path),
    ),
  );
  return Object.keys(changes).length
    ? { uid: previous?.uid ?? uid ?? '', base, changes }
    : null;
}

/**
 * What to do with an entry found on open: `drop` (the change is already
 * there), `restore` (same user, same values as it was made against) or
 * `offer` (anything else: write nothing, ask).
 */
export function openPending(
  entry: Pending,
  uid: string | null,
  server: unknown,
): 'drop' | 'restore' | 'offer' {
  if (canon(applyChanges(server, entry.changes)) === canon(server)) {
    return 'drop';
  }
  return uid !== null && entry.uid === uid && canon(server) === entry.base
    ? 'restore'
    : 'offer';
}

// Where fields live and what they are called.

/** The tab that holds a field, by its dotted path within the scope. */
export function tabOf(scope: Scope, path: string): Tab {
  if (scope === 'site') {
    return /^identity\.(kind|name|logo|same_as)/.test(path)
      ? 'identity'
      : 'defaults';
  }
  return path.startsWith('social.')
    ? 'social'
    : path.startsWith('schema.')
      ? 'schema'
      : 'search';
}

const LABELS: [RegExp, string][] = [
  [/^title$/, 'Title'],
  [/^values\.title$/, 'Title pattern'],
  [/^description$/, 'Description'],
  [/^canonical$/, 'Canonical address'],
  [/^social\.title$/, 'Social title'],
  [/^social\.description$/, 'Social description'],
  [/^social\.image$/, 'Image'],
  [/^(values\.)?robots\./, 'Search visibility'],
  [/^schema\.type$/, 'Page type'],
  [/^schema\.custom$/, 'Custom JSON-LD'],
  [/^schema\./, 'Structured data'],
  [/^identity\.kind$/, 'This site represents'],
  [/^identity\.name$/, 'Name'],
  [/^identity\.separator$/, 'Title separator'],
  [/^identity\.logo$/, 'Logo'],
  [/^identity\.default_image$/, 'Default image'],
  [/^identity\.same_as/, 'Profiles elsewhere'],
];

/** The field names of a set of paths, for "An earlier change wasn't saved: Title, Image". */
export const fieldNames = (paths: string[]): string[] => [
  ...new Set(
    paths.map(
      (path) => LABELS.find(([pattern]) => pattern.test(path))?.[1] ?? path,
    ),
  ),
];

/** Error paths of PUT /site, as paths into the site working copy. */
export const sitePaths = (fields: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(fields).map(([path, message]) => [
      path.startsWith('identity.') ? path : `values.${path}`,
      message,
    ]),
  );

/**
 * What a preview's caption adds after its name, and its ⓘ text, from what is
 * not published: the previewed node (template scope) or the target. One "not"
 * at a time in the caption: the node's, else the template's.
 */
export function previewNote(note: {
  template: boolean;
  /** The target, a page or a template, is published (in use). */
  published: boolean;
  /** At template scope, the previewed node is published. */
  node: boolean;
  label: string;
  /** Hidden from search: the caption says so too. */
  hidden?: boolean;
}): { suffix: string | null; unpublished: string; info: string } {
  const type = inSentence(note.label);
  const draftNode = note.template && !note.node;
  const unpublished = draftNode
    ? `This ${type} isn't published yet. Values that only editors can see are left out.${
        note.published ? '' : ' The template is not in use yet.'
      }`
    : '';
  const estimate =
    'This preview is an estimate; search engines sometimes rewrite titles and descriptions.';
  // Whatever the caption adds is said here too: a narrow caption leaves it out.
  return {
    suffix:
      draftNode || !note.published
        ? note.template && !draftNode
          ? 'Template not in use yet'
          : 'Not published yet'
        : null,
    unpublished,
    info: [
      draftNode
        ? unpublished
        : note.published
          ? ''
          : note.template
            ? 'The template is not in use yet.'
            : "This page isn't published yet.",
      note.hidden ? 'It is hidden from search engines.' : '',
      estimate,
      note.template && !draftNode
        ? `Switch the previewed ${type} with the preview picker in the top bar.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

// Footer and strips: what the shell says, as data.

/**
 * The smallest image most link previews show as a large card: 600 px wide,
 * and as tall as the card hint's own minimum. The head's card hint uses the
 * same rule (Resolver::LARGE_CARD).
 */
const LARGE_CARD = { width: 600, height: 157 } as const;

/** What an image is short of for a large card ("600 px wide"); '' if nothing. */
const shortOf = (width: number, height: number) =>
  width < LARGE_CARD.width
    ? `${LARGE_CARD.width} px wide`
    : height < LARGE_CARD.height
      ? `${LARGE_CARD.height} px tall`
      : '';

/** Why the link preview draws a small card; '' for a large one. */
export function smallCard(image: { width: number; height: number } | null) {
  if (!image) {
    return 'Small card: no image';
  }
  const short = shortOf(image.width, image.height);
  return short && `Small card: image under ${short}`;
}

/** The least an image needs for a large card ("at least 600 px wide"); '' when it has it. */
export function largeCardNeeds(width: number, height: number) {
  const short = shortOf(width, height);
  return short && `at least ${short}`;
}

/**
 * A file size as the 5 MB rule counts it (1 MB = 1024 × 1024 bytes):
 * "10.2 MB", "840 KB".
 */
export function fileSize(bytes: number): string {
  const kb = Math.max(1, Math.round(bytes / 1024));
  return kb < 1024
    ? `${kb} KB`
    : `${(bytes / 1048576).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** Half of a character drawn with two UTF-16 units. */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Text cut inside a character (half an emoji pasted) cannot be sent as JSON:
 * the half becomes the replacement character, which can.
 */
export const wellFormed = (text: string) =>
  text.replace(LONE_SURROGATE, '\uFFFD');

/** "1200 × 630", never broken across lines. */
export const dimensions = (width: number, height: number) =>
  `${width} × ${height}`;

/** "1770 × 996 · 249 KB", the weight when the server knows it. */
export const imageSize = (image: {
  width: number;
  height: number;
  bytes?: number;
}) =>
  `${dimensions(image.width, image.height)}${
    image.bytes ? ` · ${fileSize(image.bytes)}` : ''
  }`;

/**
 * A change is on its way to the server, or its output is being read back:
 * what the server resolved is about to change.
 */
export const catchingUp = (state: State) =>
  state.save.target.phase === 'pending' ||
  state.save.target.phase === 'saving' ||
  state.save.site.phase === 'saving';

export type FooterAction =
  'output' | 'undo' | 'goto' | 'retry' | 'discard' | 'save' | 'hide';

export interface Footer {
  dot: 'gray' | 'blue' | 'spinner' | 'ok' | 'error' | 'info' | 'warn';
  text: string;
  actions: FooterAction[];
}

const attention = (count: number) =>
  `${count} ${count === 1 ? 'field needs' : 'fields need'} attention`;

export function footer(state: State): Footer {
  const server = state.server;
  if (state.phase !== 'ready' || !server) {
    return { dot: 'gray', text: '', actions: [] };
  }
  if (state.flash) {
    return { dot: 'info', text: state.flash, actions: [] };
  }
  const save = state.save[state.scope];
  const refused = Object.keys(state.errors[state.scope]).length;
  // Reset shows its own Undo, in the field's source line.
  const undo = state.undo && state.undo.text !== 'Reset' ? state.undo : null;

  if (state.scope === 'site') {
    const dirty: FooterAction[] = state.siteDirty ? ['discard', 'save'] : [];
    if (save.phase === 'saving') {
      return { dot: 'spinner', text: 'Saving…', actions: [] };
    }
    if (refused) {
      return {
        dot: 'error',
        text: attention(refused),
        actions: ['goto', ...dirty],
      };
    }
    if (save.phase === 'error') {
      return { dot: 'error', text: save.message ?? '', actions: ['retry'] };
    }
    if (state.siteDirty) {
      return state.edits.site.values.robots?.noindex === true &&
        server.site.values.robots?.noindex !== true
        ? {
            dot: 'warn',
            text: 'This asks search engines to drop every page.',
            actions: ['discard', 'hide'],
          }
        : {
            dot: 'blue',
            text: 'Unsaved changes · not live yet',
            actions: dirty,
          };
    }
    if (undo) {
      return { dot: 'gray', text: undo.text, actions: ['undo'] };
    }
    return save.phase === 'saved'
      ? { dot: 'ok', text: 'Saved · live now', actions: [] }
      : { dot: 'gray', text: 'Live site settings', actions: [] };
  }

  const target = server.target;
  if (!target) {
    return { dot: 'gray', text: '', actions: [] };
  }
  const what = target.scope === 'page' ? 'page' : 'template';
  if (save.phase === 'pending' || save.phase === 'saving') {
    return { dot: 'spinner', text: 'Saving…', actions: [] };
  }
  if (refused) {
    return {
      dot: 'error',
      // Refused again for the same fields: that write stored nothing.
      text: `${attention(refused)} · ${
        save.phase === 'error' ? 'other changes not saved' : 'other changes saved'
      }`,
      actions: ['goto'],
    };
  }
  if (save.phase === 'error') {
    return { dot: 'error', text: save.message ?? '', actions: ['retry'] };
  }
  if (undo) {
    return { dot: 'ok', text: undo.text, actions: ['undo'] };
  }
  if (save.phase === 'saved') {
    return { dot: 'ok', text: 'Saved to draft', actions: [] };
  }
  if (state.readonly !== 'no') {
    return {
      dot: 'gray',
      text: 'Read-only',
      actions: state.readonly === 'empty' ? [] : ['output'],
    };
  }
  if (target.has_draft) {
    const name = (langcode: string) => server.languages[langcode] ?? langcode;
    return {
      dot: 'blue',
      text:
        target.default_langcode && target.default_langcode !== server.langcode
          ? `Draft of the ${name(server.langcode)} version · goes live with the ${name(target.default_langcode)} version`
          : `Draft · goes live when you publish the ${what}`,
      actions: ['output'],
    };
  }
  return {
    dot: 'gray',
    text: target.published
      ? `Matches the published ${what}`
      : what === 'page'
        ? "Not published yet · search engines can't see this page"
        : 'Template not published yet · not in use',
    actions: ['output'],
  };
}

/**
 * The message for a load that edits something else: another page or another
 * language, also under the same title, never another node in a template's
 * preview (the caption names that one). Identity is the draft's key.
 */
export function nowEditing(
  was: StatePayload['target'] | undefined,
  next: StatePayload['target'],
): string | undefined {
  if (!next || next.auto_save_key === was?.auto_save_key) {
    return undefined;
  }
  return `Now editing ${next.scope === 'page' ? next.label : `Every ${next.label}`}`;
}

/**
 * Whether no other read-only state has been seen since the last load: a
 * 'store' state still fresh came with the load, one reached later (on a
 * save) did not.
 */
export const freshStore = (
  fresh: boolean,
  phase: State['phase'],
  readonly: State['readonly'],
): boolean => (phase !== 'ready' ? true : readonly !== 'store' ? false : fresh);

/**
 * Whether the editor's 'store' state is a draft on its way, which the dialog
 * holds back for up to 2 s: one that came with the load, never a language
 * mismatch between the editor and the server, which is known at load.
 */
export const holdsStore = (
  phase: State['phase'],
  readonly: State['readonly'],
  fresh: boolean,
  mismatch: boolean,
): boolean => phase === 'ready' && readonly === 'store' && fresh && !mismatch;

/**
 * The Site view's line for site administrators when AI suggestions are off.
 * The SEO settings permission does not open the status report, which names
 * what is missing and links to where to fix it.
 */
export const aiOffText = (reason: AiOffReason | null): string =>
  `AI suggestions are off: ${
    {
      not_usable: "the AI provider isn't ready to use.",
      no_prompt: 'a suggestion prompt is empty or missing.',
      no_provider: 'no AI provider is set up.',
    }[reason ?? 'no_provider']
  } Site administrators can see how to fix it in the status report.`;

/** Said by every control that asks for a suggestion. */
export const AI_SENDS = "Sends this page's text to the AI service.";

const ADMIN = 'Ask a site administrator.';
const AI_ERRORS: Record<string, string> = {
  ai_not_configured: "AI suggestions aren't set up on this site yet.",
  quota_exceeded: `The site's AI allowance is used up. ${ADMIN}`,
  rate_limited: 'The AI service is busy. Wait a minute, then try again.',
  invalid_response: "The AI answer couldn't be used.",
  // Drupal's own access check: an expired session or a lost permission.
  forbidden:
    'Your session or permissions changed. Reload the editor and try again.',
};
const BLOCKED = "The site's AI rules stopped this request.";

/**
 * The suggestion tray's sentence for a failed request, by error code, and
 * whether asking again can help. A guardrail stop can be steered round only
 * by other Refine text: the page text is not changed in the tray.
 */
export const aiError = (
  code: string | null,
  refined = false,
): { text: string; retry: boolean } =>
  code === 'blocked'
    ? {
        text: refined
          ? `${BLOCKED} Try different wording in Refine, or ask a site administrator.`
          : `${BLOCKED} ${ADMIN}`,
        retry: refined,
      }
    : {
        text:
          (code !== null && AI_ERRORS[code]) ||
          "The AI service didn't answer.",
        retry: !['ai_not_configured', 'quota_exceeded', 'forbidden'].includes(
          code ?? '',
        ),
      };

export const MESSAGES = {
  failed: "Couldn't save · your changes are kept here",
  unstored: 'This change could not be stored in the draft',
  signedOut:
    "You've been signed out. Sign in again in another tab, then try again.",
  restored: "Restored a change that hadn't been saved",
} as const;

export interface Strip {
  id: 'conflict' | 'store' | 'hidden' | 'offer';
  tone: 'amber' | 'blue';
  /** Strips that need action interrupt; the others are polite. */
  role: 'alert' | 'status';
  text: string;
  actions: ('reload' | 'show' | 'drop' | 'use')[];
}

/**
 * The exceptional states between the tabs and the scroll area: at most two,
 * in priority order. `mismatch`: the editor and the server name different
 * languages.
 */
export function strips(
  state: State,
  shown: View | null,
  mismatch: boolean,
): Strip[] {
  const target = state.server?.target;
  const out: Strip[] = [];
  if (state.phase !== 'ready' || !state.server) {
    return out;
  }
  if (state.scope === 'target' && target) {
    const what = target.scope === 'page' ? 'page' : 'template';
    if (state.readonly === 'conflict') {
      out.push({
        id: 'conflict',
        tone: 'amber',
        role: 'alert',
        text: `This ${what} was changed somewhere else. What you typed is kept.`,
        actions: ['reload'],
      });
    }
    if (state.readonly === 'store') {
      out.push({
        id: 'store',
        tone: 'amber',
        role: 'alert',
        text: `SEO can't save to this ${what} right now. Site settings still work.${
          mismatch
            ? ' The editor and the server disagree about the language being edited.'
            : ''
        }`,
        actions: ['reload'],
      });
    }
    if (shown?.hidden) {
      const name = state.server.languages[target.default_langcode ?? ''];
      const by = {
        target:
          what === 'page'
            ? 'set on this page'
            : `set for every ${target.label}`,
        default: `set on the ${name ?? 'default-language'} version`,
        site: 'set for the whole site',
        config: 'set in site configuration outside SEO',
        fallback: '',
      }[shown.hiddenBy ?? 'fallback'];
      out.push({
        id: 'hidden',
        tone: 'amber',
        role: 'status',
        text: `Hidden from search engines${by && ` · ${by}`}`,
        actions:
          shown.hiddenBy === 'target' && state.readonly === 'no'
            ? ['show']
            : [],
      });
    }
  }
  if (state.offer?.scope === state.scope) {
    out.push({
      id: 'offer',
      tone: 'blue',
      role: 'status',
      text: `An earlier change wasn't saved: ${fieldNames(
        Object.keys(state.offer.pending.changes),
      ).join(', ')}`,
      actions: ['drop', 'use'],
    });
  }
  return out.slice(0, 2);
}

// Chips in the editor: the text holds {Label}; a chip is one unit.

export interface Chip {
  /** Offsets in the display text; `end` is after the closing brace. */
  start: number;
  end: number;
  name: string;
  label: string;
}

/** The chips of a display text: brace text that names a known value by its label. */
export function chipsIn(text: string, tokens: Labelled): Chip[] {
  const names = Object.fromEntries(
    Object.entries(displayLabels(tokens)).map(([name, label]) => [label, name]),
  );
  return Array.from(text.matchAll(/\{([^{}]*)\}/g)).flatMap((match) =>
    Object.hasOwn(names, match[1])
      ? [
          {
            start: match.index,
            end: match.index + match[0].length,
            name: names[match[1]],
            label: match[1],
          },
        ]
      : [],
  );
}

/** A selection grown so that it never ends inside a chip. A caret stays where it is. */
export function wholeChips(
  chips: Chip[],
  start: number,
  end: number,
): [number, number] {
  if (start === end) {
    return [start, end];
  }
  for (const chip of chips) {
    if (start > chip.start && start < chip.end) {
      start = chip.start;
    }
    if (end > chip.start && end < chip.end) {
      end = chip.end;
    }
  }
  return [start, end];
}

/**
 * Backspace or Delete next to or inside a chip removes the whole chip. Null
 * when the key does what it always does.
 */
export function removeChip(
  text: string,
  chips: Chip[],
  caret: number,
  key: 'Backspace' | 'Delete',
): { text: string; caret: number; label: string } | null {
  const chip = chips.find((item) =>
    key === 'Backspace'
      ? caret > item.start && caret <= item.end
      : caret >= item.start && caret < item.end,
  );
  if (!chip) {
    return null;
  }
  // One of the spaces around it goes too, so no double space is left behind.
  // A last chip leaves its space: the next word typed must not run into the
  // chip before it (resolved texts are trimmed, so it never reaches output).
  const before = text.slice(0, chip.start);
  const after = text.slice(chip.end);
  const joined =
    before.endsWith(' ') && after.startsWith(' ')
      ? before.slice(0, -1)
      : before;
  return { text: joined + after, caret: joined.length, label: chip.label };
}

/**
 * Puts a chip in at the caret (never inside another chip). `brace`: the menu
 * was opened by typing "{", which the chip replaces. From the button, the chip
 * is set off from the words around it by spaces.
 */
export function insertChip(
  text: string,
  chips: Chip[],
  caret: number,
  label: string,
  brace: boolean,
): { text: string; caret: number } {
  const inside = chips.find((chip) => caret > chip.start && caret < chip.end);
  let before = text.slice(0, inside ? inside.end : caret);
  const after = text.slice(before.length);
  if (brace && before.endsWith('{')) {
    before = before.slice(0, -1);
  } else if (!brace && before !== '' && !/\s$/.test(before)) {
    before += ' ';
  }
  const chip = `{${label}}${after !== '' && !/^\s/.test(after) ? ' ' : ''}`;
  return { text: before + chip + after, caret: before.length + chip.length };
}

/** Where the caret belongs after seedTitle(): behind what was typed. */
export function seedCaret(
  pattern: string,
  typed: string,
  tokens: Labelled,
): number {
  const at = pattern.indexOf('{title}');
  return (
    (at < 0 ? 0 : toDisplay(pattern.slice(0, at), tokens).length) + typed.length
  );
}

/** The values a text template may use, grouped for the insert menu. */
export function tokenGroups(
  tokens: Record<string, TokenInfo>,
  fields: boolean,
): { label: string; names: string[] }[] {
  const text = Object.keys(tokens).filter(
    (name) => tokens[name].type !== 'image',
  );
  const site = ['site', 'sep'];
  const field = (name: string) => name.startsWith('field.');
  return [
    {
      label: 'PAGE',
      names: text.filter((name) => !field(name) && !site.includes(name)),
    },
    { label: 'SITE', names: text.filter((name) => site.includes(name)) },
    { label: 'FIELDS', names: fields ? text.filter(field) : [] },
  ].filter((group) => group.names.length > 0);
}

// What the previews and rows say.

/** A public address as a result shows it: host › segment › segment. */
export function breadcrumb(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    const parts = pathname.split('/').filter(Boolean);
    return [
      host,
      ...parts.map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      }),
    ].join(' › ');
  } catch {
    return url;
  }
}

/** An ISO date or date-time in words, as written: the time is the site's own. */
export function dateText(value: string): string {
  const match = value.match(/^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/);
  if (!match) {
    return value;
  }
  const [, year, month, day, hour, minute] = match;
  const date = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(+year, +month - 1, +day)));
  return hour ? `${date}, ${hour}:${minute}` : date;
}

/** "a" or "an" for a type's label. */
export const article = (label: string) =>
  /^[aeiou]/i.test(label) ? 'an' : 'a'; // cspell:disable-line

export interface ShownImage {
  name: string;
  thumb: string;
  width: number;
  height: number;
  /** The file itself, when the server has said where it is. */
  url?: string;
  bytes?: number;
}

/**
 * The social image as the working copy has it, without waiting for the
 * server: the image, and the words for where it comes from. `picked` holds
 * what the picker returned for images chosen in this session.
 */
export function socialImage(
  state: State,
  shown: View,
  picked: Record<string, ShownImage>,
): { image: ShownImage | null; from: string } {
  const server = state.server!;
  const value = shown.effective.social?.image;
  const resolved = server.resolved?.image ?? null;
  // The server's answer describes the working copy once nothing is unsent.
  const settled = !unsent(state);
  const token = value?.match(/^\{(.+)\}$/)?.[1];
  if (
    value &&
    !token &&
    settled &&
    server.resolved &&
    resolved?.source !== 'override'
  ) {
    // Chosen, but the server cannot emit it (not public, unpublished, gone):
    // what is shown is what search engines and networks get instead.
    return {
      image: resolved,
      from: `The chosen image can't be shown publicly · ${
        resolved?.source === 'site'
          ? 'using the site default'
          : resolved
            ? 'using the page image'
            : 'no image'
      }`,
    };
  }
  if (value && !token) {
    return {
      image:
        settled && resolved?.source === 'override'
          ? resolved
          : (picked[value] ?? server.media[value] ?? null),
      from:
        shown.source('social.image') === 'default'
          ? `From the ${
              server.languages[server.target?.default_langcode ?? ''] ??
              'default-language'
            } version`
          : 'Chosen here',
    };
  }
  const info = shown.tokens[token ?? 'image'];
  if (info?.image) {
    return {
      image: info.image,
      from:
        token && token !== 'image'
          ? `From ${info.label}`
          : 'From the page image',
    };
  }
  const site =
    settled && resolved?.source === 'site'
      ? resolved
      : (picked[server.site.identity.default_image] ??
        server.media[server.site.identity.default_image] ??
        null);
  return site
    ? { image: site, from: 'Site default' }
    : { image: null, from: 'No image' };
}

/** The Site working copy resolved for the page in context: what "Becomes:" shows there. */
export function siteTexts(state: State, shown: View): Texts {
  const { identity, values } = state.edits.site;
  return texts(cascade({}, values), {
    ...shown.values,
    // As the server stores it.
    sep: identity.separator.trim(),
    ...(identity.name.trim() ? { site: identity.name } : {}),
  });
}
