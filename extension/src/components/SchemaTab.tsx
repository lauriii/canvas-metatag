import {
  CalendarIcon,
  CodeIcon,
  CubeIcon,
  FileIcon,
  LayersIcon,
  Link2Icon,
  PersonIcon,
  ReaderIcon,
} from '@radix-ui/react-icons';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { Popover, Select } from '@radix-ui/themes';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useApp } from '../App';
import { QUIET, groupGap, lineName, notYetText, retiredText, stageMatch, verdictText } from '../checks';
import {
  andList,
  catchingUp,
  changeKindText,
  currencyName,
  currencyChoices,
  dateText,
  featureLabel,
  IN_PLACE_PARTS,
  inSentence,
  kindOfType,
  kinds,
  offered,
  optionText,
  removed,
  setPath,
  stageVerdicts,
  typeOf,
  withKind,
} from '../model';
import { type ReadFact, dateWords, judged, readback, valueAt } from '../readback';
import { choicesOf, controlFor, durationText, groupLine, hoursLine, missingParts, parseHours, partNoun, plainText } from '../controls';
import type { Registry, SchemaProp, SchemaType, Value, Verdict } from '../types';
import { factsFor, propKind, resolve, sameValue, tagOf } from '../values';
import { CheckRows, DurationInput, Picker, WeekEditor } from './Controls';
import { Field, Guide, useField, useHeld } from './Field';
import { Sheet } from './Header';
import { ImageRow } from './MediaPicker';
import { Disclosure, List } from './SettingsList';
import { SchemaSuggest, SuggestButton } from './Suggest';
import { Btn, InfoTip, Notice } from './ui';
import { type InputProps, TextInput, ValueField } from './Value';

const ICONS: Record<string, typeof CubeIcon> = {
  cube: CubeIcon,
  layers: LayersIcon,
  reader: ReaderIcon,
  calendar: CalendarIcon,
  person: PersonIcon,
  file: FileIcon,
};

/** What an unset detail says about its default. */
const DEFAULTS: Record<string, string> = {
  title: 'From the page title',
  description: 'Same as description',
  image: 'From the Image field',
};

/** The stage's lines as last said, by target: drawn again, they are not said again. */
const lastSaid = new Map<string, Map<string, string>>();

/** The current type: stored, inherited, or the web page. */
function useType() {
  const { state, ...app } = useApp();
  const server = state.server!;
  const effective = app.view!.effective.schema?.type;
  const id = effective && server.registry[effective] ? effective : 'WebPage';
  // Inherited: not stored in the working copy, so it follows its default.
  const own = state.edits.target.schema?.type;
  return { id, type: server.registry[id], inherited: own === undefined, unknown: effective && !server.registry[effective] ? effective : null };
}

/** A typed input whose half-typed states are invalid: handed over on blur or Enter. */
function HeldInput(props: InputProps & { kind: 'text' | 'url' | 'number'; label: string; required?: boolean; placeholder?: string }) {
  const held = useHeld(props.value, (text) => props.set(text));
  return (
    <input
      id={props.id}
      className="seo-input"
      dir={props.kind === 'text' ? 'auto' : undefined}
      inputMode={props.kind === 'url' ? 'url' : props.kind === 'number' ? 'decimal' : undefined}
      // A number has no sample: "0.00" would read as a free price.
      placeholder={props.placeholder ?? (props.kind === 'url' ? 'https://' : undefined)}
      aria-required={props.required || undefined}
      aria-invalid={props.invalid || undefined}
      aria-describedby={props.describedBy}
      disabled={props.disabled}
      {...held}
      onKeyDown={(event) => {
        held.onKeyDown(event);
        props.onKeyDown(event);
      }}
    />
  );
}

/** A date and a time: the time is the site's own. */
function DateInput(props: InputProps & { label: string }) {
  const [, date = '', time = ''] = props.value.match(/^(\d{4}-\d\d-\d\d)(?:T(\d\d:\d\d))?/) ?? [];
  return (
    <div className="seo-pair" data-even="">
      <input
        id={props.id}
        className="seo-input"
        type="date"
        aria-invalid={props.invalid || undefined}
        aria-describedby={props.describedBy}
        disabled={props.disabled}
        value={date}
        onKeyDown={props.onKeyDown}
        onChange={(event) =>
          props.set(event.target.value ? event.target.value + (time ? `T${time}` : '') : undefined)
        }
      />
      <input
        className="seo-input"
        type="time"
        aria-label={`${props.label}, time`}
        disabled={props.disabled || !date}
        value={time}
        onChange={(event) => props.set(date + (event.target.value ? `T${event.target.value}` : ''))}
      />
    </div>
  );
}

/**
 * A select of options; "Not set" first. A choice with a default ("Other
 * local business") reads as that default, and has no "Not set": choosing
 * the default stores nothing.
 */
