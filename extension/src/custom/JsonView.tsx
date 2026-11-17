/**
 * The JSON tab: the stored text, byte for byte, in a native text box.
 *
 * No code-editor library: Tab leaves the box. A mirror behind it paints the
 * line numbers and marks the lines with a problem; it is hidden from
 * assistive technology, which reads the problems below. The line under the
 * box says what the value under the caret is and expects.
 */
import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { Btn } from '../components/ui';
import { CopyButton } from '../components/Output';
import type { SearchFeatures } from '../types';
import { format, lineOf, offsetOfLine, pathAt, shownPath, type Problem } from './doc';
import { describeExpects, linkOf } from './Row';
import { detailLabel, expectsOf, typesOf } from './project';
import { CUSTOM_MAX } from './validate';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The line under the box: "Line 6 · ratingValue · Rating value: a number,
 * like 4.2", and the name of "Edit in form" ("Edit in form: Rating value,
 * line 6"). A linked value says what it is linked to and its value.
 */
export function caretWords(text: string, offset: number, data: unknown, rules: SearchFeatures, linked?: (name: string) => { label: string; value: string } | undefined): { line: string; place: string; edit: string | null } {
  const path = text.trim() ? pathAt(text, offset) : [];
  const key = [...path].reverse().find((part): part is string => typeof part === 'string');
  const item = Array.isArray(data) ? data[typeof path[0] === 'number' ? path[0] : 0] : data;
  const line = lineOf(text, offset);
  const place = `Line ${line}${shownPath(path) ? ` · ${shownPath(path)}` : ''}`;
  if (!key) return { line: place, place, edit: null };
  let value: unknown = data;
  for (const part of path) value = value !== null && typeof value === 'object' ? (value as Record<string | number, unknown>)[part] : undefined;
  const field = linkOf(value);
  const link = field ? linked?.(field) : undefined;
  const label = detailLabel(key, rules);
  const words = field ? `linked to ${link?.label ?? field}${link ? ` (${link.value || 'empty here'})` : ''}` : describeExpects(expectsOf(key, typesOf(item), rules));
  return { line: `${place} · ${label}${words ? `: ${words}` : ''}`, place, edit: `Edit in form: ${label}, line ${line}` };
}

export interface JsonViewProps {
  text: string;
  /** The text's items, when it reads; the last count that read otherwise. */
  data: unknown;
  /** Items in the last text that read. */
  count: number;
  problems: Problem[];
  rules: SearchFeatures;
  size: number;
  readonly: boolean;
  /** The place to show, when switching from Form: a new `n` asks again. */
  place: { offset: number; n: number } | null;
  /** Added details: one node, not items. */
  node?: boolean;
  /** The empty box's example for added details: '{"sku": "…"}'. */
  example?: string;
  /** What a linked value is linked to, at template scope. */
  linked?(name: string): { label: string; value: string } | undefined;
  onChange(text: string): void;
  onCommit(): void;
  /** Format: saved with Undo when the text saves, else kept as typed text. */
  onFormat(text: string): void;
  /** A paste the box should clean up: returns true when it did. */
  onPaste(paste: string, whole: boolean): boolean;
  onEditInForm(offset: number): void;
  /** Where the caret is, for the switch to Form. */
  onCaret(offset: number): void;
  /** Ctrl/Cmd+Z right after a change the dialog made. */
  onUndo(): boolean;
}

