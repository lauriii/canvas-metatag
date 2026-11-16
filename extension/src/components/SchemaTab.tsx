import {
  CalendarIcon,
  CodeIcon,
  CubeIcon,
  FileIcon,
  LayersIcon,
  PersonIcon,
  ReaderIcon,
} from '@radix-ui/react-icons';
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
import { leftOutText, retiredText, stageMatch } from '../checks';
import {
  andList,
  catchingUp,
  changeKindText,
  currencyName,
  currencyChoices,
  dateText,
  featureLabel,
  inSentence,
  kindOfType,
  kinds,
  leaveOut,
  optionText,
  removed,
  stageVerdicts,
  typeOf,
  withKind,
} from '../model';
import { type ReadFact, dateWords, itemKind, itemName, judged, readback, valueAt } from '../readback';
import type { GraphNode, Registry, SchemaProp, StatePayload, Value, Verdict } from '../types';
import { PROP_KINDS, factsFor, resolve, sameValue, tagOf } from '../values';
import { Field, useField, useHeld } from './Field';
import { useRecheck } from './ChecksSheet';
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

/** The words of a verdict: "Needs an image", "Doesn't fit: a recurring price". */
export function verdictText(server: StatePayload, verdict: Verdict, emptyFor?: (prop: string) => string | null): string {
  const rules = server.search_features;
  const feature = verdict.feature ? rules.features[verdict.feature] : undefined;
  switch (verdict.verdict) {
    case 'ready':
      return 'Can show';
    case 'complete':
      return 'Complete';
    case 'unanswered':
      return 'Only if people buy it here';
    case 'not_fit':
      return `Doesn't fit: ${feature?.not_for?.find((one) => one.id === verdict.reason)?.reason ?? verdict.reason}`;
    case 'not_here':
      return 'Not shown here';
    case 'retired':
      return retiredText(feature?.since, server.ui);
    case 'none':
      return 'No search feature';
    default: {
      const first = verdict.missing?.[0];
      if (!first) {
        return 'Needs more';
      }
      // A linked detail the previewed item has empty: said for the item.
      const empty = first.prop ? emptyFor?.(first.prop) : null;
      if (empty) {
        return `Needs ${empty}`;
      }
      const rule = first.rule === undefined ? undefined : feature?.rules?.[first.rule];
      const need = rule?.need ?? rules.facts[first.path]?.need ?? first.path;
      const more = (verdict.missing?.length ?? 1) - 1;
      return `Needs ${need}${more ? ` and ${more} more` : ''}`;
    }
  }
}

/** A feature line in words: "Merchant listing doesn't fit: a recurring price". */
export const lineName = (label: string, words: string) =>
  words.startsWith("Doesn't fit") ? `${label} doesn't fit${words.slice(11)}` : `${label}: ${words}`;

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
      placeholder={props.placeholder ?? (props.kind === 'url' ? 'https://' : props.kind === 'number' ? '0.00' : undefined)}
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

