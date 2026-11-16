# Transaction receipt image support

The application supports one receipt image per transaction. Supported formats are JPEG/JPG, PNG and WebP. The server enforces a 5 MB upload limit and validates the file signature before storing it in the private Cloudflare R2 bucket.

## Required server environment

Set these variables in `.env.local` for local development or in the Vercel project environment for deployment:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

`R2_ENDPOINT` is optional. When omitted, the application uses `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. Never expose these values through `VITE_` variables or client-side code.

The configured access key must be able to inspect the bucket and read, write and delete receipt objects under the application's `receipts/` prefix.

## Status check

Settings → Receipt storage calls the authenticated `GET /api?action=receipt-storage-status` endpoint. It reports:

- **Not configured**: one or more required environment variables are missing.
- **Unreachable**: variables are present, but the bucket check failed. Verify the account ID, endpoint, bucket name and key permissions.
- **Bucket reachable**: the R2 `HeadBucket` check succeeded. This confirms bucket reachability, not every object-level permission; an actual image upload verifies write access.

After changing environment variables, restart the local server or redeploy/restart the Vercel function, then select **Check again** in Settings.

## User experience

- Transaction details show an image preview, an open-full-size action and a remove action.
- Transaction edit shows the current image and allows it to be removed or replaced.
- New uploads are disabled until the bucket status is reachable.
- The existing one-image-per-transaction database field (`transactions.attachment_key`) is retained.

## Current offline limitation

Receipt image Blobs are not persisted in IndexedDB. If a transaction is saved while offline, its selected image is not uploaded; the user must reopen the synchronized transaction and select the image again. This update does not add a durable offline attachment queue.

## Manual verification

1. Configure the four required R2 environment variables.
2. Restart the local API or redeploy the application.
3. Open Settings → Receipt storage and select **Check again**.
4. Confirm the status reads **Bucket reachable**.
5. Create a transaction and attach a small JPG, PNG or WebP image.
6. Wait for the transaction to synchronize and confirm the success notification.
7. Open transaction details and verify the image preview and full-size link.
8. Edit the transaction and verify the existing image is shown.
9. Replace the image, save, and verify the new image is displayed.
10. Remove the image and verify the attachment section and paperclip indicator disappear.
11. Repeat with R2 credentials removed or an invalid bucket to verify that Settings shows a warning and upload selection is disabled.
