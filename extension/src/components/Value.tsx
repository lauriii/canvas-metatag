import {
  ChevronDownIcon,
  Cross2Icon,
  Link2Icon,
  LinkBreak2Icon,
} from '@radix-ui/react-icons';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { useApp } from '../App';
import {
  dateText,
  getPath,
  inSentence,
  setPath,
  wellFormed,
} from '../model';
import type { Kind, Scope, SeoValues, Value } from '../types';
import {
  type Entry,
  FOLD,
  type Lookup,
  type Shown,
  brokenWhy,
  entriesFor,
  foldLabel,
  kindReason,
  levelOf,
  resolve,
  sameValue,
  rowOf,
  tagOf,
  tree,
} from '../values';
import { Field, type FieldOptions, type FieldParts } from './Field';
import { LinkMenu, type MenuItem } from './LinkMenu';
import { Btn, IconBtn } from './ui';

/** What a typed input gets from its field. */
export interface InputProps {
  id: string;
  describedBy?: string;
  invalid: boolean;
  disabled: boolean;
  /** The typed text; '' for none. */
  value: string;
  /** Typed text, or undefined to store nothing. */
  set(text: string | undefined): void;
  /** Alt+Down and `{` in an empty input open the link menu. */
  onKeyDown(event: KeyboardEvent<HTMLElement>): void;
}

/** A value as the dialog shows it at rest: dates in words. */
export const shownText = (shown: Shown, kind: Kind) =>
  kind === 'date' && shown.status === 'ok' ? dateText(shown.text) : shown.text;

/**
 * The words for a link that gives nothing for the previewed item. `item`:
 * hidden through a reference, for this item only.
 */
export function stateWords(status: Shown['status'], type: string, broken = 'no longer exists', item = false): string {
  return {
    ok: '',
    empty: `Empty for this ${type}`,
    hidden: item ? `Hidden from visitors for this ${type}` : 'Hidden from visitors',
    broken: broken[0].toUpperCase() + broken.slice(1),
    none: `No ${type} to preview`,
  }[status];
}

