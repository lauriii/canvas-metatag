import {
  CheckIcon,
  Cross2Icon,
  ImageIcon,
  Link2Icon,
  LinkBreak2Icon,
  MagnifyingGlassIcon,
} from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';

import { useApp } from '../App';
import { rankImages } from '../checks';
import {
  imageSize,
  inSentence,
  shareWarning,
  sizeKnown,
  sizeText,
  type ShownImage,
} from '../model';
import type { MediaItem, Value } from '../types';
import { keyOf, sameValue } from '../values';
import { Btn, IconBtn, Sk } from './ui';

/** What the picker returned for images chosen in this session, by UUID: shown before the server knows. */
export const PICKED: Record<string, ShownImage> = {};

export function Thumb(props: { src?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <span className="seo-thumb">
      {props.src && props.src !== broken ? (
        <img
          src={props.src}
          alt=""
          loading="lazy"
          onError={() => setBroken(props.src!)}
        />
      ) : (
        <ImageIcon aria-hidden />
      )}
    </span>
  );
}

/** A file name keeps its end in sight: "standing-desk-by-the-win…_hero-01.jpg". */
export function ImageName(props: { name: string }) {
  const { name } = props;
  return /^\S+\.[a-z0-9]{2,5}$/i.test(name) && name.length > 24 ? (
    <span className="seo-midcut" title={name}>
      <span>{name.slice(0, -12)}</span>
      <span>{name.slice(-12)}</span>
    </span>
  ) : (
    <>{name}</>
  );
}

/** What the Choose image sheet needs from the row that opened it. */
export interface ImageRequest {
  /** Images narrower than this say "Too small". */
  minWidth: number;
  /**
   * A chosen image links share: judged by what sharing does with it (shared
   * whole from 200 × 200 up, skipped over 24 megapixels), not by minWidth.
   */
  share?: boolean;
  /** The value stored here, when one is. */
  chosen?: Value;
  /** Template scope: the content type's image fields, as links. */
  fields?: { value: Value; label: string; image?: ShownImage | null }[];
  onPick(value: Value): void;
}

/**
 * The image a setting uses: a thumbnail, its name and size, Change and,
 * where an image can be taken away, Remove.
 */
