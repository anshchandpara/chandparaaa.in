import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { HERO_VIDEO, HERO_POSTER, getHeroVideo } from '../lib/heroVideo';
import { randomGlyph } from '../lib/glitch';
import GhostText from './GhostText';
import WeightedText from './WeightedText';
import './Landing.css';

/**
 * Landing gate — the front door, shown once per session between the intro
 * loader and the home page.
 *
 * Two worlds share the screen along a LEANING seam: the site hero loop for
 * Work, the Monsoon Season title timelapse for Lab. The seam is a CSS variable
 * (`--split`, 0 → 1 across the width) that the cursor drives through a lerp:
 * hover a world and it grows to ~62% while the other recedes; cross the seam
 * and it swings the other way; leave and it settles back to centre. Each
 * world's loop comes up to colour and drifts a few px with the cursor
 * (`--px/--py`) while it is hot. Choosing sweeps the seam to that edge — the
 * chosen world becomes the screen — then hands off.
 *
 * Layer order is load-bearing: the grid must sit ABOVE the worlds but BELOW
 * the stack, or `mix-blend-mode: difference` inverts the type. `.landing`
 * carries `isolation: isolate` so the blend can't reach the page behind it.
 *
 * It rides the loader's own `acIntroPlayed` flag rather than keeping its own —
 * see Home.jsx.
 */

const LAB_VIDEO = getHeroVideo('monsoon-season-mixtape');

// Stray glyphs scattered around a word. Percentages of a field ~3× the word,
// kept clear of the word's own box in the middle.
const SPOTS = [
  { x: 4, y: 12 }, { x: 22, y: 92 }, { x: 0, y: 55 }, { x: 40, y: 2 },
  { x: 62, y: 98 }, { x: 80, y: 8 }, { x: 98, y: 48 }, { x: 90, y: 90 },
];

/** Flickering special characters around a word while its world is hot. */
function GlitchField({ hot }) {
  const [glyphs, setGlyphs] = useState(() => SPOTS.map(randomGlyph));
  useEffect(() => {
    if (!hot) return undefined;
    // Re-roll a random subset each tick — rolling all of them at once reads as
    // a synchronised blink rather than interference.
    const id = setInterval(() => {
      setGlyphs((g) => g.map((c) => (Math.random() < 0.45 ? randomGlyph() : c)));
    }, 90);
    return () => clearInterval(id);
  }, [hot]);
  return (
    <span className={`landing__glitch${hot ? ' is-hot' : ''}`} aria-hidden="true">
      {SPOTS.map((sp, i) => (
        <span key={i} className="landing__gly" style={{ left: `${sp.x}%`, top: `${sp.y}%` }}>
          {glyphs[i]}
        </span>
      ))}
    </span>
  );
}
// Where the seam rests, and how far a hot world pushes it. tan(12°) is the
// lean — Landing.css draws the seam with the same figure.
const REST = 0.5;
const PUSH = 0.07;
const LEAN = Math.tan((12 * Math.PI) / 180);
const EASE = 0.07; // lerp per frame — slower is more liquid

