// Pure logic: no DOM, no network, no host. Everything here runs in vitest's
// node environment. cascade(), plain() and texts() mirror the PHP class
// Values and are pinned to it by tests/fixtures/text-cases.json.
import currencyCodes from '../../data/currencies.json';
import { ApiError } from './api';
import type { EditorToken, HostContext } from './host';
import { durationText, groupLine, hoursLine, parseHours } from './controls';
import { dateWords } from './readback';
import { set as setJson, value as readJson } from './custom/doc';
import { MODULE_IDS } from './custom/validate';
import {
  type Form,
  inSentence,
  type Lookup,
  type ShownImage,
  rowOf,
  resolve,
  sameValue,
  textOf,
} from './values';
import type {
  Action,
  AiOffReason,
  Edits,
  Identity,
  Measurer,
  Pending,
  Registry,
  Resolved,
  Robots,
  SchemaProp,
  Scope,
  SchemaType,
  SearchFeatures,
  SeoValues,
  SiteSettings,
  Source,
  State,
  StatePayload,
  Tab,
  Texts,
  Value,
  Verdict,
} from './types';

export type { ShownImage } from './values';

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Whether a map is one value: typed text, a fact, a media item, a link or a composition. */
const isValue = (value: Obj) => {
  const keys = Object.keys(value);
  return keys.length === 1 && ['text', 'fact', 'media', 'source', 'parts'].includes(keys[0]);
};

// The type registry and the search features come with the state, in the
// dialog's language (ApiController::state()).

/** A registry type, or the web page for one the registry does not have. */
export const typeOf = (registry: Registry, id: string | undefined): SchemaType =>
  (id !== undefined && registry[id]) || registry.WebPage;

/** The type whose kind a type is: itself, or the one it is a variant of. */
export const kindOfType = (registry: Registry, id: string | undefined): string => {
  const type = id !== undefined && registry[id] ? id : 'WebPage';
  return registry[type].variant_of ?? type;
};

/** "Euro · EUR", in the dialog's language: a symbol can stand for several. */
export function currencyName(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
    return name === code ? code : `${name.charAt(0).toUpperCase()}${name.slice(1)} · ${code}`;
  } catch {
    return code;
  }
}

const currencyLists = new Map<string, (readonly [string, string])[]>();

/** Every currency a price may be in, by its name in the dialog's language. */
export function currencyOptions(locale: string): (readonly [string, string])[] {
  let list = currencyLists.get(locale);
  if (!list) {
    list = (currencyCodes as string[])
      .map((code) => [code, currencyName(code, locale)] as const)
      .sort((a, b) => a[1].localeCompare(b[1], locale));
    currencyLists.set(locale, list);
  }
  return list;
}

/**
 * The currencies to choose from: those in use here, then the most common,
 * then every other by name.
 */
export function currencyChoices(locale: string, inUse: (string | undefined)[]) {
  const all = currencyOptions(locale);
  const first = [...new Set([...inUse, 'EUR', 'USD', 'GBP'])];
  const common = first.flatMap((code) => all.filter(([one]) => one === code));
  return { common, rest: all.filter((one) => !common.includes(one)) };
}

/** The kinds, in their order; on a scope, those it offers. */
export const kinds = (registry: Registry, scope?: 'page' | 'template'): string[] =>
  Object.keys(registry)
    .filter((id) => registry[id].kind && !(scope && registry[id].scopes?.[scope]))
    .sort((a, b) => registry[a].kind!.order - registry[b].kind!.order);

/** Whether a type, or one of its details, is offered on a scope. As SchemaGraph::offered(). */
export function offered(registry: Registry, type: string, key: string | null, scope: 'page' | 'template'): boolean {
  const entry = registry[type];
  if (!entry || entry.scopes?.[scope]) {
    return false;
  }
  if (key === null) {
    return true;
  }
  const prop = entry.props?.find((one) => one.key === key);
  return !!prop && !prop.scopes?.[scope];
}

/** "Merchant listing", or the feature id when the rules have none. */
export const featureLabel = (rules: SearchFeatures, feature: string | null) =>
  feature === null ? '' : (rules.features[feature]?.label ?? feature);

/**
 * The stage's feature lines: the server's verdicts in their order, then,
 * when the main node has no feature of its own, "No search feature" last.
 * A verdict on the page node (a profile's) is the main node's. At most four.
 */
