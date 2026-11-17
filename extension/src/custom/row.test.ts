import { describe, expect, it } from 'vitest';
import { describeExpects, enumLabel, linkOf, numberFrom, writtenWords, zoneOffset, zoneWords } from './Row';
import { moveInText } from './sheet';

describe('every value has a control that keeps its shape', () => {
  it('a number stays a number while it is typed one character at a time', () => {
    // "4", "4.", "4.2": the middle one is a number being typed, never text.
    expect(['4', '4.', '4.2'].map(numberFrom)).toEqual([4, 'typing', 4.2]);
    expect(numberFrom('-')).toBe('typing');
    expect(numberFrom('4,5')).toBe(4.5);
    // Text a number can't be: kept as text.
    expect(numberFrom('85%')).toBeNull();
    expect(numberFrom('4.2 stars')).toBeNull();
  });

  it('a summer date in Helsinki stores +03:00, a winter one +02:00', () => {
    expect(zoneOffset('2026-07-10', '09:30', 'Europe/Helsinki')).toBe('+03:00');
    expect(zoneOffset('2026-01-10', '09:30', 'Europe/Helsinki')).toBe('+02:00');
    expect(zoneWords('2026-07-10', '09:30', 'Europe/Helsinki')).toBe('Helsinki, summer time');
    expect(zoneWords('2026-01-10', '09:30', 'Europe/Helsinki')).toBe('Helsinki, standard time');
    // A zone without summer time is its city.
    expect(zoneWords('2026-07-10', '09:30', 'Asia/Tokyo')).toBe('Tokyo');
    expect(zoneOffset('2026-07-10', '09:30', 'UTC')).toBe('+00:00');
  });

  it('moving an item renumbers the positions in the same step, and keeps each one as written', () => {
    const text = '{"@type": "ItemList", "itemListElement": [\n  {"@type": "ListItem", "position": 1, "name": "A"},\n  {"@type": "ListItem", "position": 2, "name": "B"},\n  {"@type": "ListItem", "position": 3, "name": "C", "weight": 4.50}\n]}';
    const next = moveInText(text, ['itemListElement'], 2, -1);
    expect(next).toBe('{"@type": "ItemList", "itemListElement": [\n  {"@type": "ListItem", "position": 1, "name": "A"},\n  {"@type": "ListItem", "position": 2, "name": "C", "weight": 4.50},\n  {"@type": "ListItem", "position": 3, "name": "B"}\n]}');
    // Plain values just swap.
    expect(moveInText('{"sameAs": ["a", "b"]}', ['sameAs'], 0, 1)).toBe('{"sameAs": ["b", "a"]}');
  });

  it('says what a detail expects, and reads a whole-value link', () => {
    expect(describeExpects('number|text')).toBe('a number, like 4.2');
    expect(describeExpects('item:Person|Organization')).toBe('a person or organization');
    expect(linkOf('{field.field_score}')).toBe('field_score');
    expect(linkOf('{field.field_venue.title}')).toBe('field_venue.title');
    expect(linkOf('By {field.field_byline}')).toBeNull();
  });
});

describe('what a detail expects, in words', () => {
  it('says nothing when nothing is known', async () => {
    const { describeExpects } = await import('./Row');
    expect(describeExpects('')).toBe('');
    expect(describeExpects('date|datetime')).toBe('a date, like 2026-11-13 or a date and time');
  });
});

describe('a date and time with its zone', () => {
  it('says how it is written', () => {
    expect(writtenWords('2026-07-10T09:30+03:00', '2026-07-10', '09:30', 'Europe/Helsinki')).toBe('Written as 2026-07-10T09:30+03:00 (Helsinki, summer time)');
  });
});

describe('an enumeration in words', () => {
  it('drops the word every value ends with', () => {
    const conditions = ['NewCondition', 'UsedCondition', 'RefurbishedCondition', 'DamagedCondition'];
    expect(conditions.map((one) => enumLabel(one, conditions))).toEqual(['New', 'Used', 'Refurbished', 'Damaged']);
    expect(enumLabel('InStock', ['InStock', 'OutOfStock'])).toBe('In Stock');
  });
});

describe('the link menu of a typed value', () => {
  it('lists the fields of its kind first', async () => {
    const { fittingFields } = await import('./Row');
    const fields = [
      { name: 'field_price', label: 'Price', value: '89', kinds: ['number', 'text'] },
      { name: 'field_sku', label: 'SKU', value: 'OAK', kinds: ['text'] },
      { name: 'field_when', label: 'When', value: '', kinds: ['date'] },
    ];
    expect(fittingFields(fields, 'text').fit.map((one) => one.name)).toEqual(['field_price', 'field_sku', 'field_when']);
    expect(fittingFields(fields, 'number|text', 'price').fit.map((one) => one.name)).toEqual(['field_price']);
    expect(fittingFields(fields, 'number', 'price')).toMatchObject({ fit: [{ name: 'field_price' }], other: [{ name: 'field_sku' }, { name: 'field_when' }] });
    // A price is a number, but never a rating's: nothing fits, so the menu
    // lists it under Other fields and no "Link it" advice is given.
    expect(fittingFields(fields, 'number', 'ratingValue')).toMatchObject({ fit: [], other: [{ name: 'field_price' }, { name: 'field_sku' }, { name: 'field_when' }] });
    expect(fittingFields(fields, 'date|datetime').fit.map((one) => one.name)).toEqual(['field_when']);
  });
});

describe('a value of another shape', () => {
  it('says what the detail expects, and that it is kept', async () => {
    const { wrongShapeWords } = await import('./Row');
    expect(wrongShapeWords('Rating value', 'number')).toBe('Not what rating value expects (a number, like 4.2). Kept as written.');
  });
});