function OptionInput(props: InputProps & { prop: SchemaProp; none: string }) {
  const options = (props.prop.options ?? []).map((option) => [option, optionText(props.prop, option)] as const);
  // A value stored before the list was what it is is shown as it is.
  const kept = props.value && !options.some(([value]) => value === props.value) ? [[props.value, props.value] as const] : [];
  const fallback = props.prop.default && 'text' in props.prop.default ? props.prop.default.text : undefined;
  return (
    <Select.Root
      value={props.value || fallback || 'none'}
      disabled={props.disabled}
      onValueChange={(value) => props.set(value === 'none' || value === fallback ? undefined : value)}
    >
      <Select.Trigger
        id={props.id}
        className="seo-select-box"
        // "Not set" in gray, as every empty box reads.
        data-unset={!props.value && !fallback ? '' : undefined}
        aria-describedby={props.describedBy}
        onKeyDown={props.onKeyDown}
      />
      <Select.Content position="popper" className="seo-select-content seo-select-fit" aria-label={props.prop.label}>
        {!fallback && <Select.Item value="none">{props.none}</Select.Item>}
        {[...kept, ...options].map(([value, label]) => (
          <Select.Item key={value} value={value}>
            {label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

/** Who a reference is, as one choice: the site, someone else, or nobody yet. */
interface Who {
  choice: 'none' | 'site' | 'other';
  choose(next: 'none' | 'site' | 'other'): void;
  /** Moves focus to someone else's name. */
  focusName(): void;
  /** The keys of the group's own parts (name, website). */
  parts: string[];
  /** What nobody set gives, when it is someone: "Ada Lovelace (the page's author)". */
  byDefault?: string;
}

/**
 * The currencies, common ones first; a code stored before the list was what
 * it is ("RMB") is kept, as it is.
 */
function currencyList(ui: string, site: string, stored: string) {
  const { common, rest } = currencyChoices(ui, [site]);
  const all = [...common, ...rest];
  const kept = stored && !all.some(([value]) => value === stored) ? [[stored, stored] as const] : [];
  return [...kept, ...all].map(([value, label]) => ({ value, label, also: [value] }));
}

/** One detail of the chosen type, by its kind. A stored value overrides the default. */
function Detail(props: { prop: SchemaProp; type: string; revealed?: boolean; who?: Who; inSheet?: boolean; shortLabel?: string }) {
  const { prop, who } = props;
  const { state, dispatch, openSheet, goTo, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const template = server.target!.scope === 'template';
  const path = `schema.props.${prop.key}`;
  const kind = propKind(prop);
  const control = controlFor(prop, server.target!.scope);
  const stored = state.edits.target.schema?.props?.[prop.key];
  const fact = prop.default && 'fact' in prop.default ? prop.default.fact : undefined;
  // On a page, addresses, dates and images may link to the page's facts;
  // not when its only fact is the default it follows: no choice to offer.
  const facts = factsFor(path, kind, 'page');
  const linkable =
    template ||
    (facts.length > 0 &&
      !(facts.length === 1 && sameValue({ fact: facts[0] }, prop.default) && !(stored && 'fact' in stored)));
  // What a page shows while nothing is typed: the default, as the page has it.
  const unset = prop.default ? resolve(prop.default, kind, view.lookup) : undefined;
  const site = prop.kind === 'currency' && server.site.currency ? currencyName(server.site.currency, server.ui) : '';
  const placeholder =
    unset?.status === 'ok'
      ? kind === 'date'
        ? dateText(unset.text)
        : fact === 'description'
          ? view.texts.description
          : unset.text
      : undefined;
  const edit = (value: unknown) => dispatch({ type: 'edit', scope: 'target', path, value });
  // The Description fact of a detail is the description as search shows it,
  // as the head gives it (SchemaGraph::build()).
  const lookup = {
    ...view.lookup,
    facts: {
      ...view.lookup.facts,
      ...(view.lookup.facts.description && {
        description: { ...view.lookup.facts.description, value: view.texts.description },
      }),
    },
  };
  // What a feature needs it for, said at rest while it is empty.
  const report = server.resolved?.schema;
  // A choice of who is asked for by any of its parts: an employer's name.
  const asks = (key?: string) => key === prop.key || (!!who && !!key && who.parts.includes(key));
  const needed = report?.type === props.type
    ? [...new Set(report.features.filter((verdict) => verdict.missing?.some((one) => asks(one.prop))).map((verdict) => server.search_features.features[verdict.feature!]?.for ?? ''))].filter(Boolean)
    : [];
  const title = view.lookup.facts.title?.value ?? '';
  const named = view.effective.schema?.props?.name;
  // Follows the page title by default: Search is where it is changed.
  const follows = stored === undefined && fact === 'title';
  const editInSearch = (
    <Btn variant="ghost" size={24} onClick={() => goTo({ scope: 'target', tab: 'search', field: 'title' })}>
      Edit in Search
    </Btn>
  );
  // A product named after its page, on a page: a template's name follows
  // each item's own title, which is right.
  const nameIsTitle =
    !template &&
    prop.key === 'name' &&
    ['Product', 'Service'].includes(props.type) &&
    title !== '' &&
    (named === undefined ? true : 'text' in named && named.text.trim().toLowerCase() === title.trim().toLowerCase());
  // A reference whose absence is the site on a Canvas page: "Organizer"
  // names the site until it is touched.
  const siteName = view.lookup.facts.site?.value || server.site.identity.name;
  const groupSet = !!prop.group && Object.keys(state.edits.target.schema?.props ?? {}).some((key) => key === prop.group || key.startsWith(`${prop.group}_`));
  const bySite = !!prop.page_default && !template && !groupSet && siteName !== '';

  return (
    <ValueField
      path={path}
      label={prop.label}
      kind={kind}
      // Who is chosen, or linked to a reference field on a template; the
      // site is a choice of its own, never a row of the link menu.
      linkable={who ? template : linkable}
      lookup={lookup}
      // A jump to a part not shown lands on the choice.
      also={who && who.choice !== 'other' ? who.parts.map((key) => `schema.props.${key}`) : undefined}
      typing={(prop.kind === 'text' || prop.kind === 'ref') && !prop.pattern && control !== 'link' && !who}
      // Only a field of the codes fills a choice: a list field with one code
      // fills a list of them too.
      choices={prop.kind === 'enum' ? (prop.codes ? server.codes?.[prop.codes] : prop.options) : undefined}
      // The site is the first row of a reference's menu, as it is a choice
      // of who; chosen, it reads as the choice, never as a link.
      noSite={prop.kind === 'ref' && !prop.site}
      who={!!who}
      shortLabel={props.shortLabel}
      // In a sheet, what the group misses is said once, under "Reads as".
      quiet={props.inSheet}
      // A linked duration in its unit: "20 min"; a choice by its option's
      // words, its default too ("Other local business").
      format={
        control === 'duration' && stored && 'source' in stored
          ? (text) => (/^\d+(\.\d+)?$/.test(text) ? durationText(String(Math.round(Number(text) * ((stored.unit ?? prop.unit) === 'hour' ? 60 : 1)))) || text : text)
          : prop.kind === 'enum' && !prop.list && prop.options
            ? (text) => (prop.options!.includes(text) ? optionText(prop, text) : text)
            : undefined
      }
      after={
        // A linked duration: what its field counts, asked once and kept
        // with the link.
        control === 'duration' && stored && 'source' in stored && (prop.units?.length ?? 0) > 1 ? (
          <UnitQuestion
            label={prop.label}
            units={prop.units!}
            value={stored.unit ?? prop.unit!}
            disabled={app.locked.target}
            set={(unit) => edit({ ...stored, unit })}
          />
        ) : undefined
      }
      items={prop.list || prop.join ? 'list' : 'one'}
      byDefault={prop.default ?? null}
      instead={fact ? `its ${view.facts[fact]?.label ?? fact} is used` : 'the detail is left out'}
      required={prop.level === 'required' || needed.length > 0}
      missing={
        props.inSheet ? undefined : stored === undefined && unset?.status !== 'ok' && needed.length && !(who && who.choice !== 'none') ? (
          `Needed for ${needed.join(' and ')}`
        ) : prop.level === 'required' && stored === undefined && !prop.default && !who ? (
          `Needed for ${typeOf(server.registry, props.type).kind?.name ?? 'this kind'}`
        ) : nameIsTitle ? (
          // Typed here: the field it asks for is this one.
          `The name is the page title. Give the ${props.type === 'Service' ? 'service' : 'product'} its own name.`
        ) : undefined
      }
      fallback={
        // "Now the page title" says it once, when it is shown.
        stored === undefined && fact && !(props.revealed && follows && !nameIsTitle)
          ? (DEFAULTS[fact] ?? 'From the page')
          : site
            ? `Site currency: ${site}`
            : bySite
              ? 'The site, by default'
              : undefined
      }
      noStage
      // A box that opens a sheet says nothing beside it, as a group's does:
      // its sheet clears it.
      // In a sheet the header's Clear and each input's own editing are the
      // way back: no Reset per part, no second Tab stop each.
      noReset={control === 'hours' || props.inSheet || undefined}
      source={control === 'hours' ? null : undefined}
      group={kind === 'image'}
      note={
        // A product named after its page asks for a name here instead.
        props.revealed && follows && !nameIsTitle ? (
          <>
            Now the page title. {editInSearch}
          </>
        ) : undefined
      }
      info={
        kind === 'date' &&
        stored !== undefined &&
        'text' in stored && <InfoTip label="About times" text="Times are in the site's time zone." />
      }
      library={
        kind === 'image'
          ? () =>
              openSheet({
                kind: 'image',
                request: { minWidth: 600, chosen: stored, onPick: edit },
              })
          : undefined
      }
      image={
        kind === 'image'
          ? (field, link) => {
              const shown = resolve(stored ?? prop.default, 'image', view.lookup);
              return (
                <ImageRow
                  describedBy={field.describedBy}
                  image={shown.image}
                  tag={link.imageTag}
                  state={link.imageState}
                  onUnlink={link.linked && !link.disabled ? () => link.unlink() : undefined}
                  disabled={field.disabled}
                  minWidth={600}
                  chosen={stored}
                  onPick={edit}
                />
              );
            }
          : undefined
      }
      lines={1}
      placeholder={placeholder ?? (bySite ? siteName : undefined)}
      input={(input) =>
        who ? (
          <WhoSelect {...input} who={who} siteName={siteName} pageDefault={!!prop.page_default && !template} label={prop.label} />
        ) : prop.kind === 'currency' ? (
          // Searchable, the site's currency suggested first.
          <Picker
            {...input}
            label={prop.label}
            noun="currency"
            choices={currencyList(server.ui, server.site.currency, input.value)}
            suggested={server.site.currency ? [server.site.currency] : undefined}
            placeholder={site ? `Site currency: ${site}` : undefined}
          />
        ) : control === 'checks' ? (
          <CheckRows {...input} label={prop.label} choices={choicesOf(prop, server.codes?.[prop.codes ?? ''] ?? [], server.ui)} />
        ) : control === 'picker' ? (
          <Picker
            {...input}
            label={prop.label}
            noun={prop.codes === 'country' ? 'country' : prop.label.toLowerCase()}
            choices={choicesOf(prop, server.codes?.[prop.codes ?? ''] ?? [], server.ui)}
            many={!!prop.list}
            max={prop.max}
            suggested={prop.suggest === 'country' && server.site.country ? [server.site.country] : undefined}
          />
        ) : control === 'duration' ? (
          <DurationInput {...input} label={prop.label} />
        ) : control === 'hours' ? (
          <HoursBox {...input} label={prop.label} path={path} />
        ) : control === 'link' ? (
          template ? (
            // A box the size of an input, in the anatomy of a linked one: it
            // opens the link menu.
            <button
              id={input.id}
              type="button"
              className="seo-group-box seo-link-only-box"
              aria-describedby={input.describedBy}
              aria-invalid={input.invalid || undefined}
              disabled={input.disabled}
              onClick={(event) => input.openMenu?.(event.currentTarget)}
              onKeyDown={input.onKeyDown}
            >
              <span className="seo-muted">Link a field…</span>
              <Link2Icon aria-hidden />
            </button>
          ) : (
            <p className="seo-muted seo-link-only">Comes from a field or a component</p>
          )
        ) : prop.kind === 'enum' ? (
          <OptionInput {...input} prop={prop} none={prop.key === 'sold_here' ? 'Not answered' : 'Not set'} />
        ) : prop.kind === 'date' ? (
          <DateInput {...input} label={prop.label} />
        ) : prop.kind === 'url' || prop.kind === 'number' || prop.pattern ? (
          <HeldInput
            {...input}
            kind={prop.kind === 'url' ? 'url' : prop.kind === 'number' ? 'number' : 'text'}
            label={prop.label}
            required={prop.level === 'required'}
            placeholder={placeholder}
          />
        ) : (
          <TextInput {...input} placeholder={placeholder ?? (bySite ? siteName : undefined)} lang={server.langcode} required={prop.level === 'required'} />
        )
      }
    />
  );
}

/**
 * Who it is: the site, or someone else, whose name and website are then
 * asked for under it. On a Canvas page a reference the site is by default
 * has no "Not set".
 */
function WhoSelect(props: InputProps & { who: Who; siteName: string; pageDefault: boolean; label: string }) {
  const site = `${props.siteName || 'This site'} (this site)`;
  const value = props.who.choice === 'none' && props.pageDefault ? 'site' : props.who.choice;
  const chosen = useRef<string | null>(null);
  return (
    <Select.Root
      value={value}
      disabled={props.disabled}
      onValueChange={(next) => {
        chosen.current = next;
        props.who.choose(next as Who['choice']);
      }}
    >
      <Select.Trigger id={props.id} className="seo-select-box" data-unset={value === 'none' && !props.who.byDefault ? '' : undefined} aria-describedby={props.describedBy} onKeyDown={props.onKeyDown} />
      <Select.Content
        position="popper"
        className="seo-select-content seo-select-fit"
        aria-label={props.label}
        // Someone else: focus goes to the name asked for under the choice,
        // not back to the choice.
        onCloseAutoFocus={(event) => {
          if (chosen.current === 'other') {
            event.preventDefault();
            props.who.focusName();
          }
          chosen.current = null;
        }}
      >
        {!props.pageDefault && <Select.Item value="none">{props.who.byDefault ?? 'Not set'}</Select.Item>}
        <Select.Item value="site">{site}</Select.Item>
        <Select.Item value="other">Someone else</Select.Item>
      </Select.Content>
    </Select.Root>
  );
}

/**
 * A reference that is the site or someone else (an organizer, an employer,
 * an author): one choice. "Someone else" shows the name and website under
 * it, named for whom they are ("Organizer name"); the site or a linked
 * reference field hides them.
 */
function WhoField(props: { group: string; type: string }) {
  const { state, dispatch, ...app } = useApp();
  const server = state.server!;
  const type = server.registry[props.type];
  const group = type.groups![props.group];
  const parts = useShown(props.type, type).filter((prop) => prop.group === props.group);
  const ref = parts.find((prop) => prop.key === props.group);
  const others = parts.filter((prop) => prop.key !== props.group);
  const effective = app.view!.effective.schema?.props ?? {};
  const [other, setOther] = useState(false);
  const own = effective[props.group];
  const template = server.target!.scope === 'template';
  // On a Canvas page the site is the default: "Someone else" is stored, so
  // the site is no longer assumed while the name is being typed.
  const pageDefault = !!ref?.page_default && !template;
  // A name nobody set that is someone all the same: the page's author.
  const defaultName = others.find((prop) => prop.default && 'fact' in prop.default);
  const named = defaultName ? resolve(defaultName.default, 'text', app.view!.lookup) : undefined;
  const choice: Who['choice'] =
    own && 'fact' in own && own.fact === 'identity'
      ? 'site'
      : other || (own && 'text' in own) || others.some((prop) => effective[prop.key] !== undefined)
        ? 'other'
        : 'none';
  if (!ref) {
    return <Details items={others} type={props.type} inGroup />;
  }
  const choose = (next: Who['choice']) => {
    const stored = state.edits.target.schema?.props ?? {};
    const kept = Object.fromEntries(Object.entries(stored).filter(([key]) => key !== props.group && !others.some((prop) => prop.key === key)));
    setOther(next === 'other');
    if (next === 'other' && choice === 'other') {
      return;
    }
    // The site where it is the default is the default: nothing stored, as
    // if nobody had changed it.
    const site = `${app.view!.lookup.facts.site?.value || server.site.identity.name || 'This site'} (this site)`;
    dispatch({
      type: 'apply',
      scope: 'target',
      values: {
        ...state.edits.target,
        schema: {
          ...state.edits.target.schema,
          props:
            next === 'site' && !pageDefault
              ? { ...kept, [props.group]: { fact: 'identity' } }
              : next === 'other' && pageDefault
                ? { ...kept, [props.group]: { text: '' } }
                : kept,
        },
      },
      undo: next === 'site' ? `${group.label}: ${pageDefault ? 'back to ' : ''}${site}` : next === 'other' ? `${group.label}: someone else` : `${group.label}: not set`,
    });
  };
  // Someone else: the name is asked for first.
  const focusName = () =>
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-path="schema.props.${props.group}_name"] :is(input, textarea)`)?.focus());
  const who: Who = {
    choice,
    choose,
    focusName,
    parts: others.map((prop) => prop.key),
    byDefault: named?.status === 'ok' && named.text ? `${named.text} (the page's ${(defaultName!.default as { fact: string }).fact})` : undefined,
  };
  return (
    <>
      <Detail prop={{ ...ref, label: group.label ?? ref.label }} type={props.type} who={who} />
      {choice === 'other' && (
        <div className="seo-under">
          {/* "Name" under Organizer; named "Organizer name" all the same. */}
          <Details
            items={others.map((prop) => ({ ...prop, label: `${group.label ?? ''} ${(prop.short ?? prop.label).toLowerCase()}`.trim() }))}
            short={Object.fromEntries(others.map((prop) => [prop.key, prop.short ?? prop.label]))}
            type={props.type}
            inGroup
          />
        </div>
      )}
    </>
  );
}

const UNIT_WORDS: Record<string, string> = { minute: 'minutes', hour: 'hours' };

/** What a linked duration's field counts in. */
function UnitQuestion(props: { label: string; units: string[]; value: string; disabled: boolean; set(unit: 'minute' | 'hour'): void }) {
  return (
    <div className="seo-unit-question">
      {/* Named by what it shows, for its time: "Prep time: the field counts
          minutes"; two linked times are told apart. */}
      <span>The field counts</span>
      <Select.Root value={props.value} disabled={props.disabled} onValueChange={(unit) => props.set(unit as 'minute' | 'hour')}>
        <Select.Trigger variant="ghost" className="seo-unit-select" aria-label={`${props.label}: the field counts ${UNIT_WORDS[props.value]}`}>
          {UNIT_WORDS[props.value]}
        </Select.Trigger>
        <Select.Content position="popper" className="seo-select-content" aria-label={`What ${props.label}'s field counts`}>
          {props.units.map((unit) => (
            <Select.Item key={unit} value={unit}>
              {UNIT_WORDS[unit]}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
    </div>
  );
}

/**
 * Lays details out. Where there is room, two numbers share a row (From and
 * Up to, Latitude and Longitude), as do a price and its currency, and a
 * currency and what it is per. A detail shown under another is indented
 * under it.
 */
function Details(props: { items: SchemaProp[]; type: string; revealed?: string | null; inGroup?: boolean; inSheet?: boolean; short?: Record<string, string> }) {
  const { state } = useApp();
  const rows: ReactNode[] = [];
  const { items } = props;
  const placed = new Set<string>();
  for (let index = 0; index < items.length; index++) {
    const prop = items[index];
    const next = items[index + 1];
    // A group is one line that opens a sheet, or its few parts in place.
    if (prop.group && !props.inGroup) {
      if (!placed.has(prop.group)) {
        placed.add(prop.group);
        const field =
          state.server!.registry[props.type]?.groups?.[prop.group]?.shape === 'who' ? (
            <WhoField key={prop.group} group={prop.group} type={props.type} />
          ) : (
            <GroupField key={prop.group} group={prop.group} type={props.type} />
          );
        // A group shown because of another's answer (the workplace, for
        // work on site) sits under it, as every dependent detail does.
        const gate = Object.keys(prop.when ?? {}).find((key) => items.some((one) => one.key === key));
        rows.push(gate ? <div className="seo-under" key={prop.group}>{field}</div> : field);
      }
      continue;
    }
    if (prop.under && !props.inGroup && items.some((one) => one.key === prop.under)) {
      rows.push(
        <div className="seo-under" key={prop.key}>
          <Detail prop={prop} type={props.type} />
        </div>,
      );
      continue;
    }
    if (
      (prop.kind === 'number' && !prop.unit && next?.kind === 'number' && !next.unit) ||
      (prop.kind === 'currency' && next?.kind === 'enum' && !next.list)
    ) {
      rows.push(
        <div className="seo-pair" data-even="" key={prop.key}>
          <Detail prop={prop} type={props.type} inSheet={props.inSheet} />
          <Detail prop={next} type={props.type} inSheet={props.inSheet} />
        </div>,
      );
      index++;
      continue;
    }
    if (prop.kind === 'number' && next?.kind === 'currency') {
      rows.push(
        <div className="seo-pair seo-price" key={prop.key}>
          <Detail prop={prop} type={props.type} inSheet={props.inSheet} />
          <Detail prop={next} type={props.type} inSheet={props.inSheet} />
        </div>,
      );
      index++;
      continue;
    }
    rows.push(<Detail key={prop.key} prop={prop} type={props.type} revealed={prop.key === props.revealed} inSheet={props.inSheet} shortLabel={props.short?.[prop.key]} />);
  }
  return rows;
}

/** The details of a type its scope offers and its gates allow, in order. */
function useShown(id: string, type: SchemaType): SchemaProp[] {
  const { state, ...app } = useApp();
  const scope = state.server!.target!.scope;
  const props = app.view!.effective.schema?.props ?? {};
  const code = (key: string) => {
    const value = props[key] ?? type.props?.find((one) => one.key === key)?.default;
    return value && 'text' in value ? value.text : undefined;
  };
  return (type.props ?? []).filter(
    (prop) =>
      offered(state.server!.registry, id, prop.key, scope) &&
      Object.entries(prop.when ?? {}).every(([gate, values]) => values.includes(code(gate) ?? '')),
  );
}

/** What a part of a group shows in the group's line. */
function useLine(type: SchemaType, key: string): string {
  const { state, ...app } = useApp();
  const server = state.server!;
  const props = app.view!.effective.schema?.props ?? {};
  const group = type.groups![key];
  const shown = (part: string) => {
    const prop = type.props?.find((one) => one.key === part);
    const value = props[part];
    if (!prop) {
      return '';
    }
    // A currency nobody set is the site's: the pay reads "€5,200 a month".
    if (!value) {
      return prop.kind === 'currency' ? server.site.currency : '';
    }
    const found = resolve(value, propKind(prop), app.view!.lookup);
    if (found.status !== 'ok') {
      return '';
    }
    if (prop.kind === 'enum') {
      return choicesOf(prop, server.codes?.[prop.codes ?? ''] ?? [], server.ui).find((choice) => choice.value === found.value)?.label ?? found.text;
    }
    return found.text;
  };
  return groupLine(key, group, shown, server.ui);
}

/**
 * What a group reads as, in its box and its sheet alike: the page or the
 * site its reference names, then its own parts ("Lakeside Hall, Rantakatu
 * 1, Helsinki"), or its parts alone: one separator, as every group line.
 */
function useGroupReading(type: SchemaType, key: string): string {
  const { state, ...app } = useApp();
  const line = useLine(type, key);
  const ref = state.server!.target ? app.view!.effective.schema?.props?.[key] : undefined;
  // A linked page the item has none of reads as nothing: its box says so.
  const named = ref && type.props?.some((one) => one.key === key) ? resolve(ref, 'ref', app.view!.lookup).text || ('source' in ref ? '' : tagOf(ref, app.view!.lookup, `schema.props.${key}`)) : '';
  // A venue page named as the venue: the name once.
  return named && line.split(', ')[0] === named ? line : [named, line].filter(Boolean).join(', ');
}

/** The parts of a group a scope offers: a page has no page picker yet, so no page reference. */
function useParts(typeId: string, type: SchemaType, key: string): SchemaProp[] {
  const { state } = useApp();
  const page = state.server!.target!.scope === 'page';
  return useShown(typeId, type).filter((prop) => prop.group === key && !(page && prop.key === key && prop.kind === 'ref' && !prop.site));
}

/**
 * A group: its few parts in place, or one line that opens its sheet. A group
 * with a reference reads the referenced page or the publisher first. What
 * it misses to be used is said under it, as the verdicts say it.
 */
function GroupField(props: { group: string; type: string }) {
  const { state, openSheet, ...app } = useApp();
  const server = state.server!;
  const type = server.registry[props.type];
  const group = type.groups![props.group];
  const parts = useParts(props.type, type, props.group);
  const reading = useGroupReading(type, props.group);
  const gap = useGap(props.type, type, props.group);
  const valueId = useId();
  // Linked to a reference field: the box says so, as a linked value's does.
  const refValue = app.view!.effective.schema?.props?.[props.group];
  const linkedTo = refValue && 'source' in refValue ? tagOf(refValue, app.view!.lookup, `schema.props.${props.group}`, 'ref') : '';
  if (parts.length <= IN_PLACE_PARTS) {
    return <Details items={parts.map((prop) => (prop.short ? { ...prop, label: prop.short } : prop))} type={props.type} inGroup />;
  }
  // What is wrong with the group as a whole: pay From above Up to.
  const whole = useWhole(props.group);
  const open = (at?: string) => openSheet({ kind: 'group', type: props.type, group: props.group, ...(at && { focus: at }) });
  return (
    <div className="seo-field seo-group" data-path={`schema.props.${props.group}`}>
      <span className="seo-label" id={`group-${props.group}`}>
        {group.label}
        {group.level === 'required' && <span className="seo-visually-hidden"> (required)</span>}
      </span>
      <button
        type="button"
        className="seo-group-box"
        // Named by its label, then what it reads: "Venue, Lakeside Hall".
        aria-labelledby={`group-${props.group} ${valueId}`}
        aria-describedby={gap.text || whole ? `${valueId}-gap` : undefined}
        onClick={() => open()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && event.altKey) {
            event.preventDefault();
            open();
          }
        }}
      >
        {linkedTo ? (
          <span id={valueId} className="seo-group-words">
            <span className="seo-linked-tag">
              <Link2Icon aria-hidden />
              <span className="seo-linked-leaf" dir="auto">{linkedTo}</span>
            </span>
            <span className={reading ? undefined : 'seo-muted'}>{reading || `Empty for this ${inSentence(server.target!.label)}`}</span>
          </span>
        ) : (
          <span id={valueId} className={reading ? undefined : 'seo-muted'}>
            {reading || 'Not set'}
          </span>
        )}
        <ChevronRightIcon aria-hidden />
      </button>
      {whole ? (
        <Guide tone="fix" id={`${valueId}-gap`}>
          {whole.text}{' '}
          {/* On the amount to change: Up to. */}
          <Btn variant="ghost" size={24} aria-label={`Show ${group.label?.toLowerCase()}`} onClick={() => open(whole.focus)}>
            Show
          </Btn>
        </Guide>
      ) : gap.text ? (
        <Guide tone="improve" id={`${valueId}-gap`}>
          {gap.text}{' '}
          {/* "Add", named for the part it opens on as the verdict's is: "Add
              Country"; "Choose" for one set to what the list does not hold. */}
          <Btn variant="ghost" size={24} aria-label={`${gap.choose ? 'Choose' : 'Add'} ${gap.first}`} onClick={() => open(gap.focus)}>
            {gap.choose ? 'Choose' : 'Add'}
          </Btn>
        </Guide>
      ) : null}
    </div>
  );
}

/**
 * What is wrong with a group as a whole, said once under its box and in its
 * sheet: pay whose From is above its Up to ("From is more than Up to."),
 * and the part to change.
 */
function useWhole(group: string): { text: string; focus?: string } | null {
  const { issues, state } = useApp();
  const issue = issues.find((one) => one.severity !== 'info' && one.jump?.field === `schema.props.${group}` && one.id.startsWith('schema-pay-order'));
  if (!issue) {
    return null;
  }
  const parts = state.server!.registry[state.edits.target.schema?.type ?? '']?.props ?? [];
  return {
    text: `${issue.message.slice(issue.message.indexOf(': ') + 2)}.`,
    focus: parts.find((prop) => prop.group === group && prop.key.endsWith('_maxValue'))?.key,
  };
}

/**
 * What a group misses, in one sentence its box and its sheet share: "Add the
 * country, so the address can be used.", "Add the city and the country for
 * event listings." `focus`: the part a jump opens the sheet on; `first`: its
 * name.
 */
function useGap(typeId: string, type: SchemaType, key: string): { text: string; focus?: string; first: string; choose?: boolean } {
  const { state, ...app } = useApp();
  const server = state.server!;
  const group = type.groups![key];
  const parts = useParts(typeId, type, key);
  const stored = app.view!.effective.schema?.props ?? {};
  const report = server.resolved?.schema;
  // The server's word on what it misses, as built; else what is set here.
  const set = (one: string) => stored[one] !== undefined;
  const local = !stored[key] && parts.some((prop) => prop.key !== key && set(prop.key)) ? missingParts(group, set, type.groups!) : [];
  const ours = report?.type === typeId;
  // A nested group's gap is its group's: the venue's address.
  const { missing, fors } = groupGap(type, key, ours ? report : null, server.search_features, local);
  const prop = (one: string) => type.props?.find((item) => item.key === one);
  const noun = (one: string) => partNoun(prop(one), type.groups?.[one]?.label ?? type.groups?.[one]?.shape ?? one);
  const first = missing[0];
  if (!first) {
    return { text: '', first: '' };
  }
  // A part of an address makes the address usable; any other, the group.
  const whole = missing.some((one) => type.groups?.[prop(one)?.part ?? one]?.shape === 'address' || group.shape === 'address') ? 'address' : group.label?.toLowerCase();
  const why = fors.length ? ` for ${andList(fors)}` : `, so the ${whole} can be used`;
  // A part set to what the list does not hold ("Finland" for a country) is
  // chosen from the list, never added.
  const dropped = new Set(ours ? (report?.dropped ?? []).map((one) => one.key) : []);
  const add = missing.filter((one) => !dropped.has(one));
  const choose = missing.filter((one) => dropped.has(one));
  return {
    text: [add.length ? `Add ${andList(add.map(noun))}${why}.` : '', choose.length ? `Choose ${andList(choose.map(noun))} from the list.` : ''].filter(Boolean).join(' '),
    focus: prop(first) ? first : type.groups?.[first]?.parts.find((part) => prop(part)),
    first: prop(first)?.short ?? prop(first)?.label ?? type.groups?.[first]?.label ?? type.groups?.[first]?.shape ?? first,
    choose: dropped.has(first),
  };
}

/** A group's sheet: what it reads as, then its parts in the shape's order. */
export function GroupSheet(props: { type: string; group: string; focus?: string; onClose(): void }) {
  const { state, dispatch, issues, ...app } = useApp();
  const server = state.server!;
  const type = server.registry[props.type];
  const group = type.groups![props.group];
  const parts = useParts(props.type, type, props.group);
  const reading = useGroupReading(type, props.group);
  const gap = useGap(props.type, type, props.group);
  const whole = useWhole(props.group);
  const line = useLine(type, props.group);
  const stored = state.edits.target.schema?.props ?? {};
  const set = parts.filter((prop) => stored[prop.key] !== undefined);
  const template = server.target!.scope === 'template';
  const allLinked = template && set.length > 0 && set.every((prop) => 'source' in stored[prop.key]!);
  // What opened it, as it was before the sheet took focus.
  const [from] = useState(() => document.activeElement as HTMLElement | null);
  // What the page does not show of the group's values, said once.
  const notOnPage = issues
    .filter((issue) => parts.some((prop) => issue.id === `schema-not-on-page:${prop.key}`))
    .map((issue) => issue.message.replace(/^Couldn't find (.*) on this page$/, '$1'));
  // Linked to a page: its own parts are used only where the page gives no
  // address, and wait folded until then.
  const ref = parts.find((prop) => prop.key === props.group && prop.kind === 'ref');
  const refValue = ref ? app.view!.effective.schema?.props?.[ref.key] : undefined;
  const own = parts.filter((prop) => prop !== ref);
  useEffect(() => {
    if (!props.focus) {
      return;
    }
    // The part's own control (its input, select or box), never its link
    // button: in the same frame the sheet opens, so focus never rests on
    // the document.
    const control = () =>
      document.querySelector<HTMLElement>(
        `.seo-sheet [data-path="schema.props.${props.focus}"] .seo-control :is(input, textarea, button, [role="combobox"]):not([disabled])`,
      );
    const found = control();
    if (found) {
      found.focus();
    } else {
      requestAnimationFrame(() => control()?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const partsList = (items: SchemaProp[]) => (
    <Details items={items.map((prop) => (prop.short && prop.key !== props.group ? { ...prop, label: prop.short } : prop))} type={props.type} inGroup inSheet />
  );
  return (
    <Sheet
      title={group.label ?? props.group}
      focusTitle={!props.focus}
      end={
        set.length > 0 &&
        state.readonly === 'no' && (
          <Btn
            variant="ghost"
            onClick={() => {
              // The button goes with the values: the title keeps focus.
              document.querySelector<HTMLElement>('.seo-sheet-header h2')?.focus();
              dispatch({
                type: 'apply',
                scope: 'target',
                values: {
                  ...state.edits.target,
                  schema: {
                    ...state.edits.target.schema,
                    props: Object.fromEntries(Object.entries(stored).filter(([key]) => !parts.some((prop) => prop.key === key))),
                  },
                },
                undo: allLinked ? `Unlinked ${group.label}` : `Cleared ${group.label}`,
              });
            }}
          >
            {allLinked ? 'Unlink all' : 'Clear'}
          </Btn>
        )
      }
      onClose={() => {
        props.onClose();
        // Back to where the jump came from while it is there: a part of
        // the sentence, a verdict's Add, its line (its proof has closed);
        // from anywhere else (the box, Checks, which the sheet replaced),
        // to the group's box.
        requestAnimationFrame(() =>
          (from?.isConnected && from.closest('.seo-schema-stage')
            ? from
            : document.querySelector<HTMLElement>(`.seo-group[data-path="schema.props.${props.group}"] .seo-group-box`)
          )?.focus(),
        );
      }}
    >
      <p className="seo-reads-as" role="status">
        Reads as: {reading || 'Not set'}
      </p>
      {/* What the group misses, and what the page does not show, said once
          for the whole group. */}
      {(whole || gap.text || notOnPage.length > 0) && (
        <div className="seo-group-gap">
          {whole && <Guide tone="fix">{whole.text}</Guide>}
          {gap.text && <Guide tone="improve">{gap.text}</Guide>}
          {notOnPage.length > 0 && <Guide tone="improve">Couldn't find {andList(notOnPage)} on this page.</Guide>}
        </div>
      )}
      <div className="seo-group-parts">
        {ref && refValue ? (
          <>
            {partsList([ref])}
            <List>
              {/* Its own details, used where the page has none: they read
                  as they are, "Not set" until one is. */}
              <Disclosure
                label="Own details, if the page has none"
                summary={line || 'Not set'}
                defaultOpen={own.some((prop) => stored[prop.key] !== undefined) || (!!props.focus && props.focus !== ref.key)}
              >
                <div className="seo-row-field seo-group-parts">{partsList(own)}</div>
              </Disclosure>
            </List>
          </>
        ) : (
          partsList(parts)
        )}
      </div>
    </Sheet>
  );
}

/** Opening hours: the week in one line, opening its sheet. */
function HoursBox(props: InputProps & { label: string; path: string }) {
  const { openSheet } = useApp();
  const week = parseHours(props.value);
  const valueId = useId();
  return (
    <button
      id={props.id}
      type="button"
      className="seo-group-box"
      // Named by its label, then what it reads: "Opening hours, Mon–Fri 09:00–17:00".
      aria-labelledby={`${props.id}-label ${valueId}`}
      aria-describedby={props.describedBy}
      disabled={props.disabled}
      onClick={() => openSheet({ kind: 'hours', path: props.path, label: props.label })}
    >
      <span id={valueId} className={week ? undefined : 'seo-muted'}>
        {week ? hoursLine(week) : 'Not set'}
      </span>
      <ChevronRightIcon aria-hidden />
    </button>
  );
}

/** The opening hours sheet. */
export function HoursSheet(props: { path: string; label: string; onClose(): void }) {
  const { state, dispatch, locked } = useApp();
  const value = (state.edits.target.schema?.props?.[props.path.slice('schema.props.'.length)] ?? undefined) as Value | undefined;
  const text = value && 'text' in value ? value.text : '';
  return (
    <Sheet
      title={props.label}
      focusTitle
      onClose={props.onClose}
      end={
        text !== '' &&
        !locked.target && (
          <Btn
            variant="ghost"
            onClick={() => {
              // The button goes with the week: the title keeps focus.
              document.querySelector<HTMLElement>('.seo-sheet-header h2')?.focus();
              dispatch({ type: 'apply', scope: 'target', values: setPath(state.edits.target, props.path, undefined), undo: `Cleared ${props.label}` });
            }}
          >
            Clear
          </Btn>
        )
      }
    >
      <WeekEditor
        label={props.label}
        value={text}
        disabled={locked.target}
        set={(next) => dispatch({ type: 'edit', scope: 'target', path: props.path, value: next === undefined ? undefined : { text: next } })}
      />
    </Sheet>
  );
}

/**
 * Where a fact of the sentence is set, in words: "set on this page", "from
 * Site", "from the Price field". `linked` names the field a stored value is
 * linked to.
 */
function sourceWords(fact: ReadFact, sources: Record<string, string>, type: Registry[string], here: string, linked: (key: string) => string | null): string {
  if (fact.site) {
    return 'from Site';
  }
  if (fact.fact === 'title') {
    return 'from Search';
  }
  const source = fact.prop ? sources[fact.prop] : undefined;
  if (source === 'site') {
    return 'from Site';
  }
  if (source === 'default') {
    const prop = type.props?.find((one) => one.key === fact.prop);
    const named = prop?.default && 'fact' in prop.default ? prop.default.fact : '';
    return named === 'title' ? 'from the page title' : named === 'description' ? 'from the description' : 'from the page';
  }
  const field = fact.prop ? linked(fact.prop) : null;
  return field === null ? here : field.includes('›') ? `from ${field}` : `from the ${field} field`;
}

/** The stage: what search engines read, the search features, and the page. */
function Stage(props: { onReveal(key: string): void }) {
  const { state, dispatch, goTo, openSheet, issues, ...app } = useApp();
  const server = state.server!;
  const report = server.resolved?.schema;
  const graph = server.resolved?.head.script.find((script) => script.type === 'application/ld+json')?.textContent as { '@graph'?: Record<string, unknown>[] } | undefined;
  const rules = server.search_features;
  const { id } = useType();
  const type = server.registry[report?.type ?? id] ?? server.registry.WebPage;
  const sources = report && !Array.isArray(report.sources) ? report.sources : {};
  const read = report && server.preview
    ? readback({ graph, url: server.preview.url, registry: server.registry, rules, type: report.type, nodes: report.nodes, locale: server.ui })
    : null;
  const [shownActive, setActive] = useState(0);
  const facts = read ? (read.sentence ? read.sentence.filter((part): part is ReadFact => typeof part !== 'string') : read.facts) : [];
  // One of the facts, or "Added by hand", is the group's one stop for Tab.
  const active = Math.min(shownActive, facts.length + (read?.hand.length ? 0 : -1));
  const group = useRef<HTMLDivElement>(null);
  const page = server.target?.scope === 'template' ? `this ${inSentence(server.target.label)}` : 'this page';
  // As the field's aside says it.
  const here = server.target?.scope === 'template' ? `set for every ${server.target.label}` : 'set on this page';
  const linked = (key: string) => {
    const stored = app.view!.effective.schema?.props?.[key];
    return stored && 'source' in stored ? tagOf(stored, app.view!.lookup) : null;
  };

  // A linked detail the previewed item has empty: "Ends: empty for this event".
  const emptyFor = (key: string) => {
    const stored = app.view!.effective.schema?.props?.[key];
    if (server.target?.scope !== 'template' || !stored || !('source' in stored)) {
      return null;
    }
    const prop = type.props?.find((one) => one.key === key);
    return resolve(stored, prop ? propKind(prop) : 'text', app.view!.lookup).status === 'empty' ? `${prop?.label ?? key}: empty for ${page}` : null;
  };
  const verdicts = stageVerdicts(report, `${server.preview?.url}#primary`, `${server.preview?.url}#webpage`);
  // A kind chosen but left out until it has what it needs: the sentence,
  // which reads the page as it ships, says so.
  const withheld = report?.withheld && report.type === id ? [...report.withheld.missing, ...report.withheld.dropped] : [];
  const notYet = notYetText(server.registry, rules, id, withheld);

  // A fix that took its own button away (Choose, once the image is there):
  // focus goes to its feature line, not to the document.
  const lines = useRef<HTMLUListElement>(null);
  const focusedLine = useRef<string | null>(null);
  useEffect(() => {
    const key = focusedLine.current;
    if (key === null || (document.activeElement && document.activeElement !== document.body)) {
      return;
    }
    const items = Array.from(lines.current?.querySelectorAll<HTMLElement>('[data-line]') ?? []);
    const item = items.find((one) => one.dataset.line === key && one.querySelector('button')) ?? items.find((one) => one.querySelector('button'));
    item?.querySelector<HTMLElement>('button')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  // A line whose words change, or that comes, is said once; one that goes,
  // or that is only drawn again (back from a sheet), is not.
  const [said, setSaid] = useState('');
  useEffect(() => {
    const words = (one: Verdict) => (one.verdict === 'ready' ? `${featureLabel(rules, one.feature)} can show` : one.feature === null ? verdictText(server, one, emptyFor) : lineName(featureLabel(rules, one.feature), verdictText(server, one, emptyFor)));
    const now = new Map(verdicts.map((one) => [`${one.feature}|${one.node}`, words(one)]));
    const key = server.target?.auto_save_key ?? '';
    const before = lastSaid.get(key);
    lastSaid.set(key, now);
    const changed = before && [...now].find(([line, text]) => before.get(line) !== text);
    if (changed) {
      setSaid(changed[1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);
  // Said, then cleared: a region shown again after a sheet, or a popover
  // that closes, never holds words to say a second time.
  useEffect(() => {
    if (!said) {
      return;
    }
    const timer = setTimeout(() => setSaid(''), 5000);
    return () => clearTimeout(timer);
  }, [said]);

  const press = (fact: ReadFact) => {
    if (fact.site) {
      goTo({ scope: 'site', tab: 'identity', field: fact.site });
    } else if (fact.fact === 'title') {
      goTo({ scope: 'target', tab: 'search', field: 'title' });
    } else if (fact.prop && sources[fact.prop] === 'default' && type.props?.find((one) => one.key === fact.prop)?.level === 'required') {
      // Its own field, opened in place, then focused as any jump is.
      props.onReveal(fact.prop);
      const path = `schema.props.${fact.prop}`;
      requestAnimationFrame(() => goTo({ scope: 'target', tab: 'schema', field: path }));
    } else if (fact.prop) {
      goTo({ scope: 'target', tab: 'schema', field: `schema.props.${fact.prop}` });
    }
  };
  // One stop for Tab; the arrow keys move between the facts.
  const keys = (event: KeyboardEvent<HTMLButtonElement>, at: number) => {
    const total = group.current?.querySelectorAll('[data-fact]').length ?? facts.length;
    const to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: total - 1 }[event.key];
    if (to === undefined) {
      return;
    }
    event.preventDefault();
    const next = Math.max(0, Math.min(total - 1, to));
    setActive(next);
    group.current?.querySelectorAll<HTMLButtonElement>('[data-fact]')[next]?.focus();
  };
  const button = (fact: ReadFact, at: number) => (
    <button
      key={`${fact.slot}-${at}`}
      type="button"
      className="seo-fact"
      data-fact=""
      tabIndex={at === active ? 0 : -1}
      aria-label={`${fact.label}, ${fact.full}, ${sourceWords(fact, sources, type, here, linked)}`}
      onFocus={() => setActive(at)}
      onKeyDown={(event) => keys(event, at)}
      onClick={() => press(fact)}
    >
      {fact.text}
    </button>
  );
  let count = 0;

  const match = stageMatch(issues);
  // Hand-added text nobody can see, or reviews of yourself: to fix.
  const handFix = issues.some((issue) => /^hand-/.test(issue.id) && issue.severity === 'fix');
  // Each fix is named after what it sets: "Add City", "Answer Bought on this page".
  const fix = (verdict: Verdict) => {
    const first = verdict.missing?.[0];
    if (verdict.verdict === 'unanswered') {
      const asked = type.props?.find((one) => one.key === 'sold_here')?.label ?? 'Bought on this page';
      return { label: 'Answer', name: `Answer ${asked}`, run: () => goTo({ scope: 'target', tab: 'schema', field: 'schema.props.sold_here' }) };
    }
    if (verdict.verdict !== 'needs' || !first) {
      return null;
    }
    const what = type.props?.find((one) => one.key === first.prop)?.label ?? rules.facts[first.path]?.label ?? first.path;
    if (first.site) {
      return { label: 'Set', name: `Set ${what}`, run: () => goTo({ scope: 'site', tab: 'identity', field: first.site! }) };
    }
    if (!first.prop) {
      return null;
    }
    const prop = type.props?.find((one) => one.key === first.prop);
    if (prop?.kind === 'image' && state.readonly === 'no') {
      return {
        label: 'Choose',
        name: `Choose ${what}`,
        run: () =>
          openSheet({
            kind: 'image',
            request: {
              minWidth: 600,
              chosen: state.edits.target.schema?.props?.[first.prop!],
              onPick: (value: Value) => dispatch({ type: 'edit', scope: 'target', path: `schema.props.${first.prop}`, value }),
            },
          }),
      };
    }
    return { label: 'Add', name: `Add ${what}`, run: () => goTo({ scope: 'target', tab: 'schema', field: `schema.props.${first.prop}` }) };
  };
  // Nothing set here: nothing of the editor's to compare with the page.
  const own = state.edits.target.schema;
  const nothingSet = !Object.keys(own?.props ?? {}).length && !own?.custom;
  // The line takes focus once a fix took its button away.
  const matchLine = useRef<HTMLParagraphElement>(null);
  // Named after where it goes: "Show Currency" for the same amount in
  // another currency.
  const shownField = match?.jump?.field ?? '';
  const showName = match?.id.startsWith('hand-') || shownField === 'schema.custom'
    ? 'Show in your own JSON-LD'
    : `Show ${type.props?.find((one) => `schema.props.${one.key}` === shownField)?.label ?? type.groups?.[shownField.slice('schema.props.'.length)]?.label ?? 'the field'}`;

  return (
    <section className="seo-stage seo-schema-stage" aria-labelledby="seo-understood" aria-busy={catchingUp(state) || undefined}>
      <div className="seo-stage-caption">
        <h3 id="seo-understood">Understood as</h3>
        <span className="seo-caption-tools">
          <Btn variant="ghost" size={24} onClick={() => openSheet({ kind: 'output', section: 'schema' })}>
            <CodeIcon aria-hidden />
            Code
          </Btn>
          <InfoTip
            label="About this view"
            text="This is what the page's structured data tells search engines, and the search features it makes possible. Search engines decide what they show."
          />
        </span>
      </div>
      {!read ? (
        <p className="seo-readback">There is no page to read back.</p>
      ) : (
        <div className="seo-readback" ref={group} role="group" aria-label="What search engines read">
          {read.sentence ? (
            <p lang={server.ui}>
              {read.sentence.map((part, at, all) => {
                if (typeof part !== 'string') {
                  // A fact keeps the mark after it on its line.
                  const next = all[at + 1];
                  const mark = typeof next === 'string' ? (next.match(/^[.,;:!?]/)?.[0] ?? '') : '';
                  return (
                    <span key={at} className="seo-nowrap">
                      {button(part, count++)}
                      {mark}
                    </span>
                  );
                }
                const previous = all[at - 1];
                return <span key={at}>{typeof previous !== 'string' && previous ? part.replace(/^[.,;:!?]/, '') : part}</span>;
              })}
              {notYet && <span className="seo-muted"> {notYet}</span>}
            </p>
          ) : (
            <dl className="seo-readback-list">
              {read.facts.map((fact, at) => (
                <div key={fact.slot}>
                  <dt>{fact.label}</dt>
                  <dd>{button(fact, at)}</dd>
                </div>
              ))}
            </dl>
          )}
          {(read.hand.length > 0 || issues.some((issue) => issue.id === 'hand-unsaved')) && (
            <p>
              <button
                type="button"
                className="seo-fact"
                data-fact=""
                data-tone={handFix ? 'fix' : undefined}
                aria-description={handFix ? 'Has something to fix' : undefined}
                tabIndex={active === facts.length ? 0 : -1}
                onFocus={() => setActive(facts.length)}
                onKeyDown={(event) => keys(event, facts.length)}
                onClick={() => openSheet({ kind: 'custom' })}
              >
                Added by hand
              </button>
              {read.hand.length > 0 && `: ${andList(read.hand)}.`}
              {issues.some((issue) => issue.id === 'hand-unsaved') && (
                <span className="seo-chip" data-tone="fix">
                  Not saved
                </span>
              )}
            </p>
          )}
        </div>
      )}
      <h4 className="seo-stage-sub">In search results</h4>
      <ul
        className="seo-features"
        ref={lines}
        onFocus={(event) => (focusedLine.current = (event.target as HTMLElement).closest<HTMLElement>('[data-line]')?.dataset.line ?? null)}
        onBlur={(event) => {
          // Left for another place, not lost with its button.
          if (event.relatedTarget) {
            focusedLine.current = null;
          }
        }}
      >
        {verdicts.map((verdict) => {
          const label = featureLabel(rules, verdict.feature);
          const words = verdictText(server, verdict, emptyFor);
          const action = fix(verdict);
          const quiet = QUIET.includes(verdict.verdict);
          return (
            <li key={`${verdict.feature}|${verdict.node}`} className="seo-feature" data-line={`${verdict.feature}|${verdict.node}`} data-verdict={verdict.verdict} data-quiet={quiet || undefined}>
              {verdict.feature === null ? (
                <span className="seo-feature-line">
                  <span className="seo-feature-words">{words}</span>
                </span>
              ) : (
                <Proof verdict={verdict} label={label} words={words} />
              )}
              {action && (
                <Btn variant="soft" size={24} aria-label={action.name} onClick={action.run}>
                  {action.label}
                </Btn>
              )}
            </li>
          );
        })}
      </ul>
      {/* Nothing set here and nothing to say: no line at all. */}
      {!(state.facts && !match && nothingSet) && (
        <p className="seo-match" ref={matchLine} tabIndex={-1} data-tone={state.facts && match ? (match.severity === 'fix' ? 'fix' : 'improve') : undefined}>
          {!state.facts ? (
            'No preview to check against.'
          ) : match ? (
            <>
              <span>
                {/* A quoted value is the editor's own text: isolated, as in the sentence. */}
                {match.message.split(/(“[^”]*”)/).map((part, at) => (at % 2 ? <bdi key={at}>{part}</bdi> : part))}
              </span>{' '}
              {match.fix && 'apply' in match.fix && state.readonly === 'no' && (
                <Btn
                  variant="soft"
                  size={24}
                  onClick={() => {
                    const fix = match.fix as { label: string; apply(values: typeof state.edits.target): typeof state.edits.target; undo?(values: typeof state.edits.target): string };
                    // The button would take the next item's place: focus stays on the line.
                    matchLine.current?.focus();
                    dispatch({ type: 'apply', scope: 'target', values: fix.apply(state.edits.target), undo: fix.undo?.(state.edits.target) ?? 'Fixed' });
                  }}
                >
                  {match.fix.label}
                </Btn>
              )}
              {match.jump && (
                <Btn variant="ghost" size={24} aria-label={showName} onClick={() => goTo(match.jump!)}>
                  Show
                </Btn>
              )}
            </>
          ) : (
            'The facts you set match the page.'
          )}
        </p>
      )}
      <p className="seo-visually-hidden" role="status">
        {said}
      </p>
    </section>
  );
}

/** A verdict's line, and its proof: what it needs, what helps, where it shows. */
function Proof(props: { verdict: Verdict; label: string; words: string }) {
  const { state, dispatch, goTo, openSheet, host, ...app } = useApp();
  const server = state.server!;
  const { verdict } = props;
  const rules = server.search_features;
  const feature = rules.features[verdict.feature!];
  const { id } = useType();
  const type = typeOf(server.registry, id);
  const graph = server.resolved?.head.script.find((script) => script.type === 'application/ld+json')?.textContent as { '@graph'?: Record<string, unknown>[] } | undefined;
  const main = `${server.preview?.url}#primary`;
  // A withheld main node is judged all the same: its proof reads its values.
  const { node, index } = judged(graph, verdict.node, main, server.resolved?.schema.withheld?.node);
  const isMain = verdict.node === main;
  // A part of a group left out until it is complete: it is set, and held
  // back. "Mannerheimintie 13e · left out until the address is complete".
  const report = server.resolved?.schema;
  const held = (path: string): string | null => {
    const found = isMain && report?.judged ? valueAt(report.judged, path, index) : undefined;
    if (found === undefined || found === null || typeof found === 'object') {
      return null;
    }
    const key = rules.props[path] ?? path.replace(/\./g, '_');
    const prop = type.props?.find((one) => one.key === key);
    const owner = prop?.part ?? prop?.group ?? '';
    const what = type.groups?.[owner]?.shape === 'address' ? 'address' : (type.groups?.[owner]?.label ?? 'group').toLowerCase();
    const shown = prop?.kind === 'enum' ? optionText(prop, String(found)) : String(found);
    return `${shown} · left out until the ${what} is complete`;
  };
  const [open, setOpen] = useState(false);
  // Changed from here: focus goes to the kind, not back to a line that goes.
  const moved = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const missing = new Set((verdict.missing ?? []).map((fact) => fact.path));
  const label = (path: string, prop?: string) =>
    type.props?.find((one) => one.key === (prop ?? (isMain ? rules.props[path] ?? path.replace(/\./g, '_') : undefined)))?.label ?? rules.facts[path]?.label ?? path;
  const go = (prop?: string, site?: string) => {
    setOpen(false);
    if (site) {
      goTo({ scope: 'site', tab: 'identity', field: site });
    } else if (prop && type.props?.find((one) => one.key === prop)?.kind === 'image') {
      openSheet({
        kind: 'image',
        request: {
          minWidth: 600,
          chosen: state.edits.target.schema?.props?.[prop],
          onPick: (value: Value) => dispatch({ type: 'edit', scope: 'target', path: `schema.props.${prop}`, value }),
        },
      });
    } else if (prop) {
      goTo({ scope: 'target', tab: 'schema', field: `schema.props.${prop}` });
    } else {
      openSheet({ kind: 'custom' });
    }
  };
  const not = verdict.verdict === 'not_fit' ? feature.not_for?.find((one) => one.id === verdict.reason) : undefined;
  // "Bought on this page", as it was answered.
  const soldHere = type.props?.find((one) => one.key === 'sold_here');
  const gates = server.resolved?.schema.gates;
  const gate = gates && !Array.isArray(gates) ? gates.sold_here : undefined;
  const value = (path: string): string | null => {
    const found = node ? valueAt(node, path, index) : undefined;
    if (found === undefined) {
      return null;
    }
    if (path.endsWith('price') && node) {
      const currency = valueAt(node, 'offers.priceCurrency', index);
      try {
        return typeof currency === 'string'
          ? new Intl.NumberFormat(server.ui, { style: 'currency', currency, minimumFractionDigits: Number.isInteger(Number(found)) ? 0 : 2 }).format(Number(found))
          : String(found);
      } catch {
        return String(found);
      }
    }
    if (path.endsWith('priceCurrency') && typeof found === 'string') {
      return currencyName(found, server.ui);
    }
    const prop = isMain ? type.props?.find((one) => one.key === (rules.props[path] ?? path.replace(/\./g, '_'))) : undefined;
    // A detail that decides and is never emitted reads as it was answered
    // ("On site or remote"), not as the code it gave.
    const answer = prop?.emit === false && gates && !Array.isArray(gates) ? gates[prop.key] : undefined;
    if (prop && answer) {
      return optionText(prop, answer);
    }
    // An image by the name it has in the media library, as its field shows it.
    if (prop?.kind === 'image') {
      const own = resolve(state.edits.target.schema?.props?.[prop.key] ?? prop.default, 'image', app.view!.lookup);
      if (own.image?.name) {
        return own.image.name;
      }
    }
    if (typeof found === 'object' && found !== null) {
      const named = (found as Record<string, unknown>).name;
      return typeof named === 'string' ? named : 'Set';
    }
    // Formatted text by its words: a job description.
    if (prop?.html && typeof found === 'string') {
      return plainText(found);
    }
    if (prop?.kind === 'date' && typeof found === 'string') {
      return dateWords(found, server.ui) ?? found;
    }
    if (prop?.kind === 'enum' && typeof found === 'string') {
      return optionText(prop, found.replace(/^https:\/\/schema\.org\//, ''));
    }
    return String(found).replace(/^https:\/\/schema\.org\//, '');
  };
  // The facts it asks for: of each entry, the one it misses, else the one
  // set, else the first ("Where the work is" while it is not answered).
  const asked = [...(feature.required ?? []), ...(feature.complete ?? [])].map((entry) => {
    const paths = (Array.isArray(entry) ? entry : [entry]).map((one) => one.split('|')[0]);
    return paths.find((path) => missing.has(path)) ?? paths.find((path) => value(path) !== null || held(path) !== null) ?? paths[0];
  });
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <button type="button" className="seo-feature-line" aria-label={lineName(props.label, props.words)}>
          {/* The space keeps the visible words apart, as the name says them. */}
          <span className="seo-feature-name">{props.label}</span>{' '}
          <span className="seo-feature-words">{props.words}</span>
        </button>
      </Popover.Trigger>
      <Popover.Content
        className="seo-proof"
        aria-label={props.label}
        side="bottom"
        align="start"
        collisionPadding={8}
        // Open on what it says, not on an action Enter would run unseen.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (moved.current) {
            moved.current = false;
            event.preventDefault();
          }
        }}
      >
        {/* Scrolls inside the popover's padding, so its edges stay framed. */}
        <div className="seo-proof-scroll">
          <h3 className="seo-proof-title" ref={title} tabIndex={-1}>
            {props.label}
          </h3>
          <p className="seo-proof-where">{feature.where}</p>
          {verdict.verdict === 'retired' ? (
            <p>{retiredText(feature.since, server.ui)}. Search engines no longer show it, whatever the page says.</p>
          ) : not ? (
            <>
              <p>
                <b>Doesn't fit: {not.reason}.</b> {not.why}
              </p>
              {not.suggest === 'Service' && isMain && kindOfType(server.registry, id) === 'Product' && (
                <ChangeToService
                  onDone={() => {
                    moved.current = true;
                    setOpen(false);
                  }}
                />
              )}
            </>
          ) : (
            <>
              {asked.length > 0 && (
                <dl className="seo-proof-facts">
                  {asked.map((path) => {
                    const fact = (verdict.missing ?? []).find((one) => one.path === path);
                    const shown = missing.has(path) ? null : (value(path) ?? held(path));
                    return (
                      <div key={path}>
                        <dt>{label(path, fact?.prop)}</dt>
                        <dd>
                          {shown ?? 'Not set'}
                          {fact && (
                            <Btn variant="soft" size={24} aria-label={`${fact.prop && type.props?.find((one) => one.key === fact.prop)?.kind === 'image' ? 'Choose' : 'Add'} ${label(path, fact.prop)}`} onClick={() => go(fact.prop, fact.site)}>
                              {fact.prop && type.props?.find((one) => one.key === fact.prop)?.kind === 'image' ? 'Choose' : 'Add'}
                            </Btn>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                  {feature.not_for?.some((one) => one.seller) && isMain && (
                    <div>
                      <dt>{type.props?.find((one) => one.key === 'sold_here')?.label ?? 'Bought on this page'}</dt>
                      <dd>
                        {gate === undefined ? 'Not answered' : optionText(soldHere!, gate)}
                        {gate !== 'yes' && (
                          <Btn variant="soft" size={24} aria-label={`Answer ${soldHere?.label ?? 'Bought on this page'}`} onClick={() => go('sold_here')}>
                            Answer
                          </Btn>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              {(verdict.helps ?? []).length > 0 && (
                <>
                  <h4>Also helps</h4>
                  <ul className="seo-proof-helps">
                    {(verdict.helps ?? []).slice(0, 4).map((fact) => (
                      <li key={fact.path}>
                        {label(fact.path, fact.prop)}
                        {(fact.prop || fact.site) && (
                          <Btn variant="soft" size={24} aria-label={`Add ${label(fact.path, fact.prop)}`} onClick={() => go(fact.prop, fact.site)}>
                            Add
                          </Btn>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(feature.confirm ?? []).length > 0 && (
                <>
                  <h4>Check yourself</h4>
                  <ul className="seo-proof-confirm">
                    {feature.confirm!.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <p className="seo-proof-foot">Meeting these makes a result possible. Search engines decide whether to show it.</p>
          <p className="seo-proof-foot">
            Rules checked {dateWords(rules.reviewed, server.ui)}.{' '}
            <Btn variant="ghost" size={24} onClick={() => host.openExternal((feature.doc ?? feature.changelog)!)}>
              {feature.status === 'retired' ? 'Changelog' : 'Documentation'}
            </Btn>
          </p>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

/** Plans for a service, from a product: its name, price and billing kept. */
function ChangeToService(props: { onDone?(): void }) {
  const { state, dispatch } = useApp();
  const server = state.server!;
  return (
    <Btn
      variant="soft"
      disabled={state.readonly !== 'no'}
      onClick={() => {
        props.onDone?.();
        dispatch({ type: 'apply', scope: 'target', values: withKind(server, state.edits.target, 'Service', state.errors.target), undo: 'Changed to plans for a service' });
        // The button goes with the hint: focus stays on the kind, which now reads it.
        requestAnimationFrame(() => document.querySelector<HTMLElement>('.seo-kind-trigger')?.focus());
      }}
    >
      Change to plans for a service
    </Btn>
  );
}

/** "What this page is": the kind that is output, and its sheet. */
function KindField() {
  const { state, openSheet, ...app } = useApp();
  const server = state.server!;
  const { id, type, inherited: isDefault, unknown } = useType();
  const kindId = kindOfType(server.registry, id);
  const kind = server.registry[kindId].kind!;
  const field = useField({ scope: 'target', path: 'schema.type', label: 'What this page is', noReset: true });
  const [suggesting, setSuggesting] = useState(false);
  const suggestId = useId();
  const Icon = ICONS[kind.icon] ?? FileIcon;
  const billing = app.view!.effective.schema?.props?.billing;
  const recurring = id === 'Product' && !!billing && 'text' in billing && billing.text !== 'once';
  // Nothing to preview: what it is, at rest, with no sheet to open.
  const atRest = state.readonly === 'empty';
  const reading = unknown ? `Not known: “${unknown}”` : kind.label;
  return (
    <div className="seo-field" ref={field.ref} data-path="schema.type" onFocus={field.onFocus} onBlur={field.onBlur}>
      <div className="seo-label-row">
        <label htmlFor={field.id} id={field.labelId} tabIndex={-1} className="seo-label">
          What this page is
        </label>
      </div>
      <div className="seo-type-row">
        {atRest ? (
          <span className="seo-kind-value" id={field.id}>
            <Icon aria-hidden />
            {reading}
            {isDefault && <span className="seo-chip">Default</span>}
          </span>
        ) : (
          <button
            type="button"
            id={field.id}
            className="seo-input seo-kind-trigger"
            aria-haspopup="dialog"
            // Named by its label; what it reads is its description.
            aria-describedby={[`${field.id}-kind`, recurring && `${field.id}-line`].filter(Boolean).join(' ')}
            onClick={() => openSheet({ kind: 'kinds' })}
          >
            <Icon aria-hidden />
            <span id={`${field.id}-kind`}>{reading}</span>
            {isDefault && !unknown && <span className="seo-chip">Default</span>}
          </button>
        )}
        {!atRest && (
          <SuggestButton id={suggestId} label="Suggest from this page" open={suggesting} onClick={() => setSuggesting(!suggesting)} />
        )}
      </div>
      {type.variant_of && (
        <p className="seo-guide-text seo-kind-variant">
          {server.registry[type.variant_of].variants}: {type.label}
        </p>
      )}
      {recurring && (
        <div className="seo-kind-hint">
          <p id={`${field.id}-line`}>Memberships and subscriptions are services.</p>
          <ChangeToService />
        </div>
      )}
      {suggesting && <SchemaSuggest opener={suggestId} onClose={() => setSuggesting(false)} />}
    </div>
  );
}

/** The kinds, each with what it is for and what it can earn. */
export function KindSheet(props: { focus?: 'else'; onDone(): void; onClose(): void }) {
  const { state, dispatch, openSheet } = useApp();
  const server = state.server!;
  const registry = server.registry;
  const { id, inherited: isDefault, unknown } = useType();
  const current = unknown ? '' : kindOfType(registry, id);
  // An unknown stored kind is output as a web page: that is what is chosen.
  const [choice, setChoice] = useState(unknown ? kindOfType(registry, 'WebPage') : current);
  const locked = state.readonly !== 'no';
  const to = choice === current ? null : choice;
  const lost = to ? removed(server, state.edits.target, to, server.ui) : [];
  const name = (kind: string) => registry[kind].kind!.name;
  // Focus starts on the chosen kind, as in any radio group.
  const group = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (props.focus === 'else') {
      // Back from the type search: on the button that opened it.
      document.querySelector<HTMLElement>('.seo-kind-else')?.focus();
    } else if (!locked) {
      (group.current?.querySelector<HTMLInputElement>('input:checked') ?? group.current?.querySelector<HTMLInputElement>('input'))?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The confirm takes room at the foot: the chosen card stays whole above it.
  useEffect(() => {
    group.current?.querySelector('input:checked')?.closest('label')?.scrollIntoView({ block: 'nearest' });
  }, [to]);
  const apply = () => {
    if (!to) {
      return;
    }
    // The inherited kind is chosen as the kind: settle() stores it only
    // where it differs from what is inherited.
    dispatch({
      type: 'apply',
      scope: 'target',
      values: withKind(server, state.edits.target, to, state.errors.target),
      undo: `Changed to ${name(to)}`,
    });
    props.onDone();
  };
  const sentence = to ? changeKindText(name(to), lost) : '';
  return (
    <Sheet
      title="What this page is"
      // Read-only, no kind takes focus: Back does, so Esc works.
      focusBack={locked}
      onClose={props.onClose}
      // The confirm is the sheet's foot: in sight, never over the list.
      foot={
        to && (
          <Notice
            actions={
              <>
                <Btn variant="soft" onClick={apply}>
                  Change to {name(to)}
                </Btn>
                {current && (
                  <Btn variant="outline" onClick={props.onDone}>
                    Keep {name(current)}
                  </Btn>
                )}
              </>
            }
          >
            {sentence}
          </Notice>
        )
      }
    >
      <fieldset className="seo-kinds" disabled={locked} ref={group}>
        {/* The sheet's title says it: the group's name is for assistive technology. */}
        <legend className="seo-visually-hidden">What is this page?</legend>
        {kinds(registry, server.target!.scope).map((kind) => {
          const entry = registry[kind].kind!;
          return (
            <label key={kind} className="seo-kind">
              <input
                type="radio"
                name="seo-kind"
                value={kind}
                checked={choice === kind}
                aria-labelledby={`seo-kind-${kind}`}
                aria-describedby={`seo-kind-${kind}-earn`}
                onChange={() => setChoice(kind)}
              />
              <span className="seo-kind-text">
                <span className="seo-kind-label" id={`seo-kind-${kind}`}>
                  {entry.label}
                  {kind === current && isDefault && <span className="seo-chip">Default</span>}
                  {unknown && kind === kindOfType(registry, 'WebPage') && <span className="seo-chip">Now</span>}
                </span>
                <small id={`seo-kind-${kind}-earn`}>
                  {entry.earn}
                  {entry.not_for && <span className="seo-kind-not">{entry.not_for}</span>}
                </small>
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="seo-sheet-intro">Results that search engines no longer show, such as FAQ and how-to, aren't offered.</p>
      {/* While a change waits, its confirm is the next stop after the list. It leaves the kind as it is. */}
      {!to && !locked && (
        <button type="button" className="seo-kind seo-kind-else" onClick={() => openSheet({ kind: 'custom', start: 'search', entry: 'What this page is' })}>
          <span className="seo-kind-text">
            <span className="seo-kind-label">Something else on this page</span>
            <small>A rating, a review, a discussion… Add it as its own item.</small>
          </span>
          <ChevronRightIcon aria-hidden className="seo-kind-chevron" />
        </button>
      )}
      {/* The confirm's sentence is said; its buttons are not read with it. */}
      <p className="seo-visually-hidden" role="status">
        {sentence}
      </p>
    </Sheet>
  );
}

/** "Kind of article": the variants of the kind, in More details. */
function VariantField(props: { kind: string }) {
  const { state, dispatch } = useApp();
  const server = state.server!;
  const registry = server.registry;
  const { id } = useType();
  const ids = [props.kind, ...Object.keys(registry).filter((one) => registry[one].variant_of === props.kind)];
  return (
    <Field scope="target" path="schema.variant" label={registry[props.kind].variants!} noReset>
      {(field) => (
        <Select.Root
          value={id}
          disabled={field.disabled}
          onValueChange={(to) => dispatch({ type: 'apply', scope: 'target', values: withKind(server, state.edits.target, to, state.errors.target), undo: `Changed to ${registry[to].label}` })}
        >
          <Select.Trigger id={field.id} className="seo-select-box" aria-labelledby={field.labelId} aria-describedby={field.describedBy} />
          <Select.Content position="popper" className="seo-select-content seo-select-fit">
            {ids.map((one) => (
              <Select.Item key={one} value={one}>
                {registry[one].label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      )}
    </Field>
  );
}

/** Read once per page, and gone once followed: custom JSON-LD moved behind Code. */
function useMovedNotice(key: string, has: boolean): [boolean, () => void] {
  const [shown, setShown] = useState(() => {
    if (!has) {
      return false;
    }
    try {
      const seen = window.localStorage.getItem(`canvas_metatag:moved:${key}`) !== null;
      window.localStorage.setItem(`canvas_metatag:moved:${key}`, '1');
      return !seen;
    } catch {
      return true;
    }
  });
  return [shown, () => setShown(false)];
}

export function SchemaTab() {
  const { state, openSheet, ...app } = useApp();
  const server = state.server!;
  const target = server.target!;
  const stored = state.edits.target.schema ?? {};
  const { id, type, unknown } = useType();
  const props = useShown(id, type);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [moved, dismissMoved] = useMovedNotice(target.auto_save_key, !!stored.custom);
  // Opened by any route, the sheet is found: the notice goes.
  useEffect(() => {
    if (app.sheet?.kind === 'custom') dismissMoved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.sheet]);
  // A field opened in place belongs to the kind it was opened for.
  useEffect(() => setRevealed(null), [id]);
  // While a recurring price rules the listing out, "Bought on this page"
  // decides nothing: it waits in More details.
  const billing = app.view!.effective.schema?.props?.billing;
  const recurring = id === 'Product' && !!billing && 'text' in billing && billing.text !== 'once';
  // The first four the scope offers: a recipe's ingredients and steps on a
  // content type, its times and image on a page.
  const offeredFirst = (type.main ?? []).filter((key) => props.some((prop) => prop.key === key || prop.group === key)).slice(0, 4);
  const first = [
    ...(revealed && !offeredFirst.includes(revealed) ? [revealed] : []),
    ...offeredFirst.filter((key) => !(recurring && key === 'sold_here' && revealed !== key)),
  ];
  // A detail shown under another ("Open to people in" under "Where the
  // work is") goes where that one goes.
  const inFirst = (prop: SchemaProp): boolean =>
    first.includes(prop.key) || (!!prop.group && first.includes(prop.group)) || (!!prop.under && first.includes(prop.under));
  const main = first.flatMap((key) => [
    ...props.filter((prop) => prop.key === key || (prop.group === key && !props.some((one) => one.key === key))),
    ...props.filter((prop) => prop.under === key),
  ]);
  const more = props.filter((prop) => !inFirst(prop));
  // More details names groups by their label, once; a default that may need
  // changing (the organizer is the site) first, with what it is.
  const report = server.resolved?.schema.type === id ? server.resolved.schema : undefined;
  // Someone nobody chose: the site by a Canvas page's default, or a name
  // part's own default (the page's author).
  const byDefault = (prop: SchemaProp): string | null => {
    if (report?.defaults?.includes(prop.group ?? prop.key)) {
      return `${app.view!.lookup.facts.site?.value || server.site.identity.name || 'This site'} (this site)`;
    }
    if (!prop.group || type.groups?.[prop.group]?.shape !== 'who' || Object.keys(stored.props ?? {}).some((key) => key === prop.group || key.startsWith(`${prop.group}_`))) {
      return null;
    }
    const part = props.find((one) => one.group === prop.group && one.default && 'fact' in one.default);
    const found = part ? resolve(part.default, 'text', app.view!.lookup) : null;
    return found?.status === 'ok' && found.text ? found.text : null;
  };
  const named = more
    .filter((prop, index) => !prop.group || more.findIndex((one) => one.group === prop.group) === index)
    .sort((a, b) => Number(!!byDefault(b)) - Number(!!byDefault(a)))
    .map((prop) => {
      const label = prop.group ? (type.groups?.[prop.group]?.label ?? prop.label) : prop.label;
      const who = byDefault(prop);
      return who ? `${label}: ${who}` : label;
    });
  const kind = kindOfType(server.registry, id);
  const variants = !!server.registry[kind].variants && Object.values(server.registry).some((one) => one.variant_of === kind);

  return (
    <>
      {unknown && (
        <Notice
          actions={
            state.readonly === 'no' && (
              <Btn variant="outline" onClick={() => openSheet({ kind: 'kinds' })}>
                Choose what it is
              </Btn>
            )
          }
        >
          This page was described as “{unknown}”, which this site no longer knows. Search engines get a plain web page.
        </Notice>
      )}
      {moved && (
        <Notice
          actions={
            <Btn
              variant="outline"
              onClick={() => {
                // Followed: the notice goes, and the way back is Code, where it lives now.
                document.querySelector<HTMLElement>('.seo-schema-stage .seo-caption-tools .seo-btn')?.focus();
                openSheet({ kind: 'custom' });
                dismissMoved();
              }}
            >
              Open it
            </Btn>
          }
        >
          Custom JSON-LD moved to Code › Add your own JSON-LD
        </Notice>
      )}
      {server.preview && <Stage onReveal={setRevealed} />}
      <KindField />
      <Details items={main} type={id} revealed={revealed} />
      {(more.length > 0 || variants) && (
        <List>
          <Disclosure
            label="More details"
            summary={
              // Each detail by its own label, as its field reads.
              named.length > 2
                ? `${named.slice(0, 2).join(', ')}, ${named.length - 2} more`
                : named.join(', ') || server.registry[kind].variants!
            }
            // Open when it holds a value set here, or a problem.
            defaultOpen={more.some((prop) => stored.props?.[prop.key] !== undefined || state.errors.target[`schema.props.${prop.key}`] !== undefined)}
          >
            <div className="seo-row-field seo-more-details">
              {variants && <VariantField kind={kind} />}
              <Details items={more} type={id} />
            </div>
          </Disclosure>
        </List>
      )}
    </>
  );
}