/** A sentence that ends once: a value may end with its own mark. */
const sentence = (text: string) => (/[.!?…。！？]["'”’)\]]*$/u.test(text) ? text : `${text}.`);

/** What unlinking turns a value of a kind into. */
const UNLINKED: Record<Kind | 'choice', string> = {
  text: 'Type a value instead',
  address: 'Type an address instead',
  number: 'Type a number instead',
  date: 'Enter a date instead',
  image: 'Use the default image',
  choice: 'Choose an option instead',
};

/** The rows of a link menu for a filter and level: entries, levels and the fold. */
export function menuRows(
  entries: Entry[],
  kind: Kind,
  filter: string,
  level: string | null,
  toItem: (entry: Entry, deep: boolean) => MenuItem,
): MenuItem[] {
  return tree(entries, level, filter).map((row) =>
    row.type === 'entry'
      ? toItem(row.entry, row.deep)
      : row.level === FOLD
        ? { key: FOLD, label: foldLabel(entries.filter((entry) => levelOf(entry) === FOLD), kind), group: '', level: FOLD, quiet: true }
        : { key: `level:${row.level}`, label: row.level, sub: `${row.count} ${row.count === 1 ? 'field' : 'fields'}`, group: row.group, level: row.level },
  );
}

/** The level a menu opens at: the one that holds the current entry. */
const startOf = (entries: Entry[], current: Value | undefined) => {
  const entry = current && entries.find((one) => sameValue(one.value, current));
  return entry ? levelOf(entry) : null;
};

/** Options of a value that may be linked. */
export interface LinkOptions {
  path: string;
  label: string;
  kind: Kind;
  /** Linking is offered here. */
  linkable: boolean;
  /** Template scope: the default a value that is not set follows, shown as a box. */
  byDefault?: Value | null;
  /** What the default gives, when it is not a value of its own ("Same as description"). */
  defaultWords?: { tag: string; text: string };
  /** What happens without the link, in a clause: "its Title is used". */
  instead?: string;
  /** The image sheet, for "Choose from the media library…". */
  library?(): void;
  /** The typed input is a text input: a printable key on the box starts it. */
  typing?: boolean;
  /** A choice detail: its options. */
  choices?: string[];
  /** What the value is resolved against, when not the view's. */
  lookup?: Lookup;
}

/** The link button, the menu and the box of one value. */
function useLink(options: LinkOptions) {
  const { state, dispatch, view, locked, jump } = useApp();
  const server = state.server!;
  // None in Site with no page in context: the title there links nothing.
  const target = server.target ?? { scope: 'page' as const, label: 'Page' };
  const lookup = options.lookup ?? view!.lookup;
  const template = target.scope === 'template';
  const type = template ? inSentence(target.label) : 'page';
  const { path, kind, label } = options;
  const value = getPath(state.edits.target, path) as Value | undefined;
  const linked = !!value && !('text' in value) && !(kind === 'image' && 'media' in value);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [seed, setSeed] = useState('');
  const [said, setSaid] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const boxButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const linkButton = useRef<HTMLButtonElement>(null);
  const disabled = locked.target;
  // A template's value, and a page's value that may be linked, follows its
  // default while nothing is set: shown as a box.
  const byDefault = !value && (template || options.linkable) ? options.byDefault : null;
  const showBox = kind !== 'image' && !editing && (linked || !!byDefault || (!value && !!options.defaultWords && template));

  // What the box shows: the link's, or the default's.
  const shownValue = linked ? value : (byDefault ?? undefined);
  const shown: Shown = shownValue
    ? resolve(shownValue, kind, lookup)
    : lookup.resolvable
      ? { status: 'ok', value: options.defaultWords?.text ?? '', text: options.defaultWords?.text ?? '', image: null }
      : { status: 'none', value: '', text: '', image: null };
  const source = shownValue ? tagOf(shownValue, lookup, path) : (options.defaultWords?.tag ?? '');
  // A default is named as one; its source only where it is not the field.
  const tag = linked ? source : source === label ? 'Default' : `Default · ${source}`;
  const group = shownValue && 'source' in shownValue ? `${target.label} › ` : '';
  // What a default is, in words: "each event's title", "the site name".
  const defaultName =
    shownValue && 'fact' in shownValue
      ? shownValue.fact === 'site'
        ? 'the site name'
        : `${template ? `each ${type}'s` : `the ${type}'s`} ${source.toLowerCase()}`
      : `the ${source.toLowerCase()}`;
  const why = brokenWhy(lookup.broken?.[path]?.reason, kind);
  // Hidden through a reference: for this item only.
  const item = !!rowOf(lookup, shownValue)?.hop;
  const valueText = shown.status === 'ok' ? shownText(shown, kind) : stateWords(shown.status, type, why, item);
  const unlinked = UNLINKED[options.choices ? 'choice' : kind];
  // The row that types a value instead of the default: "Type a title for
  // every Article", "Enter a date".
  const typeOwn = `${
    kind === 'date'
      ? 'Enter a date'
      : options.choices
        ? 'Choose an option'
        : `Type ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()}`
  }${template ? ` for every ${target.label}` : ''}`;

  const say = (text: string) => {
    setSaid('');
    requestAnimationFrame(() => setSaid(text));
  };
  const write = (next: Value | undefined, undo: string) =>
    dispatch({
      type: 'apply',
      scope: 'target',
      values: setPath<SeoValues>(state.edits.target, path, next),
      undo,
    });
  // At once, in the same task as the key: the next key reaches the input.
  const focusInput = () => {
    const input = document.getElementById(fieldId.current) as HTMLInputElement | null;
    input?.focus();
    input?.setSelectionRange?.(input.value.length, input.value.length);
  };
  const fieldId = useRef('');

  function openMenu(from: HTMLElement | null, filter = '') {
    opener.current = from;
    setSeed(filter);
    setMenu(true);
  }
  function pick(entry: { value: Value; full: string }) {
    if (disabled) {
      return;
    }
    // The box takes the next key at once, not when the menu has gone.
    flushSync(() => {
      write(entry.value, `Linked to ${entry.full}`);
      setEditing(false);
    });
    (kind === 'image' ? linkButton.current : boxButton.current)?.focus();
    setMenu(false);
    say(`${label} linked to ${entry.full}.`);
  }
  function unlink(typed?: string) {
    if (disabled) {
      return;
    }
    flushSync(() => {
      // A default left for an empty input changes nothing until something is typed.
      if (linked || typed !== undefined) {
        write(typed === undefined ? undefined : { text: typed }, linked ? 'Unlinked' : 'Typed');
      }
      setEditing(true);
    });
    setMenu(false);
    focusInput();
    if (linked) {
      say(`${label} unlinked.`);
    }
  }

  // "Link another field" in Checks: the field, then its menu.
  const handled = useRef(jump?.seq ?? 0);
  useEffect(() => {
    if (jump && jump.seq !== handled.current && jump.link && jump.field === path && jump.scope === 'target') {
      handled.current = jump.seq;
      requestAnimationFrame(() => openMenu(boxButton.current ?? linkButton.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.seq]);

  const entries = options.linkable ? entriesFor(path, kind, template ? 'template' : 'page', lookup, target.label, options.choices) : [];
  const current = linked ? value : byDefault ?? undefined;
  const toItem = (entry: Entry, deep: boolean): MenuItem => ({
    key: entry.key,
    label: deep ? entry.full : entry.label,
    sub:
      entry.disabled ??
      entry.note ??
      (entry.status === 'hidden'
        ? // Through a reference: other items give it.
          `Hidden from visitors for this ${type}`
        : entry.kind === 'image'
          ? entry.image?.name ?? stateWords(entry.status === 'ok' ? 'empty' : entry.status, type)
          : entry.shown
            ? entry.kind === 'date'
              ? dateText(entry.shown)
              : entry.shown
            : stateWords(entry.status === 'ok' ? 'empty' : entry.status, type)),
    subEmpty: !entry.shown && !entry.image,
    group: entry.group,
    disabled: entry.disabled,
    current: !!current && sameValue(entry.value, current),
    run: () => pick(entry),
  });
  const items = (filter: string, level: string | null): MenuItem[] => {
    const rows = menuRows(entries, kind, filter, level, toItem);
    if (level === null && filter.trim() === '') {
      if (linked) {
        rows.push({ key: '#unlink', label: 'Unlink', sub: unlinked, group: '', run: () => unlink() });
      } else if (byDefault && kind !== 'image') {
        rows.push({ key: '#own', label: typeOwn, sub: 'Instead of the default', group: '', run: () => unlink() });
      }
      if (options.library) {
        rows.push({ key: '#library', label: 'Choose from the media library…', group: '', run: () => {
          // The sheet returns focus to the field, not to a menu that is gone.
          flushSync(() => setMenu(false));
          linkButton.current?.focus();
          options.library!();
        } });
      }
    }
    return rows;
  };
  const boxed = showBox || (kind === 'image' && linked);
  const buttonName = boxed ? `Change the link for ${label}` : `Link ${label} to a field`;

  // One name, and the tooltip says it first.
  const button = options.linkable && (
    <IconBtn
      ref={linkButton}
      label={buttonName}
      tip={
        !boxed
          ? buttonName
          : `${buttonName} · ${
              !linked
                ? `Follows the default: ${defaultName}`
                : shown.status === 'broken'
                  ? `${tag} ${why}`
                  : `Linked to ${tag}`
            }`
      }
      data-link=""
      data-look={linked ? (shown.status === 'broken' ? 'broken' : 'linked') : 'unlinked'}
      // The box opens the same menu: one Tab stop per field.
      tabIndex={showBox ? -1 : undefined}
      aria-haspopup="dialog"
      aria-expanded={menu}
      onClick={(event) => openMenu(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.altKey && event.key === 'ArrowDown') {
          event.preventDefault();
          openMenu(event.currentTarget);
        }
      }}
    >
      {linked && shown.status === 'broken' ? <LinkBreak2Icon aria-hidden /> : <Link2Icon aria-hidden />}
    </IconBtn>
  );

  const menuNode = options.linkable && (
    <LinkMenu
      open={menu}
      onClose={() => setMenu(false)}
      box={box}
      opener={opener}
      id={menuId}
      name={`Link ${label}`}
      filterLabel="Find a field"
      typeLabel={target.label}
      items={items}
      start={startOf(entries, current)}
      seed={seed}
      levelTitle={(level) => (level === FOLD ? "Can't be linked here" : level)}
      empty={(filter) => `No field matches “${filter.trim()}”.`}
      readOnly={disabled}
    />
  );

  const said_ = shown.status === 'ok' ? sentence(`This ${type}: ${valueText}`) : sentence(valueText);
  const description = linked
    ? shown.status === 'broken'
      ? `Linked to ${source}, which ${why}. Each ${type} uses its default.`
      : `Linked to ${group}${source}. ${said_}`
    : `Follows the default: ${defaultName}. ${said_}`;

  /** The box that stands for a linked value, or one that follows its default. */
  const boxNode = (field: FieldParts & { describedBy?: string }, lines = 1, inline = false) => {
    fieldId.current = field.id;
    return (
      <div className="seo-linked" data-look={linked ? (shown.status === 'broken' ? 'broken' : 'linked') : 'default'} ref={box}>
        {/* A combobox, as a select's trigger is: named for the field, its
            value the text it shows. */}
        <button
          ref={boxButton}
          id={field.id}
          type="button"
          role="combobox"
          aria-controls={menu ? menuId : undefined}
          className="seo-linked-box"
          data-lines={lines}
          data-inline={inline || undefined}
          data-x={(linked && !disabled) || undefined}
          aria-labelledby={field.labelId}
          aria-describedby={[`${field.id}-said`, field.describedBy].filter(Boolean).join(' ')}
          aria-haspopup="dialog"
          aria-expanded={menu}
          onClick={(event) => openMenu(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.altKey && event.key === 'ArrowDown') {
              event.preventDefault();
              openMenu(event.currentTarget);
            } else if ((event.key === 'Backspace' || event.key === 'Delete') && !disabled) {
              event.preventDefault();
              unlink();
            } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey && !disabled) {
              event.preventDefault();
              if (options.typing) {
                // Typing on a box replaces it with typed text.
                unlink(event.key);
              } else {
                // A date, a choice: a key never writes a value that cannot
                // be one. It finds a field instead.
                openMenu(event.currentTarget, event.key);
              }
            }
          }}
        >
          <span className="seo-linked-tag" title={tag}>
            {!linked ? null : shown.status === 'broken' ? <LinkBreak2Icon aria-hidden /> : <Link2Icon aria-hidden />}
            {tag.includes(' › ') ? (
              // A path gives way from its start: the field it ends at stays.
              <>
                <span className="seo-linked-path" dir="auto">{tag.slice(0, tag.lastIndexOf(' › ') + 3)}</span>
                <span className="seo-linked-leaf" dir="auto">{tag.slice(tag.lastIndexOf(' › ') + 3)}</span>
              </>
            ) : (
              <span className="seo-linked-leaf" dir="auto">{tag}</span>
            )}
          </span>
          <span className="seo-linked-value" data-state={shown.status} dir={shown.status === 'ok' ? 'auto' : undefined} title={shown.status === 'ok' ? valueText : undefined}>
            {valueText}
          </span>
        </button>
        <span id={`${field.id}-said`} hidden>
          {description}
        </span>
        {linked && !disabled && (
          <IconBtn label={`Unlink ${label}`} data-unlink="" onClick={() => unlink()}>
            <Cross2Icon aria-hidden />
          </IconBtn>
        )}
        {menuNode}
      </div>
    );
  };

  /** Wraps a typed input: the menu hangs from it, and leaving it empty brings the default box back. */
  const inputNode = (field: FieldParts & { describedBy?: string }, render: (props: InputProps) => ReactNode) => {
    fieldId.current = field.id;
    const text = value && 'text' in value ? value.text : '';
    return (
      <div
        className="seo-typed"
        ref={box}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget) && !event.relatedTarget?.closest('.seo-menu')) {
            setEditing(false);
          }
        }}
      >
        {render({
          id: field.id,
          describedBy: field.describedBy,
          invalid: field.invalid,
          disabled: field.disabled,
          value: text,
          set: (next) => {
            setEditing(true);
            dispatch({ type: 'edit', scope: 'target', path, value: next === undefined || next === '' ? undefined : { text: wellFormed(next) } });
          },
          onKeyDown: (event) => {
            if (!options.linkable) {
              return;
            }
            const empty = (event.currentTarget as HTMLInputElement).value === '';
            if ((event.altKey && event.key === 'ArrowDown') || (event.key === '{' && empty)) {
              event.preventDefault();
              openMenu(event.currentTarget);
            }
          },
        })}
        {menuNode}
      </div>
    );
  };

  /** Under the field: what is used instead of a link that gives nothing. */
  const fallback = options.byDefault || options.defaultWords || kind === 'image'
    ? `each ${type} uses its default ${label.toLowerCase()}`
    : `the detail is left out for each ${type}`;
  const note: ReactNode = linked && shown.status === 'broken' ? (
    <>
      {`${tag} ${why}, so ${fallback}.`}
      {!disabled && (
        <Btn variant="ghost" size={24} data-own-line="" onClick={() => openMenu(boxButton.current)}>
          Link another field
        </Btn>
      )}
    </>
  ) : linked && (shown.status === 'empty' || shown.status === 'hidden') && options.instead ? (
    // The box (or the image row) says the state; this, what is used.
    shown.status === 'empty'
      ? `This ${type} has no ${tag}, so ${options.instead}.`
      : `So ${options.instead}.`
  ) : null;

  const live = (
    <span className="seo-visually-hidden" role="status">
      {said}
    </span>
  );

  /** An image row's first line: the link, or the default it follows. */
  const imageTag =
    kind !== 'image' || (value && !linked)
      ? undefined
      : linked
        ? { text: tag, look: shown.status === 'broken' ? ('broken' as const) : ('linked' as const) }
        : byDefault
          ? { text: tag, look: 'default' as const }
          : undefined;
  /** An image row's value line when the link gives nothing. */
  const imageState = linked && shown.status !== 'ok' ? stateWords(shown.status, type, why, item) : undefined;

  return { button, boxNode, inputNode, showBox, note, live, linked, shown, tag, value, openMenu, pick, unlink, entries, linkButton, menuNode, box, disabled, imageTag, imageState };
}

