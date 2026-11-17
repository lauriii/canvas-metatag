// The controls of structured data details, by value shape. Pure: no DOM.
// A control is chosen from a shape and its attributes, never from a registry
// key, so that hand-added details can use the same controls.
import type { SchemaGroup, SchemaProp } from './types';

/** What a detail is edited with. */
export type Control =
  | 'text'
  | 'url'
  | 'date'
  | 'number'
  | 'duration'
  | 'select'
  | 'checks'
  | 'picker'
  | 'currency'
  | 'image'
  | 'ref'
  | 'hours'
  /** Only a field link fills it: a list of text, a job description. */
  | 'link';

/** A value shape: a kind and the attributes that change its control. */
export type Shape = Pick<SchemaProp, 'kind'> &
  Partial<Pick<SchemaProp, 'list' | 'codes' | 'unit' | 'options' | 'html' | 'link_only' | 'per_item' | 'max'>>;

/** The most choices a list shows in place, as checkbox rows. */
export const IN_PLACE = 6;

/**
 * The control of a shape; null when the dialog has none for it. On a
 * template, what each page has its own of (`per_item`) is only linked.
 */
export function controlFor(shape: Shape, scope?: 'page' | 'template'): Control | null {
  if (shape.html || shape.link_only || (shape.kind === 'text' && shape.list) || (scope === 'template' && shape.per_item)) {
    return 'link';
  }
  switch (shape.kind) {
    case 'enum':
      if (shape.codes) {
        return 'picker';
      }
      if (shape.list) {
        return (shape.options?.length ?? 0) <= IN_PLACE ? 'checks' : 'picker';
      }
      return 'select';
    case 'number':
      return shape.unit ? 'duration' : 'number';
    case 'text':
    case 'url':
    case 'date':
    case 'currency':
    case 'image':
    case 'ref':
    case 'hours':
      return shape.kind;
    default:
      return null;
  }
}

// Durations: a whole number of minutes, typed as hours and minutes.

/** The longest duration, in minutes: 30 days. */
export const DURATION_MAX = 43200;

/** Minutes as the two slots of the box; empty slots for none. */
export function durationSlots(minutes: string): { hours: string; minutes: string } {
  const total = /^\d+$/.test(minutes) ? Number(minutes) : NaN;
  if (!Number.isFinite(total) || total <= 0) {
    return { hours: '', minutes: '' };
  }
  const hours = Math.floor(total / 60);
  return { hours: hours ? String(hours) : '', minutes: total % 60 ? String(total % 60) : '' };
}

/**
 * The two slots as minutes: minutes past 59 carry into hours. Undefined for
 * nothing typed; an error for a value that is not a whole number or is zero.
 */
export function durationValue(hours: string, minutes: string): { minutes?: string; error?: string } {
  if (hours.trim() === '' && minutes.trim() === '') {
    return {};
  }
  const whole = (text: string) => (text.trim() === '' ? 0 : /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN);
  const total = whole(hours) * 60 + whole(minutes);
  if (!Number.isFinite(total)) {
    return { error: 'Use whole numbers.' };
  }
  if (total === 0) {
    return { error: "Leave it empty if you don't know it." };
  }
  // SchemaGraph::DURATION_MAX: what the head emits, and the server keeps.
  if (total > DURATION_MAX) {
    return { error: 'Use at most 30 days.' };
  }
  return { minutes: String(total) };
}

/** "1 h 30 min", "45 min". */
export function durationText(minutes: string): string {
  const { hours, minutes: rest } = durationSlots(minutes);
  return [hours && `${hours} h`, rest && `${rest} min`].filter(Boolean).join(' ');
}

// Opening hours: one week in the grammar SchemaGraph::hours() reads
// (tests/fixtures/hours.json pins both).

export const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
export type Day = (typeof DAYS)[number];
export type Range = [string, string];

