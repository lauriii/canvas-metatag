import {
  CrossCircledIcon,
  ExclamationTriangleIcon,
  ResetIcon,
} from '@radix-ui/react-icons';
import { Tooltip } from '@radix-ui/themes';
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useApp } from '../App';
import { AI_SENDS, type Meter, source as sourceOf } from '../model';
import type { Issue, Scope } from '../types';
import { Btn, SparkleIcon, reveal } from './ui';

/** The disclosure a field sits in: a jump opens it first. */
export const DisclosureContext = createContext<{ open(): void } | null>(null);

/** What the bar says after a one-click fix, by the fix's label. */
const DONE: Record<string, string> = {
  'Remove the repeat': 'Repeat removed',
  'Show in search results': 'Shown in search results',
  'Allow text previews': 'Text previews allowed',
  'Allow large previews': 'Large previews allowed',
};
export const fixedText = (label: string) => DONE[label] ?? 'Fixed';

export interface FieldOptions {
  scope: Scope;
  /** The dotted path within the scope: errors, reset and jumps use it. */
  path: string;
  label: string;
  /** Other paths this control also stores (their errors and jumps land here). */
  also?: string[];
  /** The source word when no layer supplies a value: "Same as search title". */
  fallback?: string;
  /** Replaces the computed source word. */
  source?: ReactNode;
  /** What Reset returns to, for its tooltip: "Back to …". */
  resetTip?: string;
  /** What Reset clears, when not the field: "title ending". */
  resetWhat?: string;
  /** Replaces the plain reset of `path`. */
  onReset?(): void;
  /** A message of the dialog's own, shown like the server's. */
  error?: string;
  /** The aside's action while nothing is set: "Use the site pattern". */
  action?: ReactNode;
  /** No Reset in the aside: the control has its own way back (a box's ×). */
  noReset?: boolean;
}

export interface FieldParts {
  /** Give it to the control. */
  id: string;
  labelId: string;
  asideId: string;
  invalid: boolean;
  disabled: boolean;
  /** A value is stored at this scope. */
  set: boolean;
  /** Source word and one action; null when there is nothing to say. */
  aside: ReactNode;
  /** The aside stays visible: an Undo is on offer. */
  pinned: boolean;
  message: string | undefined;
  focused: boolean;
  /** On the field's outer element. */
  ref: React.RefObject<HTMLDivElement>;
  onFocus(): void;
  onBlur(event: FocusEvent<HTMLElement>): void;
}

