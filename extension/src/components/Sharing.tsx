import { RadioGroup, SegmentedControl } from '@radix-ui/themes';
import { useEffect, useId, useRef, useState } from 'react';

import { useApp } from '../App';
import { colourWords, contrastText, logoNote, sampleTitle, shareSamples } from '../model';
import type { ShareSample } from '../types';
import { Field, Guide } from './Field';
import { Sheet } from './Header';
import { closed } from './Previews';
import { ImageRow, PICKED } from './MediaPicker';
import { Btn, revealSpan } from './ui';

// Short enough for two segments side by side at 200% zoom.
const SAMPLES = { home: 'Home page', page: 'Page without image' } as const;
type Sample = keyof typeof SAMPLES;
/** What a sample is, in a sentence. */
const SAMPLE_WORDS: Record<Sample, string> = { home: 'the home page', page: 'a page without an image' };

/** Where a jump to "When a page has no image" starts, the first that fits with the choice. */
const REVEAL_FROM = ['.seo-share-heading', '.seo-share-switch', '[data-testid="seo-share-sample"]'];


/**
 * What links show, drawn by the server from the Site working copy: the
 * name, the logo, the colour and what pages without an image share. Asked
 * again 400 ms after the last change, and after a save brings new server
 * state (a logo changed outside the dialog).
 */
