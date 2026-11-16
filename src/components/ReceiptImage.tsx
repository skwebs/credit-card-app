import { useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';

type ReceiptImageProps = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  loading?: 'eager' | 'lazy';
};

/** Receipt thumbnail that communicates loading and failed image requests. */
export default function ReceiptImage({
  src,
  alt,
  className = '',
  imageClassName = '',
  loading = 'lazy',
}: ReceiptImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  return (
    <span className={`receipt-image-frame ${className}`}>
      {status !== 'error' && (
        <img
          key={src}
          src={src}
          alt={alt}
          loading={loading}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`receipt-image-element ${imageClassName} ${status === 'loaded' ? 'is-loaded' : 'is-loading'}`}
        />
      )}
      {status === 'loading' && (
        <span className="receipt-image-status" role="status" aria-live="polite">
          <LoaderCircle size={18} className="animate-spin" />
          <span>Loading receipt…</span>
        </span>
      )}
      {status === 'error' && (
        <span className="receipt-image-status is-error" role="status">
          <AlertCircle size={18} />
          <span>Could not load image</span>
        </span>
      )}
    </span>
  );
}
