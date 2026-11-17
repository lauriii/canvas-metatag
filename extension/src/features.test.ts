import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import rules from '../../data/search-features.json';
import { fits, itemVerdicts } from './features';
import type { SearchFeatures, Verdict } from './types';

interface Case {
  name: string;
  graph: Record<string, unknown>[];
  item: number;
  verdicts: Verdict[];
}

const dir = new URL('../../tests/fixtures/features/', import.meta.url);
const cases = readdirSync(dir).flatMap((file) =>
  (JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Case[]).map((one) => [`${file}: ${one.name}`, one] as const),
);

describe('the same verdicts as the server (tests/fixtures/features, SearchFeaturesTest::testSharedFixtures)', () => {
  it.each(cases)('%s', (_, one) => {
    expect(itemVerdicts(one.graph[one.item], one.graph, rules as unknown as SearchFeatures)).toEqual(one.verdicts);
  });
});

describe('shapes', () => {
  const r = rules as unknown as SearchFeatures;
  it('reads a spec of kinds and types', () => {
    expect(fits('85%', 'number|text', r)).toBe(true);
    expect(fits('4.2', 'number', r)).toBe(true);
    expect(fits('Acme', { is: 'item:Organization', needs: ['name'] }, r)).toBe(false);
    expect(fits({ '@type': 'Restaurant', name: 'Kala' }, { is: 'item:Organization', needs: ['name'] }, r)).toBe(true);
    expect(fits({ '@type': 'Organization' }, { is: 'item:Organization', needs: ['name'] }, r)).toBe(false);
    expect(fits('https://schema.org/InStock', 'enum:InStock|OutOfStock', r)).toBe(true);
    expect(fits('2026-07-10T09:30+03:00', 'date|datetime', r)).toBe(true);
    expect(fits('acme-logistics.example', 'url', r)).toBe(false);
  });
});
