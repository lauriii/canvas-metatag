// The composer: one control that looks like an input and holds typed text and
// fields as chips. Built on lexical (plain text, history); nothing else in the
// dialog imports it. A chip is a token-mode text node: its label stays in the
// text flow, so the caret, selection and assistive technology treat it as
// words, and it goes as one.
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { registerPlainText } from '@lexical/plain-text';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createRangeSelectionFromDom,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type BaseSelection,
  CLEAR_HISTORY_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  CUT_COMMAND,
  type EditorConfig,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  PASTE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type SerializedTextNode,
  TextNode,
  createEditor,
} from 'lexical';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';

import type { Part } from '../types';
import { braceKey, fieldsIn, fold, sameValue } from '../values';

/**
 * The words each composer leaves out with a field that gives nothing: one
 * CSS highlight holds them all, since highlights are named for the document.
 */
const droppedWords = new Map<object, Range[]>();

/** An update that joins the history entry before it: filling is no step. */
const HISTORY_MERGE_TAG = 'history-merge';

/** The clipboard type that carries parts between composers of the dialog. */
const CLIPBOARD = 'application/x-canvas-metatag-parts';

/** What a chip shows and says. */
export interface ChipView {
  label: string;
  /** `none`: no item to preview; the chip is neutral. */
  state: 'ok' | 'empty' | 'hidden' | 'broken' | 'none';
  /** The tooltip: its value or its state in words. */
  title: string;
}

export interface ComposerHandle {
  /** Inserts a field at the last caret (else at the end), the caret after it. */
  insert(part: Part): void;
  /** Replaces the chip at an index of the fields. */
  replace(field: number, part: Part): void;
  /** Removes the chip at an index of the fields. */
  remove(field: number): void;
  /** Focus, the caret at the end. */
  focusEnd(): void;
  /** Selects a chip whole. */
  select(field: number): void;
  /** Focus, with the caret or selection it last had. */
  restore(): void;
  /** Types a brace at the caret, as `{{` does. */
  brace(): void;
  /** The parts before the last caret (the end without one). */
  before(): Part[];
  root(): HTMLElement | null;
}

export interface ComposerProps {
  id: string;
  labelId: string;
  describedBy?: string;
  parts: Part[];
  /** Each change, as parts (not yet folded). */
  onChange(parts: Part[]): void;
  /** What a chip shows, by its index among the chips (-1: not placed yet). */
  chip(part: Part, at: number): ChipView;
  /** `{`, Alt+Down, Enter or the button: the menu at the caret. */
  onAdd(from: HTMLElement): void;
  /** A click on a chip, or Enter on a selected one. */
  onReplace(field: number, from: HTMLElement): void;
  /** A chip was removed by a key. */
  onRemoved(part: Part): void;
  /** Undo or redo brought a chip back, or took it away. */
  onUndone(part: Part, added: boolean): void;
  /** A chip is hovered or selected whole, or none: what the item gives without it. */
  onNear(field: number | null): void;
  /** What a selection reads as, for the clipboard's plain text. */
  plain(parts: Part[]): string;
  /** Whether a pasted part fits here; one that doesn't is left out and said. */
  accepts(part: unknown): part is Part;
  /** How many fields a composition may hold. */
  max: number;
  onLeftOut(labels: string[]): void;
  readOnly?: boolean;
  /** Focus as it mounts, the caret at the end. */
  autoFocus?: boolean;
  /** A menu of its own is open: focus coming back keeps the caret it had. */
  keepCaret?: boolean;
  invalid?: boolean;
  lang?: string;
  placeholder?: string;
  onFocus?(): void;
  onBlur?(event: React.FocusEvent<HTMLElement>): void;
}

/** A field or fact in a composition: its label is text, and it goes as one. */
class ChipNode extends TextNode {
  __part: string;
  /** Its label as made: what it shows whatever is typed into it. */
  __label: string;

  static getType(): string {
    return 'seo-chip';
  }

  static clone(node: ChipNode): ChipNode {
    const clone = new ChipNode(node.__part, node.__text, node.__key);
    clone.__label = node.__label;
    return clone;
  }

  static importJSON(json: SerializedTextNode & { part: string }): ChipNode {
    return $chip(JSON.parse(json.part) as Part, json.text);
  }

  constructor(part: string, text: string, key?: NodeKey) {
    super(text, key);
    this.__part = part;
    this.__label = text;
  }

  exportJSON(): SerializedTextNode & { part: string } {
    return { ...super.exportJSON(), type: 'seo-chip', part: this.__part };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.classList.add('seo-field-chip');
    dom.spellcheck = false;
    dom.setAttribute('translate', 'no');
    dom.dir = 'auto';
    return dom;
  }

  isTextEntity(): true {
    return true;
  }

  canInsertTextBefore(): false {
    return false;
  }

  canInsertTextAfter(): false {
    return false;
  }

  part(): Part {
    return JSON.parse(this.getLatest().__part) as Part;
  }
}

