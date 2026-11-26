import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { type ChecksInput, QUIET, checks, countIssues, identityGaps, isOwnNode, notYetText, rankImages, verdictText } from './checks';
import { EMPTY_SCHEMA, REGISTRY, RULES } from './data.test-helper';
import { cascade, imageSize, merge, source, texts as textsOf } from './model';
import type {
  BrokenLink,
  Fact,
  Identity,
  ImageInfo,
  Issue,
  Resolved,
  SeoValues,
  ShareInfo,
  Part,
  SkippedPart,
  SourceRow,
  StatePayload,
} from './types';
import { FACT_KINDS, type Lookup, textOf } from './values';

// A page with nothing to report. Every row below changes one thing.

const IMAGE: ImageInfo = {
  url: 'https://cms.example.com/sites/default/files/pricing.jpg',
  width: 1200,
  height: 630,
  alt: 'Pricing table',
  bytes: 184220,
  mime: 'image/jpeg',
  name: 'Pricing hero',
  thumb: '/sites/default/files/styles/thumbnail/public/pricing.jpg',
  source: 'entity',
};

/** A fact's value; the label is for the reader. */
const text = (_label: string, value: string) => value;

/** Typed text. */
const t = (value: string) => ({ text: value });

const FACTS: Record<Fact, string> = {
  title: 'Pricing',
  description: 'Simple plans for teams of every size.',
  site: 'Example',
  url: 'https://www.example.com/pricing',
  author: 'Ada',
  published: '2026-03-02T09:00:00+02:00',
  modified: '2026-03-04T11:30:00+02:00',
  image: '',
  identity: 'Example',
};

/** A field of the type, linked as a source. */
const field = (name: string, label: string, over: Partial<SourceRow> = {}): SourceRow => ({
  source: { sourceType: 'entity-field', expression: `ℹ︎␜entity:node:article␝${name}␞␟value` },
  label,
  path: [label],
  field: name,
  hop: false,
  kinds: ['text'],
  status: 'ok',
  value: 'A value',
  ...over,
});

const PAGE = 'https://www.example.com/pricing';

const SITE = {
  identity: {
    kind: 'organization' as const,
    name: 'Example Inc',
    separator: '|',
    logo: '6f1c2a0e-5b7d-4c1e-9a53-0d6f7c1b2e44',
    default_image: '',
    colour: '',
    share_fallback: 'card' as const,
same_as: ['https://social.example.com/example'],
  },
  values: {
    robots: { max_image_preview: 'large' as const },
  },
  currency: '',
};

interface Setup {
  target?: SeoValues;
  fromDefault?: SeoValues;
  site?: SeoValues;
  /** Fact name => value. */
  facts?: Partial<Record<Fact, string>>;
  /** The field Description and Image read (Body, Hero image); null for none. */
  via?: Partial<Record<'description' | 'image', string | null>>;
  sources?: SourceRow[];
  broken?: Record<string, BrokenLink>;
  media?: Lookup['media'];
  resolved?: Partial<Resolved> | null;
  robotsMeta?: string;
  canonical?: string;
  input?: Partial<ChecksInput>;
}

function input(setup: Setup = {}): ChecksInput {
  const facts = { ...FACTS, ...setup.facts };
  const lookup: Lookup = {
    facts: Object.fromEntries(
      (Object.keys(facts) as Fact[]).map((name) => [
        name,
        {
          label: name,
          kind: FACT_KINDS[name],
          value: facts[name],
          ...(name === 'image' ? { image: IMAGE } : {}),
          ...((via) => (via ? { via } : {}))(name === 'description' || name === 'image' ? ({ description: 'Body', image: 'Hero image', ...setup.via }[name]) : null),
        },
      ]),
    ),
    sources: setup.sources ?? [],
    broken: setup.broken ?? {},
    media: setup.media ?? {},
    resolvable: true,
  };
  const layers = {
    target: setup.target ?? {},
    from_default: setup.fromDefault ?? {},
    site: setup.site ?? SITE.values,
  };
  const effective = cascade(
    merge(layers.from_default, layers.target),
    layers.site,
  );
  return {
    effective,
    sources: (path) => source(path, layers),
    texts: textsOf(effective, textOf(lookup), '|'),
    lookup,
    separator: '|',
    resolved:
      setup.resolved === null
        ? null
        : {
            head: {
              title: '',
              meta: setup.robotsMeta
                ? [{ name: 'robots', content: setup.robotsMeta }]
                : [],
              link: [
                {
                  rel: 'canonical',
                  href: setup.canonical ?? 'https://www.example.com/pricing',
                },
              ],
              script: [],
            },
            image: IMAGE,
            schema: EMPTY_SCHEMA,
            ...setup.resolved,
          },
    site: SITE,
    registry: REGISTRY,
    rules: RULES,
    home: 'https://www.example.com/',
    url: 'https://www.example.com/pricing',
    ui: 'en',
    facts: {
      h1: ['Pricing'],
      imagesWithoutAlt: [],
      text: 'Pricing Simple plans for teams of every size. Spring launch at the Old Mill.',
    },
    scope: 'page',
    can: { target: true, site: true },
    langcode: 'en',
    ai: false,
    published: true,
    typeLabel: 'Article',
    defaultLanguage: 'English',
    robotsSettled: true,
    // Every character is 7 px wide.
    measurer: (value) => Array.from(value).length * 7,
    ...setup.input,
  };
}

const ids = (issues: Issue[]) => issues.map((issue) => issue.id);
const find = (setup: Setup, id: string) =>
  checks(input(setup)).find((issue) => issue.id === id);

/** Applies an issue's fix to the target values and runs the checks again. */
function afterFix(setup: Setup, id: string): string[] {
  const issue = find(setup, id);
  if (!issue?.fix || !('apply' in issue.fix)) {
    throw new Error(`${id} has no fix`);
  }
  return ids(
    checks(input({ ...setup, target: issue.fix.apply(setup.target ?? {}) })),
  );
}

const long = (words: number) =>
  Array.from({ length: words }, () => 'words').join(' ');

describe('checks()', () => {
  it('a complete page has nothing to report', () => {
    expect(checks(input())).toEqual([]);
  });

  // [rule, severity, what makes it fire, the exact message (and detail)]
  const rows: [string, Issue['severity'], Setup, string | [string, string]][] = [
    [
      'title-empty',
      'fix',
      {
        facts: { title: text('Title', ''), site: text('Site name', '') },
      },
      ['Add a title', 'This page has no title for search results.'],
    ],
    [
      'title-generic',
      'improve',
      { facts: { title: text('Title', 'Home') } },
      ['Make the title specific', '"Home" says little about this page.'],
    ],
    [
      'link-broken:description',
      'fix',
      {
        target: { description: { source: field('field_summary', 'Summary').source } },
        broken: { description: { field: 'field_summary', reason: 'missing' } },
        input: { scope: 'template' },
      },
      ['Link the description again', 'It was linked to field_summary, which no longer exists. Each article uses its default until another field is linked.'],
    ],
    [
      'link-hidden:description',
      'improve',
      {
        target: { description: { source: field('field_notes', 'Notes').source } },
        sources: [field('field_notes', 'Notes', { status: 'hidden', value: '' })],
        input: { scope: 'template' },
      },
      ['Notes is hidden from visitors', 'Description uses its default. Link a field visitors can see.'],
    ],
    [
      'title-site-twice',
      'improve',
      { target: { title: t('Example pricing') } },
      ['Remove the repeated site name', 'The site name appears twice in the title.'],
    ],
    [
      'title-heading',
      'improve',
      {
        input: {
          facts: {
            h1: ['Contact our sales team'],
            imagesWithoutAlt: [],
            text: '',
          },
        },
      },
      'Match the title to the main heading',
    ],
    [
      'title-long',
      'info',
      { target: { title: t(long(14)) } },
      ['Shorten the title', 'May be cut off after “…words words words”.'],
    ],
    [
      'description-missing',
      'improve',
      { facts: { description: text('Description', '') } },
      ['Add a description', 'Without one, search engines pick text from the page.'],
    ],
    [
      'description-long',
      'info',
      { facts: { description: text('Description', long(20)) } },
      ['Shorten the description', 'May be cut off after “…words words words”.'],
    ],
    [
      'description-title',
      'improve',
      { facts: { description: text('Description', 'pricing!') } },
      ['Make the description say more', 'It repeats the title.'],
    ],
    [
      'noindex',
      'improve',
      { target: { robots: { noindex: true } } },
      ['Show this page in search', 'Hidden from search engines. Set on this page.'],
    ],
    [
      'noindex-canonical',
      'improve',
      { target: { robots: { noindex: true }, canonical: '/plans' } },
      'This page is hidden and also points search engines to another address. Use one or the other.',
    ],
    [
      'canonical-elsewhere',
      'info',
      { canonical: 'https://www.example.com/plans' },
      'Search engines are asked to show https://www.example.com/plans instead of this page.',
    ],
    [
      'snippet-off',
      'info',
      { target: { robots: { nosnippet: true } } },
      ['Text previews are off', 'Results show no description and answer engines cannot quote this page.'],
    ],
    [
      'image-preview',
      'info',
      { target: { robots: { max_image_preview: 'none' } } },
      ['Large image previews are off', 'Results show a standard-size image at most.'],
    ],
    [
      'image-missing',
      'improve',
      { resolved: { image: null } },
      ['Add a social image', 'Links to this page will show without one.'],
    ],
    [
      'image-small',
      'info',
      { resolved: { image: { ...IMAGE, width: 800, height: 420 } } },
      ['The social image could be sharper', 'The social image is 800\u00a0×\u00a0420. It works as a large card; 1200\u00a0×\u00a0630 looks sharper.'],
    ],
    [
      'image-ratio',
      'info',
      { resolved: { image: { ...IMAGE, width: 1200, height: 1200 } } },
      ['The social image will be cropped', 'About 1.91:1 fits best.'],
    ],
    [
      'image-heavy',
      'info',
      { resolved: { image: { ...IMAGE, bytes: 6.5 * 1048576 } } },
      ['The social image is 6.5 MB', 'Some services skip images over 5 MB.'],
    ],
    [
      'image-heavy',
      'info',
      { resolved: { image: { ...IMAGE, bytes: 10665459 } } },
      ['The social image is 10.2 MB', 'Some services skip images over 5 MB.'],
    ],
    [
      'image-format',
      'improve',
      { resolved: { image: { ...IMAGE, mime: 'image/svg+xml' } } },
      ['Use JPEG, PNG or WebP', 'SVG images do not show on many services.'],
    ],
    [
      'image-alt',
      'info',
      { resolved: { image: { ...IMAGE, alt: ' ' } } },
      ['The social image has no alt text', 'People who cannot see it get no description.'],
    ],
    [
      'h1-missing',
      'improve',
      { input: { facts: { h1: [], imagesWithoutAlt: [], text: '' } } },
      ['Add a main heading', 'Set one heading in the page to Heading 1. This is done in the page, not here.'],
    ],
    [
      'img-alt',
      'improve',
      {
        input: {
          facts: {
            h1: ['Pricing'],
            imagesWithoutAlt: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'],
            text: '',
          },
        },
      },
      '5 images on the page have no alternative text.',
    ],
    [
      'schema-required:startDate',
      'fix',
      {
        target: { schema: { type: 'Event' } },
        resolved: { schema: { ...EMPTY_SCHEMA, type: 'Event', withheld: { missing: ['startDate'], dropped: [], node: {} } } },
      },
      ['Add a start date', 'The event is left out until it is filled in.'],
    ],
    [
      'feature-helps:event',
      'info',
      {
        target: { schema: { type: 'Event' } },
        resolved: { schema: { ...EMPTY_SCHEMA, type: 'Event', features: [{ feature: 'event', node: `${PAGE}#primary`, verdict: 'ready', helps: [{ path: 'location.name', prop: 'location_name' }, { path: 'endDate', prop: 'endDate' }] }] } },
      },
      // In the form's order, whatever the rules file's.
      ['Also helps the event result: Ends, Venue.', 'Adding them gives the event result more to show.'],
    ],
    [
      'feature-needs:image',
      'improve',
      {
        target: { schema: { type: 'Product' } },
        resolved: { schema: { ...EMPTY_SCHEMA, type: 'Product', features: [{ feature: 'merchant-listing', node: `${PAGE}#primary`, verdict: 'needs', missing: [{ path: 'image', prop: 'image' }] }] } },
      },
      'Add an image for merchant listings',
    ],
    [
      'schema-dates:endDate',
      'improve',
      {
        target: {
          schema: {
            type: 'Event',
            props: {
              startDate: t('2027-03-04T18:00'),
              endDate: t('2027-03-04T16:00'),
            },
          },
        },
      },
      ['Move “Ends” after “Starts”', '“Ends” is before “Starts”.'],
    ],
    [
      'schema-dates:dateModified',
      'improve',
      {
        target: { schema: { type: 'Article' } },
        facts: { modified: '2026-03-01T09:00:00+02:00' },
      },
      ['Move “Updated” after “Published”', '“Updated” is before “Published”.'],
    ],
    [
      'schema-not-on-page:location_name',
      'improve',
      {
        target: {
          schema: { type: 'Event', props: { location_name: t('The New Mill') } },
        },
      },
      ["Couldn't find “The New Mill” on this page", 'Structured data should describe what visitors see.'],

    ],
    [
      'identity-incomplete',
      'info',
      {
        input: {
          site: {
            ...SITE,
            identity: { ...SITE.identity, logo: '', same_as: [] },
          },
        },
      },
      'Search engines know little about who runs this site: no logo, no profile link.',
    ],
    [
      'content-unavailable',
      'info',
      { input: { facts: null } },
      'Content checks need the page preview, which cannot be read here.',
    ],
  ];

  it.each(rows)('%s fires', (id, severity, setup, text) => {
    const issue = find(setup, id);
    const [message, detail] = typeof text === 'string' ? [text] : text;
    expect(issue).toBeDefined();
    expect(issue).toMatchObject({ id, severity, message });
    if (detail !== undefined) {
      expect(issue!.detail).toBe(detail);
    }
    // And it is silent on the complete page.
    expect(find({}, id)).toBeUndefined();
  });

  it('every rule of the design has a row', () => {
    expect([...new Set(rows.map(([id]) => id.split(':')[0]))].sort()).toEqual(
      [
        'title-empty',
        'title-generic',
        'link-broken',
        'link-hidden',
        'title-site-twice',
        'title-heading',
        'title-long',
        'description-missing',
        'description-long',
        'description-title',
        'noindex',
        'noindex-canonical',
        'canonical-elsewhere',
        'snippet-off',
        'image-preview',
        'image-missing',
        'image-small',
        'image-ratio',
        'image-heavy',
        'image-format',
        'image-alt',
        'h1-missing',
        'img-alt',
        'schema-required',
        'feature-helps',
        'feature-needs',
        'schema-dates',
        'schema-not-on-page',
        'identity-incomplete',
        'content-unavailable',
      ].sort(),
    );
  });

  it('a row has a jump, a fix, or says what to do in its detail', () => {
    for (const [id, , setup] of rows) {
      const issue = find(setup, id)!;
      if (id !== 'content-unavailable') {
        expect(issue.jump ?? issue.fix ?? issue.detail, id).toBeDefined();
      }
    }
    expect(
      find(
        { input: { facts: { h1: [], imagesWithoutAlt: [], text: '' } } },
        'h1-missing',
      )!.detail,
    ).toBe(
      'Set one heading in the page to Heading 1. This is done in the page, not here.',
    );
    // A template's heading is set in the template.
    expect(
      find(
        {
          input: {
            scope: 'template',
            facts: { h1: [], imagesWithoutAlt: [], text: '' },
          },
        },
        'h1-missing',
      )!.detail,
    ).toBe(
      "Set one heading in the template's layout to Heading 1. SEO settings cannot set it.",
    );
    // A code is rarely printed as written: no "does not appear" for it.
    const product = find(
      {
        target: {
          schema: {
            type: 'Product',
            props: { offers_priceCurrency: t('EUR'), sku: t('DESK-1') },
          },
        },
        input: { facts: { h1: ['Desk'], imagesWithoutAlt: [], text: 'Desk $2,500' } },
      },
      'schema-not-on-page:offers_priceCurrency',
    );
    expect(product).toBeUndefined();
    expect(
      find(rows.find(([id]) => id === 'img-alt')![2], 'img-alt')!.detail,
    ).toBe('a.jpg, b.jpg, c.jpg and 2 more');
    expect(
      find(
        {
          input: {
            facts: { h1: ['Pricing'], imagesWithoutAlt: ['a.jpg'], text: '' },
          },
        },
        'img-alt',
      ),
    ).toMatchObject({
      message: '1 image on the page has no alternative text.',
      detail: 'a.jpg',
    });
    expect(
      find(rows.find(([id]) => id === 'title-heading')![2], 'title-heading')!
        .detail,
    ).toBe('The title and the main heading say different things.');
    expect(
      find(
        rows.find(([id]) => id === 'schema-required:startDate')![2],
        'schema-required:startDate',
      )!.jump,
    ).toEqual({
      scope: 'target',
      tab: 'schema',
      field: 'schema.props.startDate',
    });
  });
});

