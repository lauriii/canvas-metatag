import { Select, Switch } from '@radix-ui/themes';
import { useEffect, useId, useRef, useState } from 'react';

import { useApp } from '../App';
import {
  inherited,
  meter,
  seedTitle,
  setPath,
  texts,
  tokensIn,
  wellFormed,
} from '../model';
import type { Robots, Scope, SuggestField } from '../types';
import { Field, useHeld } from './Field';
import { SearchPreview } from './Previews';
import { Disclosure, List, Row } from './SettingsList';
import { SuggestIcon, TextSuggest } from './Suggest';
import { TemplateInput } from './TemplateInput';
import { Btn } from './ui';

const ADVANCED = [
  'robots.nofollow',
  'robots.nosnippet',
  'robots.max_snippet',
  'robots.max_image_preview',
  'canonical',
];

/** The robots directives in plain words: one switch, the rest behind "Advanced". */
export function Visibility(props: { scope: Scope }) {
  const { scope } = props;
  const { state, dispatch, view, issues } = useApp();
  const target = state.server!.target;
  const page = scope === 'target' && target?.scope === 'page';
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
  const image = robots.max_image_preview ?? 'standard';
  const held = useHeld(limit > 0 ? String(limit) : '', (text) => {
    const number = Number(text);
    if (text.trim() !== '' && Number.isFinite(number)) {
      edit('max_snippet', Math.round(number));
    }
  });
  const canonical = useHeld(state.edits.target.canonical ?? '', (text) =>
    dispatch({ type: 'edit', scope: 'target', path: 'canonical', value: text }),
  );
  const canonicalSet = page && !!view?.effective.canonical?.trim();

  const summary = [
    canonicalSet && 'Canonical set',
    robots.nofollow === true && 'Not following links',
    previews === 'off' && 'Text previews off',
    previews === 'limited' && `Up to ${limit} characters`,
    image === 'standard' && 'Standard image previews',
    image === 'none' && 'No image previews',
  ].filter((part) => typeof part === 'string');
  const flagged = issues.some(
    (issue) =>
      issue.severity !== 'info' &&
      ADVANCED.includes(issue.jump?.field.replace(/^values\./, '') ?? ''),
  );

  return (
    <List>
      <Row
        scope={scope}
        path={`${prefix}robots.noindex`}
        label="Show in search results"
        value={robots.noindex === true ? 'Off' : 'On'}
        second={
          robots.noindex === true && (
            <>
              Hidden · <code>noindex</code>
            </>
          )
        }
        control={(field) => (
          <Switch
            size="2"
            id={field.id}
            checked={robots.noindex !== true}
            disabled={field.disabled}
            aria-describedby={field.describedBy}
            onCheckedChange={(checked) => edit('noindex', !checked)}
          />
        )}
      />
      <Disclosure
        label="Advanced"
        summary={summary.length ? summary.join(', ') : 'Defaults'}
        defaultOpen={summary.length > 0 || flagged}
      >
        <Row
          scope={scope}
          path={`${prefix}robots.nofollow`}
          label="Follow links"
          value={robots.nofollow === true ? 'Off' : 'On'}
          second={robots.nofollow === true && <code>nofollow</code>}
          control={(field) => (
            <Switch
              size="2"
              id={field.id}
              checked={robots.nofollow !== true}
              disabled={field.disabled}
              aria-describedby={field.describedBy}
              onCheckedChange={(checked) => edit('nofollow', !checked)}
            />
          )}
        />
        <Row
          scope={scope}
          path={`${prefix}robots.nosnippet`}
          also={[`${prefix}robots.max_snippet`]}
          label="Text previews"
          value={
            previews === 'limited'
              ? `Up to ${limit} characters`
              : previews[0].toUpperCase() + previews.slice(1)
          }
          second={
            previews === 'off' ? (
              <code>nosnippet</code>
            ) : previews === 'limited' ? (
              <code>max-snippet:{limit}</code>
            ) : undefined
          }
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
          control={(field) => (
            <>
              <Select.Root
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
                  className="seo-select-ghost"
                  aria-labelledby={field.labelId}
                  aria-describedby={field.describedBy}
                >
                  {/* The ellipsis belongs to the menu item only. */}
                  {previews[0].toUpperCase() + previews.slice(1)}
                </Select.Trigger>
                <Select.Content
                  position="popper"
                  align="end"
                  className="seo-select-content"
                >
                  <Select.Item value="allowed">Allowed</Select.Item>
                  <Select.Item value="limited">Limited…</Select.Item>
                  <Select.Item value="off">Off</Select.Item>
                </Select.Content>
              </Select.Root>
              {previews === 'limited' && (
                <input
                  className="seo-input"
                  data-size="sm"
                  type="number"
                  min={1}
                  max={1000}
                  aria-label="Characters"
                  aria-invalid={field.invalid || undefined}
                  disabled={field.disabled}
                  {...held}
                />
              )}
              {previews === 'limited' && (
                <span className="seo-unit" aria-hidden>
                  characters
                </span>
              )}
            </>
          )}
        />
        <Row
          scope={scope}
          path={`${prefix}robots.max_image_preview`}
          label="Image previews"
          value={image[0].toUpperCase() + image.slice(1)}
          second={
            image !== 'large' && <code>max-image-preview:{image}</code>
          }
          control={(field) => (
            <Select.Root
              value={image}
              disabled={field.disabled}
              onValueChange={(value) => edit('max_image_preview', value)}
            >
              <Select.Trigger
                id={field.id}
                className="seo-select-ghost"
                aria-labelledby={field.labelId}
                aria-describedby={field.describedBy}
              />
              <Select.Content
                position="popper"
                align="end"
                className="seo-select-content"
              >
                <Select.Item value="large">Large</Select.Item>
                <Select.Item value="standard">Standard</Select.Item>
                <Select.Item value="none">None</Select.Item>
              </Select.Content>
            </Select.Root>
          )}
        />
        {page && (
          <div className="seo-row-field">
            <Field scope="target" path="canonical" label="Canonical address">
              {(field) => (
                <input
                  id={field.id}
                  className="seo-input"
                  inputMode="url"
                  placeholder={view?.tokens.url?.value}
                  disabled={field.disabled}
                  aria-invalid={field.invalid || undefined}
                  aria-describedby={field.describedBy}
                  {...canonical}
                />
              )}
            </Field>
          </div>
        )}
        <p className="seo-row-note">AI training is set in robots.txt, not here.</p>
      </Disclosure>
    </List>
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

  // One tray at a time; Checks and the fields' issues can open one.
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
  const source = (path: string) =>
    ({
      target: '',
      default: 'the default language',
      site: 'the site default',
      fallback: 'the default',
    })[view.source(path)];

  // Canvas's own Description: the field's text is its own while it has focus.
  const [typing, setTyping] = useState<string | null>(null);
  const live = state.live.description ?? view.tokens.description?.value ?? '';
  const handOver = () => {
    if (typing !== null) {
      commitDescription(typing);
      setTyping(null);
    }
  };

  const sparkle = (field: 'title' | 'description') => (
    <SuggestIcon
      id={ids[field]}
      label={`Suggest a ${field}`}
      open={suggesting === field}
      onClick={() => setSuggesting(suggesting === field ? null : field)}
    />
  );
  const tray = (field: 'title' | 'description') =>
    suggesting === field && (
      <TextSuggest
        fields={[field]}
        opener={ids[field]}
        onClose={() => setSuggesting(null)}
        onUse={(variant) => {
          if (field === 'description') {
            return commitDescription(variant.description ?? '');
          }
          // Applied as typing is: the site's suffix stays.
          edit('title', seedTitle(pattern, variant.title ?? ''));
          return true;
        }}
      />
    );
  const titleMeter = meter('title', view.texts.title, measurer);
  const descriptionMeter = meter(
    'description',
    view.texts.description,
    measurer,
  );

  return (
    <>
      {server.preview && <SearchPreview />}
      <Field
        scope="target"
        path="title"
        label="Title"
        meter={titleMeter}
        resolved={
          tokensIn(edits.title ?? pattern).length ? view.texts.title : undefined
        }
        onSuggest={() => setSuggesting('title')}
        after={tray('title')}
        action={
          !page &&
          edits.title === undefined &&
          pattern !== '' && (
            <Btn
              variant="ghost"
              size={24}
              accent
              onClick={() => edit('title', pattern)}
            >
              Use the site pattern
            </Btn>
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
            inheritedFrom={source('title')}
            // A page's own title reads as text; the site's values as chips.
            pattern={
              page
                ? pattern.replaceAll('{title}', view.values.title ?? '')
                : pattern
            }
            tokens={view.tokens}
            fields={!page}
            seed={page ? pattern : undefined}
            insert={page ? 'focus' : 'always'}
            trailing={sparkle('title')}
          />
        )}
      </Field>

      {page ? (
        <Field
          scope="target"
          path="description"
          label="Description"
          source="Also in Page data"
          meter={descriptionMeter}
          onSuggest={() => setSuggesting('description')}
          after={tray('description')}
        >
          {(field) => (
            <div className="seo-template seo-has-trail">
              <textarea
                id={field.id}
                rows={2}
                lang={server.langcode}
                dir="auto"
                className="seo-input"
                disabled={field.disabled}
                aria-describedby={field.describedBy}
                aria-description="The same field as Page data. Translated with the page."
                value={typing ?? live}
                onFocus={() => setTyping(live)}
                onChange={(event) => {
                  // Canvas refuses its whole layout for half a character.
                  const text = wellFormed(event.target.value);
                  setTyping(text);
                  holdDescription(text);
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
              <div className="seo-trail">{sparkle('description')}</div>
            </div>
          )}
        </Field>
      ) : (
        <Field
          scope="target"
          path="description"
          label="Description"
          meter={descriptionMeter}
          resolved={
            tokensIn(edits.description ?? '').length
              ? view.texts.description
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
              inheritedFrom={source('description')}
              // With nothing to fill in: the value it falls back to.
              pattern={server.resolved ? undefined : '{description}'}
              tokens={view.tokens}
              fields
              multiline
            />
          )}
        </Field>
      )}

      <Visibility scope="target" />
    </>
  );
}
