/**
 * Hand-added text with a problem: kept, never sent.
 *
 * Keyed by the page or template, its language and the field. Kept for the
 * dialog's life (following another page keeps it) and mirrored to this
 * browser's storage, so closing the dialog keeps it too, for three days:
 * on a shared browser a draft never outlives that. Storage may be blocked:
 * every access is guarded, and the memory copy still works.
 */

const memory = new Map<string, string>();
const PREFIX = 'canvas_metatag:jsonld-draft:';
/** How long a stored draft is kept. */
export const DRAFT_DAYS = 3;

export const draftKey = (target: string, langcode: string, field: string) => `${target}|${langcode}|${field}`;

/** A stored draft: its text, unless it is older than DRAFT_DAYS. */
function stored(raw: string | null, now: number): string | null {
  if (raw === null) return null;
  try {
    const entry = JSON.parse(raw) as { text?: unknown; at?: unknown };
    if (typeof entry?.text === 'string' && typeof entry.at === 'number') return now - entry.at > DRAFT_DAYS * 86400000 ? null : entry.text;
  } catch {
    // Not a draft: dropped.
  }
  return null;
}

export function readDraft(key: string, now = Date.now()): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const text = stored(window.localStorage.getItem(PREFIX + key), now);
    if (text === null) window.localStorage.removeItem(PREFIX + key);
    return text;
  } catch {
    return null;
  }
}

export function keepDraft(key: string, text: string, now = Date.now()): void {
  memory.set(key, text);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ text, at: now }));
  } catch {
    // The memory copy is enough for this visit.
  }
}

/** Drops every stored draft older than DRAFT_DAYS: when a sheet opens. */
export function sweepDrafts(now = Date.now()): void {
  try {
    const storage = window.localStorage;
    for (let index = storage.length - 1; index >= 0; index--) {
      const name = storage.key(index);
      if (name?.startsWith(PREFIX) && stored(storage.getItem(name), now) === null) storage.removeItem(name);
    }
  } catch {
    // Nothing to sweep.
  }
}

export function dropDraft(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing kept.
  }
}

/** The tab a viewer last chose; Form when nothing is known. */
export function readTab(): 'form' | 'json' {
  try {
    return window.localStorage.getItem('canvas_metatag:jsonld-tab') === 'json' ? 'json' : 'form';
  } catch {
    return 'form';
  }
}

export function keepTab(tab: 'form' | 'json'): void {
  try {
    window.localStorage.setItem('canvas_metatag:jsonld-tab', tab);
  } catch {
    // Remembered for this visit only.
  }
}
