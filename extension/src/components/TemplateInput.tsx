import { PlusIcon } from '@radix-ui/react-icons';
import { Button, Flex, Popover, Text, TextField } from '@radix-ui/themes';
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
  lang?: string;
  /** The stored template; '' when nothing is stored. */
  value: string;
  onChange(stored: string): void;
  /** What the field inherits, resolved; shown while nothing is stored. */
  inherited?: string;
  /** The values this field may use. */
  tokens: Record<string, TokenInfo>;
  /** Offer the content type's fields (template scope). */
  fields?: boolean;
  multiline?: boolean;
  /** The inherited pattern of a page title: the first input keeps its suffix. */
  seed?: string;
  /** "+ Value" also shows without focus (template and site scope). */
  alwaysInsert?: boolean;
  /** The resolved text, shown while the field holds a chip. */
  becomes?: string;
  /** The meter or the error: the line the insert button shares. */
  status?: ReactNode;
  onFocus?(event: FocusEvent<HTMLTextAreaElement>): void;
  onBlur?(event: FocusEvent<HTMLTextAreaElement>): void;
  onKeyDown?(event: KeyboardEvent<HTMLTextAreaElement>): void;
}) {
  const { dispatch } = useApp();
  const { tokens } = props;
  const labels = displayLabels(tokens);
  const input = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const filterField = useRef<HTMLInputElement>(null);
  // An input method composes in the field's own text; it is handed over at the end.
  const composing = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState<{ brace: boolean } | null>(null);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);
  const [tip, setTip] = useState<{
    name: string;
    left: number;
    top: number;
  } | null>(null);
  const menuId = useId();

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
    setMenu({ brace });
  }

  function insert(name: string) {
    const at = input.current?.selectionStart ?? text.length;
    const out = insertChip(text, chips, at, labels[name], !!menu?.brace);
    setMenu(null);
    setDraft(null);
    change(out.text, out.caret, true);
  }

  /** The chip a point of the field is over, with where its tooltip goes. */
  function chipAt(match: (rect: DOMRect, span: number) => boolean) {
    const frame = box.current?.getBoundingClientRect();
    const spans = Array.from(
      mirror.current?.querySelectorAll<HTMLElement>('[data-name]') ?? [],
    );
    for (const [index, span] of spans.entries()) {
      const rect = Array.from(span.getClientRects()).find((one) =>
        match(one, index),
      );
      if (rect && frame) {
        return {
          name: span.dataset.name!,
          left: rect.left - frame.left,
          top: rect.top - frame.top,
        };
      }
    }
    return null;
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

  const onSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const { selectionStart, selectionEnd, selectionDirection } = element;
    // A selection never ends inside a chip, so cut, paste and typing over it keep chips whole.
    const [start, end] = wholeChips(chips, selectionStart, selectionEnd);
    if (start !== selectionStart || end !== selectionEnd) {
      element.setSelectionRange(start, end, selectionDirection ?? 'none');
    }
    const inside =
      start === end
        ? chips.findIndex((chip) => start > chip.start && start < chip.end)
        : -1;
    // The nth chip span of the mirror is the nth chip.
    setTip(inside < 0 ? null : chipAt((_, span) => span === inside));
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

  const onMouseMove = (event: MouseEvent) => {
    const { clientX: x, clientY: y } = event;
    const over = chipAt(
      (rect) =>
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
    );
    if (over?.name !== tip?.name || over?.top !== tip?.top) {
      setTip(over);
    }
  };

  // The insert menu.
  const groups = tokenGroups(tokens, !!props.fields)
    .map((group) => ({
      ...group,
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

  // The mirror: the same text, with each chip wrapped.
  const pieces: ReactNode[] = [];
  let at = 0;
  for (const chip of chips) {
    pieces.push(text.slice(at, chip.start));
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
  pieces.push(text.slice(at));

  const tipToken = tip && tokens[tip.name];
  const showInsert =
    !props.disabled && (focused || !!menu || props.alwaysInsert);
  const insertButton = showInsert && (
    <Button
      size="1"
      variant="ghost"
      className="seo-insert"
      // The field keeps its focus and its caret.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => openMenu(false)}
    >
      <PlusIcon aria-hidden />
      Value
    </Button>
  );
  const becomes = chips.length > 0 && props.becomes !== undefined && (
    <Text
      as="p"
      size="1"
      color="gray"
      className="seo-becomes"
      lang={props.lang}
    >
      Becomes: {props.becomes}
    </Text>
  );

  return (
    <div
      className="seo-template"
      // The insert button stays while focus is anywhere in the field, so Tab can reach it.
      onFocus={() => setFocused(true)}
      onBlur={(event) =>
        event.currentTarget.contains(event.relatedTarget) || setFocused(false)
      }
    >
      <Popover.Root
        open={menu !== null}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          // Left without a value: the typed brace is plain text after all.
          if (menu?.brace && draft !== null && !composing.current) {
            setDraft(null);
            change(draft);
          }
          setMenu(null);
        }}
      >
        <div
          className="seo-template-box"
          ref={box}
          data-disabled={props.disabled || undefined}
          data-invalid={props.invalid || undefined}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setTip(null)}
        >
          {/* The menu opens against the whole box. */}
          <Popover.Anchor className="seo-template-anchor" />
          <div className="seo-template-mirror" ref={mirror} aria-hidden>
            {text === '' && props.inherited ? (
              <>
                <span className="seo-inherited-tag">(inherited)</span>
                <span className="seo-inherited" lang={props.lang}>
                  {props.inherited}
                </span>
              </>
            ) : (
              pieces
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
            aria-invalid={props.invalid || undefined}
            aria-describedby={props.describedBy}
            aria-description="Values in braces are filled in automatically."
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
            onFocus={(event) => {
              placeCaret();
              props.onFocus?.(event);
            }}
            onBlur={(event) => {
              setTip(null);
              props.onBlur?.(event);
            }}
          />
          {tip && tipToken && (
            <span
              className="seo-chip-tip"
              style={{ left: tip.left, top: tip.top }}
              aria-hidden
            >
              {labels[tip.name]}:{' '}
              {shown(tipToken).trim() || 'empty for this page'}
            </span>
          )}
        </div>
        <Popover.Content
          className="seo-menu"
          aria-label="Insert a value"
          size="1"
          align="start"
          sideOffset={4}
          onCloseAutoFocus={(event) => {
            // Back to the field, with its caret where it was.
            event.preventDefault();
            input.current?.focus();
          }}
        >
          <TextField.Root
            ref={filterField}
            size="2"
            placeholder="Filter values…"
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
          <div
            className="seo-menu-list"
            role="menu"
            id={menuId}
            aria-label="Values"
          >
            {groups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label}>
                <Text as="div" size="1" className="seo-group-label" aria-hidden>
                  {group.label}
                </Text>
                {group.names.map((name) => (
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
                    <Text size="2">{labels[name]}</Text>
                    <Text size="1" color="gray" truncate>
                      {shown(tokens[name])}
                    </Text>
                  </div>
                ))}
              </div>
            ))}
            {found.length === 0 && (
              <Text as="p" size="1" color="gray" m="2">
                No value with that name.
              </Text>
            )}
          </div>
        </Popover.Content>
      </Popover.Root>
      {props.status || becomes || (insertButton && props.alwaysInsert) ? (
        <>
          <Flex className="seo-template-under" justify="between" gap="3">
            {props.status ?? (becomes || <span />)}
            {insertButton}
          </Flex>
          {props.status && becomes}
        </>
      ) : (
        // No line to share and only while focused: the button sits in the gap
        // under the field, so focusing it does not move what follows.
        insertButton && <div className="seo-insert-float">{insertButton}</div>
      )}
    </div>
  );
}
