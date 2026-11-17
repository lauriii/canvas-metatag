/**
 * One JSON text, read and changed without moving a byte it does not change.
 *
 * Hand-added JSON-LD is stored as written. Form and JSON both edit the same
 * text: Form reads a projection of it and writes one value at a time with
 * jsonc-parser's `modify`, so only that value's bytes (and the comma or
 * indent it needs) change. Comments and trailing commas are refused, as the
 * server refuses them.
 */
import {
  applyEdits,
  findNodeAtLocation,
  format as formatEdits,
  getLocation,
  modify,
  parseTree,
  printParseErrorCode,
  type JSONPath,
  type Node,
  type ParseError,
} from 'jsonc-parser';

export type Path = (string | number)[];

/** One problem with a place: the line where the fix goes. */
export interface Problem {
  /** Red is exactly what the server refuses; amber is advice. */
  tone: 'red' | 'amber';
  /** 1-based. */
  line: number;
  /** Where in the text, for "Go to line". */
  offset: number;
  /** The path inside the text, items included. */
  path: Path;
  /** "Line 6 · ratingValue: a comma is missing after 4.2." */
  message: string;
  /** The same without its place, for the form's row: "A comma is missing after 4.2." */
  words?: string;
  /** At most one fix. */
  fix?: { label: string; apply: (text: string) => string };
}

const OPTIONS = { disallowComments: true, allowTrailingComma: false, allowEmptyContent: true };
const FORMAT = { insertSpaces: true, tabSize: 2, eol: '\n' };

/** The line (1-based) an offset is on. */
export function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let at = 0; at < offset && at < text.length; at++) {
    if (text.charCodeAt(at) === 10) line++;
  }
  return line;
}

/** The offset a line (1-based) starts at. */
export function offsetOfLine(text: string, line: number): number {
  let at = 0;
  for (let n = 1; n < line; n++) {
    const next = text.indexOf('\n', at);
    if (next < 0) return text.length;
    at = next + 1;
  }
  return at;
}

/** A path as people read it: "itemReviewed › sameAs", items left out. */
export const shownPath = (path: Path): string =>
  path.filter((part): part is string => typeof part === 'string').join(' › ');

/** The text's tree, or null when it has a syntax problem. */
export function tree(text: string): Node | null {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, OPTIONS);
  return errors.length ? null : (root ?? null);
}