export function ImageRow(
  props: ImageRequest & {
    describedBy?: string;
    image: ShownImage | null;
    /** In the buttons' names: "image", "logo", "default image". */
    noun?: string;
    /** The row's name line, instead of the image's: "From each Article's Hero image field". */
    name?: string;
    /**
     * Where the image comes from, as a box's tag says it, above the image's
     * name: a link ("Poster › Image") or the default it follows.
     */
    tag?: { text: string; look: 'linked' | 'default' | 'broken' };
    /** Instead of the image's name: why the link gives none ("Hidden from visitors for this event"). */
    state?: string;
    /** No thumbnail: a preview above shows the picture. */
    thumbless?: boolean;
    /** With no image: a picture of what is used instead (a theme's logo). */
    thumb?: string;
    /** A last line: what is shared without an image ("Events without one share…"). */
    note?: string;
    /** In place of the file's size and weight: what links get ("1200 × 630"). */
    size?: string;
    disabled?: boolean;
    onClear?(): void;
    /** Removes the link, as a box's ×. */
    onUnlink?(): void;
  },
) {
  const { openSheet } = useApp();
  const button = useRef<HTMLButtonElement>(null);
  const { image, noun = 'image' } = props;
  // A row that names where its image comes from changes only what is chosen.
  const change = props.thumbless ? !!props.chosen : !!image;
  return (
    <div className="seo-image-row">
      {props.thumbless ? null : image || props.thumb ? (
        <Thumb src={image?.thumb ?? props.thumb} />
      ) : (
        <span className="seo-thumb" data-empty="">
          <ImageIcon aria-hidden />
        </span>
      )}
      {props.tag ? (
        // As a box: its source over its value; the name over its size, as at every scope.
        <div className="seo-image-name" data-tagged="">
          <span className="seo-image-tag" data-look={props.tag.look} title={props.tag.text}>
            {props.tag.look === 'broken' ? <LinkBreak2Icon aria-hidden /> : props.tag.look === 'linked' ? <Link2Icon aria-hidden /> : null}
            <span dir="auto">{props.tag.text}</span>
          </span>
          {props.state !== undefined ? (
            // '' when the field's note says why it is empty.
            props.state && <div data-state="">{props.state}</div>
          ) : (
            <div title={image?.name}>{image ? <ImageName name={image.name} /> : 'No image'}</div>
          )}
          {/* The preview above shows the picture, and its size where it counts. */}
          {props.state === undefined && image && !props.thumbless && <small>{props.size ?? imageSize(image)}</small>}
          {props.note && <small>{props.note}</small>}
        </div>
      ) : (
        <div className="seo-image-name">
          <div title={props.name ?? image?.name}>
            {props.name ?? (image ? <ImageName name={image.name} /> : 'No image')}
          </div>
          {image &&
            (props.name ? (
              <small className="seo-image-meta">
                <span>
                  <ImageName name={image.name} />
                </span>
                <span>&nbsp;· {props.size ?? imageSize(image)}</span>
              </small>
            ) : (
              <small>{props.size ?? imageSize(image)}</small>
            ))}
          {props.note && <small>{props.note}</small>}
        </div>
      )}
      {!props.disabled && (
        <div className="seo-image-actions">
          <Btn
            ref={button}
            data-focus
            variant="soft"
            // The name starts with the words shown (Label in Name).
            aria-label={change ? `Change ${noun}` : noun === 'image' ? 'Choose image' : `Choose image for the ${noun}`}
            aria-describedby={props.describedBy}
            onClick={() =>
              openSheet({
                kind: 'image',
                request: {
                  minWidth: props.minWidth,
                  share: props.share,
                  chosen: props.chosen,
                  fields: props.fields,
                  onPick: props.onPick,
                },
              })
            }
          >
            {change ? 'Change' : 'Choose image'}
          </Btn>
          {props.onUnlink && (
            <IconBtn label={`Unlink ${noun}`} data-unlink="" onClick={() => {
              props.onUnlink!();
              // The × goes with the link; focus stays on the row.
              requestAnimationFrame(() => button.current?.focus());
            }}>
              <Cross2Icon aria-hidden />
            </IconBtn>
          )}
          {props.onClear && props.chosen && 'media' in props.chosen && (
            <Btn
              variant="ghost"
              aria-label={`Remove ${noun}`}
              onClick={() => {
                props.onClear!();
                // The button goes with the image; focus stays on the row.
                requestAnimationFrame(() => button.current?.focus());
              }}
            >
              Remove
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

/** Search, 24 at a time, newest first. There is no upload. */
export function ImageSheet(props: { request: ImageRequest; onDone(): void }) {
  const { api, state } = useApp();
  const { request } = props;
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [more, setMore] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const page = useRef(0);
  // The page a failed request asked for: "Try again" asks for it again.
  const failed = useRef(0);
  const call = useRef(0);
  const search = useRef<HTMLInputElement>(null);
  const target = state.server?.target;

  const load = (next: number) => {
    const mine = ++call.current;
    setPhase('loading');
    api.getMedia(query.trim(), next).then(
      (result) => {
        if (mine !== call.current) {
          return;
        }
        page.current = next;
        setItems((shown) =>
          next === 0 ? result.items : [...shown, ...result.items],
        );
        setMore(result.more);
        setPhase('ready');
      },
      () => {
        if (mine === call.current) {
          failed.current = next;
          setPhase('error');
        }
      },
    );
  };

  // The first page, and again 300 ms after the search text changes.
  const first = useRef(true);
  useEffect(() => {
    const timer = setTimeout(() => load(0), first.current ? 0 : 300);
    first.current = false;
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  useEffect(() => search.current?.focus({ preventScroll: true }), []);

  const pick = (value: Value) => {
    request.onPick(value);
    props.onDone();
  };
  const chosen = request.chosen && 'media' in request.chosen ? request.chosen.media : undefined;
  const sorted = rankImages(items, state.facts?.images ?? [], Object.keys(PICKED));

  return (
    <>
      <div className="seo-input-wrap">
        <MagnifyingGlassIcon aria-hidden />
        <input
          ref={search}
          type="search"
          className="seo-input"
          dir="auto"
          placeholder="Search images"
          aria-label="Search images"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {request.fields && request.fields.length > 0 && (
        <>
          <p className="seo-subhead">From each {target?.label ?? 'page'}</p>
          {request.fields.map((field) => (
            <button
              key={keyOf(field.value)}
              type="button"
              className="seo-fieldpick"
              aria-label={`Use ${field.label}`}
              aria-pressed={sameValue(request.chosen, field.value)}
              onClick={() => pick(field.value)}
            >
              {field.image ? (
                <Thumb src={field.image.thumb} />
              ) : (
                <span>
                  <ImageIcon aria-hidden />
                </span>
              )}
              <span>
                <b>{field.label}</b>
                {field.image && (
                  <small aria-hidden>
                    This {target ? inSentence(target.label) : 'page'}:{' '}
                    {field.image.name} ·{' '}
                    {sizeText(field.image)}
                  </small>
                )}
              </span>
              {sameValue(request.chosen, field.value) && <CheckIcon aria-hidden />}
            </button>
          ))}
          <p className="seo-subhead">Media library</p>
        </>
      )}
      <div className="seo-tiles" aria-busy={phase === 'loading'}>
        {sorted.map((item) => {
          const warn = request.share ? shareWarning(item) : sizeKnown(item) && item.width < request.minWidth ? 'Too small' : '';
          const size = sizeText(item);
          return (
            <button
              key={item.uuid}
              type="button"
              className="seo-tile"
              aria-pressed={item.uuid === chosen}
              aria-description={`${size}${warn ? `, ${warn.toLowerCase()}` : ''}`}
              onClick={() => {
                PICKED[item.uuid] = item;
                pick({ media: item.uuid });
              }}
            >
              <span className="seo-tile-image">
                <Thumb src={item.thumb} />
                {item.uuid === chosen && (
                  <span className="seo-tile-badge">
                    <CheckIcon aria-hidden width="12" height="12" />
                  </span>
                )}
              </span>
              <b>{item.name}</b>
              {warn ? <small data-warn="" aria-hidden>{warn}</small> : <small aria-hidden>{size}</small>}
            </button>
          );
        })}
        {phase === 'loading' &&
          items.length === 0 &&
          [0, 1, 2].map((index) => (
            <span key={index}>
              <Sk w="100%" h={72} />
              <Sk w="70%" h={12} mt={8} />
            </span>
          ))}
      </div>
      {phase === 'ready' && items.length === 0 && (
        <p className="seo-sheet-intro">
          No images found. To use a new image, add it to the media library
          first.
        </p>
      )}
      {phase === 'error' && (
        <p className="seo-sheet-intro">
          The images couldn't be loaded.{' '}
          <Btn variant="ghost" accent onClick={() => load(failed.current)}>
            Try again
          </Btn>
        </p>
      )}
      {more && phase !== 'error' && (
        <Btn
          className="seo-btn seo-more"
          size={32}
          aria-disabled={phase === 'loading'}
          onClick={() => phase !== 'loading' && load(page.current + 1)}
        >
          Show more
        </Btn>
      )}
    </>
  );
}