const $chip = (part: Part, label: string) => new ChipNode(JSON.stringify(part), label).setMode('token') as ChipNode;
const $isChip = (node: LexicalNode | null | undefined): node is ChipNode => node instanceof ChipNode;

/**
 * A chip whose text changed (a key that reached it) gets its label back; the
 * typed characters become text beside it.
 */
function $keepLabel(chip: ChipNode) {
  const text = chip.getTextContent();
  const label = chip.getLatest().__label;
  if (text === label) {
    return;
  }
  const writable = chip.getWritable();
  writable.__text = label;
  const before = text.startsWith(label) ? '' : text.endsWith(label) ? text.slice(0, text.length - label.length) : '';
  const after = text.startsWith(label) ? text.slice(label.length) : '';
  if (before) {
    chip.insertBefore($createTextNode(before));
  }
  if (after) {
    const node = $createTextNode(after);
    chip.insertAfter(node);
    node.select(after.length, after.length);
  } else {
    $over(chip, true, false);
  }
}

/** The editor's content as parts, in order. */
function $parts(): Part[] {
  const parts: Part[] = [];
  const text = (value: string) => {
    const last = parts.at(-1);
    if (last && 'text' in last) {
      parts[parts.length - 1] = { text: last.text + value };
    } else if (value !== '') {
      parts.push({ text: value });
    }
  };
  $getRoot().getChildren().forEach((block, at) => {
    if (at > 0) {
      text(' ');
    }
    for (const node of $isElementNode(block) ? block.getChildren() : []) {
      if ($isChip(node)) {
        parts.push(node.part());
      } else if ($isLineBreakNode(node)) {
        text(' ');
      } else if ($isTextNode(node)) {
        text(node.getTextContent().replace(/[\r\n]+/g, ' '));
      }
    }
  });
  return parts;
}

/** Fills the editor with parts. Line breaks show as spaces. */
function $fill(parts: Part[], label: (part: Part, at: number) => string) {
  const root = $getRoot();
  root.clear();
  const block = $createParagraphNode();
  let at = 0;
  for (const part of parts) {
    block.append('text' in part ? $createTextNode(part.text.replace(/\s*[\r\n]+\s*/g, ' ')) : $chip(part, label(part, at++)));
  }
  root.append(block);
}

/** The chips in order. */
const $chips = (): ChipNode[] => $getRoot().getAllTextNodes().filter($isChip);

/** The chip a point is inside of, or beside in a direction. */
function $chipAt(selection: BaseSelection | null, forward: boolean): ChipNode | null {
  if (!$isRangeSelection(selection)) {
    return null;
  }
  const point = selection.focus;
  const node = point.getNode();
  if ($isChip(node)) {
    // Its end is after it and its start before it: the browser puts a caret
    // beside a chip at either, the same place as the text next to it.
    const edge = forward ? point.offset >= node.getTextContentSize() : point.offset === 0;
    return edge ? null : node;
  }
  if ($isTextNode(node)) {
    const edge = forward ? point.offset === node.getTextContentSize() : point.offset === 0;
    const next = edge ? (forward ? node.getNextSibling() : node.getPreviousSibling()) : null;
    return $isChip(next) ? next : null;
  }
  if ($isElementNode(node)) {
    const child = node.getChildAtIndex(forward ? point.offset : point.offset - 1);
    return $isChip(child) ? child : null;
  }
  return null;
}

/** Moves the focus (and the anchor, unless extending) over a chip. */
function $over(chip: ChipNode, forward: boolean, extend: boolean, from: BaseSelection | null = $getSelection()) {
  const selection = from;
  if (!$isRangeSelection(selection)) {
    return;
  }
  const parent = chip.getParentOrThrow();
  const index = chip.getIndexWithinParent() + (forward ? 1 : 0);
  if (extend) {
    // A new selection, so that it is drawn again: its anchor, its focus past
    // the chip.
    const range = $createRangeSelection();
    range.anchor.set(selection.anchor.key, selection.anchor.offset, selection.anchor.type);
    range.focus.set(parent.getKey(), index, 'element');
    $setSelection(range);
  } else {
    const next = forward ? chip.getNextSibling() : chip.getPreviousSibling();
    if ($isTextNode(next) && !$isChip(next)) {
      next.select(forward ? 0 : next.getTextContentSize(), forward ? 0 : next.getTextContentSize());
    } else {
      const range = $createRangeSelection();
      range.anchor.set(parent.getKey(), index, 'element');
      range.focus.set(parent.getKey(), index, 'element');
      $setSelection(range);
    }
  }
}

/**
 * A collapsed caret at a chip's edge, put beside it: text inserted into a
 * token would replace it.
 */
function $beside() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return;
  }
  const node = selection.anchor.getNode();
  if ($isChip(node)) {
    const parent = node.getParentOrThrow();
    const index = node.getIndexWithinParent() + (selection.anchor.offset * 2 >= node.getTextContentSize() ? 1 : 0);
    selection.anchor.set(parent.getKey(), index, 'element');
    selection.focus.set(parent.getKey(), index, 'element');
  }
}