describe('fixes', () => {
  it.each([
    // The page's own words name the site, and its ending is the site name:
    // no ending.
    [
      'title-site-twice',
      { target: { title: t('Example pricing') } },
      { title: t('Example pricing'), title_end: t('') },
    ],
    [
      'title-site-twice',
      { target: { title: t('Plans at Example'), title_end: { fact: 'site' } } },
      { title: t('Plans at Example'), title_end: t('') },
    ],
    [
      'noindex',
      { target: { robots: { noindex: true } } },
      { robots: { noindex: false } },
    ],
    [
      'snippet-off',
      { target: { robots: { nosnippet: true } } },
      { robots: { nosnippet: false, max_snippet: -1 } },
    ],
    [
      'snippet-off',
      { target: { robots: { max_snippet: 0 } } },
      { robots: { nosnippet: false, max_snippet: -1 } },
    ],
    [
      'image-preview',
      { target: { robots: { max_image_preview: 'standard' } } },
      { robots: { max_image_preview: 'large' } },
    ],
    [
      'image-preview',
      { target: { robots: { max_image_preview: 'none' } }, site: {} },
      { robots: { max_image_preview: 'large' } },
    ],
  ] as [string, Setup, SeoValues][])(
    '%s: applying the fix clears the issue (%j)',
    (id, setup, applied) => {
      const issue = find(setup, id)!;
      expect('apply' in issue.fix! && issue.fix.apply(setup.target!)).toEqual(
        applied,
      );
      expect(afterFix(setup, id)).not.toContain(id);
    },
  );

  it('fix labels', () => {
    const label = (setup: Setup, id: string) => find(setup, id)!.fix!.label;
    expect(
      label(
        { target: { title: t('Example pricing') } },
        'title-site-twice',
      ),
    ).toBe('Remove the repeat');
    expect(label({ target: { robots: { noindex: true } } }, 'noindex')).toBe(
      'Show in search results',
    );
    expect(
      label({ target: { robots: { nosnippet: true } } }, 'snippet-off'),
    ).toBe('Allow text previews');
    expect(
      label(
        { target: { robots: { max_image_preview: 'none' } } },
        'image-preview',
      ),
    ).toBe('Allow large previews');
  });

  it('a fix exists only where the value is set on the target', () => {
    const bySite = {
      site: {
        ...SITE.values,
        robots: {
          noindex: true,
          nosnippet: true,
          max_image_preview: 'none' as const,
        },
      },
    };
    for (const id of ['noindex', 'snippet-off', 'image-preview']) {
      expect(find(bySite, id)!.fix).toBeUndefined();
    }
    // The repeat comes from the page title itself: nothing typed to remove.
    expect(
      find(
        { facts: { title: text('Title', 'Example pricing') } },
        'title-site-twice',
      )!.fix,
    ).toBeUndefined();
    // A main part linked to the Title fact: one item's words, never a fix.
    expect(
      find(
        {
          target: { title: { fact: 'title' } },
          facts: { title: 'Example pricing' },
          input: { scope: 'template' },
        },
        'title-site-twice',
      )!.fix,
    ).toBeUndefined();
    // An ending of its own that is not the site name: not certain.
    expect(
      find(
        { target: { title: t('Example and Example pricing'), title_end: t('Docs') } },
        'title-site-twice',
      )!.fix,
    ).toBeUndefined();
  });

  it("leaves the length to the module while it writes the description from the page's own text", () => {
    const run = (setup: Setup) => {
      const one = input({ facts: { description: long(25) }, ...setup });
      one.lookup.facts.description!.derived = true;
      return checks(one).find((issue) => issue.id === 'description-long');
    };
    expect(run({})).toBeUndefined();
    // Typed, the editor's own: listed.
    expect(run({ target: { description: t(long(25)) } })).toBeDefined();
  });

  it('suggest is offered at page scope with AI only', () => {
    const missing = { facts: { description: text('Description', '') } };
    expect(find(missing, 'description-missing')!.fix).toBeUndefined();
    expect(
      find({ ...missing, input: { ai: true } }, 'description-missing')!.fix,
    ).toEqual({ label: 'Suggest', suggest: 'description' });
    // At template scope it is said for the item, with nothing to suggest.
    expect(
      find(
        { ...missing, input: { ai: true, scope: 'template' } },
        'value-empty:description',
      )!.fix,
    ).toBeUndefined();
    expect(
      find(
        {
          facts: { description: text('Description', long(25)) },
          input: { ai: true },
        },
        'description-long',
      )!.fix,
    ).toEqual({
      label: 'Suggest',
      suggest: 'description',
    });
  });
});

