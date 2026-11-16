# Settings UX spacing and logout placement

## Changes
- Standardized top-level Settings vertical rhythm using a single parent gap rather than a mixture of parent gaps and per-card bottom margins.
- Removed the repeated inner Appearance heading; the outer accordion remains the section title and its explanatory text remains.
- Added a dedicated HELP & SUPPORT section label above Help & Guide.
- Kept Account focused on signed-in identity information.
- Moved Log out to the final action after About and the informational footer.
- Preserved the existing logout callback, busy/disabled state, accessible label, and destructive styling.

## Files changed
- `src/pages/views/SettingsView.tsx`
- `src/style.css`

## Validation
Run `npm run lint`, `npm run typecheck`, and `npm run build` in the project environment. Verify the Settings page in both Light and Dark themes, including expanded accordions and mobile bottom navigation safe-area spacing.
