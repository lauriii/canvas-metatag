import { CodeIcon, ImageIcon } from '@radix-ui/react-icons';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useApp } from '../App';
import { breadcrumb, previewText, socialImage } from '../model';
import { PICKED } from './MediaPicker';
import { IconBtn, InfoTip, Sk, SparkleIcon } from './ui';

/** A value that follows `value` once it has been still for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setShown(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return shown;
}

/** Puts focus in the field a part of a preview shows (pointer only). */
function focusPath(path: string) {
  const field = document.querySelector(
    `.seo-panel[data-state="active"] [data-path="${path}"]`,
  );
  field
    ?.querySelector<HTMLElement>('textarea, input, [data-focus]')
    ?.focus();
}

/**
 * The tinted surface a view opens with. It tells the fields whether it is in
 * sight: chip fields say what they become only when it is not.
 */
export function Stage(props: {
  caption: ReactNode;
  buttons?: ReactNode;
  children: ReactNode;
}) {
  const { setStageVisible } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        // A stage behind another tab does not speak.
        if (element.offsetParent !== null) {
          setStageVisible(entry.isIntersecting);
        }
      },
      { root: element.closest('.seo-body') },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [setStageVisible]);
  return (
    <div className="seo-stage" ref={ref}>
      <div className="seo-stage-cap">
        <div className="seo-stage-cap-l">{props.caption}</div>
        {props.buttons && (
          <div className="seo-stage-cap-btns">{props.buttons}</div>
        )}
      </div>
      {props.children}
    </div>
  );
}

/** The `</>` on a preview: what search engines and visitors get. */
export function OutputButton() {
  const { openSheet } = useApp();
  return (
    <IconBtn
      label="View output"
      onClick={() => openSheet({ kind: 'output' })}
    >
      <CodeIcon aria-hidden />
    </IconBtn>
  );
}

/** The page's public address: Canvas's live path while it differs from the saved one. */
function useAddress(): string {
  const { state, view } = useApp();
  const server = state.server!;
  const saved = view?.tokens.url?.value || server.preview?.url || '';
  const alias = state.ctx.kind === 'page' ? state.live.alias : undefined;
  let path = '';
  try {
    path = new URL(saved).pathname;
  } catch {
    // No saved address: the live path is all there is.
  }
  // The front page is the base itself, whatever its alias; an unchanged
  // alias keeps the saved address with its language prefix.
  if (!alias?.startsWith('/') || path === '/' || path.endsWith(alias)) {
    return saved || (alias?.startsWith('/') ? server.origin.url + alias : '');
  }
  const target = server.target;
  const prefix =
    target?.default_langcode &&
    server.langcode !== target.default_langcode &&
    path.startsWith(`/${server.langcode}/`)
      ? `/${server.langcode}`
      : '';
  return server.origin.url + prefix + alias;
}

/** The site's mark in a result: its logo, else its first letter. */
function Favicon(props: { site: string }) {
  const { state } = useApp();
  const server = state.server!;
  const logo = PICKED[server.site.identity.logo] ?? server.media[server.site.identity.logo];
  const [broken, setBroken] = useState(false);
  return (
    <span className="seo-result-icon" aria-hidden>
      {logo?.thumb && !broken ? (
        <img
          src={logo.thumb}
          alt=""
          width={18}
          height={18}
          onError={() => setBroken(true)}
        />
      ) : (
        (Array.from(props.site.trim())[0]?.toUpperCase() ?? '')
      )}
    </span>
  );
}

