## Why

The product owner found the insert menu cropped. Opened from a field in the
right-hand column of a two-field row, the 300 px menu was pinned to the
field's left edge with collision handling off. It ran past the dialog's edge
and was clipped. Each value was also squeezed into 150 px beside its label,
so previews such as addresses and descriptions were cut to a few characters.

## What Changes

- A menu of values opens towards the side that keeps it inside the dialog.
- Each value is shown under its label over the menu's width, up to two lines,
  with the full value on hover.

## Capabilities

### Modified Capabilities

- `seo-dialog`: value menus stay inside the dialog and show their values.

## Impact

`extension/src/components/TemplateInput.tsx` and `extension/src/styles.css`.
The link menu of `link-values-to-fields` reuses these rows and MUST keep this.

Out of scope: the label of fields that share a name ("Description
(field.body)"), which `link-values-to-fields` task 9.4 covers. No non-goal is
reopened.
