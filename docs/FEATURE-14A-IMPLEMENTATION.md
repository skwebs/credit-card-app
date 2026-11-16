# Feature #14A — Complete existing receipt image support

## Scope

This update completes the existing one-image-per-transaction workflow. It does not add PDF support, multiple attachments, a new attachment table, or durable offline attachment queuing.

## Changes

- Added an authenticated `GET /api?action=receipt-storage-status` check.
- The status check reports missing required R2 environment variable names without exposing credential values.
- When all required variables are present, the API runs an R2 `HeadBucket` check and distinguishes an unreachable bucket from missing configuration.
- Settings now displays receipt storage status and offers a manual recheck.
- Transaction create/edit forms disable new image selection until the bucket check succeeds and explain the reason.
- Transaction edit displays the current receipt image outside the More options dialog, with view, replace, remove and undo interactions.
- Transaction details displays an image preview, a full-size open action and a remove action.
- Upload now uses the transaction ID returned by the existing outbox synchronization operation instead of searching transactions by matching amount, date and particulars.
- Upload replacement stores the new object and updates the database reference before attempting best-effort cleanup of the old object.
- Transaction deletion is no longer blocked solely because R2 cleanup fails; failed cleanup is logged for operator attention.
- The API explicitly rejects multipart requests containing more than one file.

## R2 environment

Required server-only values:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

`R2_ENDPOINT` is optional and defaults to the Cloudflare account endpoint. Configure values in `.env.local` for local development and Vercel Project Settings for deployment. Never expose R2 credentials with a `VITE_` prefix.

The status check verifies that the configured bucket can be reached using `HeadBucket`. It does not prove that every object-level operation is permitted. A real image upload verifies write permission; viewing and removing an attachment verify read and delete permissions.

## Existing limitation retained

Image Blobs are not persisted in IndexedDB. If the user saves a transaction while offline, the selected image is not uploaded and must be selected again after the transaction synchronizes. This is intentional for this scope; durable offline attachment uploads are deferred.

## Files changed

- `api/index.ts`
- `src/App.tsx`
- `src/pages/transactions/TransactionDetailsPage.tsx`
- `src/pages/views/SettingsView.tsx`
- `src/routes/route-context.ts`
- `.env.example`
- `docs/RECEIPT-IMAGE-SUPPORT.md` (new)
- `docs/FEATURE-14A-IMPLEMENTATION.md` (new)

No database migration or package dependency was added.
