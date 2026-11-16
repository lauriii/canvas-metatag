import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Select } from '@radix-ui/themes';
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useApp } from '../App';
import { REGISTRY, dateText, inSentence, inherited } from '../model';
import type { SchemaProp } from '../types';
import { PROP_KINDS, brokenWhy, factsFor, resolve, sameValue } from '../values';
import { Field, Guide, useField, useHeld } from './Field';
import { ImageRow } from './MediaPicker';
import { Disclosure, List, NavRow } from './SettingsList';
import { SchemaSuggest, SuggestButton } from './Suggest';
import { Btn, InfoTip, Notice, settleList } from './ui';
import { type InputProps, TextInput, ValueField } from './Value';

const IDS = Object.keys(REGISTRY);
const FAMILIES = IDS.filter((id) => !REGISTRY[id].extends);
const variants = (family: string) =>
  IDS.filter((id) => REGISTRY[id].extends === family);
/** The Type select: web pages, then each family with its variants, then the rest. */
const GROUPS = [
  {
    label: 'Web page',
    ids: FAMILIES.filter(
      (id) => !REGISTRY[id].primary_type && !variants(id).length,
    ),
  },
  ...FAMILIES.filter((id) => variants(id).length).map((id) => ({
    label: REGISTRY[id].label,
    ids: [id, ...variants(id)],
  })),
  {
    label: 'More specific',
    ids: FAMILIES.filter(
      (id) => REGISTRY[id].primary_type && !variants(id).length,
    ),
  },
].filter((group) => group.ids.length > 0);

/** What an unset detail says about its default. */
const DEFAULTS: Record<string, string> = {
  title: 'From the page title',
  description: 'Same as description',
  image: 'From the Image field',
};

/** "InStock" → "In stock", "FAQPage" → "FAQ page". */
const words = (option: string) =>
  option
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/ ([A-Z])(?=[a-z])/g, (_, letter: string) => ` ${letter.toLowerCase()}`);

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
      (at === undefined
        ? undefined
        : String(text.slice(0, Number(at)).split('\n').length));
    return line === undefined
      ? 'This is not valid JSON.'
      : `Line ${line}: this is not valid JSON.`;
  }
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

