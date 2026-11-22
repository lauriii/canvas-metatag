/**
 * The sheet's decisions that need no screen: where Back goes, what added
 * details do, where a value can point, moving a described item to its own,
 * the words of a shape and the fix that gives an item for a name.
 *
 * Pure, so that custom-sheet.test.ts, ref-menu.test.ts and item-list.test.ts
 * pin them.
 */
import { kinds } from '../features';
import type { ExpectsSpec, SearchFeatures, Verdict } from '../types';
import { mint } from './clean';
import { append, items as itemsOf, pretty, rawItems, set, swap, value as parse, type Path } from './doc';
import { aType, detailLabel, sentence, typeLabel, typesOf, type Item } from './project';
import { detailsOf, type Vocabulary } from './vocab';

export const isObject = (value: unknown): value is Item => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The value at a path of decoded JSON: lists and objects alike. */
export function valueAt(data: unknown, path: Path): unknown {
  let at = data;
  for (const part of path) {
    if (Array.isArray(at) && typeof part === 'number') at = at[part];
    else if (isObject(at) && typeof part === 'string' && Object.prototype.hasOwnProperty.call(at, part)) at = at[part];
    else return undefined;
  }
  return at;
}

export type Level =
  | { kind: 'list' }
  | { kind: 'search'; change?: number }
  | { kind: 'item'; item: number }
  | { kind: 'review' };

/**
 * The header's Back, named for where it goes. In JSON, Back leaves the
 * sheet; a sheet opened at its type search from another sheet goes back to
 * it (`entry`: "What this page is").
 */
export function backLabel(level: Level['kind'], count: number, ctx: { node?: string; from?: string; siteDirty?: boolean; json?: boolean; entry?: string } = {}): string {
  // Leaving the review cancels the paste: named for where it goes.
  if (level === 'review') return count > 1 ? 'Back to all items' : count === 1 ? 'Back to your item' : 'Back';
  if (!ctx.json && !ctx.entry && !ctx.node && level === 'item' && count > 1) return 'Back to all items';
  if (!ctx.json && !ctx.entry && !ctx.node && level === 'search' && count > 0) return count > 1 ? 'Back to all items' : 'Back to your item';
  if (ctx.entry) return `Back to ${ctx.entry}`;
  if (ctx.from) return ctx.node === '#identity' && ctx.siteDirty ? 'Back to Site settings' : 'Back to Output';
  return 'Back';
}

/** What added details add and where the page's values win, as the server merges. */
export function mergeWords(node: Item | undefined, added: unknown, labelOf: (path: string) => string): { adds: string[]; clashes: { path: string; from: string; leaf: boolean }[]; unmatched: string[] } {
  const adds: string[] = [];
  const clashes: { path: string; from: string; leaf: boolean }[] = [];
  const unmatched: string[] = [];
  const object = (value: unknown): value is Item => isObject(value) && !(Object.keys(value).length === 1 && '@id' in value);
  const walk = (own: Item | undefined, more: Item, path: string[]) => {
    for (const [key, value] of Object.entries(more)) {
      if (key.startsWith('@')) continue;
      const at = [...path, key].join('.');
      const selector = /^(.+)\[(\*|name=(.+))\]$/.exec(key);
      if (selector) {
        const list = own?.[selector[1]];
        const entries = Array.isArray(list) ? list : object(list) ? [list] : [];
        if (entries.some((one) => object(one) && (selector[2] === '*' || one.name === selector[3]))) adds.push(at);
        else unmatched.push(at);
        continue;
      }
      if (!own || !(key in own)) {
        adds.push(at);
      } else if (object(own[key]) && object(value)) {
        walk(own[key] as Item, value, [...path, key]);
      } else if (JSON.stringify(own[key]) !== JSON.stringify(value)) {
        clashes.push({ path: at, from: labelOf(at), leaf: !object(value) });
      }
    }
  };
  if (isObject(added)) walk(node, added, []);
  return { adds, clashes, unmatched };
}

