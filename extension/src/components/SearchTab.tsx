import {
  Button,
  Flex,
  Select,
  Switch,
  Text,
  TextArea,
  TextField,
  Tooltip,
} from '@radix-ui/themes';
import { useEffect, useId, useRef, useState } from 'react';

import { useApp } from '../App';
import {
  inherited,
  meter,
  seedTitle,
  setPath,
  texts,
  tokensIn,
} from '../model';
import type { Robots, Scope, SuggestField } from '../types';
import { Field, Section, useField, useHeld } from './Field';
import { SearchPreview } from './Previews';
import { SuggestButton, TextSuggest } from './Suggest';
import { TemplateInput } from './TemplateInput';

/** A switch in plain words, with where its value comes from under it. */
function Toggle(props: {
  scope: Scope;
  path: string;
  label: string;
  /** The technical name, for people who look for it. */
  code: string;
  checked: boolean;
  /** What "off" means. */
  off: string;
  onChange(checked: boolean): void;
}) {
  const field = useField({
    scope: props.scope,
    path: props.path,
    label: props.label,
    fallback: props.scope === 'target' ? 'Default' : undefined,
  });
  return (
    <div className="seo-field" ref={field.ref}>
      <Flex justify="between" align="center" gap="3">
        <Flex align="baseline" gapX="2" wrap="wrap">
          <Text asChild size="2" weight="medium">
            <label htmlFor={field.id} id={field.labelId} tabIndex={-1}>
              {props.label}
            </label>
          </Text>
        </Flex>
        <Switch
          size="2"
          id={field.id}
          checked={props.checked}
          disabled={field.disabled}
          aria-describedby={field.describe({ help: !props.checked })}
          onCheckedChange={props.onChange}
        />
      </Flex>
      {(field.source || field.reset) && (
        <Flex align="center" gap="2" minHeight="24px">
          {field.source}
          {field.reset}
        </Flex>
      )}
      {!props.checked && (
        // The technical name only where the switch is off: next to an "on"
        // switch it reads as the opposite state.
        <Text as="p" size="1" color="gray" id={field.ids.help}>
          {props.off} <span className="seo-code">({props.code})</span>
        </Text>
      )}
      {field.error}
    </div>
  );
}

/** The robots directives, in plain words. The same controls at target and Site scope. */
export function Visibility(props: { scope: Scope }) {
  const { scope } = props;
  const { state, dispatch, view } = useApp();
  const target = state.server!.target;
  const prefix = scope === 'site' ? 'values.' : '';
  const robots: Robots =
    (scope === 'site'
      ? state.edits.site.values.robots
      : view?.effective.robots) ?? {};
  const edit = (key: keyof Robots, value: unknown) =>
    dispatch({ type: 'edit', scope, path: `${prefix}robots.${key}`, value });

  const limit = robots.max_snippet ?? -1;
  const previews =
    robots.nosnippet === true || limit === 0
      ? 'off'
      : limit > 0
        ? 'limited'
        : 'allowed';
  const held = useHeld(limit > 0 ? String(limit) : '', (text) => {
    const number = Number(text);
    if (text.trim() !== '' && Number.isFinite(number)) {
      edit('max_snippet', Math.round(number));
    }
  });
  const where =
    scope === 'site' ? 'site' : target?.scope === 'page' ? 'page' : 'type';

  return (
    <>
      <Toggle
        scope={scope}
        path={`${prefix}robots.noindex`}
        label="Show in search results"
        code="noindex"
        checked={robots.noindex !== true}
        off={
          {
            site: 'Search engines are asked not to list any page of this site.',
            page: 'Search engines are asked not to list this page.',
            type: 'Search engines are asked not to list these pages.',
          }[where]
        }
        onChange={(checked) => edit('noindex', !checked)}
      />
      <Toggle
        scope={scope}
        path={`${prefix}robots.nofollow`}
        label={
          {
            site: 'Follow links',
            page: 'Follow links on this page',
            type: 'Follow links on these pages',
          }[where]
        }
        code="nofollow"
        checked={robots.nofollow !== true}
        off="Search engines are asked not to follow the links here."
        onChange={(checked) => edit('nofollow', !checked)}
      />
      <Field
        scope={scope}
        path={`${prefix}robots.nosnippet`}
        also={[`${prefix}robots.max_snippet`]}
        label="Text previews in results and AI answers"
        fallback={scope === 'target' ? 'Default' : undefined}
        onReset={() =>
          dispatch({
            type: 'apply',
            scope: 'target',
            values: setPath(
              setPath(state.edits.target, 'robots.nosnippet', undefined),
              'robots.max_snippet',
              undefined,
            ),
            undo: 'Reset',
            path: 'robots.nosnippet',
          })
        }
        help={
          previews === 'off'
            ? 'Also removes the description under your title in search results.'
            : undefined
        }
      >
        {(field) => (
          <>
            <Flex align="center" gap="2" wrap="wrap">
              <Select.Root
                size="2"
                value={previews}
                disabled={field.disabled}
                onValueChange={(value) => {
                  edit('nosnippet', value === 'off');
                  if (value !== 'off') {
                    edit(
                      'max_snippet',
                      value === 'allowed' ? -1 : limit > 0 ? limit : 160,
                    );
                  }
                }}
              >
                <Select.Trigger
                  id={field.id}
                  aria-labelledby={field.labelId}
                  aria-describedby={field.describedBy}
                  className="seo-select"
                />
                <Select.Content position="popper">
                  <Select.Item value="allowed">Allowed</Select.Item>
                  <Select.Item value="limited">Limited to…</Select.Item>
                  <Select.Item value="off">Not allowed</Select.Item>
                </Select.Content>
              </Select.Root>
              {previews === 'limited' && (
                <>
                  <TextField.Root
                    size="1"
                    type="number"
                    min={1}
                    max={1000}
                    aria-label="Characters"
                    aria-invalid={field.invalid || undefined}
                    disabled={field.disabled}
                    className="seo-number"
                    {...held}
                  />
                  <Text size="1" color="gray">
                    characters
                  </Text>
                </>
              )}
              <Text size="1" color="gray" className="seo-code" ml="auto">
                nosnippet, max-snippet
              </Text>
            </Flex>
            {field.status}
          </>
        )}
      </Field>
      <Field
        scope={scope}
        path={`${prefix}robots.max_image_preview`}
        label="Image previews"
        fallback={scope === 'target' ? 'Default' : undefined}
      >
        {(field) => (
          <>
            <Flex align="center" gap="2" wrap="wrap">
              <Select.Root
                size="2"
                value={robots.max_image_preview ?? 'standard'}
                disabled={field.disabled}
                onValueChange={(value) => edit('max_image_preview', value)}
              >
                <Select.Trigger
                  id={field.id}
                  aria-labelledby={field.labelId}
                  aria-describedby={field.describedBy}
                  className="seo-select"
                />
                <Select.Content position="popper">
                  <Select.Item value="large">Large</Select.Item>
                  <Select.Item value="standard">Standard</Select.Item>
                  <Select.Item value="none">None</Select.Item>
                </Select.Content>
              </Select.Root>
              <Text size="1" color="gray" className="seo-code" ml="auto">
                max-image-preview
              </Text>
            </Flex>
            {field.status}
          </>
        )}
      </Field>
    </>
  );
}