function useSample(sample: Sample, always?: 'card'): ShareSample | null {
  const { api, state, view } = useApp();
  const { name, logo, colour, default_image } = state.edits.site.identity;
  // The colour's sheet shows the card whatever pages without an image share.
  const share_fallback = always ?? state.edits.site.identity.share_fallback;
  const share = state.server?.share;
  const title = sampleTitle(state.server?.target?.scope, view?.facts.title?.value, !!always);
  const [shown, setShown] = useState<ShareSample | null>(null);
  const first = shown === null;
  useEffect(() => {
    let gone = false;
    const timer = setTimeout(
      () =>
        // A name too long to save is said by its field: the sample draws
        // what it can, and never goes stale silently.
        api.shareSample({ sample, title, name: name.slice(0, 255), logo, colour, share_fallback, default_image }).then(
          (result) => !gone && setShown(result),
          // A colour being typed is not one yet: the last card stays.
          () => {},
        ),
      first ? 0 : 400,
    );
    return () => {
      gone = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, sample, title, name, logo, colour, share_fallback, default_image, share?.theme_logo, share?.svg]);
  return shown;
}

/** The card alone, as the colour's sheet shows what it changes. */
function SampleImage(props: { sample: ShareSample | null; label: string }) {
  const { sample } = props;
  return (
    <div className="seo-share-sample">
      {sample?.image ? <img src={sample.image} alt={props.label} /> : <span className="seo-share-sample-empty" aria-hidden />}
    </div>
  );
}

/**
 * The sample as a shared link shows it, in the link preview's own card: the
 * image above the host and title, or, for a link without one, its text alone
 * (a gray tile with an icon is a broken image).
 */
function SampleLink(props: { sample: ShareSample | null; label: string; host: string; description?: string }) {
  const { sample, host, description } = props;
  const none = sample?.shows === 'none';
  const title = sample?.title ?? '';
  return (
    <div
      className="seo-social"
      role="img"
      aria-label={`${props.label}. ${none ? 'No image' : 'Large image'}. ${host}.${title ? ` Title: ${closed(title)}` : ''}${
        description ? ` Description: ${description}` : ''
      }`}
      data-layout={none ? 'compact' : 'large'}
      data-testid="seo-share-sample"
    >
      {!none && (
        <div className="seo-social-image">
          {/* Shown at once: the link preview's fade waits for data-front. */}
          {sample?.image ? <img src={sample.image} alt="" data-front="" /> : null}
        </div>
      )}
      <div className="seo-social-text" aria-hidden>
        <span className="seo-social-host" dir="auto">
          {host}
        </span>
        <span className="seo-social-title" dir="auto">
          {title}
        </span>
        {description && (
          <span className="seo-social-description" dir="auto">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Site › Sharing: how shared links look (a sample of the home page and of a
 * page without an image), the logo and colour they are drawn with, and what
 * pages without an image share. Values are said in words; codes and
 * contrast only in the colour's sheet.
 */
export function Sharing() {
  const { state, dispatch, openSheet, view } = useApp();
  const server = state.server!;
  const share = server.share;
  const { identity } = state.edits.site;
  // The front page is a sample when the module makes its head.
  const samples = shareSamples(share?.home);
  const [chosen, setSample] = useState<Sample>('page');
  const sample = samples.includes(chosen) ? chosen : 'page';
  const drawn = useSample(sample);
  const edit = (path: string, value: unknown) => dispatch({ type: 'edit', scope: 'site', path, value });
  const image = (uuid: string) => PICKED[uuid] ?? server.media[uuid] ?? null;
  const themeLogo = !identity.logo ? (share?.theme_logo ?? null) : null;
  const svg = drawn?.svg ?? share?.svg ?? false;
  const logo = image(identity.logo);
  // As the link shows it: the home page's description as its head sends
  // it; the page in the editor's own.
  const description = sample === 'home' ? drawn?.description : server.target?.scope === 'page' ? view?.texts.social_description : '';
  const made = !share?.missing;
  // A choice made from the keyboard or the pointer shows the sample it
  // changes, when both fit: never a change out of sight.
  const choices = useRef<HTMLDivElement>(null);
  const fallback = identity.share_fallback;
  const choiceSeen = useRef(fallback);
  useEffect(() => {
    if (choiceSeen.current === fallback) {
      return;
    }
    choiceSeen.current = fallback;
    const active = choices.current?.ownerDocument.activeElement;
    if (active && choices.current?.contains(active)) {
      revealSpan(REVEAL_FROM.slice(1).map((selector) => choices.current!.ownerDocument.querySelector(selector)), active, 'nearest');
    }
  }, [fallback]);
  const siteImage = image(identity.default_image);
  const host = (() => {
    try {
      return new URL(server.origin.url).host;
    } catch {
      return server.origin.url;
    }
  })();

  return (
    <>
      <h3 className="seo-group-title seo-share-heading">Sharing</h3>
      {made ? (
        <div className="seo-stage">
          {/* The control Represents and the separator use. */}
          {samples.length > 1 && (
            <SegmentedControl.Root
              size="1"
              className="seo-segmented seo-share-switch"
              role="radiogroup"
              aria-label="Sample"
              value={sample}
              onValueChange={(value) => value && setSample(value as Sample)}
            >
              {samples.map((key) => (
                // Selection follows focus: the arrows choose, as in a radio group.
                <SegmentedControl.Item key={key} value={key} onFocus={() => setSample(key)}>
                  {SAMPLES[key]}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl.Root>
          )}
          <SampleLink sample={drawn} host={host} description={description} label={`Sample of a shared link: ${SAMPLE_WORDS[sample]}`} />
        </div>
      ) : (
        <p className="seo-quiet" data-testid="seo-share-unmade">
          {share?.missing === 'fonts'
            ? "Shared images can't be made on this server: the image library has no font support."
            : "Shared images can't be made on this server: its public files are not on its own disk."}
        </p>
      )}

      {/* Right under the sample it changes; a jump shows the sample too. */}
      <Field
        scope="site"
        path="identity.share_fallback"
        label="When a page has no image"
        also={['identity.default_image']}
        revealFrom={REVEAL_FROM}
        group
        errorInside
      >
        {(field) => {
          const errorId = `${field.id}-error`;
          const describedBy = [field.describedBy, field.message && errorId].filter(Boolean).join(' ') || undefined;
          // Arrows select as well as move (Radix listens for them on the
          // parent document, not the dialog's frame).
          const choose = (value: string) => () => value !== identity.share_fallback && edit('identity.share_fallback', value);
          // A jump focuses the choice made, not the image row's button.
          const at = (value: string) => (value === identity.share_fallback ? { 'data-focus': '' } : {});
          return (
            <RadioGroup.Root
              ref={choices}
              size="2"
              className="seo-share-fallback"
              aria-labelledby={field.labelId}
              aria-describedby={describedBy}
              value={identity.share_fallback}
              disabled={field.disabled}
              onValueChange={(value) => edit('identity.share_fallback', value)}
            >
              <RadioGroup.Item value="card" onFocus={choose('card')} {...at('card')}>
                Make one from the title
              </RadioGroup.Item>
              {identity.share_fallback === 'card' && identity.default_image && (
                // Kept from "Use this image": still shared when a title
                // can't be drawn, so said, and removable, here.
                <div className="seo-share-fallback-image seo-share-fallback-kept">
                  <span>Pages whose title can't be drawn share {siteImage ? `“${siteImage.name}”` : "the site's image"}.</span>
                  {!field.disabled && (
                    <Btn
                      variant="ghost"
                      aria-label="Remove the site's image"
                      onClick={() => {
                        edit('identity.default_image', '');
                        // The line goes with the image; focus stays on the choice.
                        requestAnimationFrame(() => choices.current?.querySelector<HTMLElement>('[role="radio"][data-state="checked"]')?.focus());
                      }}
                    >
                      Remove
                    </Btn>
                  )}
                </div>
              )}
              <RadioGroup.Item value="image" onFocus={choose('image')} {...at('image')}>
                Use this image
              </RadioGroup.Item>
              {identity.share_fallback === 'image' && (
                <div className="seo-share-fallback-image" data-reveal-end="">
                  <ImageRow
                    describedBy={field.message ? errorId : undefined}
                    image={siteImage}
                    name={identity.default_image ? undefined : 'No image chosen'}
                    noun="site image"
                    disabled={field.disabled}
                    minWidth={600}
                    share
                    chosen={identity.default_image ? { media: identity.default_image } : undefined}
                    onPick={(picked) => 'media' in picked && edit('identity.default_image', picked.media)}
                  />
                  {field.message && (
                    // With the row that needs the action.
                    <Guide id={errorId} tone="error" role="alert">
                      {field.message}
                    </Guide>
                  )}
                </div>
              )}
              <RadioGroup.Item value="none" onFocus={choose('none')} {...at('none')}>
                No image
              </RadioGroup.Item>
            </RadioGroup.Root>
          );
        }}
      </Field>

      <Field scope="site" path="identity.logo" label="Logo" group>
        {(field) => (
          <ImageRow
            describedBy={field.describedBy}
            image={logo}
            thumb={themeLogo ?? undefined}
            name={identity.logo ? undefined : themeLogo ? 'From your theme' : 'No logo'}
            note={logoNote({ own: !!identity.logo, theme: !!themeLogo, svg, size: logo })}
            noun="logo"
            disabled={field.disabled}
            minWidth={112}
            chosen={identity.logo ? { media: identity.logo } : undefined}
            onPick={(picked) => 'media' in picked && edit('identity.logo', picked.media)}
            onClear={() => edit('identity.logo', '')}
          />
        )}
      </Field>

      {made && (
        <Field scope="site" path="identity.colour" label="Colour" group>
          {(field) => (
            <div className="seo-image-row">
              <span className="seo-swatch" style={{ background: drawn?.colour }} aria-hidden />
              <div className="seo-image-name">
                <div>{colourWords(identity.colour, drawn)}</div>
                {/* Without cards, edits change nothing in the sample. */}
                {identity.share_fallback !== 'card' && <small>With the choice above, only your site icon uses it.</small>}
              </div>
              {!field.disabled && (
                <div className="seo-image-actions">
                  <Btn variant="soft" aria-label="Change colour" aria-describedby={field.describedBy} onClick={() => openSheet({ kind: 'colour' })}>
                    Change
                  </Btn>
                </div>
              )}
            </div>
          )}
        </Field>
      )}

    </>
  );
}

/** The colour's Change sheet: from the logo, or a colour of the site's own. */
export function ColourSheet(props: { onClose(): void }) {
  const { state, dispatch, locked } = useApp();
  const { colour } = state.edits.site.identity;
  const drawn = useSample('page', 'card');
  const [typed, setTyped] = useState(colour);
  const [refused, setRefused] = useState(false);
  // Choosing to set a colour changes nothing until one is entered: the field
  // starts at the colour cards have now.
  const [own, setOwn] = useState(colour !== '');
  const inputId = useId();
  const errorId = useId();
  const set = (value: string) => value !== colour && dispatch({ type: 'edit', scope: 'site', path: 'identity.colour', value });
  const pick = (value: string) => {
    setOwn(value === 'own');
    if (value === 'own') {
      setTyped(typed || drawn?.colour || '#22252C');
    } else {
      setRefused(false);
      set('');
    }
  };
  const take = (value: string) => {
    setTyped(value);
    const ok = /^#[0-9a-f]{6}$/i.test(value);
    setRefused(!ok);
    if (ok) {
      set(value.toUpperCase());
    }
  };
  return (
    <Sheet title="Colour" onClose={props.onClose} focusTitle>
      <SampleImage sample={drawn} label="Sample of a shared link: a page without an image" />
      <p className="seo-quiet" role="status">
        {drawn ? contrastText(drawn, colour) : ''}
      </p>
      <RadioGroup.Root
        size="2"
        className="seo-share-fallback"
        aria-label="Colour"
        value={own ? 'own' : 'logo'}
        disabled={locked.site}
        onValueChange={(value) => pick(value)}
      >
        {/* Arrows select as well as move, as in Sharing. */}
        <RadioGroup.Item value="logo" onFocus={() => own && pick('logo')}>
          {state.edits.site.identity.logo || state.server?.share?.theme_logo ? 'Pick it from the logo' : 'Neutral'}
        </RadioGroup.Item>
        <RadioGroup.Item value="own" onFocus={() => !own && pick('own')}>
          Choose a colour
        </RadioGroup.Item>
      </RadioGroup.Root>
      {own && (
        <div className="seo-share-colour">
          <input
            type="color"
            aria-label="Colour picker"
            // While the code typed is not one, the colour saving keeps.
            value={(/^#[0-9a-f]{6}$/i.test(typed) ? typed : colour || drawn?.colour || '#000000').toLowerCase()}
            disabled={locked.site}
            onChange={(event) => take(event.target.value)}
          />
          <label htmlFor={inputId} className="seo-visually-hidden">
            Colour code
          </label>
          <input
            id={inputId}
            className="seo-input"
            spellCheck={false}
            value={typed}
            disabled={locked.site}
            aria-invalid={refused || undefined}
            aria-describedby={refused ? errorId : undefined}
            onChange={(event) => take(event.target.value.trim())}
          />
        </div>
      )}
      {own && refused && (
        <Guide id={errorId} tone="error" role="alert">
          Use a colour code like #0F8A7E. Until you do, saving keeps {colour || 'the current colour'}.
        </Guide>
      )}
    </Sheet>
  );
}
