/**
 * The server's rules for hand-added JSON-LD, in the dialog.
 *
 * A mirror of Values::checkCustom(): red in the sheet is exactly what the
 * server refuses. Both run tests/fixtures/custom/ (validate.test.ts and
 * ValuesTest::testSharedFixtures), so the two cannot drift apart.
 */

export interface Refusal {
  message: string;
  /** The item it is in. */
  item: number;
  /** A JSON pointer inside that item. */
  path: string;
}

export interface Checked {
  /** The trimmed text; null for nothing to store or a refusal. */
  text: string | null;
  data: unknown;
  /** The bytes of its minified encoding: all hand-added text shares 32 KB. */
  size: number;
  error: Refusal | null;
}

export interface Mode {
  /** Added details to a node of these types. */
  extend?: string[];
  /** The site's public base: an absolute id on it is checked too. */
  origin?: string | null;
}

/** The ids the module emits (served in /state as `module_ids`). */
export const MODULE_IDS = ['identity', 'logo', 'website', 'return-policy', 'webpage', 'primaryimage', 'primary', 'group', 'breadcrumb'];

export const CUSTOM_MAX = 32768;
export const CUSTOM_RAW_MAX = 65536;

const SHAPE = 'Use one object, or a list of up to 10 objects, each with "@type".';
const DEEP = 'Too deeply nested (items and lists count). Keep to 8.';
const AT_KEYS = 'Only “@type”, “@id” and a schema.org “@context” may start with @.';
const CONTEXT = /^https?:\/\/schema\.org\/?$/;
export const SELECTOR = /^[A-Za-z][A-Za-z0-9_-]*\[(\*|name=[^\]]{1,200})\]$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** UTF-8 bytes. */
export const bytes = (text: string) => new TextEncoder().encode(text).length;

/** As Values::isHttpUrl(): absolute http(s), a host, no credentials. */
export function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) && parsed.hostname !== '' && parsed.username === '' && parsed.password === '' && !/\s/.test(url);
  } catch {
    return false;
  }
}

/** Whether a hand-added item's @id is one of the module's. */
export function reserved(id: string, origin?: string | null, ids: string[] = MODULE_IDS): boolean {
  let name: string | null = null;
  if (id.startsWith('#')) {
    name = id.slice(1);
  } else if (origin && id.replace(/^https?:/i, '').startsWith(`${origin.replace(/^https?:/i, '').replace(/\/$/, '')}/`) && id.includes('#')) {
    name = id.slice(id.indexOf('#') + 1);
  }
  return name !== null && (ids.includes(name) || name.startsWith('c-'));
}

/** Whether a pasted @context is schema.org's. */
export function isContext(context: unknown): boolean {
  const one = (item: unknown) =>
    (typeof item === 'string' && CONTEXT.test(item)) ||
    (isObject(item) && Object.keys(item).length === 1 && typeof item['@vocab'] === 'string' && CONTEXT.test(item['@vocab']));
  return Array.isArray(context) ? context.length > 0 && context.every(one) : one(context);
}

/**
 * The script, data or file scheme a string starts with, as Values::scheme().
 *
 * Address parsers drop tabs and line breaks ("java\tscript:"), so they are
 * dropped before the colon too.
 */
export function scheme(value: string): string | null {
  const colon = value.indexOf(':');
  if (colon < 0) return null;
  const probe = value.slice(0, colon).replace(/[\t\n\r]/g, '') + value.slice(colon);
  // ASCII spaces only, as the server's pattern reads them.
  const found = /^[ \x00-\x1F]*(javascript|vbscript)[ \t\n\x0B\f\r]*:/i.exec(probe) ?? /^[ \x00-\x1F]*(data|file):[\t\n\r]*(?=[^ \t\n\x0B\f\r])/i.exec(probe);
  return found ? found[1].toLowerCase() : null;
}

const typeProblem = (type: unknown) => {
  const types = Array.isArray(type) ? type : [type];
  return types.length > 0 && types.length <= 4 && types.every((one) => typeof one === 'string' && one.trim() !== '')
    ? null
    : '@type: use one type, or a list of up to 4 types.';
};