/** The parts a selection holds, text cut at its ends. */
function $selected(): Part[] {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    return [];
  }
  const [start, end] = selection.isBackward() ? [selection.focus, selection.anchor] : [selection.anchor, selection.focus];
  const parts: Part[] = [];
  for (const node of selection.getNodes()) {
    if ($isChip(node)) {
      parts.push(node.part());
    } else if ($isTextNode(node)) {
      const text = node.getTextContent();
      const from = node.getKey() === start.key && start.type === 'text' ? start.offset : 0;
      const to = node.getKey() === end.key && end.type === 'text' ? end.offset : text.length;
      if (to > from) {
        parts.push({ text: text.slice(from, to) });
      }
    }
  }
  return parts;
}

/** The chip a selection is, when it is exactly one. */
function $selectedChip(): ChipNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) {
    return null;
  }
  const nodes = selection.getNodes();
  const chips = nodes.filter($isChip);
  return chips.length === 1 && $selected().every((part) => !('text' in part) || part.text.trim() === '') ? chips[0] : null;
}

/**
 * Pasted parts without the ones left out (null), and without the words that
 * go with them: the run before a field, but a closing mark goes with the
 * field before it and a lead-in label stays; after the last field, its unit.
 * The rule of Values::compose().
 */
function withoutWords(parts: (Part | null)[]): Part[] {
  const out = [...parts];
  const fields = out.flatMap((part, at) => (part === null || !('text' in part) ? [at] : []));
  for (const [nth, at] of fields.entries()) {
    if (out[at] !== null || parts[at] !== null) {
      continue;
    }
    const before = out[at - 1];
    if (before && 'text' in before) {
      const lead = !fields.some((one) => one < at);
      const close = lead ? 0 : (/^(?:\p{Pe}|[\p{Pi}\p{Pf}"'](?=$|[\s\p{P}]))/u.exec(before.text)?.[0].length ?? 0);
      out[at - 1] = lead && /[:.!?…|·•–—\-/]\s*$/u.test(before.text) ? before : { text: before.text.slice(0, close) };
    }
    const after = out[at + 1];
    if (nth === fields.length - 1 && after && 'text' in after && !/^[\s·•|–—\-/,;:]*$/u.test(after.text)) {
      out[at + 1] = { text: '' };
    }
  }
  return out.filter((part): part is Part => part !== null && (!('text' in part) || part.text !== ''));
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(props, ref) {
  const element = useRef<HTMLDivElement>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  // The parts it last gave or was given: an incoming value equal to them is
  // its own, never written back under the caret.
  const known = useRef<Part[]>(props.parts);
  const lastSelection = useRef<BaseSelection | null>(null);
  const latest = useRef(props);
  latest.current = props;
  // Set while the composer fills itself: no change, no announcement.
  const filling = useRef(false);
  // Set while the dialog focuses it to put the caret somewhere itself.
  const quiet = useRef(false);
  const quietFocus = () => {
    quiet.current = true;
    element.current?.focus();
    quiet.current = false;
  };

  const label = (part: Part, at = -1) => latest.current.chip(part, at).label;

  // The chip beside the caret, the one under the pointer, the one selected
  // whole.
  const near_ = useRef<number | null>(null);
  const hovered = useRef<number | null>(null);
  const selected = useRef<number | null>(null);

  /**
   * Tints the chip at hand and the words that go with it (the rule of
   * Values::compose()), where the browser can mark text without changing it.
   */
  /**
   * The ranges of the words that go with the chip at an index (the rule of
   * Values::compose()). Read inside the editor's state.
   */
  const $wordRanges = (at: number): Range[] => {
    const editor = editorRef.current;
    const root = element.current;
    const chips = $chips();
    const chip = chips[at];
    if (!editor || !root || !chip) {
      return [];
    }
    const ranges: Range[] = [];
    const text = (node: LexicalNode | null) => ($isTextNode(node) && !$isChip(node) ? node : null);
    const dom = (node: TextNode) => editor.getElementByKey(node.getKey())?.firstChild ?? null;
    const close = (run: string) => /^(?:\p{Pe}|[\p{Pi}\p{Pf}"'](?=$|[\s\p{P}]))/u.exec(run)?.[0].length ?? 0;
    const mark = (node: TextNode, from: number, to: number) => {
      const target = dom(node);
      if (target && to > from) {
        const range = root.ownerDocument.createRange();
        range.setStart(target, from);
        range.setEnd(target, to);
        ranges.push(range);
      }
    };
    const before = text(chip.getPreviousSibling());
    if (before) {
      const run = before.getTextContent();
      const lead = at === 0;
      // A lead-in that is a label always shows: it goes with nothing.
      if (!(lead && /[:.!?…|·•–—\-/]\s*$/u.test(run))) {
        mark(before, lead ? 0 : close(run), run.length);
      }
    }
    const after = text(chip.getNextSibling());
    if (after) {
      const run = after.getTextContent();
      if (at === chips.length - 1) {
        if (!/^[\s·•|–—\-/,;:]*$/u.test(run)) {
          mark(after, 0, run.length);
        }
      } else {
        mark(after, 0, close(run));
      }
    }
    return ranges;
  };

  /** The CSS highlights of the composer's window, where the browser has them. */
  const highlights = () => {
    const view = element.current?.ownerDocument.defaultView as (Window & { CSS: { highlights?: Map<string, unknown> }; Highlight?: new (...ranges: Range[]) => unknown }) | null;
    return view?.Highlight && view.CSS.highlights ? { set: view.CSS.highlights, Highlight: view.Highlight } : null;
  };

  const tint = () => {
    const editor = editorRef.current;
    const root = element.current;
    const at = hovered.current ?? near_.current;
    root?.querySelectorAll('.seo-field-chip:is([data-near], [data-selected])').forEach((one) => {
      one.removeAttribute('data-near');
      one.removeAttribute('data-selected');
    });
    highlights()?.set.delete('seo-chip-words');
    if (!editor || !root) {
      return;
    }
    // A chip selected whole shows a ring: what Backspace, Enter or a key acts
    // on.
    const whole = selected.current;
    if (whole !== null) {
      editor.getEditorState().read(() => {
        const chip = $chips()[whole];
        if (chip) {
          editor.getElementByKey(chip.getKey())?.setAttribute('data-selected', '');
        }
      });
    }
    if (at === null) {
      return;
    }
    let ranges: Range[] = [];
    editor.getEditorState().read(() => {
      const chip = $chips()[at];
      if (chip) {
        editor.getElementByKey(chip.getKey())?.setAttribute('data-near', '');
        ranges = $wordRanges(at);
      }
    });
    const marks = highlights();
    if (ranges.length && marks) {
      marks.set.set('seo-chip-words', new marks.Highlight(...ranges));
    }
  };

  // Chip states are drawn on their elements, never stored in the content:
  // a change of the previewed item is no edit.
  const paint = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const marks = highlights();
    editor.getEditorState().read(() => {
      const chips = $chips();
      // The words of a field that gives nothing for the item are left out
      // with it: drawn muted, as a separator left at the end is.
      const dropped: Range[] = [];
      chips.forEach((chip, at) => {
        const dom = editor.getElementByKey(chip.getKey());
        if (dom) {
          const view = latest.current.chip(chip.part(), at);
          dom.dataset.state = view.state;
          dom.title = view.title;
          if (view.state === 'empty' || view.state === 'hidden' || view.state === 'broken') {
            dropped.push(...$wordRanges(at));
          }
        }
      });
      // One highlight for the whole document: every composer's words.
      droppedWords.set(element, dropped);
      if (marks) {
        marks.set.set('seo-chip-dropped', new marks.Highlight(...[...droppedWords.values()].flat()));
      }
      // A separator after the last field never shows (Values::compose()).
      const last = chips.at(-1);
      for (const node of $getRoot().getAllTextNodes()) {
        const dom = editor.getElementByKey(node.getKey());
        if (!dom || $isChip(node)) {
          continue;
        }
        const dropped = !!last && last.isBefore(node) && /^[\s·•|–—\-/,;:]*$/u.test(node.getTextContent()) && node.getTextContent().trim() !== '';
        dom.toggleAttribute('data-dropped', dropped);
        dom.title = dropped ? 'Left out at the end' : '';
      }
    });
  };

  useLayoutEffect(() => {
    const root = element.current!;
    const editor = createEditor({
      namespace: 'seo-composer',
      nodes: [ChipNode],
      editable: !latest.current.readOnly,
      onError: (error) => {
        throw error;
      },
      theme: { paragraph: 'seo-composer-line' },
    });
    editorRef.current = editor;
    editor.setRootElement(root);
    const history = createEmptyHistoryState();

    // Where a field goes: the browser's caret as the key is pressed, which
    // the editor's may not have caught up with.
    // Called from command listeners, which run inside the editor's update.
    const capture = () => {
      const selection = $createRangeSelectionFromDom(root.ownerDocument.getSelection(), editor);
      if (selection) {
        lastSelection.current = selection.clone();
      }
    };
    filling.current = true;
    editor.update(() => $fill(known.current, label), { tag: HISTORY_MERGE_TAG, discrete: true });
    filling.current = false;
    let chips = known.current.filter((part) => !('text' in part));
    // The chip beside the caret tints its words; the one selected whole is
    // also what the result line goes without.
    const $near = () => {
      const selection = $getSelection();
      const chip = $chipAt(selection, true) ?? $chipAt(selection, false);
      near_.current = chip && $isRangeSelection(selection) && selection.isCollapsed() ? $chips().findIndex((one) => one.is(chip)) : null;
      const whole = $selectedChip();
      selected.current = whole ? $chips().findIndex((one) => one.is(whole)) : null;
    };
    const unregister = mergeRegister(
      registerPlainText(editor),
      registerHistory(editor, history, 400),
      editor.registerNodeTransform(ChipNode, $keepLabel),
      editor.registerUpdateListener(({ editorState, tags }) => {
        paint();
        // Where a field goes: the caret as of the last change, typing too.
        editorState.read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            lastSelection.current = selection.clone();
          }
          if (root.ownerDocument.activeElement === root) {
            $near();
          }
        });
        tint();
        latest.current.onNear(hovered.current ?? selected.current);
        if (filling.current) {
          known.current = editorState.read($parts);
          chips = known.current.filter((part) => !('text' in part));
          return;
        }
        const parts = editorState.read($parts);
        if (sameValue({ parts }, { parts: known.current })) {
          return;
        }
        if (sameValue(fold(parts), fold(known.current))) {
          // The same value, written another way (a space at its end): kept
          // as typed, nothing to say.
          known.current = parts;
          return;
        }
        // A chip a key took away is said; one the menu took is said there;
        // undo and redo say what they bring back or take.
        const now = parts.filter((part) => !('text' in part));
        const missing = (from: Part[], to: Part[]) => from.find((part, at) => !to.some((one, at2) => at2 === at && sameValue(one as never, part as never)));
        if (tags.has('historic') && now.length !== chips.length) {
          const added = now.length > chips.length;
          const part = added ? missing(now, chips) : missing(chips, now);
          if (part) {
            latest.current.onUndone(part, added);
          }
        } else if (now.length < chips.length && !tags.has('seo-menu')) {
          const gone = missing(chips, now);
          if (gone) {
            latest.current.onRemoved(gone);
          }
        }
        chips = now;
        known.current = parts;
        latest.current.onChange(parts);
      }),
      // Typed and pasted text never breaks a line.
      editor.registerCommand(INSERT_LINE_BREAK_COMMAND, () => true, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(INSERT_PARAGRAPH_COMMAND, () => true, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_ENTER_COMMAND, (event) => {
        event?.preventDefault();
        capture();
        const chip = $selectedChip();
        if (chip) {
          const at = $chips().findIndex((one) => one.is(chip));
          latest.current.onReplace(at, root);
        } else if (!latest.current.readOnly) {
          latest.current.onAdd(root);
        }
        return true;
      }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_DOWN_COMMAND, (event) => {
        // `{` opens the menu at the caret, never types, whatever keys a
        // layout needs for it (Shift, Option, AltGr).
        if (braceKey(event) && !latest.current.readOnly) {
          event.preventDefault();
          capture();
          latest.current.onAdd(root);
          return true;
        }
        // Home and End go to the start and the end of the one line, beside a
        // chip there, in every engine: one engine keeps a chip selected.
        if ((event.key === 'Home' || event.key === 'End') && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const block = $getRoot().getFirstChild();
          if ($isElementNode(block)) {
            const at = event.key === 'End' ? block.getChildrenSize() : 0;
            const edge = event.key === 'End' ? block.getLastChild() : block.getFirstChild();
            if ($isTextNode(edge) && !$isChip(edge)) {
              const offset = event.key === 'End' ? edge.getTextContentSize() : 0;
              edge.select(offset, offset);
            } else {
              const range = $createRangeSelection();
              range.anchor.set(block.getKey(), at, 'element');
              range.focus.set(block.getKey(), at, 'element');
              $setSelection(range);
            }
          }
          return true;
        }
        return false;
      }, COMMAND_PRIORITY_HIGH),
      editor.registerCommand(KEY_ARROW_DOWN_COMMAND, (event) => {
        if (event?.altKey) {
          event.preventDefault();
          capture();
          latest.current.onAdd(root);
          return true;
        }
        return false;
      }, COMMAND_PRIORITY_HIGH),
      // A chip is stepped over in one press, and selected whole with Shift.
      ...([[KEY_ARROW_RIGHT_COMMAND, true], [KEY_ARROW_LEFT_COMMAND, false]] as const).map(([command, forward]) =>
        editor.registerCommand(command, (event) => {
          if (event?.altKey || event?.ctrlKey || event?.metaKey) {
            return false;
          }
          // Command listeners run inside the editor's update: the move is
          // made now, and the browser's own is prevented.
          // The browser's selection: the editor's may not have caught up
          // with keys pressed in quick succession.
          const selection = $createRangeSelectionFromDom(root.ownerDocument.getSelection(), editor) ?? $getSelection();
          if (!event?.shiftKey && $isRangeSelection(selection) && !selection.isCollapsed()) {
            return false;
          }
          const chip = $chipAt(selection, forward);
          if (!chip) {
            return false;
          }
          $over(chip, forward, !!event?.shiftKey, selection);
          event?.preventDefault();
          return true;
        }, COMMAND_PRIORITY_HIGH),
      ),
      // Backspace or Delete beside a chip removes it whole, in every engine.
      ...([[KEY_BACKSPACE_COMMAND, false], [KEY_DELETE_COMMAND, true]] as const).map(([command, forward]) =>
        editor.registerCommand(command, (event) => {
          if (latest.current.readOnly) {
            return false;
          }
          const selection = $createRangeSelectionFromDom(root.ownerDocument.getSelection(), editor) ?? $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            return false;
          }
          const chip = $chipAt(selection, forward);
          if (!chip) {
            return false;
          }
          event?.preventDefault();
          const neighbour = forward ? chip.getNextSibling() : chip.getPreviousSibling();
          const parent = chip.getParentOrThrow();
          const index = chip.getIndexWithinParent();
          chip.remove();
          if ($isTextNode(neighbour) && !$isChip(neighbour)) {
            const at = forward ? 0 : neighbour.getTextContentSize();
            neighbour.select(at, at);
          } else {
            const range = $createRangeSelection();
            range.anchor.set(parent.getKey(), index, 'element');
            range.focus.set(parent.getKey(), index, 'element');
            $setSelection(range);
          }
          return true;
        }, COMMAND_PRIORITY_HIGH),
      ),
      // A selection never ends inside a chip.
      // Command listeners run inside the update that made the selection: it
      // is read and set here, never from the last committed state.
      editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          for (const point of [selection.anchor, selection.focus]) {
            const node = point.getNode();
            if ($isChip(node) && point.offset > 0 && point.offset < node.getTextContentSize()) {
              const parent = node.getParentOrThrow();
              point.set(parent.getKey(), node.getIndexWithinParent() + (point.offset * 2 >= node.getTextContentSize() ? 1 : 0), 'element');
            }
          }
          lastSelection.current = selection.clone();
        }
        $near();
        return false;
      }, COMMAND_PRIORITY_HIGH),
      // Copy keeps the parts for another composer of the dialog; the plain
      // text is what the selection reads as for the item.
      ...[COPY_COMMAND, CUT_COMMAND].map((command) =>
        editor.registerCommand(command, (event) => {
          const data = event instanceof ClipboardEvent ? event.clipboardData : null;
          // The browser's selection: one engine has not told the editor yet.
          const dom = $createRangeSelectionFromDom(root.ownerDocument.getSelection(), editor);
          if (dom) {
            $setSelection(dom);
          }
          const parts = $selected();
          if (!data || !parts.length) {
            return false;
          }
          event!.preventDefault();
          data.setData(CLIPBOARD, JSON.stringify({ parts, labels: parts.map((part) => ('text' in part ? '' : label(part))) }));
          data.setData('text/plain', latest.current.plain(parts));
          if (command === CUT_COMMAND && !latest.current.readOnly) {
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                selection.removeText();
              }
            });
          }
          return true;
        }, COMMAND_PRIORITY_HIGH),
      ),
      // Paste is plain text with its braces; the dialog's own parts keep the
      // fields this place can take.
      editor.registerCommand(PASTE_COMMAND, (event) => {
        const data = event instanceof ClipboardEvent ? event.clipboardData : null;
        if (!data || latest.current.readOnly) {
          return false;
        }
        event!.preventDefault();
        let copied: unknown = null;
        try {
          copied = JSON.parse(data.getData(CLIPBOARD) || 'null');
        } catch {
          copied = null;
        }
        const raw: unknown[] = Array.isArray((copied as { parts?: unknown } | null)?.parts) ? (copied as { parts: unknown[] }).parts : [];
        const labels: unknown[] = Array.isArray((copied as { labels?: unknown } | null)?.labels) ? (copied as { labels: unknown[] }).labels : [];
        const parts: (Part | null)[] = raw.length ? raw.map((part) => (latest.current.accepts(part) ? part : null)) : [{ text: data.getData('text/plain') }];
        // At most the fields there is room for; the rest are left out. The
        // fields of a selection the paste replaces make room.
        let room = latest.current.max - editor.getEditorState().read(() => $chips().length - fieldsIn($selected()).length);
        parts.forEach((part, at) => {
          if (part && !('text' in part) && room-- <= 0) {
            parts[at] = null;
          }
        });
        const left = parts.flatMap((part, at) => (part ? [] : [typeof labels[at] === 'string' && labels[at] ? (labels[at] as string) : 'A field']));
        const kept = withoutWords(parts);
        editor.update(() => {
          $beside();
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !kept.length) {
            return;
          }
          const nodes = kept.map((part) => ('text' in part ? $createTextNode(part.text.replace(/\s*[\r\n]+\s*/g, ' ')) : $chip(part, label(part))));
          selection.insertNodes(nodes);
          // The caret after what was pasted, for the next key.
          const last = nodes.at(-1)!;
          if ($isChip(last)) {
            $over(last, true, false);
          } else {
            last.select(last.getTextContentSize(), last.getTextContentSize());
          }
        }, { tag: 'history-push' });
        if (left.length) {
          latest.current.onLeftOut(left);
        }
        return true;
      }, COMMAND_PRIORITY_HIGH),
    );
    const beforeInput = (event: InputEvent) => {
      if (event.inputType === 'insertText' && event.data === '{' && !latest.current.readOnly) {
        event.preventDefault();
        editor.update(capture, { discrete: true });
        latest.current.onAdd(root);
      }
    };
    // Before the editor's own listener, which may insert the brace first.
    root.addEventListener('beforeinput', beforeInput, true);
    // Hovering a chip shows its words too; leaving, the caret's chip again.
    const over = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest('.seo-field-chip');
      // Chips are in the content's order, one element each.
      const at = target ? [...root.querySelectorAll('.seo-field-chip')].indexOf(target) : null;
      if (at !== hovered.current) {
        hovered.current = at;
        tint();
        latest.current.onNear(at ?? selected.current);
      }
    };
    root.addEventListener('mouseover', over);
    root.addEventListener('mouseleave', over);
    const click = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest('.seo-field-chip');
      if (!target) {
        return;
      }
      const at = [...root.querySelectorAll('.seo-field-chip')].indexOf(target);
      if (at >= 0) {
        event.preventDefault();
        // Selected whole, as by keyboard: its ring shows while its menu is
        // open, and Escape comes back to it.
        editor.update(() => {
          const chip = $chips()[at];
          chip?.select(0, chip.getTextContentSize());
          lastSelection.current = $getSelection()?.clone() ?? null;
        }, { discrete: true });
        latest.current.onReplace(at, target as HTMLElement);
      }
    };
    root.addEventListener('click', click);
    paint();
    if (latest.current.autoFocus) {
      root.focus();
      editor.update(() => $getRoot().selectEnd(), { discrete: true });
    }
    return () => {
      droppedWords.delete(element);
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseleave', over);
      root.removeEventListener('click', click);
      root.removeEventListener('beforeinput', beforeInput, true);
      unregister();
      editor.setRootElement(null);
      editorRef.current = null;
    };
  }, []);

  // A value from outside (Undo in the bar, Reset, a fix from Checks, a
  // refusal) replaces the content and its history.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || sameValue(fold(props.parts), fold(known.current))) {
      paint();
      return;
    }
    known.current = props.parts;
    filling.current = true;
    // With focus (Undo in the bar gives it back), the caret at the end: the
    // next key goes after the value, never before it.
    const focused = element.current?.ownerDocument.activeElement === element.current;
    editor.update(() => {
      $fill(props.parts, label);
      if (focused) {
        $getRoot().selectEnd();
      }
    }, { tag: HISTORY_MERGE_TAG, discrete: true });
    filling.current = false;
    editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
  });

  useEffect(() => {
    editorRef.current?.setEditable(!props.readOnly);
  }, [props.readOnly]);

  /**
   * Focus has gone elsewhere: no chip at hand, and no selection left painted
   * where the browser would put inserted text (an input method, dictation).
   */
  const leave = () => {
    near_.current = null;
    hovered.current = null;
    selected.current = null;
    tint();
    latest.current.onNear(null);
    const root = element.current;
    const selection = root?.ownerDocument.getSelection();
    if (root && selection?.anchorNode && root.contains(selection.anchorNode) && root.ownerDocument.activeElement !== root) {
      selection.removeAllRanges();
    }
  };
  // Its menu closed with focus elsewhere: the chip's ring goes too.
  useEffect(() => {
    if (!props.keepCaret && element.current && element.current.ownerDocument.activeElement !== element.current) {
      leave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.keepCaret]);

  const restoreCaret = () => {
    editorRef.current?.update(() => {
      const saved = lastSelection.current;
      if (saved && $isRangeSelection(saved) && saved.anchor.getNode().isAttached()) {
        $setSelection(saved.clone());
      } else {
        $getRoot().selectEnd();
      }
    }, { discrete: true });
  };

  const focusEnd = () => {
    const editor = editorRef.current;
    quietFocus();
    editor?.update(() => {
      $getRoot().selectEnd();
    }, { discrete: true });
  };

  useImperativeHandle(ref, () => ({
    insert(part) {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      quietFocus();
      editor.update(() => {
        const saved = lastSelection.current;
        const selection = saved && $isRangeSelection(saved) && saved.anchor.getNode().isAttached() ? saved.clone() : null;
        if (selection) {
          $setSelection(selection);
        } else {
          $getRoot().selectEnd();
        }
        $beside();
        const current = $getSelection();
        if ($isRangeSelection(current)) {
          const chip = $chip(part, label(part));
          // Right after another field, a space between them: two values
          // never run together. Typed text can take its place.
          current.insertNodes($chipAt(current, false) ? [$createTextNode(' '), chip] : [chip]);
          $over(chip, true, false);
        }
      }, { discrete: true, tag: 'seo-menu' });
    },
    replace(field, part) {
      const editor = editorRef.current;
      quietFocus();
      editor?.update(() => {
        const chip = $chips()[field];
        if (chip) {
          const next = $chip(part, label(part));
          chip.replace(next);
          $over(next, true, false);
        }
      }, { discrete: true, tag: 'seo-menu' });
    },
    remove(field) {
      const editor = editorRef.current;
      quietFocus();
      editor?.update(() => {
        const chip = $chips()[field];
        if (chip) {
          const previous = chip.getPreviousSibling();
          chip.remove();
          if ($isTextNode(previous)) {
            previous.select(previous.getTextContentSize(), previous.getTextContentSize());
          }
        }
      }, { discrete: true, tag: 'seo-menu' });
    },
    focusEnd,
    restore() {
      quietFocus();
      restoreCaret();
    },
    select(field) {
      const editor = editorRef.current;
      quietFocus();
      editor?.update(() => {
        const chip = $chips()[field];
        chip?.select(0, chip.getTextContentSize());
      }, { discrete: true });
    },
    brace() {
      const editor = editorRef.current;
      quietFocus();
      editor?.update(() => {
        const saved = lastSelection.current;
        if (saved && $isRangeSelection(saved) && saved.anchor.getNode().isAttached()) {
          $setSelection(saved.clone());
        }
        $beside();
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText('{');
        }
      }, { discrete: true });
    },
    before() {
      const editor = editorRef.current;
      if (!editor) {
        return [];
      }
      return editor.getEditorState().read(() => {
        const saved = lastSelection.current;
        const point = saved && $isRangeSelection(saved) && saved.anchor.getNode().isAttached() ? saved.anchor : null;
        const parts: Part[] = [];
        for (const block of $getRoot().getChildren()) {
          for (const [at, node] of ($isElementNode(block) ? block.getChildren() : []).entries()) {
            if (point?.type === 'element' && point.key === block.getKey() && at >= point.offset) {
              return parts;
            }
            if ($isChip(node)) {
              // A caret on a chip is beside it: before at its start, after
              // past its middle.
              const here = point?.key === node.getKey();
              if (here && point.offset * 2 < node.getTextContentSize()) {
                return parts;
              }
              parts.push(node.part());
              if (here) {
                return parts;
              }
            } else if ($isTextNode(node)) {
              const here = point?.type === 'text' && point.key === node.getKey();
              parts.push({ text: here ? node.getTextContent().slice(0, point.offset) : node.getTextContent() });
              if (here) {
                return parts;
              }
            }
          }
        }
        return parts;
      });
    },
    root: () => element.current,
  }));

  return (
    <div
      ref={element}
      id={props.id}
      className="seo-composer"
      role="textbox"
      contentEditable={!props.readOnly}
      suppressContentEditableWarning
      aria-labelledby={props.labelId}
      aria-describedby={props.describedBy}
      aria-readonly={props.readOnly || undefined}
      aria-invalid={props.invalid || undefined}
      aria-haspopup="dialog"
      aria-keyshortcuts="Alt+ArrowDown"
      aria-placeholder={props.placeholder}
      data-placeholder={props.placeholder}
      tabIndex={0}
      lang={props.lang}
      dir="auto"
      spellCheck
      translate="no"
      onKeyDown={(event) => {
        // Read-only, the editor takes no keys: Enter and Alt+Down still open
        // the menu to look at, every entry disabled; on a chip, its own.
        if (!props.readOnly || !(event.key === 'Enter' || (event.altKey && event.key === 'ArrowDown'))) {
          return;
        }
        event.preventDefault();
        const root = event.currentTarget;
        const node = root.ownerDocument.getSelection()?.anchorNode ?? null;
        const chip = (node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null))?.closest<HTMLElement>('.seo-field-chip');
        const at = chip && root.contains(chip) ? [...root.querySelectorAll('.seo-field-chip')].indexOf(chip) : -1;
        if (chip && at >= 0) {
          latest.current.onReplace(at, chip);
        } else {
          latest.current.onAdd(root);
        }
      }}
      onFocus={(event) => {
        // Tab, a click on the preview or a jump: the caret at the end. A
        // click puts it where it lands.
        if (quiet.current || event.target !== element.current) {
          // The dialog put the caret itself.
        } else if (latest.current.keepCaret) {
          restoreCaret();
        } else if (!element.current?.matches(':active')) {
          focusEnd();
          // A script's focus() (the bar's Undo giving focus back) puts the
          // browser's caret at the start once the event is done: at the end
          // again, before the next key.
          queueMicrotask(() => {
            const root = element.current;
            if (root && root.ownerDocument.activeElement === root && root.ownerDocument.getSelection()?.anchorNode === root) {
              focusEnd();
            }
          });
        }
        props.onFocus?.();
      }}
      onBlur={(event) => {
        // Its own menu open: the chip it acts on keeps its ring.
        if (!latest.current.keepCaret) {
          leave();
        }
        props.onBlur?.(event);
      }}
    />
  );
});