/** Everything a field knows about itself: its source, its error, its jump target. */
export function useField(options: FieldOptions): FieldParts {
  const { scope, path, label } = options;
  const { state, dispatch, view, locked, jump, goTo, setFocusField } =
    useApp();
  const server = state.server!;
  const target = server.target;
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const disclosure = useContext(DisclosureContext);
  const paths = [path, ...(options.also ?? [])];
  const [focused, setFocused] = useState(false);

  // A jump: open the disclosure, scroll, focus, wash, say so.
  const handled = useRef(jump?.seq ?? 0);
  useEffect(() => {
    if (
      !jump ||
      jump.seq === handled.current ||
      jump.scope !== scope ||
      !paths.some(
        (own) => jump.field === own || jump.field.startsWith(`${own}.`),
      )
    ) {
      return;
    }
    handled.current = jump.seq;
    disclosure?.open();
    dispatch({ type: 'flash', flash: `Moved to ${label}` });
    let wash: ReturnType<typeof setTimeout>;
    // After the tab and the disclosure have been shown.
    const frame = requestAnimationFrame(() => {
      const root = ref.current;
      if (!root) {
        return;
      }
      root.closest('.seo-disclosure-body')?.removeAttribute('data-closed');
      reveal(root, 'center');
      // The input itself; the label only where there is none.
      (
        document.getElementById(id) ??
        root.querySelector<HTMLElement>('[data-focus]') ??
        document.getElementById(`${id}-label`)
      )?.focus({ preventScroll: true });
      root.dataset.wash = '';
      wash = setTimeout(() => delete root.dataset.wash, 1500);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(wash);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.seq]);

  const message =
    options.error ??
    Object.entries(state.errors[scope]).find(([key]) =>
      paths.some((own) => key === own || key.startsWith(`${own}.`)),
    )?.[1];

  const page = target?.scope === 'page';
  const from = scope === 'target' && view ? paths.map(view.source) : [];
  const set = from.includes('target');
  // What a reset returns to.
  const below =
    scope === 'target' && target
      ? sourceOf(path, {
          target: {},
          from_default: target.from_default,
          site: server.site.values,
        })
      : 'fallback';
  const language =
    server.languages[target?.default_langcode ?? ''] ?? 'default-language';
  const disabled = locked[scope];
  // Reset and its Undo remove the button that was pressed: focus stays in the field.
  const stayOnField = () =>
    requestAnimationFrame(() =>
      (
        document.getElementById(id) ??
        ref.current?.querySelector<HTMLElement>('[data-focus]') ??
        document.getElementById(`${id}-label`)
      )?.focus({ preventScroll: true }),
    );
  const justReset =
    state.undo?.text === 'Reset' &&
    state.undo.path !== undefined &&
    paths.includes(state.undo.path);
  // "Reset · Undo" stays in sight for 6 s.
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!justReset) {
      setPinned(false);
      return;
    }
    setPinned(true);
    const timer = setTimeout(() => setPinned(false), 6000);
    return () => clearTimeout(timer);
  }, [justReset]);

  const shown = set ? 'target' : from.find((one) => one !== 'fallback');
  let word: ReactNode = options.source;
  if (word === undefined && scope === 'target' && target) {
    word =
      shown === 'target'
        ? page
          ? 'Set on this page'
          : `Set for every ${target.label}`
        : shown === 'default'
          ? `From the ${language} version`
          : shown === 'site'
            ? 'Site default'
            : options.fallback;
  }

  let action: ReactNode = null;
  if (justReset) {
    // Where the value now comes from, beside its Undo.
    word = word ? <>Reset · {word} ·</> : 'Reset ·';
    action = (
      <Btn
        variant="ghost"
        size={24}
        accent
        onClick={() => {
          dispatch({ type: 'undo' });
          stayOnField();
        }}
      >
        Undo
      </Btn>
    );
  } else if (set && !disabled && !options.noReset) {
    const back =
      options.resetTip ??
      (below === 'site'
        ? 'the site default'
        : below === 'default'
          ? `the ${language} version`
          : 'the default');
    action = (
      <Tooltip content={`Back to ${back}`}>
        <Btn
          variant="ghost"
          size={24}
          aria-label={`Reset ${options.resetWhat ?? label}`}
          onClick={() => {
            if (options.onReset) {
              options.onReset();
            } else {
              dispatch({ type: 'reset', scope, path });
            }
            stayOnField();
          }}
        >
          <ResetIcon aria-hidden width="12" height="12" />
          Reset
        </Btn>
      </Tooltip>
    );
  } else if (set) {
    action = null;
  } else if (shown === 'site' && server.can.site && !disabled) {
    action = (
      <Btn
        variant="ghost"
        size={24}
        aria-label={`Edit the site default for ${label}`}
        onClick={() =>
          // The part that comes from the site: the title's ending.
          goTo({
            scope: 'site',
            tab: 'defaults',
            field: `values.${paths[from.indexOf('site')] ?? path}`,
          })
        }
      >
        Edit
      </Btn>
    );
  } else if (!disabled) {
    action = options.action ?? null;
  }

  return {
    id,
    labelId: `${id}-label`,
    asideId: `${id}-aside`,
    invalid: message !== undefined,
    disabled,
    set,
    aside:
      word || action ? (
        <>
          {word && <span>{word}</span>}
          {action}
        </>
      ) : null,
    pinned,
    message,
    focused,
    ref,
    onFocus() {
      setFocused(true);
      setFocusField(path);
    },
    onBlur(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setFocused(false);
        setFocusField((current) => (current === path ? null : current));
      }
    },
  };
}

/** The issue a field shows under itself: the first one to fix or improve that is about it. */
function useIssue(scope: Scope, path: string): Issue | undefined {
  const { issues } = useApp();
  return scope === 'target'
    ? issues.find(
        (issue) =>
          issue.severity !== 'info' &&
          issue.jump?.scope === 'target' &&
          issue.jump.field === path &&
          !issue.id.startsWith('schema-required:') &&
          // A link says what it gives under its own field.
          !issue.id.startsWith('link-'),
      )
    : undefined;
}

