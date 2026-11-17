// The registry and the rules as the state route sends them in English: the
// data files with `extends` resolved and groups expanded
// (SchemaGraph::types()). For tests only.
import rawRegistry from '../../data/schema-types.json';
import rawRules from '../../data/search-features.json';
import type { Registry, Resolved, SchemaGroup, SchemaProp, SchemaType, SearchFeatures } from './types';

interface Part extends Partial<SchemaProp> {
  key: string;
  use?: string;
}
interface Shape {
  type: string;
  nested?: Record<string, string>;
  requires: string[][];
  needs?: string[];
  parts: Part[];
}
interface Entry extends Partial<SchemaProp> {
  use?: string;
  type?: string;
  level?: 'required';
  ref?: { label: string; accept: string[]; site?: true; page_default?: true; inline?: string; per_item?: true };
  defaults?: Record<string, SchemaProp['default']>;
}

const { $shapes: SHAPES, ...RAW } = rawRegistry as unknown as Record<string, SchemaType & { extends?: string; props?: Entry[] }> & {
  $shapes: Record<string, Shape>;
};

/** One use of a shape: its properties and groups, keyed by path. */
function expand(use: string, prefix: string, top: string, entry: Entry, props: SchemaProp[], groups: Record<string, SchemaGroup>, nested: Record<string, string>) {
  const shape = SHAPES[use];
  const own = prefix === top;
  nested[prefix] = own ? (entry.type ?? shape.type) : shape.type;
  for (const [path, type] of Object.entries(shape.nested ?? {})) {
    nested[`${prefix}_${path}`] = type;
  }
  const parts: string[] = [];
  for (const part of shape.parts) {
    const key = `${prefix}_${part.key}`;
    parts.push(key);
    if (part.use) {
      expand(part.use, key, top, entry, props, groups, nested);
      continue;
    }
    const relative = key.slice(top.length + 1);
    // A part's gate is a part of its node; the group's gate holds for each part.
    const own_when = part.when && Object.fromEntries(Object.entries(part.when).map(([gate, values]) => [`${prefix}_${gate}`, values]));
    const when = entry.when || own_when ? { ...entry.when, ...own_when } : undefined;
    // A group's name is called by the group's label outside it.
    const named = own && part.key === 'name' && entry.label ? { label: entry.label, short: part.label } : {};
    props.push({
      ...part,
      ...named,
      key,
      ...(when && { when }),
      ...(entry.defaults?.[relative] && { default: entry.defaults[relative] }),
      ...(entry.scopes && { scopes: entry.scopes }),
      group: top,
      ...(!own && { part: prefix }),
    } as SchemaProp);
  }
  groups[prefix] = {
    ...(own && entry.label && { label: entry.label }),
    type: nested[prefix],
    shape: use,
    parts,
    requires: shape.requires.map((one) => one.map((key) => `${prefix}_${key}`)),
    ...(shape.needs && { needs: shape.needs }),
    ...(own && entry.level && { level: entry.level }),
    ...(own && entry.list && { list: true }),
    ...(!own && { parent: top }),
  } as SchemaGroup;
}

const resolved = Object.fromEntries(
  Object.entries(RAW).map(([id, { extends: base, ...type }]) => {
    if (!base) {
      return [id, type];
    }
    const { kind: _kind, variants: _variants, ...inherited } = RAW[base];
    return [id, { ...inherited, ...type }];
  }),
);

export const REGISTRY: Registry = Object.fromEntries(
  Object.entries(resolved).map(([id, type]) => {
    const props: SchemaProp[] = [];
    const groups: Record<string, SchemaGroup> = {};
    const nested: Record<string, string> = { ...((type as { nested?: Record<string, string> }).nested ?? {}) };
    for (const entry of (type.props ?? []) as Entry[]) {
      if (!entry.group) {
        props.push(entry as SchemaProp);
        continue;
      }
      if (entry.ref) {
        props.push({
          key: entry.group,
          label: entry.ref.label,
          kind: 'ref',
          ...(entry.list && { list: true, max: 20 }),
          accept: entry.ref.accept,
          as: entry.type ?? SHAPES[entry.use!].type,
          ...(entry.ref.site && { site: true }),
          ...(entry.ref.page_default && { page_default: true }),
          ...(entry.ref.inline && { inline: entry.ref.inline }),
          ...(entry.ref.per_item && { per_item: true }),
          ...(entry.when && { when: entry.when }),
          group: entry.group,
          ai: false,
        } as SchemaProp);
      }
      expand(entry.use!, entry.group, entry.group, entry, props, groups, nested);
    }
    return [id, { ...type, props, ...(Object.keys(groups).length && { groups }), ...(Object.keys(nested).length && { nested }) }];
  }),
) as Registry;

export const RULES = rawRules as unknown as SearchFeatures;

/** The report of a web page whose graph has nothing to say. */
export const EMPTY_SCHEMA: Resolved['schema'] = {
  withheld: null,
  dropped: [],
  sources: {},
  gates: {},
  type: 'WebPage',
  unknown_type: null,
  nodes: [],
  front: false,
  features: [{ feature: null, node: null, verdict: 'none' }],
  rules: [],
};
