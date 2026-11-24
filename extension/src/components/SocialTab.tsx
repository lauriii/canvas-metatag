import { useId, useState } from 'react';

import { useApp } from '../App';
import { socialImage, texts } from '../model';
import { entriesFor, inSentence, noItemHas, sameValue } from '../values';
import { ImageRow } from './MediaPicker';
import { SocialPreview } from './Previews';
import { SuggestButton, TextSuggest } from './Suggest';
import { ValueField, stateWords } from './Value';

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
  // The type's image fields, for "From each Article": fields only, never a
  // worked-out value.
  const fields = page
    ? undefined
    : entriesFor('social.image', 'image', 'template', view.lookup, target.label)
        .filter((entry) => 'source' in entry.value && !entry.disabled)
        .map((entry) => ({ value: entry.value, label: entry.full, image: entry.image }));
  const value = social.image;
  const linked = !!value && 'source' in value;
  // The Image value it follows, named by the field it reads ("Photo"); with
  // no item to preview, by the field it would read.
  const via = view.facts.image?.via;
  const fromImage = from === 'Image' || (!page && !value && !view.lookup.resolvable && !!via);
  // No item of the type has an image, and no site default stands in: said
  // as its menu and Checks say it.
  const noneHave = !page && !value && from === 'No image' && noItemHas('image', view.lookup);
  // The description follows its default, unset or stored as that default:
  // so does the social description, as Checks reads it.
  const description = view.effective.description;
  const followsDescription = !description || sameValue(description, { fact: 'description' });
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
        // Its menu leaves out the Image it follows by default.
        byDefault={{ fact: 'image' }}
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
              : fromImage
                ? // The Default box says "Default · from ‹via›": said once.
                  !page && !value && via
                  ? null
                  : `From the ${via ?? 'Image'} field`
                : from
        }
        resetTip="the default image"
        instead={
          link &&
          (fromImage
            ? `its ${via ?? 'Image'} field is used`
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
              value || fromImage || noneHave
                ? row.imageTag
                : !page && from === 'Site default image'
                  ? { text: `Default · ${from}`, look: 'default' }
                  : undefined
            }
            // With no item to preview, the field it would read and no image.
            state={(value || noneHave ? row.imageState : undefined) ?? (!page && !value && row.shown.status === 'none' ? stateWords('none', inSentence(target.label)) : undefined)}
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
        // While the description follows its default, so does this: unset,
        // or set to that same default.
        defaultWords={{ tag: 'Description', text: unset.social_description, ...(followsDescription ? { fact: 'description' as const } : {}) }}
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