/** The item types a shape names. */
const itemTypes = (spec: ExpectsSpec | ''): string[] =>
  spec === '' ? [] : kinds(typeof spec === 'string' ? spec : spec.is).filter(([kind]) => kind === 'item').flatMap(([, names]) => names);

/** "an organization", "a person or organization". */
export function describeShape(spec: ExpectsSpec): string {
  const words = (itemTypes(spec).length ? itemTypes(spec) : ['item']).map((name) => name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
  return `${/^[aeiou]/.test(words[0]) ? 'an' : 'a'} ${words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}` : words[0]}`;
}

/** A need of another shape, in words: "Needs item reviewed as an organization". */
export function shapeNeed(verdict: Verdict, rules: SearchFeatures): string | null {
  const first = verdict.missing?.[0];
  if (verdict.verdict !== 'needs' || !first?.expects) return null;
  const label = rules.facts[first.path]?.label ?? detailLabel(first.path.split('.').pop()!, rules);
  return `Needs ${label.toLowerCase()} as ${describeShape(first.expects)}`;
}

/** The first item type a shape names: what "Describe it here" makes. */
export function itemTypeOf(spec: ExpectsSpec | ''): string {
  const first = itemTypes(spec)[0];
  return first && first !== 'Thing' ? first : 'Thing';
}

/**
 * A fix for a name where an item is needed: "Make it a person" writes
 * {"@type": "Person", "name": "Mia Virtanen"}.
 */
export function asItem(verdict: Verdict, item: Item): { label: string; path: string[]; value: Item } | null {
  const first = verdict.missing?.find((one) => one.expects && typeof valueAt(item, one.path.split('.')) === 'string');
  if (!first?.expects) return null;
  const path = first.path.split('.');
  const value = valueAt(item, path);
  const type = itemTypeOf(first.expects);
  if (typeof value !== 'string' || value.trim() === '' || type === 'Thing') return null;
  const words = type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return { label: `Make it ${/^[aeiou]/.test(words) ? 'an' : 'a'} ${words}`, path, value: { '@type': type, name: value } };
}

/** Where an item value can point: the site's own items, this page, other items. */
export interface Target {
  /** The value written: a short id. */
  id: string;
  label: string;
  types: string[];
  /** Why it cannot be chosen. */
  disabled?: string;
  /** Described inside another item: choosing it moves it to its own item. */
  nested?: Path;
}

/**
 * The reference menu's choices: the site, this page, its main thing (shown
 * disabled with its reason when it is left out), the other items, and items
 * described inside them.
 */
export function targetsOf(ctx: {
  modules: Map<string, Item>;
  label(short: string, node: Item | undefined): string;
  /** The main thing is left out on this page; its type then. */
  withheld: string[] | null;
  list: Item[];
  /** Where each item is in the text. */
  pathOf(index: number): Path;
  rules: SearchFeatures;
}): Target[] {
  const found: Target[] = [];
  for (const short of ['#identity', '#webpage', '#primary']) {
    const node = ctx.modules.get(short);
    if (node) {
      found.push({ id: short, label: ctx.label(short, node), types: typesOf(node) });
    } else if (short === '#primary' && ctx.withheld) {
      found.push({ id: short, label: ctx.label(short, { '@type': ctx.withheld }), types: ctx.withheld, disabled: 'The main thing is left out on this page' });
    }
  }
  const find = (id: string) => ctx.list.find((one) => one['@id'] === id);
  ctx.list.forEach((item, index) => {
    if (typeof item['@id'] === 'string') found.push({ id: item['@id'], label: sentence(item, ctx.rules, find).replace(/\.$/, ''), types: typesOf(item) });
    for (const [key, value] of Object.entries(item)) {
      if (isObject(value) && typeof value.name === 'string' && typesOf(value).length && !value['@id']) {
        found.push({
          id: `nested:${index}:${key}`,
          label: `${value.name} (described in ${typeLabel(typesOf(item)[0] ?? 'Thing', ctx.rules)})`,
          types: typesOf(value),
          nested: [...ctx.pathOf(index), key],
        });
      }
    }
  });
  return found;
}

/**
 * A described item a second item points at becomes its own item: both point
 * at it by a new @id. Null when nothing is described there.
 */
export function hoistText(text: string, from: Path, to: Path, ctx: { moduleIds: string[]; rules: SearchFeatures }): { text: string; name: string } | null {
  const data = parse(text);
  const described = valueAt(data, from);
  if (!isObject(described)) return null;
  const list = itemsOf(data).filter(isObject);
  const taken = new Set(list.map((item) => item['@id']).filter((id): id is string => typeof id === 'string'));
  const id = mint(described, taken, ctx.moduleIds);
  let next = set(text, from, { '@id': id });
  next = set(next, to, { '@id': id });
  next = append(next, [pretty({ ...described, '@id': id })]);
  return { text: next, name: typeof described.name === 'string' && described.name ? described.name : typeLabel(typesOf(described)[0] ?? 'Thing', ctx.rules) };
}

/** The ids an item list already uses: a minted one never repeats them. */
export const takenIds = (list: Item[]) => new Set(list.map((item) => item['@id']).filter((id): id is string => typeof id === 'string'));

/** Typed text of items: what a copied translation marks "Translate this". */
export function typedPaths(data: unknown, at: Path = []): string[] {
  if (Array.isArray(data)) return data.flatMap((one, index) => typedPaths(one, [...at, index]));
  if (isObject(data)) return Object.entries(data).flatMap(([key, value]) => (key.startsWith('@') ? [] : typedPaths(value, [...at, key])));
  if (typeof data !== 'string' || data.trim() === '') return [];
  // Addresses, codes, dates, numbers and links stay as they are.
  if (/^(https?:|#|\{)/.test(data) || /^[\d\s.,:+\-TZ/]+$/.test(data) || /^[A-Z][a-zA-Z]+$/.test(data)) return [];
  return [at.join('/')];
}

/** The item list's tags of one item. */
export function listTags(item: Item, ctx: { main?: string; skip?: string[]; unsaved: boolean }): string[] {
  const id = typeof item['@id'] === 'string' ? item['@id'] : null;
  return [id && ctx.main === id ? 'Main' : null, id && ctx.skip?.includes(id) ? 'Left out' : null, ctx.unsaved ? 'Not saved' : null].filter((tag): tag is string => !!tag);
}

/** The line under the list: near the limits, or at the item limit. */
export function limitLine(count: number, size: number, max: number): string | null {
  if (count >= 10) return '10 items is the most one page can have. Remove one to add another.';
  if (count >= 8 || size > max * 0.8) return `${count} of 10 items · ${(size / 1024).toFixed(1)} KB of ${max / 1024} KB, including added details`;
  return null;
}

/**
 * A value of a list moved up or down as written; positions follow the new
 * order in the same step when every value has one.
 */
export function moveInText(text: string, path: Path, index: number, by: -1 | 1): string {
  let next = swap(text, path, index, index + by);
  const list = valueAt(parse(next), path);
  if (Array.isArray(list) && list.every((one) => isObject(one) && 'position' in one)) {
    list.forEach((_, at) => (next = set(next, [...path, at, 'position'], at + 1)));
  }
  return next;
}

/** A text of items as a list: one more appended, keeping the bytes of the rest. */
export const appendItem = (text: string, item: Item): string => append(text, [pretty(item)]);

/**
 * What committing the box does: a text with a red problem is kept as a
 * draft, never sent; an unchanged one does nothing; else it is saved.
 */
export const commitOf = (next: string, found: { tone: 'red' | 'amber' }[], stored: string): 'draft' | 'same' | 'store' =>
  found.some((one) => one.tone === 'red') ? 'draft' : next === stored ? 'same' : 'store';

/** The field a link names: "field.field_score.value" is "field_score". */
export const linkedField = (name: string): string => name.replace(/^field\./, '').split('.')[0];

/**
 * A hand-added value its link left empty for the item checked: "No Score
 * for this book review, so its rating is left out." `field` names a field
 * by its machine name; `node` a node of the module's by its short id ("the
 * product"), for a reference to one that is not output.
 */
export function emptyWords(entry: { path: string; name: string; status: string }, ctx: { field(name: string): string; thing: string; rules: SearchFeatures; node?(short: string): string }): string {
  const parts = entry.path.split('.').filter((part) => !/^\d+$/.test(part));
  // What goes: the object the value was in ("its rating"), else the value
  // itself ("its item reviewed").
  const what = parts.length > 1 ? detailLabel(parts[parts.length - 2], ctx.rules).toLowerCase().split(' ').pop()! : detailLabel(parts[0] ?? 'value', ctx.rules).toLowerCase();
  if (entry.status === 'absent') {
    const short = `#${entry.name.split('#').pop()}`;
    const named = ctx.node?.(short) ?? 'The item it points to';
    return `${named.charAt(0).toUpperCase()}${named.slice(1)} isn't output here, so its ${what} is left out.`;
  }
  const field = /^media\./.test(entry.name) ? 'The image' : ctx.field(linkedField(entry.name));
  switch (entry.status) {
    case 'hidden':
      return `${field} is hidden for this ${ctx.thing}, so its ${what} is left out.`;
    case 'gone':
      return `${field} is gone, so its ${what} is left out.`;
    case 'broken':
      return `${field} can't be read for this ${ctx.thing}, so its ${what} is left out.`;
    default:
      return `No ${field} for this ${ctx.thing}, so its ${what} is left out.`;
  }
}

