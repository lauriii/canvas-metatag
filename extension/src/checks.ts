// The Checks rules: facts about this dialog's settings and the page preview.
// No score. Rules fed by `resolved` describe the saved draft.
import type { PageFacts } from './host';
import {
  dimensions,
  fileSize,
  fill,
  inSentence,
  largeCardNeeds,
  meter,
  tokensIn,
  trimSeparators,
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
  TokenInfo,
} from './types';

export interface ChecksInput {
  effective: SeoValues;
  sources(path: string): Source;
  texts: Texts;
  /** With Canvas's live title and description laid over the server's. */
  tokens: Record<string, TokenInfo>;
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
  return trimSeparators(rest.replace(/ +/g, ' ').trim(), sep);
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
  tokens: Record<string, TokenInfo>,
): { field: string; text: string }[] {
  const { identity } = site;
  return [
    !identity.name.trim() && !tokens.site?.value.trim()
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
  const { effective, texts, tokens, resolved, facts, registry } = input;
  const issues: Issue[] = [];
  const value = (name: string) => tokens[name]?.value ?? '';
  const flat = Object.fromEntries(
    Object.entries(tokens).map(([name, token]) => [name, token.value]),
  );
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
  const site = value('site');
  const sep = value('sep');
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

  const templates: [string, Tab, string | undefined][] = [
    ['title', 'search', effective.title],
    ['description', 'search', effective.description],
    ['social.title', 'social', effective.social?.title],
    ['social.description', 'social', effective.social?.description],
  ];
  const reported = new Set<string>();
  const leftOut = `It is left out for ${page}, and filled in wherever another ${inSentence(input.typeLabel)} has one.`;
  /** A value the previewed node has none of: a fact at template scope. */
  const emptyHere = (name: string) =>
    !!tokens[name] && !tokens[name].value.trim() && !tokens[name].image;
  for (const [field, tab, template] of templates) {
    for (const name of tokensIn(template ?? '')) {
      const token = tokens[name];
      // A name that is not in the vocabulary (a deleted field) is blanked, not reported.
      if (
        !token ||
        token.type === 'image' ||
        token.value.trim() ||
        reported.has(name)
      ) {
        continue;
      }
      reported.add(name);
      issues.push({
        id: `token-empty:${name}`,
        // A template cannot fill in one event's field: there it is a fact,
        // good to know, not counted.
        ...(onPage
          ? {
              severity: 'improve' as const,
              message: `Fill in ${token.label} or remove it`,
              detail: `"${token.label}" is empty for ${page}, so it is left out.`,
            }
          : {
              severity: 'info' as const,
              message: `${token.label} is empty for ${page}`,
              detail: leftOut,
            }),
        jump: jump(tab, field),
      });
    }
  }

  if (site && texts.title.toLowerCase().split(site.toLowerCase()).length > 2) {
    const own =
      input.sources('title') === 'target' ? (effective.title ?? '') : '';
    const literal = new RegExp(escape(site), 'i');
    // The {sep} token, or its value typed as a word.
    const separates = (word: string | undefined) =>
      word === '{sep}' || (sep !== '' && word === sep);
    issues.push({
      id: 'title-site-twice',
      severity: 'improve',
      message: 'Remove the repeated site name',
      detail: 'The site name appears twice in the title.',
      jump: jump('search', 'title'),
      // Only a literal site name can be taken out; a token is the pattern's own.
      fix: literal.test(own.replace(/\{[^{}]*\}/g, ' '))
        ? {
            label: 'Remove the repeat',
            apply: (values) => {
              // Odd parts are the tokens.
              const parts = (values.title ?? '').split(/(\{[^{}]*\})/);
              const at = parts.findIndex(
                (part, index) => index % 2 === 0 && literal.test(part),
              );
              if (at < 0) {
                return values;
              }
              parts[at] = parts[at].replace(literal, ' ');
              // Then the separators the removal left with nothing to separate.
              const kept: string[] = [];
              for (const word of parts.join('').split(/\s+/).filter(Boolean)) {
                if (
                  !separates(word) ||
                  (kept.length > 0 && !separates(kept.at(-1)))
                ) {
                  kept.push(word);
                }
              }
              while (separates(kept.at(-1))) {
                kept.pop();
              }
              return { ...values, title: kept.join(' ') };
            },
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
    issues.push({
      id: 'title-long',
      severity: 'info',
      message: 'Shorten the title',
      detail: titleCut,
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
  if (canonical && value('url') && canonical !== value('url')) {
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
      issues.push({
        id: `schema-required:${key}`,
        severity: 'fix',
        message: `Add ${label(key)}`,
        detail: `${type.label} details are left out until it is filled in.`,
        jump: prop(key),
      });
    }
    // At template scope a property linked to fields the previewed node has
    // no value in is a fact, as an empty value in the texts is.
    const linked = (key: string) => {
      const names = tokensIn(
        schema.props?.[key] ??
          props.find((item) => item.key === key)?.default ??
          '',
      );
      return !onPage && names.length > 0 && names.every(emptyHere) && names;
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
    for (const key of recommended) {
      const names = linked(key);
      // Said once: a value the texts use is already listed.
      if (names && !names.every((name) => reported.has(name))) {
        issues.push({
          id: `schema-empty:${key}`,
          severity: 'info',
          message: `${label(key)} is empty for ${page}`,
          detail: leftOut,
          jump: prop(key),
        });
      }
    }
  }
  const date = (key: string) => {
    const template =
      schema.props?.[key] ?? props.find((item) => item.key === key)?.default;
    return template === undefined ? NaN : Date.parse(fill(template, flat));
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
      // Only a literal can be compared: a bound value is the page's own data.
      // A code (a currency, a SKU) is rarely printed as written.
      if (
        item.kind === 'text' &&
        !item.pattern &&
        stored !== undefined &&
        tokensIn(stored).length === 0 &&
        normal(stored) &&
        !text.includes(normal(stored))
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
  const gaps = input.can.site ? identityGaps(input.site, tokens) : [];
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
