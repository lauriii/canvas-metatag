// Values: typed text, facts, media items and field links. Pure: no DOM, no
// network. What a value gives for the previewed item, the words for where it
// comes from, and what a link menu offers. The PHP side is Values, Resolver
// and Sources; tests/fixtures/text-cases.json pins the text rules of both.
import type {
  BrokenLink,
  Fact,
  FactInfo,
  Kind,
  SchemaProp,
  SourceRow,
  Value,
} from './types';

/** The kind of value each fact gives. As Values::FACTS. */
export const FACT_KINDS: Record<Fact, Kind> = {
  title: 'text',
  description: 'text',
  site: 'text',
  url: 'address',
  author: 'text',
  published: 'date',
  modified: 'date',
  image: 'image',
  identity: 'ref',
};

/** The kind of value a structured data property takes. As Values::KINDS. */
export const PROP_KINDS: Record<SchemaProp['kind'], Kind> = {
  text: 'text',
  url: 'address',
  date: 'date',
  number: 'number',
  enum: 'text',
  currency: 'text',
  image: 'image',
  ref: 'ref',
  hours: 'hours',
};

/** The kind of value a property takes: formatted text for a job description. As Values::kindOf(). */
export const propKind = (prop: SchemaProp): Kind => (prop.html ? 'html' : PROP_KINDS[prop.kind]);

/** An image as the dialog shows it. */
export interface ShownImage {
  name: string;
  thumb: string;
  width: number;
  height: number;
  /** The file itself, when the server has said where it is. */
  url?: string;
  bytes?: number;
  alt?: string;
}

/** What values are resolved against. */
export interface Lookup {
  facts: Partial<Record<Fact, FactInfo>>;
  /** Template scope: the fields with the previewed item's values. */
  sources: SourceRow[];
  /** Stored links that cannot be read, by dotted path. */
  broken?: Record<string, BrokenLink>;
  /** Media items, by UUID. */
  media: Record<string, ShownImage>;
  /** There is an item to preview: without one, values are unknown. */
  resolvable: boolean;
}

/** What a value gives for the previewed item. */
export interface Shown {
  /** `none`: no item to preview; `broken`: the link cannot be read. */
  status: 'ok' | 'empty' | 'hidden' | 'broken' | 'none';
  /** The value as output uses it; '' for none. */
  value: string;
  /** The value as the dialog shows it: a list key's label. */
  text: string;
  image: ShownImage | null;
}

const NONE: Shown = { status: 'none', value: '', text: '', image: null };

/** The kind of the value in one place of the values. */
export function kindOf(path: string, props: SchemaProp[] = []): Kind {
  if (path === 'social.image') {
    return 'image';
  }
  if (path.startsWith('schema.props.')) {
    const prop = props.find((one) => one.key === path.slice(13));
    return prop ? propKind(prop) : 'text';
  }
  return 'text';
}

/** The row of a stored source, when the menu still offers it. */
export const rowOf = (lookup: Lookup, value: Value | undefined) =>
  value && 'source' in value
    ? lookup.sources.find(
        (row) => row.source.expression === value.source.expression,
      )
    : undefined;

/** What a value gives, of a kind, for the previewed item. */
export function resolve(
  value: Value | undefined,
  kind: Kind,
  lookup: Lookup,
): Shown {
  if (!value) {
    return { ...NONE, status: 'empty' };
  }
  const found = (text: string, image: ShownImage | null = null): Shown => ({
    status: text.trim() || image ? 'ok' : 'empty',
    value: text,
    text,
    image,
  });
  if ('text' in value) {
    return found(kind === 'image' ? '' : value.text);
  }
  if ('media' in value) {
    return found('', kind === 'image' ? (lookup.media[value.media] ?? null) : null);
  }
  if ('fact' in value) {
    const fact = lookup.facts[value.fact];
    if (!lookup.resolvable && value.fact !== 'site') {
      return NONE;
    }
    return FACT_KINDS[value.fact] !== kind
      ? { ...NONE, status: 'broken' }
      : found(fact?.value ?? '', kind === 'image' ? (fact?.image ?? null) : null);
  }
  const row = rowOf(lookup, value);
  if (!row || !row.kinds.includes(kind)) {
    return { ...NONE, status: 'broken' };
  }
  if (row.status === 'none' || row.status === 'hidden') {
    return { ...NONE, status: row.status };
  }
  const shown = found(row.value, kind === 'image' ? (row.image ?? null) : null);
  return { ...shown, text: row.shown || shown.text };
}

