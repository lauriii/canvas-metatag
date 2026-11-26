// Values: typed text, facts, media items and field links. Pure: no DOM, no
// network. What a value gives for the previewed item, the words for where it
// comes from, and what a link menu offers. The PHP side is Values, Resolver
// and Sources; tests/fixtures/text-cases.json pins the text rules of both.
import type {
  BrokenLink,
  Fact,
  FactInfo,
  Kind,
  Part,
  SchemaProp,
  SourceRef,
  SourceRow,
  Value,
} from './types';

/** The shape of a value: which of its one keys it has. */
export type Shape = 'text' | 'fact' | 'media' | 'source' | 'parts';

/** Which shape a value is; every caller switches over all of them. */
export function shapeOf(value: Value): Shape {
  if ('parts' in value) return 'parts';
  if ('source' in value) return 'source';
  if ('fact' in value) return 'fact';
  if ('media' in value) return 'media';
  return 'text';
}

/** For a switch that handles every shape: TypeScript refuses a missing one. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled ${String(value)}`);
}

/** The facts that read as words in text: what a composition may hold. As Values::TEXT_FACTS. */
export const TEXT_FACTS: Fact[] = ['title', 'description', 'site', 'author', 'published', 'modified'];

/** The fields and facts one composition may hold. As Values::MAX_PARTS. */
export const MAX_PARTS = 8;

/** The room a description-like composition gives a long text part. As Values. */
export const LONG_ROOM = 155;
const LONG_FLOOR = 70;

/**
 * Whether a value in a place may be a composition. As Values::composes(): at
 * template scope the title's main part, the description, the social texts and
 * a structured data detail the registry marks `compose`.
 */
export function composes(prop: SchemaProp | null | undefined, path: string, scope: 'page' | 'template' | 'site'): boolean {
  if (scope !== 'template') {
    return false;
  }
  return ['title', 'description', 'social.title', 'social.description'].includes(path)
    || (path.startsWith('schema.props.') && !!prop?.compose && !prop.html);
}

/** Whether a place that composes is title-like (Values::titleLike()). */
export const titleLike = (path: string) => !/(^|[._])description$/.test(path);

/** The form a place reads its fields in: `line` title-like, `words` else. */
export const formOf = (path: string): 'line' | 'words' => (titleLike(path) ? 'line' : 'words');

const blank = (text: string) => /^[\s﻿]*$/u.test(text);

/**
 * The canonical form of a composition's parts. As Values::fold(): adjacent
 * text merges, empty text goes, whitespace before the first field and after
 * the last is trimmed and kept between them; one fact or source and no text is
 * that value, text alone typed text.
 */
export function fold(parts: Part[]): Value | undefined {
  const out: Part[] = [];
  for (const part of parts) {
    if ('text' in part) {
      if (part.text === '') continue;
      const last = out.at(-1);
      if (last && 'text' in last) {
        out[out.length - 1] = { text: last.text + part.text };
        continue;
      }
    }
    out.push(part);
  }
  const fields = out.flatMap((part, at) => ('text' in part ? [] : [at]));
  if (!fields.length) {
    const text = out[0] && 'text' in out[0] ? out[0].text : '';
    return blank(text) ? undefined : { text };
  }
  if (fields[0] > 0) {
    out[0] = { text: (out[0] as { text: string }).text.replace(/^[\s﻿]+/u, '') };
  }
  const end = out.length - 1;
  if (fields.at(-1)! < end) {
    out[end] = { text: (out[end] as { text: string }).text.replace(/[\s﻿]+$/u, '') };
  }
  const kept = out.filter((part) => !('text' in part) || part.text !== '');
  return kept.length === 1 ? kept[0] : { parts: kept };
}

/** The parts of a value: a composition's, one part for any other text value. */
export const partsOf = (value: Value | undefined): Part[] =>
  !value ? [] : 'parts' in value ? value.parts : 'media' in value ? [] : [value as Part];

/** Fields and facts in a list of parts. */
export const fieldsIn = (parts: Part[]) => parts.filter((part) => !('text' in part));

/**
 * Whether a key is `{`, which adds a field where text composes: with Shift,
 * Option or AltGr as a keyboard layout needs, never a shortcut with Ctrl or
 * Cmd (AltGr reports Ctrl and Alt on one system).
 */
export const braceKey = (event: { key: string; ctrlKey: boolean; metaKey: boolean; getModifierState(key: string): boolean }) =>
  event.key === '{' && (!(event.ctrlKey || event.metaKey) || event.getModifierState('AltGraph'));

