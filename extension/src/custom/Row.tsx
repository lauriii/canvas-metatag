/**
 * One value of a hand-added item, with a control that keeps its shape.
 *
 * The control comes from what the detail expects and the value's own JSON
 * shape; the shape wins, so nothing is converted until it is edited: a
 * pasted "4.2" stays text, "85%" stays text. Addresses are text inputs. On
 * a template a value can be linked to a field of the item being output.
 */
import { DotsHorizontalIcon, Link2Icon } from '@radix-ui/react-icons';
import { DropdownMenu } from '@radix-ui/themes';
import { type ReactNode, useId, useRef, useState } from 'react';
import { fits, kinds } from '../features';
import type { ExpectsSpec, SearchFeatures } from '../types';
import type { Path, Problem } from './doc';
import { typeLabel, typesOf } from './project';

/** "an organization", "a person or organization", "a number, like 4.2". */
export function describeExpects(spec: ExpectsSpec | ''): string {
  if (spec === '') return '';
  const parts = kinds(typeof spec === 'string' ? spec : spec.is).map(([kind, names]) => {
    switch (kind) {
      case 'text':
        return 'text';
      case 'number':
        return 'a number, like 4.2';
      case 'url':
        return 'a full address, like https://…';
      case 'date':
        return 'a date, like 2026-11-13';
      case 'datetime':
        return 'a date and time';
      case 'duration':
        return 'a duration, like PT1H30M';
      case 'bool':
        return 'yes or no';
      case 'enum':
        return `one of ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`;
      case 'item':
        return shapeWords(names);
      default:
        return kind;
    }
  });
  // A number or text is a number, as people read it.
  if (parts.length === 2 && parts[0] === 'a number, like 4.2' && parts[1] === 'text') return parts[0];
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}` : parts[0];
}

/** A value of another shape: "Not what rating value expects (a number, like 4.2). Kept as written." */
export const wrongShapeWords = (label: string, expects: ExpectsSpec | '') => `Not what ${label.toLowerCase()} expects (${describeExpects(expects)}). Kept as written.`;

/** Types in words, with one article: "a person or organization". */
export function shapeWords(types: string[]): string {
  const words = types.map((type) => type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());
  const first = words[0] ?? 'item';
  const article = /^[aeiou]/.test(first) ? 'an' : 'a';
  return `${article} ${words.length > 1 ? `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}` : first}`;
}

/**
 * Typed text in a number box: a number, one being typed ("4.", "-"), or
 * text. A number stays a number while it is being typed.
 */
export function numberFrom(text: string): number | 'typing' | null {
  const trimmed = text.trim();
  if (/^-?\d+([.,]\d+)?$/.test(trimmed)) return Number(trimmed.replace(',', '.'));
  if (/^-?\d*[.,]?$/.test(trimmed)) return 'typing';
  return null;
}

/** The offset of a zone at a date and time: "+03:00". */
export function zoneOffset(date: string, time: string, zone: string): string {
  const at = new Date(`${date}T${time || '12:00'}:00Z`);
  if (Number.isNaN(at.getTime())) return '';
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at).find((one) => one.type === 'timeZoneName')?.value;
    const offset = part?.replace('GMT', '') ?? '';
    return offset === '' ? '+00:00' : offset;
  } catch {
    return '';
  }
}

/** "Helsinki, summer time": the zone's city, and whether the offset is its summer one. */
export function zoneWords(date: string, time: string, zone: string): string {
  const city = zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;
  const year = date.slice(0, 4);
  const minutes = (offset: string) => {
    const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  };
  const january = minutes(zoneOffset(`${year}-01-15`, '12:00', zone));
  const july = minutes(zoneOffset(`${year}-07-15`, '12:00', zone));
  if (january === july) return city;
  return `${city}, ${minutes(zoneOffset(date, time, zone)) === Math.max(january, july) ? 'summer' : 'standard'} time`;
}

/** A date and time as it is written, with its zone: "Written as 2026-07-10T09:30+03:00 (Helsinki, summer time)". */
export const writtenWords = (value: string, date: string, time: string, zone: string) => `Written as ${value} (${zoneWords(date, time, zone)})`;

/** An enumeration value in words, without the word every value ends with: "New", not "New Condition". */
export function enumLabel(value: string, all: string[]): string {
  const words = (one: string) => one.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
  const last = words(all[0] ?? '').pop();
  const shared = all.length > 2 && !!last && all.every((one) => words(one).length > 1 && words(one).pop() === last);
  return (shared ? words(value).slice(0, -1) : words(value)).join(' ');
}

/** A whole-value field link: "{field.field_score}" names "field_score". */
export const linkOf = (value: unknown): string | null => (typeof value === 'string' ? (/^\{field\.([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)?)\}$/.exec(value)?.[1] ?? null) : null);

/** The fields a template value can be linked to, with the previewed item's value. */
export interface LinkField {
  name: string;
  label: string;
  value: string;
  /** Holds numbers, dates or text. */
  kinds: string[];
}

/**
 * The fields that fit what a value expects, and the others: a number takes
 * a number field, a date a date field, an address a link.
 */
export function fittingFields(fields: LinkField[], expects: ExpectsSpec | '', key = ''): { fit: LinkField[]; other: LinkField[] } {
  const want = expects === '' ? [] : kinds(typeof expects === 'string' ? expects : expects.is).map(([kind]) => kind);
  const of = (kind: string) => (kind === 'datetime' ? 'date' : kind === 'url' ? 'address' : kind === 'enum' ? 'text' : kind);
  // Text first, or nothing known, takes any field; "a number, or text" a number.
  if (!want.length || want[0] === 'text') return { fit: fields, other: [] };
  // A price field is a number, but only a price is one: never a rating's.
  const money = (one: LinkField) => /price|cost|fee|amount/i.test(`${one.name} ${one.label}`);
  const fit = fields.filter((one) => want.some((kind) => kind !== 'text' && one.kinds.includes(of(kind))) && (!money(one) || /price/i.test(key)));
  return { fit, other: fields.filter((one) => !fit.includes(one)) };
}

/** Names whose typed value is the same on every item of a template. */
const TYPED_ONCE = ['name', 'headline', 'datePublished', 'dateCreated', 'dateModified', 'startDate', 'endDate', 'price', 'image', 'ratingValue', 'reviewBody', 'description'];

export interface RowProps {
  rules: SearchFeatures;
  path: Path;
  label: string;
  value: unknown;
  expects: ExpectsSpec | '';
  need?: boolean;
  /** One of an either-or group: the group says to fill one, so none is required alone. */
  either?: boolean;
  readonly: boolean;
  /**
   * A value from the page that wins: shown, never edited. `texts`: a list,
   * one value per line. `unused`: what the added details give instead,
   * which is not used (Remove takes it out).
   */
  from?: { text: string; source: string; texts?: string[]; unused?: string };
  /** The row the switch from JSON lands on: washed for a moment. */
  washed?: boolean;
  /** Copied from another language: typed text to translate. */
  translate?: boolean;
  /** At template scope: the fields it can be linked to, and the type's name. */
  linking?: { fields: LinkField[]; type: string; previewing: string; multilingual?: boolean };
  /** The site's zone, which a date and time is stored in by default. */
  zone: string;
  /** Changes the working text. `undefined` removes the value. */
  onChange(path: Path, value: unknown): void;
  /** Moves a value of the list at `path` up or down, as written. */
  onMove(path: Path, index: number, by: -1 | 1): void;
  /** Saves the working text; `removed`: the bar says so and offers Undo. */
  onCommit(removed?: string): void;
  /** Shows the value in JSON. */
  onShow(path: Path): void;
  /** An item value: the reference menu and the nested form. */
  renderItem(path: Path, value: unknown, label: string, expects: ExpectsSpec | ''): ReactNode;
  /** A list's moves and removal. */
  list?: { index: number; length: number; move(by: -1 | 1): void };
  /** A detail added but not given a value yet: dropped on leaving it empty. */
  onEmpty?(): void;
  /** The text's problems: a row shows those at its own path, under its value. */
  problems?: Problem[];
  /** Applies a problem's fix. */
  onFix?(problem: Problem): void;
}

/**
 * A row's own problems, in its words: "Use the full address." with its fix.
 * Red blocks saving; amber is advice.
 */
function RowProblems(props: { id: string; problems: Problem[]; readonly: boolean; onFix?(problem: Problem): void }) {
  return props.problems.map((problem, index) => (
    <p key={index} className="seo-crow-problem" id={`${props.id}-p${index}`} data-tone={problem.tone}>
      <span className="seo-visually-hidden">{problem.tone === 'red' ? 'Problem: ' : 'Advice: '}</span>
      <bdi>{problem.words ?? problem.message}</bdi>
      {problem.fix && !props.readonly && props.onFix && (
        <>
          {' '}
          <button type="button" className="seo-link-btn" onClick={() => props.onFix!(problem)}>
            {problem.fix.label}
          </button>
        </>
      )}
    </p>
  ));
}

/** The problems at exactly this path. */
const problemsAt = (problems: Problem[] | undefined, path: Path) => {
  const at = path.join('/');
  return problems?.filter((one) => one.path.join('/') === at) ?? [];
};

/** Whether the expected shape is an item. */
const itemOnly = (spec: ExpectsSpec | '') => spec !== '' && kinds(typeof spec === 'string' ? spec : spec.is).every(([kind]) => kind === 'item');

/** A row's own value control (never one of a row nested in it, nor its ⋯). */
export const ROW_CONTROL = ':scope > :is(input, select, textarea), :scope > .seo-crow-date > input, :scope > .seo-cref > :is(button, input)';

/** A row's value control: its box or menu, before its own ⋯ menu. */
export const controlOf = (row: Element | null | undefined): HTMLElement | null =>
  row?.querySelector<HTMLElement>(ROW_CONTROL) ?? row?.querySelector<HTMLElement>('button') ?? null;

/**
 * Focus after a row goes: the next row's control, else the one before, else
 * the item's "Add a detail". Taken before the row unmounts.
 */
export function focusAfter(element: Element | null) {
  const row = element?.closest('.seo-crow');
  const scope = row?.closest('.seo-citem');
  if (!row || !scope) return;
  const rows = [...scope.querySelectorAll<HTMLElement>('.seo-crow:not(:has(.seo-crow))')];
  const at = rows.indexOf(row as HTMLElement);
  const key = (one: HTMLElement | undefined) => one?.dataset.row;
  // A needed row stays, empty: it keeps focus. Else the next or the one before.
  const places = [key(row as HTMLElement), key(rows[at + 1]), key(rows[at - 1])].filter((one): one is string => !!one);
  requestAnimationFrame(() => {
    const control = (place: string) => controlOf(scope.querySelector(`[data-row="${CSS.escape(place)}"]`));
    const target = places.map(control).find(Boolean) ?? scope.querySelector<HTMLElement>('.seo-filter input');
    target?.focus();
  });
}

export function Row(props: RowProps) {
  const id = useId();
  const { value, expects } = props;
  const [linkOpen, setLinkOpen] = useState(false);
  const field = linkOf(value);
  const linked = field ? props.linking?.fields.find((one) => one.name === field) : undefined;
  // An address without its scheme has its own advice, with the fix; an empty
  // value is no shape at all.
  const wrong = value !== undefined && value !== '' && !field && expects !== '' && !(typeof value === 'string' && itemOnly(expects)) && !Array.isArray(value) && !fits(value, expects, props.rules) && typeof value !== 'object' && !(typeof value === 'string' && /url/.test(typeof expects === 'string' ? expects : expects.is));
  const key = String(props.path[props.path.length - 1]);
  // Only a value typed into this text: never one the page gives, or a link.
  const typedOnce = !!props.linking && fittingFields(props.linking.fields, expects, key).fit.length > 0 && !props.from && !props.readonly && !field && ((typeof value === 'string' && value.trim() !== '') || typeof value === 'number') && TYPED_ONCE.includes(key);
  const mine = problemsAt(props.problems, props.path);
  const tone = mine.some((one) => one.tone === 'red') ? 'red' : mine.length ? 'amber' : undefined;
  const describedBy = [wrong && `${id}-wrong`, typedOnce && `${id}-once`, ...mine.map((_, index) => `${id}-p${index}`)].filter(Boolean).join(' ') || undefined;
  const linkable = !!props.linking && props.linking.fields.length > 0 && !props.readonly && !props.from && !itemOnly(expects) && (value === undefined || typeof value !== 'object');
  const link = (name: string | null) => {
    props.onChange(props.path, name === null ? undefined : `{field.${name}}`);
    props.onCommit(name === null ? `Unlinked ${props.label.toLowerCase()}.` : undefined);
  };
  const menu = !props.readonly && (!props.from || props.from.unused !== undefined) && value !== undefined && (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <button type="button" className="seo-icon-btn" data-size={24} aria-label={`More for ${props.label}`}>
          <DotsHorizontalIcon aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content size="1" align="end">
        {props.list ? (
          <>
            <DropdownMenu.Item disabled={props.list.index === 0} onSelect={() => props.list!.move(-1)}>
              Move up
            </DropdownMenu.Item>
            <DropdownMenu.Item disabled={props.list.index === props.list.length - 1} onSelect={() => props.list!.move(1)}>
              Move down
            </DropdownMenu.Item>
          </>
        ) : (
          typeof value !== 'object' && (
            <DropdownMenu.Item onSelect={() => props.onChange(props.path, [value, ''])}>Add another value</DropdownMenu.Item>
          )
        )}
        <DropdownMenu.Item onSelect={() => props.onShow(props.path)}>Show in JSON</DropdownMenu.Item>
        <DropdownMenu.Item
          color="red"
          onSelect={() => {
            focusAfter(document.querySelector(`[data-row="${CSS.escape(props.path.join('/'))}"]`));
            props.onChange(props.path, undefined);
            props.onCommit(`Removed ${props.label.toLowerCase()}`);
          }}
        >
          Remove
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
  // Fields of the kind the value expects first; the rest one level down.
  const fields = fittingFields(props.linking?.fields ?? [], expects, key);
  const fieldItem = (one: LinkField) => (
    <DropdownMenu.Item key={one.name} onSelect={() => link(one.name)}>
      <span className="seo-mi">
        <b>{one.label}</b>
        <small>{one.value ? (one.value.length > 80 ? `${one.value.slice(0, 80).trimEnd()}…` : one.value) : 'Empty'}</small>
      </span>
    </DropdownMenu.Item>
  );
  const linkButton = linkable && (
    <DropdownMenu.Root open={linkOpen} onOpenChange={setLinkOpen}>
      <DropdownMenu.Trigger>
        <button type="button" className="seo-icon-btn" data-size={24} aria-label={field ? `${props.label} is linked to ${linked?.label ?? field}. Change the link` : `Link ${props.label.toLowerCase()} to a field`}>
          <Link2Icon aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content size="1" align="end" className="seo-scope-menu">
        <DropdownMenu.Label>For {props.linking!.previewing}</DropdownMenu.Label>
        {fields.fit.map(fieldItem)}
        {/* One menu, never a submenu past the frame's edge. */}
        {fields.other.length > 0 && (
          <DropdownMenu.Group>
            {fields.fit.length > 0 && <DropdownMenu.Separator />}
            <DropdownMenu.Label>Other fields</DropdownMenu.Label>
            {fields.other.map(fieldItem)}
          </DropdownMenu.Group>
        )}
        {field && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => link(null)}>Unlink</DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );

  // A list the page gives: its values, one per line.
  if (props.from?.texts) {
    return (
      <div className="seo-crow" data-row={props.path.join('/')}>
        <div className="seo-crow-head">
          <span className="seo-crow-label" id={`${id}-label`}>
            {props.label}
          </span>
        </div>
        <div className="seo-crow-from" role="group" aria-labelledby={`${id}-label`}>
          <span className="seo-crow-from-list" dir="auto">
            {props.from.texts.map((one, index) => (
              <span key={index}>{one}</span>
            ))}
          </span>
          <span className="seo-meta">{props.from.source}</span>
        </div>
      </div>
    );
  }

  // A list: its values stacked, each with its own moves. Items of one type
  // are named by it: "Questions", "Question 1".
  if (Array.isArray(value) && !props.list) {
    const types = [...new Set(value.map((one) => typesOf(one)[0]))];
    const each = types.length === 1 && types[0] ? typeLabel(types[0], props.rules) : props.label;
    return (
      <div className="seo-crow" role="group" aria-labelledby={`${id}-label`} data-washed={props.washed || undefined} data-row={props.path.join('/')} data-problem={tone}>
        <div className="seo-crow-head">
          <span className="seo-crow-label" id={`${id}-label`}>
            {each === props.label ? props.label : `${each}s`}
          </span>
        </div>
        <RowProblems id={id} problems={mine} readonly={props.readonly} onFix={props.onFix} />
        {value.map((one, index) => (
          <Row
            {...props}
            key={index}
            path={[...props.path, index]}
            label={value.length === 1 ? each : `${each} ${index + 1}`}
            value={one}
            washed={false}
            list={{
              index,
              length: value.length,
              move: (by) => props.onMove(props.path, index, by),
            }}
          />
        ))}
        {!props.readonly && (
          <Btn add onClick={() => props.onChange([...props.path, value.length], typeof value[0] === 'object' && value[0] !== null ? { '@type': (value[0] as Record<string, unknown>)['@type'] } : '')}>
            Add another
          </Btn>
        )}
      </div>
    );
  }

  let control: ReactNode;
  if (props.from) {
    control = (
      <div className="seo-crow-from">
        <span dir="auto">{props.from.text}</span>
        <span className="seo-meta">{props.from.source}</span>
        {props.from.unused !== undefined && (
          <span className="seo-meta seo-crow-unused" dir="auto">
            Your “{props.from.unused}” isn't used.
          </span>
        )}
      </div>
    );
  } else if (field) {
    control = (
      <div className="seo-crow-from" data-linked="">
        <span>
          <b>{linked?.label ?? field}</b>
          <span className="seo-meta" dir="auto"> · {linked ? linked.value || `Empty for ${props.linking?.previewing ?? 'this item'}` : 'Not a field of this type'}</span>
        </span>
      </div>
    );
  } else if ((value !== null && typeof value === 'object') || ((value === undefined || (typeof value === 'string' && !field)) && itemOnly(expects))) {
    // An item, or a name where an item is needed: the reference menu.
    control = props.renderItem(props.path, value, props.label, expects);
  } else if (typeof value === 'boolean' || (value === undefined && expects === 'bool')) {
    control = (
      <select
        id={id}
        className="seo-input"
        disabled={props.readonly}
        aria-describedby={describedBy}
        value={value === undefined ? '' : value ? 'yes' : 'no'}
        onChange={(event) => {
          props.onChange(props.path, event.target.value === '' ? undefined : event.target.value === 'yes');
          props.onCommit();
        }}
        onBlur={() => value === undefined && props.onEmpty?.()}
      >
        <option value="">Not set</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  } else {
    const enums = expects === '' ? [] : kinds(typeof expects === 'string' ? expects : expects.is).filter(([kind]) => kind === 'enum').flatMap(([, list]) => list);
    const bare = typeof value === 'string' ? value.replace(/^https?:\/\/schema\.org\//, '') : '';
    if (enums.length && (value === undefined || value === '' || enums.includes(bare))) {
      control = (
        <select
          id={id}
          className="seo-input"
          disabled={props.readonly}
          value={bare}
          onChange={(event) => {
            props.onChange(props.path, event.target.value === '' ? undefined : `https://schema.org/${event.target.value}`);
            props.onCommit();
          }}
          onBlur={() => (value === undefined || value === '') && props.onEmpty?.()}
        >
          <option value="">Not set</option>
          {enums.map((one) => (
            <option key={one} value={one}>
              {enumLabel(one, enums)}
            </option>
          ))}
        </select>
      );
    } else {
      control = <TextControl {...props} id={id} describedBy={describedBy} />;
    }
  }

  return (
    <div className="seo-crow" data-washed={props.washed || undefined} data-need={props.need || undefined} data-empty={value === undefined || undefined} data-row={props.path.join('/')} data-problem={tone}>
      <div className="seo-crow-head">
        <label className="seo-crow-label" htmlFor={id}>
          {props.label}
          {props.translate && <span className="seo-chip">Translate this</span>}
        </label>
        <span className="seo-crow-tools">
          {linkButton}
          {menu}
        </span>
      </div>
      {control}
      {wrong && (
        <p className="seo-meta" id={`${id}-wrong`}>
          {wrongShapeWords(props.label, expects)}
        </p>
      )}
      <RowProblems id={id} problems={mine} readonly={props.readonly} onFix={props.onFix} />
      {typedOnce && (
        <p className="seo-meta seo-crow-advice" id={`${id}-once`}>
          The same {props.label.toLowerCase()} on every {props.linking!.type}. Link it to a field instead.{' '}
          <button type="button" className="seo-link-btn" onClick={() => setLinkOpen(true)}>
            Link it
          </button>
        </p>
      )}
    </div>
  );
}

