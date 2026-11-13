import { useId, useState } from 'react';

import { useApp } from '../App';
import { socialImage, texts, tokensIn } from '../model';
import { Field } from './Field';
import { ImageRow, PICKED } from './MediaPicker';
import { SocialPreview } from './Previews';
import { SuggestButton, TextSuggest } from './Suggest';
import { TemplateInput } from './TemplateInput';

export function SocialTab() {
  const { state, dispatch, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const target = server.target!;
  const page = target.scope === 'page';
  const social = state.edits.target.social ?? {};
  const edit = (path: string, value: unknown) =>
    dispatch({ type: 'edit', scope: 'target', path, value });
  const [suggesting, setSuggesting] = useState(false);
  const suggestId = useId();

  const { image, from } = socialImage(state, view, PICKED);
  // What the text fields show while nothing is stored for them.
  const unset = texts({ ...view.effective, social: {} }, view.values);
  const fields = page
    ? undefined
    : Object.entries(view.tokens)
        .filter(
          ([name, token]) =>
            token.type === 'image' && name.startsWith('field.'),
        )
        .map(([name, token]) => ({
          value: `{${name}}`,
          label: token.label,
          image: token.image,
        }));
  const bound = social.image?.match(/^\{(field\..+)\}$/)?.[1];

  return (
    <>
      {server.preview && (
        <SocialPreview
          suggest={
            <SuggestButton
              id={suggestId}
              label="Suggest title and description"
              variant="ghost"
              open={suggesting}
              onClick={() => setSuggesting(!suggesting)}
            />
          }
        />
      )}
      {suggesting && (
        <TextSuggest
          fields={['social.title', 'social.description']}
          opener={suggestId}
          onClose={() => setSuggesting(false)}
          onUse={(variant) => {
            // A card is read as one thing: both texts, in one change.
            dispatch({
              type: 'apply',
              scope: 'target',
              values: {
                ...state.edits.target,
                social: {
                  ...social,
                  title: variant['social.title'],
                  description: variant['social.description'],
                },
              },
            });
            return true;
          }}
        />
      )}

      <Field
        scope="target"
        path="social.image"
        label="Image"
        group
        source={
          // The model's words, in the aside's family of source words.
          from === 'Chosen here'
            ? page
              ? 'Set on this page'
              : `Set for every ${target.label}`
            : from === 'From the page image'
              ? 'From the Image field'
              : from === 'Site default'
                ? 'Site default image'
                : from.replace(/^From (?!the )(.+)$/, 'From the $1 field')
        }
        resetTip="the default image"
      >
        {(field) => (
          <ImageRow
            describedBy={field.describedBy}
            image={image}
            name={
              bound && view.tokens[bound]
                ? `From each ${target.label}'s ${view.tokens[bound].label} field`
                : undefined
            }
            disabled={field.disabled}
            minWidth={600}
            chosen={social.image}
            fields={fields}
            onPick={(value) => edit('social.image', value)}
          />
        )}
      </Field>

      <Field
        scope="target"
        path="social.title"
        label="Title"
        fallback="Same as search title"
        resetTip="the search title"
        resolved={
          tokensIn(social.title ?? '').length ? view.texts.social_title : undefined
        }
      >
        {(field) => (
          <TemplateInput
            id={field.id}
            describedBy={field.describedBy}
            invalid={field.invalid}
            disabled={field.disabled}
            lang={server.langcode}
            value={social.title ?? ''}
            onChange={(value) => edit('social.title', value)}
            inherited={unset.social_title}
            inheritedFrom="the search title"
            tokens={view.tokens}
            fields={!page}
            insert={page ? 'focus' : 'always'}
          />
        )}
      </Field>
      <Field
        scope="target"
        path="social.description"
        label="Description"
        fallback="Same as description"
        resetTip="the description"
        resolved={
          tokensIn(social.description ?? '').length
            ? view.texts.social_description
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
            value={social.description ?? ''}
            onChange={(value) => edit('social.description', value)}
            inherited={unset.social_description}
            inheritedFrom="the description"
            tokens={view.tokens}
            fields={!page}
            multiline
            insert={page ? 'focus' : 'always'}
          />
        )}
      </Field>
    </>
  );
}
