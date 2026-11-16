# Receipt image preview

The transaction details page and transaction edit form share `src/components/ReceiptImagePreview.tsx`.

- **View image** opens an in-app lightbox without navigating away from the transaction.
- **Open original** opens the authenticated attachment URL in a new browser tab.
- The preview viewport scrolls independently in both axes. Long receipt images remain scrollable; they are not cropped with `object-fit: cover`.
- Zoom controls scale the displayed image from 100% to 300%. At larger zoom levels, horizontal and vertical scrolling remain available.
- Escape, the close button, or clicking the backdrop closes the preview.
- Body scrolling is locked while the preview is open.
- Dark and light theme styles are defined in `src/style.css`.

No API, database, upload, replacement, deletion, or financial calculation behaviour is changed.
