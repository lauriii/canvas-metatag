import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { Popover } from '@radix-ui/themes';
import {
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useApp } from '../App';
import {
  chipsIn,
  dateText,
  displayLabels,
  insertChip,
  removeChip,
  seedCaret,
  seedTitle,
  toDisplay,
  toStored,
  tokenGroups,
  tokensIn,
  wholeChips,
} from '../model';
import type { TokenInfo } from '../types';
import { BracesIcon, IconBtn, reveal } from './ui';

/** A value as the menu and the chip tooltip show it: dates in words. */
function shown(token: TokenInfo): string {
  return token.type === 'datetime' ? dateText(token.value) : token.value;
}

/**
 * A native, auto-growing textarea with a mirror layer behind it. The
 * textarea holds each dynamic value as its label in braces; the mirror paints
 * those as chips. Caret, selection, input methods and screen readers stay
 * native because the textarea is the only editable thing. Storage only ever
 * sees {name}: toDisplay() and toStored() convert.
 */
export function TemplateInput(props: {
  id: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  lang?: string;
  /** The stored template; '' when nothing is stored. */
  value: string;
  onChange(stored: string): void;
  /** What the field inherits, resolved; shown in gray while nothing is stored. */
  inherited?: string;
  /** Where the inherited value comes from, for assistive technology. */
  inheritedFrom?: string;
  /** The inherited value as a template: its values show as gray chips. */
  pattern?: string;
  /** The values this field may use. */
  tokens: Record<string, TokenInfo>;
  /** Offer the content type's fields (template scope). */
  fields?: boolean;
  multiline?: boolean;
  /** The inherited pattern of a page title: the first input keeps its suffix. */
  seed?: string;
  /** The insert button: always shown, shown on focus (page scope), or none. */
  insert?: 'always' | 'focus' | false;
  /** A trailing button after the insert button: Suggest. */
  trailing?: ReactNode;
  onBlur?(event: FocusEvent<HTMLTextAreaElement>): void;
  onKeyDown?(event: KeyboardEvent<HTMLTextAreaElement>): void;
}) {
  const { dispatch, state } = useApp();
  const { tokens } = props;
  const labels = displayLabels(tokens);
  const input = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const filterField = useRef<HTMLInputElement>(null);
  // An input method composes in the field's own text; it is handed over at the end.
  const composing = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    brace: boolean;
    side: 'top' | 'bottom';
  } | null>(null);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);
  const [tip, setTip] = useState<{
    name: string;
    left: number;
    top: number;
  } | null>(null);
  const menuId = useId();
  const target = state.server?.target;
  const typeLabel = target?.scope === 'template' ? target.label : 'Page';
  const empty = `Empty for this ${
    target?.scope === 'template' ? target.label.toLowerCase() : 'page'
  }`;

  const text = draft ?? toDisplay(props.value, tokens);
  const chips = chipsIn(text, tokens);

  // Where the caret belongs after a change the field made itself.
  const caret = useRef<number | null>(null);
  const placeCaret = () => {
    const element = input.current;
    if (
      caret.current !== null &&
      element &&
      document.activeElement === element
    ) {
      element.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  };
  useLayoutEffect(placeCaret);

  /**
   * Hands over a new display text. `at`: the caret, in that text. `chosen`:
   * a value was picked from the menu, which seeds like typing does.
   */
  function change(next: string, at?: number, chosen = false) {
    let stored = toStored(next, tokens);
    if (
      props.seed !== undefined &&
      props.value === '' &&
      next !== '' &&
      // Text that brings its own values is a whole pattern, taken as written.
      (chosen || tokensIn(stored).length === 0)
    ) {
      // The first input into an inherited page title keeps the site's suffix.
      caret.current = seedCaret(props.seed, toDisplay(stored, tokens), tokens);
      stored = seedTitle(props.seed, stored);
    } else {
      const element = input.current;
      const end = at ?? element?.selectionStart ?? next.length;
      // A pasted {name} becomes its label, which moves what follows.
      const shown = toDisplay(toStored(next.slice(0, end), tokens), tokens);
      if (at !== undefined || toDisplay(stored, tokens) !== next) {
        caret.current = shown.length;
      }
    }
    props.onChange(stored);
  }

  // The filter takes the keys typed after opening. Radix focuses it only when
  // the menu mounts: reopened during its closing animation, focus would stay
  // in the field and the next keys would land there.
  useEffect(() => {
    if (menu) {
      filterField.current?.focus();
    }
  }, [menu]);

  function openMenu(brace: boolean) {
    setFilter('');
    setActive(0);
    // The side is chosen once: filtering never flips the menu over the field.
    const rect = box.current?.getBoundingClientRect();
    const below = rect ? window.innerHeight - rect.bottom : Infinity;
    const above = rect?.top ?? 0;
    setMenu({ brace, side: below >= 240 || below >= above ? 'bottom' : 'top' });
  }

  function insert(name: string) {
    const at = input.current?.selectionStart ?? text.length;
    const out = insertChip(text, chips, at, labels[name], !!menu?.brace);
    setMenu(null);
    setDraft(null);
    change(out.text, out.caret, true);
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    props.onKeyDown?.(event);
    if (composing.current) {
      return;
    }
    const element = event.currentTarget;
    const { selectionStart: start, selectionEnd: end } = element;
    if (event.key === 'Enter' && !props.multiline) {
      // Single-line fields wrap visually and never break.
      event.preventDefault();
    } else if (
      (event.key === 'Backspace' || event.key === 'Delete') &&
      start === end
    ) {
      // A chip is removed whole, never corrupted.
      const out = removeChip(text, chips, start, event.key);
      if (out) {
        event.preventDefault();
        change(out.text, out.caret);
        dispatch({ type: 'flash', flash: `Removed ${out.label}` });
      }
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      start === end
    ) {
      // A character typed inside a chip goes in after it.
      // ponytail: text composed by an input method inside a chip is not
      // moved; the chip then reads as plain text in braces.
      const inside = chips.find(
        (chip) => start > chip.start && start < chip.end,
      );
      if (inside) {
        element.setSelectionRange(inside.end, inside.end);
      }
    }
  };

  // The caret steps over a chip whole: an edge that moved into one goes on
  // to its far side, in the direction it moved.
  const last = useRef({ start: 0, end: 0 });
  const onSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const { selectionStart, selectionEnd, selectionDirection } = element;
    const across = (at: number, before: number) => {
      const chip = chips.find((one) => at > one.start && at < one.end);
      return !chip || at === before
        ? at
        : at < before
          ? chip.start
          : chip.end;
    };
    let start = across(selectionStart, last.current.start);
    let end = across(selectionEnd, last.current.end);
    if (start > end) {
      [start, end] = [end, end];
    }
    // A selection never ends inside a chip, so cut, paste and typing over it keep chips whole.
    [start, end] = wholeChips(chips, start, end);
    last.current = { start, end };
    if (start !== selectionStart || end !== selectionEnd) {
      element.setSelectionRange(start, end, selectionDirection ?? 'none');
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    // Plain text; a single-line field takes line breaks as spaces.
    // ponytail: a paste is not a step in the browser's own undo history.
    event.preventDefault();
    const element = event.currentTarget;
    let pasted = event.clipboardData.getData('text/plain');
    if (!props.multiline) {
      pasted = pasted.replace(/\s*[\r\n]+\s*/g, ' ');
    }
    let [start, end] = [element.selectionStart, element.selectionEnd];
    const inside = chips.find((chip) => start > chip.start && start < chip.end);
    if (start === end && inside) {
      start = end = inside.end;
    }
    const before = text.slice(0, start) + pasted;
    change(before + text.slice(end), before.length);
  };

  // The chip tooltip follows the pointer only, never the caret.
  const onMouseMove = (event: MouseEvent) => {
    const { clientX: x, clientY: y } = event;
    const frame = box.current?.getBoundingClientRect();
    let over: typeof tip = null;
    for (const span of mirror.current?.querySelectorAll<HTMLElement>(
      '[data-name]',
    ) ?? []) {
      const rect = Array.from(span.getClientRects()).find(
        (one) =>
          x >= one.left && x <= one.right && y >= one.top && y <= one.bottom,
      );
      if (rect && frame) {
        over = {
          name: span.dataset.name!,
          left: rect.left - frame.left,
          top: rect.top - frame.top,
        };
        break;
      }
    }
    if (over?.name !== tip?.name || over?.top !== tip?.top) {
      setTip(over);
    }
  };

  // The insert menu: the content type's fields first, then the page, then the site.
  const groups = tokenGroups(tokens, !!props.fields)
    .sort((a, b) => Number(b.label === 'FIELDS') - Number(a.label === 'FIELDS'))
    .map((group) => ({
      ...group,
      label:
        group.label === 'FIELDS'
          ? typeLabel
          : group.label[0] + group.label.slice(1).toLowerCase(),
      names: group.names.filter((name) =>
        labels[name].toLowerCase().includes(filter.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.names.length > 0);
  const found = groups.flatMap((group) => group.names);

  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = active + (event.key === 'ArrowDown' ? 1 : -1);
      setActive((next + found.length) % Math.max(1, found.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (found[active]) {
        insert(found[active]);
      }
    }
  };
  // The active row stays in sight as the arrows move.
  useEffect(() => {
    if (menu && found[active]) {
      reveal(document.getElementById(`${menuId}-${found[active]}`));
    }
  }, [active, menu, found[active], menuId]);

  // The mirror: the same text, with each chip wrapped.
  const paint = (shown: string) => {
    const pieces: ReactNode[] = [];
    let at = 0;
    for (const chip of chipsIn(shown, tokens)) {
      pieces.push(shown.slice(at, chip.start));
      pieces.push(
        <span
          key={chip.start}
          className="seo-chip"
          data-name={chip.name}
          data-empty={tokens[chip.name].value.trim() === '' || undefined}
        >
          <span className="seo-brace">{'{'}</span>
          {chip.label}
          <span className="seo-brace">{'}'}</span>
        </span>,
      );
      at = chip.end;
    }
    pieces.push(shown.slice(at));
    return pieces;
  };

  const tipToken = tip && tokens[tip.name];
  const insertable = props.insert !== false && !props.disabled;
  const trail = (insertable ? 1 : 0) + (props.trailing ? 1 : 0);

  return (
    <div className="seo-template">
      <Popover.Root
        open={menu !== null}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          // Left without a value: the typed brace goes with the menu, and
          // was never saved.
          if (menu?.brace && !composing.current) {
            setDraft(null);
          }
          setMenu(null);
        }}
      >
        <div
          className="seo-template-box"
          ref={box}
          data-trail={trail || undefined}
          data-multiline={props.multiline || undefined}
          data-disabled={props.disabled || undefined}
          data-invalid={props.invalid || undefined}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setTip(null)}
        >
          {/* The menu opens against the whole box. */}
          <Popover.Anchor className="seo-template-anchor" />
          <div className="seo-template-mirror" ref={mirror} aria-hidden>
            {text === '' && props.inherited ? (
              <span className="seo-inherited" lang={props.lang}>
                {props.pattern && tokensIn(props.pattern).length
                  ? paint(toDisplay(props.pattern, tokens))
                  : props.inherited}
              </span>
            ) : (
              paint(text)
            )}
            {/* So that a trailing line break has a line of its own. */}
            {'​'}
          </div>
          <textarea
            ref={input}
            id={props.id}
            rows={1}
            lang={props.lang}
            spellCheck
            value={text}
            placeholder={props.inherited}
            disabled={props.disabled}
            aria-required={props.required || undefined}
            aria-invalid={props.invalid || undefined}
            aria-describedby={props.describedBy}
            aria-description={
              text === '' && props.inheritedFrom
                ? `Inherited from ${props.inheritedFrom}.`
                : chips.length > 0
                  ? 'Values in braces are filled in automatically.'
                  : undefined
            }
            onChange={(event) => {
              const next = event.target.value;
              if (composing.current) {
                setDraft(next);
                return;
              }
              const native = event.nativeEvent as InputEvent;
              if (native.inputType === 'insertText' && native.data === '{') {
                // The brace is the field's own until a value is chosen or
                // the menu is left: nothing is seeded or saved meanwhile.
                setDraft(next);
                openMenu(true);
                return;
              }
              setDraft(null);
              change(next);
            }}
            onCompositionStart={() => {
              composing.current = true;
              setDraft(text);
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              setDraft(null);
              change(event.currentTarget.value);
            }}
            onKeyDown={onKeyDown}
            onSelect={onSelect}
            onPaste={onPaste}
            onFocus={placeCaret}
            onBlur={(event) => props.onBlur?.(event)}
          />
          {trail > 0 && (
            <div className="seo-trail">
              {insertable && (
                <IconBtn
                  label="Insert value"
                  tip="Insert value  {"
                  side="bottom"
                  aria-haspopup="menu"
                  aria-expanded={menu !== null}
                  data-on-focus={props.insert === 'focus' || undefined}
                  // The field keeps its focus and its caret.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openMenu(false)}
                >
                  <BracesIcon />
                </IconBtn>
              )}
              {props.trailing}
            </div>
          )}
          {tip && tipToken && (
            <span
              className="seo-chip-tip"
              style={{ left: tip.left, top: tip.top }}
              aria-hidden
            >
              {shown(tipToken).trim()
                ? `${labels[tip.name]}: ${shown(tipToken)}`
                : empty}
            </span>
          )}
        </div>
        <Popover.Content
          className="seo-menu"
          aria-label="Insert a value"
          align="start"
          side={menu?.side ?? 'bottom'}
          avoidCollisions={false}
          sideOffset={6}
          collisionPadding={8}
          onCloseAutoFocus={(event) => {
            // Back to the field, with its caret where it was.
            event.preventDefault();
            input.current?.focus();
          }}
        >
          <div className="seo-menu-filter">
            <MagnifyingGlassIcon aria-hidden />
            <input
              ref={filterField}
              placeholder="Filter values"
              aria-label="Filter values"
              aria-controls={menuId}
              aria-activedescendant={
                found[active] ? `${menuId}-${found[active]}` : undefined
              }
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setActive(0);
              }}
              onKeyDown={onMenuKeyDown}
            />
          </div>
          <div
            className="seo-menu-list"
            role="menu"
            id={menuId}
            aria-label="Values"
          >
            {groups.map((group) => (
              <div
                key={group.label}
                role="group"
                aria-labelledby={`${menuId}-g-${group.label}`}
              >
                <div
                  className="seo-menu-group"
                  id={`${menuId}-g-${group.label}`}
                >
                  {group.label}
                </div>
                {group.names.map((name) => {
                  const value = shown(tokens[name]).trim();
                  return (
                    <div
                      key={name}
                      id={`${menuId}-${name}`}
                      role="menuitem"
                      tabIndex={-1}
                      className="seo-menu-item"
                      data-active={found[active] === name || undefined}
                      onMouseEnter={() => setActive(found.indexOf(name))}
                      onClick={() => insert(name)}
                    >
                      <span>{labels[name]}</span>
                      <span data-empty={!value || undefined}>
                        {value || empty}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
            {found.length === 0 && (
              <p className="seo-menu-none">No value with that name.</p>
            )}
          </div>
          <div className="seo-menu-hint" aria-hidden>
            <span>
              <kbd className="seo-kbd">↑</kbd>
              <kbd className="seo-kbd">↓</kbd>move
            </span>
            <span>
              <kbd className="seo-kbd">↵</kbd>insert
            </span>
            <span>
              <kbd className="seo-kbd">esc</kbd>close
            </span>
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
