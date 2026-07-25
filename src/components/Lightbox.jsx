import { useEffect, useRef } from 'react';
import './Lightbox.css';

/**
 * Full-screen carousel lightbox. Renders `images[index]` at native resolution
 * (object-fit: contain) over a near-black veil. Esc closes; ←/→ and the edge
 * buttons navigate; a quick horizontal swipe navigates on touch; clicking the
 * veil (not the image) closes. Body scroll is locked while open. Neighbouring
 * frames are preloaded so navigation feels instant.
 */
export default function Lightbox({ images, index, onClose, onNavigate }) {
  const count = images.length;
  const img = images[index];
  const swipe = useRef(null);
  const closeRef = useRef(null);
  const stripRef = useRef(null);

  const prev = () => onNavigate((index - 1 + count) % count);
  const next = () => onNavigate((index + 1) % count);

  // Keep the active thumbnail centred in the filmstrip.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector('.is-active');
    if (!strip || !active) return;
    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollTo({
      left: active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }, [index]);

  // Keyboard + scroll lock while mounted.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && count > 1) prev();
      else if (e.key === 'ArrowRight' && count > 1) next();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  // Preload neighbours.
  useEffect(() => {
    if (count < 2) return;
    [images[(index + 1) % count], images[(index - 1 + count) % count]].forEach((im) => {
      const pre = new Image();
      pre.src = im.src;
    });
  }, [index, count, images]);

  const onPointerDown = (e) => {
    swipe.current = e.clientX;
  };
  const onPointerUp = (e) => {
    if (swipe.current == null || count < 2) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (dx > 48) prev();
    else if (dx < -48) next();
  };

  if (!img) return null;

  return (
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label={`${img.alt || 'Image'} — ${index + 1} of ${count}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <img key={img.src} className="lb__img" src={img.src} alt={img.alt || ''} draggable="false" />

      <button ref={closeRef} className="lb__close" onClick={onClose} data-cursor aria-label="Close">
        ×
      </button>

      {count > 1 && (
        <>
          <button className="lb__arrow lb__arrow--prev" onClick={prev} data-cursor aria-label="Previous image">
            ←
          </button>
          <button className="lb__arrow lb__arrow--next" onClick={next} data-cursor aria-label="Next image">
            →
          </button>

          {/* Filmstrip — click to jump; the active frame glows. Pointer events
              stop here so dragging the strip never triggers the swipe-nav. */}
          <div
            ref={stripRef}
            className="lb__strip"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {images.map((im, i) => (
              <button
                key={im.src}
                className={`lb__thumb${i === index ? ' is-active' : ''}`}
                onClick={() => onNavigate(i)}
                data-cursor
                aria-label={`Go to image ${i + 1}`}
                aria-current={i === index || undefined}
              >
                <img src={im.src} alt="" loading="lazy" draggable="false" />
              </button>
            ))}
          </div>

          <span className="lb__count">
            {String(index + 1).padStart(2, '0')} <em>/</em> {String(count).padStart(2, '0')}
          </span>
        </>
      )}
    </div>
  );
}
