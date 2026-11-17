import { useId, useState } from 'react';

import { useApp } from '../App';
import { socialImage, texts } from '../model';
import { entriesFor } from '../values';
import { ImageRow } from './MediaPicker';
import { SocialPreview } from './Previews';
import { SuggestButton, TextSuggest } from './Suggest';
import { ValueField } from './Value';

export function SocialTab() {
  const { state, dispatch, openSheet, ...app } = useApp();
  const view = app.view!;
  const server = state.server!;
  const target = server.target!;
  const page = target.scope === 'page';
  const social = state.edits.target.social ?? {};
  const edit = (path: string, value: unknown) =>
    dispatch({ type: 'edit', scope: 'target', path, value });
  const [suggesting, setSuggesting] = useState(false);
  const suggestId = useId();

  const { image, from, state: link } = socialImage(state, view);
  // What the text fields show while nothing is stored for them.
  const unset = texts(
    { ...view.effective, social: {} },
    view.text,
    server.separator,
    server.site.values.title_end,
  );
  // The type's image fields, for "From each Article".
  const fields = page
    ? undefined
    : entriesFor('social.image', 'image', 'template', view.lookup, target.label)
        .filter((entry) => entry.group !== 'Page' && !entry.disabled)
        .map((entry) => ({ value: entry.value, label: entry.full, image: entry.image }));
  const value = social.image;
  const linked = !!value && 'source' in value;
  const library = () =>
    openSheet({
      kind: 'image',
      request: {
        minWidth: 600,
        chosen: value,
        fields,
        onPick: (picked) => edit('social.image', picked),
      },
    });

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
                  title: variant['social.title'] ? { text: variant['social.title'] } : undefined,
                  description: variant['social.description']
                    ? { text: variant['social.description'] }
                    : undefined,
                },
              },
            });
            return true;
          }}
        />
      )}

      <ValueField
        path="social.image"
        label="Image"
        kind="image"
        linkable={!page}
        group
        library={library}
        source={
          // The model's words, in the aside's family of source words.
          from === 'Chosen here'
            ? page
              ? 'Set on this page'
              : `Set for every ${target.label}`
            : linked && !link
              ? `From each ${target.label}`
              : from === 'Image'
                ? 'From the Image field'
                : from
        }
        resetTip="the default image"
        instead={
          link &&
          (from === 'Image'
            ? 'its Image field is used'
            : from === 'Site default image'
              ? 'the site default image is used'
              : 'no image is shared')
        }
        image={(field, row) => (
          <ImageRow
            describedBy={field.describedBy}
            image={image}
            // The link, and what it gives for the previewed item; at template
            // scope the default it follows, as a box's tag.
            tag={
              row.imageTag ??
              (!page && !value && (from === 'Image' || from === 'Site default image')
                ? { text: `Default · ${from}`, look: 'default' }
                : undefined)
            }
            state={row.imageState}
            onUnlink={row.linked && !row.disabled ? () => row.unlink() : undefined}
            disabled={field.disabled}
            minWidth={600}
            chosen={value}
            fields={fields}
            onPick={(picked) => edit('social.image', picked)}
          />
        )}
      />

      <ValueField
        path="social.title"
        label="Title"
        kind="text"
        linkable={!page}
        byDefault={{ fact: 'title' }}
        oneLine
        instead="its Title is used"
        fallback={page ? 'From the page title' : `From each ${target.label}'s title`}
        resetTip="the page title"
        placeholder={unset.social_title}
      />
      <ValueField
        path="social.description"
        label="Description"
        kind="text"
        linkable={!page}
        defaultWords={{ tag: 'Description', text: unset.social_description }}
        instead="the description is used"
        fallback="Same as description"
        resetTip="the description"
        multiline
        lines={3}
        placeholder={unset.social_description}
      />
    </>
  );
}