describe('rules that need the page preview', () => {
  it('are silent without facts, and say so once', () => {
    const without = checks(
      input({
        target: {
          schema: {
            type: 'Event',
            props: { location_name: t('Nowhere to be found') },
          },
        },
        input: { facts: null },
      }),
    );
    expect(
      ids(without).filter((id) =>
        /^(title-heading|h1-missing|img-alt|schema-not-on-page)/.test(id),
      ),
    ).toEqual([]);
    expect(
      ids(without).filter((id) => id === 'content-unavailable'),
    ).toHaveLength(1);
  });

  it('title-heading is silent for an identical two-character title and heading', () => {
    const setup: Setup = {
      target: { title: t('价格') },
      input: { facts: { h1: ['价格'], imagesWithoutAlt: [], text: '' } },
    };
    expect(find(setup, 'title-heading')).toBeUndefined();
  });

  it('title-heading is silent for a title that contains the heading, and for a shared word', () => {
    const facts = (h1: string) => ({
      input: { facts: { h1: [h1], imagesWithoutAlt: [], text: '' } },
    });
    expect(
      find(
        {
          target: { title: t('Pricing and plans') },
          ...facts('Pricing'),
        },
        'title-heading',
      ),
    ).toBeUndefined();
    expect(
      find(
        { target: { title: t('Plans') }, ...facts('Our plans, compared') },
        'title-heading',
      ),
    ).toBeUndefined();
    expect(
      find(
        { target: { title: t('Team plans') }, ...facts('Plans for teams') },
        'title-heading',
      ),
    ).toBeUndefined();
    // Short Latin words do not count as shared; two characters do in other scripts.
    expect(
      find(
        { target: { title: t('How we do it'), title_end: t('') }, ...facts('What we do') },
        'title-heading',
      ),
    ).toBeDefined();
    expect(
      find(
        { target: { title: t('价格 方案') }, ...facts('方案 比较') },
        'title-heading',
      ),
    ).toBeUndefined();
    // More than one main heading is not a check.
    expect(
      find(
        {
          input: {
            facts: { h1: ['Contact', 'Sales'], imagesWithoutAlt: [], text: '' },
          },
        },
        'title-heading',
      ),
    ).toBeUndefined();
  });

  it('schema-not-on-page compares typed text only, normalized', () => {
    const event = (props: Record<string, string | { fact: Fact }>): Setup => ({
      target: {
        schema: {
          type: 'Event',
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, typeof value === 'string' ? t(value) : value]),
          ),
        },
      },
      input: { scope: 'template' },
    });
    expect(
      find(
        event({ location_name: 'the old mill' }),
        'schema-not-on-page:location_name',
      ),
    ).toBeUndefined();
    // Linked to a fact, a value is compared too, named by its value, and
    // its source said.
    expect(
      find(
        event({ location_name: { fact: 'author' } }),
        'schema-not-on-page:location_name',
      ),
    ).toMatchObject({ message: 'Couldn’t find “Ada” on this page'.replace('’', "'"), detail: 'It comes from author. Structured data should describe what visitors see.' });
    // Braces are typed text, compared as written.
    expect(
      find(
        event({ location_name: '{title} hall' }),
        'schema-not-on-page:location_name',
      ),
    ).toBeDefined();
    // A code, an identifier or an option is never compared with the text.
    expect(
      ids(checks(input({ target: { schema: { type: 'Product', props: { sku: t('LAMP-1'), offers_priceCurrency: t('EUR'), offers_availability: t('InStock') } } } }))).filter((id) =>
        id.startsWith('schema-not-on-page'),
      ),
    ).toEqual([]);
  });

  it("schema-not-on-page reads a detail's Description as the head gives it", () => {
    // The description is set: the summary and words of its own. A detail
    // linked to Description gives that, and is looked for as that.
    const set = (text: string): Setup => ({
      target: {
        description: { parts: [{ fact: 'description' }, { text: ' Launch at the Mill.' }] },
        schema: { type: 'Article', props: { headline: { fact: 'description' } } },
      },
      facts: { description: 'Plans for every team.' },
      input: { scope: 'template', facts: { h1: ['Pricing'], imagesWithoutAlt: [], text } },
    });
    expect(find(set('Plans for every team. Launch at the Mill.'), 'schema-not-on-page:headline')).toBeUndefined();
    expect(find(set('Plans for every team.'), 'schema-not-on-page:headline')?.message).toBe(
      "Couldn't find “Plans for every team. Launch at the Mill.” on this page",
    );
  });

  it('finds dates four ways, and images by their file', () => {
    const on = (text: string, images: string[] = []): Setup['input'] => ({ facts: { h1: ['Pricing'], imagesWithoutAlt: [], text, images } });
    const starts = { target: { schema: { type: 'Event', props: { startDate: t('2027-03-04') } } } };
    for (const text of ['March 4, 2027', 'Mar 4, 2027', '3/4/27', 'On 2027-03-04 at six']) {
      expect(find({ ...starts, input: on(`Doors open ${text}.`) }, 'schema-not-on-page:startDate'), text).toBeUndefined();
    }
    expect(find({ ...starts, input: on('Doors open soon.') }, 'schema-not-on-page:startDate')?.message).toBe("Couldn't find the date 4 March 2027 on this page");
    // An image by its file, whatever size the page shows it at.
    const image = { target: { schema: { type: 'Product', props: { image: { media: 'lamp' } } } } };
    const media = { lamp: { name: 'Oak lamp', thumb: '/files/styles/medium/public/oak-lamp.png.webp?itok=a', width: 1200, height: 1200 } };
    expect(find({ ...image, media, input: on('', ['/files/styles/large/public/oak-lamp.png.avif?itok=b']) }, 'schema-not-on-page:image')).toBeUndefined();
    expect(find({ ...image, media, input: on('', ['/files/other.png']) }, 'schema-not-on-page:image')?.message).toBe("Couldn't find the image “Oak lamp” on this page");
  });

  it('finds a price only next to a currency, with its period', () => {
    const graph = (offers: Record<string, unknown>) => ({
      head: { title: '', meta: [], link: [], script: [{ type: 'application/ld+json', textContent: { '@graph': [{ '@id': `${PAGE}#primary`, '@type': 'Product', name: 'Studio', offers: { '@type': 'Offer', ...offers } }] } }] },
      image: null,
      schema: { ...EMPTY_SCHEMA, type: 'Product' },
    });
    const price = (text: string, offers: Record<string, unknown> = { price: '2500', priceCurrency: 'EUR' }) =>
      find({ target: { schema: { type: 'Product', props: { offers_price: t('2500') } } }, resolved: graph(offers), input: { facts: { h1: [], imagesWithoutAlt: [], text } } }, 'schema-not-on-page:offers_price');
    expect(price('Studio: €2,500, paid once.')).toBeUndefined();
    expect(price('Studio 2.500 EUR')).toBeUndefined();
    // A number that is not next to a currency is not a price.
    expect(price('Trusted by 2,500 customers.')?.message).toBe("Couldn't find €2,500 on this page");
    // Shown per month, stored as a one-time price.
    expect(price('Studio €2,500 / month')).toMatchObject({
      message: "Couldn't find €2,500 as a one-time price on this page: it says €2,500 a month.",
      // Billed is where that is said.
      detail: 'If it is paid every month or year, say so in Billed.',
      jump: { field: 'schema.props.billing' },
    });
    // Billed every month: found.
    expect(price('Studio €2,500 / month', { price: '2500', priceCurrency: 'EUR', priceSpecification: { billingDuration: 'P1M' } })).toBeUndefined();
    // The same amount in another currency: said, and Currency is where it is fixed.
    expect(price('Studio $2,500')).toMatchObject({
      message: "Couldn't find €2,500 on this page: it says $2,500.",
      jump: { field: 'schema.props.offers_priceCurrency' },
    });
    // A draft that is not a number is not compared: no "NaN".
    expect(find({ target: { schema: { type: 'Product', props: { offers_price: t('Euro89') } } }, resolved: graph({ price: '89', priceCurrency: 'EUR' }), input: { facts: { h1: [], imagesWithoutAlt: [], text: 'Nothing' } } }, 'schema-not-on-page:offers_price')).toBeUndefined();
  });

  it('lists the page\'s own images first, then those picked in this session', () => {
    const item = (uuid: string, file: string) => ({ uuid, thumb: `/files/styles/thumbnail/public/${file}.webp?itok=x` });
    const items = [item('a', 'logo.png'), item('b', 'picked.png'), item('c', 'hero.jpg'), item('d', 'other.png')];
    const ranked = rankImages(items, ['/files/styles/large/public/hero.jpg?itok=y'], ['b']);
    expect(ranked.map((one) => one.uuid)).toEqual(['c', 'b', 'a', 'd']);
    // Nothing on the page, nothing picked: the library's order.
    expect(rankImages(items, [], []).map((one) => one.uuid)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a feature that needs an image offers the chooser and shows the field', () => {
    const image = find(
      { target: { schema: { type: 'Product' } }, resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, type: 'Product', features: [{ feature: 'merchant-listing', node: `${PAGE}#primary`, verdict: 'needs', missing: [{ path: 'image', prop: 'image' }] }] } } },
      'feature-needs:image',
    );
    expect(image).toMatchObject({ fix: { label: 'Choose an image' }, jump: { field: 'schema.props.image' } });
  });

  it('checks hand-added items: text nobody can see, reviews of yourself, ratings', () => {
    const hand = (items: Record<string, unknown>[], rules: Resolved['schema']['rules'] = [], text = 'Pricing Simple plans for teams.') =>
      checks(input({
        target: { schema: { custom: JSON.stringify(items) } },
        resolved: {
          head: { title: '', meta: [], link: [], script: [{ type: 'application/ld+json', textContent: { '@graph': [{}, {}, {}, ...items] } }] },
          image: null,
          schema: { ...EMPTY_SCHEMA, nodes: items.map((item, at) => ({ id: typeof item['@id'] === 'string' ? PAGE + item['@id'] : null, type: String(item['@type']), origin: 'hand' as const, item: at, at: at + 3 })), rules },
        },
        input: { facts: { h1: [], imagesWithoutAlt: [], text } },
      }));
    const faq = { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Is the shade dimmable?', acceptedAnswer: { '@type': 'Answer', text: 'Yes.' } }] };
    const hidden = hand([faq]).find((issue) => issue.id === 'hand-hidden:0');
    expect(hidden).toMatchObject({ severity: 'fix', message: 'Couldn’t find the question “Is the shade dimmable?” on this page'.replace('’', "'"), recheck: 'Check again' });
    // Leaving it out lists it, and keeps the JSON-LD; an item without an
    // @id is given one first.
    const fix = hidden!.fix as { apply(values: SeoValues): SeoValues; undo(values: SeoValues): string };
    const left = fix.apply({ schema: { custom: JSON.stringify([faq]) } });
    expect(left.schema?.skip).toEqual(['#faqpage']);
    expect(JSON.parse(left.schema!.custom!)[0]).toEqual({ '@id': '#faqpage', ...faq });
    // The bar says so, wherever the fix is pressed.
    expect(fix.undo({ schema: { custom: JSON.stringify([faq]) } })).toBe('Gave the item the id #faqpage so it can be left out.');
    const named = hand([{ '@id': '#faq', ...faq }]).find((issue) => issue.id === 'hand-hidden:0')!.fix as typeof fix;
    expect(named.undo({ schema: { custom: JSON.stringify([{ '@id': '#faq', ...faq }]) } })).toBe('Left out until it is on the page');
    // An unsent edit moved it: the item the report named is still the one
    // left out, by its id.
    expect(named.apply({ schema: { custom: JSON.stringify([{ '@type': 'Thing' }, { '@id': '#faq', ...faq }]) } }).schema?.skip).toEqual(['#faq']);
    // The JSON-LD no longer holds it: no fix that would do nothing.
    const gone = checks(input({
      target: { schema: { custom: JSON.stringify([{ '@type': 'Thing' }]) } },
      resolved: {
        head: { title: '', meta: [], link: [], script: [{ type: 'application/ld+json', textContent: { '@graph': [{}, {}, {}, faq] } }] },
        image: null,
        schema: { ...EMPTY_SCHEMA, nodes: [{ id: null, type: 'FAQPage', origin: 'hand' as const, item: 0, at: 3 }] },
      },
      input: { facts: { h1: [], imagesWithoutAlt: [], text: 'Pricing' } },
    })).find((issue) => issue.id === 'hand-hidden:0');
    expect(gone).toBeDefined();
    expect(gone!.fix).toBeUndefined();
    // On the page: nothing to fix.
    expect(ids(hand([faq], [], 'Is the shade dimmable? Yes.'))).not.toContain('hand-hidden:0');

    // Reviews of your own organization are to fix; the rules come from the server.
    const own = hand([{ '@type': 'Review', name: 'Pricing' }], [{ rule: 'own_reviews', item: 0, node: null }]);
    expect(own.find((issue) => issue.id === 'hand-reviews:0')).toMatchObject({ severity: 'fix', message: 'No review stars for reviews of your own organization.' });
    // Two of them are told apart: a review by its author, else by its name.
    const two = hand([{ '@type': 'Review', author: { '@type': 'Person', name: 'Ann' } }, { '@type': 'Review', name: 'Pricing' }], [{ rule: 'own_reviews', item: 0, node: null }, { rule: 'own_reviews', item: 1, node: null }]);
    expect(two.filter((issue) => issue.id.startsWith('hand-reviews:')).map((issue) => issue.detail?.split(':')[0])).toEqual(['The review by Ann', 'Pricing']);
    // Reviews added as details to the identity and the page: two rows, each
    // opening its own Add details sheet.
    const added = hand([], [{ rule: 'own_reviews', item: -1, node: 'https://www.example.com/#identity' }, { rule: 'own_reviews', item: -1, node: `${PAGE}#webpage` }]).filter((issue) => issue.id.startsWith('hand-reviews:'));
    expect(added.map((issue) => issue.id)).toEqual(['hand-reviews:-1:#identity', 'hand-reviews:-1:#webpage']);
    expect(added.map((issue) => issue.detail?.split(':')[0])).toEqual(["Your site's organization", 'This page']);
    expect(added.map((issue) => issue.jump)).toEqual([
      { scope: 'site', field: 'schema.extend.#identity', tab: 'schema' },
      { scope: 'target', field: 'schema.extend.#webpage', tab: 'schema' },
    ]);
    // A second identity points at the identity by its full address.
    const copy = hand([{ '@type': 'Organization', name: 'Pricing' }], [{ rule: 'second_identity', item: 0, node: null }]);
    expect(copy.find((issue) => issue.id === 'hand-identity:0')?.detail).toBe('This is your site\'s organization. Point to it with “@id”: “https://www.example.com/#identity” instead.');
    // A reference to an item of the site that is not here, and an address
    // that is not a full one.
    const dangling = hand([{ '@type': 'Thing', name: 'Pricing' }], [{ rule: 'dangling', item: 0, node: null, value: 'https://www.example.com/#logo' }]);
    expect(dangling.find((issue) => issue.id.startsWith('hand-dangling:0'))).toMatchObject({ severity: 'improve', message: "Points to https://www.example.com/#logo, which isn't on this page" });
    const relative = hand([{ '@type': 'Thing', name: 'Pricing' }], [{ rule: 'relative', item: 0, node: null, value: '/about' }]);
    expect(relative.find((issue) => issue.id.startsWith('hand-relative:0'))).toMatchObject({ severity: 'improve', message: 'Use a full address for “/about”' });
    // A rating the page never shows.
    const rating = hand([{ '@type': 'AggregateRating', name: 'Pricing', ratingValue: '4.8', reviewCount: '12' }], [], 'Pricing Rated 4,8 by 12 people.');
    expect(ids(rating).filter((id) => id.startsWith('hand-rating'))).toEqual([]);
    expect(hand([{ '@type': 'AggregateRating', name: 'Pricing', ratingValue: '4.8' }]).find((issue) => issue.id.startsWith('hand-rating'))?.message).toBe("Couldn't find the rating 4.8 on this page");
    // A value that is not a plain number is looked for as written, never run
    // as a pattern.
    for (const value of ['(4.5', '*4', '[5', '4.5.1']) {
      const odd = hand([{ '@type': 'AggregateRating', name: 'Pricing', ratingValue: value }]);
      expect(odd.find((issue) => issue.id.startsWith('hand-rating'))?.message).toBe(`Couldn't find the rating ${value} on this page`);
    }
    expect(ids(hand([{ '@type': 'AggregateRating', name: 'Pricing', ratingValue: '(4.5' }], [], 'Pricing Rated (4,5) by many.')).filter((id) => id.startsWith('hand-rating'))).toEqual([]);
  });

  it('compares values from components with the page, and lists skipped components to builders', () => {
    const report = (schema: Partial<Resolved['schema']>, extra: Partial<ChecksInput> = {}) =>
      checks(input({ resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, ...schema } }, input: extra }));
    // A plan the pricing table holds with its display switched off.
    const plans = { sources: { offers_price: 'component' as const }, from_components: { name: { label: 'Pricing table', value: 'Starter' } } };
    const product = checks(
      input({ target: { schema: { type: 'Product' } }, resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, ...plans, type: 'Product' } } }),
    );
    expect(product.find((issue) => issue.id === 'schema-component-not-on-page:name')).toMatchObject({
      severity: 'improve',
      message: "Couldn't find “Starter” on this page",
      detail: 'It comes from the Pricing table component. Put it on the page, or change the text in the component. Structured data should describe what visitors see.',
      // Show lands on the detail it fills.
      jump: { field: 'schema.props.name' },
    });
    // A web page has no field for it: no Show that leads nowhere.
    const elsewhere = report(plans).find((issue) => issue.id === 'schema-component-not-on-page:name');
    expect(elsewhere).toMatchObject({ severity: 'improve' });
    expect(elsewhere?.jump).toBeUndefined();
    expect(report(plans, { facts: { h1: ['Pricing'], imagesWithoutAlt: [], text: 'Pricing Starter €10 a month' } }).map((issue) => issue.id)).not.toContain('schema-component-not-on-page:name');
    // Without the page's text, nothing is compared.
    expect(report(plans, { facts: null }).map((issue) => issue.id)).not.toContain('schema-component-not-on-page:name');

    const skipped_parts: SkippedPart[] = [
      { uuid: 'a', component: 'js.pricing', label: 'Pricing table', owner: 'page', reason: 'prop-missing', prop: 'monthlyPrice', version: '3e9baf3c7cc35f84' },
      { uuid: 'b', component: 'js.hero', label: 'Hero', owner: 'region', reason: 'error' },
      { uuid: 'c', component: 'p13n.case', label: 'Personalization Case', owner: 'page', reason: 'personalized' },
      { uuid: 'd', component: 'js.card', label: 'Card', owner: 'page', reason: 'cacheability' },
      { uuid: 'e', component: 'js.card', label: 'Card', owner: 'page', reason: 'access', prop: 'title' },
      { uuid: '', component: '', label: '', reason: 'error' },
    ];
    const rows = report({ skipped_parts }).filter((issue) => issue.id.startsWith('component-skipped:'));
    // Something to know, never counted: nothing in this dialog changes them.
    // A renamed prop names the component, where it is and the prop in words;
    // never the version.
    // One statement each: what is left out, and where; the reason and the
    // remedy in the detail, the component named once.
    expect(rows.map((issue) => [issue.severity, issue.message, issue.detail])).toEqual([
      ['info', "The Pricing table's monthly price on this page is left out", 'The component is an older version without “Monthly price”. Replace it with the current version.'],
      ['info', "The Hero around the page couldn't be read", 'Details are in the site log. The rest of the page is described as usual.'],
      ['info', 'The Card on this page is left out', 'What it shows changes for each visitor, or over time.'],
      // What visitors can't see: the outcome, never "publish the prop".
      ['info', "The Card's title on this page is left out", "Visitors can't see it."],
      ['info', "This page's components couldn't be read", 'Details are in the site log. The rest of the page is described as usual.'],
    ]);
    expect(rows[0].id).toBe('component-skipped:js.pricing:prop-missing:monthlyPrice:page');
    // Copies of one component skipped for one reason: one row with the count.
    const cards: SkippedPart[] = ['f', 'g', 'h'].map((uuid) => ({ uuid, component: 'js.card', label: 'Card', owner: 'page', reason: 'access', prop: 'image' }));
    const broken: SkippedPart[] = ['i', 'j'].map((uuid) => ({ uuid, component: 'js.card', label: 'Card', owner: 'page', reason: 'error' }));
    const older: SkippedPart[] = ['k', 'l', 'm', 'n'].map((uuid) => ({ uuid, component: 'js.card', label: 'Card', owner: 'page', reason: 'prop-missing', prop: 'title', version: uuid }));
    expect(
      report({ skipped_parts: [...cards, ...broken, ...older] })
        .filter((issue) => issue.id.startsWith('component-skipped:'))
        .map((issue) => [issue.message, issue.detail]),
    ).toEqual([
      ["The Card's image on this page is left out in 3 places", "Visitors can't see it."],
      ["The Card on this page couldn't be read in 2 places", 'Details are in the site log. The rest of the page is described as usual.'],
      ["The Card's title on this page is left out in 4 places", 'The components are older versions without “Title”. Replace them with the current version.'],
    ]);
    // One component skipped in two places: a row for each place, each saying
    // where.
    expect(
      report(
        {
          skipped_parts: [
            { uuid: 'p', component: 'js.card', label: 'Card', owner: 'page', reason: 'cacheability' },
            { uuid: 'q', component: 'js.card', label: 'Card', owner: 'region', reason: 'cacheability' },
            { uuid: 'r', component: 'js.card', label: 'Card', owner: 'region', reason: 'access', prop: 'image' },
          ],
        },
      )
        .filter((issue) => issue.id.startsWith('component-skipped:'))
        .map((issue) => issue.message),
    ).toEqual(['The Card on this page is left out', 'The Card around the page is left out', "The Card's image around the page is left out"]);
    // Where it is placed, in words.
    const placed = (owner: SkippedPart['owner']) =>
      report({ skipped_parts: [{ uuid: 'o', component: 'js.card', label: 'Card', owner, reason: 'prop-missing', prop: 'title' }] }, { scope: 'template', typeLabel: 'Article' }).find((issue) =>
        issue.id.startsWith('component-skipped:'),
      )?.message;
    expect(placed('template')).toBe("The Card's title in the Article template is left out");
    expect(placed('item')).toBe("The Card's title on this article is left out");
    expect(placed('region')).toBe("The Card's title around the page is left out");
    // Only for those who can change the site's settings.
    expect(report({ skipped_parts }, { can: { target: true, site: false } }).filter((issue) => issue.id.startsWith('component-skipped:'))).toEqual([]);
    // A trail added by hand with one item: what it needs, and where.
    const handTrail = { '@type': 'BreadcrumbList', '@id': `${PAGE}#trail`, itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Team' }] };
    const needsRow = checks(
      input({
        resolved: {
          head: { title: '', meta: [], link: [], script: [{ type: 'application/ld+json', textContent: { '@graph': [handTrail] } }] },
          image: null,
          schema: { ...EMPTY_SCHEMA, features: [{ feature: 'breadcrumb', node: `${PAGE}#trail`, verdict: 'needs', missing: [{ path: 'itemListElement.name', rule: 0 }] }] },
        },
      }),
    ).find((issue) => issue.id.startsWith('feature-needs:'));
    expect(needsRow).toMatchObject({ message: 'Add a second named item to your breadcrumb trail', detail: 'You added this breadcrumb trail by hand. It can show in results once it has one.' });
    // The page's own trail has two crumbs or more: it can show, and is no row.
    const trail = report({ features: [{ feature: 'breadcrumb', node: `${PAGE}#breadcrumb`, verdict: 'ready' }] });
    expect(trail.filter((issue) => /breadcrumb/.test(issue.id) || /Breadcrumb/.test(issue.message))).toEqual([]);
  });

  it('words what became of hand-added JSON-LD and added details', () => {
    const report = (schema: Partial<Resolved['schema']>, target: SeoValues = {}, extra: Partial<ChecksInput> = {}) =>
      checks(input({ target, resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, ...schema } }, input: extra }));
    // A price clash: the page's own value is used.
    const clash = report({ type: 'Product', clashes: [{ node: '#primary', path: 'offers.price', prop: 'offers_price' }] }, { schema: { type: 'Product', extend: { '#primary': '{"offers": {"price": 79}}' } } });
    expect(clash.find((issue) => issue.id.startsWith('extend-clash:'))).toMatchObject({ severity: 'improve', message: "“offers.price” comes from the Price field, so the added value isn't used", jump: { field: 'schema.extend.#primary' } });
    expect(report({ clashes: [{ node: '#identity', path: 'name' }] }).find((issue) => issue.id.startsWith('extend-clash:'))).toMatchObject({ message: "“name” comes from the site settings, so the added value isn't used", jump: { scope: 'site' } });
    // A byline inside text: listed to improve, the sheet's amber.
    const inside = report({}, { schema: { custom: '{"@type": "Book", "name": "By {field.field_byline}"}' } });
    expect(inside.find((issue) => issue.id.startsWith('hand-inside:'))).toMatchObject({ severity: 'improve', message: 'This name is only filled when it is the whole value.' });
    expect(ids(report({}, { schema: { custom: '{"@type": "Book", "name": "{field.field_byline}"}' } })).filter((id) => id.startsWith('hand-inside'))).toEqual([]);
    // A review without a score.
    const empty = checks(input({
      target: { schema: { custom: '{"@type": "Review", "reviewRating": {"@type": "Rating", "ratingValue": "{field.field_score}"}}' } },
      sources: [field('field_score', 'Score', { kinds: ['number'], status: 'empty', value: '' })],
      resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, empty: [{ path: 'reviewRating.ratingValue', item: 0, name: 'field_score', status: 'empty' }] } },
      input: { scope: 'template', typeLabel: 'Book review' },
    }));
    expect(empty.find((issue) => issue.id.startsWith('hand-empty:'))).toMatchObject({ severity: 'improve', message: 'No Score for this book review, so its rating is left out.', jump: { field: 'schema.custom', at: { item: 0, path: 'reviewRating.ratingValue' } } });
    // The server names a field link with its prefix, and a node by its address.
    const named = checks(input({
      target: { schema: { custom: '{"@type": "Review", "reviewRating": {"@type": "Rating", "ratingValue": "{field.field_score}"}, "itemReviewed": {"@id": "#primary"}}' } },
      sources: [field('field_score', 'Score', { kinds: ['number'], status: 'empty', value: '' })],
      resolved: {
        head: { title: '', meta: [], link: [], script: [] },
        image: null,
        schema: { ...EMPTY_SCHEMA, empty: [{ path: 'reviewRating.ratingValue', item: 0, name: 'field.field_score', status: 'empty' }, { path: 'itemReviewed', item: 0, name: 'https://site.example/node/92#primary', status: 'absent' }] },
      },
      input: { scope: 'template', typeLabel: 'Product' },
    })).filter((issue) => issue.id.startsWith('hand-empty:'));
    expect(named.map((issue) => issue.message)).toEqual(['No Score for this product, so its rating is left out.', "The product isn't output here, so its item reviewed is left out."]);
    // Too much: to fix, with the other tags still output.
    expect(report({ over: true }).find((issue) => issue.id === 'hand-over')).toMatchObject({ severity: 'fix', message: 'Your own JSON-LD was left out: the structured data would be over 256 KB.', detail: expect.stringContaining('The other tags are still output.') });
    expect(report({ unencodable: true }, { schema: { custom: '{"@type": "Thing"}' } }).find((issue) => issue.id === 'schema-unencodable')).toMatchObject({ severity: 'fix', detail: 'The other tags are still output. Check your own JSON-LD and added details.' });
    // No address on a host no visitor reaches: one issue to fix, in an
    // editor's words, pointing at the status report; no setting named.
    expect(report({ unaddressed: true }).filter((issue) => issue.id === 'unaddressed')).toEqual([
      expect.objectContaining({
        severity: 'fix',
        message: 'Page addresses are left out',
        detail: "Visitors can't reach the site's public address, so links to this page, share links, language links and structured data are left out. An administrator can fix this; the status report says how.",
      }),
    ]);
    expect(ids(report({}))).not.toContain('unaddressed');
    // A main thing not used.
    expect(report({ main: { id: `${PAGE}#x`, ignored: 'kind' } }).find((issue) => issue.id === 'hand-main-kind')?.severity).toBe('info');
    expect(report({ main: { id: `${PAGE}#x`, ignored: 'absent' } }).find((issue) => issue.id === 'hand-main-absent')?.severity).toBe('improve');
    // French without the rating: good to know.
    const french = report({}, {}, { source: { language: 'English', count: 2 } });
    expect(french.find((issue) => issue.id === 'hand-translation')).toMatchObject({ severity: 'info', message: "The English version has 2 hand-added items this translation doesn't.", jump: { scope: 'target', field: 'schema.custom', tab: 'schema' } });
    expect(ids(report({}, { schema: { custom: '{"@type": "Thing"}' } }, { source: { language: 'English', count: 2 } }))).not.toContain('hand-translation');
    // Stored before a rule, and left unsaved in the sheet.
    expect(report({}, {}, { refused: 'ratingValue: this number is too large to use.' }).find((issue) => issue.id === 'hand-refused')).toMatchObject({ severity: 'fix', detail: 'ratingValue: this number is too large to use.' });
    expect(report({}, {}, { unsaved: true }).find((issue) => issue.id === 'hand-unsaved')).toMatchObject({ severity: 'fix', message: 'Not saved: your own JSON-LD has a problem' });
    // A clash opens the added details on its value.
    expect(clash.find((issue) => issue.id.startsWith('extend-clash:'))?.jump?.at).toEqual({ item: 0, path: 'offers.price' });
  });

  it('names what a site setting needs, by its own feature, for those who may set it', () => {
    const logo = (can = true) =>
      checks(input({
        resolved: {
          head: { title: '', meta: [], link: [], script: [] },
          image: null,
          schema: { ...EMPTY_SCHEMA, features: [{ feature: 'organization-logo', node: 'https://www.example.com/#identity', verdict: 'needs', missing: [{ path: 'logo.width', site: 'identity.logo', rule: 0 }] }] },
        },
        input: { can: { target: true, site: can } },
      })).find((issue) => issue.id.startsWith('feature-needs:'));
    expect(logo()).toMatchObject({ severity: 'improve', message: 'Add a logo at least 112 pixels wide for the logo in results', jump: { scope: 'site', field: 'identity.logo' } });
    // Without the right to change the site, nothing to count.
    expect(logo(false)).toBeUndefined();
  });

  it('says an unknown stored kind, a product named after its page, and no search feature', () => {
    const schema = (over: Partial<Resolved['schema']>, values: SeoValues, more: Partial<ChecksInput> = {}, graph: Record<string, unknown>[] = []) =>
      checks(input({
        target: values,
        resolved: { head: { title: '', meta: [], link: [], script: [{ type: 'application/ld+json', textContent: { '@graph': graph } }] }, image: null, schema: { ...EMPTY_SCHEMA, ...over } },
        input: more,
      }));
    const unknown = schema({ unknown_type: 'Movie' }, { schema: { type: 'Movie' } }).find((issue) => issue.id === 'schema-unknown');
    expect(unknown).toMatchObject({ severity: 'improve', message: 'Choose what this page is', jump: { field: 'schema.type' } });
    expect(unknown?.detail).toContain('“Movie”');

    // A product named after its page title: on a page, to improve.
    const product = (name: string, more: Partial<ChecksInput> = {}) =>
      schema({ type: 'Product' }, { schema: { type: 'Product' } }, more, [{ '@type': 'Product', '@id': `${PAGE}#primary`, name }]).find((issue) => issue.id === 'schema-name-title');
    expect(product('Pricing')).toMatchObject({ severity: 'improve', message: 'Give the product its own name', jump: { field: 'schema.props.name' } });
    expect(product('Studio membership')).toBeUndefined();
    // On a template the name follows each item's own title, which is right.
    expect(product('Pricing', { scope: 'template', typeLabel: 'Product' })).toBeUndefined();

    // No search feature for a kind that has one: good to know, not counted.
    const none = schema({ type: 'Service', features: [{ feature: null, node: null, verdict: 'none' }] }, { schema: { type: 'Service' } }).filter((issue) => issue.id === 'feature-none');
    expect(none).toMatchObject([{ severity: 'info', message: 'No search feature for plans for a service' }]);
    expect(countIssues(none)).toBe(0);
    // A web page says nothing about it.
    expect(ids(schema({ features: [{ feature: null, node: null, verdict: 'none' }] }, {}))).not.toContain('feature-none');
    // While the head carries no address, no structured data is sent: the
    // address issue says so, and nothing claims it still tells anything.
    const unaddressed = ids(schema({ type: 'Service', unaddressed: true, features: [{ feature: null, node: null, verdict: 'none' }] }, { schema: { type: 'Service' } }));
    expect(unaddressed).toContain('unaddressed');
    expect(unaddressed).not.toContain('feature-none');
  });

  it('asks once for what withholds a node or a group, with an article', () => {
    const schema = (type: string, over: Partial<Resolved['schema']>, values: Omit<NonNullable<SeoValues['schema']>, 'type'> = {}) =>
      checks(input({
        target: { schema: { type, ...values } },
        resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, type, ...over } },
      }));
    const main = 'https://www.example.com/pricing#primary';
    // A job with no employer: one row, to fix, never again to improve.
    const job = schema('JobPosting', {
      withheld: { missing: ['hiringOrganization'], dropped: [], node: {} },
      features: [{ feature: 'job-posting', node: main, verdict: 'needs', missing: [{ path: 'hiringOrganization.name', prop: 'hiringOrganization_name' }] }],
    });
    expect(job.filter((issue) => /employer/i.test(issue.message))).toMatchObject([{ id: 'schema-required:hiringOrganization', severity: 'fix', message: 'Add an employer' }]);
    // The sentence asks for what Checks asks for, in the same words.
    expect(notYetText(REGISTRY, RULES, 'JobPosting', ['description', 'hiringOrganization'])).toBe('Not a job posting yet: it needs a description and an employer.');
    // Someone else without a name: asked by its group's row, not again in
    // Also helps.
    const organizer = schema('Event', {
      incomplete: [{ group: 'organizer', missing: ['organizer_name'] }],
      features: [{ feature: 'event', node: main, verdict: 'ready', helps: [{ path: 'organizer.name', prop: 'organizer_name' }, { path: 'endDate', prop: 'endDate' }] }],
    }, { props: { organizer_url: { text: 'https://hall.example.org/' } } });
    expect(organizer.filter((issue) => /organizer/i.test(issue.message)).map((issue) => issue.id)).toEqual(['schema-incomplete:organizer']);
    expect(organizer.find((issue) => issue.id === 'feature-helps:event')?.message).toBe('Also helps the event result: Ends.');
    // A venue that is set, without its name: the part, by its own name.
    const venue = schema('Event', {
      features: [{ feature: 'event', node: main, verdict: 'ready', helps: [{ path: 'location.name', prop: 'location_name' }] }],
    }, { props: { location_address_addressLocality: { text: 'Helsinki' } } });
    expect(venue.find((issue) => issue.id === 'feature-helps:event')?.message).toBe("Also helps the event result: the venue's name.");
  });

  it('says what was left out of a node: groups, items, names, defaults, pairs and pay', () => {
    const schema = (type: string, over: Partial<Resolved['schema']>, values: SeoValues = {}) =>
      checks(input({
        target: { schema: { type, ...values } },
        resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, type, ...over } },
      }));
    const find = (issues: ReturnType<typeof checks>, id: string) => issues.find((issue) => issue.id === id);
    // A venue without a country: to improve, with why.
    const venue = schema('Event', { incomplete: [{ group: 'location_address', missing: ['location_address_addressCountry'] }] });
    expect(find(venue, 'schema-incomplete:location_address')).toMatchObject({
      severity: 'improve',
      message: "Add the country to the venue's address",
      detail: 'An address needs a street or city, and a country.',
      jump: { field: 'schema.props.location_address_addressCountry' },
    });
    // Items left out: private and hidden ones to improve, over the limit good to know.
    const items = schema('Product', { dropped_items: [{ key: 'image', count: 2, reason: 'private' }, { key: 'image', count: 1, reason: 'max' }] });
    expect(find(items, 'schema-items:image:private')).toMatchObject({ severity: 'improve', message: 'Image: 2 items in private files left out' });
    expect(find(items, 'schema-items:image:max')).toMatchObject({ severity: 'info' });
    // A reference that fell back to a name: good to know.
    expect(find(schema('Event', { refs_inline: [{ key: 'location', name: 'Hall', reason: 'kind' }] }), 'schema-ref-name:location:Hall')).toMatchObject({ severity: 'info', message: 'Venue: “Hall” is named, not linked' });
    // The organizer nobody set: the site, good to know.
    expect(find(schema('Event', { defaults: ['organizer'] }), 'schema-default-site:organizer')).toMatchObject({ severity: 'info', message: 'The organizer is Example Inc (this site)' });
    // Prep time without cook time.
    expect(find(schema('Recipe', { unpaired: ['prepTime'] }), 'schema-unpaired:prepTime')).toMatchObject({
      severity: 'improve',
      message: 'Add the cook time, or give a total time instead',
      jump: { field: 'schema.props.cookTime' },
    });
    // Pay from more than it is up to: to fix, shown at the pay.
    expect(find(schema('JobPosting', { pay_order: true }), 'schema-pay-order')).toMatchObject({ severity: 'fix', message: 'Pay: From is more than Up to', jump: { field: 'schema.props.baseSalary' } });
    // A group's name part by its own name; the pay's unit by what it asks.
    expect(find(schema('Event', { incomplete: [{ group: 'location', missing: ['location_name'] }] }), 'schema-incomplete:location')?.message).toBe('Add the name to the venue');
    expect(find(schema('Event', { incomplete: [{ group: 'organizer', missing: ['organizer_name'] }] }), 'schema-incomplete:organizer')?.message).toBe('Add the name to the organizer');
    expect(find(schema('JobPosting', { incomplete: [{ group: 'baseSalary', missing: ['baseSalary_value_unitText'] }] }), 'schema-incomplete:baseSalary')?.message).toBe('Add how often it is paid');
    // A part a group asks for is not asked for again by the verdict.
    const twice = schema('Event', {
      incomplete: [{ group: 'location_address', missing: ['location_address_addressCountry'] }],
      features: [{ feature: 'event', node: `${PAGE}#primary`, verdict: 'needs', missing: [{ path: 'location.address.addressCountry', prop: 'location_address_addressCountry' }] }],
    });
    expect(ids(twice).filter((id) => id.includes('addressCountry') || id.startsWith('schema-incomplete'))).toEqual(['schema-incomplete:location_address']);
    // What a feature asks more of the group is said in the same row, with
    // what it is needed for: one story for the address.
    const both = schema('Event', {
      incomplete: [{ group: 'location_address', missing: ['location_address_addressCountry'] }],
      features: [{
        feature: 'event',
        node: `${PAGE}#primary`,
        verdict: 'needs',
        missing: [
          { path: 'location.address.addressLocality', prop: 'location_address_addressLocality' },
          { path: 'location.address.addressCountry', prop: 'location_address_addressCountry' },
        ],
      }],
    });
    expect(find(both, 'schema-incomplete:location_address')).toMatchObject({ message: "Add the city and the country to the venue's address", detail: 'Needed for event listings.' });
    expect(ids(both).filter((id) => id.startsWith('feature-needs:'))).toEqual([]);
    // A country stored as a name is asked for once: from the list.
    const legacy = schema('Event', {
      incomplete: [{ group: 'location_address', missing: ['location_address_addressCountry'] }],
      dropped: [{ key: 'location_address_addressCountry', value: 'Finland', kind: 'enum' }],
    });
    expect(ids(legacy).filter((id) => id.includes('addressCountry') || id.startsWith('schema-incomplete'))).toEqual(['schema-dropped:location_address_addressCountry']);
    expect(find(legacy, 'schema-dropped:location_address_addressCountry')?.message).toMatch(/^Choose the country from the list/);
  });

  it('words every verdict the server sends: closed, elsewhere, a list and its count', () => {
    const server = (type: string) => ({ search_features: RULES, registry: REGISTRY, ui: 'en', resolved: { schema: { ...EMPTY_SCHEMA, type } } }) as unknown as StatePayload;
    const node = `${PAGE}#primary`;
    expect(verdictText(server('JobPosting'), { feature: 'job-posting', node, verdict: 'closed', date: '2026-10-31' })).toBe('Not shown: this job closed 31 October 2026');
    expect(verdictText(server('Course'), { feature: 'course-list', node, verdict: 'elsewhere' })).toBe('Needs a list page with at least 3 courses');
    // A breadcrumb trail added by hand with one item.
    const trail = `${PAGE}#trail`;
    expect(verdictText(server('WebPage'), { feature: 'breadcrumb', node: trail, verdict: 'needs', missing: [{ path: 'itemListElement.name', rule: 0 }] })).toBe('Needs a second named item');
    expect(verdictText(server('WebPage'), { feature: 'breadcrumb', node: trail, verdict: 'ready' })).toBe('Can show');
    expect(verdictText(server('CollectionPage'), { feature: 'course-list', node, verdict: 'ready', count: 4, of: 4 })).toBe('Can show: 4 courses');
    expect(verdictText(server('CollectionPage'), { feature: 'course-list', node, verdict: 'needs', count: 2, of: 5, missing: [{ path: 'itemListElement' }] })).toBe(
      'Needs at least 3 courses: 2 of the 5 linked pages are complete courses',
    );
    // A plain list with nothing linked: the need alone.
    expect(verdictText(server('ItemList'), { feature: 'course-list', node, verdict: 'needs', count: 0, of: 0, missing: [{ path: 'itemListElement' }] })).toBe('Needs at least 3 courses');
    // Both are said in gray: nothing the editor can add here.
    expect(QUIET).toEqual(expect.arrayContaining(['closed', 'elsewhere']));
    // A detail is asked for by its label on this type: a job's Description.
    expect(verdictText(server('JobPosting'), { feature: 'job-posting', node, verdict: 'needs', missing: [{ path: 'description', prop: 'description' }] })).toBe('Needs a description');
    expect(verdictText(server('Event'), { feature: 'event', node, verdict: 'needs', missing: [{ path: 'location.address.addressCountry', prop: 'location_address_addressCountry' }] })).toBe('Needs a country');
    // An either-or need is said as one.
    expect(verdictText(server('WebPage'), { feature: 'employer-rating', node, verdict: 'needs', missing: [{ path: 'ratingCount' }] })).toBe('Needs a rating count or review count');
    // A country stored as a name: one from the list.
    const legacy = { ...server('Event'), resolved: { schema: { ...EMPTY_SCHEMA, type: 'Event', dropped: [{ key: 'location_address_addressCountry', value: 'Finland', kind: 'enum' }] } } } as unknown as StatePayload;
    expect(verdictText(legacy, { feature: 'event', node, verdict: 'needs', missing: [{ path: 'location.address.addressCountry', prop: 'location_address_addressCountry' }] })).toBe('Needs a country from the list');
  });

  it('says a closed job, a list page short of courses, and a time in the wrong unit', () => {
    const schema = (type: string, over: Partial<Resolved['schema']>, values: Partial<NonNullable<SeoValues['schema']>> = {}, more: Partial<Parameters<typeof input>[0]> = {}) =>
      checks(input({
        target: { schema: { type, ...values } },
        resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, type, ...over } },
        ...more,
      }));
    const find = (issues: ReturnType<typeof checks>, id: string) => issues.find((issue) => issue.id === id);
    // Closed: good to know, with its date, where the date is changed.
    expect(find(schema('JobPosting', { features: [{ feature: 'job-posting', node: `${PAGE}#primary`, verdict: 'closed', date: '2026-10-31' }] }), 'feature-closed:job-posting')).toMatchObject({
      severity: 'info',
      message: 'Job posting: not shown, this job closed 31 October 2026',
      jump: { field: 'schema.props.validThrough' },
    });
    // A list page: how many of its pages count, never "Add itemListElement".
    const list = schema('CollectionPage', { features: [{ feature: 'course-list', node: `${PAGE}#webpage`, verdict: 'needs', count: 2, of: 5, missing: [{ path: 'itemListElement' }] }] });
    expect(find(list, 'feature-list:course-list')).toMatchObject({ severity: 'improve', message: 'Course list: 2 of the 5 linked pages are complete courses' });
    expect(ids(list).filter((id) => id.startsWith('feature-needs'))).toEqual([]);
    // A course alone is shown from a list page: nothing to say here.
    expect(ids(schema('Course', { features: [{ feature: 'course-list', node: `${PAGE}#primary`, verdict: 'elsewhere' }] })).filter((id) => id.startsWith('feature-'))).toEqual([]);
    // A linked cook time of 50 read as hours: asked, with the other unit as the fix.
    const cook = (unit: 'minute' | 'hour') => find(
      schema('Recipe', {}, { props: { cookTime: { source: field('field_cook', 'Cook minutes').source, unit } } }, {
        sources: [field('field_cook', 'Cook minutes', { kinds: ['number'], value: '50' })],
        input: { scope: 'template', typeLabel: 'Recipe' },
      }),
      'schema-unit:cookTime',
    );
    expect(cook('minute')).toBeUndefined();
    const hours = cook('hour');
    expect(hours).toMatchObject({ severity: 'improve', message: 'Is Cook time in hours or minutes?', detail: 'It reads as 50 h, more than a day.' });
    const fix = hours?.fix as { apply(values: SeoValues): SeoValues } | undefined;
    expect(fix?.apply({ schema: { type: 'Recipe', props: { cookTime: { source: field('field_cook', 'Cook minutes').source, unit: 'hour' } } } }).schema?.props?.cookTime).toMatchObject({ unit: 'minute' });
  });

  it('says a byline linked as text may be several people', () => {
    const byline = (value: string) =>
      checks(input({
        target: { schema: { type: 'Article', props: { author_name: { source: field('field_byline', 'Byline').source } } } },
        sources: [field('field_byline', 'Byline', { value })],
        input: { scope: 'template', typeLabel: 'Article' },
      })).find((issue) => issue.id === 'schema-byline');
    expect(byline('Ada and Grace')).toMatchObject({ severity: 'info', detail: 'If this names several people, link a field with one person per value.' });
    expect(byline('Ada, Grace')).toBeDefined();
    expect(byline('Ada')).toBeUndefined();
  });

  it('every kind of row checks.ts makes is tested here', () => {
    const source = readFileSync(new URL('./checks.ts', import.meta.url), 'utf8');
    const tests = readFileSync(new URL('./checks.test.ts', import.meta.url), 'utf8');
    const made = [...new Set([...source.matchAll(/\bid: [`'"]([a-z0-9-]+)/g)].map((m) => m[1]))];
    expect(made.length).toBeGreaterThan(30);
    expect(made.filter((id) => !new RegExp(`['\`]${id}[:'\`]`).test(tests))).toEqual([]);
  });

  it('never promises a result in structured data words', () => {
    const banned = /will show|eligible|AI-ready|get cited|\bscores?\b/i;
    const checksSource = readFileSync(new URL('./checks.ts', import.meta.url), 'utf8');
    const structuredRows = checksSource.slice(checksSource.indexOf('// Structured data:'));
    const stage = readFileSync(new URL('./components/SchemaTab.tsx', import.meta.url), 'utf8');
    const rules = readFileSync(new URL('../../data/search-features.json', import.meta.url), 'utf8');
    for (const [name, text] of Object.entries({ structuredRows, stage, rules })) {
      expect([name, text.match(banned)?.[0] ?? null]).toEqual([name, null]);
    }
  });

  it('words the verdicts: doesn’t fit, only if bought here, retired, never counted', () => {
    const verdicts = (features: Resolved['schema']['features']) =>
      checks(input({ target: { schema: { type: 'Product' } }, resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, type: 'Product', features } } }));
    const node = `${PAGE}#primary`;
    const all = verdicts([
      { feature: 'merchant-listing', node, verdict: 'not_fit', reason: 'recurring' },
      { feature: 'faq', node: `${PAGE}#faq`, verdict: 'retired' },
    ]);
    expect(all.find((issue) => issue.id === 'feature-not-fit:merchant-listing')).toMatchObject({ severity: 'info', message: "Merchant listing doesn't fit: a recurring price" });
    expect(all.find((issue) => issue.id.startsWith('feature-retired:faq'))).toMatchObject({ severity: 'info', message: 'FAQ: Not shown since 7 May 2026' });
    expect(countIssues(all.filter((issue) => issue.id.startsWith('feature-')))).toBe(0);
    expect(verdicts([{ feature: 'merchant-listing', node, verdict: 'unanswered' }]).find((issue) => issue.id.startsWith('feature-unanswered'))).toMatchObject({ severity: 'info', jump: { field: 'schema.props.sold_here' } });
    // Each heading of a structured data rule starts with a verb.
    const headings = [
      ...verdicts([{ feature: 'merchant-listing', node, verdict: 'needs', missing: [{ path: 'image', prop: 'image' }, { path: 'offers.priceCurrency', prop: 'offers_priceCurrency' }] }]),
      ...checks(input({ target: { schema: { type: 'Product' } }, resolved: { head: { title: '', meta: [], link: [], script: [] }, image: null, schema: { ...EMPTY_SCHEMA, type: 'Product', withheld: { missing: ['offers_price'], dropped: [], node: {} } } } })),
    ].filter((issue) => /^(schema-required|feature-needs|schema-dropped|schema-name-title|schema-unknown|schema-dates)/.test(issue.id));
    expect(headings.map((issue) => issue.message)).toEqual(['Add an image for merchant listings', 'Add a currency for merchant listings', 'Add a price']);
    for (const issue of headings) {
      expect(issue.message).toMatch(/^(Add|Use|Fix|Give|Choose|Move) /);
    }
  });

  it('says a value that does not fit under its own field, never "Add"', () => {
    const currency = field('field_currency', 'Currency', { status: 'ok', value: 'Euro (€)' });
    const all = checks(input({
      target: { schema: { type: 'Product', props: { offers_priceCurrency: { source: currency.source } } } },
      sources: [currency],
      resolved: {
        head: { title: '', meta: [], link: [], script: [] },
        image: null,
        schema: {
          ...EMPTY_SCHEMA,
          type: 'Product',
          dropped: [{ key: 'offers_priceCurrency', value: 'Euro (€)', kind: 'currency' }],
          features: [{ feature: 'merchant-listing', node: `${PAGE}#primary`, verdict: 'needs', missing: [{ path: 'offers.priceCurrency', prop: 'offers_priceCurrency' }] }],
        },
      },
      input: { scope: 'template', typeLabel: 'Product' },
    }));
    expect(all.find((issue) => issue.id === 'schema-dropped:offers_priceCurrency')).toMatchObject({
      severity: 'improve',
      message: 'Use a currency code from the list, such as EUR: the Currency field gives “Euro (€)”.',
      jump: { field: 'schema.props.offers_priceCurrency' },
    });
    expect(all.map((issue) => issue.message).join('\n')).not.toContain('Add a currency');
  });

  it('says a description linked to a field the previewed item has empty as a fact', () => {
    const sku = field('field_sku', 'SKU', { status: 'empty', value: '' });
    const all = checks(input({
      target: { description: { source: sku.source } },
      sources: [sku],
      facts: { description: '' },
      input: { scope: 'template', typeLabel: 'Product' },
    }));
    expect(all.find((issue) => issue.id === 'value-empty:description')).toMatchObject({
      severity: 'info',
      message: 'SKU is empty for this product',
      jump: { field: 'description' },
    });
    expect(all.map((issue) => issue.id)).not.toContain('description-missing');
    // Its default, the same way.
    expect(checks(input({ facts: { description: '' }, input: { scope: 'template', typeLabel: 'Product' } })).find((issue) => issue.id === 'value-empty:description')?.message).toBe('The description is empty for this product');
    // On a page the empty description is the page's own problem.
    expect(checks(input({ target: { description: { source: sku.source } }, sources: [sku], facts: { description: '' } })).map((issue) => issue.id)).toContain('description-missing');
  });

  it('on a headless site, an empty description says the frontend decides', () => {
    const sent = 'No description sent. The frontend decides what to show.';
    // A page: the same level and fix, only the sentence differs.
    const coupled = find({ facts: { description: '' } }, 'description-missing');
    const headless = find({ facts: { description: '' }, input: { headless: true } }, 'description-missing');
    expect(coupled?.detail).toBe('Without one, search engines pick text from the page.');
    expect(headless).toEqual({ ...coupled, detail: sent, fix: headless?.fix });
    expect(headless?.fix).toEqual(coupled?.fix);
    // A template previewing an item without one.
    const template = { scope: 'template' as const, typeLabel: 'Post' };
    expect(find({ facts: { description: '' }, input: template }, 'value-empty:description')?.detail).toBe(
      'Search engines pick text from the page for this post; each post that has one shows its own.',
    );
    expect(find({ facts: { description: '' }, input: { ...template, headless: true } }, 'value-empty:description')).toMatchObject({
      severity: 'info',
      message: 'The description is empty for this post',
      detail: `${sent} Each post that has one shows its own.`,
    });
  });

  it('says no item has a description on a type that reads no field for one', () => {
    // "Every Bookmark": a title and a link; its default can never give one.
    const bookmark = { facts: { description: '' }, via: { description: null }, input: { scope: 'template' as const, typeLabel: 'Bookmark' } };
    expect(find(bookmark, 'value-empty:description')).toMatchObject({
      severity: 'info',
      message: 'No bookmark has a description',
      detail: 'Search engines pick text from the page.',
    });
    expect(find({ ...bookmark, input: { ...bookmark.input, headless: true } }, 'value-empty:description')?.detail).toBe(
      'No description sent. The frontend decides what to show.',
    );
    // Linked to a field, it is that field's item that has none.
    const summary = field('field_summary', 'Summary', { status: 'empty', value: '' });
    expect(find({ ...bookmark, target: { description: { source: summary.source } }, sources: [summary] }, 'value-empty:description')?.message).toBe(
      'Summary is empty for this bookmark',
    );
  });

  it('lists a detail linked to a field the previewed item has empty once', () => {
    const ends = field('field_ends', 'Ends', { kinds: ['date'], status: 'empty', value: '' });
    const all = checks(input({
      target: { schema: { type: 'Event', props: { endDate: { source: ends.source } } } },
      sources: [ends],
      resolved: {
        head: { title: '', meta: [], link: [], script: [] },
        image: null,
        schema: {
          ...EMPTY_SCHEMA,
          type: 'Event',
          features: [{ feature: 'event', node: `${PAGE}#primary`, verdict: 'ready', helps: [{ path: 'endDate', prop: 'endDate' }] }],
        },
      },
      input: { scope: 'template', typeLabel: 'Event' },
    }));
    expect(all.filter((issue) => issue.id.includes('endDate'))).toEqual([
      expect.objectContaining({ id: 'schema-empty:endDate', severity: 'info', message: 'Ends is empty for this event' }),
    ]);
  });
});


