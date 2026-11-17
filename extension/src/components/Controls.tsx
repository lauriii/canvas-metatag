// The controls of the newer value shapes: codes and short lists, durations
// and opening hours. Each takes a value as text and gives text back, like
// every input of a detail (InputProps).
import { CheckIcon, ChevronDownIcon, PlusIcon, Cross2Icon } from '@radix-ui/react-icons';
import { CheckboxGroup, Popover, Select } from '@radix-ui/themes';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  ALL_DAY,
  DAYS,
  DAY_WORDS,
  type Choice,
  type Day,
  type Range,
  type Week,
  canCopyMonday,
  durationSlots,
  durationValue,
  filterChoices,
  formatHours,
  hoursLine,
  parseHours,
  rangesError,
  toggleSaid,
} from '../controls';
import { Guide } from './Field';
import { Btn, IconBtn } from './ui';
import type { InputProps } from './Value';

/** Several choices, in place: commits on each toggle. */
export function CheckRows(props: InputProps & { label: string; choices: Choice[] }) {
  const chosen = props.value ? props.value.split(',') : [];
  const [said, setSaid] = useState('');
  return (
    <>
      <CheckboxGroup.Root
        className="seo-check-rows"
        aria-label={props.label}
        aria-describedby={props.describedBy}
        disabled={props.disabled}
        value={chosen}
        onValueChange={(next) => {
          // In the options' order, whatever order they were ticked in.
          const ordered = props.choices.map((choice) => choice.value).filter((value) => next.includes(value));
          const toggled = props.choices.find((choice) => next.includes(choice.value) !== chosen.includes(choice.value));
          props.set(ordered.length ? ordered.join(',') : undefined);
          if (toggled) {
            setSaid(toggleSaid(toggled.label, next.includes(toggled.value), ordered.length));
          }
        }}
      >
        {props.choices.map((choice) => (
          <CheckboxGroup.Item key={choice.value} value={choice.value}>
            {choice.label}
          </CheckboxGroup.Item>
        ))}
      </CheckboxGroup.Root>
      <span className="seo-visually-hidden" aria-live="polite">
        {said}
      </span>
    </>
  );
}

/**
 * A searchable list of choices, from a box that reads the chosen ones. With
 * `many`, checkbox rows that commit on each toggle; else one choice.
 */
