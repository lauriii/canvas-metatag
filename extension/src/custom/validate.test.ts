import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { syntax } from './doc';
import { check, type Mode } from './validate';

interface Case {
  name: string;
  input: string;
  accepted: boolean;
  stored?: boolean;
  /** The stored text, when it is not the input trimmed. */
  text?: string;
  message?: string;
  item?: number;
  path?: string;
  mode?: Mode;
}

const dir = new URL('../../../tests/fixtures/custom/', import.meta.url);
const cases = readdirSync(dir).flatMap((file) =>
  (JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Case[]).map((one) => [`${file}: ${one.name}`, one] as const),
);

describe('the red set is the server’s (tests/fixtures/custom, ValuesTest::testSharedFixtures)', () => {
  it.each(cases)('%s', (_, one) => {
    const checked = check(one.input, one.mode ?? {});
    if (one.accepted) {
      expect(checked.error).toBeNull();
      expect(checked.text).toBe(one.stored === false ? null : (one.text ?? one.input.trim()));
    } else {
      expect(checked.error).toEqual({ message: one.message, item: one.item, path: one.path });
    }
  });
});

describe('what the server never sees', () => {
  it('refuses comments and trailing commas as syntax', () => {
    expect(syntax('{"@type": "Thing", // a note\n"name": "A"}')[0].message).toBe("JSON can't have comments.");
    const trailing = syntax('{\n  "@type": "Thing",\n  "name": "A",\n}');
    expect(trailing[0]).toMatchObject({ line: 3, message: 'remove the comma before }.' });
    expect(trailing[0].fix!.apply('{\n  "@type": "Thing",\n  "name": "A",\n}')).toBe('{\n  "@type": "Thing",\n  "name": "A"\n}');
  });

  it('counts 32 KB on the minified text and 64 KB as written', () => {
    const items = Array.from({ length: 10 }, (_, n) => ({ '@type': 'Thing', name: 'x'.repeat(3100), n }));
    const formatted = JSON.stringify(items, null, 2).replace(/"n"/g, `${' '.repeat(900)}"n"`);
    expect(formatted.length).toBeGreaterThan(40000);
    const checked = check(formatted);
    expect(checked.error).toBeNull();
    expect(checked.size).toBeLessThan(32768);
  });

  it('refuses an absolute id of the site’s own items', () => {
    expect(check('{"@type": "Organization", "@id": "https://example.com/#identity"}', { origin: 'https://example.com' }).error?.message).toBe(
      '“https://example.com/#identity” is made by this page. Use Add details, or give the item another @id.',
    );
    expect(check('{"@type": "Organization", "@id": "https://other.example/#identity"}', { origin: 'https://example.com' }).error).toBeNull();
  });
});