describe('rules with conditions', () => {
  it('title-generic is silent outside English', () => {
    const home = { facts: { title: text('Title', 'Home') } };
    expect(
      find({ ...home, input: { langcode: 'en-gb' } }, 'title-generic'),
    ).toBeDefined();
    expect(
      find({ ...home, input: { langcode: 'fi' } }, 'title-generic'),
    ).toBeUndefined();
    expect(
      find(
        { facts: { title: text('Title', 'Homes for sale') } },
        'title-generic',
      ),
    ).toBeUndefined();
  });

  it('noindex: only for a published target, and it names where it is set', () => {
    const hidden = { target: { robots: { noindex: true } } };
    expect(
      find({ ...hidden, input: { published: false } }, 'noindex'),
    ).toBeUndefined();
    expect(
      find({ ...hidden, input: { scope: 'template' } }, 'noindex'),
    ).toMatchObject({
      message: 'Show this article in search',
      detail: 'Hidden from search engines. Set for every Article.',
    });
    const bySite = find({ site: { robots: { noindex: true } } }, 'noindex')!;
    expect(bySite.detail).toBe(
      'Hidden from search engines. Set for the whole site.',
    );
    expect(bySite.jump).toEqual({
      scope: 'site',
      tab: 'defaults',
      field: 'values.robots.noindex',
    });
    expect(
      find(
        {
          site: { robots: { noindex: true } },
          input: { can: { target: true, site: false } },
        },
        'noindex',
      )!.jump,
    ).toBeUndefined();
    expect(
      find({ fromDefault: { robots: { noindex: true } } }, 'noindex')!.detail,
    ).toBe('Hidden from search engines. Set on the English version.');
    // Only the server's output says so: a configuration override.
    expect(
      find({ robotsMeta: 'noindex, max-image-preview:large' }, 'noindex'),
    ).toMatchObject({
      detail:
        'Hidden from search engines. Set in site configuration outside SEO.',
      fix: undefined,
    });
    // Right after "Show in search results" on Every Article, before the
    // server has the change: its last answer still says noindex, and is not
    // believed, so nothing says that hiding is set outside SEO.
    expect(
      find(
        {
          target: { robots: { noindex: false } },
          robotsMeta: 'noindex',
          input: { robotsSettled: false, scope: 'template' },
        },
        'noindex',
      ),
    ).toBeUndefined();
  });

  it('snippet-off also fires for a limit of 0, image-preview for an absent directive', () => {
    expect(
      find({ target: { robots: { max_snippet: 0 } } }, 'snippet-off'),
    ).toBeDefined();
    expect(
      find({ target: { robots: { max_snippet: 160 } } }, 'snippet-off'),
    ).toBeUndefined();
    expect(find({ site: {} }, 'image-preview')).toBeDefined();
  });

  it('image-small follows the link preview: a thumbnail under 600 px wide to improve, a large card good to know', () => {
    const small = (width: number, height: number) =>
      find({ resolved: { image: { ...IMAGE, width, height } } }, 'image-small');
    expect(small(400, 400)).toMatchObject({
      severity: 'improve',
      detail:
        'The social image is 400\u00a0×\u00a0400. Most link previews show it as a small thumbnail; an image at least 600 px wide makes a large card, and 1200\u00a0×\u00a0630 is best.',
    });
    expect(small(1200, 150)?.detail).toContain(
      'an image at least 157 px tall makes a large card',
    );
    expect(small(800, 420)).toMatchObject({
      severity: 'info',
      message: 'The social image could be sharper',
      detail:
        'The social image is 800\u00a0×\u00a0420. It works as a large card; 1200\u00a0×\u00a0630 looks sharper.',
    });
    expect(small(1200, 630)).toBeUndefined();
  });

  it('a large card that is cropped too is one row, good to know', () => {
    const issues = checks(
      input({ resolved: { image: { ...IMAGE, width: 800, height: 1000 } } }),
    );
    expect(ids(issues).filter((id) => id.startsWith('image-'))).toEqual([
      'image-small',
    ]);
    expect(issues.find((issue) => issue.id === 'image-small')).toMatchObject({
      severity: 'info',
      message: 'The social image could be sharper',
      detail:
        'The social image is 800\u00a0×\u00a01000. It works as a large card, cropped; 1200\u00a0×\u00a0630 fits best.',
    });
    expect(
      issues.find((issue) => issue.id === 'image-small')?.detail,
    ).not.toContain('for a large card');
    // A thumbnail is square, never cropped to 1.91:1: one row, its size.
    expect(
      ids(
        checks(input({ resolved: { image: { ...IMAGE, width: 400, height: 400 } } })),
      ).filter((id) => id.startsWith('image-')),
    ).toEqual(['image-small']);
  });

  it('a link that is only empty for this item is not listed; broken and hidden ones are', () => {
    const summary = field('field_summary', 'Summary');
    const template = { scope: 'template', typeLabel: 'Article' } as const;
    const empty = checks(
      input({
        target: { description: { source: summary.source } },
        sources: [{ ...summary, status: 'empty', value: '' }],
        input: template,
      }),
    );
    expect(ids(empty).filter((id) => id.startsWith('link-'))).toEqual([]);
    const broken = find(
      {
        target: { title_end: { source: summary.source } },
        input: template,
      },
      'link-broken:title_end',
    )!;
    expect(broken).toMatchObject({
      message: 'Link the title ending again',
      jump: { scope: 'target', tab: 'search', field: 'title_end' },
      fix: { label: 'Link another field', link: true },
    });
    // A page never links fields: nothing to say there.
    expect(
      ids(checks(input({ target: { description: { source: summary.source } } }))).filter((id) => id.startsWith('link-')),
    ).toEqual([]);
  });

  it('a title that may be cut inside its ending says the ending is lost', () => {
    const detail = find(
      { target: { title: t(long(13)), title_end: t('Journal') } },
      'title-long',
    )?.detail;
    expect(detail).toMatch(/^May be cut off after “….+”\. The ending “Journal” is the part that gets lost\.$/);
    // Cut inside the main part: the usual sentence.
    expect(
      find({ target: { title: t(long(20)), title_end: t('Journal') } }, 'title-long')?.detail,
    ).toBe('May be cut off after “…words words words”.');
  });

  it('without a page to resolve for, the image rules stay silent', () => {
    expect(
      ids(checks(input({ resolved: null }))).filter((id) =>
        id.startsWith('image-'),
      ),
    ).toEqual([]);
  });

  it('says links hidden by one reference in one row, for this item', () => {
    const venue = (name: string, label: string) =>
      field(name, `Venue › ${label}`, { path: ['Venue', label], hop: true, status: 'hidden', value: '' });
    const rows = [
      venue('field_venue_street', 'Street address'),
      venue('field_venue_city', 'City'),
      venue('field_venue_name', 'Title'),
      venue('field_venue_code', 'Postal code'),
    ];
    const all = checks(
      input({
        target: {
          schema: {
            type: 'Event',
            props: {
              location_address_streetAddress: { source: rows[0].source },
              location_address_addressLocality: { source: rows[1].source },
              location_name: { source: rows[2].source },
              location_address_postalCode: { source: rows[3].source },
            },
          },
        },
        sources: rows,
        resolved: {
          schema: { ...EMPTY_SCHEMA, type: 'Event', withheld: { missing: ['location_address_streetAddress'], dropped: [], node: {} } },
        },
        input: { scope: 'template', typeLabel: 'Event' },
      }),
    );
    const hidden = all.filter((issue) => issue.id.startsWith('link-hidden:'));
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toMatchObject({
      severity: 'improve',
      message: 'Venue is hidden from visitors for this event',
      jump: { field: 'schema.props.location_address_streetAddress' },
    });
    expect(hidden[0].detail).toBe("Event details are left out for this event, because visitors can't see its venue. Publish the venue or preview another event.");
    // The required detail is said with its reference, not as one to add.
    expect(ids(all)).not.toContain('schema-required:location_address_streetAddress');
  });

  it('says a required detail linked to a field this item has empty for the item', () => {
    const ends = field('field_starts', 'Starts', { kinds: ['date'], status: 'empty', value: '' });
    expect(
      find(
        {
          target: { schema: { type: 'Event', props: { startDate: { source: ends.source } } } },
          sources: [ends],
          resolved: { schema: { ...EMPTY_SCHEMA, type: 'Event', withheld: { missing: ['startDate'], dropped: [], node: {} } } },
          input: { scope: 'template', typeLabel: 'Event' },
        },
        'schema-required:startDate',
      ),
    ).toMatchObject({ message: 'Starts is empty for this event', detail: 'The event is left out for this event.' });
  });

  it('says why a link is broken by its reason, naming the machine name', () => {
    const poster = field('field_poster', 'Poster', { kinds: ['image'] });
    // The field still exists, as an image: it no longer gives text. (A date
    // gives words in the description, which composes.)
    expect(
      find(
        {
          target: { description: { source: poster.source } },
          sources: [poster],
          broken: { description: { field: 'field_poster', reason: 'kind' } },
          input: { scope: 'template', typeLabel: 'Event' },
        },
        'link-broken:description',
      )?.detail,
    ).toBe('It was linked to field_poster, which no longer gives text. Each event uses its default until another field is linked.');
  });

  it('says a field visitors may never view in its own row, leading to the value', () => {
    const notes = field('field_notes', 'Notes', { status: 'hidden', value: '' });
    expect(
      find(
        {
          target: { description: { source: notes.source } },
          sources: [notes],
          input: { scope: 'template', typeLabel: 'Event' },
        },
        'link-hidden:description',
      ),
    ).toMatchObject({
      severity: 'improve',
      message: 'Notes is hidden from visitors',
      detail: 'Description uses its default. Link a field visitors can see.',
      jump: { scope: 'target', tab: 'search', field: 'description' },
    });
  });

  it('at template scope "this page" is "this event", never the preview\'s title', () => {
    const template = { scope: 'template', typeLabel: 'Event' } as const;
    const title = find(
      {
        facts: { title: text('Title', ''), site: text('Site name', '') },
        input: template,
      },
      'title-empty',
    )!;
    expect(title.detail).toBe('This event has no title for search results.');
    const hidden = find(
      {
        target: { description: { source: field('field_notes', 'Notes').source } },
        sources: [field('field_notes', 'Notes', { status: 'hidden', value: '' })],
        input: template,
      },
      'link-hidden:description',
    )!;
    expect(hidden.detail).toBe('Description uses its default. Link a field visitors can see.');
    // The previewed node's title is in the values, never in a sentence.
    const all = checks(
      input({
        target: { description: { source: field('field_notes', 'Notes').source } },
        sources: [field('field_notes', 'Notes', { status: 'hidden', value: '' })],
        facts: {
          title: text('Title', 'Hello world'),
          description: text('Description', ''),
        },
        input: template,
      }),
    );
    expect(all.find((issue) => issue.id === 'link-hidden:description')).toBeDefined();
    for (const issue of all) {
      expect(`${issue.message} ${issue.detail ?? ''}`).not.toContain(
        'Hello world',
      );
    }
    // A structured data property linked to a field this event has no value
    // in: a fact too, said once, and not in the counted row.
    const linkedSetup: Setup = {
        target: {
          schema: {
            type: 'Event',
            props: {
              endDate: { source: field('field_ends', 'Ends').source },
              image: { source: field('field_poster', 'Poster').source },
            },
          },
        },
        sources: [
          field('field_ends', 'Ends', { kinds: ['date'], status: 'empty', value: '' }),
          field('field_poster', 'Poster', { kinds: ['image'], status: 'empty', value: '', image: null }),
        ],
        resolved: {
          schema: {
            ...EMPTY_SCHEMA,
            type: 'Event',
            features: [{ feature: 'event', node: `${PAGE}#primary`, verdict: 'ready', helps: [{ path: 'endDate', prop: 'endDate' }, { path: 'image', prop: 'image' }, { path: 'location.name', prop: 'location_name' }] }],
          },
        },
        input: template,
      };
    const linked = checks(input(linkedSetup));
    expect(linked.find((issue) => issue.id === 'feature-helps:event')?.message).toBe(
      'Also helps the event result: Venue.',
    );
    expect(linked.find((issue) => issue.id === 'schema-empty:endDate')).toMatchObject({
      severity: 'info',
      message: 'Ends is empty for this event',
      detail:
        'It is left out for this event, and filled in wherever another event has one.',
      jump: { scope: 'target', tab: 'schema', field: 'schema.props.endDate' },
    });
    expect(ids(linked)).toContain('schema-empty:image');
    // While the event shares a card for want of a Poster, the social row
    // says so; a second row about the same gap is not added.
    const carded = input({ ...linkedSetup, resolved: { ...linkedSetup.resolved, image: null, share: { made: 'card', url: '/preview' } } });
    carded.lookup.facts.image = { ...carded.lookup.facts.image!, via: 'Poster', image: null };
    expect(ids(checks(carded))).toContain('image-card');
    expect(ids(checks(carded))).not.toContain('schema-empty:image');
    // At page scope it stays a task.
    expect(
      find(
        {
          target: { schema: { type: 'Event', props: { endDate: { source: field('field_ends', 'Ends').source } } } },
          sources: [field('field_ends', 'Ends', { kinds: ['date'], status: 'empty', value: '' })],
          resolved: {
            schema: { ...EMPTY_SCHEMA, type: 'Event', features: [{ feature: 'event', node: `${PAGE}#primary`, verdict: 'ready', helps: [{ path: 'endDate', prop: 'endDate' }] }] },
          },
        },
        'feature-helps:event',
      )?.message,
    ).toBe('Also helps the event result: Ends.');
    // A type named by an abbreviation keeps it.
    expect(
      find(
        {
          facts: { title: text('Title', ''), site: text('Site name', '') },
          input: { scope: 'template', typeLabel: 'FAQ page' },
        },
        'title-empty',
      )!.detail,
    ).toBe('This FAQ page has no title for search results.');
  });

  it('names an image format as people know it', () => {
    expect(
      find(
        { resolved: { image: { ...IMAGE, mime: 'image/x-ms-bmp' } } },
        'image-format',
      )?.detail,
    ).toBe('BMP images do not show on many services.');
    // A size Drupal doesn't know (0 × 0) is no size row: the format says it.
    const unknown = { resolved: { image: { ...IMAGE, mime: 'image/x-ms-bmp', width: 0, height: 0, bytes: 2306102 } } };
    expect(find(unknown, 'image-format')).toBeDefined();
    expect(find(unknown, 'image-small')).toBeUndefined();
    expect(find(unknown, 'image-ratio')).toBeUndefined();
  });

  it('the words a long text may be cut after end without their own mark', () => {
    const title = Array.from({ length: 14 }, () => 'words,').join(' ');
    expect(find({ target: { title: t(title), title_end: t('') } }, 'title-long')?.detail).toBe(
      'May be cut off after “…words, words, words”.',
    );
    // Also a mark of another script, as the server's plain text knows it.
    const arabic = Array.from({ length: 14 }, () => 'words،').join(' ');
    expect(find({ target: { title: t(arabic), title_end: t('') } }, 'title-long')?.detail).toBe(
      'May be cut off after “…words، words، words”.',
    );
  });

  it('long text cannot be judged without a measurer', () => {
    expect(
      find(
        { target: { title: t(long(20)) }, input: { measurer: null } },
        'title-long',
      ),
    ).toBeUndefined();
  });
});

