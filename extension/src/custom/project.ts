/**
 * What the form shows of one hand-added item: a projection of its text.
 *
 * Pure. Bands in order: what search features need (an empty row only here,
 * an either-or need as one group), every other value in the text's order,
 * values the type does not expect and names schema.org does not have (with
 * the downloaded vocabulary), then what also helps. Maps are built without a
 * prototype, so a "__proto__" key stays a row.
 */
import { specOf } from '../features';
import { article } from '../model';
import { dateWords } from '../readback';
import type { ExpectsSpec, SearchFeatures } from '../types';
import { ancestors, detailsOf, typeWith, type Vocabulary } from './vocab';

export type Item = Record<string, unknown>;

export interface RowSpec {
  /** The detail's name, a key of the item. */
  key: string;
  label: string;
  /** Needed by a search feature. */
  need: boolean;
  /** What its value must look like. */
  expects: ExpectsSpec | '';
  /** The value as written; undefined for an empty row. */
  value: unknown;
}

export interface Band {
  kind: 'needs' | 'set' | 'unexpected' | 'unknown';
  /** "Needed for Employer rating", "Also set", "Not expected on a book". */
  title: string;
  /**
   * A row, or an either-or group of rows ("Rating count or review count").
   * `met`: one is given, and it alone is shown; the others help.
   */
  rows: (RowSpec | { group: string; hint: string; rows: RowSpec[]; met?: boolean })[];
}

export interface Projection {
  types: string[];
  label: string;
  about: string;
  bands: Band[];
  /** Not set yet, and recommended: at most four. */
  helps: string[];
  /** Feature verdict lines are the caller's; this says when there is none. */
  feature: boolean;
  /** "servesCuisine is a detail of a restaurant.", with the type. */
  belongs: Record<string, string>;
  /** The key that appears twice, which locks the item in Form. */
  locked: string | null;
}

const isObject = (value: unknown): value is Item => typeof value === 'object' && value !== null && !Array.isArray(value);

export const typesOf = (item: unknown): string[] => {
  const type = isObject(item) ? item['@type'] : undefined;
  return (Array.isArray(type) ? type : [type]).filter((one): one is string => typeof one === 'string' && one !== '');
};

