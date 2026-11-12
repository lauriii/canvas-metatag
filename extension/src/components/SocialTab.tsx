import { useId, useState } from 'react';

import { useApp } from '../App';
import { socialImage, texts } from '../model';
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

  return (
    <>
      <SocialPreview
        suggest={
          <SuggestButton
            id={suggestId}
            label="Suggest title and description"
            open={suggesting}
            onClick={() => setSuggesting(!suggesting)}
          />
        }
      />
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
        source={from}
        resetLabel="Use the default image"
      >
        {(field) => (
          <>
            <ImageRow
              describedBy={field.describedBy}
              image={image}
              empty={
                page
                  ? 'No image. Add one in Page data or choose one here.'
                  : 'No image. Choose one here, or use one of the fields.'
              }
              disabled={field.disabled}
              minWidth={600}
              chosen={social.image}
              fields={
                page
                  ? undefined
                  : Object.entries(view.tokens)
                      .filter(
                        ([name, token]) =>
                          token.type === 'image' && name.startsWith('field.'),
                      )
                      .map(([name, token]) => ({
                        value: `{${name}}`,
                        label: token.label,
                      }))
              }
              onPick={(value) => edit('social.image', value)}
            />
            {field.status}
          </>
        )}
      </Field>

      <Field
        scope="target"
        path="social.title"
        label="Social title"
        fallback="Same as page title"
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
            tokens={view.tokens}
            fields={!page}
            alwaysInsert={!page}
            becomes={view.texts.social_title}
            status={field.status}
          />
        )}
      </Field>
      <Field
        scope="target"
        path="social.description"
        label="Social description"
        fallback="Same as description"
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
            tokens={view.tokens}
            fields={!page}
            multiline
            alwaysInsert={!page}
            becomes={view.texts.social_description}
            status={field.status}
          />
        )}
      </Field>
    </>
  );
}