/** The plain typed input of a text value: one line, or several. */
export function TextInput(props: InputProps & { multiline?: boolean; placeholder?: string; lang?: string; required?: boolean; trailing?: ReactNode }) {
  const { multiline, placeholder, lang, required, trailing, value, set, ...rest } = props;
  return (
    <div className={trailing ? 'seo-template seo-has-trail' : 'seo-template'}>
      <textarea
        id={rest.id}
        rows={multiline ? 2 : 1}
        lang={lang}
        dir="auto"
        className="seo-input seo-textarea"
        data-multiline={multiline || undefined}
        spellCheck
        disabled={rest.disabled}
        placeholder={placeholder}
        aria-required={required || undefined}
        aria-invalid={rest.invalid || undefined}
        aria-describedby={rest.describedBy}
        value={value}
        onChange={(event) => {
          // Single-line values take line breaks as spaces.
          const text = multiline ? event.target.value : event.target.value.replace(/\s*[\r\n]+\s*/g, ' ');
          set(text);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !multiline) {
            event.preventDefault();
          }
          rest.onKeyDown(event);
        }}
      />
      {trailing && <div className="seo-trail">{trailing}</div>}
    </div>
  );
}

/**
 * A value field: typed text, or a box for a link and, at template scope, for
 * the default it follows. The link button sits by the label.
 */