/** A select of options, or of currencies; "Not set" first. */
function OptionInput(props: InputProps & { prop: SchemaProp; none: string }) {
  const { state } = useApp();
  const server = state.server!;
  const currencies = props.prop.kind === 'currency' ? currencyChoices(server.ui, [props.value, server.site.currency]) : null;
  const options = currencies
    ? currencies.rest
    : (props.prop.options ?? []).map((option) => [option, optionText(props.prop, option)] as const);
  // A value stored before the list was what it is ("RMB") is shown as it is.
  const kept = props.value && !options.some(([value]) => value === props.value) && !currencies?.common.some(([value]) => value === props.value) ? [[props.value, props.value] as const] : [];
  return (
    <Select.Root
      value={props.value || 'none'}
      disabled={props.disabled}
      onValueChange={(value) => props.set(value === 'none' ? undefined : value)}
    >
      <Select.Trigger
        id={props.id}
        className="seo-select-box"
        aria-describedby={props.describedBy}
        onKeyDown={props.onKeyDown}
      />
      <Select.Content position="popper" className="seo-select-content seo-select-fit">
        <Select.Item value="none">{props.none}</Select.Item>
        {currencies && (
          <>
            {currencies.common.map(([value, label]) => (
              <Select.Item key={value} value={value}>
                {label}
              </Select.Item>
            ))}
            <Select.Separator />
          </>
        )}
        {[...kept, ...options].map(([value, label]) => (
          <Select.Item key={value} value={value}>
            {label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

/** One detail of the chosen type, by its kind. A stored value overrides the default. */
function Detail(props: { prop: SchemaProp; type: string; revealed?: boolean }) {
  const { prop } = props;
  const { state, dispatch, openSheet, goTo, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const template = server.target!.scope === 'template';
  const path = `schema.props.${prop.key}`;
  const kind = PROP_KINDS[prop.kind];
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
  const needed = report?.type === props.type
    ? [...new Set(report.features.filter((verdict) => verdict.missing?.some((one) => one.prop === prop.key)).map((verdict) => server.search_features.features[verdict.feature!]?.for ?? ''))].filter(Boolean)
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
  // A detail whose absence points at the site: "Organizer" names the site.
  const ref = Object.values(typeOf(server.registry, props.type).refs ?? {}).find((one) => typeof one !== 'string' && one.unless === prop.key && one.to === 'identity');
  const siteName = view.lookup.facts.site?.value || server.site.identity.name;
  const bySite = !!ref && stored === undefined && siteName !== '';

  return (
    <ValueField
      path={path}
      label={prop.label}
      kind={kind}
      linkable={linkable}
      lookup={lookup}
      typing={prop.kind === 'text' && !prop.pattern}
      choices={prop.kind === 'enum' ? prop.options : undefined}
      byDefault={prop.default ?? null}
      instead={fact ? `its ${view.facts[fact]?.label ?? fact} is used` : 'the detail is left out'}
      required={prop.level === 'required' || needed.length > 0}
      missing={
        stored === undefined && unset?.status !== 'ok' && needed.length ? (
          `Needed for ${needed.join(' and ')}`
        ) : prop.level === 'required' && stored === undefined && !prop.default ? (
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
        prop.kind === 'enum' || prop.kind === 'currency' ? (
          <OptionInput {...input} prop={prop} none={prop.key === 'sold_here' ? 'Not answered' : site ? `Site currency: ${site}` : 'Not set'} />
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

/** Lays details out; a price and its currency share a row where there is room. */
function Details(props: { items: SchemaProp[]; type: string; revealed?: string | null }) {
  const rows: ReactNode[] = [];
  const { items } = props;
  for (let index = 0; index < items.length; index++) {
    const prop = items[index];
    const next = items[index + 1];
    if (prop.kind === 'number' && next?.kind === 'currency') {
      rows.push(
        <div className="seo-pair seo-price" key={prop.key}>
          <Detail prop={prop} type={props.type} />
          <Detail prop={next} type={props.type} />
        </div>,
      );
      index++;
      continue;
    }
    rows.push(<Detail key={prop.key} prop={prop} type={props.type} revealed={prop.key === props.revealed} />);
  }
  return rows;
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
    return resolve(stored, PROP_KINDS[prop?.kind ?? 'text'], app.view!.lookup).status === 'empty' ? `${prop?.label ?? key}: empty for ${page}` : null;
  };
  const verdicts = stageVerdicts(report, `${server.preview?.url}#primary`, `${server.preview?.url}#webpage`);

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
    : `Show ${type.props?.find((one) => `schema.props.${one.key}` === shownField)?.label ?? 'the field'}`;

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
          {read.hand.length > 0 && (
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
              : {andList(read.hand)}.
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
          const quiet = ['not_fit', 'not_here', 'retired', 'none'].includes(verdict.verdict);
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
  // The facts it asks for: the first path of each entry.
  const asked = [...(feature.required ?? []), ...(feature.complete ?? [])].map((entry) => (Array.isArray(entry) ? entry[0] : entry).split('|')[0]);
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
    // An image by the name it has in the media library, as its field shows it.
    const prop = isMain ? type.props?.find((one) => one.key === (rules.props[path] ?? path.replace(/\./g, '_'))) : undefined;
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
    if (prop?.kind === 'date' && typeof found === 'string') {
      return dateWords(found, server.ui) ?? found;
    }
    if (prop?.kind === 'enum' && typeof found === 'string') {
      return optionText(prop, found.replace(/^https:\/\/schema\.org\//, ''));
    }
    return String(found).replace(/^https:\/\/schema\.org\//, '');
  };
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
                    const shown = missing.has(path) ? null : value(path);
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
        dispatch({ type: 'apply', scope: 'target', values: withKind(server, state.edits.target, 'Service'), undo: 'Changed to plans for a service' });
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
export function KindSheet(props: { onDone(): void; onClose(): void }) {
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
    if (!locked) {
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
      values: withKind(server, state.edits.target, to),
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
        {kinds(registry).map((kind) => {
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
      <p className="seo-sheet-intro">FAQ, how-to and other results search engines no longer show are not offered.</p>
      {/* While a change waits, its confirm is the next stop after the list. */}
      {!to && (
        <p className="seo-sheet-intro">
          Something else?{' '}
          <Btn variant="ghost" size={24} onClick={() => openSheet({ kind: 'custom' })}>
            Add your own JSON-LD
          </Btn>
        </p>
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
          onValueChange={(to) => dispatch({ type: 'apply', scope: 'target', values: withKind(server, state.edits.target, to), undo: `Changed to ${registry[to].label}` })}
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
  const props = type.props ?? [];
  const [revealed, setRevealed] = useState<string | null>(null);
  const [moved, dismissMoved] = useMovedNotice(target.auto_save_key, !!stored.custom);
  // A field opened in place belongs to the kind it was opened for.
  useEffect(() => setRevealed(null), [id]);
  // While a recurring price rules the listing out, "Bought on this page"
  // decides nothing: it waits in More details.
  const billing = app.view!.effective.schema?.props?.billing;
  const recurring = id === 'Product' && !!billing && 'text' in billing && billing.text !== 'once';
  const first = [
    ...(revealed && !type.main?.includes(revealed) ? [revealed] : []),
    ...(type.main ?? []).filter((key) => !(recurring && key === 'sold_here' && revealed !== key)),
  ];
  const main = first.flatMap((key) => props.filter((prop) => prop.key === key));
  const more = props.filter((prop) => !first.includes(prop.key));
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
              more.length > 2
                ? `${more.slice(0, 2).map((prop, index) => (index ? prop.label.toLowerCase() : prop.label)).join(', ')}, ${more.length - 2} more`
                : more.map((prop, index) => (index ? prop.label.toLowerCase() : prop.label)).join(', ') || server.registry[kind].variants!
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

/** Indented for reading; stored as typed. Text that does not parse stays as it is. */
function pretty(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** "Line 4: this is not valid JSON.", or nothing when the text parses. */
function jsonError(text: string): string | undefined {
  if (text.trim() === '') {
    return undefined;
  }
  try {
    JSON.parse(text);
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const at = message.match(/position (\d+)/)?.[1];
    const line =
      message.match(/line (\d+)/)?.[1] ??
      (at === undefined ? undefined : String(text.slice(0, Number(at)).split('\n').length));
    return line === undefined ? 'This is not valid JSON.' : `Line ${line}: this is not valid JSON.`;
  }
}

/** What each hand-added item gives: its verdicts, its rules and the page. */
function HandItems() {
  const { state, dispatch, issues } = useApp();
  const recheck = useRecheck();
  const server = state.server!;
  const report = server.resolved?.schema;
  const rules = server.search_features;
  const items = (report?.nodes ?? []).filter((node) => node.origin === 'hand');
  // An item without an id is matched by what its features apply to.
  const own = (node: GraphNode, verdict: Verdict) =>
    node.id !== null
      ? verdict.node === node.id
      : verdict.node === null && verdict.feature !== null && !!rules.features[verdict.feature]?.on.includes(node.type);
  if (!items.length) {
    return null;
  }
  // By the name the stage reads back, and what it is: "Pricing questions · FAQ".
  const graph = server.resolved?.head.script.find((script) => script.type === 'application/ld+json')?.textContent as { '@graph'?: Record<string, unknown>[] } | undefined;
  let written: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(state.edits.target.schema?.custom ?? '');
    written = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Not JSON yet: its items are named by their type.
  }
  const itemOf = (node: GraphNode) => {
    const data = (node.at !== undefined ? graph?.['@graph']?.[node.at] : undefined) ?? written[node.item!];
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : { '@type': node.type };
  };
  const words = (node: GraphNode) => {
    const item = itemOf(node);
    const own = itemName(item, rules);
    const what = itemKind(item, rules);
    const name = own === what ? what : `${own} · ${what}`;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };
  const skipped = (node: GraphNode) => node.left_out === 'skip';
  const putBack = (node: GraphNode) => {
    const written = node.id?.startsWith(`${server.preview?.url}#`) ? node.id.slice(server.preview!.url.length) : node.id;
    const schema = state.edits.target.schema ?? {};
    dispatch({
      type: 'apply',
      scope: 'target',
      values: { ...state.edits.target, schema: { ...schema, skip: (schema.skip ?? []).filter((one) => one !== written && one !== node.id) } },
      undo: 'Put back',
    });
  };
  return (
    <section className="seo-hand" aria-labelledby="seo-hand-title">
      <h3 id="seo-hand-title">Your items</h3>
      <ul>
        {items.map((node) => {
          const verdicts = node.left_out ? [] : (report?.features ?? []).filter((one) => own(node, one));
          const lines = issues.filter((issue) => issue.id.startsWith('hand-') && new RegExp(`^hand-\\w+:${node.item}(:|$)`).test(issue.id));
          return (
            <li key={node.item} className="seo-hand-item">
              <p className="seo-hand-name" tabIndex={-1}>
                {words(node)}
                {node.left_out && (
                  <span className="seo-meta">
                    {' · '}
                    {skipped(node)
                      ? "Left out until it's on the page"
                      : node.left_out === 'reserved'
                        ? "Left out: it uses an id of the site's own"
                        : 'Left out: another item has the same id'}
                  </span>
                )}
              </p>
              {verdicts.map((verdict) => {
                // "Not shown since 7 May 2026", not "FAQ · …" under an FAQ.
                const label = featureLabel(rules, verdict.feature);
                const same = label.toLowerCase() === itemKind(itemOf(node), rules).toLowerCase();
                return (
                  <p key={verdict.feature} className="seo-meta">
                    {same ? verdictText(server, verdict) : `${label} · ${verdictText(server, verdict)}`}
                  </p>
                );
              })}
              {lines.map((issue) => (
                <div key={issue.id} className="seo-hand-line" data-tone={issue.severity === 'fix' ? 'fix' : 'improve'}>
                  <span className="seo-hand-text" id={`seo-hand-${node.item}-${issue.id}`}>
                    {issue.id.startsWith('hand-identity:') ? issue.detail : issue.message}
                  </span>
                  {issue.fix && 'apply' in issue.fix && state.readonly === 'no' && (
                    <Btn
                      variant="soft"
                      size={24}
                      aria-describedby={`seo-hand-${node.item}-${issue.id}`}
                      onClick={(event) => {
                        const next = leaveOut(state.edits.target, node, server.preview?.url ?? '');
                        if (next) {
                          // The line and its button go: focus stays with the item.
                          event.currentTarget.closest('li')?.querySelector<HTMLElement>('.seo-hand-name')?.focus();
                          dispatch({ type: 'apply', scope: 'target', values: next.values, undo: leftOutText(next) });
                        }
                      }}
                    >
                      {issue.fix.label}
                    </Btn>
                  )}
                  {issue.recheck && (
                    <Btn variant="ghost" size={24} aria-describedby={`seo-hand-${node.item}-${issue.id}`} onClick={() => recheck(issue.id)}>
                      {issue.recheck}
                    </Btn>
                  )}
                </div>
              ))}
              {skipped(node) && state.readonly === 'no' && (
                <Btn variant="ghost" size={24} onClick={() => putBack(node)}>
                  Put it back
                </Btn>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One object or a list, parsed here when the field is left and validated again by the server. */
export function CustomJson() {
  const { state, dispatch } = useApp();
  const stored = state.edits.target.schema?.custom ?? '';
  const [bad, setBad] = useState<string>();
  const held = useHeld(
    pretty(stored),
    (text) => dispatch({ type: 'edit', scope: 'target', path: 'schema.custom', value: text }),
    true,
  );
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => area.current?.focus(), []);
  const target = state.server?.target;
  return (
    <>
      <p className="seo-sheet-intro">
        Added to {target?.scope === 'template' ? `every ${inSentence(target.label)}'s` : "this page's"} structured data.{' '}
        <InfoTip
          label="About names in braces"
          text="In its texts, {title}, {description}, {site}, {sep}, {url}, {author}, {published}, {modified} and {image} are filled in with the page's values. Other text in braces stays as typed."
        />
      </p>
      <div className="seo-json-wrap">
        <Field scope="target" path="schema.custom" label="Your own JSON-LD" labelHidden error={bad}>
          {(field) => (
            <div>
              <textarea
                ref={area}
                id={field.id}
                className="seo-input seo-json"
                rows={12}
                spellCheck={false}
                disabled={field.disabled}
                aria-invalid={field.invalid || undefined}
                aria-describedby={field.describedBy}
                value={held.value}
                onChange={(event) => {
                  setBad(undefined);
                  held.onChange(event);
                }}
                onBlur={() => {
                  setBad(jsonError(held.value));
                  held.onBlur();
                }}
                onKeyDown={held.onKeyDown}
              />
            </div>
          )}
        </Field>
      </div>
      <HandItems />
    </>
  );
}
