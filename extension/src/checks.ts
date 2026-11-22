// The Checks rules: facts about this dialog's settings and the page preview.
// No score. Rules fed by `resolved` describe the saved draft.
import type { PageFacts } from './host';
import {
  andList,
  dimensions,
  fileSize,
  inSentence,
  kindOfType,
  largeCardNeeds,
  leaveOut,
  meter,
  offered,
  typeOf,
} from './model';
import { durationText, partNoun, plainText } from './controls';
import { dateWords, itemName } from './readback';
import { emptyWords, linkedField, shapeNeed } from './custom/sheet';
import type {
  FeatureFact,
  Issue,
  Jump,
  Measurer,
  Registry,
  Resolved,
  SchemaType,
  SearchFeatures,
  SeoValues,
  SiteSettings,
  StatePayload,
  Source,
  Tab,
  Texts,
  Value,
  Verdict,
} from './types';
import { type Lookup, PROP_KINDS, brokenWhy, kindOf, resolve, rowOf, tagOf } from './values';

/**
 * What a group misses, said one way under its box, in its sheet and in
 * Checks: the parts the server left it and its nested groups out for (its
 * `incomplete` entries; without a report, `local`), then the parts a search
 * feature asks of it, in the type's order. `fors`: what the features need
 * them for ("event listings"), when they ask for more than the group needs
 * to be used.
 */