/** One detail of the chosen type, by its kind. A stored value overrides the default. */
function Detail(props: { prop: SchemaProp; type: string }) {
  const { prop } = props;
  const { state, dispatch, openSheet, ...app } = useApp();
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
      required={prop.level === 'required'}
      missing={
        prop.level === 'required' && stored === undefined && !prop.default
          ? `Needed for ${REGISTRY[props.type].label}`
          : undefined
      }
      fallback={stored === undefined && fact ? (DEFAULTS[fact] ?? 'From the page') : undefined}
      noStage
      group={kind === 'image'}
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
      placeholder={placeholder}
      input={(input) =>
        prop.kind === 'enum' ? (
          <Select.Root
            value={input.value || 'none'}
            disabled={input.disabled}
            onValueChange={(value) => input.set(value === 'none' ? undefined : value)}
          >
            <Select.Trigger
              id={input.id}
              className="seo-select-box"
              aria-describedby={input.describedBy}
              onKeyDown={input.onKeyDown}
            />
            <Select.Content position="popper" className="seo-select-content seo-select-fit">
              <Select.Item value="none">Not set</Select.Item>
              {(prop.options ?? []).map((option) => (
                <Select.Item key={option} value={option}>
                  {words(option)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
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
          <TextInput {...input} placeholder={placeholder} lang={server.langcode} required={prop.level === 'required'} />
        )
      }
    />
  );
}

/** Lays details out; short pairs share a row where there is room. */
function Details(props: { items: SchemaProp[]; type: string }) {
  const short = (prop: SchemaProp) =>
    prop.kind === 'text' && !prop.default && !prop.pattern;
  const rows: ReactNode[] = [];
  const { items } = props;
  for (let index = 0; index < items.length; index++) {
    const prop = items[index];
    const next = items[index + 1];
    // A number and its code: Price + Currency.
    if (prop.kind === 'number' && next?.kind === 'text' && next.pattern) {
      rows.push(
        <div className="seo-pair" key={prop.key}>
          <Detail prop={prop} type={props.type} />
          <Detail prop={next} type={props.type} />
        </div>,
      );
      index++;
      continue;
    }
    const run = [prop];
    while (
      short(run[0]) &&
      index + 1 < items.length &&
      short(items[index + 1])
    ) {
      run.push(items[++index]);
    }
    rows.push(
      run.length > 1 ? (
        <div className="seo-pair" data-even="" key={run[0].key}>
          {run.map((one) => (
            <Detail key={one.key} prop={one} type={props.type} />
          ))}
        </div>
      ) : (
        <Detail key={prop.key} prop={prop} type={props.type} />
      ),
    );
  }
  return rows;
}

export function SchemaTab() {
  const { state, dispatch, openSheet, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const target = server.target!;
  const stored = state.edits.target.schema ?? {};
  const chosen = view.effective.schema?.type;
  const typeId = chosen && REGISTRY[chosen] ? chosen : 'WebPage';
  const type = REGISTRY[typeId];
  const props = type.props ?? [];

  const [suggesting, setSuggesting] = useState(false);
  const suggestId = useId();
  // A change that would drop stored details asks first, in place.
  const [asking, setAsking] = useState<{
    to: string | undefined;
    dropped: number;
  } | null>(null);

  function setType(to: string | undefined, confirmed = false) {
    // Unset, the type is the inherited one: a translation keeps the details
    // of its default version's type.
    const next =
      REGISTRY[to ?? String(inherited(server, 'target', 'schema.type'))]
        ?.props ?? [];
    const kept = Object.fromEntries(
      Object.entries(stored.props ?? {}).filter(([key]) =>
        next.some((prop) => prop.key === key),
      ),
    );
    const dropped =
      Object.keys(stored.props ?? {}).length - Object.keys(kept).length;
    if (dropped > 0 && !confirmed) {
      setAsking({ to, dropped });
      return;
    }
    setAsking(null);
    dispatch({
      type: 'apply',
      scope: 'target',
      values: {
        ...state.edits.target,
        schema: { ...stored, type: to, props: kept },
      },
      ...(to === undefined ? { undo: 'Reset', path: 'schema.type' } : {}),
    });
  }

  const typeField = useField({
    scope: 'target',
    path: 'schema.type',
    label: 'Type',
    resetTip: 'the default type',
    onReset: () => setType(undefined),
  });

  // The report describes the saved draft: it catches up when a write is confirmed.
  const report = server.resolved?.schema;
  const current =
    report &&
    (target.values.schema?.type ??
      target.from_default.schema?.type ??
      'WebPage') === typeId;
  const missingProps = current
    ? (report.missing_required ?? []).flatMap((key) => props.filter((prop) => prop.key === key))
    : [];
  const missing = missingProps.map((prop) => prop.label);
  // A missing detail that is linked gives nothing for the previewed item: the
  // line says that, not "Add".
  const typeName = target.scope === 'template' ? inSentence(target.label) : 'page';
  const linkState = (prop: SchemaProp) => {
    const value = view.effective.schema?.props?.[prop.key];
    if (!value || !('source' in value)) {
      return null;
    }
    const status = resolve(value, PROP_KINDS[prop.kind], view.lookup).status;
    return status === 'hidden'
      ? `hidden from visitors for this ${typeName}`
      : status === 'broken'
        ? `linked to a field that ${brokenWhy(view.lookup.broken?.[`schema.props.${prop.key}`]?.reason, PROP_KINDS[prop.kind])}`
        : `empty for this ${typeName}`;
  };
  const toAdd = missingProps.filter((prop) => linkState(prop) === null).map((prop) => prop.label);
  const linkedOut = missingProps.filter((prop) => linkState(prop) !== null);
  const missingLine = toAdd.length
    ? `Add ${toAdd.join(' and ')} to show ${type.label} details in search.`
    : linkedOut.length === 1
      ? `${linkedOut[0].label} is ${linkState(linkedOut[0])}, so ${type.label} details are left out.`
      : `${linkedOut.map((prop) => prop.label).join(' and ')} give nothing for this ${typeName}, so ${type.label} details are left out.`;
  const main = props.filter(
    (prop) =>
      prop.level === 'required' ||
      (prop.level === 'recommended' && !prop.default),
  );
  const more = props.filter((prop) => !main.includes(prop));
  const customType = (() => {
    try {
      const data = JSON.parse(stored.custom ?? '');
      const found = (Array.isArray(data) ? data[0] : data)?.['@type'];
      return typeof found === 'string' ? `${words(found)} · ` : '';
    } catch {
      return '';
    }
  })();
  const lineId = `${typeField.id}-line`;
  // Read-only without a type, there is nothing to choose and nothing to say.
  const bare = typeField.disabled && !chosen && !typeField.message && !missing.length;
  const describedBy =
    [typeField.aside && typeField.asideId, !bare && lineId]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <>
      <div
        className="seo-field"
        ref={typeField.ref}
        data-path="schema.type"
        data-disabled={typeField.disabled || undefined}
        onFocus={typeField.onFocus}
        onBlur={typeField.onBlur}
      >
        <div className="seo-label-row">
          <label
            htmlFor={typeField.id}
            id={typeField.labelId}
            tabIndex={-1}
            className="seo-label"
          >
            Type
          </label>
          <div
            className="seo-aside"
            id={typeField.asideId}
            data-pinned={typeField.pinned || undefined}
          >
            {typeField.aside}
          </div>
        </div>
        <div className="seo-type-row">
          <Select.Root
            value={chosen ? typeId : ''}
            disabled={typeField.disabled}
            onValueChange={(value) => setType(value)}
          >
            <Select.Trigger
              id={typeField.id}
              className="seo-select-box"
              placeholder={typeField.disabled ? 'None' : 'Choose a type'}
              aria-describedby={describedBy}
            >
              {type.label}
            </Select.Trigger>
            <Select.Content
              ref={settleList}
              position="popper"
              className="seo-select-content seo-select-wide"
            >
              {GROUPS.map((group) => (
                <Select.Group key={group.label}>
                  <Select.Label>{group.label}</Select.Label>
                  {group.ids.map((id) => (
                    <Select.Item key={id} value={id}>
                      <span className="seo-option">
                        {REGISTRY[id].label}
                        <small>{REGISTRY[id].hint}</small>
                      </span>
                    </Select.Item>
                  ))}
                </Select.Group>
              ))}
            </Select.Content>
          </Select.Root>
          <SuggestButton
            id={suggestId}
            label="Suggest from this page"
            open={suggesting}
            onClick={() => setSuggesting(!suggesting)}
          />
        </div>
        {typeField.message ? (
          <Guide id={lineId} tone="error" role="alert">
            {typeField.message}
          </Guide>
        ) : missing.length > 0 ? (
          <div className="seo-guide" data-tone="improve" id={lineId}>
            <ExclamationTriangleIcon aria-hidden />
            <span className="seo-guide-text">{missingLine}</span>
          </div>
        ) : bare ? null : (
          <Guide id={lineId}>
            {chosen
              ? type.hint
              : 'Helps search engines understand the page and show richer results.'}
          </Guide>
        )}
        {asking && (
          <div style={{ marginTop: 12 }}>
            <Notice
              actions={
                <>
                  <Btn
                    variant="soft"
                    onClick={() => {
                      // The notice goes with its buttons: focus goes back to the Type.
                      document.getElementById(typeField.id)?.focus();
                      setType(asking.to, true);
                    }}
                  >
                    {asking.to === undefined
                      ? 'Reset'
                      : `Change to ${REGISTRY[asking.to].label}`}
                  </Btn>
                  <Btn
                    variant="outline"
                    onClick={() => {
                      document.getElementById(typeField.id)?.focus();
                      setAsking(null);
                    }}
                  >
                    Keep {type.label}
                  </Btn>
                </>
              }
            >
              {asking.to === undefined
                ? 'Resetting'
                : `Changing to ${REGISTRY[asking.to].label}`}{' '}
              removes {asking.dropped} {type.label}{' '}
              {asking.dropped === 1 ? 'detail' : 'details'}.
            </Notice>
          </div>
        )}
        {suggesting && (
          <SchemaSuggest
            opener={suggestId}
            onClose={() => setSuggesting(false)}
          />
        )}
      </div>
      <Details items={main} type={typeId} />
      <List>
        {more.length > 0 && (
          <Disclosure
            label="More details"
            summary={
              more.length > 2
                ? `${more
                    .slice(0, 2)
                    .map((prop, index) =>
                      index ? prop.label.toLowerCase() : prop.label,
                    )
                    .join(', ')}, ${more.length - 2} more`
                : more.map((prop) => prop.label).join(', ')
            }
            // Open when it holds a value set here, or a problem.
            defaultOpen={more.some(
              (prop) =>
                stored.props?.[prop.key] !== undefined ||
                state.errors.target[`schema.props.${prop.key}`] !== undefined,
            )}
          >
            <div className="seo-row-field seo-more-details">
              <Details items={more} type={typeId} />
            </div>
          </Disclosure>
        )}
        <NavRow
          label="Custom JSON-LD"
          value={stored.custom ? `${customType}In use` : 'Off'}
          // Read-only and empty, the sheet would hold an empty box only.
          onClick={
            stored.custom || state.readonly === 'no'
              ? () => openSheet({ kind: 'custom' })
              : undefined
          }
        />
        {server.preview && (
          <NavRow
            label="View output"
            onClick={() => openSheet({ kind: 'output', section: 'schema' })}
          />
        )}
      </List>
    </>
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
        Added to{' '}
        {target?.scope === 'template'
          ? `every ${inSentence(target.label)}'s`
          : "this page's"}{' '}
        structured data. In its texts, {'{title}'}, {'{description}'}, {'{site}'},{' '}
        {'{sep}'}, {'{url}'}, {'{author}'}, {'{published}'}, {'{modified}'} and {'{image}'} are
        filled in with the page's values; other text in braces stays as typed.
      </p>
      <div className="seo-json-wrap">
        <Field
          scope="target"
          path="schema.custom"
          label="Custom JSON-LD"
          labelHidden
          error={bad}
        >
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
    </>
  );
}
