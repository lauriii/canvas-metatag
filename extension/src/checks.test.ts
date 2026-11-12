import { describe, expect, it } from 'vitest';

import { type ChecksInput, checks, countIssues, identityGaps } from './checks';
import { REGISTRY, cascade, merge, source, texts as textsOf } from './model';
import type { ImageInfo, Issue, Resolved, SeoValues, TokenInfo } from './types';

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

const text = (label: string, value: string): TokenInfo => ({
  label,
  type: 'text',
  value,
});

const TOKENS: Record<string, TokenInfo> = {
  title: text('Page title', 'Pricing'),
  description: text('Description', 'Simple plans for teams of every size.'),
  site: text('Site name', 'Example'),
  sep: text('Separator', '|'),
  url: {
    label: 'Page address',
    type: 'url',
    value: 'https://www.example.com/pricing',
  },
  published: {
    label: 'First published',
    type: 'datetime',
    value: '2026-03-02T09:00:00+02:00',
  },
  modified: {
    label: 'Last updated',
    type: 'datetime',
    value: '2026-03-04T11:30:00+02:00',
  },
  image: { label: 'Page image', type: 'image', value: '', image: IMAGE },
};

const SITE = {
  identity: {
    kind: 'organization' as const,
    name: 'Example Inc',
    separator: '|',
    logo: '6f1c2a0e-5b7d-4c1e-9a53-0d6f7c1b2e44',
    default_image: '',
    same_as: ['https://social.example.com/example'],
  },
  values: {
    title: '{title} {sep} {site}',
    robots: { max_image_preview: 'large' as const },
  },
};

interface Setup {
  target?: SeoValues;
  fromDefault?: SeoValues;
  site?: SeoValues;
  tokens?: Record<string, TokenInfo>;
  resolved?: Partial<Resolved> | null;
  robotsMeta?: string;
  canonical?: string;
  input?: Partial<ChecksInput>;
}

