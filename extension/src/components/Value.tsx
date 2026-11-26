import {
  ChevronDownIcon,
  Cross2Icon,
  Link2Icon,
  LinkBreak2Icon,
  PlusIcon,
} from '@radix-ui/react-icons';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { useApp } from '../App';
import {
  dateText,
  getPath,
  fromHeading,
  inSentence,
  pageTitleSource,
  setPath,
  typeOf,
  wellFormed,
} from '../model';
import type { Fact, Kind, Part, Scope, SeoValues, Value } from '../types';
import {
  type Entry,
  FOLD,
  type Lookup,
  MAX_PARTS,
  type Shown,
  allEmptySaid,
  andWords,
  boxSaid,
  boxTag,
  braceKey,
  chipTitle,
  brokenWhy,
  composed,
  compositionSaid,
  composes,
  entriesFor,
  entriesIn,
  fieldsIn,
  fitsPart,
  fold,
  foldLabel,
  followsDefault,
  formOf,
  kindReason,
  keptAsChip,
  levelOf,
  partsOf,
  partsText,
  readsVia,
  resolve,
  sameValue,
  rowOf,
  startWords,
  tagOf,
  tree,
  withoutDefault,
  wordsShown,
} from '../values';
import type { ChipView, ComposerHandle } from './Composer';
import { Field, type FieldOptions, type FieldParts } from './Field';
import { LinkMenu, type MenuItem } from './LinkMenu';
import { Btn, IconBtn } from './ui';

/**
 * The composer and its editor library: their own chunk, loaded where a value
 * composes (a template), and fetched as soon as one is shown.
 */
let composerModule: typeof import('./Composer') | null = null;
let composerLoad: Promise<typeof import('./Composer')> | null = null;
/**
 * The composer's chunk, fetched once. A failed fetch (the network, or a
 * chunk an update removed while the dialog stayed open) is forgotten, so the
 * next try fetches again.
 */
const loadComposer = () =>
  (composerLoad ??= import('./Composer').then(
    (module) => {
      composerModule = module;
      return module;
    },
    (error: unknown) => {
      composerLoad = null;
      throw error;
    },
  ));

/** Said under a field that composes when the composer's chunk did not load. */
export const LOAD_FAILED = 'The editor could not load. Reload the editor.';

/** What a typed input gets from its field. */
export interface InputProps {
  id: string;
  describedBy?: string;
  invalid: boolean;
  disabled: boolean;
  /** The typed text; '' for none. */
  value: string;
  /** Typed text, or undefined to store nothing. */
  set(text: string | undefined): void;
  /** Alt+Down and `{` in an empty input open the link menu. */
  onKeyDown(event: KeyboardEvent<HTMLElement>): void;
  /** Opens the link menu from this control, where linking is offered. */
  openMenu?(from: HTMLElement): void;
}

/** A value as the dialog shows it at rest: dates in words. */
export const shownText = (shown: Shown, kind: Kind) =>
  kind === 'date' && shown.status === 'ok' ? dateText(shown.text) : shown.text;

/**
 * The words for a link that gives nothing for the previewed item. `item`:
 * hidden through a reference, for this item only.
 */
export function stateWords(status: Shown['status'], type: string, broken = 'no longer exists', item = false): string {
  return {
    ok: '',
    empty: `Empty for this ${type}`,
    hidden: item ? `Hidden from visitors for this ${type}` : 'Hidden from visitors',
    broken: broken[0].toUpperCase() + broken.slice(1),
    none: `No ${type} to preview`,
  }[status];
}