/** "ratingValue" as "Rating value". */
export const words = (name: string): string => {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** A type in plain words: "Employer rating", "Local business". */
export const typeLabel = (type: string, rules: SearchFeatures): string => rules.labels?.[type] ?? words(type);

/** Names every item has, said the same way on any item. */
const GENERIC: Record<string, string> = { name: 'Name', description: 'Description', url: 'URL', image: 'Image', sameAs: 'Same as' };

/** A detail in plain words: the rules file's label, else its name in words. */
export const detailLabel = (name: string, rules: SearchFeatures): string => GENERIC[name] ?? rules.facts[name]?.label ?? words(name);

/** One line about a type: the module's own, else schema.org's definition. */
export const aboutOf = (type: string, rules: SearchFeatures, vocabulary: Vocabulary | null): string =>
  rules.about?.[type] ?? vocabulary?.types[type]?.about ?? '';

/**
 * The line under an item's type: its own about line; for a type nobody
 * describes, "Not a schema.org type" when the vocabulary says so, else how it
 * is edited. Empty for a known type without a line.
 */
export function typeNote(type: string, rules: SearchFeatures, vocabulary: Vocabulary | null): string {
  const about = aboutOf(type, rules, vocabulary);
  if (about || !type || rules.about?.[type]) return about;
  if (vocabulary?.types[type]) return '';
  return vocabulary ? 'Not a schema.org type. Search engines may ignore it.' : 'Edited by the shape of its values.';
}

/** "a book", "an employer rating". */
export const aType = (type: string, rules: SearchFeatures) => {
  const shown = typeLabel(type, rules);
  // "a Q&A page": an initialism keeps its capitals.
  const label = /^[A-Z][A-Z&]/.test(shown) ? shown : shown.toLowerCase();
  return `${article(label)} ${label}`;
};

/**
 * The live features that read a type; with `hand`, only those judged on a
 * hand-added item (true) or on the page's own nodes (false).
 */
export const featuresOf = (types: string[], rules: SearchFeatures, hand?: boolean) =>
  Object.entries(rules.features).filter(
    ([, feature]) =>
      feature.status === 'shown' &&
      !feature.node &&
      !feature.list &&
      (hand === undefined || feature.only !== (hand ? 'page' : 'hand')) &&
      types.some((type) => feature.on.includes(type)),
  );

/** Common types first when a detail belongs to a narrower type. */
const COMMON = ['Restaurant', 'Store', 'Hotel', 'Event', 'Product', 'Article', 'Recipe', 'Person', 'Organization', 'Course', 'Book', 'Movie'];

/** The first key of a path: needs are rows of the item's own keys. */
const top = (path: string) => path.split('.')[0];

/** schema.org's data types as the shapes the rules file names. */
const DATATYPES: Record<string, string> = {
  Text: 'text',
  URL: 'url',
  Number: 'number',
  Integer: 'number',
  Float: 'number',
  Boolean: 'bool',
  Date: 'date',
  DateTime: 'datetime',
  Time: 'text',
  Duration: 'duration',
};

/**
 * What a detail's vocabulary ranges allow, as a shape: "Date" is a date,
 * "Organization or Person" an item of either. '' when nothing is known.
 */
export function rangeShape(name: string, vocabulary: Vocabulary | null): string {
  const ranges = vocabulary?.properties[name]?.ranges ?? [];
  const scalars = [...new Set(ranges.map((range) => DATATYPES[range]).filter(Boolean))];
  // An enumeration is one of its members.
  const members = ranges.flatMap((range) => vocabulary?.members[range] ?? []);
  const items = ranges.filter((range) => !DATATYPES[range] && range !== 'DataType' && !vocabulary?.members[range]);
  return [...scalars, ...(members.length ? [`enum:${members.join('|')}`] : []), ...(items.length ? [`item:${items.join('|')}`] : [])].join('|');
}

/**
 * What an item's detail expects: the feature's word, else the rules file's,
 * else (with the downloaded vocabulary) its ranges.
 */
export function expectsOf(name: string, types: string[], rules: SearchFeatures, vocabulary: Vocabulary | null = null): ExpectsSpec | '' {
  for (const [, feature] of featuresOf(types, rules)) {
    if (feature.expects?.[name]) return feature.expects[name];
  }
  return specOf(rules, name) || rangeShape(name, vocabulary);
}

/** The projection of one item. */
export function project(item: Item, rules: SearchFeatures, vocabulary: Vocabulary | null, duplicate: string | null = null, needs: string[] = [], hand = true): Projection {
  const types = typesOf(item);
  const type = types[0] ?? '';
  const row = (key: string, need: boolean): RowSpec => ({
    key,
    label: detailLabel(key, rules),
    need,
    expects: expectsOf(key, types, rules, vocabulary),
    value: Object.prototype.hasOwnProperty.call(item, key) ? item[key] : undefined,
  });
  const placed = new Set<string>(['@type', '@id', '@context']);
  const bandsOfNeeds: Band[] = [];
  // Alternatives of an either-or need that one given value meets.
  const alternatives: string[] = [];
  let feature = false;
  // What the detail it is described under needs of it: an organization's name.
  if (needs.length) {
    needs.forEach((key) => placed.add(key));
    bandsOfNeeds.push({ kind: 'needs', title: 'Needed', rows: needs.map((key) => row(key, true)) });
  }
  for (const [, one] of featuresOf(types, rules, hand)) {
    feature = true;
    const rows: Band['rows'] = [];
    for (const entry of one.required ?? []) {
      const paths = (Array.isArray(entry) ? entry : [entry]).flatMap((path) => path.split('|'));
      const keys = [...new Set(paths.map(top))].filter((key) => !placed.has(key));
      if (!keys.length) continue;
      keys.forEach((key) => placed.add(key));
      const filled = keys.filter((key) => Object.prototype.hasOwnProperty.call(item, key) && item[key] !== undefined);
      const named = keys.map((key, index) => (index ? words(key).toLowerCase() : words(key)));
      const group = `${named.slice(0, -1).join(', ')} or ${named[named.length - 1]}`;
      const hint = `Fill one, so the ${typeLabel(type, rules).toLowerCase().split(' ').pop()} can show.`;
      if (keys.length > 1 && filled.length) {
        // One alternative is given: it alone is the need, the others help.
        // Still the group, so that the row being typed in stays where it is.
        rows.push({ group, hint, rows: filled.map((key) => row(key, true)), met: true });
        keys.filter((key) => !filled.includes(key)).forEach((key) => {
          placed.delete(key);
          alternatives.push(key);
        });
      } else if (keys.length === 1) {
        rows.push(row(keys[0], true));
      } else {
        // "Rating count or review count": the names in words, one sentence;
        // "Fill one, so the rating can show.": the type's last word.
        rows.push({ group, hint, rows: keys.map((key) => row(key, true)) });
      }
    }
    if (rows.length) bandsOfNeeds.push({ kind: 'needs', title: `Needed for ${one.label}`, rows });
  }
  // Every other value, in the text's order.
  const own = vocabulary && type && vocabulary.types[type] ? new Set(detailsOf(vocabulary, types)) : null;
  const set: RowSpec[] = [];
  const unexpected: RowSpec[] = [];
  const unknown: RowSpec[] = [];
  const belongs: Record<string, string> = Object.create(null);
  for (const key of Object.keys(item)) {
    if (placed.has(key)) continue;
    placed.add(key);
    const spec = row(key, false);
    if (own && !own.has(key)) {
      if (vocabulary!.properties[key]) {
        unexpected.push(spec);
        // A detail of a more specific type: the documented one when there is.
        const domain = typeWith(vocabulary!, key, types);
        if (domain) {
          const under = Object.keys(vocabulary!.types).filter((one) => ancestors(vocabulary!, one).includes(domain));
          belongs[key] = COMMON.find((one) => under.includes(one)) ?? (rules.about?.[domain] ? domain : under.find((one) => rules.about?.[one])) ?? domain;
        }
      } else {
        unknown.push(spec);
      }
    } else {
      set.push(spec);
    }
  }
  const bands = [...bandsOfNeeds];
  if (set.length) bands.push({ kind: 'set', title: bandsOfNeeds.length ? 'Also set' : 'Details', rows: set });
  if (unexpected.length) bands.push({ kind: 'unexpected', title: `Not expected on ${aType(type, rules)}`, rows: unexpected });
  if (unknown.length) bands.push({ kind: 'unknown', title: 'Not schema.org names, kept as written', rows: unknown });
  const helps = feature
    ? [...new Set([...alternatives, ...featuresOf(types, rules, hand).flatMap(([, one]) => (one.recommended ?? []).map((path) => top(path.split('|')[0])))])]
    : ['name', 'description', 'image', 'url'];
  return {
    types,
    label: type ? typeLabel(type, rules) : 'Item',
    about: aboutOf(type, rules, vocabulary),
    bands,
    helps: helps.filter((key) => !placed.has(key)).slice(0, 4),
    feature,
    belongs,
    locked: duplicate,
  };
}

/**
 * The item list's sentence for an item: the rules file's `say`, else its
 * name and what it is.
 */
export function sentence(item: Item, rules: SearchFeatures, find: (id: string) => Item | undefined = () => undefined, fill: (text: string) => string = (text) => text): string {
  const types = typesOf(item);
  const value = (path: string): string | null => {
    let at: unknown = item;
    for (const part of path.split('.')) {
      at = isObject(at) ? at[part] : undefined;
      if (Array.isArray(at)) at = at[0];
      // A link to another item reads as that item.
      if (isObject(at) && Object.keys(at).length === 1 && typeof at['@id'] === 'string') at = find(at['@id']) ?? at;
    }
    // Names of fields and facts read as what they are filled with here;
    // direction controls never turn the sentence around them.
    const text = typeof at === 'string' ? fill(at).replace(/[\u202A-\u202E\u2066-\u2069]/g, '').trim() : '';
    // A date reads as one: "4 December 2026, 10:00".
    return text !== '' ? (dateWords(text, 'en') ?? text) : typeof at === 'number' ? String(at) : null;
  };
  for (const [, feature] of featuresOf(types, rules)) {
    if (!feature.say) continue;
    let text = '';
    for (const clause of feature.say) {
      for (const variant of clause) {
        const names = [...variant.matchAll(/\{([\w.]+)\}/g)].map((m) => m[1]);
        if (names.every((name) => value(name) !== null)) {
          const filled = variant.replace(/\{([\w.]+)\}/g, (_, name: string) => value(name)!);
          // "out of 5" only after a number: a rating kept as text ("92%") reads as written.
          const rating = names.find((name) => /ratingValue$/.test(name));
          text += rating && !/^\d+([.,]\d+)?$/.test(value(rating)!) ? filled.replace(/ out of .*$/, '') : filled;
          break;
        }
      }
    }
    if (text) return text;
  }
  const name = value('name') ?? value('headline');
  const type = types[0] ?? 'Thing';
  if (name) return `${name}, ${aType(type, rules)}.`;
  // A list says how long it is: "A list of 3 items."
  const elements = item.itemListElement;
  if (Array.isArray(elements)) return `A list of ${elements.length} ${elements.length === 1 ? 'item' : 'items'}.`;
  const count = Object.keys(item).filter((key) => !key.startsWith('@')).length;
  const a = aType(type, rules);
  const named = a.charAt(0).toUpperCase() + a.slice(1);
  return count ? `${named} with ${count} detail${count === 1 ? '' : 's'}.` : `${named}.`;
}