/** The value of the text, or undefined when it does not parse. */
export function value(text: string): unknown {
  if (text.trim() === '') return undefined;
  try {
    return tree(text) ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

/** The node at a path, with its place in the text. `root`: the text's tree, read once by the caller. */
export function nodeAt(text: string, path: Path, root: Node | null = tree(text)): Node | undefined {
  return root ? findNodeAtLocation(root, path as JSONPath) : undefined;
}

/** The path of the value or key under an offset. */
export function pathAt(text: string, offset: number): Path {
  const location = getLocation(text, offset);
  return location.path as Path;
}

/**
 * Sets one value; only its bytes change (R2).
 *
 * `undefined` removes it.
 */
export function set(text: string, path: Path, next: unknown): string {
  if (text.trim() === '') {
    return path.length ? set('{}', path, next) : JSON.stringify(next, null, 2);
  }
  return applyEdits(text, modify(text, path as JSONPath, next, { formattingOptions: FORMAT }));
}

/** Two spaces, keys in order. */
export function format(text: string): string {
  return applyEdits(text, formatEdits(text, undefined, FORMAT));
}

/** The words for a syntax problem; never the engine's message. */
const SYNTAX: Record<string, string> = {
  InvalidSymbol: 'this is not JSON.',
  InvalidNumberFormat: 'this number is not written as JSON writes numbers.',
  PropertyNameExpected: 'a name in double quotes is missing.',
  ValueExpected: 'a value is missing.',
  ColonExpected: 'a colon is missing after the name.',
  CommaExpected: 'a comma is missing',
  CloseBraceExpected: 'The code ends before every { has its }.',
  CloseBracketExpected: 'The code ends before every [ has its ].',
  EndOfFileExpected: 'there is more after the end. Keep one item, or put the items in a list: [ … ].',
  InvalidCommentToken: "JSON can't have comments.",
  UnexpectedEndOfComment: "JSON can't have comments.",
  UnexpectedEndOfString: 'this text has no closing quote.',
  UnexpectedEndOfNumber: 'this number is cut off.',
  InvalidUnicode: 'this text has a broken character.',
  InvalidEscapeCharacter: 'this text has a backslash JSON does not know.',
  InvalidCharacter: 'this text has a character JSON needs escaped.',
};

/** The syntax problems of a text, each on the line where the fix goes. */
export function syntax(text: string): Problem[] {
  const errors: ParseError[] = [];
  parseTree(text, errors, OPTIONS);
  // One cause gives many errors after it: only the first is said.
  return errors.slice(0, 1).map((error) => {
    const code = printParseErrorCode(error.error);
    let offset = error.offset;
    let words = SYNTAX[code] ?? 'this is not valid JSON.';
    let fix: Problem['fix'];
    if (code === 'CommaExpected' || (code === 'PropertyNameExpected' && /[,]\s*$/.test(text.slice(0, offset)))) {
      // The comma goes after the value before: that line.
      let end = offset;
      while (end > 0 && /\s/.test(text[end - 1])) end--;
      if (code === 'PropertyNameExpected') {
        // A trailing comma: it is the problem.
        const comma = end - 1;
        offset = comma;
        words = `remove the comma before ${text.slice(error.offset, error.offset + 1)}.`;
        fix = { label: 'Remove the comma', apply: (current) => current.slice(0, comma) + current.slice(comma + 1) };
      } else {
        offset = end;
        const before = /("(?:[^"\\]|\\.)*"|[^\s,:[\]{}]+|[}\]])$/.exec(text.slice(0, end))?.[0] ?? '';
        words = `a comma is missing after ${before.length > 24 ? `${before.slice(0, 23)}…` : before}.`;
        fix = { label: 'Add the comma', apply: (current) => `${current.slice(0, end)},${current.slice(end)}` };
      }
    } else if (code === 'InvalidSymbol' && /^['‘’“”]/.test(text.slice(offset))) {
      words = 'use double quotes (") around names and text.';
    } else if (code === 'InvalidSymbol' && text.startsWith('/', offset)) {
      words = "JSON can't have comments.";
    }
    // A fix is offered only when the text then reads past this point.
    if (fix) {
      const fixed = fix.apply(text);
      const after: ParseError[] = [];
      parseTree(fixed, after, OPTIONS);
      if (after.length && after[0].offset - (fixed.length - text.length) <= error.offset) fix = undefined;
    }
    const path = pathAt(text, Math.max(0, offset - 1));
    return { tone: 'red', line: lineOf(text, offset), offset, path, message: words, ...(fix && { fix }) };
  });
}

/** The property of an object at a path: its key and value nodes. */
export function propertyAt(text: string, path: Path, root: Node | null = tree(text)): Node | undefined {
  const name = path[path.length - 1];
  if (typeof name !== 'string') return undefined;
  const object = nodeAt(text, path.slice(0, -1), root);
  // The last of two equal keys is the one JSON keeps.
  return [...(object?.children ?? [])].reverse().find((property) => property.children?.[0]?.value === name);
}

/** The offset of a JSON pointer's value, or of the closest value above it. */
export function offsetOf(text: string, path: Path, root: Node | null = tree(text)): number {
  for (let length = path.length; length >= 0; length--) {
    const node = nodeAt(text, path.slice(0, length), root);
    if (node) {
      // A value's line is its key's line.
      return propertyAt(text, path.slice(0, length), root)?.offset ?? node.offset;
    }
  }
  return 0;
}

/** A line counter for one text: the lines are found once. */
export function lines(text: string): (offset: number) => number {
  const starts = [0];
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) starts.push(at + 1);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}

/**
 * Items added after a text's own, as text: the bytes already there never
 * change (R2). `snippets` are each one item's JSON as it should read; a list
 * gets them before its `]`, one object becomes a list of it and them, an
 * empty text becomes the one item or a list.
 */
export function append(text: string, snippets: string[]): string {
  if (!snippets.length) return text;
  const at = (snippet: string, indent: string) => snippet.replace(/\n/g, `\n${indent}`);
  const root = tree(text);
  if (text.trim() === '' || !root) {
    return snippets.length === 1 ? snippets[0] : `[\n${snippets.map((one) => `  ${at(one, '  ')}`).join(',\n')}\n]`;
  }
  if (root.type === 'array') {
    const children = root.children ?? [];
    const close = root.offset + root.length - 1;
    if (!children.length) {
      return `${text.slice(0, root.offset + 1)}\n${snippets.map((one) => `  ${at(one, '  ')}`).join(',\n')}\n${text.slice(close)}`;
    }
    const last = children[children.length - 1];
    const end = last.offset + last.length;
    const first = children[0];
    // A list on one line takes them on that line; else each on its own, at the first item's indent.
    if (!text.slice(root.offset, first.offset).includes('\n')) {
      return `${text.slice(0, end)}, ${snippets.map((one) => one.replace(/\n[ \t]*/g, ' ')).join(', ')}${text.slice(end)}`;
    }
    const indent = /[ \t]*$/.exec(text.slice(0, first.offset))![0];
    return `${text.slice(0, end)}${snippets.map((one) => `,\n${indent}${at(one, indent)}`).join('')}${text.slice(end)}`;
  }
  // One item: a list of it, as written, and the new ones.
  const start = root.offset;
  const end = root.offset + root.length;
  return `${text.slice(0, start)}[\n  ${at(text.slice(start, end), '  ')}${snippets.map((one) => `,\n  ${at(one, '  ')}`).join('')}\n]${text.slice(end)}`;
}

/** One item's JSON as the sheet writes a new one: two spaces. */
export const pretty = (item: unknown) => JSON.stringify(item, null, 2);

/**
 * The items of a JSON text as they are written, each re-homed to column 0:
 * what a paste gives `append()` without re-encoding it.
 */
export function rawItems(text: string): string[] {
  const root = tree(text);
  if (!root) return [];
  const slice = (node: Node) => {
    const column = node.offset - (text.lastIndexOf('\n', node.offset - 1) + 1);
    const raw = text.slice(node.offset, node.offset + node.length);
    // Lines after the first lose the item's own indent.
    return column > 0 ? raw.replace(new RegExp(`\n[ \t]{0,${column}}`, 'g'), '\n') : raw;
  };
  return root.type === 'array' ? (root.children ?? []).map(slice) : [slice(root)];
}

/** Two values of a list change places as written: no other byte moves. */
export function swap(text: string, path: Path, a: number, b: number): string {
  const list = nodeAt(text, path);
  const x = list?.children?.[Math.min(a, b)];
  const y = list?.children?.[Math.max(a, b)];
  if (list?.type !== 'array' || !x || !y || x === y) return text;
  const raw = (node: Node) => text.slice(node.offset, node.offset + node.length);
  return text.slice(0, x.offset) + raw(y) + text.slice(x.offset + x.length, y.offset) + raw(x) + text.slice(y.offset + y.length);
}

/** A pointer ("/offers/0/price") as a path. */
export const fromPointer = (pointer: string): Path =>
  pointer === ''
    ? []
    : pointer
        .slice(1)
        .split('/')
        .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
        .map((part) => (/^\d+$/.test(part) ? Number(part) : part));

/** The items of a text: one object, or a list. */
export function items(data: unknown): unknown[] {
  return Array.isArray(data) ? data : data === undefined ? [] : [data];
}

/** The path of an item inside the text: [] for one object, [n] in a list. */
export const itemPath = (data: unknown, item: number): Path => (Array.isArray(data) ? [item] : []);

/**
 * Keys that appear twice in one object, with the offset of the first.
 *
 * JSON keeps the last; the dialog warns, and a form never edits such an item.
 */
export function duplicates(text: string): { path: Path; key: string; offset: number; length: number }[] {
  const root = tree(text);
  const found: { path: Path; key: string; offset: number; length: number }[] = [];
  const walk = (node: Node, path: Path) => {
    if (node.type === 'object') {
      const seen = new Map<string, Node>();
      for (const property of node.children ?? []) {
        const [key, child] = property.children ?? [];
        if (!key || typeof key.value !== 'string') continue;
        const first = seen.get(key.value);
        if (first) {
          found.push({ path: [...path, key.value], key: key.value, offset: first.offset, length: first.length });
        } else {
          seen.set(key.value, property);
        }
        if (child) walk(child, [...path, key.value]);
      }
    } else if (node.type === 'array') {
      (node.children ?? []).forEach((child, index) => walk(child, [...path, index]));
    }
  };
  if (root) walk(root, []);
  return found;
}
