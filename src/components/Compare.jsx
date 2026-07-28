import { useCallback, useEffect, useRef, useState } from 'react';
import './Compare.css';

/**
 * A/B before/after slider. The `after` (composite) is the base; the `before`
 * (clean plate) is clipped over the left portion and a draggable handle sets
 * the split. Pointer drag, click, and ←/→ keys all move it. Media can be
 * stills or frame-synced loop videos (`video` prop) — the two videos are kept
 * in lockstep so the footage matches across the seam. Passes must share
 * dimensions + timing.
 */
export default function Compare({
  before,
  after,
  video = false,
  labelBefore = 'Plate',
  labelAfter = 'Final',
}) {
  const [pos, setPos] = useState(50); // % from the left
  const ref = useRef(null);
  const dragging = useRef(false);
  const afterVid = useRef(null);
  const beforeVid = useRef(null);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Keep the two videos locked to the same time so only the titles differ
  // across the split (the composite is the timing master).
  useEffect(() => {
    if (!video) return undefined;
    const a = afterVid.current;
    const b = beforeVid.current;
    if (!a || !b) return undefined;

    const sync = () => {
      if (Math.abs(b.currentTime - a.currentTime) > 0.05) {
        try {
          b.currentTime = a.currentTime;
        } catch {
          /* not seekable yet */
        }
      }
    };
    const start = () => {
      if (reduced) return;
      a.play?.().catch(() => {});
      b.play?.().catch(() => {});
    };
    a.addEventListener('timeupdate', sync);
    a.addEventListener('play', start);
    a.addEventListener('loadeddata', start);
    start();
    return () => {
      a.removeEventListener('timeupdate', sync);
      a.removeEventListener('play', start);
      a.removeEventListener('loadeddata', start);
    };
  }, [video, reduced]);

  const fromClientX = useCallback((clientX) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onDown = (e) => {
    dragging.current = true;
    ref.current?.setPointerCapture?.(e.pointerId);
    fromClientX(e.clientX);
  };
  const onMove = (e) => dragging.current && fromClientX(e.clientX);
  const onUp = (e) => {
    dragging.current = false;
    ref.current?.releasePointerCapture?.(e.pointerId);
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 4));
    else if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 4));
    else return;
    e.preventDefault();
  };

  return (
    <div
      className="cmp"
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      data-cursor
      data-cursor-label="Drag"
    >
      {/* Composite — the base, full width. */}
      {video ? (
        <video
          ref={afterVid}
          className="cmp__img"
          src={after}
          muted
          loop
          playsInline
          autoPlay={!reduced}
          preload="auto"
        />
      ) : (
        <img className="cmp__img" src={after} alt="" draggable="false" />
      )}

      {/* Clean plate — clipped to the left of the split. */}
      <div className="cmp__before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {video ? (
          <video
            ref={beforeVid}
            className="cmp__img"
            src={before}
            muted
            loop
            playsInline
            autoPlay={!reduced}
            preload="auto"
          />
        ) : (
          <img className="cmp__img" src={before} alt="" draggable="false" />
        )}
      </div>

      <span className="cmp__label cmp__label--a">{labelBefore}</span>
      <span className="cmp__label cmp__label--b">{labelAfter}</span>

      <div
        className="cmp__handle"
        style={{ left: `${pos}%` }}
        role="slider"
        aria-label="Reveal the composite"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        tabIndex={0}
        onKeyDown={onKey}
      >
        <span className="cmp__grip" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </span>
      </div>
    </div>
  );
}
