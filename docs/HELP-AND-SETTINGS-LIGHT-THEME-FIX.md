# Help and Settings light-theme contrast fixes

## Changes
- Replaced dark-only utility styling in Help & Guide with semantic theme-aware classes.
- Added explicit light and dark styles for the sticky page header, back control, search panel/input, topic cards, topic icons, expanded content, and data-safety card.
- Made the Help header fully opaque while sticky so scrolling content does not show through it.
- Added semantic styles for Receipt storage and Help cards in Settings, including readable storage status badges, description, note, and Check again button.
- Increased purple icon contrast in Help topics and Settings feature cards in light mode.
- Kept dark-mode colours and existing navigation, content, storage checks, and actions intact.

## Files changed
- `src/pages/HelpGuidePage.tsx`
- `src/pages/views/SettingsView.tsx`
- `src/style.css`

## Verification
Source archive structure and modified JSX/CSS were inspected. Dependency installation and project build were not run in this environment; run `npm ci`, `npm run lint`, `npm run typecheck`, and `npm run build` before deployment.
