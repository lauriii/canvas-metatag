import { SegmentedControl } from '@radix-ui/themes';
import { Fragment } from 'react';

import { useApp } from '../App';
import { identityGaps } from '../checks';
import { siteTexts } from '../model';
import { Field, useHeld } from './Field';
import { ImageRow, PICKED, Thumb } from './MediaPicker';
import { Stage } from './Previews';
import { Visibility } from './SearchTab';
import { TemplateInput } from './TemplateInput';
import { InfoTip } from './ui';

const SEPARATORS = ['|', '·', '–', '—'];
/** What a screen reader says for each: punctuation is often skipped. */
const SEPARATOR_NAMES: Record<string, string> = {
  '|': 'Vertical bar',
  '·': 'Middle dot',
  '–': 'En dash',
  '—': 'Em dash',
};

const GAPS: Record<string, string> = {
  'identity.name': 'Add a name',
  'identity.logo': 'Add a logo',
  'identity.same_as': 'Add a profile link',
};

const ORIGINS = {
  settings: "The public address is set in the site's settings file.",
  frontend:
    "The public address is the headless frontend the editor previews with. If visitors use another one, set it in the site's settings file.",
  request: "The public address comes from the site's base URL.",
};

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** An address that wraps only after a dot or a slash, never at its hyphen. */
const breakable = (text: string) =>
  text.split(/(?<=[./ ])/).map((part, index) => (
    <Fragment key={index}>
      {index > 0 && <wbr />}
      <span className="seo-nowrap">{part}</span>
    </Fragment>
  ));