export default function Landing({ onChoose }) {
  const rootRef = useRef(null);
  const firstRef = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const [hot, setHot] = useState(null); // 'work' | 'lab' | null
  const hotRef = useRef(null);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(hover: none)').matches;

  // Modal while it's up: lock body scroll and move focus in. Mirrors Lightbox.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // The seam and the parallax, lerped every frame toward what the cursor asks
  // for. Which side the cursor is on is measured against the LEANING seam, not
  // the screen's midline, so the hot world is always the one under the cursor.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced || touch) return undefined;
    const cur = { split: REST, px: 0, py: 0 };
    const want = { split: REST, px: 0, py: 0 };
    let leftPage = false;

    const onMove = (e) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = e.clientX / w;
      const ny = e.clientY / h;
      // Seam x at this y: the seam passes through (split, 0.5) and leans by
      // LEAN * height horizontally per unit of height.
      const seamX = cur.split + (0.5 - ny) * LEAN * (h / w);
      const side = nx < seamX ? 'work' : 'lab';
      if (side !== hotRef.current) {
        hotRef.current = side;
        setHot(side);
      }
      want.split = side === 'work' ? REST + PUSH : REST - PUSH;
      want.px = (nx - 0.5) * 2;
      want.py = (ny - 0.5) * 2;
      leftPage = false;
    };
    const onLeave = () => {
      leftPage = true;
      hotRef.current = null;
      setHot(null);
      want.split = REST;
      want.px = 0;
      want.py = 0;
    };
    const tick = () => {
      cur.split += (want.split - cur.split) * EASE;
      cur.px += (want.px - cur.px) * EASE;
      cur.py += (want.py - cur.py) * EASE;
      root.style.setProperty('--split', cur.split.toFixed(4));
      root.style.setProperty('--px', cur.px.toFixed(3));
      root.style.setProperty('--py', cur.py.toFixed(3));
    };

    gsap.ticker.add(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      void leftPage;
    };
  }, [reduced, touch]);

  // Choose: the chosen world sweeps across the whole screen, then we hand off.
  const choose = (mode) => {
    if (leaving) return;
    setLeaving(true);
    const root = rootRef.current;
    if (reduced || !root) {
      onChoose(mode);
      return;
    }
    const v = { split: parseFloat(root.style.getPropertyValue('--split')) || REST };
    gsap.to(v, {
      split: mode === 'work' ? 1.25 : -0.25, // past the edge, so the lean clears too
      duration: 0.7,
      ease: 'none',
      onUpdate: () => root.style.setProperty('--split', v.split.toFixed(4)),
      onComplete: () => onChoose(mode),
    });
  };

  return (
    <div
      ref={rootRef}
      className={`landing${leaving ? ' is-leaving' : ''}${hot ? ` is-hot-${hot}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Choose Work or Lab"
    >
      {/* The two worlds. Work is the base; Lab sits over it, clipped to the
          right of the leaning seam. Each is also a click target for its side. */}
      <div className="landing__worlds" aria-hidden="true">
        <div className="landing__world landing__world--work" onClick={() => choose('work')}>
          <video
            className="landing__media"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={HERO_POSTER}
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        </div>
        <div className="landing__world landing__world--lab" onClick={() => choose('lab')}>
          {LAB_VIDEO && (
            <video className="landing__media" autoPlay muted loop playsInline preload="auto">
              <source src={LAB_VIDEO} type="video/mp4" />
            </video>
          )}
        </div>
        <span className="landing__seam" />
      </div>

      {/* Single full-width layers, so the grid runs unbroken across the seam. */}
      <div className="landing__grid" aria-hidden="true" />
      <div className="landing__veil" aria-hidden="true" />

      <div className="landing__stack">
        <span className="landing__brand wt-hover">
          <WeightedText text="Ansh Chandpara" />
        </span>

        {/* The two choices, one per world, in the wordmark's treatment: an
            outline at rest that fills in around the cursor. */}
        <div className="landing__choices">
          <button
            ref={firstRef}
            type="button"
            className="landing__choice landing__choice--work"
            aria-label="Work"
            data-cursor
            data-cursor-label="Enter"
            onMouseEnter={() => setHot('work')}
            onClick={() => choose('work')}
          >
            <GhostText text="Work" />
            {!reduced && <GlitchField hot={hot === 'work'} />}
          </button>
          <button
            type="button"
            className="landing__choice landing__choice--lab"
            aria-label="Lab"
            data-cursor
            data-cursor-label="Enter"
            onMouseEnter={() => setHot('lab')}
            onClick={() => choose('lab')}
          >
            <GhostText text="Lab" />
            {!reduced && <GlitchField hot={hot === 'lab'} />}
          </button>
        </div>

        <p className="eyebrow landing__role">
          Creative Director · Title Designer · Filmmaker
        </p>
      </div>
    </div>
  );
}
