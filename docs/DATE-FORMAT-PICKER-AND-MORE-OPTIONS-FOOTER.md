# Date format picker and More options footer

## Changes

- Replaced the native HTML date-format `<select>` in Settings with the application's existing modal pattern. The picker presents the supported formats as selectable rows, shows the formatted example, marks the active selection, and closes after selection.
- Kept the Custom format option and existing validation/input workflow. Selecting it closes the picker and reveals the existing custom-format field.
- Added a two-button footer to the transaction More options modal: Cancel on the left and Done on the right.
- Opening More options snapshots its editable transaction fields and receipt attachment state. Cancel and the modal close action restore that snapshot; Done retains the edits in the parent expense form. Saving the transaction remains the responsibility of the main Add expense / Edit transaction action.

## Files changed

- `src/pages/views/SettingsView.tsx`
- `src/App.tsx`

No dependencies, database schema, API contract, or financial calculations were changed.