describe('identity-incomplete', () => {
  const bare = {
    input: {
      site: {
        ...SITE,
        identity: { ...SITE.identity, name: '', logo: '', same_as: [] },
      },
    },
  };

  it('is absent without can.site', () => {
    expect(find(bare, 'identity-incomplete')).toBeDefined();
    expect(
      find(
        { input: { ...bare.input, can: { target: true, site: false } } },
        'identity-incomplete',
      ),
    ).toBeUndefined();
  });

  it('is never counted', () => {
    const issues = checks(input(bare));
    expect(ids(issues)).toEqual(['identity-incomplete']);
    expect(countIssues(issues)).toBe(0);
    expect(
      countIssues(
        checks(input({ target: { robots: { noindex: true } }, ...bare })),
      ),
    ).toBe(1);
  });

  it('a site name stands in for an identity name', () => {
    // The Site name fact is the site's name when the identity has none.
    expect(
      identityGaps(bare.input.site, FACTS.site).map((gap) => gap.text),
    ).toEqual(['no logo', 'no profile link']);
    expect(
      identityGaps(bare.input.site, '').map((gap) => gap.field),
    ).toEqual(['identity.name', 'identity.logo', 'identity.same_as']);
    expect(find(bare, 'identity-incomplete')!.jump).toEqual({
      scope: 'site',
      tab: 'identity',
      field: 'identity.logo',
    });
  });
});