/**
 * Joins a composition: which words go with which field. As Values::compose().
 * `read` gives what a field or fact gives, plain, '' for nothing; `long` says
 * a part is long text, cut to the room the rest of `room` leaves. The
 * segments: each kept field with its words; [] when every field gives nothing.
 */
export function compose(
  parts: Part[],
  read: (part: Part) => string,
  long?: (part: Part) => boolean,
  room = 0,
): string[] {
  const runs = [''];
  const fields: Part[] = [];
  for (const part of parts) {
    if ('text' in part) {
      runs[fields.length] += part.text;
      continue;
    }
    fields.push(part);
    runs.push('');
  }
  if (!fields.length) {
    return [];
  }
  const values = fields.map((part) => read(part));
  const kept = values.map((value) => !blank(value));
  if (!kept.includes(true)) {
    return [];
  }
  const longs = long ? fields.flatMap((part, at) => (long(part) ? [at] : [])) : [];
  if (longs.length && room > 0) {
    const rest = values.map((value, at) => (longs.includes(at) ? '' : value));
    const used = Array.from(plainText(joinRuns(runs, rest, kept).join(''))).length;
    const share = Math.floor(Math.max(0, room - used) / longs.length);
    for (const at of longs) {
      values[at] = sentences(values[at], Math.max(LONG_FLOOR, share));
    }
  }
  return joinRuns(runs, values, kept);
}