/** The one add style: a ghost "+ …" button. */
export function Btn(props: { add?: boolean; onClick(): void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="seo-btn" data-variant="ghost" data-size={24} disabled={props.disabled} onClick={props.onClick}>
      {props.add && '+ '}
      {props.children}
    </button>
  );
}

const LONG = ['description', 'text', 'reviewBody', 'articleBody', 'abstract', 'disambiguatingDescription'];

/** Text, numbers, dates and addresses: one input that keeps the value's type. */
function TextControl(props: RowProps & { id: string; describedBy?: string }) {
  const { value, expects } = props;
  const is = expects === '' ? '' : typeof expects === 'string' ? expects : expects.is;
  // A number stays a number while it is being typed.
  const numeric = useRef(typeof value === 'number' || (value === undefined && /^number/.test(is)));
  const textToo = is.includes('text') || typeof value === 'string';
  const shown = value === undefined ? '' : String(value);
  const [typed, setTyped] = useState<string | null>(null);
  const multiline = LONG.includes(String(props.path[props.path.length - 1]));
  const date = /^date/.test(is) && (value === undefined || value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)));
  const change = (text: string) => {
    setTyped(text);
    // Emptied while typing: the key keeps its place until the box is left.
    if (text.trim() === '') {
      props.onChange(props.path, '');
      return;
    }
    if (numeric.current) {
      const number = numberFrom(text);
      if (number === 'typing') return;
      if (typeof number === 'number') {
        props.onChange(props.path, number);
        return;
      }
      numeric.current = false;
    }
    props.onChange(props.path, text);
  };
  const leave = () => {
    const text = typed;
    setTyped(null);
    if (text !== null && text.trim() === '') {
      // Never stored as "": the value goes.
      props.onChange(props.path, undefined);
    } else if (text !== null && numeric.current && numberFrom(text) === 'typing') {
      const number = Number(text.trim().replace(',', '.').replace(/[.,]$/, ''));
      props.onChange(props.path, Number.isFinite(number) && /\d/.test(text) ? number : undefined);
    }
    if ((text === null && value === undefined) || (text !== null && text.trim() === '' && value === '')) props.onEmpty?.();
    props.onCommit();
  };
  const common = {
    id: props.id,
    className: 'seo-input',
    disabled: props.readonly,
    'aria-describedby': props.describedBy,
    'aria-required': (props.need && !props.either) || undefined,
    'aria-invalid': props.problems?.some((one) => one.tone === 'red' && one.path.join('/') === props.path.join('/')) || undefined,
    value: typed ?? shown,
    onBlur: leave,
  };
  if (date) {
    return <DateControl {...props} />;
  }
  return multiline ? (
    <textarea {...common} rows={3} dir="auto" onChange={(event) => change(event.target.value)} />
  ) : (
    <input
      {...common}
      type="text"
      dir="auto"
      inputMode={numeric.current && !textToo ? 'decimal' : /url/.test(is) ? 'url' : undefined}
      onChange={(event) => change(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') props.onCommit();
      }}
    />
  );
}

