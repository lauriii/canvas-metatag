/**
 * The verdicts of hand-added items, in the dialog, while the editor types.
 *
 * A mirror of SchemaGraph::features() for items added by hand and the
 * details added to the module's nodes: what each search feature needs, the
 * shape it expects (`expects`), the values it accepts and its numeric rules.
 * tests/fixtures/features/ is run by features.test.ts and SearchFeaturesTest,
 * so both give the same verdicts. Verdicts of the module's own nodes stay
 * the server's: they depend on what the page and its site give.
 */
import type { SearchFeatures, Verdict } from './types';

type Item = Record<string, unknown>;
type Spec = string | { is: string; needs?: string[] };

const DATE = /^(\d{4})-(\d{2})-(\d{2})(T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(Z|[+-]\d{2}:\d{2})?)?$/;

const isObject = (value: unknown): value is Item => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The node a bare reference points at, when the graph has it. */
const follow = (value: unknown, index: Map<string, Item>): unknown =>
  isObject(value) && Object.keys(value).length === 1 && typeof value['@id'] === 'string' && index.has(value['@id']) ? index.get(value['@id']) : value;

/** The non-empty values at a dotted path, lists spread, references followed. */
export function at(node: unknown, path: string, index: Map<string, Item> = new Map()): unknown[] {
  let values: unknown[] = [node];
  for (const segment of path.split('.')) {
    const next: unknown[] = [];
    for (let value of values) {
      value = follow(value, index);
      for (let item of Array.isArray(value) ? value : [value]) {
        item = follow(item, index);
        if (isObject(item) && segment in item) {
          const found = item[segment];
          next.push(...(Array.isArray(found) ? found : [found]));
        }
      }
    }
    values = next;
  }
  return values.map((value) => follow(value, index)).filter((value) => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0));
}

const types = (value: unknown): string[] => {
  const type = isObject(value) ? value['@type'] : undefined;
  return (Array.isArray(type) ? type : [type]).filter((one): one is string => typeof one === 'string');
};

/** Whether one of some types is one of others, or a kind of one. */
export function isA(of: string[], within: string[], rules: SearchFeatures): boolean {
  const subtypes = rules.subtypes ?? {};
  return within.some((one) => (subtypes[one] ?? []).includes('*') || of.some((type) => type === one || (subtypes[one] ?? []).includes(type)));
}

/** The kinds a spec allows: "item:Person|Organization" is one kind with two types. */
export function kinds(is: string): [string, string[]][] {
  const found: [string, string[]][] = [];
  for (const token of is.split('|')) {
    if (token.includes(':')) {
      const [kind, name] = token.split(':', 2);
      found.push([kind, [name]]);
    } else if (found.length && /^[A-Z]/.test(token) && ['item', 'enum'].includes(found[found.length - 1][0])) {
      found[found.length - 1][1].push(token);
    } else if (token !== '') {
      found.push([token, []]);
    }
  }
  return found;
}

/** What the rules file says a name's value must look like. */
export const specOf = (rules: SearchFeatures, name: string): Spec | '' => rules.expects?.[name] ?? '';

const isOf = (spec: Spec | ''): string => (typeof spec === 'string' ? spec : spec.is);