/** The text a value gives for the item, '' for none: what texts() takes. */
export const textOf = (lookup: Lookup) => (value: Value) =>
  resolve(value, 'text', lookup).value;

/** Canonical JSON of a value, keys sorted. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
      : item,
  );

/** Whether two values are the same value. */
export const sameValue = (a?: Value, b?: Value) =>
  canonical(a ?? null) === canonical(b ?? null);

/** A key that is the same for the same value: React keys, entry ids. */
export const keyOf = (value: Value): string =>
  'fact' in value
    ? `fact:${value.fact}`
    : 'source' in value
      ? `source:${value.source.expression}`
      : 'media' in value
        ? `media:${value.media}`
        : `text:${value.text}`;

/** "An image", "A date": the start of a sentence about a kind. */
const A: Record<Kind, string> = {
  text: 'Text',
  address: 'An address',
  date: 'A date',
  number: 'A number',
  image: 'An image',
  html: 'Formatted text',
  ref: 'A page or a name',
  hours: 'Opening hours',
};
const NOUN: Record<Kind, string> = {
  text: 'text',
  address: 'an address',
  date: 'a date',
  number: 'a number',
  image: 'an image',
  html: 'formatted text',
  ref: 'a page or a name',
  hours: 'opening hours',
};

/** Why an entry of one kind cannot fill a place of another: "An image, not text". */
export const kindReason = (entry: Kind, place: Kind) =>
  `${A[entry]}, not ${NOUN[place]}`;

/** Why a stored link gives nothing for any item: "no longer exists". */
export const brokenWhy = (reason: BrokenLink['reason'] | undefined, kind: Kind) =>
  reason === 'kind'
    ? `no longer gives ${NOUN[kind]}`
    : reason === 'error'
      ? 'can no longer be read'
      : 'no longer exists';

/** One entry of a link menu. */
export interface Entry {
  /** Unique within the menu. */
  key: string;
  value: Value;
  /** Within its level: "Street address". */
  label: string;
  /** The whole path: "Venue › Street address". */
  full: string;
  /** "Page" for facts, the type's name for its fields. */
  group: string;
  /** The reference it goes through, a level of the menu; null at the top. */
  level: string | null;
  kind: Kind;
  /** The previewed item's value, as the dialog shows it; '' for none. */
  shown: string;
  image: ShownImage | null;
  status: SourceRow['status'];
  /** Why it cannot be picked here. */
  disabled?: string;
  /**
   * What a fact is, said instead of its value when a field listed above
   * gives the same: "The first image it has".
   */
  note?: string;
  /** The referenced item's own name: what a filter for the reference finds first. */
  names?: true;
}

/** What each fact is, in words. */
function factNote(fact: Fact, lookup: Lookup): string {
  const via = lookup.facts[fact]?.via;
  return {
    title: 'Its title',
    description: via ? `The ${via} summary, else the start of the ${via}` : 'Its description',
    site: 'The site name',
    url: 'Its address',
    author: "Its author's name",
    published: 'When it was first published',
    modified: 'When it was last changed',
    identity: 'Your site',
    image: 'The first image it has',
  }[fact];
}

/**
 * The facts a place may link to, by the rules of its scope (Values::value()):
 * a template any fact of the place's kind; a page its ending to the site name
 * and its structured data addresses, dates and images to its own facts; the
 * site its ending to the site name.
 */