/** A lone surrogate: PHP refuses the text, JavaScript keeps it. */
const broken = (value: unknown): boolean =>
  typeof value === 'string'
    ? /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF]))|(?:(?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/.test(value)
    : Array.isArray(value)
      ? value.some(broken)
      : isObject(value)
        ? Object.entries(value).some(([key, item]) => broken(key) || broken(item))
        : false;

const nesting = (value: unknown): number =>
  Array.isArray(value) ? 1 + Math.max(0, ...value.map(nesting)) : isObject(value) ? 1 + Math.max(0, ...Object.values(value).map(nesting)) : 0;

const pointer = (path: (string | number)[]) =>
  path.map((part) => `/${String(part).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');

/** The first problem in one value, and its path inside the item. */
function walk(value: unknown, depth: number, at: (string | number)[], role: 'item' | 'extend' | '' = ''): [string, (string | number)[]] | null {
  const label = at.filter((part): part is string => typeof part === 'string').join(' › ');
  const say = (text: string): [string, (string | number)[]] => [label === '' ? text.charAt(0).toUpperCase() + text.slice(1) : `${label}: ${text}`, at];
  if (typeof value === 'string') {
    const found = scheme(value);
    return found ? say(`text can’t start with “${found}:”.`) : null;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return say('this number is too large to use.');
  }
  if (value === null) {
    return [`${label === '' ? 'This' : label} is empty (null). Remove it or give it a value.`, at];
  }
  if (typeof value !== 'object') {
    return null;
  }
  if (depth > 8) {
    return say('too deeply nested (items and lists count). Keep to 8.');
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const problem = walk(item, depth + 1, [...at, index]);
      if (problem) return problem;
    }
    return null;
  }
  for (const [key, item] of Object.entries(value)) {
    const path = [...at, key];
    if (key.startsWith('@')) {
      let problem: string | null = null;
      if (key === '@type') {
        const found = (Array.isArray(item) ? item : [item]).filter((one): one is string => typeof one === 'string').map(scheme).find(Boolean);
        problem = typeProblem(item) ?? (found ? `@type: text can’t start with “${found}:”.` : null);
      } else if (key === '@id') {
        problem =
          role === 'extend'
            ? '@id: the id of this item can’t change. Leave @id out.'
            : typeof item !== 'string' || (!/^#\S+$/u.test(item) && !isHttpUrl(item))
              ? '@id: use a full address, or a name that starts with #.'
              : null;
      } else if (key === '@context') {
        problem = role === 'item' && isContext(item) ? null : AT_KEYS;
      } else {
        problem = AT_KEYS;
      }
      if (problem !== null) {
        return [
          label === '' ? problem : problem === AT_KEYS ? `${label}: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}` : `${label} › ${problem}`,
          path,
        ];
      }
      continue;
    }
    if (role === 'extend' && key.includes('[') && !SELECTOR.test(key)) {
      return [`“${key}”: name one item with [name=…], or every item with [*].`, path];
    }
    const problem = walk(item, depth + 1, path);
    if (problem) return problem;
  }
  return null;
}

/** Checks a hand-added text, or added details, as the server will. */
export function check(input: string, mode: Mode = {}, ids: string[] = MODULE_IDS): Checked {
  const result: Checked = { text: null, data: undefined, size: 0, error: null };
  const fail = (message: string, item = 0, path = ''): Checked => ({ ...result, text: null, error: { message, item, path } });
  // As the server trims: spaces and byte order marks, not every space.
  const text = input.replace(/^[ \t\n\r\0\x0B\uFEFF]+|[ \t\n\r\0\x0B\uFEFF]+$/g, '');
  if (/^[\s\uFEFF]*$/.test(text)) {
    return result;
  }
  if (bytes(text) > CUSTOM_RAW_MAX) {
    return fail(`${Math.ceil(bytes(text) / 1024)} KB as written. Keep under ${CUSTOM_RAW_MAX / 1024} KB.`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail('This is not valid JSON.');
  }
  if (nesting(data) > 64) {
    return fail(DEEP);
  }
  if (broken(data)) {
    return fail('This text has a broken character.');
  }
  let nodes: unknown[];
  if (mode.extend) {
    if (!isObject(data)) {
      return fail('Use one object of details, like {"sku": "…"}.');
    }
    nodes = [data];
  } else {
    nodes = Array.isArray(data) ? data : [data];
    if (nodes.length > 10) {
      return fail(`${nodes.length} items. Keep up to 10.`, 10);
    }
  }
  const seen = new Set<string>();
  for (const [index, node] of nodes.entries()) {
    if (!isObject(node)) {
      return fail(SHAPE, index);
    }
    if (!mode.extend && !('@type' in node)) {
      return fail('“@type” is missing.', index);
    }
    const problem = walk(node, 1, [], mode.extend ? 'extend' : 'item');
    if (problem) {
      return fail(problem[0], index, pointer(problem[1]));
    }
    if (mode.extend && '@type' in node) {
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (!types.some((one) => mode.extend!.includes(one as string))) {
        return fail(`@type: a type can only be added to “${mode.extend[0]}”, in a list that keeps it.`, index, '/@type');
      }
    }
    const id = node['@id'];
    if (!mode.extend && typeof id === 'string') {
      if (reserved(id, mode.origin, ids)) {
        // The breadcrumb trail's id is kept even where no breadcrumb shows,
        // and has no details to add.
        return fail(
          id.endsWith('#breadcrumb') ? `“${id}” is kept for the breadcrumb trail of the page. Give the item another @id.` : `“${id}” is made by this page. Use Add details, or give the item another @id.`,
          index,
          '/@id',
        );
      }
      if (seen.has(id)) {
        return fail(`“${id}” is used by two items. Give the second another @id.`, index, '/@id');
      }
      seen.add(id);
    }
  }
  if (!nodes.length) {
    return result;
  }
  return { text, data, size: bytes(JSON.stringify(data)), error: null };
}
