/**
 * "Add your own JSON-LD" and "Add details to ‹name›": a form or JSON over
 * one stored text.
 *
 * The text is the truth while the sheet is open. Form is a projection of it
 * and writes one value at a time; JSON shows it byte for byte. Switching
 * never changes a byte. Text with a red problem is kept, never sent.
 */
import { ChevronDownIcon, DotsHorizontalIcon } from '@radix-ui/react-icons';
import { DropdownMenu, Tabs } from '@radix-ui/themes';
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../App';
import { leftOutText, verdictText } from '../checks';
import { andList } from '../model';
import { Sheet } from '../components/Header';
import { copy } from '../components/Output';
import { useRecheck } from '../components/ChecksSheet';
import { Btn } from '../components/ui';
import { itemVerdicts } from '../features';
import { dateWords } from '../readback';
import type { SearchFeatures, StatePayload, Verdict } from '../types';
import { clean, mint } from './clean';
import { append, fromPointer, items as itemsOf, itemPath, offsetOf, offsetOfLine, pathAt, pretty, set, value as parse, type Path, type Problem } from './doc';
import { draftKey, dropDraft, keepDraft, readDraft, readTab, keepTab, sweepDrafts } from './drafts';
import { FilterList, ItemForm, VerdictBox } from './ItemForm';
import { JsonView, ProblemList } from './JsonView';
import { PasteReview, reviewOf, type Reviewed } from './PasteReview';
import { problems as problemsOf, readable, savable } from './problems';
import { aType, detailLabel, sentence, typeLabel, typesOf, type Item } from './project';
import { controlOf, ROW_CONTROL, type LinkField } from './Row';
import { typeOptions, type Steer } from './search';
import { appendItem, appendPaste, asItem, commitOf, moveInText, backLabel, detailsExample, emptyWords, hoistText, isObject, limitLine, linkedField, listTags, mergeWords, restorePaste, shapeNeed, takenIds, targetsOf, typeChangeWords, typedPaths, unexpectedKeys, valueAt } from './sheet';
import { bytes, CUSTOM_MAX } from './validate';
import { loadVocabulary, type VocabState } from './vocab';

export type CustomNode = '#primary' | '#webpage' | '#identity';

type Level = { kind: 'list' } | { kind: 'search'; change?: number } | { kind: 'item'; item: number } | { kind: 'review'; review: Reviewed; paste: string; before: string };

/** The graph the server built: the module's nodes by their short id. */
function moduleNodes(server: StatePayload): Map<string, Item> {
  const graph = (server.resolved?.head.script.find((script) => script.type === 'application/ld+json')?.textContent as { '@graph'?: Item[] } | undefined)?.['@graph'] ?? [];
  const nodes = new Map<string, Item>();
  for (const node of graph) {
    const id = typeof node['@id'] === 'string' ? node['@id'] : '';
    const name = id.slice(id.indexOf('#') + 1);
    if (id.includes('#') && server.module_ids?.[name]) nodes.set(`#${name}`, node);
  }
  return nodes;
}

/** What a module node is called: "Acme (this site)", "This page". */
function moduleLabel(server: StatePayload, short: string, node: Item | undefined): string {
  if (short === '#identity') return `${typeof node?.name === 'string' && node.name ? node.name : 'The site'} (this site)`;
  if (short === '#webpage') return 'This page';
  if (short === '#primary') return `This page's ${typeLabel(typesOf(node)[0] ?? server.resolved?.schema.type ?? 'Thing', server.search_features).toLowerCase()}`;
  if (short === '#website') return 'This website';
  return short;
}

/** A value the page gives, in the stage's words: "€2,500, in stock", "Humanify Studio logo". */
export function pageValue(value: unknown, ctx: { name(id: string): string | null; ui: string }): string {
  if (Array.isArray(value)) return value.map((one) => pageValue(one, ctx)).filter(Boolean).join('; ');
  if (isObject(value)) {
    if (Object.keys(value).length === 1 && typeof value['@id'] === 'string') return ctx.name(value['@id']) ?? '';
    const price = value.price ?? value.lowPrice;
    if (price !== undefined) {
      const currency = typeof value.priceCurrency === 'string' ? value.priceCurrency : '';
      let amount = String(price);
      try {
        amount = currency ? new Intl.NumberFormat(ctx.ui, { style: 'currency', currency, ...(Number.isInteger(Number(price)) && { minimumFractionDigits: 0 }) }).format(Number(price)) : amount;
      } catch {
        amount = `${price} ${currency}`.trim();
      }
      const availability = typeof value.availability === 'string' ? pageValue(value.availability, ctx).toLowerCase() : '';
      return [amount, availability].filter(Boolean).join(', ');
    }
    if (typeof value.name === 'string') return value.name;
    if (typeof value.caption === 'string' && value.caption) return value.caption;
    if (typeof value.url === 'string') return value.url;
    return typeof value['@type'] === 'string' ? value['@type'].replace(/([a-z])([A-Z])/g, '$1 $2') : '';
  }
  if (typeof value === 'string') {
    const code = /^https?:\/\/schema\.org\/([A-Z]\w+)$/.exec(value);
    if (code) return code[1].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^(\w)(.*)$/, (_, a: string, b: string) => a + b.toLowerCase());
    return dateWords(value, ctx.ui) ?? value;
  }
  return value === undefined || value === null ? '' : String(value);
}

