import { useId, useState } from 'react';

import { useApp } from '../App';
import { dimensions, imageNote, imageSource, pageTitleSource, passedNote, socialImage, texts, unsent, withoutImage } from '../model';
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

  const { image, from, state: link, passed, unshown, hidden, chosen, field: passedField } = socialImage(state, view);
  // Links get a 1200 × 630 version of it: its size, not the original's.
  const made = server.resolved?.share?.made;
  const size = image && !unsent(state) && (made === 'cover' || made === 'frame') ? dimensions(1200, 630) : undefined;
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
  // No item of the type has an image, and no site image stands in: said as
  // its menu and Checks say it (the note says what they share instead).
  const noneHave = !page && !value && (from === 'No image' || from === 'Card') && noItemHas('image', view.lookup);
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
          // A page's row already names where its image comes from: said once.
          page && (!value || unshown)
            ? null
            : // The model's words, in the aside's family of source words.
              from === 'Chosen here'
            ? page
              ? 'Set on this page'
              : `Set for every ${target.label}`
            : linked && !link
              ? // Said with what an item without it shares, in the note.
                null
              : fromImage
                ? // The Default box says "Default · from ‹via›": said once.
                  !page && !value && via
                  ? null
                  : `From the ${via ?? 'Image'} field`
                : imageSource(from)
        }
        resetTip="the default image"
        // Following a field its row names, the previewed item has it: what
        // an item without one shares, while the field is in use.
        hint={!page && (linked || (!value && fromImage)) && !link && !passed ? withoutImage(state, target.label, true) : undefined}
        instead={
          link &&
          (fromImage
            ? `its ${via ?? 'Image'} field is used`
            : from === 'Site default image'
              ? "it shares the site's image"
              : from === 'Card'
                ? 'it shares a card made from its title'
                : 'it shares no image')
        }
        image={(field, row) => (
          <ImageRow
            describedBy={field.describedBy}
            // The preview shows the picture: said here once, in words.
            thumbless
            image={image}
            size={size}
            // A page with no image of its own: where its image comes from.
            name={page && (!value || unshown) ? (fromImage ? `From the ${via ?? 'Image'} field` : imageSource(from)) : undefined}
            note={
              unshown || (page && !value)
                ? // Not shared: why, once.
                  imageNote({ passed, unshown, hidden, chosen }, via)
                : // The previewed item's image passed over: what it shares
                  // instead, as an item without one is told.
                  passed
                  ? passedNote(passed, passedField ?? via ?? 'Image', target.label, from, via)
                  : // What every item without one shares, at rest only when
                    // no field is followed (the item's own line says it
                    // otherwise).
                    !page && !value && !fromImage && !link
                    ? withoutImage(state, target.label)
                    : undefined
            }
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
            share
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
        fallback={page ? pageTitleSource(view.facts) : `From each ${inSentence(target.label)}'s title`}
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
