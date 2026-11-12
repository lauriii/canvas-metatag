import {
  ChevronDownIcon,
  ChevronRightIcon,
  CrossCircledIcon,
  ResetIcon,
} from '@radix-ui/react-icons';
import {
  Button,
  Flex,
  IconButton,
  Link,
  Text,
  Tooltip,
} from '@radix-ui/themes';
import {
  type ChangeEvent,
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
import { type Meter, source as sourceOf } from '../model';
import type { Scope } from '../types';

// Collapsible sections: a button row with a chevron and a summary.

const SectionContext = createContext<{ open(): void } | null>(null);

export function Section(props: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const [context] = useState(() => ({ open: () => setOpen(true) }));
  return (
    <SectionContext.Provider value={context}>
      <div className="seo-section">
        <button
          type="button"
          className="seo-section-row"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <ChevronDownIcon aria-hidden />
          ) : (
            <ChevronRightIcon aria-hidden />
          )}
          <Text size="2" weight="medium">
            {props.title}
          </Text>
          {props.summary && (
            <Text size="1" color="gray" className="seo-section-summary">
              {props.summary}
            </Text>
          )}
        </button>
        {/* Mounted when closed, so "Go to" can reach a field inside. */}
        <div id={id} className="seo-section-body" hidden={!open}>
          {props.children}
        </div>
      </div>
    </SectionContext.Provider>
  );
}

// The meter: one rail and one sentence. Advice, never a block.

export function MeterLine(props: { meter: Meter; id?: string }) {
  const { meter } = props;
  if (!meter.sentence) {
    return null;
  }
  const quoted = /"[^"]*"$/.exec(meter.sentence);
  return (
    <Flex className="seo-meter-line" align="start" gap="2">
      {meter.state !== 'unmeasured' && (
        <span
          className="seo-meter"
          role="meter"
          aria-label="Length"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(meter.ratio * 100)}
          aria-valuetext={meter.sentence}
          data-state={meter.state}
        >
          <span style={{ width: `${meter.ratio * 100}%` }} />
        </span>
      )}
      <Text as="span" size="1" color="gray" id={props.id}>
        {quoted ? (
          <>
            {meter.sentence.slice(0, quoted.index)}
            {/* The quoted words move to the next line as one piece. */}
            <span className="seo-quote">{quoted[0]}</span>
          </>
        ) : (
          meter.sentence
        )}
      </Text>
    </Flex>
  );
}

// Fields.

export interface FieldOptions {
  scope: Scope;
  /** The dotted path within the scope: errors, reset and "Go to" use it. */
  path: string;
  label: string;
  /** Other paths this control also stores (their errors and jumps land here). */
  also?: string[];
  /** What the unset state says when no layer supplies a value: "Same as page title". */
  fallback?: string;
  /** Replaces the computed source line. */
  source?: ReactNode;
  /** The accessible name of the reset button, when it is not "Reset <label> to …". */
  resetLabel?: string;
  /** Replaces the plain reset of `path`. */
  onReset?(): void;
  /** A message of the dialog's own, shown like the server's. */
  error?: string;
}

export interface FieldParts {
  /** Give it to the control. */
  id: string;
  labelId: string;
  /** The ids of source, help, meter and error, in that order, for those that are shown. */
  describe(shown?: { help?: boolean; meter?: boolean }): string | undefined;
  invalid: boolean;
  disabled: boolean;
  /** A value is stored at this scope. */
  set: boolean;
  /** "From Site ›", "Set on this page", "Reset · Undo". */
  source: ReactNode;
  reset: ReactNode;
  error: ReactNode;
  /** On the field's outer element: "Go to" scrolls to it. */
  ref: React.RefObject<HTMLDivElement>;
  ids: { source: string; help: string; meter: string; error: string };
}