export function factsFor(
  path: string,
  kind: Kind,
  scope: 'page' | 'template' | 'site',
): Fact[] {
  const all = (Object.keys(FACT_KINDS) as Fact[]).filter(
    (fact) => FACT_KINDS[fact] === kind,
  );
  if (path === 'title_end') {
    return scope === 'template' ? all : ['site'];
  }
  if (scope === 'template') {
    return all;
  }
  return scope === 'page' && path.startsWith('schema.props.') && kind !== 'text'
    ? all
    : [];
}

/**
 * The entries of a place's link menu: the type's fields, then the facts.
 *
 * `choices`: the options of a choice detail; only a list field whose value
 * is one of them fits it.
 */
export function entriesFor(
  path: string,
  kind: Kind,
  scope: 'page' | 'template' | 'site',
  lookup: Lookup,
  typeLabel: string,
  choices?: string[],
  /** `list`: the place takes every item; `one`: only the first is used. */
  items?: 'list' | 'one',
  /** The place's own label: a list's fields named like it are suggested first. */
  placeLabel?: string,
): Entry[] {
  const facts: Entry[] = factsFor(path, kind, scope).map((fact) => {
    const shown = resolve({ fact }, kind, lookup);
    return {
      key: `fact:${fact}`,
      value: { fact },
      label: lookup.facts[fact]?.label ?? fact,
      full: lookup.facts[fact]?.label ?? fact,
      // A reference's publisher is its own group, first.
      group: kind === 'ref' ? 'This site' : 'Page',
      level: null,
      kind,
      shown: shown.text,
      image: shown.image,
      status: shown.status === 'none' ? 'none' : shown.status === 'ok' ? 'ok' : 'empty',
      // A fact is one value: never a list of text.
      disabled: choices ? NOT_AN_OPTION : items === 'list' && kind === 'text' ? ONE_VALUE : undefined,
    };
  });
  if (scope !== 'template') {
    return facts;
  }
  const fields: Entry[] = lookup.sources.map((row) => {
    const own = row.kinds.includes(kind) ? kind : row.kinds[0];
    // A reference is its field, one Enter away: "Location", its page.
    const page = kind === 'ref' && own === 'ref';
    const shown = row.status === 'ok' ? row.shown || row.value : '';
    return {
      key: row.source.expression,
      value: { source: row.source },
      label: page ? row.path[0] : (row.hop ? row.path.slice(1) : row.path).join(' › '),
      full: page ? `the ${row.path[0]} page` : row.label,
      group: typeLabel,
      level: row.hop && !page ? row.path[0] : null,
      kind: own,
      shown: row.status === 'ok' ? row.shown || row.value : '',
      image: own === 'image' ? (row.image ?? null) : null,
      status: row.status,
      disabled:
        // A choice is filled by one of its options only, whatever the kind.
        choices && (own !== kind || !row.list || (row.status === 'ok' && !choices.includes(row.value)))
          ? NOT_AN_OPTION
          : own !== kind
            ? kindReason(own, kind)
            : // A field visitors may never view. Through a reference, it may
              // be hidden for this item only: other items give it.
              row.status === 'hidden' && !row.hop
              ? 'Hidden from visitors'
              : undefined,
      names: row.names,
      note: page ? (shown ? `Its page: ${shown}` : 'Its page') : own === kind && !choices ? itemsNote(row, items) : undefined,
    };
  });
  // A list of text takes many values, or one formatted text's items; a list
  // of codes takes a list field of one value too.
  if (items === 'list' && kind === 'text' && !choices) {
    for (const entry of fields) {
      const row = lookup.sources.find((one) => one.source.expression === entry.key)!;
      if (entry.kind === kind && !row.many && !row.kinds.includes('html') && !row.lines) {
        entry.disabled ??= ONE_VALUE;
      }
    }
    // Suggested: fields of several values named like the place
    // (Ingredients for Ingredients), first.
    const words = folded(placeLabel ?? '').split(/\W+/).filter((word) => word.length > 2);
    for (const entry of fields) {
      const row = lookup.sources.find((one) => one.source.expression === entry.key)!;
      if (!entry.disabled && row.many && words.some((word) => folded(entry.full).includes(word))) {
        entry.group = 'Suggested';
        entry.level = null;
      }
    }
    fields.sort((a, b) => Number(b.group === 'Suggested') - Number(a.group === 'Suggested'));
  }
  // Two fields with one label are told apart by their machine names.
  const counts: Record<string, number> = {};
  for (const entry of fields) {
    counts[entry.full] = (counts[entry.full] ?? 0) + 1;
  }
  for (const entry of fields) {
    if (counts[entry.full] > 1) {
      const row = lookup.sources.find((one) => one.source.expression === entry.key)!;
      entry.label = `${entry.label} (${row.field})`;
      entry.full = `${entry.full} (${row.field})`;
    }
  }
  // A fact that gives what a field above gives says what it is instead: two
  // rows that read alike would leave the editor to guess.
  const same = (entry: Entry) => `${entry.image?.thumb ?? ''}\u0000${entry.shown}`;
  const given = new Set(fields.filter((entry) => !entry.disabled && (entry.shown || entry.image)).map(same));
  for (const entry of facts) {
    if ((entry.shown || entry.image) && given.has(same(entry))) {
      entry.note = factNote((entry.value as { fact: Fact }).fact, lookup);
    }
  }
  // At template scope the type's own fields come first: they are what a link
  // is for. A reference's publisher comes before them.
  return kind === 'ref' ? [...facts, ...fields] : [...fields, ...facts];
}