/** A sentence that ends once: a value may end with its own mark. */
const sentence = (text: string) => (/[.!?…。！？]["'”’)\]]*$/u.test(text) ? text : `${text}.`);

/**
 * The end of a text, at most `max` characters, from the start of a word:
 * never a cut word, and the words right before the caret always whole.
 */
const tail = (text: string, max: number): string => {
  const graphemes = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((one) => one.segment)
    : Array.from(text);
  if (graphemes.length <= max) {
    return text;
  }
  const end = graphemes.slice(-max).join('');
  const space = end.search(/\s\S/u);
  return `…${(space >= 0 ? end.slice(space + 1) : end).trimStart()}`;
};

/**
 * The Tab stop after an element (or before it), outside it: where focus goes
 * on when the stop it was heading for has gone.
 */
function nextStop(from: HTMLElement | null, forward: boolean): HTMLElement | null {
  if (!from) {
    return null;
  }
  const stops = [...from.ownerDocument.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]')].filter(
    (one) => one.tabIndex >= 0 && !one.matches(':disabled') && !one.closest('[inert], [hidden]') && one.getClientRects().length > 0 && !from.contains(one),
  );
  const after = (one: HTMLElement) => !!(from.compareDocumentPosition(one) & Node.DOCUMENT_POSITION_FOLLOWING);
  return forward ? (stops.find(after) ?? null) : (stops.filter((one) => !after(one)).at(-1) ?? null);
}


/** What a value's default gives for the item, in a form. */
const byDefaultFor = (byDefault: Value | null | undefined, words: { text: string } | undefined, lookup: Lookup, form: 'words' | 'line') =>
  byDefault ? resolve(byDefault, form, lookup).text : (words?.text ?? '');

/** What unlinking turns a value of a kind into. */
const UNLINKED: Record<Kind | 'choice', string> = {
  text: 'Type a value instead',
  address: 'Type an address instead',
  number: 'Type a number instead',
  date: 'Enter a date instead',
  image: 'Use the default image',
  html: 'Link another field instead',
  ref: 'Choose who instead',
  hours: 'Set the hours instead',
  choice: 'Choose an option instead',
};

/** The rows of a link menu for a filter and level: entries, levels and the fold. */
export function menuRows(
  entries: Entry[],
  kind: Kind,
  filter: string,
  level: string | null,
  toItem: (entry: Entry, deep: boolean) => MenuItem,
  /** The entry marked "Default": its level says so too. */
  marked?: (entry: Entry) => boolean,
): MenuItem[] {
  return tree(entries, level, filter, marked).map((row) =>
    row.type === 'entry'
      ? toItem(row.entry, row.deep)
      : row.level === FOLD
        ? { key: FOLD, label: foldLabel(entries.filter((entry) => levelOf(entry) === FOLD), kind), group: '', level: FOLD, quiet: true }
        : { key: `level:${row.level}`, label: row.level, ...(row.marked ? { hint: 'Default' } : {}), sub: `${row.count} ${row.count === 1 ? 'field' : 'fields'}`, group: row.group, level: row.level },
  );
}

/** The level a menu opens at: the one that holds the current entry. */
const startOf = (entries: Entry[], current: Value | undefined) => {
  const entry = current && entries.find((one) => sameValue(one.value, current));
  return entry ? levelOf(entry) : null;
};

/** Options of a value that may be linked. */
export interface LinkOptions {
  path: string;
  label: string;
  kind: Kind;
  /** Linking is offered here. */
  linkable: boolean;
  /** Template scope: the default a value that is not set follows, shown as a box. */
  byDefault?: Value | null;
  /**
   * What the default gives, when it is not a value of its own ("Same as
   * description"), and the worked-out value it ends at, if any.
   */
  defaultWords?: { tag: string; text: string; fact?: Fact };
  /** What happens without the link, in a clause: "its Title is used". */
  instead?: string;
  /** The image sheet, for "Choose from the media library…". */
  library?(): void;
  /** The typed input is a text input: a printable key on the box starts it. */
  typing?: boolean;
  /** A choice detail: its options. */
  choices?: string[];
  /** What the value is resolved against, when not the view's. */
  lookup?: Lookup;
  /** A reference the publisher cannot be. */
  noSite?: boolean;
  /** A choice of who: the site is chosen in its select, never a link. */
  who?: boolean;
  /** `list`: the place takes every item of a field; `one`: its first. */
  items?: 'list' | 'one';
  /** The box's value in the detail's own words: "20 min" for a duration. */
  format?(text: string): string;
}

/** The link button, the menu and the box of one value. */
function useLink(options: LinkOptions) {
  const { state, dispatch, view, locked, jump, stageVisible } = useApp();
  const server = state.server!;
  // None in Site with no page in context: the title there links nothing.
  const target = server.target ?? { scope: 'page' as const, label: 'Page' };
  const lookup = options.lookup ?? view!.lookup;
  const template = target.scope === 'template';
  const type = template ? inSentence(target.label) : 'page';
  const { path, kind, label } = options;
  const value = getPath(state.edits.target, path) as Value | undefined;
  const linked = !!value && !('text' in value) && !('parts' in value) && !(kind === 'image' && 'media' in value) && !(options.who && 'fact' in value);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [seed, setSeed] = useState('');
  const [said, setSaid] = useState({ text: '', n: 0 });
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const boxButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  // The words of a composer's guidance, without its button.
  const guideWords = useId();
  const linkButton = useRef<HTMLButtonElement>(null);
  const disabled = locked.target;
  // Nothing to preview: the value is said at rest, with no menu to open.
  const atRest = state.readonly === 'empty';
  // A template's value, and a page's value that may be linked, follows its
  // default while nothing is set: shown as a box.
  const byDefault = !value && (template || options.linkable) ? options.byDefault : null;

  // A template's text that composes: typed text and fields in one composer,
  // a lone field or the default in the box, as everywhere else.
  const prop = path.startsWith('schema.props.')
    ? typeOf(server.registry, state.edits.target.schema?.type).props?.find((one) => one.key === path.slice(13))
    : null;
  const composing = options.linkable && kind === 'text' && !options.choices && !options.who && composes(prop, path, template ? 'template' : 'page');
  const form = formOf(path);
  const allEntries = options.linkable
    ? entriesFor(path, kind, template ? 'template' : 'page', lookup, target.label, options.choices, options.items, label, composing ? form : undefined).filter((entry) => !(options.noSite && entry.key === 'fact:identity'))
    : [];
  // The composer's chunk: loaded where a value composes. Until it is there
  // the composer shows its parts at rest; if it can't load, it says so and
  // the dialog goes on.
  const [, setLoaded] = useState(!!composerModule);
  const [loadFailed, setLoadFailed] = useState(false);
  // Composing was tried from a box while the chunk could not load.
  const [tried, setTried] = useState(false);
  const load = () =>
    loadComposer().then(
      () => {
        setLoadFailed(false);
        setLoaded(true);
        return true;
      },
      () => {
        setLoadFailed(true);
        return false;
      },
    );
  useEffect(() => {
    if (composing && !composerModule) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composing]);
  // Composing started from a box (its field, or the default, as a chip), or
  // the composer has focus: it stays while focus is in it.
  const [started, setStarted] = useState<Part[] | null>(null);
  const [inside, setInside] = useState(false);
  const [mode, setMode] = useState<'link' | 'add' | 'replace'>('link');
  const [replacing, setReplacing] = useState(-1);
  const [near, setNear] = useState<number | null>(null);
  const composer = useRef<ComposerHandle>(null);
  // Composing began by a key before the composer's chunk had loaded: it takes
  // focus, the caret at the end, as it mounts.
  const focusOnMount = useRef(false);
  // The undo words of the next change the composer reports: a menu's.
  const menuUndo = useRef<string | null>(null);
  // Focus leaving the composer: where to, and by Tab which way.
  const tabbing = useRef<'forward' | 'back' | null>(null);
  const leaving = useRef<{ to: HTMLElement | null; tab: 'forward' | 'back' | null } | null>(null);
  // What a paste left out, shown under the field until focus leaves it.
  const [pasteNote, setPasteNote] = useState('');
  const typedOrComposed = !!value && ('text' in value || 'parts' in value);
  const showComposer = composing && (started !== null || inside || editing || typedOrComposed);
  const ComposerOf = composerModule?.Composer;
  const showBox = kind !== 'image' && !editing && !showComposer && (linked || !!byDefault || (!value && !!options.defaultWords && template));

  // What the box shows: the link's, or the default's.
  const shownValue = linked ? value : (byDefault ?? undefined);
  const shown: Shown = shownValue
    // Where text composes, a field reads as words: a date, every item.
    ? resolve(shownValue, composing ? form : kind, lookup)
    : wordsShown(options.defaultWords?.text ?? '', lookup.resolvable);
  const source = shownValue ? tagOf(shownValue, lookup, path, kind) : (options.defaultWords?.tag ?? '');
  // "Default · from Summary", "Site name"; "No bookmark has one".
  const follows = shownValue ?? (options.defaultWords?.fact ? { fact: options.defaultWords.fact } : undefined);
  const { tag, from, none } = boxTag({ linked, value: follows, source, label, lookup, template, type });
  const group = shownValue && 'source' in shownValue ? `${target.label} › ` : '';
  // What a default is, in words: "each event's title", "the site name".
  const defaultName =
    shownValue && 'fact' in shownValue
      ? shownValue.fact === 'site'
        ? 'the site name'
        : `${template ? `each ${type}'s` : `the ${type}'s`} ${source.toLowerCase()}`
      : `the ${source.toLowerCase()}`;
  const why = brokenWhy(lookup.broken?.[path]?.reason, kind);
  // What Reset goes back to on a template: the default it follows.
  const resetTip = !template
    ? undefined
    : options.byDefault && 'fact' in options.byDefault
      ? options.byDefault.fact === 'site'
        ? 'the site name'
        : `each ${type}'s ${tagOf(options.byDefault, lookup).toLowerCase()}`
      : options.byDefault || options.defaultWords
        ? 'the default'
        : undefined;
  // Hidden through a reference: for this item only.
  const row = rowOf(lookup, shownValue);
  const item = !!row?.hop;
  // A list linked to several values says how many: every one is used.
  const more = options.items === 'list' && row?.many && (row.count ?? 0) > 1 ? ` and ${row.count! - 1} more` : '';
  const first = options.format?.(shownText(shown, kind)) ?? shownText(shown, kind);
  // A default no item can give says so, also where the text it stands for
  // is merely empty.
  const status = shown.status === 'ok' && !first && none ? 'none' : shown.status;
  // "Leave overnight and 2 more": the first item's full stop goes.
  const valueText = status === 'ok'
    ? (more ? first.replace(/[.。]$/u, '') : first) + more
    : none ?? stateWords(shown.status, type, why, item);
  const unlinked = UNLINKED[options.choices ? 'choice' : kind];
  // The row that types a value instead of the default: "Type a title for
  // every Article", "Enter a date".
  const typeOwn = `${
    kind === 'date'
      ? 'Enter a date'
      : options.choices
        ? 'Choose an option'
        : `Type ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()}`
  }${template ? ` for every ${target.label}` : ''}`;

  // Each saying is a new node in the region, so the same words are said
  // again and two quick ones are both said. Said once: the region is emptied
  // after a while, so nothing stale is read again during later edits.
  const sayTimer = useRef<ReturnType<typeof setTimeout>>();
  const say = (text: string) => {
    clearTimeout(sayTimer.current);
    setSaid((last) => ({ text, n: last.n + 1 }));
    sayTimer.current = setTimeout(() => setSaid((last) => ({ text: '', n: last.n + 1 })), 5000);
  };
  useEffect(() => () => clearTimeout(sayTimer.current), []);
  const write = (next: Value | undefined, undo: string) =>
    dispatch({
      type: 'apply',
      scope: 'target',
      values: setPath<SeoValues>(state.edits.target, path, next),
      undo,
    });
  // At once, in the same task as the key: the next key reaches the input.
  const focusInput = () => {
    const input = document.getElementById(fieldId.current) as HTMLInputElement | null;
    input?.focus();
    input?.setSelectionRange?.(input.value.length, input.value.length);
  };
  const fieldId = useRef('');

  function openMenu(from: HTMLElement | null, filter = '', how: 'link' | 'add' | 'replace' = 'link', at = -1) {
    opener.current = from;
    setSeed(filter);
    setMode(how);
    setReplacing(at);
    setMenu(true);
  }
  function pick(entry: { value: Value; full: string }) {
    if (disabled) {
      return;
    }
    if (mode === 'add' || mode === 'replace') {
      // At the caret: focus is back in the composer at once, the caret after
      // the field, and the next key flows on.
      const part = entry.value as Part;
      const old = mode === 'replace' ? chipParts[replacing] : undefined;
      flushSync(() => {
        menuUndo.current = old ? `Replaced ${tagOf(old, lookup)}` : `Added ${entry.full}`;
        if (old) {
          composer.current?.replace(replacing, part);
        } else {
          composer.current?.insert(part);
        }
        setMenu(false);
      });
      say(old ? `${tagOf(old, lookup)} replaced by ${entry.full}.` : `${entry.full} added to ${label}.`);
      return;
    }
    // The box takes the next key at once, not when the menu has gone; from
    // a composer too.
    flushSync(() => {
      write(entry.value, `Linked to ${entry.full}`);
      setEditing(false);
      setStarted(null);
      setInside(false);
    });
    (kind === 'image' ? linkButton.current : boxButton.current)?.focus();
    setMenu(false);
    say(`${label} linked to ${entry.full}.`);
  }
  /** The menu closes on the current row: nothing is written. */
  function keep() {
    (kind === 'image' ? linkButton.current : boxButton.current)?.focus();
    setMenu(false);
  }
  /**
   * Composing, a step out of the box: its field, or the default's fact, as a
   * chip with the caret after it. With `add`, the menu at the caret.
   */
  function compose(add = false, pasted?: DataTransfer) {
    if (disabled) {
      return;
    }
    if (!composerModule) {
      // Composing, once the chunk is here; if it can't load, said, and the
      // box stays.
      void load().then((ok) => {
        if (ok) {
          compose(add, pasted);
        } else {
          setTried(true);
          say(LOAD_FAILED);
        }
      });
      return;
    }
    // A value a composition can't hold as a part (the description in a
    // title) is not carried over: composing starts empty. A paste replaces
    // the box, as a typed key does.
    const value_ = linked ? value : (byDefault ?? undefined);
    const first = !pasted && keptAsChip(value_, form, lookup, template) ? value_ : undefined;
    focusOnMount.current = true;
    flushSync(() => {
      setStarted(first ? partsOf(first) : []);
      setMenu(false);
    });
    composer.current?.focusEnd();
    if (pasted) {
      composer.current?.root()?.dispatchEvent(new ClipboardEvent('paste', { clipboardData: pasted, bubbles: true, cancelable: true }));
    }
    if (add) {
      openMenu(composer.current?.root() ?? null, '', first ? 'add' : 'link');
    }
  }
  function removeChip(at: number) {
    const old = chipParts[at];
    flushSync(() => {
      menuUndo.current = `Removed ${tagOf(old, lookup)}`;
      composer.current?.remove(at);
      setMenu(false);
    });
    say(`${tagOf(old, lookup)} removed from ${label}.`);
  }
  function unlink(typed?: string) {
    if (disabled) {
      return;
    }
    focusOnMount.current = composing;
    flushSync(() => {
      // A default left for an empty input changes nothing until something is typed.
      if (linked || typed !== undefined) {
        write(typed === undefined ? undefined : { text: typed }, linked ? 'Unlinked' : 'Typed');
      }
      setEditing(true);
    });
    setMenu(false);
    focusInput();
    // A choice's control is not found by its id: the first control there.
    if (document.activeElement === document.body) {
      box.current?.querySelector<HTMLElement>('button, input, textarea, select, [tabindex="0"]')?.focus();
    }
    if (linked) {
      say(`${label} unlinked.`);
    }
  }

  // "Link another field" in Checks: the field, then its menu.
  const handled = useRef(jump?.seq ?? 0);
  useEffect(() => {
    if (jump && jump.seq !== handled.current && jump.scope === 'target' && jump.field.startsWith(`${path}.parts.`)) {
      // "Replace field" and Show: that chip, selected, and its menu.
      handled.current = jump.seq;
      const at = fieldsIn(partsOf(value).slice(0, Number(jump.field.slice(path.length + 7)))).length;
      requestAnimationFrame(() => {
        composer.current?.select(at);
        openMenu(composer.current?.root() ?? null, '', 'replace', at);
      });
    } else if (jump && jump.seq !== handled.current && jump.link && jump.field === path && jump.scope === 'target') {
      handled.current = jump.seq;
      requestAnimationFrame(() => openMenu(boxButton.current ?? linkButton.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.seq]);

  // What the composer holds: what was started from a box, else the value.
  const composerParts = started ?? partsOf(value);
  const chipParts = fieldsIn(composerParts);
  const full = chipParts.length >= MAX_PARTS;
  // What the menu lists in its mode. A pick that links the whole value
  // leaves out the default it follows, while it follows it: the Default box
  // and Reset return to it. A value linked to that same fact keeps its row,
  // the current one. Adding or replacing a part offers it, and long text
  // waits in the last row there.
  const entries = mode === 'link' ? withoutDefault(allEntries, byDefault) : entriesIn(allEntries, mode);
  const current = mode === 'replace' ? chipParts[replacing] as Value | undefined : mode === 'add' ? undefined : linked ? value : byDefault ?? undefined;
  // Beside its label, a fact says the field it reads; linking, the field the
  // default reads says so too: the Default box may be out of sight.
  const reads = (entry: Entry) => mode === 'link' && !linked && readsVia(entry, from);
  const toItem = (entry: Entry, deep: boolean): MenuItem => ({
    key: entry.key,
    label: deep ? entry.full : entry.label,
    hint: entry.from ? `from ${entry.from}` : reads(entry) ? 'Default' : undefined,
    sub:
      entry.disabled ??
      entry.note ??
      (entry.status === 'hidden'
        ? // Through a reference: other items give it.
          `Hidden from visitors for this ${type}`
        : entry.kind === 'image'
          ? // An image reads the same from a field or a value.
            entry.image ? entry.image.alt || entry.image.name : stateWords(entry.status === 'ok' ? 'empty' : entry.status, type)
          : entry.shown
            ? entry.kind === 'date'
              ? dateText(entry.shown)
              : entry.shown
            : stateWords(entry.status === 'ok' ? 'empty' : entry.status, type)),
    subEmpty: !entry.shown && !entry.image,
    group: entry.group,
    // With eight fields, nothing more is added; a field is still replaced.
    disabled: entry.disabled ?? (mode === 'add' && full ? `At most ${MAX_PARTS} fields in one value` : undefined),
    // A default no item has is only its reason: the menu opens on what can be picked.
    current: !entry.unavailable && ((!!current && sameValue(entry.value, current)) || reads(entry)),
    // From its box, the current row changes nothing: the default it reads
    // is more than a link to that one field. An editor who left the box to
    // make a value of their own links the field they pick.
    run: () => (mode === 'link' && showBox && ((!!current && sameValue(entry.value, current)) || reads(entry)) ? keep() : pick(entry)),
  });
  const items = (filter: string, level: string | null): MenuItem[] => {
    const rows = menuRows(entries, kind, filter, level, toItem, reads);
    // A chip's menu opens where its field is: Remove is there too.
    if (level !== null && level !== FOLD && filter.trim() === '' && mode === 'replace' && chipParts[replacing]) {
      rows.unshift({ key: '#remove', label: `Remove ${tagOf(chipParts[replacing], lookup)}`, group: '', run: () => removeChip(replacing) });
    }
    if (level === null && filter.trim() === '') {
      const name = (part: Part | Value | undefined) => (part ? tagOf(part, lookup) : '');
      if (mode === 'replace' && chipParts[replacing]) {
        const old = name(chipParts[replacing]);
        // Under the filter, in sight however long the list.
        rows.unshift({ key: '#remove', label: `Remove ${old}`, group: '', pin: true, run: () => removeChip(replacing) });
      } else if (mode === 'add' && composerParts.length && !chipParts.length) {
        // Text only: the field can take its place. A step on the whole
        // value, first.
        rows.unshift({ key: '#replace-text', label: 'Replace the text with a field', sub: 'Then pick the field', group: '', pin: true, run: () => setMode('link') });
      } else if (composing && mode === 'link' && (showBox || (showComposer && !composerParts.length && !!byDefault))) {
        // The headline step, first: under the filter. In an empty composer
        // too, which still follows its default: that default becomes the
        // first chip.
        const first = linked ? value : byDefault;
        const kept = keptAsChip(first ?? undefined, form, lookup, template);
        rows.unshift({
          key: '#compose',
          label: 'Add words or fields',
          sub: startWords(kept, linked, name(first ?? undefined), label),
          group: '',
          // In sight when the menu opens on the current entry, far below.
          pin: true,
          run: () => compose(),
        });
      }
      // The social title may copy a composed search title: the copy is then
      // its own, and nothing follows anything. A step on the whole value, so
      // first with "Add words or fields".
      const main = state.edits.target.title;
      if (path === 'social.title' && composing && mode === 'link' && main && 'parts' in main) {
        rows.splice(rows[0]?.key === '#compose' ? 1 : 0, 0, {
          key: '#copy-title',
          label: 'Copy the search title',
          pin: true,
          // As it reads, the fields by name: "Title at Venue › City, Starts".
          sub: main.parts.map((part) => ('text' in part ? part.text : tagOf(part, lookup))).join('').replace(/\s+/g, ' ').trim(),
          group: '',
          run: () => {
            flushSync(() => {
              write(main, 'Copied the search title');
              setMenu(false);
            });
            composer.current?.focusEnd();
            say(`${label} copied from the search title.`);
          },
        });
      }
      if (mode !== 'link') {
        // Nothing else on the add and replace menus.
      } else if (linked) {
        rows.push({ key: '#unlink', label: 'Unlink', sub: unlinked, group: '', run: () => unlink() });
      } else if (byDefault && kind !== 'image' && !composing) {
        // Where text composes, "Add words or fields" types one's own.
        rows.push({ key: '#own', label: typeOwn, sub: 'Instead of the default', group: '', run: () => unlink() });
      }
      if (options.library) {
        rows.push({ key: '#library', label: 'Choose from the media library…', group: '', run: () => {
          // The sheet returns focus to the field, not to a menu that is gone.
          flushSync(() => setMenu(false));
          linkButton.current?.focus();
          options.library!();
        } });
      }
    }
    return rows;
  };
  const boxed = showBox || (kind === 'image' && linked);
  // The button's name follows the value alone, never where a caret was.
  const adding = showComposer && composerParts.length > 0;
  const buttonName = adding ? `Add a field to ${label}` : boxed ? `Change the link for ${label}` : `Link ${label} to a field`;
  // "Title, “in”, Venue › City": what a composition is made of.
  const madeOf = (parts: Part[]) =>
    parts.map((part) => ('text' in part ? `“${part.text.trim()}”` : tagOf(part, lookup))).filter((one) => one !== '“”').join(', ');
  // Adding, focus comes back to the composer, at its caret: never to the
  // button, which would end a composition that only holds its default.
  const openFromButton = (from: HTMLElement) => (adding ? openMenu(composer.current?.root() ?? from, '', 'add') : openMenu(from, '', 'link'));

  // One name, and the tooltip says it first.
  const button = options.linkable && !atRest && (
    <IconBtn
      ref={linkButton}
      label={buttonName}
      tip={
        !boxed
          ? adding && chipParts.length ? `${buttonName} · Made of ${madeOf(composerParts)}` : buttonName
          : `${buttonName} · ${
              !linked
                ? followsDefault(defaultName, from)
                : shown.status === 'broken'
                  ? `${tag} ${why}`
                  : `Linked to ${tag}`
            }`
      }
      data-link=""
      data-look={linked ? (shown.status === 'broken' ? 'broken' : 'linked') : 'unlinked'}
      // Adding: a click leaves focus, and the caret, in the composer. Focus
      // leaving it would end a composition that only holds its default.
      onMouseDown={adding ? (event) => event.preventDefault() : undefined}
      // The box opens the same menu: one Tab stop per field.
      tabIndex={showBox ? -1 : undefined}
      aria-haspopup="dialog"
      aria-expanded={menu}
      onClick={(event) => openFromButton(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.altKey && event.key === 'ArrowDown') {
          event.preventDefault();
          openFromButton(event.currentTarget);
        }
      }}
    >
      {adding ? <PlusIcon aria-hidden /> : linked && shown.status === 'broken' ? <LinkBreak2Icon aria-hidden /> : <Link2Icon aria-hidden />}
    </IconBtn>
  );

  // In add mode the menu says where the field goes, and the rule once.
  // As the item reads: "After “Summer Gala in”".
  // What the item shows before the caret; when that is nothing, the parts
  // by name.
  const beforeParts = menu && mode === 'add' ? (composer.current?.before() ?? []) : [];
  const before = beforeParts.length
    ? (lookup.resolvable && resultOf(beforeParts, undefined, false)) || beforeParts.map((part) => ('text' in part ? part.text : tagOf(part, lookup))).join('').replace(/\s+/g, ' ').trim()
    : '';
  const menuNode = options.linkable && (
    <LinkMenu
      open={menu}
      onClose={(how) => {
        setMenu(false);
        // Back in the composer with the caret it had.
        if (how === 'escape' && composer.current && (mode !== 'link' || opener.current === composer.current.root())) {
          composer.current.restore();
        }
      }}
      box={box}
      opener={opener}
      id={menuId}
      name={mode === 'add' ? `Add a field to ${label}` : mode === 'replace' ? `Replace ${tagOf(chipParts[replacing] ?? { text: '' }, lookup)}` : `Link ${label}`}
      filterLabel="Find a field"
      typeLabel={target.label}
      items={items}
      start={startOf(entries, current)}
      seed={seed}
      levelTitle={(level) => (level === FOLD ? "Can't be linked here" : level)}
      empty={(filter) => `No field matches “${filter.trim()}”.`}
      readOnly={disabled}
      verb={mode === 'add' ? 'add' : mode === 'replace' ? 'replace' : 'link'}
      header={disabled ? 'Read-only: nothing can be picked.' : mode === 'add' ? (full ? `At most ${MAX_PARTS} fields in one value.` : before ? `After “${tail(before, 40)}”` : 'At the start') : undefined}
      // The rule once, while a composition takes its first or second field;
      // after that its tint and "Without" line teach it.
      footer={mode === 'add' && chipParts.length <= 1 && !disabled ? <span className="seo-menu-rule">{"When an item doesn't have a field, the words joining it are left out too."}</span> : undefined}
      onBrace={showComposer ? () => {
        // `{{` types one brace.
        flushSync(() => setMenu(false));
        composer.current?.brace();
      } : undefined}
    />
  );

  const said_ = status === 'ok' ? sentence(`This ${type}: ${valueText}`) : sentence(valueText);
  const description = boxSaid({ linked, broken: shown.status === 'broken', source, group, from, why, type, defaultName, said: said_ });

  /** What the box says: where the value comes from, and what it gives. */
  const boxWords = (
    <>
      <span className="seo-linked-tag" title={tag}>
        {!linked ? null : shown.status === 'broken' ? <LinkBreak2Icon aria-hidden /> : <Link2Icon aria-hidden />}
        {tag.includes(' › ') ? (
          // A path gives way from its start: the field it ends at stays.
          <>
            <span className="seo-linked-path" dir="auto">{tag.slice(0, tag.lastIndexOf(' › ') + 3)}</span>
            <span className="seo-linked-leaf" dir="auto">{tag.slice(tag.lastIndexOf(' › ') + 3)}</span>
          </>
        ) : (
          <span className="seo-linked-leaf" dir="auto">{tag}</span>
        )}
      </span>
      <span className="seo-linked-value" data-state={status} dir={status === 'ok' ? 'auto' : undefined} title={status === 'ok' ? valueText : undefined}>
        {valueText}
      </span>
    </>
  );

  /** The box that stands for a linked value, or one that follows its default. */
  const boxNode = (field: FieldParts & { describedBy?: string }, lines = 1, inline = false) => {
    fieldId.current = field.id;
    return (
      <div className="seo-linked" data-look={linked ? (shown.status === 'broken' ? 'broken' : 'linked') : 'default'} ref={box}>
        {/* A combobox, as a select's trigger is: named for the field, its
            value the text it shows. At rest, the same words with no menu. */}
        {atRest ? (
          <div
            id={field.id}
            className="seo-linked-box"
            role="group"
            data-lines={lines}
            data-inline={inline || undefined}
            aria-labelledby={field.labelId}
            aria-describedby={[`${field.id}-said`, field.describedBy].filter(Boolean).join(' ')}
          >
            {boxWords}
          </div>
        ) : (
          <button
            ref={boxButton}
            id={field.id}
            type="button"
            role="combobox"
            aria-controls={menu ? menuId : undefined}
            className="seo-linked-box"
            data-lines={lines}
            data-inline={inline || undefined}
            data-x={(linked && !disabled) || undefined}
            aria-labelledby={field.labelId}
            aria-describedby={[`${field.id}-said`, field.describedBy].filter(Boolean).join(' ')}
            aria-haspopup="dialog"
            aria-expanded={menu}
            onClick={(event) => openMenu(event.currentTarget)}
            onPaste={(event) => {
              // Where text composes, a paste on the box replaces it, as a
              // key does: the composer takes what it can.
              if (!composing || disabled || !event.clipboardData) {
                return;
              }
              event.preventDefault();
              // The clipboard is readable during the event only: a copy.
              const copy = new DataTransfer();
              for (const type of event.clipboardData.types.filter((one) => one !== 'Files')) {
                copy.setData(type, event.clipboardData.getData(type));
              }
              compose(false, copy);
            }}
            onKeyDown={(event) => {
              if (event.altKey && event.key === 'ArrowDown') {
                event.preventDefault();
                openMenu(event.currentTarget);
              } else if (
                composing &&
                !disabled &&
                (braceKey(event) || ((event.key === 'ArrowRight' || event.key === 'End') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey))
              ) {
                // A step out of the box: its field or the default as a chip,
                // the caret after it; `{` adds a field there at once, with
                // whatever keys the layout types it with.
                event.preventDefault();
                compose(event.key === '{');
              } else if ((event.key === 'Backspace' || event.key === 'Delete') && !disabled) {
                event.preventDefault();
                unlink();
              } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey && !disabled) {
                event.preventDefault();
                if (options.typing) {
                  // Typing on a box replaces it with typed text.
                  unlink(event.key);
                } else {
                  // A date, a choice: a key never writes a value that cannot
                  // be one. It finds a field instead.
                  openMenu(event.currentTarget, event.key);
                }
              }
            }}
          >
            {boxWords}
          </button>
        )}
        <span id={`${field.id}-said`} hidden>
          {description}
        </span>
        {linked && !disabled && (
          <IconBtn label={`Unlink ${label}`} data-unlink="" onClick={() => unlink()}>
            <Cross2Icon aria-hidden />
          </IconBtn>
        )}
        {menuNode}
      </div>
    );
  };

  /** Wraps a typed input: the menu hangs from it, and leaving it empty brings the default box back. */
  const inputNode = (field: FieldParts & { describedBy?: string }, render: (props: InputProps) => ReactNode) => {
    fieldId.current = field.id;
    const text = value && 'text' in value ? value.text : '';
    return (
      <div
        className="seo-typed"
        ref={box}
        onBlur={(event) => {
          // A select's list, open, is the input's own: it keeps the input.
          if (!event.currentTarget.contains(event.relatedTarget) && !event.relatedTarget?.closest('.seo-menu, [role="listbox"]')) {
            setEditing(false);
          }
        }}
      >
        {render({
          id: field.id,
          describedBy: field.describedBy,
          invalid: field.invalid,
          disabled: field.disabled,
          value: text,
          openMenu: options.linkable ? (from) => openMenu(from) : undefined,
          set: (next) => {
            setEditing(true);
            dispatch({ type: 'edit', scope: 'target', path, value: next === undefined || next === '' ? undefined : { text: wellFormed(next) } });
          },
          onKeyDown: (event) => {
            if (!options.linkable) {
              return;
            }
            const empty = (event.currentTarget as HTMLInputElement).value === '';
            if ((event.altKey && event.key === 'ArrowDown') || (event.key === '{' && empty)) {
              event.preventDefault();
              openMenu(event.currentTarget);
            }
          },
        })}
        {menuNode}
      </div>
    );
  };

  // The composer: what each chip gives, the item's result, and what an item
  // without the chip at the caret would get.
  const brokenPath = (field: number) => {
    const stored = partsOf(value);
    let seen = -1;
    const at = stored.findIndex((part) => !('text' in part) && ++seen === field);
    return at >= 0 ? `${path}.parts.${at}` : undefined;
  };
  const chipView = (part: Part, field: number): ChipView & { why: string; from?: string } => {
    // A field labelled like a fact, or like another field, as the menu says
    // it: "Description (body)".
    const entry = 'source' in part ? allEntries.find((one) => one.key === part.source.expression) : undefined;
    // A worked-out value is named by its label alone, and says the field it
    // reads in its tooltip and the composer's description.
    const from = 'fact' in part ? (allEntries.find((one) => sameValue(one.value, part))?.from ?? lookup.facts[part.fact]?.via) : undefined;
    const tag = tagOf(part, lookup, brokenPath(field));
    const name = entry && tag === rowOf(lookup, part)?.label ? entry.full : tag;
    const one = resolve(part, form, lookup);
    const why = 'source' in part ? brokenWhy(lookup.broken?.[brokenPath(field) ?? '']?.reason, 'text') : 'no longer exists';
    const state = !lookup.resolvable ? 'none' : one.status;
    const own = state === 'ok' ? one.text : stateWords(state, type, why, !!rowOf(lookup, part)?.hop);
    return {
      label: name,
      state,
      why,
      ...(from ? { from } : {}),
      // Its value, and what the item gets without it; a field that gives
      // nothing for the item, its state only: the result already goes
      // without it.
      title: chipTitle(own, from, lookup.resolvable && chipParts.length > 1 && state === 'ok' ? `Without ${name}: ${withoutOf(field)}` : undefined),
    };
  };
  /**
   * What an item without the field at an index gets: that field empty
   * wherever it is, then its default, unless the default is that field.
   */
  function withoutOf(field: number): string {
    const chip = chipParts[field];
    const fallback = options.byDefault && sameValue(options.byDefault, chip) ? '' : byDefaultFor(options.byDefault, options.defaultWords, lookup, form);
    return resultOf(composerParts, chip) || fallback || 'nothing';
  }
  function resultOf(parts: Part[], without?: Part, ends = true): string {
    if (!ends) {
      // Up to the caret: the words typed after the last field still show.
      return composed({ parts: [...parts, { text: '\u0000' }] }, form, lookup).join('').replace('\u0000', '').replace(/\s+/g, ' ').trim();
    }
    return partsText(parts, form, lookup, without);
  }
  const result = lookup.resolvable ? resultOf(composerParts) : '';
  const views = chipParts.map((part, at) => chipView(part, at));
  const leftOut = views.filter((one) => one.state !== 'ok' && one.state !== 'none').map((one) => one.label);
  // What a default gives, when every field gives nothing.
  const fallbackText = byDefaultFor(options.byDefault, options.defaultWords, lookup, form);
  // The broken field the guidance names: said there, never twice.
  const brokenAt = views.findIndex((one) => one.state === 'broken');
  const guided = showComposer && lookup.resolvable && chipParts.length > 0 ? brokenAt : -1;
  // Every field empty: the guidance names them all ("… are empty for this
  // event, so its default title is used."), never the description too.
  const allEmptyGuided = showComposer && lookup.resolvable && chipParts.length > 0 && brokenAt < 0 && !pasteNote && !result;
  const composerSaid = !lookup.resolvable
    ? `No ${type} to preview.`
    : compositionSaid(type, result, fallbackText, allEmptyGuided ? [] : views.filter((_, at) => at !== guided).map((one) => ({ label: one.label, status: one.state, why: one.why, from: one.from })));
  // What the item gives without a chip: while it is hovered, selected whole
  // or being replaced. Never for the only field, whose "without" is the
  // default.
  const aside = menu && mode === 'replace' ? replacing : near;
  const without = aside !== null && aside >= 0 && views[aside]?.state === 'ok' && chipParts.length > 1 ? `Without ${views[aside].label}: ${withoutOf(aside)}` : null;

  // Where a preview shows the result (the Search and Social tabs), the line
  // under the fields shows only while the composer is in use, or while that
  // preview is out of sight; at rest it keeps only the fields left out for
  // the item, which no preview says. A detail has no preview: it keeps it.
  const staged = !path.startsWith('schema.');
  // One adopted field and no words: its chip and the preview say it all.
  const saysMore = composerParts.some((part) => 'text' in part) || chipParts.length > 1;
  const resultAtRest = !staged || ((inside || menu) && saysMore) || !stageVisible;
  const leftOutNote = leftOut.length ? `${andWords(leftOut)} left out for this ${type}` : '';

  /** The composer: typed text and fields as chips, the item's result inside its border. */
  const composerNode = (field: FieldParts & { describedBy?: string }, opts: { multiline?: boolean; lang?: string; placeholder?: string; trailing?: ReactNode } = {}) => {
    fieldId.current = field.id;
    const said = `${field.id}-said`;
    // Described by its result sentence and the words of its guidance: never
    // the aside's Reset button or the length count.
    const described = [
      said,
      // The guidance's words: never its "Replace field" button.
      ...(field.describedBy ?? '').split(' ').filter((id) => id && id !== field.asideId).map((id) => (id === `${field.id}-guide` ? (guided >= 0 ? guideWords : `${id}-text`) : id)),
    ].join(' ');
    const showResult = (chipParts.length > 0 || !lookup.resolvable) && (resultAtRest || !lookup.resolvable);
    return (
      <div
        className="seo-typed seo-composed"
        ref={box}
        data-multiline={opts.multiline || undefined}
        onKeyDown={(event) => {
          // Which way Tab leaves, if it does.
          tabbing.current = event.key === 'Tab' ? (event.shiftKey ? 'back' : 'forward') : null;
        }}
        onFocus={(event) => {
          focusOnMount.current = false;
          setInside(true);
          // Clear of the action bar in a short frame (the body's scroll
          // padding).
          event.currentTarget.scrollIntoView?.({ block: 'nearest' });
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (event.currentTarget.contains(next) || next?.closest('.seo-menu')) {
            return;
          }
          // Where focus went, and from which side: the box that comes back
          // never takes it from there (layout effect below).
          leaving.current = { to: next instanceof HTMLElement ? next : null, tab: tabbing.current };
          tabbing.current = null;
          // Leaving: a lone field shows as its box again, nothing as the
          // default, and the default adopted as a chip is no value.
          setInside(false);
          setStarted(null);
          setEditing(false);
          setNear(null);
          setPasteNote('');
          if (value && options.byDefault && sameValue(value, options.byDefault)) {
            dispatch({ type: 'edit', scope: 'target', path, value: undefined });
          }
        }}
      >
        <div
          className="seo-composer-box"
          data-invalid={field.invalid || undefined}
          data-readonly={disabled || undefined}
          data-near={near ?? undefined}
        >
          {atRest || !ComposerOf ? (
            // Nothing to preview, or the editor not loaded (yet): its parts,
            // said as they are.
            <div id={field.id} className="seo-composer" role="group" aria-labelledby={field.labelId} aria-describedby={described} aria-busy={(!atRest && !loadFailed) || undefined}>
              {composerParts.map((part, at) =>
                'text' in part ? (
                  <span key={at}>{part.text}</span>
                ) : (
                  <span key={at} className="seo-field-chip" data-state={atRest ? 'none' : views[fieldsIn(composerParts.slice(0, at)).length]?.state} dir="auto">
                    {chipView(part, fieldsIn(composerParts.slice(0, at)).length).label}
                  </span>
                ),
              )}
            </div>
          ) : (
            <ComposerOf
              ref={composer}
              autoFocus={focusOnMount.current}
              keepCaret={menu}
              id={field.id}
              labelId={field.labelId}
              describedBy={described}
              parts={composerParts}
              readOnly={disabled}
              invalid={field.invalid}
              lang={opts.lang}
              placeholder={opts.placeholder}
              chip={(part, at) => chipView(part, at)}
              onChange={(parts) => {
                const next = fold(parts.map((part) => ('text' in part ? { text: wellFormed(part.text) } : part)));
                const undo = menuUndo.current;
                menuUndo.current = null;
                setStarted(null);
                setEditing(true);
                if (undo) {
                  dispatch({ type: 'apply', scope: 'target', values: setPath<SeoValues>(state.edits.target, path, next), undo });
                } else {
                  dispatch({ type: 'edit', scope: 'target', path, value: next });
                }
              }}
              onAdd={(from) => openMenu(from, '', composerParts.length ? 'add' : 'link')}
              onReplace={(at, from) => openMenu(from, '', 'replace', at)}
              onRemoved={(part) => say(`${tagOf(part, lookup)} removed from ${label}.`)}
              onUndone={(part, added) => say(`${tagOf(part, lookup)} ${added ? 'added to' : 'removed from'} ${label}.`)}
              onNear={setNear}
              plain={(parts) => resultOf(parts) || parts.map((part) => ('text' in part ? part.text : '')).join('')}
              // The fields this place can take, as its menu offers them.
              accepts={(part): part is Part => fitsPart(part, form, lookup)}
              max={MAX_PARTS}
              onLeftOut={(labels) => {
                // Said, and shown under the field until focus leaves.
                const words = `${andWords(labels)} ${labels.length === 1 ? "isn't" : "aren't"} available here, so ${labels.length === 1 ? 'it was' : 'they were'} left out.`;
                setPasteNote(words);
                say(words);
              }}
            />
          )}
          {showResult ? (
            <div className="seo-composer-result" aria-hidden data-quiet={!!without || !result || undefined} title={result || undefined} dir="auto" onMouseDown={(event) => {
              // A click on the result puts the caret at the end.
              event.preventDefault();
              composer.current?.focusEnd();
            }}>
              {/* The result gives way at its end; the note keeps a line. */}
              <span className="seo-composer-text">
                {!lookup.resolvable ? `No ${type} to preview` : without ?? (result || `Default: ${fallbackText || 'nothing'}`)}
              </span>
              {lookup.resolvable && !without && result && leftOutNote && <span className="seo-composer-note">{leftOutNote}</span>}
            </div>
          ) : leftOutNote && lookup.resolvable ? (
            <div className="seo-composer-result" aria-hidden data-quiet="" dir="auto" onMouseDown={(event) => {
              event.preventDefault();
              composer.current?.focusEnd();
            }}>
              <span className="seo-composer-text">{leftOutNote}</span>
            </div>
          ) : null}
          {opts.trailing && <div className="seo-trail">{opts.trailing}</div>}
        </div>
        <span id={said} hidden>
          {composerSaid}
        </span>
        {menuNode}
      </div>
    );
  };

  const hadComposer = useRef(false);
  useLayoutEffect(() => {
    const lost = !document.activeElement || document.activeElement === document.body;
    const left = leaving.current;
    leaving.current = null;
    if (hadComposer.current && !showComposer && left?.tab && (!lost || left.to?.isConnected)) {
      // Tab or Shift+Tab on its way out: focus goes on, never back to the box.
    } else if (hadComposer.current && !showComposer && left?.tab) {
      // Where Tab was going is gone (Reset, once the value is the default
      // again): the next stop on that side.
      nextStop(box.current, left.tab === 'forward')?.focus();
    } else if (hadComposer.current && !showComposer && lost) {
      (boxButton.current ?? document.getElementById(fieldId.current))?.focus();
    }
    hadComposer.current = showComposer;
  });

  /** Under the field: what is used instead of a link that gives nothing. */
  const fallback = options.byDefault || options.defaultWords || kind === 'image'
    ? `each ${type} uses its default ${label.toLowerCase()}`
    : `the detail is left out for each ${type}`;
  // Under a composer, only what changes the whole value: a field that no
  // longer exists, or every field empty. The length guidance stays.
  const composerNote: ReactNode = !showComposer || !lookup.resolvable
    ? null
    : !chipParts.length ? (
      pasteNote || null
    ) : brokenAt >= 0 ? (
      <>
        <span id={guideWords}>{`${views[brokenAt].label} ${'source' in chipParts[brokenAt] ? brokenWhy(lookup.broken?.[brokenPath(brokenAt) ?? '']?.reason, 'text') : 'no longer exists'}, so it is left out of every ${type}'s ${label.toLowerCase()}.`}</span>
        {!disabled && (
          <Btn variant="ghost" size={24} data-own-line="" onClick={() => {
            composer.current?.select(brokenAt);
            openMenu(composer.current?.root() ?? null, '', 'replace', brokenAt);
          }}>
            Replace field
          </Btn>
        )}
      </>
    ) : pasteNote ? (
      pasteNote
    ) : !result ? (
      allEmptySaid(views.map((one) => one.label), type, label)
    ) : null;
  const note: ReactNode = (composing && loadFailed && (showComposer || tried) ? LOAD_FAILED : null) ?? composerNote ?? (linked && shown.status === 'broken' ? (
    <>
      {`${tag} ${why}, so ${fallback}.`}
      {!disabled && (
        <Btn variant="ghost" size={24} data-own-line="" onClick={() => openMenu(boxButton.current)}>
          Link another field
        </Btn>
      )}
    </>
  ) : linked && (shown.status === 'empty' || shown.status === 'hidden') && options.instead ? (
    // The box (or the image row) says the state; this, what is used.
    shown.status === 'empty'
      ? // An image by its field ("Poster"), not the image inside it.
        `This ${type} has no ${kind === 'image' ? tag.split(' › ')[0] : tag}, so ${options.instead}.`
      : `So ${options.instead}.`
  ) : null);

  const live = (
    <span className="seo-visually-hidden" role="status">
      <span key={said.n}>{said.text}</span>
    </span>
  );

  /** An image row's first line: the link, or the default it follows. */
  const imageTag =
    kind !== 'image' || (value && !linked)
      ? undefined
      : linked
        ? { text: tag, look: shown.status === 'broken' ? ('broken' as const) : ('linked' as const) }
        : byDefault
          ? { text: tag, look: 'default' as const }
          : undefined;
  /** An image row's value line when the link gives nothing: none when the note under it says so. */
  const imageState =
    linked && shown.status === 'empty' && options.instead
      ? ''
      : linked && shown.status !== 'ok' ? stateWords(shown.status, type, why, item) : byDefault ? none : undefined;

  // The length of a composition with a field is this item's.
  const varies = showComposer && chipParts.some((part) => !('fact' in part) || part.fact !== 'site') ? type : undefined;
  // Where text composes, the brace is said where nothing else is.
  const hint = composing && !disabled && !atRest && (showBox || (showComposer && !chipParts.length)) ? 'Type { to add a field' : undefined;
  // An empty composer has no length of its own: its guidance is the brace.
  const empty = showComposer && composerParts.length === 0;
  return { hint, varies, empty, resetTip, button, boxNode, inputNode, composerNode, showComposer, showBox, note, live, linked, shown, tag, value, openMenu, pick, unlink, entries, linkButton, menuNode, box, disabled, imageTag, imageState };
}

/** The plain typed input of a text value: one line, or several. */
export function TextInput(props: InputProps & { multiline?: boolean; placeholder?: string; lang?: string; required?: boolean; trailing?: ReactNode }) {
  const { multiline, placeholder, lang, required, trailing, value, set, ...rest } = props;
  return (
    <div className={trailing ? 'seo-template seo-has-trail' : 'seo-template'}>
      <textarea
        id={rest.id}
        rows={multiline ? 2 : 1}
        lang={lang}
        dir="auto"
        className="seo-input seo-textarea"
        data-multiline={multiline || undefined}
        spellCheck
        disabled={rest.disabled}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={rest.invalid || undefined}
        aria-describedby={rest.describedBy}
        value={value}
        onChange={(event) => {
          // Single-line values take line breaks as spaces.
          const text = multiline ? event.target.value : event.target.value.replace(/\s*[\r\n]+\s*/g, ' ');
          set(text);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !multiline) {
            event.preventDefault();
          }
          rest.onKeyDown(event);
        }}
      />
      {trailing && <div className="seo-trail">{trailing}</div>}
    </div>
  );
}

