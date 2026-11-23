// The read-back: what search engines read, in one to three plain sentences.
// Pure. Built only from the graph that ships: a clause whose facts are not
// in the graph is never said. The sentences come whole from the registry, in
// the dialog's language; no words are glued here.
import type { GraphNode, Registry, SchemaType, SearchFeatures, Slot } from './types';

type Node = Record<string, unknown>;

/** One fact of the sentence: a button that leads to where it is set. */
export interface ReadFact {
  slot: string;
  label: string;
  /** As the sentence shows it: shortened in a long sentence. */
  text: string;
  /** Whole, for the button's name. */
  full: string;
  prop?: string;
  fact?: string;
  site?: string;
}

export type Part = string | ReadFact;

export interface Readback {
  /** The sentences as text and facts; null when they have no translation. */
  sentence: Part[] | null;
  /** Every fact that resolves, in slot order: the list without a sentence. */
  facts: ReadFact[];
  /** The hand-added items that ship, by name. */
  hand: string[];
}

export interface ReadbackInput {
  graph: { '@graph'?: Node[] } | null | undefined;
  /** The entity's own address: the base of its node ids. */
  url: string;
  registry: Registry;
  rules: SearchFeatures;
  /** The registry type the graph was built as. */
  type: string;
  nodes: GraphNode[];
  /** The dialog's language. */
  locale: string;
}

/** Past this many words a sentence shortens its long facts. */
const FOLD = 40;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The nodes of the graph by `@id`. */
function indexOf(graph: ReadbackInput['graph']): Map<string, Node> {
  const index = new Map<string, Node>();
  for (const node of graph?.['@graph'] ?? []) {
    if (typeof node['@id'] === 'string' && !index.has(node['@id'])) {
      index.set(node['@id'], node);
    }
  }
  return index;
}

/**
 * The nodes of the graph by `@id`, and the node a verdict is about. A
 * withheld main node is not in the graph but is judged all the same
 * (SchemaGraph::features()): its own values are read from the report.
 */
export function judged(
  graph: ReadbackInput['graph'],
  id: string | null,
  main: string,
  withheld: Node | null | undefined,
): { node: Node | undefined; index: Map<string, Node> } {
  const index = indexOf(graph);
  const node = id === null ? undefined : (index.get(id) ?? (id === main && isNode(withheld) ? withheld : undefined));
  return { node, index };
}

/** The node a bare reference points at, when it is in the graph. */
const follow = (value: unknown, index: Map<string, Node>): unknown =>
  isNode(value) &&
  Object.keys(value).length === 1 &&
  typeof value['@id'] === 'string' &&
  index.has(value['@id'])
    ? index.get(value['@id'])
    : value;

/** The first value at a dotted path, following references; undefined for none. */
export function valueAt(
  node: unknown,
  path: string,
  index: Map<string, Node>,
): unknown {
  let at = follow(node, index);
  for (const key of path.split('.')) {
    at = Array.isArray(at) ? at[0] : at;
    at = follow(at, index);
    if (!isNode(at) || !(key in at)) {
      return undefined;
    }
    at = follow(at[key], index);
  }
  at = Array.isArray(at) ? at[0] : at;
  return at === '' || at === null ? undefined : at;
}

/** The server's locale for dates, once the state has said it. */
let serverDates: string | null = null;

/**
 * Writes dates as the server's words do for the item (its language and the
 * site's country): a date reads one way in the boxes, the menus and the
 * composed result. Called as the state arrives.
 */
export const setDateLocale = (locale: string | undefined) => {
  serverDates = locale && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale) ? locale : null;
};

/**
 * The locale the dialog writes dates in: the server's for the item, else its
 * language, and for English the style its fields use ("19 June 2027, 19:00").
 */
export const dateLocale = (ui: string) => serverDates ?? (ui === 'en' ? 'en-GB' : ui);

/**
 * "2026-07-01T18:00+02:00" as the wall time it names, the one way the whole
 * dialog writes a date: day, month in words, year, and a 24-hour time.
 */
export function dateWords(value: string, ui: string): string | null {
  const m = value.match(/^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/);
  if (!m) {
    return null;
  }
  let day: string;
  try {
    day = new Intl.DateTimeFormat(dateLocale(ui), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
  } catch {
    return `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`;
  }
  return m[4] ? `${day}, ${m[4]}:${m[5]}` : day;
}

/** A price in the currency it names, else as a number. */
function priceWords(value: string, currency: unknown, locale: string): string {
  const amount = Number(value);
  const digits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)
      ? { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: 2 }
      : { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return value;
  }
}