/** Whether a value has the shape a spec names (SchemaGraph::fits()). */
export function fits(value: unknown, spec: Spec, rules: SearchFeatures, index: Map<string, Item> = new Map()): boolean {
  const is = isOf(spec);
  value = follow(value, index);
  const allowed = kinds(is);
  for (const [kind, names] of allowed) {
    const ok = (() => {
      switch (kind) {
        case 'text':
          return typeof value === 'string';
        case 'number':
          return (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)));
        case 'url':
          return typeof value === 'string' && /^https?:\/\/[^\s/?#@]+[^\s]*$/i.test(value);
        case 'date':
        case 'datetime': {
          const m = typeof value === 'string' ? DATE.exec(value) : null;
          return !!m && (kind === 'date' || !!m[4] || is.includes('date|'));
        }
        case 'duration':
          return typeof value === 'string' && /^P(?=\d|T\d)/.test(value);
        case 'bool':
          return typeof value === 'boolean';
        case 'enum':
          return typeof value === 'string' && names.includes(value.replace(/^https?:\/\/schema\.org\//, ''));
        case 'item':
          return (
            isObject(value) &&
            isA(types(value), names, rules) &&
            !(typeof spec === 'object' ? (spec.needs ?? []) : []).some((need) => at(value, need, index).length === 0)
          );
        default:
          return true;
      }
    })();
    if (ok) return true;
  }
  return allowed.length === 0;
}

/** An entry's path whose every value is of another shape, with that shape. */
function misfit(entry: string | string[], object: Item, index: Map<string, Item>, own: Record<string, Spec>, rules: SearchFeatures): [string, Spec] | null {
  let first: [string, Spec] | null = null;
  for (const one of Array.isArray(entry) ? entry : [entry]) {
    for (const path of one.split('|')) {
      const values = at(object, path, index);
      if (!values.length) continue;
      const name = path.slice(path.lastIndexOf('.') + 1);
      const spec = own[path] ?? own[name] ?? specOf(rules, name);
      if (spec === '' || values.some((value) => fits(value, spec, rules, index))) return null;
      first ??= [path, spec];
    }
  }
  return first;
}

/**
 * The verdicts of one hand-added item, or of a node with added details.
 *
 * @param item The item, prepared as the graph has it.
 * @param graph Every node of the graph: references are followed in it.
 * @param rules The rules file.
 * @param hand Whether it is a hand-added item (features only such items get).
 */
export function itemVerdicts(item: Item, graph: Item[], rules: SearchFeatures, hand = true): Verdict[] {
  const index = new Map<string, Item>();
  for (const node of graph) {
    if (typeof node['@id'] === 'string' && !index.has(node['@id'])) index.set(node['@id'], node);
  }
  const id = typeof item['@id'] === 'string' ? item['@id'] : null;
  const verdicts: Verdict[] = [];
  for (const [name, feature] of Object.entries(rules.features)) {
    if (!types(item).some((type) => feature.on.includes(type)) || feature.node || feature.list) continue;
    if (feature.only === 'hand' && !hand) continue;
    if (feature.only === 'page' && hand) continue;
    const verdict = { feature: name, node: id };
    if (feature.status === 'retired') {
      verdicts.push({ ...verdict, verdict: 'retired' });
      continue;
    }
    // A review or rating of the site's own organization (the server's
    // `ours` rule; its other reasons need the page's own values).
    const own = feature.not_for?.find((not) => not.ours && at(item, not.ours, index).some((value) => isObject(value) && typeof value['@id'] === 'string' && /(^|\/)#identity$/.test(value['@id'])));
    if (own) {
      verdicts.push({ ...verdict, verdict: 'not_fit', reason: own.id });
      continue;
    }
    const accepts = feature.accepts ?? {};
    const has = (entry: string | string[]) =>
      (Array.isArray(entry) ? entry : [entry]).some((one) =>
        one.split('|').some((path) => at(item, path, index).some((value) => !accepts[path] || accepts[path].includes(value as string))),
      );
    const missing: Verdict['missing'] = [];
    for (const entry of [...(feature.required ?? []), ...(feature.complete ?? [])]) {
      if (!has(entry)) {
        const first = Array.isArray(entry) ? entry[0] : entry;
        missing.push({ path: first.split('|')[0] });
        continue;
      }
      const wrong = misfit(entry, item, index, feature.expects ?? {}, rules);
      if (wrong) missing.push({ path: wrong[0], expects: wrong[1] });
    }
    feature.rules?.forEach((rule, at_) => {
      if (rule.when) return;
      // So many values or more: a trail of two items.
      if (rule.min !== undefined) {
        if (at(item, rule.path, index).length < rule.min) missing.push({ path: rule.path, rule: at_ });
        return;
      }
      for (const found of at(item, rule.path, index)) {
        const passes = rule.gt !== undefined ? Number(found) > rule.gt : rule.is !== undefined ? found === rule.is : true;
        if (!passes) {
          missing.push({ path: rule.path, rule: at_ });
          break;
        }
      }
    });
    const helps = (feature.recommended ?? []).filter((entry) => !has(entry)).map((entry) => ({ path: entry.split('|')[0] }));
    verdicts.push({
      ...verdict,
      verdict: missing.length ? 'needs' : feature.complete ? 'complete' : 'ready',
      ...(missing.length && { missing }),
      ...(helps.length && { helps }),
    });
  }
  return verdicts;
}
