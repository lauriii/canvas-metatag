import {
  CheckCircledIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  GlobeIcon,
  LockClosedIcon,
} from '@radix-ui/react-icons';
import { DropdownMenu, Tabs, Tooltip } from '@radix-ui/themes';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useApp } from '../App';
import { type Footer, inSentence } from '../model';
import type { Scope } from '../types';
import { summary } from './ChecksSheet';
import { IconBtn } from './ui';

/**
 * No ring on this control until the next key press in the frame. Not on blur:
 * the frame losing and regaining focus would bring a ring back for a click.
 */
function quietUntilKey(element: HTMLElement) {
  element.dataset.quiet = '';
  window.addEventListener('keydown', () => delete element.dataset.quiet, {
    once: true,
    capture: true,
  });
}

/** The dialog takes focus once per frame: never again when the editor moves on. */
let focusedOnce = false;

const TONES: Record<Footer['dot'], string> = {
  gray: 'gray',
  blue: 'blue',
  spinner: 'blue',
  ok: 'ok',
  error: 'red',
  info: 'blue',
  warn: 'amber',
};

/** The scope is the view's title; its menu says what each scope means. */
function ScopeMenu(props: { status: Footer | null }) {
  const { state, dispatch, closeSheet } = useApp();
  const server = state.server!;
  const target = server.target;
  const trigger = useRef<HTMLElement>(null);
  const id = useId();
  /** The menu is used with keys, not a pointer. */
  const keyed = useRef(false);
  // Once, when the dialog opens. Focus never moves again without a user action.
  useEffect(() => {
    const element = trigger.current;
    if (focusedOnce || !element) {
      return;
    }
    focusedOnce = true;
    // Arriving is not navigating: the ring waits for a key press in the frame.
    quietUntilKey(element);
    element.focus();
  }, []);

  // From Site settings to a page or template still loading: its neutral
  // name, as the loading view has, never "Site settings".
  if (!target && state.ctx.kind !== 'none' && state.phase === 'loading') {
    return (
      <span className="seo-scope" data-static="">
        {state.ctx.kind === 'page' ? 'This page' : 'Template'}
      </span>
    );
  }
  if (!target) {
    return (
      <h2
        className="seo-scope"
        data-static=""
        tabIndex={-1}
        ref={trigger as React.RefObject<HTMLHeadingElement>}
      >
        Site settings
      </h2>
    );
  }
  const page = target.scope === 'page';
  const own = page ? 'This page' : `Every ${target.label}`;
  const label = state.scope === 'site' ? 'Site' : own;
  const name = (langcode: string | null) =>
    server.languages[langcode ?? ''] ?? langcode ?? '';
  const multilingual = page && Object.keys(server.languages).length > 1;
  const translation =
    !!target.default_langcode && target.default_langcode !== server.langcode;
  const siteName =
    state.edits.site.identity.name.trim() || server.facts.site?.value || '';
  const unsavedSite = state.siteDirty && state.scope !== 'site';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <button
          ref={trigger as React.RefObject<HTMLButtonElement>}
          type="button"
          className="seo-scope"
          aria-description={
            state.siteDirty ? 'Site has unsaved changes' : undefined
          }
        >
          <span className="seo-scope-name">{label}</span>
          {multilingual && state.scope === 'target' && (
            <span className="seo-scope-lang" aria-hidden>
              {server.langcode.toUpperCase()}
            </span>
          )}
          {unsavedSite && (
            <span className="seo-dot" data-size="6" data-tone="blue" aria-hidden />
          )}
          <ChevronDownIcon aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        className="seo-scope-menu"
        align="start"
        // Item text lines up with the trigger's.
        alignOffset={-4}
        collisionPadding={4}
        sideOffset={6}
        onPointerDown={() => {
          // Chosen with a pointer: focus goes back without a ring.
          if (trigger.current) {
            quietUntilKey(trigger.current);
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
        onKeyDown={() => (keyed.current = true)}
        onPointerMove={() => (keyed.current = false)}
        onFocus={(event) => {
          // What follows the last item is text: reached by keys, that item
          // brings it into sight as well, in a short frame.
          const items = event.currentTarget.querySelectorAll('[role^="menuitem"]');
          if (keyed.current && event.target === items[items.length - 1]) {
            const viewport = event.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
            viewport?.scrollTo({ top: viewport.scrollHeight });
          }
        }}
      >
        <DropdownMenu.RadioGroup
          value={state.scope}
          onValueChange={(scope) => {
            closeSheet(false);
            dispatch({ type: 'scope', scope: scope as Scope });
          }}
        >
          <DropdownMenu.RadioItem
            value="target"
            aria-label={own}
            aria-describedby={`${id}-target`}
          >
            <span className="seo-mi">
              <b>{own}</b>
              <small id={`${id}-target`}>
                {page
                  ? target.label
                  : server.preview
                    ? `Previewing ${server.preview.label}`
                    : `No ${inSentence(target.label)} yet`}
              </small>
            </span>
          </DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem
            value="site"
            aria-label="Site"
            aria-describedby={`${id}-site`}
          >
            <span className="seo-mi">
              <b>
                Site
                {state.siteDirty && (
                  <span
                    className="seo-dot"
                    data-size="6"
                    data-tone="blue"
                    aria-hidden
                  />
                )}
              </b>
              <small id={`${id}-site`}>
                {state.siteDirty
                  ? 'Unsaved changes'
                  : (
                    <>
                      {siteName}{'\u00a0·'} <span>every page, live when saved</span>
                    </>
                  )}
              </small>
            </span>
          </DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
        {multilingual && (
          <>
            <DropdownMenu.Separator />
            <div className="seo-mi-info">
              <GlobeIcon aria-hidden />
              <span>
                {!target.translatable
                  ? 'Shared by every language'
                  : translation
                    ? `Editing the ${name(server.langcode)} translation`
                    : `Editing the ${name(server.langcode)} version`}
                <small>
                  {!target.translatable
                    ? 'These settings are shared by every language of this page.'
                    : translation
                      ? `These settings publish with the ${name(target.default_langcode)} page. Site settings are shared by every language.`
                      : `Titles and descriptions apply to ${name(server.langcode)} only. Visibility, image and type also apply to translations until they set their own.`}
                </small>
              </span>
            </div>
          </>
        )}
        {props.status?.text && (
          <>
            <DropdownMenu.Separator />
            <div className="seo-mi-status">
              <span
                className="seo-dot"
                data-size="6"
                data-tone={TONES[props.status.dot]}
              />
              {props.status.text}
            </div>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

/**
 * The one polite live region. Its words are hidden; a glyph beside the scope
 * shows them: a spinner while saving, a check once saved, a lock when read-only.
 */
function SaveStatus(props: { footer: Footer; bar: boolean }) {
  const { state } = useApp();
  // While the target (re)loads the last settled status stays: another
  // previewed node is not news. (The editor's brief 'store' state after a
  // load is held back for the whole view, in App.)
  const ready = state.phase === 'ready';
  const settled = useRef(props.footer);
  useLayoutEffect(() => {
    if (ready) {
      settled.current = props.footer;
    }
  }, [ready, props.footer]);
  // Site's status is not the next page's: nothing is said until it loads.
  const footer =
    state.phase === 'loading' &&
    state.ctx.kind !== 'none' &&
    !state.server?.target
      ? { ...props.footer, dot: 'gray' as const, text: '' }
      : ready
        ? props.footer
        : settled.current;
  const glyph =
    footer.dot === 'spinner'
      ? 'spinner'
      : footer.text === 'Read-only'
        ? 'lock'
        : footer.dot === 'error'
          ? 'error'
          : footer.dot === 'ok' && !props.bar
            ? 'ok'
            : null;
  // The check fades out when the model returns to idle.
  const [last, setLast] = useState(glyph);
  useEffect(() => {
    if (glyph) {
      setLast(glyph);
      return;
    }
    const timer = setTimeout(() => setLast(null), 200);
    return () => clearTimeout(timer);
  }, [glyph]);
  const shown = glyph ?? last;
  const icon =
    shown === 'spinner' ? (
      <span className="seo-spinner" />
    ) : shown === 'ok' ? (
      <CheckIcon />
    ) : shown === 'lock' ? (
      <LockClosedIcon width="12" height="12" />
    ) : shown === 'error' ? (
      <span className="seo-dot" data-size="6" data-tone="red" />
    ) : null;
  return (
    <span
      className="seo-glyph"
      role="status"
      aria-live="polite"
      tabIndex={-1}
      data-testid="seo-footer-status"
    >
      <span className="seo-visually-hidden">{footer.text}</span>
      {icon && (
        <Tooltip content={footer.text || 'Saved'}>
          <span
            aria-hidden
            data-glyph={shown}
            data-out={!glyph || undefined}
          >
            {icon}
          </span>
        </Tooltip>
      )}
    </span>
  );
}

const TABS = [
  ['search', 'Search'],
  ['social', 'Social'],
  ['schema', 'Schema'],
] as const;

/** Three tabs; one pill slides to the active one. */
function TabList(props: { value: string }) {
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) {
      return;
    }
    const place = () => {
      const active = element.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]',
      );
      if (active) {
        setPill({ x: active.offsetLeft, w: active.offsetWidth });
      }
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value]);
  return (
    <Tabs.List className="seo-tabs" ref={list}>
      {pill && (
        <span
          className="seo-tab-pill"
          aria-hidden
          style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
        />
      )}
      {TABS.map(([value, label]) => (
        <Tabs.Trigger
          key={value}
          value={value}
          className="seo-tab"
          // A click is not a key press: no ring, whatever came before it.
          onPointerDown={(event) => quietUntilKey(event.currentTarget)}
        >
          {label}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}

/** The issue count: one quiet button that opens the Checks sheet. */
function ChecksButton(props: { short: boolean }) {
  const { issues, openSheet } = useApp();
  const fix = issues.filter((issue) => issue.severity === 'fix').length;
  const improve = issues.filter((issue) => issue.severity === 'improve').length;
  const text = fix ? `${fix} to fix` : improve ? `${improve} to improve` : 'Checks';
  const all = summary(issues);
  // The short form ("● 1") counts what the long one does; a tooltip says it
  // all, only where the visible text does not already.
  const tip = props.short || (all !== text && (fix || improve) > 0);
  const button = (
    <button
      type="button"
      className="seo-checks-btn"
      aria-label={`Checks, ${all.replace(' · ', ', ').toLowerCase()}`}
      onClick={() => openSheet({ kind: 'checks' })}
    >
      {fix ? (
        <span className="seo-dot" data-tone="red" />
      ) : improve ? (
        <span className="seo-dot" data-tone="amber" />
      ) : (
        <CheckCircledIcon aria-hidden />
      )}
      <span className="seo-checks-long">{text}</span>
      {(fix || improve) > 0 && (
        <span className="seo-checks-short">{fix || improve}</span>
      )}
    </button>
  );
  // Always mounted, so the button stays the element that opened the sheet.
  return (
    <Tooltip content={all} open={tip ? undefined : false}>
      {button}
    </Tooltip>
  );
}

/** 44 px: the scope, the save glyph, the tabs, the issue count. Nothing else. */
export function Header(props: {
  footer: Footer;
  bar: boolean;
  /** The scope menu's status line: none while the bar says it. */
  status: Footer | null;
  loading: boolean;
  scrolled: boolean;
  tab: string;
}) {
  const { state, issues } = useApp();
  const target = state.scope === 'target' && state.server?.target;
  // The Checks text gives way before the scope's name does: "● 2" while the
  // name would be cut. Measured with the long text, set before paint.
  const header = useRef<HTMLElement>(null);
  const [short, setShort] = useState(false);
  const fit = () => {
    const element = header.current;
    const name = element?.querySelector('.seo-scope-name');
    element?.removeAttribute('data-tight');
    if (element && name && element.querySelector('.seo-checks-btn')) {
      element.toggleAttribute('data-tight', name.scrollWidth > name.clientWidth);
    }
    // The short form shows when tight, or in a narrow frame (styles.css).
    const long = element?.querySelector('.seo-checks-long');
    setShort(!!long && getComputedStyle(long).display === 'none');
  };
  useLayoutEffect(fit, [target, props.loading, issues]);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => fit());
    observer.observe(header.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <header
      ref={header}
      className="seo-header"
      data-scrolled={props.scrolled || undefined}
    >
      <ScopeMenu status={props.status} />
      <SaveStatus footer={props.footer} bar={props.bar} />
      {target && <TabList value={props.tab} />}
      {target && !props.loading && state.server?.preview && (
        <ChecksButton short={short} />
      )}
    </header>
  );
}

const STOPS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/** Tab (or Shift+Tab) from this element would take focus out of the frame. */
function leavesFrame(from: EventTarget, back: boolean): boolean {
  const stops = [...document.querySelectorAll<HTMLElement>(STOPS)].filter((one) => one.tabIndex >= 0 && one.getClientRects().length > 0);
  return stops.length > 0 && from === stops[back ? 0 : stops.length - 1];
}

/** A full-frame panel with Back: Checks, Output, Choose image, Custom JSON-LD. */
export function Sheet(props: {
  title: string;
  end?: ReactNode;
  /** Back takes focus on open (else the sheet's own content does). */
  focusBack?: boolean;
  /** Its title takes focus on open: a sheet of fields, read from its name. */
  focusTitle?: boolean;
  /** Under the scroller, never over it: a confirm that stays in sight. */
  foot?: ReactNode;
  /** A sheet with levels: Back and Escape go up one, named for where. */
  backLabel?: string;
  onBack?(): void;
  onClose(): void;
  children: ReactNode;
}) {
  const id = useId();
  const back = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const section = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const close = useRef(props.onBack ?? props.onClose);
  close.current = props.onBack ?? props.onClose;
  useEffect(() => {
    if (props.focusTitle) {
      title.current?.focus();
    } else if (props.focusBack) {
      back.current?.focus();
    }
    // A button that took itself away left focus nowhere: Escape still goes
    // up one level. Caught before the editor's dialog would close on it.
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && (document.activeElement === document.body || document.activeElement === null)) {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section
      ref={section}
      className="seo-sheet"
      aria-labelledby={id}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          // Never on to the editor, which would close the dialog: an Escape
          // a tip or a menu inside used stays here too.
          event.stopPropagation();
          if (!event.defaultPrevented) {
            (props.onBack ?? props.onClose)();
          }
        } else if (event.key === 'Tab' && !event.defaultPrevented && leavesFrame(event.target, event.shiftKey)) {
          // Past the last stop, focus would leave the dialog's frame and the
          // next Escape would reach the editor: the title takes it, as it
          // does for a control that went.
          event.preventDefault();
          title.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Focus lost with a control that went (Clear, a removed row): the
        // sheet's title takes it, never the document.
        if (event.relatedTarget === null) {
          requestAnimationFrame(() => {
            if (section.current?.isConnected && (document.activeElement === document.body || document.activeElement === null)) {
              title.current?.focus();
            }
          });
        }
      }}
    >
      <div className="seo-sheet-header" data-scrolled={scrolled || undefined}>
        <IconBtn
          ref={back}
          label={props.backLabel ?? 'Back'}
          tip=""
          size={28}
          onClick={props.onBack ?? props.onClose}
        >
          <ChevronLeftIcon aria-hidden />
        </IconBtn>
        <h2 id={id} ref={title} tabIndex={-1}>
          {props.title}
        </h2>
        {props.end && <div className="seo-sheet-end">{props.end}</div>}
      </div>
      <div
        className="seo-body"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
      >
        {props.children}
      </div>
      {props.foot && <div className="seo-sheet-foot">{props.foot}</div>}
    </section>
  );
}