/** Everything a field knows about itself: where its value comes from, its error, its jump target. */
export function useField(options: FieldOptions): FieldParts {
  const { scope, path, label } = options;
  const { state, dispatch, view, locked, jump, goTo } = useApp();
  const server = state.server!;
  const target = server.target;
  const id = useId();
  const ids = {
    source: `${id}-source`,
    help: `${id}-help`,
    meter: `${id}-meter`,
    error: `${id}-error`,
  };
  const ref = useRef<HTMLDivElement>(null);
  const section = useContext(SectionContext);
  const paths = [path, ...(options.also ?? [])];

  // "Go to": open the section, scroll, focus, say so.
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
    section?.open();
    dispatch({ type: 'flash', flash: `Moved to ${label}` });
    // After the tab and the section have been shown.
    const frame = requestAnimationFrame(() => {
      const root = ref.current;
      if (!root) {
        return;
      }
      // The section's open() has not been rendered yet: a hidden body can be
      // neither scrolled to nor focused. React shows it on its next render.
      root.closest('.seo-section-body')?.removeAttribute('hidden');
      root.scrollIntoView({ block: 'center' });
      if (jump.toLabel) {
        // Reading where a value comes from never puts a caret into it.
        document.getElementById(`${id}-label`)?.focus({ preventScroll: true });
        root.dataset.marked = '';
        setTimeout(() => delete root.dataset.marked, 1500);
      } else {
        (
          document.getElementById(id) ??
          root.querySelector<HTMLElement>('[data-focus]')
        )?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.seq]);

  const errors = state.errors[scope];
  const message =
    options.error ??
    Object.entries(errors).find(([key]) =>
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
  const belowName = {
    default: `${language} version`,
    site: 'Site',
    target: '',
    fallback: '',
  }[below];
  // Reset and its Undo remove the button that was pressed; focus stays on
  // the field instead of falling to the document.
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

  let source: ReactNode = options.source;
  if (justReset) {
    source = (
      <>
        Reset ·{' '}
        <Button
          size="1"
          variant="ghost"
          // The source line is gray text; the action keeps the accent.
          color="blue"
          onClick={() => {
            dispatch({ type: 'undo' });
            stayOnField();
          }}
        >
          Undo
        </Button>
      </>
    );
  } else if (source === undefined && scope === 'target' && target) {
    const shown = set ? 'target' : from.find((one) => one !== 'fallback');
    source =
      shown === 'target' ? (
        page ? (
          'Set on this page'
        ) : (
          `Set for every ${target.label}`
        )
      ) : shown === 'default' ? (
        `From the ${language} version`
      ) : shown === 'site' ? (
        <Link
          size="1"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            goTo(
              { scope: 'site', tab: 'defaults', field: `values.${path}` },
              { toLabel: true },
            );
          }}
        >
          From Site ›
        </Link>
      ) : (
        options.fallback
      );
  }

  const disabled = locked[scope];
  // Named after what it returns to, as the source line says it.
  const resetName =
    options.resetLabel ??
    `Reset ${label} to ${
      belowName
        ? `the ${belowName} default`
        : options.fallback
          ? `"${options.fallback}"`
          : 'the default'
    }`;
  const reset = set && !disabled && (
    <Tooltip
      content={
        options.resetLabel ??
        `Reset to the ${belowName ? `${belowName} ` : ''}default`
      }
    >
      <IconButton
        size="1"
        variant="ghost"
        color="gray"
        aria-label={resetName}
        onClick={() => {
          if (options.onReset) {
            options.onReset();
          } else {
            dispatch({ type: 'reset', scope, path });
          }
          stayOnField();
        }}
      >
        <ResetIcon aria-hidden />
      </IconButton>
    </Tooltip>
  );

  return {
    id,
    labelId: `${id}-label`,
    describe: (shown = {}) =>
      [
        source && ids.source,
        shown.help && ids.help,
        shown.meter && !message && ids.meter,
        message && ids.error,
      ]
        .filter(Boolean)
        .join(' ') || undefined,
    invalid: message !== undefined,
    disabled,
    set,
    source: source ? (
      <Text as="span" size="1" color="gray" id={ids.source}>
        {source}
      </Text>
    ) : null,
    reset,
    error: message ? <ErrorLine id={ids.error}>{message}</ErrorLine> : null,
    ref,
    ids,
  };
}

/** The server's sentence under the field. It never moves focus and never changes the text. */
export function ErrorLine(props: { id?: string; children: string }) {
  return (
    <Flex className="seo-error" gap="1" align="start" role="alert">
      <CrossCircledIcon aria-hidden />
      <Text as="span" size="1" id={props.id}>
        {props.children}
      </Text>
    </Flex>
  );
}

/**
 * Label row (name · source · reset · suggest), the control, then help. The
 * control places `status` (the error, else the meter) itself: a template
 * field puts its insert button on that line.
 */
export function Field(
  props: FieldOptions & {
    /** Required details are marked; the mark is not part of the name. */
    required?: boolean;
    /** The label is for assistive technology only (the section row shows it). */
    labelHidden?: boolean;
    /** The label names a group of controls, not one control. */
    group?: boolean;
    suggest?: ReactNode;
    help?: ReactNode;
    meter?: Meter;
    children(
      field: FieldParts & { status: ReactNode; describedBy?: string },
    ): ReactNode;
  },
) {
  const field = useField(props);
  const status =
    field.error ??
    (props.meter ? (
      <MeterLine meter={props.meter} id={field.ids.meter} />
    ) : null);
  const aside = field.source || field.reset || props.suggest;
  const label = (
    <Text
      asChild
      size="2"
      weight="medium"
      className={props.labelHidden ? 'seo-visually-hidden' : undefined}
    >
      {props.group ? (
        <span id={field.labelId} tabIndex={-1}>
          {props.label}
        </span>
      ) : (
        <label htmlFor={field.id} id={field.labelId} tabIndex={-1}>
          {props.label}
        </label>
      )}
    </Text>
  );
  return (
    <div
      className="seo-field"
      ref={field.ref}
      role={props.group ? 'group' : undefined}
      aria-labelledby={props.group ? field.labelId : undefined}
    >
      {props.labelHidden && !aside ? (
        // A hidden label with nothing beside it takes no room.
        label
      ) : (
        <Flex
          className="seo-label-row"
          align="center"
          justify="between"
          wrap="wrap"
          gapX="3"
        >
          {label}
          {props.required && !props.labelHidden && (
            <Text as="span" size="2" color="gray" aria-hidden mr="auto" ml="-2">
              *
            </Text>
          )}
          <Flex align="center" gap="2" ml="auto" minHeight="24px">
            {field.source}
            {field.reset}
            {props.suggest}
          </Flex>
        </Flex>
      )}
      {props.children({
        ...field,
        status,
        describedBy: field.describe({
          help: !!props.help,
          meter: !!props.meter?.sentence,
        }),
      })}
      {props.help && (
        <Text as="p" size="1" color="gray" id={field.ids.help} mt="1">
          {props.help}
        </Text>
      )}
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
