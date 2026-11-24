/**
 * Every problem of a hand-added text, each with a place and plain words.
 *
 * "Line ‹n› · ‹path›: ‹what is wrong›." on the line where the fix goes, with
 * at most one fix. Red is exactly what the server refuses (syntax and
 * validate.ts) and blocks saving; amber is advice and never blocks.
 */
import { kinds } from '../features';
import type { SearchFeatures } from '../types';
import { duplicates, fromPointer, itemPath, lines, nodeAt, offsetOf, propertyAt, set, shownPath, syntax, tree, type Path, type Problem } from './doc';
import { aType, expectsOf, typesOf } from './project';
import { check, CUSTOM_MAX, isContext, isHttpUrl, type Mode } from './validate';
import { detailsOf, type Vocabulary } from './vocab';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Two names that differ by case, one letter, or two letters swapped. */
export function near(a: string, b: string): boolean {
  if (a === b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  // One edit or one swap.
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  if (x.slice(i + 1) === y.slice(i + 1) || x.slice(i) === y.slice(i + 1) || x.slice(i + 1) === y.slice(i)) return true;
  return x[i] === y[i + 1] && x[i + 1] === y[i] && x.slice(i + 2) === y.slice(i + 2);
}

/** Names the rules file documents for some types. */
function documented(types: string[], rules: SearchFeatures): string[] {
  return [
    ...new Set(
      Object.values(rules.features)
        .filter((feature) => types.some((type) => feature.on.includes(type)))
        .flatMap((feature) => feature.names ?? []),
    ),
  ];
}

const IDENTIFIERS = ['gtin', 'gtin8', 'gtin12', 'gtin13', 'gtin14', 'isbn', 'sku', 'mpn', 'postalCode', 'telephone'];

/** A sentence starts with a capital. */
const sentenceOf = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);

/** File endings that make "photo.jpg" a file name, not a host. */
const FILES = /\.(jpe?g|png|gif|webp|avif|svg|pdf|html?|php|aspx?|txt|json|xml|mp4|mp3|zip)$/i;

/**
 * An address without its scheme, when it reads as a host ("acme.com/jobs"):
 * a dot, a suffix of letters, no file ending. Null for anything else.
 */
export function withScheme(value: string): string | null {
  const m = /^([\w-]+(?:\.[\w-]+)+)(\/\S*)?$/.exec(value);
  if (!m || FILES.test(m[1]) || !/\.[a-z]{2,24}$/i.test(m[1])) return null;
  return `https://${value}`;
}

/**
 * The problems of a text.
 *
 * `others`: the minified bytes of the scope's other hand-added texts, which
 * share CUSTOM_MAX with this one: over it is red, as the server refuses it.
 */