export function CustomSheet(props: { node?: CustomNode; start?: 'search'; from?: string; at?: { item: number; path: string }; entry?: string; onClose(): void }) {
  const { state, dispatch, api, openSheet, issues } = useApp();
  const server = state.server!;
  const rules = server.search_features as SearchFeatures;
  const site = props.node === '#identity';
  const scope = site ? 'site' : 'target';
  const field = props.node ? `schema.extend.${props.node}` : 'schema.custom';
  const path = site ? `values.${field}` : field;
  const values = site ? state.edits.site.values : state.edits.target;
  const stored = String((field === 'schema.custom' ? values.schema?.custom : values.schema?.extend?.[props.node!]) ?? '');
  const readonly = site ? !server.can.site : state.readonly !== 'no';
  const key = draftKey(server.target?.auto_save_key ?? 'site', server.langcode, path);
  const modules = useMemo(() => moduleNodes(server), [server]);
  // The type an added @type list keeps: the server's, as it decides it.
  const mode = props.node ? { extend: server.extend_types?.[props.node] ?? typesOf(modules.get(props.node)) } : { origin: server.origin.url };
  const template = server.target?.scope === 'template';
  const typeName = server.target?.label ?? '';
  const previewing = server.preview?.label ?? '';
  // The node as the page makes it: what the server merged in is taken out
  // again, so that the sheet compares the text with the page's own values.
  const nodeData = useMemo(() => {
    const node = props.node ? modules.get(props.node) : undefined;
    if (!node) return undefined;
    const own = structuredClone(node) as Item;
    for (const added of server.resolved?.schema.added ?? []) {
      if (added.node !== props.node || added.path.includes('[')) continue;
      const parts = added.path.split('.');
      const at = valueAt(own, parts.slice(0, -1));
      if (isObject(at)) delete at[parts[parts.length - 1]];
    }
    if (server.resolved?.schema.type_added?.includes(props.node!)) own['@type'] = (server.extend_types?.[props.node!] ?? typesOf(own)).slice(0, 1)[0];
    return own;
  }, [modules, props.node, server.resolved, server.extend_types]);

  // Stored before a rule: the items read mode leaves out, as written.
  const refused = !props.node ? (server.target?.refused ?? null) : null;
  // The working text, the draft left with a problem, the tab and the level.
  const [left] = useState(() => {
    sweepDrafts();
    const draft = readDraft(key);
    if (draft !== null && draft !== stored) return { text: draft, refused: false };
    return refused ? { text: refused.text, refused: true } : null;
  });
  const [text, setTextState] = useState(stored);
  const textRef = useRef(text);
  const setText = (next: string) => {
    textRef.current = next;
    setTextState(next);
  };
  const [restore, setRestore] = useState(left !== null);
  // Where the kept text's first problem is: read once.
  const leftAt = useMemo(() => (left ? problemsOf(left.text, rules, null, mode).find((one) => one.tone === 'red') : undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTabState] = useState<'form' | 'json'>(() => (props.start === 'search' || props.at ? 'form' : readTab()));
  const [place, setPlace] = useState<{ offset: number; n: number } | null>(null);
  const caret = useRef(0);
  // A jump from Checks washes its value's row.
  const [washed, setWashed] = useState<string | null>(() => (props.at ? (props.at.path.split('.').filter((part) => !/^\d+$/.test(part)).pop() ?? null) : null));
  // The row last focused in Form: the switch to JSON lands on its value.
  const lastRow = useRef<Path | null>(null);
  const [bar, setBarState] = useState<{ text: string; detail?: string; actions?: { label: string; run(): void }[]; tone?: 'error' } | null>(null);
  const [said, setSaid] = useState('');
  const [pasting, setPasting] = useState<{ error?: string } | null>(null);
  const [steer, setSteer] = useState<{ type: string; to: Steer } | null>(null);
  // A frame under 400 px tall (the stylesheet's short frame): verdicts fold to one line.
  const short = useShort();
  const [vocab, setVocab] = useState<VocabState>(server.vocabulary ? { status: 'loading' } : { status: 'none' });
  const [translate, setTranslate] = useState<Set<string>>(() => new Set(JSON.parse(readDraft(`${key}|translate`) ?? '[]') as string[]));
  const programmatic = useRef(false);

  const data = parse(text);
  const list = props.node ? (isObject(data) ? [data] : []) : (itemsOf(data).filter(isObject) as Item[]);
  // The count the JSON tab shows while the text can't be read: the last one that could.
  const lastCount = useRef(list.length);
  if (data !== undefined || text.trim() === '') lastCount.current = list.length;
  const initialLevel = (): Level => {
    if (props.node) return { kind: 'item', item: 0 };
    const count = itemsOf(parse(stored)).length;
    if (props.start === 'search' || count === 0) return { kind: 'search' };
    if (props.at && props.at.item < count) return { kind: 'item', item: props.at.item };
    return count === 1 ? { kind: 'item', item: 0 } : { kind: 'list' };
  };
  const [level, setLevelState] = useState<Level>(initialLevel);
  // Where focus goes once a level shows: a row by its item, or the level's heading.
  // On open, the level's own place; from a jump, the value's row.
  const focusTo = useRef<string | null>(
    props.at && level.kind === 'item' ? `row-path:${[...(props.node ? [] : itemPath(parse(stored), level.item)), ...props.at.path.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))].join('/')}` : level.kind === 'search' ? 'search' : 'level',
  );
  const go = (next: Level, focus = 'level') => {
    setBarState(null);
    setSteer(null);
    focusTo.current = focus;
    setLevelState(next);
  };
  const setBar = (next: typeof bar) => setBarState(next);

  // This sheet's own element: never another sheet's.
  const anchor = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const to = focusTo.current;
    if (to === null) return;
    focusTo.current = null;
    const place = (scroll: boolean) => {
      const sheet = anchor.current?.closest<HTMLElement>('.seo-sheet');
      if (!sheet) return null;
      // A row by its path, or its ⋯ after a move; the first empty need of a new item.
      const rowAt = /^(row|menu)-path:/.test(to) ? sheet.querySelector<HTMLElement>(`.seo-crow[data-row="${CSS.escape(to.replace(/^(row|menu)-path:/, ''))}"]`) : null;
      const need = to === 'need' ? sheet.querySelector<HTMLElement>('.seo-crow[data-need][data-empty]') : null;
      // A row's value: its box or menu, once it is there (never its ⋯ meanwhile).
      const control = to.startsWith('menu-path:') ? (rowAt?.querySelector<HTMLElement>('.seo-crow-tools button:last-child') ?? null) : (rowAt ?? need)?.querySelector<HTMLElement>(ROW_CONTROL) ? controlOf(rowAt ?? need) : null;
      const exact = control ?? sheet.querySelector<HTMLElement>(`[data-focus="${CSS.escape(to)}"]`);
      const target = exact ?? sheet.querySelector<HTMLElement>('[data-focus="level"]') ?? sheet.querySelector<HTMLElement>('.seo-sheet-header h2');
      target?.focus({ preventScroll: !!rowAt });
      if (scroll) {
        if (rowAt) rowAt.scrollIntoView({ block: 'center' });
        else if (to === 'level') sheet.querySelector('.seo-body')?.scrollTo({ top: 0 });
      }
      return { target, exact: !!exact };
    };
    let placed = place(true);
    // A tab's panel mounts a frame later: the place is looked for again then.
    let tries = 0;
    // A key pressed after the place is the person moving on (Tab to the
    // next control): focus is theirs from then on.
    let moved = false;
    const onKey = () => {
      moved = true;
    };
    document.addEventListener('keydown', onKey, true);
    // Again in the next frames: until the place is there, and when a key's
    // own handling moved focus after it.
    const retry = () => {
      if (moved || (placed?.exact && document.activeElement === placed.target && tries > 0) || ++tries > 5) {
        document.removeEventListener('keydown', onKey, true);
        return;
      }
      requestAnimationFrame(() => {
        if (moved) return retry();
        placed = place(true);
        retry();
      });
    };
    retry();
    // A menu that closed puts focus back on its trigger, or on the page when
    // the trigger went: the place wins again.
    setTimeout(() => {
      const active = document.activeElement;
      const target = placed?.target;
      if (!moved && target?.isConnected && active !== target && (active === document.body || active === null || active.matches('[aria-haspopup="menu"]'))) place(false);
    }, 40);
    if (/^row-path:/.test(to)) setTimeout(() => setWashed(null), 900);
    // Never cleared by the next render (the panel's own mount is one): each
    // looks only at elements still there.
  });

  // The store follows an Undo of the bar: the text follows the store when
  // it holds nothing unsent.
  const lastStored = useRef(stored);
  useEffect(() => {
    if (stored !== lastStored.current) {
      if (textRef.current === lastStored.current) {
        setText(stored);
        setSaid(savedWords(stored));
        // An Undo that leaves no items: back to "What is it?", never an untyped
        // item; one that brings them back: to them.
        const count = itemsOf(parse(stored)).length;
        if (!props.node && count === 0 && level.kind !== 'search') go({ kind: 'search' }, 'search');
        else if (!props.node && count > 0 && level.kind === 'search' && itemsOf(parse(lastStored.current)).length === 0) go(count > 1 ? { kind: 'list' } : { kind: 'item', item: 0 });
      }
      lastStored.current = stored;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  // A write that fails is said where the save was.
  const savePhase = state.save[site ? 'site' : 'target'].phase;
  const lastPhase = useRef(savePhase);
  useEffect(() => {
    if (savePhase === 'error') setSaid("Couldn't save. Your changes are kept here.");
    else if (lastPhase.current === 'error' && savePhase !== 'saving') setSaid('Saved.');
    lastPhase.current = savePhase;
  }, [savePhase]);

  // The vocabulary, in the background.
  useEffect(() => {
    if (!server.vocabulary) return;
    loadVocabulary((release) => api.getVocabulary(release), server.vocabulary.release)
      .then((vocabulary) => setVocab({ status: 'ready', vocabulary }))
      .catch(() => setVocab({ status: 'failed' }));
  }, [api, server.vocabulary]);
  const vocabulary = vocab.status === 'ready' ? vocab.vocabulary : null;

  const cleanContext = () => ({
    home: `${server.origin.url}/`,
    url: server.preview?.url ?? '',
    langcode: server.langcode,
    taken: list.map((item) => item['@id']).filter((id): id is string => typeof id === 'string'),
    moduleIds: Object.keys(server.module_ids ?? {}),
  });
  const tidy = (current: string) => clean(current, cleanContext()).text;
  // The other hand-added texts of the scope, minified: they share 32 KB with
  // this one. The site's values count on their own.
  const othersSchema = (site ? state.edits.site.values.schema : state.edits.target.schema) ?? {};
  const others = useMemo(() => {
    const minified = (one: string | undefined) => (one ? bytes(JSON.stringify(parse(one) ?? '')) : 0);
    const extend = Object.entries(othersSchema.extend ?? {}).reduce((sum, [name, one]) => sum + (`schema.extend.${name}` !== field ? minified(one) : 0), 0);
    return extend + (field !== 'schema.custom' ? minified(othersSchema.custom) : 0);
  }, [othersSchema.extend, othersSchema.custom, field]);
  // A refusal the server gave for this text, placed where it says.
  const refusal = state.errors[scope][path];
  const refusedAt = state.places?.[path];
  const found = useMemo(() => {
    const own = problemsOf(text, rules, vocabulary, mode, tidy, others);
    if (!refusal || own.some((one) => one.tone === 'red')) return own;
    const at = refusedAt ? [...(props.node ? [] : itemPath(parse(text), refusedAt.item)), ...fromPointer(refusedAt.path)] : [];
    const offset = offsetOf(text, at);
    const line = text.slice(0, offset).split('\n').length;
    const server: Problem = { tone: 'red', line, offset, path: at, message: `Line ${line}: ${refusal}`, words: refusal };
    return [server, ...own];
  }, [text, rules, vocabulary, others, refusal, refusedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const problemsFor = (next: string, words: typeof vocabulary = vocabulary) => problemsOf(next, rules, words, mode, undefined, others);
  const ok = savable(found);
  // "Not saved: line 4 …" ends with the problem.
  useEffect(() => {
    if (ok) setSaid((last) => (last.startsWith('Not saved') ? '' : last));
  }, [ok]);
  const size = useMemo(() => (ok && text.trim() ? bytes(JSON.stringify(data)) : 0) + others, [text, ok, others]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Writes a text to the store as it is: an edit, or one with Undo in the
   * bar. The main thing goes with its item: a mark on an item no longer in
   * the text would be refused.
   */
  const store = (next: string, undo?: string) => {
    if (undo) undoMade.current = undo;
    const value = next.trim() === '' ? undefined : next;
    const main = state.edits.target.schema?.main;
    const mainGone = !props.node && !site && !!main && !itemsOf(parse(next)).some((one) => isObject(one) && one['@id'] === main);
    if (undo || mainGone) {
      programmatic.current = !!undo;
      const schema = { ...((site ? state.edits.site.values.schema : state.edits.target.schema) ?? {}) } as Record<string, unknown>;
      if (props.node) {
        schema.extend = { ...(schema.extend as Record<string, string>), [props.node]: value };
      } else {
        schema.custom = value;
      }
      if (mainGone) delete schema.main;
      dispatch({ type: 'apply', scope, values: site ? { ...state.edits.site, values: { ...state.edits.site.values, schema } } : { ...state.edits.target, schema }, undo });
    } else {
      programmatic.current = false;
      dispatch({ type: 'edit', scope, path, value });
    }
    lastStored.current = next;
  };

  // The Undo this sheet made: it goes with a change made since, and when the sheet is left.
  const undoMade = useRef<string | null>(null);
  const undoNow = useRef(state.undo);
  undoNow.current = state.undo;
  const forgetUndo = () => {
    if (undoMade.current && undoNow.current?.text === undoMade.current) dispatch({ type: 'forgetUndo', text: undoMade.current });
    undoMade.current = null;
  };
  useEffect(() => () => forgetUndo(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Saves the text when the server will take it; else keeps it as a draft. */
  const commit = (next = textRef.current, undo?: string): boolean => {
    if (readonly) return false;
    const problems = next === textRef.current ? found : problemsFor(next);
    if (next !== textRef.current) setText(next);
    const does = commitOf(next, problems, lastStored.current);
    if (does === 'draft') {
      keepDraft(key, next);
      setSaid(`Not saved: line ${problems.find((one) => one.tone === 'red')!.line} has a problem.`);
      return false;
    }
    dropDraft(key);
    if (does === 'same') return true;
    store(next, undo);
    setSaid(savedWords(next));
    return true;
  };
  /** What a save says: the items, the details, or the site's own save. */
  function savedWords(next: string): string {
    if (site) return 'Changed. Live on every page as soon as Site settings are saved.';
    if (props.node) return next.trim() === '' ? 'Saved. No details added.' : 'Saved the details.';
    const count = itemsOf(parse(next)).length;
    return count === 0 ? 'Saved. No items.' : `Saved. ${count} ${count === 1 ? 'item' : 'items'}.`;
  }

  /** A change of the working text from the form: saved on commit. */
  const change = (at: Path, next: unknown) => {
    forgetUndo();
    setText(set(textRef.current, at, next));
    // Edited typed text is translated.
    const marked = at.join('/');
    if (translate.has(marked)) {
      const rest = new Set(translate);
      rest.delete(marked);
      setTranslate(rest);
      keepDraft(`${key}|translate`, JSON.stringify([...rest]));
    }
    if (bar && !bar.tone) setBar(null);
  };

  const setTab = (next: 'form' | 'json') => {
    keepTab(next);
    setTabState(next);
  };

  // Switching keeps the place: the caret's row, or the focused value's line.
  const toForm = (offset: number) => {
    const at = pathAt(text, offset);
    const item = props.node ? 0 : Array.isArray(data) && typeof at[0] === 'number' ? at[0] : 0;
    const name = (props.node ? at : Array.isArray(data) ? at.slice(1) : at).find((part): part is string => typeof part === 'string');
    if (list[item] && !props.node) setLevelState({ kind: 'item', item });
    setWashed(name ?? null);
    setTab('form');
    setTimeout(() => setWashed(null), 900);
    requestAnimationFrame(() => document.querySelector('.seo-crow[data-washed]')?.scrollIntoView({ block: 'nearest' }));
    return name;
  };
  const showAt = (offset: number) => {
    caret.current = offset;
    setPlace((last) => ({ offset, n: (last?.n ?? 0) + 1 }));
    setTab('json');
  };
  /** Form to JSON: the caret on the value last focused, else on the item shown. */
  const toJson = () => {
    const itemAt = level.kind === 'item' && !props.node ? itemPath(data, level.item) : [];
    const row = lastRow.current && JSON.stringify(lastRow.current.slice(0, itemAt.length)) === JSON.stringify(itemAt) ? lastRow.current : null;
    if (row || level.kind === 'item') showAt(offsetOf(text, row ?? itemAt));
  };
  const showInJson = (at: Path) => showAt(offsetOf(text, at));

  // Levels: Back goes up one; at the top it closes. In JSON, and from an
  // entry point's type search, it leaves.
  const up = (): boolean => {
    if (tab === 'json' && level.kind !== 'review') return false;
    if (props.entry && level.kind === 'search') return false;
    if (level.kind === 'review') {
      go(list.length > 1 ? { kind: 'list' } : list.length ? { kind: 'item', item: 0 } : { kind: 'search' }, 'paste');
      return true;
    }
    if (props.node) return false;
    if (level.kind === 'item' && list.length > 1) {
      go({ kind: 'list' }, `row:${level.item}`);
      return true;
    }
    if (level.kind === 'search' && list.length > 0) {
      // Back on what opened it: the item's Change type, else Add an item.
      go(list.length > 1 ? { kind: 'list' } : { kind: 'item', item: 0 }, level.change !== undefined ? `row:${level.change}` : 'add');
      return true;
    }
    return false;
  };
  const close = () => {
    if (!ok && text !== stored) keepDraft(key, text);
    else if (ok) commit();
    if (props.entry && level.kind === 'search') {
      // Back to the sheet the type search was opened from, on its button.
      openSheet({ kind: 'kinds', focus: 'else' });
      return;
    }
    if (props.from && !(site && state.siteDirty)) {
      // Back to Output, on the button that opened the sheet.
      if (site) dispatch({ type: 'scope', scope: 'target' });
      openSheet({ kind: 'output', section: 'schema', focus: props.from });
      return;
    }
    props.onClose();
  };

  // A paste: cleaned, reported, reviewed when it copies the page. A string:
  // why nothing was added, said where the paste was.
  const paste = (raw: string, whole: boolean): boolean | string => {
    const before = textRef.current;
    const beforeStored = lastStored.current;
    const done = clean(raw, cleanContext());
    if (done.error) return done.error;
    if (done.text === null) {
      // Not JSON once out of its script tag or fence: an empty box takes what
      // was inside, shown in JSON at its problem, so the fix is one press away.
      if (done.kept === undefined || !(whole || before.trim() === '')) return false;
      setText(done.kept);
      keepDraft(key, done.kept);
      showAt(problemsFor(done.kept).find((one) => one.tone === 'red')?.offset ?? 0);
      return true;
    }
    const review = props.node ? null : reviewOf(done, { server, modules, existing: whole ? 0 : list.length, size: bytes(raw) });
    if (review) {
      go({ kind: 'review', review, paste: raw, before: whole ? '' : before });
      return true;
    }
    const empty = whole || before.trim() === '';
    // The items there were keep their bytes; the paste's go after them.
    const merged = empty ? done.text : appendPaste(before, done.text);
    commit(merged);
    const kept = props.node ? 1 : itemsOf(parse(merged)).length;
    if (tab === 'form') go(kept > 1 && done.items.length > 1 ? { kind: 'list' } : { kind: 'item', item: kept - 1 });
    const report = [done.report, ...done.notes].filter(Boolean).join(' ');
    const added = `${done.items.length} ${done.items.length === 1 ? 'item' : 'items'}`;
    if (report) setBar({ text: done.report ? `Cleaned up the paste and added ${added}.` : report, detail: done.report ? report : undefined, actions: [{ label: done.report ? 'Undo clean-up' : 'Undo', run: undoPaste(restorePaste(empty ? '' : before, raw), beforeStored) }] });
    return true;
  };
  /**
   * Undo clean-up: the exact paste back, saved when the server takes it;
   * else kept unsaved and shown in JSON with its problem.
   */
  const undoPaste = (back: string, beforeStored: string) => () => {
    setBar(null);
    if (commit(back)) {
      const count = itemsOf(parse(back)).length;
      go(count > 1 ? { kind: 'list' } : { kind: 'item', item: 0 }, count > 1 ? `row:${count - 1}` : 'level');
    } else {
      if (lastStored.current !== beforeStored) store(beforeStored);
      setText(back);
      keepDraft(key, back);
      const first = problemsFor(back).find((one) => one.tone === 'red');
      showAt(first?.offset ?? 0);
    }
    setSaid('Paste restored.');
  };

  // The verdicts of each item, live: the module's nodes and the other items
  // are what references reach.
  const graph = useMemo(() => {
    const nodes: Item[] = [...list];
    for (const [short, node] of modules) nodes.push({ ...node, '@id': short });
    return nodes;
  }, [list, modules]);
  // A question that is a Q&A page's main thing is judged as that page's.
  const pageTypes = server.extend_types?.['#webpage'] ?? [];
  const qaPage = [...pageTypes, ...typesOf(parse(state.edits.target.schema?.extend?.['#webpage'] ?? ''))].includes('QAPage');
  const asQuestion = (item: Item) => !props.node && qaPage && typesOf(item).includes('Question') && !!item['@id'] && item['@id'] === state.edits.target.schema?.main;
  const verdictsOf = (item: Item): Verdict[] =>
    asQuestion(item)
      ? itemVerdicts({ '@type': 'QAPage', '@id': '#webpage', mainEntity: item }, graph, rules, false).filter((one) => one.feature === 'qa')
      : itemVerdicts(item, graph, rules, !props.node);
  const words = (verdict: Verdict) => shapeNeed(verdict, rules) ?? verdictText(server, verdict);
  const forItem = template && previewing ? `For ${previewing}: ` : '';
  /** A name in a value, as this page or the previewed item fills it. */
  const fill = (value: string) =>
    value.replace(/\{(field\.[\w.]+|media\.[\w-]+|\w+)\}/g, (_, name: string) => {
      if (name.startsWith('field.')) return linking?.fields.find((row) => row.name === linkedField(name))?.value ?? '';
      if (name === 'sep') return ` ${server.separator} `;
      return (server.facts as Record<string, { value?: string } | undefined>)[name]?.value ?? '';
    });

  // JSON: a value the page gives instead, marked on its line.
  const clashMarks = useMemo((): Problem[] => {
    if (!props.node || !ok || !isObject(data)) return [];
    const from = (at: string) => {
      const prop = server.registry[server.resolved?.schema.type ?? 'WebPage']?.props?.find((one) => one.key === at.replace(/\./g, '_'));
      return prop ? `the ${prop.label} field` : site ? 'the site settings' : 'the page';
    };
    return mergeWords(nodeData, data, from).clashes.map((clash) => {
      const at = clash.path.split('.');
      const offset = offsetOf(text, at);
      const line = text.slice(0, offset).split('\n').length;
      const words = `comes from ${clash.from}, so it isn't changed here.${clash.leaf ? '' : ' Its other details are added.'}`;
      return { tone: 'amber', line, offset, path: at, message: `Line ${line} · ${at.join(' › ')}: ${words}`, words };
    });
  }, [text, ok, nodeData]); // eslint-disable-line react-hooks/exhaustive-deps

  // The verdicts of the node details are added to, as the server judged it.
  const nodeVerdicts = server.resolved?.schema.features.filter((one) => one.node?.endsWith(props.node ?? '-')) ?? [];
  // Where an item value can point.
  const withheld = server.resolved?.schema.nodes.some((node) => node.origin === 'main' && node.left_out === 'withheld') ? (server.extend_types?.['#primary'] ?? ['Thing']) : null;
  const targets = () => targetsOf({ modules, label: (short, node) => moduleLabel(server, short, node), withheld, list, pathOf: (index) => (props.node ? [] : itemPath(data, index)), rules });
  const hoist = (from: Path, to: Path) => {
    const done = hoistText(textRef.current, from, to, { moduleIds: Object.keys(server.module_ids ?? {}), rules });
    if (done) commit(done.text, `${done.name} is now its own item so both can use it.`);
  };

  const isPlainPage = !props.node && server.target?.scope !== undefined && (server.resolved?.schema.type ?? 'WebPage') === 'WebPage';
  const mainId = state.edits.target.schema?.main;
  /** An item's @id, minted first when it has none. Null: the text can't take one. */
  const idOf = (item: number): { id: string; text: string; given: boolean } | null => {
    const current = textRef.current;
    const id = list[item]['@id'];
    if (typeof id === 'string') return { id, text: current, given: false };
    const minted = mint(list[item], takenIds(list), Object.keys(server.module_ids ?? {}));
    const next = set(current, [...itemPath(data, item), '@id'], minted);
    return savable(problemsFor(next)) ? { id: minted, text: next, given: true } : null;
  };
  const setMain = (item: number) => {
    const given = idOf(item);
    if (!given || !ok) {
      keepDraft(key, textRef.current);
      setBar({ text: 'Fix the problem first: the page can only point at an item that saves.', tone: 'error' });
      return;
    }
    const schema = { ...state.edits.target.schema, custom: given.text, main: mainId === given.id ? undefined : given.id };
    setText(given.text);
    lastStored.current = given.text;
    dispatch({ type: 'apply', scope: 'target', values: { ...state.edits.target, schema }, undo: mainId === given.id ? 'No longer the main thing' : 'Marked as what the page is mainly about' });
    if (given.given) setBar({ text: `Gave the item the id ${given.id} so the page can point at it.` });
  };
  const leaveOut = (item: number) => {
    const given = idOf(item);
    if (!given || !ok) {
      keepDraft(key, textRef.current);
      setBar({ text: 'Fix the problem first: only an item that saves can be left out.', tone: 'error' });
      return;
    }
    const skip = state.edits.target.schema?.skip ?? [];
    const next = skip.includes(given.id) ? skip.filter((one) => one !== given.id) : [...skip, given.id];
    setText(given.text);
    lastStored.current = given.text;
    dispatch({ type: 'apply', scope: 'target', values: { ...state.edits.target, schema: { ...state.edits.target.schema, custom: given.text, skip: next.length ? next : undefined } }, undo: skip.includes(given.id) ? 'Put back' : leftOutText({ id: given.id, given: given.given }) });
  };
  const remove = (item: number) => {
    const label = typeLabel(typesOf(list[item])[0] ?? 'Thing', rules);
    // The main mark goes with its item (store()).
    const rest = list.filter((_, index) => index !== item);
    const next = rest.length === 0 ? '' : Array.isArray(data) ? set(textRef.current, [item], undefined) : '';
    commit(next, `Removed the item “${label}”.`);
    go(rest.length > 1 ? { kind: 'list' } : rest.length ? { kind: 'item', item: 0 } : { kind: 'search' }, rest.length > 1 ? `row:${Math.min(item, rest.length - 1)}` : rest.length ? 'level' : 'search');
  };
  const addType = (type: string) => {
    const item = { '@type': type, '@id': mint({ '@type': type, name: typeLabel(type, rules) }, takenIds(list), Object.keys(server.module_ids ?? {})) };
    const next = appendItem(textRef.current, item);
    commit(next);
    // The first thing to fill takes focus.
    go({ kind: 'item', item: list.length }, 'need');
    if (list.length === 1) setBar({ text: `Now a list of ${list.length + 1} items.` });
  };
  const changeType = (item: number, type: string) => {
    const next = set(textRef.current, [...itemPath(data, item), '@type'], type);
    // What the new type doesn't expect, its parents' details included.
    const strangers = unexpectedKeys(list[item], type, rules, vocabulary);
    commit(next, `Changed the type to ${typeLabel(type, rules)}`);
    go({ kind: 'item', item });
    if (strangers.length) {
      setBar({
        text: typeChangeWords(strangers.length, type, rules),
        actions: [
          {
            label: 'Remove them',
            run: () => {
              // As the item is now: never a detail its current type expects.
              const now = itemsOf(parse(textRef.current))[item];
              const gone = isObject(now) ? unexpectedKeys(now, typesOf(now)[0] ?? type, rules, vocabulary) : [];
              let current = textRef.current;
              for (const one of gone) current = set(current, [...itemPath(parse(current), item), one], undefined);
              setBar(null);
              if (gone.length) commit(current, `Removed ${gone.length} ${gone.length === 1 ? 'detail' : 'details'}`);
              focusTo.current = 'level';
            },
          },
          {
            label: 'Keep them',
            run: () => {
              setBar(null);
              focusTo.current = 'level';
            },
          },
        ],
      });
    }
  };
  /** The page itself as a Q&A page (or another page type): its type grows. */
  const makePage = (type: string) => {
    const page = server.extend_types?.['#webpage'] ?? ['WebPage'];
    const extend = state.edits.target.schema?.extend?.['#webpage'];
    const details = (isObject(parse(extend ?? '')) ? parse(extend!) : {}) as Item;
    const types = [...new Set([...page, ...typesOf(details), type])];
    // Only the type changes: the page's other added details keep their bytes.
    const added = isObject(parse(extend ?? '')) ? set(extend!, ['@type'], types) : pretty({ '@type': types });
    const schema: Record<string, unknown> = { ...state.edits.target.schema, extend: { ...state.edits.target.schema?.extend, '#webpage': added } };
    let index = list.length;
    // A Q&A page is about one question: it opens as the main thing.
    if (type === 'QAPage') {
      const question = { '@type': 'Question', '@id': mint({ '@type': 'Question', name: 'question' }, takenIds(list), Object.keys(server.module_ids ?? {})) };
      const next = appendItem(textRef.current, question);
      schema.custom = next;
      schema.main = question['@id'];
      setText(next);
      lastStored.current = next;
    } else {
      index = -1;
    }
    dispatch({ type: 'apply', scope: 'target', values: { ...state.edits.target, schema }, undo: `Made this page ${aType(type, rules)}` });
    if (index >= 0) go({ kind: 'item', item: index });
    else props.onClose();
  };

  // Template scope: the fields of the previewed item a value can be linked to.
  const linking = useMemo(() => {
    if (!template) return undefined;
    const fields = new Map<string, LinkField>();
    for (const row of server.sources ?? []) {
      if (row.hop || row.path.length !== 1 || fields.has(row.field)) continue;
      fields.set(row.field, { name: row.field, label: row.label, value: row.status === 'ok' ? row.value : '', kinds: row.kinds });
    }
    return { fields: [...fields.values()], type: typeName, previewing: previewing || `the previewed ${typeName.toLowerCase()}`, multilingual: Object.keys(server.languages).length > 1 };
  }, [template, server.sources, typeName, previewing, server.languages]);
  const linked = (name: string) => {
    const one = linking?.fields.find((row) => row.name === name);
    return one ? { label: one.label, value: one.value } : undefined;
  };
  // What a hand-added item lost here: a link with nothing for this item.
  const emptied = (index: number) =>
    (server.resolved?.schema.empty ?? [])
      .filter((one) => (props.node ? one.extend === props.node : one.item === index))
      .map((one) =>
        emptyWords(one, {
          field: (name) => linking?.fields.find((row) => row.name === name)?.label ?? name,
          thing: typeName.toLowerCase() || 'page',
          rules,
          node: (short) => moduleLabel(server, short, modules.get(short)).replace(/^This page's /, 'the ').replace(/ \(this site\)$/, ''),
        }),
      );

  const verdictLines = (item: Item) => verdictsOf(item).slice(0, 2);
  // The site's own items read by their names: "Humanify Studio as an employer".
  const findItem = (id: string) => list.find((one) => one['@id'] === id) ?? (id.includes('#') ? modules.get(`#${id.split('#').pop()}`) : undefined);
  const say = (item: Item) => sentence(item, rules, findItem, fill);
  const limit = list.length >= 10;
  const limitWords = limitLine(list.length, size, CUSTOM_MAX);
  const unsavedAt = (index: number) => {
    const at = itemPath(data, index);
    return found.some((one) => one.tone === 'red' && JSON.stringify(one.path.slice(0, at.length)) === JSON.stringify(at));
  };
  const copySource = server.target?.source && list.length === 0 && !props.node && !readonly ? server.target.source : null;
  const sourceLanguage = copySource ? (server.languages[copySource.langcode] ?? copySource.langcode) : '';

  const pasteRow = !readonly && (
    <PasteRow
      hint={list.length === 0}
      open={pasting !== null}
      error={pasting?.error}
      onOpen={() => setPasting({})}
      onCancel={() => setPasting(null)}
      onPaste={(raw) => {
        const done = paste(raw, list.length === 0);
        if (typeof done === 'string') {
          setPasting({ error: done });
          return;
        }
        if (done) {
          setPasting(null);
          return;
        }
        // Not JSON: an empty sheet takes it as its text, shown with its
        // problem in JSON; else the box says what is wrong.
        if (list.length === 0) {
          setPasting(null);
          setText(raw.trim());
          keepDraft(key, raw.trim());
          const first = problemsFor(raw.trim())[0];
          showAt(first?.offset ?? 0);
          return;
        }
        const first = problemsOf(raw.trim(), rules, null, mode)[0];
        setPasting({ error: first ? `What you pasted isn't valid JSON: ${first.message.replace(/^Line \d+( · [^:]+)?: /, `line ${first.line}: `)}` : "What you pasted isn't valid JSON." });
      }}
    />
  );
  const foot = !readonly && !props.node && (
    <div className="seo-clist-foot">
      <Btn variant="soft" size={28} data-focus="add" disabled={limit} aria-describedby={limitWords ? 'seo-clist-limit' : undefined} onClick={() => go({ kind: 'search' }, 'search')}>
        Add an item
      </Btn>
      {pasteRow}
      {limitWords && (
        <p className="seo-meta" id="seo-clist-limit">
          {limitWords}
        </p>
      )}
    </div>
  );
  const itemMenu = (index: number, item: Item) => {
    const id = typeof item['@id'] === 'string' ? item['@id'] : null;
    return (
      !readonly &&
      !props.node && (
        <ItemMenu
          label={say(item).replace(/\.$/, '')}
          main={isPlainPage ? { on: mainId === id && !!id, toggle: () => setMain(index) } : undefined}
          left={!!id && !!state.edits.target.schema?.skip?.includes(id)}
          onShow={() => showInJson(itemPath(data, index))}
          onOutput={() => openSheet({ kind: 'output', section: 'schema' })}
          onChangeType={() => go({ kind: 'search', change: index }, 'search')}
          onLeaveOut={() => leaveOut(index)}
          onRemove={() => remove(index)}
        />
      )
    );
  };

  // Problems in Form: the item's own, and those of the whole text. Each
  // shows under its row; one with no row shows above the form.
  const shownProblems: Problem[] =
    level.kind === 'item' && !props.node
      ? found.filter((one) => {
          const at = itemPath(data, level.item);
          return one.path.length === 0 || JSON.stringify(one.path.slice(0, at.length)) === JSON.stringify(at);
        })
      : level.kind === 'list' || props.node
        ? found
        : [];
  /** A fix in Form: the changed row keeps focus. */
  const fixInForm = (problem: Problem) => {
    focusTo.current = problem.path.length ? `row-path:${problem.path.join('/')}` : 'level';
    commit(problem.fix!.apply(textRef.current));
  };
  // The rows Form shows, read after each render: a problem without one is listed above the form.
  const [rowPaths, setRowPaths] = useState('');
  useLayoutEffect(() => {
    const panel = anchor.current?.closest('.seo-sheet')?.querySelector('.seo-cpanel[data-state="active"]');
    const next = panel ? [...panel.querySelectorAll<HTMLElement>('.seo-crow[data-row]')].map((one) => one.dataset.row).join('\n') : '';
    if (next !== rowPaths) setRowPaths(next);
  });
  const rows = new Set(rowPaths.split('\n'));
  const unplaced = shownProblems.filter((one) => !one.path.length || !rows.has(one.path.join('/')));

  // The body of each level, in Form.
  let form: ReactNode;
  if (!readable(text)) {
    const first = found[0];
    form = (
      <div className="seo-notice" role="note">
        <p>The form can't read this JSON: line {first?.line ?? 1} has a problem. Nothing is lost.</p>
        <div className="seo-notice-actions">
          {first?.fix && !readonly && (
            <Btn
              variant="soft"
              size={24}
              onClick={() => {
                focusTo.current = 'level';
                commit(first.fix!.apply(text));
              }}
            >
              {first.fix.label}
            </Btn>
          )}
          <Btn variant="ghost" size={24} onClick={() => showAt(offsetOfLine(text, first?.line ?? 1))}>
            Go to line {first?.line ?? 1}
          </Btn>
        </div>
      </div>
    );
  } else if (level.kind === 'review') {
    form = (
      <PasteReview
        review={level.review}
        rules={rules}
        onCancel={() => up()}
        onAdd={(chosen, report) => {
          const base = level.before.trim() === '' ? [] : itemsOf(parse(level.before)).filter(isObject);
          // The items there were keep their bytes.
          const next = base.length ? append(level.before, chosen.map(pretty)) : pretty(chosen.length === 1 ? chosen[0] : chosen);
          const beforeStored = lastStored.current;
          commit(next);
          const count = base.length + chosen.length;
          go(count > 1 ? { kind: 'list' } : { kind: 'item', item: 0 });
          const added = `${chosen.length} ${chosen.length === 1 ? 'item' : 'items'}`;
          setBar({ text: report ? `Cleaned up the paste and added ${added}.` : `Added ${added}.`, detail: report ?? undefined, actions: [{ label: report ? 'Undo clean-up' : 'Undo', run: undoPaste(restorePaste(level.before, level.paste), beforeStored) }] });
        }}
      />
    );
  } else if (level.kind === 'search') {
    const nodeTypes = { '#primary': modules.has('#primary') ? server.extend_types?.['#primary'] : undefined, '#webpage': server.extend_types?.['#webpage'] };
    form = (
      <div className="seo-csearch">
        {copySource && (
          <div className="seo-notice" role="note">
            <p>
              The {sourceLanguage} version has {copySource.count} hand-added {copySource.count === 1 ? 'item' : 'items'}.
            </p>
            <div className="seo-notice-actions">
              <Btn
                variant="soft"
                size={24}
                onClick={() => {
                  const marks = new Set(typedPaths(parse(copySource.custom)));
                  setTranslate(marks);
                  keepDraft(`${key}|translate`, JSON.stringify([...marks]));
                  commit(copySource.custom, `Copied from ${sourceLanguage}`);
                  const count = itemsOf(parse(copySource.custom)).length;
                  go(count > 1 ? { kind: 'list' } : { kind: 'item', item: 0 });
                }}
              >
                Copy from {sourceLanguage}
              </Btn>
            </div>
          </div>
        )}
        <FilterList<string>
          label="What is it?"
          placeholder="Search types, like rating or event"
          autoFocus
          noun={['type', 'types']}
          options={(query) => typeOptions(query, { rules, vocabulary, registry: server.registry, pageType: server.resolved?.schema.type ?? 'WebPage', nodeTypes })}
          onPick={(value) => {
            const option = typeOptions(value.startsWith('kind:') ? '' : value, { rules, vocabulary, registry: server.registry, pageType: server.resolved?.schema.type ?? 'WebPage', nodeTypes }).find((one) => one.value === value);
            const kind = value.startsWith('kind:') ? Object.entries(server.registry).find(([id]) => `kind:${id}` === value) : undefined;
            const to: Steer | undefined = kind ? { to: 'kind', kind: kind[0], name: kind[1].kind!.name, type: kind[1].primary_type ?? kind[0] } : option?.steer;
            if (to && level.change === undefined) {
              setSteer({ type: to.to === 'kind' ? to.type : value, to });
              focusTo.current = 'steer';
              return;
            }
            if (level.change !== undefined) {
              changeType(level.change, value.replace(/^kind:/, ''));
              return;
            }
            addType(value);
          }}
          empty={
            <>
              {vocab.status === 'none' && (
                <p className="seo-meta">Only types with a search feature are listed. Type an exact schema.org name to use another; the form still edits it. A site administrator can add the full list.</p>
              )}
              {vocab.status === 'failed' && <p className="seo-meta">Schema.org types couldn't load.</p>}
            </>
          }
        />
        {list.length === 0 && pasteRow}
        {steer && (
          <div className="seo-notice" role="note">
            <p>
              {steer.to.to === 'kind'
                ? `This page can describe itself as ${steer.to.name}, with its own fields and checks.`
                : steer.to.to === 'details'
                  ? `This page is already ${aType(steer.type, rules)}.`
                  : `This makes the page itself ${aType(steer.type, rules)}.`}
            </p>
            <div className="seo-notice-actions">
              {steer.to.to === 'kind' && (
                <Btn
                  variant="soft"
                  size={24}
                  data-focus="steer"
                  onClick={() => {
                    props.onClose();
                    openSheet({ kind: 'kinds' });
                  }}
                >
                  Use What this page is
                </Btn>
              )}
              {steer.to.to === 'details' && (
                <Btn variant="soft" size={24} data-focus="steer" onClick={() => openSheet({ kind: 'custom', node: (steer.to as { node: CustomNode }).node })}>
                  Add details to {steer.to.node === '#webpage' ? 'this page' : moduleLabel(server, '#primary', modules.get('#primary')).replace(/^This page's /, 'the ')}
                </Btn>
              )}
              {steer.to.to === 'page' && (
                <Btn variant="soft" size={24} data-focus="steer" disabled={readonly} onClick={() => makePage(steer.type)}>
                  Make this page {aType(steer.type, rules)}
                </Btn>
              )}
              <Btn variant="ghost" size={24} onClick={() => addType(steer.type)}>
                Add by hand anyway
              </Btn>
            </div>
          </div>
        )}
      </div>
    );
  } else if (level.kind === 'list') {
    form = (
      <div className="seo-clist">
        <p className="seo-sheet-intro">
          {template ? `Added to every ${typeName}'s structured data, filled in for each ${typeName.toLowerCase()}.` : "Added to this page's structured data as separate items."}
        </p>
        <ul>
          {list.map((item, index) => {
            const id = typeof item['@id'] === 'string' ? item['@id'] : null;
            const tags = listTags(item, { main: mainId, skip: state.edits.target.schema?.skip, unsaved: unsavedAt(index) });
            return (
              <li key={index} className="seo-clist-row">
                <button type="button" className="seo-clist-sentence" dir="auto" data-focus={`row:${index}`} onClick={() => go({ kind: 'item', item: index })}>
                  <bdi>{say(item)}</bdi>
                </button>
                <p className="seo-clist-type">
                  {typeLabel(typesOf(item)[0] ?? 'Thing', rules)}
                  {id && <code> · {id}</code>}
                  {tags.map((tag) => (
                    <span key={tag} className="seo-chip" data-tone={tag === 'Not saved' ? 'fix' : undefined}>
                      {tag}
                    </span>
                  ))}
                </p>
                {/* At most two lines under the type: a check about the page first, then the verdicts. */}
                {verdictLines(item).slice(0, issues.some((issue) => new RegExp(`^hand-\\w+:${index}(:|$)`).test(issue.id)) ? 1 : 2).map((verdict) => {
                  const label = rules.features[verdict.feature ?? '']?.label;
                  // "Employer rating · Can show" under an employer rating says it twice.
                  const named = label && label !== typeLabel(typesOf(item)[0] ?? '', rules);
                  return (
                    <p key={verdict.feature} className="seo-meta" data-verdict={verdict.verdict}>
                      {forItem}
                      {named ? `${label} · ` : ''}
                      {words(verdict)}
                    </p>
                  );
                })}
                <IssueLines index={index} readonly={readonly} onLeaveOut={() => leaveOut(index)} skip={verdictLines(item).some((one) => one.verdict === 'not_fit' && one.reason === 'own') ? ['hand-reviews'] : []} />
                {itemMenu(index, item)}
              </li>
            );
          })}
        </ul>
        {foot}
      </div>
    );
  } else {
    const index = Math.min(level.item, Math.max(0, list.length - 1));
    const item = list[index] ?? {};
    const itemAt = props.node ? [] : itemPath(data, index);
    const merged = props.node
      ? mergeWords(nodeData, item, (at) => {
          const prop = server.registry[server.resolved?.schema.type ?? 'WebPage']?.props?.find((one) => one.key === at.replace(/\./g, '_'));
          return prop ? `the ${prop.label} field` : site ? 'the site settings' : 'the page';
        })
      : null;
    const duplicate = (() => {
      const dupes = found.filter((one) => one.message.includes('appears twice'));
      const own = dupes.find((one) => JSON.stringify(one.path.slice(0, itemAt.length)) === JSON.stringify(itemAt) && one.path.length === itemAt.length + 1);
      return own ? String(own.path[own.path.length - 1]) : null;
    })();
    // The page's own values, read-only with their source, in the stage's words.
    const name = (id: string) => {
      const short = `#${id.split('#').pop()}`;
      const node = modules.get(short);
      if (typeof node?.name === 'string') return node.name;
      if (typeof node?.caption === 'string' && node.caption) return node.caption;
      // An image without words: what it is and its id ("Image · #logo").
      return node ? `${typesOf(node)[0] === 'ImageObject' ? 'Image' : typeLabel(typesOf(node)[0] ?? 'Thing', rules)} · ${short}` : null;
    };
    const from = props.node ? fromThePage(server, props.node, nodeData) : {};
    /** A value the page gives, as a row shows it: a list one per line; a clashing added value not used. */
    const shownFrom = (page: unknown, added: unknown, source: string) => ({
      text: pageValue(page, { name, ui: server.ui }),
      source,
      ...(Array.isArray(page) && page.length > 1 && { texts: page.map((one) => pageValue(one, { name, ui: server.ui })) }),
      ...(added !== undefined && !isObject(added) && JSON.stringify(added) !== JSON.stringify(page) && { unused: typeof added === 'string' ? added : JSON.stringify(added) }),
    });
    const fixed = props.node
      ? {
          from: Object.fromEntries(
            Object.entries(from)
              // Not added; added in its place (not used); or an object the details are added inside.
              .filter(([one]) => !(one in item) || !isObject(item[one]) || isObject(nodeData?.[one]) || Object.keys(item).includes(`${one}[*]`))
              .map(([one, source]) => [one, shownFrom(nodeData?.[one], isObject(item[one]) ? undefined : item[one], source)]),
          ),
          added: item,
          // An offer the page gives: details are added inside it, beside its own.
          nested: Object.fromEntries(
            Object.entries(nodeData ?? {})
              .filter(([one, value]) => !one.startsWith('@') && (isObject(value) && !(Object.keys(value).length === 1 && '@id' in value) || (Array.isArray(value) && value.length > 0 && value.every((entry) => isObject(entry)))))
              .map(([one, value]) => {
                const page = (Array.isArray(value) ? value[0] : value) as Item;
                return [one, { page, list: Array.isArray(value), from: Object.fromEntries(Object.keys(page).filter((k) => !k.startsWith('@')).map((k) => [k, shownFrom(page[k], undefined, from[one] ?? 'From the page')])) }];
              }),
          ),
        }
      : undefined;
    const lost = emptied(index);
    form = (
      <>
        {props.node && (
          <div className="seo-cextend">
            <p className="seo-sheet-intro">
              <code>
                {typesOf(nodeData).join(', ') || 'Thing'} · {props.node}
              </code>{' '}
              {site ? 'Site settings: live on every page once saved. Their values always win.' : props.node === '#webpage' ? 'Values from the page always win.' : 'Values from its fields always win.'}
            </p>
            {merged && merged.adds.length > 0 && <p className="seo-meta">Adds {andList(merged.adds.map((at) => detailLabel(at.replace(/\[.*?\]/g, '').split('.').pop()!, rules)))}.</p>}
            {merged?.unmatched.map((one) => (
              <p key={one} className="seo-meta" data-tone="improve">
                “{one}” matches nothing the page has, so it adds nothing.
              </p>
            ))}
            {nodeData && <VerdictBox quiet verdicts={nodeVerdicts} rules={rules} text={words} title={template && previewing ? `In search results, for ${previewing}` : undefined} />}
          </div>
        )}
        <ItemForm
          item={props.node ? { ...Object.fromEntries(Object.entries(nodeData ?? {}).filter(([one]) => !one.startsWith('@') || one === '@type')), ...item, '@type': nodeData?.['@type'] ?? 'Thing' } : item}
          path={itemAt}
          rules={rules}
          vocabulary={vocabulary}
          verdicts={props.node ? [] : verdictsOf(item)}
          verdictText={words}
          verdictTitle={forItem ? `In search results, for ${previewing}` : undefined}
          needsTitle={asQuestion(item) ? `Needed for ${rules.features.qa?.label ?? 'Q&A'}` : undefined}
          needs={asQuestion(item) ? ['name', 'answerCount', 'acceptedAnswer'] : undefined}
          onDetails={(short) => {
            // The site's organization is a site setting: only its editors add to it.
            if (!modules.has(short) || (short === '#identity' && !server.can.site) || short === props.node) return null;
            return () => {
              if (ok) commit();
              if (short === '#identity') dispatch({ type: 'scope', scope: 'site' });
              openSheet({ kind: 'custom', node: short as CustomNode });
            };
          }}
          verdictFix={(verdict) => {
            const fix = readonly ? null : asItem(verdict, item);
            return fix
              ? {
                  label: fix.label,
                  run: () => {
                    // The changed row takes focus: the button goes.
                    focusTo.current = `row-path:${[...itemAt, ...fix.path].join('/')}`;
                    commit(set(textRef.current, [...itemAt, ...fix.path], fix.value), `${fix.label.replace(/^Make it/, 'Made it')}`);
                  },
                }
              : null;
          }}
          targets={targets()}
          readonly={readonly}
          fixed={fixed}
          washed={washed}
          duplicate={duplicate}
          onChange={change}
          onMove={(at, index, by) => {
            commit(moveInText(textRef.current, at, index, by));
            // Focus follows the moved value to its new place.
            focusTo.current = `menu-path:${[...at, index + by].join('/')}`;
          }}
          onCommit={(removed) => commit(textRef.current, removed)}
          onShow={showInJson}
          onHoist={hoist}
          main={isPlainPage && list[index] ? { on: !!mainId && mainId === item['@id'], toggle: () => setMain(index) } : undefined}
          problems={shownProblems}
          onFix={fixInForm}
          onChangeType={props.node ? undefined : (type) => changeType(index, type)}
          menu={list.length === 1 ? itemMenu(index, item) : undefined}
          translate={translate}
          linking={linking}
          zone={server.site.timezone ?? 'UTC'}
          nested={false}
        />
        {lost.map((one) => (
          <p key={one} className="seo-meta" data-tone="improve">
            {one}
          </p>
        ))}
        {list.length === 1 && foot}
      </>
    );
  }


  const nodeName = typeof nodeData?.name === 'string' && nodeData.name ? nodeData.name : moduleLabel(server, props.node ?? '#webpage', nodeData);
  // On a template the details are every item's, never the previewed one's.
  const nodeTitle = props.node === '#webpage' ? 'this page' : template && props.node === '#primary' ? `each ${typeName.toLowerCase() || 'item'}` : nodeName;
  const title = props.node ? `Add details to ${nodeTitle}` : 'Add your own JSON-LD';
  const back = backLabel(level.kind, list.length, { node: props.node, from: props.from, siteDirty: state.siteDirty, json: tab === 'json', entry: props.entry && level.kind === 'search' ? props.entry : undefined });
  return (
    <Tabs.Root
      value={tab}
      onValueChange={(next) => {
        const was = tab;
        setTab(next as 'form' | 'json');
        setSaid(next === 'json' ? 'JSON' : 'Form');
        if (was === 'form' && next === 'json') toJson();
        if (was === 'json' && next === 'form') {
          // Focus stays on the tab; the row under the caret is shown.
          const name = toForm(caret.current);
          setSaid(`Form${name ? `, ${detailLabel(name, rules)}` : ''}`);
        }
      }}
      style={{ display: 'contents' }}
    >
      <Sheet
        title={title}
        backLabel={back}
        onBack={() => (up() ? undefined : close())}
        onClose={close}
        end={
          <div className="seo-cheader-end">
            <Tabs.List className="seo-tabs seo-ctabs" aria-label="Edit as">
              {/* One name, one string: "Form, not saved". */}
              <Tabs.Trigger value="form" className="seo-tab" aria-label={ok ? undefined : `Form, ${readable(text) ? 'not saved' : "can't read the JSON"}`}>
                Form
                {!ok && <span className="seo-dot" data-tone="fix" aria-hidden />}
              </Tabs.Trigger>
              <Tabs.Trigger value="json" className="seo-tab">
                JSON
              </Tabs.Trigger>
            </Tabs.List>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button type="button" className="seo-icon-btn" data-size={28} aria-label={props.node ? 'More for the added details' : 'More for your JSON-LD'}>
                  <DotsHorizontalIcon aria-hidden />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content size="1" align="end">
                <DropdownMenu.Item onSelect={() => void copy(text).then((done) => setSaid(done ? 'Copied' : ''))}>Copy all</DropdownMenu.Item>
                {!readonly && text.trim() !== '' && (
                  <DropdownMenu.Item
                    color="red"
                    onSelect={() => {
                      commit('', props.node ? 'Removed the added details' : 'Removed your own JSON-LD');
                      go(props.node ? { kind: 'item', item: 0 } : { kind: 'search' });
                    }}
                  >
                    Remove all
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        }
      >
        {restore && left !== null && (
          <div className="seo-notice" role="note">
            <p>
              {left.refused
                ? `Your stored JSON-LD has a problem on line ${leftAt?.line ?? 1}, so that item is left out of the page.`
                : `You left JSON-LD with a problem on line ${leftAt?.line ?? 1} unsaved.`}
            </p>
            <div className="seo-notice-actions">
              <Btn
                variant="soft"
                size={24}
                onClick={() => {
                  setText(left.text);
                  keepDraft(key, left.text);
                  setRestore(false);
                  showAt(leftAt?.offset ?? 0);
                }}
              >
                {left.refused ? 'Show it' : 'Restore'}
              </Btn>
              <Btn
                variant="ghost"
                size={24}
                onClick={() => {
                  dropDraft(key);
                  setRestore(false);
                  focusTo.current = 'level';
                  setSaid(left.refused ? 'The item with the problem stays out.' : 'Discarded.');
                }}
              >
                {left.refused ? 'Leave it out' : 'Discard'}
              </Btn>
            </div>
          </div>
        )}
        {bar && (
          <div className="seo-cbar" role="status" data-tone={bar.tone}>
            <span title={bar.text}>{bar.text}</span>
            {bar.actions?.map((action) => (
              <Btn key={action.label} variant="ghost" size={24} accent onClick={action.run}>
                {action.label}
              </Btn>
            ))}
            {bar.detail && (
              <details className="seo-cbar-more">
                <summary className="seo-cdisclose">
                  <ChevronDownIcon aria-hidden />
                  What changed
                </summary>
                <p className="seo-meta">{bar.detail}</p>
              </details>
            )}
          </div>
        )}
        {readonly && <p className="seo-meta">Read-only. You can view and copy this JSON-LD.</p>}
        <Tabs.Content
          value="form"
          className="seo-cpanel"
          onFocus={(event) => {
            // The row being edited: the switch to JSON lands on its value.
            const row = (event.target as HTMLElement).closest<HTMLElement>('.seo-crow[data-row]');
            if (row) lastRow.current = row.dataset.row!.split('/').filter((part) => part !== '').map((part) => (/^\d+$/.test(part) ? Number(part) : part));
          }}
        >
          {tab === 'form' && unplaced.length > 0 && readable(text) && level.kind !== 'review' && (
            <ProblemList
              problems={unplaced}
              text={text}
              readonly={readonly}
              form
              onFix={(next) => {
                focusTo.current = 'level';
                commit(next);
              }}
              onShow={(problem) => showAt(problem.offset)}
            />
          )}
          {form}
        </Tabs.Content>
        <Tabs.Content value="json" className="seo-cpanel">
          {level.kind === 'review' ? (
            form
          ) : (
            <>
              {props.node && <ExtendSummary node={nodeData} data={data} site={site} server={server} />}
              <JsonView
                text={text}
                data={data}
                count={lastCount.current}
                problems={clashMarks.length ? [...found, ...clashMarks].sort((a, b) => (a.tone === b.tone ? a.line - b.line : a.tone === 'red' ? -1 : 1)) : found}
                rules={rules}
                size={size}
                readonly={readonly}
                place={place}
                node={!!props.node}
                example={props.node ? detailsExample(typesOf(nodeData)) : undefined}
                linked={template ? linked : undefined}
                onChange={(next) => {
                  programmatic.current = false;
                  if (next !== textRef.current) forgetUndo();
                  setText(next);
                  if (bar && !bar.tone) setBar(null);
                }}
                onCommit={() => commit()}
                onFormat={(next) => {
                  if (next === textRef.current) return;
                  // A text that saves gets the bar's Undo (and Ctrl/Cmd+Z); one with a problem is just reformatted.
                  if (!commit(next, 'Formatted')) setText(next);
                }}
                onPaste={(raw, whole) => {
                  const done = paste(raw, whole);
                  if (typeof done !== 'string') return done;
                  setBar({ text: done, tone: 'error' });
                  return true;
                }}
                onCaret={(offset) => (caret.current = offset)}
                onEditInForm={(offset) => {
                  toForm(offset);
                  // The value's own control, never its row's link or ⋯.
                  focusTo.current = `row-path:${pathAt(text, offset).join('/')}`;
                }}
                onUndo={() => {
                  if (!programmatic.current || !state.undo) return false;
                  programmatic.current = false;
                  dispatch({ type: 'undo' });
                  return true;
                }}
              />
              {props.node && nodeData && nodeVerdicts.length > 0 && (
                <details className="seo-cverdicts-json">
                  <summary className="seo-cdisclose">
                    <ChevronDownIcon aria-hidden />
                    In search results{forItem ? `, for ${previewing}` : ''}
                  </summary>
                  <VerdictBox verdicts={nodeVerdicts} rules={rules} text={words} title={typeLabel(typesOf(nodeData)[0] ?? 'Thing', rules)} />
                </details>
              )}
              {!props.node && list.length > 0 && ok && (
                <details className="seo-cverdicts-json" open={(list.length <= 2 && !short) || undefined}>
                  <summary className="seo-cdisclose">
                    <ChevronDownIcon aria-hidden />
                    In search results{forItem ? `, for ${previewing}` : ''}
                  </summary>
                  {list.map((item, index) => {
                    const named = say(item).replace(/\.$/, '');
                    return verdictsOf(item).length ? (
                      <VerdictBox key={index} verdicts={verdictsOf(item)} rules={rules} text={words} title={named} />
                    ) : (
                      <p key={index} className="seo-meta">
                        {named}: no search feature. Search engines and other tools can still read it.
                      </p>
                    );
                  })}
                </details>
              )}
            </>
          )}
        </Tabs.Content>
        <span ref={anchor} className="seo-visually-hidden" role="status" aria-live="polite">
          {said}
        </span>
      </Sheet>
    </Tabs.Root>
  );
}

/** Whether the frame is short (under 400 px tall), as the stylesheet's media query says. */
function useShort(): boolean {
  const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-height: 400px)') : null;
  const [short, setShort] = useState(() => !!query?.matches);
  useEffect(() => {
    if (!query) return;
    const follow = () => setShort(query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return short;
}

/** The added-details summary, in both tabs: what it adds and what the page keeps. */
function ExtendSummary(props: { node: Item | undefined; data: unknown; site: boolean; server: StatePayload }) {
  const words = mergeWords(props.node, props.data, (at) => {
    const prop = props.server.registry[props.server.resolved?.schema.type ?? 'WebPage']?.props?.find((one) => one.key === at.replace(/\./g, '_'));
    return prop ? `the ${prop.label} field` : props.site ? 'the site settings' : 'the page';
  });
  if (!words.adds.length && !words.unmatched.length) return null;
  return (
    <div className="seo-cextend">
      {words.adds.length > 0 && <p className="seo-meta">Adds {words.adds.join(', ').replace(/, ([^,]*)$/, ' and $1')}.</p>}
      {words.unmatched.map((one) => (
        <p key={one} className="seo-meta" data-tone="improve">
          “{one}” matches nothing the page has, so it adds nothing.
        </p>
      ))}
    </div>
  );
}

/** The added-details node's values that come from the page, by key: "From the Price field". */
function fromThePage(server: StatePayload, node: CustomNode, item: Item | undefined): Record<string, string> {
  const from: Record<string, string> = {};
  const props = server.registry[server.resolved?.schema.type ?? 'WebPage']?.props ?? [];
  for (const one of Object.keys(item ?? {})) {
    if (one.startsWith('@')) continue;
    const prop = node === '#primary' ? props.find((p) => p.key === one || p.key.startsWith(`${one}_`)) : undefined;
    from[one] = prop ? `From the ${prop.label} field` : node === '#identity' ? 'From the site settings' : one === 'name' ? 'From the page title' : 'From the page';
  }
  return from;
}

/** What Checks says of an item: a hidden text, a rating of the site itself. */
function IssueLines(props: { index: number; readonly: boolean; onLeaveOut(): void; skip?: string[] }) {
  const { issues } = useApp();
  const recheck = useRecheck();
  const lines = issues.filter((issue) => new RegExp(`^hand-\\w+:${props.index}(:|$)`).test(issue.id) && !props.skip?.includes(issue.id.split(':')[0])).slice(0, 1);
  return (
    <>
      {lines.map((issue) => (
        <div key={issue.id} className="seo-hand-line" data-tone="improve">
          <span className="seo-hand-text">{issue.id.startsWith('hand-identity:') ? issue.detail : issue.message}</span>
          {issue.fix && 'apply' in issue.fix && !props.readonly && (
            <Btn variant="soft" size={24} onClick={props.onLeaveOut}>
              {issue.fix.label}
            </Btn>
          )}
          {issue.recheck && (
            <Btn variant="ghost" size={24} onClick={() => recheck(issue.id)}>
              {issue.recheck}
            </Btn>
          )}
        </div>
      ))}
    </>
  );
}

/** An item's ⋯: show, change, leave out, main, remove. */
function ItemMenu(props: { label: string; main?: { on: boolean; toggle(): void }; left: boolean; onShow(): void; onOutput(): void; onChangeType(): void; onLeaveOut(): void; onRemove(): void }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <button type="button" className="seo-icon-btn seo-clist-menu" data-size={24} aria-label={`More for ${props.label}`}>
          <DotsHorizontalIcon aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content size="1" align="end">
        <DropdownMenu.Item onSelect={props.onShow}>Show in JSON</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={props.onOutput}>Show in Output</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={props.onChangeType}>Change type</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={props.onLeaveOut}>{props.left ? 'Put back' : 'Leave out of the page'}</DropdownMenu.Item>
        {props.main && <DropdownMenu.Item onSelect={props.main.toggle}>{props.main.on ? 'Not what the page is mainly about' : 'This is what the page is mainly about'}</DropdownMenu.Item>}
        <DropdownMenu.Separator />
        <DropdownMenu.Item color="red" onSelect={props.onRemove}>
          Remove item
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

/**
 * "Paste JSON-LD": a box that takes a paste or a drop and hands it to the
 * clean-up. Typed text is added with "Add".
 */
function PasteRow(props: { open: boolean; error?: string; onOpen(): void; onCancel(): void; onPaste(text: string): void; hint?: boolean }) {
  const [typed, setTyped] = useState('');
  if (!props.open) {
    return props.hint ? (
      <div className="seo-cpaste-row">
        <Btn variant="soft" size={28} data-focus="paste" onClick={props.onOpen} aria-describedby="seo-cpaste-sub">
          Paste JSON-LD
        </Btn>
        <p className="seo-meta" id="seo-cpaste-sub">
          Script tags, several items and @graph are fine.
        </p>
      </div>
    ) : (
      <Btn variant="soft" size={28} data-focus="paste" onClick={props.onOpen}>
        Paste JSON-LD
      </Btn>
    );
  }
  return (
    <div className="seo-cpaste-open">
      <textarea
        className="seo-input seo-cpaste-box"
        aria-label="Paste JSON-LD"
        aria-describedby={props.error ? 'seo-cpaste-error' : 'seo-cpaste-hint'}
        aria-invalid={props.error ? true : undefined}
        placeholder="Paste here"
        rows={3}
        autoFocus
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onPaste={(event) => {
          event.preventDefault();
          const raw = event.clipboardData.getData('text/plain');
          setTyped(raw);
          props.onPaste(raw);
        }}
        onDrop={(event) => {
          const raw = event.dataTransfer.getData('text/plain');
          if (!raw) return;
          event.preventDefault();
          setTyped(raw);
          props.onPaste(raw);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            props.onCancel();
          }
        }}
      />
      <p className="seo-meta" id={props.error ? 'seo-cpaste-error' : 'seo-cpaste-hint'} data-tone={props.error ? 'fix' : undefined}>
        {props.error ?? 'Script tags, several items and @graph are fine.'}
      </p>
      <div className="seo-cpaste-actions">
        <Btn variant="soft" size={24} disabled={!typed.trim()} onClick={() => props.onPaste(typed)}>
          Add
        </Btn>
        <Btn variant="ghost" size={24} onClick={props.onCancel}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