/** Times by day (absent: closed) and special days by date ([]: closed). */
export interface Week {
  weekly: Partial<Record<Day, Range[]>>;
  dated: Record<string, Range[]>;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Open all day. */
export const ALL_DAY: Range = ['00:00', '23:59'];

/** Why the times of one day cannot be stored, or null. */
export function rangesError(ranges: Range[]): string | null {
  for (const [index, [opens, closes]] of ranges.entries()) {
    if (!TIME.test(opens) || !TIME.test(closes)) {
      return 'Enter both times.';
    }
    if (opens >= closes) {
      return 'It closes before it opens.';
    }
    if (index > 0 && opens < ranges[index - 1][1]) {
      return 'Times overlap.';
    }
  }
  return null;
}

/** A week from its text, or null when it is not one. */
export function parseHours(text: string): Week | null {
  const week: Week = { weekly: {}, dated: {} };
  if (text === '') {
    return null;
  }
  for (const entry of text.split('; ')) {
    const match = entry.match(/^(\d{4}-\d{2}-\d{2}|[A-Z][a-z](?:-[A-Z][a-z])?(?:,[A-Z][a-z](?:-[A-Z][a-z])?)*) (closed|\d\d:\d\d-\d\d:\d\d(?:,\d\d:\d\d-\d\d:\d\d)*)$/);
    if (!match) {
      return null;
    }
    const ranges = match[2] === 'closed' ? [] : match[2].split(',').map((range) => range.split('-') as Range);
    if (rangesError(ranges)) {
      return null;
    }
    if (/^\d/.test(match[1])) {
      const [year, month, day] = match[1].split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCMonth() !== month - 1 || week.dated[match[1]]) {
        return null;
      }
      week.dated[match[1]] = ranges;
      continue;
    }
    if (ranges.length === 0) {
      return null;
    }
    for (const span of match[1].split(',')) {
      const [from, to = from] = span.split('-');
      const start = DAYS.indexOf(from as Day);
      const end = DAYS.indexOf(to as Day);
      if (start < 0 || end < start) {
        return null;
      }
      for (const day of DAYS.slice(start, end + 1)) {
        if (week.weekly[day]) {
          return null;
        }
        week.weekly[day] = ranges;
      }
    }
  }
  return week;
}

const timesText = (ranges: Range[]) => ranges.map(([opens, closes]) => `${opens}-${closes}`).join(',');

/** A week as its text: days with the same times together, in order. */
export function formatHours(week: Week): string {
  const entries: string[] = [];
  const byTimes = new Map<string, Day[]>();
  for (const day of DAYS) {
    const ranges = week.weekly[day];
    if (ranges?.length) {
      const key = timesText(ranges);
      byTimes.set(key, [...(byTimes.get(key) ?? []), day]);
    }
  }
  for (const [times, days] of byTimes) {
    // Runs of days: "Mo-Fr", "Mo,We".
    const spans: string[] = [];
    let start = 0;
    for (let index = 1; index <= days.length; index++) {
      if (index === days.length || DAYS.indexOf(days[index]) !== DAYS.indexOf(days[index - 1]) + 1) {
        spans.push(index - start > 1 ? `${days[start]}-${days[index - 1]}` : days[start]);
        start = index;
      }
    }
    entries.push(`${spans.join(',')} ${times}`);
  }
  for (const date of Object.keys(week.dated).sort()) {
    entries.push(`${date} ${week.dated[date].length ? timesText(week.dated[date]) : 'closed'}`);
  }
  return entries.join('; ');
}