export function stageVerdicts(report: Resolved['schema'] | undefined, main: string, page: string): Verdict[] {
  const features = report?.features ?? [];
  const none =
    !!report?.nodes.some((node) => node.origin === 'main') &&
    !features.some((one) => one.node === main || one.node === page) &&
    features[0]?.verdict !== 'none';
  return [...features, ...(none ? [{ feature: null, node: main, verdict: 'none' as const }] : [])].slice(0, 4);
}

/** "In stock" for the option "InStock": its words, capitalized. */
export const optionText = (prop: SchemaProp, option: string) => {
  const words = prop.option_labels?.[option] ?? option;
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The details a change of kind removes, said with their values. */
export function removed(server: StatePayload, values: SeoValues, to: string, locale: string): string[] {
  // Added details keep everything but a type list that no longer fits.
  const stray = strayTypes(server, values, to, values.schema?.props ?? {});
  return [...removedProps(server, values, to, locale), ...(stray ? [`the added ${stray.types.length === 1 ? 'type' : 'types'} (${stray.types.join(', ')})`] : [])];
}

function removedProps(server: StatePayload, values: SeoValues, to: string, locale: string): string[] {
  const registry = server.registry;
  const from = typeOf(registry, values.schema?.type ?? String(inherited(server, 'target', 'schema.type')));
  const next = typeOf(registry, to).props ?? [];
  const props = values.schema?.props ?? {};
  // In the order the form shows them: the facts shown first, then the rest.
  const order = [...(from.main ?? []), ...(from.props ?? []).map((prop) => prop.key)];
  // A part of a group is where its group is.
  const at = (key: string) => {
    const found = [key, from.props?.find((one) => one.key === key)?.group].map((one) => (one ? order.indexOf(one) : -1)).filter((index) => index >= 0);
    return found.length ? Math.min(...found) : order.length;
  };
  const gone = Object.keys(props)
    // "Someone else" not named yet is said by its name, if any: never as an
    // empty value of its own.
    .filter((key) => !next.some((prop) => prop.key === key) && !(props[key] && 'text' in props[key] && props[key].text.trim() === ''))
    .sort((a, b) => at(a) - at(b));
  // A value as the dialog reads it: a country by its name.
  const words = (prop: SchemaProp | undefined, value: Value | undefined) => {
    if (!value || !('text' in value)) {
      return '';
    }
    if (prop?.codes === 'country') {
      const names = new Intl.DisplayNames([locale], { type: 'region' });
      return value.text.split(',').map((code) => { try { return names.of(code) ?? code; } catch { return code; } }).join(', ');
    }
    // A duration as its box reads it: "1 h 30 min".
    if (prop?.unit && /^\d+$/.test(value.text)) {
      return durationText(value.text);
    }
    return prop?.kind === 'enum' ? (prop.option_labels?.[value.text] ?? value.text) : value.text;
  };
  // A group is said once, as its box reads: "the address (Rantakatu 1, Helsinki, Finland)".
  const groups = new Set<string>();
  return gone
    .filter((key) => !(key === 'offers_priceCurrency' && gone.includes('offers_price')))
    .flatMap((key) => {
      const prop = from.props?.find((one) => one.key === key);
      const top = prop?.group;
      const group = top ? from.groups?.[top] : undefined;
      if (top && group && group.shape !== 'who') {
        if (groups.has(top)) {
          return [];
        }
        groups.add(top);
        const line = groupLine(top, group, (part) => words(from.props?.find((one) => one.key === part), props[part]), locale);
        return [`the ${(group.label ?? group.shape).toLowerCase()}${line ? ` (${line})` : ''}`];
      }
      return [key];
    })
    .map((key) => {
      if (key.startsWith('the ')) {
        return key;
      }
      const prop = from.props?.find((one) => one.key === key);
      const value = props[key];
      // A question is named by what it asks; a detail by its name.
      const label = NOUNS[key] ?? `the ${(prop?.label ?? key).toLowerCase()}`;
      if (!value || !('text' in value)) {
        return label;
      }
      const currency = props.offers_priceCurrency;
      const shown =
        // A draft that is not a number yet is said as typed.
        key === 'offers_price' && currency && 'text' in currency && value.text.trim() !== '' && Number.isFinite(Number(value.text))
          ? new Intl.NumberFormat(locale, { style: 'currency', currency: currency.text, minimumFractionDigits: 0 }).format(Number(value.text))
          : prop?.kind === 'enum' || prop?.unit
            ? words(prop, value)
            : prop?.kind === 'date'
              ? (dateWords(value.text, locale) ?? value.text)
              : prop?.kind === 'hours'
                ? (() => {
                    const week = parseHours(value.text);
                    return week ? hoursLine(week) : value.text;
                  })()
                : value.text;
      // Never parentheses in parentheses: "(a venue, not a business)".
      return `${label} (${shown.replace(/\s*\(([^()]*)\)/g, ', $1')})`;
    });
}

/**
 * "a, b and c". The copy is English, so the list is too, in the dialog's
 * date style: no comma before "and".
 */
export const andList = (items: string[]) => new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(items);

/** The kinds sheet's confirm: what a change of kind removes (removed()). */
export const changeKindText = (name: string, lost: string[]) =>
  lost.length
    ? `Changing to ${name} removes ${andList(lost)} you set. Undo brings ${lost.length === 1 ? 'it' : 'them'} back.`
    : `Change this page to ${name}.`;

/** The AI tray's confirm, for a proposed kind that removes details. */
export const proposalLossText = (lost: string[]) => `Using this removes ${andList(lost)} you set.`;

/** Details whose label is not a noun, as a sentence names them. */
const NOUNS: Record<string, string> = {
  billing: 'the billing',
  startDate: 'the start',
  endDate: 'the end',
  datePublished: 'the publication date',
  dateModified: 'the update date',
  sold_here: 'the answer to “Bought on this page”',
};

/**
 * The type the main thing is output with, as Values::nodeTypes() decides
 * it: a kind of place chosen, else the registry's.
 */
function primaryType(server: StatePayload, type: string, props: Record<string, Value | undefined>): string {
  const entry = typeOf(server.registry, type);
  let primary = entry.primary_type ?? 'Thing';
  for (const prop of entry.props ?? []) {
    const own = props[prop.key];
    const text = prop.emit === 'type' ? (own && 'text' in own ? own.text : prop.default && 'text' in prop.default ? prop.default.text : null) : null;
    if (typeof text === 'string' && prop.options?.includes(text)) primary = text;
  }
  return primary;
}

/**
 * Added details whose added @type list no longer keeps the main thing's
 * type: the details stay, the list goes (as the server reads them). Null
 * when nothing changes.
 */
function strayTypes(server: StatePayload, values: SeoValues, to: string, props: Record<string, Value | undefined>): { text: string; types: string[] } | null {
  const text = values.schema?.extend?.['#primary'];
  const data = text ? readJson(text) : undefined;
  if (!text || data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const types = (data as Record<string, unknown>)['@type'];
  const list = (Array.isArray(types) ? types : [types]).filter((one): one is string => typeof one === 'string');
  if (!list.length || list.includes(primaryType(server, to, props))) return null;
  return { text: setJson(text, ['@type'], undefined), types: list };
}

/** The values with another kind: the details the new one has are kept. */
export function withKind(server: StatePayload, values: SeoValues, to: string, errors: Record<string, string> = {}): SeoValues {
  const next = typeOf(server.registry, to).props ?? [];
  const schema = values.schema ?? {};
  // A value the server refused is not carried into the new kind.
  const props = Object.fromEntries(Object.entries(schema.props ?? {}).filter(([key]) => next.some((prop) => prop.key === key) && errors[`schema.props.${key}`] === undefined));
  const stray = strayTypes(server, values, to, props);
  return {
    ...values,
    schema: {
      ...schema,
      type: to,
      props,
      ...(stray && { extend: { ...schema.extend, '#primary': stray.text.trim() === '{}' ? undefined : stray.text } }),
    },
  };
}

/**
 * Leaves out a hand-added item until it is on the page.
 *
 * The report's entry names the item: by its `@id` (`base` is the page's own
 * address, which a "#local" id is relative to), or, without one, by its
 * place and type. NULL when the JSON-LD no longer holds it, as after an
 * unsent edit. An item without an `@id` is given one first (`#‹type›`,
 * unique on the page), so that it can be listed: `given` names it.
 */
export function leaveOut(
  values: SeoValues,
  entry: { item?: number; id: string | null; type: string },
  base: string,
): { values: SeoValues; id: string; given: boolean } | null {
  let data: unknown;
  try {
    data = JSON.parse(values.schema?.custom ?? '');
  } catch {
    return null;
  }
  const list = Array.isArray(data) ? [...data] : [data];
  const written = (one: unknown) =>
    isObj(one) && typeof one['@id'] === 'string' ? (one['@id'].startsWith('#') ? base + one['@id'] : one['@id']) : null;
  const item =
    entry.id !== null
      ? list.findIndex((one) => written(one) === entry.id)
      : isObj(list[entry.item ?? -1]) && written(list[entry.item!]) === null && (list[entry.item!] as Record<string, unknown>)['@type'] === entry.type
        ? entry.item!
        : -1;
  const node = list[item];
  if (!isObj(node)) {
    return null;
  }
  let id = typeof node['@id'] === 'string' ? node['@id'] : '';
  const given = id === '';
  if (given) {
    const base = `#${String(node['@type'] ?? 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const taken = new Set(list.map((one) => (isObj(one) ? one['@id'] : null)));
    // Never one of the site's own ids, never one another item has.
    const reserved = MODULE_IDS.map((name) => `#${name}`);
    id = base;
    for (let n = 2; taken.has(id) || reserved.includes(id); n++) {
      id = `${base}-${n}`;
    }
    list[item] = { '@id': id, ...node };
  }
  const schema = values.schema ?? {};
  return {
    values: {
      ...values,
      schema: {
        ...schema,
        custom: given
          ? JSON.stringify(Array.isArray(data) ? list : list[0])
          : schema.custom,
        skip: [...new Set([...(schema.skip ?? []), id])],
      },
    },
    id,
    given,
  };
}

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

function pruned(value: unknown, key?: string): unknown {
  // The empty values that are stored: "No ending", and "Someone else" not
  // named yet (an organizer or author on a Canvas page; Values::canon()).
  if ((key === 'title_end' || key === 'organizer' || key === 'author') && isObj(value) && value.text === '' && Object.keys(value).length === 1) {
    return value;
  }
  // A composition is canonical as fold() leaves it: a space between two
  // fields is a part of its own (Values::canon()).
  if (key === 'parts' && Array.isArray(value) && value.length) {
    return value;
  }
  if (Array.isArray(value)) {
    const list = value.map((item) => pruned(item)).filter((item) => item !== undefined);
    return list.length ? list : undefined;
  }
  if (isObj(value)) {
    const entries = Object.entries(value)
      .map(([name, item]) => [name, pruned(item, name)] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (typeof value === 'string') {
    return value.trim() === '' ? undefined : value;
  }
  return value ?? undefined;
}

/** Drops empty maps, empty lists and strings that are empty or only whitespace; keeps "No ending". */
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
 * The effective values. The site layer supplies the title ending and robots
 * directives only; everything else comes from the target.
 */
export function cascade(target: SeoValues, site: SeoValues): SeoValues {
  const out: SeoValues = { ...target };
  if (out.title_end === undefined && site.title_end !== undefined) {
    out.title_end = site.title_end;
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
  // A directive and the title ending follow Site whether or not the site
  // stores them: the control there is what changes them.
  return path.startsWith('robots.') || path === 'title_end'
    ? 'site'
    : 'fallback';
}

// Text outputs.

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

export { inSentence };

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

/**
 * The four text outputs, and the two parts of the title. As Values::texts():
 * a value that is not set, or gives nothing for the item, gives its default.
 * `text` gives what a value gives for the item, '' for none.
 */
export function texts(
  effective: SeoValues,
  /**
   * What a value gives in a form (`line` for the title's main part and the
   * social title, `words` for the descriptions, `text` for the ending); a
   * composition its segments.
   */
  text: (value: Value, form: Form) => string | string[],
  separator: string,
  siteEnd?: Value,
): Texts {
  const segments = (own: Value | undefined, fallback: Value | null, form: Form): string[] => {
    const out = own ? [text(own, form)].flat() : [];
    return plain(out.join(''), Infinity) !== '' || !fallback ? out : [text(fallback, form)].flat();
  };
  // A composition over its room loses whole fields from its end, with the
  // words that go with them, before words: none of its words dangle.
  const fit = (parts: string[], room: number) => {
    while (parts.length > 1 && Array.from(plain(parts.join(''), Infinity)).length > room) {
      parts = parts.slice(0, -1);
    }
    return parts.join('');
  };
  const value = (own: Value | undefined, fallback: Value | null, max: number, form: Form) =>
    cut(fit(segments(own, fallback, form), max), max);
  // The main part keeps its segments: a cut drops whole fields first.
  const parts = segments(effective.title, { fact: 'title' }, 'line');
  // Without an ending of its own, or with one that gives nothing for the
  // item, the site's; without one there, the site name. "No ending" is the
  // empty typed ending.
  const siteEnding = siteEnd ?? { fact: 'site' };
  const ending = effective.title_end ?? siteEnding;
  const end =
    'text' in ending && ending.text === '' ? '' : value(ending, siteEnding, 255, 'text');
  // Over 255 characters the main part loses whole fields from its end, then
  // words; the ending stays whole.
  const glue = ` ${plain(separator, 3)} `;
  const full = plain(parts.join(''), Infinity);
  const room = end === '' || full === '' ? 255 : 255 - Array.from(glue).length - Array.from(end).length;
  const main = room > 0 ? cut(fit(parts, room), Math.min(255, room)) : '';
  const title = main === '' || end === '' ? main + end : main + glue + end;
  const description = value(
    effective.description,
    { fact: 'description' },
    1000,
    'words',
  );
  return {
    title: title || value({ fact: 'site' }, null, 255, 'text'),
    description,
    social_title: value(effective.social?.title, { fact: 'title' }, 255, 'line'),
    social_description:
      value(effective.social?.description, null, 1000, 'words') || description,
    title_main: main,
    title_end: end,
  };
}

/** What an empty description means on a headless site, everywhere the dialog says it. */
export const NO_DESCRIPTION_SENT = 'No description sent. The frontend decides what to show.';

/**
 * What the search preview, the link preview's card and the focused field
 * say for an empty description. On a headless site the frontend decides
 * what to show, so no place claims what search engines pick.
 */
export const emptyDescription = (place: 'search' | 'card' | 'field', headless: boolean): string =>
  headless
    ? NO_DESCRIPTION_SENT
    : { search: 'Search engines will pick text from the page.', card: '', field: 'Empty. Search engines will pick text from the page.' }[place];

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
  /** How much of the text is shown, in UTF-16 code units; all of it unless `long`. */
  shown: number;
}

export function meter(
  kind: keyof typeof LIMITS,
  text: string,
  measurer: Measurer,
): Meter {
  const { font, desktop, phone } = LIMITS[kind];
  const chars = Array.from(text).length;
  const base = { chars, ratio: 0, where: null, after: '', shown: text.length };
  if (text === '') {
    return { ...base, state: 'empty' };
  }
  const width = measure(text, font, measurer);
  if (width === null) {
    return { ...base, state: 'unmeasured' };
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
    return { ...base, ratio, state: 'fits' };
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
    shown: cut.replace(/…$/, '').trimEnd().length,
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
  edits: { target: {}, site: { identity: EMPTY_IDENTITY, values: {}, currency: '' } },
  effect: null,
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
  // No ending of its own anywhere: the site name.
  title_end: { fact: 'site' },
};

/**
 * Leaves chosen with a toggle, a select, a picker or the ending's menu: an
 * override equal to the inherited value is not stored, so the control keeps
 * following its source. Other values are exempt: a link to a field's default
 * source is stored, and typed text is the editor's own.
 */
const FOLLOWS = Object.keys(ABSENT).concat('social.image');

/** Equal as stored values: maps compared whatever their key order. */
const same = (a: unknown, b: unknown) =>
  JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

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
        same(getPath(out, path), inherited(server, scope, path))
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
    currency: site.currency ?? '',
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

/**
 * The Undo that stays when the target moves on (another previewed node, a
 * publish): one that would change the target's values goes.
 */
const undoKept = (state: State): State['undo'] =>
  state.undo && canon(state.undo.edits.target) !== canon(state.edits.target)
    ? null
    : state.undo;

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
          undo: undoKept(state),
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
        // Published (or discarded) meanwhile: an Undo would change what is
        // now live.
        undo:
          state.server?.target?.has_draft && !payload.target?.has_draft
            ? undoKept(state)
            : state.undo,
      };
    }

    case 'confirmed':
      return { ...state, server: action.payload, sent: action.sent };

    case 'edit': {
      if (!state.server) {
        return state;
      }
      const { scope, path } = action;
      const value =
        typeof action.value === 'string'
          ? wellFormed(action.value)
          : isObj(action.value) && typeof action.value.text === 'string'
            ? { text: wellFormed(action.value.text) }
            : action.value;
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

    case 'forgetUndo':
      return state.undo?.text === action.text ? { ...state, undo: null } : state;

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
            effect: null,
            errors: { ...state.errors, site: {} },
            save: { ...state.save, site: { phase: 'idle' } },
            undo: { text: 'Discarded', edits: state.edits },
          }
        : state;

    case 'effect':
      return { ...state, effect: action.effect };

    case 'siteSaved':
      return {
        ...state,
        server: action.payload,
        effect: null,
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
        ...(action.places && { places: { ...state.places, ...action.places } }),
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
  /** The facts, with Canvas's live, not yet saved title and description laid over them. */
  facts: StatePayload['facts'];
  /** What values are resolved against. */
  lookup: Lookup;
  /** The text a value gives for the previewed item in a form; a composition's segments. */
  text(value: Value, form?: Form): string | string[];
  effective: SeoValues;
  texts: Texts;
  source(path: string): Source;
  /** noindex is effective, by our layers or by a configuration override. */
  hidden: boolean;
  /** `config`: only the server's output says so. */
  hiddenBy: Source | 'config' | null;
}

const serverTexts = (payload: StatePayload, own: Texts): Texts | null => {
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
    // The parts are the dialog's own: the server's title is made of them.
    title_main: own.title_main,
    title_end: own.title_end,
  };
};

/** The values the dialog resolves against, from a state. */
export function lookupOf(
  server: StatePayload,
  facts: StatePayload['facts'] = server.facts,
  picked: Record<string, ShownImage> = {},
): Lookup {
  return {
    facts,
    sources: server.sources,
    broken: server.broken,
    media: { ...server.media, ...picked },
    resolvable: !!server.preview,
  };
}

/** The target scope as the dialog shows it. Null until the first state. */
export function view(
  state: State,
  picked: Record<string, ShownImage> = {},
): View | null {
  const server = state.server;
  if (!server) {
    return null;
  }
  const facts = { ...server.facts };
  for (const name of ['title', 'description'] as const) {
    const live = state.live[name];
    if (facts[name] && live !== undefined) {
      facts[name] = { ...facts[name], value: live };
    }
  }
  const lookup = lookupOf(server, facts, picked);
  const text = textOf(lookup);
  const layers = {
    target: state.edits.target,
    from_default: server.target?.from_default ?? {},
    site: server.site.values,
  };
  const effective = cascade(
    merge(layers.from_default, layers.target),
    layers.site,
  );
  let shown = texts(
    effective,
    text,
    server.separator,
    server.site.values.title_end,
  );
  // Once nothing is unsent and Canvas's inputs are what the server saw, the
  // server's text is the truth.
  const resolved = serverTexts(server, shown);
  const settled =
    !unsent(state) &&
    (['title', 'description'] as const).every(
      (name) => facts[name]?.value === server.facts[name]?.value,
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
    facts,
    lookup,
    text,
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
  refuse(fields: Record<string, string>, places?: Record<string, { item: number; path: string }>): void;
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
        io.refuse(error.fields, error.places);
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
    const [a, b] = [pruned(from[key], key), pruned(to[key], key)];
    // A value (typed text, a fact, a media item, a link) is one leaf.
    if ((isObj(a) && !isValue(a)) || (isObj(b) && !isValue(b))) {
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
 * ones) and to what was typed, which exists nowhere else: a refused link,
 * fact or image can be picked again, and kept it would be sent again on every
 * opening.
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
      ([path, value]) =>
        !only ||
        (only.includes(path) &&
          // A link, fact or image can be picked again; typed words, alone or
          // in a composition, exist nowhere else.
          !(isObj(value) && isValue(value) && !('text' in value) && !('parts' in value))),
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
  [/^(values\.)?title_end$/, 'Title ending'],
  [/^description$/, 'Description'],
  [/^canonical$/, 'Canonical address'],
  [/^social\.title$/, 'Social title'],
  [/^social\.description$/, 'Social description'],
  [/^social\.image$/, 'Image'],
  [/^(values\.)?robots\./, 'Search visibility'],
  [/^schema\.type$/, 'Page type'],
  [/^schema\.custom$/, 'Your own JSON-LD'],
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
export const sitePaths = <T,>(fields: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.entries(fields).map(([path, message]) => [
      path.startsWith('identity.') || path === 'currency' ? path : `values.${path}`,
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
    ? `This ${type} isn't published yet. Its fields are read with your access until visitors can see it.${
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
  /** A button's own label, in place of its usual one. */
  labels?: Partial<Record<FooterAction, string>>;
}

/** "Oak desk lamp, Membership and 2 more" */
export const placesText = (effect: { count: number; places: string[] }) => {
  const named = effect.places.slice(0, 25);
  const more = effect.count - named.length;
  return more > 0
    ? `${named.join(', ')} and ${more} more`
    : named.join(', ').replace(/, ([^,]*)$/, ' and $1');
};

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
    if (state.siteDirty && state.effect && state.effect.count > 0) {
      // Where the save changes structured data, said before it does; the
      // Currency field names the places.
      const where = state.effect.count === 1 ? state.effect.places[0] : `${state.effect.count} places`;
      return {
        dot: 'blue',
        text: `Also changes ${where}.`,
        actions: dirty,
        labels: { save: `Save and update ${where}` },
      };
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
          : target.scope === 'template' && target.canvas_label
            ? // The dash of Canvas's label never starts a line.
              `Draft · listed under Unpublished changes as “${target.canvas_label.replace(/ (?=[—–])/gu, '\u00a0')}”`
            : `Draft · goes live when you publish the ${what}`,
      actions: ['output'],
    };
  }
  // What the dialog shows includes a draft around the page: a breadcrumb in
  // a page variant not published yet is not live either.
  const around = server.resolved?.schema.chrome_drafts ?? [];
  if (target.published && around.length) {
    return {
      dot: 'blue',
      text: `Includes unpublished changes to ${around.map((label) => `“${label}”`).join(' and ')} · live once ${around.length === 1 ? 'it is' : 'they are'} published`,
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

// What the previews and rows say.

/**
 * A public address as a result shows it, part by part: host, segment,
 * segment; with the page's breadcrumb trail, the host and its crumbs, less
 * the first when it is the home page (the host says it).
 */
export function breadcrumb(url: string, trail: string[] = [], fromHome = false): string[] {
  try {
    const { host, pathname } = new URL(url);
    if (trail.length > 1) {
      return [host, ...trail.slice(fromHome ? 1 : 0)];
    }
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
    ];
  } catch {
    return url ? [url] : [];
  }
}

/**
 * The addresses the previews show: the page's public address (Canvas's live
 * path while it differs from the saved one), the canonical search engines
 * are asked to show instead, and the link card's host. None at all while the
 * head carries no address (on a host visitors can't reach): Checks says why.
 */
export function shownAddresses(
  server: StatePayload,
  shown: Pick<View, 'facts' | 'effective'>,
  /** Canvas's live alias of a page. */
  alias: string | undefined,
): { address: string; elsewhere: string; host: string } {
  if (server.resolved?.schema.unaddressed) {
    return { address: '', elsewhere: '', host: '' };
  }
  const base = server.origin.url;
  const saved = shown.facts.url?.value || server.preview?.url || '';
  let path = '';
  try {
    path = new URL(saved).pathname;
  } catch {
    // No saved address: the live path is all there is.
  }
  let address: string;
  // The front page is the base itself, whatever its alias; an unchanged
  // alias keeps the saved address with its language prefix.
  if (!alias?.startsWith('/') || path === '/' || path.endsWith(alias)) {
    address = saved || (alias?.startsWith('/') ? base + alias : '');
  } else {
    const target = server.target;
    const prefix =
      target?.default_langcode &&
      server.langcode !== target.default_langcode &&
      path.startsWith(`/${server.langcode}/`)
        ? `/${server.langcode}`
        : '';
    address = base + prefix + alias;
  }
  // A canonical set here shows at once; a path is put on the public address.
  const canonical = shown.effective.canonical?.trim() ?? '';
  const elsewhere = canonical.startsWith('/') ? base + canonical : canonical;
  let host = '';
  try {
    host = new URL(base).host;
  } catch {
    // No public address: the card shows none.
  }
  return { address, elsewhere: elsewhere === address ? '' : elsewhere, host };
}

/** The search result's description, and whether it is a note rather than the text. */
export function resultDescription(
  description: string,
  robots: Robots | undefined,
  headless: boolean,
  measurer: Measurer,
): { text: string; muted: boolean } {
  if (robots?.nosnippet === true || robots?.max_snippet === 0) {
    return { text: 'No description: text previews are off', muted: true };
  }
  return description
    ? { text: previewText('description', description, measurer), muted: false }
    : { text: emptyDescription('search', headless), muted: true };
}

/**
 * What the Structured data view says in place of its read-back, '' for
 * nothing: while the head carries no address, no structured data is sent,
 * so there is nothing to read back and no search feature to earn.
 */
export const unsentSchema = (report: { unaddressed?: boolean } | undefined): string =>
  report?.unaddressed ? 'No structured data is sent: page addresses are left out.' : '';

/**
 * The search result preview's accessible name: what it shows, its
 * description or the sentence in its place ("Search engines will pick text
 * from the page."), as the link preview's name does.
 */
export function resultName(shown: {
  hidden: boolean;
  site: string;
  /** breadcrumb() of the address; none when the head has none. */
  crumbs: string[];
  title: string;
  description: { text: string; muted: boolean };
}): string {
  const where = [shown.site, shown.crumbs.join(', ')].filter(Boolean).join(', ');
  const { text, muted } = shown.description;
  const said = muted ? text.replace(/([^.!?])$/u, '$1.') : `Description: ${text}`;
  return `${shown.hidden ? 'Not shown in search results. ' : ''}Search result preview, estimate. ${where ? `${where}. ` : ''}Title: ${shown.title}. ${said}`;
}

/**
 * Beside the site's title example: the example is the site's pattern, and
 * the previewed item may end its title its own way ("Every Article sets its
 * own ending."); '' when it follows the site.
 */
export const ownEndingNote = (target: StatePayload['target'], source: Source): string =>
  !target || (source !== 'target' && source !== 'default')
    ? ''
    : target.scope === 'template'
      ? `Every ${target.label} sets its own ending.`
      : 'This page sets its own ending.';

/** An ISO date or date-time in words, as written: the time is the site's own. */
export const dateText = (value: string): string => dateWords(value, 'en') ?? value;

/** "a" or "an" for a type's label. */
export const article = (label: string) =>
  /^[aeiou]/i.test(label) ? 'an' : 'a'; // cspell:disable-line

/**
 * The social image as the working copy has it, without waiting for the
 * server: the image, the words for where it comes from, and the state of a
 * link that gives nothing for the previewed item.
 */
export function socialImage(
  state: State,
  shown: View,
): { image: ShownImage | null; from: string; state?: 'empty' | 'hidden' | 'broken' } {
  const server = state.server!;
  const value = shown.effective.social?.image;
  const resolved = server.resolved?.image ?? null;
  // The server's answer describes the working copy once nothing is unsent.
  const settled = !unsent(state);
  const site =
    settled && resolved?.source === 'site'
      ? resolved
      : (shown.lookup.media[server.site.identity.default_image] ?? null);
  const fallback = (): { image: ShownImage | null; from: string } => {
    const own = resolve({ fact: 'image' }, 'image', shown.lookup);
    if (own.image) {
      return { image: own.image, from: 'Image' };
    }
    return site
      ? { image: site, from: 'Site default image' }
      : { image: null, from: 'No image' };
  };
  if (value && 'media' in value) {
    if (settled && server.resolved && resolved?.source !== 'override') {
      // Chosen, but the server cannot emit it (not public, unpublished,
      // gone): what is shown is what is shared instead.
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
    return {
      image:
        settled && resolved?.source === 'override'
          ? resolved
          : (shown.lookup.media[value.media] ?? null),
      from:
        shown.source('social.image') === 'default'
          ? `From the ${
              server.languages[server.target?.default_langcode ?? ''] ??
              'default-language'
            } version`
          : 'Chosen here',
    };
  }
  if (value && 'source' in value) {
    const link = resolve(value, 'image', shown.lookup);
    if (link.image) {
      return { image: link.image, from: rowOf(shown.lookup, value)?.label ?? '' };
    }
    // Empty, hidden or broken for this item: the default is used.
    const instead = fallback();
    return {
      ...instead,
      state: link.status === 'hidden' || link.status === 'broken' ? link.status : 'empty',
    };
  }
  return fallback();
}

/** The Site working copy resolved for the page in context: what "Becomes:" shows there. */
export function siteTexts(state: State, shown: View): Texts {
  const { identity, values } = state.edits.site;
  const name = identity.name.trim();
  return texts(
    cascade({}, values),
    (value, form) =>
      name && 'fact' in value && value.fact === 'site' ? identity.name : shown.text(value, form),
    // As the server stores it.
    identity.separator.trim(),
    values.title_end,
  );
}

export { sameValue };

/** The most parts a group shows in place; one with more is a box that opens a sheet. */
export const IN_PLACE_PARTS = 3;

/**
 * The sheet a detail's field is in, when it is a part of a group shown as a
 * box: a jump to it opens that sheet, on the part. A nested group ("the
 * venue's address") is focused at its first part. Null for a detail shown
 * in place.
 */
export function sheetOf(registry: Registry, typeId: string, key: string, scope: 'page' | 'template'): { group: string; focus?: string } | null {
  const type = registry[typeId];
  const prop = type?.props?.find((one) => one.key === key);
  const nested = type?.groups?.[key];
  const { parent: owner } = nested ?? {};
  const group = prop?.group ?? owner ?? (nested ? key : undefined);
  if (!type || !group || type.groups?.[group]?.shape === 'who') {
    return null;
  }
  const parts = (type.props ?? []).filter((one) => one.group === group && offered(registry, typeId, one.key, scope));
  if (parts.length <= IN_PLACE_PARTS) {
    return null;
  }
  const focus = prop ? key : nested?.parts.find((part) => parts.some((one) => one.key === part));
  return { group, ...(focus && focus !== group && { focus }) };
}