const NOT_AN_OPTION = 'Not one of the options';
const ONE_VALUE = 'One value, not a list';

/**
 * What a field gives a place that takes a list (every item, or one
 * formatted text's own items), or that only its first item is used.
 */
function itemsNote(row: SourceRow, items: 'list' | 'one' | undefined): string | undefined {
  if (items === 'list') {
    return row.many
      ? `All${row.count ? ` ${row.count}` : ''}, in order`
      : row.kinds.includes('html')
        ? 'Each list item, in order'
        : row.lines
          ? 'Each line, in order'
          : undefined;
  }
  return row.many && (row.count ?? 0) > 1 ? `First of ${row.count}` : undefined;
}

/** Text compared without case and accents. */
const folded = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();

/** The rows of a menu: entries, and levels to open. */
export type MenuRow =
  | { type: 'entry'; entry: Entry; deep: boolean }
  | { type: 'level'; level: string; group: string; count: number };

/** The level that holds the entries that do not fit: they come last, folded. */
export const FOLD = '#fold';

/**
 * Where a menu lists an entry when nothing is typed: the fold for one that
 * does not fit (in a level too), else its level or the top.
 */
export const levelOf = (entry: Entry): string | null => (entry.disabled ? FOLD : entry.level);

/** "4 fields that aren't text": the fold's row. */
export function foldLabel(entries: Entry[], kind: Kind): string {
  const count = entries.length;
  const fields = count === 1 ? 'field' : 'fields';
  // A reference takes a page: everything else is another field.
  if (kind === 'ref') {
    return `${count} other ${fields}`;
  }
  return entries.every((entry) => entry.kind !== kind)
    ? `${count} ${fields} that ${count === 1 ? "isn't" : "aren't"} ${NOUN[kind]}`
    : `${count} ${fields} that can't be linked here`;
}

/**
 * How well an entry matches a query: 0 its label is the query, 1 its label
 * starts with it (or it is the name of the reference that does), 2 a word of
 * its label does, 3 its path has it, 4 only its value does; null no match.
 */
