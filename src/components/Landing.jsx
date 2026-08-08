import { useCallback, useEffect, useRef, useState } from 'react';
import { useMagnetic } from '../hooks/useMagnetic';
import { HERO_VIDEO, HERO_POSTER, getHeroVideo } from '../lib/heroVideo';
import { scramble, randomGlyph } from '../lib/glitch';
import './Landing.css';

/**
 * Landing gate — the front door, shown once per session between the intro
 * loader and the home page.
 *
 * The screen is split 50/50 so each choice previews its own world: the site
 * hero loop behind Work, the Monsoon Season title timelapse behind Lab. The
 * segmented panel sits centred so **its hairline separator lands exactly on
 * the media seam** — the two lines are meant to read as one, which is why the
 * split is a static 50/50 and hover is expressed through the media instead of
 * a moving seam.
 *
 * Layer order is load-bearing: the grid must sit ABOVE the halves but BELOW
 * the stack, or `mix-blend-mode: difference` inverts the type and destroys it.
 * Grid and veil stay single full-width layers so the grid runs continuously
 * across the seam. `.landing` carries `isolation: isolate` so the blend can't
 * reach the page mounted behind it.
 *
 * It rides the loader's own `acIntroPlayed` flag rather than keeping its own —
 * see Home.jsx.
 */

// The Lab half reuses the existing per-project hero-loop glob rather than a new
// import — monsoon-season-mixtape/hero.mp4 is the 2× hand-painted-title
// timelapse (1.9 MB), already bundled.
const LAB_VIDEO = getHeroVideo('monsoon-season-mixtape');

// Stray glyphs scattered around the panel. Percentages inside `.landing__glitch`,
// kept clear of the centre band where the panel itself sits.
const SPOTS = [
  { x: 6, y: 16, side: 'work' },
  { x: 24, y: 84, side: 'work' },
  { x: 2, y: 54, side: 'work' },
  { x: 40, y: 6, side: 'work' },
  { x: 62, y: 94, side: 'lab' },
  { x: 78, y: 20, side: 'lab' },
  { x: 96, y: 60, side: 'lab' },
  { x: 88, y: 88, side: 'lab' },
];

/** Flickering special characters around the panel while a choice is hovered. */
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
    <div className="landing__glitch" aria-hidden="true">
      {SPOTS.map((s, i) => (
        <span
          key={i}
          className={`landing__gly${s.side === hot ? ' is-hot' : ''}`}
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
        >
          {glyphs[i]}
        </span>
      ))}
    </div>
  );
}

export default function Landing({ onChoose }) {
  const workRef = useMagnetic(0.25);
  const labRef = useMagnetic(0.25);
  const firstRef = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const [hot, setHot] = useState(null); // 'work' | 'lab' | null
  // False until the frame after mount. The a11y focus() below fires a focus
  // event that Chrome DOES match `:focus-visible` against, so testing for
  // :focus-visible alone is not enough — without this the gate opens with Work
  // lit, mid-scramble, and stuck that way until something else takes focus.
  const readyRef = useRef(false);

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Modal while it's up: lock body scroll and move focus in, so the choice is
  // reachable by keyboard. Mirrors Lightbox.jsx.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // focus() dispatches its focus event synchronously, so readyRef is still
    // false when Choice's handler runs — the rAF below only opens the gate to
    // *subsequent* (real) keyboard focus.
    firstRef.current?.focus({ preventScroll: true });
    const raf = requestAnimationFrame(() => {
      readyRef.current = true;
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Play the exit, then hand off. Duration matches `.landing.is-leaving`.
  const choose = (mode) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => onChoose(mode), reduced ? 0 : 520);
  };

  return (
    <div
      className={`landing${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Choose Work or Lab"
    >
      {/* Each choice's own world, split down the middle. */}
      <div className="landing__halves" aria-hidden="true">
        <div
          className={`landing__half landing__half--work${hot === 'work' ? ' is-hot' : ''}`}
        >
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
        <div className={`landing__half landing__half--lab${hot === 'lab' ? ' is-hot' : ''}`}>
          {LAB_VIDEO && (
            <video className="landing__media" autoPlay muted loop playsInline preload="auto">
              <source src={LAB_VIDEO} type="video/mp4" />
            </video>
          )}
        </div>
        {/* Continues the panel's separator across the whole screen. */}
        <span className="landing__seam" />
      </div>

      {/* Single full-width layers, so the grid runs unbroken across the seam. */}
      <div className="landing__grid" aria-hidden="true" />
      <div className="landing__veil" aria-hidden="true" />

      {/* Brand pinned to the top margin, role to the bottom, the choice panel
          centred in the space between — the loader's three-row composition. */}
      <div className="landing__stack">
        <span className="landing__brand">Ansh Chandpara</span>

        <div className="landing__mid">
          {/* Sibling of the panel, not a child: the panel clips its own
              overflow to contain the glow, which would eat these too. */}
          {!reduced && hot && <GlitchField hot={hot} />}

          <div className="landing__panel">
            <Choice
              label="Work"
              reduced={reduced}
              readyRef={readyRef}
              magneticRef={workRef}
              firstRef={firstRef}
              onEnter={() => setHot('work')}
              onLeave={() => setHot(null)}
              onPick={() => choose('work')}
            />
            <Choice
              label="Lab"
              reduced={reduced}
              readyRef={readyRef}
              magneticRef={labRef}
              onEnter={() => setHot('lab')}
              onLeave={() => setHot(null)}
              onPick={() => choose('lab')}
            />
          </div>
        </div>

        <p className="eyebrow landing__role">
          Creative Director · Title Designer · Filmmaker
        </p>
      </div>
    </div>
  );
}

/**
 * One choice. The visible text scrambles on hover; the button keeps a real
 * `aria-label` and the mutating span is aria-hidden, or the churning text
 * content gets re-announced on every roll.
 */
function Choice({ label, reduced, readyRef, magneticRef, firstRef, onEnter, onLeave, onPick }) {
  const textRef = useRef(null);
  const cancelRef = useRef(null);

  const stop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);

  // Never leave a half-decoded label behind on unmount.
  useEffect(() => stop, [stop]);

  const enter = () => {
    onEnter();
    if (reduced) return;
    stop();
    cancelRef.current = scramble(textRef.current, label);
  };

  const leave = () => {
    onLeave();
    stop();
  };

  return (
    <button
      ref={(el) => {
        if (magneticRef) magneticRef.current = el;
        if (firstRef) firstRef.current = el;
      }}
      type="button"
      className="landing__choice"
      aria-label={label}
      data-magnetic
      data-cursor
      data-cursor-label="Enter"
      onMouseEnter={enter}
      onMouseLeave={leave}
      /* Only real keyboard focus should light the half. `readyRef` gates out
         the mount-time a11y focus (Chrome matches :focus-visible on it, so
         that check alone is not sufficient). */
      onFocus={(e) => {
        if (readyRef?.current && e.target.matches(':focus-visible')) enter();
      }}
      onBlur={leave}
      onClick={onPick}
    >
      <span ref={textRef} aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
