import { describe, expect, it } from 'vitest';

import hours from '../../tests/fixtures/hours.json';
import {
  canCopyMonday,
  choicesOf,
  controlFor,
  durationSlots,
  durationText,
  durationValue,
  filterChoices,
  formatHours,
  groupLine,
  hoursLine,
  missingParts,
  parseHours,
  partNoun,
  plainText,
  rangesError,
  toggleSaid,
} from './controls';
import { REGISTRY } from './data.test-helper';

describe('controlFor', () => {
  // From a shape and its attributes alone: no registry, no key.
  it('chooses a control by shape', () => {
    expect(controlFor({ kind: 'enum', codes: 'country' })).toBe('picker');
    expect(controlFor({ kind: 'enum', list: true, options: ['A', 'B', 'C'] })).toBe('checks');
    expect(controlFor({ kind: 'enum', list: true, options: ['1', '2', '3', '4', '5', '6', '7'] })).toBe('picker');
    expect(controlFor({ kind: 'enum', options: ['A'] })).toBe('select');
    expect(controlFor({ kind: 'number', unit: 'minute' })).toBe('duration');
    expect(controlFor({ kind: 'number' })).toBe('number');
    expect(controlFor({ kind: 'hours' })).toBe('hours');
    expect(controlFor({ kind: 'ref' })).toBe('ref');
    expect(controlFor({ kind: 'text', list: true })).toBe('link');
    expect(controlFor({ kind: 'text', html: true, link_only: true })).toBe('link');
    expect(controlFor({ kind: 'image' })).toBe('image');
    // Six choices or fewer are checkbox rows; seven given as codes, a picker.
    expect(controlFor({ kind: 'enum', list: true, options: ['1', '2', '3', '4', '5', '6'] })).toBe('checks');
    expect(controlFor({ kind: 'enum', list: true, codes: 'country', options: ['1', '2', '3', '4', '5', '6', '7'] })).toBe('picker');
  });

  it('links only what each page has its own of, on a template', () => {
    // A closing date typed once would close every job on that day.
    expect(controlFor({ kind: 'date', per_item: true }, 'template')).toBe('link');
    expect(controlFor({ kind: 'date', per_item: true }, 'page')).toBe('date');
    expect(controlFor({ kind: 'ref', list: true, per_item: true }, 'template')).toBe('link');
    for (const key of ['performer', 'location']) {
      expect(controlFor(REGISTRY.Event.props!.find((prop) => prop.key === key)!, 'template'), key).toBe('link');
    }
    expect(controlFor(REGISTRY.JobPosting.props!.find((prop) => prop.key === 'validThrough')!, 'template')).toBe('link');
  });
});

describe('durations', () => {
  it('reads and writes minutes, with empty slots for none', () => {
    expect(durationSlots('90')).toEqual({ hours: '1', minutes: '30' });
    expect(durationSlots('45')).toEqual({ hours: '', minutes: '45' });
    expect(durationSlots('')).toEqual({ hours: '', minutes: '' });
    expect(durationText('90')).toBe('1 h 30 min');
    // Ninety minutes typed carry into hours.
    expect(durationValue('', '90')).toEqual({ minutes: '90' });
    expect(durationSlots(durationValue('', '90').minutes!)).toEqual({ hours: '1', minutes: '30' });
    expect(durationValue('', '')).toEqual({});
    expect(durationValue('0', '0')).toEqual({ error: "Leave it empty if you don't know it." });
    expect(durationValue('1.5', '')).toEqual({ error: 'Use whole numbers.' });
    // One limit with the server: 30 days.
    expect(durationValue('720', '')).toEqual({ minutes: '43200' });
    expect(durationValue('720', '1')).toEqual({ error: 'Use at most 30 days.' });
  });
});

describe('opening hours', () => {
  it('reads and writes the grammar the server reads (tests/fixtures/hours.json)', () => {
    for (const { text } of hours.valid) {
      const week = parseHours(text);
      expect(week, text).not.toBeNull();
      // Round trip: the canonical text groups the days the same way.
      expect(parseHours(formatHours(week!))).toEqual(week);
    }
    for (const text of hours.invalid) {
      expect(parseHours(text), text).toBeNull();
    }
  });

  it('groups days with the same times', () => {
    const week = parseHours('Mo 09:00-17:00; Tu 09:00-17:00; We 09:00-17:00; Sa 10:00-14:00; 2026-12-24 closed')!;
    expect(formatHours(week)).toBe('Mo-We 09:00-17:00; Sa 10:00-14:00; 2026-12-24 closed');
    expect(hoursLine(week)).toBe('Mon–Wed 09:00–17:00; Sat 10:00–14:00 · 1 special day');
    expect(hoursLine(parseHours('Mo,We 00:00-23:59')!)).toBe('Mon, Wed open 24 hours');
  });

  it('refuses overlapping times and starts with every day closed', () => {
    expect(rangesError([['09:00', '13:00'], ['12:00', '17:00']])).toBe('Times overlap.');
    expect(rangesError([['09:00', '']])).toBe('Enter both times.');
    expect(formatHours({ weekly: {}, dated: {} })).toBe('');
    expect(hoursLine({ weekly: {}, dated: {} })).toBe('Closed every day');
  });

  it('offers "Use for Tue–Fri" once Monday has both times and the rest are closed', () => {
    expect(canCopyMonday({ weekly: { Mo: [['09:00', '17:00']] }, dated: {} })).toBe(true);
    expect(canCopyMonday({ weekly: { Mo: [['09:00', '']] }, dated: {} })).toBe(false);
    expect(canCopyMonday({ weekly: { Mo: [['09:00', '17:00']], We: [['09:00', '12:00']] }, dated: {} })).toBe(false);
  });
});

