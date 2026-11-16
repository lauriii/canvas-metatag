// The Checks rules: facts about this dialog's settings and the page preview.
// No score. Rules fed by `resolved` describe the saved draft.
import type { PageFacts } from './host';
import {
  dimensions,
  fileSize,
  inSentence,
  largeCardNeeds,
  meter,
} from './model';
import type {
  Issue,
  Jump,
  Measurer,
  Registry,
  Resolved,
  SeoValues,
  SiteSettings,
  Source,
  Tab,
  Texts,
  Value,
} from './types';
import { type Lookup, PROP_KINDS, brokenWhy, kindOf, resolve, rowOf, tagOf } from './values';

export interface ChecksInput {
  effective: SeoValues;
  sources(path: string): Source;
  texts: Texts;
  /** The facts (Canvas's live title and description laid over the server's) and the links. */
  lookup: Lookup;
  /** The separator between the title's parts. */
  separator: string;
  resolved: Resolved | null;
  site: SiteSettings;
  registry: Registry;
  facts: PageFacts | null;
  scope: 'page' | 'template';
  can: { target: boolean; site: boolean };
  langcode: string;
  /** AI suggestions are available. */
  ai: boolean;
  /** The target is published. */
  published: boolean;
  /** The content type's name at template scope ("Article"). */
  typeLabel: string;
  /** The name of the default language, for a setting inherited from it. */
  defaultLanguage: string;
  /** The robots settings are sent: `resolved`'s robots tag describes them. */
  robotsSettled: boolean;
  measurer: Measurer;
}

const GENERIC = ['home', 'homepage', 'untitled', 'page', 'new page', 'welcome'];
const FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Lower case, punctuation to spaces, whitespace collapsed. */
const normal = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The title with the site name and the separators around it taken out. */
function withoutSite(title: string, site: string, sep: string): string {
  const rest = site
    ? title.replace(new RegExp(escape(site), 'gi'), ' ')
    : title;
  // A separator left with nothing on one side goes.
  const kept: string[] = [];
  for (const word of rest.split(' ').filter(Boolean)) {
    if (word !== sep || (kept.length > 0 && kept.at(-1) !== sep)) {
      kept.push(word);
    }
  }
  while (sep !== '' && kept.at(-1) === sep) {
    kept.pop();
  }
  return kept.join(' ');
}

/** Words that carry meaning: 4 or more letters in Latin script, 2 or more characters otherwise. */
function words(a: string, b: string): [string[], string[]] {
  const latin = !/[^\p{Script=Latin}\p{N}\s]/u.test(`${a}${b}`);
  const split = (text: string) =>
    text
      .split(' ')
      .filter((word) => Array.from(word).length >= (latin ? 4 : 2));
  return [split(a), split(b)];
}

/** What is missing from the site identity, in words. Empty when complete. */
export function identityGaps(
  site: SiteSettings,
  siteName: string,
): { field: string; text: string }[] {
  const { identity } = site;
  return [
    !identity.name.trim() && !siteName.trim()
      ? { field: 'identity.name', text: 'no name' }
      : null,
    !identity.logo ? { field: 'identity.logo', text: 'no logo' } : null,
    identity.same_as.length === 0
      ? { field: 'identity.same_as', text: 'no profile link' }
      : null,
  ].filter((gap) => gap !== null);
}

/** The sentence of `identity-incomplete`; also the callout in Site › Identity. */
export const identitySentence = (gaps: { text: string }[]) =>
  `Search engines know little about who runs this site: ${gaps
    .map((gap) => gap.text)
    .join(', ')}.`;

/** The issues that count: the badge shows them, and nothing else. */
export const countIssues = (issues: Issue[]) =>
  issues.filter((issue) => issue.severity !== 'info').length;

