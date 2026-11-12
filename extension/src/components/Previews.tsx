import { EyeNoneIcon, ImageIcon } from '@radix-ui/react-icons';
import { Card, Flex, Skeleton, Text, Tooltip } from '@radix-ui/themes';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useApp } from '../App';
import { breadcrumb, previewText, socialImage } from '../model';
import { PICKED } from './MediaPicker';

/** A value that follows `value` once it has been still for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setShown(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return shown;
}

/** True while `ref` is scrolled out of its scroll area. */
function useScrolledAway(ref: RefObject<HTMLElement>): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setAway(!entry.isIntersecting),
      { root: element.closest('.rt-ScrollAreaViewport') },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return away;
}

/**
 * The preview's two-line form. It sticks to the top of the scroll area once
 * the card has scrolled away: a visual duplicate, hidden from assistive
 * technology.
 */
function Compact(props: {
  card: RefObject<HTMLElement>;
  first: string;
  second: string;
  /** The second line is a placeholder, not text of the page. */
  muted?: boolean;
  hidden?: boolean;
  lang: string;
}) {
  const away = useScrolledAway(props.card);
  return (
    <div className="seo-compact" aria-hidden data-show={away || undefined}>
      <div
        className="seo-compact-bar"
        lang={props.lang}
        data-dimmed={props.hidden || undefined}
      >
        <span className="seo-result-title">{props.first}</span>
        <span className="seo-result-text" data-muted={props.muted || undefined}>
          {props.second || ' '}
        </span>
      </div>
    </div>
  );
}

function PreviewLabel(props: { children: ReactNode; action?: ReactNode }) {
  return (
    <Flex
      className="seo-label-row"
      align="center"
      justify="between"
      gap="3"
      minHeight="20px"
    >
      <Text as="div" size="1" color="gray">
        {props.children}
      </Text>
      {props.action}
    </Flex>
  );
}

const Estimate = () => (
  <Tooltip content="Search engines often rewrite titles and descriptions.">
    {/* No tab stop: the preview's accessible name already says "estimate". */}
    <span className="seo-hint">estimate</span>
  </Tooltip>
);

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

/** What an empty description shows: search engines then choose the text. */
const NO_DESCRIPTION = '(Search engines will pick text from the page)';