describe('pickers', () => {
  const countries = choicesOf({ codes: 'country' }, ['EE', 'FI', 'SE', 'DE'], 'en');

  it('finds by label, code and English name, suggested first', () => {
    expect(filterChoices(countries, 'fin').map((one) => one.value)).toEqual(['FI']);
    expect(filterChoices(countries, 'se').map((one) => one.value)[0]).toBe('SE');
    expect(filterChoices(countries, '', ['SE']).map((one) => one.value)[0]).toBe('SE');
    // While a list is open its order is the one it opened with: ticking
    // Finland and Estonia moves no row (the picker keeps the opening list).
    const opened = filterChoices(countries, '', ['SE']).map((one) => one.value);
    expect(filterChoices(countries, '', ['SE']).map((one) => one.value)).toEqual(opened);
    expect(filterChoices(countries, '', ['FI', 'EE', 'SE']).map((one) => one.value)).not.toEqual(opened);
    // Accents and case do not matter.
    expect(filterChoices(choicesOf({ codes: 'country' }, ['CI'], 'fr'), 'cote').map((one) => one.value)).toEqual(['CI']);
    // An exact code first: "FI" is Finland, not Fiji; then labels that start with it.
    const more = choicesOf({ codes: 'country' }, ['FJ', 'FI', 'PH', 'EE', 'ET'], 'en');
    expect(filterChoices(more, 'FI')[0].value).toBe('FI');
    expect(filterChoices(more, 'fi').map((one) => one.value).slice(0, 2)).toEqual(['FI', 'FJ']);
    expect(filterChoices(more, 'EE')[0].value).toBe('EE');
  });

  it('says each toggle with the new total', () => {
    expect(toggleSaid('Estonia', true, 3)).toBe('Estonia selected, 3 chosen');
    expect(toggleSaid('Estonia', false, 2)).toBe('Estonia removed, 2 chosen');
  });

  it('words the options of a list', () => {
    const job = REGISTRY.JobPosting.props!.find((prop) => prop.key === 'employmentType')!;
    expect(choicesOf(job, [], 'en').map((one) => one.label).slice(0, 2)).toEqual(['Full time', 'Part time']);
  });
});

describe('groups', () => {
  const event = REGISTRY.Event;
  const values: Record<string, string> = {
    location_name: 'Riverside Hall',
    location_address_streetAddress: 'Mill Road 4',
    location_address_addressLocality: 'Tampere',
  };

  it('reads as one line', () => {
    expect(groupLine('location', event.groups!.location, (key) => values[key] ?? '')).toBe('Riverside Hall, Tampere');
    // A venue without a name reads its street and city.
    expect(groupLine('location', event.groups!.location, (key) => (key === 'location_name' ? '' : (values[key] ?? '')))).toBe('Mill Road 4, Tampere');
    expect(groupLine('location_address', event.groups!.location_address, (key) => values[key] ?? '')).toBe('Mill Road 4, Tampere');
  });

  it('reads pay in its currency, by the unit in words', () => {
    const job = REGISTRY.JobPosting;
    const pay: Record<string, string> = { baseSalary_value_minValue: '5200', baseSalary_currency: 'EUR', baseSalary_value_unitText: 'Month' };
    expect(groupLine('baseSalary', job.groups!.baseSalary, (key) => pay[key] ?? '', 'en')).toBe('€5,200 a month');
    pay.baseSalary_value_maxValue = '6000';
    expect(groupLine('baseSalary', job.groups!.baseSalary, (key) => pay[key] ?? '', 'en')).toBe('€5,200–6,000 a month');
  });

  it('reads tickets as money, then what is on sale', () => {
    const tickets: Record<string, string> = { offers_price: '25', offers_priceCurrency: 'EUR', offers_availability: 'Presale' };
    expect(groupLine('offers', REGISTRY.Event.groups!.offers, (key) => tickets[key] ?? '', 'en')).toBe('€25 · Presale');
  });

  it('asks for a part by its own name', () => {
    const props = REGISTRY.Event.props!;
    expect(partNoun(props.find((prop) => prop.key === 'location_name'), '')).toBe('the name');
    expect(partNoun(props.find((prop) => prop.key === 'location_address_addressCountry'), '')).toBe('the country');
    expect(partNoun(REGISTRY.JobPosting.props!.find((prop) => prop.key === 'baseSalary_value_unitText'), '')).toBe('how often it is paid');
    expect(partNoun(undefined, 'Address')).toBe('the address');
  });

  it('reads formatted text as its words', () => {
    expect(plainText('<p>Build editorial tools.</p><ul><li>Design &amp; build</li></ul>')).toBe('Build editorial tools. Design & build');
  });

  it('names the part an incomplete address misses', () => {
    const set = (key: string) => key in values;
    expect(missingParts(event.groups!.location_address, set, event.groups!)).toEqual(['location_address_addressCountry']);
    // The venue has its name: it is complete without the address.
    expect(missingParts(event.groups!.location, set, event.groups!)).toEqual([]);
  });
});
