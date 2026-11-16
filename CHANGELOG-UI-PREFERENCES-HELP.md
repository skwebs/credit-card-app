# UI preferences and help guide update

## Changes
- Made the statement export dialog explicitly theme-aware in light mode.
- Added centralized, validated date formatting with predefined and custom patterns.
- Applied the selected date format to app date labels and statement PDF/print output.
- Excel exports now contain actual date cells with the selected Excel number format; CSV exports use ISO `YYYY-MM-DD` dates.
- Persisted statement export selections locally (period, dates, card, billing cycle, and last-used export format), with invalid card/cycle selections cleared safely.
- Added a searchable Help & Guide page and a Settings entry point.

## Preferences storage
- `ccm-date-format`: selected display date format.
- `ccm-statement-export-preferences-v1`: versioned export-dialog selections.

No database schema or API contract changes are included.

## Follow-up #12–#13

- Help routes (`/help` and nested help routes) no longer map to Dashboard in primary navigation; no bottom-navigation item is highlighted while Help & Guide is active.
- Theme preference now supports `light`, `dark`, and `system`, persisted in the existing `ccm-theme` local-storage key.
- System mode follows `prefers-color-scheme` and responds to runtime OS/browser theme changes.
- The header remains unchanged; theme controls are available only in Settings → Appearance.
- Help documentation now describes the System theme option.