describe('compositions (compose-values-from-fields)', () => {
  const template = { scope: 'template', typeLabel: 'Event' } as const;
  const city = field('field_city', 'City', { text: 'Helsinki' });
  const starts = field('field_starts', 'Starts', { kinds: ['date'], value: '2026-06-20T19:00:00+03:00', text: '20 June 2026' });
  const title = (...parts: Part[]): SeoValues => ({ title: { parts } });

  it('lists a deleted field of a composition to replace, and selects it', () => {
    const row = find(
      {
        target: title({ fact: 'title' }, { text: ' in ' }, { source: { sourceType: 'entity-field', expression: 'ℹ︎␜entity:node:article␝field_gone␞␟value' } }),
        broken: { 'title.parts.2': { path: 'title', part: 2, field: 'field_gone', reason: 'missing' } },
        input: template,
      },
      'link-broken:title.parts.2',
    )!;
    expect(row).toMatchObject({
      message: 'Replace field_gone in the title',
      detail: "It no longer exists, so each event's title leaves it out.",
      jump: { field: 'title.parts.2' },
      fix: { label: 'Replace field', link: true },
    });
  });

  it('lists a hidden field of a composition to improve', () => {
    const notes = field('field_notes', 'Notes', { status: 'hidden', value: '' });
    expect(find({ target: title({ fact: 'title' }, { text: ' · ' }, { source: notes.source }), sources: [notes], input: template }, 'link-hidden:title.parts.2')).toMatchObject({
      severity: 'improve',
      message: 'Notes is hidden from visitors',
      detail: "So it is left out of every event's title. Use a field visitors can see.",
      jump: { field: 'title.parts.2' },
    });
  });

  it('says what one hidden reference leaves out in one row', () => {
    const venueCity = { ...field('field_venue', 'Venue › City', { status: 'hidden', value: '' }), path: ['Venue', 'City'], hop: true };
    const street = { ...venueCity, source: { sourceType: 'entity-field' as const, expression: 'ℹ︎␜entity:node:article␝field_venue␞␟street' }, label: 'Venue › Street', path: ['Venue', 'Street'] };
    const composedCity = { parts: [{ fact: 'title' as const }, { text: ' in ' }, { source: venueCity.source }] };
    const issues = checks(input({
      target: { title: composedCity, social: { title: composedCity }, description: { source: street.source } },
      sources: [venueCity, street],
      input: template,
    }));
    const rows = issues.filter((issue) => issue.id.startsWith('link-hidden'));
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe('Venue is hidden from visitors for this event');
    expect(rows[0].detail).toBe('Description uses its default; the title and social title skip it and the words that go with it. Publish the venue or preview another event.');
  });

  it('keeps the items visitors may see of a field with one hidden', () => {
    // The first performer is unpublished: the row's own value is hidden, its
    // words hold the others.
    const performers = { ...field('field_performers', 'Performers › Title', { status: 'hidden', value: '', text: 'Mira Kallio', many: true }), path: ['Performers', 'Title'], hop: true };
    const issues = checks(input({ target: title({ text: 'Tickets for ' }, { source: performers.source }), sources: [performers], input: template }));
    expect(ids(issues).filter((id) => id.startsWith('link-hidden'))).toEqual([]);
  });

  it('says a field empty for this item as good to know, and every field empty as the default', () => {
    const empty = { ...city, status: 'empty' as const, value: '', text: '' };
    expect(find({ target: title({ fact: 'title' }, { text: ' in ' }, { source: city.source }), sources: [empty], input: template }, 'parts-empty:title')).toMatchObject({
      severity: 'info',
      message: 'City is empty for this event',
    });
    const none = { ...starts, status: 'empty' as const, value: '', text: '' };
    expect(find({ target: title({ source: city.source }, { text: ' · ' }, { source: starts.source }), sources: [empty, none], input: template }, 'parts-empty:title')?.message).toBe(
      'City and Starts are empty for this event, so the title is its default',
    );
    expect(find({ target: title({ source: city.source }, { text: ' · Tickets' }), sources: [empty], input: template }, 'parts-empty:title')?.detail).toBe(
      'Other events that have it use it.',
    );
  });

  it('notes typed words on a multilingual site, never punctuation alone', () => {
    const words = title({ fact: 'title' }, { text: ' in ' }, { source: city.source });
    expect(find({ target: words, sources: [city], input: { ...template, languages: 2 } }, 'parts-language:title')).toMatchObject({
      message: 'The words typed in the title are the same in every language',
      detail: 'Translations of each event keep these words.',
    });
    expect(ids(checks(input({ target: title({ fact: 'title' }, { text: ' · ' }, { source: city.source }), sources: [city], input: { ...template, languages: 2 } })))).not.toContain('parts-language:title');
    expect(ids(checks(input({ target: words, sources: [city], input: template })))).not.toContain('parts-language:title');
  });

  it('steers a composition: a lead-in, boilerplate, the site name or a date in a name', () => {
    expect(find({ target: title({ text: 'Tickets: ' }, { fact: 'title' }), sources: [city], input: template }, 'title-lead-in')?.message).toBe('Start the title with what differs per event');
    expect(
      find({ target: { description: { parts: [{ source: city.source }, { text: ' — book early, seats are limited and the doors open an hour before.' }] } }, sources: [city], input: template }, 'parts-boilerplate:description')?.message,
    ).toBe('Most of this description is the same on every event');
    expect(find({ target: { schema: { type: 'Event', props: { name: { parts: [{ fact: 'title' }, { text: ' · ' }, { fact: 'site' }] } } } }, input: template }, 'name-site:schema.props.name')?.message).toBe(
      "Keep the site name out of the event's name",
    );
    expect(
      find({ target: { schema: { type: 'Event', props: { name: { parts: [{ fact: 'title' }, { text: ' · ' }, { source: starts.source }] } } } }, sources: [starts], input: template }, 'name-date:schema.props.name')?.message,
    ).toBe("Keep the date out of the event's name");
    // Another thing's name is not the item's own.
    expect(ids(checks(input({ target: { schema: { type: 'Event', props: { organizer_name: { parts: [{ fact: 'site' }, { text: ' Events' }] } } } }, input: template })))
      .filter((id) => id.startsWith('name-'))).toEqual([]);
    // Typed words this item leaves out with an empty field are not counted.
    const empty = { ...city, status: 'empty' as const, value: '', text: '' };
    expect(ids(checks(input({
      target: { description: { parts: [{ fact: 'title' }, { text: ' in the heart of ' }, { source: city.source }, { text: ', a stage for everybody who loves music' }] } },
      sources: [empty],
      input: template,
    })))).not.toContain('parts-boilerplate:description');
  });

  it('names the field a cut falls in', () => {
    const issue = find({
      target: { title: { parts: [{ fact: 'title' }, { text: ' · ' }, { source: starts.source }] }, title_end: t('') },
      facts: { title: long(13) },
      sources: [starts],
      input: template,
    }, 'title-long');
    expect(issue?.detail).toMatch(/^May be cut off after “…[^”]+”\. Starts is cut off\.$/);
  });

  it('offers to remove the repeat of a Site name part, and of the site name typed in one', () => {
    for (const parts of [[{ fact: 'title' }, { text: ' · ' }, { fact: 'site' }], [{ fact: 'title' }, { text: ' at Example' }]] as Part[][]) {
      const setup: Setup = { target: { title: { parts } }, sources: [city], input: template };
      const fix = find(setup, 'title-site-twice')?.fix;
      expect(fix?.label).toBe('Remove the repeat');
      // The template's ending becomes "No ending"; its title stays.
      expect(fix && 'apply' in fix && fix.apply(setup.target!)).toEqual({ title: { parts }, title_end: { text: '' } });
    }
  });

  it('lists a description that holds the title', () => {
    expect(find({ target: { description: { parts: [{ fact: 'title' }, { text: ' in ' }, { source: city.source }, { text: '.' }] } }, sources: [city], input: template }, 'description-title')?.message).toBe(
      'Make the description say more',
    );
    // Whole words only.
    expect(find({ target: { title: t('Art'), description: t('Start your day with coffee.') } }, 'description-title')).toBeUndefined();
  });

  it('keeps quiet about a description that names the title and goes on', () => {
    const named = 'Pricing for teams of every size, billed monthly or yearly, with every feature included and a free month to try it before you decide which plan fits.';
    expect(named.length).toBeGreaterThan(140);
    // On a page, and on a template whose description starts with its title.
    expect(find({ target: { title: t('Pricing'), description: t(named) } }, 'description-title')).toBeUndefined();
    expect(find({ target: { description: { parts: [{ fact: 'title' }, { text: named.slice('Pricing'.length) }] } }, sources: [city], input: template }, 'description-title')).toBeUndefined();
    // A few words more still repeat it.
    expect(find({ target: { title: t('Pricing'), description: t('Pricing for teams.') } }, 'description-title')?.detail).toBe('It repeats the title.');
  });

  it('looks for each field of a composed detail on the page, never the joined text', () => {
    const performers = field('field_performers', 'Performers', { value: 'Mira Kallio', text: 'Mira Kallio, Omar Haddad', many: true });
    const name = (...parts: Part[]): Setup => ({
      target: { schema: { type: 'Event', props: { name: { parts } } } },
      sources: [city, starts, performers],
      input: { ...template, facts: { h1: ['Pricing'], imagesWithoutAlt: [], text: 'Pricing. With Mira Kallio and Omar Haddad on 20 June 2026.' } },
    });
    // Each field is on the page, though "Pricing with Mira Kallio, Omar
    // Haddad · 20 June 2026" is not: nothing to say.
    expect(find(name({ fact: 'title' }, { text: ' with ' }, { source: performers.source }, { text: ' · ' }, { source: starts.source }), 'schema-not-on-page:name')).toBeUndefined();
    // A field that is not: named, with its value.
    expect(find(name({ fact: 'title' }, { text: ' in ' }, { source: city.source }), 'schema-not-on-page:name')).toMatchObject({
      message: "Couldn't find City (Helsinki) on this page",
      detail: 'Structured data should describe what visitors see.',
    });
    // A field another detail holds whole is said there, once.
    const both: Setup = {
      target: { schema: { type: 'Event', props: { name: { parts: [{ fact: 'title' }, { text: ' · ' }, { source: starts.source }] }, startDate: { source: starts.source } } } },
      sources: [city, starts, performers],
      input: { ...template, facts: { h1: ['Pricing'], imagesWithoutAlt: [], text: 'Pricing.' } },
    };
    expect(find(both, 'schema-not-on-page:name')).toBeUndefined();
  });
});

