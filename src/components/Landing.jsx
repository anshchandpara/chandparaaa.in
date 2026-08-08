import { useEffect, useRef, useState } from 'react';
import { useMagnetic } from '../hooks/useMagnetic';
import { HERO_VIDEO, HERO_POSTER } from '../lib/heroVideo';
import './Landing.css';

/**
 * Landing gate — the front door, shown once per session between the intro
 * loader and the home page. The hero loop plays at 35% behind a
 * difference-blended FUI grid; a centred stack (brand → role → the two choices)
 * sits on top. Picking one sets Work/Lab mode and dismisses the gate, revealing
 * the home page that has been mounted behind it all along.
 *
 * Layer order is load-bearing: the grid must sit ABOVE the video but BELOW the
 * stack, or `mix-blend-mode: difference` inverts the type and destroys it.
 * `.landing` carries `isolation: isolate` so the blend can't reach the page.
 *
 * It rides the loader's own `acIntroPlayed` flag rather than keeping its own —
 * see Home.jsx.
 */
export default function Landing({ onChoose }) {
  const workRef = useMagnetic(0.25);
  const labRef = useMagnetic(0.25);
  const firstRef = useRef(null);
  const [leaving, setLeaving] = useState(false);

  // Modal while it's up: lock body scroll and move focus in, so the choice is
  // reachable by keyboard. Mirrors Lightbox.jsx.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Play the exit, then hand off. Duration matches `.landing.is-leaving`.
  const choose = (mode) => {
    if (leaving) return;
    setLeaving(true);
    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => onChoose(mode), reduced ? 0 : 520);
  };

  return (
    <div
      className={`landing${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Choose Work or Lab"
    >
      <video
        className="landing__media"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={HERO_POSTER}
        aria-hidden="true"
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>

      {/* Same tile as the site-wide backdrop, inverted against the loop. */}
      <div className="landing__grid" aria-hidden="true" />
      <div className="landing__veil" aria-hidden="true" />

      {/* Brand pinned to the top margin, role to the bottom, the choice panel
          centred in the space between — the loader's three-row composition. */}
      <div className="landing__stack">
        <span className="landing__brand">Ansh Chandpara</span>

        <div className="landing__mid">
          {/* Shared backing panel — the neumorphic ground the plates extrude
              from. Without it the relief has no consistent surface to read
              against and the buttons flatten out over the moving loop. */}
          <div className="landing__panel">
            <button
              ref={(el) => {
                workRef.current = el;
                firstRef.current = el;
              }}
              type="button"
              className="landing__choice"
              data-magnetic
              data-cursor
              data-cursor-label="Enter"
              onClick={() => choose('work')}
            >
              Work
            </button>
            <button
              ref={labRef}
              type="button"
              className="landing__choice"
              data-magnetic
              data-cursor
              data-cursor-label="Enter"
              onClick={() => choose('lab')}
            >
              Lab
            </button>
          </div>
        </div>

        <p className="eyebrow landing__role">
          Creative Director · Title Designer · Filmmaker
        </p>
      </div>
    </div>
  );
}
