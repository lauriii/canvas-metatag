/**
 * A paste of JSON-LD, cleaned into plain items and reported in one line.
 *
 * What people copy is a script tag from a page, a generator's snippet with
 * its context, an @graph, or a list. Each step that changes something adds
 * a clause to the report; Undo clean-up restores the exact paste. The pasted
 * text is never sent or stored: only the items it gives are.
 */
import { visit } from 'jsonc-parser';
import { MODULE_IDS, reserved } from './validate';

export interface CleanContext {
  /** The site's home address, with its trailing slash. */
  home: string;
  /** The page's own address. */
  url: string;
  /** The page's language, for text given in several. */
  langcode: string;
  /** Ids the text already has, so that new ones never repeat them. */
  taken?: string[];
  moduleIds?: string[];
}

export interface Cleaned {
  /** The items, formatted; null when nothing could be read. */
  text: string | null;
  items: Record<string, unknown>[];
  /** "Cleaned up the paste: …." or null when nothing changed. */
  report: string | null;
  /** Advice about the paste: microdata, escaped text, placeholders. */
  notes: string[];
  /** Why nothing was taken. */
  error: string | null;
  /** How many script tags it came out of. */
  scripts: number;
  /** Not JSON once out of its script tag, fence or words: the text inside, kept with its problems. */
  kept?: string;
}

export const PASTE_MAX = 524288;
const SCHEMA = /^https?:\/\/schema\.org\/?/;
const SCRIPT = /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** "a, b and c". */
export const joined = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many.replace('@count', String(count)));

