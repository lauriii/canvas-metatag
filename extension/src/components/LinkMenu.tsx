import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons';
import { Popover } from '@radix-ui/themes';
import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { clip } from '../model';
import { reveal } from './ui';

/** The menu's width, as in styles.css. */
const MENU_WIDTH = 340;

/** The frame height up to which the menu takes the frame, as in styles.css. */
const SHORT_FRAME = 420;

/** The characters of a value an entry shows, and so its accessible name. */
const ENTRY_CHARS = 150;

/** A press this soon after the one that opened the menu is its double-click. */
const DOUBLE_CLICK_MS = 500;

/** The gap between the menu and its field. */
const OFFSET = 4;

/**
 * The room a menu below its field needs to list three entries of two lines,
 * with its filter, its hints and a footer.
 */
const ROOM_FOR_THREE = 320;

/** How high a menu above its field may reach: the header's bottom edge, never through the header. */
const ceiling = () => document.querySelector('.seo-header')?.getBoundingClientRect().bottom ?? 0;

/** One row of a link menu. */
export interface MenuItem {
  key: string;
  label: string;
  /**
   * Beside the label, never cut with the value: "from Summary" for a
   * worked-out value, "Default" for the field the default reads.
   */
  hint?: string;
  /** The second line: the previewed item's value, or what the row does. */
  sub?: string;
  /** The second line says that there is no value. */
  subEmpty?: boolean;
  /** The heading the row is listed under. */
  group?: string;
  /** Why it cannot be picked. */
  disabled?: string;
  /** The value the field has now. */
  current?: boolean;
  /** Opens this level. */
  level?: string;
  /** A row of no importance: the fold of entries that do not fit. */
  quiet?: boolean;
  /**
   * A step on the whole value, first: it stays under the filter while the
   * list scrolls, so it is in sight when the menu opens far below it.
   */
  pin?: boolean;
  run?(): void;
}

/**
 * A field's link menu: a dialog with a filter, the entries with the previewed
 * item's values, and a level per reference. It hangs from the field's box,
 * inside the dialog; in a frame up to 420 px tall it takes the frame's height
 * from the column's left edge, as wide as the column.
 */