/**
 * A value field: typed text, or a box for a link and, at template scope, for
 * the default it follows. The link button sits by the label.
 */
export function ValueField(
  props: Omit<FieldOptions, 'scope'> &
    LinkOptions & {
      required?: boolean;
      missing?: ReactNode;
      info?: ReactNode;
      meter?: Parameters<typeof Field>[0]['meter'];
      onSuggest?(): void;
      after?: ReactNode;
      noStage?: boolean;
      note?: ReactNode;
      /** A line shown while the field is in use, when nothing else is said. */
      hint?: string;
      group?: boolean;
      /** Lines a box shows at rest. */
      lines?: number;
      /** A one-line value: its box is one control high, source before value. */
      oneLine?: boolean;
      /** The typed input: a text input unless given. */
      input?(props: InputProps): ReactNode;
      multiline?: boolean;
      placeholder?: string;
      trailing?: ReactNode;
      /** An image value: the row, instead of a box or input. */
      image?(field: FieldParts & { describedBy?: string }, link: ReturnType<typeof useLink>): ReactNode;
    },
) {
  const { state } = useApp();
  const link = useLink({ typing: !props.input, ...props });
  return (
    <Field
      {...props}
      scope="target"
      link={link.button}
      explain={link.note}
      note={props.note}
      group={props.group}
      varies={link.varies}
      hint={link.hint ?? props.hint}
      meter={link.empty ? undefined : props.meter}
      quietCount={link.showComposer}
      resetTip={props.resetTip ?? link.resetTip}
      // A linked box, and a linked image's row, has its own × to go back.
      noReset={props.noReset || ((link.showBox || !!props.image) && link.linked && !link.disabled)}
    >
      {(field) => (
        <>
          {props.image
            ? (
              <div className="seo-typed" ref={link.box}>
                {props.image(field, link)}
                {link.menuNode}
              </div>
            )
            : link.showComposer
              ? link.composerNode(field, { multiline: props.multiline, lang: state.server?.langcode, placeholder: props.placeholder, trailing: props.trailing })
              : link.showBox
              ? link.boxNode(field, props.lines, props.oneLine)
              : link.inputNode(field, (input) =>
                  props.input ? props.input(input) : (
                    <TextInput
                      {...input}
                      multiline={props.multiline}
                      placeholder={props.placeholder}
                      lang={state.server?.langcode}
                      required={props.required}
                      trailing={props.trailing}
                    />
                  ),
                )}
          {link.live}
        </>
      )}
    </Field>
  );
}