export function ValueField(
  props: Omit<FieldOptions, 'scope'> &
    LinkOptions & {
      required?: boolean;
      missing?: string;
      info?: ReactNode;
      meter?: Parameters<typeof Field>[0]['meter'];
      onSuggest?(): void;
      after?: ReactNode;
      noStage?: boolean;
      note?: ReactNode;
      group?: boolean;
      /** Lines a box shows at rest. */
      lines?: number;
      /** A one-line value: its box is one control high, source before value. */
      oneLine?: boolean;
      /** The typed input: a text input unless given. */
      input?(props: InputProps): ReactNode;
      multiline?: boolean;
      placeholder?: string;
      trailing?: ReactNode;
      /** An image value: the row, instead of a box or input. */
      image?(field: FieldParts & { describedBy?: string }, link: ReturnType<typeof useLink>): ReactNode;
    },
) {
  const { state } = useApp();
  const link = useLink({ typing: !props.input, ...props });
  return (
    <Field
      {...props}
      scope="target"
      link={link.button}
      explain={link.note}
      note={props.note}
      group={props.group}
      // A linked box, and a linked image's row, has its own × to go back.
      noReset={(link.showBox || !!props.image) && link.linked && !link.disabled}
    >
      {(field) => (
        <>
          {props.image
            ? (
              <div className="seo-typed" ref={link.box}>
                {props.image(field, link)}
                {link.menuNode}
              </div>
            )
            : link.showBox
              ? link.boxNode(field, props.lines, props.oneLine)
              : link.inputNode(field, (input) =>
                  props.input ? props.input(input) : (
                    <TextInput
                      {...input}
                      multiline={props.multiline}
                      placeholder={props.placeholder}
                      lang={state.server?.langcode}
                      required={props.required}
                      trailing={props.trailing}
                    />
                  ),
                )}
          {link.live}
        </>
      )}
    </Field>
  );
}

