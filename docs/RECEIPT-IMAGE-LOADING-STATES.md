# Receipt image loading feedback

## User-visible behavior

- Transaction details and edit forms show a loading indicator in the receipt thumbnail while the image request is pending.
- A failed thumbnail request displays an explicit failure message instead of leaving an empty image area.
- The full receipt viewer displays a loading indicator until the image has loaded.
- If the full-size image request fails, the viewer explains the failure and provides a **Try again** action.
- Loading and error states use theme-aware styles and accessible status/alert semantics.

## Scope

This is presentation and interaction feedback only. It does not change receipt storage, R2 configuration, API endpoints, upload behavior, or transaction data.