/**
 * The ending of the title: a button that shows the separator and the ending
 * and opens the ending's menu.
 */
function Ending(props: { scope: Scope; disabled: boolean; wide?: boolean }) {
  const { state, dispatch, view, goTo, setFocusField } = useApp();
  const server = state.server!;
  const target = server.target;
  const template = props.scope === 'target' && target?.scope === 'template';
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const lookup = view!.lookup;
  const identity = state.edits.site.identity;
  const siteName = (props.scope === 'site' && identity.name.trim()) || lookup.facts.site?.value || '';
  const separator = props.scope === 'site' ? identity.separator.trim() : server.separator;
  const own = (props.scope === 'site' ? state.edits.site.values.title_end : state.edits.target.title_end) as Value | undefined;
  const site = (props.scope === 'site' ? undefined : server.site.values.title_end) as Value | undefined;
  const text = (value: Value | undefined): string =>
    !value || ('fact' in value && value.fact === 'site')
      ? siteName
      : resolve(value, 'text', lookup).text;
  // As texts(): an ending of its own that gives nothing for the item falls
  // back to the site's; "No ending" is the empty typed ending.
  const isNone = (value: Value | undefined) => !!value && 'text' in value && value.text === '';
  const ownText = own && !isNone(own) ? text(own) : '';
  const none = own ? isNone(own) || (ownText === '' && isNone(site)) : isNone(site);
  const shownEnd = none ? '' : ownText || text(site);
  // A linked ending that gives nothing for the item: the button still says
  // it is linked, and why the site's ending shows.
  const ownLink = own && 'source' in own ? resolve(own, 'text', lookup) : null;
  const fellBack =
    ownLink && ownLink.status !== 'ok' && target
      ? `Linked to ${tagOf(own!, lookup, 'title_end')}, ${stateWords(
          ownLink.status,
          inSentence(target.label),
          brokenWhy(lookup.broken?.title_end?.reason, 'text'),
          !!rowOf(lookup, own)?.hop,
        ).toLowerCase()}, so ${isNone(site) ? 'the title has no ending' : 'the site ending is used'}.`
      : null;
  const close = () => {
    setMenu(false);
    // Focus left with the menu: the preview no longer points at the ending.
    requestAnimationFrame(() => {
      if (document.activeElement !== box.current) {
        setFocusField((current) => (current === 'title_end' ? null : current));
      }
    });
  };
  const set = (value: Value | undefined, undo: string) => {
    flushSync(() =>
      props.scope === 'site'
        ? dispatch({ type: 'edit', scope: 'site', path: 'values.title_end', value })
        : dispatch({ type: 'apply', scope: 'target', values: setPath<SeoValues>(state.edits.target, 'title_end', value), undo }),
    );
    box.current?.focus();
    setMenu(false);
  };
  const what = props.scope === 'site' ? 'the site' : target?.scope === 'page' ? 'this page' : `every ${target?.label}`;
  // At template scope the type's text fields, in the link menu's levels;
  // nothing that does not fit is offered.
  const entries = template
    ? entriesFor('title_end', 'text', 'template', lookup, target!.label).filter((one) => 'source' in one.value && !one.disabled)
    : [];
  const folded = (one: string) => one.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  const items = (filter: string, level: string | null): MenuItem[] => {
    const query = filter.trim();
    const fields = menuRows(entries, 'text', filter, level, (entry, deep) => ({
      key: entry.key,
      label: deep ? entry.full : entry.label,
      sub: entry.shown || stateWords(entry.status === 'ok' ? 'empty' : entry.status, inSentence(target!.label)),
      subEmpty: !entry.shown,
      group: target!.label,
      current: !!own && sameValue(own, entry.value),
      run: () => set(entry.value, `Linked to ${entry.full}`),
    }));
    if (level !== null) {
      return fields;
    }
    const options: MenuItem[] = [];
    if (own && !none && !('fact' in own && own.fact === 'site')) {
      options.push({ key: '#own', label: text(own) || tagOf(own, lookup, 'title_end'), sub: `Set for ${what}`, current: true, run: () => setMenu(false) });
    }
    if (props.scope === 'target') {
      const siteNone = !!site && 'text' in site && site.text === '';
      options.push({
        key: '#site',
        label: siteNone ? 'No ending' : text(site) || 'Site name',
        sub: 'Site default',
        current: !own,
        run: () => set(undefined, 'Ending reset'),
      });
    }
    if (props.scope === 'site' || (site && !('fact' in site))) {
      options.push({
        key: '#name',
        label: 'Site name',
        sub: siteName || 'The site has no name',
        current: props.scope === 'site' ? !own : !!own && 'fact' in own && own.fact === 'site',
        run: () => set(props.scope === 'site' ? undefined : { fact: 'site' }, 'Ending set to the site name'),
      });
    }
    options.push({ key: '#none', label: 'No ending', sub: 'The title ends with its main part', current: !!own && none, run: () => set({ text: '' }, 'No ending') });
    // What matches comes first; typing an ending of its own is the last row.
    return [
      ...options.filter((row) => !query || folded(`${row.label} ${row.sub ?? ''}`).includes(folded(query))),
      ...fields,
      ...(query ? [{ key: '#use', label: `Use “${query}” as the ending`, run: () => set({ text: query }, `Ending set to “${query}”`) }] : []),
    ];
  };

  const words = (
    <>
      {fellBack && <Link2Icon aria-hidden className="seo-ending-link" data-look={ownLink?.status === 'broken' ? 'broken' : undefined} />}
      {!none && <span className="seo-ending-sep" aria-hidden>{separator}</span>}
      <span dir="auto">{none ? 'No ending' : shownEnd || 'Site name'}</span>
    </>
  );
  if (state.readonly === 'empty') {
    // Nothing to preview: the ending is said at rest, as text.
    return (
      <span className="seo-ending" data-wide={props.wide || undefined}>
        <span className="seo-ending-btn" data-static="" data-set={own !== undefined || undefined} title={fellBack ?? undefined}>
          {words}
        </span>
      </span>
    );
  }
  return (
    <span
      className="seo-ending"
      data-wide={props.wide || undefined}
      // The ending and its menu (a portal, whose focus events bubble here):
      // the preview points at the ending, not at the main part.
      onFocus={(event) => {
        event.stopPropagation();
        setFocusField('title_end');
      }}
      onBlur={(event) => {
        event.stopPropagation();
        const next = event.relatedTarget;
        if (!(next && (event.currentTarget.contains(next) || next.closest('.seo-menu')))) {
          setFocusField((current) => (current === 'title_end' ? null : current));
        }
      }}
    >
      <button
        ref={box}
        type="button"
        className="seo-ending-btn"
        id={props.scope === 'site' ? 'seo-site-title-end' : undefined}
        // A jump to the site's ending lands here.
        data-focus={props.scope === 'site' || undefined}
        data-set={own !== undefined || undefined}
        aria-label={`Title ending: ${none ? 'No ending' : shownEnd || 'Site name'}`}
        aria-description={fellBack ?? (none ? 'The title ends with its main part.' : `Added after the separator ${separator}.`)}
        title={fellBack ?? undefined}
        aria-haspopup="dialog"
        aria-expanded={menu}
        onClick={(event) => {
          opener.current = event.currentTarget;
          setMenu(true);
        }}
        onKeyDown={(event) => {
          if (event.altKey && event.key === 'ArrowDown') {
            event.preventDefault();
            opener.current = event.currentTarget;
            setMenu(true);
          }
        }}
      >
        {words}
        <ChevronDownIcon aria-hidden />
      </button>
      <LinkMenu
        open={menu}
        onClose={close}
        box={box}
        opener={opener}
        name="Title ending"
        filterLabel={template ? 'Type an ending or find a field' : 'Type an ending'}
        typeLabel={target?.label ?? 'Page'}
        items={items}
        start={startOf(entries, own)}
        empty={(filter) => `No field matches “${filter.trim()}”.`}
        readOnly={props.disabled}
        // In Site the separator sits right below the title.
        footer={props.scope === 'site' ? undefined : (
          <>
            <span>
              The separator <b>{separator}</b> is set for the whole site.
            </span>
            {server.can.site && (
              <Btn
                variant="ghost"
                size={24}
                onClick={() => {
                  setMenu(false);
                  goTo({ scope: 'site', tab: 'defaults', field: 'identity.separator' });
                }}
              >
                Edit
              </Btn>
            )}
          </>
        )}
      />
    </span>
  );
}