/**
 * The details of an item its type doesn't expect: none of its own or its
 * parents' (with the vocabulary), and none a search feature for it names.
 * Empty without the vocabulary or for a type it doesn't know.
 */
export function unexpectedKeys(item: Item, type: string, rules: SearchFeatures, vocabulary: Vocabulary | null): string[] {
  if (!vocabulary?.types[type]) return [];
  const expected = new Set(detailsOf(vocabulary, [type]));
  for (const feature of Object.values(rules.features)) {
    if (!feature.on.includes(type)) continue;
    const paths = [...(feature.required ?? []), ...(feature.recommended ?? []), ...(feature.names ?? [])].flat().flatMap((path) => path.split('|'));
    for (const path of paths) expected.add(path.split('.')[0]);
  }
  return Object.keys(item).filter((key) => !key.startsWith('@') && !expected.has(key));
}

/** The bar after a type change: "2 details aren't expected on a rating. …" */
export function typeChangeWords(count: number, type: string, rules: SearchFeatures): string {
  return `${count} ${count === 1 ? "detail isn't" : "details aren't"} expected on ${aType(type, rules)}. ${count === 1 ? "It's" : "They're"} kept, and search features may ignore ${count === 1 ? 'it' : 'them'}.`;
}

/**
 * The text Undo clean-up puts back: the exact paste, as the whole text or
 * after the items there were, both as written. A paste that is not JSON is
 * added as written, so the text shows its problem.
 */
export function restorePaste(before: string, paste: string): string {
  const raw = paste.trim();
  if (before.trim() === '') return raw;
  return append(before, parse(raw) !== undefined ? rawItems(raw) : [raw]);
}

/** The items of a paste added after the text's own, as written (cleaned). */
export const appendPaste = (before: string, cleaned: string): string => (before.trim() === '' ? cleaned : append(before, rawItems(cleaned)));

/** The example in an empty Add details box, for the node's type. */
export function detailsExample(types: string[]): string {
  if (types.some((one) => /Product|Offer/.test(one))) return '{"sku": "…"}';
  if (types.some((one) => /Organization|LocalBusiness|Person/.test(one))) return '{"telephone": "…"}';
  if (types.some((one) => /Page$/.test(one))) return '{"keywords": "…"}';
  return '{"description": "…"}';
}