/** The search result, in the phone layout at true size. One image to assistive technology. */
export function SearchPreview() {
  const { state, measurer, trial, ...app } = useApp();
  // Target tabs are mounted only with a target.
  const view = app.view!;
  const server = state.server!;
  const target = server.target!;
  const card = useRef<HTMLDivElement>(null);
  const address = useAddress();
  const texts = { ...view.texts, ...trial };
  const robots = view.effective.robots ?? {};
  const snippets = robots.nosnippet !== true && robots.max_snippet !== 0;
  const site = view.values.site ?? '';
  const title = previewText('title', texts.title, measurer);
  const description = !snippets
    ? '(no description: text previews are off)'
    : texts.description
      ? previewText('description', texts.description, measurer)
      : NO_DESCRIPTION;
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
    )}. Title: ${title}.${snippets && description ? ` Description: ${description}` : ''}`,
    1000,
  );
  const template = target.scope === 'template';
  return (
    <>
      <Compact
        card={card}
        first={title}
        second={description}
        muted={muted}
        hidden={view.hidden}
        lang={server.langcode}
      />
      <div className="seo-preview">
        <PreviewLabel>
          {template ? (
            // One line: a long page label is cut, "· estimate" always shows.
            <span className="seo-previewing">
              <span title={server.preview?.label}>
                Previewing: {server.preview?.label ?? ''}
              </span>
              <span>
                {'\u00a0· '}
                <Estimate />
              </span>
            </span>
          ) : (
            <>
              Search result preview · <Estimate />
            </>
          )}
        </PreviewLabel>
        {template && (
          <Text as="p" size="1" color="gray" mb="2">
            Switch pages with the preview picker in the top bar.
          </Text>
        )}
        <Card
          ref={card}
          className="seo-card"
          role="img"
          aria-label={name}
          lang={server.langcode}
          data-testid="seo-search-preview"
        >
          {view.hidden && (
            <div className="seo-hidden-band">
              <EyeNoneIcon aria-hidden />
              Not shown in search results
            </div>
          )}
          <div className="seo-result" data-dimmed={view.hidden || undefined}>
            <Flex align="center" gap="3" mb="2">
              <span className="seo-result-icon">
                {Array.from(site.trim())[0]?.toUpperCase() ?? ''}
              </span>
              <div className="seo-result-site">
                <span>{site}</span>
                <span className="seo-result-address">{crumbs}</span>
              </div>
            </Flex>
            <div className="seo-result-title">{title}</div>
            <div
              className="seo-result-text"
              data-muted={muted || undefined}
            >
              {description}
            </div>
          </div>
        </Card>
        {view.hidden && (
          <Text as="p" size="1" color="gray" mt="1">
            If it were shown, it would look like this.
          </Text>
        )}
        {elsewhere && elsewhere !== address && (
          <Text as="p" size="1" color="gray" mt="1" className="seo-wrap">
            Search engines are asked to show {elsewhere} instead.
          </Text>
        )}
      </div>
    </>
  );
}

/** The loading state of the Search tab: the address and description are real, the rest shimmers. */
export function SearchSkeleton(props: {
  host: string;
  alias?: string;
  description?: string;
}) {
  return (
    <Flex direction="column" gap="4" aria-busy="true">
      <div className="seo-preview">
        <Skeleton height="16px" width="45%" mb="2" />
        <Card className="seo-card">
          <div className="seo-result">
            <Flex align="center" gap="3" mb="2">
              <Skeleton width="28px" height="28px" />
              <div className="seo-result-site">
                <Skeleton height="12px" width="72px" mb="1" />
                <span className="seo-result-address">
                  {props.host && props.alias
                    ? breadcrumb(`https://${props.host}${props.alias}`)
                    : ' '}
                </span>
              </div>
            </Flex>
            <Skeleton height="22px" width="70%" mb="1" />
            <div className="seo-result-text">
              {props.description || <Skeleton height="16px" width="90%" />}
            </div>
          </div>
        </Card>
      </div>
      <div>
        <Flex justify="between" mb="2">
          <Skeleton height="16px" width="38%" />
          <Skeleton height="16px" width="18%" />
        </Flex>
        <Skeleton height="32px" />
      </div>
      <div>
        <Flex justify="between" mb="2">
          <Skeleton height="16px" width="24%" />
          <Skeleton height="16px" width="28%" />
        </Flex>
        <Skeleton height="52px" />
      </div>
    </Flex>
  );
}

/** The card a shared link shows. Honest about its input: no large image, no large card. */
export function SocialPreview(props: { suggest?: ReactNode }) {
  const { state, trial, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const card = useRef<HTMLDivElement>(null);
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
  const picture =
    src && src !== broken ? (
      <img src={src} alt="" onError={() => setBroken(src)} />
    ) : (
      <ImageIcon aria-hidden />
    );
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
  return (
    <>
      <Compact
        card={card}
        first={texts.social_title}
        second={texts.social_description}
        lang={server.langcode}
      />
      <div className="seo-preview">
        <PreviewLabel action={props.suggest}>
          Social card preview
          {server.target?.scope === 'template' &&
            ` · ${server.preview?.label ?? ''}`}
        </PreviewLabel>
        <Card
          ref={card}
          className="seo-card seo-social"
          role="img"
          aria-label={name}
          lang={server.langcode}
          data-testid="seo-social-preview"
          data-layout={large ? 'large' : 'compact'}
        >
          <div className="seo-social-image">{picture}</div>
          <div className="seo-social-text">
            <span className="seo-social-host">{host}</span>
            <span className="seo-social-title">{texts.social_title}</span>
            <span className="seo-social-description">
              {texts.social_description}
            </span>
          </div>
        </Card>
        {!large && (
          <Text as="p" size="1" color="gray" mt="1">
            No large image: links will show a small card.
          </Text>
        )}
      </div>
    </>
  );
}