describe('social image as the module shares it (strengthen-zero-config-defaults)', () => {
  const card = { made: 'card' as const, url: '/preview' };
  const judge = (setup: Setup, change?: (given: ChecksInput) => void) => {
    const given = input(setup);
    change?.(given);
    return checks(given);
  };
  const imageRows = (issues: Issue[]) => issues.filter((issue) => issue.id.startsWith('image-'));
  const schema = (type: string) => ({ ...EMPTY_SCHEMA, type });

  it('a card on an event asks for a photo; on a landing page it says nothing', () => {
    const event = imageRows(judge({ target: { schema: { type: 'Event' } }, resolved: { image: null, share: card, schema: schema('Event') } }));
    expect(event).toMatchObject([
      {
        id: 'image-card',
        severity: 'improve',
        message: 'Add a photo of this event',
        detail: 'Links show a card made from the title. A photo of this event usually gets more attention.',
        fix: { label: 'Choose image', image: 'social.image' },
      },
    ]);
    expect(imageRows(judge({ resolved: { image: null, share: card } }))).toEqual([]);
  });

  it('on a template, asks for the field an item lacks: never one image for every item', () => {
    const event = imageRows(
      judge({ target: { schema: { type: 'Event' } }, resolved: { image: null, share: card, schema: schema('Event') }, input: { scope: 'template', typeLabel: 'Event' } }, (given) => {
        given.lookup.facts.image = { ...given.lookup.facts.image!, via: 'Poster', image: null };
      }),
    );
    expect(event).toEqual([
      {
        id: 'image-card',
        severity: 'improve',
        message: 'Add a Poster to this event',
        detail: 'Links show a card made from the title until then.',
        jump: expect.anything(),
      },
    ]);
  });

  it('a found image too small to share says so: the page shares a card instead', () => {
    const issues = judge({ resolved: { image: null, share: card } }, (given) => {
      given.lookup.facts.image = { ...given.lookup.facts.image!, image: { ...IMAGE, width: 500, height: 300 } };
    });
    expect(imageRows(issues)).toMatchObject([
      {
        id: 'image-small',
        severity: 'improve',
        message: 'Use a larger social image',
        detail: 'The image is 500 × 300, too small to share, so links show a card made from the title. An image of 1200 × 630 fills the card.',
      },
    ]);
  });

  it('an image without alt text: says what the head sends instead', () => {
    const alt = (content: string, source: 'entity' | 'site') =>
      imageRows(
        judge({ resolved: { image: { ...IMAGE, alt: '', source } } }, (given) => {
          given.resolved!.head.meta.push({ property: 'og:image:alt', content });
        }),
      ).filter((issue) => issue.id === 'image-alt');
    expect(alt('Choir rehearsing in the old church', 'entity')).toMatchObject([
      { message: 'The social image has no alt text', detail: 'People who cannot see it get its name, “Choir rehearsing in the old church”, instead.' },
    ]);
    expect(alt('', 'entity')).toMatchObject([{ detail: 'People who cannot see it get no description.' }]);
    // The site's image gets the site name: Site › Sharing's row says so.
    expect(alt('Example', 'site')).toEqual([]);
  });

  it('a chosen image over 24 megapixels is not shared: says so, never "not public"', () => {
    const huge = imageRows(
      judge({ target: { social: { image: { media: 'huge' } } }, resolved: { image: null, share: card } }, (given) => {
        given.lookup.media.huge = { ...IMAGE, width: 9000, height: 9000 };
      }),
    );
    expect(huge).toEqual([
      {
        id: 'image-large',
        severity: 'fix',
        message: 'Use a smaller social image',
        detail: 'The chosen image is 9000\u00a0×\u00a09000, over 24 megapixels: too large to share, so links show a card made from the title.',
        jump: expect.anything(),
        fix: { label: 'Choose image', image: 'social.image' },
      },
    ]);
    // One the server shares: no such row.
    const shared = imageRows(
      judge({ target: { social: { image: { media: 'big' } } }, resolved: { image: { ...IMAGE, width: 4000, height: 3000, source: 'override' }, share: { made: 'cover', url: '/x' } } }, (given) => {
        given.lookup.media.big = { ...IMAGE, width: 4000, height: 3000 };
      }),
    );
    expect(shared.map((issue) => issue.id)).not.toContain('image-large');
  });

  it('no image at all, by the site\'s choice: add one', () => {
    expect(imageRows(judge({ resolved: { image: null, share: null } }))).toMatchObject([{ id: 'image-missing', severity: 'improve', message: 'Add a social image' }]);
  });

  it('says what is made of an image: cropped, sharper, shown whole, too small', () => {
    const image = (width: number, height: number, made: 'cover' | 'frame' | 'original', source: 'override' | 'entity' = 'entity') =>
      imageRows(judge({ resolved: { image: { ...IMAGE, width, height, source }, share: { made, url: '/x' } } }));
    // As ShareImage::treatment() decides: cropped when that enlarges it
    // 1.25× at most, else shown whole.
    expect(image(1000, 525, 'cover')).toMatchObject([
      {
        id: 'image-small',
        severity: 'info',
        message: 'The social image could be sharper',
        detail: 'It is 1000 × 525 and shared cropped to 1200 × 630. An image of 1200 × 630 looks sharper.',
      },
    ]);
    expect(image(800, 420, 'frame')).toMatchObject([
      {
        id: 'image-ratio',
        severity: 'info',
        message: 'The social image is shown whole',
        detail: 'It is 800 × 420, so links show it whole on its own colours. An image of 1200 × 630 fills the card.',
      },
    ]);
    // A large one that loses much to the crop: one row, never "will be
    // cropped" besides. A 16:9 photo loses little: nothing to say.
    expect(image(1600, 1200, 'cover')).toMatchObject([
      {
        id: 'image-ratio',
        severity: 'info',
        message: 'The social image is cropped',
        detail: 'It is 1600 × 1200 and shared cropped to 1200 × 630 around its centre.',
      },
    ]);
    expect(image(1770, 996, 'cover')).toEqual([]);
    expect(image(1200, 630, 'cover')).toEqual([]);
    expect(image(800, 800, 'frame', 'override')).toMatchObject([
      {
        id: 'image-ratio',
        severity: 'info',
        message: 'The social image is shown whole',
        detail: 'It is 800 × 800, so links show it whole on its own colours. An image of 1200 × 630 fills the card.',
      },
    ]);
    expect(image(150, 150, 'original', 'override')).toMatchObject([
      {
        id: 'image-small',
        severity: 'fix',
        message: 'Use a larger social image',
        detail: 'The social image is 150 × 150, too small to share large: links show it as a small thumbnail. An image of 1200 × 630 fills the card.',
      },
    ]);
    expect(countIssues(image(800, 800, 'frame', 'override'))).toBe(0);
  });

  it('says the weight in one unit, as the image field does', () => {
    const issues = judge({ resolved: { image: { ...IMAGE, bytes: 10665459 }, share: { made: 'original', url: '/x' } } });
    expect(issues.find((issue) => issue.id === 'image-heavy')?.message).toBe('The social image is 10.2 MB');
    // A share version is sent instead: its weight is the module's.
    const made = judge({ resolved: { image: { ...IMAGE, bytes: 10665459 }, share: { made: 'cover', url: '/x' } } });
    expect(made.find((issue) => issue.id === 'image-heavy')).toBeUndefined();
    expect(imageSize({ ...IMAGE, bytes: 10665459 })).toBe('1200 × 630 · 10.2 MB');
  });

  it('asks to name a page still called by the name for a new page: to improve, then to fix once published', () => {
    const named = (published: boolean) =>
      judge({ input: { published } }, (given) => {
        given.lookup.facts.title = { ...given.lookup.facts.title!, value: 'Our services', placeholder: 'Untitled page' };
      }).find((issue) => issue.id === 'title-placeholder');
    expect(named(false)).toMatchObject({ severity: 'improve', message: 'Name this page' });
    expect(named(true)).toMatchObject({
      severity: 'fix',
      message: 'Name this page',
      detail: 'It is still called “Untitled page”, so links use its first heading. Give it a title in Page data.',
    });
    expect(find({}, 'title-placeholder')).toBeUndefined();
  });

  it('says links already shared keep their old preview while a published page shares another', () => {
    const changed = (published: boolean, change: boolean) =>
      find({ resolved: { share: card, share_changed: change }, input: { published } }, 'share-changed');
    expect(changed(true, true)).toMatchObject({ severity: 'info', message: 'Links already shared keep their old preview for a while' });
    expect(changed(true, false)).toBeUndefined();
    expect(changed(false, true)).toBeUndefined();
  });
});