const DAY_NAMES: Record<Day, string> = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' };
export const DAY_WORDS: Record<Day, string> = { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' };

/** "Mon–Fri 09:00–17:00, Sat 10:00–14:00 · 2 special days". */
export function hoursLine(week: Week): string {
  const groups = formatHours({ weekly: week.weekly, dated: {} })
    .split('; ')
    .filter(Boolean)
    .map((entry) => {
      const [days, times] = entry.split(' ');
      const words = days.replace(/[A-Z][a-z]/g, (day) => DAY_NAMES[day as Day]).replace(/-/g, '–').replace(/,/g, ', ');
      return `${words} ${times === '00:00-23:59' ? 'open 24 hours' : times.replace(/-/g, '–').replace(/,/g, ', ')}`;
    });
  const special = Object.keys(week.dated).length;
  const line = groups.join('; ') || 'Closed every day';
  return special ? `${line} · ${special} special ${special === 1 ? 'day' : 'days'}` : line;
}

/**
 * Whether "Use for Tue–Fri" applies: Monday has both times and Tuesday to
 * Friday are closed.
 */
export const canCopyMonday = (week: Week) =>
  !!week.weekly.Mo?.length && rangesError(week.weekly.Mo) === null && (['Tu', 'We', 'Th', 'Fr'] as Day[]).every((day) => !week.weekly[day]?.length);

// Pickers.

/** One choice of a picker. */
export interface Choice {
  value: string;
  label: string;
  /** The code and the English name, which a filter also finds. */
  also: string[];
}

/** The choices of an enum: options with their words, or a code list's names. */
export function choicesOf(prop: Pick<SchemaProp, 'options' | 'option_labels' | 'codes'>, codes: string[], ui: string): Choice[] {
  if (prop.codes) {
    const names = new Intl.DisplayNames([ui], { type: 'region' });
    const english = new Intl.DisplayNames(['en'], { type: 'region' });
    return codes
      .map((code) => ({ value: code, label: names.of(code) ?? code, also: [code, english.of(code) ?? code] }))
      .sort((a, b) => a.label.localeCompare(b.label, ui));
  }
  return (prop.options ?? []).map((option) => {
    const words = prop.option_labels?.[option] ?? option;
    return { value: option, label: words.charAt(0).toUpperCase() + words.slice(1), also: [option] };
  });
}

const folded = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();

/**
 * The choices a filter finds, by label, code or English name. Without a
 * filter, suggested ones first. With one: an exact code first ("FI" is
 * Finland), then labels that start with it, then names that do, then the
 * rest that hold it.
 */
export function filterChoices(choices: Choice[], query: string, suggested: string[] = []): Choice[] {
  const q = folded(query.trim());
  if (q === '') {
    return [...choices].sort((a, b) => Number(!suggested.includes(a.value)) - Number(!suggested.includes(b.value)));
  }
  const found = choices.filter((choice) => [choice.label, ...choice.also].some((text) => folded(text).includes(q)));
  const rank = (choice: Choice) =>
    folded(choice.value) === q || folded(choice.also[0] ?? '') === q
      ? 0
      : folded(choice.label).startsWith(q)
        ? 1
        : choice.also.some((text) => folded(text).startsWith(q))
          ? 2
          : 3;
  return [...found].sort((a, b) => rank(a) - rank(b));
}

/** "Estonia selected, 3 chosen": what a toggle says. */
export const toggleSaid = (label: string, on: boolean, count: number) =>
  `${label} ${on ? 'selected' : 'removed'}, ${count} chosen`;

// Groups.

/**
 * A group's value in one line, from its parts' shown values in the shape's
 * order: "Riverside Hall, Helsinki", "€4,200–5,000 a month".
 */
export function groupLine(key: string, group: SchemaGroup, shown: (key: string) => string, ui = 'en'): string {
  const of = (part: string) => shown(`${key}_${part}`);
  switch (group.shape) {
    case 'address':
      return [of('streetAddress'), [of('postalCode'), of('addressLocality')].filter(Boolean).join(' '), of('addressRegion'), of('addressCountry')].filter(Boolean).join(', ');
    case 'venue':
      // Its name and city; without a name, its street and city.
      return (of('name')
        ? [of('name'), of('address_addressLocality') || of('address_streetAddress')]
        : [of('address_streetAddress'), of('address_addressLocality')]
      ).filter(Boolean).join(', ');
    case 'tickets': {
      // "€25 · Presale": the price in its currency's own form.
      const price = of('price');
      return [price && moneyText(price, of('priceCurrency'), true, ui), of('availability')].filter(Boolean).join(' · ');
    }
    case 'pay': {
      // "€4,200–5,000 a month": the amounts in the currency's own form.
      const [from, to] = [of('value_minValue'), of('value_maxValue')];
      if (!from && !to) {
        return '';
      }
      const currency = of('currency');
      const money = (text: string, symbol: boolean) => moneyText(text, currency, symbol, ui);
      const amount = [from && money(from, true), to && money(to, !from)].filter(Boolean).join('–');
      const per = of('value_unitText').toLowerCase();
      return [amount, per && `a ${per}`].filter(Boolean).join(' ');
    }
    default:
      return group.parts.map((part) => shown(part)).filter(Boolean).join(', ');
  }
}

/** An amount in its currency's form: "€25"; without the symbol, "5,000". */
function moneyText(text: string, currency: string, symbol: boolean, ui: string): string {
  try {
    return new Intl.NumberFormat(ui, currency && symbol ? { style: 'currency', currency, maximumFractionDigits: Number.isInteger(Number(text)) ? 0 : 2 } : { maximumFractionDigits: 2 }).format(Number(text));
  } catch {
    return text;
  }
}

/** The parts a group misses to be complete: the first key of each unmet entry. */
export function missingParts(group: SchemaGroup, set: (key: string) => boolean, groups: Record<string, SchemaGroup>): string[] {
  const done = (key: string): boolean => (groups[key] ? missingParts(groups[key], set, groups).length === 0 && groups[key].parts.some((part) => groups[part] ? done(part) : set(part)) : set(key));
  return group.requires.filter((entry) => !entry.some(done)).map((entry) => entry[0]);
}

/**
 * A part of a group, as the words that ask for it: "the name" (a group's
 * name part by its own short label), "the country", "how often it is paid".
 */
export function partNoun(prop: Pick<SchemaProp, 'key' | 'label' | 'short'> | undefined, fallback: string): string {
  if (prop?.key.endsWith('_unitText')) {
    return 'how often it is paid';
  }
  return `the ${(prop?.short ?? prop?.label ?? fallback).toLowerCase()}`;
}

/** Formatted text as its words: "<p>Build tools.</p>" is "Build tools.". */
export const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
