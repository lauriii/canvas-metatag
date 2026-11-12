import { CheckIcon, Cross2Icon, ImageIcon } from '@radix-ui/react-icons';
import {
  Button,
  Card,
  Flex,
  IconButton,
  Skeleton,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';

import { useApp } from '../App';
import type { ShownImage } from '../model';
import type { MediaItem } from '../types';

/** What the picker returned for images chosen in this session, by UUID: shown before the server knows. */
export const PICKED: Record<string, ShownImage> = {};

const kilobytes = (bytes: number) =>
  bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function Thumb(props: { src?: string; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <span
      className="seo-thumb"
      style={props.size ? { width: props.size, height: props.size } : undefined}
    >
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

/**
 * The image a setting uses, with the inline picker under it. The thumbnail
 * and the name come with the image from the server, also for an inherited one.
 */
export function ImageRow(props: {
  describedBy?: string;
  image: ShownImage | null;
  /** What the row says without an image. */
  empty: string;
  disabled?: boolean;
  /** Images narrower than this are dimmed and marked "small". */
  minWidth: number;
  /** The UUID stored here, when one is. */
  chosen?: string;
  /** Template scope: the content type's image fields. */
  fields?: { value: string; label: string }[];
  onPick(value: string): void;
  /** Site scope: a chosen image can be removed again. */
  onClear?(): void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const { image } = props;
  const close = () => {
    setOpen(false);
    // Back to the row.
    requestAnimationFrame(() => button.current?.focus());
  };
  return (
    <div className="seo-image">
      <Flex align="center" gap="3" className="seo-image-row">
        <Thumb src={image?.thumb} />
        <Flex direction="column" gap="1" align="start" minWidth="0">
          {image ? (
            // A long file name is cut; its size always shows.
            <Text as="div" size="2" className="seo-image-text">
              <span title={image.name}>{image.name}</span>
              <span>
                {'\u00a0· ' +
                  [
                    `${image.width} × ${image.height}`,
                    ...(image.bytes ? [kilobytes(image.bytes)] : []),
                  ].join(' · ')}
              </span>
            </Text>
          ) : (
            <Text as="div" size="2" className="seo-wrap">
              {props.empty}
            </Text>
          )}
          {!props.disabled && (
            <Flex gap="3" align="center">
              <Button
                ref={button}
                data-focus
                aria-describedby={props.describedBy}
                size="1"
                variant="soft"
                color="gray"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
              >
                {image ? 'Choose another' : 'Choose an image'}
              </Button>
              {props.onClear && props.chosen && (
                <Button
                  size="1"
                  variant="ghost"
                  color="gray"
                  onClick={() => {
                    props.onClear!();
                    // The button goes with the image; focus stays on the row.
                    requestAnimationFrame(() => button.current?.focus());
                  }}
                >
                  Remove
                </Button>
              )}
            </Flex>
          )}
        </Flex>
      </Flex>
      {open && (
        <Picker
          minWidth={props.minWidth}
          chosen={props.chosen}
          fields={props.fields}
          onPick={(value) => {
            props.onPick(value);
            close();
          }}
          onClose={close}
        />
      )}
    </div>
  );
}

/** An inline panel, not a second dialog: search, 24 at a time, newest first. There is no upload. */
function Picker(props: {
  minWidth: number;
  chosen?: string;
  fields?: { value: string; label: string }[];
  onPick(value: string): void;
  onClose(): void;
}) {
  const { api } = useApp();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [more, setMore] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const page = useRef(0);
  // The page a failed request asked for: "Try again" asks for it again.
  const failed = useRef(0);
  const request = useRef(0);
  const search = useRef<HTMLInputElement>(null);

  const load = (next: number) => {
    const mine = ++request.current;
    setPhase('loading');
    api.getMedia(query.trim(), next).then(
      (result) => {
        if (mine !== request.current) {
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
        if (mine === request.current) {
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
  // Bring the whole panel into view once its first thumbnails are in.
  const panel = useRef<HTMLDivElement>(null);
  const shown = useRef(false);
  useEffect(() => {
    if (!shown.current && phase !== 'loading') {
      shown.current = true;
      panel.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [phase]);

  return (
    <Card
      ref={panel}
      className="seo-picker"
      mt="3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          props.onClose();
        }
      }}
    >
      <Flex gap="2" align="center" mb="3">
        <TextField.Root
          ref={search}
          size="2"
          placeholder="Search images…"
          aria-label="Search images"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ flex: 1 }}
        />
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          aria-label="Close image picker"
          onClick={props.onClose}
        >
          <Cross2Icon aria-hidden />
        </IconButton>
      </Flex>
      {props.fields && props.fields.length > 0 && (
        <Flex gap="2" wrap="wrap" mb="3">
          {props.fields.map((field) => (
            <Button
              key={field.value}
              size="1"
              variant="soft"
              onClick={() => props.onPick(field.value)}
            >
              Use a field: {field.label}
            </Button>
          ))}
        </Flex>
      )}
      <div className="seo-picker-grid" aria-busy={phase === 'loading'}>
        {items.map((item) => {
          const small = item.width < props.minWidth;
          const size = `${item.width} × ${item.height}`;
          return (
            <button
              key={item.uuid}
              type="button"
              className="seo-picker-item"
              aria-pressed={item.uuid === props.chosen}
              aria-label={`${item.name}, ${size}${small ? ', small' : ''}`}
              data-small={small || undefined}
              onClick={() => {
                PICKED[item.uuid] = item;
                props.onPick(item.uuid);
              }}
            >
              <Thumb src={item.thumb} />
              {item.uuid === props.chosen && (
                <span className="seo-picker-mark">
                  <CheckIcon aria-hidden />
                </span>
              )}
              {small && <span className="seo-picker-small">small</span>}
              <span className="seo-picker-name">{item.name}</span>
              <span className="seo-picker-size">{size}</span>
            </button>
          );
        })}
        {phase === 'loading' &&
          items.length === 0 &&
          [0, 1, 2, 3].map((index) => <Skeleton key={index} height="96px" />)}
      </div>
      {phase === 'ready' && items.length === 0 && (
        <Text as="p" size="1" color="gray">
          No images found. To use a new image, add it as the page image in Page
          data, or upload it in Content › Media.
        </Text>
      )}
      {phase === 'error' && (
        <Flex align="center" gap="3">
          <Text as="p" size="1" color="gray">
            The images couldn't be loaded.
          </Text>
          <Button size="1" variant="ghost" onClick={() => load(failed.current)}>
            Try again
          </Button>
        </Flex>
      )}
      {more && phase !== 'error' && (
        <Flex justify="end" mt="2">
          <Button
            size="1"
            variant="ghost"
            loading={phase === 'loading'}
            onClick={() => load(page.current + 1)}
          >
            Show more
          </Button>
        </Flex>
      )}
    </Card>
  );
}
