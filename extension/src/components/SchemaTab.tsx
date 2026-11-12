import {
  Button,
  Callout,
  Flex,
  RadioCards,
  SegmentedControl,
  Select,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes';
import { type ReactNode, useId, useState } from 'react';

import { useApp } from '../App';
import {
  REGISTRY,
  article,
  dateText,
  fill,
  inherited,
  jsonStrings,
  plain,
  toDisplay,
  toStored,
} from '../model';
import type { SchemaProp } from '../types';
import { Field, Section, useField, useHeld } from './Field';
import { ImageRow, PICKED } from './MediaPicker';
import { CodeView, CopyButton, jsonLd } from './Output';
import { SchemaSuggest, SuggestButton } from './Suggest';
import { TemplateInput } from './TemplateInput';

const IDS = Object.keys(REGISTRY);
/** The types offered as rows: a variant ("Blog post") is chosen inside its family's form. */
const FAMILIES = IDS.filter((id) => !REGISTRY[id].extends);
const WEB = FAMILIES.filter((id) => !REGISTRY[id].primary_type);
const SPECIFIC = FAMILIES.filter((id) => REGISTRY[id].primary_type);

/** What an unset detail says about its default. */
const DEFAULTS: Record<string, string> = {
  '{title}': 'Same as page title',
  '{description}': 'Same as description',
  '{image}': 'From the page image',
};

/** The token type a typed detail can be bound to, and the name of its fixed value. */
const TYPED = {
  url: { token: 'url', fixed: 'A fixed address…' },
  date: { token: 'datetime', fixed: 'A fixed date…' },
  number: { token: 'number', fixed: 'A fixed number…' },
  image: { token: 'image', fixed: 'Choose an image…' },
} as const;

const words = (option: string) =>
  option
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/ ([A-Z])/g, (_, letter: string) => ` ${letter.toLowerCase()}`);

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
function Detail(props: { prop: SchemaProp }) {
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
    fallback:
      stored !== undefined
        ? undefined
        : prop.default
          ? (DEFAULTS[prop.default] ?? 'Default')
          : prop.level === 'required'
            ? 'Needs a value'
            : undefined,
  };

  if (prop.kind === 'text') {
    const value = held ?? stored ?? '';
    const done = () => {
      if (held !== null && held !== (stored ?? '')) {
        edit(held);
      }
      setHeld(null);
    };
    return (
      <Field {...common}>
        {(field) => (
          <TemplateInput
            id={field.id}
            describedBy={field.describedBy}
            invalid={field.invalid}
            disabled={field.disabled}
            lang={server.langcode}
            value={value}
            onChange={prop.pattern ? setHeld : edit}
            onBlur={prop.pattern ? done : undefined}
            onKeyDown={
              prop.pattern
                ? (event) => event.key === 'Enter' && done()
                : undefined
            }
            inherited={
              prop.default
                ? plain(fill(prop.default, view.values), 2000)
                : undefined
            }
            tokens={view.tokens}
            fields={!page}
            alwaysInsert={!page}
            becomes={plain(fill(value, view.values), 2000)}
            status={field.status}
          />
        )}
      </Field>
    );
  }

  if (prop.kind === 'enum') {
    return (
      <Field {...common}>
        {(field) => (
          <>
            <Select.Root
              size="2"
              value={stored ?? 'none'}
              disabled={field.disabled}
              onValueChange={(value) =>
                edit(value === 'none' ? undefined : value)
              }
            >
              <Select.Trigger
                id={field.id}
                aria-labelledby={field.labelId}
                aria-describedby={field.describedBy}
                className="seo-select"
              />
              <Select.Content position="popper">
                <Select.Item value="none">Not set</Select.Item>
                {(prop.options ?? []).map((option) => (
                  <Select.Item key={option} value={option}>
                    {words(option)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {field.status}
          </>
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
    <Field {...common} group={matching.length === 0 && prop.kind === 'image'}>
      {(field) => {
        // The first control carries the label: the select, or the fixed input alone.
        const first = matching.length > 0 ? undefined : field.id;
        return (
          <>
            <Flex gap="2" wrap="wrap" align="center">
              {matching.length > 0 && (
                <Select.Root
                  size="2"
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
                    aria-labelledby={field.labelId}
                    aria-describedby={field.describedBy}
                    className="seo-select"
                  />
                  <Select.Content position="popper">
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
                <>
                  <TextField.Root
                    id={first}
                    size="2"
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
                  <TextField.Root
                    size="2"
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
                </>
              )}
              {mode === 'fixed' &&
                (prop.kind === 'url' || prop.kind === 'number') && (
                  <TextField.Root
                    id={first}
                    size="2"
                    inputMode={prop.kind === 'url' ? 'url' : 'decimal'}
                    placeholder={prop.kind === 'url' ? 'https://' : undefined}
                    aria-label={first ? undefined : `${prop.label}, fixed`}
                    aria-invalid={field.invalid || undefined}
                    aria-describedby={first ? field.describedBy : undefined}
                    disabled={field.disabled}
                    className="seo-grow"
                    {...fixed}
                  />
                )}
            </Flex>
            {mode === 'fixed' && prop.kind === 'date' && (
              <Text as="p" size="1" color="gray" mt="1">
                Times are in the site's time zone.
              </Text>
            )}
            {prop.kind === 'image' && (mode === 'fixed' || token) && (
              <ImageRow
                image={image}
                empty={
                  mode === 'fixed'
                    ? 'No image chosen.'
                    : 'No image for this page.'
                }
                disabled={field.disabled || mode !== 'fixed'}
                minWidth={600}
                chosen={literal ? stored : undefined}
                onPick={edit}
              />
            )}
            {token && prop.kind !== 'image' && (
              <Text
                as="p"
                size="1"
                color="gray"
                mt="1"
                className="seo-becomes"
                lang={server.langcode}
              >
                {token.value
                  ? `Becomes: ${prop.kind === 'date' ? dateText(token.value) : token.value}`
                  : 'Empty for this page.'}
              </Text>
            )}
            {field.status}
          </>
        );
      }}
    </Field>
  );
}

/** Lays details out; runs of short free-text details share a row where there is room. */
function Details(props: { items: SchemaProp[] }) {
  const short = (prop: SchemaProp) =>
    prop.kind === 'text' && !prop.default && !prop.pattern;
  const rows: ReactNode[] = [];
  for (let index = 0; index < props.items.length; index++) {
    const run = [props.items[index]];
    while (
      short(run[0]) &&
      index + 1 < props.items.length &&
      short(props.items[index + 1])
    ) {
      run.push(props.items[++index]);
    }
    rows.push(
      run.length > 1 ? (
        <div className="seo-row" key={run[0].key}>
          {run.map((prop) => (
            <Detail key={prop.key} prop={prop} />
          ))}
        </div>
      ) : (
        <Detail key={run[0].key} prop={run[0]} />
      ),
    );
  }
  return rows;
}

export function SchemaTab() {
  const { state, dispatch, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const target = server.target!;
  const page = target.scope === 'page';
  const stored = state.edits.target.schema ?? {};
  const chosen = view.effective.schema?.type;
  const typeId = chosen && REGISTRY[chosen] ? chosen : 'WebPage';
  const type = REGISTRY[typeId];
  const family = type.extends ?? typeId;
  const variants = IDS.filter(
    (id) => id === family || REGISTRY[id].extends === family,
  );
  const props = type.props ?? [];
  const subject = page ? 'This page' : `Every ${target.label}`;
  const question = page
    ? 'What is this page?'
    : `What is each ${target.label}?`;

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
    label: question,
    fallback: 'Default',
    resetLabel: 'Reset the page type',
    onReset: () => setType(undefined),
  });
  const suggest = (
    <SuggestButton
      id={suggestId}
      label="Suggest from this page"
      open={suggesting}
      onClick={() => setSuggesting(!suggesting)}
    />
  );
  const panel = suggesting && (
    <div className="seo-under">
      <SchemaSuggest opener={suggestId} onClose={() => setSuggesting(false)} />
    </div>
  );
  // One choice, so one radio group: arrows move through every type. The
  // group captions are text inside it.
  const card = (id: string) => (
    <RadioCards.Item key={id} value={id} className="seo-type">
      <Text size="2" weight="medium">
        {REGISTRY[id].label}
      </Text>
      <Text size="1" color="gray">
        {REGISTRY[id].hint}
      </Text>
    </RadioCards.Item>
  );
  const caption = (label: string) => (
    <Text as="div" size="1" className="seo-group-label" mt="2" role="none">
      {label}
    </Text>
  );
  const cards = (
    <RadioCards.Root
      columns="1"
      size="1"
      gap="1"
      aria-labelledby={typeField.labelId}
      value={typeId}
      disabled={typeField.disabled}
      onValueChange={(value) => setType(value)}
    >
      {caption('Web page')}
      {WEB.map(card)}
      {caption('More specific')}
      {SPECIFIC.map(card)}
    </RadioCards.Root>
  );

  // The report describes the saved draft: it catches up when a write is confirmed.
  const required = props.filter((prop) => prop.level === 'required');
  const report = server.resolved?.schema;
  const current =
    report &&
    (target.values.schema?.type ??
      target.from_default.schema?.type ??
      'WebPage') === typeId;
  const missing = (report?.missing_required ?? [])
    .map((key) => props.find((prop) => prop.key === key)?.label)
    .filter((label) => label !== undefined);
  const graph = jsonLd(server.resolved?.head);
  // Text values show and take labels, as every other field does.
  const custom = useHeld(
    jsonStrings(stored.custom ?? '', (text) => toDisplay(text, view.tokens)),
    (text) =>
      dispatch({
        type: 'edit',
        scope: 'target',
        path: 'schema.custom',
        value: jsonStrings(text, (value) => toStored(value, view.tokens)),
      }),
    true,
  );
  const more = props.filter((prop) => !prop.level);

  return (
    <>
      <div
        className="seo-field"
        ref={typeField.ref}
        role="group"
        aria-labelledby={typeField.labelId}
      >
        {chosen === undefined ? (
          <>
            <Flex align="center" justify="between" wrap="wrap" gapX="3">
              <Text
                size="2"
                weight="medium"
                id={typeField.labelId}
                tabIndex={-1}
              >
                {question}
              </Text>
              <Flex align="center" gap="2" ml="auto" minHeight="24px">
                {typeField.source}
                {suggest}
              </Flex>
            </Flex>
            {panel}
            {cards}
          </>
        ) : (
          <Flex align="center" wrap="wrap" gap="2">
            <Text asChild size="2" weight="medium">
              <label
                htmlFor={typeField.id}
                id={typeField.labelId}
                tabIndex={-1}
              >
                {subject} is {article(REGISTRY[family].label)}
              </label>
            </Text>
            <Select.Root
              size="2"
              value={family}
              disabled={typeField.disabled}
              onValueChange={(value) => setType(value)}
            >
              <Select.Trigger
                id={typeField.id}
                className="seo-select"
                data-compact
              />
              <Select.Content position="popper">
                <Select.Group>
                  <Select.Label>Web page</Select.Label>
                  {WEB.map((id) => (
                    <Select.Item key={id} value={id}>
                      {REGISTRY[id].label}
                    </Select.Item>
                  ))}
                </Select.Group>
                <Select.Group>
                  <Select.Label>More specific</Select.Label>
                  {SPECIFIC.map((id) => (
                    <Select.Item key={id} value={id}>
                      {REGISTRY[id].label}
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Content>
            </Select.Root>
            <Flex align="center" gap="2" ml="auto" minHeight="24px">
              {typeField.source}
              {typeField.reset}
              {suggest}
            </Flex>
          </Flex>
        )}
        {chosen !== undefined && panel}
        {asking && (
          <Callout.Root
            size="1"
            color="amber"
            mt="2"
            className="seo-strip"
            highContrast
          >
            <Callout.Text>
              {asking.to === undefined
                ? 'Resetting'
                : `Changing to ${REGISTRY[asking.to].label}`}{' '}
              removes {asking.dropped} {type.label}{' '}
              {asking.dropped === 1 ? 'detail' : 'details'}.
            </Callout.Text>
            <Flex gap="3" align="center">
              <Button
                size="1"
                variant="ghost"
                highContrast
                onClick={() => setType(asking.to, true)}
              >
                {asking.to === undefined ? 'Reset' : 'Change'}
              </Button>
              <Button
                size="1"
                variant="ghost"
                highContrast
                onClick={() => setAsking(null)}
              >
                Keep {type.label}
              </Button>
            </Flex>
          </Callout.Root>
        )}
        {typeField.error}
      </div>
      {chosen !== undefined && variants.length > 1 && (
        <SegmentedControl.Root
          size="1"
          aria-label="Kind"
          value={typeId}
          disabled={typeField.disabled}
          onValueChange={(value) => value && setType(value)}
        >
          {variants.map((id) => (
            <SegmentedControl.Item key={id} value={id}>
              {REGISTRY[id].label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      )}
      <Details items={props.filter((prop) => prop.level === 'required')} />
      <Details items={props.filter((prop) => prop.level === 'recommended')} />
      {required.length > 0 && current && (
        <Flex gap="2" align="start" className="seo-progress" role="status">
          <span
            className="seo-dot"
            data-tone={missing.length ? 'amber' : undefined}
          />
          <Text as="p" size="1">
            {missing.length
              ? `${required.length - missing.length} of ${required.length} required details filled · ${missing.join(
                  ', ',
                )} ${missing.length === 1 ? 'is' : 'are'} missing. Until then the ${type.label} details are left out.`
              : 'All required details are filled.'}
          </Text>
        </Flex>
      )}
      {more.length > 0 && (
        <Section
          title="More details"
          summary={more.map((prop) => prop.label).join(', ')}
        >
          <Details items={more} />
        </Section>
      )}

      <Section title="Generated structured data">
        <Flex justify="between" align="start" gap="3" mb="2">
          <Text as="p" size="1" color="gray">
            Built from the settings above. Copy it to test it elsewhere.
          </Text>
          {graph && <CopyButton text={graph} label="Copy structured data" />}
        </Flex>
        {graph ? (
          <CodeView text={graph} />
        ) : (
          <Text as="p" size="1" color="gray">
            Nothing is generated without a page to preview.
          </Text>
        )}
      </Section>
      <Section
        title="Custom JSON-LD"
        summary={stored.custom ? 'In use' : undefined}
      >
        <CustomField held={custom} />
      </Section>
    </>
  );
}

/** One object or a list, parsed here when the field is left and validated again by the server. */
function CustomField(props: { held: ReturnType<typeof useHeld> }) {
  const [bad, setBad] = useState<string>();
  const { held } = props;
  return (
    <Field
      scope="target"
      path="schema.custom"
      label="Custom JSON-LD"
      labelHidden
      error={bad}
      help="For anything the choices above don't cover. One object or a list. Text values can hold dynamic values, like {Page title}."
    >
      {(field) => (
        <>
          <TextArea
            id={field.id}
            size="2"
            rows={6}
            spellCheck={false}
            className="seo-textarea seo-mono"
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
          {field.status}
        </>
      )}
    </Field>
  );
}