/** An id from words: ASCII, lower case, dashes. */
export function slug(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

/** A new `#id` for an item, never one of the module's or one already taken. */
export function mint(item: Record<string, unknown>, taken: Set<string>, ids: string[] = MODULE_IDS): string {
  const type = Array.isArray(item['@type']) ? item['@type'][0] : item['@type'];
  const name = slug(typeof item.name === 'string' && item.name.length <= 40 ? item.name : String(type ?? 'item'));
  // "c-s-lewis" has the components' prefix, so every "-2" would too.
  const base = `#${name.startsWith('c-') ? `item-${name}` : name}`;
  let id = base;
  for (let n = 2; taken.has(id) || reserved(id, null, ids); n++) {
    id = `${base}-${n}`;
  }
  taken.add(id);
  return id;
}

/** Integers JavaScript would round, written as text before they are read. */
function longNumbers(text: string): { text: string; count: number } {
  const spans: [number, number][] = [];
  visit(text, {
    onLiteralValue: (value, offset, length) => {
      const raw = text.slice(offset, offset + length);
      if (typeof value === 'number' && /^-?\d+$/.test(raw) && !Number.isSafeInteger(Number(raw))) spans.push([offset, length]);
    },
  });
  let out = text;
  for (const [offset, length] of spans.reverse()) {
    out = `${out.slice(0, offset)}"${out.slice(offset, offset + length)}"${out.slice(offset + length)}`;
  }
  return { text: out, count: spans.length };
}

/** Cleans a paste. */
export function clean(paste: string, ctx: CleanContext): Cleaned {
  const result: Cleaned = { text: null, items: [], report: null, notes: [], error: null, scripts: 0 };
  if (paste.length > PASTE_MAX) {
    return { ...result, error: 'This paste is over 512 KB. Paste one script tag or a few items at a time.' };
  }
  const clauses: string[] = [];
  let text = paste.replace(/^﻿/, '').trim();
  const microdata = /\bitemscope\b|\bitemprop\s*=|\btypeof\s*=|\bvocab\s*=/i.test(text);

  // Out of script tags.
  const blocks: string[] = [];
  if (/<script/i.test(text)) {
    for (const match of text.matchAll(SCRIPT)) {
      blocks.push(match[1].trim());
    }
    if (!blocks.length) {
      return { ...result, error: microdata ? "No JSON-LD found in what you pasted. Microdata isn't imported." : 'No JSON-LD found in what you pasted.' };
    }
    result.scripts = blocks.length;
    clauses.push(blocks.length === 1 ? 'took it out of its script tag' : `took it out of ${blocks.length} script tags`);
    if (microdata) result.notes.push("The page you copied also has microdata, which wasn't imported.");
  } else {
    // Code fences and words before the JSON.
    text = text.replace(/^```[a-z+-]*\s*\n?/i, '').replace(/\n?```\s*$/, '');
    const start = text.search(/[[{]/);
    if (start < 0) {
      return { ...result, error: microdata ? "No JSON-LD found in what you pasted. Microdata isn't imported." : 'No JSON-LD found in what you pasted.' };
    }
    blocks.push(text.slice(start));
  }

  // Strict reading: a block that is not JSON is kept as it is, with its
  // problems, by the caller.
  let long = 0;
  const data: unknown[] = [];
  for (const block of blocks) {
    const numbers = longNumbers(block);
    long += numbers.count;
    try {
      data.push(JSON.parse(numbers.text));
    } catch {
      return { ...result, text: null, error: null, ...(blocks.length === 1 && block !== paste.trim() && { kept: block }) };
    }
  }

  // Flattened: lists, @graph, each block's own context.
  const items: Record<string, unknown>[] = [];
  let split = false;
  let context = false;
  let otherContext = false;
  let schemaContext = false;
  const take = (value: unknown, outer: unknown) => {
    if (Array.isArray(value)) {
      split = true;
      value.forEach((one) => take(one, outer));
      return;
    }
    if (!isObject(value)) return;
    const own = '@context' in value ? value['@context'] : outer;
    if (Array.isArray(value['@graph'])) {
      split = true;
      if ('@context' in value) context = true;
      value['@graph'].forEach((one) => take(one, own));
      return;
    }
    const item = { ...value };
    if (own !== undefined) {
      const schema = (Array.isArray(own) ? own : [own]).every(
        (one) => (typeof one === 'string' && SCHEMA.test(one)) || (isObject(one) && typeof one['@vocab'] === 'string' && SCHEMA.test(one['@vocab'])),
      );
      if (schema) {
        delete item['@context'];
        context = true;
        schemaContext = true;
      } else {
        item['@context'] = own;
        otherContext = true;
      }
    }
    items.push(item);
  };
  data.forEach((one) => take(one, undefined));
  if (!items.length) {
    return { ...result, error: 'No JSON-LD found in what you pasted.' };
  }
  if (split && items.length > 1) clauses.push(`split the graph into ${items.length} items`);
  if (context) clauses.push('removed the context line');

  // Values: short names, empties dropped, wrappers unwrapped, ids named.
  let short = false;
  let empties = 0;
  let unwrapped = false;
  let language = false;
  let pointed = 0;
  let named = 0;
  const blank = new Map<string, string>();
  const taken = new Set<string>([...(ctx.taken ?? []), ...items.map((item) => item['@id']).filter((id): id is string => typeof id === 'string')]);
  const moduleIds = ctx.moduleIds ?? MODULE_IDS;
  const shorten = (name: string) => {
    const next = name.replace(/^schema:/, '').replace(SCHEMA, '');
    if (next !== name) short = true;
    return next;
  };
  const id = (raw: string): string => {
    if (raw.startsWith('_:')) {
      if (!blank.has(raw)) {
        // Named from the item it names: "#open-studio-day", not "#b0".
        const owner = items.find((item) => (item['@id'] ?? item.id) === raw);
        const name = owner && Object.entries(owner).find(([key]) => /^(https?:\/\/schema\.org\/|schema:)?name$/.test(key))?.[1];
        blank.set(raw, mint({ name: typeof name === 'string' ? name : raw.slice(2) }, taken, moduleIds));
        named++;
      }
      return blank.get(raw)!;
    }
    for (const name of moduleIds) {
      const anchored = `${ctx.home}#${name}`;
      const page = `${ctx.url}#${name}`;
      if (raw === anchored || raw === page) {
        pointed++;
        return `#${name}`;
      }
    }
    return raw;
  };
  const tidy = (value: unknown, key: string | null): unknown => {
    if (Array.isArray(value)) {
      // Text given in several languages: the page's.
      if (value.length && value.every((one) => isObject(one) && '@value' in one && '@language' in one)) {
        language = true;
        const mine = value.find((one) => String((one as Record<string, unknown>)['@language']).toLowerCase().startsWith(ctx.langcode.toLowerCase()));
        return tidy(((mine ?? value[0]) as Record<string, unknown>)['@value'], key);
      }
      const list = value.map((one) => tidy(one, key)).filter((one) => one !== undefined);
      if (!list.length) {
        empties++;
        return undefined;
      }
      return list;
    }
    if (isObject(value)) {
      if ('@value' in value) {
        unwrapped = true;
        if ('@language' in value) language = true;
        return tidy(value['@value'], key);
      }
      if ('@list' in value || '@set' in value) {
        unwrapped = true;
        return tidy(value['@list'] ?? value['@set'], key);
      }
      // No prototype: a pasted "__proto__" stays a key, never the prototype.
      const out: Record<string, unknown> = Object.create(null);
      for (let [name, item] of Object.entries(value)) {
        if (name === '@language') {
          language = true;
          continue;
        }
        if (schemaContext && (name === 'type' || name === 'id')) {
          name = `@${name}`;
          short = true;
        }
        name = name.startsWith('@') ? name : shorten(name);
        if (name === '@type') {
          item = Array.isArray(item) ? item.map((one) => (typeof one === 'string' ? shorten(one) : one)) : typeof item === 'string' ? shorten(item) : item;
        } else if (name === '@id' && typeof item === 'string') {
          item = id(item);
        } else {
          item = tidy(item, name);
        }
        if (item !== undefined) out[name] = item;
      }
      if (!Object.keys(out).length) {
        empties++;
        return undefined;
      }
      return out;
    }
    if (value === null || value === '') {
      empties++;
      return undefined;
    }
    if (typeof value === 'string') {
      if (/&(amp|lt|gt|quot|#39|#x27|nbsp);/.test(value) && !result.notes.includes('Some values look HTML-escaped (&amp;amp;).')) {
        result.notes.push('Some values look HTML-escaped (&amp;amp;).');
      }
      if (/\{\{.*\}\}|%%[^%]+%%|\[[a-z]+:[a-z_-]+\]/i.test(value) && !result.notes.includes("Some values look like another system's placeholders.")) {
        result.notes.push("Some values look like another system's placeholders.");
      }
    }
    return value;
  };
  const cleaned: Record<string, unknown>[] = [];
  for (const item of items) {
    const one = tidy(item, null);
    if (isObject(one)) cleaned.push(one);
  }
  // Items without an @id get one, so that they can be pointed at.
  let given = 0;
  const final = cleaned.map((item) => {
    if (typeof item['@id'] === 'string') return item;
    given++;
    return { '@type': item['@type'], '@id': mint(item, taken, moduleIds), ...Object.fromEntries(Object.entries(item).filter(([key]) => key !== '@type')) };
  });
  if (short) clauses.push('used short names');
  if (empties) clauses.push(plural(empties, 'left out 1 empty value', 'left out @count empty values'));
  if (unwrapped && !language) clauses.push('took values out of their wrappers');
  if (language) clauses.push('kept the text in the page’s language');
  if (pointed) clauses.push(plural(pointed, "pointed 1 link at your site's own items", "pointed @count links at your site's own items"));
  if (named) clauses.push(plural(named, 'named 1 unnamed item', 'named @count unnamed items'));
  if (given) clauses.push(plural(given, 'gave 1 item a name so it can be linked', 'gave @count items a name so they can be linked'));
  if (long) clauses.push(plural(long, 'wrote 1 long number as text', 'wrote @count long numbers as text'));
  if (otherContext) result.notes.push('Another vocabulary’s context was kept: the server refuses it.');

  const output = final.length === 1 ? final[0] : final;
  const formatted = JSON.stringify(output, null, 2);
  const text2 = formatted.length <= 65536 ? formatted : JSON.stringify(output);
  return {
    ...result,
    text: text2,
    items: final,
    report: clauses.length || text2 !== paste.trim() ? `Cleaned up the paste: ${joined(clauses.length ? clauses : ['formatted it'])}.` : null,
  };
}
