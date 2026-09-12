import { useEffect, useRef } from 'react';
import './Lightbox.css';

/**
 * Full-screen carousel lightbox. Renders `images[index]` at native resolution
 * (object-fit: contain) over a near-black veil. Esc closes; ←/→ and the edge
 * buttons navigate; a quick horizontal swipe navigates on touch; clicking the
 * veil (not the image) closes. Body scroll is locked while open. Neighbouring
 * frames are preloaded so navigation feels instant.
 *
 * Items are `{ src, alt }` for stills and self-hosted loops. Two more kinds
 * carry a show's episode sequences through the same mode: `{ vimeo, label,
 * poster? }` plays the film in a 16:9 player, and `{ reserved: true, label }`
 * is a slot whose film hasn't landed yet — it opens, it counts, it steps.
 */
const isVideoFile = (src) => /\.(mp4|webm)(\?|#|$)/i.test(src || '');
const itemKey = (im, i) => im.src || (im.vimeo ? `v${im.vimeo}` : `r${i}`);
const itemName = (im) => im.alt || im.label || 'Image';
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

  // Preload neighbouring stills (videos stream themselves; players and
  // reserved slots have nothing to fetch).
  useEffect(() => {
    if (count < 2) return;
    [images[(index + 1) % count], images[(index - 1 + count) % count]].forEach((im) => {
      if (!im.src || isVideoFile(im.src)) return;
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
      aria-label={`${itemName(img)} — ${index + 1} of ${count}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {img.vimeo ? (
        <div key={`v${img.vimeo}`} className="lb__embed" onPointerDown={(e) => e.stopPropagation()}>
          <iframe
            className="lb__embed-frame"
            title={itemName(img)}
            src={`https://player.vimeo.com/video/${img.vimeo}?autoplay=1&title=0&byline=0&portrait=0&dnt=1&color=d98b2b`}
            allow="autoplay; fullscreen; picture-in-picture"
          />
        </div>
      ) : img.reserved ? (
        <div key={`r${index}`} className="lb__reserved" aria-label={itemName(img)}>
          <span>{img.label}</span>
        </div>
      ) : isVideoFile(img.src) ? (
        <video
          key={img.src}
          className="lb__img"
          src={img.src}
          muted
          loop
          playsInline
          autoPlay
          controls={false}
        />
      ) : (
        <img key={img.src} className="lb__img" src={img.src} alt={img.alt || ''} draggable="false" />
      )}

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
                key={itemKey(im, i)}
                className={`lb__thumb${i === index ? ' is-active' : ''}${im.src || im.poster ? '' : ' lb__thumb--label'}`}
                onClick={() => onNavigate(i)}
                data-cursor
                aria-label={`Go to ${itemName(im)}`}
                aria-current={i === index || undefined}
              >
                {im.src || im.poster ? (
                  <img src={im.src || im.poster} alt={im.alt || ''} loading="lazy" draggable="false" />
                ) : (
                  <span>{String(i + 1).padStart(2, '0')}</span>
                )}
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
