import { CodeIcon, ImageIcon } from '@radix-ui/react-icons';
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useApp } from '../App';
import {
  breadcrumb,
  previewNote,
  previewText,
  smallCard,
  socialImage,
} from '../model';
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
  // The title ending is the title field's second part.
  const ending = path === 'title_end';
  const field = document.querySelector(
    `.seo-panel[data-state="active"] [data-path="${ending ? 'title' : path}"]`,
  );
  field
    ?.querySelector<HTMLElement>(
      // A value that is linked or follows its default is its box.
      ending ? '.seo-ending-btn' : '.seo-composer[contenteditable="true"], textarea, input, .seo-linked-box, [data-focus]',
    )
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
  // A suffix shows whole or not at all, so that only the subject (the
  // previewed node's name) can end in an ellipsis; the last one goes first.
  // What a left-out suffix said is said elsewhere too: the About this
  // preview tip, or Checks for Site's identity gap. Measured when the
  // caption's text or width changes, not on every keystroke.
  const cap = useRef<HTMLDivElement>(null);
  const fitted = useRef<string | null>(null);
  const fit = () => {
    const parts = [
      ...(cap.current?.querySelectorAll<HTMLElement>(
        ':scope > em ~ span, :scope > span + span',
      ) ?? []),
    ];
    parts.forEach((part) => part.removeAttribute('data-cut'));
    const cut = () =>
      parts.some(
        (part) =>
          !part.hasAttribute('data-cut') &&
          // Widths are rounded: a pixel over is subpixel rounding, not a cut.
          part.scrollWidth - part.clientWidth > 1,
      );
    for (let index = parts.length - 1; index >= 0 && cut(); index--) {
      parts[index].setAttribute('data-cut', '');
    }
  };
  useLayoutEffect(() => {
    const text = cap.current?.textContent ?? '';
    if (text !== fitted.current) {
      fitted.current = text;
      fit();
    }
  });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => fit());
    observer.observe(cap.current!);
    // Text measured in a fallback font is measured again in the real one.
    void document.fonts?.ready.then(() => fit());
    return () => observer.disconnect();
  }, []);
  return (
    <div className="seo-stage" ref={ref}>
      <div className="seo-stage-cap">
        <div className="seo-stage-cap-l" ref={cap}>
          {props.caption}
        </div>
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
  const saved = view?.facts.url?.value || server.preview?.url || '';
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
  const site = view.facts.site?.value ?? '';
  const title = previewText('title', texts.title, measurer);
  // Each part of the title lights up with its own control.
  const mainLength =
    texts.title_main && texts.title.startsWith(texts.title_main)
      ? texts.title_main.length
      : title.length;
  const titleMain = title.slice(0, mainLength);
  const titleEnd = title.slice(titleMain.length);
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
  const note = previewNote({
    template,
    published: target.published,
    node: server.preview?.published !== false,
    label: target.label,
    hidden: view.hidden,
  });
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
                Previewing <em dir="auto">{server.preview?.label ?? ''}</em>
              </>
            ) : (
              <span>Search result</span>
            )}
            {note.suffix && <span>· {note.suffix}</span>}
            {view.hidden && <span>· Hidden from search</span>}
          </>
        )
      }
      buttons={
        <>
          <OutputButton />
          <InfoTip label="About this preview" text={note.info} />
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
            <div className="seo-result-name" dir="auto">
              {site}
            </div>
            <div className="seo-result-address" dir="auto">
              {crumbs}
            </div>
          </div>
        </div>
        <div className="seo-result-title" dir="auto">
          <span
            className="seo-part"
            data-on={on('title')}
            onClick={() => focusPath('title')}
          >
            {titleMain}
          </span>
          {titleEnd && (
            <span
              className="seo-part"
              data-on={focusField === 'title_end' || undefined}
              onClick={() => focusPath('title_end')}
            >
              {titleEnd}
            </span>
          )}
        </div>
        <div
          className="seo-result-text"
          dir="auto"
          data-muted={muted || undefined}
        >
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
  const target = server.target;
  // At template scope, a node visitors cannot see yet.
  const unpublished =
    target?.scope === 'template' && server.preview?.published === false
      ? previewNote({
          template: true,
          published: target.published,
          node: false,
          label: target.label,
        }).unpublished
      : '';
  const [broken, setBroken] = useState<string | null>(null);
  const texts = { ...view.texts, ...trial };
  const { image } = socialImage(state, view);
  const small = smallCard(image);
  const large = !small;
  // The image on screen changes only once the next one has loaded, and
  // a large card waits for the file itself rather than show its thumbnail.
  const [front, setFront] = useState<{ src: string; prev?: string } | null>(
    null,
  );
  const src = image
    ? large
      ? (image.url ?? (front ? front.src : image.thumb))
      : image.thumb
    : '';
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
            {small && <span>· Small card</span>}
            {unpublished && <span>· Not published yet</span>}
          </>
        )
      }
      buttons={
        <>
          {props.suggest}
          <OutputButton />
          {(small || unpublished) && (
            <InfoTip
              label="About this preview"
              text={[small && `${small}.`, unpublished]
                .filter(Boolean)
                .join(' ')}
            />
          )}
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
            <>
              {front?.prev && <img key={front.prev} src={front.prev} alt="" />}
              {front && front.src !== src && (
                <img key={front.src} src={front.src} alt="" />
              )}
              <img
                key={src}
                src={src}
                alt=""
                data-front={front?.src === src || undefined}
                onLoad={() =>
                  setFront((last) =>
                    last?.src === src ? last : { src, prev: last?.src },
                  )
                }
                onError={() => setBroken(src)}
              />
            </>
          ) : (
            <ImageIcon aria-hidden />
          )}
        </div>
        <div className="seo-social-text">
          <span className="seo-social-host" dir="auto">
            {host}
          </span>
          <span className="seo-social-title" dir="auto">
            <span
              className="seo-part"
              data-on={on('social.title', 'social_title')}
              onClick={() => focusPath('social.title')}
            >
              {texts.social_title}
            </span>
          </span>
          <span className="seo-social-description" dir="auto">
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
