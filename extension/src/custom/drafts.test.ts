import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_DAYS, draftKey, dropDraft, keepDraft, keepTab, readDraft, readTab, sweepDrafts } from './drafts';

describe('text with a problem is kept, never sent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a draft per page, language and field, without storage too', () => {
    // Storage that throws, as in a private window.
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
        removeItem: () => {
          throw new Error('blocked');
        },
      },
    });
    const key = draftKey('canvas_page:1:en', 'en', 'schema.custom');
    expect(readDraft(key)).toBeNull();
    keepDraft(key, '{"@type": "Rating" "ratingValue": 4}');
    expect(readDraft(key)).toBe('{"@type": "Rating" "ratingValue": 4}');
    expect(readDraft(draftKey('canvas_page:1:fr', 'fr', 'schema.custom'))).toBeNull();
    dropDraft(key);
    expect(readDraft(key)).toBeNull();
    // The tab falls back to Form.
    keepTab('json');
    expect(readTab()).toBe('form');
  });

  it('remembers the tab where storage works', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
    });
    expect(readTab()).toBe('form');
    keepTab('json');
    expect(readTab()).toBe('json');
  });
});

describe('a stored draft expires', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is dropped after a few days, when read or when a sheet opens', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() {
          return store.size;
        },
      },
    });
    const day = 86400000;
    const old = draftKey('canvas_page:2:en', 'en', 'schema.custom');
    const fresh = draftKey('canvas_page:3:en', 'en', 'schema.custom');
    keepDraft(old, '{"a": 1', 0);
    keepDraft(fresh, '{"b": 1', DRAFT_DAYS * day);
    dropDraft(old);
    store.set(`canvas_metatag:jsonld-draft:${old}`, JSON.stringify({ text: '{"a": 1', at: 0 }));
    sweepDrafts((DRAFT_DAYS + 0.5) * day);
    expect(store.has(`canvas_metatag:jsonld-draft:${old}`)).toBe(false);
    expect(store.has(`canvas_metatag:jsonld-draft:${fresh}`)).toBe(true);
    // Anything else stored there is no draft: it never escapes the expiry.
    store.set('canvas_metatag:jsonld-draft:x', '{"c": 1');
    expect(readDraft('x')).toBeNull();
  });
});
