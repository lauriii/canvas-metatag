/**
 * One hand-added item as a form: what its search features need first.
 *
 * Head, verdicts, "Needed for ‹feature›" (an either-or need is one group with
 * one sentence), every other value in the text's order, what also helps,
 * and one search over every other detail. A detail that is an item points
 * at something on the page before it is described here.
 */
import { CheckCircledIcon, ChevronDownIcon, DotFilledIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { DropdownMenu, Switch } from '@radix-ui/themes';
import { Fragment, type ReactNode, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { kinds } from '../features';
import type { ExpectsSpec, SearchFeatures, Verdict } from '../types';
import { Btn as UiBtn } from '../components/ui';
import type { Path, Problem } from './doc';
import { Btn, controlOf, describeExpects, type LinkField, linkOf, Row } from './Row';
import { aType, detailLabel, expectsOf, project, sentence, typeLabel, typeNote, typesOf, type Band, type Item, type RowSpec } from './project';
import { itemTypeOf, type Target } from './sheet';
import { detailsOf, score, type Vocabulary } from './vocab';

export type { Target };

export interface ItemFormProps {
  item: Item;
  /** Where the item is in the text. */
  path: Path;
  rules: SearchFeatures;
  vocabulary: Vocabulary | null;
  verdicts: Verdict[];
  verdictText(verdict: Verdict): string;
  /** A fix offered with a verdict: "Make it a person". */
  verdictFix?(verdict: Verdict): { label: string; run(): void } | null;
  targets: Target[];
  readonly: boolean;
  /**
   * Added details: the type is fixed, and these values come from the page;
   * `nested`: objects the page gives, which details are added inside;
   * `added`: the details as written.
   */
  fixed?: {
    from: Record<string, { text: string; source: string; texts?: string[]; unused?: string }>;
    nested?: Record<string, { page: Item; list: boolean; from: Record<string, { text: string; source: string; texts?: string[]; unused?: string }> }>;
    added?: Item;
  };
  /** The key the switch from JSON lands on. */
  washed?: string | null;
  duplicate: string | null;
  onChange(path: Path, value: unknown): void;
  onMove(path: Path, index: number, by: -1 | 1): void;
  onCommit(removed?: string): void;
  onShow(path: Path): void;
  /** Points a value at an item described elsewhere: it becomes its own item. */
  onHoist(from: Path, to: Path): void;
  /** The main-thing switch, on a plain web page. */
  main?: { on: boolean; toggle(): void };
  /** Described inside another item: no head and no verdicts of its own. */
  nested?: boolean;
  /** The length of the top item's path: nesting is counted from it. */
  root?: number;
  /** Names the detail it is described under needs it to carry. */
  needs?: string[];
  /** The top item's label, and whether a search feature reads it: "Employer rating can't show with only a name". */
  top?: { label: string; feature: boolean };
  /** The item head's menu: Show in JSON, Change type, Leave out, Remove. */
  menu?: ReactNode;
  /** Copied from another language: the typed text to translate, by path. */
  translate?: Set<string>;
  /** At template scope: the fields values can be linked to. */
  linking?: { fields: LinkField[]; type: string; previewing: string; multilingual?: boolean };
  /** The site's zone. */
  zone: string;
  /** Opens "Add details to ‹name›" for one of the module's items, by short id; absent where it can't be opened. */
  onDetails?(node: string): (() => void) | null;
  /** The verdict box's title: "In search results, for Oak floor lamp". */
  verdictTitle?: string;
  /** The title of what the item's own needs serve: "Needed for Q&A". */
  needsTitle?: string;
  /** Changes the top item's type as the item menu's Change type does: with Undo. */
  onChangeType?(type: string): void;
  /** The text's problems: each row shows its own (Form only). */
  problems?: Problem[];
  onFix?(problem: Problem): void;
}

/** Value-like items: described in place, never "just a name". */
export const VALUE_TYPES = ['Rating', 'AggregateRating', 'EmployerAggregateRating', 'Offer', 'AggregateOffer', 'MonetaryAmount', 'PriceSpecification', 'UnitPriceSpecification', 'QuantitativeValue', 'PropertyValue', 'Duration', 'OpeningHoursSpecification', 'GeoCoordinates', 'PostalAddress', 'NutritionInformation', 'Answer', 'Question', 'HowToStep', 'ListItem'];

const VERDICT_ICON: Record<string, ReactNode> = {
  ready: <CheckCircledIcon aria-hidden />,
  complete: <CheckCircledIcon aria-hidden />,
  needs: <ExclamationTriangleIcon aria-hidden />,
};

/**
 * "In search results": one line per feature that reads the item. Without
 * one, a quiet line ("No search feature…"), or nothing with `quiet`.
 */
export function VerdictBox(props: { verdicts: Verdict[]; rules: SearchFeatures; text(verdict: Verdict): string; fix?(verdict: Verdict): { label: string; run(): void } | null; title?: string; quiet?: boolean }) {
  if (!props.verdicts.length) {
    return props.quiet ? null : <p className="seo-meta">No search feature. Search engines and other tools can still read it.</p>;
  }
  return (
    <div className="seo-cverdicts" role="group" aria-label={props.title ?? 'In search results'} data-fix={props.verdicts.some((verdict) => props.fix?.(verdict)) || undefined}>
      <p className="seo-cverdicts-title">{props.title ?? 'In search results'}</p>
      <ul>
        {props.verdicts.map((verdict) => {
          const feature = props.rules.features[verdict.feature ?? ''];
          const words = props.text(verdict);
          const confirm = verdict.verdict === 'ready' ? feature?.confirm?.[0] : undefined;
          const fix = props.fix?.(verdict);
          return (
            <li key={verdict.feature} data-verdict={verdict.verdict}>
              <span className="seo-cverdict-icon">{VERDICT_ICON[verdict.verdict] ?? <DotFilledIcon aria-hidden />}</span>
              <span className="seo-cverdict-name">{feature?.label ?? verdict.feature}</span>
              <span className="seo-cverdict-words">{words}</span>
              {(confirm || fix) && (
                <span className="seo-cverdict-more">
                  {confirm && <span className="seo-meta">{confirm}</span>}
                  {fix && (
                    <UiBtn variant="soft" size={24} onClick={fix.run}>
                      {fix.label}
                    </UiBtn>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A filter list: type search and Add a detail share it. */
export function FilterList<T>(props: {
  label: string;
  placeholder: string;
  options(query: string): { value: T; label: string; detail?: string; hint?: string; tag?: string; key: string }[];
  onPick(value: T, query: string): void;
  autoFocus?: boolean;
  initial?: string;
  /** Shown under the box when it is empty. */
  empty?: ReactNode;
  /** "14 types": what the count counts. */
  noun?: [string, string];
}) {
  const [query, setQuery] = useState(props.initial ?? '');
  const [active, setActive] = useState(0);
  // Closed until asked (typing, a click, ↓): it opens the same way every time,
  // and nothing below it moves under the pointer.
  const [open, setOpen] = useState(false);
  const id = useId();
  const options = props.options(query);
  const box = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const shown = open && options.length > 0;
  // A list that opens below the fold comes into view.
  useLayoutEffect(() => {
    if (shown && !props.autoFocus) listRef.current?.scrollIntoView({ block: 'nearest' });
  }, [shown, props.autoFocus]);
  const pick = (index: number) => {
    const option = options[index];
    if (option) {
      setQuery('');
      setOpen(false);
      props.onPick(option.value, query);
    }
  };
  const [one, many] = props.noun ?? ['result', 'results'];
  return (
    <div className="seo-filter">
      <label htmlFor={`${id}-box`} className="seo-crow-label">
        {props.label}
      </label>
      <input
        ref={box}
        id={`${id}-box`}
        className="seo-input"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined}
        aria-describedby={`${id}-hint`}
        placeholder={props.placeholder}
        autoFocus={props.autoFocus}
        data-focus="search"
        value={query}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((at) => Math.min(at + 1, options.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((at) => Math.max(at - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            pick(active);
          } else if (event.key === 'Escape' && (query || open)) {
            event.preventDefault();
            event.stopPropagation();
            if (query) setQuery('');
            else setOpen(false);
          }
        }}
      />
      {/* What an empty box offers sits above the suggestions: it stays put when they fold. */}
      {!query && props.empty}
      {open && options.length > 0 && (
        <ul ref={listRef} className="seo-filter-list" id={`${id}-list`} role="listbox" aria-label={props.label}>
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              aria-label={`${option.label}${option.tag ? `, ${option.tag}` : ''}, ${index + 1} of ${options.length}`}
              aria-describedby={option.detail ? `${id}-${index}-d` : undefined}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
            >
              <span className="seo-filter-label">
                <bdi>{option.label}</bdi>
                {option.tag && <span className="seo-filter-tag">{option.tag}</span>}
                {option.hint ? (
                  <span className="seo-filter-hint" data-code={/^[A-Z][A-Za-z]+$/.test(option.hint) || undefined}>
                    {option.hint}
                  </span>
                ) : null}
              </span>
              {option.detail && (
                <span className="seo-filter-detail" id={`${id}-${index}-d`}>
                  {option.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="seo-meta seo-filter-keys" id={`${id}-hint`}>
        {open && options.length > 0 ? `${options.length} ${options.length === 1 ? one : many} · ↑ ↓ move · ↵ choose` : ''}
      </p>
      <span className="seo-visually-hidden" role="status">
        {query ? `${options.length} ${options.length === 1 ? one : many}` : ''}
      </span>
    </div>
  );
}

/** Plumbing a module node carries that nobody adds details to. */
const PLUMBING = ['mainEntityOfPage', 'isPartOf', 'potentialAction', 'publisher', 'about', 'primaryImageOfPage', 'breadcrumb', 'inLanguage'];

/** The item's head, verdicts and bands. */
export function ItemForm(props: ItemFormProps) {
  const needs = props.needs;
  // Details added but not given a value yet: rows that write nothing.
  const [pending, setPending] = useState<string[]>([]);
  const shownItem = useMemo(() => {
    const extra = pending.filter((key) => !Object.prototype.hasOwnProperty.call(props.item, key));
    if (!extra.length) return props.item;
    const item: Item = Object.create(null);
    Object.assign(item, props.item);
    for (const key of extra) item[key] = undefined;
    return item;
  }, [props.item, pending]);
  const projection = useMemo(() => {
    const made = project(shownItem, props.rules, props.vocabulary, props.duplicate, needs, !props.fixed);
    return props.needsTitle ? { ...made, bands: made.bands.map((one) => (one.title === 'Needed' ? { ...one, title: props.needsTitle! } : one)) } : made;
  }, [shownItem, props.rules, props.vocabulary, props.duplicate, needs, props.fixed, props.needsTitle]);
  const type = projection.types[0] ?? '';
  const id = typeof props.item['@id'] === 'string' ? props.item['@id'] : null;
  const [added, setAdded] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  const mainId = useId();

  // A detail just added: its row's control takes focus.
  useLayoutEffect(() => {
    const key = focusNext.current;
    if (!key) return;
    focusNext.current = null;
    const row = root.current?.querySelector(`[data-row="${CSS.escape([...props.path, key].join('/'))}"]`);
    controlOf(row)?.focus();
    row?.scrollIntoView({ block: 'nearest' });
  });

  if (projection.locked) {
    return (
      <div className="seo-notice" role="note">
        <p>“{projection.locked}” appears twice. Fix it in JSON.</p>
        <UiBtn variant="soft" size={24} onClick={() => props.onShow([...props.path, projection.locked!])}>
          Show in JSON
        </UiBtn>
      </div>
    );
  }

  const drop = (key: string) => setPending((list) => list.filter((one) => one !== key));
  // Inside an object the page gives: "For every offer", beside its own values.
  const inside = (key: string, label: string) => {
    const group = props.fixed?.nested?.[key];
    if (!group) return null;
    const at = group.list ? `${key}[*]` : key;
    const written = props.fixed?.added?.[at];
    const added = written !== null && typeof written === 'object' && !Array.isArray(written) ? (written as Item) : {};
    const kind = typesOf(group.page)[0];
    // The page's own values are shown above: only what is added, and Add a detail.
    return (
      <NestedGroup open={Object.keys(added).length > 0} label={group.list ? `For every ${kind ? typeLabel(kind, props.rules).toLowerCase() : 'item'}` : `Add inside ${label.toLowerCase()}`}>
        <ItemForm
          {...props}
          item={{ ...added, '@type': group.page['@type'] ?? 'Thing' }}
          path={[...props.path, at]}
          verdicts={[]}
          fixed={{
            // The page's values; one the details also give says theirs isn't used.
            from: Object.fromEntries(
              Object.entries(group.from)
                .filter(([one]) => !(one in added) || typeof added[one] !== 'object' || added[one] === null)
                .map(([one, value]) => [one, one in added && JSON.stringify(added[one]) !== JSON.stringify(group.page[one]) ? { ...value, unused: typeof added[one] === 'string' ? (added[one] as string) : JSON.stringify(added[one]) } : value]),
            ),
            added,
          }}
          main={undefined}
          menu={undefined}
          duplicate={null}
          nested
          root={props.root ?? props.path.length}
        />
      </NestedGroup>
    );
  };
  const rowOf = (spec: RowSpec, washed: boolean, either = false) => (
    <Fragment key={spec.key}>
    <Row
      key={spec.key}
      rules={props.rules}
      path={[...props.path, spec.key]}
      label={spec.label}
      value={spec.value}
      expects={spec.expects}
      need={spec.need}
      either={either}
      readonly={props.readonly}
      from={props.fixed?.from[spec.key]}
      washed={washed}
      translate={props.translate?.has([...props.path, spec.key].join('/'))}
      linking={props.linking}
      zone={props.zone}
      onChange={(path, value) => {
        props.onChange(path, value);
        if (value !== undefined) drop(spec.key);
      }}
      onMove={props.onMove}
      onCommit={props.onCommit}
      onShow={props.onShow}
      problems={props.problems}
      onFix={props.onFix}
      onEmpty={pending.includes(spec.key) ? () => drop(spec.key) : undefined}
      renderItem={(path, value, label, expects) => (
        <ItemValue {...props} path={path} value={value} label={label} expects={expects} depth={props.root ?? props.path.length} top={props.top ?? { label: projection.label, feature: projection.feature }} />
      )}
    />
    {inside(spec.key, spec.label)}
    </Fragment>
  );
  const band = (one: Band) => (
    <section key={one.title} className="seo-cband" aria-label={one.title}>
      <h4 className="seo-cband-title">{one.title}</h4>
      {one.rows.map((row) =>
        'group' in row ? (
          <fieldset
            key={row.group}
            className="seo-either"
            aria-describedby={row.met ? undefined : `${mainId}-either-${row.group.replace(/\W+/g, '-')}`}
            data-met={row.met || undefined}
            // Items and more than two choices stack; two plain values sit side by side.
            data-stack={row.rows.length > 2 || row.rows.some((spec) => typeof spec.value === 'object' || (typeof spec.expects === 'object' ? spec.expects.is : spec.expects).startsWith('item')) || undefined}
          >
            {/* Met: only the value given shows; the group's name is for assistive technology. */}
            <legend className={row.met ? 'seo-visually-hidden' : 'seo-crow-label'}>{row.group}</legend>
            <p className="seo-meta seo-either-hint" id={`${mainId}-either-${row.group.replace(/\W+/g, '-')}`} hidden={row.met} data-done={row.rows.some((spec) => spec.value !== undefined) || undefined}>
              {row.hint}
            </p>
            <div className="seo-either-pair">
              {row.rows.map((spec, index) => (
                <span key={spec.key} className="seo-either-one">
                  {index > 0 && (
                    <span className="seo-meta" aria-hidden>
                      or
                    </span>
                  )}
                  {rowOf(spec, props.washed === spec.key, true)}
                </span>
              ))}
            </div>
          </fieldset>
        ) : (
          rowOf(row, props.washed === row.key || added === row.key)
        ),
      )}
    </section>
  );

  // Every other detail of the type: the vocabulary's, else the documented.
  const others = (query: string) => {
    const documented = Object.values(props.rules.features)
      .filter((feature) => projection.types.some((one) => feature.on.includes(one)))
      .flatMap((feature) => feature.names ?? []);
    const pool = props.vocabulary && props.vocabulary.types[type] ? detailsOf(props.vocabulary, projection.types) : [...new Set([...documented, 'name', 'description', 'image', 'url', 'sameAs'])];
    const plumbing = ['potentialAction', 'mainEntityOfPage', 'subjectOf', 'additionalType', 'identifier', 'disambiguatingDescription', 'owner'];
    return pool
      .filter((name) => !(name in shownItem) && !props.fixed?.from[name])
      // A replaced name only when it is typed in full: it offers its replacement.
      .filter((name) => !props.vocabulary?.properties[name]?.superseded || name.toLowerCase() === query.trim().toLowerCase())
      .map((name) => ({ name, rank: Math.max(score(detailLabel(name, props.rules), query), score(name, query)) - (plumbing.includes(name) ? 1 : 0) }))
      .filter((one) => one.rank > 0)
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 30)
      .map(({ name }) => {
        const superseded = props.vocabulary?.properties[name]?.superseded;
        return {
          value: superseded ?? name,
          key: name,
          label: detailLabel(name, props.rules),
          hint: describeExpects(expectsOf(name, projection.types, props.rules, props.vocabulary)) || undefined,
          detail: superseded ? `‘${name}’ was replaced by ‘${superseded}’. Use ${superseded}` : (props.vocabulary?.properties[name]?.about ?? name),
        };
      });
  };
  const add = (name: string) => {
    const spec = expectsOf(name, projection.types, props.rules, props.vocabulary);
    const item = spec !== '' && kinds(typeof spec === 'string' ? spec : spec.is).every(([kind]) => kind === 'item');
    const allowed = item ? kinds(typeof spec === 'string' ? spec : spec.is).flatMap(([, list]) => list) : [];
    const canPoint = props.targets.some((target) => !target.disabled && (allowed.includes('Thing') || target.types.some((one) => allowed.includes(one) || allowed.some((type) => (props.rules.subtypes?.[type] ?? []).includes(one)))));
    // A rating or price starts described here; an item that can point at
    // something on the page waits as "Choose"; a value only once it has one.
    if (item && (allowed.every((one) => VALUE_TYPES.includes(one)) || !canPoint)) {
      props.onChange([...props.path, name], { '@type': itemTypeOf(spec) });
    } else {
      setPending((list) => [...list, name]);
    }
    setAdded(name);
    focusNext.current = name;
  };
  const definition = props.vocabulary?.types[type]?.about;
  const note = typeNote(type, props.rules, props.vocabulary);
  const typedText = !!props.linking && props.linking.fields.length > 0 && Object.values(props.item).some((value) => typeof value === 'string' && !linkOf(value) && !/^(https?:|#)/.test(value));

  return (
    <div className="seo-citem" ref={root}>
      {!props.fixed && !props.nested && (
        <div className="seo-citem-head">
          <div className="seo-citem-headline">
            <h3 tabIndex={-1} className="seo-citem-title" data-focus="level">
              {projection.label}
            </h3>
            {definition && (
              <button type="button" className="seo-icon-btn" data-size={24} aria-expanded={about} aria-label={`About ${projection.label}`} onClick={() => setAbout(!about)}>
                <InfoCircledIcon aria-hidden />
              </button>
            )}
            {props.menu}
          </div>
          <p className="seo-citem-type">
            <code>{projection.types.join(', ') || 'No type'}</code>
            {id && <code> · {id}</code>}
            {props.verdicts[0] && (
              <span className="seo-citem-short" data-verdict={props.verdicts[0].verdict}>
                {' '}
                · {props.verdictText(props.verdicts[0])}
              </span>
            )}
          </p>
          {about && definition && (
            <div className="seo-citem-definition" role="note">
              <p>{definition}</p>
              <p className="seo-meta">Definitions are schema.org's own, in English.</p>
            </div>
          )}
          {note && note !== definition && <p className="seo-meta seo-citem-about">{note}</p>}
        </div>
      )}
      {!props.nested && !props.fixed && <VerdictBox verdicts={props.verdicts} rules={props.rules} text={props.verdictText} fix={props.verdictFix} title={props.verdictTitle} />}
      {!props.nested && typedText && props.linking!.multilingual && (
        <p className="seo-meta">The same text goes on every language. Link it to a field so each translation gets its own.</p>
      )}
      {projection.bands
        .map((one) => (props.fixed ? { ...one, rows: one.rows.filter((row) => 'group' in row || (!(PLUMBING.includes(row.key) && props.fixed!.from[row.key]) && !(/\[/.test(row.key) && props.fixed!.nested?.[row.key.replace(/\[.*$/, '')]))) } : one))
        .filter((one) => one.rows.length > 0)
        .map(band)}
      {Object.entries(Object.entries(projection.belongs).reduce<Record<string, string[]>>((by, [key, narrower]) => ({ ...by, [narrower]: [...(by[narrower] ?? []), key] }), {})).map(([narrower, keys]) => (
        <div key={narrower} className="seo-notice" role="note">
          <p>
            {keys.length === 1 ? `${keys[0]} is a detail` : `${keys.slice(0, -1).join(', ')} and ${keys[keys.length - 1]} are details`} of {aType(narrower, props.rules)}.
          </p>
          {!props.readonly && !props.fixed && (
            <UiBtn
              variant="soft"
              size={24}
              onClick={() => {
                if (props.onChangeType && !props.nested) {
                  props.onChangeType(narrower);
                  return;
                }
                props.onChange([...props.path, '@type'], narrower);
                props.onCommit();
                // The button goes with the notice: the item's heading takes focus.
                requestAnimationFrame(() => document.querySelector<HTMLElement>('.seo-sheet [data-focus="level"]')?.focus());
              }}
            >
              Change the type to {typeLabel(narrower, props.rules)}
            </UiBtn>
          )}
        </div>
      ))}
      {!props.readonly && !props.nested && projection.helps.length > 0 && (
        <div className="seo-chelps">
          <span className="seo-meta">{projection.feature ? 'Also helps' : 'Suggested'}</span>
          {projection.helps.map((name) => (
            <Btn key={name} add onClick={() => add(name)}>
              {detailLabel(name, props.rules)}
            </Btn>
          ))}
        </div>
      )}
      {!props.readonly && (
        <FilterList<string>
          label="Add a detail"
          placeholder={`Search details of ${aType(type || 'Thing', props.rules)}`}
          options={others}
          onPick={(name) => add(name)}
          noun={['detail', 'details']}
        />
      )}
      {props.main && (
        <div className="seo-cmain">
          <label htmlFor={mainId}>This is what the page is mainly about</label>
          <Switch size="2" id={mainId} checked={props.main.on} disabled={props.readonly} onCheckedChange={props.main.toggle} />
        </div>
      )}
    </div>
  );
}

/** A group inside an item, folded with one chevron. */
function NestedGroup(props: { label: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(props.open ?? true);
  return (
    <div className="seo-cnested" role="group" aria-label={props.label}>
      <button type="button" className="seo-cdisclose" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronDownIcon aria-hidden />
        {props.label}
      </button>
      {open && props.children}
    </div>
  );
}

/** An item value: a menu that points at something, or describes it here. */
function ItemValue(props: ItemFormProps & { path: Path; value: unknown; label: string; expects: ExpectsSpec | ''; depth: number; top: { label: string; feature: boolean } }) {
  const value = props.value;
  // Describing in place moves focus into the item: the menu must not take it back.
  const moving = useRef(false);
  const allowed = props.expects === '' ? [] : kinds(typeof props.expects === 'string' ? props.expects : props.expects.is).filter(([kind]) => kind === 'item').flatMap(([, list]) => list);
  const fitsTarget = (target: Target) => !allowed.length || allowed.includes('Thing') || target.types.some((type) => allowed.includes(type) || allowed.some((one) => (props.rules.subtypes?.[one] ?? []).includes(type)));
  const ref = typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 1 && typeof (value as Item)['@id'] === 'string' ? ((value as Item)['@id'] as string) : null;
  const described = typeof value === 'object' && value !== null && !Array.isArray(value) && !ref ? (value as Item) : null;
  const pointed = ref ? props.targets.find((target) => target.id === ref) : undefined;
  const nameOnly = typeof value === 'string';
  const key = String(props.path[props.path.length - 1]);
  // A rating, a price: described here, never only named.
  const valueLike = allowed.length > 0 && allowed.every((one) => VALUE_TYPES.includes(one));
  // A review or rating of the site's own organization can't show.
  const reviewsUs = (target: Target) => key === 'itemReviewed' && target.id === '#identity' && typesOf(props.item).some((one) => one === 'Review' || one === 'AggregateRating');
  // One of the module's items: its details are added in its own sheet.
  const details = ref && pointed && ['#identity', '#webpage', '#primary'].includes(ref) && !props.readonly ? (props.onDetails?.(ref) ?? null) : null;
  const linkedName = described && linkOf(described.name);
  const describedName = typeof described?.name === 'string' && described.name && !linkedName ? described.name : typeLabel(typesOf(described)[0] ?? 'Thing', props.rules);
  const summary = ref ? (pointed?.label ?? ref) : described ? describedName : nameOnly ? (value as string) : key === 'itemReviewed' ? 'Choose what it reviews' : 'Choose';
  const how = ref ? null : described ? (linkedName ? `Linked as ${aType(typesOf(described)[0] ?? 'Thing', props.rules)}'s name` : 'Described here') : nameOnly ? 'Just a name' : null;
  const nested = props.path.length - props.depth;
  // A review's own score is not the page's aggregate rating.
  const choices = props.targets.filter(fitsTarget).filter((target) => !(key === 'reviewRating' && target.types.some((one) => /AggregateRating$/.test(one))));
  // "a book, course, …": a long list is summed up; the menu names them.
  const kindsShown = allowed.length > 3 ? '' : allowed.map((one) => typeLabel(one, props.rules)).join(' or ');
  // A reference already says what it is ("Acme Logistics, an organization").
  const tag = how ?? (ref ? '' : kindsShown);
  const textFields = props.linking?.fields.filter((one) => one.kinds.includes('text')) ?? [];
  const scalars = described ? Object.entries(described).filter(([key]) => !key.startsWith('@')) : [];
  // A third level that is only text (an answer): edited here, not in JSON.
  const plain = !!described && scalars.length > 0 && scalars.length <= 2 && scalars.every(([, one]) => typeof one === 'string');
  // Nothing chosen yet for a value-like item: described here in one step.
  if (value === undefined && valueLike && !props.readonly) {
    const type = itemTypeOf(props.expects);
    return (
      <div className="seo-cref">
        <UiBtn
          variant="soft"
          size={24}
          onClick={() => {
            props.onChange(props.path, { '@type': type });
            props.onCommit();
            focusFirstNeed(props.path);
          }}
        >
          Describe {aType(type, props.rules).replace(/^an? /, 'the ')}
        </UiBtn>
      </div>
    );
  }
  return (
    <div className="seo-cref">
      {!props.readonly ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button type="button" className="seo-input seo-cref-trigger" aria-label={`${props.label}: ${summary}${tag ? ` ${tag}` : ''}`} aria-description={allowed.length ? `Takes ${allowed.map((one) => aType(one, props.rules)).join(', ')}` : undefined}>
              <bdi className="seo-cref-name">{summary}</bdi>{' '}
              {tag && <span className="seo-meta seo-cref-kind">{tag}</span>}
              <ChevronDownIcon aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            size="1"
            align="start"
            side="bottom"
            avoidCollisions
            collisionPadding={8}
            className="seo-scope-menu"
            onCloseAutoFocus={(event) => {
              if (moving.current) event.preventDefault();
              moving.current = false;
            }}
          >
            {choices.length > 0 && (
              <>
                <DropdownMenu.RadioGroup value={ref ?? ''}>
                  {choices.map((target) => (
                    <DropdownMenu.RadioItem
                      key={target.id + (target.nested ?? []).join('/')}
                      value={target.id}
                      disabled={!!target.disabled}
                      onSelect={() => {
                        if (target.nested) {
                          props.onHoist(target.nested, props.path);
                          return;
                        }
                        props.onChange(props.path, { '@id': target.id });
                        props.onCommit();
                      }}
                    >
                      <span className="seo-mi">
                        <bdi>{target.label}</bdi>
                        {target.disabled && <small>{target.disabled}</small>}
                        {!target.disabled && reviewsUs(target) && <small>Ratings of your own organization can't show.</small>}
                      </span>
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
                <DropdownMenu.Separator />
              </>
            )}
            <DropdownMenu.Item
              onSelect={() => {
                props.onChange(props.path, { '@type': itemTypeOf(props.expects), ...(nameOnly ? { name: value } : {}) });
                props.onCommit();
                moving.current = true;
                focusFirstNeed(props.path);
              }}
            >
              Describe it here
            </DropdownMenu.Item>
            {!valueLike && (
              <DropdownMenu.Item
                onSelect={() => {
                  // Starts from the name of what it pointed at or described.
                  const from = typeof described?.name === 'string' ? described.name : pointed ? pointed.label.replace(/ \(this site\)$/, '').replace(/, an? [^,]+$/, '') : '';
                  props.onChange(props.path, from);
                  props.onCommit();
                }}
              >
                <span className="seo-mi">
                  Just a name
                  {allowed.length > 0 && !allowed.includes('Thing') && props.top.feature && <small>{props.top.label} can’t show with only a name.</small>}
                </span>
              </DropdownMenu.Item>
            )}
            {/* One menu, never a submenu past the frame's edge. */}
            {textFields.length > 0 && (
              <DropdownMenu.Group>
                <DropdownMenu.Separator />
                <DropdownMenu.Label>Its name from a field</DropdownMenu.Label>
                  {textFields.map((one) => (
                    <DropdownMenu.Item
                      key={one.name}
                      onSelect={() => {
                        props.onChange(props.path, { '@type': itemTypeOf(props.expects), name: `{field.${one.name}}` });
                        props.onCommit();
                      }}
                    >
                      <span className="seo-mi">
                        <b>{one.label}</b>
                        <small>{one.value ? (one.value.length > 80 ? `${one.value.slice(0, 80).trimEnd()}…` : one.value) : 'Empty'}</small>
                      </span>
                    </DropdownMenu.Item>
                  ))}
              </DropdownMenu.Group>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      ) : (
        <p className="seo-input" aria-readonly>
          <bdi>{summary}</bdi>
        </p>
      )}
      {details && (
        <UiBtn variant="ghost" size={24} onClick={details}>
          Add details to {pointed!.label.replace(/ \(this site\)$/, '').replace(/^This /, 'this ')}
        </UiBtn>
      )}
      {nameOnly && (
        <input
          className="seo-input"
          aria-label={`${props.label}, name`}
          dir="auto"
          disabled={props.readonly}
          value={value as string}
          onChange={(event) => props.onChange(props.path, event.target.value)}
          onBlur={() => props.onCommit()}
        />
      )}
      {described && (nested <= 2 || plain) && (
        <NestedGroup label={`Details of ${props.label.toLowerCase()}`}>
          {(
            <ItemForm
              {...props}
              item={described}
              path={props.path}
              verdicts={[]}
              fixed={undefined}
              main={undefined}
              menu={undefined}
              duplicate={null}
              nested
              root={props.depth}
              needs={typeof props.expects === 'object' ? props.expects.needs : undefined}
            />
          )}
        </NestedGroup>
      )}
      {described && nested > 2 && !plain && (
        <UiBtn variant="ghost" size={24} onClick={() => props.onShow(props.path)}>
          Edit in JSON
        </UiBtn>
      )}
    </div>
  );
}

/** After describing an item in place: focus its first empty need, else its first control. */
function focusFirstNeed(path: Path) {
  const at = path.join('/');
  requestAnimationFrame(() => {
    const rows = [...document.querySelectorAll<HTMLElement>('.seo-crow[data-row]')].filter((row) => row.dataset.row!.startsWith(`${at}/`));
    const row = rows.find((one) => one.dataset.need !== undefined && one.dataset.empty !== undefined) ?? rows[0];
    controlOf(row)?.focus();
  });
}

export { sentence };