export function JsonView(props: JsonViewProps) {
  const box = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const [caret, setCaretState] = useState(0);
  const setCaret = (offset: number) => {
    setCaretState(offset);
    props.onCaret(offset);
  };
  const id = useId();
  const lines = props.text.split('\n').length;
  const red = props.problems.filter((one) => one.tone === 'red');
  const marked = new Map(props.problems.map((one) => [one.line, one.tone] as const));

  useLayoutEffect(() => {
    if (props.place !== null && box.current) {
      box.current.focus();
      box.current.setSelectionRange(props.place.offset, props.place.offset);
      const line = lineOf(props.text, props.place.offset);
      box.current.scrollTop = Math.max(0, (line - 4) * 18);
      setCaret(props.place.offset);
    }
    // Only when a place is asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.place]);

  const words = props.text.trim() !== '' ? caretWords(props.text, caret, props.data, props.rules, props.linked) : null;
  const describedBy = `${id}-status ${red.length ? `${id}-problems` : ''}`.trim();
  const save = `Saves when you leave the box (${MAC ? '⌘' : 'Ctrl'}+Enter)`;
  const noun = props.node ? '' : `${props.count} ${props.count === 1 ? 'item' : 'items'} · `;
  // The size only near the cap.
  const size = props.size > CUSTOM_MAX * 0.8 ? `${(props.size / 1024).toFixed(1)} KB of ${CUSTOM_MAX / 1024} KB · ` : '';
  // The form can't read text that is not JSON; other problems only block the save.
  const unreadable = props.text.trim() !== '' && props.data === undefined;
  const firstRed = red[0];

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = MAC ? event.metaKey : event.ctrlKey;
    if (mod && event.key === 'Enter') {
      event.preventDefault();
      props.onCommit();
      return;
    }
    if (mod && !event.shiftKey && event.key.toLowerCase() === 'z' && props.onUndo()) {
      event.preventDefault();
      return;
    }
    // Enter keeps the indent of the line before.
    if (event.key === 'Enter' && !event.shiftKey && !mod) {
      const area = event.currentTarget;
      const start = area.selectionStart;
      const before = area.value.slice(0, start);
      const indent = /(^|\n)([ \t]*)[^\n]*$/.exec(before)?.[2] ?? '';
      if (indent) {
        event.preventDefault();
        const next = `${before}\n${indent}${area.value.slice(area.selectionEnd)}`;
        props.onChange(next);
        requestAnimationFrame(() => box.current?.setSelectionRange(start + 1 + indent.length, start + 1 + indent.length));
      }
    }
  };

  return (
    <div className="seo-jsonview">
      <div className="seo-jsonview-tools">
        <span className="seo-meta">{unreadable && firstRed ? `The form can't read this until line ${firstRed.line} is fixed.` : ''}</span>
        {!props.readonly && (
          <Btn variant="ghost" size={24} onClick={() => props.onFormat(format(props.text))} disabled={!props.text.trim() || red.some((one) => !one.message.includes('·'))}>
            Format
          </Btn>
        )}
        <CopyButton text={props.text} label="Copy" hint="Copies what you wrote. Output has it filled in for this page." />
      </div>
      <div className="seo-jsonbox" data-invalid={red.length ? '' : undefined}>
        <div className="seo-jsonbox-gutter" aria-hidden ref={mirror}>
          {Array.from({ length: lines }, (_, index) => (
            <span key={index} data-tone={marked.get(index + 1)}>
              {index + 1}
            </span>
          ))}
        </div>
        <textarea
          ref={box}
          className="seo-jsonbox-text"
          aria-label="JSON-LD"
          aria-invalid={red.length ? true : undefined}
          aria-describedby={describedBy}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          readOnly={props.readonly}
          placeholder={props.node ? `Paste the details to add, like ${props.example ?? '{"description": "…"}'}` : 'Paste JSON-LD here. A whole script tag, several items or an @graph are fine.'}
          value={props.text}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onCommit}
          onKeyDown={keyDown}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onScroll={(event) => {
            if (mirror.current) mirror.current.scrollTop = event.currentTarget.scrollTop;
          }}
          onPaste={(event) => {
            const paste = event.clipboardData.getData('text/plain');
            const area = event.currentTarget;
            const whole = area.value.trim() === '' || (area.selectionStart === 0 && area.selectionEnd === area.value.length);
            if ((whole || /<script/i.test(paste)) && props.onPaste(paste, whole)) {
              event.preventDefault();
            }
          }}
        />
      </div>
      {words && !red.length && (
        <div className="seo-caretline">
          <span className="seo-caretline-text">
            <code>{words.place}</code>
            {words.line.slice(words.place.length)}
          </span>
          {words.edit && (
            <Btn variant="ghost" size={24} aria-label={words.edit} onClick={() => props.onEditInForm(caret)}>
              Edit in form
            </Btn>
          )}
        </div>
      )}
      <p className="seo-meta" id={`${id}-status`} role="status">
        {red.length ? 'Not saved.' : `${props.text.trim() ? noun : ''}${size}${save}`}
      </p>
      <ProblemList id={`${id}-problems`} problems={props.problems} text={props.text} readonly={props.readonly} caretLine={props.text.trim() ? lineOf(props.text, caret) : undefined} onFix={(next) => {
        // The fix's button goes: the box takes focus.
        props.onChange(next);
        requestAnimationFrame(() => box.current?.focus());
      }} onGo={(line) => {
        const offset = offsetOfLine(props.text, line);
        box.current?.focus();
        box.current?.setSelectionRange(offset, offset);
        setCaret(offset);
      }} />
    </div>
  );
}

/**
 * At most three problems, then "and ‹n› more"; each with one fix and Go to
 * line (hidden on the caret's line). `form`: in the form's words, with Show
 * in JSON, for a problem no row shows.
 */
export function ProblemList(props: { id?: string; problems: Problem[]; text: string; readonly: boolean; form?: boolean; caretLine?: number; onFix(text: string): void; onGo?(line: number): void; onShow?(problem: Problem): void }) {
  const [all, setAll] = useState(false);
  // One line per problem: the same words on the same line once.
  const problems = props.problems.filter((one, index, list) => list.findIndex((other) => other.line === one.line && other.message === one.message) === index);
  if (!problems.length) return null;
  const shown = all ? problems : problems.slice(0, 3);
  return (
    <ul className="seo-problems" id={props.id}>
      {shown.map((problem, index) => (
        <li key={index} data-tone={problem.tone}>
          <span className="seo-problem-mark" aria-hidden>
            {problem.tone === 'red' ? '■' : '▲'}
          </span>
          <span className="seo-problem-text">
            <span className="seo-visually-hidden">{problem.tone === 'red' ? 'Problem: ' : 'Advice: '}</span>
            <bdi>{props.form ? (problem.words ?? problem.message) : problem.message}</bdi>
          </span>
          <span className="seo-problem-actions">
            {problem.fix && !props.readonly && (
              <Btn variant="soft" size={24} onClick={() => props.onFix(problem.fix!.apply(props.text))}>
                {problem.fix.label}
              </Btn>
            )}
            {props.onGo && problem.line !== props.caretLine && (
              <Btn variant="ghost" size={24} onClick={() => props.onGo!(problem.line)}>
                Go to line {problem.line}
              </Btn>
            )}
            {props.onShow && (
              <Btn variant="ghost" size={24} onClick={() => props.onShow!(problem)}>
                Show in JSON
              </Btn>
            )}
          </span>
        </li>
      ))}
      {problems.length > 3 && !all && (
        <li className="seo-problems-more">
          <Btn variant="ghost" size={24} onClick={() => setAll(true)}>
            and {problems.length - 3} more
          </Btn>
        </li>
      )}
    </ul>
  );
}