function rank(entry: Entry, query: string): number | null {
  const label = folded(entry.label);
  return label === query
    ? 0
    : label.startsWith(query) || (entry.names && folded(entry.level ?? '').startsWith(query))
      ? 1
      : label.split(/[\s›()]+/).some((word) => word.startsWith(query))
        ? 2
        : folded(entry.full).includes(query)
          ? 3
          : folded(entry.shown).includes(query)
            ? 4
            : null;
}

/**
 * What a menu shows. At the top: the entries that fit without a level and
 * one row per level with an entry that fits, in the order of the form, then
 * one level holding the entries that do not fit, from every level (FOLD). In
 * a level: its entries. A filter matches labels, paths and values in every
 * level: what fits first, then the best matches; a match inside a level is
 * listed at the top with its path.
 */
export function tree(entries: Entry[], level: string | null, filter: string): MenuRow[] {
  const query = folded(filter.trim());
  if (query) {
    return entries
      .map((entry, index) => ({ entry, index, rank: rank(entry, query) }))
      .filter((one) => one.rank !== null)
      .sort((a, b) => Number(!!a.entry.disabled) - Number(!!b.entry.disabled) || a.rank! - b.rank! || a.index - b.index)
      .map(({ entry }) => ({ type: 'entry', entry, deep: entry.level !== null }));
  }
  if (level !== null) {
    return entries
      .filter((entry) => levelOf(entry) === level)
      .map((entry) => ({ type: 'entry', entry, deep: level === FOLD }));
  }
  const rows: MenuRow[] = [];
  const levels = new Map<string, MenuRow & { type: 'level' }>();
  for (const entry of entries) {
    const at = levelOf(entry);
    if (at === null) {
      rows.push({ type: 'entry', entry, deep: false });
    } else if (at !== FOLD) {
      const known = levels.get(at);
      if (known) {
        known.count++;
      } else {
        const row = { type: 'level' as const, level: at, group: entry.group, count: 1 };
        levels.set(at, row);
        rows.push(row);
      }
    }
  }
  // Within a group, what fits first: the type's own fields, then a part of
  // one ("Image › Alternative text"), then the references to open; each in
  // the order of the form.
  const groups = [...new Set(rows.map((row) => (row.type === 'entry' ? row.entry.group : row.group)))];
  const place = (row: MenuRow) => [
    groups.indexOf(row.type === 'entry' ? row.entry.group : row.group),
    row.type === 'level' ? 2 : row.entry.label.includes(' › ') ? 1 : 0,
  ];
  rows.sort((a, b) => {
    const [x, y] = [place(a), place(b)];
    return x[0] - y[0] || x[1] - y[1];
  });
  const folded_ = entries.filter((entry) => levelOf(entry) === FOLD);
  if (folded_.length) {
    rows.push({ type: 'level', level: FOLD, group: '', count: folded_.length });
  }
  return rows;
}

/** The machine name of the host field a source starts from (Sources::machineName()). */
const machineName = (expression: string) =>
  /^ℹ︎␜entity:[a-z0-9_]+(?::[a-z0-9_]+)?␝([a-z0-9_]+)␞/u.exec(expression)?.[1];

/**
 * The words for a value's source: "Summary", "Venue › Street address". A
 * broken link is named by its field's machine name: the one the server gives
 * while the stored link at `path` is this value, else the one in the link.
 */
export function tagOf(
  value: Value,
  lookup: Lookup,
  path?: string,
  /** A reference is named by its field: "Location", not "Location › Title". */
  kind?: Kind,
): string {
  if ('text' in value) {
    return 'Typed text';
  }
  if ('media' in value) {
    return 'Chosen image';
  }
  if ('fact' in value) {
    return lookup.facts[value.fact]?.label ?? value.fact;
  }
  const field = machineName(value.source.expression);
  const broken = path ? lookup.broken?.[path] : undefined;
  const row = rowOf(lookup, value);
  return (
    (broken && broken.field === field ? broken.field : undefined) ??
    (kind === 'ref' && row?.names ? row.path[0] : undefined) ??
    row?.label ??
    field ??
    'A field'
  );
}