describe('sharing rows for site administrators', () => {
  const SHARE: ShareInfo = { missing: null, theme_logo: null, svg: false, site_alt: 'Our studio', host: null };
  const rows = (setup: Setup, share: Partial<ShareInfo> = {}, site: Partial<Identity> = {}) =>
    checks(input({ ...setup, input: { share: { ...SHARE, ...share }, site: { ...SITE, identity: { ...SITE.identity, ...site } }, ...setup.input } })).filter((issue) => issue.id.startsWith('share-'));
  const only = (issues: Issue[]) => issues.map(({ id, severity, message, detail }) => ({ id, severity, message, ...(detail ? { detail } : {}) }));

  it('says why no image can be made, and what links use instead', () => {
    expect(only(rows({}, { missing: 'fonts' }))).toEqual([
      { id: 'share-unmade', severity: 'info', message: "Shared images can't be made on this server", detail: 'Its image library has no font support, so links use no image.' },
    ]);
    expect(rows({}, { missing: 'fonts' }, { default_image: 'uuid', share_fallback: 'image' })[0].detail).toBe(
      "Its image library has no font support, so links use the site's image.",
    );
  });

  it('names an address visitors cannot reach', () => {
    expect(only(rows({}, { host: 'http://cms:8080' }))).toEqual([
      {
        id: 'share-host',
        severity: 'info',
        message: "Visitors' apps can't reach shared images",
        detail: "They are addressed at http://cms:8080, where the frontend fetches Drupal. Have it fetch Drupal at its public address, or set Drupal's reverse proxy settings in settings.php.",
      },
    ]);
  });

  it('asks for a PNG version of an SVG logo', () => {
    expect(rows({}, { svg: true })).toMatchObject([
      { id: 'share-svg', message: 'Shared images show your initial because your logo is an SVG', jump: { scope: 'site', field: 'identity.logo' } },
    ]);
  });

  it('names the script of a title the fonts cannot draw, whatever the page language', () => {
    const script = (title: string) => {
      const given = input({ resolved: { image: null, share: null }, input: { share: SHARE } });
      given.texts = { ...given.texts, social_title: title };
      return checks(given).filter((issue) => issue.id === 'share-script');
    };
    // An English page with a Japanese title.
    expect(script('湖畔の夏至コンサート')).toMatchObject([{ severity: 'info', message: "Shared images can't be made for Japanese titles yet" }]);
    // Not a script the dialog names, or a title of emoji only: this title.
    expect(script('ᚠᚢᚦ')[0].message).toBe("Shared images can't be made for this title yet");
    expect(script('🚀🎉')[0].message).toBe("Shared images can't be made for this title yet");
    // A card was made: nothing to say.
    expect(rows({ resolved: { image: null, share: { made: 'card', url: '/x' } } })).toEqual([]);
  });

  it('offers a card from each page\'s title where every page shares one image, and asks for the site image\'s alt text', () => {
    const issues = rows({}, { site_alt: '' }, { default_image: 'uuid', share_fallback: 'image' });
    expect(issues).toMatchObject([
      {
        id: 'share-one-picture',
        message: 'Pages without an image share the same image',
        fix: { label: 'Make one from the title', site: { path: 'identity.share_fallback', value: 'card' } },
      },
      { id: 'share-site-alt', message: "The site's image has no alt text" },
    ]);
    expect(rows({}, {}, { default_image: 'uuid', share_fallback: 'image' }).map((issue) => issue.id)).toEqual(['share-one-picture']);
  });

  it('tells an editor none of it', () => {
    const editor = checks(
      input({ input: { can: { target: true, site: false }, share: { ...SHARE, missing: 'fonts', svg: true, host: 'http://cms:8080' }, site: { ...SITE, identity: { ...SITE.identity, default_image: 'uuid', share_fallback: 'image' as const } } } }),
    );
    expect(editor.filter((issue) => issue.id.startsWith('share-'))).toEqual([]);
  });
});

describe('isOwnNode', () => {
  const nodes = [
    { id: 'https://example.com/about#breadcrumb', type: 'BreadcrumbList', origin: 'page' as const, at: 2 },
    { id: 'https://other.example/#breadcrumb', type: 'BreadcrumbList', origin: 'hand' as const, item: 0, at: 3 },
  ];
  it('knows the module\'s own trail by its full id', () => {
    expect(isOwnNode(nodes, 'https://example.com/about#breadcrumb')).toBe(true);
  });
  it('does not take a hand-added item with the same fragment for the module\'s', () => {
    expect(isOwnNode(nodes, 'https://other.example/#breadcrumb')).toBe(false);
    expect(isOwnNode(nodes, 'https://example.com/elsewhere#breadcrumb')).toBe(false);
    expect(isOwnNode(nodes, null)).toBe(false);
  });
});