/** The search result, at true size. One image to assistive technology. */
export function SearchPreview() {
  const { state, measurer, trial, focusField, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const target = server.target!;
  const address = useAddress();
  const texts = { ...view.texts, ...trial };
  const robots = view.effective.robots ?? {};
  const snippets = robots.nosnippet !== true && robots.max_snippet !== 0;
  const site = view.values.site ?? '';
  const title = previewText('title', texts.title, measurer);
  const description = !snippets
    ? 'No description: text previews are off'
    : texts.description
      ? previewText('description', texts.description, measurer)
      : 'Search engines will pick text from the page.';
  const muted = !snippets || !texts.description;
  const crumbs = breadcrumb(address);
  // A canonical set here shows at once; a path is put on the public address.
  const canonical = view.effective.canonical?.trim();
  const elsewhere = canonical
    ? canonical.startsWith('/')
      ? server.origin.url + canonical
      : canonical
    : '';
  const name = useSettled(
    `${view.hidden ? 'Not shown in search results. ' : ''}Search result preview, estimate. ${site}, ${crumbs.replaceAll(
      ' › ',
      ', ',
    )}. Title: ${title}.${snippets && texts.description ? ` Description: ${description}` : ''}`,
    1000,
  );
  const template = target.scope === 'template';
  const on = (path: 'title' | 'description') =>
    focusField === path ||
    (trial !== null && trial[path] !== view.texts[path]) ||
    undefined;
  return (
    <Stage
      caption={
        trial ? (
          <span data-trial="">
            <SparkleIcon width="12" height="12" />
            Trying suggestion {trial.index ?? ''}
          </span>
        ) : (
          <>
            {template ? (
              <>
                Previewing <em>{server.preview?.label ?? ''}</em>
              </>
            ) : (
              <span>Search result</span>
            )}
            {!target.published && (
              <span>
                · {template ? 'Template not in use yet' : 'Not published yet'}
              </span>
            )}
            {view.hidden && <span>· Hidden from search</span>}
          </>
        )
      }
      buttons={
        <>
          <OutputButton />
          <InfoTip
            label="About this preview"
            text={`An estimate. Search engines sometimes rewrite titles and descriptions.${
              template
                ? ` Switch the previewed ${target.label} with the preview picker in the top bar.`
                : ''
            }`}
          />
        </>
      }
    >
      <div
        className="seo-result"
        role="img"
        aria-label={name}
        lang={server.langcode}
        data-testid="seo-search-preview"
      >
        <div className="seo-result-site">
          <Favicon site={site} />
          <div>
            <div className="seo-result-name">{site}</div>
            <div className="seo-result-address">{crumbs}</div>
          </div>
        </div>
        <div className="seo-result-title">
          <span
            className="seo-part"
            data-on={on('title')}
            onClick={() => focusPath('title')}
          >
            {title}
          </span>
        </div>
        <div className="seo-result-text" data-muted={muted || undefined}>
          <span
            className="seo-part"
            data-on={on('description')}
            onClick={() => focusPath('description')}
          >
            {description}
          </span>
        </div>
        {elsewhere && elsewhere !== address && (
          <div className="seo-result-note">
            Search engines are asked to show {elsewhere} instead.
          </div>
        )}
      </div>
    </Stage>
  );
}

/** While loading: the address and the description are real, the rest waits. */
export function SearchSkeleton(props: {
  host: string;
  alias?: string;
  description?: string;
}) {
  return (
    <div className="seo-panel" aria-busy="true">
      <div className="seo-stage">
        <div className="seo-stage-cap">
          <div className="seo-stage-cap-l">Search result</div>
        </div>
        <div className="seo-result-site">
          <span className="seo-result-icon" />
          <div>
            <Sk w={120} h={12} />
            <div className="seo-result-address">
              {props.host && props.alias
                ? breadcrumb(`https://${props.host}${props.alias}`)
                : ' '}
            </div>
          </div>
        </div>
        <Sk w="72%" h={20} mt={12} />
        <div className="seo-result-text">
          {props.description || <Sk w="90%" h={14} mt={4} />}
        </div>
      </div>
      {[44, 32].map((label) => (
        <div key={label}>
          <Sk w={label} h={12} />
          <Sk w="100%" h={32} mt={12} />
        </div>
      ))}
    </div>
  );
}

/** The card a shared link shows. Honest about its input: no large image, no large card. */
export function SocialPreview(props: { suggest?: ReactNode }) {
  const { state, trial, focusField, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const [broken, setBroken] = useState<string | null>(null);
  const texts = { ...view.texts, ...trial };
  const { image } = socialImage(state, view, PICKED);
  const large = image !== null && image.width >= 600;
  const src = image ? (large ? (image.url ?? image.thumb) : image.thumb) : '';
  let host = '';
  try {
    // Upper case in CSS only: assistive technology reads the name as a word.
    host = new URL(server.origin.url).host;
  } catch {
    // No public address: the card shows none.
  }
  const name = useSettled(
    `Social card preview. ${
      large ? 'Large image' : image ? 'Small image' : 'No image'
    }. ${host}. Title: ${texts.social_title}.${
      texts.social_description
        ? ` Description: ${texts.social_description}`
        : ''
    }`,
    1000,
  );
  const on = (path: string, key: 'social_title' | 'social_description') =>
    focusField === path ||
    (trial !== null && trial[key] !== view.texts[key]) ||
    undefined;
  return (
    <Stage
      caption={
        trial ? (
          <span data-trial="">
            <SparkleIcon width="12" height="12" />
            Trying suggestion {trial.index ?? ''}
          </span>
        ) : (
          <>
            <span>Link preview</span>
            {!large && (
              <span>
                ·{' '}
                {image ? 'Small card: image under 600 px wide' : 'Small card: no image'}
              </span>
            )}
          </>
        )
      }
      buttons={
        <>
          {props.suggest}
          <OutputButton />
        </>
      }
    >
      <div
        className="seo-social"
        role="img"
        aria-label={name}
        lang={server.langcode}
        data-testid="seo-social-preview"
        data-layout={large ? 'large' : 'compact'}
      >
        <div className="seo-social-image">
          {src && src !== broken ? (
            <img src={src} alt="" onError={() => setBroken(src)} />
          ) : (
            <ImageIcon aria-hidden />
          )}
        </div>
        <div className="seo-social-text">
          <span className="seo-social-host">{host}</span>
          <span className="seo-social-title">
            <span
              className="seo-part"
              data-on={on('social.title', 'social_title')}
              onClick={() => focusPath('social.title')}
            >
              {texts.social_title}
            </span>
          </span>
          <span className="seo-social-description">
            <span
              className="seo-part"
              data-on={on('social.description', 'social_description')}
              onClick={() => focusPath('social.description')}
            >
              {texts.social_description}
            </span>
          </span>
        </div>
      </div>
    </Stage>
  );
}
