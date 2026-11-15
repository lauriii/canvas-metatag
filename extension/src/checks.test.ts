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
        tokens: { title: text('Page title', ''), site: text('Site name', '') },
      },
      ['Add a title', 'This page has no title for search results.'],
    ],
    [
      'title-generic',
      'improve',
      { tokens: { title: text('Page title', 'Home') } },
      ['Make the title specific', '"Home" says little about this page.'],
    ],
    [
      'token-empty:description',
      'improve',
      {
        target: { social: { description: '{description} More.' } },
        tokens: { description: text('Description', '') },
      },
      ['Fill in Description or remove it', '"Description" is empty for this page, so it is left out.'],
    ],
    [
      'title-site-twice',
      'improve',
      { target: { title: 'Example pricing {sep} {site}' } },
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
      { target: { title: long(14) } },
      ['Shorten the title', 'May be cut off after “…words words words”.'],
    ],
    [
      'description-missing',
      'improve',
      { tokens: { description: text('Description', '') } },
      ['Add a description', 'Without one, search engines pick text from the page.'],
    ],
    [
      'description-long',
      'info',
      { tokens: { description: text('Description', long(20)) } },
      ['Shorten the description', 'May be cut off after “…words words words”.'],
    ],
    [
      'description-title',
      'improve',
      { tokens: { description: text('Description', 'pricing!') } },
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
        resolved: {
          schema: {
            withheld: true,
            missing_required: ['startDate'],
            missing_recommended: [],
          },
        },
      },
      ['Add Starts', 'Event details are left out until it is filled in.'],
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
      ['Check Venue', 'It does not appear on the page. Structured data should match what visitors see.'],
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

  it('at template scope "this page" is "this event", never the preview\'s title', () => {
    const template = { scope: 'template', typeLabel: 'Event' } as const;
    const title = find(
      {
        tokens: { title: text('Page title', ''), site: text('Site name', '') },
        input: template,
      },
      'title-empty',
    )!;
    expect(title.detail).toBe('This event has no title for search results.');
    const empty = find(
      {
        target: { social: { description: '{description} More.' } },
        tokens: { description: text('Description', '') },
        input: template,
      },
      'token-empty:description',
    )!;
    // The template cannot fill it in: a fact, not a task.
    expect(empty).toMatchObject({
      severity: 'info',
      message: 'Description is empty for this event',
      detail:
        'It is left out for this event, and filled in wherever another event has one.',
    });
    // The previewed node's title is in the values, never in a sentence.
    const all = checks(
      input({
        target: { social: { description: '{description} More.' } },
        tokens: {
          title: text('Page title', 'Hello world'),
          description: text('Description', ''),
        },
        input: template,
      }),
    );
    expect(
      all.find((issue) => issue.id === 'token-empty:description')?.detail,
    ).toContain('this event');
    for (const issue of all) {
      expect(`${issue.message} ${issue.detail ?? ''}`).not.toContain(
        'Hello world',
      );
    }
    // A structured data property linked to a field this event has no value
    // in: a fact too, said once, and not in the counted row.
    const linked = checks(
      input({
        target: {
          schema: {
            type: 'Event',
            props: { endDate: '{field.field_ends}', image: '{field.field_poster}' },
          },
        },
        tokens: {
          'field.field_ends': { label: 'Field: Ends', type: 'datetime', value: '' },
          'field.field_poster': { label: 'Field: Poster', type: 'image', value: '', image: null },
        },
        resolved: {
          schema: {
            withheld: false,
            missing_required: [],
            missing_recommended: ['endDate', 'image', 'location_name'],
          },
        },
        input: template,
      }),
    );
    expect(linked.find((issue) => issue.id === 'schema-recommended')?.message).toBe(
      'Event is missing: Venue.',
    );
    expect(linked.find((issue) => issue.id === 'schema-empty:endDate')).toMatchObject({
      severity: 'info',
      message: 'Ends is empty for this event',
      detail:
        'It is left out for this event, and filled in wherever another event has one.',
      jump: { scope: 'target', tab: 'schema', field: 'schema.props.endDate' },
    });
    expect(ids(linked)).toContain('schema-empty:image');
    // At page scope it stays a task.
    expect(
      find(
        {
          target: { schema: { type: 'Event', props: { endDate: '{field.field_ends}' } } },
          tokens: { 'field.field_ends': { label: 'Field: Ends', type: 'datetime', value: '' } },
          resolved: {
            schema: { withheld: false, missing_required: [], missing_recommended: ['endDate'] },
          },
        },
        'schema-recommended',
      )?.message,
    ).toBe('Event is missing: Ends.');
    // A type named by an abbreviation keeps it.
    expect(
      find(
        {
          tokens: { title: text('Page title', ''), site: text('Site name', '') },
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
  });

  it('the words a long text may be cut after end without their own mark', () => {
    const title = Array.from({ length: 14 }, () => 'words,').join(' ');
    expect(find({ target: { title } }, 'title-long')?.detail).toBe(
      'May be cut off after “…words, words, words”.',
    );
    // Also a mark of another script, as the server's plain text knows it.
    const arabic = Array.from({ length: 14 }, () => 'words،').join(' ');
    expect(find({ target: { title: arabic } }, 'title-long')?.detail).toBe(
      'May be cut off after “…words، words، words”.',
    );
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