export function problems(text: string, rules: SearchFeatures, vocabulary: Vocabulary | null, mode: Mode = {}, tidy?: (text: string) => string | null, others = 0): Problem[] {
  if (text.trim() === '') return [];
  // Read once: every place below looks it up in the same tree.
  const root = tree(text);
  const lineOf = lines(text);
  const at = (path: Path) => offsetOf(text, path, root);
  const place = (path: Path, words: string, tone: Problem['tone'], fix?: Problem['fix']): Problem => {
    const offset = at(path);
    const line = lineOf(offset);
    const shown = shownPath(path);
    return { tone, line, offset, path, message: `Line ${line}${shown ? ` · ${shown}` : ''}: ${words}`, words: sentenceOf(words), ...(fix && { fix }) };
  };
  const found: Problem[] = syntax(text).map((problem) => ({
    ...problem,
    message: `Line ${problem.line}${shownPath(problem.path) ? ` · ${shownPath(problem.path)}` : ''}: ${problem.message}`,
    words: sentenceOf(problem.message),
  }));
  if (found.length) {
    // A script tag, @graph or context left in: the paste clean-up fixes it.
    const tidied = tidy && /<script|@graph|@context/i.test(text) ? tidy(text) : null;
    if (tidied && tidied !== text) found[0] = { ...found[0], fix: { label: 'Clean up', apply: () => tidied } };
    return found;
  }

  const data = JSON.parse(text) as unknown;
  const checked = check(text, mode);
  if (checked.error) {
    // A refusal of the whole text (its size, its count) is on its first line.
    const whole = checked.error.path === '' && /KB|items\. Keep/.test(checked.error.message);
    const path = whole ? [] : [...(mode.extend ? [] : itemPath(data, checked.error.item)), ...fromPointer(checked.error.path)];
    // The server's sentence names its path; the line names the place.
    const words = checked.error.message;
    const offset = at(path);
    const line = lineOf(offset);
    const shown = shownPath(fromPointer(checked.error.path));
    const plain = sentenceOf(shown && words.startsWith(shown) ? words.slice(shown.length).replace(/^( ›|:) /, '') : words);
    const context = path[path.length - 1] === '@context' ? path.reduce<unknown>((value, part) => (value !== null && typeof value === 'object' ? (value as Record<string | number, unknown>)[part] : undefined), data) : undefined;
    let fix: Problem['fix'];
    if (context !== undefined && !isContext(context)) {
      // Another vocabulary's context: only removing it fixes it.
      fix = { label: 'Remove the context', apply: (current) => set(current, path, undefined) };
    } else {
      // A schema.org context, @graph or script tag left in: the paste clean-up fixes it.
      const tidied = tidy && (/@context|@graph/.test(checked.error.path) || /@graph|@context/.test(text)) ? tidy(text) : null;
      // Offered only when it takes this problem away.
      const after = tidied && tidied !== text ? problems(tidied, rules, null, mode).find((one) => one.tone === 'red') : undefined;
      if (tidied && tidied !== text && after?.words !== plain) fix = { label: 'Clean up', apply: () => tidied };
    }
    found.push({
      tone: 'red',
      line,
      offset,
      path,
      message: shown && words.startsWith(`${shown}`) ? `Line ${line} · ${words}` : `Line ${line}: ${words}`,
      words: plain,
      ...(fix && { fix }),
    });
  } else if (checked.size + others > CUSTOM_MAX) {
    // The 32 KB every hand-added text of the page shares, minified: the server's sentence.
    const words = `${Math.ceil((checked.size + others) / 1024)} KB. Keep under ${CUSTOM_MAX / 1024} KB, including added details.`;
    found.push({ tone: 'red', line: 1, offset: 0, path: [], message: `Line 1: ${words}`, words });
  }

  // Advice.
  for (const duplicate of duplicates(text)) {
    found.push({
      tone: 'amber',
      line: lineOf(duplicate.offset),
      offset: duplicate.offset,
      path: duplicate.path,
      message: `Line ${lineOf(duplicate.offset)} · ${shownPath(duplicate.path)}: “${duplicate.key}” appears twice. Only the second is used.`,
      words: `“${duplicate.key}” appears twice. Only the second is used.`,
      fix: {
        label: 'Remove the first',
        apply: (current) => {
          let end = duplicate.offset + duplicate.length;
          while (/[\s,]/.test(current[end] ?? '') && current[end] !== '\n') end++;
          if (current[end] === '\n') end++;
          let start = duplicate.offset;
          while (start > 0 && /[ \t]/.test(current[start - 1])) start--;
          return current.slice(0, start) + current.slice(end);
        },
      },
    });
  }
  const items = mode.extend ? [data] : Array.isArray(data) ? data : [data];
  items.forEach((item, index) => {
    if (!isObject(item)) return;
    const base = mode.extend ? [] : itemPath(data, index);
    const types = mode.extend ?? typesOf(item);
    const own = vocabulary && types.some((type) => vocabulary.types[type]) ? new Set(detailsOf(vocabulary, types)) : null;
    const names = documented(types, rules);
    const walk = (value: unknown, path: Path, key: string | null, parentTypes: string[]) => {
      if (Array.isArray(value)) {
        value.forEach((one, i) => walk(one, [...path, i], key, parentTypes));
        // Positions out of order.
        const positions = value.map((one) => (isObject(one) ? one.position : undefined));
        if (positions.some((one) => one !== undefined) && positions.some((one, i) => Number(one) !== i + 1)) {
          found.push(
            place(path, 'Positions aren’t 1, 2, 3 in order.', 'amber', {
              label: 'Number them in order',
              apply: (current) => value.reduce<string>((acc, _, i) => (isObject(value[i]) ? set(acc, [...path, i, 'position'], i + 1) : acc), current),
            }),
          );
        }
        return;
      }
      if (isObject(value)) {
        const objectTypes = typesOf(value).length ? typesOf(value) : parentTypes;
        const allowed = objectTypes === types ? names : documented(objectTypes, rules);
        for (const [name, child] of Object.entries(value)) {
          if (name.startsWith('@')) continue;
          // A misspelt documented name; with the vocabulary, any name.
          const known = allowed.includes(name) || (own && path.length === base.length ? own.has(name) : vocabulary?.properties[name] !== undefined);
          if (!known) {
            const guess = allowed.find((one) => near(name, one)) ?? (vocabulary ? Object.keys(vocabulary.properties).find((one) => near(name, one)) : undefined);
            if (guess) {
              const label = objectTypes[0] ? aType(objectTypes[0], rules) : 'this item';
              found.push(
                place([...path, name], `${name} isn't a detail of ${label}. Did you mean ${guess}?`, 'amber', {
                  label: `Use ${guess}`,
                  apply: (current) => {
                    const keyNode = propertyAt(current, [...path, name], tree(current))?.children?.[0];
                    return keyNode ? `${current.slice(0, keyNode.offset)}${JSON.stringify(guess)}${current.slice(keyNode.offset + keyNode.length)}` : current;
                  },
                }),
              );
            }
          }
          walk(child, [...path, name], name, objectTypes);
        }
        return;
      }
      if (key === null) return;
      const spec = expectsOf(key, parentTypes, rules);
      if (typeof value === 'string') {
        // An enumeration value spelt nearly right.
        const enums = spec ? kinds(typeof spec === 'string' ? spec : spec.is).filter(([kind]) => kind === 'enum').flatMap(([, list]) => list) : [];
        const bare = value.replace(/^https?:\/\/schema\.org\//, '');
        if (enums.length && !enums.includes(bare)) {
          const guess = enums.find((one) => near(bare, one));
          if (guess) {
            found.push(
              place(path, `“${bare}” isn't a value search engines document for ${key}. Did you mean “${guess}”?`, 'amber', {
                label: `Use ${guess}`,
                apply: (current) => set(current, path, value.startsWith('http') ? `https://schema.org/${guess}` : guess),
              }),
            );
          }
        }
        // An address without its scheme.
        const url = ['url', 'sameAs', 'image', 'logo', 'contentUrl', 'license', 'acquireLicensePage', 'menu'].includes(key);
        if (url && !isHttpUrl(value) && !/^\{/.test(value)) {
          const full = withScheme(value);
          found.push(place(path, 'use the full address.', 'amber', full ? { label: `Use ${full}`, apply: (current) => set(current, path, full) } : undefined));
        }
        if (/[​-‍⁠﻿­‪-‮⁦-⁩]/.test(value)) {
          found.push(
            place(path, 'This text has hidden characters.', 'amber', {
              label: 'Remove hidden characters',
              apply: (current) => set(current, path, value.replace(/[​-‍⁠﻿­‪-‮⁦-⁩]/g, '')),
            }),
          );
        }
        if (/&(amp|lt|gt|quot|#39|#x27|nbsp);/.test(value)) {
          found.push(place(path, 'This looks HTML-escaped (&amp;amp;).', 'amber'));
        }
        if (/\{(field|media)\.[^}]+\}/.test(value) && !/^\{(field|media)\.[^}]+\}$/.test(value)) {
          found.push(place(path, 'This name is only filled when it is the whole value.', 'amber'));
        }
      } else if (typeof value === 'number' && IDENTIFIERS.includes(key)) {
        found.push(
          place(path, `Write ${key} as text so no digits are lost.`, 'amber', {
            label: 'Write it as text',
            apply: (current) => {
              const node = nodeAt(current, path, tree(current));
              return node ? `${current.slice(0, node.offset)}"${current.slice(node.offset, node.offset + node.length)}"${current.slice(node.offset + node.length)}` : current;
            },
          }),
        );
      }
    };
    walk(item, base, null, types);
  });
  // Red first, then by line.
  return found.sort((a, b) => (a.tone === b.tone ? a.line - b.line : a.tone === 'red' ? -1 : 1));
}

/** Whether text with these problems may be saved. */
export const savable = (found: Problem[]) => !found.some((problem) => problem.tone === 'red');

/**
 * A text's own problems, with the server's refusal of it first. A refusal
 * holds for the text that was sent (the stored one) only: once the text
 * changes, its own problems are what count, and it is sent again. Placed
 * where the server said (`place`, a path in the text), else at the start.
 */
export function withRefusal(own: Problem[], text: string, stored: string, refusal: string | undefined, place: () => Path): Problem[] {
  if (!refusal || text !== stored || own.some((one) => one.tone === 'red')) return own;
  const path = place();
  const offset = offsetOf(text, path);
  const line = text.slice(0, offset).split('\n').length;
  return [{ tone: 'red', line, offset, path, message: `Line ${line}: ${refusal}`, words: refusal }, ...own];
}

/** What the sheet says when a refusal arrives: never left saying it saved. */
export const notSaved = (refusal: string) => `Not saved. ${refusal}`;

/** Whether the text reads as one tree (Form can show it). */
export const readable = (text: string) => text.trim() === '' || tree(text) !== null;
