import { ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { type ReactNode, useId, useRef, useState } from 'react';

import {
  DisclosureContext,
  type FieldOptions,
  type FieldParts,
  Guide,
  useField,
} from './Field';
import { reveal } from './ui';

/** Rare settings as rows in one surface. */
export const List = (props: { children: ReactNode }) => (
  <div className="seo-list">{props.children}</div>
);

/** A setting in a row: its label (and a second line), its aside, its control. */
export function Row(
  props: FieldOptions & {
    second?: ReactNode;
    control(field: FieldParts & { describedBy?: string }): ReactNode;
  },
) {
  const field = useField(props);
  const errorId = `${field.id}-error`;
  const describedBy =
    [field.aside && field.asideId, field.message && errorId]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div
      className="seo-row"
      ref={field.ref}
      data-path={props.path}
      data-disabled={field.disabled || undefined}
      onFocus={field.onFocus}
      onBlur={field.onBlur}
    >
      <div className="seo-row-label">
        {/* The aside sits on the label's line: the control never wraps for it. */}
        <span className="seo-row-head">
          <label htmlFor={field.id} id={field.labelId} tabIndex={-1}>
            {props.label}
          </label>
          <span
            className="seo-aside"
            id={field.asideId}
            data-pinned={field.pinned || undefined}
          >
            {field.aside}
          </span>
        </span>
        {props.second && <small>{props.second}</small>}
      </div>
      <div className="seo-row-end">
        {props.control({ ...field, describedBy })}
      </div>
      {field.message && (
        <Guide id={errorId} tone="error" role="alert">
          {field.message}
        </Guide>
      )}
    </div>
  );
}

/** One per view: a row that opens more rows in the same surface. */
export function Disclosure(props: {
  label: string;
  /** "Defaults", or what is not: described, not named. */
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!!props.defaultOpen);
  const [context] = useState(() => ({ open: () => setOpen(true) }));
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  return (
    <DisclosureContext.Provider value={context}>
      <div className="seo-disclosure" ref={root}>
        <button
          type="button"
          className="seo-row"
          aria-expanded={open}
          aria-controls={id}
          aria-description={props.summary}
          onClick={() => {
            setOpen(!open);
            // Once it has unfolded, what it opened comes into view.
            if (!open) {
              setTimeout(() => reveal(root.current), 200);
            }
          }}
        >
          <span className="seo-row-label">{props.label}</span>
          {/* Described, not named: not referenced, so not in the name either. */}
          <span className="seo-row-value" aria-hidden>
            <span>{props.summary}</span>
            <ChevronDownIcon aria-hidden />
          </span>
        </button>
        {/* Mounted when closed, so a jump can reach a field inside. */}
        <div
          className="seo-disclosure-body"
          id={id}
          data-closed={!open || undefined}
        >
          <div>{props.children}</div>
        </div>
      </div>
    </DisclosureContext.Provider>
  );
}

/** A row that opens a sheet. */
export function NavRow(props: {
  label: string;
  value?: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className="seo-row"
      aria-description={props.value || undefined}
      onClick={props.onClick}
    >
      <span className="seo-row-label">{props.label}</span>
      <span className="seo-row-value" aria-hidden>
        {props.value && <span>{props.value}</span>}
        <ChevronRightIcon aria-hidden />
      </span>
    </button>
  );
}
