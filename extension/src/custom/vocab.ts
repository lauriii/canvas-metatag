/**
 * The schema.org vocabulary the site downloaded, when it did.
 *
 * Read once, in the background, the first time the sheet opens; the sheet
 * never waits for it. Without it, the types and details the rules file
 * documents are offered, and every other type is edited by the shape of its
 * values.
 */

export interface VocabType {
  parents: string[];
  about?: string;
  pending?: true;
  superseded?: string;
}

export interface VocabProperty {
  domains: string[];
  ranges: string[];
  about?: string;
  pending?: true;
  superseded?: string;
}

export interface Vocabulary {
  release: string;
  licence: string;
  attribution: string;
  types: Record<string, VocabType>;
  properties: Record<string, VocabProperty>;
  members: Record<string, string[]>;
}

/** Loading, loaded, absent from the site, or failed. */
export type VocabState = { status: 'loading' } | { status: 'ready'; vocabulary: Vocabulary } | { status: 'none' } | { status: 'failed' };

let cached: Promise<Vocabulary> | null = null;

/** Reads the vocabulary once per page; a failure can be tried again. */
export function loadVocabulary(get: (release: string) => Promise<Vocabulary>, release: string): Promise<Vocabulary> {
  cached ??= get(release).catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}

/** A type and every type it is a kind of, nearest first. */
export function ancestors(vocabulary: Vocabulary, type: string): string[] {
  const found: string[] = [];
  const queue = [type];
  while (queue.length) {
    const one = queue.shift()!;
    if (found.includes(one) || !vocabulary.types[one]) continue;
    found.push(one);
    queue.push(...vocabulary.types[one].parents);
  }
  return found;
}

/** The details a type has, its own and its parents', nearest class first. */
export function detailsOf(vocabulary: Vocabulary, types: string[]): string[] {
  const classes = types.flatMap((type) => ancestors(vocabulary, type));
  const found: string[] = [];
  for (const one of classes) {
    for (const [name, property] of Object.entries(vocabulary.properties)) {
      if (property.domains.includes(one) && !found.includes(name)) found.push(name);
    }
  }
  return found;
}

/** The narrowest type that has a detail, among the types under some. */
export function typeWith(vocabulary: Vocabulary, name: string, under: string[]): string | null {
  const domains = vocabulary.properties[name]?.domains ?? [];
  for (const domain of domains) {
    if (ancestors(vocabulary, domain).some((one) => under.includes(one))) return domain;
  }
  return null;
}

/** "Rating" from "rating": word starts first, then anywhere. */
export function score(text: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (q === '') return 1;
  const words = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9&]+/);
  const whole = text.toLowerCase();
  if (whole === q) return 100;
  if (whole.startsWith(q)) return 80;
  if (words.some((word) => word.startsWith(q))) return 60;
  return 0;
}