/** One line under a control: guidance, an issue or an error. */
export function Guide(props: {
  id?: string;
  tone?: 'improve' | 'fix' | 'error';
  role?: 'alert';
  children: ReactNode;
  count?: ReactNode;
}) {
  return (
    <div
      className="seo-guide"
      data-tone={props.tone}
      id={props.id}
      role={props.role}
    >
      {props.tone === 'error' || props.tone === 'fix' ? (
        <CrossCircledIcon aria-hidden />
      ) : props.tone === 'improve' ? (
        <ExclamationTriangleIcon aria-hidden />
      ) : null}
      <span className="seo-guide-text">{props.children}</span>
      {props.count !== undefined && (
        <span className="seo-guide-count">{props.count}</span>
      )}
    </div>
  );
}

/** The one-click fix of an issue, or its suggestion, as a button beside its sentence. */
export function IssueFix(props: {
  issue: Issue;
  /** The field, lower case: "Suggest a description". */
  label: string;
  onSuggest?(): void;
}) {
  const { state, dispatch, locked } = useApp();
  const { fix } = props.issue;
  if (!fix || locked.target) {
    return null;
  }
  if ('apply' in fix) {
    return (
      <Btn
        variant="ghost"
        size={24}
        onClick={() =>
          dispatch({
            type: 'apply',
            scope: 'target',
            values: fix.apply(state.edits.target),
            undo: fixedText(fix.label),
          })
        }
      >
        {fix.label}
      </Btn>
    );
  }
  return props.onSuggest ? (
    <Btn
      variant="ghost"
      size={24}
      aria-label={`Suggest a ${props.label}`}
      aria-description={AI_SENDS}
      onClick={props.onSuggest}
    >
      <SparkleIcon width="12" height="12" />
      Suggest
    </Btn>
  ) : null;
}

/**
 * Label row (label, aside), the control, then at most one line of guidance.
 * At rest a healthy field shows its label and its value, nothing else.
 */