/** What a slot gives, in words; null when it gives nothing. */
function slotText(
  root: Node,
  slot: Slot,
  type: SchemaType,
  index: Map<string, Node>,
  locale: string,
): string | null {
  if (slot.unless && valueAt(root, slot.unless, index) !== undefined) {
    return null;
  }
  for (const [path, wanted] of Object.entries(slot.if ?? {})) {
    if (valueAt(root, path, index) !== wanted) {
      return null;
    }
  }
  const value = valueAt(root, slot.path, index);
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const text = String(value);
  const prop = type.props?.find((one) => one.key === slot.prop);
  if (slot.currency !== undefined) {
    return priceWords(text, valueAt(root, slot.currency, index), locale);
  }
  if (prop?.kind === 'date' || /^\d{4}-\d\d-\d\d(T|$)/.test(text)) {
    return dateWords(text, locale) ?? text;
  }
  if (prop?.kind === 'enum') {
    const option = text.replace(/^https:\/\/schema\.org\//, '');
    return prop.option_labels?.[option] ?? option;
  }
  return text.trim() === '' ? null : text;
}

/** The label of a slot: its own, its detail's, or its name. */
const slotLabel = (name: string, slot: Slot, type: SchemaType, registry: Registry) =>
  slot.label ??
  type.props?.find((prop) => prop.key === slot.prop)?.label ??
  (slot.fact === 'title' ? registry.WebPage.props?.find((prop) => prop.key === 'name')?.label : undefined) ??
  name.charAt(0).toUpperCase() + name.slice(1);

/** The first `max` words of a text, with an ellipsis when it was longer. */
const words = (text: string, max: number) => {
  const all = text.split(/\s+/);
  return all.length > max ? `${all.slice(0, max).join(' ')}…` : text;
};

/** Plain words for the items people add by hand most, before "an item". */
const ITEMS: [RegExp, string][] = [
  [/^EmployerAggregateRating$/, 'an employer rating'],
  [/Rating$/, 'a rating'],
  [/^Review$/, 'a review'],
  [/^(Organization|Corporation|NGO|LocalBusiness|Store|OnlineStore)$/, 'an organization'],
  [/^Person$/, 'a person'],
  [/Event$/, 'an event'],
  [/Product$/, 'a product'],
  [/Article$|^BlogPosting$/, 'an article'],
];

/**
 * What a hand-added item is: what its feature is called, else a plain word;
 * never a schema.org name.
 */
export function itemKind(node: Node, rules: SearchFeatures): string {
  const type = typeof node['@type'] === 'string' ? node['@type'] : '';
  // A feature of the site's own nodes ("Logo") does not name an item, nor
  // one of hand-added items ("Review snippet"): their type's label does.
  const feature = Object.values(rules.features).find((one) => !one.node && !one.only && one.on.includes(type));
  const label = rules.labels?.[type]?.toLowerCase();
  return feature?.label ?? (label ? `${/^[aeiou]/.test(label) ? 'an' : 'a'} ${label}` : undefined) ?? ITEMS.find(([pattern]) => pattern.test(type))?.[1] ?? 'an item';
}

/** The name of a hand-added item: its own, else what it is. */
export function itemName(node: Node, rules: SearchFeatures): string {
  for (const key of ['name', 'headline']) {
    if (typeof node[key] === 'string' && (node[key] as string).trim() !== '') {
      return node[key] as string;
    }
  }
  return itemKind(node, rules);
}

/**
 * Reads the graph back: the sentence of the kind that ships, its facts and
 * the hand-added items.
 */
export function readback(input: ReadbackInput): Readback {
  const { registry, locale } = input;
  const index = indexOf(input.graph);
  const built = registry[input.type] ?? registry.WebPage;
  const main = index.get(`${input.url}#primary`);
  // A withheld main node: what ships is a web page.
  const type = built.primary_type && !main ? registry.WebPage : built;
  const root = (built.primary_type && main) || index.get(`${input.url}#webpage`);
  const facts: ReadFact[] = [];
  const found = new Map<string, ReadFact>();
  for (const [name, slot] of Object.entries(type.slots ?? {})) {
    const text = root ? slotText(root, slot, type, index, locale) : null;
    if (text !== null) {
      const fact: ReadFact = {
        slot: name,
        label: slotLabel(name, slot, type, registry),
        text,
        full: text,
        ...(slot.prop && { prop: slot.prop }),
        ...(slot.fact && { fact: slot.fact }),
        ...(slot.site && { site: slot.site }),
      };
      found.set(name, fact);
      // The list names each fact once: a price is one fact, however billed.
      if (!facts.some((one) => one.label === fact.label)) {
        facts.push(fact);
      }
    }
  }

  let sentence: Part[] | null = null;
  if (type.say) {
    sentence = [];
    for (const variants of type.say) {
      const chosen = variants.find((variant) =>
        [...variant.matchAll(/\{(\w+)\}/g)].every((m) => found.has(m[1])),
      );
      if (chosen === undefined) {
        continue;
      }
      if (sentence.length) {
        sentence.push(' ');
      }
      for (const [at, piece] of chosen.split(/\{(\w+)\}/).entries()) {
        if (at % 2) {
          sentence.push({ ...found.get(piece)! });
        } else if (piece !== '') {
          sentence.push(piece);
        }
      }
    }
    // A long sentence keeps its facts short; their buttons say them whole.
    const count = sentence
      .map((part) => (typeof part === 'string' ? part : part.text))
      .join('')
      .split(/\s+/)
      .filter(Boolean).length;
    if (count > FOLD) {
      sentence = sentence.map((part) =>
        typeof part === 'string' ? part : { ...part, text: words(part.text, 8) },
      );
    }
  }

  const list = input.graph?.['@graph'] ?? [];
  const hand = input.nodes
    .filter((node) => node.origin === 'hand' && node.at !== undefined && isNode(list[node.at]))
    .map((node) => itemName(list[node.at!], input.rules));
  return { sentence, facts, hand };
}