/** Who runs the site, and what every page starts from. One calm scroll. */
export function SiteView() {
  const { state, dispatch, view } = useApp();
  const server = state.server!;
  const { identity, values } = state.edits.site;
  const edit = (path: string, value: unknown) =>
    dispatch({ type: 'edit', scope: 'site', path, value });
  const image = (uuid: string) => PICKED[uuid] ?? server.media[uuid] ?? null;
  const gaps = identityGaps(state.edits.site, view?.tokens ?? {});
  const ai = server.capabilities.ai;
  const name = identity.name.trim() || view?.tokens.site?.value || '';
  const profiles = useHeld(
    identity.same_as.join('\n'),
    (text) =>
      edit(
        'identity.same_as',
        text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    true,
  );
  // Everything an entity has; a content type's fields do not exist site-wide.
  const tokens = Object.fromEntries(
    Object.entries(view?.tokens ?? {}).filter(
      ([token]) => !token.startsWith('field.'),
    ),
  );
  const separators = SEPARATORS.includes(identity.separator)
    ? SEPARATORS
    : [...SEPARATORS, identity.separator].filter(Boolean);
  const example = view ? siteTexts(state, view).title : '';

  return (
    <>
      <Stage
        caption={
          <>
            <span>Publisher</span>
            {server.can.site && gaps.length > 0 && (
              <span data-warn="">· {GAPS[gaps[0].field]}</span>
            )}
          </>
        }
        buttons={
          <InfoTip
            label="About the public address"
            text={ORIGINS[server.origin.source]}
          />
        }
      >
        <div className="seo-publisher">
          <Thumb src={image(identity.logo)?.thumb} />
          <div>
            <b>{name}</b>
            <small>
              {identity.kind === 'person' ? 'Person' : 'Organization'} ·{' '}
              {breakable(host(server.origin.url))}
            </small>
            {identity.same_as.length > 0 && (
              <small>{breakable(identity.same_as.map(host).join(' · '))}</small>
            )}
          </div>
        </div>
      </Stage>

      <h3 className="seo-group-title">Identity</h3>
      <Field scope="site" path="identity.kind" label="Represents" group inline>
        {(field) => (
          <SegmentedControl.Root
            size="2"
            className="seo-segmented"
            role="radiogroup"
            aria-labelledby={field.labelId}
            value={identity.kind}
            disabled={field.disabled}
            onValueChange={(kind) => kind && edit('identity.kind', kind)}
          >
            <SegmentedControl.Item value="organization">
              Organization
            </SegmentedControl.Item>
            <SegmentedControl.Item value="person">Person</SegmentedControl.Item>
          </SegmentedControl.Root>
        )}
      </Field>
      <Field
        scope="site"
        path="identity.name"
        label="Name"
        source={identity.name === '' ? 'From the site name' : undefined}
      >
        {(field) => (
          <input
            id={field.id}
            className="seo-input"
            value={identity.name}
            placeholder={view?.tokens.site?.value}
            disabled={field.disabled}
            aria-invalid={field.invalid || undefined}
            aria-describedby={field.describedBy}
            onChange={(event) => edit('identity.name', event.target.value)}
          />
        )}
      </Field>
      <Field scope="site" path="identity.logo" label="Logo" group>
        {(field) => (
          <ImageRow
            describedBy={field.describedBy}
            image={image(identity.logo)}
            noun="logo"
            disabled={field.disabled}
            minWidth={112}
            chosen={identity.logo}
            onPick={(uuid) => edit('identity.logo', uuid)}
            onClear={() => edit('identity.logo', '')}
          />
        )}
      </Field>
      <Field scope="site" path="identity.same_as" label="Profiles">
        {(field) => (
          <textarea
            id={field.id}
            rows={2}
            spellCheck={false}
            className="seo-input"
            placeholder="One address per line"
            disabled={field.disabled}
            aria-invalid={field.invalid || undefined}
            aria-describedby={field.describedBy}
            {...profiles}
          />
        )}
      </Field>

      <h3 className="seo-group-title">Titles</h3>
      <Field
        scope="site"
        path="values.title"
        label="Title pattern"
        note={
          view && (
            <>
              For {view.values.title ?? ''}:{' '}
              <span className="seo-guide-example">{example}</span>
            </>
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
            value={values.title ?? ''}
            onChange={(value) => edit('values.title', value)}
            tokens={{
              ...tokens,
              // The chips show the working copy's own separator and name.
              ...(tokens.sep
                ? { sep: { ...tokens.sep, value: identity.separator } }
                : {}),
              ...(tokens.site && identity.name.trim()
                ? { site: { ...tokens.site, value: identity.name } }
                : {}),
            }}
            insert="always"
          />
        )}
      </Field>
      <Field
        scope="site"
        path="identity.separator"
        label="Separator"
        group
        inline
      >
        {(field) => (
          <SegmentedControl.Root
            size="2"
            className="seo-segmented"
            data-glyphs=""
            role="radiogroup"
            aria-labelledby={field.labelId}
            value={identity.separator}
            disabled={field.disabled}
            onValueChange={(value) =>
              value && edit('identity.separator', value)
            }
          >
            {separators.map((separator) => (
              <SegmentedControl.Item
                key={separator}
                value={separator}
                aria-label={SEPARATOR_NAMES[separator] ?? separator}
              >
                {separator}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        )}
      </Field>

      <h3 className="seo-group-title">Sharing</h3>
      <Field
        scope="site"
        path="identity.default_image"
        label="Default image"
        group
      >
        {(field) => (
          <ImageRow
            describedBy={field.describedBy}
            image={image(identity.default_image)}
            noun="default image"
            disabled={field.disabled}
            minWidth={600}
            chosen={identity.default_image}
            onPick={(uuid) => edit('identity.default_image', uuid)}
            onClear={() => edit('identity.default_image', '')}
          />
        )}
      </Field>

      <h3 className="seo-group-title">Visibility</h3>
      <Visibility scope="site" />

      {server.can.site && ai && !ai.available && (
        <p className="seo-quiet">
          AI suggestions are off:{' '}
          {ai.reason === 'not_usable'
            ? "the AI provider isn't ready to use."
            : 'no AI provider is set up.'}
        </p>
      )}
    </>
  );
}
