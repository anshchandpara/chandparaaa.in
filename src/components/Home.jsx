import { useState } from 'react';
import Loader from './Loader';
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

  // The loader runs once per session — not on every return to home.
  const showLoader = INTRO && !prefersReducedMotion && !introAlreadyPlayed();
  const [introDone, setIntroDone] = useState(!showLoader);

  const handleIntroDone = () => {
    setIntroDone(true);
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {showLoader && !introDone && <Loader onDone={handleIntroDone} />}

      <Nav mode={mode} onMode={setMode} />
      <Hero mode={mode} play={introDone} />

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
