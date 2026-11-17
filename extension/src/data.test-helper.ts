// The registry and the rules as the state route sends them in English: the
// data files with `extends` resolved (SchemaGraph::types()). For tests only.
import rawRegistry from '../../data/schema-types.json';
import rawRules from '../../data/search-features.json';
import type { Registry, Resolved, SchemaType, SearchFeatures } from './types';

const RAW = rawRegistry as unknown as Record<string, SchemaType & { extends?: string }>;

export const REGISTRY: Registry = Object.fromEntries(
  Object.entries(RAW).map(([id, { extends: base, ...type }]) => {
    if (!base) {
      return [id, type];
    }
    const { kind: _kind, variants: _variants, ...inherited } = RAW[base];
    return [id, { ...inherited, ...type }];
  }),
);

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
