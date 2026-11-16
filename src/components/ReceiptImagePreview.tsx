import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Download, ExternalLink, LoaderCircle, RefreshCw, X } from 'lucide-react';

type ReceiptImagePreviewProps = {
  src: string;
  alt?: string;
  title?: string;
  onClose: () => void;
};

type Point = { x: number; y: number };
type PointerState = { current: Map<number, Point> };

/** Theme-aware receipt viewer with native-feeling pinch, wheel and drag gestures. */
export default function ReceiptImagePreview({
  src,
  alt = 'Receipt image',
  title = 'Receipt preview',
  onClose,
}: ReceiptImagePreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointers = useRef<PointerState>({ current: new Map() });
  const gesture = useRef({ startDistance: 0, startZoom: 1, startOffset: { x: 0, y: 0 }, lastPoint: { x: 0, y: 0 } });
  const lastTap = useRef(0);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const clampZoom = (value: number) => Math.min(4, Math.max(1, value));
  const clampOffset = (point: Point, scale = zoom): Point => {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return point;
    const maxX = Math.max(0, (image.clientWidth * scale - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (image.clientHeight * scale - viewport.clientHeight) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, point.x)), y: Math.max(-maxY, Math.min(maxY, point.y)) };
  };
  const applyZoom = (value: number) => {
    const next = clampZoom(value);
    setZoom(next);
    if (next === 1) setOffset({ x: 0, y: 0 });
    else setOffset(current => clampOffset(current, next));
  };
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const map = pointers.current.current;
    map.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (map.size === 1) {
      gesture.current.startOffset = offset;
      gesture.current.lastPoint = { x: event.clientX, y: event.clientY };
    } else if (map.size === 2) {
      const [a, b] = [...map.values()];
      gesture.current.startDistance = distance(a, b);
      gesture.current.startZoom = zoom;
      gesture.current.startOffset = offset;
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current.current;
    if (!map.has(event.pointerId)) return;
    event.preventDefault();
    map.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (map.size >= 2) {
      const [a, b] = [...map.values()];
      const startDistance = gesture.current.startDistance;
      if (startDistance > 0) applyZoom(gesture.current.startZoom * distance(a, b) / startDistance);
    } else if (zoom > 1) {
      const point = map.get(event.pointerId)!;
      setOffset(clampOffset({
        x: gesture.current.startOffset.x + point.x - gesture.current.lastPoint.x,
        y: gesture.current.startOffset.y + point.y - gesture.current.lastPoint.y,
      }));
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.current.delete(event.pointerId);
    if (pointers.current.current.size === 1) {
      const point = [...pointers.current.current.values()][0];
      gesture.current.lastPoint = point;
      gesture.current.startOffset = offset;
    } else if (pointers.current.current.size === 0) {
      gesture.current.startDistance = 0;
    }
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.deltaY !== 0) {
      event.preventDefault();
      applyZoom(zoom * (event.deltaY < 0 ? 1.12 : 0.89));
    }
  };

  const onDoubleClick = () => {
    applyZoom(zoom > 1 ? 1 : 2);
  };

  const onClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) onDoubleClick();
    lastTap.current = now;
  };

  return createPortal(
    <div className="receipt-preview-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="receipt-preview-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="receipt-preview-header">
          <div className="min-w-0">
            <h2 className="receipt-preview-title">{title}</h2>
            <p className="receipt-preview-subtitle">Pinch to zoom · Drag to move · Double tap to reset</p>
          </div>
          <button type="button" className="receipt-preview-icon-button" onClick={onClose} aria-label="Close image preview"><X size={22}/></button>
        </header>

        <div
          ref={viewportRef}
          className={`receipt-preview-viewport${zoom > 1 ? ' is-zoomed' : ''}`}
          aria-label="Receipt image gesture area"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onWheel={onWheel}
          onClick={onClick}
        >
          {imageStatus !== 'error' && (
            <img
              key={`${src}-${retryToken}`}
              ref={imageRef}
              src={src}
              alt={alt}
              className="receipt-preview-image"
              style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`, visibility: imageStatus === 'loaded' ? 'visible' : 'hidden' }}
              draggable={false}
              onLoad={() => { setImageStatus('loaded'); setZoom(1); setOffset({ x: 0, y: 0 }); pointers.current.current.clear(); }}
              onError={() => setImageStatus('error')}
            />
          )}
          {imageStatus === 'loading' && (
            <div className="receipt-preview-image-status" role="status" aria-live="polite">
              <LoaderCircle size={24} className="animate-spin" />
              <span>Loading receipt image…</span>
            </div>
          )}
          {imageStatus === 'error' && (
            <div className="receipt-preview-image-status is-error" role="alert">
              <AlertCircle size={25} />
              <span>We couldn’t load this receipt image.</span>
              <button type="button" onClick={() => { setImageStatus('loading'); setRetryToken(value => value + 1); }}>
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          )}
        </div>

        <footer className="receipt-preview-footer">
          <a className="receipt-preview-action" href={src} download aria-label="Download receipt image"><Download size={17}/><span>Download</span></a>
          <a className="receipt-preview-action" href={src} target="_blank" rel="noreferrer"><ExternalLink size={17}/><span>Open original</span></a>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
