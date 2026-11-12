import { InfoCircledIcon } from '@radix-ui/react-icons';
import {
  Callout,
  Flex,
  RadioGroup,
  SegmentedControl,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes';

import { useApp } from '../App';
import { identityGaps, identitySentence } from '../checks';
import { siteTexts } from '../model';
import { Field, Section, useHeld } from './Field';
import { ImageRow, PICKED } from './MediaPicker';
import { Visibility } from './SearchTab';
import { TemplateInput } from './TemplateInput';

const SEPARATORS = ['|', '·', '–', '—'];
/** What a screen reader says for each: punctuation is often skipped. */
const SEPARATOR_NAMES: Record<string, string> = {
  '|': 'Vertical bar',
  '·': 'Middle dot',
  '–': 'En dash',
  '—': 'Em dash',
};

const AI_REASONS = {
  no_provider: 'AI suggestions need a default chat provider.',
  not_usable: "The AI provider isn't ready to use.",
};

function useSite() {
  const { state, dispatch } = useApp();
  const server = state.server!;
  const { identity } = state.edits.site;
  return {
    server,
    identity,
    image: (uuid: string) => PICKED[uuid] ?? server.media[uuid] ?? null,
    edit: (path: string, value: unknown) =>
      dispatch({ type: 'edit', scope: 'site', path, value }),
  };
}

/** Who runs the site: what search engines are told about its publisher. */
export function IdentityTab() {
  const { state, view } = useApp();
  const { server, identity, image, edit } = useSite();
  const gaps = identityGaps(state.edits.site, view?.tokens ?? {});
  const ai = server.capabilities.ai;
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
  const headless = server.origin.source === 'frontend';
  return (
    <>
      {server.can.site && gaps.length > 0 && (
        <Callout.Root size="1" color="gray">
          <Callout.Icon>
            <InfoCircledIcon aria-hidden />
          </Callout.Icon>
          <Callout.Text>{identitySentence(gaps)}</Callout.Text>
        </Callout.Root>
      )}
      {server.can.site && ai && !ai.available && ai.reason && (
        <Callout.Root size="1" color="gray">
          <Callout.Icon>
            <InfoCircledIcon aria-hidden />
          </Callout.Icon>
          <Callout.Text>{AI_REASONS[ai.reason]}</Callout.Text>
        </Callout.Root>
      )}
      <Field
        scope="site"
        path="identity.kind"
        label="This site represents"
        group
      >
        {(field) => (
          <RadioGroup.Root
            size="2"
            aria-labelledby={field.labelId}
            value={identity.kind}
            disabled={field.disabled}
            onValueChange={(kind) => edit('identity.kind', kind)}
            className="seo-inline-radios"
          >
            <RadioGroup.Item value="organization">
              An organization
            </RadioGroup.Item>
            <RadioGroup.Item value="person">A person</RadioGroup.Item>
          </RadioGroup.Root>
        )}
      </Field>
      <Field
        scope="site"
        path="identity.name"
        label="Name"
        source={identity.name.trim() === '' ? 'From the site name' : undefined}
      >
        {(field) => (
          <>
            <TextField.Root
              id={field.id}
              size="2"
              value={identity.name}
              placeholder={view?.tokens.site?.value}
              disabled={field.disabled}
              aria-invalid={field.invalid || undefined}
              aria-describedby={field.describedBy}
              onChange={(event) => edit('identity.name', event.target.value)}
            >
              {identity.name === '' && (
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
      <Field scope="site" path="identity.logo" label="Logo" group>
        {(field) => (
          <>
            <ImageRow
              describedBy={field.describedBy}
              image={image(identity.logo)}
              empty="No logo. Choose a square image, at least 112 × 112."
              disabled={field.disabled}
              minWidth={112}
              chosen={identity.logo}
              onPick={(uuid) => edit('identity.logo', uuid)}
              onClear={() => edit('identity.logo', '')}
            />
            {field.status}
          </>
        )}
      </Field>
      <Field
        scope="site"
        path="identity.same_as"
        label="Profiles elsewhere (one address per line)"
        help="Pages about this organization or person on other sites."
      >
        {(field) => (
          <>
            <TextArea
              id={field.id}
              size="2"
              rows={3}
              spellCheck={false}
              className="seo-textarea"
              placeholder="https://"
              disabled={field.disabled}
              aria-invalid={field.invalid || undefined}
              aria-describedby={field.describedBy}
              {...profiles}
            />
            {field.status}
          </>
        )}
      </Field>
      <div className="seo-field">
        <Flex gap="3" align="baseline" wrap="wrap">
          <Text size="2" weight="medium">
            Public address
          </Text>
          <Text size="2" className="seo-wrap">
            {server.origin.url}
          </Text>
        </Flex>
        <Text as="p" size="1" color="gray" mt="1">
          {server.origin.source === 'settings'
            ? "Set in the site's settings file. Links and structured data use this address."
            : headless
              ? "The headless frontend the editor previews with. Links and structured data use this address. If visitors use another one, set it in the site's settings file."
              : "This site's own address, as you are signed in."}
        </Text>
      </div>
    </>
  );
}

/** What every page starts from: the title pattern, its separator, the fallback image, visibility. */
export function DefaultsTab() {
  const { state, view } = useApp();
  const { server, identity, image, edit } = useSite();
  const { values } = state.edits.site;
  // Everything an entity has; a content type's fields do not exist site-wide.
  const tokens = Object.fromEntries(
    Object.entries(view?.tokens ?? {}).filter(
      ([name]) => !name.startsWith('field.'),
    ),
  );
  const separators = SEPARATORS.includes(identity.separator)
    ? SEPARATORS
    : [...SEPARATORS, identity.separator].filter(Boolean);
  return (
    <>
      <Field
        scope="site"
        path="values.title"
        label="Title pattern"
        help="Used by every page that does not set its own title."
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
            alwaysInsert
            // An example: the page in context may set a title of its own.
            becomes={
              view
                ? `${siteTexts(state, view).title} (for a page titled "${view.values.title ?? ''}")`
                : ''
            }
            status={field.status}
          />
        )}
      </Field>
      <Field
        scope="site"
        path="identity.separator"
        label="Title separator"
        group
      >
        {(field) => (
          <>
            <SegmentedControl.Root
              size="2"
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
            {field.status}
          </>
        )}
      </Field>
      <Field
        scope="site"
        path="identity.default_image"
        label="Default image"
        group
        help="Used for social cards when a page has no image."
      >
        {(field) => (
          <>
            <ImageRow
              describedBy={field.describedBy}
              image={image(identity.default_image)}
              empty="No default image."
              disabled={field.disabled}
              minWidth={600}
              chosen={identity.default_image}
              onPick={(uuid) => edit('identity.default_image', uuid)}
              onClear={() => edit('identity.default_image', '')}
            />
            {field.status}
          </>
        )}
      </Field>
      <Section
        title="Search visibility for the whole site"
        summary={
          values.robots?.noindex === true
            ? 'Hidden from search engines'
            : 'Shown in search results'
        }
      >
        <Visibility scope="site" />
      </Section>
    </>
  );
}
