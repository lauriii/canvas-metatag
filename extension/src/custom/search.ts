/**
 * "What is it?": the types a hand-added item can be, and where a type is
 * better served by what the page already does.
 *
 * Pure. Types with a live search feature come first (what people add by
 * hand before the rest), retired features' types are never suggested, a
 * name that isn't a type is offered as itself. A kind of page steers to
 * "What this page is", a type the page already is to Add details, and a
 * page type to making the page itself that type.
 */
import type { Registry, SearchFeatures } from '../types';
import { aType, typeLabel } from './project';
import { score, type Vocabulary } from './vocab';

/** Where a choice leads instead of a new item. */
export type Steer =
  /** A kind of page: "What this page is". */
  | { to: 'kind'; kind: string; name: string; type: string }
  /** A type the page already is: Add details to it. */
  | { to: 'details'; node: '#primary' | '#webpage'; type: string }
  /** A page type: the page itself becomes one. */
  | { to: 'page'; type: string };

export interface TypeOption {
  value: string;
  key: string;
  label: string;
  /** The schema.org name, in monospace. */
  hint?: string;
  detail?: string;
  tag?: string;
  steer?: Steer;
}

export interface SearchContext {
  rules: SearchFeatures;
  vocabulary: Vocabulary | null;
  registry: Registry;
  /** The page's registry type ("WebPage" for a plain web page). */
  pageType: string;
  /** The types the page's own nodes are output with. */
  nodeTypes: { '#primary'?: string[]; '#webpage'?: string[] };
}

/** The types a query finds, steering rows first. */
export function typeOptions(query: string, ctx: SearchContext): TypeOption[] {
  const { rules, vocabulary } = ctx;
  const q = query.trim();
  const plain = ctx.pageType === 'WebPage';
  const shown = Object.values(rules.features).filter((one) => one.status === 'shown' && !one.node && !one.list);
  const live = new Set(shown.flatMap((one) => one.on));
  // What people add by hand comes first: ratings, reviews, discussions.
  const hand = new Set(shown.filter((one) => one.only).flatMap((one) => one.on));
  const retired = new Set(Object.values(rules.features).filter((one) => one.status === 'retired').flatMap((one) => one.on));
  const names = new Set<string>([...live, ...Object.keys(rules.about ?? {}), ...(vocabulary ? Object.keys(vocabulary.types) : [])]);
  const options: (TypeOption & { rank: number })[] = [];

  // A kind of page: the page describes itself, with its own fields. The
  // best one only, first.
  const kinds: (TypeOption & { rank: number })[] = [];
  if (q && plain) {
    for (const [id, type] of Object.entries(ctx.registry)) {
      if (id === '$shapes' || id === 'WebPage' || !type.kind) continue;
      const rank = Math.max(score(type.kind.label, q), score(type.kind.name, q), score(type.primary_type ?? id, q), score(typeLabel(type.primary_type ?? id, rules), q));
      if (rank > 0) {
        kinds.push({
          value: `kind:${id}`,
          key: `kind:${id}`,
          label: type.kind.label,
          tag: 'Page kind',
          detail: `This page can describe itself as ${type.kind.name}, with its own fields and checks.`,
          steer: { to: 'kind', kind: id, name: type.kind.name, type: type.primary_type ?? id },
          rank: 10000 + rank,
        });
      }
    }
  }
  kinds.sort((a, b) => b.rank - a.rank);
  options.push(...kinds.slice(0, 1));
  const own = new Map<string, '#primary' | '#webpage'>();
  for (const type of ctx.nodeTypes['#primary'] ?? []) own.set(type, '#primary');
  for (const type of ctx.nodeTypes['#webpage'] ?? []) own.set(type, '#webpage');

  for (const name of names) {
    const label = typeLabel(name, rules);
    const about = rules.about?.[name] ?? vocabulary?.types[name]?.about;
    // Any word start is as good a match; a word of its line counts less.
    const named = Math.min(60, Math.max(score(label, q), score(name, q)));
    const rank = named || (q.length > 2 && about && score(about, q) ? 5 : 0);
    if (!rank || (retired.has(name) && !live.has(name))) continue;
    if (options.some((one) => one.steer?.to === 'kind' && one.steer.type === name)) continue;
    const pending = vocabulary?.types[name]?.pending && !live.has(name);
    const node = own.get(name);
    const page = !node && /Page$/.test(name) && name !== 'WebPage';
    options.push({
      value: name,
      key: name,
      label,
      // The schema.org name, unless the label already is it.
      hint: name !== label ? name : undefined,
      detail: node ? `This page is already ${aType(name, rules)}. Add details to it instead.` : page ? `This makes the page itself ${aType(name, rules)}.` : about,
      tag: live.has(name) ? 'Search feature' : pending ? 'Proposed' : undefined,
      steer: node ? { to: 'details', node, type: name } : page ? { to: 'page', type: name } : undefined,
      // A schema.org name typed exactly comes first ("Rating"); a word
      // ("rating") finds what search features show first.
      rank: rank + (live.has(name) ? 1000 : 0) + (hand.has(name) ? 500 : 0) + (rules.about?.[name] ? 10 : 0) + (q === name ? 5000 : 0),
    });
  }
  options.sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label));
  const top = options.slice(0, q ? 40 : 14);
  // Before anything is typed, the suggestions read in order.
  if (!q) top.sort((a, b) => a.label.localeCompare(b.label));
  const found: TypeOption[] = top.map(({ rank: _rank, ...option }) => option);
  // The tag tells rows apart only when some have it and some don't.
  if (found.every((one) => one.tag === 'Search feature' || one.steer?.to === 'kind')) {
    for (const one of found) if (one.tag === 'Search feature') delete one.tag;
  }
  if (/^[A-Z][A-Za-z0-9]{1,63}$/.test(q) && !names.has(q)) {
    found.push({ value: q, key: `use:${q}`, label: `Use “${q}” as the type` });
  }
  return found;
}
