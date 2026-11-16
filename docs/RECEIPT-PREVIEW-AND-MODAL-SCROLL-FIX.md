# Receipt preview and modal scrolling update

- More options now uses a single middle content scroller. Its header and Done action remain visible.
- Transaction details now scroll in the information region while Back and Edit transaction remain in a fixed action region.
- Receipt preview removes the zoom slider and +/- controls. It supports touch pinch zoom, one-pointer panning when enlarged, desktop wheel zoom, drag panning, double-click/double-tap zoom toggle, and Download/Open original actions.
- The image is fitted to the available viewport without cropping; enlarged content is pannable and panning is bounded so the image cannot be dragged completely out of view.
- Preview header and action footer remain fixed; the image viewport uses the remaining height.
- Light and dark theme styles are included.

No API, database, attachment-storage, or financial calculation code is changed.
