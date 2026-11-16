# Focused lint cleanup — 16 November 2026

Applied to the latest uploaded source archive (`credit-card-ledger-date-picker-more-options-fix.zip`).

## Changes

- Removed the unused `midpoint` helper from the receipt image viewer.
- Reset receipt zoom, pan offset, and active pointer tracking when the replacement image finishes loading, rather than synchronously setting React state in an effect.
- Replaced the export-preference `useMemo(readExportPrefs, [])` with lazy state initialization.
- Changed export card and billing-cycle validation to derived values. Invalid saved card/cycle selections are ignored in the UI and in export requests without synchronously setting state from an effect.
- Kept preference persistence in an effect, using only validated card/cycle selections.
- Kept workbook creation metadata assignment inside the user-triggered export operation.
- Removed unnecessary regular-expression escapes.
- Removed unused imports and state/refs from the application shell and added stable keys to navigation icon elements.
- Updated navigation conditionals to explicit `if/else` statements rather than unused ternary expressions.
- Updated payment deletion navigation to explicit branching.
- Removed the redundant synchronous system-theme state update from the media-query subscription effect; the initial state is already read by the state initializer and subsequent changes are handled by the listener.
- Memoized the route background location to avoid creating a new synthetic location object on every render.
- Moved the modal close callback ref synchronization into an effect.
- Moved the current session status ref synchronization into an effect.
- Initialized the overview date once per application-shell mount rather than constructing a new date during every render.

## Validation

The source archive does not include `node_modules`. An attempt to install dependencies with `npm ci --ignore-scripts` timed out in this environment, so typecheck, build, and lint could not be rerun here. Run the following in the project directory after extracting this archive:

```bash
npm ci
npm run typecheck
npm run build
npm run lint
```

This is a focused cleanup, not a claim that every existing lint warning has been eliminated. Routing/bootstrap effects and the UPI edit-form state synchronization still need a behavior-aware review before changing them.


## Date-format picker screenshot follow-up

- Removed the picker options container's fixed `65dvh` height cap and forced scrolling. The options now use their natural content height; the enclosing modal remains responsible for scrolling if the viewport cannot fit the content.
- Increased selected checkmark contrast in light mode with `text-violet-800`; retained `text-violet-300` in dark mode. Applied to both predefined and custom format selections.
- No date-format behavior, persistence, or selection logic changed.
