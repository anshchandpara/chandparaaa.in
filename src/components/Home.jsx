import { useState } from 'react';
import Loader from './Loader';
import Landing from './Landing';
import Nav from './Nav';
import Hero from './Hero';
import PlatformMarquee from './PlatformMarquee';
import Work from './Work';
import Footer from './Footer';
import { useMode } from '../hooks/useMode';
import { DESIGN } from '../lib/design';

const INTRO_KEY = 'acIntroPlayed';

// Props (configurable settings from the design handoff):
const INTRO = DESIGN.introLoader; // show/skip the intro loader (/admin → Design)
const GATE = DESIGN.landingGate; // show/skip the Work·Lab landing gate (same tab)
// Masonry density cap on the widest screens (set in /admin → Design); the grid
// steps down responsively (4 → 3 → 2 → 1) as the viewport narrows.
const COLUMNS = DESIGN.columns;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const introAlreadyPlayed = () => {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
};

export default function Home() {
  const [mode, setMode] = useMode();

  // Decided ONCE, on mount. These must not be plain render-time expressions:
  // the loader writes acIntroPlayed when it finishes, so re-reading storage on
  // every render flips both to false mid-session and rips the gate off the
  // screen the instant the loader ends.
  const [entry] = useState(() => {
    // The loader runs once per session — not on every return to home.
    const loader = INTRO && !prefersReducedMotion && !introAlreadyPlayed();
    // The gate rides the loader: cold entry only, and skipped wherever the
    // loader is (reduced motion, or introLoader off). No second flag needed.
    return { loader, gate: GATE && loader };
  });

  const [introDone, setIntroDone] = useState(!entry.loader);
  const [gateDone, setGateDone] = useState(!entry.gate);

  const handleIntroDone = () => {
    setIntroDone(true);
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  // The gate is the big front-door version of the nav's Work/Lab toggle.
  const handleChoose = (m) => {
    setMode(m);
    setGateDone(true);
  };

  return (
    <>
      {entry.loader && !introDone && <Loader onDone={handleIntroDone} />}
      {/* Mounted from the start (not gated on introDone) so the loader's
          slide-up *reveals* the gate rather than cutting to it. */}
      {entry.gate && !gateDone && <Landing onChoose={handleChoose} />}

      <Nav mode={mode} onMode={setMode} />
      {/* The wordmark scatter waits for the choice — otherwise it plays out
          unseen behind the gate and you arrive at an already-settled title. */}
      <Hero mode={mode} play={introDone && gateDone} />

      {mode === 'work' && (
        <>
          <PlatformMarquee />
          <Work columns={COLUMNS} />
        </>
      )}

      <Footer />
    </>
  );
}
