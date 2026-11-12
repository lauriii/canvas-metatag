import {
  EyeNoneIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons';
import { Tooltip } from '@radix-ui/themes';
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  type SVGProps,
  forwardRef,
} from 'react';

// One button family: solid (the one primary), danger, soft, outline, ghost.

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'danger' | 'soft' | 'outline' | 'ghost';
  size?: 24 | 28 | 32;
  /** Ghost text in the accent: Undo, Show, Try again, inline fixes. */
  accent?: boolean;
};

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(
  ({ variant = 'soft', size = 28, accent, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className="seo-btn"
      data-variant={variant}
      data-size={size}
      data-accent={accent || undefined}
      {...props}
    />
  ),
);
Btn.displayName = 'Btn';

type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  /** Defaults to the label. */
  tip?: string;
  size?: 24 | 28;
  ai?: boolean;
  /** In a field: below, so the label row stays readable. */
  side?: 'top' | 'bottom';
};

/** Icon-only: its name is its tooltip's first phrase. */
export const IconBtn = forwardRef<HTMLButtonElement, IconBtnProps>(
  ({ label, tip, size = 24, ai, side, children, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type="button"
        className="seo-icon-btn"
        aria-label={label}
        data-size={size}
        data-ai={ai || undefined}
        {...props}
      >
        {children}
      </button>
    );
    // tip="": a name that says it all ("Back") needs no tooltip.
    return tip === '' ? button : (
      <Tooltip content={tip ?? label} side={side}>
        {button}
      </Tooltip>
    );
  },
);
IconBtn.displayName = 'IconBtn';

/** ⓘ: a sentence that is useful once, kept out of the way. */
export function InfoTip(props: { label: string; text: string; size?: 24 | 28 }) {
  return (
    <IconBtn
      label={props.label}
      tip={props.text}
      size={props.size}
      aria-description={props.text}
    >
      <InfoCircledIcon aria-hidden />
    </IconBtn>
  );
}

export const SparkleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="currentColor"
    aria-hidden
    data-ai=""
    {...props}
  >
    <path d="M6.5 2.5l1.05 3.2a1.5 1.5 0 0 0 .95.95l3.2 1.05-3.2 1.05a1.5 1.5 0 0 0-.95.95L6.5 12.9 5.45 9.7a1.5 1.5 0 0 0-.95-.95L1.3 7.7l3.2-1.05a1.5 1.5 0 0 0 .95-.95z" />
    <path d="M11.75 1l.45 1.3 1.3.45-1.3.45-.45 1.3-.45-1.3-1.3-.45 1.3-.45z" />
  </svg>
);

export const BracesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <path d="M5 2.5c-1.1 0-1.6.5-1.6 1.6v1.5c0 .8-.4 1.3-1.2 1.6.8.3 1.2.8 1.2 1.6v1.5c0 1.1.5 1.6 1.6 1.6M10 2.5c1.1 0 1.6.5 1.6 1.6v1.5c0 .8.4 1.3 1.2 1.6-.8.3-1.2.8-1.2 1.6v1.5c0 1.1-.5 1.6-1.6 1.6" />
  </svg>
);

/** One sentence in a tinted box, with at most two buttons under it. */
export function Notice(props: {
  tone?: 'amber' | 'neutral';
  role?: 'alert' | 'status';
  icon?: 'info' | 'warn' | 'hidden';
  children: ReactNode;
  actions?: ReactNode;
}) {
  const Icon =
    props.icon === 'hidden'
      ? EyeNoneIcon
      : props.icon === 'warn' || props.tone === 'amber'
        ? ExclamationTriangleIcon
        : InfoCircledIcon;
  return (
    <div className="seo-notice" data-tone={props.tone} role={props.role}>
      <Icon aria-hidden />
      <div className="seo-notice-text">
        <p>{props.children}</p>
        {props.actions && (
          <div className="seo-notice-actions">{props.actions}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Scrolls an element into sight within the dialog's own scroller. Never
 * scrollIntoView(): that also scrolls the editor's page around the frame.
 */
export function reveal(
  element: Element | null | undefined,
  block: 'start' | 'center' | 'nearest' = 'nearest',
) {
  const scroller = element?.parentElement?.closest<HTMLElement>(
    '.seo-body, .seo-menu-list',
  );
  if (!element || !scroller) {
    return;
  }
  const view = scroller.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(scroller);
  const top = view.top + (parseFloat(style.scrollPaddingTop) || 0);
  const bottom = view.bottom - (parseFloat(style.scrollPaddingBottom) || 0);
  const delta =
    block === 'start'
      ? rect.top - top
      : block === 'center'
        ? rect.top + rect.height / 2 - (top + bottom) / 2
        : rect.top < top
          ? rect.top - top
          : rect.bottom > bottom
            ? Math.min(rect.bottom - bottom, rect.top - top)
            : 0;
  scroller.scrollTop += delta;
}

/** A grey bar where text will be. */
export const Sk = (props: { w: string | number; h: number; mt?: number }) => (
  <span
    className="seo-sk"
    style={{ width: props.w, height: props.h, marginTop: props.mt }}
  />
);
