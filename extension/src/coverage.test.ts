// The coverage contract, as the dialog sees the registry: every detail a
// scope offers has a control there, and every kind of value a template can
// link has a menu that says what fits. CoverageContractTest walks the same
// registry on the server.
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { controlFor } from './controls';
import { REGISTRY } from './data.test-helper';
import { offered } from './model';
import { kindReason, propKind } from './values';

const SCOPES = ['page', 'template'] as const;
const LINKED = ['text', 'html', 'address', 'date', 'number', 'image', 'ref'];

describe('coverage', () => {
  it('every offered detail has a control on its scope', () => {
    let checked = 0;
    for (const [id, type] of Object.entries(REGISTRY)) {
      for (const scope of SCOPES) {
        if (!offered(REGISTRY, id, null, scope)) {
          continue;
        }
        for (const prop of type.props ?? []) {
          if (!offered(REGISTRY, id, prop.key, scope)) {
            expect(['component', 'policy']).toContain(prop.scopes?.[scope]);
            continue;
          }
          const control = controlFor(prop);
          expect(control, `${id}.${prop.key} on a ${scope}`).not.toBeNull();
          // A detail only a field fills is offered on templates only.
          if (control === 'link') {
            expect(scope, `${id}.${prop.key}`).toBe('template');
          }
          // Every kind a template links has words for what does not fit.
          if (scope === 'template' && LINKED.includes(propKind(prop))) {
            expect(kindReason('text', propKind(prop))).toMatch(/^Text, not \w/);
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('a graph fixture proves each offered type on each scope', () => {
    const fixtures = readdirSync(new URL('../../tests/fixtures/graphs', import.meta.url)).map((file) => file.replace(/\.json$/, ''));
    const expected = Object.keys(REGISTRY).flatMap((id) => SCOPES.filter((scope) => offered(REGISTRY, id, null, scope)).map((scope) => `${id}.${scope}`));
    for (const name of expected) {
      expect(fixtures).toContain(name);
    }
    // Variants of a case, such as LocalBusiness.venue.page, are of a type and scope listed.
    for (const name of fixtures) {
      const parts = name.split('.');
      expect(expected).toContain(`${parts[0]}.${parts[parts.length - 1]}`);
    }
  });

  it('fails for a detail only custom JSON-LD could fill', () => {
    expect(controlFor({ kind: 'text', html: true, link_only: true })).toBe('link');
    expect(controlFor({ kind: 'text', list: true })).toBe('link');
    // A kind the dialog has no control for.
    expect(controlFor({ kind: 'movie' as 'text' })).toBeNull();
  });
});