export function Field(
  props: FieldOptions & {
    /** aria-required on the control; no visible mark. */
    required?: boolean;
    /** A required value is missing: "Needed for Product". */
    missing?: string;
    /** The label is for assistive technology only. */
    labelHidden?: boolean;
    /** The label names a group of controls, not one control. */
    group?: boolean;
    /** Label and control share one row. */
    inline?: boolean;
    /** An ⓘ beside the label. */
    info?: ReactNode;
    /** Right after the label: the link button of a value that can be linked. */
    link?: ReactNode;
    meter?: Meter;
    /** What a linked value gives, shown on focus when no preview shows it. */
    resolved?: string;
    /** The field has no preview of its own (Schema, Site). */
    noStage?: boolean;
    /** A line that stays: the title pattern's example. */
    note?: ReactNode;
    /** Why a linked value gives nothing for the item: before any issue, which it explains. */
    explain?: ReactNode;
    /** Opens this field's suggestions, for an issue whose fix is a suggestion. */
    onSuggest?(): void;
    /** Under the guidance line: the suggestions tray. */
    after?: ReactNode;
    children(field: FieldParts & { describedBy?: string }): ReactNode;
  },
) {
  const field = useField(props);
  const { stageVisible, state } = useApp();
  const issue = useIssue(props.scope, props.path);
  const { meter } = props;
  const guideId = `${field.id}-guide`;

  // Length is guidance, as Checks files it: shown while editing, never as a
  // warning at rest. The count stays on the line whatever the line says.
  const long = meter?.state === 'long';
  const count =
    field.focused && meter && meter.state !== 'empty' ? (
      <span data-long={long || undefined}>
        {meter.state === 'unmeasured'
          ? `${meter.chars} characters`
          : meter.chars}
      </span>
    ) : undefined;
  let guide: ReactNode = null;
  if (field.message) {
    guide = (
      <Guide id={guideId} tone="error" role="alert" count={count}>
        {field.message}
      </Guide>
    );
  } else if (props.explain) {
    guide = <Guide id={guideId}>{props.explain}</Guide>;
  } else if (issue) {
    guide = (
      <Guide
        id={guideId}
        tone={issue.severity === 'fix' ? 'fix' : 'improve'}
        count={count}
      >
        {issue.message}
        <IssueFix
          issue={issue}
          label={props.label.toLowerCase()}
          onSuggest={props.onSuggest}
        />
      </Guide>
    );
  } else if (props.missing) {
    guide = (
      <Guide id={guideId} tone="improve">
        {props.missing}
      </Guide>
    );
  } else if (field.focused && long) {
    guide = (
      <Guide id={guideId} count={count}>
        May be cut off after “…{meter.after}”
      </Guide>
    );
  } else if (
    field.focused &&
    props.resolved !== undefined &&
    // Without a node to preview, no value has a result.
    state.server?.preview &&
    (props.noStage || !stageVisible)
  ) {
    guide = (
      <Guide id={guideId} count={count}>
        →{' '}
        <span
          className="seo-guide-resolved"
          title={props.resolved}
          dir="auto"
        >
          {props.resolved}
        </span>
      </Guide>
    );
  } else if (props.note) {
    guide = <Guide id={guideId}>{props.note}</Guide>;
  } else if (field.focused && meter) {
    guide =
      meter.state === 'empty' ? (
        meter.sentence && (
          <Guide id={guideId}>
            Empty. Search engines will pick text from the page.
          </Guide>
        )
      ) : (
        <Guide id={guideId} count={count}>
          {meter.state === 'fits' && 'Fits in results'}
        </Guide>
      );
  }

  // Kept while the line closes, so it folds away instead of vanishing.
  const lastGuide = useRef<ReactNode>(null);
  if (guide) {
    lastGuide.current = guide;
  }
  const describedBy =
    [field.aside && field.asideId, guide && guideId]
      .filter(Boolean)
      .join(' ') || undefined;
  const label = props.group ? (
    <span id={field.labelId} tabIndex={-1} className="seo-label">
      {props.label}
    </span>
  ) : (
    <label
      htmlFor={field.id}
      id={field.labelId}
      tabIndex={-1}
      className="seo-label"
    >
      {props.label}
    </label>
  );
  const row = (
    <div
      className={props.labelHidden ? 'seo-visually-hidden' : 'seo-label-row'}
    >
      {props.info || props.link ? (
        <span className="seo-label">
          {label}
          {props.info}
          {props.link}
        </span>
      ) : (
        label
      )}
    </div>
  );
  // After the control: Tab reaches the input before its Reset.
  const aside = (
    <div
      className="seo-aside"
      id={field.asideId}
      data-pinned={field.pinned || undefined}
    >
      {field.aside}
    </div>
  );
  const control = props.children({ ...field, describedBy });
  return (
    <div
      className={props.inline ? 'seo-field seo-inline' : 'seo-field'}
      ref={field.ref}
      data-path={props.path}
      data-disabled={field.disabled || undefined}
      role={props.group ? 'group' : undefined}
      aria-labelledby={props.group ? field.labelId : undefined}
      onFocus={field.onFocus}
      onBlur={field.onBlur}
    >
      {row}
      <div className="seo-control">{control}</div>
      {!props.labelHidden && aside}
      {/* No room is kept at rest: the line opens when there is one. */}
      <div className="seo-guide-slot" data-open={guide ? '' : undefined}>
        <div>{guide ?? lastGuide.current}</div>
      </div>
      {props.after}
    </div>
  );
}

/**
 * For values whose half-typed states are invalid by nature: the text is the
 * field's own while it has focus and is handed over once, on blur or Enter
 * (Ctrl/Cmd+Enter in a multi-line field).
 */
export function useHeld(
  value: string,
  commit: (text: string) => void,
  multiline = false,
) {
  const [held, setHeld] = useState<string | null>(null);
  const done = () => {
    if (held !== null && held !== value) {
      commit(held);
    }
    setHeld(null);
  };
  return {
    value: held ?? value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setHeld(event.target.value),
    onBlur: done,
    onKeyDown: (event: KeyboardEvent) => {
      if (
        event.key === 'Enter' &&
        (!multiline || event.ctrlKey || event.metaKey)
      ) {
        done();
      }
    },
  };
}