/**
 * The ending of the title: a button that shows the separator and the ending
 * and opens the ending's menu.
 */
function Ending(props: { scope: Scope; disabled: boolean; wide?: boolean }) {
  const { state, dispatch, view, goTo, setFocusField } = useApp();
  const server = state.server!;
  const target = server.target;
  const template = props.scope === 'target' && target?.scope === 'template';
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const lookup = view!.lookup;
  const identity = state.edits.site.identity;
  const siteName = (props.scope === 'site' && identity.name.trim()) || lookup.facts.site?.value || '';
  const separator = props.scope === 'site' ? identity.separator.trim() : server.separator;
  const own = (props.scope === 'site' ? state.edits.site.values.title_end : state.edits.target.title_end) as Value | undefined;
  const site = (props.scope === 'site' ? undefined : server.site.values.title_end) as Value | undefined;
  const text = (value: Value | undefined): string =>
    !value || ('fact' in value && value.fact === 'site')
      ? siteName
      : resolve(value, 'text', lookup).text;
  // As texts(): an ending of its own that gives nothing for the item falls
  // back to the site's; "No ending" is the empty typed ending.
  const isNone = (value: Value | undefined) => !!value && 'text' in value && value.text === '';
  const ownText = own && !isNone(own) ? text(own) : '';
  const none = own ? isNone(own) || (ownText === '' && isNone(site)) : isNone(site);
  const shownEnd = none ? '' : ownText || text(site);
  // A linked ending that gives nothing for the item: the button still says
  // it is linked, and why the site's ending shows.
  const ownLink = own && 'source' in own ? resolve(own, 'text', lookup) : null;
  const fellBack =
    ownLink && ownLink.status !== 'ok' && target
      ? `Linked to ${tagOf(own!, lookup, 'title_end')}, ${stateWords(
          ownLink.status,
          inSentence(target.label),
          brokenWhy(lookup.broken?.title_end?.reason, 'text'),
          !!rowOf(lookup, own)?.hop,
        ).toLowerCase()}, so ${isNone(site) ? 'the title has no ending' : 'the site ending is used'}.`
      : null;
  const close = () => {
    setMenu(false);
    // Focus left with the menu: the preview no longer points at the ending.
    requestAnimationFrame(() => {
      if (document.activeElement !== box.current) {
        setFocusField((current) => (current === 'title_end' ? null : current));
      }
    });
  };
  const set = (value: Value | undefined, undo: string) => {
    flushSync(() =>
      props.scope === 'site'
        ? dispatch({ type: 'edit', scope: 'site', path: 'values.title_end', value })
        : dispatch({ type: 'apply', scope: 'target', values: setPath<SeoValues>(state.edits.target, 'title_end', value), undo }),
    );
    box.current?.focus();
    setMenu(false);
  };
  const what = props.scope === 'site' ? 'the site' : target?.scope === 'page' ? 'this page' : `every ${target?.label}`;
  // At template scope the type's text fields, in the link menu's levels;
  // nothing that does not fit is offered.
  const entries = template
    ? entriesFor('title_end', 'text', 'template', lookup, target!.label).filter((one) => one.group !== 'Page' && !one.disabled)
    : [];
  const folded = (one: string) => one.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  const items = (filter: string, level: string | null): MenuItem[] => {
    const query = filter.trim();
    const fields = menuRows(entries, 'text', filter, level, (entry, deep) => ({
      key: entry.key,
      label: deep ? entry.full : entry.label,
      sub: entry.shown || stateWords(entry.status === 'ok' ? 'empty' : entry.status, inSentence(target!.label)),
      subEmpty: !entry.shown,
      group: target!.label,
      current: !!own && sameValue(own, entry.value),
      run: () => set(entry.value, `Linked to ${entry.full}`),
    }));
    if (level !== null) {
      return fields;
    }
    const options: MenuItem[] = [];
    if (own && !none && !('fact' in own && own.fact === 'site')) {
      options.push({ key: '#own', label: text(own) || tagOf(own, lookup, 'title_end'), sub: `Set for ${what}`, current: true, run: () => setMenu(false) });
    }
    if (props.scope === 'target') {
      const siteNone = !!site && 'text' in site && site.text === '';
      options.push({
        key: '#site',
        label: siteNone ? 'No ending' : text(site) || 'Site name',
        sub: 'Site default',
        current: !own,
        run: () => set(undefined, 'Ending reset'),
      });
    }
    if (props.scope === 'site' || (site && !('fact' in site))) {
      options.push({
        key: '#name',
        label: 'Site name',
        sub: siteName || 'The site has no name',
        current: props.scope === 'site' ? !own : !!own && 'fact' in own && own.fact === 'site',
        run: () => set(props.scope === 'site' ? undefined : { fact: 'site' }, 'Ending set to the site name'),
      });
    }
    options.push({ key: '#none', label: 'No ending', sub: 'The title ends with its main part', current: !!own && none, run: () => set({ text: '' }, 'No ending') });
    // What matches comes first; typing an ending of its own is the last row.
    return [
      ...options.filter((row) => !query || folded(`${row.label} ${row.sub ?? ''}`).includes(folded(query))),
      ...fields,
      ...(query ? [{ key: '#use', label: `Use “${query}” as the ending`, run: () => set({ text: query }, `Ending set to “${query}”`) }] : []),
    ];
  };

  return (
    <span
      className="seo-ending"
      data-wide={props.wide || undefined}
      // The ending and its menu (a portal, whose focus events bubble here):
      // the preview points at the ending, not at the main part.
      onFocus={(event) => {
        event.stopPropagation();
        setFocusField('title_end');
      }}
      onBlur={(event) => {
        event.stopPropagation();
        const next = event.relatedTarget;
        if (!(next && (event.currentTarget.contains(next) || next.closest('.seo-menu')))) {
          setFocusField((current) => (current === 'title_end' ? null : current));
        }
      }}
    >
      <button
        ref={box}
        type="button"
        className="seo-ending-btn"
        id={props.scope === 'site' ? 'seo-site-title-end' : undefined}
        // A jump to the site's ending lands here.
        data-focus={props.scope === 'site' || undefined}
        data-set={own !== undefined || undefined}
        aria-label={`Title ending: ${none ? 'No ending' : shownEnd || 'Site name'}`}
        aria-description={fellBack ?? (none ? 'The title ends with its main part.' : `Added after the separator ${separator}.`)}
        title={fellBack ?? undefined}
        aria-haspopup="dialog"
        aria-expanded={menu}
        onClick={(event) => {
          opener.current = event.currentTarget;
          setMenu(true);
        }}
        onKeyDown={(event) => {
          if (event.altKey && event.key === 'ArrowDown') {
            event.preventDefault();
            opener.current = event.currentTarget;
            setMenu(true);
          }
        }}
      >
        {fellBack && <Link2Icon aria-hidden className="seo-ending-link" data-look={ownLink?.status === 'broken' ? 'broken' : undefined} />}
        {!none && <span className="seo-ending-sep" aria-hidden>{separator}</span>}
        <span dir="auto">{none ? 'No ending' : shownEnd || 'Site name'}</span>
        <ChevronDownIcon aria-hidden />
      </button>
      <LinkMenu
        open={menu}
        onClose={close}
        box={box}
        opener={opener}
        name="Title ending"
        filterLabel={template ? 'Type an ending or find a field' : 'Type an ending'}
        typeLabel={target?.label ?? 'Page'}
        items={items}
        start={startOf(entries, own)}
        empty={(filter) => `No field matches “${filter.trim()}”.`}
        readOnly={props.disabled}
        // In Site the separator sits right below the title.
        footer={props.scope === 'site' ? undefined : (
          <>
            <span>
              The separator <b>{separator}</b> is set for the whole site.
            </span>
            {server.can.site && (
              <Btn
                variant="ghost"
                size={24}
                onClick={() => {
                  setMenu(false);
                  goTo({ scope: 'site', tab: 'defaults', field: 'identity.separator' });
                }}
              >
                Edit
              </Btn>
            )}
          </>
        )}
      />
    </span>
  );
}