function joinRuns(runs: string[], values: string[], kept: boolean[]): string[] {
  const segments: string[] = [];
  const lead = runs[0];
  // A label always shows; any other lead-in goes with the first field.
  const label = /[:.!?…|·•–—\-/]\s*$/u.test(lead);
  let pending = label ? lead : '';
  let before = false;
  // A connector left out with an opening mark: the closing mark after its
  // field goes too, so a bracket is never left unbalanced.
  let orphan = false;
  const close = (run: string) => /^(?:\p{Pe}|[\p{Pi}\p{Pf}"'](?=$|[\s\p{P}]))/u.exec(run)?.[0] ?? '';
  for (let at = 0; at < values.length; at++) {
    let run = at === 0 ? (label ? '' : lead) : runs[at];
    // A closing bracket, or a quote followed by a space, punctuation or
    // nothing, goes with the field before.
    const mark = at > 0 ? close(run) : '';
    if (mark) {
      if (kept[at - 1] && !orphan) {
        segments[segments.length - 1] += mark;
      }
      run = run.slice(mark.length);
    }
    orphan = false;
    if (!kept[at]) {
      continue;
    }
    // A connector needs something kept before it; the lead-in does not.
    const connector = at > 0 && !before;
    orphan = connector && /(?:\p{Ps}|\p{Pi}|(?:^|\s)["'])$/u.test(run);
    segments.push(pending + (connector ? '' : run) + values[at]);
    pending = '';
    before = true;
  }
  // A separator left at the end never shows; a unit does.
  let tail = runs[values.length];
  if (orphan) {
    tail = tail.slice(close(tail).length);
  }
  if (kept[values.length - 1] && !/^[\s·•|–—\-/,;:]*$/u.test(tail)) {
    segments[segments.length - 1] += tail;
  }
  return segments;
}

/** Whitespace collapsed and trimmed, controls removed: Values::plain() without a cut. */
const plainText = (text: string) =>
  text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g, '')
    .replace(/[ \t\n\r]+/g, ' ')
    .replace(/^ +| +$/g, '');

/**
 * A text cut to a room at its last whole sentence, else at a word with "…".
 * As Values::sentences().
 */
export function sentences(text: string, room: number): string {
  const points = Array.from(plainText(text));
  if (points.length <= room) {
    return points.join('');
  }
  // A mark before a space ends a sentence, unless the next word starts in
  // lower case ("e.g. on"), as ICU's rule SB8 has it (Values::SENTENCE_END).
  const start = points.slice(0, room + 64).join('');
  const ends = [...start.matchAll(/[.!?…。！？][\p{Pe}\p{Pf}"'»]*(?=\s(?!\s*\p{Ll}))/gu)]
    .map((mark) => start.slice(0, mark.index! + mark[0].length))
    .filter((sentence) => Array.from(sentence).length <= room && !TITLE.test(sentence));
  const last = ends.at(-1);
  if (last) {
    return last;
  }
  // Never inside a character drawn as one (Values::whole()): the cluster
  // that holds the first code point past the cut goes whole.
  const clusters = Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(points.slice(0, Math.max(1, room - 1) + 1).join('')),
    ({ segment }) => segment,
  );
  clusters.pop();
  const whole = clusters.join('');
  let cut = Array.from(whole);
  const space = cut.lastIndexOf(' ');
  if (points[cut.length] !== ' ' && space > 0) {
    cut = cut.slice(0, space);
  }
  let words = cut.join('').replace(/[ ,;:]+$/, '');
  // Never right after a title ("Dr.…").
  if (TITLE.test(words)) {
    words = words.replace(/\S+$/u, '').replace(/[ ,;:]+$/, '') || whole;
  }
  return words + '…';
}

/** A title before a name ends no sentence (Values::TITLE_ABBREVIATION). */
const TITLE = /(?:^|\s)(?:Dr|Prof|Mr|Mrs|Ms|Mx|St|Jr|Sr)\.$/u;

/**
 * A type's label inside a sentence: "Event" reads "event", while a label
 * that starts with an abbreviation ("FAQ page") stays as written.
 */
export const inSentence = (label: string) =>
  /^\p{Lu}\p{Lu}/u.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);

/**
 * Whether a field is named for the value a place takes, as the server says
 * (Values::isNamedFor(), the rule the Description fact reads it by). The
 * place's value is its last key: a description, a title or a headline.
 */
export function namedFor(path: string, row: Pick<SourceRow, 'named'>): boolean {
  const key = path.split('.').at(-1);
  return !!row.named?.includes(key === 'headline' ? 'title' : (key as 'description' | 'title'));
}

/**
 * At template scope, whether no item of the type can have a fact: a node's
 * Description and Image read a field of the type, and it has none.
 */
export const noItemHas = (fact: Fact, lookup: Lookup): boolean =>
  (fact === 'description' || fact === 'image') && lookup.facts[fact]?.via === undefined;

/** What an unset detail says of the worked-out value it follows, by default. */
const DETAIL_FROM: Partial<Record<Fact, string>> = {
  title: 'From the page title',
  description: 'Same as description',
  image: 'From the Image field',
};

/**
 * Beside an unset detail that follows a fact (SchemaTab): where its value
 * comes from. An image names the field the Image reads ("From the Hero image
 * field"); at template scope, on a type none of whose items has an image, it
 * says so instead.
 */
export function detailFrom(fact: Fact, lookup: Lookup, template: boolean, type: string): string {
  const via = fact === 'image' ? lookup.facts.image?.via : undefined;
  return via
    ? `From the ${via} field`
    : fact === 'image' && template && noItemHas('image', lookup)
      ? `No ${type} has one`
      : (DETAIL_FROM[fact] ?? 'From the page');
}

/**
 * The facts structured data reads (SchemaGraph::build()): its Description is
 * the description as the head gives it. That reads the field its default
 * reads ("from Body › Summary") only while the description follows the
 * default; one set for the place reads what is set, so `via` is '' (no one
 * field, though every item has it).
 */
export function detailLookup(lookup: Lookup, description: string, own: Value | undefined): Lookup {
  const fact = lookup.facts.description;
  if (!fact) {
    return lookup;
  }
  const follows = !own || sameValue(own, { fact: 'description' });
  return { ...lookup, facts: { ...lookup.facts, description: { ...fact, value: description, ...(follows ? {} : { via: '' }) } } };
}

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

/**
 * What a box that follows a default given as words shows (the social
 * description, "Same as description"): those words, "Empty for this
 * ‹type›" when the previewed item gives none, and nothing to preview
 * without an item.
 */
export const wordsShown = (text: string, resolvable: boolean): Shown =>
  !resolvable ? NONE : { status: text ? 'ok' : 'empty', value: text, text, image: null };

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
export const rowOf = (lookup: Lookup, value: Value | Part | undefined) =>
  value && 'source' in value
    ? lookup.sources.find(
        (row) => row.source.expression === value.source.expression,
      )
    : undefined;

/**
 * The form a value is read in: a kind, or in a place that composes `words`
 * (`line` where it is title-like): every field and fact as words for people.
 */
export type Form = Kind | 'words' | 'line';

/** Whether a row gives words: text, a date or a number (Sources::fits()). */
export const givesWords = (row: SourceRow) => row.kinds.some((kind) => kind === 'text' || kind === 'date' || kind === 'number');

/**
 * What a value gives, of a kind or in a form, for the previewed item. In
 * words, a field gives the server's words for the item (its row's `text`),
 * never a value formatted here; a composition its joined text.
 */
export function resolve(
  value: Value | Part | undefined,
  kind: Form,
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
  const words = kind === 'words' || kind === 'line';
  const shape = shapeOf(value as Value);
  switch (shape) {
    case 'text':
      return found(kind === 'image' ? '' : (value as { text: string }).text);
    case 'media':
      return found('', kind === 'image' ? (lookup.media[(value as { media: string }).media] ?? null) : null);
    case 'parts': {
      if (!lookup.resolvable) {
        return NONE;
      }
      const joined = composed(value as { parts: Part[] }, kind === 'line' ? 'line' : 'words', lookup).join('');
      return found(plainText(joined));
    }
    case 'fact': {
      const name = (value as { fact: Fact }).fact;
      const fact = lookup.facts[name];
      if (!lookup.resolvable && name !== 'site') {
        return NONE;
      }
      if (words) {
        return TEXT_FACTS.includes(name) ? found(fact?.text ?? fact?.value ?? '') : { ...NONE, status: 'broken' };
      }
      return FACT_KINDS[name] !== kind
        ? { ...NONE, status: 'broken' }
        : found(fact?.value ?? '', kind === 'image' ? (fact?.image ?? null) : null);
    }
    case 'source': {
      const row = rowOf(lookup, value);
      if (!row || !(words ? givesWords(row) : row.kinds.includes(kind as Kind))) {
        return { ...NONE, status: 'broken' };
      }
      if (row.status === 'none') {
        return NONE;
      }
      // Several items: those visitors may see, though the first is hidden.
      const said = words ? (kind === 'line' ? (row.line ?? row.text) : row.text) : undefined;
      if (row.status === 'hidden' && !said) {
        return { ...NONE, status: 'hidden' };
      }
      if (words) {
        // The server's words. Plain text reads as itself; a date or a number
        // without them gives nothing: only the server formats.
        return found(said ?? (row.kinds.includes('date') || row.kinds.includes('number') ? '' : row.shown || row.value));
      }
      const shown = found(row.value, kind === 'image' ? (row.image ?? null) : null);
      return { ...shown, text: row.shown || shown.text };
    }
    default:
      return assertNever(shape);
  }
}

/**
 * The segments of a composition for the previewed item: each kept field or
 * fact with the words that go with it (compose()). A long part of a
 * description gets the room the rest leaves.
 */
export function composed(value: { parts: Part[] }, form: 'words' | 'line', lookup: Lookup): string[] {
  const long = (part: Part) => ('fact' in part ? part.fact === 'description' : !!rowOf(lookup, part)?.long);
  return compose(
    value.parts,
    (part) => {
      const row = rowOf(lookup, part);
      // A long part of a description is cut from its start, as the server
      // cuts the whole text.
      if (form === 'words' && row?.long && row.part !== undefined && row.status === 'ok') {
        return plainText(row.part);
      }
      return plainText(resolve(part, form, lookup).value);
    },
    long,
    form === 'line' ? 0 : LONG_ROOM,
  );
}

/**
 * What a composer's parts give the item, as one text; with `without`, as
 * they would for an item that lacks that field, wherever it is used.
 */
export function partsText(parts: Part[], form: 'words' | 'line', lookup: Lookup, without?: Part): string {
  const gone = without && !('text' in without) ? keyOf(without) : null;
  const folded = fold(parts.map((part) => ('text' in part || keyOf(part) !== gone ? part : { source: { sourceType: 'entity-field' as const, expression: '#without' } })));
  if (!folded) {
    return '';
  }
  return 'parts' in folded ? composed(folded, form, lookup).join('').replace(/\s+/g, ' ').trim() : resolve(folded, form, lookup).text;
}

/**
 * The text a value gives for the item in a form, '' for none; a
 * composition's segments: what texts() takes.
 */
export const textOf = (lookup: Lookup) => (value: Value, form: Form = 'text'): string | string[] =>
  'parts' in value
    ? composed(value, form === 'line' ? 'line' : 'words', lookup)
    : resolve(value, form, lookup).value;

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
export function keyOf(value: Value | Part): string {
  const shape = shapeOf(value as Value);
  switch (shape) {
    case 'fact':
      return `fact:${(value as { fact: Fact }).fact}`;
    case 'source':
      return `source:${(value as { source: { expression: string } }).source.expression}`;
    case 'media':
      return `media:${(value as { media: string }).media}`;
    case 'text':
      return `text:${(value as { text: string }).text}`;
    case 'parts':
      return `parts:${(value as { parts: Part[] }).parts.map(keyOf).join('\u001F')}`;
    default:
      return assertNever(shape);
  }
}

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
  /** "Automatic" for facts, the type's name for its fields. */
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
   * gives the same: "Its title". A fact that reads a field says which beside
   * its value instead.
   */
  note?: string;
  /** The referenced item's own name: what a filter for the reference finds first. */
  names?: true;
  /** Long text, linked whole: never added to a title-like composition. */
  long?: true;
  /** A fact: the field it reads ("Summary"), said as "from Summary". */
  from?: string;
  /**
   * A field named for the value, or the field the place's worked-out
   * default reads (readsVia()): first while nothing is typed.
   */
  named?: true;
  /**
   * A fact no item of the type has: listed last in its group, disabled, so
   * that the reason shows without opening the fold.
   */
  unavailable?: true;
  /**
   * A field told apart from a fact by its machine name ("Description
   * (body)"): its own names, for a menu that does not list that fact.
   */
  untold?: { label: string; full: string };
}

/** Why long text is never a part of a title-like composition. */
export const TOO_LONG = 'Too long for a title';

/**
 * Whether a part fits a composition in a form, as Values::parts() checks it:
 * one key; typed text a string; a fact that reads as words; a field the menu
 * offers that gives words. A title-like place takes no long text.
 */
export function fitsPart(part: unknown, form: 'words' | 'line', lookup: Lookup): part is Part {
  if (!part || typeof part !== 'object' || Array.isArray(part) || Object.keys(part).length !== 1) {
    return false;
  }
  const one = part as Record<string, unknown>;
  if ('text' in one) {
    return typeof one.text === 'string';
  }
  if ('fact' in one) {
    return TEXT_FACTS.includes(one.fact as Fact) && !(form === 'line' && one.fact === 'description');
  }
  const source = one.source as { sourceType?: unknown; expression?: unknown } | undefined;
  if (!source || source.sourceType !== 'entity-field' || typeof source.expression !== 'string') {
    return false;
  }
  const row = rowOf(lookup, { source: source as SourceRef });
  return !!row && givesWords(row) && !(form === 'line' && row.long);
}

/**
 * What each fact that reads no field is, in words. At template scope a
 * Description or Image either reads a field, and says "from ‹via›" instead,
 * or no item of the type has it: neither needs a note.
 */
const FACT_NOTES: Partial<Record<Fact, string>> = {
  title: 'Its title',
  site: 'The site name',
  url: 'Its address',
  author: "Its author's name",
  published: 'When it was first published',
  modified: 'When it was last changed',
  identity: 'Your site',
};

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
 * The entries of a place's link menu: the type's fields, then the facts
 * ("Automatic"). In every mode of the menu: a fact that no item of the type
 * can have is listed last in its group, disabled ("No ‹type› has one"), and
 * fields named for the value, and the field its default reads, are marked to
 * come first (tree()).
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
  /**
   * In a place that composes, the form it reads in: dates and numbers fit
   * with their words, several values show joined, and a title-like place
   * takes no long text.
   */
  form?: 'words' | 'line',
): Entry[] {
  const factNames = form && scope === 'template' ? TEXT_FACTS : factsFor(path, kind, scope);
  const facts: Entry[] = factNames.map((fact) => {
    const shown = resolve({ fact }, form ?? kind, lookup);
    const from = lookup.facts[fact]?.via;
    const none = !choices && !(items === 'list' && kind === 'text') && scope === 'template' && noItemHas(fact, lookup);
    return {
      key: `fact:${fact}`,
      value: { fact },
      label: lookup.facts[fact]?.label ?? fact,
      full: lookup.facts[fact]?.label ?? fact,
      // A reference's publisher is its own group, first.
      group: kind === 'ref' ? 'This site' : 'Automatic',
      level: null,
      kind,
      shown: shown.text,
      image: shown.image,
      status: shown.status === 'none' ? 'none' : shown.status === 'ok' ? 'ok' : 'empty',
      // A fact is one value: never a list of text.
      disabled: choices
        ? NOT_AN_OPTION
        : items === 'list' && kind === 'text'
          ? ONE_VALUE
          : none
            ? `No ${inSentence(typeLabel)} has one`
            : undefined,
      // The description is long text: linked whole, never a part of a title.
      ...(form === 'line' && fact === 'description' ? { long: true as const } : {}),
      ...(from ? { from } : {}),
      ...(none ? { unavailable: true as const } : {}),
    };
  });
  if (scope !== 'template') {
    return facts;
  }
  const fields: Entry[] = lookup.sources.map((row) => {
    const own = (form ? givesWords(row) : row.kinds.includes(kind)) ? kind : row.kinds[0];
    // A reference is its field, one Enter away: "Location", its page.
    const page = kind === 'ref' && own === 'ref';
    // In words, the server's words: a date as people read it, every item.
    const shown = row.status !== 'ok' ? '' : form ? resolve({ source: row.source }, form, lookup).text : row.shown || row.value;
    return {
      key: row.source.expression,
      value: { source: row.source },
      label: page ? row.path[0] : (row.hop ? row.path.slice(1) : row.path).join(' › '),
      full: page ? `the ${row.path[0]} page` : row.label,
      group: typeLabel,
      level: row.hop && !page ? row.path[0] : null,
      kind: own,
      shown,
      image: own === 'image' ? (row.image ?? null) : null,
      status: row.status,
      // Long text is linked whole, never a part of a title (entriesIn()).
      ...(form === 'line' && row.long && own === kind ? { long: true as const } : {}),
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
      ...(namedFor(path, row) ? { named: true as const } : {}),
      note: page ? (shown ? `Its page: ${shown}` : 'Its page') : own === kind && !choices && !form ? itemsNote(row, items) : undefined,
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
  // Two fields with one label are told apart by their machine names; in a
  // place that composes, so is a field labelled like a fact.
  const counts: Record<string, number> = {};
  for (const entry of fields) {
    counts[entry.full] = (counts[entry.full] ?? 0) + 1;
  }
  if (form) {
    for (const entry of facts) {
      counts[entry.full] = (counts[entry.full] ?? 0) + (counts[entry.full] ? 1 : 0);
    }
  }
  for (const entry of fields) {
    if (counts[entry.full] > 1) {
      const row = lookup.sources.find((one) => one.source.expression === entry.key)!;
      const alone = fields.filter((one) => one.full === entry.full).length === 1;
      // A fact that reads this field names it as the menu does: "from
      // Description (body)", never "Description · from Description".
      for (const fact of facts) {
        if (fact.from === entry.full && alone) {
          fact.from = `${entry.full} (${row.field})`;
        }
      }
      if (alone) {
        entry.untold = { label: entry.label, full: entry.full };
      }
      entry.label = `${entry.label} (${row.field})`;
      entry.full = `${entry.full} (${row.field})`;
    }
  }
  // The field the place's default reads ("Body › Summary") leads, as a field
  // named for it does: it is what the Default box names.
  const key = path.split('.').at(-1);
  const via = key === 'description' || key === 'image' ? lookup.facts[key]?.via : undefined;
  for (const entry of fields) {
    if (readsVia(entry, via)) {
      entry.named = true;
    }
  }
  // A fact that gives what a field above gives says what it is instead: two
  // rows that read alike would leave the editor to guess. One that reads a
  // field already tells itself apart: "· from Summary" beside its value.
  const same = (entry: Entry) => `${entry.image?.thumb ?? ''}\u0000${entry.shown}`;
  const given = new Set(fields.filter((entry) => !entry.disabled && (entry.shown || entry.image)).map(same));
  for (const entry of facts) {
    if (!entry.from && (entry.shown || entry.image) && given.has(same(entry))) {
      entry.note = FACT_NOTES[(entry.value as { fact: Fact }).fact];
    }
  }
  // At template scope the type's own fields come first: they are what a link
  // is for. A reference's publisher comes before them.
  return kind === 'ref' ? [...facts, ...fields] : [...fields, ...facts];
}

/**
 * The entries of a menu in its mode. Linking takes long text whole; adding
 * or replacing a part of a title-like composition never does: a long field
 * and the Description fact alike wait in the last row, with the reason.
 */
export const entriesIn = (entries: Entry[], mode: 'link' | 'add' | 'replace'): Entry[] =>
  mode === 'link' ? entries : entries.map((entry) => (entry.long && !entry.disabled ? { ...entry, disabled: TOO_LONG } : entry));

/**
 * Whether an entry is the field a worked-out value reads (FactInfo.via):
 * "Body › Summary"; for an image, the image of the field it names ("Photo ›
 * Image" for "Photo"). A field told apart from a fact by its machine name
 * ("Description (body)") is still the field its label names.
 */
export function readsVia(entry: Entry, via: string | undefined): boolean {
  if (!via || !('source' in entry.value)) {
    return false;
  }
  const told = `${via} (${machineName(entry.key) ?? ''})`;
  return entry.full === via || entry.full === told || (entry.kind === 'image' && entry.full.startsWith(`${via} › `));
}

/**
 * What a value's box says before its value (Value.tsx): its tag, the field
 * a worked-out value reads, and, where no item of the type can have the
 * default, the value line in place of "Empty for this ‹type›".
 *
 * A default is named as one, with its source only where it is not the place
 * ("Default · First published"); a default typed in the registry is the
 * default, not text anybody typed. A worked-out value says which field it
 * reads: "Default · from Summary".
 */
export function boxTag(box: {
  linked: boolean;
  /** The link, or the default the place follows. */
  value: Value | undefined;
  /** tagOf() the value. */
  source: string;
  /** The place's own label: "Description". */
  label: string;
  lookup: Lookup;
  template: boolean;
  /** The type in a sentence: "bookmark". */
  type: string;
}): { tag: string; from?: string; none?: string } {
  const fact = box.value && 'fact' in box.value ? box.value.fact : undefined;
  // By its label alone: "from Description" always names a field, so the
  // box never needs a machine name to tell it apart.
  const from = fact ? box.lookup.facts[fact]?.via : undefined;
  const none = box.template && fact && noItemHas(fact, box.lookup) ? `No ${box.type} has one` : undefined;
  const tag = box.linked
    ? box.source
    : box.source === box.label || (!!box.value && 'text' in box.value)
      ? from ? `Default · from ${from}` : 'Default'
      : `Default · ${box.source}${from ? `, from ${from}` : ''}`;
  return { tag, ...(from ? { from } : {}), ...(none ? { none } : {}) };
}

/**
 * The detail of "Add words or fields", which turns a box into a composer
 * holding its value as the first chip: "Keep Summary and add to it" for a
 * link, "Start from Title" for a default, "Keep the default and add to it"
 * for a default named like its place ("Start from Description" on
 * Description goes in a circle). A value a composition can't hold starts
 * empty.
 */
export const startWords = (kept: boolean, linked: boolean, source: string, label: string): string =>
  !kept ? 'Type words and add fields' : linked ? `Keep ${source} and add to it` : source === label ? 'Keep the default and add to it' : `Start from ${source}`;

/**
 * Whether composing keeps a box's value as its first chip: one a
 * composition can hold, and not a default no item of the type has, which
 * would be a chip that is always empty.
 */
export const keptAsChip = (value: Value | undefined, form: 'words' | 'line', lookup: Lookup, template: boolean): value is Value =>
  !!value && partsOf(value).every((part) => fitsPart(part, form, lookup)) && !(template && 'fact' in value && noItemHas(value.fact, lookup));

/**
 * A menu that links the whole value leaves out the default the place
 * follows: picking it would change nothing, and the Default box and Reset
 * already return to it. A menu that adds to a composition keeps it. A
 * default no item of the type has stays, disabled, last in its group: its
 * "No ‹type› has one" is why nothing fits.
 */
export function withoutDefault(entries: Entry[], byDefault: Value | null | undefined): Entry[] {
  if (!byDefault) {
    return entries;
  }
  const left = entries.filter((entry) => entry.unavailable || !sameValue(entry.value, byDefault));
  // A field told apart from the fact left out goes by its label again:
  // nothing else in the menu reads the same.
  return left.map((entry) =>
    entry.untold && !left.some((one) => 'fact' in one.value && one.full === entry.untold!.full) ? { ...entry, ...entry.untold } : entry,
  );
}

/**
 * What a value's box says to assistive technology: where the value comes
 * from, then what it gives ("Linked to Site name. This article: Example.").
 * A worked-out value is named by its label, and says the field it reads.
 */
export function boxSaid(box: {
  linked: boolean;
  broken: boolean;
  /** tagOf() the value. */
  source: string;
  /** "Article › " before a field of the type. */
  group: string;
  /** The field a worked-out value reads. */
  from?: string;
  /** brokenWhy() of a broken link. */
  why: string;
  /** The type in a sentence: "article", "page". */
  type: string;
  /** What the default is: "each article's description". */
  defaultName: string;
  /** What it gives for the item, as a sentence. */
  said: string;
}): string {
  const from = box.from ? `, from ${box.from}` : '';
  if (!box.linked) {
    return `${followsDefault(box.defaultName, box.from)}. ${box.said}`;
  }
  return box.broken
    ? `Linked to ${box.source}, which ${box.why}. Each ${box.type} uses its default.`
    : `Linked to ${box.group}${box.source}${from}. ${box.said}`;
}

/** A default and the field it reads: the box's description and the link button's tooltip. */
export const followsDefault = (defaultName: string, from?: string) => `Follows the default: ${defaultName}${from ? `, from ${from}` : ''}`;

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
  | { type: 'level'; level: string; group: string; count: number; marked?: true };

/** The level that holds the entries that do not fit: they come last, folded. */
export const FOLD = '#fold';

/**
 * Where a menu lists an entry when nothing is typed: the fold for one that
 * does not fit (in a level too), else its level or the top. A fact no item
 * has stays at the top, last in its group: its reason is the answer.
 */
export const levelOf = (entry: Entry): string | null => (entry.disabled && !entry.unavailable ? FOLD : entry.level);

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
 *
 * `marked`: an entry the menu marks ("Default"); the level that holds it is
 * marked too, so it is found without opening every level.
 */
export function tree(entries: Entry[], level: string | null, filter: string, marked?: (entry: Entry) => boolean): MenuRow[] {
  // An old token typed from memory: "{title}" finds Title.
  const query = folded(filter.trim()).replace(/^\{|\}$/g, '');
  if (query) {
    // Ranked across groups, on purpose: the best match is first and active,
    // so Enter picks it ("{title}" adds Title, not Venue › Title), and a
    // group's heading follows its best match.
    return entries
      .map((entry, index) => ({ entry, index, rank: rank(entry, query) }))
      .filter((one) => one.rank !== null)
      // Of two entries labelled alike, the item's own first: "title" finds
      // Title before Venue › Title.
      .sort((a, b) =>
        Number(!!a.entry.disabled) - Number(!!b.entry.disabled)
        || a.rank! - b.rank!
        || (folded(a.entry.label) === folded(b.entry.label) ? Number(a.entry.level !== null) - Number(b.entry.level !== null) : 0)
        || a.index - b.index)
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
      let known = levels.get(at);
      if (known) {
        known.count++;
      } else {
        known = { type: 'level' as const, level: at, group: entry.group, count: 1 };
        levels.set(at, known);
        rows.push(known);
      }
      if (marked?.(entry)) {
        known.marked = true;
      }
    }
  }
  // Within a group, what fits first: the fields named for the value, the
  // type's other fields, then a part of one ("Image › Alternative text"),
  // then the references to open, each in the order of the form; last, a
  // fact no item has.
  const groups = [...new Set(rows.map((row) => (row.type === 'entry' ? row.entry.group : row.group)))];
  const place = (row: MenuRow) => [
    groups.indexOf(row.type === 'entry' ? row.entry.group : row.group),
    row.type === 'level' ? 3 : row.entry.unavailable ? 4 : row.entry.named ? 0 : row.entry.label.includes(' › ') ? 2 : 1,
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
  value: Value | Part,
  lookup: Lookup,
  path?: string,
  /** A reference is named by its field: "Location", not "Location › Title". */
  kind?: Kind,
): string {
  if ('parts' in value) {
    return 'Words and fields';
  }
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

/** "City and Starts", "City, Venue and Starts". */
export const andWords = (items: string[]) => new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(items);

/** Under a composer whose every field gives nothing for the item: its default is used. */
export const allEmptySaid = (labels: string[], type: string, field: string) =>
  `${andWords(labels)} ${labels.length === 1 ? 'is' : 'are'} empty for this ${type}, so its default ${field.toLowerCase()} is used.`;

/** What a part of a composition that gives nothing says, in a sentence. */
export const partSentence = (label: string, status: Shown['status'], type: string, why = 'no longer exists') =>
  status === 'broken'
    ? `${label} ${why}`
    : status === 'hidden'
      ? `${label} is hidden from visitors`
      : `${label} is empty for this ${type}`;

/**
 * A composer's description: the item's result (else what its default gives),
 * the field each worked-out value reads ("Description comes from Summary"),
 * then each part that gives nothing and why, one full stop at the end.
 */
export function compositionSaid(
  type: string,
  result: string,
  fallback: string,
  parts: { label: string; status: Shown['status']; why?: string; from?: string }[],
): string {
  // Each sentence ends once: a result may end with its own mark.
  const ended = (text: string) => (/[.!?…。！？]["'”’)\]]*$/u.test(text) ? text : `${text}.`);
  return [
    `This ${type}: ${result || fallback || 'nothing'}`,
    // Once per value, however often it is a part.
    ...new Set(parts.filter((one) => one.from).map((one) => `${one.label} comes from ${one.from}`)),
    ...parts.filter((one) => one.status !== 'ok' && one.status !== 'none').map((one) => partSentence(one.label, one.status, type, one.why)),
  ].map(ended).join(' ');
}

/**
 * A chip's tooltip: its value or its state in words; for a worked-out value,
 * the field it reads ("· from Summary"); then what the item gets without it.
 */
export const chipTitle = (own: string, from?: string, without?: string): string =>
  `${own}${from ? ` · from ${from}` : ''}${without ? `\n${without}` : ''}`;