export function SearchTab() {
  const {
    state,
    dispatch,
    measurer,
    jump,
    holdDescription,
    commitDescription,
    ...app
  } = useApp();
  const view = app.view!;
  const server = state.server!;
  const target = server.target!;
  const page = target.scope === 'page';
  const edits = state.edits.target;
  const edit = (path: string, value: unknown) =>
    dispatch({ type: 'edit', scope: 'target', path, value });
  const ids = { title: useId(), description: useId() };

  // One suggestion panel at a time; Checks can open the one for a field.
  const [suggesting, setSuggesting] = useState<SuggestField | null>(null);
  const handled = useRef(jump?.seq ?? 0);
  useEffect(() => {
    if (jump && jump.seq !== handled.current) {
      handled.current = jump.seq;
      if (
        jump.suggest &&
        jump.scope === 'target' &&
        (jump.field === 'title' || jump.field === 'description')
      ) {
        setSuggesting(jump.field);
      }
    }
  }, [jump]);

  const pattern = String(inherited(server, 'target', 'title') ?? '');
  // What each field shows while nothing is stored for it.
  const unset = texts(
    { ...view.effective, title: pattern, description: undefined },
    view.values,
  );

  // Canvas's own Description: the field's text is its own while it has focus.
  const [typing, setTyping] = useState<string | null>(null);
  const live = state.live.description ?? view.tokens.description?.value ?? '';
  const handOver = () => {
    if (typing !== null) {
      commitDescription(typing);
      setTyping(null);
    }
  };
  const bound = tokensIn(edits.description ?? '');

  const anySet = (
    [
      'noindex',
      'nofollow',
      'nosnippet',
      'max_snippet',
      'max_image_preview',
    ] as const
  ).some((key) => view.source(`robots.${key}`) === 'target');
  const canonical = useHeld(edits.canonical ?? '', (text) =>
    edit('canonical', text),
  );

  const suggest = (field: 'title' | 'description') => (
    <SuggestButton
      id={ids[field]}
      label={`Suggest a ${field}`}
      open={suggesting === field}
      onClick={() => setSuggesting(suggesting === field ? null : field)}
    />
  );

  return (
    <>
      <SearchPreview />
      <Field
        scope="target"
        path="title"
        label="Title in search results"
        fallback="Default"
        meter={meter('title', view.texts.title, measurer)}
        suggest={suggest('title')}
        help={
          !page &&
          edits.title === undefined &&
          pattern !== '' &&
          state.readonly === 'no' && (
            <Button
              size="1"
              variant="ghost"
              // The help line is gray text; the action keeps the accent.
              color="blue"
              onClick={() => edit('title', pattern)}
            >
              Start from default
            </Button>
          )
        }
      >
        {(field) => (
          <TemplateInput
            id={field.id}
            describedBy={field.describedBy}
            invalid={field.invalid}
            disabled={field.disabled}
            lang={server.langcode}
            value={edits.title ?? ''}
            onChange={(value) => edit('title', value)}
            inherited={unset.title}
            tokens={view.tokens}
            fields={!page}
            seed={page ? pattern : undefined}
            alwaysInsert={!page}
            becomes={view.texts.title}
            status={field.status}
          />
        )}
      </Field>
      {suggesting === 'title' && (
        <TextSuggest
          fields={['title']}
          opener={ids.title}
          onClose={() => setSuggesting(null)}
          onUse={(variant) => {
            // Applied as typing is: the site's suffix stays.
            edit('title', seedTitle(pattern, variant.title ?? ''));
            return true;
          }}
        />
      )}

      {page ? (
        <Field
          scope="target"
          path="description"
          label="Description"
          source={
            // The caption answers "why did Page data change too?"; its
            // second sentence is one hover or one Tab away.
            <Tooltip content="Same field as Page data. Translated with the page.">
              <span>
                Same as Page data
                <span className="seo-visually-hidden">
                  . Translated with the page.
                </span>
              </span>
            </Tooltip>
          }
          meter={meter('description', view.texts.description, measurer)}
          suggest={suggest('description')}
        >
          {(field) => (
            <>
              <TextArea
                id={field.id}
                size="2"
                rows={2}
                resize="none"
                lang={server.langcode}
                className="seo-textarea"
                disabled={field.disabled}
                aria-describedby={field.describedBy}
                value={typing ?? live}
                onFocus={() => setTyping(live)}
                onChange={(event) => {
                  setTyping(event.target.value);
                  holdDescription(event.target.value);
                }}
                onBlur={handOver}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    (event.ctrlKey || event.metaKey)
                  ) {
                    handOver();
                    // The field keeps its focus: the next key starts a new edit.
                    setTyping(typing);
                  }
                }}
              />
              {field.status}
            </>
          )}
        </Field>
      ) : (
        <Field
          scope="target"
          path="description"
          label="Description"
          fallback="Default"
          meter={meter('description', view.texts.description, measurer)}
          help={
            bound.length === 1 &&
            edits.description?.trim() === `{${bound[0]}}` &&
            view.tokens[bound[0]]
              ? `Each ${target.label} uses its own ${view.tokens[bound[0]].label}.`
              : edits.description === undefined
                ? `Each ${target.label} uses its own summary or the start of its text.`
                : undefined
          }
        >
          {(field) => (
            <TemplateInput
              id={field.id}
              describedBy={field.describedBy}
              invalid={field.invalid}
              disabled={field.disabled}
              lang={server.langcode}
              value={edits.description ?? ''}
              onChange={(value) => edit('description', value)}
              inherited={unset.description}
              tokens={view.tokens}
              fields
              multiline
              alwaysInsert
              becomes={view.texts.description}
              status={field.status}
            />
          )}
        </Field>
      )}
      {suggesting === 'description' && (
        <TextSuggest
          fields={['description']}
          opener={ids.description}
          onClose={() => setSuggesting(null)}
          onUse={(variant) => commitDescription(variant.description ?? '')}
        />
      )}

      <Section
        title="Search visibility"
        summary={`${
          view.hidden ? 'Hidden from search engines' : 'Shown in search results'
        }${
          anySet
            ? page
              ? ' · set on this page'
              : ` · set for every ${target.label}`
            : ''
        }`}
      >
        <Visibility scope="target" />
        <Text as="p" size="1" color="gray">
          Training of AI models is controlled in robots.txt, not per page. SEO
          does not manage that file.
        </Text>
      </Section>

      {page && (
        <Section
          title="Canonical address"
          summary={edits.canonical?.trim() || 'This page'}
        >
          <Field
            scope="target"
            path="canonical"
            label="Canonical address"
            labelHidden
            help="Only change this when the same content lives at another address that should rank instead."
          >
            {(field) => (
              <>
                <TextField.Root
                  id={field.id}
                  size="2"
                  inputMode="url"
                  placeholder={view.tokens.url?.value}
                  className="seo-inherited-input"
                  disabled={field.disabled}
                  aria-invalid={field.invalid || undefined}
                  aria-describedby={field.describedBy}
                  {...canonical}
                >
                  {!edits.canonical && !canonical.value && (
                    <TextField.Slot side="right">
                      <Text size="1" color="gray" aria-hidden>
                        (inherited)
                      </Text>
                    </TextField.Slot>
                  )}
                </TextField.Root>
                {field.status}
              </>
            )}
          </Field>
        </Section>
      )}
    </>
  );
}
