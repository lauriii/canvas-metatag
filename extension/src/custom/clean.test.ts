import { describe, expect, it } from 'vitest';
import { clean, mint } from './clean';

const CTX = { home: 'https://www.example.com/', url: 'https://www.example.com/jobs', langcode: 'en' };

describe('a paste, cleaned', () => {
  it('takes a script tag with @graph and @context apart, in one line', () => {
    const paste = `<script type="application/ld+json">
{"@context": "https://schema.org", "@graph": [
  {"@type": "EmployerAggregateRating", "@id": "#employer-rating", "itemReviewed": {"@id": "#acme-logistics"}, "ratingValue": 4.2, "ratingCount": 318, "bestRating": 5},
  {"@type": "Organization", "@id": "#acme-logistics", "name": "Acme Logistics", "url": "https://acme-logistics.example"}
]}
</script>`;
    const done = clean(paste, CTX);
    expect(done.report).toBe('Cleaned up the paste: took it out of its script tag, split the graph into 2 items and removed the context line.');
    expect(done.items.map((item) => item['@id'])).toEqual(['#employer-rating', '#acme-logistics']);
    expect(done.text).toBe(JSON.stringify(done.items, null, 2));
    expect(done.scripts).toBe(1);
  });

  it('keeps a pasted "__proto__" key as a key', () => {
    const done = clean('{"@type": "Thing", "@id": "#thing", "__proto__": "kept", "name": "A"}', CTX);
    expect(JSON.parse(done.text!)).toEqual(JSON.parse('{"@type": "Thing", "@id": "#thing", "__proto__": "kept", "name": "A"}'));
    expect(done.text).toContain('"__proto__": "kept"');
  });

  it('flattens a top-level list and short names, and reads type and id', () => {
    const done = clean('[{"@context": "http://schema.org/", "type": "schema:Organization", "id": "_:b0", "https://schema.org/name": "Acme"}]', CTX);
    // A blank node is named from its item.
    expect(done.items).toEqual([{ '@type': 'Organization', '@id': '#acme', name: 'Acme' }]);
    expect(done.report).toContain('used short names');
    expect(done.report).toContain('named 1 unnamed item');
  });

  it('drops empty values, never 0 or false, and unwraps values', () => {
    const done = clean(
      '{"@type": "Product", "@id": "#p", "name": {"@value": "Desk"}, "x": null, "y": "", "z": [], "w": {}, "count": 0, "free": false, "steps": {"@list": ["a", "b"]}, "label": [{"@value": "Pöytä", "@language": "fi"}, {"@value": "Desk", "@language": "en"}]}',
      CTX,
    );
    expect(done.items[0]).toEqual({ '@type': 'Product', '@id': '#p', name: 'Desk', count: 0, free: false, steps: ['a', 'b'], label: 'Desk' });
    expect(done.report).toContain('left out 4 empty values');
    expect(done.report).toContain('kept the text in the page’s language');
  });

  it('points this site’s ids at its own items, and keeps long numbers as text', () => {
    const done = clean('{"@type": "Review", "@id": "#r", "author": {"@id": "https://www.example.com/#identity"}, "gtin": 123456789012345678901}', CTX);
    expect(done.items[0].author).toEqual({ '@id': '#identity' });
    expect(done.items[0].gtin).toBe('123456789012345678901');
    expect(done.report).toContain("pointed 1 link at your site's own items");
    expect(done.report).toContain('wrote 1 long number as text');
  });

  it('gives items an id, never a module id or one already taken', () => {
    const taken = new Set(['#acme-logistics']);
    expect(mint({ '@type': 'Organization', name: 'Acme Logistics' }, taken)).toBe('#acme-logistics-2');
    expect(mint({ '@type': 'WebPage' }, new Set())).toBe('#web-page');
    expect(mint({ '@type': 'Thing', name: 'Webpage' }, new Set())).toBe('#webpage-2');
    const done = clean('{"@type": "Organization", "name": "Ålesund Café"}', CTX);
    expect(done.items[0]['@id']).toBe('#alesund-cafe');
    expect(done.report).toContain('gave 1 item a name so it can be linked');
  });

  it('flags escaped text and other systems’ placeholders, says when there is no JSON-LD', () => {
    expect(clean('{"@type": "Thing", "@id": "#t", "name": "Q&amp;A {{ title }}"}', CTX).notes).toEqual([
      'Some values look HTML-escaped (&amp;amp;).',
      "Some values look like another system's placeholders.",
    ]);
    expect(clean('<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">Desk</span></div>', CTX).error).toBe(
      "No JSON-LD found in what you pasted. Microdata isn't imported.",
    );
    expect(clean('x'.repeat(600000), CTX).error).toMatch(/over 512 KB/);
  });

  it('keeps a paste it cannot read as it is', () => {
    expect(clean('{"@type": "Thing" "name": "A"}', CTX)).toMatchObject({ text: null, error: null });
    expect(clean('{"@type": "Thing" "name": "A"}', CTX).kept).toBeUndefined();
  });

  it('keeps what was inside the script tag or fence of a paste it cannot read', () => {
    const inside = '{\n  "@type": "Event",\n  "name": "Open day",\n}';
    const chat = `Here is the JSON-LD:\n\n\`\`\`html\n<script type="application/ld+json">\n${inside}\n</script>\n\`\`\``;
    expect(clean(chat, CTX)).toMatchObject({ text: null, error: null, kept: inside });
    expect(clean(`\`\`\`json\n${inside}\n\`\`\``, CTX).kept).toBe(inside);
  });
});

describe('an id from a name with the components\' prefix', () => {
  it('mints one that is not reserved, and ends', () => {
    expect(mint({ '@type': 'Person', name: 'C. S. Lewis' }, new Set())).toBe('#item-c-s-lewis');
    expect(mint({ '@type': 'Person', name: 'C. S. Lewis' }, new Set(['#item-c-s-lewis']))).toBe('#item-c-s-lewis-2');
    expect(mint({ '@type': 'Thing', name: 'C-Level Executives' }, new Set())).toBe('#item-c-level-executives');
  });

  it('cleans a paste of such an item without an @id', () => {
    const done = clean('{"@type": "Person", "name": "C. S. Lewis"}', CTX);
    expect(done.error).toBeNull();
    expect(done.text).not.toBeNull();
  });
});