function input(setup: Setup = {}): ChecksInput {
  const tokens = { ...TOKENS, ...setup.tokens };
  const layers = {
    target: setup.target ?? {},
    from_default: setup.fromDefault ?? {},
    site: setup.site ?? SITE.values,
  };
  const effective = cascade(
    merge(layers.from_default, layers.target),
    layers.site,
  );
  const flat = Object.fromEntries(
    Object.entries(tokens).map(([name, token]) => [name, token.value]),
  );
  return {
    effective,
    sources: (path) => source(path, layers),
    texts: textsOf(effective, flat),
    tokens,
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
            schema: {
              withheld: false,
              missing_required: [],
              missing_recommended: [],
            },
            ...setup.resolved,
          },
    site: SITE,
    registry: REGISTRY,
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
    previewLabel: 'Pricing',
    defaultLanguage: 'English',
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

  // [rule, severity, what makes it fire, the exact message]
  const rows: [string, Issue['severity'], Setup, string][] = [
    [
      'title-empty',
      'fix',
      {
        tokens: { title: text('Page title', ''), site: text('Site name', '') },
      },
      'This page has no title for search results.',
    ],
    [
      'title-generic',
      'improve',
      { tokens: { title: text('Page title', 'Home') } },
      '"Home" says little about this page.',
    ],
    [
      'token-empty:description',
      'improve',
      {
        target: { social: { description: '{description} More.' } },
        tokens: { description: text('Description', '') },
      },
      '"Description" is empty for this page, so it is left out.',
    ],
    [
      'title-site-twice',
      'improve',
      { target: { title: 'Example pricing {sep} {site}' } },
      'The site name appears twice in the title.',
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
      'The title and the main heading say different things.',
    ],
    [
      'title-long',
      'info',
      { target: { title: long(14) } },
      'The title may be cut off on desktop after "words words words".',
    ],
    [
      'description-missing',
      'improve',
      { tokens: { description: text('Description', '') } },
      'There is no description. Search engines will pick text from the page.',
    ],
    [
      'description-long',
      'info',
      { tokens: { description: text('Description', long(20)) } },
      'The description may be cut off on phones after "words words words".',
    ],
    [
      'description-title',
      'improve',
      { tokens: { description: text('Description', 'pricing!') } },
      'The description repeats the title.',
    ],
    [
      'noindex',
      'improve',
      { target: { robots: { noindex: true } } },
      'Hidden from search engines. Set on this page.',
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
      'Text previews are off. Results show no description and answer engines cannot quote this page.',
    ],
    [
      'image-preview',
      'info',
      { target: { robots: { max_image_preview: 'none' } } },
      'Large image previews are off.',
    ],
    [
      'image-missing',
      'improve',
      { resolved: { image: null } },
      'No image for social cards. Links to this page will show without one.',
    ],
    [
      'image-small',
      'improve',
      { resolved: { image: { ...IMAGE, width: 800, height: 420 } } },
      'The social image is 800 x 420. Use at least 1200 x 630 for a large card.',
    ],
    [
      'image-ratio',
      'info',
      { resolved: { image: { ...IMAGE, width: 1200, height: 1200 } } },
      'The social image will be cropped. About 1.91:1 fits best.',
    ],
    [
      'image-heavy',
      'info',
      { resolved: { image: { ...IMAGE, bytes: 6.5 * 1048576 } } },
      'The social image is 6.5 MB. Some services skip images over 5 MB.',
    ],
    [
      'image-format',
      'improve',
      { resolved: { image: { ...IMAGE, mime: 'image/svg+xml' } } },
      'SVG images do not show on many services. Use JPEG, PNG or WebP.',
    ],
    [
      'image-alt',
      'info',
      { resolved: { image: { ...IMAGE, alt: ' ' } } },
      'The social image has no description for people who cannot see it.',
    ],
    [
      'h1-missing',
      'improve',
      { input: { facts: { h1: [], imagesWithoutAlt: [], text: '' } } },
      'The page has no main heading.',
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
        resolved: {
          schema: {
            withheld: true,
            missing_required: ['startDate'],
            missing_recommended: [],
          },
        },
      },
      'Event needs "Starts". Until it is filled in, the Event details are left out.',
    ],
    [
      'schema-recommended',
      'improve',
      {
        target: { schema: { type: 'Event' } },
        resolved: {
          schema: {
            withheld: false,
            missing_required: [],
            missing_recommended: ['endDate', 'location_name'],
          },
        },
      },
      'Event is missing: Ends, Venue.',
    ],
    [
      'schema-dates:endDate',
      'improve',
      {
        target: {
          schema: {
            type: 'Event',
            props: {
              startDate: '2027-03-04T18:00',
              endDate: '2027-03-04T16:00',
            },
          },
        },
      },
      '"Ends" is before "Starts".',
    ],
    [
      'schema-dates:dateModified',
      'improve',
      {
        target: { schema: { type: 'Article' } },
        tokens: {
          modified: { ...TOKENS.modified, value: '2026-03-01T09:00:00+02:00' },
        },
      },
      '"Updated" is before "Published".',
    ],
    [
      'schema-not-on-page:location_name',
      'improve',
      {
        target: {
          schema: { type: 'Event', props: { location_name: 'The New Mill' } },
        },
      },
      '"Venue" does not appear on the page. Structured data should match what visitors see.',
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

  it.each(rows)('%s fires', (id, severity, setup, message) => {
    const issue = find(setup, id);
    expect(issue).toBeDefined();
    expect(issue).toMatchObject({ id, severity, message });
    // And it is silent on the complete page.
    expect(find({}, id)).toBeUndefined();
  });

  it('every rule of the design has a row', () => {
    expect([...new Set(rows.map(([id]) => id.split(':')[0]))].sort()).toEqual(
      [
        'title-empty',
        'title-generic',
        'token-empty',
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
        'schema-recommended',
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
    ).toBe('Add a heading set to H1 in the page content.');
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
    ).toBe('Set a heading in this template to H1.');
    // A code is rarely printed as written: no "does not appear" for it.
    const product = find(
      {
        target: {
          schema: {
            type: 'Product',
            props: { offers_priceCurrency: 'EUR', sku: 'DESK-1' },
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
    ).toBe('Title: "Pricing | Example" · Heading: "Contact our sales team"');
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
    [
      'title-site-twice',
      { target: { title: 'Example pricing {sep} {site}' } },
      { title: 'pricing {sep} {site}' },
    ],
    [
      'title-site-twice',
      { target: { title: 'Pricing {sep} Example {sep} {site}' } },
      { title: 'Pricing {sep} {site}' },
    ],
    [
      'title-site-twice',
      { target: { title: 'Pricing | Example | {site}' } },
      { title: 'Pricing | {site}' },
    ],
    [
      'title-site-twice',
      { target: { title: '{site} {sep} Plans at Example' } },
      { title: '{site} {sep} Plans at' },
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
        { target: { title: 'Example pricing {sep} {site}' } },
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
    // The repeat comes from the page title itself: nothing literal to remove.
    expect(
      find(
        { tokens: { title: text('Page title', 'Example pricing') } },
        'title-site-twice',
      )!.fix,
    ).toBeUndefined();
  });

  it('suggest is offered at page scope with AI only', () => {
    const missing = { tokens: { description: text('Description', '') } };
    expect(find(missing, 'description-missing')!.fix).toBeUndefined();
    expect(
      find({ ...missing, input: { ai: true } }, 'description-missing')!.fix,
    ).toEqual({ label: 'Suggest', suggest: 'description' });
    expect(
      find(
        { ...missing, input: { ai: true, scope: 'template' } },
        'description-missing',
      )!.fix,
    ).toBeUndefined();
    expect(
      find(
        {
          tokens: { description: text('Description', long(25)) },
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
            props: { location_name: 'Nowhere to be found' },
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
      target: { title: '价格' },
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
          target: { title: 'Pricing and plans {sep} {site}' },
          ...facts('Pricing'),
        },
        'title-heading',
      ),
    ).toBeUndefined();
    expect(
      find(
        { target: { title: 'Plans' }, ...facts('Our plans, compared') },
        'title-heading',
      ),
    ).toBeUndefined();
    expect(
      find(
        { target: { title: 'Team plans' }, ...facts('Plans for teams') },
        'title-heading',
      ),
    ).toBeUndefined();
    // Short Latin words do not count as shared; two characters do in other scripts.
    expect(
      find(
        { target: { title: 'How we do it' }, ...facts('What we do') },
        'title-heading',
      ),
    ).toBeDefined();
    expect(
      find(
        { target: { title: '价格 方案' }, ...facts('方案 比较') },
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

  it('schema-not-on-page compares literals only, normalized', () => {
    const event = (props: Record<string, string>) => ({
      target: { schema: { type: 'Event', props } },
    });
    expect(
      find(
        event({ location_name: 'the old mill' }),
        'schema-not-on-page:location_name',
      ),
    ).toBeUndefined();
    expect(
      find(
        event({ location_name: '{title} hall' }),
        'schema-not-on-page:location_name',
      ),
    ).toBeUndefined();
    // Dates and other kinds are never compared with the text.
    expect(
      ids(checks(input(event({ startDate: '2027-03-04' })))).filter((id) =>
        id.startsWith('schema-not-on-page'),
      ),
    ).toEqual([]);
  });
});

describe('rules with conditions', () => {
  it('title-generic is silent outside English', () => {
    const home = { tokens: { title: text('Page title', 'Home') } };
    expect(
      find({ ...home, input: { langcode: 'en-gb' } }, 'title-generic'),
    ).toBeDefined();
    expect(
      find({ ...home, input: { langcode: 'fi' } }, 'title-generic'),
    ).toBeUndefined();
    expect(
      find(
        { tokens: { title: text('Page title', 'Homes for sale') } },
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
      find({ ...hidden, input: { scope: 'template' } }, 'noindex')!.message,
    ).toBe('Hidden from search engines. Set for every Article.');
    const bySite = find({ site: { robots: { noindex: true } } }, 'noindex')!;
    expect(bySite.message).toBe(
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
      find({ fromDefault: { robots: { noindex: true } } }, 'noindex')!.message,
    ).toBe('Hidden from search engines. Set on the English version.');
    // Only the server's output says so: a configuration override.
    expect(
      find({ robotsMeta: 'noindex, max-image-preview:large' }, 'noindex'),
    ).toMatchObject({
      message:
        'Hidden from search engines. Set in site configuration outside SEO.',
      fix: undefined,
    });
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

  it('image-small names the thumbnail under 600 x 315', () => {
    expect(
      find(
        { resolved: { image: { ...IMAGE, width: 400, height: 210 } } },
        'image-small',
      )!.message,
    ).toBe('The social image is 400 x 210. It will show as a small thumbnail.');
  });

  it('token-empty: one row per value, not for names outside the vocabulary', () => {
    const issues = checks(
      input({
        target: {
          title: '{title} {field.gone} {sep} {site}',
          social: { title: '{title}' },
        },
        tokens: { title: text('Page title', '') },
      }),
    );
    expect(ids(issues).filter((id) => id.startsWith('token-empty'))).toEqual([
      'token-empty:title',
    ]);
    expect(
      issues.find((issue) => issue.id === 'token-empty:title')!.jump,
    ).toEqual({ scope: 'target', tab: 'search', field: 'title' });
  });

  it('without a page to resolve for, the image rules stay silent', () => {
    expect(
      ids(checks(input({ resolved: null }))).filter((id) =>
        id.startsWith('image-'),
      ),
    ).toEqual([]);
  });

  it('at template scope "this page" is the previewed page', () => {
    const issue = find(
      {
        tokens: { title: text('Page title', ''), site: text('Site name', '') },
        input: { scope: 'template', previewLabel: 'Hello world' },
      },
      'title-empty',
    )!;
    expect(issue.message).toBe('Hello world has no title for search results.');
  });

  it('long text cannot be judged without a measurer', () => {
    expect(
      find(
        { target: { title: long(20) }, input: { measurer: null } },
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
    // The site token is filled from the site name when the identity has none.
    expect(
      identityGaps(bare.input.site, TOKENS).map((gap) => gap.text),
    ).toEqual(['no logo', 'no profile link']);
    expect(
      identityGaps(bare.input.site, {
        ...TOKENS,
        site: text('Site name', ''),
      }).map((gap) => gap.field),
    ).toEqual(['identity.name', 'identity.logo', 'identity.same_as']);
    expect(find(bare, 'identity-incomplete')!.jump).toEqual({
      scope: 'site',
      tab: 'identity',
      field: 'identity.logo',
    });
  });
});