export function LinkMenu(props: {
  /** The dialog's id: the box that opens it controls it. */
  id?: string;
  open: boolean;
  /** `escape`: focus goes back to the opener. */
  onClose(how: 'escape' | 'away' | 'resize'): void;
  /** The control the menu belongs to: it hangs from it. */
  box: RefObject<HTMLElement>;
  /** Where focus goes when the menu closes without a pick. */
  opener: RefObject<HTMLElement>;
  /** The dialog's name: "Link Description". */
  name: string;
  /** The filter's name and placeholder: "Find a field". */
  filterLabel: string;
  /** The type's name: "Back to Article". */
  typeLabel: string;
  /** The rows for a filter, at the top (level null) or in a level. */
  items(filter: string, level: string | null): MenuItem[];
  /** What an empty list says. */
  empty(filter: string): string;
  footer?: ReactNode;
  /** Every row is shown, none can be picked. */
  readOnly?: boolean;
  /** The level it opens at: the one that holds the current entry. */
  start?: string | null;
  /** What the filter holds when it opens: the key that opened it. */
  seed?: string;
  /** A level's heading, when not its name. */
  levelTitle?(level: string): string;
  /** What Enter does to a value row: link (the default), add or replace. */
  verb?: 'link' | 'add' | 'replace';
  /** A line above the list: where an added field goes. Shown in short frames too. */
  header?: ReactNode;
  /** `{` in the empty filter: the menu closes and a brace is typed instead. */
  onBrace?(): void;
}) {
  const [filter, setFilter] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [placed, setPlaced] = useState<{
    side: 'top' | 'bottom';
    align: 'start' | 'end';
    short: number | null;
    /** Room kept free at the frame's bottom: the action bar, while it shows. */
    bottom: number;
    /** Opened by a key: what it lists is filtered from the start. */
    seeded: boolean;
  }>({ side: 'bottom', align: 'start', short: null, bottom: 8, seeded: false });
  // In a short frame the menu hangs from the frame's top edge: no side of the
  // field has room for two entries. Kept after closing, so the menu leaves
  // from where it was.
  const frameTop = useRef<{ getBoundingClientRect(): DOMRect } | null>(null);
  // Whether it opened in a short frame: read by a resize at once, before
  // the placement it set has rendered.
  const shortFrame = useRef(false);
  const filterField = useRef<HTMLInputElement | null>(null);
  // Opened, the filter takes focus as soon as it is there: Radix mounts the
  // menu a render after it opens, and a key typed at once must reach it.
  const wantFocus = useRef(false);
  // The arrows have moved the active row since the menu opened.
  const moved = useRef(false);
  // The pointer set the active row: the list never scrolls under it.
  const pointed = useRef(false);
  // When it opened, and whether the pointer has moved since: the second
  // press of a double-click picks nothing.
  const openedAt = useRef(0);
  const stirred = useRef(false);
  const filterRef = useCallback((element: HTMLInputElement | null) => {
    filterField.current = element;
    if (element && wantFocus.current) {
      focusFilter();
    }
  }, []);
  const list = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [gone, setGone] = useState(false);
  // Whether it is open now: read by the closing of an earlier opening, whose
  // handlers saw the props of when it closed.
  const isOpen = useRef(props.open);
  isOpen.current = props.open;
  // Above its field the menu keeps the height it opened with, so that the
  // filter never moves; measured once Radix has placed it (null: not yet).
  const [height, setHeight] = useState<number | null>(null);
  const pickable = (row: MenuItem | undefined) =>
    !!row && !row.disabled && !(props.readOnly && row.key !== '#back' && !row.level);
  // The first row Enter can use: the best match.
  const first = (rows: MenuItem[]) => Math.max(0, rows.findIndex((row) => pickable(row) || !!row.level));

  // Placed once per opening, before it paints and before a key reaches it:
  // filtering never flips the menu over the field, and no key typed at once
  // is wiped.
  useLayoutEffect(() => {
    if (!props.open) {
      return;
    }
    const seed = props.seed ?? '';
    const start = seed ? null : (props.start ?? null);
    setFilter(seed);
    setLevel(start);
    setGone(false);
    // The current entry has focus, in its level (after "Back"); a key that
    // opened the menu, the best match.
    const rows = props.items(seed, start);
    // Without a current entry, the first row that can be picked after the
    // pinned steps: Enter at once picks a field, never a step on the whole
    // value, nor a row that only says why it can't be picked.
    const current = rows.findIndex((row) => row.current);
    const pick = rows.findIndex((row) => !row.pin && (pickable(row) || !!row.level));
    const after = pick >= 0 ? pick : Math.max(0, rows.findIndex((row) => !row.pin));
    setActive(seed ? first(rows) : (current >= 0 ? current : after) + (start === null ? 0 : 1));
    const rect = props.box.current?.getBoundingClientRect();
    const fits = window.innerHeight > SHORT_FRAME;
    // The action bar's top edge is the frame's bottom while it shows, in a
    // short frame too.
    const bar = document.querySelector('.seo-bar')?.getBoundingClientRect();
    const bottom = bar ? Math.max(8, window.innerHeight - bar.top + 8) : 8;
    const below = rect ? window.innerHeight - bottom - rect.bottom : Infinity;
    const above = (rect?.top ?? 0) - ceiling();
    let width = Math.min(MENU_WIDTH, window.innerWidth - 16);
    shortFrame.current = !fits;
    frameTop.current = null;
    if (!fits) {
      // From the column's left edge, also for a field in the right-hand
      // column, so that the menu never covers the field's own buttons, and as
      // wide as the column, so that no word of the header shows beside it.
      const column = props.box.current?.closest('.seo-body') ?? document.querySelector('.seo-frame > .seo-body');
      let left = rect?.left ?? 8;
      if (column) {
        const style = getComputedStyle(column);
        left = column.getBoundingClientRect().left + parseFloat(style.paddingLeft);
        width = Math.min(
          column.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          window.innerWidth - 16,
        );
      }
      const edge = DOMRect.fromRect({
        x: Math.min(left, window.innerWidth - width - 8),
        y: 8,
        width: 0,
        height: 0,
      });
      frameTop.current = { getBoundingClientRect: () => edge };
    }
    // Below, unless three entries do not fit there and there is more room
    // above.
    const side = !fits || below >= ROOM_FOR_THREE || below >= above ? 'bottom' : 'top';
    const start_ = !rect || rect.left + width <= window.innerWidth - 8;
    const end_ = !!rect && rect.right - width >= 8;
    if (fits && rect && !start_ && !end_) {
      // Neither edge of the field keeps it in the frame (a narrow frame, at
      // 200 % zoom): it hangs from the field's side, inside the frame.
      const edge = DOMRect.fromRect({
        x: Math.max(8, window.innerWidth - width - 8),
        y: rect.top,
        width: 0,
        height: rect.height,
      });
      frameTop.current = { getBoundingClientRect: () => edge };
    }
    setPlaced({
      side,
      align: !fits || start_ || !end_ ? 'start' : 'end',
      short: !fits ? width : null,
      bottom,
      seeded: seed !== '',
    });
    fit(side === 'top' && fits && !seed ? above - OFFSET - 8 : null);
    // The filter takes the keys typed after opening, every time it opens.
    wantFocus.current = true;
    moved.current = false;
    pointed.current = false;
    openedAt.current = performance.now();
    stirred.current = false;
    focusFilter();
    requestAnimationFrame(focusFilter);
  }, [props.open, props.box]);

  /**
   * Fixes the height of a menu that hangs above its field: what it lists,
   * up to 360 px and the room above the field (`room`; null: below it).
   */
  function fit(room = placed.side === 'top' && placed.short === null && !placed.seeded ? (props.box.current?.getBoundingClientRect().top ?? 0) - ceiling() - OFFSET - 8 : null) {
    setHeight(null);
    if (room === null) {
      return;
    }
    let tries = 0;
    const measure = () => {
      const element = content.current;
      const scroller = list.current;
      if (element && scroller) {
        // Its rows whole, whatever room Radix has given it so far.
        const natural = element.offsetHeight - scroller.clientHeight + scroller.scrollHeight;
        setHeight(Math.max(0, Math.min(360, room, natural)));
      } else if (++tries < 30) {
        requestAnimationFrame(measure);
      }
    };
    requestAnimationFrame(measure);
  }

  function focusFilter() {
    const input = filterField.current;
    if (input) {
      wantFocus.current = false;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  // A frame resized across the short-frame line leaves the menu where it no
  // longer fits: it closes at once, and the field has focus again.
  useEffect(() => {
    if (!props.open) {
      return;
    }
    const resized = () => {
      if ((window.innerHeight <= SHORT_FRAME) !== shortFrame.current) {
        flushSync(() => setGone(true));
        props.onClose('resize');
      }
    };
    window.addEventListener('resize', resized);
    return () => window.removeEventListener('resize', resized);
  }, [props]);

  const items = props.open ? props.items(filter, level) : [];
  const inLevel = level !== null && filter.trim() === '';
  const rows: MenuItem[] = inLevel
    ? [{ key: '#back', label: `Back to ${props.typeLabel}`, run: () => back() }, ...items]
    : items;
  const index = Math.min(active, Math.max(0, rows.length - 1));
  const at = rows[index];

  function open(next: string) {
    pointed.current = false;
    setLevel(next);
    setActive(1);
    fit();
    // A level starts at its top, with its way back in sight.
    if (list.current) {
      list.current.scrollTop = 0;
    }
  }
  function back() {
    pointed.current = false;
    const from = level;
    setLevel(null);
    setFilter('');
    fit();
    // Back on the level that was open.
    const top = props.items('', null);
    setActive(Math.max(0, top.findIndex((row) => row.level === from)));
  }
  function run(row: MenuItem | undefined) {
    if (!row) {
      return;
    }
    if (row.level) {
      open(row.level);
    } else if (pickable(row)) {
      row.run?.();
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const move = (to: number) => {
      event.preventDefault();
      moved.current = true;
      pointed.current = false;
      setActive((to + rows.length) % Math.max(1, rows.length));
    };
    if (event.key === 'ArrowDown') {
      move(index + 1);
    } else if (event.key === 'ArrowUp') {
      move(index - 1);
    } else if (event.key === 'Home' && filter === '') {
      move(0);
    } else if (event.key === 'End' && filter === '') {
      move(rows.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(at);
    } else if (event.key === '{' && filter === '' && props.onBrace) {
      event.preventDefault();
      props.onBrace();
    } else if (event.key === 'ArrowRight' && at?.level && event.currentTarget.selectionStart === filter.length) {
      event.preventDefault();
      open(at.level);
    } else if (event.key === 'ArrowLeft' && level !== null && filter === '') {
      event.preventDefault();
      back();
    }
  };

  // A list with more below than it shows fades at its end.
  const cue = () => {
    const element = list.current;
    element?.toggleAttribute(
      'data-more',
      element.scrollTop + element.clientHeight < element.scrollHeight - 1,
    );
  };
  // The list mounts a render after the menu opens (a portal), and gets its
  // height when the menu is placed: watched from when it is there.
  const watch = useRef<ResizeObserver | null>(null);
  const listRef = useCallback((element: HTMLDivElement | null) => {
    list.current = element;
    watch.current?.disconnect();
    // Sized by the room Radix gives it after it mounts: the active row is
    // brought into sight again then.
    watch.current = element
      ? new ResizeObserver(() => {
          showActive.current();
          cue();
        })
      : null;
    watch.current?.observe(element!);
  }, []);
  useEffect(cue, [filter, level]);
  // Rows pinned under the filter: the active row is brought into sight
  // below them.
  const pinRef = useCallback((element: HTMLDivElement | null) => {
    const scroller = element?.parentElement ?? list.current;
    if (scroller) {
      scroller.style.scrollPaddingTop = element ? `${element.offsetHeight + 4}px` : '';
    }
  }, []);
  // The active row stays in sight as the arrows move; the first row of a
  // group brings its heading along.
  const showActive = useRef(() => {});
  showActive.current = () => {
    const item = document.getElementById(`${menuId}-${index}`);
    const group = item?.parentElement?.closest('[role="group"]');
    const lead = group?.querySelector('[role="option"]') === item ? group : item;
    // On opening, an active entry in sight from the top keeps the rows above
    // it, such as "Add words or fields", in sight too.
    const fromTop = item && list.current ? item.getBoundingClientRect().bottom - list.current.getBoundingClientRect().top + list.current.scrollTop : Infinity;
    if (list.current && (index === 0 || (!moved.current && fromTop <= list.current.clientHeight - 12))) {
      list.current.scrollTop = 0;
      // As it opens with the active row in sight, the list starts at its
      // top: its first heading whole, never nudged under the header.
      if (!moved.current) {
        return;
      }
    } else {
      reveal(lead);
    }
    // The entry below the last whole one shows a sliver: a cue that the
    // list goes on, never a clean edge that looks like its end.
    const element = list.current;
    if (element && item) {
      const view = element.getBoundingClientRect();
      const rows = [...element.querySelectorAll('[role="option"]')].map((one) => one.getBoundingClientRect());
      const next = rows.find((one) => one.bottom > view.bottom + 0.5);
      const shown = next ? view.bottom - next.top : 12;
      const active = item.getBoundingClientRect();
      // Never so far that a group's first row loses its heading.
      if (shown < 12 && (lead ?? item).getBoundingClientRect().top - view.top >= 12 - shown) {
        // Up a little: the next entry comes into sight.
        element.scrollTop += 12 - shown;
      } else if (shown < 12) {
        // Down a little: the last whole entry becomes the one cut.
        const last = rows.filter((one) => one.bottom <= view.bottom + 0.5).at(-1);
        const by = last ? view.bottom - last.bottom + 12 : 0;
        if (last && last.top > active.bottom && active.bottom + by <= view.bottom) {
          element.scrollTop -= by;
        }
      }
      // As it opens, a row cut at the top by less than the peek can spare is
      // shown whole; once the arrows move, the active row keeps clear of the
      // fade instead.
      const now = [...element.querySelectorAll('[role="option"]')].map((one) => one.getBoundingClientRect());
      const cut = now.find((one) => one.top < view.top - 0.5 && one.bottom > view.top + 0.5);
      const below = now.find((one) => one.bottom > view.bottom + 0.5);
      const hidden = cut ? view.top - cut.top : 0;
      if (!moved.current && cut && (!below || view.bottom - below.top - hidden >= 12)) {
        element.scrollTop -= hidden;
      }
    }
  };
  useEffect(() => {
    // Not when the pointer set it: the row stays under the pointer.
    if (props.open && !pointed.current) {
      showActive.current();
    }
  }, [index, props.open, menuId, level]);

  // Rows by group, in order; groups by index: a name may hold anything. In a
  // level, no headings.
  const groups: { name?: string; index: number; rows: { row: MenuItem; at: number }[] }[] = [];
  rows.forEach((row, at) => {
    const name = inLevel ? undefined : row.group;
    const last = groups.at(-1);
    if (last && last.name === name) {
      last.rows.push({ row, at });
    } else {
      groups.push({ name, index: groups.length, rows: [{ row, at }] });
    }
  });

  return (
    <Popover.Root
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose('away');
        }
      }}
    >
      <Popover.Anchor
        className="seo-template-anchor"
        virtualRef={frameTop.current ? frameTop : undefined}
      />
      <Popover.Content
        className="seo-menu"
        id={props.id}
        role="dialog"
        aria-label={props.name}
        // Closed, it is gone at once: a menu still closing would take the
        // next Escape, or focus, from what comes after it.
        data-gone={gone || !props.open || undefined}
        data-readonly={props.readOnly || undefined}
        align={placed.align}
        side={placed.side}
        avoidCollisions={false}
        sideOffset={placed.short !== null ? 0 : OFFSET}
        collisionPadding={{ top: 8, right: 8, left: 8, bottom: placed.bottom }}
        // Below its field it grows with its rows, up to the room there, and
        // the filter stays put. Above it, and in a short frame, it keeps the
        // room it has: filtering never moves the filter.
        data-fixed={placed.short !== null || (placed.side === 'top' && placed.seeded) || undefined}
        style={{
          ...(placed.short !== null ? { width: placed.short } : {}),
          ...(height !== null ? { height } : {}),
        }}
        ref={content}
        // Placed and grown to its size: the active row in sight again.
        onAnimationEnd={() => props.open && showActive.current()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusFilter();
        }}
        // The box it hangs from, or the button that opened it, opens it: a
        // press there is never "away", also not for a menu still closing.
        onInteractOutside={(event) => {
          const target = event.target instanceof Node ? event.target : null;
          if (target && (props.box.current?.contains(target) || props.opener.current?.contains(target))) {
            event.preventDefault();
          }
        }}
        // A closing menu takes no keys: the next key after Escape reaches
        // the field, which has focus at once.
        {...(props.open ? {} : { inert: '' })}
        onEscapeKeyDown={() => {
          props.opener.current?.focus();
          props.onClose('escape');
        }}
        onCloseAutoFocus={(event) => {
          // Back to the opener, unless focus has already moved on (a pick
          // gave it to the box at once; a Tab or a click may have taken it).
          event.preventDefault();
          // Opened again before the last closing was done (Escape, then at
          // once Alt+Down): its filter keeps focus.
          if (isOpen.current) {
            return;
          }
          const focused = document.activeElement;
          // Never from another menu opened meanwhile.
          if (!focused || focused === document.body || content.current?.contains(focused)) {
            props.opener.current?.focus();
          }
        }}
      >
        <div className="seo-menu-filter">
          <MagnifyingGlassIcon aria-hidden />
          <input
            ref={filterRef}
            placeholder={props.filterLabel}
            dir="auto"
            aria-label={props.filterLabel}
            aria-controls={menuId}
            aria-activedescendant={at ? `${menuId}-${index}` : undefined}
            value={filter}
            onChange={(event) => {
              pointed.current = false;
              setFilter(event.target.value);
              setActive(first(props.items(event.target.value, event.target.value.trim() ? null : level)) + (level !== null && !event.target.value.trim() ? 1 : 0));
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        {props.header && !inLevel && (
          <div className="seo-menu-where" id={`${menuId}-where`}>
            {props.header}
          </div>
        )}
        {inLevel && (
          <div className="seo-menu-level" role="heading" aria-level={2}>
            {props.levelTitle?.(level!) ?? level}
          </div>
        )}
        <div
          className="seo-menu-list"
          ref={listRef}
          role="listbox"
          id={menuId}
          aria-label={inLevel ? (props.levelTitle?.(level!) ?? level!) : props.name}
          aria-describedby={props.header && !inLevel ? `${menuId}-where` : undefined}
          onScroll={cue}
        >
          {groups.map((group) => {
            const options = group.rows.map(({ row, at }) => {
              const sub = row.disabled ?? row.sub;
              return (
                <div
                  key={row.key}
                  id={`${menuId}-${at}`}
                  role="option"
                  // Focusable, as options are, though the filter keeps focus.
                  tabIndex={-1}
                  aria-selected={row.current || false}
                  aria-disabled={!pickable(row) && !row.level ? true : undefined}
                  // What it shows: its label and hint, and its value as cut
                  // there.
                  aria-label={`${row.label}${row.hint ? `, ${row.hint}` : ''}${sub ? `, ${clip(sub, ENTRY_CHARS)}` : ''}`}
                  className="seo-menu-item"
                  data-kind={row.key === '#back' ? 'back' : row.level ? 'level' : undefined}
                  data-quiet={row.quiet || undefined}
                  data-active={at === index || undefined}
                  data-disabled={!pickable(row) && !row.level ? '' : undefined}
                  // A pointer that moves picks; a menu that opens under a
                  // still pointer keeps its first entry, and the second click
                  // of a double-click picks nothing, wherever it lands.
                  onMouseMove={(event) => {
                    // A still pointer under a menu that appeared gets no
                    // movement.
                    if (event.movementX || event.movementY) {
                      stirred.current = true;
                    }
                    if (at !== index) {
                      pointed.current = true;
                      setActive(at);
                    }
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) =>
                    event.detail <= 1 &&
                    (stirred.current || event.timeStamp - openedAt.current > DOUBLE_CLICK_MS) &&
                    run(row)
                  }
                >
                  <span>
                    {row.key === '#back' && <ChevronLeftIcon aria-hidden />}
                    <span dir="auto">{row.label}</span>
                    {row.hint && <span className="seo-menu-via">· {row.hint}</span>}
                    {row.current && <CheckIcon aria-hidden data-check="" />}
                    {row.level && <ChevronRightIcon aria-hidden />}
                  </span>
                  {/* A space between label and value: its name holds what it shows. */}{' '}
                  {sub && (
                    <span
                      data-empty={row.subEmpty || row.disabled ? '' : undefined}
                      dir={row.disabled ? undefined : 'auto'}
                      title={sub}
                    >
                      {clip(sub, ENTRY_CHARS)}
                    </span>
                  )}
                </div>
              );
            });
            const id = `${menuId}-g-${group.index}`;
            // Each group's options are a group named by its heading, as
            // assistive technology reads them; rows that are not values
            // come after a line. The first rows, when they are steps on the
            // whole value, stay under the filter.
            const pinned = group.index === 0 && group.name === '' && group.rows.every(({ row }) => row.pin);
            return pinned ? (
              <div key={id} role="presentation" className="seo-menu-pinned" ref={pinRef}>
                {options}
              </div>
            ) : group.name ? (
              <div key={id} role="group" aria-labelledby={id}>
                <div className="seo-menu-group" id={id}>
                  {group.name}
                </div>
                {options}
              </div>
            ) : (
              <Fragment key={id}>
                {/* A line only between rows: never under the filter. */}
                {group.name === '' && group.index > 0 && <div className="seo-menu-sep" aria-hidden />}
                {options}
              </Fragment>
            );
          })}
        </div>
        {/* Said as it changes: a filter that matches nothing. */}
        <p className="seo-menu-none" role="status">
          {rows.length === 0 ? props.empty(filter) : ''}
        </p>
        {props.footer && <div className="seo-menu-foot">{props.footer}</div>}
        {/* Hidden in a short frame and at 200 % zoom (styles.css). */}
        <div className="seo-menu-hint" aria-hidden>
          <span>
            <kbd className="seo-kbd">↑</kbd>
            <kbd className="seo-kbd">↓</kbd>move
          </span>
          {/* A row that only says why it can't be picked takes no Enter. */}
          {(at ? pickable(at) || !!at.level : !props.readOnly) && (
            <span>
              <kbd className="seo-kbd">↵</kbd>
              {at?.level ? 'open' : at && !at.key.startsWith('#') ? (props.verb ?? 'link') : 'choose'}
            </span>
          )}
          <span>
            <kbd className="seo-kbd">esc</kbd>close
          </span>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
