import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Select } from '@radix-ui/themes';
import {
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { useApp } from '../App';
import {
  REGISTRY,
  chipsIn,
  dateText,
  fill,
  inSentence,
  inherited,
  jsonStrings,
  plain,
  toDisplay,
  toStored,
  tokensIn,
} from '../model';
import type { SchemaProp } from '../types';
import { Field, Guide, useField, useHeld } from './Field';
import { ImageRow, PICKED } from './MediaPicker';
import { Disclosure, List, NavRow } from './SettingsList';
import { SchemaSuggest, SuggestButton } from './Suggest';
import { TemplateInput } from './TemplateInput';
import { Btn, InfoTip, Notice, settleList } from './ui';

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

/** The token type a typed detail can be bound to, and the name of its fixed value. */
const TYPED = {
  url: { token: 'url', fixed: 'A fixed address…' },
  date: { token: 'datetime', fixed: 'A fixed date…' },
  number: { token: 'number', fixed: 'A fixed number…' },
  image: { token: 'image', fixed: 'Choose an image…' },
} as const;

/** What an unset detail says about its default. */
const DEFAULTS: Record<string, string> = {
  '{title}': 'From the page title',
  '{description}': 'Same as description',
  '{image}': 'From the Image field',
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

/** One detail of the chosen type, by its kind. A stored value overrides the default. */
function Detail(props: { prop: SchemaProp; type: string }) {
  const { prop } = props;
  const { state, dispatch, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const page = server.target!.scope === 'page';
  const path = `schema.props.${prop.key}`;
  const stored = state.edits.target.schema?.props?.[prop.key];
  const edit = (value: string | undefined) =>
    dispatch({
      type: 'edit',
      scope: 'target',
      path,
      // The default itself is not an override.
      value: value === prop.default ? undefined : value,
    });
  // Values with a pattern are the field's own until it is left.
  const [held, setHeld] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const fixed = useHeld(stored ?? '', (text) => edit(text));

  const common = {
    scope: 'target' as const,
    path,
    label: prop.label,
    required: prop.level === 'required',
    missing:
      prop.level === 'required' && stored === undefined && !prop.default
        ? `Needed for ${REGISTRY[props.type].label}`
        : undefined,
    fallback:
      stored === undefined && prop.default
        ? (DEFAULTS[prop.default] ?? 'From the page')
        : undefined,
    noStage: true,
  };

  if (prop.kind === 'text') {
    const value = held ?? stored ?? '';
    const done = () => {
      if (held !== null && held !== (stored ?? '')) {
        edit(held);
      }
      setHeld(null);
    };
    const template = value || prop.default || '';
    // A summary left at its default is the description search shows.
    const own =
      prop.default === '{description}'
        ? plain(view.texts.description, 2000)
        : plain(fill(prop.default ?? '', view.values), 2000);
    return (
      <Field
        {...common}
        resolved={
          !value && prop.default
            ? own
            : tokensIn(template).length
              ? plain(fill(template, view.values), 2000)
              : undefined
        }
      >
        {(field) => (
          <TemplateInput
            id={field.id}
            describedBy={field.describedBy}
            invalid={field.invalid}
            disabled={field.disabled}
            required={common.required}
            lang={server.langcode}
            value={value}
            onChange={prop.pattern ? setHeld : edit}
            onBlur={prop.pattern ? done : undefined}
            onKeyDown={
              prop.pattern
                ? (event) => event.key === 'Enter' && done()
                : undefined
            }
            inherited={prop.default ? own : undefined}
            inheritedFrom="the page"
            tokens={view.tokens}
            fields={!page}
            insert={page ? 'focus' : 'always'}
          />
        )}
      </Field>
    );
  }

  if (prop.kind === 'enum') {
    return (
      <Field {...common}>
        {(field) => (
          <Select.Root
            value={stored ?? 'none'}
            disabled={field.disabled}
            onValueChange={(value) =>
              edit(value === 'none' ? undefined : value)
            }
          >
            <Select.Trigger
              id={field.id}
              className="seo-select-box"
              aria-labelledby={field.labelId}
              aria-describedby={field.describedBy}
            />
            <Select.Content
              position="popper"
              className="seo-select-content seo-select-fit"
            >
              <Select.Item value="none">Not set</Select.Item>
              {(prop.options ?? []).map((option) => (
                <Select.Item key={option} value={option}>
                  {words(option)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        )}
      </Field>
    );
  }

  // Typed values are valid by construction: a matching value of the page, or a fixed one.
  const typed = TYPED[prop.kind];
  const matching = Object.entries(view.tokens).filter(
    ([, token]) => token.type === typed.token,
  );
  const bound = (stored ?? prop.default)?.match(/^\{(.+)\}$/)?.[1];
  const token = bound && !fixing ? view.tokens[bound] : undefined;
  const literal = stored !== undefined && !token;
  const mode = token
    ? `token:${bound}`
    : literal || fixing || matching.length === 0
      ? 'fixed'
      : 'none';
  const [, date = '', time = ''] =
    (literal ? stored : '').match(/^(\d{4}-\d\d-\d\d)(?:T(\d\d:\d\d))?/) ?? [];
  const image = literal
    ? (PICKED[stored] ?? server.media[stored] ?? null)
    : (token?.image ?? null);

  return (
    <Field
      {...common}
      group={matching.length === 0 && prop.kind === 'image'}
      info={
        prop.kind === 'date' &&
        mode === 'fixed' && (
          <InfoTip
            label="About times"
            text="Times are in the site's time zone."
          />
        )
      }
      resolved={
        token && prop.kind !== 'image'
          ? token.value
            ? prop.kind === 'date'
              ? dateText(token.value)
              : token.value
            : 'Empty for this page'
          : undefined
      }
    >
      {(field) => {
        // The first control carries the label: the select, or the fixed input alone.
        const first = matching.length > 0 ? undefined : field.id;
        return (
          <>
            {matching.length > 0 && (
              <Select.Root
                value={mode}
                disabled={field.disabled}
                onValueChange={(value) => {
                  setFixing(value === 'fixed');
                  edit(
                    value.startsWith('token:')
                      ? `{${value.slice(6)}}`
                      : undefined,
                  );
                }}
              >
                <Select.Trigger
                  id={field.id}
                  className="seo-select-box"
                  aria-labelledby={field.labelId}
                  aria-describedby={field.describedBy}
                />
                <Select.Content
                  position="popper"
                  className="seo-select-content seo-select-fit"
                >
                  {!prop.default && (
                    <Select.Item value="none">Not set</Select.Item>
                  )}
                  {matching.map(([name, item]) => (
                    <Select.Item key={name} value={`token:${name}`}>
                      {name.startsWith('field.')
                        ? `Field: ${item.label}`
                        : item.label}
                    </Select.Item>
                  ))}
                  <Select.Item value="fixed">{typed.fixed}</Select.Item>
                </Select.Content>
              </Select.Root>
            )}
            {mode === 'fixed' && prop.kind === 'date' && (
              <div
                className="seo-pair"
                data-even=""
                style={{ marginTop: matching.length ? 8 : 0 }}
              >
                <input
                  id={first}
                  className="seo-input"
                  type="date"
                  aria-label={first ? undefined : `${prop.label}, date`}
                  aria-invalid={field.invalid || undefined}
                  disabled={field.disabled}
                  value={date}
                  onChange={(event) =>
                    edit(
                      event.target.value
                        ? event.target.value + (time ? `T${time}` : '')
                        : undefined,
                    )
                  }
                />
                <input
                  className="seo-input"
                  type="time"
                  aria-label={`${prop.label}, time`}
                  disabled={field.disabled || !date}
                  value={time}
                  onChange={(event) =>
                    edit(
                      date +
                        (event.target.value ? `T${event.target.value}` : ''),
                    )
                  }
                />
              </div>
            )}
            {mode === 'fixed' &&
              (prop.kind === 'url' || prop.kind === 'number') && (
                <input
                  id={first}
                  className="seo-input"
                  style={{ marginTop: matching.length ? 8 : 0 }}
                  inputMode={prop.kind === 'url' ? 'url' : 'decimal'}
                  placeholder={prop.kind === 'url' ? 'https://' : '0.00'}
                  aria-label={first ? undefined : `${prop.label}, fixed`}
                  aria-required={common.required || undefined}
                  aria-invalid={field.invalid || undefined}
                  aria-describedby={first ? field.describedBy : undefined}
                  disabled={field.disabled}
                  {...fixed}
                />
              )}
            {prop.kind === 'image' && (mode === 'fixed' || token) && (
              <div style={{ marginTop: matching.length ? 8 : 0 }}>
                <ImageRow
                  image={image}
                  disabled={field.disabled || mode !== 'fixed'}
                  minWidth={600}
                  chosen={literal ? stored : undefined}
                  onPick={edit}
                />
              </div>
            )}
          </>
        );
      }}
    </Field>
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
  const missing = current
    ? (report.missing_required ?? [])
        .map((key) => props.find((prop) => prop.key === key)?.label)
        .filter((label) => label !== undefined)
    : [];
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
            <span className="seo-guide-text">
              Add {missing.join(' and ')} to show {type.label} details in
              search.
            </span>
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
  const { state, dispatch, ...app } = useApp();
  const view = app.view!;
  const stored = state.edits.target.schema?.custom ?? '';
  const [bad, setBad] = useState<string>();
  // Text values show and take labels, as every other field does.
  const held = useHeld(
    pretty(jsonStrings(stored, (text) => toDisplay(text, view.tokens))),
    (text) =>
      dispatch({
        type: 'edit',
        scope: 'target',
        path: 'schema.custom',
        value: jsonStrings(text, (value) => toStored(value, view.tokens)),
      }),
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
        structured data. Values in braces are filled in.
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
            <div className="seo-json-box">
              {/* Paints the text, each value in braces as a chip. */}
              <div className="seo-json seo-json-mirror" aria-hidden>
                {chipsIn(held.value, view.tokens).map((chip, index, all) => (
                  <Fragment key={chip.start}>
                    {held.value.slice(index ? all[index - 1].end : 0, chip.start)}
                    <span className="seo-chip">
                      <span className="seo-brace">{'{'}</span>
                      {chip.label}
                      <span className="seo-brace">{'}'}</span>
                    </span>
                  </Fragment>
                ))}
                {held.value.slice(
                  chipsIn(held.value, view.tokens).at(-1)?.end ?? 0,
                )}
                {'​'}
              </div>
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