/**
 * The title: one control in two parts, the main part and its ending. The
 * main part is typed text on a page and a value that may be linked on a
 * template; Site sets only the ending. Reset removes both.
 */
export function TitleField(
  props: {
    scope: Scope;
    meter?: Parameters<typeof Field>[0]['meter'];
    onSuggest?(): void;
    after?: ReactNode;
    trailing?: ReactNode;
    note?: ReactNode;
    /** What the main part shows while nothing is typed. */
    placeholder?: string;
  },
) {
  const { state, dispatch, locked } = useApp();
  const server = state.server!;
  const template = props.scope === 'target' && server.target?.scope === 'template';
  // Only the ending set: the aside names it, and what Reset goes back to.
  const endingOnly = state.edits.target.title === undefined && state.edits.target.title_end !== undefined;
  const link = useLink({
    path: 'title',
    label: 'Title',
    kind: 'text',
    linkable: template,
    byDefault: { fact: 'title' },
    instead: 'its Title is used',
    typing: true,
  });
  if (props.scope === 'site') {
    return (
      <Field
        scope="site"
        path="values.title_end"
        label="Title ending"
        group
        source="Every page"
        note={props.note}
      >
        {() => <Ending scope="site" disabled={locked.site} wide />}
      </Field>
    );
  }
  return (
    <Field
      scope="target"
      path="title"
      also={['title_end']}
      label="Title"
      source={
        endingOnly
          ? server.target?.scope === 'page'
            ? 'Ending set on this page'
            : `Ending set for every ${server.target?.label}`
          : undefined
      }
      resetTip={endingOnly ? 'the site ending' : undefined}
      resetWhat={endingOnly ? 'title ending' : undefined}
      link={link.button}
      meter={props.meter}
      onSuggest={props.onSuggest}
      after={props.after}
      explain={link.note}
      note={props.note}
      onReset={() =>
        dispatch({
          type: 'apply',
          scope: 'target',
          values: setPath<SeoValues>(setPath<SeoValues>(state.edits.target, 'title', undefined), 'title_end', undefined),
          undo: 'Reset',
          path: 'title',
        })
      }
    >
      {(field) => (
        <div className="seo-title-parts">
          <div className="seo-title-main">
            {link.showBox
              ? link.boxNode(field, 1, true)
              : link.inputNode(field, (input) => (
                  <TextInput
                    {...input}
                    placeholder={props.placeholder}
                    lang={server.langcode}
                    trailing={props.trailing}
                  />
                ))}
          </div>
          <Ending scope="target" disabled={locked.target} />
          {link.live}
        </div>
      )}
    </Field>
  );
}

export { kindReason };
