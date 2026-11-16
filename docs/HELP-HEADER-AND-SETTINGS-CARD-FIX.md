# Shared Header and Light/Dark Theme Fix

## Implemented changes
- Added `src/components/AppHeader.tsx` as the shared sticky application header.
- Migrated the main application header and Help & Guide header to the shared component.
- Added a one-tap theme action: Moon switches the resolved appearance to Dark; Sun switches it to Light. In System mode, the action selects the opposite of the currently resolved appearance. Existing Light/Dark/System settings and local persistence remain in place.
- Kept the existing sync action in the main header; Help & Guide does not receive a sync action it does not need.
- Replaced dark-only Receipt Storage utility colours with semantic classes and explicit light/dark styles for the card, title, description, status, warning, missing-variable text, endpoint note and Check again action.
- Increased Help & Guide icon contrast and explicitly styled its topic cards, quick-help surface and search input for both themes.
- Retained sticky positioning and safe-area top padding through the shared header.

## Files changed
- `src/components/AppHeader.tsx` (new)
- `src/App.tsx`
- `src/pages/HelpGuidePage.tsx`
- `src/pages/views/SettingsView.tsx`
- `src/style.css`

## Validation
- Source-level checks completed.
- `npm ci --ignore-scripts` timed out in the execution environment, so typecheck, lint and production build could not be run here.
- Run `npm ci`, `npm run lint`, `npm run typecheck`, and `npm run build` in the project environment before deployment.

## Manual QA
- Test Light and Dark modes on Dashboard, Transactions, Settings and Help & Guide.
- Test System mode with both OS appearances; verify the header icon selects the opposite explicit theme.
- Test Receipt Storage in Checking, Bucket reachable, Not configured, Unreachable and Unknown states.
- Scroll Help & Guide and Settings on mobile; verify the header remains sticky and does not create a nested scroll area.
- Verify the sync button still triggers the existing refresh flow.