/**
 * The title: one control in two parts, the main part and its ending. The
 * main part is typed text on a page and a value that may be linked on a
 * template; Site sets only the ending. Reset removes both.
 */
export function TitleField(
  props: {
    scope: Scope;
    meter?: Parameters<typeof Field>[0]['meter'];
    onSuggest?(): void;
    after?: ReactNode;
    trailing?: ReactNode;
    note?: ReactNode;
    /** What the main part shows while nothing is typed. */
    placeholder?: string;
  },
) {
  const { state, dispatch, locked, view } = useApp();
  const server = state.server!;
  const template = props.scope === 'target' && server.target?.scope === 'template';
  // A page still named for a new page: its title is its first heading.
  const heading = server.target?.scope === 'page' && state.edits.target.title === undefined && !!view && fromHeading(view.facts);
  // Only the ending set: the aside names it, and what Reset goes back to.
  const endingOnly = state.edits.target.title === undefined && state.edits.target.title_end !== undefined;
  const bothSet = state.edits.target.title !== undefined && state.edits.target.title_end !== undefined;
  const link = useLink({
    path: 'title',
    label: 'Title',
    kind: 'text',
    linkable: template,
    byDefault: { fact: 'title' },
    instead: 'its Title is used',
    typing: true,
  });
  if (props.scope === 'site') {
    return (
      <Field
        scope="site"
        path="values.title_end"
        label="Title ending"
        group
        source="Every page"
        note={props.note}
      >
        {() => <Ending scope="site" disabled={locked.site} wide />}
      </Field>
    );
  }
  return (
    <Field
      scope="target"
      path="title"
      also={['title_end']}
      label="Title"
      source={
        endingOnly
          ? server.target?.scope === 'page'
            ? 'Ending set on this page'
            : `Ending set for every ${server.target?.label}`
          : heading
            ? pageTitleSource(view!.facts)
            : undefined
      }
      // Reset clears both parts: said where both are set.
      resetTip={endingOnly ? 'the site ending' : bothSet ? `the default title and the site ending` : undefined}
      resetWhat={endingOnly ? 'title ending' : undefined}
      link={link.button}
      meter={link.empty ? undefined : props.meter}
      quietCount={link.showComposer}
      varies={link.varies}
      hint={link.hint}
      onSuggest={props.onSuggest}
      after={props.after}
      explain={link.note}
      note={props.note}
      onReset={() =>
        dispatch({
          type: 'apply',
          scope: 'target',
          values: setPath<SeoValues>(setPath<SeoValues>(state.edits.target, 'title', undefined), 'title_end', undefined),
          undo: 'Reset',
          path: 'title',
        })
      }
    >
      {(field) => (
        <div className="seo-title-parts">
          <div className="seo-title-main">
            {link.showComposer
              ? link.composerNode(field, { lang: server.langcode, placeholder: props.placeholder, trailing: props.trailing })
              : link.showBox
              ? link.boxNode(field, 1, true)
              : link.inputNode(field, (input) => (
                  <TextInput
                    {...input}
                    placeholder={props.placeholder}
                    lang={server.langcode}
                    trailing={props.trailing}
                  />
                ))}
          </div>
          <Ending scope="target" disabled={locked.target} />
          {link.live}
        </div>
      )}
    </Field>
  );
}

export { kindReason };