export function Picker(props: InputProps & {
  label: string;
  /** "country": the filter is "Find a country". */
  noun: string;
  choices: Choice[];
  many?: boolean;
  max?: number;
  suggested?: string[];
  /** What the box reads while nothing is chosen: "Site currency: Euro". */
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [said, setSaid] = useState('');
  // The side it opens on, kept while it is open: filtering or a tick never
  // moves the filter away from where the editor looks.
  const [side, setSide] = useState<'top' | 'bottom'>('bottom');
  // While the filter has focus, Enter picks the first row: it is shown.
  const [filtering, setFiltering] = useState(false);
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const chosen = props.value ? props.value.split(',') : [];
  // The order is set when the list opens and kept while it is open: a
  // toggle never moves the row the keyboard is on.
  const [first, setFirst] = useState<string[]>([]);
  const byValue = useMemo(() => new Map(props.choices.map((choice) => [choice.value, choice])), [props.choices]);
  const found = filterChoices(props.choices, query, open ? first : [...chosen, ...(props.suggested ?? [])]);
  const shown = chosen.map((value) => byValue.get(value)?.label ?? value);
  const max = props.max ?? 50;
  const toggle = (choice: Choice) => {
    if (!props.many) {
      props.set(choice.value === props.value ? undefined : choice.value);
      setOpen(false);
      // The filter goes with the list: the box takes focus back.
      requestAnimationFrame(() => trigger.current?.focus());
      return;
    }
    const on = !chosen.includes(choice.value);
    if (on && chosen.length >= max) {
      setSaid(`Up to ${max}`);
      return;
    }
    const next = on ? [...chosen, choice.value] : chosen.filter((value) => value !== choice.value);
    props.set(next.length ? next.join(',') : undefined);
    setSaid(toggleSaid(choice.label, on, next.length));
  };
  return (
    <Popover.Root open={open} onOpenChange={(next) => {
      if (next && trigger.current) {
        // The side with room for the filter, the foot and a few rows; in a
        // short window the box first scrolls to the top to make that room.
        const need = 200;
        let box = trigger.current.getBoundingClientRect();
        if (window.innerHeight - box.bottom < need && box.top < need) {
          trigger.current.scrollIntoView({ block: 'start' });
          box = trigger.current.getBoundingClientRect();
        }
        setSide(window.innerHeight - box.bottom >= need || window.innerHeight - box.bottom >= box.top ? 'bottom' : 'top');
      }
      setOpen(next);
      if (next) {
        setFirst([...chosen, ...(props.suggested ?? [])]);
      } else {
        setQuery('');
      }
    }}>
      <Popover.Trigger>
        <button
          ref={trigger}
          id={props.id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="seo-select-box seo-picker-box"
          aria-describedby={props.describedBy}
          aria-invalid={props.invalid || undefined}
          disabled={props.disabled}
          onKeyDown={props.onKeyDown}
        >
          <span className={shown.length ? undefined : 'seo-muted'}>{shown.length ? shown.join(', ') : (props.placeholder ?? 'Not set')}</span>
          <ChevronDownIcon aria-hidden />
        </button>
      </Popover.Trigger>
      {/* Never taller than the room on its side: its filter stays in sight
          and only the list scrolls. */}
      <Popover.Content className="seo-picker" side={side} avoidCollisions={false} align="start" collisionPadding={8} aria-label={props.label}>
        <input
          className="seo-input"
          type="search"
          aria-label={`Find a ${props.noun}`}
          placeholder={`Find a ${props.noun}`}
          aria-controls={listId}
          aria-activedescendant={filtering && found[0] ? `${listId}-0` : undefined}
          value={query}
          autoFocus
          onFocus={() => setFiltering(true)}
          onBlur={() => setFiltering(false)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && found[0]) {
              event.preventDefault();
              toggle(found[0]);
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              document.getElementById(listId)?.querySelector<HTMLElement>('[role="option"]')?.focus();
            }
          }}
        />
        <div id={listId} role="listbox" aria-multiselectable={props.many || undefined} aria-label={props.label} className="seo-picker-list">
          {found.length === 0 && <p className="seo-muted">No {props.noun} matches “{query}”.</p>}
          {found.map((choice, at) => {
            const on = chosen.includes(choice.value);
            const suggested = query === '' && (props.suggested ?? []).includes(choice.value) && !on;
            const afterSuggested = query === '' && at > 0 && (props.suggested ?? []).includes(found[at - 1].value) && !suggested;
            return (
              <div
                key={choice.value}
                id={`${listId}-${at}`}
                role="option"
                tabIndex={-1}
                aria-selected={on}
                className="seo-picker-row"
                data-active={(filtering && at === 0) || undefined}
                data-after-suggested={afterSuggested || undefined}
                onClick={() => toggle(choice)}
                onKeyDown={(event) => {
                  const rows = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
                  const at = rows.indexOf(event.currentTarget);
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
                  }
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    toggle(choice);
                  }
                }}
              >
                {/* Several may be chosen: each row has its box. */}
                <span className="seo-picker-check" data-box={props.many || undefined} aria-hidden>{on && <CheckIcon />}</span>
                <span>{choice.label}</span>
                {suggested && <span className="seo-muted">Suggested</span>}
              </div>
            );
          })}
        </div>
        {props.many && (
          <div className="seo-picker-foot">
            {chosen.length} chosen · up to {max}
          </div>
        )}
        <span className="seo-visually-hidden" aria-live="polite">
          {said}
        </span>
      </Popover.Content>
    </Popover.Root>
  );
}

/**
 * A duration: one box with two numbers, hours and minutes, empty slots for
 * none. Stores minutes, checked when focus leaves the whole box: moving
 * from hours to minutes never refuses a half-typed value.
 */
export function DurationInput(props: InputProps & { label: string }) {
  const [slots, setSlots] = useState(() => durationSlots(props.value));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  // A value set elsewhere (Undo, a link undone) is shown as it is.
  useEffect(() => setSlots(durationSlots(props.value)), [props.value]);
  const commit = () => {
    const next = durationValue(slots.hours, slots.minutes);
    setError(next.error ?? null);
    if (next.error) {
      return;
    }
    props.set(next.minutes);
    setSlots(durationSlots(next.minutes ?? ''));
  };
  const slot = (name: 'hours' | 'minutes', unit: string, words: string) => (
    <label className="seo-duration-slot">
      <input
        id={name === 'hours' ? props.id : undefined}
        className="seo-input"
        inputMode="numeric"
        aria-label={`${props.label}, ${words}`}
        aria-describedby={[props.describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        aria-invalid={props.invalid || !!error || undefined}
        disabled={props.disabled}
        value={slots[name]}
        onChange={(event) => setSlots({ ...slots, [name]: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
          }
          props.onKeyDown(event);
        }}
      />
      <span aria-hidden>{unit}</span>
    </label>
  );
  return (
    <div className="seo-duration">
      <div
        className="seo-duration-box"
        data-invalid={props.invalid || !!error || undefined}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            commit();
          }
        }}
      >
        {slot('hours', 'h', 'hours')}
        {slot('minutes', 'min', 'minutes')}
      </div>
      {error && (
        <Guide id={errorId} tone="error">
          {error}
        </Guide>
      )}
    </div>
  );
}