export function groupGap(
  type: SchemaType,
  key: string,
  report: Resolved['schema'] | null | undefined,
  rules: SearchFeatures,
  local: string[] = [],
): { missing: string[]; fors: string[] } {
  const props = type.props ?? [];
  // A nested group's own group.
  const ownerOf = (one: string) => {
    const { parent: owner } = type.groups?.[one] ?? {};
    return owner;
  };
  // A part of the group, at any depth, or one of its nested groups; never
  // its page reference.
  const within = (one: string) => {
    const prop = props.find((item) => item.key === one);
    return one !== key && (prop ? prop.group === key || prop.part === key : ownerOf(one) === key || one.startsWith(`${key}_`));
  };
  const left = report ? (report.incomplete ?? []).filter((one) => one.group === key || ownerOf(one.group) === key).flatMap((one) => one.missing) : local;
  const asked = (report?.type ? report.features ?? [] : [])
    .filter((verdict) => verdict.verdict === 'needs')
    .flatMap((verdict) => (verdict.missing ?? []).filter((fact) => fact.prop && within(fact.prop)).map((fact) => ({ key: fact.prop!, verdict })));
  const order = props.map((prop) => prop.key);
  const at = (one: string) => (order.includes(one) ? order.indexOf(one) : order.findIndex((other) => other.startsWith(`${one}_`)));
  const missing = [...new Set([...left, ...asked.map((one) => one.key)])].sort((a, b) => at(a) - at(b));
  const more = asked.filter((one) => !left.includes(one.key));
  const fors = more.length
    ? [...new Set(more.map((one) => rules.features[one.verdict.feature ?? '']?.for ?? '').filter(Boolean))]
    : [];
  return { missing, fors };
}

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
  /** The search features rules (data/search-features.json). */
  rules: SearchFeatures;
  /** The public base followed by "/": the site's own node ids start with it. */
  home: string;
  /** The previewed entity's own address: its node ids start with it. */
  url: string;
  /** The dialog's language, for the prices and dates it names. */
  ui: string;
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
  /** A page translation: how many hand-added items its source version has. */
  source?: { language: string; count: number } | null;
  /** Hand-added JSON-LD stored before a rule: why an item of it is left out. */
  refused?: string | null;
  /** Hand-added JSON-LD left with a problem in the sheet, not sent. */
  unsaved?: boolean;
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

  // At template scope a text that gives nothing comes from a field, or a
  // default, the previewed item has empty: a fact about the item, good to
  // know, not a problem of the template. (The title and the social texts
  // always fall back to one that is there.)
  const emptyHere = (path: 'description', detail: string): boolean => {
    if (onPage) {
      return false;
    }
    const value = effective[path];
    issues.push({
      id: `value-empty:${path}`,
      severity: 'info',
      message: `${value && 'source' in value ? tagOf(value, lookup, path) : 'The description'} is empty for ${page}`,
      detail,
      jump: jump('search', path),
    });
    return true;
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
  const required = new Set(resolved?.schema.withheld?.missing.map((key) => `schema.props.${key}`) ?? []);
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
  if (texts.description === '' && emptyHere('description', `Search engines pick text from the page for ${page}; each ${inSentence(input.typeLabel)} that has one shows its own.`)) {
    // Said for the item.
  } else if (texts.description === '') {
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

  issues.push(...structured(input, { page, onPage, jump, hidden, broken }));

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

// Structured data: the verdicts' own words (search-features), what is left
// out and why, the rules of hand-added items, and what is not on the page.

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** "an image", or the label in lower case when the rules have no words for it. */
/**
 * What a missing fact is asked for as: "a country". A detail whose label
 * on this type differs from the fact's (a job's Description, not a
 * Summary) is asked for by its own label: "a description".
 */
export const needOf = (rules: SearchFeatures, path: string, label: string, own?: string) => {
  // A group is asked for by its name: the employer, the venue.
  const fact = rules.facts[path] ?? rules.facts[`${path}.name`] ?? rules.facts[path.split('.').pop()!];
  const a = (words: string) => (/s$/i.test(words) ? words.toLowerCase() : `${/^[aeiou]/i.test(words) ? 'an' : 'a'} ${words.toLowerCase()}`);
  if (own && fact && fact.label.toLowerCase() !== own.toLowerCase()) {
    return a(own);
  }
  return fact?.need ?? a(label);
};

/**
 * The sentence's last words while a kind chosen is withheld, asking for what
 * Checks asks for: "Not a job posting yet: it needs a description and an
 * employer."
 */
export function notYetText(registry: Registry, rules: SearchFeatures, typeId: string, keys: string[]): string {
  if (!keys.length) {
    return '';
  }
  const type = typeOf(registry, typeId);
  const own = (key: string) => type.props?.find((one) => one.key === key)?.label;
  const label = (key: string) => type.groups?.[key]?.label ?? own(key) ?? key;
  const name = registry[kindOfType(registry, typeId)]?.kind?.name ?? 'that';
  return `Not ${name} yet: it needs ${andList(keys.map((key) => needOf(rules, pathOf(rules, key), label(key), own(key))))}.`;
}

/** The words of a verdict the dialog shows in gray: it asks nothing of the editor here. */
export const QUIET = ['not_fit', 'not_here', 'retired', 'none', 'closed', 'elsewhere'];

/** The path a registry detail has in a node: "offers_price" is offers.price. */
const pathOf = (rules: SearchFeatures, key: string) =>
  rules.facts[key.replace(/_/g, '.')]
    ? key.replace(/_/g, '.')
    : (Object.entries(rules.props).find(([path, prop]) => prop === key && rules.facts[path])?.[0] ?? key.replace(/_/g, '.'));

/** What a value that does not fit must be, as the sentence that asks for it. */
const FITS: Record<string, string> = {
  currency: 'Use a currency code from the list, such as EUR',
  number: 'Use a number such as 49.90',
  date: 'Use a date',
  url: 'Use a full address that starts with https://',
  enum: 'Use one of the listed options',
};

/** Symbols that stand for a currency next to a price. */
const SYMBOLS: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', '¥': 'JPY' };

/** A number as written on a page: "2,500", "2.500,00", "49.90" or "49,9". */
function amountOf(text: string): number {
  const digits = text.replace(/\s/g, '');
  const last = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'));
  // A separator followed by one or two digits is the decimal one.
  const decimal = last >= 0 && digits.length - last - 1 <= 2;
  const whole = decimal ? digits.slice(0, last) : digits;
  return Number(`${whole.replace(/[.,]/g, '')}${decimal ? `.${digits.slice(last + 1)}` : ''}`);
}

/** Every price the page shows: a number next to a currency, and its period. */
export function pagePrices(text: string): { amount: number; currency: string; period: 'month' | 'year' | null; shown: string }[] {
  const number = '\\d(?:[\\d.,\\s]*\\d)?';
  const money = '[€$£¥]|\\b[A-Z]{3}\\b';
  const found = [];
  for (const m of text.matchAll(new RegExp(`(${money})\\s?(${number})|(${number})\\s?(${money})`, 'gu'))) {
    const sign = m[1] ?? m[4];
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 16);
    const period = after.match(/^\s*(?:\/|per\b|a\b|each\b)\s*(month|mo\b|year|yr\b|annum)/i)?.[1].toLowerCase();
    found.push({
      amount: amountOf(m[2] ?? m[3]),
      currency: SYMBOLS[sign] ?? sign,
      period: period === undefined ? null : period.startsWith('m') ? ('month' as const) : ('year' as const),
      shown: m[0] + (period === undefined ? '' : ` a ${period.startsWith('m') ? 'month' : 'year'}`),
    });
  }
  return found;
}

/** A date as a page in its language may print it: four ways. */
export function dateForms(value: string, langcode: string): string[] {
  const m = value.match(/^(\d{4})-(\d\d)-(\d\d)/);
  if (!m) {
    return [];
  }
  const date = new Date(+m[1], +m[2] - 1, +m[3]);
  const forms = (['long', 'medium', 'short'] as const).map((style) => {
    try {
      return new Intl.DateTimeFormat(langcode, { dateStyle: style }).format(date);
    } catch {
      return '';
    }
  });
  return [...forms, `${m[1]}-${m[2]}-${m[3]}`].filter(Boolean);
}

/**
 * A file's own name: the part after the last slash, lower case. An image
 * style that converts the file adds its own extension: it is left out.
 */
export const fileName = (url: string) => {
  const path = url.split(/[?#]/)[0];
  let name = path.slice(path.lastIndexOf('/') + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    // Kept as written.
  }
  return name.toLowerCase().replace(/^(.+\.\w{3,4})\.(?:webp|avif|png|jpe?g)$/, '$1');
};

/** The library's images, the page's own first, then those picked in this session. */
export function rankImages<T extends { uuid: string; thumb: string }>(items: T[], pageImages: string[], picked: string[]): T[] {
  const onPage = new Set(pageImages.map(fileName));
  const rank = (item: T) => (onPage.has(fileName(item.thumb)) ? 2 : 0) + (picked.includes(item.uuid) ? 1 : 0);
  return [...items].sort((a, b) => rank(b) - rank(a));
}

/** The texts of a hand-added item that visitors should see, with what they are. */
function handTexts(node: unknown, out: { text: string; question: boolean }[] = [], depth = 0) {
  if (Array.isArray(node)) {
    node.forEach((item) => handTexts(item, out, depth));
  } else if (isNode(node)) {
    const type = typeof node['@type'] === 'string' ? node['@type'] : '';
    // A page's own name is its title, not text on it.
    const page = depth === 0 && /Page$/.test(type);
    for (const key of page ? ['text'] : ['name', 'text', 'headline', 'description', 'reviewBody']) {
      const value = node[key];
      // A question's answer is often formatted: its words are what count.
      if (typeof value === 'string' && value.trim().length >= 3 && !/^https?:\/\//.test(value)) {
        out.push({ text: value.replace(/<[^>]*>/g, ' ').trim(), question: type === 'Question' && key === 'name' });
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (!key.startsWith('@') && typeof value === 'object') {
        handTexts(value, out, depth + 1);
      }
    }
  }
  return out;
}

/** The rating values and counts of a hand-added item. */
function ratings(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((item) => ratings(item, out));
  } else if (isNode(node)) {
    if (([] as unknown[]).concat(node['@type']).some((type) => typeof type === 'string' && /Rating$/.test(type))) {
      for (const key of ['ratingValue', 'reviewCount', 'ratingCount']) {
        if (typeof node[key] === 'string' || typeof node[key] === 'number') {
          out.push(String(node[key]));
        }
      }
    }
    Object.entries(node).forEach(([key, value]) => !key.startsWith('@') && ratings(value, out));
  }
  return out;
}

function structured(
  input: ChecksInput,
  at: { page: string; onPage: boolean; jump(tab: Tab, field: string): Jump; hidden: string[]; broken: string[] },
): Issue[] {
  const { effective, lookup, resolved, facts, registry, rules } = input;
  const { page, onPage, hidden, broken } = at;
  const issues: Issue[] = [];
  const schema = effective.schema ?? {};
  const type = typeOf(registry, schema.type);
  const typeId = schema.type && registry[schema.type] ? schema.type : 'WebPage';
  const props = type.props ?? [];
  // A group is named by its label ("Venue"), a detail by its own.
  const label = (key: string) => type.groups?.[key]?.label ?? props.find((prop) => prop.key === key)?.label ?? type.groups?.[key]?.shape ?? key;
  const prop = (key: string) => at.jump('schema', `schema.props.${key}`);
  const custom = at.jump('schema', 'schema.custom');
  const kind = registry[kindOfType(registry, typeId)].kind;
  // "The event", for a sentence.
  const The = `The ${(kind?.name ?? 'web page').replace(/^(a|an) /, '')}`;
  // The report describes the saved draft: it speaks for the type it was built as.
  const report = resolved?.schema.type === typeId ? resolved.schema : null;
  const graph = resolved?.head.script.find((script) => script.type === 'application/ld+json')?.textContent as { '@graph'?: Node[] } | undefined;
  const nodes = graph?.['@graph'] ?? [];
  const main = nodes.find((node) => node['@id'] === `${input.url}#primary`);
  const linkedEmpty = (key: string) => {
    const stored = schema.props?.[key];
    const path = `schema.props.${key}`;
    return !onPage && !!stored && 'source' in stored && !broken.includes(path) && !hidden.includes(path) &&
      resolve(stored, PROP_KINDS[props.find((item) => item.key === key)?.kind ?? 'text'], lookup).status !== 'ok';
  };
  const said = new Set<string>();

  if (report?.unknown_type) {
    issues.push({
      id: 'schema-unknown',
      severity: 'improve',
      message: 'Choose what this page is',
      detail: `It was described as “${report.unknown_type}”, which this site no longer knows. Search engines get a plain web page.`,
      jump: at.jump('schema', 'schema.type'),
    });
  }

  // Groups left out: what they miss, with what a feature asks of them, in
  // one row. A part asked for here is not asked for again by a verdict; a
  // part whose value does not fit is said where it is dropped.
  const droppedKeys = new Set((report?.dropped ?? []).map((one) => one.key));
  for (const { group, missing: left } of report?.incomplete ?? []) {
    const whole = type.groups?.[group];
    // An address in another group is that group's: "the venue's address".
    const { parent: owner } = whole ?? {};
    const gap = groupGap(type, group, { ...report!, incomplete: [{ group, missing: left }] }, rules);
    gap.missing.forEach((key) => said.add(key));
    const missing = gap.missing.filter((key) => !droppedKeys.has(key));
    if (!missing.length) {
      continue;
    }
    const to = missing.every((key) => !partNoun(props.find((one) => one.key === key), '').startsWith('the ')) ? '' : ` to the ${owner ? `${label(owner).toLowerCase()}'s address` : label(group).toLowerCase()}`;
    issues.push({
      id: `schema-incomplete:${group}`,
      severity: 'improve',
      message: `Add ${andList(missing.map((key) => partNoun(props.find((one) => one.key === key), label(key))))}${to}`,
      detail: gap.fors.length
        ? `Needed for ${andList(gap.fors)}.`
        : whole?.shape === 'address'
          ? 'An address needs a street or city, and a country.'
          : `${label(group)} is left out until then.`,
      jump: prop(missing[0]),
    });
  }
  // List items left out.
  for (const { key, count, reason } of report?.dropped_items ?? []) {
    const items = `${count} ${count === 1 ? 'item' : 'items'}`;
    issues.push({
      id: `schema-items:${key}:${reason}`,
      severity: reason === 'max' ? 'info' : 'improve',
      message:
        reason === 'max'
          ? `${label(key)}: ${items} over the limit left out`
          : reason === 'private'
            ? `${label(key)}: ${items} in private files left out`
            : reason === 'hidden'
              ? `${label(key)}: ${items} visitors may not see left out`
              : `${label(key)}: ${items} that ${count === 1 ? 'does' : 'do'} not fit left out`,
      detail: reason === 'hidden' ? 'A page visitors may not see is never named.' : 'The rest are used, in order.',
      jump: prop(key),
    });
  }
  // References that name a page instead of pointing at it.
  for (const { key, name } of report?.refs_inline ?? []) {
    issues.push({
      id: `schema-ref-name:${key}:${name}`,
      severity: 'info',
      message: `${label(key)}: “${name}” is named, not linked`,
      detail: `Its page is not described as one the ${label(key).toLowerCase()} can be. Describe it in its own SEO settings to link it.`,
      jump: prop(key),
    });
  }
  // The publisher by a Canvas page's default.
  for (const key of report?.defaults ?? []) {
    issues.push({
      id: `schema-default-site:${key}`,
      severity: 'info',
      message: `The ${label(key).toLowerCase()} is ${input.site.identity.name ? `${input.site.identity.name} (this site)` : 'this site'}`,
      detail: 'Nobody set it, so it is the site. Change it if someone else is.',
      jump: prop(key),
    });
  }
  // A time without its pair.
  for (const key of report?.unpaired ?? []) {
    const other = props.find((one) => one.key === key)?.pair;
    issues.push({
      id: `schema-unpaired:${key}`,
      severity: 'improve',
      message: `Add the ${label(other ?? key).toLowerCase()}, or give a total time instead`,
      detail: `${label(key)} is used only with the ${label(other ?? key).toLowerCase()}.`,
      jump: prop(other ?? key),
    });
  }
  // A linked time read as more than a day: its field may count in the
  // other unit.
  for (const one of props.filter((item) => item.unit && (item.units?.length ?? 0) > 1)) {
    const stored = schema.props?.[one.key];
    if (!stored || !('source' in stored)) {
      continue;
    }
    const found = resolve(stored, 'number', lookup);
    const unit = stored.unit ?? one.unit!;
    const minutes = Number(found.text) * (unit === 'hour' ? 60 : 1);
    const other = one.units!.find((item) => item !== unit);
    if (found.status === 'ok' && minutes > 24 * 60 && other) {
      issues.push({
        id: `schema-unit:${one.key}`,
        severity: 'improve',
        message: `Is ${one.label} in hours or minutes?`,
        detail: `It reads as ${durationText(String(Math.round(minutes)))}, more than a day.`,
        jump: prop(one.key),
        fix: {
          label: 'Change the unit',
          apply: (values) => ({
            ...values,
            schema: { ...values.schema, props: { ...values.schema?.props, [one.key]: { ...stored, unit: other } } },
          }),
          undo: () => `${one.label} in ${other}s`,
        },
      });
    }
  }
  if (report?.pay_order) {
    issues.push({
      id: 'schema-pay-order',
      severity: 'fix',
      message: 'Pay: From is more than Up to',
      detail: 'The pay is left out until From is no more than Up to.',
      jump: prop('baseSalary'),
    });
  }
  // A byline that may name several people.
  const author = schema.props?.author_name ?? schema.props?.author;
  const byline = author ? resolve(author, 'text', lookup) : null;
  if (byline?.status === 'ok' && author && 'source' in author && /\s(and|&)\s|,/.test(byline.text)) {
    issues.push({
      id: 'schema-byline',
      severity: 'info',
      message: 'The author may be several people',
      detail: 'If this names several people, link a field with one person per value.',
      jump: prop('author'),
    });
  }

  // Values that do not fit their kind: the field says why.
  for (const dropped of report?.dropped ?? []) {
    const item = props.find((one) => one.key === dropped.key);
    const stored = schema.props?.[dropped.key];
    const field = stored && 'source' in stored ? rowOf(lookup, stored)?.label : undefined;
    const withholds = !!report?.withheld?.dropped.includes(dropped.key);
    said.add(dropped.key);
    issues.push({
      id: `schema-dropped:${dropped.key}`,
      severity: withholds ? 'fix' : 'improve',
      message: `${item?.codes === 'country' ? 'Choose the country from the list' : (FITS[dropped.kind] ?? 'Use another value')}: ${field ? `the ${field} field` : label(dropped.key)} gives “${dropped.value}”.`,
      detail: withholds ? `${The} is left out until it is fixed.` : `${item?.label ?? dropped.key} is left out until then.`,
      jump: prop(dropped.key),
    });
  }

  // What withholds the main node.
  for (const key of report?.withheld?.missing ?? []) {
    const path = `schema.props.${key}`;
    said.add(key);
    // Linked: hidden for this item is said with its reference, empty is
    // said for this item. Nothing is missing from the template.
    if (hidden.includes(path)) {
      continue;
    }
    const stored = schema.props?.[key];
    const empty = !onPage && !!stored && 'source' in stored && !broken.includes(path);
    issues.push({
      id: `schema-required:${key}`,
      severity: 'fix',
      message: empty ? `${label(key)} is empty for ${page}` : `Add ${needOf(rules, pathOf(rules, key), label(key), props.find((one) => one.key === key)?.label)}`,
      detail: empty ? `${The} is left out for ${page}.` : `${The} is left out until it is filled in.`,
      jump: prop(key),
    });
  }

  // Asked for by a row above: itself, or the group it is part of.
  const groupOf = (key: string) => props.find((one) => one.key === key)?.group;
  const asked = (key: string) => said.has(key) || said.has(groupOf(key) ?? '') || (report?.incomplete ?? []).some((one) => one.group === groupOf(key));
  // A part of a group that is set, by its own name: "the venue's name".
  const helpName = (key: string) => {
    const part = props.find((one) => one.key === key);
    const set = !!part?.group && part.key !== part.group && Object.keys(schema.props ?? {}).some((one) => one === part.group || one.startsWith(`${part.group}_`));
    return set && part?.short ? `the ${label(part.group!).toLowerCase()}'s ${part.short.toLowerCase()}` : label(key);
  };

  // The verdicts.
  const verdicts = report?.features ?? [];
  const needs = new Map<string, { fact: FeatureFact; fors: string[]; feature: string | null }>();
  for (const verdict of verdicts) {
    const feature = verdict.feature === null ? undefined : rules.features[verdict.feature];
    const name = feature?.label ?? '';
    // What also helps, said once per feature, never counted.
    // In the form's order: the facts shown first, then the rest.
    const order = [...(type.main ?? []), ...props.map((one) => one.key)];
    const at = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
    const helps = (verdict.helps ?? [])
      // Only what this scope can fill, and never what a row above asks for
      // (an incomplete group's part).
      .filter((fact) => fact.prop && !linkedEmpty(fact.prop) && !asked(fact.prop) && offered(registry, typeId, fact.prop, input.scope) !== false)
      .sort((a, b) => at(a.prop!) - at(b.prop!));
    if (helps.length) {
      const named = helps.map((fact) => helpName(fact.prop!));
      issues.push({
        id: `feature-helps:${verdict.feature}`,
        severity: 'info',
        message: `Also helps the ${name.toLowerCase()}: ${named.join(', ')}.`,
        detail: `Adding ${named.length === 1 ? 'it' : 'them'} gives the ${name.toLowerCase()} more to show.`,
        jump: prop(helps[0].prop!),
      });
    }
    if (feature?.list && verdict.verdict === 'needs') {
      // A list page: what counts is how many of its pages are complete.
      const noun = registry[feature.list.of]?.label.toLowerCase() ?? 'item';
      issues.push({
        id: `feature-list:${verdict.feature}`,
        severity: 'improve',
        message: `${name}: ${verdict.count ?? 0} of the ${verdict.of ?? 0} linked pages ${verdict.count === 1 ? 'is a complete' : 'are complete'} ${verdict.count === 1 ? noun : `${noun}s`}`,
        detail: `It needs at least ${feature.list.min}: pages described as ${registry[feature.list.of]?.kind?.name ?? noun}, each with a summary.`,
        jump: prop(type.props?.find((one) => one.item === 'ListItem')?.key ?? 'items'),
      });
    } else if (verdict.verdict === 'needs') {
      for (const fact of verdict.missing ?? []) {
        const key = fact.prop ?? fact.site ?? `${verdict.node}:${fact.path}`;
        const entry = needs.get(key) ?? { fact, fors: [], feature: verdict.feature };
        entry.fors.push(feature?.for ?? name.toLowerCase());
        needs.set(key, entry);
      }
    } else if (verdict.verdict === 'not_fit') {
      const not = feature?.not_for?.find((one) => one.id === verdict.reason);
      issues.push({ id: `feature-not-fit:${verdict.feature}`, severity: 'info', message: `${name} doesn't fit: ${not?.reason ?? verdict.reason}`, detail: not?.why });
    } else if (verdict.verdict === 'closed') {
      // Still shipped; said once, where the date is changed.
      const not = feature?.not_for?.find((one) => one.id === 'closed');
      issues.push({
        id: `feature-closed:${verdict.feature}`,
        severity: 'info',
        message: `${name}: not shown, ${not?.reason ?? 'closed'} ${dateWords(verdict.date ?? '', input.ui) ?? verdict.date}`,
        detail: not?.why,
        jump: prop('validThrough'),
      });
    } else if (verdict.verdict === 'unanswered') {
      issues.push({
        id: `feature-unanswered:${verdict.feature}`,
        severity: 'info',
        message: `${name}: only if people buy it here`,
        detail: `Answer “${label('sold_here')}”.`,
        jump: prop('sold_here'),
      });
    } else if (verdict.verdict === 'retired') {
      issues.push({
        id: `feature-retired:${verdict.feature}:${verdict.node}`,
        severity: 'info',
        message: `${name}: ${retiredText(feature?.since, input.ui)}`,
        detail: 'Search engines no longer show it, whatever the page says.',
        jump: custom,
      });
    } else if (verdict.verdict === 'none' && type.primary_type) {
      issues.push({ id: 'feature-none', severity: 'info', message: `No search feature for ${kind?.name ?? 'this page'}`, detail: 'It still tells search engines what the page is about.' });
    }
  }
  for (const [key, { fact, fors, feature }] of needs) {
    // A part of a group withheld or incomplete is asked for by that row.
    if (fact.prop && (asked(fact.prop) || linkedEmpty(fact.prop) || hidden.includes(`schema.props.${fact.prop}`) || broken.includes(`schema.props.${fact.prop}`))) {
      continue;
    }
    // A site setting is for those who may change it.
    if (fact.site && !input.can.site) {
      continue;
    }
    // The rule's index is within its own feature's rules.
    const rule = fact.rule === undefined || feature === null ? undefined : rules.features[feature]?.rules?.[fact.rule];
    const need = rule?.need ?? needOf(rules, fact.path, fact.prop ? label(fact.prop) : fact.path, props.find((one) => one.key === fact.prop)?.label);
    const image = fact.prop && props.find((one) => one.key === fact.prop)?.kind === 'image';
    issues.push({
      id: `feature-needs:${key}`,
      severity: 'improve',
      message: `Add ${need} for ${[...new Set(fors)].join(' and ')}`,
      detail: fact.prop || fact.site ? undefined : 'It is missing from an item you added by hand.',
      jump: fact.prop ? prop(fact.prop) : fact.site ? { scope: 'site', tab: 'identity', field: fact.site } : custom,
      fix: image ? { label: 'Choose an image', image: `schema.props.${fact.prop}` } : undefined,
    });
  }

  // A detail linked to a field the previewed item has empty: said for the
  // item, good to know, once.
  for (const verdict of verdicts) {
    for (const fact of [...(verdict.missing ?? []), ...(verdict.helps ?? [])]) {
      if (fact.prop && linkedEmpty(fact.prop) && !said.has(fact.prop) && !hidden.includes(`schema.props.${fact.prop}`)) {
        said.add(fact.prop);
        issues.push({
          id: `schema-empty:${fact.prop}`,
          severity: 'info',
          message: `${label(fact.prop)} is empty for ${page}`,
          detail: `It is left out for ${page}, and filled in wherever another ${inSentence(input.typeLabel)} has one.`,
          jump: prop(fact.prop),
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
        message: `Move “${label(later)}” after “${label(earlier)}”`,
        detail: `“${label(later)}” is before “${label(earlier)}”.`,
        jump: prop(later),
      });
    }
  }

  // A product or a service named after the page.
  const title = lookup.facts.title?.value ?? '';
  if (input.scope === 'page' && ['Product', 'Service'].includes(typeId) && typeof main?.name === 'string' && title && normal(main.name) === normal(title)) {
    issues.push({
      id: 'schema-name-title',
      severity: 'improve',
      message: typeId === 'Product' ? 'Give the product its own name' : 'Give the service its own name',
      detail: 'The name is the page title.',
      jump: prop('name'),
    });
  }

  // The hand-added items.
  const home = input.home;
  // A review by its author, else the item by its name: two rows are told apart.
  const itemOf = (item: number) => {
    const entry = report?.nodes.find((one) => one.origin === 'hand' && one.item === item);
    const node = entry?.at === undefined ? undefined : nodes[entry.at];
    if (!isNode(node)) {
      return 'This item';
    }
    const author = isNode(node.author) && typeof node.author.name === 'string' ? node.author.name : '';
    const name = author ? `The review by ${author}` : itemName(node, input.rules);
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  for (const hit of report?.rules ?? []) {
    const shown = hit.value?.startsWith(`${input.url}#`) ? hit.value.slice(input.url.length) : hit.value;
    // Item -1: a module node with added details, told apart by its id and
    // opened in its Add details sheet.
    const short = hit.item < 0 && hit.node ? `#${hit.node.split('#').pop()}` : null;
    const at = short ? `${hit.item}:${short}` : String(hit.item);
    const whose = short ? (short === '#identity' ? "Your site's organization" : short === '#webpage' ? 'This page' : `This page's ${inSentence(input.typeLabel) || 'main thing'}`) : itemOf(hit.item);
    const jump = short ? extendJump(short) : custom;
    issues.push(
      hit.rule === 'own_reviews'
        ? { id: `hand-reviews:${at}`, severity: 'fix', message: 'No review stars for reviews of your own organization.', detail: `${whose}: search engines do not show review stars for reviews an organization publishes of itself. Ratings of other companies are fine.`, jump }
        : hit.rule === 'second_identity'
          ? { id: `hand-identity:${at}`, severity: 'improve', message: "Point to your site's organization instead", detail: `This is your site's organization. Point to it with “@id”: “${home}#identity” instead.`, jump }
          : hit.rule === 'dangling'
            ? { id: `hand-dangling:${at}:${shown}`, severity: 'improve', message: `Points to ${shown}, which isn't on this page`, detail: 'Add the item it points to, or point to one that is here.', jump }
            : { id: `hand-relative:${at}:${shown}`, severity: 'improve', message: `Use a full address for “${shown}”`, detail: 'Addresses in structured data start with https://.', jump },
    );
  }

  issues.push(...handReport(input, report, label, custom));

  // What is not on the page. Never codes or identifiers; never defaults.
  if (!facts) {
    return issues;
  }
  const text = normal(facts.text);
  const onThePage = (value: string) => text.includes(normal(value));
  for (const item of props) {
    const stored = schema.props?.[item.key];
    // A stored value: typed, linked or a fact named here; never a default.
    if (!stored) {
      continue;
    }
    const shown = resolve(stored, PROP_KINDS[item.kind], lookup);
    if (shown.status !== 'ok') {
      continue;
    }
    const linked = 'source' in stored ? rowOf(lookup, stored)?.label : 'fact' in stored ? lookup.facts[stored.fact]?.label : undefined;
    const notFound = (what: string) => ({
      id: `schema-not-on-page:${item.key}`,
      severity: 'improve' as const,
      message: `Couldn't find ${what} on this page`,
      detail: `${linked ? `It comes from ${linked}. ` : ''}Structured data should describe what visitors see.`,
      jump: prop(item.key),
    });
    // Formatted text is compared, and quoted, as its words; a long value is
    // quoted by its start.
    const words = item.html ? plainText(shown.value) : shown.value;
    if (item.kind === 'text' && !item.pattern && normal(words) && !onThePage(words)) {
      issues.push(notFound(`“${words.length > 60 ? `${words.slice(0, 60).trimEnd()}…` : words}”`));
    } else if (item.kind === 'date' && !dateForms(shown.value, input.langcode).some(onThePage)) {
      // Said as the dialog writes every date.
      issues.push(notFound(`the date ${dateWords(shown.value, input.ui) ?? shown.value}`));
    } else if (item.kind === 'image' && shown.image && facts.images && !facts.images.map(fileName).includes(fileName(shown.image.url ?? shown.image.thumb))) {
      issues.push(notFound(`the image “${shown.image.name}”`));
    } else if (item.key === 'offers_price' && Number.isFinite(Number(shown.value))) {
      // Only a number is compared: a draft that is not one ("Euro89") is the field's to say.
      const amount = Number(shown.value);
      const offers = isNode(main?.offers) ? main.offers : {};
      const currency = typeof offers.priceCurrency === 'string' ? offers.priceCurrency : '';
      const billing = isNode(offers.priceSpecification) ? offers.priceSpecification.billingDuration : undefined;
      const period = billing === 'P1M' ? 'month' : billing === 'P1Y' ? 'year' : null;
      const all = pagePrices(facts.text).filter((one) => one.amount === amount);
      const prices = all.filter((one) => !currency || one.currency === currency);
      if (!prices.some((one) => one.period === period)) {
        const price = currency ? new Intl.NumberFormat(input.ui, { style: 'currency', currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount) : String(amount);
        const as = period === null ? 'a one-time price' : `a price a ${period}`;
        // Shown with a period the price does not have: Billed says it.
        const billed = prices.length > 0 && prices[0].period !== null && props.some((one) => one.key === 'billing');
        // The same amount in another currency: Currency says it.
        const other = prices.length === 0 ? all[0] : undefined;
        issues.push({
          ...notFound(price),
          message: prices.length
            ? `Couldn't find ${price} as ${as} on this page: it says ${prices[0].shown}.`
            : other
              ? `Couldn't find ${price} on this page: it says ${other.shown}.`
              : `Couldn't find ${price} on this page`,
          ...(billed && { detail: `If it is paid every month or year, say so in ${label('billing')}.`, jump: prop('billing') }),
          ...(other && { detail: `If the price is in another currency, choose it in ${label('offers_priceCurrency')}.`, jump: prop('offers_priceCurrency') }),
        });
      }
    }
  }
  /** Where a value is in an item, dotted: the row a jump opens on. */
  const valuePath = (value: unknown, wanted: string, at: string[] = []): string | null => {
    if (Array.isArray(value)) {
      for (const one of value) {
        const found = valuePath(one, wanted, at);
        if (found !== null) return found;
      }
    } else if (isNode(value)) {
      for (const [key, one] of Object.entries(value)) {
        const found = key.startsWith('@') ? null : valuePath(one, wanted, [...at, key]);
        if (found !== null) return found;
      }
    } else if ((typeof value === 'string' || typeof value === 'number') && String(value).trim() === wanted.trim()) {
      return at.join('.');
    }
    return null;
  };
  const rowJump = (item: number | undefined, node: unknown, value: string): Jump => {
    const path = item === undefined ? null : valuePath(node, value);
    return path === null ? custom : { ...custom, at: { item: item!, path } };
  };
  for (const entry of report?.nodes ?? []) {
    const node = entry.origin === 'hand' && entry.at !== undefined ? nodes[entry.at] : undefined;
    if (!node) {
      continue;
    }
    // A field or media name kept as text (inside other text) is never on the page as written.
    const lost = handTexts(node).filter((one) => normal(one.text) && !/\{(field|media)\.[^}]+\}/.test(one.text) && !onThePage(one.text));
    if (lost.length) {
      const first = lost[0];
      issues.push({
        id: `hand-hidden:${entry.item}`,
        severity: 'fix',
        message: `Couldn't find ${first.question ? 'the question ' : ''}“${first.text.length > 80 ? `${first.text.slice(0, 80)}…` : first.text}” on this page`,
        detail: `Search engines ask that structured data only describes what visitors can see, and pages that break this can lose their search features.${lost.length > 1 ? ` ${lost.length === 2 ? "One more isn't" : `${lost.length - 1} more aren't`} on the page either.` : ''}`,
        jump: rowJump(entry.item, node, first.text),
        // Only while the JSON-LD still holds the item the report named.
        ...(leaveOut(effective, entry, input.url) && {
          fix: {
            label: "Leave it out until it's on the page",
            apply: (values) => leaveOut(values, entry, input.url)?.values ?? values,
            undo: (values) => leftOutText(leaveOut(values, entry, input.url)),
          },
        }),
        recheck: 'Check again',
      });
    }
    for (const value of ratings(node)) {
      if (!new RegExp(`(^|[^\\d.,])${escape(value.trim()).replace(/\\\./g, '[.,]')}($|[^\\d])`).test(facts.text)) {
        issues.push({
          id: `hand-rating:${entry.item}:${value}`,
          severity: 'improve',
          message: `Couldn't find the rating ${value} on this page`,
          detail: 'Show the rating on the page, or leave it out.',
          jump: rowJump(entry.item, node, value),
        });
        break;
      }
    }
  }
  return issues;
}

/** "Not shown since 7 May 2026", or without a dated changelog entry, "No longer shown". */
export const retiredText = (since: string | undefined, ui: string) =>
  since ? `Not shown since ${dateWords(since, ui)}` : 'No longer shown';

/**
 * What became of hand-added JSON-LD and added details: clashes, names inside
 * text, links that gave nothing, structured data left out, a main thing not
 * used, a translation without the source's items, text not saved.
 */
/** A jump to a module node's added details: the sheet opens on the row. */
const extendJump = (node: string, path?: string): Jump => ({
  ...(node === '#identity' ? { scope: 'site' as const, field: 'schema.extend.#identity' } : { scope: 'target' as const, field: `schema.extend.${node}` }),
  tab: 'schema',
  ...(path !== undefined && { at: { item: 0, path } }),
});

function handReport(input: ChecksInput, report: Resolved['schema'] | null, label: (key: string) => string, custom: Jump): Issue[] {
  const issues: Issue[] = [];
  const schema = input.effective.schema ?? {};
  const itemJump = (item: number | undefined, path: string): Jump => (item === undefined ? custom : { ...custom, at: { item, path } });
  for (const clash of report?.clashes ?? []) {
    const from = clash.prop ? `the ${label(clash.prop)} field` : clash.node === '#identity' ? 'the site settings' : 'the page';
    issues.push({ id: `extend-clash:${clash.node}:${clash.path}`, severity: 'improve', message: `“${clash.path}” comes from ${from}, so the added value isn't used`, detail: 'Remove it from the added details, or change it where it comes from.', jump: extendJump(clash.node, clash.path) });
  }
  // A field or media name inside other text is kept as text.
  const texts: [string, string | undefined, Jump][] = [['custom', schema.custom, custom], ...Object.entries(schema.extend ?? {}).map(([node, text]) => [node, text, extendJump(node)] as [string, string | undefined, Jump])];
  for (const [where, text, jump] of texts) {
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      continue;
    }
    const walk = (value: unknown, at: string[]) => {
      if (Array.isArray(value)) value.forEach((one, index) => walk(one, Array.isArray(data) && at.length === 0 ? [] : [...at, String(index)]));
      else if (isNode(value)) Object.entries(value).forEach(([key, one]) => walk(one, [...at, key]));
      else if (typeof value === 'string' && /\{(field|media)\.[^}]+\}/.test(value) && !/^\{(field|media)\.[^}]+\}$/.test(value)) {
        issues.push({ id: `hand-inside:${where}:${at.join('.')}`, severity: 'improve', message: 'This name is only filled when it is the whole value.', detail: `“${at.filter((one) => !/^\d+$/.test(one)).join(' › ')}”: ${value}`, jump });
      }
    };
    walk(data, []);
  }
  const thing = input.scope === 'page' ? 'page' : inSentence(input.typeLabel);
  // The module's nodes by their short id, in words: "the product".
  const node = (short: string) => (short === '#identity' ? "the site's organization" : short === '#webpage' ? 'the page' : short === '#primary' ? `the ${inSentence(input.typeLabel) || 'main thing'}` : short === '#logo' ? 'the logo' : 'the item it points to');
  for (const entry of report?.empty ?? []) {
    const field = input.lookup.sources.find((row) => row.field === linkedField(entry.name) && row.path.length === 1)?.label ?? linkedField(entry.name);
    issues.push({
      id: `hand-empty:${entry.extend ?? entry.item ?? ''}:${entry.path}`,
      severity: 'improve',
      message: emptyWords(entry, { field: () => field, thing, rules: input.rules, node }),
      detail: entry.status === 'absent' ? `“${entry.path}” points to ${node(`#${entry.name.split('#').pop()}`)}.` : `“${entry.path}” is linked to ${/^media\./.test(entry.name) ? 'an image' : field}.`,
      jump: entry.extend ? extendJump(entry.extend, entry.path) : itemJump(entry.item, entry.path),
    });
  }
  if (report?.over) {
    issues.push({ id: 'hand-over', severity: 'fix', message: 'Your own JSON-LD was left out: the structured data would be over 256 KB.', detail: 'The other tags are still output. Link fewer long values, or add fewer items.', jump: custom });
  }
  if (report?.unencodable) {
    issues.push({
      id: 'schema-unencodable',
      severity: 'fix',
      message: "The structured data was left out: it can't be written out.",
      detail: `The other tags are still output.${schema.custom || schema.extend ? ' Check your own JSON-LD and added details.' : ''}`,
      jump: custom,
    });
  }
  if (report?.main?.ignored) {
    issues.push(
      report.main.ignored === 'kind'
        ? { id: 'hand-main-kind', severity: 'info', message: "Your own main thing isn't used", detail: 'Only a plain web page can have a hand-added main thing.', jump: custom }
        : { id: 'hand-main-absent', severity: 'improve', message: "The main thing you marked isn't on this page", detail: 'Mark another item, or put it back.', jump: custom },
    );
  }
  if (input.source && input.source.count > 0 && !schema.custom) {
    issues.push({
      id: 'hand-translation',
      severity: 'info',
      message: `The ${input.source.language} version has ${input.source.count} hand-added ${input.source.count === 1 ? 'item' : 'items'} this translation doesn't.`,
      detail: 'Copy them in Add your own JSON-LD, then translate their text.',
      jump: custom,
    });
  }
  if (input.refused) {
    issues.push({ id: 'hand-refused', severity: 'fix', message: 'An item of your own JSON-LD is left out: it has a problem', detail: input.refused, jump: custom });
  }
  if (input.unsaved) {
    issues.push({ id: 'hand-unsaved', severity: 'fix', message: 'Not saved: your own JSON-LD has a problem', detail: 'Open it to fix the problem, or discard the change.', jump: custom });
  }
  return issues;
}

/** What the bar says once a hand-added item is left out. */
export const leftOutText = (done: { id: string; given: boolean } | null) =>
  !done ? '' : done.given ? `Gave the item the id ${done.id} so it can be left out.` : 'Left out until it is on the page';

/**
 * The stage's one line about the page: the most serious issue of a fact
 * that could not be found on the page.
 */
export const stageMatch = (issues: Issue[]) => {
  const found = issues.filter((issue) => /^(schema-not-on-page|hand-hidden|hand-rating):/.test(issue.id));
  return found.find((issue) => issue.severity === 'fix') ?? found[0];
};

/** The words of a verdict: "Needs an image", "Doesn't fit: a recurring price". */
export function verdictText(server: StatePayload, verdict: Verdict, emptyFor?: (prop: string) => string | null): string {
  const rules = server.search_features;
  const feature = verdict.feature ? rules.features[verdict.feature] : undefined;
  switch (verdict.verdict) {
    case 'ready':
      return feature?.list && verdict.count !== undefined ? `Can show: ${verdict.count} ${server.registry[feature.list.of]?.label.toLowerCase() ?? 'item'}${verdict.count === 1 ? '' : 's'}` : 'Can show';
    case 'complete':
      return 'Complete';
    case 'unanswered':
      return 'Only if people buy it here';
    case 'not_fit':
      return `Doesn't fit: ${feature?.not_for?.find((one) => one.id === verdict.reason)?.reason ?? verdict.reason}`;
    case 'not_here':
      return 'Not shown here';
    case 'retired':
      return retiredText(feature?.since, server.ui);
    case 'none':
      return 'No search feature';
    case 'closed':
      // Still shipped: shown again once the closing date moves.
      return `Not shown: ${feature?.not_for?.find((one) => one.id === 'closed')?.reason ?? 'closed'} ${dateWords(verdict.date ?? '', server.ui) ?? verdict.date}`;
    case 'elsewhere':
      // Shown only from a list page: nothing to add here.
      return `Needs ${feature?.elsewhere ?? 'a list page'}`;
    default: {
      const first = verdict.missing?.[0];
      // A list: how many of the pages it links count.
      if (feature?.list && verdict.count !== undefined) {
        const noun = server.registry[feature.list.of]?.label.toLowerCase() ?? 'item';
        const many = (count: number) => `${count} ${noun}${count === 1 ? '' : 's'}`;
        // Nothing linked yet: the need alone.
        if (!verdict.of) return `Needs at least ${many(feature.list.min)}`;
        return `Needs at least ${many(feature.list.min)}: ${verdict.count} of the ${verdict.of} linked pages ${verdict.count === 1 ? 'is a complete' : 'are complete'} ${verdict.count === 1 ? noun : `${noun}s`}`;
      }
      if (!first) {
        return 'Needs more';
      }
      // A value of another shape: "Needs item reviewed as an organization".
      const shaped = shapeNeed(verdict, rules);
      if (shaped) {
        return shaped;
      }
      // A linked detail the previewed item has empty: said for the item.
      const empty = first.prop ? emptyFor?.(first.prop) : null;
      if (empty) {
        return `Needs ${empty}`;
      }
      const rule = first.rule === undefined ? undefined : feature?.rules?.[first.rule];
      // A part of a group is worded by its own name: "a country"; a detail
      // by its label on this type: "a description".
      const own = first.prop ? server.registry[server.resolved?.schema.type ?? '']?.props?.find((one) => one.key === first.prop)?.label : undefined;
      const need = rule?.need ?? needOf(rules, first.path, first.path, own);
      const more = (verdict.missing?.length ?? 1) - 1;
      // Set, but not one of the list's ("Finland" for a country): chosen.
      const listed = !!first.prop && !!server.resolved?.schema.dropped?.some((one) => one.key === first.prop);
      return `Needs ${need}${listed ? ' from the list' : ''}${more ? ` and ${more} more` : ''}`;
    }
  }
}

/** A feature line in words: "Merchant listing doesn't fit: a recurring price". */
export const lineName = (label: string, words: string) =>
  words.startsWith("Doesn't fit") ? `${label} doesn't fit${words.slice(11)}` : `${label}: ${words}`;