export function checks(input: ChecksInput): Issue[] {
  const { effective, texts, lookup, resolved, facts, registry } = input;
  const issues: Issue[] = [];
  const onPage = input.scope === 'page';
  // At template scope the previewed node is "this article": the sheet names
  // it once, above the issues.
  const page = onPage ? 'this page' : `this ${inSentence(input.typeLabel)}`;
  const Page = page.charAt(0).toUpperCase() + page.slice(1);
  const jump = (tab: Tab, field: string): Jump => ({
    scope: 'target',
    tab,
    field,
  });
  const suggest = (field: string) =>
    input.ai && onPage ? { label: 'Suggest', suggest: field } : undefined;
  const set = (path: string, to: unknown) => (values: SeoValues) => {
    const [group, key] = path.split('.');
    return {
      ...values,
      [group]: { ...(values as Record<string, object>)[group], [key]: to },
    };
  };

  // Title.
  const site = lookup.facts.site?.value ?? '';
  const sep = input.separator;
  const bare = withoutSite(texts.title, site, sep);
  if (texts.title === '') {
    issues.push({
      id: 'title-empty',
      severity: 'fix',
      message: 'Add a title',
      detail: `${Page} has no title for search results.`,
      jump: jump('search', 'title'),
    });
  } else if (
    input.langcode.startsWith('en') &&
    GENERIC.includes(normal(bare))
  ) {
    issues.push({
      id: 'title-generic',
      severity: 'improve',
      message: 'Make the title specific',
      detail: `"${bare}" says little about ${page}.`,
      jump: jump('search', 'title'),
    });
  }

  // Links that cannot work for any item: broken ones to fix, hidden ones to
  // improve. A link that is only empty for this item says so at its field.
  const paths: [string, Tab][] = [
    ['title', 'search'],
    ['title_end', 'search'],
    ['description', 'search'],
    ['social.title', 'social'],
    ['social.description', 'social'],
    ['social.image', 'social'],
    ...Object.keys(effective.schema?.props ?? {}).map(
      (key) => [`schema.props.${key}`, 'schema'] as [string, Tab],
    ),
  ];
  const fieldName = (path: string) =>
    path === 'title_end'
      ? 'title ending'
      : path.startsWith('schema.props.')
        ? (registry[effective.schema?.type ?? 'WebPage']?.props?.find((one) => `schema.props.${one.key}` === path)?.label ?? 'detail').toLowerCase()
        : path.replace('social.', 'social ');
  // Whether a value has a default to fall back on, or is left out.
  const fallsBack = (path: string) =>
    !path.startsWith('schema.props.') ||
    !!registry[effective.schema?.type ?? 'WebPage']?.props?.find((one) => `schema.props.${one.key}` === path)?.default;
  // "title, street address and 2 more"
  const listed = (names: string[]) =>
    names.length <= 3
      ? names.join(', ').replace(/, ([^,]*)$/, ' and $1')
      : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  const broken: string[] = [];
  const hidden: string[] = [];
  // Hidden links, by what hides them: a reference whose item visitors may
  // not see for this item, or a field visitors may never see.
  const hiddenBy = new Map<string, { paths: string[]; tab: Tab; reference: boolean }>();
  for (const [path, tab] of onPage ? [] : paths) {
    const value = path.split('.').reduce<unknown>((at, key) => (at as Record<string, unknown> | undefined)?.[key], effective) as Value | undefined;
    if (!value || !('source' in value)) {
      continue;
    }
    const kind = kindOf(path, registry[effective.schema?.type ?? 'WebPage']?.props);
    const shown = resolve(value, kind, lookup);
    const what = fieldName(path);
    if (shown.status === 'broken') {
      broken.push(path);
      issues.push({
        id: `link-broken:${path}`,
        severity: 'fix',
        message: `Link the ${what} again`,
        detail: `It was linked to ${tagOf(value, lookup, path)}, which ${brokenWhy(lookup.broken?.[path]?.reason, kind)}. Each ${inSentence(input.typeLabel)} uses its default until another field is linked.`,
        jump: jump(tab, path),
        fix: { label: 'Link another field', link: true },
      });
    } else if (shown.status === 'hidden' && rowOf(lookup, value)) {
      hidden.push(path);
      const row = rowOf(lookup, value)!;
      const by = row.hop ? row.path[0] : row.label;
      const group = hiddenBy.get(by) ?? { paths: [], tab, reference: row.hop };
      group.paths.push(path);
      hiddenBy.set(by, group);
    }
  }
  const required = new Set(resolved?.schema.missing_required.map((key) => `schema.props.${key}`) ?? []);
  for (const [by, group] of hiddenBy) {
    const left = group.paths.filter((path) => !fallsBack(path)).map(fieldName);
    const kept = group.paths.filter(fallsBack).map(fieldName);
    const withheld = group.paths.some((path) => required.has(path));
    // What is left out, said once: the whole type's details when a required
    // one is among them.
    const what = [
      withheld
        ? `${registry[effective.schema?.type ?? 'WebPage']?.label ?? 'Structured data'} details are left out for ${page}${
            group.reference ? `, because visitors can't see its ${by.toLowerCase()}` : ''
          }`
        : left.length && `${listed(left)} ${left.length === 1 ? 'is' : 'are'} left out`,
      kept.length && `${listed(kept)} ${kept.length === 1 ? 'uses its default' : 'use their defaults'}`,
    ].filter(Boolean).join('; ');
    issues.push({
      id: `link-hidden:${group.paths[0]}`,
      severity: 'improve',
      // A reference: only this item's is hidden; a field: every item's.
      message: group.reference ? `${by} is hidden from visitors for ${page}` : `${by} is hidden from visitors`,
      detail: `${what[0].toUpperCase()}${what.slice(1)}. ${
        group.reference
          ? `Publish the ${by.toLowerCase()} or preview another ${inSentence(input.typeLabel)}.`
          : 'Link a field visitors can see.'
      }`,
      jump: jump(group.tab, group.paths[0]),
    });
  }

  if (site && texts.title.toLowerCase().split(site.toLowerCase()).length > 2) {
    // The certain fix: the target's own typed main part names the site, and
    // the ending is the site name: no ending. A main part linked to a field
    // would apply one item's text to every item, so it gets none.
    const main = input.sources('title') === 'target' ? effective.title : undefined;
    const typed = !!main && 'text' in main && new RegExp(escape(site), 'i').test(main.text);
    const endsWithSite = normal(texts.title_end) === normal(site);
    issues.push({
      id: 'title-site-twice',
      severity: 'improve',
      message: 'Remove the repeated site name',
      detail: 'The site name appears twice in the title.',
      jump: jump('search', 'title'),
      fix:
        typed && endsWithSite
          ? {
              label: 'Remove the repeat',
              apply: (values) => ({ ...values, title_end: { text: '' } }),
            }
          : undefined,
    });
  }

  if (facts?.h1.length === 1) {
    const [title, heading] = [normal(texts.title), normal(facts.h1[0])];
    const [mine, theirs] = words(title, heading);
    if (
      title &&
      heading &&
      !title.includes(heading) &&
      !heading.includes(title) &&
      !mine.some((word) => theirs.includes(word))
    ) {
      issues.push({
        id: 'title-heading',
        severity: 'improve',
        message: 'Match the title to the main heading',
        detail: 'The title and the main heading say different things.',
        jump: jump('search', 'title'),
      });
    }
  }

  const cut = (kind: 'title' | 'description', text: string) => {
    const result = meter(kind, text, input.measurer);
    // The words' own closing mark would stand beside the sentence's stop
    // (the marks the server's plain text treats as an end).
    const after =
      result.after.replace(/[.!?…:;,。！？、，．：；｡؟۔।॥،؛]+$/u, '') ||
      result.after;
    return result.state === 'long' ? `May be cut off after “…${after}”.` : null;
  };
  const titleCut = cut('title', texts.title);
  if (titleCut) {
    // Cut after the main part, inside its ending: the ending is what is lost.
    const lost =
      texts.title_main !== '' &&
      texts.title_end !== '' &&
      meter('title', texts.title, input.measurer).shown >= texts.title_main.length;
    issues.push({
      id: 'title-long',
      severity: 'info',
      message: 'Shorten the title',
      detail: lost
        ? `${titleCut} The ending “${texts.title_end}” is the part that gets lost.`
        : titleCut,
      jump: jump('search', 'title'),
    });
  }

  // Description.
  if (texts.description === '') {
    issues.push({
      id: 'description-missing',
      severity: 'improve',
      message: 'Add a description',
      detail: 'Without one, search engines pick text from the page.',
      jump: jump('search', 'description'),
      fix: suggest('description'),
    });
  } else {
    const descriptionCut = cut('description', texts.description);
    if (descriptionCut) {
      issues.push({
        id: 'description-long',
        severity: 'info',
        message: 'Shorten the description',
        detail: descriptionCut,
        jump: jump('search', 'description'),
        fix: suggest('description'),
      });
    }
    if (bare && normal(texts.description) === normal(bare)) {
      issues.push({
        id: 'description-title',
        severity: 'improve',
        message: 'Make the description say more',
        detail: 'It repeats the title.',
        jump: jump('search', 'description'),
      });
    }
  }

  // Visibility.
  const robots = effective.robots ?? {};
  const head = resolved?.head;
  const emitted =
    head?.meta.find((row) => row.name === 'robots')?.content ?? '';
  // Only the server's output says so, and only once it describes these values.
  const byConfig =
    input.robotsSettled && !robots.noindex && /(^|,\s*)noindex\b/.test(emitted);
  const noindex = robots.noindex === true || byConfig;
  const on = (path: string) => input.sources(path) === 'target';
  if (noindex && input.published) {
    const from = byConfig ? 'config' : input.sources('robots.noindex');
    issues.push({
      id: 'noindex',
      severity: 'improve',
      message: `Show ${page} in search`,
      detail: `Hidden from search engines. Set ${
        {
          target: onPage ? 'on this page' : `for every ${input.typeLabel}`,
          default: `on the ${input.defaultLanguage} version`,
          site: 'for the whole site',
          config: 'in site configuration outside SEO',
          fallback: 'outside SEO',
        }[from]
      }.`,
      jump:
        from === 'site' && input.can.site
          ? { scope: 'site', tab: 'defaults', field: 'values.robots.noindex' }
          : from === 'target'
            ? jump('search', 'robots.noindex')
            : undefined,
      fix:
        from === 'target'
          ? {
              label: 'Show in search results',
              apply: set('robots.noindex', false),
            }
          : undefined,
    });
  }
  if (noindex && effective.canonical) {
    issues.push({
      id: 'noindex-canonical',
      severity: 'improve',
      message: `${Page} is hidden and also points search engines to another address. Use one or the other.`,
      jump: jump('search', 'canonical'),
    });
  }
  const canonical = head?.link.find((row) => row.rel === 'canonical')?.href;
  const own = lookup.facts.url?.value ?? '';
  if (canonical && own && canonical !== own) {
    issues.push({
      id: 'canonical-elsewhere',
      severity: 'info',
      message: `Search engines are asked to show ${canonical} instead of ${page}.`,
      jump: jump('search', 'canonical'),
    });
  }
  if (robots.nosnippet === true || robots.max_snippet === 0) {
    const mine =
      (robots.nosnippet === true && on('robots.nosnippet')) ||
      (robots.max_snippet === 0 && on('robots.max_snippet'));
    issues.push({
      id: 'snippet-off',
      severity: 'info',
      message: 'Text previews are off',
      detail: `Results show no description and answer engines cannot quote ${page}.`,
      jump: jump('search', 'robots.nosnippet'),
      fix: mine
        ? {
            label: 'Allow text previews',
            apply: (values) =>
              set(
                'robots.max_snippet',
                -1,
              )(set('robots.nosnippet', false)(values)),
          }
        : undefined,
    });
  }
  if ((robots.max_image_preview ?? 'standard') !== 'large') {
    issues.push({
      id: 'image-preview',
      severity: 'info',
      message: 'Large image previews are off',
      detail: 'Results show a standard-size image at most.',
      jump: jump('search', 'robots.max_image_preview'),
      fix: on('robots.max_image_preview')
        ? {
            label: 'Allow large previews',
            apply: set('robots.max_image_preview', 'large'),
          }
        : undefined,
    });
  }

  // Social image. `resolved` is null when there is no page to resolve for.
  if (resolved) {
    const image = resolved.image;
    const at = jump('social', 'social.image');
    if (!image) {
      issues.push({
        id: 'image-missing',
        severity: 'improve',
        message: 'Add a social image',
        detail: `Links to ${page} will show without one.`,
        jump: at,
      });
    } else {
      const { width, height } = image;
      const cropped = height > 0 && (width / height < 1.85 || width / height > 2);
      const small = width < 1200 || height < 630;
      // The link preview's rule, so the two never disagree: an image that
      // already makes a large card works, and is only good to know, in one
      // row with its cropping.
      if (largeCardNeeds(width, height)) {
        issues.push({
          id: 'image-small',
          severity: 'improve',
          message: 'Use a larger social image',
          detail: `The social image is ${dimensions(width, height)}. Most link previews show it as a small thumbnail; an image ${largeCardNeeds(width, height)} makes a large card, and ${dimensions(1200, 630)} is best.`,
          jump: at,
        });
      } else if (small) {
        issues.push({
          id: 'image-small',
          severity: 'info',
          message: 'The social image could be sharper',
          detail: `The social image is ${dimensions(width, height)}. It works as a large card${
            cropped ? ', cropped' : ''
          }; ${dimensions(1200, 630)} ${cropped ? 'fits best' : 'looks sharper'}.`,
          jump: at,
        });
      }
      // A thumbnail is square: only a large card is cropped to 1.91:1.
      if (cropped && !small) {
        issues.push({
          id: 'image-ratio',
          severity: 'info',
          message: 'The social image will be cropped',
          detail: 'About 1.91:1 fits best.',
          jump: at,
        });
      }
      if (image.bytes > 5 * 1048576) {
        issues.push({
          id: 'image-heavy',
          severity: 'info',
          message: `The social image is ${fileSize(image.bytes)}`,
          detail: 'Some services skip images over 5 MB.',
          jump: at,
        });
      }
      if (!FORMATS.includes(image.mime)) {
        // "image/x-ms-bmp" is a BMP, "image/svg+xml" an SVG.
        const type = image.mime
          .replace(/^image\/(x-(ms-)?)?|\+.*$/g, '')
          .toUpperCase();
        issues.push({
          id: 'image-format',
          severity: 'improve',
          message: 'Use JPEG, PNG or WebP',
          detail: `${type} images do not show on many services.`,
          jump: at,
        });
      }
      if (!image.alt.trim()) {
        issues.push({
          id: 'image-alt',
          severity: 'info',
          message: 'The social image has no alt text',
          detail: 'People who cannot see it get no description.',
          jump: at,
        });
      }
    }
  }

  // The page content, read from the live preview.
  if (!facts) {
    issues.push({
      id: 'content-unavailable',
      severity: 'info',
      message:
        'Content checks need the page preview, which cannot be read here.',
    });
  } else {
    if (facts.h1.length === 0) {
      issues.push({
        id: 'h1-missing',
        severity: 'improve',
        message: 'Add a main heading',
        detail: onPage
          ? 'Set one heading in the page to Heading 1. This is done in the page, not here.'
          : "Set one heading in the template's layout to Heading 1. SEO settings cannot set it.",
      });
    }
    const missing = facts.imagesWithoutAlt;
    if (missing.length) {
      issues.push({
        id: 'img-alt',
        severity: 'improve',
        message:
          missing.length === 1
            ? '1 image on the page has no alternative text.'
            : `${missing.length} images on the page have no alternative text.`,
        detail: `${missing.slice(0, 3).join(', ')}${
          missing.length > 3 ? ` and ${missing.length - 3} more` : ''
        }`,
      });
    }
  }

  // Structured data.
  const schema = effective.schema ?? {};
  const type = registry[schema.type ?? 'WebPage'];
  const props = type?.props ?? [];
  const label = (key: string) =>
    props.find((prop) => prop.key === key)?.label ?? key;
  const prop = (key: string) => jump('schema', `schema.props.${key}`);
  if (type && resolved) {
    for (const key of resolved.schema.missing_required) {
      const path = `schema.props.${key}`;
      const stored = schema.props?.[key];
      // Linked: hidden for this item is said with its reference, empty is
      // said for this item. Nothing is missing from the template.
      if (hidden.includes(path)) {
        continue;
      }
      const empty = !onPage && !!stored && 'source' in stored && !broken.includes(path);
      issues.push({
        id: `schema-required:${key}`,
        severity: 'fix',
        message: empty ? `${label(key)} is empty for ${page}` : `Add ${label(key)}`,
        detail: empty
          ? `${type.label} details are left out for ${page}.`
          : `${type.label} details are left out until it is filled in.`,
        jump: prop(key),
      });
    }
    // At template scope a detail linked to a field the previewed item has no
    // value in, or that is listed as broken or hidden, is said at its field.
    const linked = (key: string) => {
      const stored = schema.props?.[key];
      const path = `schema.props.${key}`;
      return !onPage && !!stored && 'source' in stored && !broken.includes(path) && !hidden.includes(path)
        ? resolve(stored, PROP_KINDS[props.find((item) => item.key === key)?.kind ?? 'text'], lookup).status !== 'ok'
        : broken.includes(path) || hidden.includes(path);
    };
    const recommended = resolved.schema.missing_recommended;
    const asked = recommended.filter((key) => !linked(key));
    if (asked.length) {
      issues.push({
        id: 'schema-recommended',
        severity: 'improve',
        message: `${type.label} is missing: ${asked.map(label).join(', ')}.`,
        jump: prop(asked[0]),
      });
    }
    for (const key of recommended.filter(linked)) {
      if (!broken.includes(`schema.props.${key}`) && !hidden.includes(`schema.props.${key}`)) {
        issues.push({
          id: `schema-empty:${key}`,
          severity: 'info',
          message: `${label(key)} is empty for ${page}`,
          detail: `It is left out for ${page}, and filled in wherever another ${inSentence(input.typeLabel)} has one.`,
          jump: prop(key),
        });
      }
    }
  }
  // Dates as linked values give them for this item, else their defaults.
  const date = (key: string) => {
    const own = resolve(schema.props?.[key], 'date', lookup);
    const fallback = props.find((item) => item.key === key)?.default;
    const value = own.status === 'ok' ? own.value : fallback ? resolve(fallback, 'date', lookup).value : '';
    return value === '' ? NaN : Date.parse(value);
  };
  for (const [later, earlier] of [
    ['dateModified', 'datePublished'],
    ['endDate', 'startDate'],
  ]) {
    if (date(later) < date(earlier)) {
      issues.push({
        id: `schema-dates:${later}`,
        severity: 'improve',
        message: `"${label(later)}" is before "${label(earlier)}".`,
        jump: prop(later),
      });
    }
  }
  if (facts) {
    const text = normal(facts.text);
    for (const item of props) {
      const stored = schema.props?.[item.key];
      // Only typed text can be compared: a linked value is the page's own
      // data. A code (a currency, a SKU) is rarely printed as written.
      if (
        item.kind === 'text' &&
        !item.pattern &&
        stored !== undefined &&
        'text' in stored &&
        normal(stored.text) &&
        !text.includes(normal(stored.text))
      ) {
        issues.push({
          id: `schema-not-on-page:${item.key}`,
          severity: 'improve',
          message: `Check ${item.label}`,
          detail: 'It does not appear on the page. Structured data should match what visitors see.',
          jump: prop(item.key),
        });
      }
    }
  }

  // Who runs the site: never counted, and only for people who can fix it.
  const gaps = input.can.site ? identityGaps(input.site, site) : [];
  if (gaps.length) {
    issues.push({
      id: 'identity-incomplete',
      severity: 'info',
      message: identitySentence(gaps),
      jump: { scope: 'site', tab: 'identity', field: gaps[0].field },
    });
  }
  return issues;
}