type Status = 'open' | 'closed' | 'all';

/** A special day by its visible date: "24 Dec 2026". */
const dayName = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const statusOf = (ranges: Range[] | undefined): Status =>
  !ranges?.length ? 'closed' : ranges.length === 1 && ranges[0][0] === ALL_DAY[0] && ranges[0][1] === ALL_DAY[1] ? 'all' : 'open';

/**
 * The opening hours sheet's body: a row per day, special days apart. Each
 * change is stored when the week is valid; a day whose times overlap says
 * so and stores nothing.
 */
export function WeekEditor(props: { label: string; value: string; disabled: boolean; set(text: string | undefined): void; same?: { name: string; value: string } }) {
  const [week, setWeek] = useState<Week>(() => parseHours(props.value) ?? { weekly: {}, dated: {} });
  // Each day's times as typed: half-typed times are the row's own.
  const [drafts, setDrafts] = useState<Partial<Record<string, Range[]>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [said, setSaid] = useState('');
  const first = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // A week set elsewhere (Clear, Undo) is shown as it is.
  useEffect(() => {
    if ((props.value ?? '') !== formatHours(week)) {
      setWeek(parseHours(props.value) ?? { weekly: {}, dated: {} });
      setDrafts({});
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  // A button that takes itself away hands focus to what comes in its place.
  const focusOn = (label: string) =>
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.focus());
  const store = (next: Week) => {
    setWeek(next);
    const text = formatHours(next);
    props.set(text === '' ? undefined : text);
  };
  const setDay = (key: string, ranges: Range[] | undefined, dated = false) => {
    const error = ranges ? rangesError(ranges) : null;
    setDrafts({ ...drafts, [key]: ranges });
    setErrors({ ...errors, [key]: error ?? '' });
    if (error) {
      return;
    }
    if (dated) {
      store({ ...week, dated: { ...week.dated, [key]: ranges ?? [] } });
    } else {
      const weekly = { ...week.weekly };
      if (ranges?.length) {
        weekly[key as Day] = ranges;
      } else {
        delete weekly[key as Day];
      }
      store({ ...week, weekly });
    }
  };
  const rangesFor = (key: string, stored: Range[] | undefined) => drafts[key] ?? stored ?? [];
  const copyMonday = canCopyMonday({ ...week, weekly: { ...week.weekly, ...(drafts.Mo ? { Mo: drafts.Mo } : {}) } });
  // A day on one row: its name, its times, then its status.
  const row = (key: string, name: string, stored: Range[] | undefined, dated: boolean) => {
    const ranges = rangesFor(key, stored);
    const status = drafts[key] !== undefined ? (drafts[key]!.length ? (statusOf(drafts[key]) === 'all' ? 'all' : 'open') : statusOf(stored)) : statusOf(stored);
    const errorId = `${key}-error`;
    const statusSelect = (
        <Select.Root
          value={status}
          disabled={props.disabled}
          onValueChange={(next) =>
            next === 'closed'
              ? dated
                ? setDay(key, [], true)
                : setDay(key, undefined)
              : next === 'all'
                ? setDay(key, [[...ALL_DAY]], dated)
                : // Opened: no times are made up; the editor gives them.
                  setDrafts({ ...drafts, [key]: [['', '']] })
          }
        >
          {/* A week nobody set yet reads as Closed, in gray: nothing is open. */}
          <Select.Trigger className="seo-day-status" data-unset={!props.value && drafts[key] === undefined && status === 'closed' ? '' : undefined} aria-label={`${name} status`} />
          <Select.Content position="popper" className="seo-select-content" aria-label={`${name} status`}>
            <Select.Item value="open">Open</Select.Item>
            <Select.Item value="closed">Closed</Select.Item>
            <Select.Item value="all">Open 24 hours</Select.Item>
          </Select.Content>
        </Select.Root>
    );
    return (
      <div className="seo-day" key={key}>
        <span className="seo-day-name">{name}</span>
        {status === 'open' ? (
          <div className="seo-day-times">
            {ranges.map((range, index) => (
              <div className="seo-day-range" key={index}>
                {/* The dash starts the closing time's line when the pair wraps. */}
                <span className="seo-day-open">
                  <input
                    className="seo-input"
                    type="time"
                    aria-label={`${name}, ${index ? 'second ' : ''}opens`}
                    aria-describedby={errors[key] ? errorId : undefined}
                    disabled={props.disabled}
                    value={range[0]}
                    onChange={(event) => setDay(key, ranges.map((one, at) => (at === index ? [event.target.value, one[1]] : one)), dated)}
                  />
                </span>
                <span className="seo-day-close">
                  <span aria-hidden>–</span>
                  <input
                    className="seo-input"
                    type="time"
                    aria-label={`${name}, ${index ? 'second ' : ''}closes`}
                    aria-describedby={errors[key] ? errorId : undefined}
                    disabled={props.disabled}
                    value={range[1]}
                    onChange={(event) => setDay(key, ranges.map((one, at) => (at === index ? [one[0], event.target.value] : one)), dated)}
                  />
                </span>
                {index > 0 && (
                  <IconBtn
                    label={`Remove ${name}'s second range`}
                    size={24}
                    disabled={props.disabled}
                    onClick={() => {
                      setDay(key, ranges.slice(0, 1), dated);
                      focusOn(`Add a second range on ${name}`);
                    }}
                  >
                    <Cross2Icon aria-hidden />
                  </IconBtn>
                )}
              </div>
            ))}
            {ranges.length === 1 && (
              <IconBtn
                label={`Add a second range on ${name}`}
                size={24}
                disabled={props.disabled}
                onClick={() => {
                  setDrafts({ ...drafts, [key]: [...ranges, ['', '']] });
                  focusOn(`${name}, second opens`);
                }}
              >
                <PlusIcon aria-hidden />
              </IconBtn>
            )}
          </div>
        ) : (
          <span />
        )}
        {statusSelect}
        {key === 'Mo' && copyMonday && (
          // Under Monday, whose times it copies.
          <div className="seo-day-copy">
            <Btn
              variant="ghost"
              size={24}
              disabled={props.disabled}
              onClick={() => {
                const monday = drafts.Mo ?? week.weekly.Mo!;
                setDrafts({});
                store({ ...week, weekly: { ...week.weekly, Mo: monday, Tu: monday, We: monday, Th: monday, Fr: monday } });
                setSaid(`Tuesday to Friday set to ${monday.map(([opens, closes]) => `${opens}–${closes}`).join(', ')}`);
                focusOn('Tuesday status');
              }}
            >
              Use for Tue–Fri
            </Btn>
          </div>
        )}
        {errors[key] && (
          <div className="seo-day-error">
            <Guide id={errorId} tone="error">
              {errors[key]}
            </Guide>
          </div>
        )}
      </div>
    );
  };
  const [newDate, setNewDate] = useState('');
  const line = props.value ? hoursLine(week) : '';
  // A day being set is not what the week reads as yet: it says what it
  // waits for instead of what is stored ("Monday: add the times.").
  const waiting = Object.entries(drafts).flatMap(([key, ranges]) => {
    const error = ranges?.length ? rangesError(ranges) : null;
    return error ? [`${DAY_WORDS[key as Day] ?? dayName(key)}: ${error === 'Enter both times.' ? 'add the times.' : error.charAt(0).toLowerCase() + error.slice(1)}`] : [];
  });
  return (
    <div className="seo-week" ref={root}>
      <p className="seo-reads-as">Reads as: {waiting.length ? waiting.join(' ') : line || 'Not set'}</p>
      {props.same && props.same.value !== props.value && (
        <Btn variant="soft" ref={first} disabled={props.disabled} onClick={() => {
          const copied = parseHours(props.same!.value);
          if (copied) {
            setDrafts({});
            store(copied);
          }
        }}>
          Same as {props.same.name}
        </Btn>
      )}
      {DAYS.map((day) => row(day, DAY_WORDS[day], week.weekly[day], false))}
      <span className="seo-visually-hidden" role="status">
        {said}
      </span>
      <h3 className="seo-sheet-section">Special days</h3>
      {Object.keys(week.dated).sort().map((date) => {
        const name = dayName(date);
        return (
        <div className="seo-special" key={date}>
          {row(date, name, week.dated[date], true)}
          <IconBtn label={`Remove ${name}`} size={24} disabled={props.disabled} onClick={() => {
            const dated = { ...week.dated };
            delete dated[date];
            store({ ...week, dated });
            focusOn('A special day');
          }}>
            <Cross2Icon aria-hidden />
          </IconBtn>
        </div>
        );
      })}
      <div className="seo-special-add">
        <input className="seo-input" type="date" aria-label="A special day" value={newDate} disabled={props.disabled} onChange={(event) => setNewDate(event.target.value)} />
        <Btn variant="outline" disabled={props.disabled || !newDate || !!week.dated[newDate]} onClick={() => {
          store({ ...week, dated: { ...week.dated, [newDate]: [] } });
          setNewDate('');
          // The button is disabled once the day is added: the new day takes focus.
          focusOn(`${dayName(newDate)} status`);
        }}>
          Add a special day
        </Btn>
      </div>
    </div>
  );
}