/** Every zone this browser knows; the site's when it knows none. */
const zones = (site: string): string[] => {
  try {
    const all = (Intl as unknown as { supportedValuesOf?(key: string): string[] }).supportedValuesOf?.('timeZone') ?? [];
    return all.includes(site) ? all : [site, ...all];
  } catch {
    return [site];
  }
};

/** A date, or a date and time with the offset of its zone on that date. */
function DateControl(props: RowProps) {
  const value = typeof props.value === 'string' ? props.value : '';
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value);
  const is = typeof props.expects === 'string' ? props.expects : props.expects ? props.expects.is : '';
  const [zone, setZone] = useState(props.zone);
  const [time, setTime] = useState(m?.[2] ?? '');
  const date = m?.[1] ?? '';
  const write = (nextDate: string, nextTime: string, nextZone = zone) => {
    if (!nextDate) {
      props.onChange(props.path, undefined);
      return;
    }
    props.onChange(props.path, nextTime ? `${nextDate}T${nextTime}${zoneOffset(nextDate, nextTime, nextZone)}` : nextDate);
  };
  const id = useId();
  const withTime = /datetime/.test(is);
  return (
    <div className="seo-crow-date">
      <input type="date" className="seo-input" aria-label={`${props.label}, date`} disabled={props.readonly} value={date} onChange={(event) => write(event.target.value, time)} onBlur={() => props.onCommit()} />
      {withTime && (
        <>
          <input
            type="time"
            className="seo-input"
            aria-label={`${props.label}, time`}
            aria-describedby={id}
            disabled={props.readonly || !date}
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              write(date, event.target.value);
            }}
            onBlur={() => props.onCommit()}
          />
          <select
            className="seo-input"
            aria-label={`${props.label}, time zone`}
            disabled={props.readonly || !date}
            value={zone}
            onChange={(event) => {
              setZone(event.target.value);
              if (time) {
                write(date, time, event.target.value);
                props.onCommit();
              }
            }}
          >
            {zones(props.zone).map((one) => (
              <option key={one} value={one}>
                {one.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </>
      )}
      {m?.[2] && (
        <p className="seo-meta" id={id}>
          {writtenWords(value, date, time, zone)}
        </p>
      )}
    </div>
  );
}
